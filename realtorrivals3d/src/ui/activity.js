// ============================================================
// ui/activity.js — the office menu (CALL LEADS / TEXT LEADS) and
// the coffee-shop FOLLOW UP dialogue activity. These are the
// first three Data.ACTIONS from the 2D game (Phase 5 of
// docs/BUILD_PLAN.md): remote, location-gated ways to touch
// leads without having to physically stand at their front door.
//
// CALL/TEXT route through ui/minigame.js's session queue so they
// share the exact same timing-bar + pipeline.pitchLead() rules as
// the in-person pitch. FOLLOW UP gets its own dialogue queue,
// using Data.FOLLOWUP_ROUNDS verbatim from the 2D game.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { choice, rand, money } from '../core/rng.js';
import { state, leads } from '../core/state.js';
import { pitchLead, balance } from '../sim/pipeline.js';
import { startSession } from './minigame.js';

const $ = (id) => document.getElementById(id);

let deps = null; // { toast, audio, scene }
const dlg = { active: false, queue: [], total: 0, current: null, results: [] };
let officeMenuOpen = false;

export function initActivities(d) {
  deps = d;
  $('officecall').addEventListener('click', () => { closeOfficeMenu(); startCallSession(); });
  $('officetext').addEventListener('click', () => { closeOfficeMenu(); startTextSession(); });
  $('officeclose').addEventListener('click', closeOfficeMenu);
}

export function isActivityBlocking() { return officeMenuOpen || dlg.active; }

// ---------------- office menu ----------------
export function openOfficeMenu() {
  if (state.energy <= 0) {
    deps.toast("You're running on empty. Head home and sleep (phone → END DAY) to recharge.", 'bad');
    return;
  }
  officeMenuOpen = true;
  $('actionmenu').style.display = 'flex';
}
function closeOfficeMenu() {
  officeMenuOpen = false;
  $('actionmenu').style.display = 'none';
}

function candidateLeads(max) {
  // stage !== 'appt': appointments get closed in person, not by phone.
  return leads.filter(l => l.stage !== 'appt').sort((a, b) => b.warmth - a.warmth).slice(0, max);
}

export function startCallSession() {
  const targets = candidateLeads(3);
  if (!targets.length) { deps.toast('No one worth calling right now — the pipeline is either empty or all appointments.', ''); return; }
  startSession(targets, { verb: 'CALL', speed: 0.85, zoneMult: 1 });
}

export function startTextSession() {
  const targets = candidateLeads(4);
  if (!targets.length) { deps.toast('No one worth texting right now — the pipeline is either empty or all appointments.', ''); return; }
  startSession(targets, { verb: 'TEXT', speed: 1.15, zoneMult: 0.8 });
}

// ---------------- follow up (dialogue) ----------------
// Choice buttons are rebuilt fresh every round since the 3 options differ each time.
export function startFollowupSession() {
  if (state.energy <= 0) {
    deps.toast("You're running on empty. Head home and sleep (phone → END DAY) to recharge.", 'bad');
    return;
  }
  const bal = balance();
  const atRisk = leads
    .filter(l => l.stage !== 'appt' && l.daysIgnored >= 1)
    .sort((a, b) => b.daysIgnored - a.daysIgnored || a.warmth - b.warmth)
    .slice(0, bal.followupContacts);
  if (!atRisk.length) {
    deps.toast("Nobody's at risk of ghosting right now — nice work staying on top of it.", 'good');
    return;
  }
  state.energy = Math.max(0, state.energy - 1);
  dlg.queue = atRisk.slice();
  dlg.total = atRisk.length;
  dlg.results = [];
  nextDialogueRound();
}

function nextDialogueRound() {
  if (!dlg.queue.length) { finishDialogue(); return; }
  const lead = dlg.queue.shift();
  dlg.current = lead;
  dlg.active = true;
  const round = choice(Data.FOLLOWUP_ROUNDS);
  const options = [{ text: round.good, good: true }, ...round.bad.map(b => ({ text: b, good: false }))];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rand(0, i + 1)); [options[i], options[j]] = [options[j], options[i]]; }

  const progress = dlg.total > 1 ? ' (' + (dlg.total - dlg.queue.length) + '/' + dlg.total + ')' : '';
  $('dlgwho').textContent = 'FOLLOW UP' + progress + ' · ' + lead.type.label;
  $('dlgmsg').textContent = round.msg;
  const box = $('dlgchoices');
  box.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'dlgbtn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => resolveDialogueRound(opt.good));
    box.appendChild(btn);
  }
  $('dlg').style.display = 'flex';
}

function resolveDialogueRound(hit) {
  const lead = dlg.current;
  const result = pitchLead(deps.scene, lead, hit);
  dlg.results.push(result);
  const { toast, audio } = deps;
  if (result.kind === 'advance') {
    audio.good();
    toast('Good save. ' + lead.type.label + ' warmth: ' + Math.round(lead.warmth), 'good');
  } else if (result.kind === 'sold') {
    audio.cash();
    toast('SOLD! ' + lead.type.label + ' — ' + money(lead.value) + '  (+' + money(result.commission) + ' commission)', 'cash');
  } else if (result.kind === 'dropped') {
    audio.bad();
    toast('Cold feet! ' + lead.type.label + ' backed off the appointment.', 'bad');
  } else {
    audio.bad();
    toast('That answer landed flat. ' + lead.type.label + ' is still on edge.', 'bad');
  }
  if (dlg.queue.length) { nextDialogueRound(); } else { finishDialogue(); }
}

function finishDialogue() {
  dlg.active = false;
  $('dlg').style.display = 'none';
  if (dlg.total > 1) {
    const wins = dlg.results.filter(r => r.kind === 'advance' || r.kind === 'sold').length;
    deps.toast('FOLLOW UP session done: saved ' + wins + '/' + dlg.total + ' relationships.', wins > 0 ? 'good' : 'bad');
  }
  dlg.total = 0; dlg.results = [];
}
