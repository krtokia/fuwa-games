import {driveRequired} from './route-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,jump,MODES,FIXED_STEP,jumpCueSeconds,secondJumpCueSeconds} from '../engine.mjs';
import {PATTERNS,instantiatePattern} from '../course.mjs';
import {bonusRouteFor,rewardsForEncounter,restReward,sampleRewardTrajectory,nominalRouteInputs,REWARD_RESPONSE_SECONDS,COLLECTION_CENTER_HEIGHT} from '../rewards.mjs';

const rewardKey=r=>`${r.routeId}:${r.sampleAt}`;
function fixture(id,mode='normal',width=720) {
 const game=createGame(mode,width),chunk=instantiatePattern(id);
 chunk.end=1000;chunk.terrain.at(-1).end=1000;
 chunk.encounters.forEach((o,index)=>o.index=index);
 // Keep this real authored chunk in view without generating a successor.
 Object.assign(game.course,{chunks:[chunk],terrain:chunk.terrain,platforms:chunk.platforms??[],
  terrainEdges:[...new Set(chunk.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b),
  encounters:chunk.encounters,pickups:[],generatedUntil:1000});
 game.status='running';return game;
}
function playRoute(game,{hz=120,bonus=false,until=6,response=.15,secondResponse=.15,extend=false,requireAll=true}={}) {
 const inputs=new Map(),expected=new Map(),collected=new Set(),plannedChunks=new Set();let maxTreats=0;
 while(game.status==='running'&&game.elapsed<until-1e-8) {
  for(const chunk of game.course.chunks) {
   if(plannedChunks.has(chunk.index))continue;plannedChunks.add(chunk.index);
   for(const encounter of chunk.encounters)for(const reward of rewardsForEncounter(chunk,encounter))
    if(!reward.optional||bonus)expected.set(rewardKey(reward),reward);
   for(const pickup of chunk.pickups??[]) {
    const reward=restReward(chunk,pickup);
    if(reward&&!reward.optional&&pickup.kind!=='potion')expected.set(rewardKey(reward),reward);
   }
  }
  driveRequired(game,inputs);
  for(const encounter of game.course.encounters) {
   if(encounter.optionalRoute||!encounter.taps||encounter.encounterAt<game.elapsed-2)continue;
   let input=inputs.get(encounter.index);
   if(!input&&encounter.encounterAt-game.elapsed<jumpCueSeconds(game.mode,encounter)) {
    input={firstAt:game.elapsed+response,pressedAt:null,secondAt:null,secondCue:false};inputs.set(encounter.index,input);
   }
   if(!input)continue;
   if(input.firstAt!==null&&game.elapsed>=input.firstAt) {
    assert(jump(game),`rejected first press at ${game.elapsed}`);input.pressedAt=game.elapsed;input.firstAt=null;
   }
   const optional=bonus&&bonusRouteFor(encounter);
   if((encounter.taps===2||optional)&&input.pressedAt!==null&&!input.secondCue&&
     game.elapsed-input.pressedAt>=(optional?.bonusSecondCue??secondJumpCueSeconds(game.mode,encounter))) {
    input.secondCue=true;input.secondAt=game.elapsed+secondResponse;
   }
   if(input.secondAt!==null&&game.elapsed>=input.secondAt) {
    assert(jump(game),`rejected second press at ${game.elapsed}`);input.secondAt=null;
   }
  }
  if(extend)game.remainingTime=30;
  step(game,1/hz);
  assert.equal(game.hitCount,0,`${game.mode}/${hz}/${bonus}: hit at ${game.elapsed}`);
  maxTreats=Math.max(maxTreats,game.treats.length);
  for(const event of game.events)if(event.type==='snack')collected.add(rewardKey(event));
 }
 // Only demand centers the cat actually passed; a timeout cannot collect future
 // visible rewards. Complete each route in one run, never teleport per pickup.
 for(const [key,reward] of expected)if(requireAll&&reward.sampleAt<game.elapsed-1e-8)
  assert(collected.has(key),`missed ${key} ${reward.patternId}/${game.mode}/${hz}/bonus:${bonus}`);
 return {expected,collected,maxTreats};
}

test('all authored pickup trails are jointly collected with150ms cue responses at both speeds and30/60/120Hz',()=>{
 let trials=0;
 for(const pattern of PATTERNS.filter(p=>!p.requiredRoute))for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const bonus of [false,true]) {
  const game=fixture(pattern.id,mode),result=playRoute(game,{hz,bonus});
  const rewards=game.course.encounters.flatMap(o=>rewardsForEncounter(game.course.chunks[0],o));
  assert(rewards.length>=3);assert.equal(result.collected.size,rewards.filter(r=>!r.optional||bonus).length,
   `${pattern.id}/${mode}/${hz}/bonus:${bonus}: no unintended alternative pickups`);
  assert(game.grounded);trials++;
 }
 assert.equal(trials,PATTERNS.filter(p=>!p.requiredRoute).length*12);
});

test('fast80ms optional taps preserve all six shared low-lane fish and all four bonus stars',()=>{
 for(const mode of Object.keys(MODES))for(const hz of [30,60,120]) {
  const game=fixture('low-lane',mode);
  playRoute(game,{hz,bonus:true,response:.08,secondResponse:.08});
  assert.equal(game.snacks,10);assert.equal(game.stars,4);
 }
});

