import { Settings } from './Settings.js';

export class ScoreSystem {
  constructor() {
    this.best = Settings.getBest();
    this.score = 0;
    this.reset(0, 10);
  }

  reset(startScore, target) {
    this.score = startScore;
    this.levelStart = startScore;
    this.food = 0;
    this.golden = 0;
    this.target = target;
    this.time = 0;
    this.hits = 0;
    this.heartsLost = 0;
    this.closeCalls = 0;
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt) {
    this.time += dt;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 0;
  }

  // Quick successive snacks build a combo multiplier.
  eat(points, golden) {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 3.5;
    const mult = Math.min(4, this.combo);
    const gained = points * mult;
    this.score += gained;
    this.food++;
    if (golden) this.golden++;
    return { gained, mult };
  }

  add(points) {
    this.score += points;
  }

  registerHit() {
    this.hits++;
  }

  levelBonus(hearts, parTime) {
    const timeBonus = Math.max(0, Math.round((parTime - this.time) * 20));
    const heartBonus = hearts * 300;
    const flawless = this.heartsLost === 0 && this.hits === 0 ? 1000 : 0;
    return { timeBonus, heartBonus, flawless, total: timeBonus + heartBonus + flawless };
  }

  commitBest() {
    const isNew = this.score > this.best;
    if (isNew) {
      this.best = this.score;
      Settings.setBest(this.best);
    }
    return isNew;
  }
}
