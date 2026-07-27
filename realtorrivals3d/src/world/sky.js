// ============================================================
// world/sky.js — two skies, swapped by time of day, plus a
// procedural cube-camera environment map:
//
//  1. A physically-based atmospheric-scattering sky (Preetham
//     model, vendored three/examples/jsm Sky.js) for day/dusk —
//     real Rayleigh/Mie scattering driven by the sun direction,
//     the same technique behind most "realistic" three.js scenes.
//     It has no concept of night (the model assumes a sun above
//     the horizon), so:
//  2. A vertex-colored gradient dome (the original implementation)
//     covers night, when the physical sky isn't visible anyway.
//
// The env probe is a cube camera pointed at whichever sky/world is
// currently showing — no HDRI download, no external assets.
// ============================================================
'use strict';

import * as THREE from 'three';
import { Sky } from '../../lib/three-addons/objects/Sky.js';

const DOME_RADIUS = 1150; // stay comfortably inside the camera's far plane (1400)

export function buildSky(scene) {
  // ---- night dome: vertex-colored gradient ----
  const geo = new THREE.SphereGeometry(DOME_RADIUS, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const nightMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  nightMesh.renderOrder = -10;
  // NOT matrixAutoUpdate:false — both domes re-center on the camera every
  // frame (see follow()): the world is ~4400x3000, far bigger than a dome
  // fixed at the origin could safely cover without poking past the far
  // clip plane on one side and showing a hole through to black.
  scene.add(nightMesh);

  const zenith = new THREE.Color(), horizon = new THREE.Color(), out = new THREE.Color();
  function setColors(horizonColor, zenithColor) {
    zenith.copy(zenithColor); horizon.copy(horizonColor);
    const colorAttr = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / DOME_RADIUS; // -1..1
      const t = Math.pow(Math.max(0, y), 0.55);
      out.copy(horizon).lerp(zenith, t);
      colorAttr.setXYZ(i, out.r, out.g, out.b);
    }
    colorAttr.needsUpdate = true;
  }

  // ---- day/dusk dome: real atmospheric scattering ----
  const daySky = new Sky();
  daySky.scale.setScalar(DOME_RADIUS);
  daySky.renderOrder = -10;
  scene.add(daySky);
  const su = daySky.material.uniforms;
  su['turbidity'].value = 3.2;     // haze — higher reads more like a humid lake-country sky
  su['rayleigh'].value = 1.4;      // blue-sky intensity
  su['mieCoefficient'].value = 0.006;
  su['mieDirectionalG'].value = 0.82; // sun-glow tightness

  // Night has no meaning in the Preetham model (built for a sun above the
  // horizon), so below a dayness threshold we show the hand-authored
  // gradient dome instead — the crossover happens near dusk when both are
  // already dark/warm-toned, so the hard swap doesn't read as a pop.
  function setSun(sunDir, dayness) {
    su['sunPosition'].value.copy(sunDir);
    const showDay = dayness > 0.1;
    daySky.visible = showDay;
    nightMesh.visible = !showDay;
  }

  function follow(x, z) {
    nightMesh.position.set(x, 0, z);
    daySky.position.set(x, 0, z);
  }

  return { mesh: nightMesh, setColors, setSun, follow };
}

export function buildEnvProbe(renderer, scene, size = 128) {
  const rt = new THREE.WebGLCubeRenderTarget(size, {
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(2, 1500, rt);
  scene.add(cubeCam);
  let frame = 0;
  return {
    texture: rt.texture,
    // throttled: the reflection only needs to be "roughly right,"
    // not per-frame accurate — this is the difference between a
    // flat water disc and one that shows the sky/shoreline. Parked
    // well above the focus point so the probe isn't shooting from
    // inside the player's own car/character mesh.
    tick(focusX, focusY, focusZ) {
      frame++;
      if (frame % 30 !== 1) return;
      cubeCam.position.set(focusX, focusY + 18, focusZ);
      cubeCam.update(renderer, scene);
    },
  };
}
