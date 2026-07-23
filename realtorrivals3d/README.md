# Realtor Rivals: Lake Country

A GTA5-style open-world 3D reimagining of *Bridger vs. Malcolm: Realtor Rivals*,
built to run 100% in the browser and host on GitHub Pages.

**Play the Phase-1 prototype:**
https://malcolmkwallaker-cyber.github.io/realtorrivals3d/

Drive Northern Minnesota (Bemidji → Walker → Nisswa → Brainerd → Grand Rapids →
Park Rapids, four lakes, pine forest, Paul Bunyan & Babe), hop out of the car,
find glowing lead beacons at houses across the map, and nail the pitch before a
rival agent snipes the deal with full-size caramel rolls.

**Controls:** WASD drive/walk · E action (pitch / enter / exit car) · SPACE brake ·
M mute. On phones: left virtual stick + ACTION button.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | The playable Phase-1 prototype (single file, like the original 2D game) |
| `lib/three.module.min.js` | Vendored Three.js r160 (no CDN, no build step) |
| `data/game-data.js` | The 2D game's entire data set, ported verbatim — characters, balance tables, 48 lead types, 25 upgrades, 8 bosses, weather, events, achievements. Single source of truth for the 3D build. |
| `docs/GAME_DESIGN.md` | Full open-world game design document |
| `docs/TECH_ARCHITECTURE.md` | Engine/stack decisions, world-gen math, performance budgets |
| `docs/BUILD_PLAN.md` | Phases 2–12 with acceptance criteria and paste-ready prompts for a builder model |

## Build status

| Phase | Status |
|---|---|
| 0–1: docs, data port, world, driving, on-foot, deal loop, day/night, minimap, touch | ✅ this PR |
| 2–12: modules, phone/CRM, full pipeline sim, 8+ activities, rival AI, economy/toys, weather/events, bosses | 📋 planned — see `docs/BUILD_PLAN.md` |

## Developing

No tooling needed:

```bash
cd realtorrivals3d
python3 -m http.server 8000
# open http://localhost:8000
```

Design was done with a frontier model (Fable 5); the build plan is written so any
capable coding model can execute the remaining phases one at a time. Start every
build session by reading the three docs in `docs/`.
