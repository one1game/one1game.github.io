/* =============================================================
   Cyber-Scanner v3 — тулкит безопасности
   Всё считается в браузере: WebCrypto, DNS-over-HTTPS, разбор кода.
   На наш сервер не уходит ничего. Внешние запросы только к:
   Cloudflare DNS (RFC 8484) и HIBP (k-анонимный протокол).
   ============================================================= */
(function () {
'use strict';

/* ======================== УТИЛИТЫ ======================== */

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function utf8(s) { return new TextEncoder().encode(s); }

function b64ToU8(s) {
  var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  var u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function u8ToB64(u) {
  var s = '';
  for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
function hex(buf) {
  var u = new Uint8Array(buf), s = '';
  for (var i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2);
  return s;
}
function b64urlToStr(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new TextDecoder().decode(b64ToU8(s));
}
function strToB64url(s) {
  return u8ToB64(utf8(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function digest(algo, data) {
  return crypto.subtle.digest(algo, typeof data === 'string' ? utf8(data) : data).then(hex);
}
function rand(n) {
  var u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
}
function shufflePick(list) {
  // Равномерная выборка без смещения (rejection sampling)
  var max = Math.floor(65536 / list.length) * list.length, x;
  do { x = (crypto.getRandomValues(new Uint16Array(1))[0]) % 65536; } while (x >= max);
  return list[x % list.length];
}
function randInt(max) {
  var limit = Math.floor(4294967296 / max) * max, x;
  do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= limit);
  return x % max;
}

var toastTimer;
function toast(msg, kind) {
  var el = $('errorToast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'error-toast' + (kind === 'ok' ? ' ok' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'error-toast hidden'; }, 3600);
}

function copyText(text, msg) {
  if (!text) return toast('Нечего копировать');
  navigator.clipboard.writeText(text).then(function () { toast(msg || 'Скопировано', 'ok'); },
    function () { toast('Браузер запретил доступ к буферу'); });
}

/* ======================== ОЦЕНКИ И ВЫВОД ======================== */

var SEV = {
  critical: { label: 'КРИТИЧНО', w: 25 },
  high:     { label: 'ВЫСОКО',   w: 14 },
  medium:   { label: 'СРЕДНЕ',   w: 7 },
  low:      { label: 'НИЗКО',    w: 3 },
  info:     { label: 'ИНФО',     w: 0 },
  ok:       { label: 'ОК',       w: 0 }
};

function gradeOf(score) {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
function scoreOf(findings) {
  var p = 0;
  findings.forEach(function (f) { p += (SEV[f.sev] || SEV.info).w * (f.count ? 1 : 1); });
  return Math.max(0, Math.min(100, 100 - p));
}

function findingHTML(f) {
  var loc = f.line ? '<span class="f-line">стр. ' + f.line + '</span>' : '';
  var more = f.count && f.count > 1 ? '<span class="f-count">×' + f.count + '</span>' : '';
  return '<div class="finding ' + f.sev + '">' +
    '<div class="f-head">' +
      '<span class="f-title">' + esc(f.title) + '</span>' +
      loc + more +
      '<span class="f-sev ' + f.sev + '">' + (SEV[f.sev] || SEV.info).label + '</span>' +
    '</div>' +
    (f.desc ? '<div class="f-desc">' + esc(f.desc) + '</div>' : '') +
    (f.evidence ? '<div class="f-code mono">' + esc(f.evidence) + '</div>' : '') +
    (f.fix ? '<div class="f-fix"><i class="fas fa-wrench"></i> ' + esc(f.fix) + '</div>' : '') +
  '</div>';
}

function findingsBlock(findings) {
  if (!findings.length) return '<div class="ok-block"><i class="fas fa-circle-check"></i> Замечаний нет</div>';
  var order = { critical: 0, high: 1, medium: 2, low: 3, info: 4, ok: 5 };
  var sorted = findings.slice().sort(function (a, b) { return order[a.sev] - order[b.sev]; });
  return '<div class="findings">' + sorted.map(findingHTML).join('') + '</div>';
}

function scoreCard(score, findings, subtitle) {
  var g = gradeOf(score);
  var counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(function (f) { if (counts[f.sev] != null) counts[f.sev]++; });
  return '<div class="score-card">' +
    '<div class="score-grade g-' + (g === 'A+' ? 'Aplus' : g) + '">' + g + '</div>' +
    '<div class="score-body">' +
      '<div class="score-value mono">' + score + ' / 100</div>' +
      (subtitle ? '<div class="score-sub">' + esc(subtitle) + '</div>' : '') +
      '<div class="score-chips">' +
        ['critical', 'high', 'medium', 'low'].map(function (k) {
          return '<span class="chip ' + k + '">' + SEV[k].label + ' <b>' + counts[k] + '</b></span>';
        }).join('') +
      '</div>' +
      '<div class="score-track"><div class="score-fill g-' + (g === 'A+' ? 'Aplus' : g) + '" style="width:' + score + '%"></div></div>' +
    '</div>' +
  '</div>';
}

function kvTable(rows) {
  return '<div class="kv">' + rows.map(function (r) {
    return '<div class="kv-row"><span class="kv-k">' + esc(r[0]) + '</span><span class="kv-v mono">' + (r[2] ? r[1] : esc(r[1])) + '</span></div>';
  }).join('') + '</div>';
}

function section(title, body, open) {
  return '<details class="acc"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary>' + body + '</details>';
}

/* ======================== ВКЛАДКИ ======================== */

var TOOLS = ['pass', 'dns', 'jwt', 'url', 'hdr', 'html', 'crypto'];
var TOOL_NAMES = { pass: 'Пароли', dns: 'Почта и DNS', jwt: 'JWT', url: 'Ссылки', hdr: 'Заголовки', html: 'HTML-код', crypto: 'Крипто' };

function switchTool(name) {
  if (TOOLS.indexOf(name) === -1) name = 'pass';
  TOOLS.forEach(function (t) {
    var panel = $('tool-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.tool-tab'), function (b) {
    var on = b.dataset.tool === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
    if (on && b.scrollIntoView) {
      try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
    }
  });
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
}

/* ======================== ИСТОРИЯ ======================== */

function saveHistory(tool, label, note) {
  try {
    var list = JSON.parse(localStorage.getItem('cyberscan_hist') || '[]');
    list.unshift({ tool: tool, label: String(label).slice(0, 60), note: note || '', date: Date.now() });
    localStorage.setItem('cyberscan_hist', JSON.stringify(list.slice(0, 12)));
    renderHistory();
  } catch (e) {}
}
function renderHistory() {
  var box = $('historyList');
  if (!box) return;
  var list = [];
  try { list = JSON.parse(localStorage.getItem('cyberscan_hist') || '[]'); } catch (e) {}
  if (!list.length) { box.innerHTML = '<div class="history-empty">Пока пусто</div>'; return; }
  box.innerHTML = list.map(function (i) {
    var d = new Date(i.date);
    return '<div class="history-item" data-tool="' + esc(i.tool) + '">' +
      '<span class="hi-url">' + esc(TOOL_NAMES[i.tool] || i.tool) + ' · ' + esc(i.label) + '</span>' +
      '<span class="hi-meta"><span>' + d.toLocaleDateString('ru-RU') + ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '<span>' + esc(i.note) + '</span></span>' +
    '</div>';
  }).join('');
}

/* ======================== 1. ПАРОЛИ ======================== */

var COMMON_PW = ['123456','password','12345678','qwerty','123456789','12345','1234','111111','1234567','dragon','123123','baseball','abc123','football','monkey','letmein','696969','shadow','master','666666','qwertyuiop','123321','mustang','1234567890','michael','654321','superman','1qaz2wsx','7777777','121212','000000','qazwsx','123qwe','killer','trustno1','jordan','jennifer','zxcvbnm','asdfgh','hunter','buster','soccer','harley','batman','andrew','tigger','sunshine','iloveyou','2000','charlie','robert','thomas','hockey','ranger','daniel','starwars','klaster','112233','george','computer','michelle','jessica','pepper','1111','zxcvbn','555555','11111111','131313','freedom','777777','pass','maggie','159753','aaaaaa','ginger','princess','joshua','cheese','amanda','summer','love','ashley','nicole','chelsea','biteme','matthew','access','yankees','987654321','dallas','austin','thunder','taylor','matrix','admin','admin123','root','toor','letmein123','welcome','welcome1','p@ssw0rd','passw0rd','qwerty123','1q2w3e4r','qazwsxedc','пароль','йцукен','любовь','привет','россия','москва','qwerty1','monkey123','dragon123','master123','super123','qwe123','asd123','123qweasd','poiuytrewq','mnbvcxz','lkjhgfdsa'];

var KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];

function charsets(pw) {
  var n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[^A-Za-z0-9]/.test(pw)) n += 33;
  if (/[а-яё]/i.test(pw)) n += 33;
  return n || 1;
}

function analyzePassword(pw) {
  var r = { len: pw.length, notes: [], penalty: 0 };
  if (!pw) return null;

  var set = charsets(pw);
  var raw = pw.length * Math.log2(set);
  var lower = pw.toLowerCase();

  // Словарные пароли
  var dictHit = COMMON_PW.some(function (c) { return lower === c || lower.indexOf(c) === 0 && lower.length - c.length <= 2; });
  if (dictHit) { r.notes.push(['critical', 'Есть в списке самых частых паролей — подбирается за секунды']); r.penalty += 30; }

  // L33t-замены: p@ssw0rd → password
  var del33t = lower.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');
  if (del33t !== lower && COMMON_PW.some(function (c) { return del33t.indexOf(c) === 0; })) {
    r.notes.push(['high', 'Маскировка символами не помогает: основа всё равно словарная']);
    r.penalty += 18;
  }

  // Повторы
  if (/(.)\1{2,}/.test(pw)) {
    var rep = pw.match(/(.)\1{2,}/g).join('');
    r.notes.push(['medium', 'Повторяющиеся символы (' + rep.slice(0, 8) + ')']);
    r.penalty += 5 + rep.length;
  }
  if (/^(.{1,4})\1+$/.test(pw)) { r.notes.push(['high', 'Пароль состоит из повторённого блока']); r.penalty += 15; }

  // Последовательности и клавиатурные дорожки
  var seqFound = '';
  for (var i = 0; i + 2 < pw.length; i++) {
    var a = pw.charCodeAt(i), b = pw.charCodeAt(i + 1), c = pw.charCodeAt(i + 2);
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) seqFound = pw.slice(i, i + 3);
  }
  if (seqFound) { r.notes.push(['medium', 'Последовательность символов (' + seqFound + ')']); r.penalty += 7; }

  var walk = '';
  KB_ROWS.forEach(function (row) {
    for (var i = 0; i + 2 < lower.length; i++) {
      var frag = lower.slice(i, i + 3);
      if (row.indexOf(frag) !== -1) walk = frag;
    }
  });
  if (walk) { r.notes.push(['medium', 'Клавиатурная дорожка (' + walk + ')']); r.penalty += 7; }

  // Даты и годы
  if (/(19|20)\d{2}/.test(pw)) { r.notes.push(['medium', 'Похоже на год']); r.penalty += 6; }
  if (/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/.test(pw)) { r.notes.push(['medium', 'Похоже на дату']); r.penalty += 8; }
  if (/^\+?\d[\d\s\-()]{8,}$/.test(pw)) { r.notes.push(['high', 'Похоже на номер телефона']); r.penalty += 14; }

  // Русские раскладки/слова
  if (/^[а-яё]+$/i.test(pw) && pw.length < 12) { r.notes.push(['medium', 'Только буквы одного алфавита']); r.penalty += 5; }

  // Однотипность
  if (/^[a-z]+$/.test(pw)) { r.notes.push(['low', 'Только строчные латинские буквы']); r.penalty += 3; }
  if (/^\d+$/.test(pw)) { r.notes.push(['critical', 'Только цифры']); r.penalty += 12; }
  if (pw.length < 8) { r.notes.push(['critical', 'Короче 8 символов']); r.penalty += 12; }
  else if (pw.length < 12) { r.notes.push(['medium', 'Меньше 12 символов']); r.penalty += 5; }

  var bits = Math.max(1, raw - r.penalty);
  r.bits = Math.round(bits);
  r.rawBits = Math.round(raw);
  r.set = set;

  if (dictHit || bits < 28) r.level = 'critical';
  else if (bits < 45) r.level = 'high';
  else if (bits < 65) r.level = 'medium';
  else if (bits < 90) r.level = 'low';
  else r.level = 'ok';

  r.verdict = { critical: 'Взломают сразу', high: 'Очень слабый', medium: 'Слабоват', low: 'Нормальный', ok: 'Стойкий' }[r.level];
  return r;
}

function humanTime(sec) {
  if (sec < 1) return 'мгновенно';
  var u = [['сек', 60], ['мин', 60], ['час', 24], ['дн', 365], ['лет', 1e6]];
  var v = sec, i = 0;
  while (i < u.length - 1 && v >= u[i][1]) { v /= u[i][1]; i++; }
  if (i === 4 && v > 1e6) return '> ' + Math.round(v / 1e6) + ' млн лет';
  if (v > 1000) return Math.round(v).toLocaleString('ru-RU') + ' ' + u[i][0];
  return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ' + u[i][0];
}
function crackRow(bits, rate, label) {
  var guesses = Math.pow(2, bits - 1);
  return '<div class="crack-row"><span>' + label + '</span><span class="mono">' + humanTime(guesses / rate) + '</span></div>';
}

function initPasswords() {
  var input = $('pwInput');
  if (!input) return;

  function render() {
    var r = analyzePassword(input.value);
    var fill = $('pwFill');
    if (!r) {
      fill.style.width = '0%'; fill.className = 'meter-fill';
      $('pwVerdict').textContent = '—'; $('pwEntropy').textContent = '0 бит';
      $('pwMetrics').innerHTML = ''; $('pwCrack').innerHTML = '';
      return;
    }
    var pct = { critical: 12, high: 30, medium: 55, low: 78, ok: 100 }[r.level];
    fill.style.width = pct + '%';
    fill.className = 'meter-fill ' + r.level;
    $('pwVerdict').textContent = r.verdict;
    $('pwEntropy').textContent = r.bits + ' бит энтропии' + (r.penalty ? ' (сырых ' + r.rawBits + ')' : '');

    $('pwMetrics').innerHTML = [
      ['Длина', r.len], ['Алфавит', r.set + ' симв.'], ['Энтропия', r.bits + ' бит'],
      ['Паттернов', r.notes.length]
    ].map(function (m) {
      return '<div class="metric"><span>' + m[0] + '</span><b class="mono">' + m[1] + '</b></div>';
    }).join('');

    $('pwCrack').innerHTML = r.notes.length
      ? '<div class="notes">' + r.notes.map(function (n) {
          return '<div class="note ' + n[0] + '"><i class="fas fa-circle-exclamation"></i> ' + esc(n[1]) + '</div>';
        }).join('') + '</div>'
      : '';

    // Таблица стойкости (перебор без словаря, полный алфавит)
    $('pwCrack').innerHTML += '<div class="crack-grid">' +
      crackRow(r.bits, 1e4, 'Онлайн, 10⁴/сек') +
      crackRow(r.bits, 1e9, 'Своя ферма, 10⁹/сек') +
      crackRow(r.bits, 1e12, 'Кластер GPU, 10¹²/сек') +
      '</div>';
  }

  input.addEventListener('input', render);

  $('pwToggle').addEventListener('click', function () {
    input.type = input.type === 'password' ? 'text' : 'password';
    this.innerHTML = '<i class="fas fa-eye' + (input.type === 'text' ? '-slash' : '') + '"></i>';
  });
  $('pwClear').addEventListener('click', function () {
    input.value = ''; render(); $('pwBreachOut').innerHTML = '';
  });

  // Проверка утечек: k-анонимность, пароль не покидает браузер
  $('pwBreachBtn').addEventListener('click', function () {
    var pw = input.value;
    if (!pw) return toast('Введите пароль');
    var box = $('pwBreachOut');
    box.innerHTML = '<div class="out-note">Считаю SHA-1 и запрашиваю диапазон…</div>';
    digest('SHA-1', pw).then(function (h) {
      var up = h.toUpperCase(), prefix = up.slice(0, 5), suffix = up.slice(5);
      return fetch('https://api.pwnedpasswords.com/range/' + prefix, { headers: { 'Add-Padding': 'true' } })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (txt) {
          var found = 0;
          txt.split('\n').forEach(function (line) {
            var p = line.trim().split(':');
            if (p[0] === suffix) found = parseInt(p[1], 10) || 0;
          });
          if (found) {
            var n = found.toLocaleString('ru-RU');
            box.innerHTML = '<div class="finding critical"><div class="f-head"><span class="f-title">Пароль найден в утечках: ' + n + ' раз</span>' +
              '<span class="f-sev critical">КРИТИЧНО</span></div>' +
              '<div class="f-desc">Этот пароль есть в публичных базах. Он скомпрометирован навсегда — его нельзя использовать нигде, даже с «дописанными» символами.</div>' +
              '<div class="f-fix"><i class="fas fa-wrench"></i> Смени пароль везде, где он использовался, и включи двухфакторную аутентификацию.</div></div>';
          } else {
            box.innerHTML = '<div class="finding ok"><div class="f-head"><span class="f-title">В публичных утечках не найден</span>' +
              '<span class="f-sev ok">ОК</span></div>' +
              '<div class="f-desc">Проверено по базе Pwned Passwords. В браузер ушли только первые 5 символов SHA-1-хеша — сам пароль не передавался.</div></div>';
          }
          saveHistory('pass', 'проверка утечки', found ? 'скомпрометирован' : 'чисто');
        });
    }).catch(function () {
      box.innerHTML = '<div class="out-note">Не удалось связаться с api.pwnedpasswords.com. Локальный анализ выше всё равно работает.</div>';
    });
  });

  // Генератор
  ['genLen', 'genWords'].forEach(function (id) {
    var r = $(id), o = $(id + 'Val');
    if (r && o) r.addEventListener('input', function () { o.textContent = r.value; });
  });

  $('genBtn').addEventListener('click', function () {
    var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower = 'abcdefghijklmnopqrstuvwxyz',
        digits = '0123456789', syms = '!@#$%^&*()-_=+[]{};:,.?/';
    var amb = 'lI1O0oB8S5Z2';
    var pools = [];
    if ($('genUpper').checked) pools.push(upper);
    if ($('genLower').checked) pools.push(lower);
    if ($('genDigits').checked) pools.push(digits);
    if ($('genSymbols').checked) pools.push(syms);
    if (!pools.length) return toast('Выберите хотя бы один набор символов');

    if ($('genNoAmb').checked) {
      pools = pools.map(function (p) {
        return p.split('').filter(function (c) { return amb.indexOf(c) === -1; }).join('');
      }).filter(function (p) { return p.length; });
      if (!pools.length) return toast('После исключения похожих символов ничего не осталось');
    }

    var len = parseInt($('genLen').value, 10);
    var all = pools.join('');
    var outArr = [];
    // Гарантируем по одному символу из каждого выбранного набора
    pools.forEach(function (p) { outArr.push(p[randInt(p.length)]); });
    while (outArr.length < len) outArr.push(all[randInt(all.length)]);
    // Перемешивание Фишера—Йетса на криптослучайных числах
    for (var i = outArr.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = outArr[i]; outArr[i] = outArr[j]; outArr[j] = t;
    }
    var pw = outArr.slice(0, len).join('');
    $('genOut').textContent = pw;
    var bits = Math.round(len * Math.log2(all.length));
    $('genEntropy').textContent = 'Энтропия: ' + bits + ' бит · алфавит ' + all.length + ' символов · подбор: ' + humanTime(Math.pow(2, bits - 1) / 1e12) + ' на кластере GPU';
    saveHistory('pass', 'генератор', bits + ' бит');
  });
  $('genCopy').addEventListener('click', function () { copyText($('genOut').textContent, 'Пароль скопирован'); });

  var WORDS = ('атом банк бард база берег бетон билет бинокль блок бобр борт бранд брат бренд бункер буран вал ветер вечер вихрь волк ворон вузл выбор газон гайка гамма гвоздь гейзер герб глина глубина гнездо гном город гора гребень гриб гроза груз грунт дверь дельта диск дом дрейф друг дым ёж жезл жемчуг жираф журнал забор залп замок запад заряд звезда зверь звено зебра земля знак зонт зубр игла игра идеал икра импульс искра кабан кадр камень канал капля карман катер квадрат кедр кекс кит клин ключ книга кобра ковёр код кокос колба компас конус копия корень короб кот краб крем купол курс лагерь лампа лапа лебедь лёд лента лес лимон линия лиса лист лодка лось луч лыжи магма макет молот море мост мотор мыс мяч насос небо нектар нерпа нить нож нос нота нырок облако обрыв овраг огонь олень орёл осёл остров отель очаг пазл палец панда паром парус паста паук пекарь пенал песок печать пик пилот пират плита плот поберег вода пояс пруд пчела пыль радио ракета ранец ребро река рельеф рис робот рог роза рубин рукав рупор рыба рыцарь сад салют сани сапог свеча свист север сетка сигнал сироп скала сквер скит слон смена снег сова сокол солнце сорт сопка сосна спорт стена степь стиль стол стоп стриж судно сурок схема сыр тайга танец таран тень тигр ткань торт точка трава трюм туман туча тыква узел улей улитка утёс утро ухо факел фара феникс ферма фикус фильм финиш флаг флейта фонтан форма фрегат фрукт фугас халва холм хребет цветок цирк цифра чайка час чашка шарф шахта шкаф шлем шнур шпиль штора щит экипаж эскиз эфир юг юнга яблоко якорь яма ястреб').split(' ');

  function buildPassphrase() {
    var n = parseInt($('genWords').value, 10);
    var sep = $('genSep').value || '-';
    var words = [];
    for (var i = 0; i < n; i++) {
      var w = shufflePick(WORDS);
      if ($('genCap').checked) w = w.charAt(0).toUpperCase() + w.slice(1);
      words.push(w);
    }
    if ($('genDigit').checked) words[randInt(words.length)] += String(randInt(100));
    return words.join(sep);
  }

  $('genPassBtn').addEventListener('click', function () {
    var ph = buildPassphrase();
    $('genPassOut').textContent = ph;
    var bits = Math.round(parseInt($('genWords').value, 10) * Math.log2(WORDS.length)) + ($('genDigit').checked ? 6 : 0);
    $('genEntropy').textContent = 'Энтропия: ' + bits + ' бит · словарь ' + WORDS.length + ' слов';
  });
  $('genPassCopy').addEventListener('click', function () { copyText($('genPassOut').textContent, 'Фраза скопирована'); });
}

/* ======================== 2. DNS И ПОЧТА ======================== */

// Приводим ввод к домену: e-mail → часть после @, ссылка → хост, IDN → punycode
function normDomain(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');  // схема
  s = s.split(/[\/?#\s]/)[0];                    // путь, запрос, хэш
  s = s.split('@').pop();                        // из e-mail берём домен
  s = s.replace(/\.$/, '');                      // корневая точка
  if (!s || s.indexOf('.') === -1) return '';
  try {
    var host = new URL('http://' + s).hostname;  // отсекает порт, IDN → punycode
    return host.indexOf('.') === -1 ? '' : host;
  } catch (e) { return ''; }
}

function dnsQuery(name, type) {
  var url = 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type + '&ct=application/dns-json';
  return fetch(url, { headers: { accept: 'application/dns-json' } })
    .then(function (r) { if (!r.ok) throw new Error('DNS HTTP ' + r.status); return r.json(); })
    .catch(function () {
      return fetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type)
        .then(function (r) { if (!r.ok) throw new Error('DNS HTTP ' + r.status); return r.json(); });
    });
}

function txtOf(json) {
  return (json.Answer || [])
    .filter(function (a) { return a.type === 16; })
    .map(function (a) { return String(a.data).replace(/^"|"$/g, '').replace(/""/g, '').replace(/"/g, ''); });
}
function dataOf(json, type) {
  return (json.Answer || []).filter(function (a) { return a.type === type; }).map(function (a) { return a.data; });
}

var MAIL_PROVIDERS = [
  ['google', 'Google Workspace'], ['_spf.google.com', 'Google Workspace'], ['outlook', 'Microsoft 365'],
  ['spf.protection.outlook.com', 'Microsoft 365'], ['sendgrid', 'SendGrid'], ['mailgun', 'Mailgun'],
  ['mandrill', 'Mandrill'], ['amazonses', 'Amazon SES'], ['spf.mail.ru', 'Mail.ru'],
  ['yandex', 'Яндекс'], ['zoho', 'Zoho'], ['mailchimp', 'Mailchimp'], ['postmark', 'Postmark'],
  ['sparkpost', 'SparkPost'], ['hubspot', 'HubSpot'], ['salesforce', 'Salesforce'],
  ['freshdesk', 'Freshdesk'], ['helpscout', 'Help Scout'], ['unisender', 'UniSender'],
  ['mailopost', 'Mailopost'], ['smtp2go', 'SMTP2GO'], ['brevo', 'Brevo'], ['sendinblue', 'Brevo']
];

function analyzeSPF(records, domain) {
  var out = { findings: [], record: records[0] || '', includes: [], lookups: 0 };
  if (!records.length) {
    out.findings.push({ sev: 'critical', title: 'SPF не настроен', desc: 'Любой сервер может отправлять письма от имени ' + domain + '.', fix: 'Добавьте TXT: v=spf1 include:<ваш-провайдер> -all' });
    return Promise.resolve(out);
  }
  if (records.length > 1) {
    out.findings.push({ sev: 'critical', title: 'Несколько SPF-записей', desc: 'По RFC 7208 допускается ровно одна запись v=spf1. При двух и более проверка ломается целиком.', fix: 'Объедините механизмы в одну TXT-запись.' });
  }
  var rec = out.record;
  var lower = rec.toLowerCase();
  var hasRedirect = /(?:^|\s)redirect=[a-z0-9._-]+/.test(lower);
  var mAll = lower.match(/(?:^|\s)([~\-?+]?)all(?:\s|$)/);
  var qual = mAll ? (mAll[1] || '+') : null;   // без квалификатора all = +all

  if (!/v=spf1/.test(lower)) out.findings.push({ sev: 'high', title: 'Запись не начинается с v=spf1', desc: rec.slice(0, 80), fix: 'Приведите запись к виду v=spf1 ... -all' });

  if (hasRedirect) {
    // RFC 7208: при redirect= механизм all в этой записи не используется
    if (mAll) out.findings.push({ sev: 'info', title: 'all в записи с redirect= не работает', desc: 'По RFC 7208 при наличии redirect= механизм all из этой же записи игнорируется — политику определяет перенаправленная запись.', fix: 'Уберите all, оставьте только redirect=.' });
  } else if (!qual) {
    out.findings.push({ sev: 'high', title: 'Нет механизма all', desc: 'Без all неясно, что делать с письмами из неизвестных источников.', fix: 'Добавьте -all в конец записи.' });
  } else if (qual === '+') {
    out.findings.push({ sev: 'critical', title: '+all разрешает отправку всем', desc: 'Механизм all без квалификатора означает «разрешить любому хосту в интернете».', fix: 'Замените на -all.' });
  } else if (qual === '?') {
    out.findings.push({ sev: 'high', title: '?all — нейтральный результат', desc: 'Спам-фильтры не могут отличить ваши письма от поддельных.', fix: 'Замените на -all.' });
  } else if (qual === '~') {
    out.findings.push({ sev: 'medium', title: '~all — мягкий отказ', desc: 'Письма с чужих серверов попадают в спам, а не отбрасываются.', fix: 'После проверки всех отправителей перейдите на -all.' });
  } else if (qual === '-') {
    out.findings.push({ sev: 'ok', title: '-all настроен верно' });
  }

  // Число DNS-запросов считаем рекурсивно (см. spfWalk ниже) — для лимита RFC 7208
  out.lookups = (lower.match(/(?:^|\s)(include:|a(?::|\s|$)|mx(?::|\s|$)|ptr(?::|\s|$)|exists:|redirect=)/g) || []).length;

  if (/ptr(?::|\s|$)/.test(lower)) out.findings.push({ sev: 'medium', title: 'Механизм ptr', desc: 'Не рекомендуется RFC 7208: медленный и ненадёжный.', fix: 'Замените на ip4/ip6 или include.' });

  (lower.match(/include:[a-z0-9._-]+/g) || []).forEach(function (inc) {
    var d = inc.slice(8);
    out.includes.push(d);
    MAIL_PROVIDERS.forEach(function (m) { if (d.indexOf(m[0]) !== -1) out.providers = out.providers || [], out.providers.push(m[1]); });
  });

  // Рекурсивный обход по RFC 7208: считаем все DNS-запросы дерева include/redirect
  // и «пустые» (void) — те, что не вернули данных. Лимит RFC: 10 запросов и 2 пустых.
  var walk = { count: 0, voids: 0, seen: {}, extra: [] };
  function spfWalk(record, depth) {
    var l = String(record).toLowerCase();
    walk.count += (l.match(/(?:^|\s)(include:|a(?::|\s|$)|mx(?::|\s|$)|ptr(?::|\s|$)|exists:|redirect=)/g) || []).length;
    if (depth > 4) return Promise.resolve();
    var jobs = [];
    function follow(name, isInclude) {
      if (!name || walk.seen[name]) return;
      walk.seen[name] = 1;
      jobs.push(dnsQuery(name, 'TXT').then(function (j) {
        var t = txtOf(j).filter(function (x) { return /^v=spf1/i.test(x); })[0];
        if (!t) {
          walk.voids++;
          if (isInclude) walk.extra.push({ sev: 'high', title: 'Битый include: ' + name, desc: 'Домен в include не публикует SPF-запись: это потерянный DNS-запрос и потерянная авторизация одновременно.', fix: 'Удалите include:' + name });
          return;
        }
        return spfWalk(t, depth + 1);
      }).catch(function () { walk.voids++; }));
    }
    (l.match(/include:([a-z0-9._-]+)/g) || []).forEach(function (m) { follow(m.slice(8), true); });
    follow((l.match(/redirect=([a-z0-9._-]+)/) || [])[1], false);
    return Promise.all(jobs);
  }

  var checks = [];

  // redirect=: конечная политика берётся из перенаправленной записи
  var redirectDomain = (lower.match(/(?:^|\s)redirect=([a-z0-9._-]+)/) || [])[1];
  if (redirectDomain) {
    out.redirect = redirectDomain;
    MAIL_PROVIDERS.forEach(function (m) { if (redirectDomain.indexOf(m[0]) !== -1) out.providers = out.providers || [], out.providers.push(m[1]); });
    out.lookups++;
    checks.push(dnsQuery(redirectDomain, 'TXT').then(function (j) {
      var target = txtOf(j).filter(function (t) { return /^v=spf1/i.test(t); })[0];
      if (!target) {
        out.findings.push({ sev: 'critical', title: 'Битый redirect: ' + redirectDomain, desc: 'Домен в redirect не публикует SPF — проверка ломается целиком.', fix: 'Исправьте redirect или замените на include:' + redirectDomain });
        return;
      }
      var tm = target.toLowerCase().match(/(?:^|\s)([~\-?+]?)all(?:\s|$)/);
      var q = tm ? (tm[1] || '+') : null;
      var shown = q === '-' ? '-all (отказ)' : q === '~' ? '~all (мягкий отказ)' : q === '?' ? '?all (нейтрально)' : q === '+' ? '+all (разрешено всем)' : 'механизма all нет';
      var src = ' Конечная политика берётся из ' + redirectDomain + ': ' + shown + '.';
      if (q === '-') out.findings.push({ sev: 'ok', title: 'Политика из redirect: -all', desc: src.trim() });
      else if (q === '~') out.findings.push({ sev: 'medium', title: 'Политика из redirect: ~all', desc: src.trim(), fix: 'Перейдите на -all в ' + redirectDomain + ' после проверки всех отправителей.' });
      else if (q === '?') out.findings.push({ sev: 'high', title: 'Политика из redirect: ?all', desc: src.trim(), fix: 'Замените на -all в ' + redirectDomain + '.' });
      else out.findings.push({ sev: 'critical', title: 'Политика из redirect разрешает всем', desc: src.trim(), fix: 'Замените на -all в ' + redirectDomain + '.' });
    }).catch(function () {}));
  }

  return spfWalk(rec, 0).then(function () {
    out.lookups = walk.count;
    out.voids = walk.voids;
    walk.extra.forEach(function (x) { out.findings.push(x); });

    if (out.lookups > 10) {
      out.findings.push({ sev: 'high', title: 'Лимит DNS-запросов превышен (' + out.lookups + ' из 10)', desc: 'RFC 7208 разрешает не больше 10 DNS-запросов на проверку, включая вложенные include и redirect. При превышении SPF возвращает PermError — защита выключается целиком.', fix: 'Сократите число include или примените SPF flattening.' });
    } else if (out.lookups > 7) {
      out.findings.push({ sev: 'medium', title: 'Близко к лимиту 10 DNS-запросов (' + out.lookups + ')', desc: 'Запас заканчивается: ещё один сервис — и SPF сломается.', fix: 'Держите число include под контролем.' });
    } else if (out.lookups) {
      out.findings.push({ sev: 'ok', title: 'DNS-запросов в SPF: ' + out.lookups + ' из 10' });
    }

    if (walk.voids > 2) {
      out.findings.push({ sev: 'high', title: 'Пустых DNS-запросов ' + walk.voids + ' (лимит 2)', desc: 'Void lookups — include или redirect, не вернувшие SPF-запись. RFC 7208 разрешает максимум два, дальше проверка падает с PermError.', fix: 'Удалите мёртвые include — обычно это забытые сервисы.' });
    } else if (walk.voids > 0) {
      out.findings.push({ sev: 'low', title: 'Пустых DNS-запросов: ' + walk.voids + ' (лимит 2)', desc: 'Столько include или redirect не вернули SPF-запись — это расходует бюджет запросов впустую.' });
    }

    return Promise.all(checks);
  }).then(function () {
    if (out.providers && out.providers.length) {
      out.providers = out.providers.filter(function (v, i, a) { return a.indexOf(v) === i; });
    }
    return out;
  });
}

function analyzeDMARC(records, domain) {
  var f = [];
  if (!records.length) {
    return Promise.resolve({
      findings: [{ sev: 'critical', title: 'DMARC отсутствует', desc: 'Нет записи _dmarc.' + domain + '. Получатели не знают, что делать с письмами, не прошедшими SPF/DKIM, — можно свободно подделывать домен.', fix: 'Создайте TXT _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@' + domain + ' — затем усильте до p=quarantine → p=reject.' }],
      record: ''
    });
  }
  // wildcard-TXT в зоне может подсунуть сюда что угодно — проверяем, что это вообще DMARC
  if (!/^v=dmarc1/i.test(String(records[0]).trim())) {
    return Promise.resolve({
      findings: [{ sev: 'high', title: 'Запись _dmarc.' + domain + ' не является DMARC', desc: 'Ожидался v=DMARC1, а вернулось: ' + String(records[0]).slice(0, 100) + '. Обычно это wildcard-TXT в зоне, а не политика.', fix: 'Опубликуйте отдельную TXT _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@' + domain }],
      record: records[0]
    });
  }
  var rec = records[0], l = rec.toLowerCase(), tags = {};
  rec.split(';').forEach(function (p) {
    var kv = p.split('=');
    if (kv.length === 2) tags[kv[0].trim().toLowerCase()] = kv[1].trim();
  });

  if (Object.keys(tags)[0] !== 'v') f.push({ sev: 'medium', title: 'Тег v=DMARC1 не первый', desc: 'По RFC 7489 первым тегом должен идти v=DMARC1.', fix: 'Переставьте v=DMARC1 в начало.' });

  if (tags.p === 'none') f.push({ sev: 'high', title: 'p=none — только мониторинг', desc: 'Политика не защищает: поддельные письма доставляются как обычно.', fix: 'После сбора отчётов перейдите на p=quarantine, затем p=reject.' });
  else if (tags.p === 'quarantine') f.push({ sev: 'medium', title: 'p=quarantine — в спам', desc: 'Работает, но часть подделок всё ещё доходит до ящика.', fix: 'Перейдите на p=reject.' });
  else if (tags.p === 'reject') f.push({ sev: 'ok', title: 'p=reject — максимальная защита' });
  else if (!tags.p) f.push({ sev: 'critical', title: 'Нет тега p', desc: 'Без политики запись бессмысленна.', fix: 'Добавьте p=reject.' });

  if (tags.pct && parseInt(tags.pct, 10) < 100) f.push({ sev: 'medium', title: 'pct=' + tags.pct, desc: 'Политика применяется не ко всем письмам.', fix: 'Установите pct=100 или уберите тег.' });
  if (!tags.rua) f.push({ sev: 'low', title: 'Нет rua — отчёты не собираются', desc: 'Без агрегированных отчётов не видно, кто подделывает домен.', fix: 'Добавьте rua=mailto:dmarc@' + domain });
  if (!tags.sp && tags.p === 'reject') f.push({ sev: 'low', title: 'Нет sp для поддоменов', desc: 'Поддомены наследуют p, но лучше задать явно.', fix: 'Добавьте sp=reject.' });
  if (tags.adkim === 'r' && tags.aspf === 'r') f.push({ sev: 'low', title: 'Relaxed-выравнивание', desc: 'Разрешает совпадение поддоменов — чуть слабее strict.', fix: 'Для строгой проверки: adkim=s; aspf=s.' });

  return Promise.resolve({ findings: f, record: rec });
}

function analyzeDKIM(items, domain) {
  var f = [];
  var found = [];
  var wildcard = [];
  items.forEach(function (it) {
    if (!it.records.length) return;
    var rec = it.records.join(' ');
    var l = rec.toLowerCase();
    // wildcard-TXT в зоне отдаёт SPF по любому имени — это не DKIM
    if (/^v=spf1/i.test(l.trim())) { wildcard.push(it.selector); return; }
    var sel = it.selector;
    if (/p=\s*(;|$)/.test(l)) {
      f.push({ sev: 'critical', title: 'Ключ отозван: ' + sel, desc: 'Запись ' + sel + '._domainkey содержит пустой p= — подпись этим селектором отключена.', fix: 'Либо удалите запись, либо опубликуйте действующий ключ.' });
      return;
    }
    if (!/v=dkim1/.test(l)) f.push({ sev: 'medium', title: 'Нет v=DKIM1 в селекторе ' + sel, desc: rec.slice(0, 60), fix: 'Приведите запись к виду v=DKIM1; k=rsa; p=...' });
    if (/t=y/.test(l)) f.push({ sev: 'medium', title: 'Селектор ' + sel + ' в тестовом режиме (t=y)', desc: 'Получатели могут игнорировать подпись.', fix: 'Уберите t=y после проверки.' });
    var key = (l.match(/p=([a-z0-9+/=]+)/) || [])[1] || '';
    var bits = Math.round(key.length * 6 / 8 * 8);
    if (key && bits && bits < 1024) f.push({ sev: 'high', title: 'Короткий ключ DKIM (' + sel + ')', desc: 'Оценочная длина ключа ~' + bits + ' бит.', fix: 'Используйте RSA 2048 бит или ed25519.' });
    found.push({ selector: sel, record: rec, key: key ? (key.length * 6 / 8 * 8) + ' бит' : '—' });
  });
  if (found.length) f.push({ sev: 'ok', title: 'DKIM найден: ' + found.map(function (x) { return x.selector; }).join(', ') });
  else {
    var checked = items.map(function (i) { return i.selector; }).filter(function (s) { return wildcard.indexOf(s) === -1; });
    f.push({ sev: 'medium', title: 'DKIM не найден по проверенным селекторам', desc: 'Проверены: ' + checked.join(', ') + '. DKIM может быть настроен на селекторе, которого нет в списке — уточните его у почтового провайдера.', fix: 'Добавьте селектор в поле выше или настройте DKIM у провайдера.' });
  }
  if (wildcard.length) f.push({ sev: 'info', title: 'В зоне есть wildcard-TXT', desc: 'Имена ' + wildcard.slice(0, 3).join(', ') + ' вернули SPF-запись вместо DKIM — значит в зоне опубликован wildcard TXT (*.' + domain + '). Из-за него любой несуществующий поддомен отдаёт SPF, и записи, которых нет, выглядят как существующие.', fix: 'Проверьте wildcard-TXT в зоне: он маскирует отсутствующие записи DMARC, DKIM, BIMI.' });
  return { findings: f, found: found };
}

function initDNS() {
  var btn = $('dnsBtn');
  if (!btn) return;

  $('dnsSample').addEventListener('click', function () {
    $('dnsDomain').value = 'github.com';
    $('dnsSelectors').value = '';
    $('dnsBtn').click();
  });

  btn.addEventListener('click', function () {
    var domain = normDomain($('dnsDomain').value);
    if (!domain) return toast('Нужен домен: example.com. Можно вставить e-mail или ссылку — домен возьму сам.');
    $('dnsDomain').value = domain;
    var box = $('dnsOut');
    box.innerHTML = '<div class="card"><div class="out-note">Опрашиваю DNS…</div></div>';
    btn.disabled = true;

    var customSel = ($('dnsSelectors').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var selectors = ['default', 'google', 'selector1', 'selector2', 's1', 's2', 'k1', 'k2', 'mail', 'dkim', 'mandrill', 'zoho'].concat(customSel);
    selectors = selectors.filter(function (s, i, a) { return a.indexOf(s) === i; }).slice(0, 18);

    var jobs = {
      txt: dnsQuery(domain, 'TXT'),
      mx: dnsQuery(domain, 'MX'),
      ns: dnsQuery(domain, 'NS'),
      a: dnsQuery(domain, 'A'),
      caa: dnsQuery(domain, 'CAA'),
      dmarc: dnsQuery('_dmarc.' + domain, 'TXT'),
      tlsrpt: dnsQuery('_smtp._tls.' + domain, 'TXT'),
      mta: dnsQuery('_mta-sts.' + domain, 'TXT'),
      bimi: dnsQuery('default._bimi.' + domain, 'TXT'),
      dkim: Promise.all(selectors.map(function (s) {
        return dnsQuery(s + '._domainkey.' + domain, 'TXT')
          .then(function (j) { return { selector: s, records: txtOf(j) }; })
          .catch(function () { return { selector: s, records: [] }; });
      }))
    };

    var failed = [];
    Object.keys(jobs).forEach(function (k) {
      if (k === 'dkim') return;
      jobs[k] = jobs[k].catch(function () { failed.push(k); return {}; });
    });

    Promise.all(Object.keys(jobs).map(function (k) { return jobs[k]; })).then(function (vals) {
      var res = {};
      Object.keys(jobs).forEach(function (k, i) { res[k] = vals[i]; });

      // NXDOMAIN: домена нет — не выдаём стену «критично» по каждой записи
      if ((res.a && res.a.Status === 3) || (res.txt && res.txt.Status === 3 && res.ns && res.ns.Status === 3)) {
        box.innerHTML = '<div class="card"><h3 class="card-title">Домен не существует</h3>' +
          '<div class="out-note">DNS вернул NXDOMAIN для <b>' + esc(domain) + '</b> — такой зоны нет, поэтому SPF, DMARC и MX «не найдены» здесь ничего не значат. ' +
          'Проверьте написание домена; если вставляли e-mail — нужна часть после @.</div></div>';
        btn.disabled = false;
        return;
      }

      var spfRecs = txtOf(res.txt || {}).filter(function (t) { return /^v=spf1/i.test(t); });
      var domainTxts = txtOf(res.txt || {}).filter(function (t) { return !/^v=spf1/i.test(t); });

      Promise.all([
        analyzeSPF(spfRecs, domain),
        analyzeDMARC(txtOf(res.dmarc || {}), domain)
      ]).then(function (r) {
        var spf = r[0], dmarc = r[1];
        var dkim = analyzeDKIM(res.dkim || [], domain);

        var findings = [].concat(spf.findings, dmarc.findings, dkim.findings);

        var mx = dataOf(res.mx || {}, 15);
        var ns = dataOf(res.ns || {}, 2);
        var a = dataOf(res.a || {}, 1);
        var caa = (res.caa && res.caa.Answer) || [];

        if (!mx.length) findings.push({ sev: 'high', title: 'Нет MX-записей', desc: 'Домен не принимает почту, но с него могут отправлять письма.', fix: 'Если почта не нужна — оставьте как есть и держите SPF -all. Если нужна — настройте MX.' });
        else findings.push({ sev: 'ok', title: 'MX настроен (' + mx.length + ')' });

        if (!caa.length) {
          findings.push({ sev: 'medium', title: 'Нет CAA — любой центр может выдать сертификат', desc: 'Без CAA ограничение на выпуск сертификатов для домена отсутствует.', fix: 'Добавьте CAA: 0 issue "letsencrypt.org"' });
        } else {
          findings.push({ sev: 'ok', title: 'CAA настроен', desc: caa.map(function (c) { return c.data; }).join(' | ') });
        }

        if (res.a && res.a.AD === true) findings.push({ sev: 'ok', title: 'DNSSEC подтверждён (AD)' });
        else findings.push({ sev: 'medium', title: 'DNSSEC не подтверждён', desc: 'Ответ не помечен как защищённый — возможна подмена DNS-ответов.', fix: 'Включите DNSSEC у регистратора и в DNS-провайдере.' });

        var tlsrpt = txtOf(res.tlsrpt || {});
        if (tlsrpt.length) findings.push({ sev: 'ok', title: 'TLS-RPT настроен' });
        else findings.push({ sev: 'low', title: 'TLS-RPT отсутствует', desc: 'Вы не получаете отчёты о проблемах с TLS при доставке почты.', fix: 'TXT _smtp._tls: v=TLSRPTv1; rua=mailto:tls@' + domain });

        var mta = txtOf(res.mta || {});
        if (mta.length) findings.push({ sev: 'info', title: 'MTA-STS заявлен', desc: 'TXT: ' + mta.join(' ') + '. Режим политики (none / testing / enforce) лежит в файле https://mta-sts.' + domain + '/.well-known/mta-sts.txt — из браузера он не читается (нет CORS), проверьте: curl -s https://mta-sts.' + domain + '/.well-known/mta-sts.txt' });
        else findings.push({ sev: 'medium', title: 'MTA-STS отсутствует', desc: 'Без него доставка по TLS не гарантируется — возможна атака downgrade.', fix: 'Настройте MTA-STS: TXT _mta-sts + файл политики, режим enforce.' });

        var bimi = txtOf(res.bimi || {});
        var bimiRec = bimi.filter(function (t) { return /^v=bimi1/i.test(t.trim()); })[0];
        if (bimiRec) findings.push({ sev: 'info', title: 'BIMI настроен', desc: bimiRec.slice(0, 140) });
        else if (bimi.length) findings.push({ sev: 'info', title: 'BIMI не настроен (имя отдаёт чужую запись)', desc: 'Запрос default._bimi.' + domain + ' вернул «' + bimi[0].slice(0, 80) + '» вместо v=BIMI1 — это wildcard-TXT в зоне.', fix: 'BIMI не обязателен. Если нужен — опубликуйте TXT default._bimi: v=BIMI1; l=https://…/logo.svg' });

        var score = scoreOf(findings);
        var okCount = findings.filter(function (f) { return f.sev === 'ok'; }).length;

        box.innerHTML =
          scoreCard(score, findings, domain + ' · ' + okCount + ' проверок пройдено') +

          '<div class="card">' +
            '<h3 class="card-title">Почтовая защита</h3>' +
            kvTable([['SPF', spf.record || '— отсутствует —', true]]
              .concat(spf.redirect ? [['SPF redirect', spf.redirect, true]] : [])
              .concat([
                ['DNS-запросов в SPF', spf.lookups + ' / 10', true],
                ['Пустых (void) запросов', (spf.voids || 0) + ' / 2', true],
                ['Провайдеры', (spf.providers || []).join(', ') || '—', true],
                ['DMARC', dmarc.record || '— отсутствует —', true],
                ['DKIM-селекторы', dkim.found.length ? dkim.found.map(function (x) { return x.selector + ' (' + x.key + ')'; }).join(', ') : '— не найдены —', true]
              ])) +
          '</div>' +

          '<div class="card">' +
            '<h3 class="card-title">Зоны и записи</h3>' +
            kvTable([
              ['A', a.join(', ') || '—', true],
              ['MX', mx.join(', ') || '—', true],
              ['NS', ns.join(', ') || '—', true],
              ['CAA', caa.length ? caa.map(function (c) { return c.data; }).join(', ') : '— нет —', true],
              ['TXT (прочие)', domainTxts.length ? domainTxts.map(function (t) { return t.slice(0, 90); }).join('  ·  ') : '—', true]
            ]) +
          '</div>' +

          '<div class="card"><h3 class="card-title">Находки</h3>' + findingsBlock(findings) + '</div>' +
          (failed.length ? '<div class="out-note">Не ответили запросы: ' + failed.join(', ') + '</div>' : '');

        saveHistory('dns', domain, 'оценка ' + score);
        btn.disabled = false;
      });
    }).catch(function (e) {
      box.innerHTML = '<div class="card"><div class="out-note">Ошибка DNS-запроса: ' + esc(e.message || e) + '</div></div>';
      btn.disabled = false;
    });
  });
}

/* ======================== 3. JWT ======================== */

function decodeJwt(token) {
  var parts = String(token).trim().replace(/\s+/g, '').split('.');
  if (parts.length < 2) throw new Error('Токен должен содержать минимум две части через точку');
  var head = JSON.parse(b64urlToStr(parts[0]));
  var body = JSON.parse(b64urlToStr(parts[1]));
  return { parts: parts, header: head, payload: body, sig: parts[2] || '' };
}

function auditJwt(j) {
  var f = [];
  var h = j.header || {}, p = j.payload || {};
  var alg = h.alg || '(нет)';
  var now = Math.floor(Date.now() / 1000);

  if (String(alg).toLowerCase() === 'none') f.push({ sev: 'critical', title: 'alg: none — подпись отсутствует', desc: 'Токен можно подделать, просто отредактировав payload.', fix: 'На сервере запретите alg=none белым списком алгоритмов.' });

  if (/^HS/i.test(alg) && h.kid) f.push({ sev: 'medium', title: 'HMAC + kid', desc: 'Если сервер подставляет по kid публичный ключ RSA, возможна подмена алгоритма на HS256 и подпись этим ключом как секретом.', fix: 'Проверяйте, что тип ключа соответствует алгоритму.' });

  if (h.jku) f.push({ sev: 'critical', title: 'Заголовок jku — подстановка ключа', desc: 'jku указывает на внешний адрес с ключами: ' + h.jku + '. Сервер, который ему доверяет, примет ключ атакующего.', fix: 'Запретите jku, используйте локальный набор ключей.' });
  if (h.x5u) f.push({ sev: 'critical', title: 'Заголовок x5u — подстановка сертификата', desc: 'x5u: ' + h.x5u, fix: 'Отключите x5u.' });
  if (h.jwk) f.push({ sev: 'high', title: 'Ключ встроен в заголовок (jwk)', desc: 'Токен сам приносит свой ключ — проверка подписи теряет смысл.', fix: 'Игнорируйте встроенный jwk.' });
  if (h.crit) f.push({ sev: 'medium', title: 'Заголовок crit', desc: 'Требует понимания расширений: ' + JSON.stringify(h.crit), fix: 'Убедитесь, что все перечисленные расширения действительно обрабатываются.' });

  if (!p.exp) f.push({ sev: 'high', title: 'Нет срока действия (exp)', desc: 'Украденный токен действует вечно.', fix: 'Добавьте exp — разумно 15 минут для access-токена.' });
  else if (p.exp < now) f.push({ sev: 'info', title: 'Токен истёк', desc: 'Истёк ' + new Date(p.exp * 1000).toLocaleString('ru-RU') + ' — это нормально для старого токена.' });
  else {
    var life = p.exp - (p.iat || now);
    if (life > 86400) f.push({ sev: 'medium', title: 'Слишком долгий срок жизни (' + Math.round(life / 3600) + ' ч)', desc: 'Долгоживущий токен нельзя отозвать.', fix: 'Access-токен на 5–30 минут + refresh-токен.' });
    else f.push({ sev: 'ok', title: 'Срок действия задан (' + Math.round(life / 60) + ' мин)' });
  }

  if (!p.iat) f.push({ sev: 'low', title: 'Нет iat — времени выпуска', fix: 'Добавьте iat.' });
  if (p.nbf && p.nbf > now + 60) f.push({ sev: 'medium', title: 'nbf в будущем', desc: 'Токен ещё не действителен.' });
  if (!p.iss) f.push({ sev: 'low', title: 'Нет iss — издателя', fix: 'Укажите iss и проверяйте его на сервере.' });
  if (!p.aud) f.push({ sev: 'medium', title: 'Нет aud — получателя', desc: 'Токен, выпущенный для одного сервиса, принимается любым другим.', fix: 'Добавьте aud и проверяйте его.' });

  var sensitive = ['password', 'passwd', 'secret', 'api_key', 'apikey', 'private_key', 'ssn', 'card', 'cvv', 'token', 'session'];
  var leaks = Object.keys(p).filter(function (k) { return sensitive.indexOf(k.toLowerCase()) !== -1; });
  if (leaks.length) f.push({ sev: 'critical', title: 'В payload чувствительные поля', desc: 'Payload закодирован, а не зашифрован: любой может его прочитать. Найдено: ' + leaks.join(', ') + '.', fix: 'Не кладите секреты в JWT.' });

  var size = JSON.stringify(p).length;
  if (size > 2048) f.push({ sev: 'low', title: 'Большой payload (' + size + ' байт)', desc: 'Токен уходит в каждый запрос — лишний трафик.', fix: 'Храните данные на сервере, в токене держите идентификатор.' });

  if (j.parts.length === 2) f.push({ sev: 'high', title: 'У токена нет подписи', desc: 'Всего две части — подпись отсутствует.', fix: 'Выпускайте подписанные токены.' });

  if (alg && !/^(HS256|HS384|HS512|RS256|RS384|RS512|PS256|PS384|PS512|ES256|ES384|ES512|EdDSA)$/.test(alg))
    f.push({ sev: 'medium', title: 'Нестандартный алгоритм: ' + alg, fix: 'Ограничьте список допустимых алгоритмов.' });

  return f;
}

function pemToDer(pem) {
  var b64 = String(pem).replace(/-----BEGIN[^-]+-----/g, '').replace(/-----END[^-]+-----/g, '').replace(/\s+/g, '');
  return b64ToU8(b64);
}

function verifyJwt(token, secret, pem) {
  var parts = String(token).trim().split('.');
  var header = JSON.parse(b64urlToStr(parts[0]));
  var alg = header.alg;
  var data = utf8(parts[0] + '.' + parts[1]);
  var sig = b64ToU8(parts[2] || '');

  if (/^HS/.test(alg)) {
    if (!secret) throw new Error('Для ' + alg + ' нужен секрет');
    var hash = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
    return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: hash }, false, ['verify'])
      .then(function (k) { return crypto.subtle.verify('HMAC', k, sig, data); });
  }
  if (/^(RS|PS|ES)/.test(alg)) {
    if (!pem) throw new Error('Для ' + alg + ' нужен публичный ключ PEM');
    var der = pemToDer(pem);
    if (/^RS/.test(alg)) {
      var h = { RS256: 'SHA-256', RS384: 'SHA-384', RS512: 'SHA-512' }[alg];
      return crypto.subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: h }, false, ['verify'])
        .then(function (k) { return crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, sig, data); });
    }
    if (/^PS/.test(alg)) {
      var h2 = { PS256: 'SHA-256', PS384: 'SHA-384', PS512: 'SHA-512' }[alg];
      // RFC 7518: длина соли равна длине хеша (32 / 48 / 64)
      var salt = { PS256: 32, PS384: 48, PS512: 64 }[alg];
      return crypto.subtle.importKey('spki', der, { name: 'RSA-PSS', hash: h2 }, false, ['verify'])
        .then(function (k) { return crypto.subtle.verify({ name: 'RSA-PSS', saltLength: salt }, k, sig, data); });
    }
    var curve = { ES256: 'P-256', ES384: 'P-384', ES512: 'P-521' }[alg];
    var h3 = { ES256: 'SHA-256', ES384: 'SHA-384', ES512: 'SHA-512' }[alg];
    return crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: curve }, false, ['verify'])
      .then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: h3 }, k, sig, data); });
  }
  return Promise.reject(new Error('Проверка для ' + alg + ' не поддерживается'));
}

