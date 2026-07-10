// ============ АУДИОСИСТЕМА CHAOS REALM ============
const SFX = {
  ctx: null,
  masterGain: null,
  enabled: true,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch(e) { this.enabled = false; }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  play(type, pitch = 1) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    switch(type) {
      case 'attack':
        this._noise(t, 0.08, 800, 200, 'sawtooth', 0.15);
        break;
      case 'fire':
        this._noise(t, 0.3, 300, 80, 'sawtooth', 0.2);
        this._noise(t, 0.25, 600, 150, 'sawtooth', 0.15, 0.05);
        break;
      case 'ice':
        this._noise(t, 0.25, 1200, 200, 'sine', 0.15);
        this._noise(t, 0.2, 800, 100, 'triangle', 0.1, 0.05);
        break;
      case 'lightning':
        this._noise(t, 0.15, 2000, 50, 'square', 0.2);
        this._noise(t, 0.1, 4000, 30, 'square', 0.15, 0.02);
        this._noise(t, 0.3, 80, 40, 'sawtooth', 0.1, 0.05);
        break;
      case 'heal':
        this._noise(t, 0.4, 500, 300, 'sine', 0.12);
        this._noise(t, 0.3, 700, 400, 'sine', 0.1, 0.1);
        this._noise(t, 0.2, 900, 500, 'sine', 0.08, 0.2);
        break;
      case 'ultimate':
        this._noise(t, 0.8, 100, 30, 'sawtooth', 0.25);
        this._noise(t, 0.6, 200, 60, 'sawtooth', 0.2, 0.1);
        this._noise(t, 0.5, 400, 100, 'square', 0.15, 0.2);
        this._noise(t, 0.4, 800, 200, 'sine', 0.1, 0.3);
        break;
      case 'hit':
        this._noise(t, 0.1, 200, 80, 'square', 0.15);
        this._noise(t, 0.08, 100, 40, 'sawtooth', 0.1, 0.02);
        break;
      case 'death':
        this._noise(t, 0.5, 300, 40, 'sawtooth', 0.2);
        this._noise(t, 0.4, 150, 30, 'sawtooth', 0.15, 0.1);
        this._noise(t, 0.3, 80, 20, 'square', 0.1, 0.2);
        break;
      case 'levelup':
        this._noise(t, 0.2, 400, 600, 'sine', 0.12);
        this._noise(t, 0.2, 600, 800, 'sine', 0.1, 0.08);
        this._noise(t, 0.3, 800, 1000, 'sine', 0.08, 0.15);
        break;
      case 'pickup':
        this._noise(t, 0.1, 800, 1000, 'sine', 0.08);
        this._noise(t, 0.08, 1000, 1200, 'sine', 0.06, 0.04);
        break;
      case 'dash':
        this._noise(t, 0.15, 600, 300, 'sine', 0.1);
        this._filterNoise(t, 0.2, 2000, 500, 0.05);
        break;
      case 'boss_hit':
        this._noise(t, 0.2, 150, 30, 'sawtooth', 0.2);
        this._noise(t, 0.15, 100, 20, 'square', 0.15, 0.05);
        break;
      case 'boss_death':
        this._noise(t, 1.0, 100, 20, 'sawtooth', 0.3);
        this._noise(t, 0.8, 60, 15, 'square', 0.25, 0.2);
        this._noise(t, 0.6, 30, 10, 'sawtooth', 0.2, 0.4);
        break;
      case 'combo':
        this._noise(t, 0.05, 600 + pitch * 200, 100, 'square', 0.08);
        break;
      case 'quest':
        this._noise(t, 0.3, 500, 700, 'sine', 0.1);
        this._noise(t, 0.25, 700, 900, 'sine', 0.08, 0.05);
        this._noise(t, 0.2, 900, 1100, 'sine', 0.06, 0.1);
        break;
      case 'achievement':
        this._noise(t, 0.15, 600, 800, 'triangle', 0.1);
        this._noise(t, 0.2, 800, 1000, 'triangle', 0.08, 0.05);
        this._noise(t, 0.3, 1000, 1200, 'triangle', 0.06, 0.1);
        this._noise(t, 0.4, 1200, 1400, 'triangle', 0.04, 0.15);
        break;
    }
  },

  // Базовый генератор звука
  _noise(startTime, duration, freqStart, freqEnd, waveType, vol, delay = 0) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freqStart, startTime + delay);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), startTime + delay + duration);
    gain.gain.setValueAtTime(vol, startTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime + delay);
    osc.stop(startTime + delay + duration + 0.05);
  },

  // Фильтрованный шум (для рывка)
  _filterNoise(startTime, duration, freq, q, vol, delay = 0) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * vol;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(startTime + delay);
    source.stop(startTime + delay + duration + 0.05);
  }
};

// Инициализация аудио при первом клике (политика браузера)
window.addEventListener('click', () => SFX.init(), { once: true });
window.addEventListener('keydown', () => SFX.init(), { once: true });
