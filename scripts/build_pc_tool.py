# -*- coding: utf-8 -*-
"""Страница-инструмент «Потянет ли игра на моём ПК».

Не список «лучших игр», а таблица: минимальная видеокарта, ОЗУ и вердикт по каждой
игре из архива. Пользователь ищет свою игру и сразу видит ответ.

Данные берутся из уже собранных страниц /archive — сети не нужно.
Запуск: python scripts/build_pc_tool.py
"""
import glob
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(ROOT, "archive")
OUT = os.path.join(ROOT, "potyanet-li-igra.html")
SITE = "https://one1game.org"
SLUG = "potyanet-li-igra"

VNAME = re.compile(r'"@type":\s*"VideoGame"[\s\S]{0,300}?"name":\s*"((?:[^"\\]|\\.)*)"')
REQ = re.compile(r"<strong>Минимальные требования \(Steam\):</strong>\s*([\s\S]*?)</p>")
VERDICT = re.compile(r"<strong>Оценка:</strong>\s*([^<]+)")
GPU = re.compile(
    r"\b((?:NVIDIA|AMD|ATI|Intel)?\s*(?:GeForce\s*)?(?:RTX|GTX|RX)\s*\d{3,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*(?:Graphics\s*)?\d{2,4}"
    r"|(?:Intel|AMD)\s+(?:HD|UHD|Iris|Vega)\s*Graphics"
    r"|Radeon\s+(?:HD|RX)\s*\d{3,4}"
    r"|GeForce\s+(?:GT|GTX)\s*\d{3,4})\b", re.I)
RAM = re.compile(r"(\d+)\s*(?:GB|ГБ)\s*(?:ОЗУ|RAM)", re.I)


def esc(s):
    return html.escape(str(s or ""), quote=True)


rows = []
for fp in sorted(glob.glob(os.path.join(ARCH, "*.html"))):
    # "/archive/-<appid>" закрыты noindex — ссылки из таблицы вели бы в тупик.
    if re.fullmatch(r"-\d+", os.path.basename(fp)[:-5]):
        continue
    h = open(fp, encoding="utf-8", errors="ignore").read()
    if "<strong>Жанры:" not in h:
        continue
    m_req = REQ.search(h)
    if not m_req:
        continue
    gpu = GPU.search(m_req.group(1))
    if not gpu:
        continue
    m_name = VNAME.search(h)
    if not m_name:
        continue
    name = m_name.group(1).replace('\\"', '"').replace("\\/", "/")
    g = re.sub(r"\s+", " ", gpu.group(1)).strip()
    g = re.sub(r"^(nvidia|amd|ati|intel)\s+", "", g, flags=re.I).strip()
    ram = RAM.search(m_req.group(1))
    v = VERDICT.search(h)
    verdict = "yes" if v and "Потянет" in v.group(1) else ("no" if v else "")
    rows.append({
        "name": name,
        "url": "/archive/" + os.path.basename(fp)[:-5],
        "gpu": g,
        "ram": (ram.group(1) + " ГБ") if ram else "—",
        "verdict": verdict,
    })

rows.sort(key=lambda r: (r["verdict"] != "yes", r["name"].lower()))
n_yes = sum(1 for r in rows if r["verdict"] == "yes")
n_no = sum(1 for r in rows if r["verdict"] == "no")

TITLE = "Потянет ли игра на моём ПК — таблица минимальных видеокарт (%d игр)" % len(rows)
DESC = ("Таблица минимальных видеокарт и объёма ОЗУ для %d игр: найдите свою игру "
        "и сразу увидите, запустится ли она на встроенной графике." % len(rows))

TR = "\n".join(
    '        <tr data-v="%s"><td><a href="%s">%s</a></td><td>%s</td><td>%s</td><td>%s</td></tr>'
    % (r["verdict"] or "u", r["url"], esc(r["name"]), esc(r["gpu"]), esc(r["ram"]),
       {"yes": "Потянет", "no": "Нужна дискретная", "": "—"}[r["verdict"]])
    for r in rows
)

JSONLD = [
    {"@context": "https://schema.org", "@type": "WebPage",
     "@id": "%s/%s#webpage" % (SITE, SLUG), "url": "%s/%s" % (SITE, SLUG),
     "name": TITLE, "description": DESC, "inLanguage": "ru-RU"},
    {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Главная", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Потянет ли игра на моём ПК",
         "item": "%s/%s" % (SITE, SLUG)},
    ]},
]

