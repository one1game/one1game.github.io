/**
 * Генератор + патчер страниц игр под шаблон one1game.github.io
 * Источники данных: SteamSpy (без ключа) + Steam Store API (без ключа)
 *
 * Логика:
 * - Новая игра (нет файла) → генерирует полную HTML-страницу с маркерами.
 * - Существующая игра (файл есть) → патчит только значения внутри маркеров
 *   <!-- STAT:... -->, не трогая остальной контент.
 *
 * Запуск: node scripts/generate-games.js
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  siteUrl: "https://one1game.github.io",
  steadyLimit: parseInt(process.env.STEADY_LIMIT || "15", 10),
  freshLimit: parseInt(process.env.FRESH_LIMIT || "35", 10),
  archiveDir: process.env.ARCHIVE_DIR || "archive",
  delayMs: parseInt(process.env.DELAY_MS || "1500", 10),
  language: "russian",
  countryCode: "ru",
  categoryLabel: "Во что поиграть?",
  categoryClass: "cat-play",
  gtagId: "G-SZYYDYEC6T",
  articlesDataPath: process.env.ARTICLES_DATA_PATH || "articles-data.js",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── API-запросы ───────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; One1GameBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  return res.json();
}

async function getTopGames(limit) {
  const data = await fetchJson("https://steamspy.com/api.php?request=top100in2weeks");
  return Object.keys(data).slice(0, limit);
}

async function getFreshAppIds(limit) {
  const data = await fetchJson(
    `https://store.steampowered.com/api/featuredcategories?cc=${CONFIG.countryCode}&l=${CONFIG.language}`
  );
  const pool = [
    ...(data.new_releases?.items || []),
    ...(data.top_sellers?.items || []),
  ]
    .filter((item) => item.type === 0)
    .map((item) => String(item.id));
  const unique = [...new Set(pool)];
  return unique.slice(0, limit);
}

async function getSteamSpyDetails(appid) {
  return fetchJson(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`);
}

async function getStoreDetails(appid) {
  const data = await fetchJson(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=${CONFIG.language}&cc=${CONFIG.countryCode}`
  );
  const entry = data[appid];
  return entry && entry.success ? entry.data : null;
}

// ─── Вспомогательные функции ────────────────────────────────────────────────

function slugify(text) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return text
    .toLowerCase().split("").map((ch) => map[ch] ?? ch).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatOwners(ownersStr) {
  return ownersStr ? ownersStr.replace(/\.\./g, "–") : "нет данных";
}

function formatPlaytime(minutes) {
  if (!minutes) return "нет данных";
  return `${Math.round(minutes / 60)} ч.`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function todayRuFull() {
  const d = new Date();
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isFreePrice(store) {
  if (store.is_free) return "Бесплатно";
  if (store.price_overview) {
    return `${(store.price_overview.final / 100).toFixed(2)} ${store.price_overview.currency}`;
  }
  return "цена не указана";
}

function getPositiveRatio(spy) {
  if (spy.positive && spy.negative) {
    return Math.round((spy.positive / (spy.positive + spy.negative)) * 100);
  }
  return null;
}

function formatReviews(spy) {
  return ((spy.positive || 0) + (spy.negative || 0)).toLocaleString("ru-RU");
}

function buildExcerpt({ title, price, positiveRatio, owners }) {
  const ratingPart =
    positiveRatio !== null ? `${positiveRatio}% положительных отзывов в Steam` : "рейтинг обновляется";
  return `${title}: актуальная цена (${price}), ${ratingPart}, статистика владельцев (${owners}). Данные обновляются автоматически.`;
}

// ─── Сборка данных для патча ────────────────────────────────────────────────

function buildStatsData({ store, spy }) {
  const isFree = store.is_free;
  const priceStr = isFree
    ? "Бесплатно"
    : store.price_overview
    ? `${(store.price_overview.final / 100).toFixed(2)} ${store.price_overview.currency}`
    : "нет данных";
  const discountPercent = store.price_overview?.discount_percent || 0;
  const releaseDate = store.release_date?.date || "неизвестно";
  const positiveRatio = getPositiveRatio(spy);
  const totalReviews = formatReviews(spy);
  const owners = formatOwners(spy.owners);
  const avgPlaytime = formatPlaytime(spy.average_forever);

  return {
    price: discountPercent > 0 ? `${priceStr} (скидка ${discountPercent}%)` : priceStr,
    releaseDate,
    positiveRatio: positiveRatio !== null ? `${positiveRatio}%` : "обновляется",
    totalReviews,
    owners,
    playtime: avgPlaytime,
    updated: todayRuFull(),
  };
}

// ─── Патч существующей страницы ─────────────────────────────────────────────
// Заменяет значения между маркерами <!-- STAT:KEY -->...<!-- /STAT:KEY -->
// и обновляет дату в футере "Последнее обновление:"

function patchPage(filePath, stats) {
  let html = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  const markers = [
    { key: "PRICE",        value: stats.price },
    { key: "RELEASE_DATE", value: stats.releaseDate },
    { key: "POSITIVE",     value: stats.positiveRatio },
    { key: "REVIEWS",      value: stats.totalReviews },
    { key: "OWNERS",       value: stats.owners },
    { key: "PLAYTIME",     value: stats.playtime },
    { key: "UPDATED",      value: stats.updated },
  ];

  for (const { key, value } of markers) {
    const regex = new RegExp(
      `<!-- STAT:${key} -->[\\s\\S]*?<!-- /STAT:${key} -->`,
      "g"
    );
    const replacement = `<!-- STAT:${key} -->${value}<!-- /STAT:${key} -->`;
    if (html.match(regex)) {
      html = html.replace(regex, replacement);
      modified = true;
    }
  }

  // Обновляем текст "Последнее обновление: ..." в футере
  const updatedRegex = /(Последнее обновление:\s*)([^\n<]+)/;
  const updatedMatch = html.match(updatedRegex);
  if (updatedMatch) {
    html = html.replace(updatedRegex, `$1${stats.updated}`);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, html, "utf-8");
    return "updated";
  }
  return "no-change";
}

// ─── Генерация новой страницы (только если файла нет) ───────────────────────

function buildPage({ appid, slug, store, spy }) {
  const title = store.name;
  const pageTitle = `${title}: цена, отзывы и статистика игроков | One1Game`;
  const metaDesc = `${title} — актуальная цена, скидки, процент положительных отзывов и статистика игроков в Steam. Обновляется автоматически.`;
  const url = `${CONFIG.siteUrl}/${CONFIG.archiveDir}/${slug}.html`;

  const stats = buildStatsData({ store, spy });

  const genres = store.genres?.map((g) => g.description).join(", ") || "не указаны";
  const developers = store.developers?.join(", ") || "не указаны";
  const publishers = store.publishers?.join(", ") || "не указаны";
  const headerImg = store.header_image || `${CONFIG.siteUrl}/og-image.jpg`;
  const shortDesc = (store.short_description || "").replace(/"/g, "'");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
   <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
  <link rel="dns-prefetch" href="https://www.google-analytics.com" />
  <link rel="preload" href="../styles.css" as="style" />

  <title>${pageTitle}</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="keywords" content="${title}, цена, отзывы, скидка, статистика игроков, Steam" />

  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${headerImg}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${headerImg}" />
  <meta name="robots" content="index, follow" />

  <script async src="https://www.googletagmanager.com/gtag/js?id=${CONFIG.gtagId}"></script>
  <script>
    window.gaEnabled = false;
    function enableGA() {
      if (window.gaEnabled) return;
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', '${CONFIG.gtagId}', { anonymize_ip: true });
      window.gaEnabled = true;
    }
    if (localStorage.getItem('ga_consent') === 'yes') enableGA();
  </script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?v=7" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Главная", "item": "${CONFIG.siteUrl}/"},
      {"@type": "ListItem", "position": 2, "name": "Статьи", "item": "${CONFIG.siteUrl}/archive.html"},
      {"@type": "ListItem", "position": 3, "name": "${title}", "item": "${url}"}
    ]
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${pageTitle}",
    "datePublished": "${todayISO()}",
    "dateModified": "${todayISO()}",
    "author": {"@type": "Person", "name": "Команда One1Game"},
    "publisher": {"@type": "Organization", "name": "One1Game", "logo": {"@type": "ImageObject", "url": "${CONFIG.siteUrl}/logo.png"}},
    "description": "${metaDesc}",
    "image": "${headerImg}"
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "${title}",
    "genre": "${genres}",
    "operatingSystem": "Windows",
    "applicationCategory": "Game",
    ${!store.is_free && store.price_overview ? `"offers": {
      "@type": "Offer",
      "price": "${(store.price_overview.final / 100).toFixed(2)}",
      "priceCurrency": "${store.price_overview.currency}"
    },` : ""}
    ${getPositiveRatio(spy) !== null ? `"aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "${Math.round(getPositiveRatio(spy) / 20)}",
      "bestRating": "5",
      "ratingCount": "${(spy.positive || 0) + (spy.negative || 0)}"
    }` : ""}
  }
  </script>

  <link rel="manifest" href="/manifest.json" />
  <link rel="stylesheet" href="/reactions.css" />

  <style>
    .skip-link {
      position: absolute; top: -40px; left: 0; background: var(--cyan);
      color: #000; padding: 8px 16px; z-index: 1000; text-decoration: none;
      font-weight: bold; transition: top 0.2s;
    }
    .skip-link:focus { top: 0; }
    .article-header { margin-bottom: 30px; }
    .article-meta { color: #888; font-size: 14px; }
    .article-body p { line-height: 1.8; margin-bottom: 20px; }
    .breadcrumbs { margin-bottom: 18px; font-size: 13px; color: var(--text-faint); }
    .breadcrumbs a { color: var(--cyan); text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; }
    .breadcrumbs span { color: var(--text-dim); }
    .game-stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px; margin: 24px 0;
    }
    .game-stat-card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 14px 16px;
    }
    .game-stat-card .label { font-size: 12px; color: var(--text-faint); text-transform: uppercase; }
    .game-stat-card .value { font-size: 20px; font-weight: bold; margin-top: 4px; }
  </style>
</head>
<body>
<a href="#main-content" class="skip-link">Перейти к содержимому</a>
<main id="main-content">
<div class="container">
  <div class="article-page">

    <a href="/archive.html" class="article-back">
      <i class="fas fa-arrow-left"></i> К списку статей
    </a>

    <nav class="breadcrumbs" aria-label="Хлебные крошки" itemscope itemtype="https://schema.org/BreadcrumbList">
      <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <a itemprop="item" href="/"><span itemprop="name">Главная</span></a>
        <meta itemprop="position" content="1" />
      </span> →
      <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <a itemprop="item" href="/archive.html"><span itemprop="name">Статьи</span></a>
        <meta itemprop="position" content="2" />
      </span> →
      <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <span itemprop="name" aria-current="page">${title}</span>
        <meta itemprop="position" content="3" />
      </span>
    </nav>

    <div class="article-header">
      <span class="article-category ${CONFIG.categoryClass}">${CONFIG.categoryLabel}</span>
      <h1>${title}: цена, отзывы и статистика игроков</h1>
      <div class="article-meta">
        <span><i class="far fa-calendar"></i> <!-- STAT:UPDATED -->${stats.updated}<!-- /STAT:UPDATED --></span>
        <span><i class="far fa-clock"></i> 2 минуты чтения</span>
      </div>
    </div>

    <article class="article-body">

      <p>${shortDesc}</p>

      <!-- ★ Сетка со статистикой. Маркеры <!-- STAT:KEY -->...<!-- /STAT:KEY -->
           автоматически обновляются при ежедневном запуске.
           ВСЁ ОСТАЛЬНОЕ на странице (текст, SEO-теги, схемы) НЕ трогается. -->
      <div class="game-stats-grid">
        <div class="game-stat-card">
          <div class="label">Цена</div>
          <div class="value"><!-- STAT:PRICE -->${stats.price}<!-- /STAT:PRICE --></div>
        </div>
        <div class="game-stat-card">
          <div class="label">Дата выхода</div>
          <div class="value"><!-- STAT:RELEASE_DATE -->${stats.releaseDate}<!-- /STAT:RELEASE_DATE --></div>
        </div>
        <div class="game-stat-card">
          <div class="label">Положительных отзывов</div>
          <div class="value"><!-- STAT:POSITIVE -->${stats.positiveRatio}<!-- /STAT:POSITIVE --></div>
        </div>
        <div class="game-stat-card">
          <div class="label">Всего отзывов</div>
          <div class="value"><!-- STAT:REVIEWS -->${stats.totalReviews}<!-- /STAT:REVIEWS --></div>
        </div>
        <div class="game-stat-card">
          <div class="label">Владельцев (оценка)</div>
          <div class="value"><!-- STAT:OWNERS -->${stats.owners}<!-- /STAT:OWNERS --></div>
        </div>
        <div class="game-stat-card">
          <div class="label">Среднее время игры</div>
          <div class="value"><!-- STAT:PLAYTIME -->${stats.playtime}<!-- /STAT:PLAYTIME --></div>
        </div>
      </div>

      <h2>Об игре</h2>
      <p><strong>Жанры:</strong> ${genres}<br/>
      <strong>Разработчик:</strong> ${developers}<br/>
      <strong>Издатель:</strong> ${publishers}</p>

      <p>
        <a href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noopener">
          Страница игры в Steam →
        </a>
      </p>

      <p style="color: var(--text-faint); font-size: 13px; margin-top: 30px;">
        Данные о цене, отзывах и статистике обновляются автоматически на основе
        Steam Store API и SteamSpy. Последнее обновление: <!-- STAT:UPDATED -->${stats.updated}<!-- /STAT:UPDATED -->.
      </p>

<div class="newsletter-box">
  <h4>📬 Получайте такие разборы раз в неделю</h4>
  <p>Аналитика индустрии, редкие цифры и мнения, о которых не пишут в крупных СМИ. Без спама — только по делу.</p>
  <form class="newsletter-form">
    <input type="email" placeholder="your@email.com" required aria-label="Ваш email" />
    <button type="submit">Подписаться</button>
  </form>
  <div class="newsletter-msg"></div>
</div>

    </article>

<div id="reactions-section"></div>

    <section class="share-section">
      <h4>Поделиться</h4>
      <p class="share-hint">Понравилась статья? Отправь другу — пусть тоже будет в курсе!</p>
      <div class="share-buttons" id="share-buttons"></div>
    </section>

    <section class="related-section">
      <h4>Похожие статьи</h4>
      <div class="related-grid" id="related-container"></div></section>
    <section class="comments-section">
      <h4><i class="fas fa-comments" aria-hidden="true"></i> Комментарии</h4>
      <div class="comments-container" id="comments-container">
        <script src="https://utteranc.es/client.js"
                repo="one1game/one1game.github.io"
                issue-term="pathname"
                label="комментарии"
                theme="github-dark"
                crossorigin="anonymous"
                async>
        </script>
      </div>
    </section>

  </div>
</div>

</main>

<script src="/cache-version.js"></script>
<script>document.write('<script src="/articles-data.js?v='+(window.CACHE_VER||'1')+'"><\\/script>');</script>
<script>
(function() {
  var path = window.location.pathname;
  var currentUrl = path.replace(/^\\/+/, '/');
  var all = window.articlesData || [];

  var url = encodeURIComponent('${CONFIG.siteUrl}' + currentUrl);
  var title = encodeURIComponent(document.title);
  var shareEl = document.getElementById('share-buttons');
  shareEl.innerHTML = [
    '<a target="_blank" rel="noopener" class="share-btn" href="https://vk.com/share.php?url=' + url + '&title=' + title + '">VK</a>',
    '<a target="_blank" rel="noopener" class="share-btn" href="https://t.me/share/url?url=' + url + '&text=' + title + '">Telegram</a>',
    '<a target="_blank" rel="noopener" class="share-btn" href="https://twitter.com/intent/tweet?url=' + url + '&text=' + title + '">Twitter</a>',
    '<a target="_blank" rel="noopener" class="share-btn" href="https://api.whatsapp.com/send?text=' + title + '%20' + url + '">WhatsApp</a>'
  ].join('');

  var related = all.filter(function(a) { return a.url !== currentUrl; }).slice(0, 4);
  var relEl = document.getElementById('related-container');
  relEl.innerHTML = related.map(function(a) {
    return '<a href="' + a.url + '" class="related-card"><strong>' + a.title + '</strong><span>' + (a.date || '') + '</span></a>';
  }).join('');
})();
</script>
<script src="/components.js" defer></script>
<script src="/reactions.js" defer></script>
<div class="cookie-banner" id="cookie-banner" role="dialog" aria-live="polite" aria-label="Согласие на использование cookies">
  <p>Мы используем cookies для аналитики и улучшения сайта. Подробнее — в <a href="/privacy.html">политике конфиденциальности</a>.</p>
  <div class="cookie-buttons">
    <button class="cookie-btn primary" onclick="acceptCookies()">Принять</button>
    <button class="cookie-btn secondary" onclick="declineCookies()">Только необходимые</button>
  </div>
</div>

<script>
function acceptCookies() {
  localStorage.setItem('ga_consent', 'yes');
  if (typeof enableGA === 'function') enableGA();
  document.getElementById('cookie-banner').classList.remove('show');
}
function declineCookies() {
  localStorage.setItem('ga_consent', 'no');
  document.getElementById('cookie-banner').classList.remove('show');
}
(function() {
  if (!localStorage.getItem('ga_consent')) {
    setTimeout(function() {
      document.getElementById('cookie-banner').classList.add('show');
    }, 1500);
  }
})();
</script>
<script src="/newsletter.js?v=2" defer></script>
</body>
</html>
`;
}

// ─── Главный цикл ───────────────────────────────────────────────────────────

async function main() {
  const archiveDir = path.resolve(process.cwd(), CONFIG.archiveDir);
  fs.mkdirSync(archiveDir, { recursive: true });

  console.log(`Получаю топ-${CONFIG.steadyLimit} игр по игрокам (SteamSpy)...`);
  const steadyIds = await getTopGames(CONFIG.steadyLimit);

  console.log(`Получаю новинки и топ продаж (Steam featuredcategories)...`);
  const freshIds = await getFreshAppIds(CONFIG.freshLimit);

  const appIds = [...new Set([...steadyIds, ...freshIds])];

  console.log(
    `Всего к обработке: ${appIds.length} игр ` +
      `(${steadyIds.length} из топа игроков, ${freshIds.length} из новинок/продаж).`
  );

  const newEntries = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const appid of appIds) {
    try {
      const store = await getStoreDetails(appid);
      await sleep(CONFIG.delayMs);
      if (!store) {
        console.log(`  [пропуск] ${appid}: нет данных в Store API`);
        skipped++;
        continue;
      }

      const spy = await getSteamSpyDetails(appid);
      await sleep(CONFIG.delayMs);

      const slug = `${slugify(store.name)}-${appid}`;
      const filePath = path.join(archiveDir, `${slug}.html`);
      const stats = buildStatsData({ store, spy });

      if (fs.existsSync(filePath)) {
        // Страница уже существует — только патчим данные
        const result = patchPage(filePath, stats);
        if (result === "updated") {
          console.log(`  [обновлено] ${appid} — ${store.name} (данные обновлены)`);
          updated++;
        } else {
          console.log(`  [без изменений] ${appid} — ${store.name} (маркеры не найдены, пропущено)`);
          skipped++;
          continue;
        }
      } else {
        // Новая игра — генерируем страницу целиком
        const html = buildPage({ appid, slug, store, spy });
        fs.writeFileSync(filePath, html, "utf-8");
        console.log(`  [создано] ${appid} — ${store.name}`);
        created++;
      }

      newEntries.push({
        url: `/${CONFIG.archiveDir}/${slug}.html`,
        title: `${store.name}: цена, отзывы и статистика игроков`,
        excerpt: buildExcerpt({
          title: store.name,
          price: isFreePrice(store),
          positiveRatio: getPositiveRatio(spy),
          owners: formatOwners(spy.owners),
        }),
        date: todayRuFull(),
        readTime: "2 мин",
        category: CONFIG.categoryLabel,
      });
    } catch (err) {
      console.error(`  [ошибка] ${appid}: ${err.message}`);
      skipped++;
    }
  }

  updateArticlesData(newEntries);

  console.log(`\nГотово. Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.`);
}

// ─── Обновление articles-data.js ─────────────────────────────────────────────

function updateArticlesData(newEntries) {
  if (newEntries.length === 0) return;

  const dataPath = path.resolve(process.cwd(), CONFIG.articlesDataPath);
  if (!fs.existsSync(dataPath)) {
    console.warn(`\n[внимание] ${CONFIG.articlesDataPath} не найден — пропускаю обновление архива.`);
    return;
  }

  const vm = require("vm");
  const code = fs.readFileSync(dataPath, "utf-8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const existing = sandbox.window.allArticles || [];
  const existingUrls = new Set(existing.map((a) => a.url));
  const toAdd = newEntries.filter((e) => !existingUrls.has(e.url));

  if (toAdd.length === 0) {
    console.log("\nВсе игры уже есть в articles-data.js, новых записей нет.");
    return;
  }

  const merged = [...toAdd, ...existing];

  const output =
    `// articles-data.js\n` +
    `window.allArticles = ${JSON.stringify(merged, null, 2)};\n\n` +
    `window.articlesData = window.allArticles;\n`;

  fs.writeFileSync(dataPath, output, "utf-8");
  console.log(`\nВ ${CONFIG.articlesDataPath} добавлено новых записей: ${toAdd.length}.`);
}

main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
