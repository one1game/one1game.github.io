// ============ TILE / CHUNK / BIOMES ============
const TILE = 48;
const CHUNK = 16;
const BIOMES = {
  VOID: 0, GRASS: 1, FOREST: 2, DESERT: 3, SNOW: 4, LAVA: 5, SWAMP: 6, CRYSTAL: 7, MEMLAND: 8, GLITCH: 9
};
const BIOME_COLORS = {
  0: '#0a0015', 1: '#2d5a2d', 2: '#1a3d1a', 3: '#c2a060', 4: '#e0e8f0',
  5: '#8a1a0a', 6: '#3a4a2a', 7: '#6a2aaa', 8: '#ff66aa', 9: '#00ffaa'
};

// ============ getBiome() ============
function getBiome(wx, wy) {
  const t = fbm(wx*0.005, wy*0.005, 3);
  const m = fbm(wx*0.01+100, wy*0.01+100, 2);
  if (t < 0.25) return BIOMES.VOID;
  if (t < 0.35) return BIOMES.SWAMP;
  if (t < 0.45) return m > 0.5 ? BIOMES.FOREST : BIOMES.GRASS;
  if (t < 0.55) return BIOMES.GRASS;
  if (t < 0.65) return m > 0.6 ? BIOMES.DESERT : BIOMES.GRASS;
  if (t < 0.75) return BIOMES.SNOW;
  if (t < 0.85) return m > 0.7 ? BIOMES.LAVA : BIOMES.CRYSTAL;
  if (t < 0.92) return BIOMES.MEMLAND;
  return BIOMES.GLITCH;
}

// ============ getChunk() ============
function getChunk(cx, cy) {
  const key = `${cx},${cy}`;
  if (G.chunks.has(key)) return G.chunks.get(key);
  
  const chunk = { cx, cy, tiles: [], entities: [], items: [], npcs: [], doors: [] };
  
  for (let y=0; y<CHUNK; y++) {
    for (let x=0; x<CHUNK; x++) {
      const wx = cx*CHUNK+x, wy = cy*CHUNK+y;
      const biome = getBiome(wx, wy);
      const h = fbm(wx*0.05, wy*0.05, 2);
      const solid = (biome === BIOMES.VOID) || (biome === BIOMES.LAVA && h > 0.6);
      chunk.tiles.push({wx, wy, biome, h, solid, variant: hash(wx*7, wy*13)});
    }
  }
  
  // Спавн сущностей
  const r = hash(cx*31, cy*47);
  const density = 0.3 + Math.min(0.5, Math.sqrt(cx*cx+cy*cy)*0.02);
  
  if (r < density) {
    const count = randi(1, 4);
    for (let i=0; i<count; i++) spawnEnemyInChunk(chunk);
  }
  if (r > 0.7 && r < 0.85) spawnNPC(chunk);
  if (r > 0.4 && r < 0.7) spawnItem(chunk);
  
  // Шанс босса в далёких чанках
  const d = Math.sqrt(cx*cx+cy*cy);
  if (d > 5 && hash(cx*101, cy*103) < 0.02 && !G.boss) {
    spawnBoss(chunk);
  }
  
  G.chunks.set(key, chunk);
  return chunk;
}

// ============ riverSimplex / riverSimplex2 (уже в core.js) ============

// ============ generateWorldRiver() ============
function generateWorldRiver(startX, startY, length) {
  const river = [];
  let x = startX, y = startY;
  const step = 3;
  for (let i = 0; i < length; i++) {
    const angle = riverSimplex.noise2D(x * 0.005, y * 0.005) * Math.PI * 0.8;
    x += Math.cos(angle) * step;
    y += Math.abs(Math.sin(angle)) * step + step * 0.5;
    river.push({ x: Math.round(x), y: Math.round(y) });
  }
  return river;
}

// ============ generateWorldLake() ============
function generateWorldLake(cx, cy, radius) {
  const lake = [];
  const pts = 16;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = radius + (riverSimplex.noise2D(i * 0.3 + cx, cy * 0.3) * radius * 0.4);
    lake.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return lake;
}

// ============ G.worldRivers / G.worldLakes / G.bridges / G.waterTiles ============
G.worldRivers = [];
G.worldLakes = [];
G.bridges = new Set(); // ключи "tileX,tileY" — мосты
G.waterTiles = new Map(); // ключ "tileX,tileY" -> {type:'river'|'lake'}

