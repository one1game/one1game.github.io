const DEFAULT_ORIGIN = 'https://one1game.github.io';
const CHANNEL_ID = 'UChR3kvItnDlJ8vn2_sBmTiQ';
const MAX_RESULTS = 6;
const UPSTREAM_TIMEOUT_MS = 8000;

function allowedOrigin(env) {
  return env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
}

function corsHeaders(origin, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && origin === allowedOrigin(env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };
}

function json(body, status, request, env, extra = {}) {
  const origin = request.headers.get('Origin');
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...securityHeaders(),
      ...corsHeaders(origin, env),
      ...extra,
    },
  });
}

function originAllowed(request, env) {
  return request.headers.get('Origin') === allowedOrigin(env);
}

function validEmail(value) {
  return typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rateLimited(request, env, scope) {
  // Configure a Cloudflare RATE_LIMITER binding when available. The Worker
  // remains functional without it, but production should enable a limit.
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== 'function') return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const result = await env.RATE_LIMITER.limit({ key: `${scope}:${ip}` });
    return result && result.success === false;
  } catch (error) {
    console.error('rate limiter unavailable');
    return false;
  }
}

async function handleNewsletter(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, request, env);
  }
  if (!env.BUTTONDOWN_API_KEY) {
    console.error('BUTTONDOWN_API_KEY is not configured');
    return json({ ok: false, error: 'service_unavailable' }, 503, request, env);
  }
  if (await rateLimited(request, env, 'newsletter')) {
    return json({ ok: false, error: 'rate_limited' }, 429, request, env, {
      'Retry-After': '60',
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400, request, env);
  }

  // A hidden honeypot gives simple bots no useful response.
  if (typeof payload.website === 'string' && payload.website.trim()) {
    return json({ ok: true }, 201, request, env);
  }

  const email = typeof payload.email === 'string'
    ? payload.email.trim().toLowerCase()
    : '';
  if (!validEmail(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400, request, env);
  }

  const ipAddress = request.headers.get('CF-Connecting-IP');
  const subscriber = {
    email_address: email,
    tags: ['one1game-site'],
  };
  if (ipAddress) subscriber.ip_address = ipAddress;

  let upstream;
  try {
    upstream = await fetchWithTimeout('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriber),
    });
  } catch (error) {
    console.error('Buttondown request failed');
    return json({ ok: false, error: 'upstream_unavailable' }, 502, request, env);
  }

  if (upstream.ok) {
    return json({ ok: true }, 201, request, env);
  }
  if (upstream.status === 400 || upstream.status === 409) {
    return json({ ok: false, error: 'already_subscribed_or_invalid' }, 409, request, env);
  }
  console.error(`Buttondown returned ${upstream.status}`);
  return json({ ok: false, error: 'upstream_unavailable' }, 502, request, env);
}

async function handleYoutube(request, env) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, request, env);
  }
  if (!env.YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY is not configured');
    return json({ ok: false, error: 'service_unavailable' }, 503, request, env);
  }
  if (await rateLimited(request, env, 'youtube')) {
    return json({ ok: false, error: 'rate_limited' }, 429, request, env, {
      'Retry-After': '60',
    });
  }

  const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  apiUrl.search = new URLSearchParams({
    part: 'snippet',
    channelId: CHANNEL_ID,
    order: 'date',
    maxResults: String(MAX_RESULTS),
    type: 'video',
    key: env.YOUTUBE_API_KEY,
    fields: 'items(id/videoId,snippet(title,publishedAt,thumbnails/medium/url))',
  });

  let upstream;
  try {
    upstream = await fetchWithTimeout(apiUrl);
  } catch (error) {
    console.error('YouTube request failed');
    return json({ ok: false, error: 'upstream_unavailable' }, 502, request, env);
  }

  if (!upstream.ok) {
    console.error(`YouTube returned ${upstream.status}`);
    return json({ ok: false, error: 'upstream_unavailable' }, 502, request, env);
  }

  let source;
  try {
    source = await upstream.json();
  } catch {
    return json({ ok: false, error: 'invalid_upstream_response' }, 502, request, env);
  }

  const items = Array.isArray(source.items) ? source.items : [];
  const videos = items.map((item) => ({
    videoId: item?.id?.videoId,
    title: item?.snippet?.title,
    publishedAt: item?.snippet?.publishedAt,
    thumbnail: item?.snippet?.thumbnails?.medium?.url,
  })).filter((item) => item.videoId && item.title && item.thumbnail);

  return json({ ok: true, items: videos }, 200, request, env, {
    'Cache-Control': 'public, max-age=300, s-maxage=900',
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!originAllowed(request, env)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: { ...securityHeaders(), ...corsHeaders(origin, env) },
      });
    }

    if (!originAllowed(request, env)) {
      return json({ ok: false, error: 'forbidden_origin' }, 403, request, env);
    }

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true }, 200, request, env, {
          'Cache-Control': 'no-store',
        });
      }
      if (url.pathname === '/api/newsletter') {
        return await handleNewsletter(request, env);
      }
      if (url.pathname === '/api/youtube-feed') {
        return await handleYoutube(request, env);
      }
      return json({ ok: false, error: 'not_found' }, 404, request, env);
    } catch (error) {
      console.error('Unhandled Worker error');
      return json({ ok: false, error: 'internal_error' }, 500, request, env);
    }
  },
};
