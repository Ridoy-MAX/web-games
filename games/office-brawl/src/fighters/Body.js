import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU } from '../utils/math.js';

// Characters are modelled in real-world metres (about 1.8 m tall) and scaled up
// to game units so gameplay sizes stay the same.
export const WORLD_SCALE = 1.36;
export const BODY_HEIGHT = 1.81 * WORLD_SCALE;
const ANKLE = 0.045;

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

// --- procedural textures (shared) ----------------------------------------------

const texCache = new Map();
function cachedTexture(key, w, h, draw, repeat) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const noiseTex = (key, scale, repeat) =>
  cachedTexture(key, 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 128 + (Math.random() - 0.5) * scale;
      img.data.set([v, v, v, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
  }, repeat);

// Diagonal twill (denim / trousers).
const twillTex = () =>
  cachedTexture('twill', 128, 128, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (let i = -h; i < w; i += 6) {
      g.beginPath();
      g.moveTo(i, h);
      g.lineTo(i + h, 0);
      g.stroke();
    }
  }, [6, 6]);

// Knit / cotton weave.
const knitTex = () =>
  cachedTexture('knit', 128, 128, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        g.fillStyle = `rgba(${(x + y) % 8 ? 255 : 0},${(x + y) % 8 ? 255 : 0},${(x + y) % 8 ? 255 : 0},0.25)`;
        g.fillRect(x, y, 3, 3);
      }
    }
  }, [8, 8]);

// Hair strands.
const strandTex = () =>
  cachedTexture('strands', 256, 256, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.15 + Math.random() * 0.3})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 3, h);
      g.stroke();
    }
  }, [3, 3]);

const plaidTex = (base, line) =>
  cachedTexture(`plaid-${base}-${line}`, 256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.5;
    g.fillStyle = line;
    for (let i = 0; i < w; i += 64) {
      g.fillRect(i, 0, 22, h);
      g.fillRect(0, i, w, 22);
    }
    g.globalAlpha = 0.25;
    g.fillStyle = '#fff';
    for (let i = 40; i < w; i += 64) {
      g.fillRect(i, 0, 3, h);
      g.fillRect(0, i, w, 3);
    }
  }, [3, 3]);

// --- materials (shared, never disposed per character) -------------------------------

const matCache = new Map();
function shared(key, make) {
  if (!matCache.has(key)) {
    const m = make();
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return matCache.get(key);
}

export const skinMat = (color) =>
  shared(`skin-${color}`, () =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.52,
      sheen: 0.5,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0xff8f70),
      clearcoat: 0.06,
      clearcoatRoughness: 0.6,
      bumpMap: noiseTex('pores', 40, [6, 6]),
      bumpScale: 0.25,
    }),
  );

const clothMat = (color, kind = 'cotton') =>
  shared(`cloth-${color}-${kind}`, () => {
    const opts = { color, roughness: kind === 'wool' ? 0.92 : 0.86, metalness: 0 };
    if (kind === 'denim' || kind === 'wool') {
      opts.bumpMap = twillTex();
      opts.bumpScale = 0.6;
    } else if (kind === 'knit') {
      opts.bumpMap = knitTex();
      opts.bumpScale = 0.8;
    } else {
      opts.bumpMap = noiseTex('cotton', 60, [10, 10]);
      opts.bumpScale = 0.35;
    }
    return new THREE.MeshStandardMaterial(opts);
  });

const plaidMat = (base, line) =>
  shared(`plaid-${base}`, () => new THREE.MeshStandardMaterial({ map: plaidTex(base, line), roughness: 0.9, bumpMap: twillTex(), bumpScale: 0.5 }));

const hairMat = (color) =>
  shared(`hair-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, bumpMap: strandTex(), bumpScale: 1.2 }));

const plain = (color, rough = 0.6, metal = 0) => shared(`plain-${color}-${rough}-${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));

