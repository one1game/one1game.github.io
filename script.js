// One1Game Website Functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize all features
  loadRandomVideo();
  setupClickerGame();
  setupMusicPlayer();
});

// Video functionality
function loadRandomVideo() {
  fetch('videos.json')
      .then(response => {
          if (!response.ok) throw new Error('Network error');
          return response.json();
      })
      .then(videos => {
          if (videos.length > 0) {
              const randomIndex = Math.floor(Math.random() * videos.length);
              const videoUrl = videos[randomIndex] + '?autoplay=1&mute=1';
              
              const videoContainer = document.getElementById('video-container');
              videoContainer.innerHTML = `
                  <iframe src="${videoUrl}" 
                          frameborder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                          allowfullscreen></iframe>`;
          }
      })
      .catch(error => {
          console.error('Error loading video:', error);
          document.getElementById('video-container').innerHTML = 
              '<p style="text-align: center; color: #ff00ff; padding: 20px;">Не удалось загрузить видео</p>';
      });
}

// Clicker Game - Fixed version
function setupClickerGame() {
  let clickCount = parseInt(localStorage.getItem('clickCount')) || 0;
  let highScore = parseInt(localStorage.getItem('highScore')) || 0;
  
  const clickerImage = document.getElementById('clicker-image');
  const clickDisplay = document.getElementById('click-count');
  const highScoreDisplay = document.getElementById('high-score');
  const resetButton = document.getElementById('reset-clicks');
  
  // Update displays
  clickDisplay.textContent = formatNumber(clickCount);
  highScoreDisplay.textContent = formatNumber(highScore);
  
  // Click handler
  clickerImage.addEventListener('click', function(e) {
      clickCount++;
      
      // Update display
      clickDisplay.textContent = formatNumber(clickCount);
      
      // Update high score
      if (clickCount > highScore) {
          highScore = clickCount;
          highScoreDisplay.textContent = formatNumber(highScore);
          localStorage.setItem('highScore', highScore);
      }
      
      // Save to localStorage
      localStorage.setItem('clickCount', clickCount);
      
      // Visual feedback
      clickerImage.style.transform = 'scale(0.9)';
      setTimeout(() => {
          clickerImage.style.transform = 'scale(1)';
      }, 100);
      
      // Create click effect
      createClickEffect(e);
  });
  
  // Reset button
  resetButton.addEventListener('click', function() {
      clickCount = 0;
      clickDisplay.textContent = '0';
      localStorage.setItem('clickCount', '0');
      
      // Visual feedback
      this.textContent = 'СБРОШЕНО!';
      this.style.background = '#00ff88';
      
      setTimeout(() => {
          this.textContent = 'Сбросить прогресс';
          this.style.background = '';
      }, 1500);
  });
  
  // Touch support for mobile
  clickerImage.addEventListener('touchstart', function(e) {
      e.preventDefault();
      this.click();
  });
}

// Create visual click effect
function createClickEffect(event) {
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
      animation: clickExpand 0.6s ease-out forwards;
      z-index: 1000;
  `;
  
  document.body.appendChild(effect);
  
  setTimeout(() => {
      effect.remove();
  }, 600);
}

// Add click effect animation to CSS
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
`;
document.head.appendChild(style);

// Format numbers with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Music Player functionality
function setupMusicPlayer() {
  const player = document.getElementById('radio-player');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const volumeControl = document.getElementById('volumeControl');
  const bars = document.querySelectorAll('.bar');
  const statusDisplay = document.getElementById('radio-status');
  
  // Set initial volume
  player.volume = volumeControl.value;
  
  // Play/Pause functionality
  playPauseBtn.addEventListener('click', function() {
      if (player.paused) {
          player.play().catch(error => {
              console.error('Playback failed:', error);
              statusDisplay.textContent = 'ОШИБКА ВОСПРОИЗВЕДЕНИЯ';
          });
      } else {
          player.pause();
      }
  });
  
  // Volume control
  volumeControl.addEventListener('input', function() {
      player.volume = this.value;
      updateVolumeIcon(this.value);
  });
  
  // Player events
  player.addEventListener('play', function() {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      statusDisplay.textContent = 'В ЭФИРЕ';
      statusDisplay.style.color = '#00ff88';
      bars.forEach(bar => bar.style.animationPlayState = 'running');
  });
  
  player.addEventListener('pause', function() {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      statusDisplay.textContent = 'ПАУЗА';
      statusDisplay.style.color = '#ff00ff';
      bars.forEach(bar => bar.style.animationPlayState = 'paused');
  });
  
  player.addEventListener('ended', function() {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      statusDisplay.textContent = 'ЗАВЕРШЕНО';
      statusDisplay.style.color = '#ff003c';
      bars.forEach(bar => bar.style.animationPlayState = 'paused');
  });
}

// Update volume icon based on volume level
function updateVolumeIcon(volume) {
  const volumeIcon = document.querySelector('.volume-container i');
  if (volume == 0) {
      volumeIcon.className = 'fas fa-volume-mute';
  } else if (volume < 0.5) {
      volumeIcon.className = 'fas fa-volume-down';
  } else {
      volumeIcon.className = 'fas fa-volume-up';
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Spacebar to play/pause music
  if (e.code === 'Space') {
      e.preventDefault();
      const playButton = document.getElementById('playPauseBtn');
      if (playButton) playButton.click();
  }
  
  // Ctrl+R to reset clicks
  if (e.code === 'KeyR' && e.ctrlKey) {
      e.preventDefault();
      const resetButton = document.getElementById('reset-clicks');
      if (resetButton) resetButton.click();
  }
});