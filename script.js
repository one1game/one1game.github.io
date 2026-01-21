// One1Game Platform - Working Version with Global Radio
class One1GamePlatform {
  constructor() {
      this.clicks = 0;
      this.highScore = 0;
      this.isPlaying = false;
      this.allArticles = window.allArticles || [];
      this.globalRadio = null;
      
      // Инициализируем глобальное радио
      this.initGlobalRadio();
      this.init();
  }

  // Глобальное радио для всех страниц
  initGlobalRadio() {
    // Проверяем, есть ли уже глобальное радио
    if (window.One1GameRadio) {
      this.globalRadio = window.One1GameRadio;
      console.log('📻 Using existing global radio');
      return;
    }
    
    // Создаем глобальное радио
    console.log('📻 Creating global radio player...');
    
    // Создаем скрытый аудио элемент для радио
    let radioAudio = document.getElementById('radio-stream');
    
    // Если радио нет на странице, создаем скрытое
    if (!radioAudio) {
      radioAudio = document.createElement('audio');
      radioAudio.id = 'radio-stream-global';
      radioAudio.src = 'https://spritelayerradio.com/listen/classic/classic.mp3';
      radioAudio.preload = 'metadata';
      radioAudio.style.display = 'none';
      document.body.appendChild(radioAudio);
    }
    
    // Восстанавливаем состояние из localStorage
    const savedVolume = localStorage.getItem('one1game_radio_volume');
    const savedPaused = localStorage.getItem('one1game_radio_paused');
    
    if (savedVolume) {
      radioAudio.volume = parseFloat(savedVolume);
    }
    
    // Создаем глобальный объект радио
    this.globalRadio = {
      audio: radioAudio,
      play: function() {
        this.audio.play().catch(e => console.log('Auto-play blocked:', e));
        localStorage.setItem('one1game_radio_paused', 'false');
      },
      pause: function() {
        this.audio.pause();
        localStorage.setItem('one1game_radio_paused', 'true');
      },
      toggle: function() {
        if (this.audio.paused) {
          this.play();
        } else {
          this.pause();
        }
      },
      setVolume: function(vol) {
        this.audio.volume = vol;
        localStorage.setItem('one1game_radio_volume', vol);
      },
      isPlaying: function() {
        return !this.audio.paused;
      }
    };
    
    // Сохраняем в глобальной области видимости
    window.One1GameRadio = this.globalRadio;
    
    // Восстанавливаем состояние воспроизведения
    if (savedPaused !== 'true') {
      setTimeout(() => {
        this.globalRadio.audio.play().catch(e => {
          console.log('Auto-play on init blocked, waiting for user interaction');
        });
      }, 1000);
    }
    
    // Сохраняем громкость при изменении
    radioAudio.addEventListener('volumechange', () => {
      localStorage.setItem('one1game_radio_volume', radioAudio.volume);
    });
    
    console.log('✅ Global radio initialized');
  }

