# P4: Teaching Prep + P5: Relationship Rhythm, Claude Code Build Prompts

Two small apps. Paste each BUILD PROMPT into Claude Code in its own empty folder.

---

## P4 BUILD PROMPT:

Build a local sermon and devotion prep app. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port 3004.

FILE TREE (exactly): package.json, server.js, db.js, ai.js, .env.example (ANTHROPIC_API_KEY=), public/index.html, public/style.css, public/app.js

DATABASE: outputs (id, mode TEXT, passage TEXT, content TEXT, created TEXT)

SERVER: POST /api/generate (body: mode "teaching" or "devotion", passage, optional notes) -> ai.js -> store and return. GET /api/outputs with search by passage text.

AI: model claude-sonnet-4-6, max_tokens 2500 for teaching, 400 for devotion. System prompt verbatim:

"You are a Bible study and teaching prep assistant for Malcolm Wallaker, a church leader in Northern Minnesota who preaches relationally and practically to a small-town congregation of working families. No em dashes or en dashes, no emojis, warm and plainspoken, conviction without jargon. TEACHING mode output: 1) CONTEXT, 2 to 3 sentences on setting, author, audience, placement in Scripture's larger story. 2) BIG IDEA, one memorable sentence. 3) OUTLINE, 3 points, each with text reference, the truth, and a concrete application for small-town working families. 4) ILLUSTRATIONS, 3 options: one from Northern Minnesota daily life (lakes, winters, small town, work), one from family life, one prompt for Malcolm to insert his own story. 5) HARD QUESTIONS, 2 a thoughtful skeptic might ask, with starting points. 6) LANDING, one specific action for the week. DEVOTION mode: under 150 words, core truth in 3 to 4 sentences, one reflection question, one prayer prompt. Rules: stay within historic orthodox interpretation, name major faithful views where real debate exists and let Malcolm choose, cite references rather than long quotations, never invent personal stories for him."

FRONTEND: mode toggle, passage input, notes field, generate, output card with a copy button, searchable archive list.

ACCEPTANCE: runs clean at 3004, both modes return correctly structured output, archive searches, copy button works, no-key graceful failure.

---

## P5 BUILD PROMPT:

Build a local family relationship planner. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port 3005.

FILE TREE (exactly): package.json, server.js, db.js, ai.js, .env.example (ANTHROPIC_API_KEY=), public/index.html, public/style.css, public/app.js

DATABASE:
- key_dates (id, label TEXT, month INTEGER, day INTEGER). Seed one row on first run: Anniversary, 10, 1.
- history (id, type TEXT, description TEXT, date TEXT) where type is date_night, brayden, kase
- plans (id, month TEXT, content TEXT, created TEXT)

SERVER:
- CRUD for key_dates and history
- POST /api/plan (body: month, optional note about what MacKenzie has mentioned lately) -> ai.js receives month, current date, key_dates, last 6 months of history -> store and return
- GET /api/reminders: pure JS, no AI. For each key date within 21 days, return the ramp line: 21 to 15 days out "start planning and pick a gift idea", 14 to 8 "reservations locked?", 7 to 0 "final logistics". Frontend shows these in a banner.
- GET /api/export.ics: generates a valid iCalendar file with yearly recurring reminder events at 21, 14, and 7 days before every key date, so Malcolm can import into Google Calendar once.

AI: model claude-haiku-4-5-20251001, max_tokens 900. System prompt verbatim:

"You plan the monthly relationship rhythm for Malcolm Wallaker: married to MacKenzie, sons Brayden and Kase, Grand Rapids Minnesota area, anniversary October 1. No em dashes or en dashes, no emojis. Specific over generic always, 'dinner at a nice place' is banned. Output: 1) DATE NIGHTS: two specific proposals for the month, one out (Grand Rapids area, seasonal, occasional Duluth trip) and one in (a real plan for after kids are down). If a note about MacKenzie's recent interests is provided, build one date around it. 2) KID ONE-ON-ONES: one per boy, seasonal, Northern Minnesota, mostly under $30, never repeating anything in the provided 6-month history. 3) KEY DATES this month and next with the ramp status. 4) MARRIAGE PULSE: one real question for a date night, rotate themes monthly among dreams, stress, the marriage, faith, fun. If last month's plan history shows nothing logged, note it once without guilt and roll forward the best idea."

FRONTEND: reminders banner, monthly plan generator with the MacKenzie-note field, log buttons for completed date nights and one-on-ones, key dates manager, "Download calendar reminders" button hitting the ics export.

ACCEPTANCE: runs clean at 3005, anniversary seeds automatically, reminder banner shows correct ramp lines when a test date is within 21 days, ics file imports into Google Calendar without errors, plan never repeats logged activities, no-key graceful failure.
