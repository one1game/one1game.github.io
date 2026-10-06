/* styles.js — палитры, LUT, пост-эффекты, «аэстетики» */
window.FG = window.FG || {};
(function (FG) {
  'use strict';
  const M = Math, TAU = M.PI * 2;

  /* ---------- Палитры (визуальные «аэстетики») ---------- */
  // h — три опорных тона, sat/ct — насыщенность/контраст, span/bd — разброс и полосность LUT
  const PALETTES = [
    { name: 'neon',      h: [315, 190, 265], sat: 1.35, ct: 1.12, span: 180, bd: 1 },
    { name: 'cyber',     h: [190, 300, 220], sat: 1.30, ct: 1.15, span: 200, bd: 2 },
    { name: 'sunset',    h: [20, 320, 45],   sat: 1.20, ct: 1.05, span: 150, bd: 1 },
    { name: 'vapor',     h: [300, 210, 340], sat: 1.10, ct: 1.00, span: 200, bd: 3 },
    { name: 'acid',      h: [90, 150, 60],   sat: 1.45, ct: 1.20, span: 240, bd: 2 },
    { name: 'blood',     h: [356, 10, 340],  sat: 1.30, ct: 1.18, span: 120, bd: 1 },
    { name: 'ice',       h: [205, 230, 180], sat: 1.15, ct: 1.08, span: 140, bd: 2 },
    { name: 'gold',      h: [45, 25, 60],    sat: 1.25, ct: 1.10, span: 130, bd: 1 },
    { name: 'toxic',     h: [110, 80, 160],  sat: 1.40, ct: 1.22, span: 210, bd: 2 },
    { name: 'pastel',    h: [330, 200, 285], sat: 0.85, ct: 0.95, span: 170, bd: 3 },
    { name: 'mono',      h: [0, 0, 0],       sat: 0.15, ct: 1.15, span: 60,  bd: 1 },
    { name: 'sepia',     h: [35, 30, 45],    sat: 0.70, ct: 1.05, span: 90,  bd: 1 },
    { name: 'bubblegum', h: [330, 275, 195], sat: 1.25, ct: 1.02, span: 190, bd: 3 },
    { name: 'forest',    h: [140, 100, 175], sat: 1.10, ct: 1.06, span: 160, bd: 2 },
    { name: 'midnight',  h: [225, 250, 200], sat: 1.20, ct: 1.20, span: 180, bd: 2 },
    { name: 'candy',     h: [350, 45, 320],  sat: 1.35, ct: 1.05, span: 200, bd: 3 },
    { name: 'matrix',    h: [130, 150, 100], sat: 1.40, ct: 1.25, span: 220, bd: 1 },
    { name: 'lavender',  h: [270, 300, 240], sat: 1.05, ct: 1.00, span: 165, bd: 2 },
  ];

  function makePalette(r) {
    const base = PALETTES[(r() * PALETTES.length) | 0];
    const shift = r() * 360;
    const span = base.span * (0.8 + r() * 0.5);
    const h = base.h.map(x => x + shift);
    return {
      name: base.name,
      h,
      sat: +(base.sat * (0.9 + r() * 0.25)).toFixed(2),
      ct: +(base.ct * (0.95 + r() * 0.15)).toFixed(2),
      span, bd: base.bd,
    };
  }

  /* LUT: 256 цветов для шумовых сцен (fire/lava/sand/life) */
  function makeLUT(PAL, a) {
    const lut = new Uint8ClampedArray(768);
    for (let i = 0; i < 256; i++) {
      const u = i / 255;
      const rgb = FG.hsl(PAL.h[0] + PAL.span * Math.sin(u * TAU + a * 6), 90, 12 + 48 * (.5 + .5 * Math.sin(u * TAU * PAL.bd)));
      lut.set(rgb, i * 3);
    }
    return lut;
  }

  /* ---------- Пост-эффекты ---------- */
  // w — шанс попадания в стопку; tier — «сила»
  const FX = [
    { name: 'mirror',  w: 6,  tier: 1 }, { name: 'mirrorY', w: 4,  tier: 1 },
    { name: 'zoom',    w: 5,  tier: 1 }, { name: 'ghost',   w: 6,  tier: 1 },
    { name: 'pixel',   w: 4,  tier: 2 }, { name: 'scan',    w: 5,  tier: 1 },
    { name: 'vhs',     w: 5,  tier: 1 }, { name: 'wave',    w: 4,  tier: 1 },
    { name: 'hue',     w: 5,  tier: 1 }, { name: 'shake',   w: 4,  tier: 2 },
    { name: 'pulse',   w: 5,  tier: 1 }, { name: 'spin',    w: 3,  tier: 1 },
    { name: 'fried',   w: 3,  tier: 3 }, { name: 'spam',    w: 4,  tier: 2 },
    { name: 'strobe',  w: 3,  tier: 3 }, { name: 'punch',   w: 4,  tier: 2 },
  ];
  /* Дополнительные эффекты, реализация — в app.js post() */
  const FX_EXTRA = ['rgb', 'grain', 'bloom', 'vignette', 'posterize', 'kaleidoscope'];

  FG.PALETTES = PALETTES;
  FG.makePalette = makePalette;
  FG.makeLUT = makeLUT;
  FG.FX = FX;
  FG.FX_EXTRA = FX_EXTRA;
})(window.FG);
