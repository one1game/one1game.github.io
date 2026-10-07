#!/usr/bin/env python3
"""Собирает раздел «Кино» из TMDB:
  * /kino/index.html      — хаб со всеми экранизациями;
  * /kino/<slug>.html     — своя страница под каждый фильм (инфо, актёры, трейлер).
Карточки на хабе ведут на внутренние страницы, наружу уходов нет.

Запуск: TMDB_API_KEY=... python3 scripts/generate-movies.py
Без ключа или при ошибке TMDB ничего не пишется — старые страницы остаются.
"""
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "kino"
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w300"
IMG_BIG = "https://image.tmdb.org/t/p/w500"
SITE = "https://one1game.github.io"
KEYWORD = "based on video game"
UPCOMING_LIMIT = 12
RELEASED_LIMIT = 18

# ИИ-обогащение: тот же Cloudflare Workers AI, что и для игровых страниц.
# Ключи только из окружения, без них генерация текстов просто пропускается.
CF_ACCOUNT_ID = (os.environ.get("CLOUDFLARE_ACCOUNT_ID")
                 or os.environ.get("CLOUDFLARE_ACCOUNT") or "")
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_MODELS = (
    "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
)
# Сгенерированные тексты копим здесь, чтобы они не менялись от запуска к запуску.
AI_FILE = OUT_DIR / "movies-ai.json"

RU_MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
             "июля", "августа", "сентября", "октября", "ноября", "декабря")

# Транслитерация для человекочитаемых адресов страниц фильмов.
TRANS = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}


def _get(path, **params):
    params["api_key"] = os.environ.get("TMDB_API_KEY", "").strip()
    params.setdefault("language", "ru-RU")
    url = f"{API}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def slugify(text):
    out = []
    for ch in text.lower():
        if ch in TRANS:
            out.append(TRANS[ch])
        elif ch.isascii() and ch.isalnum():
            out.append(ch)
        elif ch in " -–—_:.,!?()/":
            out.append("-")
    slug = re.sub(r"-+", "-", "".join(out)).strip("-")
    return slug[:60] or "film"


def find_keyword():
    data = _get("/search/keyword", query=KEYWORD)
    for item in data.get("results", []):
        if KEYWORD in (item.get("name") or "").lower():
            return item["id"]
    return None


