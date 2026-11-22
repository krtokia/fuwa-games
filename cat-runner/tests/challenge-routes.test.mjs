import test from 'node:test';
import assert from 'node:assert/strict';
import {instantiatePattern} from '../course.mjs';
import {createGame,jump,step,MODES} from '../engine.mjs';

// Authored upper routes, using real physics and input quantized at render frames.
// Offsets model early/late decisions; these are not teleport-per-pickup checks.
const plans={
 'roof-guards':{taps:[.7,1.03,2.1,2.43,3.5],floors:[96,192],upperClears:1},
 'broken-roof-relay':{taps:[.7,1.03,2.1,2.43,3.25,3.6],floors:[96,192],upperClears:1},
 'balcony-hurdles':{taps:[.7,1.03,2,3.45,3.95],floors:[96],upperClears:2},
 'drop-and-rebound':{taps:[.7,1.03,2.1,2.43,4.3],floors:[96,192],upperClears:0},
};
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
for(const [id,plan] of Object.entries(plans))test(`${id}: upper route remains playable and rewarded across speeds, frame rates and ±40ms inputs`,()=>{
 for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const offset of [-.04,0,.04]){
  const {g,chunk}=fixture(id,mode),label=`${id}/${mode}/${hz}/${offset}`;
  const times=plan.taps.map(t=>t+offset),floors=new Set(),pickups=new Set(),clears=[];
  let input=0,upperClears=0,lastLanding=null;
  while(g.elapsed<chunk.potionSlot[0]){
   if(input<times.length&&g.elapsed+1e-9>=times[input]){
    assert(jump(g),`${label}: rejected tap ${input} at ${g.elapsed}`);input++;
   }
   step(g,1/hz);
   assert.equal(g.hitCount,0,`${label}: collision at ${g.elapsed}`);
   if(g.grounded)floors.add(g.y);
   for(const event of g.events){
    if(event.type==='land')lastLanding={at:event.at,height:event.height};
    if(event.type==='snack'&&event.route==='upper')pickups.add(event.sampleAt);
    if(event.type==='clear'){
     const obstacle=g.obstacles.find(o=>o.id===event.id);
     if(obstacle?.upperRoute)upperClears++;
     clears.push(obstacle?.encounterAt);
    }
   }
  }
  assert.equal(input,times.length,label);
  for(const height of plan.floors)assert(floors.has(height),`${label}: missing landing on ${height}`);
  assert.equal(pickups.size,chunk.pickups.length,`${label}: uncollectible upper route rewards`);
  assert(upperClears>=plan.upperClears,`${label}: upper obstacles must actually be cleared, not skipped below`);
  if(id==='roof-guards')assert(clears.includes(3.85),`${label}: third-floor obstacle must be jumped`);
  assert(g.grounded,label);assert.equal(g.y,0,`${label}: not back on baseline before potion`);
  assert(lastLanding?.height===0&&lastLanding.at<chunk.potionSlot[0],`${label}: unsafe potion exit`);
  if(id==='drop-and-rebound')assert(clears.includes(4.65),`${label}: must jump again after descending`);
 }
});
