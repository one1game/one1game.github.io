// free-games.js — свежие бесплатные игры с FreeToGame API
(function() {
  'use strict';

  var CONTAINER = 'free-games-grid';
  var CACHE_KEY = 'one1game_freegames';
  var CACHE_TTL = 2 * 60 * 60 * 1000; // 2 часа
  var GAME_COUNT = 6;
  var POOL_SIZE = 50;
  var ALL_GAMES = null; // полный список после загрузки

  var genreRU = {
    'Shooter': 'Шутер', 'MMORPG': 'MMORPG', 'MOBA': 'MOBA',
    'Battle Royale': 'Королевская битва', 'Strategy': 'Стратегия',
    'Fighting': 'Файтинг', 'Racing': 'Гонки', 'Sports': 'Спорт',
    'MMO': 'MMO', 'Social': 'Социальная', 'Card Game': 'Карточная',
    'ARPG': 'Action RPG', 'Action RPG': 'Action RPG', 'MMOFPS': 'MMOFPS',
    'Fantasy': 'Фэнтези', 'Action': 'Экшен', 'Survival': 'Выживание',
    'Zombie': 'Зомби', 'Horror': 'Хоррор', 'Adventure': 'Приключения',
    'Pixel': 'Пиксельная', 'Turn-Based': 'Пошаговая', '2D': '2D', '3D': '3D'
  };

  var grid = document.getElementById(CONTAINER);
  if (!grid) return;

  grid.innerHTML = '<div class="fg-loading">Загрузка игр...</div>';

  var cached = getCache();
  if (cached) { ALL_GAMES = cached; pickAndRender(); return; }

  fetch('https://www.freetogame.com/api/games?sort-by=release-date')
    .then(function(r) { return r.json(); })
    .then(function(games) {
      ALL_GAMES = games;
      setCache(games);
      pickAndRender();
    })
    .catch(function() {
      var stale = getCache(true);
      if (stale) { ALL_GAMES = stale; pickAndRender(); }
      else { grid.innerHTML = '<div class="fg-empty">Не удалось загрузить игры</div>'; }
    });

  function pickAndRender() {
    if (!ALL_GAMES || !ALL_GAMES.length) return;
    var pool = ALL_GAMES.slice(0, POOL_SIZE);
    var top = shuffle(pool).slice(0, GAME_COUNT);
    render(top);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

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
      var genre = genreRU[g.genre] || g.genre;
      return '<a href="' + esc(g.freetogame_profile_url) + '" class="fg-card" target="_blank" rel="noopener">' +
        '<div class="fg-img">' +
        '  <img src="' + esc(g.thumbnail) + '" alt="" loading="lazy" />' +
        '  <span class="fg-badge">Бесплатно</span>' +
        '</div>' +
        '<div class="fg-body">' +
        '  <span class="fg-genre">' + esc(genre) + '</span>' +
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

  // Кнопка «Показать другие»
  var btn = document.getElementById('fg-refresh');
  if (btn) {
    btn.addEventListener('click', function() {
      if (!ALL_GAMES) return;
      btn.textContent = 'Загрузка...';
      btn.disabled = true;
      pickAndRender();
      setTimeout(function() { btn.textContent = 'Показать другие'; btn.disabled = false; }, 600);
    });
  }
})();
