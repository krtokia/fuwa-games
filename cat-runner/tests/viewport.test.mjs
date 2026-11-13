import test from 'node:test';
import assert from 'node:assert/strict';
import {worldViewport,MIN_WORLD_WIDTH,MAX_WORLD_SCALE} from '../viewport.mjs';
import {MODES,GROUND} from '../engine.mjs';
test('world camera has at least 1.3 seconds from the visible nose at every viewport',()=>{
 for(const width of [280,309,333,374,440,720,1000,1200])for(const height of [280,300,400]){
  const view=worldViewport(width,height);assert(view.width>=MIN_WORLD_WIDTH);
  assert(view.scale<=MAX_WORLD_SCALE);assert((view.width-235)/MODES.normal.speed>=1.3);
  assert(Math.abs((GROUND-view.scrollY)*view.scale-height*.82)<1);
 }
});
test('narrow world shrinks without changing touch-control CSS',()=>{
 const v=worldViewport(309,300);assert.equal(v.width,720);assert(v.scale>.42&&v.scale<.44);
 assert(174*v.scale>74&&174*v.scale<76);assert(v.height>690);
});
test('world aspect follows stage in portrait, landscape and resizing',()=>{
 for(const [w,h] of [[309,300],[720,360],[1000,400]]){const v=worldViewport(w,h);assert(Math.abs(v.width/v.height-w/h)<.01);}
 assert(Number.isFinite(worldViewport(0,0).scrollY));
});

test('upper floors keep character and reaction label within the camera safe area',async()=>{
 const {verticalCameraTop}=await import('../viewport.mjs');
 for(const h of [260,420,720])for(const y of [0,96,192,270,377]) {
  const top=verticalCameraTop(h,y);
  assert(338-y-top>=160-1e-6);
  assert(top<=338-h*.82);
 }
});
