#!/usr/bin/env python3
"""
Генерация страниц-хабов категорий для One1Game.

Создаёт /category/<slug>.html по одной на каждую категорию из articles-data.js.
Хаб собирает все статьи раздела ссылками (topical authority + внутренняя перелинковка),
оформлен в шаблоне сайта (общая шапка/футер подключаются через /components.js).

Идемпотентно: файлы перезаписываются. Запуск: python scripts/gen_category_hubs.py
"""

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

DATA_FILE = Path("articles-data.js")
OUT_DIR = Path("category")
BASE = "https://one1game.org"

# Категория → slug URL
SLUGS = {
    "ИИ и технологии": "ii-i-tehnologii",
    "Аналитика": "analitika",
    "Гайды": "gajdy",
    "Консоли": "konsoli",
    "Тренды": "trendy",
    "Разработка": "razrabotka",
    "Мнение": "mnenie",
    "Кино и игры": "kino-i-igry",
    "Обзоры": "obzory",
}

MONTHS = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}

# Уникальный текст раздела. Без него хаб — просто список карточек, и Google
# такие страницы не индексирует: они дублируют сами статьи.
META = {
    "ИИ и технологии": {
        "h1": "ИИ и технологии: что реально работает в 2026",
        "desc": ("Раздел об искусственном интеллекте в играх и железе: нейросети в геймдеве, "
                 "ИИ-инструменты, видеокарты под будущие релизы. Разборы без хайпа."),
        "intro": [
            "Раздел про искусственный интеллект без хайпа: что из нейросетей уже встроено в игры, "
            "где ИИ реально экономит время разработчика и какие обещания пока остаются презентациями. "
            "Здесь же — разборы железа, потому что ИИ в играх упирается не в алгоритмы, а в видеопамять "
            "и скорость накопителя.",
            'Начните с материала <a href="/archive/ii-trendy-2026">«ИИ-тренды 2026»</a> — там пять '
            'технологий, которые забирают рутину у художников и сценаристов. Если выбираете видеокарту '
            'под будущие релизы, смотрите <a href="/archive/rtx-5090-vs-rx-9070xt-sravnenie-2026">'
            "RTX 5090 против RX 9070 XT</a>: там не только кадры в секунду, но и запас видеопамяти, "
            "который определяет, что вы сможете включить через два года. Общая картина рынка — "
            'в разборе <a href="/archive/ii-v-igrodeli-2026-polnyy-razbor">«ИИ в игровой индустрии 2026»</a>.',
        ],
    },
    "Гайды": {
        "h1": "Гайды: пошаговые решения для игр и ПК",
        "desc": ("Гайды по играм и настройке ПК: Elden Ring, STALKER 2, оптимизация Windows 11, "
                 "повышение FPS, списки игр для слабых ноутбуков. Пошагово, с таблицами."),
        "intro": [
            "Раздел собран вокруг одной задачи: чтобы после чтения игра запустилась, а проблема закрылась. "
            "Здесь нет «10 советов» ради трафика — в каждом материале конкретные шаги, таблицы и названия "
            "файлов, которые нужно править.",
            'Большая часть раздела — Elden Ring: <a href="/archive/elden-ring-gajd-dlya-novichkov-2026">'
            "старт для новичков</a>, <a href=\"/archive/elden-ring-skolko-runok-na-uroven\">руны на уровень</a>, "
            '<a href="/archive/elden-ring-peregruz-perekat">перегруз и перекат</a>, '
            '<a href="/archive/elden-ring-kuznechnye-kamni-gde-vzyat">кузнечные камни</a> и '
            '<a href="/archive/elden-ring-poise-chto-eto">poise простыми словами</a>.',
            'Отдельный блок — оптимизация: <a href="/archive/kak-uvelichit-fps-windows-11-optimizaciya">'
            "как поднять FPS в Windows 11</a>, <a href=\"/archive/skrytye-lovushki-apgreyda-2026\">"
            "скрытые ловушки апгрейда</a> и <a href=\"/archive/igry-dlya-slabyh-noutbukov-2026\">"
            "список игр, которые пойдут на слабом ноутбуке</a>.",
        ],
    },
    "Консоли": {
        "h1": "Консоли: что происходит с приставками в 2026",
        "desc": ("Консольный рынок в 2026-м: Nintendo Switch 2 в России, цены и ввоз, цифровые "
                 "библиотеки, отказ Sony от дисков и что это значит для игроков."),
        "intro": [
            "Раздел про приставки глазами российского игрока: не пресс-релизы, а цены, ввоз, "
            "региональные ограничения и судьба уже купленной библиотеки.",
            'Два больших материала: <a href="/archive/nintendo-switch-2-russia-2026">Nintendo Switch 2 '
            "в России</a> — где брать, сколько стоит и что с подпиской и регионом аккаунта; и "
            '<a href="/archive/konec-ery-diskov-sony-cifrovoe-budushee-2028">конец эры коллекционирования</a> '
            "— разбор перехода Sony на цифровые релизы и последствий для дисков, перепродажи и распродаж.",
            "Раздел небольшой: он пополняется только тогда, когда появляется событие, которое реально "
            "влияет на покупку приставки в России — новый канал ввоза, изменение цен, смена правил "
            "цифрового магазина или подписки.",
        ],
    },
    "Аналитика": {
        "h1": "Аналитика: разборы рынка игр и технологий",
        "desc": ("Аналитические разборы игровой индустрии: рынок, релизы, GTA 6, ИИ в геймдеве. "
                 "Цифры из отчётов и объяснение, почему индустрия поступает именно так."),
        "intro": [
            "Раздел для тех, кому мало новости: здесь пытаемся объяснить, почему индустрия принимает "
            "те или иные решения. Цифры берём из публичных отчётов и трейлеров, выводы — наши, "
            "и они всегда отделены от фактов.",
            'Что почитать: <a href="/archive/igrovye-trendy-avgust-2026-analiz-rynka">анализ рынка '
            "за август 2026</a> — релизы, выручка и точки роста; "
            '<a href="/archive/ii-v-gejmdeve-2026-problemy-nejrosetej">почему нейросети не спасают '
            "геймдев</a> — семь причин, о которых не пишут в рекламных кейсах; "
            '<a href="/archive/nevidimyy-razum-ii-arhitektor-igrovykh-mirov-2026">как ИИ стал '
            "архитектором игровых миров</a>; и разбор утечек "
            '<a href="/archive/gta-6-polnyy-analiz-utechek-i-treylera">GTA 6</a>.',
        ],
    },
    "Тренды": {
        "h1": "Тренды: во что играют и чем это делают",
        "desc": ("Тренды игровой индустрии 2026: игры в Telegram без установки, Mini Apps, "
                 "нейросетевые комиксы и новые форматы дистрибуции."),
        "intro": [
            "Раздел о том, что набирает обороты прямо сейчас: форматы, которые ещё не успели стать "
            "индустриальным стандартом, но уже забирают время у больших игр.",
            'Главная тема — <a href="/archive/igry-v-telegram-bez-skachivaniya-triad-duel">игры в Telegram '
            "без скачивания</a>: как устроены Mini Apps и почему в них играют чаще, чем в мобильные "
            'тайтлы с установкой. Практическая часть — <a href="/archive/top-igr-v-telegram-2026-triad-duel">'
            "топ игр в Telegram 2026</a> и разбор Triad Duel. Плюс "
            '<a href="/archive/ai-comics-2026">нейросетевые комиксы</a> — что ИИ уже умеет в иллюстрации '
            "и где пока ломается.",
        ],
    },
    "Разработка": {
        "h1": "Разработка игр: деньги, инструменты и пайплайны",
        "desc": ("Разработка игр в 2026: сколько платят Яндекс Игры, AI-геймдизайн, VR и ИИ, "
                 "почему AA-игры стали главным форматом индустрии."),
        "intro": [
            "Раздел для тех, кто делает игры, а не только играет: сколько платят платформы, как "
            "меняется пайплайн и где ИИ уже стал обязательным инструментом, а где всё ещё мешает.",
            'Начните с денег: <a href="/archive/monetizaciya-yandex-igry-2026-rukovodstvo">сколько платят '
            "в Яндекс Играх в 2026</a> — выплаты, требования и реальные цифры. Дальше — "
            '<a href="/archive/game-design-ai-2026">AI-геймдизайн</a>, '
            '<a href="/archive/vr-ai-2026">VR + AI: что работает на практике</a> и '
            '<a href="/archive/aa-games-trend-2026">AA-игры</a> — почему средний бюджет стал главным '
            "форматом индустрии.",
        ],
    },
    "Мнение": {
        "h1": "Мнение: колонки о том, куда идут игры",
        "desc": ("Авторские колонки об игровой индустрии: конец pay-to-win, честные PvP без доната, "
                 "кризис AAA и почему GTA VI не спасёт рынок."),
        "intro": [
            "Раздел с позицией. Здесь не пытаемся быть нейтральными: если механика ломает игру — "
            "так и написано. Материалы стоит читать как колонку, а не как сводку новостей.",
            'Главные тексты: <a href="/archive/konec-epohi-pay-to-win-triad-duel">конец эпохи pay-to-win</a> '
            "— почему игроки уходят в Telegram Mini Apps; "
            '<a href="/archive/chestnye-pvp-igry-bez-donata-2026">честные PvP без доната</a> — где решает '
            'скилл, а не кошелёк; и <a href="/archive/gta-vi-krizis-industrii-2026">GTA VI как симптом '
            "кризиса AAA</a>.",
        ],
    },
    "Кино и игры": {
        "h1": "Кино и игры: экранизации и фильмы про гейминг",
        "desc": ("Фильмы про видеоигры и экранизации: что посмотреть, календарь релизов 2027, "
                 "проекты, сделанные с помощью ИИ."),
        "intro": [
            "Раздел на стыке двух медиа: экранизации, документалки о разработке и кино, которое "
            "делают нейросетями. Каждый текст — с подборкой, а не одним трейлером.",
            'Что посмотреть сегодня: <a href="/archive/filmy-pro-gejming-2026">10 фильмов про видеоигры, '
            "которые вы могли пропустить</a>. Про ИИ в кино — "
            '<a href="/archive/filmy-iskusstvennogo-intellekta-2026">5 проектов, изменивших индустрию</a>. '
            'Планы на будущее — <a href="/archive/video-game-movies-2027-guide">все экранизации 2027 года</a> '
            "с датами и актёрами.",
            "Календарь экранизаций обновляется по мере выхода трейлеров и переноса дат, а подборки "
            "фильмов — когда появляется картина, о которой стоит написать отдельно, а не упомянуть в списке.",
        ],
    },
    "Обзоры": {
        "h1": "Обзоры игр: цена, отзывы и системные требования",
        "desc": ("Обзоры игр с актуальными ценами, отзывами, онлайном и минимальными требованиями: "
                 "Elden Ring, Baldur's Gate 3, Counter-Strike 2 и другие. Проверьте, потянет ли ваш ПК."),
        "intro": [
            "Обзоры строятся вокруг данных, а не пересказа пресс-релизов: цена в Steam на сегодня, "
            "доля положительных отзывов, текущий онлайн, минимальные требования и отдельный вердикт — "
            "потянет ли игра на слабом ПК.",
            'В подборке — игры, которые ищут чаще всего: <a href="/archive/elden-ring-1245620">Elden Ring</a>, '
            '<a href="/archive/cyberpunk-2077-1091500">Cyberpunk 2077</a>, '
            '<a href="/archive/baldur-s-gate-3-1086940">Baldur\'s Gate 3</a>, '
            '<a href="/archive/red-dead-redemption-2-1174180">Red Dead Redemption 2</a>.',
            'Если нужен ответ на вопрос «пойдёт ли на моём ноутбуке» — откройте таблицу '
            '<a href="/potyanet-li-igra">«Потянет ли игра на моём ПК»</a> или подборку под свою '
            "видеокарту ниже.",
        ],
        "picks": [
            ("Подборки по железу", [
                ("/potyanet-li-igra", "Потянет ли игра на моём ПК", "Таблица минимальных видеокарт и ОЗУ"),
                ("/igry-bez-videokarty", "Игры без видеокарты", "Что запустится на встроенной графике"),
                ("/igry-dlya-gtx-1060", "Игры для GTX 1060", "Список с вердиктами по кадрам"),
                ("/igry-dlya-gtx-1050", "Игры для GTX 1050", "Что реально идёт на 2 ГБ"),
                ("/igry-dlya-gtx-1650", "Игры для GTX 1650", "Новинки и старые хиты"),
                ("/igry-dlya-intel-hd-graphics-4000", "Игры для Intel HD 4000", "Только то, что запустится"),
                ("/igry-dlya-slabyh-noutbukov-4gb-ozu", "Игры для ноутбука с 4 ГБ ОЗУ", "Без лагов и подкачки"),
                ("/rpg-igry-dlya-slabyh-noutbukov", "RPG для слабых ноутбуков", "Нишевые и старые RPG"),
                ("/shuter-igry-dlya-slabyh-noutbukov", "Шутеры для слабых ПК", "Онлайн и одиночные"),
                ("/kooperativnye-igry-dlya-slabyh-pk", "Кооператив для слабых ПК", "Играть вдвоём"),
            ]),
        ],
    },
}


