# Shuri runner artwork v1

## Files and provenance

- `shuri-motion-v1.png`: 1448 × 1086 pixels, RGBA, four columns × three rows.
- `shuri-tumble-v1.png`: 1254 × 1254 pixels, RGBA, two columns × two rows.
- Generated with the built-in `image_gen` tool on 2026-11-12, always with `transparent_background=true`.
- Both selected files are copied byte-for-byte from generated output. No CLI generation, procedural/SVG substitute, resampling, matte removal, color keying, alpha thresholding, or manual pixel editing was used. Python only read dimensions and measured alpha bounds.
- Movement source: `generated_images/exec-4e30db17-9a04-47c4-a953-ae9aa231c8b6.png`.
- Selected tumble source: `generated_images/exec-e511ca26-9fb5-4bc2-b97d-ba75059b91d4.png`.
- Initial tumble generation `exec-060d2692-b723-41d7-93b5-eb16554fe83d.png` was rejected because the recovery tail crossed the center seam. A built-in image edit produced the selected padded atlas. The rejected source is not shipped in this assets directory.
- SHA-256 movement: `5cd0aabf15c9dc78d6a3555cd0ead9c7bb378660bf8de86d178cfb202bba5c84`.
- SHA-256 tumble: `b35b94cdce120fd26f35fe91f4d8d447e805f54be5bfdb2c83cbf6361a624414`.

This is AI-generated, visually reviewed game artwork. It is not a hand-rigged, precisely registered production animation.

## References actually inspected

The actual listing at https://fuwa.dad/assets/#ref and its linked https://fuwa.dad/assets/ref/index.json and https://fuwa.dad/assets/ref/README.md were read before downloading references. Every Shuri URL below came from that listing, not guessed filenames.

All seven full-size canonical Shuri PNGs were downloaded and visually inspected:
- https://fuwa.dad/assets/ref/shuri/shuri-front.png
- https://fuwa.dad/assets/ref/shuri/shuri-left.png
- https://fuwa.dad/assets/ref/shuri/shuri-right.png
- https://fuwa.dad/assets/ref/shuri/shuri-back.png
- https://fuwa.dad/assets/ref/shuri/shuri-top.png
- https://fuwa.dad/assets/ref/shuri/shuri-bottom.png
- https://fuwa.dad/assets/ref/shuri/shuri-three-quarter.png

The site calls these canonical appearance references. No separate original pet photographs are linked from the inspected listing/index/README, so this work does not claim to have inspected original real-life photographs.

Shuri's reference identity is a slim short-haired brown mackerel tabby with large ears, forehead M, narrow dark side stripes, striped legs, yellow-green eyes, pink/brown nose, light chin, tan belly, and a narrow ringed black-tip tail. The front reference's apparent tail above the head is a known listing caveat, not an anatomical feature to reproduce.

Existing `fuwa-motion-v1.png` and `fuwa-jump-land-v1.png` were visually inspected for softly painted style and action scale. Movement generation used Shuri right/front/bottom as identity inputs and Fuwa motion as style only. Tumble used the new Shuri movement plus Shuri right/front/bottom. The padding correction used only its preceding generated tumble atlas.

## Movement geometry and timing

Full equal cells are exactly **362 × 362**. Frame source rectangle is:
`[(index % 4) * 362, floor(index / 4) * 362, 362, 362]`.

Suggested common runtime crop:
`[column * 362, row * 362 + 45, 362, 270]`.

Use a uniform scale of **0.55** for all twelve poses. The cropped sprite rectangle is 199.1 × 148.5 world units including transparent margins. Substantial silhouette widths are about 156–181 world units, depending on tuck/stretch.

| Index | Pose | Suggested full-cell anchor [x,y] | Cropped anchor [x,y] |
|---|---|---|---|
| 0 | Run extended flight | [181,285] | [181,240] |
| 1 | Run front contact | [181,285] | [181,240] |
| 2 | Run compression | [181,285] | [181,240] |
| 3 | Run rear push | [181,285] | [181,240] |
| 4 | Run gathered flight | [181,285] | [181,240] |
| 5 | Run reaching flight | [181,285] | [181,240] |
| 6 | Jump ascent | [181,285] | [181,240] |
| 7 | Jump descent | [181,285] | [181,240] |
| 8 | Second-jump gather | [181,285] | [181,240] |
| 9 | Second-jump release | [181,285] | [181,240] |
| 10 | Landing crouch | [181,270] | [181,225] |
| 11 | Landing recovery | [181,270] | [181,225] |

