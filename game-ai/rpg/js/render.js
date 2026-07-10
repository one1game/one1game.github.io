// ============ render() ============
function render() {
  // Фон
  G.bgCtx.fillStyle = '#0a0015';
  G.bgCtx.fillRect(0, 0, G.W, G.H);
  
  // День/ночь
  const night = Math.sin(G.dayTime * Math.PI*2);
  const dark = clamp(-night*0.5, 0, 0.5);
  
  // Основной слой
  G.ctx.clearRect(0, 0, G.W, G.H);
  
  const shakeX = (Math.random()-0.5) * G.cam.shake;
  const shakeY = (Math.random()-0.5) * G.cam.shake;
  const offX = G.W/2 - G.cam.x + shakeX;
  const offY = G.H/2 - G.cam.y + shakeY;
  
  G.ctx.save();
  G.ctx.translate(offX, offY);
  
  // Глитч-смещение
  if (G.glitch > 0 && Math.random() < 0.3) {
    G.ctx.translate(rand(-10,10)*G.glitch, 0);
  }
  
  // Тайлы
  renderTiles();
  
  // Здания деревень (поверх тайлов)
  renderVillageBuildings();
  
  // Предметы
  G.entities.forEach(e => {
    if (e.type === 'item') renderItem(e);
  });
  
  // NPC
  G.entities.forEach(e => {
    if (e.type === 'npc') renderNPC(e);
  });
  
  // След игрока
  G.player.trail.forEach(t => {
    G.ctx.globalAlpha = t.life;
    G.ctx.fillStyle = '#4488ff';
    G.ctx.beginPath();
    G.ctx.arc(t.x, t.y, G.player.r * t.life, 0, Math.PI*2);
    G.ctx.fill();
  });
  G.ctx.globalAlpha = 1;
  
  // Враги и босс
  G.entities.forEach(e => {
    if (e.type === 'enemy' || e.type === 'boss') renderEnemy(e);
  });
  
  // Питомец
  if (G.pet) renderPet();
  
  // Игрок
  renderPlayer();
  
  // Снаряды
  G.projectiles.forEach(renderProjectile);
  
  G.ctx.restore();
  
  // FX слой (частицы, экран-эффекты)
  G.fxCtx.clearRect(0, 0, G.W, G.H);
  G.fxCtx.save();
  G.fxCtx.translate(offX, offY);
  G.particles.forEach(renderParticle);
  G.fxCtx.restore();
  
  // Ночной оверлей
  if (dark > 0) {
    G.fxCtx.fillStyle = `rgba(0,0,30,${dark})`;
    G.fxCtx.fillRect(0, 0, G.W, G.H);
    
    // Свет вокруг игрока
    const grd = G.fxCtx.createRadialGradient(G.W/2+shakeX, G.H/2+shakeY, 50, G.W/2+shakeX, G.H/2+shakeY, 300);
    grd.addColorStop(0, 'rgba(0,0,30,0)');
    grd.addColorStop(1, `rgba(0,0,30,${dark})`);
    G.fxCtx.globalCompositeOperation = 'destination-out';
    G.fxCtx.fillStyle = grd;
    G.fxCtx.fillRect(0, 0, G.W, G.H);
    G.fxCtx.globalCompositeOperation = 'source-over';
  }
  
  // Screen flash
  if (G.screenFlash > 0) {
    G.fxCtx.fillStyle = `rgba(255,255,255,${G.screenFlash})`;
    G.fxCtx.fillRect(0, 0, G.W, G.H);
  }
  
  // Погода
  if (G.weather === 'meme') renderMemeWeather();
  
  // Глитч-оверлей
  if (G.glitch > 0) renderGlitch();
  
  // Комбо
  if (G.combo > 1) {
    G.fxCtx.save();
    G.fxCtx.font = 'bold 48px Courier New';
    G.fxCtx.fillStyle = `hsl(${G.time*100 % 360}, 100%, 60%)`;
    G.fxCtx.textAlign = 'center';
    G.fxCtx.shadowColor = '#000';
    G.fxCtx.shadowBlur = 10;
    G.fxCtx.fillText(`COMBO x${G.combo}`, G.W/2, 150);
    G.fxCtx.restore();
  }
  
  // Миникарта
  renderMinimap();
  
  // UI кулдауны
  updateAbilityUI();
}

