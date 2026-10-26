import * as THREE from 'three';
import { mat, mesh, textTexture } from '../utils/materials.js';
import { clamp, distXZ, rand, TAU } from '../utils/math.js';

const tmp = new THREE.Vector3();

const PLATFORMS = [
  { a: [36, 0], b: [55, 0], period: 9 },
  { a: [-6, -36], b: [-6, -55], period: 10 },
];

function makeAnvil() {
  const g = new THREE.Group();
  const m = mat(0x4a4f57, { metal: 0.7, rough: 0.35 });
  const base = mesh(new THREE.BoxGeometry(1.4, 0.4, 1.0), m);
  base.position.y = 0.2;
  g.add(base);
  const waist = mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), m);
  waist.position.y = 0.6;
  g.add(waist);
  const top = mesh(new THREE.BoxGeometry(1.9, 0.5, 1.0), m);
  top.position.y = 1.05;
  g.add(top);
  const horn = mesh(new THREE.ConeGeometry(0.42, 1.0, 8), m);
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(1.4, 1.05, 0);
  g.add(horn);
  const label = mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshBasicMaterial({ map: textTexture(['1 TON'], { width: 256, height: 96, bg: '#4a4f57', fg: '#ffffff', border: null, font: 'bold 60px "Lilita One", sans-serif' }) }), { cast: false });
  label.position.set(0, 1.05, 0.51);
  g.add(label);
  return g;
}

function makeDuck() {
  const g = new THREE.Group();
  const yellow = mat(0xffd23f, { flat: false, rough: 0.4 });
  const body = mesh(new THREE.SphereGeometry(1.1, 14, 10), yellow);
  body.scale.set(1, 0.8, 1.25);
  body.position.y = 0.9;
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.65, 12, 10), yellow);
  head.position.set(0, 1.9, 0.75);
  g.add(head);
  const beak = mesh(new THREE.BoxGeometry(0.6, 0.18, 0.5), mat(0xff8c1a));
  beak.position.set(0, 1.8, 1.4);
  g.add(beak);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0x111111));
    eye.position.set(s * 0.3, 2.05, 1.25);
    g.add(eye);
  }
  const tail = mesh(new THREE.ConeGeometry(0.35, 0.6, 6), yellow);
  tail.rotation.x = -1.1;
  tail.position.set(0, 1.3, -1.3);
  g.add(tail);
  return g;
}

function makeMarker() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.75, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.75, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.25, depthWrite: false }));
  g.add(fill);
  g.userData.fill = fill;
  g.visible = false;
  return g;
}

function spiralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#eac36a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8902f';
  g.lineWidth = 4;
  g.beginPath();
  for (let a = 0; a < TAU * 5; a += 0.1) {
    const r = a * 3.6;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWheel(capMat) {
  const g = new THREE.Group();
  const roll = new THREE.Group();
  roll.position.y = 1.3;
  g.add(roll);
  const geo = new THREE.CylinderGeometry(1.3, 1.3, 1.8, 14);
  geo.rotateZ(Math.PI / 2);
  const m = mesh(geo, [mat(0xeac36a), capMat, capMat]);
  roll.add(m);
  const band = mesh(new THREE.TorusGeometry(1.32, 0.06, 4, 14), mat(0xb33a2a));
  band.rotation.y = Math.PI / 2;
  roll.add(band);
  return { group: g, roll };
}

function makePeel() {
  const g = new THREE.Group();
  const y = mat(0xffe14d);
  const center = mesh(new THREE.SphereGeometry(0.22, 8, 6), y);
  center.scale.y = 0.6;
  center.position.y = 0.12;
  g.add(center);
  for (let i = 0; i < 4; i++) {
    const flap = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.7), i % 2 ? y : mat(0xf5d33b));
    const a = (i / 4) * TAU + 0.3;
    flap.position.set(Math.sin(a) * 0.35, 0.05, Math.cos(a) * 0.35);
    flap.rotation.y = a;
    flap.rotation.x = 0.2;
    g.add(flap);
  }
  const tip = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), mat(0x5a3d1e));
  tip.position.y = 0.3;
  g.add(tip);
  return g;
}