function initJwt() {
  var btn = $('jwtBtn');
  if (!btn) return;
  var current = null;

  $('jwtSample').addEventListener('click', function () {
    $('jwtInput').value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    $('jwtBtn').click();
  });

  btn.addEventListener('click', function () {
    var box = $('jwtOut');
    try {
      current = decodeJwt($('jwtInput').value);
    } catch (e) {
      box.innerHTML = '<div class="card"><div class="out-note">Не удалось разобрать токен: ' + esc(e.message) + '</div></div>';
      $('jwtVerifyCard').style.display = 'none';
      return;
    }
    var j = current;
    var f = auditJwt(j);
    var score = scoreOf(f);
    $('jwtVerifyCard').style.display = 'block';

    box.innerHTML =
      scoreCard(score, f, 'алгоритм ' + (j.header.alg || '—')) +
      '<div class="card"><h3 class="card-title">Header</h3><pre class="code-block">' + esc(JSON.stringify(j.header, null, 2)) + '</pre></div>' +
      '<div class="card"><h3 class="card-title">Payload</h3><pre class="code-block">' + esc(JSON.stringify(j.payload, null, 2)) + '</pre></div>' +
      '<div class="card"><h3 class="card-title">Подпись</h3><div class="out-box mono">' + esc(j.sig.slice(0, 120) || '— отсутствует —') + '</div></div>' +
      '<div class="card"><h3 class="card-title">Аудит</h3>' + findingsBlock(f) + '</div>';
    saveHistory('jwt', (j.header.alg || '?') + ' · ' + Object.keys(j.payload).slice(0, 3).join(','), 'оценка ' + score);
  });

  $('jwtVerifyBtn').addEventListener('click', function () {
    if (!current) return toast('Сначала разберите токен');
    var box = $('jwtVerifyOut');
    box.innerHTML = '<div class="out-note">Проверяю подпись…</div>';
    // Promise.resolve().then — иначе синхронная ошибка (нет секрета, битый токен)
    // пролетает мимо catch и интерфейс остаётся на «Проверяю подпись…»
    Promise.resolve()
      .then(function () { return verifyJwt($('jwtInput').value, $('jwtSecret').value, $('jwtKey').value); })
      .then(function (ok) {
        box.innerHTML = ok
          ? '<div class="finding ok"><div class="f-head"><span class="f-title">Подпись действительна</span><span class="f-sev ok">ОК</span></div><div class="f-desc">Токен подписан именно этим ключом и не изменялся.</div></div>'
          : '<div class="finding critical"><div class="f-head"><span class="f-title">Подпись не совпадает</span><span class="f-sev critical">КРИТИЧНО</span></div><div class="f-desc">Либо ключ другой, либо payload/header изменены после подписи.</div></div>';
      })
      .catch(function (e) { box.innerHTML = '<div class="out-note">' + esc(e.message || e) + '</div>'; });
  });
}

