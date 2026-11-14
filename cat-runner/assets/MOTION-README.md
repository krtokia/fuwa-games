# Fuwa motion atlas v1

## Files and provenance

- `fuwa-motion-v1.png`: unchanged built-in image_gen output, 1774 × 887 pixels, RGBA with alpha spanning 0–255.
- Generated with the built-in image_gen tool on 2026-11-09. No CLI generation, SVG substitute, matte removal, recoloring, or alpha thresholding was used.
- Original generated source: `generated_images/exec-481b9116-3b42-4b2d-b522-9eb06b346580.png` in the workspace. Copied byte-for-byte into this assets directory.
- Canonical identity reference: https://fuwa.dad/assets/ref/fuwa/fuwa-pose-stand-side.png (downloaded and visually inspected).
- Additional style reference: existing `fuwa-generated.png`.
- This is AI-generated game artwork, not a claim of hand-authored or anatomically perfect animation.

## Layout

Four columns × two rows, row-major. The generated size is odd, so exact normalized cell dimensions are **443.5 × 443.5** pixels. Canvas drawImage supports fractional source rectangles; use those rather than repeatedly flooring each cell width.

| Index | Column | Row | Pose |
|---|---|---|---|
| 0 | 0 | 0 | Extended running flight; forelegs forward and rear legs back |
| 1 | 1 | 0 | Front contact/reach, rear legs folding |
| 2 | 2 | 0 | Compressed stance, paws beneath body |
| 3 | 3 | 0 | Rear push, forepaws curled |
| 4 | 0 | 1 | Gathered flight, all paws tucked |
| 5 | 1 | 1 | Forward reach, hindlegs unfolding |
| 6 | 2 | 1 | Jump ascent, chest lifted and hindlegs trailing |
| 7 | 3 | 1 | Jump descent, forepaws reaching for landing |

Full-cell source rect: `[column * 443.5, row * 443.5, 443.5, 443.5]`.

Optional tighter **common** runtime source rect for all frames:
`[column * 443.5, row * 443.5 + 65, 443.5, 310]`.
This retains all substantial cat pixels, including the taller ascent pose, without altering source alpha. It clips only extremely faint remote generated alpha noise. Keep this rectangle identical in size across frames. Suggested ground anchor is local full-cell y=360 (tight-crop y=295); do not bottom-align every pose independently, which would cancel the authored gathered-flight lift.

Use indices 0–5 as a loop, approximately 11–14 frames/second initially. Index 6 while rising, 7 while descending. Treat animation choice separately from collision shape.

## Inspection and limitations

All eight poses were visually inspected after generation. Limb configurations genuinely differ: stretched forelegs, front contact, compressed legs, tucked forepaws during push-off, gathered flight, and reaching are distinct silhouettes. The airborne poses also differ visibly. Fuwa retains gray/beige long fur, cream ruff, plume tail, tufted ears, yellow-green eye, pink nose and a focused/grumpy face.

The atlas is usable for a polished prototype but is not a hand-registered production rig. Head/torso proportions and baseline vary slightly between frames, and legs can visually merge into the long fur. Frame 4 has intentional gathered-flight lift. Frame 3 and ascent share a related push-off silhouette but differ in angle and height. Tiny low-alpha speckles extend beyond the visible silhouettes, so alpha bounding boxes alone are not useful registration bounds. Use stable source rectangles and fixed gameplay collision geometry; do not derive per-frame hitboxes from alpha. No color-key or destructive alpha cleanup was applied.

## Generation prompt

Use case: stylized-concept. Asset type: production 2D side-scrolling game animation spritesheet with actual transparent background.
Reference image 1 is Fuwa's canonical identity (a long-haired gray and warm beige Maine Coon-like cat). Reference image 2 is the game's painterly style guide. Match identity and soft detailed painted fur, not the source standing pose.
Generate exactly EIGHT complete RIGHT-FACING cat poses, in a precise FOUR COLUMN by TWO ROW grid of equal cells, row-major order. All frames contain the same cat at exactly the same scale. Pure side view. Enormous cream/beige ruff, muted gray coat, large plume tail flowing LEFT, pointed tufted ears, yellow-green eyes, pink nose, subtly grumpy focused face. No costume. Keep entire whiskers, ears, tail and paws inside each cell with small padding. No overlap between cells, no grid lines, no labels, no shadow, no scenery, no checkerboard. True transparent background.
Frames 1–6 are SIX DIFFERENT consecutive poses of a running quadruped gait, with clearly visible anatomical limb changes, never copies of a standing cat. Frame 1 extended flight: front legs stretched forward/right and rear legs back/left. Frame 2 front contact: front paw extended down/right, rear legs begin folding under belly. Frame 3 compression: forelegs under chest and rear legs tucked forward under belly, back slightly arched. Frame 4 rear push: rear paws push backward on baseline, front legs curl upward. Frame 5 gathered flight: all paws folded tightly beneath body, flowing tail slightly lifted. Frame 6 reaching: forelegs extend right again, hindlegs unfold backward. These six poses form one looping run cycle. Keep torso/head registration stable, baseline at same within-cell y, only subtle bob.
Frame 7 (row2 col3) jump ascending: chest lifted slightly, forepaws tucked under ruff, hind paws trailing left, airborne stretched silhouette. Frame 8 (row2 col4) jump descending: chest angled slightly down, forepaws reaching down/right to land, hind paws curled under haunch, distinct from ascent.
The eight bodies must be consistent proportions and same scale. Landscape atlas, four equal columns and two equal rows. Readable silhouette at small game size. Prioritize distinct animated leg positions over static portrait detail.

