# Bar Brun — application web

Site-application du **Bar Brun**, 84 Rue Cauchoise, 76000 Rouen.

Une seule page, consultable au téléphone comme au comptoir :

- **Statut en direct** — « ouvert jusqu'à 2 h » / « fermé, ouvre demain à 17 h »,
  calculé à partir des horaires, y compris les fermetures après minuit et les
  fermetures exceptionnelles ;
- **Bandeau happy hour** qui n'apparaît que pendant l'happy hour ;
- **La carte** avec recherche, filtres par catégorie et par étiquette
  (local, sans alcool, végétal, nouveau) ;
- **Agenda** des concerts et soirées : les dates passées disparaissent toutes
  seules, et chaque événement s'ajoute au calendrier du visiteur (fichier `.ics`
  généré sur place) ;
- **Infos & accès** : horaires de la semaine, adresse, itinéraires
  (Google Maps, Plans, OpenStreetMap), téléphone, e-mail, réseaux ;
- **Réservation** : le formulaire prépare un e-mail pré-rempli dans la
  messagerie du visiteur — aucun serveur, aucune donnée collectée ;
- **Installable** (PWA) et **consultable hors ligne** une fois la page visitée.

Pas de dépendance, pas d'étape de construction : du HTML, du CSS et du
JavaScript que l'on peut ouvrir et modifier directement.

## Lancer le site en local

```bash
# depuis la racine du dépôt
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ouvrir `index.html` par double-clic fonctionne aussi ; seul le mode hors
ligne (service worker) demande un vrai serveur.

## Modifier le contenu

**Tout se passe dans `data/contenu.js`.** Ce fichier regroupe, en français et
commenté, l'identité du bar, les horaires, l'happy hour, la carte, l'agenda et
les rendez-vous hebdomadaires. Aucun autre fichier n'est à toucher pour la vie
courante du bar.

Quelques repères :

| Ce que vous voulez changer | Où, dans `data/contenu.js` |
| --- | --- |
| Téléphone, e-mail, réseaux sociaux | `bar.contact`, `bar.reseaux` |
| Horaires d'ouverture | `horaires` (un tableau par jour, `[]` = fermé) |
| Congés, jours fériés | `fermetures` |
| Happy hour | `happyHour` |
| Boissons, prix, planches | `carte` |
| Concerts et soirées | `agenda` |

Règles à respecter : les prix sont des **nombres** (`6.5`, pas `"6,50 €"`), les
heures s'écrivent `'17:00'`, les dates `'2026-09-10'`. Une fermeture après
minuit s'écrit naturellement : `{ ouverture: '17:00', fermeture: '02:00' }`.

Après une mise à jour du contenu en production, incrémenter `VERSION` dans
`sw.js` (par exemple `bar-brun-v2`) pour que les visiteurs qui ont déjà la page
en cache reçoivent la nouvelle version.

> ⚠️ Les horaires, prix, coordonnées et événements livrés ici sont des
> **exemples** destinés à la mise en route. Seule l'adresse est réelle.
> Remplacez-les par les informations du bar avant la mise en ligne.

## Vérifier que tout fonctionne

```bash
npm test    # ou : node tests/verifie.js
```

Le script contrôle la cohérence de `data/contenu.js` (horaires valides, prix
numériques, dates d'agenda bien formées, catégories sans doublon) et rejoue la
logique « ouvert / fermé » sur une série d'horaires de référence. Il ne demande
aucune installation.

## Mise en ligne

Le site est entièrement statique : n'importe quel hébergement de fichiers
convient (GitHub Pages, Netlify, OVH, un simple dossier sur un serveur web).
Pour GitHub Pages, il suffit d'activer Pages sur la branche voulue, à la racine
du dépôt.

## Structure

```
index.html               page unique
assets/css/styles.css    mise en forme (bois sombre, laiton)
assets/js/app.js         horaires, carte, agenda, formulaire
assets/img/              icônes
data/contenu.js          ← le fichier à modifier au quotidien
manifest.webmanifest     installation sur mobile
sw.js                    cache hors ligne
tests/verifie.js         vérification du contenu et des horaires
```

## Vie privée

Aucun script tiers, aucun cookie, aucune mesure d'audience. Le formulaire de
réservation n'envoie rien : il ouvre la messagerie du visiteur avec un message
déjà rédigé.
