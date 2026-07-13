# B6: YouTube Faceless Video Engine, Claude Code Build Prompt

The biggest build in the kit. Paste everything below the line into Claude Code in an empty folder. Build it AFTER B2, and expect the weak model to need two or three verify-and-fix passes on this one.

---

BUILD PROMPT:

Build a video production pipeline: topic queue -> AI script -> ElevenLabs voiceover -> Creatomate video assembly -> approval dashboard -> YouTube upload with full SEO metadata. Node.js 20, plain JavaScript, Express, better-sqlite3, node-cron. Port 3015. Local app, only YouTube uploads leave the machine.

FILE TREE (exactly):
```
package.json
server.js
pipeline.js      (orchestrates the stages)
ai.js            (script + metadata generation)
elevenlabs.js
creatomate.js
youtube.js
db.js
.env.example     (ANTHROPIC_API_KEY=, ELEVENLABS_API_KEY=, ELEVENLABS_VOICE_ID=, CREATOMATE_API_KEY=, CREATOMATE_TEMPLATE_ID=, YOUTUBE_CLIENT_ID=, YOUTUBE_CLIENT_SECRET=, YOUTUBE_REFRESH_TOKEN=, AUTO_PUBLISH=false)
public/index.html   (dashboard)
public/style.css
public/app.js
media/              (audio and video files land here)
```

DATABASE: videos table: id, topic, keyword, pillar TEXT (relocation or market), data_input TEXT, script TEXT, broll_terms TEXT, audio_path TEXT, video_path TEXT, video_url TEXT, title TEXT, description TEXT, tags TEXT, chapters TEXT, pinned_comment TEXT, blog_note TEXT, status TEXT, error TEXT, scheduled_publish TEXT, youtube_id TEXT. Status flow: queued -> scripted -> voiced -> rendered -> ready -> approved -> published (or failed at any stage with the error stored, retryable from the dashboard).

PIPELINE STAGES (pipeline.js, each stage a separate function, cron every 15 minutes advances any video one stage):

STAGE 1 SCRIPT (ai.js, model claude-sonnet-4-6, max_tokens 4000). System prompt verbatim:
"You write faceless YouTube scripts for Moved with Malcolm, Malcolm Wallaker's real estate brand at Pemberton Real Estate, Grand Rapids Minnesota. Voiceover with stock footage, narrator speaks as Malcolm in first person. Audience: people researching moving to, living in, or buying property in Northern Minnesota. No em dashes or en dashes, no emojis, conversational and local, short sentences written for the ear. Structure: HOOK first 20 seconds stating the exact search question and promising the answer, target keyword in the first two sentences, no intro before the hook. Then one brand line: 'I'm Malcolm Wallaker, I sell real estate across Grand Rapids and Northern Minnesota, and here's what you actually need to know.' Then 5 to 8 body sections, each heading phrased as a searchable question, answer front-loaded then explained, real local specifics only (lakes, neighborhoods, employers, seasons, drive times), generic filler banned. Every relocation video includes one genuinely candid downside section. CTA outro: free relocation guide or home value report at movedwithmalcolm.com, invitation to call or text, and 'Let me know what questions you've got, I answer every comment.' Fair housing is absolute: describe places by amenities, housing stock, prices, geography only, never by demographics or who lives there, never steer. Use only data provided in the input, write [DATA NEEDED: x] where a number is missing, never invent statistics. Never mention eXp Realty. Length: 900 to 1200 words for relocation, 500 to 700 for market updates. Output as JSON only, no markdown fences: {\"sections\":[{\"heading\":\"\",\"voiceover\":\"\",\"broll\":[\"term1\",\"term2\"]}],\"full_voiceover\":\"\"}"
Parse the JSON (strip fences defensively). If the script contains [DATA NEEDED, set status failed with that as the error so it surfaces on the dashboard instead of producing a video with a hole in it.

STAGE 2 VOICE (elevenlabs.js): POST https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID} with header xi-api-key, body { text: full_voiceover, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.55, similarity_boost: 0.75 } }. Save the mp3 to media/, store audio_path, compute duration with the music-metadata npm package.

