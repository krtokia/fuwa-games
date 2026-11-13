import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,ensureCourse,instantiatePattern,PATTERNS,CHUNK_SECONDS,difficultyWeights} from '../course.mjs';
import {createGame,MODES,step,jump,advanceReaction,jumpCueSeconds,secondJumpCueSeconds,STARTING_SECONDS,POTION_SECONDS} from '../engine.mjs';

// Match HUD timing: detection, human response, and accepted first-tap-relative
// second cue are quantized to the actual render rate, not ideal fixed-step taps.
function route({seed=1,mode='normal',width=720,hz=60,response=.15,secondResponse=response,until=Infinity,extend=false}={}){
 const g=createGame(mode,width,{seed});g.status='running';const inputs=new Map(),events=[];
 let maxChunks=0,maxTerrain=0,maxObstacles=0,maxTreats=0,minRunway=Infinity,lastLanding=0;
 while(g.status==='running'&&g.elapsed<until){
  if(g.reactionRemaining>0){advanceReaction(g,1/hz);continue;}
  for(const o of g.course.encounters){
   if(!o.taps||o.encounterAt<g.elapsed-2)continue;
   let input=inputs.get(o.index);
   if(!input&&o.encounterAt-g.elapsed<jumpCueSeconds(mode,o)){
    assert(g.grounded,`seed${seed}/${mode}/${hz}: airborne at ${o.kind}@${o.encounterAt}`);
    minRunway=Math.min(minRunway,g.elapsed-lastLanding);
    input={firstAt:g.elapsed+response,pressedAt:null,secondAt:null,secondCue:false};inputs.set(o.index,input);
   }
   if(!input)continue;
   if(input.firstAt!==null&&g.elapsed>=input.firstAt){assert(jump(g),`first:${o.kind}@${g.elapsed}`);input.pressedAt=g.elapsed;input.firstAt=null;}
   if(o.taps===2&&input.pressedAt!==null&&!input.secondCue&&g.jumpCount===1&&g.elapsed-g.jumpStartedAt>=secondJumpCueSeconds(mode,o)){input.secondCue=true;input.secondAt=g.elapsed+secondResponse;}
   if(input.secondAt!==null&&g.elapsed>=input.secondAt){assert(jump(g),`second:${o.kind}@${g.elapsed}`);input.secondAt=null;}
  }
  if(extend)g.remainingTime=30; // Stress only: real runs never refill this way.
  step(g,1/hz);events.push(...g.events);
  for(const event of g.events)if(event.type==='land')lastLanding=event.at;
  maxChunks=Math.max(maxChunks,g.course.chunks.length);maxTerrain=Math.max(maxTerrain,g.course.terrain.length);
  maxObstacles=Math.max(maxObstacles,g.obstacles.length);maxTreats=Math.max(maxTreats,g.treats.length);
  assert(g.elapsed<200||extend,'perfect play must still expire');
 }
 return {g,events,maxChunks,maxTerrain,maxObstacles,maxTreats,minRunway};
}

