/*
 * Vérification complète du projet — aucune dépendance :
 *
 *   node tests/verifie.js
 *
 * 1. le contenu publié est valide et data/contenu.js est à jour ;
 * 2. la logique « ouvert / fermé » se comporte comme attendu ;
 * 3. la validation refuse bien les contenus incorrects ;
 * 4. les comptes et les sessions font leur travail ;
 * 5. le serveur protège l'API et enregistre correctement.
 */

'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');

var RACINE = path.join(__dirname, '..');

// Les modules serveur lisent ces variables au chargement : elles doivent
// être posées avant tout require, pour ne jamais toucher aux vraies données.
var BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-brun-test-'));
process.env.CAFE_BRUN_COMPTES = path.join(BAC, 'comptes.json');
process.env.CAFE_BRUN_DATA = path.join(BAC, 'data');
fs.mkdirSync(process.env.CAFE_BRUN_DATA);
fs.copyFileSync(path.join(RACINE, 'data', 'contenu.json'),
  path.join(process.env.CAFE_BRUN_DATA, 'contenu.json'));

var Horaires = require(path.join(RACINE, 'assets/js/horaires.js'));
var validation = require(path.join(RACINE, 'serveur/validation.js'));
var stockage = require(path.join(RACINE, 'serveur/stockage.js'));
var auth = require(path.join(RACINE, 'serveur/auth.js'));

/* ---------------------------------------------------------------
 * Micro-harnais
 * ------------------------------------------------------------- */

var reussis = 0;
var echecs = [];

function verifier(intitule, condition, details) {
  if (condition) reussis++;
  else echecs.push(intitule + (details ? ' — ' + details : ''));
}

function egal(intitule, obtenu, attendu) {
  verifier(intitule, obtenu === attendu, 'obtenu « ' + obtenu + ' », attendu « ' + attendu + ' »');
}

/* ---------------------------------------------------------------
 * 1. Le contenu publié
 * ------------------------------------------------------------- */

var C = JSON.parse(fs.readFileSync(path.join(RACINE, 'data/contenu.json'), 'utf8'));

var erreursContenu = validation.verifierContenu(C);
verifier('data/contenu.json est valide', erreursContenu.length === 0, erreursContenu.join(' | '));

egal('le bar s\'appelle « Le Café Brun »', C.bar.nom, 'Le Café Brun');
egal('l\'adresse est la bonne', C.bar.adresse.rue, '84 Rue Cauchoise');
egal('la ville est Rouen', C.bar.adresse.ville, 'Rouen');
egal('le code postal est celui de Rouen', C.bar.adresse.codePostal, '76000');
egal('le contact du créateur du site est renseigné', C.bar.creditSite.email, 'sanctimaps@gmail.com');
verifier('la phrase de contact accompagne l\'adresse',
  typeof C.bar.creditSite.texte === 'string' && C.bar.creditSite.texte.length > 10);

// data/contenu.js est un fichier généré : il doit refléter le JSON.
var jsAttendu = stockage.genererJs(C);
var jsPublie = fs.readFileSync(path.join(RACINE, 'data/contenu.js'), 'utf8');
verifier('data/contenu.js est à jour (sinon : npm run generer)', jsPublie === jsAttendu);

// Et il doit rester chargeable par un navigateur.
var vm = require('vm');
var bac = { window: {} };
vm.createContext(bac);
vm.runInContext(jsPublie, bac, { filename: 'data/contenu.js' });
verifier('data/contenu.js expose window.CONTENU', !!bac.window.CONTENU);
egal('le contenu exposé porte le bon nom', bac.window.CONTENU.bar.nom, 'Le Café Brun');

/* ---------------------------------------------------------------
 * 2. Logique des horaires
 * ------------------------------------------------------------- */

var horairesTest = Horaires.creer({
  horaires: {
    lundi: [],
    mardi: [{ ouverture: '17:00', fermeture: '00:00' }],
    mercredi: [{ ouverture: '17:00', fermeture: '00:00' }],
    jeudi: [{ ouverture: '17:00', fermeture: '02:00' }],
    vendredi: [{ ouverture: '16:00', fermeture: '02:00' }],
    samedi: [{ ouverture: '16:00', fermeture: '02:00' }],
    dimanche: [{ ouverture: '17:00', fermeture: '23:00' }],
  },
  fermetures: [{ du: '2026-12-24', au: '2026-12-25', motif: 'Fêtes' }],
  happyHour: { actif: true, jours: ['mardi', 'jeudi'], debut: '17:00', fin: '19:00', texte: 'Pinte à 5 €' },
});