// ============ renderTiles() ============
function renderTiles() {
  const p = G.player;
  const cx = Math.floor(p.x/TILE/CHUNK);
  const cy = Math.floor(p.y/TILE/CHUNK);
  
  for (let dy=-2; dy<=2; dy++) {
    for (let dx=-2; dx<=2; dx++) {
      const chunk = getChunk(cx+dx, cy+dy);
      chunk.tiles.forEach(t => {
        const sx = t.wx*TILE, sy = t.wy*TILE;
        // Отсечение
        if (Math.abs(sx + TILE/2 - p.x) > G.W/2 + TILE) return;
        if (Math.abs(sy + TILE/2 - p.y) > G.H/2 + TILE) return;
        
        let color = BIOME_COLORS[t.biome];
        // Вариация
        const v = (t.variant - 0.5) * 0.2;
        
        // ----- ДОРОГА ДЕРЕВНИ -----
        if (isVillageRoad(t.wx, t.wy)) {
          renderVillageRoadTile(sx, sy, t);
          return;
        }
        
        // ----- МОСТ (проверяем первым — мост поверх воды) -----
        if (isBridgeTile(t.wx, t.wy)) {
          renderBridgeTile(sx, sy, t);
          return;
        }
        
        // ----- ВОДА (река или озеро) -----
        if (isWaterTile(t.wx, t.wy)) {
          renderWaterTile(sx, sy, t);
          return;
        }
        
        G.ctx.fillStyle = color;
        G.ctx.fillRect(sx, sy, TILE+1, TILE+1);
        
        // Детали
        if (t.biome === BIOMES.FOREST && t.variant > 0.6) {
          G.ctx.fillStyle = '#0a2a0a';
          G.ctx.beginPath();
          G.ctx.arc(sx+TILE/2, sy+TILE/2, 12, 0, Math.PI*2);
          G.ctx.fill();
          G.ctx.fillStyle = '#1a4a1a';
          G.ctx.beginPath();
          G.ctx.arc(sx+TILE/2, sy+TILE/2-4, 10, 0, Math.PI*2);
          G.ctx.fill();
        } else if (t.biome === BIOMES.CRYSTAL && t.variant > 0.5) {
          G.ctx.fillStyle = '#aa44ff';
          G.ctx.globalAlpha = 0.6 + Math.sin(G.time*2 + t.wx + t.wy)*0.3;
          G.ctx.beginPath();
          G.ctx.moveTo(sx+TILE/2, sy+5);
          G.ctx.lineTo(sx+TILE-8, sy+TILE/2);
          G.ctx.lineTo(sx+TILE/2, sy+TILE-5);
          G.ctx.lineTo(sx+8, sy+TILE/2);
          G.ctx.fill();
          G.ctx.globalAlpha = 1;
        } else if (t.biome === BIOMES.MEMLAND) {
          if (t.variant > 0.7) {
            G.ctx.font = '20px Arial';
            G.ctx.textAlign = 'center';
            G.ctx.fillText(choice(['🗿','💀','🤡','👽','🌈','✨','🔥']), sx+TILE/2, sy+TILE/2+6);
          }
        } else if (t.biome === BIOMES.GLITCH) {
          if (Math.random() < 0.1) {
            G.ctx.fillStyle = `hsl(${randi(0,360)}, 100%, 50%)`;
            G.ctx.fillRect(sx+rand(0,TILE), sy+rand(0,TILE), rand(2,10), rand(2,10));
          }
        } else if (t.biome === BIOMES.LAVA) {
          G.ctx.fillStyle = `rgba(255,${100+Math.sin(G.time*3+t.wx)*50|0},0,${0.3+Math.sin(G.time*2+t.wy)*0.2})`;
          G.ctx.fillRect(sx, sy, TILE, TILE);
        } else if (t.biome === BIOMES.SNOW) {
          if (t.variant > 0.8) {
            G.ctx.fillStyle = '#ffffff';
            G.ctx.beginPath();
            G.ctx.arc(sx+TILE/2, sy+TILE/2, 3, 0, Math.PI*2);
            G.ctx.fill();
          }
        }
        
        // Глитч-тайлы
        if (G.glitch > 0 && Math.random() < 0.005 * G.glitch) {
          G.ctx.fillStyle = `hsl(${randi(0,360)}, 100%, 50%)`;
          G.ctx.fillRect(sx, sy, TILE, TILE);
        }
      });
    }
  }
}

