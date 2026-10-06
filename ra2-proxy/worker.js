// Cloudflare Worker: прокси для Red Alert 2 (ra2web).
// Их CDN отдаёт ресурсы только своим доменам и режет браузерные запросы с
// заголовком Origin (WebSocket отвечает 403), поэтому тянем сервер-к-серверу
// и возвращаем с Access-Control-Allow-Origin, чтобы игра работала на нашем сайте.
//
// Маршруты (базовые URL в ra2/config.json):
//   /gameres/   -> res2.wangerhuoda.cn
//   /campaign/  -> res2.wangerhuoda.cn/campaign/
//   /music/     -> res2.wangerhuoda.cn/music/
//   /map/       -> gmap.wangerhuoda.cn/map/
//   /mod/       -> gmap.wangerhuoda.cn/mod/
//
// Игровые серверы (URL в ra2/servers.json), снимаем Origin, поддерживаем WebSocket:
//   /en/<service> -> wol.flkf.k0s.cn/<service>
//   /cn/<service> -> wol.bj1.k0s.cn/<service>

const UPSTREAMS = {
  gameres: [
    'https://res2.wangerhuoda.cn/',
    'https://wyhjres2.bun.sh.cn/',
    'https://werhd.k0s.cn/',
  ],
  campaign: [
    'https://res2.wangerhuoda.cn/campaign/',
    'https://wyhjres2.bun.sh.cn/campaign/',
    'https://werhd.k0s.cn/campaign/',
  ],
  music: [
    'https://res2.wangerhuoda.cn/music/',
    'https://wyhjres2.bun.sh.cn/music/',
    'https://werhd.k0s.cn/music/',
  ],
  map: ['https://gmap.wangerhuoda.cn/map/'],
  mod: ['https://gmap.wangerhuoda.cn/mod/'],
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

function withCors(headers) {
  const h = new Headers(headers);
  for (const k in CORS) h.set(k, CORS[k]);
  return h;
}

// Wol-серверы режут браузерный Origin (403), поэтому проксируем и снимаем его.
const REGIONS = {
  en: 'wol.flkf.k0s.cn',
  cn: 'wol.bj1.k0s.cn',
};

async function proxyService(request, host, pathAndQuery) {
  const target = 'https://' + host + pathAndQuery;
  const headers = new Headers(request.headers);
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('host');

  const isUpgrade = (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';
  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

  if (!isUpgrade) {
    const upstream = await fetch(target, init);
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers: withCors(upstream.headers),
    });
  }

  const upstream = await fetch(new Request(target, init));
  const upstreamSocket = upstream.webSocket;
  if (!upstreamSocket) return new Response('Upstream did not accept WebSocket', { status: 502, headers: CORS });

  upstreamSocket.accept();
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  const shutdown = (code, reason) => {
    try { server.close(code, reason); } catch (e) {}
    try { upstreamSocket.close(code, reason); } catch (e) {}
  };

  upstreamSocket.addEventListener('message', (event) => { try { server.send(event.data); } catch (e) {} });
  server.addEventListener('message', (event) => { try { upstreamSocket.send(event.data); } catch (e) {} });
  upstreamSocket.addEventListener('close', (event) => shutdown(event.code, event.reason));
  server.addEventListener('close', (event) => shutdown(event.code, event.reason));
  upstreamSocket.addEventListener('error', () => shutdown(1011, 'upstream error'));

  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    // Игровые серверы: /<region>/<service>
    if (segments[0] && REGIONS[segments[0]]) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const rest = segments.slice(1).join('/');
      if (!rest) return new Response('Not found', { status: 404, headers: CORS });
      return proxyService(request, REGIONS[segments[0]], '/' + rest + url.search);
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Method Not Allowed', { status: 405, headers: CORS });

    const key = segments.shift();
    const bases = UPSTREAMS[key];
    if (!bases) return new Response('Not found', { status: 404, headers: CORS });

    const rest = segments.join('/');
    const query = url.search || '';
    const range = request.headers.get('Range');

    for (const base of bases) {
      try {
        const init = { method: request.method, headers: {} };
        if (range) init.headers['Range'] = range;
        const upstream = await fetch(base + rest + query, init);
        if (upstream.ok || upstream.status === 206) {
          const headers = withCors(upstream.headers);
          return new Response(request.method === 'HEAD' ? null : upstream.body, {
            status: upstream.status,
            headers,
          });
        }
      } catch (e) {
        // пробуем следующий upstream
      }
    }

    return new Response('Upstream resource unavailable', { status: 502, headers: CORS });
  },
};
