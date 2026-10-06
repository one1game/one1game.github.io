#!/usr/bin/env python3
"""
SEO/AEO-усиление статей для One1Game.

Что делает для каждой HTML-страницы в archive/ (только там, где это уместно):
  1) Добавляет блок «Коротко» (answer-first) сразу после открытия <article>.
     Текст берётся из <meta name="description"> — без выдумывания, только реальные данные.
  2) Добавляет "speakable" в JSON-LD блок со "@type": "Article" (для голосовых/ИИ-ответов).
  3) Приводит <meta name="robots"> к единому виду index, follow, max-image-preview:large.

Безопасность:
  - JSON-LD пересобирается через json.loads/json.dumps, то есть остаётся гарантированно валидным.
  - Скрипт идемпотентен: повторный запуск ничего не дублирует.
  - По умолчанию работает в режиме отчёта. Запись — только с флагом --apply.

Использование:
    python scripts/seo_aeo.py            # отчёт (ничего не пишет)
    python scripts/seo_aeo.py --apply    # применить
"""

import html
import json
import re
import sys
from pathlib import Path

ARCHIVE = Path("archive")
ARTICLE_OPEN = re.compile(r'<article class="article-body"[^>]*>', re.IGNORECASE)
META_DESC = re.compile(r'<meta name="description" content="([^"]*)"', re.IGNORECASE)
ROBOTS = re.compile(r'<meta name="robots" content="([^"]*)"', re.IGNORECASE)
LDJSON = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.IGNORECASE | re.DOTALL)
UNIFIED_ROBOTS = "index, follow, max-image-preview:large"


def add_speakable(text):
    """Добавляет speakable в JSON-LD Article. Возвращает (текст, изменено ли)."""
    changed = False

    def repl(m):
        nonlocal changed
        raw = m.group(1)
        try:
            data = json.loads(raw)
        except Exception:
            return m.group(0)
        items = data if isinstance(data, list) else [data]
        touched = False
        for obj in items:
            if isinstance(obj, dict) and obj.get("@type") == "Article":
                if "speakable" not in obj:
                    obj["speakable"] = {
                        "@type": "SpeakableSpecification",
                        "cssSelector": ["h1", ".article-body p:first-of-type"],
                    }
                    touched = True
        if not touched:
            return m.group(0)
        changed = True
        body = json.dumps(data, ensure_ascii=False, indent=2)
        return '<script type="application/ld+json">\n' + body + "\n  </script>"

    return LDJSON.sub(repl, text), changed


def process(path, apply):
    src = path.read_text(encoding="utf-8")
    orig = src
    notes = []

    # 1) Блок «Коротко» (answer-first)
    if 'id="quick-answer"' not in src and "Короткий ответ" not in src:
        m_open = ARTICLE_OPEN.search(src)
        m_desc = META_DESC.search(src)
        if m_open and m_desc:
            desc = html.escape(m_desc.group(1).strip(), quote=False)
            if len(desc) >= 60:
                block = (
                    m_open.group(0)
                    + '\n      <div class="quick-answer" id="quick-answer" '
                    'style="margin:18px 0;padding:14px 18px;'
                    'border-left:3px solid var(--cyan,#7dff9b);'
                    'background:rgba(125,255,155,.06);border-radius:8px;line-height:1.7">'
                    "<strong>Коротко:</strong> " + desc + "</div>"
                )
                src = src[: m_open.start()] + block + src[m_open.end():]
                notes.append("quick-answer")

    # 2) speakable в Article
    src, sp = add_speakable(src)
    if sp:
        notes.append("speakable")

    # 3) единый robots
    def robots_repl(m):
        nonlocal src
        if m.group(1).strip() != UNIFIED_ROBOTS:
            return f'<meta name="robots" content="{UNIFIED_ROBOTS}"'
        return m.group(0)

    new_src, n = ROBOTS.subn(robots_repl, src)
    if n:
        src = new_src
        notes.append("robots")

    if src != orig and apply:
        path.write_text(src, encoding="utf-8")
    return notes


def validate():
    """Проверяет, что все JSON-LD блоки в archive/ — валидный JSON."""
    total = 0
    bad = 0
    for f in sorted(ARCHIVE.glob("*.html")):
        src = f.read_text(encoding="utf-8")
        for m in LDJSON.findall(src):
            total += 1
            try:
                json.loads(m)
            except Exception as e:
                bad += 1
                print(f"  BAD {f.name}: {e}")
    print(f"JSON-LD блоков: {total}, повреждённых: {bad}")
    return bad


def fix_json():
    """Чинит невалидные JSON-LD (висячие запятые) в archive/: парсит и пересобирает."""
    trailing = re.compile(r",(\s*[}\]])")
    fixed = 0
    for f in sorted(ARCHIVE.glob("*.html")):
        src = f.read_text(encoding="utf-8")

        def repl(m):
            nonlocal fixed
            raw = m.group(1)
            try:
                json.loads(raw)
                return m.group(0)
            except Exception:
                cleaned = trailing.sub(r"\1", raw)
                try:
                    data = json.loads(cleaned)
                except Exception:
                    return m.group(0)
                fixed += 1
                body = json.dumps(data, ensure_ascii=False, indent=2)
                return '<script type="application/ld+json">\n' + body + "\n  </script>"

        new = LDJSON.sub(repl, src)
        if new != src:
            f.write_text(new, encoding="utf-8")
    print(f"Исправлено JSON-LD блоков: {fixed}")


CAT_SLUGS = {
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
CATEGORY_BADGE = re.compile(r'<span class="article-category (cat-[a-z]+)">([^<]+)</span>')


def link_categories():
    """Превращает бейдж категории в ссылку на страницу-хаб (внутренняя перелинковка)."""
    changed = 0
    for f in sorted(ARCHIVE.glob("*.html")):
        src = f.read_text(encoding="utf-8")

        def repl(m):
            nonlocal changed
            cls, label = m.group(1), m.group(2).strip()
            slug = CAT_SLUGS.get(label)
            if not slug:
                return m.group(0)
            changed += 1
            return f'<a class="article-category {cls}" href="/category/{slug}.html">{label}</a>'

        new = CATEGORY_BADGE.sub(repl, src)
        if new != src:
            f.write_text(new, encoding="utf-8")
    print(f"Ссылки на хабы в статьях: {changed}")


def main():
    if "--validate" in sys.argv:
        sys.exit(1 if validate() else 0)
    if "--fix-json" in sys.argv:
        fix_json()
        return
    if "--link-categories" in sys.argv:
        link_categories()
        return

    apply = "--apply" in sys.argv
    files = sorted(ARCHIVE.glob("*.html"))
    stats = {"quick-answer": 0, "speakable": 0, "robots": 0}
    touched = 0
    for f in files:
        try:
            notes = process(f, apply)
        except Exception as e:
            print(f"  ОШИБКА {f.name}: {e}")
            continue
        if notes:
            touched += 1
            for n in notes:
                stats[n] += 1
    mode = "ПРИМЕНЕНО" if apply else "ОТЧЁТ (без записи)"
    print(f"[{mode}] файлов всего: {len(files)}, затронуто: {touched}")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
