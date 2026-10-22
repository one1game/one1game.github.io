#!/usr/bin/env python3
"""
Генерация страниц-хабов категорий для One1Game.

Создаёт /category/<slug>.html по одной на каждую категорию из articles-data.js.
Хаб собирает все статьи раздела ссылками (topical authority + внутренняя перелинковка),
оформлен в шаблоне сайта (общая шапка/футер подключаются через /components.js).

Идемпотентно: файлы перезаписываются. Запуск: python scripts/gen_category_hubs.py
"""

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

DATA_FILE = Path("articles-data.js")
OUT_DIR = Path("category")
BASE = "https://one1game.org"

# Категория → slug URL
SLUGS = {
    "ИИ и технологии": "ii-i-tehnologii",
    "Аналитика": "analitika",
    "Гайды": "gajdy",
    "Консоли": "konsoli",
    "Тренды": "trendy",
    "Разработка": "razrabotka",
    "Мнение": "mnenie",
    "Кино и игры": "kino-i-igry",
    "Обзоры": "obzory",
}

MONTHS = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}


def parse_articles(content):
    items = []
    for block in re.findall(r"\{[^{}]*\}", content, re.DOTALL):
        def g(key):
            m = re.search(r'"' + key + r'"\s*:\s*"((?:[^"\\]|\\.)*)"', block)
            return m.group(1) if m else ""
        url = g("url")
        if not url:
            continue
        items.append({
            "url": url,
            "title": g("title"),
            "excerpt": g("excerpt"),
            "date": g("date"),
            "readTime": g("readTime"),
            "category": g("category"),
            "updated": g("updated"),
            "image": g("image"),
            "ai": bool(re.search(r'"ai"\s*:\s*true', block)),
        })
    return items


def read_minutes(value):
    m = re.search(r"\d+", value or "")
    return int(m.group()) if m else 0


def sort_key(a):
    s = a.get("updated") or ""
    if s:
        return s
    m = re.fullmatch(r"(\d{1,2})\s+([а-яё]+)\s+(\d{4})", a.get("date", ""), re.IGNORECASE)
    if m and m.group(2).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return "0000-00-00"


def esc(s):
    return html.escape(s or "", quote=True)


FILTER_CSS = """
    .cat-filters { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; margin: 0 0 18px; padding: 12px 14px; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 12px; background: rgba(125,255,155,.03); }
    .cat-search { display: flex; align-items: center; gap: 8px; flex: 1 1 240px; min-width: 200px; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 8px; padding: 7px 10px; }
    .cat-search input { width: 100%; background: transparent; border: 0; outline: none; color: var(--text, #d7dee6); font: inherit; font-size: .9rem; }
    .cat-search i { color: var(--text-faint, #75808d); font-size: .8rem; }
    .cat-src { display: flex; gap: 6px; flex-wrap: wrap; }
    .cat-sort, .cat-year { display: flex; align-items: center; gap: 6px; color: var(--text-faint, #75808d); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }
    .cat-sort select, .cat-year select { background: var(--panel, #0a0f14); color: var(--text, #d7dee6); border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: .8rem; text-transform: none; }
    .cat-reset { background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); color: var(--text-dim, #8f99a6); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: .7rem; cursor: pointer; text-transform: uppercase; letter-spacing: .05em; }
    .cat-reset:hover { color: var(--acid, #7dff9b); border-color: var(--line-hi, rgba(125,255,155,.34)); }
    .cat-count { font-size: .74rem; color: var(--text-faint, #75808d); margin-left: auto; }
    .cat-item[hidden] { display: none; }
    .cat-empty { padding: 18px; border: 1px dashed var(--line, rgba(125,255,155,.16)); border-radius: 10px; color: var(--text-dim, #8f99a6); text-align: center; }
    .cat-empty button { margin-left: 8px; background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); color: var(--acid, #7dff9b); border-radius: 999px; padding: 5px 12px; font: inherit; font-size: .76rem; cursor: pointer; }
    @media (max-width: 600px) {
      .cat-count { margin-left: 0; width: 100%; }
      .cat-sort, .cat-year { flex: 1 1 45%; }
      .cat-sort select, .cat-year select { flex: 1; }
    }
"""