At the common 270-pixel crop height, corresponding origins are (0.5,240/270) for frames0–9 and (0.5,225/270) for frames10–11. The landing row is authored on a different baseline, so its anchor compensates by fifteen source pixels. Preserve authored airborne lift for run4/5 and boost8 instead of bottom-aligning every frame.

Suggested run loop is 0–5 at 11–14 fps. Jump uses6 while rising and7 while descending. On second jump,8 for roughly0.05s then9 for0.10s; apply impulse immediately. Ground contact uses10 for0.055s then11 for0.075s. Input and actual state transitions should interrupt these accents normally. Collision shapes remain independent of art.

## Tumble geometry and timing

Equal cells are exactly **627 × 627**. Full source rectangle:
`[(index % 2) * 627, floor(index / 2) * 627, 627, 627]`.

Suggested common crop:
`[column * 627, row * 627 + 110, 627, 390]`.

Use uniform scale **0.38** for all four poses. Cropped display rectangle is 238.26 × 148.2 world units including substantial transparent padding. Contracted poses are intentionally narrower, and the stretched recovery plus tail can span approximately191 world units.

| Index | Actual generated pose | Full-cell anchor | Cropped anchor |
|---|---|---|---|
| 0 | Low right-facing preparation crouch | [313.5,485] | [313.5,375] |
| 1 | Head-down tuck, hips high over curled head | [313.5,486] | [313.5,376] |
| 2 | Inverted rounded roll, belly up and paws tucked up | [313.5,432] | [313.5,322] |
| 3 | Right-facing low extended recovery | [313.5,432] | [313.5,322] |

Play 0→1→2→3 once, about0.08s/0.12s/0.16s/0.20s as a starting point. These are genuinely different painted anatomies, including an inverted pose, not a static image rotated with code. No extra runtime full-spin is needed. Four key poses imply a forward somersault but do not contain every intermediate angle; the transition from upside-down to recovered skips a separate three-quarter-turn drawing. It is a discrete stylized tumble, not a smooth full-motion rig. Keep any additional displacement brief and separate from gameplay collision geometry.

The y anchors compensate the two generated row baselines so the feet/back meet the same ground. Do not use one raw origin across all four frames or the bottom row will rise about20 world units. The turned head and belly in frame2 are intentional. Do not flip frame2 to force its nose right.

## Pixel inspection

Bounds are local to full cells, right/bottom exclusive, at alpha >=64. These are measurements, not destructive crops, and should not drive hitboxes.

| Movement frame | Visible bounds [left,top,right,bottom] |
|---|---|
| 0 | [25,121,354,272] |
| 1 | [23,122,333,284] |
| 2 | [20,127,321,285] |
| 3 | [15,116,326,285] |
| 4 | [26,110,334,248] |
| 5 | [24,105,346,261] |
| 6 | [29,65,322,286] |
| 7 | [19,109,323,283] |
| 8 | [35,98,319,235] |
| 9 | [27,59,334,288] |
| 10 | [22,138,329,270] |
| 11 | [21,110,328,269] |

| Tumble frame | Visible bounds [left,top,right,bottom] |
|---|---|
| 0 | [117,249,526,484] |
| 1 | [110,170,406,485] |
| 2 | [158,128,499,432] |
| 3 | [29,168,531,432] |

Both files have real RGBA alpha spanning0–255, with no baked opaque background, grid, labels, floor or cast shadow. Movement has325,947 fully transparent pixels and1,246,466 partially transparent pixels. Most background residue is alpha1–2; outer-five-pixel strips per cell have maximum alpha2–5. Tumble has1,297,890 fully transparent pixels and274,248 partially transparent pixels; outer-five-pixel strips have maximum alpha1. Significant visible fur/paws/tails stay inside cells. Unrestricted alpha bounding boxes pick up very faint generated noise and are unsuitable for registration.

All sixteen selected poses were visually inspected. Run/contact/compression/push/gather/reach show leg changes. Ascent/descent differ in torso angle and foreleg position. Second-jump release is more vertically lifted than run push, while second-jump gather is related to running gather. Landing crouch and recovery have genuinely different shoulder height and limb placement. All four tumble stages have distinct silhouettes and torso articulation.

