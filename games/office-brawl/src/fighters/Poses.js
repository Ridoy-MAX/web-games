import { damp } from '../utils/math.js';

// Joint rotations in radians for a body facing +Z.
// Conventions: shoulder/hip x < 0 swings the limb forward; elbow x < 0 bends the
// forearm up; knee x > 0 bends the shin back; spine x > 0 leans forward;
// lShoulder z > 0 / rShoulder z < 0 raises the arm out to the side.
const GUARD = {
  lShoulder: [-1.1, 0, 0.2],
  lElbow: [-1.75, 0, 0],
  rShoulder: [-0.75, 0, -0.2],
  rElbow: [-2.0, 0, 0],
};

const STANCE_LEGS = {
  lHip: [-0.4, 0, 0.08],
  lKnee: [0.5, 0, 0],
  rHip: [0.32, 0, -0.06],
  rKnee: [0.35, 0, 0],
};

export const POSES = {
  idle: { hipsY: -0.08, spine: [0.1, 0, 0], chest: [0, 0.3, 0], neck: [0, -0.25, 0], ...GUARD, ...STANCE_LEGS },
  neutral: { hipsY: 0, lShoulder: [0, 0, 0.12], rShoulder: [0, 0, -0.12], lElbow: [-0.2, 0, 0], rElbow: [-0.2, 0, 0] },
  crouch: {
    hipsY: -0.42, spine: [0.35, 0, 0], chest: [0, 0.3, 0], neck: [-0.2, -0.25, 0], ...GUARD,
    lHip: [-1.5, 0, 0.15], lKnee: [2.1, 0, 0], rHip: [-0.9, 0, -0.15], rKnee: [2.0, 0, 0],
  },
  jump: {
    hipsY: 0, spine: [0.15, 0, 0], ...GUARD, lShoulder: [-1.5, 0, 0.5], rShoulder: [-1.3, 0, -0.5],
    lHip: [-1.2, 0, 0.1], lKnee: [1.9, 0, 0], rHip: [-0.7, 0, -0.1], rKnee: [1.6, 0, 0],
  },
  block: {
    hipsY: -0.12, spine: [-0.05, 0, 0], chest: [0, 0.1, 0], neck: [0.25, -0.1, 0],
    lShoulder: [-1.35, 0, -0.35], lElbow: [-2.1, 0, 0], rShoulder: [-1.35, 0, 0.35], rElbow: [-2.1, 0, 0], ...STANCE_LEGS,
  },
  crouchBlock: {
    hipsY: -0.42, spine: [0.3, 0, 0], neck: [0.1, 0, 0],
    lShoulder: [-1.3, 0, -0.35], lElbow: [-2.1, 0, 0], rShoulder: [-1.3, 0, 0.35], rElbow: [-2.1, 0, 0],
    lHip: [-1.5, 0, 0.15], lKnee: [2.1, 0, 0], rHip: [-0.9, 0, -0.15], rKnee: [2.0, 0, 0],
  },
  punchWind: { hipsY: -0.1, spine: [0.05, 0, 0], chest: [0, 0.75, 0], neck: [0, -0.6, 0], ...GUARD, rShoulder: [-0.6, 0, -0.3], rElbow: [-2.3, 0, 0], ...STANCE_LEGS },
  punch: {
    hipsY: -0.1, spine: [0.22, 0, 0], chest: [0, -0.45, 0], neck: [0, 0.4, 0],
    lShoulder: [-0.9, 0, 0.3], lElbow: [-1.9, 0, 0], rShoulder: [-1.6, 0, 0.05], rElbow: [-0.05, 0, 0], ...STANCE_LEGS,
  },
  kickWind: {
    hipsY: -0.04, spine: [-0.15, 0, 0], chest: [0, 0.3, 0], ...GUARD, lShoulder: [-0.6, 0, 0.6], rShoulder: [-0.4, 0, -0.6],
    lHip: [-0.1, 0, 0.05], lKnee: [0.2, 0, 0], rHip: [-1.3, 0, 0], rKnee: [2.0, 0, 0],
  },
  kick: {
    hipsY: 0, spine: [-0.4, 0, 0], chest: [0, 0.2, 0], neck: [0.3, 0, 0],
    lShoulder: [-0.3, 0, 0.95], lElbow: [-0.6, 0, 0], rShoulder: [-0.2, 0, -0.95], rElbow: [-0.6, 0, 0],
    lHip: [0.05, 0, 0.05], lKnee: [0.15, 0, 0], rHip: [-1.65, 0, 0], rKnee: [0.05, 0, 0],
  },
  lowPunch: {
    hipsY: -0.42, spine: [0.5, 0, 0], chest: [0, -0.4, 0], neck: [-0.3, 0.3, 0],
    lShoulder: [-1.0, 0, 0.3], lElbow: [-1.8, 0, 0], rShoulder: [-1.4, 0, 0], rElbow: [-0.1, 0, 0],
    lHip: [-1.5, 0, 0.15], lKnee: [2.1, 0, 0], rHip: [-0.9, 0, -0.15], rKnee: [2.0, 0, 0],
  },
  sweep: {
    hipsY: -0.55, spine: [0.45, 0, 0], chest: [0, 0.2, 0], neck: [-0.4, 0, 0], ...GUARD,
    lHip: [-1.7, 0, 0.2], lKnee: [2.3, 0, 0], rHip: [-1.45, 0, -0.45], rKnee: [0.05, 0, 0],
  },
  airKick: {
    hipsY: 0.1, spine: [-0.3, 0, 0], ...GUARD, lShoulder: [-0.5, 0, 0.8], rShoulder: [-0.4, 0, -0.8],
    lHip: [-0.9, 0, 0.1], lKnee: [1.9, 0, 0], rHip: [-1.4, 0, 0], rKnee: [0.05, 0, 0],
  },
  airPunch: {
    hipsY: 0.05, spine: [0.4, 0, 0], chest: [0, -0.3, 0], lShoulder: [-1.2, 0, 0.5], lElbow: [-1.5, 0, 0], rShoulder: [-2.2, 0, 0], rElbow: [-0.1, 0, 0],
    lHip: [-1.2, 0, 0.1], lKnee: [1.9, 0, 0], rHip: [-0.8, 0, -0.1], rKnee: [1.6, 0, 0],
  },
  throwWind: { hipsY: -0.1, spine: [-0.2, 0, 0], chest: [0, 0.7, 0], neck: [0, -0.5, 0], lShoulder: [-0.9, 0, 0.3], lElbow: [-1.6, 0, 0], rShoulder: [-2.9, 0, -0.2], rElbow: [-1.2, 0, 0], ...STANCE_LEGS },
  throw: { hipsY: -0.12, spine: [0.35, 0, 0], chest: [0, -0.5, 0], neck: [0, 0.4, 0], lShoulder: [-0.4, 0, 0.5], lElbow: [-1.0, 0, 0], rShoulder: [-1.2, 0, 0.1], rElbow: [-0.2, 0, 0], ...STANCE_LEGS },
  castWind: { hipsY: -0.15, spine: [-0.15, 0, 0], chest: [0, 0.2, 0], lShoulder: [-0.6, 0, 0.6], lElbow: [-2.0, 0, 0], rShoulder: [-0.6, 0, -0.6], rElbow: [-2.0, 0, 0], ...STANCE_LEGS },
  cast: { hipsY: -0.15, spine: [0.25, 0, 0], chest: [0, 0, 0], lShoulder: [-1.55, 0, -0.15], lElbow: [-0.05, 0, 0], rShoulder: [-1.55, 0, 0.15], rElbow: [-0.05, 0, 0], ...STANCE_LEGS },
  uppercut: {
    hipsY: 0.05, spine: [-0.25, 0, 0], chest: [0, -0.4, 0], neck: [-0.4, 0, 0],
    lShoulder: [-0.4, 0, 0.6], lElbow: [-1.2, 0, 0], rShoulder: [-3.0, 0, 0], rElbow: [-0.1, 0, 0],
    lHip: [-1.0, 0, 0.1], lKnee: [1.6, 0, 0], rHip: [0.2, 0, 0], rKnee: [0.2, 0, 0],
  },
  dash: {
    hipsY: -0.15, spine: [0.6, 0, 0], chest: [0, -0.3, 0], neck: [-0.5, 0.2, 0],
    lShoulder: [0.8, 0, 0.3], lElbow: [-0.6, 0, 0], rShoulder: [-1.6, 0, 0], rElbow: [-0.05, 0, 0],
    lHip: [-1.0, 0, 0], lKnee: [1.2, 0, 0], rHip: [0.7, 0, 0], rKnee: [0.6, 0, 0],
  },
  slide: {
    hipsY: -0.6, spine: [-0.9, 0, 0], neck: [0.7, 0, 0], lShoulder: [0.6, 0, 0.6], rShoulder: [0.6, 0, -0.6],
    lHip: [-1.5, 0, 0.05], lKnee: [0.1, 0, 0], rHip: [-1.0, 0, -0.1], rKnee: [1.6, 0, 0],
  },
  grab: { hipsY: -0.15, spine: [0.45, 0, 0], neck: [-0.3, 0, 0], lShoulder: [-1.5, 0, -0.4], lElbow: [-0.4, 0, 0], rShoulder: [-1.5, 0, 0.4], rElbow: [-0.4, 0, 0], ...STANCE_LEGS },
  lift: { hipsY: 0, spine: [-0.35, 0, 0], neck: [0.3, 0, 0], lShoulder: [-2.9, 0, -0.2], lElbow: [-0.3, 0, 0], rShoulder: [-2.9, 0, 0.2], rElbow: [-0.3, 0, 0], lHip: [-0.3, 0, 0.1], rHip: [0.2, 0, -0.1] },
  point: { hipsY: -0.05, spine: [0.05, 0, 0], chest: [0, -0.3, 0], lShoulder: [-0.2, 0, 0.3], lElbow: [-1.8, 0, 0], rShoulder: [-1.55, 0, 0], rElbow: [0, 0, 0], ...STANCE_LEGS },
  powerUp: { hipsY: -0.25, spine: [-0.1, 0, 0], neck: [-0.5, 0, 0], lShoulder: [-0.4, 0, 1.2], lElbow: [-1.8, 0, 0], rShoulder: [-0.4, 0, -1.2], rElbow: [-1.8, 0, 0], lHip: [-0.3, 0, 0.35], lKnee: [0.6, 0, 0], rHip: [-0.3, 0, -0.35], rKnee: [0.6, 0, 0] },
  hit: {
    hipsY: -0.05, spine: [-0.45, 0, 0], chest: [0, 0.3, 0.1], neck: [-0.5, 0, 0],
    lShoulder: [0.4, 0, 1.1], lElbow: [-0.5, 0, 0], rShoulder: [0.3, 0, -1.2], rElbow: [-0.4, 0, 0],
    lHip: [-0.4, 0, 0.1], lKnee: [0.6, 0, 0], rHip: [0.4, 0, -0.1], rKnee: [0.3, 0, 0],
  },
  hitLow: {
    hipsY: -0.4, spine: [0.1, 0, 0.2], neck: [-0.4, 0, 0], lShoulder: [0.3, 0, 1.0], rShoulder: [0.3, 0, -1.0],
    lHip: [-1.4, 0, 0.15], lKnee: [2.0, 0, 0], rHip: [-0.9, 0, -0.15], rKnee: [1.9, 0, 0],
  },
  fall: {
    hipsY: 0, spine: [-0.3, 0, 0], neck: [-0.3, 0, 0], lShoulder: [-2.6, 0, 0.5], rShoulder: [-2.6, 0, -0.5], lElbow: [-0.3, 0, 0], rElbow: [-0.3, 0, 0],
    lHip: [-0.9, 0, 0.3], lKnee: [0.9, 0, 0], rHip: [-0.6, 0, -0.3], rKnee: [0.4, 0, 0],
  },
  lying: {
    hipsY: 0, spine: [0, 0, 0], neck: [0.2, 0.6, 0], lShoulder: [-2.8, 0, 0.5], rShoulder: [-0.3, 0, -1.4], lElbow: [-0.3, 0, 0], rElbow: [-0.6, 0, 0],
    lHip: [-0.3, 0, 0.2], lKnee: [0.4, 0, 0], rHip: [0, 0, -0.15], rKnee: [0.1, 0, 0],
  },
  dizzy: { hipsY: -0.1, spine: [0.2, 0, 0.15], neck: [0.3, 0, 0.3], lShoulder: [0.1, 0, 0.5], lElbow: [-0.3, 0, 0], rShoulder: [0.1, 0, -0.5], rElbow: [-0.3, 0, 0], lHip: [-0.2, 0, 0.15], rHip: [0.1, 0, -0.15], lKnee: [0.4, 0, 0], rKnee: [0.4, 0, 0] },
  cheer: { hipsY: 0, spine: [-0.1, 0, 0], neck: [-0.3, 0, 0], lShoulder: [-2.8, 0, 0.4], lElbow: [-0.4, 0, 0], rShoulder: [-2.8, 0, -0.4], rElbow: [-0.4, 0, 0] },
  dab: { hipsY: -0.05, spine: [0.2, 0, 0], chest: [0, 0.4, 0], neck: [0.6, -0.6, 0.2], lShoulder: [-2.0, 0, 1.0], lElbow: [-0.1, 0, 0], rShoulder: [-1.6, 0, 0.9], rElbow: [-2.4, 0, 0], lHip: [-0.1, 0, 0.15], rHip: [0.05, 0, -0.15] },
  flex: { hipsY: -0.05, spine: [-0.1, 0, 0], neck: [-0.15, 0, 0], lShoulder: [-0.1, 0, 1.5], lElbow: [-2.1, 0, 0], rShoulder: [-0.1, 0, -1.5], rElbow: [-2.1, 0, 0], lHip: [-0.1, 0, 0.2], rHip: [0.1, 0, -0.2] },
  phone: { hipsY: 0, spine: [0.05, 0, 0], neck: [0.1, 0.3, 0.1], lShoulder: [-0.4, 0, 0.45], lElbow: [-2.5, 0, 0], rShoulder: [-0.3, 0, 0.5], rElbow: [-1.5, 0, 0], lHip: [-0.1, 0, 0.1], rHip: [0.1, 0, -0.1] },
  bow: { hipsY: 0, spine: [0.6, 0, 0], neck: [0.3, 0, 0], lShoulder: [0.1, 0, 0.1], rShoulder: [-1.3, 0, 0.6], rElbow: [-1.6, 0, 0] },
  shrug: { hipsY: 0, spine: [-0.05, 0, 0], neck: [0, 0, 0.25], lShoulder: [0.2, 0, 0.8], lElbow: [-1.6, 0, 0], rShoulder: [0.2, 0, -0.8], rElbow: [-1.6, 0, 0] },
};

