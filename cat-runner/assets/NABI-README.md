# Nabi runner artwork v1

## Final assets and provenance

- `nabi-motion-v1.png`: 1448 × 1086, RGBA, four columns × three rows, 12 complete right-facing movement poses.
- `nabi-punch-v1.png`: 1254 × 1254, RGBA, two columns × two rows, four front-facing collision-reaction poses.
- Generated on 2026-11-12 using the built-in image_gen tool with `transparent_background=true`.
- Both repository files are unchanged, byte-for-byte copies of the selected built-in outputs. No Python image editing, procedural drawing, SVG substitute, CLI generation, matte removal, resampling, alpha thresholding, recoloring, or pixel cleanup was performed. Python/Pillow/NumPy were used only to inspect existing pixels and measure alpha bounds.
- Movement selected source: `generated_images/exec-81360f76-61c0-4cd5-bd1f-0846b76dd5ff.png` in the workspace. SHA-256: `e905114c22f0b4680609a489d8436bd8f606dc19f6c5897e2af8016c9a78c03c`.
- Reaction selected source: `generated_images/exec-54fc9a5e-7ff8-49e2-89a9-902dda3e0c2f.png` in the workspace. SHA-256: `339d108646b3e9daf7c6ba8f1c4cc2f0caf294486230618f216078346d1660ae`.
- The initial movement candidate was `generated_images/exec-1f416a5e-99ff-4b03-92ea-f320d8d10d54.png`. It had an extended paw only three source pixels from a cell boundary. One further built-in image_gen edit added safe padding. The selected file above is that new generated output, not a programmatically resized version. The candidate is not shipped as an extra game asset.
- The reaction was generated using the initial movement candidate as a style reference; the final movement edit preserves that identity and style.

## Identity references actually inspected

The public listing https://fuwa.dad/assets/#ref, its explicitly linked manifest https://fuwa.dad/assets/ref/index.json and README https://fuwa.dad/assets/ref/README.md were read. All seven explicitly listed preview images were downloaded and visually inspected:

1. Front: https://fuwa.dad/assets/ref/nabi/s/nabi-front.webp
2. Left: https://fuwa.dad/assets/ref/nabi/s/nabi-left.webp
3. Right: https://fuwa.dad/assets/ref/nabi/s/nabi-right.webp
4. Back: https://fuwa.dad/assets/ref/nabi/s/nabi-back.webp
5. Top: https://fuwa.dad/assets/ref/nabi/s/nabi-top.webp
6. Belly: https://fuwa.dad/assets/ref/nabi/s/nabi-bottom.webp
7. Three-quarter: https://fuwa.dad/assets/ref/nabi/s/nabi-three-quarter.webp

These are the site's canonical appearance-reference drawings/previews, **not verified original photographs**. The first full-size PNG read returned HTTP 403 and was not retried. No original-photo links were present in the inspected listing, manifest or README, and no original Nabi photographs were available in the project/shared inputs. No claim of inspecting original photographs is made.

Nabi is a short-haired charcoal-gray tuxedo cat, not a tabby. The inspected identity has a solid charcoal saddle/head/tail, white inverted-V muzzle/blaze, white chest/belly, white paws with taller white rear socks, round yellow eyes, black nose, and a small black lower-lip spot. The site's top-view ring-shaped artifact is explicitly identified as an artifact, not a coat marking. It was not added to the sprite.

Existing `fuwa-motion-v1.png` and `fuwa-jump-land-v1.png` were visually inspected and used as game-style/pose references only. Nabi intentionally remains short-haired with a slender tail rather than inheriting Fuwa's long ruff or plume.

## Movement atlas geometry

Each full cell is exactly **362 × 362**. Full source rectangle for frame i:
`[(i % 4) * 362, floor(i / 4) * 362, 362, 362]`.

Use uniform source-to-world scale **0.70** for every movement frame. The full transparent cell then displays at **253.4 × 253.4** world units. Actual visible cat widths at alpha >=64 range from 155.4 to 185.5 world units; the narrower gather is intentional. Do not resize each pose to its alpha bounds.

All anchors use local cell coordinates. Place the anchor at the same gameplay foot/contact location; collision geometry stays independent of artwork.

