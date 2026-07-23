# REALTOR RIVALS: LAKE COUNTRY
## Open-World 3D Game Design Document

**Version 1.0 — designed with Fable 5, written to be built incrementally by any capable coding model.**

This document reimagines *Bridger vs. Malcolm: Realtor Rivals* (the 2D pixel game) as a
GTA5-style open-world 3D game that runs entirely in the browser and hosts on GitHub Pages.
Every number, character, lead type, event, and joke from the 2D game is preserved — the data
file is ported verbatim in `data/game-data.js`. What changes is the *presentation*: instead of
picking actions from a menu, you physically drive across Northern Minnesota and do them.

**The one-sentence pitch:** GTA5 where instead of stealing cars you sell lake homes, the
"wanted level" is your rival closing in on your leads, and the map is Bemidji-to-Brainerd
lake country.

---

## 1. Design Pillars

1. **The map is the menu.** Every action in the 2D game (call leads, open house, showings,
   negotiate, close) becomes a physical place you drive to and a thing you do there. No
   abstract action list — if you want to make a video, you drive to the studio.
2. **Same brain, new body.** The lead pipeline, warmth/decay math, balance tables, upgrades,
   weather, events, and bosses come from `game-data.js` untouched. A player of the 2D game
   should recognize every system.
3. **Driving is the connective tissue and it must feel great.** Arcade handling, drift-y
   gravel roads, satisfying speed. You spend 40% of playtime driving; it is the "fun default."
4. **Minnesota is a character.** Lakes, pines, blizzards, aurora, Paul Bunyan, hotdish,
   walleye, "oh you betcha." The world should be dense with the flavor text made spatial.
5. **Runs everywhere, hosted anywhere.** No build step, no server, no accounts required.
   One folder of static files on GitHub Pages. 60fps on a mid laptop, 30fps on a phone.

---

## 2. World

### 2.1 Geography
A stylized, compressed Northern Minnesota, roughly **3.8 km × 2.5 km** of drivable world
(about 2 minutes corner-to-corner at highway speed — GTA-feel without GTA-scale asset cost).
The layout is a direct scale-up of the 2D map coordinates in `Data.MAP` (480×270 space →
world meters, factor ~12), so relative positions match the original game.

**Lakes (from `Data.MAP.lakes`):** Lake Bemidji, Leech Lake, Gull Lake, Mille Lacs.
Water is drivable by boat/pontoon (Phase 9), deadly-ish to cars (engine stall + tow-truck
respawn + $150 "ope" fee).

**Towns (from `Data.MAP.towns`):** Bemidji, Walker, Nisswa, Brainerd, Grand Rapids,
Park Rapids. Each town: main street, 8–20 procedural buildings, water tower with town name,
distinct color accent. Brainerd is the "downtown" (your office); Bemidji has the Paul Bunyan
& Babe statues (climbable — achievement).

**Roads:** Two-lane highways connect all towns (loop + spurs, following the 2D map's
implied drive routes). Gravel side roads lead to listings, cabins, and lake lots. Gravel
has lower grip (drifting!) per the "county road detour" event flavor.

**Key locations (from `Data.MAP.locations`):** THE OFFICE (Brainerd), MUGS & PLUGS CAFE
(Nisswa), VIDEO STUDIO (Bemidji), SELLER CABIN, LAKE HOME, INSPECTION HOUSE, TITLE CO.,
FIRST NORTHERN BANK, NOBLEZA COMMERCIAL PLAZA, SUDDATH GROWTH LAB, LEWIS SYSTEMS LAB.
Each is a distinct landmark building with a parking lot and a glowing entrance marker.

**Wilderness:** Instanced pine forest (~20k trees), bogs, deer/moose/bear ambient spawns
(they are event actors too — see §7). Bigfoot spawns in one deep-woods cell at night with
0.5% chance per night (SQUATCH SPOTTER achievement, exactly as in the 2D game).

### 2.2 Living world
- **Ambient traffic:** 10–20 simple AI cars on highway splines; pull over when you honk
  (you're a realtor, not a criminal — no carjacking; this game's "crime" is poaching leads).
- **Pedestrians:** simple villagers in towns; some are *walk-up leads* (see §5.2).
- **Rival presence:** your rival's branded car (Bridger's navy sedan / Malcolm's green wagon)
  visibly drives the map to *its* appointments. Seeing it parked outside a lead's house means
  you're about to lose that lead. This is the open-world translation of the rival system.
