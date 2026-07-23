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

**Phases 0–1 are done**: docs, ported data, vendored Three.js, and a playable
single-file prototype (world, driving, on-foot, minimap, HUD, day/night, a starter
"capture leads" loop, touch controls).

**Phases 2–4 are done**: the prototype is split into `src/` modules per §2 below;
leads now run a real (simplified) pipeline — new → hot → appt → sold — driven by
`Data.BALANCE` thresholds/decay/ghosting for the chosen difficulty; a phone UI shows
the live CRM pipeline with warmth bars, tap-to-target GPS objective + compass, energy
pips, an END DAY button, and localStorage save/resume. See each module's header
comment for what it owns; `sim/pipeline.js` is the ported "brain."

---

## Phase 2 — Modularize + input/camera/interaction foundations ✅ DONE
**Delivered:** `index.html` split into `src/core|world|actors|sim|ui` per TECH doc §2
(19 modules) with behavior preserved and verified via headless smoke tests. Building
AABB colliders (`world/buildings.js`) block both car and on-foot movement. Vehicle
physics and on-foot control were extracted into `actors/vehicle.js` / `actors/character.js`
as pure-ish functions taking state + deps, matching the actors/ layout.
**Deferred to a later pass:** gamepad input (input.js has the seam — `fwdSteer()` —
but no gamepad polling yet); a formal `Interactable` registry class (proximity checks
are still done per-frame in `main.js`'s loop rather than a registered-object system —
fine at current object counts, worth revisiting once activities add many interactables).

## Phase 3 — Phone, HUD v2, GPS routing — PARTIAL ✅
**Delivered:** slide-up phone (`ui/phone.js`) with live CRM pipeline (stage badge,
warmth bar, value, sorted hottest-first), tap-to-target objective, energy pips,
cash/day header, ability name+desc display, END DAY button. Objective targeting via
`ui/compass.js` (rotating arrow + live distance) and a highlighted ring on the
minimap (`ui/minimap.js`) — this is the shipped alternative to full road-based routing.
**Deferred:** the A* road-graph route + purple route ribbon described in the original
plan. The compass points as the crow flies, not along roads. Worth adding once GPS
routing matters for a specific activity (e.g., SHOW HOMES chauffeuring a buyer).

## Phase 4 — Calendar + pipeline simulation (the brain) — PARTIAL ✅
**Delivered:** difficulty select (CASUAL/STANDARD/HARD) on the title screen; a real
day/night → season calendar (`sim/calendar.js`) emitting `day:changed` on rollover;
`sim/pipeline.js` runs `Data.BALANCE`-driven warmth decay (`decayNew`/`decayWarm`),
ghosting (`ghostNew3/4`, `ghostWarm3`), appointment drop/steal rolls
(`apptDropChance`/`apptStealChance`), passive daily spawns, and 2.7% commission on
close — all verified against the balance table in headless tests (energy spend,
day rollover, ghosting/decay math, save/resume all pass). Energy pips refill on
day change; `core/save.js` persists cash/day/difficulty/character and resumes on
reload with a "Welcome back" note.
**Simplified from the 2D game on purpose:** the pipeline here is 4 stages
(new → hot → appt → sold) instead of the full 8 (`attendee`/`active`/`offer`/`pending`
are folded away) because those extra stages only make sense once the matching
activities exist (Phase 5–7). `pendingDaysBeforeClose` and `clientNeglectDays` are
therefore not yet used — reintroduce them when `active`/`offer`/`pending` stages land.
`maxActivePipeline` is respected (spawn is capped); `attendeeDeadline` awaits the
OPEN HOUSE activity.

