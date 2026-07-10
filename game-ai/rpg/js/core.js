// ============ ГЛОБАЛЬНОЕ СОСТОЯНИЕ ============
const G = {
  W: window.innerWidth, H: window.innerHeight,
  canvas: null, ctx: null, bgCanvas: null, bgCtx: null, fxCanvas: null, fxCtx: null,
  mmCanvas: null, mmCtx: null,
  keys: {}, mouse: {x:0, y:0, down:false},
  player: null, entities: [], projectiles: [], particles: [], dmgNums: [],
  world: new Map(), chunks: new Map(),
  cam: {x:0, y:0, shake:0},
  time: 0, dt: 0, lastTime: 0,
  seed: Math.random() * 100000 | 0,
  running: false,
  apiData: {pokemon:[], chars:[], dogs:[], cats:[], facts:[], jokes:[], quotes:[], items:[], spells:[]},
  cooldowns: [0,0,0,0,0,0,0,0],
  achievements: new Set(),
  eventTimer: 0,
  dayTime: 0,
  weather: 'clear',
  boss: null,
  sanity: 100,
  glitch: 0,
  kills: 0,
  damageDealt: 0,
  itemsCollected: 0,
  distanceTraveled: 0,
  lastPos: {x:0, y:0},
  inventory: [],
  maxInv: 24,
  equipped: {weapon:null, armor:null, trinket:null},
  buffs: [],
  quests: [],
  activeQuest: null,
  pet: null,
  combo: 0,
  comboTimer: 0,
  screenFlash: 0,
  slowmo: 1,
  slowmoTimer: 0
};

// ============ УТИЛИТЫ ============
const rand = (a,b) => Math.random()*(b-a)+a;
const randi = (a,b) => Math.floor(rand(a,b));
const choice = a => a[randi(0,a.length)];
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const lerp = (a,b,t) => a+(b-a)*t;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const hash = (x,y) => {
  let h = (x*374761393 + y*668265263 + G.seed) | 0;
  h = (h^(h>>13)) * 1274126177;
  return ((h^(h>>16)) >>> 0) / 4294967295;
};

// ============ SimplexNoise ============
class SimplexNoise {
  constructor(seed) {
    this.seed = seed;
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = hash(i * 13 + seed, 0) * (i + 1) | 0;
      [this.perm[i], this.perm[j % 256]] = [this.perm[j % 256], this.perm[i]];
    }
    for (let i = 0; i < 256; i++) this.perm[i + 256] = this.perm[i];
  }
  noise2D(x, y) {
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (x + y) * (Math.sqrt(3.0) - 1.0) / 2.0;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * this.grad(this.perm[ii + this.perm[jj]], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * this.grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * this.grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2); }
    return 40.0 * (n0 + n1 + n2) + 0.5;
  }
  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}

// ============ NOISE-КОНСТАНТЫ ============
const riverSimplex = new SimplexNoise(G.seed);
const riverSimplex2 = new SimplexNoise(G.seed + 9999);
const simplexMain = new SimplexNoise(G.seed + 5555);

// ============ NOISE-ОБЁРТКИ ============
function noise2D(x, y) {
  return simplexMain.noise2D(x, y);
}

function fbm(x, y, oct=4) {
  let v=0, a=0.5, f=1;
  for(let i=0;i<oct;i++){ v += a*noise2D(x*f, y*f); a*=0.5; f*=2; }
  return v;
}

// ============ UPDATE(DT) ============
function update(dt) {
  G.time += dt;
  G.dayTime = (G.time * 0.01) % 1; // День/ночь цикл

  // Slowmo
  if (G.slowmoTimer > 0) {
    G.slowmoTimer -= dt;
    if (G.slowmoTimer <= 0) G.slowmo = 1;
  } else {
    G.slowmo = 1;
  }
  const adt = dt * G.slowmo;

  updatePlayer(adt);
  updateEntities(adt);
  updateProjectiles(adt);
  updateParticles(adt);
  updateCooldowns(dt);
  updateCamera(adt);
  updateWorld();
  updateRandomEvents(dt);
  updateSanity(dt);
  updateCombo(dt);
  updateUI();

  // Тряска
  if (G.cam.shake > 0) G.cam.shake *= 0.85;
  if (G.screenFlash > 0) G.screenFlash -= dt;
}

