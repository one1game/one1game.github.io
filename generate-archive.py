"""Предрендер страницы «Статьи» (archive.html).

Список материалов на этой странице собирается JavaScript'ом из articles-data.js,
поэтому боты и ИИ-краулеры без JS видели пустой контейнер. Скрипт вставляет
готовую первую страницу ленты между маркерами <!--ARCHIVE:*:START/END--> —
ровно так же, как generate-home.py делает для главной.

Разметка повторяет то, что рисует JS в archive.html, чтобы после загрузки
страница не «мигала» и не выглядела иначе.

Запуск: python generate-archive.py
"""
import html
import json
import re

DATA_FILE = 'articles-data.js'
PAGE_FILE = 'archive.html'
PER_PAGE = 6
LEAD_IMAGE = re.compile(r'\.webp$', re.IGNORECASE)

# Порядок разделов — как в archive.html (initFilters)
CAT_ORDER = ['ИИ и технологии', 'Гайды', 'Консоли', 'Аналитика', 'Тренды',
             'Разработка', 'Мнение', 'Кино и игры', 'Обзоры']

GAME_SUFFIX = re.compile(r':\s*цена, отзывы и статистика игроков\s*$', re.IGNORECASE)


def escape_html(value):
    return html.escape(str(value if value is not None else ''), quote=True)


def load_articles():
    with open(DATA_FILE, encoding='utf-8') as f:
        raw = f.read()
    match = re.search(r'window\.allArticles\s*=\s*(\[.*\])\s*;?', raw, re.DOTALL)
    if not match:
        raise SystemExit('Не удалось разобрать articles-data.js: не найден window.allArticles')
    return json.loads(match.group(1))


def is_game_review(article):
    if not article:
        return False
    if (article.get('category') or '') == 'Обзоры':
        return True
    return bool(GAME_SUFFIX.search(article.get('title') or ''))


def srcset_attr(src, is_lead):
    if not LEAD_IMAGE.search(src or ''):
        return ''
    small = LEAD_IMAGE.sub('-800.webp', src)
    sizes = ('(min-width: 900px) 1100px, 100vw' if is_lead
             else '(min-width: 1220px) 190px, (min-width: 640px) 140px, 92px')
    return f' srcset="{small} 800w, {src} 1344w" sizes="{sizes}"'


def entry_html(article, number, is_lead):
    url = escape_html(article.get('url') or '#')
    image = escape_html(article.get('image') or '')
    title = escape_html(article.get('title') or '')
    category = escape_html(article.get('category') or '')
    excerpt = escape_html(article.get('excerpt') or '')
    date = escape_html(article.get('date') or '')
    read_time = escape_html(article.get('readTime') or '')
    meta = ' · '.join([part for part in (date, read_time) if part])

    if image:
        thumb = (f'<span class="entry-thumb fx"><img src="{image}" alt="{title}" '
                 f'loading="{"eager" if is_lead else "lazy"}" '
                 f'fetchpriority="{"high" if is_lead else "auto"}" decoding="async" '
                 f'width="1344" height="768"{srcset_attr(image, is_lead)}></span>')
    else:
        thumb = '<span class="entry-thumb fx"></span>'

    top = ''
    if category:
        top += f'          <span class="entry-cat">#{category.lower()}</span>\n'
    if meta:
        top += f'          <span class="entry-meta">{meta}</span>\n'

    body = f'        <span class="entry-title">{title}</span>\n'
    if excerpt:
        body += f'        <span class="entry-excerpt">{excerpt}</span>\n'
    if is_lead:
        body += '        <span class="entry-open">открыть материал</span>\n'

    return (
        f'    <a href="{url}" class="entry{" entry--lead" if is_lead else ""}">\n'
        f'      <span class="entry-no">{number:03d}</span>\n'
        f'      {thumb}\n'
        f'      <span class="entry-main">\n'
        f'        <span class="entry-top">\n{top}        </span>\n'
        f'{body}'
        f'      </span>\n'
        f'    </a>'
    )


def inject(source, tag, inner):
    start = f'<!--ARCHIVE:{tag}:START-->'
    end = f'<!--ARCHIVE:{tag}:END-->'
    if start not in source or end not in source:
        raise SystemExit(f'Не найдены маркеры {start} / {end} в {PAGE_FILE}')
    pattern = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.DOTALL)
    return pattern.sub(lambda _: start + inner + end, source, count=1)


def generate():
    articles = load_articles()
    if not articles:
        raise SystemExit('articles-data.js пустой')

    # Значение по умолчанию: «Все» без поиска — обзоры игр не показываем.
    filtered = [a for a in articles if not is_game_review(a)]
    page_items = filtered[:PER_PAGE]
    total_pages = max(1, -(-len(filtered) // PER_PAGE))

    feed_html = '\n'.join(
        entry_html(a, i + 1, i == 0) for i, a in enumerate(page_items)
    )

    cats = sorted({a.get('category') for a in articles if a.get('category')},
                  key=lambda c: CAT_ORDER.index(c) if c in CAT_ORDER else 99)
    filters = ['    <button type="button" class="cat-pill active" data-category="all" '
               'aria-pressed="true">Все</button>']
    for cat in cats:
        safe = escape_html(cat)
        filters.append(
            f'    <button type="button" class="cat-pill" data-category="{safe}" '
            f'aria-pressed="false">{safe}</button>'
        )
    filters_html = '\n' + '\n'.join(filters) + '\n  '

    if total_pages > 1:
        pag_html = ''.join(
            f'<button class="page-btn{" active" if i == 1 else ""}" data-page="{i}">{i}</button>'
            for i in range(1, total_pages + 1)
        )
    else:
        pag_html = ''

    with open(PAGE_FILE, encoding='utf-8', newline='') as f:
        src = f.read()

    # Сохраняем исходные переводы строк, иначе git покажет diff по всему файлу
    eol = '\r\n' if '\r\n' in src else '\n'

    def with_eol(text):
        return text.replace('\n', eol)

    out = inject(src, 'LIST', with_eol('\n' + feed_html + '\n    '))
    out = inject(out, 'FILTERS', with_eol(filters_html))
    out = inject(out, 'PAG', pag_html)

    if out == src:
        print('Без изменений: archive.html уже актуален')
        return

    with open(PAGE_FILE, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print(f'Готово! Лента: {len(page_items)} из {len(filtered)}, '
          f'страниц пагинации: {total_pages}, разделов: {len(cats)}')


if __name__ == '__main__':
    generate()
