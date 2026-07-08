const CACHE = 'one1game-v11';
const CDN_CACHE = 'one1game-cdn-v1';

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

const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'www.googletagmanager.com',
  'www.google-analytics.com'
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
      Promise.all(keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static+CDN, network-first for HTML
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(e.request.url);
  const isCDN = CDN_HOSTS.some(h => url.hostname.includes(h));
  const isStatic = ['style', 'script', 'font', 'image'].includes(e.request.destination);

  // Cache-first for CDN and static assets
  if (isCDN || isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const target = isCDN ? CDN_CACHE : CACHE;
            const clone = response.clone();
            caches.open(target).then(c => c.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML and everything else
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/404.html');
        }
        return new Response('Offline', { status: 503 });
      }))
  );
});
