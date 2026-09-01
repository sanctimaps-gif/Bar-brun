/*
 * Vérification du contenu et de la logique d'horaires.
 * Aucune dépendance : node tests/verifie.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var racine = path.join(__dirname, '..');
var Horaires = require(path.join(racine, 'assets/js/horaires.js'));

/* ---------- Chargement de data/contenu.js dans un bac à sable ---------- */

function chargerContenu() {
  var code = fs.readFileSync(path.join(racine, 'data/contenu.js'), 'utf8');
  var bac = { window: {}, console: console };
  bac.globalThis = bac;
  vm.createContext(bac);
  vm.runInContext(code, bac, { filename: 'data/contenu.js' });
  if (!bac.window.CONTENU) throw new Error('data/contenu.js n\'expose pas window.CONTENU');
  return bac.window.CONTENU;
}

/* ---------- Micro-harnais de test ---------- */

var reussis = 0;
var echecs = [];

function verifier(intitule, condition, details) {
  if (condition) {
    reussis++;
  } else {
    echecs.push(intitule + (details ? ' — ' + details : ''));
  }
}

function egal(intitule, obtenu, attendu) {
  verifier(intitule, obtenu === attendu, 'obtenu « ' + obtenu +' », attendu « ' + attendu + ' »');
}

/* ---------- 1. Cohérence du contenu ---------- */

var C = chargerContenu();

verifier('le nom du bar est renseigné', typeof C.bar.nom === 'string' && C.bar.nom.length > 0);
verifier('l\'adresse est complète',
  !!(C.bar.adresse.rue && C.bar.adresse.codePostal && C.bar.adresse.ville && C.bar.adresse.pays));
verifier('le code postal est un code français à 5 chiffres', /^\d{5}$/.test(C.bar.adresse.codePostal));
verifier('les coordonnées géographiques sont plausibles pour la France métropolitaine',
  C.bar.adresse.latitude > 41 && C.bar.adresse.latitude < 52 &&
  C.bar.adresse.longitude > -6 && C.bar.adresse.longitude < 10);

Horaires.JOURS_AFFICHES.forEach(function (jour) {
  var plages = C.horaires[jour];
  verifier('les horaires du ' + jour + ' sont un tableau', Array.isArray(plages));
  (plages || []).forEach(function (p, i) {
    verifier('horaires ' + jour + ' #' + (i + 1) + ' : heure d\'ouverture valide',
      Horaires.enMinutes(p.ouverture) !== null, String(p.ouverture));
    verifier('horaires ' + jour + ' #' + (i + 1) + ' : heure de fermeture valide',
      Horaires.enMinutes(p.fermeture) !== null, String(p.fermeture));
    verifier('horaires ' + jour + ' #' + (i + 1) + ' : la plage n\'est pas vide',
      Horaires.enMinutes(p.ouverture) !== Horaires.enMinutes(p.fermeture));
  });
});

(C.fermetures || []).forEach(function (f, i) {
  var du = Horaires.dateLocale(f.du || f.date);
  var au = Horaires.dateLocale(f.au || f.date || f.du);
  verifier('fermeture #' + (i + 1) + ' : date de début valide', du !== null, String(f.du));
  verifier('fermeture #' + (i + 1) + ' : date de fin valide', au !== null, String(f.au));
  if (du && au) verifier('fermeture #' + (i + 1) + ' : la fin ne précède pas le début', au >= du);
});

if (C.happyHour) {
  var hhDebut = Horaires.enMinutes(C.happyHour.debut);
  var hhFin = Horaires.enMinutes(C.happyHour.fin);
  verifier('happy hour : heures valides', hhDebut !== null && hhFin !== null);
  verifier('happy hour : la fin suit le début', hhFin > hhDebut);
  (C.happyHour.jours || []).forEach(function (j) {
    verifier('happy hour : « ' + j + ' » est un jour connu', Horaires.JOURS.indexOf(j) !== -1);
  });
}

var idsVus = [];
(C.carte || []).forEach(function (groupe) {
  verifier('catégorie « ' + groupe.titre + ' » : identifiant présent', typeof groupe.id === 'string' && !!groupe.id);
  verifier('catégorie « ' + groupe.id + ' » : identifiant unique', idsVus.indexOf(groupe.id) === -1);
  idsVus.push(groupe.id);
  verifier('catégorie « ' + groupe.id + ' » : au moins un article', (groupe.articles || []).length > 0);

  (groupe.articles || []).forEach(function (article) {
    var ou = groupe.id + ' / ' + article.nom;
    verifier(ou + ' : nom renseigné', typeof article.nom === 'string' && article.nom.length > 0);

    var formats = Object.keys(article.prix || {});
    verifier(ou + ' : au moins un prix', formats.length > 0);
    formats.forEach(function (format) {
      var prix = article.prix[format];
      verifier(ou + ' : le prix « ' + format + ' » est un nombre', typeof prix === 'number' && isFinite(prix),
        'reçu ' + JSON.stringify(prix));
      verifier(ou + ' : le prix « ' + format + ' » est positif', prix > 0);
    });

    (article.etiquettes || []).forEach(function (e) {
      verifier(ou + ' : étiquette « ' + e + ' » connue',
        ['local', 'sans-alcool', 'vegan', 'nouveau'].indexOf(e) !== -1);
    });
  });
});

(C.agenda || []).forEach(function (e) {
  verifier('agenda « ' + e.titre + ' » : date valide', Horaires.dateLocale(e.date) !== null, String(e.date));
  verifier('agenda « ' + e.titre + ' » : heure de début valide', Horaires.enMinutes(e.debut) !== null);
  if (e.fin) {
    verifier('agenda « ' + e.titre + ' » : heure de fin valide', Horaires.enMinutes(e.fin) !== null);
  }
});

