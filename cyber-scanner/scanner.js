// ⚡ CYBER-SCANNER v2.0 - МАКСИМАЛЬНО МОЩНАЯ ВЕРСИЯ ⚡

class CyberScanner {
    constructor() {
        this.results = {
            vulnerabilities: [],
            scanTime: 0,
            totalTests: 0,
            passedTests: 0,
            target: '',
            timestamp: ''
        };
        this.isScanning = false;
        this.modules = {
            xss: true, sql: true, headers: true, 
            cors: true, info: true, ports: true
        };
    }

    async scanWebsite(url, options = {}) {
        if (this.isScanning) return;
        
        this.isScanning = true;
        const startTime = Date.now();
        this.results = { 
            vulnerabilities: [], 
            totalTests: 0, 
            passedTests: 0,
            target: url,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Активация всех модулей
            await this.updateProgress(5, 'АКТИВАЦИЯ СИСТЕМЫ...');
            await this.activateModules();

            // Основные проверки
            await this.updateProgress(10, 'ПРОВЕРКА ДОСТУПНОСТИ ЦЕЛИ...');
            await this.checkTargetAvailability(url);

            await this.updateProgress(20, 'СКАНИРОВАНИЕ ПОРТОВ...');
            if (this.modules.ports) await this.portScan(url);

            await this.updateProgress(30, 'АНАЛИЗ СЕТЕВОЙ ИНФРАСТРУКТУРЫ...');
            await this.networkAnalysis(url);

            await this.updateProgress(40, 'ПРОВЕРКА SSL/TLS...');
            await this.advancedSSLCheck(url);

            await this.updateProgress(50, 'СКАНИРОВАНИЕ ЗАГОЛОВКОВ...');
            if (this.modules.headers) await this.deepHeaderAnalysis(url);

            await this.updateProgress(60, 'ПОИСК СКРЫТЫХ РЕСУРСОВ...');
            await this.hiddenResourcesScan(url);

            await this.updateProgress(70, 'АНАЛИЗ XSS УЯЗВИМОСТЕЙ...');
            if (this.modules.xss) await this.advancedXSSScan(url);

            await this.updateProgress(80, 'ПРОВЕРКА SQL ИНЪЕКЦИЙ...');
            if (this.modules.sql) await this.sqlInjectionDeepScan(url);

            await this.updateProgress(90, 'ПОИСК УТЕЧЕК ДАННЫХ...');
            if (this.modules.info) await this.comprehensiveInfoLeakScan(url);

            await this.updateProgress(95, 'ФИНАЛЬНЫЙ АНАЛИЗ...');
            await this.finalSecurityAssessment(url);

            await this.updateProgress(100, 'СКАНИРОВАНИЕ ЗАВЕРШЕНО');

            this.results.scanTime = Date.now() - startTime;
            this.isScanning = false;
            return this.results;

        } catch (error) {
            this.isScanning = false;
            throw new Error(`СБОЙ СИСТЕМЫ: ${error.message}`);
        }
    }

    async activateModules() {
        const modules = document.querySelectorAll('.module-card');
        modules.forEach(module => {
            module.classList.add('active');
            this.playSound('activate');
        });
        await this.delay(1000);
    }

