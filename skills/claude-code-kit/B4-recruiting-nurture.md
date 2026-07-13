# B4: Recruiting Nurture Engine, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder.

---

BUILD PROMPT:

Build a recruiting pipeline manager with AI-drafted outreach for Malcolm Wallaker's agent recruiting at Pemberton Real Estate. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port 3013. Nothing sends automatically in this app: it manages the pipeline, computes who is due for a touch, and drafts the message. Malcolm copies, personalizes if needed, and sends. Optionally syncs stage tags to the recruiting FUB account.

FILE TREE (exactly):
```
package.json
server.js
db.js
ai.js
fub.js
.env.example    (ANTHROPIC_API_KEY=, FUB_RECRUITING_API_KEY=)
public/index.html
public/style.css
public/app.js
```

DATABASE:
- prospects (id, name, brokerage, phone, email, production_notes TEXT, research_notes TEXT, stage TEXT default 'Identified', last_touch TEXT, next_due TEXT, fub_id TEXT)
- touches (id, prospect_id, type TEXT, draft TEXT, sent INTEGER default 0, sent_date TEXT, created TEXT)

STAGES: Identified, First Touch Sent, Engaged, Conversation Had, Nurture Long, Committed, Not a Fit.

CADENCE LOGIC (pure JS in server.js):
- Identified: due immediately for a first touch email
- First Touch Sent: day 4 follow-up text, day 12 value touch, then auto-move to Nurture Long
- Nurture Long: due every 38 days, touch type rotates in this fixed order per prospect: market_win, pemberton_milestone, personal_congrats, event_invite, direct_checkin (never two pitch-type touches consecutively is guaranteed by the fixed rotation)
- Engaged and later stages: no automated dueness, Malcolm owns these personally
- Not a Fit: due every 365 days, direct_checkin only

DASHBOARD: "Due now" queue at top (prospect, stage, touch type, Draft button), full pipeline board as columns per stage with drag or dropdown to move stage, prospect detail view with notes and touch history. Marking a touch sent sets sent=1, last_touch, and computes next_due.

AI (ai.js): model claude-sonnet-4-6, max_tokens 600. Two prompt modes.

FIRST TOUCH system prompt verbatim:
"You draft recruiting outreach for Malcolm Wallaker, office growth leader at Pemberton Real Estate, an independent brokerage in Grand Rapids, Minnesota, recruiting productive Northern Minnesota agents. Explainer voice: plainspoken, generous, specific. No formal greetings or sign-offs, no em dashes or en dashes, no emojis, exclamation points sparingly, close with a variation of 'Let me know.' Email under 160 words in this order: 1) genuine specific admiration referencing something real from the research notes, and if the notes contain nothing specific output only NEED RESEARCH, 2) brief intro of the partnership opportunity: Pemberton is independent, agent-first, growing fast, 3) one concrete resource line choosing the one or two most relevant to this prospect from: Zillow, Homelight, Realtor.com, Follow Up Boss, Real Geeks, 4) two paths: joining the team, or for broker-owners, Parker acquiring the brokerage, 5) warm close plus openness to a referral partnership if timing is wrong. Never disparage their brokerage, never mention eXp Realty, never fabricate numbers: insert [MALCOLM: confirm number] where a claim needs data you were not given."

NURTURE system prompt verbatim:
"You draft a recruiting nurture touch for Malcolm Wallaker, Pemberton Real Estate. Input: prospect notes, touch type, and channel. Under 80 words. Zero pressure, never 'just checking in' or 'circling back.' Every touch delivers something real matching its type: market_win shares a specific stat or win, pemberton_milestone shares brokerage news, personal_congrats cites the specific thing from the notes (if notes lack one, output NEED RESEARCH), event_invite invites to the Become a Client Magnet training, direct_checkin asks one genuine question. Same voice rules: no em or en dashes, no emojis, close with a 'Let me know' variation, no fabricated numbers."

FUB SYNC (fub.js, optional, skips silently if key missing): on stage change, PUT the stage as a tag on the person in the recruiting FUB account; on new prospect, search FUB by email and store fub_id.

ACCEPTANCE CRITERIA:
1. npm start clean at localhost:3013
2. New prospect appears in Due now, first touch drafts correctly, empty research notes yields NEED RESEARCH
3. Marking sent computes correct next_due for each stage per the cadence spec
4. Nurture rotation order is fixed and verifiable across 5 consecutive draft calls
5. Engaged-stage prospects never appear in Due now
6. Pipeline counts per stage shown at top, drafts have a copy button
7. No FUB key: everything works locally without errors
