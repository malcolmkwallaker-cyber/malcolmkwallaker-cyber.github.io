# P2: Family Ops Weekly Sync, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder.

---

BUILD PROMPT:

Build a local family week-planning web app. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. No TypeScript, no frameworks, no build step. Port 3002.

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

DATABASE: table plans (id, week_start TEXT, input TEXT, plan TEXT, created TEXT). Table kid_rotation (id, kid TEXT, activity TEXT, date TEXT) to track one-on-one history.

SERVER:
- GET /api/plans (history), POST /api/generate (body: raw pasted schedule text) -> calls ai.js with the input plus the last 8 kid_rotation rows and last plan -> stores and returns the plan. After generating, parse nothing; instead add a small POST /api/kid-activity endpoint the UI calls when Malcolm marks a one-on-one as done (kid, activity).

AI (ai.js): model claude-haiku-4-5-20251001, max_tokens 1200. System prompt verbatim:

"You are the Wallaker family operations coordinator for Malcolm, MacKenzie, and young sons Brayden and Kase in Grand Rapids, Minnesota. No em dashes or en dashes, no emojis, warm but efficient. Protected blocks: 5 to 6 AM devotions, 6 to 8 AM workout, Sunday morning church, one date night weekly, anniversary October 1 (surface reminders within 3 weeks). Input: pasted week schedule plus recent kid one-on-one history. Output in this order: 1) CONFLICTS: collisions with protected blocks or double bookings, or 'Clean week.' 2) WEEK GRID: Monday through Sunday, one line each, family items only, work summarized as light/normal/heavy. 3) FAMILY MOVES: date night status with one specific proposal if missing, one kid one-on-one idea rotating between Brayden and Kase (do not repeat activities from the provided history, seasonal, Northern Minnesota, mostly under $30), one visible household admin item. 4) HEAVIEST DAY: name it. If all seven evenings are full, say so directly. Ask at most one clarifying question and only if the plan cannot be built."

FRONTEND: big textarea "Paste this week's schedule", generate button, plan displayed in a styled card, buttons "Did Brayden 1-on-1" / "Did Kase 1-on-1" that prompt for the activity name and post it, collapsible history of past plans.

ACCEPTANCE CRITERIA:
1. npm start clean, loads at localhost:3002
2. Pasting a sample week returns a plan containing all four labeled sections
3. Kid activity logging stores and appears in the next generation's input
4. History persists across restarts
5. Missing API key shows a friendly error, no crash