// ============ renderWaterTile() ============
function renderWaterTile(sx, sy, t) {
  const wave = Math.sin(G.time * 2 + t.wx * 0.3 + t.wy * 0.3) * 0.15;
  const flow = Math.cos(G.time * 1.5 + t.wy * 0.2) * 0.1;
  
  // Основа воды — тёмно-синий
  const r = 10 + Math.floor((wave + flow) * 20);
  const g = 30 + Math.floor(wave * 30);
  const b = 140 + Math.floor((wave + flow) * 40);
  
  G.ctx.fillStyle = `rgb(${r},${g},${b})`;
  G.ctx.fillRect(sx, sy, TILE+1, TILE+1);
  
  // Блики на воде
  const shimmerAlpha = 0.1 + Math.sin(G.time * 3 + t.wx * 0.5 + t.wy * 0.5) * 0.1;
  G.ctx.fillStyle = `rgba(100,180,255,${shimmerAlpha})`;
  G.ctx.fillRect(sx, sy, TILE, TILE/2);
  
  // Волны (горизонтальные линии)
  G.ctx.strokeStyle = `rgba(150,200,255,0.25)`;
  G.ctx.lineWidth = 1;
  for (let wy = 0; wy < 3; wy++) {
    const wyOff = sy + TILE * 0.25 + wy * TILE * 0.3 + Math.sin(G.time * 3 + t.wx * 0.4 + wy) * 6;
    G.ctx.beginPath();
    G.ctx.moveTo(sx, wyOff);
    for (let wx = 0; wx <= TILE; wx += 8) {
      G.ctx.lineTo(sx + wx, wyOff + Math.sin(G.time * 2 + wx * 0.3 + t.wy * 0.4) * 3);
    }
    G.ctx.stroke();
  }
  
  // Глитч-эффекты на воде (для хаоса)
  if (G.glitch > 0.5 || t.biome === BIOMES.GLITCH) {
    const glitchChance = Math.max(0.02, G.glitch * 0.05);
    if (Math.random() < glitchChance) {
      G.ctx.fillStyle = `rgba(${randi(0,255)},${randi(0,255)},${randi(0,255)},0.5)`;
      G.ctx.fillRect(sx + rand(0, TILE*0.6), sy + rand(0, TILE*0.6), rand(4, 20), rand(2, 8));
    }
    // Случайные пиксельные сбои
    if (Math.random() < glitchChance * 2) {
      G.ctx.fillStyle = '#00ffff';
      G.ctx.fillRect(sx + rand(0, TILE-4), sy + rand(0, TILE-4), rand(2, 6), 2);
    }
  }
  
  // Береговая рябь (по краям воды)
  const neighbors = [
    [t.wx-1, t.wy], [t.wx+1, t.wy], [t.wx, t.wy-1], [t.wx, t.wy+1]
  ];
  let nearShore = false;
  for (const [nx, ny] of neighbors) {
    if (!isWaterTile(nx, ny)) { nearShore = true; break; }
  }
  if (nearShore) {
    G.ctx.fillStyle = `rgba(150,200,255,${0.08 + Math.sin(G.time*2 + t.wx)*0.04})`;
    const shoreOff = 4;
    G.ctx.fillRect(sx+shoreOff, sy+shoreOff, TILE-shoreOff*2, TILE-shoreOff*2);
  }
}

// ============ renderBridgeTile() ============
function renderBridgeTile(sx, sy, t) {
  // Земля под мостом
  G.ctx.fillStyle = BIOME_COLORS[t.biome] || '#3a3a2a';
  G.ctx.fillRect(sx, sy, TILE+1, TILE+1);
  
  // Доски моста
  const plankH = 6;
  const plankGap = 4;
  const left = sx + 4;
  const right = sx + TILE - 4;
  
  for (let py = sy; py < sy + TILE; py += plankH + plankGap) {
    G.ctx.fillStyle = '#8B6914';
    G.ctx.fillRect(left, py, right - left, plankH);
    
    // Текстура дерева
    G.ctx.fillStyle = '#6B4914';
    G.ctx.fillRect(left + 2, py + 1, right - left - 4, 2);
    G.ctx.fillStyle = '#A07830';
    G.ctx.fillRect(left + 4, py + 4, right - left - 8, 1);
  }
  
  // Верёвки по бокам
  G.ctx.strokeStyle = '#c4a060';
  G.ctx.lineWidth = 2;
  G.ctx.setLineDash([6, 4]);
  G.ctx.beginPath();
  G.ctx.moveTo(left - 2, sy + 2);
  G.ctx.lineTo(left - 2, sy + TILE - 2);
  G.ctx.stroke();
  G.ctx.beginPath();
  G.ctx.moveTo(right + 2, sy + 2);
  G.ctx.lineTo(right + 2, sy + TILE - 2);
  G.ctx.stroke();
  G.ctx.setLineDash([]);
  
  // Столбики
  G.ctx.fillStyle = '#5a3a0a';
  G.ctx.fillRect(left - 4, sy, 6, 4);
  G.ctx.fillRect(right - 2, sy, 6, 4);
  G.ctx.fillRect(left - 4, sy + TILE - 4, 6, 4);
  G.ctx.fillRect(right - 2, sy + TILE - 4, 6, 4);
}

// ============ renderVillageRoadTile() ============
function renderVillageRoadTile(sx, sy, t) {
  // Основа земли (биом)
  G.ctx.fillStyle = BIOME_COLORS[t.biome] || '#3a3a2a';
  G.ctx.fillRect(sx, sy, TILE+1, TILE+1);
  
  // Дорожное покрытие
  G.ctx.fillStyle = '#b8a880';
  G.ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
  
  // Камни на дороге
  G.ctx.fillStyle = '#9a8a6a';
  if (hash(t.wx, t.wy) > 0.5) {
    G.ctx.fillRect(sx + 10, sy + 10, 6, 4);
  }
  if (hash(t.wx+1, t.wy+1) > 0.5) {
    G.ctx.fillRect(sx + TILE - 16, sy + TILE - 14, 4, 4);
  }
  
  // Края дороги
  G.ctx.fillStyle = '#7a6a4a';
  G.ctx.fillRect(sx + 4, sy + 4, TILE - 8, 2);
  G.ctx.fillRect(sx + 4, sy + TILE - 6, TILE - 8, 2);
}

