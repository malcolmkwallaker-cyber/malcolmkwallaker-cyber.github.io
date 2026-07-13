# P3: Fitness Accountability, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder.

---

BUILD PROMPT:

Build a local weight and training tracker with weekly AI check-ins. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port 3003.

FILE TREE (exactly):
```
package.json
server.js
db.js
ai.js
.env.example        (ANTHROPIC_API_KEY=)
public/index.html
public/style.css
public/app.js
```

DATABASE:
- weights (id, date TEXT, weight REAL)
- checkins (id, week_start TEXT, workouts_done INTEGER, workouts_planned INTEGER, nutrition_days INTEGER, notes TEXT, report TEXT)
- settings (key, value): goal_weight, target_date, calorie_target, protein_target, split

SERVER:
- POST /api/weight (date, weight), GET /api/weights
- POST /api/checkin: body has adherence fields and notes. Server computes this week's and last week's average weight from the weights table, percent change, and weekly rate as percent of bodyweight, then calls ai.js with computed numbers, settings, and the last 8 checkin summaries. Store and return the report.
- GET/POST /api/settings

AI (ai.js): model claude-haiku-4-5-20251001, max_tokens 800. System prompt verbatim:

"You are Malcolm Wallaker's fitness accountability coach. He trains 6 to 8 AM on a Jeff Nippard program and tracks nutrition in MacroFactor. No em dashes or en dashes, no emojis, direct like a good training partner. You receive computed weekly averages, rate of change, adherence numbers, goals, and recent history. Rules: healthy cut pace is 0.5 to 1.0 percent of bodyweight weekly, flag faster as muscle loss risk, flag 2+ stalled weeks and recommend a specific moderate calorie adjustment with a note to verify against MacroFactor. Never suggest extreme deficits or anything compromising the 6 AM block or family life. Bad week gets one acknowledging sentence then the fix, no lecture. Output: STATUS line (on track / drifting / stalled), the numbers, projected date to goal at current rate, one specific adjustment or 'no changes, keep going.'"

FRONTEND: quick daily weight entry (date defaults today), canvas line chart of daily weights with a 7-day moving average line drawn in a second color (plain JS, no libraries), weekly check-in form, latest report card, settings panel.

ACCEPTANCE CRITERIA:
1. npm start clean at localhost:3003
2. Weight entries chart correctly, moving average visibly smooths the line
3. Check-in with 2+ weeks of data returns a report containing STATUS and a projected date
4. Server-side average math is correct (test with known values)
5. No API key: report says AI unavailable, data still saves
