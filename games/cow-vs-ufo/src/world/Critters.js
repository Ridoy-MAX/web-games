import * as THREE from 'three';
import { Cow } from '../player/Cow.js';
import { mat, mesh } from '../utils/materials.js';
import { dampAngle, distXZ, pick, rand, TAU } from '../utils/math.js';

const tmp = new THREE.Vector3();

function makeChicken(giant) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const white = mat(0xffffff, { flat: false, rough: 0.7 });
  const red = mat(0xe63946);
  const orange = mat(0xff9f1c);
  const torso = mesh(new THREE.SphereGeometry(0.5, 12, 10), white);
  torso.scale.set(0.9, 0.85, 1.15);
  torso.position.y = 0.75;
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.35, 0.35);
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.28, 10, 8), white);
  head.add(skull);
  const beak = mesh(new THREE.ConeGeometry(0.1, 0.25, 4), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.02, 0.32);
  head.add(beak);
  for (let i = 0; i < 3; i++) {
    const comb = mesh(new THREE.SphereGeometry(0.09, 6, 5), red);
    comb.position.set(0, 0.28 + (i === 1 ? 0.05 : 0), -0.1 + i * 0.1);
    head.add(comb);
  }
  const wattle = mesh(new THREE.SphereGeometry(0.07, 6, 5), red);
  wattle.scale.y = 1.6;
  wattle.position.set(0, -0.18, 0.25);
  head.add(wattle);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(0x111111));
    eye.position.set(s * 0.17, 0.06, 0.2);
    head.add(eye);
    if (giant) {
      const brow = mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), mat(0x111111));
      brow.position.set(s * 0.15, 0.16, 0.24);
      brow.rotation.z = s * 0.5;
      head.add(brow);
    }
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.42, 0.85, 0);
    const w = mesh(new THREE.SphereGeometry(0.3, 8, 6), white);
    w.scale.set(0.3, 0.8, 1.1);
    w.position.y = -0.1;
    wing.add(w);
    body.add(wing);
    wings.push(wing);
  }
  for (let i = 0; i < 3; i++) {
    const f = mesh(new THREE.BoxGeometry(0.08, 0.4, 0.15), white);
    f.position.set((i - 1) * 0.12, 1.0, -0.55);
    f.rotation.x = -0.6;
    body.add(f);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.18, 0.4, 0);
    const shin = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), orange);
    shin.position.y = -0.2;
    leg.add(shin);
    const foot = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.25), orange);
    foot.position.set(0, -0.4, 0.06);
    leg.add(foot);
    body.add(leg);
    legs.push(leg);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: g, body, head, wings, legs };
}

function makeParachute() {
  const g = new THREE.Group();
  const canopy = mesh(new THREE.SphereGeometry(2.2, 12, 6, 0, TAU, 0, Math.PI / 2), mat(0xff4d6d, { flat: true }));
  canopy.position.y = 3.6;
  canopy.scale.y = 0.6;
  g.add(canopy);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const line = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 3), mat(0xffffff), { cast: false });
    line.position.set(Math.cos(a) * 1.0, 2.4, Math.sin(a) * 1.0);
    line.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(line);
  }
  g.visible = false;
  return g;
}

class NpcCow {
  constructor(game, home, skin) {
    this.game = game;
    this.home = home.clone();
    this.cow = new Cow(skin, pick([0, 0, 0, 5]));
    this.cow.root.scale.setScalar(0.85);
    game.scene.add(this.cow.root);
    this.chute = makeParachute();
    this.cow.root.add(this.chute);
    this.pos = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.copy(this.home);
    this.pos.y = this.game.terrain.heightAt(this.pos.x, this.pos.z);
    this.heading = rand(0, TAU);
    this.state = 'idle';
    this.timer = rand(1, 4);
    this.target = new THREE.Vector3();
    this.cow.root.visible = true;
    this.cow.root.scale.setScalar(0.85);
    this.chute.visible = false;
  }

  abduct(ufoPos) {
    this.state = 'abducted';
    this.ufoPos = ufoPos;
    this.timer = 0;
    this.from = this.pos.clone();
    this.game.effects.popup('Not me!?', tmp.copy(this.pos).setY(this.pos.y + 3), 'comic');
    this.game.audio.moo(1.3);
  }

