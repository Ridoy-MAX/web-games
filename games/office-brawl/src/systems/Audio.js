// Synthesized sound for Office Brawl (no audio files). The context starts on
// the first user gesture; the optional announcer uses the browser's speech engine.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Office funk: 16 steps per bar, 4 bars.
const FUNK_BASS = [40, 0, 40, 52, 0, 40, 0, 43, 45, 0, 45, 57, 0, 43, 0, 38];
const FUNK_CHORDS = [[64, 67, 71], [62, 66, 69], [64, 67, 71], [59, 62, 66]];
const BOSS_BASS = [38, 38, 0, 38, 41, 0, 38, 0, 36, 36, 0, 36, 39, 0, 41, 43];

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.mode = 'menu';
    this.step = 0;
    this.next = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.next = this.ctx.currentTime + 0.1;
    setInterval(() => this.schedule(), 25);
  }

  apply() {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.sound ? this.settings.volume : 0;
    this.music.gain.value = this.settings.music ? 0.3 : 0;
  }

  setMusic(mode) {
    this.mode = mode;
  }

  tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, delay = 0, dest = null, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 1200, f2 = null, type = 'lowpass', q = 1, delay = 0, dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // --- combat --------------------------------------------------------------------
  punch() {
    this.noise({ dur: 0.08, vol: 0.5, freq: 2200, type: 'bandpass', q: 0.8 });
    this.tone({ f: 180, f2: 70, dur: 0.1, vol: 0.4 });
  }
  kick() {
    this.noise({ dur: 0.12, vol: 0.5, freq: 1200, type: 'bandpass', q: 0.7 });
    this.tone({ f: 130, f2: 50, dur: 0.16, vol: 0.5 });
  }
  heavy() {
    this.noise({ dur: 0.2, vol: 0.6, freq: 900, f2: 200 });
    this.tone({ f: 110, f2: 35, dur: 0.28, vol: 0.6 });
    this.tone({ type: 'square', f: 70, f2: 40, dur: 0.15, vol: 0.12 });
  }
  block() {
    this.tone({ type: 'square', f: 900, f2: 600, dur: 0.06, vol: 0.08 });
    this.noise({ dur: 0.06, vol: 0.25, freq: 4000, type: 'highpass' });
  }
  whoosh(power = 1) {
    this.noise({ dur: 0.12 + power * 0.08, vol: 0.12 * power, freq: 600, f2: 3000, type: 'bandpass', q: 1.5 });
  }
  jump() {
    this.tone({ type: 'triangle', f: 280, f2: 520, dur: 0.12, vol: 0.12 });
  }
  throw() {
    this.noise({ dur: 0.15, vol: 0.18, freq: 1500, f2: 4000, type: 'bandpass', q: 2 });
  }
  pop() {
    this.tone({ f: 350, f2: 900, dur: 0.1, vol: 0.25 });
  }
  powerUp() {
    [60, 64, 67, 72].forEach((n, i) => this.tone({ type: 'square', f: NOTE(n), dur: 0.1, vol: 0.07, delay: i * 0.05 }));
  }
  blast() {
    this.noise({ dur: 0.5, vol: 0.4, freq: 300, f2: 2000, type: 'bandpass', q: 0.6 });
    this.tone({ type: 'sawtooth', f: 90, f2: 300, dur: 0.4, vol: 0.12 });
  }
  rumble() {
    this.noise({ dur: 1.0, vol: 0.3, freq: 160 });
  }
  explode() {
    this.noise({ dur: 0.7, vol: 0.6, freq: 500, f2: 80 });
    this.tone({ f: 80, f2: 30, dur: 0.6, vol: 0.6 });
  }
  whistle() {
    this.tone({ f: 1800, f2: 500, dur: 0.5, vol: 0.06 });
  }
  splat() {
    this.noise({ dur: 0.2, vol: 0.25, freq: 900, f2: 200 });
  }
  grab() {
    this.tone({ type: 'sawtooth', f: 200, f2: 120, dur: 0.2, vol: 0.12 });
  }
  thud() {
    this.tone({ f: 90, f2: 40, dur: 0.2, vol: 0.45 });
    this.noise({ dur: 0.15, vol: 0.2, freq: 400 });
  }
  superStart() {
    this.tone({ type: 'sawtooth', f: 120, f2: 1200, dur: 0.6, vol: 0.12 });
    this.noise({ dur: 0.6, vol: 0.2, freq: 300, f2: 6000, type: 'bandpass', q: 1 });
  }
  bell() {
    for (let i = 0; i < 3; i++) {
      this.tone({ f: 1320, dur: 0.9, vol: 0.18, delay: i * 0.28 });
      this.tone({ f: 1980, dur: 0.6, vol: 0.08, delay: i * 0.28 });
    }
  }
  cheer(power = 1) {
    this.noise({ dur: 1.2 * power, vol: 0.12 * power, freq: 1400, type: 'bandpass', q: 0.4 });
    this.noise({ dur: 0.9 * power, vol: 0.08 * power, freq: 3000, type: 'bandpass', q: 0.6, delay: 0.1 });
  }
  ooh() {
    this.tone({ type: 'sawtooth', f: 220, f2: 180, dur: 0.6, vol: 0.04 });
    this.tone({ type: 'sawtooth', f: 277, f2: 230, dur: 0.6, vol: 0.03 });
  }
  beep() {
    this.tone({ type: 'square', f: 880, dur: 0.08, vol: 0.06 });
  }
  click() {
    this.tone({ type: 'triangle', f: 700, f2: 950, dur: 0.06, vol: 0.12 });
  }
  select() {
    this.tone({ type: 'square', f: 523, dur: 0.08, vol: 0.08 });
    this.tone({ type: 'square', f: 784, dur: 0.12, vol: 0.08, delay: 0.07 });
  }
  win() {
    [60, 64, 67, 72, 76].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.3, vol: 0.18, delay: i * 0.1 }));
  }
  lose() {
    [[67, 0.3], [66, 0.3], [65, 0.3], [64, 1.0]].reduce((d, [n, len]) => {
      this.tone({ type: 'sawtooth', f: NOTE(n - 12), dur: len, vol: 0.1, delay: d });
      return d + len * 0.9;
    }, 0);
  }

  // Announcer via speech synthesis (optional).
  announce(text) {
    if (!this.settings.voice || !this.settings.sound || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 0.6;
      u.volume = Math.min(1, this.settings.volume + 0.2);
      window.speechSynthesis.speak(u);
    } catch {
      /* speech not available */
    }
  }

  // --- music ---------------------------------------------------------------------
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const bpm = this.mode === 'boss' ? 132 : this.mode === 'menu' ? 100 : 112;
    const stepDur = 60 / bpm / 4;
    while (this.next < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.next - this.ctx.currentTime);
      this.next += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  play(step, delay) {
    if (!this.settings.music || this.mode === 'off') return;
    const m = this.music;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    if (this.mode === 'boss') {
      if (s % 4 === 0) this.tone({ f: 110, f2: 40, dur: 0.15, vol: 0.5, delay, dest: m });
      if (s % 4 === 2) this.noise({ dur: 0.08, vol: 0.18, freq: 2000, type: 'bandpass', delay, dest: m });
      const b = BOSS_BASS[s];
      if (b) this.tone({ type: 'sawtooth', f: NOTE(b - (bar === 3 ? 2 : 0)), dur: 0.12, vol: 0.1, delay, dest: m });
      if (s === 0 && bar % 2 === 0) [62, 65, 69].forEach((n) => this.tone({ type: 'sawtooth', f: NOTE(n), dur: 0.5, vol: 0.025, delay, dest: m }));
      return;
    }
    // Funk / menu groove.
    if (s % 8 === 0) this.tone({ f: 120, f2: 45, dur: 0.16, vol: 0.45, delay, dest: m });
    if (s % 8 === 4) this.noise({ dur: 0.1, vol: 0.16, freq: 1800, type: 'bandpass', delay, dest: m });
    if (s % 2 === 0) this.noise({ dur: 0.03, vol: this.mode === 'menu' ? 0.03 : 0.05, freq: 7000, type: 'highpass', delay, dest: m });
    const b = FUNK_BASS[s];
    if (b) this.tone({ type: 'triangle', f: NOTE(b + (bar === 3 ? -5 : bar === 1 ? -2 : 0)), dur: 0.14, vol: 0.28, delay, dest: m });
    if (s === 2 || s === 6 || s === 11) FUNK_CHORDS[bar].forEach((n) => this.tone({ type: 'square', f: NOTE(n - 12), dur: 0.06, vol: 0.02, delay, dest: m }));
  }
}
