// free-games.js — топ бесплатных игр с FreeToGame API
(function() {
  'use strict';

  var CONTAINER = 'free-games-grid';
  var CACHE_KEY = 'one1game_freegames';
  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа
  var GAME_COUNT = 6;

  var grid = document.getElementById(CONTAINER);
  if (!grid) return;

  grid.innerHTML = '<div class="fg-loading">Загрузка игр...</div>';

  var cached = getCache();
  if (cached) { render(cached); return; }

  fetch('https://www.freetogame.com/api/games?platform=pc&sort-by=popularity')
    .then(function(r) { return r.json(); })
    .then(function(games) {
      var top = games.slice(0, GAME_COUNT);
      setCache(top);
      render(top);
    })
    .catch(function() {
      var stale = getCache(true);
      if (stale) { render(stale); }
      else { grid.innerHTML = '<div class="fg-empty">Не удалось загрузить игры</div>'; }
    });

  function getCache(ignoreTTL) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!ignoreTTL && Date.now() - entry.ts > CACHE_TTL) return null;
      return entry.data;
    } catch(e) { return null; }
  }

  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
  }

  function render(games) {
    grid.innerHTML = games.map(function(g) {
      return '<a href="' + esc(g.freetogame_profile_url) + '" class="fg-card" target="_blank" rel="noopener">' +
        '<div class="fg-img">' +
        '  <img src="' + esc(g.thumbnail) + '" alt="" loading="lazy" />' +
        '  <span class="fg-badge">Бесплатно</span>' +
        '</div>' +
        '<div class="fg-body">' +
        '  <span class="fg-genre">' + esc(g.genre) + '</span>' +
        '  <span class="fg-title">' + esc(g.title) + '</span>' +
        '  <span class="fg-desc">' + (g.short_description || '').substring(0, 80) + '…</span>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
