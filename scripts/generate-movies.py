#!/usr/bin/env python3
"""Собирает страницу «Фильмы по играм» (/kino/) из TMDB API.

Запуск: TMDB_API_KEY=... python3 scripts/generate-movies.py
Без ключа или при ошибке TMDB скрипт ничего не пишет и не портит страницу.
"""
import html
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "kino" / "index.html"
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w300"
SITE = "https://one1game.github.io"
KEYWORD = "based on video game"
UPCOMING_LIMIT = 24
RELEASED_LIMIT = 24

RU_MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
             "июля", "августа", "сентября", "октября", "ноября", "декабря")


def _get(path, **params):
    params["api_key"] = os.environ.get("TMDB_API_KEY", "").strip()
    params.setdefault("language", "ru-RU")
    url = f"{API}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def find_keyword():
    data = _get("/search/keyword", query=KEYWORD)
    for item in data.get("results", []):
        if KEYWORD in (item.get("name") or "").lower():
            return item["id"]
    return None


def normalize(movie):
    iso = (movie.get("release_date") or "").strip()
    votes = movie.get("vote_count") or 0
    return {
        "id": movie.get("id"),
        "title": (movie.get("title") or movie.get("name") or "").strip(),
        "iso": iso,
        "rating": round(movie.get("vote_average") or 0, 1),
        "votes": votes,
        "overview": (movie.get("overview") or "").strip(),
        "poster": f"{IMG}{movie['poster_path']}" if movie.get("poster_path") else "",
        "tmdb": f"https://www.themoviedb.org/movie/{movie.get('id')}",
    }


def collect():
    keyword = find_keyword()
    if not keyword:
        raise RuntimeError(f"не нашёл TMDB-тег «{KEYWORD}»")
    today = date.today().isoformat()
    upcoming = _get("/discover/movie", with_keywords=keyword, page=1, include_adult="false",
                    sort_by="primary_release_date.asc",
                    **{"primary_release_date.gte": today})
    released = _get("/discover/movie", with_keywords=keyword, page=1, include_adult="false",
                    sort_by="popularity.desc",
                    **{"primary_release_date.lte": today})

    def clean(rows, limit):
        seen, result = set(), []
        for row in rows:
            item = normalize(row)
            if not item["title"] or item["id"] in seen:
                continue
            seen.add(item["id"])
            result.append(item)
            if len(result) >= limit:
                break
        return result

    return (clean(upcoming.get("results", []), UPCOMING_LIMIT),
            clean(released.get("results", []), RELEASED_LIMIT))


def ru_date(iso):
    if len(iso) < 10:
        return "дата не объявлена"
    year, month, day = int(iso[:4]), int(iso[5:7]), int(iso[8:10])
    if not 1 <= month <= 12:
        return iso
    return f"{day} {RU_MONTHS[month - 1]} {year}"


def card(item):
    title = html.escape(item["title"])
    rate = ""
    if item["votes"] >= 5:
        rate = f'<span class="mv-rate">★ {item["rating"]}</span>'
    if item["poster"]:
        poster = (f'<a class="mv-poster" href="{item["tmdb"]}" target="_blank" '
                  f'rel="noopener noreferrer"><img src="{item["poster"]}" alt="{title}" '
                  f'loading="lazy" width="300" height="450">'
                  f'{rate}<span class="mv-note">TMDB</span></a>')
    else:
        poster = '<span class="mv-poster mv-empty">🎬</span>'
    desc = html.escape(item["overview"]) or "Описание пока не добавлено."
    return (f'<article class="mv-card">{poster}'
            f'<div class="mv-body"><b>{title}</b>'
            f'<small>{ru_date(item["iso"])}</small>'
            f'<p>{desc}</p></div></article>')


def section(title, badge, items):
    if not items:
        return ""
    cards = "\n".join(card(i) for i in items)
    return (f'<div class="section-header"><h2 class="section-title">{title}</h2>'
            f'<span class="section-badge">{badge}</span></div>\n'
            f'<div class="mv-grid">{cards}</div>\n')


