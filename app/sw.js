// Офлайн-оболочка приложения. Кэшируем только свой префикс /app/,
// чтобы не мешать основному сайту и его страницам.
const CACHE = 'one1game-app-v6';
const SHELL = ['/app/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Скачивание обоев: отдаём картинку с Content-Disposition, чтобы браузер
  // сохранил файл, а не открыл её в новой вкладке. Работает и без JS.
  if (url.origin === self.location.origin && url.pathname === '/app/download') {
    const target = url.searchParams.get('url') || '';
    if (!/^https:\/\/[a-z.]*wallhaven\.cc\//i.test(target)) {
      event.respondWith(new Response('bad target', { status: 400 }));
      return;
    }
    event.respondWith((async () => {
      try {
        const res = await fetch(target, { credentials: 'omit' });
        if (!res.ok) return new Response('', { status: res.status });
        const name = (target.split('/').pop() || 'wallpaper.jpg').replace(/[^\w.-]+/g, '');
        return new Response(res.body, {
          status: 200,
          headers: {
            'content-type': res.headers.get('content-type') || 'application/octet-stream',
            'content-disposition': `attachment; filename="one1game-${name}"`,
            'access-control-allow-origin': '*',
          },
        });
      } catch {
        return new Response('', { status: 502 });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;

  // Навигация: сеть, при обрыве — кэш, в крайнем случае — демо.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match('/app/'))
        )
    );
    return;
  }

  // Ассеты: сначала сеть, чтобы правки стилей и скриптов приезжали сразу,
  // кэш — только запасной вариант офлайн.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error()))
  );
});
