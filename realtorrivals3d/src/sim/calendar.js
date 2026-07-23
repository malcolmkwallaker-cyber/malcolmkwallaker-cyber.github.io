// ============================================================
// sim/calendar.js — day/night cycle + season calendar (3 months
// x 8 days, per Data.SEASON). Emits 'day:changed' on rollover so
// sim/pipeline.js can run its daily tick without this module
// knowing anything about leads.
// ============================================================
'use strict';

import * as THREE from 'three';
import Data from '../../data/game-data.js';
import { clamp } from '../core/rng.js';
import { bus } from '../core/bus.js';
import { state } from '../core/state.js';

const DAY_LEN = 480; // seconds per full in-game day while driving freely

export function createCalendar(scene, sun, hemi) {
  const skyDay = new THREE.Color(0x9fc9e8), skyDusk = new THREE.Color(0xef7d57);
  const skyNight = new THREE.Color(0x1a1c2c);
  const tmpSky = new THREE.Color();
  scene.background = new THREE.Color();

  return {
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
      sun.position.set(Math.cos(sunAng) * 500, Math.sin(sunAng) * 500, 150);
      const dayness = clamp(Math.sin(sunAng) * 1.6 + 0.25, 0, 1);
      const duskness = clamp(1 - Math.abs(Math.sin(sunAng)) * 3, 0, 1) * dayness;
      tmpSky.copy(skyNight).lerp(skyDay, dayness).lerp(skyDusk, duskness * 0.55);
      scene.background.copy(tmpSky);
      scene.fog.color.copy(tmpSky);
      sun.intensity = 0.15 + dayness * 1.25;
      hemi.intensity = 0.35 + dayness * 0.75;
    },
  };
}