def normalize(movie):
    iso = (movie.get("release_date") or "").strip()
    title = (movie.get("title") or movie.get("name") or "").strip()
    mid = movie.get("id")
    return {
        "id": mid,
        "title": title,
        "iso": iso,
        "rating": round(movie.get("vote_average") or 0, 1),
        "votes": movie.get("vote_count") or 0,
        "overview": (movie.get("overview") or "").strip(),
        "poster": f"{IMG}{movie['poster_path']}" if movie.get("poster_path") else "",
        "poster_big": f"{IMG_BIG}{movie['poster_path']}" if movie.get("poster_path") else "",
        "page": f"{SITE}/kino/{slugify(title)}-{mid}.html",
        "href": f"/kino/{slugify(title)}-{mid}.html",
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
            if not item["title"] or item["id"] in seen or not item["id"]:
                continue
            seen.add(item["id"])
            result.append(item)
            if len(result) >= limit:
                break
        return result

    return (clean(upcoming.get("results", []), UPCOMING_LIMIT),
            clean(released.get("results", []), RELEASED_LIMIT))


def pick_trailer(videos):
    """Возвращает ключ YouTube для трейлера, если он есть."""
    rows = [v for v in (videos or {}).get("results", [])
            if (v.get("site") or "").lower() == "youtube" and v.get("key")]
    if not rows:
        return ""
    for kind, official_only in (("Trailer", True), ("Trailer", False), ("Teaser", False)):
        for v in rows:
            if (v.get("type") or "") == kind and (v.get("official") or not official_only):
                return v["key"]
    return rows[0]["key"]


def attach_details(item):
    """Догружает жанры, длительность, актёров и трейлер (рус. с откатом на англ.)."""
    try:
        data = _get(f"/movie/{item['id']}", append_to_response="videos,credits")
    except (urllib.error.URLError, ValueError):
        return item
    item["genres"] = [g.get("name") for g in (data.get("genres") or []) if g.get("name")]
    item["runtime"] = data.get("runtime") or 0
    item["tagline"] = (data.get("tagline") or "").strip()
    item["cast"] = [(c.get("name"), c.get("character") or "")
                    for c in ((data.get("credits") or {}).get("cast") or [])[:8] if c.get("name")]
    item["directors"] = [c.get("name") for c in ((data.get("credits") or {}).get("crew") or [])
                         if c.get("job") == "Director" and c.get("name")]
    item["trailer"] = pick_trailer(data.get("videos"))
    if not item["trailer"]:
        try:
            item["trailer"] = pick_trailer(_get(f"/movie/{item['id']}/videos", language="en-US"))
        except (urllib.error.URLError, ValueError):
            item["trailer"] = ""
    return item


def english_overview(mid):
    """Английское описание из TMDB — источник для пересказа, если русского нет."""
    try:
        data = _get(f"/movie/{mid}", language="en-US")
    except (urllib.error.URLError, ValueError):
        return ""
    return (data.get("overview") or "").strip()


def cf_chat(prompt):
    """Текст от Cloudflare Workers AI. Пусто, если ключей нет или модели молчат."""
    if not (CF_ACCOUNT_ID and CF_API_TOKEN):
        return ""
    for model in CF_MODELS:
        try:
            body = json.dumps({"messages": [{"role": "user", "content": prompt}],
                               "max_tokens": 1200}).encode()
            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{model}",
                data=body, method="POST",
                headers={"Authorization": f"Bearer {CF_API_TOKEN}",
                         "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode())
        except (urllib.error.URLError, ValueError):
            continue
        result = data.get("result") or {}
        text = (result.get("response") or "").strip()
        if not text:
            choices = result.get("choices") or []
            if choices:
                text = ((choices[0].get("message") or {}).get("content") or "").strip()
        if text:
            return text
    return ""


def ai_prompt(item, source):
    cast = ", ".join(name for name, _ in (item.get("cast") or [])) or "не указаны"
    return (
        "Ты SEO-редактор кинораздела русскоязычного портала One1Game.\n"
        "Ниже данные фильма-экранизации видеоигры. Сделай уникальный текст ТОЛЬКО на русском.\n"
        "Правила:\n"
        "- Весь ответ только на русском, без английских слов (кроме названия фильма и имён).\n"
        "- Не выдумывай факты: опирайся только на данные ниже.\n"
        "- Не пиши «купить», «скачать», «смотреть онлайн».\n"
        "- Без воды и штампов.\n"
        "- Верни СТРОГО JSON без markdown:\n"
        '{"overview":"...","meta":"..."}\n'
        "- overview: 2-3 предложения, до 420 символов, о чём фильм и чем интересен.\n"
        "- meta: 120-155 символов.\n"
        "Данные:\n"
        f"Название: {item['title']}\n"
        f"Год: {item['iso'][:4] or 'неизвестен'}\n"
        f"Жанры: {', '.join(item.get('genres') or []) or 'не указаны'}\n"
        f"Режиссёр: {', '.join(item.get('directors') or []) or 'не указан'}\n"
        f"Актёры: {cast}\n"
        f"Описание TMDB: {source or 'нет'}"
    )


def ai_parse(text):
    found = re.search(r"\{[\s\S]*\}", text or "")
    if not found:
        return None
    try:
        return json.loads(found.group(0))
    except ValueError:
        return None


def load_ai():
    if not AI_FILE.exists():
        return {}
    try:
        return json.loads(AI_FILE.read_text(encoding="utf-8"))
    except ValueError:
        return {}


def ru_date(iso):
    if len(iso) < 10:
        return "дата не объявлена"
    year, month, day = int(iso[:4]), int(iso[5:7]), int(iso[8:10])
    if not 1 <= month <= 12:
        return iso
    return f"{day} {RU_MONTHS[month - 1]} {year}"


def ru_runtime(minutes):
    if not minutes:
        return ""
    hours, mins = divmod(int(minutes), 60)
    return f"{hours} ч {mins:02d} мин" if hours else f"{mins} мин"


def card(item):
    title = html.escape(item["title"])
    rate = (f'<span class="mv-rate">★ {item["rating"]}</span>'
            if item["votes"] >= 5 else "")
    if item["poster"]:
        poster = (f'<img src="{item["poster"]}" alt="{title}" loading="lazy" '
                  f'width="300" height="450">')
    else:
        poster = '<span class="mv-empty">🎬</span>'
    return (f'<article class="mv-card">'
            f'<a class="mv-poster" href="{item["href"]}">{poster}{rate}</a>'
            f'<div class="mv-body"><b><a href="{item["href"]}">{title}</a></b>'
            f'<small>{ru_date(item["iso"])}</small>'
            f'<p>{html.escape(item["overview"]) or "Описание пока не добавлено."}</p>'
            f'</div></article>')


def section(title, badge, items):
    if not items:
        return ""
    cards = "\n".join(card(i) for i in items)
    return (f'<div class="section-header"><h2 class="section-title">{title}</h2>'
            f'<span class="section-badge">{badge}</span></div>\n'
            f'<div class="mv-grid">{cards}</div>\n')


HUB_CSS = """
.mv-hero{margin:22px 0 4px;padding:24px 20px;border:1px solid var(--line);border-left:4px solid var(--acid);border-radius:var(--radius);
  background:repeating-linear-gradient(0deg,rgba(125,255,155,.035) 0 1px,transparent 1px 3px),linear-gradient(135deg,rgba(125,255,155,.10),var(--panel) 60%)}
.mv-eyebrow{font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;color:var(--acid);margin-bottom:10px}
.mv-h1{font-size:clamp(1.6rem,5.4vw,2.5rem);line-height:1.12;letter-spacing:-.02em;color:#fff;margin-bottom:12px}
.mv-h1 span{color:var(--acid)}
.mv-sub{max-width:66ch;color:var(--ink-dim);font-size:.9rem}
.mv-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.mv-badges span{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--acid);border:1px solid var(--line-hi);border-radius:999px;padding:4px 10px}
.mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:14px 0 26px}
.mv-card{border:1px solid var(--line-soft);border-radius:var(--radius);background:var(--panel);overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s,transform .15s,box-shadow .15s}
.mv-card:hover{border-color:var(--line-hi);transform:translateY(-2px);box-shadow:var(--shadow)}
.mv-poster{position:relative;display:block;aspect-ratio:2/3;background:#0a0f14;text-decoration:none}
.mv-poster img{width:100%;height:100%;object-fit:cover;display:block}
.mv-empty{display:grid;place-items:center;height:100%;font-size:2.4rem;opacity:.5}
.mv-rate{position:absolute;top:8px;left:8px;font-size:.66rem;font-weight:700;padding:3px 7px;border-radius:8px;background:rgba(4,6,10,.82);color:var(--acid);border:1px solid var(--line-hi)}
.mv-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:5px}
.mv-body b{font-size:.88rem;line-height:1.3}
.mv-body b a{color:#fff;text-decoration:none}
.mv-body b a:hover{color:var(--acid)}
.mv-body small{color:var(--acid);font-size:.7rem;letter-spacing:.03em}
.mv-body p{color:var(--ink-dim);font-size:.74rem;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.mv-foot{font-size:.68rem;color:var(--ink-faint);margin:20px 0 6px;line-height:1.6}
"""

MOVIE_CSS = """
.mv-film{padding:22px 0 40px}
.mv-crumbs{font-size:.74rem;color:var(--ink-faint);margin-bottom:14px}
.mv-crumbs a{color:var(--ink-dim);text-decoration:none}
.mv-crumbs a:hover{color:var(--acid)}
.mv-film-head{display:grid;grid-template-columns:minmax(180px,260px) 1fr;gap:22px;align-items:start;margin-bottom:22px}
.mv-film-poster{border:1px solid var(--line-soft);border-radius:var(--radius);overflow:hidden;background:var(--panel)}
.mv-film-poster img{width:100%;display:block}
.mv-film-title{font-size:clamp(1.4rem,4.4vw,2.2rem);line-height:1.15;color:#fff;margin-bottom:8px}
.mv-film-tagline{color:var(--acid);font-size:.86rem;font-style:italic;margin-bottom:12px}
.mv-facts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.mv-facts span{font-size:.7rem;padding:4px 10px;border:1px solid var(--line-soft);border-radius:999px;color:var(--ink-dim)}
.mv-facts span b{color:var(--acid);font-weight:700}
.mv-film-overview{color:var(--ink-dim);font-size:.9rem;line-height:1.7}
.mv-film h2{font-size:1.05rem;color:#fff;margin:24px 0 10px}
.mv-trailer{position:relative;aspect-ratio:16/9;border:1px solid var(--line-hi);border-radius:12px;overflow:hidden;background:#000}
.mv-trailer iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.mv-cast{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.mv-cast div{border:1px solid var(--line-soft);border-radius:10px;padding:9px 11px;font-size:.78rem;color:var(--ink-dim)}
.mv-cast div b{display:block;color:#fff;font-size:.82rem}
.mv-back{display:inline-block;margin-top:22px;font-size:.78rem;color:var(--acid);text-decoration:none}
.mv-foot{font-size:.68rem;color:var(--ink-faint);margin:20px 0 6px;line-height:1.6}
@media (max-width:640px){.mv-film-head{grid-template-columns:1fr}.mv-film-poster{max-width:240px}}
"""

TMDB_NOTE = ("Данные и постеры предоставлены TMDB. "
             "This product uses the TMDB API but is not endorsed or certified by TMDB.")


def head(title, description, canonical, extra_css, ld):
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description)}">
<meta name="keywords" content="фильмы по играм, экранизации видеоигр, фильмы по мотивам игр">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#04060a">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="manifest" href="/manifest.json">
<meta property="og:type" content="website">
<meta property="og:site_name" content="One1Game">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/site-og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
</script>
<link rel="stylesheet" href="/styles.css?v=44">
<style>{extra_css}</style>
</head>
<body>
"""


def render_hub(upcoming, released):
    today = date.today()
    total = len(upcoming) + len(released)
    badge = f"{total} экранизаций" if total else "раздел обновляется"
    summary = (f"Сейчас в подборке {total} экранизаций." if total
               else "Раздел обновляется автоматически.")
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "CollectionPage", "name": "Фильмы по играм — экранизации видеоигр",
             "url": f"{SITE}/kino/", "inLanguage": "ru", "dateModified": today.isoformat(),
             "isPartOf": {"@type": "WebSite", "name": "One1Game", "url": SITE}},
            {"@type": "ItemList", "name": "Скоро на экранах",
             "itemListElement": [
                 {"@type": "ListItem", "position": n, "name": i["title"], "url": i["page"]}
                 for n, i in enumerate(upcoming[:12], 1)]},
        ],
    }
    body = f"""<main id="main-content" class="container">

  <section class="mv-hero">
    <p class="mv-eyebrow">Cinema × Games</p>
    <h1 class="mv-h1">Фильмы по играм: <span>все экранизации</span></h1>
    <p class="mv-sub">Каталог фильмов и сериалов по мотивам видеоигр. Жми на карточку — откроется страница фильма
    с описанием, актёрами, рейтингом и трейлером прямо на сайте.</p>
    <div class="mv-badges"><span>обновлено {today.isoformat()}</span><span>{badge}</span><span>свои страницы фильмов</span></div>
  </section>

