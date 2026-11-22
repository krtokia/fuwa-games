import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,jump,pressJump,releaseJump,step,advanceReaction,HIT_REACTION_SECONDS,FIXED_STEP,MODES,STARTING_SECONDS,POTION_SECONDS,COLLISION_PENALTY_SECONDS,GROUND,CAT_X,RISE_GRAVITY,FALL_GRAVITY,SINGLE_JUMP_APEX,SINGLE_JUMP_SECONDS,flightAfter,JUMP_SPEED,SECOND_JUMP_SPEED,terrainSegments,floorAt,nextCue,jumpCueSeconds,secondJumpCueSeconds} from '../engine.mjs';
import {PATTERNS,SHAPES,instantiatePattern} from '../course.mjs';
function playing(mode='normal',width=720,options={seed:1}){const g=createGame(mode,width,options);g.status='running';return g;}
function finishReaction(g,hz=120){while(g.reactionRemaining>0&&['running','finished'].includes(g.status))advanceReaction(g,1/hz);}
function run(g,seconds,hz=120){for(let i=0;i<Math.round(seconds*hz);i++){finishReaction(g,hz);step(g,1/hz);}}
// Explicit geometry fixtures use current pattern definitions, never a retired gameplay course.
function fixture(id='low-lane',time=0,mode='normal'){
 const g=playing(mode),chunk=instantiatePattern(id,0,0);chunk.end=1000;chunk.terrain.at(-1).end=1000;
 chunk.encounters.forEach((o,i)=>o.index=i);
 Object.assign(g.course,{chunks:[chunk],terrain:chunk.terrain,terrainEdges:[...new Set(chunk.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b),encounters:chunk.encounters,pickups:[],generatedUntil:1000});
 g.elapsed=time;g.distance=time*MODES[mode].speed;g.y=floorAt(time,g)??0;g.floorHeight=floorAt(time,g);g.courseIndex=0;
 return g;
}
function at(id,time,y,mode='normal'){const g=fixture(id,time,mode);g.y=y??floorAt(time,g)??0;g.courseIndex=1000;return g;}
function worldSnapshot(game){const {reactionElapsed,reactionRemaining,...world}=game;return structuredClone(world);}
function hitFixture(mode,kind='collision',remaining=30){
 const g=kind==='wall'?at('sunken-lane',3.599,-54,mode):kind==='fall'?at('gap-hop',1.8,-159,mode):at('low-lane',.5,0,mode);
 g.remainingTime=remaining;
 if(kind==='fall'){g.grounded=false;g.vy=-180;g.jumpCount=1;}
 g.obstacles=kind==='collision'?[{id:900,x:CAT_X+50,w:44,h:42,hit:false,cleared:false}]:[];
 g.obstacles.push({id:901,x:500,w:44,h:42,hit:false,cleared:false});
 g.treats=[{id:902,x:500,y:GROUND-35,taken:false}];return g;
}

test('new game has only a 30-second lifetime, normalized config and clean replay state',()=>{
 for(const mode of ['bad','constructor','__proto__'])assert.equal(createGame(mode).mode,'normal');
 const g=createGame();assert.equal(g.remainingTime,STARTING_SECONDS);assert.equal(g.remainingTime,30);assert.equal(POTION_SECONDS,10);assert.equal(COLLISION_PENALTY_SECONDS,5);
 assert.equal(g.hearts,undefined);assert.equal(g.energy,undefined);assert.equal(g.seed,1);assert.equal(g.potions,0);assert.equal(g.elapsed,0);assert(g.grounded);assert.equal(g.pendingBoost,null);assert.equal(g.reactionRemaining,0);
 for(const penalty of [NaN,Infinity,-1,'5'])assert.equal(createGame('normal',720,{collisionPenaltySeconds:penalty}).collisionPenaltySeconds,5);
 assert.equal(createGame('normal',720,{collisionPenaltySeconds:2}).collisionPenaltySeconds,2);
 assert.equal(createGame('normal',720,{seed:0}).seed,0);assert.equal(createGame('normal',720,{seed:-1}).seed,4294967295);
});
test('ready, paused and terminal input/time are immutable',()=>{for(const status of ['ready','paused','finished']){const g=createGame();g.status=status;const before=JSON.stringify(g);assert.equal(jump(g),false);assert.equal(pressJump(g),false);step(g,1);assert.equal(JSON.stringify(g),before);}});
test('single arc is77.44px in.663s, immediate and hold-independent with asymmetric gravity',()=>{
 assert.equal(SINGLE_JUMP_APEX,77.44);assert(Math.abs(SINGLE_JUMP_SECONDS-.6631269837220809)<1e-12);assert(FALL_GRAVITY>RISE_GRAVITY);
 for(const hz of [30,60,120])for(const hold of [0,.1,.5,2]){
  const g=playing();pressJump(g);assert.equal(g.vy,JUMP_SPEED);let apex=0,land;
  for(let i=0;i<2*hz;i++){if(g.elapsed>=hold)releaseJump(g);step(g,1/hz);apex=Math.max(apex,g.y);land??=g.events.find(e=>e.type==='land');}
  assert(apex>77.2&&apex<=SINGLE_JUMP_APEX);assert.equal(g.y,0);assert.equal(g.jumpCount,0);
  assert(Math.abs(land.at-SINGLE_JUMP_SECONDS)<1e-10);assert(Math.abs(land.impactSpeed-Math.sqrt(2*FALL_GRAVITY*SINGLE_JUMP_APEX))<1e-9);
 }
});
test('piecewise ballistic integration crosses the apex exactly and composes across arbitrary slices',()=>{
 const expected={y:77.44-800*.048**2,vy:-1600*.048},actual=flightAfter(0,440,.4);assert(Math.abs(actual.y-expected.y)<1e-12);assert(Math.abs(actual.vy-expected.vy)<1e-12);
 for(const first of [0,.002,.15,.349,.352,.36,.55]){const a=flightAfter(0,JUMP_SPEED,first),b=flightAfter(a.y,a.vy,.6-first),whole=flightAfter(0,JUMP_SPEED,.6);assert(Math.abs(b.y-whole.y)<1e-10);assert(Math.abs(b.vy-whole.vy)<1e-10);}
});
test('second press resets velocity, third is rejected and never buffered',()=>{for(const delay of [0,.1,.3,.45,.6]){const g=playing();pressJump(g);run(g,delay);assert.equal(pressJump(g),false);releaseJump(g);assert(pressJump(g));assert.equal(g.vy,SECOND_JUMP_SPEED);releaseJump(g);assert.equal(pressJump(g),false);run(g,1.2);assert.equal(g.jumpCount,0);assert.equal(pressJump(g),false);assert.equal(jump(g),false);releaseJump(g);assert(jump(g));}});
test('pause preserves queued boost and release never changes velocity',()=>{const g=playing();jump(g);run(g,.2);pressJump(g);g.status='paused';const snapshot=JSON.stringify(g);step(g,.1);assert.equal(JSON.stringify(g),snapshot);const v=g.vy;releaseJump(g);assert.equal(g.vy,v);g.status='running';step(g,1/120);assert.equal(g.events.filter(e=>e.type==='boost').length,1);step(g,1/120);assert(!g.events.some(e=>e.type==='boost'));});
test('fixed physics, timer and distance are identical across frame rates; long frames bounded',()=>{const gs=[30,60,120].map(hz=>{const g=playing();jump(g);run(g,2,hz);return g;});for(const key of ['elapsed','remainingTime','distance','y','vy','obstacles','treats','course'])assert.deepEqual(gs.map(g=>g[key]),[gs[0][key],gs[0][key],gs[0][key]]);const g=playing();step(g,10);assert.equal(g.distance,12);});
test('rendered terrain uses generated real holes, lower floors and raised floors',()=>{assert.equal(floorAt(1.8,fixture('gap-hop')),null);assert.equal(floorAt(2,fixture('sunken-lane')),-54);assert.equal(floorAt(2,fixture('rise-lane')),48);for(const mode of Object.keys(MODES)){const g=playing(mode);for(const s of terrainSegments(g)){assert.equal(s.w,(s.end-s.start)*MODES[mode].speed);assert.equal(s.baseY,GROUND-s.height);}}});
test('walking over a drop falls continuously then lands on lower floor',()=>{const g=at('sunken-lane',1.39);step(g,1/60);assert(g.y<0&&g.y>-1);assert(!g.grounded);run(g,.5);assert.equal(g.y,-54);assert(g.grounded);assert.equal(g.hitCount,0);});
test('a descending crossing lands on raised ground, not on air',()=>{const g=at('rise-lane',1.5,49);g.grounded=false;g.vy=-120;g.jumpCount=2;step(g,1/60);assert.equal(g.y,48);assert(g.grounded);assert.equal(g.jumpCount,0);const hole=at('gap-hop',1.9,1);hole.grounded=false;hole.vy=-120;hole.jumpCount=2;step(hole,1/60);assert(hole.y<0);assert.equal(hole.jumpCount,2);assert(!hole.grounded);});
test('landing just before/after far lip respects actual surface',()=>{const early=at('gap-hop',2.07,1);early.grounded=false;early.vy=-100;step(early,1/60);assert(early.y<0);assert(!early.grounded);const late=at('gap-hop',2.11,1);late.grounded=false;late.vy=-100;step(late,1/60);assert.equal(late.y,0);assert(late.grounded);});
test('wall and fall each cost five seconds and rescue once without repeated penalties',()=>{
 for(const [id,time,y] of [['sunken-lane',3.59,-54],['gap-hop',1.39,0]]){const g=at(id,time,y);const events=[];for(let i=0;i<180;i++){finishReaction(g);step(g,1/120);events.push(...g.events);}assert.equal(g.hitCount,1);assert(Math.abs(g.remainingTime-(30-5-1.5))<1e-9);assert.equal(g.y,0);assert(g.grounded);assert.equal(events.filter(e=>e.type==='recover').length,1);}
});
test('walk-off consumes ground jump; rescue cannot reset midair jumps early',()=>{const g=at('gap-hop',1.39);step(g,1/30);assert(!g.grounded);assert.equal(g.jumpCount,1);assert(jump(g));assert.equal(jump(g),false);const miss=at('gap-hop',1.39);while(!miss.recoveryUntil)step(miss,FIXED_STEP);assert.equal(jump(miss),false);run(miss,.5);assert.equal(miss.jumpCount,0);assert(jump(miss));assert(jump(miss));assert.equal(jump(miss),false);});
test('raised face tested at exact edge, not end-of-tick position',()=>{
 const good=at('rise-lane',1.399,48.3);good.grounded=false;good.vy=-259.08;good.jumpCount=2;step(good,FIXED_STEP);assert.equal(good.hitCount,0);assert.equal(good.y,48);assert(good.grounded);assert(good.events.some(e=>e.type==='land'));
 for(const [height,vy] of [[48.05,-259.08],[47.5,260.8]]){const g=at('rise-lane',1.399,height);g.grounded=false;g.vy=vy;g.jumpCount=1;step(g,FIXED_STEP);assert.equal(g.hitCount,1);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));}
});
test('long width and high clearance mathematically require a second jump',()=>{
 assert(SHAPES.high.h-10>SINGLE_JUMP_APEX);
 for(const {speed} of Object.values(MODES)){const o=SHAPES.long,required=o.duration+12/speed,height=o.h-10;const crossing=(JUMP_SPEED-Math.sqrt(JUMP_SPEED**2-2*RISE_GRAVITY*height))/RISE_GRAVITY;const usable=JUMP_SPEED/RISE_GRAVITY+Math.sqrt(2*(SINGLE_JUMP_APEX-height)/FALL_GRAVITY)-crossing;assert(required>usable);}
});
function cueInput(encounter,r1,r2){
 let firstCue=false,secondCue=false,firstAt=null,secondAt=null,pressedAt=null;
 return g=>{
  if(!encounter.taps)return;
  if(!firstCue&&encounter.encounterAt-g.elapsed<jumpCueSeconds(g.mode,encounter)){firstCue=true;firstAt=g.elapsed+r1;}
  if(firstAt!==null&&g.elapsed>=firstAt){assert(jump(g),`first ${encounter.kind}@${g.elapsed}`);pressedAt=g.elapsed;firstAt=null;}
  if(encounter.taps===2&&pressedAt!==null&&!secondCue&&g.jumpCount===1&&g.elapsed-g.jumpStartedAt>=secondJumpCueSeconds(g.mode,encounter)){secondCue=true;secondAt=g.elapsed+r2;}
  if(secondAt!==null&&g.elapsed>=secondAt){assert(jump(g),`second ${encounter.kind}@${g.elapsed}`);secondAt=null;}
 };
}
test('every authored hazard permits80–250ms responses to both cues at30/60/120Hz and every render phase',()=>{
 const representatives=[['low-lane',0],['long-garden',0],['high-stack',0],['gap-hop',0],['rise-lane',0],['sunken-lane',1]];let trials=0;
 for(const [id,index] of representatives)for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(let phase=0;phase<120/hz;phase++)for(let r1=80;r1<=250;r1+=10)for(let r2=80;r2<=(SHAPES[PATTERNS.find(p=>p.id===id).encounters[index][1]].taps===2?250:80);r2+=10){
  const g=fixture(id,0,mode),o=g.course.encounters[index];g.elapsed=o.encounterAt-1.2+phase/120;g.y=floorAt(g.elapsed,g);g.floorHeight=g.y;g.courseIndex=o.index;
  // Isolate this encounter, keeping its real floor/edge geometry.
  g.course.encounters=g.course.chunks[0].encounters=[o];
  const input=cueInput(o,r1/1000,r2/1000),end=o.encounterAt+Math.max(o.duration,.2)+.7;
  while(g.elapsed<end){if(g.reactionRemaining>0){finishReaction(g,hz);continue;}input(g);step(g,1/hz);}
  const label=`${id}/${mode}/${hz}/phase${phase}/${r1}/${r2}`;
  assert.equal(g.hitCount,0,label);assert.equal(g.cleared,1,label);assert.equal(g.stars,o.taps===2?1:0,label+' stars');assert(g.grounded,label);trials++;
 }
 assert.equal(trials,14364);
});
test('continuous reaction rectangle retains generous high, long and gap clearance',()=>{
 for(const mode of Object.values(MODES))for(const kind of ['high','long','gap']){const o=SHAPES[kind],threshold=kind==='gap'?0:o.h-10;
  const contacts=kind==='high'?[-1/mode.speed,o.duration+11/mode.speed]:[o.duration+(kind==='long'?11/mode.speed:0)];
  for(const response of [.08,.30])for(const secondResponse of [.08,.30])for(const contact of contacts){const delay=secondJumpCueSeconds(null,o)+secondResponse,age=jumpCueSeconds(null,o)-response+contact;assert(delay<SINGLE_JUMP_SECONDS);assert(age>delay);const first=flightAfter(0,JUMP_SPEED,delay),boosted=flightAfter(first.y,SECOND_JUMP_SPEED,age-delay);assert(boosted.y-threshold>(kind==='high'?7.7:kind==='long'?10.5:22.6));}
 }
});
test('potion is collected exactly once, adds ten seconds, and is never a snack or score',()=>{
 const g=playing();g.treats=[{id:91,x:CAT_X+60,y:GROUND-35,kind:'potion',value:10,taken:false}];step(g,FIXED_STEP);
 assert.equal(g.potions,1);assert.equal(g.snacks,0);assert.equal(g.stars,0);assert.equal(g.score,0);assert(Math.abs(g.remainingTime-(40-FIXED_STEP))<1e-9);assert.equal(g.events.filter(e=>e.type==='potion').length,1);assert(!g.events.some(e=>e.type==='snack'));run(g,.1);assert.equal(g.potions,1);
});
test('zero time ends before a simultaneous potion and terminal state cannot revive',()=>{
 for(const remaining of [0,FIXED_STEP/2,FIXED_STEP]){const g=playing();g.remainingTime=remaining;g.treats=[{id:91,x:CAT_X+60,y:GROUND-35,kind:'potion',taken:false}];step(g,FIXED_STEP);assert.equal(g.status,'finished');assert.equal(g.endReason,'timeout');assert.equal(g.remainingTime,0);assert.equal(g.potions,0);assert(Math.abs(g.elapsed-remaining)<1e-12);assert.equal(g.event,'finished');const before=structuredClone(g);step(g,10);assert.deepEqual(g,before);}
});
test('collision penalty is configurable, one contact costs once, and freezes before same-tick pickup/clear',()=>{
 const g=hitFixture('normal');g.collisionPenaltySeconds=2;g.treats=[{id:95,x:CAT_X+60,y:GROUND-35,kind:'potion',taken:false}];g.obstacles.push({id:96,x:-20,w:20,h:20,hit:false,cleared:false});step(g,FIXED_STEP);
 assert(Math.abs(g.remainingTime-(28-FIXED_STEP))<1e-9);assert.equal(g.hitCount,1);assert.equal(g.potions,0);assert.equal(g.cleared,0);assert.equal(g.score,0);finishReaction(g);step(g,FIXED_STEP);assert.equal(g.hitCount,1);
});
test('no course finish exists at44seconds; only remaining time terminates',()=>{const g=at('low-lane',43.99);g.remainingTime=10;run(g,1);assert.equal(g.status,'running');assert(g.elapsed>44);assert.equal(g.endReason,null);});
test('next cue and generated geometry are independent of viewport width',()=>{const games=[640,1200].map(w=>playing('normal',w));for(const g of games)run(g,3);assert.equal(nextCue(games[0]).encounterAt,4);for(const o of games[0].obstacles){const other=games[1].obstacles.find(a=>a.encounterAt===o.encounterAt);assert.equal(o.x,other.x);assert.equal(o.w,other.w);}assert.deepEqual(games[0].course.chunks.map(c=>c.id),games[1].course.chunks.slice(0,games[0].course.chunks.length).map(c=>c.id));});
test('reaction clock is explicit, bounded, inert without a hit, and rejects invalid time',()=>{
 for(const mode of Object.keys(MODES)){const g=playing(mode),before=structuredClone(g);assert.equal(advanceReaction(g,1),false);assert.deepEqual(g,before);const hit=hitFixture(mode);step(hit,FIXED_STEP);const frozen=structuredClone(hit);for(const dt of [NaN,Infinity,-Infinity,-1,0]){assert.equal(advanceReaction(hit,dt),false);assert.deepEqual(hit,frozen);}assert.equal(advanceReaction(hit,10),false);assert.equal(hit.reactionElapsed,1/30);assert.deepEqual(worldSnapshot(hit),worldSnapshot(frozen));}
});
test('collision, wall and fall freeze timer and entire world for exact.85s at both speeds',()=>{
 for(const mode of Object.keys(MODES))for(const kind of ['collision','wall','fall'])for(const hz of [30,60,120]){
  const g=hitFixture(mode,kind),before=g.elapsed;step(g,1/30);assert.equal(g.elapsed,before+FIXED_STEP);assert.equal(g.accumulator,0);assert.equal(g.hitCount,1);assert.equal(g.reactionRemaining,HIT_REACTION_SECONDS);
  const frozen=worldSnapshot(g);let completions=0,frames=0;
  while(g.reactionRemaining>0){assert.equal(jump(g),false);assert.equal(pressJump(g),false);step(g,1/hz);assert.deepEqual(worldSnapshot(g),frozen);if(advanceReaction(g,1/hz))completions++;frames++;}
  assert.equal(completions,1);assert.equal(frames,Math.ceil(HIT_REACTION_SECONDS*hz));assert.deepEqual(worldSnapshot(g),frozen);const elapsed=g.elapsed;step(g,FIXED_STEP);assert(g.elapsed>elapsed);
 }
});
test('manual pause freezes a partly played hiss and resumes without world catch-up',()=>{
 const g=hitFixture('normal');step(g,FIXED_STEP);advanceReaction(g,1/30);g.status='paused';const before=structuredClone(g);for(let i=0;i<100;i++){step(g,1);advanceReaction(g,1);}assert.deepEqual(g,before);g.status='running';finishReaction(g);const elapsed=g.elapsed;step(g,FIXED_STEP);assert.equal(g.elapsed,elapsed+FIXED_STEP);
});
test('final collision/fall/wall reaches zero but preserves rescue and whole final hiss',()=>{
 for(const kind of ['collision','wall','fall']){const g=hitFixture('normal',kind,2);step(g,FIXED_STEP);assert.equal(g.status,'finished');assert.equal(g.remainingTime,0);assert.equal(g.endReason,'collision');assert.equal(g.event,'finished');assert.equal(g.reactionRemaining,.85);if(kind!=='collision'){assert(g.grounded);assert(g.y>=-54);assert(g.events.some(e=>e.type==='recover'));}const before=worldSnapshot(g);finishReaction(g);assert.deepEqual(worldSnapshot(g),before);step(g,1);assert.deepEqual(worldSnapshot(g),before);}
});