// ============ renderVillageBuildings() ============
function renderVillageBuildings() {
  const p = G.player;
  G.villages.forEach(village => {
    // Отсечение по камере
    const vcx = village.centerX * TILE + TILE/2;
    const vcy = village.centerY * TILE + TILE/2;
    if (Math.abs(vcx - p.x) > G.W/2 + 300) return;
    if (Math.abs(vcy - p.y) > G.H/2 + 300) return;
    
    village.buildings.forEach(bld => {
      renderBuilding(bld, village);
    });
  });
}

// ============ renderBuilding() ============
function renderBuilding(bld, village) {
  const bwx = bld.x * TILE;
  const bwy = bld.y * TILE;
  const bw = bld.width * TILE;
  const bh = bld.height * TILE;
  
  // Тень здания
  G.ctx.fillStyle = 'rgba(0,0,0,0.3)';
  G.ctx.fillRect(bwx + 4, bwy + 6, bw, bh);
  
  // Тип здания
  if (bld.type === 'square') {
    renderSquare(bwx, bwy, bw, bh, village);
  } else if (bld.type === 'floating') {
    renderFloatingBuilding(bwx, bwy, bw, bh, bld);
  } else if (bld.type === 'glitch_house') {
    renderGlitchBuilding(bwx, bwy, bw, bh, bld);
  } else {
    renderNormalBuilding(bwx, bwy, bw, bh, bld);
  }
  
  // Название над зданием
  G.ctx.fillStyle = '#fff';
  G.ctx.font = '9px Courier New';
  G.ctx.textAlign = 'center';
  G.ctx.fillText(bld.name, bwx + bw/2, bwy - 4);
  
  // Иконка
  if (bld.icon && bld.type !== 'square') {
    G.ctx.font = `${Math.min(bw, bh) * 0.5}px Arial`;
    G.ctx.textAlign = 'center';
    G.ctx.textBaseline = 'middle';
    G.ctx.fillText(bld.icon, bwx + bw/2, bwy + bh/2);
  }
}

// ============ renderNormalBuilding() ============
function renderNormalBuilding(bwx, bwy, bw, bh, bld) {
  // Стены
  G.ctx.fillStyle = bld.color;
  G.ctx.fillRect(bwx, bwy, bw, bh);
  
  // Крыша (треугольная или плоская)
  const roofH = Math.min(bw, bh) * 0.4;
  if (bld.type === 'tower') {
    // Плоская крыша с зубцами
    G.ctx.fillStyle = '#444466';
    G.ctx.fillRect(bwx - 2, bwy - 6, bw + 4, 8);
    // Зубцы
    for (let zx = bwx - 2; zx < bwx + bw; zx += 6) {
      G.ctx.fillRect(zx, bwy - 12, 4, 8);
    }
  } else {
    // Треугольная крыша
    G.ctx.fillStyle = '#6a3020';
    if (bld.type === 'shop') G.ctx.fillStyle = '#2a6a2a';
    G.ctx.beginPath();
    G.ctx.moveTo(bwx - 4, bwy);
    G.ctx.lineTo(bwx + bw/2, bwy - roofH * 1.5);
    G.ctx.lineTo(bwx + bw + 4, bwy);
    G.ctx.closePath();
    G.ctx.fill();
  }
  
  // Окна
  G.ctx.fillStyle = '#ffff88';
  const margin = 6;
  for (let wy = bwy + margin; wy < bwy + bh - margin; wy += bh * 0.4) {
    for (let wx = bwx + margin; wx < bwx + bw - margin; wx += bw * 0.5) {
      G.ctx.fillRect(wx, wy, bw * 0.25, bh * 0.2);
      // Рама
      G.ctx.strokeStyle = '#332200';
      G.ctx.lineWidth = 1;
      G.ctx.strokeRect(wx, wy, bw * 0.25, bh * 0.2);
    }
  }
  
  // Дверь
  G.ctx.fillStyle = '#442200';
  const dx = bwx + bw/2 - bw*0.15;
  G.ctx.fillRect(dx, bwy + bh*0.5, bw*0.3, bh*0.5);
  G.ctx.fillStyle = '#ffaa00';
  G.ctx.beginPath();
  G.ctx.arc(dx + bw*0.25, bwy + bh*0.7, 2, 0, Math.PI*2);
  G.ctx.fill();
}