FILTER_JS = r"""
(function () {
  var list = document.querySelector('.cat-list');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.cat-item'));
  if (!items.length) return;

  var metas = items.map(function (el) {
    var strong = el.querySelector('strong');
    return {
      el: el,
      title: (strong ? strong.textContent : '').toLowerCase(),
      text: el.textContent.toLowerCase(),
      date: el.getAttribute('data-date') || '',
      read: parseInt(el.getAttribute('data-read') || '0', 10) || 0,
      ai: el.getAttribute('data-ai') === '1'
    };
  });

  var search = document.getElementById('cat-search');
  var sortSel = document.getElementById('cat-sort');
  var yearSel = document.getElementById('cat-year');
  var count = document.getElementById('cat-count');
  var empty = document.getElementById('cat-empty');
  var more = document.getElementById('cat-more');
  var PAGE = 20;
  var shown = PAGE;
  var reset = document.getElementById('cat-reset');
  var pills = Array.prototype.slice.call(document.querySelectorAll('.cat-src .cat-pill'));
  var params = new URLSearchParams(location.search);
  var src = pills.length ? (params.get('src') || 'all') : 'all';

  if (params.get('q')) search.value = params.get('q');
  if (params.get('sort')) sortSel.value = params.get('sort');
  if (params.get('year')) yearSel.value = params.get('year');

  function setSrc(value) {
    src = value;
    pills.forEach(function (b) {
      var on = b.getAttribute('data-src') === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function apply(save) {
    var q = search.value.trim().toLowerCase();
    var year = yearSel.value;
    var sort = sortSel.value;
    var visible = [];

    metas.forEach(function (m) {
      var ok = true;
      if (q && m.text.indexOf(q) === -1) ok = false;
      if (ok && year !== 'all' && m.date.slice(0, 4) !== year) ok = false;
      if (ok && src === 'human' && m.ai) ok = false;
      if (ok && src === 'ai' && !m.ai) ok = false;
      m.el.hidden = !ok;
      if (ok) visible.push(m);
    });

    visible.sort(function (a, b) {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ru');
      if (sort === 'read') return a.read - b.read;
      var d = a.date.localeCompare(b.date);
      return sort === 'old' ? d : -d;
    });
    visible.forEach(function (m) { list.appendChild(m.el); });

    var limit = Math.min(shown, visible.length);
    visible.forEach(function (m, i) { m.el.hidden = i >= limit; });

    count.textContent = 'Показано ' + limit + ' из ' + visible.length;
    empty.hidden = visible.length !== 0;
    more.hidden = visible.length <= limit;
    more.textContent = 'Показать ещё ' + Math.min(PAGE, Math.max(visible.length - limit, 0));

    if (save !== false) {
      var p = new URLSearchParams();
      if (q) p.set('q', q);
      if (src !== 'all') p.set('src', src);
      if (sort !== 'new') p.set('sort', sort);
      if (year !== 'all') p.set('year', year);
      var qs = p.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }
  }

  setSrc(src);
  search.addEventListener('input', function () { shown = PAGE; apply(); });
  sortSel.addEventListener('change', function () { shown = PAGE; apply(); });
  yearSel.addEventListener('change', function () { shown = PAGE; apply(); });
  pills.forEach(function (b) {
    b.addEventListener('click', function () { setSrc(b.getAttribute('data-src')); shown = PAGE; apply(); });
  });
  more.addEventListener('click', function () { shown += PAGE; apply(false); });
  reset.addEventListener('click', function () {
    search.value = '';
    setSrc('all');
    sortSel.value = 'new';
    yearSel.value = 'all';
    shown = PAGE;
    apply();
    search.focus();
  });
  empty.querySelector('button').addEventListener('click', function () { reset.click(); });

  list.classList.remove('is-collapsed');
  apply(false);
})();
"""


