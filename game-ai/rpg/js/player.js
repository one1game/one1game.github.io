// ============ createPlayer ============
function createPlayer() {
  return {
    type:'player', x:0, y:0, vx:0, vy:0, r: 16,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    xp: 0, xpNext: 100, lvl: 1, gold: 0,
    str: 10, agi: 10, int: 10,
    facing: 0, attackCd: 0, dashCd: 0, dashTimer: 0,
    invuln: 0, hitFlash: 0,
    trail: [],
    class: choice(['Хаосит','Мемолог','Глитчмейджер','Пиксельщик'])
  };
}

// ============ useAbility ============
function useAbility(n) {
  const p = G.player;
  const costs = [0, 15, 15, 20, 25, 50];
  const cds = [0.3, 1.5, 1.5, 2, 3, 10];
  const i = n;
  if (G.cooldowns[i] > 0 || p.mp < costs[i]) return;
  p.mp -= costs[i];
  G.cooldowns[i] = cds[i];

  const ang = p.facing;
  const cx = G.W/2, cy = G.H/2;

  if (i === 1) { // Огонь
    SFX.play('fire');
    for (let a = -0.3; a <= 0.3; a += 0.15) {
      G.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(ang+a)*500, vy: Math.sin(ang+a)*500,
        r: 10, dmg: p.int*2+10, life: 1, color: '#ff4400', type:'fire',
        trail: true, owner:'player'
      });
    }
    spawnParticles(p.x, p.y, 20, '#ff4400', 300);
    screenShake(5);
  } else if (i === 2) { // Лёд
    SFX.play('ice');
    for (let a = 0; a < Math.PI*2; a += Math.PI/6) {
      G.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a)*350, vy: Math.sin(a)*350,
        r: 8, dmg: p.int*1.5+8, life: 1.2, color: '#44aaff', type:'ice',
        trail: true, owner:'player', slow: 0.5
      });
    }
    spawnParticles(p.x, p.y, 30, '#44aaff', 250);
  } else if (i === 3) { // Молния
    SFX.play('lightning');
    const target = findNearestEnemy(p.x, p.y, 400);
    if (target) {
      damageEnemy(target, p.int*4+20, true);
      // Цепная молния
      let last = target;
      for (let i=0; i<3; i++) {
        const next = findNearestEnemy(last.x, last.y, 200, last);
        if (next) {
          damageEnemy(next, p.int*2+10, true);
          spawnLightning(last.x, last.y, next.x, next.y);
          last = next;
        }
      }
      spawnLightning(p.x, p.y, target.x, target.y);
      screenShake(8);
    }
  } else if (i === 4) { // Хил
    SFX.play('heal');
    p.hp = Math.min(p.maxHp, p.hp + p.int*3+30);
    spawnParticles(p.x, p.y, 30, '#44ff44', 200);
    showDmgNum(p.x, p.y-30, '+'+(p.int*3+30), '#44ff44');
  } else if (i === 5) { // Ульта
    SFX.play('ultimate');
    G.slowmo = 0.3; G.slowmoTimer = 3;
    for (let a = 0; a < Math.PI*2; a += Math.PI/12) {
      G.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a)*600, vy: Math.sin(a)*600,
        r: 15, dmg: p.int*5+30, life: 2, color: '#ff00ff', type:'ultimate',
        trail: true, owner:'player', pierce: 5
      });
    }
    spawnParticles(p.x, p.y, 80, '#ff00ff', 500);
    screenShake(15);
    G.screenFlash = 0.5;
    log('💥 УЛЬТА АКТИВИРОВАНА!', 'epic');
  }
}

