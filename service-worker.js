const CACHE_NAME = 'remicalc-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'about.html',
  'acknowledgement.html',
  'disclaimer.html',
  'offline.html',
  'script.js',
  'style.css',
  'style_pages.css',
  'images/icon-512.png',
  'images/logo.png',
  'manifest.json'
];

// Install Service Worker and cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker and remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch from cache, fallback to network, then to offline.html
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => caches.match('offline.html'))
      );
    })
  );
});
