import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,jump,pressJump,releaseJump,step,advanceReaction,HIT_REACTION_SECONDS,FIXED_STEP,MODES,ROUND_SECONDS,GROUND,CAT_X,RISE_GRAVITY,FALL_GRAVITY,SINGLE_JUMP_APEX,SINGLE_JUMP_SECONDS,flightAfter,JUMP_SPEED,SECOND_JUMP_SPEED,ENCOUNTERS,COURSE,TERRAIN,terrainSegments,floorAt,nextCue,jumpCueSeconds,secondJumpCueSeconds} from '../engine.mjs';
function playing(mode='normal',width=640){const g=createGame(mode,width);g.status='running';return g;}
function finishReaction(g,hz=120){while(g.reactionRemaining>0&&['running','finished'].includes(g.status))advanceReaction(g,1/hz);}
// Existing route assertions measure gameplay seconds, excluding the explicit
// presentation-only reaction. Reactions never masquerade as new event frames.
function run(g,seconds,hz=120){for(let i=0;i<Math.round(seconds*hz);i++){finishReaction(g,hz);step(g,1/hz);}}
function route(mode='normal',width=640,hz=120,response=.15,second=.33,miss=null){
 const g=playing(mode,width),events=[];const taps=ENCOUNTERS.flatMap(o=>{const first=o.encounterAt-jumpCueSeconds(mode,o)+response;return o.taps&&o.encounterAt!==miss?[first,...o.taps===2&&second!==null?[first+second]:[]]:[];});let i=0;
 while(g.status==='running'){if(g.reactionRemaining>0){advanceReaction(g,1/hz);continue;}if(g.elapsed>=taps[i]-1e-9){assert(jump(g),`tap ${taps[i]} at ${g.elapsed}`);i++;}step(g,1/hz);events.push(...g.events);}return {g,events};
}
function at(time,y=floorAt(time)??0,mode='normal'){const g=playing(mode);g.elapsed=time;g.distance=time*MODES[g.mode].speed;g.courseIndex=COURSE.length;g.snackIndex=99;g.y=y;g.floorHeight=floorAt(time);return g;}
// Spawn through the real engine, then isolate the high encounter and its rewards.
function highGame(mode,phase=0){
 const g=playing(mode,720),high=ENCOUNTERS.find(o=>o.kind==='high');
 g.elapsed=high.encounterAt-1.5+phase/120;g.courseIndex=ENCOUNTERS.indexOf(high);g.snackIndex=99;
 step(g,1/120);g.courseIndex=COURSE.length;
 assert.equal(g.obstacles.length,1);assert.equal(g.obstacles[0].kind,'high');
 return g;
}
function finishHigh(g,hz,onFrame){
 const events=[],end=ENCOUNTERS.find(o=>o.kind==='high').encounterAt+1.6;
 while(g.elapsed<end){if(g.reactionRemaining>0){advanceReaction(g,1/hz);continue;}onFrame(g);step(g,1/hz);events.push(...g.events);}
 return events;
}
test('invalid mode is normalized, restart is clean',()=>{for(const mode of ['bad','constructor','__proto__'])assert.equal(createGame(mode).mode,'normal');const g=createGame();assert.equal(g.hearts,3);assert.equal(g.elapsed,0);assert.equal(g.grounded,true);assert.equal(g.pendingBoost,null);assert.equal(g.reactionElapsed,0);assert.equal(g.reactionRemaining,0);});
test('ready, paused and terminal input/time are immutable',()=>{for(const status of ['ready','paused','won','finished']){const g=createGame();g.status=status;const before=JSON.stringify(g);assert.equal(jump(g),false);assert.equal(pressJump(g),false);step(g,1);assert.equal(JSON.stringify(g),before);}});
test('single arc is77.44px in.663s, with immediate launch and hold-independent asymmetric gravity',()=>{
 assert.equal(SINGLE_JUMP_APEX,77.44);assert(Math.abs(SINGLE_JUMP_SECONDS-.6631269837220809)<1e-12);
 assert(FALL_GRAVITY>RISE_GRAVITY);assert(JUMP_SPEED>380);
 for(const hz of [30,60,120])for(const hold of [0,.1,.5,2]){
  const g=playing();pressJump(g);assert.equal(g.vy,JUMP_SPEED);let apex=0,land;
  for(let i=0;i<2*hz;i++){if(g.elapsed>=hold)releaseJump(g);step(g,1/hz);apex=Math.max(apex,g.y);land??=g.events.find(e=>e.type==='land');}
  assert(apex>77.2&&apex<=SINGLE_JUMP_APEX);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
  assert(Math.abs(land.at-SINGLE_JUMP_SECONDS)<1e-10);
  assert(Math.abs(land.impactSpeed-Math.sqrt(2*FALL_GRAVITY*SINGLE_JUMP_APEX))<1e-9);
 }
});
test('piecewise ballistic integration crosses the apex exactly and composes across arbitrary slices',()=>{
 const expected={y:77.44-800*.048**2,vy:-1600*.048};
 const actual=flightAfter(0,440,.4);assert(Math.abs(actual.y-expected.y)<1e-12);assert(Math.abs(actual.vy-expected.vy)<1e-12);
 for(const first of [0,.002,.15,.349,.352,.36,.55]){
  const a=flightAfter(0,JUMP_SPEED,first),b=flightAfter(a.y,a.vy,.6-first),whole=flightAfter(0,JUMP_SPEED,.6);
  assert(Math.abs(b.y-whole.y)<1e-10);assert(Math.abs(b.vy-whole.vy)<1e-10);
 }
});
test('second press resets velocity, third is rejected and never buffered',()=>{for(const delay of [0,.1,.3,.45,.6]){const g=playing();pressJump(g);run(g,delay);assert.equal(pressJump(g),false);releaseJump(g);assert(pressJump(g));assert.equal(g.vy,SECOND_JUMP_SPEED);releaseJump(g);assert.equal(pressJump(g),false);run(g,2);assert.equal(g.jumpCount,0);assert.equal(pressJump(g),false);assert.equal(jump(g),false);releaseJump(g);assert(jump(g));}});
test('pause preserves queued boost and release never changes velocity',()=>{const g=playing();jump(g);run(g,.2);pressJump(g);g.status='paused';const snapshot=JSON.stringify(g);step(g,.1);assert.equal(JSON.stringify(g),snapshot);const v=g.vy;releaseJump(g);assert.equal(g.vy,v);g.status='running';step(g,1/120);assert.equal(g.events.filter(e=>e.type==='boost').length,1);step(g,1/120);assert(!g.events.some(e=>e.type==='boost'));});
test('fixed physics and distance are identical across frame rates; long frames bounded',()=>{const gs=[30,60,120].map(hz=>{const g=playing();jump(g);run(g,2,hz);return g;});for(const key of ['elapsed','distance','y','vy','obstacles','treats'])assert.deepEqual(gs.map(g=>g[key]),[gs[0][key],gs[0][key],gs[0][key]]);const g=playing();step(g,10);assert.equal(g.distance,12);});
test('terrain geometry contains real holes, negative floors and raised floors',()=>{assert.equal(floorAt(10.4),null);assert.equal(floorAt(15),-54);assert.equal(floorAt(28),48);for(const mode of Object.keys(MODES)){const g=playing(mode);for(const s of terrainSegments(g)){assert.equal(s.w,(s.end-s.start)*MODES[mode].speed);assert.equal(s.baseY,GROUND-s.height);}}});
test('walking over a drop falls continuously then lands on lower floor',()=>{const g=at(13.99);step(g,1/60);assert(g.y<0&&g.y>-1);assert.equal(g.grounded,false);run(g,.5);assert.equal(g.y,-54);assert.equal(g.grounded,true);assert.equal(g.hearts,3);});
test('a descending crossing lands on raised ground, not on air',()=>{const g=at(27.1,49);g.grounded=false;g.vy=-120;g.jumpCount=2;step(g,1/60);assert.equal(g.y,48);assert.equal(g.grounded,true);assert.equal(g.jumpCount,0);const hole=at(10.5,1);hole.grounded=false;hole.vy=-120;hole.jumpCount=2;step(hole,1/60);assert(hole.y<0);assert.equal(hole.jumpCount,2);assert.equal(hole.grounded,false);});
test('landing just before/after the far lip respects the actual surface',()=>{const early=at(10.67,1);early.grounded=false;early.vy=-100;step(early,1/60);assert(early.y<0);assert.equal(early.grounded,false);const late=at(10.71,1);late.grounded=false;late.vy=-100;step(late,1/60);assert.equal(late.y,0);assert.equal(late.grounded,true);});
test('rising solid wall costs a heart and emits explicit recovery, not a silent floor snap',()=>{const g=at(17.99,-54);step(g,1/60);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));assert(g.recoveryUntil>g.elapsed);run(g,1);assert.equal(g.hearts,2);assert.equal(g.y,0);});
test('missing a hole costs one heart and safely resumes at its approaching lip',()=>{const g=at(9.99);const events=[];for(let i=0;i<240;i++){finishReaction(g);step(g,1/120);events.push(...g.events);}assert.equal(g.hearts,2);assert.equal(g.hitCount,1);assert.equal(g.y,0);assert.equal(g.grounded,true);assert.equal(events.filter(e=>e.type==='recover').length,1);assert(events.some(e=>e.reason==='fall'));assert(g.elapsed>11.9);});
test('rescue cannot be exploited to reset midair jumps',()=>{const g=at(9.99);while(!g.recoveryUntil)step(g,1/120);assert.equal(jump(g),false);run(g,.5);assert.equal(g.jumpCount,0);assert(jump(g));assert(jump(g));assert.equal(jump(g),false);});
test('no input fails, not endless falling; zero hearts terminal is immutable',()=>{const {g,events}=route('normal',640,60,.15,null);assert(g.hitCount>0);assert(!events.some(e=>e.type==='clear'&&e.kind==='long'));const idle=playing();run(idle,44);assert.equal(idle.status,'finished');const before=JSON.stringify(idle);step(idle,1);assert.equal(JSON.stringify(idle),before);});
test('authored long obstacle mathematically exceeds all possible single-jump clearance',()=>{for(const mode of Object.keys(MODES)){const speed=MODES[mode].speed;for(const o of ENCOUNTERS.filter(o=>o.kind==='long')){const required=(o.duration*speed-18+30)/speed;const height=o.h-10;const riseCrossing=(JUMP_SPEED-Math.sqrt(JUMP_SPEED**2-2*RISE_GRAVITY*height))/RISE_GRAVITY;const usable=JUMP_SPEED/RISE_GRAVITY+Math.sqrt(2*(SINGLE_JUMP_APEX-height)/FALL_GRAVITY)-riseCrossing;assert(required>usable);}}});
test('high stack requires height beyond every possible single-jump timing',()=>{
 const high=ENCOUNTERS.find(o=>o.kind==='high');
 assert.equal(high.encounterAt,33);assert.equal(high.taps,2);assert.equal(high.cueLead,.81);
 assert.equal(high.h,105);assert.equal(high.duration,.16);assert(high.hint.includes('준비'));
 // Cat collision feet are 5px above y=0; obstacle top is inset by another5px.
 // Even the global single-jump maximum cannot clear the resulting95px top.
 // This continuous inequality covers all timings, not just the sampled inputs.
 const singleApex=JUMP_SPEED**2/(2*RISE_GRAVITY);
 assert.equal(singleApex,77.44);assert(high.h-10>singleApex);
 for(const mode of Object.keys(MODES)){
  const g=highGame(mode),o=g.obstacles[0];
  assert.equal(o.w,high.duration*MODES[mode].speed);
  for(const reward of g.treats)assert(GROUND-reward.y>high.h);
  assert.equal(g.treats.find(t=>t.kind==='star').y,GROUND-180);
  // Sample every5ms from long before takeoff through after the entire collision.
  for(let leadMs=-350;leadMs<=1500;leadMs+=5){
   const trial=highGame(mode);let pressed=false;
   finishHigh(trial,120,game=>{if(!pressed&&game.elapsed>=high.encounterAt-leadMs/1000){jump(game);pressed=true;}});
   assert.equal(trial.hearts,2,`${mode}/single lead${leadMs}ms`);
   assert.equal(trial.hitCount,1);assert.equal(trial.cleared,0);assert.equal(trial.stars,0);
  }
 }
});
test('high double-jump window stays broad and lands before the next cue',()=>{
 const high=ENCOUNTERS.find(o=>o.kind==='high'),next=ENCOUNTERS[ENCOUNTERS.indexOf(high)+1];
 for(const mode of Object.keys(MODES))for(let responseMs=80;responseMs<=250;responseMs+=10)for(let delayMs=220;delayMs<=390;delayMs+=10){
  const g=highGame(mode),first=high.encounterAt-high.cueLead+responseMs/1000,taps=[first,first+delayMs/1000];let i=0;
  const events=finishHigh(g,120,game=>{if(game.elapsed>=taps[i]-1e-9){assert(jump(game));i++;}});
  const label=`${mode}/${responseMs}/${delayMs}`;
  assert.equal(g.hearts,3,label);assert.equal(g.cleared,1,label);assert.equal(g.stars,1,label);
  assert.equal(g.grounded,true,label);assert.equal(g.y,0,label);
  assert(events.some(e=>e.type==='land'),label);
  assert(next.encounterAt-jumpCueSeconds(mode,next)-g.elapsed>1.8,label);
 }
});
function encounterGame(mode,encounter,phase=0){
 const g=playing(mode,720);g.elapsed=encounter.encounterAt-1.5+phase/120;
 g.y=floorAt(g.elapsed);g.floorHeight=g.y;g.courseIndex=ENCOUNTERS.indexOf(encounter);g.snackIndex=99;
 step(g,FIXED_STEP);g.courseIndex=COURSE.length;
 assert.equal(g.obstacles.length,1);assert.equal(g.obstacles[0].kind,encounter.kind);return g;
}
function cueInputs(mode,encounter,r1,r2){
 let firstCue=false,secondCue=false,firstAt=null,secondAt=null,pressedAt=null;
 return game=>{
  if(!firstCue&&encounter.encounterAt-game.elapsed<jumpCueSeconds(mode,encounter)){firstCue=true;firstAt=game.elapsed+r1/1000;}
  if(firstAt!==null&&game.elapsed>=firstAt){assert(jump(game));pressedAt=game.elapsed;firstAt=null;}
  if(encounter.taps===2&&pressedAt!==null&&!secondCue&&game.jumpCount===1&&game.elapsed-game.jumpStartedAt>=secondJumpCueSeconds(mode,encounter)){
   secondCue=true;secondAt=game.elapsed+r2/1000;
  }
  if(secondAt!==null&&game.elapsed>=secondAt){assert(jump(game));secondAt=null;}
 };
}
test('every hazard allows80–250ms reactions to both cues at30/60/120Hz, including every render phase',()=>{
 let trials=0;
 for(const encounter of ENCOUNTERS.filter(o=>o.taps))for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(let phase=0;phase<120/hz;phase++)for(let r1=80;r1<=250;r1+=10)for(let r2=80;r2<=(encounter.taps===2?250:80);r2+=10){
  const g=encounterGame(mode,encounter,phase),input=cueInputs(mode,encounter,r1,r2);
  const end=encounter.encounterAt+Math.max(encounter.duration,.2)+.9;
  while(g.elapsed<end){if(g.reactionRemaining>0){advanceReaction(g,1/hz);continue;}input(g);step(g,1/hz);}
  const label=`${encounter.kind}@${encounter.encounterAt}/${mode}/${hz}Hz/phase${phase}/${r1}ms/${r2}ms`;
  assert.equal(g.hearts,3,label);assert.equal(g.cleared,1,label);assert.equal(g.stars,encounter.taps===2?1:0,label+' stars');
  assert(g.grounded,label);assert.equal(g.y,floorAt(g.elapsed),label);trials++;
 }
 assert.equal(trials,32508);
});
test('authored course gives visible warning and a safe landing runway',()=>{assert(COURSE[0]>=4);assert(ROUND_SECONDS-COURSE.at(-1)>=3);for(let i=1;i<COURSE.length;i++)assert(COURSE[i]-COURSE[i-1]>=2);for(const mode of Object.keys(MODES)){const speed=MODES[mode].speed;assert((720-230)/speed>=1.3);for(let i=1;i<ENCOUNTERS.length;i++){const a=ENCOUNTERS[i-1],b=ENCOUNTERS[i];assert(b.encounterAt-jumpCueSeconds(mode,b)-(a.encounterAt+a.duration)>=.5);}}assert.deepEqual(ENCOUNTERS.slice(0,5).map(o=>o.kind),['crate','long','gap','drop','step']);});
test('all courses finish cleanly: both speeds, 640/800/1200 widths, 30/60/120fps and human reaction windows',()=>{for(const mode of Object.keys(MODES))for(const width of [640,720,800,1200])for(const hz of [30,60,120])for(const response of [.08,.15,.25])for(const second of [.26,.33,.4]){const {g,events}=route(mode,width,hz,response,second);const label=`${mode}/${width}/${hz}/${response}/${second}`;assert.equal(g.status,'won',label);assert.equal(g.hearts,3,label);assert.equal(g.cleared,ENCOUNTERS.length,label);assert.equal(g.combo,5);assert.equal(g.stars,ENCOUNTERS.filter(o=>o.taps===2).length,label+' stars');assert.equal(events.filter(e=>e.type==='won').length,1);assert.equal(g.score,events.reduce((sum,e)=>sum+(e.value??0),0));}});
test('each missed hazard is recoverable, resets combo, and costs only one heart',()=>{for(const mode of Object.keys(MODES))for(const miss of [4,7,10,18,20,23,27,33,37,40]){const {g,events}=route(mode,640,60,.15,.33,miss);const label=`${mode}/${miss}`;assert.equal(g.status,'won',label);assert.equal(g.hearts,2,label);assert.equal(g.hitCount,1,label);const hit=events.findIndex(e=>e.type==='hit');const clear=events.slice(hit+1).find(e=>e.type==='clear');if(clear)assert.equal(clear.combo,1);}});
test('one contact costs only one heart; pickup is once; terminal outranks hit',()=>{const g=playing();g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,2);run(g,.1);assert.equal(g.hearts,2);const snack=playing();snack.treats=[{id:99,x:CAT_X+60,y:GROUND-35,taken:false}];step(snack,1/30);assert.equal(snack.snacks,1);step(snack,1/30);assert.equal(snack.snacks,1);const end=playing();end.hearts=1;end.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(end,1/120);assert.equal(end.event,'finished');});
test('next cue and visible segments are deterministic and independent of width',()=>{const games=[640,1200].map(w=>playing('normal',w));for(const g of games)run(g,3);assert.equal(nextCue(games[0]).encounterAt,4);assert.deepEqual(terrainSegments(games[0]),terrainSegments(games[1]));for(const o of games[0].obstacles){const other=games[1].obstacles.find(a=>a.encounterAt===o.encounterAt);assert.equal(o.x,other.x);assert.equal(o.w,other.w);}});

