# -*- coding: utf-8 -*-
"""Страницы «какие игры пойдут на <видеокарту>».

Не 1167 шаблонных страниц по одной игре, а один датасет и десяток
страниц-ответов на конкретный запрос: «что пойдёт на GTX 1050», «потянет ли
UHD 620 такие игры». На каждую такую страницу находятся реальные запросы,
а данные у нас свои — минимальные требования, собранные из Steam, и
посчитанный вердикт для каждой карты.

Живёт на тех же данных, что и /potyanet-li-igra: парсим уже собранные
страницы /archive, сеть не нужна.

Запуск: python scripts/build_gpu_pages.py
"""
import glob
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(ROOT, "archive")
SITE = "https://one1game.org"
TOOL = "/potyanet-li-igra"
MIN_GAMES = 12  # меньше — страница получается пустой, такую не публикуем

VNAME = re.compile(r'"@type":\s*"VideoGame"[\s\S]{0,300}?"name":\s*"((?:[^"\\]|\\.)*)"')
REQ = re.compile(r"<strong>Минимальные требования \(Steam\):</strong>\s*([\s\S]*?)</p>")
GPU = re.compile(
    r"\b((?:NVIDIA|AMD|ATI|Intel)?\s*(?:GeForce\s*)?(?:RTX|GTX|RX)\s*\d{3,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*(?:Graphics\s*)?\d{2,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*Graphics"
    r"|Radeon\s+(?:HD|RX)\s*\d{3,4}"
    r"|GeForce\s+(?:GT|GTX)\s*\d{3,4})\b", re.I)
RAM = re.compile(r"(\d+)\s*(?:GB|ГБ)\s*(?:ОЗУ|RAM)", re.I)

# Та же шкала, что в scripts/build_gpu_verdicts.py (GTX 1060 = 100).
SCORES = {
    "intel hd graphics 4000": 8, "intel hd graphics 5000": 9,
    "intel uhd 620": 12, "intel uhd 630": 13, "intel iris xe": 25,
    "vega 8": 20, "vega 11": 24,
    "gt 730": 8, "gt 1030": 18,
    "gtx 650": 15, "gtx 660": 25, "gtx 750 ti": 30, "gtx 760": 32,
    "gtx 950": 38, "gtx 960": 42, "gtx 970": 62, "gtx 980": 75,
    "gtx 1050": 42, "gtx 1050 ti": 48, "gtx 1060": 100, "gtx 1070": 135,
    "gtx 1080": 165, "gtx 1650": 62, "gtx 1660": 95, "gtx 1660 ti": 110,
    "rtx 2060": 140, "rtx 2070": 165, "rtx 2080": 200,
    "rtx 3050": 105, "rtx 3060": 145, "rtx 3070": 185, "rtx 3080": 230,
    "rtx 4060": 175, "rtx 4070": 235, "rtx 4080": 310, "rtx 4090": 390,
    "rtx 5060": 200, "rtx 5070": 270,
    "rx 550": 22, "rx 560": 32, "rx 570": 90, "rx 580": 100, "rx 590": 110,
    "rx 6600": 160, "rx 6700": 200, "rx 6800": 250, "rx 7600": 175,
}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def score(model):
    m = re.sub(r"\s+", " ", str(model or "").lower()).strip()
    if "radeon hd" in m or re.search(r"geforce\s+(8|9|2|3|4|5)\d{2}", m):
        return None
    for key in sorted(SCORES, key=len, reverse=True):
        if key in m:
            return SCORES[key]
    return None


def match_key(raw):
    """Канонический ключ модели.

    Steam пишет «NVIDIA GeForce GTX 1060», «GeForce GTX 1060» и «GTX 1060» —
    это одна и та же карта. Без приведения получалось три разных страницы.
    """
    m = re.sub(r"\s+", " ", str(raw or "").lower())
    for key in sorted(SCORES, key=len, reverse=True):
        if key in m:
            return key
    return None


def display(key):
    upper = {"gtx", "rtx", "rx", "hd", "uhd"}
    parts = []
    for w in key.split():
        if w in upper:
            parts.append(w.upper())
        elif w == "ti":
            parts.append("Ti")
        elif w in ("intel", "amd", "vega", "iris", "geforce", "graphics"):
            parts.append(w.capitalize())
        else:
            parts.append(w)
    name = " ".join(parts)
    if key.startswith("vega"):
        name = "AMD " + name
    return name


def verdict(target, minimum):
    if target >= minimum * 1.15:
        return "потянет"
    if target >= minimum:
        return "потянет на минимальных настройках"
    if target >= minimum * 0.75:
        return "на низких настройках, 720p"
    return "не потянет"


