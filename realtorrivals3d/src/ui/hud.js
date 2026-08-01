// ============================================================
// ui/hud.js — top-left cash/day/clock readout + energy pips.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { money } from '../core/rng.js';
import { state } from '../core/state.js';

const $ = (id) => document.getElementById(id);

export function updateHUD() {
  $('hudcash').textContent = money(state.cash);
  $('hudsold').innerHTML = 'SOLD: ' + state.sold + ' · <span style="color:var(--sky)">FOLLOWERS: ' + state.followers + '</span>';
  const mins = Math.floor(state.tod);
  let h = Math.floor(mins / 60), mm = (mins % 60);
  const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  $('clock').textContent = Data.SEASON.months[state.month] + ' · DAY ' + state.day + '/' + Data.SEASON.daysPerMonth +
    ' · ' + h + ':' + String(mm).padStart(2, '0') + ' ' + ampm;

  const pipsEl = $('energypips');
  if (pipsEl) {
    let html = '';
    for (let i = 0; i < state.maxEnergy; i++) {
      html += '<span class="pip' + (i < state.energy ? ' on' : '') + '"></span>';
    }
    pipsEl.innerHTML = html;
  }
}
