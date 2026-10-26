import * as THREE from 'three';
import { mat, mesh, textTexture } from '../utils/materials.js';
import { pick, rand } from '../utils/math.js';

const WOOD = 0x8a5a3c;
const STRAW = 0xeac36a;

function box(w, h, d, color, opts) {
  return mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color, opts) : color);
}

// --- Barn ------------------------------------------------------------------

export const BARN = { W: 9, D: 11, H: 4.4, T: 0.4, DOOR: 3.4 };

// Returns the barn group, its liftable roof, local collider boxes and the
// interior (hiding) area. The door faces local +Z.
export function makeBarn(wallColor = 0xc8372d, roofColor = 0x2f6f73) {
  const { W, D, H, T, DOOR } = BARN;
  const group = new THREE.Group();
  const wall = mat(wallColor);
  const trim = mat(0xf3efe6);
  const colliders = [];
  const addWall = (x0, x1, z0, z1, y0 = 0, y1 = H) => {
    const m = box(x1 - x0, y1 - y0, z1 - z0, wall);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
    colliders.push({ min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1) });
  };
  addWall(-W / 2, W / 2, -D / 2, -D / 2 + T); // back
  addWall(-W / 2, -W / 2 + T, -D / 2, D / 2); // left
  addWall(W / 2 - T, W / 2, -D / 2, D / 2); // right
  addWall(-W / 2, -DOOR / 2, D / 2 - T, D / 2); // front left
  addWall(DOOR / 2, W / 2, D / 2 - T, D / 2); // front right
  const lintel = box(DOOR, H - 3.3, T, wall);
  lintel.position.set(0, (H + 3.3) / 2, D / 2 - T / 2);
  group.add(lintel);

  // White trim: corners, door frame and the classic X braces on the open doors.
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
    const post = box(0.5, H + 0.1, 0.5, trim);
    post.position.set(x, H / 2, z);
    group.add(post);
  }
  const frameTop = box(DOOR + 0.6, 0.35, 0.55, trim);
  frameTop.position.set(0, 3.3, D / 2);
  group.add(frameTop);
  for (const s of [-1, 1]) {
    const frame = box(0.35, 3.3, 0.55, trim);
    frame.position.set((s * DOOR) / 2, 1.65, D / 2);
    group.add(frame);
    // Swung-open door panel.
    const door = new THREE.Group();
    const panel = box(DOOR / 2, 3.1, 0.18, wall);
    panel.position.x = (-s * DOOR) / 4;
    door.add(panel);
    const b1 = box(Math.hypot(DOOR / 2, 3.1) - 0.2, 0.18, 0.22, trim);
    b1.rotation.z = Math.atan2(3.1, DOOR / 2) * s;
    b1.position.x = (-s * DOOR) / 4;
    door.add(b1);
    const b2 = b1.clone();
    b2.rotation.z = -b1.rotation.z;
    door.add(b2);
    door.position.set((s * DOOR) / 2, 1.55, D / 2 + 0.1);
    door.rotation.y = s * 1.75;
    group.add(door);
  }

  // Gambrel roof + gables live in their own group so the UFO can steal it.
  const roof = new THREE.Group();
  roof.position.y = H;
  const roofMat = mat(roofColor).clone();
  const gableMat = wall.clone();
  roof.userData.materials = [roofMat, gableMat];
  const outer = [[-W / 2 - 0.5, -0.05], [-W * 0.36, 1.9], [0, 2.9], [W * 0.36, 1.9], [W / 2 + 0.5, -0.05]];
  const inner = [[W / 2 + 0.05, -0.05], [W * 0.33, 1.55], [0, 2.5], [-W * 0.33, 1.55], [-W / 2 - 0.05, -0.05]];
  const shell = new THREE.Shape();
  shell.moveTo(...outer[0]);
  outer.slice(1).forEach((p) => shell.lineTo(...p));
  inner.forEach((p) => shell.lineTo(...p));
  shell.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(shell, { depth: D + 1, bevelEnabled: false });
  shellGeo.translate(0, 0, -(D + 1) / 2);
  const shellMesh = mesh(shellGeo, roofMat);
  roof.add(shellMesh);
  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(-W * 0.33, 1.55);
  gable.lineTo(0, 2.5);
  gable.lineTo(W * 0.33, 1.55);
  gable.lineTo(W / 2, 0);
  gable.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: T, bevelEnabled: false });
  for (const z of [-D / 2, D / 2 - T]) {
    const g = mesh(gableGeo, gableMat);
    g.position.z = z;
    roof.add(g);
  }
  const hayDoor = box(1.3, 1.1, 0.2, trim);
  hayDoor.position.set(0, 1.0, D / 2 + 0.05);
  roof.add(hayDoor);
  const hayDoorIn = box(0.95, 0.8, 0.22, 0x6b3a22);
  hayDoorIn.position.set(0, 1.0, D / 2 + 0.06);
  roof.add(hayDoorIn);
  // Little rooftop vent with a weathervane rooster.
  const cupola = box(1.3, 1.0, 1.3, trim);
  cupola.position.y = 3.3;
  roof.add(cupola);
  const cap = mesh(new THREE.ConeGeometry(1.15, 0.8, 4), roofMat);
  cap.position.y = 4.2;
  cap.rotation.y = Math.PI / 4;
  roof.add(cap);
  const vane = box(0.06, 1.0, 0.06, 0x333333);
  vane.position.y = 5.0;
  roof.add(vane);
  const arrow = box(0.9, 0.12, 0.05, 0x333333);
  arrow.position.y = 5.3;
  roof.add(arrow);
  group.add(roof);

  const floor = box(W - 0.2, 0.06, D - 0.2, 0xb07a4a);
  floor.position.y = 0.03;
  floor.castShadow = false;
  floor.receiveShadow = true;
  group.add(floor);

  // Hay inside so hiding feels cozy.
  for (let i = 0; i < 3; i++) {
    const bale = makeHayBale();
    bale.position.set(-W / 2 + 1.4 + i * 0.2, 0.55 + (i === 2 ? 1.1 : 0), -D / 2 + 1.4 + (i % 2) * 1.3);
    bale.rotation.y = Math.PI / 2;
    group.add(bale);
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  const interior = { minX: -W / 2 + T, maxX: W / 2 - T, minZ: -D / 2 + T, maxZ: D / 2 - 0.3 };
  return { group, roof, colliders, interior };
}

