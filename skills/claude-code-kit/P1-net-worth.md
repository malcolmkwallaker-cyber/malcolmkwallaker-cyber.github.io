# P1: Net Worth Command Center, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder.

---

BUILD PROMPT:

Build a local net worth tracking web app. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla HTML/CSS/JS. No TypeScript, no React, no build step.

FILE TREE (create exactly this):
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

DATABASE (db.js, SQLite file networth.db):
- table snapshots: id, date TEXT, cash REAL, brokerage REAL, retirement REAL, re_equity REAL, business REAL, other REAL, liabilities REAL, net_worth REAL, notes TEXT
- table settings: key TEXT PRIMARY KEY, value TEXT (stores monthly_expenses, target=10000000, target_age, current_age=30)

SERVER (server.js, port 3001):
- GET / serves public
- GET /api/snapshots returns all ordered by date
- POST /api/snapshots: accepts the seven category numbers plus notes, computes net_worth = sum of assets minus liabilities, inserts, then calls analyze() from ai.js and returns both the snapshot and the analysis
- GET /api/settings and POST /api/settings

AI (ai.js): one function analyze(current, previous, allSnapshots, settings). POST to https://api.anthropic.com/v1/messages with model claude-sonnet-4-6, max_tokens 1000, header x-api-key from env, anthropic-version 2023-06-01. System prompt, use verbatim:

"You are Malcolm Wallaker's net worth analyst. Target: $10,000,000. No em dashes or en dashes, no emojis, direct and honest, never cheerlead. Given the current snapshot, prior snapshot, full history, and settings, output: 1) headline net worth and dollar/percent change vs prior month, 2) pace analysis: at the trailing average monthly growth, years until $10M, and the required monthly growth rate to hit $10M by age 45, 3) concentration flag if any single category exceeds 60 percent of assets, 4) liquidity flag if cash is under 3x monthly_expenses, 5) one short paragraph on what drove the change. Plain text, no markdown headers."

FRONTEND (single page):
- Form with the 7 category inputs, notes, submit
- Line chart of net worth over time drawn on a canvas element with plain JS (no chart libraries)
- Big headline number, latest analysis text below the chart
- Table of all snapshots, newest first
- Settings section for monthly expenses and target age

ACCEPTANCE CRITERIA (verify each, fix failures):
1. npm install && npm start runs clean, app loads at localhost:3001
2. Submitting a snapshot stores it, net_worth math is correct, analysis text appears
3. Second snapshot produces change-vs-prior and pace numbers in the analysis
4. Chart renders with 2+ points, table sorts newest first
5. Missing ANTHROPIC_API_KEY returns the snapshot with analysis "AI unavailable, set API key" instead of crashing
6. All numbers display with thousands separators and dollar signs
