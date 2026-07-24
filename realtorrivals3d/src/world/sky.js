// ============================================================
// world/sky.js — a vertex-colored gradient sky dome (reads far
// more natural than a flat background color) plus a procedural
// cube-camera environment map. The env map is fully generated
// in-engine (no HDRI download) and gives every PBR material in
// the scene believable ambient specular, and gives the water
// material an actual reflection instead of a flat blue disc.
// ============================================================
'use strict';

import * as THREE from 'three';

export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(1200, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  mesh.renderOrder = -10;
  // NOT matrixAutoUpdate:false here — the dome has to re-center on the
  // camera every frame (see follow()) since it's a fixed 1200-unit
  // radius but the world is ~4400x3000: parked at the origin, anything
  // more than (cameraFar - 1200) units from world center would poke the
  // far side of the dome past the camera's far plane and show as a
  // hole straight through to the WebGL clear color (black).
  scene.add(mesh);

  const zenith = new THREE.Color(), horizon = new THREE.Color(), out = new THREE.Color();
  function setColors(horizonColor, zenithColor) {
    zenith.copy(zenithColor); horizon.copy(horizonColor);
    const colorAttr = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1200; // -1..1
      const t = Math.pow(Math.max(0, y), 0.55);
      out.copy(horizon).lerp(zenith, t);
      colorAttr.setXYZ(i, out.r, out.g, out.b);
    }
    colorAttr.needsUpdate = true;
  }

  function follow(x, z) { mesh.position.set(x, 0, z); }

  return { mesh, setColors, follow };
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
