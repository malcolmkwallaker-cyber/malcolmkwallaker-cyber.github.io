// ============================================================
// world/geo.js — static world layout: map-coordinate → world-
// meter projection, lakes, towns, roads, key locations. Pure
// data + pure functions; no Three.js, no game state. This is
// the "map" every other world/sim module reads from.
// ============================================================
'use strict';

import Data, { C } from '../../data/game-data.js';
import { clamp } from '../core/rng.js';

export const S = 12; // meters per 2D map unit (TECH doc §3)
export const mapToWorld = (x, y) => ({ x: (x - 310) * S, z: (y - 145) * S });

// Lakes as ellipses (map coords tuned so towns/roads stay dry)
export const LAKES = [
  { name: 'LAKE BEMIDJI', cx: 235, cy: 87,  rx: 30, ry: 17 },
  { name: 'LEECH LAKE',   cx: 374, cy: 119, rx: 44, ry: 24 },
  { name: 'GULL LAKE',    cx: 276, cy: 192, rx: 26, ry: 14 },
  { name: 'MILLE LACS',   cx: 427, cy: 213, rx: 22, ry: 13 },
];
export const TOWNS = Data.MAP.towns; // verbatim positions from the 2D game

// Road polylines in map coords
const ROADS = [
  [[185,112],[318,150]],                          // Bemidji — Walker
  [[318,150],[355,232]],                          // Walker — Brainerd
  [[300,205],[302,228],[355,232]],                // Nisswa — Brainerd
  [[205,175],[185,112]],                          // Park Rapids — Bemidji
  [[205,175],[240,205],[300,212],[300,205]],      // Park Rapids — Nisswa (south of Gull)
  [[318,150],[436,146],[436,100],[415,78]],       // Walker — Grand Rapids (east of Leech)
  [[355,232],[434,168]],                          // Brainerd — Bank
  [[355,232],[362,226]], [[355,232],[340,240]],   // office, title spurs
  [[300,205],[310,198]],                          // coffee spur
  [[185,112],[190,120]],                          // studio spur
  [[436,146],[420,140]],                          // seller cabin spur (Leech east shore)
  [[290,142],[290,118]],                          // lake home spur
  [[200,160],[230,160]],                          // open house spur
  [[436,100],[424,95]],                           // inspection house spur
  [[240,205],[222,218]],[[222,218],[185,242]],    // plaza, systems lab
  [[300,212],[278,250]],                          // growth lab
];

export const LOCATIONS = [
  { key:'office',    label:'THE OFFICE',            x:362, y:226, color:C.sky },
  { key:'coffee',    label:'MUGS & PLUGS CAFE',     x:310, y:198, color:C.orange },
  { key:'openhouse', label:'OPEN HOUSE',            x:230, y:160, color:C.yellow },
  { key:'studio',    label:'VIDEO STUDIO',          x:190, y:120, color:C.purple },
  { key:'cabin',     label:'SELLER CABIN',          x:420, y:140, color:C.red },
  { key:'lakehome',  label:'LAKE HOME',             x:290, y:118, color:C.cyan },
  { key:'starter',   label:'INSPECTION',            x:424, y:95,  color:C.gray },
  { key:'title',     label:'TITLE CO.',             x:340, y:240, color:C.lime },
  { key:'bank',      label:'FIRST NORTHERN BANK',   x:434, y:168, color:C.green },
  { key:'plaza',     label:'NOBLEZA COMMERCIAL PLAZA', x:222, y:218, color:C.blue },
  { key:'growthlab', label:'SUDDATH GROWTH LAB',    x:278, y:250, color:C.teal },
  { key:'systemslab',label:'LEWIS SYSTEMS LAB',     x:185, y:242, color:C.navy },
];

export const WORLD_W = 4400, WORLD_D = 3000; // meters
export const WATER_Y = 0.35;

export const roadSegs = [];
for (const pl of ROADS) {
  for (let i = 0; i < pl.length - 1; i++) {
    const a = mapToWorld(pl[i][0], pl[i][1]), b = mapToWorld(pl[i + 1][0], pl[i + 1][1]);
    roadSegs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
  }
}

function distToSeg(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const L2 = dx * dx + dz * dz;
  let t = L2 ? ((px - s.ax) * dx + (pz - s.az) * dz) / L2 : 0;
  t = clamp(t, 0, 1);
  const x = s.ax + t * dx, z = s.az + t * dz;
  return Math.hypot(px - x, pz - z);
}

export function roadDist(px, pz) {
  let d = 1e9;
  for (const s of roadSegs) { const v = distToSeg(px, pz, s); if (v < d) d = v; }
  return d;
}

export function nearestRoadPoint(px, pz) {
  let best = null, bd = 1e9;
  for (const s of roadSegs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
    let t = L2 ? ((px - s.ax) * dx + (pz - s.az) * dz) / L2 : 0; t = clamp(t, 0, 1);
    const x = s.ax + t * dx, z = s.az + t * dz, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = { x, z }; }
  }
  return best;
}

export function lakeSDF(px, pz) { // >1 outside, <1 inside (min over lakes)
  let m = 1e9;
  for (const l of LAKES) {
    const c = mapToWorld(l.cx, l.cy);
    const v = Math.hypot((px - c.x) / (l.rx * S), (pz - c.z) / (l.ry * S));
    if (v < m) m = v;
  }
  return m;
}
