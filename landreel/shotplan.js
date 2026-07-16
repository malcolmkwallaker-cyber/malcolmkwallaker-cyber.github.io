/**
 * Pure port of tools/land_reel/make_reel.py's shot plan (§5 / §12 of the plan).
 * Keep the numbers identical to the Python implementation.
 */
(function (global) {
  "use strict";

  const LAND_FRACTION = 0.625;
  const WHIP_SECONDS = 0.7;
  const ZOOM_IN_START = 1.0, ZOOM_IN_END = 1.12;
  const ZOOM_OUT_START = 1.1, ZOOM_OUT_END = 1.0;
  const DRIFT_FRAC = 0.06;
  const WHIP_PAN_FRAC = 0.2;
  const MAX_BLUR_STRENGTH = 1.0;
  const PILL_FADE_SECONDS = 0.4;

  function ease(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  }

  function coverCropSize(imgW, imgH, ratio) {
    if (imgW / imgH > ratio) {
      return { w: imgH * ratio, h: imgH };
    }
    return { w: imgW, h: imgW / ratio };
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function clampCrop(imgW, imgH, cx, cy, cw, ch) {
    cw = Math.min(cw, imgW);
    ch = Math.min(ch, imgH);
    cx = Math.min(Math.max(cx, cw / 2), imgW - cw / 2);
    cy = Math.min(Math.max(cy, ch / 2), imgH - ch / 2);
    return { sx: cx - cw / 2, sy: cy - ch / 2, sw: cw, sh: ch };
  }

  function drawCropped(ctx, img, imgW, imgH, cx, cy, cw, ch, outW, outH) {
    const { sx, sy, sw, sh } = clampCrop(imgW, imgH, cx, cy, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  }

  /**
   * Approximate horizontal motion blur: shrink width, stretch back, repeat.
   * Uses the caller-owned scratch canvases (narrow/bufA/bufB, all pre-sized
   * to outW x outH) instead of allocating new canvases per call -- the whip
   * transition calls this every frame, and allocating ~a dozen canvas
   * elements per frame caused enough GC pressure to visibly drift real-time
   * export pacing (see the MediaRecorder fallback in app.js).
   */
  function horizontalBlur(srcCanvas, strength, scratch) {
    const outW = srcCanvas.width, outH = srcCanvas.height;
    if (strength <= 0.02) return srcCanvas;
    const passes = 3;
    const targets = [scratch.bufA, scratch.bufB];
    let src = srcCanvas;
    for (let p = 0; p < passes; p++) {
      const shrink = 1 - strength * 0.25;
      const narrowW = Math.max(2, Math.round(outW * shrink));
      if (scratch.narrow.width !== narrowW) scratch.narrow.width = narrowW;
      scratch.narrow.getContext("2d").drawImage(src, 0, 0, src.width, outH, 0, 0, narrowW, outH);
      const target = targets[p % 2];
      target.getContext("2d").drawImage(scratch.narrow, 0, 0, narrowW, outH, 0, 0, outW, outH);
      src = target;
    }
    return src;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildPillOverlay(outW, outH, label) {
    const marginX = Math.round(outW * 0.04);
    const marginY = Math.round(outH * 0.04);
    const maxBoxW = outW - 2 * marginX;

    const measure = makeCanvas(outW, outH);
    const mctx = measure.getContext("2d");

    let fontSize = Math.max(14, Math.round(outH * 0.028));
    let textW, textH, padX, boxW;
    while (true) {
      mctx.font = `bold ${fontSize}px "DejaVu Sans", Arial, sans-serif`;
      textW = mctx.measureText(label).width;
      textH = fontSize;
      padX = Math.round(textH * 0.9);
      boxW = textW + 2 * padX;
      if (boxW <= maxBoxW || fontSize <= 14) break;
      fontSize -= 2;
    }
    const padY = Math.round(textH * 0.55);
    boxW = Math.min(boxW, maxBoxW);
    const boxH = textH + 2 * padY;
    const radius = boxH / 2;

    const x2 = outW - marginX;
    const y2 = outH - marginY;
    const x1 = x2 - boxW;
    const y1 = y2 - boxH;

    const pillCanvas = makeCanvas(outW, outH);
    const pctx = pillCanvas.getContext("2d");
    pctx.fillStyle = "#ffffff";
    roundRectPath(pctx, x1, y1, boxW, boxH, radius);
    pctx.fill();
    pctx.fillStyle = "#191919";
    pctx.font = `bold ${fontSize}px "DejaVu Sans", Arial, sans-serif`;
    pctx.textBaseline = "middle";
    pctx.textAlign = "left";
    pctx.fillText(label, x1 + padX, y1 + boxH / 2 + boxH * 0.02);
    return pillCanvas;
  }

  class LandPlan {
    constructor(img, ratio, direction) {
      this.img = img;
      this.imgW = img.width;
      this.imgH = img.height;
      this.direction = direction;
      const base = coverCropSize(this.imgW, this.imgH, ratio);
      this.baseCW = base.w;
      this.baseCH = base.h;
    }
    cropAt(zoom, driftT) {
      const cw = this.baseCW / zoom;
      const ch = this.baseCH / zoom;
      const maxDrift = Math.max(0, (this.imgW - cw) / 2);
      const drift = Math.min(maxDrift, cw * DRIFT_FRAC) * this.direction * driftT;
      return { cx: this.imgW / 2 + drift, cy: this.imgH / 2, cw, ch };
    }
  }

  class RenderPlan {
    constructor(img, ratio) {
      this.img = img;
      this.imgW = img.width;
      this.imgH = img.height;
      const base = coverCropSize(this.imgW, this.imgH, ratio);
      this.baseCW = base.w;
      this.baseCH = base.h;
    }
    cropAt(zoom, extraDx) {
      const cw = this.baseCW / zoom;
      const ch = this.baseCH / zoom;
      return { cx: this.imgW / 2 + (extraDx || 0), cy: this.imgH / 2, cw, ch };
    }
  }

  /**
   * photos: array of ImageBitmap (or HTMLImageElement with .width/.height as
   * intrinsic pixel size), wide -> close. render: ImageBitmap or null.
   * Returns { totalFrames, drawFrame(ctx, frameIndex), drawCoverFrame(ctx), meta }.
   * drawFrame is pure: same assets + params + frameIndex -> same pixels, so
   * both the live preview loop and the exporter can call it.
   */
  function buildShotPlan(photos, render, outW, outH, fps, seconds, label) {
    const ratio = outW / outH;
    const totalFrames = Math.round(fps * seconds);
    const whipFrames = render ? Math.round(fps * WHIP_SECONDS) : 0;

    let landFramesTotal, renderFramesTotal;
    if (render) {
      landFramesTotal = Math.round(totalFrames * LAND_FRACTION);
      renderFramesTotal = Math.max(1, totalFrames - landFramesTotal - whipFrames);
    } else {
      landFramesTotal = totalFrames;
      renderFramesTotal = 0;
    }

    const nPhotos = photos.length;
    const base = Math.floor(landFramesTotal / nPhotos);
    const remainder = landFramesTotal - base * nPhotos;
    const perPhoto = Array.from({ length: nPhotos }, (_, i) => base + (i < remainder ? 1 : 0));

    const landPlans = photos.map((img, i) => new LandPlan(img, ratio, i % 2 === 0 ? 1 : -1));
    const renderPlan = render ? new RenderPlan(render, ratio) : null;
    const pillCanvas = render ? buildPillOverlay(outW, outH, label) : null;
    const pillFadeFrames = Math.max(1, Math.round(fps * PILL_FADE_SECONDS));

    const landSegments = [];
    let cursor = 0;
    for (let i = 0; i < nPhotos; i++) {
      landSegments.push({ photoIndex: i, start: cursor, n: perPhoto[i] });
      cursor += perPhoto[i];
    }
    const whipStart = cursor;
    cursor += whipFrames;
    const renderStart = cursor;

    const lastPlan = landPlans.length ? landPlans[landPlans.length - 1] : null;
    const lastZoomEnd = ZOOM_IN_END;
    const lastDriftEnd = 1;

    // Scratch canvases reused across every whip frame (see horizontalBlur's docstring).
    const whipScratch = render
      ? {
          raw: makeCanvas(outW, outH),
          bufA: makeCanvas(outW, outH),
          bufB: makeCanvas(outW, outH),
          narrow: makeCanvas(outW, outH),
        }
      : null;

    function findLandSegment(frameIndex) {
      for (const s of landSegments) {
        if (frameIndex >= s.start && frameIndex < s.start + s.n) return s;
      }
      return landSegments[landSegments.length - 1];
    }

    function drawFrame(ctx, frameIndex) {
      ctx.clearRect(0, 0, outW, outH);

      if (frameIndex < landFramesTotal) {
        const seg = findLandSegment(frameIndex);
        const plan = landPlans[seg.photoIndex];
        const f = frameIndex - seg.start;
        const n = seg.n;
        const t = ease(n > 1 ? f / (n - 1) : 1);
        const zoom = ZOOM_IN_START + (ZOOM_IN_END - ZOOM_IN_START) * t;
        const { cx, cy, cw, ch } = plan.cropAt(zoom, t);
        drawCropped(ctx, plan.img, plan.imgW, plan.imgH, cx, cy, cw, ch, outW, outH);
        return;
      }

      if (render && frameIndex < renderStart) {
        const i = frameIndex - whipStart;
        const t = whipFrames > 1 ? i / (whipFrames - 1) : 1;
        const te = ease(t);
        const landDir = lastPlan.direction;

        const landExtraDx = landDir * WHIP_PAN_FRAC * lastPlan.imgW * te;
        const landZoom = lastZoomEnd + 0.04 * te;
        const landCrop = lastPlan.cropAt(landZoom, lastDriftEnd);
        drawCropped(
          whipScratch.raw.getContext("2d"), lastPlan.img, lastPlan.imgW, lastPlan.imgH,
          landCrop.cx + landExtraDx, landCrop.cy, landCrop.cw, landCrop.ch, outW, outH
        );
        const landBlurred = horizontalBlur(whipScratch.raw, MAX_BLUR_STRENGTH * te, whipScratch);
        ctx.globalAlpha = 1;
        ctx.drawImage(landBlurred, 0, 0);

        const renderOffset = landDir * WHIP_PAN_FRAC * renderPlan.imgW * (1 - te);
        const rc = renderPlan.cropAt(ZOOM_OUT_START, renderOffset);
        drawCropped(
          whipScratch.raw.getContext("2d"), renderPlan.img, renderPlan.imgW, renderPlan.imgH,
          rc.cx, rc.cy, rc.cw, rc.ch, outW, outH
        );
        const renderBlurred = horizontalBlur(whipScratch.raw, MAX_BLUR_STRENGTH * ease(1 - t), whipScratch);

        ctx.globalAlpha = te;
        ctx.drawImage(renderBlurred, 0, 0);
        ctx.globalAlpha = 1;
        return;
      }

      if (render) {
        const i = frameIndex - renderStart;
        const n = renderFramesTotal;
        const t = ease(n > 1 ? i / (n - 1) : 1);
        const zoom = ZOOM_OUT_START + (ZOOM_OUT_END - ZOOM_OUT_START) * t;
        const rc = renderPlan.cropAt(zoom, 0);
        drawCropped(ctx, renderPlan.img, renderPlan.imgW, renderPlan.imgH, rc.cx, rc.cy, rc.cw, rc.ch, outW, outH);
        const fade = Math.min(1, i / pillFadeFrames);
        if (fade > 0) {
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.drawImage(pillCanvas, 0, 0);
          ctx.restore();
        }
      }
    }

    function drawCoverFrame(ctx) {
      if (!render) return false;
      const rc = renderPlan.cropAt(ZOOM_OUT_START, 0);
      drawCropped(ctx, renderPlan.img, renderPlan.imgW, renderPlan.imgH, rc.cx, rc.cy, rc.cw, rc.ch, outW, outH);
      ctx.drawImage(pillCanvas, 0, 0);
      return true;
    }

    return {
      totalFrames,
      drawFrame,
      drawCoverFrame,
      meta: { landFramesTotal, whipFrames, renderFramesTotal, whipStart, renderStart },
    };
  }

  global.LandReelShotPlan = { buildShotPlan, ease, coverCropSize };
})(window);