test('walk-off consumes ground jump and allows only one air tap',()=>{const g=at(9.99);step(g,1/30);assert.equal(g.grounded,false);assert.equal(g.jumpCount,1);assert(jump(g));assert.equal(jump(g),false);});
test('floating-point accumulated edge crossing cannot pass through a solid step',()=>{const g=at(16.8,-54);const events=[];run(g,1.2);for(let i=0;i<8;i++){step(g,1/120);events.push(...g.events);}assert.equal(g.hearts,2);assert(g.recoveryUntil>18);assert.equal(g.y,0);});

test('low-only jumps cannot collect double-jump stars',()=>{for(const mode of Object.keys(MODES)){const {g}=route(mode,720,60,.15,null);assert.equal(g.stars,0);}});
test('drop rewards and rest snacks follow the actual lower floor',()=>{const g=at(13);g.courseIndex=3;g.snackIndex=3;step(g,1/120);const drops=g.treats.filter(t=>t.encounterAt===14);assert.equal(drops.length,3);for(const t of drops){assert(t.offset/MODES.normal.speed>=.5);assert.equal(t.y,GROUND+54-35);}for(const time of [14.6,15.2])assert.equal(g.treats.find(t=>t.encounterAt===time)?.y,GROUND+54-35);});

test('descending above a raised lip at crossing lands even when tick ends below its top',()=>{const g=at(26.999,48.3);g.grounded=false;g.vy=-259.08;g.jumpCount=2;step(g,1/120);assert.equal(g.hearts,3);assert.equal(g.y,48);assert.equal(g.grounded,true);assert.equal(g.jumpCount,0);assert(g.events.some(e=>e.type==='land'));assert(!g.events.some(e=>e.type==='recover'));});
test('descending below a raised lip at crossing collides with its face',()=>{const g=at(26.999,48.05);g.grounded=false;g.vy=-259.08;g.jumpCount=2;step(g,1/120);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));});
test('ascending through a raised face is blocked even when tick ends above its top',()=>{const g=at(26.999,47.5);g.grounded=false;g.vy=260.8;g.jumpCount=1;step(g,1/120);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));});

