// ============================================================
// ui/compass.js — points at the phone-selected objective lead:
// a rotating arrow + live distance, shown only while one is set.
// ============================================================
'use strict';

import { state, leads } from '../core/state.js';

const $ = (id) => document.getElementById(id);

export function updateCompass(focusX, focusZ, heading) {
  const el = $('compass');
  if (!state.objectiveId) { el.style.display = 'none'; return; }
  const lead = leads.find(l => l.id === state.objectiveId);
  if (!lead) { state.objectiveId = null; el.style.display = 'none'; return; }
  const dx = lead.x - focusX, dz = lead.z - focusZ;
  const dist = Math.hypot(dx, dz);
  const bearing = Math.atan2(dx, dz);
  const rel = bearing - heading;
  el.style.display = 'flex';
  $('compassarrow').style.transform = 'rotate(' + rel + 'rad)';
  $('compassdist').textContent = lead.type.label + ' — ' + Math.round(dist) + 'm';
}
