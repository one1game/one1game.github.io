"""Просьба к Google переобойти изменённые страницы в тот же день.

В документации Indexing API разрешён только для вакансий и прямых трансляций,
но эндпоинт принимает любой URL и ставит его в очередь обхода. Обычный цикл
переобхода у нового сайта — недели, а здесь счёт идёт на часы. Это
единственный канал, через который Google можно попросить прийти сегодня.

Нужен сервисный аккаунт, добавленный ВЛАДЕЛЬЦЕМ в Search Console: без этого
API отвечает 403 (Failed to verify the URL ownership). Ключ уже лежит в секрете
GSC_SERVICE_ACCOUNT_JSON — том же, что использует gsc.yml, поэтому отдельный
секрет заводить не нужно. Без ключа скрипт молча выходит.

Запуск: python scripts/google_indexing.py / /archive /archive/doom-379720
"""
import json
import os
import sys

BASE = 'https://one1game.org'
LIMIT = 200  # дневная квота по умолчанию

KEY = (os.environ.get('GSC_SERVICE_ACCOUNT_JSON', '')
       or os.environ.get('GOOGLE_INDEXING_KEY', '')).strip()
urls = [(a if a.startswith('http') else BASE + a) for a in sys.argv[1:]][:LIMIT]

if not KEY:
    print('Indexing API: секрет GOOGLE_INDEXING_KEY не задан — пропускаю')
    sys.exit(0)
if not urls:
    print('Indexing API: нечего отправлять')
    sys.exit(0)

try:
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account
except ImportError:
    print('Indexing API: нет пакета google-auth — пропускаю')
    sys.exit(0)

creds = service_account.Credentials.from_service_account_info(
    json.loads(KEY), scopes=['https://www.googleapis.com/auth/indexing'])
sess = AuthorizedSession(creds)

sent = 0
for url in urls:
    body = json.dumps({'url': url, 'type': 'URL_UPDATED'}).encode('utf-8')
    try:
        r = sess.post('https://indexing.googleapis.com/v3/urlNotifications:publish',
                      data=body, headers={'Content-Type': 'application/json'})
        print('  %s  %s' % (r.status_code, url))
        sent += r.status_code == 200
    except Exception as e:  # сеть или 403 — не роняем весь джоб
        print('  ошибка  %s (%s)' % (url, e))

print('Indexing API: принято %d из %d' % (sent, len(urls)))
