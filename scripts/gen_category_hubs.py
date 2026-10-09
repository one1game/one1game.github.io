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
        })
    return items


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


def build_hub(category, slug, items):
    items = sorted(items, key=sort_key, reverse=True)
    url = f"{BASE}/category/{slug}.html"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    title = f"{category} — все статьи и обзоры 2026 | One1Game"
    desc = f"Все материалы раздела «{category}»: {len(items)} статей и обзоров с датами и краткими описаниями. Обновляется автоматически."

    rows = "\n".join(
        f'        <a class="cat-item" href="{esc(it["url"])}">'
        f'<strong>{esc(it["title"])}</strong>'
        f'<span>{esc(it["excerpt"])}</span>'
        f'<em>{esc(it["date"])}{(" · " + esc(it["readTime"])) if it["readTime"] else ""}</em>'
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
                    {"@type": "ListItem", "position": 2, "name": "Статьи", "item": f"{BASE}/archive.html"},
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
  <link rel="stylesheet" href="/styles.css?v=44" />
  <style>
    .cat-page {{ padding: 26px 0 40px; }}
    .cat-title {{ font-size: clamp(1.5rem, 3vw, 2.1rem); margin: 8px 0 6px; }}
    .cat-lead {{ color: var(--text-dim, #8f99a6); margin-bottom: 22px; }}
    .cat-list {{ display: grid; gap: 10px; }}
    .cat-item {{ display: block; padding: 14px 16px; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 10px; text-decoration: none; color: var(--text, #d7dee6); }}
    .cat-item:hover {{ border-color: var(--line-hi, rgba(125,255,155,.34)); }}
    .cat-item strong {{ display: block; font-size: 1.02rem; margin-bottom: 4px; }}
    .cat-item span {{ display: block; color: var(--text-dim, #8f99a6); font-size: .85rem; line-height: 1.5; margin-bottom: 6px; }}
    .cat-item em {{ color: var(--text-faint, #75808d); font-size: .74rem; font-style: normal; text-transform: uppercase; letter-spacing: .05em; }}
  </style>
</head>
<body>
<main id="main-content">
  <div class="container cat-page">
    <a href="/archive.html" class="article-back"><i class="fas fa-arrow-left" aria-hidden="true"></i> К списку статей</a>
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a> → <a href="/archive.html">Статьи</a> → <span>{esc(category)}</span>
    </nav>
    <h1 class="cat-title">{esc(category)}: все статьи</h1>
    <p class="cat-lead">В разделе {len(items)} материалов. Отсортированы от новых к старым.</p>
    <div class="cat-list">
{rows}
    </div>
  </div>
</main>
<script src="/cache-version.js"></script>
<script src="/components.js?v=35" defer></script>
</body>
</html>
"""


def main():
    content = DATA_FILE.read_text(encoding="utf-8")
    items = parse_articles(content)
    by_cat = {}
    for it in items:
        by_cat.setdefault(it["category"], []).append(it)

    OUT_DIR.mkdir(exist_ok=True)
    made = 0
    for cat, slug in SLUGS.items():
        arts = by_cat.get(cat, [])
        if not arts:
            print(f"  пропуск (нет статей): {cat}")
            continue
        (OUT_DIR / f"{slug}.html").write_text(build_hub(cat, slug, arts), encoding="utf-8")
        made += 1
        print(f"  OK {slug}.html — {len(arts)} статей")
    print(f"Готово: {made} хабов")


if __name__ == "__main__":
    main()
