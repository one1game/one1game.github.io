/* Кузница шанса — симулятор шансового крафта Lineage 2 Interlude. */
(() => {
  'use strict';

  const DATA = window.L2CRAFT;
  if (!DATA) return;

  const recipes = DATA.recipes;
  const byId = new Map(recipes.map(r => [r.id, r]));
  const detailEl = document.getElementById('detail');
  const listEl = document.getElementById('recipeList');
  const countEl = document.getElementById('catalogCount');
  const searchEl = document.getElementById('searchInput');
  const sortEl = document.getElementById('sortSelect');

  const STORE_KEY = 'l2craft.stats.v1';
  const GRADE_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1, NG: 0 };
  const TYPE_LABEL = { weapon: 'Оружие', armor: 'Броня', jewelry: 'Бижутерия', etcitem: 'Прочее' };
  const chanceCounts = recipes.reduce((m, r) => (m[r.chance] = (m[r.chance] || 0) + 1, m), {});
  const chanceValues = Object.keys(chanceCounts).map(Number).sort((a, b) => chanceCounts[b] - chanceCounts[a]);

  const nf = new Intl.NumberFormat('ru-RU');
  const df = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

  const state = {
    selectedId: null,
    query: '',
    grade: 'all',
    type: 'all',
    chance: 'all',
    sort: 'grade',
    tab: 'craft',
    busy: false,
    probN: 10,
    stats: loadStats(),
    logs: new Map()
  };

  document.getElementById('topRecipes').textContent = DATA.meta.count;

  /* ---------- утилиты ---------- */

  function esc(s = '') {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmt(n) {
    return nf.format(Math.round(n));
  }

  function fmtDec(n) {
    return df.format(n);
  }

  function fmtProb(x, allow100 = false) {
    if (allow100 && x >= 0.99995) return '100%';
    if (x >= 0.99995) return '99,99%';
    if (x < 0.00005) return '<0,01%';
    return (x * 100).toFixed(2).replace('.', ',') + '%';
  }

  function pOf(r) {
    return r.chance / 100;
  }

  // Криптографически равномерный бросок: 0 <= x < 1.
  function randomUnit() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  function roll(p) {
    return randomUnit() < p;
  }

  function expectedAttempts(r) {
    return 1 / pOf(r);
  }

  function medianAttempts(r) {
    const p = pOf(r);
    return Math.ceil(Math.log(0.5) / Math.log(1 - p));
  }

  function attemptsFor95(r) {
    const p = pOf(r);
    return Math.ceil(Math.log(0.05) / Math.log(1 - p));
  }

  function typeLabel(type) {
    return TYPE_LABEL[type] || 'Прочее';
  }

  function iconHtml(icon, name, cls = '') {
    return `<span class="item-icon ${cls}"><img src="${esc(icon)}" alt="" width="32" height="32" loading="lazy"></span>`;
  }

  function materialSum(r) {
    return r.direct.reduce((sum, d) => sum + d.count, 0);
  }

  function isQuestRecipe(r) {
    return !r.direct.some(d => d.name.startsWith('Recipe:'));
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.stats));
    } catch {
      /* приватный режим — просто живём без сохранения */
    }
  }

  function statsFor(id) {
    if (!state.stats[id]) {
      state.stats[id] = { a: 0, s: 0, f: 0, mp: 0, items: 0, m: 0 };
    }
    const s = state.stats[id];
    for (const key of ['a', 's', 'f', 'mp', 'items', 'm']) {
      if (typeof s[key] !== 'number') s[key] = 0;
    }
    return s;
  }

  /* ---------- виджет статей ---------- */

  function renderArticles() {
    const host = document.getElementById('articleWidget');
    if (!host) return;
    const list = window.L2CRAFT_ARTICLES || [];
    if (!list.length) {
      host.innerHTML = '<div class="widget-empty">Материалы скоро появятся.</div>';
      return;
    }
    host.innerHTML = list.map(a => `
      <a class="article-item" href="${esc(a.url)}">
        <span class="article-thumb">
          <img src="${esc(a.image)}" alt="" loading="lazy" onerror="this.style.display='none'">
        </span>
        <span class="article-body">
          <strong>${esc(a.title)}</strong>
          <small>${esc(a.category)} · ${esc(a.readTime)}</small>
        </span>
      </a>
    `).join('');
  }

  /* ---------- заточка D–S ---------- */

  const ENCHANT_DATA = window.L2CRAFT_ENCHANT || { items: [], rates: null };
  const enchantItems = ENCHANT_DATA.items || [];
  const eRates = ENCHANT_DATA.rates;
  const enchantById = new Map(enchantItems.map(x => [x.id, x]));
  const E_GRADE_ORDER = ['D', 'C', 'B', 'A', 'S'];
  const eState = {
    selectedId: null,
    query: '',
    grade: 'all',
    type: 'all',
    level: 0,
    blessed: false,
    destroyed: false,
    busy: false,
    outcome: null,
    tableOpen: false,
    mobileView: 'list',
    stats: new Map(),
    logs: new Map()
  };
  let enchantOpener = null;

  function eStats(id) {
    if (!eState.stats.has(id)) {
      eState.stats.set(id, { a: 0, s: 0, f: 0, d: 0, r: 0, best: 0, scrolls: 0 });
    }
    return eState.stats.get(id);
  }

  function eAddLog(item, ok, label, detail) {
    if (!eState.logs.has(item.id)) eState.logs.set(item.id, []);
    const list = eState.logs.get(item.id);
    list.unshift({
      ok,
      label,
      detail,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    if (list.length > 40) list.length = 40;
  }

  function eChance(item, target, blessed) {
    const safe = item.fullArmor ? eRates.safeFull : eRates.safe;
    if (target <= safe) return 100;
    if (target > eRates.max) return 0;
    let key = item.type;
    if (item.type === 'weapon') key = item.magic ? 'weaponMagic' : 'weapon';
    else if (item.type === 'armor' && item.fullArmor) key = 'fullArmor';
    const table = (blessed ? eRates.blessed : eRates.normal)[key] || eRates.normal.armor;
    return table[target] || 0;
  }

  function eCumulative(item, level, blessed) {
    let chance = 1;
    for (let target = 1; target <= level; target++) {
      chance *= eChance(item, target, blessed) / 100;
    }
    return chance;
  }

  function eExpectedScrolls(item, level, blessed) {
    let sum = 0;
    for (let target = 1; target <= level; target++) {
      const p = eChance(item, target, blessed) / 100;
      if (!p) return Infinity;
      sum += 1 / p;
    }
    return sum;
  }

  function eScrollName(item, blessed) {
    const base = item.type === 'weapon' ? 'Scroll: Enchant Weapon' : 'Scroll: Enchant Armor';
    return `${blessed ? 'Blessed ' : ''}${base} (Grade ${item.grade})`;
  }

  function eGlowClass(level) {
    if (level >= 16) return 'glow-max';
    if (level >= 13) return 'glow-gold';
    if (level >= 10) return 'glow-red';
    if (level >= 7) return 'glow-purple';
    if (level >= 4) return 'glow-blue';
    return '';
  }

  function eFiltered() {
    const q = eState.query.trim().toLowerCase();
    return enchantItems.filter(item => {
      if (eState.grade !== 'all' && item.grade !== eState.grade) return false;
      if (eState.type !== 'all' && item.type !== eState.type) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function eSyncMobileView() {
    const shell = document.querySelector('.enchant-shell');
    if (!shell) return;
    const mobile = window.innerWidth <= 900;
    shell.classList.toggle('is-mobile-list', mobile && eState.mobileView !== 'detail');
    shell.classList.toggle('is-mobile-detail', mobile && eState.mobileView === 'detail');
  }

  function eRenderChips() {
    const grades = E_GRADE_ORDER.filter(g => enchantItems.some(x => x.grade === g));
    document.getElementById('enchantGradeChips').innerHTML =
      chip('all', 'Все', eState.grade === 'all') +
      grades.map(g => chip(g, g, eState.grade === g)).join('');

    const types = ['weapon', 'armor', 'jewelry'].filter(t => enchantItems.some(x => x.type === t));
    document.getElementById('enchantTypeChips').innerHTML =
      chip('all', 'Все', eState.type === 'all') +
      types.map(t => chip(t, typeLabel(t), eState.type === t)).join('');
  }

  function eRenderCatalog() {
    const list = eFiltered();
    const count = document.getElementById('enchantCount');
    if (count) count.textContent = list.length;
    const host = document.getElementById('enchantList');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<div class="empty-state">Ничего не найдено. Сбросьте фильтры.</div>';
      return;
    }
    host.innerHTML = list.map(item => `
      <button type="button" class="recipe-row${item.id === eState.selectedId ? ' is-active' : ''}"
              data-eid="${item.id}" role="option" aria-selected="${item.id === eState.selectedId}">
        ${iconHtml(item.icon, item.name)}
        <span class="recipe-row-main">
          <strong>${esc(item.name)}</strong>
          <small><span class="grade grade-${esc(item.grade)}">${esc(item.grade)}</span>
          <span>${esc(typeLabel(item.type))}</span></small>
        </span>
        ${item.id === eState.selectedId ? `<span class="chance-pill">${eState.destroyed ? '×' : '+' + eState.level}</span>` : ''}
      </button>
    `).join('');
  }

  function eSelect(id) {
    if (eState.busy || !enchantById.has(id)) return;
    eState.selectedId = id;
    eState.level = 0;
    eState.destroyed = false;
    eState.outcome = null;
    if (window.innerWidth <= 900) eState.mobileView = 'detail';
    eRenderCatalog();
    eRenderDetail();
    eSyncMobileView();
    const active = document.getElementById('enchantList')?.querySelector('.recipe-row.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function eRenderDetail() {
    const host = document.getElementById('enchantDetail');
    if (!host) return;
    const item = enchantById.get(eState.selectedId) || enchantItems[0];
    if (!item) {
      host.innerHTML = '<div class="widget-empty">Нет данных для заточки.</div>';
      return;
    }
    eState.selectedId = item.id;

    const scrollTop = host.scrollTop;
    const level = eState.level;
    const maxed = level >= eRates.max;
    const destroyed = eState.destroyed;
    const safe = item.fullArmor ? eRates.safeFull : eRates.safe;
    const next = Math.min(level + 1, eRates.max);
    const chance = destroyed || maxed ? 0 : eChance(item, next, eState.blessed);
    const cumulative = eCumulative(item, level, eState.blessed);
    const expected = eExpectedScrolls(item, level, eState.blessed);
    const stats = eStats(item.id);
    const scrollName = eScrollName(item, eState.blessed);
    const glow = eGlowClass(level);
    const typeNote = item.type === 'weapon'
      ? (item.magic ? ' Магическое оружие: 40% до +15, 20% на +16.' : ' Физическое оружие: 70% до +15, 35% на +16.')
      : item.type === 'jewelry'
        ? ' Бижутерия использует таблицу брони: 66.67%.'
        : '';
    const itemClass = item.type === 'weapon'
      ? (item.magic ? 'Магическое оружие' : 'Физическое оружие')
      : item.type === 'armor'
        ? (item.fullArmor ? 'Полный доспех' : 'Часть доспеха')
        : 'Бижутерия';
    const autoHtml = [4, 7, 10, 16].map(target => `
      <button type="button" data-eauto="${target}" ${eState.busy || destroyed || maxed || target <= level ? 'disabled' : ''}>+${target}</button>
    `).join('');

    const failure = destroyed
      ? 'Предмет разрушен. Возьмите новый предмет.'
      : maxed
        ? `Достигнут максимум +${eRates.max}.`
        : next <= safe
          ? 'Безопасная заточка: провал невозможен.'
          : eState.blessed
            ? 'Провал: предмет уцелеет, заточка сбросится на +0.'
            : 'Провал: предмет будет разрушен.';
    const failureClass = destroyed || (!maxed && next > safe && !eState.blessed)
      ? ' is-danger'
      : (!maxed && next <= safe ? ' is-safe' : '');

    const outcomeHtml = eState.busy
      ? '<div class="enchant-outcome"><strong>Заточка…</strong><span>Свиток применяется.</span></div>'
      : eState.outcome
        ? `<div class="enchant-outcome ${esc(eState.outcome.type)}"><strong>${esc(eState.outcome.title)}</strong><span>${esc(eState.outcome.text)}</span></div>`
        : '<div class="enchant-outcome"><strong>Готово</strong><span>Выберите свиток и нажмите «Заточить».</span></div>';

    let rowCumulative = 1;
    const rows = [];
    for (let target = 1; target <= eRates.max; target++) {
      const p = eChance(item, target, eState.blessed);
      rowCumulative *= p / 100;
      const isCurrent = target === level + 1 && !destroyed && !maxed;
      const isSafe = target <= safe;
      const failText = isSafe ? 'безопасно' : eState.blessed ? 'сброс на +0' : 'разрушение';
      rows.push(`
        <tr class="${isCurrent ? 'is-current ' : ''}${isSafe ? 'is-safe' : ''}">
          <td>+${target}</td>
          <td>${p}%</td>
          <td>${fmtProb(rowCumulative, true)}</td>
          <td class="dim">${failText}</td>
        </tr>
      `);
    }

    const logEntries = eState.logs.get(item.id) || [];
    const logHtml = logEntries.length
      ? logEntries.map(entry => `
          <div class="log-entry ${entry.ok ? 'ok' : 'bad'}">
            <time>${esc(entry.time)}</time>
            <span class="res">${esc(entry.label)}</span>
            <span class="detail">${esc(entry.detail)}</span>
          </div>
        `).join('')
      : '<div class="log-empty">Пока ни одной попытки.</div>';

    host.innerHTML = `
      <article class="enchant-sheet">
        <button type="button" class="enchant-back" id="enchantBack">← К списку предметов</button>
        <header class="enchant-item-head">
          <div class="enchant-icon ${destroyed ? 'is-destroyed ' : ''}${glow}">
            <img src="${esc(item.icon)}" alt="${esc(item.name)}" width="80" height="80">
          </div>
          <div>
            <div class="result-kicker">
              <span class="grade grade-${esc(item.grade)}">${esc(item.grade)}</span>
              <span>${esc(typeLabel(item.type))}</span>
              <span>ID ${item.id}</span>
            </div>
            <h3>${esc(item.name)} <span class="enchant-level">${destroyed ? 'разрушен' : '+' + level}</span></h3>
            <div class="recipe-name">${esc(scrollName)}</div>
            <div class="meta-chips">
              <span class="meta-chip">Максимум <b>+${eRates.max}</b></span>
              <span class="meta-chip">Безопасно <b>+${safe}</b></span>
              <span class="meta-chip">${itemClass}</span>
            </div>
          </div>
        </header>

        <div class="enchant-grid">
          <section class="enchant-card">
            <div class="section-head">
              <h4>Следующая попытка</h4>
              <span>${destroyed ? 'предмет разрушен' : maxed ? 'максимум' : `+${level} → +${next}`}</span>
            </div>
            <div class="enchant-big-chance">${destroyed || maxed ? '—' : chance + '%'}</div>
            <div class="enchant-failure${failureClass}">${esc(failure)}</div>
            <div class="enchant-actions">
              <button type="button" class="craft-btn" id="enchantBtn" ${eState.busy || destroyed || maxed ? 'disabled' : ''}>
                ${destroyed ? 'Разрушен' : maxed ? `Максимум +${eRates.max}` : 'Заточить'}
              </button>
              <button type="button" class="batch-btn" id="enchantReset" ${eState.busy ? 'disabled' : ''}>Новый предмет</button>
            </div>
            <div class="enchant-auto">
              <span>Авто до</span>
              ${autoHtml}
            </div>
          </section>

          <section class="enchant-card">
            <div class="section-head"><h4>Свиток</h4><span>шанс и провал</span></div>
            <div class="scroll-toggle">
              <button type="button" data-escroll="normal" class="${!eState.blessed ? 'is-active' : ''}">Обычный<small>провал: разрушение</small></button>
              <button type="button" data-escroll="blessed" class="${eState.blessed ? 'is-active' : ''}">Благословенный<small>провал: сброс на +0</small></button>
            </div>
            <div class="enchant-note">${esc(scrollName)}. L2OFF Interlude retail: 70% физ. оружие, 40% маг. оружие, 66.67% броня и бижутерия.${typeNote} На приватных серверах шансы могут отличаться.</div>
            <div class="formula">
              <div>Дойти с +0 до +${level}: <b>${fmtProb(cumulative, true)}</b></div>
              <div>Ожидаемо свитков: <b>${Number.isFinite(expected) ? fmtDec(expected) : '—'}</b></div>
            </div>
          </section>
        </div>

        ${outcomeHtml}

        <div class="enchant-stats">
          <div class="stat"><strong>${fmt(stats.a)}</strong><span>попыток</span></div>
          <div class="stat is-good"><strong>${fmt(stats.s)}</strong><span>успехов</span></div>
          <div class="stat is-bad"><strong>${fmt(stats.f)}</strong><span>провалов</span></div>
          <div class="stat is-bad"><strong>${fmt(stats.d)}</strong><span>разрушено</span></div>
          <div class="stat"><strong>${fmt(stats.r)}</strong><span>сбросов</span></div>
          <div class="stat"><strong>${stats.best ? '+' + stats.best : '—'}</strong><span>лучшая</span></div>
        </div>

        <details class="enchant-table"${eState.tableOpen ? ' open' : ''}>
          <summary>Таблица шансов +1…+${eRates.max}</summary>
          <div class="table-wrap">
            <table class="res-table">
              <thead><tr><th>Цель</th><th>Шанс шага</th><th>С +0</th><th>Провал</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </div>
        </details>

        <div class="log-wrap">
          <div class="log-head"><span>Журнал заточки</span><span>${logEntries.length}</span></div>
          <div class="log" id="enchantLog">${logHtml}</div>
        </div>
      </article>
    `;

    host.scrollTop = scrollTop;
    eBindDetail(item);
    eSyncMobileView();
  }

  function eBindDetail(item) {
    document.getElementById('enchantBtn')?.addEventListener('click', eDoEnchant);
    document.getElementById('enchantReset')?.addEventListener('click', eResetItem);
    document.getElementById('enchantBack')?.addEventListener('click', () => {
      eState.mobileView = 'list';
      eSyncMobileView();
      const active = document.getElementById('enchantList')?.querySelector('.recipe-row.is-active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    });

    document.querySelectorAll('[data-eauto]').forEach(btn => {
      btn.addEventListener('click', () => eAutoEnchant(+btn.dataset.eauto));
    });

    document.querySelectorAll('[data-escroll]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (eState.busy) return;
        eState.blessed = btn.dataset.escroll === 'blessed';
        eState.outcome = null;
        eRenderDetail();
      });
    });

    const details = document.querySelector('.enchant-table');
    if (details) {
      details.addEventListener('toggle', () => { eState.tableOpen = details.open; });
    }
  }

  function eAutoEnchant(target) {
    if (eState.busy) return;
    const item = enchantById.get(eState.selectedId);
    if (!item || eState.destroyed || eState.level >= eRates.max) return;
    const goal = Math.min(eRates.max, Math.max(target, eState.level + 1));
    if (goal <= eState.level) return;
    const from = eState.level;
    const limit = 2000;

    eState.busy = true;
    eState.outcome = null;
    eRenderDetail();

    window.setTimeout(() => {
      const stats = eStats(item.id);
      let attempts = 0;
      let successes = 0;
      let destroyed = false;

      while (!destroyed && eState.level < goal && attempts < limit) {
        const next = eState.level + 1;
        const chance = eChance(item, next, eState.blessed);
        attempts++;
        stats.a++;
        stats.scrolls++;

        if (roll(chance / 100)) {
          eState.level = next;
          successes++;
          stats.s++;
          stats.best = Math.max(stats.best, eState.level);
        } else {
          stats.f++;
          if (eState.blessed) {
            eState.level = 0;
            stats.r++;
          } else {
            eState.level = 0;
            eState.destroyed = true;
            stats.d++;
            destroyed = true;
          }
        }
      }

      eState.busy = false;

      if (destroyed) {
        eState.outcome = { type: 'fail', title: 'Разрушен', text: `Авто +${from} → +${goal}: ${fmt(attempts)} попыток` };
        eAddLog(item, false, `Авто +${from}→+${goal}`, `разрушен через ${fmt(attempts)} попыток`);
      } else if (eState.level >= goal) {
        eState.outcome = { type: 'success', title: 'Цель взята', text: `+${goal} за ${fmt(attempts)} попыток` };
        eAddLog(item, true, `Авто +${from}→+${goal}`, `${fmt(attempts)} попыток · ${fmt(successes)} успехов`);
      } else {
        eState.outcome = { type: 'reset', title: 'Лимит', text: `Остановлено на +${eState.level} после ${fmt(attempts)} попыток` };
        eAddLog(item, false, `Авто +${from}→+${goal}`, `лимит ${fmt(limit)} попыток`);
      }

      eRenderDetail();
      eRenderCatalog();
      eSyncMobileView();
    }, 360);
  }

  function eDoEnchant() {
    if (eState.busy) return;
    const item = enchantById.get(eState.selectedId);
    if (!item || eState.destroyed || eState.level >= eRates.max) return;
    const from = eState.level;
    const chance = eChance(item, from + 1, eState.blessed);
    eState.busy = true;
    eState.outcome = null;
    eRenderDetail();

    window.setTimeout(() => {
      const ok = roll(chance / 100);
      const stats = eStats(item.id);
      stats.a++;
      stats.scrolls++;

      if (ok) {
        eState.level = from + 1;
        stats.s++;
        stats.best = Math.max(stats.best, eState.level);
        eState.outcome = { type: 'success', title: 'Успех', text: `${item.name} теперь +${eState.level}` };
        eAddLog(item, true, 'Успех', `+${from} → +${eState.level}`);
      } else if (eState.blessed) {
        eState.level = 0;
        stats.f++;
        stats.r++;
        eState.outcome = { type: 'reset', title: 'Провал', text: 'Заточка сброшена на +0, предмет уцелел' };
        eAddLog(item, false, 'Провал', `сброс +${from} → +0`);
      } else {
        eState.level = 0;
        eState.destroyed = true;
        stats.f++;
        stats.d++;
        eState.outcome = { type: 'fail', title: 'Провал', text: 'Предмет разрушен' };
        eAddLog(item, false, 'Провал', `+${from} → разрушен`);
      }

      eState.busy = false;
      eRenderDetail();
      eRenderCatalog();
    }, 700);
  }

  function eResetItem() {
    if (eState.busy) return;
    const item = enchantById.get(eState.selectedId);
    if (!item) return;
    eState.level = 0;
    eState.destroyed = false;
    eState.outcome = { type: '', title: 'Новый предмет', text: 'Заточка начинается с +0.' };
    eAddLog(item, true, 'Новый предмет', '+0');
    eRenderDetail();
    eRenderCatalog();
  }

  function openEnchant(event) {
    enchantOpener = event?.currentTarget || null;
    const overlay = document.getElementById('enchantOverlay');
    if (!overlay) return;
    eState.mobileView = 'list';
    eRenderChips();
    eRenderCatalog();
    if (!eState.selectedId && enchantItems.length) {
      eState.selectedId = enchantItems[0].id;
      eRenderDetail();
    }
    overlay.hidden = false;
    document.body.classList.add('enchant-open');
    eSyncMobileView();
    const active = document.getElementById('enchantList')?.querySelector('.recipe-row.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
    overlay.querySelector('.enchant-close')?.focus();
  }

  function closeEnchant() {
    const overlay = document.getElementById('enchantOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    eState.mobileView = 'list';
    document.body.classList.remove('enchant-open');
    if (location.hash === '#enchant') {
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    }
    if (enchantOpener) enchantOpener.focus();
  }

  /* ---------- каталог ---------- */

  function filtered() {
    const q = state.query.trim().toLowerCase();
    const items = recipes.filter(r => {
      if (state.grade !== 'all' && r.result.grade !== state.grade) return false;
      if (state.type !== 'all' && r.type !== state.type) return false;
      if (state.chance !== 'all' && String(r.chance) !== state.chance) return false;
      if (q && !(`${r.result.name} ${r.recipeName} ${r.result.id}`.toLowerCase().includes(q))) return false;
      return true;
    });

    return items.sort((a, b) => {
      if (state.sort === 'name') return a.result.name.localeCompare(b.result.name);
      if (state.sort === 'chance') return b.chance - a.chance || a.result.name.localeCompare(b.result.name);
      if (state.sort === 'level') return b.craftLevel - a.craftLevel || a.result.name.localeCompare(b.result.name);
      return (GRADE_ORDER[b.result.grade] ?? -1) - (GRADE_ORDER[a.result.grade] ?? -1)
        || b.chance - a.chance
        || a.result.name.localeCompare(b.result.name);
    });
  }

  function chip(value, label, active) {
    return `<button type="button" class="chip${active ? ' is-active' : ''}" data-value="${esc(value)}" aria-pressed="${active}">${esc(label)}</button>`;
  }

  function renderChips() {
    document.getElementById('gradeChips').innerHTML =
      chip('all', 'Все', state.grade === 'all') +
      [...new Set(recipes.map(r => r.result.grade))]
        .sort((a, b) => (GRADE_ORDER[b] ?? -1) - (GRADE_ORDER[a] ?? -1))
        .map(g => chip(g, g, state.grade === g)).join('');

    document.getElementById('typeChips').innerHTML =
      chip('all', 'Все', state.type === 'all') +
      Object.keys(TYPE_LABEL)
        .filter(type => recipes.some(r => r.type === type))
        .map(type => chip(type, TYPE_LABEL[type], state.type === type)).join('');

    document.getElementById('chanceChips').innerHTML =
      chip('all', 'Все', state.chance === 'all') +
      chanceValues.map(c => chip(String(c), c + '%', state.chance === String(c))).join('');
  }

  function renderCatalog() {
    const items = filtered();
    countEl.textContent = items.length;
    if (!items.length) {
      listEl.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуйте другой запрос или сбросьте фильтры.</div>';
      return;
    }

    listEl.innerHTML = items.map(r => `
      <button type="button" class="recipe-row${r.id === state.selectedId ? ' is-active' : ''}"
              data-id="${r.id}" role="option" aria-selected="${r.id === state.selectedId}">
        ${iconHtml(r.icon, r.result.name)}
        <span class="recipe-row-main">
          <strong>${esc(r.result.name)}</strong>
          <small><span class="grade grade-${esc(r.result.grade)}">${esc(r.result.grade)}</span>
          <span>${esc(typeLabel(r.type))}</span><span>· ур. ${r.craftLevel}</span></small>
        </span>
        <span class="chance-pill" data-chance="${r.chance}">${r.chance}%</span>
      </button>
    `).join('');
  }

  /* ---------- карточка рецепта ---------- */

  function materialHtml(d, r) {
    const isRecipe = d.name.startsWith('Recipe:');
    return `
      <div class="material${isRecipe ? ' is-recipe' : ''}">
        ${iconHtml(d.icon, d.name)}
        <div class="material-name">${esc(d.name)}
          <span class="material-sub">${isRecipe ? 'расходуется за попытку' : 'на одну попытку'}</span>
        </div>
        <span class="material-count">×${fmt(d.count)}</span>
      </div>
    `;
  }

  function directPanel(r) {
    return `
      <section class="panel" data-panel="craft"${state.tab !== 'craft' ? ' hidden' : ''}>
        <div class="section-head">
          <h3>Материалы</h3>
          <span>расход на 1 попытку · ${r.direct.length} позиций</span>
        </div>
        <div class="material-grid">
          ${r.direct.map(d => materialHtml(d, r)).join('')}
        </div>
        <p class="note">
          ${isQuestRecipe(r)
            ? `Это квестовый рецепт: он изучается один раз и <b>не расходуется</b> при крафте. За попытку тратится только то, что указано выше.`
            : `Рецепт <b>${esc(r.recipeName)}</b> расходуется при каждой попытке. Чтобы занести его в книгу рецептов,
               нужен отдельный экземпляр. При провале материалы и рецепт пропадают — как в игре.`}
        </p>

        <div class="simulator" id="simulator">
          <div class="sim-head">
            <h3>Горн</h3>
            <small>шанс ${r.chance}% за попытку · MP ${fmt(r.mp)}</small>
          </div>
          <div class="sim-stats">
            <div class="stat"><strong id="stAttempts">0</strong><span>попыток</span></div>
            <div class="stat is-good"><strong id="stSuccess">0</strong><span>успехов</span></div>
            <div class="stat is-bad"><strong id="stFail">0</strong><span>провалов</span></div>
            <div class="stat"><strong id="stRate">—</strong><span>факт. шанс</span></div>
          </div>

          <div class="forge" id="forge">
            <div class="forge-idle">
              <strong>Готов к работе</strong>
              <span>Нажмите «Скрафтить» — результат определит генератор случайных чисел.</span>
              <div class="forge-bar"><i></i></div>
            </div>
          </div>

          <div class="sim-actions">
            <button type="button" class="craft-btn" id="craftBtn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 4.5l5 5M13 6l5 5M4 20l6.5-6.5M10.5 9.5l4-4 4 4-4 4z"/>
                <path d="M4 20l2.5-2.5"/>
              </svg>
              <span>Скрафтить<span class="sub">Create Item</span></span>
            </button>
            <button type="button" class="batch-btn" data-batch="10">×10</button>
            <button type="button" class="batch-btn" data-batch="100">×100</button>
            <button type="button" class="batch-btn batch-until" data-craft-until="1">До успеха</button>
            <button type="button" class="reset-btn" id="resetBtn" title="Сбросить статистику этого рецепта">Сброс</button>
          </div>

          <div class="sim-meta" id="simMeta"></div>

          <div class="log-wrap">
            <div class="log-head"><span>Журнал попыток</span><span id="logCount">0</span></div>
            <div class="log" id="log"></div>
          </div>
        </div>
      </section>
    `;
  }

  function basePanel(r) {
    const p = pOf(r);
    const n95 = attemptsFor95(r);
    const rows = [...r.base].sort((a, b) => b.count - a.count);
    const baseRows = rows.map(b => {
      const isRecipe = b.name.startsWith('Recipe:');
      const perSuccess = b.count / p;
      return `
        <tr>
          <td><div class="res-item">${iconHtml(b.icon, b.name)}<span>${esc(b.name)}</span></div></td>
          <td class="${isRecipe ? 'recipe-row-cell' : 'gold'}">${fmt(b.count)}</td>
          <td>${fmtDec(perSuccess)}</td>
          <td class="dim">${fmt(b.count * n95)}</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="panel" data-panel="resources"${state.tab !== 'resources' ? ' hidden' : ''}>
        <div class="section-head">
          <h3>Все ресурсы</h3>
          <span>с промежуточными крафтами · база</span>
        </div>
        <div class="formula">
          <div>Попыток до успеха в среднем: <b>${fmtDec(expectedAttempts(r))}</b></div>
          <div>Попыток для 95% шанса: <b>${fmt(n95)}</b></div>
          <div>Предметов на 1 попытку: <b>${fmt(materialSum(r))}</b></div>
        </div>
        <div class="table-wrap">
          <table class="res-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th>На 1 попытку</th>
                <th>На 1 успех (сред.)</th>
                <th>На 95% (бюджет)</th>
              </tr>
            </thead>
            <tbody>${baseRows}</tbody>
          </table>
        </div>
        <p class="note">
          Колонка «на 95%» — сколько нужно материалов, чтобы с вероятностью 95% получить хотя бы один предмет.
          Расчёт предполагает независимые попытки и фиксированный шанс <b>${r.chance}%</b>.
          Базовые материалы включают цепочки промежуточных крафтов; часть из них можно купить или заспойлить.
        </p>
      </section>
    `;
  }

  function mathPanel(r) {
    const p = pOf(r);
    const bars = [1, 2, 3, 5, 10, 25, 50, 100, 200, 500];
    const barHtml = bars.map(n => {
      const v = 1 - Math.pow(1 - p, n);
      return `
        <div class="prob-bar">
          <span>${n} поп.</span>
          <span class="track"><i class="fill" style="width:${(v * 100).toFixed(3)}%"></i></span>
          <b>${fmtProb(v)}</b>
        </div>
      `;
    }).join('');

    return `
      <section class="panel" data-panel="math"${state.tab !== 'math' ? ' hidden' : ''}>
        <div class="section-head">
          <h3>Шансы и ресурсы</h3>
          <span>каждый крафт независим</span>
        </div>
        <div class="prob-controls">
          <label for="probRange">Попыток</label>
          <input id="probRange" type="range" min="1" max="500" step="1" value="${state.probN}">
          <input id="probNumber" type="number" min="1" max="500" step="1" value="${state.probN}" aria-label="Количество попыток">
        </div>
        <div class="prob-grid">
          <div class="prob-card"><strong id="probAtLeast">—</strong><span>вероятность хотя бы одного успеха</span></div>
          <div class="prob-card"><strong id="probExpected">—</strong><span>ожидаемое число успехов</span></div>
          <div class="prob-card"><strong id="probZero">—</strong><span>вероятность остаться ни с чем</span></div>
        </div>
        <div class="prob-bars">${barHtml}</div>
        <div class="formula">
          <div>Среднее число попыток до успеха: <b>${fmtDec(expectedAttempts(r))}</b></div>
          <div>Медиана (50% игроков): <b>${fmt(medianAttempts(r))}</b> попыток</div>
          <div>95% шанс получить предмет: <b>${fmt(attemptsFor95(r))}</b> попыток</div>
          <div>Ресурсов на 95%: <b>${fmt(materialSum(r) * attemptsFor95(r))}</b> шт.</div>
        </div>
        <p class="note">
          Формула: P(хотя бы один успех за N попыток) = 1 − (1 − p)<sup>N</sup>, где p = ${p.toFixed(2).replace('.', ',')}.
          «Среднее» — это математическое ожидание, а не гарантия: неудачные серии возможны и при 60% шансе.
        </p>
      </section>
    `;
  }

  function renderDetail() {
    const r = byId.get(state.selectedId);
    if (!r) return;

    detailEl.innerHTML = `
      <article class="sheet grade-tone-${esc(r.result.grade)}" data-id="${r.id}">
        <button type="button" class="mobile-back" id="mobileBack">← Каталог рецептов</button>
        <header class="result-head">
          <div class="result-icon"><img src="${esc(r.icon)}" alt="${esc(r.result.name)}" width="64" height="64"></div>
          <div class="result-info">
            <div class="result-kicker">
              <span class="grade grade-${esc(r.result.grade)}">${esc(r.result.grade)}</span>
              <span>${esc(typeLabel(r.type))}</span>
              <span>ID ${r.result.id}</span>
            </div>
            <h2>${esc(r.result.name)}</h2>
            <div class="recipe-name">${esc(r.recipeName)}</div>
            <div class="meta-chips">
              <span class="meta-chip">Уровень крафта <b>${r.craftLevel}</b></span>
              <span class="meta-chip">MP <b>${fmt(r.mp)}</b></span>
              <span class="meta-chip">Выход <b>${fmt(r.resultCount)}</b></span>
              <span class="meta-chip">Тип рецепта <b>${esc(r.recipeType)}</b></span>
              ${isQuestRecipe(r) ? '<span class="meta-chip">Квестовый рецепт</span>' : ''}
            </div>
          </div>
          <div class="chance-orb" data-chance="${r.chance}" style="--p:${r.chance}">
            <div class="chance-orb-inner"><strong>${r.chance}%</strong><small>шанс</small></div>
          </div>
        </header>

        <nav class="tabs" role="tablist" aria-label="Разделы рецепта">
          <button type="button" class="tab${state.tab === 'craft' ? ' is-active' : ''}" data-tab="craft" role="tab" aria-selected="${state.tab === 'craft'}">Крафт</button>
          <button type="button" class="tab${state.tab === 'resources' ? ' is-active' : ''}" data-tab="resources" role="tab" aria-selected="${state.tab === 'resources'}">Ресурсы</button>
          <button type="button" class="tab${state.tab === 'math' ? ' is-active' : ''}" data-tab="math" role="tab" aria-selected="${state.tab === 'math'}">Шансы</button>
        </nav>

        ${directPanel(r)}
        ${basePanel(r)}
        ${mathPanel(r)}
      </article>
    `;

    bindDetail(r);
    renderStats(r);
    renderLog(r);
    updateProb(r);
  }

  function bindDetail(r) {
    const sheet = detailEl.querySelector('.sheet');
    const sim = document.getElementById('simulator');

    sheet.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.tab = tab.dataset.tab;
        sheet.querySelectorAll('.tab').forEach(t => {
          const active = t.dataset.tab === state.tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', String(active));
        });
        sheet.querySelectorAll('.panel').forEach(panel => {
          panel.hidden = panel.dataset.panel !== state.tab;
        });
      });
    });

    document.getElementById('craftBtn').addEventListener('click', () => doCraft(r, 1));
    sheet.querySelectorAll('[data-batch]').forEach(btn => {
      btn.addEventListener('click', () => doCraft(r, +btn.dataset.batch));
    });
    sheet.querySelectorAll('[data-craft-until]').forEach(btn => {
      btn.addEventListener('click', () => craftUntilSuccess(r));
    });
    document.getElementById('resetBtn').addEventListener('click', () => resetStats(r));

    document.getElementById('mobileBack')?.addEventListener('click', () => {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const range = document.getElementById('probRange');
    const number = document.getElementById('probNumber');
    if (range && number) {
      range.addEventListener('input', () => {
        state.probN = Math.max(1, Math.min(500, +range.value || 1));
        number.value = state.probN;
        updateProb(r);
      });
      number.addEventListener('input', () => {
        const n = Math.max(1, Math.min(500, +number.value || 1));
        state.probN = n;
        range.value = n;
        updateProb(r);
      });
    }

    if (sim) sim.dataset.recipeId = String(r.id);
  }

  function updateProb(r) {
    const p = pOf(r);
    const n = state.probN;
    const atLeast = 1 - Math.pow(1 - p, n);
    const expected = n * p;
    const zero = Math.pow(1 - p, n);
    const a = document.getElementById('probAtLeast');
    const e = document.getElementById('probExpected');
    const z = document.getElementById('probZero');
    if (a) a.textContent = fmtProb(atLeast);
    if (e) e.textContent = fmtDec(expected);
    if (z) z.textContent = fmtProb(zero);
  }

  /* ---------- статистика и журнал ---------- */

  function renderStats(r) {
    const s = statsFor(r.id);
    const attempts = document.getElementById('stAttempts');
    if (!attempts) return;
    attempts.textContent = fmt(s.a);
    document.getElementById('stSuccess').textContent = fmt(s.s);
    document.getElementById('stFail').textContent = fmt(s.f);
    document.getElementById('stRate').textContent = s.a ? (s.s / s.a * 100).toFixed(1).replace('.', ',') + '%' : '—';
    document.getElementById('simMeta').innerHTML = `
      <span>MP за попытку: <b>${fmt(r.mp)}</b></span>
      <span>Потрачено MP: <b>${fmt(s.mp)}</b></span>
      <span>Израсходовано предметов: <b>${fmt(s.m)}</b> шт.</span>
      <span>Получено: <b>${fmt(s.items)}</b> шт.</span>
    `;
    const logCount = document.getElementById('logCount');
    if (logCount) logCount.textContent = state.logs.get(r.id)?.length || 0;
  }

  function renderLog(r) {
    const log = document.getElementById('log');
    if (!log) return;
    const entries = state.logs.get(r.id) || [];
    if (!entries.length) {
      log.innerHTML = '<div class="log-empty">Пока ни одной попытки. Горн ждёт.</div>';
      return;
    }
    log.innerHTML = entries.map(e => `
      <div class="log-entry ${e.ok ? 'ok' : 'bad'}">
        <time>${esc(e.time)}</time>
        <span class="res">${esc(e.label)}</span>
        <span class="detail">${esc(e.detail)}</span>
      </div>
    `).join('');
  }

  function addLog(r, ok, label, detail) {
    if (!state.logs.has(r.id)) state.logs.set(r.id, []);
    const list = state.logs.get(r.id);
    list.unshift({
      ok,
      label,
      detail,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    if (list.length > 60) list.length = 60;
    if (r.id === state.selectedId) {
      renderLog(r);
      const logCount = document.getElementById('logCount');
      if (logCount) logCount.textContent = list.length;
    }
  }

  function forgeIdle(text = 'Готов к работе', sub = 'Нажмите «Скрафтить» — результат определит генератор случайных чисел.') {
    const forge = document.getElementById('forge');
    if (!forge) return;
    forge.innerHTML = `
      <div class="forge-idle">
        <strong>${esc(text)}</strong>
        <span>${esc(sub)}</span>
        <div class="forge-bar"><i></i></div>
      </div>
    `;
  }

  function forgeBusy(text, sub) {
    const forge = document.getElementById('forge');
    if (!forge) return;
    forge.innerHTML = `
      <div class="forge-idle">
        <strong>${esc(text)}</strong>
        <span>${esc(sub)}</span>
        <div class="forge-bar"><i></i></div>
      </div>
    `;
  }

  function showOutcome(r, ok, title, sub) {
    const forge = document.getElementById('forge');
    if (!forge) return;
    forge.innerHTML = `
      <div class="outcome ${ok ? 'success' : 'fail'}">
        <div class="outcome-icon"><img src="${esc(r.icon)}" alt="" width="44" height="44"></div>
        <div class="outcome-copy">
          <strong>${esc(title)}</strong>
          <span>${esc(sub)}</span>
        </div>
      </div>
    `;
  }

  function setBusy(busy) {
    state.busy = busy;
    const sim = document.getElementById('simulator');
    if (sim) sim.classList.toggle('is-crafting', busy);
    const sheet = document.querySelector('.sheet');
    if (sheet) sheet.classList.toggle('is-crafting', busy);
    document.querySelectorAll('#craftBtn, [data-batch], [data-craft-until], #resetBtn').forEach(btn => { btn.disabled = busy; });
  }

  function applyResult(r, attempts, successes) {
    const s = statsFor(r.id);
    const failures = attempts - successes;
    s.a += attempts;
    s.s += successes;
    s.f += failures;
    s.mp += r.mp * attempts;
    s.items += successes * r.resultCount;
    s.m += materialSum(r) * attempts;
    saveStats();
    if (r.id === state.selectedId) renderStats(r);
  }

  function craftUntilSuccess(r) {
    if (state.busy) return;
    const p = pOf(r);
    const limit = 500;
    setBusy(true);
    forgeBusy('Ищу успех…', `Не больше ${limit} попыток. Материалы и рецепт тратятся как в игре.`);

    window.setTimeout(() => {
      let attempts = 0;
      let success = false;
      while (attempts < limit) {
        attempts++;
        if (roll(p)) {
          success = true;
          break;
        }
      }
      applyResult(r, attempts, success ? 1 : 0);

      if (r.id === state.selectedId) {
        if (success) {
          showOutcome(r, true, 'Успех', `Понадобилось попыток: ${fmt(attempts)} · шанс ${r.chance}%`);
          addLog(r, true, `Успех за ${fmt(attempts)}`, `+${fmt(r.resultCount)} · ${r.result.name}`);
        } else {
          showOutcome(r, false, 'Лимит', `За ${limit} попыток успеха не было · шанс ${r.chance}%`);
          addLog(r, false, `${limit} попыток`, 'успеха нет');
        }
      }
      setBusy(false);
    }, 520);
  }

  function doCraft(r, n) {
    if (state.busy) return;
    const p = pOf(r);
    setBusy(true);

    if (n === 1) {
      forgeBusy('Плавка…', isQuestRecipe(r)
        ? 'Материалы отправлены в горн.'
        : 'Материалы и рецепт отправлены в горн.');
      window.setTimeout(() => {
        const ok = roll(p);
        applyResult(r, 1, ok ? 1 : 0);

        if (r.id === state.selectedId) {
          if (ok) {
            showOutcome(r, true, 'Успех', `Получено: ${r.result.name} ×${fmt(r.resultCount)} · шанс ${r.chance}%`);
            addLog(r, true, 'Успех', `+${fmt(r.resultCount)} · ${r.result.name}`);
          } else {
            showOutcome(r, false, 'Провал', isQuestRecipe(r)
              ? `Материалы потеряны · шанс был ${r.chance}%`
              : `Материалы и рецепт потеряны · шанс был ${r.chance}%`);
            addLog(r, false, 'Провал', isQuestRecipe(r) ? 'материалы потеряны' : 'материалы и рецепт потеряны');
          }
        }
        setBusy(false);
      }, 850);
      return;
    }

    forgeBusy(`Пакетная плавка ×${n}`, 'Считаем независимые попытки…');
    window.setTimeout(() => {
      let successes = 0;
      for (let i = 0; i < n; i++) {
        if (roll(p)) successes++;
      }
      applyResult(r, n, successes);

      if (r.id === state.selectedId) {
        const ok = successes > 0;
        const rate = (successes / n * 100).toFixed(0);
        showOutcome(
          r,
          ok,
          `${successes} / ${n}`,
          ok
            ? `успешных крафтов · ${rate}% · получено ${fmt(successes * r.resultCount)} шт.`
            : 'ни одного успеха — материалы потеряны'
        );
        addLog(r, ok, `${successes}/${n}`, ok ? `+${fmt(successes * r.resultCount)} шт.` : 'все провалились');
      }
      setBusy(false);
    }, 420);
  }

  function resetStats(r) {
    state.stats[r.id] = { a: 0, s: 0, f: 0, mp: 0, items: 0, m: 0 };
    state.logs.delete(r.id);
    saveStats();
    renderStats(r);
    renderLog(r);
    forgeIdle();
  }

  /* ---------- выбор рецепта ---------- */

  function selectRecipe(id, updateHash = true) {
    if (!byId.has(id)) return;
    state.selectedId = id;
    state.tab = 'craft';
    if (updateHash) {
      try {
        history.replaceState(null, '', '#' + id);
      } catch {
        location.hash = String(id);
      }
    }
    renderCatalog();
    renderDetail();
    const active = listEl.querySelector('.recipe-row.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
    if (updateHash && window.innerWidth <= 920) {
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- события ---------- */

  listEl.addEventListener('click', e => {
    const row = e.target.closest('.recipe-row');
    if (row) selectRecipe(+row.dataset.id);
  });

  searchEl.addEventListener('input', () => {
    state.query = searchEl.value;
    renderCatalog();
  });

  sortEl.addEventListener('change', () => {
    state.sort = sortEl.value;
    renderCatalog();
  });

  document.getElementById('resetFilters')?.addEventListener('click', () => {
    state.query = '';
    state.grade = 'all';
    state.type = 'all';
    state.chance = 'all';
    state.sort = 'grade';
    searchEl.value = '';
    sortEl.value = 'grade';
    renderChips();
    renderCatalog();
  });

  document.getElementById('enchantResetFilters')?.addEventListener('click', () => {
    eState.query = '';
    eState.grade = 'all';
    eState.type = 'all';
    const search = document.getElementById('enchantSearch');
    if (search) search.value = '';
    eRenderChips();
    eRenderCatalog();
  });

  document.querySelectorAll('.chips').forEach(box => {
    box.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const group = box.parentElement.dataset.filter;
      state[group] = btn.dataset.value;
      renderChips();
      renderCatalog();
    });
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === '#enchant') {
      openEnchant();
      return;
    }
    const id = +location.hash.slice(1);
    if (byId.has(id) && id !== state.selectedId) selectRecipe(id, false);
  });

  document.querySelectorAll('[data-mode="craft"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- события заточки ---------- */

  document.querySelectorAll('[data-enchant-open]').forEach(btn => {
    btn.addEventListener('click', openEnchant);
  });
  document.querySelectorAll('[data-enchant-close]').forEach(el => {
    el.addEventListener('click', closeEnchant);
  });
  document.addEventListener('keydown', event => {
    const overlay = document.getElementById('enchantOverlay');
    if (event.key === 'Escape' && overlay && !overlay.hidden) closeEnchant();
  });
  window.addEventListener('resize', eSyncMobileView);

  const enchantSearchEl = document.getElementById('enchantSearch');
  if (enchantSearchEl) {
    enchantSearchEl.addEventListener('input', () => {
      eState.query = enchantSearchEl.value;
      eRenderCatalog();
    });
  }

  const enchantListEl = document.getElementById('enchantList');
  if (enchantListEl) {
    enchantListEl.addEventListener('click', event => {
      const row = event.target.closest('.recipe-row');
      if (row) eSelect(+row.dataset.eid);
    });
  }

  document.querySelectorAll('[data-efilter]').forEach(group => {
    const chips = group.querySelector('.chips');
    if (!chips) return;
    chips.addEventListener('click', event => {
      const btn = event.target.closest('.chip');
      if (!btn) return;
      const key = group.dataset.efilter;
      eState[key] = btn.dataset.value;
      eRenderChips();
      eRenderCatalog();
    });
  });

  /* ---------- старт ---------- */

  const hashId = +location.hash.slice(1);
  renderChips();
  renderArticles();
  if (enchantItems.length) {
    eState.selectedId = enchantItems[0].id;
    eRenderChips();
    eRenderCatalog();
    eRenderDetail();
  }
  selectRecipe(byId.has(hashId) ? hashId : recipes[0].id, false);
  if (location.hash === '#enchant') openEnchant();
})();
