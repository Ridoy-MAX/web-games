import * as THREE from 'three';
import { clamp } from '../utils/math.js';

// Arcade collision: axis-aligned boxes and vertical cylinders against a
// vertical capsule approximated as a circle in XZ with a height.
export class CollisionSystem {
  constructor(terrain) {
    this.terrain = terrain;
    this.boxes = [];
    this.cylinders = [];
    this.hideZones = [];
    this.normal = new THREE.Vector3();
  }

  addBox(min, max, { camera = true, standable = true, tag = '' } = {}) {
    const box = { min: min.clone(), max: max.clone(), camera, standable, tag, active: true, vel: new THREE.Vector3() };
    this.boxes.push(box);
    return box;
  }

  // camR/camTop: a wider radius the camera treats as solid (tree canopies).
  addCylinder(x, z, r, top, { bottom = -5, standable = false, tag = '', camR = 0, camTop = top } = {}) {
    const cyl = { x, z, r, top, bottom, standable, tag, active: true, camR, camTop };
    this.cylinders.push(cyl);
    return cyl;
  }

  addHideZone(zone) {
    this.hideZones.push(zone);
  }

  hideZoneAt(x, z, includeDisabled = false) {
    for (const zone of this.hideZones) {
      if ((zone.enabled || includeDisabled) && x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ) return zone;
    }
    return null;
  }

  // Highest walkable surface under (x, z) that is not above the feet (+ step).
  groundAt(x, z, y, r = 0.5) {
    let h = this.terrain.heightAt(x, z);
    let support = null;
    const rr = r * 0.6;
    for (const b of this.boxes) {
      if (!b.active || !b.standable) continue;
      if (b.max.y > y + 0.35 || b.max.y <= h) continue;
      if (x + rr > b.min.x && x - rr < b.max.x && z + rr > b.min.z && z - rr < b.max.z) {
        h = b.max.y;
        support = b;
      }
    }
    for (const c of this.cylinders) {
      if (!c.active || !c.standable) continue;
      if (c.top > y + 0.35 || c.top <= h) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.r) {
        h = c.top;
        support = null;
      }
    }
    return { h, support };
  }

  // Pushes pos out of any solid it overlaps. Returns the last push normal or null.
  resolve(pos, r, height) {
    let hit = null;
    for (const b of this.boxes) {
      if (!b.active) continue;
      if (pos.y >= b.max.y - 0.05 || pos.y + height <= b.min.y) continue;
      const cx = clamp(pos.x, b.min.x, b.max.x);
      const cz = clamp(pos.z, b.min.z, b.max.z);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        dx /= d;
        dz /= d;
        pos.x += dx * (r - d);
        pos.z += dz * (r - d);
        this.normal.set(dx, 0, dz);
      } else {
        // Center is inside the box: leave through the nearest face.
        const pens = [
          [pos.x - b.min.x + r, -1, 0],
          [b.max.x - pos.x + r, 1, 0],
          [pos.z - b.min.z + r, 0, -1],
          [b.max.z - pos.z + r, 0, 1],
        ].sort((a, c) => a[0] - c[0]);
        const [pen, nx, nz] = pens[0];
        pos.x += nx * pen;
        pos.z += nz * pen;
        this.normal.set(nx, 0, nz);
      }
      hit = this.normal;
    }
    for (const c of this.cylinders) {
      if (!c.active) continue;
      if (pos.y >= c.top - 0.05 || pos.y + height <= c.bottom) continue;
      let dx = pos.x - c.x;
      let dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = r + c.r;
      if (d >= min) continue;
      if (d < 1e-6) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      pos.x = c.x + dx * min;
      pos.z = c.z + dz * min;
      this.normal.set(dx, 0, dz);
      hit = this.normal;
    }
    return hit;
  }

  // True if a sphere at pos overlaps any static solid (used for rolling hazards).
  overlapsSolid(pos, r) {
    for (const b of this.boxes) {
      if (!b.active || b.tag === 'platform') continue;
      if (pos.y - r > b.max.y || pos.y + r < b.min.y) continue;
      const cx = clamp(pos.x, b.min.x, b.max.x);
      const cz = clamp(pos.z, b.min.z, b.max.z);
      if ((pos.x - cx) ** 2 + (pos.z - cz) ** 2 < r * r) return b;
    }
    for (const c of this.cylinders) {
      if (!c.active || pos.y - r > c.top) continue;
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < r + c.r) return c;
    }
    return null;
  }

  // Slab test along a segment against camera-blocking boxes. Returns t in [0, 1].
  raycast(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    let best = 1;
    for (const b of this.boxes) {
      if (!b.active || !b.camera) continue;
      let tmin = 0;
      let tmax = best;
      let ok = true;
      for (const [o, d, lo, hi] of [
        [from.x, dx, b.min.x, b.max.x],
        [from.y, dy, b.min.y, b.max.y],
        [from.z, dz, b.min.z, b.max.z],
      ]) {
        if (Math.abs(d) < 1e-8) {
          if (o < lo || o > hi) {
            ok = false;
            break;
          }
        } else {
          let t1 = (lo - o) / d;
          let t2 = (hi - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            ok = false;
            break;
          }
        }
      }
      if (ok && tmin > 0 && tmin < best) best = tmin;
    }
    // Vertical cylinders (tree canopies, silo) in XZ.
    const a = dx * dx + dz * dz;
    if (a > 1e-8) {
      for (const c of this.cylinders) {
        if (!c.camR) continue;
        const ox = from.x - c.x;
        const oz = from.z - c.z;
        const cc = ox * ox + oz * oz - c.camR * c.camR;
        if (cc < 0) continue;
        const b = 2 * (ox * dx + oz * dz);
        const disc = b * b - 4 * a * cc;
        if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t <= 0 || t >= best) continue;
        const y = from.y + dy * t;
        if (y < c.camTop && y > c.bottom) best = t;
      }
    }
    return best;
  }

  // A spot clear of every solid, for spawning snacks and traps.
  isClear(x, z, margin) {
    for (const b of this.boxes) {
      if (!b.active || b.tag === 'platform') continue;
      if (x > b.min.x - margin && x < b.max.x + margin && z > b.min.z - margin && z < b.max.z + margin) return false;
    }
    for (const c of this.cylinders) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return false;
    }
    for (const zone of this.hideZones) {
      if (x > zone.minX - margin && x < zone.maxX + margin && z > zone.minZ - margin && z < zone.maxZ + margin) return false;
    }
    return !this.terrain.pondAt(x, z);
  }
}