# Заголовки вкладки: «<Раздел> — все статьи и обзоры 2026» дублирует название
# и не отвечает на запрос. Здесь — то, что человек реально ищет.
TITLES = {
    "ИИ и технологии": "ИИ и технологии в играх: нейросети и железо 2026 | One1Game",
    "Гайды": "Гайды по играм и ПК: Elden Ring, FPS, Windows 11 | One1Game",
    "Консоли": "Консоли 2026: Switch 2 в России и цифровые библиотеки | One1Game",
    "Аналитика": "Аналитика игрового рынка: разборы и цифры 2026 | One1Game",
    "Тренды": "Тренды игровой индустрии 2026: Telegram-игры и ИИ | One1Game",
    "Разработка": "Разработка игр: доходы, AI-геймдизайн и AA-игры | One1Game",
    "Мнение": "Мнение: колонки об играх, донате и кризисе AAA | One1Game",
    "Кино и игры": "Кино и игры: экранизации и фильмы про гейминг | One1Game",
    "Обзоры": "Обзоры игр 2026: цены, отзывы и системные требования | One1Game",
}


def parse_articles(content):
    items = []
    for block in re.findall(r"\{[^{}]*\}", content, re.DOTALL):
        def g(key):
            m = re.search(r'"' + key + r'"\s*:\s*"((?:[^"\\]|\\.)*)"', block)
            return m.group(1) if m else ""
        url = g("url")
        if not url:
            continue
        # "/archive/-<appid>" закрыты noindex — ссылки на них в хабы не ставим.
        if re.fullmatch(r"/archive/-\d+", url):
            continue
        items.append({
            "url": url,
            "title": g("title"),
            "excerpt": g("excerpt"),
            "date": g("date"),
            "readTime": g("readTime"),
            "category": g("category"),
            "updated": g("updated"),
            "image": g("image"),
            "ai": bool(re.search(r'"ai"\s*:\s*true', block)),
        })
    return items


