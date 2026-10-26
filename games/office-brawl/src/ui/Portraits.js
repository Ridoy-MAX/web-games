import * as THREE from 'three';
import { Body } from '../fighters/Body.js';
import { Animator } from '../fighters/Poses.js';
import { ClipAnimator, ModelBody, hasModel } from '../fighters/Models.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Renders a head-and-shoulders portrait of every fighter once at startup, using
// the real 3D models, and returns { id: dataURL }.
export function renderPortraits(renderer, roster) {
  const size = 256;
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 0.8));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd7ff, 1.6);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  const out = {};
  for (const def of roster) {
    scene.background = new THREE.Color(def.color).lerp(new THREE.Color(0x1b1b2f), 0.35);
    const models = hasModel(def.id);
    const body = models ? new ModelBody(def.id, def.look) : new Body(def.look);
    const anim = models ? new ClipAnimator(body) : new Animator(body);
    anim.snap('neutral');
    body.setExpression(def.boss ? 'smug' : 'normal');
    body.root.rotation.y = 0.35;
    scene.add(body.root);
    body.root.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    body.j.head.getWorldPosition(head);
    if (models) {
      camera.position.set(head.x + 0.3, head.y + 0.15, head.z + 1.35);
      camera.lookAt(head.x, head.y + 0.08, head.z);
    } else {
      camera.position.set(head.x + 0.28, head.y + 0.22, head.z + 1.55);
      camera.lookAt(head.x, head.y + 0.06, head.z);
    }
    renderer.render(scene, camera);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(body.root);
    body.dispose();
  }

  scene.environment.dispose();
  pmrem.dispose();
  renderer.setPixelRatio(prevRatio);
  renderer.setSize(prevSize.x, prevSize.y, false);
  return out;
}
