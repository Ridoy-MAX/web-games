import * as THREE from 'three';
import { Environment } from './Environment.js';
import { ISLAND_HALF } from './Terrain.js';
import { BARN, makeBarn, makeFence, makeFoliage, makeHayBale, makePond, makeRock, makeScarecrow, makeSign, makeSilo, makeTree } from './Props.js';
import { rand } from '../utils/math.js';

const BARNS = [
  { x: -20, z: -16, rot: 0, wall: 0xc8372d, roof: 0x2f6f73 },
  { x: 24, z: -8, rot: -Math.PI / 2, wall: 0xc2412f, roof: 0x3d5a80 },
  { x: 6, z: 27, rot: Math.PI, wall: 0xd04a30, roof: 0x2f6f73 },
];

const HAY = [
  [7, -9, 0, 0], [8.9, -9, 0, 0], [8, -9, 1, 0],
  [-8, 11, 0, 1],
  [13, 7, 0, 0], [13, 7, 1, 0],
  [-3, -24, 0, 1], [-3, -22.2, 0, 1],
  [28, -27, 0, 0], [29.9, -27, 0, 0], [29, -27, 1, 0],
  [-30, -2, 0, 1], [27, 22, 0, 0],
];

// Fence runs: [x1, z1, x2, z2]. Gaps are intentional so the cow can slip through.
const FENCES = [
  [16, 13, 24, 13], [28, 13, 33, 13], [33, 13, 33, 23], [16, 13, 16, 19],
  [-22, 40, -4, 40], [-40, -12, -40, 6], [40, 26, 40, 38], [-14, -40, 2, -40],
  [-36, 14, -28, 14], [-28, 14, -28, 21],
];

const rotatePoint = (x, z, rot) => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x * c + z * s, -x * s + z * c];
};

export class World {
  constructor(scene, terrain, collision, { lowQuality = false } = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.collision = collision;
    this.barns = [];
    this.root = new THREE.Group();
    scene.add(this.root);

    for (const b of BARNS) terrain.addFlat(b.x, b.z, 10);
    terrain.addFlat(-10, -27, 3.5);
    terrain.addFlat(0, 2, 8);
    terrain.addPond(-24, 26, 5.5);

    this.env = new Environment(scene, { lowQuality });
    this.root.add(terrain.buildMesh(lowQuality));
    this.buildBarns();
    this.buildProps();
    this.root.add(makeFoliage(terrain, collision, lowQuality ? 700 : 1600));

    this.spawnPoints = [new THREE.Vector3(0, 0, 4), new THREE.Vector3(-10, 0, 2), new THREE.Vector3(12, 0, -2), new THREE.Vector3(-4, 0, 16), new THREE.Vector3(18, 0, 28)];
    for (const p of this.spawnPoints) p.y = terrain.heightAt(p.x, p.z);
  }

  buildBarns() {
    for (const cfg of BARNS) {
      const barn = makeBarn(cfg.wall, cfg.roof);
      barn.group.position.set(cfg.x, 0, cfg.z);
      barn.group.rotation.y = cfg.rot;
      this.root.add(barn.group);
      for (const c of barn.colliders) {
        const [ax, az] = rotatePoint(c.min.x, c.min.z, cfg.rot);
        const [bx, bz] = rotatePoint(c.max.x, c.max.z, cfg.rot);
        this.collision.addBox(
          new THREE.Vector3(Math.min(ax, bx) + cfg.x, c.min.y, Math.min(az, bz) + cfg.z),
          new THREE.Vector3(Math.max(ax, bx) + cfg.x, c.max.y, Math.max(az, bz) + cfg.z),
          { standable: false, tag: 'barn' },
        );
      }
      const i = barn.interior;
      const [ax, az] = rotatePoint(i.minX, i.minZ, cfg.rot);
      const [bx, bz] = rotatePoint(i.maxX, i.maxZ, cfg.rot);
      const zone = {
        minX: Math.min(ax, bx) + cfg.x,
        maxX: Math.max(ax, bx) + cfg.x,
        minZ: Math.min(az, bz) + cfg.z,
        maxZ: Math.max(az, bz) + cfg.z,
        enabled: true,
        center: new THREE.Vector3(cfg.x, 0, cfg.z),
        barn: null,
      };
      const entry = {
        ...barn,
        zone,
        roofHome: { pos: barn.roof.position.clone(), quat: barn.roof.quaternion.clone() },
        roofState: 'home',
        roofTimer: 0,
        faded: false,
      };
      zone.barn = entry;
      this.collision.addHideZone(zone);
      this.barns.push(entry);
    }
  }

  addBoxCollider(x, z, w, d, h, base, opts) {
    return this.collision.addBox(new THREE.Vector3(x - w / 2, base, z - d / 2), new THREE.Vector3(x + w / 2, base + h, z + d / 2), opts);
  }

