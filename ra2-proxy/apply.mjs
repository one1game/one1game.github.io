// Прописывает URL задеплоенного Worker в ra2/config.json и обновляет хеш
// config.json в service worker (иначе из-за integrity игра не загрузится).
//
// Запуск из корня репозитория:
//   node ra2-proxy/apply.mjs https://one1game-ra2.<твой-сабдомен>.workers.dev

import fs from 'node:fs';
import crypto from 'node:crypto';

const raw = process.argv[2];
if (!raw) {
  console.error('Укажи URL воркера: node ra2-proxy/apply.mjs https://one1game-ra2.<sub>.workers.dev');
  process.exit(1);
}
const base = raw.replace(/\/+$/, '');

const CONFIG = 'ra2/config.json';
const SW = 'ra2/ra2web-sw.js';

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
cfg.gameresBaseUrl = base + '/gameres/';
cfg.gameresBaseUrls = [];
cfg.campaignBaseUrl = base + '/campaign/';
cfg.campaignBaseUrls = [];
cfg.musicBaseUrl = base + '/music/';
cfg.musicBaseUrls = [];
cfg.mapsBaseUrl = base + '/map/';
cfg.modsBaseUrl = base + '/mod/';
fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));

const hash = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(CONFIG)).digest('base64');

let sw = fs.readFileSync(SW, 'utf8');
const s0 = sw.indexOf('const config = ');
const s1 = sw.indexOf('};', s0);
const swc = JSON.parse(sw.slice(s0 + 'const config = '.length, s1 + 1));
swc.assetIntegrity['/ra2/config.json'] = hash;
sw = sw.slice(0, s0) + 'const config = ' + JSON.stringify(swc) + ';' + sw.slice(s1 + 1);
fs.writeFileSync(SW, sw);

console.log('OK. gameresBaseUrl =', cfg.gameresBaseUrl);
console.log('config.json integrity =', hash);
