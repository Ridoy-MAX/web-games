// requestAnimationFrame loop with a clamped delta so a background tab or a
// long frame can't teleport the cow through a wall.
export class GameLoop {
  constructor(update) {
    this.update = update;
    this.last = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(dt);
    requestAnimationFrame(this.frame);
  }
}