PAGE = """<!DOCTYPE html>
<html lang="ru">
<head>
<script>if(location.hostname==='one1game.github.io'){location.replace('https://one1game.org'+location.pathname+location.search+location.hash);}</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{TITLE}} | One1Game</title>
  <meta name="description" content="{{DESC}}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{{SITE}}/{{SLUG}}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="One1Game" />
  <meta property="og:title" content="{{TITLE}}" />
  <meta property="og:description" content="{{DESC}}" />
  <meta property="og:url" content="{{SITE}}/{{SLUG}}" />
  <meta property="og:image" content="{{SITE}}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#06060c" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=50" />
  <link rel="manifest" href="/manifest.json" />
  <script defer src="/analytics-consent.js?v=2"></script>
  <style>
    .pt-lead p { line-height: 1.8; margin-bottom: 16px; }
    .pt-bar { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; align-items: center; }
    .pt-input { flex: 1 1 260px; padding: 11px 14px; border-radius: 8px; border: 1px solid #1b2333;
      background: #0d1320; color: #e6edf7; font-size: .92rem; }
    .pt-btn { padding: 10px 14px; border-radius: 8px; border: 1px solid #1b2333; background: #0d1320;
      color: #c9d6e6; font-size: .82rem; cursor: pointer; }
    .pt-btn[aria-pressed="true"] { border-color: #7ee787; color: #7ee787; }
    .pt-count { color: #8c93a3; font-size: .82rem; }
    .pt-wrap { overflow-x: auto; margin: 14px 0 26px; }
    .pt-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .pt-table th, .pt-table td { text-align: left; padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .pt-table th { color: #7ee787; font-weight: 700; white-space: nowrap; position: sticky; top: 0; background: #06060c; }
    .pt-table a { color: inherit; text-decoration: none; }
    .pt-table a:hover { color: #7ee787; }
    .pt-table td:nth-child(2) { white-space: nowrap; color: #c9d6e6; }
    .pt-table td:nth-child(3) { white-space: nowrap; color: #8c93a3; }
    .pt-faq { margin: 28px 0; }
    .pt-faq h2 { font-size: 1.1rem; margin-bottom: 10px; }
    .pt-faq h3 { font-size: .95rem; margin: 16px 0 4px; color: #fff; }
    .pt-faq p { margin: 0; color: #c9d6e6; line-height: 1.65; }
    .pt-also { margin: 26px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.10);
      border-radius: 10px; background: rgba(255,255,255,.03); }
    .pt-also h4 { margin: 0 0 10px; color: #fff; }
    .pt-also a { display: block; margin: 6px 0; color: #7ee787; text-decoration: none; }
  </style>
{{JSONLD}}
</head>
<body>
<main id="main-content">
<div class="container">
  <div class="page-content">
    <nav class="breadcrumbs" aria-label="Хлебные крошки" style="margin-bottom:18px;font-size:13px;color:#8c93a3">
      <a href="/" style="color:#7ee787;text-decoration:none">One1Game</a> →
      <span aria-current="page">Потянет ли игра на моём ПК</span>
    </nav>

    <h1>Потянет ли игра на моём ПК</h1>
    <div class="pt-lead">
      <p>Ниже — таблица минимальных видеокарт для {{TOTAL}} игр из Steam. Найдите свою игру
      через поиск или прокрутите список: напротив каждой указано, какая видеокарта требуется
      по официальным системным требованиям и сколько нужно оперативной памяти.</p>
      <p>Колонка «Слабый ПК» — это оценка, а не гарантия: «Потянет» значит, что в требованиях
      названа встроенная графика или видеокарта не указана вовсе. «Нужна дискретная» — что
      Steam требует отдельную карту. Между этими двумя состояниями есть серая зона, поэтому
      при сомнении ориентируйтесь на конкретную модель в колонке «Видеокарта».</p>
    </div>

    <div class="pt-bar">
      <input class="pt-input" id="pt-q" type="search" placeholder="Название игры или видеокарта" aria-label="Поиск по таблице" />
      <button class="pt-btn" data-f="all" aria-pressed="true">Все</button>
      <button class="pt-btn" data-f="yes" aria-pressed="false">Потянет ({{NYES}})</button>
      <button class="pt-btn" data-f="no" aria-pressed="false">Нужна дискретная ({{NNO}})</button>
      <span class="pt-count" id="pt-count">{{TOTAL}} игр</span>
    </div>

    <div class="pt-wrap">
      <table class="pt-table" id="pt-table">
        <thead><tr><th>Игра</th><th>Видеокарта</th><th>ОЗУ</th><th>Слабый ПК</th></tr></thead>
        <tbody>
{{ROWS}}
        </tbody>
      </table>
    </div>

    <section class="pt-faq">
      <h2>Частые вопросы</h2>
      <h3>Как узнать, потянет ли игра мой компьютер</h3>
      <p>Сравните свою видеокарту с той, что указана в строке игры. Если ваша модель новее —
      игра запустится минимум на низких настройках. Встроенная графика почти всегда слабее
      любой дискретной карты, даже старой.</p>
      <h3>Почему у части игр стоит прочерк</h3>
      <p>В Steam разработчик не указал видеокарту в минимальных требованиях. Это не значит,
      что игра нетребовательная — просто данные не опубликованы.</p>
      <h3>Что важнее — видеокарта или оперативная память</h3>
      <p>Для запуска важнее видеокарта. Но если в требованиях указано 8 ГБ ОЗУ, а у вас 4 ГБ,
      игра не запустится даже при подходящей видеокарте.</p>
    </section>

    <div class="pt-also">
      <h4>Подборки по железу</h4>
      <a href="/igry-bez-videokarty">Игры без видеокарты</a>
      <a href="/besplatnye-igry-dlya-slabyh-pk">Бесплатные игры для слабых ПК</a>
      <a href="/igry-dlya-slabyh-noutbukov-4gb-ozu">Игры на 4 ГБ ОЗУ</a>
      <a href="/kooperativnye-igry-dlya-slabyh-pk">Кооперативные игры для слабых ПК</a>
      <a href="/shuter-igry-dlya-slabyh-noutbukov">Шутеры для слабого ноутбука</a>
      <a href="/rpg-igry-dlya-slabyh-noutbukov">RPG для слабого ноутбука</a>
    </div>
  </div>
</div>
</main>
<script>
(function(){
  var q=document.getElementById('pt-q'), c=document.getElementById('pt-count');
  var tb=document.getElementById('pt-table').tBodies[0];
  var rows=[].slice.call(tb.rows), f='all';
  var btns=[].slice.call(document.querySelectorAll('.pt-btn'));
  function apply(){
    var s=q.value.toLowerCase().trim(), shown=0;
    for(var i=0;i<rows.length;i++){
      var r=rows[i], okF=(f==='all')||(r.getAttribute('data-v')===f);
      var okQ=!s||r.textContent.toLowerCase().indexOf(s)!==-1;
      var vis=okF&&okQ;
      r.style.display=vis?'':'none';
      if(vis)shown++;
    }
    c.textContent=shown+' игр';
  }
  q.addEventListener('input',apply);
  btns.forEach(function(b){b.addEventListener('click',function(){
    f=b.getAttribute('data-f');
    btns.forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
    apply();
  });});
})();
</script>
<script src="/components.js?v=41" defer></script>
</body>
</html>
"""

jsonld = "\n".join(
    '  <script type="application/ld+json">%s</script>' % json.dumps(j, ensure_ascii=False)
    for j in JSONLD
)
page = (PAGE
        .replace("{{TITLE}}", esc(TITLE))
        .replace("{{DESC}}", esc(DESC))
        .replace("{{SITE}}", SITE)
        .replace("{{SLUG}}", SLUG)
        .replace("{{JSONLD}}", jsonld)
        .replace("{{TOTAL}}", str(len(rows)))
        .replace("{{NYES}}", str(n_yes))
        .replace("{{NNO}}", str(n_no))
        .replace("{{ROWS}}", TR))
# Пишем только при реальном изменении: иначе файл получает новую дату
# на каждом прогоне, и lastmod в sitemap начинает врать.
_prev = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else None
if _prev != page:
    open(OUT, "w", encoding="utf-8").write(page)
print("готово: %s | игр %d | потянет %d | дискретная %d%s"
      % (os.path.basename(OUT), len(rows), n_yes, n_no, "" if _prev != page else " (без изменений)"))