- **Day/night cycle:** one full game day = 12 real minutes (configurable). Days advance the
  season calendar: 3 months (APRIL, MAY, JUNE) × 8 working days, boss on month-end — same
  as `Data.SEASON`.

---

## 3. Characters & Progression

Playable: **MALCOLM** (Lake Life Hype Man) and **BRIDGER** (The Closer), with all stat
modifiers from `Data.CHARACTERS` (videoBonus, negotiateBonus, lakeLeadWeight, etc.).
Whoever you don't pick becomes the rival AI. Secret characters (`Data.SECRET_CHARACTERS`:
Grandpa Realtor, The Influencer, The Veteran, The Rookie, Blake Suddath, Tyler Lewis)
unlock exactly as before and are selectable on later playthroughs.

**Daily ability** (once per day, from character data): triggered from the phone.
E.g. Malcolm's VIRAL VIDEO plays a 3-second selfie-cam vignette and spawns lead markers;
Bridger's POWER CLOSE teleport-marks your best lead with an instant-win appointment.

**Legendary NPC power-ups** (`Data.BRAD/JEFF/BLAKE/TYLER`): Brad Nolan the Mortgage Wizard
appears at First Northern Bank, Jeff Nobleza at the Commercial Plaza (his 2-energy
commercial deal = a special negotiation mission), Blake at the Growth Lab, Tyler at the
Systems Lab. Physical visits replace menu visits.

**Stats:** Cash, Commission volume, Followers, Happiness, Reputation, Energy — all as in 2D.

---

## 4. Core Loop (a day in the life)

```
MORNING (day starts at office or home)
 │  Phone shows: pipeline CRM, weather report (Data.WEATHER roll), rival taunt
 ▼
CHOOSE & DRIVE — energy budget (3 base, upgrades add more) limits "big actions"/day
 │  • Drive to a lead's house → FOLLOW UP (doorstep dialogue minigame)
 │  • Drive to office → CALL/TEXT sessions (phone minigames)
 │  • Host OPEN HOUSE at a listing (2 energy — real-time event, greet arrivals)
 │  • SHOW HOMES: pick up buyer, drive them to 3 properties, walkthrough choices
 │  • LISTING APPT at seller cabin (pitch minigame), VIDEO at studio (drone minigame),
 │    NEGOTIATE/WRITE OFFERS at office, INSPECTION walkthrough, CLOSE at Title Co.
 ▼
DUSK — day-end sequence while driving home (radio recaps the day)
 │  • Warmth decay/ghosting applied per Data.BALANCE (difficulty chosen at start)
 │  • Event roll (Data.OBSTACLES / FUNNY_EVENTS) — staged in-world when possible (§7)
 │  • Rival closes deals per rivalCloseChances; trash talk tier updates
 ▼
NIGHT — optional free-roam (find Bigfoot, aurora video bonus), then sleep to advance
```

Energy is the *pacing* resource exactly as in 2D: driving and free-roam are free; the 11
`Data.ACTIONS` cost their listed energy. The BETTER VEHICLE upgrade making open houses
cost 1 energy is now diegetic — a faster car literally gets you there with time to spare.

---

## 5. The Pipeline, Spatially

### 5.1 Leads live on the map
Every lead in the pipeline is a *household at an address* — a procedurally placed house
(lake homes on shorelines, cabins in woods, starters in towns) with a colored beacon
matching `Data.STAGE_COLORS` (gray NEW → orange WARM → yellow APPT → sky CLIENT → cyan
OFFER → lime PENDING → green SOLD sign in the yard). Your CRM phone app is the pipeline
list; the minimap shows stage-colored pins. Warmth is shown as the beacon's flicker rate —
a dying beacon is a lead about to ghost. All thresholds/decay/ghost math from
`Data.BALANCE` unchanged.

### 5.2 Lead generation
- **Passive spawns** per balance table (maxPassiveLeadsPerDay), announced by phone ring.
- **Walk-up leads:** at open houses, on main streets ("I saw your video and HAD to call!").
- **Sign calls:** your SOLD/FOR SALE yard signs occasionally trigger calls while driving.
- **Lake leads spawn on shorelines** — Malcolm's 2× lakeLeadWeight means his map fills
  with shoreline beacons; character choice visibly changes world density.