  update(dt, dancing) {
    const g = this.game;
    const c = this.cow;
    let speed = 0;
    let grazing = false;
    this.timer -= dt;
    switch (this.state) {
      case 'idle':
        grazing = true;
        if (this.timer <= 0) {
          this.state = 'walk';
          const a = rand(0, TAU);
          const r = rand(2, 7);
          this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
          this.timer = 6;
        }
        break;
      case 'walk': {
        const dx = this.target.x - this.pos.x;
        const dz = this.target.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5 || this.timer <= 0) {
          this.state = 'idle';
          this.timer = rand(2, 6);
          break;
        }
        this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 4, dt);
        speed = 2.2;
        this.pos.x += Math.sin(this.heading) * speed * dt;
        this.pos.z += Math.cos(this.heading) * speed * dt;
        g.collision.resolve(this.pos, 0.7, 1.8);
        break;
      }
      case 'abducted': {
        const k = Math.min(1, this.timer * -0.5);
        this.pos.lerpVectors(this.from, this.ufoPos, k * k);
        this.heading += dt * 6;
        c.root.scale.setScalar(0.85 * (1 - k * 0.7));
        if (k >= 1) {
          this.state = 'away';
          this.timer = 4;
          c.root.visible = false;
        }
        break;
      }
      case 'away':
        if (this.timer <= 0) {
          // Returned... by parachute, slightly confused.
          this.state = 'chute';
          this.pos.set(this.home.x, 30, this.home.z);
          c.root.visible = true;
          c.root.scale.setScalar(0.85);
          this.chute.visible = true;
        }
        break;
      case 'chute': {
        this.pos.y -= dt * 3.5;
        this.heading += dt * 0.6;
        const h = g.terrain.heightAt(this.pos.x, this.pos.z);
        if (this.pos.y <= h) {
          this.pos.y = h;
          this.chute.visible = false;
          this.state = 'idle';
          this.timer = 2;
          g.effects.landPuff(this.pos, 1);
        }
        break;
      }
      default:
        break;
    }
    if (this.state === 'idle' || this.state === 'walk') {
      const h = g.terrain.heightAt(this.pos.x, this.pos.z);
      if (Number.isFinite(h)) this.pos.y = h;
      // Gently shove the player cow so they don't overlap.
      const pl = g.player;
      const d = distXZ(pl.pos, this.pos);
      if (d < 1.5 && d > 0.01 && Math.abs(pl.pos.y - this.pos.y) < 1.5) {
        const push = (1.5 - d) / d;
        pl.pos.x += (pl.pos.x - this.pos.x) * push * 0.5;
        pl.pos.z += (pl.pos.z - this.pos.z) * push * 0.5;
      }
    }
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.heading;
    c.setExpression(this.state === 'abducted' ? 'panic' : dancing ? 'joy' : 'happy');
    c.update(dt, {
      speed: speed / 9,
      grounded: this.state !== 'abducted' && this.state !== 'chute',
      lifted: this.state === 'abducted',
      dancing: dancing && this.state === 'idle',
      grazing: grazing && !dancing,
    });
  }
}

class Chicken {
  constructor(game, giant) {
    this.game = game;
    this.giant = giant;
    Object.assign(this, makeChicken(giant));
    this.group.scale.setScalar(giant ? 3.2 : 1);
    game.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.time = rand(0, 10);
    this.state = giant ? 'off' : 'peck';
    this.timer = 0;
    this.group.visible = !giant;
  }

  place(x, z) {
    this.pos.set(x, this.game.terrain.heightAt(x, z), z);
    this.home = this.pos.clone();
  }

