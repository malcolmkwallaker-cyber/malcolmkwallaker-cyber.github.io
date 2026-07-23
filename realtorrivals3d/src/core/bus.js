// ============================================================
// core/bus.js — tiny event emitter. Sim and world logic emit
// events instead of reaching into UI directly; UI subscribes.
// Keeps sim/pipeline.js free of DOM/Three.js knowledge.
// ============================================================
'use strict';

const listeners = new Map();

export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt)?.delete(fn);
  },
  emit(evt, payload) {
    const set = listeners.get(evt);
    if (!set) return;
    for (const fn of set) fn(payload);
  },
};
