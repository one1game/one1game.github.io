#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Радар спроса: что люди реально набирают и чего у нас под это нет.

Собирает подсказки четырёх движков (Google, Bing, DDG, Yandex) по заданным
префиксам, чистит их, сверяет с каталогом статей и печатает разрывы:
запрос есть в спросе — страницы под него нет.

Запуск:
    python scripts/search_radar.py
    python scripts/search_radar.py --letters 16 --prefix "потянет ли" --prefix "хватит ли"
    python scripts/search_radar.py --all-letters

Ключи не нужны: все четыре эндпоинта публичные.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "articles-data.js")
CACHE = os.path.join(ROOT, "scripts", "data", "radar-cache.json")

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9",
}
ALPHABET = "абвгдежзиклмнопрстуфхцчшщэюя"

MOBILE = re.compile(r"айфон|iphone|ipad|андроид|android|телефон|смартфон|сяоми|xiaomi|"
                    r"poco|redmi|samsung|самсунг|realme|honor|хонор|макбук|macbook")
JUNK = re.compile(r"бензогенератор|сварочн|наушник|генератор|принтер|холодильник|"
                  r"пылесос|зарядк|аккумулятор|бойлер|кулер|машина|авто")
STOP = set("""потянет пойдет пойдёт запустится хватит поиграть игры для ли на моем мой пк
комп комп компьютер ноутбук ноутбуке игру игра слабом слабый видеокартой озу оперативой
процессором онлайн без геймпаде двоих у меня сайт виндовс""".split())


def get_json(url, timeout=6):
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA),
                                     timeout=timeout).read()
        return json.loads(raw.decode("utf-8", "ignore"))
    except Exception:
        return None


def suggest_google(q):
    j = get_json("https://suggestqueries.google.com/complete/search?client=chrome"
                 "&hl=ru&gl=ru&q=" + urllib.parse.quote(q))
    return j[1] if j and len(j) > 1 and isinstance(j[1], list) else []


def suggest_bing(q):
    j = get_json("https://api.bing.com/osjson.aspx?query=%s&market=ru-RU"
                 % urllib.parse.quote(q))
    return j[1] if j and len(j) > 1 and isinstance(j[1], list) else []


def suggest_ddg(q):
    j = get_json("https://duckduckgo.com/ac/?q=%s&type=list" % urllib.parse.quote(q))
    if not isinstance(j, list):
        return []
    # Эндпоинт отдаёт то строки, то объекты {phrase: ...} — принимаем оба вида.
    out = []
    for x in j:
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict):
            out.append(x.get("phrase", ""))
    return out


def suggest_yandex(q):
    j = get_json("https://suggest.yandex.ru/suggest-ff.cgi?part=%s" % urllib.parse.quote(q))
    return j[1] if j and len(j) > 1 and isinstance(j[1], list) else []


ENGINES = {"google": suggest_google, "bing": suggest_bing,
           "ddg": suggest_ddg, "yandex": suggest_yandex}


def collect(prefixes, letters, with_serp):
    found = {}
    for p in prefixes:
        variants = [p + ch for ch in letters] if letters else [p]
        for q in variants:
            for name, fn in ENGINES.items():
                for s in fn(q):
                    s = (s or "").strip().lower()
                    if s:
                        found.setdefault(s, set()).add(name)
            time.sleep(0.12)
        print("  %-22s собрано %d" % (p.strip(), len(found)), flush=True)
    return found


def load_catalog():
    if not os.path.exists(CATALOG):
        return set()
    raw = open(CATALOG, encoding="utf-8").read()
    return {m.group(1) for m in re.finditer(r'"url":\s*"(/archive/[^"]+)"', raw)}


def known_text():
    """Всё, что у нас уже описано: заголовки каталога + кириллические псевдонимы."""
    parts = []
    if os.path.exists(CATALOG):
        raw = open(CATALOG, encoding="utf-8").read()
        parts += re.findall(r'"title"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
    demand = os.path.join(ROOT, "scripts", "data", "demand-appids.json")
    if os.path.exists(demand):
        try:
            for g in json.load(open(demand, encoding="utf-8")).get("games", []):
                parts.append(g.get("alias") or "")
        except Exception:
            pass
    return re.sub(r"\s+", " ", " ".join(parts).lower())


def core(q):
    t = re.sub(r"^(потянет|пойдет|пойдёт|запустится|хватит)\s+ли\s+", "", q)
    t = re.sub(r"^(во что поиграть на|игры для)\s+", "", t)
    return " ".join(w for w in re.findall(r"[а-яёa-z0-9]+", t) if w not in STOP)[:40]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefix", action="append", default=None)
    ap.add_argument("--letters", type=int, default=12,
                    help="сколько букв алфавита подставлять (0 — без раскрытия)")
    ap.add_argument("--all-letters", action="store_true")
    ap.add_argument("--json", action="store_true", help="вывести результат в JSON")
    args = ap.parse_args()

    prefixes = args.prefix or ["потянет ли ", "хватит ли ", "во что поиграть на "]
    letters = ALPHABET if args.all_letters else ALPHABET[: max(0, args.letters)]
    if args.letters <= 0 and not args.all_letters:
        letters = []

    print("Собираю подсказки (4 движка)...")
    found = collect(prefixes, letters, False)
    print("\nвсего запросов: %d" % len(found))

    games = [q for q in found if not MOBILE.search(q) and not JUNK.search(q)]
    mobile = [q for q in found if MOBILE.search(q)]
    junk = [q for q in found if JUNK.search(q)]

    known = known_text()

    gap = []
    for q in games:
        c = core(q)
        if not c:
            continue
        words = re.findall(r"[а-яёa-z0-9]{3,}", c)
        # Покрыто, если хотя бы одно значимое слово запроса есть в названиях
        # или в кириллических псевдонимах — иначе получим ложные «разрывы».
        if words and not any(w in known for w in words[:2]):
            gap.append((len(found[q]), q))

    print("\nсостав: игровые %d | мобильные %d | не про игры %d"
          % (len(games), len(mobile), len(junk)))
    print("мобильных примеров: %s" % ", ".join(mobile[:4]))

    gap.sort(reverse=True)
    print("\nразрыв — спрос есть, страницы нет: %d" % len(gap))
    for _, q in gap[:25]:
        print("   - %s" % q)

    if args.json:
        print(json.dumps({"total": len(found), "mobile": mobile[:50],
                          "gap": [q for _, q in gap[:200]]}, ensure_ascii=False, indent=1))

    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump({k: sorted(v) for k, v in found.items()},
              open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nкэш: %s" % os.path.relpath(CACHE, ROOT))


if __name__ == "__main__":
    sys.exit(main())
