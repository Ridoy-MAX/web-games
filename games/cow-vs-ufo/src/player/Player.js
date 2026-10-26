import * as THREE from 'three';
import { Cow } from './Cow.js';
import { PHYS, PlayerPhysics } from './PlayerPhysics.js';
import { dampAngle, distXZ } from '../utils/math.js';

const wish = new THREE.Vector3();
const tmp = new THREE.Vector3();

export class Player {
  constructor(game, skin, accessory) {
    this.game = game;
    this.cow = new Cow(skin, accessory);
    game.scene.add(this.cow.root);
    this.phys = new PlayerPhysics(game.collision);
    this.heading = 0;
    this.reset(new THREE.Vector3());
  }

  get pos() {
    return this.phys.pos;
  }

  reset(spawn) {
    this.phys.reset(spawn);
    this.heading = Math.PI;
    this.invuln = 0;
    this.stun = 0;
    this.dizzy = 0;
    this.tumble = false;
    this.slip = 0;
    this.trapped = 0;
    this.trapPos = new THREE.Vector3();
    this.abductProgress = 0;
    this.inBeam = false;
    this.abducting = null;
    this.hidden = null;
    this.dancing = false;
    this.dustTimer = 0;
    this.mooCooldown = 0;
    this.lastHazard = null;
    this.lastHazardTime = -99;
    this.time = 0;
    this.speedMul = 1;
    this.frozen = false;
    this.cow.root.visible = true;
    this.cow.root.scale.setScalar(1);
    this.cow.root.position.copy(spawn);
    this.cow.body.rotation.set(0, 0, 0);
    this.cow.pancake = 0;
  }

  get busy() {
    return !!this.abducting;
  }

  noteHazard(reason) {
    this.lastHazard = reason;
    this.lastHazardTime = this.time;
  }

  // Exaggerated knockback: the cow tumbles through the air and lands dizzy.
  launch(dirX, dirZ, power, up, reason) {
    if (this.abducting) return;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.phys.launch(dirX / len, dirZ / len, power, up);
    this.tumble = true;
    this.stun = Math.max(this.stun, 0.4);
    this.trapped = 0;
    this.noteHazard(reason);
    this.cow.setExpression('panic');
  }

  slipOn() {
    if (this.slip > 0 || this.abducting) return;
    this.slip = 1.3;
    const f = Math.hypot(this.phys.vel.x, this.phys.vel.z) > 1 ? 1 : 0;
    const dirX = f ? this.phys.vel.x : Math.sin(this.heading);
    const dirZ = f ? this.phys.vel.z : Math.cos(this.heading);
    const len = Math.hypot(dirX, dirZ) || 1;
    this.phys.vel.x = (dirX / len) * 15;
    this.phys.vel.z = (dirZ / len) * 15;
    this.phys.vel.y = 6;
    this.phys.grounded = false;
    this.noteHazard('banana');
  }

  trapAt(pos, time) {
    this.trapped = time;
    this.trapPos.copy(pos);
    this.phys.vel.set(0, 0, 0);
  }

  hop(v = 7) {
    if (this.phys.grounded && !this.abducting) {
      this.phys.vel.y = v;
      this.phys.grounded = false;
    }
  }

  startAbduction(ufoPos) {
    this.abducting = { t: 0, from: this.pos.clone(), to: ufoPos };
    this.trapped = 0;
    this.cow.setExpression('panic');
  }

