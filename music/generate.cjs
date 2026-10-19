#!/usr/bin/env node
'use strict';

/**
 * Генератор музыкального раздела One1Game.
 * Источник: официальный API Audius (app_name=One1Game).
 * Аудио не скачивается: карточки ведут в плеер на сайте.
 *
 * Запуск: node music/generate.cjs
 */

const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const ORIGIN = 'https://one1game.org';
const API = 'https://api.audius.co/v1';
const APP = 'One1Game';
const TODAY = new Date().toISOString().slice(0, 10);
const DATE_RU = TODAY.split('-').reverse().join('.');
const TRACK_LIMIT = 48;

const FALLBACK_ART = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#1a2433"/><stop offset="1" stop-color="#0a0f16"/></linearGradient></defs>' +
  '<rect width="480" height="480" fill="url(#g)"/>' +
  '<path d="M200 330V190l120-28v140a44 44 0 1 1-24-39V188l-72 17v125a44 44 0 1 1-24-39z" fill="#7dff9b" opacity=".7"/>' +
  '</svg>'
);

/* ── Страницы ─────────────────────────────────────────────── */

const PAGES = [
  {
    slug: 'lofi',
    key: 'lofi',
    kind: 'genre',
    genre: 'Lo-Fi',
    time: 'week',
    eyebrow: 'Lo-Fi · подборка',
    title: 'Lo-Fi музыка слушать онлайн — чилл и учёба | One1Game',
    description: 'Lo-Fi онлайн без регистрации: спокойные биты, чиллхоп и инструментал для учёбы, работы и сна. Плеер прямо на сайте, бесплатно.',
    keywords: 'lo-fi музыка, lofi слушать онлайн, чиллхоп, музыка для учебы, lofi beats, спокойная музыка онлайн',
    h1: 'Lo-Fi музыка <em>онлайн</em>',
    lead: 'Мягкие биты, виниловый треск и никаких резких переходов. Lo-Fi помогает сосредоточиться и не отвлекает от работы.',
    label: 'Лучшее в Lo-Fi',
    hint: 'Спокойные биты недели. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Lo-Fi — это не столько жанр, сколько способ звучания: приглушённые высокие частоты, шум винила, сэмплы и размеренный ритм. Такая музыка не перетягивает внимание и хорошо работает фоном.',
      'В подборке — треки из открытого каталога: чиллхоп, инструментальный хип-хоп и лёгкая электроника. Всё играет в браузере, без регистрации и переходов на другие сервисы.'
    ],
    seoHeading: 'Lo-Fi музыка онлайн',
    seoText: [
      'Lo-Fi выбирают для учёбы, программирования, чтения и спокойной работы. Ровный ритм и мягкий тембр не создают звуковых пиков, поэтому мозгу проще удерживать концентрацию.',
      'Если нужен совсем тихий фон, начните с треков без вокала. Если хочется разнообразия — переключайтесь между чиллхопом и эмбиентом: оба жанра есть в соседних подборках.'
    ],
    faq: [
      ['Что такое Lo-Fi музыка?', 'Это музыка с приглушённым, тёплым звучанием: шум винила, мягкие высокие частоты и размеренный ритм. Часто используется как фон для учёбы и работы.'],
      ['Можно ли слушать Lo-Fi без регистрации?', 'Да, плеер запускается сразу. Аккаунт и подписка не нужны.'],
      ['Подходит ли Lo-Fi для учёбы?', 'Да. Ровный ритм и отсутствие резких динамических перепадов помогают удерживать концентрацию.'],
      ['Можно ли оставить музыку в фоне?', 'Да, воспроизведение продолжается при переключении вкладки. На телефоне доступны кнопки в шторке уведомлений.']
    ],
    related: ['study', 'chill', 'gaming', 'electronic']
  },
  {
    slug: 'electronic',
    key: 'electronic',
    kind: 'genre',
    genre: 'Electronic',
    time: 'week',
    eyebrow: 'Electronic · подборка',
    title: 'Электронная музыка слушать онлайн бесплатно | One1Game',
    description: 'Электроника онлайн: house, techno, synthwave и энергичные биты для игр, стримов и тренировок. Плеер без регистрации на сайте.',
    keywords: 'электронная музыка, electronic music, слушать электронику, house онлайн, techno, synthwave',
    h1: 'Электронная музыка <em>онлайн</em>',
    lead: 'Синтезаторы, плотный бас и ритм, который держит темп. Электроника для игр, стримов, тренировок и ночных поездок.',
    label: 'Лучшее в Electronic',
    hint: 'Электроника недели. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Электронная музыка объединяет десятки направлений: от мягкого synthwave до жёсткого techno. Общее у них — синтетические тембры, ритмичная основа и акцент на груве.',
      'Подборка собрана из треков открытого каталога. Слушайте в фоне, собирайте очередь и переключайте настроение без регистрации и установки приложений.'
    ],
    seoHeading: 'Электронная музыка онлайн',
    seoText: [
      'Для игр и стримов лучше подходит ритмичная электроника без длинных вступлений. Для работы — более спокойные synthwave и downtempo-треки.',
      'Если вы ищете конкретное направление, попробуйте поиск по названию жанра: house, techno, trance, drum & bass или ambient. Поиск работает по всему каталогу.'
    ],
    faq: [
      ['Какие направления электроники есть в подборке?', 'В каталоге встречаются house, techno, synthwave, drum & bass, downtempo и экспериментальная электроника. Состав зависит от загрузок артистов.'],
      ['Можно ли слушать электронику без регистрации?', 'Да. Плеер работает сразу и не требует аккаунта.'],
      ['Подойдёт ли электроника для стрима?', 'Для фонового сопровождения — да. Если стрим монетизируется, проверьте условия использования трека у автора.'],
      ['Почему некоторые треки пропускаются?', 'Артист мог закрыть стриминг или удалить запись. Плеер автоматически пропускает недоступные треки.']
    ],
    related: ['gaming', 'workout', 'lofi', 'chill']
  },
  {
    slug: 'hip-hop',
    key: 'hip-hop',
    kind: 'genre',
    genre: 'Hip-Hop/Rap',
    time: 'week',
    eyebrow: 'Hip-Hop · подборка',
    title: 'Хип-хоп слушать онлайн бесплатно — биты и рэп | One1Game',
    description: 'Хип-хоп онлайн без регистрации: рэп, инструментальные биты и чиллхоп из открытого каталога. Плеер прямо на сайте, бесплатно.',
    keywords: 'хип-хоп слушать, рэп онлайн, hip hop, инструментальный хип хоп, биты, чиллхоп',
    h1: 'Хип-хоп <em>онлайн</em>',
    lead: 'Биты, читка и грув. От андерграунда до чиллхопа — подборка, для которой не нужна подписка.',
    label: 'Лучшее в Hip-Hop',
    hint: 'Хип-хоп недели. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Хип-хоп здесь — это не только мейнстрим: много независимых артистов, инструментальных битов и экспериментальных релизов.',
      'В подборке есть треки с вокалом и инструментал. Для работы и учёбы чаще выбирают биты без слов, для тренировок — треки с плотным ритмом.'
    ],
    seoHeading: 'Хип-хоп и рэп онлайн',
    seoText: [
      'Инструментальный хип-хоп удобно использовать как фон: он не конкурирует с голосом диктора или созвоном. Треки с читкой лучше слушать отдельно.',
      'Если нужен чиллхоп, откройте подборку Lo-Fi. Если нужен более энергичный темп — подборку для тренировок.'
    ],
    faq: [
      ['Есть ли инструментальный хип-хоп?', 'Да, в каталоге много битов и инструментальных релизов. Ищите по словам instrumental, beat или chillhop.'],
      ['Можно ли слушать рэп без регистрации?', 'Да. Плеер доступен сразу, аккаунт не требуется.'],
      ['Чем чиллхоп отличается от хип-хопа?', 'Чиллхоп — более спокойное ответвление с мягкими сэмплами и размеренным ритмом.'],
      ['Почему трек может не играть?', 'Автор мог ограничить стриминг или удалить запись. Плеер пропускает недоступные треки автоматически.']
    ],
    related: ['workout', 'lofi', 'electronic', 'chill']
  },
  {
    slug: 'rock',
    key: 'rock',
    kind: 'genre',
    genre: 'Rock',
    time: 'week',
    eyebrow: 'Rock · подборка',
    title: 'Рок музыка слушать онлайн бесплатно | One1Game',
    description: 'Рок онлайн: гитары, драйв и новые независимые группы из открытого каталога. Слушайте без регистрации прямо на сайте.',
    keywords: 'рок музыка, слушать рок, rock online, независимые группы, гитарная музыка',
    h1: 'Рок музыка <em>онлайн</em>',
    lead: 'Гитары, живые барабаны и честный звук. Независимые группы и классические жанровые ответвления.',
    label: 'Лучшее в Rock',
    hint: 'Рок недели. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Рок здесь — это независимые группы, сольные проекты и записи, которые не попали в крупные каталоги. Встречаются панк, гараж, альтернатива и классический гитарный звук.',
      'Слушайте прямо на сайте: плеер не уводит на сторонние сервисы, а очередь и избранное сохраняются в браузере.'
    ],
    seoHeading: 'Рок музыка онлайн',
    seoText: [
      'Для фона лучше подходят инструментальные и пост-рок-треки. Для энергичной работы — панк и гараж с короткими композициями.',
      'Если нравится конкретный исполнитель, откройте его имя на карточке: внутри сайта покажется профиль и другие треки автора.'
    ],
    faq: [
      ['Какие направления рока есть в подборке?', 'В каталоге встречаются альтернатива, панк, гараж, инди и пост-рок. Состав зависит от загрузок артистов.'],
      ['Можно ли слушать рок без регистрации?', 'Да. Плеер работает сразу и не требует аккаунта.'],
      ['Есть ли живые записи?', 'Иногда артисты публикуют концертные версии. Ищите в названии слова live, session или concert.'],
      ['Можно ли использовать треки в видео?', 'Права определяет автор. Для публикации проверьте условия на странице трека.']
    ],
    related: ['electronic', 'hip-hop', 'chill', 'workout']
  },
  {
    slug: 'chill',
    key: 'chill',
    kind: 'genre',
    genre: 'Ambient',
    time: 'week',
    eyebrow: 'Chill · подборка',
    title: 'Chill и эмбиент музыка слушать онлайн | One1Game',
    description: 'Chill и эмбиент онлайн: спокойная музыка для отдыха, работы и сна. Без регистрации, плеер прямо на сайте.',
    keywords: 'chill музыка, эмбиент, ambient online, спокойная музыка, музыка для сна, музыка для работы',
    h1: 'Chill и <em>эмбиент</em>',
    lead: 'Медленные текстуры, воздух и тишина между звуками. Для отдыха, чтения и работы без спешки.',
    label: 'Лучшее в Ambient',
    hint: 'Эмбиент и чилл недели. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Эмбиент строится на текстурах и медленном развитии. Здесь нет резких переходов и навязчивых мелодий, поэтому музыка хорошо подходит для глубокой работы и отдыха.',
      'В подборке — записи из открытого каталога: от классического эмбиента до дроуна и лёгкого чилла. Всё воспроизводится на сайте.'
    ],
    seoHeading: 'Chill и эмбиент онлайн',
    seoText: [
      'Если вы работаете с текстом или кодом, выбирайте треки без вокала и ударных. Если нужно расслабиться перед сном — более тихие и медленные композиции.',
      'Для учёбы также подойдёт Lo-Fi, для игр — электроника. Ссылки на эти подборки есть ниже.'
    ],
    faq: [
      ['Чем эмбиент отличается от чилла?', 'Эмбиент чаще строится на текстурах и не имеет выраженного ритма. Чилл может включать биты и более привычную мелодику.'],
      ['Можно ли слушать эмбиент перед сном?', 'Да, если громкость комфортная. Плеер продолжает работу при переключении вкладки, но не стоит оставлять звук на всю ночь.'],
      ['Нужна ли регистрация?', 'Нет. Музыка играет сразу после открытия страницы.'],
      ['Есть ли треки без вокала?', 'Да, в эмбиенте и чилле много инструментальных записей. Ищите слова instrumental или no vocals.']
    ],
    related: ['lofi', 'study', 'electronic', 'gaming']
  },
  {
    slug: 'study',
    key: 'study',
    kind: 'genre',
    genre: 'Lo-Fi',
    time: 'month',
    eyebrow: 'Фокус · подборка',
    title: 'Музыка для учёбы слушать онлайн бесплатно | One1Game',
    description: 'Музыка для учёбы и концентрации: Lo-Fi и инструментал без слов. Слушайте онлайн без регистрации, плеер на сайте.',
    keywords: 'музыка для учебы, музыка для концентрации, музыка для работы, lo-fi для учебы, фоновая музыка',
    h1: 'Музыка для <em>учёбы</em>',
    lead: 'Фон, который не мешает думать: Lo-Fi, инструментал и спокойные биты без вокала.',
    label: 'Лучшее для учёбы',
    hint: 'Подборка месяца: спокойные треки для концентрации. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Музыка для учёбы должна быть предсказуемой: без резких смен темпа и громких вокалов. Lo-Fi и инструментальный эмбиент подходят лучше всего.',
      'Эта подборка собрана из треков каталога за месяц. Включите её фоном и оставьте вкладку открытой: плеер продолжит играть.'
    ],
    seoHeading: 'Музыка для учёбы и концентрации',
    seoText: [
      'Начните с треков без слов. Если голос не мешает, можно перейти к чиллхопу. Главное — не менять треки каждые полминуты: однообразный фон помогает удерживать внимание.',
      'Для перерывов используйте более энергичные подборки: электронику или хип-хоп. Для вечерней работы — эмбиент и chill.'
    ],
    faq: [
      ['Какая музыка лучше всего подходит для учёбы?', 'Инструментальная и предсказуемая: Lo-Fi, эмбиент, лёгкий чиллхоп. Вокал и резкие перепады громкости чаще отвлекают.'],
      ['Можно ли слушать музыку в наушниках?', 'Да, на комфортной громкости. Если нужно запоминать текст, попробуйте треки без слов.'],
      ['Сохраняется ли очередь?', 'Очередь и избранное хранятся в браузере. При закрытии вкладки воспроизведение останавливается.'],
      ['Нужна ли регистрация?', 'Нет. Плеер работает без аккаунта и подписки.']
    ],
    related: ['lofi', 'chill', 'gaming', 'electronic']
  },
  {
    slug: 'gaming',
    key: 'gaming',
    kind: 'genre',
    genre: 'Electronic',
    time: 'month',
    eyebrow: 'Gaming · подборка',
    title: 'Музыка для игр и стримов слушать онлайн | One1Game',
    description: 'Музыка для игр и стримов: электроника, биты и энергичный фон. Слушайте онлайн без регистрации прямо на сайте.',
    keywords: 'музыка для игр, музыка для стрима, игровой фон, electronic gaming, музыка для монтажа',
    h1: 'Музыка для <em>игр</em>',
    lead: 'Энергичный фон для катки, стрима или монтажа. Без регистрации и лишних вкладок.',
    label: 'Лучшее для игр',
    hint: 'Электроника месяца для игр и стримов. Нажмите на обложку, чтобы слушать.',
    intro: [
      'Игровой фон не должен перекрывать звук игры и голосовой чат. Электроника с ровным ритмом подходит лучше, чем треки с длинными вступлениями и резкими пиками.',
      'В подборке — записи каталога за месяц. Включайте в фоне, переключайте треки горячими клавишами и не уходите со страницы.'
    ],
    seoHeading: 'Музыка для игр и стримов',
    seoText: [
      'Для стрима выбирайте треки, которые не содержат чужих сэмплов с неясными правами. На странице трека указан автор, но условия использования лучше проверять у него.',
      'Если нужен более спокойный фон для монтажа, откройте эмбиент или Lo-Fi. Для тренировок — подборку с хип-хопом.'
    ],
    faq: [
      ['Подойдёт ли эта музыка для стрима?', 'Для личного фона — да. Для монетизируемого стрима проверьте права на трек у автора.'],
      ['Можно ли играть музыку в фоне?', 'Да, воспроизведение продолжается при переключении вкладки и в полноэкранном режиме браузера.'],
      ['Есть ли треки без вокала?', 'Да, в электронике много инструментальных записей. Ищите слова instrumental или no vocals.'],
      ['Нужна ли регистрация?', 'Нет. Плеер запускается сразу.']
    ],
    related: ['electronic', 'workout', 'hip-hop', 'chill']
  },
  {
    slug: 'workout',
    key: 'workout',
    kind: 'genre',
    genre: 'Hip-Hop/Rap',
    time: 'month',
    eyebrow: 'Workout · подборка',
    title: 'Музыка для тренировок слушать онлайн | One1Game',
    description: 'Музыка для тренировок: хип-хоп, электроника и треки с темпом. Слушайте онлайн без регистрации на One1Game.',
    keywords: 'музыка для тренировок, музыка для спорта, хип-хоп для тренировки, энергичная музыка, workout music',
    h1: 'Музыка для <em>тренировок</em>',
    lead: 'Темп выше, паузы короче. Треки, которые помогают дожать подход и не сбавлять скорость.',
    label: 'Лучшее для тренировок',
    hint: 'Хип-хоп месяца для тренировок. Нажмите на обложку, чтобы слушать.',
    intro: [
      'На тренировке музыка задаёт темп. Плотный бит и короткие композиции помогают удерживать ритм и не отвлекаться на переключение треков.',
      'В подборке — хип-хоп за месяц. Если нужен более электронный драйв, откройте подборку Electronic.'
    ],
    seoHeading: 'Музыка для тренировок и спорта',
    seoText: [
      'Для интервальных тренировок выбирайте треки с быстрым темпом, для силовых — более плотный бит. Составьте очередь заранее, чтобы не трогать телефон во время подхода.',
      'Плеер работает на сайте и продолжает играть в фоне. На телефоне управление доступно в шторке уведомлений.'
    ],
    faq: [
      ['Какая музыка подходит для тренировок?', 'Треки с плотным ритмом и темпом выше среднего: хип-хоп, электроника, drum & bass.'],
      ['Можно ли составить очередь заранее?', 'Да. Добавляйте треки в очередь и переключайте их кнопками в плеере.'],
      ['Работает ли музыка в фоне?', 'Да, при переключении вкладки и в шторке уведомлений на телефоне.'],
      ['Нужна ли регистрация?', 'Нет. Всё доступно сразу.']
    ],
    related: ['hip-hop', 'electronic', 'gaming', 'rock']
  },
  {
    slug: 'playlists',
    key: '',
    kind: 'playlists',
    genre: '',
    time: '',
    eyebrow: 'Плейлисты · One1Game',
    title: 'Плейлисты — слушать онлайн бесплатно | One1Game',
    description: 'Плейлисты онлайн: подборки треков по жанрам и настроению. Слушайте без регистрации прямо на сайте.',
    keywords: 'плейлисты, музыкальные подборки, слушать плейлисты онлайн, музыка по настроению',
    h1: 'Плейлисты <em>онлайн</em>',
    lead: 'Готовые подборки: открывайте плейлист и слушайте целиком. Всё воспроизводится на сайте.',
    label: 'Плейлисты',
    hint: 'Популярные плейлисты недели. Нажмите на карточку, чтобы открыть треки.',
    intro: [
      'Плейлисты удобны, когда не хочется выбирать отдельные треки. Их собирают артисты, кураторы и обычные слушатели.',
      'В подборке — популярные плейлисты. Откройте карточку, чтобы увидеть список треков и слушать их без перехода на другой сайт.'
    ],
    seoHeading: 'Плейлисты онлайн',
    seoText: [
      'Плейлисты помогают удерживать настроение: один список может быть собран под работу, тренировку или вечернюю поездку.',
      'Если плейлист не подошёл, вернитесь к жанровым подборкам: Lo-Fi, электроника, хип-хоп, рок, chill, учёба, игры и тренировки.'
    ],
    faq: [
      ['Откуда берутся плейлисты?', 'Их собирают артисты, кураторы и слушатели на открытой музыкальной платформе. Мы воспроизводим треки через официальный API.'],
      ['Можно ли слушать плейлист целиком?', 'Да. Откройте плейлист на карточке и нажмите «Слушать всё» — треки встанут в очередь.'],
      ['Нужна ли регистрация?', 'Нет. Плеер и плейлисты доступны без аккаунта.'],
      ['Почему плейлист может быть недоступен?', 'Автор мог удалить его или закрыть стриминг. Плеер пропускает недоступные записи.']
    ],
    related: ['lofi', 'electronic', 'hip-hop', 'rock']
  }
];

