// ============================================================
// world/heightfield.js — the terrain height grid + heightAt(),
// the one API every actor, road, and tree sits on (TECH doc §3).
// ============================================================
'use strict';

import { lerp, clamp } from '../core/rng.js';
import { WORLD_W, WORLD_D, WATER_Y, roadDist, lakeSDF } from './geo.js';

const GRID = 220; // terrain verts per side (approx)

export function vnoise(x, z) { // 2-octave value noise
  const h = (ix, iz) => {
    let n = ix * 374761393 + iz * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  let out = 0, amp = 1, f = 1 / 260;
  for (let o = 0; o < 2; o++) {
    const xf = x * f, zf = z * f;
    const ix = Math.floor(xf), iz = Math.floor(zf);
    const fx = xf - ix, fz = zf - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const v = lerp(lerp(h(ix, iz), h(ix + 1, iz), sx), lerp(h(ix, iz + 1), h(ix + 1, iz + 1), sx), sz);
    out += (v - 0.5) * amp;
    amp *= 0.45; f *= 2.7;
  }
  return out;
}

export const HX = GRID + 1;
export const HZ = Math.round(GRID * WORLD_D / WORLD_W) + 1;
const cellW = WORLD_W / (HX - 1), cellD = WORLD_D / (HZ - 1);
const hgrid = new Float32Array(HX * HZ);

(function buildHeights() {
  for (let j = 0; j < HZ; j++) for (let i = 0; i < HX; i++) {
    const x = -WORLD_W / 2 + i * cellW, z = -WORLD_D / 2 + j * cellD;
    let y = 3.5 + vnoise(x, z) * 7;
    const lk = lakeSDF(x, z);
    if (lk < 1.25) { // carve lake bowl with soft shore
      const t = clamp((1.25 - lk) / 0.45, 0, 1);
      y = lerp(y, -3.5, Math.min(1, t) * (lk < 1 ? 1 : t));
      if (lk < 1) y = Math.min(y, lerp(0.2, -3.5, clamp((1 - lk) / 0.35, 0, 1)));
    }
    const rd = roadDist(x, z);
    if (rd < 30) { const t = 1 - rd / 30; y = lerp(y, Math.max(y * 0.25, 1.0), t * t); }
    hgrid[j * HX + i] = y;
  }
})();

export function heightAt(x, z) {
  const gx = clamp((x + WORLD_W / 2) / cellW, 0, HX - 1.001);
  const gz = clamp((z + WORLD_D / 2) / cellD, 0, HZ - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = hgrid[j * HX + i], b = hgrid[j * HX + i + 1];
  const c2 = hgrid[(j + 1) * HX + i], d = hgrid[(j + 1) * HX + i + 1];
  return lerp(lerp(a, b, fx), lerp(c2, d, fx), fz);
}
