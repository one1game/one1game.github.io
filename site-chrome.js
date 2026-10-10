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

  function a(s) { return s ? ' active' : ''; }

  var nav =
    '<a href="#main-content" class="skip-link">Перейти к контенту</a>' +
    '<nav class="site-nav" aria-label="Главная навигация">' +
    '  <div class="nav-inner">' +
    '    <a href="/" class="nav-logo">ONE1<span>GAME</span></a>' +
    '    <div class="nav-links">' +
    '      <a href="/" class="nav-link' + a(isHome) + '">Главная</a>' +
    '      <a href="/feed/" class="nav-link' + a(isFeed) + '">ТикТок</a>' +
    '      <a href="/portablewebgame/" class="nav-link' + a(isRetro) + '">Ретро-игры</a>' +
    '      <a href="/go/" class="nav-link' + a(isGo) + '">Игры онлайн</a>' +
    '      <a href="/kino/" class="nav-link' + a(isKino) + '">Кино</a>' +
    '      <a href="/archive" class="nav-link' + a(isArchive) + '">Статьи</a>' +
    '      <a href="/ai/" class="nav-link' + a(isAI) + '">AI Pulse</a>' +
    '      <a href="/genriprocedur/" class="nav-link' + a(isMusic) + '">Cosmic Drift</a>' +
    '      <a href="/triad-duel" class="nav-link' + a(isTriad) + '">Triad Duel</a>' +
    '      <a href="/anal-code/" class="nav-link' + a(isCodeFusion) + '">CodeFusion</a>' +
    '      <a href="/cyber-scanner/" class="nav-link' + a(isScanner) + '">Scanner</a>' +
    '      <a href="/l2/" class="nav-link' + a(isL2) + '">L2 Server</a>' +
    '    </div>' +
    '  </div>' +
    '</nav>';

  var footer =
    '<footer class="site-footer">' +
    '  <div class="footer-content">' +
    '    <a href="/" class="footer-brand">ONE1<span>GAME</span></a>' +
    '    <div class="footer-links">' +
    '      <a href="/feed/">ТикТок</a>' +
    '      <a href="/portablewebgame/">Ретро-игры</a>' +
    '      <a href="/dos/">DOS-игры</a>' +
    '      <a href="/kino/">Кино</a>' +
    '      <a href="/archive">Статьи</a>' +
    '      <a href="/category/obzory">Обзоры игр</a>' +
    '      <a href="/category/gajdy">Гайды</a>' +
    '      <a href="/category/analitika">Аналитика</a>' +
    '      <a href="/category/ii-i-tehnologii">ИИ и технологии</a>' +
    '      <a href="/ai/">AI Pulse</a>' +
    '      <a href="/genriprocedur/">Cosmic Drift</a>' +
    '      <a href="/cyber-scanner/">Проверка безопасности</a>' +
    '      <a href="/advertising">Реклама</a>' +
    '      <a href="/privacy">Политика</a>' +
    '      <a href="/terms">Правила</a>' +
    '    </div>' +
    '    <div class="footer-socials">' +
    '      <a href="https://t.me/one1game" target="_blank" rel="noopener" aria-label="Telegram" title="Telegram">TG</a>' +
    '      <a href="https://vk.com/one1games" target="_blank" rel="noopener" aria-label="ВКонтакте" title="ВКонтакте">VK</a>' +
    '      <a href="https://www.youtube.com/@one1game" target="_blank" rel="noopener" aria-label="YouTube" title="YouTube">YT</a>' +
    '    </div>' +
    '    <span>&copy; 2025–2026 One1Game</span>' +
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
    '}' +
    '@media (min-width:900px) and (max-width:1059px){.nav-links{display:none}}' +
    '.site-footer{border-top:1px solid rgba(125,255,155,.16);padding:16px 0 20px;margin-top:24px;font-family:' + MONO + '}' +
    '.footer-content{max-width:1180px;margin:0 auto;padding:0 14px;display:flex;flex-direction:column;gap:12px;font-size:.66rem;color:#75808d;letter-spacing:.06em}' +
    '.footer-brand{color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.12em}' +
    '.footer-brand span{color:#7dff9b}' +
    '.footer-links{display:flex;flex-wrap:wrap;gap:4px 14px}' +
    '.footer-links a{color:#8f99a6;text-decoration:none;text-transform:uppercase}' +
    '.footer-links a:hover{color:#7dff9b}' +
    '.footer-socials{display:flex;gap:6px}' +
    '.footer-socials a{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(125,255,155,.16);color:#8f99a6;text-decoration:none;font-size:.62rem;letter-spacing:.04em}' +
    '.footer-socials a:hover{color:#7dff9b;border-color:rgba(125,255,155,.34)}' +
    '.skip-link{position:absolute;top:-100px;left:10px;z-index:9999;padding:10px 14px;background:#7dff9b;color:#04060a;font-weight:700;font-size:.8rem;text-decoration:none}' +
    '.skip-link:focus{top:10px}' +
    'img{-webkit-user-drag:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}' +
    '@media (min-width:900px){.footer-content{flex-direction:row;align-items:center;justify-content:space-between}}';

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
