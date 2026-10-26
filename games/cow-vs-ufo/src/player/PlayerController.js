// Keyboard, mouse-drag and touch input, collected into one place. Gameplay code
// reads `move` every frame and consumes one-shot actions (jump, moo, pause).
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  KeyM: 'moo', KeyF: 'moo',
  KeyQ: 'camLeft', KeyE: 'camRight',
  Escape: 'pause', KeyP: 'pause',
};

export class PlayerController {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.move = { x: 0, y: 0 };
    this.touchMove = { x: 0, y: 0 };
    this.cam = { x: 0, y: 0 };
    this.queued = { jump: 0, moo: false, pause: false };
    this.enabled = true;
    this.lastCamInput = -10;
    this.drag = null;

    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      if (action !== 'pause' && document.activeElement?.tagName === 'INPUT') return;
      if (['up', 'down', 'jump'].includes(action) && this.enabled) e.preventDefault();
      if (e.repeat) return;
      this.held.add(action);
      if (action === 'jump') this.queued.jump = performance.now();
      if (action === 'moo') this.queued.moo = true;
      if (action === 'pause') this.queued.pause = true;
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.held.delete(action);
    });
    window.addEventListener('blur', () => this.held.clear());

    // Camera drag with mouse or a finger that isn't on the on-screen controls.
    canvas.addEventListener('pointerdown', (e) => {
      if (this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.cam.x += e.clientX - this.drag.x;
      this.cam.y += e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.lastCamInput = performance.now();
    });
    const end = (e) => {
      if (this.drag && this.drag.id === e.pointerId) this.drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const h = this.held;
    let x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0) + this.touchMove.x;
    let y = (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0) + this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
    if (h.has('camLeft')) this.cam.x -= 6;
    if (h.has('camRight')) this.cam.x += 6;
  }

  pressJump() {
    this.queued.jump = performance.now();
  }

  // Jump presses are buffered briefly so a press just before landing still counts.
  consumeJump(bufferMs = 140) {
    if (this.queued.jump && performance.now() - this.queued.jump < bufferMs) {
      return true;
    }
    return false;
  }

  clearJump() {
    this.queued.jump = 0;
  }

  consumeMoo() {
    const v = this.queued.moo;
    this.queued.moo = false;
    return v;
  }

  consumePause() {
    const v = this.queued.pause;
    this.queued.pause = false;
    return v;
  }

  consumeCam() {
    const c = { x: this.cam.x, y: this.cam.y };
    this.cam.x = 0;
    this.cam.y = 0;
    return c;
  }

  reset() {
    this.held.clear();
    this.touchMove.x = this.touchMove.y = 0;
    this.queued.jump = 0;
    this.queued.moo = false;
    this.queued.pause = false;
    this.cam.x = this.cam.y = 0;
  }
}