test('seeded full routes collect every main trail and each chosen optional branch without conflicting inputs',()=>{
 for(const seed of [0,1,2,3,7,17,42,101,0x1234abcd,0xffffffff])for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const bonus of [false,true]) {
  const game=createGame(mode,seed%2?640:1200,{seed});game.status='running';
  playRoute(game,{hz,bonus,until:90,extend:true});
  assert(game.grounded);
 }
});

test('fish and stars use the actual collection center on one terrain-aware trajectory per branch',()=>{
 assert.equal(REWARD_RESPONSE_SECONDS,.15);assert.equal(COLLECTION_CENTER_HEIGHT,32.5);
 for(const pattern of PATTERNS) {
  const chunk=instantiatePattern(pattern.id),before=structuredClone(chunk);
  const rewards=chunk.encounters.flatMap(o=>rewardsForEncounter(chunk,o));
  for(const bonus of [false,true]) {
   const branch=rewards.filter(r=>r.optional===bonus),samples=sampleRewardTrajectory(chunk,branch.map(r=>r.sampleAt),{bonus});
   branch.forEach((reward,i)=>{
    assert.equal(reward.height,samples[i].y+32.5);assert.equal(reward.optional,reward.route==='bonus');
    assert(Number.isFinite(reward.height));assert(reward.sampleAt>=chunk.start&&reward.sampleAt<chunk.end);
   });
  }
  assert.deepEqual(chunk,before,'placement must not change terrain, timing or source encounters');
 }
});

test('pickup artwork stays outside solid obstacles and terrain at both speeds',()=>{
 for(const pattern of PATTERNS)for(const {speed} of Object.values(MODES)) {
  const chunk=instantiatePattern(pattern.id),rewards=chunk.encounters.flatMap(o=>rewardsForEncounter(chunk,o));
  for(const reward of rewards) {
   // Fish displays ~35×26; stars ~41×41. Use a conservative21px radius.
   const radius=reward.kind==='star'?21:18,left=reward.sampleAt-(radius+3.5)/speed,right=reward.sampleAt+(radius-3.5)/speed;
   for(const terrain of chunk.terrain)if(left<terrain.end&&right>terrain.start)
    assert(reward.height-radius>terrain.height,`${pattern.id}/${reward.kind}: buried in terrain`);
   for(const obstacle of chunk.encounters.filter(o=>['crate','long','high'].includes(o.kind))) {
    if(left>=obstacle.encounterAt+obstacle.duration||right<=obstacle.encounterAt)continue;
    const floor=obstacle.floorHeight??chunk.terrain.find(t=>obstacle.encounterAt+.001>=t.start&&obstacle.encounterAt+.001<t.end)?.height??0;
    assert(reward.height+radius<floor||reward.height-radius>floor+obstacle.h,`${pattern.id}/${reward.kind}: inside ${obstacle.kind}`);
   }
  }
 }
});

test('optional high stars are clearly marked, skippable, and leave safe later mandatory jumps and potions',()=>{
 const chunk=instantiatePattern('low-lane');
 for(const encounter of chunk.encounters) {
  assert.equal(bonusRouteFor(encounter).bonusSecondCue,.35);
  const rewards=rewardsForEncounter(chunk,encounter),optional=rewards.filter(r=>r.optional);
  assert.equal(optional.length,2);assert(optional.every(r=>r.kind==='star'&&r.route==='bonus'));
  assert(optional.every(r=>r.height>150));
 }
 for(const mode of Object.keys(MODES))for(const hz of [30,60,120])for(const secondResponse of [.08,.15,.25]) {
  const game=fixture('low-lane',mode);playRoute(game,{hz,bonus:true,secondResponse,requireAll:secondResponse===.15});assert(game.grounded);
  assert(game.elapsed>=6-1e-8);
 }
 for(const pattern of PATTERNS) {
  const c=instantiatePattern(pattern.id);
  for(const at of c.potionSlot)for(const bonus of [false,true]) {
   const [sample]=sampleRewardTrajectory(c,[at],{bonus});
   assert(sample.grounded,`${pattern.id}: potion requires jumping`);assert.equal(sample.y,0);
  }
 }
});

test('nominal trajectory matches the unmodified live physics at every fixed step, including drops and raised landings',()=>{
 for(const pattern of PATTERNS)for(const bonus of [false,true]) {
  const game=fixture(pattern.id),chunk=game.course.chunks[0],inputs=nominalRouteInputs(chunk,{bonus});let index=0;
  const accepted=[];
  const times=[];const states=[];
  while(game.elapsed<5.99) {
   while(index<inputs.length&&game.elapsed>=inputs[index].at-1e-9){assert(jump(game));accepted.push({...inputs[index++],at:game.elapsed});}
   step(game,FIXED_STEP);assert.equal(game.hitCount,0);
   times.push(game.elapsed);states.push(game.y);
  }
  const samples=sampleRewardTrajectory(chunk,times,{bonus,inputs:accepted});
  samples.forEach((sample,i)=>assert(Math.abs(sample.y-states[i])<1e-8,`${pattern.id} at ${times[i]} diverged from real accepted inputs`));
 }
});
