// ============================================================
// world/textures.js — procedural, canvas-generated textures.
// Zero external assets, zero downloads: every texture in the game
// is drawn at runtime with the Canvas 2D API and uploaded as a
// THREE.CanvasTexture. Keeps the "one folder, no asset pipeline"
// architecture (see TECH_ARCHITECTURE.md) while giving surfaces
// real pixel detail instead of flat vertex-color fills.
// ============================================================
'use strict';

import * as THREE from 'three';
import { rand, choice } from '../core/rng.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(c, repeat) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let cached = null;
export function makeGroundTexture() {
  if (cached) return cached;
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a8a52';
  ctx.fillRect(0, 0, size, size);
  // speckled grass blades + a few dirt/pebble patches — tiled finely
  // across the terrain so it reads as texture, not a repeating pattern.
  for (let i = 0; i < 2600; i++) {
    const x = rand(0, size), y = rand(0, size);
    const shade = rand(-26, 22);
    ctx.fillStyle = shade > 0 ? `rgba(210,220,150,${rand(0.05, 0.22)})` : `rgba(20,40,10,${rand(0.05, 0.22)})`;
    ctx.fillRect(x, y, rand(1, 2.4), rand(1, 2.4));
  }
  for (let i = 0; i < 18; i++) {
    const x = rand(0, size), y = rand(0, size), r = rand(3, 9);
    ctx.fillStyle = `rgba(120,100,70,${rand(0.08, 0.18)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  cached = toTexture(c, 220);
  return cached;
}

const roofCache = new Map();
export function makeRoofTexture(hex) {
  if (roofCache.has(hex)) return roofCache.get(hex);
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const base = new THREE.Color(hex);
  ctx.fillStyle = base.getStyle();
  ctx.fillRect(0, 0, size, size);
  const dark = base.clone().multiplyScalar(0.72);
  ctx.strokeStyle = dark.getStyle();
  ctx.lineWidth = 2;
  for (let y = 4; y < size; y += 7) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = toTexture(c, 3);
  roofCache.set(hex, tex);
  return tex;
}

const sidingCache = new Map();
export function makeSidingTexture(hex) {
  if (sidingCache.has(hex)) return sidingCache.get(hex);
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const base = new THREE.Color(hex);
  ctx.fillStyle = base.getStyle();
  ctx.fillRect(0, 0, size, size);
  const dark = base.clone().multiplyScalar(0.85);
  ctx.strokeStyle = dark.getStyle();
  ctx.lineWidth = 1.5;
  for (let y = 0; y < size; y += 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = toTexture(c, 2);
  sidingCache.set(hex, tex);
  return tex;
}

let windowTex = null;
export function makeWindowTexture() {
  if (windowTex) return windowTex;
  const size = 32;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#dff3ff');
  grad.addColorStop(0.55, '#8fb8cf');
  grad.addColorStop(1, '#3d5a68');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  return windowTex;
}

let barkTex = null;
export function makeBarkTexture() {
  if (barkTex) return barkTex;
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c4128';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = rand(0, size);
    ctx.strokeStyle = `rgba(30,18,8,${rand(0.15, 0.35)})`;
    ctx.lineWidth = rand(1, 2.5);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rand(-4, 4), size); ctx.stroke();
  }
  barkTex = toTexture(c, 1);
  barkTex.repeat.set(1, 3);
  return barkTex;
}

let asphaltTex = null;
export function makeAsphaltTexture() {
  if (asphaltTex) return asphaltTex;
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const g = Math.round(rand(50, 90));
    ctx.fillStyle = `rgba(${g},${g},${g + 4},${rand(0.06, 0.2)})`;
    ctx.fillRect(rand(0, size), rand(0, size), rand(1, 2), rand(1, 2));
  }
  // faint dashed centerline hint
  ctx.strokeStyle = 'rgba(230,220,180,0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
  asphaltTex = toTexture(c, 1);
  asphaltTex.repeat.set(1, 40);
  return asphaltTex;
}

// ---------- procedural normal maps ----------
// Normal maps encode XYZ vector components as RGB, not color — must
// stay in linear space (no sRGB decode) or the GPU distorts every
// normal. toTexture() above sets colorSpace=SRGBColorSpace for the
// color textures; this sibling helper deliberately leaves it default
// (linear) for anything used as a `normalMap`.
function toDataTexture(c, repeat) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat, repeat);
  return tex;
}

// Builds a seamlessly-tileable height field from a handful of integer-
// frequency sine waves (integer periods over [0, 2π) tile perfectly by
// construction — no seams, no need for periodic hash-noise blending),
// then converts it to a tangent-space normal map via central-difference
// slopes with wrap-around indexing (also seam-free).
function makeNormalMap(size, octaves, strength) {
  const waves = [];
  for (let o = 0; o < octaves; o++) {
    waves.push({
      fx: Math.round(rand(1, 3 + o * 2)) || 1,
      fz: Math.round(rand(1, 3 + o * 2)) || 1,
      amp: 1 / (o + 1.4),
      phase: rand(0, Math.PI * 2),
    });
  }
  const h = new Float32Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) {
        v += Math.sin((x / size) * Math.PI * 2 * w.fx + (z / size) * Math.PI * 2 * w.fz + w.phase) * w.amp;
      }
      h[z * size + x] = v;
    }
  }
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const zm = (z - 1 + size) % size, zp = (z + 1) % size;
      const dx = (h[z * size + xp] - h[z * size + xm]) * strength;
      const dz = (h[zp * size + x] - h[zm * size + x]) * strength;
      // tangent-space normal (three.js convention: +Z out of the surface)
      let nx = -dx, ny = -dz, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (z * size + x) * 4;
      img.data[idx] = (nx * 0.5 + 0.5) * 255;
      img.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[idx + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const normalCache = new Map();
function cachedNormalTexture(key, size, octaves, strength, repeat) {
  if (normalCache.has(key)) return normalCache.get(key);
  const tex = toDataTexture(makeNormalMap(size, octaves, strength), repeat);
  normalCache.set(key, tex);
  return tex;
}

// Gentle, broad undulation — grass/dirt catching low sun at a grazing angle.
export function makeGroundNormalMap() { return cachedNormalTexture('ground', 96, 3, 2.2, 220); }
// Coarser, higher-contrast bumps — asphalt grain.
export function makeAsphaltNormalMap() { return cachedNormalTexture('asphalt', 64, 3, 3.2, 40); }
// Fine cross-hatch — shingle/plank relief for roofs and siding.
export function makeRoofNormalMap() { return cachedNormalTexture('roof', 48, 2, 4, 3); }
export function makeSidingNormalMap() { return cachedNormalTexture('siding', 48, 2, 3.2, 2); }
// Small, fast ripples — animated (offset-scrolled) on the water material.
export function makeWaterNormalMap() { return cachedNormalTexture('water', 64, 4, 2.6, 60); }
