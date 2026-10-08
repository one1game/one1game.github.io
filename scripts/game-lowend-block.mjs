#!/usr/bin/env node
/**
 * Разовая простановка блока «Потянет ли слабый ноутбук?» в уже существующие
 * страницы игр в /archive/.
 *
 * Новые и обновляемые страницы получают этот блок прямо из шаблона
 * scripts/generate-games.js, поэтому скрипт нужен только чтобы не ждать
 * недельного обновления данных. Он ничего не пересобирает: вставляет ровно
 * один блок перед пометкой об автоматических данных.
 *
 * Требования к играм берутся из Steam Store API и кэшируются в
 * scripts/data/steam-cache.json (тот же кэш, что у хабов).
 *
 * Запуск: node scripts/game-lowend-block.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = resolve(ROOT, 'archive');
const DATA_FILE = resolve(ROOT, 'articles-data.js');
const CACHE_FILE = resolve(ROOT, 'scripts/data/steam-cache.json');

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; One1GameBot/1.0)' };
const ANCHOR = '<p style="color: var(--text-faint); font-size: 13px; margin-top: 30px;">';
const LOGO = '<!--LOWEND:START-->';
const BLOCK_RE = /<!--LOWEND:START-->[\s\S]*?<!--LOWEND:END-->/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CACHE = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

async function steamJson(url, retries = 3) {
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
  throw lastErr || new Error('Steam недоступен');
}

/** Минимальные требования игры (или пустая строка, если их нет). */
async function minimumFor(appid) {
  const cached = CACHE[appid];
  if (cached && typeof cached.min === 'string') return cached.min;
  const j = await steamJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=russian`);
  const entry = j[appid];
  if (!entry || !entry.success || !entry.data) return '';
  const d = entry.data;
  const raw = String((d.pc_requirements && d.pc_requirements.minimum) || '');
  const items = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  const parts = (items.length ? items : raw ? [raw] : [])
    .map((s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const min = parts.join(' · ').slice(0, 400);
  CACHE[appid] = {
    name: d.name || '', image: d.header_image || '', isFree: !!d.is_free,
    price: d.price_overview ? d.price_overview.final_formatted : '',
    genres: (d.genres || []).map((g) => g.description).join(', '),
    released: d.release_date ? d.release_date.date : '', min,
  };
  writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 1), 'utf8');
  return min;
}

function sectionHtml(min) {
  return `      <section class="lowend-block" style="margin:26px 0;padding:16px 18px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.03)">
        <h2 style="margin:0 0 10px;font-size:1.15rem">Потянет ли слабый ноутбук?</h2>
        ${min ? `<p><strong>Минимальные требования (Steam):</strong> ${min}</p>` : ''}
        <p>Ориентир для ноутбука без дискретной видеокарты — 720p и низкие настройки. Готовые подборки: <a href="/igry-bez-videokarty.html">игры без видеокарты</a>, <a href="/igry-dlya-slabyh-noutbukov-4gb-ozu.html">игры на 4 ГБ ОЗУ</a>, <a href="/besplatnye-igry-dlya-slabyh-pk.html">бесплатные игры для слабых ПК</a>. Как поднять FPS — в <a href="/archive/igry-dlya-slabyh-noutbukov-2026.html">полном гиде по слабым ноутбукам</a>.</p>
      </section>`;
}

function blockHtml(min, eol) {
  return [LOGO, sectionHtml(min), '<!--LOWEND:END-->'].join(eol) + eol;
}

function gameSlugs() {
  const raw = readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.allArticles\s*=\s*(\[[\s\S]*\])\s*;?/);
  if (!m) throw new Error('не удалось разобрать articles-data.js');
  const all = JSON.parse(m[1]);
  const isGame = (a) =>
    a.category === 'Обзоры' || /:\s*цена, отзывы и статистика игроков\s*$/i.test(a.title || '');
  return all
    .filter((a) => isGame(a) && /^\/archive\/.+-(\d+)\.html$/.test(a.url || ''))
    .map((a) => ({ slug: a.url.split('/').pop().replace(/\.html$/, ''), appid: a.url.match(/-(\d+)\.html$/)[1] }));
}

const slugs = gameSlugs();
console.log(`Страниц игр в базе: ${slugs.length}`);

let inserted = 0, filled = 0, already = 0, noAnchor = 0, missing = 0, failed = 0;

for (const { slug, appid } of slugs) {
  const file = resolve(ARCHIVE, `${slug}.html`);
  if (!existsSync(file)) { missing++; continue; }
  let html = readFileSync(file, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  // Блок уже есть: если в нём нет требований (Steam отдал 429 при первой
  // простановке) — дозаполняем, иначе просто пропускаем.
  const existing = html.match(BLOCK_RE);
  if (existing) {
    if (existing[0].includes('Минимальные требования')) { already++; continue; }
    let min = '';
    try {
      min = await minimumFor(appid);
      await sleep(700);
    } catch (e) {
      failed++;
      console.warn(`  [steam] ${slug}: ${e.message}`);
      continue;
    }
    if (!min) continue;
    html = html.replace(BLOCK_RE, [LOGO, sectionHtml(min), '<!--LOWEND:END-->'].join(eol));
    writeFileSync(file, html, 'utf8');
    filled++;
    continue;
  }

  if (!html.includes(ANCHOR)) { noAnchor++; continue; }

  let min = '';
  try {
    min = await minimumFor(appid);
    await sleep(700);
  } catch (e) {
    failed++;
    console.warn(`  [steam] ${slug}: ${e.message}`);
  }

  html = html.replace(ANCHOR, blockHtml(min, eol) + ANCHOR);
  writeFileSync(file, html, 'utf8');
  inserted++;
  if (inserted % 25 === 0) console.log(`  вставлено: ${inserted}`);
}

console.log(
  `\nГотово. Вставлено: ${inserted}, дозаполнено: ${filled}, уже было: ${already}, ` +
  `нет якоря: ${noAnchor}, нет файла: ${missing}, ошибок Steam: ${failed}`
);
