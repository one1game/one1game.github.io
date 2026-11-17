// Генерирует PNG-иконки 192 и 512 без зависимостей: чистый zlib + ручной PNG.
// Рисуем тёмный скруглённый квадрат и кислотный «>_» — знак проекта.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'public');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // бит на канал
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [10, 15, 20];
const ACID = [125, 255, 155];

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.19;              // радиус скругления
  const inset = size * 0.08;          // поля
  const thick = size * 0.075;         // толщина штриха
  const chevron = size * 0.30;

  const set = (x, y, [R, G, B], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = a;
  };

  // расстояние до отрезка — так линии получаются ровными и без артефактов
  const seg = (x, y, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const px1 = x1 + t * dx, py1 = y1 + t * dy;
    return Math.hypot(x - px1, y - py1);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // скруглённый прямоугольник
      const cx = Math.min(Math.max(x, inset + r), size - inset - r);
      const cy = Math.min(Math.max(y, inset + r), size - inset - r);
      const outside = Math.hypot(x - cx, y - cy) > r;
      if (outside) { set(x, y, BG, 0); continue; }

      let color = BG.slice();
      const ax = size * 0.26, ay = size * 0.30;
      const bx = ax + chevron, by = size * 0.50;
      const ey = size * 0.70;
      if (seg(x, y, ax, ay, bx, by) < thick / 2 || seg(x, y, bx, by, ax, ey) < thick / 2) {
        color = ACID.slice();
      }
      if (x > size * 0.60 && x < size * 0.60 + size * 0.20 &&
          y > size * 0.62 && y < size * 0.62 + thick) {
        color = ACID.slice();
      }
      set(x, y, color);
    }
  }
  return px;
}

fs.mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const buf = encodePNG(size, draw(size));
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png — ${(buf.length / 1024).toFixed(1)} КБ`);
}
