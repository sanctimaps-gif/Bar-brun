#!/usr/bin/env bash
#
# Le Café Brun — démarrage du site.
#
# macOS  : double-cliquez sur ce fichier.
# Linux  : double-cliquez, ou lancez ./demarrer.command dans un terminal.
# Windows: utilisez plutôt demarrer.bat.
#
# Le site s'ouvre tout seul dans le navigateur, avec l'espace « Compte ».
# Laissez cette fenêtre ouverte tant que vous utilisez le site ;
# fermez-la (ou Ctrl+C) pour l'arrêter.

set -u
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
ADRESSE="http://localhost:$PORT/"

echo ""
echo "  ┌──────────────────────────────────┐"
echo "  │        L E   C A F É   B R U N   │"
echo "  └──────────────────────────────────┘"
echo ""

# ------------------------------------------------------------------
# Node.js est-il installé ?
# ------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  ✗ Node.js n'est pas installé sur cet ordinateur."
  echo ""
  echo "    C'est le seul programme nécessaire, et il est gratuit."
  echo "    Téléchargez la version « LTS » sur :  https://nodejs.org/fr"
  echo "    Installez-la, puis relancez ce fichier."
  echo ""
  command -v open >/dev/null 2>&1 && open "https://nodejs.org/fr" 2>/dev/null
  echo "  Appuyez sur Entrée pour fermer."
  read -r _
  exit 1
fi

# ------------------------------------------------------------------
# Le port est-il déjà pris ? (site déjà démarré, par exemple)
# ------------------------------------------------------------------
if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "  ⚠ Le port $PORT est déjà utilisé — le site tourne peut-être déjà."
  echo "    Ouvrez simplement $ADRESSE"
  echo ""
  echo "    Pour utiliser un autre port :  PORT=8080 ./demarrer.command"
  echo ""
  echo "  Appuyez sur Entrée pour fermer."
  read -r _
  exit 1
fi

# ------------------------------------------------------------------
# Ouverture du navigateur, une fois le serveur prêt
# ------------------------------------------------------------------
ouvrir_navigateur() {
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$ADRESSE"                     # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$ADRESSE" >/dev/null 2>&1 # Linux
  fi
}
ouvrir_navigateur &

echo "  Le site démarre…"
echo ""
echo "    Site   →  $ADRESSE"
echo "    Compte →  la languette « COMPTE », sur le bord droit de la page"
echo ""
echo "  Laissez cette fenêtre ouverte. Ctrl+C pour arrêter."
echo ""

PORT="$PORT" exec node serveur/serveur.js
