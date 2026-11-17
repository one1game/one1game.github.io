// Снимок раздела ИИ: новости, рейтинг моделей, инструменты и бесплатные ИИ.
// Источники (без ключей): whatstrending.ai и g4f-working. Перевод — gtx (best effort).
// Запуск: npm run ai
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../src/data/ai.json');
const API = 'https://whatstrending.ai';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; One1Game/1.0)' };

const CATS = {
  Industry: 'Индустрия',
  Tools: 'Инструменты',
  Research: 'Исследования',
  Startups: 'Стартапы',
  Regulation: 'Регулирование',
  Models: 'Модели',
  'Open Source': 'Опенсорс',
};

const PRICING = { free: 'Бесплатно', freemium: 'Freemium', paid: 'Платно' };

const TOOL_CATS = {
  coding: 'Кодинг',
  writing: 'Текст',
  image: 'Изображения',
  images: 'Изображения',
  video: 'Видео',
  audio: 'Аудио',
  voice: 'Голос',
  music: 'Музыка',
  design: 'Дизайн',
  productivity: 'Продуктивность',
  research: 'Исследования',
  agents: 'Агенты',
  data: 'Данные',
  analytics: 'Аналитика',
  marketing: 'Маркетинг',
  chat: 'Чаты',
  chatbots: 'Чат-боты',
  search: 'Поиск',
  presentation: 'Презентации',
  automation: 'Автоматизация',
  'open-source': 'Опенсорс',
  other: 'Другое',
};

const TYPES = { text: 'текст', image: 'изображения', audio: 'аудио', video: 'видео' };

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

async function api(pathname) {
  const res = await fetch(API + pathname, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${pathname}: ${res.status}`);
  const json = await res.json();
  if (json && json.success === false) throw new Error(json.error || pathname);
  return json && json.success === undefined ? json : json.data;
}

async function translate(text) {
  const clean = String(text || '').trim();
  if (!clean || /^[\d\s.,:%$/+-]+$/.test(clean)) return clean;
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=' +
    encodeURIComponent(clean);
  // gtx иногда отвечает пустотой или обрывает соединение — пробуем дважды,
  // иначе в ленте остаются английские абзацы.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        const out = Array.isArray(json?.[0]) ? json[0].map((p) => p?.[0] || '').join('') : '';
        if (out.trim()) return out.trim();
      }
    } catch {
      // следующая попытка
    }
  }
  return clean;
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        out[idx] = await fn(list[idx], idx);
      }
    }),
  );
  return out;
}

const clamp = (text, max) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

const isoDate = (raw) => {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

// Даты новостей — по UTC: так они совпадают с датой публикации источника.
const ruDate = (raw) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

console.log('1/5 новости…');
const rawNews = (await api('/api/articles?limit=24&offset=0')).slice(0, 24);
const news = await mapLimit(rawNews, 5, async (a) => ({
  slug: a.slug,
  title: await translate(clamp(a.title, 120)),
  summary: await translate(clamp(a.summary, 320)),
  source: a.source || 'AI',
  category: a.category || 'AI',
  categoryRu: CATS[a.category] || a.category || 'ИИ',
  dateISO: isoDate(a.date),
  dateLabel: ruDate(a.date),
  link: a.link || '',
}));

console.log('2/5 модели…');
const models = (await api('/api/models?limit=12')).slice(0, 12).map((m) => ({
  rank: m.rank,
  name: m.name,
  provider: m.provider,
  score: m.score,
  scoreDisplay: m.scoreDisplay,
  tokens: m.tokens,
  requests: m.requests,
  pricing: m.pricing,
  context: m.context,
  category: m.category,
  categoryRu: CATS[m.category] || m.category,
  change: m.change,
  or: m.or,
}));

console.log('3/5 инструменты…');
const toolsRaw = (await api('/api/awesome-data')).tools || [];
const tools = await mapLimit(toolsRaw.slice(0, 36), 5, async (t) => ({
  name: t.name,
  tagline: await translate(clamp(t.tagline, 110)),
  url: t.url,
  category: t.category || '',
  categoryRu: TOOL_CATS[String(t.category).toLowerCase()] || t.category || 'ИИ',
  pricing: PRICING[String(t.pricing).toLowerCase()] || t.pricing || '',
}));

console.log('4/5 бесплатные ИИ…');
let free = [];
for (const base of [
  'https://raw.githubusercontent.com/Free-AI-Things/g4f-working/main/working/',
  'https://raw.githubusercontent.com/maruf009sultan/g4f-working/refs/heads/main/working/',
]) {
  try {
    const res = await fetch(`${base}working_results.txt`, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!res.ok) continue;
    const text = await res.text();
    free = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('|'))
      .filter((parts) => parts.length >= 3)
      .map((parts) => ({
        provider: parts[0].trim(),
        model: parts[1].trim(),
        type: parts[2].trim(),
        typeRu: TYPES[parts[2].trim().toLowerCase()] || parts[2].trim(),
      }));
    if (free.length) break;
  } catch {
    // пробуем следующее зеркало
  }
}
const seen = new Set();
free = free.filter((row) => {
  const key = `${row.provider}|${row.model}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
free.sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));

console.log('5/5 самое читаемое…');
let mostRead = [];
try {
  const raw = (await api('/api/most-read')).slice(0, 8);
  const bySlug = new Map(news.map((n) => [n.slug, n]));
  mostRead = await mapLimit(raw, 4, async (x) => {
    const hit = bySlug.get(x.slug);
    if (hit) {
      return {
        slug: x.slug,
        views: Number(x.views) || 0,
        title: hit.title,
        source: hit.source,
        link: hit.link,
      };
    }
    // Популярные материалы могут быть старше нашей ленты — подтягиваем заголовок.
    try {
      const a = await api(`/api/articles/${encodeURIComponent(x.slug)}`);
      return {
        slug: x.slug,
        views: Number(x.views) || 0,
        title: await translate(clamp(a.title, 120)),
        source: a.source || '',
        link: a.link || '',
      };
    } catch {
      return {
        slug: x.slug,
        views: Number(x.views) || 0,
        title: x.slug.replace(/-/g, ' '),
        source: '',
        link: '',
      };
    }
  });
} catch {
  mostRead = [];
}

const now = new Date();
const data = {
  updatedISO: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  updatedLabel: `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  news,
  models,
  tools,
  free,
  mostRead,
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 1), 'utf8');
console.log(
  `готово: ${news.length} новостей, ${models.length} моделей, ${tools.length} инструментов, ${free.length} бесплатных ИИ, ${mostRead.length} в топе`,
);
