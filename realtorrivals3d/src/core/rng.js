// ============================================================
// core/rng.js — seeded RNG + small math/format helpers shared
// across every module. One seed = one reproducible world.
// ============================================================
'use strict';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(20260723);
export const rand = (lo, hi) => lo + rng() * (hi - lo);
export const choice = (a) => a[Math.floor(rng() * a.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const money = (n) => {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e4) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + n.toLocaleString('en-US');
};
