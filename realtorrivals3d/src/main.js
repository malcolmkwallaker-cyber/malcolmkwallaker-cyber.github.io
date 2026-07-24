// ============================================================
// main.js — boot, scene setup, and the frame loop. Ties every
// module together; contains no game rules of its own beyond
// wiring (car/on-foot switching, camera, per-frame UI refresh).
//
// Rendering: PBR materials + real-time shadows + a procedural
// sky/env-probe + (desktop only) bloom post-processing. See
// docs/TECH_ARCHITECTURE.md "Rendering upgrade" for the full
// writeup, the desktop/mobile quality split, and why SSAO
// specifically is left out (crashes under software-rendered
// WebGL in testing — not worth the risk without real-hardware
// verification; everything else here tested clean).
// ============================================================
'use strict';

import * as THREE from 'three';
import { EffectComposer } from '../lib/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/three-addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../lib/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/three-addons/postprocessing/OutputPass.js';
import Data from '../data/game-data.js';
import { clamp, money } from './core/rng.js';
import { bus } from './core/bus.js';
import { createAudio } from './core/audio.js';
import { createInput } from './core/input.js';
import { saveGame, loadGame } from './core/save.js';
import { state, leads } from './core/state.js';

import { mapToWorld } from './world/geo.js';
import { heightAt } from './world/heightfield.js';
import { buildTerrain, buildWater, buildRoadRibbons, setWaterEnvMap } from './world/terrain.js';
import { buildTowns, buildLocations, buildLandmarks, colliders } from './world/buildings.js';
import { buildForest } from './world/forest.js';
import { buildSky, buildEnvProbe } from './world/sky.js';

import { buildCharacter, updateOnFoot } from './actors/character.js';
import { buildCar, updateVehicle } from './actors/vehicle.js';

import { createCalendar } from './sim/calendar.js';
import { spawnLead, dailyTick, rivalTick, resolveStolenLeads, balance } from './sim/pipeline.js';

import { initToasts, toast } from './ui/toast.js';
import { updateHUD } from './ui/hud.js';
import { initMinimap, drawMinimap } from './ui/minimap.js';
import { initMinigame, mg, tryStartPitch, updateMinigame, confirmMinigame } from './ui/minigame.js';
import {
  initActivities, isActivityBlocking, openOfficeMenu, startFollowupSession,
  startCallSession, startTextSession, startListingSession, startShowHomesSession, startOpenHouseSession,
} from './ui/activity.js';
import { buildTitle } from './ui/title.js';
import { initPhone, togglePhone, isPhoneOpen, renderPhone } from './ui/phone.js';
import { updateCompass } from './ui/compass.js';

const $ = (id) => document.getElementById(id);

// ---------- three.js scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ---------- quality tier ----------
// Coarse-pointer (touch) devices AND software-rendered WebGL contexts
// both get the light tier. The second case matters beyond mobile:
// Chrome silently falls back to SwiftShader (a CPU software rasterizer)
// on real desktops when GPU drivers are blocklisted or hardware accel
// is off, and asking a software rasterizer to shadow-map 14k tree
// instances + a full-res cube env probe is what actually crashed this
// build in testing — not any single feature being unsupported. Detect
// it and drop to the same safe tier touch devices use.
function isSoftwareRenderer(gl) {
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const str = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|software|llvmpipe|softpipe|basic render/i.test(str || '');
  } catch (e) { return false; }
}
const isTouch = matchMedia('(pointer: coarse)').matches;
const isLowPower = isTouch || isSoftwareRenderer(renderer.getContext());
const QUALITY = isLowPower ? 'low' : 'high';
const usePost = !isLowPower;
const shadowMapSize = isLowPower ? 1024 : 2048;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1400);
scene.fog = new THREE.Fog(0x9fc9e8, 260, 950);

const sky = buildSky(scene);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a3a, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 340;
sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- post-processing ----------
// SSAO (contact-shadow ambient occlusion) was tried here and pulled:
// it needs a WebGL2 depth-texture render target, and under a software-
// rendered WebGL context it triggered a hard GPU-process crash that
// wasn't catchable via try/catch — not a risk worth taking without a
// real-GPU device to verify against. Bloom alone needs no depth
// texture and tested clean, so it stays.
let composer = null;
if (usePost) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.5, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize); onResize();

