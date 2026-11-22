import test from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS,instantiatePattern,createCourse,ensureCourse} from '../course.mjs';
import {createGame,step,jump,MODES} from '../engine.mjs';
const layered=PATTERNS.filter(p=>p.platforms.length&&!p.challenge);

function fixture(id,mode,width=720){
 const g=createGame(mode,width),c=instantiatePattern(id);
 c.encounters.forEach((e,i)=>e.index=i);
 c.pickups.forEach((p,i)=>p.index=i);
 c.end=1000;c.terrain[0].start=-10;c.terrain.at(-1).end=1000;
 Object.assign(g.course,{chunks:[c],terrain:c.terrain,platforms:c.platforms,
  terrainEdges:[...new Set(c.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b),
  encounters:c.encounters,pickups:c.pickups,generatedUntil:1000});
 g.status='running';return g;
}

test('seven authored upper routes contain genuine overlapping floors and safe baseline exits',()=>{
 assert.equal(layered.length,7);
 let triple=false,upperOnly=false;
 for(const p of layered){
  const c=instantiatePattern(p.id,12,2);
  assert(c.platforms.some(s=>s.level===2));assert(c.platforms.some(s=>s.level===3));
  for(const s of c.platforms){assert.equal(s.oneWay,true);assert.equal(s.height,s.level===2?96:192);assert(s.end-s.start>=.6);assert(s.start>=12.9);assert(s.end<=16.5);}
  for(let t=12;t<18;t+=.01){
   const floors=c.platforms.filter(s=>s.start<=t&&t<s.end);
   const ground=c.terrain.some(s=>s.start<=t&&t<s.end);
   if(floors.some(s=>s.level===2)&&floors.some(s=>s.level===3)){triple ||= ground;upperOnly ||= !ground;}
  }
  assert(c.pickups.every(p=>p.optional&&p.route==='upper'&&Number.isFinite(p.absoluteHeight)));
  assert(c.pickups.every(p=>c.platforms.some(s=>s.start<=p.encounterAt&&p.encounterAt<s.end&&Math.abs(p.absoluteHeight-s.height-32.5)<1e-9)));
  assert(c.terrain.some(s=>s.height===0&&s.start<=17.05&&s.end>=17.65));
 }
 assert(triple,'1+2+3 must overlap');assert(upperOnly,'2+3 must overlap above absent ground');
});

test('the first post-intro chunk always introduces a seeded upper route without maximum difficulty',()=>{
 const seen=new Set();
 for(let seed=0;seed<256;seed++){
  const c=createCourse(seed);ensureCourse(c,12);
  assert.equal(c.chunks[0].id,'welcome');assert(c.chunks[1].platforms.length>0);assert(c.chunks[1].difficulty<=2);seen.add(c.chunks[1].id);
 }
 assert(seen.size>=4);
});

test('layer platforms and sorted pickup indices are batch-invariant and bounded while streaming',()=>{
 for(const seed of [0,1,17,0x1234abcd,0xffffffff]){
  const a=createCourse(seed),b=createCourse(seed);ensureCourse(a,180);
  for(let t=.25;t<=180;t+=.25)ensureCourse(b,t);
  assert.deepEqual(a,b);
  assert.deepEqual(a.platforms,a.chunks.flatMap(c=>c.platforms));
  for(let i=1;i<a.pickups.length;i++){assert(a.pickups[i].encounterAt>=a.pickups[i-1].encounterAt);assert.equal(a.pickups[i].index,a.pickups[i-1].index+1);}
 }
 const c=createCourse(73),maxPlatforms=Math.max(...PATTERNS.map(p=>p.platforms.length)),maxPickups=2+Math.max(...PATTERNS.map(p=>p.routePickups.length));
 for(let t=0;t<=3600;t+=3){ensureCourse(c,t+12,t-3);assert(c.chunks.length<=4);assert(c.platforms.length<=4*maxPlatforms);assert(c.pickups.length<=4*maxPickups);}
});

test('every upper route reaches floors 2 and 3 and returns before potions at both speeds and 30/60/120Hz',()=>{
 let trials=0;
 for(const p of layered)for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const offset of [-.04,0,.04]){
  const g=fixture(p.id,mode),times=[.7,1.03,2.1,2.43,...(p.id==='split-rooftops'?[3.28]:[])].map(t=>t+offset);
  let i=0;const floors=new Set(),upperCollected=new Set();
  while(g.elapsed<5.35){
   if(i<times.length&&g.elapsed+1e-9>=times[i]){assert(jump(g),`${p.id}/${mode}/${hz}/${offset}: tap ${i}@${g.elapsed}`);i++;}
   step(g,1/hz);
   assert.equal(g.hitCount,0,`${p.id}/${mode}/${hz}/${offset}: collision@${g.elapsed}`);
   if(g.grounded)floors.add(g.y);
   for(const event of g.events)if(event.type==='snack'&&event.route==='upper')upperCollected.add(event.sampleAt);
  }
  assert(floors.has(96),p.id+' floor2');assert(floors.has(192),p.id+' floor3');
  assert(g.grounded,p.id+' safe exit');assert.equal(g.y,0,p.id+' baseline exit');
  assert.equal(upperCollected.size,3,`${p.id}/${mode}/${hz}/${offset}: upper route rewards`);
  trials++;
 }
 assert.equal(trials,126);
});
