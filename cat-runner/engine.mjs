// Pure, authored game rules. Renderers supply time; no random values or browser state.
export const MODES = Object.freeze({
  gentle: { label: '천천히', speed: 240, gap: 2 },
  normal: { label: '달리기', speed: 360, gap: 2 },
});
export function jumpCueSeconds(mode, obstacle) {
  if (obstacle?.taps === 2 || obstacle?.kind === 'stack') return mode === 'normal' ? .78 : .76;
  if (obstacle?.kind === 'planter') return mode === 'normal' ? .58 : .54;
  return mode === 'normal' ? .53 : .56;
}
export const ROUND_SECONDS = 44;
export const GROUND = 338;
export const CAT_X = 76;
export const GRAVITY = 800;
export const JUMP_SPEED = 380;
// A second tap resets upward speed, never adds velocity: at most ~180.5px total.
export const SECOND_JUMP_SPEED = 380;
export const FIXED_STEP = 1 / 120;
export const COURSE = Object.freeze([4, 6, 8, 10, 12, 15.5, 17.5, 19.5, 21.5, 23.5, 27, 29, 31, 33, 35, 37, 39, 41]);
// First learn the low arc, then a wider landing, then a clearly marked double tap.
// cueLead is normal-speed lead time; use jumpCueSeconds(mode, obstacle) in UI.
const PATTERN = ['crate', 'crate', 'crate', 'planter', 'stack',
  'crate', 'planter', 'stack', 'planter', 'stack',
  'crate', 'planter', 'stack', 'crate', 'stack', 'planter', 'stack', 'stack'];
