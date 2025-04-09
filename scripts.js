// Получаем элементы
const playPauseBtn = document.getElementById('playPauseBtn');
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
