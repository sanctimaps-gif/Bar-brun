@echo off
rem ------------------------------------------------------------------
rem  Le Cafe Brun - demarrage du site (Windows).
rem  Double-cliquez sur ce fichier : le site s'ouvre dans le navigateur,
rem  avec l'espace « Compte ». Laissez cette fenetre ouverte tant que
rem  vous utilisez le site ; fermez-la pour l'arreter.
rem ------------------------------------------------------------------

chcp 65001 >nul
cd /d "%~dp0"

if "%PORT%"=="" set PORT=8000

echo.
echo   ┌──────────────────────────────────┐
echo   │        L E   C A F E   B R U N   │
echo   └──────────────────────────────────┘
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   X Node.js n'est pas installe sur cet ordinateur.
  echo.
  echo     C'est le seul programme necessaire, et il est gratuit.
  echo     Telechargez la version "LTS" sur :  https://nodejs.org/fr
  echo     Installez-la, puis relancez ce fichier.
  echo.
  start "" "https://nodejs.org/fr"
  pause
  exit /b 1
)

echo   Le site demarre...
echo.
echo     Site   ^>  http://localhost:%PORT%/
echo     Compte ^>  la languette "COMPTE", sur le bord droit de la page
echo.
echo   Laissez cette fenetre ouverte. Ctrl+C pour arreter.
echo.

start "" "http://localhost:%PORT%/"
node serveur\serveur.js

echo.
echo   Le site est arrete.
pause
