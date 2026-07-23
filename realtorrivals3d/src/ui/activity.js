// ============================================================
// ui/activity.js — location-gated activities beyond the in-person
// pitch: the office menu (CALL LEADS / TEXT LEADS, Phase 5), the
// coffee-shop FOLLOW UP dialogue (Phase 5), and Phase 6's LISTING
// APPT (Seller Cabin), OPEN HOUSE (at a won listing), and SHOW
// HOMES (Lake Home).
//
// CALL/TEXT route through ui/minigame.js's session queue. FOLLOW
// UP, LISTING APPT, and SHOW HOMES all route through
// ui/dialogue.js's shared multi-round dialogue queue — FOLLOW UP
// uses Data.FOLLOWUP_ROUNDS (one round per at-risk lead), LISTING
// APPT and SHOW HOMES use D.BATTLE.dialogue/market (three fixed
// rounds against one lead) — all three content lists are ported
// verbatim from the 2D game.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { choice, money } from '../core/rng.js';
import { state, leads } from '../core/state.js';
import { pitchLead, balance, winSellerListing, sellerPitchMiss, spawnAttendeeNear } from '../sim/pipeline.js';
import { startSession } from './minigame.js';
import { startDialogueQueue, isDialogueActive } from './dialogue.js';

const $ = (id) => document.getElementById(id);

let deps = null; // { toast, audio, scene }
let officeMenuOpen = false;

export function initActivities(d) {
  deps = d;
  $('officecall').addEventListener('click', () => { closeOfficeMenu(); startCallSession(); });
  $('officetext').addEventListener('click', () => { closeOfficeMenu(); startTextSession(); });
  $('officeclose').addEventListener('click', closeOfficeMenu);
}

export function isActivityBlocking() { return officeMenuOpen || isDialogueActive(); }

function needEnergy() {
  if (state.energy > 0) return true;
  deps.toast("You're running on empty. Head home and sleep (phone → END DAY) to recharge.", 'bad');
  return false;
}

