/* Генератор статических SEO-страниц для l2craft.
   Запуск: node l2craft/generate-seo.cjs
   Создаёт страницы крафта, заточки, категорий, статистики, API и sitemap. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const SITE = 'https://one1game.org';
const BASE = SITE + '/l2craft';
const UPDATED = '2026-10-19';
const OG_IMAGE = BASE + '/og-craft.png';

function loadWindow(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), ctx, { filename: file });
  return ctx.window;
}

const DATA = loadWindow('data.js').L2CRAFT;
const EN = loadWindow('enchant-data.js').L2CRAFT_ENCHANT;
const recipes = DATA.recipes;
const enchantItems = EN.items;

const byResultId = new Map(recipes.map(r => [r.result.id, r]));
const enchantById = new Map(enchantItems.map(i => [i.id, i]));

const GRADE_ORDER = ['NG', 'D', 'C', 'B', 'A', 'S'];
const TYPE_LABEL = { weapon: 'Оружие', armor: 'Броня', jewelry: 'Бижутерия', etcitem: 'Прочее' };
const TYPE_SLUG = { weapon: 'weapon', armor: 'armor', jewelry: 'jewelry' };

const nf = new Intl.NumberFormat('ru-RU');
const df = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const fmt = n => nf.format(n);
const fmtDec = n => df.format(n);

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function typeLabel(type) {
  return TYPE_LABEL[type] || 'Прочее';
}

function craftPath(r) {
  return `/l2craft/craft/${r.result.id}-${slug(r.result.name)}/`;
}

function enchantPath(item) {
  return `/l2craft/enchant/${item.id}-${slug(item.name)}/`;
}

function prefixFor(depth) {
  return depth <= 0 ? '' : '../'.repeat(depth);
}

function pOf(r) {
  return r.chance / 100;
}

function expectedAttempts(r) {
  return 1 / pOf(r);
}

function medianAttempts(r) {
  return Math.ceil(Math.log(0.5) / Math.log(1 - pOf(r)));
}

function attemptsFor95(r) {
  return Math.ceil(Math.log(0.05) / Math.log(1 - pOf(r)));
}

function materialSum(r) {
  return r.direct.reduce((sum, d) => sum + d.count, 0);
}

function fmtProb(value) {
  if (value >= 0.99995) return '100%';
  if (value < 0.00005) return '<0,01%';
  return (value * 100).toFixed(2).replace('.', ',') + '%';
}

function fmtChance(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
}

function attemptsWord(n) {
  if (n === 1) return 'попытка';
  if (n > 1 && n < 5) return 'попытки';
  if (!Number.isInteger(n)) return 'попыток';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'попытка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'попытки';
  return 'попыток';
}

function itemsWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'предмет';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'предмета';
  return 'предметов';
}

/* ---------- заточка ---------- */

function eChance(item, target) {
  const safe = item.fullArmor ? EN.rates.safeFull : EN.rates.safe;
  if (target <= safe) return 100;
  if (target > EN.rates.max) return 0;
  let key = item.type;
  if (item.type === 'weapon') key = item.magic ? 'weaponMagic' : 'weapon';
  else if (item.type === 'armor' && item.fullArmor) key = 'fullArmor';
  const table = EN.rates.normal[key] || EN.rates.normal.armor;
  return table[target] || 0;
}

function eCumulative(item, level) {
  let value = 1;
  for (let target = 1; target <= level; target++) value *= eChance(item, target) / 100;
  return value;
}

function eExpected(item, level) {
  let value = 0;
  for (let target = 1; target <= level; target++) {
    const p = eChance(item, target) / 100;
    if (!p) return Infinity;
    value += 1 / p;
  }
  return value;
}

function itemClass(item) {
  if (item.type === 'weapon') return item.magic ? 'Магическое оружие' : 'Физическое оружие';
  if (item.type === 'armor') return item.fullArmor ? 'Цельный доспех' : 'Часть доспеха';
  return 'Бижутерия';
}

function itemRatesText(item) {
  if (item.type === 'weapon') {
    return item.magic ? 'до +15 — 40%, на +16 — 20%' : 'до +15 — 70%, на +16 — 35%';
  }
  if (item.fullArmor) return '+4 — 100%, с +5 до +16 — 66,67%';
  return '66,67% на каждом шаге';
}

/* ---------- каркас страницы ---------- */

function jsonLdBlock(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function crumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Хлебные крошки">${items.map((entry, index) => {
    const label = esc(entry[0]);
    const url = entry[1];
    const last = index === items.length - 1;
    return (url && !last)
      ? `<a href="${esc(url)}">${label}</a>`
      : `<span${last ? ' aria-current="page"' : ''}>${label}</span>`;
  }).join('<span aria-hidden="true">›</span>')}</nav>`;
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry[0],
      ...(entry[1] ? { item: SITE + entry[1].replace(SITE, '') } : {})
    }))
  };
}

function topbar() {
  return `<header class="topbar seo-topbar">
  <a class="brand" href="${SITE}/" title="На главную One1Game">
    <span class="brand-mark" aria-hidden="true"></span>
    <span class="brand-text">one1game<span>.org</span></span>
  </a>
  <div class="seo-topbar-note">Lineage II · Interlude · L2OFF retail</div>
  <div class="top-stats" aria-label="База">
    <div><strong>179</strong><span>рецептов</span></div>
    <div><strong>150</strong><span>предметов</span></div>
    <div><strong>+16</strong><span>заточка</span></div>
  </div>
</header>
<nav class="topnav" aria-label="Навигация">
  <a href="${SITE}/">Главная</a>
  <a href="/l2craft/">L2 Craft</a>
  <a href="/l2craft/craft/">Крафт</a>
  <a href="/l2craft/craft/chance/60/">60%</a>
  <a href="/l2craft/craft/chance/70/">70%</a>
  <a href="/l2craft/craft/chance/25/">25%</a>
  <a href="/l2craft/enchant/">Заточка</a>
  <a href="/l2craft/guides/">Гайды</a>
  <a href="/l2craft/craft/stats/">Статистика</a>
  <a href="/l2craft/api/">API</a>
</nav>`;
}

function footer() {
  return `<footer class="footer">
  <div>
    <strong>Кузница шанса</strong> — фанатский симулятор крафта и заточки Lineage 2 Interlude.
    <div class="footer-links">
      <a href="/l2craft/">Симулятор</a>
      <a href="/l2craft/craft/">Все рецепты</a>
      <a href="/l2craft/enchant/">Заточка</a>
      <a href="/l2craft/guides/">Гайды</a>
      <a href="/l2craft/craft/stats/">Статистика</a>
      <a href="/l2craft/api/">JSON API</a>
      <a href="${SITE}/">One1Game</a>
    </div>
  </div>
  <div class="footer-meta">
    <span>Рецепты: Recipes.xml C6 Interlude</span>
    <span>Заточка: L2OFF retail</span>
    <span>Обновлено ${UPDATED}</span>
  </div>
</footer>`;
}

function page({ title, description, canonical, prefix, body, jsonLd = [], ogType = 'article' }) {
  const safeTitle = esc(title);
  const safeDescription = esc(description);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="ru" href="${esc(canonical)}">
<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
<meta property="og:locale" content="ru_RU">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="One1Game">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Крафт и заточка Lineage 2 Interlude">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta name="theme-color" content="#0b0907">
<link rel="icon" type="image/png" href="${prefix}icons/etc_recipe_black_i00.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Forum&family=PT+Serif:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}style.css">
${jsonLd.map(jsonLdBlock).join('\n')}
</head>
<body class="seo-page">
<div class="bg-glow" aria-hidden="true"></div>
<div class="noise" aria-hidden="true"></div>
${topbar()}
<main class="seo-wrap">
${body}
</main>
${footer()}
</body>
</html>
`;
}

/* ---------- общие блоки ---------- */

function materialCard(d, prefix, recipe) {
  const isRecipe = d.name.startsWith('Recipe:');
  return `<div class="material${isRecipe ? ' is-recipe' : ''}">
    <span class="item-icon"><img src="${prefix}${esc(d.icon)}" alt="${esc(d.name)}" width="32" height="32" loading="lazy"></span>
    <div class="material-name">${esc(d.name)}
      <span class="material-sub">${isRecipe ? 'расходуется за попытку' : 'на одну попытку'}</span>
    </div>
    <span class="material-count">×${fmt(d.count)}</span>
  </div>`;
}

function relatedRecipes(current, limit = 8) {
  const same = recipes.filter(r => r.id !== current.id && r.type === current.type && r.result.grade === current.result.grade);
  const rest = recipes.filter(r => r.id !== current.id && r.type === current.type && r.result.grade !== current.result.grade);
  return same.concat(rest)
    .sort((a, b) => b.chance - a.chance || a.result.name.localeCompare(b.result.name))
    .slice(0, limit);
}

function relatedCraftCards(current, prefix) {
  return relatedRecipes(current).map(r => `<a href="${craftPath(r)}">
    <img src="${prefix}${esc(r.icon)}" alt="${esc(r.result.name)}" width="28" height="28" loading="lazy">
    <span>${esc(r.result.name)} · ${r.chance}%</span>
  </a>`).join('');
}

function relatedEnchantCards(current, prefix) {
  const same = enchantItems.filter(i => i.id !== current.id && i.type === current.type && i.grade === current.grade);
  const rest = enchantItems.filter(i => i.id !== current.id && i.type === current.type && i.grade !== current.grade);
  return same.concat(rest).slice(0, 8).map(i => `<a href="${enchantPath(i)}">
    <img src="${prefix}${esc(i.icon)}" alt="${esc(i.name)}" width="28" height="28" loading="lazy">
    <span>${esc(i.name)} · ${esc(i.grade)}</span>
  </a>`).join('');
}

function itemLinks(list, pathFn, prefix, labelFn) {
  return list.map(item => `<a href="${pathFn(item)}">
    <img src="${prefix}${esc(item.icon)}" alt="${esc(item.name)}" width="28" height="28" loading="lazy">
    <span>${esc(labelFn ? labelFn(item) : item.name)}</span>
  </a>`).join('');
}

/* ---------- страница крафта ---------- */