// ============ renderGlitchBuilding() ============
function renderGlitchBuilding(bwx, bwy, bw, bh, bld) {
  // Глитч-основа — постоянно меняет цвет
  bld.glitchTimer -= G.dt || 0.016;
  if (bld.glitchTimer <= 0) {
    bld.glitchTimer = 0.3 + Math.random() * 0.5;
    bld.color = `hsl(${randi(0,360)}, 100%, 50%)`;
  }
  
  G.ctx.fillStyle = bld.color;
  G.ctx.fillRect(bwx, bwy, bw, bh);
  
  // Сбойные полосы
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.3) {
      G.ctx.fillStyle = `hsl(${randi(0,360)}, 100%, 50%)`;
      G.ctx.fillRect(bwx, bwy + rand(0, bh), bw, rand(2, 8));
    }
  }
  
  // Смещение части здания
  if (Math.random() < 0.15) {
    G.ctx.globalAlpha = 0.4;
    G.ctx.fillStyle = '#00ffff';
    G.ctx.fillRect(bwx + rand(0, bw*0.5), bwy + rand(0, bh*0.5), rand(4, bw*0.3), rand(4, bh*0.3));
    G.ctx.globalAlpha = 1;
  }
  
  // Сломанная крыша
  G.ctx.fillStyle = '#222';
  G.ctx.beginPath();
  G.ctx.moveTo(bwx - 2, bwy);
  G.ctx.lineTo(bwx + bw/2 + rand(-6,6), bwy - bw*0.3);
  G.ctx.lineTo(bwx + bw + 2, bwy);
  G.ctx.closePath();
  G.ctx.fill();
  
  // Окна — мигают
  G.ctx.fillStyle = Math.random() > 0.5 ? '#ff0044' : '#00ff44';
  for (let wy = bwy + 6; wy < bwy + bh - 6; wy += bh * 0.35) {
    for (let wx = bwx + 4; wx < bwx + bw - 4; wx += bw * 0.4) {
      G.ctx.fillRect(wx + rand(-2,2), wy + rand(-2,2), bw*0.2, bh*0.15);
    }
  }
}

// ============ renderSquare() ============
function renderSquare(bwx, bwy, bw, bh, village) {
  // Плитка площади
  G.ctx.fillStyle = '#999977';
  G.ctx.fillRect(bwx, bwy, bw, bh);
  
  // Узор плитки
  G.ctx.strokeStyle = '#777755';
  G.ctx.lineWidth = 1;
  for (let px = bwx; px < bwx + bw; px += TILE) {
    G.ctx.beginPath();
    G.ctx.moveTo(px, bwy);
    G.ctx.lineTo(px, bwy + bh);
    G.ctx.stroke();
  }
  for (let py = bwy; py < bwy + bh; py += TILE) {
    G.ctx.beginPath();
    G.ctx.moveTo(bwx, py);
    G.ctx.lineTo(bwx + bw, py);
    G.ctx.stroke();
  }
  
  // Фонтан/монумент в центре
  const cx = bwx + bw/2;
  const cy = bwy + bh/2;
  
  // Основание
  G.ctx.fillStyle = '#888';
  G.ctx.beginPath();
  G.ctx.arc(cx, cy, 12, 0, Math.PI*2);
  G.ctx.fill();
  
  // Вода в фонтане
  G.ctx.fillStyle = '#4488cc';
  G.ctx.beginPath();
  G.ctx.arc(cx, cy, 8, 0, Math.PI*2);
  G.ctx.fill();
  
  // Анимация воды
  const ripple = Math.sin(G.time * 3) * 2;
  G.ctx.strokeStyle = '#88bbff';
  G.ctx.lineWidth = 1;
  G.ctx.beginPath();
  G.ctx.arc(cx, cy, 6 + ripple, 0, Math.PI*2);
  G.ctx.stroke();
  
  // Название деревни
  G.ctx.fillStyle = '#fff';
  G.ctx.font = 'bold 12px Courier New';
  G.ctx.textAlign = 'center';
  G.ctx.fillText(village.name, cx, bwy - 10);
}

// ============ renderFloatingBuilding() ============
function renderFloatingBuilding(bwx, bwy, bw, bh, bld) {
  // Левитация
  if (bld.floatOffset === undefined) bld.floatOffset = 0;
  bld.floatOffset += (G.dt || 0.016) * 40;
  const floatY = Math.sin(bld.floatOffset) * 10;
  
  // Тень на земле
  G.ctx.fillStyle = 'rgba(0,0,0,0.2)';
  G.ctx.beginPath();
  G.ctx.ellipse(bwx + bw/2, bwy + bh + 4, bw*0.6, 6, 0, 0, Math.PI*2);
  G.ctx.fill();
  
  // Здание сдвинуто вверх
  G.ctx.save();
  const fbx = bwx, fby = bwy - 20 + floatY;
  
  // Стены
  G.ctx.fillStyle = bld.color;
  G.ctx.fillRect(fbx, fby, bw, bh);
  
  // Свечение снизу
  G.ctx.fillStyle = 'rgba(170,68,255,0.3)';
  G.ctx.fillRect(fbx, fby + bh - 6, bw, 8);
  
  // Частицы под зданием
  for (let i = 0; i < 5; i++) {
    G.ctx.fillStyle = `rgba(170,68,255,${0.2 + Math.sin(G.time*5+i)*0.1})`;
    G.ctx.beginPath();
    G.ctx.arc(fbx + rand(0, bw), fby + bh + rand(2, 8), rand(1, 3), 0, Math.PI*2);
    G.ctx.fill();
  }
  
  // Окна
  G.ctx.fillStyle = '#ff44ff';
  for (let wy = fby + 6; wy < fby + bh - 6; wy += bh * 0.4) {
    for (let wx = fbx + 4; wx < fbx + bw - 4; wx += bw * 0.5) {
      G.ctx.fillRect(wx, wy, bw * 0.2, bh * 0.15);
    }
  }
  
  G.ctx.restore();
}

