// Cloudflare Pages Function (middleware).
//
// Два правила сайта:
//   1. Публичная версия только одна — /app/. Всё за её пределами отдаёт
//      301 на https://one1game.org/app/ (и человеку, и роботу).
//   2. Человек получает приложение (HTML + клиентские скрипты), робот —
//      HTML-версию приложения: тот же серверный контент, но без единого
//      исполняемого скрипта. Структурированные данные (application/ld+json)
//      роботу остаются.
//
// Исключения из правила 1 — только то, без чего не живёт приложение:
// статика (картинки /img/..., css, js, json, шрифты, медиа), /api/,
// robots.txt, sitemap.xml, manifest, sw.js и подтверждения поисковиков.

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

// Поисковые и AI-краулеры, а также превью соцсетей.
const BOT_UA =
  /(?:googlebot|google-inspectiontool|storebot-google|yandex(?:[a-z]*bot|images|webmaster)|bingbot|bingpreview|duckduckbot|baiduspider|applebot|slurp|sogou|exabot|petalbot|bytespider|amazonbot|gptbot|oai-searchbot|chatgpt-user|claude(?:bot|-web)?|anthropic-ai|perplexitybot|youbot|ccbot|diffbot|mj12bot|ahrefsbot|semrushbot|dotbot|seznambot|mail\.ru_bot|stackrambler|facebookexternalhit|twitterbot|linkedinbot|telegrambot|whatsapp|slackbot|discordbot)/i;

function isBot(request) {
  return BOT_UA.test(request.headers.get('user-agent') || '');
}

// Убираем все скрипты (и клиентские данные тоже), оставляем только JSON-LD.
function stripScripts(html) {
  return html
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');
}

async function htmlForBot(context) {
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;

  const html = stripScripts(await res.text());
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // Отдаём только роботу и не даём краулерам/кэшу смешать версии.
  headers.set('cache-control', 'private, max-age=0, no-store');
  headers.set('vary', 'User-Agent');
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('last-modified');

  return new Response(html, { status: res.status, headers });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === 'www.one1game.org') {
    return Response.redirect('https://one1game.org' + url.pathname + url.search, 301);
  }

  const path = url.pathname;
  const inApp = path === '/app' || path.startsWith('/app/');

  if (inApp) {
    return isBot(context.request) ? htmlForBot(context) : context.next();
  }

  if (KEEP.has(path)) return context.next();
  if (path.startsWith('/api/')) return context.next();
  if (ASSET_EXT.test(path)) return context.next();

  return Response.redirect(APP_HOME, 301);
}
