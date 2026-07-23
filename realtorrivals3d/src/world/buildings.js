// ============================================================
// world/buildings.js — box/label helpers, procedural houses,
// town placement, key-location landmarks, and the collider
// list every actor collides against.
// ============================================================
'use strict';

import * as THREE from 'three';
import { rand, rng, choice } from '../core/rng.js';
import { TOWNS, LOCATIONS, mapToWorld, lakeSDF, roadDist } from './geo.js';
import { heightAt } from './heightfield.js';

export const colliders = []; // {x,z,hx,hz}
export const locationObjs = [];

export function makeLabel(text, color = '#f4f4f4', scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 28px monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 20;
  c.width = w; c.height = 44;
  const ctx2 = c.getContext('2d');
  ctx2.fillStyle = 'rgba(26,28,44,0.85)'; ctx2.fillRect(0, 0, w, 44);
  ctx2.font = 'bold 28px monospace'; ctx2.fillStyle = color;
  ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  ctx2.fillText(text, w / 2, 23);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sp.scale.set(w / 44 * 6 * scale, 6 * scale, 1);
  return sp;
}

export function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
}

export function buildHouse(scene, x, z, opts = {}) {
  const g = new THREE.Group();
  const w = opts.w || rand(8, 12), d = opts.d || rand(7, 10), h = opts.h || rand(4, 6);
  const bodyCol = opts.color ?? choice([0xd8cfc0, 0xb8c4cf, 0xc9a886, 0x9fb28f, 0xd4b8b0]);
  const body = box(w, h, d, bodyCol); body.position.y = h / 2; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, w * 0.72, h * 0.7, 4),
    new THREE.MeshLambertMaterial({ color: opts.roof ?? 0x7a4a3a }));
  roof.rotation.y = Math.PI / 4; roof.position.y = h + h * 0.35;
  roof.scale.z = d / w; g.add(roof);
  const y = heightAt(x, z);
  g.position.set(x, y, z);
  scene.add(g);
  colliders.push({ x, z, hx: w / 2 + 1, hz: d / 2 + 1 });
  return g;
}

export function buildTowns(scene) {
  for (const t of TOWNS) {
    const c = mapToWorld(t.x, t.y);
    const n = 8 + Math.floor(rng() * 8);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const a = rng() * Math.PI * 2, r = rand(22, 90);
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (lakeSDF(x, z) < 1.15 || roadDist(x, z) < 10) continue;
        buildHouse(scene, x, z);
        break;
      }
    }
    // water tower with town name
    let wx = c.x + 40, wz = c.z - 40;
    if (lakeSDF(wx, wz) < 1.2) { wx = c.x - 40; wz = c.z + 40; }
    const ty = heightAt(wx, wz);
    const tower = new THREE.Group();
    const legs = box(1.6, 18, 1.6, 0x8899a6); legs.position.y = 9; tower.add(legs);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xa8c4d4 }));
    tank.position.y = 20; tower.add(tank);
    tower.position.set(wx, ty, wz); scene.add(tower);
    const lab = makeLabel(t.name, '#ffcd75', 1.5); lab.position.set(wx, ty + 31, wz); scene.add(lab);
  }
}

export function buildLocations(scene) {
  for (const L of LOCATIONS) {
    const c = mapToWorld(L.x, L.y);
    const g = buildHouse(scene, c.x, c.z, { w: 13, d: 11, h: 6.5, color: new THREE.Color(L.color).getHex(), roof: 0x333c57 });
    const lab = makeLabel(L.label, '#73eff7', 1.1);
    lab.position.set(0, 14, 0); g.add(lab);
    locationObjs.push({ ...L, wx: c.x, wz: c.z });
  }
  return locationObjs;
}

export function buildLandmarks(scene) {
  const c = mapToWorld(196, 100);
  const y = heightAt(c.x, c.z);
  const paul = new THREE.Group();
  const legs2 = box(3.4, 6, 2.2, 0x29366f); legs2.position.y = 3; paul.add(legs2);
  const shirt = box(4.2, 5, 2.6, 0xb13e53); shirt.position.y = 8; paul.add(shirt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b890 }));
  head.position.y = 11.6; paul.add(head);
  const beard = box(2.2, 1.6, 1, 0x5a3a22); beard.position.set(0, 10.8, 0.9); paul.add(beard);
  const axe = box(0.6, 9, 0.6, 0x7a4a3a); axe.position.set(3, 5.5, 0); paul.add(axe);
  paul.position.set(c.x, y, c.z); scene.add(paul);
  const babe = new THREE.Group();
  const bod = box(7, 4, 3.4, 0x41a6f6); bod.position.y = 3.4; babe.add(bod);
  const bhead = box(2.6, 2.4, 2.4, 0x41a6f6); bhead.position.set(4.4, 4.6, 0); babe.add(bhead);
  const horn = box(3.8, 0.5, 0.5, 0xf4f4f4); horn.position.set(4.4, 6, 0); babe.add(horn);
  const blegs = box(6, 2.8, 2.6, 0x3b5dc9); blegs.position.y = 1.2; babe.add(blegs);
  babe.position.set(c.x + 10, y, c.z + 3); scene.add(babe);
  const lab = makeLabel('PAUL BUNYAN & BABE', '#a7f070', 1);
  lab.position.set(c.x + 4, y + 16, c.z); scene.add(lab);
  colliders.push({ x: c.x, z: c.z, hx: 3, hz: 2 }, { x: c.x + 10, z: c.z + 3, hx: 4, hz: 2 });
}
