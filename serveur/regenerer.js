/* Régénère data/contenu.js à partir de data/contenu.json.
   Utilisé par « npm run generer » et au démarrage de l'image Docker. */

'use strict';

require('./stockage.js').regenerer();
console.log('data/contenu.js régénéré.');
