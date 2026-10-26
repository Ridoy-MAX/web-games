import * as THREE from 'three';
import { mat, mesh } from '../utils/materials.js';
import { clamp, damp, distXZ, pick, rand, TAU } from '../utils/math.js';

export const BEAM_RADIUS = 2.8;
const ARM_LEN = 9.5;

const BEAM_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BEAM_FRAG = `
uniform float time;
uniform float opacity;
uniform vec3 color;
varying vec2 vUv;
void main() {
  float stripes = 0.5 + 0.5 * sin(vUv.y * 28.0 + time * 7.0);
  float swirl = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 4.0 + time * 3.0 + vUv.y * 10.0);
  float a = (0.22 + 0.3 * stripes * 0.7 + 0.15 * swirl) * (0.55 + 0.45 * vUv.y);
  gl_FragColor = vec4(color * (1.0 + 0.4 * stripes), a * opacity);
}`;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const desired = new THREE.Vector3();
const _c = new THREE.Color();
const IDENTITY = new THREE.Quaternion();

function symbolTexture(sym, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 56, 0, TAU);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#1b1b2f';
  g.stroke();
  g.fillStyle = color;
  g.font = 'bold 84px "Lilita One", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(sym, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class UFO {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    game.scene.add(this.root);
    this.buildModel();
    this.buildBeam();
    this.buildGadgets();
    this.vel = new THREE.Vector3();
    this.groundPoint = new THREE.Vector3();
    this.time = 0;
    this.state = 'menu';
    this.timer = 0;
    this.cfg = null;
    this.hat = null;
    this.hatTimer = 0;
    this.speedBoost = 1;
    this.sinceSpecial = 0;
    this.lastSpecial = null;
    this.root.position.set(0, 12, -10);
  }

  buildModel() {
    const t = this.tilt;
    const profile = [
      [0, -0.65], [1.2, -0.6], [3.3, -0.18], [3.85, 0.05], [3.4, 0.36], [1.6, 0.62], [0, 0.66],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const saucer = mesh(new THREE.LatheGeometry(profile, 28), mat(0xb9c4cf, { metal: 0.3, rough: 0.35 }));
    t.add(saucer);
    const rim = mesh(new THREE.TorusGeometry(3.78, 0.13, 6, 28), mat(0x7d8a99, { metal: 0.3, rough: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    t.add(rim);
    this.lights = [];
    const bulbGeo = new THREE.SphereGeometry(0.17, 8, 6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const m = new THREE.MeshStandardMaterial({ color: 0x7ff6ff, emissive: 0x7ff6ff, emissiveIntensity: 1.6 });
      const b = mesh(bulbGeo, m, { cast: false });
      b.position.set(Math.cos(a) * 3.0, 0.32, Math.sin(a) * 3.0);
      t.add(b);
      this.lights.push(m);
    }
    const dome = mesh(
      new THREE.SphereGeometry(1.55, 20, 10, 0, TAU, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xaef0ff, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.1, depthWrite: false }),
      { cast: false },
    );
    dome.position.y = 0.55;
    t.add(dome);
    const emitter = mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x9ff8ff, emissive: 0x6ff0ff, emissiveIntensity: 1.4 }), { cast: false });
    emitter.position.y = -0.7;
    t.add(emitter);
    this.emitterMat = emitter.material;

    // The pilot: a tiny green alien with huge eyes.
    this.alien = new THREE.Group();
    this.alien.position.y = 0.95;
    const skin = mat(0x7ddc5a, { flat: false, rough: 0.5 });
    const head = mesh(new THREE.SphereGeometry(0.55, 14, 10), skin);
    head.scale.set(1, 1.1, 0.95);
    this.alien.add(head);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x111111, { flat: false, rough: 0.15 }));
      eye.scale.set(1, 1.5, 0.6);
      eye.position.set(s * 0.22, 0.05, 0.43);
      eye.rotation.z = s * -0.5;
      this.alien.add(eye);
      const ant = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5), skin);
      ant.position.set(s * 0.2, 0.7, 0);
      ant.rotation.z = s * -0.3;
      this.alien.add(ant);
      const tip = mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0xffe14d, { emissive: 0xffc800 }));
      tip.position.set(s * 0.27, 0.92, 0);
      this.alien.add(tip);
    }
    this.alienMouth = mesh(new THREE.SphereGeometry(1, 10, 6), mat(0x2b1030, { flat: false }));
    this.alienMouth.position.set(0, -0.25, 0.48);
    this.alienMouth.scale.set(0.12, 0.04, 0.04);
    this.alien.add(this.alienMouth);
    t.add(this.alien);

    // Status bubble over the dome (? when searching, ! when charging).
    this.symbols = { '?': symbolTexture('?', '#3a86ff'), '!': symbolTexture('!', '#ff3b5c'), '♪': symbolTexture('♪', '#b14cff'), '★': symbolTexture('★', '#ffb703') };
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.symbols['?'], depthTest: false }));
    this.bubble.scale.setScalar(1.4);
    this.bubble.position.y = 3.1;
    this.bubble.visible = false;
    this.bubble.renderOrder = 10;
    this.root.add(this.bubble);

    this.hatSlot = new THREE.Object3D();
    this.hatSlot.position.y = 0.4;
    this.tilt.add(this.hatSlot);

    this.tilt.traverse((o) => {
      if (o.isMesh && o.material !== this.emitterMat) o.castShadow = true;
    });
  }

  buildBeam() {
    const geo = new THREE.CylinderGeometry(0.7, BEAM_RADIUS, 1, 28, 1, true);
    geo.translate(0, -0.5, 0);
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, opacity: { value: 0 }, color: { value: new THREE.Color(0x7ff6ff) } },
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.position.y = -0.7;
    this.beam.visible = false;
    this.beam.renderOrder = 5;
    this.root.add(this.beam);

    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(BEAM_RADIUS - 0.3, BEAM_RADIUS, 40).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 4;
    this.game.scene.add(this.ring);
    this.discMat = new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(BEAM_RADIUS, 32).rotateX(-Math.PI / 2), this.discMat);
    this.game.scene.add(this.disc);

    // Big warning ring for the sweep attack.
    this.sweepRingMat = new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0, depthWrite: false });
    this.sweepRing = new THREE.Mesh(new THREE.RingGeometry(ARM_LEN - 0.4, ARM_LEN + 0.6, 48).rotateX(-Math.PI / 2), this.sweepRingMat);
    this.game.scene.add(this.sweepRing);
    this.beamLevel = 0;
    this.beamWidth = 1;
  }

  buildGadgets() {
    // Spinning boxing-glove sweeper.
    this.arm = new THREE.Group();
    this.arm.visible = false;
    this.root.add(this.arm);
    this.armPole = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 6), mat(0x5b6675, { metal: 0.6, rough: 0.4 }));
    this.armPole.geometry.translate(0, -0.5, 0);
    this.arm.add(this.armPole);
    this.armSpin = new THREE.Group();
    this.arm.add(this.armSpin);
    const bar = mesh(new THREE.BoxGeometry(ARM_LEN, 0.35, 0.35), mat(0xffbe0b, { metal: 0.3 }));
    bar.position.x = ARM_LEN / 2;
    this.armSpin.add(bar);
    const stripe = mesh(new THREE.BoxGeometry(ARM_LEN * 0.9, 0.37, 0.12), mat(0x222222));
    stripe.position.x = ARM_LEN / 2;
    this.armSpin.add(stripe);
    const glove = mesh(new THREE.SphereGeometry(0.85, 12, 10), mat(0xe63946, { flat: false, rough: 0.4 }));
    glove.scale.set(1.2, 0.95, 1);
    glove.position.x = ARM_LEN;
    this.armSpin.add(glove);
    const cuff = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10), mat(0xffffff));
    cuff.rotation.z = Math.PI / 2;
    cuff.position.x = ARM_LEN - 1.0;
    this.armSpin.add(cuff);
    const hub = mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(0x5b6675, { metal: 0.6 }));
    this.armSpin.add(hub);

    // Giant horseshoe magnet.
    this.magnet = new THREE.Group();
    this.magnet.visible = false;
    this.root.add(this.magnet);
    this.magnetCable = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), mat(0x333333));
    this.magnetCable.geometry.translate(0, -0.5, 0);
    this.magnet.add(this.magnetCable);
    this.magnetBody = new THREE.Group();
    const shoe = mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 16, Math.PI), mat(0xe63946, { rough: 0.5 }));
    shoe.rotation.z = Math.PI;
    this.magnetBody.add(shoe);
    for (const s of [-1, 1]) {
      const tip = mesh(new THREE.BoxGeometry(0.72, 0.5, 0.72), mat(0xdfe6ee, { metal: 0.8, rough: 0.25 }));
      tip.position.set(s * 0.9, -0.2, 0);
      this.magnetBody.add(tip);
    }
    this.magnet.add(this.magnetBody);
  }

  // --- control ------------------------------------------------------------------

  reset(cfg) {
    this.cfg = cfg;
    this.returnHat(true);
    this.enter('enter');
    this.root.position.set(rand(-60, 60), 45, -90);
    this.vel.set(0, 0, 0);
    this.sinceSpecial = 0;
    this.lastSpecial = null;
    this.speedBoost = 1;
  }

  setMenu() {
    this.cfg = null;
    this.returnHat(true);
    this.enter('menu');
  }

  enter(state) {
    if (this.state === 'beam' && state !== 'beam') this.game.audio.beamOff();
    this.state = state;
    this.timer = 0;
    this.phase = 0;
    this.count = 0;
    this.arm.visible = false;
    this.magnet.visible = false;
    this.sweepRingMat.opacity = 0;
    if (state !== 'charge') this.speedBoost = 1;
    if (state === 'charge') this.game.audio.alarm();
    if (state === 'beam') this.game.audio.beamOn();
    if (state === 'search') this.hideTime = 0;
    if (state === 'hunt') this.timer = this.cfg ? -this.cfg.huntTime * rand(0.8, 1.2) : 0;
  }

  get beaming() {
    return this.state === 'beam' && this.beamLevel > 0.8;
  }

  retreat() {
    this.game.audio.beamOff();
    this.enter('retreat');
  }

  startDisco() {
    this.enter('disco');
  }

  stopDisco() {
    if (this.state === 'disco') this.enter('cooldown');
  }

  distract(npc) {
    this.target = npc;
    this.enter('distract');
  }

  celebrate() {
    this.enter('celebrate');
  }

  onTrapSprung() {
    if (['retreat', 'disco', 'abduct', 'celebrate'].includes(this.state)) return;
    this.enter('charge');
    this.speedBoost = 2.2;
    this.game.effects.popup('GOTCHA!', tmp.copy(this.root.position).setY(this.root.position.y + 2), 'comic bad');
  }

  // --- helpers ---------------------------------------------------------------------

  groundBelow(x, z) {
    const h = this.game.terrain.heightAt(x, z);
    return Number.isFinite(h) ? h : 0;
  }

  flyTo(x, z, alt, speed, dt) {
    const p = this.root.position;
    desired.set(clamp(x, -46, 46) - p.x, 0, clamp(z, -46, 46) - p.z);
    const d = desired.length();
    const s = Math.min(speed, d * 2.2);
    if (d > 0.001) desired.multiplyScalar(s / d);
    this.vel.x = damp(this.vel.x, desired.x, 3.5, dt);
    this.vel.z = damp(this.vel.z, desired.z, 3.5, dt);
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    p.y = damp(p.y, this.groundBelow(p.x, p.z) + alt, 2.5, dt);
    return d;
  }

  chooseAttack() {
    const cfg = this.cfg;
    const options = cfg.attacks.filter((a) => a !== this.lastSpecial);
    if (options.length && this.sinceSpecial >= 1 && Math.random() < cfg.specialChance) {
      this.lastSpecial = pick(options);
      this.sinceSpecial = 0;
      this.enter(this.lastSpecial);
    } else {
      this.sinceSpecial++;
      this.enter('charge');
    }
  }

  // --- per-frame -------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const player = g.player;
    const cfg = this.cfg;
    this.time += dt;
    this.timer += dt;
    const p = this.root.position;
    const pp = player.pos;
    let beamTarget = 0;
    let beamColor = 0x7ff6ff;
    let ringWarn = 0;
    let bubble = null;
    let spin = 1.2;
    let alienMood = 'idle';

    this.updateHat(dt);
    if (this.hatTimer > 0) {
      this.hatTimer -= dt;
      if (this.hatTimer <= 0) this.returnHat(false);
    }

    switch (this.state) {
      case 'menu': {
        const a = this.time * 0.25;
        this.flyTo(Math.cos(a) * 14, Math.sin(a * 1.3) * 12, 10, 8, dt);
        beamTarget = Math.sin(this.time * 0.7) > 0.4 ? 1 : 0;
        break;
      }
      case 'enter': {
        const d = this.flyTo(pp.x, pp.z, 10, 26, dt);
        if (d < 8 && this.timer > 1.5) this.enter('hunt');
        break;
      }
      case 'hunt': {
        if (player.hidden) {
          this.enter('search');
          break;
        }
        const lead = 0.5;
        this.flyTo(pp.x + player.phys.vel.x * lead, pp.z + player.phys.vel.z * lead, 10, cfg.ufoSpeed, dt);
        if (player.invuln > 0 || player.busy) this.timer = Math.min(this.timer, -0.5);
        else if (this.timer > 0 && distXZ(p, pp) < 6) this.chooseAttack();
        break;
      }
      case 'search': {
        bubble = '?';
        alienMood = 'confused';
        const zone = player.hidden;
        if (!zone) {
          this.enter('hunt');
          break;
        }
        this.flyTo(zone.center.x + Math.cos(this.time) * 3, zone.center.z + Math.sin(this.time) * 3, 11, cfg.ufoSpeed, dt);
        this.hideTime += dt;
        if (this.hideTime > cfg.hideLimit && zone.barn.roofState === 'home') {
          this.target = zone.barn;
          this.enter('roofLift');
        }
        break;
      }
      case 'roofLift': {
        const barn = this.target;
        const c = barn.zone.center;
        bubble = '★';
        alienMood = 'happy';
        if (this.phase === 0) {
          const d = this.flyTo(c.x, c.z, 12, cfg.ufoSpeed * 1.5, dt);
          if (d < 1.5 || this.timer > 4) {
            this.phase = 1;
            this.timer = 0;
            barn.roofState = 'lifting';
            g.world.setBarnFade(barn, false);
            g.audio.zap();
          }
        } else if (this.phase === 1) {
          this.flyTo(c.x, c.z, 12, 4, dt);
          beamTarget = 1;
          beamColor = 0xc77dff;
          const k = Math.min(1, this.timer / 1.3);
          barn.roof.position.y = barn.roofHome.pos.y + k * k * 6;
          barn.roof.rotation.z = Math.sin(this.time * 12) * 0.05 * k;
          if (k >= 1) {
            this.hatSlot.attach(barn.roof);
            barn.roofState = 'carried';
            barn.zone.enabled = false;
            this.hat = barn;
            this.hatTimer = 8;
            this.phase = 2;
            this.timer = 0;
            g.effects.popup('YOINK!', tmp.copy(p).setY(p.y + 3), 'comic bad');
            g.effects.shake(0.2);
            g.events.announce('🛸', 'The UFO stole the barn roof!', 2.2);
          }
        } else {
          beamTarget = 1;
          beamColor = 0xc77dff;
          if (this.timer > 0.8) this.enter('charge');
        }
        break;
      }
      case 'charge': {
        bubble = '!';
        ringWarn = 1;
        alienMood = 'angry';
        this.flyTo(pp.x, pp.z, 10, cfg.ufoSpeed * 0.55 * this.speedBoost, dt);
        beamTarget = 0.25 + Math.abs(Math.sin(this.time * 18)) * 0.25;
        this.beamWidth = 0.25;
        if (this.timer > 1.0) this.enter('beam');
        break;
      }
      case 'beam': {
        alienMood = 'angry';
        this.flyTo(pp.x, pp.z, 10, cfg.beamDrift * (player.hidden ? 0.4 : 1), dt);
        beamTarget = 1;
        this.beamWidth = 1;
        if (player.busy) this.enter('abduct');
        else if (this.timer > cfg.beamTime) {
          this.enter('cooldown');
        }
        break;
      }
      case 'abduct': {
        beamTarget = 1;
        alienMood = 'happy';
        this.vel.multiplyScalar(Math.exp(-4 * dt));
        p.x += this.vel.x * dt;
        p.z += this.vel.z * dt;
        if (this.timer > 4) this.enter('cooldown');
        break;
      }
      case 'celebrate': {
        spin = 14;
        alienMood = 'laugh';
        bubble = '★';
        p.y = damp(p.y, this.groundBelow(p.x, p.z) + 14, 2, dt);
        if (this.timer > 2.2) this.enter('cooldown');
        break;
      }
      case 'cooldown': {
        if (cfg) {
          const away = tmp.set(p.x - pp.x, 0, p.z - pp.z);
          const d = away.length() || 1;
          this.flyTo(p.x + (away.x / d) * 2, p.z + (away.z / d) * 2, 12, 4, dt);
        } else {
          this.flyTo(0, 0, 11, 6, dt);
        }
        if (this.timer > 1.3) this.enter(cfg ? 'hunt' : 'menu');
        break;
      }
      case 'anvils': {
        alienMood = 'happy';
        this.flyTo(pp.x, pp.z, 13, cfg.ufoSpeed * 0.7, dt);
        const total = 3 + Math.min(4, cfg.n);
        if (this.count < total && this.timer > 0.6 + this.count * 0.4) {
          const r = this.count === 0 ? 0 : rand(1.5, 4.5);
          const a = rand(0, TAU);
          const x = pp.x + player.phys.vel.x * 0.4 + Math.cos(a) * r;
          const z = pp.z + player.phys.vel.z * 0.4 + Math.sin(a) * r;
          g.obstacles.spawnDrop(x, z, cfg.n >= 2 && Math.random() < 0.35 ? 'duck' : 'anvil');
          this.count++;
        }
        if (this.count >= total && this.timer > 0.6 + total * 0.4 + 1.2) this.enter('cooldown');
        break;
      }
      case 'wheels': {
        alienMood = 'happy';
        this.flyTo(pp.x, pp.z, 13, cfg.ufoSpeed * 0.6, dt);
        const total = 2 + Math.min(3, Math.floor(cfg.n / 2));
        if (this.count < total && this.timer > 0.5 + this.count * 1.0) {
          const a = rand(0, TAU);
          const sx = clamp(pp.x + Math.cos(a) * 24, -38, 38);
          const sz = clamp(pp.z + Math.sin(a) * 24, -38, 38);
          g.obstacles.spawnWheel(sx, sz, pp.x - sx, pp.z - sz);
          this.count++;
        }
        if (this.count >= total && this.timer > total * 1.0 + 1.5) this.enter('cooldown');
        break;
      }
      case 'sweep':
        alienMood = 'angry';
        this.updateSweep(dt);
        break;
      case 'magnet':
        alienMood = 'happy';
        this.updateMagnet(dt);
        break;
      case 'trap': {
        if (this.phase === 0) {
          // Pick a spot a short sprint away from the cow.
          for (let i = 0; i < 20; i++) {
            const a = rand(0, TAU);
            const d = rand(7, 13);
            const x = pp.x + Math.cos(a) * d;
            const z = pp.z + Math.sin(a) * d;
            if (Math.abs(x) < 36 && Math.abs(z) < 36 && g.collision.isClear(x, z, 1.5)) {
              this.trapSpot = new THREE.Vector3(x, 0, z);
              break;
            }
          }
          if (!this.trapSpot) {
            this.enter('charge');
            break;
          }
          this.phase = 1;
        }
        const d = this.flyTo(this.trapSpot.x, this.trapSpot.z, 9, cfg.ufoSpeed * 1.6, dt);
        if (d < 1 || this.timer > 3) {
          g.obstacles.spawnTrap(this.trapSpot.x, this.trapSpot.z);
          this.trapSpot = null;
          this.enter('hunt');
          this.timer -= 2;
        }
        break;
      }
      case 'retreat': {
        spin = 20;
        alienMood = 'sad';
        this.vel.y = (this.vel.y || 0) + dt * 12;
        p.y += this.vel.y * dt;
        p.x += dt * 30;
        break;
      }
      case 'disco': {
        spin = 6;
        alienMood = 'laugh';
        bubble = '♪';
        this.flyTo(0, 4, 12, 10, dt);
        beamTarget = 1;
        beamColor = _c.setHSL((this.time * 0.5) % 1, 0.9, 0.6).getHex();
        break;
      }
      case 'distract': {
        const npc = this.target;
        alienMood = 'happy';
        const d = this.flyTo(npc.pos.x, npc.pos.z, 11, 14, dt);
        if (d < 2 && this.phase === 0) {
          this.phase = 1;
          npc.abduct(this.root.position);
        }
        if (this.phase === 1) beamTarget = 1;
        if (this.phase === 1 && npc.state !== 'abducted') this.enter('celebrate');
        if (this.timer > 9) this.enter('cooldown');
        break;
      }
      default:
        break;
    }

    // --- visuals ---------------------------------------------------------------
    this.beamLevel = damp(this.beamLevel, beamTarget, beamTarget > this.beamLevel ? 10 : 6, dt);
    if (this.state !== 'charge') this.beamWidth = damp(this.beamWidth, 1, 8, dt);
    const gy = this.groundBelow(p.x, p.z);
    this.groundPoint.set(p.x, gy, p.z);
    const h = Math.max(0.5, p.y - 0.7 - gy);
    this.beam.visible = this.beamLevel > 0.02;
    this.beam.scale.set(this.beamWidth, h, this.beamWidth);
    this.beamMat.uniforms.time.value = this.time;
    this.beamMat.uniforms.opacity.value = this.beamLevel;
    this.beamMat.uniforms.color.value.setHex(beamColor);
    this.ring.position.set(p.x, gy + 0.08, p.z);
    this.disc.position.set(p.x, gy + 0.06, p.z);
    const warnPulse = ringWarn ? 0.5 + 0.5 * Math.sin(this.time * 20) : 0;
    this.ringMat.color.setHex(ringWarn ? 0xff3b5c : beamColor);
    this.ringMat.opacity = Math.max(this.beamLevel * 0.8, warnPulse * 0.9);
    this.discMat.color.setHex(ringWarn ? 0xff3b5c : beamColor);
    this.discMat.opacity = Math.max(this.beamLevel * 0.18, warnPulse * 0.25);
    if (this.beamLevel > 0.5 && Math.random() < dt * 30) {
      g.effects.beamSparkle(tmp.set(p.x, gy + Math.random() * h, p.z));
    }

    // Wobble, tilt into motion, spin and blink.
    this.tilt.position.y = Math.sin(this.time * 2.2) * 0.3;
    this.tilt.rotation.x = damp(this.tilt.rotation.x, this.vel.z * 0.025, 4, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, -this.vel.x * 0.025, 4, dt);
    this.tilt.rotation.y += dt * spin;
    this.lights.forEach((m, i) => {
      const on = (Math.floor(this.time * 8) + i) % 3 === 0;
      const hex = this.state === 'disco' ? _c.setHSL(((i / 12) + this.time) % 1, 1, 0.6).getHex() : ringWarn ? 0xff3b5c : 0x7ff6ff;
      m.color.setHex(hex);
      m.emissive.setHex(hex);
      m.emissiveIntensity = on ? 2.4 : 0.5;
    });
    this.emitterMat.emissiveIntensity = 0.8 + this.beamLevel * 2;

    // The alien counter-rotates so it always faces the camera-ish direction.
    this.alien.rotation.y = -this.tilt.rotation.y + Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z);
    const am = this.alienMouth.scale;
    if (alienMood === 'laugh') {
      this.alien.position.y = 0.95 + Math.abs(Math.sin(this.time * 18)) * 0.15;
      am.set(0.18, 0.12 + Math.abs(Math.sin(this.time * 18)) * 0.06, 0.05);
    } else if (alienMood === 'angry') {
      this.alien.position.y = 0.95;
      am.set(0.16, 0.03, 0.04);
    } else if (alienMood === 'sad') {
      this.alien.position.y = 0.8;
      am.set(0.1, 0.06, 0.04);
    } else if (alienMood === 'confused') {
      this.alien.position.y = 0.95;
      this.alien.rotation.z = Math.sin(this.time * 3) * 0.3;
      am.set(0.06, 0.06, 0.04);
    } else {
      this.alien.position.y = 0.95 + Math.sin(this.time * 4) * 0.04;
      this.alien.rotation.z = 0;
      am.set(alienMood === 'happy' ? 0.16 : 0.12, alienMood === 'happy' ? 0.08 : 0.04, 0.04);
    }
    this.bubble.visible = !!bubble;
    if (bubble) {
      this.bubble.material.map = this.symbols[bubble];
      this.bubble.scale.setScalar(1.3 + Math.sin(this.time * 8) * 0.1);
    }

    // Roofs flying home.
    for (const barn of g.world.barns) {
      if (barn.roofState !== 'returning') continue;
      barn.roofTimer += dt;
      const k = Math.min(1, barn.roofTimer / 1.2);
      barn.roof.position.lerpVectors(barn.returnFrom, barn.roofHome.pos, k);
      barn.roof.position.y += Math.sin(k * Math.PI) * 4;
      barn.roof.quaternion.slerpQuaternions(barn.returnQuat, barn.roofHome.quat, k);
      barn.roof.scale.setScalar(barn.returnScale + (1 - barn.returnScale) * k);
      if (k >= 1) {
        barn.roofState = 'home';
        barn.zone.enabled = true;
        g.effects.landPuff(tmp.copy(barn.zone.center).setY(4.4), 2);
        g.effects.shake(0.25);
        g.audio.land(1);
      }
    }
  }

  updateSweep(dt) {
    const g = this.game;
    const p = this.root.position;
    const pp = g.player.pos;
    const gy = this.groundBelow(p.x, p.z);
    const alt = 4.8;
    if (this.phase === 0) {
      // Hover a few metres off to one side so the cow ends up mid-arm, not
      // safely under the hub.
      if (this.timer < dt * 1.5) this.sweepOffset = rand(0, TAU);
      const ox = Math.cos(this.sweepOffset) * 5;
      const oz = Math.sin(this.sweepOffset) * 5;
      const d = this.flyTo(pp.x + ox, pp.z + oz, alt, this.cfg.ufoSpeed, dt);
      if ((d < 2 && this.timer > 1) || this.timer > 3.5) {
        this.phase = 1;
        this.timer = 0;
        this.armAngle = rand(0, TAU);
        g.audio.alarm();
        g.effects.popup('SPIN ATTACK!', tmp.copy(p).setY(p.y + 2.5), 'comic bad');
      }
    } else {
      this.vel.multiplyScalar(Math.exp(-5 * dt));
      p.x += this.vel.x * dt;
      p.z += this.vel.z * dt;
      p.y = damp(p.y, gy + alt, 3, dt);
    }
    const hubY = gy + 0.95;
    this.arm.visible = this.phase > 0;
    this.armPole.scale.y = Math.max(0.1, p.y - 0.6 - hubY);
    this.armPole.position.y = -0.6;
    this.armSpin.position.y = hubY - p.y;
    this.sweepRing.position.set(p.x, gy + 0.1, p.z);
    let ext = 0;
    if (this.phase === 1) {
      ext = Math.min(1, this.timer / 1.2);
      this.sweepRingMat.opacity = 0.35 + 0.35 * Math.sin(this.time * 20);
      if (this.timer > 1.3) {
        this.phase = 2;
        this.timer = 0;
        g.audio.zap();
      }
    } else if (this.phase === 2) {
      ext = 1;
      this.sweepRingMat.opacity = 0.25;
      const w = 2.4 + this.cfg.n * 0.15;
      this.armAngle += w * dt;
      this.checkArmHit(hubY, w);
      if (this.timer > (TAU * 2) / w) {
        this.phase = 3;
        this.timer = 0;
      }
    } else if (this.phase === 3) {
      ext = 1 - Math.min(1, this.timer / 0.5);
      this.sweepRingMat.opacity = 0;
      if (this.timer > 0.6) {
        this.sweepRingMat.opacity = 0;
        this.enter('cooldown');
        return;
      }
    }
    if (this.phase === 0) this.sweepRingMat.opacity = 0;
    this.armSpin.scale.set(Math.max(0.01, ext), 1, 1);
    // armSpin is a child of root (not the spinning tilt group), so set absolute yaw.
    this.armSpin.rotation.y = this.armAngle ?? 0;
  }

  checkArmHit(hubY, w) {
    const g = this.game;
    const player = g.player;
    if (player.invuln > 0 || player.busy || player.hidden) return;
    const pp = player.pos;
    if (pp.y > hubY + 0.45) return; // jumped over it!
    const p = this.root.position;
    const a = this.armAngle;
    // Arm direction in world space for rotation.y = a: local +X -> (cos a, -sin a).
    const ax = Math.cos(a);
    const az = -Math.sin(a);
    const rx = pp.x - p.x;
    const rz = pp.z - p.z;
    const along = rx * ax + rz * az;
    if (along < 0.6 || along > ARM_LEN + 0.9) return;
    const perp = Math.abs(rx * az - rz * ax);
    if (perp > 1.0) return;
    // Sweep direction is the tangent of the spin.
    const tx = -Math.sin(a) * Math.sign(w);
    const tz = -Math.cos(a) * Math.sign(w);
    player.launch(tx + ax * 0.4, tz + az * 0.4, 17, 12, 'glove');
    g.audio.boing();
    g.effects.impact(tmp.copy(pp).setY(pp.y + 1));
    g.effects.popup('POW!', tmp.copy(pp).setY(pp.y + 2.5), 'comic');
    g.effects.shake(0.45);
    g.score.registerHit();
  }

  updateMagnet(dt) {
    const g = this.game;
    const p = this.root.position;
    const player = g.player;
    const pp = player.pos;
    if (this.phase === 0) {
      const d = this.flyTo(pp.x, pp.z, 10, this.cfg.ufoSpeed, dt);
      if (d < 4 || this.timer > 3) {
        this.phase = 1;
        this.timer = 0;
        g.effects.popup('MAGNETIC BELL!', tmp.copy(p).setY(p.y + 2.5), 'comic bad');
        g.audio.zap();
      }
      return;
    }
    this.flyTo(pp.x, pp.z, 10, 2.5, dt);
    this.magnet.visible = true;
    const drop = Math.min(1, this.timer / 0.6) * 4;
    this.magnetCable.scale.y = drop;
    this.magnetCable.position.y = -0.6;
    this.magnetBody.position.y = -0.6 - drop - 0.5;
    this.magnetBody.rotation.y += dt * 2;
    if (this.phase === 1 && this.timer > 0.6) {
      this.phase = 2;
      this.timer = 0;
    }
    if (this.phase === 2) {
      if (!player.hidden && !player.busy && player.invuln <= 0) {
        tmp2.set(p.x - pp.x, 0, p.z - pp.z);
        const d = tmp2.length();
        if (d > 0.5 && d < 26) {
          player.phys.external.copy(tmp2.multiplyScalar(5.5 / d));
          if (Math.random() < dt * 20) g.effects.sparkle(tmp.copy(pp).setY(pp.y + 1.2), [0x9ff5ff, 0xffffff]);
        }
      }
      if (this.timer > 3.2) {
        this.magnet.visible = false;
        this.enter('charge');
      }
    }
  }

  returnHat(instant) {
    const barn = this.hat;
    if (!barn) return;
    this.hat = null;
    this.hatTimer = 0;
    const world = this.game.world;
    if (instant) {
      world.resetBarns();
      return;
    }
    barn.group.attach(barn.roof);
    barn.returnFrom = barn.roof.position.clone();
    barn.returnQuat = barn.roof.quaternion.clone();
    barn.returnScale = barn.roof.scale.x;
    barn.roofTimer = 0;
    barn.roofState = 'returning';
  }

  // Shrinks the stolen roof down into a silly hat once it's attached.
  updateHat(dt) {
    if (!this.hat) return;
    const r = this.hat.roof;
    r.position.lerp(tmp2.set(0, 0.75, 0), 1 - Math.exp(-5 * dt));
    r.quaternion.slerp(IDENTITY, 1 - Math.exp(-5 * dt));
    const s = damp(r.scale.x, 0.62, 5, dt);
    r.scale.setScalar(s);
  }
}
