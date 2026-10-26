const KEYS = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', Space: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyJ: 'lp', KeyZ: 'lp',
  KeyK: 'hk', KeyX: 'hk',
  KeyU: 's1', KeyC: 's1',
  KeyI: 's2', KeyV: 's2',
  KeyO: 'sup', KeyB: 'sup',
};
const BUFFER = 8; // frames a button press stays "live"

// A controller exposes held directions plus buffered button presses that the
// fighter consumes with take(). The human and the AI share this interface.
export class Controller {
  constructor() {
    this.held = { left: false, right: false, up: false, down: false };
    this.pressed = {};
    this.frame = 0;
  }

  press(action) {
    this.pressed[action] = this.frame;
  }

  take(action) {
    const at = this.pressed[action];
    if (at !== undefined && this.frame - at <= BUFFER) {
      delete this.pressed[action];
      return true;
    }
    return false;
  }

  tick() {
    this.frame++;
  }

  reset() {
    for (const k in this.held) this.held[k] = false;
    this.pressed = {};
  }
}

export class HumanController extends Controller {
  constructor() {
    super();
    this.keys = new Set();
    this.touch = { left: false, right: false, up: false, down: false };
    this.enabled = false;
    this.onPause = null;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.onPause?.();
        return;
      }
      const a = KEYS[e.code];
      if (!a || !this.enabled) return;
      e.preventDefault();
      if (e.repeat) return;
      if (['left', 'right', 'up', 'down'].includes(a)) this.keys.add(a);
      else this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYS[e.code];
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  tick() {
    super.tick();
    for (const d of ['left', 'right', 'up', 'down']) this.held[d] = this.keys.has(d) || this.touch[d];
  }

  reset() {
    super.reset();
    this.keys.clear();
    for (const k in this.touch) this.touch[k] = false;
  }
}
