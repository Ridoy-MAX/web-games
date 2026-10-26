import * as THREE from 'three';
import { Body } from '../fighters/Body.js';
import { Animator } from '../fighters/Poses.js';
import { ClipAnimator, ModelBody, hasModels, modelIds } from '../fighters/Models.js';
import { mat, mesh } from '../utils/materials.js';
import { pick, rand } from '../utils/math.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 4;
  return t;
}

function textBoard(lines, { bg = '#ffffff', fg = '#1b1b2f', w = 512, h = 320, font = 44, title = null, titleColor = '#e63946' }) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    let y = 50;
    if (title) {
      g.fillStyle = titleColor;
      g.font = `bold ${font + 12}px "Lilita One", sans-serif`;
      g.fillText(title, 24, y + 10);
      y += font + 30;
    }
    g.fillStyle = fg;
    g.font = `${font}px "Lilita One", sans-serif`;
    for (const l of lines) {
      g.fillText(l, 24, y);
      y += font + 12;
    }
  });
}

function skyline(top, bottom, lit) {
  return canvasTex(1024, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; ) {
      const bw = rand(40, 110);
      const bh = rand(90, 300);
      g.fillStyle = `rgba(30, 40, 70, ${rand(0.6, 0.9)})`;
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = lit;
      for (let wy = h - bh + 10; wy < h - 10; wy += 18) {
        for (let wx = x + 6; wx < x + bw - 8; wx += 14) if (Math.random() < 0.45) g.fillRect(wx, wy, 6, 9);
      }
      x += bw + rand(4, 16);
    }
  });
}

function codeScreen() {
  const colors = ['#7ef0c0', '#ff8fab', '#9ccfff', '#ffe066', '#c8b6ff'];
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#10142b';
    g.fillRect(0, 0, w, h);
    for (let y = 14; y < h; y += 14) {
      let x = 10 + Math.floor(rand(0, 4)) * 12;
      while (x < w - 20 && Math.random() < 0.85) {
        const len = rand(14, 60);
        g.fillStyle = pick(colors);
        g.fillRect(x, y - 6, len, 6);
        x += len + 8;
      }
    }
  });
}

function box(w, h, d, color, opts) {
  return mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color, opts) : color, { receive: true });
}

function desk(screenTex) {
  const g = new THREE.Group();
  const top = box(2.2, 0.08, 1.0, 0xd9c7a3);
  top.position.y = 1.0;
  g.add(top);
  for (const x of [-1.0, 1.0]) {
    const leg = box(0.06, 1.0, 0.9, 0x8d99ae, { metal: 0.6 });
    leg.position.set(x, 0.5, 0);
    g.add(leg);
  }
  const monitor = box(0.9, 0.55, 0.06, 0x1b1b1f);
  monitor.position.set(0, 1.5, -0.2);
  g.add(monitor);
  const screen = mesh(new THREE.PlaneGeometry(0.82, 0.48), new THREE.MeshBasicMaterial({ map: screenTex }), { cast: false });
  screen.position.set(0, 1.5, -0.165);
  g.add(screen);
  const stand = box(0.08, 0.25, 0.08, 0x1b1b1f);
  stand.position.set(0, 1.15, -0.2);
  g.add(stand);
  const kb = box(0.6, 0.03, 0.2, 0x2b2b2b);
  kb.position.set(0, 1.06, 0.15);
  g.add(kb);
  const mug = mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.15, 10), mat(pick([0xffffff, 0xe63946, 0x3a86ff, 0xffd23f])));
  mug.position.set(0.7, 1.12, 0.1);
  g.add(mug);
  return g;
}

function plant() {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 10), mat(0xc97b45));
  pot.position.y = 0.25;
  g.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.16, 1.1, 4), mat(pick([0x3f9a4b, 0x52b043, 0x2f7a3e])));
    leaf.position.set(rand(-0.15, 0.15), 0.9, rand(-0.15, 0.15));
    leaf.rotation.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5));
    g.add(leaf);
  }
  return g;
}

function waterCooler() {
  const g = new THREE.Group();
  const base = box(0.6, 1.1, 0.6, 0xf2f2f2);
  base.position.y = 0.55;
  const jug = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 14), new THREE.MeshStandardMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.7, roughness: 0.1 }));
  jug.position.y = 1.45;
  g.add(base, jug);
  return g;
}

