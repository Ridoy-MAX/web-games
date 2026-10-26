import * as THREE from 'three';
import { Body } from '../fighters/Body.js';
import { Animator } from '../fighters/Poses.js';

// Renders a head-and-shoulders portrait of every fighter once at startup, using
// the real 3D models, and returns { id: dataURL }.
export function renderPortraits(renderer, roster) {
  const size = 256;
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  const out = {};
  for (const def of roster) {
    scene.background = new THREE.Color(def.color).lerp(new THREE.Color(0x1b1b2f), 0.35);
    const body = new Body(def.look);
    const anim = new Animator(body);
    anim.snap(def.boss ? 'bow' : 'neutral');
    anim.snap('neutral');
    body.setExpression(def.boss ? 'smug' : 'normal');
    body.root.rotation.y = 0.35;
    scene.add(body.root);
    body.root.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    body.j.head.getWorldPosition(head);
    camera.position.set(head.x + 0.45, head.y + 0.05, head.z + 2.6);
    camera.lookAt(head.x, head.y - 0.25, head.z);
    renderer.render(scene, camera);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(body.root);
    body.dispose();
  }

  renderer.setPixelRatio(prevRatio);
  renderer.setSize(prevSize.x, prevSize.y, false);
  return out;
}
