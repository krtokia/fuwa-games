# Fuwa hiss reaction v1

## File and provenance

- `fuwa-hiss-v1.png`: unchanged built-in image_gen output, generated 2026-11-10.
- Dimensions: **1774 × 887**, RGBA PNG, **1,761,090 bytes** (about 1.68 MiB).
- Alpha spans 0–255. Real transparent background; no matte removal, resizing, recoloring, thresholding, or pixel editing was applied.
- Original generated source: `generated_images/exec-4865e507-3b38-4a1e-9426-42e61ea26224.png`, copied byte-for-byte into this assets directory.
- Canonical identity reference: https://fuwa.dad/assets/ref/fuwa/fuwa-pose-stand-side.png.
- Style and motion reference: existing `fuwa-motion-v1.png`.
- Both references were visually inspected before generation. The original standing game illustration `fuwa-generated.png` was also inspected.
- Built-in image_gen was used, not the API/CLI or an SVG substitute. The prompt requested roughly 1024 pixels wide, but the tool returned the dimensions above. The source was retained without destructive compression.

## Pose and review

One right-facing, full-body collision reaction: small clearly open pink mouth, ears swept backward, alert yellow-green eye, arched fluffy shoulders/back, raised plume tail and braced paws. The muted gray/taupe long fur, cream ruff, pink nose, rounded proportions and short furry legs match the canonical reference and game motion atlas. It reads as a brief startled hiss rather than an attack. The complete tail, whiskers, ears and feet remain inside the image.

The generated pose was visually inspected. It is AI-generated game artwork rather than a hand-registered animation rig. The paws have slight natural perspective differences in height; anchor the lowest substantial paws to the ground, not each paw separately.

## Crop and anchor

Pixel bounds use exclusive right/bottom coordinates:

- All nonzero alpha: `[0, 0, 1704, 887]`. This includes remote alpha=1 generation noise.
- Alpha > 1: `[64, 95, 1639, 811]`.
- Alpha > 8: `[65, 97, 1635, 809]`.
- Alpha > 32: `[67, 100, 1632, 809]`.

Recommended padded runtime source frame, without changing the file:

`x=50, y=85, width=1600, height=740`.

Recommended ground anchor in original coordinates: **y=808**, or local crop **y=723**. Use normalized origin **(0.5, 723 / 740)**. A width of **186 game units** gives height **86.025** at scale **0.11625**, close to the current motion sprite width. Place it at the same world anchor as the current cat. Adjust presentation scale only if visually needed; keep the existing gameplay hitbox independent of this image.

The crop retains all alpha > 1 with padding and omits only remote effectively invisible generated noise. No destructive alpha cleanup was applied.

## Generation prompt

Use case: identity-preserve.
Asset type: single 2D side-scrolling game collision-reaction sprite, transparent PNG.
Edit the referenced Fuwa artwork into ONE new full-body mild startled defensive HISS pose facing RIGHT. Image 1 is the canonical Fuwa identity reference; image 2 is the current game motion atlas and style to match. Do not create an atlas: output only one cat.
Preserve Fuwa's recognisable long fluffy gray/warm taupe coat with cream-beige ruff and belly, rounded substantial body, short sturdy furry legs, enormous plume tail, tufted ears, yellow-green eyes, pink nose and soft detailed painterly fur. Follow the reference identity, not a generic white kitten or thin angry cat.
Pose: pure right-facing side view, paws braced apart on one baseline, torso leaning/recoiling slightly left, shoulders and back softly arched upward, plume tail softly raised behind to the left. Ears clearly angled backward. Mouth SMALL BUT CLEARLY OPEN for a cute brief hiss, pink inside and just tiny natural teeth visible. Wide alert eye, startled and mildly indignant rather than scary or aggressive. All four legs anatomically plausible. The face and open-mouth silhouette must read when scaled down for a game.
Landscape framing, one centered cat occupying most of width, generous complete padding around whiskers, ears, tail and all paws. Real alpha transparency outside cat, clean fur edges, no cast shadow, no glow, no smoky halo, no scenery, no text, no symbols, no UI, no checkerboard. Keep the fine painted fur and identity of the game atlas. Full-body single pose with entire tail and feet uncut. PNG asset around 1024 pixels wide if possible, compact horizontal canvas.