  buildProps() {
    const t = this.terrain;
    const silo = makeSilo();
    silo.position.set(-10, 0, -27);
    this.root.add(silo);
    this.collision.addCylinder(-10, -27, 2.3, 9.5, { tag: 'silo', camR: 2.4, camTop: 10.5 });

    for (const [x, z, layer, rot] of HAY) {
      const bale = makeHayBale();
      const base = t.heightAt(x, z) + layer * 1.1;
      bale.position.set(x, base + 0.55, z);
      bale.rotation.y = rot ? Math.PI / 2 : 0;
      this.root.add(bale);
      const w = rot ? 1.2 : 1.8;
      const d = rot ? 1.8 : 1.2;
      // Stacked bales sit on the bale below, so only the bottom one starts at the terrain.
      this.addBoxCollider(x, z, w, d, 1.1, base - (layer ? 0 : 0.3), { tag: 'hay' });
    }

    for (const [x1, z1, x2, z2] of FENCES) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const fence = makeFence(len);
      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      const base = t.heightAt(mx, mz);
      fence.position.set(mx, base, mz);
      fence.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      this.root.add(fence);
      const horizontal = Math.abs(z2 - z1) < 0.01;
      this.addBoxCollider(mx, mz, horizontal ? len : 0.35, horizontal ? 0.35 : len, 1.25, base - 0.4, { tag: 'fence', camera: false });
    }

    const pond = makePond(5.5);
    pond.position.set(-24, -0.2, 26);
    this.root.add(pond);

    const scare = makeScarecrow();
    scare.group.position.set(12, t.heightAt(12, -22), -22);
    this.root.add(scare.group);
    this.scarecrow = scare;
    this.collision.addCylinder(12, -22, 0.35, 3.5, { tag: 'scarecrow', camR: 1.3, camTop: 4 });

    const sign = makeSign(['WELCOME TO', 'MOO VALLEY'], '#fff4d6');
    sign.position.set(-4.5, t.heightAt(-4.5, 7), 7);
    sign.rotation.y = 0.4;
    this.root.add(sign);
    this.collision.addCylinder(-4.5, 7, 0.3, 3, { tag: 'sign' });

    const ufoSign = makeSign(['NO UFOs', 'ALLOWED'], '#ffd9d0');
    ufoSign.position.set(20, t.heightAt(20, 6), 6);
    ufoSign.rotation.y = -0.6;
    this.root.add(ufoSign);
    this.collision.addCylinder(20, 6, 0.3, 3, { tag: 'sign' });

    // Trees around the rim plus a few clumps inside.
    const kinds = ['autumn', 'autumn', 'pine', 'round'];
    const keepOut = [[38, 0], [-6, -38], [0, 2]];
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 46; tries++) {
      const rim = placed < 34;
      const x = rand(-39, 39);
      const z = rand(-39, 39);
      const edge = ISLAND_HALF - Math.max(Math.abs(x), Math.abs(z));
      if (rim ? edge > 7 || edge < 2.5 : edge < 8) continue;
      if (keepOut.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 8)) continue;
      if (!this.collision.isClear(x, z, 2.5)) continue;
      const s = rand(0.85, 1.45);
      const tree = makeTree(kinds[placed % kinds.length], s);
      tree.position.set(x, t.heightAt(x, z) - 0.1, z);
      this.root.add(tree);
      this.collision.addCylinder(x, z, 0.45 * s, 20, { tag: 'tree', camR: 1.6 * s, camTop: t.heightAt(x, z) + 6.5 * s });
      placed++;
    }

    for (let i = 0, tries = 0; i < 12 && tries < 200; tries++) {
      const x = rand(-38, 38);
      const z = rand(-38, 38);
      if (Math.hypot(x, z) < 10 || !this.collision.isClear(x, z, 2)) continue;
      const s = rand(0.6, 1.4);
      const rock = makeRock(s);
      const h = t.heightAt(x, z);
      rock.position.set(x, h + s * 0.2, z);
      this.root.add(rock);
      this.collision.addCylinder(x, z, s * 0.85, h + s * 0.85, { tag: 'rock', standable: true });
      i++;
    }
  }

  // Barn roofs go see-through while the cow hides so the camera can still see her.
  setBarnFade(barn, faded) {
    if (barn.faded === faded) return;
    barn.faded = faded;
    for (const m of barn.roof.userData.materials) {
      m.transparent = faded;
      m.opacity = faded ? 0.18 : 1;
      m.depthWrite = !faded;
      m.needsUpdate = true;
    }
  }

  resetBarns() {
    for (const b of this.barns) {
      if (b.roof.parent !== b.group) b.group.add(b.roof);
      b.roof.position.copy(b.roofHome.pos);
      b.roof.quaternion.copy(b.roofHome.quat);
      b.roof.scale.setScalar(1);
      b.roofState = 'home';
      b.zone.enabled = true;
      this.setBarnFade(b, false);
    }
  }

  update(dt, focus) {
    this.env.update(dt, focus);
  }
}

export { BARN };