| Frame | Action | Full source rectangle | Anchor [x,y] | Local alpha >=64 bounds [left,top,right,bottom] |
|---|---|---|---|---|
| 0 | Extended running flight | [0,0,362,362] | [181,274] | [59,128,324,258] |
| 1 | Front contact | [362,0,362,362] | [181,274] | [58,130,300,274] |
| 2 | Compressed run stance | [724,0,362,362] | [181,274] | [54,130,296,274] |
| 3 | Rear push-off | [1086,0,362,362] | [181,274] | [52,128,298,273] |
| 4 | Gathered running flight | [0,362,362,362] | [181,274] | [69,117,302,240] |
| 5 | Forward reach | [362,362,362,362] | [181,274] | [53,117,305,253] |
| 6 | Jump ascent | [724,362,362,362] | [181,274] | [58,78,292,275] |
| 7 | Jump descent | [1086,362,362,362] | [181,274] | [53,109,298,248] |
| 8 | Second-jump gather | [0,724,362,362] | [181,274] | [75,103,297,227] |
| 9 | Second-jump release | [362,724,362,362] | [181,274] | [70,71,300,269] |
| 10 | Landing crouch | [724,724,362,362] | [181,250] | [63,133,292,250] |
| 11 | Landing recovery | [1086,724,362,362] | [181,252] | [53,114,298,252] |

Right/bottom bounds are exclusive. Use full cells, so no tight runtime crop is necessary. If using normalized sprite origins, x is 0.5; y is respectively 274/362, 250/362 or 252/362.

Do not bottom-align airborne poses independently. The shared run/air anchor preserves visible lift. The landing frames use measured contact anchors to keep the ground plane consistent. The final second-jump release's feet stop at y=269, above its y=274 anchor by five source pixels, so it has no floor overhang. Ascent extends only one source pixel below the same anchor (0.7 world pixels).

Suggested timing: run 0–5 at roughly 12 frames/second; 6 while rising and 7 while falling; second-jump gather 0.05 seconds followed by release 0.10 seconds; landing crouch 0.055 seconds followed by recover 0.075 seconds. Apply the second-jump gameplay impulse immediately and let new jump input interrupt landing. These are visual recommendations, not a required change to physics.

## One collision reaction for every failure type

The same front-facing paw-punch sequence is used for obstacles, enemies, and pits. There is no separate pit animation, bite, hiss or damage depiction.

Each full reaction cell is **627 × 627**. Source rectangle:
`[(i % 2) * 627, floor(i / 2) * 627, 627, 627]`.

Use uniform scale **0.20** for all four reaction frames, displaying each full transparent cell at **125.4 × 125.4** world units. Actual visible height is about 103–108 world units, matching Nabi's side-view body size rather than matching the much larger transparent movement-cell dimensions.

| Frame | Action | Full source rectangle | Anchor [x,y] | Local alpha >=64 bounds |
|---|---|---|---|---|
| 0 | Turn/front-ready, both front paws down | [0,0,627,627] | [313.5,575] | [180,58,562,575] |
| 1 | Wind-up, one white paw beside cheek | [627,0,627,627] | [313.5,575] | [183,46,530,575] |
| 2 | Paw thrust toward camera, pads visible | [0,627,627,627] | [313.5,573] | [186,32,552,573] |
| 3 | Retract and settle | [627,627,627,627] | [313.5,569] | [167,39,538,569] |

Both yellow eyes, black nose and lower-lip spot remain visible. The extended paw is a rounded feline paw with pads and no extended claws, human fingers, fist or human arm. It enlarges through perspective; the head does not intentionally scale. A starting timing is 0.08/0.10/0.16/0.13 seconds. The integrator may fit these four poses to the existing reaction duration.

## Pixel inspection and honest limits

- Every pose was visually inspected. Movement silhouettes have genuinely different articulated limbs: reach, contact, compression, push, gather, ascent, descent, second-jump tuck/kick and landing/recovery. The reaction clearly differentiates the raised wind-up paw from its larger foreshortened punch.
- Alpha spans 0–255 in both assets. Movement contains 1,251,996 fully transparent pixels and 320,192 partially transparent pixels. Reaction contains 1,060,973 fully transparent pixels and 511,182 partially transparent pixels.
- Registration bounds above use alpha >=64; alpha >=16 was also checked to retain softer whiskers/fur. No threshold was applied to the stored files.
- In the selected movement atlas, the outer 20 pixels of every cell contain alpha <=2 only. Significant horizontal cat pixels are at least 37 pixels from cell edges at alpha >=16. The reaction's outer five pixels contain alpha <=1 only.
- Tiny faint generated alpha/RGB noise extends outside silhouettes. It is retained unchanged. Unrestricted alpha bounding boxes are unsuitable for registration or hitboxes.
- The art is AI-generated, not a hand-rigged production animation. Head/torso proportions, whiskers and coat borders vary slightly across poses. The two gathered poses and two upward kicks share a related feline silhouette but remain separately drawn and visibly differ in compactness and angle. The reaction's frontal body is a slightly three-quarter turn, with a small head/shoulder shift across frames; contact registration keeps the feet stable.
- No baked cast shadows, floors, labels, grid lines or UI are part of the intended artwork. No runtime integration, publishing or gameplay-code changes were performed by this asset work.