// ============ renderPlayer() ============
function renderPlayer() {
  const p = G.player;
  G.ctx.save();
  G.ctx.translate(p.x, p.y);
  
  // Тень
  G.ctx.fillStyle = 'rgba(0,0,0,0.4)';
  G.ctx.beginPath();
  G.ctx.ellipse(0, p.r+2, p.r, 4, 0, 0, Math.PI*2);
  G.ctx.fill();
  
  // Тело
  const flash = p.hitFlash > 0;
  G.ctx.fillStyle = flash ? '#ffffff' : '#4488ff';
  G.ctx.beginPath();
  G.ctx.arc(0, 0, p.r, 0, Math.PI*2);
  G.ctx.fill();
  
  // Свечение
  G.ctx.strokeStyle = '#88aaff';
  G.ctx.lineWidth = 2;
  G.ctx.stroke();
  
  // Инвулн мигание
  if (p.invuln > 0 && Math.floor(G.time*20) % 2) {
    G.ctx.globalAlpha = 0.5;
  }
  
  // Направление (взгляд)
  G.ctx.rotate(p.facing);
  G.ctx.fillStyle = '#fff';
  G.ctx.beginPath();
  G.ctx.arc(6, -4, 4, 0, Math.PI*2);
  G.ctx.arc(6, 4, 4, 0, Math.PI*2);
  G.ctx.fill();
  G.ctx.fillStyle = '#000';
  G.ctx.beginPath();
  G.ctx.arc(8, -4, 2, 0, Math.PI*2);
  G.ctx.arc(8, 4, 2, 0, Math.PI*2);
  G.ctx.fill();
  
  G.ctx.restore();
}

// ============ renderEnemy() ============
function renderEnemy(e) {
  G.ctx.save();
  G.ctx.translate(e.x, e.y);
  
  // Тень
  G.ctx.fillStyle = 'rgba(0,0,0,0.4)';
  G.ctx.beginPath();
  G.ctx.ellipse(0, e.r+2, e.r, 4, 0, 0, Math.PI*2);
  G.ctx.fill();
  
  // Спрайт или круг
  if (e.sprite) {
    const img = new Image();
    img.src = e.sprite;
    if (img.complete && img.naturalWidth) {
      const size = e.r*2;
      G.ctx.drawImage(img, -size/2, -size/2, size, size);
    } else {
      drawEnemyBody(e);
    }
  } else {
    drawEnemyBody(e);
  }
  
  // ХП бар
  const pct = e.hp / e.maxHp;
  const bw = e.r*2;
  G.ctx.fillStyle = '#000';
  G.ctx.fillRect(-bw/2, -e.r-10, bw, 4);
  G.ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff4444';
  G.ctx.fillRect(-bw/2, -e.r-10, bw*pct, 4);
  
  // Имя и уровень
  G.ctx.fillStyle = '#fff';
  G.ctx.font = '10px Courier New';
  G.ctx.textAlign = 'center';
  G.ctx.fillText(`${e.name} ур.${e.lvl}`, 0, -e.r-14);
  
  G.ctx.restore();
}

