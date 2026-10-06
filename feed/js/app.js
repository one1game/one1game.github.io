/* app.js — сборка: лента, генерация, оверлеи, пост-эффекты, запись видео */
(function () {
  'use strict';
  const FG = window.FG, M = Math, W = FG.W, H = FG.H, TAU = FG.TAU, sin = FG.sin, cos = FG.cos;
  const { fade, EMS, MEM, MEM2 } = FG.VIS_HELPERS;
  const VI = FG.VISUALS;
  const pick = (a, r) => a[((r ? r() : Math.random()) * a.length) | 0];

  const GEN = { techno: [124, 134], synthwave: [96, 116], dnb: [170, 176], trap: [132, 148], lofi: [70, 84], ambient: [60, 76], cringe: [138, 152], chip: [128, 160], house: [118, 126], phonk: [130, 144], hyperpop: [150, 168], drill: [138, 146] };
  const GENRES = Object.keys(GEN);
  const FX_POOL = FG.FX.map(x => x.name).concat(['grain', 'vignette', 'bloom']);

  const feed = document.getElementById('feed'), tip = document.getElementById('tip');
  let act = null, paused = false, lastSc = -1, seq = 0, bag = [], rec = null, jo = 0, sound = false;

  /* ---------- Генерация одного «ролика» ---------- */
  function mk() {
    const id = (Date.now() % 1e6) + (++seq) * 977, r = FG.rngf(id);
    const PAL = FG.makePalette(r);
    const S = { id, r, h: PAL.h.slice(), sat: PAL.sat, ct: PAL.ct, span: PAL.span, bd: PAL.bd, pal: PAL.name };
    if (!bag.length) { bag = VI.map((_, i) => i).sort(() => M.random() - .5); if (bag[bag.length - 1] == lastSc) bag.reverse(); }
    lastSc = bag.pop(); S.vi = lastSc; S.scene = VI[lastSc]; S.vname = S.scene[0];
    S.genre = pick(GENRES, r); const bg = GEN[S.genre]; S.bpm = bg[0] + (r() * (bg[1] - bg[0]) | 0);
    S.dur = 10 + r() * 25; S.n = 3 + (r() * 6 | 0); S.rot = (r() - .5) * 1.2; S.sp = .5 + r() * 1.2;
    S.a = r(); S.ce = r() * 3 | 0; S.sg = pick(['🗿', '😐', '🤨', '😎', '🧐', '🥸', '😭', '💀'], r); S.hr = 20 + r() * 80;
    S.dn = r() * 3 | 0; S.eyes = 1 + (r() * 3 | 0); S.hat = r() * 4 | 0; S.em = pick(EMS, r); S.gr = r() < .5 ? 0 : 300; S.alg = r() * 3 | 0; S.rad = r() < .5; S.m = r() * 3 | 0;
    S.fx = []; { const v = r(), nfx = v < .2 ? 0 : v < .6 ? 1 : v < .9 ? 2 : 3; const pool = FX_POOL.slice(); for (let k = 0; k < nfx; k++) { const it = pool.splice(r() * pool.length | 0, 1)[0]; if (it) S.fx.push(it); } }
    S.tm = 0; S.p = undefined; S.lut = FG.makeLUT(PAL, S.a);
    const mem = FG.memes.build(S, r);
    S.hook = mem.hook; S.caps = mem.captions; S.cta = mem.cta; S.sfx = mem.sfx; S.sfxI = 0; S.user = mem.user; S.song = mem.song; S.fmt = mem.format;
    S.likes = 120 + r() * r() * 900000 | 0; S.cm = S.likes / 12 | 0; S.bm = S.likes / 9 | 0; S.sh = S.likes / 20 | 0;
    return S;
  }

  /* ---------- Карточка ---------- */
  function add() {
    const S = mk(), c = document.createElement('section'); c.className = 'card';
    c.innerHTML = `<canvas width="${W}" height="${H}"></canvas><div class="shade"></div>` +
      `<div class="info"><b>${S.user}</b><p>${S.hook || S.song}</p><div class="music">♫ ${S.song} · ${S.fmt}</div></div>` +
      `<div class="acts"><button class="act lk"><i>♥</i><span>${FG.fmt(S.likes)}</span></button>` +
      `<button class="act"><i>💬</i><span>${FG.fmt(S.cm)}</span></button>` +
      `<button class="act"><i>🔖</i><span>${FG.fmt(S.bm)}</span></button>` +
      `<button class="act"><i>↪</i><span>${FG.fmt(S.sh)}</span></button>` +
      `<button class="act dl"><i>⬇</i><span>Скачать</span></button></div><div class="prog"></div><div class="pi">⏸</div>`;
    S.g = c.querySelector('canvas').getContext('2d'); S.g.fillStyle = '#000'; S.g.fillRect(0, 0, W, H);
    c.S = S; c.prog = c.querySelector('.prog'); c.pi = c.querySelector('.pi'); c.lk = c.querySelector('.lk'); c.dl = c.querySelector('.dl'); c.lt = 0;
    c.lk.onclick = e => { e.stopPropagation(); c.lk.classList.toggle('on') };
    c.dl.onclick = e => { e.stopPropagation(); toggleRec(c) };
    c.onclick = e => {
      if (e.target.closest('.act')) return;
      if (!sound) { setSound(true); return }
      if (performance.now() - jo < 400) return; const n = performance.now();
      if (n - c.lt < 300) { clearTimeout(c.tm); c.lk.classList.add('on'); const h = document.createElement('div'), b = c.getBoundingClientRect(); h.className = 'heart'; h.textContent = '♥'; h.style.left = e.clientX - b.left + 'px'; h.style.top = e.clientY - b.top + 'px'; c.appendChild(h); setTimeout(() => h.remove(), 800) }
      else c.tm = setTimeout(togglePause, 260);
      c.lt = n;
    };
    feed.appendChild(c); io.observe(c); cards.push(c);
  }
  const cards = [];

  /* ---------- Пост-эффекты ---------- */
  const scC = document.createElement('canvas'); scC.width = 1; scC.height = 3; { const x = scC.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 1, 1) }
  const tmpC = document.createElement('canvas'); tmpC.width = 90; tmpC.height = 160; const tmpG = tmpC.getContext('2d');
  function filterOf(S, t, P) { const F = S.fx; return `hue-rotate(${F.includes('hue') ? t * S.hr % 360 : 0}deg) saturate(${S.sat * (F.includes('fried') ? 2.3 : 1)}) contrast(${S.ct * (F.includes('fried') ? 1.8 : 1)})${F.includes('strobe') && P > .75 ? ' invert(1)' : ''}` }
  function post(g, S, t, o) {
    const c = g.canvas, CW = c.width, CH = c.height, P = o.P, F = S.fx;
    c.style.filter = filterOf(S, t, P);
    c.style.transform = F.includes('shake') ? `translate(${(M.random() - .5) * P * 14}px,${(M.random() - .5) * P * 14}px) scale(1.04)` : F.includes('punch') ? `scale(${1 + P * .2}) rotate(${(M.random() - .5) * P * .06}rad)` : F.includes('pulse') ? `scale(${1 + P * .07})` : '';
    for (const f of F) {
      if (f == 'mirror') { g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(c, 0, 0, CW / 2, CH, 0, 0, W / 2, H); g.restore() }
      else if (f == 'mirrorY') { g.save(); g.translate(0, H); g.scale(1, -1); g.drawImage(c, 0, 0, CW, CH / 2, 0, 0, W, H / 2); g.restore() }
      else if (f == 'zoom') { g.save(); g.globalAlpha = .55; g.translate(W / 2, H / 2); g.rotate(.012 * S.rot); g.scale(1.04, 1.04); g.drawImage(c, -W / 2, -H / 2); g.restore() }
      else if (f == 'ghost') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .4; g.drawImage(c, -6 - P * 10, 0); g.drawImage(c, 6 + P * 10, 0); g.restore() }
      else if (f == 'pixel') { tmpG.drawImage(c, 0, 0, 90, 160); g.imageSmoothingEnabled = false; g.drawImage(tmpC, 0, 0, W, H); g.imageSmoothingEnabled = true }
      else if (f == 'scan') { g.fillStyle = g.createPattern(scC, 'repeat'); g.fillRect(0, 0, W, H) }
      else if (f == 'vhs') { for (let i = 0; i < 4; i++) { const y = M.random() * H, h = 4 + M.random() * 30, ky = CH / H; g.drawImage(c, 0, y * ky, CW, h * ky, (M.random() - .5) * (8 + P * 50), y, W, h) } }
      else if (f == 'wave') { const ky = CH / H; for (let y = 0; y < H; y += 4) g.drawImage(c, 0, y * ky, CW, 4 * ky, sin(y * .03 + t * 3) * (6 + P * 14), y, W, 4) }
      else if (f == 'fried') { tmpG.drawImage(c, 0, 0, 90, 160); g.drawImage(tmpC, 0, 0, W, H); for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${M.random() * 255 | 0},${M.random() * 255 | 0},${M.random() * 255 | 0},.5)`; g.fillRect(M.random() * W, M.random() * H, 2 + M.random() * 5, 2 + M.random() * 5) } }
      else if (f == 'spam') { const bi = o.B | 0; S.sl ||= []; if (S.fb != bi) { S.fb = bi; for (let i = 0; i < 2; i++) S.sl.push({ x: 30 + M.random() * 300, y: 60 + M.random() * 520, e: MEM[M.random() * MEM.length | 0], l: 1, a: (M.random() - .5) * .8, s: 50 + M.random() * 60 }) } g.textAlign = 'center'; g.textBaseline = 'middle'; S.sl = S.sl.filter(q => { q.l -= o.dt * 1.2; if (q.l <= 0) return false; g.save(); g.globalAlpha = M.min(1, q.l * 2); g.translate(q.x, q.y); g.rotate(q.a); const k = 1 + (1 - q.l) * .3; g.scale(k, k); g.font = `${q.s}px serif`; g.fillText(q.e, 0, 0); g.restore(); return true }) }
      else if (f == 'spin') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .3; for (let k = 1; k < 3; k++) { g.translate(W / 2, H / 2); g.rotate(TAU / 3); g.translate(-W / 2, -H / 2); g.drawImage(c, 0, 0) } g.restore() }
      else if (f == 'bloom') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .22; g.drawImage(c, -W * .01, -H * .01, W * 1.02, H * 1.02); g.restore() }
      else if (f == 'vignette') { const gr = g.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)'); g.globalCompositeOperation = 'source-over'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter' }
      else if (f == 'grain') { const n = (CW * CH / 9000) | 0; g.globalCompositeOperation = 'source-over'; for (let i = 0; i < n; i++) { const v = M.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.06)`; g.fillRect(M.random() * W, M.random() * H, 2, 2) } g.globalCompositeOperation = 'lighter' }
    }
  }

  function drawFrame(g, t, oo, S, scale, exp) {
    g.setTransform(scale, 0, 0, scale, 0, 0); g.save();
    if (exp) { const F = S.fx, P = oo.P; g.filter = filterOf(S, t, P);
      if (F.includes('shake')) g.translate((M.random() - .5) * P * 14, (M.random() - .5) * P * 14);
      if (F.includes('punch')) { g.translate(W / 2, H / 2); g.scale(1 + P * .2, 1 + P * .2); g.rotate((M.random() - .5) * P * .06); g.translate(-W / 2, -H / 2) }
      if (F.includes('pulse')) { g.translate(W / 2, H / 2); g.scale(1 + P * .07, 1 + P * .07); g.translate(-W / 2, -H / 2) } }
    S.scene[1](g, t, oo, S);
    if (exp) g.filter = 'none';
    g.restore();
    post(g, S, t, oo);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${oo.Q * .1})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- Запись видео 1080×1920 (MP4/WebM) ---------- */
  const dlSpan = c => c.querySelector('.dl span');
  const EW = 1080, EH = 1920, ESC = EW / W;
  function pickMime() { const l = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; for (const m of l) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m } catch (e) { } } return '' }
  function toggleRec(c) { if (rec && rec.card === c) { stopRec(); return } if (rec) stopRec(); startRec(c) }
  function startRec(c) {
    if (!window.MediaRecorder || !c.querySelector('canvas').captureStream) { dlSpan(c).textContent = 'н/д'; return }
    if (!sound) setSound(true);
    if (act !== c) setActive(c);
    const rc = document.createElement('canvas'); rc.width = EW; rc.height = EH;
    const stream = rc.captureStream(30);
    const rd = FG.audio.recDest;
    if (rd && rd.stream) { const at = rd.stream.getAudioTracks(); if (at.length) { try { stream.addTrack(at[0]) } catch (e) { } } }
    const mime = pickMime(); let mr;
    try { mr = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192e3 }) : new MediaRecorder(stream) } catch (e) { try { mr = new MediaRecorder(stream) } catch (e2) { dlSpan(c).textContent = 'н/д'; return } }
    const ext = ((mr.mimeType || mime || '').indexOf('mp4') >= 0) ? 'mp4' : 'webm';
    const R = { card: c, mr, rc, rx: rc.getContext('2d'), chunks: [], dur: c.S.dur, t0: performance.now(), label: dlSpan(c), last: 0, sfxI: 0 };
    mr.ondataavailable = e => { if (e.data && e.data.size) R.chunks.push(e.data) };
    mr.onstop = () => {
      try { const blob = new Blob(R.chunks, { type: mr.mimeType || ('video/' + ext) }), u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = `one1game-${c.S.vname}-${c.S.id}.${ext}`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) } catch (e) { }
      c.dl.classList.remove('on'); R.label.textContent = ext == 'mp4' ? 'Скачать' : 'Скачать (webm)'; if (rec === R) rec = null;
    };
    if (paused) togglePause();
    { const S = c.S, sv = 60 / S.bpm / 4, tv = S.tm; drawFrame(rc.getContext('2d'), tv, { P: M.exp(-((tv / (sv * 4)) % 1) * 5), Q: M.exp(-((tv / (sv * 16)) % 1) * 4), B: tv / (sv * 4), dt: 0 }, S, ESC, true) }
    rec = R; c.dl.classList.add('on'); R.label.textContent = '● 0с';
    try { mr.start(400) } catch (e) { rec = null; c.dl.classList.remove('on'); R.label.textContent = 'Скачать' }
  }
  function stopRec() { if (rec) { try { rec.mr.stop() } catch (e) { rec = null } if (feed.style.overflowY === 'hidden') feed.style.overflowY = 'scroll' } }

  /* ---------- Аудио-хуки и лента ---------- */
  const startT = c => { stopT(c); c.trk = FG.audio.track(c.S); c.trk.S = c.S; c.trk.start(c.S.tm) }, stopT = c => { if (c && c.trk) { c.trk.stop(); c.trk = null } };
  function setSound(v) { sound = v; FG.audio.sound = v; tip.hidden = v; if (v) jo = performance.now(); if (v) { FG.audio.ac(); if (act && !paused) startT(act) } else stopT(act) }
  function togglePause() { if (!act || rec) return; paused = !paused; act.pi.style.opacity = paused ? 1 : 0; paused ? stopT(act) : (sound && startT(act)) }
  function setActive(c) { if (act === c) return; stopT(act); act = c; paused = false; c.pi.style.opacity = 0; if (sound) startT(c); if (cards.indexOf(c) >= cards.length - 2) { add(); add(); add() } }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(e.target) }), { root: feed, threshold: .6 });

  /* ---------- Мем-звуки по таймлайну ---------- */
  function playSfx(S) { if (!S.sfx) return; const ctx = FG.audio.ctx; while (S.sfxI < S.sfx.length && S.tm >= S.sfx[S.sfxI].at) { const q = S.sfx[S.sfxI++]; if (ctx) FG.audio.hit(q.name, ctx.currentTime, q.v) } }

  /* ---------- Главный цикл ---------- */
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop); const dtR = M.min(.05, (now - last) / 1000); last = now; if (!act || paused) return;
    const S = act.S, g = S.g, sp = 60 / S.bpm / 4;
    if (rec && rec.card === act) {
      const R = rec; if (feed.style.overflowY !== 'hidden') feed.style.overflowY = 'hidden';
      if (now - R.last >= 1000 / 30) {
        const dte = R.last ? M.min(.05, (now - R.last) / 1000) : dtR; R.last = now; S.tm += dte; playSfx(S);
        const t = S.tm, P = M.exp(-((t / (sp * 4)) % 1) * 5), Q = M.exp(-((t / (sp * 16)) % 1) * 4), oo = { P, Q, B: t / (sp * 4), dt: dte };
        drawFrame(R.rx, t, oo, S, ESC, true);
        g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-over';
        if (g.canvas.style.filter && g.canvas.style.filter !== 'none') g.canvas.style.filter = 'none';
        if (g.canvas.style.transform) g.canvas.style.transform = '';
        g.drawImage(R.rc, 0, 0, W, H);
        const sec = (now - R.t0) / 1000; R.label.textContent = sec.toFixed(0) + 'с'; if (sec >= R.dur) stopRec();
      }
      act.prog.style.width = ((S.tm % S.dur) / S.dur * 100) + '%'; return;
    }
    if (feed.style.overflowY === 'hidden') feed.style.overflowY = 'scroll';
    S.tm += dtR; playSfx(S); const t = S.tm, P = M.exp(-((t / (sp * 4)) % 1) * 5), Q = M.exp(-((t / (sp * 16)) % 1) * 4), oo = { P, Q, B: t / (sp * 4), dt: dtR };
    drawFrame(g, t, oo, S, 1, false);
    act.prog.style.width = (t % S.dur) / S.dur * 100 + '%';
  }

  ['pointerup', 'touchend', 'click', 'keydown'].forEach(e => addEventListener(e, () => { if (!sound) setSound(true) }, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!act) return; if (document.hidden) { if (rec) stopRec(); stopT(act) } else if (sound && !paused) startT(act) });
  addEventListener('keydown', e => { if (rec) return; if (e.key == 'ArrowDown') feed.scrollBy({ top: feed.clientHeight, behavior: 'smooth' }); if (e.key == 'ArrowUp') feed.scrollBy({ top: -feed.clientHeight, behavior: 'smooth' }); if (e.key == ' ') { e.preventDefault(); togglePause() } });

  /* ---------- Полный экран (скрывает и интерфейс браузера) ---------- */
  const fsBtn = document.getElementById('fs');
  const isFs = () => document.body.classList.contains('fs');
  function fsRequest(el) {
    try {
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen || el.mozRequestFullScreen;
      if (fn) { const p = fn.call(el); if (p && p.catch) p.catch(() => { }); return true }
    } catch (e) { }
    return false;
  }
  function fsExit() {
    try {
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || document.mozCancelFullScreen;
      if (fn) { const p = fn.call(document); if (p && p.catch) p.catch(() => { }); }
    } catch (e) { }
  }
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  function setFs(on) {
    document.body.classList.toggle('fs', on);
    if (on) fsRequest(document.documentElement); else fsExit();
    if (fsBtn) { fsBtn.textContent = on ? '⤡' : '⛶'; fsBtn.setAttribute('aria-label', on ? 'Выйти из полного экрана' : 'На весь экран') }
  }
  if (fsBtn) fsBtn.addEventListener('click', e => { e.stopPropagation(); setFs(!isFs()) });
  ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (!fsEl() && isFs()) setFs(false) }));

  add(); add(); add(); requestAnimationFrame(loop);
})();