function le(iso, heure) { return Horaires.dateLocale(iso, heure); }

// 2026-09-02 mercredi, 09-03 jeudi, 09-04 vendredi, 09-07 lundi.
egal('jeudi 18 h : ouvert', horairesTest.etatOuverture(le('2026-09-03', '18:00')).ouvert, true);
egal('jeudi 16 h 59 : encore fermé', horairesTest.etatOuverture(le('2026-09-03', '16:59')).ouvert, false);
egal('vendredi 1 h : c\'est encore la soirée de jeudi',
  horairesTest.etatOuverture(le('2026-09-04', '01:00')).ouvert, true);
egal('vendredi 3 h : fermé', horairesTest.etatOuverture(le('2026-09-04', '03:00')).ouvert, false);
egal('mercredi 23 h 59 : ouvert jusqu\'à minuit',
  horairesTest.etatOuverture(le('2026-09-02', '23:59')).ouvert, true);
egal('jeudi 0 h 30 : fermé, mercredi ferme à minuit',
  horairesTest.etatOuverture(le('2026-09-03', '00:30')).ouvert, false);
egal('lundi : fermé toute la journée', horairesTest.etatOuverture(le('2026-09-07', '20:00')).ouvert, false);

verifier('lundi soir : réouverture annoncée mardi 17 h',
  Horaires.isoDuJour(horairesTest.etatOuverture(le('2026-09-07', '20:00')).prochain) === '2026-09-08' &&
  horairesTest.etatOuverture(le('2026-09-07', '20:00')).prochain.getHours() === 17);
verifier('jeudi 18 h : fermeture annoncée à 2 h',
  horairesTest.etatOuverture(le('2026-09-03', '18:00')).jusqua.getHours() === 2);

egal('24 décembre : fermeture exceptionnelle',
  horairesTest.etatOuverture(le('2026-12-24', '20:00')).ouvert, false);
verifier('24 décembre : le motif est affiché',
  horairesTest.texteStatut(le('2026-12-24', '20:00')).texte.indexOf('Fêtes') !== -1,
  horairesTest.texteStatut(le('2026-12-24', '20:00')).texte);
egal('26 décembre : de nouveau ouvert',
  horairesTest.etatOuverture(le('2026-12-26', '20:00')).ouvert, true);

egal('statut « ouvert »', horairesTest.texteStatut(le('2026-09-03', '18:00')).etat, 'ouvert');
verifier('le statut ouvert annonce l\'heure de fermeture',
  horairesTest.texteStatut(le('2026-09-03', '18:00')).texte.indexOf('2 h') !== -1);
verifier('le statut fermé annonce la prochaine ouverture',
  horairesTest.texteStatut(le('2026-09-07', '20:00')).texte.indexOf('demain à 17 h') !== -1,
  horairesTest.texteStatut(le('2026-09-07', '20:00')).texte);

egal('happy hour jeudi 18 h', horairesTest.happyHourEnCours(le('2026-09-03', '18:00')), true);
egal('pas d\'happy hour à 19 h 01', horairesTest.happyHourEnCours(le('2026-09-03', '19:01')), false);
egal('pas d\'happy hour un jour non listé', horairesTest.happyHourEnCours(le('2026-09-02', '18:00')), false);
egal('pas d\'happy hour pendant une fermeture', horairesTest.happyHourEnCours(le('2026-12-24', '18:00')), false);

egal('formatHeure heure pile', Horaires.formatHeure(17 * 60), '17 h');
egal('formatHeure avec minutes', Horaires.formatHeure(17 * 60 + 30), '17 h 30');
egal('formatHeure après minuit', Horaires.formatHeure(26 * 60), '2 h');
egal('une fermeture à 0 h se dit « minuit »', Horaires.formatFermeture(0), 'minuit');
egal('une fermeture à 2 h reste « 2 h »', Horaires.formatFermeture(2 * 60), '2 h');
egal('enMinutes refuse une heure impossible', Horaires.enMinutes('25:00'), null);
egal('dateLocale refuse un 31 février', Horaires.dateLocale('2026-02-31'), null);

