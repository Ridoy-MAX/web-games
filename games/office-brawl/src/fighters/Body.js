import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, mesh } from '../utils/materials.js';
import { TAU } from '../utils/math.js';

const HIP_HEIGHT = 0.95;

const smooth = (color, opts = {}) => mat(color, { flat: false, rough: 0.7, ...opts });

function limb(radiusTop, radiusBottom, length, material) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 10);
  geo.translate(0, -length / 2, 0);
  return mesh(geo, material);
}

function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const plaidCache = new Map();
function plaid(base, line) {
  const key = `${base}|${line}`;
  if (!plaidCache.has(key)) {
    plaidCache.set(
      key,
      canvasTexture((g, w, h) => {
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.55;
        g.fillStyle = line;
        for (let i = 0; i < w; i += 64) {
          g.fillRect(i, 0, 22, h);
          g.fillRect(0, i, w, 22);
        }
        g.globalAlpha = 0.35;
        g.fillStyle = '#111';
        for (let i = 30; i < w; i += 64) {
          g.fillRect(i, 0, 4, h);
          g.fillRect(0, i, w, 4);
        }
      }),
    );
  }
  return plaidCache.get(key);
}

function shirtText(text, bg, fg) {
  return canvasTexture(
    (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.font = 'bold 54px "Lilita One", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2);
    },
    256,
    128,
  );
}

