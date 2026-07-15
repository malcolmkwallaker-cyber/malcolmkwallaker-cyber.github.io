# land_reel

Turn photos of a vacant land parcel into a short vertical listing reel: drone-style
motion over the land photos, a whip transition, then a reveal of an AI rendering of
the finished home, with a caption pill disclosing it's a rendering.

## Setup

```bash
pip install -r tools/land_reel/requirements.txt
```

This installs `numpy`, `opencv-python-headless`, `pillow`, `imageio-ffmpeg` (bundles a
static ffmpeg binary — no system `ffmpeg`/`apt-get` needed), and `google-genai`.

## 1. Generate the AI render (optional, needs a Gemini API key)

```bash
export GEMINI_API_KEY=<your key>
python tools/land_reel/render_home.py \
  --photo hero_land_photo.jpg \
  --prompt "Photorealistic modern cabin on this exact lot, matching terrain, tree line, golden-hour light. No people, no cars, no text." \
  --out render.png
```

If `GEMINI_API_KEY` isn't set, the script prints instructions and exits with code 2 —
you can skip straight to step 2 with `--render` omitted (land-only montage) or supply
your own render image.

## 2. Assemble the reel

```bash
python tools/land_reel/make_reel.py \
  --photos land_wide.jpg land_mid.jpg land_close.jpg \
  --render render.png \
  --out out/reel.mp4 \
  --label "AI RENDERING OF FINISHED HOME" \
  --size 1080x1920 --fps 30 --seconds 10
```

Order `--photos` wide → close. Omit `--render` to get a land-only montage (no pill).
Output is `out/reel.mp4` plus `out/cover.jpg` (the render frame with the pill, suitable
as a post cover image).

Encoding uses the bundled ffmpeg (`libx264`/`yuv420p`/`+faststart`) when available,
falling back to `cv2.VideoWriter` with the `mp4v` fourcc otherwise.

## Using it from Claude Code

See `.claude/skills/vacant-land-reel/SKILL.md` — drop land photos into a session and
ask for a listing reel; Claude runs both steps above and authors the render prompt and
listing caption from what it sees in your photos.

## Public web app

A browser-only port of the same pipeline (no install, no key required to preview) is
live at `https://malcolmkwallaker-cyber.github.io/landreel/`. It runs the identical
Ken Burns / whip-transition / caption-pill math client-side via WebCodecs, and supports
bring-your-own Gemini API key for the AI render step.

## Future: hosted key-proxy

For users without their own Gemini key, a small Cloudflare Worker could proxy render
requests (`POST /render`, CORS-locked to the Pages origin, key stored as a Worker
secret, per-IP daily quota in KV, request body capped at 8 MB). Not built yet — the web
app's "bring your own key" tab is structured so a hosted option can be added later as a
third tab without restructuring.