  update(dt, input, camYaw, ctx) {
    this.time += dt;
    const g = this.game;
    const cow = this.cow;
    this.invuln = Math.max(0, this.invuln - dt);
    this.mooCooldown = Math.max(0, this.mooCooldown - dt);

    if (this.abducting) {
      this.updateAbduction(dt);
      return;
    }

    // Camera-relative movement.
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    wish.set(fx * input.move.y + rx * input.move.x, 0, fz * input.move.y + rz * input.move.x);
    if (this.frozen) wish.set(0, 0, 0);

    let jump = !this.frozen && input.consumeJump();
    if (this.trapped > 0) {
      // Mash jump to break out of the cage faster.
      if (jump) {
        this.trapped -= 0.3;
        input.clearJump();
        g.effects.straw(tmp.copy(this.pos).setY(this.pos.y + 1), 4);
        g.audio.hic();
        cow.squish(0.25);
      }
      jump = false;
      this.trapped -= dt;
      wish.set(0, 0, 0);
      this.phys.pos.x = this.trapPos.x;
      this.phys.pos.z = this.trapPos.z;
      this.phys.vel.x = this.phys.vel.z = 0;
    }

    this.stun = Math.max(0, this.stun - dt);
    this.dizzy = Math.max(0, this.dizzy - dt);
    this.slip = Math.max(0, this.slip - dt);
    let control = this.stun > 0 || this.tumble ? 0 : 1;
    if (this.dizzy > 0) control *= 0.45;
    if (this.inBeam) control *= 0.6;
    if (this.slip > 0) control = 0;
    const pond = g.terrain.pondAt(this.pos.x, this.pos.z);
    const speedMul = this.speedMul * (pond && this.phys.grounded ? 0.55 : 1);

    const ev = this.phys.step(dt, wish, {
      control,
      slip: this.slip > 0,
      lifted: this.inBeam,
      liftVel: 2.4,
      jump: jump && control > 0.3,
      speedMul,
    });

    if (ev.jumped) {
      input.clearJump();
      g.audio.jump();
      cow.squish(-0.25);
      g.effects.dust(tmp.copy(this.pos), 6);
    }
    if (ev.landed) {
      const power = Math.min(1, ev.landSpeed / 25);
      cow.squish(0.15 + power * 0.45);
      if (ev.landSpeed > 6) {
        g.effects.landPuff(this.pos, 0.6 + power);
        g.audio.land(0.5 + power);
      }
      if (this.tumble) {
        this.tumble = false;
        this.dizzy = 1.1;
        this.stun = Math.max(this.stun, 0.35);
        g.effects.shake(0.25);
        g.effects.popup('BONK!', tmp.copy(this.pos).setY(this.pos.y + 2.5), 'comic');
        g.audio.bonk();
      }
      if (pond) {
        g.effects.splash(this.pos);
      }
    }
    if (ev.wall && this.tumble) {
      g.effects.impact(tmp.copy(this.pos).setY(this.pos.y + 1));
      g.audio.bonk();
      g.effects.shake(0.2);
    }

    // Heading follows movement (or slides spin wildly on bananas).
    const hv = Math.hypot(this.phys.vel.x, this.phys.vel.z);
    if (this.slip > 0) this.heading += dt * 18;
    else if (wish.lengthSq() > 0.01 && control > 0) this.heading = dampAngle(this.heading, Math.atan2(wish.x, wish.z), 12, dt);

    // Running dust.
    if (this.phys.grounded && hv > 6) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.08;
        if (pond) g.effects.splash(this.pos);
        else g.effects.dust(tmp.copy(this.pos), 2);
      }
    }

    // Moo!
    if (input.consumeMoo() && this.mooCooldown <= 0) {
      this.mooCooldown = 1.2;
      g.audio.moo(this.cow.skinIndex === 4 ? 1.2 : 1);
      g.effects.popup('MOO!', tmp.copy(this.pos).setY(this.pos.y + 2.8), 'comic moo');
      cow.squish(-0.2);
      g.onMoo?.();
    }

    if (this.pos.y < -20) g.onPlayerFell();

    // Hiding inside a barn.
    const zone = g.collision.hideZoneAt(this.pos.x, this.pos.z);
    this.hidden = zone && this.pos.y < 3 ? zone : null;

    // Pick a face that matches the situation.
    let expr = 'happy';
    if (this.inBeam || this.trapped > 0) expr = 'panic';
    else if (this.tumble) expr = 'panic';
    else if (this.dizzy > 0) expr = 'dizzy';
    else if (this.hidden) expr = 'sneaky';
    else if (ctx.danger) expr = 'worried';
    else if (this.dancing) expr = 'joy';
    else if (ctx.ufoDist < 14) expr = 'determined';
    cow.setExpression(expr);

    cow.root.position.copy(this.pos);
    cow.root.rotation.y = this.heading;
    cow.root.visible = this.invuln > 0 ? Math.floor(this.time * 14) % 2 === 0 : true;
    cow.update(dt, {
      speed: hv / PHYS.runSpeed,
      grounded: this.phys.grounded,
      vy: this.phys.vel.y,
      tumble: this.tumble,
      dizzy: this.dizzy > 0,
      lifted: this.inBeam || this.trapped > 0,
      dancing: this.dancing && hv < 1 && this.phys.grounded,
      lookAt: ctx.ufoPos && ctx.ufoDist < 30 ? ctx.ufoPos : null,
    });
  }

  updateAbduction(dt) {
    const a = this.abducting;
    a.t += dt;
    const k = Math.min(1, a.t / 1.5);
    const e = k * k * (3 - 2 * k);
    this.pos.lerpVectors(a.from, a.to, e);
    this.pos.y -= 1.2 * e;
    this.cow.root.position.copy(this.pos);
    this.cow.root.rotation.y += dt * (4 + k * 14);
    this.cow.root.scale.setScalar(1 - 0.75 * e);
    this.cow.setExpression('panic');
    this.cow.update(dt, { speed: 0, grounded: false, vy: 0, lifted: true });
    if (k >= 1 && !a.done) {
      a.done = true;
      this.cow.root.visible = false;
      this.game.onAbducted();
    }
  }

  distTo(p) {
    return distXZ(this.pos, p);
  }
}