function hitFixture(mode,kind='collision',hearts=3){
 const g=kind==='wall'?at(17.999,-54,mode):kind==='fall'?at(10.4,-159,mode):at(2,0,mode);
 g.hearts=hearts;
 if(kind==='fall'){g.grounded=false;g.vy=-180;g.jumpCount=1;}
 g.obstacles=kind==='collision'?[{id:900,x:CAT_X+50,w:44,h:42,hit:false,cleared:false}]:[];
 g.obstacles.push({id:901,x:500,w:44,h:42,hit:false,cleared:false});
 g.treats=[{id:902,x:500,y:GROUND-35,taken:false}];
 return g;
}
function worldSnapshot(game){const {reactionElapsed,reactionRemaining,...world}=game;return structuredClone(world);}

test('reaction clock is explicit, frame-bounded, inert without a hit, and rejects invalid time',()=>{
 for(const mode of Object.keys(MODES)){
  const g=playing(mode),before=structuredClone(g);
  assert.equal(advanceReaction(g,1),false);assert.deepEqual(g,before);
  const hit=hitFixture(mode);step(hit,FIXED_STEP);const frozen=structuredClone(hit);
  for(const dt of [NaN,Infinity,-Infinity,-1,0]){assert.equal(advanceReaction(hit,dt),false);assert.deepEqual(hit,frozen);}
  assert.equal(advanceReaction(hit,10),false);assert.equal(hit.reactionElapsed,1/30);
  assert.equal(hit.reactionRemaining,HIT_REACTION_SECONDS-1/30);
  assert.deepEqual(worldSnapshot(hit),worldSnapshot(frozen));
 }
});

