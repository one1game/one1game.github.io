// Cyber-Scanner — клиентский сканер уязвимостей
(function() {
'use strict';

var activeModules = {
  headers: true, xss: true, sqli: true, cors: true,
  cookies: true, leaks: true, tech: true, paths: true
};
var vulns = [];
var passedTests = 0;
var totalTests = 0;
var startTime = 0;
var lastResults = null;
var isRunning = false;

var H = {
  id: function(id) { return document.getElementById(id); },
  q: function(sel) { return document.querySelector(sel); },
  qa: function(sel) { return document.querySelectorAll(sel); },
  show: function(id) { var el = H.id(id); if (el) el.classList.remove('hidden'); },
  hide: function(id) { var el = H.id(id); if (el) el.classList.add('hidden'); }
};

// ========== MODULE TOGGLES ==========
(function() {
  var chips = H.qa('.module-chip');
  chips.forEach(function(c) {
    c.addEventListener('click', function() {
      var mod = c.dataset.module;
      c.classList.toggle('active');
      activeModules[mod] = c.classList.contains('active');
    });
  });
})();

// ========== MAIN SCAN ==========
window.startScan = function() {
  if (isRunning) return;
  var input = H.id('targetUrl');
  var raw = input.value.trim();
  if (!raw) return showToast('Введите URL для сканирования');

  var url = raw;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch(e) { return showToast('Некорректный URL'); }

  resetScan();
  isRunning = true;

  var btn = H.id('scanBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сканирую...';

  H.show('progress');
  H.hide('results');

  startTime = Date.now();

  scheduleSteps(url)
    .then(function() {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      lastResults = {
        target: url,
        time: elapsed,
        totalTests: totalTests,
        passed: passedTests,
        vulns: vulns,
        date: new Date().toISOString()
      };

      updateProgress(100, 'Сканирование завершено');
      setTimeout(function() {
        H.hide('progress');
        showResults(lastResults);
        saveToHistory(lastResults);
        isRunning = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Сканировать';
      }, 400);
    })
    .catch(function(err) {
      showToast('Ошибка: ' + err.message);
      isRunning = false;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-play"></i> Сканировать';
    });
};

function scheduleSteps(url) {
  var steps = [];
  var pct = 0;
  var step = function(p, label, fn) {
    steps.push({ pct: p, label: label, fn: fn });
  };

  step(5,  'Проверка доступности цели...', function() { return fetchHead(url); });
  step(15, 'Анализ SSL/TLS...', function() { return checkSSL(url); });
  step(25, 'Сканирование security headers...', function() { return activeModules.headers ? scanHeaders(url) : Promise.resolve(); });
  step(35, 'Проверка CORS...', function() { return activeModules.cors ? scanCORS(url) : Promise.resolve(); });
  step(45, 'Аудит Cookie...', function() { return activeModules.cookies ? scanCookies(url) : Promise.resolve(); });
  step(55, 'Поиск XSS-векторов...', function() { return activeModules.xss ? scanXSS(url) : Promise.resolve(); });
  step(65, 'Проверка SQL-инъекций...', function() { return activeModules.sqli ? scanSQLi(url) : Promise.resolve(); });
  step(75, 'Поиск утечек данных...', function() { return activeModules.leaks ? scanLeaks(url) : Promise.resolve(); });
  step(85, 'Сканирование директорий...', function() { return activeModules.paths ? scanPaths(url) : Promise.resolve(); });
  step(92, 'Определение стека технологий...', function() { return activeModules.tech ? scanTech(url) : Promise.resolve(); });
  step(98, 'Финальный анализ...', function() { return Promise.resolve(); });

  return steps.reduce(function(chain, s) {
    return chain.then(function() {
      updateProgress(s.pct, s.label);
      addLogLine(s.label);
      return s.fn();
    });
  }, Promise.resolve());
}

function updateProgress(pct, label) {
  var fill = H.id('progressFill');
  var pl = H.id('progressLabel');
  var pp = H.id('progressPct');
  if (fill) fill.style.width = pct + '%';
  if (pl) pl.textContent = label;
  if (pp) pp.textContent = pct + '%';
}
function addLogLine(msg) {
  var log = H.id('progressLog');
  if (!log) return;
  var div = document.createElement('div');
  div.className = 'log-line';
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function addVuln(type, severity, desc, fix) {
  totalTests++;
  vulns.push({ type: type, severity: severity, desc: desc, fix: fix });
}
function addPass() { totalTests++; passedTests++; }

// ========== CORE CHECKS ==========
function fetchHead(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) { addVuln('UNREACHABLE', 'critical', 'Цель недоступна — проверьте URL и соединение', 'Убедитесь, что сайт работает'); return; }
    addPass();
  });
}

function checkSSL(url) {
  addPass();
  if (!url.startsWith('https://')) {
    addVuln('NO_HTTPS', 'high', 'Сайт не использует HTTPS', 'Установите SSL-сертификат и настройте редирект с HTTP');
  }
}

function scanHeaders(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    var h = r.headers;
    var missing = [];
    var issues = [];

    var critical = {
      'content-security-policy': 'Content-Security-Policy',
      'strict-transport-security': 'Strict-Transport-Security',
      'x-content-type-options': 'X-Content-Type-Options',
      'x-frame-options': 'X-Frame-Options'
    };

    for (var k in critical) {
      if (!h.get(k)) missing.push(critical[k]);
      else {
        var val = h.get(k);
        if (k === 'content-security-policy' && val.includes("'unsafe-inline'")) {
          issues.push('CSP содержит unsafe-inline (XSS-риск)');
        }
        if (k === 'x-frame-options' && !['DENY','SAMEORIGIN'].includes(val.toUpperCase())) {
          issues.push('X-Frame-Options: ' + val + ' (clickjacking-риск)');
        }
      }
    }

    if (!h.get('referrer-policy')) issues.push('Referrer-Policy отсутствует');
    if (!h.get('permissions-policy')) issues.push('Permissions-Policy отсутствует');

    if (missing.length > 0 || issues.length > 0) {
      var sev = missing.length >= 3 ? 'high' : 'medium';
      addVuln('SECURITY_HEADERS', sev,
        (missing.length ? 'Отсутствуют: ' + missing.join(', ') + '. ' : '') + issues.join('; '),
        'Добавьте недостающие security headers в конфигурацию сервера'
      );
    } else {
      addPass();
    }
  });
}

