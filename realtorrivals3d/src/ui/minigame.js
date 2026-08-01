// ============================================================
// ui/minigame.js — the shared "stop the needle" timing-bar
// overlay. Runs as a QUEUE: a session can process one lead (the
// walk-up pitch/close) or several in a row (CALL LEADS / TEXT
// LEADS from ui/activity.js), spending energy once per session
// no matter how many leads it touches — mirrors the 2D game's
// flat per-action energy cost.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { rand, clamp, money } from '../core/rng.js';
import { state } from '../core/state.js';
import { pitchLead } from '../sim/pipeline.js';

const $ = (id) => document.getElementById(id);

export const mg = {
  active: false, zoneA: 0, zoneW: 0, lead: null, dir: 1, pos: 0, speed: 0.85,
  queue: [], total: 0, verb: 'PITCH', results: [],
  customResolve: null, onFinish: null,
};

let deps = null; // { scene, toast, audio }
export function initMinigame(d) {
  deps = d;
  $('mg').addEventListener('pointerdown', () => { if (mg.active) resolveRound(); });
}

// Single-lead session — the in-person walk-up pitch/close.
export function tryStartPitch(lead) {
  const verb = lead.stage === 'appt' ? 'CLOSE THE DEAL' : 'WARM UP THE LEAD';
  return startSession([lead], { verb });
}

// General entry point: opts = { verb, speed, zoneMult, spendEnergy,
//   customResolve(target, hit), onFinish(results, total) }
// Without customResolve, each round routes through sim/pipeline.js's
// pitchLead() and the normal sold/advance/dropped/miss toasts apply —
// this is what CALL/TEXT/walk-up pitch use. With customResolve, the
// caller owns what a "hit" means (used by OPEN HOUSE, where targets
// are transient arrivals, not real pipeline leads).
export function startSession(targets, opts = {}) {
  if (!targets.length) return false;
  if (opts.spendEnergy !== false) {
    if (state.energy <= 0) {
      deps.toast("You're running on empty. Head home and sleep (phone → END DAY) to recharge.", 'bad');
      return false;
    }
    state.energy = Math.max(0, state.energy - 1);
  }
  mg.queue = targets.slice();
  mg.total = targets.length;
  mg.verb = opts.verb || 'PITCH';
  mg.speed = opts.speed || 0.85;
  mg.zoneMult = opts.zoneMult || 1;
  mg.results = [];
  mg.customResolve = opts.customResolve || null;
  mg.onFinish = opts.onFinish || null;
  nextRound();
  return true;
}

function nextRound() {
  if (!mg.queue.length) { finishSession(); return; }
  const lead = mg.queue.shift();
  mg.active = true; mg.lead = lead; mg.pos = 0; mg.dir = 1;
  const warm = clamp(lead.warmth / 100, 0.1, 0.95);
  const ch = Data.CHARACTERS[state.picked];
  let zw = 0.13 + warm * 0.28;
  if (lead.type.lake && ch.id === 'malcolm') zw *= 1.2;
  if (ch.negotiateBonus) zw *= (1 + ch.negotiateBonus * 0.6);
  if (lead.stage === 'appt') zw *= 0.85; // closing is harder than warming up
  zw *= mg.zoneMult;
  mg.zoneW = clamp(zw, 0.08, 0.55);
  mg.zoneA = rand(0.08, 0.9 - mg.zoneW);
  const progress = mg.total > 1 ? ' (' + (mg.total - mg.queue.length) + '/' + mg.total + ')' : '';
  const valueTxt = lead.value ? ' · ' + money(lead.value) : '';
  $('mgtitle').textContent = mg.verb + progress + ' · ' + lead.type.label + valueTxt;
  $('mginfo').textContent = 'Warmth ' + Math.round(lead.warmth) + ' — stop the needle in the green!';
  $('mgzone').style.left = (mg.zoneA * 100) + '%';
  $('mgzone').style.width = (mg.zoneW * 100) + '%';
  $('mg').style.display = 'flex';
}

function resolveRound() {
  mg.active = false;
  const lead = mg.lead;
  const hit = mg.pos >= mg.zoneA && mg.pos <= mg.zoneA + mg.zoneW;
  const { toast, audio } = deps;

  if (mg.customResolve) {
    mg.customResolve(lead, hit);
    mg.results.push(hit);
    if (mg.queue.length) { nextRound(); } else { finishSession(); }
    return;
  }

  const result = pitchLead(deps.scene, lead, hit);
  mg.results.push(result);
  if (result.kind === 'sold') {
    audio.cash();
    toast('SOLD! ' + lead.type.label + ' — ' + money(lead.value) + '  (+' + money(result.commission) + ' commission)', 'cash');
    if (state.sold % 5 === 0) {
      toast('The rival is fuming. "' + (state.picked === 'malcolm' ? 'Nice sale. Adorable, even.' : 'I taught him that.') + '"', 'good');
    }
  } else if (result.kind === 'readyForListing') {
    audio.good();
    toast(lead.type.label + " is ready to list! Head to the SELLER CABIN for a LISTING APPT — warmth alone won't seal it.", 'good');
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
  if (mg.queue.length) { nextRound(); } else { finishSession(); }
}

function finishSession() {
  mg.active = false;
  $('mg').style.display = 'none';
  if (mg.onFinish) {
    mg.onFinish(mg.results, mg.total);
  } else if (mg.total > 1) {
    const wins = mg.results.filter(r => r.kind === 'advance' || r.kind === 'sold').length;
    deps.toast(mg.verb + ' session done: ' + wins + '/' + mg.total + ' went well.', wins > 0 ? 'good' : 'bad');
  }
  mg.customResolve = null; mg.onFinish = null;
  mg.total = 0; mg.results = [];
}

export function updateMinigame(dt) {
  if (!mg.active) return false;
  mg.pos += mg.dir * dt * mg.speed;
  if (mg.pos > 1) { mg.pos = 1; mg.dir = -1; }
  if (mg.pos < 0) { mg.pos = 0; mg.dir = 1; }
  $('mgneedle').style.left = 'calc(' + (mg.pos * 100) + '% - 2px)';
  return true;
}

export function confirmMinigame() {
  if (mg.active) resolveRound();
}
