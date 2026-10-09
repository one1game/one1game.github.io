#!/usr/bin/env node
/**
 * Генератор хабов-страниц по теме «игры для слабых ноутбуков».
 *
 * Читает данные из scripts/data/slabye-noutbuki.json, дотягивает официальные
 * минимальные требования и обложки из Steam Store API (без ключа) и собирает
 * страницы-хабы в корне сайта.
 *
 * Ответы Steam кэшируются в scripts/data/steam-cache.json, поэтому повторный
 * запуск быстрый. Если Steam недоступен по конкретной игре — карточка
 * рендерится без требований, страница при этом не ломается.
 *
 * Запуск: node scripts/slabye-noutbuki.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = resolve(ROOT, 'scripts/data/slabye-noutbuki.json');
const CACHE_FILE = resolve(ROOT, 'scripts/data/steam-cache.json');

const SITE = 'https://one1game.org';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; One1GameBot/1.0)' };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const DATA = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const CACHE = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const HUBS = DATA.hubs;
const GAMES = DATA.games;
const ARTICLE = DATA.article;

const UPDATED_HUMAN = (() => {
  const [y, m, d] = (DATA.updated || '').split('-').map(Number);
  return y ? `${d} ${MONTHS[m - 1]} ${y}` : '';
})();

/** Устойчивый запрос: Steam иногда отдаёт 403/пустой ответ при частых вызовах. */
async function steamJson(url, { retries = 4, label = '' } = {}) {
  let lastErr = null;
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) {
        const j = await res.json();
        if (j && Object.keys(j).length) return j;
        lastErr = new Error('пустой ответ');
      } else {
        lastErr = new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(1200 * i);
  }
  throw lastErr || new Error(`не удалось получить ${label}`);
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '');

async function findAppId(name) {
  // cc обязателен: без него storesearch возвращает пустой список.
  const j = await steamJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=russian&cc=ru`,
    { label: `поиск «${name}»` }
  );
  const items = j.items || [];
  const target = norm(name);
  const exact = items.find((i) => norm(i.name) === target);
  if (exact) return exact.id;
  // допускаем небольшие расхождения в названии (подзаголовки, «Definitive Edition» и т.п.)
  const close = items.find((i) => {
    const n = norm(i.name);
    return n.startsWith(target) || target.startsWith(n);
  });
  return close ? close.id : null;
}

/** Минимальные требования Steam — HTML → одна читаемая строка. */
function requirementsLine(html) {
  const raw = String(html || '');
  if (!raw) return '';
  const items = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  const source = items.length ? items : [raw];
  return source
    .map((s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
}

async function loadSteam(appid, name) {
  if (CACHE[appid]) return CACHE[appid];
  // ВАЖНО: параметр cc=ru заставляет Steam отдавать success:false, поэтому
  // регион не указываем — локаль ru при этом сохраняется.
  const j = await steamJson(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=russian`,
    { label: `appdetails ${appid}` }
  );
  const entry = j[appid];
  if (!entry || !entry.success || !entry.data) return null;
  const d = entry.data;
  const out = {
    name: d.name || name,
    image: d.header_image || '',
    isFree: !!d.is_free,
    price: d.price_overview ? d.price_overview.final_formatted : '',
    genres: (d.genres || []).map((g) => g.description).join(', '),
    released: d.release_date ? d.release_date.date : '',
    min: requirementsLine(d.pc_requirements && d.pc_requirements.minimum).slice(0, 320),
  };
  CACHE[appid] = out;
  writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 1), 'utf8');
  return out;
}

