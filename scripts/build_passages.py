# -*- coding: utf-8 -*-
"""Пассажная разметка игровых страниц.

Зачем: движок индексирует не документ, а пассаж под заголовком, и раскрывает
запрос в набор подзапросов. У 1235 игровых страниц набор H2 был одинаковым и
ни один заголовок не был сформулирован как запрос. Скрипт даёт каждой странице
именные вопросные пассажи — ответы уже есть на странице, но лежали в карточках.

Делает две вещи:
  1) переименовывает H2 «Потянет ли слабый ноутбук?» в «Потянет ли <игра> ...»;
  2) вставляет блок «<игра>: частые вопросы» (цена / дата выхода / разработчик).

Разметка совпадает с faqBlock() и lowEndBlock() в scripts/generate-games.js,
иначе генератор будет переписывать страницы на каждом прогоне.

Запуск: python scripts/build_passages.py [--dry]
"""
import glob
import os
import re
import sys

ARCH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "archive")
DRY = "--dry" in sys.argv

VNAME = re.compile(r'"@type":\s*"VideoGame"[\s\S]{0,300}?"name":\s*"((?:[^"\\]|\\.)*)"')
PRICE = re.compile(r'<div class="label">Цена</div>\s*<div class="value">([\s\S]*?)</div>')
RELEASE = re.compile(r'<div class="label">Дата выхода</div>\s*<div class="value">([\s\S]*?)</div>')
DEVS = re.compile(r"<strong>Разработчик:</strong>\s*([^<]*)")
OLD_H2 = '<h2 style="margin:0 0 10px;font-size:1.15rem">Потянет ли слабый ноутбук?</h2>'
NEW_H2 = '<h2 style="margin:0 0 10px;font-size:1.15rem">Потянет ли %s на слабом ноутбуке?</h2>'
FAQ = re.compile(r'[ \t]*<section class="game-faq">[\s\S]*?</section>\n?')
SIMILAR = '<section class="similar-games">'
RELATED = '<section class="related-section">'
TAG = re.compile(r"<[^>]+>")


def clean(s):
    return re.sub(r"\s+", " ", TAG.sub(" ", s or "")).strip()


def esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def block(name, price, release, devs):
    items = []
    if price:
        items.append(
            '      <h3>Сколько стоит %s</h3>\n'
            "        <p>В Steam %s сейчас %s. Цена и скидки обновляются автоматически.</p>"
            % (esc(name), esc(name), esc(price))
        )
    if release:
        rel = re.sub(r"\.$", "", release)
        items.append(
            '      <h3>Когда вышла %s</h3>\n'
            "        <p>Дата выхода %s — %s.</p>" % (esc(name), esc(name), esc(rel))
        )
    if devs:
        items.append(
            '      <h3>Кто разработал %s</h3>\n'
            "        <p>Разработчик %s — %s.</p>" % (esc(name), esc(name), esc(devs))
        )
    if not items:
        return ""
    return (
        '    <section class="game-faq">\n'
        "      <h2>%s: частые вопросы</h2>\n" % esc(name)
        + "\n".join(items)
        + "\n    </section>\n"
    )


changed = renamed = added = 0
for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
    h = open(fp, encoding="utf-8", errors="ignore").read()
    if "<strong>Жанры:" not in h:
        continue
    m = VNAME.search(h)
    if not m:
        continue
    name = m.group(1).replace('\\"', '"').replace("\\/", "/")

    orig = h
    # 1) именной H2 вместо обезличенного
    if OLD_H2 in h:
        h = h.replace(OLD_H2, NEW_H2 % esc(name), 1)
        renamed += 1

    # 2) блок вопросов
    price = PRICE.search(h)
    release = RELEASE.search(h)
    devs = DEVS.search(h)
    rel_txt = clean(release.group(1)) if release else ""
    dev_txt = clean(devs.group(1)) if devs else ""
    b = block(
        name,
        clean(price.group(1)) if price else "",
        "" if rel_txt in ("", "неизвестно") else rel_txt,
        "" if dev_txt in ("", "не указаны") else dev_txt,
    )
    h = FAQ.sub("", h)
    if b:
        anchor = SIMILAR if SIMILAR in h else RELATED
        if anchor in h:
            h = h.replace(anchor, b + anchor, 1)
            added += 1

    if h != orig:
        changed += 1
        if not DRY:
            open(fp, "w", encoding="utf-8").write(h)

print("страниц изменено: %d | H2 переименован: %d | блоков вопросов: %d%s"
      % (changed, renamed, added, " (dry-run)" if DRY else ""))