// ---------------- office menu: CALL LEADS / TEXT LEADS ----------------
export function openOfficeMenu() {
  if (!needEnergy()) return;
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

// ---------------- follow up (coffee shop) ----------------
export function startFollowupSession() {
  if (!needEnergy()) return;
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
  const rounds = atRisk.map(lead => ({ target: lead, content: choice(Data.FOLLOWUP_ROUNDS) }));
  startDialogueQueue(rounds, {
    header: 'FOLLOW UP',
    onResolve: (lead, hit) => {
      const result = pitchLead(deps.scene, lead, hit);
      const { toast, audio } = deps;
      if (result.kind === 'sold') {
        audio.cash();
        toast('SOLD! ' + lead.type.label + ' — ' + money(lead.value) + '  (+' + money(result.commission) + ' commission)', 'cash');
      } else if (result.kind === 'readyForListing') {
        audio.good();
        toast(lead.type.label + ' is ready to list! Head to the SELLER CABIN for a LISTING APPT.', 'good');
      } else if (result.kind === 'advance') {
        audio.good();
        toast('Good save. ' + lead.type.label + ' warmth: ' + Math.round(lead.warmth), 'good');
      } else if (result.kind === 'dropped') {
        audio.bad();
        toast('Cold feet! ' + lead.type.label + ' backed off the appointment.', 'bad');
      } else {
        audio.bad();
        toast('That answer landed flat. ' + lead.type.label + ' is still on edge.', 'bad');
      }
    },
    onFinish: (results, total) => {
      if (total <= 1) return;
      const wins = results.filter(Boolean).length;
      deps.toast('FOLLOW UP session done: saved ' + wins + '/' + total + ' relationships.', wins > 0 ? 'good' : 'bad');
    },
  });
}

// ---------------- listing appt (seller cabin) ----------------
export function startListingSession() {
  if (!needEnergy()) return;
  const candidate = leads
    .filter(l => l.type.seller && !l.isListing)
    .sort((a, b) => b.warmth - a.warmth)[0];
  if (!candidate) {
    deps.toast('No sellers worth pitching right now — check back after a few more leads come in.', '');
    return;
  }
  state.energy = Math.max(0, state.energy - 1);
  const rounds = Data.BATTLE.dialogue.map(content => ({ target: candidate, content }));
  startDialogueQueue(rounds, {
    header: 'LISTING APPT',
    onResolve: (lead, hit) => {
      deps.audio[hit ? 'good' : 'bad']();
      deps.toast(hit ? 'Nice answer.' : "That didn't land.", hit ? 'good' : 'bad');
    },
    onFinish: (results) => {
      const hits = results.filter(Boolean).length;
      if (hits >= Math.ceil(results.length / 2)) {
        winSellerListing(deps.scene, candidate);
        deps.audio.great();
        deps.toast("YOU GOT THE LISTING! " + candidate.type.label + " is officially FOR SALE — host an open house whenever you're ready.", 'good');
      } else {
        sellerPitchMiss(candidate);
        deps.audio.bad();
        deps.toast(candidate.type.label + ' went with a different agent this time. Warm them back up and try again.', 'bad');
      }
    },
  });
}

// ---------------- open house (at a won listing) ----------------
const ATTENDEE_LABELS = [
  'A YOUNG COUPLE', 'A RETIRED COUPLE', 'A CURIOUS NEIGHBOR', 'A FIRST-TIME BUYER',
  'A FAMILY OF FIVE', 'SOMEONE "JUST LOOKING"', 'A CASH BUYER', 'AN OUT-OF-TOWNER',
];

export function startOpenHouseSession(listingLead) {
  if (state.energy < 2) {
    deps.toast(state.energy <= 0
      ? "You're running on empty. Head home and sleep (phone → END DAY) to recharge."
      : 'Open houses take 2 energy — you only have ' + state.energy + ' left today.', 'bad');
    return;
  }
  if (listingLead.openHoused) {
    deps.toast('Already hosted an open house here — the buzz has moved on.', '');
    return;
  }
  state.energy = Math.max(0, state.energy - 2);
  listingLead.openHoused = true;
  const rounds = 4;
  const arrivals = [];
  for (let i = 0; i < rounds; i++) {
    arrivals.push({ type: { label: choice(ATTENDEE_LABELS), lake: false }, value: 0, warmth: 55, stage: 'new' });
  }
  let captured = 0;
  startSession(arrivals, {
    verb: 'GREET',
    spendEnergy: false,
    customResolve: (arrival, hit) => {
      const { toast, audio } = deps;
      if (!hit) { audio.bad(); toast(arrival.type.label + ' wandered off toward the cookies and never came back.', 'bad'); return; }
      const newLead = spawnAttendeeNear(deps.scene, listingLead);
      if (!newLead) { audio.bad(); toast('Great chat with ' + arrival.type.label + ', but your pipeline is full — no room to add them.', 'bad'); return; }
      captured += 1;
      audio.good();
      toast(arrival.type.label + ' signed in and is now a hot lead: ' + newLead.type.label + '!', 'good');
    },
    onFinish: () => {
      deps.toast('Open house wrapped. Captured ' + captured + '/' + rounds + ' new leads.', captured > 0 ? 'good' : 'bad');
    },
  });
}

// ---------------- show homes (lake home) ----------------
export function startShowHomesSession() {
  if (!needEnergy()) return;
  const candidate = leads
    .filter(l => !l.type.seller && l.stage === 'appt')
    .sort((a, b) => b.warmth - a.warmth)[0];
  if (!candidate) {
    deps.toast('No buyers ready for a showing right now — warm one up to an appointment first.', '');
    return;
  }
  state.energy = Math.max(0, state.energy - 1);
  const rounds = Data.BATTLE.market.map(content => ({ target: candidate, content }));
  startDialogueQueue(rounds, {
    header: 'SHOW HOMES',
    onResolve: (lead, hit) => {
      deps.audio[hit ? 'good' : 'bad']();
      deps.toast(hit ? 'They liked that answer.' : 'That one missed the mark.', hit ? 'good' : 'bad');
    },
    onFinish: (results) => {
      const hits = results.filter(Boolean).length;
      const majorityHit = hits >= Math.ceil(results.length / 2);
      const result = pitchLead(deps.scene, candidate, majorityHit);
      const { toast, audio } = deps;
      if (result.kind === 'sold') {
        audio.cash();
        toast('THEY FOUND "THE ONE"! ' + candidate.type.label + ' — ' + money(candidate.value) + '  (+' + money(result.commission) + ' commission)', 'cash');
      } else {
        audio.bad();
        toast('Nothing clicked on this tour. ' + candidate.type.label + ' wants to keep looking.', 'bad');
      }
    },
  });
}
