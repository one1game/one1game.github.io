// Cloudflare Pages Function: прокси к Wallhaven API.
// Нужен, потому что API не отдаёт Access-Control-Allow-Origin для браузера.
// Работает без ключа (SFW). Если в переменных окружения есть WALLHAVEN_API_KEY,
// он добавляется на сервере и не попадает в клиентский код.

const ALLOWED = new Set([
  'q', 'categories', 'purity', 'sorting', 'order', 'topRange',
  'atleast', 'resolutions', 'ratios', 'colors', 'page', 'seed'
]);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type'
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=1800',
      ...CORS,
      ...extra
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const params = new URLSearchParams();

  for (const [key, value] of url.searchParams) {
    if (ALLOWED.has(key)) params.set(key, value);
  }

  // Раздел только с безопасным контентом: general + anime, без people.
  params.set('purity', '100');
  params.set('categories', '110');
  if (!params.has('sorting')) params.set('sorting', 'toplist');
  if (params.get('sorting') === 'toplist' && !params.has('topRange')) params.set('topRange', '1M');

  const key = context.env && context.env.WALLHAVEN_API_KEY;
  if (key) params.set('apikey', key);

  const target = 'https://wallhaven.cc/api/v1/search?' + params.toString();

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'One1Game-Wallpapers/1.0' },
      cf: { cacheTtl: 900, cacheEverything: true }
    });

    const body = await res.text();

    if (!res.ok) {
      return json({ error: 'wallhaven', status: res.status }, res.status);
    }

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=1800',
        ...CORS
      }
    });
  } catch (error) {
    return json({ error: 'wallhaven_unreachable' }, 502);
  }
}
