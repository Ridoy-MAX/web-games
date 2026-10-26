import * as THREE from 'three';
import { mat, mesh } from '../utils/materials.js';
import { TAU } from '../utils/math.js';

const texCache = new Map();
function labelTexture(text, { bg = null, fg = '#ffffff', stroke = '#1b1b2f', size = 64, w = 256, h = 128 } = {}) {
  const key = [text, bg, fg, stroke, size, w, h].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.font = `bold ${size}px "Lilita One", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineWidth = size * 0.16;
    g.strokeStyle = stroke;
    g.strokeText(text, w / 2, h / 2);
  }
  g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

export function label(text, opts = {}, scale = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, opts), depthTest: false, transparent: true }));
  sprite.scale.set(1.2 * scale, 0.6 * scale, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

function at(m, x, y, z) {
  m.position.set(x, y, z);
  return m;
}

const BUILDERS = {
  clipboard() {
    const g = group(
      mesh(new THREE.BoxGeometry(0.5, 0.62, 0.05), mat(0x8a5a3c)),
      at(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.06), mat(0xffffff)), 0, -0.03, 0),
      at(mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), mat(0xb8c2cc, { metal: 0.7 })), 0, 0.3, 0),
    );
    const l = label('Ctrl+V', { fg: '#7ef0c0' }, 0.9);
    l.position.y = 0.55;
    g.add(l);
    return g;
  },
  clipboardSpin() {
    return group(mesh(new THREE.BoxGeometry(0.6, 0.06, 0.45), mat(0x8a5a3c)), at(mesh(new THREE.BoxGeometry(0.5, 0.07, 0.35), mat(0xffffff)), 0, 0.01, 0));
  },
  redX() {
    const red = mat(0xe63946, { emissive: 0x5a0010, emissiveIntensity: 0.6 });
    const a = mesh(new THREE.BoxGeometry(0.95, 0.2, 0.15), red);
    a.rotation.z = Math.PI / 4;
    const b = mesh(new THREE.BoxGeometry(0.95, 0.2, 0.15), red);
    b.rotation.z = -Math.PI / 4;
    const l = label('CHANGES REQUESTED', { fg: '#ffd6de', size: 40, w: 512 }, 1.1);
    l.scale.set(2.2, 0.55, 1);
    l.position.y = 0.75;
    return group(a, b, l);
  },
  bug() {
    const g = group(at(mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x2d6a4f, { rough: 0.3 })), 0, 0.1, 0));
    g.children[0].scale.set(1.3, 0.7, 1);
    const head = at(mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0x1b1b1f)), 0.25, 0.12, 0);
    g.add(head);
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const leg = at(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), mat(0x111111)), -0.1 + i * 0.1, 0.04, s * 0.14);
        leg.rotation.x = s * 1.1;
        g.add(leg);
      }
    }
    for (const s of [-1, 1]) {
      const eye = at(mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(0xff3b3b, { emissive: 0xff0000 })), 0.33, 0.16, s * 0.05);
      g.add(eye);
    }
    return g;
  },
  pamphlet() {
    const g = group(
      mesh(new THREE.BoxGeometry(0.5, 0.65, 0.04), mat(0x3a86ff)),
      at(mesh(new THREE.BoxGeometry(0.4, 0.08, 0.05), mat(0xffffff)), 0, 0.15, 0),
      at(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), mat(0xffffff)), 0, 0, 0),
    );
    const l = label('TRAINING', { fg: '#cfe5ff', size: 52 }, 0.85);
    l.position.y = 0.6;
    g.add(l);
    return g;
  },
  scope() {
    const bubble = mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff8fab, transparent: true, opacity: 0.6, roughness: 0.2, emissive: 0x6a1030 }));
    const l = label('+1 FEATURE', { fg: '#fff', size: 46 }, 0.9);
    l.position.y = 0;
    return group(bubble, l);
  },
  coffee() {
    return group(
      mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 10), mat(0xffffff)),
      at(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10), mat(0x2b2b2b)), 0, 0.19, 0),
      at(mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.1, 10), mat(0x00704a)), 0, 0, 0),
    );
  },
  briefcase() {
    const g = group(
      mesh(new THREE.BoxGeometry(0.75, 0.52, 0.22), mat(0x6b3a1f, { rough: 0.5 })),
      at(mesh(new THREE.TorusGeometry(0.12, 0.03, 5, 10, Math.PI), mat(0x3a2010)), 0, 0.26, 0),
      at(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), mat(0xffc93c, { metal: 0.9, rough: 0.2 })), -0.2, 0.12, 0),
      at(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), mat(0xffc93c, { metal: 0.9, rough: 0.2 })), 0.2, 0.12, 0),
    );
    const l = label('LAYOFFS', { fg: '#ffd6a0', size: 52 }, 0.85);
    l.position.y = 0.6;
    g.add(l);
    return g;
  },
  pinkSlip() {
    const m = mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshStandardMaterial({ map: labelTexture('FIRED', { bg: '#ff8fab', fg: '#7a0b2a', stroke: null, size: 70 }), side: THREE.DoubleSide }));
    return group(m);
  },
  sticky() {
    const colors = ['#ffe14d', '#7ef0c0', '#ff8fab', '#9ccfff'];
    const words = ['BLOCKER', 'TECH DEBT', 'MORE MTGS', 'WHY?', 'OOPS'];
    const m = mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshStandardMaterial({ map: labelTexture(words[Math.floor(Math.random() * words.length)], { bg: colors[Math.floor(Math.random() * colors.length)], fg: '#333', stroke: null, size: 34, w: 256, h: 256 }), side: THREE.DoubleSide }),
    );
    return group(m);
  },
  email() {
    const env = mesh(new THREE.BoxGeometry(0.6, 0.4, 0.04), mat(0xffffff));
    const flap = mesh(new THREE.ConeGeometry(0.33, 0.2, 4), mat(0xdfe6ee));
    flap.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    flap.scale.set(1.3, 1, 0.3);
    flap.position.set(0, 0.08, 0.03);
    const l = label('RE: RE:', { fg: '#e63946', size: 54 }, 0.7);
    l.position.y = 0.4;
    return group(env, flap, l);
  },
  pushWave() {
    const ring = mesh(new THREE.TorusGeometry(1.1, 0.22, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7ef0c0, emissive: 0x2ee6a6, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 }));
    ring.rotation.set(0, Math.PI / 2, Math.PI / 2);
    ring.position.y = 1.1;
    const l = label('--force', { fg: '#c9ffe9', size: 64 }, 1.3);
    l.position.y = 2.5;
    return group(ring, l);
  },
  roadmap() {
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fffdf6';
      g.fillRect(0, 0, 256, 128);
      const cols = ['#3a86ff', '#ff006e', '#ffbe0b', '#8338ec', '#06d6a0'];
      for (let i = 0; i < 6; i++) {
        g.fillStyle = cols[i % cols.length];
        g.fillRect(10 + i * 30, 10 + i * 18, 90, 12);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const roll = mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 18), [new THREE.MeshStandardMaterial({ map: tex }), mat(0xe8d9b5), mat(0xe8d9b5)]);
    roll.rotation.x = Math.PI / 2;
    roll.position.y = 1.0;
    const l = label('Q4 ROADMAP', { fg: '#ffe066', size: 54 }, 1.2);
    l.position.y = 2.4;
    const g = group(roll, l);
    g.userData.roll = roll;
    return g;
  },
  crab() {
    const orange = mat(0xff6b1a, { rough: 0.5 });
    const g = group();
    const shell = mesh(new THREE.SphereGeometry(1.0, 16, 10), orange);
    shell.scale.set(1.4, 0.6, 1);
    shell.position.y = 0.9;
    g.add(shell);
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), orange);
      arm.rotation.z = s * 1.0;
      arm.position.set(s * 1.4, 1.2, 0.3);
      g.add(arm);
      const claw = mesh(new THREE.SphereGeometry(0.4, 10, 8), orange);
      claw.scale.set(1, 0.6, 0.6);
      claw.position.set(s * 1.85, 1.6, 0.4);
      g.add(claw);
      const stalk = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), orange);
      stalk.position.set(s * 0.3, 1.5, 0.5);
      g.add(stalk);
      const eye = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0x111111));
      eye.position.set(s * 0.3, 1.75, 0.5);
      g.add(eye);
      for (let i = 0; i < 3; i++) {
        const leg = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), orange);
        leg.rotation.z = s * 0.7;
        leg.position.set(s * 1.0, 0.45, -0.4 + i * 0.4);
        g.add(leg);
      }
    }
    const l = label('🦀 RUST', { fg: '#ffd0b0', size: 64 }, 1.4);
    l.position.y = 2.6;
    g.add(l);
    return g;
  },
  chair() {
    const g = group();
    const seat = mesh(new THREE.BoxGeometry(0.75, 0.12, 0.7), mat(0x2b2d42));
    seat.position.y = 0.55;
    const back = mesh(new THREE.BoxGeometry(0.75, 0.8, 0.1), mat(0x2b2d42));
    back.position.set(0, 1.0, -0.33);
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0x8d99ae, { metal: 0.7 }));
    pole.position.y = 0.3;
    g.add(seat, back, pole);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const leg = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.06), mat(0x8d99ae, { metal: 0.7 }));
      leg.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
      leg.rotation.y = -a;
      const wheel = mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0x111111));
      wheel.position.set(Math.cos(a) * 0.4, 0.05, Math.sin(a) * 0.4);
      g.add(leg, wheel);
    }
    return g;
  },
  parachute() {
    const canopy = mesh(new THREE.SphereGeometry(1.8, 14, 6, 0, TAU, 0, Math.PI / 2), mat(0xffc93c, { metal: 0.6, rough: 0.3 }));
    canopy.scale.y = 0.55;
    canopy.position.y = 4.4;
    const g = group(canopy);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const line = mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 3), mat(0xffffff), { cast: false });
      line.position.set(Math.cos(a) * 0.8, 3.3, Math.sin(a) * 0.8);
      line.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(line);
    }
    return g;
  },
  sign404() {
    const board = mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshStandardMaterial({ map: labelTexture('404 NOT FOUND', { bg: '#1b1b2f', fg: '#ff5c7a', stroke: null, size: 40, w: 512, h: 256 }), side: THREE.DoubleSide }));
    board.position.y = 1.2;
    const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), mat(0x8d99ae));
    post.position.y = 0.35;
    return group(board, post);
  },
};

export function makeProp(kind) {
  const g = BUILDERS[kind]?.() ?? new THREE.Group();
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
