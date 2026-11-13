import test from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS,instantiatePattern,CHUNK_SECONDS} from '../course.mjs';
import {createGame,MODES,step,jump,floorAt,jumpCueSeconds,secondJumpCueSeconds,
 JUMP_SPEED,RISE_GRAVITY,FALL_GRAVITY,SINGLE_JUMP_APEX} from '../engine.mjs';

const varied=['terrace-crate','valley-long','stair-rise','raised-gap','sunken-gap'];

function fixture(ids,mode='normal') {
 const g=createGame(mode,720),chunks=ids.map((id,i)=>instantiatePattern(id,i*CHUNK_SECONDS,i));
 let index=0,pickupIndex=0;
 for(const chunk of chunks) {
  for(const encounter of chunk.encounters)encounter.index=index++;
  // Test the earliest authored potion slot, not a later convenient sample.
  chunk.pickups=[{encounterAt:chunk.potionSlot[0],kind:'potion',height:35,value:10,index:pickupIndex++,patternId:chunk.id,chunkIndex:chunk.index}];
 }
 chunks[0].terrain[0].start=-10;
 chunks.at(-1).end=1000;chunks.at(-1).terrain.at(-1).end=1000;
 const terrain=chunks.flatMap(c=>c.terrain);
 Object.assign(g.course,{chunks,terrain,platforms:chunks.flatMap(c=>c.platforms),terrainEdges:[...new Set(terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b),
  encounters:chunks.flatMap(c=>c.encounters),pickups:chunks.flatMap(c=>c.pickups),generatedUntil:1000});
 g.status='running';
 return g;
}

function play(g,{hz=60,r1=.15,r2=r1,until=6,label='route'}={}) {
 const inputs=new Map();let minRunway=Infinity,lastLanding=g.elapsed,lastExitLanding=null;
 while(g.elapsed<until) {
  assert.equal(g.hitCount,0,label);
  for(const o of g.course.encounters) {
   if(!o.taps)continue;
   let input=inputs.get(o.index);
   if(!input&&o.encounterAt-g.elapsed<jumpCueSeconds(g.mode,o)) {
    assert(g.grounded,`${label}: airborne at ${o.kind} cue ${g.elapsed}`);
    minRunway=Math.min(minRunway,g.elapsed-lastLanding);
    inputs.set(o.index,input={firstAt:g.elapsed+r1,pressedAt:null,secondAt:null,secondCue:false});
   }
   if(!input)continue;
   if(input.firstAt!==null&&g.elapsed>=input.firstAt) {
    assert(jump(g),`${label}: first ${o.kind}@${g.elapsed}`);input.firstAt=null;input.pressedAt=g.elapsed;
   }
   if(o.taps===2&&input.pressedAt!==null&&!input.secondCue&&g.jumpCount===1&&
      g.elapsed-g.jumpStartedAt>=secondJumpCueSeconds(g.mode,o)) {
    input.secondCue=true;input.secondAt=g.elapsed+r2;
   }
   if(input.secondAt!==null&&g.elapsed>=input.secondAt) {
    assert(jump(g),`${label}: second ${o.kind}@${g.elapsed}`);input.secondAt=null;
   }
  }
  step(g,1/hz);
  for(const event of g.events)if(event.type==='land') {
   lastLanding=event.at;
   if(g.y===0)lastExitLanding=event.at;
  }
 }
 assert.equal(g.hitCount,0,label);
 return {minRunway,lastExitLanding};
}

test('new terrain has real local step heights, supported obstacles and no unannounced raised lips',()=>{
 assert.deepEqual(varied.map(id=>PATTERNS.find(p=>p.id===id)?.encounters.length),[3,3,3,3,2]);
 for(const p of PATTERNS) {
  const chunk=instantiatePattern(p.id,12,2);
  for(const o of chunk.encounters) {
   if(o.kind==='step') {
    const before=chunk.terrain.find(s=>s.start<o.encounterAt&&o.encounterAt<=s.end);
    const after=chunk.terrain.find(s=>s.start<=o.encounterAt&&o.encounterAt<s.end);
    assert.equal(o.h,after.height-before.height,p.id);
    assert(o.h>0&&o.h<=54,p.id);
   }
   if(['crate','long','high'].includes(o.kind)) {
    assert(chunk.terrain.some(s=>s.start<=o.encounterAt&&s.end>=o.encounterAt+o.duration),`${p.id}: unsupported ${o.kind}`);
   }
  }
  for(let i=1;i<chunk.terrain.length;i++) {
   const before=chunk.terrain[i-1],after=chunk.terrain[i];
   assert(after.start>=before.end,p.id);
   if(after.start>before.end) {
    const gap=chunk.encounters.find(o=>o.kind==='gap'&&o.encounterAt===before.end);
    assert(gap,`${p.id}: hidden hole`);assert(Math.abs(gap.duration-(after.start-before.end))<1e-9);
    assert(after.height<=before.height,`${p.id}: unannounced raised far lip`);
   } else {
    const kind=after.height>before.height?'step':'drop';
    assert(chunk.encounters.some(o=>o.kind===kind&&o.encounterAt===after.start),`${p.id}: missing ${kind} cue`);
   }
  }
 }
 assert.equal(instantiatePattern('stair-rise').encounters[1].h,28);
 assert.equal(instantiatePattern('valley-long').encounters[2].h,36);
});

test('new long and high encounters still require two taps at both speeds',()=>{
 for(const p of PATTERNS)for(const o of instantiatePattern(p.id).encounters)for(const {speed} of Object.values(MODES)) {
  if(o.kind==='high')assert(o.h-10>SINGLE_JUMP_APEX,p.id);
  if(o.kind==='long') {
   const height=o.h-10;
   const ascent=(JUMP_SPEED-Math.sqrt(JUMP_SPEED**2-2*RISE_GRAVITY*height))/RISE_GRAVITY;
   const timeAbove=JUMP_SPEED/RISE_GRAVITY+Math.sqrt(2*(SINGLE_JUMP_APEX-height)/FALL_GRAVITY)-ascent;
   assert(o.duration+12/speed>timeAbove,p.id);
  }
 }
});

test('every new jump accepts dense 80–250ms cue responses at both speeds and every render phase',()=>{
 let trials=0;
 for(const id of varied)for(const [index,encounter] of instantiatePattern(id).encounters.entries()) {
  if(!encounter.taps)continue;
  for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(let phase=0;phase<120/hz;phase++)
   for(let r1=80;r1<=250;r1+=10)for(let r2=80;r2<=(encounter.taps===2?250:80);r2+=10) {
    const g=fixture([id],mode),o=g.course.encounters[index];
    g.elapsed=o.encounterAt-.85+phase/120;g.y=floorAt(g.elapsed,g);g.floorHeight=g.y;
    // Preserve the complete authored chunk for the independent reward planner.
    g.course.encounters=[o];g.courseIndex=o.index;
    // End before the next independent cue, while retaining the real landing.
    const until=Math.min(o.encounterAt+1.25,encounter.encounterAt===4.65?5.2:1000);
    const label=`${id}/${index}/${mode}/${hz}/phase${phase}/${r1}/${r2}`;
    play(g,{hz,r1:r1/1000,r2:r2/1000,until,label});
    assert(g.grounded,label);assert.equal(g.cleared,1,label);trials++;
   }
 }
 assert.equal(trials,15372);
});

test('all ordered pattern pairs keep half a second of landing runway and reachable exit potions',()=>{
 let trials=0,minRunway=Infinity;
 const responses=[[.08,.08],[.08,.25],[.15,.15],[.25,.08],[.25,.25]];
 for(const a of PATTERNS)for(const b of PATTERNS)for(const mode of Object.keys(MODES))for(const hz of [30,60,120])
  for(const [r1,r2] of responses) {
   const g=fixture([a.id,b.id],mode),label=`${a.id}→${b.id}/${mode}/${hz}/${r1}/${r2}`;
   const result=play(g,{hz,r1,r2,until:12,label});
   assert(result.minRunway>.5,`${label}: ${result.minRunway}s runway`);
   assert(g.grounded,label);assert.equal(g.y,0,label);assert.equal(g.potions,2,label);
   assert.equal(g.cleared,a.encounters.length+b.encounters.length,label);
   minRunway=Math.min(minRunway,result.minRunway);trials++;
  }
 assert.equal(trials,PATTERNS.length**2*Object.keys(MODES).length*3*responses.length);assert(minRunway>.5);
});
