// Source/asset contracts, not a substitute for real browser and touch QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { STARTING_SECONDS, POTION_SECONDS, COLLISION_PENALTY_SECONDS } from '../engine.mjs';
const file=p=>new URL('../'+p,import.meta.url);
const html=readFileSync(file('index.html'),'utf8');
const game=readFileSync(file('game.mjs'),'utf8');
test('all UI targets referenced by the Phaser controller exist',()=>{
 const ids=[...game.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of ids)assert(html.includes(`id="${id}"`),id);
});
test('local Phaser runtime loads before game module',()=>{
 const runtime='./vendor/phaser-3.90.0.min.js';assert(html.includes(runtime));
 assert(html.indexOf(runtime)<html.indexOf('./game.mjs'));
 assert(!/<script[^>]+src="https?:/.test(html));
});
test('all static relative page assets exist',()=>{
 for(const [,path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert(existsSync(file(path)),path);
});
test('generated PNG is a full-size RGBA raster, not an SVG replacement',()=>{
 const data=readFileSync(file('assets/fuwa-generated.png'));
 assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),1536);assert.equal(data.readUInt32BE(20),1024);
 assert.equal(data[25],6);assert(/this\.load\.image\('fuwa',\s*'\.\/assets\/fuwa-generated\.png'\)/.test(game));assert(!game.includes('fuwa.svg'));
});
test('HTML explains the time budget and labels the remaining-time meter',()=>{
 assert.equal(STARTING_SECONDS,30);assert.equal(POTION_SECONDS,10);assert.equal(COLLISION_PENALTY_SECONDS,5);
 assert(html.includes(`aria-valuemax="${STARTING_SECONDS}"`));assert(html.includes(`aria-valuenow="${STARTING_SECONDS}"`));
 assert(html.includes(`aria-label="남은 시간"`));
 assert(html.includes(`${STARTING_SECONDS}초 시작 · 포션 +${POTION_SECONDS}초 · 충돌 -${COLLISION_PENALTY_SECONDS}초`));
 assert(game.includes('Math.ceil(game.remainingTime)'));
});
test('jump acts on pointer-down, tab loss pauses, responsive resize pauses',()=>{
 assert(game.includes("target.addEventListener('pointerdown',pointerPress)"));
 assert(game.includes("$('jump'), $('game-canvas')"));
 assert(game.includes("target.addEventListener('pointercancel',pointerRelease)"));
 assert(game.includes("document.addEventListener('keyup'"));
 assert(game.includes("window.addEventListener('blur',pause)"));assert(game.includes("document.addEventListener('visibilitychange'"));assert(game.includes('next.width!==view.width||next.height!==view.height){pause()'));
});
test('Phaser MIT license is retained',()=>{const license=readFileSync(file('vendor/PHASER-LICENSE.md'),'utf8');assert(license.includes('MIT'));assert(readFileSync(file('vendor/phaser-3.90.0.min.js')).length>1000000);});

test('tutorial describes two separate taps and denies any hold-height effect',()=>{
 assert(html.includes('공중에서 한 번 더 톡'));assert(html.includes('꾹 눌러도 높아지지 않아요'));
 assert(html.includes('id="jump-label"'));assert(html.includes('id="jump-state"'));
 assert(!html.includes('꾹 누르면'));assert(!game.includes('hold threshold'));
});

test('real motion atlas and painted backdrop are local with registered runtime frames',()=>{
 const motion=readFileSync(file('assets/fuwa-motion-v1.png'));
 assert.equal(motion.readUInt32BE(16),1774);assert.equal(motion.readUInt32BE(20),887);assert.equal(motion[25],6);
 const background=readFileSync(file('assets/moonlit-alley-v1.png'));
 assert.equal(background.readUInt32BE(16),2172);assert.equal(background.readUInt32BE(20),724);
 assert(game.includes('i < 8'));assert(/295\s*\/\s*310/.test(game));assert(/\?\s*6\s*:\s*7/.test(readFileSync(file('animation.mjs'),'utf8')));
 assert(game.includes('distance * .012'));assert(game.includes('Math.min(200,'));
});
test('score, obstacle hints and audio lifecycle are connected',()=>{
 for(const id of ['score','combo','result-score','result-rating'])assert(html.includes(`id="${id}"`));
 assert(game.includes('jumpCueSeconds(game.mode,next)'));assert(game.includes("from './audio.mjs'"));
 for(const action of ['start','pause','resume','stop'])assert(game.includes(`audio.${action}()`));
 assert(game.includes("audio.play('finish')"));assert(game.includes("event.kind"));
});

test('jump cues live in controls so a high arc cannot cover the cat',()=>{
 assert(html.indexOf('id="hint"')>html.indexOf('class="controls"'));
 assert(html.indexOf('id="hint"')>html.indexOf('class="progress"'));
 assert(readFileSync(file('style.css'),'utf8').includes('.control-tip .hint{position:static'));
});

test('actual terrain replaces the old uninterrupted road and uses floor-aware rendering',()=>{
 assert(game.includes('terrainSegments(game)'));assert(game.includes('this.drawTerrain()'));
 assert(!game.includes('this.road.tilePositionX'));assert(game.includes('!game.grounded'));
 assert(game.includes('game.floorHeight!==null'));assert(game.includes('box.baseY??GROUND'));
 assert(game.includes("if(event.type==='recover')"));assert(game.includes('game.jumpStartedAt'));
 assert(game.includes("worldViewport(host.clientWidth,host.clientHeight)"));
});


test('high obstacle is a visible solid stack with two-chevron cue',()=>{
 assert(game.includes("box.kind==='high'"));assert(game.includes('rowH=(box.h-gap*(rows-1))/rows'));
 assert(game.includes('jumpCueSeconds(game.mode,o)-.15'));
});

test('hiss uses a transparent generated pose with reset and reduced-motion fallback',()=>{
 const pose=readFileSync(file('assets/fuwa-hiss-front-v1.png'));
 assert.equal(pose.readUInt32BE(16),1254);assert.equal(pose.readUInt32BE(20),1254);assert.equal(pose[25],6);
 assert(game.includes("this.load.image('hiss', './assets/fuwa-hiss-front-v1.png')"));
 assert(game.includes('this.reactionFootY = GROUND + 1;'));assert(game.includes('this.hissLabel?.setVisible(false)'));assert(game.includes("setTexture('hiss','trimmed')"));
 assert(game.includes('reducedMotion.matches?1:1+.035'));assert(game.includes("'하악!'"));
 assert(game.includes('advanceReaction(game,dt)'));assert(game.includes('visualClock+=game.elapsed-before'));
 assert(game.includes('audio.pause({preserveHit:true})'));
 assert(readFileSync(file('scripts/build-standalone.py'),'utf8').includes('fuwa-hiss-front-v1.png'));
});


test('distinct second-jump and landing atlas uses common registration and measured scale',()=>{
 const art=readFileSync(file('assets/fuwa-jump-land-v1.png'));
 assert.equal(art.readUInt32BE(16),1254);assert.equal(art.readUInt32BE(20),1254);assert.equal(art[25],6);
 assert(game.includes("this.load.image('jump-land', './assets/fuwa-jump-land-v1.png')"));
 assert(game.includes('Math.floor(i/2)*627+105,627,445'));assert(game.includes('351/445'));assert(game.includes('.32*pose.stretchX'));
 assert(game.includes('actionFloorLift(pose,game)'));assert(game.includes('scene.landEffect(event.impactSpeed)'));
 assert(game.includes('secondJumpCueSeconds(game.mode,longFlight)'));
 const build=readFileSync(file('scripts/build-standalone.py'),'utf8');assert(build.includes('fuwa-jump-land-v1.png'));assert(build.includes("root / 'animation.mjs'"));
});


test('time survival removes hearts, the fixed finish gate, and old course-completion promises',()=>{
 for(const source of [html,game]){
  assert(!/hearts|후와의 기운|기운 3개|44초|코스 완주|달빛 정원 도착/.test(source));
  assert(!/finishGate|garden-gate|game.status\s*===?\s*['"]won/.test(source));
 }
 assert(!html.includes('id="hearts"'));assert(html.includes('id="potions"'));
 assert(game.includes('score_v10_'));assert(!game.includes('score_v9_'));
});

test('seeded retry and a distinct new-course action are exposed to the player',()=>{
 for(const id of ['seed-label','result-seed','again','new-course'])assert(html.includes(`id="${id}"`));
 assert(html.includes('같은 길 다시'));assert(html.includes('새로운 길 달리기'));
 assert(game.includes('start(game.seed)'));assert(game.includes('nextSeed=freshSeed()'));
 assert(game.includes('new URLSearchParams'));assert(game.includes(".get('seed')"));
});

test('time potions have a distinct local bottle, seconds label, sound and tutorial',()=>{
 assert(game.includes("make('potion', 56, 66"));
 assert(game.includes("if(event.type==='potion')"));assert(game.includes("audio.play('potion')"));
 assert(game.includes("kind==='potion'?`+${value}초`"));
 assert(game.includes('시간 포션 +${event.seconds}초'));
 assert(html.includes('시간 포션'));
});
