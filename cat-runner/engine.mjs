// Pure game rules: no browser, network, timers or storage dependencies.
export const MODES = Object.freeze({
  gentle: { label: '느긋하게', speed: 155, gap: 4.0 },
  normal: { label: '보통으로', speed: 215, gap: 3.1 },
});
export function jumpCueSeconds(mode) { return mode === 'normal' ? .7 : .65; }
export const ROUND_SECONDS = 60;
export const GROUND = 338;
export const CAT_X = 76;
export const GRAVITY = 1250;
export const JUMP_SPEED = 740;
export function createGame(mode = 'gentle', width = 720) {
  if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) mode = 'gentle';
  return { mode, width, status: 'ready', elapsed: 0, distance: 0, hearts: 3,
    snacks: 0, y: 0, vy: 0, invincible: 0, jumpBuffer: 0, nextObstacle: 5.2,
    nextSnack: 1.5, obstacles: [], treats: [], serial: 0, event: '', hitCount: 0 };
}
export function jump(game) {
  if (game.status !== 'running') return false;
  if (game.y <= 0.01 && game.vy === 0) {
    game.vy = JUMP_SPEED;
    game.jumpBuffer = 0;
    return true;
  }
  // A slightly early tap just before landing is remembered.
  game.jumpBuffer = 0.12;
  return false;
}
export function catBounds(game) {
  return { x: CAT_X + 34, y: GROUND - game.y - 60, w: 65, h: 55 };
}
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function step(game, rawDt) {
  if (game.status !== 'running') return;
  const dt = Math.max(0, Math.min(rawDt, 1 / 30));
  game.event = '';
  game.elapsed += dt;
  const speed = MODES[game.mode].speed;
  game.distance += speed * dt;
  game.invincible = Math.max(0, game.invincible - dt);
  game.jumpBuffer = Math.max(0, game.jumpBuffer - dt);
  if (game.y > 0 || game.vy > 0) {
    game.y += game.vy * dt;
    game.vy -= GRAVITY * dt;
    if (game.y <= 0) {
      game.y = 0; game.vy = 0;
      if (game.jumpBuffer > 0) jump(game);
    }
  }
  game.nextObstacle -= dt;
  game.nextSnack -= dt;
  if (game.nextObstacle <= 0) {
    game.obstacles.push({ x: game.width + 55, w: 44, h: 42, hit: false, id: game.serial++ });
    game.nextObstacle = MODES[game.mode].gap + (game.serial % 3) * 0.35;
    // A little arch of treats shows a comfortable jump path.
    for (let i = 0; i < 3; i++) game.treats.push({ x: game.width + 8 + i * 48, y: GROUND - 98 - (i === 1 ? 22 : 0), taken: false });
  }
  if (game.nextSnack <= 0) {
    const x = game.width + 70;
    // Never lure the player into the middle of a box.
    if (!game.obstacles.some(o => Math.abs(o.x - x) < 180))
      game.treats.push({ x, y: GROUND - 35, taken: false });
    game.nextSnack = 1.5;
  }
  const cat = catBounds(game);
  for (const obstacle of game.obstacles) {
    obstacle.x -= speed * dt;
    if (!obstacle.hit && game.invincible === 0 && overlaps(cat,
        { x: obstacle.x + 6, y: GROUND - obstacle.h + 5, w: obstacle.w - 12, h: obstacle.h - 5 })) {
      obstacle.hit = true;
      game.hearts -= 1;
      game.hitCount += 1;
      game.invincible = 2.2;
      game.event = 'hit';
      if (game.hearts === 0) { game.status = 'finished'; game.event = 'finished'; }
    }
  }
  for (const treat of game.treats) {
    treat.x -= speed * dt;
    if (!treat.taken && overlaps(cat, { x: treat.x - 17, y: treat.y - 15, w: 34, h: 30 })) {
      treat.taken = true;
      game.snacks += 1;
      if (!game.event) game.event = 'snack';
    }
  }
  game.obstacles = game.obstacles.filter(o => o.x > -80);
  game.treats = game.treats.filter(t => t.x > -60 && !t.taken);
  if (game.elapsed >= ROUND_SECONDS && game.status === 'running') {
    game.elapsed = ROUND_SECONDS;
    game.status = 'won'; game.event = 'won';
  }
}