/* ── Утилиты ──────────────────────────────────────────────── */

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function routeFor(slug) {
  return slug ? '/music/' + slug + '/' : '/music/';
}

function urlFor(slug) {
  return ORIGIN + routeFor(slug);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K';
  return String(n);
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
}

function replaceBetween(html, start, end, content) {
  const pattern = new RegExp(
    start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  return html.replace(pattern, start + content + end);
}

function replaceOnce(html, from, to) {
  const index = html.indexOf(from);
  if (index === -1) return html;
  return html.slice(0, index) + to + html.slice(index + from.length);
}

/* ── Audius API ───────────────────────────────────────────── */

function isPlayable(track) {
  if (!track) return false;
  if (track.is_streamable === false) return false;
  if (track.is_delete || track.is_unlisted) return false;
  if (track.is_available === false) return false;
  if (track.is_stream_gated) return false;
  if (track.access && track.access.stream === false) return false;
  return true;
}

function normTrack(track) {
  if (!isPlayable(track)) return null;
  const art = track.artwork
    ? (track.artwork['480x480'] || track.artwork['1000x1000'] || track.artwork['150x150'] || '')
    : '';
  const user = track.user || {};
  return {
    id: track.id,
    title: track.title || 'Без названия',
    artist: user.name || 'Неизвестный артист',
    artistId: user.id || '',
    handle: user.handle || '',
    genre: track.genre || '',
    mood: track.mood || '',
    duration: Number(track.duration) || 0,
    plays: Number(track.play_count) || 0,
    favourites: Number(track.favorite_count) || 0,
    artwork: art,
    permalink: track.permalink || '',
    page: 'https://audius.co' + (track.permalink || ''),
    releaseDate: track.release_date || '',
    stream: API + '/tracks/' + track.id + '/stream?app_name=' + APP
  };
}

function normPlaylist(playlist) {
  if (!playlist || playlist.is_delete || playlist.is_unlisted) return null;
  const art = playlist.artwork
    ? (playlist.artwork['480x480'] || playlist.artwork['1000x1000'] || playlist.artwork['150x150'] || '')
    : '';
  const user = playlist.user || {};
  return {
    id: playlist.id,
    title: playlist.playlist_name || 'Плейлист',
    description: playlist.description || '',
    trackCount: Number(playlist.track_count) || 0,
    plays: Number(playlist.total_play_count) || 0,
    artwork: art,
    artist: user.name || '',
    artistId: user.id || '',
    permalink: playlist.permalink || '',
    page: 'https://audius.co' + (playlist.permalink || ''),
    isAlbum: !!playlist.is_album
  };
}

async function api(pathname, params) {
  const query = new URLSearchParams(Object.assign({ app_name: APP }, params || {}));
  const target = API + pathname + '?' + query.toString();
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(target, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Audius ' + res.status);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Audius request failed');
}

async function fetchTracks(genre, time, limit) {
  const json = await api('/tracks/trending', {
    genre: genre || '',
    time: time || 'week',
    limit: String(limit || TRACK_LIMIT)
  });
  return (json.data || []).filter(isPlayable)
    .filter((track) => !/audius/i.test((track.title || '') + ' ' + ((track.user && track.user.name) || '')));
}

async function fetchPlaylists(limit) {
  const json = await api('/playlists/trending', { limit: String(limit || 24) });
  return (json.data || []).filter((item) => item && !item.is_delete && !item.is_unlisted)
    .filter((item) => !/audius/i.test((item.playlist_name || '') + ' ' + ((item.user && item.user.name) || '')));
}

/* ── HTML-карточки ────────────────────────────────────────── */

function trackCard(track, index) {
  const eager = (index || 0) < 4;
  return (
    '<article class="music-card" data-track-id="' + esc(track.id) + '">' +
      '<div class="music-card__art" data-play="' + esc(track.id) + '">' +
        '<img src="' + esc(track.artwork || FALLBACK_ART) + '" alt="' + esc(track.title + ' — ' + track.artist) + '" loading="' + (eager ? 'eager' : 'lazy') + '"' + (eager ? ' fetchpriority="high"' : '') + ' decoding="async">' +
        '<button type="button" class="music-card__play" data-play="' + esc(track.id) + '" aria-label="Слушать ' + esc(track.title) + '"><i class="fas fa-play" aria-hidden="true"></i></button>' +
        '<button type="button" class="music-card__like" data-like="' + esc(track.id) + '" aria-label="В избранное" aria-pressed="false"><i class="far fa-heart" aria-hidden="true"></i></button>' +
      '</div>' +
      '<div class="music-card__body">' +
        '<span class="music-card__title">' + esc(track.title) + '</span>' +
        '<span class="music-card__artist" data-artist="' + esc(track.artistId) + '">' + esc(track.artist) + '</span>' +
        '<span class="music-card__meta"><span>' + esc(track.genre || 'Музыка') + '</span><span>' + fmtTime(track.duration) + '</span></span>' +
      '</div>' +
    '</article>'
  );
}

function tracksHtml(tracks) {
  return tracks.map((track, index) => trackCard(track, index)).join('\n');
}

function playlistCard(playlist) {
  return (
    '<button type="button" class="music-playlist" data-playlist="' + esc(playlist.id) + '">' +
      '<img class="music-playlist__art" src="' + esc(playlist.artwork || FALLBACK_ART) + '" alt="' + esc(playlist.title) + '" loading="lazy" decoding="async">' +
      '<span class="music-playlist__body">' +
        '<span class="music-playlist__title">' + esc(playlist.title) + '</span>' +
        '<span class="music-playlist__meta">' + esc(playlist.artist || 'One1Game') + '<br>' + playlist.trackCount + ' треков · ' + fmtCount(playlist.plays) + ' прослушиваний</span>' +
      '</span>' +
    '</button>'
  );
}

function playlistsHtml(playlists) {
  return playlists.map(playlistCard).join('\n');
}

/* ── JSON-LD ──────────────────────────────────────────────── */

function collectionLd(page, tracks) {
  return (
    '<script type="application/ld+json">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: page.title,
      description: page.description,
      url: urlFor(page.slug),
      inLanguage: 'ru-RU',
      dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: ORIGIN + '/' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: tracks.length,
        itemListElement: tracks.slice(0, 24).map((track, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'MusicRecording',
            name: track.title,
            byArtist: { '@type': 'MusicGroup', name: track.artist },
            duration: 'PT' + Math.max(1, Math.round(track.duration)) + 'S',
            url: track.page,
            audio: { '@type': 'AudioObject', contentUrl: track.stream, encodingFormat: 'audio/mpeg' }
          }
        }))
      }
    }) +
    '</script>'
  );
}