  update(dt) {
    if (this.state === 'off') return;
    const g = this.game;
    const pl = g.player;
    this.time += dt;
    this.timer -= dt;
    let speed = 0;
    let flap = 0;
    const toPlayer = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    const dPlayer = distXZ(pl.pos, this.pos);

    if (this.giant) {
      if (this.state === 'enter') {
        this.vy -= 30 * dt;
        this.pos.y += this.vy * dt;
        flap = 1;
        const h = g.terrain.heightAt(this.pos.x, this.pos.z);
        if (this.pos.y <= h) {
          this.pos.y = h;
          this.state = 'chase';
          this.timer = 10;
          g.effects.landPuff(this.pos, 3);
          g.effects.shake(0.5);
          g.audio.bawk();
          g.effects.popup('BAWK!!', tmp.copy(this.pos).setY(this.pos.y + 6), 'comic bad');
        }
      } else if (this.state === 'chase') {
        speed = this.scared > 0 ? -6 : 7.4 + (g.level?.n ?? 1) * 0.2;
        this.scared = Math.max(0, (this.scared || 0) - dt);
        this.heading = dampAngle(this.heading, toPlayer, 5, dt);
        flap = 0.5;
        if (Math.random() < dt * 0.6) g.audio.bawk();
        if (dPlayer < 2.6 && pl.invuln <= 0 && !pl.busy && !pl.hidden && pl.pos.y < this.pos.y + 3) {
          pl.launch(Math.sin(this.heading), Math.cos(this.heading), 18, 13, 'chicken');
          g.audio.boing();
          g.effects.popup('PECKED!', tmp.copy(pl.pos).setY(pl.pos.y + 2.5), 'comic');
          g.effects.shake(0.4);
          g.score.registerHit();
          this.timer = Math.min(this.timer, 4);
        }
        if (this.timer <= 0) {
          this.state = 'leave';
          this.timer = 6;
          g.effects.popup('Bored now.', tmp.copy(this.pos).setY(this.pos.y + 6), 'pts');
        }
      } else if (this.state === 'leave') {
        // Struts off the edge of the island with total confidence.
        const a = Math.atan2(this.pos.x, this.pos.z);
        this.heading = dampAngle(this.heading, a, 3, dt);
        speed = 9;
        flap = 0.3;
        if (this.timer <= 0 || this.pos.y < -30) {
          this.state = 'off';
          this.group.visible = false;
        }
      }
      if (this.state !== 'enter') {
        this.pos.x += Math.sin(this.heading) * speed * dt;
        this.pos.z += Math.cos(this.heading) * speed * dt;
        const h = g.terrain.heightAt(this.pos.x, this.pos.z);
        if (Number.isFinite(h) && this.pos.y - h < 1) this.pos.y = h;
        else this.pos.y -= dt * 20;
      }
    } else {
      // Little chickens peck around and panic when the cow gets close.
      if (dPlayer < 3.5) {
        this.state = 'flee';
        this.timer = 1.2;
      }
      if (this.state === 'flee') {
        this.heading = dampAngle(this.heading, toPlayer + Math.PI, 10, dt);
        speed = 5;
        flap = 1;
        if (this.timer <= 0) this.state = 'peck';
      } else if (this.state === 'peck') {
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = rand(1, 3);
          this.heading = Math.atan2(this.home.x - this.pos.x + rand(-4, 4), this.home.z - this.pos.z + rand(-4, 4));
        }
      } else if (this.state === 'walk') {
        speed = 1.6;
        if (this.timer <= 0) {
          this.state = 'peck';
          this.timer = rand(1, 4);
        }
      }
      this.pos.x += Math.sin(this.heading) * speed * dt;
      this.pos.z += Math.cos(this.heading) * speed * dt;
      g.collision.resolve(this.pos, 0.3, 1);
      const h = g.terrain.heightAt(this.pos.x, this.pos.z);
      if (Number.isFinite(h)) this.pos.y = h;
      else this.place(this.home.x, this.home.z);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    const t = this.time;
    const sp = Math.abs(speed);
    this.legs[0].rotation.x = Math.sin(t * (6 + sp * 2)) * Math.min(1, sp * 0.3);
    this.legs[1].rotation.x = -this.legs[0].rotation.x;
    this.body.position.y = Math.abs(Math.sin(t * (6 + sp * 2))) * 0.06 * Math.min(1, sp);
    this.wings[0].rotation.z = -flap * Math.abs(Math.sin(t * 25)) * 1.2;
    this.wings[1].rotation.z = flap * Math.abs(Math.sin(t * 25)) * 1.2;
    this.head.rotation.x = this.state === 'peck' ? Math.max(0, Math.sin(t * 9)) * 0.9 : 0;
  }
}

export class Critters {
  constructor(game) {
    this.game = game;
    const homes = [[-26, 10], [24, 18], [-12, -6], [30, -26]];
    this.cows = homes.map(([x, z], i) => new NpcCow(game, new THREE.Vector3(x, 0, z), [1, 0, 3, 2][i]));
    this.chickens = [];
    for (let i = 0; i < 6; i++) {
      const c = new Chicken(game, false);
      const a = rand(0, TAU);
      c.place(-20 + Math.cos(a) * 5, -4 + Math.sin(a) * 5);
      this.chickens.push(c);
    }
    this.giant = new Chicken(game, true);
    this.dancing = false;
  }

  reset() {
    for (const c of this.cows) c.reset();
    for (const c of this.chickens) c.place(c.home.x, c.home.z);
    this.giant.state = 'off';
    this.giant.group.visible = false;
    this.dancing = false;
  }

  spawnGiantChicken() {
    const pl = this.game.player.pos;
    const a = rand(0, TAU);
    const x = Math.max(-36, Math.min(36, pl.x + Math.cos(a) * 16));
    const z = Math.max(-36, Math.min(36, pl.z + Math.sin(a) * 16));
    const gc = this.giant;
    gc.pos.set(x, 30, z);
    gc.vy = 0;
    gc.heading = Math.atan2(pl.x - x, pl.z - z);
    gc.state = 'enter';
    gc.scared = 0;
    gc.group.visible = true;
  }

  // Moo scares the giant chicken for a moment.
  scare(pos) {
    const gc = this.giant;
    if (gc.state === 'chase' && distXZ(gc.pos, pos) < 9) {
      gc.scared = 1.5;
      this.game.effects.popup('eep!', tmp.copy(gc.pos).setY(gc.pos.y + 6), 'pts');
    }
    for (const c of this.chickens) {
      if (distXZ(c.pos, pos) < 10) {
        c.state = 'flee';
        c.timer = 2;
      }
    }
  }

  pickCow() {
    const free = this.cows.filter((c) => c.state === 'idle' || c.state === 'walk');
    return free.length ? pick(free) : null;
  }

  update(dt) {
    for (const c of this.cows) c.update(dt, this.dancing);
    for (const c of this.chickens) c.update(dt);
    this.giant.update(dt);
  }
}
