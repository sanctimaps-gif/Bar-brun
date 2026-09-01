/* =============================================================
   Comptes et sessions.

   - Le mot de passe n'est jamais stocké : seul son empreinte scrypt,
     accompagnée d'un sel aléatoire, est écrite dans comptes.json.
   - Les sessions vivent en mémoire : redémarrer le serveur déconnecte
     tout le monde, ce qui est le comportement souhaitable ici.
   ============================================================= */

'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

// CAFE_BRUN_COMPTES déplace le fichier des comptes (tests, ou dossier
// protégé hors du dépôt en production).
var FICHIER_COMPTES = process.env.CAFE_BRUN_COMPTES || path.join(__dirname, '..', 'comptes.json');

var DUREE_SESSION_MS = 12 * 60 * 60 * 1000;   // 12 heures
var TENTATIVES_MAX = 5;                        // avant blocage temporaire
var FENETRE_BLOCAGE_MS = 15 * 60 * 1000;       // durée du blocage
var LONGUEUR_MIN_MOT_DE_PASSE = 10;

/* ---------------------------------------------------------------
 * Mots de passe
 * ------------------------------------------------------------- */

function hacher(motDePasse, sel) {
  sel = sel || crypto.randomBytes(16).toString('hex');
  var empreinte = crypto.scryptSync(motDePasse, sel, 64, { N: 16384, r: 8, p: 1 });
  return { sel: sel, empreinte: empreinte.toString('hex') };
}

function motDePasseCorrect(motDePasse, compte) {
  var calcule = Buffer.from(hacher(motDePasse, compte.sel).empreinte, 'hex');
  var attendu = Buffer.from(compte.empreinte, 'hex');
  if (calcule.length !== attendu.length) return false;
  return crypto.timingSafeEqual(calcule, attendu);
}

/**
 * Refuse les mots de passe trop courts ou trop évidents.
 * @returns {string|null} le motif du refus, ou null si le mot de passe convient.
 */
function refuserMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string' || motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return 'Le mot de passe doit faire au moins ' + LONGUEUR_MIN_MOT_DE_PASSE + ' caractères.';
  }
  var courants = ['motdepasse', 'password', 'azertyuiop', '1234567890', 'cafebrun76'];
  if (courants.indexOf(motDePasse.toLowerCase()) !== -1) {
    return 'Ce mot de passe est trop courant, choisissez-en un autre.';
  }
  return null;
}

/* ---------------------------------------------------------------
 * Fichier des comptes
 * ------------------------------------------------------------- */

function lireComptes() {
  if (!fs.existsSync(FICHIER_COMPTES)) return [];
  try {
    var donnees = JSON.parse(fs.readFileSync(FICHIER_COMPTES, 'utf8'));
    return Array.isArray(donnees.comptes) ? donnees.comptes : [];
  } catch (e) {
    throw new Error('comptes.json est illisible : ' + e.message);
  }
}

