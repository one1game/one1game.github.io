// components.js — One1Game app shell
// Nav + mobile dock + bottom sheet + instant search + procedural art/sound
// Плюс: инжект футера и блок «Похожие статьи» (cross-linking).
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  var isL2 = path.includes('/l2');
  var isTriad = path.includes('/triad-duel');
  var isGo = path === '/go' || path.indexOf('/go/') === 0;

  function active(state) { return state ? ' active' : ''; }

  // ── Icons ──────────────────────────────────────────
  var I = {
    home: 'fa-house',
    articles: 'fa-newspaper',
    radio: 'fa-play',
    search: 'fa-magnifying-glass',
    more: 'fa-ellipsis',
    code: 'fa-code',
    scanner: 'fa-shield-halved',
    server: 'fa-server',
    game: 'fa-gamepad',
    online: 'fa-dice',
    tg: 'fa-telegram',
    vk: 'fa-vk',
    yt: 'fa-youtube',
    doc: 'fa-file-lines',
    cash: 'fa-rectangle-ad'
  };

  // ── Радио доступно только там, где подключён script.js ──
  var hasRadio = !!doc.querySelector('script[src*="script.js"]');

  // ── Nav ────────────────────────────────────────────
  var skipLink = doc.querySelector('.skip-link') ? '' :
    '<a href="#main-content" class="skip-link">Перейти к контенту</a>';

  var navLinks =
    '<a href="/" class="nav-link' + active(isHome) + '">Главная</a>' +
    '<a href="/go/" class="nav-link' + active(isGo) + '">Игры онлайн</a>' +
    '<a href="/archive.html" class="nav-link' + active(isArchive) + '">Статьи</a>' +
    '<a href="/triad-duel.html" class="nav-link' + active(isTriad) + '">Triad Duel</a>' +
    '<a href="/anal-code/" class="nav-link' + active(isCodeFusion) + '">CodeFusion</a>' +
    '<a href="/cyber-scanner/" class="nav-link' + active(isScanner) + '">Scanner</a>' +
    '<a href="/l2/" class="nav-link' + active(isL2) + '">L2 Server</a>';

  var nav =
    skipLink +
    '<nav class="site-nav" aria-label="Главная навигация">' +
    '  <div class="nav-inner">' +
    '    <a href="/" class="nav-logo">ONE1<span>GAME</span></a>' +
    '    <div class="nav-links">' + navLinks + '</div>' +
    '    <div class="nav-actions">' +
    '      <button type="button" class="icon-btn" id="search-btn" aria-label="Поиск по статьям"><i class="fas fa-magnifying-glass" aria-hidden="true"></i></button>' +
    '      <button type="button" class="icon-btn icon-radio" id="radio-play"' + (hasRadio ? '' : ' hidden') + ' aria-label="Радио: включить или выключить"><i class="fas fa-play" aria-hidden="true"></i></button>' +
    '      <button type="button" class="icon-btn" id="sfx-toggle" aria-label="Звуки интерфейса" aria-pressed="false"><i class="fas fa-volume-xmark" aria-hidden="true"></i></button>' +
    '    </div>' +
    '  </div>' +
    '</nav>';

  // ── Mobile dock ────────────────────────────────────
  var dock =
    '<nav class="mobile-dock" aria-label="Мобильная навигация">' +
    '  <a href="/" class="dock-item' + active(isHome) + '"><i class="fas ' + I.home + '" aria-hidden="true"></i><span>Главная</span></a>' +
    '  <a href="/archive.html" class="dock-item' + active(isArchive) + '"><i class="fas ' + I.articles + '" aria-hidden="true"></i><span>Статьи</span></a>' +
    '  <button type="button" class="dock-item" id="dock-radio"' + (hasRadio ? '' : ' hidden') + '><i class="fas ' + I.radio + '" aria-hidden="true"></i><span>Радио</span></button>' +
    '  <button type="button" class="dock-item" id="dock-search"><i class="fas ' + I.search + '" aria-hidden="true"></i><span>Поиск</span></button>' +
    '  <button type="button" class="dock-item" id="dock-more"><i class="fas ' + I.more + '" aria-hidden="true"></i><span>Ещё</span></button>' +
    '</nav>';

  // ── Bottom sheet ───────────────────────────────────
  var sheet =
    '<div class="sheet-backdrop" id="sheet-backdrop" aria-hidden="true"></div>' +
    '<aside class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Меню" aria-hidden="true">' +
    '  <div class="sheet-handle" aria-hidden="true"></div>' +
    '  <p class="sheet-title">Разделы</p>' +
    '  <div class="sheet-links">' +
    '    <a href="/go/" class="sheet-link' + active(isGo) + '"><i class="fas ' + I.online + '" aria-hidden="true"></i> Игры онлайн</a>' +
    '    <a href="/archive.html" class="sheet-link' + active(isArchive) + '"><i class="fas ' + I.articles + '" aria-hidden="true"></i> Все статьи</a>' +
    '    <a href="/triad-duel.html" class="sheet-link' + active(isTriad) + '"><i class="fas ' + I.game + '" aria-hidden="true"></i> Triad Duel</a>' +
    '    <a href="/anal-code/" class="sheet-link' + active(isCodeFusion) + '"><i class="fas ' + I.code + '" aria-hidden="true"></i> CodeFusion</a>' +
    '    <a href="/cyber-scanner/" class="sheet-link' + active(isScanner) + '"><i class="fas ' + I.scanner + '" aria-hidden="true"></i> Scanner</a>' +
    '    <a href="/l2/" class="sheet-link' + active(isL2) + '"><i class="fas ' + I.server + '" aria-hidden="true"></i> L2 Server</a>' +
    '  </div>' +
    '  <p class="sheet-title">Издание</p>' +
    '  <div class="sheet-links">' +
    '    <a href="/advertising.html" class="sheet-link"><i class="fas ' + I.cash + '" aria-hidden="true"></i> Реклама на сайте</a>' +
    '    <a href="/privacy.html" class="sheet-link"><i class="fas ' + I.doc + '" aria-hidden="true"></i> Политика конфиденциальности</a>' +
    '    <a href="/terms.html" class="sheet-link"><i class="fas ' + I.doc + '" aria-hidden="true"></i> Правила использования</a>' +
    '  </div>' +
    '</aside>';

  // ── Search modal ───────────────────────────────────
  var searchModal =
    '<div class="search-modal" id="search-modal" role="dialog" aria-modal="true" aria-label="Поиск по статьям" aria-hidden="true">' +
    '  <div class="search-panel">' +
    '    <div class="search-field">' +
    '      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>' +
    '      <input type="search" id="search-input" placeholder="Поиск по статьям и гайдам…" autocomplete="off" enterkeyhint="search" aria-label="Поисковый запрос">' +
    '      <button type="button" class="search-close" id="search-close" aria-label="Закрыть поиск"><i class="fas fa-xmark" aria-hidden="true"></i></button>' +
    '    </div>' +
    '    <div class="search-results" id="search-results"></div>' +
    '    <p class="search-hint">ESC — закрыть · Ctrl / ⌘ + K — открыть</p>' +
    '  </div>' +
    '</div>';

  // ── Footer ─────────────────────────────────────────
  var footer =
    '<footer class="site-footer">' +
    '  <div class="footer-content">' +
    '    <a href="/" class="footer-brand">ONE1<span>GAME</span></a>' +
    '    <div class="footer-links">' +
    '      <a href="/archive.html">Статьи</a>' +
    '      <a href="/cyber-scanner/">Проверка безопасности</a>' +
    '      <a href="/advertising.html">Реклама</a>' +
    '      <a href="/privacy.html">Политика</a>' +
    '      <a href="/terms.html">Правила</a>' +
    '    </div>' +
    '    <div class="footer-socials">' +
    '      <a href="https://t.me/one1game" target="_blank" rel="noopener" aria-label="Telegram"><i class="fab fa-telegram" aria-hidden="true"></i></a>' +
    '      <a href="https://vk.com/one1games" target="_blank" rel="noopener" aria-label="ВКонтакте"><i class="fab fa-vk" aria-hidden="true"></i></a>' +
    '      <a href="https://www.youtube.com/@one1game" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube" aria-hidden="true"></i></a>' +
    '    </div>' +
    '    <span>&copy; 2025–2026 One1Game</span>' +
    '  </div>' +
    '</footer>';

  // ── Inject ─────────────────────────────────────────
  body.insertAdjacentHTML('afterbegin', nav + dock + sheet + searchModal);
  body.classList.add('has-dock');

  var main = doc.querySelector('main#main-content');
  if (main) {
    main.insertAdjacentHTML('afterend', footer);
  }

  /* ============================================================
     SFX — процедурный звук интерфейса (Web Audio, opt-in)
     ============================================================ */
  var Sfx = (function () {
    var KEY = 'one1game_sfx';
    var ctx = null;
    var on = false;

    try { on = localStorage.getItem(KEY) === '1'; } catch (e) { on = false; }

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
      return ctx;
    }

    function tone(freq, dur, type, vol, glideTo) {
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      var t = c.currentTime;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    // ── Эмбиент: процедурный гул для 3D-сцены (без внешних файлов) ──
    var ambNodes = null;

    function ambientOn() {
      var c = ensure();
      if (!c || ambNodes) return;
      if (c.state === 'suspended') c.resume();
      // Если играет радио — не наслаиваемся
      if (window.One1GameRadio && window.One1GameRadio.audio && !window.One1GameRadio.audio.paused) return;

      var t0 = c.currentTime;
      var master = c.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.05, t0 + 4);

      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      filter.Q.value = 0.8;

      var a = c.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 55;    // A1
      var b = c.createOscillator(); b.type = 'sawtooth'; b.frequency.value = 55.45; // лёгкий детюн
      var d = c.createOscillator(); d.type = 'sine';     d.frequency.value = 110;   // октава

      var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05;
      var lfoGain = c.createGain(); lfoGain.gain.value = 110;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      a.connect(filter); b.connect(filter); d.connect(filter);
      filter.connect(master);
      master.connect(c.destination);
      a.start(); b.start(); d.start(); lfo.start();

      ambNodes = { master: master, nodes: [a, b, d, lfo] };
    }

    function ambientOff() {
      if (!ambNodes) return;
      var c = ctx;
      var master = ambNodes.master;
      var nodes = ambNodes.nodes;
      ambNodes = null;
      try {
        var now = c.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      } catch (e) { /* гасим жёстко ниже */ }
      setTimeout(function () {
        for (var i = 0; i < nodes.length; i++) { try { nodes[i].stop(); } catch (e) {} }
      }, 1100);
    }

    return {
      enabled: function () { return on; },
      set: function (v) {
        on = !!v;
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
      },
      ambient: function (want) {
        if (want) ambientOn(); else ambientOff();
      },
      isAmbient: function () { return !!ambNodes; },
      play: function (kind) {
        if (!on) return;
        try {
          if (kind === 'open') { tone(420, 0.16, 'sine', 0.05, 880); }
          else if (kind === 'close') { tone(700, 0.14, 'sine', 0.04, 320); }
          else if (kind === 'on') { tone(523, 0.30, 'sine', 0.05); tone(784, 0.34, 'sine', 0.035); tone(1046, 0.28, 'triangle', 0.02); }
          else if (kind === 'hover') { tone(1560, 0.035, 'sine', 0.012, 1980); }
          else { tone(1180, 0.045, 'triangle', 0.035, 1560); }
        } catch (e) {}
      }
    };
  })();

  window.One1Sfx = Sfx;

  var sfxBtn = doc.getElementById('sfx-toggle');
  function paintSfx() {
    if (!sfxBtn) return;
    var isOn = Sfx.enabled();
    sfxBtn.classList.toggle('is-on', isOn);
    sfxBtn.setAttribute('aria-pressed', String(isOn));
    var icon = sfxBtn.querySelector('i');
    if (icon) icon.className = isOn ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
  }
  // Звук привязан к состоянию 3D-сцены: гул включается вместе с ней
  var heroLive = false;
  function syncAmbient() {
    Sfx.ambient(!!(Sfx.enabled() && heroLive && !doc.hidden));
  }
  doc.addEventListener('one1hero:ready', function () {
    heroLive = true;
    root.classList.add('hero3d-on');
    syncAmbient();
  });
  doc.addEventListener('visibilitychange', syncAmbient);

  if (sfxBtn) {
    paintSfx();
    sfxBtn.addEventListener('click', function () {
      Sfx.set(!Sfx.enabled());
      paintSfx();
      if (Sfx.enabled()) Sfx.play('on');
      syncAmbient();
    });
  }

  // Тихий «тик» на интерактивных элементах (только при включённом звуке)
  doc.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.dock-item, .sheet-link, .nav-link, .btn, .icon-btn, .article-card, .cat-pill') : null;
    if (el) Sfx.play('tap');
  }, true);

  /* ============================================================
     Радио: прокси-кнопка в доке
     ============================================================ */
  var dockRadio = doc.getElementById('dock-radio');
  if (dockRadio && hasRadio) {
    dockRadio.addEventListener('click', function () {
      var btn = doc.getElementById('radio-play');
      if (btn) { btn.click(); return; }
      if (window.One1GameRadio) window.One1GameRadio.toggle();
    });

    var tries = 0;
    (function waitRadio() {
      var radio = window.One1GameRadio;
      if (radio && radio.audio) {
        var icon = dockRadio.querySelector('i');
        var sync = function () {
          var paused = radio.audio.paused;
          dockRadio.classList.toggle('playing', !paused);
          if (icon) icon.className = paused ? 'fas fa-play' : 'fas fa-pause';
        };
        radio.audio.addEventListener('play', sync);
        radio.audio.addEventListener('pause', sync);
        // Радио и эмбиент не звучат одновременно
        radio.audio.addEventListener('play', function () { Sfx.ambient(false); });
        radio.audio.addEventListener('pause', function () { syncAmbient(); });
        sync();
        return;
      }
      if (++tries > 20) { dockRadio.hidden = true; return; }
      setTimeout(waitRadio, 250);
    })();
  }

  /* ============================================================
     Sheet (bottom menu) + Search modal
     ============================================================ */
  var sheetEl = doc.getElementById('sheet');
  var backdrop = doc.getElementById('sheet-backdrop');
  var searchEl = doc.getElementById('search-modal');

  function lockScroll(lock) {
    body.classList.toggle('no-scroll', !!lock);
  }

  function openSheet() {
    if (!sheetEl) return;
    sheetEl.classList.add('open');
    sheetEl.setAttribute('aria-hidden', 'false');
    if (backdrop) { backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); }
    lockScroll(true);
    Sfx.play('open');
  }
  function closeSheet() {
    if (!sheetEl || !sheetEl.classList.contains('open')) return;
    sheetEl.classList.remove('open');
    sheetEl.setAttribute('aria-hidden', 'true');
    if (backdrop) { backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden', 'true'); }
    lockScroll(false);
    Sfx.play('close');
  }

  var moreBtn = doc.getElementById('dock-more');
  if (moreBtn) moreBtn.addEventListener('click', openSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);

  // ── Загрузка данных статей по требованию (для поиска на любой странице) ──
  var dataState = 'idle';
  var dataCbs = [];
  function loadArticles(cb) {
    if (window.allArticles && window.allArticles.length) { cb(); return; }
    dataCbs.push(cb);
    if (dataState !== 'idle') return;
    dataState = 'loading';
    var s = doc.createElement('script');
    s.src = '/articles-data.js?v=' + (window.CACHE_VER || '1');
    s.onload = s.onerror = function () {
      dataState = 'ready';
      var cbs = dataCbs;
      dataCbs = [];
      for (var i = 0; i < cbs.length; i++) { try { cbs[i](); } catch (e) {} }
    };
    doc.head.appendChild(s);
  }

  function esc(v) {
    var d = doc.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  var searchInput = doc.getElementById('search-input');
  var searchResults = doc.getElementById('search-results');

  function renderResults() {
    if (!searchResults) return;
    var list = window.allArticles || [];
    var q = (searchInput ? searchInput.value : '').toLowerCase().trim();

    if (!list.length) {
      searchResults.innerHTML = '<div class="search-empty">' +
        (dataState === 'ready' ? 'Материалы не найдены.' : 'Загрузка…') + '</div>';
      return;
    }

    var hits = [];
    if (!q) {
      hits = list.slice(0, 4);
    } else {
      for (var i = 0; i < list.length && hits.length < 7; i++) {
        var a = list[i];
        var hay = ((a.title || '') + ' ' + (a.excerpt || '') + ' ' + (a.category || '')).toLowerCase();
        if (hay.indexOf(q) !== -1) hits.push(a);
      }
    }

    if (!hits.length) {
      searchResults.innerHTML = '<div class="search-empty">Ничего не найдено. Попробуйте другой запрос.</div>';
      return;
    }

    var html = '';
    for (var j = 0; j < hits.length; j++) {
      var art = hits[j];
      html +=
        '<a href="' + esc(art.url || '#') + '" class="search-result">' +
        (art.image ? '<img src="' + esc(art.image) + '" alt="" loading="lazy" width="112" height="76">' : '') +
        '<span class="search-result-txt"><strong>' + esc(art.title || '') + '</strong>' +
        '<span>' + esc(art.category || '') + ' · ' + esc(art.date || '') + '</span></span>' +
        '</a>';
    }
    if (q) {
      html += '<a href="/archive.html" class="search-result" style="justify-content:center"><span class="search-result-txt"><strong>Все результаты в архиве →</strong></span></a>';
    }
    searchResults.innerHTML = html;
  }

  function openSearch() {
    if (!searchEl || searchEl.classList.contains('open')) return;
    searchEl.classList.add('open');
    searchEl.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    Sfx.play('open');
    if (searchInput) searchInput.value = '';
    renderResults();
    if (searchInput && window.matchMedia('(min-width: 900px)').matches) searchInput.focus();
    loadArticles(renderResults);
  }
  function closeSearch() {
    if (!searchEl || !searchEl.classList.contains('open')) return;
    searchEl.classList.remove('open');
    searchEl.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    Sfx.play('close');
  }

  var searchBtn = doc.getElementById('search-btn');
  var dockSearch = doc.getElementById('dock-search');
  var searchClose = doc.getElementById('search-close');
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (dockSearch) dockSearch.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchInput) {
    searchInput.addEventListener('input', function () { loadArticles(renderResults); });
  }
  if (searchEl) {
    searchEl.addEventListener('click', function (e) { if (e.target === searchEl) closeSearch(); });
  }

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSearch(); closeSheet(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ============================================================
     Hero canvas — процедурная кинематографичная подсветка
     ============================================================ */
  (function initHeroCanvas() {
    var canvas = doc.getElementById('hero-canvas');
    if (!canvas) return;

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (reduceMotion || (conn && conn.saveData)) { canvas.remove(); return; }

    var ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    var SCALE = 0.5;
    var w = 0, h = 0, glows = [], sweep = 0, raf = null, inView = true, run = false, skip = 0;
    var palette = [[125, 255, 155], [96, 190, 130], [157, 178, 168], [255, 192, 97]];

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = canvas.width = Math.max(200, Math.floor(rect.width * SCALE));
      h = canvas.height = Math.max(140, Math.floor(rect.height * SCALE));
      var base = Math.max(w, h);
      glows = palette.map(function (c, i) {
        return {
          c: c,
          x: (0.15 + 0.7 * ((i * 0.37) % 1)) * w,
          y: (0.2 + 0.6 * ((i * 0.61) % 1)) * h,
          r: (0.34 + 0.22 * i / palette.length) * base,
          vx: (i % 2 ? 1 : -1) * (0.05 + i * 0.015),
          vy: (i % 3 ? -1 : 1) * (0.04 + i * 0.012)
        };
      });
    }

    function frame() {
      if (!run) return;
      raf = requestAnimationFrame(frame);
      if (skip++ % 2) return;          // ~30fps
      if (doc.hidden || !inView) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < glows.length; i++) {
        var g = glows[i];
        g.x += g.vx; g.y += g.vy;
        if (g.x < -g.r) g.x = w + g.r;
        if (g.x > w + g.r) g.x = -g.r;
        if (g.y < -g.r) g.y = h + g.r;
        if (g.y > h + g.r) g.y = -g.r;
        var grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grad.addColorStop(0, 'rgba(' + g.c.join(',') + ',0.15)');
        grad.addColorStop(1, 'rgba(' + g.c.join(',') + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, 6.2832);
        ctx.fill();
      }

      sweep += 0.7;
      if (sweep > h + 90) sweep = -90;
      var lg = ctx.createLinearGradient(0, sweep - 45, 0, sweep + 45);
      lg.addColorStop(0, 'rgba(0,229,255,0)');
      lg.addColorStop(0.5, 'rgba(0,229,255,0.045)');
      lg.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, sweep - 45, w, 90);

      ctx.globalCompositeOperation = 'source-over';
    }

    function start() { if (!run && inView && !doc.hidden) { run = true; frame(); } }
    function stop() { run = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    window.addEventListener('resize', function () { clearTimeout(resize._t); resize._t = setTimeout(resize, 200); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }, { threshold: 0.02 }).observe(canvas);
    }

    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });

    // Когда включается 3D-сцена — 2D-подложка замирает и уходит на второй план
    doc.addEventListener('one1hero:ready', function () {
      stop();
      canvas.classList.add('is-behind');
    });

    start();
  })();

  /* ============================================================
     Мгновенный поиск: счётчик материалов в hero
     ============================================================ */
  (function heroStats() {
    var el = doc.getElementById('stat-articles');
    if (!el) return;
    if (window.allArticles && window.allArticles.length) {
      el.textContent = window.allArticles.length;
    } else {
      var wrap = doc.getElementById('stat-articles-wrap');
      if (wrap) wrap.style.display = 'none';
    }
  })();

  /* ============================================================
     Терминальный движок: загрузочный лог в hero
     ============================================================ */
  (function bootLog() {
    var el = doc.getElementById('boot-log');
    if (!el) return;

    var n = (window.allArticles || []).length;
    var lines = [
      '> one1game://uplink .......... ok',
      '> индекс материалов ......... ' + (n ? n + ' записей' : 'нет данных'),
      '> разделы и фильтры ......... ok',
      '> статус .................... в сети'
    ];

    function markup(arr) {
      return arr.map(function (s) {
        return s
          .replace(/ok\b|в сети/g, '<b>$&</b>')
          .replace(/\.{3,}/g, '<i>$&</i>');
      }).join('\n');
    }

    if (reduceMotion) { el.innerHTML = markup(lines); return; }

    el.textContent = '';
    var i = 0, j = 0, done = [];
    (function step() {
      if (i >= lines.length) { el.innerHTML = markup(lines); return; }
      var partial = lines[i].slice(0, ++j);
      el.textContent = done.concat([partial]).join('\n');
      if (j >= lines[i].length) { done.push(lines[i]); i++; j = 0; setTimeout(step, 150); }
      else setTimeout(step, 11);
    })();
  })();

  /* ============================================================
     Приёмы из топа: прогресс-линия, монтажные метки, HUD, клавиши
     ============================================================ */
  (function shellExtras() {
    function p3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : String(n)); }

    // Прогресс чтения: анимируется CSS scroll-driven, JS не участвует
    var line = doc.createElement('div');
    line.className = 'scroll-line';
    line.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(line);

    // Монтажные метки «производственного кадра»
    var marks = doc.createElement('div');
    marks.className = 'marks';
    marks.setAttribute('aria-hidden', 'true');
    marks.innerHTML = '<i></i><i></i><i></i><i></i>';
    doc.body.appendChild(marks);

    hud();
    keyboard();
    decodeHeadline();

    // ── HUD: телеметрия портала (только десктоп) ──
    function hud() {
      if (!window.matchMedia('(min-width: 900px)').matches) return;

      var el = doc.createElement('div');
      el.className = 'hud';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML =
        '<span>scroll <b id="hud-scroll">000%</b></span>' +
        '<span>section <b id="hud-sec">01</b></span>' +
        '<span>render <b id="hud-fps">--</b></span>' +
        '<span>time <b id="hud-clock">--:--:--</b></span>';
      doc.body.appendChild(el);

      var sScroll = doc.getElementById('hud-scroll');
      var sSec = doc.getElementById('hud-sec');
      var sFps = doc.getElementById('hud-fps');
      var sClock = doc.getElementById('hud-clock');
      var secs = [];

      function collect() { secs = [].slice.call(doc.querySelectorAll('.section-header, .sec')); }

      function update() {
        var max = doc.documentElement.scrollHeight - window.innerHeight;
        var p = max > 0 ? Math.max(0, Math.min(1, (window.scrollY || 0) / max)) : 0;
        sScroll.textContent = p3(Math.round(p * 100)) + '%';

        var probe = (window.scrollY || 0) + window.innerHeight * 0.35;
        var n = 1;
        for (var i = 0; i < secs.length; i++) if (secs[i].offsetTop <= probe) n = i + 1;
        sSec.textContent = p3(n);
      }

      var queued = false;
      window.addEventListener('scroll', function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; update(); });
      }, { passive: true });
      window.addEventListener('resize', function () { collect(); update(); });

      function clock() {
        var d = new Date();
        sClock.textContent = p3(d.getHours()).slice(1) + ':' + p3(d.getMinutes()).slice(1) + ':' + p3(d.getSeconds()).slice(1);
      }

      collect();
      update();
      clock();
      setInterval(clock, 1000);

      var frames = 0, last = performance.now();
      (function loop(now) {
        frames++;
        if (now - last >= 1000) {
          sFps.textContent = String(Math.round((frames * 1000) / (now - last)));
          frames = 0;
          last = now;
        }
        requestAnimationFrame(loop);
      })(last);
    }

    // ── Клавиатурная навигация ──
    function keyboard() {
      var current = null;

      var modal = doc.createElement('div');
      modal.className = 'keys-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-label', 'Горячие клавиши');
      modal.innerHTML =
        '<div class="keys-panel">' +
        '  <h3>управление</h3>' +
        '  <dl>' +
        '    <dt>j / k</dt><dd>следующая / предыдущая запись</dd>' +
        '    <dt>enter</dt><dd>открыть выбранную</dd>' +
        '    <dt>esc</dt><dd>сбросить выбор</dd>' +
        '    <dt>/ · ctrl+k</dt><dd>поиск по материалам</dd>' +
        '    <dt>s</dt><dd>звук интерфейса вкл/выкл</dd>' +
        '    <dt>?</dt><dd>эта подсказка</dd>' +
        '  </dl>' +
        '  <button type="button" class="keys-close">закрыть</button>' +
        '</div>';
      doc.body.appendChild(modal);

      function closeKeys() {
        modal.classList.remove('open');
        lockScroll(false);
      }
      function openKeys() {
        modal.classList.add('open');
        lockScroll(true);
        Sfx.play('open');
      }
      modal.addEventListener('click', function (e) {
        if (e.target === modal || (e.target.closest && e.target.closest('.keys-close'))) closeKeys();
      });

      function items() {
        return [].slice.call(doc.querySelectorAll('.entry, .related-card, .featured-link, .social-btn'));
      }

      function setCurrent(el) {
        if (current && current.classList) current.classList.remove('is-cursor');
        current = el;
        if (!current) return;
        current.classList.add('is-cursor');
        current.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        Sfx.play('hover');
      }

      function move(step) {
        var list = items();
        if (!list.length) return;
        var i = current ? list.indexOf(current) : -1;
        if (i < 0) i = step > 0 ? 0 : list.length - 1;
        else i = (i + step + list.length) % list.length;
        setCurrent(list[i]);
      }

      doc.addEventListener('keydown', function (e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'j' || e.key === 'J') { e.preventDefault(); move(1); return; }
        if (e.key === 'k' || e.key === 'K') { e.preventDefault(); move(-1); return; }
        if (e.key === 'Enter' && current) {
          e.preventDefault();
          current.click();
          return;
        }
        if (e.key === 'Escape') {
          if (modal.classList.contains('open')) { closeKeys(); return; }
          if (current) { setCurrent(null); }
          return;
        }
        if (e.key === '?') { e.preventDefault(); openKeys(); return; }
        if (e.key === 's' || e.key === 'S') { if (sfxBtn) { e.preventDefault(); sfxBtn.click(); } }
      });
    }

    // ── Kinetic typography: декодирование заголовка ──
    function decodeHeadline() {
      var h1 = doc.querySelector('.hero h1');
      if (!h1 || reduceMotion) return;

      var nodes = [];
      (function walk(n) {
        for (var i = 0; i < n.childNodes.length; i++) {
          var c = n.childNodes[i];
          if (c.nodeType === 3 && c.nodeValue.trim()) nodes.push(c);
          else if (c.nodeType === 1 && !c.classList.contains('caret')) walk(c);
        }
      })(h1);
      if (!nodes.length) return;

      var orig = nodes.map(function (n) { return n.nodeValue; });
      var glyphs = '#@%$&*+=<>/\\|_01';
      var dur = 620, t0 = null;

      function restore() {
        for (var k = 0; k < nodes.length; k++) nodes[k].nodeValue = orig[k];
      }
      // Страховка: если кадры не приходят, текст всё равно вернётся
      setTimeout(restore, dur + 600);

      requestAnimationFrame(function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        for (var i = 0; i < nodes.length; i++) {
          var src = orig[i], out = '', keep = Math.floor(src.length * p);
          for (var j = 0; j < src.length; j++) {
            out += j < keep || src[j] === ' ' ? src[j] : glyphs[(Math.random() * glyphs.length) | 0];
          }
          nodes[i].nodeValue = out;
        }
        if (p < 1) requestAnimationFrame(frame); else restore();
      });
    }
  })();

  /* ============================================================
     Процедурные обложки — детерминированный арт под каждую статью
     ============================================================ */
  (function covers() {
    var COVER_W = 320, COVER_H = 180;

    // Рисует процедурную «обложку» и возвращает canvas.
    // Используется и как плейсхолдер карточек, и как текстура 3D-сцены.
    function coverCanvas(seed, w, h) {
      w = Math.max(16, w || COVER_W);
      h = Math.max(16, h || COVER_H);

      var hash = 2166136261;
      var str = String(seed || 'one1game');
      for (var i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      function rnd() {
        hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
        return ((hash >>> 0) % 10000) / 10000;
      }
      var pal = [[125, 255, 155], [96, 190, 130], [157, 178, 168], [255, 192, 97], [72, 120, 96]];
      var a = pal[Math.floor(rnd() * pal.length)];
      var b = pal[Math.floor(rnd() * pal.length)];

      var c = doc.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      if (!g) return c;

      g.fillStyle = '#08080f';
      g.fillRect(0, 0, w, h);

      var cols = [a, b];
      for (var k = 0; k < 3; k++) {
        var col = cols[k % 2];
        var x = rnd() * w, y = rnd() * h, r = (0.4 + rnd() * 0.5) * w;
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(' + col.join(',') + ',0.34)');
        gr.addColorStop(1, 'rgba(' + col.join(',') + ',0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }

      // Диагональная «штриховка» — узнаваемый авторский приём
      g.globalAlpha = 0.06;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      var step = 14 + Math.floor(rnd() * 10);
      for (var x2 = -h; x2 < w; x2 += step) {
        g.beginPath();
        g.moveTo(x2, h);
        g.lineTo(x2 + h, 0);
        g.stroke();
      }
      g.globalAlpha = 1;

      return c;
    }

    function coverURL(seed) {
      try { return coverCanvas(seed, COVER_W, COVER_H).toDataURL('image/jpeg', 0.72); } catch (e) { return ''; }
    }

    window.One1Cover = { canvas: coverCanvas, url: coverURL };

    function apply(img) {
      if (!img || img.dataset.pl) return;
      img.dataset.pl = '1';
      var box = img.parentElement;
      if (!box) return;
      var seed = (img.getAttribute('alt') || '') + (img.getAttribute('src') || '');
      var url = coverURL(seed);
      if (url && box && (box.classList.contains('card-image') || box.classList.contains('entry-thumb') || box.classList.contains('fx'))) {
        box.style.backgroundImage = 'url(' + url + ')';
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
      }
      if (img.complete && img.naturalWidth) {
        img.classList.add('is-loaded');
      } else {
        img.addEventListener('load', function () { img.classList.add('is-loaded'); }, { once: true });
        img.addEventListener('error', function () { img.classList.add('is-loaded'); }, { once: true });
      }
    }

    // Обложки живут и в ленте (.entry-thumb), и в старых плитках (.card-image)
    var IMG_SEL = '.card-image img, .entry-thumb img, .fx img';

    function boxOf(img) {
      var b = img.parentElement;
      return b && (b.classList.contains('card-image') || b.classList.contains('entry-thumb') || b.classList.contains('fx')) ? b : null;
    }

    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      if (node.tagName === 'IMG' && boxOf(node)) { apply(node); return; }
      if (node.querySelectorAll) {
        var imgs = node.querySelectorAll(IMG_SEL);
        for (var i = 0; i < imgs.length; i++) apply(imgs[i]);
      }
    }

    try {
      root.classList.add('covers-on');
      scan(doc.body);
      if ('MutationObserver' in window) {
        new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes;
            for (var j = 0; j < added.length; j++) scan(added[j]);
          }
        }).observe(doc.body, { childList: true, subtree: true });
      }
      // Страховка: если что-то пошло не так — показать все картинки
      setTimeout(function () {
        var imgs = doc.querySelectorAll(IMG_SEL);
        for (var i = 0; i < imgs.length; i++) imgs[i].classList.add('is-loaded');
      }, 3000);
    } catch (e) {
      root.classList.remove('covers-on');
    }
  })();

  /* ============================================================
     Reveal — деликатное появление блоков
     ============================================================ */
  (function reveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var SEL = '.section-header, .featured-banner, .ad-slot, #today-in-history, .article-card, .gh-card, .site-footer, .pagination, .share-section, .related-section';
    var io;
    try {
      root.classList.add('js-anim');
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) show(entries[i].target);
        }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    } catch (e) {
      root.classList.remove('js-anim');
      return;
    }

    function show(el) {
      if (el.dataset.shown) return;
      el.dataset.shown = '1';
      el.classList.add('in');
      if (io) io.unobserve(el);
      // Снимаем reveal-классы после анимации, чтобы не ломать hover-трансформы
      setTimeout(function () { el.classList.remove('reveal', 'in'); }, 700);
    }

    function register(node) {
      if (!node || node.nodeType !== 1 || !node.matches) return;
      var list = node.matches(SEL) ? [node] : [];
      if (node.querySelectorAll) list = list.concat(Array.prototype.slice.call(node.querySelectorAll(SEL)));
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.dataset.reveal) continue;
        el.dataset.reveal = '1';
        el.classList.add('reveal');
        io.observe(el);
      }
    }

    register(doc.body);

    if ('MutationObserver' in window) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) register(added[j]);
        }
      }).observe(doc.body, { childList: true, subtree: true });
    }

    // Страховка: всё, что не попало в обсервер, показываем через 2.5с
    setTimeout(function () {
      var els = doc.querySelectorAll('.reveal:not(.in)');
      for (var i = 0; i < els.length; i++) show(els[i]);
    }, 2500);
  })();
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

    // Current article data
    var canon = document.querySelector('link[rel="canonical"]');
    var currentUrl = canon ? new URL(canon.href).pathname : '';
    var currentArticle = null;

    // Find current article
    for (var i = 0; i < window.allArticles.length; i++) {
      var a = window.allArticles[i];
      var aPath = new URL(a.url, 'https://one1game.github.io').pathname;
      if (aPath === currentUrl) { currentArticle = a; break; }
    }

    var currentCat = currentArticle ? currentArticle.category : '';
    var currentTitle = currentArticle ? (currentArticle.title || '').toLowerCase() : '';

    // Collect words to match: keywords + title words > 2 chars
    var kwMeta = document.querySelector('meta[name="keywords"]');
    var rawKeywords = kwMeta ? kwMeta.getAttribute('content').toLowerCase().split(/,\s*/) : [];
    var matchWords = [];

    // Add cleaned keywords
    for (var k = 0; k < rawKeywords.length; k++) {
      var w = rawKeywords[k].trim();
      if (w.length >= 2) matchWords.push(w);
    }

    // Add words from title (split by non-alpha)
    var titleWords = currentTitle.split(/[^a-zа-яё0-9]/);
    for (var tw = 0; tw < titleWords.length; tw++) {
      var twc = titleWords[tw].trim();
      if (twc.length >= 3) matchWords.push(twc);
    }

    // Deduplicate
    var uniqueWords = [];
    for (var uw = 0; uw < matchWords.length; uw++) {
      if (uniqueWords.indexOf(matchWords[uw]) === -1) uniqueWords.push(matchWords[uw]);
    }

    // Score all articles
    var scored = [];
    for (var j = 0; j < window.allArticles.length; j++) {
      var b = window.allArticles[j];
      var bPath = new URL(b.url, 'https://one1game.github.io').pathname;
      if (bPath === currentUrl) continue;

      var score = 0;
      // Same category bonus
      if (b.category === currentCat) score += 3;

      var bText = ((b.title || '') + ' ' + (b.excerpt || '')).toLowerCase();

      // Match words from current article
      for (var m = 0; m < uniqueWords.length; m++) {
        var mw = uniqueWords[m];
        if (mw.length < 2) continue;
        if (bText.indexOf(mw) !== -1) score += 2;
      }

      scored.push({ article: b, score: score });
    }

    scored.sort(function(x, y) { return y.score - x.score; });

    // Take top 4 that have at least minimal relevance (score > 0)
    var top = [];
    for (var t = 0; t < scored.length && top.length < 4; t++) {
      if (scored[t].score > 0) top.push(scored[t]);
    }

    // Fallback: if nothing found, use recent articles
    if (!top.length) {
      top = scored.slice(0, 4);
    }

    var catClass = function(cat) {
      var map = { 'Гайды': 'cat-guides', 'Аналитика': 'cat-analytics', 'Мнение': 'cat-opinion',
                  'Разработка': 'cat-dev', 'Технологии': 'cat-tech', 'Консоли': 'cat-consoles',
                  'Тренды': 'cat-trends' };
      return map[cat] || '';
    };

    function escapeHTML(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
      });
    }

    var html = '';
    for (var r = 0; r < top.length; r++) {
      var art = top[r].article;
      var safeUrl = escapeHTML(art.url || '#');
      var safeTitle = escapeHTML(art.title || '');
      var safeCategory = escapeHTML(art.category || '');
      var img = art.image ? '<img src="' + escapeHTML(art.image) + '" alt="' + safeTitle + '" loading="lazy" width="1344" height="768">' : '';
      html +=
        '<a href="' + safeUrl + '" class="related-card">' +
          (img ? '<div class="related-img">' + img + '</div>' : '') +
          '<div class="related-info">' +
            '<span class="related-cat ' + catClass(art.category) + '">' + safeCategory + '</span>' +
            '<h5>' + safeTitle + '</h5>' +
          '</div>' +
        '</a>';
    }

    container.innerHTML = html;
  }

  load();
})();
