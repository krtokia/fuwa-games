// Pure, authored game rules. Renderers supply time; no random values or browser state.
export const MODES = Object.freeze({
  gentle: { label: '느긋하게', speed: 155, gap: 2.8 },
  normal: { label: '보통으로', speed: 215, gap: 2.8 },
});
export function jumpCueSeconds(mode) { return mode === 'normal' ? .53 : .56; }
export const ROUND_SECONDS = 44;
export const GROUND = 338;
export const CAT_X = 76;
export const GRAVITY = 800;
export const JUMP_SPEED = 380;
export const HOLD_SECONDS = .16;
export const HIGH_JUMP_APEX = 145;
export const FIXED_STEP = 1 / 120;
export const COURSE = Object.freeze([6, 9, 12, 17, 19.8, 22.6, 28, 30.8, 33.6, 38, 40.8]);
export const SEGMENTS = Object.freeze([
  { id: 'welcome', name: '가볍게 시작해요', start: 0, end: 5 },
  { id: 'practice', name: '하나씩 폴짝', start: 5, end: 14 },
  { id: 'recovery-one', name: '잠깐 숨 고르기', start: 14, end: 16 },
  { id: 'rhythm', name: '리듬을 타요', start: 16, end: 25 },
  { id: 'recovery-two', name: '간식 산책', start: 25, end: 27 },
  { id: 'flow', name: '사뿐사뿐', start: 27, end: 36 },
  { id: 'finale', name: '마지막 두 번!', start: 36, end: 42 },
  { id: 'finish', name: '도착이에요!', start: 42, end: ROUND_SECONDS },
].map(Object.freeze));
const SNACK_TIMES = [1.8, 2.5, 3.2, 14.6, 15.2, 25.4, 26, 35.4, 36, 42.3, 42.9];
export function createGame(mode = 'gentle', width = 720) {
  if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) mode = 'gentle';
  return { mode, width, status: 'ready', elapsed: 0, distance: 0, hearts: 3,
    snacks: 0, y: 0, vy: 0, invincible: 0, jumpBuffer: 0,
    jumpHeld: false, holdElapsed: 0, jumpBoosted: false, holdEligible: false, bufferHeld: false,
    obstacles: [], treats: [], serial: 0, event: '', events: [], hitCount: 0,
    cleared: 0, streak: 0, bestStreak: 0, segment: SEGMENTS[0], progress: 0,
    courseIndex: 0, snackIndex: 0, accumulator: 0 };
}
export function jump(game) { return requestJump(game, false); }
function requestJump(game, held) {
  if (game.status !== 'running') return false;
  if (game.y <= 0.01 && game.vy === 0) {
    game.vy = JUMP_SPEED;
    game.holdElapsed = 0; game.jumpBoosted = false;
    game.holdEligible = held && game.jumpHeld;
    game.jumpBuffer = 0;
    return true;
  }
  // No extra airborne jump: a tap is remembered only until a near landing.
  game.jumpBuffer = .12;
  game.bufferHeld = held;
  return false;
}
// A press edge may buffer a near-landing jump; continued holding never repeats.
export function pressJump(game) {
  if (game.status !== 'running' || game.jumpHeld) return false;
  game.jumpHeld = true;
  return requestJump(game, true);
}
// Call on key/pointer release, blur and before pausing to cancel a pending boost.
export function releaseJump(game) {
  game.jumpHeld = false;
  game.holdEligible = false;
  game.holdElapsed = 0;
}
export function catBounds(game) {
  return { x: CAT_X + 34, y: GROUND - game.y - 60, w: 65, h: 55 };
}
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function emit(game, type, details = {}) {
  game.events.push({ type, x: CAT_X + 66, y: GROUND - game.y - 30, ...details });
  // Terminal / hit feedback must not be hidden by a simultaneous snack or landing.
  const priority = { land: 0, boost: 1, clear: 2, snack: 3, hit: 4, won: 5, finished: 5 };
  if (!game.event || priority[type] >= priority[game.event]) game.event = type;
}
function tick(game, dt) {
  game.elapsed = Math.min(ROUND_SECONDS, game.elapsed + dt);
  const speed = MODES[game.mode].speed;
  game.distance = speed * game.elapsed;
  game.progress = game.elapsed / ROUND_SECONDS;
  game.segment = SEGMENTS.find(s => game.elapsed < s.end) || SEGMENTS.at(-1);
  game.invincible = Math.max(0, game.invincible - dt);
  game.jumpBuffer = Math.max(0, game.jumpBuffer - dt);
  if (game.y > 0 || game.vy > 0) {
    if (game.jumpHeld && game.holdEligible && !game.jumpBoosted) {
      game.holdElapsed += dt;
      if (game.holdElapsed >= HOLD_SECONDS - 1e-10) {
        game.vy = Math.sqrt(2 * GRAVITY * Math.max(0, HIGH_JUMP_APEX - game.y));
        game.jumpBoosted = true;
        emit(game, 'boost');
      }
    }
    game.y += game.vy * dt - GRAVITY * dt * dt / 2;
    game.vy -= GRAVITY * dt;
    if (game.y <= 0) {
      game.y = 0; game.vy = 0; game.holdEligible = false;
      emit(game, 'land');
      if (game.jumpBuffer > 0) requestJump(game, game.bufferHeld);
    }
  }
  // Each authored encounter is when a box's left edge reaches CAT_X + 70.
  // Encounter positions and timing never depend on the viewport. Wider screens
  // simply activate distant actors sooner, outside their visible right edge.
  const horizon = Math.max(2.4, (game.width + 80 - CAT_X - 70) / speed);
  while (game.courseIndex < COURSE.length && COURSE[game.courseIndex] - game.elapsed <= horizon) {
    const encounterAt = COURSE[game.courseIndex++];
    const x = CAT_X + 70 + speed * (encounterAt - game.elapsed);
    game.obstacles.push({ x, w: 34, h: 28, hit: false, cleared: false, id: game.serial++, encounterAt });
    for (let i = 0; i < 3; i++) game.treats.push({
      x: x - 40 + i * 40, y: GROUND - 90 - (i === 1 ? 45 : 0),
      taken: false, id: game.serial++, encounterAt, offset: -40 + i * 40,
    });
  }
  while (game.snackIndex < SNACK_TIMES.length && SNACK_TIMES[game.snackIndex] - game.elapsed <= horizon) {
    const encounterAt = SNACK_TIMES[game.snackIndex++];
    game.treats.push({ x: CAT_X + 70 + speed * (encounterAt - game.elapsed),
      y: GROUND - 35, taken: false, id: game.serial++, encounterAt, offset: 0 });
  }
  const cat = catBounds(game);
  for (const obstacle of game.obstacles) {
    obstacle.x = Number.isFinite(obstacle.encounterAt)
      ? CAT_X + 70 + speed * (obstacle.encounterAt - game.elapsed) : obstacle.x - speed * dt;
    // Sprite-wide pickup bounds remain welcoming; the body/box collision
    // cores forgive paws and cardboard corners at either jump height.
    const body = { x: CAT_X + 50, y: cat.y, w: 30, h: cat.h };
    if (!obstacle.hit && overlaps(body,
        { x: obstacle.x + 9, y: GROUND - obstacle.h + 5, w: obstacle.w - 18, h: obstacle.h - 5 })) {
      // Mark even protected contacts, so they cannot become a later hit or clean clear.
      obstacle.hit = true;
      game.streak = 0;
      if (game.invincible <= 0) {
        game.hearts = Math.max(0, game.hearts - 1);
        game.hitCount += 1;
        game.invincible = 2.2;
        emit(game, 'hit', { id: obstacle.id, x: obstacle.x + 22, y: GROUND - 22 });
        if (game.hearts === 0) {
          game.status = 'finished'; emit(game, 'finished'); return;
        }
      }
    }
    if (!obstacle.cleared && obstacle.x + obstacle.w <= cat.x) {
      obstacle.cleared = true;
      if (!obstacle.hit) {
        game.cleared++; game.streak++;
        game.bestStreak = Math.max(game.bestStreak, game.streak);
        emit(game, 'clear', { id: obstacle.id, x: obstacle.x + 22, y: GROUND - 50, streak: game.streak });
      }
    }
  }
  for (const treat of game.treats) {
    treat.x = Number.isFinite(treat.encounterAt)
      ? CAT_X + 70 + speed * (treat.encounterAt - game.elapsed) + treat.offset : treat.x - speed * dt;
    if (!treat.taken && overlaps(cat, { x: treat.x - 17, y: treat.y - 15, w: 34, h: 30 })) {
      treat.taken = true; game.snacks++;
      emit(game, 'snack', { id: treat.id, x: treat.x, y: treat.y });
    }
  }
  game.obstacles = game.obstacles.filter(o => o.x > -80);
  game.treats = game.treats.filter(t => t.x > -60 && !t.taken);
  if (game.elapsed >= ROUND_SECONDS - 1e-9) {
    game.elapsed = ROUND_SECONDS; game.progress = 1;
    game.distance = speed * ROUND_SECONDS;
    game.status = 'won'; emit(game, 'won');
  }
}
export function step(game, rawDt) {
  // Paused/terminal states are immutable, including their last frame's event list.
  if (game.status !== 'running') return;
  game.event = ''; game.events = [];
  if (!Number.isFinite(rawDt)) return;
  game.accumulator += Math.max(0, Math.min(rawDt, 1 / 30));
  while (game.accumulator >= FIXED_STEP - 1e-10 && game.status === 'running') {
    game.accumulator = Math.max(0, game.accumulator - FIXED_STEP);
    tick(game, FIXED_STEP);
  }
}