## Phase 5 — Activities I: CALL, TEXT, FOLLOW UP (+ shared minigame kit) ✅ DONE
**Delivered:** `ui/minigame.js`'s timing-bar overlay is now a QUEUE (`startSession`)
that can process one lead (the walk-up pitch/close, unchanged) or several in a row
for one energy spend — mirrors the 2D game's flat per-action energy cost. CALL LEADS
and TEXT LEADS live behind an office menu (`ui/activity.js`, drive/walk up to THE
OFFICE, press E): CALL targets up to 3 non-appt leads (warmest first) with the
standard timing bar; TEXT targets up to 4 with a faster needle + narrower zone
("thumbs of fury" — deliberately harder). FOLLOW UP lives at MUGS & PLUGS CAFE:
targets the `followupContacts` most at-risk leads (highest `daysIgnored` first) and
runs a new dialogue-queue overlay using `Data.FOLLOWUP_ROUNDS` verbatim (1 good + 2
bad responses, shuffled). All three route every result through the same
`pipeline.pitchLead()` used by the in-person pitch, so character/stage/warmth rules
are identical no matter which activity touched the lead.
**Accept (verified):** office menu opens without exiting the car and blocks driving
while up (fixed a same-frame double-fire where E both exited the car and opened the
menu); CANCEL closes it cleanly; CALL processes exactly the leads offered and spends
1 energy regardless of queue length; FOLLOW UP shows the real 2D dialogue text and
resolves good/bad choices through the pipeline; both office and coffee prompts only
appear within 22m and are location-gated (other locations still show the Phase 6+
placeholder).
**Deferred:** WRITE OFFERS/CLOSE SALES (`Data.ACTIONS` `offer`/`close`, both
`minigame: null` in the source) are intentionally not implemented yet — they only
make sense once the `active`/`offer`/`pending` pipeline stages exist (see Phase 4's
notes); closing currently happens via the existing in-person "CLOSE DEAL" pitch at
the `appt` stage.

## Phase 6 — Activities II: OPEN HOUSE, SHOW HOMES, LISTING APPT ✅ DONE
**Delivered:** `ui/dialogue.js` generalizes Phase 5's FOLLOW UP dialogue queue into a
shared runner that handles both shapes — one round per target (FOLLOW UP) and N
fixed rounds against one target (LISTING APPT/SHOW HOMES) — since
`Data.FOLLOWUP_ROUNDS` and `D.BATTLE.dialogue`/`D.BATTLE.market` all share the same
`{msg|prompt, good, bad[]}` shape in the source data.
- **LISTING APPT** (drive/walk to SELLER CABIN): pitches the warmest un-listed
  seller lead through `D.BATTLE.dialogue`'s 3 rounds verbatim. Winning (≥2/3 good
  picks) calls `pipeline.winSellerListing()` — sets `lead.isListing`, jumps it to
  `appt`, and swaps the beacon/label to a lime "FOR SALE" sign. Losing costs a small
  warmth penalty via `sellerPitchMiss()`. A surgical change to `pitchLead()` makes
  this matter: a seller lead crossing `apptThreshold` through ordinary warming
  (call/text/pitch/follow-up) no longer auto-advances to `appt` — it returns a new
  `readyForListing` result kind instead, so warmth alone can't skip the listing
  pitch. Buyers are unaffected.
- **OPEN HOUSE** (walk/drive up to a won listing's own house — not a separate map
  location): `ui/minigame.js`'s session queue gained a `customResolve`/`onFinish`
  hook so it can run rounds against synthetic, non-pipeline targets instead of real
  leads. 4 "greet the arrival" timing-bar rounds, 2 energy total; each hit calls
  `pipeline.spawnAttendeeNear()` to capture a fresh pre-qualified buyer lead right
  next to the listing (respecting `maxActivePipeline`); `lead.openHoused` prevents
  re-hosting the same listing.
- **SHOW HOMES** (drive/walk to LAKE HOME): pitches the warmest `appt`-stage buyer
  lead through `D.BATTLE.market`'s 3 rounds verbatim; the aggregate outcome routes
  through the existing `pitchLead()` sold/dropped logic, so a win pays commission
  and removes the lead exactly like the in-person "CLOSE DEAL" pitch does.
**Accept (verified):** LISTING APPT win sets `isListing`+`appt` with correct
dialogue content and toasts; the lose path applies a warmth penalty and leaves
`isListing` false; OPEN HOUSE spends exactly 2 energy, captures leads 1:1 with
hits, and blocks re-hosting; SHOW HOMES win pays the correct 2.7% commission and
removes the lead from the pipeline. All three location/lead prompts are correctly
gated (cabin/lakehome by 22m radius, open house by lead proximity + `isListing`)
and take priority over enter/exit-car on the same E press.
**Simplified from the GDD on purpose:** no `attendee`-stage leads or
`attendeeDeadline` follow-up window — open house captures land straight into the
pipeline as `new`-stage leads with elevated warmth, skipping the separate
"sign-in sheet, follow up within N days or lose them" beat described in the GDD.
No 3-stop driving tour for SHOW HOMES — it's a single dialogue pitch at one
location rather than physically chauffeuring the buyer to 3 candidate houses (that
needs GPS routing, which Phase 3 also deferred). Both are reasonable follow-ups
once road-routing lands.

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