function playlistLd(page, playlists) {
  return (
    '<script type="application/ld+json">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: page.title,
      description: page.description,
      url: urlFor(page.slug),
      inLanguage: 'ru-RU',
      dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: 'One1Game', url: ORIGIN + '/' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: playlists.length,
        itemListElement: playlists.slice(0, 24).map((playlist, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'MusicPlaylist',
            name: playlist.title,
            numTracks: playlist.trackCount,
            url: playlist.page,
            byArtist: { '@type': 'MusicGroup', name: playlist.artist || 'One1Game' }
          }
        }))
      }
    }) +
    '</script>'
  );
}

function crumbLd(page) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Главная', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: 'Музыка', item: ORIGIN + '/music/' }
  ];
  if (page.slug) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: page.h1.replace(/<[^>]+>/g, ''),
      item: urlFor(page.slug)
    });
  }
  return '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
  }) + '</script>';
}

function faqLd(page) {
  return '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  }) + '</script>';
}

/* ── SEO-блок ─────────────────────────────────────────────── */

function faqHtml(page) {
  return page.faq
    .map(([question, answer]) => '<details><summary>' + esc(question) + '</summary><p>' + esc(answer) + '</p></details>')
    .join('\n');
}

function seoHtml(page, tracks, playlists) {
  const links = page.related
    .map((slug) => {
      const target = PAGES.find((item) => item.slug === slug);
      if (!target) return '';
      return '<li><a href="' + routeFor(target.slug) + '">' + esc(target.h1.replace(/<[^>]+>/g, '')) + '</a></li>';
    })
    .filter(Boolean)
    .join('');

  const selection = page.kind === 'playlists'
    ? playlists.slice(0, 10).map((playlist) =>
        '<li><a href="' + routeFor(page.slug) + '?playlist=' + encodeURIComponent(playlist.id) + '">' + esc(playlist.title) + '</a> — ' + esc(playlist.artist || 'One1Game') + ', ' + playlist.trackCount + ' треков</li>'
      ).join('')
    : tracks.slice(0, 12).map((track) =>
        '<li><a href="/music/?track=' + encodeURIComponent(track.id) + '">' + esc(track.title) + '</a> — ' + esc(track.artist) + (track.genre ? ' · ' + esc(track.genre) : '') + '</li>'
      ).join('');

  return (
    '<section class="music-seo">' +
      '<h2>' + esc(page.seoHeading) + '</h2>' +
      page.seoText.map((text) => '<p>' + esc(text) + '</p>').join('') +
      '<h2>Сейчас в подборке</h2>' +
      '<ul>' + selection + '</ul>' +
      '<h2>Как слушать</h2>' +
      '<ol>' +
        '<li>Нажмите на обложку трека — он начнёт играть в нижнем плеере.</li>' +
        '<li>Переключайте треки кнопками вперёд и назад, собирайте очередь.</li>' +
        '<li>Нажмите на сердечко, чтобы сохранить трек в избранное.</li>' +
        '<li>Откройте имя артиста, чтобы посмотреть другие его треки.</li>' +
      '</ol>' +
      '<h2>Смотрите также</h2>' +
      '<ul>' + links + '<li><a href="/music/">Вся музыка онлайн</a></li></ul>' +
      '<h2>Частые вопросы</h2>' +
      '<div class="music-faq">' + faqHtml(page) + '</div>' +
      '<p class="music-note">Все права на музыку принадлежат исполнителям. Мы не храним аудиофайлы и не предоставляем скачивание.</p>' +
    '</section>'
  );
}