export const JOINTS = ['spine', 'chest', 'neck', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'];
const ZERO = [0, 0, 0];

// Smoothly blends the rig toward a named pose, then layers procedural motion
// (breathing, walking legs, dizzy sway) on top.
export class Animator {
  constructor(body) {
    this.body = body;
    this.cur = Object.fromEntries(JOINTS.map((j) => [j, [0, 0, 0]]));
    this.hipsY = 0;
    this.pose = POSES.idle;
    this.speed = 14;
    this.time = Math.random() * 10;
    this.walk = 0;
    this.walkPhase = 0;
  }

  set(name, speed = 14) {
    this.pose = POSES[name] ?? POSES.idle;
    this.speed = speed;
  }

  snap(name) {
    this.set(name);
    for (const j of JOINTS) this.cur[j] = [...(this.pose[j] ?? ZERO)];
    this.hipsY = this.pose.hipsY ?? 0;
    this.apply(0);
  }

  update(dt, { walk = 0, breathe = true, dizzy = false } = {}) {
    this.time += dt;
    const k = this.speed;
    for (const j of JOINTS) {
      const target = this.pose[j] ?? ZERO;
      const c = this.cur[j];
      for (let i = 0; i < 3; i++) c[i] = damp(c[i], target[i], k, dt);
    }
    this.hipsY = damp(this.hipsY, this.pose.hipsY ?? 0, k, dt);
    this.walk = damp(this.walk, walk, 10, dt);
    this.walkPhase += dt * 9 * Math.sign(walk || 1);
    this.apply(dt, breathe, dizzy);
  }

  apply(dt, breathe = true, dizzy = false) {
    const jn = this.body.j;
    for (const j of JOINTS) {
      const c = this.cur[j];
      jn[j].rotation.set(c[0], c[1], c[2]);
    }
    let hipsY = this.hipsY;
    const t = this.time;
    if (breathe) {
      hipsY += Math.sin(t * 4.2) * 0.025;
      jn.chest.rotation.x += Math.sin(t * 4.2) * 0.03;
    }
    if (Math.abs(this.walk) > 0.01) {
      const s = Math.sin(this.walkPhase) * Math.abs(this.walk);
      jn.lHip.rotation.x += s * 0.55;
      jn.rHip.rotation.x -= s * 0.55;
      jn.lKnee.rotation.x += Math.max(0, -s) * 0.7;
      jn.rKnee.rotation.x += Math.max(0, s) * 0.7;
      hipsY += Math.abs(Math.cos(this.walkPhase)) * 0.04 * Math.abs(this.walk);
    }
    if (dizzy) {
      jn.spine.rotation.z += Math.sin(t * 5) * 0.15;
      jn.head.rotation.z += Math.sin(t * 5 + 1) * 0.25;
    }
    jn.hips.position.y = this.body.rest.hips.y + hipsY;
  }
}
