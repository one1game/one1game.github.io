#!/usr/bin/env node
'use strict';

/**
 * Локальный сервер для раздела /oboi/.
 * Отдаёт статику и проксирует /api/wallhaven, как Cloudflare Pages Function.
 *
 * Запуск: node oboi/dev-server.cjs
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const ALLOWED = new Set([
  'q', 'categories', 'purity', 'sorting', 'order', 'topRange',
  'atleast', 'resolutions', 'ratios', 'colors', 'page', 'seed'
]);

async function proxyWallhaven(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (ALLOWED.has(key)) params.set(key, value);
  }
  params.set('purity', '100');
  params.set('categories', '110');
  if (!params.has('sorting')) params.set('sorting', 'toplist');
  if (params.get('sorting') === 'toplist' && !params.has('topRange')) params.set('topRange', '1M');

  try {
    const response = await fetch('https://wallhaven.cc/api/v1/search?' + params.toString(), {
      headers: { 'User-Agent': 'One1Game-Wallpapers-Dev/1.0' }
    });
    const body = await response.text();
    res.writeHead(response.status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'wallhaven_unreachable' }));
  }
}

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/wallhaven') {
    proxyWallhaven(req, res);
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  let filePath = path.resolve(ROOT, '.' + pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (!error && stat.isFile()) {
      sendFile(filePath, res);
      return;
    }
    if (!path.extname(filePath)) {
      const htmlPath = filePath + '.html';
      fs.stat(htmlPath, (htmlError, htmlStat) => {
        if (!htmlError && htmlStat.isFile()) sendFile(htmlPath, res);
        else sendFile(filePath, res);
      });
      return;
    }
    sendFile(filePath, res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('OBOI dev server: http://127.0.0.1:' + PORT + '/oboi/');
  console.log('API proxy:      http://127.0.0.1:' + PORT + '/api/wallhaven');
});
