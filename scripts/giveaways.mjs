#!/usr/bin/env node
/**
 * Ежедневные «вечнозелёные» страницы:
 *   * besplatnye-igry.html — бесплатные раздачи игр (GamerPower API)
 *   * skidki-na-igry.html  — скидки на игры (CheapShark API, магазин Steam)
 *
 * Оба API бесплатные и без ключа. Если API недоступен — файл НЕ перезаписываем,
 * остаётся прошлая версия страницы (сайт не ломается).
 *
 * Запуск: node scripts/giveaways.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://one1game.org';
const UA = { 'User-Agent': 'One1GameBot/1.0 (+https://one1game.org)' };
const IMG_FALLBACK = `${SITE}/og-image.jpg`;

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const now = new Date();
const HUMAN_DATE = `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
const ISO_DATE = now.toISOString().slice(0, 10);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

async function getJSON(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/**
 * Машиночитаемая копия страницы: ИИ-агентам и скриптам проще забрать JSON,
 * чем разбирать HTML. Ссылки на эти файлы даны в llms.txt.
 */
function writeJsonFeed(file, payload) {
  mkdirSync('data', { recursive: true });
  writeFileSync(file, JSON.stringify(payload, null, 1), 'utf8');
}

/** Общая оболочка страницы: тот же хром сайта, что и везде. */
function render({ slug, title, description, h1, lead, cardsHtml, faq, sourceHtml, jsonld }) {
  const url = `${SITE}/${slug}`;
  const faqHtml = faq.map(([q, a]) => `
      <details class="faq-item">
        <summary>${esc(q)}</summary>
        <p>${esc(a)}</p>
      </details>`).join('');
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="One1Game" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${IMG_FALLBACK}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#06060c" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" onload="this.rel='stylesheet';this.removeAttribute('onload')" />
  <noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" /></noscript>
  <link rel="stylesheet" href="/styles.css?v=22" />
  <link rel="manifest" href="/manifest.json" />
  <script defer src="/analytics-consent.js?v=2"></script>
  <style>
    .deals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin: 18px 0; }
    .deal-card { background: #0d1320; border: 1px solid #1b2333; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; }
    .deal-card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; background: #111826; }
    .deal-card h2 { font-size: 1rem; margin: 10px 0 6px; }
    .deal-meta { color: #9fb0c7; font-size: .86rem; margin: 0 0 8px; }
    .deal-meta s { opacity: .7; }
    .deal-price { color: #7ee787; font-weight: 700; }
    .deal-card .btn { margin-top: auto; text-align: center; }
    .faq-item { background: #0d1320; border: 1px solid #1b2333; border-radius: 10px; padding: 10px 14px; margin: 8px 0; }
    .faq-item summary { cursor: pointer; font-weight: 600; }
    .faq-item p { margin: 8px 0 0; color: #c9d6e6; }
    .updated { color: #9fb0c7; font-size: .9rem; }
  </style>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
<main id="main-content">
<div class="container">
  <div class="page-content">
    <h1>${esc(h1)}</h1>
    <p class="updated">Обновлено: ${HUMAN_DATE}</p>
    ${lead}
    <div class="deals-grid">
${cardsHtml}
    </div>
    <h2>Частые вопросы</h2>${faqHtml}
    ${sourceHtml}
    <p><a href="/">← На главную</a> · <a href="/go/">Игры онлайн</a> · <a href="/archive.html">Все статьи</a></p>
  </div>
</div>
</main>
<script src="/components.js?v=35" defer></script>
</body>
</html>
`;
}

/** Бесплатные раздачи: GamerPower. */
async function buildGiveaways() {
  const data = await getJSON('https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity');
  const items = (Array.isArray(data) ? data : []).slice(0, 40);
  if (!items.length) throw new Error('GamerPower вернул пустой список');

  const cards = items.map((g) => {
    const worth = g.worth && g.worth !== 'N/A' ? `<s>${esc(g.worth)}</s> → ` : '';
    const until = g.end_date && g.end_date !== 'N/A' ? ` · до ${esc(g.end_date)}` : '';
    const desc = String(g.description || '').replace(/\s+/g, ' ').slice(0, 180);
    return `      <article class="deal-card">
        <img src="${esc(g.image || g.thumbnail || IMG_FALLBACK)}" alt="${esc(g.title)}" loading="lazy" width="320" height="180" />
        <h2>${esc(g.title)}</h2>
        <p class="deal-meta">${esc(g.platforms)} · ${worth}<span class="deal-price">бесплатно</span>${until}</p>
        <p class="deal-meta">${esc(desc)}${desc.length >= 180 ? '…' : ''}</p>
        <a class="btn" href="${esc(g.open_giveaway_url)}" rel="nofollow noopener" target="_blank">Забрать</a>
      </article>`;
  }).join('\n');

  const freeCount = items.filter((g) => /free/i.test(g.type || '')).length || items.length;
  const titles = items.slice(0, 6).map((g) => g.title);

  writeJsonFeed('data/giveaways.json', {
    updated: ISO_DATE,
    source: 'gamerpower.com',
    page: `${SITE}/besplatnye-igry.html`,
    count: items.length,
    items: items.map((g) => ({
      title: g.title,
      platforms: g.platforms,
      worth: g.worth,
      end_date: g.end_date,
      url: g.open_giveaway_url,
      description: String(g.description || '').replace(/\s+/g, ' ').slice(0, 300),
    })),
  });

  return render({
    slug: 'besplatnye-igry.html',
    title: `Бесплатные раздачи игр сегодня — ${HUMAN_DATE} | One1Game`,
    description: `Актуальные бесплатные раздачи игр в Steam, Epic Games Store, GOG и других магазинах. Обновляется каждый день. Сегодня в подборке ${items.length} предложений.`,
    h1: `Бесплатные раздачи игр — ${HUMAN_DATE}`,
    lead: `<p>Собрали всё, что сейчас можно забрать бесплатно: постоянные раздачи Epic Games Store, временно бесплатные игры в Steam, GOG, Amazon Prime Gaming и других магазинах. Список обновляется каждый день — заходите перед тем, как что-то покупать.</p>
    <p>Самое интересное сейчас: <strong>${esc(titles.join(', '))}</strong>.</p>`,
    cardsHtml: cards,
    faq: [
      ['Это действительно бесплатно?', 'Да. Раздачи проводят сами магазины, чтобы привлечь игроков: игры отдают без оплаты на время акции. Мы только собираем такие предложения в одном списке.'],
      ['Как забрать игру?', 'Нажмите кнопку «Забрать» — откроется страница магазина. Там нужно войти в аккаунт и нажать «Получить». Ключ или копия игры добавятся в вашу библиотеку.'],
      ['Как часто обновляется список?', 'Каждый день автоматически. Если акция закончилась, предложение исчезает, а новые появляются в начале списка.'],
      ['Игры остаются навсегда?', 'Зависит от акции: у Epic Games Store забранные игры остаются в библиотеке навсегда, у части подписочных акций (например, Prime Gaming) доступ сохраняется, пока активна подписка.'],
    ],
    sourceHtml: `<p class="updated">Источник данных: <a href="https://www.gamerpower.com" rel="nofollow noopener" target="_blank">GamerPower</a>. Мы не связаны с магазинами и не берём комиссию за переходы.</p>`,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Бесплатные раздачи игр — ${HUMAN_DATE}`,
      numberOfItems: items.length,
      itemListElement: items.slice(0, 25).map((g, i) => ({
        '@type': 'ListItem', position: i + 1, name: g.title, url: g.open_giveaway_url,
      })),
    },
  });
}

/** Скидки: CheapShark (магазин Steam). */
async function buildDeals() {
  const data = await getJSON('https://www.cheapshark.com/api/1.0/deals?storeID=1&sortBy=Savings&pageSize=40&upperPrice=60');
  const items = (Array.isArray(data) ? data : []).filter((d) => Number(d.savings) > 0).slice(0, 40);
  if (!items.length) throw new Error('CheapShark вернул пустой список');

  const deck = (s) => `${(Number(s) / 10).toFixed(1)}/10`;
  const cards = items.map((d) => {
    const sale = Number(d.salePrice);
    const normal = Number(d.normalPrice);
    const off = Math.round(Number(d.savings));
    return `      <article class="deal-card">
        <img src="${esc(d.thumb || IMG_FALLBACK)}" alt="${esc(d.title)}" loading="lazy" width="320" height="180" />
        <h2>${esc(d.title)}</h2>
        <p class="deal-meta">Скидка ${off}% · <s>$${normal.toFixed(2)}</s> → <span class="deal-price">$${sale.toFixed(2)}</span></p>
        <p class="deal-meta">Оценка Steam: ${esc(deck(d.dealRating))}${d.metacriticScore && d.metacriticScore !== '0' ? ` · Metacritic ${esc(d.metacriticScore)}` : ''}</p>
        <a class="btn" href="https://www.cheapshark.com/redirect?dealID=${esc(d.dealID)}" rel="nofollow noopener" target="_blank">Открыть в Steam</a>
      </article>`;
  }).join('\n');

  const best = items.slice(0, 3).map((d) => `${d.title} (−${Math.round(Number(d.savings))}%)`);
  const under5 = items.filter((d) => Number(d.salePrice) <= 5).length;

  writeJsonFeed('data/deals.json', {
    updated: ISO_DATE,
    source: 'cheapshark.com',
    page: `${SITE}/skidki-na-igry.html`,
    currency: 'USD',
    count: items.length,
    items: items.map((d) => ({
      title: d.title,
      salePrice: Number(d.salePrice),
      normalPrice: Number(d.normalPrice),
      savingsPercent: Math.round(Number(d.savings)),
      steamRating: Number(d.dealRating),
      url: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
    })),
  });

  return render({
    slug: 'skidki-na-igry.html',
    title: `Скидки на игры сегодня — ${HUMAN_DATE} | One1Game`,
    description: `Лучшие скидки на игры в Steam сегодня: до ${Math.round(Number(items[0].savings))}% дешевле, ${under5} игр дешевле $5. Список обновляется ежедневно.`,
    h1: `Скидки на игры — ${HUMAN_DATE}`,
    lead: `<p>Подборка лучших скидок Steam на сегодня: отсортировано по размеру скидки. Цены — в долларах США (Steam на странице игры показывает их в вашей валюте), рядом оценка игры, чтобы не купить мусор. Если ждали снижения цены на конкретную игру — скорее всего, она здесь.</p>
    <p>Максимальные скидки дня: <strong>${esc(best.join(', '))}</strong>.</p>`,
    cardsHtml: cards,
    faq: [
      ['В какой валюте цены?', 'В долларах США — так их отдаёт магазин. На странице игры в Steam цена автоматически пересчитается в вашу валюту по курсу магазина.'],
      ['Как часто обновляются скидки?', 'Страница пересобирается каждый день. Цены могут меняться в течение дня — актуальную всегда видно в Steam после перехода.'],
      ['Почему скидки только из Steam?', 'Steam даёт самую большую базу и историю цен, поэтому подборка строится по нему. Другие магазины добавим, если будет спрос.'],
      ['Что такое «оценка Steam»?', 'Это агрегированный рейтинг отзывов покупателей по шкале от 0 до 10. Чем выше — тем охотнее игроки рекомендуют игру.'],
    ],
    sourceHtml: `<p class="updated">Источник данных: <a href="https://www.cheapshark.com" rel="nofollow noopener" target="_blank">CheapShark</a>. Партнёрских наценок нет: цена та же, что в Steam.</p>`,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Скидки на игры — ${HUMAN_DATE}`,
      numberOfItems: items.length,
      itemListElement: items.slice(0, 25).map((d, i) => ({
        '@type': 'ListItem', position: i + 1, name: d.title,
        url: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
      })),
    },
  });
}

async function run(name, builder, file) {
  try {
    const html = await builder();
    writeFileSync(file, html, 'utf8');
    console.log(`✓ ${file} (${html.length} байт)`);
    return true;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message} — оставляю прежнюю версию страницы`);
    return false;
  }
}

const ok1 = await run('GamerPower', buildGiveaways, 'besplatnye-igry.html');
const ok2 = await run('CheapShark', buildDeals, 'skidki-na-igry.html');
if (!ok1 && !ok2) {
  console.error('Оба источника недоступны — ничего не изменилось');
  process.exit(1);
}