function makeTrap() {
  const g = new THREE.Group();
  const sign = new THREE.Group();
  const post = mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), mat(0x8a5a3c));
  post.position.y = 0.8;
  sign.add(post);
  const board = mesh(new THREE.BoxGeometry(2.2, 1.0, 0.1), new THREE.MeshStandardMaterial({ map: textTexture(['FREE GRASS!', '(not a trap)'], { bg: '#fffbe6', fg: '#d62828' }) }));
  board.position.y = 1.7;
  sign.add(board);
  sign.position.set(1.5, 0, -0.6);
  sign.rotation.y = -0.3;
  g.add(sign);
  const grass = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const blade = mesh(new THREE.ConeGeometry(0.14, 0.9, 4), mat(0xffd447, { emissive: 0xffb300, emissiveIntensity: 0.4 }));
    const a = (i / 9) * TAU;
    blade.position.set(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3);
    blade.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    grass.add(blade);
  }
  g.add(grass);
  const cage = new THREE.Group();
  const bar = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5);
  const metal = mat(0xb8c2cc, { metal: 0.8, rough: 0.3 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const b = mesh(bar, metal);
    b.position.set(Math.cos(a) * 1.3, 1.3, Math.sin(a) * 1.3);
    cage.add(b);
  }
  const ringGeo = new THREE.TorusGeometry(1.3, 0.08, 5, 20);
  for (const y of [0.05, 2.6]) {
    const r = mesh(ringGeo, metal);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    cage.add(r);
  }
  const top = mesh(new THREE.ConeGeometry(1.45, 0.8, 12), metal);
  top.position.y = 3.0;
  cage.add(top);
  g.add(cage);
  return { group: g, cage, grass };
}

function makeBurger() {
  const g = new THREE.Group();
  const roll = new THREE.Group();
  roll.position.y = 2.5;
  g.add(roll);
  const layer = (r, h, color, x) => {
    const geo = new THREE.CylinderGeometry(r, r, h, 16);
    geo.rotateZ(Math.PI / 2);
    const m = mesh(geo, mat(color, { flat: false, rough: 0.6 }));
    m.position.x = x;
    roll.add(m);
  };
  layer(2.4, 0.7, 0xe0a35a, -1.25);
  layer(2.55, 0.55, 0x6b3a1f, -0.65);
  const cheese = mesh(new THREE.BoxGeometry(0.14, 4.5, 4.5), mat(0xffc93c));
  cheese.position.x = -0.32;
  cheese.rotation.x = Math.PI / 4;
  roll.add(cheese);
  layer(2.6, 0.18, 0x6cc24a, -0.15);
  layer(2.2, 0.25, 0xe63946, 0.08);
  const bun = new THREE.SphereGeometry(2.45, 16, 10, 0, TAU, 0, Math.PI / 2);
  bun.rotateZ(-Math.PI / 2);
  const top = mesh(bun, mat(0xe0a35a, { flat: false, rough: 0.6 }));
  top.position.x = 0.2;
  top.scale.x = 0.55;
  roll.add(top);
  for (let i = 0; i < 18; i++) {
    const seed = mesh(new THREE.SphereGeometry(0.1, 5, 4), mat(0xfff3d6));
    const a = rand(0, TAU);
    const r = rand(0.3, 1.9);
    seed.position.set(0.2 + Math.sqrt(Math.max(0, 2.45 * 2.45 - r * r)) * 0.55, Math.cos(a) * r, Math.sin(a) * r);
    seed.scale.set(0.6, 1, 1.6);
    roll.add(seed);
  }
  // Googly eyes: the burger is alive and it is not sorry.
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.45, 10, 8), mat(0xffffff, { flat: false }));
    eye.position.set(1.3, 0.5, s * 0.6);
    roll.add(eye);
    const pupil = mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0x111111));
    pupil.position.set(1.7, 0.5, s * 0.6);
    roll.add(pupil);
  }
  return { group: g, roll };
}

