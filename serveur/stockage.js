/* =============================================================
   Lecture et écriture du contenu.

   data/contenu.json  ← la source de vérité (modifiée par l'admin)
   data/contenu.js    ← regénéré à chaque enregistrement, c'est le
                        fichier que lit le site public (il fonctionne
                        donc aussi sans serveur, sur un hébergement
                        statique).
   ============================================================= */

'use strict';

var fs = require('fs');
var path = require('path');

var RACINE = path.join(__dirname, '..');

// CAFE_BRUN_DATA déplace le dossier de données (utilisé par les tests, et
// utile si le contenu vit hors du dépôt sur le serveur de production).
var DOSSIER_DATA = process.env.CAFE_BRUN_DATA || path.join(RACINE, 'data');
var FICHIER_JSON = path.join(DOSSIER_DATA, 'contenu.json');
var FICHIER_JS = path.join(DOSSIER_DATA, 'contenu.js');
var DOSSIER_SAUVEGARDES = path.join(DOSSIER_DATA, 'sauvegardes');
var SAUVEGARDES_CONSERVEES = 20;

function lire() {
  return JSON.parse(fs.readFileSync(FICHIER_JSON, 'utf8'));
}

/** Écrit d'abord un fichier temporaire, puis le renomme : pas de fichier à moitié écrit. */
function ecrireAtomique(chemin, texte) {
  var temporaire = chemin + '.tmp-' + process.pid;
  fs.writeFileSync(temporaire, texte, 'utf8');
  fs.renameSync(temporaire, chemin);
}

function genererJs(contenu) {
  return [
    '/*',
    ' * Fichier GÉNÉRÉ — ne pas modifier à la main.',
    ' *',
    ' * Il est réécrit à chaque enregistrement depuis l\'espace',
    ' * d\'administration (/admin). Pour une modification hors ligne,',
    ' * éditez data/contenu.json puis lancez « npm run generer ».',
    ' */',
    '',
    'window.CONTENU = ' + JSON.stringify(contenu, null, 2) + ';',
    '',
  ].join('\n');
}

/** Conserve une copie horodatée de la version précédente. */
function sauvegarder() {
  if (!fs.existsSync(FICHIER_JSON)) return;

  fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  var horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(FICHIER_JSON, path.join(DOSSIER_SAUVEGARDES, 'contenu-' + horodatage + '.json'));

  // On ne garde que les dernières sauvegardes.
  var fichiers = fs.readdirSync(DOSSIER_SAUVEGARDES)
    .filter(function (f) { return /^contenu-.*\.json$/.test(f); })
    .sort();
  fichiers.slice(0, Math.max(0, fichiers.length - SAUVEGARDES_CONSERVEES)).forEach(function (f) {
    fs.unlinkSync(path.join(DOSSIER_SAUVEGARDES, f));
  });
}

function ecrire(contenu) {
  sauvegarder();
  ecrireAtomique(FICHIER_JSON, JSON.stringify(contenu, null, 2) + '\n');
  ecrireAtomique(FICHIER_JS, genererJs(contenu));
}

/** Régénère data/contenu.js à partir du JSON, sans passer par l'admin. */
function regenerer() {
  var contenu = lire();
  ecrireAtomique(FICHIER_JS, genererJs(contenu));
  return contenu;
}

module.exports = {
  lire: lire,
  ecrire: ecrire,
  regenerer: regenerer,
  genererJs: genererJs,
  FICHIER_JSON: FICHIER_JSON,
  FICHIER_JS: FICHIER_JS,
  DOSSIER_DATA: DOSSIER_DATA,
  DOSSIER_SAUVEGARDES: DOSSIER_SAUVEGARDES,
};