Limits: markings/head proportions and baseline vary slightly between frames; run0/5 and gathered run4/boost8 are naturally related silhouettes rather than wholly different actions. Some paired legs merge visually at game scale. The motion image has faint low-alpha residue around the silhouettes that was not removed, so inspect against the actual game background. Tumble uses a slightly more detailed finish and different source density, hence its separate scale. No claim is made that pixel-perfect anatomy, strict stripe continuity, or a smooth rigged somersault has been achieved.

## Exact generation prompts

### Movement
Use case: stylized-concept. Asset type: production animation atlas for a 2D side-scrolling cat runner. Generate a NEW character spritesheet, not an edit of a reference photograph. Image 1 is Shuri's canonical RIGHT side appearance, image 2 Shuri's front face, image 3 Shuri's underside markings, image 4 the existing Fuwa game animation STYLE ONLY. Match Shuri's identity, not Fuwa's long-haired anatomy. Same softly painted detailed sprite finish as image 4, simplified clear silhouettes visible at small game scale. Shuri is a slim short-haired brown mackerel tabby, warm gray-brown coat with dark narrow side stripes, striped legs, lighter tan chest and belly, cream-white CHIN only, large pointed ears without long tufts, forehead M, yellow-green eyes, small pink-brown nose, long narrow ringed tail with BLACK TIP. No large white socks, no white bib, no plume tail, no fluffy ruff. Anatomically normal four-legged cat with focused alert face.
Output exactly TWELVE complete independent RIGHT-FACING side-view cat poses on a regular FOUR COLUMN by THREE ROW atlas. Landscape canvas, desired 1600 by 1200, twelve equal square cells. Invisible cell boundaries and ample empty transparent padding. Each cat entirely within its cell, including long tail and whiskers. Consistent head/torso SCALE across all poses; no independent fit-to-cell resizing. In a conceptual 400px square cell, torso centered x=235,y=225, normal standing/contact paws near y=330, cat tail to nose width about330, maximum occupied x=25..375,y=65..350. Ground/registration must be consistent; airborne tuck intentionally lifts paws rather than expanding the cat. Keep tails left, faces right, pure side profile.
Row1 four running gait frames: frame0 extended flight, forelegs reaching far right and hindlegs stretched back left; frame1 front contact, near forepaw reaching down/right while rear legs fold forward beneath body; frame2 compression, forelegs under chest, hind knees gathered under belly and spine bowed slightly; frame3 rear push-off, rear legs extend back onto common contact baseline and forepaws curl beneath chest.
Row2: frame4 gathered running flight, all four paws tucked under body, torso horizontal, tail slightly lifted; frame5 reaching flight, forelegs unfold right and hindlegs unfold back, different articulation from frame0; frame6 jump ASCENT, chest raised about25 degrees, forepaws bent near chest, hindlegs trailing back-left; frame7 jump DESCENT, nose and chest slightly downward, forelegs reach down-right and hindlegs folded under haunch.
Row3: frame8 SECOND JUMP GATHER, spine curled and both hind knees drawn tightly toward belly, front paws folded under chin, all paws gathered into a compact spring shape; frame9 SECOND JUMP RELEASE, chest lifts strongly up/right and both hindlegs kick diagonally down-left, front paws flex forward, stretched belly, clearly different from ascent; frame10 LANDING CROUCH, forepaws contact baseline, deeply bent elbows, chest low, hips raised slightly and hindlegs folding beneath body; frame11 LANDING RECOVERY, chest rises, one forepaw lifted reaching right while other supports baseline, hindlegs push back into run.
These must be twelve genuinely different articulated poses with correct leg count, not duplicate still cats, not a rotated or resized sprite. Keep the same slim Shuri body proportions and markings in every cell. Empty TRUE ALPHA background, no glow or halo copied from photo references. NO labels, text, numbers, grid lines, border, scene, floor, cast shadow, checkerboard pattern, effects, motion lines, collar or accessories. Return the atlas only.