function craftPage(r) {
  const prefix = prefixFor(2);
  const name = r.result.name;
  const grade = r.result.grade;
  const n95 = attemptsFor95(r);
  const expected = expectedAttempts(r);
  const median = medianAttempts(r);
  const totalMaterials = materialSum(r);
  const url = craftPath(r);
  const canonical = SITE + url;
  const enchantItem = enchantById.get(r.result.id);
  const quest = !r.direct.some(d => d.name.startsWith('Recipe:'));

  const title = `Крафт ${name} в Lineage 2 Interlude — шанс ${r.chance}% и материалы`;
  const description = `Крафт ${name} (${grade}) в Lineage 2 Interlude: шанс ${r.chance}%, Create Item ${r.craftLevel}, MP ${r.mp}. Материалы, ресурсы и калькулятор попыток.`;

  const baseRows = [...r.base]
    .sort((a, b) => b.count - a.count)
    .map(b => `<tr>
      <td><div class="res-item"><img src="${prefix}${esc(b.icon)}" alt="${esc(b.name)}" width="24" height="24" loading="lazy"><span>${esc(b.name)}</span></div></td>
      <td class="gold">${fmt(b.count)}</td>
      <td>${fmtDec(b.count / pOf(r))}</td>
      <td class="dim">${fmt(b.count * n95)}</td>
    </tr>`).join('');

  const attemptRows = [1, 5, 10, 25, 100].map(n => {
    const atLeast = 1 - Math.pow(1 - pOf(r), n);
    return `<tr>
      <td>${n}</td>
      <td class="gold">${fmt(totalMaterials * n)}</td>
      <td>${fmtDec(n * pOf(r))}</td>
      <td>${esc(fmtProb(atLeast))}</td>
    </tr>`;
  }).join('');

  const faq = [
    {
      q: `Какой шанс крафта ${name}?`,
      a: `Шанс успеха — ${r.chance}%. Это независимая попытка: каждый крафт не зависит от предыдущих.`
    },
    {
      q: `Сколько материалов нужно на ${name}?`,
      a: `На одну попытку нужно ${r.direct.length} позиций и ${fmt(totalMaterials)} ${itemsWord(totalMaterials)} суммарно. С промежуточными крафтами раскрывается ${r.base.length} видов базовых ресурсов.`
    },
    {
      q: `Сколько попыток в среднем нужно для крафта ${name}?`,
      a: `При шансе ${r.chance}% в среднем нужно ${fmtDec(expected)} попытки, медиана — ${median}, для 95% вероятности — ${n95} ${attemptsWord(n95)}.`
    },
    {
      q: `Расходуется ли рецепт ${name}?`,
      a: quest
        ? 'Нет, это квестовый рецепт: он изучается один раз и не расходуется при крафте.'
        : 'Да, рецепт расходуется при каждой попытке. При провале материалы и рецепт пропадают.'
    },
    {
      q: `Можно ли гарантированно скрафтить ${name}?`,
      a: `Нет. Шанс ${r.chance}% фиксирован и не растёт от количества попыток. Для 95% вероятности нужно ${n95} ${attemptsWord(n95)}, но абсолютной гарантии не существует.`
    }
  ];

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [name, url]])}
<article class="sheet seo-sheet grade-tone-${esc(grade)}">
  <header class="result-head">
    <div class="result-icon"><img src="${prefix}${esc(r.icon)}" alt="${esc(name)}" width="64" height="64" fetchpriority="high"></div>
    <div class="result-info">
      <div class="result-kicker">
        <span class="grade grade-${esc(grade)}">${esc(grade)}</span>
        <span>${esc(typeLabel(r.type))}</span>
        <span>ID ${r.result.id}</span>
      </div>
      <h1>Крафт ${esc(name)} в Lineage 2 Interlude</h1>
      <div class="recipe-name">${esc(r.recipeName)} · ${r.chance}% · Create Item ${r.craftLevel}</div>
      <div class="meta-chips">
        <span class="meta-chip">Шанс <b>${r.chance}%</b></span>
        <span class="meta-chip">Уровень крафта <b>${r.craftLevel}</b></span>
        <span class="meta-chip">MP <b>${fmt(r.mp)}</b></span>
        <span class="meta-chip">Выход <b>${fmt(r.resultCount)}</b></span>
        <span class="meta-chip">${esc(r.recipeType)} рецепт</span>
      </div>
    </div>
    <div class="chance-orb" data-chance="${r.chance}" style="--p:${r.chance}">
      <div class="chance-orb-inner"><strong>${r.chance}%</strong><small>шанс</small></div>
    </div>
  </header>

  <section class="panel">
    <div class="section-head"><h2>Рецепт и материалы</h2><span>на 1 попытку</span></div>
    <p>
      <strong>${esc(name)}</strong> — ${esc(typeLabel(r.type).toLowerCase())} ${esc(grade)}-грейда в Lineage 2 Interlude.
      Крафтится по рецепту <em>${esc(r.recipeName)}</em> с шансом <strong>${r.chance}%</strong>.
      Уровень Create Item — <strong>${r.craftLevel}</strong>, требуется <strong>${fmt(r.mp)} MP</strong>.
      ${quest
        ? 'Рецепт квестовый: изучается один раз и не расходуется.'
        : 'Рецепт расходуется при каждой попытке — как и материалы.'}
    </p>
    <div class="material-grid">${r.direct.map(d => materialCard(d, prefix, r)).join('')}</div>
    <p class="note">
      При провале теряются все материалы и рецепт (если он расходуемый). Каждая попытка независима:
      предыдущие успехи или провалы не меняют шанс следующей.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Сколько попыток и ресурсов</h2><span>математика шанса</span></div>
    <div class="formula">
      <div>Среднее число попыток: <b>${fmtDec(expected)}</b></div>
      <div>Медиана: <b>${median}</b> попыток</div>
      <div>95% шанс успеха: <b>${n95}</b> ${attemptsWord(n95)}</div>
      <div>Материалов на 95%: <b>${fmt(totalMaterials * n95)}</b> шт.</div>
    </div>
    <h3>Базовые ресурсы с промежуточными крафтами</h3>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>Материал</th><th>На 1 попытку</th><th>На 1 успех</th><th>На 95%</th></tr></thead>
        <tbody>${baseRows}</tbody>
      </table>
    </div>
    <p class="note">
      Колонка «на 95%» — сколько материалов нужно, чтобы с вероятностью 95% получить хотя бы один предмет.
      Расчёт предполагает независимые попытки и фиксированный шанс ${r.chance}%.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Материалы на разное число попыток</h2><span>без гарантии</span></div>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>Попыток</th><th>Материалов</th><th>Ожидаемо успехов</th><th>Шанс хотя бы одного</th></tr></thead>
        <tbody>${attemptRows}</tbody>
      </table>
    </div>
    <p class="note">
      Шанс не накапливается: даже после 10 провалов следующая попытка всё равно имеет ${r.chance}%.
      Таблица показывает только вероятность получить хотя бы один предмет за серию независимых попыток.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Как крафтить ${esc(name)}</h2><span>Create Item</span></div>
    <ol>
      <li>Соберите ${r.direct.length} позиций материалов: ${fmt(totalMaterials)} ${itemsWord(totalMaterials)} на одну попытку.</li>
      <li>Изучите рецепт <em>${esc(r.recipeName)}</em>. Для крафта нужен уровень Create Item ${r.craftLevel} и ${fmt(r.mp)} MP.</li>
      <li>Используйте умение Create Item. Шанс успеха — ${r.chance}%, каждая попытка независима.</li>
      <li>При успехе получите ${fmt(r.resultCount)} ${itemsWord(r.resultCount)} ${esc(name)}. При провале материалы и расходуемый рецепт пропадут.</li>
    </ol>
    <p>
      В симуляторе можно проверить серию попыток: одиночный крафт, ×10, ×100 или режим «До успеха».
      Статистика сохраняется в браузере и показывает фактический процент успеха.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Другие рецепты</h2><span>${esc(typeLabel(r.type))} · ${esc(grade)}</span></div>
    <div class="seo-related">${relatedCraftCards(r, prefix)}</div>
    <div class="seo-subnav">
      <a href="/l2craft/craft/">Все 179 рецептов</a>
      <a href="/l2craft/craft/chance/${r.chance}/">Рецепты ${r.chance}%</a>
      <a href="/l2craft/craft/grade/${grade.toLowerCase()}/">Крафт ${esc(grade)}-грейда</a>
      ${enchantItem ? `<a href="${enchantPath(enchantItem)}">Заточка ${esc(name)}</a>` : ''}
    </div>
  </section>

  <section class="panel seo-faq">
    <div class="section-head"><h2>Частые вопросы</h2><span>FAQ</span></div>
    ${faq.map(item => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('')}
  </section>

  <div class="seo-cta">
    <a class="craft-btn" href="/l2craft/">Открыть симулятор крафта</a>
    <span class="seo-cta-note">Можно крутить по одной попытке, пачками ×10/×100 или до первого успеха.</span>
  </div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' },
      primaryImageOfPage: { '@type': 'ImageObject', url: BASE + '/' + r.icon },
      author: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [name, url]]),
    {
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a }
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'article' }), url };
}

/* ---------- страница заточки ---------- */

