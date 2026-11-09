import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, jump, pressJump, releaseJump, JUMP_SPEED, SECOND_JUMP_SPEED, step, MODES, ROUND_SECONDS, GROUND, CAT_X, jumpCueSeconds, COURSE, SEGMENTS } from '../engine.mjs';
function run(g,seconds,dt=1/120) {for(let t=0;t<seconds;t+=dt) step(g,dt);}
function playing(mode='gentle') { const g=createGame(mode,440);g.status='running';return g; }
test('unknown mode uses the normal default',()=>{for (const mode of ['bad', 'constructor', 'toString', '__proto__']) assert.equal(createGame(mode).mode,'normal');});
test('jump only while playing, with at most two taps',()=>{const g=createGame();assert.equal(jump(g),false);g.status='running';assert.equal(jump(g),true);step(g,1/60);assert.equal(jump(g),true);assert.equal(g.jumpCount,2);const v=g.vy;assert.equal(jump(g),false);assert.equal(g.vy,v);assert.equal(g.jumpHeld,false);});
test('jump returns to the same ground at 30, 60 and 120 fps',()=>{for(const hz of [30,60,120]) {const g=playing();jump(g);run(g,1.3,1/hz);assert.equal(g.y,0);assert.equal(g.vy,0);}});
test('an exhausted tap just before landing is not buffered',()=>{const g=playing();g.y=2;g.vy=-400;g.jumpCount=2;assert.equal(jump(g),false);step(g,1/120);assert.equal(g.vy,0);assert.equal(g.y,0);assert.equal(g.jumpCount,0);});
test('pause freezes time, obstacles and the cat',()=>{const g=playing();jump(g);run(g,.2);g.status='paused';const snapshot=JSON.stringify(g);step(g,1/60);assert.equal(JSON.stringify(g),snapshot);});
test('one collision costs one heart and gives protection',()=>{const g=playing();g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,2);assert(g.invincible>0);run(g,.1);assert.equal(g.hearts,2);});
test('jump clears the same box safely',()=>{const g=playing();g.y=100;g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,3);});
test('third collision finishes the round',()=>{const g=playing();g.hearts=1;g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,0);assert.equal(g.status,'finished');});
test('a treat is collected once',()=>{const g=playing();g.treats=[{x:CAT_X+60,y:GROUND-35,taken:false}];step(g,1/120);assert.equal(g.snacks,1);step(g,1/120);assert.equal(g.snacks,1);});
test('welcome offers snacks before a four-second first encounter',()=>{const g=playing();run(g,1);assert.equal(g.obstacles.length,0);run(g,1);assert.equal(g.obstacles.length,1);assert.equal(g.obstacles[0].encounterAt,4);assert(g.obstacles[0].x>CAT_X+99);run(g,1);assert(g.snacks>0);});
test('the round finishes at forty-four seconds',()=>{const g=playing();g.elapsed=ROUND_SECONDS-.01;step(g,1/60);assert.equal(g.status,'won');assert.equal(g.elapsed,ROUND_SECONDS);});
test('speed is constant, long frames are bounded',()=>{const g=playing('normal');step(g,10);assert(g.elapsed<=1/30);assert.equal(g.distance,MODES.normal.speed/30);});
test('restarting creates clean state',()=>{const g=playing();g.hearts=1;g.snacks=20;const fresh=createGame(g.mode);assert.equal(fresh.hearts,3);assert.equal(fresh.snacks,0);assert.equal(fresh.elapsed,0);});
test('a full automated jump run is completable in both modes',()=>{for(const mode of Object.keys(MODES)){const g=playing(mode);for(let i=0;i<ROUND_SECONDS*120+10&&g.status==='running';i++){const next=g.obstacles.find(o=>o.x+o.w>CAT_X+34);if(next&&next.x<CAT_X+99+MODES[mode].speed*.22&&g.y===0) jump(g);step(g,1/120);}assert.equal(g.status,'won',mode);assert.equal(g.hearts,3,mode);}});
function cueRun(mode, width, hz, delay, held = false, secondDelay = null) {
 const g=createGame(mode,width); g.status='running';
 const scheduled=new Set(), events=[]; let jumpAt=Infinity, releaseAt=Infinity, secondAt=Infinity;
 for(let frame=0; frame<ROUND_SECONDS*hz+10 && g.status==='running'; frame++) {
  const cue=g.obstacles.find(o=>!o.hit&&!o.cleared&&o.x>CAT_X+70&&o.x<CAT_X+70+MODES[mode].speed*jumpCueSeconds(mode));
  if(cue&&!scheduled.has(cue.id)) {scheduled.add(cue.id);jumpAt=g.elapsed+delay;}
  if(g.elapsed+1e-9>=jumpAt) {if(held) {pressJump(g);releaseAt=g.elapsed+.25;} else jump(g);jumpAt=Infinity;if(secondDelay!==null) secondAt=g.elapsed+secondDelay;}
  if(g.elapsed>=releaseAt) {releaseJump(g);releaseAt=Infinity;}
  if(g.elapsed+1e-9>=secondAt) {releaseJump(g);assert.equal(jump(g),true);secondAt=Infinity;}
  step(g,1/hz); events.push(...g.events);
 }
 return {g,events};
}
test('every course completes cleanly across widths, refresh rates and cue response times',()=>{
 for(const mode of Object.keys(MODES)) for(const width of [440,720,1000])
 for(const hz of [30,60,120]) for(const delay of [0,.1,.2,.3,.35,.4]) {
  const {g,events}=cueRun(mode,width,hz,delay);
  const label=`${mode}, ${width}px, ${hz}Hz, ${delay}s response`;
  assert.equal(g.status,'won',label); assert.equal(g.hearts,3,label);
  assert.equal(g.cleared,COURSE.length,label); assert.equal(g.streak,COURSE.length,label);
  assert.equal(g.progress,1); assert.equal(g.segment.id,'finish');
  assert(g.snacks>11,label);
  assert.equal(events.filter(e=>e.type==='won').length,1);
  for(const type of ['snack','clear']) {
   const matching=events.filter(e=>e.type===type);
   assert.equal(new Set(matching.map(e=>e.id)).size,matching.length,label);
   assert(matching.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
  }
 }
});
test('authored rhythm leaves room to land and recover, with no late surprise',()=>{
 for(let i=1;i<COURSE.length;i++) assert(COURSE[i]-COURSE[i-1]>=2);
 assert(COURSE[0]>=4); assert(ROUND_SECONDS-COURSE.at(-1)>=3);
 assert(SEGMENTS.some(s=>s.id==='recovery-one')); assert(SEGMENTS.some(s=>s.id==='recovery-two'));
});
test('viewport width does not change physics, obstacle positions or snack placement',()=>{
 const games=[440,720,1000].map(width=>{const g=createGame('normal',width);g.status='running';return g;});
 for(const g of games) run(g,5);
 for(const g of games.slice(1)) for(const o of games[0].obstacles) {
  const same=g.obstacles.find(candidate=>candidate.encounterAt===o.encounterAt);
  assert(same);assert.equal(same.x,o.x);assert.equal(same.h,o.h);
 }
 for(const g of games.slice(1)) for(const t of games[0].treats) {
  const same=g.treats.find(candidate=>candidate.encounterAt===t.encounterAt&&candidate.offset===t.offset&&candidate.y===t.y);
  assert(same);assert.equal(same.x,t.x);
 }
});
test('fixed physics yields identical state after equal simulated time',()=>{
 const games=[30,60,120].map(hz=>{const g=playing();jump(g);for(let i=0;i<hz*4;i++)step(g,1/hz);return g;});
 for(const field of ['elapsed','distance','y','vy','snacks','obstacles','treats']) {
  assert.deepEqual(games[0][field],games[1][field],field);assert.deepEqual(games[0][field],games[2][field],field);
 }
});
test('protected overlapping boxes cannot drain hearts or award clean clears',()=>{
 const g=playing();g.obstacles=[0,1,2].map(id=>({id,x:CAT_X+50,w:44,h:42,hit:false}));
 step(g,1/30);assert.equal(g.hearts,2);assert.equal(g.events.filter(e=>e.type==='hit').length,1);
 run(g,1);assert.equal(g.hearts,2);assert.equal(g.cleared,0);
});
test('terminal and collection events are emitted once, with collection coordinates',()=>{
 const g=playing();g.treats=[{id:100,x:CAT_X+60,y:GROUND-35,taken:false}];
 step(g,1/30);assert.equal(g.events.filter(e=>e.type==='snack').length,1);
 assert.equal(g.events[0].id,100);assert.equal(g.events[0].y,GROUND-35);
 step(g,1/30);assert.equal(g.events.length,0);
 g.hearts=1;g.obstacles=[{id:101,x:CAT_X+50,w:44,h:42,hit:false}];
 step(g,1/30);assert.deepEqual(g.events.map(e=>e.type),['hit','finished']);
 assert.equal(g.event,'finished');const before=JSON.stringify(g);step(g,1/30);assert.equal(JSON.stringify(g),before);
});

function jumpApex(holdFor = 0, hz = 120) {
 const g=playing();let apex=0;const events=[];
 pressJump(g);
 for(let frame=0;frame<hz*2;frame++) {
  if(g.elapsed>=holdFor-1e-9) releaseJump(g);
  step(g,1/hz);apex=Math.max(apex,g.y);events.push(...g.events);
 }
 return {g,apex,events};
}
test('taps and holds of every duration have the same low arc, never a boost',()=>{
 for(const hz of [30,60,120]) for(const duration of [0,.04,.08,.16,.3,1,3]) {
  const {g,apex,events}=jumpApex(duration,hz);
  assert(apex>=89&&apex<=91,`${duration}s at ${hz}Hz: ${apex}`);
  assert.equal(g.y,0);assert.equal(g.jumpCount,0);
  assert.equal(events.filter(e=>e.type==='boost').length,0);
 }
});
test('second distinct tap works immediately, rising, at apex, falling and near landing',()=>{
 for(const delay of [0,.05,.15,.3,.45,.7,.9]) {
  const g=playing();assert.equal(pressJump(g),true);
  run(g,delay);const height=g.y, velocity=g.vy;
  assert.equal(pressJump(g),false);assert.equal(g.jumpCount,1);
  releaseJump(g);assert.equal(pressJump(g),true);
  assert.equal(g.jumpCount,2);assert.equal(g.vy,SECOND_JUMP_SPEED);
  assert(g.vy>=velocity);assert.equal(g.y,height);
  releaseJump(g);assert.equal(pressJump(g),false);
  assert.equal(g.jumpCount,2);assert.equal(g.vy,SECOND_JUMP_SPEED);
  releaseJump(g);
  const events=[];let apex=height;
  for(let i=0;i<240;i++) {step(g,1/120);events.push(...g.events);apex=Math.max(apex,g.y);}
  assert(apex>=height+89&&apex<=height+91);
  assert(apex<=181);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
  const boosts=events.filter(e=>e.type==='boost');assert.equal(boosts.length,1);
  assert.deepEqual(boosts[0],{type:'boost',x:CAT_X+66,y:GROUND-height-30});
 }
});
test('held input and rejected third presses never repeat on landing',()=>{
 const g=playing();assert.equal(pressJump(g),true);
 step(g,1/120);const before=g.vy;
 assert.equal(pressJump(g),false);assert.equal(g.vy,before);
 run(g,2);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
 assert.equal(pressJump(g),false);assert.equal(jump(g),false);
 releaseJump(g);assert.equal(pressJump(g),true);
 releaseJump(g);assert.equal(pressJump(g),true);
 releaseJump(g);assert.equal(pressJump(g),false);
 run(g,2);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
 assert.equal(pressJump(g),false);
 releaseJump(g);assert.equal(pressJump(g),true);assert.equal(g.jumpCount,1);
});
test('pause freezes a queued double jump, rejects input and releases without altering physics',()=>{
 const g=playing();pressJump(g);run(g,.1);releaseJump(g);pressJump(g);
 g.status='paused';const before=JSON.stringify(g);
 assert.equal(pressJump(g),false);assert.equal(jump(g),false);step(g,1);
 assert.equal(JSON.stringify(g),before);
 const velocity=g.vy;releaseJump(g);assert.equal(g.vy,velocity);assert.equal(g.jumpCount,2);
 g.status='running';step(g,1/120);assert.equal(g.events.filter(e=>e.type==='boost').length,1);
 step(g,1/120);assert.equal(g.events.filter(e=>e.type==='boost').length,0);
 run(g,2);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
 const fresh=createGame();assert.equal(fresh.jumpHeld,false);assert.equal(fresh.jumpCount,0);assert.equal(fresh.pendingBoost,null);
});
test('held low jumps complete every cue timing with snack feedback',()=>{
 for(const mode of Object.keys(MODES)) for(const width of [440,720,1000])
 for(const hz of [30,60,120]) for(const delay of [0,.1,.2,.3,.35,.4]) {
  const {g,events}=cueRun(mode,width,hz,delay,true);
  const label=`held ${mode}, ${width}px, ${hz}Hz, ${delay}s`;
  assert.equal(g.status,'won',label);assert.equal(g.hearts,3,label);
  assert.equal(g.cleared,COURSE.length,label);assert(g.snacks>11,label);
  assert(events.some(e=>e.type==='snack'),label);
  assert(!events.some(e=>e.type==='boost'),label);
 }
});
test('double jump physics is identical across modes, widths and frame rates',()=>{
 let reference;
 for(const mode of Object.keys(MODES)) for(const width of [440,720,1000]) for(const hz of [30,60,120]) {
  const g=createGame(mode,width);g.status='running';jump(g);
  for(let i=0;i<hz/2;i++)step(g,1/hz);
  jump(g);
  for(let i=0;i<hz/2;i++)step(g,1/hz);
  const actual=[g.y,g.vy,g.jumpCount];reference??=actual;assert.deepEqual(actual,reference);
 }
});
test('boost frame respects higher-priority hit feedback',()=>{
 const g=playing();jump(g);run(g,.1);jump(g);
 g.obstacles=[{id:999,x:CAT_X+50,w:44,h:200,hit:false}];
 step(g,1/120);
 assert(g.events.some(e=>e.type==='boost'));assert(g.events.some(e=>e.type==='hit'));
 assert.equal(g.event,'hit');
});

test('two-tap runs clear every box across modes, widths, rates and response times',()=>{
 for(const mode of Object.keys(MODES)) for(const width of [440,720,1000])
 for(const hz of [30,60,120]) for(const delay of [0,.1,.2,.3,.4]) for(const secondDelay of [0,.05,.15,.3,.45,.7,.9]) {
  const {g,events}=cueRun(mode,width,hz,delay,false,secondDelay);
  const label=`${mode} ${width}px ${hz}Hz ${delay}s + ${secondDelay}s`;
  assert.equal(g.status,'won',label);assert.equal(g.hearts,3,label);
  assert.equal(g.cleared,COURSE.length,label);
  assert.equal(events.filter(e=>e.type==='boost').length,COURSE.length,label);
 }
});

test('ready, paused and terminal input cannot change state',()=>{
 for(const status of ['ready','paused','won','finished']) {
  const g=playing();g.status=status;const before=JSON.stringify(g);
  assert.equal(pressJump(g),false);assert.equal(jump(g),false);
  assert.equal(JSON.stringify(g),before);
 }
});
test('releasing a press does not change its trajectory or consume another jump',()=>{
 const held=playing(),tapped=playing();pressJump(held);jump(tapped);
 assert.equal(held.vy,JUMP_SPEED);
 for(let i=0;i<240;i++) {
  step(held,1/120);step(tapped,1/120);
  for(const field of ['y','vy','jumpCount']) assert.equal(held[field],tapped[field]);
 }
});

test('default pace starts sooner and uses eighteen authored boxes with recovery gaps',()=>{
 assert.equal(createGame().mode,'normal');assert.equal(MODES.normal.speed,360);
 assert.equal(MODES.gentle.speed,240);assert.equal(COURSE.length,18);assert.equal(COURSE[0],4);
 const gaps=COURSE.slice(1).map((time,i)=>time-COURSE[i]);
 assert.equal(gaps.filter(gap=>gap>=3).length,2);
 assert(gaps.every(gap=>gap>=2));
});
