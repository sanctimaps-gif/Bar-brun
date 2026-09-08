# Ouvrir le site et l'espace « Compte »

Le site a deux visages :

- **la vitrine** — horaires, carte, agenda, contact. Elle s'affiche partout, même
  en ouvrant simplement `index.html` d'un double-clic ;
- **l'espace « Compte »** — celui qui permet de *modifier* les horaires, la carte
  et les événements. Celui-là a besoin que le site soit **démarré**, parce qu'il
  faut bien que quelqu'un enregistre les modifications sur le disque. Une page
  ouverte toute seule n'a personne pour le faire.

D'où le message « L'espace de modification a besoin du serveur du site ».

---

## La méthode la plus simple : deux double-clics

### 1. Installer Node.js (une seule fois)

C'est le programme qui fait tourner le site. Gratuit, officiel, sans compte à créer.

→ **https://nodejs.org/fr** — prenez la version marquée **LTS**, installez-la en
laissant toutes les options par défaut.

### 2. Récupérer le dossier du site

Sur la page du dépôt GitHub : bouton vert **Code** → **Download ZIP**.
Décompressez le fichier ; vous obtenez un dossier `Bar-brun`.

### 3. Démarrer

Dans ce dossier, double-cliquez sur :

| Votre ordinateur | Le fichier |
| --- | --- |
| Mac | `demarrer.command` |
| Windows | `demarrer.bat` |
| Linux | `demarrer.command` |

Une fenêtre noire s'ouvre — **c'est normal, laissez-la ouverte** — et le site
apparaît dans votre navigateur.

> **Sur Mac, au premier lancement**, macOS peut refuser d'ouvrir le fichier
> (« développeur non identifié »). Faites alors un **clic droit** sur
> `demarrer.command` → **Ouvrir** → **Ouvrir**. C'est à faire une seule fois.

### 4. Ouvrir l'espace « Compte »

Sur le bord droit de la page, à mi-hauteur : la languette dorée **COMPTE**
avec un petit cadenas. Cliquez dessus.

- **La première fois**, elle vous demande de choisir un mot de passe
  (10 caractères minimum). C'est vous qui le choisissez, personne d'autre ne le
  connaîtra.
- **Ensuite**, il suffit de saisir ce mot de passe.

Vous arrivez alors sur l'éditeur, avec ses trois onglets : **Horaires**,
**La carte**, **Événements**. Modifiez, cliquez sur **Enregistrer** : le site
public est à jour immédiatement.

### Pour arrêter

Fermez la fenêtre noire. Le site s'éteint ; vos modifications, elles, restent
enregistrées dans le dossier.

---

## Mettre le site en ligne pour de bon

Tant que le site tourne sur votre ordinateur, il n'est visible que par vous
(`localhost`). Pour une adresse publique, deux voies :

### La vitrine seule, gratuitement (GitHub Pages)

Dans les réglages du dépôt : **Settings → Pages**, source **Deploy from a
branch**, branche `claude/bar-brun-app-o20g4n`, dossier `/ (root)`.
Quelques minutes plus tard, le site est en ligne à l'adresse indiquée.

Les visiteurs y verront tout : horaires, carte, agenda, contact. En revanche
l'espace « Compte » y affichera le message de démarrage, puisque GitHub Pages ne
fait que servir des fichiers. Pour modifier le contenu, vous démarrez le site
chez vous, vous enregistrez, et vous renvoyez les fichiers `data/contenu.json`
et `data/contenu.js` sur GitHub.

### Le site complet, espace « Compte » inclus

Il faut un hébergeur capable d'exécuter Node : Render, Railway, Fly.io, ou un
petit serveur privé. Le dépôt contient déjà tout ce qu'il faut (`Dockerfile`,
`render.yaml`) : sur Render, « New Web Service » → connecter le dépôt → il lit
la configuration tout seul.

> **Attention au stockage.** Sur les formules gratuites, le disque est effacé à
> chaque redémarrage : les modifications faites depuis l'espace « Compte »
> seraient perdues. Pour un site en ligne qu'on modifie vraiment, il faut un
> disque persistant (quelques euros par mois) monté sur `/data`, et démarrer
> avec `CAFE_BRUN_DATA=/data` et `CAFE_BRUN_COMPTES=/data/comptes.json`.
> C'est prévu dans `render.yaml`.

Et dans tous les cas, en ligne : servez le site **en HTTPS** et ajoutez la
variable `COOKIE_SECURE=1`, pour que le mot de passe ne circule jamais en clair.

---

## Si quelque chose coince

| Ce que vous voyez | Ce qu'il faut faire |
| --- | --- |
| « Node.js n'est pas installé » | Installez Node.js (étape 1), puis relancez |
| « Le port 8000 est déjà utilisé » | Le site tourne déjà : ouvrez http://localhost:8000 |
| La fenêtre noire se ferme aussitôt | Ouvrez un terminal dans le dossier et tapez `node serveur/serveur.js` : le message d'erreur restera affiché |
| La languette « COMPTE » reste introuvable | Bord **droit** de la page, à mi-hauteur ; sur téléphone, en bas à droite. Sinon, allez directement à http://localhost:8000/admin |
| Mot de passe oublié | Supprimez le fichier `comptes.json` dans le dossier du site : la languette vous proposera d'en choisir un nouveau |