// ============ UPDATEPLAYER(DT) ============
function updatePlayer(dt) {
  const p = G.player;
  let ax = 0, ay = 0;
  if (G.keys['w'] || G.keys['ц'] || G.keys['arrowup']) ay -= 1;
  if (G.keys['s'] || G.keys['ы'] || G.keys['arrowdown']) ay += 1;
  if (G.keys['a'] || G.keys['ф'] || G.keys['arrowleft']) ax -= 1;
  if (G.keys['d'] || G.keys['в'] || G.keys['arrowright']) ax += 1;

  const len = Math.hypot(ax, ay);
  if (len > 0) { ax/=len; ay/=len; }

  const speed = 250 + p.agi*3;
  const boost = (G.keys['shift'] ? 1.6 : 1) * (p.dashTimer > 0 ? 3 : 1);

  p.vx = lerp(p.vx, ax*speed*boost, 0.2);
  p.vy = lerp(p.vy, ay*speed*boost, 0.2);

  const nx = p.x + p.vx*dt;
  const ny = p.y + p.vy*dt;

  if (!collidesWorld(nx, p.y, p.r)) p.x = nx;
  if (!collidesWorld(p.x, ny, p.r)) p.y = ny;

  // Направление к мыши
  const mx = G.mouse.x - G.W/2;
  const my = G.mouse.y - G.H/2;
  p.facing = Math.atan2(my, mx);

  if (p.attackCd > 0) p.attackCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.dashTimer > 0) p.dashTimer -= dt;

  // Дистанция
  const d = Math.hypot(p.x - G.lastPos.x, p.y - G.lastPos.y);
  G.distanceTraveled += d;
  G.lastPos = {x: p.x, y: p.y};

  // Квест
  if (G.activeQuest && G.activeQuest.type === 'dist') {
    G.activeQuest.prog += d;
    if (G.activeQuest.prog >= G.activeQuest.target) completeQuest();
  }
  if (G.activeQuest && G.activeQuest.type === 'sanity') {
    G.activeQuest.prog = G.sanity;
    if (G.sanity <= G.activeQuest.target) completeQuest();
  }

  // След
  if (Math.abs(p.vx) + Math.abs(p.vy) > 50) {
    p.trail.push({x: p.x, y: p.y, life: 0.5});
    if (p.trail.length > 20) p.trail.shift();
  }
  p.trail.forEach(t => t.life -= dt);
  p.trail = p.trail.filter(t => t.life > 0);

  // Реген маны
  p.mp = Math.min(p.maxMp, p.mp + dt*3);

  // Подбор предметов
  G.entities = G.entities.filter(e => {
    if (e.type === 'item' && !e.dead) {
      if (dist(p, e) < p.r + e.r) {
        pickupItem(e);
        return false;
      }
    }
    return true;
  });
}

