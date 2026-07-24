# Technical Architecture — Realtor Rivals: Lake Country

How to build a GTA-style open world that is 100% static files on GitHub Pages,
loads in under 3 seconds, and needs no build step. This document is the contract
the builder model follows; the GDD says *what*, this says *how*.

---

## 1. Stack decisions (already made — do not relitigate)

| Concern | Decision | Why |
|---|---|---|
| Engine | **Three.js r160**, vendored at `lib/three.module.min.js` | Battle-tested, tiny enough, no build step via ES modules + import map. Already committed. |
| Build tooling | **None.** Plain ES modules, `<script type="importmap">` | GitHub Pages serves static files; every push is a deploy. The 2D game shipped the same way. |
| Physics | **Hand-rolled arcade physics** (raycast-free heightfield sampling) | A physics engine (Rapier/Cannon) is overkill and heavy; cars sample terrain height at wheel points; characters use capsule-vs-heightfield. Deterministic and cheap. |
| Assets | **Zero external assets.** All geometry procedural (Box/Cylinder/Cone/Extrude + vertex colors), all audio WebAudio-synthesized | No load time, no CORS, no art pipeline, no licensing. Matches the 2D game's ethos (programmatic pixel art → programmatic low-poly). |
| UI | **HTML/CSS DOM overlay** for HUD, phone, menus, minigames; 2D `<canvas>` for minimap | DOM UI is 10× faster to build/iterate than in-scene UI and accessible on mobile. |
| State | Plain JS objects + a tiny event bus; **no framework** | The 2D game's `state.js` pattern worked; keep it. |
| Save | `localStorage` (key `rr3d_save_v1`), optional Supabase later (port `cloud.js`) | Same as 2D. |
| Data | `data/game-data.js` — verbatim port, already committed | Single source of truth; never fork the numbers. |

## 2. Repository layout

```
realtorrivals3d/
├── index.html            # entry — import map, canvas, DOM UI roots, boot
├── lib/three.module.min.js
├── data/game-data.js     # ported 2D data (DONE — do not edit numbers)
├── docs/                 # this documentation
└── src/                  # created as phases land (Phase 2+ splits index.html)
    ├── main.js           # boot, loop, scene graph root
    ├── core/             # bus.js, input.js, save.js, audio.js, math.js (seeded RNG)
    ├── world/            # terrain.js, water.js, roads.js, towns.js, forest.js,
    │                     # landmarks.js, sky.js, weather.js, traffic.js
    ├── actors/           # player.js, vehicle.js, rival.js, npc.js, wildlife.js
    ├── sim/              # pipeline.js (lead engine), calendar.js, economy.js,
    │                     # events.js, rivalai.js
    ├── activities/       # one file per minigame (call.js, openhouse.js, ...)
    └── ui/               # hud.js, phone.js, minimap.js, menus.js, dialogue.js
```

The Phase-1 prototype is intentionally a **single `index.html`** (like the 2D game's
single file). Phase 2's first task is extracting it into `src/` per the layout above.

## 3. World generation

- **Seeded RNG everywhere** (mulberry32; seed in save). The world must be identical
  across sessions — leads reference addresses.
- **Coordinate mapping:** 2D map space (480×270) → world meters:
  `X = (x - 310) * 12`, `Z = (y - 145) * 12`. All `Data.MAP` positions project through
  this one function (`mapToWorld`). Never hand-place anything that exists in Data.
- **Terrain:** single 256×256-vertex plane, 3840×2520 m. Height = 2-octave value noise
  (amp ≈ 6 m) − smooth lake bowls (ellipse SDF per `Data.MAP.lakes`, depth 4 m)
  − road flattening (within 9 m of a road polyline, lerp height toward road profile).
  Vertex-colored by height/slope (shore sand → grass → forest floor). One draw call.
- **`heightAt(x, z)`** — bilinear sample of the height grid; THE core API. Cars, feet,
  trees, buildings all sit on it. Keep it O(1).
- **Water:** one plane per lake at y = 0.3 with animated vertex ripple in shader-free
  fashion (per-frame vertex Y sin — cheap at lake vertex counts), plus `isWater(x,z)`.
- **Roads:** polyline network defined once (town graph + spurs to key locations);
  rendered as flat ribbon geometry draped on terrain (sample heightAt along centerline).
  Store the polylines — GPS routing (Phase 3) is A* over this graph; AI traffic and the
  rival drive it via arc-length parameterization.
- **Towns/buildings:** BufferGeometry-merged boxes+prisms per town (1 draw call per town).
  Interiors are NOT modeled — activities happen at doorways/porches or in DOM overlays.
- **Forest:** two `InstancedMesh` (trunk cylinder, canopy cone×2), ~20,000 instances,
  rejection-sampled away from roads/towns/water. Frustum culling on by default; add
  per-cell visibility if needed (§7).
