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

// ── Related Articles (cross-linking) ──────────────
(function() {
  'use strict';
  var container = document.getElementById('related-container');
  if (!container) return;

  function load() {
    if (!window.allArticles || !window.allArticles.length) {
      setTimeout(load, 200);
      return;
    }

    var kwMeta = document.querySelector('meta[name="keywords"]');
    var keywords = kwMeta ? kwMeta.getAttribute('content').toLowerCase().split(/,\s*/) : [];
    var canon = document.querySelector('link[rel="canonical"]');
    var currentUrl = canon ? new URL(canon.href).pathname : '';

    var scored = [];
    for (var i = 0; i < window.allArticles.length; i++) {
      var a = window.allArticles[i];
      if (a.url === currentUrl) continue;
      if (a.url === ('/' + a.url.replace(/^\//, ''))) continue;
      if (a.url === currentUrl.replace('/archive/', '/')) continue;

      var score = 0;
      var aTitle = (a.title || '').toLowerCase();
      var aExcerpt = (a.excerpt || '').toLowerCase();
      var aText = aTitle + ' ' + aExcerpt;

      for (var k = 0; k < keywords.length; k++) {
        var kw = keywords[k].trim();
        if (kw.length < 3) continue;
        if (aText.indexOf(kw) !== -1) score += 2;
      }

      if (score > 0) scored.push({ article: a, score: score });
    }

    scored.sort(function(x, y) { return y.score - x.score; });
    var top = scored.slice(0, 4);

    if (!top.length) {
      container.innerHTML = '';
      return;
    }

    var catClass = function(cat) {
      var map = { 'Гайды': 'cat-guides', 'Аналитика': 'cat-analytics', 'Мнение': 'cat-opinion',
                  'Разработка': 'cat-dev', 'Технологии': 'cat-tech', 'Консоли': 'cat-consoles',
                  'Тренды': 'cat-trends' };
      return map[cat] || '';
    };

    var html = '';
    for (var t = 0; t < top.length; t++) {
      var art = top[t].article;
      var img = art.image ? '<img src="' + art.image + '" alt="' + art.title + '" loading="lazy" width="1344" height="768">' : '';
      html +=
        '<a href="' + art.url + '" class="related-card">' +
          (img ? '<div class="related-img">' + img + '</div>' : '') +
          '<div class="related-info">' +
            '<span class="related-cat ' + catClass(art.category) + '">' + (art.category || '') + '</span>' +
            '<h5>' + art.title + '</h5>' +
          '</div>' +
        '</a>';
    }

    container.innerHTML = html;
  }

  load();
})();
