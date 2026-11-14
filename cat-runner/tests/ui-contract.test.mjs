// Source/asset contracts, not a substitute for real browser and touch QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { CHARACTER_IDS, CHARACTERS, characterAtlases, atlasFrame, atlasAnchor } from '../characters.mjs';
import { STARTING_SECONDS, POTION_SECONDS, COLLISION_PENALTY_SECONDS } from '../engine.mjs';
const file=p=>new URL('../'+p,import.meta.url);
const html=readFileSync(file('index.html'),'utf8');
const game=readFileSync(file('game.mjs'),'utf8');
test('all UI targets referenced by the Phaser controller exist',()=>{
 const ids=[...game.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of ids)assert(html.includes(`id="${id}"`),id);
});
test('local Phaser runtime loads before game module',()=>{
 const runtime='./vendor/phaser-3.90.0.min.js';assert(html.includes(runtime));
 assert(html.indexOf(runtime)<html.indexOf('./game.mjs'));
 assert(!/<script[^>]+src="https?:/.test(html));
});
test('all static relative page assets exist',()=>{
 for(const [,path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert(existsSync(file(path)),path);
});
test('generated PNG is a full-size RGBA raster, not an SVG replacement',()=>{
 const data=readFileSync(file('assets/fuwa-generated.png'));
 assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),1536);assert.equal(data.readUInt32BE(20),1024);
 assert.equal(data[25],6);assert(/this\.load\.image\('fuwa',\s*'\.\/assets\/fuwa-generated\.png'\)/.test(game));assert(!game.includes('fuwa.svg'));
});
test('HTML explains the time budget and labels the remaining-time meter',()=>{
 assert.equal(STARTING_SECONDS,30);assert.equal(POTION_SECONDS,10);assert.equal(COLLISION_PENALTY_SECONDS,5);
 assert(html.includes(`aria-valuemax="${STARTING_SECONDS}"`));assert(html.includes(`aria-valuenow="${STARTING_SECONDS}"`));
 assert(html.includes(`aria-label="남은 시간"`));
 assert(html.includes(`${STARTING_SECONDS}초 시작 · 포션 +${POTION_SECONDS}초 · 충돌 -${COLLISION_PENALTY_SECONDS}초`));
 assert(game.includes('Math.ceil(game.remainingTime)'));
});
test('jump acts on pointer-down, tab loss pauses, responsive resize pauses',()=>{
 assert(game.includes("target.addEventListener('pointerdown',pointerPress)"));
 assert(game.includes("$('jump'), $('game-canvas')"));
 assert(game.includes("target.addEventListener('pointercancel',pointerRelease)"));
 assert(game.includes("document.addEventListener('keyup'"));
 assert(game.includes("window.addEventListener('blur',pause)"));assert(game.includes("document.addEventListener('visibilitychange'"));assert(game.includes('next.width!==view.width||next.height!==view.height){pause()'));
});
test('Phaser MIT license is retained',()=>{const license=readFileSync(file('vendor/PHASER-LICENSE.md'),'utf8');assert(license.includes('MIT'));assert(readFileSync(file('vendor/phaser-3.90.0.min.js')).length>1000000);});

test('tutorial describes two separate taps and denies any hold-height effect',()=>{
 assert(html.includes('공중에서 한 번 더 톡'));assert(html.includes('꾹 눌러도 높아지지 않아요'));
 assert(html.includes('id="jump-label"'));assert(html.includes('id="jump-state"'));
 assert(!html.includes('꾹 누르면'));assert(!game.includes('hold threshold'));
});

test('real motion atlas and painted backdrop are local with registered runtime frames',()=>{
 const motion=readFileSync(file('assets/fuwa-motion-v1.png'));
 assert.equal(motion.readUInt32BE(16),1774);assert.equal(motion.readUInt32BE(20),887);assert.equal(motion[25],6);
 const background=readFileSync(file('assets/moonlit-alley-v1.png'));
 assert.equal(background.readUInt32BE(16),2172);assert.equal(background.readUInt32BE(20),724);
 assert(game.includes('i < 8'));assert(/295\s*\/\s*310/.test(game));assert(/\?\s*6\s*:\s*7/.test(readFileSync(file('animation.mjs'),'utf8')));
 assert(game.includes('distance * .012'));assert(game.includes('Math.min(200,'));
});
test('score, obstacle hints and audio lifecycle are connected',()=>{
 for(const id of ['score','combo','result-score','result-rating'])assert(html.includes(`id="${id}"`));
 assert(game.includes('jumpCueSeconds(game.mode,next)'));assert(game.includes("from './audio.mjs'"));
 for(const action of ['start','pause','resume','stop'])assert(game.includes(`audio.${action}()`));
 assert(game.includes("audio.play('finish')"));assert(game.includes("event.kind"));
});

test('jump cues live in controls so a high arc cannot cover the cat',()=>{
 assert(html.indexOf('id="hint"')>html.indexOf('class="controls"'));
 assert(html.indexOf('id="hint"')>html.indexOf('class="progress"'));
 assert(readFileSync(file('style.css'),'utf8').includes('.control-tip .hint{position:static'));
});

test('actual terrain replaces the old uninterrupted road and uses floor-aware rendering',()=>{
 assert(game.includes('terrainSegments(game)'));assert(game.includes('this.drawTerrain()'));
 assert(!game.includes('this.road.tilePositionX'));assert(game.includes('!game.grounded'));
 assert(game.includes('game.floorHeight!==null'));assert(game.includes('box.baseY??GROUND'));
 assert(game.includes("if(event.type==='recover')"));assert(game.includes('game.jumpStartedAt'));
 assert(game.includes("worldViewport(host.clientWidth,host.clientHeight)"));
});


test('high obstacle is a visible solid stack with two-chevron cue',()=>{
 assert(game.includes("box.kind==='high'"));assert(game.includes('rowH=(box.h-gap*(rows-1))/rows'));
 assert(game.includes('jumpCueSeconds(game.mode,o)-.15'));
});

test('hiss uses a transparent generated pose with reset and reduced-motion fallback',()=>{
 const pose=readFileSync(file('assets/fuwa-hiss-front-v1.png'));
 assert.equal(pose.readUInt32BE(16),1254);assert.equal(pose.readUInt32BE(20),1254);assert.equal(pose[25],6);
 assert(game.includes("this.load.image('hiss', './assets/fuwa-hiss-front-v1.png')"));
 assert(game.includes('this.reactionFootY = GROUND + 1;'));assert(game.includes('this.reactionLabel?.setVisible(false)'));assert(game.includes("setTexture('hiss','trimmed')"));
 assert(readFileSync(file('animation.mjs'),'utf8').includes('const settle = reducedMotion ? 1 : 1 + .035'));assert(game.includes("'하악!'"));
 assert(game.includes('advanceReaction(game,dt)'));assert(game.includes('visualClock+=game.elapsed-before'));
 assert(game.includes('audio.pause({preserveHit:true})'));
 assert(readFileSync(file('scripts/build-standalone.py'),'utf8').includes('fuwa-hiss-front-v1.png'));
});


test('distinct second-jump and landing atlas uses common registration and measured scale',()=>{
 const art=readFileSync(file('assets/fuwa-jump-land-v1.png'));
 assert.equal(art.readUInt32BE(16),1254);assert.equal(art.readUInt32BE(20),1254);assert.equal(art[25],6);
 assert(game.includes("this.load.image('jump-land', './assets/fuwa-jump-land-v1.png')"));
 assert(game.includes('Math.floor(i/2)*627+105,627,445'));assert(game.includes('351/445'));assert(game.includes('.32*pose.stretchX'));
 assert(game.includes('actionFloorLift(pose,game)'));assert(game.includes('scene.landEffect(event.impactSpeed)'));
 assert(game.includes('secondJumpCueSeconds(game.mode,longFlight)'));
 const build=readFileSync(file('scripts/build-standalone.py'),'utf8');assert(build.includes('fuwa-jump-land-v1.png'));assert(build.includes("root / 'animation.mjs'"));
});


test('time survival removes hearts, the fixed finish gate, and old course-completion promises',()=>{
 for(const source of [html,game]){
  assert(!/hearts|후와의 기운|기운 3개|44초|코스 완주|달빛 정원 도착/.test(source));
  assert(!/finishGate|garden-gate|game.status\s*===?\s*['"]won/.test(source));
 }
 assert(!html.includes('id="hearts"'));assert(html.includes('id="potions"'));
 assert(game.includes('score_v11_'));assert(!game.includes('score_v10_'));assert(!game.includes('score_v9_'));
});

test('seeded retry and a distinct new-course action are exposed to the player',()=>{
 for(const id of ['seed-label','result-seed','again','new-course'])assert(html.includes(`id="${id}"`));
 assert(html.includes('같은 길 다시'));assert(html.includes('새로운 길 달리기'));
 assert(game.includes('start(game.seed)'));assert(game.includes('nextSeed=freshSeed()'));
 assert(game.includes('new URLSearchParams'));assert(game.includes(".get('seed')"));
});

test('time potions have a distinct local bottle, seconds label, sound and tutorial',()=>{
 assert(game.includes("make('potion', 56, 66"));
 assert(game.includes("if(event.type==='potion')"));assert(game.includes("audio.play('potion')"));
 assert(game.includes("kind==='potion'?`+${value}초`"));
 assert(game.includes('시간 포션 +${event.seconds}초'));
 assert(html.includes('시간 포션'));
});

test('phone-width HUD gives score/time and pickups separate rows without shrinking the pause target',()=>{
 const css=readFileSync(file('style.css'),'utf8');
 assert(css.includes('@media(max-width:420px)'));
 assert(css.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr) 44px'));
 assert(css.includes('.dashboard>.treat-stat{grid-column:1;grid-row:2}'));
 assert(css.includes('.dashboard>.potion-stat{grid-column:2;grid-row:2}'));
 assert(css.includes('.dashboard .stat-label{white-space:nowrap'));
});

test('reward tutorial and mint bonus art explicitly mark the optional branch',()=>{
 assert(html.includes('생선은 이동 경로 · 민트 별은 선택 도전'));
 assert(game.includes("make('bonus-star', 52, 52"));
 assert(game.includes("treat.optional?'bonus-star':treat.kind||'fish'"));
 assert(game.includes('민트 별은 선택 도전이에요'));assert(game.includes('별길은 선택! 한 번 더 톡'));
 assert(game.indexOf("else if(longFlight&&game.jumpCount===1&&jumpAge>=secondCue)")<game.indexOf('else if(bonusFlight&&game.jumpCount===1'));
});

test('offline build includes the shared physics and trajectory-based reward modules',()=>{
 const build=readFileSync(file('scripts/build-standalone.py'),'utf8');
 assert(build.includes("inline_module('physics.mjs')"));assert(build.includes("inline_module('rewards.mjs')"));
});

// Decode pixels rather than inferring transparency from the PNG color type.
// Generated atlases are 8-bit, non-interlaced RGBA; no external decoder required.
function rgbaPNG(path) {
 const png=readFileSync(file(path.replace(/^\.\//,''))),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.equal(png.subarray(1,4).toString(),'PNG',path);assert.equal(png[24],8,path+' bit depth');assert.equal(png[25],6,path+' RGBA');assert.equal(png[28],0,path+' interlace');
 const chunks=[];let cursor=8;
 while(cursor<png.length){const length=png.readUInt32BE(cursor),type=png.toString('ascii',cursor+4,cursor+8);if(type==='IDAT')chunks.push(png.subarray(cursor+8,cursor+8+length));cursor+=length+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(width*height*4);
 assert.equal(raw.length,(stride+1)*height,path+' decoded byte count');
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const kind=raw[y*(stride+1)],start=y*stride;assert(kind>=0&&kind<=4,path+' PNG filter');
  for(let x=0;x<stride;x++){
   const a=x<4?0:pixels[start+x-4],b=y===0?0:pixels[start+x-stride],c=y===0||x<4?0:pixels[start+x-stride-4];
   const prediction=kind===0?0:kind===1?a:kind===2?b:kind===3?Math.floor((a+b)/2):paeth(a,b,c);
   pixels[start+x]=(raw[y*(stride+1)+1+x]+prediction)&255;
  }
 }
 return{width,height,pixels,alpha:(x,y)=>pixels[(y*width+x)*4+3]};
}

test('character picker is labelled, keyboard-accessible and has three explicit identities',()=>{
 const css=readFileSync(file('style.css'),'utf8');
 assert(html.includes('<legend>함께 달릴 고양이</legend>'));assert(css.includes('input:focus-visible+span'));
 for(const id of CHARACTER_IDS){
  assert(new RegExp(`<input[^>]+id="character-${id}"[^>]+type="radio"[^>]+name="character"[^>]+value="${id}"`).test(html));
  assert(html.includes(`id="character-preview-${id}"`));assert(html.includes(CHARACTERS[id].name));
 }
 assert(html.includes('role="img" aria-label='));assert(html.includes('앞구르기'));assert(html.includes('냥냥펀치'));
 assert(!html.includes('물기'));assert(!html.includes('id="character-nabi-bite"'));
 assert(game.includes("card !== 'start-card'"));assert(game.includes("document.title = `${current.name} 달리기 · 후와 게임`"));
 assert(game.includes("saved.character = id"));assert(game.includes("getCharacter(saved.character).id"));
});

test('new local atlases have real transparent pixels and every registered crop retains its painted frame',()=>{
 assert.equal(characterAtlases().length,4);
 for(const atlas of characterAtlases()) {
  assert(atlas.path.startsWith('./assets/'));assert(existsSync(file(atlas.path)),atlas.path);
  const image=rgbaPNG(atlas.path);let transparent=0,opaque=0;
  for(let i=3;i<image.pixels.length;i+=4){if(image.pixels[i]===0)transparent++;if(image.pixels[i]>200)opaque++;}
  assert(transparent>image.width*image.height*.1,atlas.key+' must have true alpha, not a painted background');
  assert(opaque>image.width*image.height*.03,atlas.key+' must contain visible artwork');
  for(let i=0;i<atlas.count;i++){
   const frame=atlasFrame(atlas,i,image.width,image.height),anchor=atlasAnchor(atlas,i);
   for(const value of Object.values(frame))assert(Number.isInteger(value),atlas.key+' integral measured crop');
   assert(frame.x>=0&&frame.y>=0&&frame.width>0&&frame.height>0);assert(frame.x+frame.width<=image.width&&frame.y+frame.height<=image.height);
   assert(anchor.length===2&&anchor.every(value=>Number.isFinite(value)&&value>=0&&value<=1),atlas.key+' valid anchor');
   const col=i%atlas.columns,row=Math.floor(i/atlas.columns),left=Math.round(col*image.width/atlas.columns),right=Math.round((col+1)*image.width/atlas.columns),top=Math.round(row*image.height/atlas.rows),bottom=Math.round((row+1)*image.height/atlas.rows);
   assert(frame.x>=left&&frame.y>=top&&frame.x+frame.width<=right&&frame.y+frame.height<=bottom,`${atlas.key}/${i} registered crop stays in its own cell`);
   let visible=0,clipped=0,edge=0;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(image.alpha(x,y)>16){visible++;if(x<frame.x||x>=frame.x+frame.width||y<frame.y||y>=frame.y+frame.height)clipped++;if(x===left||x===right-1||y===top||y===bottom-1)edge++;}
   assert(visible>1000,`${atlas.key}/${i} has visible painted subject`);assert.equal(clipped,0,`${atlas.key}/${i} must not crop painted paws/tail/ears`);assert.equal(edge,0,`${atlas.key}/${i} must not bleed into a neighbouring cell`);
   for(const [x,y] of [[left,top],[right-1,top],[left,bottom-1],[right-1,bottom-1]])assert(image.alpha(x,y)<=4,`${atlas.key}/${i} transparent cell corners`);
  }
 }
});

test('all character atlases are preloaded, registered from actual dimensions and required before start',()=>{
 assert(game.includes('for (const atlas of characterAtlases()) this.load.image(atlas.key, atlas.path)'));
 assert(game.includes('...characterAtlases().map(atlas => atlas.key)'));
 assert(game.includes('atlasFrame(sheet, i, image.width, image.height)'));
 assert(game.includes('atlasAnchor(atlas,index)'));
 assert(game.includes('movementFrame(pose)'));assert(game.includes('reactionPose(current,game.reactionElapsed'));
 assert.equal(CHARACTERS.shuri.reaction.kind,'tumble');assert.equal(CHARACTERS.nabi.reaction.kind,'punch');
 assert.equal(CHARACTERS.shuri.reaction.atlas.count,4);assert.equal(CHARACTERS.nabi.reaction.atlas.count,4);
 for(const atlas of characterAtlases())assert(Number.isFinite(atlas.scale??atlas.displayWidth)&&(atlas.scale??atlas.displayWidth)>0);
});

test('offline review build bundles the character registry and every local movement and reaction atlas',()=>{
 const build=readFileSync(file('scripts/build-standalone.py'),'utf8');
 assert(build.includes("inline_module('characters.mjs')"));
 for(const atlas of characterAtlases())assert(build.includes(atlas.path.split('/').at(-1)),atlas.path);
 assert(build.includes("characters = characters.replace('./assets/' + asset, uri)"));
});

test('measured artwork feet stay above the floor and land/reaction anchors do not float',()=>{
 for(const atlas of characterAtlases()) {
  const image=rgbaPNG(atlas.path),isMovement=atlas.count===12;
  for(let index=0;index<atlas.count;index++) {
   const frame=atlasFrame(atlas,index,image.width,image.height),anchor=atlasAnchor(atlas,index),scale=atlas.scale??atlas.displayWidth/frame.width;
   let bottom=-1;
   for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)if(image.alpha(frame.x+x,frame.y+y)>=64)bottom=Math.max(bottom,y+1);
   assert(bottom>0);
   const corrected=(bottom-anchor[1]*frame.height)*scale-(isMovement?(atlas.floorOverhang?.[index]??0):0);
   assert(corrected<=1.5,`${atlas.key}/${index} visible feet extend ${corrected}px below corrected anchor`);
   if(!isMovement||index>=10)assert(corrected>=-1.5,`${atlas.key}/${index} land/reaction floats ${-corrected}px above anchor`);
  }
 }
});
