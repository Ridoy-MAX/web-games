const SCREENS = ['menu', 'howto', 'settings', 'wardrobe', 'pause', 'gameover', 'victory'];

// Shows one overlay screen at a time and routes every [data-action] button click
// to a registered handler. Sub-screens (settings, how-to) remember where they
// were opened from so "back" returns there.
export class UIManager {
  constructor(audio) {
    this.audio = audio;
    this.screens = Object.fromEntries(SCREENS.map((id) => [id, document.getElementById(id)]));
    this.current = null;
    this.stack = [];
    this.handlers = {};
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this.audio.unlock();
      this.audio.click();
      const fn = this.handlers[btn.dataset.action];
      if (fn) fn(btn);
    });
    this.on('back', () => this.back());
  }

  on(action, fn) {
    this.handlers[action] = fn;
  }

  setVisible(name) {
    for (const [id, el] of Object.entries(this.screens)) el.classList.toggle('visible', id === name);
    this.current = name;
    // Move keyboard focus into the new screen for accessibility.
    const first = name && this.screens[name]?.querySelector('button');
    if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
  }

  show(name, { push = false } = {}) {
    if (push && this.current) this.stack.push(this.current);
    else this.stack = [];
    this.setVisible(name);
  }

  back() {
    const prev = this.stack.pop() ?? 'menu';
    this.setVisible(prev);
  }

  // Shows the "saved to your profile" line on the game over / victory screens.
  setSaveStatus(kind, text) {
    for (const el of document.querySelectorAll('.save-status')) {
      el.textContent = text;
      el.dataset.kind = kind;
    }
  }

  hideAll() {
    this.stack = [];
    this.setVisible(null);
  }
}
