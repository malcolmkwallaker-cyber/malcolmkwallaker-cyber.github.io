// ============================================================
// core/save.js — localStorage save/load, same shape philosophy
// as the 2D game's save.js. One slot for the Phase-1..4 prototype.
// ============================================================
'use strict';

const KEY = 'rr3d_save_v1';

export function saveGame(state) {
  try {
    const snapshot = {
      picked: state.picked, difficulty: state.difficulty,
      cash: state.cash, sold: state.sold, followers: state.followers,
      day: state.day, month: state.month, energy: state.energy,
      maxEnergy: state.maxEnergy, savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
