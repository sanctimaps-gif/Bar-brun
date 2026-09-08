#!/bin/sh
#
# Point d'entrée de l'image Docker.
#
# Le contenu et les comptes vivent sur un volume (CAFE_BRUN_DATA), pour
# survivre aux redéploiements. Au tout premier démarrage ce volume est vide :
# on y dépose alors le contenu livré avec l'image.

set -e

DOSSIER="${CAFE_BRUN_DATA:-/data}"
mkdir -p "$DOSSIER"

if [ ! -f "$DOSSIER/contenu.json" ]; then
  echo "Premier démarrage : installation du contenu dans $DOSSIER"
  cp /app/data/contenu.json "$DOSSIER/contenu.json"
fi

# data/contenu.js est un fichier généré : on le (re)fabrique à partir du JSON,
# ce qui répare aussi un volume où il manquerait.
node /app/serveur/regenerer.js

exec node /app/serveur/serveur.js