/* ── Главная ──────────────────────────────────────────────── */

function injectHome(homeTracks, homePlaylists) {
  const file = path.join(OUT, 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');

  html = replaceBetween(html, '<!--MUSIC:TREND:START-->', '<!--MUSIC:TREND:END-->', '\n' + tracksHtml(homeTracks.slice(0, TRACK_LIMIT)) + '\n');
  html = replaceBetween(html, '<!--MUSIC:PLAYLISTS:START-->', '<!--MUSIC:PLAYLISTS:END-->', '\n' + playlistsHtml(homePlaylists.slice(0, 12)) + '\n');

  html = html.replace(
    /<p class="music-updated" id="music-updated">[\s\S]*?<\/p>/,
    '<p class="music-updated" id="music-updated">Обновлено ' + DATE_RU + ' · подборки обновляются ежедневно</p>'
  );

  const ldItems = homeTracks.slice(0, 24).map((track, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'MusicRecording',
      name: track.title,
      byArtist: { '@type': 'MusicGroup', name: track.artist },
      duration: 'PT' + Math.max(1, Math.round(track.duration)) + 'S',
      url: track.page,
      audio: { '@type': 'AudioObject', contentUrl: track.stream, encodingFormat: 'audio/mpeg' }
    }
  }));

  const homeLd = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Музыка онлайн бесплатно',
    description: 'Слушать музыку онлайн без регистрации: Lo-Fi, электроника, хип-хоп, рок, эмбиент и готовые плейлисты.',
    url: ORIGIN + '/music/',
    inLanguage: 'ru-RU',
    dateModified: TODAY,
    isPartOf: { '@type': 'WebSite', name: 'One1Game', url: ORIGIN + '/' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: ldItems.length,
      itemListElement: ldItems
    }
  }) + '</script>';
  html = replaceBetween(html, '<!--MUSIC:LD:COLLECTION:START-->', '<!--MUSIC:LD:COLLECTION:END-->', '\n' + homeLd + '\n');

  fs.writeFileSync(file, html, 'utf8');
  console.log('  OK /music/ — ' + homeTracks.length + ' треков, ' + homePlaylists.length + ' плейлистов');
}

