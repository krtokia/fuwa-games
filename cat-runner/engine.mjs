// Pure, authored game rules. Renderers supply time; no random values or browser state.
export const MODES = Object.freeze({
  gentle: { label: '천천히', speed: 240, gap: 2 },
  normal: { label: '달리기', speed: 360, gap: 2 },
});
export function jumpCueSeconds(mode, obstacle) { return obstacle?.cueLead ?? .5; }
// Seconds after the accepted first press. The HUD and route tests share this.
export function secondJumpCueSeconds(mode, obstacle) { return obstacle?.secondCue ?? .18; }
export const ROUND_SECONDS = 44;
export const GROUND = 338;
export const CAT_X = 76;
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
export const FIXED_STEP = 1 / 120;
// A hit freezes the world. Only advanceReaction may run this separate clock.
export const HIT_REACTION_SECONDS = .85;
// Time-domain geometry keeps the same traversal/flight budget at both speeds.
export const TERRAIN = Object.freeze([
  { start: -10, end: 10, height: 0 },
  { start: 10.70, end: 14, height: 0 },
  { start: 14, end: 18, height: -54 },
  { start: 18, end: 23, height: 0 },
  { start: 23.70, end: 27, height: 0 },
  { start: 27, end: 31, height: 48 },
  { start: 31, end: 37, height: 0 },
  { start: 37.70, end: 60, height: 0 },
].map(Object.freeze));
const TERRAIN_EDGES = Object.freeze([...new Set(TERRAIN.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b));
const SHAPES = {
  crate: { duration: .12, h: 30, taps: 1, hint: '낮은 상자! 점프 준비', cueLead: .5 },
  long: { duration: .64, h: 32, taps: 2, hint: '긴 화분! 2단 점프 준비', cueLead: .5, secondCue: .18 },
  // Its 95px clearance threshold exceeds the 77.44px single-jump apex.
  // The early second cue leaves time to lift before the face, not above its middle.
  high: { duration: .16, h: 105, taps: 2, hint: '높은 상자! 2단 점프 준비', cueLead: .81, secondCue: .14 },
  gap: { duration: .70, h: 0, taps: 2, hint: '빈 바닥! 2단 점프 준비', cueLead: .5, secondCue: .18 },
  step: { duration: .18, h: 54, taps: 1, hint: '높아지는 길! 점프 준비', cueLead: .5 },
  drop: { duration: .18, h: 0, taps: 0, hint: '낮아지는 길, 사뿐!', cueLead: .5 },
};
export const ENCOUNTERS = Object.freeze([
  [4,'crate'], [7,'long'], [10,'gap'], [14,'drop'], [18,'step'],
  [20,'long'], [23,'gap'], [27,'step'], [31,'drop'], [33,'high'],
  [37,'gap'], [40,'long'],
].map(([encounterAt,kind],index)=>Object.freeze({encounterAt,kind,...SHAPES[kind],
  w: SHAPES[kind].duration * MODES.normal.speed, tutorial: index < 5})));
export const COURSE = Object.freeze(ENCOUNTERS.map(o=>o.encounterAt));
export function terrainSegments(game) {
  const speed=MODES[game.mode].speed;
  return TERRAIN.map(s=>({...s,x:CAT_X+70+speed*(s.start-game.elapsed),
    w:speed*(s.end-s.start),baseY:GROUND-s.height}));
}
export function floorAt(time) {
  return TERRAIN.find(s=>time>=s.start && time<s.end)?.height ?? null;
}
export function nextCue(game) {
  return game.obstacles.find(o=>!o.hit&&!o.cleared&&o.encounterAt>=game.elapsed-.1) ?? null;
}
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
    snacks: 0, stars: 0, score: 0, combo: 0, y: 0, vy: 0, grounded: true, floorHeight: 0, recoveryUntil: 0, invincible: 0,
    jumpHeld: false, jumpCount: 0, jumpStartedAt: null, lastJumpAt: null, lastBoostAt: null, pendingBoost: null,
    reactionElapsed: 0, reactionRemaining: 0,
    obstacles: [], treats: [], serial: 0, event: '', events: [], hitCount: 0,
    cleared: 0, streak: 0, bestStreak: 0, segment: SEGMENTS[0], progress: 0,
    courseIndex: 0, snackIndex: 0, accumulator: 0 };
}
// Atomic tap API. It cannot bypass an existing physical held press.
export function jump(game) {
  if (game.status !== 'running' || game.reactionRemaining > 0 || game.jumpHeld) return false;
  const accepted = pressJump(game);
  releaseJump(game);
  return accepted;
}
function requestJump(game) {
  if (game.jumpCount >= 2 || game.elapsed < game.recoveryUntil) return false;
  game.grounded = false;
  if (game.jumpCount === 0) game.jumpStartedAt = game.elapsed;
  game.jumpCount++;
  game.lastJumpAt = game.elapsed;
  game.vy = game.jumpCount === 1 ? JUMP_SPEED : SECOND_JUMP_SPEED;
  if (game.jumpCount === 2) {
    game.lastBoostAt = game.elapsed;
    // Preserve the input location; step publishes this once on its next physics tick.
    game.pendingBoost = { x: CAT_X + 66, y: GROUND - game.y - 30 };
  }
  return true;
}
// Only a fresh press edge can jump. Landing resets the count, not the held latch.
// There is no landing buffer: a rejected third press is never replayed later.
export function pressJump(game) {
  if (game.status !== 'running' || game.reactionRemaining > 0 || game.jumpHeld) return false;
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
  const priority = { recover: 4, fall: 4, land: 0, boost: 1, clear: 2, snack: 3, hit: 4, won: 5, finished: 5 };
  if (!game.event || priority[type] >= priority[game.event]) game.event = type;
}
function damage(game, details) {
  if (game.invincible > 0 || game.reactionRemaining > 0) return;
  game.hearts = Math.max(0, game.hearts - 1);
  game.hitCount++;
  game.invincible = 2.2;
  game.reactionElapsed = 0;
  game.reactionRemaining = HIT_REACTION_SECONDS;
  emit(game, 'hit', details);
  if (game.hearts === 0) {
    game.status = 'finished';
    emit(game, 'finished');
  }
}
// Foot support is at CAT_X+70; obstacle collision retains its forgiving body core.
// Land only on a descending crossing of an existing horizontal surface.
// Exact descending time to a surface, including an apex inside this interval.
function landingAfter(y, vy, floor) {
  const rise = Math.max(0, vy / RISE_GRAVITY);
  const apex = y + (vy > 0 ? vy * vy / (2 * RISE_GRAVITY) : 0);
  if (apex < floor) return Infinity;
  return vy > 0 ? rise + Math.sqrt(2 * (apex - floor) / FALL_GRAVITY)
    : (vy + Math.sqrt(vy * vy + 2 * FALL_GRAVITY * (y - floor))) / FALL_GRAVITY;
}
function advanceTerrain(game,dt) {
  const now=game.elapsed, previous=now-dt;
  game.floorHeight=floorAt(now);
  if (now < game.recoveryUntil) {
    game.grounded=true; game.vy=0; game.jumpCount=0;
    return;
  }
  // Split at every terrain boundary. A walk-off begins at the real edge, and a
  // raised face is tested at its crossing, never at the later end of the tick.
  const edges=TERRAIN_EDGES.filter(t=>t>previous&&t<=now);
  let cursor=previous;
  for (const end of [...edges,...(edges.at(-1)===now?[]:[now])]) {
    const floor=floorAt((cursor+end)/2);
    if (!(game.grounded && floor===game.y && game.vy<=0)) {
      if (game.grounded) game.jumpCount=Math.max(1,game.jumpCount);
      game.grounded=false;
      const duration=end-cursor;
      const landing=floor===null?Infinity:landingAfter(game.y,game.vy,floor);
      if (landing>=0 && landing<=duration+1e-10) {
        const impactSpeed=-flightAfter(game.y,game.vy,Math.min(duration,landing)).vy;
        game.y=floor;game.vy=0;game.grounded=true;game.jumpCount=0;
        emit(game,'land',{impactSpeed,at:cursor+landing});
      } else Object.assign(game,flightAfter(game.y,game.vy,duration));
    }
    const nextFloor=floorAt(end);
    if (nextFloor!==null && nextFloor>(floor??-Infinity) && game.y<nextFloor-1e-7) {
      const safe=TERRAIN.find(s=>s.start===end);
      recover(game,'wall',safe);return;
    }
    if (game.grounded && nextFloor!==game.y) {
      game.grounded=false;game.jumpCount=Math.max(1,game.jumpCount);
    }
    cursor=end;
  }
  if(game.y < -160) {
    const safe=TERRAIN.find(s=>s.start<=now && s.end>now) || TERRAIN.find(s=>s.start>now);
    recover(game,'fall',safe);
  }
}
function recover(game,reason,safe) {
  const encounter=game.obstacles.find(o=>!o.cleared&&o.encounterAt<=game.elapsed+.1&&
    o.encounterAt+o.duration+1>=game.elapsed);
  if(encounter) encounter.hit=true;
  game.streak=0;game.combo=0;
  damage(game,{reason});
  // A short explicit rescue carries the cat to the approaching safe lip without
  // advancing world time or letting one missed hole repeatedly drain hearts.
  game.y=safe.height;game.vy=0;game.grounded=true;game.jumpCount=0;
  game.recoveryUntil=Math.max(game.elapsed+.12,safe.start+.04);
  game.floorHeight=safe.height;game.pendingBoost=null;
  emit(game,'recover',{reason,until:game.recoveryUntil});
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
  advanceTerrain(game, dt);
  if (game.status !== 'running') return;
  // Each authored encounter is when an obstacle's left edge reaches CAT_X + 70.
  // Encounter positions and timing never depend on the viewport. Wider screens
  // simply activate distant actors sooner, outside their visible right edge.
  const horizon = Math.max(2.4, (game.width + 80 - CAT_X - 70) / speed);
  while (game.courseIndex < COURSE.length && COURSE[game.courseIndex] - game.elapsed <= horizon) {
    const encounter = ENCOUNTERS[game.courseIndex++];
    const { encounterAt } = encounter;
    const floorHeight = floorAt(encounterAt + .001) ?? floorAt(encounterAt - .001) ?? 0;
    const x = CAT_X + 70 + speed * (encounterAt - game.elapsed);
    game.obstacles.push({ ...encounter, w: encounter.duration*speed, floorHeight, baseY: GROUND-floorHeight, x, hit: false, cleared: false, id: game.serial++, encounterAt });
    // Rewards follow the traversed arc, not the leading edge. Double-jump
    // stars stay beyond a single low arc; high-stack rewards also sit above it.
    for (let i = 0; i < 3; i++) {
      const offset = encounter.taps === 2
        ? encounter.duration * speed * [.15, .5, .75][i]
        : encounter.taps === 0 ? speed * [.5, .7, .9][i] : -40 + i * 40;
      const height = encounter.kind === 'high' ? [165,180,165][i]
        : encounter.taps === 2 ? [125,180,160][i]
        : encounter.taps === 0 ? 35 : 80 + (i === 1 ? 20 : 0);
      const rewardFloor = encounter.taps === 0
        ? floorAt(encounterAt + offset / speed) ?? floorHeight : floorHeight;
      game.treats.push({ x: x + offset, y: GROUND - rewardFloor - height,
        kind: encounter.taps === 2 && i === 1 ? 'star' : 'fish',
        value: encounter.taps === 2 && i === 1 ? 50 : 10,
        taken: false, id: game.serial++, encounterAt, offset });
    }
  }
  while (game.snackIndex < SNACK_TIMES.length && SNACK_TIMES[game.snackIndex] - game.elapsed <= horizon) {
    const encounterAt = SNACK_TIMES[game.snackIndex++];
    game.treats.push({ x: CAT_X + 70 + speed * (encounterAt - game.elapsed),
      y: GROUND - (floorAt(encounterAt) ?? 0) - 35, kind: 'fish', value: 10, taken: false, id: game.serial++, encounterAt, offset: 0 });
  }
  const cat = catBounds(game);
  for (const obstacle of game.obstacles) {
    obstacle.x = Number.isFinite(obstacle.encounterAt)
      ? CAT_X + 70 + speed * (obstacle.encounterAt - game.elapsed) : obstacle.x - speed * dt;
    // Sprite-wide pickup bounds remain welcoming; the body/box collision
    // cores forgive paws and cardboard corners at either jump height.
    const body = { x: CAT_X + 50, y: cat.y, w: 30, h: cat.h };
    if (!obstacle.hit && ['crate','long','high',undefined].includes(obstacle.kind) && overlaps(body,
        { x: obstacle.x + 9, y: (obstacle.baseY ?? GROUND) - obstacle.h + 5, w: obstacle.w - 18, h: obstacle.h - 5 })) {
      // Mark even protected contacts, so they cannot become a later hit or clean clear.
      obstacle.hit = true;
      game.streak = 0; game.combo = 0;
      damage(game, { id: obstacle.id, x: obstacle.x + 22, y: GROUND - 22 });
      if (game.status === 'finished') return;
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
  game.obstacles = game.obstacles.filter(o => o.x + o.w > -80);
  game.treats = game.treats.filter(t => t.x > -60 && !t.taken);
  if (game.elapsed >= ROUND_SECONDS - 1e-9 && game.reactionRemaining <= 0) {
    game.elapsed = ROUND_SECONDS; game.progress = 1;
    game.distance = speed * ROUND_SECONDS;
    game.status = 'won'; emit(game, 'won');
  }
}
export function step(game, rawDt) {
  // Frozen/paused/terminal states keep even their last frame's event list.
  // Renderers consume events only after a world step, never on reaction frames.
  if (game.status !== 'running' || game.reactionRemaining > 0) return;
  game.event = ''; game.events = [];
  if (!Number.isFinite(rawDt)) return;
  game.accumulator += Math.max(0, Math.min(rawDt, 1 / 30));
  while (game.accumulator >= FIXED_STEP - 1e-10 && game.status === 'running') {
    game.accumulator = Math.max(0, game.accumulator - FIXED_STEP);
    tick(game, FIXED_STEP);
    if (game.reactionRemaining > 0) {
      // Discard the rest of this rendered frame: no queued physics after a hit.
      game.accumulator = 0;
      return;
    }
  }
}
// Explicit presentation-time API, including a last-heart reaction while finished.
// Manual pause blocks this clock too. Completion never advances or revives a world.
// True is returned exactly once, on the call that completes an active reaction.
export function advanceReaction(game, rawDt) {
  if (!['running','finished'].includes(game.status) || game.reactionRemaining <= 0 || !Number.isFinite(rawDt)) return false;
  const elapsed = Math.min(HIT_REACTION_SECONDS, game.reactionElapsed + Math.max(0, Math.min(rawDt, 1 / 30)));
  const complete = HIT_REACTION_SECONDS - elapsed <= 1e-10;
  game.reactionElapsed = complete ? HIT_REACTION_SECONDS : elapsed;
  game.reactionRemaining = complete ? 0 : HIT_REACTION_SECONDS - elapsed;
  return complete;
}
