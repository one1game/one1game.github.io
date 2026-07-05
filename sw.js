const CACHE = 'one1game-v1';
const ASSETS = [
  '/',
  '/styles.css',
  '/script.js',
  '/articles-data.js',
  '/archive.html',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
