// Pure seeded game rules. Renderers supply time; no browser state.
import { createCourse, ensureCourse, normalizeSeed, POTION_SECONDS } from './course.mjs';
export { POTION_SECONDS } from './course.mjs';
import { JUMP_SPEED, SECOND_JUMP_SPEED, flightAfter, landingAfter } from './physics.mjs';
export { RISE_GRAVITY, FALL_GRAVITY, GRAVITY, JUMP_SPEED, SECOND_JUMP_SPEED, SINGLE_JUMP_APEX, SINGLE_JUMP_SECONDS, flightAfter } from './physics.mjs';
import { rewardsForEncounter, restReward, bonusRouteFor } from './rewards.mjs';
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
export const FIXED_STEP = 1 / 120;
// A hit freezes the world. Only advanceReaction may run this separate clock.
export const HIT_REACTION_SECONDS = .85;
// Only the bounded, currently generated terrain is retained.
export function terrainSegments(game) {
  const speed=MODES[game.mode].speed;
  return [...game.course.terrain,...(game.course.platforms??[]).map(s=>({...s,oneWay:true}))].map(s=>({...s,x:CAT_X+70+speed*(s.start-game.elapsed),
    w:speed*(s.end-s.start),baseY:GROUND-s.height}));
}
export function floorAt(time,game) {
  return game?.course.terrain.find(s=>time>=s.start && time<s.end)?.height ?? null;
}
// One-way decks are landing surfaces, not solid walls. Keep floorAt's baseline
// semantics for legacy course/reward planning; renderers use supportingFloorAt.
function surfacesAt(time,game) {
  return [...game.course.terrain,...(game.course.platforms??[])]
    .filter(s=>time>=s.start&&time<s.end);
}
export function supportingFloorAt(time,game,y=game.y) {
  const heights=surfacesAt(time,game).map(s=>s.height).filter(height=>height<=y+1e-7);
  return heights.length?Math.max(...heights):null;
}
export function obstacleRouteRelevant(game,obstacle) {
  if(!obstacle.upperRoute)return !(game.floorHeight>obstacle.floorHeight+obstacle.h+8 && game.y>obstacle.floorHeight+obstacle.h+8);
  return game.y>=obstacle.floorHeight-8 &&
    (game.floorHeight===null||game.floorHeight<=obstacle.floorHeight+8);
}
export function nextCue(game) {
  return game.obstacles.find(o=>!o.hit&&!o.cleared&&o.encounterAt>=game.elapsed-.1&&obstacleRouteRelevant(game,o)) ?? null;
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
function advanceTerrain(game,dt) {
  const now=game.elapsed, previous=now-dt;
  if (now < game.recoveryUntil) {
    game.grounded=true; game.vy=0; game.jumpCount=0;
    return;
  }
  // Include every deck edge even when the generated solid-edge cache exists.
  // Each subinterval has a constant set of horizontal landing surfaces.
  const platforms=game.course.platforms??[];
  const edges=[...new Set([
    ...(game.course.terrainEdges??game.course.terrain.flatMap(s=>[s.start,s.end])),
    ...platforms.flatMap(s=>[s.start,s.end]),
  ])].filter(t=>t>previous&&t<=now).sort((a,b)=>a-b);
  let cursor=previous;
  for (const end of [...edges,...(edges.at(-1)===now?[]:[now])]) {
    const midpoint=(cursor+end)/2, surfaces=surfacesAt(midpoint,game);
    const floor=floorAt(midpoint,game);
    const supported=surfaces.some(s=>Math.abs(s.height-game.y)<1e-7);
    if (!(game.grounded && supported && game.vy<=0)) {
      if (game.grounded) game.jumpCount=Math.max(1,game.jumpCount);
      game.grounded=false;
      const duration=end-cursor;
      // landingAfter returns the descending crossing, including when an
      // ascending cat passes through a deck before coming down onto it.
      const crossings=surfaces.map(s=>({height:s.height,at:landingAfter(game.y,game.vy,s.height)}))
        .filter(s=>Number.isFinite(s.at)&&s.at>=0&&s.at<=duration+1e-10)
        .sort((a,b)=>a.at-b.at||b.height-a.height);
      const landing=crossings[0];
      if (landing) {
        const impactSpeed=-flightAfter(game.y,game.vy,Math.min(duration,landing.at)).vy;
        game.y=landing.height;game.vy=0;game.grounded=true;game.jumpCount=0;
        emit(game,'land',{impactSpeed,at:cursor+landing.at,height:landing.height});
      } else Object.assign(game,flightAfter(game.y,game.vy,duration));
    }
    // Only solid terrain faces damage the cat. A deck beginning above or
    // beside the cat never snaps it upward or consumes a life.
    const nextFloor=floorAt(end,game);
    if (nextFloor!==null && nextFloor>(floor??-Infinity) && game.y<nextFloor-1e-7) {
      const safe=game.course.terrain.find(s=>s.start===end);
      recover(game,'wall',safe);return;
    }
    if (game.grounded && !surfacesAt(end,game).some(s=>Math.abs(s.height-game.y)<1e-7)) {
      game.grounded=false;game.jumpCount=Math.max(1,game.jumpCount);
    }
    cursor=end;
  }
  game.floorHeight=supportingFloorAt(now,game);
  if(game.y < -160) {
    const all=[...game.course.terrain,...platforms];
    const safe=all.filter(s=>s.start<=now&&s.end>now).sort((a,b)=>a.height-b.height)[0]
      ?? all.filter(s=>s.start>now).sort((a,b)=>a.start-b.start||a.height-b.height)[0];
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
    const baselineHeight = floorAt(encounterAt + .001,game) ?? floorAt(encounterAt - .001,game) ?? 0;
    const floorHeight = Number.isFinite(encounter.floorHeight)?encounter.floorHeight:baselineHeight;
    const upperRoute=Number.isFinite(encounter.floorHeight)&&floorHeight>baselineHeight+1;
    const x = CAT_X + 70 + speed * (encounterAt - game.elapsed);
    game.obstacles.push({ ...encounter, w: encounter.duration*speed, floorHeight, upperRoute, routeVisited:false, baseY: GROUND-floorHeight, x, hit: false, cleared: false, id: game.serial++ });
    const chunk=game.course.chunks.find(c=>c.index===encounter.chunkIndex);
    const bonus=bonusRouteFor(encounter);
    if(bonus) Object.assign(game.obstacles.at(-1),bonus);
    for(const reward of rewardsForEncounter(chunk,encounter)) {
      game.treats.push({ ...reward, x: CAT_X + 66.5 + speed * (reward.sampleAt - game.elapsed),
        y: GROUND - reward.height, taken:false, id:game.serial++,
        encounterAt:reward.sampleAt, offset:-3.5 });
    }
  }
  for(const pickup of game.course.pickups) {
    if(pickup.index<game.pickupIndex) continue;
    if(pickup.encounterAt-game.elapsed>horizon) break;
    game.pickupIndex=pickup.index+1;
    const chunk=game.course.chunks.find(c=>c.index===pickup.chunkIndex);
    const reward=restReward(chunk,pickup);
    if(!reward) continue;
    const {kind,value,patternId,chunkIndex}=pickup;
    game.treats.push({ ...reward, x: CAT_X + 66.5 + speed * (reward.sampleAt - game.elapsed),
      y: GROUND - reward.height, kind,value,patternId,chunkIndex,
      taken:false,id:game.serial++,encounterAt:reward.sampleAt,offset:-3.5 });
  }
  const cat = catBounds(game);
  for (const obstacle of game.obstacles) {
    obstacle.x = Number.isFinite(obstacle.encounterAt)
      ? CAT_X + 70 + speed * (obstacle.encounterAt - game.elapsed) : obstacle.x - speed * dt;
    // Sprite-wide pickup bounds remain welcoming; the body/box collision
    // cores forgive paws and cardboard corners at either jump height.
    const body = { x: CAT_X + 50, y: cat.y, w: 30, h: cat.h };
    if(obstacle.upperRoute&&obstacleRouteRelevant(game,obstacle)&&
        obstacle.x<body.x+body.w&&obstacle.x+obstacle.w>body.x)obstacle.routeVisited=true;
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
      if (!obstacle.hit && (!obstacle.upperRoute||obstacle.routeVisited)) {
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
      emit(game, 'snack', { id: treat.id, x: treat.x, y: treat.y, kind, value, score: game.score, route:treat.route??'main', optional:treat.optional??false, routeId:treat.routeId, sampleAt:treat.sampleAt });
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