// ============ UPDATEENTITIES(DT) ============
function updateEntities(dt) {
  const p = G.player;

  G.entities.forEach(e => {
    if (e.dead) return;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (e.type === 'enemy' || e.type === 'boss') {
      const d = dist(p, e);
      const aggro = e.type === 'boss' ? 1000 : 400;

      if (d < aggro) {
        e.state = 'chase';
        const ang = Math.atan2(p.y-e.y, p.x-e.x);
        const speed = e.type === 'boss' ? 100 : 120;

        if (e.ai === 'chase' || e.type === 'boss') {
          e.vx = lerp(e.vx, Math.cos(ang)*speed, 0.1);
          e.vy = lerp(e.vy, Math.sin(ang)*speed, 0.1);
        } else if (e.ai === 'ranged') {
          if (d > 250) {
            e.vx = lerp(e.vx, Math.cos(ang)*speed, 0.1);
            e.vy = lerp(e.vy, Math.sin(ang)*speed, 0.1);
          } else if (d < 180) {
            e.vx = lerp(e.vx, -Math.cos(ang)*speed, 0.1);
            e.vy = lerp(e.vy, -Math.sin(ang)*speed, 0.1);
          }
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.aiTimer = 1.5;
            G.projectiles.push({
              x: e.x, y: e.y, vx: Math.cos(ang)*300, vy: Math.sin(ang)*300,
              r: 8, dmg: e.atk, life: 2, color: '#ff4444', type:'enemy',
              owner:'enemy'
            });
          }
        } else if (e.ai === 'charge') {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && e.state !== 'charging') {
            e.state = 'charging';
            e.aiTimer = 0.5;
            e.chargeAng = ang;
          }
          if (e.state === 'charging') {
            e.vx = Math.cos(e.chargeAng) * 500;
            e.vy = Math.sin(e.chargeAng) * 500;
            if (e.aiTimer <= 0) { e.state = 'chase'; e.aiTimer = 2; }
          } else {
            e.vx *= 0.9; e.vy *= 0.9;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.aiTimer = rand(1, 3);
            const wa = rand(0, Math.PI*2);
            e.vx = Math.cos(wa) * 60;
            e.vy = Math.sin(wa) * 60;
          }
        }

        // Атака в упор
        if (d < e.r + p.r + 5 && p.invuln <= 0) {
          damagePlayer(e.atk);
        }

        // Босс фазы
        if (e.type === 'boss') {
          updateBoss(e, dt);
        }
      } else {
        e.vx *= 0.9; e.vy *= 0.9;
      }

      const nx = e.x + e.vx*dt;
      const ny = e.y + e.vy*dt;
      if (!collidesWorld(nx, e.y, e.r)) e.x = nx; else e.vx *= -0.5;
      if (!collidesWorld(e.x, ny, e.r)) e.y = ny; else e.vy *= -0.5;
    }

    if (e.type === 'item') {
      e.bobPhase += dt*3;
    }
    if (e.type === 'npc') {
      e.bobPhase += dt*2;
    }
  });

  // Питомец
  if (G.pet) {
    const pet = G.pet;
    const d = dist(p, pet);
    if (d > pet.followDist) {
      const ang = Math.atan2(p.y-pet.y, p.x-pet.x);
      pet.x += Math.cos(ang) * 200 * dt;
      pet.y += Math.sin(ang) * 200 * dt;
    }
    pet.bobPhase += dt*5;
    pet.attackCd -= dt;

    // Питомец атакует
    if (pet.attackCd <= 0) {
      const target = findNearestEnemy(pet.x, pet.y, 200);
      if (target) {
        pet.attackCd = 1;
        G.projectiles.push({
          x: pet.x, y: pet.y,
          vx: (target.x-pet.x)*2, vy: (target.y-pet.y)*2,
          r: 6, dmg: G.player.int*0.5+5, life: 1, color: '#ffaa44',
          type:'pet', owner:'player'
        });
      }
    }
  }

  // Удаляем мёртвых
  G.entities = G.entities.filter(e => !e.dead || e.type === 'item');
}

// ============ UPDATEPROJECTILES(DT) ============
function updateProjectiles(dt) {
  G.projectiles.forEach(pr => {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    if (pr.trail) {
      G.particles.push({
        x: pr.x, y: pr.y, vx: 0, vy: 0,
        life: 0.3, maxLife: 0.3,
        color: pr.color, size: pr.r*0.8
      });
    }

    // Коллизии
    if (pr.owner === 'player') {
      G.entities.forEach(e => {
        if ((e.type !== 'enemy' && e.type !== 'boss') || e.dead) return;
        if (dist(pr, e) < pr.r + e.r) {
          damageEnemy(e, pr.dmg);
          if (pr.slow) { e.vx *= pr.slow; e.vy *= pr.slow; }
          if (!pr.pierce || pr.pierce-- <= 0) pr.life = 0;
        }
      });
    } else if (pr.owner === 'enemy') {
      if (dist(pr, G.player) < pr.r + G.player.r && G.player.invuln <= 0) {
        damagePlayer(pr.dmg);
        pr.life = 0;
      }
    }
  });
  G.projectiles = G.projectiles.filter(pr => pr.life > 0);
}