const SHAPES = {
  crate: { w: 38, h: 30, taps: 1, hint: '상자는 한 번 톡!', cueLead: .53 },
  planter: { w: 78, h: 42, taps: 1, hint: '넓은 화분도 폴짝!', cueLead: .58 },
  stack: { w: 44, h: 112, taps: 2, hint: '높은 상자! 톡, 톡!', cueLead: .78 },
};
export const ENCOUNTERS = Object.freeze(COURSE.map((encounterAt, index) => Object.freeze({
  encounterAt, kind: PATTERN[index], ...SHAPES[PATTERN[index]],
  tutorial: index === 0 || index === 3 || index === 4,
})));
export const SEGMENTS = Object.freeze([
  { id: 'welcome', name: '가볍게 시작해요', start: 0, end: 3 },
  { id: 'practice', name: '하나씩 폴짝', start: 3, end: 13 },
  { id: 'recovery-one', name: '잠깐 숨 고르기', start: 13, end: 15 },
  { id: 'rhythm', name: '리듬을 타요', start: 15, end: 25 },
  { id: 'recovery-two', name: '간식 산책', start: 25, end: 26.5 },
  { id: 'flow', name: '사뿐사뿐', start: 26.5, end: 38 },
  { id: 'finale', name: '마지막 두 번!', start: 38, end: 42 },
  { id: 'finish', name: '도착이에요!', start: 42, end: ROUND_SECONDS },
].map(Object.freeze));
const SNACK_TIMES = [1.8, 2.5, 3.2, 14.6, 15.2, 25.4, 26, 35.4, 36, 42.3, 42.9];
export function createGame(mode = 'normal', width = 720) {
  if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) mode = 'normal';
  return { mode, width, status: 'ready', elapsed: 0, distance: 0, hearts: 3,
    snacks: 0, stars: 0, score: 0, combo: 0, y: 0, vy: 0, invincible: 0,
    jumpHeld: false, jumpCount: 0, pendingBoost: null,
    obstacles: [], treats: [], serial: 0, event: '', events: [], hitCount: 0,
    cleared: 0, streak: 0, bestStreak: 0, segment: SEGMENTS[0], progress: 0,
    courseIndex: 0, snackIndex: 0, accumulator: 0 };
}
// Atomic tap API. It cannot bypass an existing physical held press.
export function jump(game) {
  if (game.status !== 'running' || game.jumpHeld) return false;
  const accepted = pressJump(game);
  releaseJump(game);
  return accepted;
}
function requestJump(game) {
  if (game.jumpCount >= 2) return false;
  game.jumpCount++;
  game.vy = game.jumpCount === 1 ? JUMP_SPEED : SECOND_JUMP_SPEED;
  if (game.jumpCount === 2) {
    // Preserve the input location; step publishes this once on its next physics tick.
    game.pendingBoost = { x: CAT_X + 66, y: GROUND - game.y - 30 };
  }
  return true;
}
// Only a fresh press edge can jump. Landing resets the count, not the held latch.
// There is no landing buffer: a rejected third press is never replayed later.
export function pressJump(game) {
  if (game.status !== 'running' || game.jumpHeld) return false;
  game.jumpHeld = true;
  return requestJump(game);
}
// Call on key/pointer release, blur and before pausing. No trajectory is changed.
export function releaseJump(game) {
  game.jumpHeld = false;
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
  if (game.pendingBoost) {
    emit(game, 'boost', game.pendingBoost);
    game.pendingBoost = null;
  }
  if (game.y > 0 || game.vy > 0) {
    game.y += game.vy * dt - GRAVITY * dt * dt / 2;
    game.vy -= GRAVITY * dt;
    if (game.y <= 0) {
      game.y = 0; game.vy = 0; game.jumpCount = 0;
      emit(game, 'land');
    }
  }
  // Each authored encounter is when an obstacle's left edge reaches CAT_X + 70.
  // Encounter positions and timing never depend on the viewport. Wider screens
  // simply activate distant actors sooner, outside their visible right edge.
  const horizon = Math.max(2.4, (game.width + 80 - CAT_X - 70) / speed);
  while (game.courseIndex < COURSE.length && COURSE[game.courseIndex] - game.elapsed <= horizon) {
    const encounter = ENCOUNTERS[game.courseIndex++];
    const { encounterAt } = encounter;
    const x = CAT_X + 70 + speed * (encounterAt - game.elapsed);
    game.obstacles.push({ ...encounter, x, hit: false, cleared: false, id: game.serial++, encounterAt });
    for (let i = 0; i < 3; i++) game.treats.push({
      x: x - 40 + i * 40, y: GROUND - (encounter.taps === 2 ? 165 : 90) - (i === 1 ? 25 : 0),
      kind: encounter.taps === 2 && i === 1 ? 'star' : 'fish',
      value: encounter.taps === 2 && i === 1 ? 50 : 10,
      taken: false, id: game.serial++, encounterAt, offset: -40 + i * 40,
    });
  }
  while (game.snackIndex < SNACK_TIMES.length && SNACK_TIMES[game.snackIndex] - game.elapsed <= horizon) {
    const encounterAt = SNACK_TIMES[game.snackIndex++];
    game.treats.push({ x: CAT_X + 70 + speed * (encounterAt - game.elapsed),
      y: GROUND - 35, kind: 'fish', value: 10, taken: false, id: game.serial++, encounterAt, offset: 0 });
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
      game.streak = 0; game.combo = 0;
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
        game.combo = Math.min(5, game.streak);
        const value = 20 + 5 * (game.combo - 1);
        game.score += value;
        game.bestStreak = Math.max(game.bestStreak, game.streak);
        emit(game, 'clear', { id: obstacle.id, x: obstacle.x + 22, y: GROUND - 50, streak: game.streak, combo: game.combo, value, score: game.score, kind: obstacle.kind });
      }
    }
  }
  for (const treat of game.treats) {
    treat.x = Number.isFinite(treat.encounterAt)
      ? CAT_X + 70 + speed * (treat.encounterAt - game.elapsed) + treat.offset : treat.x - speed * dt;
    if (!treat.taken && overlaps(cat, { x: treat.x - 17, y: treat.y - 15, w: 34, h: 30 })) {
      treat.taken = true; game.snacks++;
      const kind = treat.kind || 'fish';
      const value = treat.value ?? 10;
      if (kind === 'star') game.stars++;
      game.score += value;
      emit(game, 'snack', { id: treat.id, x: treat.x, y: treat.y, kind, value, score: game.score });
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
