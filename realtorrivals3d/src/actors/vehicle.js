// ============================================================
// actors/vehicle.js — the arcade car mesh + physics controller.
// Velocity chases heading (grip lerp); wheels sample the height-
// field for pitch/roll. See TECH_ARCHITECTURE.md §4.
// ============================================================
'use strict';

import * as THREE from 'three';
import { box } from '../world/buildings.js';
import { heightAt } from '../world/heightfield.js';
import { roadDist, lakeSDF, nearestRoadPoint, WATER_Y, WORLD_W, WORLD_D } from '../world/geo.js';
import { treeNear } from '../world/forest.js';
import { lerp, clamp } from '../core/rng.js';

const CAR_ACCEL = 26, CAR_MAX = 46, CAR_REV = -10, CAR_DRAG = 0.35, CAR_BRAKE = 55;

export function buildCar(colorHex) {
  const g = new THREE.Group();
  const body = box(2.1, 0.8, 4.4, colorHex); body.position.y = 0.85; g.add(body);
  const cab = box(1.8, 0.7, 2.2, 0x9fd7ef); cab.position.set(0, 1.55, -0.2); g.add(cab);
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 10);
  wg.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.6], [1.05, -1.6]]) {
    const w = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0x1a1c2c }));
    w.position.set(wx, 0.45, wz); g.add(w); wheels.push(w);
  }
  const hl = box(0.3, 0.2, 0.1, 0xfff6c8); hl.position.set(-0.6, 0.9, 2.25); g.add(hl);
  const hr = hl.clone(); hr.position.x = 0.6; g.add(hr);
  const tl = box(0.3, 0.2, 0.1, 0xb13e53); tl.position.set(-0.6, 0.9, -2.25); g.add(tl);
  const tr = tl.clone(); tr.position.x = 0.6; g.add(tr);
  g.userData.wheels = wheels;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  return g;
}

// Returns { toll: number|null } — a cash penalty toast the caller should show (lake dunk), else null.
export function updateVehicle(car, carMesh, fwd, steer, braking, dt, colliders, audio) {
  let tollMsg = null;
  car.speed += (fwd > 0 ? fwd * CAR_ACCEL : fwd * 14) * dt;
  car.speed -= car.speed * CAR_DRAG * dt;
  if (braking) car.speed -= Math.sign(car.speed) * CAR_BRAKE * dt;
  car.speed = clamp(car.speed, CAR_REV, CAR_MAX);
  const onRoad = roadDist(car.x, car.z) < 8;
  if (!onRoad) car.speed *= (1 - 0.55 * dt); // grass is slow, gravel is drifty
  const sf = clamp(Math.abs(car.speed) / 12, 0, 1);
  car.heading += steer * 1.9 * sf * Math.sign(car.speed) * dt;
  const dirx = Math.sin(car.heading), dirz = -Math.cos(car.heading);
  const grip = onRoad ? 6.5 : 3.4;
  car.vx = lerp(car.vx, dirx * car.speed, clamp(grip * dt, 0, 1));
  car.vz = lerp(car.vz, dirz * car.speed, clamp(grip * dt, 0, 1));
  let nx = car.x + car.vx * dt, nz = car.z + car.vz * dt;
  nx = clamp(nx, -WORLD_W / 2 + 10, WORLD_W / 2 - 10);
  nz = clamp(nz, -WORLD_D / 2 + 10, WORLD_D / 2 - 10);
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    if (Math.abs(dx) < c.hx + 1.6 && Math.abs(dz) < c.hz + 1.6) {
      if (Math.abs(dx) / (c.hx + 1.6) > Math.abs(dz) / (c.hz + 1.6)) nx = c.x + Math.sign(dx) * (c.hx + 1.6);
      else nz = c.z + Math.sign(dz) * (c.hz + 1.6);
      if (Math.abs(car.speed) > 14) audio.thud();
      car.speed *= 0.35;
    }
  }
  const tr = treeNear(nx, nz, 2.1);
  if (tr) {
    const dx = nx - tr[0], dz = nz - tr[1], d = Math.hypot(dx, dz) || 1;
    nx = tr[0] + dx / d * 2.1; nz = tr[1] + dz / d * 2.1;
    if (Math.abs(car.speed) > 14) audio.thud();
    car.speed *= 0.4;
  }
  car.x = nx; car.z = nz;
  if (lakeSDF(car.x, car.z) < 0.98 && heightAt(car.x, car.z) < WATER_Y) {
    const p = nearestRoadPoint(car.x, car.z);
    car.x = p.x; car.z = p.z; car.speed = 0; car.vx = car.vz = 0;
    tollMsg = 'You drove into the lake. The tow guy just shook his head. Ope. (-$150)';
    audio.bad();
  }
  const y0 = heightAt(car.x, car.z);
  const yF = heightAt(car.x + dirx * 2, car.z + dirz * 2);
  const yB = heightAt(car.x - dirx * 2, car.z - dirz * 2);
  const rx = Math.sin(car.heading + Math.PI / 2), rz2 = -Math.cos(car.heading + Math.PI / 2);
  const yL = heightAt(car.x + rx * 1.2, car.z + rz2 * 1.2);
  const yR = heightAt(car.x - rx * 1.2, car.z - rz2 * 1.2);
  carMesh.position.set(car.x, Math.max(y0, WATER_Y) + 0.05, car.z);
  carMesh.rotation.set(Math.atan2(yB - yF, 4), -car.heading + Math.PI, Math.atan2(yR - yL, 2.4), 'YXZ');
  for (let i = 0; i < 4; i++) {
    const w = carMesh.userData.wheels[i];
    w.rotation.x += car.speed * dt / 0.45;
    if (i < 2) w.rotation.y = steer * 0.45;
  }
  return { tollMsg, rightX: rx, rightZ: rz2 };
}
