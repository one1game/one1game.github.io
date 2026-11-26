// Старый сайт → приложение.
// _redirects на Cloudflare срабатывает не для всех правил (лимит списка),
// поэтому старые HTML-страницы закрываем ещё и на уровне документа:
// мгновенный переход в /app/ для человека (meta refresh + script)
// и canonical + noindex для робота. Скрипт идемпотентный.
// Запуск: node scripts/legacy-to-app-redirect.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const ORIGIN = 'https://one1game.org';
const MARK = '<!--LEGACY-APP-REDIRECT-->';
const END = '<!--/LEGACY-APP-REDIRECT-->';
const dry = process.argv.includes('--dry');

const hasApp = (...parts) => fs.existsSync(path.join(APP, ...parts));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Статьи: слаг старой страницы → есть ли материал в приложении.
function articleSlugs() {
  const raw = read('articles-data.js');
  const start = raw.indexOf('= [');
  const end = raw.lastIndexOf('];');
  const list = JSON.parse(raw.slice(start + 2, end + 1));
  const map = new Map();
  for (const a of list) {
    const url = a?.url || '';
    if (!url.startsWith('/archive/')) continue;
    const slug = url.split('/').filter(Boolean).pop();
    if (slug) map.set(slug, { noindex: Boolean(a.noindex) });
  }
  return map;
}

const art = articleSlugs();
const movieIds = new Set(
  JSON.parse(read('webapp/src/data/movies.json')).items.map((m) => String(m.id)),
);

// Цель перехода для старой страницы. null — файл не трогаем.
function targetFor(rel) {
  const p = rel.split(path.sep).join('/');
  const base = path.basename(p, '.html');

  if (p === 'index.html') return '/app/';
  if (p === 'archive.html') return '/app/';
  if (p === 'feed/index.html') return '/app/';
  if (p.startsWith('category/') && p.endsWith('.html')) return '/app/';

  if (p.startsWith('archive/')) {
    const info = art.get(base);
    if (info && !info.noindex && hasApp('news', base, 'index.html')) return `/app/news/${base}/`;
    return '/app/';
  }

  if (p.startsWith('kino/') && p.endsWith('.html')) {
    const id = (base.match(/-(\d+)$/) || [])[1];
    if (id && movieIds.has(id) && hasApp('movie', id, 'index.html')) return `/app/movie/${id}/`;
    return '/app/movie/';
  }

  if (p.startsWith('oboi/') && p.endsWith('/index.html')) {
    const cat = p.split('/')[1];
    if (cat && cat !== 'index.html' && hasApp('oboi', cat, 'index.html')) return `/app/oboi/${cat}/`;
    return '/app/oboi/';
  }
  if (p.startsWith('music/') && p.endsWith('index.html')) return '/app/music/';

  // Старые подборки на главной → игровой навигатор приложения.
  if (p.endsWith('.html') && !p.includes('/')) {
    const pick =
      /^(besplatnye-igry|skidki-na-igry|vo-chto-poigrat|potyanet-li-|igry-|kooperativnye-|shuter-|rpg-|gonochnye-)/.test(base);
    if (pick) return '/app/nav/';
  }

  return null;
}

function blockFor(target, eol) {
  return [
    MARK,
    `  <meta http-equiv="refresh" content="0; url=${target}">`,
    `  <link rel="canonical" href="${ORIGIN}${target}">`,
    '  <meta name="robots" content="noindex, follow">',
    `  <script>location.replace('${target}' + location.hash);</script>`,
    END,
  ].join(eol);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = [
  ...walk(path.join(ROOT, 'archive')),
  ...walk(path.join(ROOT, 'category')),
  ...walk(path.join(ROOT, 'kino')),
  ...walk(path.join(ROOT, 'oboi')),
  ...walk(path.join(ROOT, 'music')),
  ...walk(path.join(ROOT, 'feed')),
  ...fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(ROOT, f)),
].filter((f) => !/(^|[\\/])(404|banerai|privacy|terms|advertising|stats|triad-duel|google[a-z0-9]+|yandex_[a-z0-9]+)\.html$/.test(f));

const counts = { app: 0, appHome: 0, nav: 0, movie: 0, oboi: 0, music: 0, skipped: 0, touched: 0 };

for (const full of files) {
  const rel = path.relative(ROOT, full);
  const target = targetFor(rel);
  if (!target) {
    counts.skipped += 1;
    continue;
  }

  const src = fs.readFileSync(full, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const block = blockFor(target, eol);

  let out;
  if (src.includes(MARK)) {
    out = src.replace(new RegExp(`${MARK}[\\s\\S]*?${END}`), block);
  } else {
    const head = src.match(/<head[^>]*>/i);
    if (!head) {
      counts.skipped += 1;
      continue;
    }
    out = src.replace(head[0], `${head[0]}${eol}${block}`);
  }

  if (out !== src) {
    counts.touched += 1;
    if (!dry) fs.writeFileSync(full, out, 'utf8');
  }

  if (target === '/app/') counts.appHome += 1;
  else if (target === '/app/nav/') counts.nav += 1;
  else if (target === '/app/movie/' || target.startsWith('/app/movie/')) counts.movie += 1;
  else if (target.startsWith('/app/oboi/')) counts.oboi += 1;
  else if (target.startsWith('/app/music/')) counts.music += 1;
  else if (target.startsWith('/app/news/')) counts.app += 1;
}

console.log(`${dry ? 'DRY-RUN' : 'Готово'}: файлов проверено ${files.length}, изменено ${counts.touched}`);
console.log(
  `  в статьи /app/news/: ${counts.app}\n  в навигатор /app/nav/: ${counts.nav}` +
  `\n  в фильмы: ${counts.movie}\n  в обои: ${counts.oboi}\n  в музыку: ${counts.music}` +
  `\n  на главную /app/: ${counts.appHome}\n  пропущено: ${counts.skipped}`,
);
