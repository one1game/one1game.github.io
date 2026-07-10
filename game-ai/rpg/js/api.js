// ============ loadAPIs ============
async function loadAPIs() {
  const status = document.getElementById('loadStatus');
  const fetches = [
    ['pokemon', 'https://pokeapi.co/api/v2/pokemon?limit=151', d => d.results.map(p => ({name:p.name, url:p.url}))],
    ['chars', 'https://rickandmortyapi.com/api/character', d => d.results],
    ['dogs', 'https://dog.ceo/api/breeds/image/random/30', d => d.message],
    ['cats', 'https://api.thecatapi.com/v1/images/search?limit=30', d => d.map(x=>x.url)],
    ['facts', 'https://uselessfacts.jsph.pl/api/v2/facts/today?language=en', d => [d.text]],
    ['jokes', 'https://official-joke-api.appspot.com/jokes/ten', d => d],
    ['quotes', 'https://api.quotable.io/quotes/random?minLength=50&maxLength=200', d => d],
    ['spells', 'https://www.dnd5eapi.co/api/2e/magic-items?limit=50', d => d.results],
    ['trivia', 'https://opentdb.com/api.php?amount=20', d => d.results]
  ];
  
  for (const [key, url, parse] of fetches) {
    try {
      status.textContent = `Загрузка ${key}...`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        G.apiData[key] = parse(data);
      }
    } catch(e) { console.warn('API fail:', key, e); }
  }
  
  // Доп данные
  try {
    const fr = await fetch('https://cat-fact.herokuapp.com/facts?limit=10');
    if (fr.ok) { const d = await fr.json(); G.apiData.catfacts = d.all || d; }
  } catch(e){}
  
  try {
    const ar = await fetch('https://api.adviceslip.com/advice');
    if (ar.ok) { const d = await ar.json(); G.apiData.advice = [d.slip.advice]; }
  } catch(e){}
}

// ============ setupInput ============
function setupInput() {
  window.addEventListener('keydown', e => {
    G.keys[e.key.toLowerCase()] = true;
    if (e.key >= '1' && e.key <= '5') useAbility(parseInt(e.key));
    if (e.key.toLowerCase() === 'e') toggleInventory();
    if (e.key.toLowerCase() === 'q') useDash();
    if (e.key.toLowerCase() === 'f') interact();
  });
  window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
  
  G.canvas.addEventListener('mousemove', e => {
    const r = G.canvas.getBoundingClientRect();
    G.mouse.x = e.clientX - r.left;
    G.mouse.y = e.clientY - r.top;
  });
  G.canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { G.mouse.down = true; playerAttack(); }
  });
  G.canvas.addEventListener('mouseup', e => { if (e.button === 0) G.mouse.down = false; });
  G.canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ============ updateRandomEvents ============
function updateRandomEvents(dt) {
  G.eventTimer -= dt;
  if (G.eventTimer <= 0) {
    G.eventTimer = rand(15, 40);
    triggerRandomEvent();
  }
}

// ============ triggerRandomEvent ============
function triggerRandomEvent() {
  const events = [
    () => { log('🌧️ Начался дождь из мемов!', 'meme'); G.weather = 'meme'; setTimeout(()=>G.weather='clear', 20000); },
    () => { log('⚡ Глобальная буря! Все враги получили +50% урона на 30с', 'crazy'); 
      G.entities.forEach(e => { if (e.type==='enemy') e.atk *= 1.5; });
      setTimeout(()=>G.entities.forEach(e => { if (e.type==='enemy') e.atk /= 1.5; }), 30000); },
    () => { log('💰 Золотой дождь! +100 золота', 'loot'); G.player.gold += 100; },
    () => { log('✨ Благословение! +50 HP, +30 MP', 'epic'); 
      G.player.hp = Math.min(G.player.maxHp, G.player.hp + 50);
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + 30); },
    () => { log('🌀 Реальность исказилась...', 'crazy'); G.glitch = 5; },
    () => { log('🎁 Неожиданный подарок!', 'loot'); 
      const item = createItem(G.player.x + rand(-100,100), G.player.y + rand(-100,100));
      G.entities.push(item); },
    () => { log('👻 Призраки атакуют!', 'combat');
      for (let i=0; i<5; i++) {
        const a = rand(0, Math.PI*2);
        G.entities.push({
          type:'enemy', x:G.player.x+Math.cos(a)*300, y:G.player.y+Math.sin(a)*300,
          vx:0, vy:0, r:16, hp:40, maxHp:40, atk:15, def:0,
          lvl:G.player.lvl, name:'Призрак', ai:'chase', color:'#aaaaaa',
          state:'chase', hitFlash:0, dead:false, xp:30, gold:15
        });
      } },
    () => { log('🧠 Рассудок подорван! -10 рассудка', 'crazy'); G.sanity = Math.max(0, G.sanity-10); },
    () => { if (G.apiData.jokes.length) { const j = choice(G.apiData.jokes); log(`😂 ${j.setup} - ${j.punchline}`, 'meme'); } },
    () => { if (G.apiData.quotes.length) { const q = choice(G.apiData.quotes); log(`💭 "${q}" - ${q.author||'Мудрец'}`, 'info'); } },
    () => { log('🔥 Время замедлено!', 'epic'); G.slowmo = 0.5; G.slowmoTimer = 8; },
    () => { log('💢 Бешенство! +50% урона на 15с', 'epic');
      const orig = G.player.str; G.player.str = Math.floor(orig*1.5);
      setTimeout(()=>G.player.str = orig, 15000); }
  ];
  choice(events)();
}

// ============ triggerMemeEvent ============
function triggerMemeEvent() {
  const memes = [
    () => { log('🗿 СТОУНМАССОВ!', 'meme'); G.entities.forEach(e => { if (e.type==='enemy') { e.vx=0; e.vy=0; e.stunned=3; } }); },
    () => { log('🌈 Радужная лихорадка!', 'meme'); G.glitch = 10; },
    () => { log('🎺 ВЗРЫВbrains!', 'meme'); 
      G.entities.forEach(e => { if (e.type==='enemy') damageEnemy(e, 50); }); },
    () => { log('💃 Дискотека!', 'meme'); G.screenFlash = 2; }
  ];
  choice(memes)();
}

// ============ updateSanity ============
function updateSanity(dt) {
  // Рассудок падает от далёких чанков и глитч-биомов
  const d = Math.hypot(G.player.x, G.player.y) / TILE;
  if (d > 50) G.sanity = Math.max(0, G.sanity - dt * 0.5);
  
  // Глитч-биом снижает рассудок
  const px = Math.floor(G.player.x/TILE), py = Math.floor(G.player.y/TILE);
  const b = getBiome(px, py);
  if (b === BIOMES.GLITCH) G.sanity = Math.max(0, G.sanity - dt * 2);
  if (b === BIOMES.MEMLAND) G.sanity = Math.min(100, G.sanity + dt * 0.5);
  
  // Эффекты низкого рассудка
  if (G.sanity < 30) G.glitch = Math.max(G.glitch, 1);
  if (G.sanity < 10) G.glitch = Math.max(G.glitch, 3);
  
  if (G.glitch > 0) G.glitch = Math.max(0, G.glitch - dt*0.3);
  
  if (G.activeQuest && G.activeQuest.type === 'sanity') {
    G.activeQuest.prog = G.sanity;
    if (G.sanity <= G.activeQuest.target) completeQuest();
  }
}

// ============ updateCombo ============
function updateCombo(dt) {
  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) G.combo = 0;
  }
}
