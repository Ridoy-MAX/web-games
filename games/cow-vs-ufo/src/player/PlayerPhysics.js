import * as THREE from 'three';
import { lerp } from '../utils/math.js';

export const PHYS = {
  gravity: 34,
  jumpVel: 13.2,
  runSpeed: 9,
  accelGround: 60,
  accelAir: 22,
  radius: 0.75,
  height: 2.0,
  coyote: 0.12,
  terminal: -42,
};

const target = new THREE.Vector3();

// Hand-rolled arcade physics: snappy on the ground, floaty at the apex, and
// knockback that keeps its momentum while the cow is tumbling.
export class PlayerPhysics {
  constructor(collision) {
    this.c = collision;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.external = new THREE.Vector3();
    this.grounded = false;
    this.coyote = 0;
    this.support = null;
    this.gravityScale = 1;
    this.events = { jumped: false, landed: false, landSpeed: 0, wall: null };
  }

  reset(p) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.external.set(0, 0, 0);
    this.grounded = true;
    this.support = null;
    this.gravityScale = 1;
  }

  // wish: desired horizontal direction (length 0..1).
  step(dt, wish, { control = 1, slip = false, lifted = false, liftVel = 0, jump = false, speedMul = 1 } = {}) {
    const ev = this.events;
    ev.jumped = false;
    ev.landed = false;
    ev.landSpeed = 0;
    ev.wall = null;

    target.set(wish.x, 0, wish.z).multiplyScalar(PHYS.runSpeed * control * speedMul);
    let accel;
    if (this.grounded) accel = slip ? 2.5 : PHYS.accelGround * Math.max(0.3, control);
    else accel = lerp(1.2, PHYS.accelAir, control);
    const dx = target.x - this.vel.x;
    const dz = target.z - this.vel.z;
    const d = Math.hypot(dx, dz);
    const maxChange = accel * dt;
    if (d > maxChange) {
      this.vel.x += (dx / d) * maxChange;
      this.vel.z += (dz / d) * maxChange;
    } else {
      this.vel.x = target.x;
      this.vel.z = target.z;
    }

    if (jump && (this.grounded || this.coyote > 0) && !lifted) {
      this.vel.y = PHYS.jumpVel;
      this.grounded = false;
      this.coyote = 0;
      ev.jumped = true;
    }

    if (lifted) {
      this.vel.y = lerp(this.vel.y, liftVel, 1 - Math.exp(-4 * dt));
    } else {
      let g = PHYS.gravity * this.gravityScale;
      if (Math.abs(this.vel.y) < 3) g *= 0.65; // hang time at the apex
      else if (this.vel.y < 0) g *= 1.15;
      this.vel.y = Math.max(PHYS.terminal, this.vel.y - g * dt);
    }

    // Moving platforms carry the cow along.
    if (this.grounded && this.support) this.pos.addScaledVector(this.support.vel, dt);
    this.pos.addScaledVector(this.external, dt);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const n = this.c.resolve(this.pos, PHYS.radius, PHYS.height);
    if (n) {
      const into = this.vel.x * n.x + this.vel.z * n.z;
      if (into < 0) {
        // Bounce harder when flying around for comedic ricochets.
        const bounce = control < 0.5 ? 1.5 : 1;
        this.vel.x -= n.x * into * bounce;
        this.vel.z -= n.z * into * bounce;
        ev.wall = n;
      }
    }

    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    const ground = this.c.groundAt(this.pos.x, this.pos.z, prevY, PHYS.radius);
    const wasGrounded = this.grounded;
    if (this.vel.y <= 0 && this.pos.y <= ground.h) {
      if (!wasGrounded) {
        ev.landed = true;
        ev.landSpeed = -this.vel.y;
      }
      this.pos.y = ground.h;
      this.vel.y = 0;
      this.grounded = true;
      this.support = ground.support;
    } else if (wasGrounded && this.vel.y <= 0 && Number.isFinite(ground.h) && this.pos.y - ground.h < 0.45 && !lifted) {
      // Stick to the ground when walking down slopes or off small steps.
      this.pos.y = ground.h;
      this.vel.y = 0;
      this.support = ground.support;
    } else {
      if (wasGrounded) this.coyote = PHYS.coyote;
      this.grounded = false;
      this.support = null;
    }
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);
    return ev;
  }

  launch(dirX, dirZ, power, up) {
    this.vel.x = dirX * power;
    this.vel.z = dirZ * power;
    this.vel.y = up;
    this.grounded = false;
    this.support = null;
    this.coyote = 0;
  }
}
