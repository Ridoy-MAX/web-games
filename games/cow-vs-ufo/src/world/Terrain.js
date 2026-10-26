import * as THREE from 'three';
import { mat, mesh } from '../utils/materials.js';
import { rand, smoothstep } from '../utils/math.js';

export const ISLAND_HALF = 42;

const GRASS = [0x7cc243, 0x86c94a, 0x72b83d, 0x8fd052];
const DIRT = [0xf0be54, 0xe9b04a, 0xf5c862];

// The farm is a floating square island. Outside it there is no ground at all,
// which is what makes getting knocked around genuinely dangerous.
export class Terrain {
  constructor() {
    this.flatZones = [];
    this.ponds = [];
  }

  addFlat(x, z, r) {
    this.flatZones.push({ x, z, r });
  }

  addPond(x, z, r) {
    this.ponds.push({ x, z, r });
    this.addFlat(x, z, r + 1);
  }

  inside(x, z) {
    return Math.abs(x) <= ISLAND_HALF && Math.abs(z) <= ISLAND_HALF;
  }

  rawHeight(x, z) {
    return (
      0.9 * Math.sin(x * 0.11 + 0.5) * Math.cos(z * 0.09 - 0.3) +
      0.55 * Math.sin(x * 0.23 + 1.3) * Math.sin(z * 0.19 + 0.7) +
      0.3 * Math.cos((x + z) * 0.15) +
      0.7
    );
  }

  heightAt(x, z) {
    if (!this.inside(x, z)) return -Infinity;
    const edge = Math.min(ISLAND_HALF - Math.abs(x), ISLAND_HALF - Math.abs(z));
    let f = smoothstep(0, 9, edge);
    for (const fz of this.flatZones) {
      const d = Math.hypot(x - fz.x, z - fz.z);
      f *= smoothstep(fz.r * 0.75, fz.r + 4, d);
    }
    let h = this.rawHeight(x, z) * f;
    for (const p of this.ponds) {
      const d = Math.hypot(x - p.x, z - p.z);
      h -= 0.45 * (1 - smoothstep(p.r * 0.6, p.r, d));
    }
    return h;
  }

  pondAt(x, z) {
    for (const p of this.ponds) if (Math.hypot(x - p.x, z - p.z) < p.r * 0.85) return p;
    return null;
  }

  buildMesh(lowQuality) {
    const group = new THREE.Group();
    const seg = lowQuality ? 64 : 96;
    const size = ISLAND_HALF * 2;
    let geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
    }
    // Non-indexed so every triangle gets one flat color: the faceted low-poly look.
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const yard = Math.hypot(cx * 0.9, cz) + Math.sin(cx * 0.7) * 1.5 + Math.cos(cz * 0.5) * 1.5;
      const path = Math.abs(cz - Math.sin(cx * 0.12) * 4 - 1) < 1.6 + Math.sin(cx * 0.9) * 0.4;
      const pal = yard < 11 || (path && Math.abs(cx) < 30) ? DIRT : GRASS;
      c.setHex(pal[(Math.floor(cx * 3.1 + cz * 1.7) & 0x7fffffff) % pal.length]);
      const shade = 0.94 + Math.random() * 0.1;
      c.multiplyScalar(shade);
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), { cast: false, receive: true });
    group.add(ground);

    // Earth cliff underneath, layered like a slice of cake.
    const lip = mesh(new THREE.BoxGeometry(size + 0.6, 0.7, size + 0.6), mat(0x5fa336), { cast: false, receive: true });
    lip.position.y = -0.37;
    group.add(lip);
    const top = mesh(new THREE.BoxGeometry(size + 0.2, 3, size + 0.2), mat(0xc8743f), { cast: false, receive: true });
    top.position.y = -2.2;
    group.add(top);
    const deep = mesh(new THREE.BoxGeometry(size - 0.4, 8, size - 0.4), mat(0xa75a34), { cast: false });
    deep.position.y = -7.6;
    group.add(deep);

    // Rocks poking out of the cliff faces.
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = mat(0x8c5a3c);
    const n = lowQuality ? 30 : 60;
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      const along = rand(-ISLAND_HALF + 2, ISLAND_HALF - 2);
      const y = rand(-10, -1.5);
      const r = mesh(rockGeo, rockMat, { cast: false });
      const out = ISLAND_HALF + 0.1;
      if (side === 0) r.position.set(along, y, out);
      else if (side === 1) r.position.set(along, y, -out);
      else if (side === 2) r.position.set(out, y, along);
      else r.position.set(-out, y, along);
      r.scale.set(rand(0.4, 0.9), rand(0.3, 0.6), rand(0.4, 0.9));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      group.add(r);
    }

    // Hanging rock spikes so it reads as a floating island.
    const spikeMat = mat(0x8f4d2c);
    for (let i = 0; i < 9; i++) {
      const h = rand(8, 16);
      const s = mesh(new THREE.ConeGeometry(rand(5, 10), h, 6), spikeMat, { cast: false });
      s.rotation.x = Math.PI;
      s.position.set(rand(-25, 25), -11 - h / 2, rand(-25, 25));
      group.add(s);
    }
    return group;
  }
}