def read_minutes(value):
    m = re.search(r"\d+", value or "")
    return int(m.group()) if m else 0


def sort_key(a):
    s = a.get("updated") or ""
    if s:
        return s
    m = re.fullmatch(r"(\d{1,2})\s+([а-яё]+)\s+(\d{4})", a.get("date", ""), re.IGNORECASE)
    if m and m.group(2).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return "0000-00-00"


def esc(s):
    return html.escape(s or "", quote=True)


def indexable(url):
    """Ссылка ведёт на страницу, открытую от индекса.

    В «Обзорах» лежит 1250 шаблонных страниц игр, и большинство из них закрыто
    noindex. Хаб, который ссылается на них, Google читает как свалку — из-за
    этого и сам хаб выпадал из индекса.
    """
    if not url.startswith("/archive/"):
        return True
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    path = Path("archive") / f"{slug}.html"
    if not path.exists():
        return False
    head = path.read_text(encoding="utf-8", errors="ignore")[:4000]
    return re.search(r'name="robots"\s+content="[^"]*noindex', head) is None


FILTER_CSS = """
    .cat-filters { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; margin: 0 0 18px; padding: 12px 14px; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 12px; background: rgba(125,255,155,.03); }
    .cat-search { display: flex; align-items: center; gap: 8px; flex: 1 1 240px; min-width: 200px; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 8px; padding: 7px 10px; }
    .cat-search input { width: 100%; background: transparent; border: 0; outline: none; color: var(--text, #d7dee6); font: inherit; font-size: .9rem; }
    .cat-search i { color: var(--text-faint, #75808d); font-size: .8rem; }
    .cat-src { display: flex; gap: 6px; flex-wrap: wrap; }
    .cat-sort, .cat-year { display: flex; align-items: center; gap: 6px; color: var(--text-faint, #75808d); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }
    .cat-sort select, .cat-year select { background: var(--panel, #0a0f14); color: var(--text, #d7dee6); border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: .8rem; text-transform: none; }
    .cat-reset { background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); color: var(--text-dim, #8f99a6); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: .7rem; cursor: pointer; text-transform: uppercase; letter-spacing: .05em; }
    .cat-reset:hover { color: var(--acid, #7dff9b); border-color: var(--line-hi, rgba(125,255,155,.34)); }
    .cat-count { font-size: .74rem; color: var(--text-faint, #75808d); margin-left: auto; }
    .cat-item[hidden] { display: none; }
    .cat-empty { padding: 18px; border: 1px dashed var(--line, rgba(125,255,155,.16)); border-radius: 10px; color: var(--text-dim, #8f99a6); text-align: center; }
    .cat-empty button { margin-left: 8px; background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); color: var(--acid, #7dff9b); border-radius: 999px; padding: 5px 12px; font: inherit; font-size: .76rem; cursor: pointer; }
    @media (max-width: 600px) {
      .cat-count { margin-left: 0; width: 100%; }
      .cat-sort, .cat-year { flex: 1 1 45%; }
      .cat-sort select, .cat-year select { flex: 1; }
    }
"""


