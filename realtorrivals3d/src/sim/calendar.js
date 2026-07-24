// ============================================================
// sim/calendar.js — day/night cycle + season calendar (3 months
// x 8 days, per Data.SEASON). Emits 'day:changed' on rollover so
// sim/pipeline.js can run its daily tick without this module
// knowing anything about leads.
//
// Drives the sky dome's gradient colors and exposes `sunDir` (a
// unit vector) so main.js can position the actual shadow-casting
// light relative to the player each frame — the world is much
// larger than any shadow camera frustum can cover, so the sun
// has to follow the player instead of sitting at a fixed point.
// ============================================================
'use strict';

import * as THREE from 'three';
import Data from '../../data/game-data.js';
import { clamp } from '../core/rng.js';
import { bus } from '../core/bus.js';
import { state } from '../core/state.js';

const DAY_LEN = 480; // seconds per full in-game day while driving freely

export function createCalendar(scene, sky) {
  const skyDay = new THREE.Color(0x9fc9e8), skyDusk = new THREE.Color(0xef7d57);
  const skyNight = new THREE.Color(0x1a1c2c);
  const zenithDay = new THREE.Color(0x3f7fd9), zenithNight = new THREE.Color(0x05060f);
  const horizon = new THREE.Color(), zenith = new THREE.Color();

  const sunDir = new THREE.Vector3(0, 1, 0);

  return {
    sunDir,
    dayness: 1,
    tick(dt) {
      state.tod += (dt / DAY_LEN) * 1440;
      if (state.tod >= 1440) {
        state.tod -= 1440; state.day += 1;
        if (state.day > Data.SEASON.daysPerMonth) {
          state.day = 1; state.month = (state.month + 1) % Data.SEASON.months.length;
        }
        bus.emit('day:changed', { day: state.day, month: state.month });
      }
      const t = state.tod / 1440;
      const sunAng = (t - 0.25) * Math.PI * 2; // sunrise ~6am
      sunDir.set(Math.cos(sunAng), Math.max(0.06, Math.sin(sunAng)), 0.3).normalize();
      const dayness = clamp(Math.sin(sunAng) * 1.6 + 0.25, 0, 1);
      const duskness = clamp(1 - Math.abs(Math.sin(sunAng)) * 3, 0, 1) * dayness;
      this.dayness = dayness;
      horizon.copy(skyNight).lerp(skyDay, dayness).lerp(skyDusk, duskness * 0.55);
      zenith.copy(zenithNight).lerp(zenithDay, dayness);
      sky.setColors(horizon, zenith);
      scene.fog.color.copy(horizon);
    },
  };
}