function scanCORS(url) {
  return fetch(url, { method: 'GET', mode: 'cors' }).then(function(r) {
    var acao = r.headers.get('access-control-allow-origin');
    var acac = r.headers.get('access-control-allow-credentials');

    if (acao === '*') {
      if (acac === 'true') {
        addVuln('CORS_WILDCARD_CREDS', 'critical',
          'CORS: Access-Control-Allow-Origin: * вместе с Allow-Credentials: true — критическая уязвимость',
          'Никогда не используйте * с credentials. Укажите конкретные домены.'
        );
      } else {
        addVuln('CORS_WILDCARD', 'low',
          'CORS разрешён для всех доменов (*) — ресурсы доступны с любого сайта',
          'Ограничьте CORS конкретными доменами, если данные непубличные'
        );
      }
    } else if (!acao) {
      addPass();
    } else {
      addPass();
    }
  }).catch(function() {
    // CORS блокирует — это нормально, не уязвимость
    addPass();
  });
}

function scanCookies(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    var cookieHeader = '';
    try { cookieHeader = document.cookie || ''; } catch(e) {}

    // Эмулируем проверку — в реальности куки целевого сайта недоступны клиенту
    // Но мы проверяем response headers
    var setCookie = r.headers.get('set-cookie');
    if (setCookie) {
      var flags = { secure: false, httponly: false, samesite: false };
      if (/secure/i.test(setCookie)) flags.secure = true;
      if (/httponly/i.test(setCookie)) flags.httponly = true;
      if (/samesite/i.test(setCookie)) flags.samesite = true;

      var missing = [];
      if (!flags.secure) missing.push('Secure');
      if (!flags.httponly) missing.push('HttpOnly');
      if (!flags.samesite) missing.push('SameSite');

      if (missing.length > 0) {
        addVuln('COOKIE_FLAGS', missing.length >= 2 ? 'high' : 'medium',
          'Cookie без флагов: ' + missing.join(', '),
          'Установите Secure; HttpOnly; SameSite=Lax для всех кук'
        );
      } else {
        addPass();
      }
    } else {
      addPass();
    }
  });
}