FILTER_JS = r"""
(function () {
  var list = document.querySelector('.cat-list');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.cat-item'));
  if (!items.length) return;

  var metas = items.map(function (el) {
    var strong = el.querySelector('strong');
    return {
      el: el,
      title: (strong ? strong.textContent : '').toLowerCase(),
      text: el.textContent.toLowerCase(),
      date: el.getAttribute('data-date') || '',
      read: parseInt(el.getAttribute('data-read') || '0', 10) || 0,
      ai: el.getAttribute('data-ai') === '1'
    };
  });

  var search = document.getElementById('cat-search');
  var sortSel = document.getElementById('cat-sort');
  var yearSel = document.getElementById('cat-year');
  var count = document.getElementById('cat-count');
  var empty = document.getElementById('cat-empty');
  var more = document.getElementById('cat-more');
  var PAGE = 20;
  var shown = PAGE;
  var reset = document.getElementById('cat-reset');
  var pills = Array.prototype.slice.call(document.querySelectorAll('.cat-src .cat-pill'));
  var params = new URLSearchParams(location.search);
  var src = pills.length ? (params.get('src') || 'all') : 'all';

  if (params.get('q')) search.value = params.get('q');
  if (params.get('sort')) sortSel.value = params.get('sort');
  if (params.get('year')) yearSel.value = params.get('year');

  function setSrc(value) {
    src = value;
    pills.forEach(function (b) {
      var on = b.getAttribute('data-src') === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function apply(save) {
    var q = search.value.trim().toLowerCase();
    var year = yearSel.value;
    var sort = sortSel.value;
    var visible = [];

    metas.forEach(function (m) {
      var ok = true;
      if (q && m.text.indexOf(q) === -1) ok = false;
      if (ok && year !== 'all' && m.date.slice(0, 4) !== year) ok = false;
      if (ok && src === 'human' && m.ai) ok = false;
      if (ok && src === 'ai' && !m.ai) ok = false;
      m.el.hidden = !ok;
      if (ok) visible.push(m);
    });

    visible.sort(function (a, b) {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ru');
      if (sort === 'read') return a.read - b.read;
      var d = a.date.localeCompare(b.date);
      return sort === 'old' ? d : -d;
    });
    visible.forEach(function (m) { list.appendChild(m.el); });

    var limit = Math.min(shown, visible.length);
    visible.forEach(function (m, i) { m.el.hidden = i >= limit; });

    count.textContent = 'Показано ' + limit + ' из ' + visible.length;
    empty.hidden = visible.length !== 0;
    more.hidden = visible.length <= limit;
    more.textContent = 'Показать ещё ' + Math.min(PAGE, Math.max(visible.length - limit, 0));

    if (save !== false) {
      var p = new URLSearchParams();
      if (q) p.set('q', q);
      if (src !== 'all') p.set('src', src);
      if (sort !== 'new') p.set('sort', sort);
      if (year !== 'all') p.set('year', year);
      var qs = p.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }
  }

  setSrc(src);
  search.addEventListener('input', function () { shown = PAGE; apply(); });
  sortSel.addEventListener('change', function () { shown = PAGE; apply(); });
  yearSel.addEventListener('change', function () { shown = PAGE; apply(); });
  pills.forEach(function (b) {
    b.addEventListener('click', function () { setSrc(b.getAttribute('data-src')); shown = PAGE; apply(); });
  });
  more.addEventListener('click', function () { shown += PAGE; apply(false); });
  reset.addEventListener('click', function () {
    search.value = '';
    setSrc('all');
    sortSel.value = 'new';
    yearSel.value = 'all';
    shown = PAGE;
    apply();
    search.focus();
  });
  empty.querySelector('button').addEventListener('click', function () { reset.click(); });

  list.classList.remove('is-collapsed');
  apply(false);
})();
"""


