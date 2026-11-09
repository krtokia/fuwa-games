import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, jump, step, MODES, ROUND_SECONDS, GROUND, CAT_X, jumpCueSeconds } from '../engine.mjs';
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
test('first obstacle has a comfortable preparation interval',()=>{const g=playing();run(g,5);assert.equal(g.obstacles.length,0);run(g,.3);assert.equal(g.obstacles.length,1);assert(g.obstacles[0].x>g.width);});
test('the round finishes at one minute',()=>{const g=playing();g.elapsed=ROUND_SECONDS-.01;step(g,1/60);assert.equal(g.status,'won');assert.equal(g.elapsed,ROUND_SECONDS);});
test('speed is constant, long frames are bounded',()=>{const g=playing('normal');step(g,10);assert(g.elapsed<=1/30);assert.equal(g.distance,MODES.normal.speed/30);});
test('restarting creates clean state',()=>{const g=playing();g.hearts=1;g.snacks=20;const fresh=createGame(g.mode);assert.equal(fresh.hearts,3);assert.equal(fresh.snacks,0);assert.equal(fresh.elapsed,0);});
test('a full automated jump run is completable in both modes',()=>{for(const mode of Object.keys(MODES)){const g=playing(mode);for(let i=0;i<ROUND_SECONDS*120+10&&g.status==='running';i++){const next=g.obstacles.find(o=>o.x+o.w>CAT_X+34);if(next&&next.x<CAT_X+99+MODES[mode].speed*.22&&g.y===0) jump(g);step(g,1/120);}assert.equal(g.status,'won',mode);assert.equal(g.hearts,3,mode);}});
test('actionable jump cue allows an immediate or slightly delayed response',()=>{
 for(const mode of Object.keys(MODES)) for(const delay of [0,.1,.2,.3,.35,.4]) {
  const g=playing(mode); let jumpAt=null;
  while(g.status==='running') {
   const threshold=MODES[mode].speed*jumpCueSeconds(mode);
   const cue=g.obstacles.find(o=>!o.hit&&o.x>CAT_X+70&&o.x<CAT_X+70+threshold);
   if(cue&&jumpAt===null) jumpAt=g.elapsed+delay;
   if(jumpAt!==null&&g.elapsed>=jumpAt) {jump(g);jumpAt=Infinity;}
   if(!cue) jumpAt=null;
   step(g,1/120);
  }
  assert.equal(g.status,'won',`${mode}: ${delay}s response`);
  assert.equal(g.hearts,3,`${mode}: ${delay}s response`);
 }
});
