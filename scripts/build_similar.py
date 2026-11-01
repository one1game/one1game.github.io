# -*- coding: utf-8 -*-
"""Ставит блок «Похожие игры» (таблица: игра / цена / вердикт по железу).

Правило и разметка полностью совпадают с similarBlock() в scripts/generate-games.js —
иначе генератор будет считать страницу изменённой и переписывать её каждый прогон.

Запуск: python scripts/build_similar.py [--dry]
"""
import glob
import html
import os
import re
import sys

ARCH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "archive")
DRY = "--dry" in sys.argv

H1 = re.compile(r"<h1[^>]*>([\s\S]*?)</h1>")
PRICE = re.compile(r'<div class="label">Цена</div>\s*<div class="value">([\s\S]*?)</div>')
VERDICT = re.compile(r"<strong>Оценка:</strong>\s*([^<]+)")
GENRE = re.compile(r"<strong>Жанры:</strong>\s*([^<]*)")
RELATED = '<section class="related-section">'
EXISTING = re.compile(r'[ \t]*<section class="similar-games">[\s\S]*?</section>\n?')
DEAD_RX = re.compile(r"/archive/-\d+$")
TAG = re.compile(r"<[^>]+>")


def clean(s):
    return re.sub(r"\s+", " ", TAG.sub(" ", s or "")).strip()


def esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def short_title(s, mx=58):
    t = (s or "").strip()
    if len(t) <= mx:
        return t
    cut = t[:mx]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > mx * 0.6 else cut).strip() + "…"


def verdict_cell(v):
    if "Потянет" in v:
        return "Потянет"
    if "дискретн" in v:
        return "Нет"
    return "—"


# ── факты
facts = {}
files = {}
for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
    h = open(fp, encoding="utf-8", errors="ignore").read()
    g, t = GENRE.search(h), H1.search(h)
    if not g or not t:
        continue
    url = "/archive/" + os.path.basename(fp)[:-5]
    # "/archive/-<appid>" закрыты noindex — ссылаться на них нельзя.
    if DEAD_RX.fullmatch(url):
        continue
    p, v = PRICE.search(h), VERDICT.search(h)
    glist = [x.strip().lower() for x in g.group(1).split(",") if x.strip()]
    if not glist or glist[0] == "не указаны":
        continue
    facts[url] = {
        "title": clean(t.group(1)),
        "genres": set(glist),
        "price": clean(p.group(1)) if p else "—",
        "verdict": v.group(1).strip() if v else "",
    }
    files[url] = fp

print("страниц-игр с жанром: %d" % len(facts))


def pick_similar(url, limit=3):
    """Сначала максимальное пересечение жанров, внутри равного счёта — по кругу
    от текущего URL, чтобы ссылки распределялись равномерно, а не липли к первым
    по алфавиту. Ровно та же логика в similarBlock() в generate-games.js."""
    mine = facts[url]["genres"]
    by_score = {}
    for u, f in facts.items():
        if u == url:
            continue
        inter = len(mine & f["genres"])
        if inter == 0:
            continue
        by_score.setdefault(inter, []).append(u)

    out = []
    for sc in sorted(by_score, reverse=True):
        group = sorted(by_score[sc])
        pos = next((i for i, u in enumerate(group) if u > url), 0)
        for k in range(len(group)):
            out.append(group[(pos + k) % len(group)])
            if len(out) == limit:
                return out
    return out

changed = 0
for url, fp in files.items():
    picked = pick_similar(url)
    orig = open(fp, encoding="utf-8", errors="ignore").read()
    h = EXISTING.sub("", orig)

    if not picked or RELATED not in h:
        new = h
    else:
        rows = []
        for u in picked:
            f = facts[u]
            rows.append(
                '          <tr><td><a href="%s">%s</a></td><td>%s</td><td>%s</td></tr>'
                % (esc(u), esc(short_title(f["title"])), esc(f["price"]), verdict_cell(f["verdict"]))
            )
        block = (
            '    <section class="similar-games">\n'
            "      <h2>Похожие игры</h2>\n"
            '      <table class="similar-table">\n'
            "        <thead><tr><th>Игра</th><th>Цена</th><th>Слабый ПК</th></tr></thead>\n"
            "        <tbody>\n" + "\n".join(rows) + "\n"
            "        </tbody>\n"
            "      </table>\n"
            "    </section>\n"
        )
        new = h.replace(RELATED, block + RELATED, 1)

    if new != orig:
        changed += 1
        if not DRY:
            open(fp, "w", encoding="utf-8").write(new)

print("страниц изменено: %d%s" % (changed, " (dry-run)" if DRY else ""))
