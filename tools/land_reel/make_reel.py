#!/usr/bin/env python3
"""Assemble a vertical listing reel from land photos and (optionally) an AI render.

No AI/API keys required -- pure numpy/OpenCV/PIL frame pipeline + ffmpeg encode.

Usage:
    python make_reel.py --photos land1.jpg land2.jpg [land3.jpg ...] \
        [--render render.png] --out out/reel.mp4 \
        [--label "AI RENDERING OF FINISHED HOME"] \
        [--size 1080x1920] [--fps 30] [--seconds 10]
"""
import argparse
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    import cv2
except ImportError:
    print("opencv-python-headless is required: pip install opencv-python-headless", file=sys.stderr)
    raise

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None

DEJAVU_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]

LAND_FRACTION = 0.625
WHIP_SECONDS = 0.7
ZOOM_IN_START, ZOOM_IN_END = 1.00, 1.12
ZOOM_OUT_START, ZOOM_OUT_END = 1.10, 1.00
DRIFT_FRAC = 0.06          # fraction of zoomed crop width used for per-photo drift
WHIP_PAN_FRAC = 0.20       # fraction of image width used for the whip pan
MAX_BLUR_FRAC = 0.05       # fraction of output width for the max horizontal blur kernel
PILL_FADE_SECONDS = 0.4


