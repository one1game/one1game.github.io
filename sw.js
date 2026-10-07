const CACHE = 'one1game-v60';
const CDN_CACHE = 'one1game-cdn-v1';

const SHELL = [
  '/',
  '/index.html',
  '/archive.html',
  '/styles.css',
  '/script.js',
  '/articles-data.js',
  '/gaming-history.js',
  '/components.js',
  '/hero-space.js',
  '/manifest.json',
  '/404.html'
];

const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'www.googletagmanager.com',
  'www.google-analytics.com'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCdn(url) {
  return CDN_HOSTS.some(h => url.hostname.includes(h));
}

async function putCache(target, request, response) {
  try {
    const clone = response.clone();
    const cache = await caches.open(target);
    await cache.put(request, clone);
  } catch (_) {
    /* кэшировать не удалось — не критично */
  }
}

// Install — прогреваем офлайн-оболочку свежими копиями (мимо HTTP-кэша).
self.addEventListener('install', e => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(SHELL.map(async url => {
        try {
          const res = await fetch(url, { cache: 'reload' });
          if (res && res.ok) await cache.put(url, res);
        } catch (_) { /* пропускаем недоступное */ }
      }));
      await self.skipWaiting();
    })()
  );
});

// Activate — сразу берём управление и чистим старые кэши.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — network-first с обходом HTTP-кэша.
// GitHub Pages отдаёт Cache-Control: max-age=600, поэтому обычный fetch()
// получает до 10 минут старую версию. cache: 'no-store' заставляет брать
// свежую копию из сети — правки видны сразу, без Ctrl+F5.
// Кэш используется только как офлайн-запас.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(e.request.url);
  } catch (_) {
    return;
  }
  if (url.protocol === 'chrome-extension:') return;

  const cdn = isCdn(url);
  if (!isSameOrigin(url) && !cdn) return;

  e.respondWith((async () => {
    try {
      const response = await fetch(e.request, { cache: 'no-store' });
      if (response && (response.ok || response.type === 'opaque')) {
        putCache(cdn ? CDN_CACHE : CACHE, e.request, response);
      }
      return response;
    } catch (err) {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      if (e.request.mode === 'navigate') {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
