/* =============================================================
   Serveur du Café Brun — sans aucune dépendance.

   - sert le site public (/)
   - sert l'espace d'administration (/admin)
   - expose l'API de modification du contenu, protégée par compte

   Démarrage :  npm start        (port 8000 par défaut)
   Port         PORT=3000 npm start
   Derrière HTTPS : COOKIE_SECURE=1 npm start
   ============================================================= */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var auth = require('./auth.js');
var stockage = require('./stockage.js');
var validation = require('./validation.js');

var RACINE = path.join(__dirname, '..');
var PORT = parseInt(process.env.PORT, 10) || 8000;
var COOKIE = 'cafe_brun_session';
var COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
var TAILLE_MAX_CORPS = 1024 * 1024; // 1 Mo : largement de quoi tenir la carte

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/* ---------------------------------------------------------------
 * Réponses
 * ------------------------------------------------------------- */

function envoyerJson(rep, code, donnees, entetes) {
  var corps = JSON.stringify(donnees);
  rep.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corps),
    'Cache-Control': 'no-store',
  }, entetes || {}));
  rep.end(corps);
}

function envoyerTexte(rep, code, texte) {
  rep.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  rep.end(texte);
}

function cookieSession(jeton, dureeSecondes) {
  return COOKIE + '=' + jeton +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + dureeSecondes +
    (COOKIE_SECURE ? '; Secure' : '');
}

function lireCookie(req, nom) {
  var brut = req.headers.cookie;
  if (!brut) return null;
  var trouve = null;
  brut.split(';').forEach(function (morceau) {
    var i = morceau.indexOf('=');
    if (i === -1) return;
    if (morceau.slice(0, i).trim() === nom) trouve = morceau.slice(i + 1).trim();
  });
  return trouve;
}

function lireCorps(req) {
  return new Promise(function (resoudre, rejeter) {
    var morceaux = [];
    var taille = 0;
    req.on('data', function (m) {
      taille += m.length;
      if (taille > TAILLE_MAX_CORPS) {
        rejeter(new Error('Contenu trop volumineux.'));
        req.destroy();
        return;
      }
      morceaux.push(m);
    });
    req.on('end', function () {
      var texte = Buffer.concat(morceaux).toString('utf8');
      if (!texte) return resoudre({});
      try {
        resoudre(JSON.parse(texte));
      } catch (e) {
        rejeter(new Error('JSON invalide.'));
      }
    });
    req.on('error', rejeter);
  });
}

/* ---------------------------------------------------------------
 * Sécurité
 * ------------------------------------------------------------- */

/**
 * Les navigateurs n'envoient un en-tête personnalisé en inter-origine
 * qu'après un preflight CORS, que ce serveur n'autorise pas : exiger
 * cet en-tête suffit à écarter les requêtes CSRF, en plus du cookie
 * SameSite=Strict.
 */
function origineLegitime(req) {
  return req.headers['x-cafe-brun'] === '1';
}

function sessionDe(req) {
  return auth.session(lireCookie(req, COOKIE));
}

function adresseDe(req) {
  return (req.socket.remoteAddress || 'inconnue');
}

/* ---------------------------------------------------------------
 * Fichiers statiques
 * ------------------------------------------------------------- */

function servirFichier(rep, chemin) {
  fs.readFile(chemin, function (err, contenu) {
    if (err) return envoyerTexte(rep, 404, 'Page introuvable.');

    var ext = path.extname(chemin).toLowerCase();
    var entetes = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': contenu.length,
      'X-Content-Type-Options': 'nosniff',
    };
    // Le contenu change à chaque enregistrement : pas de cache long.
    if (ext === '.html' || chemin.indexOf('contenu.js') !== -1) {
      entetes['Cache-Control'] = 'no-cache';
    }
    rep.writeHead(200, entetes);
    rep.end(contenu);
  });
}

/** Résout un chemin d'URL en fichier, en refusant toute sortie du dossier. */
function resoudre(cheminUrl) {
  var relatif = decodeURIComponent(cheminUrl).replace(/^\/+/, '');
  if (relatif === '') relatif = 'index.html';

  var absolu = path.normalize(path.join(RACINE, relatif));
  if (absolu !== RACINE && !absolu.startsWith(RACINE + path.sep)) return null;

  // Le fichier des comptes et les sauvegardes ne sont jamais servis.
  var interdits = [path.join(RACINE, 'comptes.json'), path.join(RACINE, 'data', 'sauvegardes')];
  if (interdits.some(function (i) { return absolu === i || absolu.startsWith(i + path.sep); })) return null;

  try {
    if (fs.statSync(absolu).isDirectory()) absolu = path.join(absolu, 'index.html');
  } catch (e) {
    return null;
  }
  return absolu;
}

/* ---------------------------------------------------------------
 * API
 * ------------------------------------------------------------- */