def slugify(model):
    s = re.sub(r"[^a-z0-9а-яё]+", "-", model.lower()).strip("-")
    return "igry-dlya-" + s


def collect():
    games = []
    for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
        if re.fullmatch(r"-\d+", os.path.basename(fp)[:-5]):
            continue
        h = open(fp, encoding="utf-8", errors="ignore").read()
        if "<strong>Жанры:" not in h:
            continue
        m_req = REQ.search(h)
        m_name = VNAME.search(h)
        if not (m_req and m_name):
            continue
        gpu = GPU.search(m_req.group(1))
        if not gpu:
            continue
        key = match_key(gpu.group(1))
        if not key:
            continue
        ram = RAM.search(m_req.group(1))
        games.append({
            "name": m_name.group(1).replace('\\"', '"').replace("\\/", "/"),
            "url": "/archive/" + os.path.basename(fp)[:-5],
            "gpu": display(key),
            "mscore": SCORES[key],
            "ram": (ram.group(1) + " ГБ") if ram else "—",
        })
    return games


PAGE = """<!DOCTYPE html>
<html lang="ru">
<head>
<script>if(location.hostname==='one1game.github.io'){location.replace('https://one1game.org'+location.pathname+location.search+location.hash);}</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{TITLE}}</title>
  <meta name="description" content="{{DESC}}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{{SITE}}/{{SLUG}}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="One1Game" />
  <meta property="og:title" content="{{TITLE}}" />
  <meta property="og:description" content="{{DESC}}" />
  <meta property="og:url" content="{{SITE}}/{{SLUG}}" />
  <meta property="og:image" content="{{SITE}}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#06060c" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=33" />
  <link rel="manifest" href="/manifest.json" />
  <script defer src="/analytics-consent.js?v=2"></script>
  <style>
    .gp-lead p { line-height: 1.8; margin-bottom: 16px; }
    .gp-wrap { overflow-x: auto; margin: 16px 0 26px; }
    .gp-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .gp-table th, .gp-table td { text-align: left; padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .gp-table th { color: #7ee787; font-weight: 700; white-space: nowrap; }
    .gp-table a { color: inherit; text-decoration: none; }
    .gp-table a:hover { color: #7ee787; }
    .gp-table td:nth-child(2), .gp-table td:nth-child(3) { white-space: nowrap; color: #8c93a3; }
    .gp-faq h3 { font-size: .95rem; margin: 16px 0 4px; color: #fff; }
    .gp-faq p { margin: 0; color: #c9d6e6; line-height: 1.65; }
    .gp-also { margin: 26px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.10);
      border-radius: 10px; background: rgba(255,255,255,.03); }
    .gp-also h4 { margin: 0 0 10px; color: #fff; }
    .gp-also a { display: block; margin: 6px 0; color: #7ee787; text-decoration: none; }
  </style>
{{JSONLD}}
</head>
<body>
<main id="main-content">
<div class="container">
  <div class="page-content">
    <nav class="breadcrumbs" aria-label="Хлебные крошки" style="margin-bottom:18px;font-size:13px;color:#8c93a3">
      <a href="/" style="color:#7ee787;text-decoration:none">One1Game</a> →
      <a href="{{TOOL}}" style="color:#7ee787;text-decoration:none">Потянет ли игра</a> →
      <span aria-current="page">{{GPU}}</span>
    </nav>

    <h1>{{H1}}</h1>
    <div class="gp-lead">{{LEAD}}</div>

    <h2>Список игр</h2>
    <div class="gp-wrap">
      <table class="gp-table">
        <thead><tr><th>Игра</th><th>Минимальная видеокарта</th><th>ОЗУ</th><th>{{GPU}}</th></tr></thead>
        <tbody>
{{ROWS}}
        </tbody>
      </table>
    </div>

    <section class="gp-faq">
      <h2>Частые вопросы</h2>
{{FAQ}}
    </section>

    <div class="gp-also">
      <h4>Другие видеокарты</h4>
{{ALSO}}
      <a href="{{TOOL}}">Полная таблица: потянет ли игра на моём ПК</a>
      <a href="/">На главную One1Game</a>
    </div>
  </div>
</div>
</main>
<script src="/components.js?v=41" defer></script>
</body>
</html>
"""


