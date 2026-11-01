"""Статус индексации в Google по URL Inspection API.

Это единственный способ узнать не «на какой позиции страница», а «в индексе
ли она вообще». Без этого нельзя отличить плохое ранжирование от простого
отсутствия в индексе — а лечатся они по-разному.

Проверяет приоритетную выборку: главная, хабы, несколько игр и статей.
Пишет отчёт в scripts/data/gsc-index.json.

Ключ — тот же секрет GSC_SERVICE_ACCOUNT_JSON, что у gsc.yml.
Запуск: python scripts/gsc_inspect.py
"""
import json
import os
import re
import sys

import urllib.error
import urllib.request

SITE = 'sc-domain:one1game.org'
API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
BASE = 'https://one1game.org'
LOCK = 'scripts/data/gsc-index.json'
LIMIT = 60  # квота API — 2000 запросов в сутки

PRIORITY = [
    '/', '/archive', '/potyanet-li-igra', '/igry-bez-videokarty',
    '/besplatnye-igry-dlya-slabyh-pk', '/igry-dlya-slabyh-noutbukov-4gb-ozu',
    '/kooperativnye-igry-dlya-slabyh-pk', '/shuter-igry-dlya-slabyh-noutbukov',
    '/rpg-igry-dlya-slabyh-noutbukov', '/igry-dlya-slabyh-noutbukov-onlajn',
    '/category/obzory', '/category/gajdy', '/besplatnye-igry',
    '/skidki-na-igry', '/vo-chto-poigrat',
]


def pick_urls():
    try:
        sm = open('sitemap.xml', encoding='utf-8').read()
        all_urls = re.findall(r'<loc>([^<]+)</loc>', sm)
    except OSError:
        all_urls = []

    # Три группы, чтобы отчёт отвечал на вопрос «что именно Google не берёт»:
    # авто-страницы игр (шаблон), ручные статьи (живой текст) и хабы.
    games = [u for u in all_urls if re.search(r'/archive/[^/]+-\d+$', u)]
    articles = [u for u in all_urls
                if u.startswith(BASE + '/archive/') and u not in games]
    step_g = max(1, len(games) // 20)
    step_a = max(1, len(articles) // 15)
    urls = [BASE + p for p in PRIORITY]
    urls += games[::step_g][:20] + articles[::step_a][:15]

    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:LIMIT]


def group(url):
    p = url.replace(BASE, '')
    if re.search(r'/archive/[^/]+-\d+$', p):
        return 'игры (автогенерация)'
    if p.startswith('/archive/'):
        return 'статьи (ручные)'
    return 'хабы и разделы'


def main():
    raw = os.environ.get('GSC_SERVICE_ACCOUNT_JSON', '').strip()
    if not raw:
        print('Inspect: нет сервисного JSON — пропускаю')
        return
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
    except ImportError:
        print('Inspect: нет google-auth — пропускаю')
        return

    creds = service_account.Credentials.from_service_account_info(
        json.loads(raw), scopes=['https://www.googleapis.com/auth/webmasters'])
    creds.refresh(Request())

    rows = []
    for url in pick_urls():
        body = json.dumps({'inspectionUrl': url, 'siteUrl': SITE}).encode()
        req = urllib.request.Request(API, data=body, method='POST')
        req.add_header('Authorization', 'Bearer ' + creds.token)
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode() or '{}')
        except urllib.error.HTTPError as e:
            print('  ошибка %s — %s' % (e.code, url))
            continue
        res = (data.get('inspectionResult') or {}).get('indexStatusResult') or {}
        rows.append({
            'url': url,
            'group': group(url),
            'verdict': res.get('verdict'),
            'coverage': res.get('coverageState'),
            'robots': res.get('robotsTxtState'),
            'indexing': res.get('indexingState'),
            'lastCrawl': (res.get('lastCrawlTime') or '')[:10],
            'googleCanonical': res.get('googleCanonical'),
        })

    counts = {}
    by_group = {}
    for r in rows:
        counts[r['coverage']] = counts.get(r['coverage'], 0) + 1
        bucket = by_group.setdefault(r['group'], {})
        bucket[r['coverage']] = bucket.get(r['coverage'], 0) + 1
    print('Inspect: проверено %d URL' % len(rows))
    for state, n in sorted(counts.items(), key=lambda x: -x[1]):
        print('  %-52s %d' % (state or '—', n))

    # Разбивка по типам: без неё «1 из 54 в индексе» не говорит, что именно
    # Google не берёт — шаблон, ручные статьи или хабы.
    print('Inspect: по типам страниц')
    for g, st in by_group.items():
        print('  %s — %d' % (g, sum(st.values())))
        for state, n in sorted(st.items(), key=lambda x: -x[1]):
            print('      %-46s %d' % (state or '—', n))

    os.makedirs('scripts/data', exist_ok=True)
    snap = {'site': SITE, 'total': len(rows), 'states': counts, 'urls': rows}
    body = json.dumps(snap, ensure_ascii=False, indent=1) + '\n'
    prev = open(LOCK, encoding='utf-8').read() if os.path.exists(LOCK) else ''
    if body == prev:
        print('Inspect: отчёт не изменился')
    else:
        with open(LOCK, 'w', encoding='utf-8') as f:
            f.write(body)
        print('Inspect: отчёт сохранён — %s' % LOCK)


if __name__ == '__main__':
    sys.exit(main())
