/**
 * Генератор страниц игр под шаблон one1game.github.io
 * Источники данных: SteamSpy (без ключа) + Steam Store API (без ключа)
 *
 * Результат: HTML-файлы в папку /archive/, полностью совпадающие по вёрстке,
 * мета-тегам и структурированным данным с обычными статьями сайта.
 *
 * Запуск: node scripts/generate-games.js
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  siteUrl: "https://one1game.github.io",
  // Сколько игр брать из "вечнозелёного" топа по игрокам (эти почти не меняются:
  // CS2, Dota 2, PUBG и т.д. — но полезны для стабильного трафика и обновления цен).
  steadyLimit: parseInt(process.env.STEADY_LIMIT || "15", 10),
  // Сколько брать из новинок/топ-продаж (эти реально меняются каждый день).
  freshLimit: parseInt(process.env.FRESH_LIMIT || "35", 10),
  archiveDir: process.env.ARCHIVE_DIR || "archive",
  delayMs: parseInt(process.env.DELAY_MS || "1500", 10),
  language: "russian",
  countryCode: "ru",
  // Категория страницы. Используемые на сайте: Аналитика, Мнение, Разработка,
  // Гайды, Технологии, Консоли, Тренды. "Обзоры" — новая, для карточек игр.
  categoryLabel: "Обзоры",
  categoryClass: "cat-reviews",
  gtagId: "G-SZYYDYEC6T",
  articlesDataPath: process.env.ARTICLES_DATA_PATH || "articles-data.js",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Один запрос отдаёт сразу и "Новинки", и "Топ продаж" — оба блока
// реально обновляются каждый день, в отличие от топа по игрокам.
async function getFreshAppIds(limit) {
  const data = await fetchJson(
    `https://store.steampowered.com/api/featuredcategories?cc=${CONFIG.countryCode}&l=${CONFIG.language}`
  );
  const pool = [
    ...(data.new_releases?.items || []),
    ...(data.top_sellers?.items || []),
  ]
    // type 0 = обычное приложение (игра). 1 = подписка, 2 = бандл —
    // у них нет отдельной страницы в appdetails, пропускаем.
    .filter((item) => item.type === 0)
    .map((item) => String(item.id));

  // Убираем дубликаты, сохраняя порядок первого появления
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

// Транслитерация для человекочитаемого URL (slug)
function slugify(text) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return text
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escAttr(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Рекламные блоки внутри статей игр ──
// Это часть шаблона buildPage, поэтому реклама автоматически появляется и у
// новых игр, и после недельного рефреша (страницы пересобираются тем же шаблоном).
const AD_VPS_URL = "https://my.adminvps.ru/aff.php?aff=31864";
const AD_GO_URL = `${CONFIG.siteUrl}/go/`;
const AD_BANNER_URL = "https://bosslike.ru/?ref=7248523";
const AD_BANNER = {
  src: "/img/baner/baner1.webp?v=3",
  alt: "Bosslike — накрутка подписчиков, лайков и просмотров",
  title: "Bosslike — накрутка подписчиков, лайков и просмотров",
};

// Компактный рекламный баннер внутри статьи
function adBannerHTML() {
  return `
      <a class="av-banner" href="${AD_BANNER_URL}" target="_blank" rel="noopener noreferrer" title="${AD_BANNER.title}">
        <span class="av-ad-label">реклама</span>
        <img src="${AD_BANNER.src}" alt="${AD_BANNER.alt}" loading="lazy" width="2272" height="464" />
      </a>`;
}

// Текстовая реклама AdminVPS
function adVpsHTML() {
  return `
      <a class="av-ad" href="${AD_VPS_URL}" target="_blank" rel="noopener noreferrer">
        <span class="av-ad-label">реклама</span>
        <span class="av-ad-header">
          <span class="av-ad-badge">выгодно</span>
          <span class="av-ad-title">VPS/VDS от 299 ₽/мес</span>
        </span>
        <span class="av-ad-desc">NVMe-диски, CPU до 5.0 ГГц, бесплатное администрирование. Для сайтов, ботов, Docker и AI.</span>
        <span class="av-ad-tags"><span class="av-ad-tag">NVMe</span><span class="av-ad-tag">24/7</span><span class="av-ad-tag">Мир</span></span>
        <span class="av-ad-cta">Попробовать AdminVPS</span>
      </a>`;
}

// Ненавязчивый призыв зайти в раздел мини-игр /go/
function adGoHTML() {
  return `
      <a class="av-ad av-ad--go" href="${AD_GO_URL}">
        <span class="av-ad-label">наши игры</span>
        <span class="av-ad-header"><span class="av-ad-title">Мини-игры — играй прямо в браузере</span></span>
        <span class="av-ad-desc">Быстрые игры без установки и регистрации. Пара кликов — и ты в деле.</span>
        <span class="av-ad-cta">Играть бесплатно →</span>
      </a>`;
}

// true, если в строке есть кириллица (чтобы не мешать EN/RU в тексте страницы)
function hasRu(v) {
  return /[а-яё]/i.test(String(v || ""));
}

function formatOwners(ownersStr) {
  return ownersStr ? ownersStr.replace(/\.\./g, "–") : "нет данных";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function buildExcerpt({ title, price, positiveRatio, owners }) {
  const ratingPart =
    positiveRatio !== null ? `${positiveRatio}% положительных отзывов в Steam` : "рейтинг обновляется";
  return `${title}: актуальная цена (${price}), ${ratingPart}, статистика владельцев (${owners}). Данные обновляются автоматически.`;
}

function todayRuFull() {
  const d = new Date();
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Блок «Потянет ли слабый ноутбук?»: официальные требования Steam + ссылки на
// кластер страниц про слабое железо. Он должен собираться прямо в шаблоне, иначе
// при обновлении данных страницы его потеряют.
function lowEndBlock(store) {
  const reqHtml = String((store && store.pc_requirements && store.pc_requirements.minimum) || "");
  const items = [...reqHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  const parts = (items.length ? items : reqHtml ? [reqHtml] : [])
    .map((s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const req = parts.join(" · ").slice(0, 400);
  return `<!--LOWEND:START-->
      <section class="lowend-block" style="margin:26px 0;padding:16px 18px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.03)">
        <h2 style="margin:0 0 10px;font-size:1.15rem">Потянет ли слабый ноутбук?</h2>
        ${req ? `<p><strong>Минимальные требования (Steam):</strong> ${req}</p>` : ""}
        <p>Ориентир для ноутбука без дискретной видеокарты — 720p и низкие настройки. Готовые подборки: <a href="/igry-bez-videokarty.html">игры без видеокарты</a>, <a href="/igry-dlya-slabyh-noutbukov-4gb-ozu.html">игры на 4 ГБ ОЗУ</a>, <a href="/besplatnye-igry-dlya-slabyh-pk.html">бесплатные игры для слабых ПК</a>. Как поднять FPS — в <a href="/archive/igry-dlya-slabyh-noutbukov-2026.html">полном гиде по слабым ноутбукам</a>.</p>
      </section>
<!--LOWEND:END-->
`;
}

function buildPage({ appid, slug, store, spy, entry }) {
  const title = store.name;
  // Если запись обогащена ИИ — используем её заголовок/описание/интро,
  // чтобы рефреш данных НЕ затирал тексты под людей и поисковики.
  const custom = !!(entry && entry.ai);
  const displayTitle =
    custom && entry.title ? entry.title : `${title}: цена, отзывы и статистика игроков`;
  const pageTitle = `${displayTitle} | One1Game`;
  const metaDesc =
    custom && entry.excerpt
      ? entry.excerpt
      : `${title} — актуальная цена, скидки, процент положительных отзывов и статистика игроков в Steam. Обновляется автоматически.`;
  const intro = custom && entry.ai_intro ? String(entry.ai_intro) : "";
  const url = `${CONFIG.siteUrl}/${CONFIG.archiveDir}/${slug}.html`;

  const isFree = store.is_free;
  const price = isFree
    ? "Бесплатно"
    : store.price_overview
    ? `${(store.price_overview.final / 100).toFixed(2)} ${store.price_overview.currency}`
    : "нет данных";
  const discountNote = store.price_overview?.discount_percent
    ? ` (скидка ${store.price_overview.discount_percent}%)`
    : "";
  const releaseDate = store.release_date?.date || "неизвестно";
  const genres = store.genres?.map((g) => g.description).join(", ") || "не указаны";
  const developers = store.developers?.join(", ") || "не указаны";
  const publishers = store.publishers?.join(", ") || "не указаны";
  const positiveRatio =
    spy.positive && spy.negative
      ? Math.round((spy.positive / (spy.positive + spy.negative)) * 100)
      : null;
  const totalReviews = (spy.positive || 0) + (spy.negative || 0);
  const owners = formatOwners(spy.owners);
  const headerImg = store.header_image || `${CONFIG.siteUrl}/og-image.jpg`;
  const shortDesc = (store.short_description || "").replace(/"/g, "'");
  const about = custom && entry.ai_about ? String(entry.ai_about) : "";
  // Показываем официальное описание Steam только если оно на русском —
  // иначе страница будет в мешанине EN/RU.
  const shortRu = hasRu(shortDesc);

  // Медиа из Store API: скриншоты и видео геймплея
  const screenshots = Array.isArray(store.screenshots) ? store.screenshots : [];
  const movieItems = (Array.isArray(store.movies) ? store.movies : [])
    .map((mv) => ({
      hls: mv.hls_h264 || "",
      poster: mv.thumbnail || "",
      name: mv.name || "",
    }))
    .filter((m) => m.hls)
    .slice(0, 3);

  const shotsHTML = screenshots.length
    ? `
      <h2>Скриншоты</h2>
      <div class="game-shots">
${screenshots
  .slice(0, 12)
  .map(
    (s) =>
      `        <a class="game-shot" href="${escAttr(s.path_full)}" target="_blank" rel="noopener noreferrer"><img src="${escAttr(s.path_thumbnail)}" alt="${escAttr(title)} — скриншот" loading="lazy" decoding="async" width="600" height="337" /></a>`
  )
  .join("\n")}
      </div>`
    : "";

  const moviesHTML = movieItems.length
    ? `
      <h2>Геймплей</h2>
      <div class="game-movies">
${movieItems
  .map(
    (m) =>
      `        <figure class="game-movie"><div class="game-video" data-hls="${escAttr(m.hls)}"${m.poster ? ` data-poster="${escAttr(m.poster)}"` : ""} role="button" tabindex="0" aria-label="Смотреть геймплей">${m.poster ? `<img src="${escAttr(m.poster)}" alt="" loading="lazy" width="480" height="270" />` : ""}<span class="game-video-play" aria-hidden="true"></span></div>${hasRu(m.name) ? `<figcaption>${escAttr(m.name)}</figcaption>` : ""}</figure>`
  )
  .join("\n")}
      </div>`
    : "";

  const moviesScript = movieItems.length
    ? '<script defer src="/game-media.js?v=1"></script>\n'
    : "";

  // Схема VideoGame собирается как объект и сериализуется — так JSON всегда валиден
  // (раньше при наличии цены, но без рейтинга оставалась висячая запятая).
  const videoGameLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: title,
    genre: genres,
    operatingSystem: "Windows",
    applicationCategory: "Game",
  };
  if (!isFree && store.price_overview) {
    videoGameLd.offers = {
      "@type": "Offer",
      price: (store.price_overview.final / 100).toFixed(2),
      priceCurrency: store.price_overview.currency,
    };
  }
  if (positiveRatio !== null) {
    videoGameLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(Math.round(positiveRatio / 20)),
      bestRating: "5",
      ratingCount: String(totalReviews),
    };
  }

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
  <meta name="robots" content="index, follow, max-image-preview:large" />

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
  <link rel="stylesheet" href="/styles.css?v=31" />

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
    "image": "${headerImg}",
    "inLanguage": "ru-RU",
    "isAccessibleForFree": true,
    "articleSection": "Обзоры",
    "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", ".article-body p:first-of-type"]}
  }
  </script>

  <script type="application/ld+json">
${JSON.stringify(videoGameLd, null, 2)}
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
    .game-shots {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px; margin: 20px 0;
    }
    .game-shot {
      display: block; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; overflow: hidden;
    }
    .game-shot img { display: block; width: 100%; height: auto; }
    .game-movies { display: grid; gap: 16px; margin: 20px 0; }
    .game-movie { margin: 0; }
    .game-video {
      position: relative; cursor: pointer; overflow: hidden;
      border-radius: 8px; background: #000; aspect-ratio: 16 / 9;
    }
    .game-video img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .game-video-play { position: absolute; inset: 0; display: grid; place-items: center; }
    .game-video-play::before {
      content: ''; width: 58px; height: 58px; border-radius: 50%;
      background: rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.75);
    }
    .game-video-play::after {
      content: ''; position: absolute; margin-left: 5px;
      border-style: solid; border-width: 11px 0 11px 18px;
      border-color: transparent transparent transparent #fff;
    }
    .game-video-el { display: block; width: 100%; height: 100%; background: #000; }
    .game-movie figcaption { margin-top: 6px; font-size: 13px; color: var(--text-faint); }

    /* Рекламные блоки внутри статьи (самодостаточные стили — не зависят от кэша styles.css) */
    .av-ad {
      display: block; margin: 26px 0; padding: 16px 18px; position: relative;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.10);
      border-radius: 10px; text-decoration: none; color: inherit;
      transition: border-color 0.2s, background 0.2s;
    }
    .av-ad:hover { border-color: rgba(125,255,155,0.45); background: rgba(125,255,155,0.05); }
    .av-ad--go { border-color: rgba(125,255,155,0.30); }
    .av-ad-label {
      display: block; margin-bottom: 8px;
      font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #6b7480;
    }
    .av-ad-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .av-ad-badge {
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      color: #ffc061; border: 1px solid rgba(255,192,97,0.35); padding: 1px 6px; border-radius: 3px;
    }
    .av-ad-title { display: block; font-size: 15px; font-weight: 700; color: #fff; }
    .av-ad-desc { display: block; font-size: 13px; color: #aab2bd; line-height: 1.55; margin-bottom: 12px; }
    .av-ad-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .av-ad-tag { font-size: 10px; color: #6b7480; border: 1px solid rgba(255,255,255,0.12); padding: 1px 6px; border-radius: 3px; }
    .av-ad-cta {
      display: inline-block; padding: 8px 14px; border-radius: 6px;
      background: #ffc061; color: #1a1200;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    }
    .av-ad--go .av-ad-cta { background: #7dff9b; }
    .av-banner {
      display: block; position: relative; max-width: 560px; margin: 26px auto;
      border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; overflow: hidden;
      transition: border-color 0.2s;
    }
    .av-banner:hover { border-color: rgba(125,255,155,0.45); }
    .av-banner img {
      display: block; width: 100%; height: auto;
      filter: grayscale(0.8) contrast(1.1) brightness(0.82); transition: filter 0.3s;
    }
    .av-banner:hover img { filter: grayscale(0.1) contrast(1.05) brightness(1); }
    .av-banner .av-ad-label {
      position: absolute; top: 8px; left: 10px; z-index: 2; margin: 0;
      padding: 1px 6px; background: rgba(4,6,10,0.75); border-radius: 3px;
    }
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
      <h1>${displayTitle}</h1>
      <div class="article-meta">
        <span><i class="far fa-calendar"></i> ${todayRuFull()}</span>
        <span><i class="far fa-clock"></i> 2 минуты чтения</span>
      </div>
    </div>

    <article class="article-body">

      ${intro ? `<p>${intro}</p>\n\n      ` : ""}${shortRu ? `<p>${shortDesc}</p>` : ""}

      <div class="game-stats-grid">
        <div class="game-stat-card">
          <div class="label">Цена</div>
          <div class="value">${price}${discountNote}</div>
        </div>
        <div class="game-stat-card">
          <div class="label">Дата выхода</div>
          <div class="value">${releaseDate}</div>
        </div>
        ${positiveRatio !== null ? `<div class="game-stat-card">
          <div class="label">Положительных отзывов</div>
          <div class="value">${positiveRatio}%</div>
        </div>` : ""}
        <div class="game-stat-card">
          <div class="label">Владельцев (оценка)</div>
          <div class="value">${owners}</div>
        </div>
      </div>
${adBannerHTML()}
      <h2>Об игре</h2>
      ${about ? `<p>${about}</p>\n\n      ` : ""}<p><strong>Жанры:</strong> ${genres}<br/>
      <strong>Разработчик:</strong> ${developers}<br/>
      <strong>Издатель:</strong> ${publishers}</p>
${adVpsHTML()}
      <p>
        <a href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noopener">
          Страница игры в Steam →
        </a>
      </p>
${shotsHTML}
${moviesHTML}
${lowEndBlock(store)}
      <p style="color: var(--text-faint); font-size: 13px; margin-top: 30px;">
        Данные о цене, отзывах и статистике обновляются автоматически на основе
        Steam Store API и SteamSpy.
      </p>
${adGoHTML()}
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
${moviesScript}</body>
</html>
`;
}

async function main() {
  const archiveDir = path.resolve(process.cwd(), CONFIG.archiveDir);
  fs.mkdirSync(archiveDir, { recursive: true });

  // Существующие ИИ-записи (url → entry): их тексты нельзя перезаписывать,
  // даже если игра снова попала в топ и её страница пересобирается.
  const existingAiByUrl = {};
  try {
    const vm = require("vm");
    const dataPath = path.resolve(process.cwd(), CONFIG.articlesDataPath);
    if (fs.existsSync(dataPath)) {
      const sandbox = { window: {} };
      vm.createContext(sandbox);
      vm.runInContext(fs.readFileSync(dataPath, "utf-8"), sandbox);
      for (const e of sandbox.window.allArticles || []) {
        if (e.ai && e.url) existingAiByUrl[e.url] = e;
      }
    }
  } catch (e) {
    console.warn("[внимание] не удалось прочитать существующие записи:", e.message);
  }

  console.log(`Получаю топ-${CONFIG.steadyLimit} игр по игрокам (SteamSpy)...`);
  const steadyIds = await getTopGames(CONFIG.steadyLimit);

  console.log(`Получаю новинки и топ продаж (Steam featuredcategories)...`);
  const freshIds = await getFreshAppIds(CONFIG.freshLimit);

  // Объединяем и убираем дубликаты (игра может быть и в топе игроков, и в новинках)
  const appIds = [...new Set([...steadyIds, ...freshIds])];

  console.log(
    `Всего к обработке: ${appIds.length} игр ` +
      `(${steadyIds.length} из топа игроков, ${freshIds.length} из новинок/продаж, пересечения убраны).`
  );

  const newEntries = [];
  let created = 0;
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
      const aiEntry = existingAiByUrl[`/${CONFIG.archiveDir}/${slug}.html`];
      const html = buildPage({ appid, slug, store, spy, entry: aiEntry });
      fs.writeFileSync(path.join(archiveDir, `${slug}.html`), html, "utf-8");

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
        updated: todayISO(),
        // Обложка: официальный Steam header из Store API (URL с хешем ассета).
        // Без него карточка уйдёт на процедурный плейсхолдер.
        image: store.header_image || "",
      });

      console.log(`  [ок] ${appid} — ${store.name}`);
      created++;
    } catch (err) {
      console.error(`  [ошибка] ${appid}: ${err.message}`);
      skipped++;
    }
  }

  updateArticlesData(newEntries);

  console.log(`\nГотово. Создано страниц: ${created}, пропущено: ${skipped}.`);
}

// Безопасно вставляем новые записи в начало window.allArticles внутри
// реального articles-data.js. Файл реально выполняется в песочнице (vm),
// а не парсится регулярками — так формат не ломается при любых пробелах/кавычках.
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

// ── Cloudflare Workers AI: генерация SEO-текста (бесплатный тир) ──
// Ключи только из окружения: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN.
const CF_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT || "";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
// Основная — не-reasoning (быстро, без «размышлений», полный ответ).
// Запасная — llama-3.3-70b-fast. Reasoning-модели (gpt-oss/nemotron/qwen3)
// тратят весь max_tokens на размышления и возвращают пустой content.
const CF_MODELS = [
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
];

async function cfChat(prompt) {
  let lastErr = null;
  for (const model of CF_MODELS) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1400,
          }),
        }
      );
      if (!res.ok) {
        lastErr = new Error(`${model}: HTTP ${res.status}`);
        continue;
      }
      const j = await res.json();
      const r = j.result || {};
      const txt =
        r.response ||
        (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) ||
        "";
      if (txt) return txt;
      lastErr = new Error(`${model}: пустой ответ`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Cloudflare AI недоступен");
}

// ── Другие бесплатные провайдеры: Gemini и Groq ──
// Cloudflare упирается в 10 000 neurons/сутки на весь аккаунт (игры + фильмы),
// поэтому основным делаем Gemini, затем Groq, а Cloudflare оставляем на подхвате.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Провайдеры регулярно снимают модели с обслуживания: Gemini 2.0/2.5 и Groq
// llama-3.3 уже отдают 404. Поэтому спрашиваем актуальный список моделей у самих
// API, а статический список держим только как резерв на случай сбоя запроса.
const GEMINI_FALLBACK = [
  process.env.GEMINI_MODEL,
  "gemini-3.6-flash",
  "gemini-2.5-flash-latest",
  "gemini-2.5-flash",
].filter(Boolean);
const GROQ_FALLBACK = [
  process.env.GROQ_MODEL,
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-20b",
].filter(Boolean);

let geminiModelsCache = null;
async function resolveGeminiModels() {
  if (geminiModelsCache) return geminiModelsCache;
  geminiModelsCache = GEMINI_FALLBACK;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_API_KEY)}&pageSize=200`
    );
    if (res.ok) {
      const j = await res.json();
      const ids = (j.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter(
          (id) =>
            /gemini/.test(id) &&
            /(flash|pro)/.test(id) &&
            !/(embedding|aqa|image|tts|live|learnlm|robotics|computer|preview)/.test(id)
        );
      if (ids.length) {
        // Сначала flash (быстрее и дешевле), затем самые свежие версии.
        const score = (id) => {
          const ver = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
          return (/flash/.test(id) ? 100 : 0) + ver * 10;
        };
        geminiModelsCache = ids.sort((a, b) => score(b) - score(a));
        console.log(`  [модель] Gemini: ${geminiModelsCache[0]}`);
      }
    }
  } catch (e) {
    // не удалось получить список — работаем на резервных именах
  }
  return geminiModelsCache;
}

let groqModelCache = null;
async function resolveGroqModel() {
  if (groqModelCache) return groqModelCache;
  groqModelCache = GROQ_FALLBACK[0] || "openai/gpt-oss-120b";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    });
    if (res.ok) {
      const j = await res.json();
      const ids = (j.data || []).map((m) => m.id);
      const pick =
        GROQ_FALLBACK.find((m) => ids.includes(m)) || ids.find((id) => /gpt-oss|qwen|llama/.test(id));
      if (pick) {
        groqModelCache = pick;
        console.log(`  [модель] Groq: ${pick}`);
      }
    }
  } catch (e) {
    // не удалось получить список — работаем на резервном имени
  }
  return groqModelCache;
}

