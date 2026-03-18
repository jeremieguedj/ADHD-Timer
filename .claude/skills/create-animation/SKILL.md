---
name: create-animation
description: Create new bunny sprite sheet animations for the ADHD Timer extension from Veo 3.1 video clips. Use when adding a new bunny pose, regenerating existing animations, creating character animations, or when the user mentions Veo, sprite sheets, or bunny animations. Also use when the user wants to understand the animation pipeline or troubleshoot sprite rendering issues.
disable-model-invocation: true
argument-hint: [pose-name] [description of what the bunny does]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Create Animation — Veo 3.1 to Sprite Sheet Pipeline

This skill walks through the full pipeline for creating animated bunny sprite sheets from AI-generated video. The process has been refined through real production use and handles the specific constraints of Chrome extensions overlaying on Netflix.

## Why sprite sheets (not video)

Netflix has strict CSP headers that can block `<video>` elements injected by extensions. Browser autoplay restrictions would prevent on-demand playback. CSS `steps()` animation on a sprite sheet has zero restrictions, works in fullscreen, and gives frame-level playback control — critical because the bunny needs to walk in, pause, and walk out on demand.

## Pipeline Overview

```
Veo 3.1 prompt → MP4 video → ffmpeg frame extraction → rembg background removal
→ PIL auto-crop + center → sprite sheet PNG → CSS steps() animation
```

Each step is detailed below. The bundled `scripts/build_sprite.py` automates Steps 2–5.

---

## Step 1: Craft the Veo Prompt

Every prompt has three parts: **character reference** (identical every time for consistency), **action description** (unique per animation), and **technical suffix** (identical every time for clean processing).

### Character Reference (paste verbatim at the start)

```
A cute white cartoon bunny character with long upright ears with pink insides, round head, big round black eyes with white shine spots, small pink oval nose, pink rosy cheeks, a small gentle smile, soft round white body, small round paws, and short stubby feet.
```

### Action Description (the creative part)

This is where you describe what the bunny does. Be extremely specific about:

- **Body mechanics**: Squash on landing (body compresses wider/shorter), stretch on jumping (body elongates taller/narrower). These make animation feel alive.
- **Ear physics**: Ears should have a slight delay — they flop after each movement, then spring back upright. Specify droop angle for sleepy poses.
- **Facial expression**: Eye shape (wide open, half-closed, closed arcs for happy), mouth shape (small smile, open excited, round yawn O), cheek intensity.
- **Arm/paw positions**: Raised waving, hanging relaxed, swinging with walk. Specify left/right independently if asymmetric.
- **Movement**: Left-to-right for walks, stationary for celebrations, rising from below for greetings. Specify if it should cover the full frame.
- **Camera**: Side profile for walks, front-facing for stationary animations, specify locked/no movement.
- **Duration**: 3–5 seconds is ideal. Longer wastes frames; shorter may not complete a cycle.
- **Loopability**: Say "seamless loopable cycle" for walks/idles, omit for one-shot animations.

### Technical Suffix (paste verbatim at the end)

```
Solid flat bright green (#00FF00) background with no shadows, no ground plane, no props, no other elements. Flat 2D cel-shaded animation style, clean vector-like outlines, consistent line weight, no gradients on the background. [duration] long, 24fps.
```

### Example: Complete Prompt

```
A cute white cartoon bunny character with long upright ears with pink insides, round head, big round black eyes with white shine spots, small pink oval nose, pink rosy cheeks, a small gentle smile, soft round white body, small round paws, and short stubby feet. The bunny walks from left to right across the frame in a cheerful bouncy hop cycle. Each step has a visible squash when the foot lands (body compresses slightly wider and shorter) and a stretch when pushing off (body elongates slightly taller and narrower). The ears bounce with a slight delay after each hop, flopping gently then returning upright. Arms swing naturally with the walk, opposite arm to opposite leg. The tail (a small white round puff on the back) bobs with each step. The bunny maintains a happy expression throughout with its mouth in a small upward curve. The walk covers the full frame from left edge to right edge. Solid flat bright green (#00FF00) background with no shadows, no ground plane, no props, no other elements. Flat 2D cel-shaded animation style, clean vector-like outlines, consistent line weight, no gradients on the background. 4 seconds long, 24fps, seamless loopable walk cycle.
```

### Troubleshooting Veo Output

| Problem | Fix |
|---|---|
| 3D/shaded look instead of flat 2D | Add: `no 3D lighting, no specular highlights, flat color fills only` |
| Green spilling onto bunny edges | Switch to: `bright magenta (#FF00FF) background` |
| Character inconsistency across clips | Re-roll — Veo is non-deterministic. Generate 3–4 variations and pick the most consistent one. |
| Camera moving | Add: `camera locked, no camera movement, no zoom, no pan` |

### Tell the user

