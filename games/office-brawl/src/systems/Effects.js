import * as THREE from 'three';
import { pick, rand } from '../utils/math.js';

const tmpObj = new THREE.Object3D();
const tmpVec = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Pooled particles in one InstancedMesh.
class Particles {
  constructor(scene, max) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, white);
    }
    this.p = Array.from({ length: max }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0.2, grav: 0, drag: 0, flat: false }));
    this.cursor = 0;
    this.color = new THREE.Color();
    scene.add(this.mesh);
  }

  emit(x, y, z, count, o = {}) {
    const colors = o.colors ?? [0xffffff];
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const p = this.p[i];
      p.life = p.max = rand(o.life?.[0] ?? 0.3, o.life?.[1] ?? 0.7);
      p.pos.set(x + rand(-1, 1) * (o.spread ?? 0), y + rand(-1, 1) * (o.spreadY ?? o.spread ?? 0), z + rand(-0.3, 0.3));
      const a = o.dir != null ? o.dir + rand(-0.6, 0.6) : rand(0, Math.PI * 2);
      const sp = rand(o.speed?.[0] ?? 2, o.speed?.[1] ?? 6);
      p.vel.set(Math.cos(a) * sp, Math.sin(a) * sp + rand(o.up?.[0] ?? 0, o.up?.[1] ?? 0), rand(-1, 1) * sp * 0.3);
      p.size = rand(o.size?.[0] ?? 0.08, o.size?.[1] ?? 0.2);
      p.grav = o.grav ?? 8;
      p.drag = o.drag ?? 2;
      p.flat = !!o.flat;
      p.rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
      p.spin.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
      this.mesh.setColorAt(i, this.color.setHex(pick(colors)));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      const s = p.size * Math.min(1, (p.life / p.max) * 2.5);
      tmpObj.position.copy(p.pos);
      tmpObj.rotation.copy(p.rot);
      tmpObj.scale.set(s, s, p.flat ? s * 0.15 : s);
      tmpObj.updateMatrix();
      this.mesh.setMatrixAt(i, tmpObj.matrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.p[i].life = 0;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// DOM overlays for comic text and speech bubbles anchored to the 3D world.
class Overlay {
  constructor(layer) {
    this.layer = layer;
    this.items = [];
  }

  spawn(text, pos, cls, life, follow = null) {
    let it = this.items.find((o) => o.life <= 0);
    if (!it) {
      if (this.items.length > 40) return;
      const el = document.createElement('div');
      this.layer.appendChild(el);
      it = { el, pos: new THREE.Vector3() };
      this.items.push(it);
    }
    it.el.className = `fx ${cls}`;
    it.el.textContent = text;
    it.el.style.setProperty('--tilt', `${rand(-10, 10).toFixed(1)}deg`);
    it.life = it.max = life;
    it.follow = follow;
    it.pos.copy(pos);
    it.rise = cls.includes('bubble') ? 0 : cls.includes('comic') ? 0.6 : 1.2;
    // Only one speech bubble per fighter at a time.
    if (follow) for (const o of this.items) if (o !== it && o.follow === follow && o.life > 0) o.life = 0.01;
  }

  update(dt, camera, w, h) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.el.style.opacity = '0';
        continue;
      }
      if (it.follow) it.follow.headPos(tmpVec).y += 0.75;
      else {
        it.pos.y += it.rise * dt;
        tmpVec.copy(it.pos);
      }
      tmpVec.project(camera);
      const x = (tmpVec.x * 0.5 + 0.5) * w;
      const y = (-tmpVec.y * 0.5 + 0.5) * h;
      const t = 1 - it.life / it.max;
      const pop = t < 0.12 ? 0.5 + (t / 0.12) * 0.7 : 1.2 - Math.min(0.2, (t - 0.12) * 0.4);
      it.el.style.opacity = String(Math.min(1, it.life * 4));
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) rotate(var(--tilt)) scale(${pop})`;
    }
  }

  clear() {
    for (const it of this.items) {
      it.life = 0;
      it.el.style.opacity = '0';
    }
  }
}

export class Effects {
  constructor(scene, layer, lowQuality) {
    this.scene = scene;
    this.particles = new Particles(scene, lowQuality ? 500 : 900);
    this.overlay = new Overlay(layer);
    this.rings = [];
  }

  text(text, pos, cls = 'comic', life = 0.9) {
    this.overlay.spawn(text, pos, cls, life);
  }

  bubble(text, fighter, cls = 'special', life = 1.6) {
    this.overlay.spawn(text, fighter.headPos(), `bubble ${cls}`, life, fighter);
  }

  hitSpark(x, y, heavy) {
    this.particles.emit(x, y, 0.3, heavy ? 22 : 12, { colors: [0xffffff, 0xffe14d, 0xff9f1c], speed: [4, heavy ? 11 : 7], size: [0.08, 0.22], life: [0.15, 0.35], grav: 0, drag: 6 });
    this.ring(x, y, heavy ? 0xffe14d : 0xffffff, heavy ? 1.4 : 0.8, 0.18);
  }

  blockSpark(x, y) {
    this.particles.emit(x, y, 0.3, 10, { colors: [0x9ccfff, 0xffffff], speed: [3, 6], size: [0.06, 0.14], life: [0.15, 0.3], grav: 0, drag: 6 });
  }

  dust(x, power = 1) {
    this.particles.emit(x, 0.1, 0, Math.round(6 * power), { colors: [0xd9d2c5, 0xbfb6a6, 0xffffff], speed: [1, 3 * power], up: [0.5, 2], size: [0.15, 0.35], life: [0.3, 0.7], grav: -1, drag: 4, spread: 0.3 });
  }

  smoke(x, y) {
    this.particles.emit(x, y, 0, 18, { colors: [0xffffff, 0xdfe6ee, 0xc8d0da], speed: [1, 3], up: [0, 1], size: [0.3, 0.6], life: [0.4, 0.8], grav: -2, drag: 3, spread: 0.5 });
  }

  coins(x, y, n = 12) {
    this.particles.emit(x, y, 0, n, { colors: [0xffd700, 0xffe066, 0xe0a100], speed: [2, 6], up: [3, 6], size: [0.12, 0.2], life: [0.6, 1.2], grav: 14, drag: 0.5, flat: true });
  }

  papers(x, y) {
    this.particles.emit(x, y, 0, 8, { colors: [0xffffff, 0xff8fab, 0xffe14d, 0x9ccfff], speed: [1.5, 4], up: [1, 3], size: [0.15, 0.25], life: [0.5, 1], grav: 4, drag: 2, flat: true });
  }

  splash(x) {
    this.particles.emit(x, 0.2, 0, 14, { colors: [0x6f4e37, 0xa47148, 0xffffff], speed: [2, 4], up: [2, 4], size: [0.06, 0.14], life: [0.3, 0.6], grav: 14 });
  }

  confetti(x, y, n = 60) {
    this.particles.emit(x, y, 0, n, { colors: [0xff4d6d, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0xb388ff], speed: [3, 8], up: [4, 9], size: [0.15, 0.28], life: [1.5, 2.8], grav: 6, drag: 1.2, flat: true, spread: 1 });
  }

  flame(f) {
    this.particles.emit(f.x + rand(-0.4, 0.4), f.y + rand(0.2, 2.2), 0, 1, { colors: [0xff9f1c, 0xffd23f, 0xff4d1a], speed: [0.2, 0.6], up: [1.5, 3], size: [0.1, 0.2], life: [0.3, 0.6], grav: -2, drag: 1 });
  }

  afterimage(f) {
    const c = new THREE.Color(f.def.color).getHex();
    this.particles.emit(f.x, f.y + 1.3, 0, 10, { colors: [c, 0xffffff], speed: [0.2, 1], size: [0.15, 0.3], life: [0.2, 0.4], grav: 0, drag: 4, spread: 0.4, spreadY: 1 });
  }

  ring(x, y, color, size = 1.2, life = 0.3) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, 0.4);
    this.scene.add(m);
    this.rings.push({ m, life, max: life, size });
  }

  update(dt, camera, w, h) {
    this.particles.update(dt);
    this.overlay.update(dt, camera, w, h);
    for (const r of this.rings) {
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.max;
      r.m.scale.setScalar(0.3 + t * r.size * 2);
      r.m.material.opacity = 0.9 * (1 - t);
      if (r.life <= 0) {
        this.scene.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
      }
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  clear() {
    this.particles.clear();
    this.overlay.clear();
    for (const r of this.rings) {
      this.scene.remove(r.m);
      r.m.geometry.dispose();
      r.m.material.dispose();
    }
    this.rings = [];
  }
}