// ============ playerAttack ============
function playerAttack() {
  const p = G.player;
  if (p.attackCd > 0) return;
  p.attackCd = 0.3;
  SFX.play('attack');

  const ang = p.facing;
  const range = 60;
  const arc = 0.8;

  // Визуальный взмах
  spawnSlash(p.x, p.y, ang, range);

  // Урон врагам в радиусе
  G.entities.forEach(e => {
    if (e.type !== 'enemy' && e.type !== 'boss') return;
    if (e.dead) return;
    const d = dist(p, e);
    if (d > range + e.r) return;
    const a = Math.atan2(e.y-p.y, e.x-p.x);
    let da = Math.abs(a - ang);
    if (da > Math.PI) da = Math.PI*2 - da;
    if (da < arc) {
      const crit = Math.random() < 0.15;
      const dmg = Math.floor((p.str*1.5 + 5) * (crit ? 2.5 : 1));
      damageEnemy(e, dmg, crit);
      // Отбрасывание
      const ka = Math.atan2(e.y-p.y, e.x-p.x);
      e.vx += Math.cos(ka) * 200;
      e.vy += Math.sin(ka) * 200;
    }
  });

  G.combo++;
  G.comboTimer = 2;
  if (G.combo > 1) SFX.play('combo', G.combo);
}

// ============ useDash ============
function useDash() {
  const p = G.player;
  if (G.cooldowns[7] > 0) return;
  G.cooldowns[7] = 1.5;
  SFX.play('dash');
  p.dashTimer = 0.2;
  p.invuln = 0.3;
  const ang = p.facing;
  p.vx += Math.cos(ang) * 800;
  p.vy += Math.sin(ang) * 800;
  spawnParticles(p.x, p.y, 20, '#44ffff', 300);
}

// ============ findNearestEnemy ============
function findNearestEnemy(x, y, range, exclude=null) {
  let best = null, bestD = range;
  G.entities.forEach(e => {
    if ((e.type !== 'enemy' && e.type !== 'boss') || e.dead) return;
    if (e === exclude) return;
    const d = dist({x,y}, e);
    if (d < bestD) { bestD = d; best = e; }
  });
  return best;
}

// ============ damageEnemy ============
function damageEnemy(e, dmg, crit=false) {
  const actual = Math.max(1, dmg - e.def*0.5);
  e.hp -= actual;
  e.hitFlash = 0.2;
  G.damageDealt += actual;
  if (e.type === 'boss') SFX.play('boss_hit');
  showDmgNum(e.x, e.y-e.r, actual, crit ? '#ffaa00' : '#ff4444', crit);
  spawnParticles(e.x, e.y, crit ? 15 : 6, crit ? '#ffaa00' : '#ff4444', 200);
  screenShake(crit ? 8 : 3);

  if (e.hp <= 0 && !e.dead) killEnemy(e);
  if (e === G.boss) updateBossBar();
}

// ============ killEnemy ============
function killEnemy(e) {
  e.dead = true;
  SFX.play(e.type === 'boss' ? 'boss_death' : 'death');
  G.kills++;
  G.player.xp += e.xp;
  G.player.gold += e.gold;
  G.itemsCollected++;

  spawnParticles(e.x, e.y, 40, e.color, 400);
  showDmgNum(e.x, e.y-40, '+'+e.xp+' XP', '#ffaa00');

  // Шанс дропа
  if (Math.random() < 0.4) {
    const item = createItem(e.x, e.y);
    G.entities.push(item);
  }

  // Комбо
  G.combo++;
  G.comboTimer = 2;

  // Квест
  if (G.activeQuest && G.activeQuest.type === 'kill') {
    G.activeQuest.prog++;
    if (G.activeQuest.prog >= G.activeQuest.target) completeQuest();
  }

  // Достижения
  checkAchievements();

  // Убираем из чанка
  G.chunks.forEach(c => {
    const i = c.entities.indexOf(e);
    if (i >= 0) c.entities.splice(i, 1);
  });

  if (e === G.boss) {
    log(`👑 БОСС ${e.name} ПОВЕРЖЕН!`, 'epic');
    unlock('boss_slayer');
    G.boss = null;
    document.getElementById('bossBar').style.display = 'none';
    // Большой дроп
    for (let i=0; i<5; i++) {
      const ang = rand(0, Math.PI*2);
      const r = rand(50, 150);
      G.entities.push(createItem(e.x + Math.cos(ang)*r, e.y + Math.sin(ang)*r));
    }
  }

  checkLevelUp();
}