function makePlatform() {
  const g = new THREE.Group();
  const raft = mesh(new THREE.BoxGeometry(3.4, 0.5, 3.4), mat(0xeac36a));
  raft.receiveShadow = true;
  g.add(raft);
  for (let i = 0; i < 4; i++) {
    const plank = mesh(new THREE.BoxGeometry(3.5, 0.12, 0.6), mat(0x8a5a3c));
    plank.position.set(0, -0.3, -1.2 + i * 0.8);
    g.add(plank);
  }
  const colors = [0xff4d6d, 0x4cc9f0, 0xffd23f];
  const balloons = new THREE.Group();
  [[-1.4, -1.4], [1.4, -1.4], [0, 1.4]].forEach(([x, z], i) => {
    const string = mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 3), mat(0xffffff), { cast: false });
    string.position.set(x, 1.8, z);
    balloons.add(string);
    const b = mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(colors[i], { flat: false, rough: 0.3 }));
    b.scale.y = 1.2;
    b.position.set(x, 3.9, z);
    balloons.add(b);
  });
  g.add(balloons);
  return { group: g, balloons };
}

export class Obstacles {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.drops = [];
    for (let i = 0; i < 10; i++) {
      const anvil = makeAnvil();
      const duck = makeDuck();
      const marker = makeMarker();
      anvil.visible = duck.visible = false;
      this.root.add(anvil, duck, marker);
      this.drops.push({ anvil, duck, marker, active: false });
    }

    const capMat = new THREE.MeshStandardMaterial({ map: spiralTexture(), roughness: 0.9 });
    this.wheels = [];
    for (let i = 0; i < 6; i++) {
      const w = makeWheel(capMat);
      w.group.visible = false;
      const marker = makeMarker();
      this.root.add(w.group, marker);
      this.wheels.push({ ...w, marker, active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3() });
    }

    this.peels = [];
    for (let i = 0; i < 14; i++) {
      const g = makePeel();
      g.visible = false;
      this.root.add(g);
      this.peels.push({ group: g, active: false, pos: new THREE.Vector3() });
    }

    this.trap = { ...makeTrap(), state: 'off', pos: new THREE.Vector3(), t: 0 };
    this.trap.group.visible = false;
    this.root.add(this.trap.group);

    this.burger = { ...makeBurger(), active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.burger.group.visible = false;
    this.root.add(this.burger.group);

    this.platforms = PLATFORMS.map((cfg) => {
      const p = makePlatform();
      this.root.add(p.group);
      const box = game.collision.addBox(new THREE.Vector3(), new THREE.Vector3(), { tag: 'platform', camera: false });
      return { ...p, cfg, box, t: 0, pos: new THREE.Vector3(cfg.a[0], 1.05, cfg.a[1]), anchor: new THREE.Vector3() };
    });
    this.reset();
  }

  reset() {
    for (const d of this.drops) {
      d.active = false;
      d.anvil.visible = d.duck.visible = d.marker.visible = false;
    }
    for (const w of this.wheels) {
      w.active = false;
      w.group.visible = w.marker.visible = false;
    }
    for (const p of this.peels) {
      p.active = false;
      p.group.visible = false;
    }
    this.trap.state = 'off';
    this.trap.group.visible = false;
    this.burger.active = false;
    this.burger.group.visible = false;
    for (const p of this.platforms) p.t = rand(0, p.cfg.period);
    this.updatePlatforms(0.0001);
  }

  // --- spawning -------------------------------------------------------------------

  spawnDrop(x, z, type) {
    const d = this.drops.find((o) => !o.active);
    if (!d) return;
    x = clamp(x, -40, 40);
    z = clamp(z, -40, 40);
    Object.assign(d, { active: true, type, x, z, gy: this.groundY(x, z), state: 'warn', t: 0, vy: 0, bounces: 0, vx: 0, vz: 0 });
    d.item = type === 'duck' ? d.duck : d.anvil;
    d.item.visible = false;
    d.item.rotation.set(0, rand(0, TAU), 0);
    d.item.scale.setScalar(1);
    d.marker.position.set(x, d.gy + 0.07, z);
    d.marker.visible = true;
    d.marker.scale.setScalar(0.1);
  }

