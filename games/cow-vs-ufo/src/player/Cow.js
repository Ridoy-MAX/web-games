import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, mesh } from '../utils/materials.js';
import { damp, rand, TAU, wrapAngle } from '../utils/math.js';

export const SKINS = [
  { name: 'Classic Moo', base: '#ffffff', spot: '#1f1f22', snout: 0xf4a7b0, hoof: 0x3a2a22 },
  { name: 'Chocolate Milk', base: '#fff3e2', spot: '#6b3e1f', snout: 0xf2b3a0, hoof: 0x4a2c18 },
  { name: 'Strawberry Milk', base: '#ffd6e6', spot: '#c2408f', snout: 0xff9ec4, hoof: 0x7a2a55 },
  { name: 'Highland Floof', base: '#e08e3e', spot: '#b2601c', snout: 0xe8b08a, hoof: 0x4a2c18 },
  { name: 'Golden Calf', base: '#ffd447', spot: '#e0a100', snout: 0xffc1a1, hoof: 0x8a5a00, metal: true },
  { name: 'Cosmic Cow', base: '#3b2a6b', spot: '#8f6bff', snout: 0xb38cff, hoof: 0x1b1238, stars: true },
];

export const ACCESSORIES = ['Nothing', 'Cowboy Hat', 'Party Hat', 'Cool Shades', 'Propeller Cap', 'Flower Crown'];

const EXPRESSIONS = {
  happy: { eye: 1, pupil: 1, mouthW: 0.22, mouthH: 0.07, brow: 0, browY: 0 },
  worried: { eye: 1.1, pupil: 0.85, mouthW: 0.16, mouthH: 0.1, brow: 0.35, browY: 0.05 },
  panic: { eye: 1.35, pupil: 0.55, mouthW: 0.2, mouthH: 0.22, brow: 0.55, browY: 0.12 },
  dizzy: { eye: 0.9, pupil: 1.2, mouthW: 0.25, mouthH: 0.05, brow: -0.2, browY: -0.02 },
  sneaky: { eye: 0.55, pupil: 1, mouthW: 0.14, mouthH: 0.04, brow: -0.35, browY: -0.04 },
  determined: { eye: 0.85, pupil: 1, mouthW: 0.2, mouthH: 0.05, brow: -0.4, browY: -0.03 },
  joy: { eye: 0.35, pupil: 1, mouthW: 0.26, mouthH: 0.16, brow: 0.2, browY: 0.06 },
};

const spotTextures = new Map();

function spotTexture(skinIndex) {
  if (spotTextures.has(skinIndex)) return spotTextures.get(skinIndex);
  const skin = SKINS[skinIndex];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = skin.base;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = skin.spot;
  // Deterministic blobs per skin so every cow of one skin matches.
  let seed = 17 + skinIndex * 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) {
    const cx = rnd() * 256;
    const cy = rnd() * 256;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(cx + (rnd() - 0.5) * 50, cy + (rnd() - 0.5) * 40, 12 + rnd() * 22, 10 + rnd() * 16, rnd() * 3, 0, TAU);
      g.fill();
    }
  }
  if (skin.stars) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 2, 2 + rnd() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  spotTextures.set(skinIndex, tex);
  return tex;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.08 : 0.2;
    const a = (i / 10) * TAU + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
}

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

