# -*- coding: utf-8 -*-
"""Блок «Потянет ли <игра> на моей видеокарте» на страницах игр.

Зачем: 6 из 130 запросов в спросе идут в обратную сторону — «потянет ли
видеокарта 4060 гта 6». У нас данные есть только для направления «игра →
железо», поэтому на странице игры раскладываем вердикт по популярным картам.

Точность честная: сравнение идёт по минимальным требованиям Steam и грубым
уровням производительности, о чём в тексте прямо сказано.

Разметка совпадает с gpuCheckBlock() в scripts/generate-games.js, иначе
генератор будет переписывать страницы на каждом прогоне.

Запуск: python scripts/build_gpu_verdicts.py [--dry]
"""
import glob
import html
import os
import re
import sys

ARCH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "archive")
DRY = "--dry" in sys.argv

VNAME = re.compile(r'"@type":\s*"VideoGame"[\s\S]{0,300}?"name":\s*"((?:[^"\\]|\\.)*)"')
REQ = re.compile(r"Минимальные требования \(Steam\):</strong>\s*([\s\S]{0,400}?)</p>")
GPU = re.compile(
    r"\b((?:NVIDIA|AMD|ATI|Intel)?\s*(?:GeForce\s*)?(?:RTX|GTX|RX)\s*\d{3,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*(?:Graphics\s*)?\d{2,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*Graphics"
    r"|Radeon\s+(?:HD|RX)\s*\d{3,4}"
    r"|GeForce\s+(?:GT|GTX)\s*\d{3,4})\b", re.I)
BLOCK = re.compile(r'[ \t]*<section class="gpu-check">[\s\S]*?</section>\n?')
ANCHOR_FAQ = '<section class="game-faq">'
ANCHOR_SIM = '<section class="similar-games">'
ANCHOR_REL = '<section class="related-section">'

# Относительная производительность, GTX 1060 = 100. Нужна не точность до кадра,
# а порядок: без неё 1050 Ti и 1060 попадают в один «уровень», и вердикт врёт.
SCORES = {
    "intel hd graphics 4000": 8, "intel hd graphics 5000": 9,
    "intel uhd 620": 12, "intel uhd 630": 13, "intel iris xe": 25,
    "vega 8": 20, "vega 11": 24,
    "gt 730": 8, "gt 1030": 18,
    "gtx 650": 15, "gtx 660": 25, "gtx 750 ti": 30, "gtx 760": 32,
    "gtx 950": 38, "gtx 960": 42, "gtx 970": 62, "gtx 980": 75,
    "gtx 1050": 42, "gtx 1050 ti": 48, "gtx 1060": 100, "gtx 1070": 135,
    "gtx 1080": 165,
    "gtx 1650": 62, "gtx 1660": 95, "gtx 1660 ti": 110,
    "rtx 2060": 140, "rtx 2070": 165, "rtx 2080": 200,
    "rtx 3050": 105, "rtx 3060": 145, "rtx 3070": 185, "rtx 3080": 230,
    "rtx 4060": 175, "rtx 4070": 235, "rtx 4080": 310, "rtx 4090": 390,
    "rtx 5060": 200, "rtx 5070": 270,
    "rx 550": 22, "rx 560": 32, "rx 570": 90, "rx 580": 100, "rx 590": 110,
    "rx 6600": 160, "rx 6700": 200, "rx 6800": 250, "rx 7600": 175,
}

TARGETS = ["RTX 5060", "RTX 4060", "RTX 3050", "GTX 1050 Ti", "RX 580",
           "Intel UHD 620"]


def score(model):
    """Приблизительный индекс производительности или None.

    Старые семейства (Radeon HD, GeForce 8/9/200/400/500) не оцениваем: шкала
    для них врёт сильнее, чем польза от блока. Такие игры пропускаем.
    """
    m = re.sub(r"\s+", " ", model.lower())
    if "radeon hd" in m or re.search(r"geforce\s+(8|9|2|3|4|5)\d{2}", m):
        return None
    for key in sorted(SCORES, key=len, reverse=True):
        if key in m:
            return SCORES[key]
    # «GTX 1060 3GB» и подобные — ищем по семейству и номеру
    fam = re.search(r"\b(rtx|gtx|rx)\s*(\d{3,4})", m)
    if fam and fam.group(0) in SCORES:
        return SCORES[fam.group(0)]
    return None


def verdict(target, minimum):
    if target >= minimum * 1.15:
        return "потянет"
    if target >= minimum:
        return "потянет на минимальных настройках"
    if target >= minimum * 0.75:
        return "на низких настройках, 720p"
    return "не потянет — нужна карта сильнее"


def esc(s):
    """То же, что escAttr() в generate-games.js: апострофы не трогаем,
    иначе разметка не совпадёт с генератором и страницы будут переписываться."""
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def block(name, min_model):
    ms = score(min_model)
    if ms is None:
        return ""
    rows = []
    for tname in TARGETS:
        ts = score(tname)
        rows.append(f'        <li><strong>{esc(tname)}</strong> — '
                    f'{verdict(ts, ms)}</li>')
    return (
        '    <section class="gpu-check">\n'
        f'      <h2>Потянет ли {esc(name)} на моей видеокарте</h2>\n'
        f'      <p>Минимум по Steam — <strong>{esc(min_model)}</strong>. '
        'Сравнение по приблизительной производительности, а не по точному FPS.</p>\n'
        '      <ul class="gpu-check-list">\n' + "\n".join(rows) + "\n"
        '      </ul>\n'
        '      <p>Полная таблица по 600+ играм: '
        '<a href="/potyanet-li-igra">потянет ли игра на моём ПК</a>.</p>\n'
        '    </section>\n'
    )


changed = 0
skipped = 0
for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
    h = open(fp, encoding="utf-8", errors="ignore").read()
    if "<strong>Жанры:" not in h:
        continue
    m_req = REQ.search(h)
    m_name = VNAME.search(h)
    if not m_req or not m_name:
        skipped += 1
        continue
    gpu = GPU.search(m_req.group(1))
    name = m_name.group(1).replace('\\"', '"').replace("\\/", "/")
    b = block(name, gpu.group(1).strip()) if gpu else ""

    h2 = BLOCK.sub("", h)
    if b:
        anchor = next((a for a in (ANCHOR_FAQ, ANCHOR_SIM, ANCHOR_REL) if a in h2), None)
        if anchor:
            h2 = h2.replace(anchor, b + anchor, 1)
        else:
            skipped += 1
            continue
    if h2 != h:
        changed += 1
        if not DRY:
            open(fp, "w", encoding="utf-8").write(h2)

print("страниц изменено: %d | пропущено (нет требований или якоря): %d%s"
      % (changed, skipped, " (dry-run)" if DRY else ""))
