# Moonlit alley environment v1

Generated with the built-in image_gen tool on 2026-11-09. New opaque environmental artwork, not derived by pixel-editing the existing cat assets. Both fuwa-generated.png and fuwa-motion-v1.png were visually inspected for the soft painterly realism and warm cream/gray character palette; the generation prompt described a matching environmental style. No external stock assets used.

## Integration and visual QA

- File: moonlit-alley-v1.png
- Requested native dimensions: 3072 × 1024 (3:1). Actual generated dimensions: 2172 × 724 (exact 3:1), RGB PNG, 2,239,954 bytes (2.14 MiB). The built-in generator did not honor the requested pixel dimensions; no artificial upscaling was applied. This still provides 1.81× the intended 1200 × 400 display resolution.
- Image reviewed at full panorama: straight side-view Korean tiled-roof homes, warm windows and lanterns, deep blue/teal atmosphere, no text, moon, characters, pickups, or UI.
- Keep the full image (no crop) for the intended 1200 × 400 backdrop. The lower approximately 26% is quiet dark teal foundation, deliberately reserved for readable gameplay. Draw game ground separately over the bottom as needed.
- The top approximately 20% supplies relatively quiet sky. Keep high-contrast HUD on its own backing rather than over windows.
- The edges are similar in palette and roof treatment, but this generated image is NOT certified pixel-seamless: roof and wall details differ at the two ends. Use slow bounded parallax for the first segment, or alternating mirrored tiles with a low-opacity edge blend at runtime; ordinary direct horizontal wrapping can reveal a join. A strict seamless production tile would need a dedicated follow-up generation/edit and wrap testing.
- Artwork is more traditional hanok residential street than contemporary apartment alley. It retains Korean identity and the requested warm storybook mood.
- No file or consuming game code beyond this asset and provenance document was changed by the environment generation worker.

## Exact generation prompt

Use case: illustration-story.
Asset type: production 2D side-scrolling runner game environmental backdrop, native panoramic 3072 x 1024 pixels, 3:1 aspect, intended to display at 1200 x 400 with slow horizontal parallax.
Primary request: A cohesive moonlit Korean residential neighborhood alley in charming polished painterly storybook realism, finely brushed soft texture and dimensional lighting that pairs naturally with a realistic fluffy cream-and-gray long-haired cat sprite. Environment only, DO NOT depict a cat or any character.
Scene: a wide continuous row of small Korean homes with ceramic roof tiles, modest plaster and brick walls, warm glowing rectangular windows, a few strings of small warm lanterns and potted greenery on ledges. Subtle distant roof silhouettes. Deep teal and ink blue dusk palette, restrained warm amber window light, calm inviting nighttime atmosphere. 
Composition: straight side-view 2D platformer elevation, no vanishing-point street, no central perspective path. Many buildings continue horizontally across the wide image; not a poster, no central hero subject. Highest detail in upper and middle areas. Lower 20 percent is a continuous dark muted teal wall/foundation with very quiet low-contrast texture and no distinct objects, giving a clearly readable negative-contrast gameplay zone for separately rendered cat and obstacles. Ground surface is rendered separately: do not paint a foreground pavement or platform. The lower foundation reaches the bottom edge.
Tileability: align left and right edge sky, rooftop level, foundation level, palette and texture for a horizontally repeatable panorama; avoid conspicuous objects crossing either edge and avoid framing plants. Left and right outer edges should be similarly dark and simple. Keep upper sky soft and sparse.
Constraints: full opaque background, no transparency. No moon (a moon is rendered separately by game), no foreground characters or animals, no game obstacles or pickups, no foreground props, no interface, no border, no text or signage, no logos or watermark. Clean professional game environment art with beautiful material textures but no noisy detail near the bottom.

