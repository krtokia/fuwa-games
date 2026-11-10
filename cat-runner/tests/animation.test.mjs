import test from 'node:test';
import assert from 'node:assert/strict';
import { runnerPose, actionFloorLift, BOOST_POSE_SECONDS, LAND_POSE_SECONDS } from '../animation.mjs';
const g = overrides => ({ grounded:true, jumpCount:0, vy:0, mode:'normal', lastJumpAt:null, lastBoostAt:null, ...overrides });

test('first accepted press has an immediate airborne pose without a wind-up',()=>{
 const state=g({grounded:false,jumpCount:1,vy:440,lastJumpAt:2});
 const p=runnerPose(state,2);assert.equal(p.kind,'rise');assert.equal(p.frame,6);assert.equal(p.texture,'motion');
 assert(p.stretchY>1);assert(p.angle<0);
});
test('second jump has two real poses, then returns to the physical airborne state',()=>{
 const state=g({grounded:false,jumpCount:2,vy:500,lastJumpAt:2,lastBoostAt:2});
 const first=runnerPose(state,2),second=runnerPose(state,2.06),after=runnerPose(state,2+BOOST_POSE_SECONDS+.001);
 assert.equal(first.texture,'jump-land');assert.equal(first.frame,0);assert.equal(second.frame,1);assert.equal(second.kind,'boost');
 assert.equal(after.kind,'rise');assert.equal(after.frame,6);
 assert.equal(runnerPose({...state,vy:-250},2.3).kind,'fall');
});
test('landing shows contact then recovery, before a consistent run phase',()=>{
 const state=g();const options={landAt:5,landImpact:550};
 const first=runnerPose(state,5,options),second=runnerPose(state,5.08,options),run=runnerPose(state,5+LAND_POSE_SECONDS+.001,options);
 assert.equal(first.kind,'land');assert.equal(first.frame,2);assert(first.stretchY<1);
 assert.equal(second.frame,3);assert.equal(second.texture,'jump-land');
 assert.equal(run.kind,'run');assert.equal(run.frame,3);assert.equal(run.texture,'motion');
});
test('fresh jump interrupts landing immediately, without queued animation delay',()=>{
 const state=g({grounded:false,jumpCount:1,vy:440,lastJumpAt:5.02});
 assert.equal(runnerPose(state,5.02,{landAt:5,landImpact:550}).kind,'rise');
});
test('paused/frozen clock preserves every frame and transform exactly',()=>{
 for(const state of [g(),g({grounded:false,jumpCount:2,vy:400,lastJumpAt:2,lastBoostAt:2})]) {
  assert.deepEqual(runnerPose(state,2.08,{landAt:2}),runnerPose(state,2.08,{landAt:2}));
 }
});
test('reduced motion preserves actual state poses without decorative squash or tilt',()=>{
 for(const [state,time,landAt] of [[g({grounded:false,jumpCount:1,vy:440,lastJumpAt:2}),2,-1],[g({grounded:false,jumpCount:2,vy:500,lastBoostAt:2}),2.08,-1],[g(),2.03,2]]) {
  const p=runnerPose(state,time,{landAt,landImpact:600,reducedMotion:true});
  assert.equal(p.angle,0);assert.equal(p.stretchX,1);assert.equal(p.stretchY,1);assert.notEqual(p.kind,'run');
 }
});
test('negative-floor landings and both running speeds use the same safe pose sequence',()=>{
 for(const mode of ['normal','gentle'])for(const y of [-54,0,48]) {
  const p=runnerPose(g({mode,y}),10.03,{landAt:10,landImpact:300});assert.equal(p.kind,'land');
  for(const field of ['stretchX','stretchY','angle'])assert(Number.isFinite(p[field]));
 }
 assert.notEqual(runnerPose(g({mode:'normal'}),.3).frame,runnerPose(g({mode:'gentle'}),.3).frame);
});

test('release artwork cannot dip through an existing floor on a low second tap',()=>{
 const pose={kind:'boost',frame:1,stretchY:1.02};
 for(const floorHeight of [-54,0,48])for(const clearance of [0,20,28,90]){
  const state={floorHeight,y:floorHeight+clearance};const lift=actionFloorLift(pose,state);
  assert(clearance+lift>=28*pose.stretchY-1e-9||clearance>=28*pose.stretchY);assert(lift>=0&&lift<=29);
 }
 assert.equal(actionFloorLift(pose,{floorHeight:null,y:-20}),0);
 assert.equal(actionFloorLift({...pose,frame:0},{floorHeight:0,y:0}),0);
});
