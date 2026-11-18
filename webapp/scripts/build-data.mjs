// Собирает данные для приложения из общего articles-data.js сайта.
// В демо попадают только страницы, открытые от индекса: 47 статей + 38 игр.
//
// На выходе два слоя:
//   1) src/data/catalog.json — лёгкий индекс для сетки и поиска (~56 КБ);
//   2) public/posts/<slug>.json — тело материала, грузится по требованию.
// Так приложение не тянет мегабайты разметки при старте: открыли карточку —
// приехал один файл, дальше он живёт в кэше service worker'а.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = path.resolve(ROOT, '..');
const SOURCE = path.join(SITE, 'articles-data.js');
const OUT = path.join(ROOT, 'src', 'data', 'catalog.json');
const POSTS = path.join(ROOT, 'public', 'posts');
const MUSIC_SRC = path.join(SITE, 'music', 'data.json');
// Небольшой снимок каталога на случай, если API Audius недоступен.
const MUSIC_OUT = path.join(ROOT, 'public', 'music.json');
// Обложки для «обоев» вкладки «Музыка» (без загрузки всего снимка).
const MUSIC_ART_OUT = path.join(ROOT, 'src', 'data', 'music-art.json');
const NAV_OUT = path.join(ROOT, 'src', 'data', 'navigator.json');
// Обои: страница oboi/ основного сайта. Категории — маленький файл для чипов,
// сами картинки — отдельный JSON в public, грузится при открытии вкладки.
const OBOI_SRC = path.join(SITE, 'oboi', 'data.json');
const OBOI_CATS_OUT = path.join(ROOT, 'src', 'data', 'oboi.json');
const OBOI_ITEMS_OUT = path.join(ROOT, 'public', 'oboi.json');
// Фильмы по играм: хаб kino/ основного сайта + страницы каждого фильма.
const KINO_DIR = path.join(SITE, 'kino');
const KINO_HUB = path.join(KINO_DIR, 'index.html');
const MOVIES_OUT = path.join(ROOT, 'src', 'data', 'movies.json');
const MOVIE_DETAILS = path.join(ROOT, 'public', 'movies');

// CheapShark: скидки Steam. API требует описательный User-Agent и отдаёт
// до 60 позиций за запрос — берём максимум и все полезные поля.
const CHEAPSHARK_URL = 'https://www.cheapshark.com/api/1.0/deals?storeID=1&sortBy=Savings&pageSize=60&upperPrice=60';
const CHEAPSHARK_UA = 'One1GameApp/1.0 (+https://one1game.org)';
const CHEAPSHARK_CACHE = path.join(ROOT, '.cache', 'cheapshark.json');
const CHEAPSHARK_TTL = 30 * 60 * 1000;

// Разделы музыки: ключ группы в music/data.json → подпись в приложении.
const MUSIC_CATEGORIES = [
  ['lofi', 'Lo-Fi'],
  ['electronic', 'Electronic'],
  ['hip-hop', 'Hip-Hop'],
  ['rock', 'Rock'],
  ['chill', 'Chill'],
  ['study', 'Для учёбы'],
  ['gaming', 'Для игр'],
  ['workout', 'Для тренировок'],
];

const MONTHS = {
  января: '01', февраля: '02', марта: '03', апреля: '04', мая: '05', июня: '06',
  июля: '07', августа: '08', сентября: '09', октября: '10', ноября: '11', декабря: '12',
};

function toISO(value) {
  const v = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/i);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

// ── вырезание блоков по классу ──
// Внутри тела статьи живут реклама, форма подписки и дубли «похожих».
// Их в приложении быть не должно: вырезаем вместе с содержимым,
// считая вложенность одноимённых тегов, чтобы не оборвать разметку.
function cutBlock(html, tag, className) {
  const openRe = new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'i');
  let out = html;
  for (;;) {
    const m = openRe.exec(out);
    if (!m) return out;

    const start = m.index;
    const scan = new RegExp(`<${tag}\\b|</${tag}\\s*>`, 'gi');
    scan.lastIndex = start + m[0].length;
    let depth = 1;
    let end = -1;
    let t;
    while ((t = scan.exec(out))) {
      if (t[0][1] === '/') {
        depth--;
        if (depth === 0) {
          end = scan.lastIndex;
          break;
        }
      } else if (!/\/>$/.test(t[0])) {
        depth++;
      }
    }
    if (end === -1) return out;
    out = out.slice(0, start) + out.slice(end);
  }
}

// Тело материала лежит в <article class="article-body">…</article>.
// Один и тот же шаблон у статей и у карточек игр.
function extractBody(slug) {
  const file = path.join(SITE, 'archive', `${slug}.html`);
  if (!fs.existsSync(file)) return '';

  const page = fs.readFileSync(file, 'utf8');
  const openRe = /<article\b[^>]*class="[^"]*\barticle-body\b[^"]*"[^>]*>/i;
  const m = openRe.exec(page);
  if (!m) return '';

  const from = m.index + m[0].length;
  const to = page.indexOf('</article>', from);
  if (to === -1) return '';
  let body = page.slice(from, to);

  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
  body = cutBlock(body, 'a', 'av-ad');
  body = cutBlock(body, 'a', 'av-banner');
  body = cutBlock(body, 'div', 'newsletter-box');
  body = cutBlock(body, 'div', 'related-inline');
  body = cutBlock(body, 'div', 'game-movies');
  body = cutBlock(body, 'div', 'comments-section');
  body = cutBlock(body, 'div', 'reactions-section');

  return body.replace(/\n{3,}/g, '\n\n').trim();
}