function traiterApi(req, rep, chemin) {
  var s = sessionDe(req);

  /* --- Connexion --- */
  if (chemin === '/api/connexion' && req.method === 'POST') {
    if (!origineLegitime(req)) return envoyerJson(rep, 403, { erreur: 'Requête refusée.' });

    return lireCorps(req).then(function (corps) {
      var resultat = auth.connecter(corps.identifiant, corps.motDePasse, adresseDe(req));
      if (!resultat.ok) {
        return envoyerJson(rep, resultat.attente ? 429 : 401, { erreur: resultat.message });
      }
      envoyerJson(rep, 200, { identifiant: resultat.identifiant },
        { 'Set-Cookie': cookieSession(resultat.jeton, auth.DUREE_SESSION_MS / 1000) });
    }).catch(function (e) {
      envoyerJson(rep, 400, { erreur: e.message });
    });
  }

  /* --- Déconnexion --- */
  if (chemin === '/api/deconnexion' && req.method === 'POST') {
    auth.fermerSession(lireCookie(req, COOKIE));
    return envoyerJson(rep, 200, { deconnecte: true }, { 'Set-Cookie': cookieSession('', 0) });
  }

  /* --- État de la session --- */
  if (chemin === '/api/session' && req.method === 'GET') {
    return envoyerJson(rep, 200, s ? { connecte: true, identifiant: s.identifiant } : { connecte: false });
  }

  // Tout ce qui suit demande d'être connecté.
  if (!s) return envoyerJson(rep, 401, { erreur: 'Session expirée : reconnectez-vous.' });

  /* --- Lecture du contenu --- */
  if (chemin === '/api/contenu' && req.method === 'GET') {
    try {
      return envoyerJson(rep, 200, { contenu: stockage.lire() });
    } catch (e) {
      return envoyerJson(rep, 500, { erreur: 'Contenu illisible : ' + e.message });
    }
  }

  /* --- Enregistrement du contenu --- */
  if (chemin === '/api/contenu' && req.method === 'PUT') {
    if (!origineLegitime(req)) return envoyerJson(rep, 403, { erreur: 'Requête refusée.' });

    return lireCorps(req).then(function (corps) {
      var erreurs = validation.verifierContenu(corps.contenu);
      if (erreurs.length) return envoyerJson(rep, 422, { erreurs: erreurs });

      stockage.ecrire(corps.contenu);
      console.log('[' + new Date().toISOString() + '] contenu enregistré par ' + s.identifiant);
      envoyerJson(rep, 200, { enregistre: true, le: new Date().toISOString() });
    }).catch(function (e) {
      envoyerJson(rep, 400, { erreur: e.message });
    });
  }

  /* --- Changement de mot de passe --- */
  if (chemin === '/api/motdepasse' && req.method === 'POST') {
    if (!origineLegitime(req)) return envoyerJson(rep, 403, { erreur: 'Requête refusée.' });

    return lireCorps(req).then(function (corps) {
      try {
        auth.changerMotDePasse(s.identifiant, corps.ancien, corps.nouveau);
        envoyerJson(rep, 200, { modifie: true });
      } catch (e) {
        envoyerJson(rep, 400, { erreur: e.message });
      }
    }).catch(function (e) {
      envoyerJson(rep, 400, { erreur: e.message });
    });
  }

  return envoyerJson(rep, 404, { erreur: 'Route inconnue.' });
}

/* ---------------------------------------------------------------
 * Serveur
 * ------------------------------------------------------------- */

var serveur = http.createServer(function (req, rep) {
  var chemin = url.parse(req.url).pathname;

  rep.setHeader('X-Frame-Options', 'SAMEORIGIN');
  rep.setHeader('Referrer-Policy', 'same-origin');

  if (chemin.startsWith('/api/')) {
    try {
      return traiterApi(req, rep, chemin);
    } catch (e) {
      console.error(e);
      return envoyerJson(rep, 500, { erreur: 'Erreur interne.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return envoyerTexte(rep, 405, 'Méthode non autorisée.');
  }

  // L'interface d'administration ne s'ouvre que pour une session valide ;
  // la page de connexion, elle, reste accessible.
  if ((chemin === '/admin' || chemin === '/admin/') && !sessionDe(req)) {
    return servirFichier(rep, path.join(RACINE, 'admin', 'connexion.html'));
  }

  var fichier = resoudre(chemin);
  if (!fichier) return envoyerTexte(rep, 404, 'Page introuvable.');
  servirFichier(rep, fichier);
});

if (require.main === module) {
  if (auth.lireComptes().length === 0) {
    console.log('\n⚠  Aucun compte n\'existe encore.');
    console.log('   Créez-en un avec :  npm run compte\n');
  }

  setInterval(auth.nettoyerSessions, 60 * 60 * 1000).unref();

  serveur.listen(PORT, function () {
    console.log('Le Café Brun');
    console.log('  Site      → http://localhost:' + PORT + '/');
    console.log('  Admin     → http://localhost:' + PORT + '/admin');
    console.log('  Ctrl+C pour arrêter.');
  });
}

module.exports = serveur;
