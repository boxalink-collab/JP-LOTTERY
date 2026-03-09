// =========================================================
//  JP-LOTTERY — sw.js (Service Worker)
//  Stratégie : Cache-first pour assets statiques
//              Network-first pour Firebase et API
//  Résultat  : App installable, fonctionne hors-ligne
//              pour la navigation (écrans déjà visités)
// =========================================================

const CACHE_NAME    = 'jp-lottery-v1';
const CACHE_OFFLINE = 'jp-lottery-offline-v1';

// Assets mis en cache à l'installation
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/logos/logo.png',
  '/assets/logos/icon-192.png',
  '/assets/logos/icon-512.png',
  '/assets/logos/icon-192-mask.png',
  '/assets/logos/icon-512-mask.png',
  // Fonts Google (si déjà passé dans le navigateur)
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Orbitron:wght@700;900&display=swap',
];

// URLs à ne JAMAIS mettre en cache (Firebase, API temps réel)
const NO_CACHE_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebase\.googleapis\.com/,
  /gstatic\.com\/firebasejs/,
  /googleapis\.com/,
];

// =========================================================
//  INSTALLATION — pré-cache des assets statiques
// =========================================================
self.addEventListener('install', function(event) {
  console.log('[SW] Installation — cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // On essaie chaque asset individuellement pour ne pas bloquer sur une erreur
      return Promise.allSettled(
        PRECACHE.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Impossible de mettre en cache:', url, err.message);
          });
        })
      );
    }).then(function() {
      console.log('[SW] Installation terminée');
      // Prendre le contrôle immédiatement sans attendre rechargement
      return self.skipWaiting();
    })
  );
});

// =========================================================
//  ACTIVATION — supprimer les anciens caches
// =========================================================
self.addEventListener('activate', function(event) {
  console.log('[SW] Activation');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME && key !== CACHE_OFFLINE;
        }).map(function(key) {
          console.log('[SW] Suppression ancien cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      // Prendre le contrôle de tous les onglets ouverts
      return self.clients.claim();
    })
  );
});

// =========================================================
//  FETCH — stratégie de cache
// =========================================================
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer Firebase / API temps réel → toujours réseau
  for (var i = 0; i < NO_CACHE_PATTERNS.length; i++) {
    if (NO_CACHE_PATTERNS[i].test(url)) return;
  }

  // Ignorer les requêtes chrome-extension etc.
  if (!url.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {

        // Stratégie : Stale-While-Revalidate
        // → Répondre depuis le cache immédiatement si disponible
        // → Mettre à jour le cache en arrière-plan
        var fetchPromise = fetch(event.request).then(function(networkResp) {
          if (networkResp && networkResp.status === 200 && networkResp.type !== 'opaque') {
            cache.put(event.request, networkResp.clone());
          }
          return networkResp;
        }).catch(function() {
          // Réseau indisponible → fallback page d'accueil si navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Hors ligne', { status: 503 });
        });

        return cached || fetchPromise;
      });
    })
  );
});

// =========================================================
//  MESSAGE — forcer mise à jour depuis l'app
// =========================================================
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