/* ---------- 2. Logique « ouvert / fermé » ---------- */

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

function le(iso, heure) {
  return Horaires.dateLocale(iso, heure);
}

// 2026-09-03 est un jeudi, 09-04 un vendredi, 09-07 un lundi.
egal('jeudi 18 h : ouvert', horairesTest.etatOuverture(le('2026-09-03', '18:00')).ouvert, true);
egal('jeudi 16 h 59 : encore fermé', horairesTest.etatOuverture(le('2026-09-03', '16:59')).ouvert, false);
egal('vendredi 1 h du matin : encore la nuit de jeudi',
  horairesTest.etatOuverture(le('2026-09-04', '01:00')).ouvert, true);
egal('vendredi 3 h du matin : fermé', horairesTest.etatOuverture(le('2026-09-04', '03:00')).ouvert, false);
egal('mercredi 23 h 59 : ouvert jusqu\'à minuit',
  horairesTest.etatOuverture(le('2026-09-02', '23:59')).ouvert, true);
egal('jeudi 0 h 30 (nuit de mercredi) : fermé, car mercredi ferme à minuit',
  horairesTest.etatOuverture(le('2026-09-03', '00:30')).ouvert, false);
egal('lundi : fermé toute la journée', horairesTest.etatOuverture(le('2026-09-07', '20:00')).ouvert, false);

verifier('lundi soir : la prochaine ouverture est le mardi 17 h',
  Horaires.isoDuJour(horairesTest.etatOuverture(le('2026-09-07', '20:00')).prochain) === '2026-09-08' &&
  horairesTest.etatOuverture(le('2026-09-07', '20:00')).prochain.getHours() === 17);

verifier('jeudi 18 h : la fermeture annoncée est 2 h le lendemain',
  horairesTest.etatOuverture(le('2026-09-03', '18:00')).jusqua.getHours() === 2);

// Fermetures exceptionnelles : le 24 décembre 2026 est un jeudi.
egal('24 décembre : fermeture exceptionnelle',
  horairesTest.etatOuverture(le('2026-12-24', '20:00')).ouvert, false);
verifier('24 décembre : le motif est affiché',
  horairesTest.texteStatut(le('2026-12-24', '20:00')).texte.indexOf('Fêtes') !== -1,
  horairesTest.texteStatut(le('2026-12-24', '20:00')).texte);
egal('26 décembre : de nouveau ouvert',
  horairesTest.etatOuverture(le('2026-12-26', '20:00')).ouvert, true);

// Textes affichés.
egal('texte du statut quand c\'est ouvert',
  horairesTest.texteStatut(le('2026-09-03', '18:00')).etat, 'ouvert');
verifier('le statut ouvert annonce l\'heure de fermeture',
  horairesTest.texteStatut(le('2026-09-03', '18:00')).texte.indexOf('2 h') !== -1,
  horairesTest.texteStatut(le('2026-09-03', '18:00')).texte);
verifier('le statut fermé annonce la prochaine ouverture',
  horairesTest.texteStatut(le('2026-09-07', '20:00')).texte.indexOf('demain à 17 h') !== -1,
  horairesTest.texteStatut(le('2026-09-07', '20:00')).texte);

// Happy hour.
egal('happy hour le jeudi à 18 h', horairesTest.happyHourEnCours(le('2026-09-03', '18:00')), true);
egal('pas d\'happy hour le jeudi à 19 h 01', horairesTest.happyHourEnCours(le('2026-09-03', '19:01')), false);
egal('pas d\'happy hour le mercredi (jour non listé)',
  horairesTest.happyHourEnCours(le('2026-09-02', '18:00')), false);
egal('pas d\'happy hour pendant une fermeture exceptionnelle',
  horairesTest.happyHourEnCours(le('2026-12-24', '18:00')), false);

// Mise en forme.
egal('formatHeure sur une heure pile', Horaires.formatHeure(17 * 60), '17 h');
egal('formatHeure avec des minutes', Horaires.formatHeure(17 * 60 + 30), '17 h 30');
egal('formatHeure après minuit', Horaires.formatHeure(26 * 60), '2 h');
egal('une fermeture à 0 h se dit « minuit »', Horaires.formatFermeture(0), 'minuit');
egal('une fermeture à 2 h reste « 2 h »', Horaires.formatFermeture(2 * 60), '2 h');
egal('enMinutes refuse une heure impossible', Horaires.enMinutes('25:00'), null);
egal('dateLocale refuse un 31 février', Horaires.dateLocale('2026-02-31'), null);

// Tableau de la semaine.
var semaine = horairesTest.semaine();
egal('la semaine commence le lundi', semaine[0].jour, 'lundi');
egal('la semaine finit le dimanche', semaine[6].jour, 'dimanche');
egal('le lundi est marqué fermé', semaine[0].texte, 'Fermé');
egal('le jeudi affiche sa plage', semaine[3].texte, '17 h – 2 h');
egal('le mardi ferme « à minuit », pas « à 0 h »', semaine[1].texte, '17 h – minuit');

/* ---------- Résultat ---------- */

if (echecs.length) {
  console.error('\n✗ ' + echecs.length + ' vérification(s) en échec sur ' + (reussis + echecs.length) + ' :\n');
  echecs.forEach(function (e) { console.error('  · ' + e); });
  process.exit(1);
}

console.log('✓ ' + reussis + ' vérifications passées (contenu et horaires).');