- **Landmarks:** hand-built compound meshes (Paul Bunyan, Babe, water towers) in
  `landmarks.js`, positioned via mapToWorld.

## 4. Actors & physics

- **Vehicle (arcade):** state = pos, heading, speed. Integration:
  `speed += (throttle*accel − drag*speed − brake) * dt`;
  `heading += steer * steerRate * speedFactor(speed) * dt`;
  grip model: velocity lerps toward heading direction (lerp factor = grip; gravel/ice
  lower it → drift). Wheels sample `heightAt` at 4 corners → body pitch/roll + Y.
  Collisions: circle-vs-building-AABB pushback (buildings register colliders when built);
  trees: circle pushback, speed penalty. Water: stall + respawn flow.
- **Character controller:** capsule on heightfield, walk 4 m/s, jog 7 m/s. Simple
  procedural walk-cycle (limb rotation sin) — no skeletal animation, no rigs.
- **Camera:** third-person spring-arm (pos lerp ~8 Hz, lookAt lerp), pulls back with
  speed; drag-to-orbit on foot; auto-behind while driving.
- **AI traffic/rival:** follow road polylines at fixed speed + lane offset. The rival
  additionally has a daily schedule generated by `rivalai.js` (drives to N addresses;
  parking there triggers the steal-warning described in the GDD).

## 5. Simulation layer (the ported 2D brain)

`sim/pipeline.js` re-implements the 2D `state.js` rules against `game-data.js`:
lead spawn (weighted by type + character weights), warmth decay per balance table,
stage transitions (thresholds), ghosting rolls, appt steal rolls, pendingDaysBeforeClose,
commission on close. **Port the rules, not the rendering.** The sim ticks once per
game-day (at sleep), plus immediate deltas from activities. Activities report a single
`score ∈ [0,1]` + metadata; the sim applies character/upgrade/weather modifiers —
identical shape to the 2D `makeMinigame` contract, so the 2D source is the reference
implementation for every formula.

Event bus (`core/bus.js`): `bus.emit('lead:advanced', …)` etc. UI and world listen;
sim never touches DOM or Three objects.

## 6. UI system

- `ui/hud.js`: cash, date (APRIL · DAY 3), energy pips, objective line, toasts.
- `ui/phone.js`: slide-up phone (CRM pipeline list, map/GPS, ability button, shop,
  settings). The phone is the pause-adjacent hub — world keeps running (GTA style)
  except during minigame overlays.
- `ui/minimap.js`: 2D canvas, redrawn at 10 Hz — roads/lakes prerendered to an
  offscreen canvas once, pins + player arrow per frame.
- Minigames: each activity mounts a DOM overlay (`.overlay`), pauses player input,
  resolves with a score. Shared timing-bar / dialogue-choice components in
  `ui/dialogue.js`.
- All UI uses the Sweetie-16 CSS custom properties (already in prototype).

## 7. Performance budget (hold these lines)

| Metric | Budget |
|---|---|
| Draw calls | ≤ 300 (terrain 1, water 4, roads 1, towns ~6, forest 2, actors ~30) |
| Triangles | ≤ 500k desktop, ≤ 250k mobile (halve forest instances) |
| JS heap | ≤ 200 MB |
| Load (cold) | ≤ 3 s on 4G (three.min 655 KB + code; no other assets) |
| Frame | 60 fps desktop / 30 fps phone (auto quality: devicePixelRatio clamp 1.5, fog distance, instance count) |

Rules: no per-frame allocation in the loop (reuse Vector3s), no `new Material` at
runtime, merge static geometry, `matrixAutoUpdate = false` for static meshes,
fog + `far` plane at 900 m to cap overdraw.

## 8. Mobile & input

One input abstraction (`core/input.js`) → actions (`move`, `steer`, `throttle`,
`interact`, `camera`). Sources: WASD/mouse, gamepad (standard mapping), touch
(left virtual stick, right buttons: ACTION / brake / horn; camera drag). Detect
coarse pointer as in the 2D game. `touch-action: none`, safe-area insets — copy the
2D game's proven mobile CSS (already done in prototype).

## 9. Rendering upgrade (post Phase-6 graphics pass)

The Phase 1–6 prototype used flat `MeshLambertMaterial`, no shadows, and a solid-
color background. A dedicated graphics pass moved the whole scene to PBR + real-
time shadows + a procedural sky/reflection system, still with **zero external
assets** — every texture is drawn at runtime with the Canvas 2D API
(`world/textures.js`: ground, roof, siding, window, bark, asphalt) and every
"environment map" is a cube-camera render of our own hand-built sky dome and
world, not a downloaded HDRI. This is a large upgrade in visual fidelity for
effectively zero added load time (still one HTTP request for `three.module.min.js`
+ a handful of small vendored `three/examples/jsm` postprocessing files, ~112 KB).

**What changed:**
- **Materials:** every surface (terrain, roads, buildings, trees, car, character,
  water) moved from `MeshLambertMaterial`/`MeshBasicMaterial` to
  `MeshStandardMaterial` with tuned roughness/metalness per surface.
