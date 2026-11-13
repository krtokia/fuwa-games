// World resolution changes independently of HTML controls and text.
export const MIN_WORLD_WIDTH = 720;
export const MAX_WORLD_SCALE = .72;
export function worldViewport(cssWidth, cssHeight, ground = 338) {
  const w = Math.max(1, Number(cssWidth) || 440), h = Math.max(1, Number(cssHeight) || 400);
  const width = Math.ceil(Math.max(MIN_WORLD_WIDTH, w / MAX_WORLD_SCALE));
  const height = Math.ceil(h * width / w);
  return { width, height, scrollY: ground - height * .82, scale: w / width };
}

// Keep the complete cat and reaction label visible on third-floor jumps.
// The lower street stays fixed until the cat approaches the top safety margin.
export function verticalCameraTop(worldHeight, catHeight=0, ground=338) {
  const height=Math.max(1,Number(worldHeight)||420);
  const base=ground-height*.82;
  return Math.min(base,ground-Math.max(0,Number(catHeight)||0)-160);
}
