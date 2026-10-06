/* audio.js — генеративный музыкальный движок + мем-звуки */
window.FG = window.FG || {};
(function (FG) {
  'use strict';
  const M = Math;

  let AC, master, noiseBuf, sound = false, recDest = null;

  function ac() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = .8;
      const c = AC.createDynamicsCompressor(); master.connect(c); c.connect(AC.destination);
      if (AC.createMediaStreamDestination) { recDest = AC.createMediaStreamDestination(); c.connect(recDest); }
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1;
    }
    if (AC.state != 'running') AC.resume();
    return AC;
  }

  const mtof = m => 440 * 2 ** ((m - 69) / 12);
  const SCALES = [[0, 2, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 9, 10], [0, 1, 3, 5, 7, 8, 10], [0, 3, 5, 7, 10], [0, 2, 4, 7, 9]];
  const GEN = {
    techno: [124, 134], synthwave: [96, 116], dnb: [170, 176], trap: [132, 148],
    lofi: [70, 84], ambient: [60, 76], cringe: [138, 152], chip: [128, 160],
    house: [118, 126], phonk: [130, 144], hyperpop: [150, 168], drill: [138, 146],
  };
  const GK = Object.keys(GEN);

  function track(S) {
    const r = FG.rngf(S.id * 31 + 5), g = S.genre, sp = 60 / S.bpm / 4;
    const sc = SCALES[(g == 'ambient' || g == 'lofi') ? r() * 2 | 0 : r() * SCALES.length | 0];
    const root = 31 + (r() * 12 | 0);
    const note = (d, o = 0) => root + 12 * (o + M.floor(d / sc.length)) + sc[((d % sc.length) + sc.length) % sc.length];
    const bp = Array.from({ length: 16 }, () => r() < .6 ? (r() * 5 | 0) : -1);
    const ap = Array.from({ length: 16 }, () => r() < .65 ? (r() * 9 | 0) : -1);
    const pr = [0, r() * 7 | 0, r() * 7 | 0, r() * 7 | 0];
    let bus, send, iv;

    const o = (ty, f, t, d, v, p = {}) => {
      const x = AC.createOscillator(), n = AC.createGain(); x.type = ty; x.frequency.setValueAtTime(f, t);
      if (p.to) x.frequency.exponentialRampToValueAtTime(p.to, t + d * .35);
      if (p.det) x.detune.value = p.det;
      let q = x;
      if (p.lp) { q = AC.createBiquadFilter(); q.frequency.setValueAtTime(p.lp, t); q.frequency.exponentialRampToValueAtTime(p.lp2 || 150, t + d); x.connect(q); }
      q.connect(n);
      n.gain.setValueAtTime(.0001, t); n.gain.linearRampToValueAtTime(v, t + (p.a || .004)); n.gain.exponentialRampToValueAtTime(.0001, t + d);
      n.connect(bus); if (p.fx) n.connect(send); x.start(t); x.stop(t + d + .05);
    };
    const nz = (t, d, v, ty, f) => {
      const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), n = AC.createGain();
      s.buffer = noiseBuf; fl.type = ty; fl.frequency.value = f; s.connect(fl); fl.connect(n);
      n.gain.setValueAtTime(v, t); n.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(bus); s.start(t, M.random() * .5); s.stop(t + d + .02);
    };
    const kick = (t, v = .9) => o('sine', 165, t, .38, v, { to: 42 });
    const snare = (t, v = .5) => { nz(t, .16, v, 'bandpass', 1900); o('triangle', 200, t, .1, v * .5); };
    const clap = (t, v = .5) => { nz(t, .05, v, 'highpass', 1500); nz(t + .012, .12, v, 'highpass', 1300); };
    const hat = (t, v = .18, op) => nz(t, op ? .2 : .045, v, 'highpass', 7500);
    const bass = (t, m, d, ty = 'sawtooth', v = .32) => o(ty, mtof(m), t, d, v, { lp: 900, lp2: 130 });
    const lead = (t, m, d, ty, v = .1) => o(ty, mtof(m), t, d, v, { lp: 3800, lp2: 700, fx: 1 });
    const pad = (t, bd, d, v = .045) => [0, 2, 4].forEach((k, j) => o('sawtooth', mtof(note(bd + k, 2)), t, d, v, { a: d * .35, lp: 1100, lp2: 300, det: j * 6 - 6 }));
    const horn = t => [0, .14, .28].forEach(d => [440, 554, 659].forEach(f => o('sawtooth', f * 1.5, t + d, .12, .08, { lp: 4000, lp2: 2000 })));

    const step = (s, t) => {
      const i = s % 16, b = (s >> 4) % 4, d = pr[b], A = ap[i], Bs = bp[i];
      if (g == 'lofi' && i % 2) t += sp * .3;
      if (i == 0 && !['techno', 'trap', 'cringe', 'chip', 'house', 'phonk', 'drill', 'hyperpop'].includes(g)) pad(t, d, sp * 16 * (g == 'ambient' ? 1 : .95), g == 'ambient' ? .07 : .04);
      switch (g) {
        case 'techno': if (i % 4 == 0) kick(t); if (i % 4 == 2) hat(t, .2, 1); else if (i % 2) hat(t, .07); if (i == 4 || i == 12) clap(t, .4); if (Bs >= 0 && i % 4) bass(t, note(d + Bs % 3, 1), sp * .8); if (A >= 0 && i % 2) lead(t, note(d + A, 3), sp * .9, 'sawtooth', .07); break;
        case 'synthwave': if (i == 0 || i == 8 || (i == 10 && b % 2)) kick(t, .8); if (i == 4 || i == 12) snare(t, .55); if (i % 2 == 0) { hat(t, .12, i % 4 == 2); bass(t, note(d, 1), sp * 1.7, 'sawtooth', .28); if (A >= 0) lead(t, note(d + A, 3), sp * 1.5, 'square', .08); } break;
        case 'dnb': if (i == 0 || i == 10) kick(t, .9); if (i == 4 || i == 12) snare(t, .6); if (i == 7 || i == 15) snare(t, .15); if (i % 2 == 0) hat(t, .1, i == 14); if (i == 0 || i == 6 || i == 8) bass(t, note(d, 0), sp * (i == 0 ? 5 : 2), 'sawtooth', .33); if (A >= 0 && i % 4 == 3) lead(t, note(d + A, 3), sp * 2, 'triangle', .1); break;
        case 'trap': if (i == 0 || i == 7 || i == 10 || (i == 13 && b == 3)) kick(t, .8); if (i == 8) { clap(t, .55); snare(t, .3); } hat(t, i % 2 ? .06 : .12); if (i >= 12 && b % 2) hat(t + sp / 2, .07); if (i == 0 || i == 3 || i == 10 || i == 14) { const f = mtof(note(d, 0)); o('sine', f, t, sp * (i == 0 ? 6 : 3), .75, { to: f * .93 }); } if (A >= 0 && i % 2 == 0) lead(t, note(d + A, 4), sp * 2, 'sine', .09); break;
        case 'lofi': if (i == 0 || i == 10) kick(t, .6); if (i == 4 || i == 12) snare(t, .28); if (i % 2 == 0) hat(t, .06); if (i == 0 || i == 6 || i == 10) [0, 2, 4, 6].forEach(k => o('triangle', mtof(note(d + k, 2)), t, sp * 3, .07, { lp: 1500, lp2: 500, fx: 1 })); if (i % 8 == 0) bass(t, note(d, 0), sp * 6, 'sine', .5); if (A >= 0 && A < 6 && i % 2 == 0) lead(t, note(d + A, 3), sp * 2, 'sine', .09); break;
        case 'chip': if (i % 8 == 0) kick(t, .6); if (i % 8 == 4) snare(t, .35); hat(t, .07 + (i % 2) * .04); lead(t, note(d + [0, 2, 4, 7][i % 4], 3), sp * .8, 'square', .07); if (i % 4 == 0) bass(t, note(d, 1), sp * 3, 'square', .22); if (A >= 0 && i % 2) lead(t, note(d + A, 4), sp * .6, 'square', .05); break;
        case 'house': if (i % 4 == 0) kick(t, .85); if (i == 4 || i == 12) clap(t, .4); if (i % 4 == 2) { hat(t, .2, 1); bass(t, note(d, 1), sp * 1.6, 'sawtooth', .28); } if (i == 3 || i == 6 || i == 10 || i == 13) [0, 2, 4].forEach(k => o('sawtooth', mtof(note(d + k, 2)), t, sp * 1.4, .05, { lp: 2600, lp2: 500, fx: 1 })); break;
        case 'phonk': { const cow = (t, v) => { o('square', 845, t, .16, v, { lp: 2400, lp2: 900 }); o('square', 560, t, .16, v, { lp: 2400, lp2: 900 }); }; if (i == 0 || i == 6 || i == 10) kick(t, .95); if (i == 4 || i == 12) clap(t, .5); if (i % 2 == 0) hat(t, .1); if (i == 3 || i == 7 || i == 11 || i == 14) cow(t, .1); if (i == 0 || i == 6 || i == 10) { const f = mtof(note(d, 0)); o('sine', f * 1.5, t, sp * 4, .7, { to: f * .9 }); } if (A >= 0 && i % 2) lead(t, note(d + A, 3), sp * 1.2, 'sawtooth', .07); if (i == 0 && b == 3) horn(t); break; }
        case 'cringe': if (i % 4 == 0) kick(t, .8); if (i % 4 == 2) hat(t, .18, 1); if (i == 4 || i == 12) clap(t, .45); if (A >= 0) lead(t, note(d + A, 4), sp * .9, 'square', .08); if (i % 2 == 0) bass(t, note(d, 1), sp * 1.5, 'sawtooth', .25); if (i == 14 && b % 2) o('sine', 220, t, .3, .3, { to: 900, fx: 1 }); if (i == 0 && b == 0) o('sine', 90, t, .7, .9, { to: 35 }); if (i == 8 && b == 3) horn(t); break;
        case 'hyperpop': if (i % 4 == 0) kick(t, .85); if (i % 2) hat(t, .09, i % 4 == 1); if (i == 4 || i == 12) snare(t, .45); if (A >= 0) lead(t, note(d + A, 4), sp * .7, 'square', .09); if (i % 4 == 0) bass(t, note(d, 1), sp * 1.2, 'sawtooth', .3); if (i == 8) pad(t, d, sp * 4, .06); break;
        case 'drill': if (i == 0 || i == 6 || i == 10) kick(t, .9); if (i == 8) clap(t, .5); if (i % 2 == 0) hat(t, .09, i % 4 == 2); if (i == 0 || i == 5 || i == 11) bass(t, note(d, 0), sp * 3, 'sawtooth', .35); if (A >= 0 && i % 4 == 1) lead(t, note(d + A, 3), sp * 1.2, 'triangle', .08); break;
        default: if (A >= 0 && i % 2 == 0) lead(t, note(d + A, 3 + (A & 1)), sp * 5, 'sine', .1); if (i == 0) bass(t, note(d, 0), sp * 16, 'sine', .35);
      }
    };
    return {
      start(vt) {
        ac(); bus = AC.createGain(); bus.connect(master);
        const dl = AC.createDelay(1), fb = AC.createGain(); send = AC.createGain();
        send.gain.value = g == 'ambient' ? .7 : .35; dl.delayTime.value = sp * 3; fb.gain.value = .4;
        send.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(bus);
        let s = M.floor(vt / sp) + 1, nt = AC.currentTime + (1 - (vt / sp) % 1) * sp;
        iv = setInterval(() => { while (nt < AC.currentTime + .15) { step(s++, nt); if (SFX.onStep) SFX.onStep(s, nt); nt += sp; } }, 25);
      },
      stop() { clearInterval(iv); if (bus) { bus.gain.setTargetAtTime(0, AC.currentTime, .02); const b = bus; setTimeout(() => b.disconnect(), 400); } }
    };
  }

  /* ---------- Мем-звуки (вставляются на биты) ---------- */
  const SFX = { onStep: null };
  function hit(name, t, v = .5) {
    if (!AC) return;
    const g = AC.createGain(); g.connect(master);
    if (name == 'boom') { // vine boom
      const x = AC.createOscillator(); x.type = 'sine';
      x.frequency.setValueAtTime(180, t); x.frequency.exponentialRampToValueAtTime(48, t + .5);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
      x.connect(g); x.start(t); x.stop(t + .65);
    } else if (name == 'airhorn') {
      [0, .06, .12].forEach((d, i) => { const x = AC.createOscillator(); x.type = 'sawtooth'; x.frequency.value = 480 + i * 6; const ng = AC.createGain(); ng.gain.setValueAtTime(v * .5, t + d); ng.gain.exponentialRampToValueAtTime(.0001, t + d + .35); x.connect(ng); ng.connect(master); x.start(t + d); x.stop(t + d + .4); });
    } else if (name == 'bruh') {
      const x = AC.createOscillator(); x.type = 'sawtooth';
      x.frequency.setValueAtTime(220, t); x.frequency.exponentialRampToValueAtTime(90, t + .25);
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(v * .4, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
      x.connect(f); f.connect(g); x.start(t); x.stop(t + .35);
    }
  }

  FG.audio = {
    ac, track, hit, SFX,
    get recDest() { return recDest; },
    get ctx() { return AC; },
    get master() { return master; },
    set sound(v) { sound = v; },
    get sound() { return sound; },
  };
})(window.FG);
