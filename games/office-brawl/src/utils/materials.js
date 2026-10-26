import * as THREE from 'three';

const cache = new Map();

// Shared low-poly materials. Anything that needs per-object tweaks (opacity, color
// animation) must call .clone() on the result.
export function mat(color, { rough = 0.85, metal = 0, emissive = 0x000000, emissiveIntensity = 1, flat = true, transparent = false, opacity = 1 } = {}) {
  const key = [color, rough, metal, emissive, emissiveIntensity, flat, transparent, opacity].join('|');
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      flatShading: flat,
      emissive,
      emissiveIntensity,
      transparent,
      opacity,
    });
    m.userData.shared = true;
    cache.set(key, m);
  }
  return m;
}

// Frees a temporary prop's GPU resources, leaving cached shared materials alone.
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData.shared) m.dispose();
  });
}

export function mesh(geo, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Text drawn onto a canvas, for signs and sprites.
export function textTexture(lines, { width = 512, height = 256, bg = '#f6e7c1', fg = '#4a2c17', font = 'bold 64px "Lilita One", sans-serif', border = '#7a4a26' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 16;
    g.strokeRect(8, 8, width - 16, height - 16);
  }
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lh = height / (lines.length + 1);
  lines.forEach((line, i) => g.fillText(line, width / 2, lh * (i + 1)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
