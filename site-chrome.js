// site-chrome.js — единая шапка и футер One1Game для разделов-приложений.
// Только презентационный слой: общая навигация + футер, в том же виде, что на
// главной. Не подключает styles.css и components.js, не регистрирует service
// worker и не трогает поиск/радио — чтобы не конфликтовать со скриптами и SW
// самих приложений (Игры онлайн, AI Pulse, Cosmic Drift, CodeFusion, L2).
(function () {
  'use strict';
  if (window.__o1gChrome) return;
  window.__o1gChrome = true;
  if (document.querySelector('.site-nav')) return; // шапка уже есть

  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var starts = function (p) { return path === p || path.indexOf(p + '/') === 0; };

  var isHome = path === '/' || path.slice(-11) === '/index.html';
  var isGo = starts('/go');
  var isArchive = starts('/archive') || path === '/archive.html';
  var isAI = starts('/ai');
  var isMusic = starts('/genriprocedur');
  var isTriad = starts('/triad-duel');
  var isCodeFusion = starts('/anal-code');
  var isScanner = starts('/cyber-scanner');
  var isL2 = starts('/l2');
  var isFeed = starts('/feed');
  var isRetro = starts('/portablewebgame') || starts('/dos') || starts('/ra2') || starts('/red-alert-2');
  var isKino = starts('/kino');
  var isBrowserQuest = starts('/browserquest');

  function a(s) { return s ? ' active' : ''; }

  var isGames = isGo || isBrowserQuest || isRetro || isMusic || isTriad;
  var isMedia = isKino || isFeed;
  var isReading = isArchive || path.indexOf('/category/') === 0;
  var isPicks = path === '/besplatnye-igry' || path === '/skidki-na-igry' || path === '/vo-chto-poigrat'
    || path.indexOf('/igry-bez-videokarty') === 0 || path.indexOf('/igry-dlya-slabyh') === 0;
  var isServices = isAI || isCodeFusion || isScanner || isL2;

  function navItem(label, href, state) {
    return '<a href="' + href + '" class="nav-link' + a(state) + '"' + (state ? ' aria-current="page"' : '') + '>' + label + '</a>';
  }

  function navDrop(label, href, state, items) {
    var links = '';
    for (var i = 0; i < items.length; i++) {
      links += '<a href="' + items[i][0] + '">' + items[i][1] + '</a>';
    }
    return '<div class="nav-item has-drop">' +
      '<a href="' + href + '" class="nav-link' + a(state) + '" aria-haspopup="true"' + (state ? ' aria-current="page"' : '') + '>' + label + '</a>' +
      '<div class="nav-dropdown" role="group" aria-label="' + label + '">' + links + '</div>' +
      '</div>';
  }

  var nav =
    '<a href="#main-content" class="skip-link">Перейти к контенту</a>' +
    '<nav class="site-nav" aria-label="Главная навигация">' +
    '  <div class="nav-inner">' +
    '    <a href="/" class="nav-logo">ONE1<span>GAME</span></a>' +
    '    <div class="nav-links">' +
    navItem('Главная', '/', isHome) +
    navDrop('Игры', '/go/', isGames, [
      ['/go/', 'Игры онлайн'],
      ['/browserquest/', 'BrowserQuest'],
      ['/genriprocedur/', 'Cosmic Drift'],
      ['/triad-duel', 'Triad Duel'],
      ['/portablewebgame/', 'Ретро-игры'],
      ['/dos/', 'DOS-игры']
    ]) +
    navDrop('Медиа', '/kino/', isMedia, [
      ['/kino/', 'Кино'],
      ['/feed/', 'ТикТок']
    ]) +
    navDrop('Статьи', '/archive', isReading, [
      ['/archive', 'Все статьи'],
      ['/category/obzory', 'Обзоры игр'],
      ['/category/gajdy', 'Гайды'],
      ['/category/analitika', 'Аналитика'],
      ['/category/ii-i-tehnologii', 'ИИ и технологии']
    ]) +
    navDrop('Подборки', '/besplatnye-igry', isPicks, [
      ['/besplatnye-igry', 'Бесплатные раздачи'],
      ['/skidki-na-igry', 'Скидки на игры'],
      ['/vo-chto-poigrat', 'Во что поиграть'],
      ['/igry-bez-videokarty', 'Игры для слабых ПК']
    ]) +
    navDrop('Сервисы', '/ai/', isServices, [
      ['/ai/', 'AI Pulse'],
      ['/anal-code/', 'CodeFusion'],
      ['/cyber-scanner/', 'Scanner'],
      ['/l2/', 'L2 Server']
    ]) +
    '    </div>' +
    '  </div>' +
    '</nav>';

  function footerCol(title, items) {
    var links = '';
    for (var j = 0; j < items.length; j++) {
      links += '<a href="' + items[j][0] + '">' + items[j][1] + '</a>';
    }
    return '<div class="footer-col"><p class="footer-title">' + title + '</p>' + links + '</div>';
  }

  var footer =
    '<footer class="site-footer">' +
    '  <div class="footer-content">' +
    '    <div class="footer-brand-row">' +
    '      <a href="/" class="footer-brand">ONE1<span>GAME</span></a>' +
    '      <div class="footer-socials">' +
    '        <a href="https://t.me/one1game" target="_blank" rel="noopener" aria-label="Telegram" title="Telegram">TG</a>' +
    '        <a href="https://vk.com/one1games" target="_blank" rel="noopener" aria-label="ВКонтакте" title="ВКонтакте">VK</a>' +
    '        <a href="https://www.youtube.com/@one1game" target="_blank" rel="noopener" aria-label="YouTube" title="YouTube">YT</a>' +
    '      </div>' +
    '    </div>' +
    '    <div class="footer-links">' +
    footerCol('Игры', [
      ['/go/', 'Игры онлайн'],
      ['/browserquest/', 'BrowserQuest'],
      ['/portablewebgame/', 'Ретро-игры'],
      ['/dos/', 'DOS-игры'],
      ['/genriprocedur/', 'Cosmic Drift'],
      ['/triad-duel', 'Triad Duel']
    ]) +
    footerCol('Читать', [
      ['/archive', 'Все статьи'],
      ['/category/obzory', 'Обзоры игр'],
      ['/category/gajdy', 'Гайды'],
      ['/category/analitika', 'Аналитика'],
      ['/category/ii-i-tehnologii', 'ИИ и технологии']
    ]) +
    footerCol('Подборки', [
      ['/besplatnye-igry', 'Бесплатные раздачи'],
      ['/skidki-na-igry', 'Скидки на игры'],
      ['/vo-chto-poigrat', 'Во что поиграть'],
      ['/igry-bez-videokarty', 'Игры для слабых ПК']
    ]) +
    footerCol('Медиа', [
      ['/kino/', 'Кино'],
      ['/feed/', 'ТикТок']
    ]) +
    footerCol('Сервисы', [
      ['/ai/', 'AI Pulse'],
      ['/anal-code/', 'CodeFusion'],
      ['/cyber-scanner/', 'Scanner'],
      ['/l2/', 'L2 Server']
    ]) +
    footerCol('Издание', [
      ['/advertising', 'Реклама'],
      ['/privacy', 'Политика'],
      ['/terms', 'Правила']
    ]) +
    '    </div>' +
    '    <div class="footer-bottom">' +
    '      <span>&copy; 2025–2026 One1Game</span>' +
    '      <span>Сделано для игроков: без установки и регистрации</span>' +
    '    </div>' +
    '  </div>' +
    '</footer>';

  var MONO = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
  var css =
    '.site-nav{position:sticky;top:0;z-index:300;background:rgba(4,6,10,.94);border-bottom:1px solid rgba(125,255,155,.16);font-family:' + MONO + '}' +
    '.nav-inner{max-width:1180px;margin:0 auto;padding:0 14px;height:52px;display:flex;align-items:center;gap:10px}' +
    '.nav-logo{font-size:.86rem;font-weight:700;letter-spacing:.02em;color:#fff;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}' +
    '.nav-logo::before{content:">";color:#7dff9b;font-weight:700}' +
    '.nav-logo span{color:#7dff9b}' +
    '.nav-logo:hover{color:#7dff9b}' +
    '.nav-links{display:none}' +
    '@media (min-width:900px){' +
      '.site-nav{background:rgba(4,6,10,.72);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2)}' +
      '.nav-inner{padding:0 26px;height:56px}' +
      '.nav-links{display:flex;align-items:center;gap:0;margin-left:16px}' +
      '.nav-link{padding:8px 12px;color:#8f99a6;text-decoration:none;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;border-radius:999px;transition:color .15s,background .15s}' +
      '.nav-link:hover,.nav-link.active{color:#7dff9b;background:rgba(125,255,155,.09)}' +
      '.nav-item{position:relative}' +
      '.nav-item>.nav-link::after{content:"▾";display:inline-block;margin-left:4px;font-size:.7em;opacity:.55;transform:translateY(-1px)}' +
      '.nav-dropdown{position:absolute;top:calc(100% - 2px);left:0;min-width:212px;display:none;flex-direction:column;padding:6px;background:#0a0f14;border:1px solid rgba(125,255,155,.16);border-radius:12px;box-shadow:0 16px 38px rgba(0,0,0,.5);z-index:400}' +
      '.nav-item:hover>.nav-dropdown,.nav-item:focus-within>.nav-dropdown{display:flex}' +
      '.nav-dropdown a{padding:9px 12px;border-radius:8px;color:#8f99a6;text-decoration:none;font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;transition:color .15s,background .15s}' +
      '.nav-dropdown a:hover,.nav-dropdown a:focus{color:#7dff9b;background:rgba(125,255,155,.09)}' +
    '}' +
    '.site-footer{border-top:1px solid rgba(125,255,155,.16);padding:16px 0 20px;margin-top:24px;font-family:' + MONO + '}' +
    '.footer-content{max-width:1180px;margin:0 auto;padding:0 14px;display:flex;flex-direction:column;gap:18px;font-size:.66rem;color:#75808d;letter-spacing:.06em}' +
    '.footer-brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
    '.footer-brand{color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.12em}' +
    '.footer-brand span{color:#7dff9b}' +
    '.footer-links{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px 20px;align-items:start}' +
    '.footer-col{display:flex;flex-direction:column;gap:5px;min-height:144px}' +
    '.footer-title{margin:0 0 3px;color:#fff;font-size:.62rem;line-height:1.4;letter-spacing:.12em;text-transform:uppercase}' +
    '.footer-links a{color:#8f99a6;text-decoration:none;text-transform:uppercase}' +
    '.footer-links a:hover{color:#7dff9b}' +
    '.footer-bottom{display:flex;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;padding-top:12px;border-top:1px solid rgba(125,255,155,.16)}' +
    '.footer-socials{display:flex;gap:6px}' +
    '.footer-socials a{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(125,255,155,.16);color:#8f99a6;text-decoration:none;font-size:.62rem;letter-spacing:.04em}' +
    '.footer-socials a:hover{color:#7dff9b;border-color:rgba(125,255,155,.34)}' +
    '.skip-link{position:absolute;top:-100px;left:10px;z-index:9999;padding:10px 14px;background:#7dff9b;color:#04060a;font-weight:700;font-size:.8rem;text-decoration:none}' +
    '.skip-link:focus{top:10px}' +
    '@media (max-width:1100px){.footer-links{grid-template-columns:repeat(3,minmax(0,1fr))}.footer-col{min-height:0}}' +
    '@media (max-width:700px){.footer-links{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '@media (max-width:420px){.footer-links{grid-template-columns:1fr}}' +
    'img{-webkit-user-drag:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}';

  var style = document.createElement('style');
  style.id = 'o1g-chrome-style';
  style.textContent = css;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('afterbegin', nav);
  document.body.insertAdjacentHTML('beforeend', footer);

  // Защита изображений: правый клик — как по пустому месту, без «Сохранить изображение».
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'IMG' || (t.closest && t.closest('picture, figure')))) e.preventDefault();
  }, true);
  document.addEventListener('dragstart', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') e.preventDefault();
  }, true);
})();