var semaine = horairesTest.semaine();
egal('la semaine commence le lundi', semaine[0].jour, 'lundi');
egal('la semaine finit le dimanche', semaine[6].jour, 'dimanche');
egal('le lundi est marqué fermé', semaine[0].texte, 'Fermé');
egal('le jeudi affiche sa plage', semaine[3].texte, '17 h – 2 h');
egal('le mardi ferme « à minuit »', semaine[1].texte, '17 h – minuit');

// Les horaires réels du bar : ouvert 7 jours sur 7.
var horairesReels = Horaires.creer(C);
egal('le Café Brun est ouvert le lundi soir',
  horairesReels.etatOuverture(le('2026-09-07', '20:00')).ouvert, true);
egal('le Café Brun est ouvert le dimanche soir',
  horairesReels.etatOuverture(le('2026-09-06', '20:00')).ouvert, true);
egal('le Café Brun est fermé un mardi à 6 h du matin',
  horairesReels.etatOuverture(le('2026-09-08', '06:00')).ouvert, false);

/* ---------------------------------------------------------------
 * 3. La validation refuse ce qu'elle doit refuser
 * ------------------------------------------------------------- */

function copie() { return JSON.parse(JSON.stringify(C)); }

function refuse(intitule, transformation) {
  var candidat = copie();
  transformation(candidat);
  var erreurs = validation.verifierContenu(candidat);
  verifier('refusé : ' + intitule, erreurs.length > 0, 'aucune erreur signalée');
}

refuse('un nom de bar vide', function (c) { c.bar.nom = ''; });
refuse('un code postal fantaisiste', function (c) { c.bar.adresse.codePostal = '76'; });
refuse('un e-mail mal formé', function (c) { c.bar.contact.email = 'pas-un-email'; });
refuse('une heure d\'ouverture invalide', function (c) { c.horaires.lundi = [{ ouverture: '99:00', fermeture: '02:00' }]; });
refuse('une ouverture égale à la fermeture', function (c) { c.horaires.lundi = [{ ouverture: '16:00', fermeture: '16:00' }]; });
refuse('un jour qui n\'est pas une liste', function (c) { c.horaires.mardi = '16:00-02:00'; });
refuse('un prix écrit en toutes lettres', function (c) { c.carte[0].articles[0].prix = { '50 cl': '6 euros' }; });
refuse('un prix négatif', function (c) { c.carte[0].articles[0].prix = { '50 cl': -3 }; });
refuse('un prix à trois décimales', function (c) { c.carte[0].articles[0].prix = { '50 cl': 5.999 }; });
refuse('un article sans prix', function (c) { c.carte[0].articles[0].prix = {}; });
refuse('un article sans nom', function (c) { c.carte[0].articles[0].nom = '  '; });
refuse('deux catégories avec le même identifiant', function (c) { c.carte[1].id = c.carte[0].id; });
refuse('un identifiant de catégorie avec des espaces', function (c) { c.carte[0].id = 'bieres pression'; });
refuse('une étiquette inconnue', function (c) { c.carte[0].articles[0].etiquettes = ['bio']; });
refuse('un événement sans titre', function (c) { c.agenda = [{ titre: '', date: '2026-10-01', debut: '20:00' }]; });
refuse('un événement à une date impossible', function (c) { c.agenda = [{ titre: 'Concert', date: '2026-02-31', debut: '20:00' }]; });
refuse('un événement à une heure impossible', function (c) { c.agenda = [{ titre: 'Concert', date: '2026-10-01', debut: '26:00' }]; });
refuse('une fermeture dont la fin précède le début', function (c) { c.fermetures = [{ du: '2026-12-25', au: '2026-12-24' }]; });
refuse('un happy hour qui finit avant de commencer', function (c) { c.happyHour = { actif: true, jours: ['lundi'], debut: '19:00', fin: '17:00', texte: 'x' }; });
refuse('un happy hour sans jour', function (c) { c.happyHour = { actif: true, jours: [], debut: '17:00', fin: '19:00', texte: 'x' }; });
refuse('une adresse de réseau social sans http', function (c) { c.bar.reseaux = [{ nom: 'Instagram', url: 'instagram.com/x' }]; });
refuse('une carte qui n\'est pas une liste', function (c) { c.carte = {}; });
refuse('un e-mail de créateur mal formé', function (c) { c.bar.creditSite = { texte: 'x', email: 'arobase-absente' }; });

