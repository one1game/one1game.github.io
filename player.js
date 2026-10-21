/* =============================================================
   O1PLAYER — сквозной мини-плеер One1Game.
   Музыка не обрывается при переходах: трек, очередь, позиция и
   громкость лежат в localStorage, на новой странице плеер поднимается
   сам и продолжает с того же места.
   На страницах /music/* воспроизведением владеет music/app.js —
   там плеер не рисует свою панель и не создаёт второй <audio>,
   а только принимает состояние через O1Player.sync().
   ============================================================= */
(function () {
  'use strict';
  if (window.O1Player) return;

  var KEY = 'o1g:player';
  var VOL_KEY = 'o1g:player:vol';
  var MAX_AGE = 6 * 60 * 60 * 1000;

  var path = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  var ownedByPage = path === '/music' || path.indexOf('/music/') === 0;

  var FALLBACK_ART = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1a2433"/><stop offset="1" stop-color="#0a0f16"/></linearGradient></defs>' +
    '<rect width="96" height="96" fill="url(#g)"/>' +
    '<path d="M40 66V38l24-6v28a9 9 0 1 1-5-8V38l-14 3.5V64a9 9 0 1 1-5-8z" fill="#7dff9b" opacity=".7"/>' +
    '</svg>'
  );

  var CSS = [
    '.o1p{position:fixed;left:0;right:0;bottom:env(safe-area-inset-bottom,0px);z-index:640;',
    'display:flex;flex-direction:column;background:rgba(7,10,16,.97);',
    'border-top:1px solid rgba(125,255,155,.16);',
    '-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);',
    'box-shadow:0 -10px 30px rgba(0,0,0,.35);',
    'transform:translateY(120%);opacity:0;pointer-events:none;',
    'transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s ease;',
    'font-family:var(--mono,ui-monospace,monospace);}',
    '.o1p.is-visible{transform:none;opacity:1;pointer-events:auto;}',
    '.o1p__inner{width:100%;max-width:1180px;margin:0 auto;padding:8px 12px;',
    'display:flex;align-items:center;gap:10px;}',
    '.o1p__art{flex:0 0 auto;display:block;width:38px;height:38px;overflow:hidden;border-radius:2px;',
    'border:1px solid rgba(255,255,255,.1);background:#0a0f16;}',
    '.o1p__art img{display:block;width:100%;height:100%;object-fit:cover;}',
    '.o1p__meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;line-height:1.25;}',
    '.o1p__title{color:#fff;font-size:.8rem;font-weight:700;text-decoration:none;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.o1p__artist{color:var(--ink-dim,#8a93a0);font-size:.68rem;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.o1p__ctrl{flex:0 0 auto;display:flex;align-items:center;gap:6px;}',
    '.o1p__btn{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;',
    'border-radius:2px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.02);',
    'color:#cbd3dd;cursor:pointer;font-size:.8rem;line-height:1;',
    'transition:color .15s,background .15s,border-color .15s;}',
    '.o1p__btn:hover{color:var(--acid,#7dff9b);border-color:rgba(125,255,155,.35);background:rgba(125,255,155,.08);}',
    '.o1p__btn--close{color:var(--ink-faint,#5c6672);}',
    '.o1p__progress{height:2px;background:rgba(255,255,255,.06);cursor:pointer;}',
    '.o1p__progress span{display:block;height:100%;width:0;background:var(--acid,#7dff9b);transition:width .2s linear;}',
    'body.o1p-active{padding-bottom:calc(58px + env(safe-area-inset-bottom,0px));}',
    '@media (max-width:899px){',
    '.o1p{bottom:calc(var(--dock-h,54px) + env(safe-area-inset-bottom,0px));}',
    'body.o1p-active,body.has-dock.o1p-active{padding-bottom:calc(58px + var(--dock-h,54px) + env(safe-area-inset-bottom,0px));}',
    '}'
  ].join('');

  var state = {
    track: null,
    queue: [],
    index: -1,
    time: 0,
    playing: false,
    savedAt: 0
  };

  var audio = null;
  var ui = null;
  var lastSave = 0;
  var errors = 0;
  var listeners = [];

  /* ── Storage ─────────────────────────────────────────────── */
  function readState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && obj.track ? obj : null;
    } catch (e) {
      return null;
    }
  }

  function writeState() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        track: state.track,
        queue: state.queue.slice(0, 40),
        index: state.index,
        time: state.time,
        playing: state.playing,
        savedAt: state.savedAt
      }));
    } catch (e) {}
  }

  function readVolume() {
    try {
      var raw = localStorage.getItem(VOL_KEY);
      var num = raw == null ? 0.8 : Number(raw);
      return Math.min(1, Math.max(0, isNaN(num) ? 0.8 : num));
    } catch (e) {
      return 0.8;
    }
  }

  function saveVolume(value) {
    try { localStorage.setItem(VOL_KEY, String(value)); } catch (e) {}
  }

  /* ── Нормализация трека ──────────────────────────────────── */
  function norm(track) {
    if (!track || !track.id) return null;
    var art = track.artwork;
    if (art && typeof art === 'object') {
      art = art['480x480'] || art['1000x1000'] || art['150x150'] || '';
    }
    var artist = track.artist || (track.user && track.user.name) || 'One1Game';
    return {
      id: track.id,
      title: track.title || 'Без названия',
      artist: artist,
      artwork: art || '',
      duration: Number(track.duration) || 0,
      stream: track.stream || ('https://api.audius.co/v1/tracks/' + encodeURIComponent(track.id) + '/stream?app_name=One1Game'),
      href: '/music/?track=' + encodeURIComponent(track.id)
    };
  }

  /* ── Аудио ───────────────────────────────────────────────── */
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = readVolume();

    audio.addEventListener('play', function () {
      state.playing = true;
      errors = 0;
      render();
      emit();
      save(true);
    });
    audio.addEventListener('pause', function () {
      state.playing = false;
      render();
      emit();
      save(true);
    });
    audio.addEventListener('timeupdate', function () {
      state.time = audio.currentTime || 0;
      updateProgress();
      if (Date.now() - lastSave > 1000) save(false);
    });
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('ended', function () { next(true); });
    audio.addEventListener('error', function () {
      errors += 1;
      if (errors <= 3) setTimeout(function () { next(true); }, 600);
    });

    return audio;
  }

  function save(force) {
    if (ownedByPage) return;
    lastSave = Date.now();
    if (audio && audio.src) {
      state.time = audio.currentTime || 0;
      state.playing = !audio.paused;
    }
    state.savedAt = Date.now();
    writeState();
  }

  /* ── Управление ──────────────────────────────────────────── */
  function play(track, queue, index) {
    if (ownedByPage) return;
    var item = norm(track);
    if (!item) return;

    var list = [];
    if (queue && queue.length) {
      list = queue.map(norm).filter(Boolean);
    }
    if (!list.length) list = state.queue.length ? state.queue.slice() : [item];

    var pos = typeof index === 'number' && index >= 0 ? index : -1;
    if (pos < 0 || !list[pos] || list[pos].id !== item.id) {
      pos = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === item.id) { pos = i; break; }
      }
    }
    if (pos < 0) {
      list = [item].concat(list);
      pos = 0;
    }

    state.track = item;
    state.queue = list;
    state.index = pos;
    state.time = 0;
    errors = 0;

    var a = ensureAudio();
    a.src = item.stream;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(function () {
      state.playing = false;
      render();
    });

    render();
    emit();
    save(true);
  }

  function toggle() {
    if (ownedByPage) return;
    if (!state.track) return;
    var a = ensureAudio();
    if (!a.src) {
      a.src = state.track.stream;
      if (state.time > 1) {
        a.addEventListener('loadedmetadata', function once() {
          try { a.currentTime = state.time; } catch (e) {}
        }, { once: true });
      }
    }
    if (a.paused) {
      a.play().catch(function () {});
    } else {
      a.pause();
    }
  }

  function next(auto) {
    if (ownedByPage) return;
    if (!state.queue.length) {
      if (auto) { state.playing = false; render(); }
      return;
    }
    var pos = state.index < state.queue.length - 1 ? state.index + 1 : 0;
    play(state.queue[pos], state.queue, pos);
  }

  function prev() {
    if (ownedByPage) return;
    if (!state.queue.length) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    var pos = state.index > 0 ? state.index - 1 : state.queue.length - 1;
    play(state.queue[pos], state.queue, pos);
  }

  function close() {
    if (ownedByPage) return;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      try { audio.load(); } catch (e) {}
    }
    state.track = null;
    state.queue = [];
    state.index = -1;
    state.time = 0;
    state.playing = false;
    state.savedAt = 0;
    try { localStorage.removeItem(KEY); } catch (e) {}
    render();
    emit();
  }

  /* ── Мост со страницей /music/* ──────────────────────────── */
  function sync(payload) {
    if (!payload || !payload.track) return;
    var item = norm(payload.track);
    if (!item) return;
    state.track = item;
    if (payload.queue && payload.queue.length) {
      state.queue = payload.queue.map(norm).filter(Boolean);
    }
    state.index = typeof payload.index === 'number' ? payload.index : -1;
    state.time = Number(payload.time) || 0;
    state.playing = !!payload.playing;
    state.savedAt = Date.now();
    writeState();
  }

  function saved() {
    var obj = readState();
    if (!obj) return null;
    return {
      track: norm(obj.track),
      queue: (obj.queue || []).map(norm).filter(Boolean),
      index: typeof obj.index === 'number' ? obj.index : 0,
      time: Number(obj.time) || 0,
      playing: !!obj.playing,
      savedAt: Number(obj.savedAt) || 0
    };
  }

  /* ── Восстановление после перехода ───────────────────────── */
  function restore() {
    if (ownedByPage) return;
    var obj = readState();
    if (!obj || !obj.track) return;
    if (Date.now() - (Number(obj.savedAt) || 0) > MAX_AGE) return;

    var item = norm(obj.track);
    if (!item) return;

    state.track = item;
    state.queue = (obj.queue || []).map(norm).filter(Boolean);
    if (!state.queue.length) state.queue = [item];
    state.index = typeof obj.index === 'number' && obj.index >= 0 ? obj.index : 0;
    if (!state.queue[state.index] || state.queue[state.index].id !== item.id) {
      var found = -1;
      for (var i = 0; i < state.queue.length; i++) {
        if (state.queue[i].id === item.id) { found = i; break; }
      }
      state.index = found >= 0 ? found : 0;
    }
    state.time = Number(obj.time) || 0;

    var a = ensureAudio();
    var started = false;
    function start() {
      if (started) return;
      started = true;
      if (state.time > 1) {
        try { a.currentTime = state.time; } catch (e) {}
      }
      if (obj.playing) {
        a.play().then(function () { state.playing = true; }).catch(function () {
          state.playing = false;
          render();
        });
      }
    }
    a.addEventListener('loadedmetadata', start, { once: true });
    a.addEventListener('canplay', start, { once: true });
    setTimeout(start, 2500);

    a.src = item.stream;
    state.playing = !!obj.playing;
    render();
    emit();
  }

  /* ── Интерфейс ───────────────────────────────────────────── */
  function buildUi() {
    var doc = document;
    var style = doc.createElement('style');
    style.id = 'o1p-style';
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);

    ui = doc.createElement('div');
    ui.className = 'o1p';
    ui.id = 'o1p';
    ui.setAttribute('role', 'region');
    ui.setAttribute('aria-label', 'Плеер One1Game');
    ui.innerHTML =
      '<div class="o1p__inner">' +
        '<a class="o1p__art" href="/music/" aria-label="Открыть музыку"><img alt="" decoding="async"></a>' +
        '<div class="o1p__meta">' +
          '<a class="o1p__title" href="/music/">—</a>' +
          '<span class="o1p__artist">One1Game</span>' +
        '</div>' +
        '<div class="o1p__ctrl">' +
          '<button type="button" class="o1p__btn" data-o1p="toggle" aria-label="Пауза"><i class="fas fa-pause" aria-hidden="true"></i></button>' +
          '<button type="button" class="o1p__btn" data-o1p="next" aria-label="Следующий трек"><i class="fas fa-forward-step" aria-hidden="true"></i></button>' +
          '<button type="button" class="o1p__btn o1p__btn--close" data-o1p="close" aria-label="Выключить плеер"><i class="fas fa-xmark" aria-hidden="true"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="o1p__progress" data-o1p="seek"><span></span></div>';
    (doc.body || doc.documentElement).appendChild(ui);

    ui.addEventListener('click', function (event) {
      var action = event.target.closest('[data-o1p]');
      if (!action) return;
      var kind = action.getAttribute('data-o1p');
      if (kind === 'toggle') toggle();
      else if (kind === 'next') next(false);
      else if (kind === 'close') close();
      else if (kind === 'seek') seek(event, action);
    });
  }

  function seek(event, bar) {
    var a = ensureAudio();
    if (!a.duration || !isFinite(a.duration)) return;
    var rect = bar.getBoundingClientRect();
    var ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / (rect.width || 1)));
    a.currentTime = ratio * a.duration;
    updateProgress();
  }

  function render() {
    if (ownedByPage) return;
    if (!state.track) {
      if (ui) ui.classList.remove('is-visible');
      document.body.classList.remove('o1p-active');
      return;
    }
    if (!ui) buildUi();

    var img = ui.querySelector('.o1p__art img');
    var title = ui.querySelector('.o1p__title');
    var artist = ui.querySelector('.o1p__artist');
    var playBtn = ui.querySelector('[data-o1p="toggle"]');

    if (img) img.src = state.track.artwork || FALLBACK_ART;
    if (title) {
      title.textContent = state.track.title;
      title.href = state.track.href || '/music/';
    }
    if (artist) artist.textContent = state.track.artist || 'One1Game';
    if (playBtn) {
      playBtn.innerHTML = '<i class="fas ' + (state.playing ? 'fa-pause' : 'fa-play') + '" aria-hidden="true"></i>';
      playBtn.setAttribute('aria-label', state.playing ? 'Пауза' : 'Слушать');
    }

    ui.classList.add('is-visible');
    document.body.classList.add('o1p-active');
    updateProgress();
    updateMediaSession();
  }

  function updateProgress() {
    if (!ui || !audio) return;
    var bar = ui.querySelector('.o1p__progress span');
    if (!bar) return;
    var duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (state.track ? state.track.duration : 0);
    var ratio = duration ? (audio.currentTime || 0) / duration : 0;
    bar.style.width = (Math.min(1, Math.max(0, ratio)) * 100).toFixed(2) + '%';
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.track) return;
    try {
      if (window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: state.track.title,
          artist: state.track.artist,
          album: 'One1Game',
          artwork: state.track.artwork ? [{ src: state.track.artwork, sizes: '480x480' }] : []
        });
      }
      navigator.mediaSession.setActionHandler('play', function () { toggle(); });
      navigator.mediaSession.setActionHandler('pause', function () { toggle(); });
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', function () { next(false); });
    } catch (e) {}
  }

  function emit() {
    var payload = { track: state.track, playing: state.playing };
    listeners.forEach(function (fn) {
      try { fn(payload); } catch (e) {}
    });
  }

  /* ── Громкость ───────────────────────────────────────────── */
  function setVolume(value) {
    var vol = Math.min(1, Math.max(0, Number(value) || 0));
    if (audio) audio.volume = vol;
    saveVolume(vol);
  }

  /* ── Публичный API ───────────────────────────────────────── */
  window.O1Player = {
    play: play,
    toggle: toggle,
    next: next,
    prev: prev,
    close: close,
    sync: sync,
    saved: saved,
    normalize: norm,
    setVolume: setVolume,
    current: function () { return { track: state.track, playing: state.playing }; },
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (item) { return item !== fn; });
      };
    }
  };

  /* ── Переходы без перезагрузки ───────────────────────────────
     Документ и <audio> не пересоздаются: меняется только <main>,
     поэтому музыка играет без единого разрыва. Работает на
     «спокойных» страницах — статьи, обои, кино, справочники, статика.
     Если у страницы свои тяжёлые скрипты (главная, игры, музыка,
     лента) — обычный переход с перезагрузкой. */

  function scriptBase(src) {
    return String(src || '').split('?')[0];
  }

  function isShellScript(src) {
    return /(^|\/)(components|player|analytics-consent|cache-version|api-config)\.js$/.test(scriptBase(src));
  }

  function isAllowedScript(src) {
    var clean = scriptBase(src);
    if (isShellScript(clean)) return true;
    if (/(^|\/)(articles-data|reactions|newsletter|game-media|site-chrome)\.js$/.test(clean)) return true;
    if (/utteranc\.es\/client\.js$/.test(clean)) return true;
    if (/googletagmanager\.com/.test(clean)) return true;
    return false;
  }

  // Только страницы, где вся суть лежит в <main id="main-content">:
  // у остальных есть свои блоки вне main (вкладки, глоу, плеер),
  // которые при подмене остались бы от прошлой страницы.
  function mainOf(doc) {
    return doc.querySelector('main#main-content');
  }

  function isSoftDoc(doc) {
    if (!mainOf(doc)) return false;
    var list = doc.querySelectorAll('script[src]');
    for (var i = 0; i < list.length; i++) {
      if (!isAllowedScript(list[i].getAttribute('src'))) return false;
    }
    return true;
  }

  var softPrefetch = {};
  var softBusy = false;
  var softBar = null;

  function injectNavStyles() {
    if (document.getElementById('o1nav-style')) return;
    var style = document.createElement('style');
    style.id = 'o1nav-style';
    style.textContent =
      '.o1nav-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:9999;opacity:0;pointer-events:none;overflow:hidden;transition:opacity .15s}' +
      '.o1nav-progress.is-on{opacity:1}' +
      '.o1nav-progress::after{content:"";position:absolute;top:0;left:0;height:100%;width:40%;background:var(--acid,#7dff9b);animation:o1nav-slide .9s infinite ease-in-out}' +
      '@keyframes o1nav-slide{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function startLoading() {
    if (!softBar) {
      softBar = document.createElement('div');
      softBar.className = 'o1nav-progress';
      (document.body || document.documentElement).appendChild(softBar);
    }
    softBar.classList.add('is-on');
  }

  function stopLoading() {
    if (softBar) softBar.classList.remove('is-on');
  }

  function syncMeta(doc) {
    function copy(sel, attr) {
      var from = doc.head.querySelector(sel);
      var to = document.head.querySelector(sel);
      if (!from || !to) return;
      var value = from.getAttribute(attr);
      if (value) to.setAttribute(attr, value);
    }
    copy('meta[name="description"]', 'content');
    copy('link[rel="canonical"]', 'href');
    copy('meta[property="og:title"]', 'content');
    copy('meta[property="og:description"]', 'content');
    copy('meta[property="og:url"]', 'content');
    copy('meta[name="twitter:title"]', 'content');
    copy('meta[name="twitter:description"]', 'content');
  }

  function syncStyles(doc) {
    var links = doc.querySelectorAll('link[rel="stylesheet"][href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.indexOf('data:') === 0) continue;
      var base = href.split('?')[0];
      var own = document.head.querySelectorAll('link[rel="stylesheet"][href]');
      var exists = false;
      for (var j = 0; j < own.length; j++) {
        if ((own[j].getAttribute('href') || '').split('?')[0] === base) { exists = true; break; }
      }
      if (exists) continue;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function syncJsonLd(doc) {
    var olds = document.head.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);
    var fresh = doc.head.querySelectorAll('script[type="application/ld+json"]');
    for (var j = 0; j < fresh.length; j++) document.head.appendChild(document.importNode(fresh[j], true));
  }

  function scriptUsable(node) {
    var type = (node.getAttribute('type') || '').toLowerCase();
    if (type && !/javascript|module/.test(type)) return false;
    var src = node.getAttribute('src');
    if (src && isShellScript(src)) return false;
    return true;
  }

  // Оживляем скрипт рядом с его исходным местом: так виджеты
  // (например, комментарии) встают туда, где стояли.
  function revive(node, anchor) {
    return new Promise(function (resolve) {
      var live = document.createElement('script');
      var attrs = node.attributes || [];
      for (var i = 0; i < attrs.length; i++) {
        if (attrs[i].name !== 'src') live.setAttribute(attrs[i].name, attrs[i].value);
      }
      var src = node.getAttribute('src');
      var parent = anchor && anchor.parentNode ? anchor.parentNode : (document.body || document.documentElement);
      if (src) {
        live.async = false;
        live.onload = live.onerror = function () { resolve(); };
        live.src = src;
        parent.insertBefore(live, anchor && anchor.parentNode ? anchor.nextSibling : null);
        setTimeout(resolve, 5000);
      } else {
        live.textContent = node.textContent;
        parent.insertBefore(live, anchor && anchor.parentNode ? anchor.nextSibling : null);
        resolve();
      }
    });
  }

  function reviveInPlace(imported) {
    var nodes = Array.prototype.slice.call(imported.querySelectorAll('script'));
    return nodes.reduce(function (chain, node) {
      if (!scriptUsable(node)) return chain;
      return chain.then(function () { return revive(node, node); });
    }, Promise.resolve());
  }

  function inside(node, root) {
    for (var walk = node; walk; walk = walk.parentNode) {
      if (walk === root) return true;
    }
    return false;
  }

  function reviveBodyScripts(doc, mainNode) {
    var result = [];
    if (!doc.body) return result;
    var nodes = doc.body.querySelectorAll('script');
    for (var i = 0; i < nodes.length; i++) {
      if (inside(nodes[i], mainNode)) continue;
      if (!scriptUsable(nodes[i])) continue;
      result.push(nodes[i]);
    }
    return result;
  }

  function runBodyScripts(nodes) {
    return nodes.reduce(function (chain, node) {
      return chain.then(function () { return revive(node, null); });
    }, Promise.resolve());
  }

  function markActive() {
    var clean = location.pathname.replace(/\/$/, '');
    var links = document.querySelectorAll('.nav-links > .nav-item > .nav-link, .dock-item[href]');
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute('href') || '').split('?')[0].replace(/\/$/, '');
      var hit = href === '' ? clean === '' : (clean === href || clean.indexOf(href + '/') === 0);
      links[i].classList.toggle('active', hit);
      if (hit) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function applyPage(doc, nextMain, currentMain) {
    if (doc.title) document.title = doc.title;
    syncMeta(doc);
    syncStyles(doc);
    syncJsonLd(doc);

    var bodyScripts = reviveBodyScripts(doc, nextMain);
    var imported = document.importNode ? document.importNode(nextMain, true) : nextMain.cloneNode(true);
    currentMain.replaceWith(imported);

    var keep = '';
    if (document.body.classList.contains('has-dock')) keep += ' has-dock';
    if (document.body.classList.contains('o1p-active')) keep += ' o1p-active';
    if (document.body.classList.contains('music-has-track')) keep += ' music-has-track';
    document.body.className = (doc.body ? doc.body.className : '') + keep;

    markActive();
    if (window.scrollTo) window.scrollTo(0, 0);

    reviveInPlace(imported).then(function () {
      return runBodyScripts(bodyScripts);
    });
  }

  function softLoad(path, push) {
    if (softBusy) return;
    softBusy = true;
    startLoading();

    var cached = softPrefetch[path];
    var request = cached && cached.html && Date.now() - cached.t < 30000
      ? Promise.resolve(cached.html)
      : fetch(path, { credentials: 'same-origin' }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        });

    request.then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var nextMain = mainOf(doc);
      var currentMain = document.querySelector('main');
      if (!nextMain || !currentMain || !isSoftDoc(doc)) throw new Error('unsupported');
      applyPage(doc, nextMain, currentMain);
      if (push) history.pushState({ o1soft: true }, '', path);
    }).catch(function () {
      location.href = path;
    }).then(function () {
      softBusy = false;
      stopLoading();
    });
  }

  function softLink(event) {
    if (softBusy) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;
    if (/\bexternal\b/.test(link.getAttribute('rel') || '')) return;

    var raw = link.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(raw)) return;

    var url;
    try { url = new URL(link.href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin) return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.pathname.indexOf('/music') === 0) return;
    if (url.pathname === location.pathname && url.search === location.search) return;

    event.preventDefault();
    softLoad(url.pathname + url.search + url.hash, true);
  }

  var hoverTimer = null;

  function softHover(event) {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;

    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname.indexOf('/music') === 0) return;
    var path = url.pathname + url.search;
    if (softPrefetch[path]) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      if (softPrefetch[path]) return;
      if (Object.keys(softPrefetch).length > 12) softPrefetch = {};
      softPrefetch[path] = { t: Date.now(), html: null };
      fetch(path, { credentials: 'same-origin' })
        .then(function (res) { return res.ok ? res.text() : null; })
        .then(function (html) {
          if (html) softPrefetch[path] = { t: Date.now(), html: html };
          else delete softPrefetch[path];
        })
        .catch(function () { delete softPrefetch[path]; });
    }, 140);
  }

  function initSoftNav() {
    if (!window.history || !history.pushState || !window.DOMParser) return;
    if (!isSoftDoc(document) && location.pathname.indexOf('/music') !== 0) return;

    injectNavStyles();
    document.addEventListener('click', softLink, false);
    document.addEventListener('mouseover', softHover, { passive: true });
    window.addEventListener('popstate', function (event) {
      if (event.state && event.state.o1soft) softLoad(location.pathname + location.search + location.hash, false);
      else location.reload();
    });
  }

  /* ── Старт ───────────────────────────────────────────────── */
  initSoftNav();

  if (ownedByPage) return;

  function boot() {
    restore();
    window.addEventListener('pagehide', function () { save(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