### 5.3 The rival race
On STANDARD+, ignored APPT leads can be *stolen* (apptStealChance): you get a phone warning
("Bridger's car was seen on Gull Lake Road…"), and if you don't get there in time, you
arrive to find the rival's sign in the yard. If you DO arrive while the rival is there →
**HEAD-TO-HEAD LISTING BATTLE** (§6.9) on the seller's porch. This converts the 2D battle
scene into an open-world showdown you can trigger or avoid by driving.

---

## 6. Activities (the 8 minigames, now in 3D)

Each activity keeps its 2D scoring hooks (score 0–1 → warmth gains, stage advances,
character bonuses apply). Designs are deliberately buildable: DOM/2D-canvas overlay UIs
on top of the 3D scene, not full 3D interactions, except where noted.

1. **CALL LEADS (office):** GTA-phone dialer. Leads answer with mood bubbles; rotary
   timing bar per call — stop in the green (zone size = lead warmth). Perfect = "COLD
   CALLER" progress.
2. **TEXT LEADS (office/anywhere with CRM upgrade):** rapid-fire choose-the-right-reply
   under a timer, using `Data.FOLLOWUP_ROUNDS`-style prompts.
3. **FOLLOW UP (doorstep):** walk to the door, ring bell; 3-choice dialogue from
   `Data.FOLLOWUP_ROUNDS` (good/bad answers verbatim). Pumpkin bars item (bought at cafe)
   = +1 free success, per flavor text.
4. **OPEN HOUSE (at listing, 2 energy):** real-time 90-second event. Cars pull up; greet
   attendees (walk to them, one-button charm with timing), keep the cookie tray stocked,
   catch the sign-in sheet blowing away in wind weather. Attendees become `attendee`-stage
   leads with the followup deadline from balance data.
5. **MAKE VIDEO (studio or on-location):** fly the drone (simple 3-axis flight) through
   3–5 shot rings over a lake home within time; smoothness = score → followers. Aurora
   weather = +15% per weather mods. Falling in the lake = viral for the wrong reason
   (huge followers, small shame — as per the event).
6. **LISTING APPT (seller cabin):** pitch = 3-round card pick (comps / marketing / price)
   vs. seller personality; drone upgrade adds a bonus round. Win → house gets your sign,
   becomes an open-house venue.
7. **SHOW HOMES (pick up buyer):** drive buyer to 3 candidate homes (route on GPS);
   at each: 60-second walkthrough, point out 2 features they care about (their wishlist
   is in the CRM), avoid the "flaws" (banging furnace). Match ≥ threshold → "the one."
   Careful driving matters: hit a curb hard and buyer mood drops ("smooth ride" bonus).
8. **NEGOTIATE (office/title):** tug-of-war meter vs. other agent; play cards (escalation
   clause, inspection waiver, fish house included — from flavor) with bluff timing.
9. **INSPECTION (at pending house):** first-person-ish walkthrough; find and tag the 4
   issues (moisture, raccoons, well, septic — from obstacle data) before the timer;
   each missed issue costs repair cash.
10. **WRITE OFFERS / CLOSE (instant actions):** short cinematic + flavor line from
    `Data.FLAVOR` (the backup pen legend, title-lady cookies), confetti, cash SFX.

**Head-to-head LISTING BATTLE (§5.3):** best-of rounds using `Data.BATTLE` dialogue and
market-check questions verbatim, staged as porch confrontation with both characters.

**Month-end BOSS SHOWDOWN:** the boss (drawn from `Data.BOSS_POOL`, final = MEGA TEAM)
challenges you to a multi-round gauntlet across the map — one round per boss skill
(PROSPECTING = door-knock race in town, SPEED = timed drive, MARKETING = drone shoot-off,
NEGOTIATION = tug-of-war, CLIENT SERVICE = follow-up quiz, STRATEGY = pick-the-comp).
Boss gimmicks (speed 1.35, zone 0.8, loseCash) map to round modifiers. Rewards verbatim.

---

## 7. Events & Weather, Staged in the World

Day-end events from `Data.OBSTACLES` / `Data.FUNNY_EVENTS` keep their exact text and
effects, but *when stageable, they happen in-world*:

