import os
import re
from datetime import datetime, timezone

# Путь к вашему файлу с данными
DATA_FILE = 'articles-data.js'
# Путь к итоговому sitemap
SITEMAP_FILE = 'sitemap.xml'
# Ваш домен
BASE_URL = 'https://one1game.org'

MONTHS = {
    'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
    'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
    'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
}


def to_iso_date(value):
    """Приводит дату к YYYY-MM-DD. Поддерживает ISO и '6 октября 2026'."""
    value = (value or '').strip()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return value
    m = re.fullmatch(r'(\d{1,2})\s+([а-яё]+)\s+(\d{4})', value, re.IGNORECASE)
    if m and m.group(2).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(2).lower()]}-{int(m.group(1)):02d}"
    return None


def collect_lastmod(content):
    """Возвращает {url: lastmod} из записей articles-data.js."""
    result = {}
    # Каждая запись — плоский объект {...} с url/date/updated (без вложенных {}).
    for block in re.findall(r'\{[^{}]*\}', content, re.DOTALL):
        m_url = re.search(r'["\']?url["\']?\s*:\s*["\']([^"\']+)["\']', block)
        if not m_url:
            continue
        url = m_url.group(1)
        m_upd = re.search(r'["\']?updated["\']?\s*:\s*["\']([^"\']+)["\']', block)
        m_date = re.search(r'["\']?date["\']?\s*:\s*["\']([^"\']+)["\']', block)
        iso = to_iso_date(m_upd.group(1) if m_upd else '') or to_iso_date(m_date.group(1) if m_date else '')
        if iso:
            result[url] = iso
    return result


def url_block(loc, lastmod=None, priority='0.7'):
    loc = loc.replace('.html', '')  # Cloudflare Pages убирает .html — sitemap тоже без расширения
    lastmod_xml = f'<lastmod>{lastmod}</lastmod>' if lastmod else ''
    return f'  <url><loc>{loc}</loc>{lastmod_xml}<priority>{priority}</priority></url>'


def page_lastmod(name):
    """Дата последнего реального изменения файла — из его же JSON-LD.

    Раньше сюда подставлялся today: 80 URL каждый прогон объявляли себя
    обновлёнными, даже когда байты не менялись. Движки такую дату перестают
    учитывать, и приоритет обхода у новых страниц падает. Если даты в файле
    нет — lastmod не пишем вовсе: пусть движок решает сам.
    """
    path = name
    if path.endswith('/'):
        path = path.rstrip('/') + '/index.html'
    if not os.path.exists(path):
        return None
    try:
        html = open(path, encoding='utf-8', errors='ignore').read()
    except OSError:
        return None
    m = re.search(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})', html)
    return m.group(1) if m else None


def page_noindex(url):
    """Страница закрыта от индекса — в карту сайта её не кладём.

    Шаблонные страницы игр массово ушли под noindex: Google их и так не брал,
    а в карте они создавали видимость 1281 «нужной» страницы.
    """
    root = os.path.dirname(os.path.abspath(__file__))
    path = url.lstrip('/')
    if not path or path.endswith('/'):
        path = path.rstrip('/') + '/index.html'
    elif not path.endswith('.html'):
        path += '.html'
    full = os.path.join(root, path)
    if not os.path.exists(full):
        return False
    try:
        head = open(full, encoding='utf-8', errors='ignore').read(4000)
    except OSError:
        return False
    return re.search(r'name="robots"\s+content="[^"]*noindex', head) is not None