test('every damaging collision, wall and fall freezes the entire world at both speeds',()=>{
 for(const mode of Object.keys(MODES))for(const kind of ['collision','wall','fall'])for(const hz of [30,60,120]){
  const g=hitFixture(mode,kind),before=g.elapsed;
  step(g,1/30);
  assert.equal(g.elapsed,before+FIXED_STEP,`${mode}/${kind}/${hz}: only the damaging tick advances`);
  assert.equal(g.accumulator,0);assert.equal(g.hearts,2);assert.equal(g.hitCount,1);
  assert.equal(g.reactionElapsed,0);assert.equal(g.reactionRemaining,HIT_REACTION_SECONDS);
  const frozen=worldSnapshot(g),eventList=g.events;
  let completions=0,frames=0;
  while(g.reactionRemaining>0){
   const unchanged=structuredClone(g);
   step(g,1/hz);assert.deepEqual(g,unchanged);
   assert.equal(jump(g),false);assert.equal(pressJump(g),false);assert.deepEqual(g,unchanged);
   completions+=Number(advanceReaction(g,1/hz));frames++;
   assert.deepEqual(worldSnapshot(g),frozen);
   assert.equal(g.events,eventList,'frozen step does not replace or re-emit the hit frame');
   assert.equal(g.events.filter(e=>e.type==='hit').length,1);
   assert(frames<=Math.ceil(HIT_REACTION_SECONDS*hz));
  }
  assert.equal(frames,Math.ceil(HIT_REACTION_SECONDS*hz));assert.equal(completions,1);
  assert.equal(g.reactionElapsed,HIT_REACTION_SECONDS);
  assert.equal(advanceReaction(g,1/hz),false);assert.deepEqual(worldSnapshot(g),frozen);
  step(g,FIXED_STEP);
  assert.equal(g.elapsed,frozen.elapsed+FIXED_STEP);assert.equal(g.hearts,2);
  assert.equal(g.invincible,frozen.invincible-FIXED_STEP);
  assert(!g.events.some(e=>e.type==='hit'));
  assert(g.obstacles.find(o=>o.id===901).x<frozen.obstacles.find(o=>o.id===901).x);
 }
});

