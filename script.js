// Получаем элементы (этот блок можно удалить, если не используется отдельно)
const playPauseBtn = document.getElementById('playPauseBtn');
const audioPlayer = document.getElementById('radio-player');
const bars = document.querySelectorAll('.bar');

// Загрузка случайного видео
function loadRandomVideo() {
    fetch('videos.json')
      .then(response => {
        if (!response.ok) throw new Error('Network error');
        return response.json();
      })
      .then(videos => {
        if (videos.length > 0) {
          const randomIndex = Math.floor(Math.random() * videos.length);
          const videoUrl = videos[randomIndex] + '?autoplay=1';
          document.getElementById('video-container').innerHTML = `
            <iframe src="${videoUrl}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>`;
        }
      })
      .catch(error => {
        console.error('Error loading video:', error);
        document.getElementById('video-container').innerHTML = 
          '<p>Не удалось загрузить видео. Попробуйте позже.</p>';
      });
  }

// Кликер-игра
function setupClickerGame() {
  let clickCount = localStorage.getItem('clickCount') || 0;
  const clickerImage = document.getElementById('clicker-image');
  const clickDisplay = document.getElementById('click-count');

  clickDisplay.textContent = clickCount;

  clickerImage.addEventListener('click', () => {
    clickCount++;
    clickDisplay.textContent = clickCount;
    localStorage.setItem('clickCount', clickCount);
    clickerImage.style.transform = 'scale(0.95)';
    setTimeout(() => { clickerImage.style.transform = 'scale(1)'; }, 100);
  });
}

// 8-bit радио
function setupMusicPlayer() {
  const player = document.getElementById('radio-player');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const volumeControl = document.getElementById('volumeControl');
  const bars = document.querySelectorAll('.bar');

  playPauseBtn.addEventListener('click', () => {
    if (player.paused) {
      player.play();
      playPauseBtn.textContent = 'Pause';
      bars.forEach(bar => bar.style.animationPlayState = 'running');
    } else {
      player.pause();
      playPauseBtn.textContent = 'Play';
      bars.forEach(bar => bar.style.animationPlayState = 'paused');
    }
  });

  volumeControl.addEventListener('input', () => {
    player.volume = volumeControl.value;
  });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  loadRandomVideo();
  setupClickerGame();
  setupMusicPlayer();
});