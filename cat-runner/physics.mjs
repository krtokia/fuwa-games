// Pure ballistic primitives. Rewards observe these rules; they never change them.
// Immediate launch, shorter ascent and stronger downward pull; holding has no effect.
export const RISE_GRAVITY = 1250;
export const FALL_GRAVITY = 1600;
export const GRAVITY = RISE_GRAVITY; // Compatibility alias, not the descent gravity.
export const JUMP_SPEED = 440;
// A fresh air tap resets velocity, never adds it. Maximum combined apex: 185.60px.
export const SECOND_JUMP_SPEED = 520;
export const SINGLE_JUMP_APEX = JUMP_SPEED ** 2 / (2 * RISE_GRAVITY);
export const SINGLE_JUMP_SECONDS = JUMP_SPEED / RISE_GRAVITY + Math.sqrt(2 * SINGLE_JUMP_APEX / FALL_GRAVITY);
// Integrate through the apex exactly, rather than applying one gravity to a whole tick.
export function flightAfter(y, vy, dt) {
  const rise = vy > 0 ? Math.min(dt, vy / RISE_GRAVITY) : 0;
  y += vy * rise - RISE_GRAVITY * rise * rise / 2;
  vy -= RISE_GRAVITY * rise;
  const fall = dt - rise;
  return { y: y + vy * fall - FALL_GRAVITY * fall * fall / 2,
    vy: vy - FALL_GRAVITY * fall };
}
// Exact descending crossing time shared by the live engine and route planner.
export function landingAfter(y, vy, floor) {
  const rise = Math.max(0, vy / RISE_GRAVITY);
  const apex = y + (vy > 0 ? vy * vy / (2 * RISE_GRAVITY) : 0);
  if (apex < floor) return Infinity;
  return vy > 0 ? rise + Math.sqrt(2 * (apex - floor) / FALL_GRAVITY)
    : (vy + Math.sqrt(vy * vy + 2 * FALL_GRAVITY * (y - floor))) / FALL_GRAVITY;
}
