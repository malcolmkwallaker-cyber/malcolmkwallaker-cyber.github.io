// ============================================================
// core/input.js — keyboard + touch-stick input, normalized into
// a small action state the main loop reads once per frame.
// ============================================================
'use strict';

export function createInput({ onFirstGesture } = {}) {
  const keys = {}, pressed = {};
  const touchState = { active: false, dx: 0, dy: 0 };
  const isTouch = matchMedia('(pointer: coarse)').matches;

  window.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    onFirstGesture?.();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
  });

  if (isTouch) document.body.classList.add('touch');

  function bindStick(stickEl, knobEl) {
    let stickId = null;
    const moveStick = (e) => {
      const r = stickEl.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      touchState.active = true; touchState.dx = dx; touchState.dy = dy;
      knobEl.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
    };
    stickEl.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); onFirstGesture?.(); });
    stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
    const end = (e) => {
      if (e.pointerId === stickId) {
        stickId = null; touchState.active = false; touchState.dx = 0; touchState.dy = 0;
        knobEl.style.transform = 'translate(-50%,-50%)';
      }
    };
    stickEl.addEventListener('pointerup', end);
    stickEl.addEventListener('pointercancel', end);
  }

  function bindActionButton(btnEl, key = 'e') {
    btnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed[key] = true; onFirstGesture?.(); });
  }

  function fwdSteer() {
    let fwd = 0, steer = 0;
    if (keys['w'] || keys['ArrowUp']) fwd += 1;
    if (keys['s'] || keys['ArrowDown']) fwd -= 1;
    if (keys['a'] || keys['ArrowLeft']) steer -= 1;
    if (keys['d'] || keys['ArrowRight']) steer += 1;
    if (touchState.active) { fwd += -touchState.dy; steer += touchState.dx; }
    return { fwd: Math.max(-1, Math.min(1, fwd)), steer: Math.max(-1, Math.min(1, steer)) };
  }

  function endFrame() { for (const k in pressed) pressed[k] = false; }

  return { keys, pressed, touchState, isTouch, bindStick, bindActionButton, fwdSteer, endFrame };
}
