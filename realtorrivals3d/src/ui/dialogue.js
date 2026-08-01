// ============================================================
// ui/dialogue.js — shared multi-round dialogue-choice overlay.
// Generalizes the Phase 5 FOLLOW UP mechanic so Phase 6's LISTING
// APPT and SHOW HOMES can reuse it: N rounds, each a message + 3
// shuffled responses (1 good, 2 bad). Data.FOLLOWUP_ROUNDS and
// D.BATTLE.dialogue/market all share this exact {msg|prompt, good,
// bad[]} shape in the 2D game's data, so the same runner drives all
// three activities without caring which content list it's fed.
//
// Two usage shapes, both supported by the same queue:
//   - one round per target (FOLLOW UP: N different leads, 1 pick each)
//   - N rounds against one target (LISTING APPT/SHOW HOMES: 1 lead,
//     a fixed pitch script) — the caller decides via onFinish whether
//     each round matters immediately (onResolve) or only in aggregate.
// ============================================================
'use strict';

import { rand } from '../core/rng.js';

const $ = (id) => document.getElementById(id);

const dlg = { active: false, queue: [], total: 0, current: null, results: [], header: '', onResolve: null, onFinish: null };

export function isDialogueActive() { return dlg.active; }

// rounds: array of { target, content: {msg|prompt, good, bad[]} }
// opts: { header, onResolve(target, pickedGood, index), onFinish(results, total) }
export function startDialogueQueue(rounds, opts = {}) {
  if (!rounds.length) return false;
  dlg.queue = rounds.slice();
  dlg.total = rounds.length;
  dlg.results = [];
  dlg.header = opts.header || 'FOLLOW UP';
  dlg.onResolve = opts.onResolve || null;
  dlg.onFinish = opts.onFinish || null;
  nextRound();
  return true;
}

function nextRound() {
  if (!dlg.queue.length) { finish(); return; }
  const round = dlg.queue.shift();
  dlg.current = round;
  dlg.active = true;
  const content = round.content;
  const msg = content.msg || content.prompt;
  const options = [{ text: content.good, good: true }, ...content.bad.map(b => ({ text: b, good: false }))];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rand(0, i + 1)); [options[i], options[j]] = [options[j], options[i]]; }

  const progress = dlg.total > 1 ? ' (' + (dlg.total - dlg.queue.length) + '/' + dlg.total + ')' : '';
  const who = round.target && round.target.type ? ' · ' + round.target.type.label : '';
  $('dlgwho').textContent = dlg.header + progress + who;
  $('dlgmsg').textContent = msg;
  const box = $('dlgchoices');
  box.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'dlgbtn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => resolveRound(opt.good));
    box.appendChild(btn);
  }
  $('dlg').style.display = 'flex';
}

function resolveRound(pickedGood) {
  const round = dlg.current;
  const index = dlg.total - dlg.queue.length - 1;
  dlg.results.push(pickedGood);
  if (dlg.onResolve) dlg.onResolve(round.target, pickedGood, index);
  if (dlg.queue.length) { nextRound(); } else { finish(); }
}

function finish() {
  dlg.active = false;
  $('dlg').style.display = 'none';
  if (dlg.onFinish) dlg.onFinish(dlg.results, dlg.total);
  dlg.total = 0; dlg.results = []; dlg.onResolve = null; dlg.onFinish = null;
}
