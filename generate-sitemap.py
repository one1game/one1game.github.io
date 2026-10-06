import re

# Путь к вашему файлу с данными
DATA_FILE = 'articles-data.js'
# Путь к итоговому sitemap
SITEMAP_FILE = 'sitemap.xml'
# Ваш домен
BASE_URL = 'https://one1game.github.io'

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
    lastmod_xml = f'<lastmod>{lastmod}</lastmod>' if lastmod else ''
    return f'  <url><loc>{loc}</loc>{lastmod_xml}<priority>{priority}</priority></url>'


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

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        url_block(f'{BASE_URL}/', priority='1.0'),
        url_block(f'{BASE_URL}/archive.html', priority='0.8'),
        url_block(f'{BASE_URL}/privacy.html', priority='0.3'),
        url_block(f'{BASE_URL}/terms.html', priority='0.3'),
        url_block(f'{BASE_URL}/advertising.html', priority='0.3'),
        url_block(f'{BASE_URL}/anal-code/', priority='0.7'),
        url_block(f'{BASE_URL}/ai/', priority='0.7'),
        url_block(f'{BASE_URL}/genriprocedur/', priority='0.7'),
        url_block(f'{BASE_URL}/cyber-scanner/', priority='0.7'),
        url_block(f'{BASE_URL}/go/', priority='0.7'),
    ]

    for url in urls:
        clean_path = url.lstrip('/')
        lines.append(url_block(f'{BASE_URL}/{clean_path}', lastmod=lastmods.get(url)))

    lines.append('</urlset>')

    with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    with_date = sum(1 for u in urls if u in lastmods)
    print(f"Готово! В sitemap добавлено страниц: {len(urls) + 2} (с lastmod: {with_date})")


if __name__ == '__main__':
    generate()
