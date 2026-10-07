"""Предрендер главной страницы.

Боты, которые не исполняют JS, должны видеть контент, а не скелетоны.
Скрипт берёт данные из articles-data.js и вставляет готовый HTML в index.html
между маркерами <!--HOME:*:START--> / <!--HOME:*:END-->.

Запуск: python generate-home.py
"""
import html
import json
import re

DATA_FILE = 'articles-data.js'
HOME_FILE = 'index.html'
FEED_LIMIT = 6      # сколько записей в ленте (1 ведущая + 5)
PLAY_LIMIT = 14     # сколько игровых обзоров показываем на главной

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
    if not re.search(r'\.webp$', src or '', re.IGNORECASE):
        return ''
    small = re.sub(r'\.webp$', '-800.webp', src, flags=re.IGNORECASE)
    sizes = ('(min-width: 900px) 1100px, 100vw' if is_lead
             else '(min-width: 1220px) 190px, (min-width: 640px) 140px, 92px')
    return f' srcset="{small} 800w, {src} 1344w" sizes="{sizes}"'


def entry_html(article, index, is_lead):
    url = escape_html(article.get('url') or '#')
    image = article.get('image') or ''
    safe_image = escape_html(image)
    title = escape_html(article.get('title') or '')
    category = escape_html(article.get('category') or '')
    excerpt = escape_html(article.get('excerpt') or '')
    date = escape_html(article.get('date') or '')
    read_time = escape_html(article.get('readTime') or '')
    meta = ' · '.join([part for part in (date, read_time) if part])

    if safe_image:
        loading = 'eager' if is_lead else 'lazy'
        priority = 'high' if is_lead else 'auto'
        thumb = (f'<span class="entry-thumb fx"><img src="{safe_image}" alt="{title}" '
                 f'loading="{loading}" fetchpriority="{priority}" decoding="async" '
                 f'width="1344" height="768"{srcset_attr(safe_image, is_lead)}></span>')
    else:
        thumb = '<span class="entry-thumb fx"></span>'

    top = ''
    if category:
        top += f'            <span class="entry-cat">#{category.lower()}</span>\n'
    if meta:
        top += f'            <span class="entry-meta">{meta}</span>\n'

    body = f'          <span class="entry-title">{title}</span>\n'
    if excerpt:
        body += f'          <span class="entry-excerpt">{excerpt}</span>\n'
    if is_lead:
        body += '          <span class="entry-open">открыть материал</span>\n'

    return (
        f'      <a href="{url}" class="entry{" entry--lead" if is_lead else ""}">\n'
        f'        <span class="entry-no">{index:03d}</span>\n'
        f'        {thumb}\n'
        f'        <span class="entry-main">\n'
        f'          <span class="entry-top">\n{top}          </span>\n'
        f'{body}'
        f'        </span>\n'
        f'      </a>'
    )


AD_BLOCK = (
    '      <div class="ad-vps-wrap">\n'
    '        <a href="https://my.adminvps.ru/aff.php?aff=31864" target="_blank" rel="noopener noreferrer" class="ad-vps-card">\n'
    '          <div class="ad-vps-header">\n'
    '            <span class="ad-vps-badge">выгодно</span>\n'
    '            <h3 class="ad-vps-title">VPS/VDS от 299 ₽/мес</h3>\n'
    '          </div>\n'
    '          <p class="ad-vps-desc">NVMe-диски, CPU до 5.0 ГГц, бесплатное администрирование. Для сайтов, ботов, Docker и AI.</p>\n'
    '          <div class="ad-vps-tags">\n'
    '            <span class="ad-vps-tag">NVMe</span>\n'
    '            <span class="ad-vps-tag">24/7</span>\n'
    '            <span class="ad-vps-tag">Мир</span>\n'
    '          </div>\n'
    '          <span class="ad-vps-cta">Попробовать AdminVPS</span>\n'
    '        </a>\n'
    '      </div>'
)


def play_card_html(game):
    url = escape_html(game.get('url') or '#')
    safe_image = escape_html(game.get('image') or '')
    raw_name = GAME_SUFFIX.sub('', game.get('title') or '').strip() or (game.get('title') or 'Игра')
    name = escape_html(raw_name)
    thumb = ''
    if safe_image:
        thumb = (f'\n          <span class="play-thumb fx"><img src="{safe_image}" alt="{name}" '
                 f'loading="lazy" decoding="async" width="280" height="158"></span>')
    return (
        f'        <a href="{url}" class="play-card">{thumb}\n'
        f'          <span class="play-name">{name}</span>\n'
        f'          <span class="play-meta">обзор · статистика игроков</span>\n'
        f'        </a>'
    )


