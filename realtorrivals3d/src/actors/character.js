// ============================================================
// actors/character.js — the on-foot character mesh + controller.
// ============================================================
'use strict';

import * as THREE from 'three';
import { box } from '../world/buildings.js';
import { heightAt } from '../world/heightfield.js';
import { lakeSDF, WATER_Y } from '../world/geo.js';

export function buildCharacter(colorHex, accentHex) {
  const g = new THREE.Group();
  const legs = box(0.65, 0.85, 0.4, 0x333c57); legs.position.y = 0.42; g.add(legs);
  const torso = box(0.8, 0.85, 0.5, colorHex); torso.position.y = 1.25; g.add(torso);
  const armL = box(0.22, 0.8, 0.28, colorHex); armL.position.set(-0.55, 1.25, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.55; g.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b890 }));
  head.position.y = 2.0; g.add(head);
  const cap = box(0.55, 0.18, 0.55, accentHex); cap.position.y = 2.22; g.add(cap);
  g.userData.limbs = { armL, armR, legs };
  return g;
}

// player: { x, z, heading }. Returns nothing; mutates player + playerMesh in place.
export function updateOnFoot(player, playerMesh, camera, fwd, steer, dt, now, colliders) {
  const camYaw = Math.atan2(camera.position.x - player.x, camera.position.z - player.z);
  const mx = steer, mz = fwd;
  const mag = Math.hypot(mx, mz);
  if (mag > 0.05) {
    const ang = Math.atan2(mx, mz) + camYaw + Math.PI;
    const spd = 8.5 * Math.min(1, mag);
    let nx = player.x + Math.sin(ang) * spd * dt;
    let nz = player.z + Math.cos(ang) * spd * dt;
    for (const c of colliders) {
      const dx = nx - c.x, dz = nz - c.z;
      if (Math.abs(dx) < c.hx + 0.6 && Math.abs(dz) < c.hz + 0.6) {
        if (Math.abs(dx) / (c.hx + 0.6) > Math.abs(dz) / (c.hz + 0.6)) nx = c.x + Math.sign(dx) * (c.hx + 0.6);
        else nz = c.z + Math.sign(dz) * (c.hz + 0.6);
      }
    }
    if (!(lakeSDF(nx, nz) < 0.98 && heightAt(nx, nz) < WATER_Y)) { player.x = nx; player.z = nz; }
    player.heading = ang;
    const t = now / 90;
    playerMesh.userData.limbs.armL.rotation.x = Math.sin(t) * 0.8;
    playerMesh.userData.limbs.armR.rotation.x = -Math.sin(t) * 0.8;
  } else {
    playerMesh.userData.limbs.armL.rotation.x *= 0.8;
    playerMesh.userData.limbs.armR.rotation.x *= 0.8;
  }
  playerMesh.position.set(player.x, heightAt(player.x, player.z), player.z);
  playerMesh.rotation.y = player.heading + Math.PI;
}