// ============ generateAllRivers() ============
function generateAllRivers() {
  const count = 4 + Math.floor(hash(G.seed, 777) * 5);
  for (let i = 0; i < count; i++) {
    const sx = (hash(i, 100) - 0.5) * 300;
    const sy = (hash(i, 200) - 0.5) * 300;
    const len = 80 + Math.floor(hash(i, 300) * 120);
    const river = generateWorldRiver(sx, sy, len);
    G.worldRivers.push(river);
    
    // Маркируем тайлы воды реки
    const width = 2 + Math.floor(hash(i, 50) * 3);
    river.forEach(pt => {
      for (let w = -width; w <= width; w++) {
        const key = `${pt.x + w},${pt.y}`;
        if (!G.waterTiles.has(key)) G.waterTiles.set(key, { type: 'river', riverIdx: i });
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -width; dx <= width; dx++) {
          const key = `${pt.x + dx},${pt.y + dy}`;
          if (!G.waterTiles.has(key)) G.waterTiles.set(key, { type: 'river', riverIdx: i });
        }
      }
    });
  }
}

// ============ generateAllLakes() ============
function generateAllLakes() {
  const count = 3 + Math.floor(hash(G.seed, 888) * 6);
  for (let i = 0; i < count; i++) {
    const cx = (hash(i, 400) - 0.5) * 400;
    const cy = (hash(i, 500) - 0.5) * 400;
    const r = 6 + hash(i, 600) * 18;
    const lake = generateWorldLake(cx, cy, r);
    G.worldLakes.push(lake);
    
    // Маркируем тайлы воды озера (грубый fill)
    const r2 = r * 1.5;
    for (let dy = -r2; dy <= r2; dy++) {
      for (let dx = -r2; dx <= r2; dx++) {
        const wx = Math.round(cx + dx);
        const wy = Math.round(cy + dy);
        if (dx * dx + dy * dy < r2 * r2) {
          const key = `${wx},${wy}`;
          if (!G.waterTiles.has(key)) G.waterTiles.set(key, { type: 'lake', lakeIdx: i });
        }
      }
    }
  }
}

// ============ generateBridges() ============
function generateBridges() {
  G.worldRivers.forEach((river, idx) => {
    const step = 25 + Math.floor(hash(idx, 700) * 20);
    for (let i = step; i < river.length - step; i += step) {
      const pt = river[i];
      // Находим направление реки
      const prev = river[Math.max(0, i - 3)];
      const next = river[Math.min(river.length - 1, i + 3)];
      const ang = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2;
      
      // Мост — линия тайлов поперёк реки
      const bw = 3;
      for (let w = -bw; w <= bw; w++) {
        const bx = Math.round(pt.x + Math.cos(ang) * w);
        const by = Math.round(pt.y + Math.sin(ang) * w);
        G.bridges.add(`${bx},${by}`);
      }
    }
  });
}

// ============ isWaterTile() ============
function isWaterTile(tx, ty) {
  return G.waterTiles.has(`${tx},${ty}`);
}

// ============ isBridgeTile() ============
function isBridgeTile(tx, ty) {
  return G.bridges.has(`${tx},${ty}`);
}

// ============ collidesWorld() ============
function collidesWorld(x, y, r) {
  const tx = Math.floor(x/TILE);
  const ty = Math.floor(y/TILE);
  for (let dy=-1; dy<=1; dy++) {
    for (let dx=-1; dx<=1; dx++) {
      const gx = tx + dx;
      const gy = ty + dy;
      const cx = Math.floor(gx/CHUNK);
      const cy = Math.floor(gy/CHUNK);
      const chunk = getChunk(cx, cy);
      const lx = gx - cx*CHUNK;
      const ly = gy - cy*CHUNK;
      const tile = chunk.tiles[ly*CHUNK+lx];
      if (!tile) continue;
      
      // Вода — непроходима, если нет моста
      if (isWaterTile(gx, gy) && !isBridgeTile(gx, gy)) {
        const txw = gx*TILE + TILE/2;
        const tyw = gy*TILE + TILE/2;
        if (Math.abs(x-txw) < r+TILE/2 && Math.abs(y-tyw) < r+TILE/2) return true;
      }
      
      // Здание деревни — непроходимо
      if (isVillageBuilding(gx, gy)) {
        const txw = gx*TILE + TILE/2;
        const tyw = gy*TILE + TILE/2;
        if (Math.abs(x-txw) < r+TILE/2 && Math.abs(y-tyw) < r+TILE/2) return true;
      }
      
      if (tile.solid) {
        const txw = gx*TILE + TILE/2;
        const tyw = gy*TILE + TILE/2;
        if (Math.abs(x-txw) < r+TILE/2 && Math.abs(y-tyw) < r+TILE/2) return true;
      }
    }
  }
  return false;
}

