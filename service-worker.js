const CACHE_NAME = 'remicalc-cache-v2';
const OFFLINE_URL = 'offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/acknowledgement.html',
  '/disclaimer.html',
  '/style.css',
  '/remicalc.png',
  '/favicon.ico', // if you have one
  OFFLINE_URL,
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr' // JS bundle
];

// Install - pre-cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - serve from cache first, fall back to network, then offline page
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // Optionally, cache new requests
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});
