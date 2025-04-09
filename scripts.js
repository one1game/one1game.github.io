// Управление проигрывателем
const radioPlayer = document.getElementById('radio-player');
const playPauseBtn = document.getElementById('playPauseBtn');
const volumeControl = document.getElementById('volumeControl');

// Функция для воспроизведения/паузы
playPauseBtn.addEventListener('click', () => {
    if (radioPlayer.paused) {
        radioPlayer.play();
        playPauseBtn.textContent = 'Pause';
    } else {
        radioPlayer.pause();
        playPauseBtn.textContent = 'Play';
    }
});

// Управление громкостью
volumeControl.addEventListener('input', () => {
    radioPlayer.volume = volumeControl.value;
});

// Эквалайзер
const bars = document.querySelectorAll('.bar');

// Эмуляция "анимированного" эквалайзера (пока без реального анализа звука)
setInterval(() => {
    bars.forEach(bar => {
        const randomHeight = Math.random() * 20 + 10; // Случайная высота для имитации эквалайзера
        bar.style.height = `${randomHeight}px`;
    });
}, 100);