def render(upcoming, released):
    today = date.today()
    year = today.year
    updated = f"{today.isoformat()}"
    listed = upcoming[:12]
    itemlist = ",\n".join(
        '        {"@type":"ListItem","position":%d,"name":%s,"url":%s}'
        % (n, json.dumps(i["title"], ensure_ascii=False), json.dumps(i["tmdb"]))
        for n, i in enumerate(listed, 1))
    total = len(upcoming) + len(released)
    badge = f"{total} экранизаций" if total else "раздел обновляется"
    summary = (f"Сейчас в подборке {total} экранизаций." if total
               else "Раздел обновляется автоматически.")

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Фильмы по играм — экранизации видеоигр {year} | One1Game</title>
<meta name="description" content="Каталог фильмов и сериалов по мотивам видеоигр: даты выхода, постеры, рейтинги и описания. {summary}">
<meta name="keywords" content="фильмы по играм, экранизации видеоигр, фильмы по мотивам игр, даты выхода, {year}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{SITE}/kino/">
<meta name="theme-color" content="#04060a">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="manifest" href="/manifest.json">
<meta property="og:type" content="website">
<meta property="og:site_name" content="One1Game">
<meta property="og:title" content="Фильмы по играм — экранизации видеоигр {year}">
<meta property="og:description" content="Каталог экранизаций видеоигр: даты выхода, постеры, рейтинги и описания.">
<meta property="og:url" content="{SITE}/kino/">
<meta property="og:image" content="{SITE}/site-og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "CollectionPage",
      "name": "Фильмы по играм — экранизации видеоигр",
      "url": "{SITE}/kino/",
      "inLanguage": "ru",
      "dateModified": "{updated}",
      "isPartOf": {{ "@type": "WebSite", "name": "One1Game", "url": "{SITE}" }}
    }},
    {{
      "@type": "ItemList",
      "name": "Скоро на экранах",
      "itemListElement": [
{itemlist}
      ]
    }}
  ]
}}
</script>
<link rel="stylesheet" href="/styles.css?v=44">
<style>
.mv-hero{{margin:22px 0 4px;padding:24px 20px;border:1px solid var(--line);border-left:4px solid var(--acid);border-radius:var(--radius);
  background:repeating-linear-gradient(0deg,rgba(125,255,155,.035) 0 1px,transparent 1px 3px),linear-gradient(135deg,rgba(125,255,155,.10),var(--panel) 60%)}}
.mv-eyebrow{{font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;color:var(--acid);margin-bottom:10px}}
.mv-h1{{font-size:clamp(1.6rem,5.4vw,2.5rem);line-height:1.12;letter-spacing:-.02em;color:#fff;margin-bottom:12px}}
.mv-h1 span{{color:var(--acid)}}
.mv-sub{{max-width:66ch;color:var(--ink-dim);font-size:.9rem}}
.mv-badges{{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}}
.mv-badges span{{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--acid);border:1px solid var(--line-hi);border-radius:999px;padding:4px 10px}}
.mv-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:14px 0 26px}}
.mv-card{{border:1px solid var(--line-soft);border-radius:var(--radius);background:var(--panel);overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s,transform .15s,box-shadow .15s}}
.mv-card:hover{{border-color:var(--line-hi);transform:translateY(-2px);box-shadow:var(--shadow)}}
.mv-poster{{position:relative;display:block;aspect-ratio:2/3;background:#0a0f14;text-decoration:none}}
.mv-poster img{{width:100%;height:100%;object-fit:cover;display:block}}
.mv-empty{{display:grid;place-items:center;font-size:2.4rem;opacity:.5}}
.mv-rate{{position:absolute;top:8px;left:8px;font-size:.66rem;font-weight:700;padding:3px 7px;border-radius:8px;background:rgba(4,6,10,.82);color:var(--acid);border:1px solid var(--line-hi)}}
.mv-note{{position:absolute;bottom:6px;right:8px;font-size:.55rem;letter-spacing:.06em;color:rgba(255,255,255,.55)}}
.mv-body{{padding:10px 12px 12px;display:flex;flex-direction:column;gap:5px}}
.mv-body b{{color:#fff;font-size:.88rem;line-height:1.3}}
.mv-body small{{color:var(--acid);font-size:.7rem;letter-spacing:.03em}}
.mv-body p{{color:var(--ink-dim);font-size:.74rem;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}}
.mv-foot{{font-size:.68rem;color:var(--ink-faint);margin:20px 0 6px;line-height:1.6}}
</style>
</head>
<body>

<main id="main-content" class="container">

  <section class="mv-hero">
    <p class="mv-eyebrow">Cinema × Games</p>
    <h1 class="mv-h1">Фильмы по играм: <span>все экранизации</span></h1>
    <p class="mv-sub">Каталог фильмов и сериалов по мотивам видеоигр: постеры, рейтинги, описания и даты выхода.
    Раздел обновляется автоматически — свежие анонсы появляются здесь раньше, чем в подборках.</p>
    <div class="mv-badges"><span>обновлено {updated}</span><span>{badge}</span><span>данные TMDB</span></div>
  </section>

{section("Скоро на экранах", "анонсы", upcoming)}{section("Уже вышли", "проверенные", released)}
  <div class="mv-foot">
    Данные, постеры и рейтинги предоставлены <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>.
    This product uses the TMDB API but is not endorsed or certified by TMDB.
  </div>
</main>

<script src="/site-chrome.js?v=1" defer></script>
<script src="/analytics-consent.js" defer></script>
</body>
</html>
"""


def main():
    if not os.environ.get("TMDB_API_KEY", "").strip():
        print("Кино: нет TMDB_API_KEY — пропускаю")
        return 0
    try:
        upcoming, released = collect()
    except (urllib.error.URLError, RuntimeError, ValueError) as err:
        print(f"Кино: ошибка TMDB — {err}")
        return 1
    if not upcoming and not released:
        print("Кино: TMDB не вернул ни одной экранизации — страницу не меняю")
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(upcoming, released), encoding="utf-8", newline="\n")
    print(f"Кино: записано {OUT.relative_to(ROOT)} — скоро {len(upcoming)}, вышло {len(released)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
