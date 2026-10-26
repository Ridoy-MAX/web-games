import * as THREE from 'three';
import { makeProp } from '../fighters/Props.js';
import { DT } from '../fighters/Fighter.js';
import { disposeObject } from '../utils/materials.js';
import { rand } from '../utils/math.js';

const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

// Everything that flies, falls or rolls: projectiles, super waves, rains of
// paperwork and a giant Rust crab.
export class Hazards {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.root = new THREE.Group();
    game.scene.add(this.root);
  }

  hasProjectile(owner) {
    return this.list.some((h) => h.owner === owner && h.type === 'projectile');
  }

  add(h, model) {
    h.mesh = makeProp(model);
    h.age = 0;
    this.root.add(h.mesh);
    this.list.push(h);
    this.place(h);
    return h;
  }

  place(h) {
    h.mesh.position.set(h.x, h.y, 0);
  }

  remove(h) {
    h.dead = true;
    this.root.remove(h.mesh);
    disposeObject(h.mesh);
  }

  clear() {
    for (const h of this.list) this.remove(h);
    this.list = [];
  }

  // --- spawning ----------------------------------------------------------------

  spawnProjectile(owner, move) {
    const p = move.projectile;
    const count = p.count ?? 1;
    for (let i = 0; i < count; i++) {
      this.add(
        {
          type: 'projectile', owner, p,
          x: owner.x + owner.facing * (0.9 + i * (p.spacing ?? 0)),
          y: p.ground ? 0 : p.y * owner.scale,
          vx: owner.facing * p.speed * (1 - i * 0.12),
          vy: p.vy ?? 0,
          w: p.w, h: p.h,
          dmg: move.dmg,
          hits: p.hits ?? 1,
          life: p.life * 60,
          returning: false,
          hitCooldown: 0,
          facing: owner.facing,
        },
        p.model,
      );
    }
  }

  spawnWave(owner, move) {
    const w = move.wave;
    this.add(
      {
        type: 'wave', owner, x: owner.x + owner.facing * 1.0, y: 0, vx: owner.facing * w.speed, w: w.w, h: w.h,
        dmg: move.dmg / move.hits, hits: move.hits, life: w.life * 60, hitCooldown: 0, facing: owner.facing, model: w.model,
      },
      w.model,
    );
  }

  spawnRain(owner, move) {
    this.list.push({
      type: 'rain', owner, model: move.rain.model, interval: move.rain.interval, timer: 0, spawned: 0, total: move.hits,
      dmg: move.dmg / move.hits, mesh: new THREE.Group(), age: 0, x: 0, y: 0,
    });
    this.game.audio.rumble();
  }

  spawnSummon(owner, move) {
    const target = owner.opp;
    this.add({ type: 'crab', owner, x: target.x, y: 12, vy: 0, phase: 'wait', timer: 0, dmg: move.dmg, w: 3, h: 2 }, 'crab');
    this.game.fx.text('INCOMING CRAB!', target.headPos(), 'comic');
  }

  // --- per logic frame ---------------------------------------------------------------

  update() {
    for (const h of this.list) {
      if (h.dead) continue;
      h.age++;
      switch (h.type) {
        case 'projectile':
          this.updateProjectile(h);
          break;
        case 'wave':
          this.updateWave(h);
          break;
        case 'rain':
          this.updateRain(h);
          break;
        case 'drop':
          this.updateDrop(h);
          break;
        case 'crab':
          this.updateCrab(h);
          break;
        default:
          break;
      }
      if (!h.dead) this.place(h);
    }
    this.list = this.list.filter((h) => !h.dead);
  }

  box(h) {
    return { x0: h.x - h.w / 2, x1: h.x + h.w / 2, y0: h.y - (h.type === 'projectile' && h.p.ground ? 0 : h.h / 2), y1: h.y + h.h / 2 };
  }

  touches(h, f) {
    if (!f.hurtable) return false;
    const a = this.box(h);
    const b = f.hurtbox();
    return overlap(a.x0, a.x1, b.x0, b.x1) && overlap(a.y0, a.y1, b.y0, b.y1);
  }

  updateProjectile(h) {
    const p = h.p;
    const g = this.game;
    if (p.gravity) h.vy -= p.gravity * DT;
    h.x += h.vx * DT;
    h.y += h.vy * DT;
    if (p.grow) {
      const s = 1 + (h.age / 60) * p.grow;
      h.mesh.scale.setScalar(s);
      h.w = p.w * s;
      h.h = p.h * s;
    }
    if (p.spin) h.mesh.rotation.z += p.spin * DT * -h.facing;
    if (p.ground) h.mesh.position.y = Math.abs(Math.sin(h.age * 0.4)) * 0.08;
    if (p.boomerang) {
      h.mesh.rotation.y += 20 * DT;
      if (!h.returning && h.age > h.life * 0.45) {
        h.returning = true;
        h.vx = -h.vx;
        h.hitCooldown = 0;
      }
      if (h.returning && Math.abs(h.x - h.owner.x) < 0.6) return this.remove(h);
    }
    h.mesh.scale.x = Math.abs(h.mesh.scale.x) * (p.model === 'bug' || p.model === 'briefcase' ? h.facing : 1);
    if (p.gravity && h.y <= 0.2) {
      g.fx.splash(h.x);
      g.audio.splat();
      return this.remove(h);
    }
    if (h.age > h.life || Math.abs(h.x) > 13) return this.remove(h);

    // Two projectiles cancel each other out.
    for (const o of this.list) {
      if (o === h || o.dead || o.owner === h.owner || (o.type !== 'projectile' && o.type !== 'wave')) continue;
      const a = this.box(h);
      const b = this.box(o);
      if (overlap(a.x0, a.x1, b.x0, b.x1) && overlap(a.y0, a.y1, b.y0, b.y1)) {
        g.fx.text('MERGE CONFLICT!', new THREE.Vector3(h.x, h.y + 0.6, 0), 'comic');
        g.fx.hitSpark(h.x, h.y, true);
        g.audio.block();
        this.remove(h);
        if (o.type === 'projectile') this.remove(o);
        return;
      }
    }

    if (h.hitCooldown > 0) h.hitCooldown--;
    const target = h.owner.opp;
    if (h.hitCooldown <= 0 && this.touches(h, target)) {
      const growMul = p.grow ? Math.min(2.2, h.mesh.scale.x) : 1;
      const r = g.combat.applyHit(h.owner, target, {
        dmg: h.dmg * growMul, hitstun: 18, blockstun: 12, push: 0.35, low: p.low, slow: p.slow, special: true, sfx: 'punch',
      }, h.x);
      if (r !== 'miss') {
        h.owner.gainMeter(r === 'hit' ? 8 : 3);
        if (--h.hits <= 0) return this.remove(h);
        h.hitCooldown = 14;
      }
    }
  }

  updateWave(h) {
    const g = this.game;
    h.x += h.vx * DT;
    const roll = h.mesh.userData.roll;
    if (roll) roll.rotation.y += h.vx * DT;
    h.mesh.scale.x = h.facing;
    if (h.age % 3 === 0) g.fx.dust(h.x, 0.6);
    // Waves plough straight through ordinary projectiles.
    for (const o of this.list) {
      if (o.type === 'projectile' && o.owner !== h.owner && !o.dead && Math.abs(o.x - h.x) < h.w) this.remove(o);
    }
    if (h.hitCooldown > 0) h.hitCooldown--;
    const target = h.owner.opp;
    if (h.hits > 0 && h.hitCooldown <= 0 && this.touches(h, target)) {
      const last = h.hits === 1;
      g.combat.applyHit(h.owner, target, {
        dmg: h.dmg, hitstun: 24, blockstun: 14, push: 0.1, chip: 0.25, isSuper: true, knockdown: last, launch: last ? [8, 10] : null,
      }, h.x - h.facing);
      h.hits--;
      h.hitCooldown = 6;
    }
    if (h.age > h.life || Math.abs(h.x) > 14) this.remove(h);
  }

  updateRain(h) {
    const target = h.owner.opp;
    if (h.spawned < h.total && h.age % h.interval === 1) {
      const last = h.spawned === h.total - 1;
      this.add(
        {
          type: 'drop', owner: h.owner, x: target.x + rand(-1.3, 1.3) + target.vx * 0.2, y: 7 + rand(0, 1.5), vy: -9, w: 0.6, h: 0.5,
          dmg: h.dmg, last, spin: rand(-8, 8),
        },
        h.model,
      );
      h.spawned++;
    }
    if (h.spawned >= h.total) h.dead = true;
  }

  updateDrop(h) {
    const g = this.game;
    h.vy -= 18 * DT;
    h.y += h.vy * DT;
    h.x += Math.sin(h.age * 0.2) * 0.02;
    h.mesh.rotation.z += h.spin * DT;
    h.mesh.rotation.y += h.spin * 0.5 * DT;
    const target = h.owner.opp;
    if (this.touches(h, target)) {
      g.combat.applyHit(h.owner, target, {
        dmg: h.dmg, hitstun: 30, blockstun: 12, push: 0.04, chip: 0.25, isSuper: true, knockdown: h.last, launch: h.last ? [5, 9] : null,
      }, target.x - target.facing);
      g.fx.papers(h.x, h.y);
      return this.remove(h);
    }
    if (h.y <= 0.05) {
      g.fx.papers(h.x, 0.1);
      this.remove(h);
    }
  }

  updateCrab(h) {
    const g = this.game;
    const target = h.owner.opp;
    if (h.phase === 'wait') {
      h.x = target.x;
      if (h.age === 1) g.audio.whistle();
      if (h.age > 22) {
        h.phase = 'fall';
        h.vy = -28;
      }
    } else if (h.phase === 'fall') {
      h.y += h.vy * DT;
      if (h.y <= 0) {
        h.y = 0;
        h.phase = 'sit';
        h.timer = 0;
        g.shake(0.8);
        g.fx.dust(h.x, 3);
        g.audio.explode();
        if (target.hurtable && Math.abs(target.x - h.x) < 2.1 && target.y < 3) {
          g.combat.applyHit(h.owner, target, { dmg: h.dmg, hitstun: 30, blockstun: 24, chip: 0.25, knockdown: true, launch: [7, 12], isSuper: true, heavy: true, word: 'MEMORY SAFE!' }, h.x - 1);
        }
      }
    } else if (h.phase === 'sit') {
      h.mesh.rotation.z = Math.sin(h.age * 0.6) * 0.08;
      if (++h.timer > 50) h.phase = 'leave';
    } else {
      h.x += 7 * DT;
      h.mesh.rotation.z = Math.sin(h.age * 0.9) * 0.15;
      h.mesh.scale.setScalar(Math.max(0.01, h.mesh.scale.x - DT * 0.8));
      if (h.mesh.scale.x <= 0.05) this.remove(h);
    }
  }
}