// Относительные ссылки и картинки в статьях указывают на основной сайт.
// В приложении такой путь дал бы 404 (/app/img/...), поэтому делаем абсолютным.
const SITE_URL = 'https://one1game.org';
function absoluteLinks(html) {
  return html
    .replace(/(\s(?:href|src|poster)=")\/(?!\/)/gi, `$1${SITE_URL}/`)
    .replace(/(\s(?:srcset|data-srcset)=")([^"]+)"/gi, (all, head, list) =>
      `${head}${String(list).replace(/(^|,\s*)\/(?!\/)/g, `$1${SITE_URL}/`)}"`);
}

function wordCount(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1).length;
}

// ── подбор «Читать дальше» ──
// Прошлый вариант брал просто свежие материалы той же рубрики: в статье
// про Sega соседями оказывались нейросети и монетизация. Теперь сравниваем
// темы по словам заголовка и описания, рубрика даёт лишь небольшой бонус.
const STOP_WORDS = new Set([
  'этот', 'этого', 'этом', 'этой', 'этих', 'котор', 'котора', 'которы', 'которые',
  'чтобы', 'можно', 'нужно', 'будет', 'будут', 'есть', 'было', 'были', 'очень',
  'также', 'после', 'перед', 'через', 'между', 'свои', 'своих', 'своего', 'это',
  'обзор', 'обзоры', 'игра', 'игры', 'играх', 'игре', 'игру', 'игрок', 'игрока',
  'новый', 'новая', 'новое', 'новые', 'какой', 'какая', 'какие', 'почему',
  'лучшие', 'лучший', 'теперь', 'просто', 'более', 'менее', 'самый', 'самые',
  'the', 'and', 'with', 'for', 'that', 'this', 'from', 'game', 'games',
]);

// Грубый стемминг: сравниваем первые пять символов, чтобы «игровой»,
// «игровая» и «игровые» считались одним словом.
function topicKeys(item) {
  const text = `${item.title} ${item.excerpt}`.toLowerCase().replace(/[^a-zа-яё0-9-]+/gi, ' ');
  const keys = new Set();
  for (const word of text.split(/\s+/)) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    keys.add(word.slice(0, 5));
  }
  return keys;
}

const topicIndex = new Map();
function keysOf(item) {
  if (!topicIndex.has(item.slug)) topicIndex.set(item.slug, topicKeys(item));
  return topicIndex.get(item.slug);
}

function pickRelated(item) {
  const bySlug = new Map(items.map((o) => [o.slug, o]));
  const chosen = [];
  const seen = new Set([item.slug]);

  // 1. Ручной список автора — он важнее любого алгоритма.
  for (const slug of item.relatedSlugs) {
    const hit = bySlug.get(slug);
    if (hit && !seen.has(hit.slug)) {
      chosen.push(hit);
      seen.add(hit.slug);
    }
  }

  // 2. Похожие по теме: минимум два общих слова. Одиночное совпадение
  //    («игра», «начать») тянет случайные материалы, поэтому его отсекаем.
  const mine = keysOf(item);
  const scored = items
    .filter((o) => !seen.has(o.slug))
    .map((o) => {
      const keys = keysOf(o);
      let overlap = 0;
      for (const key of keys) if (mine.has(key)) overlap++;
      return { item: o, overlap };
    })
    .filter((entry) => entry.overlap >= 2)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        Number(b.item.category === item.category) - Number(a.item.category === item.category) ||
        (b.item.dateISO || '').localeCompare(a.item.dateISO || ''),
    );

  for (const entry of scored) {
    if (chosen.length >= 6) break;
    chosen.push(entry.item);
    seen.add(entry.item.slug);
  }

  // 3. Подстраховка: если тема редкая, добираем свежим из той же рубрики,
  //    чтобы блок не оставался с одной карточкой.
  if (chosen.length < 4) {
    for (const o of items) {
      if (chosen.length >= 4) break;
      if (seen.has(o.slug) || o.category !== item.category) continue;
      chosen.push(o);
      seen.add(o.slug);
    }
  }

  return chosen.slice(0, 6).map((o) => ({
    slug: o.slug,
    title: o.title,
    category: o.category,
    date: o.date,
    image: o.image,
  }));
}


const raw = fs.readFileSync(SOURCE, 'utf8');
const start = raw.indexOf('= [');
const end = raw.lastIndexOf('];');
const all = JSON.parse(raw.slice(start + 2, end + 1));

