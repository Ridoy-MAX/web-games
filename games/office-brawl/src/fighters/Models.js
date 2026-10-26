import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BODY_HEIGHT, makeHandProp } from './Body.js';

// Mixamo characters (one per fighter) and one shared animation pack.
// Every Mixamo rig uses the same bone names, so any clip drives any character.
const BASE = '/models/office-brawl';
const IDS = ['junior', 'senior', 'qa', 'hr', 'pm', 'scrum', 'intern', 'chairman'];

const lib = { ready: false, chars: {}, clips: {}, bounds: {}, hipsRatio: {}, scaledClips: {} };

// Each Mixamo download numbers its rig prefix differently (mixamorig7…, mixamorig9…).
// Normalise every bone and track name to plain "mixamorig…" so clips fit all characters.
const normalise = (name) => name.replace(/^mixamorig\d*:?/, 'mixamorig');

export const hasModels = () => lib.ready && Object.keys(lib.chars).length > 0;
export const hasModel = (id) => lib.ready && !!lib.chars[id];
export const modelIds = () => Object.keys(lib.chars);

export async function loadModels(onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  const total = IDS.length + 1;
  const tick = () => onProgress?.(++done / total);
  // A missing character file isn't fatal: that fighter keeps the built-in body.
  const [anims, ...chars] = await Promise.all([
    loader.loadAsync(`${BASE}/anims.glb`).then((g) => (tick(), g)),
    ...IDS.map((id) => loader.loadAsync(`${BASE}/${id}.glb`).then((g) => (tick(), g)).catch(() => (tick(), null))),
  ]);
  for (const clip of anims.animations) {
    for (const t of clip.tracks) t.name = normalise(t.name);
    lib.clips[clip.name] = clip;
  }
  IDS.forEach((id, i) => {
    if (!chars[i]) return;
    const scene = chars[i].scene;
    scene.traverse((o) => {
      o.name = normalise(o.name);
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned meshes move outside their bind-pose bounds
        if (o.material) o.material.userData.shared = true;
      }
    });
    lib.chars[id] = scene;
    // Measure the skinned (rendered) body, not raw bones or bind-pose boxes: some
    // exports keep the skeleton and mesh in different units.
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    lib.bounds[id] = { height: box.max.y - box.min.y || 1, bottom: box.min.y };
    // Clips move the hips in the animation rig's units; rigs exported at a
    // different scale need that motion scaled to match.
    const hips = scene.getObjectByName('mixamorigHips');
    const track = lib.clips.idle?.tracks.find((t) => t.name === 'mixamorigHips.position');
    lib.hipsRatio[id] = hips && track ? hips.position.y / track.values[1] : 1;
  });
  lib.ready = true;
}

const tmp = new THREE.Box3();

// Same interface as Body (root, body, j.head, setExpression, setProp…), backed
// by a skinned Mixamo character instead of primitives.
export class ModelBody {
  constructor(id, look = {}) {
    this.id = id;
    this.animated = true;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.model = SkeletonUtils.clone(lib.chars[id]);
    this.body.add(this.model);
    const bone = (n) => this.model.getObjectByName(`mixamorig${n}`);
    // Normalise to the game's body height using the measured, skinned body.
    const { height, bottom } = lib.bounds[id];
    this.modelScale = (BODY_HEIGHT * (look.scale ?? 1)) / height;
    this.model.scale.multiplyScalar(this.modelScale);
    this.model.position.y = -bottom * this.modelScale;
    this.j = { head: bone('Head'), lHand: bone('LeftHand'), rHand: bone('RightHand'), hips: bone('Hips') };
    this.prop = null;
    if (look.prop) this.setProp(look.prop);
  }

  setExpression() {
    /* Mixamo faces have no blend shapes; expressions come from body language. */
  }

  plantFeet() {
    /* Motion-captured clips already keep the feet on the ground. */
  }

  setShadows(cast) {
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = cast;
    });
  }

  setProp(kind) {
    if (!this.j.lHand) return;
    if (this.prop) this.j.lHand.remove(this.prop);
    this.prop = makeHandProp(kind);
    if (!this.prop) return;
    // Props are built in metres; the hand bone lives in the model's cm space.
    this.j.lHand.updateWorldMatrix(true, false);
    const s = new THREE.Vector3();
    this.j.lHand.getWorldScale(s);
    const world = BODY_HEIGHT / 1.81;
    this.prop.scale.setScalar(world / (s.x || 1));
    this.prop.position.set(0, 9, 3);
    this.prop.rotation.set(0, 0, Math.PI);
    this.j.lHand.add(this.prop);
  }

  dispose() {
    // Geometry and materials are shared with the library copy; nothing to free.
  }
}

