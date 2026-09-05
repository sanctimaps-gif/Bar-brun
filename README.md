# Le Café Brun — site et espace d'administration

Site du **Café Brun**, 84 Rue Cauchoise, 76000 Rouen — avec un espace
d'administration protégé par mot de passe pour tenir à jour **les horaires,
la carte et les événements** sans toucher au code.

Aucune dépendance à installer : tout tourne avec Node seul (version 18 ou plus).

## Démarrage

```bash
npm start          # démarre le serveur

#   Site   → http://localhost:8000/
#   Admin  → http://localhost:8000/admin
```

**Tout passe par le site lui-même** : une languette discrète « Compte » longe le
bord droit de la page. Au premier clic, elle propose de choisir le mot de passe ;
ensuite, il suffit de le saisir pour arriver dans l'éditeur des horaires, de la
carte et des événements. `/admin` reste accessible directement, avec le même
comportement.

Le port se change avec `PORT=3000 npm start`.

## Le site public

- **Statut en direct** — « Ouvert · jusqu'à 2 h », « Fermé · ouvre aujourd'hui
  à 16 h », calculé à partir des horaires : fermetures après minuit et
  fermetures exceptionnelles comprises.
- **Bandeau happy hour** affiché uniquement pendant l'happy hour.
- **La carte**, avec recherche et filtres (local, sans alcool, végétal, nouveau).
- **Agenda** : les dates passées disparaissent seules, chaque soirée s'ajoute au
  calendrier du visiteur (fichier `.ics` généré dans le navigateur).
- **Infos & accès** : horaires de la semaine, adresse, itinéraires Google Maps /
  Plans / OpenStreetMap, téléphone, réseaux sociaux.
- **Réservation** : tant qu'aucune adresse e-mail n'est renseignée, la section
  invite à appeler le bar. Dès qu'un e-mail est saisi, un formulaire prépare un
  message dans la messagerie du visiteur (rien n'est envoyé automatiquement).
- **Installable** sur mobile et **consultable hors ligne**.

## L'espace d'administration

On y entre par la languette « Compte » du site (bord droit) ou directement par
`/admin`. Un seul mot de passe suffit — l'identifiant n'est demandé que si
plusieurs comptes coexistent. Trois onglets :

| Onglet | Ce qu'on y fait |
| --- | --- |
| **Horaires** | Ouvertures jour par jour (plusieurs créneaux possibles), jours de fermeture, happy hour, fermetures exceptionnelles |
| **La carte** | Catégories et articles : nom, description, formats et prix, étiquettes, ordre d'affichage |
| **Événements** | Concerts et soirées (date, horaires, tarif, description) et rendez-vous hebdomadaires |

Rien n'est enregistré tant que le bouton **Enregistrer** n'est pas utilisé ; le
serveur revérifie tout avant d'écrire et affiche la liste des erreurs si quelque
chose ne va pas. La version précédente est conservée dans `data/sauvegardes/`
(les vingt dernières).

### Comptes

Le premier compte se crée depuis la languette « Compte », sans rien installer.
Il prend l'identifiant `patron` par défaut, invisible à l'usage. Pour en ajouter
d'autres (ou repartir de zéro après un mot de passe perdu — supprimez alors
`comptes.json`) :

```bash
npm run compte            # questions interactives
npm run compte -- patron  # identifiant en argument, mot de passe demandé
```

- Le mot de passe fait **10 caractères minimum** et n'est jamais stocké en
  clair : `comptes.json` ne contient qu'une empreinte **scrypt** avec sel.
- `comptes.json` n'est **pas versionné** (voir `.gitignore`).
- Le mot de passe se change depuis l'admin, bouton « Mot de passe ».
- Les sessions durent 12 heures et vivent en mémoire : redémarrer le serveur
  déconnecte tout le monde.
- Après 5 échecs de connexion, l'adresse est bloquée 15 minutes.
- Cookie `HttpOnly` + `SameSite=Strict`, et un en-tête maison exigé sur toute
  écriture : les requêtes venues d'un autre site sont refusées.

