import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,jump,pressJump,releaseJump,step,MODES,ROUND_SECONDS,GROUND,CAT_X,GRAVITY,JUMP_SPEED,SECOND_JUMP_SPEED,ENCOUNTERS,COURSE,TERRAIN,terrainSegments,floorAt,nextCue,jumpCueSeconds} from '../engine.mjs';
function playing(mode='normal',width=640){const g=createGame(mode,width);g.status='running';return g;}
function run(g,seconds,hz=120){for(let i=0;i<Math.round(seconds*hz);i++)step(g,1/hz);}
function route(mode='normal',width=640,hz=120,response=.15,second=.5,miss=null){
 const g=playing(mode,width),events=[];const taps=ENCOUNTERS.flatMap(o=>{const first=o.encounterAt-jumpCueSeconds(mode,o)+response;return o.taps&&o.encounterAt!==miss?[first,...o.taps===2&&second!==null?[first+second]:[]]:[];});let i=0;
 while(g.status==='running'){if(g.elapsed>=taps[i]-1e-9){assert(jump(g),`tap ${taps[i]} at ${g.elapsed}`);i++;}step(g,1/hz);events.push(...g.events);}return {g,events};
}
function at(time,y=floorAt(time)??0){const g=playing();g.elapsed=time;g.distance=time*MODES[g.mode].speed;g.courseIndex=COURSE.length;g.snackIndex=99;g.y=y;g.floorHeight=floorAt(time);return g;}
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
 while(g.elapsed<end){onFrame(g);step(g,1/hz);events.push(...g.events);}
 return events;
}
test('invalid mode is normalized, restart is clean',()=>{for(const mode of ['bad','constructor','__proto__'])assert.equal(createGame(mode).mode,'normal');const g=createGame();assert.equal(g.hearts,3);assert.equal(g.elapsed,0);assert.equal(g.grounded,true);assert.equal(g.pendingBoost,null);});
test('ready, paused and terminal input/time are immutable',()=>{for(const status of ['ready','paused','won','finished']){const g=createGame();g.status=status;const before=JSON.stringify(g);assert.equal(jump(g),false);assert.equal(pressJump(g),false);step(g,1);assert.equal(JSON.stringify(g),before);}});
test('single arc is 90.25 high and .95 seconds, independent of hold',()=>{assert.equal(JUMP_SPEED*2/GRAVITY,.95);for(const hz of [30,60,120])for(const hold of [0,.1,.5,2]){const g=playing();pressJump(g);let apex=0;for(let i=0;i<2*hz;i++){if(g.elapsed>=hold)releaseJump(g);step(g,1/hz);apex=Math.max(apex,g.y);}assert(apex>89&&apex<=90.251);assert.equal(g.y,0);assert.equal(g.jumpCount,0);}});
test('second press resets velocity, third is rejected and never buffered',()=>{for(const delay of [0,.1,.45,.7,.9]){const g=playing();pressJump(g);run(g,delay);assert.equal(pressJump(g),false);releaseJump(g);assert(pressJump(g));assert.equal(g.vy,SECOND_JUMP_SPEED);releaseJump(g);assert.equal(pressJump(g),false);run(g,2);assert.equal(g.jumpCount,0);assert.equal(pressJump(g),false);assert.equal(jump(g),false);releaseJump(g);assert(jump(g));}});
test('pause preserves queued boost and release never changes velocity',()=>{const g=playing();jump(g);run(g,.2);pressJump(g);g.status='paused';const snapshot=JSON.stringify(g);step(g,.1);assert.equal(JSON.stringify(g),snapshot);const v=g.vy;releaseJump(g);assert.equal(g.vy,v);g.status='running';step(g,1/120);assert.equal(g.events.filter(e=>e.type==='boost').length,1);step(g,1/120);assert(!g.events.some(e=>e.type==='boost'));});
test('fixed physics and distance are identical across frame rates; long frames bounded',()=>{const gs=[30,60,120].map(hz=>{const g=playing();jump(g);run(g,2,hz);return g;});for(const key of ['elapsed','distance','y','vy','obstacles','treats'])assert.deepEqual(gs.map(g=>g[key]),[gs[0][key],gs[0][key],gs[0][key]]);const g=playing();step(g,10);assert.equal(g.distance,12);});
test('terrain geometry contains real holes, negative floors and raised floors',()=>{assert.equal(floorAt(10.4),null);assert.equal(floorAt(15),-54);assert.equal(floorAt(28),48);for(const mode of Object.keys(MODES)){const g=playing(mode);for(const s of terrainSegments(g)){assert.equal(s.w,(s.end-s.start)*MODES[mode].speed);assert.equal(s.baseY,GROUND-s.height);}}});
test('walking over a drop falls continuously then lands on lower floor',()=>{const g=at(13.99);step(g,1/60);assert(g.y<0&&g.y>-1);assert.equal(g.grounded,false);run(g,.5);assert.equal(g.y,-54);assert.equal(g.grounded,true);assert.equal(g.hearts,3);});
test('a descending crossing lands on raised ground, not on air',()=>{const g=at(27.1,49);g.grounded=false;g.vy=-120;g.jumpCount=2;step(g,1/60);assert.equal(g.y,48);assert.equal(g.grounded,true);assert.equal(g.jumpCount,0);const hole=at(10.5,1);hole.grounded=false;hole.vy=-120;hole.jumpCount=2;step(hole,1/60);assert(hole.y<0);assert.equal(hole.jumpCount,2);assert.equal(hole.grounded,false);});
test('landing just before/after the far lip respects the actual surface',()=>{const early=at(10.92,1);early.grounded=false;early.vy=-100;step(early,1/60);assert(early.y<0);assert.equal(early.grounded,false);const late=at(10.96,1);late.grounded=false;late.vy=-100;step(late,1/60);assert.equal(late.y,0);assert.equal(late.grounded,true);});
test('rising solid wall costs a heart and emits explicit recovery, not a silent floor snap',()=>{const g=at(17.99,-54);step(g,1/60);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));assert(g.recoveryUntil>g.elapsed);run(g,1);assert.equal(g.hearts,2);assert.equal(g.y,0);});
test('missing a hole costs one heart and safely resumes at its approaching lip',()=>{const g=at(9.99);const events=[];for(let i=0;i<240;i++){step(g,1/120);events.push(...g.events);}assert.equal(g.hearts,2);assert.equal(g.hitCount,1);assert.equal(g.y,0);assert.equal(g.grounded,true);assert.equal(events.filter(e=>e.type==='recover').length,1);assert(events.some(e=>e.reason==='fall'));assert(g.elapsed>11.9);});
test('rescue cannot be exploited to reset midair jumps',()=>{const g=at(9.99);while(!g.recoveryUntil)step(g,1/120);assert.equal(jump(g),false);run(g,.5);assert.equal(g.jumpCount,0);assert(jump(g));assert(jump(g));assert.equal(jump(g),false);});
test('no input fails, not endless falling; zero hearts terminal is immutable',()=>{const {g,events}=route('normal',640,60,.15,null);assert(g.hitCount>0);assert(!events.some(e=>e.type==='clear'&&e.kind==='long'));const idle=playing();run(idle,44);assert.equal(idle.status,'finished');const before=JSON.stringify(idle);step(idle,1);assert.equal(JSON.stringify(idle),before);});
test('authored long obstacle mathematically exceeds all possible single-jump clearance',()=>{for(const mode of Object.keys(MODES)){const speed=MODES[mode].speed;for(const o of ENCOUNTERS.filter(o=>o.kind==='long')){const required=(o.duration*speed-18+30)/speed;const height=o.h-10;const usable=2*Math.sqrt(JUMP_SPEED**2-2*GRAVITY*height)/GRAVITY;assert(required>usable);}}});
test('high stack requires height beyond every possible single-jump timing',()=>{
 const high=ENCOUNTERS.find(o=>o.kind==='high');
 assert.equal(high.encounterAt,33);assert.equal(high.taps,2);assert.equal(high.cueLead,1);
 assert.equal(high.h,125);assert.equal(high.duration,.25);
 // Cat collision feet are 5px above y=0; obstacle top is inset by another5px.
 // Even the global single-jump maximum cannot clear the resulting115px top.
 // This continuous inequality covers all timings, not just the sampled inputs.
 const singleApex=JUMP_SPEED**2/(2*GRAVITY);
 assert.equal(singleApex,90.25);assert(high.h-10>singleApex);
 for(const mode of Object.keys(MODES)){
  const g=highGame(mode),o=g.obstacles[0];
  assert.equal(o.w,high.duration*MODES[mode].speed);
  for(const reward of g.treats)assert(GROUND-reward.y>high.h);
  assert.equal(g.treats.find(t=>t.kind==='star').y,GROUND-205);
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
 for(const mode of Object.keys(MODES))for(let responseMs=80;responseMs<=250;responseMs+=10)for(let delayMs=400;delayMs<=600;delayMs+=10){
  const g=highGame(mode),first=high.encounterAt-high.cueLead+responseMs/1000,taps=[first,first+delayMs/1000];let i=0;
  const events=finishHigh(g,120,game=>{if(game.elapsed>=taps[i]-1e-9){assert(jump(game));i++;}});
  const label=`${mode}/${responseMs}/${delayMs}`;
  assert.equal(g.hearts,3,label);assert.equal(g.cleared,1,label);assert.equal(g.stars,1,label);
  assert.equal(g.grounded,true,label);assert.equal(g.y,0,label);
  assert(events.some(e=>e.type==='land'),label);
  assert(next.encounterAt-jumpCueSeconds(mode,next)-g.elapsed>1.8,label);
 }
});
test('high cues allow80–250ms reactions including rendered-frame delay at both taps',()=>{
 const high=ENCOUNTERS.find(o=>o.kind==='high');let trials=0;
 // Include every physics-tick phase within a rendered frame. The HUD shows its
 // first cue strictly inside cueLead; the high-specific second cue starts at.30s.
 for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(let phase=0;phase<120/hz;phase++)for(let r1=80;r1<=250;r1+=10)for(let r2=80;r2<=250;r2+=10){
  const g=highGame(mode,phase);let firstCue=false,secondCue=false,firstAt=null,secondAt=null;
  finishHigh(g,hz,game=>{
   if(!firstCue&&high.encounterAt-game.elapsed<high.cueLead){firstCue=true;firstAt=game.elapsed+r1/1000;}
   if(firstAt!==null&&game.elapsed>=firstAt){assert(jump(game));firstAt=null;}
   if(!secondCue&&game.jumpCount===1&&game.elapsed-game.jumpStartedAt>=.3){secondCue=true;secondAt=game.elapsed+r2/1000;}
   if(secondAt!==null&&game.elapsed>=secondAt){assert(jump(game));secondAt=null;}
  });
  const label=`${mode}/${hz}Hz/phase${phase}/${r1}ms/${r2}ms`;
  assert.equal(g.hearts,3,label);assert.equal(g.cleared,1,label);assert.equal(g.stars,1,label);assert(g.grounded,label);trials++;
 }
 assert.equal(trials,4536);
});
test('authored course gives visible warning and a safe landing runway',()=>{assert(COURSE[0]>=4);assert(ROUND_SECONDS-COURSE.at(-1)>=3);for(let i=1;i<COURSE.length;i++)assert(COURSE[i]-COURSE[i-1]>=2);for(const mode of Object.keys(MODES)){const speed=MODES[mode].speed;assert((720-230)/speed>=1.3);for(let i=1;i<ENCOUNTERS.length;i++){const a=ENCOUNTERS[i-1],b=ENCOUNTERS[i];assert(b.encounterAt-jumpCueSeconds(mode,b)-(a.encounterAt+a.duration)>=.5);}}assert.deepEqual(ENCOUNTERS.slice(0,5).map(o=>o.kind),['crate','long','gap','drop','step']);});
test('all courses finish cleanly: both speeds, 640/800/1200 widths, 30/60/120fps and human reaction windows',()=>{for(const mode of Object.keys(MODES))for(const width of [640,720,800,1200])for(const hz of [30,60,120])for(const response of [.08,.15,.25])for(const second of [.4,.5,.6]){const {g,events}=route(mode,width,hz,response,second);const label=`${mode}/${width}/${hz}/${response}/${second}`;assert.equal(g.status,'won',label);assert.equal(g.hearts,3,label);assert.equal(g.cleared,ENCOUNTERS.length,label);assert.equal(g.combo,5);assert.equal(g.stars,ENCOUNTERS.filter(o=>o.taps===2).length,label+' stars');assert.equal(events.filter(e=>e.type==='won').length,1);assert.equal(g.score,events.reduce((sum,e)=>sum+(e.value??0),0));}});
test('each missed hazard is recoverable, resets combo, and costs only one heart',()=>{for(const mode of Object.keys(MODES))for(const miss of [4,7,10,18,20,23,27,33,37,40]){const {g,events}=route(mode,640,60,.15,.5,miss);const label=`${mode}/${miss}`;assert.equal(g.status,'won',label);assert.equal(g.hearts,2,label);assert.equal(g.hitCount,1,label);const hit=events.findIndex(e=>e.type==='hit');const clear=events.slice(hit+1).find(e=>e.type==='clear');if(clear)assert.equal(clear.combo,1);}});
test('one contact costs only one heart; pickup is once; terminal outranks hit',()=>{const g=playing();g.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(g,1/120);assert.equal(g.hearts,2);run(g,.1);assert.equal(g.hearts,2);const snack=playing();snack.treats=[{id:99,x:CAT_X+60,y:GROUND-35,taken:false}];step(snack,1/30);assert.equal(snack.snacks,1);step(snack,1/30);assert.equal(snack.snacks,1);const end=playing();end.hearts=1;end.obstacles=[{x:CAT_X+50,w:44,h:42,hit:false}];step(end,1/120);assert.equal(end.event,'finished');});
test('next cue and visible segments are deterministic and independent of width',()=>{const games=[640,1200].map(w=>playing('normal',w));for(const g of games)run(g,3);assert.equal(nextCue(games[0]).encounterAt,4);assert.deepEqual(terrainSegments(games[0]),terrainSegments(games[1]));for(const o of games[0].obstacles){const other=games[1].obstacles.find(a=>a.encounterAt===o.encounterAt);assert.equal(o.x,other.x);assert.equal(o.w,other.w);}});

test('walk-off consumes ground jump and allows only one air tap',()=>{const g=at(9.99);step(g,1/30);assert.equal(g.grounded,false);assert.equal(g.jumpCount,1);assert(jump(g));assert.equal(jump(g),false);});
test('floating-point accumulated edge crossing cannot pass through a solid step',()=>{const g=at(16.8,-54);const events=[];run(g,1.2);for(let i=0;i<8;i++){step(g,1/120);events.push(...g.events);}assert.equal(g.hearts,2);assert(g.recoveryUntil>18);assert.equal(g.y,0);});

test('low-only jumps cannot collect double-jump stars',()=>{for(const mode of Object.keys(MODES)){const {g}=route(mode,720,60,.15,null);assert.equal(g.stars,0);}});
test('drop rewards and rest snacks follow the actual lower floor',()=>{const g=at(13);g.courseIndex=3;g.snackIndex=3;step(g,1/120);const drops=g.treats.filter(t=>t.encounterAt===14);assert.equal(drops.length,3);for(const t of drops){assert(t.offset/MODES.normal.speed>=.5);assert.equal(t.y,GROUND+54-35);}for(const time of [14.6,15.2])assert.equal(g.treats.find(t=>t.encounterAt===time)?.y,GROUND+54-35);});

test('descending above a raised lip at crossing lands even when tick ends below its top',()=>{const g=at(26.999,48.3);g.grounded=false;g.vy=-259.08;g.jumpCount=2;step(g,1/120);assert.equal(g.hearts,3);assert.equal(g.y,48);assert.equal(g.grounded,true);assert.equal(g.jumpCount,0);assert(g.events.some(e=>e.type==='land'));assert(!g.events.some(e=>e.type==='recover'));});
test('descending below a raised lip at crossing collides with its face',()=>{const g=at(26.999,48.05);g.grounded=false;g.vy=-259.08;g.jumpCount=2;step(g,1/120);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));});
test('ascending through a raised face is blocked even when tick ends above its top',()=>{const g=at(26.999,47.5);g.grounded=false;g.vy=260.8;g.jumpCount=1;step(g,1/120);assert.equal(g.hearts,2);assert(g.events.some(e=>e.type==='recover'&&e.reason==='wall'));});