## Exact initial movement prompt

Use case: stylized-concept. Asset type: production 2D side-scrolling cat runner animation spritesheet, true transparent RGBA background. Generate a new FOUR COLUMN by THREE ROW atlas with exactly TWELVE distinct full-body cat action frames, row-major. Canvas landscape 2048 by 1536, twelve equal square cells, no lines or labels. Image references: 1 Nabi right-side canonical identity; 2 Nabi front identity; 3 Nabi three-quarter identity; 4 existing Fuwa movement atlas only for soft painted game-sprite style, NOT for fur, body or markings; 5 existing Fuwa jump atlas for poses/style only.
Nabi is the SAME short-haired charcoal gray tuxedo cat in every cell: solid charcoal-gray back/head/ears/tail, white muzzle with narrow inverted-V blaze between eyes, black nose, tiny black spot centered beneath lower lip, bright round yellow eyes, white chin and chest bib, white belly, white socks on all four paws, taller white rear socks. Ordinary sleek short-haired cat build and long slender charcoal tail, NOT Fuwa's fluff, ruff or plume, NOT pure black. Match photographed-looking canonical reference markings faithfully, translated into the existing softly painted readable gamecat style.
PURE RIGHT-FACING SIDE VIEW in all twelve cells. Nose points right, tail flows left. Exactly one complete cat per cell. Keep head and torso size consistent across ALL frames; distinct anatomical limb articulation, never static duplicates or squashed copies. Four paws, realistic feline anatomy. Keep entire tail, whiskers, ears and paws inside each equal cell with generous 30-pixel margins at requested resolution. Tail-to-nose width about 440px within 512px cells; torso/head registration near same local center. Ground-contact baseline around local y=405. Air poses may lift naturally above it; do not bottom-align all poses.
ROW ONE: Frame0 extended running flight, forelegs stretching forward/right, hindlegs backward/left, horizontal body. Frame1 front contact, forepaw extended down-right on baseline, rear knees beginning to fold beneath belly. Frame2 compressed run stance, forelegs nearly vertical under chest and hindknees drawn forward, slightly arched back. Frame3 rear push-off, hindfeet pushing backward against baseline, forepaws lifted and curling.
ROW TWO: Frame4 gathered running flight, all four paws tightly tucked under belly, body slightly lifted. Frame5 forward reach returning to start, forelegs extending forward but lower than frame0, hindlegs unfolding backward. Frame6 FIRST-JUMP ASCENT: chest angled upward, head raised, forepaws folded beneath chest, rear legs trailing down-left. Frame7 JUMP DESCENT: chest tilted down-right, forepaws reaching down-right toward landing, rear paws tucked, clear different silhouette from ascent.
ROW THREE: Frame8 SECOND-JUMP GATHER: spine curls slightly and all paws fold tightly towards belly/chest, compact air tuck, tail curled upward to left. Frame9 SECOND-JUMP RELEASE: chest lifts up and forward, front paws flex up near muzzle, rear legs extend clearly down-back in propulsive kick, longer belly, tail trails left, different from ordinary run. Frame10 LANDING CROUCH: front paws planted on baseline, elbows deeply bent, chest low near paws, hindlegs compress beneath raised hip, low head still looking right. Frame11 LANDING RECOVER: chest rises, one front paw lifts/reaches forward while the other supports baseline, rear legs unfold to push into run.
All twelve silhouettes must be genuinely different consecutive painted poses. Soft short-fur texture, quiet natural shading on the body only. No cast shadow, floor, backdrop, checkerboard, motion trail, particles, text, numbers, grid, logos, effects, accessories, biting, angry teeth, human arms or fists. Empty real transparency everywhere outside the cat. Return only the correctly spaced 4x3 game atlas.

## Exact targeted movement-padding edit prompt