// ============ UPDATEPARTICLES(DT) ============
function updateParticles(dt) {
  G.particles.forEach(pa => {
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vx *= 0.95;
    pa.vy *= 0.95;
    pa.life -= dt;
  });
  G.particles = G.particles.filter(pa => pa.life > 0);
}

// ============ UPDATECOOLDOWNS(DT) ============
function updateCooldowns(dt) {
  for (let i=0; i<G.cooldowns.length; i++) {
    if (G.cooldowns[i] > 0) G.cooldowns[i] = Math.max(0, G.cooldowns[i] - dt);
  }
}

// ============ UPDATECAMERA(DT) ============
function updateCamera(dt) {
  const p = G.player;
  G.cam.x = lerp(G.cam.x, p.x, 0.1);
  G.cam.y = lerp(G.cam.y, p.y, 0.1);
}

// ============ UPDATEWORLD() ============
function updateWorld() {
  const p = G.player;
  const cx = Math.floor(p.x/TILE/CHUNK);
  const cy = Math.floor(p.y/TILE/CHUNK);
  for (let dy=-2; dy<=2; dy++) {
    for (let dx=-2; dx<=2; dx++) {
      getChunk(cx+dx, cy+dy);
    }
  }
}

// ============ ГЛАВНЫЙ ЦИКЛ ============
function loop(t) {
  if (!G.running) return;
  const dt = Math.min(0.05, (t - G.lastTime) / 1000);
  G.lastTime = t;
  G.dt = dt;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function resize() {
  G.W = window.innerWidth;
  G.H = window.innerHeight;
  [G.canvas, G.bgCanvas, G.fxCanvas].forEach(c => {
    c.width = G.W; c.height = G.H;
  });
  G.mmCanvas.width = 180;
  G.mmCanvas.height = 180;
}

async function startGame() {
  document.getElementById('intro').style.display = 'none';
  document.getElementById('game').style.display = 'block';

  G.canvas = document.getElementById('mainCanvas');
  G.ctx = G.canvas.getContext('2d');
  G.bgCanvas = document.getElementById('bgCanvas');
  G.bgCtx = G.bgCanvas.getContext('2d');
  G.fxCanvas = document.getElementById('fxCanvas');
  G.fxCtx = G.fxCanvas.getContext('2d');
  G.mmCanvas = document.getElementById('minimap').querySelector('canvas');
  G.mmCtx = G.mmCanvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  G.player = createPlayer();
  G.lastPos = {x: 0, y: 0};

  // Генерация рек, озёр и мостов
  generateAllRivers();
  generateAllLakes();
  generateBridges();
  log(`💧 Сгенерировано ${G.worldRivers.length} рек, ${G.worldLakes.length} озёр`, 'info');
  log(`🌉 Построено мостов: на реках`, 'info');

  // Генерация деревень
  generateAllVillages();
  log(`🏘️ Сгенерировано ${G.villages.length} деревень`, 'info');
  G.villages.forEach(v => log(`  📍 ${v.name} (${v.centerX}, ${v.centerY}) — ${v.buildings.length} зданий`, 'info'));

  G.running = true;

  setupInput();

  log('🌌 Добро пожаловать в CHAOS REALM!', 'epic');
  log('Мир бесконечен. Исследуй. Сражайся. Безумствуй.', 'info');
  log('💡 Совет: чем дальше идёшь, тем сложнее и страннее', 'info');

  G.lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ============ ЗАГРУЗКА ============
window.addEventListener('load', async () => {
  const status = document.getElementById('loadStatus');
  status.textContent = 'Загрузка API...';
  await loadAPIs();
  status.textContent = 'Генерация мира...';
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('intro').style.display = 'flex';
});