// --- Other farm props ---------------------------------------------------------

export function makeSilo() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(2.2, 2.2, 8, 14), mat(0xd9dde3, { rough: 0.5, metal: 0.3 }));
  body.position.y = 4;
  g.add(body);
  for (const y of [1.5, 4, 6.5]) {
    const band = mesh(new THREE.CylinderGeometry(2.28, 2.28, 0.25, 14), mat(0x9aa3ad, { metal: 0.4 }));
    band.position.y = y;
    g.add(band);
  }
  const dome = mesh(new THREE.SphereGeometry(2.25, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc8372d));
  dome.position.y = 8;
  g.add(dome);
  return g;
}

export function makeTree(kind = 'autumn', scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 6), mat(0x7a4b2a));
  trunk.position.y = 0.8;
  g.add(trunk);
  if (kind === 'autumn' || kind === 'pine') {
    const cols = kind === 'autumn' ? [0xe8622a, 0xf08a2e, 0xd94a28, 0xf5a03a] : [0x3f8f4a, 0x52a35a, 0x2f7a3e];
    const layers = kind === 'autumn' ? 3 : 4;
    for (let i = 0; i < layers; i++) {
      const r = 1.7 - i * (1.2 / layers);
      const cone = mesh(new THREE.ConeGeometry(r, 2.2, 7), mat(pick(cols)));
      cone.position.y = 1.9 + i * 1.15;
      cone.rotation.y = rand(0, 3);
      g.add(cone);
    }
  } else {
    const cols = [0x7dc24b, 0x9ccf4a, 0xc9d94a, 0x6bb33f];
    for (let i = 0; i < 4; i++) {
      const blob = mesh(new THREE.IcosahedronGeometry(rand(1.1, 1.6), 0), mat(pick(cols)));
      blob.position.set(rand(-0.8, 0.8), rand(2.4, 3.6), rand(-0.8, 0.8));
      blob.rotation.set(rand(0, 3), rand(0, 3), 0);
      g.add(blob);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

// Local X is the fence direction.
export function makeFence(length) {
  const g = new THREE.Group();
  const wood = mat(WOOD);
  const posts = Math.max(2, Math.round(length / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const p = mesh(new THREE.BoxGeometry(0.28, 1.25, 0.28), wood);
    p.position.set(-length / 2 + (i * length) / (posts - 1), 0.62, 0);
    g.add(p);
  }
  for (const y of [0.45, 0.9]) {
    const rail = mesh(new THREE.BoxGeometry(length, 0.18, 0.12), mat(0x9b6a45));
    rail.position.set(0, y, 0.1);
    g.add(rail);
  }
  return g;
}

export function makeHayBale() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), mat(STRAW));
  body.receiveShadow = true;
  g.add(body);
  for (const x of [-0.45, 0.45]) {
    const twine = mesh(new THREE.BoxGeometry(0.08, 1.14, 1.24), mat(0xb33a2a));
    twine.position.x = x;
    g.add(twine);
  }
  const tuft = mesh(new THREE.BoxGeometry(1.6, 0.08, 1.0), mat(0xf4d98a));
  tuft.position.y = 0.56;
  g.add(tuft);
  return g;
}

export function makeRock(s = 1) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(0.85, 1.15), p.getY(i) * rand(0.85, 1.15), p.getZ(i) * rand(0.85, 1.15));
  geo.computeVertexNormals();
  const m = mesh(geo, mat(pick([0x9a9fa6, 0xa7aab0, 0x8e939b])));
  m.scale.set(s, s * 0.7, s * 0.9);
  m.rotation.y = rand(0, 3);
  m.receiveShadow = true;
  return m;
}