function enchantPage(item) {
  const prefix = prefixFor(2);
  const name = item.name;
  const grade = item.grade;
  const safe = item.fullArmor ? EN.rates.safeFull : EN.rates.safe;
  const max = EN.rates.max;
  const url = enchantPath(item);
  const canonical = SITE + url;
  const recipe = byResultId.get(item.id);

  const rows = [];
  let cumulative = 1;
  for (let target = 1; target <= max; target++) {
    const chance = eChance(item, target);
    cumulative *= chance / 100;
    const isSafe = target <= safe;
    rows.push(`<tr class="${isSafe ? 'is-safe' : ''}">
      <td>+${target}</td>
      <td>${fmtChance(chance)}%</td>
      <td>${esc(fmtProb(cumulative))}</td>
      <td class="dim">${isSafe ? 'безопасно' : 'разрушение'}</td>
      <td class="dim">${isSafe ? 'безопасно' : 'сброс на +0'}</td>
    </tr>`);
  }

  const levels = [4, 7, 10, 16];
  const formulaCards = levels.map(level => {
    const chance = eCumulative(item, level);
    const scrolls = eExpected(item, level);
    return `<div>Дойти до <b>+${level}</b>: ${esc(fmtProb(chance))} · в среднем <b>${Number.isFinite(scrolls) ? fmtDec(scrolls) : '—'}</b> свитков</div>`;
  }).join('');

  const targetRows = levels.map(level => {
    const chance = eCumulative(item, level);
    const scrolls = eExpected(item, level);
    return `<tr>
      <td>+${level}</td>
      <td>${esc(fmtProb(chance))}</td>
      <td>${Number.isFinite(scrolls) ? fmtDec(scrolls) : '—'}</td>
      <td class="dim">${level <= safe ? 'безопасно' : 'разрушение / сброс'}</td>
    </tr>`;
  }).join('');

  const chance4 = eChance(item, 4);
  const stepText = itemRatesText(item);
  const title = `Заточка ${name} в Lineage 2 Interlude — шансы +4…+16`;
  const description = `Шансы заточки ${name} (${grade}, ${itemClass(item).toLowerCase()}) в Lineage 2 Interlude: ${stepText}. Safe +${safe}, максимум +${max}.`;

  const faq = [
    {
      q: `Какой шанс заточки ${name}?`,
      a: `Шанс шага: ${stepText}. На +4 — ${fmtChance(chance4)}%. Safe-уровень — +${safe}, максимум — +${max}.`
    },
    {
      q: `До какого уровня ${name} точится безопасно?`,
      a: `Безопасно до +${safe}${item.fullArmor ? ' (цельный доспех)' : ''}. Начиная с +${safe + 1} возможен провал.`
    },
    {
      q: `Что будет при провале заточки ${name}?`,
      a: 'Обычный свиток разрушает предмет. Благословенный свиток оставляет предмет, но сбрасывает заточку на +0. Шанс успеха у них одинаковый.'
    },
    {
      q: `Сколько свитков нужно, чтобы заточить ${name} до +10?`,
      a: `В среднем ${fmtDec(eExpected(item, 10))} свитков. Вероятность пройти путь без провала — ${fmtProb(eCumulative(item, 10))}.`
    },
    {
      q: `Влияет ли грейд ${name} на шанс заточки?`,
      a: `Нет. Шанс зависит от типа предмета: ${stepText}. Грейд влияет на свиток и стоимость предмета, но не на процент успеха.`
    },
    {
      q: `Можно ли заточить ${name} выше +${max}?`,
      a: `В L2OFF Interlude максимум — +${max}. В симуляторе заточка выше +${max} недоступна.`
    }
  ];

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [name, url]])}
<article class="sheet seo-sheet grade-tone-${esc(grade)}">
  <header class="result-head">
    <div class="result-icon"><img src="${prefix}${esc(item.icon)}" alt="${esc(name)}" width="64" height="64" fetchpriority="high"></div>
    <div class="result-info">
      <div class="result-kicker">
        <span class="grade grade-${esc(grade)}">${esc(grade)}</span>
        <span>${esc(typeLabel(item.type))}</span>
        <span>ID ${item.id}</span>
      </div>
      <h1>Заточка ${esc(name)} в Lineage 2 Interlude</h1>
      <div class="recipe-name">${esc(itemClass(item))} · safe +${safe} · максимум +${max}</div>
      <div class="meta-chips">
        <span class="meta-chip">Максимум <b>+${max}</b></span>
        <span class="meta-chip">Безопасно <b>+${safe}</b></span>
        <span class="meta-chip">${esc(itemClass(item))}</span>
      </div>
    </div>
    <div class="chance-orb" data-chance="${chance4 >= 100 ? 70 : chance4}" style="--p:${chance4}">
      <div class="chance-orb-inner"><strong>${fmtChance(chance4)}%</strong><small>шанс +4</small></div>
    </div>
  </header>

  <section class="panel">
    <div class="section-head"><h2>Шансы заточки +1…+${max}</h2><span>L2OFF retail</span></div>
    <p>
      <strong>${esc(name)}</strong> — ${esc(itemClass(item).toLowerCase())} ${esc(grade)}-грейда.
      Шанс шага: ${stepText}. Safe-зона: <strong>+${safe}</strong>, максимальный уровень: <strong>+${max}</strong>.
    </p>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>Цель</th><th>Шанс шага</th><th>С +0</th><th>Обычный свиток</th><th>Благословенный</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <p class="note">
      «С +0» — вероятность пройти все шаги подряд без единого провала. Шанс каждого шага независим.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Сколько свитков нужно</h2><span>математика</span></div>
    <div class="formula">${formulaCards}</div>
    <p class="note">
      Ожидаемое число свитков включает безопасные шаги. При благословенных свитках провал сбрасывает
      заточку на +0, поэтому реальный расход может быть выше среднего.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Свитки и вероятность по целям</h2><span>+4 / +7 / +10 / +16</span></div>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>Цель</th><th>Шанс дойти</th><th>Свитков в среднем</th><th>Провал</th></tr></thead>
        <tbody>${targetRows}</tbody>
      </table>
    </div>
    <p class="note">
      «Шанс дойти» — вероятность пройти все шаги до цели без единого провала. Это не гарантия:
      распределение имеет длинный хвост, и неудачная серия может потребовать намного больше свитков.
    </p>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Стратегия заточки ${esc(name)}</h2><span>риск</span></div>
    <p>
      Заточка в Interlude — это не прогресс, который нельзя потерять. Обычный свиток при провале
      уничтожает предмет, поэтому точить имеет смысл только те вещи, которые вы готовы потерять.
      Если предмет дорогой, используйте благословенный свиток: он не повышает шанс, но сохраняет вещь
      и сбрасывает заточку на +0.
    </p>
    <ul>
      <li>Safe-зона: +${safe}${item.fullArmor ? ' для цельного доспеха' : ''} — до неё провала нет.</li>
      <li>Шанс шага: ${stepText}; он не зависит от предыдущих успехов и провалов.</li>
      <li>Средний расход до +10: ${fmtDec(eExpected(item, 10))} свитков, но это не гарантия.</li>
      <li>Максимум: +${max}. После него заточка недоступна.</li>
    </ul>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Обычный или благословенный свиток</h2><span>провал</span></div>
    <p>
      Шанс успеха у обычного и благословенного свитка одинаковый. Разница только в провале:
      обычный свиток <strong>разрушает предмет</strong>, благословенный — <strong>сбрасывает заточку на +0</strong>.
      Для дорогих предметов благословенный свиток снижает риск потерять вещь, но не повышает шанс.
    </p>
    <div class="seo-subnav">
      <a href="/l2craft/enchant/">Все 150 предметов</a>
      <a href="/l2craft/enchant/type/${TYPE_SLUG[item.type] || 'weapon'}/">Заточка ${esc(typeLabel(item.type).toLowerCase())}</a>
      <a href="/l2craft/enchant/grade/${grade.toLowerCase()}/">Заточка ${esc(grade)}-грейда</a>
      ${recipe ? `<a href="${craftPath(recipe)}">Крафт ${esc(name)}</a>` : ''}
    </div>
  </section>

  <section class="panel seo-faq">
    <div class="section-head"><h2>Частые вопросы</h2><span>FAQ</span></div>
    ${faq.map(itemFaq => `<details><summary>${esc(itemFaq.q)}</summary><p>${esc(itemFaq.a)}</p></details>`).join('')}
  </section>

  <div class="seo-cta">
    <a class="craft-btn" href="/l2craft/#enchant">Открыть симулятор заточки</a>
    <span class="seo-cta-note">Ручная заточка, авто до +4/+7/+10/+16 и журнал попыток.</span>
  </div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' },
      primaryImageOfPage: { '@type': 'ImageObject', url: BASE + '/' + item.icon },
      author: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [name, url]]),
    {
      '@type': 'FAQPage',
      mainEntity: faq.map(itemFaq => ({
        '@type': 'Question',
        name: itemFaq.q,
        acceptedAnswer: { '@type': 'Answer', text: itemFaq.a }
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'article' }), url };
}

/* ---------- категории и хабы ---------- */