const CROWD_TOPS = ['blazer', 'hoodie', 'tshirt', 'cardigan', 'fleece', 'suit'];
const CROWD_HAIR = ['messy', 'bob', 'bun', 'ponytail', 'slick', 'side', 'bald', 'spiky'];
const SKINS = [0xe9bf9f, 0xd6a07c, 0xb07a55, 0x8a5636, 0x5e3a24, 0xf0cdb4];

function crowdLook(formal) {
  const top = formal ? pick(['suit', 'blazer']) : pick(CROWD_TOPS);
  const colors = [0x3a86ff, 0xe63946, 0x2a9d8f, 0x6d597a, 0xff9f1c, 0x264653, 0x8338ec, 0x59606b, 0x1d2b53];
  return {
    skin: pick(SKINS), hair: pick(CROWD_HAIR), hairColor: pick([0x1e1410, 0x3b2414, 0xd9b25c, 0x7a6a5a, 0xb3302b, 0xe8e8e8]),
    top, topColor: pick(colors), lapel: 0x222222, shirt: 0xf4f1de, pants: pick([0x2b2d42, 0x3d5a80, 0x4a4a52, 0xc2a878]),
    shoes: 0x222222, glasses: Math.random() < 0.35 ? pick(['round', 'square']) : null, tie: formal && Math.random() < 0.7 ? pick([0xe63946, 0xd4a017, 0x3a86ff]) : null,
    sleeves: top === 'tshirt' ? 'short' : 'long', scale: rand(0.82, 0.92), belt: false,
  };
}

class Crowd {
  constructor(parent, count, formal, zBase) {
    this.members = [];
    for (let i = 0; i < count; i++) {
      const models = hasModels();
      const body = models ? new ModelBody(pick(modelIds()), { scale: rand(0.9, 0.97) }) : new Body(crowdLook(formal));
      body.setShadows(false);
      const anim = models ? new ClipAnimator(body) : new Animator(body);
      anim.snap('neutral');
      body.root.position.set(-9 + (18 / (count - 1)) * i + rand(-0.4, 0.4), 0, zBase + rand(-0.5, 0.4));
      body.root.rotation.y = rand(-0.3, 0.3);
      parent.add(body.root);
      this.members.push({ body, anim, excite: 0, phase: rand(0, 6), pose: 'neutral' });
    }
  }

  react(power) {
    for (const m of this.members) if (Math.random() < 0.35 * power) m.excite = Math.max(m.excite, rand(0.6, 1.2) * power);
  }

  update(dt) {
    for (const m of this.members) {
      m.excite = Math.max(0, m.excite - dt * 0.8);
      const want = m.excite > 0.4 ? 'cheer' : m.excite > 0.1 ? 'point' : 'neutral';
      if (want !== m.pose) {
        m.pose = want;
        m.anim.set(want, 8);
      }
      m.anim.update(dt, { breathe: true, plant: true });
      m.phase += dt * (3 + m.excite * 8);
      m.body.root.position.y = m.excite > 0.3 ? Math.abs(Math.sin(m.phase)) * 0.25 : 0;
    }
  }
}

// Three stages. Only the active one is visible.
export class Arena {
  constructor(scene, lowQuality = false) {
    this.scene = scene;
    // Fewer background coworkers on phones and slower machines.
    this.crowdScale = lowQuality ? 0.55 : 1;
    this.stages = {};
    this.current = null;
    this.leds = [];
    this.time = 0;
  }

  set(id) {
    if (!this.stages[id]) this.stages[id] = this[`build_${id}`]();
    for (const [k, s] of Object.entries(this.stages)) s.group.visible = k === id;
    this.current = this.stages[id];
    return this.current;
  }

  get crowd() {
    return this.current?.crowd;
  }

