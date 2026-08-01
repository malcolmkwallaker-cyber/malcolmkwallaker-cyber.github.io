// ============================================================
// ui/title.js — character + difficulty select, start button.
// ============================================================
'use strict';

import Data from '../../data/game-data.js';
import { state } from '../core/state.js';

const $ = (id) => document.getElementById(id);

export function buildTitle({ audio, onStart }) {
  const wrap = $('chars');
  for (const id of ['malcolm', 'bridger']) {
    const ch = Data.CHARACTERS[id];
    const el = document.createElement('div');
    el.className = 'charcard' + (id === state.picked ? ' sel' : '');
    el.innerHTML = '<div class="nm" style="color:' + (id === 'malcolm' ? 'var(--lime)' : 'var(--yellow)') + '">' + ch.name +
      '</div><div class="ti">' + ch.title + '</div><div class="st">' + ch.strengths.join('<br>') + '</div>';
    el.addEventListener('click', () => {
      state.picked = id; audio.select();
      document.querySelectorAll('.charcard').forEach(c => c.classList.remove('sel'));
      el.classList.add('sel');
    });
    wrap.appendChild(el);
  }

  const diffWrap = $('diffs');
  const diffIds = ['casual', 'standard', 'hard'];
  for (const id of diffIds) {
    const d = Data.BALANCE[id];
    const el = document.createElement('div');
    el.className = 'diffcard' + (id === state.difficulty ? ' sel' : '');
    el.innerHTML = '<div class="nm">' + d.label + '</div><div class="ti">' + d.desc + '</div>';
    el.addEventListener('click', () => {
      state.difficulty = id; audio.select();
      document.querySelectorAll('.diffcard').forEach(c => c.classList.remove('sel'));
      el.classList.add('sel');
    });
    diffWrap.appendChild(el);
  }

  $('startbtn').addEventListener('click', () => {
    audio.ensure(); audio.good();
    $('title').style.display = 'none';
    onStart();
  });
}
