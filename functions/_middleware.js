// Cloudflare Pages Function (middleware).
//
// Правило сайта: единственная публичная версия — /app/. Всё, что лежит
// за пределами /app/, не должно открываться ни человеку, ни роботу:
// любой такой адрес получает 301 на https://one1game.org/app/.
//
// Исключения — только то, без чего приложение и поиск не работают:
//   * статика (картинки /img/..., скрипты, json, шрифты, медиа);
//   * /api/ (прокси Wallhaven);
//   * robots.txt, sitemap.xml, manifest, sw.js;
//   * файлы подтверждения Google/Яндекс.
//
// Плюс отдельное правило: www.one1game.org → one1game.org.

const APP_HOME = 'https://one1game.org/app/';

const ASSET_EXT =
  /\.(?:avif|bmp|csv|css|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|ogg|otf|pdf|png|svg|ttf|txt|wav|webm|webmanifest|webp|woff2?|xml)$/i;

const KEEP = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/site.webmanifest',
  '/sw.js',
  '/googlee56722acc2e581a3.html',
  '/yandex_9af622e1d1878e9b.html',
  '/yandex_c55eb898fbfaf74b.html',
]);

export function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === 'www.one1game.org') {
    return Response.redirect('https://one1game.org' + url.pathname + url.search, 301);
  }

  const path = url.pathname;

  if (path === '/app' || path.startsWith('/app/')) return context.next();
  if (KEEP.has(path)) return context.next();
  if (path.startsWith('/api/')) return context.next();
  if (ASSET_EXT.test(path)) return context.next();

  return Response.redirect(APP_HOME, 301);
}