const items = all
  .filter((a) => a && a.url && !a.noindex)
  .map((a) => {
    const isGame = a.category === 'Обзоры';
    return {
      slug: a.url.split('/').filter(Boolean).pop() || '',
      url: `https://one1game.org${a.url}`,
      path: a.url,
      title: a.title || '',
      excerpt: a.excerpt || '',
      category: a.category || '',
      date: a.date || '',
      dateISO: toISO(a.updated) || toISO(a.date),
      // Даты публикации и правки по отдельности: по ним считается бейдж
      // «DROP» (новая публикация) и «ОБНОВЛЕНО» (правка старой).
      published: toISO(a.date),
      updatedISO: toISO(a.updated) || toISO(a.date),
      // Часть обложек задана путём от корня сайта (/img/...) — в приложении
      // такой адрес ведёт на /app/img/ и даёт 404. Делаем абсолютным.
      image: a.image ? (/^\//.test(a.image) ? `${SITE_URL}${a.image}` : a.image) : '',
      // Автор может вручную задать «Читать дальше» — эти ссылки идут первыми.
      relatedSlugs: Array.isArray(a.related) ? a.related : [],
      game: isGame,
      read: Math.max(1, Math.round(((a.excerpt || '').split(/\s+/).length || 0) / 40)) || 1,
    };
  })
  // Свежее сверху: даты ISO, поэтому обычная сортировка строк работает.
  .sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''));

// ── тела материалов ──
fs.rmSync(POSTS, { recursive: true, force: true });
fs.mkdirSync(POSTS, { recursive: true });

let bodies = 0;
let bytes = 0;
for (const item of items) {
  const html = absoluteLinks(extractBody(item.slug));
  if (!html) {
    item.read = 1;
    continue;
  }
  bodies++;

  const words = wordCount(html);
  item.read = Math.max(1, Math.round(words / 180));

  const related = pickRelated(item);

  const json = JSON.stringify({
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    category: item.category,
    date: item.date,
    dateISO: item.dateISO,
    image: item.image,
    read: item.read,
    words,
    html,
    related,
  });
  fs.writeFileSync(path.join(POSTS, `${item.slug}.json`), json, 'utf8');
  bytes += Buffer.byteLength(json);
}

// ── бейджи свежести ──
// DROP — материал опубликован недавно, ОБНОВЛЕНО — у старого обновили текст.
// Оба живут ровно три календарных дня от своей даты, потом исчезают.
const DAY_MS = 86400000;
const nowDay = Math.floor(Date.now() / DAY_MS);
const dayNumber = (iso) => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
};

for (const item of items) {
  const pubDiff = item.published ? nowDay - dayNumber(item.published) : Infinity;
  const updDiff = item.updatedISO ? nowDay - dayNumber(item.updatedISO) : Infinity;
  const isNew = pubDiff >= 0 && pubDiff < 3;
  const isUpdated = !isNew && item.updatedISO !== item.published && updDiff >= 0 && updDiff < 3;
  item.badge = isNew ? 'new' : isUpdated ? 'updated' : '';
}

const categories = [...new Set(items.map((i) => i.category))];
const stats = {
  total: items.length,
  articles: items.filter((i) => !i.game).length,
  games: items.filter((i) => i.game).length,
  categories: categories.length,
  generated: new Date().toISOString().slice(0, 10),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ stats, categories, items }, null, 0), 'utf8');

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
const mb = (bytes / 1024 / 1024).toFixed(2);
console.log(
  `каталог: ${stats.total} материалов (${stats.articles} статей, ${stats.games} игр), ${kb} КБ → src/data/catalog.json`
);
console.log(`тела: ${bodies} файлов, ${mb} МБ → public/posts/ (грузятся по одному)`);

// ── музыка ──
// Треки берём из общего каталога сайта. В приложении нужен только лёгкий
// индекс: обложка, название, артист и группы, в которых трек встречается.
if (fs.existsSync(MUSIC_SRC)) {
  const source = JSON.parse(fs.readFileSync(MUSIC_SRC, 'utf8'));
  const groups = source.genres || {};
  const byId = new Map();

  const musicCategories = MUSIC_CATEGORIES
    .filter(([key]) => Array.isArray(groups[key]) && groups[key].length)
    .map(([key, label]) => {
      let count = 0;
      for (const track of groups[key]) {
        if (!track || !track.id || track.is_delete || track.is_unlisted || track.is_streamable === false) continue;
        if (track.access && track.access.stream === false) continue;

        let item = byId.get(track.id);
        if (!item) {
          item = {
            id: track.id,
            title: track.title || '',
            artist: (track.user && track.user.name) || '',
            genre: track.genre || '',
            duration: Number(track.duration) || 0,
            plays: Number(track.play_count) || 0,
            art: (track.artwork && (track.artwork['480x480'] || track.artwork['1000x1000'])) || '',
            date: track.release_date || '',
            groups: [],
          };
          byId.set(track.id, item);
        }
        item.groups.push(key);
        count++;
      }
      return { key, label, count };
    });

  const tracks = [...byId.values()]
    .map((track) => ({ ...track, groups: [...new Set(track.groups)] }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  fs.writeFileSync(MUSIC_OUT, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    categories: musicCategories,
    tracks,
  }), 'utf8');

  const musicKb = (fs.statSync(MUSIC_OUT).size / 1024).toFixed(1);
  console.log(`музыка: ${tracks.length} треков, ${musicKb} КБ → public/music.json`);

  // Обложки для «обоев» категорий музыки. Часть треков лежит на мёртвых
  // нодах Audius — такие обложки отсеиваем, чтобы не было битых картинок.
  const AUDIUS_ART_CACHE = path.join(ROOT, '.cache', 'audius-art.json');
  const AUDIUS_ART_TTL = 7 * 24 * 60 * 60 * 1000;
  let audiusArt = {};
  try {
    audiusArt = JSON.parse(fs.readFileSync(AUDIUS_ART_CACHE, 'utf8')) || {};
  } catch {
    audiusArt = {};
  }

  const audiusArtOk = async (url) => {
    const hit = audiusArt[url];
    if (hit && Date.now() - hit.ts < AUDIUS_ART_TTL) return hit.ok;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'One1GameApp/1.0 (+https://one1game.org)' },
        signal: AbortSignal.timeout(8000),
      });
      audiusArt[url] = { ok: res.ok, ts: Date.now() };
      return res.ok;
    } catch {
      audiusArt[url] = { ok: false, ts: Date.now() };
      return false;
    }
  };

  const rawArts = [...new Set(tracks.map((track) => track.art).filter(Boolean))].slice(0, 48);
  const liveArts = [];
  for (const url of rawArts) {
    if (await audiusArtOk(url)) liveArts.push(url);
  }
  // Если сети нет совсем — оставляем исходный список, карточки догрузят fallback.
  const pool = liveArts.length ? liveArts : rawArts;
  const arts = Array.from({ length: 48 }, (_, i) => pool[i % (pool.length || 1)]).filter(Boolean);

  fs.writeFileSync(MUSIC_ART_OUT, JSON.stringify({ arts }), 'utf8');
  fs.mkdirSync(path.dirname(AUDIUS_ART_CACHE), { recursive: true });
  fs.writeFileSync(AUDIUS_ART_CACHE, JSON.stringify(audiusArt), 'utf8');
}