def inject(html_src, tag, payload):
    start = f'<!--HOME:{tag}:START-->'
    end = f'<!--HOME:{tag}:END-->'
    pattern = re.compile(r'(' + re.escape(start) + r')(.*?)(\r?\n[ \t]*)(' + re.escape(end) + r')', re.DOTALL)
    if not pattern.search(html_src):
        raise SystemExit(f'Не найдены маркеры HOME:{tag} в {HOME_FILE}')
    sep = '\r\n' if '\r\n' in payload else '\n'

    def repl(match):
        return f'{start}{sep}{payload}{match.group(3)}{end}'

    return pattern.sub(repl, html_src, count=1)


def toggle_play_section(html_src, has_games):
    pattern = re.compile(r'(<section class="play-rail" id="play-what"[^>]*?)(\s+hidden)?>')

    def repl(match):
        base = re.sub(r'\s+hidden$', '', match.group(1))
        return base + ('' if has_games else ' hidden') + '>'

    if not pattern.search(html_src):
        raise SystemExit(f'Не найден блок #play-what в {HOME_FILE}')
    return pattern.sub(repl, html_src, count=1)


def set_stat(html_src, element_id, value):
    pattern = re.compile(r'(<b id="' + element_id + r'">)[^<]*(</b>)')
    if not pattern.search(html_src):
        raise SystemExit(f'Не найден счётчик #{element_id} в {HOME_FILE}')
    return pattern.sub(lambda m: f'{m.group(1)}{value}{m.group(2)}', html_src, count=1)


def generate():
    articles = load_articles()
    if not articles:
        raise SystemExit('articles-data.js пустой')

    feed = [a for a in articles if not is_game_review(a)][:FEED_LIMIT]
    if not feed:
        raise SystemExit('Не нашлось ни одной обычной статьи для ленты')

    games = [a for a in articles if is_game_review(a)]
    sections = len({(a.get('category') or '') for a in articles if a.get('category')})

    lead_html = entry_html(feed[0], 1, True)

    rest = feed[1:]
    head = '\n'.join(entry_html(a, i + 2, False) for i, a in enumerate(rest[:2]))
    tail = '\n'.join(entry_html(a, i + 4, False) for i, a in enumerate(rest[2:]))
    feed_parts = [part for part in (head, AD_BLOCK, tail) if part]
    feed_html = '\n'.join(feed_parts)

    shown_games = games[:PLAY_LIMIT]
    play_parts = [play_card_html(g) for g in shown_games]
    if len(games) > PLAY_LIMIT:
        more_url = 'archive.html?category=' + '%D0%9E%D0%B1%D0%B7%D0%BE%D1%80%D1%8B'
        play_parts.append(
            f'        <a href="{more_url}" class="play-card play-card--more">\n'
            f'          <span class="play-name">ещё {len(games) - PLAY_LIMIT}</span>\n'
            f'          <span class="play-meta">смотреть все игры</span>\n'
            f'        </a>'
        )
    play_html = '\n'.join(play_parts)

    with open(HOME_FILE, encoding='utf-8', newline='') as f:
        src = f.read()

    # Сохраняем исходные переводы строк, иначе git покажет diff по всему файлу
    eol = '\r\n' if '\r\n' in src else '\n'

    def with_eol(text):
        return text.replace('\n', eol)

    out = inject(src, 'TOP', with_eol(lead_html))
    out = inject(out, 'FEED', with_eol(feed_html))
    out = inject(out, 'PLAY', with_eol(play_html))
    out = toggle_play_section(out, bool(shown_games))
    out = set_stat(out, 'stat-articles', len(articles))
    out = set_stat(out, 'stat-sections', sections)

    if out == src:
        print('Без изменений: главная уже актуальна')
        return

    with open(HOME_FILE, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print(f'Готово! Лента: {len(feed)}, игры: {len(shown_games)} из {len(games)}, '
          f'материалов: {len(articles)}, разделов: {sections}')


if __name__ == '__main__':
    generate()