  floor(group, tex, color = 0xffffff) {
    const f = mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.9 }), { cast: false, receive: true });
    f.rotation.x = -Math.PI / 2;
    f.position.z = -2;
    group.add(f);
    // Caution-tape "ring" on the floor.
    const tape = canvasTex(256, 32, (g, w, h) => {
      for (let x = -h; x < w + h; x += 32) {
        g.fillStyle = '#ffd23f';
        g.fillRect(x, 0, 16, h);
        g.fillStyle = '#1b1b1f';
        g.beginPath();
        g.moveTo(x + 16, 0);
        g.lineTo(x + 32, 0);
        g.lineTo(x + 16 + h, h);
        g.lineTo(x + h, h);
        g.fill();
      }
    }, [8, 1]);
    for (const z of [-1.6, 1.6]) {
      const strip = mesh(new THREE.PlaneGeometry(18, 0.18), new THREE.MeshStandardMaterial({ map: tape, roughness: 0.8 }), { cast: false, receive: true });
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.005, z);
      group.add(strip);
    }
  }

  build_office() {
    const group = new THREE.Group();
    this.scene.add(group);
    const carpet = canvasTex(256, 256, (g, w) => {
      g.fillStyle = '#5c6b8a';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 4; i++) {
        for (let k = 0; k < 4; k++) {
          g.fillStyle = (i + k) % 2 ? '#56647f' : '#617092';
          g.fillRect(i * 64 + 1, k * 64 + 1, 62, 62);
        }
      }
    }, [10, 5]);
    this.floor(group, carpet);
    const wall = box(44, 9, 0.3, 0xe9e2d0);
    wall.position.set(0, 4.5, -6.5);
    group.add(wall);
    const win = mesh(new THREE.PlaneGeometry(16, 4.2), new THREE.MeshBasicMaterial({ map: skyline('#6ec3f5', '#cfefff', '#ffe9a8') }), { cast: false });
    win.position.set(-2, 4.2, -6.33);
    group.add(win);
    for (let x = -10; x <= 6; x += 2) {
      const mullion = box(0.12, 4.3, 0.1, 0x8d99ae);
      mullion.position.set(x, 4.2, -6.3);
      group.add(mullion);
    }
    const board = mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshStandardMaterial({ map: textBoard(['1. Synergy', '2. ???', '3. PROFIT', '4. Fix the coffee machine'], { title: 'Q3 GOALS' }) }), { cast: false });
    board.position.set(9.2, 3.6, -6.33);
    group.add(board);
    const poster = mesh(new THREE.PlaneGeometry(1.6, 2.1), new THREE.MeshStandardMaterial({ map: textBoard(['TEAMWORK', 'MAKES THE', 'DREAM WORK', '(mostly)'], { bg: '#1d2b53', fg: '#ffffff', title: 'SYNERGY', titleColor: '#ffd23f', w: 320, h: 420, font: 40 }) }), { cast: false });
    poster.position.set(7.0, 3.9, -6.33);
    group.add(poster);
    const cat = mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshStandardMaterial({ map: textBoard(['🐱', 'HANG IN', 'THERE'], { bg: '#ffe9c7', fg: '#6b3a1f', w: 300, h: 380, font: 56 }) }), { cast: false });
    cat.position.set(-12, 3.9, -6.33);
    group.add(cat);
    const screenTex = codeScreen();
    for (let i = 0; i < 5; i++) {
      const d = desk(screenTex);
      d.position.set(-9 + i * 4.5, 0, -4.4);
      group.add(d);
    }
    const cooler = waterCooler();
    cooler.position.set(-13, 0, -2.6);
    group.add(cooler);
    for (const x of [-11.5, 12, 4]) {
      const p = plant();
      p.position.set(x, 0, x === 4 ? -5.8 : -1.5);
      group.add(p);
    }
    for (let x = -12; x <= 12; x += 6) {
      const light = box(2.4, 0.08, 1, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff7e0, emissiveIntensity: 1.2 }));
      light.position.set(x, 7.5, -2);
      group.add(light);
    }
    const crowd = new Crowd(group, Math.round(8 * this.crowdScale), false, -5.4);
    return { group, crowd, light: { hemi: [0xfff7e8, 0x6b6f7a, 1.4], sun: [0xfff2d8, 2.2], bg: 0xcfe9ff, fog: 0xdfe9f2 } };
  }

  build_server() {
    const group = new THREE.Group();
    this.scene.add(group);
    const grate = canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#2b3040';
      g.fillRect(0, 0, w, w);
      g.strokeStyle = '#3d4459';
      g.lineWidth = 4;
      for (let i = 0; i <= w; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, w);
        g.moveTo(0, i);
        g.lineTo(w, i);
        g.stroke();
      }
    }, [24, 10]);
    this.floor(group, grate);
    const wall = box(44, 9, 0.3, 0x1b1f2e);
    wall.position.set(0, 4.5, -7);
    group.add(wall);
    const ledColors = [0x2ee66b, 0x3a86ff, 0xff3b5c, 0xffd23f];
    for (let i = -6; i <= 6; i++) {
      const rack = box(1.4, 4.4, 1.2, 0x23283a, { metal: 0.5, rough: 0.4 });
      rack.position.set(i * 1.6, 2.2, -5.6);
      group.add(rack);
      for (let k = 0; k < 9; k++) {
        const unit = box(1.2, 0.3, 0.05, 0x2f354a);
        unit.position.set(i * 1.6, 0.5 + k * 0.42, -4.98);
        group.add(unit);
        const led = mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshBasicMaterial({ color: pick(ledColors) }), { cast: false });
        led.position.set(i * 1.6 + 0.45, 0.5 + k * 0.42, -4.95);
        group.add(led);
        this.leds.push({ m: led, rate: rand(1, 6), phase: rand(0, 6) });
      }
    }
    const sign = mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: textBoard(['DO NOT TOUCH', 'THE BLINKING ONE'], { bg: '#e63946', fg: '#ffffff', w: 512, h: 180, font: 52 }) }), { cast: false });
    sign.position.set(0, 6.0, -6.8);
    group.add(sign);
    for (const x of [-10, 10]) {
      const glow = new THREE.PointLight(0x6a8dff, 18, 14);
      glow.position.set(x, 4, -2);
      group.add(glow);
    }
    const crowd = new Crowd(group, Math.round(6 * this.crowdScale), false, -3.9);
    return { group, crowd, light: { hemi: [0xa8b8ff, 0x2a3048, 1.6], sun: [0xd0dcff, 2.0], bg: 0x0f1424, fog: 0x141a2e } };
  }

  build_boardroom() {
    const group = new THREE.Group();
    this.scene.add(group);
    const wood = canvasTex(256, 256, (g, w) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#7a4a2a' : '#8a5634';
        g.fillRect(0, i * 32, w, 32);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(rand(0, w), i * 32 + 4, rand(40, 120), 2);
      }
    }, [10, 5]);
    this.floor(group, wood);
    const wall = box(44, 9, 0.3, 0x2a1e1a);
    wall.position.set(0, 4.5, -7);
    group.add(wall);
    const win = mesh(new THREE.PlaneGeometry(26, 5.2), new THREE.MeshBasicMaterial({ map: skyline('#ff8a5c', '#ffd8a8', '#fff1b8') }), { cast: false });
    win.position.set(0, 4.3, -6.83);
    group.add(win);
    const table = box(10, 0.15, 2, 0x3a2416, { rough: 0.3 });
    table.position.set(0, 1.0, -5.0);
    group.add(table);
    for (let x = -4; x <= 4; x += 1.6) {
      const chair = box(0.7, 1.4, 0.15, 0x111111);
      chair.position.set(x, 1.0, -5.9);
      group.add(chair);
    }
    const portrait = mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.MeshStandardMaterial({ map: textBoard(['👑', 'OUR', 'FOUNDER'], { bg: '#d4a017', fg: '#2a1e1a', w: 300, h: 380, font: 60 }), metalness: 0.4, roughness: 0.4 }), { cast: false });
    portrait.position.set(12.5, 4.2, -6.83);
    group.add(portrait);
    const chart = mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshBasicMaterial({ map: textBoard(['📈 +420%', 'BONUSES: MINE', 'RAISES: NO'], { bg: '#10142b', fg: '#7ef0c0', title: 'Q4 PROFITS', titleColor: '#ffd23f' }) }), { cast: false });
    chart.position.set(-12.2, 4.2, -6.83);
    group.add(chart);
    const crowd = new Crowd(group, Math.round(7 * this.crowdScale), true, -4.0);
    return { group, crowd, light: { hemi: [0xffe0c0, 0x3a2416, 1.3], sun: [0xffb37a, 2.4], bg: 0xffc79a, fog: 0xffd2b0 } };
  }

  update(dt) {
    this.time += dt;
    this.current?.crowd.update(dt);
    if (this.current === this.stages.server) {
      for (const l of this.leds) l.m.visible = Math.sin(this.time * l.rate + l.phase) > -0.3;
    }
  }
}
