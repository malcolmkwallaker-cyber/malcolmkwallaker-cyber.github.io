# Realtor Rivals: Lake Country

A GTA5-style open-world 3D reimagining of *Bridger vs. Malcolm: Realtor Rivals*,
built to run 100% in the browser and host on GitHub Pages.

**Play it:**
https://malcolmkwallaker-cyber.github.io/realtorrivals3d/

Drive Northern Minnesota (Bemidji → Walker → Nisswa → Brainerd → Grand Rapids →
Park Rapids, four lakes, pine forest, Paul Bunyan & Babe), hop out of the car,
find glowing lead beacons at houses across the map, warm them up, set the
appointment, and close before a rival agent snipes the deal with full-size
caramel rolls. Pick a difficulty (CASUAL/STANDARD/HARD) — it drives real warmth
decay, ghosting, and appointment-steal odds straight from the 2D game's balance
table. Open the phone (P) to see your live pipeline and end the day on your terms.
Drive up to THE OFFICE to CALL or TEXT several leads at once, or to MUGS & PLUGS
CAFE to FOLLOW UP on the ones about to ghost you — same dialogue as the 2D game.
Sellers need more than warmth: pitch them at the SELLER CABIN to actually take the
LISTING, then walk up to your new "FOR SALE" sign to host an OPEN HOUSE and capture
fresh buyer leads on the spot. Warm buyers to an appointment and take them on a
SHOW HOMES tour at the LAKE HOME to close.

**Controls:** WASD drive/walk · E action (pitch / close / office / follow up /
listing appt / open house / show homes / enter / exit car) · P phone/CRM ·
SPACE brake · M mute. On phones: left virtual stick + ACTION button.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | Entry point — import map, canvas, all DOM UI markup, boots `src/main.js` |
| `src/core/` | RNG, event bus, save/load, input, audio |
| `src/world/` | Map layout, heightfield, terrain/water/road meshes, towns/buildings, forest |
| `src/actors/` | Character (on-foot) and vehicle (arcade car) meshes + controllers |
| `src/sim/` | `calendar.js` (day/night/season) and `pipeline.js` (the ported 2D "brain": leads, warmth, stages, ghosting, listings, commission) |
| `src/ui/` | HUD, minimap, phone/CRM, compass, toasts, title/difficulty select, timing-bar minigame queue (with a generic non-lead mode for OPEN HOUSE), shared multi-round dialogue queue, office menu |
| `lib/three.module.min.js` | Vendored Three.js r160 (no CDN, no build step) |
| `data/game-data.js` | The 2D game's entire data set, ported verbatim — characters, balance tables, 48 lead types, 25 upgrades, 8 bosses, weather, events, achievements. Single source of truth for the 3D build. |
| `docs/GAME_DESIGN.md` | Full open-world game design document |
| `docs/TECH_ARCHITECTURE.md` | Engine/stack decisions, world-gen math, performance budgets |
| `docs/BUILD_PLAN.md` | Phases 2–12 with acceptance criteria and paste-ready prompts for a builder model |

## Build status

| Phase | Status |
|---|---|
| 0–1: docs, data port, world, driving, on-foot, deal loop, day/night, minimap, touch | ✅ done |
| 2: modules (`src/` split), building colliders | ✅ done |
| 3: phone/CRM, energy pips, compass+minimap objective targeting | ✅ done (GPS road-routing deferred) |
| 4: difficulty select, balance-driven decay/ghosting/stage progression, commission, save/resume | ✅ done (simplified 4-stage pipeline; full 8-stage awaits Phase 5–7 activities) |
| 5: CALL/TEXT (office menu) + FOLLOW UP (dialogue, real 2D script) | ✅ done (WRITE OFFERS/CLOSE SALES await the offer/pending stages) |
| 6: LISTING APPT (seller cabin) + OPEN HOUSE (won listings capture buyers) + SHOW HOMES (lake home) | ✅ done (no attendee-deadline stage or 3-stop driving tour yet — see BUILD_PLAN) |
| 7–12: video/negotiate/inspect/close, rival AI/battles, economy/toys, weather/events, bosses, achievements, polish | 📋 planned — see `docs/BUILD_PLAN.md` |

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
