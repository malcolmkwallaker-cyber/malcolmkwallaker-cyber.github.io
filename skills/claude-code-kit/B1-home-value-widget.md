# B1: Home Value Widget, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder. This one deploys publicly (Railway or Render) and embeds on movedwithmalcolm.com.

---

BUILD PROMPT:

Build a public-facing home value lead capture widget with a Follow Up Boss integration. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port from process.env.PORT default 3010.

FILE TREE (exactly):
```
package.json
server.js
db.js
ai.js
fub.js
.env.example    (ANTHROPIC_API_KEY=, FUB_API_KEY=, NOTIFY_PHONE=, OPENPHONE_API_KEY=)
public/index.html      (standalone full page at /)
public/widget.html     (minimal iframe-embeddable version at /widget)
public/style.css
public/app.js
```

FLOW (both pages, same app.js, 4 steps with a progress bar):
1. Address entry (street, city defaults Grand Rapids, state fixed MN, zip)
2. Property details: beds, baths, square feet, condition select 1 to 5, waterfront yes/no, recent updates textarea
3. Contact gate before results: name, email, phone all required, phone validated as 10 digits, plus "When are you thinking about making a move?" select: 0-6 months, 6-12 months, 12+ months, just curious
4. Result screen showing the AI response, styled in navy (#1a2f4a) and gold (#c9a227)

DATABASE: leads table storing every field plus the AI response and created timestamp. GET /api/leads protected by a query param secret (ADMIN_SECRET in env) returning all leads as JSON for review.

SERVER: POST /api/submit validates all fields server-side, stores the lead, calls ai.js for the value response, calls fub.js (fire and forget, never block or fail the user response on FUB errors), returns the AI text.

FUB (fub.js): POST to https://api.followupboss.com/v1/events with Basic auth (FUB_API_KEY as username, blank password). Body: source "Website", type "Property Inquiry", person with name/emails/phones, property with the address and details, tags ["HomeValueWidget","SellerLead"], and the timeline answer in the note. If waterfront is yes OR timeline is 0-6 months, also send an SMS via OpenPhone API (POST https://api.openphone.com/v1/messages, header Authorization: OPENPHONE_API_KEY) to NOTIFY_PHONE: "Hot widget lead: [name], [address], waterfront=[y/n], timeline=[x]. In FUB now."

AI (ai.js): model claude-sonnet-4-6, max_tokens 500. System prompt verbatim:

"You generate instant home value estimates for Moved with Malcolm, Malcolm Wallaker's brand at Pemberton Real Estate, Grand Rapids Minnesota. No em dashes or en dashes, no emojis, warm and confident, one exclamation point maximum, close with a variation of 'Let me know.' You receive property inputs only, no comps. Give a RANGE, never a single number: use square feet, condition, updates, and waterfront status to reason a plausible Itasca County range, standard homes plus or minus 8 to 10 percent, waterfront plus or minus 15 percent with an explicit note that frontage quality, lake, and elevation swing value significantly. Under 180 words: the range with the honest caveat that an online estimate cannot see inside the home, two sentences on what drives value in their segment of the Northern Minnesota market, then the offer: Malcolm will prepare a free detailed valuation using actual sold comparables, usually within 24 hours. If inputs are contradictory or clearly fake, skip the number and give a qualitative response explaining what drives value plus the same offer. Never guarantee a sale price, never disparage other agents or Zillow, never mention eXp Realty."

ACCEPTANCE CRITERIA:
1. npm start clean, both / and /widget render and complete the full flow
2. Server rejects submissions with missing/invalid fields with clear messages
3. Lead stored with all fields, AI range appears on step 4
4. FUB call fires with correct payload shape (log it when FUB_API_KEY is missing instead of crashing)
5. Hot-lead SMS logic triggers only on waterfront or 0-6 month timeline
6. /api/leads requires the secret, widget.html has no header/footer chrome and fits an iframe at 400px wide
7. The user still gets their result even if FUB and OpenPhone are both down

DEPLOY NOTE (tell Claude Code to write this into the README it generates): push to GitHub, deploy on Railway, set env vars, then embed on the Astro site as an iframe at movedwithmalcolm.com/home-value.
