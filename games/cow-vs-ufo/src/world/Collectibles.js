import * as THREE from 'three';
import { mat, mesh } from '../utils/materials.js';
import { distXZ, pick, rand, TAU } from '../utils/math.js';

const tmp = new THREE.Vector3();

export const FOODS = {
  apple: { points: 100, label: 'Apple' },
  corn: { points: 100, label: 'Corn' },
  clover: { points: 100, label: 'Clover' },
  golden: { points: 500, label: 'Golden Corn' },
};

function makeApple() {
  const g = new THREE.Group();
  const body = mesh(new THREE.IcosahedronGeometry(0.42, 1), mat(0xe63946, { rough: 0.4 }));
  g.add(body);
  const stem = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 4), mat(0x5a3d1e));
  stem.position.y = 0.45;
  g.add(stem);
  const leaf = mesh(new THREE.BoxGeometry(0.25, 0.04, 0.14), mat(0x52b043));
  leaf.position.set(0.14, 0.5, 0);
  leaf.rotation.z = 0.4;
  g.add(leaf);
  return g;
}

function makeCorn(golden) {
  const g = new THREE.Group();
  const kernel = golden ? mat(0xffd700, { metal: 0.7, rough: 0.25, emissive: 0xffaa00, emissiveIntensity: 0.5 }) : mat(0xffd447);
  const cob = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 3, 8), kernel);
  g.add(cob);
  for (const s of [-1, 1]) {
    const husk = mesh(new THREE.ConeGeometry(0.16, 0.8, 4), mat(golden ? 0xf2c14e : 0x6cc24a));
    husk.position.set(s * 0.15, -0.15, 0);
    husk.rotation.z = s * 0.35;
    g.add(husk);
  }
  g.rotation.z = 0.3;
  return g;
}

function makeClover() {
  const g = new THREE.Group();
  const green = mat(0x3fbf5f);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const leaf = mesh(new THREE.SphereGeometry(0.2, 8, 6), green);
    leaf.scale.set(1, 0.4, 1);
    leaf.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
    g.add(leaf);
  }
  const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), green);
  stem.position.y = -0.1;
  g.add(stem);
  g.rotation.x = 0.6;
  return g;
}

