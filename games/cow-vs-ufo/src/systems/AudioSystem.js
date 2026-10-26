// Every sound is synthesized with the Web Audio API, so there are no audio files
// to license or load. The context is only created after a user gesture to respect
// browser autoplay rules.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Bouncy farm tune: 16th-note steps, 4 bars of I-IV-V-I in C.
const FARM_BASS = [48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 60, 0, 55, 0];
const FARM_CHORDS = [48, 53, 55, 48];
const FARM_MELODY = [
  72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 74, 72, 0, 0, 0,
  77, 0, 81, 0, 84, 0, 81, 0, 79, 0, 77, 76, 74, 0, 0, 0,
  79, 0, 83, 0, 86, 0, 83, 0, 84, 83, 81, 79, 77, 0, 74, 0,
  76, 0, 79, 0, 72, 0, 76, 0, 74, 0, 71, 0, 72, 0, 0, 0,
];
const DISCO_BASS = [36, 0, 48, 0, 36, 0, 48, 0, 41, 0, 53, 0, 43, 0, 55, 46];

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.mode = 'farm';
    this.step = 0;
    this.nextNoteTime = 0;
    this.beam = null;
    this.musicTimer = null;
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
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applySettings();
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.sound ? s.volume : 0;
    this.music.gain.value = s.music ? 0.32 : 0;
  }

  setMusicMode(mode) {
    this.mode = mode;
  }

  suspend(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }

  // --- building blocks -----------------------------------------------------

  tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, dest = null, vibrato = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 7;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 1200, f2 = null, type = 'lowpass', delay = 0, q = 1, dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(dest || this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // --- sound effects ----------------------------------------------------------

  jump() {
    this.tone({ type: 'square', f: 260, f2: 720, dur: 0.16, vol: 0.08 });
    this.tone({ type: 'sine', f: 300, f2: 900, dur: 0.18, vol: 0.15 });
  }

  land(power = 1) {
    this.noise({ dur: 0.1, vol: 0.12 * power, freq: 500 });
    this.tone({ f: 120, f2: 60, dur: 0.1, vol: 0.15 * power });
  }

  collect() {
    this.tone({ type: 'triangle', f: 880, dur: 0.1, vol: 0.18 });
    this.tone({ type: 'triangle', f: 1320, dur: 0.18, vol: 0.18, delay: 0.07 });
  }

  golden() {
    [72, 76, 79, 84, 88].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.2, vol: 0.16, delay: i * 0.06 }));
  }

  bonk() {
    this.tone({ f: 240, f2: 70, dur: 0.3, vol: 0.35 });
    this.noise({ dur: 0.12, vol: 0.2, freq: 2000, type: 'bandpass' });
  }

  boing() {
    this.tone({ type: 'triangle', f: 110, f2: 560, dur: 0.4, vol: 0.25, vibrato: 30 });
  }

  clang() {
    this.tone({ type: 'square', f: 520, dur: 0.6, vol: 0.06 });
    this.tone({ type: 'square', f: 793, dur: 0.5, vol: 0.05 });
    this.noise({ dur: 0.25, vol: 0.35, freq: 300 });
    this.tone({ f: 90, f2: 40, dur: 0.35, vol: 0.4 });
  }

  splat() {
    this.noise({ dur: 0.35, vol: 0.35, freq: 900, f2: 200 });
    this.tone({ f: 110, f2: 40, dur: 0.3, vol: 0.3 });
  }

  squeak() {
    this.tone({ f: 1100, f2: 1700, dur: 0.12, vol: 0.15 });
    this.tone({ f: 1700, f2: 1200, dur: 0.12, vol: 0.12, delay: 0.1 });
  }

  whistle(dur = 1) {
    this.tone({ f: 1900, f2: 500, dur, vol: 0.05 });
  }

  fall() {
    this.tone({ f: 1100, f2: 120, dur: 1.3, vol: 0.18, vibrato: 12 });
  }

  pop() {
    this.tone({ f: 380, f2: 900, dur: 0.08, vol: 0.2 });
  }

  click() {
    this.tone({ type: 'triangle', f: 660, f2: 880, dur: 0.06, vol: 0.12 });
  }

  slip() {
    this.tone({ type: 'sine', f: 300, f2: 1500, dur: 0.5, vol: 0.18, vibrato: 40 });
  }

  hic() {
    this.tone({ type: 'square', f: 500, f2: 760, dur: 0.07, vol: 0.08 });
  }

  rumble(dur = 1.5) {
    this.noise({ dur, vol: 0.35, freq: 160, q: 0.5 });
  }

  alarm() {
    this.tone({ type: 'square', f: 880, dur: 0.12, vol: 0.06 });
    this.tone({ type: 'square', f: 660, dur: 0.12, vol: 0.06, delay: 0.15 });
    this.tone({ type: 'square', f: 880, dur: 0.12, vol: 0.06, delay: 0.3 });
  }

  zap() {
    this.tone({ type: 'sawtooth', f: 1400, f2: 200, dur: 0.25, vol: 0.08 });
  }

  moo(pitch = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.95;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150 * pitch, t);
    o.frequency.linearRampToValueAtTime(175 * pitch, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(105 * pitch, t + dur);
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = 4;
    lfo.connect(lg).connect(o.frequency);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(800, t + 0.3);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.setValueAtTime(0.5, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  bawk() {
    [0, 0.12, 0.24].forEach((d, i) => {
      this.tone({ type: 'square', f: 700 + i * 80, f2: 1100, dur: 0.08, vol: 0.07, delay: d });
      this.noise({ dur: 0.08, vol: 0.12, freq: 1500, type: 'bandpass', q: 4, delay: d });
    });
    this.tone({ type: 'square', f: 1000, f2: 520, dur: 0.3, vol: 0.08, delay: 0.36 });
  }

  win() {
    [60, 64, 67, 72].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.25, vol: 0.2, delay: i * 0.12 }));
    [72, 76, 79].forEach((n) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.9, vol: 0.14, delay: 0.5 }));
  }

  lose() {
    // Sad trombone.
    [[67, 0.35], [66, 0.35], [65, 0.35], [64, 1.2]].reduce((delay, [n, d]) => {
      this.tone({ type: 'sawtooth', f: NOTE(n - 12), dur: d, vol: 0.12, delay, vibrato: d > 1 ? 8 : 0 });
      return delay + d * 0.9;
    }, 0);
  }

  heartLost() {
    this.tone({ type: 'square', f: 523, f2: 262, dur: 0.4, vol: 0.1 });
  }

  // --- tractor beam hum -------------------------------------------------------

  beamOn() {
    if (!this.ctx || this.beam) return;
    const t = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 82;
    o2.frequency.value = 83.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = 300;
    lfo.connect(lg).connect(f.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.2);
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.sfx);
    [o1, o2, lfo].forEach((o) => o.start(t));
    this.beam = { nodes: [o1, o2, lfo], gain: g };
  }

  beamOff() {
    if (!this.beam) return;
    const t = this.ctx.currentTime;
    const { nodes, gain } = this.beam;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    nodes.forEach((n) => n.stop(t + 0.3));
    this.beam = null;
  }

  // --- music sequencer --------------------------------------------------------

  scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const stepDur = this.mode === 'disco' ? 60 / 118 / 4 : 60 / 132 / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime - this.ctx.currentTime);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, delay) {
    if (!this.settings.music || this.mode === 'off') return;
    const m = this.music;
    if (this.mode === 'disco') {
      const s = step % 16;
      if (s % 4 === 0) this.tone({ f: 120, f2: 45, dur: 0.18, vol: 0.5, delay, dest: m });
      if (s % 4 === 2) this.noise({ dur: 0.05, vol: 0.12, freq: 8000, type: 'highpass', delay, dest: m });
      const b = DISCO_BASS[s];
      if (b) this.tone({ type: 'square', f: NOTE(b), dur: 0.14, vol: 0.1, delay, dest: m });
      if (s === 4 || s === 12) [64, 67, 71].forEach((n) => this.tone({ type: 'sawtooth', f: NOTE(n), dur: 0.12, vol: 0.03, delay, dest: m }));
      return;
    }
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const root = FARM_CHORDS[bar] - 48;
    const b = FARM_BASS[s];
    if (b) this.tone({ type: 'triangle', f: NOTE(b + root - 12), dur: 0.22, vol: 0.22, delay, dest: m });
    if (s % 4 === 2) [64, 67].forEach((n) => this.tone({ type: 'square', f: NOTE(n + root), dur: 0.07, vol: 0.025, delay, dest: m }));
    if (s % 8 === 4) this.noise({ dur: 0.04, vol: 0.06, freq: 6000, type: 'highpass', delay, dest: m });
    const mel = FARM_MELODY[step];
    if (mel) this.tone({ type: 'square', f: NOTE(mel), dur: 0.14, vol: 0.04, delay, dest: m });
  }
}