def build_hub(category, slug, items):
    items = sorted(items, key=sort_key, reverse=True)
    url = f"{BASE}/category/{slug}"
    meta = META.get(category, {})
    h1 = meta.get("h1") or f"{category}: все статьи"
    title = meta.get("title") or TITLES.get(category) or f"{category} — все статьи | One1Game"
    human_count = sum(1 for it in items if not it["ai"])
    desc = meta.get("desc") or (
        f"Все материалы раздела «{category}»: {len(items)} статей и обзоров "
        "с датами и краткими описаниями."
    )

    # dateModified — дата последнего материала, а не «сегодня»: иначе поиск
    # видит ежедневные изменения там, где их нет, и перестаёт им верить.
    dates = [sort_key(it) for it in items if sort_key(it) != "0000-00-00"]
    modified = max(dates) if dates else datetime.utcnow().strftime("%Y-%m-%d")

    intro_inner = "".join(f"      <p>{p}</p>\n" for p in meta.get("intro", []))
    intro_html = f'    <div class="cat-intro">\n{intro_inner}    </div>\n' if intro_inner else ""

    if slug == "obzory":
        lead = (f"В подборке {len(items)} игр: актуальная цена в Steam, отзывы, онлайн и "
                "минимальные требования. Полный каталог игр — в архиве.")
    else:
        lead = (f"В разделе {len(items)} материалов, из них {human_count} авторских. "
                "По умолчанию — от новых к старым.")

    grid_title = "Все обзоры" if slug == "obzory" else "Все материалы раздела"

    picks_html = ""
    for block_title, links in meta.get("picks", []):
        lis = "\n".join(
            f'        <li><a href="{esc(u)}">{esc(t)}</a><span>{esc(d)}</span></li>'
            for u, t, d in links
        )
        picks_html += (
            '    <section class="cat-picks">\n'
            f'      <h2 class="cat-h2">{esc(block_title)}</h2>\n'
            f"      <ul>\n{lis}\n      </ul>\n"
            "    </section>\n"
        )

    others = "\n".join(
        f'        <a href="/category/{s}">{esc(c)}</a>'
        for c, s in SLUGS.items() if s != slug
    )
    other_html = (
        '    <section class="cat-other-wrap">\n'
        '      <h2 class="cat-h2">Другие разделы</h2>\n'
        '      <nav class="cat-other" aria-label="Другие разделы">\n'
        '        <a href="/archive">Все статьи архива</a>\n'
        f"{others}\n"
        "      </nav>\n"
        "    </section>\n"
    )

    years = sorted({sort_key(it)[:4] for it in items if sort_key(it) != "0000-00-00"}, reverse=True)
    year_options = '      <option value="all">Все годы</option>\n' + "\n".join(
        f'      <option value="{y}">{y}</option>' for y in years
    )

    ai_count = len(items) - human_count
    src_filter = ""
    if human_count and ai_count:
        src_filter = (
            '      <div class="cat-src" role="group" aria-label="Тип материалов">\n'
            '        <button type="button" class="cat-pill active" data-src="all" aria-pressed="true">Все</button>\n'
            '        <button type="button" class="cat-pill" data-src="human" aria-pressed="false">Авторские</button>\n'
            '        <button type="button" class="cat-pill" data-src="ai" aria-pressed="false">ИИ-обзоры</button>\n'
            '      </div>\n'
        )

    rows = "\n".join(
        f'        <a class="cat-item" href="{esc(it["url"])}"'
        f' data-date="{sort_key(it)}"'
        f' data-read="{read_minutes(it["readTime"])}"'
        f' data-ai="{1 if it["ai"] else 0}">'
        f'<span class="cat-thumb">'
        f'<img src="{esc(it["image"])}" alt="" loading="lazy" width="460" height="215" decoding="async">'
        f'</span>'
        f'<span class="cat-body">'
        f'<strong>{esc(it["title"])}</strong>'
        f'<span class="cat-excerpt">{esc(it["excerpt"])}</span>'
        f'<em>{esc(it["date"])}{(" · " + esc(it["readTime"])) if it["readTime"] else ""}</em>'
        f'</span>'
        f"</a>"
        for it in items
    )

    item_list = {
        "@type": "ItemList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f'{BASE}{it["url"]}', "name": it["title"]}
            for i, it in enumerate(items[:50])
        ],
    }
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{BASE}/"},
                    {"@type": "ListItem", "position": 2, "name": "Статьи", "item": f"{BASE}/archive"},
                    {"@type": "ListItem", "position": 3, "name": category, "item": url},
                ],
            },
            {
                "@type": "CollectionPage",
                "name": title,
                "url": url,
                "description": desc,
                "inLanguage": "ru-RU",
                "dateModified": modified,
                "isPartOf": {"@id": f"{BASE}/#website"},
                "mainEntity": item_list,
            },
        ],
    }

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<script>if(location.hostname==='one1game.github.io'){{location.replace('https://one1game.org'+location.pathname+location.search+location.hash);}}</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="canonical" href="{url}" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(desc)}" />
  <meta property="og:url" content="{url}" />
  <script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
  </script>
  <link rel="manifest" href="/manifest.json" />
  <link rel="preload" as="style" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" onload="this.rel='stylesheet';this.removeAttribute('onload')" /><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" /></noscript>
  <link rel="stylesheet" href="/styles.css?v=46" />
  <style>
    .cat-page {{ padding: 26px 0 40px; }}
    .cat-title {{ font-size: clamp(1.5rem, 3vw, 2.1rem); margin: 8px 0 6px; }}
    .cat-lead {{ color: var(--text-dim, #8f99a6); margin-bottom: 18px; }}
    .cat-intro {{ max-width: 82ch; margin: 0 0 24px; color: var(--text-dim, #8f99a6); font-size: .95rem; line-height: 1.62; }}
    .cat-intro p {{ margin: 0 0 10px; }}
    .cat-intro a {{ color: var(--acid, #7dff9b); text-decoration: underline; text-decoration-color: rgba(125,255,155,.35); text-underline-offset: 3px; }}
    .cat-h2 {{ font-size: clamp(1.1rem, 2vw, 1.4rem); margin: 28px 0 14px; }}
    .cat-picks {{ margin: 30px 0 0; }}
    .cat-picks ul {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; list-style: none; padding: 0; margin: 0; }}
    .cat-picks a {{ color: var(--text, #d7dee6); text-decoration: none; border-bottom: 1px dashed rgba(125,255,155,.25); }}
    .cat-picks a:hover {{ color: var(--acid, #7dff9b); }}
    .cat-picks span {{ display: block; margin-top: 2px; color: var(--text-faint, #75808d); font-size: .8rem; }}
    .cat-other-wrap {{ margin: 32px 0 0; padding-top: 6px; border-top: 1px solid var(--line, rgba(125,255,155,.16)); }}
    .cat-other {{ display: flex; flex-wrap: wrap; gap: 8px 10px; }}
    .cat-other a {{ border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 999px; padding: 6px 12px; font-size: .8rem; color: var(--text-dim, #8f99a6); text-decoration: none; }}
    .cat-other a:hover {{ color: var(--acid, #7dff9b); border-color: var(--line-hi, rgba(125,255,155,.34)); }}
    .cat-list {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }}
    .cat-item {{ display: flex; flex-direction: column; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 12px; overflow: hidden; text-decoration: none; color: var(--text, #d7dee6); background: rgba(255,255,255,.02); transition: border-color .15s, transform .15s; }}
    .cat-item:hover {{ border-color: var(--line-hi, rgba(125,255,155,.34)); transform: translateY(-2px); }}
    .cat-item[hidden] {{ display: none; }}
    .cat-list.is-collapsed .cat-item:nth-child(n+21) {{ display: none; }}
    .cat-thumb {{ display: block; aspect-ratio: 460 / 215; overflow: hidden; background: #0a0f14; }}
    .cat-thumb img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    .cat-body {{ display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; flex: 1; }}
    .cat-item strong {{ display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: .95rem; line-height: 1.35; }}
    .cat-excerpt {{ display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-dim, #8f99a6); font-size: .8rem; line-height: 1.45; margin: 0; }}
    .cat-item em {{ margin-top: auto; padding-top: 4px; color: var(--text-faint, #75808d); font-size: .72rem; font-style: normal; text-transform: uppercase; letter-spacing: .05em; }}
    .cat-more {{ display: block; margin: 18px auto 0; padding: 10px 22px; background: transparent; border: 1px solid var(--line, rgba(125,255,155,.16)); border-radius: 999px; color: var(--acid, #7dff9b); font: inherit; font-size: .8rem; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; }}
    .cat-more:hover {{ border-color: var(--line-hi, rgba(125,255,155,.34)); }}
    .cat-more[hidden] {{ display: none; }}
    @media (max-width: 1100px) {{ .cat-list {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }} }}
    @media (max-width: 820px) {{ .cat-list {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
    @media (max-width: 560px) {{ .cat-list {{ grid-template-columns: 1fr; }} }}
{FILTER_CSS}
  </style>
</head>
<body>
<main id="main-content">
  <div class="container cat-page">
    <a href="/archive" class="article-back"><i class="fas fa-arrow-left" aria-hidden="true"></i> К списку статей</a>
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <a href="/">One1Game</a> → <a href="/archive">Статьи</a> → <span>{esc(category)}</span>
    </nav>
    <h1 class="cat-title">{esc(h1)}</h1>
    <p class="cat-lead">{esc(lead)}</p>
{intro_html}    <div class="cat-filters">
      <label class="cat-search">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input type="search" id="cat-search" placeholder="Поиск по разделу…" aria-label="Поиск по статьям раздела" autocomplete="off">
      </label>
{src_filter}
      <label class="cat-sort">Сортировка
        <select id="cat-sort">
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="title">По названию</option>
          <option value="read">По времени чтения</option>
        </select>
      </label>
      <label class="cat-year">Год
        <select id="cat-year">
{year_options}
        </select>
      </label>
      <button type="button" class="cat-reset" id="cat-reset">Сбросить</button>
      <span class="cat-count" id="cat-count" aria-live="polite"></span>
    </div>
    <h2 class="cat-h2">{esc(grid_title)}</h2>
    <div class="cat-list is-collapsed">
{rows}
    </div>
    <div class="cat-empty" id="cat-empty" hidden>Ничего не найдено. <button type="button">Сбросить фильтр</button></div>
    <button type="button" class="cat-more" id="cat-more" hidden>Показать ещё</button>
{picks_html}{other_html}  </div>
</main>
<script src="/cache-version.js"></script>
<script>{FILTER_JS}</script>
<script src="/components.js?v=41" defer></script>
</body>
</html>
"""


def main():
    content = DATA_FILE.read_text(encoding="utf-8")
    items = parse_articles(content)
    by_cat = {}
    for it in items:
        if not indexable(it["url"]):
            continue
        by_cat.setdefault(it["category"], []).append(it)

    to_stdout = "--stdout" in sys.argv

    OUT_DIR.mkdir(exist_ok=True)
    made = 0
    for cat, slug in SLUGS.items():
        arts = by_cat.get(cat, [])
        if not arts:
            print(f"  пропуск (нет статей): {cat}", file=sys.stderr)
            continue
        page = build_hub(cat, slug, arts)
        if to_stdout:
            print(f"===FILE:{slug}===")
            print(page)
        else:
            target = OUT_DIR / f"{slug}.html"
            prev = target.read_text(encoding="utf-8") if target.exists() else None
            # Пишем только при реальном изменении, иначе дата файла врёт.
            if prev != page:
                target.write_text(page, encoding="utf-8")
            print(f"  OK {slug}.html — {len(arts)} статей{'' if prev != page else ' (без изменений)'}")
        made += 1
    if not to_stdout:
        print(f"Готово: {made} хабов")


if __name__ == "__main__":
    main()