test('protected contacts do not damage, restart a completed reaction, or count as clears',()=>{
 for(const mode of Object.keys(MODES)){
  const g=hitFixture(mode);step(g,FIXED_STEP);finishReaction(g);
  g.obstacles.push({id:903,x:CAT_X+50,w:44,h:42,hit:false,cleared:false});
  step(g,FIXED_STEP);
  assert.equal(g.hearts,2);assert.equal(g.hitCount,1);
  assert.equal(g.reactionRemaining,0);assert.equal(g.reactionElapsed,HIT_REACTION_SECONDS);
  assert.equal(g.obstacles.find(o=>o.id===903).hit,true);
  assert(!g.events.some(e=>e.type==='hit'));
  run(g,.4);assert.equal(g.cleared,0);
  // A genuinely later unprotected contact starts a fresh reaction exactly once.
  run(g,2);g.obstacles.push({id:904,x:CAT_X+50,w:44,h:42,hit:false,cleared:false});
  step(g,FIXED_STEP);assert.equal(g.hearts,1);assert.equal(g.hitCount,2);
  assert.equal(g.reactionElapsed,0);assert.equal(g.reactionRemaining,HIT_REACTION_SECONDS);
 }
});

test('manual pause freezes both nonfatal and final-heart reaction clocks',()=>{
 for(const mode of Object.keys(MODES))for(const hearts of [1,3]){
  const g=hitFixture(mode,'collision',hearts);step(g,FIXED_STEP);
  advanceReaction(g,1/30);const status=g.status;g.status='paused';
  const frozen=structuredClone(g);
  for(let i=0;i<120;i++){step(g,1/30);assert.equal(advanceReaction(g,1/30),false);assert.equal(jump(g),false);assert.equal(pressJump(g),false);}
  assert.deepEqual(g,frozen);
  g.status=status;finishReaction(g);
  assert.equal(g.status,hearts===1?'finished':'running');assert.equal(g.reactionRemaining,0);
  assert.equal(g.elapsed,frozen.elapsed);assert.equal(g.hearts,hearts-1);
 }
});

