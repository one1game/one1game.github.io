// ============ updateUI ============
function updateUI() {
  const p = G.player;
  document.getElementById('pLvl').textContent = p.lvl;
  document.getElementById('pClass').textContent = p.class;
  document.getElementById('hpFill').style.width = (p.hp/p.maxHp*100) + '%';
  document.getElementById('hpText').textContent = `${Math.max(0,Math.floor(p.hp))}/${p.maxHp}`;
  document.getElementById('mpFill').style.width = (p.mp/p.maxMp*100) + '%';
  document.getElementById('mpText').textContent = `${Math.floor(p.mp)}/${p.maxMp}`;
  document.getElementById('xpFill').style.width = (p.xp/p.xpNext*100) + '%';
  document.getElementById('xpText').textContent = `${p.xp}/${p.xpNext} XP`;
  document.getElementById('sanFill').style.width = G.sanity + '%';
  document.getElementById('sanText').textContent = `🧠 ${Math.floor(G.sanity)}%`;
  document.getElementById('sStr').textContent = p.str;
  document.getElementById('sAgi').textContent = p.agi;
  document.getElementById('sInt').textContent = p.int;
  document.getElementById('sGold').textContent = p.gold;
  document.getElementById('sKills').textContent = G.kills;
  document.getElementById('sCoords').textContent = `${Math.floor(p.x/TILE)},${Math.floor(p.y/TILE)}`;
  
  // Глитч-класс для UI при низком рассудке
  if (G.sanity < 30) document.getElementById('ui').classList.add('glitch');
  else document.getElementById('ui').classList.remove('glitch');
}

// ============ toggleInventory ============
function toggleInventory() {
  const m = document.getElementById('modal');
  const box = document.getElementById('modalBox');
  if (m.style.display === 'flex') { m.style.display = 'none'; return; }
  
  let html = `<h2>🎒 ИНВЕНТАРЬ (${G.inventory.length}/${G.maxInv})</h2>`;
  html += `<div style="display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:15px 0;">`;
  for (let i=0; i<G.maxInv; i++) {
    const it = G.inventory[i];
    if (it) {
      html += `<div onclick="useInvItem(${i})" style="background:rgba(255,255,255,0.1); border:2px solid ${it.color}; padding:8px; border-radius:6px; cursor:pointer; text-align:center;">
        <div style="font-size:28px;">${it.icon}</div>
        <div style="font-size:10px;">${it.name}</div>
        <div style="font-size:9px; color:#aaa;">+${it.val}</div>
      </div>`;
    } else {
      html += `<div style="background:rgba(255,255,255,0.05); border:2px solid #333; padding:8px; border-radius:6px; height:70px;"></div>`;
    }
  }
  html += `</div>`;
  
  // Экипировка
  html += `<h3 style="color:#ffaa00; margin-top:15px;">⚔️ ЭКИПИРОВКА</h3>`;
  html += `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">`;
  ['weapon','armor','trinket'].forEach(slot => {
    const it = G.equipped[slot];
    html += `<div style="background:rgba(255,255,255,0.1); padding:8px; border-radius:6px; text-align:center; border:2px solid #ffaa00;">
      <div style="font-size:10px; color:#ffaa00;">${slot.toUpperCase()}</div>
      ${it ? `<div style="font-size:24px;">${it.icon}</div><div style="font-size:10px;">${it.name}</div>` : '<div style="font-size:10px; color:#666;">Пусто</div>'}
    </div>`;
  });
  html += `</div>`;
  
  // Квест
  if (G.activeQuest) {
    html += `<h3 style="color:#ffaa00; margin-top:15px;">📜 АКТИВНЫЙ КВЕСТ</h3>`;
    html += `<div style="background:rgba(255,170,0,0.2); padding:10px; border-radius:6px; border:1px solid #ffaa00;">
      <b>${G.activeQuest.name}</b><br>
      <div style="font-size:12px;">${G.activeQuest.desc}</div>
      <div style="font-size:11px; color:#ffaa00;">Прогресс: ${Math.floor(G.activeQuest.prog)}/${G.activeQuest.target}</div>
    </div>`;
  }
  
  html += `<button class="btn" onclick="document.getElementById('modal').style.display='none'">ЗАКРЫТЬ</button>`;
  box.innerHTML = html;
  m.style.display = 'flex';
}

