/* Service worker — met la page en cache pour qu'elle reste consultable
   même quand le réseau du bar fait des siennes.

   Après une modification du contenu, incrémenter VERSION ci-dessous
   pour que les visiteurs reçoivent la nouvelle version. */

var VERSION = 'cafe-brun-v2';

var FICHIERS = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/horaires.js',
  './assets/js/app.js',
  './data/contenu.js',
  './assets/img/favicon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', function (evt) {
  evt.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(FICHIERS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (evt) {
  evt.waitUntil(
    caches.keys().then(function (cles) {
      return Promise.all(
        cles.filter(function (c) { return c !== VERSION; })
            .map(function (c) { return caches.delete(c); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Réseau d'abord (pour voir tout de suite la carte mise à jour),
// cache en secours quand la connexion manque.
self.addEventListener('fetch', function (evt) {
  if (evt.request.method !== 'GET') return;

  var url = new URL(evt.request.url);
  if (url.origin !== self.location.origin) return;

  evt.respondWith(
    fetch(evt.request)
      .then(function (reponse) {
        var copie = reponse.clone();
        caches.open(VERSION).then(function (cache) { cache.put(evt.request, copie); });
        return reponse;
      })
      .catch(function () {
        return caches.match(evt.request).then(function (cache) {
          return cache || caches.match('./index.html');
        });
      })
  );
});