  init() {
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
              this.initializePlatform();
          });
      } else {
          this.initializePlatform();
      }
  }

  initializePlatform() {
      console.log('🚀 Initializing One1Game Platform...');
      
      // Проверяем наличие всех элементов
      this.checkElements();
      
      // Загружаем контент в зависимости от страницы
      this.loadPageContent();
      
      // Настраиваем видимые элементы радио, если они есть на странице
      this.setupVisibleRadioControls();
      
      this.setupEventListeners();
      
      console.log('✅ One1Game Platform initialized successfully!');
  }

  checkElements() {
      const requiredElements = [
          'latest-articles'
      ];

      requiredElements.forEach(id => {
          const element = document.getElementById(id);
          if (!element) {
              console.warn(`⚠️ Element with id "${id}" not found!`);
          } else {
              console.log(`✅ Found element: ${id}`);
          }
      });
  }

  // Загрузка контента в зависимости от страницы
  loadPageContent() {
    const path = window.location.pathname;
    
    if (path.includes('archive.html') || path.endsWith('archive.html')) {
      console.log('📚 Archive page detected');
      // Для архива используется отдельный скрипт в archive.html
    } else {
      console.log('🏠 Home page detected');
      this.loadHomePageContent();
    }
  }

  // Контент для главной страницы
  loadHomePageContent() {
    this.loadRandomVideo();
    this.setupClickerGame();
    this.loadLatestArticles();
  }

  // Настройка видимых элементов управления радио
  setupVisibleRadioControls() {
    const playBtn = document.getElementById('play-pause');
    const volumeSlider = document.getElementById('volume-slider');
    const statusText = document.getElementById('status-text');
    
    if (!playBtn || !this.globalRadio) {
      console.log('📻 No visible radio controls on this page');
      return;
    }
    
    console.log('🎵 Setting up visible radio controls...');
    
    // Синхронизируем громкость
    if (volumeSlider) {
      volumeSlider.value = this.globalRadio.audio.volume;
      
      volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        this.globalRadio.setVolume(vol);
        this.updateVolumeIcon(vol);
      });
    }
    
    // Обновляем кнопку
    this.updateRadioButton(playBtn);
    
    // Кнопка play/pause
    playBtn.addEventListener('click', () => {
      this.globalRadio.toggle();
      this.updateRadioButton(playBtn);
      
      if (statusText) {
        statusText.textContent = this.globalRadio.isPlaying() 
          ? 'В эфире - 8-Bit Radio' 
          : 'На паузе';
      }
    });
    
    // Обновляем статус
    if (statusText) {
      statusText.textContent = this.globalRadio.isPlaying() 
        ? 'В эфире - 8-Bit Radio' 
        : 'На паузе';
    }
    
    // Визуализатор
    this.setupVisualizer();
    
    // Слушаем события от радио
    this.globalRadio.audio.addEventListener('play', () => {
      this.updateRadioButton(playBtn);
      if (statusText) statusText.textContent = 'В эфире - 8-Bit Radio';
    });
    
    this.globalRadio.audio.addEventListener('pause', () => {
      this.updateRadioButton(playBtn);
      if (statusText) statusText.textContent = 'На паузе';
    });
    
    console.log('✅ Visible radio controls setup complete');
  }

  updateRadioButton(button) {
    const icon = button.querySelector('i');
    if (!icon) return;
    
    const isPlaying = this.globalRadio.isPlaying();
    icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    button.style.background = isPlaying ? '#00ff88' : '#00f3ff';
  }

  updateVolumeIcon(volume) {
    const icon = document.querySelector('.volume-control i');
    if (icon) {
      if (volume == 0) {
        icon.className = 'fas fa-volume-mute';
      } else if (volume < 0.5) {
        icon.className = 'fas fa-volume-down';
      } else {
        icon.className = 'fas fa-volume-up';
      }
    }
  }

  setupVisualizer() {
    const bars = document.querySelectorAll('.visualizer .bar');
    if (!bars.length) return;
    
    const isPlaying = this.globalRadio.isPlaying();
    
    bars.forEach(bar => {
      bar.style.animationPlayState = isPlaying ? 'running' : 'paused';
    });
  }

  // Latest Articles System - ОБНОВЛЕНО ДЛЯ ПОЛОСОК
  loadLatestArticles() {
    console.log('📰 Loading latest articles (strip format)...');
    
    const container = document.getElementById('latest-articles');
    
    if (!container) {
      console.error('❌ Latest articles container not found!');
      return;
    }
    
    // Проверяем статьи
    if (!window.allArticles || window.allArticles.length === 0) {
      container.innerHTML = `
        <div class="article-strip">
          <h3>Статьи загружаются...</h3>
          <p>Пожалуйста, подождите немного или обновите страницу.</p>
          <div class="article-meta-strip">
            <span><i class="far fa-clock"></i> 1 мин</span>
          </div>
        </div>
      `;
      return;
    }
    
    // Сортируем статьи по дате (новые первыми)
    const sortedArticles = [...window.allArticles].sort((a, b) => {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    
    // Берем только последние 5 статей
    const latestArticles = sortedArticles.slice(0, 5);
    
    // Генерируем HTML для полосок статей
    container.innerHTML = latestArticles.map(article => `
      <a href="${article.url || '#'}" class="article-strip" ${article.url ? 'target="_blank"' : ''}>
        <h3>${article.title || 'Без названия'}</h3>
        <p>${article.excerpt || 'Описание отсутствует'}</p>
        <div class="article-meta-strip">
          <span><i class="far fa-calendar"></i> ${article.date || 'Не указано'}</span>
          <span><i class="far fa-clock"></i> ${article.readTime || '5 мин'}</span>
          ${article.category ? `<span class="category-badge"><i class="fas fa-tag"></i> ${article.category}</span>` : ''}
        </div>
      </a>
    `).join('');
    
    console.log(`✅ Loaded ${latestArticles.length} latest articles in strip format`);
  }

  // Video System
  async loadRandomVideo() {
    const videoContainer = document.getElementById('video-container');
    if (!videoContainer) {
      console.log('📹 No video container on this page');
      return;
    }

    try {
      const videos = [
        "https://www.youtube.com/embed/bA3CwT1yy_U",
        "https://www.youtube.com/embed/zlXKmLXKA8E", 
        "https://www.youtube.com/embed/FbaI71tWi1Q",
        "https://www.youtube.com/embed/29JZvl1sYKg",
        "https://www.youtube.com/embed/Y4Xo-6zemAs"
      ];
      
      const randomIndex = Math.floor(Math.random() * videos.length);
      const videoUrl = videos[randomIndex] + '?autoplay=1&mute=1';
      
      videoContainer.innerHTML = `
        <iframe src="${videoUrl}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                loading="lazy"></iframe>`;
                
      console.log('📹 Video loaded successfully');
    } catch (error) {
      console.error('Video loading error:', error);
    }
  }

  // Clicker Game System
  setupClickerGame() {
    const clicker = document.getElementById('clicker-target');
    if (!clicker) {
      console.log('🎮 No clicker game on this page');
      return;
    }

    console.log('🎮 Setting up clicker game...');
    
    // Load saved data
    this.clicks = parseInt(localStorage.getItem('one1game_clicks')) || 0;
    this.highScore = parseInt(localStorage.getItem('one1game_highscore')) || 0;

    // Update displays
    this.updateGameDisplay();

    // Click handler
    clicker.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    // Touch support
    clicker.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleClick(e);
    });

    // Reset button
    const resetBtn = document.getElementById('reset-game');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetGame();
      });
    }

    console.log('✅ Clicker game setup complete');
  }

  handleClick(event) {
    this.clicks++;
    
    // Update high score
    if (this.clicks > this.highScore) {
      this.highScore = this.clicks;
      localStorage.setItem('one1game_highscore', this.highScore);
    }
    
    // Save and update
    localStorage.setItem('one1game_clicks', this.clicks);
    this.updateGameDisplay();
    
    // Visual effects
    this.createClickEffect(event);
    this.animateCore();
  }

  updateGameDisplay() {
    const clickCount = document.getElementById('click-count');
    const highScore = document.getElementById('high-score');
    
    if (clickCount) clickCount.textContent = this.formatNumber(this.clicks);
    if (highScore) highScore.textContent = this.formatNumber(this.highScore);
  }

  animateCore() {
    const core = document.getElementById('clicker-target');
    if (core) {
      core.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        core.style.transform = 'scale(1)';
      }, 100);
    }
  }

  createClickEffect(event) {
    const effect = document.createElement('div');
    effect.className = 'click-effect';
    effect.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: radial-gradient(circle, #00ff88, transparent);
      border-radius: 50%;
      pointer-events: none;
      left: ${event.clientX - 10}px;
      top: ${event.clientY - 10}px;
      z-index: 1000;
    `;
    
    document.body.appendChild(effect);
    
    // Анимация через CSS
    effect.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(3)', opacity: 0 }
    ], {
      duration: 600,
      easing: 'ease-out'
    }).onfinish = () => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    };
  }

  resetGame() {
    this.clicks = 0;
    this.highScore = 0;
    
    localStorage.setItem('one1game_clicks', '0');
    localStorage.setItem('one1game_highscore', '0');
    
    this.updateGameDisplay();
    
    // Visual feedback
    const btn = document.getElementById('reset-game');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Прогресс сброшен!';
      btn.style.background = 'rgba(0, 255, 136, 0.3)';
      btn.style.borderColor = '#00ff88';
      btn.style.color = '#00ff88';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.borderColor = '#ff003c';
        btn.style.color = '#ff003c';
      }, 2000);
    }
  }

  // Utility Methods
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Space - play/pause music (только если есть кнопка на странице)
      if (e.code === 'Space') {
        const playBtn = document.getElementById('play-pause');
        if (playBtn && this.globalRadio) {
          e.preventDefault();
          this.globalRadio.toggle();
          this.updateRadioButton(playBtn);
        }
      }
      
      // R - reset game (without Ctrl для простоты)
      if (e.code === 'KeyR') {
        const resetBtn = document.getElementById('reset-game');
        if (resetBtn && document.activeElement !== resetBtn) {
          e.preventDefault();
          this.resetGame();
        }
      }
    });

    console.log('✅ Event listeners setup complete');
  }
}

// Initialize the platform
new One1GamePlatform();