# B3: Review Harvester, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder. Build this one FIRST.

---

BUILD PROMPT:

Build a worker service that watches Follow Up Boss for closed deals and runs a 3-touch review request sequence via OpenPhone SMS and email drafts. Node.js 20, plain JavaScript, Express (small admin UI), better-sqlite3, node-cron. Port 3012.

FILE TREE (exactly):
```
package.json
server.js        (admin UI + starts the cron)
worker.js        (the polling and sending logic)
fub.js
openphone.js
ai.js
templates.js
.env.example     (FUB_API_KEY=, OPENPHONE_API_KEY=, OPENPHONE_FROM=, ANTHROPIC_API_KEY=, GOOGLE_REVIEW_LINK=, ZILLOW_REVIEW_LINK=, DRY_RUN=true)
public/index.html
public/app.js
public/style.css
```

DATABASE: sequences (id, fub_person_id, name, phone, email, deal_note TEXT, closed_date TEXT, review_link_used TEXT, touch1_sent TEXT, touch2_sent TEXT, touch3_sent TEXT, status TEXT default 'active', reviewed INTEGER default 0)

WORKER LOGIC (cron every 2 hours):
1. Poll FUB GET /v1/deals?status=Closed (Basic auth, key as username, blank password), also GET /v1/people for contact details. For any closed deal not already in sequences, insert a row. Alternate review_link_used between GOOGLE_REVIEW_LINK and ZILLOW_REVIEW_LINK per insert to build both profiles.
2. For each active sequence, check timing against closed_date: touch 1 at day 0 (after 4 PM local), touch 2 at day 3, touch 3 at day 10, then set status 'complete'.
3. Touch 1 and 3 are SMS via openphone.js (POST https://api.openphone.com/v1/messages, header Authorization with the key, body: from OPENPHONE_FROM, to, content). Touch 2 is an email: since email sending is not wired, write it to an outbox table (id, to_email, subject, body, created) and show it in the admin UI with a copy button for Dan to send from Gmail. Mark touch timestamps after sending.
4. If DRY_RUN=true, log every message to the console and the UI instead of sending. Ship with DRY_RUN=true.
5. Skip and mark status 'skipped-no-phone' when phone is missing.
6. In FUB, add tag "ReviewSequence" to the person via PUT when a sequence starts, and never start a second sequence for a person who already has any sequences row (reviewed clients get referral asks later, not more review asks).

TEMPLATES (templates.js, exact strings, {name} and {link} placeholders):
T1: "Congrats again on closing today, {name}! It was a blast working with you. If you have two minutes, a quick review would mean a lot to me and helps other families around here find someone they can trust: {link} Let me know if you ever need anything!"
T2 subject: "Quick favor" body: "{name}, hope the move is going smoothly! One small favor. Reviews are how most of my business finds me, and a couple sentences about your experience would go a long way: {link}\n\nTakes about two minutes. And seriously, if anything comes up with the house or you just have a question, I'm always here. Let me know."
T3: "{name}, last time I'll bug you about this, promise! If you get a chance to leave a quick review it would make my week: {link} Either way, congrats again and enjoy the new place!"

AI PERSONALIZATION (ai.js, optional per touch 1): if deal_note is non-empty, call model claude-haiku-4-5-20251001, max_tokens 200, system prompt verbatim: "Rewrite this text message keeping the same structure, link placement, and length, but weave in this specific transaction detail naturally: [detail]. No em dashes or en dashes, no emojis, keep exactly one exclamation point of warmth, stay under 320 characters." On any AI failure fall back to the plain template. Never block sending on AI.

ADMIN UI: table of sequences with status and touch timestamps, outbox with copy buttons, a "mark reviewed" button per row (sets reviewed=1 and status complete, stopping remaining touches), DRY_RUN banner when active, and a manual "add sequence" form for backfilling recent closings.

ACCEPTANCE CRITERIA:
1. npm start clean at localhost:3012, cron registers
2. DRY_RUN mode logs correctly formatted T1/T2/T3 with name and link substituted, alternating links across inserts
3. Timing gates verified with a fake closed_date set 3 and 10 days back
4. Mark-reviewed stops future touches
5. Duplicate person never gets a second sequence
6. FUB or OpenPhone being unreachable logs the error and retries next cron run, never crashes
7. Three touches maximum is structurally impossible to exceed