export function makeScarecrow() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const post = box(0.2, 3, 0.2, WOOD);
  post.position.y = 1.5;
  g.add(post);
  const arm = box(2.6, 0.18, 0.18, WOOD);
  arm.position.y = 2.3;
  body.add(arm);
  const shirt = box(1.0, 1.1, 0.6, 0xc0392b);
  shirt.position.y = 2.1;
  body.add(shirt);
  const plaid = box(1.02, 0.12, 0.62, 0x2c3e50);
  plaid.position.y = 2.25;
  body.add(plaid);
  const head = mesh(new THREE.SphereGeometry(0.45, 8, 6), mat(0xe2c290));
  head.position.y = 3.0;
  body.add(head);
  for (const x of [-0.15, 0.15]) {
    const eye = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), mat(0x222222));
    eye.position.set(x, 3.08, 0.42);
    body.add(eye);
  }
  const smile = box(0.3, 0.05, 0.05, 0x222222);
  smile.position.set(0, 2.88, 0.43);
  body.add(smile);
  const brim = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 10), mat(0xd8b25a));
  brim.position.y = 3.35;
  body.add(brim);
  const crown = mesh(new THREE.ConeGeometry(0.42, 0.6, 8), mat(0xd8b25a));
  crown.position.y = 3.65;
  body.add(crown);
  for (const x of [-1.3, 1.3]) {
    const straw = mesh(new THREE.ConeGeometry(0.15, 0.4, 4), mat(STRAW));
    straw.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    straw.position.set(x + Math.sign(x) * 0.2, 2.3, 0);
    body.add(straw);
  }
  return { group: g, body };
}

export function makePond(r) {
  const g = new THREE.Group();
  const water = mesh(new THREE.CircleGeometry(r, 14), mat(0x4fb3d9, { rough: 0.2, transparent: true, opacity: 0.85 }), { cast: false, receive: true });
  water.rotation.x = -Math.PI / 2;
  g.add(water);
  for (let i = 0; i < 4; i++) {
    const pad = mesh(new THREE.CircleGeometry(rand(0.4, 0.7), 7), mat(0x3f9a4b), { cast: false });
    pad.rotation.x = -Math.PI / 2;
    const a = rand(0, Math.PI * 2);
    const d = rand(0.5, r * 0.7);
    pad.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d);
    g.add(pad);
  }
  return g;
}

export function makeSign(lines, color = '#f6e7c1') {
  const g = new THREE.Group();
  const post = box(0.2, 2, 0.2, WOOD);
  post.position.y = 1;
  g.add(post);
  const board = mesh(new THREE.BoxGeometry(2.4, 1.2, 0.12), new THREE.MeshStandardMaterial({ map: textTexture(lines, { bg: color }), roughness: 0.8 }));
  board.position.y = 2.0;
  board.position.z = 0.12;
  g.add(board);
  return g;
}

// Instanced grass tufts, wheat and flowers: lots of detail for very few draw calls.
export function makeFoliage(terrain, collision, count) {
  const g = new THREE.Group();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const place = (geo, material, n, colors, scaleRange, filter) => {
    const inst = new THREE.InstancedMesh(geo, material, n);
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 6; tries++) {
      const x = rand(-40, 40);
      const z = rand(-40, 40);
      if (filter && !filter(x, z)) continue;
      if (!collision.isClear(x, z, 0.3)) continue;
      const s = rand(...scaleRange);
      dummy.position.set(x, terrain.heightAt(x, z), z);
      dummy.rotation.set(rand(-0.15, 0.15), rand(0, 6), rand(-0.15, 0.15));
      dummy.scale.set(s, s * rand(0.8, 1.4), s);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);
      inst.setColorAt(placed, color.setHex(pick(colors)));
      placed++;
    }
    inst.count = placed;
    inst.receiveShadow = true;
    g.add(inst);
  };
  const blade = new THREE.ConeGeometry(0.16, 0.9, 3);
  blade.translate(0, 0.4, 0);
  const notYard = (x, z) => Math.hypot(x * 0.9, z) > 12;
  place(blade, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), count, [0x5fa336, 0x8bd04f, 0x6fb83f, 0x9bd45a], [0.6, 1.1], notYard);
  const wheat = new THREE.ConeGeometry(0.12, 1.5, 3);
  wheat.translate(0, 0.7, 0);
  place(wheat, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), Math.round(count * 0.4), [0xf2c94c, 0xe8b93a, 0xf5d76e], [0.7, 1.2], (x, z) => notYard(x, z) && (Math.sin(x * 0.2) + Math.cos(z * 0.17) > 0.9));
  const flower = new THREE.OctahedronGeometry(0.16, 0);
  flower.translate(0, 0.35, 0);
  place(flower, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), Math.round(count * 0.25), [0xffffff, 0xb388ff, 0xffd23f, 0xff8fab], [0.8, 1.3], notYard);
  return g;
}
