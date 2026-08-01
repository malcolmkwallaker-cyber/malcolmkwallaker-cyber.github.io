// ============================================================
// ui/phone.js — the CRM hub. Slide-up panel listing the live
// pipeline (stage, warmth bar, value); tap a lead to set it as
// your GPS objective (minimap ring + compass arrow in the HUD).
// Also where the day ends on purpose instead of waiting on the
// real-time clock.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { money } from '../core/rng.js';
import { state, leads } from '../core/state.js';
import { balance } from '../sim/pipeline.js';

const $ = (id) => document.getElementById(id);
const STAGE_RANK = { appt: 0, hot: 1, new: 2 };
const STAGE_LABEL = { new: 'NEW', hot: 'WARM', appt: 'APPT SET' };

let open = false;
let onEndDayCb = null;

export function initPhone({ onEndDay }) {
  onEndDayCb = onEndDay;
  $('phonebtn').addEventListener('click', togglePhone);
  $('phoneclose').addEventListener('click', togglePhone);
  $('endday').addEventListener('click', () => { onEndDayCb?.(); renderPhone(); });
}

export function togglePhone() {
  open = !open;
  $('phone').classList.toggle('open', open);
  if (open) renderPhone();
}

export function isPhoneOpen() { return open; }

export function renderPhone() {
  const bal = balance();
  $('phonediff').textContent = Data.BALANCE[state.difficulty].label + ' · ' +
    Data.SEASON.months[state.month] + ' DAY ' + state.day + '/' + Data.SEASON.daysPerMonth;
  $('phoneenergy').textContent = 'ENERGY ' + state.energy + '/' + state.maxEnergy;
  $('phonecash').textContent = money(state.cash);

  const ch = Data.CHARACTERS[state.picked];
  $('phoneability').textContent = ch.ability.name;
  $('phoneabilitydesc').textContent = ch.ability.desc;

  const sorted = [...leads].sort((a, b) => (STAGE_RANK[a.stage] - STAGE_RANK[b.stage]) || (b.warmth - a.warmth));
  const list = $('pipelinelist');
  list.innerHTML = '';
  if (!sorted.length) {
    list.innerHTML = '<div class="plempty">No active leads. Drive around — the market never sleeps.</div>';
  }
  for (const lead of sorted) {
    const row = document.createElement('div');
    row.className = 'plrow' + (lead.id === state.objectiveId ? ' sel' : '');
    const pct = Math.round(lead.warmth);
    row.innerHTML =
      '<div class="plstage stage-' + lead.stage + '">' + STAGE_LABEL[lead.stage] + '</div>' +
      '<div class="plmain"><div class="plname">' + lead.type.label + '</div>' +
      '<div class="plbar"><div class="plfill" style="width:' + pct + '%"></div></div></div>' +
      '<div class="plvalue">' + money(lead.value) + '</div>';
    row.addEventListener('click', () => {
      state.objectiveId = state.objectiveId === lead.id ? null : lead.id;
      renderPhone();
    });
    list.appendChild(row);
  }
}