// A stylized, big-headed office worker with a full joint hierarchy:
// root > body > hips > spine > chest > neck > head, two-segment arms and legs.
// Facing +Z with feet at y = 0.
export class Body {
  constructor(look) {
    this.look = look;
    const s = look.scale ?? 1;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilted as a whole for knockdowns
    this.root.add(this.body);
    this.body.scale.setScalar(s);

    const skin = smooth(look.skin);
    const pants = mat(look.pants);
    const shoes = mat(look.shoes ?? 0x2b2b2b, { rough: 0.5 });
    const topMat = look.top === 'flannel' ? new THREE.MeshStandardMaterial({ map: plaid(look.topHex ?? '#b3302b', '#2b2b2b'), roughness: 0.8 }) : mat(look.topColor);
    const shirtMat = mat(look.shirt ?? look.topColor);
    const sleeveMat = ['blazer', 'suit', 'cardigan', 'hoodie', 'flannel'].includes(look.top) ? topMat : shirtMat;
    this.skinMat = skin;

    const j = {};
    this.j = j;
    j.hips = new THREE.Group();
    j.hips.position.y = HIP_HEIGHT;
    this.body.add(j.hips);
    const pelvis = mesh(new RoundedBoxGeometry(0.62 * (look.width ?? 1), 0.3, 0.38, 2, 0.1), pants);
    j.hips.add(pelvis);
    if (look.belt !== false) {
      const belt = mesh(new THREE.BoxGeometry(0.64 * (look.width ?? 1), 0.07, 0.4), mat(0x2a1e14));
      belt.position.y = 0.13;
      j.hips.add(belt);
    }

    // --- torso -------------------------------------------------------------
    j.spine = new THREE.Group();
    j.spine.position.y = 0.1;
    j.hips.add(j.spine);
    j.chest = new THREE.Group();
    j.chest.position.y = 0.34;
    j.spine.add(j.chest);
    const w = 0.76 * (look.width ?? 1);
    const belly = look.belly ?? 0;
    const torso = mesh(new RoundedBoxGeometry(w, 0.76, 0.44 + belly * 0.2, 3, 0.16), topMat);
    torso.position.y = 0.02;
    j.chest.add(torso);
    if (belly) {
      const gut = mesh(new THREE.SphereGeometry(0.36, 14, 10), topMat);
      gut.scale.set(1, 0.8, 0.7 + belly * 0.4);
      gut.position.set(0, -0.12, 0.12);
      j.chest.add(gut);
    }
    this.addTop(j.chest, look, topMat, shirtMat, w);

    // --- head --------------------------------------------------------------
    j.neck = new THREE.Group();
    j.neck.position.y = 0.4;
    j.chest.add(j.neck);
    const neckMesh = limb(0.11, 0.12, 0.14, skin);
    neckMesh.position.y = 0.12;
    j.neck.add(neckMesh);
    j.head = new THREE.Group();
    j.head.position.y = 0.42;
    j.neck.add(j.head);
    const skull = mesh(new THREE.SphereGeometry(0.42, 20, 16), skin);
    skull.scale.set(1, 1.04, 0.98);
    j.head.add(skull);
    for (const sx of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.08, 8, 6), skin);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(sx * 0.41, 0, 0);
      j.head.add(ear);
    }
    this.buildFace(j.head, look);
    this.buildHair(j.head, look);
    this.buildHeadExtras(j.head, look);

    // --- arms --------------------------------------------------------------
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * (w / 2 + 0.04), 0.26, 0);
      j.chest.add(shoulder);
      const cap = mesh(new THREE.SphereGeometry(0.13, 10, 8), sleeveMat);
      shoulder.add(cap);
      shoulder.add(limb(0.115, 0.1, 0.42, sleeveMat));
      const elbow = new THREE.Group();
      elbow.position.y = -0.42;
      shoulder.add(elbow);
      const longSleeve = look.sleeves !== 'short';
      elbow.add(limb(0.1, 0.085, 0.38, longSleeve ? sleeveMat : skin));
      const hand = new THREE.Group();
      hand.position.y = -0.4;
      elbow.add(hand);
      const fist = mesh(new THREE.SphereGeometry(0.115, 10, 8), skin);
      fist.scale.set(0.9, 1.05, 1);
      hand.add(fist);
      j[`${side}Shoulder`] = shoulder;
      j[`${side}Elbow`] = elbow;
      j[`${side}Hand`] = hand;
    }
    if (look.watch) {
      const watch = mesh(new THREE.TorusGeometry(0.095, 0.03, 6, 12), mat(0xffc93c, { metal: 0.9, rough: 0.3 }));
      watch.rotation.x = Math.PI / 2;
      watch.position.y = -0.32;
      j.rElbow.add(watch);
    }

    // --- legs --------------------------------------------------------------
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(sx * 0.17, -0.08, 0);
      j.hips.add(hip);
      hip.add(limb(0.15, 0.13, 0.46, pants));
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      hip.add(knee);
      knee.add(limb(0.13, 0.11, 0.41, pants));
      const foot = new THREE.Group();
      foot.position.y = -0.41;
      knee.add(foot);
      const shoe = mesh(new RoundedBoxGeometry(0.22, 0.13, 0.36, 2, 0.05), shoes);
      shoe.position.set(0, -0.0, 0.07);
      foot.add(shoe);
      if (look.sneakers) {
        const sole = mesh(new THREE.BoxGeometry(0.23, 0.04, 0.37), mat(0xffffff));
        sole.position.set(0, -0.06, 0.07);
        foot.add(sole);
      }
      j[`${side}Hip`] = hip;
      j[`${side}Knee`] = knee;
      j[`${side}Foot`] = foot;
    }

    this.prop = null;
    if (look.prop) this.setProp(look.prop);

    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.rest = {};
    for (const [k, g] of Object.entries(j)) this.rest[k] = g.position.clone();
  }

  addTop(chest, look, topMat, shirtMat, w) {
    const front = (geo, material, x, y, z) => {
      const m = mesh(geo, material);
      m.position.set(x, y, z);
      chest.add(m);
      return m;
    };
    const d = 0.23 + (look.belly ?? 0) * 0.1;
    switch (look.top) {
      case 'blazer':
      case 'suit':
      case 'cardigan': {
        // Open jacket: shirt strip down the middle, lapels and optional tie.
        front(new THREE.BoxGeometry(0.2, 0.7, 0.02), shirtMat, 0, 0.02, d);
        for (const sx of [-1, 1]) {
          const lapel = front(new THREE.BoxGeometry(0.1, 0.34, 0.03), mat(look.lapel ?? look.topColor), sx * 0.11, 0.2, d + 0.01);
          lapel.rotation.z = sx * 0.35;
        }
        if (look.top === 'cardigan') {
          for (let i = 0; i < 3; i++) front(new THREE.SphereGeometry(0.025, 6, 4), mat(0xf2e6c8), 0.12, 0.1 - i * 0.18, d + 0.02);
        }
        break;
      }
      case 'hoodie': {
        const hood = mesh(new THREE.TorusGeometry(0.24, 0.09, 8, 16, Math.PI), topMat);
        hood.position.set(0, 0.36, -0.12);
        hood.rotation.set(-0.6, 0, 0);
        chest.add(hood);
        front(new THREE.BoxGeometry(0.42, 0.2, 0.03), topMat, 0, -0.2, d + 0.01);
        for (const sx of [-1, 1]) front(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), mat(0xffffff), sx * 0.07, 0.2, d + 0.02);
        break;
      }
      case 'vest': {
        // Hi-vis QA vest with reflective stripes.
        const vest = mesh(new RoundedBoxGeometry(w + 0.04, 0.6, 0.48, 2, 0.12), mat(look.vestColor ?? 0xd7ff3a, { emissive: 0x2a3300 }));
        vest.position.y = -0.03;
        chest.add(vest);
        for (const y of [-0.12, 0.08]) front(new THREE.BoxGeometry(w + 0.06, 0.05, 0.5), mat(0xe8eef2, { metal: 0.6, rough: 0.3 }), 0, y, 0);
        break;
      }
      case 'fleece': {
        // The legendary product-manager fleece vest.
        for (const sx of [-1, 1]) front(new THREE.BoxGeometry(w / 2 - 0.04, 0.66, 0.06), mat(look.vestColor ?? 0x59606b), sx * (w / 4 + 0.02), 0, d - 0.01);
        front(new THREE.BoxGeometry(0.02, 0.62, 0.07), mat(0x222222), 0, 0, d + 0.01);
        break;
      }
      case 'tshirt': {
        if (look.shirtText) {
          const panel = mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: shirtText(look.shirtText, look.topHex ?? '#ff8c42', '#ffffff') }), { cast: false });
          panel.position.set(0, 0.06, d + 0.005);
          chest.add(panel);
        }
        break;
      }
      default:
        break;
    }
    if (look.tie) {
      const tie = front(new THREE.BoxGeometry(0.08, 0.4, 0.02), mat(look.tie, { rough: 0.4 }), 0, 0.02, d + 0.025);
      tie.geometry.translate(0, -0.05, 0);
      front(new THREE.BoxGeometry(0.1, 0.07, 0.03), mat(look.tie), 0, 0.3, d + 0.03);
    }
    if (look.pocketSquare) front(new THREE.BoxGeometry(0.1, 0.06, 0.02), mat(look.pocketSquare), -0.2, 0.16, d + 0.02);
    if (look.lanyard) {
      const cord = mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 16, Math.PI), mat(look.lanyard));
      cord.position.set(0, 0.28, d - 0.02);
      cord.rotation.z = Math.PI;
      chest.add(cord);
      front(new THREE.BoxGeometry(0.13, 0.17, 0.02), mat(0xffffff), 0, 0.02, d + 0.02);
    }
  }

  buildFace(head, look) {
    const white = mat(0xffffff, { flat: false, rough: 0.3 });
    const dark = mat(0x1b1b1f, { flat: false, rough: 0.4 });
    this.eyes = [];
    this.pupils = [];
    this.brows = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.14, 0.05, 0.35);
      const ball = mesh(new THREE.SphereGeometry(0.085, 10, 8), white, { cast: false });
      ball.scale.z = 0.5;
      eye.add(ball);
      const pupil = mesh(new THREE.SphereGeometry(0.045, 8, 6), dark, { cast: false });
      pupil.position.z = 0.04;
      eye.add(pupil);
      head.add(eye);
      this.eyes.push(eye);
      this.pupils.push(pupil);
      const brow = mesh(new THREE.BoxGeometry(0.15, 0.035, 0.03), mat(look.browColor ?? look.hairColor ?? 0x2b1d14), { cast: false });
      brow.position.set(sx * 0.14, 0.17, 0.38);
      brow.userData.side = sx;
      head.add(brow);
      this.brows.push(brow);
    }
    const nose = mesh(new THREE.SphereGeometry(0.05, 8, 6), smooth(new THREE.Color(look.skin).multiplyScalar(0.9).getHex()), { cast: false });
    nose.position.set(0, -0.04, 0.41);
    head.add(nose);
    this.mouth = mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x5a1e2a, { flat: false }), { cast: false });
    this.mouth.position.set(0, -0.18, 0.37);
    this.mouth.scale.set(0.09, 0.03, 0.03);
    head.add(this.mouth);
    if (look.glasses) {
      const frame = mat(look.glasses === 'gold' ? 0xd4a017 : 0x1b1b1f, { metal: 0.5, rough: 0.3 });
      for (const sx of [-1, 1]) {
        const ring = mesh(look.glasses === 'square' ? new THREE.TorusGeometry(0.1, 0.016, 4, 4) : new THREE.TorusGeometry(0.1, 0.014, 6, 16), frame, { cast: false });
        if (look.glasses === 'square') ring.rotation.z = Math.PI / 4;
        ring.position.set(sx * 0.14, 0.05, 0.4);
        head.add(ring);
      }
      const bridge = mesh(new THREE.BoxGeometry(0.08, 0.015, 0.015), frame, { cast: false });
      bridge.position.set(0, 0.07, 0.41);
      head.add(bridge);
    }
    if (look.beard) {
      const beard = mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.5), mat(look.beard));
      beard.position.set(0, -0.02, 0.03);
      beard.scale.set(1.02, 1.05, 1.05);
      head.add(beard);
    }
    if (look.mustache) {
      const m = mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 8), mat(look.mustache));
      m.rotation.z = Math.PI / 2;
      m.position.set(0, -0.1, 0.4);
      head.add(m);
    }
    if (look.blush) {
      for (const sx of [-1, 1]) {
        const b = mesh(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.5 }), { cast: false });
        b.position.set(sx * 0.25, -0.07, 0.355);
        b.rotation.y = sx * 0.55;
        head.add(b);
      }
    }
  }

  buildHair(head, look) {
    const hm = mat(look.hairColor ?? 0x3b2a1a);
    const cap = (thetaLen = Math.PI * 0.45, scale = 1.06) => {
      const m = mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, TAU, 0, thetaLen), hm);
      m.scale.setScalar(scale);
      m.rotation.x = -0.25;
      head.add(m);
      return m;
    };
    switch (look.hair) {
      case 'messy': {
        cap();
        for (let i = 0; i < 9; i++) {
          const tuft = mesh(new THREE.IcosahedronGeometry(0.14, 0), hm);
          const a = (i / 9) * TAU;
          tuft.position.set(Math.cos(a) * 0.25, 0.32 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.2 - 0.05);
          tuft.rotation.set(i, i * 2, 0);
          head.add(tuft);
        }
        break;
      }
      case 'spiky': {
        cap(Math.PI * 0.35);
        for (let i = 0; i < 7; i++) {
          const spike = mesh(new THREE.ConeGeometry(0.08, 0.3, 5), hm);
          const a = (i / 7) * Math.PI - Math.PI;
          spike.position.set(Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.15 + 0.05);
          spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          head.add(spike);
        }
        break;
      }
      case 'bob': {
        cap(Math.PI * 0.5, 1.08);
        for (const sx of [-1, 1]) {
          const side = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 8), hm);
          side.position.set(sx * 0.33, -0.08, -0.05);
          head.add(side);
        }
        const back = mesh(new THREE.SphereGeometry(0.42, 14, 10), hm);
        back.scale.set(1.05, 0.9, 0.7);
        back.position.set(0, -0.05, -0.15);
        head.add(back);
        const bangs = mesh(new THREE.BoxGeometry(0.62, 0.12, 0.12), hm);
        bangs.position.set(0, 0.27, 0.3);
        bangs.rotation.x = 0.4;
        head.add(bangs);
        break;
      }
      case 'bun': {
        cap(Math.PI * 0.48, 1.07);
        const bun = mesh(new THREE.SphereGeometry(0.17, 12, 10), hm);
        bun.position.set(0, 0.48, -0.12);
        head.add(bun);
        break;
      }
      case 'ponytail': {
        cap(Math.PI * 0.48, 1.07);
        const tail = mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), hm);
        tail.position.set(0, -0.05, -0.45);
        tail.rotation.x = 0.4;
        head.add(tail);
        break;
      }
      case 'slick': {
        const c = cap(Math.PI * 0.42, 1.05);
        c.rotation.x = -0.15;
        const wave = mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), hm);
        wave.rotation.z = Math.PI / 2;
        wave.position.set(0.05, 0.36, 0.2);
        head.add(wave);
        break;
      }
      case 'side': {
        cap(Math.PI * 0.45, 1.07);
        const part = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), hm);
        part.rotation.set(0.3, 0, Math.PI / 2 + 0.3);
        part.position.set(-0.1, 0.33, 0.22);
        head.add(part);
        break;
      }
      case 'bald': {
        for (const sx of [-1, 1]) {
          const side = mesh(new THREE.SphereGeometry(0.16, 10, 8), hm);
          side.scale.set(0.5, 0.8, 1.2);
          side.position.set(sx * 0.37, 0.02, -0.08);
          head.add(side);
        }
        const back = mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, TAU, Math.PI * 0.4, Math.PI * 0.3), hm);
        back.scale.setScalar(1.04);
        back.rotation.x = 0.5;
        head.add(back);
        break;
      }
      default:
        break;
    }
  }

  buildHeadExtras(head, look) {
    if (look.headphones) {
      const band = mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 20, Math.PI), mat(look.headphones));
      band.rotation.z = 0;
      band.position.y = 0.05;
      head.add(band);
      for (const sx of [-1, 1]) {
        const cup = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), mat(look.headphones));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(sx * 0.45, 0.02, 0);
        head.add(cup);
      }
    }
    if (look.beanie) {
      const b = mesh(new THREE.SphereGeometry(0.44, 16, 10, 0, TAU, 0, Math.PI * 0.42), mat(look.beanie));
      b.position.y = 0.04;
      head.add(b);
      const rim = mesh(new THREE.TorusGeometry(0.41, 0.06, 6, 20), mat(look.beanie));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.17;
      head.add(rim);
      const pom = mesh(new THREE.IcosahedronGeometry(0.1, 1), mat(0xffffff));
      pom.position.y = 0.5;
      head.add(pom);
    }
    if (look.earbuds) {
      for (const sx of [-1, 1]) {
        const bud = mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 6), mat(0xffffff));
        bud.position.set(sx * 0.43, -0.05, 0.02);
        head.add(bud);
      }
    }
  }

  setProp(kind) {
    if (this.prop) this.j.lHand.remove(this.prop);
    this.prop = makeHandProp(kind);
    if (this.prop) {
      this.prop.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      this.j.lHand.add(this.prop);
    }
  }

  // Facial expression: normal | effort | hurt | ko | happy | smug
  setExpression(name) {
    const e = {
      normal: { eye: 1, pupil: 1, brow: -0.25, browY: 0, mw: 0.09, mh: 0.025 },
      effort: { eye: 0.8, pupil: 1, brow: -0.5, browY: -0.02, mw: 0.12, mh: 0.05 },
      hurt: { eye: 0.3, pupil: 0.6, brow: 0.45, browY: 0.04, mw: 0.08, mh: 0.09 },
      ko: { eye: 0.12, pupil: 0, brow: 0.3, browY: 0.02, mw: 0.1, mh: 0.06 },
      happy: { eye: 0.55, pupil: 1, brow: 0.2, browY: 0.04, mw: 0.13, mh: 0.07 },
      smug: { eye: 0.6, pupil: 1, brow: -0.1, browY: 0.02, mw: 0.11, mh: 0.02 },
      shock: { eye: 1.35, pupil: 0.5, brow: 0.5, browY: 0.08, mw: 0.08, mh: 0.11 },
    }[name] ?? null;
    if (!e) return;
    for (const eye of this.eyes) eye.scale.set(1, e.eye, 1);
    for (const p of this.pupils) p.scale.setScalar(Math.max(0.01, e.pupil));
    for (const b of this.brows) {
      b.rotation.z = b.userData.side * e.brow;
      b.position.y = 0.17 + e.browY;
    }
    this.mouth.scale.set(e.mw, e.mh, 0.03);
  }

  // Pose positions back to the bind pose (positions only; rotations come from the animator).
  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}