/* ======================== 4. ССЫЛКИ ======================== */

var HOMOGLYPHS = { 'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ѕ':'s','ј':'j','ԁ':'d','һ':'h','ӏ':'l','м':'m','т':'t','к':'k','в':'b','н':'h','ѕ':'s','α':'a','ο':'o','ν':'v','ρ':'p','τ':'t','ι':'i','κ':'k','μ':'u','х':'x','ү':'y','ɡ':'g','ɡ':'g','ℓ':'l','0':'o','1':'l','3':'e','5':'s','$':'s','Ｗ':'w','ⅼ':'l','ⅰ':'i','ʀ':'r','ɴ':'n','ᴍ':'m','ᴋ':'k','ᴠ':'v','ᴛ':'t' };
var BRANDS = ['google','gmail','youtube','apple','icloud','microsoft','outlook','office','paypal','amazon','netflix','facebook','instagram','whatsapp','telegram','discord','steam','epicgames','roblox','binance','coinbase','metamask','blockchain','sberbank','sber','tinkoff','vtb','alfabank','gazprombank','gosuslugi','nalog','yandex','mail','vk','ok','avito','ozon','wildberries','dns','mvideo','qiwi','yoomoney','tinkoff','twitch','github','gitlab','dropbox','adobe','spotify','twitter','tiktok','linkedin','yahoo','protonmail','signal','zoom','slack'];
var SUSPICIOUS_TLD = ['tk','ml','ga','cf','gq','top','xyz','club','buzz','click','link','work','loan','men','review','country','stream','download','racing','win','bid','icu','rest','monster','sbs','cyou','lol','pw','cc','su','ws','biz','info','bar','cam','quest','cfd','sale','zip','mov'];
var SHORTENERS = ['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','buff.ly','rebrand.ly','cutt.ly','shorturl.at','vk.cc','clck.ru','u.to','bit.do','rb.gy','t.ly','short.gy','s.id','tiny.cc','lnkd.in','shorte.st','adf.ly','bc.vc','soo.gd','rb.link'];
var REDIRECT_PARAMS = ['url','uri','redirect','redirect_uri','redirecturl','next','return','returnurl','returnto','continue','dest','destination','target','goto','link','out','redir','r','u','forward','to'];
var TRACK_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','yclid','msclkid','dclid','_openstat','ref','referrer','mc_eid','igshid'];
var DANGEROUS_EXT = ['exe','scr','bat','cmd','com','pif','msi','vbs','js','jar','apk','dmg','ps1','hta','lnk','iso','img','zip','rar','7z','doc','docm','xls','xlsm'];