// Snacks the cow must eat to finish a level. A few are always on the map; the
// golden corn rides the balloon platforms for daredevils.
export class Collectibles {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.35, depthWrite: false });
    const glowGeo = new THREE.CircleGeometry(0.8, 20).rotateX(-Math.PI / 2);
    this.items = [];
    const types = ['apple', 'corn', 'clover', 'apple', 'corn', 'clover', 'apple', 'corn'];
    for (const type of types) this.items.push(this.makeItem(type, glowGeo, glowMat));
    this.golden = this.game.obstacles.platforms.map((pf) => {
      const it = this.makeItem('golden', glowGeo, glowMat);
      it.anchor = pf.anchor;
      return it;
    });

    // Arrow that orbits the cow and points to the nearest snack.
    this.pointer = mesh(new THREE.ConeGeometry(0.28, 0.7, 3), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }), { cast: false });
    this.pointer.geometry.rotateX(Math.PI / 2);
    game.scene.add(this.pointer);
    this.time = 0;
  }

  makeItem(type, glowGeo, glowMat) {
    const group = new THREE.Group();
    const model = type === 'apple' ? makeApple() : type === 'clover' ? makeClover() : makeCorn(type === 'golden');
    if (type === 'golden') model.scale.setScalar(1.4);
    group.add(model);
    const glow = mesh(glowGeo, glowMat, { cast: false });
    group.add(glow);
    group.visible = false;
    this.root.add(group);
    return { type, group, model, glow, pos: new THREE.Vector3(), active: false, respawn: 0, phase: rand(0, TAU), anchor: null };
  }

  reset(remaining) {
    this.remaining = remaining;
    for (const it of this.items) it.active = false;
    let n = 0;
    for (const it of this.items) {
      if (n >= Math.min(6, remaining)) break;
      this.place(it);
      n++;
    }
    for (const it of this.items) it.group.visible = it.active;
    for (const it of this.golden) {
      it.active = true;
      it.respawn = 0;
      it.group.visible = true;
    }
  }

  place(it) {
    const g = this.game;
    const pp = g.player.pos;
    // Sometimes perch a snack on top of a hay stack to reward jumping.
    const hay = g.collision.boxes.filter((b) => b.tag === 'hay' && b.active);
    for (let tries = 0; tries < 60; tries++) {
      if (tries < 3 && Math.random() < 0.18 && hay.length) {
        const b = pick(hay);
        const top = hay.reduce((best, o) => (Math.abs(o.min.x - b.min.x) < 1 && Math.abs(o.min.z - b.min.z) < 1 && o.max.y > best ? o.max.y : best), b.max.y);
        it.pos.set((b.min.x + b.max.x) / 2, top + 0.8, (b.min.z + b.max.z) / 2);
        if (!this.occupied(it.pos, it)) break;
        continue;
      }
      const x = rand(-37, 37);
      const z = rand(-37, 37);
      if (Math.hypot(x - pp.x, z - pp.z) < 6) continue;
      if (!g.collision.isClear(x, z, 1.2)) continue;
      it.pos.set(x, g.terrain.heightAt(x, z) + 0.9, z);
      if (!this.occupied(it.pos, it)) break;
    }
    it.active = true;
    it.group.visible = true;
    it.group.scale.setScalar(0.01);
  }

  occupied(p, self) {
    return this.items.some((o) => o !== self && o.active && o.pos.distanceTo(p) < 5);
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    this.time += dt;
    let nearest = null;
    let nd = Infinity;
    const all = [...this.items, ...this.golden];
    for (const it of all) {
      if (it.anchor) {
        if (!it.active) {
          it.respawn -= dt;
          if (it.respawn <= 0) {
            it.active = true;
            it.group.visible = true;
            it.group.scale.setScalar(0.01);
          }
        }
        it.pos.copy(it.anchor).setY(it.anchor.y + 0.9);
      }
      if (!it.active) continue;
      it.group.position.set(it.pos.x, it.pos.y + Math.sin(this.time * 3 + it.phase) * 0.15, it.pos.z);
      it.model.rotation.y += dt * 2;
      const s = it.group.scale.x;
      if (s < 1) it.group.scale.setScalar(Math.min(1, s + dt * 3));
      it.glow.position.y = -0.85 - Math.sin(this.time * 3 + it.phase) * 0.15;
      it.glow.scale.setScalar(1 + Math.sin(this.time * 4 + it.phase) * 0.15);

      const d = distXZ(pl.pos, it.pos);
      const dy = it.pos.y - (pl.pos.y + 1);
      if (!pl.busy && d < 1.5 && Math.abs(dy) < 1.6) {
        this.collect(it);
        continue;
      }
      if (!it.anchor && d < nd) {
        nd = d;
        nearest = it;
      }
    }

    // Point the guide arrow at the nearest snack.
    const show = nearest && nd > 4 && !pl.busy && g.state.is('playing');
    this.pointer.visible = !!show;
    if (show) {
      const a = Math.atan2(nearest.pos.x - pl.pos.x, nearest.pos.z - pl.pos.z);
      this.pointer.position.set(pl.pos.x + Math.sin(a) * 2.2, pl.pos.y + 0.4, pl.pos.z + Math.cos(a) * 2.2);
      this.pointer.rotation.set(0, a, 0);
      this.pointer.material.opacity = 0.55 + Math.sin(this.time * 6) * 0.3;
    }
  }

  collect(it) {
    const g = this.game;
    it.active = false;
    it.group.visible = false;
    tmp.copy(it.pos);
    if (it.anchor) it.respawn = 14;
    g.onCollect(it, tmp);
    if (!it.anchor) {
      this.remaining--;
      const onMap = this.items.filter((o) => o.active).length;
      if (onMap < Math.min(6, this.remaining)) this.place(it);
    }
  }

  hideAll() {
    for (const it of [...this.items, ...this.golden]) {
      it.active = false;
      it.group.visible = false;
    }
    this.pointer.visible = false;
  }
}
