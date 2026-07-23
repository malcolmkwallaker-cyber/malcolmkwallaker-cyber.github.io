# Build Plan — Realtor Rivals: Lake Country

A phased plan written so a **cheaper/faster coding model can execute it one phase at a
time**. Each phase has: goal, tasks, acceptance criteria, and a **paste-ready prompt**.

Ground rules for the builder model (include in every session):

> You are building "Realtor Rivals: Lake Country" inside `realtorrivals3d/`.
> Read `docs/GAME_DESIGN.md` and `docs/TECH_ARCHITECTURE.md` first and follow them —
> they are decisions, not suggestions. Game numbers/text come ONLY from
> `data/game-data.js`; never invent or fork balance values. No build tools, no npm
> dependencies, no external assets or CDNs — plain ES modules + the vendored
> `lib/three.module.min.js`. Keep the game playable after every phase. Test by serving
> the folder (`python3 -m http.server`) and confirming zero console errors before
> finishing. Match the existing code style. The original 2D game logic (if provided)
> is the reference implementation for all simulation formulas.

**Phases 0–1 are already done** (this PR): docs, ported data, vendored Three.js, and a
playable single-file prototype (world, driving, on-foot, minimap, HUD, day/night, a
starter "capture leads" loop, touch controls).

---

## Phase 2 — Modularize + input/camera/interaction foundations
**Goal:** split `index.html` into `src/` per TECH doc §2 with zero behavior change,
then harden the foundations.
**Tasks:** extract modules (main, core/input, core/bus, world/*, actors/*, ui/*);
add gamepad support; camera orbit on foot; interaction system (`Interactable`
registry: enter radius → prompt → callback) replacing the prototype's ad-hoc checks;
building AABB colliders.
**Accept:** behavior identical to prototype; interactables highlight + prompt; car
can't drive through town buildings; gamepad drives.
**Prompt:** "Execute Phase 2 of docs/BUILD_PLAN.md. Split the prototype index.html
into the src/ layout from TECH_ARCHITECTURE.md §2 with no gameplay changes, then add
the Interactable registry, building colliders, and gamepad input as specified."

## Phase 3 — Phone, HUD v2, GPS routing
**Goal:** the phone is the hub; GPS routes on roads.
**Tasks:** slide-up phone UI (CRM list stub, settings, ability button stub); road
graph A* + purple route ribbon + minimap route; objective marker system (beacon
columns per STAGE_COLORS); toasts/notifications queue; energy pips.
**Accept:** select any map location on the phone → route draws; follow it to arrive;
notifications slide in; energy displays 3 pips.

## Phase 4 — Calendar + pipeline simulation (the brain)
**Goal:** port the 2D `state.js` rules to `sim/pipeline.js` + `sim/calendar.js`.
**Tasks:** difficulty select on new game; day/sleep cycle applying warmth decay,
ghosting, passive spawns, pendingDaysBeforeClose, appt drop/steal rolls per
`Data.BALANCE`; leads bound to generated addresses (seeded); CRM app shows real
pipeline with warmth bars; commission math on close; season calendar (3×8 days).
**Accept:** play 5 days doing nothing → leads decay/ghost per STANDARD numbers
(verify against the table); close a lead via debug command → cash increases by
correct commission; save/load round-trips (localStorage).

## Phase 5 — Activities I: CALL, TEXT, FOLLOW UP (+ shared minigame kit)
**Goal:** first three minigames + the shared overlay/timing/dialogue components.
**Tasks:** minigame framework (mount overlay, pause world input, resolve score 0–1,
apply sim effects with character/upgrade modifiers — mirror 2D `makeMinigame`
contract); CALL timing-wheel at office; TEXT rapid-reply; FOLLOW UP doorstep dialogue
using `Data.FOLLOWUP_ROUNDS` verbatim; energy spend + day flow.
**Accept:** a full day loop: drive to office → call (warmth up per score) → drive to
a lead's house → follow up → sleep → decay applies; scores affected by character
bonuses (verify Malcolm vs Bridger).

## Phase 6 — Activities II: OPEN HOUSE, SHOW HOMES, LISTING APPT
As GDD §6.4–6.7. Attendee leads with followup deadlines; buyer-in-car showing tour
with 3 stops and walkthrough choices; listing pitch cards; won listings get yard
signs and become open-house venues.
**Accept:** take a listing → host an open house there → capture attendees → follow
up next day converts per balance data.

## Phase 7 — Activities III: VIDEO/DRONE, NEGOTIATE, INSPECTION, OFFER/CLOSE
Drone flight rings; negotiation tug-of-war with cards; inspection walkthrough
tag-the-issues; instant OFFER/CLOSE with `Data.FLAVOR` lines + confetti at Title Co.
**Accept:** a lead can be driven end-to-end NEW → SOLD entirely in-world; all 11
`Data.ACTIONS` reachable; achievements counters tick (stats only).

## Phase 8 — Rival AI + head-to-head battles + trash talk
Rival car with daily schedule; steal warnings; porch LISTING BATTLE using
`Data.BATTLE` content; `Data.TRASH_TALK` tiers by score gap on radio/phone;
rival closes per `rivalCloseChances`; rivalry scoreboard in phone.
**Accept:** on STANDARD, ignore an APPT lead 2 days → warning fires → arriving in
time triggers battle; losing shows rival's sign in the yard.

## Phase 9 — Economy: shop, offices, toys (drivable!)
Office laptop shop (GEAR with all effects); OFFICES as purchasable map buildings
(HQ relocates); TOYS: Fishing Boat + Pontoon (water driving!), Snowmobile (blizzard
immunity + fun), ATV, Luxury SUV, Helicopter (fast travel), Retreat. Vehicle garage
+ switching. Every effect per `Data.UPGRADES/OFFICES/TOYS` descriptions.
**Accept:** buy pontoon → drive it on Gull Lake; buy CRM → decay visibly −40%;
buy Corporate HQ → +1 energy pip.

## Phase 10 — Weather, events, radio
Daily `Data.WEATHER` roll (monthly weights) with visuals (snow/rain particles, fog,
ice grip, aurora sky) + gameplay mods; day-end event engine porting all OBSTACLES/
FUNNY_EVENTS/EASTER_EGGS effects, staging the stageable ones in-world (deer, moose,
bear, proposal, lockbox, detour); radio DJ + 2 synth music stations delivering
events and trash talk.
**Accept:** blizzard day: white world, car slides, showings −15% unless snowmobile;
at least 6 events verifiably staged in-world; all event `fx` handlers implemented
(cross-check list against the 2D game).

## Phase 11 — Bosses, achievements, secrets, saves v2
Month-end boss gauntlets (per-skill rounds + gimmicks); all 19 `Data.ACHIEVEMENTS`
with unlock toasts; secret characters + legendary NPCs (Brad/Jeff/Blake/Tyler at
their map locations); Bigfoot night spawn; season results screen + local
leaderboard; New Game+.
**Accept:** beat month 1 boss → rewards granted verbatim; SQUATCH SPOTTER unlockable
(debug spawn); full season completable.

## Phase 12 — Polish: audio, mobile, performance, QA
Synth SFX/engine hum/loons; mobile control tuning + quality autodetect; perf pass
against TECH §7 budgets (report draw calls/fps before+after); options menu (audio,
quality, controls); service worker cache; QA sweep of the checklist below.

**Final QA checklist:** zero console errors; 60 s drive through all towns; full season
on STANDARD as each character; mobile Safari + Android Chrome plays; save survives
reload mid-day; all 11 actions, 8+ minigames, 6 bosses, 19 achievements reachable.

---

### Working agreement per phase
1. Read the docs + this phase. 2. Implement. 3. Serve + smoke test (zero console
errors) and run the Phase-4+ sim sanity checks. 4. Update `README.md` status table.
5. Commit with message `Phase N: <summary>`. One phase per PR.