// ── игровой навигатор ──
// Переносим «Подборки» основного сайта: раздачи, скидки и игры для слабых ПК.
// Данные берём из их же JSON и готовых страниц, чтобы в приложении не было
// расхождений с сайтом.
const decode = (value) => String(value || '')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const plain = (html) => decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function dealImages(file) {
  const html = fs.readFileSync(file, 'utf8');
  const map = new Map();
  for (const match of html.matchAll(/<article class="deal-card">([\s\S]*?)<\/article>/g)) {
    const block = match[1];
    const img = /<img[^>]+src="([^"]+)"/.exec(block);
    const title = /<h2>([\s\S]*?)<\/h2>/.exec(block);
    if (img && title) map.set(plain(title[1]), img[1]);
  }
  return map;
}

const giveawaysSource = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'giveaways.json'), 'utf8'));
const giveawayImages = dealImages(path.join(SITE, 'besplatnye-igry.html'));
const giveaways = (giveawaysSource.items || []).map((item) => ({
  title: item.title || '',
  platforms: item.platforms || '',
  worth: item.worth && item.worth !== 'N/A' ? item.worth : '',
  end: item.end_date && item.end_date !== 'N/A' ? item.end_date : '',
  url: item.url || '',
  description: item.description || '',
  image: giveawayImages.get(item.title) || '',
}));

const dealImagesMap = dealImages(path.join(SITE, 'skidki-na-igry.html'));

// Пробуем живой API: цены и рейтинги меняются в течение дня. Кеш на 30 минут
// защищает от лишних запросов при повторных сборках. Если сети нет,
// остаётся data/deals.json от основного сайта.
let dealsSource;
let cachedDeals = null;
try {
  const raw = JSON.parse(fs.readFileSync(CHEAPSHARK_CACHE, 'utf8'));
  if (raw && Array.isArray(raw.items) && raw.items.length && Date.now() - Number(raw.saved) < CHEAPSHARK_TTL) {
    cachedDeals = raw;
  }
} catch {}

if (cachedDeals) {
  dealsSource = {
    updated: cachedDeals.updated || new Date().toISOString().slice(0, 10),
    currency: 'USD',
    items: cachedDeals.items,
  };
  console.log(`CheapShark: ${cachedDeals.items.length} скидок из кеша`);
} else {
  try {
    const res = await fetch(CHEAPSHARK_URL, {
      headers: { 'User-Agent': CHEAPSHARK_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) throw new Error('пустой ответ');
    const updated = new Date().toISOString().slice(0, 10);
    dealsSource = { updated, currency: 'USD', items: list };
    fs.mkdirSync(path.dirname(CHEAPSHARK_CACHE), { recursive: true });
    fs.writeFileSync(CHEAPSHARK_CACHE, JSON.stringify({ saved: Date.now(), updated, items: list }), 'utf8');
    console.log(`CheapShark: ${list.length} скидок онлайн`);
  } catch (error) {
    console.warn(`CheapShark недоступен (${error.message}) — беру data/deals.json`);
    dealsSource = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'deals.json'), 'utf8'));
  }
}

// Steam отдаёт обложки разного размера. capsule_616x353 — нормальное
// разрешение для карточки, header.jpg — запасной вариант.
const steamArt = (appId, file) => appId
  ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/${file}`
  : '';

const deals = (dealsSource.items || []).map((item) => {
  const thumb = item.thumb || '';
  const htmlImage = dealImagesMap.get(item.title) || '';
  const appId = String(item.steamAppID || '')
    || (/\/apps?\/(\d+)\//.exec(thumb) || [])[1]
    || (/\/apps?\/(\d+)\//.exec(htmlImage) || [])[1]
    || '';
  const dealId = item.dealID || '';
  return {
    title: item.title || '',
    sale: Number(item.salePrice) || 0,
    normal: Number(item.normalPrice) || 0,
    discount: Math.round(Number(item.savings ?? item.savingsPercent) || 0),
    // Реальная оценка Steam, а не dealRating CheapShark.
    ratingText: item.steamRatingText || '',
    ratingPercent: Number(item.steamRatingPercent) || 0,
    ratingCount: Number(item.steamRatingCount) || 0,
    metacritic: Number(item.metacriticScore) || 0,
    dealRating: Number(item.dealRating) || 0,
    release: Number(item.releaseDate) || 0,
    appId,
    thumb,
    url: item.url || (dealId ? `https://www.cheapshark.com/redirect?dealID=${dealId}` : ''),
    image: steamArt(appId, 'capsule_616x353.jpg') || thumb || htmlImage,
    imageFallback: steamArt(appId, 'header.jpg') || thumb || htmlImage,
  };
});