- **Staged live:** deer walks through your showing (deer actor + camera moment +
  followers), moose blocks your driveway (physically blocks; honk negotiation), bear
  in the yard mid-showing (narrate = follower bonus), buyer proposes in the kitchen,
  northern lights driveway moment (aurora shader + everyone stands still), snowstorm
  (world turns white, handling worsens, snowmobile toy negates — per its description),
  lockbox frozen shut (mash-button minigame at the door), county road detour (road
  closure barriers reroute your GPS through gravel).
- **Phone/radio events:** rate jumps, appraisals, bad reviews, reply-all disaster —
  delivered as phone notifications and radio DJ chatter ("KWLY 101.5 LOON COUNTRY").

**Weather** (`Data.WEATHER`, rolled daily with per-month weights): clear, perfect lake day,
blizzard, ice storm (ice physics on roads!), thunderstorm, rain, heat shimmer, dense fog
(fog distance crushed), wind (drone unusable unless…), northern lights. All gameplay mods
apply verbatim; the visual layer is fog/particles/sky tint.

**Radio:** 2–3 procedural chiptune stations (ported WebAudio synth from the 2D game's
audio.js melodies) + the DJ who reads events, weather, and rival trash talk
(`Data.TRASH_TALK`, tier chosen by score gap). Radio is the event delivery system while
driving — the GTA trick, reused.

---

## 8. Economy: Shop → Real Estate

All 25 `Data.UPGRADES` keep their effects, but purchasing is spatial:
- **GEAR** (camera, drone, CRM, Matterport, brochures, ads…): bought at the office laptop.
- **OFFICES** (`Data.OFFICES` ladder): actual buildings on the map you buy and walk into;
  your HQ moves. Waterfront office has a dock (clients arrive by boat — visibly!).
- **TOYS** (`Data.TOYS`): *drivable/usable vehicles* — this is the crown jewel of the 3D
  adaptation: Luxury SUV, Fishing Boat, Pontoon (lake showings +8% — hold showings ON the
  pontoon), Snowmobile (blizzard immunity — and it's just fun), ATV (back-40 trails),
  Helicopter (fast travel + open-house entrance), Private Jet (airport cutscene → relocations
  ×2), Lake Cabin Retreat (a place; hosting = daily happiness).

Money in = commissions (same % and value math). Money out = shop + event costs + tow fees.

---

## 9. Meta

- **Difficulty:** CASUAL / STANDARD / HARD at new game — `Data.BALANCE` verbatim.
- **Season end (24 days):** results, volume leaderboard (localStorage; Supabase later),
  achievements (`Data.ACHIEVEMENTS` — all 19, including SQUATCH SPOTTER and the Blake/Tyler
  ultimates), secret character unlocks, New Game+ carries achievements.
- **Save:** autosave nightly to localStorage (same shape as 2D save where possible).
- **Controls:** WASD/mouse + gamepad + mobile (left stick, action button, camera drag).
  The 2D game was mobile-first; mobile stays a first-class citizen — quality settings
  auto-detect (§ TECH doc).

---

## 10. Tone & Art Direction

- **Look:** low-poly / flat-shaded "nice Synty" look. Vertex colors only, zero textures,
  zero downloaded assets — everything procedural (see TECH doc). Sweetie-16 palette from
  the 2D game seeds the world palette (ink night sky, sky/cyan water, lime/green pines in
  June, white blanket in April blizzards).
- **Writing:** every string that ships came from, or sounds like, the 2D game. Minnesota-
  nice, self-aware, never mean. "Ope", hotdish, and lutefisk are load-bearing.
- **Audio:** chiptune-meets-lofi WebAudio synth (port the audio.js patterns), pentatonic
  loon calls at dusk, V8 hum synthesized (no samples).

---

## 11. What ships when (summary — full plan in BUILD_PLAN.md)

| Phase | Deliverable |
|---|---|
| 0–1 | World + driving + on-foot (THE PROTOTYPE IN THIS FOLDER) |
| 2–3 | Interaction, phone/HUD, CRM, day loop |
| 4–7 | Pipeline sim + all activities |
| 8 | Rival AI + battles |
| 9 | Economy, offices, drivable toys |
| 10 | Weather, events, radio |
| 11 | Bosses, achievements, saves, secrets |
| 12 | Audio, mobile, polish, perf |

Every phase leaves the game playable and hostable. Ship early, ship often — it's a
GitHub Pages folder; pushing to `main` is deploying.