def ease(t):
    """Smoothstep ease-in-out."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def load_image_rgb(path):
    img = Image.open(path).convert("RGB")
    return np.asarray(img)


def cover_crop_size(img_w, img_h, target_ratio):
    """Largest crop box matching target_ratio (w/h) that fits inside the image."""
    if img_w / img_h > target_ratio:
        crop_h = img_h
        crop_w = img_h * target_ratio
    else:
        crop_w = img_w
        crop_h = img_w / target_ratio
    return crop_w, crop_h


def crop_and_resize(img, cx, cy, crop_w, crop_h, out_w, out_h):
    img_h, img_w = img.shape[:2]
    crop_w = min(crop_w, img_w)
    crop_h = min(crop_h, img_h)
    cx = min(max(cx, crop_w / 2), img_w - crop_w / 2)
    cy = min(max(cy, crop_h / 2), img_h - crop_h / 2)

    x0 = int(round(cx - crop_w / 2))
    y0 = int(round(cy - crop_h / 2))
    x1 = min(img_w, x0 + int(round(crop_w)))
    y1 = min(img_h, y0 + int(round(crop_h)))
    x0 = max(0, x1 - int(round(crop_w)))
    y0 = max(0, y1 - int(round(crop_h)))

    patch = img[y0:y1, x0:x1]
    if out_w is None or out_h is None:
        return patch
    resized = cv2.resize(patch, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
    return resized


def horizontal_blur(frame, kernel):
    kernel = int(kernel)
    if kernel <= 1:
        return frame
    if kernel % 2 == 0:
        kernel += 1
    return cv2.blur(frame, (kernel, 1))


class LandPlan:
    """Precomputed Ken Burns crop parameters for one land photo segment."""

    def __init__(self, img, ratio, direction):
        h, w = img.shape[:2]
        self.img = img
        self.img_w, self.img_h = w, h
        self.ratio = ratio
        self.direction = direction
        self.base_cw, self.base_ch = cover_crop_size(w, h, ratio)

    def crop_at(self, zoom, drift_t):
        crop_w = self.base_cw / zoom
        crop_h = self.base_ch / zoom
        max_drift = max(0.0, (self.img_w - crop_w) / 2)
        drift = min(max_drift, crop_w * DRIFT_FRAC) * self.direction * drift_t
        cx = self.img_w / 2 + drift
        cy = self.img_h / 2
        return cx, cy, crop_w, crop_h

    def frame_at(self, zoom, drift_t, out_w, out_h, extra_dx=0.0):
        cx, cy, crop_w, crop_h = self.crop_at(zoom, drift_t)
        cx += extra_dx
        return crop_and_resize(self.img, cx, cy, crop_w, crop_h, out_w, out_h)


class RenderPlan:
    def __init__(self, img, ratio):
        h, w = img.shape[:2]
        self.img = img
        self.img_w, self.img_h = w, h
        self.ratio = ratio
        self.base_cw, self.base_ch = cover_crop_size(w, h, ratio)

    def frame_at(self, zoom, extra_dx=0.0):
        crop_w = self.base_cw / zoom
        crop_h = self.base_ch / zoom
        cx = self.img_w / 2 + extra_dx
        cy = self.img_h / 2
        return crop_and_resize(self.img, cx, cy, crop_w, crop_h, None, None)


def find_font(size):
    for path in DEJAVU_BOLD_CANDIDATES:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def build_pill_overlay(out_w, out_h, label):
    """Returns (rgb uint8 array, alpha float32 0..1 array) for the caption pill."""
    margin_x = int(out_w * 0.04)
    margin_y = int(out_h * 0.04)
    max_box_w = out_w - 2 * margin_x

    overlay = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font_size = max(14, int(out_h * 0.028))
    while True:
        font = find_font(font_size)
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        pad_x = int(text_h * 0.9)
        box_w = text_w + 2 * pad_x
        if box_w <= max_box_w or font_size <= 14:
            break
        font_size -= 2

    pad_y = int(text_h * 0.55)
    box_w = min(box_w, max_box_w)
    box_h = text_h + 2 * pad_y
    radius = box_h // 2
    x1 = out_w - margin_x - box_w
    y1 = out_h - margin_y - box_h
    x2 = out_w - margin_x
    y2 = out_h - margin_y

    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=(255, 255, 255, 255))
    text_x = x1 + pad_x - bbox[0]
    text_y = y1 + pad_y - bbox[1]
    draw.text((text_x, text_y), label, font=font, fill=(25, 25, 25, 255))

    arr = np.asarray(overlay).astype(np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3] / 255.0
    return rgb, alpha


def apply_pill(frame, pill_rgb, pill_alpha, fade):
    if fade <= 0:
        return frame
    a = (pill_alpha * fade)[..., None]
    out = frame.astype(np.float32) * (1 - a) + pill_rgb * a
    return np.clip(out, 0, 255).astype(np.uint8)


def build_frames(photos, render, out_w, out_h, fps, seconds, label):
    """Generator yielding RGB uint8 frames (out_h, out_w, 3), plus metadata dict."""
    ratio = out_w / out_h
    total_frames = int(round(fps * seconds))
    whip_frames = int(round(fps * WHIP_SECONDS)) if render is not None else 0

    if render is not None:
        land_frames_total = int(round(total_frames * LAND_FRACTION))
        render_frames_total = total_frames - land_frames_total - whip_frames
        if render_frames_total < 1:
            render_frames_total = 1
    else:
        land_frames_total = total_frames
        render_frames_total = 0

    n_photos = len(photos)
    base = land_frames_total // n_photos
    remainder = land_frames_total - base * n_photos
    per_photo = [base + (1 if i < remainder else 0) for i in range(n_photos)]

    land_plans = [
        LandPlan(img, ratio, direction=(1 if i % 2 == 0 else -1))
        for i, img in enumerate(photos)
    ]

    meta = {
        "land_frames_total": land_frames_total,
        "whip_frames": whip_frames,
        "render_frames_total": render_frames_total,
        "total_frames": total_frames,
        "render_segment_start": land_frames_total + whip_frames,
    }

    pill_rgb = pill_alpha = None
    pill_fade_frames = max(1, int(round(fps * PILL_FADE_SECONDS)))
    if render is not None:
        pill_rgb, pill_alpha = build_pill_overlay(out_w, out_h, label)

    def gen():
        # --- land segments ---
        last_land_frame = None
        last_plan = None
        last_zoom_end = None
        last_drift_t_end = None
        for i, plan in enumerate(land_plans):
            n = per_photo[i]
            for f in range(n):
                t = ease(f / max(1, n - 1))
                zoom = ZOOM_IN_START + (ZOOM_IN_END - ZOOM_IN_START) * t
                frame = plan.frame_at(zoom, t, out_w, out_h)
                if i == len(land_plans) - 1 and f == n - 1:
                    last_land_frame = frame
                    last_plan = plan
                    last_zoom_end = zoom
                    last_drift_t_end = t
                yield frame

        if render is None:
            return

        # --- whip transition: pan + horizontal blur, crossfading into render ---
        render_plan = RenderPlan(render, ratio)
        max_blur = max(1, int(out_w * MAX_BLUR_FRAC))
        land_dir = last_plan.direction if last_plan is not None else 1

        for i in range(whip_frames):
            t = i / max(1, whip_frames - 1)
            te = ease(t)

            land_extra_dx = land_dir * WHIP_PAN_FRAC * last_plan.img_w * te
            land_zoom = last_zoom_end + 0.04 * te
            land_frame = last_plan.frame_at(land_zoom, last_drift_t_end, out_w, out_h, extra_dx=land_extra_dx)
            land_blur = max_blur * ease(t)
            land_frame = horizontal_blur(land_frame, land_blur)

            render_offset = land_dir * WHIP_PAN_FRAC * render_plan.img_w * (1 - te)
            render_frame_full = render_plan.frame_at(ZOOM_OUT_START, extra_dx=render_offset)
            render_frame = cv2.resize(render_frame_full, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
            render_blur = max_blur * ease(1 - t)
            render_frame = horizontal_blur(render_frame, render_blur)

            alpha = ease(t)
            blended = land_frame.astype(np.float32) * (1 - alpha) + render_frame.astype(np.float32) * alpha
            yield np.clip(blended, 0, 255).astype(np.uint8)

        # --- render segment: zoom-out with caption pill fading in ---
        for i in range(render_frames_total):
            t = ease(i / max(1, render_frames_total - 1))
            zoom = ZOOM_OUT_START + (ZOOM_OUT_END - ZOOM_OUT_START) * t
            frame_full = render_plan.frame_at(zoom)
            frame = cv2.resize(frame_full, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
            fade = min(1.0, i / pill_fade_frames)
            frame = apply_pill(frame, pill_rgb, pill_alpha, fade)
            yield frame

    def cover_frame():
        if render is None:
            return None
        render_plan = RenderPlan(render, ratio)
        frame_full = render_plan.frame_at(ZOOM_OUT_START)
        frame = cv2.resize(frame_full, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
        return apply_pill(frame, pill_rgb, pill_alpha, 1.0)

    return gen, cover_frame, meta


def get_ffmpeg_path():
    if imageio_ffmpeg is None:
        return None
    try:
        path = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([path, "-version"], capture_output=True, check=True, timeout=10)
        return path
    except Exception:
        return None


def encode_with_ffmpeg(ffmpeg_path, frames_gen, out_w, out_h, fps, out_path):
    cmd = [
        ffmpeg_path, "-y",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{out_w}x{out_h}", "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    count = 0
    for frame in frames_gen():
        bgr = frame[..., ::-1]
        proc.stdin.write(np.ascontiguousarray(bgr).tobytes())
        count += 1
    proc.stdin.close()
    stderr = proc.stderr.read()
    ret = proc.wait()
    if ret != 0:
        raise RuntimeError(f"ffmpeg failed with code {ret}: {stderr.decode(errors='replace')[-2000:]}")
    return count


def encode_with_cv2(frames_gen, out_w, out_h, fps, out_path):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_path, fourcc, fps, (out_w, out_h))
    count = 0
    for frame in frames_gen():
        bgr = frame[..., ::-1]
        writer.write(np.ascontiguousarray(bgr))
        count += 1
    writer.release()
    return count


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--photos", required=True, nargs="+", help="Land photos, wide to close")
    parser.add_argument("--render", default=None, help="AI rendering of the finished home")
    parser.add_argument("--out", required=True, help="Output MP4 path")
    parser.add_argument("--label", default="AI RENDERING OF FINISHED HOME")
    parser.add_argument("--size", default="1080x1920", help="WxH, default 1080x1920")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--seconds", type=float, default=10)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)

    out_w, out_h = (int(x) for x in args.size.lower().split("x"))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)

    photos = [load_image_rgb(p) for p in args.photos]
    render = load_image_rgb(args.render) if args.render else None
    if render is None:
        print("No --render supplied: producing a land-only montage, no caption pill.")

    frames_gen, cover_frame_fn, meta = build_frames(
        photos, render, out_w, out_h, args.fps, args.seconds, args.label
    )

    ffmpeg_path = get_ffmpeg_path()
    if ffmpeg_path:
        print(f"Encoding with bundled ffmpeg: {ffmpeg_path}")
        count = encode_with_ffmpeg(ffmpeg_path, frames_gen, out_w, out_h, args.fps, args.out)
    else:
        print("Bundled ffmpeg unavailable; falling back to cv2.VideoWriter (mp4v).")
        count = encode_with_cv2(frames_gen, out_w, out_h, args.fps, args.out)

    print(f"Wrote {count} frames to {args.out} ({out_w}x{out_h} @ {args.fps}fps)")

    cover_path = os.path.join(os.path.dirname(os.path.abspath(args.out)), "cover.jpg")
    cover = cover_frame_fn()
    if cover is None:
        # No render: use the last land frame as the cover.
        last = None
        for last in frames_gen():
            pass
        cover = last
    if cover is not None:
        Image.fromarray(cover).save(cover_path, quality=92)
        print(f"Wrote cover image to {cover_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