### Initial tumble
Use case: stylized-concept. Create one NEW production 2D runner collision reaction animation atlas with exactly FOUR DIFFERENT articulated poses of Shuri performing a playful FORWARD SOMERSAULT to the RIGHT. Reference1 is newly approved Shuri movement game atlas: match exactly that slim short-haired brown tabby character, head/body proportions, stripe layout, short fur and softly painted game finish. Reference2 canonical right view, reference3 canonical front, reference4 underside. Identity: slim short-haired warm gray-brown mackerel tabby, large triangular ears, yellow-green eyes, forehead M, small pink-brown nose, pale cream chin, tan belly, dark striped legs and long narrow ringed BLACK-TIP tail. No white socks, no white bib, no large mane, no plume tail. Same cat at SAME anatomical scale throughout, no independent fit-to-cell resizing.
Output a square transparent atlas, exactly TWO COLUMNS by TWO ROWS, four equal square cells, no lines. Each cell one whole cat, all tail, whiskers, ears and paws contained with ample padding. Imagine512px cells. Normal cat nose-to-tail width approx410px; use same head diameter about80px and torso mass consistently even in contracted ball poses. Cell bounds must be separated by at least30px empty transparency. Camera side view throughout; forward somersault travels right, CLOCKWISE as seen by viewer. Do not just rotate a standing image. Each phase shows genuine torso curl and changing four limb configurations.
Top-left FRAME0 PREPARE: Shuri faces right in a low compact crouch, shoulders lowered, forepaws braced in front near x380, chin curling toward chest, knees bent beneath hips, long ringed tail curves gently up and behind to the left. Common floor at local y415, body mainly x110..400.
Top-right FRAME1 HEAD-DOWN TUCK: Dynamic next quarter-turn of forward roll. The rounded back and rump are high, hindquarters raised over head. Chin tucked firmly onto chest and forepaws folded beside cheeks, head now points DOWN near lower-right of the curled body. Both hind knees fold close into belly up at upper-left. Spine makes a compact C-shape, not standing and not merely lying. Ringed tail follows arc above and left. The neck is tucked safely, no injury. Whole curved silhouette centers around x265,y270, reaches ground near y415.
Bottom-left FRAME2 UPSIDE-DOWN TUMBLE: Clearly rolled onto rounded shoulders/back. Belly faces UP; curved backbone is BELOW, near floor y415. Head upside-down at LOWER LEFT of curled body, muzzle points left/up, pink nose visible; both front paws folded over chest and both hind feet point UP and slightly right, legs tucked tightly toward belly. Hips now at upper-right. Ringed tail coils above/right as counterbalance. Unmistakably INVERTED, not a sleeping cat lying upright, not the prior pose repeated. Contracted ball silhouette same body mass, centeredx265,y285.
Bottom-right FRAME3 RECOVER: Shuri has completed the forward roll, RIGHT-FACING again in a low sprawled catch, front legs planted and slightly spread to regain balance, chin/head lifts right, rear knees under hips and one hind foot coming down. Ringed tail sweeps left. Mildly startled wide yellow-green eyes but closed mouth, no hissing. Common ground y415. Distinct from prepare: chest higher and front paws farther forward, body stretched rather than balled.
Preserve normal four-limb feline anatomy, no human hands, no extra legs or duplicate heads. Short-haired cat only. Same quality, scale, markings and palette as movement sprite. Real transparent RGBA background with clear margins; no halos or glow from reference photos. NO labels, grid, numbers, text, border, floor, cast shadows, motion trails, impact effects, props, scenery, checkerboard, collar or costume. Four distinct paintings, not copies transformed. Return just the atlas.

### Tumble padding correction
Use case: precise-object-edit. Edit this four-frame Shuri forward-roll atlas. Preserve the SAME FOUR DISTINCT articulated poses, exact brown mackerel tabby character, slim short hair, painted finish, markings and limb configurations. Do not replace any pose. The bottom-right recovery tail currently crosses its left cell boundary. Fix the layout consistently: reduce ALL FOUR cats by the SAME 15 percent factor relative to their current cells, without changing their proportions or posing, and recenter each in its own equal quadrant. Keep contact baseline matching in all four quadrants at local82 percent of cell height, with the entire cat including every tail tip and whisker inside local x7 percent..93 percent and y8 percent..85 percent. Atlas stays TWO COLUMNS by TWO ROWS of equal square cells, one complete cat in each. Top-left crouch facing right; top-right head-down forward curl; bottom-left upside-down tucked roll with paws up and head on left; bottom-right extended low recovery facing right. All four at identical anatomical scale. Outer borders and central gutters must be genuinely empty alpha, with at least35px margin on each edge of every cell. Keep true transparent RGBA, no background halo, no cast shadow. Do not add labels, borders, grids, motion streaks, effects or any other objects. Return only the corrected 2x2 transparent atlas.