test('reaction rejects held, repeated and third taps without buffering input',()=>{
 for(const mode of Object.keys(MODES)){
  const g=hitFixture(mode);g.y=5;g.vy=-40;g.grounded=false;g.jumpCount=2;g.jumpHeld=true;
  step(g,FIXED_STEP);const y=g.y,vy=g.vy;
  for(let i=0;i<10;i++){assert.equal(pressJump(g),false);assert.equal(jump(g),false);advanceReaction(g,1/30);}
  assert.equal(g.y,y);assert.equal(g.vy,vy);assert.equal(g.jumpCount,2);assert.equal(g.jumpHeld,true);
  releaseJump(g);
  assert.equal(pressJump(g),false);assert.equal(g.jumpHeld,false,'rejected reaction press does not queue a held latch');
  finishReaction(g);assert.equal(g.jumpCount,2);assert.equal(jump(g),false,'reaction grants no extra air jump');
  run(g,.4);assert.equal(g.y,0);assert.equal(g.jumpCount,0);assert.equal(g.vy,0);
  assert.equal(g.pendingBoost,null);assert(jump(g),'only a new accepted input jumps after landing');
 }
});

test('last-heart collision, wall and fall finish their visible reaction without reviving gameplay',()=>{
 for(const mode of Object.keys(MODES))for(const kind of ['collision','wall','fall']){
  const g=hitFixture(mode,kind,1);step(g,1/30);
  assert.equal(g.status,'finished');assert.equal(g.hearts,0);assert.equal(g.hitCount,1);
  assert.equal(g.event,'finished');assert.equal(g.reactionRemaining,HIT_REACTION_SECONDS);
  assert.equal(g.events.filter(e=>e.type==='finished').length,1);
  if(kind!=='collision'){
   assert.equal(g.y,0);assert.equal(g.vy,0);assert.equal(g.grounded,true);
   assert.equal(g.floorHeight,0);assert(g.recoveryUntil>g.elapsed);
   assert(g.events.some(e=>e.type==='recover'&&e.reason===kind));
  }
  const world=worldSnapshot(g);finishReaction(g,30);assert.deepEqual(worldSnapshot(g),world);
  const complete=structuredClone(g);
  for(let i=0;i<120;i++){step(g,1/30);assert.equal(advanceReaction(g,1/30),false);assert.equal(jump(g),false);assert.equal(pressJump(g),false);}
  assert.deepEqual(g,complete);
  const restarted=createGame(mode);assert.equal(restarted.reactionElapsed,0);assert.equal(restarted.reactionRemaining,0);
  assert.equal(restarted.hearts,3);assert.equal(restarted.jumpHeld,false);assert.equal(restarted.accumulator,0);
 }
});

