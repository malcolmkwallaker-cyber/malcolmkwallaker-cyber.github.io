# B5: Open House Bot, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder. Deploys publicly (Railway/Render) like B1.

---

BUILD PROMPT:

Build an open house sign-in system: QR sign-in page, instant AI text within minutes, and follow-up sequences, wired to Follow Up Boss and OpenPhone. Node.js 20, plain JavaScript, Express, better-sqlite3, node-cron. Port from process.env.PORT default 3014.

FILE TREE (exactly):
```
package.json
server.js
worker.js       (sequence sender, cron every 30 min)
db.js
ai.js
fub.js
openphone.js
sequences.js    (template strings)
.env.example    (ANTHROPIC_API_KEY=, FUB_API_KEY=, OPENPHONE_API_KEY=, OPENPHONE_FROM=, ADMIN_SECRET=, DRY_RUN=true)
public/signin.html    (mobile-first, served at /s?p=PROPERTY_ID)
public/admin.html     (at /admin?key=ADMIN_SECRET)
public/style.css
public/signin.js
public/admin.js
```

DATABASE:
- properties (id, address TEXT, agent_name TEXT default 'Malcolm Wallaker', active INTEGER)
- visitors (id, property_id, name, phone, email, has_agent INTEGER, reason TEXT, created TEXT)
- queue (id, visitor_id, step TEXT, due TEXT, sent INTEGER, body TEXT)

SIGN-IN PAGE (/s?p=ID): big touch targets, property address shown at top. Fields: name, phone (required, 10-digit validated), email optional. Question 1: "Are you currently working with an agent?" yes/no. Question 2: "What brings you in today?" options: actively looking, just starting, neighbor, investor. Submit shows a thank-you screen and auto-resets to blank after 8 seconds for the next visitor.

ON SUBMIT (server):
1. Store visitor. Push to FUB (fub.js, events endpoint, Basic auth): source "Open House", tags ["OpenHouse", address], the reason and agent answer in the note. Fire and forget.
2. If has_agent is yes: queue one polite thank-you text for +3 minutes, no sequence, done.
3. Otherwise queue the instant AI text at +3 minutes and the matching sequence per reason (below).

INSTANT TEXT (ai.js): model claude-haiku-4-5-20251001, max_tokens 150, system prompt verbatim: "Write a text message from {agent_name} to {first_name}, who just signed in at the open house at {address}. Under 40 words. Thank them for coming, reference the property naturally, ask one light question based on their reason for visiting: {reason}. No em dashes or en dashes, no emojis, warm, one exclamation point maximum, do not sound automated." On AI failure fall back to: "Great meeting you at {address} today, {first_name}! Any questions about the home, just reply here. Let me know!"

SEQUENCES (sequences.js, queued relative to sign-in, sent by worker.js via OpenPhone; email steps go to an outbox table shown in admin with copy buttons, same pattern as B3):
BUYER (actively looking / just starting): day 1 email "Great meeting you at {address} yesterday! A few thoughts on it and two other homes nearby that might fit what you described: [AGENT: insert 2 properties]. Want me to set up a time to see any of them? Let me know." / day 3 text "Any lingering questions on {address}? Happy to dig up anything, taxes, utilities, lake info, whatever helps. Let me know!" / day 7 email "Whether it's this house or another one, the search goes a lot smoother with someone watching the market for you daily. No pressure at all, but if you want me to set up an automatic search matched to what you're looking for, it takes me five minutes. Let me know."
NEIGHBOR: day 2 email "Good to meet you at the open house! Since you're in the neighborhood, thought you'd want to know what homes around you have been doing. If you're ever curious what yours would bring in this market, I put together free value reports all the time, zero obligation: [LINK: home value widget]. Let me know." / day 30 text pointing to the home value link.
INVESTOR: day 2 text "You mentioned investing. I see the deals in Itasca County before most people do, including some that never hit the open market. Want me to flag anything that pencils? Tell me your criteria and I'll keep an eye out. Let me know."

ADMIN PAGE: create/toggle properties, per-property QR code (generate with the qrcode npm package) linking to /s?p=ID, printable full-page QR view, visitor list with reason breakdown, queue and outbox views, DRY_RUN banner.

WORKER: cron every 30 minutes sends due queue items via OpenPhone (or console when DRY_RUN=true), marks sent, never sends between 9 PM and 8 AM Central (shift to 8 AM), never exceeds the defined steps per visitor.

ACCEPTANCE CRITERIA:
1. npm start clean, sign-in flow completes on a phone-width viewport and auto-resets
2. has_agent=yes gets exactly one queued message
3. Each reason queues its correct sequence with correct due dates
4. Instant text uses AI when key present, fallback string when absent, both under 40 words
5. Quiet-hours logic verified with a fake 11 PM due time
6. QR generates and resolves to the right property
7. FUB down: visitor still saved, sequence still queues
8. DRY_RUN=true ships as default
