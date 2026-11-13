import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,jump,MODES,FIXED_STEP,GROUND,CAT_X,flightAfter,terrainSegments,floorAt,supportingFloorAt,nextCue} from '../engine.mjs';

const deck=(height,start=-10,end=1000)=>({start,end,height,level:height===96?2:3,oneWay:true});
function fixture({mode='normal',terrain=[{start:-10,end:1000,height:0}],platforms=[deck(96),deck(192)],y=0,vy=0,grounded=true}={}) {
  const game=createGame(mode);
  const chunk={id:'layered-fixture',index:0,start:-10,end:1000,terrain,platforms,encounters:[],pickups:[]};
  Object.assign(game.course,{chunks:[chunk],terrain,platforms,terrainEdges:[...new Set(terrain.flatMap(s=>[s.start,s.end]))],
    encounters:[],pickups:[],generatedUntil:1000});
  Object.assign(game,{status:'running',y,vy,grounded,floorHeight:grounded?y:supportingFloorAt(0,{course:{terrain,platforms}},y)});
  return game;
}
function run(game,seconds,hz=120) {
  const events=[];
  for(let i=0;i<Math.round(seconds*hz);i++){step(game,1/hz);events.push(...game.events);}
  return events;
}
test('layered geometry contains simultaneous ground, second and third floors without changing floorAt',()=>{
  const g=fixture();
  assert.equal(floorAt(1,g),0);
  assert.equal(supportingFloorAt(1,g,90),0);
  assert.equal(supportingFloorAt(1,g,96),96);
  assert.equal(supportingFloorAt(1,g,300),192);
  for(const mode of Object.keys(MODES)){
    g.mode=mode;
    const segments=terrainSegments(g);
    assert.deepEqual(segments.map(s=>s.height),[0,96,192]);
    assert.deepEqual(segments.filter(s=>s.oneWay).map(s=>s.level),[2,3]);
    for(const s of segments){assert.equal(s.w,(s.end-s.start)*MODES[mode].speed);assert.equal(s.baseY,GROUND-s.height);}
  }
});
test('ascending through an underside is free, descending lands on the highest crossed deck',()=>{
  const up=fixture({y:90,vy:440,grounded:false});up.jumpCount=1;
  run(up,.1);assert(up.y>96);assert(up.vy>0);assert.equal(up.grounded,false);assert.equal(up.hitCount,0);
  run(up,.8);assert.equal(up.y,96);assert(up.grounded);assert.equal(up.jumpCount,0);
  const down=fixture({y:300,vy:-100,grounded:false});down.jumpCount=2;
  const events=run(down,.6);
  assert.equal(down.y,192);assert.equal(down.floorHeight,192);assert(down.grounded);assert.equal(down.jumpCount,0);
  assert.equal(events.filter(e=>e.type==='land').length,1);assert.equal(down.hitCount,0);
});
test('a deck starts above a running cat without snapping it up or behaving as a wall',()=>{
  const g=fixture({platforms:[deck(96,.137),deck(192,.137)]});
  run(g,.3);assert.equal(g.y,0);assert.equal(g.hitCount,0);assert(g.grounded);assert.equal(g.floorHeight,0);
});
test('deck walk-off splits at the exact edge and consumes the ground jump',()=>{
  const g=fixture({y:192,platforms:[deck(96),deck(192,-10,.137)]});
  g.elapsed=.13;
  step(g,FIXED_STEP);
  const expected=flightAfter(192,0,g.elapsed-.137);
  assert(Math.abs(g.y-expected.y)<1e-10);assert(Math.abs(g.vy-expected.vy)<1e-10);
  assert.equal(g.grounded,false);assert.equal(g.jumpCount,1);assert.equal(g.floorHeight,96);
  assert(jump(g));assert.equal(g.jumpCount,2);assert.equal(jump(g),false);
});
test('a drop from third floor catches second floor, including where ground is absent',()=>{
  for(const terrain of [[],[{start:-10,end:1000,height:0}]]){
    const g=fixture({terrain,y:192,platforms:[deck(96),deck(192,-10,.137)]});
    run(g,1);assert.equal(g.y,96);assert(g.grounded);assert.equal(g.hitCount,0);assert.equal(g.floorHeight,96);
    assert.equal(floorAt(g.elapsed,g),terrain.length?0:null);
  }
});
test('safe second and third floor traversal exists using two staged double jumps at both speeds and frame rates',()=>{
  const snapshots=[];
  for(const mode of Object.keys(MODES))for(const hz of [30,60,120]){
    const g=fixture({mode});assert(jump(g));run(g,.3,hz);assert(jump(g));run(g,1.2,hz);
    assert.equal(g.y,96);assert(g.grounded);assert.equal(g.jumpCount,0);
    assert(jump(g));run(g,.3,hz);assert(jump(g));run(g,1.2,hz);
    assert.equal(g.y,192);assert(g.grounded);assert.equal(g.floorHeight,192);assert.equal(g.hitCount,0);
    snapshots.push([g.elapsed,g.y,g.vy,g.jumpCount,g.remainingTime]);
  }
  for(const snapshot of snapshots)assert.deepEqual(snapshot,snapshots[0]);
});
test('a player on an upper deck safely crosses a raised solid face below it',()=>{
  const g=fixture({terrain:[{start:-10,end:.137,height:0},{start:.137,end:1000,height:48}],y:96});
  run(g,.3);assert.equal(g.y,96);assert.equal(g.hitCount,0);assert.equal(g.floorHeight,96);
});
test('upper obstacle uses explicit surface, is hidden from lower route cue and grants no free clear underneath',()=>{
  const g=fixture();
  g.course.encounters=[{index:0,chunkIndex:0,localIndex:0,encounterAt:.5,duration:.12,kind:'crate',h:30,taps:1,floorHeight:96}];
  step(g,FIXED_STEP);
  const obstacle=g.obstacles[0];
  assert.equal(obstacle.floorHeight,96);assert.equal(obstacle.baseY,GROUND-96);assert(obstacle.upperRoute);
  assert.equal(nextCue(g),null);
  g.y=96;g.floorHeight=96;assert.equal(nextCue(g),obstacle);
  g.y=192;g.floorHeight=192;assert.equal(nextCue(g),null);
  g.y=0;g.floorHeight=0;
  run(g,1);
  assert.equal(g.hitCount,0);assert.equal(g.cleared,0);assert.equal(g.streak,0);assert.equal(g.score,0);
});
test('a clean leap over an upper obstacle earns its clear on that route',()=>{
  const g=fixture({y:96});
  g.obstacles=[{id:900,x:CAT_X+90,w:36,h:30,kind:'crate',floorHeight:96,baseY:GROUND-96,upperRoute:true,routeVisited:false,hit:false,cleared:false}];
  g.y=160;g.grounded=false;g.vy=120;g.jumpCount=1;
  run(g,.3);
  assert.equal(g.hitCount,0);assert.equal(g.cleared,1);assert.equal(g.streak,1);assert.equal(g.score,20);
});
test('falling below a 2+3-only section rescues onto an actual nearby deck only once',()=>{
  const g=fixture({terrain:[],y:-159,vy:-180,grounded:false});
  step(g,FIXED_STEP);
  assert.equal(g.hitCount,1);assert.equal(g.y,96);assert.equal(g.floorHeight,96);assert(g.reactionRemaining>0);
  assert(g.events.some(e=>e.type==='recover'&&e.reason==='fall'));
});