// ============ checkLevelUp ============
function checkLevelUp() {
  const p = G.player;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.lvl++;
    p.xpNext = Math.floor(p.xpNext * 1.4);
    p.maxHp += 15;
    p.maxMp += 8;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.str += 2;
    p.agi += 2;
    p.int += 2;
    SFX.play('levelup');
    log(`⭐ УРОВЕНЬ ${p.lvl}!`, 'epic');
    spawnParticles(p.x, p.y, 60, '#ffaa00', 500);
    screenShake(10);
    G.screenFlash = 0.3;
    showAchievement(`Уровень ${p.lvl}!`);
  }
}

// ============ checkAchievements ============
function checkAchievements() {
  const checks = [
    ['first_blood', G.kills >= 1, '🩸 Первая кровь'],
    ['killer_10', G.kills >= 10, '💀 Убийца (10)'],
    ['killer_100', G.kills >= 100, '☠️ Жнец (100)'],
    ['rich', G.player.gold >= 500, '💰 Богач'],
    ['combo_10', G.combo >= 10, '🔥 Комбо мастер'],
    ['combo_50', G.combo >= 50, '⚡ НЕВЕРОЯТНО'],
    ['explorer', G.distanceTraveled >= 5000, '🗺️ Путешественник'],
    ['collector', G.itemsCollected >= 30, '🎒 Коллекционер'],
    ['crazy', G.sanity < 20, '🤪 Безумец'],
    ['lvl10', G.player.lvl >= 10, '⭐ Veteran']
  ];
  checks.forEach(([id, cond, name]) => {
    if (cond && !G.achievements.has(id)) {
      G.achievements.add(id);
      showAchievement(name);
      log(`🏆 ${name}`, 'epic');
    }
  });
}

// ============ completeQuest ============
function completeQuest() {
  if (!G.activeQuest) return;
  const q = G.activeQuest;
  G.player.xp += q.reward.xp;
  G.player.gold += q.reward.gold;
  SFX.play('quest');
  log(`✅ КВЕСТ "${q.name}" выполнен! +${q.reward.xp}XP +${q.reward.gold}💰`, 'epic');
  showAchievement(`Квест: ${q.name}`);
  G.activeQuest = null;
  checkLevelUp();
}

// ============ pickupItem ============
function pickupItem(item) {
  const p = G.player;
  SFX.play('pickup');
  G.itemsCollected++;

  if (item.effect === 'gold') {
    p.gold += item.val;
    log(`💰 +${item.val} золота`, 'loot');
  } else if (item.effect === 'xp') {
    p.xp += item.val;
    log(`✨ +${item.val} опыта`, 'loot');
    checkLevelUp();
  } else if (item.effect === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + item.val);
    log(`❤️ +${item.val} HP`, 'loot');
    showDmgNum(p.x, p.y-30, '+'+item.val, '#44ff44');
  } else if (item.effect === 'mana') {
    p.mp = Math.min(p.maxMp, p.mp + item.val);
    log(`💙 +${item.val} маны`, 'loot');
  } else if (item.effect === 'sanity') {
    G.sanity = Math.min(100, G.sanity + item.val);
    log(`🧠 +${item.val} рассудка`, 'loot');
  } else if (item.effect === 'pet') {
    adoptPet();
  } else if (item.effect === 'weapon' || item.effect === 'armor' || item.effect === 'trinket') {
    if (G.inventory.length < G.maxInv) {
      G.inventory.push(item);
      log(`${item.icon} Получено: ${item.name} (+${item.val})`, 'loot');
    } else {
      log('🎒 Инвентарь полон!', 'info');
      return;
    }
  } else if (item.effect === 'meme') {
    triggerMemeEvent();
    log(`🗿 МЕМ-АРТЕФАКТ активирован!`, 'meme');
  } else {
    if (G.inventory.length < G.maxInv) {
      G.inventory.push(item);
      log(`${item.icon} ${item.name}`, 'loot');
    }
  }

  spawnParticles(item.x, item.y, 15, item.color, 200);
  showDmgNum(item.x, item.y-20, item.icon, item.color);

  if (G.activeQuest && G.activeQuest.type === 'items') {
    G.activeQuest.prog++;
    if (G.activeQuest.prog >= G.activeQuest.target) completeQuest();
  }
  if (G.activeQuest && G.activeQuest.type === 'combo' && G.combo >= G.activeQuest.target) {
    completeQuest();
  }
}