- **Shadows:** `renderer.shadowMap` enabled (`PCFSoftShadowMap`). The sun
  (`DirectionalLight`) casts a shadow whose camera frustum is fixed-size
  (150×150 m) but **repositioned every frame to follow the player**
  (`sun.position`/`sun.target` both offset from the current focus point along
  the calendar's `sunDir`) — the world (4400×3000 m) is far larger than any
  single shadow map could cover well, so the light follows instead of sitting
  at a fixed point. Buildings/trees/car/character cast+receive; terrain/roads/
  water receive only.
- **Tone mapping:** `THREE.ACESFilmicToneMapping`, exposure 1.05 — the filmic
  response is most of the difference between "3D demo" and "game" lighting.
- **Sky + environment (`world/sky.js`):** a large (1200 m radius) inverted
  sphere with a vertex-colored horizon→zenith gradient, driven by
  `sim/calendar.js`'s day/night colors, **repositioned to follow the camera
  every frame** (`sky.follow(x, z)`) — a lesson learned the hard way: a sky
  dome fixed at world origin will poke past the camera's far clip plane once
  the player is more than `far − radius` units from center, showing a hole of
  raw black clear-color. A throttled `CubeCamera` (`buildEnvProbe`, updates
  ~2×/sec) captures that sky + world into a small cubemap assigned to
  `scene.environment` (free image-based ambient specular for every PBR
  material) and to the water material's `envMap` (actual reflections instead
  of a flat blue disc).
- **Post-processing:** `EffectComposer` → `RenderPass` → `UnrealBloomPass` →
  `OutputPass`, vendored from `three/examples/jsm` into `lib/three-addons/`
  (same import-map trick as core three — they import bare `'three'`, which
  resolves the same way). Desktop-tier only.
- **SSAO was tried and deliberately left out.** It needs a WebGL2
  depth-texture render target; under a *software-rendered* WebGL context
  (SwiftShader) it triggered a hard GPU-process crash on scene start that
  wasn't catchable via try/catch. Bloom alone needs no depth texture and
  tested clean at every setting. Re-adding SSAO is reasonable future work
  *if* verified on real hardware first — don't re-enable it from a sandbox
  that only has software rendering available.
- **Quality tiers + software-renderer detection:** `isLowPower = isTouch ||
  isSoftwareRenderer(gl)`, checked once at boot in `main.js`. The renderer
  check matters beyond mobile: Chrome silently falls back to SwiftShader on
  real desktops when GPU drivers are blocklisted, and that's a genuine subset
  of real users, not just this sandbox — asking a software rasterizer to
  shadow-map 14k tree instances plus a 128 px cube probe is what actually
  crashed this build in testing (confirmed by reproducing the crash at full
  settings and clearing it purely by lowering tree count/shadow resolution/
  probe size, with no other code change). Low tier: 5,000 trees, 1024
  shadow map, 64 px env probe, no post-processing. High tier: 14,000 trees,
  2048 shadow map, 128 px env probe, bloom on.

**Updated performance budget** (supersedes the draw-call/triangle numbers in
§7, which predate shadows/PBR/postprocessing):

| Metric | Budget |
|---|---|
| Draw calls | ≤ 320 (unchanged shape; shadow pass adds a second pass over the same objects, not new draw calls) |
| Triangles | ≤ 600k desktop (14k trees + denser car/character), ≤ 300k low-tier |
| Shadow map | 2048² desktop / 1024² low-tier, single cascade following the player |
| Env probe | 128 px cube desktop / 64 px low-tier, refreshed every 30th frame |
| Load (cold) | ≤ 3.5 s on 4G (three.min ~655 KB + ~112 KB postprocessing addons + code; still zero downloaded textures/models) |

**Verification note:** all of the above was tested exclusively under headless
Chromium + SwiftShader (this sandbox has no GPU passthrough). That is
sufficient to prove correctness (shadows, reflections, materials, sky all
render exactly as designed) but *not* sufficient to prove desktop-tier
performance on real hardware — do a real-device pass before assuming the
14k-tree/2048-shadow/bloom combination holds 60 fps everywhere.

## 9. Hosting & deploys

GitHub Pages serves the repo root; the game lives at
`https://malcolmkwallaker-cyber.github.io/realtorrivals3d/`. All paths relative
(`./lib/…`, `./data/…`) — works locally via `python3 -m http.server` and on Pages
unchanged. No service worker until Phase 12 (then: cache-first for lib/data).

## 10. Testing contract (every phase)

- `node --input-type=module -e "import('./data/game-data.js')"` still passes.
- Serve locally + Playwright smoke test: page loads with **zero console errors**,
  canvas has nonzero drawn pixels, 5 s of simulated input doesn't throw.
- Manual: 60 s drive around all six towns without visual gaps or falls-through-world.
