// One1Game Platform - Working Version with Smart Radio
class One1GamePlatform {
  constructor() {
      this.isPlaying = false;
      this.allArticles = window.allArticles || [];
      this.globalRadio = null;
      
      // Page transitions
      this.setupPageTransitions();
      
      // Инициализируем глобальное радио ТОЛЬКО если это не архив
      if (!this.isArchivePage()) {
        this.initGlobalRadio();
      }
      this.init();
  }

  // Проверяем, это архив или нет
  isArchivePage() {
    return window.location.pathname.includes('archive.html') || 
           document.title.includes('Архив') ||
           document.querySelector('.articles-container') !== null;
  }

  // Smooth page transitions on link clicks
  setupPageTransitions() {
    document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (!link) return;
      // Skip external, anchor, noopener, download links
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.hasAttribute('download') || link.target === '_blank') return;
      
      e.preventDefault();
      // Fade out
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 120ms ease';
      
      setTimeout(() => {
        window.location.href = href;
      }, 120);
    });
    // Fade in on arrival
    document.body.style.transition = 'opacity 120ms ease';
  }

  // Глобальное радио для всех страниц (кроме архива)
  initGlobalRadio() {
    // Проверяем, есть ли уже глобальное радио
    if (window.One1GameRadio) {
      this.globalRadio = window.One1GameRadio;
      console.log('📻 Using existing global radio');
      return;
    }
    
    console.log('📻 Creating global radio player (not for archive)...');
    
    // Создаем скрытый аудио элемент для радио
    let radioAudio = document.getElementById('radio-stream');
    
    // Если радио нет на странице, создаем скрытое
    if (!radioAudio) {
      radioAudio = document.createElement('audio');
      radioAudio.id = 'radio-stream-global';
      radioAudio.preload = 'metadata';
      radioAudio.style.display = 'none';
      document.body.appendChild(radioAudio);
    }
    
    // Всегда задаём источник (на случай если элемент уже был в HTML без src)
    radioAudio.src = 'https://radio.gamesboro.org/listen/gamesboro_radio/radio.mp3';
    
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
    
    // Восстанавливаем состояние воспроизведения (только если не было паузы)
    if (savedPaused !== 'true') {
      setTimeout(() => {
        this.globalRadio.audio.play().catch(e => {
          console.log('Auto-play on init blocked');
        });
      }, 1000);
    }
    
    // Сохраняем громкость при изменении
    radioAudio.addEventListener('volumechange', () => {
      localStorage.setItem('one1game_radio_volume', radioAudio.volume);
    });
    
    console.log('✅ Global radio initialized (not for archive)');
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
    if (this.isArchivePage()) {
      console.log('📚 Archive page detected - NO RADIO');
      // Для архива НЕ загружаем радио
    } else {
      console.log('🏠 Home page detected');
      this.loadHomePageContent();
    }
  }

  // Контент для главной страницы
  loadHomePageContent() {
    this.loadRandomVideo();
    this.loadLatestArticles();
  }

  // Настройка видимых элементов управления радио
  setupVisibleRadioControls() {
    const playBtn = document.getElementById('radio-play');
    const stopBtn = document.getElementById('radio-stop');
    const statusText = document.getElementById('radio-status');

    if (this.isArchivePage() || !this.globalRadio) {
      console.log('📻 No radio controls for archive page');
      return;
    }

    if (!playBtn) {
      console.log('📻 No visible radio controls on this page');
      return;
    }

    console.log('🎵 Setting up visible radio controls...');

    // Обновляем кнопку
    this.updateRadioButton(playBtn);

    // Кнопка play/pause
    playBtn.addEventListener('click', () => {
      this.globalRadio.toggle();
      this.updateRadioButton(playBtn);

      if (statusText) {
        statusText.textContent = this.globalRadio.isPlaying()
          ? 'В эфире - 8-Bit Radio'
          : 'Остановлено';
      }
    });

    // Кнопка stop
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.globalRadio.audio.pause();
        this.globalRadio.audio.currentTime = 0;
        this.updateRadioButton(playBtn);
        if (statusText) statusText.textContent = 'Остановлено';
      });
    }

    // Обновляем статус
    if (statusText) {
      statusText.textContent = this.globalRadio.isPlaying()
        ? 'В эфире - 8-Bit Radio'
        : 'Остановлено';
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
      if (statusText) statusText.textContent = 'Остановлено';
    });

    console.log('✅ Visible radio controls setup complete');
  }

  updateRadioButton(button) {
    const icon = button.querySelector('i');
    if (!icon) return;
    
    const isPlaying = this.globalRadio ? this.globalRadio.isPlaying() : false;
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
    
    const isPlaying = this.globalRadio ? this.globalRadio.isPlaying() : false;
    
    bars.forEach(bar => {
      bar.style.animationPlayState = isPlaying ? 'running' : 'paused';
    });
  }

  // Latest Articles System — обновлённый дизайн карточек
  loadLatestArticles() {
    const container = document.getElementById('latest-articles');
    if (!container) return;

    if (!window.allArticles || window.allArticles.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-newspaper"></i></div><h3>Статьи загружаются...</h3><p>Пожалуйста, подождите или обновите страницу.</p></div>';
      return;
    }

    const categoryMap = {
      'Технологии': 'cat-tech',
      'Гайды': 'cat-guides',
      'Консоли': 'cat-consoles',
      'Аналитика': 'cat-analytics',
      'Тренды': 'cat-trends',
      'Разработка': 'cat-dev'
    };

    const latestArticles = window.allArticles.slice(0, 5);
    const featured = latestArticles[0];
    const rest = latestArticles.slice(1);

    const cardHTML = (article, isFeatured) => {
      const catClass = categoryMap[article.category] || '';
      return `
      <a href="${article.url}" class="article-card${isFeatured ? ' featured' : ''}">
        ${article.category ? `<span class="card-category ${catClass}">${article.category}</span>` : ''}
        <h3>${article.title}</h3>
        <p class="card-excerpt">${article.excerpt || ''}</p>
        <div class="card-meta">
          <span><i class="far fa-calendar"></i> ${article.date || ''}</span>
          <span><i class="far fa-clock"></i> ${article.readTime || '5 мин'}</span>
        </div>
      </a>`;
    };

    container.innerHTML = cardHTML(featured, true) + rest.map(a => cardHTML(a, false)).join('');

    // Generate dynamic categories
    this.loadCategories();
  }

  // Dynamic categories from articles
  loadCategories() {
    const row = document.getElementById('categories-row');
    if (!row || !window.allArticles || window.allArticles.length === 0) return;

    // Count articles per category
    const catCount = {};
    const categoryMap = {
      'Технологии': 'cat-tech',
      'Гайды': 'cat-guides',
      'Консоли': 'cat-consoles',
      'Аналитика': 'cat-analytics',
      'Тренды': 'cat-trends'
    };

    window.allArticles.forEach(a => {
      catCount[a.category] = (catCount[a.category] || 0) + 1;
    });

    // Category icons
    const icons = {
      'Технологии': 'fa-microchip',
      'Гайды': 'fa-map',
      'Консоли': 'fa-gamepad',
      'Аналитика': 'fa-chart-line',
      'Тренды': 'fa-fire',
      'Разработка': 'fa-code'
    };

    const pills = Object.entries(catCount).map(([cat, count]) => {
      const catClass = categoryMap[cat] || '';
      const icon = icons[cat] || 'fa-folder';
      const encoded = encodeURIComponent(cat);
      return `<a href="archive.html?category=${encoded}" class="cat-pill ${catClass}">
        <i class="fas ${icon}"></i> ${cat} <span class="cat-count">${count}</span>
      </a>`;
    }).join('');

    row.innerHTML = pills;
  }

  // Video System (lazy load)
  loadRandomVideo() {
    const videoContainer = document.getElementById('video-container');
    if (!videoContainer) return;

    const videoId = videoContainer.dataset.videoId || 'bA3CwT1yy_U';
    const thumb = document.getElementById('video-thumb');
    const playBtn = document.getElementById('video-play-btn');
    
    // Set thumbnail from YouTube
    thumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    thumb.onerror = () => { thumb.style.display = 'none'; };

    // Load iframe on click
    const loadVideo = () => {
      videoContainer.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px;"></iframe>`;
    };

    playBtn.addEventListener('click', loadVideo);
    thumb.addEventListener('click', loadVideo);
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Space — переключение радио
      if (e.code === 'Space' && this.globalRadio) {
        const activeEl = document.activeElement;
        // Не перехватываем Space в полях ввода
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;
        e.preventDefault();
        this.globalRadio.toggle();
      }
    });

    console.log('✅ Event listeners setup complete');
  }
}

// Initialize the platform
new One1GamePlatform();