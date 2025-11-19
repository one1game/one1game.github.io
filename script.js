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
              '<p class="error-message">Система загрузки видео временно недоступна</p>';
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

      // Touch support for mobile
      clickerImage.addEventListener('touchstart', (e) => {
          e.preventDefault();
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
      this.createClickEffect(event);
      clickerImage.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
          clickerImage.style.transform = 'scale(1)';
      }, 100);
  }

  createClickEffect(event) {
      const effect = document.createElement('div');
      effect.className = 'click-effect';
      effect.style.cssText = `
          position: absolute;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle, var(--neon-green), transparent);
          border-radius: 50%;
          pointer-events: none;
          left: ${event.clientX - 10}px;
          top: ${event.clientY - 10}px;
          animation: clickExpand 0.6s ease-out forwards;
      `;
      
      document.body.appendChild(effect);
      
      setTimeout(() => {
          effect.remove();
      }, 600);
  }

  resetClicks() {
      this.clickCount = 0;
      document.getElementById('click-count').textContent = '0';
      localStorage.setItem('clickCount', '0');
      
      // Visual confirmation
      const resetButton = document.getElementById('reset-clicks');
      resetButton.textContent = 'СБРОШЕНО!';
      resetButton.style.background = 'var(--neon-green)';
      
      setTimeout(() => {
          resetButton.textContent = 'Сбросить';
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

      player.addEventListener('ended', () => {
          this.updatePlaybackState(false, playPauseBtn, bars, statusDisplay);
      });

      // Simulate spectrum analyzer
      this.startSpectrumAnalyzer(bars);
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

  startSpectrumAnalyzer(bars) {
      // Simulate random bar movements
      setInterval(() => {
          if (this.isPlaying) {
              bars.forEach(bar => {
                  const randomHeight = Math.random() * 80 + 10;
                  bar.style.height = `${randomHeight}px`;
              });
          }
      }, 200);
  }

  setupEventListeners() {
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
          if (e.code === 'Space') {
              e.preventDefault();
              const playButton = document.getElementById('playPauseBtn');
              if (playButton) playButton.click();
          }
          
          if (e.code === 'KeyR' && e.ctrlKey) {
              e.preventDefault();
              this.resetClicks();
          }
      });

      // Intersection Observer for animations
      const observerOptions = {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  entry.target.style.opacity = '1';
                  entry.target.style.transform = 'translateY(0)';
              }
          });
      }, observerOptions);

      // Observe all sections for scroll animations
      document.querySelectorAll('section').forEach(section => {
          section.style.opacity = '0';
          section.style.transform = 'translateY(20px)';
          section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          observer.observe(section);
      });
  }
}

// Add CSS for click effects
const style = document.createElement('style');
style.textContent = `
  @keyframes clickExpand {
      0% {
          transform: scale(1);
          opacity: 1;
      }
      100% {
          transform: scale(3);
          opacity: 0;
      }
  }
  
  .error-message {
      text-align: center;
      color: var(--neon-pink);
      font-family: 'Orbitron', monospace;
      padding: 20px;
  }
  
  .click-effect {
      z-index: 1000;
  }
`;
document.head.appendChild(style);

// Initialize the application
new One1Game();

// Service Worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
          .then(registration => {
              console.log('SW registered: ', registration);
          })
          .catch(registrationError => {
              console.log('SW registration failed: ', registrationError);
          });
  });
}