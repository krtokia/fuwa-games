import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, jump, step, MODES, ROUND_SECONDS, GROUND, CAT_X, jumpCueSeconds, COURSE, SEGMENTS } from '../engine.mjs';
function run(g,seconds,dt=1/120) {for(let t=0;t<seconds;t+=dt) step(g,dt);}
function playing(mode='gentle') { const g=createGame(mode,440);g.status='running';return g; }
test('unknown mode uses the gentle default',()=>{for (const mode of ['bad', 'constructor', 'toString', '__proto__']) assert.equal(createGame(mode).mode,'gentle');});
test('jump only while playing, never double jump',()=>{const g=createGame();assert.equal(jump(g),false);g.status='running';assert.equal(jump(g),true);step(g,1/60);const v=g.vy;assert.equal(jump(g),false);assert.equal(g.vy,v);});
test('jump returns to the same ground at 30, 60 and 120 fps',()=>{for(const hz of [30,60,120]) {const g=playing();jump(g);run(g,1.3,1/hz);assert.equal(g.y,0);assert.equal(g.vy,0);}});
test('a tap just before landing is buffered',()=>{const g=playing();g.y=2;g.vy=-400;assert.equal(jump(g),false);step(g,1/120);assert(g.vy>0);});
test('pause freezes time, obstacles and the cat',()=>{const g=playing();jump(g);run(g,.2);g.status='paused';const snapshot=JSON.stringify(g);step(g,1/60);assert.equal(JSON.stringify(g),snapshot);});
test('one collision costs one heart and gives protection',()=>{const g=playing();g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,2);assert(g.invincible>0);run(g,.1);assert.equal(g.hearts,2);});
test('jump clears the same box safely',()=>{const g=playing();g.y=100;g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,3);});
test('third collision finishes the round',()=>{const g=playing();g.hearts=1;g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,0);assert.equal(g.status,'finished');});
test('a treat is collected once',()=>{const g=playing();g.treats=[{x:CAT_X+60,y:GROUND-35,taken:false}];step(g,1/120);assert.equal(g.snacks,1);step(g,1/120);assert.equal(g.snacks,1);});
test('welcome offers snacks before a six-second first encounter',()=>{const g=playing();run(g,3);assert.equal(g.obstacles.length,0);assert(g.snacks>0);run(g,1);assert.equal(g.obstacles.length,1);assert.equal(g.obstacles[0].encounterAt,6);assert(g.obstacles[0].x>CAT_X+99);});
test('the round finishes at forty-four seconds',()=>{const g=playing();g.elapsed=ROUND_SECONDS-.01;step(g,1/60);assert.equal(g.status,'won');assert.equal(g.elapsed,ROUND_SECONDS);});
test('speed is constant, long frames are bounded',()=>{const g=playing('normal');step(g,10);assert(g.elapsed<=1/30);assert.equal(g.distance,MODES.normal.speed/30);});
test('restarting creates clean state',()=>{const g=playing();g.hearts=1;g.snacks=20;const fresh=createGame(g.mode);assert.equal(fresh.hearts,3);assert.equal(fresh.snacks,0);assert.equal(fresh.elapsed,0);});
test('a full automated jump run is completable in both modes',()=>{for(const mode of Object.keys(MODES)){const g=playing(mode);for(let i=0;i<ROUND_SECONDS*120+10&&g.status==='running';i++){const next=g.obstacles.find(o=>o.x+o.w>CAT_X+34);if(next&&next.x<CAT_X+99+MODES[mode].speed*.22&&g.y===0) jump(g);step(g,1/120);}assert.equal(g.status,'won',mode);assert.equal(g.hearts,3,mode);}});
function cueRun(mode, width, hz, delay) {
 const g=createGame(mode,width); g.status='running';
 const scheduled=new Set(), events=[]; let jumpAt=Infinity;
 for(let frame=0; frame<ROUND_SECONDS*hz+10 && g.status==='running'; frame++) {
  const cue=g.obstacles.find(o=>!o.hit&&!o.cleared&&o.x>CAT_X+70&&o.x<CAT_X+70+MODES[mode].speed*jumpCueSeconds(mode));
  if(cue&&!scheduled.has(cue.id)) {scheduled.add(cue.id);jumpAt=g.elapsed+delay;}
  if(g.elapsed+1e-9>=jumpAt) {jump(g);jumpAt=Infinity;}
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
  assert.equal(events.filter(e=>e.type==='won').length,1);
  for(const type of ['snack','clear']) {
   const matching=events.filter(e=>e.type===type);
   assert.equal(new Set(matching.map(e=>e.id)).size,matching.length,label);
   assert(matching.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
  }
 }
});
test('authored rhythm leaves room to land and recover, with no late surprise',()=>{
 for(let i=1;i<COURSE.length;i++) assert(COURSE[i]-COURSE[i-1]>=2.79);
 assert(COURSE[0]>=6); assert(ROUND_SECONDS-COURSE.at(-1)>=3);
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
test('an early airborne tap expires instead of creating an automatic second jump',()=>{
 const g=playing();jump(g);run(g,.2);jump(g);run(g,1.2);assert.equal(g.y,0);assert.equal(g.vy,0);
});
test('pause rejects input and preserves the landing buffer',()=>{
 const g=playing();g.y=2;g.vy=-400;jump(g);g.status='paused';const before=JSON.stringify(g);
 assert.equal(jump(g),false);step(g,1);assert.equal(JSON.stringify(g),before);
 g.status='running';step(g,1/120);assert(g.vy>0);assert.equal(g.events.filter(e=>e.type==='land').length,1);
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
