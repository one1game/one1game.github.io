const CACHE = 'one1game-v15';
const CDN_CACHE = 'one1game-cdn-v1';

const SHELL = [
  '/',
  '/index.html',
  '/archive.html',
  '/styles.css',
  '/script.js',
  '/articles-data.js',
  '/youtube-feed.js',
  '/gaming-history.js',
  '/components.js',
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

// Fetch — stale-while-revalidate: быстро из кэша + свежее в фоне
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(e.request.url);
  const isCDN = CDN_HOSTS.some(h => url.hostname.includes(h));

  // Stale-while-revalidate: отдаём кэш сразу, обновляем в фоне
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(response => {
        if (response.ok) {
          const target = isCDN ? CDN_CACHE : CACHE;
          const clone = response.clone();
          caches.open(target).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetched;
    })
  );
});
