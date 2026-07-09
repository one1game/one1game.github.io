// components.js — Shared nav, footer, and PWA registration for One1Game
// Eliminates HTML duplication across all pages
(function() {
  'use strict';

  // ── PWA ────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  // ── Active page detection ──────────────────────────
  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var isHome = path === '/' || path.endsWith('/index.html');
  var isArchive = path.includes('/archive');
  var isCodeFusion = path.includes('/anal-code');
  var isScanner = path.includes('/cyber-scanner');

  function active(state) { return state ? ' active' : ''; }

  // ── Nav ────────────────────────────────────────────
  var nav =
    '<a href="#main-content" class="skip-link">Перейти к контенту</a>' +
    '<nav class="site-nav" aria-label="Главная навигация">' +
    '  <div class="nav-inner">' +
    '    <a href="/" class="nav-logo">ONE1GAME</a>' +
    '    <div class="nav-links">' +
    '      <a href="/" class="nav-link' + active(isHome) + '">Главная</a>' +
    '      <a href="/archive.html" class="nav-link' + active(isArchive) + '">Статьи</a>' +
    '      <a href="/anal-code/" class="nav-link' + active(isCodeFusion) + '">CodeFusion</a>' +
    '      <a href="/cyber-scanner/" class="nav-link' + active(isScanner) + '">Scanner</a>' +
    (isHome ?
    '      <div class="nav-social">' +
    '        <a href="https://www.youtube.com/@one1game" target="_blank" rel="noopener" title="YouTube"><i class="fab fa-youtube"></i></a>' +
    '        <a href="https://vk.com/one1games" target="_blank" rel="noopener" title="ВКонтакте"><i class="fab fa-vk"></i></a>' +
    '        <a href="https://t.me/one1game" target="_blank" rel="noopener" title="Telegram"><i class="fab fa-telegram-plane"></i></a>' +
    '      </div>' : '') +
    '    </div>' +
    '  </div>' +
    '</nav>';

  // ── Footer ─────────────────────────────────────────
  var footer =
    '<footer class="site-footer">' +
    '  <div class="footer-content">' +
    '    <span>&copy; 2025–2026 One1Game</span>' +
    '    <div class="footer-links">' +
    '      <a href="/privacy.html">Политика</a>' +
    '      <a href="/terms.html">Правила</a>' +
    '      <a href="/advertising.html">Реклама</a>' +
    '    </div>' +
    '  </div>' +
    '</footer>';

  // ── Inject ─────────────────────────────────────────
  document.body.insertAdjacentHTML('afterbegin', nav);

  var main = document.querySelector('main#main-content');
  if (main) {
    main.insertAdjacentHTML('afterend', footer);
  }
})();