// À l'inverse, ces contenus doivent passer.
function accepte(intitule, transformation) {
  var candidat = copie();
  transformation(candidat);
  var erreurs = validation.verifierContenu(candidat);
  verifier('accepté : ' + intitule, erreurs.length === 0, erreurs.join(' | '));
}

accepte('un jour de fermeture hebdomadaire', function (c) { c.horaires.lundi = []; });
accepte('un agenda vide', function (c) { c.agenda = []; });
accepte('un happy hour désactivé', function (c) { c.happyHour = { actif: false }; });
accepte('un e-mail vide', function (c) { c.bar.contact.email = ''; });
accepte('un crédit de site sans e-mail (ligne masquée)', function (c) { c.bar.creditSite = { texte: 'x', email: '' }; });
accepte('deux services dans la même journée', function (c) {
  c.horaires.samedi = [{ ouverture: '11:00', fermeture: '14:00' }, { ouverture: '16:00', fermeture: '02:00' }];
});

/* ---------------------------------------------------------------
 * 4. Comptes et sessions
 * ------------------------------------------------------------- */

var MDP = 'comptoir-cauchoise-2026';

auth.creerCompte('patron', MDP);
verifier('le compte est créé', auth.lireComptes().length === 1);
verifier('le mot de passe n\'est jamais stocké en clair',
  fs.readFileSync(process.env.CAFE_BRUN_COMPTES, 'utf8').indexOf(MDP) === -1);

var compte = auth.lireComptes()[0];
egal('le bon mot de passe est reconnu', auth.motDePasseCorrect(MDP, compte), true);
egal('un mot de passe voisin est rejeté', auth.motDePasseCorrect(MDP + 'x', compte), false);
verifier('deux comptes ont des sels différents',
  auth.hacher(MDP).sel !== auth.hacher(MDP).sel);
verifier('un mot de passe trop court est refusé', auth.refuserMotDePasse('court') !== null);
verifier('un mot de passe courant est refusé', auth.refuserMotDePasse('motdepasse') !== null);
verifier('un bon mot de passe est accepté', auth.refuserMotDePasse(MDP) === null);

var essaiDouble = null;
try {
  auth.creerCompte('patron', MDP);
} catch (e) {
  essaiDouble = e.message;
}
verifier('un identifiant déjà pris est refusé', essaiDouble !== null);

var connexion = auth.connecter('patron', MDP, 'test-ok');
egal('connexion avec le bon mot de passe', connexion.ok, true);
verifier('la session est retrouvée par son jeton', auth.session(connexion.jeton).identifiant === 'patron');
auth.fermerSession(connexion.jeton);
egal('la session fermée n\'est plus valable', auth.session(connexion.jeton), null);
egal('un jeton inventé ne donne rien', auth.session('0'.repeat(64)), null);

var sansIdentifiant = auth.connecter('', MDP, 'test-seul');
egal('connexion avec le mot de passe seul, sans identifiant', sansIdentifiant.ok, true);
egal('le compte retrouvé est le bon', sansIdentifiant.identifiant, 'patron');
auth.fermerSession(sansIdentifiant.jeton);
egal('mot de passe seul incorrect : refusé', auth.connecter('', 'incorrect', 'test-seul-ko').ok, false);

egal('connexion avec un mauvais mot de passe', auth.connecter('patron', 'incorrect', 'test-ko').ok, false);
egal('connexion avec un identifiant inconnu', auth.connecter('inconnu', MDP, 'test-ko2').ok, false);

