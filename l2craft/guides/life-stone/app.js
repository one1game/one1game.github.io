/* =============================================================
   LIFE STONE — симулятор аугментации и калькуляторы для гайда.
   Данные локальные: оружие и иконки — из базы L2 Craft, шансы —
   из таблицы гайда. Никаких внешних API и ключей.
   ============================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var ICONS = '../../icons/';

  var WEAPONS = [
    { name: "Heaven's Divider", grade: 'S', type: 'двуручный меч', icon: 'weapon_heavens_divider_i00.png', best: ['Might', 'Celestial Shield'] },
    { name: 'Dragon Slayer', grade: 'S', type: 'меч', icon: 'weapon_dragon_slayer_i00.png', best: ['Might', 'Focus'] },
    { name: 'Forgotten Blade', grade: 'S', type: 'меч', icon: 'weapon_forgotten_blade_i00.png', best: ['Might', 'Celestial Shield'] },
    { name: 'Elysian', grade: 'S', type: 'меч', icon: 'weapon_elysian_i00.png', best: ['Might', 'Duel Might'] },
    { name: "Dark Legion's Edge", grade: 'S', type: 'меч', icon: 'weapon_dark_legions_edge_i00.png', best: ['Might', 'Duel Might'] },
    { name: 'Star Buster', grade: 'S', type: 'двуручный меч', icon: 'weapon_star_buster_i00.png', best: ['Might', 'Celestial Shield'] },
    { name: 'Soul Separator', grade: 'A', type: 'кинжал', icon: 'weapon_soul_separator_i00.png', best: ['Duel Might', 'Refresh'] },
    { name: 'Angel Slayer', grade: 'S', type: 'кинжал', icon: 'weapon_angel_slayer_i00.png', best: ['Duel Might', 'Agility'] },
    { name: 'Bloody Orchid', grade: 'A', type: 'кинжал', icon: 'weapon_bloody_orchid_i00.png', best: ['Duel Might', 'Evasion'] },
    { name: 'Doom Crusher', grade: 'A', type: 'дробящее', icon: 'weapon_doom_crusher_i00.png', best: ['Might', 'Reflect Damage'] },
    { name: 'Meteor Shower', grade: 'S', type: 'дробящее', icon: 'weapon_meteor_shower_i00.png', best: ['Might', 'Celestial Shield'] },
    { name: 'Dragon Grinder', grade: 'S', type: 'кастет', icon: 'weapon_dragon_grinder_i00.png', best: ['Might', 'Duel Might'] },
    { name: 'Draconic Bow', grade: 'S', type: 'лук', icon: 'weapon_draconic_bow_i00.png', best: ['Focus', 'Duel Might'] },
    { name: 'Soul Bow', grade: 'A', type: 'лук', icon: 'weapon_soul_bow_i00.png', best: ['Focus', 'Evasion'] },
    { name: 'Saint Spear', grade: 'S', type: 'копьё', icon: 'weapon_saint_spear_i00.png', best: ['Might', 'Reflect Damage'] },
    { name: 'Tallum Glaive', grade: 'A', type: 'копьё', icon: 'weapon_tallum_glaive_i00.png', best: ['Might', 'Celestial Shield'] },
    { name: 'Imperial Staff', grade: 'S', type: 'посох', icon: 'weapon_imperial_staff_i00.png', best: ['Wild Magic', 'Empower'] },
    { name: "Dasparion's Staff", grade: 'S', type: 'посох', icon: 'weapon_dasparions_staff_i00.png', best: ['Wild Magic', 'Nuke'] },
    { name: 'Arcana Mace', grade: 'S', type: 'жезл', icon: 'weapon_arcana_mace_i00.png', best: ['Wild Magic', 'Clarity'] }
  ];

  var SKILLS = [
    { name: 'Might', type: 'Пассивный', effect: '+5% P. Atk' },
    { name: 'Might', type: 'Активный', effect: '+10% P. Atk' },
    { name: 'Focus', type: 'Пассивный', effect: 'шанс физ. крита' },
    { name: 'Focus', type: 'Активный', effect: 'шанс физ. крита' },
    { name: 'Wild Magic', type: 'Пассивный', effect: 'шанс маг. крита' },
    { name: 'Wild Magic', type: 'Активный', effect: 'шанс маг. крита' },
    { name: 'Duel Might', type: 'Активный', effect: 'P. Atk в PvP' },
    { name: 'Celestial Shield', type: 'Активный', effect: 'временная неуязвимость' },
    { name: 'Heal', type: 'Активный', effect: 'восстановление HP' },
    { name: 'Refresh', type: 'Активный', effect: 'сокращает откат умений' },
    { name: 'Shield', type: 'Активный', effect: '+P. Def' },
    { name: 'Magic Barrier', type: 'Пассивный', effect: '+M. Def' },
    { name: 'Clarity', type: 'Пассивный', effect: 'меньше расход MP' },
    { name: 'Agility', type: 'Пассивный', effect: 'скорость и уклонение' },
    { name: 'Evasion', type: 'Пассивный', effect: '+уклонение' },
    { name: 'Empower', type: 'Пассивный', effect: '+M. Atk' },
    { name: 'Nuke', type: 'Активный', effect: 'магический удар стихией' },
    { name: 'Reflect Damage', type: 'Пассивный', effect: 'отражает физ. автоатаку' },
    { name: 'Reflect Damage', type: 'Активный', effect: 'отражает физ. автоатаку' }
  ];

  var STATS = ['STR', 'INT', 'CON', 'MEN', 'DEX', 'WIT'];

  var GRADES = {
    normal: { label: 'Normal', skill: 0.015, stat: 0, price: 150000 },
    mid: { label: 'Mid-Grade', skill: 0.05, stat: 0, price: 600000 },
    high: { label: 'High-Grade', skill: 0.11, stat: 0, price: 3000000 },
    top: { label: 'Top-Grade', skill: 0.15, stat: 0.04, price: 15000000 }
  };

  var STORE_KEY = 'l2ls:state';

  var state = {
    weapon: 0,
    grade: 'high',
    prices: { normal: 150000, mid: 600000, high: 3000000, top: 15000000 },
    stats: { stones: 0, skills: 0, bonus: 0, spent: 0 }
  };

  var log = [];
  var rolling = false;

  function fmt(n) {
    return Math.round(n || 0).toLocaleString('ru-RU');
  }

  function dec(n) {
    return String(n).replace('.', ',');
  }

  function num(v) {
    var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ prices: state.prices, stats: state.stats }));
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.prices) {
        Object.keys(state.prices).forEach(function (k) {
          if (typeof data.prices[k] === 'number') state.prices[k] = data.prices[k];
        });
      }
      if (data && data.stats) {
        Object.keys(state.stats).forEach(function (k) {
          if (typeof data.stats[k] === 'number') state.stats[k] = data.stats[k];
        });
      }
    } catch (e) {}
  }

  /* ── Симулятор ───────────────────────────────────────────── */
  function currentWeapon() {
    return WEAPONS[state.weapon] || WEAPONS[0];
  }

  function renderWeapon() {
    var w = currentWeapon();
    $('ls-weapon-name').textContent = w.name;
    $('ls-weapon-type').textContent = w.grade + ' · ' + w.type;
    $('ls-weapon-best').textContent = 'Цель: ' + w.best.join(' / ');
    var img = $('ls-weapon-icon');
    img.src = ICONS + w.icon;
    img.alt = w.name;
  }

  function renderPrice() {
    $('ls-price').value = state.prices[state.grade];
    $('ls-price-top').value = state.prices.top;
    $('ls-price-high').value = state.prices.high;
  }

  function renderStats() {
    var s = state.stats;
    $('ls-stat-stones').textContent = fmt(s.stones);
    $('ls-stat-skills').textContent = fmt(s.skills);
    $('ls-stat-bonus').textContent = fmt(s.bonus);
    $('ls-stat-spent').textContent = fmt(s.spent);
    $('ls-stat-avg').textContent = s.skills ? fmt(s.spent / s.skills) : '—';
  }

  function pushLog(html, kind) {
    log.unshift({ html: html, kind: kind || '' });
    if (log.length > 6) log.pop();

    var list = $('ls-log');
    list.innerHTML = log.map(function (item) {
      return '<li' + (item.kind ? ' class="' + item.kind + '"' : '') + '>' + item.html + '</li>';
    }).join('');
  }

  function randomOf(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function rollOnce(gradeKey) {
    var g = GRADES[gradeKey];
    var result = { type: 'fail', skill: null, stat: null };

    if (Math.random() < g.skill) {
      result.type = 'skill';
      result.skill = randomOf(SKILLS);
    }
    if (g.stat && Math.random() < g.stat) {
      result.stat = randomOf(STATS);
      if (result.type === 'fail') result.type = 'stat';
    }
    return result;
  }

  function apply(result, price) {
    state.stats.stones += 1;
    state.stats.spent += price;
    if (result.type === 'skill') state.stats.skills += 1;
    if (result.stat) state.stats.bonus += 1;
  }

  function resultHtml(result) {
    var w = currentWeapon();

    if (result.type === 'skill') {
      var skill = result.skill;
      var target = w.best.indexOf(skill.name) >= 0;
      var extra = result.stat ? ' · +1 ' + result.stat : '';
      return {
        cls: 'is-skill',
        badge: 'Скилл',
        title: skill.name + (target ? '<span class="ls-tag">целевой</span>' : ''),
        sub: skill.type + ' · ' + skill.effect + extra
      };
    }

    if (result.type === 'stat') {
      return {
        cls: 'is-stat',
        badge: 'Стат',
        title: '+1 ' + result.stat,
        sub: 'Top-Grade: бонус к базовому стату'
      };
    }

    return {
      cls: 'is-fail',
      badge: 'Пусто',
      title: 'Камень сгорел',
      sub: 'Скилл не выпал — попытка ушла в никуда'
    };
  }

  function showResult(result, price) {
    var view = resultHtml(result);
    var box = $('ls-result');
    box.className = 'ls-result ' + view.cls;
    box.innerHTML = '<span class="ls-result__badge">' + view.badge + '</span>' +
      '<div class="ls-result__body"><b>' + view.title + '</b><span>' + view.sub + '</span></div>';

    var suffix = '';
    if (result.type === 'skill') suffix = result.skill.name + (result.stat ? ' +1 ' + result.stat : '');
    else if (result.type === 'stat') suffix = '+1 ' + result.stat;
    else suffix = 'пусто';
    pushLog('<span>' + GRADES[state.grade].label + ' · ' + suffix + '</span><b>−' + fmt(price) + '</b>',
      result.type === 'skill' ? 'is-good' : result.type === 'stat' ? 'is-stat' : '');

    renderStats();
    save();
  }

  function roll(batch) {
    var price = state.prices[state.grade];
    if (!price || price < 0) price = 0;

    if (batch > 1) {
      var skills = 0;
      var bonus = 0;
      var empty = 0;
      for (var i = 0; i < batch; i++) {
        var r = rollOnce(state.grade);
        state.stats.stones += 1;
        state.stats.spent += price;
        if (r.type === 'skill') { state.stats.skills += 1; skills++; }
        if (r.stat) { state.stats.bonus += 1; bonus++; }
        if (r.type === 'fail' && !r.stat) empty++;
      }
      pushLog('<span>' + GRADES[state.grade].label + ' ×' + batch + ' · скиллов ' + skills + ', статов ' + bonus +
        ', пусто ' + empty + '</span><b>−' + fmt(price * batch) + '</b>', skills ? 'is-good' : '');

      var box = $('ls-result');
      box.className = 'ls-result ' + (skills ? 'is-skill' : bonus ? 'is-stat' : 'is-fail');
      box.innerHTML = '<span class="ls-result__badge">×' + batch + '</span>' +
        '<div class="ls-result__body"><b>Скиллов: ' + skills + ' · статов: ' + bonus + '</b>' +
        '<span>Потрачено ' + fmt(price * batch) + ' аден</span></div>';

      renderStats();
      save();
      return;
    }

    var result = rollOnce(state.grade);
    apply(result, price);
    showResult(result, price);
  }

  function animateRoll() {
    if (rolling) return;
    rolling = true;

    var card = $('ls-weapon-card');
    var box = $('ls-result');
    card.classList.add('is-rolling');
    box.className = 'ls-result is-rolling';
    box.innerHTML = '<span class="ls-result__badge">Вставка</span>' +
      '<div class="ls-result__body"><b>Куём…</b><span>Камень уходит в оружие</span></div>';

    setTimeout(function () {
      card.classList.remove('is-rolling');
      box.classList.remove('is-rolling');
      roll(1);
      rolling = false;
    }, 420);
  }

  function bindSimulator() {
    var select = $('ls-weapon');
    WEAPONS.forEach(function (w, i) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = w.name + ' (' + w.grade + ')';
      select.appendChild(opt);
    });
    select.value = String(state.weapon);
    select.addEventListener('change', function () {
      state.weapon = parseInt(select.value, 10) || 0;
      renderWeapon();
    });

    var grades = Array.prototype.slice.call(document.querySelectorAll('.ls-grade'));
    grades.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.grade = btn.getAttribute('data-grade');
        grades.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        renderPrice();
      });
    });

    $('ls-price').addEventListener('input', function () {
      var value = Math.max(0, num(this.value));
      state.prices[state.grade] = value;
      if (state.grade === 'top') $('ls-price-top').value = value;
      if (state.grade === 'high') $('ls-price-high').value = value;
      calcEconomy();
      save();
    });

    $('ls-roll').addEventListener('click', animateRoll);
    $('ls-roll10').addEventListener('click', function () { roll(10); });
    $('ls-roll100').addEventListener('click', function () { roll(100); });

    $('ls-reset').addEventListener('click', function () {
      state.stats = { stones: 0, skills: 0, bonus: 0, spent: 0 };
      log = [];
      $('ls-log').innerHTML = '';
      $('ls-result').className = 'ls-result';
      $('ls-result').innerHTML = '<span class="ls-result__badge">Сброс</span>' +
        '<div class="ls-result__body"><b>Счётчики обнулены</b><span>Можно начинать заново</span></div>';
      renderStats();
      save();
    });

    renderWeapon();
    renderPrice();
    renderStats();
  }

  /* ── Экономика ───────────────────────────────────────────── */
  function calcEconomy() {
    var highPrice = Math.max(1, num($('ls-price-high').value) || state.prices.high);
    var topPrice = Math.max(1, num($('ls-price-top').value) || state.prices.top);
    var budget = Math.max(0, num($('ls-budget').value));

    var highCount = Math.floor(budget / highPrice);
    var topCount = Math.floor(budget / topPrice);
    var highSkills = highCount * GRADES.high.skill;
    var topSkills = topCount * GRADES.top.skill;

    $('ls-high-count').textContent = fmt(highCount) + ' камней';
    $('ls-top-count').textContent = fmt(topCount) + ' камней';
    $('ls-high-out').innerHTML = 'Ожидаемо скиллов: <b>' + dec(highSkills.toFixed(1)) + '</b> · цена скилла ≈ ' +
      fmt(highPrice / GRADES.high.skill) + ' аден';
    $('ls-top-out').innerHTML = 'Ожидаемо скиллов: <b>' + dec(topSkills.toFixed(1)) + '</b> · цена скилла ≈ ' +
      fmt(topPrice / GRADES.top.skill) + ' аден';

    var max = Math.max(highSkills, topSkills, 1);
    $('ls-high-bar').style.width = Math.round((highSkills / max) * 100) + '%';
    $('ls-top-bar').style.width = Math.round((topSkills / max) * 100) + '%';

    var verdict = $('ls-verdict');
    if (!budget) {
      verdict.textContent = 'Введите бюджет, чтобы сравнить отдачу.';
      return;
    }
    if (highSkills >= topSkills) {
      var ratio = topSkills > 0 ? (highSkills / topSkills) : 0;
      verdict.innerHTML = '<b>High-Grade выгоднее.</b> На тот же бюджет — ' + dec(highSkills.toFixed(1)) +
        ' скиллов против ' + dec(topSkills.toFixed(1)) + ' у Top' +
        (ratio >= 1.2 ? ' (в ' + dec(ratio.toFixed(1)) + ' раза больше)' : '') +
        '. Top берите только под ролл +1 к стату.';
    } else {
      verdict.innerHTML = '<b>Top-Grade выгоднее.</b> При ваших ценах он даёт ' + dec(topSkills.toFixed(1)) +
        ' скиллов против ' + dec(highSkills.toFixed(1)) + ' у High.';
    }
  }

  function bindEconomy() {
    ['ls-price-high', 'ls-price-top', 'ls-budget'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        if (id === 'ls-price-high') {
          state.prices.high = Math.max(1, num(this.value));
          if (state.grade === 'high') $('ls-price').value = state.prices.high;
        }
        if (id === 'ls-price-top') {
          state.prices.top = Math.max(1, num(this.value));
          if (state.grade === 'top') $('ls-price').value = state.prices.top;
        }
        calcEconomy();
        save();
      });
    });
    calcEconomy();
  }

  /* ── Стакание ────────────────────────────────────────────── */
  function calcStack() {
    var passive = $('ls-stk-passive').checked;
    var active = $('ls-stk-active').checked;
    var buff = $('ls-stk-buff').checked;

    var parts = [];
    var mult = 1;
    if (passive) { mult *= 1.05; parts.push('1,05'); }
    if (active) { mult *= 1.10; parts.push('1,10'); }
    if (buff) { mult *= 1.15; parts.push('1,15'); }

    $('ls-stack-mult').textContent = '×' + dec(mult.toFixed(3));
    $('ls-stack-formula').textContent = parts.length
      ? parts.join(' × ') + ' = ' + dec(mult.toFixed(3)) + ' → +' + dec(((mult - 1) * 100).toFixed(1)) + '% P. Atk'
      : 'ничего не выбрано → +0% P. Atk';
  }

  function bindStack() {
    ['ls-stk-passive', 'ls-stk-active', 'ls-stk-buff'].forEach(function (id) {
      var box = $(id);
      if (box.hasAttribute('checked')) box.checked = true;
      box.addEventListener('change', calcStack);
    });
    calcStack();
  }

  /* ── Капы крита ──────────────────────────────────────────── */
  function critRow(value, cap, valueId, noteId) {
    $(valueId).textContent = String(value);
    var note = $(noteId);
    if (value >= cap) {
      note.textContent = 'перекап: ЛС на крит бесполезен';
      note.className = 'is-over';
    } else {
      note.textContent = 'до капа ' + (cap - value);
      note.className = '';
    }
  }

  function calcCrit() {
    var phys = parseInt($('ls-crit-phys').value, 10) || 0;
    var magic = parseInt($('ls-crit-magic').value, 10) || 0;

    critRow(phys, 500, 'ls-crit-phys-val', 'ls-crit-phys-note');
    critRow(magic, 200, 'ls-crit-magic-val', 'ls-crit-magic-note');

    var verdict = $('ls-crit-verdict');
    if (phys >= 500 && magic >= 200) {
      verdict.textContent = 'Оба капа взяты: Item Skill: Focus и Wild Magic не дадут ничего.';
    } else if (phys >= 500) {
      verdict.textContent = 'Физ. крит в перекапе: Focus бесполезен. Маг. крит ещё имеет запас ' + (200 - magic) + '.';
    } else if (magic >= 200) {
      verdict.textContent = 'Маг. крит в перекапе: Wild Magic бесполезен. Физ. крит ещё имеет запас ' + (500 - phys) + '.';
    } else {
      verdict.textContent = 'Запас есть: физ. крит ' + phys + '/500, маг. ' + magic + '/200.';
    }
  }

  function bindCrit() {
    $('ls-crit-phys').addEventListener('input', calcCrit);
    $('ls-crit-magic').addEventListener('input', calcCrit);
    calcCrit();
  }

  /* ── Старт ───────────────────────────────────────────────── */
  load();
  bindSimulator();
  bindEconomy();
  bindStack();
  bindCrit();
})();