// ---------- world ----------
buildTerrain(scene);
buildWater(scene);
buildRoadRibbons(scene);
buildTowns(scene);
const locationObjs = buildLocations(scene);
buildLandmarks(scene);
buildForest(scene, QUALITY);

// procedural environment probe: gives every PBR material believable
// ambient specular and gives the lakes an actual reflection, with
// zero downloaded HDRIs — it's a cube camera pointed at our own
// hand-built sky + world, refreshed a few times a second.
const envProbe = buildEnvProbe(renderer, scene, isLowPower ? 64 : 128);
scene.environment = envProbe.texture;
setWaterEnvMap(envProbe.texture);

// ---------- audio / input ----------
const audio = createAudio(() => state.muted);
const input = createInput({ onFirstGesture: () => audio.ensure() });
input.bindStick($('stick'), $('knob'));
input.bindActionButton($('abtn'), 'e');

initToasts($('toasts'));
initMinimap($('minimap'));
initMinigame({ scene, toast, audio });
initActivities({ scene, toast, audio });
initPhone({ onEndDay: () => forceEndDay() });

// ---------- player + car ----------
let playerMesh = null, carMesh = null;
const player = { x: 0, z: 0, heading: 0, mode: 'car' };
const car = { x: 0, z: 0, heading: 0, speed: 0, vx: 0, vz: 0 };
{
  // spawn on the Brainerd–Walker highway, pointed at Walker
  const a = mapToWorld(352, 224), b = mapToWorld(318, 150);
  car.x = a.x; car.z = a.z;
  car.heading = Math.atan2(b.x - a.x, -(b.z - a.z));
  player.x = car.x; player.z = car.z;
}

// ---------- calendar / day rollover ----------
const calendar = createCalendar(scene, sky);
calendar.tick(0); // prime the sky dome's colors before the first frame renders
sun.position.set(car.x + calendar.sunDir.x * 260, 260, car.z + calendar.sunDir.z * 260);
sun.target.position.set(car.x, 0, car.z);
sun.target.updateMatrixWorld();
sun.intensity = 0.15 + calendar.dayness * 1.25;
sky.follow(car.x, car.z);
bus.on('day:changed', ({ day, month }) => {
  const toasts = dailyTick(scene);
  toast('A new day in ' + Data.SEASON.months[month] + ' (day ' + day + '). Fresh leads are out there.', 'good');
  toasts.slice(0, 3).forEach((t, i) => setTimeout(() => toast(t.msg, t.kind), 400 * (i + 1)));
  saveGame(state);
  if (isPhoneOpen()) renderPhone();
});

function forceEndDay() {
  // Skip straight to the next day's tick instead of waiting on the clock.
  state.tod = 1439.5;
  toast('Calling it a night...', '');
}

// ---------- resume a previous session, if any ----------
const savedGame = loadGame();
if (savedGame) {
  state.picked = savedGame.picked; state.difficulty = savedGame.difficulty;
  state.cash = savedGame.cash; state.sold = savedGame.sold; state.followers = savedGame.followers;
  state.day = savedGame.day; state.month = savedGame.month;
  state.energy = savedGame.energy; state.maxEnergy = savedGame.maxEnergy;
  const note = $('continuenote');
  if (note) note.textContent = 'Welcome back — continuing with ' + money(savedGame.cash) + ' in the bank, day ' +
    savedGame.day + ' of ' + Data.SEASON.months[savedGame.month] + '.';
}

// ---------- title / start ----------
buildTitle({
  audio,
  onStart() {
    const ch = Data.CHARACTERS[state.picked];
    $('hudwho').textContent = ch.name + ' — ' + ch.title;
    playerMesh = buildCharacter(state.picked === 'malcolm' ? 0x38b764 : 0x29366f, state.picked === 'malcolm' ? 0x41a6f6 : 0xffcd75);
    carMesh = buildCar(state.picked === 'malcolm' ? 0x38b764 : 0x29366f);
    scene.add(playerMesh, carMesh);
    playerMesh.visible = false;
    state.maxEnergy = Data.SEASON.baseEnergy;
    state.energy = state.maxEnergy;
    const bal = balance();
    for (let i = 0; i < bal.startingLeadCount; i++) spawnLead(scene);
    const rival = Data.CHARACTERS[state.picked === 'malcolm' ? 'bridger' : 'malcolm'];
    toast('Welcome to lake country, ' + ch.name + '. ' + rival.name + ' is already out there closing. Open your phone (P) to see the pipeline!', 'good');
    state.started = true;
  },
});

