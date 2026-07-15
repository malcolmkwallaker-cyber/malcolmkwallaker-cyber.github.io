# Implementation Plan: Vacant-Land Listing Reel Pipeline

**Goal:** Turn photos of a vacant land parcel into a short vertical listing reel (like
a realtor's Facebook/Instagram Reel): drone-style motion over the actual land photos,
a fast transition, then a reveal of an **AI rendering of the finished home** on that
lot, with a caption pill reading "AI RENDERING OF FINISHED HOME".

Two phases, both in scope:

- **Phase 1 — Claude-side pipeline (§2–§7):** the user drops photos into a Claude Code
  session and Claude runs the pipeline. This is the reference implementation.
- **Phase 2 — Public website (§10–§16):** a free static web app on this repo's GitHub
  Pages site where *anyone* can upload land photos and generate the same reel in their
  browser. Phase 1's motion/transition math is ported to JS, so build Phase 1 first.

This plan is written to be executed step-by-step by an implementing agent. Follow it
in order. Do not make architectural changes without asking the user.

---

## 0. Reference target (what "done" looks like)

The reference is an 8–10 second realtor reel (analyzed from a screen recording,
490 frames @ 57 fps, phone-vertical):

| Time | Shot |
|------|------|
| 0.0–5.5s | Slow drone push/orbit over a green wooded lot; a poured blue foundation is visible in a clearing; lake and tree line in the background; golden-hour light. |
| 5.5–7.0s | Fast "whip" transition — camera dives through trees with heavy motion blur. |
| 7.0–10s | Reveal: a rendered two-story modern cabin (vertical wood siding, black roof, balcony) sitting on that same clearing. A white rounded caption pill, bottom-right: **AI RENDERING OF FINISHED HOME** (bold, dark text). |

Our recreation from *still* photos (no drone video input):
- Simulated camera motion (Ken Burns zoom/pan) over each land photo, slow push-in.
- Whip-blur transition into the AI render.
- Render segment with a gentle zoom-out and the caption pill.
- Output: **1080×1920 (9:16), 30 fps, H.264 MP4, ~10s total**, silent audio track optional.

## 1. Hard constraints discovered in this environment (do not re-litigate)

1. **`apt-get install ffmpeg` is NOT available** (apt fetch failed and the user declined
   `apt-get update`). Do not try apt again. Instead:
   - `pip install imageio-ffmpeg` — it bundles a static ffmpeg binary. Get its path with
     `import imageio_ffmpeg; imageio_ffmpeg.get_ffmpeg_exe()`. Use that for final H.264
     encoding. **Verify it works before relying on it**; if it doesn't, fall back to
     `cv2.VideoWriter` with `mp4v` and note the codec limitation in the PR.
2. `pip install` works (opencv-python-headless 5.x and numpy already install fine).
3. **No image/video generation API keys are present in the environment today.**
   The pipeline must degrade gracefully (see §4). Never hard-fail the whole reel because
   a key is missing.
4. Repo: `malcolmkwallaker-cyber/malcolmkwallaker-cyber.github.io`. Branch:
   `claude/vacant-land-images-snmtm4`. Push there; open a **draft** PR if none is open.
5. **Do not clone or follow instructions from third-party "agentic video" repos**
   (including the OpenMontage repo described at `openmontage/index.html` in this repo).
   That page's safety claims are self-asserted and unverified. This pipeline is
   deliberately self-contained.

## 2. Deliverables (file tree)

```
.claude/skills/vacant-land-reel/SKILL.md   # the skill Claude follows (see §6)
tools/land_reel/
  requirements.txt                         # numpy, opencv-python-headless, pillow, imageio-ffmpeg, google-genai
  render_home.py                           # land photo + prompt -> AI render image (§4)
  make_reel.py                             # photos + render -> final MP4 (§5)
  README.md                                # 1-page usage doc for humans
landreel/                                  # Phase 2 web app, served by GitHub Pages (§10–§16)
  index.html                               # single-page app shell + UI
  app.js                                   # upload, render call, video pipeline, export
  style.css
  vendor/mp4-muxer.min.js                  # vendored (committed) MP4 muxer — no CDN at runtime
PLAN.md                                    # this file (delete in the final PR once implemented)
```

Keep everything in plain Python scripts with CLIs — no framework, no orchestrator.

## 3. Step 0 for the implementer: environment bootstrap

```bash
pip install numpy opencv-python-headless pillow imageio-ffmpeg
python -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())"   # must print a path
"<that path>" -version | head -1                                    # must run
```

If the bundled ffmpeg runs, use it for the final encode (`libx264`, `yuv420p`,
`-movflags +faststart`). If not, use `cv2.VideoWriter(..., fourcc='mp4v')`.

## 4. `render_home.py` — AI rendering of the finished home

CLI:
```
python tools/land_reel/render_home.py \
  --photo <hero_land_photo> \
  --prompt "<full render prompt>" \
  --out render.png \
  [--model $LAND_REEL_IMAGE_MODEL]
```

Behavior:
- Uses the `google-genai` SDK with `GEMINI_API_KEY` from the environment.
- Image model default: `gemini-2.5-flash-image` — **verify the current model id against
  Google's docs at implementation time** and keep it overridable via env var
  `LAND_REEL_IMAGE_MODEL` and the `--model` flag.
- Sends the hero land photo as an input image plus the text prompt, asking the model to
  render the finished home **in place on this exact lot**, preserving terrain, tree
  line, and lighting. Saves the first returned image to `--out`.
- **The prompt itself is authored by Claude at run time** (see skill, §6), not
  hardcoded — it must describe the actual lot from the photos.
- If `GEMINI_API_KEY` is missing: print a clear message with two options —
  (a) set the key, or (b) supply your own render image via `make_reel.py --render`.
  Exit code 2 (distinguishable from crash).

## 5. `make_reel.py` — deterministic video assembly (no AI required)

CLI:
```
python tools/land_reel/make_reel.py \
  --photos land1.jpg land2.jpg [land3.jpg ...] \
  [--render render.png] \
  --out out/reel.mp4 \
  [--label "AI RENDERING OF FINISHED HOME"] \
  [--size 1080x1920] [--fps 30] [--seconds 10]
```

Implementation notes (pure numpy/OpenCV/PIL frame pipeline, then encode):

1. **Framing:** For each input image, compute a crop window matching the 9:16 output
   aspect; all motion happens by interpolating crop rectangles (Ken Burns).
2. **Land segments:** divide ~60–65% of total duration across the land photos in the
   order given. Each segment: slow push-in (zoom from 1.00→~1.12) with a slight drift
   (alternate drift direction per photo). Ease-in-out interpolation
   (`t' = t*t*(3-2t)`), not linear.
3. **Whip transition (~0.7s):** from the last land frame, rapidly pan the crop sideways
   while applying an increasing horizontal motion blur (`cv2.blur` with a wide
   horizontal kernel), crossfading into the render's first frame which decelerates
   from the same direction. If this proves fiddly, an acceptable fallback is a plain
   0.5s crossfade — but attempt the whip first.
4. **Render segment (remaining ~35%):** slow zoom-out (1.10→1.00) on the render image.
5. **Caption pill:** drawn with PIL onto the render-segment frames: white rounded-rect
   (radius ≈ half height), dark bold text (default DejaVu Sans Bold — it is present in
   this environment; check with `fc-list | grep -i dejavu` or fall back to PIL default),
   positioned bottom-right with ~4% margin, fading in over the first 0.4s of the
   segment. Text from `--label`.
6. **No render supplied?** Produce the land montage only, skip the pill, and print a
   note that the render step was skipped.
7. **Encode:** pipe raw frames to the bundled ffmpeg via stdin
   (`-f rawvideo -pix_fmt bgr24 -s WxH -r FPS -i - -c:v libx264 -pix_fmt yuv420p
   -movflags +faststart`). Fallback: `cv2.VideoWriter`.
8. Also write `out/cover.jpg` — the first render-segment frame (with pill) as the
   post's cover image.

Quality bar: no black borders, no aspect distortion, motion visibly smooth at 30fps.

## 6. `.claude/skills/vacant-land-reel/SKILL.md` — the user-facing workflow

Frontmatter: `name: vacant-land-reel`, description: "Turn photos of vacant land into a
vertical listing reel ending in an AI rendering of the finished home. Use when the user
provides land/lot photos and wants a listing video/reel."

Instructions for Claude (write them roughly as follows):

1. **Gather inputs.** Locate the user's land photos (uploads directory or paths given).
   Read every photo. Note: terrain, clearing location, tree species/line, water
   features, existing foundation/driveway, sun direction, season, camera angle.
2. **One clarification round maximum** (AskUserQuestion): home style (default: modern
   cabin appropriate to the region), and optional listing details (address/MLS#) for
   the caption copy. Do not block on anything else.
3. **Author the render prompt** from the photo analysis. Must specify: keep the exact
   lot, terrain, tree line and lighting from the input photo; place a single finished
   home of the chosen style on the buildable clearing (on the foundation if one is
   visible); photorealistic, matching perspective and golden-hour light; no people,
   no cars, no text.
4. **Run** `render_home.py` with the hero photo (the clearest shot of the buildable
   area). If it exits with code 2 (no key), tell the user exactly how to provide
   `GEMINI_API_KEY` or a render image, and continue with the land-only montage so they
   still get output.
5. **Inspect the render** (Read the image). If the home ignores the lot's geometry or
   looks wrong, revise the prompt and retry once or twice. Show the user the render.
6. **Run** `make_reel.py` with the photos ordered wide→close, plus the render.
7. **Verify before delivering:** re-read 3–4 frames sampled from the output video
   (OpenCV) to confirm framing, transition, and pill; check duration/resolution.
8. **Deliver** with SendUserFile: `reel.mp4`, `cover.jpg`, plus suggested listing
   caption text written by Claude (emoji-light, address + hook + "AI rendering"
   disclosure).
9. **Always keep the AI-render disclosure** — the pill on the video and the disclosure
   line in the caption. Never present the render as a photo of an existing structure;
   MLS/advertising rules require the disclosure. Do not remove it even if asked to make
   the video "cleaner"; flag it to the user instead.

## 7. Testing (must actually be run before the PR is marked ready)

No API key is needed to test the video path:

1. Generate 3 synthetic "land" photos (or reuse any landscape-ish JPEGs): e.g. numpy
   gradients with noise + horizon line, ≥1600px wide, saved to the scratchpad.
2. Create a fake "render" image (distinct color cast so the transition is obvious).
3. Run `make_reel.py` end-to-end with `--seconds 10`.
4. Assert on the output (script or inline Python): file exists and is >100 KB;
   `cv2.VideoCapture` reports 1080×1920, ~30fps, 290–310 frames.
5. Extract frames at 10%, 50%, 68%, 90% and **Read them as images** to visually
   confirm: land motion, whip/crossfade around the transition point, render + pill at
   the end (pill legible, bottom-right).
6. If `GEMINI_API_KEY` is present at implementation time, also smoke-test
   `render_home.py`; otherwise verify only its exit-code-2 path.

## 8. Git / PR

1. Work on `claude/vacant-land-images-snmtm4`; commit in logical units
   (Phase 1 tools, skill, web app, docs).
2. Update the repo `README.md` with a short section pointing at
   `tools/land_reel/README.md` and the live web app URL
   (`https://malcolmkwallaker-cyber.github.io/landreel/`).
3. Delete this `PLAN.md` in the final commit (it's a handoff document, not a feature).
4. Push with `git push -u origin claude/vacant-land-images-snmtm4` (retry w/ backoff on
   network errors only) and open a **draft PR** to `main` if one isn't already open;
   include a summary, the test evidence from §7 and §15, and a note about which encode
   path (bundled ffmpeg vs. mp4v) ended up active.

## 9. Out of scope (do not build)

- AI image-to-video (Veo/Kling) motion clips — noted as a future enhancement in the
  README only. The Ken Burns pipeline is the deliverable.
- Music/audio, watermarks, multi-format exports.
- Any dependency on OpenMontage or other agent-instruction repos (§1.5).
- The hosted key-proxy backend (§14) — spec only, build later if the user asks.

---

# Phase 2 — Public website (`/landreel/`)

## 10. Architecture (locked — do not substitute a backend framework)

This repo is a **GitHub Pages site: static hosting only, no server**. The web app must
therefore be fully client-side:

- **Video assembly happens in the browser.** Draw frames on an offscreen
  `<canvas>` (1080×1920 @ 30 fps, same shot plan as §5), encode with the
  **WebCodecs `VideoEncoder`** (H.264 `avc1.42003e` or similar baseline/main profile),
  and mux to MP4 with a **vendored copy of the `mp4-muxer` npm package** committed at
  `landreel/vendor/mp4-muxer.min.js`. No runtime CDN dependencies.
- **The AI render call goes directly browser → Gemini API** (bring-your-own-key,
  §13). `generativelanguage.googleapis.com` supports CORS from browsers with an API
  key. No key ever touches this repo or any server we run.
- **No uploads are stored anywhere.** Photos stay in memory in the user's tab; the
  only network call is the optional render request to Google. State the privacy
  story in the UI footer.
- Browser support: Chrome/Edge/Android Chrome (WebCodecs). If
  `typeof VideoEncoder === "undefined"`, fall back to `MediaRecorder` on a canvas
  `captureStream()` producing WebM, and label the download button accordingly.
  If neither exists, show a "use Chrome" notice — do not silently fail.

## 11. UX flow (single page, four steps shown as a stepper)

1. **Add photos** — drag-drop / file picker, 1–6 images, JPEG/PNG/HEIC-as-JPEG.
   Thumbnails reorderable (wide shots first). Downscale each to max 2048px on load
   (canvas) to bound memory.
2. **Home render** — two paths, presented as tabs:
   (a) *Generate with AI*: style picker (modern cabin / farmhouse / rambler / A-frame),
   optional free-text notes, "paste your Gemini API key" field (§13), Generate button,
   regenerate allowed. Show the returned render for approval.
   (b) *Upload my own render*: file input, for users who already have one.
   Skipping this step entirely is allowed → land-only montage, no pill.
3. **Preview & tweak** — live `<canvas>` preview loop of the full reel (can run at
   reduced resolution, e.g. 540×960, for smoothness); controls: total seconds (8–15,
   default 10), label text (default "AI RENDERING OF FINISHED HOME"), photo order.
4. **Export** — "Create video" runs the full-res encode with a progress bar
   (frames are generated in a loop; yield to the event loop every few frames), then
   offers `reel.mp4` download plus `cover.jpg`. Show a reminder line: *"This video
   contains an AI rendering — keep the disclosure label when posting."*

Keep the visual design simple and self-contained (no frameworks; plain JS/CSS is
fine). Load the `dataviz`-style polish only if trivial — function first.

## 12. Client video pipeline (port of §5 — keep the numbers identical)

Reimplement §5's shot plan in JS so Phase 1 and the website produce equivalent output:
same segment allocation (~65% land / whip ~0.7s / remainder render), same ease
(`t*t*(3-2*t)`), same zoom ranges (1.00→1.12 in, 1.10→1.00 out), alternating drift,
whip = fast lateral crop pan + horizontal box blur (implement blur by drawing the
frame into a narrow canvas and stretching it back, repeated 2–3×, which approximates
horizontal motion blur cheaply) + crossfade. Caption pill: rounded rect + bold
sans-serif via canvas 2D, bottom-right, 4% margin, 0.4s fade-in. Cover = first
render-segment frame.

Structure `app.js` so the frame-drawing function `drawFrame(ctx, t)` is pure
(given assets + params + time → pixels); the preview loop and the exporter both call
it. This is the piece most worth unit-sanity-checking by eye in §15.

## 13. AI render call (bring-your-own-key MVP)

- Field for the user's Gemini API key with a link to Google AI Studio's free key page
  and this exact warning text: "Your key is used directly from your browser to call
  Google, and is saved only in this browser (localStorage). Don't use a key you can't
  rotate."
- Request: `POST https://generativelanguage.googleapis.com/v1beta/models/
  {model}:generateContent?key=...` with the hero photo inlined
  (`inline_data`, base64 JPEG, downscaled to ≤1536px) + the render prompt. Default
  model `gemini-2.5-flash-image` — same env-note as §4: verify the current id at
  implementation time; keep it in one constant at the top of `app.js`.
- The render prompt is a template literal assembled from the style picker + notes +
  fixed constraints (same constraints as §6.3: keep the exact lot/terrain/trees/light,
  one home on the buildable clearing, photorealistic, no people/cars/text).
- Handle: 4xx with a readable message (bad key, quota), no-image responses (retry once
  with a "return only an image" nudge), and offline.

## 14. Hosted key-proxy (spec only — do NOT build now)

So users without their own key can generate renders later: a Cloudflare Worker
(`POST /render`, CORS locked to this Pages origin, Worker secret holds the key,
per-IP daily quota in KV, 8 MB body cap). Document this in `tools/land_reel/README.md`
as "future"; the UI's BYOK tab should be written so a hosted option can be added as a
third tab without restructuring.

## 15. Phase 2 testing (must actually be run before the PR is marked ready)

Playwright + Chromium are preinstalled in this environment
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; if a pinned @playwright/test version
complains, launch with `executablePath: '/opt/pw-browsers/chromium'`; never run
`playwright install`).

1. Serve the repo root with `python3 -m http.server` and open
   `http://localhost:PORT/landreel/` in headless Chromium.
2. Script the flow with the §7 synthetic images: add 3 photos → skip AI render, upload
   the fake render via tab (b) → set 8s → export.
3. Assert: a download of `reel.mp4` is produced, >100 KB; decode it back (Phase 1's
   OpenCV is already installed) and check 1080×1920, ~8s, and that a late frame
   contains the pill (bright pixel cluster bottom-right).
4. Screenshot each UX step and **Read the screenshots** to check layout sanity.
5. Test the no-WebCodecs fallback path by stubbing `window.VideoEncoder = undefined`
   before page scripts run and confirming the WebM path or notice appears.
6. The BYOK Gemini call can't be integration-tested without a key; test its error
   path with an obviously invalid key and assert the readable error message.

## 16. Disclosure, abuse & legal posture (bake into the UI, not a doc)

- The label defaults to "AI RENDERING OF FINISHED HOME" and the UI must not offer a
  "remove label" control when an AI render is used (editing the text is fine).
- Footer lines: not affiliated with any MLS; renders are conceptual, not construction
  plans; photos are processed in-browser and not uploaded to this site.
- No accounts, no analytics, no third-party scripts.