  spawnWheel(sx, sz, dx, dz) {
    const w = this.wheels.find((o) => !o.active);
    if (!w) return;
    const len = Math.hypot(dx, dz) || 1;
    w.dir.set(dx / len, 0, dz / len);
    w.active = true;
    w.state = 'drop';
    w.t = 0;
    w.vy = 0;
    w.speed = 10 + (this.game.level?.n ?? 1) * 0.6;
    w.pos.set(sx, this.groundY(sx, sz) + 16, sz);
    w.group.position.copy(w.pos);
    w.group.rotation.y = Math.atan2(w.dir.x, w.dir.z);
    w.group.visible = true;
    w.marker.position.set(sx, this.groundY(sx, sz) + 0.07, sz);
    w.marker.visible = true;
    w.marker.scale.setScalar(1);
    this.game.audio.whistle(0.7);
  }

  spawnPeels(n) {
    const pp = this.game.player.pos;
    let made = 0;
    for (let tries = 0; tries < n * 8 && made < n; tries++) {
      const x = pp.x + rand(-14, 14);
      const z = pp.z + rand(-14, 14);
      if (Math.abs(x) > 39 || Math.abs(z) > 39 || Math.hypot(x - pp.x, z - pp.z) < 2.5) continue;
      if (!this.game.collision.isClear(x, z, 0.6)) continue;
      const p = this.peels.find((o) => !o.active);
      if (!p) break;
      p.active = true;
      p.t = 0;
      p.life = 20;
      p.pos.set(x, this.groundY(x, z), z);
      p.y = p.pos.y + rand(10, 18);
      p.group.position.set(x, p.y, z);
      p.group.rotation.y = rand(0, TAU);
      p.group.visible = true;
      made++;
    }
  }

  spawnTrap(x, z) {
    const tr = this.trap;
    if (tr.state !== 'off') return;
    tr.state = 'armed';
    tr.t = 0;
    tr.pos.set(x, this.groundY(x, z), z);
    tr.group.position.copy(tr.pos);
    tr.group.rotation.y = rand(0, TAU);
    tr.group.visible = true;
    tr.cage.position.y = 9;
    tr.cage.visible = false;
    tr.grass.visible = true;
    this.game.effects.smoke(tmp.copy(tr.pos).setY(tr.pos.y + 0.5), 14);
    this.game.audio.pop();
  }

  rollBurger() {
    const b = this.burger;
    if (b.active) return;
    const pp = this.game.player.pos;
    const a = rand(0, TAU);
    b.dir.set(Math.cos(a), 0, Math.sin(a));
    const sx = clamp(pp.x - b.dir.x * 26, -38, 38);
    const sz = clamp(pp.z - b.dir.z * 26, -38, 38);
    b.dir.set(pp.x - sx, 0, pp.z - sz).normalize();
    b.pos.set(sx, this.groundY(sx, sz) + 20, sz);
    b.vy = 0;
    b.state = 'drop';
    b.t = 0;
    b.active = true;
    b.group.visible = true;
    // Local +Z faces the roll direction; the burger's stack axis (local X) is the axle.
    b.group.rotation.y = Math.atan2(b.dir.x, b.dir.z);
  }

  groundY(x, z) {
    const h = this.game.terrain.heightAt(x, z);
    return Number.isFinite(h) ? h : -50;
  }

  // --- update ---------------------------------------------------------------------

  update(dt) {
    this.updatePlatforms(dt);
    this.updateDrops(dt);
    this.updateWheels(dt);
    this.updatePeels(dt);
    this.updateTrap(dt);
    this.updateBurger(dt);
  }

  canHit(extraHeight, y) {
    const pl = this.game.player;
    return pl.invuln <= 0 && !pl.busy && !pl.hidden && pl.pos.y < y + extraHeight;
  }

