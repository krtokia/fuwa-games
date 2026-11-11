// Pure seeded game rules. Renderers supply time; no browser state.
import { createCourse, ensureCourse, normalizeSeed, POTION_SECONDS } from './course.mjs';
export { POTION_SECONDS } from './course.mjs';
export const MODES = Object.freeze({
  gentle: { label: '천천히', speed: 240, gap: 2 },
  normal: { label: '달리기', speed: 360, gap: 2 },
});
export function jumpCueSeconds(mode, obstacle) { return obstacle?.cueLead ?? .5; }
// Seconds after the accepted first press. The HUD and route tests share this.
export function secondJumpCueSeconds(mode, obstacle) { return obstacle?.secondCue ?? .18; }
export const STARTING_SECONDS = 30;
export const COLLISION_PENALTY_SECONDS = 5;
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
// Only the bounded, currently generated terrain is retained.
export function terrainSegments(game) {
  const speed=MODES[game.mode].speed;
  return game.course.terrain.map(s=>({...s,x:CAT_X+70+speed*(s.start-game.elapsed),
    w:speed*(s.end-s.start),baseY:GROUND-s.height}));
}
export function floorAt(time,game) {
  return game?.course.terrain.find(s=>time>=s.start && time<s.end)?.height ?? null;
}
export function nextCue(game) {
  return game.obstacles.find(o=>!o.hit&&!o.cleared&&o.encounterAt>=game.elapsed-.1) ?? null;
}
function horizonFor(game) {
  return Math.max(2.4,(game.width+80-CAT_X-70)/MODES[game.mode].speed);
}
export function createGame(mode = 'normal', width = 720, options = {}) {
  if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) mode = 'normal';
  if (!Number.isFinite(width) || width<=0) width=720;
  options=options&&typeof options==='object'?options:{};
  const seed=normalizeSeed(options.seed);
  const collisionPenaltySeconds=Number.isFinite(options.collisionPenaltySeconds)&&options.collisionPenaltySeconds>=0
    ? options.collisionPenaltySeconds : COLLISION_PENALTY_SECONDS;
  const game={ mode, width, seed, status: 'ready', elapsed: 0, distance: 0,
    remainingTime:STARTING_SECONDS,collisionPenaltySeconds,potions:0,endReason:null,
    snacks: 0, stars: 0, score: 0, combo: 0, y: 0, vy: 0, grounded: true, floorHeight: 0, recoveryUntil: 0, invincible: 0,
    jumpHeld: false, jumpCount: 0, jumpStartedAt: null, lastJumpAt: null, lastBoostAt: null, pendingBoost: null,
    reactionElapsed: 0, reactionRemaining: 0,
    obstacles: [], treats: [], serial: 0, event: '', events: [], hitCount: 0,
    cleared: 0, streak: 0, bestStreak: 0, segment: null, progress: 1,
    course:createCourse(seed),courseIndex:0,pickupIndex:0,accumulator:0 };
  ensureCourse(game.course,horizonFor(game)+6);
  game.segment=game.course.chunks[0];
  return game;
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
  const priority = { recover: 4, fall: 4, land: 0, boost: 1, clear: 2, snack: 3, potion: 3, hit: 4, finished: 5 };
  if (!game.event || priority[type] >= priority[game.event]) game.event = type;
}
function damage(game, details) {
  if (game.invincible > 0 || game.reactionRemaining > 0) return;
  game.remainingTime = Math.max(0, game.remainingTime - game.collisionPenaltySeconds);
  game.progress=Math.min(1,game.remainingTime/STARTING_SECONDS);
  game.hitCount++;
  game.invincible = 2.2;
  game.reactionElapsed = 0;
  game.reactionRemaining = HIT_REACTION_SECONDS;
  emit(game, 'hit', {...details,seconds:game.collisionPenaltySeconds,remainingTime:game.remainingTime});
  if (game.remainingTime === 0) finishRun(game,'collision');
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
  game.floorHeight=floorAt(now,game);
  if (now < game.recoveryUntil) {
    game.grounded=true; game.vy=0; game.jumpCount=0;
    return;
  }
  // Split at every terrain boundary. A walk-off begins at the real edge, and a
  // raised face is tested at its crossing, never at the later end of the tick.
  const edges=(game.course.terrainEdges??[...new Set(game.course.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b)).filter(t=>t>previous&&t<=now);
  let cursor=previous;
  for (const end of [...edges,...(edges.at(-1)===now?[]:[now])]) {
    const floor=floorAt((cursor+end)/2,game);
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
    const nextFloor=floorAt(end,game);
    if (nextFloor!==null && nextFloor>(floor??-Infinity) && game.y<nextFloor-1e-7) {
      const safe=game.course.terrain.find(s=>s.start===end);
      recover(game,'wall',safe);return;
    }
    if (game.grounded && nextFloor!==game.y) {
      game.grounded=false;game.jumpCount=Math.max(1,game.jumpCount);
    }
    cursor=end;
  }
  if(game.y < -160) {
    const safe=game.course.terrain.find(s=>s.start<=now && s.end>now) || game.course.terrain.find(s=>s.start>now);
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
  // advancing world time or letting one missed hole repeatedly drain time.
  if (!safe) safe={height:0,start:game.elapsed};
  game.y=safe.height;game.vy=0;game.grounded=true;game.jumpCount=0;
  game.recoveryUntil=Math.max(game.elapsed+.12,safe.start+.04);
  game.floorHeight=safe.height;game.pendingBoost=null;
  emit(game,'recover',{reason,until:game.recoveryUntil});
}
function finishRun(game,reason) {
  game.remainingTime=0;game.progress=0;game.status='finished';game.endReason=reason;
  emit(game,'finished',{reason});
}
function tick(game, dt) {
  // Time and distance both stop at the exact remaining lifetime, never at a
  // hidden course length. A pickup after expiry cannot revive the run.
  dt=Math.min(dt,game.remainingTime);
  game.elapsed += dt;
  game.remainingTime=Math.max(0,game.remainingTime-dt);
  const speed = MODES[game.mode].speed;
  game.distance = speed * game.elapsed;
  game.progress = Math.min(1,game.remainingTime/STARTING_SECONDS);
  const horizon=horizonFor(game);
  ensureCourse(game.course,game.elapsed+horizon+6,game.elapsed-3);
  game.segment=game.course.chunks.find(chunk=>game.elapsed>=chunk.start&&game.elapsed<chunk.end)??game.course.chunks.at(-1);
  game.invincible = Math.max(0, game.invincible - dt);
  if (game.pendingBoost) {
    emit(game, 'boost', game.pendingBoost);
    game.pendingBoost = null;
  }
  if(game.remainingTime<=1e-9) { finishRun(game,'timeout');return; }
  advanceTerrain(game, dt);
  if (game.status !== 'running' || game.reactionRemaining>0) return;
  for(const encounter of game.course.encounters) {
    if(encounter.index<game.courseIndex) continue;
    if(encounter.encounterAt-game.elapsed>horizon) break;
    game.courseIndex=encounter.index+1;
    const { encounterAt } = encounter;
    const floorHeight = floorAt(encounterAt + .001,game) ?? floorAt(encounterAt - .001,game) ?? 0;
    const x = CAT_X + 70 + speed * (encounterAt - game.elapsed);
    game.obstacles.push({ ...encounter, w: encounter.duration*speed, floorHeight, baseY: GROUND-floorHeight, x, hit: false, cleared: false, id: game.serial++ });
    for (let i = 0; i < 3; i++) {
      const offset = encounter.taps === 2
        ? encounter.duration * speed * [.15, .5, .75][i]
        : encounter.taps === 0 ? speed * [.5, .7, .9][i] : -40 + i * 40;
      const height = encounter.kind === 'high' ? [165,180,165][i]
        : encounter.taps === 2 ? [125,180,160][i]
        : encounter.taps === 0 ? 35 : 80 + (i === 1 ? 20 : 0);
      const rewardFloor = encounter.taps === 0
        ? floorAt(encounterAt + offset / speed,game) ?? floorHeight : floorHeight;
      game.treats.push({ x: x + offset, y: GROUND - rewardFloor - height,
        kind: encounter.taps === 2 && i === 1 ? 'star' : 'fish',
        value: encounter.taps === 2 && i === 1 ? 50 : 10,
        taken: false, id: game.serial++, encounterAt, offset });
    }
  }
  for(const pickup of game.course.pickups) {
    if(pickup.index<game.pickupIndex) continue;
    if(pickup.encounterAt-game.elapsed>horizon) break;
    game.pickupIndex=pickup.index+1;
    const {encounterAt,kind,value,patternId,chunkIndex}=pickup;
    game.treats.push({ x: CAT_X + 70 + speed * (encounterAt - game.elapsed),
      y: GROUND - (floorAt(encounterAt,game) ?? 0) - pickup.height,
      kind,value,patternId,chunkIndex,taken:false,id:game.serial++,encounterAt,offset:0 });
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
      if (game.reactionRemaining > 0 || game.status === 'finished') return;
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
      treat.taken = true;
      const kind = treat.kind || 'fish';
      if(kind==='potion') {
        game.potions++;game.remainingTime+=POTION_SECONDS;
        game.progress=Math.min(1,game.remainingTime/STARTING_SECONDS);
        emit(game,'potion',{id:treat.id,x:treat.x,y:treat.y,kind,seconds:POTION_SECONDS,value:POTION_SECONDS,remainingTime:game.remainingTime});
        continue;
      }
      game.snacks++;
      const value = treat.value ?? 10;
      if (kind === 'star') game.stars++;
      game.score += value;
      emit(game, 'snack', { id: treat.id, x: treat.x, y: treat.y, kind, value, score: game.score });
    }
  }
  game.obstacles = game.obstacles.filter(o => o.x + o.w > -80);
  game.treats = game.treats.filter(t => t.x > -60 && !t.taken);

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
// Explicit presentation-time API, including a final time-penalty reaction.
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