def build_hub(category, slug, items):
    items = sorted(items, key=sort_key, reverse=True)
    url = f"{BASE}/category/{slug}"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    title = f"{category} — все статьи и обзоры 2026 | One1Game"
    human_count = sum(1 for it in items if not it["ai"])
    desc = f"Все материалы раздела «{category}»: {len(items)} статей и обзоров с датами и краткими описаниями. Обновляется автоматически."

    years = sorted({sort_key(it)[:4] for it in items if sort_key(it) != "0000-00-00"}, reverse=True)
    year_options = '      <option value="all">Все годы</option>\n' + "\n".join(
        f'      <option value="{y}">{y}</option>' for y in years
    )

    ai_count = len(items) - human_count
    src_filter = ""
    if human_count and ai_count:
        src_filter = (
            '      <div class="cat-src" role="group" aria-label="Тип материалов">\n'
            '        <button type="button" class="cat-pill active" data-src="all" aria-pressed="true">Все</button>\n'
            '        <button type="button" class="cat-pill" data-src="human" aria-pressed="false">Авторские</button>\n'
            '        <button type="button" class="cat-pill" data-src="ai" aria-pressed="false">ИИ-обзоры</button>\n'
            '      </div>\n'
        )

    rows = "\n".join(
        f'        <a class="cat-item" href="{esc(it["url"])}"'
        f' data-date="{sort_key(it)}"'
        f' data-read="{read_minutes(it["readTime"])}"'
        f' data-ai="{1 if it["ai"] else 0}">'
        f'<span class="cat-thumb">'
        f'<img src="{esc(it["image"])}" alt="" loading="lazy" width="460" height="215" decoding="async">'
        f'</span>'
        f'<span class="cat-body">'
        f'<strong>{esc(it["title"])}</strong>'
        f'<span class="cat-excerpt">{esc(it["excerpt"])}</span>'
        f'<em>{esc(it["date"])}{(" · " + esc(it["readTime"])) if it["readTime"] else ""}</em>'
        f'</span>'
        f"</a>"
        for it in items
    )

    item_list = {
        "@type": "ItemList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f'{BASE}{it["url"]}', "name": it["title"]}
            for i, it in enumerate(items[:50])
        ],
    }
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{BASE}/"},
                    {"@type": "ListItem", "position": 2, "name": "Статьи", "item": f"{BASE}/archive"},
                    {"@type": "ListItem", "position": 3, "name": category, "item": url},
                ],
            },
            {
                "@type": "CollectionPage",
                "name": title,
                "url": url,
                "description": desc,
                "inLanguage": "ru-RU",
                "dateModified": today,
                "isPartOf": {"@id": f"{BASE}/#website"},
                "mainEntity": item_list,
            },
        ],
    }

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<script>if(location.hostname==='one1game.github.io'){{location.replace('https://one1game.org'+location.pathname+location.search+location.hash);}}</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="canonical" href="{url}" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(desc)}" />
  <meta property="og:url" content="{url}" />
  <script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
  </script>
  <link rel="manifest" href="/manifest.json" />
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" onload="this.rel='stylesheet';this.removeAttribute('onload')" /><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" /></noscript>
  <link rel="stylesheet" href="/styles.css?v=46" />
  <style>
    .cat-page {{ padding: 26px 0 40px; }}
    .cat-title {{ font-size: clamp(1.5rem, 3vw, 2.1rem); margin: 8px 0 6px; }}
    .cat-lead {{ color: var(--text-dim, #8f99a6); margin-bottom: 22px; }}
    .cat-list {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }}
    .cat-item {{ display: flex; flex-direction: column; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 12px; overflow: hidden; text-decoration: none; color: var(--text, #d7dee6); background: rgba(255,255,255,.02); transition: border-color .15s, transform .15s; }}
    .cat-item:hover {{ border-color: var(--line-hi, rgba(125,255,155,.34)); transform: translateY(-2px); }}
    .cat-item[hidden] {{ display: none; }}
    .cat-list.is-collapsed .cat-item:nth-child(n+21) {{ display: none; }}
    .cat-thumb {{ display: block; aspect-ratio: 460 / 215; overflow: hidden; background: #0a0f14; }}
    .cat-thumb img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    .cat-body {{ display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; flex: 1; }}
    .cat-item strong {{ display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: .95rem; line-height: 1.35; }}
    .cat-excerpt {{ display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-dim, #8f99a6); font-size: .8rem; line-height: 1.45; margin: 0; }}
    .cat-item em {{ margin-top: auto; padding-top: 4px; color: var(--text-faint, #75808d); font-size: .72rem; font-style: normal; text-transform: uppercase; letter-spacing: .05em; }}
    .cat-more {{ display: block; margin: 18px auto 0; padding: 10px 22px; background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 999px; color: var(--acid, #7dff9b); font: inherit; font-size: .8rem; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; }}
    .cat-more:hover {{ border-color: var(--line-hi, rgba(125,255,155,.34)); }}
    .cat-more[hidden] {{ display: none; }}
    @media (max-width: 1100px) {{ .cat-list {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }} }}
    @media (max-width: 820px) {{ .cat-list {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
    @media (max-width: 560px) {{ .cat-list {{ grid-template-columns: 1fr; }} }}
{FILTER_CSS}
  </style>
</head>
<body>
<main id="main-content">
  <div class="container cat-page">
    <a href="/archive" class="article-back"><i class="fas fa-arrow-left" aria-hidden="true"></i> К списку статей</a>
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a> → <a href="/archive">Статьи</a> → <span>{esc(category)}</span>
    </nav>
    <h1 class="cat-title">{esc(category)}: все статьи</h1>
    <p class="cat-lead">В разделе {len(items)} материалов, из них {human_count} авторских. По умолчанию — от новых к старым.</p>
    <div class="cat-filters">
      <label class="cat-search">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input type="search" id="cat-search" placeholder="Поиск по разделу…" aria-label="Поиск по статьям раздела" autocomplete="off">
      </label>
{src_filter}
      <label class="cat-sort">Сортировка
        <select id="cat-sort">
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="title">По названию</option>
          <option value="read">По времени чтения</option>
        </select>
      </label>
      <label class="cat-year">Год
        <select id="cat-year">
{year_options}
        </select>
      </label>
      <button type="button" class="cat-reset" id="cat-reset">Сбросить</button>
      <span class="cat-count" id="cat-count" aria-live="polite"></span>
    </div>
    <div class="cat-list is-collapsed">
{rows}
    </div>
    <div class="cat-empty" id="cat-empty" hidden>Ничего не найдено. <button type="button">Сбросить фильтр</button></div>
    <button type="button" class="cat-more" id="cat-more" hidden>Показать ещё</button>
  </div>
</main>
<script src="/cache-version.js"></script>
<script>{FILTER_JS}</script>
<script src="/components.js?v=41" defer></script>
</body>
</html>
"""


def main():
    content = DATA_FILE.read_text(encoding="utf-8")
    items = parse_articles(content)
    by_cat = {}
    for it in items:
        by_cat.setdefault(it["category"], []).append(it)

    to_stdout = "--stdout" in sys.argv

    OUT_DIR.mkdir(exist_ok=True)
    made = 0
    for cat, slug in SLUGS.items():
        arts = by_cat.get(cat, [])
        if not arts:
            print(f"  пропуск (нет статей): {cat}", file=sys.stderr)
            continue
        page = build_hub(cat, slug, arts)
        if to_stdout:
            print(f"===FILE:{slug}===")
            print(page)
        else:
            (OUT_DIR / f"{slug}.html").write_text(page, encoding="utf-8")
            print(f"  OK {slug}.html — {len(arts)} статей")
        made += 1
    if not to_stdout:
        print(f"Готово: {made} хабов")


if __name__ == "__main__":
    main()
