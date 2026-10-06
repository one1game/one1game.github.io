/* core.js — математика, сид-рандом, цвет, шум, утилиты */
window.FG = (function () {
  'use strict';
  const M = Math, TAU = M.PI * 2, sin = M.sin, cos = M.cos, W = 360, H = 640;

  /* Сид-генератор: одинаковый сид — одинаковый «ролик» */
  function rngf(s) {
    s |= 0;
    return () => {
      s = s + 0x6D2B79F5 | 0;
      let t = M.imul(s ^ s >>> 15, 1 | s);
      t = t + M.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* HSL → RGB-массив (для LUT-палитр) */
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const a = s * M.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return 255 * (l - a * M.max(-1, M.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  };

  /* Цвет из палитры состояния: P.h — три опорных тона */
  const col = (P, i, l = 60, a = 1, s = 90) => `hsla(${P.h[i % 3]},${s}%,${l}%,${a})`;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n;
  const pick = (arr, r) => arr[((r ? r() : M.random()) * arr.length) | 0];

  /* Взвешенный выбор: items=[{w, ...}] */
  const weighted = (items, r) => {
    let s = 0; for (const it of items) s += it.w || 1;
    let x = (r ? r() : M.random()) * s;
    for (const it of items) { x -= it.w || 1; if (x <= 0) return it; }
    return items[items.length - 1];
  };

  /* Гладкий value-noise + fBm — основа «живых» процедурных фонов */
  function hash2(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }
  function noise2(x, y) {
    const xi = M.floor(x), yi = M.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, o = 4) {
    let v = 0, amp = .5, f = 1;
    for (let i = 0; i < o; i++) { v += amp * noise2(x * f, y * f); f *= 2; amp *= .5; }
    return v;
  }

  return { M, TAU, sin, cos, W, H, rngf, hsl, col, clamp, lerp, fmt, pick, weighted, noise2, fbm };
})();
