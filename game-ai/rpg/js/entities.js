// ============ SPAWNENEMYINCHUNK ============
function spawnEnemyInChunk(chunk) {
  const x = randi(1, CHUNK-1), y = randi(1, CHUNK-1);
  const tile = chunk.tiles[y*CHUNK+x];
  const wx = chunk.cx*CHUNK+x, wy = chunk.cy*CHUNK+y;
  if (tile.solid || isWaterTile(wx, wy) || isBridgeTile(wx, wy) || isVillageBuilding(wx, wy)) return;
  
  const d = Math.sqrt(wx*wx+wy*wy);
  const lvl = Math.max(1, Math.floor(d*0.3 + rand(0,3)));
  
  // Выбор типа врага
  const types = ['slime','skeleton','demon','dragon','robot','ghost','meme','glitch'];
  const type = choice(types);
  
  let sprite = null, name = type;
  if (G.apiData.pokemon.length && Math.random() < 0.6) {
    const p = choice(G.apiData.pokemon);
    name = p.name;
    sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.url.split('/').slice(-2,-1)[0]}.png`;
  }
  
  const e = {
    type: 'enemy', x: wx*TILE+TILE/2, y: wy*TILE+TILE/2,
    vx: 0, vy: 0, r: 18,
    hp: 30 + lvl*15, maxHp: 30 + lvl*15,
    atk: 5 + lvl*2, def: lvl,
    lvl, name, sprite, biome: tile.biome,
    ai: choice(['chase','wander','ranged','charge']),
    aiTimer: 0, target: null,
    xp: 20 + lvl*10, gold: randi(5, 20) + lvl*3,
    color: `hsl(${randi(0,360)}, 70%, 50%)`,
    state: 'idle', stateTimer: 0,
    hitFlash: 0, dead: false
  };
  chunk.entities.push(e);
  G.entities.push(e);
}

// ============ SPAWNNPC ============
function spawnNPC(chunk) {
  const x = randi(2, CHUNK-2), y = randi(2, CHUNK-2);
  const wx = chunk.cx*CHUNK+x, wy = chunk.cy*CHUNK+y;
  if (isWaterTile(wx, wy) || isBridgeTile(wx, wy) || isVillageBuilding(wx, wy) || isVillageRoad(wx, wy)) return;
  let name = 'Странник', img = null;
  if (G.apiData.chars.length) {
    const c = choice(G.apiData.chars);
    name = c.name; img = c.image;
  }
  chunk.npcs.push({
    type:'npc', x: wx*TILE+TILE/2, y: wy*TILE+TILE/2, r: 20,
    name, img, dialogue: generateDialogue(name),
    quest: Math.random() < 0.4 ? generateQuest() : null,
    bobPhase: rand(0, Math.PI*2)
  });
}

// ============ SPAWNITEM ============
function spawnItem(chunk) {
  const x = randi(1, CHUNK-1), y = randi(1, CHUNK-1);
  const tile = chunk.tiles[y*CHUNK+x];
  const wx = chunk.cx*CHUNK+x, wy = chunk.cy*CHUNK+y;
  if (tile.solid || isWaterTile(wx, wy) || isBridgeTile(wx, wy) || isVillageBuilding(wx, wy)) return;
  chunk.items.push(createItem(wx*TILE+TILE/2, wy*TILE+TILE/2));
}

// ============ CREATEITEM ============
function createItem(x, y, forceType=null) {
  const types = [
    {t:'potion', name:'Зелье HP', icon:'🧪', color:'#ff4488', effect:'heal', val:30, rarity:1},
    {t:'mana', name:'Зелье маны', icon:'💙', color:'#4488ff', effect:'mana', val:25, rarity:1},
    {t:'gold', name:'Золото', icon:'💰', color:'#ffaa00', effect:'gold', val:randi(10,100), rarity:1},
    {t:'sword', name:'Меч', icon:'⚔️', color:'#cccccc', effect:'weapon', val:randi(3,10), rarity:2},
    {t:'bow', name:'Лук', icon:'🏹', color:'#aa6633', effect:'weapon', val:randi(2,8), rarity:2},
    {t:'staff', name:'Посох', icon:'🪄', color:'#aa44ff', effect:'weapon', val:randi(4,12), rarity:3},
    {t:'armor', name:'Броня', icon:'🛡️', color:'#6688aa', effect:'armor', val:randi(2,8), rarity:2},
    {t:'ring', name:'Кольцо', icon:'💍', color:'#ffdd44', effect:'trinket', val:randi(1,5), rarity:3},
    {t:'gem', name:'Кристалл', icon:'💎', color:'#44ffff', effect:'xp', val:randi(30,100), rarity:3},
    {t:'scroll', name:'Свиток', icon:'📜', color:'#ffaa88', effect:'spell', val:1, rarity:2},
    {t:'meme', name:'Мем-артефакт', icon:'🗿', color:'#ff00ff', effect:'meme', val:randi(1,10), rarity:4},
    {t:'sanity', name:'Рассудок', icon:'🧠', color:'#aa00ff', effect:'sanity', val:20, rarity:2},
    {t:'pet', name:'Питомец-яйцо', icon:'🥚', color:'#ffaa88', effect:'pet', val:1, rarity:4}
  ];
  
  const pool = types.filter(t => forceType ? t.t === forceType : Math.random() < 1/t.rarity);
  const t = choice(pool.length ? pool : types);
  return {
    type:'item', x, y, r: 12, ...t,
    bobPhase: rand(0, Math.PI*2),
    id: Math.random()
  };
}

// ============ SPAWNBOSS ============
function spawnBoss(chunk) {
  const x = CHUNK/2, y = CHUNK/2;
  const wx = chunk.cx*CHUNK+x, wy = chunk.cy*CHUNK+y;
  if (isWaterTile(Math.round(wx), Math.round(wy))) return;
  const d = Math.sqrt(wx*wx+wy*wy);
  const lvl = Math.floor(d*0.5 + 10);
  
  let name = 'ДРЕВНИЙ БОСС', sprite = null;
  if (G.apiData.pokemon.length) {
    const legendaries = G.apiData.pokemon.filter((_,i) => [144,145,146,149,150,151].includes(i+1));
    if (legendaries.length) {
      const p = choice(legendaries);
      name = p.name.toUpperCase();
      sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.url.split('/').slice(-2,-1)[0]}.png`;
    }
  }
  
  G.boss = {
    type:'boss', x: wx*TILE+TILE/2, y: wy*TILE+TILE/2,
    vx:0, vy:0, r: 60,
    hp: 500 + lvl*100, maxHp: 500 + lvl*100,
    atk: 20 + lvl*5, def: lvl*2,
    lvl, name, sprite,
    phase: 1, phaseTimer: 0,
    attackPattern: 0, attackTimer: 0,
    color: '#ff00ff', hitFlash: 0, dead: false,
    xp: 500 + lvl*50, gold: 200 + lvl*20
  };
  G.entities.push(G.boss);
  log(`🔥 БОСС ${name} появился в мире!`, 'epic');
}

