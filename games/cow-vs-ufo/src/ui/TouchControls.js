import { pick } from '../utils/math.js';

const JUMP_WORDS = ['BOING!', 'YEET!', 'HOP!', 'WHEE!', 'SPROING!', 'UP!', 'FLY?!'];
const MOO_WORDS = ['MOOO!', 'moo?', 'MOOOOOO', '*cow noises*', 'M-O-O!', 'mOoO', 'MOO.exe'];
const FACES = ['😐', '🙂', '😄', '😆', '🤪'];

// Virtual joystick (a cow nose that gets happier the harder you push it) plus
// jump/moo buttons that say something different every time you press them.
export class TouchControls {
  constructor(input, audio) {
    this.input = input;
    this.audio = audio;
    this.el = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('knob');
    this.face = document.getElementById('knob-face');
    this.jumpText = document.getElementById('jump-text');
    this.bubble = document.getElementById('moo-bubble');
    this.enabled = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.stickId = null;

    const buzz = (ms) => navigator.vibrate?.(ms);
    const radius = () => this.stick.clientWidth / 2;
    const moveKnob = (e) => {
      const r = this.stick.getBoundingClientRect();
      const max = radius() * 0.7;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      const amount = Math.min(1, len / max);
      this.knob.style.transform = `translate(${dx}px, ${dy}px) rotate(${(dx / max) * 18}deg)`;
      this.face.textContent = FACES[Math.min(FACES.length - 1, Math.floor(amount * FACES.length))];
      this.stick.classList.toggle('max', amount > 0.95);
      input.touchMove.x = dx / max;
      input.touchMove.y = -dy / max;
    };
    const release = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.resetStick();
    };
    this.stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      this.stickId = e.pointerId;
      this.stick.setPointerCapture(e.pointerId);
      this.stick.classList.add('active');
      buzz(8);
      moveKnob(e);
    });
    this.stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) moveKnob(e);
    });
    this.stick.addEventListener('pointerup', release);
    this.stick.addEventListener('pointercancel', release);

    const button = (id, fn) => {
      const b = document.getElementById(id);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.unlock();
        b.classList.remove('down');
        void b.offsetWidth; // restart the squish animation
        b.classList.add('down');
        buzz(15);
        fn();
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    button('btn-jump', () => {
      input.pressJump();
      this.jumpText.textContent = pick(JUMP_WORDS);
    });
    button('btn-moo', () => {
      input.queued.moo = true;
      this.bubble.textContent = pick(MOO_WORDS);
      this.bubble.classList.remove('pop');
      void this.bubble.offsetWidth;
      this.bubble.classList.add('pop');
    });
  }

  resetStick() {
    this.knob.style.transform = '';
    this.face.textContent = FACES[0];
    this.stick.classList.remove('active', 'max');
    this.input.touchMove.x = this.input.touchMove.y = 0;
  }

  show(visible) {
    this.el.classList.toggle('hidden', !(visible && this.enabled));
    if (!visible) {
      this.stickId = null;
      this.resetStick();
    }
  }
}
