const CACHE = 'one1game-v10';
const SHELL = [
  '/',
  '/index.html',
  '/archive.html',
  '/styles.css',
  '/script.js',
  '/articles-data.js',
  '/manifest.json',
  '/404.html'
];

// Install — precache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', e => {
  // Skip non-GET and chrome-extension
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension://')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => {
        // Return cached version or offline page for navigations
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/404.html');
        }
        return new Response('Offline', { status: 503 });
      }))
  );
});