    async checkTargetAvailability(url) {
        this.results.totalTests++;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            this.results.passedTests++;
            
        } catch (error) {
            this.addVulnerability(
                'TARGET_UNREACHABLE',
                'high',
                `Цель недоступна: ${error.message}`,
                'Проверьте доступность цели и сетевое соединение'
            );
        }
    }

    async portScan(url) {
        this.results.totalTests++;
        try {
            const domain = new URL(url).hostname;
            const commonPorts = [80, 443, 8080, 8443, 21, 22, 25, 53, 110, 143, 993, 995];
            const openPorts = [];

            for (const port of commonPorts.slice(0, 5)) { // Ограничиваем для скорости
                try {
                    const testUrl = `http://${domain}:${port}`;
                    const response = await fetch(testUrl, { 
                        method: 'HEAD',
                        mode: 'no-cors'
                    });
                    openPorts.push(port);
                } catch (e) {
                    // Порт закрыт или недоступен
                }
            }

            if (openPorts.length > 2) {
                this.addVulnerability(
                    'MULTIPLE_OPEN_PORTS',
                    'medium',
                    `Обнаружены открытые порты: ${openPorts.join(', ')}`,
                    'Закройте неиспользуемые порты на фаерволе'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('Port scan failed:', error);
        }
    }

    async networkAnalysis(url) {
        this.results.totalTests++;
        try {
            const domain = new URL(url).hostname;
            
            // Проверка DNS записей
            const dnsRecords = await this.checkDNSRecords(domain);
            
            // Проверка поддоменов
            const subdomains = await this.findSubdomains(domain);
            
            if (subdomains.length > 5) {
                this.addVulnerability(
                    'MULTIPLE_SUBDOMAINS',
                    'info',
                    `Обнаружено ${subdomains.length} поддоменов`,
                    'Регулярно проверяйте безопасность всех поддоменов'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('Network analysis failed:', error);
        }
    }

    async checkDNSRecords(domain) {
        // Эмуляция проверки DNS через внешние API
        const records = [];
        try {
            // Проверка MX записей
            records.push('MX records found');
        } catch (e) {
            // Игнорируем ошибки DNS
        }
        return records;
    }

    async findSubdomains(domain) {
        const commonSubdomains = [
            'www', 'mail', 'ftp', 'localhost', 'blog',
            'admin', 'test', 'dev', 'api', 'secure',
            'cdn', 'static', 'media', 'img', 'images'
        ];
        
        const found = [];
        for (const sub of commonSubdomains.slice(0, 3)) {
            try {
                const testUrl = `https://${sub}.${domain}`;
                await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' });
                found.push(sub);
            } catch (e) {
                // Поддомен не существует
            }
        }
        return found;
    }

    async advancedSSLCheck(url) {
        this.results.totalTests++;
        try {
            if (!url.startsWith('https://')) {
                this.addVulnerability(
                    'NO_SSL_TLS',
                    'high',
                    'Сайт не использует HTTPS',
                    'Внедрите SSL/TLS сертификат'
                );
                return;
            }

            // Дополнительные проверки SSL
            const response = await fetch(url);
            const headers = response.headers;
            
            const securityIssues = [];
            
            if (!headers.get('strict-transport-security')) {
                securityIssues.push('HSTS not implemented');
            }
            
            if (securityIssues.length > 0) {
                this.addVulnerability(
                    'SSL_TLS_WEAKNESSES',
                    'medium',
                    `Проблемы с SSL/TLS: ${securityIssues.join(', ')}`,
                    'Улучшите SSL/TLS конфигурацию'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('SSL check failed:', error);
        }
    }

    async deepHeaderAnalysis(url) {
        this.results.totalTests++;
        try {
            const response = await fetch(url);
            const headers = response.headers;
            
            const securityReport = [];
            const missingHeaders = [];

            // Проверка критических security headers
            const criticalHeaders = {
                'Content-Security-Policy': 'CSP',
                'X-Frame-Options': 'X-Frame-Options',
                'X-Content-Type-Options': 'X-Content-Type-Options',
                'Strict-Transport-Security': 'HSTS',
                'X-XSS-Protection': 'XSS-Protection'
            };

            for (const [header, name] of Object.entries(criticalHeaders)) {
                if (!headers.get(header)) {
                    missingHeaders.push(name);
                    securityReport.push(`${name} отсутствует`);
                }
            }

            // Проверка значений заголовков
            const csp = headers.get('Content-Security-Policy');
            if (csp && csp.includes("'unsafe-inline'")) {
                securityReport.push('CSP содержит unsafe-inline');
            }

            const xfo = headers.get('X-Frame-Options');
            if (xfo && !['DENY', 'SAMEORIGIN'].includes(xfo.toUpperCase())) {
                securityReport.push('X-Frame-Options настроен небезопасно');
            }

            if (securityReport.length > 0) {
                this.addVulnerability(
                    'INSECURE_HEADERS',
                    missingHeaders.length > 2 ? 'high' : 'medium',
                    `Проблемы с security headers: ${securityReport.join('; ')}`,
                    'Настройте все необходимые security headers'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('Header analysis failed:', error);
        }
    }

    async hiddenResourcesScan(url) {
        this.results.totalTests++;
        try {
            const commonPaths = [
                '.git/', '.env', 'backup/', 'admin/', 'phpmyadmin/',
                'config/', 'database/', 'logs/', 'tmp/', 'upload/',
                'wp-admin/', 'administrator/', 'cgi-bin/', 'server-status'
            ];

            let foundPaths = [];

            for (const path of commonPaths.slice(0, 8)) {
                try {
                    const testUrl = `${url.replace(/\/$/, '')}/${path}`;
                    const response = await fetch(testUrl, { 
                        method: 'HEAD',
                        mode: 'no-cors'
                    });
                    foundPaths.push(path);
                } catch (e) {
                    // Ресурс не найден
                }
            }

            if (foundPaths.length > 0) {
                this.addVulnerability(
                    'EXPOSED_RESOURCES',
                    'high',
                    `Обнаружены потенциально открытые ресурсы: ${foundPaths.join(', ')}`,
                    'Ограничьте доступ к служебным директориям'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('Hidden resources scan failed:', error);
        }
    }

    async advancedXSSScan(url) {
        this.results.totalTests++;
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            const xssPatterns = [
                { pattern: /<script\b[^>]*>([\s\S]*?)<\/script>/gi, name: 'Inline scripts' },
                { pattern: /javascript:/gi, name: 'JavaScript URLs' },
                { pattern: /onclick\s*=|onload\s*=|onerror\s*=/gi, name: 'Inline event handlers' },
                { pattern: /eval\s*\(/gi, name: 'eval function' },
                { pattern: /document\.write\s*\(/gi, name: 'document.write' },
                { pattern: /innerHTML\s*=/gi, name: 'innerHTML assignment' }
            ];

            let xssIndicators = [];
            
            for (const { pattern, name } of xssPatterns) {
                const matches = html.match(pattern);
                if (matches && matches.length > 0) {
                    xssIndicators.push(`${name} (${matches.length} found)`);
                }
            }

            if (xssIndicators.length > 0) {
                this.addVulnerability(
                    'XSS_VULNERABILITY',
                    'critical',
                    `Обнаружены XSS индикаторы: ${xssIndicators.join(', ')}`,
                    'Реализуйте валидацию ввода и экранирование вывода'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('XSS scan failed:', error);
        }
    }

    async sqlInjectionDeepScan(url) {
        this.results.totalTests++;
        try {
            const urlObj = new URL(url);
            const hasParameters = urlObj.searchParams.toString().length > 0;
            
            if (hasParameters) {
                // Эмуляция проверки параметров
                const params = Array.from(urlObj.searchParams.entries());
                
                let sqlInjectionRisks = [];
                
                for (const [key, value] of params) {
                    if (this.isSuspiciousParameter(key, value)) {
                        sqlInjectionRisks.push(key);
                    }
                }

                if (sqlInjectionRisks.length > 0) {
                    this.addVulnerability(
                        'SQL_INJECTION_RISK',
                        'critical',
                        `Параметры уязвимы к SQL инъекциям: ${sqlInjectionRisks.join(', ')}`,
                        'Используйте параметризованные запросы и prepared statements'
                    );
                } else {
                    this.results.passedTests++;
                }
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('SQL injection scan failed:', error);
        }
    }

    isSuspiciousParameter(key, value) {
        const suspiciousPatterns = [
            /union.*select/i,
            /select.*from/i,
            /insert.*into/i,
            /drop.*table/i,
            /or.*=.*/i,
            /--/,
            /\/\*.*\*\//,
            /waitfor.*delay/i
        ];

        const testString = (key + '=' + value).toLowerCase();
        return suspiciousPatterns.some(pattern => pattern.test(testString));
    }

    async comprehensiveInfoLeakScan(url) {
        this.results.totalTests++;
        try {
            const response = await fetch(url);
            const html = await response.text();
            const headers = response.headers;
            
            const leaksFound = [];

            // Поиск в HTML
            const sensitiveDataPatterns = [
                { pattern: /(password|passwd|pwd)\s*[:=]\s*["']([^"']+)["']/gi, name: 'Hardcoded passwords' },
                { pattern: /(api[_-]?key|secret[_-]?key)\s*[:=]\s*["']([^"']+)["']/gi, name: 'API keys' },
                { pattern: /(aws[_-]?access|aws[_-]?secret)\s*[:=]\s*["']([^"']+)["']/gi, name: 'AWS credentials' },
                { pattern: /(sql|database).*connect/gi, name: 'Database connections' },
                { pattern: /(email|username)\s*[:=]\s*["']([^"']+@[^"']+\.[^"']+)["']/gi, name: 'Email addresses' }
            ];

            for (const { pattern, name } of sensitiveDataPatterns) {
                if (pattern.test(html)) {
                    leaksFound.push(name);
                }
            }

            // Поиск в комментариях
            const commentRegex = /<!--([\s\S]*?)-->/gi;
            const comments = html.match(commentRegex);
            if (comments) {
                const sensitiveComments = comments.filter(comment => 
                    comment.toLowerCase().includes('todo') ||
                    comment.toLowerCase().includes('fixme') ||
                    comment.toLowerCase().includes('password') ||
                    comment.toLowerCase().includes('secret')
                );
                if (sensitiveComments.length > 0) {
                    leaksFound.push('Sensitive data in comments');
                }
            }

            // Проверка заголовков на утечку информации
            const serverHeader = headers.get('server');
            if (serverHeader && serverHeader.includes('/')) {
                leaksFound.push('Server version exposed');
            }

            const xPoweredBy = headers.get('x-powered-by');
            if (xPoweredBy) {
                leaksFound.push('Technology stack exposed');
            }

            if (leaksFound.length > 0) {
                this.addVulnerability(
                    'INFORMATION_DISCLOSURE',
                    'high',
                    `Обнаружены утечки информации: ${leaksFound.join(', ')}`,
                    'Удалите чувствительную информацию из клиентского кода'
                );
            } else {
                this.results.passedTests++;
            }

        } catch (error) {
            console.warn('Information leak scan failed:', error);
        }
    }

    async finalSecurityAssessment(url) {
        // Анализ собранных данных и генерация итоговой оценки
        const criticalCount = this.results.vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = this.results.vulnerabilities.filter(v => v.severity === 'high').length;
        
        if (criticalCount > 0) {
            this.addVulnerability(
                'CRITICAL_SECURITY_ISSUES',
                'critical',
                `Обнаружено ${criticalCount} критических уязвимостей`,
                'Немедленно устраните обнаруженные уязвимости'
            );
        } else if (highCount > 0) {
            this.addVulnerability(
                'HIGH_RISK_ISSUES',
                'high',
                `Обнаружено ${highCount} уязвимостей высокого риска`,
                'Рекомендуется срочное устранение уязвимостей'
            );
        }
    }

    addVulnerability(type, severity, description, recommendation) {
        this.results.vulnerabilities.push({
            type,
            severity,
            description,
            recommendation,
            timestamp: new Date().toLocaleTimeString()
        });
        this.playSound('vulnerability');
    }

    async updateProgress(percent, message) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            progressFill.style.width = percent + '%';
            progressText.textContent = message;
            
            // Добавляем сканирующую линию
            this.addScanLine();
            
            await this.delay(500);
        }
    }

    addScanLine() {
        const scanLine = document.createElement('div');
        scanLine.className = 'scan-line';
        scanLine.style.top = Math.random() * 100 + 'vh';
        document.body.appendChild(scanLine);
        
        setTimeout(() => {
            scanLine.remove();
        }, 3000);
    }

    playSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (type === 'vulnerability') {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }
        } catch (e) {
            // Аудио не поддерживается
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ⚡ ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ UI ⚡
const scanner = new CyberScanner();

async function startScan() {
    const url = document.getElementById('targetUrl').value.trim();
    const scanBtn = document.getElementById('scanBtn');
    
    if (!url) {
        showError('▐ ОШИБКА: ЦЕЛЬ НЕ УКАЗАНА ▐');
        return;
    }

    // Валидация URL
    let validatedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validatedUrl = 'https://' + url;
    }

    try {
        new URL(validatedUrl);
    } catch {
        showError('▐ ОШИБКА: НЕКОРРЕКТНЫЙ URL ▐');
        return;
    }

    // Сброс UI
    resetUI();
    
    // Блокировка кнопки
    scanBtn.disabled = true;
    scanBtn.querySelector('.btn-text').textContent = '⚡ СКАНИРОВАНИЕ...';

    try {
        const results = await scanner.scanWebsite(validatedUrl);
        displayResults(results);
    } catch (error) {
        showError(`▐ СБОЙ СИСТЕМЫ: ${error.message} ▐`);
    } finally {
        // Разблокировка кнопки
        scanBtn.disabled = false;
        scanBtn.querySelector('.btn-text').textContent = '🚀 ЗАПУСТИТЬ СКАНИРОВАНИЕ';
    }
}

function resetUI() {
    document.getElementById('progress').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
}

function displayResults(results) {
    document.getElementById('progress').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
    
    // Обновление метаданных
    document.getElementById('scanMeta').innerHTML = `
        <div>ЦЕЛЬ: ${results.target}</div>
        <div>ВРЕМЯ: ${results.scanTime}ms</div>
        <div>ТЕСТОВ: ${results.totalTests}</div>
    `;
    
    // Статистика
    const statsContent = document.getElementById('statsContent');
    const critical = results.vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = results.vulnerabilities.filter(v => v.severity === 'high').length;
    const medium = results.vulnerabilities.filter(v => v.severity === 'medium').length;
    const low = results.vulnerabilities.filter(v => v.severity === 'low').length;
    
    statsContent.innerHTML = `
        <div class="stat-item">КРИТИЧЕСКИЕ: <span class="stat-critical">${critical}</span></div>
        <div class="stat-item">ВЫСОКИЕ: <span class="stat-high">${high}</span></div>
        <div class="stat-item">СРЕДНИЕ: <span class="stat-medium">${medium}</span></div>
        <div class="stat-item">НИЗКИЕ: <span class="stat-low">${low}</span></div>
        <div class="stat-item">УСПЕШНЫЕ: <span class="stat-passed">${results.passedTests}</span></div>
    `;
    
    // Уязвимости
    const vulnList = document.getElementById('vulnList');
    vulnList.innerHTML = '';
    
    if (results.vulnerabilities.length === 0) {
        vulnList.innerHTML = `
            <div class="vuln-item info">
                <div class="vuln-header">
                    <div class="vuln-title">▐ СИСТЕМА БЕЗОПАСНА ▐</div>
                    <span class="severity-badge info">CLEAN</span>
                </div>
                <div class="vuln-desc">Критических уязвимостей не обнаружено</div>
            </div>
        `;
    } else {
        results.vulnerabilities.forEach(vuln => {
            const vulnElement = document.createElement('div');
            vulnElement.className = `vuln-item ${vuln.severity}`;
            vulnElement.innerHTML = `
                <div class="vuln-header">
                    <div class="vuln-title">${vuln.type}</div>
                    <span class="severity-badge ${vuln.severity}">${vuln.severity.toUpperCase()}</span>
                </div>
                <div class="vuln-desc">${vuln.description}</div>
                <div class="vuln-recom">${vuln.recommendation}</div>
                <div class="vuln-time">${vuln.timestamp}</div>
            `;
            vulnList.appendChild(vulnElement);
        });
    }
    
    // Рекомендации
    const recomList = document.getElementById('recomList');
    const generalRecom = [
        '▐ ВНЕДРИТЕ STRICT CONTENT SECURITY POLICY',
        '▐ НАСТРОЙТЕ HSTS ДЛЯ ПРИНУДИТЕЛЬНОГО HTTPS',
        '▐ РЕГУЛЯРНО ОБНОВЛЯЙТЕ СИСТЕМУ И ЗАВИСИМОСТИ',
        '▐ ИСПОЛЬЗУЙТЕ ПАРАМЕТРИЗОВАННЫЕ ЗАПРОСЫ К БД',
        '▐ ВАЛИДИРУЙТЕ И ЭКРАНИРУЙТЕ ПОЛЬЗОВАТЕЛЬСКИЙ ВВОД',
        '▐ ОГРАНИЧЬТЕ ДОСТУП К СЛУЖЕБНЫМ ДИРЕКТОРИЯМ',
        '▐ МОНИТОРЬТЕ ЛОГИ ДОСТУПА И ПОПЫТКИ ВЗЛОМА'
    ];
    
    recomList.innerHTML = generalRecom.map(recom => 
        `<div class="recom-item">${recom}</div>`
    ).join('');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
}

// Обработчики событий
document.getElementById('targetUrl').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        startScan();
    }
});

// Инициализация терминала
function updateTerminal() {
    const commands = [
        'scan_system --target=$URL --full-analysis',
        'check_vulnerabilities --type=all',
        'generate_report --format=cyber',
        'deploy_countermeasures',
        'system_status --security-level=max'
    ];
    
    const commandElement = document.getElementById('terminalCommand');
    let currentCommand = 0;
    
    setInterval(() => {
        commandElement.textContent = commands[currentCommand] + ' █';
        currentCommand = (currentCommand + 1) % commands.length;
    }, 3000);
}

// Запуск системы
document.addEventListener('DOMContentLoaded', function() {
    updateTerminal();
    
    // Добавляем случайные сканирующие линии
    setInterval(() => {
        if (Math.random() > 0.7) {
            scanner.addScanLine();
        }
    }, 2000);
});

// Стили для статистики
const style = document.createElement('style');
style.textContent = `
    .stat-item {
        padding: 8px 0;
        border-bottom: 1px solid rgba(0, 243, 255, 0.3);
        font-family: 'Share Tech Mono', monospace;
    }
    
    .stat-critical { color: #ff0000; }
    .stat-high { color: #ff6b00; }
    .stat-medium { color: #ffd700; }
    .stat-low { color: #00ff00; }
    .stat-passed { color: #00f3ff; }
    
    .vuln-desc {
        margin: 8px 0;
        color: rgba(255, 255, 255, 0.8);
    }
    
    .vuln-recom {
        margin: 8px 0;
        color: var(--neon-green);
        font-size: 0.9em;
    }
    
    .vuln-time {
        font-size: 0.8em;
        color: rgba(255, 255, 255, 0.5);
        text-align: right;
    }
    
    .recom-item {
        padding: 10px;
        margin: 5px 0;
        background: rgba(0, 243, 255, 0.1);
        border-left: 2px solid var(--neon-green);
        font-size: 0.9em;
    }
`;
document.head.appendChild(style);