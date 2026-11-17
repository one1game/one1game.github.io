// Копирует собранный dist в /app рядом с корнем сайта.
// Cloudflare Pages раздаёт папку как есть, поэтому в URL попадает /app/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const TARGET = path.resolve(ROOT, '..', 'app');

if (!fs.existsSync(DIST)) {
  console.error('нет webapp/dist — сначала собери проект');
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(DIST, TARGET, { recursive: true });

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
  const p = path.join(dir, e.name);
  return sum + (e.isDirectory() ? walk(p) : fs.statSync(p).size);
}, 0);

const files = fs.readdirSync(TARGET).length;
const kb = (walk(TARGET) / 1024).toFixed(1);
console.log(`опубликовано в app/: ${files} записей верхнего уровня, ${kb} КБ всего`);
