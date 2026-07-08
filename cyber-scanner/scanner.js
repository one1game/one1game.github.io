// Cyber-Scanner v2 — 13 модулей, грейд A+..F
(function() {
'use strict';

var activeModules = {
  headers: true, xss: true, cors: true, cookies: true, leaks: true,
  mixed: true, csrf: true, meta: true, deprecated: true, debug: true,
  reflected: true, emails: true, tech: true
};
var vulns = [];
var infoItems = [];
var passedTests = 0;
var totalTests = 0;
var startTime = 0;
var lastResults = null;
var isRunning = false;
var pageHTML = '';
var targetURL = '';
var techList = [];

var H = {
  id: function(id) { return document.getElementById(id); },
  show: function(id) { var el = H.id(id); if (el) el.classList.remove('hidden'); },
  hide: function(id) { var el = H.id(id); if (el) el.classList.add('hidden'); }
};

// ======== MODULE TOGGLES ========
document.querySelectorAll('.module-chip').forEach(function(c) {
  c.addEventListener('click', function() {
    var m = c.dataset.module;
    c.classList.toggle('active');
    activeModules[m] = c.classList.contains('active');
  });
});

// ======== MAIN ========
window.startScan = function() {
  if (isRunning) return;
  var input = H.id('targetUrl');
  var raw = input.value.trim();
  if (!raw) return toast('Введите URL для сканирования');

  var url = raw;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch(e) { return toast('Некорректный URL'); }

  targetURL = url;
  resetScan();
  isRunning = true;

  var btn = H.id('scanBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сканирую...';

  H.show('progress');
  H.hide('results');
  startTime = Date.now();

  runPipeline(url)
    .then(function() {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      var grade = calcGrade(vulns);
      lastResults = {
        target: url, time: elapsed, totalTests: totalTests,
        passed: passedTests, vulns: vulns, info: infoItems,
        tech: techList, grade: grade,
        date: new Date().toISOString()
      };

      updateProgress(100, 'Сканирование завершено — ' + grade);
      setTimeout(function() {
        H.hide('progress');
        showResults(lastResults);
        saveHistory(lastResults);
        isRunning = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Сканировать';
      }, 400);
    })
    .catch(function(err) {
      toast('Ошибка: ' + (err.message || 'неизвестная'));
      isRunning = false;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-play"></i> Сканировать';
    });
};

function runPipeline(url) {
  var steps = [];
  var add = function(p, label, fn) { steps.push({ pct: p, label: label, fn: fn }); };

  add(5,  'Проверка доступности...', function() { return fetchPage(url); });
  add(12, 'SSL/TLS...', function() { return checkSSL(url); });
  add(20, 'Security headers...', function() { return m('headers', scanHeaders); });
  add(28, 'CORS...', function() { return m('cors', scanCORS); });
  add(35, 'Cookies...', function() { return m('cookies', scanCookies); });
  add(42, 'Mixed Content...', function() { return m('mixed', scanMixed); });
  add(50, 'CSRF...', function() { return m('csrf', scanCSRF); });
  add(57, 'Meta-теги...', function() { return m('meta', scanMeta); });
  add(64, 'XSS-векторы...', function() { return m('xss', scanXSS); });
  add(70, 'Утечки данных...', function() { return m('leaks', scanLeaks); });
  add(76, 'Устаревшие API...', function() { return m('deprecated', scanDeprecated); });
  add(82, 'Отладка в проде...', function() { return m('debug', scanDebug); });
  add(88, 'Reflected-параметры...', function() { return m('reflected', scanReflected); });
  add(93, 'Email...', function() { return m('emails', scanEmails); });
  add(98, 'Стек технологий...', function() { return m('tech', scanTech); });

  return steps.reduce(function(chain, s) {
    return chain.then(function() {
      updateProgress(s.pct, s.label);
      log(s.label);
      return s.fn();
    });
  }, Promise.resolve());
}

function m(name, fn) { return activeModules[name] ? fn() : Promise.resolve(); }

// ======== HELPERS ========
function updateProgress(pct, label) {
  var f = H.id('progressFill'), pl = H.id('progressLabel'), pp = H.id('progressPct');
  if (f) f.style.width = pct + '%';
  if (pl) pl.textContent = label;
  if (pp) pp.textContent = pct + '%';
}
function log(msg) {
  var el = H.id('progressLog'); if (!el) return;
  var d = document.createElement('div');
  d.className = 'log-line'; d.textContent = msg;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
}
function addVuln(type, severity, desc, fix) { totalTests++; vulns.push({ type: type, severity: severity, desc: desc, fix: fix }); }
function addInfo(type, desc) { infoItems.push({ type: type, desc: desc }); }
function pass() { totalTests++; passedTests++; }
function toast(msg) {
  var el = H.id('errorToast'); if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(function() { el.classList.add('hidden'); }, 3000);
}
function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ======== MODULES ========
function fetchPage(url) {
  return fetch(url).then(function(r) {
    if (!r.ok) { addVuln('UNREACHABLE', 'critical', 'HTTP ' + r.status + ' — цель недоступна', 'Проверьте URL'); return; }
    return r.text().then(function(h) { pageHTML = h; pass(); });
  }).catch(function() { addVuln('UNREACHABLE', 'critical', 'Цель недоступна', 'Проверьте URL'); });
}

function checkSSL(url) {
  if (!url.startsWith('https://')) { addVuln('NO_HTTPS', 'high', 'Сайт без HTTPS', 'Установите SSL и настройте редирект'); }
  else pass();
}

// 1. Headers
function scanHeaders() {
  return fetch(url()).then(function(r) {
    if (!r) return;
    var h = r.headers;
    var critical = [
      { key: 'content-security-policy', name: 'Content-Security-Policy' },
      { key: 'strict-transport-security', name: 'Strict-Transport-Security' },
      { key: 'x-content-type-options', name: 'X-Content-Type-Options' },
      { key: 'x-frame-options', name: 'X-Frame-Options' }
    ];
    var missing = [];
    critical.forEach(function(c) { if (!h.get(c.key)) missing.push(c.name); });

    var issues = [];
    var csp = h.get('content-security-policy') || '';
    if (csp.includes("'unsafe-inline'") && csp.includes("'unsafe-eval'"))
      issues.push('CSP разрешает unsafe-inline + unsafe-eval');

    var perms = h.get('permissions-policy');
    if (!perms) issues.push('Permissions-Policy отсутствует');
    var ref = h.get('referrer-policy');
    if (!ref) issues.push('Referrer-Policy отсутствует');

    if (missing.length > 0 || issues.length > 0) {
      addVuln('SECURITY_HEADERS', missing.length >= 3 ? 'high' : 'medium',
        (missing.length ? 'Нет: ' + missing.join(', ') + '. ' : '') + issues.join('; '),
        'Добавьте заголовки в nginx/apache'
      );
    } else pass();
  });
}

// 2. CORS
function scanCORS() {
  return fetch(url(), { mode: 'cors' }).then(function(r) {
    var acao = r.headers.get('access-control-allow-origin');
    var acac = r.headers.get('access-control-allow-credentials');
    if (acao === '*') {
      if (acac === 'true')
        addVuln('CORS_WILDCARD_CREDS', 'critical', 'CORS * + credentials — критическая уязвимость', 'Замените * на конкретные домены');
      else
        addVuln('CORS_WILDCARD', 'low', 'CORS разрешён всем (*)', 'Ограничьте доменами');
    } else pass();
  }).catch(function() { pass(); });
}

// 3. Cookies
function scanCookies() {
  return fetch(url()).then(function(r) {
    if (!r) return;
    var sc = r.headers.get('set-cookie');
    if (!sc) { pass(); return; }
    var flags = { secure: /secure/i.test(sc), httponly: /httponly/i.test(sc), samesite: /samesite/i.test(sc) };
    var missing = [];
    if (!flags.secure) missing.push('Secure');
    if (!flags.httponly) missing.push('HttpOnly');
    if (!flags.samesite) missing.push('SameSite');
    if (missing.length > 0)
      addVuln('COOKIE_FLAGS', missing.length >= 2 ? 'high' : 'medium',
        'Cookie без: ' + missing.join(', '),
        'Set-Cookie: ...; Secure; HttpOnly; SameSite=Lax');
    else pass();
  });
}

// 4. Mixed Content
function scanMixed() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var httpRes = pageHTML.match(/src=["']http:\/\//gi) || [];
  var httpLink = pageHTML.match(/href=["']http:\/\//gi) || [];
  var total = httpRes.length + httpLink.length;
  if (total > 0)
    addVuln('MIXED_CONTENT', 'high', 'Найдено ' + total + ' HTTP-ресурсов на HTTPS-странице', 'Замените http:// на https://');
  else pass();
  return Promise.resolve();
}

// 5. CSRF
function scanCSRF() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var forms = (pageHTML.match(/<form\b[^>]*>/gi) || []);
  if (forms.length === 0) { pass(); return Promise.resolve(); }

  var unprotected = 0;
  forms.forEach(function(f) {
    if (!/<input[^>]+csrf/i.test(f) && !/<input[^>]+_token/i.test(f) && !/<input[^>]+nonce/i.test(f))
      unprotected++;
  });

  if (unprotected > 0)
    addVuln('CSRF', unprotected === forms.length ? 'high' : 'medium',
      unprotected + ' из ' + forms.length + ' форм без CSRF-токенов',
      'Добавьте anti-CSRF токены во все формы');
  else pass();
  return Promise.resolve();
}

// 6. Meta-теги
function scanMeta() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var issues = [];
  if (!/<meta\s+charset=/i.test(pageHTML)) issues.push('charset');
  if (!/<meta\s+name=["']viewport/i.test(pageHTML)) issues.push('viewport');
  if (!/<meta\s+name=["']theme-color/i.test(pageHTML)) issues.push('theme-color');
  if (!/<title\b/i.test(pageHTML)) issues.push('title');
  if (!/<meta\s+name=["']description/i.test(pageHTML)) issues.push('description');

  if (issues.length > 0)
    addVuln('META_TAGS', 'low', 'Не хватает meta-тегов: ' + issues.join(', '), 'Добавьте недостающие теги в <head>');
  else pass();
  return Promise.resolve();
}

// 7. XSS
function scanXSS() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var indicators = [];
  if (/\bon(?:click|load|error|mouseover)\s*=/gi.test(pageHTML)) indicators.push('inline-обработчики');
  if (/<script\b(?!.*src=)[^>]*>([\s\S]*?)<\/script>/gi.test(pageHTML)) indicators.push('inline-скрипт');
  if (/document\.write\s*\(/gi.test(pageHTML)) indicators.push('document.write');
  if (/eval\s*\(/gi.test(pageHTML)) indicators.push('eval()');
  if (/innerHTML\s*=/gi.test(pageHTML)) indicators.push('innerHTML');

  if (indicators.length > 0)
    addVuln('XSS_INDICATORS', indicators.length >= 3 ? 'high' : 'medium',
      'XSS-индикаторы: ' + indicators.join(', '),
      'CSP + экранирование вывода + TextContent вместо innerHTML');
  else pass();
  return Promise.resolve();
}

// 8. Leaks
function scanLeaks() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var issues = [];

  if (/(?:api[_-]?key|api[_-]?secret)\s*[=:]\s*["'][A-Za-z0-9_-]{16,}["']/gi.test(pageHTML))
    issues.push('API-ключи в коде');
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/i.test(pageHTML))
    issues.push('AWS-ключи');
  if (/-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/gi.test(pageHTML))
    issues.push('Приватные ключи');

  var comments = pageHTML.match(/<!--[\s\S]*?-->/gi) || [];
  var bad = comments.filter(function(c) { return /(?:todo|fixme|hack|password|secret|token|key|api_key)/i.test(c) && c.length > 30; });
  if (bad.length > 0) issues.push('Подозрительные комментарии (' + bad.length + ')');

  return fetch(url()).then(function(r) {
    if (r) {
      var server = r.headers.get('server');
      if (server && /\d+\.\d+/.test(server)) issues.push('Server: ' + server);
      var powered = r.headers.get('x-powered-by');
      if (powered) issues.push('X-Powered-By: ' + powered);
    }
    if (issues.length > 0)
      addVuln('INFO_LEAK', 'high', 'Утечки: ' + issues.join('; '), 'Удалите из клиентского кода и заголовков');
    else pass();
  });
}

// 9. Deprecated APIs
function scanDeprecated() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var issues = [];
  if (/document\.write\s*\(/gi.test(pageHTML)) issues.push('document.write');
  if (/<\/?(?:marquee|blink|font|center)\b/i.test(pageHTML)) issues.push('устаревшие HTML-теги');
  if (/XMLHttpRequest\s*\(/gi.test(pageHTML) && !/new\s+XMLHttpRequest/i.test(pageHTML)) {}
  // Check for synchronous XHR
  if (/\.open\s*\(\s*["'][A-Z]+\s*["']\s*,\s*["'][^"']+\s*["']\s*,\s*false\s*\)/gi.test(pageHTML))
    issues.push('синхронный XHR');

  if (issues.length > 0)
    addVuln('DEPRECATED', 'low', 'Устаревшие API: ' + issues.join(', '), 'Обновите код');
  else pass();
  return Promise.resolve();
}

// 10. Debug in production
function scanDebug() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var issues = [];
  if (/console\.(?:log|debug|info|warn|error)\(/gi.test(pageHTML))
    issues.push('console.log/debug');
  if (/debugger\s*;?/gi.test(pageHTML))
    issues.push('debugger;');
  if (/alert\s*\(/gi.test(pageHTML))
    issues.push('alert()');

  if (issues.length > 0)
    addVuln('DEBUG_IN_PROD', 'medium',
      'Отладочный код в проде: ' + issues.join(', '),
      'Уберите перед деплоем');
  else pass();
  return Promise.resolve();
}

// 11. Reflected parameters
function scanReflected() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var urlObj = new URL(targetURL);
  var params = urlObj.searchParams;
  var reflected = [];

  params.forEach(function(val, key) {
    if (val && pageHTML.includes(val))
      reflected.push(key + '=' + val.substring(0, 30));
  });

  if (reflected.length > 0)
    addVuln('REFLECTED_PARAMS', 'medium',
      + reflected.length + ' параметров отражаются в DOM: ' + reflected.join(', '),
      'Фильтруйте/экранируйте вывод параметров из URL');
  else pass();
  return Promise.resolve();
}

// 12. Emails
function scanEmails() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  var re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  var emails = (pageHTML.match(re) || []).filter(function(e, i, a) { return a.indexOf(e) === i; });

  if (emails.length > 0) {
    addInfo('EMAILS_FOUND', 'Найдено ' + emails.length + ' email: ' + emails.slice(0, 5).join(', ') + (emails.length > 5 ? '...' : ''));
    pass();
  } else pass();
  return Promise.resolve();
}

// 13. Tech stack
function scanTech() {
  if (!pageHTML) { pass(); return Promise.resolve(); }
  return fetch(url()).then(function(r) {
    var tech = [];
    if (r) {
      var srv = (r.headers.get('server') || '');
      if (/nginx/i.test(srv)) tech.push('Nginx');
      if (/apache/i.test(srv)) tech.push('Apache');
      if (/cloudflare/i.test(srv)) tech.push('Cloudflare');
      if (/iis/i.test(srv)) tech.push('IIS');
      if (/php/i.test(r.headers.get('x-powered-by') || '')) tech.push('PHP');
    }

    var patterns = [
      [/wp-content|wp-includes/, 'WordPress'],
      [/react-dom|react\.prod/i, 'React'],
      [/vue\.js|v-bind|v-if|v-html/, 'Vue.js'],
      [/angular\.js|ng-app|ng-controller/, 'Angular'],
      [/jquery[.\-]/, 'jQuery'],
      [/bootstrap\.min|bootstrap\.css/, 'Bootstrap'],
      [/tailwindcss|tailwind\.css/, 'Tailwind CSS'],
      [/fontawesome/, 'Font Awesome'],
      [/_next\/|next\.js/, 'Next.js'],
      [/nuxt\.js|__NUXT__/, 'Nuxt.js'],
      [/gatsby/i, 'Gatsby'],
      [/gtag|googletagmanager/, 'Google Analytics'],
      [/clarity\.ms/, 'MS Clarity'],
      [/recaptcha/, 'reCAPTCHA'],
      [/hcaptcha/, 'hCaptcha'],
      [/shopify/i, 'Shopify'],
      [/cloudflare/i, 'Cloudflare']
    ];
    patterns.forEach(function(p) { if (p[0].test(pageHTML)) tech.push(p[1]); });

    techList = tech;
    pass();
  });
}

// ======== GRADE ========
function calcGrade(v) {
  var counts = { critical: 0, high: 0, medium: 0, low: 0 };
  v.forEach(function(x) { counts[x.severity]++; });
  var total = v.length;

  if (total === 0) return 'A+';
  if (counts.critical >= 2 || (counts.critical >= 1 && counts.high >= 2) || total >= 8) return 'F';
  if (counts.critical >= 1 || counts.high >= 3) return 'D';
  if (counts.high >= 2 || counts.medium >= 4) return 'C';
  if (counts.medium >= 2 || counts.high === 1) return 'B';
  return 'A';
}

// ======== DISPLAY ========
function showResults(r) {
  H.show('results');

  // Meta
  H.id('resultsMeta').innerHTML = [
    '<span><i class="fas fa-globe"></i> ' + esc(r.target) + '</span>',
    '<span><i class="fas fa-clock"></i> ' + r.time + ' сек</span>',
    '<span><i class="fas fa-check-circle"></i> ' + r.passed + '/' + r.totalTests + ' тестов</span>'
  ].join('');

  // Grade
  var g = H.id('gradeBadge');
  var cls = r.grade === 'A+' ? 'Aplus' : r.grade;
  g.textContent = r.grade;
  g.className = 'grade-badge ' + cls;

  // Stats
  var counts = { critical: 0, high: 0, medium: 0, low: 0 };
  r.vulns.forEach(function(v) { counts[v.severity]++; });
  var labels = [
    ['Критические', counts.critical, 'stat-critical'],
    ['Высокие', counts.high, 'stat-high'],
    ['Средние', counts.medium, 'stat-medium'],
    ['Низкие', counts.low, 'stat-low'],
    ['Пройдено', r.passed, 'stat-passed']
  ];
  H.id('resultsStats').innerHTML = labels.map(function(l) {
    return '<div class="stat-row"><span>' + l[0] + '</span><span class="stat-val ' + l[2] + '">' + l[1] + '</span></div>';
  }).join('');

  // Vulns
  var ve = H.id('resultsVulns');
  var items = [];

  // Info items first
  r.info.forEach(function(i) {
    items.push('<div class="vuln-card info">' +
      '<div class="vuln-card-header"><span class="vuln-card-title">' + esc(i.type) + '</span><span class="vuln-card-sev info">INFO</span></div>' +
      '<div class="vuln-card-desc">' + esc(i.desc) + '</div></div>');
  });

  // Vulnerabilities
  r.vulns.forEach(function(v) {
    items.push('<div class="vuln-card ' + v.severity + '">' +
      '<div class="vuln-card-header">' +
        '<span class="vuln-card-title">' + esc(v.type) + '</span>' +
        '<span class="vuln-card-sev ' + v.severity + '">' + v.severity + '</span>' +
      '</div>' +
      '<div class="vuln-card-desc">' + esc(v.desc) + '</div>' +
      '<div class="vuln-card-fix"><i class="fas fa-wrench"></i> ' + esc(v.fix) + '</div>' +
    '</div>');
  });

  if (items.length === 0) {
    ve.innerHTML = '<div class="vuln-empty"><i class="fas fa-shield-check"></i><br>Уязвимости не обнаружены</div>';
  } else {
    ve.innerHTML = items.join('');
  }

  // Tech
  var te = H.id('resultsTech');
  if (r.tech.length > 0) {
    te.innerHTML = '<h4>Стек технологий</h4>' +
      r.tech.map(function(t) { return '<span class="tech-tag">' + t + '</span>'; }).join('');
  } else {
    te.innerHTML = '<h4>Стек технологий</h4><span style="color:var(--text-faint);font-size:0.8rem;">Не определено</span>';
  }
}

// ======== HISTORY ========
function saveHistory(r) {
  try {
    var raw = localStorage.getItem('cyberscan_hist');
    var list = raw ? JSON.parse(raw) : [];
    list.unshift({ url: r.target, date: r.date, vulns: r.vulns.length, grade: r.grade });
    if (list.length > 20) list = list.slice(0, 20);
    localStorage.setItem('cyberscan_hist', JSON.stringify(list));
    renderHistory();
  } catch(e) {}
}

function renderHistory() {
  var raw = localStorage.getItem('cyberscan_hist');
  var list = raw ? JSON.parse(raw) : [];
  var el = H.id('historyList');
  if (!list.length) {
    el.innerHTML = '<div class="history-empty">Пока пусто — запустите первое сканирование</div>';
    return;
  }
  el.innerHTML = list.map(function(i) {
    var d = new Date(i.date);
    var ds = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    var cls = i.vulns === 0 ? 'stat-passed' : 'stat-critical';
    return '<div class="history-item" onclick="replayScan(\'' + i.url + '\')">' +
      '<span class="hi-url">' + esc(i.url) + ' <span class="hi-badge ' + cls + '">' + i.grade + '</span></span>' +
      '<span class="hi-meta"><span>' + ds + '</span><span class="hi-badge ' + cls + '">' + i.vulns + ' уязв.</span></span>' +
    '</div>';
  }).join('');
}

window.replayScan = function(url) { H.id('targetUrl').value = url; startScan(); };
window.clearHistory = function() { localStorage.removeItem('cyberscan_hist'); renderHistory(); };

// ======== EXPORT ========
window.exportJSON = function() {
  if (!lastResults) return toast('Нет результатов');
  var blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scan-' + new URL(lastResults.target).hostname + '.json';
  a.click();
};

window.copyReport = function() {
  if (!lastResults) return toast('Нет результатов');
  var lines = [
    'Cyber-Scanner Report — ' + lastResults.grade,
    'Target: ' + lastResults.target,
    'Date: ' + new Date(lastResults.date).toLocaleString(),
    'Duration: ' + lastResults.time + 's',
    '',
    'Vulnerabilities:',
    lastResults.vulns.map(function(v) { return '  [' + v.severity.toUpperCase() + '] ' + v.type + ': ' + v.desc; }).join('\n'),
    '',
    'Tech: ' + lastResults.tech.join(', '),
    '',
    'Info:', lastResults.info.map(function(i) { return '  ' + i.type + ': ' + i.desc; }).join('\n')
  ].join('\n');
  navigator.clipboard.writeText(lines).then(function() { toast('Отчёт скопирован'); }).catch(function() { toast('Ошибка копирования'); });
};

window.quickScan = function(url) { H.id('targetUrl').value = url; startScan(); };

// ======== UTILS ========
function url() { return targetURL.replace('/?', '?').replace(/\/$/, ''); }
function resetScan() { vulns = []; infoItems = []; passedTests = 0; totalTests = 0; lastResults = null; techList = []; pageHTML = ''; var log = H.id('progressLog'); if (log) log.innerHTML = ''; }

document.addEventListener('DOMContentLoaded', function() {
  renderHistory();
  var inp = H.id('targetUrl');
  if (inp) inp.addEventListener('keypress', function(e) { if (e.key === 'Enter') startScan(); });
});

})();
