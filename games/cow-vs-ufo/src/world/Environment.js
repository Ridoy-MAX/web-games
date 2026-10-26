import * as THREE from 'three';
import { mat, mesh } from '../utils/materials.js';
import { rand } from '../utils/math.js';
import { makeTree } from './Props.js';

const SKY_VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
varying vec3 vWorld;
void main() {
  float h = normalize(vWorld).y;
  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.6)) : mix(horizonColor, bottomColor, pow(-h, 0.5));
  gl_FragColor = vec4(col, 1.0);
}`;

// Sky, sun, fog, clouds and distant floating islands.
export class Environment {
  constructor(scene, { lowQuality = false } = {}) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xbfe6ff, 110, 300);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(450, 24, 12),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x3fa9f5) },
          horizonColor: { value: new THREE.Color(0xc6ecff) },
          bottomColor: { value: new THREE.Color(0x8fd0ff) },
        },
      }),
    );
    sky.renderOrder = -1;
    scene.add(sky);
    this.sky = sky;

    scene.add(new THREE.HemisphereLight(0xe3f4ff, 0x7a9a45, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d4, 2.6);
    sun.castShadow = true;
    const size = lowQuality ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    const s = lowQuality ? 26 : 34;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 140 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(28, 55, 22);

    this.clouds = [];
    const cloudMat = mat(0xffffff, { rough: 1 });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < (lowQuality ? 10 : 18); i++) {
      const c = new THREE.Group();
      const n = 4 + Math.floor(rand(0, 4));
      for (let k = 0; k < n; k++) {
        const p = mesh(puff, cloudMat, { cast: false });
        p.scale.setScalar(rand(2.2, 4.2));
        p.position.set(k * 2.6 - n * 1.3 + rand(-0.5, 0.5), rand(-0.6, 1.2), rand(-1.2, 1.2));
        c.add(p);
      }
      const a = rand(0, Math.PI * 2);
      const d = rand(70, 190);
      c.position.set(Math.cos(a) * d, rand(18, 48), Math.sin(a) * d);
      c.userData.speed = rand(0.6, 1.6);
      scene.add(c);
      this.clouds.push(c);
    }

    // Tiny islands floating in the distance.
    this.islands = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const w = rand(6, 12);
      const top = mesh(new THREE.BoxGeometry(w, 1, w), mat(0x7cc243), { cast: false });
      g.add(top);
      const under = mesh(new THREE.ConeGeometry(w * 0.7, w, 5), mat(0xb5653a), { cast: false });
      under.rotation.x = Math.PI;
      under.position.y = -w / 2 - 0.5;
      g.add(under);
      const tree = makeTree(i % 2 ? 'autumn' : 'pine', rand(0.9, 1.3));
      tree.position.y = 0.5;
      g.add(tree);
      const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
      const d = rand(95, 150);
      g.position.set(Math.cos(a) * d, rand(-10, 15), Math.sin(a) * d);
      g.userData.phase = rand(0, 6);
      scene.add(g);
      this.islands.push(g);
    }
    this.time = 0;
  }

  update(dt, focus) {
    this.time += dt;
    this.sun.position.copy(focus).add(this.sunOffset);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(focus);
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 200) c.position.x = -200;
    }
    for (const g of this.islands) {
      g.position.y += Math.sin(this.time * 0.5 + g.userData.phase) * 0.01;
    }
  }
}