{section("Скоро на экранах", "анонсы", upcoming)}{section("Уже вышли", "проверенные", released)}
  <div class="mv-foot">{TMDB_NOTE}</div>
</main>

<script src="/site-chrome.js?v=1" defer></script>
<script src="/analytics-consent.js" defer></script>
</body>
</html>
"""
    return (head(f"Фильмы по играм — экранизации видеоигр {today.year} | One1Game",
                 f"Каталог экранизаций видеоигр: постеры, рейтинги, описания и трейлеры. {summary}",
                 f"{SITE}/kino/", HUB_CSS, ld) + body)


def render_movie(item):
    title_esc = html.escape(item["title"])
    overview = item["overview"] or "Описание пока не добавлено."
    facts = []
    if item["iso"]:
        facts.append(f'<span>Премьера: <b>{ru_date(item["iso"])}</b></span>')
    if item.get("runtime"):
        facts.append(f'<span>Длительность: <b>{ru_runtime(item["runtime"])}</b></span>')
    if item["votes"] >= 5:
        facts.append(f'<span>Рейтинг: <b>★ {item["rating"]}</b> (TMDB)</span>')
    if item.get("genres"):
        facts.append(f'<span>Жанры: <b>{html.escape(", ".join(item["genres"]))}</b></span>')
    if item.get("directors"):
        facts.append(f'<span>Режиссёр: <b>{html.escape(", ".join(item["directors"]))}</b></span>')

    poster = (f'<div class="mv-film-poster"><img src="{item["poster_big"] or item["poster"]}" '
              f'alt="{title_esc} — постер" width="500" height="750" loading="eager"></div>'
              if item["poster"] else "")
    trailer = (f'<h2>Трейлер</h2>\n<div class="mv-trailer">'
               f'<iframe src="https://www.youtube-nocookie.com/embed/{item["trailer"]}" '
               f'title="{title_esc} — трейлер" loading="lazy" '
               f'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" '
               f'allowfullscreen></iframe></div>'
               if item.get("trailer") else "")
    cast = ""
    if item.get("cast"):
        rows = "".join(f'<div><b>{html.escape(n)}</b>{html.escape(r)}</div>' for n, r in item["cast"])
        cast = f'<h2>В ролях</h2>\n<div class="mv-cast">{rows}</div>'

    ld = {
        "@context": "https://schema.org",
        "@type": "Movie",
        "name": item["title"],
        "url": item["page"],
        "inLanguage": "ru",
        "description": item["overview"] or item["title"],
    }
    if item["poster_big"]:
        ld["image"] = item["poster_big"]
    if item["iso"]:
        ld["datePublished"] = item["iso"]
    if item.get("genres"):
        ld["genre"] = item["genres"]
    if item.get("directors"):
        ld["director"] = [{"@type": "Person", "name": n} for n in item["directors"]]
    if item.get("runtime"):
        ld["duration"] = f"PT{int(item['runtime'])}M"

    desc = item.get("meta") or item["overview"] or f"{item['title']} — экранизация видеоигры: описание, актёры, трейлер."
    body = f"""<main id="main-content" class="container mv-film">
  <nav class="mv-crumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a> → <a href="/kino/">Кино</a> → <span>{title_esc}</span>
  </nav>

  <div class="mv-film-head">
    {poster}
    <div>
      <h1 class="mv-film-title">{title_esc}</h1>
      {f'<p class="mv-film-tagline">{html.escape(item["tagline"])}</p>' if item.get("tagline") else ""}
      <div class="mv-facts">{''.join(facts)}</div>
      <p class="mv-film-overview">{html.escape(overview)}</p>
    </div>
  </div>

  {trailer}
  {cast}

  <a class="mv-back" href="/kino/">← Все экранизации</a>
  <div class="mv-foot">{TMDB_NOTE}</div>
