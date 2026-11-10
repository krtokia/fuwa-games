# Fuwa second-jump and landing atlas v1

## Deliverable and provenance

- `fuwa-jump-land-v1.png`: 1254 × 1254 pixels, RGBA. Four complete right-facing cat poses in a 2 × 2 grid.
- Generated with the built-in image_gen tool on 2026-11-10, using transparent_background=true.
- Generated source: `generated_images/exec-a39cf03f-10c4-4a73-b43c-601b512a4a27.png` in the workspace. Copied byte-for-byte into this asset directory.
- No CLI generation, SVG substitute, image resampling, matte removal, color keying, alpha thresholding, repainting, or destructive cleanup was performed.
- References were visually inspected before generation:
  1. Canonical Fuwa identity: https://fuwa.dad/assets/ref/fuwa/fuwa-pose-stand-side.png
  2. Existing `fuwa-motion-v1.png`, for the exact right-facing runner style.
  3. Existing `fuwa-generated.png`, for coat, ruff and face details.
- Artwork is AI-generated and visually reviewed, not a hand-rigged or anatomically perfect animation.
- The image alone is the deliverable. This work did not change game/engine code.

## Frames and crop geometry

Each full cell is 627 × 627 pixels. Row-major frame order:

| Index | Pose | Full source rectangle [x, y, width, height] |
|---|---|---|
| 0 | Second-air-jump gather: knees and forepaws tightly tucked | [0, 0, 627, 627] |
| 1 | Second-air-jump release: lifted chest, hindlegs kicking down/back | [627, 0, 627, 627] |
| 2 | Landing compression: forepaws down, chest low, elbows bent | [0, 627, 627, 627] |
| 3 | Landing recovery: chest up, one forepaw lifted, rear push | [627, 627, 627, 627] |

Recommended **common runtime crop**, preserving all substantial cat pixels:
`[column * 627, row * 627 + 105, 627, 445]`.

Explicit runtime crops:
- Gather: [0, 105, 627, 445].
- Release: [627, 105, 627, 445].
- Landing crouch: [0, 732, 627, 445].
- Recovery: [627, 732, 627, 445].

Use the same source size, origin and scale for all four frames:
- Full-cell registration anchor: **x=313.5, y=456**.
- Tight-crop anchor: **x=313.5, y=351**.
- Phaser tight-crop origin: **(0.5, 351/445)**, approximately (0.5, 0.788764).
- Suggested uniform scale: **0.32**.
- Place this anchor at the same gameplay foot position as the existing atlas. Keep collision geometry independent of artwork.
- Do not independently resize each frame to its alpha bounds or bottom-align all four. That would undo the tuck/crouch and introduce head/body size changes.

At scale 0.32 the tight source rectangle displays at 200.64 × 142.4 world units, including transparency. The actual visible cat is smaller. Existing motion uses 0.42 for its 443/444-pixel cells; the different pixel density means copying 0.42 to this new atlas would make Fuwa too large.

## Measured visible bounds

The values below are local full-cell bounds at alpha >=64. Right/bottom are exclusive. They are inspection metrics only: the actual file retains the full original alpha.

| Frame | Local bounds [left, top, right, bottom] | Visible world width × height at scale 0.32 |
|---|---|---|
| Gather | [49, 180, 559, 452] | 163.20 × 87.04 |
| Release | [13, 130, 578, 535] | 180.80 × 129.60 |
| Landing crouch | [35, 221, 595, 456] | 179.20 × 75.20 |
| Recovery | [12, 180, 584, 457] | 183.04 × 88.64 |

The gather is intentionally narrower because the body is tucked. The release is intentionally taller because the chest rises and hindlegs extend downward. Uniform scaling preserves these pose differences while normal frames sit within the existing approximately 174–186-pixel width. The low landing crouch should not be stretched to standing height.

At alpha >=16, corresponding bounds are [48,179,565,452], [12,129,579,535], [34,220,601,456], and [11,179,596,457]. All significant whiskers and fur remain inside their cells.

Alpha spans 0–255. At generation resolution there are 1,150,394 fully transparent pixels and 421,946 partly transparent pixels. The outer five pixels of each cell contain no alpha >=64. Outside the suggested vertical crop there is only alpha <=1 noise; source alpha was not changed. Very faint alpha=1 noise extends far beyond the cat, so an unrestricted alpha bounding box is unsuitable for registration or collision.

## Timing recommendation