def build(model, pages, games):
    tscore = score(model)
    fits = [g for g in games if tscore >= g["mscore"] * 0.75]
    fits.sort(key=lambda g: (tscore < g["mscore"], -g["mscore"], g["name"].lower()))
    strong = sum(1 for g in games if g["mscore"] > tscore * 1.15)

    gpu = model
    h1 = "Игры, которые пойдут на %s" % gpu
    title = "%s — список игр с требованиями (%d) | One1Game" % (h1, len(fits))
    desc = ("Что запустится на %s: %d игр из нашей базы с минимальными требованиями "
            "и вердиктом по каждой. Данные Steam, обновляются ежедневно." % (gpu, len(fits)))

    rows = "\n".join(
        '          <tr><td><a href="%s">%s</a></td><td>%s</td><td>%s</td><td>%s</td></tr>'
        % (esc(g["url"]), esc(g["name"]), esc(g["gpu"]), esc(g["ram"]),
           esc(verdict(tscore, g["mscore"])))
        for g in fits[:400]
    )

    lead = (
        "<p>В базе One1Game %d игр с разобранными минимальными требованиями. "
        "Для %s подходит <strong>%d</strong> из них — остальные %d требуют карту заметно "
        "сильнее и на этой будут идти с трудом или не запустятся.</p>"
        "<p>Вердикт в последней колонке считается по индексу производительности, где "
        "GTX 1060 принята за 100. Это оценка по официальным требованиям, а не замер FPS: "
        "реальный результат зависит от процессора, памяти и настроек. Для игр с запасом "
        "по мощности хватит средних настроек, для пограничных — 720p и низкие.</p>"
        % (len(games), gpu, len(fits), strong)
    )

    faq = (
        "<h3>Сколько игр из базы пойдёт на %s</h3><p>%d из %d. Это игры, у которых "
        "минимальная видеокарта не выше %s: на них игра запустится, пусть иногда только "
        "на низких настройках.</p>"
        "<h3>Хватит ли %s для игр 2026 года</h3><p>Из свежих релизов — только те, у кого "
        "в минимальных требованиях указана такая же или более слабая карта. Новые "
        "крупные проекты обычно требуют RTX 2060 и выше, и %s к ним не относится.</p>"
        "<h3>Что важнее — видеокарта или ОЗУ</h3><p>Для запуска важнее видеокарта, но если "
        "в требованиях указано 8 ГБ ОЗУ, а у вас 4 ГБ, игра не запустится даже с "
        "подходящей картой. Смотрите колонку «ОЗУ» в таблице.</p>"
        % (gpu, len(fits), len(games), gpu, gpu, gpu)
    )

    also = "\n".join(
        '      <a href="/%s">Игры на %s</a>' % (p["slug"], p["model"])
        for p in pages if p["slug"] != slugify(model)
    )

    jsonld = [
        {"@context": "https://schema.org", "@type": "WebPage",
         "@id": "%s/%s#webpage" % (SITE, slugify(model)),
         "url": "%s/%s" % (SITE, slugify(model)), "name": title,
         "description": desc, "inLanguage": "ru-RU"},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "One1Game", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Потянет ли игра",
             "item": SITE + TOOL},
            {"@type": "ListItem", "position": 3, "name": h1,
             "item": "%s/%s" % (SITE, slugify(model))},
        ]},
    ]
    jsonld_html = "\n".join(
        '  <script type="application/ld+json">%s</script>' % json.dumps(j, ensure_ascii=False)
        for j in jsonld
    )

    return (PAGE
            .replace("{{TITLE}}", esc(title))
            .replace("{{DESC}}", esc(desc))
            .replace("{{SITE}}", SITE)
            .replace("{{SLUG}}", slugify(model))
            .replace("{{TOOL}}", TOOL)
            .replace("{{GPU}}", esc(gpu))
            .replace("{{H1}}", esc(h1))
            .replace("{{LEAD}}", lead)
            .replace("{{ROWS}}", rows)
            .replace("{{FAQ}}", faq)
            .replace("{{ALSO}}", also)
            .replace("{{JSONLD}}", jsonld_html))


def main():
    games = collect()
    if not games:
        print("нет данных: страницы игр не разобраны")
        return

    counts = {}
    for g in games:
        counts[g["gpu"]] = counts.get(g["gpu"], 0) + 1
    models = [(m, n) for m, n in counts.items() if score(m) and n >= MIN_GAMES]
    models.sort(key=lambda x: -x[1])
    pages = [{"model": m, "slug": slugify(m), "count": n} for m, n in models]

    written = 0
    for p in pages:
        page = build(p["model"], pages, games)
        out = os.path.join(ROOT, p["slug"] + ".html")
        prev = open(out, encoding="utf-8").read() if os.path.exists(out) else None
        if prev != page:
            open(out, "w", encoding="utf-8").write(page)
            written += 1
    print("страниц по видеокартам: %d (переписано %d)" % (len(pages), written))
    print("  " + ", ".join("%s (%d)" % (p["model"], p["count"]) for p in pages))


if __name__ == "__main__":
    main()