// Pose names used by the game, mapped to Mixamo clips.
const MAP = {
  idle: 'idle', neutral: 'standIdle', crouch: 'crouch', jump: 'jump', block: 'block', crouchBlock: 'crouchBlock',
  punchWind: 'jab', punch: 'jab', kickWind: 'kick', kick: 'kick', lowPunch: 'lowKick', sweep: 'sweep',
  airKick: 'airKick', airPunch: 'airKick', throwWind: 'throw', throw: 'throw', castWind: 'cast', cast: 'cast',
  uppercut: 'uppercut', dash: 'dash', slide: 'slide', grab: 'grab', lift: 'grab', point: 'point', powerUp: 'yell',
  hit: 'hit', hitLow: 'hitHead', fall: 'fall', lying: 'fall', dizzy: 'dizzy', getUp: 'getUp',
  cheer: 'cheer', clap: 'clap', dab: 'dance', flex: 'flex', phone: 'phone', bow: 'bow', shrug: 'shrug', victory: 'victory', taunt: 'taunt',
};
const LOOP = new Set(['idle', 'standIdle', 'crouch', 'block', 'crouchBlock', 'dizzy', 'walkF', 'walkB', 'cheer', 'clap', 'phone', 'dance', 'dash']);
// Two pose names that are halves of one move (wind-up → strike) share a clip.
const SAME_MOVE = (a, b) => MAP[a] === MAP[b];

// The shared clip, or a copy with hip motion rescaled for rigs of another size.
function clipFor(id, key) {
  const clip = lib.clips[key];
  const ratio = lib.hipsRatio[id] ?? 1;
  if (!clip || Math.abs(ratio - 1) < 0.15) return clip;
  const cacheKey = `${id}:${key}`;
  if (!lib.scaledClips[cacheKey]) {
    const copy = clip.clone();
    for (const t of copy.tracks) if (t.name.endsWith('Hips.position')) for (let i = 0; i < t.values.length; i++) t.values[i] *= ratio;
    lib.scaledClips[cacheKey] = copy;
  }
  return lib.scaledClips[cacheKey];
}

// Same interface as Animator (set / snap / update / time), driving an AnimationMixer.
export class ClipAnimator {
  constructor(body) {
    this.body = body;
    this.mixer = new THREE.AnimationMixer(body.model);
    this.actions = {};
    this.current = null;
    this.poseName = null;
    this.time = Math.random() * 10;
    this.walk = 0;
  }

  action(key) {
    if (!this.actions[key]) {
      const clip = clipFor(this.body.id, key);
      if (!clip) return null;
      const a = this.mixer.clipAction(clip);
      if (!LOOP.has(key)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[key] = a;
    }
    return this.actions[key];
  }

  play(key, fade = 0.12, { duration = 0, atEnd = false, restart = false } = {}) {
    const a = this.action(key);
    if (!a) return;
    if (this.current === a && !atEnd && !restart) return;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.timeScale = duration > 0 ? a.getClip().duration / duration : 1;
    if (atEnd) a.time = a.getClip().duration - 0.001;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentKey = key;
  }

  // speed is the old blend rate; higher = snappier transition.
  set(name, speed = 14, opts = {}) {
    if (name === this.poseName && !opts.restart) return;
    const restart = !(this.poseName && SAME_MOVE(this.poseName, name));
    const prev = this.poseName;
    this.poseName = name;
    const key = MAP[name] ?? 'idle';
    if (!restart && !opts.duration) return;
    const fade = Math.min(0.25, 1.6 / Math.max(speed, 1));
    if (name === 'lying') return this.play(key, fade, { atEnd: prev !== 'fall' });
    this.play(key, fade, opts);
  }

  snap(name) {
    this.poseName = null;
    this.set(name, 100);
    this.mixer.update(0);
  }

  update(dt, { walk = 0 } = {}) {
    this.time += dt;
    // Walking swaps the fighting idle for boxing footwork.
    if (this.poseName === 'idle') {
      const want = walk > 0.15 ? 'walkF' : walk < -0.15 ? 'walkB' : 'idle';
      if (want !== this.currentKey) this.play(want, 0.15);
    }
    this.mixer.update(dt);
  }
}
