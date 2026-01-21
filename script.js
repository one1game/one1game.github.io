// One1Game Platform - Working Version
class One1GamePlatform {
  constructor() {
      this.clicks = 0;
      this.highScore = 0;
      this.isPlaying = false;
      this.allArticles = window.allArticles || [];
      this.init();
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
      
      this.loadRandomVideo();
      this.setupClickerGame();
      this.setupMusicPlayer();
      this.setupEventListeners();
      this.loadLatestArticles(); // ← Теперь использует новый формат полосок
      
      console.log('✅ One1Game Platform initialized successfully!');
  }

  checkElements() {
      const requiredElements = [
          'video-container',
          'clicker-target', 
          'click-count',
          'high-score',
          'reset-game',
          'play-pause',
          'radio-stream',
          'volume-slider',
          'status-text',
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
      try {
          const videoContainer = document.getElementById('video-container');
          if (!videoContainer) return;

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
      console.log('🎮 Setting up clicker game...');
      
      // Load saved data
      this.clicks = parseInt(localStorage.getItem('one1game_clicks')) || 0;
      this.highScore = parseInt(localStorage.getItem('one1game_highscore')) || 0;

      // Update displays
      this.updateGameDisplay();

      // Click handler
      const clicker = document.getElementById('clicker-target');
      if (!clicker) {
          console.error('❌ Clicker target not found!');
          return;
      }

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

  // Music Player System
  setupMusicPlayer() {
      console.log('🎵 Setting up music player...');
      
      const player = document.getElementById('radio-stream');
      const playBtn = document.getElementById('play-pause');
      const volumeSlider = document.getElementById('volume-slider');
      const statusText = document.getElementById('status-text');
      const bars = document.querySelectorAll('.visualizer .bar');

      if (!player || !playBtn) {
          console.error('❌ Music player elements not found!');
          return;
      }

      // Set initial volume
      player.volume = volumeSlider ? volumeSlider.value : 0.7;

      // Play/Pause
      playBtn.addEventListener('click', () => {
          this.togglePlayback(player, playBtn, bars, statusText);
      });

      // Volume control
      if (volumeSlider) {
          volumeSlider.addEventListener('input', () => {
              player.volume = volumeSlider.value;
              this.updateVolumeIcon(volumeSlider.value);
          });
      }

      // Player events
      player.addEventListener('play', () => {
          this.setPlaybackState(true, playBtn, bars, statusText);
      });

      player.addEventListener('pause', () => {
          this.setPlaybackState(false, playBtn, bars, statusText);
      });

      player.addEventListener('ended', () => {
          this.setPlaybackState(false, playBtn, bars, statusText);
          if (statusText) {
              statusText.textContent = 'Трансляция завершена';
          }
      });

      player.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          if (statusText) {
              statusText.textContent = 'Ошибка подключения';
              statusText.style.color = '#ff003c';
          }
      });

      console.log('✅ Music player setup complete');
  }

  togglePlayback(player, button, bars, status) {
      if (player.paused) {
          player.play().catch(error => {
              console.error('Playback error:', error);
              if (status) {
                  status.textContent = 'Ошибка воспроизведения';
                  status.style.color = '#ff003c';
              }
          });
      } else {
          player.pause();
      }
  }

  setPlaybackState(playing, button, bars, status) {
      const icon = button.querySelector('i');
      if (!icon) return;
      
      if (playing) {
          icon.className = 'fas fa-pause';
          if (status) {
              status.textContent = 'В эфире - 8-Bit Radio';
              status.style.color = '#00ff88';
          }
          if (bars && bars.length > 0) {
              bars.forEach(bar => {
                  bar.style.animationPlayState = 'running';
              });
          }
          button.style.background = '#00ff88';
      } else {
          icon.className = 'fas fa-play';
          if (status) {
              status.textContent = 'На паузе';
              status.style.color = '#b0b0b0';
          }
          if (bars && bars.length > 0) {
              bars.forEach(bar => {
                  bar.style.animationPlayState = 'paused';
              });
          }
          button.style.background = '#00f3ff';
      }
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

  // Utility Methods
  formatNumber(num) {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  setupEventListeners() {
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
          // Space - play/pause music
          if (e.code === 'Space') {
              e.preventDefault();
              const playBtn = document.getElementById('play-pause');
              if (playBtn) playBtn.click();
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