// ============ GENERATEDIALOGUE ============
function generateDialogue(name) {
  const pool = [
    `Привет, странник. Я ${name}. Этот мир сломан...`,
    `Осторожнее, тут водятся глючные твари.`,
    `Говорят, на краю карты можно найти рассудок...`,
    `Я видел вещи. Страшные. Мемные.`,
    `Не верь цифрам. Они лгут.`,
    `Раньше тут был нормальный мир. А теперь...`,
    `${choice(['кристаллы','тени','мемы','баги'])} повсюду. Привыкай.`
  ];
  if (G.apiData.advice && G.apiData.advice.length) pool.push(`Совет: ${G.apiData.advice[0]}`);
  return choice(pool);
}

// ============ GENERATEQUEST ============
function generateQuest() {
  const pool = [
    {name:'Охота', desc:'Убей 10 врагов', type:'kill', target:10, prog:0, reward:{xp:200, gold:100}},
    {name:'Собиратель', desc:'Собери 5 предметов', type:'items', target:5, prog:0, reward:{xp:150, gold:80}},
    {name:'Путник', desc:'Пройди 1000 единиц', type:'dist', target:1000, prog:0, reward:{xp:100, gold:50}},
    {name:'Безумец', desc:'Опусти рассудок до 30%', type:'sanity', target:30, prog:100, reward:{xp:300, gold:200}},
    {name:'Комбо', desc:'Набери комбо 10', type:'combo', target:10, prog:0, reward:{xp:250, gold:150}}
  ];
  return choice(pool);
}

// ============ ADOPTPET ============
function adoptPet() {
  const pets = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝'];
  G.pet = {
    type: choice(pets),
    x: G.player.x + 40, y: G.player.y,
    followDist: 50,
    attackCd: 0,
    bobPhase: 0
  };
  log(`🥚 Питомец ${G.pet.type} вылупился!`, 'epic');
  showAchievement('Новый друг!');
}

// ============ UPDATEBOSS ============
function updateBoss(b, dt) {
  document.getElementById('bossBar').style.display = 'block';
  document.getElementById('bossName').textContent = `${b.name} УР.${b.lvl}`;
  updateBossBar();
  
  b.attackTimer -= dt;
  if (b.attackTimer <= 0) {
    b.attackPattern = (b.attackPattern + 1) % 4;
    b.attackTimer = 2;
    
    const p = G.player;
    const ang = Math.atan2(p.y-b.y, p.x-b.x);
    
    if (b.attackPattern === 0) {
      // Круговая атака
      for (let a=0; a<Math.PI*2; a+=Math.PI/8) {
        G.projectiles.push({
          x:b.x, y:b.y, vx:Math.cos(a)*250, vy:Math.sin(a)*250,
          r:12, dmg:b.atk*0.7, life:3, color:'#ff00ff', type:'boss', owner:'enemy'
        });
      }
    } else if (b.attackPattern === 1) {
      // Прицельный залп
      for (let i=-2; i<=2; i++) {
        G.projectiles.push({
          x:b.x, y:b.y, vx:Math.cos(ang+i*0.2)*400, vy:Math.sin(ang+i*0.2)*400,
          r:10, dmg:b.atk*0.8, life:2, color:'#ff4400', type:'boss', owner:'enemy'
        });
      }
    } else if (b.attackPattern === 2) {
      // Спавн миньонов
      for (let i=0; i<3; i++) {
        const a = rand(0, Math.PI*2);
        const r = 100;
        G.entities.push({
          type:'enemy', x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r,
          vx:0, vy:0, r:14, hp:30, maxHp:30, atk:b.atk*0.5, def:0,
          lvl:b.lvl, name:'Миньон', ai:'chase', color:'#ff44aa',
          state:'chase', hitFlash:0, dead:false, xp:20, gold:10
        });
      }
    } else {
      // Телепорт
      const a = rand(0, Math.PI*2);
      b.x = p.x + Math.cos(a)*300;
      b.y = p.y + Math.sin(a)*300;
      spawnParticles(b.x, b.y, 40, '#ff00ff', 400);
    }
  }
}

// ============ UPDATEBOSSBAR ============
function updateBossBar() {
  if (!G.boss) return;
  const pct = Math.max(0, G.boss.hp / G.boss.maxHp * 100);
  document.getElementById('bossHpFill').style.width = pct + '%';
  document.getElementById('bossHpText').textContent = `${Math.max(0,Math.floor(G.boss.hp))}/${G.boss.maxHp}`;
}
