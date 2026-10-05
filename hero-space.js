// hero-space.js — реалистичное звёздное небо в шапке One1Game
// ---------------------------------------------------------------
// Чистый canvas 2D, без WebGL, внешних запросов и реакции на курсор.
// Слои (как в астрофото):
//   1) запечённое небо — глубокий градиент, туманности, Млечный путь
//      с пылевыми прожилками и звёздной россыпью вдоль ленты;
//   2) звёзды по спектральным классам (синие → оранжевые), яркость по
//      звёздной величине, мягкое мерцание, дифракционные лучи у ярких;
//   3) редкие кометы с градиентным хвостом.
// Движение — только естественный медленный дрейф слоёв и мерцание.
// Если включён prefers-reduced-motion — рисуется один статичный кадр.
(function () {
  'use strict';

  var doc = document;
  var canvas = doc.getElementById('hero-space');
  if (!canvas) return;

  var hero = canvas.closest('.hero') || canvas.parentElement;

  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(conn && conn.saveData);

  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 1, H = 1;
  var running = false, raf = 0, inView = true;
  var t = 0, lastDraw = 0, started = false;

  // Наклон галактической ленты — общий для неба и россыпи звёзд
  var BAND = -0.34;

  var stars = [];
  var comets = [];
  var nebula = null;
  var sprites = {};      // спрайты свечения по цветам
  var spikeSprite = null;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ── Спектральные классы: цвет + доля в выборке ──────
  var SPECTRA = [
    { rgb: '150,172,255', w: 0.04 },   // O/B — голубые
    { rgb: '196,214,255', w: 0.09 },   // A — бело-голубые
    { rgb: '247,247,255', w: 0.22 },   // F — белые
    { rgb: '255,244,228', w: 0.30 },   // G — желтовато-белые
    { rgb: '255,212,164', w: 0.24 },   // K — оранжевые
    { rgb: '255,176,126', w: 0.11 }    // M — красноватые
  ];
  function pickSpectrum() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < SPECTRA.length; i++) {
      acc += SPECTRA[i].w;
      if (r <= acc) return SPECTRA[i].rgb;
    }
    return SPECTRA[0].rgb;
  }

  // ── Спрайт свечения звезды ──────────────────────────
  function glowSprite(rgb) {
    var size = 32, h = size / 2;
    var c = doc.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(h, h, 0, h, h, h);
    grd.addColorStop(0, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.18, 'rgba(' + rgb + ',0.78)');
    grd.addColorStop(0.46, 'rgba(' + rgb + ',0.20)');
    grd.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(h, h, h, 0, 6.2832); g.fill();
    return c;
  }

  // ── Спрайт яркой звезды: ореол + дифракционные лучи ──
  function makeSpikeSprite() {
    var size = 176, m = size / 2;
    var c = doc.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');

    var halo = g.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.05, 'rgba(255,255,255,0.5)');
    halo.addColorStop(0.22, 'rgba(214,228,255,0.10)');
    halo.addColorStop(0.55, 'rgba(190,210,255,0.03)');
    halo.addColorStop(1, 'rgba(190,210,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);

    function spike(x, y, w, a) {
      var grd = g.createLinearGradient(m, m, x, y);
      grd.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      grd.addColorStop(0.35, 'rgba(255,255,255,' + (a * 0.22) + ')');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(m, m); g.lineTo(x, y); g.stroke();
    }
    var len = m * 0.96;
    spike(m, m - len, 1.7, 0.9);   // вертикаль
    spike(m, m + len, 1.7, 0.9);
    spike(m - len, m, 1.7, 0.9);   // горизонталь
    spike(m + len, m, 1.7, 0.9);
    var d = len * 0.34;
    spike(m - d, m - d, 0.9, 0.35); // короткие диагонали
    spike(m + d, m + d, 0.9, 0.35);
    spike(m + d, m - d, 0.9, 0.35);
    spike(m - d, m + d, 0.9, 0.35);

    return c;
  }

  // ── Небо: туманности, Млечный путь, пыль ────────────
  function buildNebula() {
    var S = 0.62;
    var w = Math.max(2, Math.round(W * S));
    var h = Math.max(2, Math.round(H * S));
    var c = doc.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#04050c');
    base.addColorStop(0.5, '#050610');
    base.addColorStop(1, '#030409');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'lighter';

    // Мягкие, приглушённые туманности
    var clouds = [
      { x: 0.20, y: 0.36, r: 0.60, c: [78, 64, 156], a: 0.22 },
      { x: 0.28, y: 0.46, r: 0.32, c: [132, 74, 158], a: 0.16 },
      { x: 0.62, y: 0.28, r: 0.54, c: [42, 98, 168], a: 0.20 },
      { x: 0.50, y: 0.72, r: 0.58, c: [34, 108, 128], a: 0.15 },
      { x: 0.86, y: 0.60, r: 0.40, c: [150, 104, 72], a: 0.10 },
      { x: 0.08, y: 0.78, r: 0.46, c: [72, 66, 152], a: 0.16 },
      { x: 0.40, y: 0.16, r: 0.34, c: [58, 96, 176], a: 0.13 },
      { x: 0.70, y: 0.84, r: 0.38, c: [116, 78, 168], a: 0.12 }
    ];
    var big = Math.max(w, h);
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      var cx = cl.x * w, cy = cl.y * h, cr = cl.r * big;
      var grd = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      grd.addColorStop(0, 'rgba(' + cl.c.join(',') + ',' + cl.a + ')');
      grd.addColorStop(0.4, 'rgba(' + cl.c.join(',') + ',' + (cl.a * 0.4) + ')');
      grd.addColorStop(0.72, 'rgba(' + cl.c.join(',') + ',' + (cl.a * 0.1) + ')');
      grd.addColorStop(1, 'rgba(' + cl.c.join(',') + ',0)');
      g.fillStyle = grd;
      g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }

    // Млечный путь: широкое свечение вдоль наклонной ленты
    g.save();
    g.translate(w * 0.5, h * 0.44);
    g.rotate(BAND);
    for (var b = 0; b < 3; b++) {
      var bw = h * (1.55 - b * 0.42);
      var mg = g.createLinearGradient(0, -bw / 2, 0, bw / 2);
      mg.addColorStop(0, 'rgba(122,140,215,0)');
      mg.addColorStop(0.5, 'rgba(150,166,224,' + (0.045 + b * 0.018).toFixed(3) + ')');
      mg.addColorStop(1, 'rgba(122,140,215,0)');
      g.fillStyle = mg;
      g.fillRect(-w, -bw / 2, w * 2, bw);
    }

    // Пылевые прожилки поверх ленты
    g.globalCompositeOperation = 'source-over';
    for (var d = 0; d < 48; d++) {
      var yy = (Math.random() - 0.5) * h * 1.1;
      var th = h * (0.006 + Math.random() * 0.026);
      var xx = -w + Math.random() * w * 2;
      var len = w * (0.18 + Math.random() * 0.7);
      var dg = g.createLinearGradient(xx, 0, xx + len, 0);
      dg.addColorStop(0, 'rgba(3,4,10,0)');
      dg.addColorStop(0.5, 'rgba(3,4,10,' + (0.16 + Math.random() * 0.34).toFixed(2) + ')');
      dg.addColorStop(1, 'rgba(3,4,10,0)');
      g.fillStyle = dg;
      g.fillRect(xx, yy, len, th);
    }
    g.restore();

    // Россыпь очень слабых звёзд внутри ленты (запекаем — дёшево)
    g.globalCompositeOperation = 'lighter';
    var bandStars = Math.round(w * h / 900);
    var dx = Math.cos(BAND), dy = Math.sin(BAND);
    for (var s = 0; s < bandStars; s++) {
      var along = (Math.random() - 0.5) * w * 1.4;
      var off = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * h * 0.13;
      var px = w * 0.5 + dx * along - dy * off;
      var py = h * 0.44 + dy * along + dx * off;
      if (px < -2 || px > w + 2 || py < -2 || py > h + 2) continue;
      var a = 0.05 + Math.random() * 0.22;
      g.fillStyle = 'rgba(220,228,255,' + a.toFixed(3) + ')';
      g.fillRect(px, py, 0.8, 0.8);
    }

    // Пара ярких ядер туманностей
    var cores = [[0.24, 0.42, 0.85], [0.60, 0.30, 0.6]];
    for (var k = 0; k < cores.length; k++) {
      var ox = cores[k][0] * w, oy = cores[k][1] * h, orr = cores[k][2] * h * 0.15;
      var cg = g.createRadialGradient(ox, oy, 0, ox, oy, orr);
      cg.addColorStop(0, 'rgba(228,232,255,0.34)');
      cg.addColorStop(0.4, 'rgba(196,206,255,0.10)');
      cg.addColorStop(1, 'rgba(196,206,255,0)');
      g.fillStyle = cg;
      g.fillRect(ox - orr, oy - orr, orr * 2, orr * 2);
    }

    g.globalCompositeOperation = 'source-over';
    return c;
  }

  // ── Генерация звёзд ─────────────────────────────────
  function seedStars() {
    var total = Math.round(Math.min(700, Math.max(200, (W * H) / 1700)));
    var layers = [
      { share: 0.58, r: [0.45, 0.9], mul: 0.75, drift: 2.2, tw: [0.4, 1.0], depth: 0 },
      { share: 0.30, r: [0.8, 1.6], mul: 1.0, drift: 5.5, tw: [0.8, 1.6], depth: 1 },
      { share: 0.12, r: [1.3, 2.6], mul: 1.2, drift: 9.0, tw: [1.2, 2.2], depth: 2 }
    ];
    stars = [];
    for (var L = 0; L < layers.length; L++) {
      var ly = layers[L];
      var n = Math.max(8, Math.round(total * ly.share));
      for (var i = 0; i < n; i++) {
        pushStar(Math.random() * W, Math.random() * H, ly, false);
      }
    }

    // Россыпь вдоль Млечного пути
    var milky = Math.round(total * 0.34);
    var dx = Math.cos(BAND), dy = Math.sin(BAND);
    var bandLayer = { r: [0.4, 0.8], mul: 0.6, drift: 2.4, tw: [0.4, 1.0], depth: 0 };
    for (var m = 0; m < milky; m++) {
      var along = (Math.random() - 0.5) * W * 1.4;
      var off = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * H * 0.15;
      var x = W * 0.5 + dx * along - dy * off;
      var y = H * 0.44 + dy * along + dx * off;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      pushStar(x, y, bandLayer, false);
    }
  }

  function pushStar(x, y, ly, forceBright) {
    var rgb = pickSpectrum();
    // Распределение по величине: ярких мало, слабых много
    var mag = Math.pow(Math.random(), 2.6);
    // Слабые звёзды редко мерцают заметно (атмосферная турбулентность)
    var bright = forceBright || (mag > 0.965 && ly.depth >= 1);
    stars.push({
      x: x, y: y,
      size: rand(ly.r[0], ly.r[1]) * (0.7 + mag * 0.9),
      baseA: (0.28 + mag * 0.72) * ly.mul,
      tw: rand(ly.tw[0], ly.tw[1]),
      phase: Math.random() * 6.2832,
      drift: ly.drift * rand(0.6, 1.4) * 0.1,
      sprite: sprites[rgb],
      bright: bright
    });
  }

  // ── Раскладка ───────────────────────────────────────
  function layout() {
    var rect = hero.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(180, Math.round(rect.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    nebula = buildNebula();
    seedStars();
  }

  // ── Кадр ────────────────────────────────────────────
  function draw(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Небо с еле заметным дрейфом
    var nx = -6 + Math.sin(t * 0.02) * 4;
    var ny = -6 + Math.cos(t * 0.017) * 4;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(nebula, nx, ny, W + 12, H + 12);

    // Звёзды
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.drift * dt;
      if (s.x > W + 3) s.x -= W + 6;

      // Мерцание: медленная волна + лёгкая быстрая рябь
      var w1 = Math.sin(t * s.tw + s.phase);
      var w2 = Math.sin(t * s.tw * 2.7 + s.phase * 1.7);
      var flick = 0.72 + 0.22 * w1 + 0.06 * w2;
      var a = s.baseA * flick;
      if (a <= 0.01) continue;

      var sz = s.size * (0.95 + 0.1 * w1);
      ctx.globalAlpha = a > 1 ? 1 : a;

      if (s.bright) {
        var bs = sz * 11;
        ctx.drawImage(spikeSprite, s.x - bs / 2, s.y - bs / 2, bs, bs);
      }
      ctx.drawImage(s.sprite, s.x - sz * 1.6, s.y - sz * 1.6, sz * 3.2, sz * 3.2);
    }
    ctx.globalAlpha = 1;

    // Кометы
    for (var m = comets.length - 1; m >= 0; m--) {
      var cm = comets[m];
      cm.age += dt;
      if (cm.age >= cm.ttl || cm.x < -200 || cm.x > W + 200 || cm.y > H + 200) {
        comets.splice(m, 1);
        continue;
      }
      cm.x += cm.vx * dt;
      cm.y += cm.vy * dt;
      var prog = cm.age / cm.ttl;
      var alpha = Math.sin(prog * Math.PI) * cm.peak;

      var tx = cm.x - cm.vx * 0.22;
      var ty = cm.y - cm.vy * 0.22;
      var grd = ctx.createLinearGradient(cm.x, cm.y, tx, ty);
      grd.addColorStop(0, 'rgba(255,255,255,' + alpha.toFixed(3) + ')');
      grd.addColorStop(0.16, 'rgba(206,228,255,' + (alpha * 0.7).toFixed(3) + ')');
      grd.addColorStop(0.55, 'rgba(160,196,255,' + (alpha * 0.22).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(140,180,255,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = cm.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cm.x, cm.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Головка
      var hs = cm.w * 3.2;
      var hg = ctx.createRadialGradient(cm.x, cm.y, 0, cm.x, cm.y, hs);
      hg.addColorStop(0, 'rgba(255,255,255,' + alpha.toFixed(3) + ')');
      hg.addColorStop(0.4, 'rgba(214,232,255,' + (alpha * 0.5).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(180,210,255,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cm.x, cm.y, hs, 0, 6.2832);
      ctx.fill();
    }

    // Низ растворяется в фон страницы
    ctx.globalCompositeOperation = 'source-over';
    var fade = ctx.createLinearGradient(0, H * 0.60, 0, H);
    fade.addColorStop(0, 'rgba(4,6,10,0)');
    fade.addColorStop(1, 'rgba(4,6,10,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, H * 0.60, W, H * 0.40);
  }

  function spawnComet() {
    // Летят сверху вниз под небольшим наклоном, изредка снизу вверх
    var down = Math.random() < 0.78;
    var dir = Math.random() < 0.5 ? 1 : -1;
    var sp = rand(420, 760);
    var ang = rand(0.22, 0.46);
    comets.push({
      x: dir > 0 ? rand(-0.12, 0.65) * W : rand(0.35, 1.12) * W,
      y: down ? rand(-0.12, 0.22) * H : rand(0.85, 1.12) * H,
      vx: Math.cos(ang) * sp * dir,
      vy: (down ? 1 : -1) * Math.sin(ang) * sp,
      age: 0,
      ttl: rand(0.9, 1.5),
      w: rand(1.1, 2.0),
      peak: rand(0.7, 1.0)
    });
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (doc.hidden || !inView) { lastDraw = now; return; }
    if (now - lastDraw < 30) return;
    var dt = Math.min((now - lastDraw) / 1000, 0.06);
    lastDraw = now;
    t += dt;

    if (comets.length < 2 && Math.random() < dt * 0.16) spawnComet();

    draw(dt);
  }

  function start() {
    if (running || doc.hidden || !inView) return;
    running = true;
    lastDraw = (window.performance && performance.now) ? performance.now() : Date.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function ready() {
    if (started) return;
    started = true;
    canvas.classList.add('is-on');
    doc.dispatchEvent(new CustomEvent('one1hero:ready', { detail: { mode: '2d' } }));
  }

  // ── Видимость / ресайз ──────────────────────────────
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }, { threshold: 0.02 }).observe(hero);
  }

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) stop(); else start();
  });

  var rT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      layout();
      if (!running) draw(0.016);
    }, 180);
  });

  // ── Старт ───────────────────────────────────────────
  for (var si = 0; si < SPECTRA.length; si++) sprites[SPECTRA[si].rgb] = glowSprite(SPECTRA[si].rgb);
  spikeSprite = makeSpikeSprite();

  layout();
  draw(0.016);
  ready();

  if (!reduceMotion && !saveData) start();
})();
