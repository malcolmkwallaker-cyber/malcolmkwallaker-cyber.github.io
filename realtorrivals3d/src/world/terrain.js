// ============================================================
// world/terrain.js — the one-draw-call ground mesh, water
// planes, and draped road ribbons.
// ============================================================
'use strict';

import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { WORLD_W, WORLD_D, WATER_Y, LAKES, mapToWorld, S, roadSegs, roadDist, lakeSDF } from './geo.js';
import { HX, HZ, heightAt, vnoise } from './heightfield.js';

export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_W, WORLD_D, HX - 1, HZ - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x5da452), dark = new THREE.Color(0x3f7d46);
  const sand = new THREE.Color(0xc9b57a), rock = new THREE.Color(0x8a9a7a);
  const tmp = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const y = heightAt(x, z);
    pos.setY(k, y);
    const n = vnoise(x * 3.1 + 999, z * 3.1);
    if (y < WATER_Y + 0.6 && lakeSDF(x, z) < 1.5) tmp.copy(sand);
    else if (y > 8.2) tmp.copy(rock);
    else tmp.copy(grass).lerp(dark, clamp(n + 0.5, 0, 1));
    if (roadDist(x, z) < 8) tmp.set(0x5c5c64); // asphalt shoulder tint under ribbon
    colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
}

export function buildWater(scene) {
  for (const l of LAKES) {
    const c = mapToWorld(l.cx, l.cy);
    const geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x3f8fd4, transparent: true, opacity: 0.88 }));
    m.scale.set(l.rx * S, 1, l.ry * S);
    m.position.set(c.x, WATER_Y, c.z);
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
  }
}

export function buildRoadRibbons(scene) {
  const verts = [], HW = 5.2;
  for (const s of roadSegs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz);
    if (L < 1) continue;
    const nx = -dz / L, nz = dx / L;
    const steps = Math.max(2, Math.ceil(L / 22));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const x0 = s.ax + dx * t0, z0 = s.az + dz * t0;
      const x1 = s.ax + dx * t1, z1 = s.az + dz * t1;
      const y0 = heightAt(x0, z0) + 0.12, y1 = heightAt(x1, z1) + 0.12;
      const q = [
        [x0 + nx * HW, y0, z0 + nz * HW], [x0 - nx * HW, y0, z0 - nz * HW], [x1 - nx * HW, y1, z1 - nz * HW],
        [x0 + nx * HW, y0, z0 + nz * HW], [x1 - nx * HW, y1, z1 - nz * HW], [x1 + nx * HW, y1, z1 + nz * HW],
      ];
      for (const v of q) verts.push(...v);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x525258 }));
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
}
