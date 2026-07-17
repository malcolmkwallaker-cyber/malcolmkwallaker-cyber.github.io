---
name: vacant-land-reel
description: Turn photos of vacant land into a vertical listing reel ending in an AI rendering of the finished home. Use when the user provides land/lot photos and wants a listing video/reel.
---

# Vacant-land listing reel

Produces a ~10s vertical (1080x1920) reel: Ken Burns motion over the user's actual land
photos, a whip transition, then a reveal of an AI rendering of the finished home on
that lot, with a caption pill disclosing it's a rendering.

## Workflow

1. **Gather inputs.** Locate the user's land photos (uploads directory or paths given).
   Read every photo. Note: terrain, clearing location, tree species/line, water
   features, existing foundation/driveway, sun direction, season, camera angle.

2. **One clarification round maximum** (`AskUserQuestion`): home style (default: modern
   cabin appropriate to the region), and optional listing details (address/MLS#) for
   the caption copy. Do not block on anything else.

3. **Author the render prompt** from the photo analysis — write it yourself, don't use
   a canned template. It must specify:
   - Keep the exact lot, terrain, tree line, and lighting from the input photo.
   - Place a single finished home of the chosen style on the buildable clearing (on the
     foundation if one is visible).
   - Photorealistic, matching perspective and golden-hour light.
   - No people, no cars, no text.

4. **Run `render_home.py`** with the hero photo (the clearest shot of the buildable
   area) and your authored prompt:
   ```
   python tools/land_reel/render_home.py --photo <hero.jpg> --prompt "<prompt>" --out render.png
   ```
   If it exits with code 2 (no `GEMINI_API_KEY`), tell the user exactly how to provide
   the key or their own render image, and continue to step 6 with the land-only
   montage so they still get output.

5. **Inspect the render** (Read the image). If the home ignores the lot's geometry or
   looks wrong, revise the prompt and retry once or twice. Show the user the render
   before proceeding.

6. **Run `make_reel.py`** with the photos ordered wide → close, plus the render:
   ```
   python tools/land_reel/make_reel.py --photos <wide.jpg> <mid.jpg> <close.jpg> \
     --render render.png --out out/reel.mp4
   ```

7. **Verify before delivering:** re-read 3-4 frames sampled from the output video
   (OpenCV `VideoCapture` + `imwrite`, then Read them as images) to confirm framing,
   the transition, and the caption pill. Check duration/resolution match what you
   asked for.

8. **Deliver** with `SendUserFile`: `reel.mp4`, `cover.jpg`, plus a suggested listing
   caption you write (emoji-light, address + hook + an explicit "AI rendering"
   disclosure line).

9. **Always keep the AI-render disclosure** — the pill on the video and the disclosure
   line in the caption. Never present the render as a photo of an existing structure;
   MLS/advertising rules require the disclosure. Do not remove it even if asked to make
   the video "cleaner"; flag it to the user instead.
