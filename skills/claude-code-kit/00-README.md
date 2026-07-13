# Malcolm OS: Claude Code Build Kit
## 11 copy-paste prompts. Fable 5 made every decision. A weaker model just types.

**How this works:** Every file in this kit is a complete, self-contained prompt you paste into Claude Code (running Sonnet or even Haiku). All architecture decisions, tech stack choices, file structures, API integrations, AI prompts, and acceptance criteria are already made and written down. The weaker model never has to think, only implement and verify against the checklist at the bottom of each prompt.

**The workflow, per project:**
1. Create an empty folder: `mkdir malcolm-net-worth && cd malcolm-net-worth`
2. Run `claude` (Claude Code) inside it, on the cheap model
3. Paste the entire BUILD PROMPT block from the project file
4. Let it build, then tell it: "Now verify every item in the ACCEPTANCE CRITERIA and fix anything that fails"
5. `npm start` and use it

**Shared stack (identical across all 11 projects, on purpose):**
- Node.js 20, plain JavaScript, no TypeScript, no build step
- Express for the server, better-sqlite3 for storage, vanilla HTML/CSS/JS frontend in /public
- AI calls: direct fetch to https://api.anthropic.com/v1/messages
- Every project reads a .env file and includes a .env.example
- Weak-model guardrails baked into every prompt: exact file tree, no framework choices left open, no "you decide" anywhere

**Master .env (collect these once, Dan):**
```
ANTHROPIC_API_KEY=
FUB_API_KEY=            (Follow Up Boss, Settings > API)
FUB_RECRUITING_API_KEY= (second FUB account)
OPENPHONE_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
CREATOMATE_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
```

**Model assignments (already set inside each prompt):**
- claude-haiku-4-5-20251001: P2, P3, P5, B3, B5, B6 metadata
- claude-sonnet-4-6: P1, P4, B1, B2, B4, B6 scripts

**Build order:**
1. B3 review-harvester (smallest, immediate ROI)
2. B1 home-value-widget (revenue)
3. B5 open-house-bot (reuses B1 patterns)
4. B4 recruiting-nurture
5. B2 market-reports, B6 youtube-engine (B6 consumes B2 data)
6. P1 through P5 anytime

**Universal voice rules (already embedded in every AI prompt inside the kit):** no em or en dashes, no emojis, exclamation points sparingly, "Let me know" closes, Pemberton Real Estate only, never eXp.

**Deployment note:** everything runs locally first. B1 and B5 need public URLs to receive traffic: deploy those two to Railway or Render (each prompt includes the deploy note). Everything else can live on Dan's machine with a cron.