// ============ useInvItem ============
function useInvItem(i) {
  const it = G.inventory[i];
  if (!it) return;
  
  if (it.effect === 'heal') {
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + it.val);
    log(`❤️ Использовано: ${it.name}`, 'info');
    G.inventory.splice(i, 1);
  } else if (it.effect === 'mana') {
    G.player.mp = Math.min(G.player.maxMp, G.player.mp + it.val);
    log(`💙 Использовано: ${it.name}`, 'info');
    G.inventory.splice(i, 1);
  } else if (it.effect === 'weapon') {
    G.equipped.weapon = it;
    G.player.str += it.val;
    log(`⚔️ Экипировано: ${it.name}`, 'info');
    G.inventory.splice(i, 1);
  } else if (it.effect === 'armor') {
    G.equipped.armor = it;
    G.player.agi += it.val;
    log(`🛡️ Экипировано: ${it.name}`, 'info');
    G.inventory.splice(i, 1);
  } else if (it.effect === 'trinket') {
    G.equipped.trinket = it;
    G.player.int += it.val;
    log(`💍 Экипировано: ${it.name}`, 'info');
    G.inventory.splice(i, 1);
  } else if (it.effect === 'xp') {
    G.player.xp += it.val;
    log(`✨ +${it.val} XP`, 'info');
    G.inventory.splice(i, 1);
    checkLevelUp();
  } else if (it.effect === 'sanity') {
    G.sanity = Math.min(100, G.sanity + it.val);
    log(`🧠 +${it.val} рассудка`, 'info');
    G.inventory.splice(i, 1);
  }
  
  toggleInventory();
  toggleInventory();
}

// ============ interact ============
function interact() {
  const p = G.player;
  let nearest = null, nd = 80;
  G.entities.forEach(e => {
    if (e.type === 'npc') {
      const d = dist(p, e);
      if (d < nd) { nd = d; nearest = e; }
    }
  });
  if (nearest) talkToNPC(nearest);
}

// ============ talkToNPC ============
function talkToNPC(npc) {
  const box = document.getElementById('modalBox');
  let html = `<h2>${npc.name}</h2>`;
  if (npc.img) html += `<img src="${npc.img}" onerror="this.style.display='none'">`;
  html += `<p style="margin:15px 0; line-height:1.6;">"${npc.dialogue}"</p>`;
  
  if (npc.quest && !G.activeQuest) {
    html += `<div style="background:rgba(255,170,0,0.2); padding:10px; border-radius:6px; margin:10px 0; border:1px solid #ffaa00;">
      <b style="color:#ffaa00;">📜 КВЕСТ: ${npc.quest.name}</b><br>
      <div style="font-size:12px;">${npc.quest.desc}</div>
      <div style="font-size:11px; color:#ffaa00;">Награда: ${npc.quest.reward.xp}XP, ${npc.quest.reward.gold}💰</div>
    </div>`;
    html += `<button class="btn gold" onclick="acceptQuest()">ВЗЯТЬ КВЕСТ</button>`;
  } else if (G.activeQuest) {
    html += `<p style="color:#aaa; font-size:12px;">У вас уже есть активный квест.</p>`;
  }
  
  html += `<button class="btn" onclick="document.getElementById('modal').style.display='none'">УЙТИ</button>`;
  box.innerHTML = html;
  document.getElementById('modal').style.display = 'flex';
  window._currentNPC = npc;
}

// ============ acceptQuest ============
function acceptQuest() {
  if (!window._currentNPC || !window._currentNPC.quest) return;
  G.activeQuest = {...window._currentNPC.quest};
  log(`📜 Квест принят: ${G.activeQuest.name}`, 'quest');
  document.getElementById('modal').style.display = 'none';
}