Edit the supplied 4-column by 3-row Nabi cat animation atlas only to improve safe cell padding. Preserve ALL twelve action poses in their exact order, the SAME short-haired charcoal tuxedo cat identity and face/white markings, the same soft painted game sprite style, and the SAME transparent background. Keep the canvas aspect ratio exactly 4:3 and exactly four equal columns by three equal rows. Within EVERY cell, make the complete cat uniformly 86 percent of its previous size, preserving its proportions and pose, centered horizontally in its cell. This is the same uniform reduction for all twelve sprites, not individually fitted sizes. Leave at least 25 pixels clear margin between all visible ears, whiskers, tail tips and paws and each cell boundary at approximately 362px cell width. The first frame's reaching paw is too close to the right cell boundary: it must now be comfortably inside. The compact gathered poses should remain compact, the released jumps tall, and the low landing crouch low. Keep common grounded contact baseline aligned near local 80 percent cell height for the run contact poses and landing poses. Keep the running-flight frames raised naturally. No new poses, no alternate cats, no extra limbs, no extra tail, no long fur, no stripes, no text, no grids, no floor, no cast shadows, no image background. True alpha transparency. Exactly 12 same animated poses in 4 columns by 3 rows, safely padded. Return only the corrected full atlas.

## Exact reaction prompt

Use case: stylized-concept. Asset type: production game animation sprite atlas, real transparent RGBA. Create exactly FOUR complete full-body cat poses in a precise TWO COLUMN by TWO ROW equal-cell grid on square canvas, ideally 1536x1536. Image1 is Nabi's canonical FRONT identity, Image2 is Nabi's canonical three-quarter identity, Image3 is the newly generated Nabi movement atlas and defines the painted sprite style, head/body proportions and coat values. Depict exactly the same Nabi, not a different cat. Each of the four cells contains one whole cat at consistent natural scale, no overlap, ample transparent padding.
Nabi is a short-haired charcoal gray tuxedo cat with a solid gray head/back/tail, round yellow eyes, black triangular nose, white muzzle and narrow inverted-V white blaze between eyes, tiny black spot beneath lower lip, white chest/belly and four white paws. No tabby stripes. Ordinary feline body, slender charcoal tail. Keep black lip spot in all frames. Softly painted gamecat style matching the motion atlas, consistent head size. No long fur or plume.
This is the ONE unified collision reaction: Nabi has just stopped running and turns toward the PLAYER/CAMERA, gives a playful feline 'nyang nyang punch' with a front paw, then settles. It is used after any collision, including a pit. No hissing, teeth, biting, injuries or pain. This is cute assertive playful cat swatting, not human boxing.
TOP LEFT frame0 FRONT READY: body is slightly three-quarter after turning from rightward run, face directly looks into camera with BOTH eyes plainly visible, both front paws down under chest, ears upright, slight alert head tilt, tail curls behind. Complete body including hindfeet.
TOP RIGHT frame1 WIND-UP: body and face are frontal, supporting forepaw planted, other white front paw lifts high near cheek and bends at the feline wrist in preparation, face looks into camera with BOTH eyes, same head size, shoulders slightly rotate. Clear raised paw silhouette, not a wave and not a human fist.
BOTTOM LEFT frame2 CAMERA PAW PUNCH: body/face still frontal, one foreleg extends directly TOWARD THE CAMERA in strong foreshortening; its soft rounded white cat paw is larger due to perspective, visible paw pads face the viewer, toe beans are subtle dark pink, NO claws extended, NO human fingers or fist. The forward paw passes just to one side of Nabi's face so BOTH yellow eyes and the tiny lower-lip dot stay visible. Supporting forepaw remains down, rear paws grounded. Distinct obvious forward reach, not merely a held-up paw, not a sideways swipe. No impact effects.
BOTTOM RIGHT frame3 SETTLE: extended forepaw retracts and lowers, both front paws near the ground, shoulders relax, front-facing look remains cheeky and calm. Tail gently curls aside. Difference from frame0: slightly lower relaxed chest, lifted paw just about to touch down and slight head tilt the other way.
All four cats share exactly same head size, torso dimensions and camera distance; only the punching paw enlarges through foreshortening. Full body fits within each cell, no cropped ears/paws/tail. Fixed virtual ground baseline local y=625 in 768px cell. Ear tips around y=120, front paws around y=625. Body center x=384, tail safely inside cell, leave >=48px edge padding. On the punch frame the paw must stay completely within its cell. True empty transparency outside cats. NO ground plane, shadows, checkerboard, grid, text, numbers, lines, vignette, trail, glow, props or accessories. Return only the 2x2 four-pose atlas.