// ============ VillageGenerator ============
class VillageGenerator {
  constructor(seed) {
    this.rng = this.mulberry32(seed);
  }
  mulberry32(a) {
    const self = this;
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  generateVillage(centerX, centerY, size = 10) {
    const buildings = [];
    const roads = [];
    const npcs = [];
    
    // Центральная площадь
    buildings.push({
      x: centerX, y: centerY,
      type: 'square',
      width: 3, height: 3,
      color: '#aa9955',
      rot: 0
    });
    
    // WFC-подобные типы зданий с «соседскими правилами»
    const buildingTypes = ['house', 'house', 'house', 'tower', 'glitch_house', 'ruin'];
    const buildingColors = {
      house: '#8B6914', tower: '#666688', glitch_house: '#ff00aa',
      ruin: '#555544', shop: '#44aa44', floating: '#aa44ff'
    };
    const buildingIcons = {
      house: '🏠', tower: '🗼', glitch_house: '👾', ruin: '🏚️',
      shop: '🏪', floating: '🛸'
    };
    const buildingNames = {
      house: 'Дом', tower: 'Башня', glitch_house: 'Глитч-дом',
      ruin: 'Руины', shop: 'Лавка', floating: 'Летающая башня'
    };
    
    // Генерируем дома вокруг площади
    for (let i = 0; i < size; i++) {
      const angle = (i / size) * Math.PI * 2 + this.rng() * 0.4;
      const distance = 5 + this.rng() * 8;
      const bx = centerX + Math.cos(angle) * distance;
      const by = centerY + Math.sin(angle) * distance;
      const bwx = Math.round(bx);
      const bwy = Math.round(by);
      
      // Выбор типа по WFC-правилам: glitch не рядом с glitch
      let btype;
      if (i > 0 && buildings[buildings.length-1].type === 'glitch_house') {
        btype = this.rng() > 0.3 ? 'house' : (this.rng() > 0.5 ? 'tower' : 'ruin');
      } else {
        btype = this.rng() > 0.6 ? choice(['tower','ruin','glitch_house']) : 'house';
      }
      
      const bld = {
        x: bwx, y: bwy,
        type: btype,
        width: 2 + Math.floor(this.rng() * 3),
        height: 2 + Math.floor(this.rng() * 3),
        rot: this.rng() > 0.5 ? 0 : Math.PI/2,
        color: buildingColors[btype],
        icon: buildingIcons[btype],
        name: buildingNames[btype],
        glitchTimer: 0,
        solid: true
      };
      
      // Glitch дома — особые
      if (btype === 'glitch_house') {
        bld.glitchTimer = this.rng() * 5;
        bld.color = `hsl(${Math.floor(hash(bwx,bwy)*360)}, 100%, 50%)`;
      }
      
      // Floating — редко
      if (btype === 'tower' && this.rng() > 0.8 && !buildings.some(b => b.type === 'floating')) {
        bld.type = 'floating';
        bld.icon = '🛸';
        bld.name = 'Летающая башня';
        bld.color = '#aa44ff';
        bld.floatOffset = 0;
      }
      
      buildings.push(bld);
      
      // Дорога от площади к дому
      roads.push({
        fromX: centerX, fromY: centerY,
        toX: bwx, toY: bwy
      });
      
      // Шанс NPC у дома
      if (this.rng() > 0.5) {
        let npcName = choice(['Крестьянин','Торговец','Стражник','Шаман','Путник','Безумец','Мемолог']);
        let npcImg = null;
        if (G.apiData && G.apiData.chars && G.apiData.chars.length) {
          const c = choice(G.apiData.chars);
          npcName = c.name; npcImg = c.image;
        }
        npcs.push({
          name: npcName,
          img: npcImg,
          x: bwx, y: bwy,
          dialogue: generateVillageDialogue(npcName, btype),
          quest: this.rng() > 0.6 ? generateQuest() : null
        });
      }
    }
    
    // Лавка (вместо одного дома)
    if (buildings.length > 3 && this.rng() > 0.4) {
      const shopIdx = 1 + Math.floor(this.rng() * (buildings.length - 1));
      if (buildings[shopIdx].type === 'house') {
        buildings[shopIdx].type = 'shop';
        buildings[shopIdx].icon = '🏪';
        buildings[shopIdx].name = 'Лавка';
        buildings[shopIdx].color = '#44aa44';
      }
    }
    
    // Кольцевая дорога между соседними зданиями
    for (let i = 1; i < buildings.length; i++) {
      const prev = buildings[i - 1];
      const curr = buildings[i];
      if (prev.type !== 'square' || i === 1) {
        roads.push({
          fromX: prev.x, fromY: prev.y,
          toX: curr.x, toY: curr.y
        });
      }
    }
    
    return { buildings, roads, npcs, centerX, centerY, name: generateVillageName() };
  }
}

// ============ generateVillageDialogue() ============
function generateVillageDialogue(name, buildingType) {
  const pools = {
    house: [
      `Привет, странник. Я ${name}. Добро пожаловать в нашу деревню.`,
      `Осторожнее в округе. Глитч-твари близко.`,
      `Заходи, отдохни у огня.`
    ],
    tower: [
      `С башни видно далеко... странные вещи творятся.`,
      `Я ${name}, наблюдатель. Реки несут странную энергию.`,
      `Видел, как реальность ломалась на востоке.`
    ],
    glitch_house: [
      `ЭЭЭттт дом... сллломан... как и яяяя...`,
      `НЕ ВЕРЬ ЦИФРАМ! ${name} знает правду!`,
      `🌀...` + choice(['01101000','error','null','NaN']) + `...`
    ],
    ruin: [
      `Раньше тут был большой город. Теперь — ${name} и пыль.`,
      `Нашёл артефакты в развалинах. Хочешь посмотреть?`,
      `Всё рассыпается. Но я ${name}, я остаюсь.`
    ],
    shop: [
      `Торговец ${name} к вашим услугам!`,
      `Редкие товары, только сегодня! Мем-кристаллы, зелья!`,
      `Золото звенит — душа поёт. Что купишь?`
    ],
    floating: [
      `Я ${name}. Мой дом парит... не спрашивай как.`,
      `Гравитация — это выбор. Слабые не понимают.`,
      `Сверху всё выглядит... иначе.`
    ]
  };
  const pool = pools[buildingType] || pools.house;
  if (G.apiData && G.apiData.advice && G.apiData.advice.length && Math.random() > 0.7) {
    pool.push(`Совет от ${name}: ${G.apiData.advice[0]}`);
  }
  return choice(pool);
}

// ============ generateVillageName() ============
function generateVillageName() {
  const prefix = choice(['Глитч','Хаос','Мем','Пиксель','Теневой','Баг','Кристалл','Древний','Новый','Нижний','Верхний','Сломанный']);
  const suffix = choice(['град','бург','вилль','таун','ополь','ск','дорф','шир','холм','рест','поль','вейл']);
  return prefix + suffix;
}

// ============ G.villages / G.villageTiles ============
G.villages = [];
G.villageTiles = new Map(); // "tileX,tileY" -> {building, road}

// ============ generateAllVillages() ============
function generateAllVillages() {
  const count = 3 + Math.floor(hash(G.seed, 1111) * 6);
  for (let i = 0; i < count; i++) {
    const cx = Math.round((hash(i, 800) - 0.5) * 400);
    const cy = Math.round((hash(i, 900) - 0.5) * 400);
    
    // Не генерим деревню на воде
    if (isWaterTile(cx, cy)) continue;
    
    const size = 8 + Math.floor(hash(i, 1000) * 15);
    const gen = new VillageGenerator(G.seed + i * 10000);
    const village = gen.generateVillage(cx, cy, size);
    
    // Маркируем тайлы зданий (solid) и дорог
    village.buildings.forEach(bld => {
      for (let dy = 0; dy < bld.height; dy++) {
        for (let dx = 0; dx < bld.width; dx++) {
          const tx = bld.x + dx, ty = bld.y + dy;
          const key = `${tx},${ty}`;
          G.villageTiles.set(key, { type: 'building', building: bld, village });
        }
      }
    });
    
    // Маркируем дороги
    village.roads.forEach(road => {
      markRoadTiles(road.fromX, road.fromY, road.toX, road.toY, village);
    });
    
    // Спавним NPC деревни в сущности
    village.npcs.forEach(npc => {
      const vx = npc.x * TILE + TILE/2;
      const vy = npc.y * TILE + TILE/2;
      G.entities.push({
        type: 'npc', x: vx, y: vy, r: 20,
        name: npc.name, img: npc.img,
        dialogue: npc.dialogue,
        quest: npc.quest,
        bobPhase: rand(0, Math.PI*2),
        village: village
      });
    });
    
    G.villages.push(village);
  }
}

// ============ markRoadTiles() ============
function markRoadTiles(x1, y1, x2, y2, village) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const tx = Math.round(x1 + dx * t);
    const ty = Math.round(y1 + dy * t);
    const key = `${tx},${ty}`;
    if (!G.villageTiles.has(key)) {
      G.villageTiles.set(key, { type: 'road', village });
    }
  }
}

// ============ isVillageBuilding() ============
function isVillageBuilding(tx, ty) {
  const vt = G.villageTiles.get(`${tx},${ty}`);
  return vt && vt.type === 'building';
}

// ============ isVillageRoad() ============
function isVillageRoad(tx, ty) {
  const vt = G.villageTiles.get(`${tx},${ty}`);
  return vt && vt.type === 'road';
}

// ============ getVillageAt() ============
function getVillageAt(tx, ty) {
  const vt = G.villageTiles.get(`${tx},${ty}`);
  return vt ? vt.village : null;
}