for (var i = 0; i < auth.TENTATIVES_MAX; i++) auth.connecter('patron', 'incorrect', 'test-brut');
var apresBlocage = auth.connecter('patron', MDP, 'test-brut');
egal('après trop d\'échecs, même le bon mot de passe est bloqué', apresBlocage.ok, false);
verifier('le blocage indique une attente', apresBlocage.attente > 0);

/* ---------------------------------------------------------------
 * 5. Le serveur
 * ------------------------------------------------------------- */

function portLibre() {
  return new Promise(function (resoudre, rejeter) {
    var net = require('net');
    var serveur = net.createServer();
    serveur.listen(0, '127.0.0.1', function () {
      var port = serveur.address().port;
      serveur.close(function () { resoudre(port); });
    });
    serveur.on('error', rejeter);
  });
}

function attendre(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

async function attendreServeur(base) {
  for (var essai = 0; essai < 60; essai++) {
    try {
      var r = await fetch(base + '/');
      if (r.ok) return true;
    } catch (e) { /* pas encore prêt */ }
    await attendre(100);
  }
  return false;
}

async function testerServeur() {
  var port = await portLibre();
  var base = 'http://127.0.0.1:' + port;

  var enfant = require('child_process').spawn(
    process.execPath, [path.join(RACINE, 'serveur/serveur.js')],
    {
      env: Object.assign({}, process.env, { PORT: String(port) }),
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );

  var journalErreurs = '';
  enfant.stderr.on('data', function (m) { journalErreurs += m.toString(); });

  try {
    var demarre = await attendreServeur(base);
    verifier('le serveur démarre', demarre, journalErreurs.slice(0, 300));
    if (!demarre) return;

    var entetes = { 'Content-Type': 'application/json', 'X-Cafe-Brun': '1' };

    /* --- Site public --- */
    var accueil = await fetch(base + '/');
    egal('la page d\'accueil répond', accueil.status, 200);
    var html = await accueil.text();
    verifier('l\'accueil contient le nom du bar', html.indexOf('Café Brun') !== -1);

    egal('data/contenu.js est servi', (await fetch(base + '/data/contenu.js')).status, 200);

    /* --- Fichiers protégés --- */
    egal('comptes.json n\'est pas servi', (await fetch(base + '/comptes.json')).status, 404);
    egal('les sauvegardes ne sont pas servies',
      (await fetch(base + '/data/sauvegardes/')).status, 404);
    egal('la traversée de dossier est bloquée',
      (await fetch(base + '/../../etc/passwd')).status, 404);
    egal('la traversée encodée est bloquée',
      (await fetch(base + '/%2e%2e%2f%2e%2e%2fetc%2fpasswd')).status, 404);

    /* --- /admin sans session --- */
    var adminAnonyme = await fetch(base + '/admin');
    egal('/admin répond', adminAnonyme.status, 200);
    var pageAdmin = await adminAnonyme.text();
    verifier('/admin affiche la page de connexion tant qu\'on n\'est pas connecté',
      pageAdmin.indexOf('formulaire-connexion') !== -1);

    /* --- API sans session --- */
    egal('l\'API refuse la lecture sans session', (await fetch(base + '/api/contenu')).status, 401);
    egal('l\'API refuse l\'écriture sans session', (await fetch(base + '/api/contenu', {
      method: 'PUT', headers: entetes, body: JSON.stringify({ contenu: C }),
    })).status, 401);

    var sessionAnonyme = await (await fetch(base + '/api/session')).json();
    egal('la session est vide au départ', sessionAnonyme.connecte, false);
    egal('le tiroir sait qu\'un compte existe déjà', sessionAnonyme.compteExiste, true);

    /* --- Connexion --- */
    var mauvaise = await fetch(base + '/api/connexion', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ identifiant: 'patron', motDePasse: 'incorrect' }),
    });
    egal('un mauvais mot de passe est refusé', mauvaise.status, 401);

    var sansEntete = await fetch(base + '/api/connexion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant: 'patron', motDePasse: MDP }),
    });
    egal('une requête sans en-tête maison est refusée (anti-CSRF)', sansEntete.status, 403);

    var bonne = await fetch(base + '/api/connexion', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ identifiant: 'patron', motDePasse: MDP }),
    });
    egal('la connexion réussit', bonne.status, 200);

    var parMotDePasseSeul = await fetch(base + '/api/connexion', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ motDePasse: MDP }),
    });
    egal('le tiroir se connecte avec le mot de passe seul', parMotDePasseSeul.status, 200);

    var mauvaisSeul = await fetch(base + '/api/connexion', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ motDePasse: 'pas-le-bon-mot-de-passe' }),
    });
    egal('un mauvais mot de passe seul est refusé', mauvaisSeul.status, 401);

    var cookie = (bonne.headers.get('set-cookie') || '').split(';')[0];
    verifier('un cookie de session est posé', cookie.indexOf('cafe_brun_session=') === 0);
    verifier('le cookie est HttpOnly',
      (bonne.headers.get('set-cookie') || '').indexOf('HttpOnly') !== -1);
    verifier('le cookie est SameSite=Strict',
      (bonne.headers.get('set-cookie') || '').indexOf('SameSite=Strict') !== -1);

    var entetesConnecte = Object.assign({ Cookie: cookie }, entetes);

    /* --- Lecture et écriture --- */
    var lecture = await fetch(base + '/api/contenu', { headers: entetesConnecte });
    egal('la lecture du contenu fonctionne une fois connecté', lecture.status, 200);
    var contenuLu = (await lecture.json()).contenu;
    egal('le contenu lu est celui du bar', contenuLu.bar.nom, 'Le Café Brun');

    var invalide = JSON.parse(JSON.stringify(contenuLu));
    invalide.carte[0].articles[0].prix = { '50 cl': 'six euros' };
    var refus = await fetch(base + '/api/contenu', {
      method: 'PUT', headers: entetesConnecte, body: JSON.stringify({ contenu: invalide }),
    });
    egal('un contenu invalide est refusé', refus.status, 422);
    var corpsRefus = await refus.json();
    verifier('le refus explique ce qui ne va pas', corpsRefus.erreurs.length > 0);

    var avant = fs.readFileSync(path.join(process.env.CAFE_BRUN_DATA, 'contenu.json'), 'utf8');
    verifier('rien n\'a été écrit malgré la tentative invalide',
      avant.indexOf('six euros') === -1);

    var modifie = JSON.parse(JSON.stringify(contenuLu));
    modifie.agenda.push({
      titre: 'Concert test', date: '2027-01-15', debut: '20:30', fin: '23:00',
      prix: 'Entrée libre', description: 'Ajouté par les tests.',
    });
    var ecriture = await fetch(base + '/api/contenu', {
      method: 'PUT', headers: entetesConnecte, body: JSON.stringify({ contenu: modifie }),
    });
    egal('un contenu valide est enregistré', ecriture.status, 200);

    var relu = JSON.parse(fs.readFileSync(path.join(process.env.CAFE_BRUN_DATA, 'contenu.json'), 'utf8'));
    egal('l\'événement est bien dans le fichier', relu.agenda.length, contenuLu.agenda.length + 1);

    var jsRegenere = fs.readFileSync(path.join(process.env.CAFE_BRUN_DATA, 'contenu.js'), 'utf8');
    verifier('contenu.js a été regénéré avec la modification',
      jsRegenere.indexOf('Concert test') !== -1);
    verifier('contenu.js reste un fichier JavaScript valide',
      jsRegenere.indexOf('window.CONTENU = ') !== -1);

    verifier('une sauvegarde de la version précédente a été créée',
      fs.readdirSync(path.join(process.env.CAFE_BRUN_DATA, 'sauvegardes')).length > 0);

    var ecritureSansEntete = await fetch(base + '/api/contenu', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ contenu: modifie }),
    });
    egal('une écriture sans en-tête maison est refusée', ecritureSansEntete.status, 403);

    /* --- /admin avec session --- */
    var adminConnecte = await fetch(base + '/admin', { headers: { Cookie: cookie } });
    var pageConnectee = await adminConnecte.text();
    verifier('/admin affiche l\'éditeur une fois connecté',
      pageConnectee.indexOf('panneau-horaires') !== -1);

    /* --- Déconnexion --- */
    var deconnexion = await fetch(base + '/api/deconnexion', {
      method: 'POST', headers: entetesConnecte,
    });
    egal('la déconnexion répond', deconnexion.status, 200);
    egal('la session ne fonctionne plus après déconnexion',
      (await fetch(base + '/api/contenu', { headers: { Cookie: cookie } })).status, 401);
  } finally {
    enfant.kill();
  }
}

