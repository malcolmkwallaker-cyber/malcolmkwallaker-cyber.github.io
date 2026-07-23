// ============================================================
// ui/minimap.js — top-right minimap: roads/lakes/towns baked
// once to an offscreen canvas, leads + player redrawn per frame.
// The objective lead (set from the phone) gets a highlight ring.
// ============================================================
'use strict';

import { WORLD_W, WORLD_D, roadSegs, LAKES, TOWNS, mapToWorld, S } from '../world/geo.js';
import { leads, state } from '../core/state.js';

let mmc = null, mm = null, mmBase = null;

export function initMinimap(canvasEl) {
  mmc = canvasEl; mm = mmc.getContext('2d');
  mmBase = document.createElement('canvas');
  mmBase.width = mmc.width; mmBase.height = mmc.height;
  const b = mmBase.getContext('2d');
  b.fillStyle = '#22301f'; b.fillRect(0, 0, mmBase.width, mmBase.height);
  const px = (x) => (x + WORLD_W / 2) / WORLD_W * mmBase.width;
  const pz = (z) => (z + WORLD_D / 2) / WORLD_D * mmBase.height;
  b.strokeStyle = '#4a4a52'; b.lineWidth = 2;
  for (const s of roadSegs) { b.beginPath(); b.moveTo(px(s.ax), pz(s.az)); b.lineTo(px(s.bx), pz(s.bz)); b.stroke(); }
  b.fillStyle = '#3f8fd4';
  for (const l of LAKES) {
    const c = mapToWorld(l.cx, l.cy);
    b.beginPath(); b.ellipse(px(c.x), pz(c.z), l.rx * S / WORLD_W * mmBase.width, l.ry * S / WORLD_D * mmBase.height, 0, 0, Math.PI * 2); b.fill();
  }
  b.fillStyle = '#ffcd75'; b.font = 'bold 9px monospace'; b.textAlign = 'center';
  for (const t of TOWNS) { const c = mapToWorld(t.x, t.y); b.fillRect(px(c.x) - 2, pz(c.z) - 2, 4, 4); b.fillText(t.name, px(c.x), pz(c.z) - 5); }
}

export function drawMinimap(player, car, now) {
  if (!mm) return;
  mm.drawImage(mmBase, 0, 0);
  const px = (x) => (x + WORLD_W / 2) / WORLD_W * mmc.width;
  const pz = (z) => (z + WORLD_D / 2) / WORLD_D * mmc.height;
  for (const l of leads) {
    const isObjective = l.id === state.objectiveId;
    mm.fillStyle = l.stealAt ? '#b13e53' : (l.stage === 'appt' ? '#ffcd75' : (l.stage === 'hot' ? '#ef7d57' : '#94b0c2'));
    mm.beginPath(); mm.arc(px(l.x), pz(l.z), isObjective ? 5 : 4, 0, Math.PI * 2); mm.fill();
    if (isObjective) {
      mm.strokeStyle = '#a7f070'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(px(l.x), pz(l.z), 8 + Math.sin(now / 200) * 2, 0, Math.PI * 2); mm.stroke();
    }
  }
  const fx = player.mode === 'car' ? car.x : player.x;
  const fz = player.mode === 'car' ? car.z : player.z;
  const hd = player.mode === 'car' ? car.heading : player.heading;
  mm.save(); mm.translate(px(fx), pz(fz)); mm.rotate(hd);
  mm.fillStyle = '#f4f4f4';
  mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(-4, 5); mm.closePath(); mm.fill();
  mm.restore();
}