Present the complete prompt and ask them to generate it in Veo 3.1. Recommend generating 3–4 variations and picking the one with the cleanest green separation and most consistent character design.

---

## Step 2: Process Video into Sprite Sheet

Once the user provides the video file path, run the bundled build script:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/build_sprite.py \
  "<video_path>" \
  "<output_name>" \
  --output-dir "<project_root>/icons" \
  --fps 24 \
  --max-frames 24 \
  --target-height 200
```

**Arguments:**
- `video_path`: Path to the Veo MP4 file
- `output_name`: Name for the sprite (e.g., `bunny-dance`). Creates `<output_name>-sprite.png`
- `--output-dir`: Where to save the sprite sheet (default: current directory)
- `--fps`: Frame extraction rate (default: 24). Higher = more frames to choose from.
- `--max-frames`: Frames in the final sprite sheet (default: 24). 24 is the sweet spot — smooth enough, small enough.
- `--target-height`: Pixel height per frame (default: 200). Matches existing sprites.
- `--walk`: Flag to use middle 50% of video frames (for walk cycles). Omit for stationary animations.

**What it does internally:**
1. Extracts frames at the specified fps using ffmpeg
2. Removes backgrounds using rembg (AI-based, u2net model — handles non-uniform green well)
3. Auto-crops each frame to the bunny's bounding box
4. Centers each bunny in a uniform-size frame (max dimensions + padding)
5. Scales to target height
6. Assembles into a horizontal sprite sheet PNG
7. Prints the exact CSS/JS values needed for integration

**Dependencies:** `pip3 install rembg pillow onnxruntime` and `ffmpeg` (via homebrew).

**Processing time:** ~2 frames/sec for background removal. A 24fps, 8-second video produces ~192 frames, taking ~2 minutes. The script selects 24 frames from the best section.

---

## Step 3: Integrate into the Extension

The build script prints output like:

```
Sprite: 2976x200, 24 frames @ 124x200, 508KB
```

Use these values to integrate:

### 3a. Add to SPRITES config in content.js

```javascript
const SPRITES = {
  // ... existing sprites ...
  newpose: { file: 'icons/<name>-sprite.png', fw: <frameWidth>, fh: <frameHeight>, frames: 24, sw: <sheetWidth>, duration: '<duration>' },
};
```

**Duration guidelines** (how long one full cycle takes):
- Energetic actions (jumping, waving, celebrating): `'2s'` = 12fps
- Normal actions (walking, greeting): `'2s'` = 12fps
- Slow/calm actions (sleepy, yawning, drowsy): `'3s'` = 8fps

The CSS is injected dynamically by `injectSpriteStyles()` using `chrome.runtime.getURL()` — no CSS file changes needed.

### 3b. Verify web_accessible_resources

The manifest already uses a wildcard: `"icons/bunny-*-sprite.png"`. As long as your file follows this naming convention, no manifest changes needed.

### 3c. Wire up the new pose

Depending on what the animation is for:
- **Walk-across reminders**: Add a case in `showBunnyReminder()` that calls `setBunnyPose('newpose')`
- **Done page**: Update `done.js` `setupCelebrationSprite()` with the new sprite values
- **New UI element**: Create the appropriate HTML element with class `bunny-sprite bunny-sprite-newpose`

### 3d. For the done page specifically

The done page runs as an extension page (not content script), so it uses `chrome.runtime.getURL()` in `done.js` to inject the sprite CSS. Update `setupCelebrationSprite()` with the new sprite dimensions if replacing the celebration animation.

---

## Step 4: Verify

Add a test block to `test-sprites.html`:

```html
<h2>New Animation Name</h2>
<div class="sprite-container">
  <div style="width: <fw>px; height: <fh>px;
    background: url('icons/<name>-sprite.png') 0 0 no-repeat;
    background-size: <sw>px <fh>px;
    animation: sprite-new <duration> steps(24) infinite;"></div>
</div>
```

Serve locally (`python3 -m http.server 8766`) and open `http://localhost:8766/test-sprites.html` to verify:
- Animation is smooth (not jittery)
- Transparency is clean (no green fringe)
- Character is centered (not jumping around between frames)
- Speed feels natural for the intended emotion

---

## Current Sprites Reference

| Pose | File | Frame Size | Frames | Sheet Size | Duration | Used For |
|------|------|-----------|--------|------------|----------|----------|
| happy | bunny-walk-sprite.png | 124x200 | 24 | 2976x200 | 2s | Early reminders (50%, 25%, 10min) |
| sleepy | bunny-sleepy-sprite.png | 136x200 | 24 | 3264x200 | 3s | Late reminders (5min, 90sec) |
| wave | bunny-celebrate-sprite.png | 185x200 | 24 | 4440x200 | 2s | Done/celebration page |
| greeting | bunny-greeting-sprite.png | 139x200 | 24 | 3336x200 | 2s | Available for future use |
