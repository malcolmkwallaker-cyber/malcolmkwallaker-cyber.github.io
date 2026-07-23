// ============================================================
// ui/minigame.js — the shared "stop the needle" timing-bar
// overlay used by the pitch/close action. Later activities
// (Phase 5+) get their own overlay but reuse this shell.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { rand, clamp, money } from '../core/rng.js';
import { state } from '../core/state.js';
import { pitchLead } from '../sim/pipeline.js';

const $ = (id) => document.getElementById(id);

export const mg = { active: false, zoneA: 0, zoneW: 0, lead: null, dir: 1, pos: 0 };

let deps = null; // { scene, toast, audio }
export function initMinigame(d) {
  deps = d;
  $('mg').addEventListener('pointerdown', () => { if (mg.active) resolveMinigame(); });
}

export function tryStartPitch(lead) {
  if (state.energy <= 0) {
    deps.toast("You're running on empty. Head home and sleep (phone → END DAY) to recharge.", 'bad');
    return false;
  }
  startMinigame(lead);
  return true;
}

function startMinigame(lead) {
  mg.active = true; mg.lead = lead; mg.pos = 0; mg.dir = 1;
  const warm = clamp(lead.warmth / 100, 0.1, 0.95);
  const ch = Data.CHARACTERS[state.picked];
  let zw = 0.13 + warm * 0.28;
  if (lead.type.lake && ch.id === 'malcolm') zw *= 1.2;
  if (ch.negotiateBonus) zw *= (1 + ch.negotiateBonus * 0.6);
  if (lead.stage === 'appt') zw *= 0.85; // closing is harder than warming up
  mg.zoneW = clamp(zw, 0.1, 0.55);
  mg.zoneA = rand(0.08, 0.9 - mg.zoneW);
  const verb = lead.stage === 'appt' ? 'CLOSE THE DEAL' : 'WARM UP THE LEAD';
  $('mgtitle').textContent = verb + ' · ' + lead.type.label + ' · ' + money(lead.value);
  $('mginfo').textContent = 'Warmth ' + Math.round(lead.warmth) + ' — stop the needle in the green!';
  $('mgzone').style.left = (mg.zoneA * 100) + '%';
  $('mgzone').style.width = (mg.zoneW * 100) + '%';
  $('mg').style.display = 'flex';
}

function resolveMinigame() {
  mg.active = false; $('mg').style.display = 'none';
  const lead = mg.lead;
  const hit = mg.pos >= mg.zoneA && mg.pos <= mg.zoneA + mg.zoneW;
  state.energy = Math.max(0, state.energy - 1);
  const result = pitchLead(deps.scene, lead, hit);
  const { toast, audio } = deps;
  if (result.kind === 'sold') {
    audio.cash();
    toast('SOLD! ' + lead.type.label + ' — ' + money(lead.value) + '  (+' + money(result.commission) + ' commission)', 'cash');
    if (state.sold % 5 === 0) {
      toast('The rival is fuming. "' + (state.picked === 'malcolm' ? 'Nice sale. Adorable, even.' : 'I taught him that.') + '"', 'good');
    }
  } else if (result.kind === 'advance') {
    audio.good();
    const label = lead.stage === 'appt' ? 'APPOINTMENT SET! Ready to close.' : 'Warming up nicely.';
    toast(label + ' ' + lead.type.label + ' warmth: ' + Math.round(lead.warmth), 'good');
  } else if (result.kind === 'dropped') {
    audio.bad();
    toast('Cold feet! ' + lead.type.label + ' backed off the appointment. Warm them up again.', 'bad');
  } else {
    audio.bad();
    toast('They said they want to "sleep on it, maybe till fall." Warmth down — try again.', 'bad');
  }
}

export function updateMinigame(dt) {
  if (!mg.active) return false;
  mg.pos += mg.dir * dt * 0.85;
  if (mg.pos > 1) { mg.pos = 1; mg.dir = -1; }
  if (mg.pos < 0) { mg.pos = 0; mg.dir = 1; }
  $('mgneedle').style.left = 'calc(' + (mg.pos * 100) + '% - 2px)';
  return true;
}

export function confirmMinigame() {
  if (mg.active) resolveMinigame();
}
