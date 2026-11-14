// Presentation only. Physics and accepted input decide the state, never animation.
export const BOOST_POSE_SECONDS = .14;
export const LAND_POSE_SECONDS = .14;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function runnerPose(game, clock, { landAt = -1, landImpact = 0, reducedMotion = false } = {}) {
  const pose = { texture: 'motion', frame: 0, kind: 'run', stretchX: 1, stretchY: 1, angle: 0 };
  if (!game.grounded) {
    const boostAge = game.lastBoostAt === null ? Infinity : clock - game.lastBoostAt;
    if (game.jumpCount === 2 && boostAge >= 0 && boostAge < BOOST_POSE_SECONDS) {
      pose.texture = 'jump-land'; pose.frame = boostAge < .05 ? 0 : 1; pose.kind = 'boost';
      if (!reducedMotion) {
        const kick = Math.sin(Math.PI * boostAge / BOOST_POSE_SECONDS);
        pose.angle = -5 * kick; pose.stretchY = 1 + .025 * kick; pose.stretchX = 1 - .015 * kick;
      }
    } else {
      pose.frame = game.vy > 0 ? 6 : 7; pose.kind = game.vy > 0 ? 'rise' : 'fall';
      if (!reducedMotion) {
        // Smooth tilt through the apex; there is no animation wind-up before lift.
        pose.angle = clamp(-game.vy / 130, -4, 5);
        const age = game.lastJumpAt === null ? Infinity : clock - game.lastJumpAt;
        const lift = clamp(1 - age / .11, 0, 1);
        pose.stretchY = 1 + .035 * lift; pose.stretchX = 1 - .02 * lift;
      }
    }
    return pose;
  }
  const landedAgo = clock - landAt;
  if (landAt >= 0 && landedAgo >= 0 && landedAgo < LAND_POSE_SECONDS) {
    pose.texture = 'jump-land'; pose.frame = landedAgo < .065 ? 2 : 3; pose.kind = 'land';
    if (!reducedMotion) {
      const weight = clamp(landImpact / 700, .25, 1) * (1 - landedAgo / LAND_POSE_SECONDS);
      pose.stretchX = 1 + .035 * weight; pose.stretchY = 1 - .035 * weight;
    }
  } else {
    // Continue from the rear-push phase after contact/recovery, not an arbitrary
    // frame of the airborne global clock. New input always interrupts this pose.
    const sinceRun = landAt < 0 ? clock : Math.max(0, landedAgo - LAND_POSE_SECONDS);
    const pace = game.mode === 'gentle' ? 240 : 360;
    pose.frame = ((landAt < 0 ? 0 : 3) + Math.floor(sinceRun * 13 * pace / 360)) % 6;
  }
  return pose;
}

// The painted release kick extends ~25px below its virtual anchor. Keep its
// feet above an existing floor on very low second taps without moving physics.
export function actionFloorLift(pose, game) {
  if (pose.kind !== 'boost' || pose.frame !== 1 || !Number.isFinite(game.floorHeight)) return 0;
  return clamp(28 * pose.stretchY - Math.max(0, game.y - game.floorHeight), 0, 29);
}

// These transforms only decorate the selected painted pose. Reaction time is
// advanced by the engine's separate .85s clock, never the running world clock.
export function reactionPose(character, age, { reducedMotion = false } = {}) {
  const time = Math.max(0, Number.isFinite(age) ? age : 0);
  const pose = { frame: 0, offsetX: 0, offsetY: 0, stretchX: 1, stretchY: 1, angle: 0 };
  if (character.reaction.kind === 'hiss') {
    const settle = reducedMotion ? 1 : 1 + .035 * Math.sin(Math.PI * Math.min(1, time / .18));
    pose.stretchX = settle; pose.stretchY = 1 / settle;
  } else if (character.reaction.kind === 'tumble') {
    pose.frame = time < .13 ? 0 : time < .32 ? 1 : time < .55 ? 2 : 3;
    if (!reducedMotion) {
      // Art supplies the articulated somersault. Only a small forward scoot and
      // arc are procedural, returning to the unchanged collision-body anchor.
      const progress = clamp((time - .08) / .64, 0, 1);
      pose.offsetX = 15 * Math.sin(Math.PI * progress);
      pose.offsetY = -7 * Math.sin(Math.PI * progress);
    }
  } else if (character.reaction.kind === 'punch') {
    pose.frame = time < .12 ? 0 : time < .25 ? 1 : time < .52 ? 2 : 3;
    if (!reducedMotion) {
      const punch = Math.sin(Math.PI * clamp((time - .25) / .27, 0, 1));
      pose.stretchX = 1 + .035 * punch; pose.stretchY = 1 + .035 * punch;
    }
  }
  return pose;
}
