import * as THREE from 'three';
import { pick, rand } from './math.js';

const tmpObj = new THREE.Object3D();
const tmpVec = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const CONFETTI = [0xff4d6d, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0xb388ff, 0xff8fab];

// One pooled InstancedMesh for every particle in the game, so effects never
// allocate meshes inside the main loop.
class Particles {
  constructor(scene, max) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, white);
    }
    this.p = Array.from({ length: max }, () => ({
      life: 0,
      maxLife: 1,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      spin: new THREE.Vector3(),
      size: 0.2,
      grav: 0,
      drag: 0,
      flutter: 0,
    }));
    this.cursor = 0;
    this.color = new THREE.Color();
    scene.add(this.mesh);
  }

  emit(pos, count, o = {}) {
    const colors = o.colors || [0xffffff];
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const p = this.p[i];
      p.life = p.maxLife = rand(o.life?.[0] ?? 0.5, o.life?.[1] ?? 1);
      p.pos.copy(pos);
      if (o.spread) p.pos.add(tmpVec.set(rand(-1, 1), rand(-0.3, 1) * 0.5, rand(-1, 1)).multiplyScalar(o.spread));
      const speed = rand(o.speed?.[0] ?? 1, o.speed?.[1] ?? 3);
      tmpVec.set(rand(-1, 1), 0, rand(-1, 1)).normalize();
      p.vel.set(tmpVec.x * speed, rand(o.up?.[0] ?? 1, o.up?.[1] ?? 3), tmpVec.z * speed);
      p.size = rand(o.size?.[0] ?? 0.1, o.size?.[1] ?? 0.25);
      p.grav = o.grav ?? 9;
      p.drag = o.drag ?? 1;
      p.flutter = o.flutter ?? 0;
      p.rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
      p.spin.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
      this.color.setHex(pick(colors));
      this.mesh.setColorAt(i, this.color);
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
      if (p.flutter) {
        p.vel.x += Math.sin(p.life * 9 + i) * p.flutter * dt;
        p.vel.z += Math.cos(p.life * 7 + i) * p.flutter * dt;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const t = p.life / p.maxLife;
      const s = p.size * Math.min(1, t * 3);
      tmpObj.position.copy(p.pos);
      tmpObj.rotation.copy(p.rot);
      tmpObj.scale.set(s, s, p.flutter ? s * 0.2 : s);
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

// Screen-space text (score popups, comic "BONK!" bubbles) pooled as DOM nodes.
class FloatingText {
  constructor(layer, size = 28) {
    this.layer = layer;
    this.items = Array.from({ length: size }, () => {
      const el = document.createElement('div');
      el.className = 'float-text';
      layer.appendChild(el);
      return { el, life: 0, maxLife: 1, pos: new THREE.Vector3(), rise: 1 };
    });
    this.cursor = 0;
  }

  spawn(text, pos, cls = 'pts', life = 1.1) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.el.textContent = text;
    it.el.className = `float-text ${cls}`;
    it.el.style.setProperty('--tilt', `${rand(-12, 12).toFixed(1)}deg`);
    it.pos.copy(pos);
    it.life = it.maxLife = life;
    it.rise = cls === 'comic' ? 0.8 : 2;
  }

  update(dt, camera, w, h) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.el.style.opacity = '0';
        continue;
      }
      it.pos.y += it.rise * dt;
      tmpVec.copy(it.pos).project(camera);
      if (tmpVec.z > 1) {
        it.el.style.opacity = '0';
        continue;
      }
      const x = (tmpVec.x * 0.5 + 0.5) * w;
      const y = (-tmpVec.y * 0.5 + 0.5) * h;
      const t = 1 - it.life / it.maxLife;
      const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.8 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5);
      it.el.style.opacity = String(Math.min(1, it.life * 3));
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(var(--tilt)) scale(${pop})`;
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
  constructor(scene, layer, { lowQuality = false } = {}) {
    this.particles = new Particles(scene, lowQuality ? 400 : 800);
    this.text = new FloatingText(layer);
    this.camRig = null;
    this.v = new THREE.Vector3();
  }

  shake(amount) {
    this.camRig?.addTrauma(amount);
  }

  dust(pos, count = 4) {
    this.particles.emit(pos, count, { colors: [0xd9b98a, 0xc9a26b, 0xe8d3a8], speed: [0.5, 1.5], up: [0.5, 1.5], size: [0.15, 0.35], life: [0.4, 0.7], grav: -0.5, drag: 3 });
  }

  landPuff(pos, power = 1) {
    this.particles.emit(pos, Math.round(8 * power), { colors: [0xe8d3a8, 0xffffff, 0xd9b98a], speed: [2, 4 * power], up: [0.3, 1.2], size: [0.2, 0.45], life: [0.4, 0.8], grav: 0, drag: 4 });
  }

  sparkle(pos, colors = [0xffe066, 0xfff3b0, 0xffffff]) {
    this.particles.emit(pos, 16, { colors, speed: [1.5, 4], up: [2, 6], size: [0.1, 0.22], life: [0.5, 0.9], grav: 10, drag: 1.5 });
  }

  impact(pos) {
    this.particles.emit(pos, 18, { colors: [0xffffff, 0xffe066, 0xff8fab], speed: [4, 8], up: [1, 5], size: [0.15, 0.35], life: [0.3, 0.6], grav: 6, drag: 3 });
  }

  straw(pos, count = 24) {
    this.particles.emit(pos, count, { colors: [0xf2cf6b, 0xe0b44c, 0xc99a3a], speed: [2, 6], up: [2, 7], size: [0.08, 0.3], life: [0.8, 1.4], grav: 12, drag: 1, spread: 0.8 });
  }

  smoke(pos, count = 10) {
    this.particles.emit(pos, count, { colors: [0xffffff, 0xe6e6e6, 0xd0d0d0], speed: [0.5, 2], up: [1, 3], size: [0.4, 0.8], life: [0.6, 1.1], grav: -1, drag: 2, spread: 0.6 });
  }

  splash(pos) {
    this.particles.emit(pos, 10, { colors: [0x7fd6f5, 0xbdf0ff, 0xffffff], speed: [1, 3], up: [3, 5], size: [0.1, 0.2], life: [0.4, 0.7], grav: 14 });
  }

  confetti(pos, count = 60) {
    this.particles.emit(pos, count, { colors: CONFETTI, speed: [3, 9], up: [6, 14], size: [0.2, 0.35], life: [2, 3.5], grav: 6, drag: 1.2, flutter: 8, spread: 1 });
  }

  beamSparkle(pos) {
    this.particles.emit(pos, 1, { colors: [0x9ff5ff, 0xffffff, 0x7ef0c0], speed: [0.2, 0.8], up: [2, 5], size: [0.08, 0.16], life: [0.6, 1.2], grav: -1, drag: 0.5, spread: 1.5 });
  }

  popup(text, pos, cls = 'pts', life) {
    this.v.copy(pos);
    this.text.spawn(text, this.v, cls, life);
  }

  update(dt, camera, w, h) {
    this.particles.update(dt);
    this.text.update(dt, camera, w, h);
  }

  clear() {
    this.particles.clear();
    this.text.clear();
  }
}
