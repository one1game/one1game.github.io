// Enhanced functionality with modern features
class One1Game {
  constructor() {
      this.clickCount = 0;
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
          this.loadHighScore();
      });
  }

  // Video functionality
  async loadRandomVideo() {
      try {
          const response = await fetch('videos.json');
          if (!response.ok) throw new Error('Network error');
          
          const videos = await response.json();
          if (videos.length > 0) {
              const randomIndex = Math.floor(Math.random() * videos.length);
              const videoUrl = videos[randomIndex] + '?autoplay=1&mute=1';
              
              document.getElementById('video-container').innerHTML = `
                  <iframe src="${videoUrl}" 
                          frameborder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                          allowfullscreen
                          loading="lazy"></iframe>`;
          }
      } catch (error) {
          console.error('Error loading video:', error);
          document.getElementById('video-container').innerHTML = 
              '<p style="text-align: center; color: #ff00ff; padding: 20px;">Система загрузки видео временно недоступна</p>';
      }
  }

  // Clicker game with enhanced features
  setupClickerGame() {
      const clickerImage = document.getElementById('clicker-image');
      const clickDisplay = document.getElementById('click-count');
      const highScoreDisplay = document.getElementById('high-score');
      const resetButton = document.getElementById('reset-clicks');

      // Load from localStorage
      this.clickCount = parseInt(localStorage.getItem('clickCount')) || 0;
      this.highScore = parseInt(localStorage.getItem('highScore')) || 0;

      clickDisplay.textContent = this.formatNumber(this.clickCount);
      highScoreDisplay.textContent = this.formatNumber(this.highScore);

      clickerImage.addEventListener('click', (e) => {
          this.handleClick(e);
      });

      resetButton.addEventListener('click', () => {
          this.resetClicks();
      });
  }

  handleClick(event) {
      this.clickCount++;
      
      const clickDisplay = document.getElementById('click-count');
      clickDisplay.textContent = this.formatNumber(this.clickCount);
      
      // Update high score
      if (this.clickCount > this.highScore) {
          this.highScore = this.clickCount;
          document.getElementById('high-score').textContent = this.formatNumber(this.highScore);
          localStorage.setItem('highScore', this.highScore);
      }
      
      localStorage.setItem('clickCount', this.clickCount);
      
      // Visual feedback
      const clickerImage = event.target;
      clickerImage.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
          clickerImage.style.transform = 'scale(1)';
      }, 100);
  }

  resetClicks() {
      this.clickCount = 0;
      document.getElementById('click-count').textContent = '0';
      localStorage.setItem('clickCount', '0');
      
      // Visual confirmation
      const resetButton = document.getElementById('reset-clicks');
      const originalText = resetButton.textContent;
      resetButton.textContent = 'СБРОШЕНО!';
      resetButton.style.background = 'var(--neon-green)';
      
      setTimeout(() => {
          resetButton.textContent = originalText;
          resetButton.style.background = '';
      }, 2000);
  }

  loadHighScore() {
      this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
      document.getElementById('high-score').textContent = this.formatNumber(this.highScore);
  }

  formatNumber(num) {
      return new Intl.NumberFormat('ru-RU').format(num);
  }

  // Enhanced music player
  setupMusicPlayer() {
      const player = document.getElementById('radio-player');
      const playPauseBtn = document.getElementById('playPauseBtn');
      const volumeControl = document.getElementById('volumeControl');
      const bars = document.querySelectorAll('.bar');
      const statusDisplay = document.getElementById('radio-status');

      // Set initial volume
      player.volume = volumeControl.value;

      playPauseBtn.addEventListener('click', () => {
          this.togglePlayback(player, playPauseBtn, bars, statusDisplay);
      });

      volumeControl.addEventListener('input', () => {
          player.volume = volumeControl.value;
          this.updateVolumeDisplay(volumeControl.value);
      });

      // Player event listeners
      player.addEventListener('play', () => {
          this.updatePlaybackState(true, playPauseBtn, bars, statusDisplay);
      });

      player.addEventListener('pause', () => {
          this.updatePlaybackState(false, playPauseBtn, bars, statusDisplay);
      });
  }

  togglePlayback(player, button, bars, status) {
      if (player.paused) {
          player.play().catch(error => {
              console.error('Playback failed:', error);
              status.textContent = 'ОШИБКА ВОСПРОИЗВЕДЕНИЯ';
          });
      } else {
          player.pause();
      }
  }

  updatePlaybackState(playing, button, bars, status) {
      const icon = button.querySelector('i');
      
      if (playing) {
          icon.className = 'fas fa-pause';
          button.setAttribute('aria-label', 'Пауза');
          status.textContent = 'В ЭФИРЕ';
          status.style.color = 'var(--neon-green)';
          bars.forEach(bar => bar.style.animationPlayState = 'running');
      } else {
          icon.className = 'fas fa-play';
          button.setAttribute('aria-label', 'Воспроизвести');
          status.textContent = 'ПАУЗА';
          status.style.color = 'var(--neon-pink)';
          bars.forEach(bar => bar.style.animationPlayState = 'paused');
      }
  }

  updateVolumeDisplay(volume) {
      const volumeIcon = document.querySelector('.volume-container i');
      if (volume == 0) {
          volumeIcon.className = 'fas fa-volume-mute';
      } else if (volume < 0.5) {
          volumeIcon.className = 'fas fa-volume-down';
      } else {
          volumeIcon.className = 'fas fa-volume-up';
      }
  }

  setupEventListeners() {
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
          if (e.code === 'Space') {
              e.preventDefault();
              const playButton = document.getElementById('playPauseBtn');
              if (playButton) playButton.click();
          }
      });
  }
}

// Initialize the application
new One1Game();