function levenshtein(a, b) {
  var m = a.length, n = b.length, prev = [], cur = [], i, j;
  for (j = 0; j <= n; j++) prev[j] = j;
  for (i = 1; i <= m; i++) {
    cur[0] = i;
    for (j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur.slice();
  }
  return prev[n];
}

// Декодер punycode (RFC 3492) — показывает, какой юникод-домен спрятан за xn--
function punycodeDecode(input) {
  var BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INIT_BIAS = 72, INIT_N = 128, MAX_INT = 2147483647;
  function adapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    var k = 0;
    for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) delta = Math.floor(delta / (BASE - TMIN));
    return Math.floor(k + (BASE - TMIN + 1) * delta / (delta + SKEW));
  }
  function digit(c) {
    if (c >= 48 && c <= 57) return c - 22;   // 0-9
    if (c >= 65 && c <= 90) return c - 65;   // A-Z
    if (c >= 97 && c <= 122) return c - 97;  // a-z
    return -1;
  }
  var out = [], i = 0, n = INIT_N, bias = INIT_BIAS, idx = 0;
  var delim = input.lastIndexOf('-');
  if (delim > 0) { for (; idx < delim; idx++) out.push(input.charCodeAt(idx)); idx++; }
  while (idx < input.length) {
    var oldi = i, w = 1, k = BASE, d;
    for (; ; k += BASE) {
      if (idx >= input.length) throw new Error('punycode');
      d = digit(input.charCodeAt(idx++));
      if (d < 0 || d > Math.floor((MAX_INT - i) / w)) throw new Error('punycode');
      i += d * w;
      var t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
      if (d < t) break;
      w *= BASE - t;
    }
    var len = out.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    out.splice(i++, 0, n);
  }
  return out.map(function (c) { return String.fromCodePoint(c); }).join('');
}