/* ── Жанровые страницы ────────────────────────────────────── */

function buildPage(page, tracks, playlists) {
  const file = path.join(OUT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  html = replaceOnce(html, '<title>Музыка онлайн бесплатно — слушать без регистрации | One1Game</title>', '<title>' + esc(page.title) + '</title>');
  html = replaceOnce(html, '<meta name="description" content="Слушайте музыку онлайн бесплатно: Lo-Fi, электроника, хип-хоп, рок, эмбиент и готовые плейлисты. Поиск, подборки по настроению и плеер без регистрации.">', '<meta name="description" content="' + esc(page.description) + '">');
  html = replaceOnce(html, '<meta name="keywords" content="музыка онлайн, слушать музыку бесплатно, музыка без регистрации, lo-fi музыка, электронная музыка, хип-хоп онлайн, музыка для учебы, музыка для игр, музыка для тренировок, плейлисты">', '<meta name="keywords" content="' + esc(page.keywords) + '">');
  html = replaceOnce(html, '<link rel="canonical" href="https://one1game.org/music/">', '<link rel="canonical" href="' + urlFor(page.slug) + '">');
  html = replaceOnce(html, '<meta property="og:title" content="Музыка онлайн бесплатно — слушать без регистрации">', '<meta property="og:title" content="' + esc(page.title) + '">');
  html = replaceOnce(html, '<meta property="og:description" content="Lo-Fi, электроника, хип-хоп, рок и эмбиент. Плеер прямо на сайте, без регистрации и переходов.">', '<meta property="og:description" content="' + esc(page.description) + '">');
  html = replaceOnce(html, '<meta property="og:url" content="https://one1game.org/music/">', '<meta property="og:url" content="' + urlFor(page.slug) + '">');
  html = replaceOnce(html, '<meta name="twitter:title" content="Музыка онлайн бесплатно — слушать без регистрации">', '<meta name="twitter:title" content="' + esc(page.title) + '">');
  html = replaceOnce(html, '<meta name="twitter:description" content="Lo-Fi, электроника, хип-хоп, рок и эмбиент. Плеер прямо на сайте, без регистрации.">', '<meta name="twitter:description" content="' + esc(page.description) + '">');

  html = replaceOnce(html, '<h1>Музыка онлайн <em>без регистрации</em></h1>', '<h1>' + page.h1 + '</h1>');
  html = replaceOnce(
    html,
    '<p class="music-lead">Lo-Fi для учёбы, электроника для игр, хип-хоп, рок и эмбиент. Ищите треки, собирайте очередь и слушайте прямо на сайте — без аккаунта и переходов на другие сервисы.</p>',
    '<p class="music-lead">' + esc(page.lead) + '</p>'
  );
  html = replaceOnce(
    html,
    '<span class="music-eyebrow"><i class="fas fa-wave-square" aria-hidden="true"></i> One1Game · Music</span>',
    '<span class="music-eyebrow"><i class="fas fa-wave-square" aria-hidden="true"></i> ' + esc(page.eyebrow) + '</span>'
  );

  html = replaceOnce(
    html,
    '<div class="music-page" id="music-page">',
    '<div class="music-page" id="music-page" data-genre="' + esc(page.genre) + '"' + (page.key ? ' data-genre-key="' + esc(page.key) + '"' : '') + '>'
  );

  html = replaceOnce(
    html,
    '"url": "https://one1game.org/music/",\n    "applicationCategory"',
    '"url": "' + urlFor(page.slug) + '",\n    "applicationCategory"'
  );

  if (page.genre) {
    html = replaceOnce(
      html,
      '<button type="button" class="music-chip is-active" data-genre="">Все</button>',
      '<button type="button" class="music-chip" data-genre="">Все</button>'
    );
    html = replaceOnce(
      html,
      '<button type="button" class="music-chip" data-genre="' + esc(page.genre) + '">',
      '<button type="button" class="music-chip is-active" data-genre="' + esc(page.genre) + '">'
    );
  }

  html = replaceOnce(html, '<h2 id="music-trending-title">Сейчас в тренде</h2>', '<h2 id="music-trending-title">' + esc(page.label) + '</h2>');
  html = replaceOnce(
    html,
    '<p class="music-section__hint">Треки недели. Нажмите на обложку, чтобы слушать.</p>',
    '<p class="music-section__hint">' + esc(page.hint) + '</p>'
  );

  html = replaceBetween(html, '<!--MUSIC:TREND:START-->', '<!--MUSIC:TREND:END-->', '\n' + tracksHtml(tracks.slice(0, TRACK_LIMIT)) + '\n');
  html = replaceBetween(html, '<!--MUSIC:PLAYLISTS:START-->', '<!--MUSIC:PLAYLISTS:END-->', '\n' + playlistsHtml(playlists.slice(0, page.kind === 'playlists' ? 24 : 12)) + '\n');

  const ld = page.kind === 'playlists' ? playlistLd(page, playlists) : collectionLd(page, tracks);
  html = replaceBetween(html, '<!--MUSIC:LD:COLLECTION:START-->', '<!--MUSIC:LD:COLLECTION:END-->', '\n' + ld + '\n');
  html = replaceBetween(html, '<!--MUSIC:LD:CRUMB:START-->', '<!--MUSIC:LD:CRUMB:END-->', '\n' + crumbLd(page) + '\n');
  html = replaceBetween(html, '<!--MUSIC:LD:FAQ:START-->', '<!--MUSIC:LD:FAQ:END-->', '\n' + faqLd(page) + '\n');
  html = replaceBetween(html, '<!--MUSIC:SEO:START-->', '<!--MUSIC:SEO:END-->', '\n' + seoHtml(page, tracks, playlists) + '\n');

  const dir = path.join(OUT, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log('  OK ' + routeFor(page.slug) + ' — ' + tracks.length + ' треков');
}

/* ── Sitemap ──────────────────────────────────────────────── */

function sitemap() {
  const urls = [{ slug: '', priority: '1.0', freq: 'daily' }]
    .concat(PAGES.map((page) => ({
      slug: page.slug,
      priority: page.kind === 'playlists' ? '0.7' : '0.8',
      freq: 'weekly'
    })))
    .map((item) => '  <url><loc>' + urlFor(item.slug) + '</loc><lastmod>' + TODAY + '</lastmod><changefreq>' + item.freq + '</changefreq><priority>' + item.priority + '</priority></url>')
    .join('\n');

  fs.writeFileSync(
    path.join(OUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n',
    'utf8'
  );
  console.log('  OK sitemap.xml — ' + (PAGES.length + 1) + ' URL');
}

/* ── data.json ────────────────────────────────────────────── */

function slimTrack(track) {
  const art = track.artwork || {};
  const user = track.user || {};
  return {
    id: track.id,
    title: track.title,
    genre: track.genre,
    mood: track.mood,
    duration: track.duration,
    play_count: track.play_count,
    favorite_count: track.favorite_count,
    is_streamable: track.is_streamable,
    is_delete: track.is_delete,
    is_unlisted: track.is_unlisted,
    is_available: track.is_available,
    is_stream_gated: track.is_stream_gated,
    access: track.access ? { stream: track.access.stream } : undefined,
    permalink: track.permalink,
    release_date: track.release_date,
    artwork: {
      '150x150': art['150x150'],
      '480x480': art['480x480'],
      '1000x1000': art['1000x1000']
    },
    user: { id: user.id, name: user.name, handle: user.handle }
  };
}

function slimPlaylist(playlist) {
  const art = playlist.artwork || {};
  const user = playlist.user || {};
  return {
    id: playlist.id,
    playlist_name: playlist.playlist_name,
    description: playlist.description,
    track_count: playlist.track_count,
    total_play_count: playlist.total_play_count,
    is_album: playlist.is_album,
    is_delete: playlist.is_delete,
    is_unlisted: playlist.is_unlisted,
    permalink: playlist.permalink,
    artwork: {
      '150x150': art['150x150'],
      '480x480': art['480x480'],
      '1000x1000': art['1000x1000']
    },
    user: { id: user.id, name: user.name, handle: user.handle }
  };
}

function writeData(homeTracks, playlists, genreData) {
  const slimGenres = {};
  Object.keys(genreData).forEach((key) => {
    slimGenres[key] = genreData[key].map(slimTrack);
  });

  const data = {
    generatedAt: new Date().toISOString(),
    source: 'open-catalog',
    trending: homeTracks.map(slimTrack),
    playlists: playlists.slice(0, 12).map(slimPlaylist),
    genres: slimGenres
  };
  fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data), 'utf8');
  console.log('  OK data.json — ' + homeTracks.length + ' трендов, ' + Object.keys(genreData).length + ' подборок');
}

/* ── Main ─────────────────────────────────────────────────── */

async function main() {
  console.log('Генерация раздела «Музыка»…');

  const homeRaw = await fetchTracks('', 'week', TRACK_LIMIT);
  const homeTracks = homeRaw.map(normTrack).filter(Boolean);
  await sleep(500);
  const playlistsRaw = await fetchPlaylists(24);
  const allPlaylists = playlistsRaw.map(normPlaylist).filter(Boolean);
  await sleep(500);

  const genreRaw = {};
  const pageTracks = {};

  for (const page of PAGES) {
    if (page.kind === 'playlists') {
      pageTracks[page.slug] = homeTracks;
      continue;
    }
    try {
      const rawTracks = await fetchTracks(page.genre, page.time, TRACK_LIMIT);
      genreRaw[page.key] = rawTracks;
      pageTracks[page.slug] = rawTracks.map(normTrack).filter(Boolean);
      await sleep(700);
    } catch (error) {
      console.error('  FAIL ' + routeFor(page.slug) + ': ' + error.message);
      pageTracks[page.slug] = homeTracks;
      genreRaw[page.key] = homeRaw;
    }
  }

  injectHome(homeTracks, allPlaylists);

  for (const page of PAGES) {
    const tracks = page.kind === 'playlists' ? homeTracks : (pageTracks[page.slug] || homeTracks);
    buildPage(page, tracks, allPlaylists);
  }

  writeData(homeRaw, playlistsRaw, genreRaw);
  sitemap();
  console.log('Готово.');
}

main().catch((error) => {
  console.error('Ошибка генерации:', error);
  process.exit(1);
});