const lowend = [];
const hubHtml = fs.readFileSync(path.join(SITE, 'igry-bez-videokarty.html'), 'utf8');
for (const match of hubHtml.matchAll(/<article class="hub-card">([\s\S]*?)<\/article>/g)) {
  const block = match[1];
  const img = /<img[^>]+src="([^"]+)"/.exec(block);
  const title = /<h3>([\s\S]*?)<\/h3>/.exec(block);
  const req = /<p class="hub-req">([\s\S]*?)<\/p>/.exec(block);
  const note = /<p class="hub-note">([\s\S]*?)<\/p>/.exec(block);
  const url = /<a class="btn" href="([^"]+)"/.exec(block);
  const reqText = plain(req && req[1]);
  const ram = /Оперативная память:\s*([^·]+)/i.exec(reqText);
  const gpu = /Видеокарта:\s*([^·]+)/i.exec(reqText);
  if (!title) continue;
  const pageUrl = url ? url[1] : '';
  const appId = (/\/apps?\/(\d+)\//.exec(pageUrl) || [])[1] || '';
  const rawImage = img ? img[1] : '';
  lowend.push({
    title: plain(title[1]),
    image: steamArt(appId, 'capsule_616x353.jpg') || rawImage,
    imageFallback: rawImage,
    req: reqText.slice(0, 240),
    ram: ram ? ram[1].trim() : '',
    gpu: gpu ? gpu[1].trim() : '',
    note: plain(note && note[1]),
    url: pageUrl,
  });
}

// У части игр в Steam нет capsule_616x353 — карточка успевала показать
// битую обложку до срабатывания onerror. Проверяем размеры заранее и берём
// первый существующий вариант. Результаты кэшируем на неделю.
const ART_CACHE = path.join(ROOT, '.cache', 'steam-art.json');
const ART_TTL = 7 * 24 * 60 * 60 * 1000;
let artCache = {};
try {
  artCache = JSON.parse(fs.readFileSync(ART_CACHE, 'utf8')) || {};
} catch {
  artCache = {};
}

async function artExists(url) {
  if (!url) return false;
  const hit = artCache[url];
  if (hit && Date.now() - hit.ts < ART_TTL) return hit.ok;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': CHEAPSHARK_UA },
      signal: AbortSignal.timeout(8000),
    });
    artCache[url] = { ok: res.ok, ts: Date.now() };
    return res.ok;
  } catch {
    artCache[url] = { ok: false, ts: Date.now() };
    return false;
  }
}

