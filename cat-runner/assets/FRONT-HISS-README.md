# Fuwa front-facing hiss reaction v1

## File and provenance

- `fuwa-hiss-front-v1.png`: unchanged built-in image_gen output, generated 2026-11-10.
- Dimensions: **1254 × 1254**, RGBA PNG, **1,972,365 bytes** (about 1.88 MiB).
- Alpha range: **0–255**. Actual transparent background, with 764,469 fully transparent pixels and soft fur-edge alpha.
- Original output: `generated_images/exec-92efd08c-9e3c-44f9-bf41-891dadcb28b1.png`, copied byte-for-byte into this assets directory. No image resizing, recoloring, matte removal, alpha cleanup, or other pixel editing was applied.
- Canonical front reference: https://fuwa.dad/assets/ref/fuwa/fuwa-front.png.
- Canonical standing side reference: https://fuwa.dad/assets/ref/fuwa/fuwa-pose-stand-side.png.
- The front reference was discovered in the real asset listing at https://fuwa.dad/assets/#ref/fuwa before downloading; the URL was not guessed.
- Both canonical reference images and existing `fuwa-generated.png`, `fuwa-motion-v1.png`, and `fuwa-hiss-v1.png` were visually inspected. The canonical front, canonical side, motion atlas, and previous side hiss were supplied to built-in image_gen as references.
- Built-in image_gen was used, not an API/CLI or SVG substitute. Existing assets, including the older side-facing hiss, remain untouched.

## Pose and visual review

One full-body, stationary, braced three-quarter-body pose with the **head and both eyes looking straight at the player/camera**. The pink nose and open mouth face forward, rather than sideways. Swept-back/outward ears, a small open pink mouth with tiny teeth, yellow-green eyes, a cream ruff, warm gray/taupe long fur, compact legs and a large plume tail preserve Fuwa's identity and match the game's painterly sprites.

The image was visually inspected after generation: both eyes are clear, the complete tail and all paws remain in the canvas, and the expression reads as a brief indignant hiss. The tail has a narrow but nonzero left margin. All pixels on the extreme left/top/bottom borders have alpha ≤ 1, so no substantial cat content is cut off.

This is **one static reaction pose**, not a frame-animated turn or animated mouth. The game should briefly stop the running animation, display this front-looking reaction, then resume its existing run loop. A short scale/recoil tween can emphasize the reaction, but does not turn this single illustration into a multi-frame turning animation. Natural perspective puts the rear paws slightly above the lowest front-paw baseline.

## Runtime crop, size and anchor

Pixel bounds below use exclusive right/bottom coordinates:

- All nonzero alpha: `[0, 0, 1253, 1254]`, including distant alpha=1 generation noise.
- Alpha > 1: `[13, 172, 1148, 1128]`.
- Alpha > 8: `[15, 174, 1147, 1125]`.
- Alpha > 32: `[16, 177, 1146, 1125]`.

Recommended **runtime source rectangle**, without editing the PNG:

`x=0, y=150, width=1170, height=1000`.

This keeps every pixel with alpha > 1 and padding, while omitting only remote effectively invisible generated noise. The paws' recommended ground anchor in original coordinates is **y=1124**, or **y=974** within that source rectangle. A simple centered origin is **(0.5, 0.974)**.

For approximately the current running cat's 100-unit visible height, use scale **0.106**: render the cropped source at **124.02 × 106 world units**, with the baseline at **103.244 units** below the rendered crop's top. The substantial cat itself is approximately 120.3 units wide × 101.3 units high at that scale. It is naturally narrower than the 186-unit-wide side-running silhouette because it faces the camera. Do **not** stretch it horizontally or force it to 186 units wide, which would make it roughly 159 units tall.

Keep the same gameplay ground/world anchor as the runner and keep collision geometry independent of sprite alpha. The centered image origin is a presentation recommendation, not a new collision box.

## Generation prompt

Use case: identity-preserve.
Asset type: ONE full-body 2D game reaction sprite with genuinely transparent background.
Primary request: Make a new Fuwa cat pose that has STOPPED running, faces the PLAYER/CAMERA directly, and gives a brief cute indignant HISS. This is a single static reaction pose, not a sprite sheet.
Input roles: image 1 is the real canonical FRONT-facing Fuwa identity and facial proportions reference; image 2 is the canonical standing side body/fur identity reference; image 3 is the game's painterly motion atlas style reference; image 4 is the previous side-facing hiss for fur and mouth style only. CHANGE THE VIEW, do not reuse its side-facing face.
Subject: the exact recognizable long fluffy gray/warm taupe Fuwa with cream-beige ruff and belly, compact substantial rounded body, short sturdy furry legs, huge plume tail, yellow-green eyes, pink nose, subtly grumpy face, soft detailed painterly long fur. Preserve canonical face identity.
Pose and camera: full body on all four feet, body slightly three-quarter for an attractive readable silhouette, but head is turned SQUARELY STRAIGHT TOWARD CAMERA. Both eyes equally clearly visible, gaze locked on the viewer, nose centered between both eyes, muzzle FRONT VIEW, no sideways face and no looking off toward the right or left. Broad fluffy chest presented toward viewer. Paws braced, stopped and naturally planted on one ground level. Complete plume tail visible curling beside/behind the body. Compact proportions that read clearly at only 100 pixels high.
Expression: ears swept back/outward in a harmless startled hiss; SMALL but CLEARLY OPEN pink mouth facing forward, tiny natural teeth, indignant alert yellow-green eyes, fluffy cheeks. Cute and slightly annoyed, not violent, not monstrous, no roaring or huge jaw.
Style: match reference 3 and 4's soft detailed painted game art, neutral warm gray/taupe with cream ruff, no costume.
Composition: one centered complete cat, near-square framing with padding on every side. Entire whiskers, ears, tail and all paws uncut. No scenery, no background, no ground, no cast shadow, no glow, no smoky halo, no checkerboard, no text or symbols. Real transparent alpha outside the fur. Do not include any second cat, grids or extra poses.

