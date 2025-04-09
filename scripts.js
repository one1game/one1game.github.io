// Получаем элементы
const playPauseBtn = document.getElementById('playPauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audioPlayer = document.getElementById('radio-player');
const bars = document.querySelectorAll('.bar');

// Функция для старта/паузы воспроизведения
playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.textContent = 'Pause';
        // Запускаем анимацию эквалайзера
        bars.forEach(bar => bar.style.animationPlayState = 'running');
    } else {
        audioPlayer.pause();
        playPauseBtn.textContent = 'Play';
        // Останавливаем анимацию эквалайзера
        bars.forEach(bar => bar.style.animationPlayState = 'paused');
    }
});

// Функция для остановки воспроизведения
stopBtn.addEventListener('click', () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0; // сбросить время воспроизведения
    playPauseBtn.textContent = 'Play';
    // Останавливаем анимацию эквалайзера
    bars.forEach(bar => bar.style.animationPlayState = 'paused');
});