- On the **second** jump only: gather for about **0.05 seconds**, release for **0.10 seconds**, then return to the existing ascent/descent poses. Total boost pose sequence: **0.15 seconds**. Apply the gameplay impulse immediately; do not defer it until the release art.
- On real ground contact: landing crouch for **0.055 seconds**, recovery for **0.075 seconds**, then the existing run loop. Total recovery: **0.13 seconds**.
- A new jump or other higher-priority action should interrupt landing recovery immediately. Do not lock input for the animation.
- These are discrete painted frames, not a tweened or rigged transition. Keep the existing run/ascent/descent frames around these short accents.

## Visual inspection and limits

All four poses visibly differ in articulated limbs, torso angle and silhouette; they are not duplicated standing portraits or squash-only variants. The cat retains Fuwa's taupe-gray flowing fur, cream ruff, yellow-green eye, tufted ears, pink nose and plume tail. Scale/registration is broadly consistent with the existing painterly sprite atlas, but generation is not exact pose-rig registration: head angle, ruff shape and torso proportions vary slightly.

Landing frame paw bottoms differ by only one source pixel. The fixed virtual anchor is y=456, while the released kick's hindfeet reach y=535: about **25.3 world pixels below the anchor at scale 0.32**. This is appropriate while airborne, but a second jump fired very near a platform could briefly draw hindfeet below its surface if the renderer uses no floor-aware handling. Do not fix this by changing collision geometry or per-frame width. Review the in-game transition at actual play size, especially a very late second jump. The head/chest also rise intentionally in release. Some legs visually merge with long fur, and the crouch can read as a very low prowl when held too long, which is why the recommended landing timing is brief.

## Exact generation prompt

Use case: stylized-concept. Asset type: production 2D runner animation spritesheet, genuinely transparent RGBA, square canvas 1024 by 1024. Create one new atlas, not a portrait. Reference 1 is Fuwa's canonical identity, reference 2 is the exact existing right-facing game's eight-frame motion atlas and its painted sprite style, reference 3 reinforces coat and face. Keep the new sprite matching reference 2, not more realistic or larger-headed. Match Fuwa: gray/taupe long flowing fluffy coat, cream ruff and plume tail, tufted pointed ears, yellow-green eye, small pink nose, concentrated mildly grumpy expression; no costume. Pure SIDE VIEW, face and nose point RIGHT in every frame; plume tail left. Exactly FOUR complete anatomical action poses in a TWO COLUMN by TWO ROW equal-cell grid. Do not copy standing poses. Render one whole cat inside each cell, transparent margins, no overlapping cell boundaries. Consistent cat scale, head size, torso dimensions and horizontal torso registration across all four frames. A cell is 512 square; aim tail-to-nose span about 430 pixels, torso centered near local x=275,y=285. Invisible common gameplay ground anchor local y=405 and x=256. Keep substantial cat pixels inside local x=24..488 and y=110..410. The airborne poses can lift above the ground anchor; do not independently bottom-align them. Precisely these four poses in reading order: TOP LEFT, second-air-jump gathering: spine curled, hind knees pulled sharply toward belly and chest, both forepaws folded under cream ruff, toes gathered before a kick, tail curled slightly upward behind. TOP RIGHT, second-air-jump release: chest lifted UP and forward, forepaws flexed forward/up under muzzle, both hindlegs dynamically extended DOWN and BACK from hips in a clearly different propulsive kick, stretched belly and plume tail trailing left; upward-bound silhouette, not a horizontal run. BOTTOM LEFT, landing contact/compression: forepaws planted down-right on common baseline, front elbows bent deeply and chest/shoulders lowered toward paws, hindlegs folding in below haunches, head slightly down but gaze forward, back and hip high, an actual impact crouch. BOTTOM RIGHT, landing recovery into run: chest rises from the crouch, one forepaw now lifting and reaching forward while other supports on baseline, rear legs unfold backward to push, torso extending into the next running stride. The four frames must have visibly DIFFERENT articulated limb poses and torso flexion, not squashed/resized copies, not extra legs. Make the two bottom poses clearly different from each other and the two top poses clearly different from each other. Keep all eyes/face/ruff/tail markings consistent with Fuwa and matching the existing atlas. Soft detailed painted fur, crisp readable silhouette at game scale. Entire ears, fur tips, tail and paws contained inside their cells. NO text, labels, numbers, border, grid lines, floor, cast shadow, environment, checkerboard, motion trails, glow, particle effects or accessories. True empty transparent background. Return only the four-frame sprite atlas.