Derrière un vrai domaine, servez le site **en HTTPS** et démarrez avec
`COOKIE_SECURE=1 npm start` pour que le cookie de session ne circule qu'en
chiffré.

## Où vit le contenu

```
data/contenu.json   ← la source de vérité (écrite par l'admin)
data/contenu.js     ← fichier GÉNÉRÉ, lu par le site public
```

`data/contenu.js` est réécrit à chaque enregistrement. Le site public n'a donc
besoin d'aucun serveur pour fonctionner : les fichiers peuvent être déposés tels
quels sur un hébergement statique, l'admin ne servant qu'à les mettre à jour.

Pour modifier le contenu à la main (sans passer par l'admin) : éditez
`data/contenu.json`, puis

```bash
npm run generer     # régénère data/contenu.js
```

Après une mise en ligne, pensez à incrémenter `VERSION` dans `sw.js` pour que
les visiteurs ayant déjà la page en cache reçoivent la nouvelle version.

## Vérifications

```bash
npm test
```

Le script contrôle, sans rien installer ni toucher aux vraies données :

- la validité de `data/contenu.json` et la synchronisation de `data/contenu.js` ;
- la logique « ouvert / fermé » (nuits après minuit, jours fermés, congés,
  happy hour) ;
- le refus des contenus incorrects (prix en toutes lettres, heures impossibles,
  identifiants de catégorie en double, dates invalides…) ;
- les comptes et les sessions (empreintes, mauvais mot de passe, blocage après
  plusieurs échecs) ;
- le serveur de bout en bout : accès refusé sans session, refus des requêtes
  sans en-tête maison, fichiers sensibles non servis, traversée de dossier
  bloquée, enregistrement valide et refus d'un contenu invalide ;
- la création du premier compte : mot de passe trop court refusé, porte
  définitivement close dès qu'un compte existe ;
- la connexion par mot de passe seul, telle que l'utilise la languette
  « Compte ».

## Structure

```
index.html               le site public
assets/css/styles.css    mise en forme (bois sombre, laiton)
assets/js/horaires.js    calcul des horaires, partagé site / serveur / tests
assets/js/app.js         rendu du site public
assets/js/compte.js      tiroir « Compte » du bord droit
admin/                   espace d'administration (premier compte, connexion, éditeur)
serveur/serveur.js       serveur HTTP : site, admin et API
serveur/auth.js          comptes, mots de passe, sessions
serveur/validation.js    contrôle du contenu avant écriture
serveur/stockage.js      lecture/écriture et sauvegardes
data/contenu.json        le contenu du bar
tests/verifie.js         toutes les vérifications
```

## Provenance des informations

Le nom, l'adresse, le téléphone, les horaires (7 j/7 de 16 h à 2 h), l'happy
hour (17 h – 21 h), la terrasse et les comptes Instagram / Facebook viennent des
fiches publiques du bar (annuaires, réseaux sociaux). **Ces informations sont à
vérifier et à corriger depuis l'admin** — les annuaires se contredisent parfois,
notamment sur l'heure d'ouverture.

La carte est un **squelette indicatif** : les catégories reflètent ce que
proposent les fiches publiques (bières, vins, cocktails maison, planches), mais
les articles et les prix sont à saisir depuis l'admin. Aucune adresse e-mail
publique n'ayant été trouvée, le site renvoie vers le téléphone ; renseignez
`bar.contact.email` pour activer le formulaire de réservation.

Le pied de page porte une ligne de contact vers le créateur du site
(`bar.creditSite` dans `data/contenu.json`) : laissez son e-mail vide pour faire
disparaître la ligne.

## Vie privée

Aucun script tiers, aucun cookie sur le site public, aucune mesure d'audience.
Le seul cookie du projet est celui de la session d'administration.

---

L'abus d'alcool est dangereux pour la santé. À consommer avec modération.
