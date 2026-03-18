#!/usr/bin/env python3
"""
Build a sprite sheet from a Veo 3.1 video clip.
Pipeline: extract frames → remove background → auto-crop → center → scale → assemble.

Usage:
  python3 build_sprite.py <video_path> <output_name> [options]

Example:
  python3 build_sprite.py "videos/bunny-dance.mp4" "bunny-dance" --output-dir icons --walk
"""
import argparse
import glob
import os
import subprocess
import tempfile
from PIL import Image

def extract_frames(video_path, output_dir, fps):
    os.makedirs(output_dir, exist_ok=True)
    existing = glob.glob(f"{output_dir}/frame_*.png")
    if existing:
        print(f"  Using {len(existing)} previously extracted frames")
        return
    subprocess.run(
        ["ffmpeg", "-i", video_path, "-vf", f"fps={fps}", f"{output_dir}/frame_%03d.png"],
        capture_output=True,
    )
    count = len(glob.glob(f"{output_dir}/frame_*.png"))
    print(f"  Extracted {count} frames at {fps}fps")


def remove_backgrounds(input_dir, output_dir):
    from rembg import remove

    os.makedirs(output_dir, exist_ok=True)
    frames = sorted(glob.glob(f"{input_dir}/frame_*.png"))
    total = len(frames)
    processed = 0
    for path in frames:
        out_path = os.path.join(output_dir, os.path.basename(path))
        if os.path.exists(out_path):
            processed += 1
            continue
        img = Image.open(path)
        result = remove(img)
        result.save(out_path)
        processed += 1
        if processed % 10 == 0 or processed == total:
            print(f"  Background removal: {processed}/{total}")
    print(f"  Background removal complete")


def build_sprite_sheet(nobg_dir, output_path, max_frames, target_height, is_walk):
    frames_paths = sorted(glob.glob(f"{nobg_dir}/frame_*.png"))
    if not frames_paths:
        print("  ERROR: No frames found after background removal")
        return None

    # Get bounding boxes
    frame_data = []
    for path in frames_paths:
        img = Image.open(path).convert("RGBA")
        alpha = img.split()[3]
        bbox = alpha.getbbox()
        if bbox:
            frame_data.append((path, bbox))

    if not frame_data:
        print("  ERROR: No non-transparent content found in any frame")
        return None

    # Find max bunny dimensions
    max_w = max(b[2] - b[0] for _, b in frame_data)
    max_h = max(b[3] - b[1] for _, b in frame_data)
    pad = 10
    frame_w = max_w + pad * 2
    frame_h = max_h + pad * 2

    # Select frames
    if is_walk:
        # For walks: use middle 50% for most consistent animation
        start = len(frame_data) // 4
        end = 3 * len(frame_data) // 4
        selected = frame_data[start:end]
    else:
        selected = frame_data

    # Evenly sample to max_frames
    if len(selected) > max_frames:
        step = len(selected) / max_frames
        selected = [selected[int(i * step)] for i in range(max_frames)]

    print(f"  Selected {len(selected)} frames, raw size: {frame_w}x{frame_h}")

    # Center each bunny in uniform frame
    centered = []
    for path, bbox in selected:
        img = Image.open(path).convert("RGBA")
        bunny = img.crop(bbox)
        bw, bh = bunny.size
        frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        x_off = (frame_w - bw) // 2
        y_off = (frame_h - bh) // 2
        frame.paste(bunny, (x_off, y_off), bunny)
        centered.append(frame)

    # Scale to target height
    scale = target_height / frame_h
    scaled_w = int(frame_w * scale)
    scaled_h = target_height

    scaled_frames = [f.resize((scaled_w, scaled_h), Image.LANCZOS) for f in centered]

    # Build horizontal sprite sheet
    sheet_w = scaled_w * len(scaled_frames)
    sprite_sheet = Image.new("RGBA", (sheet_w, scaled_h), (0, 0, 0, 0))
    for i, frame in enumerate(scaled_frames):
        sprite_sheet.paste(frame, (i * scaled_w, 0), frame)

    sprite_sheet.save(output_path, "PNG", optimize=True)
    file_size = os.path.getsize(output_path) / 1024

    print(f"\n  === RESULT ===")
    print(f"  Sprite sheet: {output_path}")
    print(f"  Dimensions: {sheet_w}x{scaled_h}, {len(scaled_frames)} frames @ {scaled_w}x{scaled_h}")
    print(f"  File size: {file_size:.0f}KB")
    print(f"\n  === FOR content.js SPRITES config ===")
    print(f"  fw: {scaled_w}, fh: {scaled_h}, frames: {len(scaled_frames)}, sw: {sheet_w}")
    print(f"  Suggested duration: '2s' (12fps) or '3s' (8fps for slow/sleepy)")

    return {
        "width": scaled_w,
        "height": scaled_h,
        "frames": len(scaled_frames),
        "sheetWidth": sheet_w,
    }


def main():
    parser = argparse.ArgumentParser(description="Build sprite sheet from Veo video")
    parser.add_argument("video_path", help="Path to the Veo MP4 file")
    parser.add_argument("output_name", help="Name for the sprite (e.g., bunny-dance)")
    parser.add_argument("--output-dir", default=".", help="Output directory for sprite sheet")
    parser.add_argument("--fps", type=int, default=24, help="Frame extraction rate")
    parser.add_argument("--max-frames", type=int, default=24, help="Max frames in sprite sheet")
    parser.add_argument("--target-height", type=int, default=200, help="Pixel height per frame")
    parser.add_argument("--walk", action="store_true", help="Use middle 50%% of frames (for walk cycles)")
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"ERROR: Video not found: {args.video_path}")
        return

    # Create temp working directory
    work_dir = tempfile.mkdtemp(prefix=f"sprite-{args.output_name}-")
    frames_dir = os.path.join(work_dir, "frames")
    nobg_dir = os.path.join(work_dir, "nobg")
    output_path = os.path.join(args.output_dir, f"{args.output_name}-sprite.png")

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"Processing: {args.video_path}")
    print(f"Output: {output_path}")
    print(f"Working dir: {work_dir}")

    print("\nStep 1: Extracting frames...")
    extract_frames(args.video_path, frames_dir, args.fps)

    print("\nStep 2: Removing backgrounds (this takes a while)...")
    remove_backgrounds(frames_dir, nobg_dir)

    print("\nStep 3: Building sprite sheet...")
    build_sprite_sheet(nobg_dir, output_path, args.max_frames, args.target_height, args.walk)

    print(f"\nDone! Temp files in {work_dir} can be deleted.")


if __name__ == "__main__":
    main()