// Little things characters carry in their left hand.
export function makeHandProp(kind) {
  const g = new THREE.Group();
  const add = (geo, material, x = 0, y = 0, z = 0) => {
    const m = mesh(geo, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  switch (kind) {
    case 'energyDrink':
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10), mat(0x2ee66b, { metal: 0.6, rough: 0.3 }), 0, -0.12, 0.05);
      add(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 10), mat(0x111111), 0, -0.12, 0.05);
      break;
    case 'mug':
      add(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 12), mat(0xffffff, { rough: 0.3 }), 0, -0.1, 0.1);
      add(new THREE.TorusGeometry(0.05, 0.015, 5, 10), mat(0xffffff), 0.1, -0.1, 0.1).rotation.y = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), mat(0x4a2c14), 0, -0.005, 0.1);
      break;
    case 'clipboard':
      add(new THREE.BoxGeometry(0.28, 0.36, 0.03), mat(0x8a5a3c), 0, -0.15, 0.08);
      add(new THREE.BoxGeometry(0.24, 0.28, 0.035), mat(0xffffff), 0, -0.18, 0.08);
      add(new THREE.BoxGeometry(0.1, 0.05, 0.05), mat(0xb8c2cc, { metal: 0.7 }), 0, 0.02, 0.08);
      break;
    case 'magnifier': {
      add(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), mat(0x3b2412), 0, -0.1, 0.05);
      const ring = add(new THREE.TorusGeometry(0.11, 0.025, 6, 16), mat(0x333333, { metal: 0.6 }), 0, -0.3, 0.05);
      ring.rotation.y = Math.PI / 2;
      const glass = add(new THREE.CircleGeometry(0.1, 16), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5 }), 0, -0.3, 0.05);
      glass.rotation.y = Math.PI / 2;
      break;
    }
    case 'phone':
      add(new THREE.BoxGeometry(0.12, 0.24, 0.02), mat(0x1b1b1f, { rough: 0.2 }), 0, -0.12, 0.08);
      add(new THREE.PlaneGeometry(0.1, 0.2), new THREE.MeshBasicMaterial({ color: 0x7fd6ff }), 0, -0.12, 0.092);
      break;
    case 'stickyPad':
      add(new THREE.BoxGeometry(0.2, 0.2, 0.06), mat(0xffe14d), 0, -0.1, 0.08);
      break;
    case 'coffeeTray': {
      add(new THREE.BoxGeometry(0.4, 0.04, 0.3), mat(0xa0784a), 0, -0.1, 0.12);
      for (const [x, z] of [[-0.1, 0.05], [0.1, 0.05], [-0.1, 0.19], [0.1, 0.19]]) add(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 8), mat(0xffffff), x, -0.02, z);
      break;
    }
    case 'pen':
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6), mat(0xffc93c, { metal: 0.9, rough: 0.2 }), 0, -0.1, 0.06);
      break;
    default:
      return null;
  }
  return g;
}