async function geminiChat(prompt) {
  let lastErr = null;
  const models = (await resolveGeminiModels()).slice(0, 3);
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );
    if (res.ok) {
      const j = await res.json();
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const txt = parts.map((p) => p.text || "").join("").trim();
      if (txt) return txt;
      lastErr = new Error(`gemini ${model}: пустой ответ`);
      continue;
    }
    const e = apiError(`gemini ${model}`, res);
    // 404 = этой модели больше нет, есть смысл взять следующую.
    // 429/5xx — общие для всей квоты и сервиса: перебор моделей только жжёт лимит.
    if (res.status !== 404) throw e;
    lastErr = e;
  }
  throw lastErr || new Error("Gemini недоступен");
}

async function groqChat(prompt) {
  const model = await resolveGroqModel();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      // gpt-oss сначала «думает» и тратит на это весь max_tokens, оставляя content
      // пустым. Просим минимум рассуждений и даём запас по токенам.
      reasoning_effort: "low",
      max_tokens: 4096,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw apiError(`groq ${model}`, res);
  const j = await res.json();
  const txt =
    (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  if (!txt) throw new Error(`groq ${model}: пустой ответ`);
  return txt;
}

// Порядок: Gemini → Groq → Cloudflare. Отвечает первый доступный.
function aiProviders() {
  const list = [];
  if (GEMINI_API_KEY) list.push(["Gemini", geminiChat]);
  if (GROQ_API_KEY) list.push(["Groq", groqChat]);
  if (CF_ACCOUNT_ID && CF_API_TOKEN) list.push(["Cloudflare", cfChat]);
  return list;
}

// Предохранитель: если провайдер подряд не отвечает (кончилась квота и т.п.),
// отключаем его до конца прогона и работаем остальными. Иначе на каждой странице
// будет тратиться лишний неудачный запрос в уже исчерпанный сервис.
const providerFails = new Map();
const PROVIDER_FAIL_LIMIT = 3;

// 429 — это чаще всего временный лимит (запросов в минуту), а не «провайдер мёртв»:
// такое не считаем в предохранитель, а ждём и идём дальше. Но если 429 сыпятся
// подряд — значит кончилась суточная квота, тогда отключаем провайдера до конца прогона.
const providerRateLimits = new Map();
const PROVIDER_RATE_LIMIT = 5;

// Бесплатные тиры Gemini — 10-15 запросов в минуту. Без паузы на 150 страницах
// гарантированно ловим 429 и теряем время, поэтому держим интервал между запросами.
const AI_MIN_INTERVAL_MS = parseInt(process.env.AI_MIN_INTERVAL_MS || "7000", 10);
let lastAiCallAt = 0;
async function aiPace() {
  const wait = lastAiCallAt + AI_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastAiCallAt = Date.now();
}

// 404 — «этой модели больше нет»: есть смысл попробовать другую.
// 429 — временный лимит: ждём и идём дальше, провайдера не отключаем.
// 5xx — сервис перегружен: тоже не приговор, просто ждём и пробуем снова.
function apiError(name, res) {
  const e = new Error(`${name}: HTTP ${res.status}`);
  if (res.status === 429) {
    e.rateLimited = true;
    const ra = parseFloat(res.headers.get("retry-after") || "");
    // Ждём не больше минуты, иначе прогон растянется.
    e.retryAfter = Math.min(Number.isFinite(ra) ? ra * 1000 : 20000, 60000);
  } else if (res.status >= 500) {
    e.transient = true;
  }
  return e;
}

async function aiChat(prompt) {
  const all = aiProviders();
  if (!all.length) throw new Error("не задан ни один ИИ-ключ");
  const list = all.filter(([name]) => (providerFails.get(name) || 0) < PROVIDER_FAIL_LIMIT);
  if (!list.length) throw new Error("все ИИ-провайдеры исчерпаны");
  let lastErr = null;
  for (const [name, fn] of list) {
    await aiPace();
    try {
      const txt = await fn(prompt);
      providerFails.set(name, 0);
      providerRateLimits.set(name, 0);
      return txt;
    } catch (e) {
      lastErr = e;
      if (e.rateLimited) {
        const n = (providerRateLimits.get(name) || 0) + 1;
        providerRateLimits.set(name, n);
        console.warn(
          `  [лимит] ${name}: 429, пауза ${Math.round(e.retryAfter / 1000)} с (${n}/${PROVIDER_RATE_LIMIT})`
        );
        if (n >= PROVIDER_RATE_LIMIT) providerFails.set(name, PROVIDER_FAIL_LIMIT);
        else await sleep(e.retryAfter);
      } else if (e.transient) {
        console.warn(`  [сбой] ${name}: ${e.message}`);
        await sleep(3000);
      } else {
        providerFails.set(name, (providerFails.get(name) || 0) + 1);
        console.warn(`  [ai] ${name}: ${e.message}`);
      }
    }
  }
  throw lastErr || new Error("все ИИ-провайдеры недоступны");
}

function aiPrompt(d, strict) {
  return `Ты SEO-редактор игрового портала One1Game (русскоязычный сайт-обзорник, НЕ магазин).
Ниже данные игры из Steam. Сделай уникальный человечный текст ТОЛЬКО на русском.
Правила:
- Весь ответ только на русском, без английских слов (кроме названия игры).
- Не выдумывай факты. Не упоминай цену, скидки, дату выхода, микротранзакции.
- Не пиши "купить/скачать" — это обзор. Интент: что за игра, жанр, кому подойдёт, стоит ли играть.
- Без воды и штампов.
- Верни СТРОГО JSON без markdown:
{"seo_title":"...","meta_description":"...","intro":"...","about":"..."}
- seo_title: строго до 60 символов, содержит название игры.
- meta_description: 120-155 символов.
- intro: 2-3 предложения, до 300 символов.
- about: 3-4 предложения, до 480 символов, по делу.
${strict ? "- ВНИМАНИЕ: прошлый ответ нарушил правила (англ. слова, цена или длина). Исправь.\n" : ""}
Данные Steam:
Название: ${d.name}
Жанры: ${d.genres}
Описание: ${d.short}`;
}

function aiParse(txt) {
  const m = String(txt || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}

function clampLen(s, max) {
  s = String(s || "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim();
}

function aiValid(obj, name) {
  if (!obj || !obj.seo_title || !obj.meta_description || !obj.intro) return false;
  const text = [obj.seo_title, obj.meta_description, obj.intro, obj.about || ""].join(" ");
  if (!/[а-яё]/i.test(text)) return false;
  if (/(купить|скачай|скачать|цена|рубл|скидк|микротранзакц)/i.test(text)) return false;
  // Латиница допустима только как название игры, жанровый термин или аббревиатура.
  // Иначе модель срывается в английский — такие ответы отбрасываем.
  const allowed = new Set(
    (String(name).toLowerCase().match(/[a-zа-яё0-9]+/g) || []).concat(["steam"])
  );
  const genreLatin = new Set([
    "rpg", "mmo", "mmorpg", "pvp", "pve", "pvpve", "fps", "tps", "rts", "moba",
    "coop", "co-op", "indie", "roguelike", "roguelite", "sandbox", "survival",
    "battle", "royale", "action", "adventure", "simulator", "strategy", "horror",
    "puzzle", "platformer", "quest", "arena", "openworld", "dlc", "bundle",
    "singleplayer", "multiplayer", "online", "hardcore", "casual", "soulslike",
  ]);
  const latin = text.match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [];
  for (const w of latin) {
    const lw = w.toLowerCase();
    if (allowed.has(lw) || genreLatin.has(lw)) continue;
    if (/^[A-Z]{2,6}$/.test(w)) continue; // аббревиатура жанра: RPG, PvP, FPS
    return false;
  }
  return true;
}

// ИИ-обогащение: обрабатывает первые N игровых записей без флага ai
// и сразу пересобирает их страницы (Steam + ИИ: Gemini → Groq → Cloudflare).
async function enrichAll() {
  if (!aiProviders().length) {
    console.warn(
      "[внимание] нет ни одного ИИ-ключа: задайте GEMINI_API_KEY, GROQ_API_KEY или CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN"
    );
    return;
  }
  const dataPath = path.resolve(process.cwd(), CONFIG.articlesDataPath);
  const archiveDir = path.resolve(process.cwd(), CONFIG.archiveDir);
  const vm = require("vm");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(dataPath, "utf-8"), sandbox);
  const arr = sandbox.window.allArticles || [];

  const isGame = (a) =>
    a.category === CONFIG.categoryLabel ||
    /:\s*цена, отзывы и статистика игроков\s*$/i.test(a.title || "");

  const limit = parseInt(process.env.ENRICH_LIMIT || "60", 10);
  console.log(`ИИ-провайдеры: ${aiProviders().map(([n]) => n).join(" → ")}`);
  const pending = arr.filter((a) => isGame(a) && !a.ai);
  const targets = pending.slice(0, limit);
  console.log(`ИИ-обогащение: ${targets.length} из ${pending.length} без ИИ`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const entry of targets) {
    const m = String(entry.url || "").match(/-(\d+)\.html$/);
    if (!m) {
      skip++;
      continue;
    }
    const appid = m[1];
    const slug = entry.url.split("/").pop().replace(/\.html$/, "");
    try {
      const store = await getStoreDetails(appid);
      await sleep(CONFIG.delayMs);
      if (!store) {
        skip++;
        console.log(`  [skip] ${appid}: нет данных Steam`);
        continue;
      }
      const d = {
        name: store.name || "",
        genres: (store.genres || []).map((g) => g.description).join(", ") || "не указаны",
        short: String(store.short_description || "").slice(0, 600),
      };

      let got = null;
      for (let attempt = 1; attempt <= 2 && !got; attempt++) {
        try {
          const obj = aiParse(await aiChat(aiPrompt(d, attempt > 1)));
          if (aiValid(obj, d.name)) got = obj;
        } catch (e) {
          console.error(`  [ai] ${appid}: ${e.message}`);
        }
        await sleep(600);
      }
      if (!got) {
        fail++;
        console.log(`  [skip] ${appid}: не прошло валидацию`);
        continue;
      }

      entry.title = clampLen(got.seo_title, 60);
      entry.excerpt = clampLen(got.meta_description, 155);
      entry.ai_intro = String(got.intro || "").trim();
      entry.ai_about = String(got.about || "").trim();
      entry.ai = true;
      entry.updated = todayISO();

      const spy = (await getSteamSpyDetails(appid)) || {};
      await sleep(CONFIG.delayMs);
      entry.image = store.header_image || entry.image || "";
      fs.writeFileSync(
        path.join(archiveDir, `${slug}.html`),
        buildPage({ appid, slug, store, spy, entry }),
        "utf-8"
      );
      ok++;
      console.log(`  [ок] ${appid} — ${d.name}`);
    } catch (e) {
      fail++;
      console.error(`  [ошибка] ${appid}: ${e.message}`);
    }
  }

  const output =
    `// articles-data.js\n` +
    `window.allArticles = ${JSON.stringify(arr, null, 2)};\n\n` +
    `window.articlesData = window.allArticles;\n`;
  fs.writeFileSync(dataPath, output, "utf-8");
  console.log(`\nИИ-обогащение завершено. Обогащено: ${ok}, пропущено: ${skip}, ошибок: ${fail}.`);
}

// ── Полный рефреш: обновляет «чувствительные» данные (цена, скидка, отзывы,
// владельцы, время, а также обложка/скриншоты/видео) у ВСЕХ игровых записей,
// а не только у текущего топа. Запускается недельным workflow (MODE=refresh).
async function refreshAll() {
  const dataPath = path.resolve(process.cwd(), CONFIG.articlesDataPath);
  const archiveDir = path.resolve(process.cwd(), CONFIG.archiveDir);
  if (!fs.existsSync(dataPath)) {
    console.warn(`[внимание] ${CONFIG.articlesDataPath} не найден`);
    return;
  }

  const vm = require("vm");
  const code = fs.readFileSync(dataPath, "utf-8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const arr = sandbox.window.allArticles || [];

  const isGame = (a) =>
    a.category === CONFIG.categoryLabel ||
    /:\s*цена, отзывы и статистика игроков\s*$/i.test(a.title || "");

  const games = arr.filter(isGame);
  // REFRESH_LIMIT>0 — обновить только первые N записей (для теста/отладки).
  const limit = parseInt(process.env.REFRESH_LIMIT || "0", 10);
  const list = limit > 0 ? games.slice(0, limit) : games;
  console.log(`Рефреш: игровых записей ${list.length} из ${games.length}`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const entry of list) {
    const m = String(entry.url || "").match(/-(\d+)\.html$/);
    if (!m) {
      skip++;
      continue;
    }
    const appid = m[1];
    const slug = entry.url.split("/").pop().replace(/\.html$/, "");
    try {
      const store = await getStoreDetails(appid);
      await sleep(CONFIG.delayMs);
      if (!store) {
        skip++;
        continue;
      }
      const spy = await getSteamSpyDetails(appid);
      await sleep(CONFIG.delayMs);

      const custom = entry.ai === true;
      fs.writeFileSync(
        path.join(archiveDir, `${slug}.html`),
        buildPage({ appid, slug, store, spy, entry }),
        "utf-8"
      );

      // Записи, обогащённые ИИ, сохраняют свой заголовок/описание.
      // Авто-заполнение применяем только к не-ИИ записям.
      if (!custom) {
        entry.title = `${store.name}: цена, отзывы и статистика игроков`;
        entry.excerpt = buildExcerpt({
          title: store.name,
          price: isFreePrice(store),
          positiveRatio: getPositiveRatio(spy),
          owners: formatOwners(spy.owners),
        });
      }
      entry.image = store.header_image || "";
      entry.updated = todayISO();
      ok++;
      console.log(`  [ок] ${appid} — ${store.name}`);
    } catch (err) {
      fail++;
      console.error(`  [ошибка] ${appid}: ${err.message}`);
    }
  }

  const output =
    `// articles-data.js\n` +
    `window.allArticles = ${JSON.stringify(arr, null, 2)};\n\n` +
    `window.articlesData = window.allArticles;\n`;
  fs.writeFileSync(dataPath, output, "utf-8");

  console.log(`\nРефреш завершён. Обновлено: ${ok}, пропущено: ${skip}, ошибок: ${fail}.`);
}

if (process.env.MODE === "refresh") {
  refreshAll().catch((err) => {
    console.error("Критическая ошибка рефреша:", err);
    process.exit(1);
  });
} else if (process.env.MODE === "enrich") {
  enrichAll().catch((err) => {
    console.error("Критическая ошибка ИИ-обогащения:", err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("Критическая ошибка:", err);
    process.exit(1);
  });
}