// A chunky, big-headed cartoon cow built from primitives. Facing +Z, feet at y=0.
export class Cow {
  constructor(skin = 0, accessory = 0) {
    this.root = new THREE.Group();
    this.squash = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = 1.11;
    this.root.add(this.squash);
    this.squash.add(this.body);

    this.coatMat = new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: false });
    this.snoutMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    this.legMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    this.hoofMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const dark = mat(0x18181b, { rough: 0.4, flat: false });
    const white = mat(0xffffff, { rough: 0.3, flat: false });

    const torso = mesh(new RoundedBoxGeometry(1.25, 1.0, 1.8, 3, 0.3), this.coatMat);
    torso.position.z = -0.1;
    this.body.add(torso);

    const udder = mesh(new THREE.SphereGeometry(0.28, 10, 8), this.snoutMat);
    udder.scale.y = 0.7;
    udder.position.set(0, -0.5, -0.45);
    this.body.add(udder);

    this.legs = [];
    const legGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.66, 8);
    const hoofGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.18, 8);
    for (const [x, z] of [[-0.38, 0.55], [0.38, 0.55], [-0.38, -0.75], [0.38, -0.75]]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.3, z);
      const leg = mesh(legGeo, this.legMat);
      leg.position.y = -0.36;
      hip.add(leg);
      const hoof = mesh(hoofGeo, this.hoofMat);
      hoof.position.y = -0.72;
      hip.add(hoof);
      this.body.add(hip);
      this.legs.push(hip);
    }

    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.3, -1.0);
    const tailRope = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 5), this.legMat);
    tailRope.position.y = -0.36;
    this.tail.add(tailRope);
    const tuft = mesh(new THREE.SphereGeometry(0.13, 6, 5), dark);
    tuft.position.y = -0.75;
    this.tail.add(tuft);
    this.tail.rotation.x = -0.5;
    this.body.add(this.tail);

    // Oversized head for maximum cartoon.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.45, 0.95);
    this.body.add(this.head);
    const skull = mesh(new RoundedBoxGeometry(1.2, 1.02, 1.0, 3, 0.32), this.coatMat);
    skull.position.set(0, 0.15, 0.25);
    this.head.add(skull);
    const snout = mesh(new RoundedBoxGeometry(1.0, 0.5, 0.48, 3, 0.18), this.snoutMat);
    snout.position.set(0, -0.15, 0.72);
    this.head.add(snout);
    for (const x of [-0.2, 0.2]) {
      const n = mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
      n.scale.z = 0.5;
      n.position.set(x, -0.08, 0.96);
      this.head.add(n);
    }
    this.mouth = mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x5a1e2a, { rough: 0.5, flat: false }));
    this.mouth.position.set(0, -0.3, 0.95);
    this.head.add(this.mouth);

    this.eyes = [];
    this.pupils = [];
    this.brows = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.27, 0.34, 0.66);
      const ball = mesh(new THREE.SphereGeometry(0.2, 12, 10), white);
      ball.scale.z = 0.6;
      eye.add(ball);
      const pupil = new THREE.Group();
      const p = mesh(new THREE.SphereGeometry(0.1, 10, 8), dark);
      p.position.z = 0.1;
      pupil.add(p);
      const shine = mesh(new THREE.SphereGeometry(0.03, 6, 4), white);
      shine.position.set(0.035, 0.04, 0.18);
      pupil.add(shine);
      eye.add(pupil);
      this.head.add(eye);
      this.eyes.push(eye);
      this.pupils.push(pupil);
      const brow = mesh(new THREE.BoxGeometry(0.32, 0.07, 0.07), dark);
      brow.position.set(s * 0.27, 0.6, 0.7);
      brow.userData.side = s;
      this.head.add(brow);
      this.brows.push(brow);
    }

    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.58, 0.36, 0.15);
      const flap = mesh(new THREE.BoxGeometry(0.46, 0.12, 0.28), this.coatMat);
      flap.position.x = s * 0.22;
      ear.add(flap);
      const inner = mesh(new THREE.BoxGeometry(0.34, 0.04, 0.18), this.snoutMat);
      inner.position.set(s * 0.24, 0.06, 0);
      ear.add(inner);
      ear.rotation.z = s * -0.3;
      this.head.add(ear);
      this.ears.push(ear);
      const horn = mesh(new THREE.ConeGeometry(0.09, 0.38, 6), mat(0xf2e6c8));
      horn.position.set(s * 0.4, 0.75, 0.1);
      horn.rotation.z = s * -0.55;
      this.head.add(horn);
    }

    const collar = mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 16), mat(0xd63a3a));
    collar.position.set(0, 0.12, 0.88);
    collar.rotation.x = Math.PI / 2 + 0.5;
    this.body.add(collar);
    this.bell = mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xffc93c, { metal: 0.8, rough: 0.3, flat: false }));
    this.bell.position.set(0, -0.28, 1.0);
    this.body.add(this.bell);

    this.accessory = new THREE.Group();
    this.accessory.position.set(0, 0.66, 0.25);
    this.head.add(this.accessory);

    this.stars = new THREE.Group();
    this.stars.position.set(0, 1.0, 0.2);
    const sg = starGeometry();
    for (let i = 0; i < 3; i++) {
      const st = mesh(sg, mat(0xffe14d, { emissive: 0xffc800, emissiveIntensity: 0.6 }), { cast: false });
      this.stars.add(st);
    }
    this.stars.visible = false;
    this.head.add(this.stars);

    this.root.traverse((o) => {
      if (o.isMesh && o !== this.mouth) o.castShadow = true;
    });

    this.phase = 0;
    this.time = rand(0, 10);
    this.blink = rand(1, 4);
    this.squashY = 1;
    this.squashV = 0;
    this.pancake = 0;
    this.expr = { ...EXPRESSIONS.happy };
    this.exprName = 'happy';
    this.propeller = null;
    this.setSkin(skin);
    this.setAccessory(accessory);
  }

  setSkin(i) {
    const skin = SKINS[i] ?? SKINS[0];
    this.skinIndex = i;
    this.coatMat.map = spotTexture(i);
    this.coatMat.metalness = skin.metal ? 0.6 : 0;
    this.coatMat.roughness = skin.metal ? 0.35 : 0.75;
    this.coatMat.needsUpdate = true;
    this.legMat.color.set(skin.base);
    this.legMat.metalness = skin.metal ? 0.6 : 0;
    this.snoutMat.color.setHex(skin.snout);
    this.hoofMat.color.setHex(skin.hoof);
  }

  setAccessory(i) {
    this.accessoryIndex = i;
    this.accessory.clear();
    this.propeller = null;
    const add = (geo, color, x, y, z, opts) => {
      const m = mesh(geo, mat(color, opts));
      m.position.set(x, y, z);
      this.accessory.add(m);
      return m;
    };
    switch (ACCESSORIES[i]) {
      case 'Cowboy Hat': {
        add(new THREE.CylinderGeometry(0.78, 0.82, 0.07, 14), 0x8b5a2b, 0, 0.02, 0);
        add(new THREE.CylinderGeometry(0.34, 0.42, 0.45, 10), 0x8b5a2b, 0, 0.26, 0);
        add(new THREE.CylinderGeometry(0.43, 0.43, 0.09, 10), 0x3b2412, 0, 0.1, 0);
        break;
      }
      case 'Party Hat': {
        const cone = add(new THREE.ConeGeometry(0.3, 0.75, 10), 0xff4d9d, 0.05, 0.38, 0);
        cone.rotation.z = -0.15;
        add(new THREE.SphereGeometry(0.11, 8, 6), 0xffe14d, 0.11, 0.78, 0);
        add(new THREE.TorusGeometry(0.27, 0.04, 5, 12), 0x4cc9f0, 0, 0.12, 0).rotation.x = Math.PI / 2;
        break;
      }
      case 'Cool Shades': {
        add(new THREE.BoxGeometry(0.38, 0.22, 0.05), 0x111111, -0.27, -0.3, 0.68, { rough: 0.2, metal: 0.5 });
        add(new THREE.BoxGeometry(0.38, 0.22, 0.05), 0x111111, 0.27, -0.3, 0.68, { rough: 0.2, metal: 0.5 });
        add(new THREE.BoxGeometry(0.9, 0.05, 0.05), 0x111111, 0, -0.24, 0.68);
        break;
      }
      case 'Propeller Cap': {
        const cap = add(new THREE.SphereGeometry(0.52, 12, 6, 0, TAU, 0, Math.PI / 2), 0x3a86ff, 0, -0.05, 0);
        cap.scale.y = 0.6;
        add(new THREE.BoxGeometry(0.5, 0.05, 0.4), 0xffbe0b, 0, -0.03, 0.55);
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 5), 0x333333, 0, 0.35, 0);
        this.propeller = new THREE.Group();
        this.propeller.position.y = 0.48;
        for (const s of [-1, 1]) {
          const blade = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.12), mat(s > 0 ? 0xff006e : 0x8338ec));
          blade.position.x = s * 0.25;
          this.propeller.add(blade);
        }
        this.accessory.add(this.propeller);
        break;
      }
      case 'Flower Crown': {
        const cols = [0xff8fab, 0xffffff, 0xffd23f, 0xb388ff];
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU;
          add(new THREE.IcosahedronGeometry(0.11, 0), cols[k % cols.length], Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.42);
        }
        break;
      }
      default:
        break;
    }
  }

  setExpression(name) {
    this.exprName = name in EXPRESSIONS ? name : 'happy';
  }

  // Landing squash. amount 0..1
  squish(amount) {
    this.squashY = Math.min(this.squashY, 1 - amount);
    this.squashV = 0;
  }

  flatten() {
    this.pancake = 1.1;
  }

  update(dt, s = {}) {
    this.time += dt;
    const speed = s.speed ?? 0;
    const grounded = s.grounded ?? true;
    const vy = s.vy ?? 0;
    const t = this.time;

    // Expression blending.
    const target = EXPRESSIONS[this.exprName];
    for (const k in target) this.expr[k] = damp(this.expr[k], target[k], 14, dt);
    this.blink -= dt;
    let blinkScale = 1;
    if (this.blink < 0) {
      blinkScale = 0.1;
      if (this.blink < -0.12) this.blink = rand(2, 5);
    }
    const e = this.expr;
    for (const eye of this.eyes) eye.scale.set(e.eye, e.eye * blinkScale, e.eye);
    for (const p of this.pupils) p.scale.setScalar(e.pupil);
    for (const b of this.brows) {
      b.rotation.z = b.userData.side * -e.brow;
      b.position.y = 0.6 + e.browY + (e.eye - 1) * 0.15;
    }
    this.mouth.scale.set(e.mouthW, e.mouthH, 0.06);

    // Pupils look at a world point (the UFO, usually).
    if (s.lookAt) {
      this.head.updateWorldMatrix(true, false);
      _m.copy(this.head.matrixWorld).invert();
      _v.copy(s.lookAt).applyMatrix4(_m).sub(this.eyes[0].position).normalize();
      for (const p of this.pupils) p.position.set(_v.x * 0.06, _v.y * 0.06, 0);
    } else if (this.exprName === 'dizzy') {
      for (const [i, p] of this.pupils.entries()) p.position.set(Math.cos(t * 10 + i * 3) * 0.06, Math.sin(t * 10 + i * 3) * 0.06, 0);
    } else {
      for (const p of this.pupils) p.position.set(0, 0, 0);
    }

    // Legs.
    const moving = speed > 0.05;
    if (moving && grounded) this.phase += dt * (5 + speed * 9);
    const legs = this.legs;
    if (s.lifted) {
      for (const [i, l] of legs.entries()) {
        l.rotation.x = Math.sin(t * 28 + i * 1.7) * 0.9;
        l.rotation.z = Math.cos(t * 23 + i) * 0.4;
      }
    } else if (!grounded) {
      // Starfish pose in the air: legs flung out.
      const fl = s.tumble ? 1 : 0.6;
      legs[0].rotation.x = damp(legs[0].rotation.x, -1.0 * fl, 12, dt);
      legs[1].rotation.x = damp(legs[1].rotation.x, -1.0 * fl, 12, dt);
      legs[2].rotation.x = damp(legs[2].rotation.x, 1.0 * fl, 12, dt);
      legs[3].rotation.x = damp(legs[3].rotation.x, 1.0 * fl, 12, dt);
      for (const [i, l] of legs.entries()) l.rotation.z = damp(l.rotation.z, (i % 2 ? -0.5 : 0.5) * fl, 12, dt);
    } else if (s.dancing) {
      for (const [i, l] of legs.entries()) {
        l.rotation.x = Math.sin(t * 9 + (i % 2) * Math.PI) * 0.5;
        l.rotation.z = 0;
      }
    } else {
      const amp = Math.min(1, speed) * 0.85;
      const sw = Math.sin(this.phase);
      legs[0].rotation.x = sw * amp;
      legs[3].rotation.x = sw * amp;
      legs[1].rotation.x = -sw * amp;
      legs[2].rotation.x = -sw * amp;
      for (const l of legs) l.rotation.z = damp(l.rotation.z, 0, 12, dt);
    }

    // Body bob / tumble / dance.
    const bob = grounded && moving ? Math.abs(Math.sin(this.phase)) * 0.14 * Math.min(1, speed) : 0;
    this.body.position.y = 1.11 + bob;
    if (s.tumble) {
      this.body.rotation.x += dt * 11;
      this.body.rotation.z += dt * 6;
    } else if (s.dancing) {
      this.body.rotation.x = damp(wrapAngle(this.body.rotation.x), 0, 10, dt);
      this.body.rotation.z = Math.sin(t * 9) * 0.25;
      this.body.position.y += Math.abs(Math.sin(t * 9)) * 0.25;
    } else if (s.lifted) {
      this.body.rotation.x = damp(wrapAngle(this.body.rotation.x), Math.sin(t * 3) * 0.3, 6, dt);
      this.body.rotation.z = damp(wrapAngle(this.body.rotation.z), Math.cos(t * 2.5) * 0.4, 6, dt);
    } else {
      this.body.rotation.x = damp(wrapAngle(this.body.rotation.x), grounded ? -Math.min(1, speed) * 0.08 : 0, 10, dt);
      this.body.rotation.z = damp(wrapAngle(this.body.rotation.z), 0, 10, dt);
    }

    // Head bob, ears flop with vertical speed, tail wags.
    this.head.rotation.x = Math.sin(this.phase * 2) * 0.06 * Math.min(1, speed) + (s.grazing ? 0.6 : 0);
    this.head.rotation.y = s.dancing ? Math.sin(t * 4.5) * 0.4 : damp(this.head.rotation.y, 0, 6, dt);
    const flop = Math.max(-0.9, Math.min(0.9, -vy * 0.06));
    for (const [i, ear] of this.ears.entries()) {
      const side = i ? 1 : -1;
      ear.rotation.z = damp(ear.rotation.z, side * (-0.3 + flop) + Math.sin(t * 3 + i) * 0.05, 10, dt);
    }
    this.tail.rotation.z = Math.sin(t * (moving ? 12 : 3)) * (moving ? 0.6 : 0.3);
    this.bell.rotation.z = Math.sin(t * 14) * 0.3 * Math.min(1, speed + 0.1);
    if (this.propeller) this.propeller.rotation.y += dt * (8 + speed * 30 + (grounded ? 0 : 25));

    // Squash and stretch spring.
    let targetY = 1;
    if (!grounded && !s.lifted) targetY = 1 + Math.max(-0.12, Math.min(0.22, vy * 0.018));
    if (this.pancake > 0) {
      this.pancake -= dt;
      this.squashY = 0.22;
      this.squashV = 0;
    } else {
      this.squashV += (targetY - this.squashY) * 260 * dt;
      this.squashV *= Math.exp(-11 * dt);
      this.squashY += this.squashV * dt;
    }
    const sy = Math.max(0.15, this.squashY);
    const sxz = this.pancake > 0 ? 1.7 : 1 / Math.sqrt(sy);
    this.squash.scale.set(sxz, sy, sxz);

    // Dizzy stars orbit the head.
    this.stars.visible = !!s.dizzy;
    if (s.dizzy) {
      this.stars.children.forEach((st, i) => {
        const a = t * 5 + (i / 3) * TAU;
        st.position.set(Math.cos(a) * 0.65, Math.sin(t * 7 + i) * 0.08, Math.sin(a) * 0.65);
        st.rotation.y = -a;
      });
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.coatMat.dispose();
    this.snoutMat.dispose();
    this.legMat.dispose();
    this.hoofMat.dispose();
  }
}