  updatePlatforms(dt) {
    for (const p of this.platforms) {
      p.t += dt;
      const u = (1 - Math.cos((p.t / p.cfg.period) * TAU)) / 2;
      const x = p.cfg.a[0] + (p.cfg.b[0] - p.cfg.a[0]) * u;
      const z = p.cfg.a[1] + (p.cfg.b[1] - p.cfg.a[1]) * u;
      const y = 1.05 + Math.sin(p.t * 1.7) * 0.15;
      p.box.vel.set((x - p.pos.x) / dt, (y - p.pos.y) / dt, (z - p.pos.z) / dt);
      if (dt < 0.001) p.box.vel.set(0, 0, 0);
      p.pos.set(x, y, z);
      p.group.position.copy(p.pos);
      p.balloons.rotation.y = Math.sin(p.t) * 0.1;
      p.box.min.set(x - 1.7, y - 0.25, z - 1.7);
      p.box.max.set(x + 1.7, y + 0.25, z + 1.7);
      p.anchor.set(x, y + 0.25, z);
    }
  }

  updateDrops(dt) {
    const g = this.game;
    for (const d of this.drops) {
      if (!d.active) continue;
      d.t += dt;
      const item = d.item;
      if (d.state === 'warn') {
        const k = Math.min(1, d.t / 0.9);
        d.marker.scale.setScalar(0.2 + k * 0.8);
        d.marker.userData.fill.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(d.t * 14));
        if (d.t > 0.9) {
          d.state = 'fall';
          d.y = d.gy + 16;
          d.vy = -14;
          item.visible = true;
          g.audio.whistle(0.6);
        }
      } else if (d.state === 'fall' || d.state === 'bounce') {
        d.vy -= 45 * dt;
        d.y += d.vy * dt;
        d.x += d.vx * dt;
        d.z += d.vz * dt;
        if (d.state === 'bounce') d.gy = this.groundY(d.x, d.z);
        if (d.y <= d.gy) {
          d.y = d.gy;
          this.dropImpact(d);
        }
      } else if (d.state === 'rest') {
        if (d.t > 2.2) {
          d.y -= dt * 1.5;
          if (d.t > 3.2) {
            d.active = false;
            item.visible = false;
            g.effects.smoke(tmp.set(d.x, d.gy + 0.5, d.z), 6);
          }
        }
      }
      item.position.set(d.x, d.y, d.z);
      if (d.type === 'duck' && d.state === 'bounce') item.rotation.x += dt * 8;
      // Cartoon stretch while falling.
      if (d.state === 'fall') item.scale.set(0.85, 1.25, 0.85);
      else item.scale.lerp(tmp.set(1, 1, 1), 1 - Math.exp(-10 * dt));
    }
  }

  dropImpact(d) {
    const g = this.game;
    const pl = g.player;
    const pos = tmp.set(d.x, d.gy, d.z);
    d.marker.visible = false;
    const dist = distXZ(pl.pos, pos);
    if (d.type === 'anvil') {
      d.state = 'rest';
      d.t = 0;
      d.item.scale.set(1.35, 0.6, 1.35);
      g.audio.clang();
      g.effects.landPuff(pos, 2.2);
      g.effects.shake(Math.max(0.1, 0.5 - dist * 0.03));
      if (dist < 1.9 && this.canHit(2.4, d.gy)) {
        pl.cow.flatten();
        g.effects.popup('SPLAT!', tmp.set(pl.pos.x, pl.pos.y + 2, pl.pos.z), 'comic');
        g.audio.splat();
        g.hurtPlayer('anvil');
      } else if (dist < 3.5) {
        g.effects.popup('Close one!', tmp.set(d.x, d.gy + 2, d.z), 'pts');
      }
    } else {
      g.audio.squeak();
      g.effects.landPuff(pos, 1);
      if (dist < 2.0 && this.canHit(2.6, d.gy)) {
        const dx = pl.pos.x - d.x || 0.1;
        const dz = pl.pos.z - d.z;
        pl.launch(dx, dz, 12, 12, 'duck');
        g.audio.boing();
        g.effects.popup('QUACK!', tmp.set(pl.pos.x, pl.pos.y + 2.5, pl.pos.z), 'comic');
        g.score.registerHit();
      }
      d.bounces++;
      if (d.bounces > 3) {
        d.state = 'rest';
        d.t = 1.5;
      } else {
        d.state = 'bounce';
        d.vy = 13 * Math.pow(0.7, d.bounces);
        d.vx = rand(-4, 4);
        d.vz = rand(-4, 4);
        d.item.scale.set(1.3, 0.7, 1.3);
      }
    }
  }

  updateWheels(dt) {
    const g = this.game;
    const pl = g.player;
    for (const w of this.wheels) {
      if (!w.active) continue;
      w.t += dt;
      if (w.state === 'drop') {
        w.vy -= 40 * dt;
        w.pos.y += w.vy * dt;
        const gy = this.groundY(w.pos.x, w.pos.z);
        if (w.pos.y <= gy) {
          w.pos.y = gy;
          w.state = 'roll';
          w.marker.visible = false;
          g.effects.landPuff(w.pos, 1.5);
          g.audio.land(1);
          g.effects.shake(0.12);
        }
      } else if (w.state === 'roll') {
        w.pos.x += w.dir.x * w.speed * dt;
        w.pos.z += w.dir.z * w.speed * dt;
        const gy = this.game.terrain.heightAt(w.pos.x, w.pos.z);
        if (!Number.isFinite(gy)) {
          w.state = 'fall';
          w.vy = 0;
        } else {
          w.pos.y = gy;
          w.roll.rotation.x += (w.speed * dt) / 1.3;
          if (Math.random() < dt * 12) g.effects.straw(tmp.copy(w.pos).setY(gy + 0.2), 1);
          tmp.copy(w.pos).setY(gy + 1.3);
          const solid = g.collision.overlapsSolid(tmp, 1.2);
          if (solid) {
            this.burstWheel(w);
            continue;
          }
          if (distXZ(pl.pos, w.pos) < 2.0 && this.canHit(2.6, gy)) {
            pl.launch(w.dir.x + rand(-0.3, 0.3), w.dir.z + rand(-0.3, 0.3), 16, 11, 'wheel');
            g.audio.boing();
            g.effects.popup('HAY-YAH!', tmp.copy(pl.pos).setY(pl.pos.y + 2.5), 'comic');
            g.effects.shake(0.35);
            g.score.registerHit();
          }
        }
      } else {
        w.vy -= 30 * dt;
        w.pos.y += w.vy * dt;
        w.pos.x += w.dir.x * w.speed * dt;
        w.pos.z += w.dir.z * w.speed * dt;
        w.roll.rotation.x += (w.speed * dt) / 1.3;
        if (w.pos.y < -40) {
          w.active = false;
          w.group.visible = false;
        }
      }
      if (w.t > 14) this.burstWheel(w);
      w.group.position.copy(w.pos);
    }
  }

  burstWheel(w) {
    this.game.effects.straw(tmp.copy(w.pos).setY(w.pos.y + 1.2), 30);
    this.game.audio.splat();
    w.active = false;
    w.group.visible = false;
    w.marker.visible = false;
  }

  updatePeels(dt) {
    const g = this.game;
    const pl = g.player;
    for (const p of this.peels) {
      if (!p.active) continue;
      p.t += dt;
      if (p.y > p.pos.y) {
        p.y = Math.max(p.pos.y, p.y - dt * 14);
        p.group.position.y = p.y;
        p.group.rotation.y += dt * 6;
        continue;
      }
      if (p.t > p.life) {
        p.active = false;
        p.group.visible = false;
        g.effects.smoke(p.pos, 4);
        continue;
      }
      if (pl.phys.grounded && !pl.busy && distXZ(pl.pos, p.pos) < 1.1 && Math.abs(pl.pos.y - p.pos.y) < 0.6) {
        p.active = false;
        p.group.visible = false;
        pl.slipOn();
        g.audio.slip();
        g.effects.popup('WHEEE!', tmp.copy(pl.pos).setY(pl.pos.y + 2.5), 'comic');
      }
    }
  }

  updateTrap(dt) {
    const tr = this.trap;
    if (tr.state === 'off') return;
    const g = this.game;
    const pl = g.player;
    tr.t += dt;
    if (tr.state === 'armed') {
      tr.grass.rotation.y += dt;
      tr.grass.scale.setScalar(1 + Math.sin(tr.t * 6) * 0.08);
      if (!pl.busy && pl.invuln <= 0 && pl.phys.grounded && distXZ(pl.pos, tr.pos) < 1.4) {
        tr.state = 'sprung';
        tr.t = 0;
        tr.cage.visible = true;
        pl.trapAt(tr.pos, 2.6);
        g.onTrapSprung(tr.pos);
      } else if (tr.t > 22) {
        this.clearTrap();
      }
    } else if (tr.state === 'sprung') {
      tr.cage.position.y = Math.max(0, 9 - tr.t * tr.t * 120);
      if (tr.cage.position.y === 0 && !tr.landed) {
        tr.landed = true;
        g.audio.clang();
        g.effects.shake(0.3);
        tr.grass.visible = false;
      }
      if (tr.landed && (pl.trapped <= 0 || pl.busy)) {
        tr.state = 'release';
        tr.t = 0;
        g.effects.popup('FREEDOM!', tmp.copy(tr.pos).setY(tr.pos.y + 3), 'comic');
        g.audio.pop();
      }
    } else if (tr.state === 'release') {
      tr.cage.position.y = tr.t * tr.t * 30;
      tr.cage.rotation.y += dt * 10;
      if (tr.t > 1.2) this.clearTrap();
    }
  }

  clearTrap() {
    const tr = this.trap;
    tr.state = 'off';
    tr.landed = false;
    tr.group.visible = false;
    this.game.effects.smoke(tmp.copy(tr.pos).setY(tr.pos.y + 0.5), 10);
  }

  updateBurger(dt) {
    const b = this.burger;
    if (!b.active) return;
    const g = this.game;
    const pl = g.player;
    b.t += dt;
    if (b.state === 'drop') {
      b.vy -= 40 * dt;
      b.pos.y += b.vy * dt;
      const gy = this.groundY(b.pos.x, b.pos.z);
      if (b.pos.y <= gy) {
        b.pos.y = gy;
        b.state = 'roll';
        g.effects.landPuff(b.pos, 3);
        g.effects.shake(0.45);
        g.audio.rumble(1.2);
        g.effects.popup('BURGER TIME!', tmp.copy(b.pos).setY(b.pos.y + 6), 'comic bad');
      }
    } else {
      const speed = 13;
      b.pos.x += b.dir.x * speed * dt;
      b.pos.z += b.dir.z * speed * dt;
      const gy = g.terrain.heightAt(b.pos.x, b.pos.z);
      if (Number.isFinite(gy) && b.state === 'roll') b.pos.y = gy;
      else {
        b.state = 'fall';
        b.vy = (b.vy > 0 ? b.vy : 0) - 30 * dt;
        b.pos.y += b.vy * dt;
      }
      b.roll.rotation.x += (speed * dt) / 2.5;
      if (Math.random() < dt * 10) g.effects.dust(b.pos, 3);
      if (b.state === 'roll' && distXZ(pl.pos, b.pos) < 3.0 && this.canHit(5, b.pos.y)) {
        pl.launch(b.dir.x, b.dir.z, 22, 15, 'burger');
        g.audio.boing();
        g.effects.popup('BURGERED!', tmp.copy(pl.pos).setY(pl.pos.y + 2.5), 'comic');
        g.effects.shake(0.6);
        g.score.registerHit();
      }
      if (b.pos.y < -40 || b.t > 12) {
        b.active = false;
        b.group.visible = false;
      }
    }
    b.group.position.copy(b.pos);
  }
}
