import * as THREE from 'three';
import { clamp, damp } from '../utils/math.js';

const desired = new THREE.Vector3();
const look = new THREE.Vector3();

// Smooth third-person follow camera with mouse/touch orbit, wall avoidance and
// trauma-based screen shake.
export class ThirdPersonCamera {
  constructor(camera, collision, terrain) {
    this.camera = camera;
    this.collision = collision;
    this.terrain = terrain;
    this.yaw = 0;
    this.pitch = 0.42;
    this.distance = 12;
    this.focus = new THREE.Vector3();
    this.trauma = 0;
    this.time = 0;
    this.orbitAngle = 0;
    this.mode = 'orbit';
    this.indoor = 0;
  }

  addTrauma(a) {
    this.trauma = Math.min(1, this.trauma + a);
  }

  rotate(dx, dy, sensitivity = 1) {
    this.yaw -= dx * 0.005 * sensitivity;
    this.pitch = clamp(this.pitch + dy * 0.004 * sensitivity, 0.08, 1.2);
  }

  snapTo(target, yaw = this.yaw) {
    this.yaw = yaw;
    this.focus.copy(target);
    this.update(0, target, true);
  }

  // indoor: inside a barn, so look down over the walls through the faded roof.
  update(dt, target, instant = false, indoor = false) {
    this.time += dt;
    this.indoor = instant ? (indoor ? 1 : 0) : damp(this.indoor, indoor ? 1 : 0, 4, dt);
    if (instant) this.focus.copy(target);
    else {
      this.focus.x = damp(this.focus.x, target.x, 10, dt);
      this.focus.z = damp(this.focus.z, target.z, 10, dt);
      // Vertical lags behind a bit so jumps feel bouncy instead of jerky.
      this.focus.y = damp(this.focus.y, target.y, 5, dt);
    }
    look.copy(this.focus);
    look.y += 1.6;

    const pitch = this.pitch + (Math.max(this.pitch, 1.1) - this.pitch) * this.indoor;
    const dist = this.distance + (9 - this.distance) * this.indoor;
    const cp = Math.cos(pitch);
    desired.set(Math.sin(this.yaw) * cp, Math.sin(pitch), Math.cos(this.yaw) * cp).multiplyScalar(dist).add(look);

    const t = this.collision.raycast(look, desired);
    if (t < 1) desired.lerpVectors(look, desired, Math.max(0.12, t - 0.06));
    const h = this.terrain.heightAt(desired.x, desired.z);
    if (Number.isFinite(h) && desired.y < h + 0.8) desired.y = h + 0.8;

    if (instant) this.camera.position.copy(desired);
    else {
      const k = 1 - Math.exp(-14 * dt);
      this.camera.position.lerp(desired, k);
    }
    this.camera.lookAt(look);
    this.applyShake(dt);
  }

  // Slow cinematic orbit for the main menu.
  updateOrbit(dt, center, radius = 11, height = 4.5) {
    this.time += dt;
    this.orbitAngle += dt * 0.12;
    look.copy(center);
    look.y += 1.4;
    desired.set(center.x + Math.cos(this.orbitAngle) * radius, center.y + height + Math.sin(this.time * 0.3) * 0.6, center.z + Math.sin(this.orbitAngle) * radius);
    const t = this.collision.raycast(look, desired);
    if (t < 1) desired.lerpVectors(look, desired, Math.max(0.55, t - 0.06));
    // Ease toward the target so the pull-in around obstacles isn't a hard pop.
    this.camera.position.lerp(desired, dt > 0 ? 1 - Math.exp(-6 * dt) : 1);
    this.camera.lookAt(look);
    this.applyShake(dt);
  }

  applyShake(dt) {
    if (this.trauma <= 0) return;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma;
    const t = this.time * 30;
    this.camera.position.x += Math.sin(t * 1.1) * s * 0.7;
    this.camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.5;
    this.camera.position.z += Math.cos(t * 1.3 + 2) * s * 0.7;
    this.camera.rotation.z += Math.sin(t * 0.9) * s * 0.06;
  }
}
