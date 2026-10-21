/* =============================================================
   ONE1GAME — блок «Разделы сайта» на главной.
   Интерактивные блоки: обои, музыка, игры, статьи.
   Все переходы — только внутренние, без ухода на сторонние сайты.
   ============================================================= */
(function () {
  'use strict';

  var hub = document.getElementById('o1hub');
  if (!hub) return;

  var doc = document;
  var tabs = Array.prototype.slice.call(hub.querySelectorAll('[data-o1hub-tab]'));
  var panels = Array.prototype.slice.call(hub.querySelectorAll('[data-o1hub-panel]'));
  var FALLBACK_ART = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1a2433"/><stop offset="1" stop-color="#0a0f16"/></linearGradient></defs>' +
    '<rect width="480" height="480" fill="url(#g)"/>' +
    '<path d="M200 330V190l120-28v140a44 44 0 1 1-24-39V188l-72 17v125a44 44 0 1 1-24-39z" fill="#7dff9b" opacity=".7"/>' +
    '</svg>'
  );

  var WALL_SECTIONS = [
    { key: 'neon', label: 'Неон' },
    { key: 'cyberpunk', label: 'Киберпанк' },
    { key: 'anime', label: 'Аниме' },
    { key: 'fantasy', label: 'Фэнтези' }
  ];

  var GAMES = [
    ['/go/', 'Игры онлайн'],
    ['/browserquest/', 'BrowserQuest'],
    ['/genriprocedur/', 'Cosmic Drift'],
    ['/triad-duel', 'Triad Duel'],
    ['/portablewebgame/', 'Ретро-игры'],
    ['/dos/', 'DOS-игры']
  ];

  var state = {
    tab: 'oboi',
    wallData: null,
    wallPicks: [],
    tracks: [],
    trackIndex: -1,
    wantsPlay: false,
    articles: null,
    articlesTries: 0
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showTab(name) {
    state.tab = name;
    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute('data-o1hub-tab') === name;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      var isActive = panel.getAttribute('data-o1hub-panel') === name;
      panel.classList.toggle('is-active', isActive);
      if (isActive) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });

    if (name === 'oboi') ensureWalls();
    if (name === 'music') ensureMusic();
    if (name === 'articles') ensureArticles();
  }

  /* ── Обои ────────────────────────────────────────────────── */
  function pickWall(items) {
    if (!items || !items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function renderWalls() {
    var wrap = doc.getElementById('o1hub-walls');
    if (!wrap || !state.wallData || !state.wallData.pages) return;

    var html = WALL_SECTIONS.map(function (section) {
      var page = state.wallData.pages[section.key];
      var items = page && page.items ? page.items : [];
      var item = pickWall(items);
      if (!item || !item.thumb) return '';
      return '<a class="o1hub-wall" href="/oboi/' + section.key + '/">' +
        '<img src="' + esc(item.thumb) + '" alt="' + esc(section.label) + '" loading="lazy" decoding="async">' +
        '<span>' + esc(section.label) + '</span>' +
        '</a>';
    }).filter(Boolean).join('');

    if (html) wrap.innerHTML = html;
  }

  function ensureWalls() {
    if (state.wallData) {
      renderWalls();
      return;
    }
    fetch('/oboi/data.json', { credentials: 'omit' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        state.wallData = data;
        renderWalls();
      })
      .catch(function () {});
  }

  /* ── Музыка ──────────────────────────────────────────────── */
  function trackArtwork(track) {
    var art = track && track.artwork;
    if (!art) return '';
    if (typeof art === 'string') return art;
    return art['480x480'] || art['1000x1000'] || art['150x150'] || '';
  }

  function collectTracks(data) {
    var byId = {};
    var list = [];
    function add(track) {
      if (!track || !track.id || byId[track.id]) return;
      byId[track.id] = true;
      list.push(track);
    }
    (data.trending || []).forEach(add);
    Object.keys(data.genres || {}).forEach(function (key) {
      (data.genres[key] || []).forEach(add);
    });
    return list;
  }

  function normalize(track) {
    if (window.O1Player) return window.O1Player.normalize(track);
    if (!track || !track.id) return null;
    return {
      id: track.id,
      title: track.title || 'Без названия',
      artist: (track.user && track.user.name) || 'One1Game',
      artwork: trackArtwork(track),
      duration: Number(track.duration) || 0,
      href: '/music/?track=' + encodeURIComponent(track.id),
      stream: 'https://api.audius.co/v1/tracks/' + encodeURIComponent(track.id) + '/stream?app_name=One1Game'
    };
  }

  function ensureMusic() {
    if (state.tracks.length) {
      renderCurrent();
      return;
    }
    fetch('/music/data.json', { credentials: 'omit' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        state.tracks = collectTracks(data).map(normalize).filter(Boolean);
        if (!state.tracks.length) return;
        if (state.wantsPlay) {
          state.wantsPlay = false;
          playIndex(Math.floor(Math.random() * state.tracks.length));
          return;
        }
        renderCurrent();
      })
      .catch(function () {});
  }

  function playerTrack() {
    return window.O1Player ? window.O1Player.current().track : null;
  }

  function indexOfTrack(id) {
    for (var i = 0; i < state.tracks.length; i++) {
      if (state.tracks[i].id === id) return i;
    }
    return -1;
  }

  function syncMusicButton() {
    var btn = doc.getElementById('o1hub-music-play');
    if (!btn) return;
    var now = window.O1Player ? window.O1Player.current() : { track: null, playing: false };
    var current = state.tracks[state.trackIndex];
    var playing = !!(now.playing && now.track && current && now.track.id === current.id);
    btn.classList.toggle('is-playing', playing);
    btn.innerHTML = '<i class="fas ' + (playing ? 'fa-pause' : 'fa-play') + '" aria-hidden="true"></i> ' + (playing ? 'Пауза' : 'Слушать');
  }

  function renderMusic(index) {
    if (!state.tracks.length) return;
    state.trackIndex = ((index % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var track = state.tracks[state.trackIndex];
    var art = doc.getElementById('o1hub-music-art');
    var title = doc.getElementById('o1hub-music-title');
    var artist = doc.getElementById('o1hub-music-artist');
    var link = doc.getElementById('o1hub-music-link');

    if (art) art.src = track.artwork || FALLBACK_ART;
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = track.artist;
    if (link) link.href = track.href;

    syncMusicButton();
  }

  function renderCurrent() {
    var now = playerTrack();
    var found = now ? indexOfTrack(now.id) : -1;
    if (found >= 0) {
      renderMusic(found);
      return;
    }
    renderMusic(state.trackIndex >= 0 ? state.trackIndex : Math.floor(Math.random() * state.tracks.length));
  }

  function playIndex(index) {
    if (!state.tracks.length) return;
    state.trackIndex = ((index % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var track = state.tracks[state.trackIndex];
    renderMusic(state.trackIndex);
    if (window.O1Player) window.O1Player.play(track, state.tracks, state.trackIndex);
  }

  function toggleMusic() {
    if (!state.tracks.length) {
      state.wantsPlay = true;
      ensureMusic();
      return;
    }
    var now = playerTrack();
    var found = now ? indexOfTrack(now.id) : -1;
    if (found >= 0) {
      renderMusic(found);
      window.O1Player.toggle();
      return;
    }
    playIndex(state.trackIndex >= 0 ? state.trackIndex : 0);
  }

  function nextMusic() {
    if (!state.tracks.length) return;
    if (window.O1Player && playerTrack()) {
      window.O1Player.next(false);
      return;
    }
    playIndex(Math.floor(Math.random() * state.tracks.length));
  }

  function followPlayer() {
    var now = playerTrack();
    if (!now) {
      syncMusicButton();
      return;
    }
    var found = indexOfTrack(now.id);
    if (found >= 0 && found !== state.trackIndex) renderMusic(found);
    else syncMusicButton();
  }

  /* ── Статьи ──────────────────────────────────────────────── */
  function ensureArticles() {
    if (state.articles) {
      renderArticles();
      return;
    }
    var list = window.allArticles || [];
    if (!list.length) {
      state.articlesTries += 1;
      if (state.articlesTries <= 12) setTimeout(ensureArticles, 250);
      return;
    }
    state.articles = list.filter(function (item) {
      return item && item.url && item.url.indexOf('/') === 0 && item.title;
    });
    renderArticles();
  }

  function renderArticles() {
    var wrap = doc.getElementById('o1hub-articles');
    if (!wrap || !state.articles) return;
    var picks = state.articles.slice(0, 3);
    wrap.innerHTML = picks.map(function (item) {
      return '<a class="o1hub-article" href="' + esc(item.url) + '">' +
        '<span>' + esc(item.category || 'Статья') + '</span>' +
        '<b>' + esc(item.title) + '</b>' +
        '<i>' + esc(item.date || '') + '</i>' +
        '</a>';
    }).join('');
  }

  function randomArticle() {
    var list = state.articles || (window.allArticles || []).filter(function (item) {
      return item && item.url && item.url.indexOf('/') === 0 && item.title;
    });
    if (!list.length) return;
    var item = list[Math.floor(Math.random() * list.length)];
    window.location.href = item.url;
  }

  function randomGame() {
    var game = GAMES[Math.floor(Math.random() * GAMES.length)];
    window.location.href = game[0];
  }

  /* ── События ─────────────────────────────────────────────── */
  hub.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-o1hub-tab]');
    if (tab) {
      showTab(tab.getAttribute('data-o1hub-tab'));
      return;
    }

    var shuffle = event.target.closest('[data-o1hub-shuffle="oboi"]');
    if (shuffle) {
      renderWalls();
      return;
    }

    var random = event.target.closest('[data-o1hub-random]');
    if (random) {
      var kind = random.getAttribute('data-o1hub-random');
      if (kind === 'games') randomGame();
      if (kind === 'articles') randomArticle();
      return;
    }

    if (event.target.closest('#o1hub-music-play')) {
      toggleMusic();
      return;
    }
    if (event.target.closest('#o1hub-music-next')) {
      nextMusic();
    }
  });

  tabs.forEach(function (tab, index) {
    tab.addEventListener('keydown', function (event) {
      var delta = 0;
      if (event.key === 'ArrowRight') delta = 1;
      if (event.key === 'ArrowLeft') delta = -1;
      if (event.key === 'Home') {
        event.preventDefault();
        tabs[0].focus();
        showTab(tabs[0].getAttribute('data-o1hub-tab'));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        tabs[tabs.length - 1].focus();
        showTab(tabs[tabs.length - 1].getAttribute('data-o1hub-tab'));
        return;
      }
      if (!delta) return;
      event.preventDefault();
      var next = (index + delta + tabs.length) % tabs.length;
      tabs[next].focus();
      showTab(tabs[next].getAttribute('data-o1hub-tab'));
    });
  });

  if (window.O1Player) window.O1Player.onChange(followPlayer);

  showTab('oboi');
})();
