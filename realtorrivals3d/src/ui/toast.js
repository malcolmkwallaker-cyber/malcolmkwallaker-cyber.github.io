// ============================================================
// ui/toast.js — bottom-of-screen notification queue.
// ============================================================
'use strict';

let container = null;
export function initToasts(el) { container = el; }

export function toast(msg, kind = '') {
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5200);
  while (container.children.length > 3) container.firstChild.remove();
}
