# -*- coding: utf-8 -*-
"""Пересборка статических блоков «Похожие статьи» в /archive.

Зачем: блоки записываются один раз при генерации страницы. Любая статья,
добавленная в articles-data.js позже, не попадает в уже записанные блоки —
и остаётся без входящих ссылок.

Правила:
  * страницы каталога «Обзоры» (игры) — кольцо из 4 следующих записей каталога,
    ровно как pickRelated() в scripts/generate-games.js;
  * остальные (ручные статьи) — 3 ближайших по терминам + 1 сосед по каталогу.
    Сосед гарантирует, что ни одна страница не останется без входящих.

Запуск: python scripts/rebuild_related.py [--dry]
"""
import glob
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(ROOT, "archive")
DRY = "--dry" in sys.argv

GAME_CATEGORY = "Обзоры"

SCRIPT_RX = re.compile(r"<script[\s\S]*?</script>", re.I)
STYLE_RX = re.compile(r"<style[\s\S]*?</style>", re.I)
REL_SECTION_RX = re.compile(r'<section class="related-section">[\s\S]*?</section>', re.I)
TAG_RX = re.compile(r"<[^>]+>")
WORD_RX = re.compile(r"[а-яa-z]{5,}", re.I)
CONTAINER_RX = re.compile(
    r'(<div class="related-grid" id="related-container">)([\s\S]*?)(</div>)', re.I
)

raw = open(os.path.join(ROOT, "articles-data.js"), encoding="utf-8").read()
catalog = json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])
by_url = {a["url"]: a for a in catalog}
# Слаги вида "/archive/-<appid>" закрыты noindex — ссылки на них уводят вес
# в тупик, поэтому в кольцо «Похожие» они не попадают.
DEAD_RX = re.compile(r"/archive/-\d+$")
order = [a["url"] for a in catalog
         if a["url"].startswith("/archive/") and not DEAD_RX.fullmatch(a["url"])]

games = [u for u in order if by_url[u].get("category") == GAME_CATEGORY]
manual = [u for u in order if by_url[u].get("category") != GAME_CATEGORY]
print("каталог: %d | игры (Обзоры): %d | ручные: %d" % (len(order), len(games), len(manual)))


def esc(s):
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def file_of(url):
    return os.path.join(ARCH, url.split("/")[-1] + ".html")


# ── токены ручных страниц (без блока «Похожие», иначе получается обратная связь)
manual_tokens = {}
for u in manual:
    fp = file_of(u)
    if not os.path.exists(fp):
        continue
    body = open(fp, encoding="utf-8", errors="ignore").read()
    body = REL_SECTION_RX.sub(" ", body)
    body = STYLE_RX.sub(" ", SCRIPT_RX.sub(" ", body))
    manual_tokens[u] = {w.lower() for w in WORD_RX.findall(TAG_RX.sub(" ", body))}


def pick_game(url):
    i = games.index(url)
    return [games[(i + k) % len(games)] for k in range(1, 5)]


def pick_manual(url):
    if url not in manual_tokens:
        return []
    a = manual_tokens[url]
    scored = []
    for o, b in manual_tokens.items():
        if o == url:
            continue
        s = len(a & b) / math.sqrt(len(a) * len(b)) if a and b else 0.0
        scored.append((s, o))
    scored.sort(reverse=True)
    top = [o for _, o in scored[:3]]
    neighbour = manual[(manual.index(url) + 1) % len(manual)]
    for c in (neighbour,) + tuple(o for _, o in scored):
        if c != url and c not in top:
            top.append(c)
        if len(top) == 4:
            break
    return top


def cards(urls):
    return "\n" + "\n".join(
        '        <a href="%s" class="related-card"><strong>%s</strong><span>%s</span></a>'
        % (u, esc(by_url[u].get("title", "")), esc(by_url[u].get("date", "")))
        for u in urls if u in by_url
    ) + "\n      "


def full_section(urls):
    return (
        '\n    <section class="related-section">\n'
        "      <h4>Похожие статьи</h4>\n"
        '      <div class="related-grid" id="related-container">%s</div></section>\n'
        % cards(urls)
    )


changed = inserted = missing = 0
touched = []
for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
    url = "/archive/" + os.path.basename(fp)[:-5]
    if url not in by_url or url not in games and url not in manual:
        missing += 1
        continue
    html = open(fp, encoding="utf-8", errors="ignore").read()
    rel = pick_game(url) if by_url[url].get("category") == GAME_CATEGORY else pick_manual(url)
    if len(rel) < 4:
        continue
    if CONTAINER_RX.search(html):
        new = CONTAINER_RX.sub(lambda m: m.group(1) + cards(rel) + m.group(3), html, count=1)
    elif "</article>" in html:
        new = html.replace("</article>", "</article>" + full_section(rel), 1)
        inserted += 1
    else:
        continue
    if new == html:
        continue
    changed += 1
    touched.append(url)
    if not DRY:
        open(fp, "w", encoding="utf-8").write(new)

print("переписано блоков: %d (из них вставлено новых секций: %d) | нет в каталоге: %d"
      % (changed, inserted, missing))
if DRY:
    for u in touched:
        print("  ~", u)
    print("(dry-run — файлы не изменены)")