STAGE 3 RENDER (creatomate.js): POST https://api.creatomate.com/v1/renders with Bearer auth, using CREATOMATE_TEMPLATE_ID and modifications: the audio file (upload or public URL as Creatomate requires), per-section heading texts for lower-thirds, and the broll search terms mapped to the template's stock-footage elements. Poll GET /v1/renders/{id} every 30 seconds until succeeded, download the mp4 to media/, store video_path. (Note for the builder: keep this file isolated and well-commented, it is the most likely integration to need manual adjustment against Creatomate's current API docs. Add a README section explaining how to create the master template in Creatomate's editor: 1920x1080, navy #1a2f4a and gold #c9a227, intro card, lower-third text element per scene, stock video element per scene, end card with movedwithmalcolm.com.)

STAGE 4 METADATA (ai.js, model claude-haiku-4-5-20251001, max_tokens 1500). System prompt verbatim:
"You produce YouTube metadata for Moved with Malcolm videos from a script and target keyword. No em dashes or en dashes, no emojis. Output JSON only, no fences: {\"title\":\"\",\"description\":\"\",\"tags\":[],\"chapters\":\"\",\"pinned_comment\":\"\",\"blog_note\":\"\"}. Title under 60 characters, exact keyword first. Description 200 to 300 words: first two sentences contain the keyword and a complete answer summary, then a short expansion, then this links block verbatim: 'Free home value report: https://movedwithmalcolm.com/home-value\\nAll things Northern Minnesota real estate: https://movedwithmalcolm.com', then chapter timestamps, then 3 hashtags. Tags: 15 to 20, exact keyword first, then variants, then grand rapids mn, itasca county, northern minnesota real estate, moved with malcolm. Chapters from the section headings starting 0:00, estimating timestamps proportionally from section word counts against the provided total audio duration. Pinned comment: 2 to 3 sentences answering the video's core question in one line, linking the relevant movedwithmalcolm.com page, ending 'Let me know what I missed and I'll cover it.' Blog note: one line with the suggested URL slug and internal link targets."
Video becomes status ready.

STAGE 5 PUBLISH (youtube.js, googleapis npm package, OAuth2 with the refresh token): only runs for status approved. Upload video_path with title, description, tags, categoryId 26, madeForKids false, publishAt scheduled_publish if set (private until then) otherwise public immediately. After upload, insert the pinned comment via commentThreads (note: pinning itself is not exposed by the API, so add a dashboard note telling Dan to pin it manually, one click). Store youtube_id and video_url, status published. If AUTO_PUBLISH=true, videos skip approval and publish when ready, but ship with AUTO_PUBLISH=false and show the setting prominently on the dashboard.

DASHBOARD: add-topic form (topic, keyword, pillar, data textarea, publish datetime defaulting to next Tuesday or Friday 5 PM Central, whichever is sooner), pipeline board grouped by status, per-video detail with script, audio player, rendered video player, editable metadata fields, Approve button, Retry button on failures, and a copy button on blog_note for the site pairing workflow.

ACCEPTANCE CRITERIA:
1. npm start clean at localhost:3015
2. Adding a topic advances automatically through scripted status; script JSON parses and sections render on the dashboard
3. A script containing [DATA NEEDED fails loudly with the reason visible
4. Voice stage produces a playable mp3 with stored duration (test with a short script to save credits)
5. Metadata JSON parses, title under 60 chars, chapters start 0:00 and are proportional
6. Approve is required before publish when AUTO_PUBLISH=false, and publish schedules correctly for a future datetime
7. Every stage failure stores the error, shows on the dashboard, and Retry re-runs only that stage
8. Missing any API key fails that stage gracefully with a clear message naming the missing key
9. Two videos can move through the pipeline concurrently without file collisions (unique filenames per video id)

FIRST-RUN NOTE (write into the generated README): get the YouTube refresh token via Google Cloud Console OAuth consent + the standard offline-access flow, create the Creatomate master template per the STAGE 3 notes before the first render, and run the first four videos with manual review of every stage before trusting the cron.
