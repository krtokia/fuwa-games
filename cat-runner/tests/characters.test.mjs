import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_IDS, CHARACTERS, getCharacter, movementFrame, characterAtlases, atlasFrame, atlasAnchor } from '../characters.mjs';
import { reactionPose, runnerPose } from '../animation.mjs';
import { createGame, HIT_REACTION_SECONDS } from '../engine.mjs';

test('only known saved character IDs are accepted, with safe Fuwa fallback',()=>{
  assert.deepEqual(CHARACTER_IDS,['fuwa','shuri','nabi']);
  for(const id of CHARACTER_IDS)assert.equal(getCharacter(id),CHARACTERS[id]);
  for(const id of [null,undefined,42,{},['nabi'],'NABI','toString','__proto__','missing'])assert.equal(getCharacter(id),CHARACTERS.fuwa);
});
test('character configuration contains presentation only and cannot change the game rules',()=>{
  const forbidden=['speed','mode','hitbox','width','collisionPenaltySeconds','remainingTime','jumpSpeed'];
  for(const character of Object.values(CHARACTERS)) {
    for(const field of forbidden)assert(!Object.hasOwn(character,field));
    assert(character.name&&character.subject&&character.description);
  }
  assert.equal(HIT_REACTION_SECONDS,.85);
});
test('new movement atlases map six runs, ascent, descent, two boosts and two landings',()=>{
  for(let i=0;i<8;i++)assert.equal(movementFrame({texture:'motion',frame:i}),i);
  for(let i=0;i<4;i++)assert.equal(movementFrame({texture:'jump-land',frame:i}),i+8);
  const game=createGame();game.status='running';
  const states=[runnerPose(game,0),runnerPose({...game,grounded:false,vy:100},1),runnerPose({...game,grounded:false,vy:-100},1)];
  assert.deepEqual(states.map(movementFrame),[0,6,7]);
  for(const id of ['shuri','nabi']) {
    assert.equal(CHARACTERS[id].movement.count,12);assert.equal(CHARACTERS[id].reaction.atlas.count,4);
    assert.equal(CHARACTERS[id].movement.columns*CHARACTERS[id].movement.rows,12);
  }
});
test('atlas registration supports non-square and odd-sized sheets without overlapping boundaries',()=>{
  const atlas={columns:4,rows:3,anchor:[.48,.81]},frames=Array.from({length:12},(_,i)=>atlasFrame(atlas,i,1449,1087));
  for(let row=0;row<3;row++)for(let column=0;column<3;column++)assert.equal(frames[row*4+column].x+frames[row*4+column].width,frames[row*4+column+1].x);
  assert.equal(frames[11].x+frames[11].width,1449);assert.equal(frames[11].y+frames[11].height,1087);
  assert.deepEqual(atlasAnchor(atlas,2),[.48,.81]);
  assert.deepEqual(atlasAnchor({...atlas,anchors:[[.4,.7]]},0),[.4,.7]);
  assert.deepEqual(atlasFrame({...atlas,crops:[[4,5,80,91]]},0,1449,1087),{x:4,y:5,width:80,height:91});
});
test('all four actual reaction poses appear within the same reaction clock',()=>{
  for(const id of ['shuri','nabi']) {
    const seen=new Set();for(let t=0;t<HIT_REACTION_SECONDS;t+=1/120)seen.add(reactionPose(CHARACTERS[id],t).frame);
    assert.deepEqual([...seen],[0,1,2,3]);
  }
  assert.equal(CHARACTERS.shuri.reaction.kind,'tumble');assert.equal(CHARACTERS.nabi.reaction.kind,'punch');
  assert.equal(CHARACTERS.fuwa.reaction.kind,'hiss');
});
test('reduced motion keeps the real poses without artificial translation or scaling',()=>{
  for(const id of CHARACTER_IDS)for(const age of [0,.15,.3,.6,.84]) {
    const pose=reactionPose(CHARACTERS[id],age,{reducedMotion:true});
    assert.equal(pose.offsetX,0);assert.equal(pose.offsetY,0);assert.equal(pose.stretchX,1);assert.equal(pose.stretchY,1);assert.equal(pose.angle,0);
    assert.deepEqual(pose,reactionPose(CHARACTERS[id],age,{reducedMotion:true}));
  }
});
test('tumble is bounded cosmetic motion and punch is always one front-facing reaction',()=>{
  for(let age=0;age<=.85;age+=.01) {
    const roll=reactionPose(CHARACTERS.shuri,age),punch=reactionPose(CHARACTERS.nabi,age);
    assert(roll.offsetX>=0&&roll.offsetX<=15);assert(roll.offsetY>=-7&&roll.offsetY<=0);
    assert.equal(punch.offsetX,0);assert.equal(punch.offsetY,0);assert.equal(punch.angle,0);
  }
  assert.equal(reactionPose(CHARACTERS.shuri,.84).frame,3);
  assert.equal(reactionPose(CHARACTERS.nabi,.84).frame,3);
  for(const id of ['shuri','nabi'])for(const text of Object.values(CHARACTERS[id].reaction).filter(v=>typeof v==='string'))assert(!/후와|하악|hiss|bite/.test(text));
});
test('only four local transparent atlas paths are added, with distinct texture keys',()=>{
  const atlases=characterAtlases();assert.equal(atlases.length,4);
  assert.equal(new Set(atlases.map(a=>a.key)).size,4);
  assert(atlases.every(a=>a.path.startsWith('./assets/')&&a.path.endsWith('.png')));
});
