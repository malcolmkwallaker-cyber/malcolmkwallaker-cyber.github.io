// ============================================================
// core/audio.js — tiny WebAudio synth, ported from the 2D
// game's audio.js. No samples, no assets, zero load time.
// ============================================================
'use strict';

export function createAudio(getMuted) {
  const A = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    beep(freq, dur = 0.08, type = 'square', vol = 0.1, slide = 0) {
      if (getMuted()) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(ctx.destination); osc.start(t); osc.stop(t + dur + 0.02);
    },
    seq(notes, step = 0.07, type = 'square', vol = 0.1) {
      notes.forEach((f, i) => { if (f) setTimeout(() => this.beep(f, step * 0.9, type, vol), i * step * 1000); });
    },
    cash() { this.seq([988, 1319, 988, 1568], 0.05, 'square', 0.12); },
    good() { this.seq([523, 659, 784], 0.07); },
    great() { this.seq([523, 659, 784, 1047], 0.07, 'square', 0.12); },
    bad() { this.seq([330, 262, 196], 0.09, 'sawtooth', 0.08); },
    select() { this.seq([660, 880], 0.06); },
    back() { this.seq([440, 330], 0.06); },
    thud() { this.beep(120, 0.12, 'sawtooth', 0.14, -60); },
    ring() { this.seq([880, 0, 880, 0, 880], 0.07, 'triangle', 0.1); },
    tick() { this.beep(1200, 0.03, 'square', 0.05); },
  };
  return A;
}
