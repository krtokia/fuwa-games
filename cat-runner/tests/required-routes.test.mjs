import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUIRED_PATTERNS} from '../required-patterns.mjs';
import {PATTERNS,instantiatePattern} from '../course.mjs';
import {createGame,jump,step,MODES,SINGLE_JUMP_SECONDS} from '../engine.mjs';

function fixture(id,mode){
 const g=createGame(mode,720),chunk=instantiatePattern(id);
 chunk.encounters.forEach((e,index)=>e.index=index);
 chunk.pickups.forEach((p,index)=>p.index=index);
 chunk.end=1000;chunk.terrain[0].start=-10;chunk.terrain.at(-1).end=1000;
 Object.assign(g.course,{chunks:[chunk],terrain:chunk.terrain,platforms:chunk.platforms,
  terrainEdges:[...new Set(chunk.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b),
  encounters:chunk.encounters,pickups:chunk.pickups,generatedUntil:1000});
 g.status='running';return {g,chunk};
}
function simulate(pattern,{mode='normal',hz=60,offset=0,omit=[],noPlatforms=false,skipAll=false}={}){
 const {g,chunk}=fixture(pattern.id,mode);
 if(noPlatforms){chunk.platforms=[];g.course.platforms=[];}
 const inputs=skipAll?[]:pattern.routeInputs.map(([at,ordinal],index)=>({at:at+offset,ordinal,index})).filter(t=>!omit.includes(t.index));
 let next=0;const rejected=[],landings=[],collected=new Set(),cleared=[];
 while(g.elapsed<chunk.potionSlot[0]&&!g.hitCount){
  if(next<inputs.length&&g.elapsed+1e-9>=inputs[next].at){
   const input=inputs[next++];
   if(!jump(g))rejected.push(input.index);
   else if(omit.length===0&&!noPlatforms)assert.equal(g.jumpCount,input.ordinal,`${pattern.id}: authored ordinal at ${g.elapsed}`);
  }
  step(g,1/hz);
  for(const e of g.events){
   if(e.type==='land')landings.push({at:e.at,height:e.height});
   if(e.type==='snack'&&e.route==='required')collected.add(e.sampleAt);
   if(e.type==='clear')cleared.push(g.obstacles.find(o=>o.id===e.id)?.encounterAt);
  }
 }
 return {g,chunk,rejected,landings,collected,cleared,next,inputs};
}

test('mandatory-route definitions provide genuine floor transfers across an unbridgeable baseline gap',()=>{
 assert.equal(REQUIRED_PATTERNS.length,4);
 for(const p of REQUIRED_PATTERNS){
  assert(PATTERNS.some(q=>q.id===p.id&&q.requiredRoute),p.id);
  const gap=p.terrain[1][0]-p.terrain[0][1];
  assert(gap>2*SINGLE_JUMP_SECONDS,p.id+' cannot simply clear the whole gap from baseline');
  assert(p.platforms.some(s=>s[2]===96));
  assert.deepEqual(p.routePlan.taps,p.routeInputs.map(t=>t[0]));
  assert(p.routePickups.filter(r=>r[0]<1.5&&r[1]===null&&r[2]==='fish').length>=2,p.id+' needs early climb breadcrumbs');
  assert.equal(p.routeInputs[0][1],1);assert(p.routeInputs.filter(t=>t[1]===1).length>=3);
 }
});
for(const pattern of REQUIRED_PATTERNS)test(`${pattern.id}: mandatory landings, rewards and safe exit survive both speeds, three frame rates and ±40ms`,()=>{
 for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const offset of [-.04,0,.04]){
  const {g,chunk,rejected,landings,collected,cleared,next,inputs}=simulate(pattern,{mode,hz,offset});
  const label=`${pattern.id}/${mode}/${hz}/${offset}`;
  assert.equal(g.hitCount,0,label);assert.deepEqual(rejected,[],label);assert.equal(next,inputs.length,label);
  let landingIndex=0;
  for(const requiredFloor of pattern.routePlan.floors){
   const at=landings.findIndex((l,i)=>i>=landingIndex&&l.height===requiredFloor);
   assert(at>=0,`${label}: required landing ${requiredFloor} after ${landingIndex}`);landingIndex=at+1;
  }
  for(const pickup of chunk.pickups)assert(collected.has(pickup.encounterAt),`${label}: missed required reward ${pickup.encounterAt}`);
  for(const obstacle of chunk.encounters.filter(o=>o.kind!=='gap'))assert(cleared.includes(obstacle.encounterAt),`${label}: failed to clear actual upper hazard`);
  assert(g.grounded,label);assert.equal(g.y,0,label);
  const exit=landings.at(-1);assert(exit.height===0&&exit.at<chunk.potionSlot[0],label+' must return before earliest potion');
 }
});
test('staying below or omitting the key transfer really fails, instead of bypassing mandatory floors',()=>{
 for(const p of REQUIRED_PATTERNS)for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const offset of [-.04,0,.04]){
  const label=`${p.id}/${mode}/${hz}/${offset}`;
  for(const scenario of [{skipAll:true},{omit:p.routePlan.skipTapIndices},{noPlatforms:true}]){
   const {g}=simulate(p,{mode,hz,offset,...scenario});
   assert(g.hitCount>0,`${label}: ${JSON.stringify(scenario)} wrongly bypassed the floor transfer`);
  }
 }
});