// ============ drawEnemyBody() ============
function drawEnemyBody(e) {
  const flash = e.hitFlash > 0;
  G.ctx.fillStyle = flash ? '#ffffff' : e.color;
  if (e.type === 'boss') {
    // Босс - большой и страшный
    G.ctx.beginPath();
    G.ctx.arc(0, 0, e.r, 0, Math.PI*2);
    G.ctx.fill();
    G.ctx.strokeStyle = '#ff00ff';
    G.ctx.lineWidth = 4;
    G.ctx.stroke();
    // Рога
    G.ctx.fillStyle = '#aa00aa';
    G.ctx.beginPath();
    G.ctx.moveTo(-e.r*0.6, -e.r*0.8);
    G.ctx.lineTo(-e.r*0.4, -e.r*1.3);
    G.ctx.lineTo(-e.r*0.2, -e.r*0.8);
    G.ctx.moveTo(e.r*0.6, -e.r*0.8);
    G.ctx.lineTo(e.r*0.4, -e.r*1.3);
    G.ctx.lineTo(e.r*0.2, -e.r*0.8);
    G.ctx.fill();
    // Глаза
    G.ctx.fillStyle = '#ff0000';
    G.ctx.beginPath();
    G.ctx.arc(-e.r*0.3, -e.r*0.2, 6, 0, Math.PI*2);
    G.ctx.arc(e.r*0.3, -e.r*0.2, 6, 0, Math.PI*2);
    G.ctx.fill();
  } else {
    G.ctx.beginPath();
    G.ctx.arc(0, 0, e.r, 0, Math.PI*2);
    G.ctx.fill();
    G.ctx.strokeStyle = '#000';
    G.ctx.lineWidth = 2;
    G.ctx.stroke();
    // Глаза
    G.ctx.fillStyle = '#fff';
    G.ctx.beginPath();
    G.ctx.arc(-5, -3, 3, 0, Math.PI*2);
    G.ctx.arc(5, -3, 3, 0, Math.PI*2);
    G.ctx.fill();
    G.ctx.fillStyle = '#000';
    G.ctx.beginPath();
    G.ctx.arc(-4, -3, 1.5, 0, Math.PI*2);
    G.ctx.arc(6, -3, 1.5, 0, Math.PI*2);
    G.ctx.fill();
  }
}

// ============ renderItem() ============
function renderItem(item) {
  const bob = Math.sin(item.bobPhase) * 4;
  G.ctx.save();
  G.ctx.translate(item.x, item.y + bob);
  
  // Свечение
  const grd = G.ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  grd.addColorStop(0, item.color + 'aa');
  grd.addColorStop(1, item.color + '00');
  G.ctx.fillStyle = grd;
  G.ctx.fillRect(-30, -30, 60, 60);
  
  // Иконка
  G.ctx.font = '24px Arial';
  G.ctx.textAlign = 'center';
  G.ctx.textBaseline = 'middle';
  G.ctx.fillText(item.icon, 0, 0);
  
  G.ctx.restore();
}

// ============ renderNPC() ============
function renderNPC(npc) {
  const bob = Math.sin(npc.bobPhase) * 3;
  G.ctx.save();
  G.ctx.translate(npc.x, npc.y + bob);
  
  // Тень
  G.ctx.fillStyle = 'rgba(0,0,0,0.4)';
  G.ctx.beginPath();
  G.ctx.ellipse(0, 22, 16, 4, 0, 0, Math.PI*2);
  G.ctx.fill();
  
  // Тело
  G.ctx.fillStyle = '#ffaa44';
  G.ctx.beginPath();
  G.ctx.arc(0, 0, 18, 0, Math.PI*2);
  G.ctx.fill();
  G.ctx.strokeStyle = '#ffdd88';
  G.ctx.lineWidth = 2;
  G.ctx.stroke();
  
  // Лицо
  G.ctx.fillStyle = '#fff';
  G.ctx.beginPath();
  G.ctx.arc(-5, -3, 3, 0, Math.PI*2);
  G.ctx.arc(5, -3, 3, 0, Math.PI*2);
  G.ctx.fill();
  G.ctx.fillStyle = '#000';
  G.ctx.beginPath();
  G.ctx.arc(-5, -3, 1.5, 0, Math.PI*2);
  G.ctx.arc(5, -3, 1.5, 0, Math.PI*2);
  G.ctx.fill();
  
  // Восклицательный знак если есть квест
  if (npc.quest) {
    G.ctx.fillStyle = '#ffaa00';
    G.ctx.font = 'bold 24px Arial';
    G.ctx.textAlign = 'center';
    G.ctx.fillText('!', 0, -30);
  }
  
  // Имя
  G.ctx.fillStyle = '#ffdd88';
  G.ctx.font = '11px Courier New';
  G.ctx.textAlign = 'center';
  G.ctx.fillText(npc.name, 0, -22);
  
  G.ctx.restore();
}

// ============ renderPet() ============
function renderPet() {
  const pet = G.pet;
  const bob = Math.sin(pet.bobPhase) * 3;
  G.ctx.save();
  G.ctx.translate(pet.x, pet.y + bob);
  G.ctx.font = '28px Arial';
  G.ctx.textAlign = 'center';
  G.ctx.textBaseline = 'middle';
  G.ctx.fillText(pet.type, 0, 0);
  G.ctx.restore();
}

// ============ renderProjectile() ============
function renderProjectile(pr) {
  G.ctx.save();
  G.ctx.translate(pr.x, pr.y);
  
  const grd = G.ctx.createRadialGradient(0, 0, 0, 0, 0, pr.r*2);
  grd.addColorStop(0, pr.color);
  grd.addColorStop(1, pr.color + '00');
  G.ctx.fillStyle = grd;
  G.ctx.fillRect(-pr.r*2, -pr.r*2, pr.r*4, pr.r*4);
  
  G.ctx.fillStyle = pr.color;
  G.ctx.beginPath();
  G.ctx.arc(0, 0, pr.r, 0, Math.PI*2);
  G.ctx.fill();
  
  G.ctx.restore();
}