test('authored patterns return to baseline with readable entries and safe potion exits',()=>{
 assert.equal(PATTERNS.length,21);
 for(const p of PATTERNS){const chunk=instantiatePattern(p.id);assert.equal(chunk.end,CHUNK_SECONDS);assert.equal(chunk.terrain[0].start,0);assert.equal(chunk.terrain[0].height,0);assert.equal(chunk.terrain.at(-1).end,6);assert.equal(chunk.terrain.at(-1).height,0);assert(chunk.terrain.at(-1).start<=4.65);
  // An automatic drop may precede the first jump; no active cue is rushed.
  assert(chunk.encounters[0].encounterAt>=1.15);assert(chunk.encounters.find(o=>o.taps).encounterAt>=1.4);
  assert(chunk.encounters.filter(o=>o.taps).length<=2);assert(chunk.potionSlot[0]>=5.35);assert(chunk.potionSlot[1]<=5.65);
  const active=chunk.encounters.filter(o=>o.taps);
  for(let i=1;i<active.length;i++){const a=active[i-1],b=active[i];assert(b.encounterAt-jumpCueSeconds(null,b)-(a.encounterAt+a.duration)>.7,p.id);}
  // Full ballistic landing-to-cue / pickup margins are tested in patterns.test.
  assert(chunk.potionSlot[0]-chunk.terrain.at(-1).start>=.7-1e-10,p.id);
 }
});
test('same seed reproduces patterns, terrain and potion positions independent of generation batches',()=>{
 for(const seed of [0,1,17,0x1234abcd,0xffffffff]){
  const a=createCourse(seed),b=createCourse(seed);ensureCourse(a,180);for(let t=.25;t<=180;t+=.25)ensureCourse(b,t);
  assert.deepEqual(a,b);const c=createCourse(seed);ensureCourse(c,180);assert.deepEqual(c,a);
 }
 const courses=[1,2,3,4].map(seed=>{const c=createCourse(seed);ensureCourse(c,120);return c.chunks.map(p=>p.id).join(',')});assert.equal(new Set(courses).size,4);
});
test('difficulty weights introduce harder combinations gradually while preserving easier patterns',()=>{
 assert.equal(difficultyWeights(0)[3],0);assert(difficultyWeights(24)[3]>0);
 const weightedMean=t=>{const weights=difficultyWeights(t),p=PATTERNS.filter(p=>p.id!=='welcome');return p.reduce((sum,p)=>sum+p.difficulty*weights[p.difficulty-1],0)/p.reduce((sum,p)=>sum+weights[p.difficulty-1],0);};
 assert(weightedMean(0)<weightedMean(24));assert(weightedMean(24)<weightedMean(60));assert(difficultyWeights(10000).every(w=>w>0));
 for(let seed=0;seed<200;seed++){const c=createCourse(seed);ensureCourse(c,24);assert(c.chunks.every(p=>p.difficulty<4));}
});
test('1000 seeds keep embedded potions reachable, random and strictly slower than ten-second supply',()=>{
 const positions=new Set(),patterns=new Set(),gaps=new Set();let maxPerfectLifetime=0;
 for(let seed=0;seed<1000;seed++){
  const c=createCourse(seed);ensureCourse(c,600);const potions=c.pickups.filter(p=>p.kind==='potion');assert(potions.length>25);
  assert(potions[0].encounterAt>=11.35&&potions[0].encounterAt<=17.65);let previous=null,previousChunk=null,budget=STARTING_SECONDS;
  for(const p of potions){const chunk=c.chunks[p.chunkIndex];assert.equal(p.patternId,chunk.id);assert(p.encounterAt>=chunk.potionSlot[0]&&p.encounterAt<=chunk.potionSlot[1]);assert(c.terrain.some(s=>s.height===0&&p.encounterAt>=s.start&&p.encounterAt<s.end));
   if(previous!==null){const delta=p.encounterAt-previous;assert(delta>=11.7-1e-9&&delta<=18.3+1e-9);assert(delta>POTION_SECONDS);gaps.add(p.chunkIndex-previousChunk);}
   previous=p.encounterAt;previousChunk=p.chunkIndex;positions.add((p.encounterAt%6).toFixed(6));patterns.add(p.patternId);
   // Earliest pickup edge is <0.2s ahead of center at either speed. Even an
   // omniscient player taking every potion as early as possible must expire.
   if(p.encounterAt-.2<budget)budget+=POTION_SECONDS;
  }
  assert(budget<=150,`seed${seed} permitted ${budget}s`);maxPerfectLifetime=Math.max(maxPerfectLifetime,budget);
 }
 assert(positions.size>1000);assert(patterns.size>=7);assert.deepEqual([...gaps].sort(),[2,3]);assert(maxPerfectLifetime>60);
});
test('216 complete seeded runs survive every pattern and eventually expire despite perfect potion collection',()=>{
 let trials=0,longest=0;
 for(let seed=0;seed<12;seed++)for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const response of [.08,.15,.25]){
  const {g,events,minRunway}=route({seed,mode,hz,response,width:[640,720,1200][seed%3]});const label=`${seed}/${mode}/${hz}/${response}`;
  assert.equal(g.status,'finished',label);assert.equal(g.endReason,'timeout',label);assert.equal(g.hitCount,0,label);assert.equal(g.remainingTime,0,label);assert(g.potions>=1,label);
  assert(Math.abs(g.elapsed-(STARTING_SECONDS+POTION_SECONDS*g.potions))<1e-7,label);assert.equal(events.filter(e=>e.type==='finished').length,1,label);
  assert.equal(events.filter(e=>e.type==='potion').length,g.potions,label);assert.equal(g.score,events.filter(e=>e.type==='snack'||e.type==='clear').reduce((sum,e)=>sum+e.value,0),label);
  assert.equal(g.snacks,events.filter(e=>e.type==='snack').length,label);assert.equal(g.stars,events.filter(e=>e.type==='snack'&&e.kind==='star').length,label);
  assert(minRunway>.5,`${label}: only ${minRunway}s between landing and next cue`);longest=Math.max(longest,g.elapsed);trials++;
 }
 assert.equal(trials,216);assert(longest>44);
});
test('same seed replay is bit-identical through terminal timer, score and pickups',()=>{
 for(const seed of [0,1,24,0xffffffff]){const a=route({seed}),b=route({seed});assert.deepEqual(a.g,b.g);assert.deepEqual(a.events,b.events);}
});
test('no-input runs end without endless falls, even with reachable exit potions',()=>{
 for(let seed=0;seed<32;seed++){const g=createGame('normal',720,{seed});g.status='running';let frames=0;while(g.status==='running'||g.reactionRemaining>0){if(g.reactionRemaining>0)advanceReaction(g,1/60);else step(g,1/60);assert(++frames<150*60);}assert.equal(g.status,'finished');assert.equal(g.remainingTime,0);assert(g.hitCount>0);assert(g.elapsed<60);}
});
test('streaming generation and runtime actors stay bounded in a ten-minute stress run',()=>{
 const maxTerrainPerChunk=Math.max(...PATTERNS.map(p=>p.terrain.length)),maxEncountersPerChunk=Math.max(...PATTERNS.map(p=>p.encounters.length));
 const result=route({seed:0x1234abcd,hz:30,width:1200,until:600,extend:true});assert.equal(result.g.hitCount,0);assert.equal(result.g.status,'running');assert(result.maxChunks<=5);assert(result.maxTerrain<=5*maxTerrainPerChunk);assert(result.maxObstacles<=10);assert(result.maxTreats<=40);
 const c=createCourse(8);for(let t=0;t<=86400;t+=3){ensureCourse(c,t+12,t-3);assert(c.chunks.length<=4);assert(c.encounters.length<=4*maxEncountersPerChunk);assert(c.terrain.length<=4*maxTerrainPerChunk);assert(c.pickups.length<=4*(2+Math.max(...PATTERNS.map(p=>p.routePickups.length))));}assert.equal(c.nextChunkIndex,14402);
});
