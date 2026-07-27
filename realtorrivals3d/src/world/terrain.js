// ============================================================
// world/terrain.js — the one-draw-call ground mesh, water
// planes, and draped road ribbons. PBR materials + shadows +
// procedural (canvas-generated) detail + normal maps — see
// world/textures.js. Vertex colors still drive the big biome
// blend (grass/sand/rock/road); the textures/normal maps add
// fine surface relief on top so nothing reads as a flat fill.
// ============================================================
'use strict';

import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { WORLD_W, WORLD_D, WATER_Y, LAKES, mapToWorld, S, roadSegs, roadDist, lakeSDF } from './geo.js';
import { HX, HZ, heightAt, vnoise } from './heightfield.js';
import {
  makeGroundTexture, makeAsphaltTexture, makeGroundNormalMap,
  makeAsphaltNormalMap, makeWaterNormalMap,
} from './textures.js';
import { colliders } from './buildings.js';
import { treeNear } from './forest.js';

const waterMaterials = [];
let terrainGeo = null;

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
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, map: makeGroundTexture(), roughness: 1, metalness: 0,
    normalMap: makeGroundNormalMap(), normalScale: new THREE.Vector2(0.7, 0.7),
  }));
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  terrainGeo = geo;
}

// Cheap baked ambient occlusion: darkens ground vertex colors near known
// building footprints and trees at load time. A static substitute for real
// screen-space AO, which we can't ship (see TECH_ARCHITECTURE.md §9 — SSAO
// crashed the software-rendering path); this costs nothing per frame and
// still sells the "grounded" look of buildings/trees meeting the ground.
// Must run after every collider/tree is placed, so main.js calls this last,
// once towns/locations/landmarks/forest are all built.
export function bakeTerrainAO() {
  if (!terrainGeo) return;
  const pos = terrainGeo.attributes.position;
  const colorAttr = terrainGeo.attributes.color;
  const REACH = 3.5;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    let ao = 1;
    for (const c of colliders) {
      const dx = Math.max(Math.abs(x - c.x) - c.hx, 0);
      const dz = Math.max(Math.abs(z - c.z) - c.hz, 0);
      const d = Math.hypot(dx, dz);
      if (d < REACH) ao = Math.min(ao, 0.55 + (d / REACH) * 0.45);
    }
    const t = treeNear(x, z, 3.2);
    if (t) {
      const d = Math.hypot(x - t[0], z - t[1]);
      ao = Math.min(ao, 0.65 + (d / 3.2) * 0.35);
    }
    if (ao < 1) colorAttr.setXYZ(k, colorAttr.getX(k) * ao, colorAttr.getY(k) * ao, colorAttr.getZ(k) * ao);
  }
  colorAttr.needsUpdate = true;
}

export function buildWater(scene) {
  const normalMap = makeWaterNormalMap();
  for (const l of LAKES) {
    const c = mapToWorld(l.cx, l.cy);
    const geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    // MeshPhysicalMaterial's Fresnel response (via `ior`) makes the water
    // more reflective at grazing angles and more see-through looking
    // straight down — the single biggest thing that reads as "real water"
    // versus a flat translucent disc. The normal map (scrolled per-frame
    // in tickWater()) adds gentle moving ripples with zero geometry cost.
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x2f6fa8, transparent: true, opacity: 0.9,
      roughness: 0.05, metalness: 0, ior: 1.33, envMapIntensity: 1.4,
      normalMap, normalScale: new THREE.Vector2(0.25, 0.25),
    });
    waterMaterials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(l.rx * S, 1, l.ry * S);
    m.position.set(c.x, WATER_Y, c.z);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
  }
}

// Called once the procedural env probe (world/sky.js) exists — gives
// every lake a real reflection instead of a flat blue disc.
export function setWaterEnvMap(envTexture) {
  for (const mat of waterMaterials) mat.envMap = envTexture;
}

// Scrolls each lake's ripple normal map — cheap (one texture-offset
// write per lake) but is most of what sells "water" as moving rather
// than a static painted disc.
export function tickWater(dt) {
  for (const mat of waterMaterials) {
    mat.normalMap.offset.x += dt * 0.012;
    mat.normalMap.offset.y += dt * 0.007;
  }
}

export function buildRoadRibbons(scene) {
  const verts = [], uvs = [], HW = 5.2;
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
      const v0 = (t0 * L) / 4, v1 = (t1 * L) / 4;
      const q = [
        [x0 + nx * HW, y0, z0 + nz * HW], [x0 - nx * HW, y0, z0 - nz * HW], [x1 - nx * HW, y1, z1 - nz * HW],
        [x0 + nx * HW, y0, z0 + nz * HW], [x1 - nx * HW, y1, z1 - nz * HW], [x1 + nx * HW, y1, z1 + nz * HW],
      ];
      const quv = [[0, v0], [1, v0], [1, v1], [0, v0], [1, v1], [0, v1]];
      for (const v of q) verts.push(...v);
      for (const uv of quv) uvs.push(...uv);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: makeAsphaltTexture(), roughness: 0.85, metalness: 0.05,
    normalMap: makeAsphaltNormalMap(), normalScale: new THREE.Vector2(0.5, 0.5),
  }));
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