const glossy = (color) => shared(`gloss-${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 }));

// --- geometry helpers -------------------------------------------------------------------

function m(geo, material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// A limb that tapers from r1 at the joint (y = 0) to r2 at y = -len, with rounded ends.
function limb(r1, r2, len, segs = 14) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r2, -len - Math.cos(a) * r2 * 0.7));
  }
  for (let i = 6; i >= 0; i--) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r1, Math.cos(a) * r1 * 0.7));
  }
  return new THREE.LatheGeometry(pts, segs);
}

// Torso from a radius profile [[y, r], ...] with an elliptical cross-section.
function profile(points, sx, sz, segs = 22) {
  const geo = new THREE.LatheGeometry(points.map(([y, r]) => new THREE.Vector2(r, y)), segs);
  geo.scale(sx, 1, sz);
  geo.computeVertexNormals();
  return geo;
}

// A realistic office worker with the same joint hierarchy the animator expects:
// root > body > hips > spine > chest > neck > head, two-segment arms and legs.
export class Body {
  constructor(look) {
    this.look = look;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.worldScale = WORLD_SCALE * (look.scale ?? 1);
    this.body.scale.setScalar(this.worldScale);

    const W = look.width ?? 1;
    const belly = look.belly ?? 0;
    const skin = skinMat(look.skin);
    this.skin = skin;
    const pantsKind = look.jeans ? 'denim' : 'wool';
    const pants = clothMat(look.pants, pantsKind);
    const top = look.top === 'flannel' ? plaidMat(look.topHex ?? '#a52a2a', '#1f1f1f') : clothMat(look.topColor, look.top === 'cardigan' || look.top === 'hoodie' ? 'knit' : look.top === 'suit' || look.top === 'blazer' ? 'wool' : 'cotton');
    const shirt = clothMat(look.shirt ?? look.topColor, 'cotton');
    const sleeve = ['blazer', 'suit', 'cardigan', 'hoodie', 'flannel'].includes(look.top) ? top : shirt;

    const j = {};
    this.j = j;
    j.hips = new THREE.Group();
    j.hips.position.y = 0.97;
    this.body.add(j.hips);
    j.hips.add(m(profile([[-0.12, 0.001], [-0.1, 0.12], [-0.05, 0.155], [0.02, 0.16], [0.08, 0.15], [0.1, 0.001]], 1.05 * W, 0.72), pants));
    if (look.belt !== false) j.hips.add(m(new THREE.CylinderGeometry(0.162 * W, 0.162 * W, 0.04, 24).scale(1.05, 1, 0.74), plain(0x2a1e14, 0.35), 0, 0.07, 0));

    // --- torso ---------------------------------------------------------------
    j.spine = new THREE.Group();
    j.spine.position.y = 0.07;
    j.hips.add(j.spine);
    j.spine.add(m(profile([[0, 0.15], [0.1, 0.14 + belly * 0.05], [0.2, 0.15 + belly * 0.04]], 1.08 * W, 0.74 + belly * 0.25), top));
    if (belly) j.spine.add(m(new THREE.SphereGeometry(0.13, 20, 14).scale(1.1 * W, 0.9, 0.9), top, 0, 0.09, 0.06 + belly * 0.03));
    j.chest = new THREE.Group();
    j.chest.position.y = 0.2;
    j.spine.add(j.chest);
    this.chestMesh = m(
      profile([[-0.02, 0.15 + belly * 0.03], [0.08, 0.165], [0.17, 0.17], [0.23, 0.155], [0.27, 0.11], [0.29, 0.05], [0.3, 0.001]], 1.13 * W, 0.7 + belly * 0.12),
      top,
    );
    j.chest.add(this.chestMesh);
    this.addTop(j.chest, look, top, shirt, W);

    // --- head ----------------------------------------------------------------
    j.neck = new THREE.Group();
    j.neck.position.y = 0.26;
    j.chest.add(j.neck);
    j.neck.add(m(new THREE.CylinderGeometry(0.048, 0.056, 0.12, 14), skin, 0, 0.04, 0));
    j.head = new THREE.Group();
    j.head.position.y = 0.09;
    j.neck.add(j.head);
    this.buildHead(j.head, look, skin);

    // --- arms ----------------------------------------------------------------
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.19 * W, 0.2, -0.01);
      j.chest.add(shoulder);
      shoulder.add(m(new THREE.SphereGeometry(0.055, 16, 12).scale(1, 0.9, 0.95), sleeve));
      shoulder.add(m(limb(0.05, 0.04, 0.27), look.sleeves === 'short' ? skin : sleeve));
      if (look.sleeves === 'short') shoulder.add(m(new THREE.CylinderGeometry(0.062, 0.058, 0.13, 14), sleeve, 0, -0.05, 0));
      const elbow = new THREE.Group();
      elbow.position.y = -0.285;
      shoulder.add(elbow);
      elbow.add(m(limb(0.041, 0.031, 0.24), look.sleeves === 'short' ? skin : sleeve));
      if (look.sleeves !== 'short') elbow.add(m(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 12), sleeve, 0, -0.235, 0));
      const hand = new THREE.Group();
      hand.position.y = -0.26;
      elbow.add(hand);
      this.buildFist(hand, skin, sx);
      j[`${side}Shoulder`] = shoulder;
      j[`${side}Elbow`] = elbow;
      j[`${side}Hand`] = hand;
    }
    if (look.watch) {
      const watch = m(new THREE.TorusGeometry(0.035, 0.009, 8, 20), plain(0xd4a017, 0.25, 0.9), 0, -0.215, 0);
      watch.rotation.x = Math.PI / 2;
      j.rElbow.add(watch);
    }

    // --- legs ----------------------------------------------------------------
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(sx * 0.092 * W, -0.06, 0);
      j.hips.add(hip);
      hip.add(m(limb(0.078 * W, 0.056, 0.43), pants));
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      knee.add(m(limb(0.057, 0.042, 0.4), pants));
      const foot = new THREE.Group();
      foot.position.y = -0.43;
      knee.add(foot);
      this.buildShoe(foot, look);
      j[`${side}Hip`] = hip;
      j[`${side}Knee`] = knee;
      j[`${side}Foot`] = foot;
    }

    this.prop = null;
    if (look.prop) this.setProp(look.prop);
    for (const o of [this.mouthDark, this.upperLip, this.lowerLip, ...this.brows]) o.userData.dynamic = true;
    this.bake(this.root);
    this.rest = {};
    for (const [k, g] of Object.entries(j)) this.rest[k] = g.position.clone();
    this.setExpression('normal');
  }

  buildFist(hand, skin, sx) {
    hand.add(m(new RoundedBoxGeometry(0.075, 0.085, 0.04, 2, 0.015), skin, 0, -0.04, 0));
    // Curled fingers.
    for (let i = 0; i < 4; i++) {
      const f = m(new THREE.CapsuleGeometry(0.0095, 0.025, 4, 8), skin, -0.027 + i * 0.018, -0.088, 0.016);
      f.rotation.x = Math.PI / 2;
      hand.add(f);
    }
    const thumb = m(new THREE.CapsuleGeometry(0.011, 0.03, 4, 8), skin, sx * 0.032, -0.06, 0.02);
    thumb.rotation.z = sx * 0.6;
    hand.add(thumb);
  }

  buildShoe(foot, look) {
    const leather = look.sneakers ? clothMat(look.shoes ?? 0xf2f2f2, 'cotton') : glossy(look.shoes ?? 0x1b1b1b);
    foot.add(m(new RoundedBoxGeometry(0.1, 0.075, 0.27, 3, 0.035), leather, 0, -0.012, 0.055));
    foot.add(m(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 12), leather, 0, 0.02, 0));
    foot.add(m(new RoundedBoxGeometry(0.104, 0.022, 0.275, 2, 0.008), plain(look.sneakers ? 0xffffff : 0x2a1a10, 0.7), 0, -0.048, 0.055));
  }

  addTop(chest, look, top, shirt, W) {
    const front = 0.118 * (1 + (look.belly ?? 0) * 0.15);
    const add = (geo, material, x, y, z) => {
      const o = m(geo, material, x, y, z);
      chest.add(o);
      return o;
    };
    switch (look.top) {
      case 'blazer':
      case 'suit':
      case 'cardigan': {
        // Shirt "V" visible between open lapels.
        const v = new THREE.Shape();
        v.moveTo(-0.055, 0.27);
        v.lineTo(0.055, 0.27);
        v.lineTo(0, 0.05);
        v.closePath();
        add(new THREE.ShapeGeometry(v), shirt, 0, 0, front + 0.005);
        for (const sx of [-1, 1]) {
          const lapel = add(new THREE.BoxGeometry(0.035, 0.16, 0.012), clothMat(look.lapel ?? look.topColor, 'wool'), sx * 0.045, 0.17, front + 0.008);
          lapel.rotation.z = sx * 0.35;
          const collar = add(new THREE.BoxGeometry(0.04, 0.035, 0.03), shirt, sx * 0.035, 0.27, front - 0.02);
          collar.rotation.z = sx * -0.5;
        }
        const buttons = look.top === 'cardigan' ? 4 : 2;
        for (let i = 0; i < buttons; i++) add(new THREE.SphereGeometry(0.007, 8, 6), plain(look.top === 'cardigan' ? 0xe8dcc0 : 0x111111, 0.3), 0, 0.05 - i * 0.06, front + 0.01);
        break;
      }
      case 'hoodie': {
        const hood = m(new THREE.TorusGeometry(0.085, 0.034, 10, 20, Math.PI), clothMat(look.topColor, 'knit'), 0, 0.25, -0.075);
        hood.rotation.set(-1.0, 0, 0);
        chest.add(hood);
        add(new RoundedBoxGeometry(0.2, 0.09, 0.02, 2, 0.01), clothMat(look.topColor, 'knit'), 0, -0.05, front + 0.004);
        for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 6), plain(0xf2f2f2), sx * 0.03, 0.2, front + 0.01);
        break;
      }
      case 'vest': {
        const vest = m(profile([[-0.02, 0.158], [0.08, 0.172], [0.17, 0.177], [0.23, 0.16], [0.25, 0.12]], 1.15 * W, 0.74), shared('hivis', () => new THREE.MeshStandardMaterial({ color: look.vestColor ?? 0xc8ef2e, emissive: 0x2a3300, roughness: 0.7 })));
        chest.add(vest);
        for (const y of [0.04, 0.12]) {
          chest.add(m(new THREE.CylinderGeometry(0.18 * W, 0.18 * W, 0.022, 24, 1, true).scale(1.14, 1, 0.76), plain(0xdfe6ec, 0.2, 0.7), 0, y, 0));
        }
        break;
      }
      case 'fleece': {
        for (const sx of [-1, 1]) {
          const panel = add(new RoundedBoxGeometry(0.15, 0.3, 0.03, 2, 0.01), clothMat(look.vestColor ?? 0x59606b, 'knit'), sx * 0.08, 0.1, front - 0.002);
          panel.rotation.y = sx * 0.25;
        }
        add(new THREE.BoxGeometry(0.008, 0.3, 0.035), plain(0x222222, 0.4), 0, 0.1, front + 0.012);
        break;
      }
      default:
        break;
    }
    if (look.tie) {
      const tieMat = shared(`silk-${look.tie}`, () => new THREE.MeshPhysicalMaterial({ color: look.tie, roughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }));
      add(new RoundedBoxGeometry(0.022, 0.026, 0.014, 2, 0.006), tieMat, 0, 0.255, front + 0.012);
      const blade = new THREE.Shape();
      blade.moveTo(-0.014, 0);
      blade.lineTo(0.014, 0);
      blade.lineTo(0.03, -0.2);
      blade.lineTo(0, -0.23);
      blade.lineTo(-0.03, -0.2);
      blade.closePath();
      add(new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: false }), tieMat, 0, 0.245, front + 0.006);
    }
    if (look.pocketSquare) add(new THREE.BoxGeometry(0.04, 0.02, 0.008), plain(look.pocketSquare, 0.4), -0.09, 0.16, front + 0.004);
    if (look.lanyard) {
      const cord = m(new THREE.TorusGeometry(0.075, 0.004, 4, 20, Math.PI), plain(look.lanyard, 0.5), 0, 0.24, front - 0.01);
      cord.rotation.z = Math.PI;
      chest.add(cord);
      add(new RoundedBoxGeometry(0.055, 0.075, 0.006, 1, 0.003), plain(0xffffff, 0.3), 0, 0.14, front + 0.008);
    }
  }

  buildHead(head, look, skin) {
    const H = new THREE.Group();
    H.position.y = 0.105;
    head.add(H);
    this.face = H;
    // Skull + jaw + cheekbones form one smooth head shape.
    H.add(m(new THREE.SphereGeometry(0.1, 32, 24).scale(0.86, 1.08, 1.0), skin));
    H.add(m(new THREE.SphereGeometry(0.074, 24, 18).scale(0.9, 0.82, 1.0), skin, 0, -0.056, 0.02));
    for (const sx of [-1, 1]) H.add(m(new THREE.SphereGeometry(0.026, 12, 10).scale(1, 0.8, 0.8), skin, sx * 0.046, -0.006, 0.058));
    // Ears.
    for (const sx of [-1, 1]) {
      const ear = m(new THREE.SphereGeometry(0.024, 12, 10).scale(0.45, 1, 0.72), skin, sx * 0.086, -0.005, -0.005);
      H.add(ear);
    }
    // Nose.
    const nose = m(new THREE.ConeGeometry(0.0125, 0.042, 12).rotateX(Math.PI / 2 - 0.4), skin, 0, -0.01, 0.097);
    H.add(nose);
    H.add(m(new THREE.SphereGeometry(0.0105, 12, 10), skin, 0, -0.026, 0.109));
    for (const sx of [-1, 1]) H.add(m(new THREE.SphereGeometry(0.0068, 8, 6), skin, sx * 0.0105, -0.029, 0.103));

    // Eyes with irises and eyelids.
    const white = shared('sclera', () => new THREE.MeshPhysicalMaterial({ color: 0xf4f1ec, roughness: 0.15, clearcoat: 1 }));
    const iris = shared(`iris-${look.eyes ?? 0x5a3a22}`, () => new THREE.MeshPhysicalMaterial({ color: look.eyes ?? 0x5a3a22, roughness: 0.2, clearcoat: 1 }));
    const pupil = plain(0x050505, 0.1);
    this.lids = [];
    this.brows = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.033, 0.016, 0.083);
      eye.add(m(new THREE.SphereGeometry(0.0135, 16, 12), white));
      eye.add(m(new THREE.SphereGeometry(0.0072, 12, 10), iris, 0, 0, 0.0085));
      eye.add(m(new THREE.SphereGeometry(0.0038, 8, 6), pupil, 0, 0, 0.0122));
      const lid = new THREE.Group();
      lid.add(m(new THREE.SphereGeometry(0.0146, 16, 8, 0, TAU, 0, Math.PI / 2), skin));
      eye.add(lid);
      this.lids.push(lid);
      H.add(eye);
      const brow = m(new RoundedBoxGeometry(0.032, 0.006, 0.008, 1, 0.003), hairMat(look.browColor ?? look.hairColor ?? 0x2b1d14), sx * 0.034, 0.039, 0.088);
      brow.userData.side = sx;
      H.add(brow);
      this.brows.push(brow);
    }

    // Lips and mouth.
    const lipColor = new THREE.Color(look.skin).lerp(new THREE.Color(0xb34a4a), 0.35).getHex();
    const lips = skinMat(lipColor);
    this.mouthDark = m(new THREE.SphereGeometry(1, 12, 8), plain(0x2a0a0e, 0.8), 0, -0.056, 0.095);
    H.add(this.mouthDark);
    this.upperLip = m(new THREE.CapsuleGeometry(0.0052, 0.026, 4, 10).rotateZ(Math.PI / 2), lips, 0, -0.05, 0.1);
    this.lowerLip = m(new THREE.CapsuleGeometry(0.0062, 0.022, 4, 10).rotateZ(Math.PI / 2), lips, 0, -0.061, 0.098);
    H.add(this.upperLip, this.lowerLip);

    if (look.beard) {
      const beard = m(new THREE.SphereGeometry(0.098, 24, 16, 0, TAU, Math.PI * 0.5, Math.PI * 0.42).scale(0.9, 1.05, 1.08), hairMat(look.beard), 0, -0.012, 0.012);
      H.add(beard);
    }
    if (look.mustache) {
      for (const sx of [-1, 1]) {
        const half = m(new THREE.CapsuleGeometry(0.008, 0.024, 4, 8).rotateZ(Math.PI / 2 + sx * 0.25), hairMat(look.mustache), sx * 0.014, -0.04, 0.1);
        H.add(half);
      }
    }
    this.buildHair(H, look);
    this.buildHeadExtras(H, look);
  }

  buildHair(H, look) {
    const hm = hairMat(look.hairColor ?? 0x2b1d14);
    const cap = (theta = Math.PI * 0.52, r = 0.103, sy = 1.1) => {
      const c = m(new THREE.SphereGeometry(r, 28, 18, 0, TAU, 0, theta).scale(0.9, sy, 1.03), hm);
      c.rotation.x = -0.28;
      c.position.set(0, 0.006, -0.006);
      H.add(c);
      return c;
    };
    const lump = (r, x, y, z, sx = 1, sy = 1, sz = 1) => H.add(m(new THREE.IcosahedronGeometry(r, 2).scale(sx, sy, sz), hm, x, y, z));
    switch (look.hair) {
      case 'messy':
        cap();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          lump(0.03, Math.cos(a) * 0.05, 0.095 + Math.sin(i * 2.1) * 0.01, Math.sin(a) * 0.05 - 0.01, 1.2, 0.7, 1);
        }
        break;
      case 'spiky':
        cap(Math.PI * 0.45);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const s = m(new THREE.ConeGeometry(0.014, 0.05, 6), hm, Math.cos(a) * 0.045, 0.11, Math.sin(a) * 0.045);
          s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          H.add(s);
        }
        break;
      case 'bob': {
        cap(Math.PI * 0.55, 0.108, 1.12);
        for (const sx of [-1, 1]) H.add(m(new THREE.CapsuleGeometry(0.033, 0.09, 6, 12), hm, sx * 0.083, -0.03, -0.012));
        H.add(m(new THREE.SphereGeometry(0.1, 20, 14).scale(0.96, 0.95, 0.7), hm, 0, -0.012, -0.038));
        const fringe = cap(Math.PI * 0.3, 0.106, 1.08);
        fringe.rotation.set(0.42, 0, 0.18);
        break;
      }
      case 'bun':
        cap(Math.PI * 0.53, 0.106);
        lump(0.035, 0, 0.11, -0.065);
        break;
      case 'ponytail': {
        cap(Math.PI * 0.53, 0.106);
        const tail = m(new THREE.CapsuleGeometry(0.022, 0.13, 6, 12), hm, 0, -0.01, -0.115);
        tail.rotation.x = 0.35;
        H.add(tail);
        break;
      }
      case 'slick': {
        const c = cap(Math.PI * 0.44, 0.1015, 1.07);
        c.rotation.x = -0.32;
        const wave = m(new THREE.CapsuleGeometry(0.012, 0.07, 6, 12).rotateZ(Math.PI / 2 + 0.2), hm, 0.01, 0.092, 0.03);
        H.add(wave);
        break;
      }
      case 'side': {
        cap(Math.PI * 0.5, 0.105);
        const part = m(new THREE.CapsuleGeometry(0.024, 0.09, 6, 12).rotateZ(Math.PI / 2 + 0.3), hm, -0.018, 0.088, 0.045);
        H.add(part);
        break;
      }
      case 'bald': {
        const ring = m(new THREE.SphereGeometry(0.103, 28, 12, 0, TAU, Math.PI * 0.42, Math.PI * 0.22).scale(0.9, 1.08, 1.04), hm);
        ring.rotation.x = 0.55;
        H.add(ring);
        break;
      }
      default:
        break;
    }
  }

  buildHeadExtras(H, look) {
    if (look.glasses) {
      const frame = plain(look.glasses === 'gold' ? 0xd4a017 : 0x151515, 0.3, look.glasses === 'gold' ? 0.9 : 0.2);
      const lens = shared('lens', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0, transmission: 0.6 }));
      for (const sx of [-1, 1]) {
        const ring = m(look.glasses === 'square' ? new THREE.TorusGeometry(0.02, 0.0028, 6, 4) : new THREE.TorusGeometry(0.019, 0.0024, 8, 24), frame, sx * 0.034, 0.016, 0.094);
        if (look.glasses === 'square') ring.rotation.z = Math.PI / 4;
        H.add(ring);
        H.add(m(new THREE.CircleGeometry(0.018, 16), lens, sx * 0.034, 0.016, 0.0935));
        const arm = m(new THREE.BoxGeometry(0.003, 0.003, 0.09), frame, sx * 0.055, 0.018, 0.05);
        H.add(arm);
      }
      H.add(m(new THREE.BoxGeometry(0.018, 0.003, 0.003), frame, 0, 0.022, 0.097));
    }
    if (look.headphones) {
      const band = m(new THREE.TorusGeometry(0.1, 0.009, 8, 24, Math.PI), plain(look.headphones, 0.4), 0, 0.02, -0.005);
      H.add(band);
      for (const sx of [-1, 1]) {
        const cup = m(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 18).rotateZ(Math.PI / 2), plain(look.headphones, 0.35), sx * 0.09, -0.01, 0);
        H.add(cup);
      }
    }
    if (look.beanie) {
      const knit = clothMat(look.beanie, 'knit');
      const b = m(new THREE.SphereGeometry(0.108, 24, 14, 0, TAU, 0, Math.PI * 0.4).scale(0.92, 1.12, 1.05), knit, 0, 0.03, -0.006);
      b.rotation.x = -0.32;
      H.add(b);
      // Folded brim: an elliptical band matching the skull's cross-section above the brows.
      const fold = m(new THREE.CylinderGeometry(1, 1, 0.026, 32, 1, true).scale(0.083, 1, 0.098), knit, 0, 0.056, -0.004);
      fold.material.side = THREE.DoubleSide;
      fold.rotation.x = -0.18;
      H.add(fold);
    }
    if (look.earbuds) {
      for (const sx of [-1, 1]) H.add(m(new THREE.CapsuleGeometry(0.005, 0.012, 4, 6), plain(0xffffff, 0.2), sx * 0.088, -0.01, 0.005));
    }
  }

  // Merges the static meshes under each joint that share a material into one
  // mesh, cutting draw calls several-fold without changing how anything moves.
  bake(node) {
    const groups = new Map();
    for (const child of [...node.children]) {
      if (child.isMesh && !child.userData.dynamic) {
        if (!groups.has(child.material)) groups.set(child.material, []);
        groups.get(child.material).push(child);
      } else if (!child.isMesh) {
        this.bake(child);
      }
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((o) => {
        o.updateMatrix();
        const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      for (const o of meshes) {
        node.remove(o);
        o.geometry.dispose();
      }
      node.add(m(merged, material));
    }
  }

  setShadows(cast) {
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = cast;
    });
  }

  setProp(kind) {
    if (this.prop) this.j.lHand.remove(this.prop);
    this.prop = makeHandProp(kind);
    if (this.prop) this.j.lHand.add(this.prop);
  }

  // Facial expression: normal | effort | hurt | ko | happy | smug | shock
  setExpression(name) {
    const e = {
      normal: { lid: 0.25, brow: -0.12, browY: 0, open: 0.05, smile: 0 },
      effort: { lid: 0.45, brow: -0.4, browY: -0.003, open: 0.35, smile: -0.1 },
      hurt: { lid: 0.8, brow: 0.45, browY: 0.004, open: 0.6, smile: -0.3 },
      ko: { lid: 1, brow: 0.25, browY: 0.002, open: 0.45, smile: -0.2 },
      happy: { lid: 0.3, brow: 0.2, browY: 0.004, open: 0.35, smile: 0.7 },
      smug: { lid: 0.5, brow: -0.05, browY: 0.002, open: 0.02, smile: 0.4 },
      shock: { lid: 0, brow: 0.55, browY: 0.008, open: 1, smile: 0 },
    }[name];
    if (!e) return;
    // Upper lid hemisphere rotates down over the eyeball.
    for (const lid of this.lids) lid.rotation.x = -1.35 + e.lid * 2.85;
    for (const b of this.brows) {
      b.rotation.z = b.userData.side * e.brow;
      b.position.y = 0.039 + e.browY;
    }
    this.mouthDark.scale.set(0.017 + e.smile * 0.004, 0.0015 + e.open * 0.011, 0.008);
    this.lowerLip.position.y = -0.061 - e.open * 0.009;
    this.upperLip.position.y = -0.05 + e.smile * 0.002;
    this.upperLip.scale.x = this.lowerLip.scale.x = 1 + e.smile * 0.25;
  }

  // Shifts the hips so the lowest foot rests on the ground (no floating or
  // sinking when legs bend into crouches, kicks or stances).
  plantFeet() {
    const b = this.body;
    b.updateWorldMatrix(true, true);
    b.getWorldPosition(v0);
    this.j.lFoot.getWorldPosition(v1);
    this.j.rFoot.getWorldPosition(v2);
    const low = Math.min(v1.y, v2.y) - v0.y;
    this.j.hips.position.y -= (low - ANKLE * this.worldScale) / this.worldScale;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}

// Little things characters carry in their left hand (real-world sizes).
export function makeHandProp(kind) {
  const g = new THREE.Group();
  const add = (geo, material, x = 0, y = 0, z = 0) => {
    const o = m(geo, material, x, y, z);
    g.add(o);
    return o;
  };
  switch (kind) {
    case 'energyDrink':
      add(new THREE.CylinderGeometry(0.033, 0.033, 0.13, 18), plain(0x1fbf5a, 0.25, 0.8), 0, -0.07, 0.04);
      add(new THREE.CylinderGeometry(0.03, 0.033, 0.01, 18), plain(0xc0c0c0, 0.2, 0.9), 0, -0.002, 0.04);
      break;
    case 'mug': {
      add(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 20), glossy(0xf2f2f2), 0, -0.06, 0.06);
      const handle = add(new THREE.TorusGeometry(0.024, 0.007, 8, 16), glossy(0xf2f2f2), 0.045, -0.06, 0.06);
      handle.rotation.y = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.038, 0.038, 0.005, 20), plain(0x3b2412, 0.2), 0, -0.012, 0.06);
      break;
    }
    case 'clipboard':
      add(new THREE.BoxGeometry(0.23, 0.32, 0.008), plain(0x8a5a3c, 0.5), 0, -0.13, 0.05);
      add(new THREE.BoxGeometry(0.21, 0.27, 0.009), plain(0xfafafa, 0.8), 0, -0.15, 0.05);
      add(new THREE.BoxGeometry(0.08, 0.025, 0.02), plain(0xb8c2cc, 0.3, 0.8), 0, 0.02, 0.05);
      break;
    case 'magnifier': {
      add(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 10), plain(0x3b2412, 0.5), 0, -0.07, 0.04);
      const ring = add(new THREE.TorusGeometry(0.045, 0.007, 8, 24), plain(0x333333, 0.3, 0.7), 0, -0.17, 0.04);
      ring.rotation.y = Math.PI / 2;
      const glass = add(new THREE.CircleGeometry(0.043, 24), shared('glass', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0, transmission: 0.8 })), 0, -0.17, 0.04);
      glass.rotation.y = Math.PI / 2;
      break;
    }
    case 'phone':
      add(new RoundedBoxGeometry(0.072, 0.15, 0.009, 2, 0.004), glossy(0x111111), 0, -0.08, 0.05);
      add(new THREE.PlaneGeometry(0.064, 0.138), shared('screen', () => new THREE.MeshBasicMaterial({ color: 0x8fd3ff })), 0, -0.08, 0.0548);
      break;
    case 'stickyPad':
      add(new THREE.BoxGeometry(0.076, 0.076, 0.02), plain(0xffe14d, 0.9), 0, -0.06, 0.05);
      break;
    case 'coffeeTray': {
      add(new THREE.BoxGeometry(0.22, 0.015, 0.16), plain(0xa0784a, 0.9), 0, -0.07, 0.08);
      for (const [x, z] of [[-0.05, 0.04], [0.05, 0.04], [-0.05, 0.12], [0.05, 0.12]]) {
        add(new THREE.CylinderGeometry(0.03, 0.024, 0.1, 14), plain(0xf7f7f7, 0.6), x, -0.01, z);
        add(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 14), plain(0x2b2b2b, 0.5), x, 0.045, z);
      }
      break;
    }
    case 'pen':
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 10), plain(0xd4a017, 0.2, 0.9), 0, -0.06, 0.04);
      break;
    default:
      return null;
  }
  return g;
}