function analyzeUrl(raw) {
  var f = [];
  var input = String(raw).trim();
  if (!input) throw new Error('Пустая ссылка');

  if (/^(javascript|data|vbscript|file|blob):/i.test(input)) {
    f.push({ sev: 'critical', title: 'Опасная схема: ' + input.split(':')[0] + ':', desc: 'Такие ссылки исполняют код или подсовывают данные вместо адреса.', fix: 'Никогда не открывайте подобные ссылки из письма или чата.' });
  }

  var withProto = input;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(withProto)) withProto = 'https://' + withProto;

  var u;
  try { u = new URL(withProto); } catch (e) { throw new Error('Ссылку не удалось разобрать как URL'); }

  // URL() переводит нелатинский хост в punycode, поэтому для проверок берём
  // хост в том виде, как он написан, и отдельно раскодируем xn--
  var authority = withProto.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[\/?#]/)[0];
  var rawHost = authority.split('@').pop().replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  var asciiHost = u.hostname.toLowerCase();
  var decoded = asciiHost.split('.').map(function (l) {
    if (l.slice(0, 4) !== 'xn--') return l;
    try { return punycodeDecode(l.slice(4)); } catch (e) { return l; }
  }).join('.');
  var host = /[^\x00-\x7f]/.test(rawHost) ? rawHost : (decoded !== asciiHost ? decoded : asciiHost);
  // IP-литерал: цифры и двоеточия — проверки на буквы/бренды к нему не применимы
  var isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(asciiHost) || asciiHost.charAt(0) === '[' || /^[0-9a-f:]+$/.test(asciiHost) && asciiHost.indexOf(':') !== -1;

  // Алфавиты в домене
  var scripts = [];
  if (/[a-z]/.test(host)) scripts.push('латиница');
  if (/[а-яё]/.test(host)) scripts.push('кириллица');
  if (/[α-ω]/.test(host)) scripts.push('греческий');

  // Punycode: показываем, какой домен скрыт за xn--
  if (decoded !== asciiHost) {
    f.push({ sev: scripts.length > 1 ? 'high' : 'low', title: 'Punycode-домен', desc: 'За «' + asciiHost + '» спрятан домен «' + decoded + '». В адресной строке браузер покажет именно расшифрованный вид.', fix: 'Сверьте расшифровку с ожидаемым доменом — особенно если письмо пришло от банка или сервиса.' });
  }

  if (scripts.length > 1) {
    f.push({ sev: 'critical', title: 'Смешанные алфавиты в домене', desc: 'Домен собран из символов разных алфавитов (' + scripts.join(' + ') + '): ' + host + '. Так делают визуальные двойники (аррӏе.com против apple.com).', fix: 'Не открывайте. Наберите адрес руками.' });
  }

  // Гомоглифы → латинская нормализация.
  // Только если в домене есть латиница или смесь алфавитов: у честного «пример.рф»
  // вся кириллица, и подмена букв тут ничего не значит.
  if (!isIp && (scripts.length > 1 || scripts.indexOf('латиница') !== -1)) {
    var normalized = host.split('').map(function (c) { return HOMOGLYPHS[c] || c; }).join('');
    if (normalized !== host) {
      var impersonating = BRANDS.filter(function (b) { return normalized.indexOf(b) !== -1; });
      if (impersonating.length) {
        f.push({ sev: 'critical', title: 'Подмена букв в имени бренда', desc: 'После замены похожих символов домен читается как «' + normalized + '», то есть выдаёт себя за ' + impersonating.join(', ') + '.', fix: 'Это фишинг. Не вводите данные.' });
      } else {
        f.push({ sev: 'medium', title: 'В домене есть визуально похожие символы', desc: 'Нормализованный вид: ' + normalized, fix: 'Сверьте адрес посимвольно.' });
      }
    }
  }

  var parts = host.split('.');
  var asciiParts = asciiHost.split('.');
  var tld = (asciiParts[asciiParts.length - 1] || '').toLowerCase();
  var sld = parts.length >= 2 ? parts[parts.length - 2] : host;
  var registrable = parts.length >= 2 ? sld + '.' + parts[parts.length - 1] : host;
  if (isIp) registrable = host;
  var registrableAscii = asciiParts.slice(-2).join('.');

  // IP вместо домена
  if (isIp) {
    f.push({ sev: 'high', title: 'Адрес задан IP, а не доменом', desc: host, fix: 'Для сайтов с сертификатом так почти не делают. Не вводите данные.' });
  }
  if (/^(0x|0\d)/i.test(parts[0]) || /%2e|%2f/i.test(host)) {
    f.push({ sev: 'high', title: 'Обфускация адреса', desc: 'IP или разделители закодированы нестандартно: ' + host, fix: 'Типичный признак фишинга.' });
  }

  // Бренд в поддомене: label целиком или с приставкой/суффиксом (paypal-login.evil.com).
  // Короткие общие слова (mail, ok, dns) не берём — иначе любой mail.example.com «фишинг»
  var subLabels = asciiHost.split('.').slice(0, -2);
  var strongBrands = BRANDS.filter(function (b) { return b.length >= 5; });
  var brandHit = null;
  subLabels.some(function (lab) {
    var flat = lab.replace(/-/g, '');
    return strongBrands.some(function (b) {
      if (registrableAscii.indexOf(b) !== -1) return false;
      if (lab !== b && flat.indexOf(b) === -1) return false;
      brandHit = { label: lab, brand: b };
      return true;
    });
  });
  if (brandHit) {
    f.push({ sev: 'critical', title: 'Бренд «' + brandHit.brand + '» стоит в поддомене', desc: 'В адресе «' + host + '» настоящий домен — ' + registrable + ', и он не принадлежит бренду.', fix: 'Смотрите только на часть перед первой косой чертой после домена.' });
  }

  // Опечатки в домене (по тому же TLD, чтобы yandex.com не считался опечаткой yandex.ru)
  if (['com', 'ru', 'net', 'org'].indexOf(tld) !== -1) {
    BRANDS.slice(0, 30).some(function (b) {
      var d = b + '.' + tld;
      if (registrableAscii !== d && levenshtein(registrableAscii, d) === 1) {
        f.push({ sev: 'high', title: 'Опечатка в известном домене', desc: registrableAscii + ' отличается от ' + d + ' на один символ.', fix: 'Вероятнее всего, домен-ловушка.' });
        return true;
      }
      return false;
    });
  }

  // Символ @ — всё до него браузер отбрасывает
  var atIndex = authority.lastIndexOf('@');
  if (atIndex !== -1) {
    f.push({ sev: 'high', title: 'Обман через @ в ссылке', desc: 'Всё до @ — это логин, браузер его не показывает. В строке видно «' + authority.slice(0, atIndex) + '», а реальный адрес — ' + asciiHost + '.', fix: 'Классический приём «хороший-домен@злой-домен». Не открывайте.' });
  }

  // Домен
  if (SUSPICIOUS_TLD.indexOf(tld) !== -1) f.push({ sev: 'medium', title: 'Домен в зоне .' + tld, desc: 'Эта зона часто используется в массовых фишинговых кампаниях из-за дешёвой регистрации.', fix: 'Отнеситесь к источнику ссылки внимательнее.' });
  if (SHORTENERS.indexOf(registrableAscii) !== -1) f.push({ sev: 'medium', title: 'Сокращатель ссылок', desc: registrableAscii + ' скрывает конечный адрес.', fix: 'Раскройте ссылку перед переходом.' });
  if (parts.length > 4) f.push({ sev: 'medium', title: 'Много поддоменов (' + parts.length + ')', desc: host, fix: 'Часто используют, чтобы спрятать настоящее имя домена в длинной строке.' });
  if (host.length > 30) f.push({ sev: 'low', title: 'Длинный домен (' + host.length + ' символов)' });
  if ((host.match(/-/g) || []).length >= 3) f.push({ sev: 'low', title: 'Много дефисов в домене', desc: host });
  if (/^\d/.test(sld)) f.push({ sev: 'low', title: 'Домен начинается с цифры', desc: sld });

  // Порт
  if (u.port && u.port !== '80' && u.port !== '443') f.push({ sev: 'medium', title: 'Нестандартный порт :' + u.port, desc: 'Обычные сайты работают на 443.', fix: 'Уточните, почему указан порт.' });

  // Параметры
  var redir = [];
  var track = [];
  u.searchParams.forEach(function (v, k) {
    if (REDIRECT_PARAMS.indexOf(k.toLowerCase()) !== -1 && /^https?:|^\/\//i.test(v)) redir.push(k + '=' + v.slice(0, 50));
    if (TRACK_PARAMS.indexOf(k.toLowerCase()) !== -1) track.push(k);
  });
  if (redir.length) f.push({ sev: 'medium', title: 'Параметр перенаправления', desc: 'Через ' + redir.join(', ') + ' можно увести на чужой сайт.', fix: 'Проверьте, куда ведёт адрес внутри параметра.' });
  if (track.length) f.push({ sev: 'info', title: 'Трекеры в ссылке: ' + track.join(', '), desc: 'По ним считают, кто и откуда перешёл.', fix: 'Удалите параметры, чтобы не делиться источником.' });
  if (u.searchParams.toString().length > 400) f.push({ sev: 'low', title: 'Очень длинная строка параметров' });

  // Путь
  var ext = (u.pathname.split('.').pop() || '').toLowerCase();
  if (DANGEROUS_EXT.indexOf(ext) !== -1) f.push({ sev: 'high', title: 'Ссылка на файл .' + ext, desc: 'Такие файлы запускают код на компьютере.', fix: 'Не открывайте вложения и прямые ссылки на исполняемые файлы.' });
  if (/\.(php|asp|aspx|jsp|cgi)$/i.test(u.pathname) && u.searchParams.toString().length > 60) f.push({ sev: 'low', title: 'Длинный запрос к скрипту', desc: u.pathname });
  if (/\/\/(?!\/)/.test(u.pathname) || u.pathname.indexOf('\\') !== -1) f.push({ sev: 'medium', title: 'Обратный слэш или двойной слэш в пути', desc: 'Некоторые парсеры считают это началом нового хоста.', fix: 'Признак попытки обойти фильтр.' });

  // Схема и общий вид
  if (u.protocol === 'http:') f.push({ sev: 'high', title: 'Соединение без шифрования (http)', desc: 'Данные передаются открытым текстом.', fix: 'Не вводите пароли и карты на таких страницах.' });
  if (input.length > 100) f.push({ sev: 'low', title: 'Длинная ссылка (' + input.length + ' символов)' });
  if (/%25[0-9a-f]{2}/i.test(input)) f.push({ sev: 'medium', title: 'Двойное кодирование', desc: 'Встречается в попытках обойти WAF и фильтры.', fix: 'Отнеситесь с подозрением.' });
  if (/%00/.test(input)) f.push({ sev: 'high', title: 'Нулевой байт в ссылке (%00)', fix: 'Приём обхода фильтров.' });
  if (/[\u200b-\u200f\u202a-\u202e\u2060]/.test(input)) f.push({ sev: 'critical', title: 'Невидимые юникод-символы', desc: 'Символы управления направлением текста могут визуально перевернуть адрес.', fix: 'Не открывайте.' });

  if (!f.length) f.push({ sev: 'ok', title: 'Явных признаков фишинга не найдено', desc: 'Проверка локальная: репутация домена, блок-листы и свежесть регистрации так не проверяются.' });

  var risky = f.filter(function (x) { return x.sev !== 'ok' && x.sev !== 'info'; }).length;
  return {
    url: u.href, host: host, registrable: registrable, findings: f,
    rows: [
      ['Схема', u.protocol.replace(':', '')],
      ['Домен', registrable]
    ].concat(decoded !== asciiHost ? [['Punycode', asciiHost, true]] : []).concat([
      ['Поддомены', parts.slice(0, -2).join('.') || '—'],
      ['Порт', u.port || 'по умолчанию'],
      ['Путь', u.pathname.slice(0, 120)],
      ['Параметров', String(u.searchParams.toString() ? u.searchParams.toString().split('&').length : 0)],
      ['Длина', input.length + ' символов'],
      ['Зона', '.' + tld]
    ]),
    risky: risky
  };
}

function initUrl() {
  var btn = $('urlBtn');
  if (!btn) return;
  $('urlSample').addEventListener('click', function () {
    $('urlInput').value = 'https://paypal-login.secure-verify.tk/session?id=1&next=http://evil.example';
    $('urlBtn').click();
  });
  btn.addEventListener('click', function () {
    var box = $('urlOut');
    var r;
    try { r = analyzeUrl($('urlInput').value); }
    catch (e) { box.innerHTML = '<div class="card"><div class="out-note">' + esc(e.message) + '</div></div>'; return; }

    var verdict = r.risky >= 3 ? 'Опасная' : r.risky === 2 ? 'Подозрительная' : r.risky === 1 ? 'Слабые сигналы' : 'Чисто';
    box.innerHTML =
      '<div class="card"><div class="verdict v-' + (r.risky >= 3 ? 'bad' : r.risky >= 1 ? 'warn' : 'good') + '">' +
        '<i class="fas fa-' + (r.risky >= 3 ? 'triangle-exclamation' : r.risky >= 1 ? 'circle-exclamation' : 'circle-check') + '"></i> ' +
        esc(verdict) + ' · тревожных признаков: ' + r.risky +
      '</div></div>' +
      '<div class="card"><h3 class="card-title">Разбор адреса</h3>' + kvTable(r.rows) + '</div>' +
      '<div class="card"><h3 class="card-title">Признаки</h3>' + findingsBlock(r.findings) + '</div>';
    saveHistory('url', r.registrable, verdict);
  });
}

/* ======================== 5. ЗАГОЛОВКИ И CSP ======================== */

function parseHeaders(text) {
  var map = {}, cookies = [];
  String(text).split(/\r?\n/).forEach(function (line) {
    if (/^\s*(HTTP\/|GET |POST |HEAD )/i.test(line)) return;
    var i = line.indexOf(':');
    if (i === -1) return;
    var k = line.slice(0, i).trim().toLowerCase();
    var v = line.slice(i + 1).trim();
    if (!k) return;
    if (k === 'set-cookie') cookies.push(v);
    map[k] = map[k] ? map[k] + ', ' + v : v;
  });
  return { map: map, cookies: cookies };
}

var CSP_DIRECTIVES = ['default-src','script-src','script-src-elem','script-src-attr','style-src','style-src-elem','style-src-attr','img-src','font-src','connect-src','media-src','object-src','prefetch-src','child-src','worker-src','frame-src','frame-ancestors','form-action','base-uri','sandbox','report-uri','report-to','manifest-src','navigate-to','upgrade-insecure-requests','block-all-mixed-content','require-trusted-types-for','trusted-types','plugin-types','referrer'];

function auditCSP(csp) {
  var f = [];
  if (!csp) {
    f.push({ sev: 'high', title: 'Content-Security-Policy отсутствует', desc: 'Без CSP браузер выполняет любой внедрённый скрипт.', fix: "Начните с: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    return { findings: f, parsed: null };
  }
  var map = {}, unknown = [];
  csp.split(';').forEach(function (part) {
    var t = part.trim();
    if (!t) return;
    var sp = t.indexOf(' ');
    var name = (sp === -1 ? t : t.slice(0, sp)).toLowerCase();
    var val = sp === -1 ? '' : t.slice(sp + 1).trim();
    if (CSP_DIRECTIVES.indexOf(name) === -1 && !/^report-uri$/i.test(name)) unknown.push(name);
    map[name] = val;
  });

  if (unknown.length) f.push({ sev: 'low', title: 'Неизвестные директивы: ' + unknown.join(', '), desc: 'Директива с опечаткой молча игнорируется браузером — защита не включается.', fix: 'Проверьте написание.' });
  if (!map['default-src'] && !map['script-src']) f.push({ sev: 'high', title: 'Нет default-src и script-src', desc: 'Скрипты не ограничены ничем.', fix: "default-src 'self'" });

  var srcs = ['script-src', 'default-src', 'style-src', 'object-src', 'connect-src', 'img-src'];
  srcs.forEach(function (d) {
    var v = map[d];
    if (!v) return;
    if (/'unsafe-inline'/.test(v)) f.push({ sev: 'high', title: d + " разрешает 'unsafe-inline'", desc: 'Инлайн-скрипты выполняются — XSS через инъекцию в HTML остаётся рабочим. Эта директива обнуляет половину смысла CSP.', fix: 'Переведите инлайн-скрипты на nonce или хеши.' });
    if (/'unsafe-eval'/.test(v)) f.push({ sev: 'high', title: d + " разрешает 'unsafe-eval'", desc: 'eval, new Function и setTimeout со строкой снова доступны.', fix: 'Уберите unsafe-eval, перепишите код без динамического исполнения.' });
    if (/(^|\s)\*(\s|;|$)/.test(v)) f.push({ sev: 'high', title: d + ' разрешает любой источник (*)', desc: 'Ограничение отсутствует.', fix: 'Перечислите конкретные домены.' });
    if (/(^|\s)data:/.test(v) && d === 'script-src') f.push({ sev: 'high', title: 'script-src разрешает data:', desc: 'data:-URI в скрипте = обход защиты.', fix: 'Уберите data: из script-src.' });
    if (/(^|\s)http:/.test(v)) f.push({ sev: 'medium', title: d + ' разрешает http:', desc: 'Незашифрованные источники могут подменить контент.', fix: 'Оставьте только https.' });
    if (/(^|\s)'self'\s+\*\s*$/.test(v)) f.push({ sev: 'high', title: d + ": 'self' вместе с *", desc: 'Звёздочка делает self бессмысленным.' });
  });

  if (!map['object-src']) f.push({ sev: 'medium', title: "Нет object-src 'none'", desc: 'Плагины (Flash, PDF-встраивание) остаются вектором.', fix: "object-src 'none'" });
  if (!map['base-uri']) f.push({ sev: 'medium', title: 'Нет base-uri', desc: '<base href> со стороны атакующего перенаправит все относительные адреса.', fix: "base-uri 'none'" });
  if (!map['frame-ancestors'] && !map['report-only']) f.push({ sev: 'low', title: 'Нет frame-ancestors', desc: 'Защита от встраивания в iframe (кликджекинг) не задана — её может закрывать X-Frame-Options.', fix: "frame-ancestors 'none'" });
  if (!map['form-action']) f.push({ sev: 'low', title: 'Нет form-action', desc: 'Форму можно отправить на чужой домен.', fix: "form-action 'self'" });
  if (!/'nonce-|'sha256-|'sha384-|'sha512-/.test(csp)) f.push({ sev: 'medium', title: 'Нет nonce/хешей', desc: 'Значит, для инлайн-скриптов приходится держать unsafe-inline.', fix: 'Внедрите nonce на сервере.' });
  if (!map['report-uri'] && !map['report-to']) f.push({ sev: 'low', title: 'Нет report-uri', desc: 'Вы не узнаете о срабатываниях CSP.', fix: 'Добавьте report-to с коллектором.' });
  if (map['upgrade-insecure-requests'] != null) f.push({ sev: 'ok', title: 'upgrade-insecure-requests включён' });

  if (!f.some(function (x) { return x.sev !== 'ok' && x.sev !== 'info' && x.sev !== 'low'; }))
    f.push({ sev: 'ok', title: 'Критичных проблем в CSP нет' });

  return { findings: f, parsed: map };
}

function auditHeaders(text) {
  var p = parseHeaders(text);
  var h = p.map, f = [];
  var has = function (k) { return h[k] != null; };
  var csp = h['content-security-policy'] || h['content-security-policy-report-only'] || '';

  if (!csp) f.push({ sev: 'high', title: 'Content-Security-Policy отсутствует', fix: "Добавьте: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });

  var hsts = h['strict-transport-security'];
  if (!hsts) f.push({ sev: 'high', title: 'Strict-Transport-Security отсутствует', desc: 'Браузер не запоминает, что сайт только по HTTPS — возможен перехват на первой загрузке.', fix: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' });
  else {
    var ma = parseInt((hsts.match(/max-age=(\d+)/) || [])[1] || '0', 10);
    if (ma < 15768000) f.push({ sev: 'medium', title: 'HSTS max-age слишком мал (' + ma + ')', desc: 'Рекомендуется не меньше полугода.', fix: 'max-age=31536000' });
    if (!/includeSubDomains/i.test(hsts)) f.push({ sev: 'low', title: 'HSTS без includeSubDomains', fix: 'includeSubDomains' });
    if (!/preload/i.test(hsts)) f.push({ sev: 'info', title: 'HSTS без preload', desc: 'Без preload домен не попадает в список браузеров.' });
    if (ma >= 15768000 && /includeSubDomains/i.test(hsts)) f.push({ sev: 'ok', title: 'HSTS настроен' });
  }

  if (h['x-content-type-options'] !== 'nosniff') f.push({ sev: 'medium', title: 'Нет X-Content-Type-Options: nosniff', desc: 'Браузер может «угадать» тип файла и исполнить картинку как скрипт (MIME-sniffing).', fix: 'X-Content-Type-Options: nosniff' });

  if (has('x-frame-options') || /frame-ancestors/.test(csp)) f.push({ sev: 'ok', title: 'Защита от встраивания в iframe есть' });
  else f.push({ sev: 'medium', title: 'Нет X-Frame-Options и frame-ancestors', desc: 'Сайт можно встроить в iframe и подменить клики (кликджекинг).', fix: "frame-ancestors 'none' в CSP" });

  var rp = h['referrer-policy'];
  if (!rp) f.push({ sev: 'low', title: 'Referrer-Policy отсутствует', desc: 'Полные URL уходят на сторонние сайты.', fix: 'Referrer-Policy: strict-origin-when-cross-origin' });
  else if (/unsafe-url|no-referrer-when-downgrade/.test(rp)) f.push({ sev: 'low', title: 'Слабая Referrer-Policy: ' + rp, fix: 'strict-origin-when-cross-origin' });

  var pp = h['permissions-policy'];
  if (!pp) f.push({ sev: 'low', title: 'Permissions-Policy отсутствует', desc: 'Камера, микрофон и геолокация доступны любому встроенному фрейму.', fix: 'Permissions-Policy: camera=(), microphone=(), geolocation=()' });
  else if (/camera=\*|microphone=\*|geolocation=\*/.test(pp)) f.push({ sev: 'medium', title: 'Permissions-Policy разрешает всё (*)', desc: pp, fix: 'Разрешайте функции точечно.' });

  if (has('cross-origin-opener-policy')) f.push({ sev: 'ok', title: 'COOP задан: ' + h['cross-origin-opener-policy'] });
  else f.push({ sev: 'low', title: 'Нет Cross-Origin-Opener-Policy', desc: 'Окно страницы связано с открывшими её окнами — упрощает атаки через window.opener.', fix: 'Cross-Origin-Opener-Policy: same-origin' });

  if (h['cross-origin-embedder-policy'] || h['cross-origin-resource-policy']) f.push({ sev: 'ok', title: 'CORP/COEP заданы' });

  if (h['x-xss-protection']) f.push({ sev: 'low', title: 'X-XSS-Protection устарел', desc: 'Значение ' + h['x-xss-protection'] + '. Фильтр удалён из браузеров; в старых версиях он сам создавал уязвимости.', fix: 'Удалите заголовок или поставьте 0.' });

  if (h['server']) f.push({ sev: 'info', title: 'Server раскрывает ПО: ' + h['server'], fix: 'Уберите версию из заголовка.' });
  if (h['x-powered-by']) f.push({ sev: 'low', title: 'X-Powered-By раскрывает стек: ' + h['x-powered-by'], fix: 'Отключите заголовок.' });
  if (h['x-aspnet-version'] || h['x-aspnetmvc-version']) f.push({ sev: 'medium', title: 'Утечка версии ASP.NET', fix: 'Отключите заголовки Version.' });
  if (h['via'] || h['x-cache']) f.push({ sev: 'info', title: 'Прокси/кэш виден: ' + (h['via'] || h['x-cache']) });

  var acao = h['access-control-allow-origin'];
  if (acao === '*') {
    if (h['access-control-allow-credentials'] === 'true') f.push({ sev: 'critical', title: 'CORS: * вместе с credentials', desc: 'Любой сайт может читать ответы от имени пользователя.', fix: 'Перечислите конкретные источники вместо *.' });
    else f.push({ sev: 'low', title: 'CORS открыт для всех (*)', desc: 'Нормально для публичного API, опасно для приватных данных.' });
  }
  if (h['access-control-allow-origin'] && h['access-control-allow-origin'].indexOf('null') !== -1) f.push({ sev: 'high', title: 'CORS разрешает null-origin', desc: 'null выставляют песочницы и локальные файлы — это путь обхода.', fix: 'Уберите null из списка.' });

  if (h['content-type'] && !/charset=/i.test(h['content-type'])) f.push({ sev: 'low', title: 'Content-Type без charset', desc: h['content-type'], fix: 'Добавьте charset=utf-8.' });

  var cc = h['cache-control'] || '';
  var sessionCookie = p.cookies.some(function (c) { return /session|auth|token|sid|jwt/i.test((c.split('=')[0] || '').trim()); });
  if (/public/.test(cc) && sessionCookie) f.push({ sev: 'medium', title: 'Приватная cookie и Cache-Control: public', desc: 'В ответе есть сессионная cookie, но кэширование разрешено всем — ответ может осесть в общем кэше прокси.', fix: 'Для страниц с авторизацией: Cache-Control: private, no-store.' });
  else if (/no-store|no-cache/.test(cc) && sessionCookie) f.push({ sev: 'ok', title: 'Кэширование приватных ответов закрыто' });

  if (h['clear-site-data']) f.push({ sev: 'ok', title: 'Clear-Site-Data задан' });

  p.cookies.forEach(function (c, i) {
    var name = (c.split('=')[0] || '').trim();
    var miss = [];
    if (!/;\s*secure/i.test(c)) miss.push('Secure');
    if (!/;\s*httponly/i.test(c)) miss.push('HttpOnly');
    var sm = c.match(/samesite\s*=\s*(\w+)/i);
    if (!sm) miss.push('SameSite');
    else if (/samesite\s*=\s*none/i.test(c) && !/;\s*secure/i.test(c)) miss.push('Secure (обязателен при SameSite=None)');
    if (miss.length) f.push({ sev: miss.length >= 2 ? 'high' : 'medium', title: 'Cookie «' + esc(name) + '» без флагов: ' + miss.join(', '), desc: c.slice(0, 120), fix: 'Set-Cookie: ' + name + '=…; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=…' });
    else f.push({ sev: 'ok', title: 'Cookie «' + esc(name) + '» настроена корректно' });
    if (/^__(Host|Secure)-/.test(name) && !/;\s*secure/i.test(c)) f.push({ sev: 'medium', title: 'Префикс __Host- без Secure', desc: 'Браузер отбросит такую cookie.', fix: 'Добавьте Secure.' });
    if (/session|auth|token|sid/i.test(name) && !/max-age|expires/i.test(c)) f.push({ sev: 'low', title: 'Сессионная cookie без срока жизни: ' + esc(name), fix: 'Задайте Max-Age и обновляйте токен.' });
  });

  var score = scoreOf(f);
  return { findings: f, score: score, map: h };
}

function initHeaders() {
  var btn = $('hdrBtn');
  if (!btn) return;
  $('hdrSample').addEventListener('click', function () {
    $('hdrInput').value = 'HTTP/2 200\nserver: nginx/1.24.0\ncontent-type: text/html\nstrict-transport-security: max-age=63072000\nx-frame-options: SAMEORIGIN\nset-cookie: sid=abc123; Path=/\nx-powered-by: PHP/8.1.2';
    $('hdrBtn').click();
  });
  btn.addEventListener('click', function () {
    var text = $('hdrInput').value.trim();
    var box = $('hdrOut');
    if (!text) return toast('Вставьте заголовки ответа');
    var r = auditHeaders(text);
    var csp = auditCSP(r.map['content-security-policy'] || r.map['content-security-policy-report-only'] || '');
    var all = r.findings.concat(csp.findings);
    var score = scoreOf(all);
    var headerCount = Object.keys(r.map).length;

    var cspSuggest = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";

    box.innerHTML =
      scoreCard(score, all, 'заголовков разобрано: ' + headerCount) +
      '<div class="card"><h3 class="card-title">Заголовки безопасности</h3>' + findingsBlock(r.findings) + '</div>' +
      '<div class="card"><h3 class="card-title">Разбор CSP</h3>' +
        (csp.parsed
          ? kvTable(Object.keys(csp.parsed).map(function (k) { return [k, csp.parsed[k] || '(без значений)', true]; }))
          : '<div class="out-note">Заголовок CSP не найден.</div>') +
        findingsBlock(csp.findings) +
        '<div class="row-between" style="margin-top:12px"><h4 class="mini-title">Рекомендуемая база</h4>' +
        '<button class="btn-sm" id="cspCopy" type="button"><i class="fas fa-copy"></i> Копировать</button></div>' +
        '<pre class="code-block">' + esc(cspSuggest) + '</pre>' +
      '</div>' +
      '<div class="card"><h3 class="card-title">Итоговая оценка</h3>' +
        '<div class="out-note">' + (score >= 85 ? 'Конфигурация близка к эталонной.' : score >= 55 ? 'Основы есть, но защита неполная — закройте пункты выше.' : 'Защита практически отсутствует: браузер не ограничивает то, что может сделать внедрённый код.') + '</div>' +
      '</div>';

    var cb = $('cspCopy');
    if (cb) cb.addEventListener('click', function () { copyText(cspSuggest, 'CSP скопирован'); });
    saveHistory('hdr', headerCount + ' заголовков', 'оценка ' + score);
  });
}

/* ======================== 6. СТАТИЧЕСКИЙ АНАЛИЗ HTML ======================== */

function lineIndex(src) {
  var idx = [0], i = -1;
  while ((i = src.indexOf('\n', i + 1)) !== -1) idx.push(i + 1);
  return function (pos) {
    var lo = 0, hi = idx.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (idx[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}
function findAll(src, re) {
  var out = [], m;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) {
    out.push({ m: m, i: m.index });
    if (out.length > 400) break;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}
function shannon(s) {
  var map = {}, n = s.length;
  for (var i = 0; i < n; i++) map[s[i]] = (map[s[i]] || 0) + 1;
  var h = 0;
  Object.keys(map).forEach(function (k) { var p = map[k] / n; h -= p * Math.log2(p); });
  return h;
}

function auditHTML(src) {
  var lineAt = lineIndex(src);
  var f = [];
  function push(sev, title, list, fix, desc) {
    if (!list.length) return;
    f.push({ sev: sev, title: title, count: list.length, line: lineAt(list[0].i), evidence: String(list[0].m[0]).replace(/\s+/g, ' ').slice(0, 130), fix: fix, desc: desc });
  }

  // XSS-стоки
  push('high', 'innerHTML — запись HTML из строки', findAll(src, /\.innerHTML\s*=/g), 'Используйте textContent либо санитизацию (DOMPurify).', 'Если в строку попадают данные пользователя — это XSS.');
  push('high', 'insertAdjacentHTML', findAll(src, /insertAdjacentHTML\s*\(/g), 'Санитизируйте HTML перед вставкой.');
  push('high', 'document.write', findAll(src, /document\.write\s*\(/g), 'Откажитесь от document.write — он ломает парсинг и легко становится XSS.');
  push('high', 'eval()', findAll(src, /\beval\s*\(/g), 'Замените на разбор данных (JSON.parse) или явную логику.');
  push('high', 'new Function()', findAll(src, /new\s+Function\s*\(/g), 'Динамическое исполнение кода — обход CSP и путь для XSS.');
  push('medium', 'setTimeout/setInterval со строкой', findAll(src, /set(?:Timeout|Interval)\s*\(\s*['"`]/g), 'Передавайте функцию, а не строку.');
  push('medium', 'outerHTML — запись', findAll(src, /\.outerHTML\s*=/g), 'Заменяет узел целиком; при подстановке данных — XSS.');
  push('medium', 'srcdoc во фрейме', findAll(src, /srcdoc\s*=/g), 'Санитизируйте содержимое srcdoc.');
  push('medium', 'dangerouslySetInnerHTML (React)', findAll(src, /dangerouslySetInnerHTML/g), 'Санитизируйте HTML или перепишите на текст.');
  push('medium', 'v-html (Vue)', findAll(src, /v-html\s*=/g), 'v-html не экранирует данные — только для доверенного HTML.');

  // Инлайн-обработчики и javascript:
  push('medium', 'Инлайн-обработчики (onclick и др.)', findAll(src, /\son(?:click|load|error|mouseover|submit|focus|change|input|keydown|keyup|touchstart)\s*=/gi), 'Вынесите обработчики в addEventListener — так же снимается необходимость unsafe-inline в CSP.');
  push('high', 'javascript: в ссылке', findAll(src, /(?:href|src|action)\s*=\s*["']?\s*javascript:/gi), 'Удалите такие ссылки — это исполнение кода по клику.');

  // target=_blank без noopener
  var blanks = findAll(src, /<a\b[^>]*target\s*=\s*["']_blank["'][^>]*>/gi).filter(function (x) {
    return !/rel\s*=\s*["'][^"']*noopener/i.test(x.m[0]);
  });
  push('medium', '<a target="_blank"> без rel="noopener"', blanks, 'Добавьте rel="noopener noreferrer" — иначе открытая страница получает доступ к window.opener.');

  // Формы
  var httpForms = findAll(src, /<form\b[^>]*action\s*=\s*["']http:\/\//gi);
  push('high', 'Форма отправляет данные по http', httpForms, 'Только https — иначе пароли и токены уходят открытым текстом.');
  if (/<form\b/i.test(src) && !/csrf|_token|authenticity_token|nonce/i.test(src))
    f.push({ sev: 'medium', title: 'В формах нет CSRF-токена', desc: 'На странице есть формы, но не найдено ни одного поля с токеном.', fix: 'Добавьте скрытое поле с CSRF-токеном и проверяйте его на сервере.' });

  // Mixed content
  var mixed = findAll(src, /(?:src|href)\s*=\s*["']http:\/\//gi);
  push('high', 'Смешанный контент (http на странице)', mixed, 'Замените на https или протокол-относительные ссылки.');

  // SRI для сторонних скриптов
  var extScripts = findAll(src, /<script\b[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi).filter(function (x) {
    return !/integrity\s*=/.test(x.m[0]);
  });
  push('medium', 'Сторонний скрипт без подписи SRI', extScripts, 'Добавьте integrity="sha384-…" и crossorigin="anonymous" — иначе CDN может подменить файл.');

  // Iframe без sandbox
  var iframes = findAll(src, /<iframe\b[^>]*>/gi).filter(function (x) { return !/sandbox/i.test(x.m[0]); });
  push('medium', 'iframe без sandbox', iframes, 'Добавьте sandbox="allow-scripts allow-same-origin" по минимуму необходимого.');
  push('low', 'object / embed / applet', findAll(src, /<(?:object|embed|applet)\b/gi), 'Откажитесь от плагинов — это устаревший и опасный вектор.');

  // Мета-CSP со слабостями
  var metaCsp = findAll(src, /<meta[^>]+http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gi);
  if (metaCsp.length) {
    metaCsp.forEach(function (x) {
      if (/unsafe-inline|unsafe-eval|\*/.test(x.m[0])) f.push({ sev: 'high', title: 'meta-CSP содержит unsafe-inline/eval/*', line: lineAt(x.i), evidence: x.m[0].slice(0, 130), fix: 'Уберите небезопасные источники.' });
    });
    f.push({ sev: 'low', title: 'CSP задан через meta-тег', line: lineAt(metaCsp[0].i), fix: 'Заголовок CSP надёжнее: meta не поддерживает frame-ancestors и report-uri.' });
  }

  // Секреты
  var secrets = [
    [/AKIA[0-9A-Z]{16}/g, 'Ключ доступа AWS'],
    [/AIza[0-9A-Za-z_\-]{35}/g, 'Ключ Google API'],
    [/xox[baprs]-[0-9A-Za-z-]{10,}/g, 'Токен Slack'],
    [/gh[pousr]_[0-9A-Za-z]{20,}/g, 'Токен GitHub'],
    [/sk-[A-Za-z0-9]{20,}/g, 'Ключ OpenAI'],
    [/(?:sk|pk)_(?:live|test)_[0-9A-Za-z]{16,}/g, 'Ключ Stripe'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'Приватный ключ'],
    [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'JWT в открытом виде'],
    [/(?:AKIA|ASIA)[A-Z0-9]{16}/g, 'Ключ AWS']
  ];
  secrets.forEach(function (s) {
    var hits = findAll(src, s[0]);
    push('critical', 'Секрет в коде: ' + s[1], hits, 'Перенесите значение на сервер и отзовите утёкший ключ.');
  });

  // Обобщённые секреты с проверкой энтропии
  var generic = findAll(src, /(?:api[_-]?key|secret|passwd|password|token|bearer)\s*[:=]\s*["']([^"']{10,64})["']/gi).filter(function (x) {
    var v = x.m[1] || '';
    return shannon(v) > 3.2 && !/^[a-z]+$/i.test(v);
  });
  push('high', 'Похоже на захардкоженный секрет', generic, 'Проверьте вручную: значения должны приходить из окружения.');

  // Служебная информация
  push('low', 'sourceMappingURL — исходники доступны', findAll(src, /\/\/#\s*sourceMappingURL=/g), 'Соберите прод без карт кода или закройте их на сервере.');
  push('low', 'Комментарии с подозрительными словами', findAll(src, /<!--(?=[^]*?(?:todo|fixme|hack|password|secret|token|закомментир))[^]*?-->/gi), 'Удалите служебные комментарии из продакшена.');
  push('low', 'Внутренние IP-адреса', findAll(src, /\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g), 'Не раскрывайте внутреннюю топологию сети.');
  push('medium', 'document.domain — ослабление same-origin', findAll(src, /document\.domain\s*=/g), 'Устаревшая практика, ломает изоляцию.');
  var jsOpens = findAll(src, /window\.open\s*\(([^)]*)\)/g).filter(function (x) {
    return !/noopener|noreferrer/.test(x.m[1] || '');
  });
  push('low', 'window.open без noopener', jsOpens, 'Передавайте третьим аргументом "noopener" — или обнуляйте opener вручную.');
  push('low', 'data:-URI в ссылке', findAll(src, /(?:href|src)\s*=\s*["']data:/gi), 'data:-URI легко маскирует содержимое; для скриптов опасен.');

  // postMessage
  if (/addEventListener\s*\(\s*['"]message['"]/.test(src) && !/\.origin\b/.test(src))
    f.push({ sev: 'high', title: 'Обработчик message без проверки origin', desc: 'Найдена подписка на сообщения, но проверки e.origin в коде нет.', fix: 'Всегда сверяйте event.origin с белым списком.' });

  // Мелкие подсказки
  push('info', 'Поля пароля без autocomplete', findAll(src, /<input[^>]+type\s*=\s*["']password["'][^>]*>/gi).filter(function (x) { return !/autocomplete/i.test(x.m[0]); }), 'Добавьте autocomplete="current-password" — это помогает менеджерам паролей.');
  push('info', '<input type="file">', findAll(src, /<input[^>]+type\s*=\s*["']file["'][^>]*>/gi), 'Проверяйте тип и размер файла на сервере, а не только в браузере.');

  // Сторонние источники
  var origins = [];
  findAll(src, /(?:src|href)\s*=\s*["'](https?:\/\/[^"'\/]+)/gi).forEach(function (x) {
    var o = x.m[1].replace(/^https?:\/\//, '');
    if (origins.indexOf(o) === -1) origins.push(o);
  });
  var localHost = location.hostname;
  if (localHost) origins = origins.filter(function (o) { return o.indexOf(localHost) === -1; });

  // Пароль-поля и формы без https
  var passwords = findAll(src, /<input[^>]+type\s*=\s*["']password["'][^>]*>/gi);

  return { findings: f, origins: origins, hasPassword: passwords.length > 0, size: src.length };
}

function initHtmlTool() {
  var btn = $('htmlBtn');
  if (!btn) return;
  $('htmlFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (t) { $('htmlInput').value = t; toast('Файл загружен: ' + file.name, 'ok'); });
  });
  btn.addEventListener('click', function () {
    var src = $('htmlInput').value;
    var box = $('htmlOut');
    if (src.trim().length < 20) return toast('Вставьте исходник страницы');
    var r = auditHTML(src);
    var score = scoreOf(r.findings);
    var crit = r.findings.filter(function (x) { return x.sev === 'critical' || x.sev === 'high'; }).length;

    box.innerHTML =
      scoreCard(score, r.findings, (src.length / 1024).toFixed(1) + ' КБ разобрано · опасных: ' + crit) +
      (r.origins.length ? '<div class="card"><h3 class="card-title">Внешние источники (' + r.origins.length + ')</h3><div class="chips">' +
        r.origins.map(function (o) { return '<span class="chip">' + esc(o) + '</span>'; }).join('') + '</div>' +
        '<div class="out-note">Каждый такой домен получает IP посетителей и может влиять на содержимое страницы.</div></div>' : '') +
      '<div class="card"><h3 class="card-title">Находки</h3>' + findingsBlock(r.findings) + '</div>';
    saveHistory('html', (src.length / 1024).toFixed(1) + ' КБ', 'опасных ' + crit);
  });
}

/* ======================== 7. КРИПТО ======================== */

/* MD5 по RFC 1321 — только для проверки контрольных сумм легаси-файлов */
/* MD5:BEGIN */
function md5(input) {
  var data = typeof input === 'string' ? utf8(input) : input;
  var len = data.length;
  var blocks = Math.floor((len + 8) / 64) + 1;
  var buf = new Uint8Array(blocks * 64);
  buf.set(data);
  buf[len] = 0x80;
  var dv = new DataView(buf.buffer);
  var bitsLo = (len * 8) >>> 0;
  var bitsHi = Math.floor(len * 8 / 4294967296);
  dv.setUint32(buf.length - 8, bitsLo, true);
  dv.setUint32(buf.length - 4, bitsHi, true);

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  var S = [7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
           5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
           4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
           6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21];
  var K = [];
  for (var i = 0; i < 64; i++) K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));

  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }

  for (var b = 0; b < blocks; b++) {
    var M = [];
    for (var j = 0; j < 16; j++) M.push(dv.getUint32(b * 64 + j * 4, true));
    var A = a0, B = b0, C = c0, D = d0;
    for (var k = 0; k < 64; k++) {
      var F, g;
      if (k < 16) { F = (B & C) | (~B & D); g = k; }
      else if (k < 32) { F = (D & B) | (~D & C); g = (5 * k + 1) % 16; }
      else if (k < 48) { F = B ^ C ^ D; g = (3 * k + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * k) % 16; }
      var tmp = D;
      D = C;
      C = B;
      var sum = (A + F + K[k] + M[g]) | 0;
      B = (B + rotl(sum, S[k])) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }

  var out = new DataView(new ArrayBuffer(16));
  out.setUint32(0, a0 >>> 0, true);
  out.setUint32(4, b0 >>> 0, true);
  out.setUint32(8, c0 >>> 0, true);
  out.setUint32(12, d0 >>> 0, true);
  return hex(out.buffer);
}
/* MD5:END */

var BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(s) {
  s = String(s).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  var bits = 0, val = 0, out = [];
  for (var i = 0; i < s.length; i++) {
    var idx = BASE32.indexOf(s[i]);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

function detectHash(h) {
  var s = h.trim();
  var hexOnly = /^[0-9a-f]+$/i.test(s);
  if (/^\$2[aby]?\$\d{2}\$/.test(s)) return 'bcrypt (хеш пароля)';
  if (/^\$argon2/.test(s)) return 'Argon2 (хеш пароля)';
  if (/^\$1\$/.test(s)) return 'MD5-crypt';
  if (/^\$5\$/.test(s)) return 'SHA-256-crypt';
  if (/^\$6\$/.test(s)) return 'SHA-512-crypt';
  if (/^\$y\$/.test(s)) return 'yescrypt';
  if (/^[0-9a-f]{32}$/i.test(s)) return 'MD5 или NTLM (32 hex)';
  if (/^[0-9a-f]{40}$/i.test(s)) return 'SHA-1 (40 hex)';
  if (/^[0-9a-f]{56}$/i.test(s)) return 'SHA-224 (56 hex)';
  if (/^[0-9a-f]{64}$/i.test(s)) return 'SHA-256 (64 hex)';
  if (/^[0-9a-f]{96}$/i.test(s)) return 'SHA-384 (96 hex)';
  if (/^[0-9a-f]{128}$/i.test(s)) return 'SHA-512 (128 hex)';
  if (/^[A-Za-z0-9+/]{22}==$/.test(s)) return 'base64, 16 байт (возможно MD5)';
  if (/^[A-Za-z0-9+/]{43}=$/.test(s)) return 'base64, 32 байта (SHA-256)';
  if (/^\+[0-9a-f]{20}$/.test(s)) return 'crypt (DES)';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'UUID';
  if (hexOnly && s.length % 2 === 0) return 'hex, ' + (s.length / 2) + ' байт — тип неоднозначен';
  return 'не распознано';
}

function initCrypto() {
  var hashBtn = $('hashBtn');
  if (!hashBtn) return;

  $('hashBtn').addEventListener('click', function () {
    var text = $('hashInput').value;
    var box = $('hashOut');
    if (!text) return toast('Введите текст');
    Promise.all([
      Promise.resolve(md5(text)),
      digest('SHA-1', text), digest('SHA-256', text), digest('SHA-384', text), digest('SHA-512', text)
    ]).then(function (r) {
      var rows = [['MD5', r[0], true], ['SHA-1', r[1], true], ['SHA-256', r[2], true], ['SHA-384', r[3], true], ['SHA-512', r[4], true]];
      box.innerHTML = kvTable(rows) +
        '<div class="out-note">MD5 и SHA-1 считаются нестойкими: их используют только для сверки контрольных сумм, не для паролей и подписей.</div>';
      $('hmacOut').innerHTML = '';
      if ($('hmacKey').value) $('hmacKey').dispatchEvent(new Event('input'));
    });
  });

  function hmac(secret, msg) {
    return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, utf8(msg)); })
      .then(hex);
  }
  function renderHmac() {
    var key = $('hmacKey').value, msg = $('hashInput').value;
    if (!key || !msg) { $('hmacOut').innerHTML = ''; return; }
    hmac(key, msg).then(function (h) {
      $('hmacOut').innerHTML = kvTable([['HMAC-SHA256', h, true]]);
    });
  }
  $('hmacKey').addEventListener('input', renderHmac);
  $('hashInput').addEventListener('input', renderHmac);

  $('hashFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var box = $('hashOut');
    box.innerHTML = '<div class="out-note">Считаю хеши файла ' + esc(file.name) + ' (' + (file.size / 1024).toFixed(1) + ' КБ)…</div>';
    file.arrayBuffer().then(function (buf) {
      return Promise.all([Promise.resolve(md5(new Uint8Array(buf))), digest('SHA-1', buf), digest('SHA-256', buf)]).then(function (r) {
        box.innerHTML = kvTable([
          ['Файл', file.name + ' · ' + file.size + ' байт', false],
          ['MD5', r[0], true], ['SHA-1', r[1], true], ['SHA-256', r[2], true]
        ]);
        saveHistory('crypto', 'хеш файла', file.name.slice(0, 30));
      });
    });
  });

  $('hashDetect').addEventListener('input', function () {
    var v = this.value.trim();
    $('hashDetectOut').innerHTML = v.length > 5 ? kvTable([['Похоже на', detectHash(v), false], ['Длина', v.length + ' символов', true]]) : '';
  });

  $('encBtn').addEventListener('click', function () {
    var v = $('encInput').value.trim(), box = $('encOut');
    if (!v) return toast('Введите данные');
    var rows = [];

    // base64
    try { rows.push(['base64 → текст', decodeURIComponent(escape(atob(v))), true]); } catch (e) {}
    try { rows.push(['текст → base64', btoa(unescape(encodeURIComponent(v))), true]); } catch (e) {}
    // hex
    if (/^[0-9a-f\s]+$/i.test(v)) {
      var hx = v.replace(/\s/g, '');
      if (hx.length % 2 === 0) {
        var s = '';
        for (var i = 0; i < hx.length; i += 2) s += String.fromCharCode(parseInt(hx.substr(i, 2), 16));
        rows.push(['hex → текст', s, true]);
      }
    }
    rows.push(['текст → hex', hex(utf8(v)), true]);
    // URL
    try { rows.push(['URL-декодирование', decodeURIComponent(v), true]); } catch (e) {}
    rows.push(['URL-кодирование', encodeURIComponent(v), true]);
    // HTML
    rows.push(['HTML-экранирование', v.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }), true]);
    // base64url (JWT)
    rows.push(['base64url → текст', (function () { try { return b64urlToStr(v); } catch (e) { return '—'; } })(), true]);
    // ROT13/Atbash — частая история в CTF
    rows.push(['ROT13', v.replace(/[a-z]/gi, function (c) {
      var b = c <= 'Z' ? 65 : 97;
      return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b);
    }), true]);

    box.innerHTML = kvTable(rows) + '<div class="out-note">Показаны все применимые варианты — выбирайте подходящий.</div>';
  });

  $('aesBtn').addEventListener('click', function () {
    var pass = $('aesPass').value, text = $('aesText').value, mode = $('aesMode').value, box = $('aesOut');
    if (!pass || !text) return toast('Нужны пароль и данные');
    var salt = rand(16), iv = rand(12);
    var params = { name: 'PBKDF2', salt: salt, iterations: 250000, hash: 'SHA-256' };

    if (mode === 'enc') {
      crypto.subtle.importKey('raw', utf8(pass), 'PBKDF2', false, ['deriveKey'])
        .then(function (base) { return crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']); })
        .then(function (key) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, utf8(text)); })
        .then(function (ct) {
          var packed = new Uint8Array(salt.length + iv.length + ct.byteLength);
          packed.set(salt, 0); packed.set(iv, salt.length); packed.set(new Uint8Array(ct), salt.length + iv.length);
          box.innerHTML = kvTable([['Результат (base64)', u8ToB64(packed), true]]) +
            '<div class="out-note">Формат: соль(16) + IV(12) + шифротекст. Расшифровать можно здесь же или любым AES-GCM.</div>';
        })
        .catch(function (e) { box.innerHTML = '<div class="out-note">' + esc(e.message) + '</div>'; });
    } else {
      var raw;
      try { raw = b64ToU8(text); } catch (e) { return toast('Ожидается base64 из этого же инструмента'); }
      var s2 = raw.slice(0, 16), i2 = raw.slice(16, 28), ct2 = raw.slice(28);
      crypto.subtle.importKey('raw', utf8(pass), 'PBKDF2', false, ['deriveKey'])
        .then(function (base) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: s2, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']); })
        .then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: i2 }, key, ct2); })
        .then(function (pt) { box.innerHTML = kvTable([['Расшифровано', new TextDecoder().decode(pt), true]]); })
        .catch(function () { box.innerHTML = '<div class="out-note">Не расшифровалось: неверный пароль или повреждённые данные.</div>'; });
    }
  });

  var totpTimer;
  function showTotp() {
    var secret = $('totpSecret').value.trim();
    var box = $('totpOut');
    if (!secret) return;
    var keyBytes = base32Decode(secret);
    if (!keyBytes.length) { box.innerHTML = '<div class="out-note">Секрет не похож на base32.</div>'; return; }
    crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']).then(function (key) {
      function tick() {
        var period = 30, digits = 6;
        var counter = Math.floor(Date.now() / 1000 / period);
        var buf = new ArrayBuffer(8), dv = new DataView(buf);
        dv.setUint32(0, Math.floor(counter / 4294967296), false);
        dv.setUint32(4, counter >>> 0, false);
        crypto.subtle.sign('HMAC', key, buf).then(function (sig) {
          var h = new Uint8Array(sig);
          var off = h[h.length - 1] & 0x0f;
          var code = (((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % Math.pow(10, digits);
          var s = String(code);
          while (s.length < digits) s = '0' + s;
          var left = period - (Math.floor(Date.now() / 1000) % period);
          box.innerHTML = '<div class="totp"><span class="totp-code mono">' + s.slice(0, 3) + ' ' + s.slice(3) + '</span>' +
            '<span class="totp-timer">сменится через ' + left + ' с</span></div>' +
            kvTable([['Период', period + ' сек', true], ['Алгоритм', 'HMAC-SHA1, 6 цифр (RFC 6238)', true]]);
        });
      }
      tick();
      clearInterval(totpTimer);
      totpTimer = setInterval(tick, 1000);
    });
  }
  $('totpBtn').addEventListener('click', showTotp);
  $('totpSecret').addEventListener('keydown', function (e) { if (e.key === 'Enter') showTotp(); });

  $('randBtn').addEventListener('click', function () {
    var bits = parseInt($('randBits').value, 10) || 256;
    bits = Math.max(32, Math.min(4096, bits));
    var bytes = Math.ceil(bits / 8);
    var u = rand(bytes);
    var b64 = u8ToB64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    $('randOut').innerHTML = kvTable([
      ['Символов', b64.length + ' (base64url)', true],
      ['Энтропия', bytes * 8 + ' бит', true],
      ['Значение', b64, true]
    ]) + '<div class="out-note">Источник — crypto.getRandomValues, это CSPRNG браузера.</div>';
  });
}

/* ======================== СТАРТ ======================== */

document.addEventListener('DOMContentLoaded', function () {
  var tabs = $('toolTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tool-tab');
      if (b) switchTool(b.dataset.tool);
    });
    // Стрелки влево/вправо переключают вкладки — как в обычном tablist
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var i = TOOLS.indexOf(location.hash.slice(1) || 'pass');
      var next = e.key === 'ArrowRight' ? (i + 1) % TOOLS.length : (i - 1 + TOOLS.length) % TOOLS.length;
      e.preventDefault();
      switchTool(TOOLS[next]);
      var btn = document.querySelector('.tool-tab[data-tool="' + TOOLS[next] + '"]');
      if (btn) btn.focus();
    });
  }

  // Enter в однострочном поле запускает проверку, Ctrl+Enter — в многострочном
  function runOn(inputId, btnId, needCtrl) {
    var el = $(inputId);
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (needCtrl ? !(e.ctrlKey || e.metaKey) : e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      var b = $(btnId);
      if (b) b.click();
    });
  }
  runOn('urlInput', 'urlBtn', false);
  runOn('dnsDomain', 'dnsBtn', false);
  runOn('dnsSelectors', 'dnsBtn', false);
  runOn('aesPass', 'aesBtn', false);
  runOn('jwtInput', 'jwtBtn', true);
  runOn('hdrInput', 'hdrBtn', true);
  runOn('htmlInput', 'htmlBtn', true);
  runOn('hashInput', 'hashBtn', true);
  runOn('aesText', 'aesBtn', true);
  runOn('encInput', 'encBtn', true);

  $('historyList').addEventListener('click', function (e) {
    var item = e.target.closest('.history-item');
    if (item) {
      switchTool(item.dataset.tool);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  $('histClear').addEventListener('click', function () {
    try { localStorage.removeItem('cyberscan_hist'); } catch (e) {}
    renderHistory();
  });

  switchTool(location.hash.slice(1) || 'pass');

  // Панели связаны со своими вкладками — для скринридеров и навигации с клавиатуры
  TOOLS.forEach(function (t) {
    var p = $('tool-' + t);
    if (p) { p.setAttribute('aria-labelledby', 'tab-' + t); }
    var b = document.querySelector('.tool-tab[data-tool="' + t + '"]');
    if (b) { b.id = 'tab-' + t; b.setAttribute('aria-controls', 'tool-' + t); }
  });

  initPasswords();
  initDNS();
  initJwt();
  initUrl();
  initHeaders();
  initHtmlTool();
  initCrypto();
  renderHistory();
});

})();
