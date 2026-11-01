# -*- coding: utf-8 -*-
"""Генерация RSS-ленты сайта.

Зачем: Google читает RSS как «короткий sitemap» и опрашивает фиды чаще, чем
большой sitemap.xml. Конкуренты (wotpack, iwillplay) закрывают /feed/ и /feeds/*.xml
в robots.txt — этот канал у них выключен. У нас он открыт.

Запуск: python generate-feed.py
"""
import json
import re
from datetime import datetime
from email.utils import format_datetime
from xml.sax.saxutils import escape

DATA_FILE = 'articles-data.js'
FEED_FILE = 'feed.xml'
BASE = 'https://one1game.org'
LIMIT = 40

MONTHS = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
    'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
}


def to_date(value):
    value = (value or '').strip()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return datetime.strptime(value, '%Y-%m-%d')
    m = re.fullmatch(r'(\d{1,2})\s+([а-яё]+)\s+(\d{4})', value, re.IGNORECASE)
    if m and m.group(2).lower() in MONTHS:
        return datetime(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
    return None


def load_articles():
    with open(DATA_FILE, encoding='utf-8') as f:
        src = f.read()
    start = src.index('= [') + 2
    end = src.rindex('];') + 1
    return json.loads(src[start:end])


def main():
    articles = load_articles()
    rows = []
    for a in articles:
        d = to_date(a.get('updated')) or to_date(a.get('date'))
        if not d:
            continue
        rows.append((d, a))
    rows.sort(key=lambda x: x[0], reverse=True)
    rows = rows[:LIMIT]

    now = format_datetime(rows[0][0].replace(hour=12) if rows else datetime.utcnow())

    items = []
    for d, a in rows:
        url = BASE + a['url']
        title = escape(a.get('title') or '')
        desc = escape(a.get('excerpt') or '')
        cat = escape(a.get('category') or '')
        items.append(
            '    <item>\n'
            f'      <title>{title}</title>\n'
            f'      <link>{url}</link>\n'
            f'      <guid isPermaLink="true">{url}</guid>\n'
            f'      <pubDate>{format_datetime(d.replace(hour=12))}</pubDate>\n'
            f'      <category>{cat}</category>\n'
            f'      <description>{desc}</description>\n'
            '    </item>'
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        '  <channel>\n'
        '    <title>One1Game — обзоры игр, гайды и аналитика</title>\n'
        f'    <link>{BASE}/</link>\n'
        f'    <atom:link href="{BASE}/feed.xml" rel="self" type="application/rss+xml" />\n'
        '    <description>Игровой портал: обзоры видеоигр, гайды, аналитика индустрии, ИИ и технологии, кино.</description>\n'
        '    <language>ru-RU</language>\n'
        f'    <lastBuildDate>{now}</lastBuildDate>\n'
        f'    <docs>https://www.rssboard.org/rss-specification</docs>\n'
        '    <generator>generate-feed.py</generator>\n'
        + '\n'.join(items) + '\n'
        '  </channel>\n'
        '</rss>\n'
    )
    with open(FEED_FILE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(xml)
    print(f'feed.xml: {len(rows)} записей, {len(xml)} байт')


if __name__ == '__main__':
    main()
