import { pick } from '../utils/math.js';

const FACES = ['😐', '😠', '😤', '🤬'];
const WORDS = {
  lp: ['SLAP!', 'BONK', 'WHAP', 'BOOP'],
  hk: ['KICK!', 'YEET', 'HIYA!', 'BOOT'],
  sup: ['OVERTIME!', 'NO BREAKS', 'CRUNCH!', 'DEADLINE'],
};

// On-screen controls: a stress-ball joystick that gets angrier the harder you
// squeeze it, plus slap/kick/special/super buttons with rotating labels.
export class Touch {
  constructor(controller, audio) {
    this.c = controller;
    this.el = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('knob');
    this.face = document.getElementById('knob-face');
    this.enabled = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.id = null;

    const set = (e) => {
      const r = this.stick.getBoundingClientRect();
      const max = r.width * 0.36;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      const k = Math.min(1, len / max);
      this.knob.style.transform = `translate(${dx}px, ${dy}px) scale(${1 - k * 0.12}, ${1 + k * 0.08})`;
      this.face.textContent = FACES[Math.min(FACES.length - 1, Math.floor(k * FACES.length))];
      const nx = dx / max;
      const ny = dy / max;
      const t = this.c.touch;
      t.left = nx < -0.35;
      t.right = nx > 0.35;
      t.up = ny < -0.55;
      t.down = ny > 0.5;
    };
    const release = (e) => {
      if (e.pointerId !== this.id) return;
      this.id = null;
      this.resetStick();
    };
    this.stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      this.id = e.pointerId;
      this.stick.setPointerCapture(e.pointerId);
      set(e);
    });
    this.stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.id) set(e);
    });
    this.stick.addEventListener('pointerup', release);
    this.stick.addEventListener('pointercancel', release);

    for (const b of this.el.querySelectorAll('.tbtn')) {
      const act = b.dataset.act;
      const label = b.querySelector('.tt');
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.unlock();
        this.c.press(act);
        navigator.vibrate?.(act === 'sup' ? 40 : 12);
        b.classList.remove('down');
        void b.offsetWidth;
        b.classList.add('down');
        if (WORDS[act]) label.textContent = pick(WORDS[act]);
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setMoves(def) {
    document.getElementById('t-s1').textContent = def.specials[0].short;
    document.getElementById('t-s2').textContent = def.specials[1].short;
  }

  resetStick() {
    this.knob.style.transform = '';
    this.face.textContent = FACES[0];
    for (const k in this.c.touch) this.c.touch[k] = false;
  }

  show(v) {
    this.el.classList.toggle('hidden', !(v && this.enabled));
    document.getElementById('rotate-hint').classList.toggle('hidden', !(v && this.enabled && innerHeight > innerWidth));
    if (!v) this.resetStick();
  }
}
