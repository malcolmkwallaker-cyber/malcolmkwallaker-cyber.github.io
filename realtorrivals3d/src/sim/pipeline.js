// ============================================================
// sim/pipeline.js — the ported 2D "brain": lead spawning, warmth
// decay, stage progression, ghosting, appointment stealing, and
// commission math, all driven by Data.BALANCE/LEAD_TYPES exactly
// as in the 2D game (see docs/BUILD_PLAN.md Phase 4).
//
// Simplified stage set for this build: new -> hot -> appt -> sold.
// The full 8-stage pipeline (attendee/active/offer/pending) is
// Phase 5-7 work, once the matching activities exist.
// ============================================================
'use strict';

import * as THREE from 'three';
import Data, { C } from '../../data/game-data.js';
import { rand, rng, choice, money } from '../core/rng.js';
import { bus } from '../core/bus.js';
import { state, leads, nextId } from '../core/state.js';
import { buildHouse, makeLabel, colliders } from '../world/buildings.js';
import { mapToWorld, roadSegs, LAKES, S, lakeSDF, WORLD_W, WORLD_D, WATER_Y } from '../world/geo.js';
import { heightAt } from '../world/heightfield.js';

const STAGE_COLOR = { new: C.gray, hot: C.orange, appt: C.yellow };
const COMMISSION_RATE = 0.027; // same rate as the 2D game

export function balance() {
  return Data.BALANCE[state.difficulty] || Data.BALANCE.standard;
}

function pickLeadType() {
  const ch = Data.CHARACTERS[state.picked];
  const items = Data.LEAD_TYPES.map(t => ({
    ...t,
    weight: (t.weight || 1) * ((t.lake && ch.lakeLeadWeight) ? ch.lakeLeadWeight : 1),
  }));
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = rng() * total;
  for (const it of items) { r -= it.weight; if (r <= 0) return it; }
  return items[0];
}

function findSpawnSpot(type) {
  for (let tries = 0; tries < 40; tries++) {
    let x, z;
    if (type.lake) {
      const l = choice(LAKES);
      const a = rng() * Math.PI * 2;
      const c = mapToWorld(l.cx, l.cy);
      x = c.x + Math.cos(a) * (l.rx * S * 1.22);
      z = c.z + Math.sin(a) * (l.ry * S * 1.22);
    } else {
      const s2 = choice(roadSegs);
      const t = rng();
      const nx = -(s2.bz - s2.az), nz = (s2.bx - s2.ax);
      const L = Math.hypot(nx, nz) || 1;
      const side = rng() < 0.5 ? 1 : -1;
      x = s2.ax + (s2.bx - s2.ax) * t + nx / L * side * rand(16, 30);
      z = s2.az + (s2.bz - s2.az) * t + nz / L * side * rand(16, 30);
    }
    if (lakeSDF(x, z) < 1.1) continue;
    if (heightAt(x, z) < WATER_Y + 0.4) continue;
    if (Math.abs(x) > WORLD_W / 2 - 40 || Math.abs(z) > WORLD_D / 2 - 40) continue;
    let clash = false;
    for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < 16) { clash = true; break; }
    if (clash) continue;
    return { x, z };
  }
  return { x: 0, z: 0 };
}

