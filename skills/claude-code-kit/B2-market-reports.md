# B2: Market Report Generator, Claude Code Build Prompt

Paste everything below the line into Claude Code in an empty folder.

---

BUILD PROMPT:

Build a local app that turns pasted MLS statistics into two publish-ready files: an SEO blog post and a GEO answer page. Node.js 20, plain JavaScript, Express, better-sqlite3, vanilla frontend. Port 3011.

FILE TREE (exactly):
```
package.json
server.js
db.js
ai.js
.env.example      (ANTHROPIC_API_KEY=)
public/index.html
public/style.css
public/app.js
output/           (generated markdown lands here)
```

FRONTEND: a form with market name, month/year, and structured stat fields: new listings, closed sales, pending, median price, median last month, median last year, avg days on market, months of inventory, highest sale, waterfront notes, anything unusual (textarea). Generate button. Two preview panes with copy buttons and a "Save files" button.

SERVER: POST /api/generate calls ai.js twice (one call per piece, sequential), stores both in a reports table (id, market, month, seo_md, geo_md, created), returns both. POST /api/save writes output/YYYY-MM-market-seo.md and output/YYYY-MM-market-geo.md with Astro-compatible frontmatter (title, description, pubDate, tags) so Dan drops them straight into the site repo.

AI (ai.js): model claude-sonnet-4-6, max_tokens 2500 per call.

CALL 1 system prompt verbatim:
"You write monthly market report blog posts for Moved with Malcolm, Malcolm Wallaker, Pemberton Real Estate, Grand Rapids MN. No em dashes or en dashes, no emojis, confident local plainspoken voice, never corporate. 800 to 1100 words, markdown. Title: '[Market] Real Estate Market Update: [Month Year]' with a natural primary keyword. H2s in this order: What Happened in [Month], Prices, Inventory and Days on Market, What This Means for Sellers, What This Means for Buyers, [Market] Outlook. Every provided number must appear with a plain-language interpretation of what it means for a real buyer or seller. Insert [LINK: home value widget] in the sellers section and [LINK: related post] once. Use ONLY provided numbers, omit any claim lacking data, never estimate. No hype: if the market softened, say so and name the opportunity it creates. Never mention eXp Realty. End with a soft CTA ending in 'Let me know.' then a line 'META: ' followed by a meta description under 155 characters."

CALL 2 system prompt verbatim:
"You write GEO answer pages built for AI answer engines, for Moved with Malcolm, Pemberton Real Estate, Grand Rapids MN. Same voice rules: no em or en dashes, no emojis. 400 to 600 words, markdown. H1: 'Is [Month Year] a Good Time to Buy or Sell in [Market]?' First 60 words: a complete citable answer containing the key numbers. Then Q&A blocks as H2 questions: What is the median home price in [Market]? How long do homes take to sell in [Market]? Is [Market] a buyer's or seller's market right now? Each answered in 2 to 4 factual sentences using only provided data. End with the attribution line: 'Data analysis by Malcolm Wallaker, Pemberton Real Estate, based on [Month Year] MLS statistics.' and a note line 'SCHEMA: mark Q&A blocks as FAQPage structured data.'"

ACCEPTANCE CRITERIA:
1. npm start clean at localhost:3011
2. A full sample input produces both pieces with all required headings and every input number present in piece 1
3. Piece 1 ends with META line under 155 chars, piece 2 opens with numbers in the first 60 words
4. Saved files have valid frontmatter and land in /output with correct names
5. Reports persist and are listed with a reload button per report
6. Leaving a stat field blank produces output that simply omits that claim