// ---------- main loop ----------
const ACTION_LOC_KEYS = new Set(['office', 'coffee', 'cabin', 'lakehome']);
let camPos = new THREE.Vector3(0, 40, 60);
const camTarget = new THREE.Vector3();
let last = performance.now();
const promptEl = $('prompt');

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.started) { renderer.render(scene, camera); return; }

  calendar.tick(dt);

  const { fwd, steer } = input.fwdSteer();
  const braking = input.keys[' '];
  const pressed = input.pressed;

  if (pressed['p']) togglePhone();

  // a lead pitch takes priority over enter/exit on the same E press
  let nearLead = null, nearLeadDist = 1e9;
  for (const l of leads) {
    const d = Math.hypot(player.x - l.x, player.z - l.z);
    if (d < nearLeadDist) { nearLeadDist = d; nearLead = l; }
  }
  const leadInRange = nearLead && nearLeadDist < 14;
  const phoneBlocking = isPhoneOpen();
  const uiBlocking = phoneBlocking || isActivityBlocking();

  // office/coffee/cabin/lakehome take priority over enter/exit car on the
  // same E press, same as lead pitching does — otherwise E parked at a
  // business just pops you out of the car instead of opening its menu.
  let nearActionLoc = null;
  for (const L of locationObjs) {
    if (ACTION_LOC_KEYS.has(L.key) && Math.hypot(player.x - L.wx, player.z - L.wz) < 22) {
      nearActionLoc = L; break;
    }
  }

  let eConsumedByMg = false;
  if (mg.active) {
    updateMinigame(dt);
    if (pressed['e'] || pressed[' '] || pressed['Enter']) { confirmMinigame(); eConsumedByMg = true; }
  } else if (uiBlocking) {
    // world paused-ish while the phone/office menu/dialogue is up (still renders, no input)
  } else if (player.mode === 'car') {
    const { tollMsg, rightX, rightZ } = updateVehicle(car, carMesh, fwd, steer, braking, dt, colliders, audio);
    if (tollMsg) { state.cash = Math.max(0, state.cash - 150); toast(tollMsg, 'bad'); }
    player.x = car.x; player.z = car.z; player.heading = car.heading;
    if (pressed['e'] && !leadInRange && !nearActionLoc && Math.abs(car.speed) < 4) {
      player.mode = 'foot';
      player.x = car.x + rightX * 3; player.z = car.z + rightZ * 3;
      playerMesh.visible = true; audio.select();
    }
  } else {
    updateOnFoot(player, playerMesh, camera, fwd, steer, dt, now, colliders);
    if (pressed['e'] && !leadInRange && !nearActionLoc && Math.hypot(player.x - car.x, player.z - car.z) < 5) {
      player.mode = 'car'; playerMesh.visible = false; audio.select();
    }
  }

  // ------- focus point (drives shadow-sun, env probe, camera, compass) -------
  const focusX = player.mode === 'car' ? car.x : player.x;
  const focusZ = player.mode === 'car' ? car.z : player.z;
  const hd = player.mode === 'car' ? car.heading : player.heading;
  const focusY = heightAt(focusX, focusZ);

  // the shadow camera's frustum is fixed in the light's local space, so
  // moving sun+target together keeps it centered on the player without
  // recomputing the frustum every frame — the world is far bigger than
  // any shadow map could cover, so the sun has to follow, not sit still.
  sun.position.set(focusX + calendar.sunDir.x * 260, focusY + Math.max(60, calendar.sunDir.y * 260), focusZ + calendar.sunDir.z * 260);
  sun.target.position.set(focusX, focusY, focusZ);
  sun.target.updateMatrixWorld();
  sun.intensity = 0.15 + calendar.dayness * 1.25;
  hemi.intensity = 0.25 + calendar.dayness * 0.55;
  envProbe.tick(focusX, focusY, focusZ);
  sky.follow(focusX, focusZ);

  // ------- interactions / prompts -------
  let promptTxt = '';
  if (!mg.active && !uiBlocking) {
    const fx = player.x, fz = player.z;
    const nearCar = Math.abs(car.speed) < 4;
    if (leadInRange && nearLead.isListing && !nearLead.openHoused) {
      promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — HOST OPEN HOUSE · ' + nearLead.type.label + ' (2 energy)';
      if (pressed['e'] && !eConsumedByMg) startOpenHouseSession(nearLead);
    } else if (leadInRange) {
      const verb = nearLead.stage === 'appt' ? 'CLOSE DEAL' : 'PITCH';
      promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — ' + verb + ' ' + nearLead.type.label + ' (' + nearLead.value.toLocaleString() + ')';
      if (pressed['e'] && !eConsumedByMg) tryStartPitch(nearLead);
    } else if (nearActionLoc && (player.mode === 'foot' || nearCar)) {
      if (nearActionLoc.key === 'office') {
        promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — ' + nearActionLoc.label + ' (CALL / TEXT LEADS)';
        if (pressed['e'] && !eConsumedByMg) openOfficeMenu();
      } else if (nearActionLoc.key === 'coffee') {
        promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — ' + nearActionLoc.label + ' (FOLLOW UP)';
        if (pressed['e'] && !eConsumedByMg) startFollowupSession();
      } else if (nearActionLoc.key === 'cabin') {
        promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — ' + nearActionLoc.label + ' (LISTING APPT)';
        if (pressed['e'] && !eConsumedByMg) startListingSession();
      } else {
        promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — ' + nearActionLoc.label + ' (SHOW HOMES)';
        if (pressed['e'] && !eConsumedByMg) startShowHomesSession();
      }
    } else if (player.mode === 'foot' && Math.hypot(player.x - car.x, player.z - car.z) < 5) {
      promptTxt = (input.isTouch ? 'ACTION' : 'E') + ' — GET IN THE CAR';
    } else if (player.mode === 'foot' || nearCar) {
      for (const L of locationObjs) {
        if (Math.hypot(fx - L.wx, fz - L.wz) >= 22) continue;
        promptTxt = L.label + ' — activities open in a later phase';
        break;
      }
    }
  }
  promptEl.style.display = promptTxt ? 'block' : 'none';
  promptEl.textContent = promptTxt;

  // beacons pulse with warmth (dying beacon = cooling lead)
  for (const l of leads) {
    const pulse = 0.5 + Math.sin(now / (150 + l.warmth * 8)) * 0.5;
    l.beacon.material.opacity = 0.18 + pulse * 0.3;
    l.label.position.y = 12 + Math.sin(now / 300) * 0.6;
  }
  if (!uiBlocking) {
    rivalTick(now, toast, audio);
    resolveStolenLeads(scene, now, toast, audio);
  }

  // ------- camera -------
  const back = player.mode === 'car' ? 13 + Math.abs(car.speed) * 0.18 : 8;
  const up = player.mode === 'car' ? 6 + Math.abs(car.speed) * 0.06 : 4.5;
  const dx = -Math.sin(hd) * back, dz = Math.cos(hd) * back;
  const gy = heightAt(focusX + dx, focusZ + dz);
  const desired = new THREE.Vector3(focusX + dx, Math.max(focusY + up, gy + 2.5), focusZ + dz);
  camPos.lerp(desired, clamp(4.5 * dt, 0, 1));
  camera.position.copy(camPos);
  camTarget.set(focusX, focusY + 2.2, focusZ);
  camera.lookAt(camTarget);

  updateCompass(focusX, focusZ, hd);

  if (pressed['m']) { state.muted = !state.muted; toast(state.muted ? 'Muted.' : 'Sound on.', ''); }

  updateHUD();
  drawMinimap(player, car, now);
  if (composer) composer.render(); else renderer.render(scene, camera);
  input.endFrame();
}
requestAnimationFrame(loop);

// debug/testing hook (harmless in production; used by the smoke tests)
window.__rr = {
  state, leads, player, car, mg, tryStartPitch, forceEndDay, balance,
  startCallSession, startTextSession, startFollowupSession,
  startListingSession, startShowHomesSession, startOpenHouseSession,
};