// ============ damagePlayer ============
function damagePlayer(dmg) {
  const p = G.player;
  if (p.invuln > 0) return;
  SFX.play('hit');
  const actual = Math.max(1, dmg - p.agi*0.3);
  p.hp -= actual;
  p.invuln = 0.5;
  p.hitFlash = 0.3;
  showDmgNum(p.x, p.y-30, actual, '#ff0044');
  spawnParticles(p.x, p.y, 15, '#ff0044', 300);
  screenShake(10);
  G.combo = 0;

  if (p.hp <= 0) playerDeath();
}

// ============ playerDeath ============
function playerDeath() {
  log('💀 ВЫ ПОГИБЛИ! Возрождение...', 'combat');
  const p = G.player;
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  p.x = 0; p.y = 0;
  p.gold = Math.floor(p.gold * 0.7);
  G.sanity = Math.max(30, G.sanity - 20);
  G.combo = 0;
  spawnParticles(p.x, p.y, 80, '#ff0044', 500);
  G.screenFlash = 0.5;
}

// ============ spawnParticles ============
function spawnParticles(x, y, count, color, speed=200) {
  for (let i=0; i<count; i++) {
    const a = rand(0, Math.PI*2);
    const s = rand(speed*0.3, speed);
    G.particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      life: rand(0.3, 1), maxLife: 1,
      color, size: rand(2, 6)
    });
  }
}

// ============ spawnSlash ============
function spawnSlash(x, y, ang, range) {
  for (let i=0; i<15; i++) {
    const a = ang + rand(-0.4, 0.4);
    const r = rand(20, range);
    G.particles.push({
      x: x + Math.cos(a)*r*0.5, y: y + Math.sin(a)*r*0.5,
      vx: Math.cos(a)*200, vy: Math.sin(a)*200,
      life: 0.3, maxLife: 0.3,
      color: '#ffffff', size: rand(3, 6), slash: true
    });
  }
}

// ============ spawnLightning ============
function spawnLightning(x1, y1, x2, y2) {
  const segs = 8;
  for (let i=0; i<segs; i++) {
    const t = i/segs;
    const x = lerp(x1, x2, t) + rand(-20, 20);
    const y = lerp(y1, y2, t) + rand(-20, 20);
    G.particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.3, maxLife: 0.3,
      color: '#ffff44', size: rand(4, 8), lightning: true
    });
  }
}

// ============ showDmgNum ============
function showDmgNum(x, y, text, color='#fff', crit=false) {
  const sx = x - G.cam.x + G.W/2;
  const sy = y - G.cam.y + G.H/2;
  const div = document.createElement('div');
  div.className = 'dmg-num' + (crit ? ' dmg-crit' : '');
  div.style.left = sx + 'px';
  div.style.top = sy + 'px';
  div.style.color = color;
  div.textContent = text;
  document.getElementById('damageNumbers').appendChild(div);
  setTimeout(() => div.remove(), 1200);
}

// ============ screenShake ============
function screenShake(amt) { G.cam.shake = Math.max(G.cam.shake, amt); }

// ============ showAchievement ============
function showAchievement(name) {
  SFX.play('achievement');
  const el = document.getElementById('achievement');
  document.getElementById('achName').textContent = name;
  el.style.display = 'block';
  el.style.animation = 'none';
  setTimeout(() => el.style.animation = '', 10);
  setTimeout(() => el.style.display = 'none', 4000);
}

// ============ log ============
function log(text, type='info') {
  const el = document.getElementById('eventLog');
  const e = document.createElement('div');
  e.className = 'log-entry log-' + type;
  e.textContent = text;
  el.insertBefore(e, el.firstChild);
  while (el.children.length > 30) el.removeChild(el.lastChild);
}