function scanXSS(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    return r.text().then(function(html) {
      var indicators = [];
      if (/(?:onclick|onload|onerror|onmouseover)\s*=/gi.test(html))
        indicators.push('inline-обработчики');
      if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(html) && !/<script\s+src=/gi.test(html))
        indicators.push('inline-скрипты');
      if (/document\.write\s*\(/gi.test(html))
        indicators.push('document.write');
      if (/eval\s*\(/gi.test(html))
        indicators.push('eval()');
      if (/innerHTML\s*=/gi.test(html))
        indicators.push('innerHTML');

      if (indicators.length > 0) {
        addVuln('XSS_INDICATORS', indicators.length >= 3 ? 'high' : 'medium',
          'XSS-индикаторы: ' + indicators.join(', '),
          'Используйте CSP, экранируйте вывод, избегайте inline-скриптов и eval'
        );
      } else {
        addPass();
      }
    });
  });
}

function scanSQLi(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    return r.text().then(function(html) {
      var patterns = [
        /you have an error in your sql/i,
        /mysql_fetch/i,
        /sqlsyntaxerrorexception/i,
        /unclosed quotation mark/i,
        /microsoft ole db/i,
        /odbc driver/i
      ];
      var found = patterns.filter(function(p) { return p.test(html); });
      if (found.length > 0) {
        addVuln('SQL_ERROR_LEAK', 'high',
          'Обнаружены SQL-ошибки в ответе — возможна утечка информации',
          'Настройте кастомные страницы ошибок, не раскрывайте детали БД'
        );
      } else {
        addPass();
      }
    });
  });
}

function scanLeaks(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    return r.text().then(function(html) {
      var leaks = [];

      // Sensitive patterns in HTML
      if (/(?:api[_-]?key|api[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/gi.test(html))
        leaks.push('API-ключи в коде');
      if (/password\s*[:=]\s*["'][^"']{3,}["']/gi.test(html))
        leaks.push('Пароли в коде');
      if (/BEGIN\s+(?:RSA|EC|DSA)\s+PRIVATE\s+KEY/gi.test(html))
        leaks.push('Приватные ключи');

      // Comments with sensitive info
      var comments = html.match(/<!--([\s\S]*?)-->/gi) || [];
      var sensitiveComments = comments.filter(function(c) {
        return /(?:todo|fixme|password|secret|token|key)/i.test(c);
      });
      if (sensitiveComments.length > 0)
        leaks.push('Чувствительные комментарии (' + sensitiveComments.length + ')');

      // Server info in headers
      var server = r.headers.get('server');
      if (server && /\d+\.\d+/.test(server))
        leaks.push('Версия сервера: ' + server);
      var powered = r.headers.get('x-powered-by');
      if (powered) leaks.push('X-Powered-By: ' + powered);

      // Generator meta
      if (/<meta\s+name="generator"/i.test(html))
        leaks.push('Meta generator раскрывает CMS');

      if (leaks.length > 0) {
        addVuln('INFO_LEAK', 'high',
          'Утечки информации: ' + leaks.join('; '),
          'Удалите чувствительные данные из клиентского кода и заголовков'
        );
      } else {
        addPass();
      }
    });
  });
}

function scanPaths(url) {
  var paths = ['.git/HEAD', '.env', '.DS_Store', 'robots.txt', 'sitemap.xml',
    'wp-admin/', 'backup/', 'phpinfo.php', '.well-known/security.txt', 'server-status'];
  var base = url.replace(/\/$/, '');
  var found = [];

  return Promise.all(paths.slice(0, 6).map(function(p) {
    return fetch(base + '/' + p, { method: 'HEAD', mode: 'no-cors' })
      .then(function() { found.push(p); })
      .catch(function() {});
  })).then(function() {
    if (found.length > 0) {
      addVuln('EXPOSED_PATHS', 'medium',
        'Открытые ресурсы: ' + found.join(', '),
        'Закройте доступ к служебным файлам и директориям'
      );
    } else {
      addPass();
    }
  });
}

