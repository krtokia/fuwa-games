// World resolution changes independently of HTML controls and text.
export const MIN_WORLD_WIDTH = 720;
export const MAX_WORLD_SCALE = .72;
export function worldViewport(cssWidth, cssHeight, ground = 338) {
  const w = Math.max(1, Number(cssWidth) || 440), h = Math.max(1, Number(cssHeight) || 400);
  const width = Math.ceil(Math.max(MIN_WORLD_WIDTH, w / MAX_WORLD_SCALE));
  const height = Math.ceil(h * width / w);
  return { width, height, scrollY: ground - height * .82, scale: w / width };
}