function ecrireComptes(comptes) {
  var temporaire = FICHIER_COMPTES + '.tmp-' + process.pid;
  fs.writeFileSync(temporaire, JSON.stringify({ comptes: comptes }, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporaire, FICHIER_COMPTES);
}

function trouverCompte(identifiant) {
  var vise = String(identifiant || '').trim().toLowerCase();
  return lireComptes().find(function (c) { return c.identifiant.toLowerCase() === vise; }) || null;
}

function creerCompte(identifiant, motDePasse) {
  identifiant = String(identifiant || '').trim();
  if (!/^[\wàâçéèêëîïôûùüÿñæœ .'-]{2,40}$/i.test(identifiant)) {
    throw new Error('Identifiant invalide (2 à 40 caractères).');
  }
  var refus = refuserMotDePasse(motDePasse);
  if (refus) throw new Error(refus);

  var comptes = lireComptes();
  if (comptes.some(function (c) { return c.identifiant.toLowerCase() === identifiant.toLowerCase(); })) {
    throw new Error('Le compte « ' + identifiant + ' » existe déjà.');
  }

  var hache = hacher(motDePasse);
  comptes.push({
    identifiant: identifiant,
    sel: hache.sel,
    empreinte: hache.empreinte,
    creeLe: new Date().toISOString(),
  });
  ecrireComptes(comptes);
  return identifiant;
}

function changerMotDePasse(identifiant, ancien, nouveau) {
  var comptes = lireComptes();
  var compte = comptes.find(function (c) { return c.identifiant === identifiant; });
  if (!compte) throw new Error('Compte introuvable.');
  if (!motDePasseCorrect(ancien, compte)) throw new Error('L\'ancien mot de passe est incorrect.');

  var refus = refuserMotDePasse(nouveau);
  if (refus) throw new Error(refus);

  var hache = hacher(nouveau);
  compte.sel = hache.sel;
  compte.empreinte = hache.empreinte;
  compte.modifieLe = new Date().toISOString();
  ecrireComptes(comptes);
}

/* ---------------------------------------------------------------
 * Sessions
 * ------------------------------------------------------------- */

var sessions = new Map();

function ouvrirSession(identifiant) {
  var jeton = crypto.randomBytes(32).toString('hex');
  sessions.set(jeton, { identifiant: identifiant, expireLe: Date.now() + DUREE_SESSION_MS });
  return jeton;
}

function session(jeton) {
  if (!jeton) return null;
  var s = sessions.get(jeton);
  if (!s) return null;
  if (s.expireLe < Date.now()) {
    sessions.delete(jeton);
    return null;
  }
  return s;
}

function fermerSession(jeton) {
  if (jeton) sessions.delete(jeton);
}

function nettoyerSessions() {
  var maintenant = Date.now();
  sessions.forEach(function (s, jeton) {
    if (s.expireLe < maintenant) sessions.delete(jeton);
  });
}

/* ---------------------------------------------------------------
 * Limitation des tentatives de connexion
 * ------------------------------------------------------------- */

var tentatives = new Map();

function bloque(cle) {
  var t = tentatives.get(cle);
  if (!t) return 0;
  if (t.jusqua < Date.now()) {
    tentatives.delete(cle);
    return 0;
  }
  return t.echecs >= TENTATIVES_MAX ? Math.ceil((t.jusqua - Date.now()) / 1000) : 0;
}

function noterEchec(cle) {
  var t = tentatives.get(cle) || { echecs: 0, jusqua: 0 };
  t.echecs += 1;
  t.jusqua = Date.now() + FENETRE_BLOCAGE_MS;
  tentatives.set(cle, t);
}

function oublierEchecs(cle) {
  tentatives.delete(cle);
}

/* ---------------------------------------------------------------
 * Connexion
 * ------------------------------------------------------------- */

/**
 * @returns {{ok: true, jeton: string, identifiant: string}
 *           | {ok: false, message: string, attente?: number}}
 */
function connecter(identifiant, motDePasse, cleLimite) {
  var attente = bloque(cleLimite);
  if (attente) {
    return {
      ok: false,
      attente: attente,
      message: 'Trop de tentatives. Réessayez dans ' + Math.ceil(attente / 60) + ' minute(s).',
    };
  }

  var compte = trouverCompte(identifiant);

  // Même coût de calcul avec ou sans compte : l'existence d'un
  // identifiant ne se devine pas au temps de réponse.
  var reference = compte || { sel: 'x'.repeat(32), empreinte: hacher('—', 'x'.repeat(32)).empreinte };
  var correct = motDePasseCorrect(String(motDePasse || ''), reference);

  if (!compte || !correct) {
    noterEchec(cleLimite);
    return { ok: false, message: 'Identifiant ou mot de passe incorrect.' };
  }

  oublierEchecs(cleLimite);
  return { ok: true, jeton: ouvrirSession(compte.identifiant), identifiant: compte.identifiant };
}

module.exports = {
  creerCompte: creerCompte,
  changerMotDePasse: changerMotDePasse,
  connecter: connecter,
  session: session,
  fermerSession: fermerSession,
  nettoyerSessions: nettoyerSessions,
  lireComptes: lireComptes,
  refuserMotDePasse: refuserMotDePasse,
  hacher: hacher,
  motDePasseCorrect: motDePasseCorrect,
  FICHIER_COMPTES: FICHIER_COMPTES,
  DUREE_SESSION_MS: DUREE_SESSION_MS,
  TENTATIVES_MAX: TENTATIVES_MAX,
};