def generate():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Ошибка: {DATA_FILE} не найден")
        return

    regex = r'["\']?url["\']?\s*:\s*["\']([^"\']+)["\']'
    urls = re.findall(regex, content)

    if not urls:
        print("Статьи не найдены. Проверьте формат в articles-data.js")
        return

    lastmods = collect_lastmod(content)

    # Дата сборки: у статических хабов нет своего «обновлено», но менять их принято
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Статические страницы и хабы. lastmod — из файла, а не «сегодня»:
    # дата должна меняться только тогда, когда менялись байты страницы.
    FIXED = [
        ('/', 'index.html', '1.0'),
        ('/archive.html', 'archive.html', '0.8'),
        ('/privacy.html', None, '0.3'),
        ('/terms.html', None, '0.3'),
        ('/advertising.html', None, '0.3'),
        ('/anal-code/', None, '0.7'),
        ('/ai/', None, '0.7'),
        ('/genriprocedur/', None, '0.7'),
        ('/cyber-scanner/', None, '0.7'),
        ('/go/', None, '0.7'),
        ('/feed/', 'feed/index.html', '0.8'),
        ('/browserquest/', 'browserquest/index.html', '0.8'),
        ('/portablewebgame/', 'portablewebgame/index.html', '0.8'),
        ('/dos/', 'dos/index.html', '0.8'),
        ('/red-alert-2/', 'red-alert-2/index.html', '0.8'),
        ('/kino/', 'kino/index.html', '0.8'),
        ('/besplatnye-igry.html', 'besplatnye-igry.html', '0.8'),
        ('/skidki-na-igry.html', 'skidki-na-igry.html', '0.8'),
        ('/vo-chto-poigrat.html', 'vo-chto-poigrat.html', '0.7'),
        # С главной на них ведут ссылки, а в карте сайта их не было: робот
        # узнавал об этих разделах только по обходу, а не из карты.
        ('/triad-duel.html', 'triad-duel.html', '0.6'),
        ('/l2/', 'l2/index.html', '0.6'),
        # Хабы «игры для слабых ноутбуков» (собираются scripts/slabye-noutbuki.mjs)
        ('/igry-bez-videokarty.html', 'igry-bez-videokarty.html', '0.8'),
        ('/igry-dlya-slabyh-noutbukov-4gb-ozu.html', 'igry-dlya-slabyh-noutbukov-4gb-ozu.html', '0.8'),
        ('/besplatnye-igry-dlya-slabyh-pk.html', 'besplatnye-igry-dlya-slabyh-pk.html', '0.8'),
        ('/kooperativnye-igry-dlya-slabyh-pk.html', 'kooperativnye-igry-dlya-slabyh-pk.html', '0.8'),
        ('/shuter-igry-dlya-slabyh-noutbukov.html', 'shuter-igry-dlya-slabyh-noutbukov.html', '0.8'),
        ('/rpg-igry-dlya-slabyh-noutbukov.html', 'rpg-igry-dlya-slabyh-noutbukov.html', '0.8'),
        ('/gonochnye-igry-dlya-slabyh-noutbukov.html', 'gonochnye-igry-dlya-slabyh-noutbukov.html', '0.8'),
        ('/igry-dlya-slabyh-noutbukov-onlajn.html', 'igry-dlya-slabyh-noutbukov-onlajn.html', '0.8'),
        ('/igry-dlya-slabyh-noutbukov-s-gejmpadom.html', 'igry-dlya-slabyh-noutbukov-s-gejmpadom.html', '0.8'),
        ('/potyanet-li-igra.html', 'potyanet-li-igra.html', '0.8'),
    ]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, fname, prio in FIXED:
        lines.append(url_block(f'{BASE_URL}{loc}',
                               lastmod=page_lastmod(fname) if fname else None,
                               priority=prio))

    # Страницы «что пойдёт на <видеокарту>» — генерируются build_gpu_pages.py.
    root_dir = os.path.dirname(os.path.abspath(__file__))
    for name in sorted(os.listdir(root_dir)):
        if re.match(r'^igry-dlya-(gtx|rtx|rx|intel|amd)-[a-z0-9-]+\.html$', name):
            lines.append(url_block(f'{BASE_URL}/{name}',
                                   lastmod=page_lastmod(name), priority='0.9'))

    # Страницы-хабы категорий (topical authority)
    for slug in ('ii-i-tehnologii', 'analitika', 'gajdy', 'konsoli', 'trendy',
                 'razrabotka', 'mnenie', 'kino-i-igry', 'obzory'):
        lines.append(url_block(f'{BASE_URL}/category/{slug}.html',
                               lastmod=page_lastmod(f'category/{slug}.html'), priority='0.6'))

    # Страницы фильмов, сгенерированные из TMDB
    kino_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kino')
    if os.path.isdir(kino_dir):
        for name in sorted(os.listdir(kino_dir)):
            if name.endswith('.html') and name != 'index.html':
                lines.append(url_block(f'{BASE_URL}/kino/{name}',
                                       lastmod=page_lastmod(os.path.join(kino_dir, name)),
                                       priority='0.6'))

    skipped = 0
    for url in urls:
        # /archive/-<appid> — страница без человекочитаемого слага (название игры
        # не латиницей). Она закрыта noindex, в карту сайта не попадает.
        if re.fullmatch(r'/archive/-\d+', url):
            skipped += 1
            continue
        if page_noindex(url):
            skipped += 1
            continue
        clean_path = url.lstrip('/')
        lines.append(url_block(f'{BASE_URL}/{clean_path}', lastmod=lastmods.get(url)))

    lines.append('</urlset>')

    with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    with_date = sum(1 for u in urls if u in lastmods)
    print(f"Готово! В sitemap добавлено страниц: {len(lines) - 3} (с lastmod: {with_date}), "
          f"пропущено noindex-страниц: {skipped}")


if __name__ == '__main__':
    generate()
