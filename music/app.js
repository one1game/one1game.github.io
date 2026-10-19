/* =============================================================
   MUSIC — Audius player.
   Источник: официальный API Audius (CORS: *), app_name=One1Game.
   Аудио не хранится на сайте: только стриминг через API.
   ============================================================= */
(function () {
  'use strict';

  var API = 'https://api.audius.co/v1';
  var APP = 'One1Game';
  var CACHE_TTL = 5 * 60 * 1000;
  var FALLBACK_ART = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1a2433"/><stop offset="1" stop-color="#0a0f16"/></linearGradient></defs>' +
    '<rect width="480" height="480" fill="url(#g)"/>' +
    '<path d="M200 330V190l120-28v140a44 44 0 1 1-24-39V188l-72 17v125a44 44 0 1 1-24-39z" fill="#7dff9b" opacity=".7"/>' +
    '</svg>'
  );

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = {
    trending: [],
    playlists: [],
    currentGenre: '',
    query: '',
    searchTracks: [],
    searchArtists: [],
    searchPlaylists: [],
    searchOffset: 0,
    searchQuery: '',
    view: 'home',
    queue: [],
    index: -1,
    current: null,
    playing: false,
    shuffle: false,
    repeat: 0,
    volume: 0.8,
    muted: false,
    favourites: readStore('music:favs', []),
    history: readStore('music:history', []),
    modalTracks: [],
    modalTitle: ''
  };

  var el = {
    page: $('#music-page'),
    search: $('#music-search'),
    searchClear: $('#music-search-clear'),
    chips: $('#music-chips'),
    trendingGrid: $('#music-trending-grid'),
    trendingTitle: $('#music-trending-title'),
    trendingMore: $('#music-trending-more'),
    playlistsGrid: $('#music-playlists-grid'),
    sectionGenres: $('#music-section-genres'),
    sectionTrending: $('#music-section-trending'),
    sectionPlaylists: $('#music-section-playlists'),
    sectionHistory: $('#music-section-history'),
    historyGrid: $('#music-history-grid'),
    historyClear: $('#music-history-clear'),
    sectionFavs: $('#music-section-favs'),
    favGrid: $('#music-fav-grid'),
    favEmpty: $('#music-fav-empty'),
    favOpen: $('#music-fav-open'),
    favCount: $('#music-fav-count'),
    favClear: $('#music-fav-clear'),
    favBack: $('#music-fav-back'),
    sectionSearch: $('#music-section-search'),
    searchTitle: $('#music-search-title'),
    searchClose: $('#music-search-close'),
    searchTracks: $('#music-search-tracks'),
    searchTracksWrap: $('#music-search-tracks-wrap'),
    searchArtists: $('#music-search-artists'),
    searchArtistsWrap: $('#music-search-artists-wrap'),
    searchPlaylists: $('#music-search-playlists'),
    searchPlaylistsWrap: $('#music-search-playlists-wrap'),
    searchMoreWrap: $('#music-search-more-wrap'),
    searchMore: $('#music-search-more'),
    empty: $('#music-empty'),
    reset: $('#music-reset'),
    random: $('#music-random'),
    updated: $('#music-updated'),
    player: $('#music-player'),
    playerOpen: $('#music-player-open'),
    playerArt: $('#music-player-art'),
    playerTitle: $('#music-player-title'),
    playerArtist: $('#music-player-artist'),
    playerSeek: $('#music-player-seek'),
    playerMobileSeek: $('#music-player-mobile-seek'),
    playerCurrent: $('#music-player-current'),
    playerDuration: $('#music-player-duration'),
    playerVolume: $('#music-player-volume'),
    np: $('#music-np'),
    npClose: $('#music-np-close'),
    npArt: $('#music-np-art'),
    npTitle: $('#music-np-title'),
    npArtist: $('#music-np-artist'),
    npSeek: $('#music-np-seek'),
    npCurrent: $('#music-np-current'),
    npDuration: $('#music-np-duration'),
    npFav: $('#music-np-fav'),
    npShare: $('#music-np-share'),
    npSource: $('#music-np-source'),
    npQueue: $('#music-np-queue-list'),
    queue: $('#music-queue'),
    queueBackdrop: $('#music-queue-backdrop'),
    queueClose: $('#music-queue-close'),
    queueList: $('#music-queue-list'),
    modal: $('#music-modal'),
    modalTitle: $('#music-modal-title'),
    modalBody: $('#music-modal-body'),
    modalClose: $('#music-modal-close'),
    toast: $('#music-toast')
  };

  var audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = state.volume;

  /* ── Storage ─────────────────────────────────────────────── */
  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtCount(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K';
    return String(n);
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove('is-visible'); }, 2600);
  }

  function debounce(fn, ms) {
    var timer = null;
    function wrapped() {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    }
    wrapped.cancel = function () { clearTimeout(timer); };
    return wrapped;
  }

  /* ── API ─────────────────────────────────────────────────── */
  function cacheGet(key) {
    try {
      var raw = sessionStorage.getItem('music:' + key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL) {
        sessionStorage.removeItem('music:' + key);
        return null;
      }
      return parsed.v;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, value) {
    try { sessionStorage.setItem('music:' + key, JSON.stringify({ t: Date.now(), v: value })); } catch (e) {}
  }

  function api(path, params) {
    var query = new URLSearchParams();
    var merged = Object.assign({ app_name: APP }, params || {});
    Object.keys(merged).forEach(function (key) {
      if (merged[key] != null && merged[key] !== '') query.set(key, merged[key]);
    });
    var url = API + path + '?' + query.toString();
    var cached = cacheGet(url);
    if (cached) return Promise.resolve(cached);

    return fetch(url, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('Audius ' + res.status);
        return res.json();
      })
      .then(function (json) {
        cacheSet(url, json);
        return json;
      });
  }

  function normTrack(track) {
    if (!track) return null;
    if (track.is_streamable === false) return null;
    if (track.is_delete || track.is_unlisted) return null;
    if (track.is_available === false) return null;
    if (track.is_stream_gated) return null;
    if (track.access && track.access.stream === false) return null;

    var art = '';
    if (track.artwork) art = track.artwork['480x480'] || track.artwork['1000x1000'] || track.artwork['150x150'] || '';
    var user = track.user || {};
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
    var art = '';
    if (playlist.artwork) art = playlist.artwork['480x480'] || playlist.artwork['1000x1000'] || playlist.artwork['150x150'] || '';
    var user = playlist.user || {};
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

  function normArtist(user) {
    var art = '';
    if (user.profile_picture) art = user.profile_picture['480x480'] || user.profile_picture['1000x1000'] || user.profile_picture['150x150'] || '';
    return {
      id: user.id,
      name: user.name || user.handle || 'Артист',
      handle: user.handle || '',
      followers: Number(user.follower_count) || 0,
      trackCount: Number(user.track_count) || 0,
      artwork: art,
      page: 'https://audius.co/' + (user.handle || ''),
      bio: user.bio || ''
    };
  }

  function tracksFrom(json) {
    return (json && json.data ? json.data : []).map(normTrack).filter(Boolean);
  }

  function loadTrending(genre) {
    return api('/tracks/trending', {
      genre: genre || '',
      time: 'week',
      limit: 24
    }).then(tracksFrom);
  }

  function loadPlaylists() {
    return api('/playlists/trending', { time: 'week', limit: 12 }).then(function (json) {
      return (json && json.data ? json.data : []).map(normPlaylist).filter(Boolean);
    });
  }

  function loadPlaylistTracks(id) {
    return api('/playlists/' + encodeURIComponent(id) + '/tracks', { limit: 100 }).then(tracksFrom);
  }

  function loadArtistTracks(id) {
    return api('/users/' + encodeURIComponent(id) + '/tracks', { limit: 50 }).then(tracksFrom);
  }

  function loadArtist(id) {
    return api('/users/' + encodeURIComponent(id), {}).then(function (json) {
      return json && json.data ? normArtist(json.data) : null;
    });
  }

  function searchAll(query) {
    return Promise.all([
      api('/tracks/search', { query: query, limit: 24, offset: 0 }),
      api('/users/search', { query: query, limit: 12 }),
      api('/playlists/search', { query: query, limit: 12 })
    ]).then(function (results) {
      return {
        tracks: tracksFrom(results[0]),
        artists: (results[1].data || []).map(normArtist).filter(Boolean),
        playlists: (results[2].data || []).map(normPlaylist).filter(Boolean)
      };
    });
  }

  function searchTracksMore(query, offset) {
    return api('/tracks/search', { query: query, limit: 24, offset: offset }).then(tracksFrom);
  }

  /* ── Render helpers ──────────────────────────────────────── */
  function artUrl(value) {
    return value ? value : FALLBACK_ART;
  }

  function trackCard(track) {
    var liked = isFavourite(track.id);
    var playing = state.current && state.current.id === track.id;
    return '' +
      '<article class="music-card' + (playing ? ' is-playing' : '') + '" data-track-id="' + esc(track.id) + '">' +
        '<div class="music-card__art" data-play="' + esc(track.id) + '">' +
          '<img src="' + esc(artUrl(track.artwork)) + '" alt="' + esc(track.title + ' — ' + track.artist) + '" loading="lazy" decoding="async" data-art>' +
          '<button type="button" class="music-card__play" data-play="' + esc(track.id) + '" aria-label="Слушать ' + esc(track.title) + '"><i class="fas fa-play" aria-hidden="true"></i></button>' +
          '<button type="button" class="music-card__like' + (liked ? ' is-active' : '') + '" data-like="' + esc(track.id) + '" aria-label="' + (liked ? 'Убрать из избранного' : 'В избранное') + '" aria-pressed="' + (liked ? 'true' : 'false') + '"><i class="' + (liked ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i></button>' +
        '</div>' +
        '<div class="music-card__body">' +
          '<span class="music-card__title">' + esc(track.title) + '</span>' +
          '<span class="music-card__artist" data-artist="' + esc(track.artistId) + '">' + esc(track.artist) + '</span>' +
          '<span class="music-card__meta"><span>' + esc(track.genre || 'Музыка') + '</span><span>' + fmtTime(track.duration) + '</span></span>' +
        '</div>' +
      '</article>';
  }

  function playlistCard(playlist) {
    return '' +
      '<button type="button" class="music-playlist" data-playlist="' + esc(playlist.id) + '">' +
        '<img class="music-playlist__art" src="' + esc(artUrl(playlist.artwork)) + '" alt="' + esc(playlist.title) + '" loading="lazy" decoding="async">' +
        '<span class="music-playlist__body">' +
          '<span class="music-playlist__title">' + esc(playlist.title) + '</span>' +
          '<span class="music-playlist__meta">' + esc(playlist.artist || 'One1Game') + '<br>' + playlist.trackCount + ' треков · ' + fmtCount(playlist.plays) + ' прослушиваний</span>' +
        '</span>' +
      '</button>';
  }

  function artistCard(artist) {
    return '' +
      '<button type="button" class="music-artist" data-artist="' + esc(artist.id) + '">' +
        '<img src="' + esc(artUrl(artist.artwork)) + '" alt="' + esc(artist.name) + '" loading="lazy" decoding="async">' +
        '<span><b>' + esc(artist.name) + '</b><span>' + fmtCount(artist.followers) + ' подписчиков</span></span>' +
      '</button>';
  }

  function renderTrending() {
    if (state.view === 'home' && state.trending.length) {
      el.trendingGrid.innerHTML = state.trending.map(trackCard).join('');
    }
  }

  function renderPlaylists() {
    if (el.playlistsGrid && state.playlists.length) {
      el.playlistsGrid.innerHTML = state.playlists.map(playlistCard).join('');
    }
  }

  function renderHistory() {
    if (!el.sectionHistory) return;
    if (!state.history.length) {
      el.sectionHistory.classList.add('music-hidden');
      return;
    }
    el.sectionHistory.classList.remove('music-hidden');
    el.historyGrid.innerHTML = state.history.slice(0, 10).map(trackCard).join('');
  }

  function renderFavs() {
    if (!el.sectionFavs) return;
    var has = state.favourites.length > 0;
    el.favGrid.innerHTML = has ? state.favourites.map(trackCard).join('') : '';
    el.favEmpty.classList.toggle('music-hidden', has);
    el.favGrid.classList.toggle('music-hidden', !has);
  }

  function renderSearch() {
    var tracks = state.searchTracks;
    el.searchTracksWrap.classList.toggle('music-hidden', !tracks.length);
    el.searchArtistsWrap.classList.toggle('music-hidden', !state.searchArtists.length);
    el.searchPlaylistsWrap.classList.toggle('music-hidden', !state.searchPlaylists.length);
    el.searchTracks.innerHTML = tracks.map(trackCard).join('');
    el.searchArtists.innerHTML = state.searchArtists.map(artistCard).join('');
    el.searchPlaylists.innerHTML = state.searchPlaylists.map(playlistCard).join('');
    el.searchMoreWrap.classList.toggle('music-hidden', tracks.length < 24);
    el.empty.classList.toggle('music-hidden', !!(tracks.length || state.searchArtists.length || state.searchPlaylists.length));
  }

  function renderQueue() {
    if (!el.queueList) return;
    if (!state.queue.length) {
      el.queueList.innerHTML = '<p class="music-queue__empty">Очередь пуста. Включите трек из подборки.</p>';
    } else {
      el.queueList.innerHTML = state.queue.map(function (track, index) {
        return '' +
          '<button type="button" class="music-queue__item' + (index === state.index ? ' is-current' : '') + '" data-queue-index="' + index + '">' +
            '<img src="' + esc(artUrl(track.artwork)) + '" alt="" loading="lazy">' +
            '<span class="music-queue__body"><b>' + esc(track.title) + '</b><span>' + esc(track.artist) + ' · ' + fmtTime(track.duration) + '</span></span>' +
          '</button>';
      }).join('');
    }
    if (el.npQueue) {
      el.npQueue.innerHTML = state.queue.length ? state.queue.map(function (track, index) {
        return '' +
          '<button type="button" class="music-modal__item' + (index === state.index ? ' is-current' : '') + '" data-queue-index="' + index + '">' +
            '<img src="' + esc(artUrl(track.artwork)) + '" alt="" loading="lazy">' +
            '<span><b>' + esc(track.title) + '</b><span>' + esc(track.artist) + '</span></span>' +
          '</button>';
      }).join('') : '<p class="music-queue__empty">Очередь пуста.</p>';
    }
  }

  function updatePlayingCards() {
    $$('.music-card').forEach(function (card) {
      var id = card.getAttribute('data-track-id');
      card.classList.toggle('is-playing', !!(state.current && state.current.id === id));
    });
  }

  function updateFavUI() {
    var count = state.favourites.length;
    if (el.favCount) {
      el.favCount.textContent = String(count);
      el.favCount.hidden = count === 0;
    }
    if (el.favOpen) el.favOpen.setAttribute('aria-pressed', state.view === 'favs' ? 'true' : 'false');

    $$('[data-like]').forEach(function (btn) {
      var id = btn.getAttribute('data-like');
      var active = isFavourite(id);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.setAttribute('aria-label', active ? 'Убрать из избранного' : 'В избранное');
      btn.innerHTML = '<i class="' + (active ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i>';
    });
    $$('[data-music-fav]').forEach(function (btn) {
      var active = state.current && isFavourite(state.current.id);
      btn.classList.toggle('is-active', !!active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.innerHTML = '<i class="' + (active ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i>';
    });
    updateNpFav();
  }

  function updateNpFav() {
    if (!el.npFav) return;
    var active = state.current && isFavourite(state.current.id);
    el.npFav.classList.toggle('is-active', !!active);
    el.npFav.innerHTML = '<i class="' + (active ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i> ' + (active ? 'В избранном' : 'В избранное');
  }

  function isFavourite(id) {
    return state.favourites.some(function (track) { return track.id === id; });
  }

  function findTrack(id) {
    var pools = [state.trending, state.history, state.favourites, state.searchTracks, state.queue, state.modalTracks];
    for (var i = 0; i < pools.length; i++) {
      var found = pools[i].filter(function (track) { return track.id === id; })[0];
      if (found) return found;
    }
    return null;
  }

  /* ── Views ───────────────────────────────────────────────── */
  function setView(view) {
    state.view = view;
    var isHome = view === 'home';
    var isSearch = view === 'search';
    var isFavs = view === 'favs';
    el.sectionGenres.classList.toggle('music-hidden', !isHome);
    el.sectionTrending.classList.toggle('music-hidden', !isHome);
    el.sectionPlaylists.classList.toggle('music-hidden', !isHome);
    el.sectionSearch.classList.toggle('music-hidden', !isSearch);
    el.sectionFavs.classList.toggle('music-hidden', !isFavs);
    el.sectionHistory.classList.toggle('music-hidden', !isHome || !state.history.length);
    el.empty.classList.add('music-hidden');
    if (!isHome) el.sectionHistory.classList.add('music-hidden');
    if (isFavs) {
      renderFavs();
      el.sectionHistory.classList.add('music-hidden');
    }
    if (el.favOpen) el.favOpen.classList.toggle('is-active', isFavs);
    updateFavUI();
  }

  function showHome() {
    state.query = '';
    state.searchQuery = '';
    el.search.value = '';
    el.searchClear.classList.remove('is-visible');
    syncChips();
    setView('home');
    renderTrending();
    renderPlaylists();
    renderHistory();
    if (el.updated && state.generatedAt) {
      el.updated.textContent = 'Обновлено ' + state.generatedAt + ' · подборки обновляются ежедневно';
    }
  }

  function showFavs() {
    setView('favs');
    renderFavs();
  }

  /* ── Player ──────────────────────────────────────────────── */
  function setQueue(tracks, index) {
    state.queue = tracks.slice();
    state.index = typeof index === 'number' ? index : 0;
  }

  function playTrack(track, tracks, index) {
    if (!track) return;
    if (tracks && tracks.length) setQueue(tracks, typeof index === 'number' ? index : tracks.indexOf(track));
    else if (!state.queue.length) setQueue([track], 0);
    state.current = track;
    state.index = state.queue.findIndex(function (item) { return item.id === track.id; });
    if (state.index < 0) {
      state.queue.unshift(track);
      state.index = 0;
    }
    audio.src = track.stream;
    audio.play().catch(function () {
      toast('Не удалось включить трек. Попробуйте другой.');
    });
    updatePlayerUI();
    addHistory(track);
    updatePlayingCards();
    renderQueue();
    updateMediaSession();
  }

  function togglePlay() {
    if (!state.current) {
      if (state.queue.length) {
        playTrack(state.queue[state.index >= 0 ? state.index : 0]);
      } else if (state.trending.length) {
        playTrack(state.trending[0], state.trending, 0);
      } else {
        toast('Выберите трек');
      }
      return;
    }
    if (audio.paused) {
      audio.play().catch(function () { toast('Не удалось продолжить воспроизведение'); });
    } else {
      audio.pause();
    }
  }

  function nextTrack(auto) {
    if (!state.queue.length) return;
    if (state.shuffle && state.queue.length > 1) {
      var random = state.index;
      while (random === state.index) random = Math.floor(Math.random() * state.queue.length);
      state.index = random;
    } else if (state.index < state.queue.length - 1) {
      state.index += 1;
    } else if (state.repeat === 1 || auto === false) {
      state.index = 0;
    } else {
      audio.pause();
      return;
    }
    playTrack(state.queue[state.index], state.queue, state.index);
  }

  function prevTrack() {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    state.index = state.index > 0 ? state.index - 1 : state.queue.length - 1;
    playTrack(state.queue[state.index], state.queue, state.index);
  }

  function updatePlayerUI() {
    if (!state.current) return;
    var track = state.current;
    if (el.playerArt) el.playerArt.src = artUrl(track.artwork);
    if (el.playerTitle) el.playerTitle.textContent = track.title;
    if (el.playerArtist) el.playerArtist.textContent = track.artist;
    if (el.npArt) el.npArt.src = artUrl(track.artwork);
    if (el.npTitle) el.npTitle.textContent = track.title;
    if (el.npArtist) el.npArtist.textContent = track.artist;
    if (el.npSource) el.npSource.href = track.page;
    el.player.classList.add('is-visible');
    document.body.classList.add('music-has-track');
    updateDurationUI();
    updateNpFav();
    updatePlayingCards();
    renderQueue();
  }

  function updateDurationUI() {
    var duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (state.current ? state.current.duration : 0);
    setSeekMax(duration);
    setTimeLabels(audio.currentTime || 0, duration);
  }

  function setSeekMax(duration) {
    [el.playerSeek, el.playerMobileSeek, el.npSeek].forEach(function (input) {
      if (!input) return;
      input.max = String(duration || 0);
    });
  }

  function setSeekValue(value) {
    [el.playerSeek, el.playerMobileSeek, el.npSeek].forEach(function (input) {
      if (input && document.activeElement !== input) input.value = String(value || 0);
    });
  }

  function setTimeLabels(current, duration) {
    var cur = fmtTime(current);
    var dur = fmtTime(duration);
    [el.playerCurrent, el.npCurrent].forEach(function (node) { if (node) node.textContent = cur; });
    [el.playerDuration, el.npDuration].forEach(function (node) { if (node) node.textContent = dur; });
  }

  function updatePlayButtons() {
    var icon = state.playing ? 'fa-pause' : 'fa-play';
    var label = state.playing ? 'Пауза' : 'Играть';
    $$('[data-music-play]').forEach(function (btn) {
      btn.innerHTML = '<i class="fas ' + icon + '" aria-hidden="true"></i>';
      btn.setAttribute('aria-label', label);
    });
    el.player.classList.toggle('is-playing', state.playing);
  }

  function updateShuffleRepeat() {
    $$('[data-music-shuffle]').forEach(function (btn) {
      btn.classList.toggle('is-active', state.shuffle);
      btn.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false');
    });
    $$('[data-music-repeat]').forEach(function (btn) {
      btn.classList.toggle('is-active', state.repeat > 0);
      btn.setAttribute('aria-label', state.repeat === 0 ? 'Повтор выключен' : state.repeat === 1 ? 'Повтор всех' : 'Повтор одного');
      btn.innerHTML = '<i class="fas ' + (state.repeat === 2 ? 'fa-repeat-1' : 'fa-repeat') + '" aria-hidden="true"></i>';
    });
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: state.current.title,
        artist: state.current.artist,
        album: 'One1Game',
        artwork: [{ src: artUrl(state.current.artwork), sizes: '480x480', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', function () { nextTrack(false); });
      navigator.mediaSession.setActionHandler('seekto', function (details) {
        if (typeof details.seekTime === 'number') audio.currentTime = details.seekTime;
      });
    } catch (e) {}
  }

  function addHistory(track) {
    state.history = state.history.filter(function (item) { return item.id !== track.id; });
    state.history.unshift(track);
    state.history = state.history.slice(0, 30);
    writeStore('music:history', state.history);
    renderHistory();
  }

  function toggleFavourite(track) {
    if (!track) return;
    var exists = isFavourite(track.id);
    if (exists) {
      state.favourites = state.favourites.filter(function (item) { return item.id !== track.id; });
      toast('Убрано из избранного');
    } else {
      state.favourites.unshift(track);
      toast('Добавлено в избранное');
    }
    writeStore('music:favs', state.favourites);
    updateFavUI();
    if (state.view === 'favs') renderFavs();
  }

  /* ── Queue / modal / now playing ────────────────────────── */
  function syncOverlay() {
    var open = el.np.classList.contains('is-open') ||
      el.queue.classList.contains('is-open') ||
      el.modal.classList.contains('is-open');
    document.body.classList.toggle('music-overlay', open);
  }

  function openQueue() {
    el.queue.classList.add('is-open');
    el.queueBackdrop.classList.add('is-open');
    el.queue.setAttribute('aria-hidden', 'false');
    syncOverlay();
    renderQueue();
  }

  function closeQueue() {
    el.queue.classList.remove('is-open');
    el.queueBackdrop.classList.remove('is-open');
    el.queue.setAttribute('aria-hidden', 'true');
    syncOverlay();
  }

  function openNp() {
    if (!state.current) return;
    el.np.classList.add('is-open');
    el.np.setAttribute('aria-hidden', 'false');
    syncOverlay();
    updatePlayerUI();
    renderQueue();
  }

  function closeNp() {
    el.np.classList.remove('is-open');
    el.np.setAttribute('aria-hidden', 'true');
    syncOverlay();
  }

  function openModal(title) {
    state.modalTitle = title || '';
    el.modalTitle.textContent = title || '—';
    el.modal.classList.add('is-open');
    syncOverlay();
  }

  function closeModal() {
    el.modal.classList.remove('is-open');
    syncOverlay();
  }

  function openArtist(id) {
    if (!id) return;
    openModal('Артист');
    el.modalBody.innerHTML = '<div class="music-queue__empty">Загрузка…</div>';
    Promise.all([loadArtist(id), loadArtistTracks(id)]).then(function (results) {
      var artist = results[0];
      var tracks = results[1];
      state.modalTracks = tracks;
      if (!artist && !tracks.length) {
        el.modalBody.innerHTML = '<p class="music-queue__empty">Не удалось загрузить артиста.</p>';
        return;
      }
      var name = artist ? artist.name : (tracks[0] ? tracks[0].artist : 'Артист');
      el.modalTitle.textContent = name;
      el.modalBody.innerHTML = '' +
        '<div class="music-modal__hero">' +
          '<img src="' + esc(artUrl(artist && artist.artwork)) + '" alt="' + esc(name) + '">' +
          '<div><h3>' + esc(name) + '</h3><p>' + (artist ? fmtCount(artist.followers) + ' подписчиков · ' + artist.trackCount + ' треков' : '') + '</p></div>' +
        '</div>' +
        '<div class="music-modal__actions">' +
          '<button type="button" class="is-primary" data-modal-play-all><i class="fas fa-play"></i> Слушать всё</button>' +
          (artist && artist.page ? '<a href="' + esc(artist.page) + '" target="_blank" rel="noopener nofollow"><i class="fas fa-arrow-up-right-from-square"></i> Audius</a>' : '') +
        '</div>' +
        '<div class="music-modal__list">' + tracks.map(function (track, index) {
          return '<button type="button" class="music-modal__item" data-modal-track="' + index + '">' +
            '<img src="' + esc(artUrl(track.artwork)) + '" alt="" loading="lazy">' +
            '<span><b>' + esc(track.title) + '</b><span>' + esc(track.artist) + ' · ' + fmtTime(track.duration) + '</span></span>' +
          '</button>';
        }).join('') + '</div>';
    }).catch(function () {
      el.modalBody.innerHTML = '<p class="music-queue__empty">Ошибка загрузки. Попробуйте позже.</p>';
    });
  }

  function openPlaylist(id) {
    if (!id) return;
    openModal('Плейлист');
    el.modalBody.innerHTML = '<div class="music-queue__empty">Загрузка…</div>';
    loadPlaylistTracks(id).then(function (tracks) {
      state.modalTracks = tracks;
      var playlist = state.playlists.filter(function (item) { return item.id === id; })[0];
      if (!playlist) {
        playlist = state.searchPlaylists.filter(function (item) { return item.id === id; })[0];
      }
      var title = playlist ? playlist.title : 'Плейлист';
      el.modalTitle.textContent = title;
      el.modalBody.innerHTML = '' +
        '<div class="music-modal__hero">' +
          '<img src="' + esc(artUrl(playlist && playlist.artwork)) + '" alt="' + esc(title) + '">' +
          '<div><h3>' + esc(title) + '</h3><p>' + tracks.length + ' треков · ' + (playlist ? fmtCount(playlist.plays) + ' прослушиваний' : 'каталог') + '</p></div>' +
        '</div>' +
        '<div class="music-modal__actions">' +
          '<button type="button" class="is-primary" data-modal-play-all><i class="fas fa-play"></i> Слушать всё</button>' +
          (playlist && playlist.page ? '<a href="' + esc(playlist.page) + '" target="_blank" rel="noopener nofollow"><i class="fas fa-arrow-up-right-from-square"></i> Audius</a>' : '') +
        '</div>' +
        '<div class="music-modal__list">' + tracks.map(function (track, index) {
          return '<button type="button" class="music-modal__item" data-modal-track="' + index + '">' +
            '<img src="' + esc(artUrl(track.artwork)) + '" alt="" loading="lazy">' +
            '<span><b>' + esc(track.title) + '</b><span>' + esc(track.artist) + ' · ' + fmtTime(track.duration) + '</span></span>' +
          '</button>';
        }).join('') + '</div>';
    }).catch(function () {
      el.modalBody.innerHTML = '<p class="music-queue__empty">Ошибка загрузки. Попробуйте позже.</p>';
    });
  }

  /* ── Search / genre ─────────────────────────────────────── */
  function skeletonTracks(container, count) {
    if (!container) return;
    var html = '';
    for (var i = 0; i < (count || 10); i++) html += '<div class="music-skeleton" aria-hidden="true"></div>';
    container.innerHTML = html;
  }

  function runSearch(query, append) {
    query = (query || '').trim();
    if (!query) {
      showHome();
      return;
    }
    state.query = query;
    state.searchQuery = query;
    setView('search');
    syncChips();
    el.searchTitle.textContent = 'Поиск: ' + query;
    if (!append) {
      state.searchTracks = [];
      state.searchArtists = [];
      state.searchPlaylists = [];
      state.searchOffset = 0;
      skeletonTracks(el.searchTracks, 10);
      el.searchArtists.innerHTML = '';
      el.searchPlaylists.innerHTML = '';
      el.searchTracksWrap.classList.remove('music-hidden');
      el.searchArtistsWrap.classList.add('music-hidden');
      el.searchPlaylistsWrap.classList.add('music-hidden');
      el.searchMoreWrap.classList.add('music-hidden');
      el.empty.classList.add('music-hidden');
    } else {
      state.searchOffset += 24;
    }

    var request = append
      ? searchTracksMore(query, state.searchOffset).then(function (tracks) { return { tracks: tracks, artists: [], playlists: [] }; })
      : searchAll(query);

    request.then(function (result) {
      if (append) state.searchTracks = state.searchTracks.concat(result.tracks);
      else {
        state.searchTracks = result.tracks;
        state.searchArtists = result.artists;
        state.searchPlaylists = result.playlists;
      }
      renderSearch();
    }).catch(function () {
      toast('Не удалось выполнить поиск');
      if (!append) {
        el.searchTracks.innerHTML = '';
        el.empty.classList.remove('music-hidden');
      }
    });
  }

  var PAGE_FOR_GENRE = {
    'Lo-Fi': 'lofi',
    'Electronic': 'electronic',
    'Hip-Hop/Rap': 'hip-hop',
    'Rock': 'rock',
    'Ambient': 'chill'
  };

  function loadGenre(genre) {
    state.currentGenre = genre || '';
    state.query = '';
    state.searchQuery = '';
    el.search.value = '';
    el.searchClear.classList.remove('is-visible');
    syncChips();
    setView('home');
    el.trendingTitle.textContent = genre ? 'Жанр: ' + genre : 'Сейчас в тренде';
    skeletonTracks(el.trendingGrid, 10);
    var local = state.genres && (state.genres[genre] || state.genres[PAGE_FOR_GENRE[genre]]);
    if (local && local.length) {
      state.trending = local;
      el.trendingGrid.innerHTML = local.map(trackCard).join('');
      el.sectionTrending.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    loadTrending(genre).then(function (tracks) {
      state.trending = tracks;
      el.trendingGrid.innerHTML = tracks.map(trackCard).join('');
      if (!tracks.length) el.trendingGrid.innerHTML = '<p class="music-queue__empty">В этом жанре пока нет треков.</p>';
      el.sectionTrending.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      el.trendingGrid.innerHTML = '<p class="music-queue__empty">Не удалось загрузить жанр.</p>';
    });
  }

  function syncChips() {
    $$('.music-chip', el.chips).forEach(function (chip) {
      var genre = chip.getAttribute('data-genre') || '';
      chip.classList.toggle('is-active', genre === state.currentGenre && !state.query);
    });
  }

  /* ── Events ─────────────────────────────────────────────── */
  function bind() {
    var doSearch = debounce(function () {
      runSearch(el.search.value, false);
    }, 450);

    el.search.addEventListener('input', function () {
      el.searchClear.classList.toggle('is-visible', !!el.search.value.trim());
      doSearch();
    });
    el.search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch.cancel();
        runSearch(el.search.value, false);
      }
    });
    el.searchClear.addEventListener('click', function () {
      doSearch.cancel();
      el.search.value = '';
      el.searchClear.classList.remove('is-visible');
      showHome();
      el.search.focus();
    });
    el.searchClose.addEventListener('click', showHome);
    el.searchMore.addEventListener('click', function () {
      if (state.searchQuery) runSearch(state.searchQuery, true);
    });
    el.reset.addEventListener('click', showHome);

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.music-chip');
      if (!chip) return;
      doSearch.cancel();
      loadGenre(chip.getAttribute('data-genre') || '');
    });

    el.trendingMore.addEventListener('click', function () {
      loadGenre(state.currentGenre);
    });

    el.favOpen.addEventListener('click', function () {
      if (state.view === 'favs') showHome();
      else showFavs();
    });
    el.favBack.addEventListener('click', showHome);
    el.favClear.addEventListener('click', function () {
      state.favourites = [];
      writeStore('music:favs', state.favourites);
      updateFavUI();
      renderFavs();
      toast('Избранное очищено');
    });
    el.historyClear.addEventListener('click', function () {
      state.history = [];
      writeStore('music:history', state.history);
      renderHistory();
      toast('История очищена');
    });

    el.random.addEventListener('click', function () {
      var pool = state.trending.length ? state.trending : state.searchTracks;
      if (!pool.length) pool = state.history;
      if (!pool.length) {
        toast('Подборка ещё загружается');
        return;
      }
      var track = pool[Math.floor(Math.random() * pool.length)];
      playTrack(track, pool, pool.indexOf(track));
      toast('Случайный трек');
    });

    // Карточки и кнопки в динамическом контенте.
    document.addEventListener('click', function (e) {
      var like = e.target.closest('[data-like]');
      if (like) {
        e.preventDefault();
        e.stopPropagation();
        var likedTrack = findTrack(like.getAttribute('data-like'));
        if (likedTrack) toggleFavourite(likedTrack);
        return;
      }
      var play = e.target.closest('[data-play]');
      if (play) {
        e.preventDefault();
        e.stopPropagation();
        var track = findTrack(play.getAttribute('data-play'));
        if (!track) return;
        var pool = state.view === 'search' ? state.searchTracks : state.view === 'favs' ? state.favourites : state.trending;
        if (!pool || !pool.length) pool = state.queue;
        playTrack(track, pool, pool.indexOf(track));
        return;
      }
      var artist = e.target.closest('[data-artist]');
      if (artist) {
        e.preventDefault();
        e.stopPropagation();
        if (artist.getAttribute('data-artist')) openArtist(artist.getAttribute('data-artist'));
        return;
      }
      var playlist = e.target.closest('[data-playlist]');
      if (playlist) {
        e.preventDefault();
        openPlaylist(playlist.getAttribute('data-playlist'));
        return;
      }
      var modalTrack = e.target.closest('[data-modal-track]');
      if (modalTrack) {
        e.preventDefault();
        var idx = Number(modalTrack.getAttribute('data-modal-track'));
        if (state.modalTracks[idx]) playTrack(state.modalTracks[idx], state.modalTracks, idx);
        return;
      }
      var playAll = e.target.closest('[data-modal-play-all]');
      if (playAll) {
        e.preventDefault();
        if (state.modalTracks.length) playTrack(state.modalTracks[0], state.modalTracks, 0);
        return;
      }
      var queueIndex = e.target.closest('[data-queue-index]');
      if (queueIndex) {
        e.preventDefault();
        var qi = Number(queueIndex.getAttribute('data-queue-index'));
        if (state.queue[qi]) playTrack(state.queue[qi], state.queue, qi);
      }
    });

    // Player controls.
    $$('[data-music-play]').forEach(function (btn) { btn.addEventListener('click', togglePlay); });
    $$('[data-music-prev]').forEach(function (btn) { btn.addEventListener('click', prevTrack); });
    $$('[data-music-next]').forEach(function (btn) { btn.addEventListener('click', function () { nextTrack(false); }); });
    $$('[data-music-shuffle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.shuffle = !state.shuffle;
        updateShuffleRepeat();
        toast(state.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
      });
    });
    $$('[data-music-repeat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.repeat = (state.repeat + 1) % 3;
        updateShuffleRepeat();
        toast(state.repeat === 0 ? 'Повтор выключен' : state.repeat === 1 ? 'Повтор всех' : 'Повтор одного');
      });
    });
    $$('[data-music-fav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.current) toggleFavourite(state.current);
      });
    });
    $$('[data-music-queue]').forEach(function (btn) { btn.addEventListener('click', openQueue); });
    $$('[data-music-mute]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.muted = !state.muted;
        audio.muted = state.muted;
        btn.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');
        btn.innerHTML = '<i class="fas ' + (state.muted ? 'fa-volume-xmark' : 'fa-volume-high') + '" aria-hidden="true"></i>';
      });
    });

    el.playerOpen.addEventListener('click', openNp);
    el.npClose.addEventListener('click', closeNp);
    el.npFav.addEventListener('click', function () {
      if (state.current) toggleFavourite(state.current);
    });
    el.npShare.addEventListener('click', function () {
      if (!state.current) return;
      var url = location.origin + '/music/?track=' + encodeURIComponent(state.current.id);
      if (navigator.share) {
        navigator.share({ title: state.current.title + ' — ' + state.current.artist, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('Ссылка скопирована'); }).catch(function () { toast(url); });
      } else {
        toast(url);
      }
    });

    el.queueClose.addEventListener('click', closeQueue);
    el.queueBackdrop.addEventListener('click', closeQueue);
    el.modalClose.addEventListener('click', closeModal);
    el.modal.addEventListener('click', function (e) { if (e.target === el.modal) closeModal(); });

    // Seek and volume.
    [el.playerSeek, el.playerMobileSeek, el.npSeek].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        var value = Number(input.value) || 0;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = Math.min(value, audio.duration);
        }
        setSeekValue(value);
      });
    });
    el.playerVolume.addEventListener('input', function () {
      state.volume = Number(el.playerVolume.value) || 0;
      state.muted = state.volume === 0;
      audio.volume = state.volume;
      audio.muted = state.muted;
      try { localStorage.setItem('music:volume', String(state.volume)); } catch (e) {}
    });

    // Audio events.
    audio.addEventListener('play', function () { state.playing = true; updatePlayButtons(); });
    audio.addEventListener('pause', function () { state.playing = false; updatePlayButtons(); });
    audio.addEventListener('loadedmetadata', function () { updateDurationUI(); });
    audio.addEventListener('durationchange', function () { updateDurationUI(); });
    audio.addEventListener('timeupdate', function () {
      setSeekValue(audio.currentTime);
      var duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (state.current ? state.current.duration : 0);
      setTimeLabels(audio.currentTime, duration);
    });
    audio.addEventListener('ended', function () {
      if (state.repeat === 2) {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack(true);
      }
    });
    audio.addEventListener('error', function () {
      toast('Трек недоступен, включаю следующий');
      setTimeout(function () { nextTrack(true); }, 800);
    });

    // Keyboard.
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && state.current) {
        audio.currentTime = Math.min((audio.currentTime || 0) + 5, audio.duration || 0);
      } else if (e.key === 'ArrowLeft' && state.current) {
        audio.currentTime = Math.max((audio.currentTime || 0) - 5, 0);
      } else if (e.key === 'Escape') {
        closeNp();
        closeQueue();
        closeModal();
      } else if (e.key.toLowerCase() === 'm') {
        state.muted = !state.muted;
        audio.muted = state.muted;
      }
    });

    window.addEventListener('beforeunload', function () { audio.pause(); });
  }

  /* ── Init ───────────────────────────────────────────────── */
  function loadData() {
    return fetch('/music/data.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) throw new Error('no data');
        state.trending = (data.trending || []).map(normTrack).filter(Boolean);
        state.playlists = (data.playlists || []).map(normPlaylist).filter(Boolean);
        state.genres = {};
        Object.keys(data.genres || {}).forEach(function (key) {
          state.genres[key] = (data.genres[key] || []).map(normTrack).filter(Boolean);
        });
        if (data.generatedAt) {
          state.generatedAt = data.generatedAt;
          var date = new Date(data.generatedAt);
          if (!isNaN(date.getTime())) el.updated.textContent = 'Обновлено ' + date.toLocaleDateString('ru-RU') + ' · подборки обновляются ежедневно';
        }
        renderTrending();
        renderPlaylists();
      })
      .catch(function () {
        return loadTrending('').then(function (tracks) {
          state.trending = tracks;
          renderTrending();
        });
      });
  }

  function handleDeepLink() {
    var params = new URLSearchParams(location.search);
    var pageGenre = el.page ? (el.page.getAttribute('data-genre') || '') : '';
    var pageKey = el.page ? (el.page.getAttribute('data-genre-key') || '') : '';
    var genre = params.get('genre') || pageGenre;
    var query = params.get('q') || '';
    var trackId = params.get('track') || '';
    var playlistId = params.get('playlist') || '';
    var artistId = params.get('artist') || '';

    if (!params.get('genre') && pageKey && state.genres && state.genres[pageKey] && state.genres[pageKey].length) {
      state.currentGenre = genre;
      state.trending = state.genres[pageKey].slice();
      renderTrending();
      syncChips();
    } else if (genre) {
      var found = Object.keys(state.genres || {}).filter(function (key) {
        return key.toLowerCase() === genre.toLowerCase();
      })[0];
      loadGenre(found || genre);
    }
    if (query) {
      el.search.value = query;
      el.searchClear.classList.add('is-visible');
      runSearch(query, false);
    }
    if (trackId) {
      var track = findTrack(trackId);
      if (track) playTrack(track, state.trending, state.trending.indexOf(track));
      else {
        api('/tracks/' + encodeURIComponent(trackId), {}).then(function (json) {
          var loaded = normTrack(json && json.data);
          if (loaded) playTrack(loaded, [loaded], 0);
        }).catch(function () {});
      }
    }
    if (playlistId) openPlaylist(playlistId);
    if (artistId) openArtist(artistId);
  }

  function init() {
    try {
      var savedVolume = localStorage.getItem('music:volume');
      if (savedVolume != null) {
        state.volume = Math.min(1, Math.max(0, Number(savedVolume) || 0.8));
        audio.volume = state.volume;
        el.playerVolume.value = state.volume;
      }
    } catch (e) {}

    bind();
    updateFavUI();
    updateShuffleRepeat();
    updatePlayButtons();
    renderHistory();
    setView('home');
    loadData().then(function () {
      handleDeepLink();
      if (state.current) el.player.classList.add('is-visible');
    });
  }

  init();
})();