function craftHub() {
  const prefix = prefixFor(1);
  const url = '/l2craft/craft/';
  const canonical = SITE + url;
  const counts = recipes.reduce((map, r) => { map[r.chance] = (map[r.chance] || 0) + 1; return map; }, {});
  const byGrade = GRADE_ORDER.map(grade => ({ grade, list: recipes.filter(r => r.result.grade === grade) })).filter(x => x.list.length);
  const byChance = [60, 70, 25].map(chance => ({ chance, list: recipes.filter(r => r.chance === chance) })).filter(x => x.list.length);
  const allSorted = recipes.slice().sort((a, b) => GRADE_ORDER.indexOf(b.result.grade) - GRADE_ORDER.indexOf(a.result.grade) || a.result.name.localeCompare(b.result.name));
  const title = 'Крафт Lineage 2 Interlude — 179 рецептов с шансом 60/70/25%';
  const description = 'Все 179 рецептов Lineage 2 Interlude с шансом успеха: 160 на 60%, 18 на 70% и один на 25%. Материалы, MP, уровень Create Item и калькулятор попыток.';

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Create Item</span></div>
      <h1>Крафт Lineage 2 Interlude — 179 рецептов с шансом</h1>
      <div class="recipe-name">60%, 70% и единственный 25% · материалы, MP и уровень крафта</div>
      <div class="meta-chips">
        <span class="meta-chip">Всего <b>${recipes.length}</b></span>
        <span class="meta-chip">Шансовых <b>${recipes.length}</b></span>
        <span class="meta-chip">Источник <b>Recipes.xml C6</b></span>
      </div>
    </div>
  </header>

  <section class="panel">
    <p>
      В Lineage 2 Interlude есть 870 рецептов, но провалиться могут только 179. Здесь собраны именно они:
      160 рецептов со шансом 60%, 18 со шансом 70% и один уникальный рецепт с шансом 25% — Titan's Powerstone.
      Для каждого предмета можно посмотреть материалы на одну попытку, полный список базовых ресурсов,
      MP, уровень Create Item и математику попыток.
    </p>
    <div class="prob-grid">
      <div class="prob-card"><strong>${recipes.length}</strong><span>шансовых рецептов</span></div>
      <div class="prob-card"><strong>${counts[60] || 0}</strong><span>рецептов 60%</span></div>
      <div class="prob-card"><strong>${counts[70] || 0}</strong><span>рецептов 70%</span></div>
      <div class="prob-card"><strong>${counts[25] || 0}</strong><span>рецепт 25%</span></div>
    </div>
    <div class="seo-subnav">
      ${byChance.map(x => `<a href="/l2craft/craft/chance/${x.chance}/">Рецепты ${x.chance}% (${x.list.length})</a>`).join('')}
      <a href="/l2craft/craft/stats/">Статистика базы</a>
    </div>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Рецепты по грейдам</h2><span>D–S</span></div>
    <div class="seo-link-grid">
      ${byGrade.map(x => `<a href="/l2craft/craft/grade/${x.grade.toLowerCase()}/">${esc(x.grade)}-грейд <small>${x.list.length} рецептов</small></a>`).join('')}
    </div>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Все рецепты</h2><span>${allSorted.length}</span></div>
    <div class="seo-related">${itemLinks(allSorted, craftPath, prefix, r => `${r.result.name} · ${r.chance}%`)}</div>
  </section>

  <section class="panel seo-faq">
    <div class="section-head"><h2>Частые вопросы</h2><span>FAQ</span></div>
    <details><summary>Сколько рецептов с шансом в Lineage 2 Interlude?</summary><p>179: 160 со шансом 60%, 18 со шансом 70% и один со шансом 25% — Titan's Powerstone.</p></details>
    <details><summary>Почему в калькуляторе только 179 рецептов?</summary><p>Остальные рецепты в игре гарантированные (100%). Здесь собраны только те, где есть риск провала и потери материалов.</p></details>
    <details><summary>Сколько попыток в среднем нужно при шансе 60%?</summary><p>В среднем 1,67 попытки, медиана — 1 попытка, для 95% вероятности — 4 попытки.</p></details>
    <details><summary>Можно ли посмотреть материалы без промежуточных крафтов?</summary><p>Да. На странице каждого предмета есть прямой список материалов и полный список базовых ресурсов с промежуточными крафтами.</p></details>
  </section>

  <div class="seo-cta">
    <a class="craft-btn" href="/l2craft/">Открыть симулятор крафта</a>
    <span class="seo-cta-note">Одиночные попытки, ×10, ×100 и режим «До успеха».</span>
  </div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', url]]),
    {
      '@type': 'ItemList',
      numberOfItems: allSorted.length,
      itemListElement: allSorted.map((r, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: r.result.name,
        url: SITE + craftPath(r)
      }))
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Сколько рецептов с шансом в Lineage 2 Interlude?', acceptedAnswer: { '@type': 'Answer', text: '179 рецептов: 160 на 60%, 18 на 70% и один на 25%.' } },
        { '@type': 'Question', name: 'Сколько попыток в среднем нужно при шансе 60%?', acceptedAnswer: { '@type': 'Answer', text: 'В среднем 1,67 попытки, для 95% вероятности — 4 попытки.' } }
      ]
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function enchantHub() {
  const prefix = prefixFor(1);
  const url = '/l2craft/enchant/';
  const canonical = SITE + url;
  const weapons = enchantItems.filter(i => i.type === 'weapon');
  const magic = weapons.filter(i => i.magic);
  const byGrade = GRADE_ORDER.map(grade => ({ grade, list: enchantItems.filter(i => i.grade === grade) })).filter(x => x.list.length);
  const byType = ['weapon', 'armor', 'jewelry'].map(type => ({ type, list: enchantItems.filter(i => i.type === type) })).filter(x => x.list.length);
  const allSorted = enchantItems.slice().sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade) || a.name.localeCompare(b.name));
  const title = 'Заточка Lineage 2 Interlude — шансы +3…+16 для оружия, брони и бижутерии';
  const description = 'Шансы заточки Lineage 2 Interlude: физическое оружие 70% и 35%, магическое 40% и 20%, броня и бижутерия 66,67%. Safe +3/+4, максимум +16. 150 предметов D–S.';

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Enchant</span></div>
      <h1>Заточка Lineage 2 Interlude — шансы +3…+16</h1>
      <div class="recipe-name">L2OFF retail · 150 предметов D–S · обычный и благословенный свиток</div>
      <div class="meta-chips">
        <span class="meta-chip">Максимум <b>+16</b></span>
        <span class="meta-chip">Safe <b>+3</b></span>
        <span class="meta-chip">Цельный доспех <b>+4</b></span>
      </div>
    </div>
  </header>

  <section class="panel">
    <p>
      Заточка в Interlude зависит от типа предмета, а не от грейда. Физическое оружие точится с шансом
      70% до +15 и 35% на +16, магическое — 40% и 20%, броня и бижутерия — 66,67% на каждом шаге.
      Safe-зона: +3, для цельного доспеха +4. Максимум — +16.
    </p>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>Тип</th><th>+4…+15</th><th>+16</th><th>Провал обычного</th><th>Провал благословенного</th></tr></thead>
        <tbody>
          <tr><td>Физическое оружие</td><td>70%</td><td>35%</td><td>разрушение</td><td>сброс на +0</td></tr>
          <tr><td>Магическое оружие</td><td>40%</td><td>20%</td><td>разрушение</td><td>сброс на +0</td></tr>
          <tr><td>Броня и бижутерия</td><td>66,67%</td><td>66,67%</td><td>разрушение</td><td>сброс на +0</td></tr>
          <tr><td>Цельный доспех</td><td>66,67% с +5</td><td>66,67%</td><td>разрушение</td><td>сброс на +0</td></tr>
        </tbody>
      </table>
    </div>
    <div class="prob-grid">
      <div class="prob-card"><strong>${enchantItems.length}</strong><span>предметов D–S</span></div>
      <div class="prob-card"><strong>${weapons.length}</strong><span>оружия</span></div>
      <div class="prob-card"><strong>${magic.length}</strong><span>магического оружия</span></div>
      <div class="prob-card"><strong>${enchantItems.length - weapons.length}</strong><span>брони и бижутерии</span></div>
    </div>
    <div class="seo-subnav">
      ${byType.map(x => `<a href="/l2craft/enchant/type/${TYPE_SLUG[x.type]}/">${esc(typeLabel(x.type))} (${x.list.length})</a>`).join('')}
    </div>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Заточка по грейдам</h2><span>D–S</span></div>
    <div class="seo-link-grid">
      ${byGrade.map(x => `<a href="/l2craft/enchant/grade/${x.grade.toLowerCase()}/">${esc(x.grade)}-грейд <small>${x.list.length} предметов</small></a>`).join('')}
    </div>
  </section>

  <section class="panel">
    <div class="section-head"><h2>Все предметы для заточки</h2><span>${allSorted.length}</span></div>
    <div class="seo-related">${itemLinks(allSorted, enchantPath, prefix, i => `${i.name} · ${i.grade}${i.magic ? ' · маг.' : ''}`)}</div>
  </section>

  <section class="panel seo-faq">
    <div class="section-head"><h2>Частые вопросы</h2><span>FAQ</span></div>
    <details><summary>Какие шансы заточки в Lineage 2 Interlude?</summary><p>Физическое оружие — 70% до +15 и 35% на +16, магическое — 40% и 20%, броня и бижутерия — 66,67% на каждом шаге.</p></details>
    <details><summary>До какого уровня безопасно точить?</summary><p>До +3, для цельного доспеха — до +4. Начиная со следующего шага возможен провал.</p></details>
    <details><summary>Что делает благословенный свиток?</summary><p>При провале не разрушает предмет, а сбрасывает заточку на +0. Шанс успеха такой же, как у обычного.</p></details>
    <details><summary>Какой максимальный уровень заточки?</summary><p>В этом симуляторе — +16, как в L2OFF Interlude retail.</p></details>
  </section>

  <div class="seo-cta">
    <a class="craft-btn" href="/l2craft/#enchant">Открыть симулятор заточки</a>
    <span class="seo-cta-note">Ручная заточка и авто до +4/+7/+10/+16.</span>
  </div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', url]]),
    {
      '@type': 'ItemList',
      numberOfItems: allSorted.length,
      itemListElement: allSorted.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: SITE + enchantPath(item)
      }))
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Какие шансы заточки в Lineage 2 Interlude?', acceptedAnswer: { '@type': 'Answer', text: 'Физическое оружие 70% и 35%, магическое 40% и 20%, броня и бижутерия 66,67%.' } },
        { '@type': 'Question', name: 'До какого уровня безопасно точить?', acceptedAnswer: { '@type': 'Answer', text: 'До +3, для цельного доспеха до +4.' } }
      ]
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function chancePage(chance) {
  const list = recipes.filter(r => r.chance === chance).sort((a, b) => a.result.name.localeCompare(b.result.name));
  const prefix = prefixFor(3);
  const url = `/l2craft/craft/chance/${chance}/`;
  const canonical = SITE + url;
  const title = `Рецепты Lineage 2 Interlude с шансом ${chance}% — ${list.length} ${itemsWord(list.length)}`;
  const description = `Список рецептов Lineage 2 Interlude с шансом ${chance}%: ${list.length} ${itemsWord(list.length)}, материалы, MP и уровень Create Item. Полный каталог и калькулятор попыток.`;
  const intro = chance === 25
    ? 'Единственный рецепт в игре с шансом 25% — Titan\'s Powerstone. Три четверти попыток заканчиваются провалом.'
    : chance === 70
      ? '18 рецептов с шансом 70% — в основном бижутерия из адамантита и чёрной руды.'
      : '160 рецептов с шансом 60% — самая массовая группа шансового крафта в Interlude.';

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [`${chance}%`, url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Шанс ${chance}%</span></div>
      <h1>Рецепты Lineage 2 Interlude с шансом ${chance}%</h1>
      <div class="recipe-name">${list.length} ${itemsWord(list.length)} · материалы, MP и Create Item</div>
    </div>
    <div class="chance-orb" data-chance="${chance}" style="--p:${chance}">
      <div class="chance-orb-inner"><strong>${chance}%</strong><small>шанс</small></div>
    </div>
  </header>
  <section class="panel">
    <p>${intro} В среднем при таком шансе нужно ${fmtDec(1 / (chance / 100))} ${attemptsWord(1 / (chance / 100))}, для 95% вероятности — ${Math.ceil(Math.log(0.05) / Math.log(1 - chance / 100))} ${attemptsWord(Math.ceil(Math.log(0.05) / Math.log(1 - chance / 100)))}.</p>
    <div class="seo-related">${itemLinks(list, craftPath, prefix, r => `${r.result.name} · ${r.result.grade}`)}</div>
    <div class="seo-subnav">
      <a href="/l2craft/craft/">Все рецепты</a>
      <a href="/l2craft/craft/chance/60/">60%</a>
      <a href="/l2craft/craft/chance/70/">70%</a>
      <a href="/l2craft/craft/chance/25/">25%</a>
    </div>
  </section>
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/">Открыть симулятор</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [`${chance}%`, url]]),
    {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((r, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: r.result.name,
        url: SITE + craftPath(r)
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function craftGradePage(grade) {
  const list = recipes.filter(r => r.result.grade === grade).sort((a, b) => b.chance - a.chance || a.result.name.localeCompare(b.result.name));
  const prefix = prefixFor(3);
  const url = `/l2craft/craft/grade/${grade.toLowerCase()}/`;
  const canonical = SITE + url;
  const title = `Крафт ${grade}-грейда в Lineage 2 Interlude — рецепты и шансы`;
  const description = `Все рецепты ${grade}-грейда в Lineage 2 Interlude с шансом: ${list.length} предметов, материалы, MP, Create Item и калькулятор попыток.`;

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [`${grade}-грейд`, url]])}
<article class="sheet seo-sheet grade-tone-${esc(grade)}">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span class="grade grade-${esc(grade)}">${esc(grade)}</span></div>
      <h1>Крафт ${esc(grade)}-грейда в Lineage 2 Interlude</h1>
      <div class="recipe-name">${list.length} шансовых рецептов · материалы, MP и Create Item</div>
    </div>
  </header>
  <section class="panel">
    <p>Все рецепты ${esc(grade)}-грейда, которые могут провалиться. Шанс, материалы и математика попыток — на странице каждого предмета.</p>
    <div class="seo-related">${itemLinks(list, craftPath, prefix, r => `${r.result.name} · ${r.chance}%`)}</div>
    <div class="seo-subnav">
      <a href="/l2craft/craft/">Все рецепты</a>
      ${GRADE_ORDER.map(g => `<a href="/l2craft/craft/grade/${g.toLowerCase()}/">${g}</a>`).join('')}
    </div>
  </section>
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/">Открыть симулятор</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], [`${grade}-грейд`, url]]),
    {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((r, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: r.result.name,
        url: SITE + craftPath(r)
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function enchantTypePage(type) {
  const list = enchantItems.filter(i => i.type === type).sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade) || a.name.localeCompare(b.name));
  const prefix = prefixFor(3);
  const url = `/l2craft/enchant/type/${TYPE_SLUG[type]}/`;
  const canonical = SITE + url;
  const label = typeLabel(type).toLowerCase();
  const title = `Заточка ${label} в Lineage 2 Interlude — шансы и таблица`;
  const description = `Заточка ${label} в Lineage 2 Interlude: ${list.length} предметов D–S, шансы +4…+16, safe-уровень, обычный и благословенный свиток.`;

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [typeLabel(type), url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Enchant</span></div>
      <h1>Заточка ${esc(label)} в Lineage 2 Interlude</h1>
      <div class="recipe-name">${list.length} предметов D–S · шансы +4…+16</div>
    </div>
  </header>
  <section class="panel">
    <p>${type === 'weapon'
      ? 'Оружие делится на физическое (70% до +15, 35% на +16) и магическое (40% и 20%). Ниже — все предметы, доступные в симуляторе.'
      : 'Броня и бижутерия точатся с шансом 66,67% на каждом шаге. Safe-зона — +3, для цельного доспеха +4.'}</p>
    <div class="seo-related">${itemLinks(list, enchantPath, prefix, i => `${i.name} · ${i.grade}${i.magic ? ' · маг.' : ''}`)}</div>
    <div class="seo-subnav">
      <a href="/l2craft/enchant/">Все предметы</a>
      <a href="/l2craft/enchant/type/weapon/">Оружие</a>
      <a href="/l2craft/enchant/type/armor/">Броня</a>
      <a href="/l2craft/enchant/type/jewelry/">Бижутерия</a>
    </div>
  </section>
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/#enchant">Открыть симулятор заточки</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [typeLabel(type), url]]),
    {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: SITE + enchantPath(item)
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function enchantGradePage(grade) {
  const list = enchantItems.filter(i => i.grade === grade).sort((a, b) => a.name.localeCompare(b.name));
  const prefix = prefixFor(3);
  const url = `/l2craft/enchant/grade/${grade.toLowerCase()}/`;
  const canonical = SITE + url;
  const title = `Заточка ${grade}-грейда в Lineage 2 Interlude — шансы +4…+16`;
  const description = `Заточка ${grade}-грейда в Lineage 2 Interlude: ${list.length} предметов, шансы +4…+16, safe-уровень и таблица свитков.`;

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [`${grade}-грейд`, url]])}
<article class="sheet seo-sheet grade-tone-${esc(grade)}">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span class="grade grade-${esc(grade)}">${esc(grade)}</span></div>
      <h1>Заточка ${esc(grade)}-грейда в Lineage 2 Interlude</h1>
      <div class="recipe-name">${list.length} предметов · шансы +4…+16</div>
    </div>
  </header>
  <section class="panel">
    <p>Все предметы ${esc(grade)}-грейда, доступные в симуляторе заточки. Шанс зависит от типа предмета, а не от грейда.</p>
    <div class="seo-related">${itemLinks(list, enchantPath, prefix, i => `${i.name} · ${typeLabel(i.type)}`)}</div>
    <div class="seo-subnav">
      <a href="/l2craft/enchant/">Все предметы</a>
      ${GRADE_ORDER.map(g => `<a href="/l2craft/enchant/grade/${g.toLowerCase()}/">${g}</a>`).join('')}
    </div>
  </section>
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/#enchant">Открыть симулятор заточки</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Заточка', '/l2craft/enchant/'], [`${grade}-грейд`, url]]),
    {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: SITE + enchantPath(item)
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

/* ---------- статистика ---------- */

function statsPage() {
  const prefix = prefixFor(2);
  const url = '/l2craft/craft/stats/';
  const canonical = SITE + url;
  const chanceCounts = recipes.reduce((map, r) => { map[r.chance] = (map[r.chance] || 0) + 1; return map; }, {});
  const gradeCounts = GRADE_ORDER.map(grade => ({ grade, count: recipes.filter(r => r.result.grade === grade).length })).filter(x => x.count);
  const levelCounts = Array.from({ length: 10 }, (_, level) => ({ level, count: recipes.filter(r => r.craftLevel === level).length })).filter(x => x.count);
  const materialFreq = new Map();
  for (const r of recipes) {
    for (const d of r.direct) {
      if (d.name.startsWith('Recipe:')) continue;
      materialFreq.set(d.name, (materialFreq.get(d.name) || 0) + 1);
    }
  }
  const topMaterials = [...materialFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const sums = recipes.map(r => materialSum(r)).sort((a, b) => a - b);
  const avgMaterials = sums.reduce((a, b) => a + b, 0) / sums.length;
  const medianMaterials = sums[Math.floor(sums.length / 2)];
  const heaviest = recipes.slice().sort((a, b) => materialSum(b) - materialSum(a)).slice(0, 10);
  const title = 'Крафт Lineage 2 Interlude в цифрах — 179 рецептов, шансы и материалы';
  const description = 'Статистика шансового крафта Lineage 2 Interlude: 179 рецептов, распределение 60/70/25%, грейды, уровни Create Item и самые частые материалы.';

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], ['Статистика', url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Data study</span></div>
      <h1>Крафт Lineage 2 Interlude в цифрах</h1>
      <div class="recipe-name">179 шансовых рецептов · распределение, материалы, уровни</div>
    </div>
  </header>

  <section class="panel">
    <p>Мы разобрали все 179 рецептов C6 Interlude, которые могут провалиться. Ниже — распределение шансов, грейдов и уровней Create Item, а также материалы, которые встречаются чаще всего.</p>
    <div class="prob-grid">
      <div class="prob-card"><strong>${recipes.length}</strong><span>шансовых рецептов</span></div>
      <div class="prob-card"><strong>${chanceCounts[60] || 0}</strong><span>шанс 60%</span></div>
      <div class="prob-card"><strong>${chanceCounts[70] || 0}</strong><span>шанс 70%</span></div>
      <div class="prob-card"><strong>${chanceCounts[25] || 0}</strong><span>шанс 25%</span></div>
    </div>
  </section>

  <section class="panel">
    <h2>Шансы крафта</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Шанс</th><th>Рецептов</th><th>Доля</th><th>Среднее попыток</th><th>95%</th></tr></thead>
      <tbody>${[60, 70, 25].map(chance => `<tr><td>${chance}%</td><td>${chanceCounts[chance] || 0}</td><td>${((chanceCounts[chance] || 0) / recipes.length * 100).toFixed(1).replace('.', ',')}%</td><td>${fmtDec(100 / chance)}</td><td>${Math.ceil(Math.log(0.05) / Math.log(1 - chance / 100))}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2>Грейды</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Грейд</th><th>Рецептов</th></tr></thead>
      <tbody>${gradeCounts.map(x => `<tr><td>${x.grade}</td><td>${x.count}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2>Уровни Create Item</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Уровень</th><th>Рецептов</th></tr></thead>
      <tbody>${levelCounts.map(x => `<tr><td>${x.level}</td><td>${x.count}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Самые частые материалы</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Материал</th><th>В скольких рецептах</th></tr></thead>
      <tbody>${topMaterials.map(([name, count]) => `<tr><td>${esc(name)}</td><td>${count}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2>Материалы на одну попытку</h2>
    <div class="formula">
      <div>Среднее: <b>${fmtDec(avgMaterials)}</b> шт.</div>
      <div>Медиана: <b>${fmt(medianMaterials)}</b> шт.</div>
      <div>Минимум: <b>${fmt(sums[0])}</b> шт.</div>
      <div>Максимум: <b>${fmt(sums[sums.length - 1])}</b> шт.</div>
    </div>
    <h2>Самые тяжёлые рецепты</h2>
    <div class="seo-related">${heaviest.map(r => `<a href="${craftPath(r)}"><img src="${prefix}${esc(r.icon)}" alt="${esc(r.result.name)}" width="28" height="28" loading="lazy"><span>${esc(r.result.name)} · ${fmt(materialSum(r))} шт.</span></a>`).join('')}</div>
    <div class="seo-subnav">
      <a href="/l2craft/craft/">Все рецепты</a>
      <a href="/l2craft/craft/chance/60/">60%</a>
      <a href="/l2craft/craft/chance/70/">70%</a>
      <a href="/l2craft/craft/chance/25/">25%</a>
    </div>
  </section>

  <div class="seo-cta"><a class="craft-btn" href="/l2craft/">Открыть симулятор крафта</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      datePublished: UPDATED,
      dateModified: UPDATED,
      author: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' },
      publisher: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Крафт', '/l2craft/craft/'], ['Статистика', url]])
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'article' }), url };
}

/* ---------- API ---------- */

function apiPage() {
  const prefix = prefixFor(1);
  const url = '/l2craft/api/';
  const canonical = SITE + url;
  const title = 'JSON API крафта и заточки Lineage 2 Interlude';
  const description = 'Открытые JSON-данные l2craft: 179 рецептов с шансом и 150 предметов для заточки. Материалы, MP, Create Item, шансы L2OFF.';
  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['API', url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>JSON API</span></div>
      <h1>JSON API крафта и заточки Lineage 2 Interlude</h1>
      <div class="recipe-name">Открытые данные для калькуляторов, ботов и серверных сайтов</div>
    </div>
  </header>

  <section class="panel">
    <h2>Рецепты</h2>
    <p><a href="/l2craft/api/recipes.json">/l2craft/api/recipes.json</a> — 179 шансовых рецептов: шанс, материалы, MP, Create Item, грейд, иконки.</p>
    <h2>Заточка</h2>
    <p><a href="/l2craft/api/enchant.json">/l2craft/api/enchant.json</a> — таблицы шансов L2OFF и 150 предметов D–S: тип, грейд, магическое оружие, safe-уровень.</p>
    <h2>Пример</h2>
    <pre><code>fetch('https://one1game.org/l2craft/api/recipes.json')
  .then(r =&gt; r.json())
  .then(data =&gt; console.log(data.recipes.length));</code></pre>
    <p class="note">Данные предоставляются как есть для фанатских инструментов. Укажите ссылку на one1game.org/l2craft/ при публичном использовании.</p>
    <div class="seo-subnav">
      <a href="/l2craft/">Симулятор</a>
      <a href="/l2craft/craft/">Рецепты</a>
      <a href="/l2craft/enchant/">Заточка</a>
    </div>
  </section>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['API', url]])
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

/* ---------- гайды ---------- */

function faqSection(items) {
  return `<section class="panel seo-faq">
    <div class="section-head"><h2>Частые вопросы</h2><span>FAQ</span></div>
    ${items.map(item => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('')}
  </section>`;
}

function guidePage({ slug, title, h1, description, intro, content, faq, related = [] }) {
  const prefix = prefixFor(2);
  const url = `/l2craft/guides/${slug}/`;
  const canonical = SITE + url;
  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Гайды', '/l2craft/guides/'], [h1, url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Гайд</span></div>
      <h1>${esc(h1)}</h1>
      <div class="recipe-name">Обновлено ${UPDATED} · L2OFF retail · Interlude</div>
    </div>
  </header>
  <section class="panel">
    ${intro}
    ${content}
    <div class="seo-subnav">
      <a href="/l2craft/">Симулятор</a>
      <a href="/l2craft/craft/">Рецепты</a>
      <a href="/l2craft/enchant/">Заточка</a>
      <a href="/l2craft/guides/">Все гайды</a>
      ${related.map(x => `<a href="${x.url}">${esc(x.label)}</a>`).join('')}
    </div>
  </section>
  ${faqSection(faq)}
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/">Открыть калькулятор</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      datePublished: UPDATED,
      dateModified: UPDATED,
      author: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' },
      publisher: { '@type': 'Organization', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Гайды', '/l2craft/guides/'], [h1, url]]),
    {
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a }
      }))
    }
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'article' }), url };
}

function guidesHub() {
  const prefix = prefixFor(1);
  const url = '/l2craft/guides/';
  const canonical = SITE + url;
  const title = 'Гайды по крафту и заточке Lineage 2 Interlude';
  const description = 'Гайды по крафту и заточке Lineage 2 Interlude: шансы 60/70/25%, таблица заточки +3…+16, обычный и благословенный свиток, Titan\'s Powerstone и грейды D–S.';
  const list = [
    ['enchant-chances', 'Шансы заточки Lineage 2 Interlude', 'Таблица +3…+16, safe-уровни, обычный и благословенный свиток.'],
    ['craft-chances', 'Шансы крафта Lineage 2 Interlude', '60%, 70%, 25%: распределение, попытки и материалы.'],
    ['60-percent', 'Крафт 60%: сколько попыток нужно', 'Математика серий, 95% вероятность и расход материалов.'],
    ['titans-powerstone', 'Titan\'s Powerstone — рецепт 25%', 'Единственный рецепт с шансом 25%: материалы и попытки.'],
    ['blessed-scroll', 'Обычный или благословенный свиток', 'Одинаковый шанс, разный провал: когда что использовать.'],
    ['grade-d-s', 'Крафт D–S в Interlude', 'Что крафтить по грейдам и где смотреть шансы.']
  ];

  const body = `${crumbs([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Гайды', url]])}
<article class="sheet seo-sheet">
  <header class="result-head">
    <div class="result-info">
      <div class="result-kicker"><span>Lineage II</span><span>Interlude</span><span>Гайды</span></div>
      <h1>Гайды по крафту и заточке Lineage 2 Interlude</h1>
      <div class="recipe-name">Шансы, материалы, заточка и математика попыток</div>
    </div>
  </header>
  <section class="panel">
    <p>Короткие разборы механик Interlude: сколько рецептов с шансом, как считается вероятность, какие шансы у заточки и чем отличается благословенный свиток. Без воды — с таблицами и ссылками на калькулятор.</p>
    <div class="seo-link-grid">
      ${list.map(([slug, title, desc]) => `<a href="/l2craft/guides/${slug}/">${esc(title)} <small>${esc(desc)}</small></a>`).join('')}
    </div>
    <div class="prob-grid">
      <div class="prob-card"><strong>179</strong><span>рецептов с шансом</span></div>
      <div class="prob-card"><strong>150</strong><span>предметов для заточки</span></div>
      <div class="prob-card"><strong>+16</strong><span>максимум заточки</span></div>
      <div class="prob-card"><strong>66,67%</strong><span>шанс брони на шаге</span></div>
    </div>
  </section>
  <div class="seo-cta"><a class="craft-btn" href="/l2craft/">Открыть калькулятор</a></div>
</article>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: 'ru-RU',
      dateModified: UPDATED,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: SITE + '/' }
    },
    breadcrumbLd([['Главная', '/'], ['L2 Craft', '/l2craft/'], ['Гайды', url]])
  ];

  return { html: page({ title, description, canonical, prefix, body, jsonLd, ogType: 'website' }), url };
}

function guideEnchantChances() {
  const levels = [4, 7, 10, 16];
  const types = [
    { key: 'physical', label: 'Физическое оружие', step: 0.7, safe: 3, final: 0.35 },
    { key: 'magic', label: 'Магическое оружие', step: 0.4, safe: 3, final: 0.2 },
    { key: 'armor', label: 'Броня и бижутерия', step: 2 / 3, safe: 3, final: 2 / 3 },
    { key: 'full', label: 'Цельный доспех', step: 2 / 3, safe: 4, final: 2 / 3 }
  ];

  const chanceTo = (type, level) => {
    if (level <= type.safe) return 1;
    const steps = level - type.safe;
    if (level === 16) return Math.pow(type.step, steps - 1) * type.final;
    return Math.pow(type.step, steps);
  };
  const expectedTo = (type, level) => {
    let sum = 0;
    for (let target = 1; target <= level; target++) {
      let p = target <= type.safe ? 1 : type.step;
      if (target === 16) p = type.final;
      sum += 1 / p;
    }
    return sum;
  };

  const chanceRows = types.map(t => `<tr>
    <td>${t.label}</td>
    <td>${t.safe === 4 ? '100%' : fmtChance(t.step * 100) + '%'}</td>
    <td>${fmtChance(t.step * 100)}%</td>
    <td>${fmtChance(t.final * 100)}%</td>
  </tr>`).join('');

  const cumulativeRows = types.map(t => `<tr>
    <td>${t.label}</td>
    <td>${esc(fmtProb(chanceTo(t, 4)))}</td>
    <td>${esc(fmtProb(chanceTo(t, 7)))}</td>
    <td>${esc(fmtProb(chanceTo(t, 10)))}</td>
    <td>${esc(fmtProb(chanceTo(t, 16)))}</td>
  </tr>`).join('');

  const scrollRows = types.map(t => `<tr>
    <td>${t.label}</td>
    <td>${fmtDec(expectedTo(t, 4))}</td>
    <td>${fmtDec(expectedTo(t, 7))}</td>
    <td>${fmtDec(expectedTo(t, 10))}</td>
    <td>${fmtDec(expectedTo(t, 16))}</td>
  </tr>`).join('');

  const faq = [
    { q: 'Какие шансы заточки в Interlude?', a: 'Физическое оружие — 70% до +15 и 35% на +16, магическое — 40% и 20%, броня и бижутерия — 66,67% на каждом шаге. Safe +3, для цельного доспеха +4, максимум +16.' },
    { q: 'Влияет ли грейд на шанс заточки?', a: 'Нет. Шанс зависит от типа предмета — физическое оружие, магическое оружие, броня или бижутерия. Грейд влияет на свиток и стоимость, но не на процент.' },
    { q: 'Что происходит при провале?', a: 'Обычный свиток разрушает предмет. Благословенный оставляет предмет и сбрасывает заточку на +0. Шанс успеха у них одинаковый.' },
    { q: 'До какого уровня безопасно точить?', a: 'До +3, для цельного доспеха до +4. Начиная со следующего шага возможен провал.' },
    { q: 'Сколько свитков нужно до +10?', a: 'Физическое оружие — около 13 свитков, магическое — около 20,5, броня — около 13,5. Это среднее, а не гарантия.' }
  ];

  const title = 'Шансы заточки Lineage 2 Interlude — таблица +3…+16';
  const description = 'Таблица шансов заточки Lineage 2 Interlude: физическое оружие 70%/35%, магическое 40%/20%, броня 66,67%. Safe +3/+4, максимум +16, обычный и благословенный свиток.';
  const intro = `<p>Заточка в Interlude зависит от типа предмета, а не от грейда. Safe-зона — +3, для цельного доспеха +4; максимум — +16. Ниже — шансы каждого шага, вероятность дойти до цели и ожидаемый расход свитков.</p>`;
  const content = `
    <h2>Шанс одного шага</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Тип</th><th>+4</th><th>+5…+15</th><th>+16</th></tr></thead>
      <tbody>${chanceRows}</tbody>
    </table></div>
    <h2>Шанс дойти до цели</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Тип</th><th>+4</th><th>+7</th><th>+10</th><th>+16</th></tr></thead>
      <tbody>${cumulativeRows}</tbody>
    </table></div>
    <h2>Ожидаемый расход свитков</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Тип</th><th>+4</th><th>+7</th><th>+10</th><th>+16</th></tr></thead>
      <tbody>${scrollRows}</tbody>
    </table></div>
    <p class="note">Среднее число свитков — математическое ожидание. Неудачные серии возможны, а распределение имеет длинный хвост.</p>
    <h2>Обычный или благословенный</h2>
    <p>Шанс одинаковый. Обычный свиток при провале разрушает предмет, благословенный — сбрасывает заточку на +0. Для дорогих предметов благословенный свиток снижает риск потерять вещь, но не повышает шанс.</p>
    <h2>Максимум +16</h2>
     <p>В L2OFF Interlude максимум заточки — +16. После этого уровня предмет больше не точится. На приватных серверах лимит и шансы могут быть изменены.</p>
     <h2>Почему у брони 66,67%</h2>
     <p>Шанс брони и бижутерии — две трети, то есть 66,67% на каждом шаге. Это не убывающая кривая: если сервер не менял настройки, +5, +10 и +15 имеют одинаковый шанс. У оружия шанс тоже фиксированный, но отличается для физического и магического типа.</p>
     <h2>Как читать таблицу</h2>
     <p>Колонка «шанс шага» — вероятность одной попытки. Колонка «шанс дойти» — вероятность пройти все шаги до цели без единого провала. Колонка «свитков в среднем» — математическое ожидание, а не гарантия: половина игроков потратит меньше, половина — больше.</p>
     <h2>Что меняется на приватных серверах</h2>
     <p>Многие проекты меняют шансы, добавляют защиту от разрушения или повышают лимит заточки. Если вы играете на приватном сервере, сначала проверьте его описание: таблица L2OFF может не совпадать с местными настройками.</p>
     <h2>Частые ошибки</h2>
     <ul>
       <li>Точить без запасного предмета и надеяться на «удачную серию».</li>
       <li>Считать среднее число свитков гарантией: распределение имеет длинный хвост.</li>
       <li>Использовать благословенный свиток ради шанса — он не повышает процент.</li>
       <li>Забывать, что грейд не влияет на шанс, но влияет на стоимость ошибки.</li>
     </ul>`;

  return guidePage({
    slug: 'enchant-chances',
    title,
    h1: 'Шансы заточки Lineage 2 Interlude',
    description,
    intro,
    content,
    faq,
    related: [
      { url: '/l2craft/enchant/', label: 'Все предметы для заточки' },
      { url: '/l2craft/guides/blessed-scroll/', label: 'Обычный или благословенный свиток' }
    ]
  });
}

function guideCraftChances() {
  const counts = recipes.reduce((map, r) => { map[r.chance] = (map[r.chance] || 0) + 1; return map; }, {});
  const rows = [60, 70, 25].map(chance => {
    const p = chance / 100;
    return `<tr>
      <td>${chance}%</td>
      <td>${counts[chance] || 0}</td>
      <td>${fmtDec(1 / p)}</td>
      <td>${Math.ceil(Math.log(0.5) / Math.log(1 - p))}</td>
      <td>${Math.ceil(Math.log(0.05) / Math.log(1 - p))}</td>
    </tr>`;
  }).join('');

  const attemptRows = [1, 2, 3, 5, 10, 25, 50, 100].map(n => `<tr>
    <td>${n}</td>
    <td>${esc(fmtProb(1 - Math.pow(0.4, n)))}</td>
    <td>${esc(fmtProb(1 - Math.pow(0.3, n)))}</td>
    <td>${esc(fmtProb(1 - Math.pow(0.75, n)))}</td>
  </tr>`).join('');

  const sums = recipes.map(r => materialSum(r)).sort((a, b) => a - b);
  const medianMaterials = sums[Math.floor(sums.length / 2)];
  const avgMaterials = sums.reduce((a, b) => a + b, 0) / sums.length;

  const faq = [
    { q: 'Сколько рецептов с шансом в Lineage 2 Interlude?', a: '179: 160 со шансом 60%, 18 со шансом 70% и один со шансом 25% — Titan\'s Powerstone.' },
    { q: 'Почему 60% не гарантирует успех?', a: 'Каждая попытка независима. Шанс 60% не накапливается: после пяти провалов следующая попытка всё равно имеет 60%.' },
    { q: 'Сколько попыток нужно для 95% вероятности?', a: 'При 60% — 4 попытки, при 70% — 3, при 25% — 11. Это вероятность хотя бы одного успеха, а не гарантия.' },
    { q: 'Сколько материалов в среднем нужно?', a: `Медиана — ${fmt(medianMaterials)} предметов на одну попытку, среднее — ${fmtDec(avgMaterials)}. В расчёт входят все прямые материалы, включая рецепт.` }
  ];

  const title = 'Шансы крафта Lineage 2 Interlude — 60%, 70% и 25%';
  const description = 'Разбор шансов крафта Lineage 2 Interlude: 179 рецептов, распределение 60/70/25%, среднее число попыток, 95% вероятность и расход материалов.';
  const intro = `<p>В Interlude провалиться могут 179 рецептов: 160 с шансом 60%, 18 с шансом 70% и один с шансом 25%. Ниже — сколько попыток нужно в среднем, как считается серия и сколько материалов уходит на 95% вероятность.</p>`;
  const content = `
    <h2>Распределение шансов</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Шанс</th><th>Рецептов</th><th>Среднее попыток</th><th>Медиана</th><th>95%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>Вероятность хотя бы одного успеха</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Попыток</th><th>60%</th><th>70%</th><th>25%</th></tr></thead>
      <tbody>${attemptRows}</tbody>
    </table></div>
    <h2>Материалы</h2>
    <p>Медианный рецепт требует ${fmt(medianMaterials)} предметов на одну попытку, среднее — ${fmtDec(avgMaterials)}. В расчёт входят рецепт и все прямые материалы; базовые ресурсы с промежуточными крафтами раскрываются на странице каждого предмета.</p>
    <h2>Что это значит</h2>
     <p>Шанс 60% — это не «две попытки и готово», а 1,67 попытки в среднем. Медиана — 1 попытка, но длинные серии провалов случаются чаще, чем кажется. Для 95% вероятности нужно 4 попытки; 100% гарантии нет ни при каком количестве попыток.</p>
     <h2>Почему 60% — не 60% за сессию</h2>
     <p>Шанс применяется к каждой попытке отдельно. Если вы сделали 10 крафтов, это не «600% успеха»: вероятность хотя бы одного успеха — 99,99%, но вероятность конкретного числа успехов распределяется по биномиальному закону. Ожидаемое число успехов за 10 попыток — 6, но реальный результат может быть любым.</p>
     <h2>Как считать бюджет</h2>
     <p>Умножьте материалы на одну попытку на нужное число попыток. Для 95% вероятности при шансе 60% это 4 попытки; для 99% — 6 попыток. Если рецепт дорогой, закладывайте больше: среднее не защищает от длинной неудачной серии.</p>
     <h2>Что влияет на шанс</h2>
     <ul>
       <li>Шанс указан в самом рецепте: 60%, 70% или 25%.</li>
       <li>Грейд не меняет шанс, но меняет материалы и стоимость провала.</li>
       <li>Предыдущие попытки не влияют на следующую.</li>
       <li>На приватных серверах шанс могут изменить — проверяйте описание проекта.</li>
     </ul>`;

  return guidePage({
    slug: 'craft-chances',
    title,
    h1: 'Шансы крафта Lineage 2 Interlude',
    description,
    intro,
    content,
    faq,
    related: [
      { url: '/l2craft/craft/', label: 'Все 179 рецептов' },
      { url: '/l2craft/guides/60-percent/', label: 'Крафт 60%: сколько попыток' }
    ]
  });
}

function guide60() {
  const rows = [1, 2, 3, 5, 10, 25, 50, 100].map(n => `<tr>
    <td>${n}</td>
    <td>${esc(fmtProb(1 - Math.pow(0.4, n)))}</td>
  </tr>`).join('');
  const faq = [
    { q: 'Сколько попыток в среднем нужно при 60%?', a: '1,67 попытки. Медиана — 1 попытка, для 95% вероятности — 4 попытки.' },
    { q: 'Можно ли гарантировать крафт за N попыток?', a: 'Нет. Даже 100 попыток не дают абсолютной гарантии, хотя вероятность успеха становится очень высокой.' },
    { q: 'Шанс растёт после провалов?', a: 'Нет. Каждая попытка независима и имеет фиксированный шанс 60%.' },
    { q: 'Сколько материалов нужно на 10 попыток?', a: 'Зависит от рецепта: умножьте материалы на одну попытку на 10. В калькуляторе это показывает таблица «Материалы на разное число попыток».' }
  ];

  const title = 'Крафт 60% в Lineage 2 Interlude — сколько попыток и материалов';
  const description = 'Сколько попыток нужно при шансе крафта 60%: среднее 1,67, медиана 1, 95% вероятность за 4 попытки. Таблица вероятностей и расход материалов.';
  const intro = `<p>Шанс 60% — самый массовый в Interlude. Он не означает «успех за две попытки»: это среднее 1,67 попытки, а серии провалов — нормальная часть распределения. Ниже — точная математика.</p>`;
  const content = `
    <h2>Вероятность успеха за N попыток</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Попыток</th><th>Шанс хотя бы одного успеха</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="note">Формула: P = 1 − (1 − 0,6)<sup>N</sup>. После каждого провала вероятность следующей попытки всё равно 60%.</p>
    <h2>Сколько материалов</h2>
    <p>Материалы на N попыток = материалы на одну попытку × N. При провале они теряются, поэтому реальный расход зависит от того, на какой попытке выпал успех. В калькуляторе у каждого рецепта есть таблица для 1, 5, 10, 25 и 100 попыток.</p>
    <h2>Почему 60% кажется обманом</h2>
    <p>Вероятность хотя бы одного успеха за 4 попытки — 97,4%. То есть успех почти гарантирован, но не абсолютен. При этом вероятность встретить серию из 5 провалов подряд — около 1%, и на длинной дистанции такие серии случаются.</p>
    <h2>Что делать</h2>
     <p>Считайте не «шанс на успех», а бюджет: сколько материалов вы готовы потратить на 95% вероятность. Для 60% это 4 попытки. Если рецепт дорогой, закладывайте больше.</p>
     <h2>Пример: Sword of Miracles</h2>
     <p>Sword of Miracles требует 724 предмета на одну попытку. Четыре попытки для 95% вероятности — это 2 896 предметов. Пятая попытка не «помнит» предыдущие провалы: её шанс всё равно 60%.</p>
     <h2>Как пользоваться калькулятором</h2>
     <ol>
       <li>Откройте страницу рецепта и посмотрите таблицу «Материалы на разное число попыток».</li>
       <li>Сравните бюджет на 4 и 6 попыток: это 95% и 99% вероятности.</li>
       <li>В симуляторе нажмите «До успеха», чтобы увидеть реальную серию, но не принимайте один результат за статистику.</li>
     </ol>`;

  return guidePage({
    slug: '60-percent',
    title,
    h1: 'Крафт 60%: сколько попыток и материалов',
    description,
    intro,
    content,
    faq,
    related: [
      { url: '/l2craft/craft/chance/60/', label: 'Все рецепты 60%' },
      { url: '/l2craft/guides/craft-chances/', label: 'Шансы крафта 60/70/25' }
    ]
  });
}

function guideTitan() {
  const r = recipes.find(x => x.chance === 25);
  const name = r ? r.result.name : 'Titan\'s Powerstone';
  const faq = [
    { q: 'Какой шанс у Titan\'s Powerstone?', a: '25% — единственный рецепт с таким шансом в Interlude. Три из четырёх попыток в среднем заканчиваются провалом.' },
    { q: 'Сколько попыток нужно для 95%?', a: '11 попыток. Среднее — 4 попытки, медиана — 3.' },
    { q: 'Расходуется ли рецепт?', a: r && !r.direct.some(d => d.name.startsWith('Recipe:')) ? 'Нет, это квестовый рецепт.' : 'Да, рецепт расходуется при каждой попытке.' },
    { q: 'Почему шанс 25%?', a: 'Это уникальное значение в базе Interlude. Оно встречается ровно один раз и относится к Titan\'s Powerstone.' }
  ];
  const title = 'Titan\'s Powerstone — рецепт с шансом 25% в Lineage 2 Interlude';
  const description = 'Titan\'s Powerstone — единственный рецепт Lineage 2 Interlude с шансом 25%. Материалы, Create Item, MP и математика попыток: среднее 4, 95% за 11.';
  const intro = `<p><strong>Titan's Powerstone</strong> — единственный рецепт в Interlude с шансом 25%. Это худший шанс в игре: три четверти попыток в среднем заканчиваются провалом. Ниже — материалы и математика.</p>`;
  const content = r ? `
    <h2>Рецепт</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
      <tbody>
        <tr><td>Шанс</td><td>${r.chance}%</td></tr>
        <tr><td>Create Item</td><td>${r.craftLevel}</td></tr>
        <tr><td>MP</td><td>${fmt(r.mp)}</td></tr>
        <tr><td>Выход</td><td>${fmt(r.resultCount)}</td></tr>
        <tr><td>Материалов на попытку</td><td>${fmt(materialSum(r))}</td></tr>
      </tbody>
    </table></div>
    <h2>Материалы</h2>
    <div class="material-grid">${r.direct.map(d => materialCard(d, prefixFor(2), r)).join('')}</div>
    <h2>Сколько попыток</h2>
    <div class="formula">
      <div>Среднее: <b>${fmtDec(expectedAttempts(r))}</b> попытки</div>
      <div>Медиана: <b>${medianAttempts(r)}</b> попытки</div>
      <div>95% вероятность: <b>${attemptsFor95(r)}</b> попыток</div>
      <div>Материалов на 95%: <b>${fmt(materialSum(r) * attemptsFor95(r))}</b> шт.</div>
    </div>
    <p class="note">Даже 11 попыток не дают абсолютной гарантии — это вероятность хотя бы одного успеха 95%.</p>
     <h2>Почему это уникальный случай</h2>
     <p>Во всей базе Interlude шанс 25% встречается ровно один раз. Остальные шансовые рецепты — это 60% и 70%. Titan's Powerstone стоит особняком: он требует больше попыток и материалов, чем любой другой рецепт с шансом.</p>
     <h2>Стоит ли крафтить</h2>
     <p>Считайте не только среднее, но и худший сценарий: 11 попыток — это 95% вероятность, а не гарантия. Если каждая попытка дорогая, бюджет может вырасти в разы. В симуляторе можно прогнать серию и увидеть, как часто успех приходит позже среднего.</p>
     <div class="seo-subnav"><a href="${craftPath(r)}">Страница ${esc(name)}</a><a href="/l2craft/craft/chance/25/">Все рецепты 25%</a></div>` : '<p>Данные рецепта не найдены.</p>';

  return guidePage({
    slug: 'titans-powerstone',
    title,
    h1: 'Titan\'s Powerstone — рецепт 25%',
    description,
    intro,
    content,
    faq,
    related: [{ url: '/l2craft/craft/chance/25/', label: 'Рецепты 25%' }]
  });
}

function guideBlessed() {
  const faq = [
    { q: 'Благословенный свиток повышает шанс?', a: 'Нет. Шанс успеха такой же, как у обычного. Отличается только провал.' },
    { q: 'Что происходит при провале обычного свитка?', a: 'Предмет разрушается. Материалы и заточка теряются.' },
    { q: 'Что происходит при провале благословенного?', a: 'Предмет остаётся, но заточка сбрасывается на +0.' },
    { q: 'Когда использовать благословенный свиток?', a: 'Когда предмет дорогой и потеря недопустима. Для дешёвых предметов обычный свиток может быть выгоднее.' }
  ];
  const title = 'Обычный или благословенный свиток заточки в Lineage 2 Interlude';
  const description = 'Разница между обычным и благословенным свитком заточки Interlude: одинаковый шанс, но обычный разрушает предмет, а благословенный сбрасывает на +0.';
  const intro = `<p>Обычный и благословенный свитки заточки имеют одинаковый шанс успеха. Вся разница — в провале: первый разрушает предмет, второй оставляет его, но сбрасывает заточку на +0.</p>`;
  const content = `
    <h2>Сравнение</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Свиток</th><th>Шанс</th><th>Провал</th><th>Когда использовать</th></tr></thead>
      <tbody>
        <tr><td>Обычный</td><td>Как у типа предмета</td><td>разрушение</td><td>дешёвые предметы, есть запасной</td></tr>
        <tr><td>Благословенный</td><td>Тот же</td><td>сброс на +0</td><td>дорогие предметы, нет замены</td></tr>
      </tbody>
    </table></div>
    <h2>Почему благословенный не «лучше»</h2>
    <p>Он не повышает шанс. Если вы точите дешёвый предмет и готовы купить новый, обычный свиток может быть выгоднее. Благословенный нужен там, где потеря предмета стоит дороже свитков.</p>
    <h2>Пример</h2>
    <p>При заточке физического оружия до +10 средний расход — около 13 свитков. Обычный свиток может разрушить предмет на любом шаге выше +3. Благословенный сохранит предмет, но отбросит заточку на +0, и путь придётся начинать заново.</p>
    <h2>Максимум +16</h2>
     <p>После +16 заточка недоступна. Safe-зона — +3, для цельного доспеха +4.</p>
     <h2>Экономика выбора</h2>
     <p>Сравнивайте стоимость благословенного свитка с ценой предмета. Если предмет дешевле разницы в цене свитков, обычный вариант может быть рациональнее. Если предмет уникальный или дорогой, благословенный свиток ограничивает потерю только заточкой.</p>
     <h2>Когда обычный выгоднее</h2>
     <ul>
       <li>Предмет дешёвый и его легко купить снова.</li>
       <li>У вас есть запасной экземпляр.</li>
       <li>Вы точите только до safe-уровня, где провала нет.</li>
       <li>Разница в цене свитков больше стоимости предмета.</li>
     </ul>
     <h2>Когда благословенный оправдан</h2>
     <ul>
       <li>Предмет дорогой, редкий или единственный.</li>
       <li>Потеря предмета остановит прогресс.</li>
       <li>Вы точите выше safe-зоны и готовы к сбросу на +0.</li>
     </ul>`;

  return guidePage({
    slug: 'blessed-scroll',
    title,
    h1: 'Обычный или благословенный свиток',
    description,
    intro,
    content,
    faq,
    related: [
      { url: '/l2craft/enchant/', label: 'Заточка D–S' },
      { url: '/l2craft/guides/enchant-chances/', label: 'Шансы заточки +3…+16' }
    ]
  });
}

function guideGrades() {
  const rows = GRADE_ORDER.map(grade => {
    const list = recipes.filter(r => r.result.grade === grade);
    const chances = [60, 70, 25].map(c => list.filter(r => r.chance === c).length).filter(Boolean);
    return `<tr>
      <td><a href="/l2craft/craft/grade/${grade.toLowerCase()}/">${grade}</a></td>
      <td>${list.length}</td>
      <td>${chances.length ? chances.join(' / ') : '—'}</td>
    </tr>`;
  }).join('');

  const faq = [
    { q: 'Сколько рецептов в каждом грейде?', a: 'Распределение зависит от грейда; точные цифры — в таблице выше и на страницах грейдов.' },
    { q: 'Влияет ли грейд на шанс крафта?', a: 'Нет. Шанс указан в рецепте: 60%, 70% или 25%. Грейд влияет на материалы, уровень Create Item и стоимость.' },
    { q: 'С чего начать крафт?', a: 'С D–C грейда: там меньше материалов и ниже требования Create Item. Затем переходите к B/A/S.' }
  ];
  const title = 'Крафт D–S в Lineage 2 Interlude — грейды и шансы';
  const description = 'Крафт D–S в Lineage 2 Interlude: сколько шансовых рецептов в каждом грейде, какие шансы 60/70/25% и где смотреть материалы.';
  const intro = `<p>Шансовые рецепты есть во всех грейдах. Ниже — распределение по D, C, B, A, S и NG, а также ссылки на полные списки с материалами и шансами.</p>`;
  const content = `
    <h2>Рецепты по грейдам</h2>
    <div class="table-wrap"><table class="res-table">
      <thead><tr><th>Грейд</th><th>Рецептов</th><th>Шансы</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>Что важно</h2>
     <p>Грейд не меняет шанс крафта — он указан в рецепте. Но грейд определяет материалы, уровень Create Item и стоимость ошибки. Чем выше грейд, тем дороже провал.</p>
     <h2>С чего начать</h2>
     <p>Начинайте с D и C: там меньше материалов и ниже требования Create Item. Затем переходите к B, A и S. Если вы крафтите на продажу, сравните стоимость материалов с ценой готового предмета — шанс 60% может сделать производство убыточным.</p>
     <h2>Что крафтить на каждом грейде</h2>
     <ul>
       <li><strong>D–C:</strong> стартовое оружие и броня, низкие требования Create Item.</li>
       <li><strong>B:</strong> промежуточные сеты и оружие для среднего уровня.</li>
       <li><strong>A:</strong> топовые сеты и оружие, дорогие материалы.</li>
       <li><strong>S:</strong> максимальные предметы Interlude, самые дорогие провалы.</li>
       <li><strong>NG:</strong> отдельные квестовые и декоративные предметы.</li>
     </ul>
     <p>На страницах грейдов есть полные списки рецептов с шансами и материалами. Для каждого предмета доступен расчёт попыток и бюджета.</p>
     <div class="seo-subnav">${GRADE_ORDER.map(grade => `<a href="/l2craft/craft/grade/${grade.toLowerCase()}/">${grade}-грейд</a>`).join('')}</div>`;

  return guidePage({
    slug: 'grade-d-s',
    title,
    h1: 'Крафт D–S в Interlude',
    description,
    intro,
    content,
    faq,
    related: [
      { url: '/l2craft/craft/', label: 'Все рецепты' },
      { url: '/l2craft/guides/craft-chances/', label: 'Шансы 60/70/25' }
    ]
  });
}

/* ---------- запись ---------- */

function write(relativePath, content) {
  const full = path.join(DIR, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const pages = [];
pages.push(craftHub());
pages.push(enchantHub());
pages.push(statsPage());
pages.push(apiPage());
pages.push(guidesHub());
pages.push(guideEnchantChances());
pages.push(guideCraftChances());
pages.push(guide60());
pages.push(guideTitan());
pages.push(guideBlessed());
pages.push(guideGrades());

for (const r of recipes) pages.push(craftPage(r));
for (const item of enchantItems) pages.push(enchantPage(item));
for (const chance of [60, 70, 25]) pages.push(chancePage(chance));
for (const grade of GRADE_ORDER) pages.push(craftGradePage(grade));
for (const type of ['weapon', 'armor', 'jewelry']) pages.push(enchantTypePage(type));
for (const grade of GRADE_ORDER) pages.push(enchantGradePage(grade));

for (const p of pages) {
  const rel = p.url.replace('/l2craft/', '').replace(/\/$/, '') + '/index.html';
  write(rel, p.html);
}

write('api/recipes.json', JSON.stringify({ meta: DATA.meta, recipes: DATA.recipes }));
write('api/enchant.json', JSON.stringify({ source: EN.source, rates: EN.rates, items: EN.items }));

const sitemapEntries = [
  { loc: BASE + '/', priority: '1.0', changefreq: 'weekly' },
  ...pages.map(p => ({ loc: SITE + p.url, priority: p.url.includes('/craft/') || p.url.includes('/enchant/') ? '0.8' : '0.7', changefreq: 'monthly' }))
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(e => `  <url><loc>${e.loc}</loc><lastmod>${UPDATED}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`).join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

console.log(`Готово: ${pages.length} страниц + sitemap + API`);
console.log(`Рецептов: ${recipes.length}, предметов заточки: ${enchantItems.length}`);