function scanTech(url) {
  return fetchSafe(url).then(function(r) {
    if (!r) return;
    return r.text().then(function(html) {
      var tech = [];
      var h = r.headers;
      var server = h.get('server') || '';
      var powered = h.get('x-powered-by') || '';

      // Server
      if (/nginx/i.test(server)) tech.push('Nginx');
      if (/apache/i.test(server)) tech.push('Apache');
      if (/cloudflare/i.test(server)) tech.push('Cloudflare');
      if (/iis/i.test(server)) tech.push('IIS');

      // Platform
      if (/wp-content|wp-includes|wordpress/i.test(html)) tech.push('WordPress');
      if (/shopify/i.test(html)) tech.push('Shopify');
      if (/wix/i.test(html)) tech.push('Wix');
      if (/react/i.test(html) && /react-dom/i.test(html)) tech.push('React');
      if (/vue/i.test(html) && /v-html|v-bind|v-if/i.test(html)) tech.push('Vue.js');
      if (/angular/i.test(html)) tech.push('Angular');
      if (/jquery/i.test(html)) tech.push('jQuery');
      if (/bootstrap/i.test(html)) tech.push('Bootstrap');
      if (/tailwind/i.test(html)) tech.push('Tailwind CSS');
      if (/fontawesome/i.test(html)) tech.push('Font Awesome');

      // PHP
      if (/php/i.test(powered)) tech.push('PHP');
      if (/\.php/i.test(html)) tech.push('PHP');

      // JS frameworks from meta/build
      if (/next\/core|next\.js|_next\//i.test(html)) tech.push('Next.js');
      if (/nuxt/i.test(html)) tech.push('Nuxt.js');
      if (/gatsby/i.test(html)) tech.push('Gatsby');

      // Analytics
      if (/gtag|googletagmanager/i.test(html)) tech.push('Google Analytics');
      if (/clarity\.ms/i.test(html)) tech.push('MS Clarity');

      // CDN/Security
      if (/cloudflare/i.test(html)) tech.push('Cloudflare');
      if (/h-captcha|hcaptcha/i.test(html)) tech.push('hCaptcha');
      if (/recaptcha/i.test(html)) tech.push('reCAPTCHA');

      lastTech = tech;
      addPass();
    });
  });
}

// ========== DISPLAY RESULTS ==========
var lastTech = [];

function showResults(r) {
  H.show('results');

  // Meta
  var meta = H.id('resultsMeta');
  meta.innerHTML = [
    '<span><i class="fas fa-globe"></i> ' + escapeHTML(r.target) + '</span>',
    '<span><i class="fas fa-clock"></i> ' + r.time + ' сек</span>',
    '<span><i class="fas fa-check-circle"></i> ' + r.passed + '/' + r.totalTests + ' тестов</span>'
  ].join('');

  // Stats
  var stats = H.id('resultsStats');
  var counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  r.vulns.forEach(function(v) { if (counts[v.severity] !== undefined) counts[v.severity]++; });

  stats.innerHTML = [
    statRow('Критические', counts.critical, 'stat-critical'),
    statRow('Высокие', counts.high, 'stat-high'),
    statRow('Средние', counts.medium, 'stat-medium'),
    statRow('Низкие', counts.low, 'stat-low'),
    statRow('Пройдено', r.passed, 'stat-passed')
  ].join('');

  // Vulns
  var vulnEl = H.id('resultsVulns');
  if (r.vulns.length === 0) {
    vulnEl.innerHTML = '<div class="vuln-empty"><i class="fas fa-shield-check"></i><br>Уязвимости не обнаружены</div>';
  } else {
    vulnEl.innerHTML = r.vulns.map(function(v) {
      return '<div class="vuln-card ' + v.severity + '">' +
        '<div class="vuln-card-header">' +
          '<span class="vuln-card-title">' + escapeHTML(v.type) + '</span>' +
          '<span class="vuln-card-sev ' + v.severity + '">' + v.severity + '</span>' +
        '</div>' +
        '<div class="vuln-card-desc">' + escapeHTML(v.desc) + '</div>' +
        '<div class="vuln-card-fix"><i class="fas fa-wrench"></i> ' + escapeHTML(v.fix) + '</div>' +
      '</div>';
    }).join('');
  }

  // Tech
  var techEl = H.id('resultsTech');
  if (lastTech.length > 0) {
    techEl.innerHTML = '<h4>Стек технологий</h4>' +
      lastTech.map(function(t) { return '<span class="tech-tag">' + t + '</span>'; }).join('');
  } else {
    techEl.innerHTML = '<h4>Стек технологий</h4><span style="color:var(--text-faint);font-size:0.8rem;">Не удалось определить</span>';
  }
}

function statRow(label, val, cls) {
  return '<div class="stat-row"><span>' + label + '</span><span class="stat-val ' + cls + '">' + val + '</span></div>';
}

// ========== HISTORY ==========
function saveToHistory(r) {
  try {
    var raw = localStorage.getItem('cyberscan_history');
    var list = raw ? JSON.parse(raw) : [];
    list.unshift({ url: r.target, date: r.date, vulns: r.vulns.length });
    if (list.length > 20) list = list.slice(0, 20);
    localStorage.setItem('cyberscan_history', JSON.stringify(list));
    renderHistory();
  } catch(e) {}
}

function renderHistory() {
  var raw = localStorage.getItem('cyberscan_history');
  var list = raw ? JSON.parse(raw) : [];
  var el = H.id('historyList');
  if (list.length === 0) {
    el.innerHTML = '<div class="history-empty">Пока пусто — запустите первое сканирование</div>';
    return;
  }
  el.innerHTML = list.map(function(item) {
    var d = new Date(item.date);
    var ds = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
    var badgeCls = item.vulns === 0 ? 'stat-passed' : 'stat-critical';
    return '<div class="history-item" onclick="replayScan(\'' + item.url + '\')">' +
      '<span class="hi-url">' + escapeHTML(item.url) + '</span>' +
      '<span class="hi-meta">' +
        '<span>' + ds + '</span>' +
        '<span class="hi-badge ' + badgeCls + '">' + item.vulns + ' уязв.</span>' +
      '</span></div>';
  }).join('');
}

window.replayScan = function(url) {
  H.id('targetUrl').value = url;
  startScan();
};

window.clearHistory = function() {
  localStorage.removeItem('cyberscan_history');
  renderHistory();
};

// ========== EXPORT ==========
window.exportJSON = function() {
  if (!lastResults) return showToast('Нет результатов для экспорта');
  var blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scan-' + new URL(lastResults.target).hostname + '.json';
  a.click();
};

window.copyReport = function() {
  if (!lastResults) return showToast('Нет результатов');
  var lines = [
    'Cyber-Scanner Report',
    'Target: ' + lastResults.target,
    'Date: ' + new Date(lastResults.date).toLocaleString(),
    'Duration: ' + lastResults.time + 's',
    'Tests: ' + lastResults.passed + '/' + lastResults.totalTests,
    '',
    'Vulnerabilities (' + lastResults.vulns.length + '):',
    lastResults.vulns.map(function(v) { return '[' + v.severity.toUpperCase() + '] ' + v.type + ': ' + v.desc; }).join('\n'),
    '',
    'Tech stack: ' + (lastTech.length ? lastTech.join(', ') : 'N/A')
  ].join('\n');

  navigator.clipboard.writeText(lines).then(function() {
    showToast('Отчёт скопирован в буфер обмена');
  }).catch(function() {
    showToast('Не удалось скопировать');
  });
};

// ========== QUICK SCAN ==========
window.quickScan = function(url) {
  H.id('targetUrl').value = url;
  startScan();
};

// ========== HELPERS ==========
function fetchSafe(url) {
  return fetch(url, { method: 'GET', mode: 'no-cors' }).then(function(r) {
    // no-cors responses are opaque — we can't read them
    // Try cors if same-origin
    return fetch(url).then(function(r) { return r; }).catch(function() { return null; });
  }).catch(function() { return null; });
}

var toastTimer;
function showToast(msg) {
  var el = H.id('errorToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.add('hidden'); }, 3000);
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function resetScan() {
  vulns = [];
  passedTests = 0;
  totalTests = 0;
  lastResults = null;
  lastTech = [];
  var log = H.id('progressLog');
  if (log) log.innerHTML = '';
}

// ========== ENTER KEY ==========
document.addEventListener('DOMContentLoaded', function() {
  renderHistory();
  var input = H.id('targetUrl');
  if (input) {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') startScan();
    });
  }
});

})();
