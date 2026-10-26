import { Controller } from './Input.js';

const PROJECTILE_KINDS = new Set(['projectile']);
const DASH_KINDS = new Set(['melee']);

// A CPU coworker. `level` (0..1) controls reaction time, blocking, combos and
// how often it uses specials. Low levels occasionally just... check their email.
export class AIController extends Controller {
  constructor(game, level = 0.3) {
    super();
    this.game = game;
    this.level = level;
    this.cool = 0;
    this.queue = [];
    this.mode = null;
  }

  setFighter(f) {
    this.f = f;
    const sp = f.def.specials;
    const slots = (test) => sp.map((s, i) => (test(s) ? i : -1)).filter((i) => i >= 0);
    this.slots = {
      projectile: slots((s) => PROJECTILE_KINDS.has(s.kind)),
      dash: slots((s) => DASH_KINDS.has(s.kind) && (s.moveVx || s.range?.[1] > 2)),
      grab: slots((s) => s.kind === 'grab'),
      other: slots((s) => ['teleport', 'buff'].includes(s.kind)),
    };
  }

  // A random special of the given kind as an action name, or null.
  slot(kind) {
    const list = this.slots[kind];
    return list.length ? `s${list[Math.floor(Math.random() * list.length)] + 1}` : null;
  }

  later(frames, fn) {
    this.queue.push({ at: this.frame + frames, fn });
  }

  tick() {
    super.tick();
    for (const q of this.queue) if (q.at <= this.frame) q.fn();
    this.queue = this.queue.filter((q) => q.at > this.frame);
    if (!this.f || !this.f.opp) return;
    if (this.cool > 0) {
      this.cool--;
      return;
    }
    this.think();
  }

  hold(dir, frames) {
    this.held.left = this.held.right = this.held.up = this.held.down = false;
    if (dir) for (const d of dir.split('+')) this.held[d] = true;
    this.cool = frames;
  }

  think() {
    const me = this.f;
    const op = me.opp;
    const L = this.level;
    const rnd = Math.random;
    const dx = op.x - me.x;
    const dist = Math.abs(dx);
    const toward = dx > 0 ? 'right' : 'left';
    const away = dx > 0 ? 'left' : 'right';
    const decide = Math.round(16 - 11 * L);
    const neutral = ['idle', 'walk', 'crouch'].includes(me.state);

    // Combo follow-ups after a confirmed hit.
    if (me.state === 'attack' && me.hitConfirmed && me.move?.cancel && rnd() < 0.3 + 0.5 * L) {
      if (me.meter >= 100 && rnd() < 0.5) this.press('sup');
      else if (rnd() < 0.5 && this.slot('dash')) this.press(this.slot('dash'));
      else this.press('hk');
      this.cool = 6;
      return;
    }
    if (!neutral && me.state !== 'blockstun') {
      this.hold(null, 2);
      return;
    }

    // Too-easy bosses are boring, but rookies get to be silly.
    if (L < 0.35 && rnd() < 0.04) {
      this.hold(null, 40);
      this.game.fx.text(['checking emails…', '*sips coffee*', 'brb', 'is this billable?'][Math.floor(rnd() * 4)], me.headPos(), 'tiny', 1.2);
      return;
    }

    // Defence: block incoming attacks and projectiles.
    const threat = this.threat(me, op, dist);
    if (threat && rnd() < 0.25 + 0.65 * L) {
      this.hold(threat.low ? `${away}+down` : away, threat.frames);
      return;
    }

    // Anti-air.
    if (op.y > 0.8 && op.vy < 4 && dist < 2.4 && rnd() < 0.25 + 0.5 * L) {
      this.press('hk');
      this.hold(null, decide);
      return;
    }

    // Super when it'll probably land.
    if (me.meter >= 100 && dist < 5 && rnd() < 0.08 + 0.2 * L) {
      this.press('sup');
      this.hold(null, decide);
      return;
    }

    if (dist > 4.5) {
      if (this.slot('projectile') && !this.game.hazards.hasProjectile(me) && rnd() < 0.25 + 0.3 * L) {
        this.press(this.slot('projectile'));
        this.hold(null, decide + 10);
      } else if (this.slot('other') && rnd() < 0.08) {
        this.press(this.slot('other'));
        this.hold(null, decide + 10);
      } else if (rnd() < 0.1) {
        this.hold(`${toward}+up`, 6);
      } else {
        this.hold(toward, decide + 6);
      }
      return;
    }

    if (dist > 2.0) {
      const r = rnd();
      if (this.slot('dash') && r < 0.12 + 0.12 * L) {
        this.press(this.slot('dash'));
        this.hold(null, decide + 8);
      } else if (r < 0.3 && this.slot('projectile') && !this.game.hazards.hasProjectile(me)) {
        this.press(this.slot('projectile'));
        this.hold(null, decide + 8);
      } else if (r < 0.42) {
        this.hold(`${toward}+up`, 4);
        this.later(14, () => this.press('hk'));
      } else {
        this.hold(toward, decide);
      }
      return;
    }

    // Close range.
    const r = rnd();
    if (this.slot('grab') && r < 0.22) {
      this.press(this.slot('grab'));
      this.hold(null, decide + 10);
    } else if (r < 0.5) {
      this.press('lp');
      this.later(7, () => this.press(rnd() < 0.6 ? 'hk' : 'lp'));
      this.hold(null, decide + 10);
    } else if (r < 0.65) {
      this.hold('down', 3);
      this.later(1, () => this.press(rnd() < 0.5 ? 'hk' : 'lp'));
    } else if (r < 0.78) {
      this.press('hk');
      this.hold(null, decide + 6);
    } else if (r < 0.9) {
      this.hold(away, 10 + Math.round(10 * L));
    } else {
      this.hold(`${toward}+up`, 4);
      this.later(10, () => this.press('lp'));
    }
  }

  threat(me, op, dist) {
    if (op.state === 'attack' && op.move) {
      const m = op.move;
      const left = m.startup + (m.active ?? 1) - op.moveFrame;
      const reach = (m.range?.[1] ?? 2.5) * op.reach + 0.8;
      if (left > -2 && dist < reach + (m.moveVx ? 3 : 0)) return { low: !!m.low, frames: Math.max(6, left + 6) };
      if (op.isSuper) return { low: false, frames: 20 };
    }
    for (const h of this.game.hazards.list) {
      if (h.owner !== op || !['projectile', 'wave', 'drop'].includes(h.type)) continue;
      const d = h.x - me.x;
      const coming = h.vx ? Math.sign(-d) === Math.sign(h.vx) || h.type === 'drop' : true;
      if (coming && Math.abs(d) < 3.5) return { low: !!h.p?.low, frames: 14 };
    }
    return null;
  }
}
