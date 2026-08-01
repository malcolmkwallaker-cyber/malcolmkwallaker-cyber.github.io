// ============================================================
// core/state.js — the single mutable game-state object + the
// live pipeline (leads array). Sim, UI, and the main loop all
// read/write this; nothing else holds duplicate state.
// ============================================================
'use strict';

export const state = {
  picked: 'malcolm',
  difficulty: 'standard',
  cash: 1200, sold: 0, followers: 150,
  day: 1, month: 0, tod: 8 * 60,   // time-of-day in minutes
  energy: 3, maxEnergy: 3,
  objectiveId: null,               // lead currently targeted from the phone
  started: false, muted: false,
};

// Each lead: { id, type, value, stage, warmth, x, z, house, beacon, label,
//              daysIgnored, bornDay }
export const leads = [];
let nextLeadId = 1;
export function nextId() { return nextLeadId++; }