/** Минимальный объём ОЗУ из официальных требований Steam. */
function parseRam(text) {
  const m = String(text || '').match(
    /(?:Оперативная память|ОЗУ|Память|Memory|RAM)[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*(GB|ГБ|MB|МБ)/i
  );
  if (!m) return '';
  const unit = /MB|МБ/i.test(m[2]) ? 'МБ' : 'ГБ';
  return `${m[1].replace(',', '.')} ${unit}`;
}

/** Ставим на каждой странице один и тот же хром сайта. */
function shell({ url, title, description, breadcrumbs, jsonld, body }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="игры для слабых ноутбуков, игры на слабом пк, нетребовательные игры, встроенная графика" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="One1Game" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#06060c" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="preconnect" href="https://shared.akamai.steamstatic.com" crossorigin />
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" onload="this.rel='stylesheet';this.removeAttribute('onload')" />
  <noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" /></noscript>
  <link rel="stylesheet" href="/styles.css?v=44" />
  <link rel="manifest" href="/manifest.json" />
  <script defer src="/analytics-consent.js?v=2"></script>
  <style>
    .breadcrumbs { margin-bottom: 18px; font-size: 13px; color: #8c93a3; }
    .breadcrumbs a { color: #7ee787; text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; }
    .lead p { line-height: 1.8; margin-bottom: 16px; }
    .hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; margin: 22px 0; }
    .hub-card { background: #0d1320; border: 1px solid #1b2333; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; }
    .hub-card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; background: #111826; }
    .hub-card h3 { font-size: 1rem; margin: 10px 0 6px; color: #fff; }
    .hub-req { font-size: .76rem; color: #8c93a3; line-height: 1.5; margin: 0 0 8px; }
    .hub-note { font-size: .86rem; color: #c9d6e6; margin: 0 0 10px; }
    .hub-card .btn { margin-top: auto; display: block; text-align: center; }
    .hub-table-wrap { overflow-x: auto; margin: 18px 0; }
    .hub-table { width: 100%; border-collapse: collapse; font-size: .84rem; min-width: 620px; }
    .hub-table th, .hub-table td { text-align: left; padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .hub-table th { color: #7ee787; font-weight: 700; white-space: nowrap; }
    .faq-item { background: #0d1320; border: 1px solid #1b2333; border-radius: 10px; padding: 10px 14px; margin: 8px 0; }
    .faq-item summary { cursor: pointer; font-weight: 600; }
    .faq-item p { margin: 8px 0 0; color: #c9d6e6; line-height: 1.7; }
    .hub-also { margin: 26px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.10); border-radius: 10px; background: rgba(255,255,255,.03); }
    .hub-also h4 { margin: 0 0 10px; color: #fff; }
    .hub-also a { display: block; margin: 6px 0; color: #7ee787; text-decoration: none; }
    .hub-also a:hover { text-decoration: underline; }
    .updated { color: #8c93a3; font-size: .9rem; }
  </style>
${jsonld.map((j) => `  <script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<main id="main-content">
<div class="container">
  <div class="page-content">
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
${breadcrumbs.map((b, i) => (i === breadcrumbs.length - 1
  ? `      <span aria-current="page">${esc(b.name)}</span>`
  : `      <a href="${b.url}">${esc(b.name)}</a> →`)).join('\n')}
    </nav>
${body}
  </div>
</div>
</main>
<script src="/components.js?v=35" defer></script>
</body>
</html>
`;
}

function buildHub(hub, entries) {
  const url = `${SITE}/${hub.slug}`;
  const titleTag = hub.title;

  const cards = entries.map((e) => {
    // Картинку берём из наших данных, иначе из API, иначе прямо с CDN Steam по appid.
    const imgSrc =
      e.image ||
      (e.steam && e.steam.image) ||
      (e.appid ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${e.appid}/header.jpg` : '');
    const img = imgSrc
      ? `<img src="${esc(imgSrc)}" alt="${esc(e.name)} — обложка игры" loading="lazy" width="460" height="215" />`
      : '';
    const req = e.steam && e.steam.min
      ? `<p class="hub-req"><strong>Минимум по Steam:</strong> ${esc(e.steam.min)}</p>`
      : '';
    // Кнопка должна быть у каждой карточки: либо страница в Steam, либо сайт игры.
    const href = e.appid ? `https://store.steampowered.com/app/${e.appid}/` : (e.url || '');
    const label = e.appid ? 'Открыть в Steam' : 'Официальный сайт';
    const link = href
      ? `<a class="btn" href="${esc(href)}" rel="nofollow noopener" target="_blank">${label}</a>`
      : '';
    return `      <article class="hub-card">
        ${img}
        <h3>${esc(e.name)}</h3>
        ${req}
        <p class="hub-note">${esc(e.note)}</p>
        ${link}
      </article>`;
  }).join('\n');

  // В таблице — только объективные данные из Steam: минимальная ОЗУ и доступ.
  // Цены не показываем: Steam отдаёт их в валюте региона запроса, а регион мы
  // не указываем (cc=ru ломает ответ API), поэтому цифры были бы неверными.
  const rows = entries.map((e) => {
    const s = e.steam || {};
    const ram = parseRam(s.min) || '—';
    const genres = s.genres || '—';
    const access = (s.isFree || e.free) ? 'Бесплатно' : 'Платно';
    return `        <tr><td>${esc(e.name)}</td><td>${esc(ram)}</td><td>${esc(genres)}</td><td>${esc(access)}</td></tr>`;
  }).join('\n');

  const faqHtml = hub.faq.map(([q, a]) => `
      <details class="faq-item">
        <summary>${esc(q)}</summary>
        <p>${esc(a)}</p>
      </details>`).join('');

  const related = hub.related
    .map((s) => HUBS.find((h) => h.slug === s))
    .filter(Boolean)
    .map((h) => `      <a href="/${h.slug}">${esc(h.h1)}</a>`)
    .join('\n');

  const body = `    <h1>${esc(hub.h1)}</h1>
    <p class="updated">Обновлено: ${esc(UPDATED_HUMAN)}</p>
    <div class="lead">
      ${hub.lead.join('\n      ')}
    </div>

    <h2>Таблица совместимости</h2>
    <div class="hub-table-wrap">
      <table class="hub-table">
        <thead>
          <tr><th>Игра</th><th>Мин. ОЗУ</th><th>Жанры</th><th>Доступ</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
    <p class="updated">Требования, жанры и цены — официальные данные Steam на ${esc(UPDATED_HUMAN)}. На разных конфигурациях результат может отличаться: ориентируйтесь на разрешение 720p и низкие настройки.</p>

    <h2>Список игр (${entries.length})</h2>
    <div class="hub-grid">
${cards}
    </div>

    <h2>Частые вопросы</h2>${faqHtml}

    <div class="hub-also">
      <h4>Читайте также</h4>
      <a href="${esc(ARTICLE)}">Игры для слабых ноутбуков: полный гид 2026</a>
${related}
      <a href="/vo-chto-poigrat.html">Во что поиграть — случайная игра из базы</a>
      <a href="/archive.html">Все статьи</a>
    </div>

    <p><a href="/">← На главную</a></p>`;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: hub.faq.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: hub.h1,
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      ...(e.appid ? { url: `https://store.steampowered.com/app/${e.appid}/` } : {}),
    })),
  };
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Игры для слабых ноутбуков', item: `${SITE}${ARTICLE}` },
      { '@type': 'ListItem', position: 3, name: hub.h1, item: url },
    ],
  };

  return shell({
    url, title: titleTag, description: hub.description,
    breadcrumbs: [
      { name: 'Главная', url: '/' },
      { name: 'Слабые ноутбуки', url: ARTICLE },
      { name: hub.h1 },
    ],
    jsonld: [crumbLd, listLd, faqLd],
    body,
  });
}

async function main() {
  // 1. Сопоставляем игры и тянем данные Steam один раз на игру.
  const prepared = [];
  for (const g of GAMES) {
    let appid = null;
    let steam = null;
    try {
      // В данных можно указать appid вручную — это нужно там, где поиск
      // находит не ту версию игры (например, Skyrim Special Edition вместо оригинала).
      appid = g.appid || (g.url ? null : await findAppId(g.name));
      if (!g.appid && !g.url) await sleep(900);
      if (appid) {
        steam = await loadSteam(appid, g.name);
        await sleep(900);
      }
    } catch (e) {
      console.warn(`  [steam] ${g.name}: ${e.message}`);
    }
    prepared.push({ ...g, appid, steam });
    console.log(`${steam ? '✓' : '·'} ${g.name}${appid ? ` (${appid})` : ''}`);
  }

  // 2. Проверяем, что ни одна карточка не осталась без обложки или кнопки.
  const noImage = prepared.filter((g) => !g.image && !(g.steam && g.steam.image) && !g.appid);
  const noLink = prepared.filter((g) => !g.appid && !g.url);
  if (noImage.length) console.log(`\n[!] Без обложки (${noImage.length}): ${noImage.map((g) => g.name).join(', ')}`);
  if (noLink.length) console.log(`[!] Без ссылки (${noLink.length}): ${noLink.map((g) => g.name).join(', ')}`);
  if (!noImage.length && !noLink.length) console.log('\nПроверка карточек: у всех есть обложка и ссылка');

  // 3. Рендерим страницы хабов.
  for (const hub of HUBS) {
    const entries = prepared.filter((g) => g.tags.includes(hub.tag));
    if (!entries.length) {
      console.warn(`✗ ${hub.slug}: нет игр с тегом ${hub.tag}`);
      continue;
    }
    const html = buildHub(hub, entries);
    writeFileSync(resolve(ROOT, hub.slug), html, 'utf8');
    console.log(`✓ ${hub.slug} — ${entries.length} игр (${html.length} байт)`);
  }
}

main().catch((e) => {
  console.error('Критическая ошибка:', e);
  process.exit(1);
});