/**
 * Création du premier compte depuis le navigateur, sur un serveur qui
 * démarre sans aucun compte.
 */
async function testerInstallation() {
  var port = await portLibre();
  var base = 'http://127.0.0.1:' + port;
  var comptesVierges = path.join(BAC, 'comptes-installation.json');

  var enfant = require('child_process').spawn(
    process.execPath, [path.join(RACINE, 'serveur/serveur.js')],
    {
      env: Object.assign({}, process.env, {
        PORT: String(port),
        CAFE_BRUN_COMPTES: comptesVierges,
      }),
      stdio: ['ignore', 'ignore', 'ignore'],
    }
  );

  try {
    if (!(await attendreServeur(base))) {
      verifier('le serveur d\'installation démarre', false);
      return;
    }

    var entetes = { 'Content-Type': 'application/json', 'X-Cafe-Brun': '1' };

    var page = await (await fetch(base + '/admin')).text();
    verifier('sans compte, /admin propose de créer le premier',
      page.indexOf('formulaire-installation') !== -1);

    var trop_court = await fetch(base + '/api/installation', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ identifiant: 'patron', motDePasse: 'court' }),
    });
    egal('un premier mot de passe trop court est refusé', trop_court.status, 400);
    verifier('aucun compte n\'a été créé pour autant', !fs.existsSync(comptesVierges));

    var sansEntete = await fetch(base + '/api/installation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant: 'patron', motDePasse: MDP }),
    });
    egal('la création sans en-tête maison est refusée', sansEntete.status, 403);

    var sessionVierge = await (await fetch(base + '/api/session')).json();
    egal('le tiroir sait qu\'aucun compte n\'existe encore', sessionVierge.compteExiste, false);

    // Le tiroir n'envoie qu'un mot de passe : l'identifiant est implicite.
    var creation = await fetch(base + '/api/installation', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ motDePasse: MDP }),
    });
    egal('le premier compte est créé avec le mot de passe seul', creation.status, 201);
    egal('il porte l\'identifiant par défaut',
      (await creation.clone().json()).identifiant, auth.IDENTIFIANT_PAR_DEFAUT);
    verifier('la création connecte directement',
      (creation.headers.get('set-cookie') || '').indexOf('cafe_brun_session=') === 0);

    var cookieInstall = (creation.headers.get('set-cookie') || '').split(';')[0];
    egal('la session ouverte donne accès au contenu',
      (await fetch(base + '/api/contenu', { headers: { Cookie: cookieInstall } })).status, 200);

    var secondEssai = await fetch(base + '/api/installation', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ identifiant: 'intrus', motDePasse: 'un-autre-mot-de-passe' }),
    });
    egal('la porte se referme dès qu\'un compte existe', secondEssai.status, 403);

    var pageApres = await (await fetch(base + '/admin')).text();
    verifier('/admin redemande ensuite un identifiant',
      pageApres.indexOf('formulaire-connexion') !== -1);

    verifier('le mot de passe du premier compte n\'est pas stocké en clair',
      fs.readFileSync(comptesVierges, 'utf8').indexOf(MDP) === -1);
  } finally {
    enfant.kill();
  }
}

/* ---------------------------------------------------------------
 * Exécution
 * ------------------------------------------------------------- */

testerServeur()
  .then(testerInstallation)
  .catch(function (e) {
    echecs.push('les tests du serveur ont échoué : ' + e.message);
  })
  .finally(function () {
    fs.rmSync(BAC, { recursive: true, force: true });

    if (echecs.length) {
      console.error('\n✗ ' + echecs.length + ' vérification(s) en échec sur ' + (reussis + echecs.length) + ' :\n');
      echecs.forEach(function (e) { console.error('  · ' + e); });
      process.exit(1);
    }

    console.log('✓ ' + reussis + ' vérifications passées (contenu, horaires, validation, comptes, serveur).');
  });