export function spawnLead(scene) {
  const bal = balance();
  if (leads.length >= bal.maxActivePipeline) return null;
  const type = pickLeadType();
  const { x, z } = findSpawnSpot(type);
  const value = Math.round(rand(type.value[0], type.value[1]) / 1000) * 1000;
  const house = buildHouse(scene, x, z, { w: 9, d: 8, h: 4.5 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(STAGE_COLOR.new), transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  beacon.position.y = 15; house.add(beacon);
  const label = makeLabel(choice(Data.LEAD_NAMES), '#ffcd75', 0.9);
  label.position.y = 12; house.add(label);
  const lead = {
    id: nextId(), type, value, x, z, house, beacon, label,
    stage: 'new', warmth: type.warmth, daysIgnored: 0, touchedToday: false,
    bornDay: state.day, warned: false, stealAt: null,
  };
  leads.push(lead);
  bus.emit('lead:spawned', lead);
  return lead;
}

function setStage(lead, stage) {
  lead.stage = stage;
  lead.beacon.material.color.set(STAGE_COLOR[stage] || C.gray);
  bus.emit('lead:advanced', lead);
}

function retireLead(lead, scene) {
  scene.remove(lead.house);
  const idx = leads.indexOf(lead);
  if (idx >= 0) leads.splice(idx, 1);
}

function characterPitchBonus(lead) {
  const ch = Data.CHARACTERS[state.picked];
  let mult = 1;
  if (lead.type.lake && ch.id === 'malcolm') mult *= 1.2;       // lake specialist
  if (ch.negotiateBonus) mult *= (1 + ch.negotiateBonus * 0.6); // the closer closes
  return mult;
}

// Called by the pitch minigame with hit:boolean. Returns a result the UI
// uses to pick a toast/sound: { kind: 'advance'|'sold'|'miss'|'dropped', lead, commission? }
export function pitchLead(scene, lead, hit) {
  const bal = balance();
  lead.touchedToday = true;
  lead.daysIgnored = 0;

  if (lead.stage === 'appt') {
    if (hit) {
      const commission = Math.round(lead.value * COMMISSION_RATE);
      state.cash += commission;
      state.sold += 1;
      state.followers += 10 + Math.floor(rng() * 40);
      lead.beacon.material.color.set(C.green);
      lead.beacon.material.opacity = 0.5;
      // pull it out of the live pipeline immediately (it's sold — no more
      // pitching it) but let the "SOLD" sign linger visually for a beat.
      const idx = leads.indexOf(lead);
      if (idx >= 0) leads.splice(idx, 1);
      setTimeout(() => scene.remove(lead.house), 4000);
      bus.emit('lead:sold', lead);
      return { kind: 'sold', lead, commission };
    }
    // failed close: buyer gets cold feet, drops back a stage
    lead.warmth = Math.max(bal.warmThreshold - 5, lead.warmth - 15);
    setStage(lead, 'hot');
    return { kind: 'dropped', lead };
  }

  if (hit) {
    const gain = (18 + rng() * 14) * characterPitchBonus(lead);
    lead.warmth = Math.min(100, lead.warmth + gain);
    if (lead.stage === 'new' && lead.warmth >= bal.warmThreshold) setStage(lead, 'hot');
    if (lead.stage === 'hot' && lead.warmth >= bal.apptThreshold) setStage(lead, 'appt');
    return { kind: 'advance', lead };
  }
  lead.warmth = Math.max(5, lead.warmth - 12);
  return { kind: 'miss', lead };
}

// ---------- daily tick: decay, ghosting, appt steal, passive spawns ----------
export function dailyTick(scene) {
  const bal = balance();
  const toasts = []; // { msg, kind }

  for (let i = leads.length - 1; i >= 0; i--) {
    const lead = leads[i];
    if (lead.touchedToday) { lead.touchedToday = false; continue; }

    lead.daysIgnored += 1;

    if (lead.stage === 'new') {
      const idx = Math.min(lead.daysIgnored - 1, bal.decayNew.length - 1);
      lead.warmth = Math.max(3, lead.warmth - bal.decayNew[idx]);
      let ghostChance = 0;
      if (lead.daysIgnored >= 4) ghostChance = bal.ghostNew4;
      else if (lead.daysIgnored >= 3) ghostChance = bal.ghostNew3;
      if (ghostChance && rng() < ghostChance) {
        toasts.push({ msg: lead.type.label + ' ghosted you: ' + choice(Data.FLAVOR.lostReasons), kind: 'bad' });
        retireLead(lead, scene);
        continue;
      }
    } else if (lead.stage === 'hot') {
      const idx = Math.min(lead.daysIgnored - 1, bal.decayWarm.length - 1);
      lead.warmth = Math.max(3, lead.warmth - bal.decayWarm[idx]);
      if (lead.daysIgnored >= 3 && rng() < bal.ghostWarm3) {
        toasts.push({ msg: lead.type.label + ' ghosted you: ' + choice(Data.FLAVOR.lostReasons), kind: 'bad' });
        retireLead(lead, scene);
        continue;
      }
    } else if (lead.stage === 'appt') {
      if (rng() < bal.apptStealChance) {
        const rival = Data.CHARACTERS[state.picked === 'malcolm' ? 'bridger' : 'malcolm'];
        toasts.push({ msg: 'DEAL SNIPED! ' + rival.name + ' beat you to ' + lead.type.label + '.', kind: 'bad' });
        retireLead(lead, scene);
        continue;
      }
      if (rng() < bal.apptDropChance) {
        setStage(lead, 'hot');
        toasts.push({ msg: lead.type.label + ' got cold feet and dropped back to warm.', kind: 'bad' });
      }
    }
  }

  // passive lead generation
  for (let i = 0; i < bal.maxPassiveLeadsPerDay; i++) {
    if (rng() < 0.7) spawnLead(scene);
  }
  // keep the pipeline populated to the difficulty's starting count
  let guard = 0;
  while (leads.length < bal.startingLeadCount && guard++ < 20) spawnLead(scene);

  // energy refreshes each day
  state.energy = state.maxEnergy;

  return toasts;
}

// ---------- rival appointment-steal pressure (real-time warning) ----------
export function rivalTick(now, toastFn, audio) {
  const bal = balance();
  const apptLeads = leads.filter(l => l.stage === 'appt' && !l.stealAt);
  if (!apptLeads.length) return;
  for (const lead of apptLeads) {
    if (!lead.warned && rng() < bal.apptStealChance * 0.02) {
      lead.warned = true;
      lead.stealAt = now + 45000;
      const rival = Data.CHARACTERS[state.picked === 'malcolm' ? 'bridger' : 'malcolm'];
      toastFn('⚠ ' + rival.name + "'s car was spotted near " + lead.type.label + ' (' + money(lead.value) + '). 45 seconds!', 'bad');
      audio.thud();
      lead.beacon.material.color.set(C.red);
    }
  }
}

export function resolveStolenLeads(scene, now, toastFn, audio) {
  for (let i = leads.length - 1; i >= 0; i--) {
    const lead = leads[i];
    if (lead.stealAt && now > lead.stealAt) {
      toastFn('DEAL SNIPED! A competing agent swooped in with cookies and a lower commission.', 'bad');
      audio.bad();
      retireLead(lead, scene);
    }
  }
}