// ============ renderParticle() ============
function renderParticle(pa) {
  const alpha = pa.life / pa.maxLife;
  G.ctx.globalAlpha = alpha;
  G.ctx.fillStyle = pa.color;
  if (pa.lightning) {
    G.ctx.fillRect(pa.x-pa.size/2, pa.y-pa.size/2, pa.size, pa.size);
  } else {
    G.ctx.beginPath();
    G.ctx.arc(pa.x, pa.y, pa.size * alpha, 0, Math.PI*2);
    G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;
}

// ============ renderMemeWeather() ============
function renderMemeWeather() {
  const emojis = ['🗿','💀','🤡','👽','🌈','✨','🔥','💯','🤯','🥴'];
  for (let i=0; i<20; i++) {
    const x = (G.time*100 + i*137) % G.W;
    const y = (G.time*150 + i*97) % G.H;
    G.fxCtx.font = '24px Arial';
    G.fxCtx.globalAlpha = 0.6;
    G.fxCtx.fillText(choice(emojis), x, y);
  }
  G.fxCtx.globalAlpha = 1;
}

// ============ renderGlitch() ============
function renderGlitch() {
  for (let i=0; i<5*G.glitch; i++) {
    G.fxCtx.fillStyle = `hsla(${randi(0,360)}, 100%, 50%, 0.3)`;
    const y = randi(0, G.H);
    const h = randi(2, 20);
    G.fxCtx.fillRect(0, y, G.W, h);
  }
}

// ============ renderMinimap() ============
function renderMinimap() {
  const mm = G.mmCanvas;
  const mc = G.mmCtx;
  mc.fillStyle = '#000';
  mc.fillRect(0, 0, mm.width, mm.height);
  
  const scale = 1.5;
  const cx = mm.width/2;
  const cy = mm.height/2;
  
  // Тайлы вокруг игрока
  for (let dy=-30; dy<=30; dy+=2) {
    for (let dx=-30; dx<=30; dx+=2) {
      const wx = Math.floor(G.player.x/TILE) + dx;
      const wy = Math.floor(G.player.y/TILE) + dy;
      if (isBridgeTile(wx, wy)) {
          mc.fillStyle = '#8B6914';
          mc.fillRect(cx + dx*scale, cy + dy*scale, scale*2, scale*2);
        } else if (isVillageBuilding(wx, wy)) {
          mc.fillStyle = '#aa6633';
          mc.fillRect(cx + dx*scale, cy + dy*scale, scale*2, scale*2);
        } else if (isVillageRoad(wx, wy)) {
          mc.fillStyle = '#b8a880';
          mc.fillRect(cx + dx*scale, cy + dy*scale, scale*2, scale*2);
        } else if (isWaterTile(wx, wy)) {
         mc.fillStyle = '#1a4488';
         mc.fillRect(cx + dx*scale, cy + dy*scale, scale*2, scale*2);
       } else {
         const b = getBiome(wx, wy);
        mc.fillStyle = BIOME_COLORS[b];
        mc.fillRect(cx + dx*scale, cy + dy*scale, scale*2, scale*2);
      }
    }
  }
  
  // Враги
  G.entities.forEach(e => {
    if (e.type === 'enemy' || e.type === 'boss') {
      const dx = (e.x - G.player.x)/TILE;
      const dy = (e.y - G.player.y)/TILE;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        mc.fillStyle = e.type === 'boss' ? '#ff00ff' : '#ff4444';
        mc.fillRect(cx + dx*scale - 1, cy + dy*scale - 1, 3, 3);
      }
    }
    if (e.type === 'npc') {
      const dx = (e.x - G.player.x)/TILE;
      const dy = (e.y - G.player.y)/TILE;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        mc.fillStyle = '#ffaa00';
        mc.fillRect(cx + dx*scale - 1, cy + dy*scale - 1, 3, 3);
      }
    }
  });
  
  // Игрок
  mc.fillStyle = '#44ffff';
  mc.beginPath();
  mc.arc(cx, cy, 3, 0, Math.PI*2);
  mc.fill();
}

// ============ updateAbilityUI() ============
function updateAbilityUI() {
  document.querySelectorAll('.ability').forEach((el, i) => {
    const cd = G.cooldowns[i];
    const existing = el.querySelector('.cd');
    if (cd > 0) {
      el.classList.add('cooldown');
      if (!existing) {
        const d = document.createElement('div');
        d.className = 'cd';
        d.textContent = cd.toFixed(1);
        el.appendChild(d);
      } else {
        existing.textContent = cd.toFixed(1);
      }
    } else {
      el.classList.remove('cooldown');
      if (existing) existing.remove();
    }
  });
}
