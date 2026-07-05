// Глобальный радио-плеер для всех страниц
class GlobalRadioPlayer {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.volume = localStorage.getItem('one1game_radio_volume') || 0.7;
    this.isPaused = localStorage.getItem('one1game_radio_paused') === 'true';
    
    this.init();
  }

  init() {
    console.log('📻 Initializing Global Radio Player...');
    
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupRadio());
    } else {
      this.setupRadio();
    }
  }

  setupRadio() {
    // Проверяем, есть ли уже радио на странице
    const existingRadio = document.getElementById('radio-stream');
    if (existingRadio) {
      console.log('✅ Radio already exists on page');
      this.audio = existingRadio;
      this.bindEvents();
      this.restoreState();
      return;
    }
    
    // Если радио нет на странице, создаем скрытое
    this.createHiddenRadio();
  }

  createHiddenRadio() {
    console.log('🔇 Creating hidden radio player');
    
    // Создаем скрытый аудио элемент
    this.audio = document.createElement('audio');
    this.audio.id = 'radio-stream';
    this.audio.src = 'https://spritelayerradio.com/listen/classic/classic.mp3';
    this.audio.preload = 'metadata';
    this.audio.style.display = 'none';
    
    document.body.appendChild(this.audio);
    
    this.bindEvents();
    this.restoreState();
  }

  bindEvents() {
    // Восстанавливаем состояние из localStorage
    this.audio.volume = parseFloat(this.volume);
    
    // Сохраняем состояние при изменении
    this.audio.addEventListener('volumechange', () => {
      localStorage.setItem('one1game_radio_volume', this.audio.volume);
    });
    
    // Обработка ошибок
    this.audio.addEventListener('error', (e) => {
      console.error('Radio error:', e);
    });
    
    // Сохраняем состояние паузы
    this.audio.addEventListener('pause', () => {
      localStorage.setItem('one1game_radio_paused', 'true');
    });
    
    this.audio.addEventListener('play', () => {
      localStorage.setItem('one1game_radio_paused', 'false');
    });
  }

  restoreState() {
    // Восстанавливаем громкость
    this.audio.volume = parseFloat(this.volume);
    
    // Восстанавливаем состояние воспроизведения
    if (this.isPaused === 'false' || !this.isPaused) {
      this.audio.play().catch(e => {
        console.log('Auto-play blocked or error:', e);
      });
    }
    
    console.log('📻 Radio state restored:', {
      volume: this.audio.volume,
      paused: this.audio.paused
    });
  }

  // Публичные методы для управления
  play() {
    if (this.audio) {
      this.audio.play();
      localStorage.setItem('one1game_radio_paused', 'false');
    }
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
      localStorage.setItem('one1game_radio_paused', 'true');
    }
  }

  setVolume(vol) {
    if (this.audio) {
      this.audio.volume = vol;
      localStorage.setItem('one1game_radio_volume', vol);
    }
  }

  toggle() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
}

// Инициализируем глобальный радио-плеер
window.One1GameRadio = new GlobalRadioPlayer();

// Экспортируем методы для использования на других страницах
window.toggleRadio = () => window.One1GameRadio.toggle();
window.setRadioVolume = (vol) => window.One1GameRadio.setVolume(vol);