</main>

<script src="/site-chrome.js?v=1" defer></script>
<script src="/analytics-consent.js" defer></script>
</body>
</html>
"""
    return head(f"{item['title']} — экранизация видеоигры: трейлер, актёры, рейтинг | One1Game",
                desc, item["page"], MOVIE_CSS, ld) + body


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
        print("Кино: TMDB не вернул ни одной экранизации — страницы не меняю")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = upcoming + released
    for item in items:
        attach_details(item)

    # Источник описания: русское из TMDB, иначе английское (для пересказа ИИ).
    for item in items:
        if not item["overview"]:
            item["en"] = english_overview(item["id"])

    # Пустышки — ни описания, ни рейтинга — страниц не получают.
    kept = [i for i in items if i["overview"] or i.get("en") or i["votes"] >= 5]
    keep_ids = {i["id"] for i in kept}
    dropped = len(items) - len(kept)
    upcoming = [i for i in upcoming if i["id"] in keep_ids]
    released = [i for i in released if i["id"] in keep_ids]

    # ИИ-обогащение: тексты кешируются в movies-ai.json и не меняются от запуска к запуску.
    ai_data = load_ai()
    ai_new = 0
    for item in kept:
        if item["overview"]:
            continue
        cached = ai_data.get(str(item["id"]))
        if cached and cached.get("overview"):
            item["overview"] = cached["overview"]
            item["meta"] = cached.get("meta") or ""
            continue
        text = cf_chat(ai_prompt(item, item.get("en", "")))
        obj = ai_parse(text) if text else None
        if obj and (obj.get("overview") or "").strip():
            item["overview"] = str(obj["overview"]).strip()[:420]
            item["meta"] = str(obj.get("meta") or "").strip()[:160]
            ai_data[str(item["id"])] = {"overview": item["overview"],
                                        "meta": item["meta"],
                                        "updated": date.today().isoformat()}
            ai_new += 1
        elif item.get("en"):
            item["overview"] = item["en"][:420]

    ai_data = {k: v for k, v in ai_data.items() if k in {str(i["id"]) for i in kept}}
    AI_FILE.write_text(json.dumps(ai_data, ensure_ascii=False, indent=2, sort_keys=True),
                       encoding="utf-8", newline="\n")

    # Убираем страницы фильмов, которых больше нет в подборке.
    keep = {Path(i["href"]).name for i in kept} | {"index.html"}
    removed = 0
    for old in OUT_DIR.glob("*.html"):
        if old.name not in keep:
            old.unlink()
            removed += 1

    (OUT_DIR / "index.html").write_text(render_hub(upcoming, released), encoding="utf-8", newline="\n")
    trailers = 0
    for item in kept:
        (OUT_DIR / Path(item["href"]).name).write_text(render_movie(item), encoding="utf-8", newline="\n")
        trailers += 1 if item.get("trailer") else 0

    print(f"Кино: хаб + {len(kept)} страниц фильмов (трейлеров: {trailers}), "
          f"удалено старых: {removed}, пропущено пустых: {dropped}, ИИ-текстов новых: {ai_new}")
    print(f"Кино: скоро {len(upcoming)}, вышло {len(released)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
