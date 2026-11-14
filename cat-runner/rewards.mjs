// Collectibles describe paths through the existing physics, not independent
// obstacle-relative decorations. Time coordinates keep both running speeds fair.
import { JUMP_SPEED, SECOND_JUMP_SPEED, flightAfter, landingAfter } from './physics.mjs';
export const REWARD_RESPONSE_SECONDS = .15;
export const COLLECTION_CENTER_HEIGHT = 32.5;
export const BONUS_SECOND_CUE_SECONDS = .35;
const rewardPlans=new WeakMap();
const rewardFloorAt=(terrain,time)=>terrain.find(s=>time>=s.start&&time<s.end)?.height??null;

// Only roomy, flat, low-box lanes offer the voluntary second-tap detour.
// It begins after the main fish are already within collection reach.
export function bonusRouteFor(encounter) {
  return encounter?.bonusRoute===true&&encounter.kind==='crate'&&encounter.taps===1
    ? { bonusRoute:true, bonusSecondCue:encounter.bonusSecondCue??BONUS_SECOND_CUE_SECONDS } : null;
}
export function nominalRouteInputs(chunk,{bonus=false}={}) {
  if(chunk.requiredRoute)return chunk.routeInputs.map(({at,ordinal})=>({at,velocity:ordinal===2?SECOND_JUMP_SPEED:JUMP_SPEED}));
  return chunk.encounters.flatMap(o=>{
    if(!o.taps||o.optionalRoute)return [];
    const first=o.encounterAt-(o.cueLead??.5)+REWARD_RESPONSE_SECONDS;
    const result=[{at:first,velocity:JUMP_SPEED,sourceEncounterAt:o.encounterAt}];
    if(o.taps===2 || bonus&&bonusRouteFor(o)) result.push({
      at:first+(o.taps===2?(o.secondCue??.18):bonusRouteFor(o).bonusSecondCue)+REWARD_RESPONSE_SECONDS,
      velocity:SECOND_JUMP_SPEED,sourceEncounterAt:o.encounterAt});
    return result;
  }).sort((a,b)=>a.at-b.at);
}

// Piecewise ballistic trajectory, split at exact terrain boundaries and taps.
// Landing uses the same primitive as the live engine, including raised/lower
// floors. This planner neither runs the timer nor changes the real cat state.
export function sampleRewardTrajectory(chunk,times,{bonus=false,inputs=nominalRouteInputs(chunk,{bonus})}={}) {
  const surfaces=[...chunk.terrain,...(chunk.platforms??[])];
  const edges=[...new Set(surfaces.flatMap(s=>[s.start,s.end]))];
  const requested=times.map((at,index)=>({at,index})).sort((a,b)=>a.at-b.at);
  const samples=Array(times.length);
  let at=chunk.start,y=rewardFloorAt(chunk.terrain,chunk.start)??0,vy=0,grounded=true,inputIndex=0;
  function advance(end) {
    const boundaries=edges.filter(edge=>edge>at&&edge<=end).sort((a,b)=>a-b);
    for(const next of [...boundaries,...(boundaries.at(-1)===end?[]:[end])]) {
      const floor=rewardFloorAt(chunk.terrain,(at+next)/2),duration=next-at;
      const supports=surfaces.filter(s=>(at+next)/2>=s.start&&(at+next)/2<s.end);
      if(!(grounded&&supports.some(s=>s.height===y)&&vy<=0)) {
        grounded=false;
        const landing=supports.map(s=>({height:s.height,t:landingAfter(y,vy,s.height)})).filter(s=>s.t>=0&&s.t<=duration+1e-10).sort((a,b)=>a.t-b.t||b.height-a.height)[0];
        if(landing){y=landing.height;vy=0;grounded=true;}
        else ({y,vy}=flightAfter(y,vy,duration));
      }
      const nextFloor=rewardFloorAt(chunk.terrain,next);
      if(nextFloor!==null&&nextFloor>(floor??-Infinity)&&y<nextFloor-1e-7)
        throw new RangeError(`Reward route meets a wall in ${chunk.id} at ${next}`);
      if(grounded&&!surfaces.some(s=>next>=s.start&&next<s.end&&s.height===y))grounded=false;
      at=next;
    }
  }
  for(const target of requested) {
    while(inputIndex<inputs.length&&inputs[inputIndex].at<=target.at) {
      const input=inputs[inputIndex++];advance(input.at);vy=input.velocity;grounded=false;
    }
    advance(target.at);
    samples[target.index]={at:target.at,y,vy,grounded,height:y+COLLECTION_CENTER_HEIGHT};
  }
  return samples;
}

