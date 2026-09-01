/* =============================================================
   Création d'un compte d'administration.

     npm run compte                       → questions interactives
     npm run compte -- patron             → demande le mot de passe
     CAFE_BRUN_MDP=… npm run compte -- patron   (pour un script)

   Le mot de passe n'est pas affiché pendant la saisie et n'est jamais
   stocké en clair : comptes.json ne contient qu'une empreinte scrypt.
   ============================================================= */

'use strict';

var readline = require('readline');
var auth = require('./auth.js');

function demander(question, masque) {
  return new Promise(function (resoudre) {
    var rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    if (masque) {
      // Neutralise l'écho du terminal pendant la saisie du mot de passe.
      var ecrire = rl._writeToOutput;
      rl._writeToOutput = function (texte) {
        if (texte.indexOf(question) === 0) ecrire.call(rl, texte);
      };
    }

    rl.question(question, function (reponse) {
      rl.close();
      if (masque) process.stdout.write('\n');
      resoudre(reponse.trim());
    });
  });
}

async function principal() {
  var identifiant = process.argv[2];
  var motDePasse = process.env.CAFE_BRUN_MDP;

  console.log('\nCréation d\'un compte pour l\'espace d\'administration du Café Brun.\n');

  var existants = auth.lireComptes();
  if (existants.length) {
    console.log('Comptes existants : ' + existants.map(function (c) { return c.identifiant; }).join(', ') + '\n');
  }

  if (!identifiant) identifiant = await demander('Identifiant : ');

  if (!motDePasse) {
    motDePasse = await demander('Mot de passe (10 caractères minimum) : ', true);
    var confirmation = await demander('Confirmation : ', true);
    if (motDePasse !== confirmation) {
      console.error('\n✗ Les deux mots de passe ne correspondent pas.');
      process.exit(1);
    }
  }

  try {
    auth.creerCompte(identifiant, motDePasse);
  } catch (e) {
    console.error('\n✗ ' + e.message);
    process.exit(1);
  }

  console.log('\n✓ Compte « ' + identifiant + ' » créé.');
  console.log('  Empreinte enregistrée dans comptes.json (ce fichier n\'est pas versionné).');
  console.log('  Connexion : démarrez le serveur avec « npm start », puis ouvrez /admin\n');
}

principal();
