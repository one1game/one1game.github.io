// One1Game Platform - Full Functional Version
class One1GamePlatform {
  constructor() {
      this.clicks = 0;
      this.highScore = 0;
      this.isPlaying = false;
      this.init();
  }

  init() {
      document.addEventListener('DOMContentLoaded', () => {
          this.loadRandomVideo();
          this.setupClickerGame();
          this.setupMusicPlayer();
          this.setupEventListeners();
          console.log('🚀 One1Game Platform initialized!');
      });
  }

  // Video System
  async loadRandomVideo() {
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
          
          document.getElementById('video-container').innerHTML = `
              <iframe src="${videoUrl}" 
                      frameborder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowfullscreen
                      loading="lazy"></iframe>`;
      } catch (error) {
          console.error('Video loading error:', error);
          document.getElementById('video-container').innerHTML = 
              '<p style="text-align: center; color: #ff00ff; padding: 20px;">🎮 Видео загружено!</p>';
      }
  }

  // Clicker Game System
  setupClickerGame() {
      // Load saved data
      this.clicks = parseInt(localStorage.getItem('one1game_clicks')) || 0;
      this.highScore = parseInt(localStorage.getItem('one1game_highscore')) || 0;

      // Update displays
      this.updateGameDisplay();

      // Click handler
      const clicker = document.getElementById('clicker-target');
      clicker.addEventListener('click', (e) => {
          this.handleClick(e);
      });

      // Touch support
      clicker.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.handleClick(e);
      });

      // Reset button
      document.getElementById('reset-game').addEventListener('click', () => {
          this.resetGame();
      });
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
      document.getElementById('click-count').textContent = this.formatNumber(this.clicks);
      document.getElementById('high-score').textContent = this.formatNumber(this.highScore);
  }

  animateCore() {
      const core = document.getElementById('clicker-target');
      core.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
          core.style.transform = 'scale(1)';
      }, 100);
  }

  createClickEffect(event) {
      const effect = document.createElement('div');
      effect.style.cssText = `
          position: fixed;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle, #00ff88, transparent);
          border-radius: 50%;
          pointer-events: none;
          left: ${event.clientX - 10}px;
          top: ${event.clientY - 10}px;
          animation: clickEffect 0.6s ease-out forwards;
          z-index: 1000;
      `;
      
      document.body.appendChild(effect);
      
      setTimeout(() => effect.remove(), 600);
  }

  resetGame() {
      this.clicks = 0;
      this.highScore = 0;
      
      localStorage.setItem('one1game_clicks', '0');
      localStorage.setItem('one1game_highscore', '0');
      
      this.updateGameDisplay();
      
      // Visual feedback
      const btn = document.getElementById('reset-game');
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

  // Music Player System
  setupMusicPlayer() {
      const player = document.getElementById('radio-stream');
      const playBtn = document.getElementById('play-pause');
      const volumeSlider = document.getElementById('volume-slider');
      const statusText = document.getElementById('status-text');
      const bars = document.querySelectorAll('.bar');

      // Set initial volume
      player.volume = volumeSlider.value;

      // Play/Pause
      playBtn.addEventListener('click', () => {
          this.togglePlayback(player, playBtn, bars, statusText);
      });

      // Volume control
      volumeSlider.addEventListener('input', () => {
          player.volume = volumeSlider.value;
          this.updateVolumeIcon(volumeSlider.value);
      });

      // Player events
      player.addEventListener('play', () => {
          this.setPlaybackState(true, playBtn, bars, statusText);
      });

      player.addEventListener('pause', () => {
          this.setPlaybackState(false, playBtn, bars, statusText);
      });

      player.addEventListener('ended', () => {
          this.setPlaybackState(false, playBtn, bars, statusText);
          statusText.textContent = 'Трансляция завершена';
      });

      player.addEventListener('error', () => {
          statusText.textContent = 'Ошибка подключения';
          statusText.style.color = '#ff003c';
      });
  }

  togglePlayback(player, button, bars, status) {
      if (player.paused) {
          player.play().catch(error => {
              console.error('Playback error:', error);
              status.textContent = 'Ошибка воспроизведения';
              status.style.color = '#ff003c';
          });
      } else {
          player.pause();
      }
  }

  setPlaybackState(playing, button, bars, status) {
      const icon = button.querySelector('i');
      
      if (playing) {
          icon.className = 'fas fa-pause';
          status.textContent = 'В эфире - 8-Bit Radio';
          status.style.color = '#00ff88';
          bars.forEach(bar => bar.style.animationPlayState = 'running');
          button.style.background = '#00ff88';
      } else {
          icon.className = 'fas fa-play';
          status.textContent = 'На паузе';
          status.style.color = '#b0b0b0';
          bars.forEach(bar => bar.style.animationPlayState = 'paused');
          button.style.background = '#00f3ff';
      }
  }

  updateVolumeIcon(volume) {
      const icon = document.querySelector('.volume-control i');
      if (volume == 0) {
          icon.className = 'fas fa-volume-mute';
      } else if (volume < 0.5) {
          icon.className = 'fas fa-volume-down';
      } else {
          icon.className = 'fas fa-volume-up';
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
              document.getElementById('play-pause').click();
          }
          // R - reset game
          if (e.code === 'KeyR' && e.ctrlKey) {
              e.preventDefault();
              this.resetGame();
          }
      });

      // Add click effect styles
      const styles = document.createElement('style');
      styles.textContent = `
          @keyframes clickEffect {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(3); opacity: 0; }
          }
      `;
      document.head.appendChild(styles);
  }
}

// Initialize the platform
new One1GamePlatform();