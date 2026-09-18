// babylon-hero.js — интерактивная 3D-сцена One1Game на Babylon.js
// ---------------------------------------------------------------
// Идея: «стена картриджей» — реальные статьи висят в 3D объёме вокруг ядра,
// реагируют на указатель и скролл, по клику открывается материал.
// Графика процедурная (текстуры рисуются на canvas, ни одного лишнего запроса).
//
// Движок подключается лениво: vendor/babylon-core.js (tree-shaken, 1.3 МБ)
// грузится после первой отрисовки и только если устройство это позволяет.
// Если WebGL/сеть/настройки не позволяют — остаётся 2D-подложка из components.js.
(function () {
  'use strict';

  var doc = document;
  var canvas = doc.getElementById('hero-3d');
  if (!canvas) return;

  var hero = canvas.closest('.hero') || canvas.parentElement;
  var statusEl = doc.getElementById('hero-3d-status');
  var statusText = doc.getElementById('hero-3d-status-text');
  var tipEl = doc.getElementById('hero-tip');

  var SCRIPT_URL = '/vendor/babylon-core.js?v=19';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var slowNet = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
  var lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;
  var cores = navigator.hardwareConcurrency || 4;
  var mobile = !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);

  var BJS = null, engine = null, scene = null, camera = null;
  var chips = [], core = null, ring = null, haze = [];
  var t = 0, pointerX = 0, pointerY = 0, scrollN = 0, visible = true, running = false, started = false;
  var hoverChip = null, downAt = null, compact = false;

  function webglOK() {
    try {
      var c = doc.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function setStatus(mode, text) {
    if (!statusEl) return;
    if (text && statusText) statusText.textContent = text;
    hero.classList.remove('hero--loading', 'hero--live', 'hero--flat');
    if (mode) hero.classList.add('hero--' + mode);
  }

  // ── Публичное состояние (для отладки и для components.js) ──
  window.One1Hero = {
    get state() { return { started: started, running: running, chips: chips.length }; },
    enable: load
  };

  if (reduceMotion || lowMem || !webglOK()) { setStatus('flat'); return; }

  // ── Условия автостарта ──────────────────────────────
  if (slowNet) {
    // Медленная сеть / экономия трафика — не тянем движок сами, даём выбор.
    setStatus('flat', '3D');
    if (statusEl) {
      statusEl.addEventListener('click', load);
      statusEl.setAttribute('role', 'button');
      statusEl.setAttribute('tabindex', '0');
      statusEl.setAttribute('aria-label', 'Включить 3D-сцену');
      statusEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(); }
      });
    }
  } else {
    setStatus('loading', '3D');
    if (window.requestIdleCallback) {
      window.requestIdleCallback(load, { timeout: 2500 });
    } else {
      setTimeout(load, 1400);
    }
  }

  // ── Ленивая загрузка движка ─────────────────────────
  function load() {
    if (started) return;
    started = true;
    setStatus('loading', 'Загрузка сцены');
    var s = doc.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = function () {
      if (window.One1BJS) { try { build(window.One1BJS); } catch (e) { fail(e); } }
      else fail(new Error('no BJS global'));
    };
    s.onerror = function () { fail(new Error('script load failed')); };
    doc.head.appendChild(s);
  }

  function fail(err) {
    started = false;
    setStatus('flat', '3D');
    if (window.console && console.warn) console.warn('[One1Hero] 3D недоступно:', err && err.message);
  }

  // ── Запуск сцены ────────────────────────────────────
  function build(bjs) {
    BJS = bjs;
    compact = canvas.dataset.scene === 'compact';

    engine = new BJS.Engine(canvas, true, {
      alpha: true,
      antialias: !mobile,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    engine.setHardwareScalingLevel(mobile ? (cores <= 4 ? 2 : 1.6) : 1.2);

    scene = new BJS.Scene(engine);
    scene.clearColor = new BJS.Color4(0, 0, 0, 0);
    scene.fogMode = BJS.Scene.FOGMODE_EXP2;
    scene.fogColor = new BJS.Color3(0.016, 0.028, 0.020);
    scene.fogDensity = 0.016;
    scene.skipPointerMovePicking = true;

    var baseBeta = compact ? 1.28 : 1.17;
    var baseRadius = (mobile ? 34 : 30) * (compact ? 1.2 : 1);
    camera = new BJS.ArcRotateCamera('hero-cam', -Math.PI / 2, baseBeta, baseRadius, new BJS.Vector3(0, 0, 0), scene);
    camera.fov = compact ? 0.78 : 0.92;
    camera.minZ = 0.5;
    camera.maxZ = 180;
    camera.beta = baseBeta;
    camera.radius = baseRadius;

    var hemi = new BJS.HemisphericLight('hero-hemi', new BJS.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.3;
    hemi.groundColor = new BJS.Color3(0.04, 0.05, 0.08);

    buildCore();
    buildChips();
    buildHaze();

    scene.registerBeforeRender(tick);
    scene.executeWhenReady(function () {
      setStatus('live', 'Сцена активна');
      canvas.classList.add('is-on');
      doc.dispatchEvent(new CustomEvent('one1hero:ready', { detail: { chips: chips.length } }));
      setTimeout(function () { hero.classList.add('hero--calm'); }, 2200);
    });

    engine.runRenderLoop(renderFrame);
    running = true;

    watchPresence();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    hero.addEventListener('pointermove', onPointerMove, { passive: true });
    hero.addEventListener('pointerdown', onPointerDown, { passive: true });
    hero.addEventListener('pointerup', onPointerUp);
    hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
    doc.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', dispose);
  }

  // ── Ядро: каркасная ико-сфера + тело + кольцо ───────
  function buildCore() {
    core = BJS.CreateIcoSphere('hero-core-wire', { radius: 3.5, subdivisions: 2 }, scene);
    var wm = new BJS.StandardMaterial('hero-core-wire-mat', scene);
    wm.disableLighting = true;
    wm.wireframe = true;
    wm.emissiveColor = new BJS.Color3(0.30, 0.85, 0.45);
    wm.alpha = 0.5;
    wm.backFaceCulling = false;
    core.material = wm;
    core.isPickable = false;

    var body = BJS.CreateIcoSphere('hero-core-body', { radius: 2.05, subdivisions: 3 }, scene);
    var bm = new BJS.StandardMaterial('hero-core-body-mat', scene);
    bm.disableLighting = true;
    bm.emissiveColor = new BJS.Color3(0.02, 0.08, 0.045);
    bm.alpha = 0.92;
    body.material = bm;
    body.isPickable = false;
    body.parent = core;

    ring = BJS.CreateTorus('hero-ring', { diameter: 11.5, thickness: 0.045, tessellation: 96 }, scene);
    var rm = new BJS.StandardMaterial('hero-ring-mat', scene);
    rm.disableLighting = true;
    rm.emissiveColor = new BJS.Color3(0.80, 0.58, 0.26);
    rm.alpha = 0.7;
    ring.material = rm;
    ring.rotation.x = 1.16;
    ring.isPickable = false;
  }

  // ── Картриджи со статьями ───────────────────────────
  function buildChips() {
    var list = window.allArticles || [];
    var max = mobile ? 6 : 12;
    var radius = (mobile ? 11.5 : 13) * (compact ? 1.28 : 1);
    if (compact) max = Math.min(max, 6);

    if (!list.length) return;

    var cw = mobile ? 4.8 : 4.3;
    var ch = cw * 0.5625;
    var texW = mobile ? 256 : 448;
    var texH = Math.round(texW * 0.5625);

    for (var i = 0; i < Math.min(max, list.length); i++) {
      var art = list[i];
      var a = (i / Math.min(max, list.length)) * Math.PI * 2 - Math.PI / 2;
      var y = ((i % 3) - 1) * 1.7 + (i % 2 ? 0.5 : -0.4);

      var plane = BJS.CreatePlane('hero-chip-' + i, { width: cw, height: ch }, scene);
      plane.position = new BJS.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
      plane.rotation.y = Math.PI / 2 - a;
      plane.rotation.z = (i % 2 ? 1 : -1) * 0.035;
      plane.isPickable = true;
      plane.metadata = { chip: i };

      var mat = new BJS.StandardMaterial('hero-chip-mat-' + i, scene);
      mat.disableLighting = true;
      mat.emissiveColor = new BJS.Color3(1, 1, 1);
      mat.specularColor = new BJS.Color3(0, 0, 0);
      mat.backFaceCulling = false;

      var dt = new BJS.DynamicTexture('hero-chip-tex-' + i, { width: texW, height: texH }, scene, false);
      drawChip(dt.getContext(), texW, texH, i, art);
      dt.update(false);

      mat.emissiveTexture = dt;
      plane.material = mat;

      chips.push({
        mesh: plane,
        mat: mat,
        baseY: y,
        baseRotY: plane.rotation.y,
        phase: i * 0.9,
        hover: 0,
        index: i + 1,
        category: art.category || '',
        title: art.title || '',
        url: art.url || ''
      });
    }
  }

  // ── Процедурная текстура картриджа ──────────────────
  // Дизайн симметричен по вертикали намеренно: так он выглядит одинаково
  // при любой ориентации UV, а подписи живут в HTML-подсказке.
  // Палитра монохромная — фосфор + янтарь + алярм (как в styles.css).
  var ACID = [125, 255, 155];
  var AMBER = [255, 192, 97];
  var WARN = [255, 95, 61];

  var CAT_COLORS = {
    'Технологии': ACID,
    'Гайды': ACID,
    'Аналитика': ACID,
    'Тренды': ACID,
    'Кино и игры': ACID,
    'Во что поиграть?': ACID,
    'Мнение': AMBER,
    'Мнения': AMBER,
    'Консоли': AMBER,
    'Разработка': WARN
  };

  function drawChip(ctx, w, h, i, art) {
    var seed = 'chip|' + i + '|' + (art.title || '');
    var accent = CAT_COLORS[art.category] || ACID;

    ctx.clearRect(0, 0, w, h);

    // 1. Процедурная «обложка» (тот же генератор, что у плейсхолдеров карточек)
    var cover = window.One1Cover && window.One1Cover.canvas ? window.One1Cover.canvas(seed, w, h) : null;
    if (cover) {
      ctx.drawImage(cover, 0, 0, w, h);
    } else {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#08130d');
      g.addColorStop(1, '#0c1a12');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Симметричное затемнение сверху и снизу
    var up = ctx.createLinearGradient(0, 0, 0, h * 0.44);
    up.addColorStop(0, 'rgba(4,4,9,0.95)');
    up.addColorStop(1, 'rgba(4,4,9,0)');
    ctx.fillStyle = up;
    ctx.fillRect(0, 0, w, h * 0.44);

    var down = ctx.createLinearGradient(0, h, 0, h * 0.56);
    down.addColorStop(0, 'rgba(4,4,9,0.95)');
    down.addColorStop(1, 'rgba(4,4,9,0)');
    ctx.fillStyle = down;
    ctx.fillRect(0, h * 0.56, w, h * 0.44);

    // 3. Акцентные полосы категории по верхнему и нижнему краю
    var bar = Math.max(3, Math.round(h * 0.036));
    ctx.fillStyle = 'rgba(' + accent.join(',') + ',0.92)';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);

    // 4. «Метки картриджа» по центру
    var mid = h * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(w * 0.12, mid - h * 0.055, w * 0.36, Math.max(2, h * 0.032));
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(w * 0.12, mid + h * 0.02, w * 0.24, Math.max(2, h * 0.024));
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(w * 0.54, mid - h * 0.055, w * 0.34, h * 0.1);

    // 5. Рамка и технические уголки (все четыре — симметрично)
    var line = Math.max(2, Math.round(w / 150));
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = line;
    ctx.strokeRect(line / 2, line / 2, w - line, h - line);

    ctx.strokeStyle = 'rgba(' + accent.join(',') + ',0.9)';
    ctx.lineWidth = line * 1.6;
    var c = Math.round(h * 0.13);
    var pad = line * 3;
    ctx.beginPath();
    ctx.moveTo(pad, pad + c); ctx.lineTo(pad, pad); ctx.lineTo(pad + c, pad);
    ctx.moveTo(w - pad - c, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + c);
    ctx.moveTo(pad, h - pad - c); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + c, h - pad);
    ctx.moveTo(w - pad - c, h - pad); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad, h - pad - c);
    ctx.stroke();
  }

  // ── Дымка: две аддитивные плоскости ─────────────────
  function buildHaze() {
    var tex = new BJS.DynamicTexture('hero-haze-tex', { width: 256, height: 256 }, scene, false);
    var c = tex.getContext();
    var g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(125, 255, 155, 0.42)');
    g.addColorStop(0.45, 'rgba(125, 255, 155, 0.10)');
    g.addColorStop(1, 'rgba(125, 255, 155, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    tex.update(false);
    tex.hasAlpha = true;

    var spots = [
      { x: -17, y: 7, z: -24, s: 52, col: new BJS.Color3(0.22, 0.85, 0.42) },
      { x: 16, y: -6, z: -30, s: 64, col: new BJS.Color3(0.72, 0.48, 0.20) }
    ];

    for (var i = 0; i < spots.length; i++) {
      var p = BJS.CreatePlane('hero-haze-' + i, { size: spots[i].s }, scene);
      p.position = new BJS.Vector3(spots[i].x, spots[i].y, spots[i].z);
      p.isPickable = false;
      var m = new BJS.StandardMaterial('hero-haze-mat-' + i, scene);
      m.disableLighting = true;
      m.emissiveColor = spots[i].col;
      m.emissiveTexture = tex;
      m.alphaMode = 1;            // ALPHA_ADD — мягкое свечение без пост-эффектов
      m.fogEnabled = false;
      m.backFaceCulling = false;
      p.material = m;
      haze.push({ mesh: p, phase: i * 1.7 });
    }
  }

  // ── Анимация ────────────────────────────────────────
  function tick() {
    var dtms = engine.getDeltaTime();
    var k = Math.min(dtms / 16.6, 2.5);
    t += dtms / 1000;

    // Камера: параллакс за указателем + медленный дрейф + зум от скролла
    var aTarget = -Math.PI / 2 + pointerX * 0.24 + Math.sin(t * 0.055) * 0.05;
    var bTarget = (compact ? 1.28 : 1.17) + pointerY * 0.1;
    var rTarget = (mobile ? 34 : 30) * (compact ? 1.2 : 1) - scrollN * 6;
    camera.alpha += (aTarget - camera.alpha) * 0.05 * k;
    camera.beta += (bTarget - camera.beta) * 0.05 * k;
    camera.radius += (rTarget - camera.radius) * 0.05 * k;

    // Картриджи: парение, лёгкое покачивание, наведение
    for (var i = 0; i < chips.length; i++) {
      var ch = chips[i];
      ch.mesh.position.y = ch.baseY + Math.sin(t * 0.7 + ch.phase) * 0.3;
      ch.mesh.rotation.y = ch.baseRotY + Math.sin(t * 0.32 + ch.phase) * 0.07;
      var want = ch.hover ? 1.16 : 1;
      var s = ch.mesh.scaling.x + (want - ch.mesh.scaling.x) * 0.14 * k;
      ch.mesh.scaling.set(s, s, s);
    }

    if (core) core.rotation.y += 0.0018 * k;
    if (ring) ring.rotation.z += 0.0012 * k;

    for (var j = 0; j < haze.length; j++) {
      haze[j].mesh.position.y += Math.sin(t * 0.24 + haze[j].phase) * 0.004 * k;
    }
  }

  function renderFrame() {
    if (doc.hidden) return;
    scene.render();
  }

  // ── Ввод ────────────────────────────────────────────
  // Клики по ссылкам и кнопкам внутри hero не должны превращаться в 3D-переходы
  function isUI(e) {
    return !!(e.target && e.target.closest && e.target.closest('a, button'));
  }

  function esc(s) {
    var d = doc.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function onPointerMove(e) {
    var r = hero.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointerX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));

    if (isUI(e)) { if (hoverChip) onPointerLeave(); return; }
    if (e.pointerType !== 'mouse') return;
    var now = Date.now();
    if (onPointerMove._t && now - onPointerMove._t < 70) return;
    onPointerMove._t = now;
    pickHover(e.clientX, e.clientY);
  }

  function pickHover(cx, cy) {
    if (!scene || !running) return;
    var r = canvas.getBoundingClientRect();
    var hit = scene.pick(cx - r.left, cy - r.top);
    var idx = hit && hit.pickedMesh && hit.pickedMesh.metadata ? hit.pickedMesh.metadata.chip : null;
    var next = (idx === null || idx === undefined) ? null : chips[idx];

    if (next === hoverChip) {
      if (hoverChip && tipEl) placeTip(cx, cy);
      return;
    }

    if (hoverChip) hoverChip.hover = 0;
    hoverChip = next;

    if (hoverChip) {
      hoverChip.hover = 1;
      hero.classList.add('hero--pointing');
      if (tipEl) {
        tipEl.innerHTML =
          '<span class="hero-tip-cat">' + pad2(hoverChip.index) + ' · ' + esc(hoverChip.category) + '</span>' +
          esc(hoverChip.title);
        placeTip(cx, cy);
        tipEl.classList.add('is-on');
      }
      if (window.One1Sfx) window.One1Sfx.play('hover');
    } else {
      hero.classList.remove('hero--pointing');
      if (tipEl) tipEl.classList.remove('is-on');
    }
  }

  function placeTip(cx, cy) {
    if (!tipEl) return;
    var r = hero.getBoundingClientRect();
    var y = cy - r.top;
    tipEl.style.left = Math.round(cx - r.left) + 'px';
    tipEl.style.top = Math.round(y) + 'px';
    // У верхней кромки hero подсказка уезжает под курсор, иначе её обрежет overflow
    tipEl.classList.toggle('hero-tip--below', y < 84);
  }

  function onPointerDown(e) {
    if (isUI(e)) { downAt = null; return; }
    downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
  }

  function onPointerUp(e) {
    if (isUI(e)) { downAt = null; return; }
    if (!downAt) return;
    var dx = Math.abs(e.clientX - downAt.x);
    var dy = Math.abs(e.clientY - downAt.y);
    var quick = Date.now() - downAt.t < 600;
    downAt = null;
    if (dx > 14 || dy > 14 || !quick) return;   // это был свайп/драг, не клик

    var r = canvas.getBoundingClientRect();
    var hit = scene && scene.pick(e.clientX - r.left, e.clientY - r.top);
    var idx = hit && hit.pickedMesh && hit.pickedMesh.metadata ? hit.pickedMesh.metadata.chip : null;
    if (idx === null || idx === undefined) return;

    var chip = chips[idx];
    if (!chip || !chip.url) return;
    if (window.One1Sfx) window.One1Sfx.play('open');
    if (window.One1GameAnalytics) window.One1GameAnalytics.track('hero3d_open', { destination: chip.url });
    chip.hover = 1;
    setTimeout(function () { window.location.href = chip.url; }, 90);
  }

  function onPointerLeave() {
    if (hoverChip) hoverChip.hover = 0;
    hoverChip = null;
    hero.classList.remove('hero--pointing');
    if (tipEl) tipEl.classList.remove('is-on');
  }

  // ── Пауза, когда сцена не видна ─────────────────────
  function watchPresence() {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) resume(); else pause();
    }, { threshold: 0.02 }).observe(hero);
  }

  function pause() { if (engine && running) { engine.stopRenderLoop(); running = false; } }
  function resume() {
    if (!engine || running || doc.hidden) return;
    engine.runRenderLoop(renderFrame);
    running = true;
  }

  function onVisibility() { if (doc.hidden) pause(); else if (visible) resume(); }
  function onScroll() {
    if (!hero.offsetHeight) return;
    scrollN = Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset || 0) / hero.offsetHeight));
  }
  function onResize() { if (engine) engine.resize(); }

  function dispose() {
    try {
      if (engine) { engine.stopRenderLoop(); }
      if (scene) { scene.dispose(); }
      if (engine) { engine.dispose(); }
      for (var i = 0; i < chips.length; i++) {
        var tex = chips[i].mat && chips[i].mat.emissiveTexture;
        if (tex && tex.dispose) tex.dispose();
      }
    } catch (e) { /* игнорируем: страница уходит */ }
    chips = []; haze = []; scene = null; engine = null; running = false;
  }
})();
