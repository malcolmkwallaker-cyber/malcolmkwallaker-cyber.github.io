(function () {
  "use strict";

  const { buildShotPlan } = window.LandReelShotPlan;

  const DEFAULT_MODEL = "gemini-2.5-flash-image";
  const EXPORT_W = 1080, EXPORT_H = 1920;
  const PREVIEW_W = 540, PREVIEW_H = 960;
  const FPS = 30;
  const MAX_PHOTO_DIM = 2048;
  const MAX_RENDER_INPUT_DIM = 1536;
  const GEMINI_KEY_STORAGE = "landreel_gemini_key";
  const MAX_PHOTOS = 6;

  const state = {
    photos: [],       // [{bitmap, name}]
    render: null,      // ImageBitmap or null
    renderSource: null, // 'ai' | 'upload' | null
    seconds: 10,
    label: "AI RENDERING OF FINISHED HOME",
  };

  // ---------- DOM ----------
  const el = (id) => document.getElementById(id);
  const dropzone = el("dropzone");
  const fileInput = el("fileInput");
  const thumbsList = el("thumbs");
  const toStep2Btn = el("toStep2");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabAi = el("tab-ai");
  const tabUpload = el("tab-upload");
  const homeStyle = el("homeStyle");
  const homeNotes = el("homeNotes");
  const geminiKeyInput = el("geminiKey");
  const generateRenderBtn = el("generateRender");
  const renderStatus = el("renderStatus");
  const renderPreview = el("renderPreview");
  const renderFileInput = el("renderFileInput");
  const uploadPreview = el("uploadPreview");
  const skipRenderBtn = el("skipRender");
  const toStep3Btn = el("toStep3");

  const previewCanvas = el("previewCanvas");
  const secondsRange = el("secondsRange");
  const secondsValue = el("secondsValue");
  const labelInput = el("labelInput");
  const toStep4Btn = el("toStep4");

  const exportBtn = el("exportBtn");
  const progressWrap = el("progressWrap");
  const exportProgress = el("exportProgress");
  const exportProgressLabel = el("exportProgressLabel");
  const exportStatus = el("exportStatus");
  const downloadsWrap = el("downloads");
  const downloadVideo = el("downloadVideo");
  const downloadCover = el("downloadCover");

  geminiKeyInput.value = localStorage.getItem(GEMINI_KEY_STORAGE) || "";
  geminiKeyInput.addEventListener("change", () => {
    localStorage.setItem(GEMINI_KEY_STORAGE, geminiKeyInput.value.trim());
  });

  // ---------- Step navigation ----------
  function showStep(n) {
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`panel-${i}`).hidden = i !== n;
      document.querySelector(`.step[data-step="${i}"]`).classList.toggle("active", i === n);
    }
    if (n === 3) {
      startPreviewLoop();
    } else {
      stopPreviewLoop();
    }
  }

  el("backTo1").addEventListener("click", () => showStep(1));
  el("backTo2").addEventListener("click", () => showStep(2));
  el("backTo3").addEventListener("click", () => showStep(3));
  toStep2Btn.addEventListener("click", () => showStep(2));
  toStep3Btn.addEventListener("click", () => showStep(3));
  skipRenderBtn.addEventListener("click", () => {
    state.render = null;
    state.renderSource = null;
    showStep(3);
  });
  toStep4Btn.addEventListener("click", () => showStep(4));

  // ---------- Step 1: photos ----------
  async function loadAndDownscale(file, maxDim) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return bitmap;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await createImageBitmap(canvas);
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    for (const file of files) {
      if (state.photos.length >= MAX_PHOTOS) break;
      try {
        const bitmap = await loadAndDownscale(file, MAX_PHOTO_DIM);
        state.photos.push({ bitmap, name: file.name });
      } catch (err) {
        console.error("Failed to load", file.name, err);
      }
    }
    renderThumbs();
  }

  function renderThumbs() {
    thumbsList.innerHTML = "";
    state.photos.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "thumb";
      li.draggable = true;
      li.dataset.index = String(i);

      const canvas = document.createElement("canvas");
      const maxThumb = 160;
      const scale = Math.min(1, maxThumb / Math.max(p.bitmap.width, p.bitmap.height));
      canvas.width = Math.round(p.bitmap.width * scale);
      canvas.height = Math.round(p.bitmap.height * scale);
      canvas.getContext("2d").drawImage(p.bitmap, 0, 0, canvas.width, canvas.height);

      const label = document.createElement("span");
      label.textContent = i === 0 ? "wide (1st)" : `#${i + 1}`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `Remove ${p.name}`);
      removeBtn.addEventListener("click", () => {
        state.photos.splice(i, 1);
        renderThumbs();
      });

      li.appendChild(canvas);
      li.appendChild(label);
      li.appendChild(removeBtn);
      thumbsList.appendChild(li);
    });

    toStep2Btn.disabled = state.photos.length < 1;
    attachDragReorder();
  }

  function attachDragReorder() {
    let dragIndex = null;
    thumbsList.querySelectorAll(".thumb").forEach((li) => {
      li.addEventListener("dragstart", () => {
        dragIndex = Number(li.dataset.index);
        li.classList.add("dragging");
      });
      li.addEventListener("dragend", () => li.classList.remove("dragging"));
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const dropIndex = Number(li.dataset.index);
        if (dragIndex === null || dragIndex === dropIndex) return;
        const [moved] = state.photos.splice(dragIndex, 1);
        state.photos.splice(dropIndex, 0, moved);
        renderThumbs();
      });
    });
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });

  // ---------- Step 2: home render ----------
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      const which = btn.dataset.tab;
      tabAi.hidden = which !== "ai";
      tabUpload.hidden = which !== "upload";
    });
  });

  function buildRenderPrompt(style, notes) {
    let prompt =
      `Using the attached photo of a vacant land lot, generate a photorealistic rendering ` +
      `of a finished ${style} home placed on this exact lot. Keep the exact lot, terrain, ` +
      `tree line, and lighting from the input photo. Place a single finished home on the ` +
      `buildable clearing (on the foundation if one is visible), photorealistic, matching ` +
      `perspective and golden-hour light.`;
    if (notes && notes.trim()) {
      prompt += ` Additional notes: ${notes.trim()}.`;
    }
    prompt += ` No people, no cars, no text.`;
    return prompt;
  }

  async function bitmapToBase64Jpeg(bitmap, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return dataUrl.split(",")[1];
  }

  async function callGeminiRender(key, model, heroBitmap, prompt) {
    const base64 = await bitmapToBase64Jpeg(heroBitmap, MAX_RENDER_INPUT_DIM);
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
            { text: prompt },
          ],
        },
      ],
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error("Couldn't reach Google's API. Check your internet connection and try again.");
    }
    if (!res.ok) {
      let msg = `Request failed (HTTP ${res.status}).`;
      if (res.status === 400) msg = "Google rejected the request (bad API key or malformed request).";
      if (res.status === 401 || res.status === 403) msg = "That API key was rejected. Double-check you pasted it correctly.";
      if (res.status === 429) msg = "Rate limit / quota exceeded for this key. Try again later.";
      try {
        const errJson = await res.json();
        if (errJson && errJson.error && errJson.error.message) msg = errJson.error.message;
      } catch (e) {
        /* ignore parse failure, keep default msg */
      }
      throw new Error(msg);
    }
    const json = await res.json();
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (inline && inline.data) {
        return { mimeType: inline.mimeType || inline.mime_type || "image/png", data: inline.data };
      }
    }
    return null;
  }

  function base64ToBlob(base64, mimeType) {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  }

  generateRenderBtn.addEventListener("click", async () => {
    const key = geminiKeyInput.value.trim();
    if (!key) {
      renderStatus.textContent = "Paste your Gemini API key above first.";
      return;
    }
    if (state.photos.length < 1) {
      renderStatus.textContent = "Add at least one land photo first.";
      return;
    }
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
    const model = DEFAULT_MODEL;
    const prompt = buildRenderPrompt(homeStyle.value, homeNotes.value);
    const hero = state.photos[0].bitmap;

    generateRenderBtn.disabled = true;
    renderStatus.textContent = "Generating render…";
    try {
      let result = await callGeminiRender(key, model, hero, prompt);
      if (!result) {
        renderStatus.textContent = "No image returned, retrying…";
        result = await callGeminiRender(key, model, hero, prompt + " Return only an image, no text.");
      }
      if (!result) {
        renderStatus.textContent = "The model didn't return an image. Try again, or upload your own render.";
        return;
      }
      const blob = base64ToBlob(result.data, result.mimeType);
      const bitmap = await createImageBitmap(blob);
      state.render = bitmap;
      state.renderSource = "ai";
      renderPreview.src = URL.createObjectURL(blob);
      renderPreview.hidden = false;
      renderStatus.textContent = "Render ready. You can regenerate or continue.";
    } catch (err) {
      renderStatus.textContent = `Error: ${err.message}`;
    } finally {
      generateRenderBtn.disabled = false;
    }
  });

  renderFileInput.addEventListener("change", async () => {
    const file = renderFileInput.files[0];
    if (!file) return;
    const bitmap = await loadAndDownscale(file, MAX_PHOTO_DIM);
    state.render = bitmap;
    state.renderSource = "upload";
    uploadPreview.src = URL.createObjectURL(file);
    uploadPreview.hidden = false;
  });

  // ---------- Step 3: preview ----------
  let previewRafId = null;
  let previewPlan = null;
  let previewNeedsRebuild = true;

  secondsRange.addEventListener("input", () => {
    state.seconds = Number(secondsRange.value);
    secondsValue.textContent = `${state.seconds}s`;
    previewNeedsRebuild = true;
  });
  labelInput.addEventListener("input", () => {
    state.label = labelInput.value || "AI RENDERING OF FINISHED HOME";
    previewNeedsRebuild = true;
  });

  function startPreviewLoop() {
    previewNeedsRebuild = true;
    const ctx = previewCanvas.getContext("2d");
    let frameIndex = 0;
    let lastTime = performance.now();
    const frameDuration = 1000 / FPS;

    function loop(now) {
      if (previewNeedsRebuild) {
        if (state.photos.length > 0) {
          previewPlan = buildShotPlan(
            state.photos.map((p) => p.bitmap),
            state.render,
            PREVIEW_W, PREVIEW_H, FPS, state.seconds, state.label
          );
          frameIndex = 0;
        } else {
          previewPlan = null;
        }
        previewNeedsRebuild = false;
      }
      if (previewPlan && now - lastTime >= frameDuration) {
        lastTime = now;
        previewPlan.drawFrame(ctx, frameIndex);
        frameIndex = (frameIndex + 1) % previewPlan.totalFrames;
      }
      previewRafId = requestAnimationFrame(loop);
    }
    previewRafId = requestAnimationFrame(loop);
  }

  function stopPreviewLoop() {
    if (previewRafId) cancelAnimationFrame(previewRafId);
    previewRafId = null;
  }

  // ---------- Step 4: export ----------
  function pickVideoEncoderConfig(width, height) {
    const candidates = ["avc1.42003e", "avc1.42001f", "avc1.640033"];
    return candidates; // caller tries each with isConfigSupported
  }

  async function findSupportedConfig(width, height, fps) {
    if (typeof VideoEncoder === "undefined") return null;
    for (const codec of pickVideoEncoderConfig(width, height)) {
      const config = { codec, width, height, framerate: fps, bitrate: 8_000_000 };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support && support.supported) return config;
      } catch (e) {
        /* try next candidate */
      }
    }
    return null;
  }

  function setProgress(pct) {
    progressWrap.hidden = false;
    exportProgress.value = pct;
    exportProgressLabel.textContent = `${Math.round(pct)}%`;
  }

  async function exportWithWebCodecs(config, plan, canvas, ctx) {
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: EXPORT_W, height: EXPORT_H, frameRate: FPS },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error("VideoEncoder error", e),
    });
    encoder.configure(config);

    const frameDurationUs = Math.round(1e6 / FPS);
    for (let i = 0; i < plan.totalFrames; i++) {
      plan.drawFrame(ctx, i);
      const frame = new VideoFrame(canvas, { timestamp: i * frameDurationUs, duration: frameDurationUs });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      if (i % 5 === 0) {
        setProgress((i / plan.totalFrames) * 100);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const { buffer } = muxer.target;
    return new Blob([buffer], { type: "video/mp4" });
  }

  async function exportWithMediaRecorder(plan, canvas, ctx) {
    const stream = canvas.captureStream(0); // manual frame pushes
    const track = stream.getVideoTracks()[0];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();

    // Schedule against an absolute clock (not per-frame deltas) so a slow
    // frame's overshoot is recovered on later frames instead of drifting the
    // total recorded duration away from the intended reel length.
    const frameDurationMs = 1000 / FPS;
    const t0 = performance.now();
    for (let i = 0; i < plan.totalFrames; i++) {
      plan.drawFrame(ctx, i);
      if (typeof track.requestFrame === "function") track.requestFrame();
      if (i % 5 === 0) {
        setProgress((i / plan.totalFrames) * 100);
      }
      const target = t0 + (i + 1) * frameDurationMs;
      const wait = Math.max(0, target - performance.now());
      await new Promise((r) => setTimeout(r, wait));
    }
    recorder.stop();
    await done;
    return new Blob(chunks, { type: "video/webm" });
  }

  exportBtn.addEventListener("click", async () => {
    if (state.photos.length < 1) {
      exportStatus.textContent = "Add at least one photo first.";
      return;
    }
    exportBtn.disabled = true;
    downloadsWrap.hidden = true;
    exportStatus.textContent = "Preparing…";
    setProgress(0);

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    const ctx = canvas.getContext("2d");

    const plan = buildShotPlan(
      state.photos.map((p) => p.bitmap),
      state.render,
      EXPORT_W, EXPORT_H, FPS, state.seconds, state.label
    );

    try {
      let blob;
      const config = await findSupportedConfig(EXPORT_W, EXPORT_H, FPS);
      if (config) {
        exportStatus.textContent = "Encoding H.264 MP4…";
        blob = await exportWithWebCodecs(config, plan, canvas, ctx);
        downloadVideo.download = "reel.mp4";
      } else if (typeof MediaRecorder !== "undefined" && canvas.captureStream) {
        exportStatus.textContent = "This browser doesn't support WebCodecs — falling back to WebM…";
        blob = await exportWithMediaRecorder(plan, canvas, ctx);
        downloadVideo.download = "reel.webm";
      } else {
        exportStatus.textContent =
          "Your browser doesn't support in-browser video export. Please use a recent Chrome, Edge, or Android Chrome.";
        return;
      }

      setProgress(100);
      const videoUrl = URL.createObjectURL(blob);
      downloadVideo.href = videoUrl;

      const coverCanvas = document.createElement("canvas");
      coverCanvas.width = EXPORT_W;
      coverCanvas.height = EXPORT_H;
      const coverCtx = coverCanvas.getContext("2d");
      const hasCover = plan.drawCoverFrame(coverCtx);
      if (!hasCover) {
        plan.drawFrame(coverCtx, plan.totalFrames - 1);
      }
      const coverBlob = await new Promise((resolve) => coverCanvas.toBlob(resolve, "image/jpeg", 0.92));
      downloadCover.href = URL.createObjectURL(coverBlob);

      downloadsWrap.hidden = false;
      exportStatus.textContent = "Done!";
    } catch (err) {
      console.error(err);
      exportStatus.textContent = `Export failed: ${err.message}`;
    } finally {
      exportBtn.disabled = false;
    }
  });

  // ---------- capability check on load ----------
  (function checkCapabilities() {
    if (typeof VideoEncoder === "undefined" && (typeof MediaRecorder === "undefined")) {
      const notice = document.createElement("p");
      notice.className = "status warning";
      notice.textContent =
        "This browser doesn't support in-browser video export (no WebCodecs, no MediaRecorder). " +
        "Please switch to a recent Chrome, Edge, or Android Chrome to export a reel.";
      document.querySelector("main").prepend(notice);
    }
  })();

  showStep(1);
})();