test('a hypothetical finish-line collision completes reaction before a clean finish',()=>{
 for(const mode of Object.keys(MODES)){
  const g=hitFixture(mode);g.elapsed=ROUND_SECONDS-FIXED_STEP;
  step(g,FIXED_STEP);assert.equal(g.status,'running');assert.equal(g.reactionRemaining,HIT_REACTION_SECONDS);
  finishReaction(g);assert.equal(g.status,'running');step(g,FIXED_STEP);
  assert.equal(g.status,'won');assert.equal(g.hearts,2);assert.equal(g.elapsed,ROUND_SECONDS);
 }
});


test('accepted presses timestamp launch and boost immediately; rejected inputs never change them',()=>{
 const g=playing();assert.equal(g.lastJumpAt,null);assert.equal(g.lastBoostAt,null);
 pressJump(g);assert.equal(g.lastJumpAt,0);assert.equal(g.lastBoostAt,null);assert.equal(g.vy,JUMP_SPEED);
 run(g,.2);const first=g.lastJumpAt;assert.equal(pressJump(g),false);assert.equal(g.lastJumpAt,first);
 releaseJump(g);pressJump(g);assert.equal(g.lastJumpAt,g.elapsed);assert.equal(g.lastBoostAt,g.elapsed);assert.equal(g.vy,SECOND_JUMP_SPEED);
 const boost=g.lastBoostAt;releaseJump(g);assert.equal(pressJump(g),false);assert.equal(g.lastJumpAt,boost);assert.equal(g.lastBoostAt,boost);
});
test('walk-off gravity starts at the actual edge, rather than the start of its enclosing physics tick',()=>{
 const g=at(13.999);step(g,FIXED_STEP);const falling=FIXED_STEP-.001;
 assert(Math.abs(g.y+FALL_GRAVITY*falling*falling/2)<1e-10);assert(Math.abs(g.vy+FALL_GRAVITY*falling)<1e-9);
 assert.equal(g.jumpCount,1);assert.equal(g.grounded,false);
});
test('a descending landing inside the same tick as an apex uses the fall gravity',()=>{
 const g=at(27.1,48);g.grounded=false;g.vy=2;g.jumpCount=2;step(g,FIXED_STEP);
 assert.equal(g.grounded,true);assert.equal(g.y,48);const event=g.events.find(e=>e.type==='land');
 assert(Math.abs(event.impactSpeed-2*Math.sqrt(FALL_GRAVITY/RISE_GRAVITY))<1e-8);
});
test('gaps exceed the entire first jump but allow an explicitly late air-tap rescue',()=>{
 for(const o of ENCOUNTERS.filter(o=>o.kind==='gap'))assert(o.duration>SINGLE_JUMP_SECONDS);
 for(const mode of Object.keys(MODES)){
  const g=at(9.99,0,mode);run(g,.1);assert.equal(g.jumpCount,1);assert.equal(g.grounded,false);
  assert(jump(g));assert.equal(g.jumpCount,2);assert.equal(jump(g),false);run(g,1.1);
  assert.equal(g.hearts,3);assert(g.grounded);assert.equal(g.y,0);
 }
});

