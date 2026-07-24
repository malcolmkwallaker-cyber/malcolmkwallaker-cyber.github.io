// ============================================================
// world/forest.js — instanced pine forest + a spatial hash for
// cheap tree-vs-car collision queries.
// ============================================================
'use strict';

import * as THREE from 'three';
import { rand, rng } from '../core/rng.js';
import { WORLD_W, WORLD_D, WATER_Y, TOWNS, mapToWorld, roadDist, lakeSDF } from './geo.js';
import { heightAt } from './heightfield.js';
import { makeBarkTexture } from './textures.js';

const TREE_HASH = new Map(); // "cellX:cellZ" -> [[x,z], ...]

export function buildForest(scene, quality = 'high') {
  const COUNT = quality === 'low' ? 5000 : quality === 'medium' ? 9000 : 14000;
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3, 5);
  const canGeo = new THREE.ConeGeometry(2.6, 7.5, 6);
  const trunk = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshStandardMaterial({ map: makeBarkTexture(), roughness: 0.95 }), COUNT);
  const canopy = new THREE.InstancedMesh(canGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 }), COUNT);
  // shadows: the canopy silhouette is what reads on the ground; skip the
  // thin trunk to save a chunk of the (already instance-heavy) shadow pass.
  canopy.castShadow = true;
  trunk.receiveShadow = true; canopy.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < COUNT && guard++ < COUNT * 12) {
    const x = rand(-WORLD_W / 2 + 30, WORLD_W / 2 - 30);
    const z = rand(-WORLD_D / 2 + 30, WORLD_D / 2 - 30);
    if (lakeSDF(x, z) < 1.12) continue;
    if (roadDist(x, z) < 14) continue;
    let nearTown = false;
    for (const t of TOWNS) { const c = mapToWorld(t.x, t.y); if (Math.hypot(x - c.x, z - c.z) < 110) { nearTown = true; break; } }
    if (nearTown && rng() < 0.8) continue;
    const y = heightAt(x, z);
    if (y < WATER_Y + 0.2) continue;
    const sc = rand(0.7, 1.7);
    p.set(x, y + 1.5 * sc, z); s.set(sc, sc, sc); q.identity();
    m.compose(p, q, s); trunk.setMatrixAt(placed, m);
    p.set(x, y + (3 + 3.4) * sc, z); m.compose(p, q, s); canopy.setMatrixAt(placed, m);
    col.setHSL(0.33 + rng() * 0.05, 0.45, 0.28 + rng() * 0.12);
    canopy.setColorAt(placed, col);
    const key = (Math.floor(x / 24)) + ':' + (Math.floor(z / 24));
    if (!TREE_HASH.has(key)) TREE_HASH.set(key, []);
    TREE_HASH.get(key).push([x, z]);
    placed++;
  }
  trunk.count = placed; canopy.count = placed;
  trunk.instanceMatrix.needsUpdate = true; canopy.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  scene.add(trunk, canopy);
}

export function treeNear(x, z, r) {
  const ci = Math.floor(x / 24), cj = Math.floor(z / 24);
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const cell = TREE_HASH.get(i + ':' + j);
    if (!cell) continue;
    for (const t of cell) if (Math.hypot(x - t[0], z - t[1]) < r) return t;
  }
  return null;
}