// Перебирает варианты обложки и ставит первый рабочий.
async function pickArt(items, candidatesOf, concurrency = 10) {
  let index = 0;
  let fixed = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index++];
      for (const url of candidatesOf(item).filter(Boolean)) {
        if (await artExists(url)) {
          if (item.image !== url) {
            item.image = url;
            fixed++;
          }
          break;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return fixed;
}

const fixedCapsules = await pickArt(deals, (item) => [
  steamArt(item.appId, 'capsule_616x353.jpg'),
  steamArt(item.appId, 'header.jpg'),
  item.thumb,
]);
const fixedLowend = await pickArt(lowend, (item) => [item.image, item.imageFallback]);
if (fixedCapsules || fixedLowend) {
  console.log(`обложки: заменено ${fixedCapsules} скидок, ${fixedLowend} игр слабых ПК`);
}

// Одна обложка-«лицо» подборки: самое характерное предложение категории.
// Карточке достаточно одного кадра — меньше веса, чище композиция.
const worthOf = (item) => parseFloat(String(item && item.worth || '').replace(/[^0-9.]/g, '')) || 0;

// Раздачи: сначала крупные магазины (Epic, Steam, GOG), потом цена подарка.
const giveawayStore = (item) => {
  const p = String(item.platforms || '');
  if (/epic games|steam|gog/i.test(p)) return 3;
  if (/itch\.io/i.test(p)) return 0;
  return 1;
};
const giveawayHero = [...giveaways]
  .filter((item) => item.image)
  .sort((a, b) => (giveawayStore(b) * 1000 + worthOf(b)) - (giveawayStore(a) * 1000 + worthOf(a)))[0];

// Скидки: лучшая сделка по оценке CheapShark, при равенстве — больший процент.
// Для фона берём только крупные обложки, иначе карточка «мылит».
const dealHero = [...deals]
  .filter((item) => item.image && !item.image.includes('capsule_231x87'))
  .sort((a, b) => (b.dealRating - a.dealRating) || (b.discount - a.discount))[0];

// Во что поиграть: свежая игра базы One1Game — то, ради чего открывают рандомайзер.
// Обложку статьи меняем на крупный Steam-капсуль: он совпадает с пропорциями карточки.
const gamesWithArt = items.filter((item) => item.game && item.image);
const randomHero = gamesWithArt[0];
const randomAppId = randomHero ? (/\/apps\/(\d+)\//.exec(randomHero.image) || [])[1] || '' : '';
let randomHeroImage = '';
for (const url of [
  steamArt(randomAppId, 'capsule_616x353.jpg'),
  steamArt(randomAppId, 'header.jpg'),
  randomHero && randomHero.image,
].filter(Boolean)) {
  if (await artExists(url)) {
    randomHeroImage = url;
    break;
  }
}

// Слабые ПК: первая игра подборки — самая известная (Metal Gear Solid V и т.п.).
const lowendHero = lowend.find((item) => item.image && !item.image.includes('capsule_231x87')) || lowend[0];

fs.mkdirSync(path.dirname(ART_CACHE), { recursive: true });
fs.writeFileSync(ART_CACHE, JSON.stringify(artCache), 'utf8');

fs.writeFileSync(NAV_OUT, JSON.stringify({
  updated: giveawaysSource.updated || dealsSource.updated || '',
  currency: dealsSource.currency || 'USD',
  collections: [
    { key: 'giveaways', label: 'Бесплатные раздачи', desc: 'Что сейчас отдают бесплатно: Steam, Epic, GOG и другие магазины', count: giveaways.length, image: (giveawayHero && giveawayHero.image) || '' },
    { key: 'deals', label: 'Скидки на игры', desc: 'Лучшие скидки Steam, отсортированные по размеру скидки', count: deals.length, image: (dealHero && dealHero.image) || '' },
    { key: 'random', label: 'Во что поиграть', desc: 'Случайная игра из базы One1Game — если не можете выбрать', count: 0, image: randomHeroImage },
    { key: 'lowend', label: 'Слабые ПК', desc: 'Игры без дискретной видеокарты: что потянет встроенная графика', count: lowend.length, image: (lowendHero && lowendHero.image) || '' },
  ],
  giveaways,
  deals,
  lowend,
}), 'utf8');

console.log(`навигатор: ${giveaways.length} раздач, ${deals.length} скидок, ${lowend.length} игр → src/data/navigator.json`);

// ── обои (страница oboi/ основного сайта) ───────────────────────────
// Данные уже собраны генератором сайта: 24 картинки на главной и по 24
// в каждой подборке. Переносим их без изменений, оставляя только поля,
// которые нужны карточке и просмотрщику.
const OBOI_LABELS = [
  ['games', 'Игры'],
  ['neon', 'Неон'],
  ['cyberpunk', 'Киберпанк'],
  ['anime', 'Аниме'],
  ['dark', 'Тёмные'],
  ['retro', 'Ретро'],
  ['fantasy', 'Фэнтези'],
  ['4k', '4K'],
  ['1920x1080', '1920×1080'],
  ['2560x1440', '2560×1440'],
  ['phone', 'Телефон'],
  ['ultrawide', 'Ultrawide'],
  ['cyberpunk-2077', 'Cyberpunk 2077'],
  ['elden-ring', 'Elden Ring'],
  ['genshin-impact', 'Genshin Impact'],
  ['gta-5', 'GTA V'],
  ['minecraft', 'Minecraft'],
  ['counter-strike', 'Counter-Strike'],
  ['valorant', 'Valorant'],
  ['the-witcher-3', 'The Witcher 3'],
  ['star-wars', 'Star Wars'],
  ['dota-2', 'Dota 2'],
  ['league-of-legends', 'League of Legends'],
  ['fortnite', 'Fortnite'],
  ['dark-souls', 'Dark Souls'],
  ['god-of-war', 'God of War'],
  ['red-dead-redemption-2', 'RDR 2'],
  ['hollow-knight', 'Hollow Knight'],
];

if (fs.existsSync(OBOI_SRC)) {
  const source = JSON.parse(fs.readFileSync(OBOI_SRC, 'utf8'));
  const wall = (item) => ({
    id: item.id,
    thumb: item.thumb,
    full: item.full,
    page: item.page,
    w: item.width,
    h: item.height,
    res: item.res,
    ratio: Number(item.ratio) || (item.width && item.height ? item.width / item.height : 0),
    size: Number(item.file_size) || 0,
  });

  const items = { all: (source.home || []).map(wall) };
  const categories = [{
    key: 'all',
    label: 'Все',
    count: source.total || items.all.length,
    cover: items.all[0]?.thumb || '',
  }];

  for (const [key, label] of OBOI_LABELS) {
    const page = source.pages?.[key];
    if (!page || !Array.isArray(page.items) || !page.items.length) continue;
    items[key] = page.items.map(wall);
    categories.push({
      key,
      label,
      count: source.presets?.[key] || page.total || items[key].length,
      cover: items[key][0]?.thumb || '',
    });
  }

  fs.writeFileSync(OBOI_CATS_OUT, JSON.stringify({
    updated: String(source.generatedAt || '').slice(0, 10),
    total: source.total || items.all.length,
    categories,
  }), 'utf8');

  // Прокси сайта упирается в лимит Wallhaven (45 запросов в минуту на общий
  // IP), поэтому архив собираем заранее напрямую: по каждой подборке —
  // популярные, новые и топ за месяц. Приложение берёт API, а при 429
  // показывает этот архив с теми же сортировками.
  const WALLHAVEN_API = 'https://wallhaven.cc/api/v1/search';
  const WALLHAVEN_UA = 'One1GameApp/1.0 (+https://one1game.org)';
  const WALLHAVEN_CACHE = path.join(ROOT, '.cache', 'wallhaven-v2.json');
  const WALLHAVEN_TTL = 7 * 24 * 60 * 60 * 1000;
  const WALL_SORTS = ['favorites', 'date_added', 'toplist'];
  const WALL_FILTERS = {
    all: {},
    games: { q: 'game' },
    neon: { q: 'neon' },
    cyberpunk: { q: 'cyberpunk' },
    anime: { q: 'anime' },
    dark: { q: 'dark' },
    retro: { q: 'retro' },
    fantasy: { q: 'fantasy' },
    '4k': { atleast: '3840x2160', ratios: '16x9' },
    '1920x1080': { resolutions: '1920x1080', ratios: '16x9' },
    '2560x1440': { resolutions: '2560x1440', ratios: '16x9' },
    phone: { atleast: '1080x1920', ratios: '9x16' },
    ultrawide: { atleast: '3440x1440', ratios: '21x9' },
    'cyberpunk-2077': { q: 'cyberpunk 2077' },
    'elden-ring': { q: 'elden ring' },
    'genshin-impact': { q: 'genshin impact' },
    'gta-5': { q: 'gta 5' },
    minecraft: { q: 'minecraft' },
    'counter-strike': { q: 'counter strike' },
    valorant: { q: 'valorant' },
    'the-witcher-3': { q: 'the witcher 3' },
    'star-wars': { q: 'star wars' },
    'dota-2': { q: 'dota 2' },
    'league-of-legends': { q: 'league of legends' },
    fortnite: { q: 'fortnite' },
    'dark-souls': { q: 'dark souls' },
    'god-of-war': { q: 'god of war' },
    'red-dead-redemption-2': { q: 'red dead redemption 2' },
    'hollow-knight': { q: 'hollow knight' },
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wallFromApi = (item) => ({
    id: item.id,
    thumb: item.thumbs?.large || item.thumbs?.original || item.path,
    full: item.path,
    page: item.url,
    w: Number(item.dimension_x) || 0,
    h: Number(item.dimension_y) || 0,
    res: item.resolution,
    ratio: Number(item.ratio) || (item.dimension_x ? item.dimension_x / item.dimension_y : 0),
    size: Number(item.file_size) || 0,
  });

  async function wallPage(key, sorting, page) {
    const params = new URLSearchParams({
      categories: '110',
      purity: '100',
      sorting,
      page: String(page),
    });
    if (sorting === 'toplist') params.set('topRange', '1y');
    const filter = WALL_FILTERS[key] || {};
    for (const [name, value] of Object.entries(filter)) params.set(name, value);
    if (!filter.q && !filter.atleast && !filter.resolutions) params.set('atleast', '1920x1080');

    const res = await fetch(`${WALLHAVEN_API}?${params.toString()}`, {
      headers: { 'User-Agent': WALLHAVEN_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Wallhaven ${res.status}`);
    return res.json();
  }

  let cache = null;
  try {
    cache = JSON.parse(fs.readFileSync(WALLHAVEN_CACHE, 'utf8'));
  } catch {
    cache = null;
  }

  let sorts = cache?.sorts || {};
  if (!cache || Date.now() - Number(cache.saved || 0) > WALLHAVEN_TTL) {
    const previous = sorts;
    sorts = {};
    const keys = ['all', ...OBOI_LABELS.map(([key]) => key)];
    let fetched = 0;
    let failed = 0;

    for (const key of keys) {
      sorts[key] = {};
      for (const sorting of WALL_SORTS) {
        // Для «Все» берём три страницы — 72 картинки на каждую сортировку.
        const pages = key === 'all' ? 3 : 1;
        const list = [];
        for (let page = 1; page <= pages; page++) {
          try {
            const json = await wallPage(key, sorting, page);
            for (const item of json.data || []) list.push(wallFromApi(item));
            fetched++;
          } catch (error) {
            failed++;
            console.warn(`  обои: ${key}/${sorting}/${page} — ${error.message}`);
            break;
          }
          // Лимит Wallhaven — 45 запросов в минуту: держимся около 38.
          await sleep(1600);
        }
        const seen = new Set();
        const unique = list.filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
        // Неудачная страница не должна обнулять прошлый удачный архив.
        sorts[key][sorting] = unique.length ? unique : previous[key]?.[sorting] || [];
      }
    }

    fs.mkdirSync(path.dirname(WALLHAVEN_CACHE), { recursive: true });
    fs.writeFileSync(WALLHAVEN_CACHE, JSON.stringify({ saved: Date.now(), sorts }), 'utf8');
    console.log(`  wallhaven: ${fetched} страниц, ошибок ${failed}`);
  }

  // Основной список — популярные; сортировки «новые» и «топ» лежат рядом.
  const archive = { ...items };
  for (const [key, value] of Object.entries(sorts)) {
    if (value.favorites?.length) archive[key] = value.favorites;
  }

  fs.writeFileSync(OBOI_ITEMS_OUT, JSON.stringify({ items: archive, sorts }), 'utf8');

  const walls = Object.values(archive).reduce((sum, list) => sum + list.length, 0);
  console.log(`обои: ${categories.length - 1} подборок, ${walls} картинок → src/data/oboi.json + public/oboi.json`);
}

// ── фильмы по играм (kino/ основного сайта) ─────────────────────────
// Индекс хаба — карточки и две секции; по каждому фильму отдельный JSON
// с постером, фактами, сюжетом, актёрами, трейлером и интересными фактами.
if (fs.existsSync(KINO_HUB)) {
  const decode = (value) => String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  const text = (value) => decode(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

  const hub = fs.readFileSync(KINO_HUB, 'utf8');
  const updated = (hub.match(/обновлено\s+(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
  const items = [];

  // Режем хаб по заголовкам секций и разбираем карточки в каждой.
  const chunks = hub.split(/<div class="section-header">/).slice(1);
  for (const chunk of chunks) {
    const heading = text((chunk.match(/^([\s\S]*?)<\/div>/) || [])[1]);
    const section = heading.includes('Скоро') ? 'upcoming' : heading.includes('вышли') ? 'released' : '';
    if (!section) continue;
    const body = chunk.split(/<div class="section-header">/)[0];

    const cardRe = /<article class="mv-card">([\s\S]*?)<\/article>/g;
    let card;
    while ((card = cardRe.exec(body))) {
      const block = card[1];
      const href = (block.match(/<a class="mv-poster" href="([^"]+)"/)
        || block.match(/<b><a href="([^"]+)"/) || [])[1] || '';
      const title = text((block.match(/<b><a href="[^"]+">([\s\S]*?)<\/a><\/b>/) || [])[1]);
      const date = text((block.match(/<small>([\s\S]*?)<\/small>/) || [])[1]);
      const overview = text((block.match(/<p>([\s\S]*?)<\/p>/) || [])[1]);
      const poster = (block.match(/<img src="([^"]+)"/) || [])[1] || '';
      const slug = (href.split('/').pop() || '').replace(/\.html$/, '');
      const id = (slug.match(/-(\d+)$/) || [])[1] || slug;
      if (!slug || !title) continue;
      items.push({ id, slug, title, date, poster, overview, section, genres: '', rating: '' });
    }
  }

  fs.mkdirSync(MOVIE_DETAILS, { recursive: true });
  for (const movie of items) {
    const file = path.join(KINO_DIR, `${movie.slug}.html`);
    if (!fs.existsSync(file)) continue;
    const page = fs.readFileSync(file, 'utf8');

    const sectionHtml = (name) => {
      const re = new RegExp(`<h2>${name}</h2>([\\s\\S]*?)(?=<h2>|<a class="mv-back"|$)`, 'i');
      return (page.match(re) || [])[1] || '';
    };

    const tagline = text((page.match(/<p class="mv-film-tagline">([\s\S]*?)<\/p>/) || [])[1]).replace(/^«|»$/g, '');
    const poster = (page.match(/<div class="mv-film-poster"><img src="([^"]+)"/) || [])[1] || movie.poster;
    const overview = text((page.match(/<p class="mv-film-overview">([\s\S]*?)<\/p>/) || [])[1]) || movie.overview;
    const factsHtml = (page.match(/<div class="mv-facts">([\s\S]*?)<\/div>/) || [])[1] || '';
    const facts = Array.from(factsHtml.matchAll(/<span>([\s\S]*?)<\/span>/g))
      .map((match) => text(match[1]))
      .filter(Boolean);
    const trailer = (page.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]+)/) || [])[1] || '';
    const plot = text(sectionHtml('Сюжет'));
    const factsList = Array.from(sectionHtml('Факты о фильме').matchAll(/<li>([\s\S]*?)<\/li>/g))
      .map((match) => text(match[1]))
      .filter(Boolean);
    const trivia = Array.from(sectionHtml('Интересные факты').matchAll(/<li>([\s\S]*?)<\/li>/g))
      .map((match) => text(match[1]))
      .filter(Boolean);
    const cast = Array.from(sectionHtml('В ролях').matchAll(/<div><b>([\s\S]*?)<\/b>([\s\S]*?)<\/div>/g))
      .map((match) => ({ name: text(match[1]), role: text(match[2]) }))
      .filter((person) => person.name);

    movie.genres = (facts.find((fact) => /^Жанры:/i.test(fact)) || '').replace(/^Жанры:\s*/i, '');
    movie.rating = (facts.find((fact) => /^Рейтинг:/i.test(fact)) || '').replace(/^Рейтинг:\s*/i, '');

    fs.writeFileSync(path.join(MOVIE_DETAILS, `${movie.id}.json`), JSON.stringify({
      id: movie.id,
      slug: movie.slug,
      title: movie.title,
      section: movie.section,
      date: movie.date,
      tagline,
      poster,
      overview,
      facts,
      plot,
      factsList,
      cast,
      trivia,
      trailer,
      updated,
    }), 'utf8');
  }

  const sections = [
    { key: 'upcoming', label: 'Скоро на экранах' },
    { key: 'released', label: 'Уже вышли' },
  ].map((section) => ({
    ...section,
    count: items.filter((movie) => movie.section === section.key).length,
  }));

  fs.writeFileSync(MOVIES_OUT, JSON.stringify({ updated, sections, items }), 'utf8');
  console.log(`фильмы: ${items.length} экранизаций → src/data/movies.json + public/movies/`);
}