test('complete routes driven by visible cues collect every star and land before the next preparation cue',()=>{
 let trials=0;
 for(const mode of Object.keys(MODES))for(const width of [640,720,800,1200])for(const hz of [30,60,120])for(const r1 of [80,150,250])for(const r2 of [80,150,250]){
  const g=playing(mode,width),label=`${mode}/${width}/${hz}/${r1}/${r2}`;
  const inputs=ENCOUNTERS.filter(o=>o.taps).map(o=>cueInputs(mode,o,r1,r2));
  let lastLanding=0,minRunway=Infinity;const seen=new Set();
  while(g.status==='running'){
   if(g.reactionRemaining>0){advanceReaction(g,1/hz);continue;}
   for(const o of ENCOUNTERS.filter(o=>o.taps))if(!seen.has(o)&&o.encounterAt-g.elapsed<jumpCueSeconds(mode,o)){
    seen.add(o);assert(g.grounded,`${label}: airborne at next cue ${o.encounterAt}`);minRunway=Math.min(minRunway,g.elapsed-lastLanding);
   }
   for(const input of inputs)input(g);step(g,1/hz);
   for(const event of g.events)if(event.type==='land')lastLanding=event.at;
  }
  assert.equal(g.status,'won',label);assert.equal(g.hearts,3,label);assert.equal(g.cleared,ENCOUNTERS.length,label);
  assert.equal(g.stars,7,label);assert(minRunway>.94,`${label}: ${minRunway}s landing runway`);trials++;
 }
 assert.equal(trials,216);
});

test('continuous reaction rectangle leaves clearance even with conservative30Hz cue/input delay',()=>{
 // Include80–250ms response plus up to50ms total cue/press quantization.
 // Flight height is concave in elapsed time and boost time: on these rectangles
 // its minimum is at a corner. Every high contact is after the boost; for long
 // obstacles the first contact already clears the top before any boost is needed.
 for(const mode of Object.values(MODES))for(const kind of ['high','long','gap']){
  const o=ENCOUNTERS.find(e=>e.kind===kind),threshold=kind==='gap'?0:o.h-10;
  if(kind!=='high'){
   for(const age of [jumpCueSeconds(null,o)-.30-1/mode.speed,jumpCueSeconds(null,o)-.08-1/mode.speed,secondJumpCueSeconds(null,o)+.08,secondJumpCueSeconds(null,o)+.30]){
    assert(flightAfter(0,JUMP_SPEED,age).y>threshold);
   }
  }
  const contacts=kind==='high'?[-1/mode.speed,o.duration+11/mode.speed]:[o.duration+(kind==='long'?11/mode.speed:0)];
  for(const response of [.08,.30])for(const secondResponse of [.08,.30])for(const contact of contacts){
   const delay=secondJumpCueSeconds(null,o)+secondResponse,age=jumpCueSeconds(null,o)-response+contact;
   assert(delay<SINGLE_JUMP_SECONDS);assert(age>delay);
   const first=flightAfter(0,JUMP_SPEED,delay),boosted=flightAfter(first.y,SECOND_JUMP_SPEED,age-delay);
   assert(boosted.y-threshold>(kind==='high'?7.7:kind==='long'?10.5:22.6),`${kind}/${mode.speed}/${response}/${secondResponse}`);
  }
 }
});
test('distant hazard hints prepare; only the timed controller cue asks for a tap',()=>{
 for(const o of ENCOUNTERS.filter(o=>o.taps)){assert(o.hint.includes('준비'));assert(!o.hint.includes('톡'));}
});

test('every double-jump star is continuously unreachable by any low ground-jump timing',()=>{
 for(const mode of Object.keys(MODES))for(const o of ENCOUNTERS.filter(e=>e.taps===2)){
  const g=encounterGame(mode,o),star=g.treats.find(t=>t.kind==='star');
  const rewardHeight=GROUND-(floorAt(o.encounterAt)??0)-star.y;
  // Pickup top is y+60; the star's forgiving radius adds15px.
  assert(rewardHeight>SINGLE_JUMP_APEX+75);
 }
});