function planChunkRewards(chunk) {
  if(rewardPlans.has(chunk))return rewardPlans.get(chunk);
  const descriptors=[];
  for(const encounter of chunk.encounters) {
    if(encounter.optionalRoute)continue;
    const {encounterAt,taps}=encounter,first=encounterAt-(encounter.cueLead??.5)+REWARD_RESPONSE_SECONDS;
    const second=first+(encounter.secondCue??.18)+REWARD_RESPONSE_SECONDS;
    const times=taps===0?[encounterAt-.1,encounterAt+.12,encounterAt+.34]
      :taps===1?[first+.1,first+.32,first+(bonusRouteFor(encounter) ? .5 : .56)]
      :[first+.14,second+.16,second+.42,second+.7];
    const routeId=`${chunk.index}:${encounter.localIndex}:main`;
    times.forEach((sampleAt,i)=>descriptors.push({sampleAt,sourceEncounterAt:encounterAt,
      kind:taps===2&&i===2?'star':'fish',value:taps===2&&i===2?50:10,
      route:'main',optional:false,routeId,routeOrder:i,
      patternId:chunk.id,chunkIndex:chunk.index,localIndex:encounter.localIndex}));
    const bonus=bonusRouteFor(encounter);
    if(bonus) {
      const boost=first+bonus.bonusSecondCue+REWARD_RESPONSE_SECONDS;
      [boost+.24,boost+.48].forEach((sampleAt,i)=>descriptors.push({
        sampleAt,sourceEncounterAt:encounterAt,kind:'star',value:50,
        route:'bonus',optional:true,routeId:`${chunk.index}:${encounter.localIndex}:bonus`,routeOrder:i,
        patternId:chunk.id,chunkIndex:chunk.index,localIndex:encounter.localIndex}));
    }
  }
  for(const bonus of [false,true]) {
    const branch=descriptors.filter(d=>d.optional===bonus);
    const samples=sampleRewardTrajectory(chunk,branch.map(d=>d.sampleAt),{bonus});
    branch.forEach((d,i)=>d.height=samples[i].height);
  }
  rewardPlans.set(chunk,descriptors);
  return descriptors;
}
export function rewardsForEncounter(chunk,encounter) {
  if(!chunk)return [];
  return planChunkRewards(chunk).filter(d=>d.localIndex===encounter.localIndex);
}
export function restReward(chunk,pickup) {
  // Authored upper paths use absolute world heights, never a ground-path
  // projection that would place their rewards inside a roof or down below.
  if(Number.isFinite(pickup.absoluteHeight)) return {
    ...pickup,sampleAt:pickup.encounterAt,height:pickup.absoluteHeight,
    route:pickup.route??'upper',optional:pickup.optional??true,routeId:`${pickup.chunkIndex}:level${pickup.level??2}`,
    routeOrder:pickup.index??0,sourceEncounterAt:pickup.encounterAt,
  };
  if(!chunk)return {...pickup,sampleAt:pickup.encounterAt,route:'main',optional:false};
  // Skip a redundant rest fish if a late downhill path already fills that slot.
  if(pickup.kind==='fish'&&planChunkRewards(chunk).some(r=>Math.abs(r.sampleAt-pickup.encounterAt)<.24))return null;
  const [sample]=sampleRewardTrajectory(chunk,[pickup.encounterAt]);
  return {sampleAt:pickup.encounterAt,height:sample.height,route:'main',optional:false,
    routeId:`${chunk.index}:exit`,routeOrder:0,sourceEncounterAt:pickup.encounterAt,
    ...(chunk.requiredRoute&&pickup.kind!=='potion'?{route:'required'}:{})};
}
