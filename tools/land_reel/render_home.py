#!/usr/bin/env python3
"""Generate an AI rendering of a finished home placed on a vacant-land photo.

Usage:
    python render_home.py --photo hero_land_photo.jpg --prompt "<render prompt>" \
        --out render.png [--model gemini-2.5-flash-image]

Requires GEMINI_API_KEY in the environment. If it is missing, prints
instructions and exits with code 2 so callers can distinguish "no key" from
a real crash and fall back to make_reel.py --render <your own image>.
"""
import argparse
import mimetypes
import os
import sys

DEFAULT_MODEL = "gemini-2.5-flash-image"


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--photo", required=True, help="Hero land photo to use as reference")
    parser.add_argument("--prompt", required=True, help="Full render prompt describing the finished home")
    parser.add_argument("--out", required=True, help="Output image path")
    parser.add_argument(
        "--model",
        default=os.environ.get("LAND_REEL_IMAGE_MODEL", DEFAULT_MODEL),
        help="Gemini image model id (default: %(default)s, override with LAND_REEL_IMAGE_MODEL)",
    )
    return parser


def no_key_message():
    return (
        "GEMINI_API_KEY is not set in this environment.\n\n"
        "You have two options:\n"
        "  (a) Set the key and re-run:\n"
        "        export GEMINI_API_KEY=<your key>\n"
        "        python tools/land_reel/render_home.py --photo <photo> --prompt \"<prompt>\" --out render.png\n"
        "  (b) Supply your own render image instead of generating one:\n"
        "        python tools/land_reel/make_reel.py --photos <photos...> --render <your_render.png> --out out/reel.mp4\n"
    )


def main(argv=None):
    args = build_parser().parse_args(argv)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(no_key_message(), file=sys.stderr)
        return 2

    if not os.path.isfile(args.photo):
        print(f"Photo not found: {args.photo}", file=sys.stderr)
        return 1

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print(
            "google-genai is not installed. Install it with:\n"
            "  pip install google-genai",
            file=sys.stderr,
        )
        return 1

    with open(args.photo, "rb") as f:
        photo_bytes = f.read()
    mime_type = mimetypes.guess_type(args.photo)[0] or "image/jpeg"

    client = genai.Client(api_key=api_key)

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(data=photo_bytes, mime_type=mime_type),
                types.Part.from_text(text=args.prompt),
            ],
        )
    ]

    print(f"Requesting render from model '{args.model}'...", file=sys.stderr)
    response = client.models.generate_content(model=args.model, contents=contents)

    image_bytes = None
    out_mime = "image/png"
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            inline = getattr(part, "inline_data", None)
            if inline is not None and inline.data:
                image_bytes = inline.data
                out_mime = inline.mime_type or out_mime
                break
        if image_bytes:
            break

    if not image_bytes:
        print(
            "The model did not return an image. Try adjusting --prompt and re-running, "
            "or supply your own render via make_reel.py --render.",
            file=sys.stderr,
        )
        return 1

    ext = mimetypes.guess_extension(out_mime) or ".png"
    out_path = args.out
    if not os.path.splitext(out_path)[1]:
        out_path += ext

    with open(out_path, "wb") as f:
        f.write(image_bytes)

    print(f"Saved render to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
