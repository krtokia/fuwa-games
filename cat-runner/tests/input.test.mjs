// Controller-only DOM doubles: verify distinct press edges, not browser rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];?\n/gm,'').replace(/^export\s+\{[^}]+\}\s+from[^;]+;\n/gm,'').replaceAll('export ','');
const course=source('course.mjs');
const physics=source('physics.mjs');
const rewards=source('rewards.mjs');
const engine=source('engine.mjs');
const animation=readFileSync(new URL('../animation.mjs',import.meta.url),'utf8').replaceAll('export ','');
const controller=readFileSync(new URL('../game.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function setup(saved = null, { query = '?seed=10ddcafe' } = {}) {
 const elements=new Map();
 class Element {
  constructor(id=''){this.id=id;this.handlers={};this.style={};this.textContent='';this.attributes={};this.classes=new Set();this.classList={add:(...names)=>names.forEach(name=>this.classes.add(name)),remove:(...names)=>names.forEach(name=>this.classes.delete(name)),contains:name=>this.classes.has(name),toggle:(name,force)=>{const on=force??!this.classes.has(name);on?this.classes.add(name):this.classes.delete(name);return on;}};}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  emit(type,event={}){for(const fn of this.handlers[type]??[])fn({currentTarget:this,target:this,preventDefault(){},...event});}
  setAttribute(k,v){this.attributes[k]=v;}
  replaceChildren(...items){this.textContent=items.map(x=>x.textContent).join('');}
  focus(){if(!this.disabled)document.activeElement=this;} setPointerCapture(){}
  matches(tag){return tag==='button'&&['jump','start','pause','resume','again','new-course','restart','sound','change-mode'].includes(this.id)||tag==='input'&&this.id.startsWith('mode-');}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document=Object.assign(new Element('document'),{hidden:false,getElementById:el,querySelector:selector=>el(selector==='.progress'?'progress':'card-note'),querySelectorAll:()=>['gentle','normal'].map(value=>Object.assign(el('mode-'+value),{value})),createTextNode:textContent=>({textContent}),createElement:()=>new Element()});
 let randomSeed=0x71a4b500;
 const crypto={getRandomValues(array){for(let i=0;i<array.length;i++)array[i]=++randomSeed;return array;}};
 const location={search:query,href:'https://fuwa.invalid/cat-runner/'+query};
 const window=Object.assign(new Element('window'),{crypto,location});
 class RunnerAudio {constructor(){this.calls=[];}setEnabled(value){return value;}start(){this.calls.push(['start']);}pause(options){this.calls.push(['pause',options]);}resume(options){this.calls.push(['resume',options]);}stop(options){this.calls.push(['stop',options]);}play(type){this.calls.push(['play',type]);}}
 const sandbox={RunnerAudio,document,window,localStorage:{getItem:()=>saved === null ? null : JSON.stringify(saved),setItem(){}},matchMedia:()=>({matches:false}),crypto,location,URL,URLSearchParams,console};
 vm.createContext(sandbox);vm.runInContext(course+'\n'+physics+'\n'+rewards+'\n'+engine+'\n'+animation+'\n'+controller,sandbox);
 vm.runInContext("loaded=true;scene={scale:{width:440},resetRun(){},jumpEffect(){},boostEffect(){},puff(){},landEffect(){},collectEffect(){},potionEffect(){},clearEffect(){},hitEffect(){},finishEffect(){},tweens:{pauseAll(){},resumeAll(){}}};",sandbox);
 el('start').emit('click');
 const tick=seconds=>{let peak=0;for(let i=0;i<seconds*120;i++){vm.runInContext('step(game,1/120)',sandbox);peak=Math.max(peak,vm.runInContext('game.y',sandbox));}return peak;};
 return{el,document,window,tick,refresh:()=>vm.runInContext('updateHUD()',sandbox),get game(){return vm.runInContext('game',sandbox);},run:code=>vm.runInContext(code,sandbox),get held(){return vm.runInContext('heldInput',sandbox);}};
}
const pointer={pointerId:7,isPrimary:true,button:0};
// Isolate a real authored chunk without inventing flat geometry for its hazards.
function atPattern(ui,id,{lead=.5,response=.14}={}) {
 ui.run(`{
  const chunk=instantiatePattern(${JSON.stringify(id)},0,0);
  chunk.encounters.forEach((o,i)=>o.index=i);
  game.course.chunks=[chunk];game.course.encounters=chunk.encounters;game.course.terrain=chunk.terrain;game.course.pickups=[];
  game.course.terrainEdges=[...new Set(chunk.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b);
  game.course.generatedUntil=1000;game.courseIndex=0;game.pickupIndex=0;
  game.elapsed=chunk.encounters[0].encounterAt-${lead}+${response};
  game.y=floorAt(game.elapsed,game);game.floorHeight=game.y;game.vy=0;game.grounded=true;game.jumpCount=0;
  game.obstacles=[];game.treats=[];game.remainingTime=30;game.invincible=0;
 }`);
}

test('button and canvas tap or long hold always produce the same low jump',()=>{
 for(const target of ['jump','game-canvas'])for(const duration of [.05,.3,2]){
  const ui=setup();ui.el(target).emit('pointerdown',pointer);let peak=ui.tick(duration);
  ui.el(target).emit('pointerup',pointer);peak=Math.max(peak,ui.tick(1.5));
  const expected=ui.run('JUMP_SPEED**2/(2*RISE_GRAVITY)');assert(Math.abs(peak-expected)<.5);assert.equal(ui.game.y,0);assert.equal(ui.held,null);
 }
});
test('release then second pointer-down creates a double jump and third is ignored',()=>{
 for(const target of ['jump','game-canvas']){
  const ui=setup();ui.el(target).emit('pointerdown',pointer);ui.tick(.05);ui.window.emit('pointerup',pointer);ui.tick(.3);
  const previous=ui.game.vy;ui.el(target).emit('pointerdown',pointer);
  assert.equal(ui.game.jumpCount,2);assert(ui.game.vy>previous);assert.equal(ui.el('jump-label').textContent,'점프');
  ui.window.emit('pointerup',pointer);ui.tick(.05);const before=ui.game.vy;
  ui.el(target).emit('pointerdown',pointer);assert.equal(ui.game.vy,before);assert.equal(ui.game.jumpCount,2);
  ui.window.emit('pointerup',pointer);assert(ui.tick(1.6)>170);assert.equal(ui.game.jumpCount,0);
 }
});
test('holding cannot repeat or trigger another jump after landing',()=>{
 const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.tick(2);
 assert.equal(ui.game.y,0);assert.equal(ui.game.jumpCount,0);
 ui.el('jump').emit('pointerdown',pointer);ui.tick(.2);assert.equal(ui.game.y,0);
 ui.window.emit('pointerup',pointer);ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,1);
});
test('pointer cancellation, lost capture and outside release permit a later deliberate tap',()=>{
 for(const event of ['pointerup','pointercancel','lostpointercapture']){
  const ui=setup();ui.el('game-canvas').emit('pointerdown',pointer);ui.tick(.1);
  (event==='lostpointercapture'?ui.el('game-canvas'):ui.window).emit(event,pointer);
  assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);
  ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,2);
 }
});
test('keyboard requires two separate presses; autorepeat and other simultaneous keys cannot jump',()=>{
 for(const code of ['Space','ArrowUp']){
  const ui=setup();ui.document.emit('keydown',{code,repeat:false,target:ui.el('jump')});ui.tick(.3);
  const before=ui.game.vy;
  ui.document.emit('keydown',{code,repeat:true,target:ui.el('jump')});
  ui.document.emit('keydown',{code:code==='Space'?'ArrowUp':'Space',repeat:false,target:ui.el('jump')});
  assert.equal(ui.game.jumpCount,1);assert.equal(ui.game.vy,before);
  ui.document.emit('keyup',{code});ui.document.emit('keydown',{code,repeat:false,target:ui.el('jump')});
  assert.equal(ui.game.jumpCount,2);assert(ui.game.vy>before);
  ui.document.emit('keyup',{code});ui.tick(1.6);assert.equal(ui.game.jumpCount,0);
 }
});
test('pause and blur clear held input, but preserve the used airborne jump count',()=>{
 for(const action of ['pause','blur']){
  const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.tick(.08);
  if(action==='pause')ui.el('pause').emit('click');else ui.window.emit('blur');
  assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);assert.equal(ui.game.jumpCount,1);
  ui.el('resume').emit('click');ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,2);
 }
});
test('secondary pointer cannot steal or release the active jump',()=>{
 const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.el('game-canvas').emit('pointerdown',{...pointer,pointerId:8,isPrimary:false});ui.window.emit('pointerup',{...pointer,pointerId:8});assert.equal(ui.held,'pointer:7');assert.equal(ui.game.jumpCount,1);ui.window.emit('pointerup',pointer);assert.equal(ui.held,null);
});
test('assistive click supports double jump, but compatibility mouse clicks cannot add a jump',()=>{
 const ui=setup();ui.el('jump').emit('click',{detail:0});ui.tick(.3);ui.el('jump').emit('click',{detail:0});assert.equal(ui.game.jumpCount,2);ui.tick(1.6);
 ui.el('jump').emit('pointerdown',pointer);ui.tick(.05);ui.el('jump').emit('pointerup',pointer);ui.el('jump').emit('click',{detail:1});assert.equal(ui.game.jumpCount,1);
});
test('restart clears airborne count, input and second-jump label',()=>{
 const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.tick(.2);ui.el('pause').emit('click');ui.el('restart').emit('click');
 assert.equal(ui.game.status,'ready');assert.equal(ui.game.jumpCount,0);assert.equal(ui.held,null);assert.equal(ui.el('jump-label').textContent,'점프');
 ui.el('start').emit('click');assert.equal(ui.game.jumpCount,0);
});

test('new pace is default even for legacy slow preference; new explicit choice is retained',()=>{
 assert.equal(setup().game.mode,'normal');assert.equal(setup({mode:'gentle'}).game.mode,'normal');
 assert.equal(setup({mode:'gentle',paceVersion:4}).game.mode,'gentle');
});

test('long-jump cue explicitly waits before requesting the second tap',()=>{
 const ui=setup();atPattern(ui,'long-garden');ui.tick(.01);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(.42);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,2);
 assert.equal(ui.el('hint').textContent,'사뿐히 착지해요');
});


test('high-stack cue starts early and waits for a separate second tap',()=>{
 const ui=setup();atPattern(ui,'high-stack',{lead:.81});
 ui.tick(.01);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 톡! 잠깐 뒤 다시 톡');
 ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(.16);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 ui.tick(.14);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);assert.equal(ui.el('hint').textContent,'사뿐히 착지해요');ui.tick(1.2);ui.refresh();
 assert.equal(ui.game.hitCount,0);assert.equal(ui.game.grounded,true);
});

test('new route scores remain separate from older timer and fixed-course records',()=>{
 const ui=setup({score_v9_normal:99999,score_v10_normal:88888});ui.run("game.status='finished';game.remainingTime=0;game.score=123;finish();");
 assert.equal(ui.el('jump').disabled,true);assert.equal(ui.el('pause').disabled,true);
 assert.equal(ui.game.status,'finished');assert.equal(ui.el('result-title').textContent,'오늘은 여기까지!');
 assert.equal(ui.run('saved.score_v11_normal'),123);assert.equal(ui.run('saved.score_v10_normal'),88888);assert.equal(ui.run('saved.score_v9_normal'),99999);
 assert.match(ui.el('record').textContent,/123점/);
 ui.el('again').emit('click');assert.equal(ui.game.hitCount,0);assert.equal(ui.game.remainingTime,30);
 assert.equal(ui.run('pausedStatus'),null);assert.equal(ui.game.reactionRemaining,0);
});


// Exercise the real Phaser scene update method with drawing-only doubles.
// No browser/GPU claims: native browser checks remain a separate QA step.
function renderedUI(mode='normal') {
 const ui=setup({mode,paceVersion:4});
 const definition=controller.slice(controller.indexOf('class RunnerScene'),controller.indexOf('\n  const host='));
 ui.run('globalThis.Phaser={Scene:class{}};globalThis.TestScene='+definition+';');
 ui.run(`
 const node=()=>{const n={x:0,y:0,visible:true};return new Proxy(n,{get:(o,k)=>k in o?o[k]:(...v)=>{if(k==='setPosition'){o.x=v[0];o.y=v[1];}if(k==='setTexture'){o.texture=v[0];o.frame=v[1];}if(k==='setAlpha')o.alpha=v[0];if(k==='setScale')o.drawScale=v[0];if(k==='lineBetween')(o.lines??=[]).push(v);if(k==='add')(o.children??=[]).push(...v.flat());if(k==='setVisible')o.visible=v[0];if(k==='destroy')o.destroyed=true;return n.proxy;}});};
 const drawNode=()=>{const n=node();n.proxy=n;return n;};
 scene=new TestScene();scene.scale={width:720,height:420};scene.cameraTop=0;
 for(const name of ['cat','shadow','ring','rescue','backdrop','hissLabel','boostRing'])scene[name]=drawNode();
 scene.lamps=[];scene.fireflies=[];scene.puff=()=>{};scene.drawTerrain=()=>{};
 scene.drawnText=[];scene.effectCalls=[];scene.tweenCalls=[];
 scene.add={image:(x,y,texture)=>Object.assign(drawNode(),{x,y,texture}),text:(x,y,text)=>{scene.drawnText.push(text);return Object.assign(drawNode(),{x,y,text});},graphics:drawNode,container:drawNode,circle:drawNode};
 scene.clearEffect=scene.finishEffect=()=>{};
 scene.tweens={paused:false,pauseAll(){this.paused=true;},resumeAll(){this.paused=false;},killAll(){this.paused=false;},add(options){scene.tweenCalls.push(options);}};
 `);
 ui.frame=(dt=1/120)=>ui.run(`scene.update(0,${dt*1000})`);
 ui.collide=(remainingTime=30)=>{ui.run(`game.remainingTime=${remainingTime};game.obstacles=[{id:999,x:CAT_X+50,w:44,h:42,hit:false}];`);ui.frame();};
 return ui;
}

test('real scene freezes the world, faces player, blocks taps, and resumes once at both speeds',()=>{
 for(const mode of ['normal','gentle']) {
  const ui=renderedUI(mode);ui.collide();
  assert(Math.abs(ui.game.remainingTime-(30-5-1/120))<1e-9);assert.equal(ui.game.reactionRemaining,.85);
  const frozen=ui.run('JSON.stringify({elapsed:game.elapsed,remainingTime:game.remainingTime,distance:game.distance,y:game.y,vy:game.vy,invincible:game.invincible,obstacles:game.obstacles,treats:game.treats,visualClock})');
  assert.equal(ui.run('scene.cat.texture'),'hiss');assert.equal(ui.run('scene.cat.alpha'),1);
  assert.equal(ui.run('scene.tweens.paused'),true);assert.equal(ui.el('jump').disabled,true);
  ui.el('jump').emit('pointerdown',pointer);ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});ui.el('jump').emit('click',{detail:0});
  assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);assert.equal(ui.game.jumpCount,0);
  for(let i=0;i<50;i++)ui.frame();
  assert.equal(ui.run('JSON.stringify({elapsed:game.elapsed,remainingTime:game.remainingTime,distance:game.distance,y:game.y,vy:game.vy,invincible:game.invincible,obstacles:game.obstacles,treats:game.treats,visualClock})'),frozen);
  while(ui.game.reactionRemaining>0)ui.frame();
  assert.equal(ui.game.status,'running');assert.equal(ui.run('scene.tweens.paused'),false);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='hit').length"),1);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='resume'&&c[1]?.fromGesture===false).length"),1);
  const before=ui.game.elapsed;ui.frame();assert(ui.game.elapsed>before);assert.equal(ui.game.hitCount,1);
  // A held rejected key does not become a delayed jump when its repeat arrives.
  ui.document.emit('keydown',{code:'Space',repeat:true,target:ui.el('jump')});assert.equal(ui.game.jumpCount,0);
  ui.document.emit('keyup',{code:'Space'});ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});assert.equal(ui.game.jumpCount,1);
 }
});

test('manual pause and blur preserve reaction phase and terminal intent',()=>{
 for(const remainingTime of [30,4])for(const action of ['pause','blur']) {
  const ui=renderedUI();ui.collide(remainingTime);for(let i=0;i<25;i++)ui.frame();
  const remaining=ui.game.reactionRemaining,elapsed=ui.game.elapsed,budget=ui.game.remainingTime;
  if(action==='pause')ui.el('pause').emit('click');else ui.window.emit('blur');
  assert.equal(ui.game.status,'paused');for(let i=0;i<180;i++)ui.frame();
  assert.equal(ui.game.reactionRemaining,remaining);assert.equal(ui.game.elapsed,elapsed);assert.equal(ui.game.remainingTime,budget);
  ui.el('resume').emit('click');assert.equal(ui.game.status,remainingTime<5?'finished':'running');
  assert.equal(ui.run('scene.tweens.paused'),true);assert.equal(ui.el('jump').disabled,true);
  while(ui.game.reactionRemaining>0)ui.frame();
  if(remainingTime<5){assert.equal(ui.game.status,'finished');assert.equal(ui.run('finished'),true);assert.equal(ui.el('result-title').textContent,'오늘은 여기까지!');for(let i=0;i<30;i++)ui.frame();assert.equal(ui.game.elapsed,elapsed);}
  else{assert.equal(ui.run('finished'),false);assert.equal(ui.document.activeElement,ui.el('jump'));ui.frame();assert(ui.game.elapsed>elapsed);}
 }
});

test('restart during a reaction removes its pose and cannot fire an old resume',()=>{
 const ui=renderedUI();ui.collide();ui.el('pause').emit('click');ui.el('restart').emit('click');
 assert.equal(ui.game.status,'ready');assert.equal(ui.game.reactionRemaining,0);assert.equal(ui.run('scene.hissLabel.visible'),false);assert.equal(ui.run('pausedStatus'),null);
 ui.el('start').emit('click');for(let i=0;i<150;i++)ui.frame();
 assert(ui.game.remainingTime>28&&ui.game.remainingTime<30);assert.equal(ui.game.hitCount,0);assert.equal(ui.game.reactionRemaining,0);
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='resume'&&c[1]?.fromGesture===false).length"),0);
});

test('paused pit reaction restores keyboard focus only after safe-ground recovery',()=>{
 const ui=renderedUI();atPattern(ui,'gap-hop',{lead:.01,response:0});
 while(ui.game.reactionRemaining<=0)ui.frame();
 assert(ui.game.recoveryUntil>ui.game.elapsed);ui.el('pause').emit('click');ui.el('resume').emit('click');
 while(ui.game.reactionRemaining>0)ui.frame();
 assert.equal(ui.el('jump').disabled,true);assert.equal(ui.document.activeElement,ui.el('pause'));
 while(ui.el('jump').disabled)ui.frame();
 assert.equal(ui.document.activeElement,ui.el('jump'));assert.equal(ui.run('restoreJumpFocus'),false);
 ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});assert.equal(ui.game.jumpCount,1);
});


test('touch pointer press changes velocity immediately and compatibility click cannot double-trigger',()=>{
 for(const target of ['jump','game-canvas']) {
  const ui=setup(),touch={...pointer,pointerType:'touch',width:18,height:18,pressure:.5};
  const time=ui.game.elapsed;ui.el(target).emit('pointerdown',touch);
  assert.equal(ui.game.elapsed,time);assert.equal(ui.game.vy,ui.run('JUMP_SPEED'));assert.equal(ui.game.jumpCount,1);
  ui.tick(.15);ui.window.emit('pointerup',touch);ui.el('jump').emit('click',{detail:1});assert.equal(ui.game.jumpCount,1);
  ui.el(target).emit('pointerdown',touch);assert.equal(ui.game.vy,ui.run('SECOND_JUMP_SPEED'));assert.equal(ui.game.jumpCount,2);
  ui.window.emit('pointercancel',touch);assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);
  ui.el(target).emit('pointerdown',touch);assert.equal(ui.game.jumpCount,2);ui.window.emit('pointerup',touch);
  ui.tick(1.5);assert.equal(ui.game.jumpCount,0);assert.equal(ui.game.grounded,true);
 }
});

test('actual scene uses distinct boost frames and immediate boost sound only once',()=>{
 const ui=renderedUI();ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 for(let i=0;i<18;i++)ui.frame();
 ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.game.jumpCount,2);assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='boost').length"),1);
 ui.frame();assert.equal(ui.run('scene.cat.texture'),'jump-land');assert.equal(ui.run('scene.cat.frame'),'action-0');
 for(let i=0;i<7;i++)ui.frame();assert.equal(ui.run('scene.cat.frame'),'action-1');
 for(let i=0;i<12;i++)ui.frame();assert.equal(ui.run('scene.cat.texture'),'motion');
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='boost').length"),1);
});

test('actual landing animation is interrupted by a fresh jump without waiting for its last frame',()=>{
 const ui=renderedUI();ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 while(!ui.game.grounded)ui.frame();
 assert.equal(ui.run('scene.cat.texture'),'jump-land');assert.equal(ui.run('scene.cat.frame'),'action-2');
 assert(ui.run('scene.landImpact')>0);
 ui.el('jump').emit('pointerdown',{...pointer,pointerType:'touch'});
 assert.equal(ui.game.grounded,false);assert.equal(ui.game.vy,ui.run('JUMP_SPEED'));
 ui.frame();assert.equal(ui.run('scene.cat.texture'),'motion');assert.equal(ui.run('scene.cat.frame'),'pose-6');
});


test('ordinary manual pause and visibility loss freeze both world and time budget',()=>{
 for(const action of ['pause','visibility']) {
  const ui=renderedUI();for(let i=0;i<30;i++)ui.frame();
  if(action==='pause')ui.el('pause').emit('click');else {ui.document.hidden=true;ui.document.emit('visibilitychange');}
  const frozen=JSON.stringify(ui.game),clock=ui.run('visualClock');
  for(let i=0;i<240;i++)ui.frame();
  assert.equal(JSON.stringify(ui.game),frozen);assert.equal(ui.run('visualClock'),clock);
  assert.equal(ui.game.status,'paused');ui.el('resume').emit('click');ui.frame();
  assert.equal(ui.game.status,'running');assert(ui.run('visualClock')>clock);
  assert(ui.game.remainingTime<JSON.parse(frozen).remainingTime);
 }
});

test('actual timeout presents one result without a collision reaction or delayed input',()=>{
 for(const mode of ['normal','gentle']) {
  const ui=renderedUI(mode);ui.run('game.remainingTime=1/120;');ui.frame();
  assert.equal(ui.game.status,'finished');assert.equal(ui.game.endReason,'timeout');
  assert.equal(ui.game.remainingTime,0);assert.equal(ui.game.reactionRemaining,0);assert.equal(ui.game.hitCount,0);
  assert.equal(ui.run('finished'),true);assert.equal(ui.el('result-card').hidden,false);
  assert.equal(ui.el('jump').disabled,true);assert.equal(ui.el('pause').disabled,true);
  assert.equal(ui.run('scene.hissLabel.visible'),false);assert.equal(ui.run('scene.cat.texture'),'fuwa');
  const frozen=JSON.stringify(ui.game),clock=ui.run('visualClock');
  ui.el('jump').emit('pointerdown',pointer);ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});ui.el('jump').emit('click',{detail:0});
  ui.el('pause').emit('click');ui.el('resume').emit('click');
  for(let i=0;i<180;i++)ui.frame();
  assert.equal(JSON.stringify(ui.game),frozen);assert.equal(ui.run('visualClock'),clock);assert.equal(ui.held,null);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='hit').length"),0);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='finish').length"),1);
  assert.equal(ui.el('time').textContent,'0초');assert.equal(ui.el('progress').attributes['aria-valuenow'],'0');
 }
});

test('actual fatal collision keeps its full hiss before one result and never resumes the music',()=>{
 const ui=renderedUI();ui.collide(4);
 assert.equal(ui.game.status,'finished');assert.equal(ui.game.endReason,'collision');assert.equal(ui.game.remainingTime,0);
 assert.equal(ui.run('finished'),false);assert.equal(ui.el('result-card').hidden,true);assert.equal(ui.run('scene.cat.texture'),'hiss');
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='hit').length"),1);
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='pause'&&c[1]?.preserveHit===true).length"),1);
 const elapsed=ui.game.elapsed;for(let i=0;i<100;i++)ui.frame();
 assert(ui.game.reactionRemaining>0);assert.equal(ui.run('finished'),false);
 while(ui.game.reactionRemaining>0)ui.frame();
 assert.equal(ui.run('finished'),true);assert.equal(ui.game.elapsed,elapsed);assert.equal(ui.el('result-card').hidden,false);
 for(let i=0;i<30;i++)ui.frame();
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='resume'&&c[1]?.fromGesture===false).length"),0);
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='finish').length"),1);
});

test('actual potion pickup adds time with seconds feedback and its own sound, never snack points',()=>{
 for(const mode of ['normal','gentle']) {
  const ui=renderedUI(mode);
  ui.run("game.treats=[{id:999,x:CAT_X+66,y:GROUND-35,kind:'potion',value:10,taken:false}];");ui.frame();
  assert(Math.abs(ui.game.remainingTime-(40-1/120))<1e-9);assert.equal(ui.game.potions,1);
  assert.equal(ui.game.snacks,0);assert.equal(ui.game.stars,0);assert.equal(ui.game.score,0);
  assert.equal(ui.el('potions').textContent,1);assert.equal(ui.el('time').textContent,'40초');
  assert.equal(ui.el('progress').attributes['aria-valuemax'],'40');assert.equal(ui.el('progress').attributes['aria-valuenow'],'40');
  assert.equal(ui.el('progress-fill').style.width,'100%');
  assert.equal(ui.run("scene.drawnText.filter(text=>text==='+10초').length"),1);
  assert.equal(ui.el('course-toast').textContent,'시간 포션 +10초');assert(ui.el('course-toast').classList.contains('visible'));
  assert.match(ui.el('announcement').textContent,/시간 포션.*10초 추가/);
  for(let i=0;i<30;i++)ui.frame();
  assert.equal(ui.game.potions,1);assert.equal(ui.game.snacks,0);assert.equal(ui.game.score,0);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='potion').length"),1);
  assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='collect').length"),0);
 }
});

test('valid seed links replay exactly, new course picks a fresh seed, and button events never become seeds',()=>{
 for(const query of ['?seed=10ddcafe','?seed=0','?seed=FFFFFFFF']) {
  const ui=setup(null,{query}),seed=parseInt(query.split('=')[1],16)>>>0;
  assert.equal(ui.game.seed,seed);const route=ui.run('JSON.stringify(game.course)');
  assert.equal(ui.el('seed-label').textContent,seed.toString(16).padStart(8,'0'));
  ui.run("game.status='finished';game.remainingTime=0;finish();");
  assert(ui.el('result-seed').textContent.includes(seed.toString(16).padStart(8,'0')));
  ui.el('again').emit('click',{detail:1});assert.equal(ui.game.seed,seed);assert.equal(ui.run('JSON.stringify(game.course)'),route);
  assert.equal(ui.game.remainingTime,30);assert.equal(ui.game.elapsed,0);
  ui.run("game.status='finished';game.remainingTime=0;finish();");ui.el('new-course').emit('click',{detail:1});
  const fresh=ui.game.seed;assert.equal(fresh,0x71a4b501);assert.notEqual(fresh,seed);
  assert.notEqual(ui.run('JSON.stringify(game.course)'),route);
  ui.el('again').emit('click');assert.equal(ui.game.seed,fresh);
  ui.el('pause').emit('click');ui.el('restart').emit('click');ui.el('start').emit('click',{detail:1});assert.equal(ui.game.seed,fresh);
  ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,1);ui.window.emit('pointerup',pointer);
  assert.equal(ui.el('jump').handlers.pointerdown.length,1);assert.equal(ui.document.handlers.keydown.length,1);
 }
});

test('missing and malformed seed links choose an initial seed rather than silently using zero',()=>{
 for(const query of ['', '?seed=', '?seed=xyz', '?seed=123456789', '?seed=-1']) {
  const ui=setup(null,{query});assert.equal(ui.game.seed,0x71a4b501);
  ui.el('again').emit('click');assert.equal(ui.game.seed,0x71a4b501);
  ui.el('new-course').emit('click');assert.equal(ui.game.seed,0x71a4b502);
 }
});

test('retry destroys old scene objects and resets low-time, reaction, recovery and toast markers',()=>{
 for(const action of ['again','new-course']) {
  const ui=renderedUI();
  ui.run("game.obstacles=[{id:701,x:500,w:44,h:42,kind:'crate',hit:false}];game.treats=[{id:702,x:500,y:GROUND-35,kind:'potion',taken:false}];scene.syncObjects();globalThis.oldBox=scene.boxes.get(701);globalThis.oldTreat=scene.treats.get(702);scene.fx.push(scene.add.text(20,20,'old'));globalThis.oldFx=scene.fx[0];game.remainingTime=4;game.recoveryUntil=3;game.invincible=2;scene.rescue.setVisible(true);scene.ring.setVisible(true);toast('old potion');updateHUD();");
  assert(ui.el('time').classList.contains('low-time'));assert(ui.el('course-toast').classList.contains('visible'));
  ui.el(action).emit('click');
  assert.equal(ui.run('oldBox.destroyed&&oldTreat.destroyed&&oldFx.destroyed'),true);
  assert.equal(ui.run('scene.boxes.size+scene.treats.size+scene.fx.length'),0);
  assert.equal(ui.game.remainingTime,30);assert.equal(ui.game.potions,0);assert.equal(ui.game.recoveryUntil,0);assert.equal(ui.game.invincible,0);
  assert.equal(ui.run('scene.hissLabel.visible'),false);assert.equal(ui.run('scene.boostRing.visible'),false);
  assert.equal(ui.run('scene.rescue.visible'),false);assert.equal(ui.run('scene.ring.visible'),false);
  assert.equal(ui.el('time').classList.contains('low-time'),false);assert.equal(ui.el('course-toast').classList.contains('visible'),false);
  assert.equal(ui.el('progress').attributes['aria-valuemax'],'30');assert.equal(ui.el('progress').attributes['aria-valuenow'],'30');
  assert.equal(ui.el('progress-fill').style.width,'100%');assert.equal(ui.el('jump').disabled,false);
 }
});


test('a potion-extended run remains playable past the retired 44-second finish',()=>{
 const ui=renderedUI();
 ui.run("ensureCourse(game.course,70);game.elapsed=54;game.distance=54*MODES[game.mode].speed;game.remainingTime=12;game.courseIndex=game.course.totalEncounters;game.pickupIndex=game.course.totalPickups;game.y=floorAt(game.elapsed,game);game.floorHeight=game.y;game.obstacles=[];game.treats=[];");
 ui.frame();assert.equal(ui.game.status,'running');assert(ui.game.elapsed>54);
 assert.equal(ui.run('finished'),false);assert.equal(ui.el('result-card').hidden,true);
 assert.equal(ui.el('time').textContent,'12초');assert.equal(ui.el('progress').attributes['aria-valuenow'],'12');
 ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,1);assert(ui.game.vy>0);
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='play'&&c[1]==='finish').length"),0);
});

test('optional star cue follows an accepted low-box jump and can be ignored safely',()=>{
 for(const mode of ['normal','gentle'])for(const takeBonus of [false,true]){
  const ui=setup({mode,paceVersion:4});atPattern(ui,'low-lane',{response:.15});ui.tick(.01);
  ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
  assert.equal(ui.el('hint').textContent,'민트 별은 선택 도전이에요');
  ui.tick(ui.run('BONUS_SECOND_CUE_SECONDS')+.01);ui.refresh();
  assert.equal(ui.el('hint').textContent,'별길은 선택! 한 번 더 톡');
  if(takeBonus){ui.tick(.15);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);assert.equal(ui.game.jumpCount,2);assert.equal(ui.el('hint').textContent,'사뿐히 착지해요');}
  ui.tick(1.2);ui.refresh();assert.equal(ui.game.hitCount,0);assert.equal(ui.game.grounded,true);
  assert.equal(ui.game.stars,takeBonus?2:0);assert.equal(ui.game.snacks,takeBonus?5:3);
  assert(!ui.el('hint').textContent.includes('선택'));
 }
});

test('required second-jump cue takes precedence over optional reward guidance',()=>{
 const ui=setup();atPattern(ui,'high-stack',{lead:.81,response:.15});ui.tick(.01);
 // Both flags are deliberately present to lock down the priority branch.
 ui.run('game.obstacles[0].bonusSecondCue=BONUS_SECOND_CUE_SECONDS;');
 ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(ui.run('BONUS_SECOND_CUE_SECONDS')+.01);ui.refresh();
 assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 assert(!ui.el('hint').textContent.includes('선택'));
});

test('an unrelated early jump never acquires the low-box bonus prompt',()=>{
 const ui=setup();atPattern(ui,'low-lane',{lead:1.25,response:0});ui.tick(.01);
 ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 ui.tick(ui.run('BONUS_SECOND_CUE_SECONDS')+.01);ui.refresh();
 assert.equal(ui.game.jumpCount,1);assert(!ui.el('hint').textContent.includes('선택'));
});

test('scene distinguishes optional stars without moving any pickup off its planned route',()=>{
 const ui=renderedUI();
 ui.run(`game.treats=[
  {id:801,x:300,y:140,kind:'fish',optional:false},
  {id:802,x:350,y:150,kind:'star',optional:false},
  {id:803,x:400,y:100,kind:'star',optional:true},
  {id:804,x:450,y:300,kind:'potion',optional:false}
 ];scene.syncObjects();`);
 for(const [id,texture,x,y,size]of[[801,'fish',300,140,.8],[802,'star',350,150,.85],[803,'bonus-star',400,100,.85],[804,'potion',450,300,1]]){
  assert.equal(ui.run(`scene.treats.get(${id}).texture`),texture);assert.equal(ui.run(`scene.treats.get(${id}).x`),x);assert.equal(ui.run(`scene.treats.get(${id}).y`),y);
  assert(Math.abs(ui.run(`scene.treats.get(${id}).drawScale`)-size)<=size*.035+1e-12);
 }
 ui.run('globalThis.oldBonus=scene.treats.get(803);');const seed=ui.game.seed;
 ui.el('again').emit('click');assert.equal(ui.game.seed,seed);assert.equal(ui.run('oldBonus.destroyed'),true);assert.equal(ui.run('scene.treats.size'),0);
 assert.equal(ui.game.stars,0);assert.equal(ui.game.jumpStartedAt,null);assert(!ui.el('hint').textContent.includes('선택'));
});

test('lower gap landing flag follows its real floor instead of an imaginary level lip',()=>{
 for(const mode of ['normal','gentle']){
  const ui=renderedUI(mode);atPattern(ui,'sunken-gap');ui.frame();
  const edges=JSON.parse(ui.run("JSON.stringify(scene.boxes.get(game.obstacles.find(o=>o.kind==='gap').id).children[0].lines)"));
  const width=.70*ui.run('MODES[game.mode].speed');
  assert(edges.some(([x1,y1,x2,y2])=>x1===0&&x2===0&&y1===-26&&y2===-4));
  assert(edges.some(([x1,y1,x2,y2])=>Math.abs(x1-width)<1e-9&&Math.abs(x2-width)<1e-9&&y1===6&&y2===28));
 }
});

test('an urgent next step or drop cannot be hidden by the optional star cue',()=>{
 for(const kind of ['step','drop']){
  const ui=setup();atPattern(ui,'low-lane',{response:.15});ui.tick(.01);
  ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
  ui.tick(ui.run('BONUS_SECOND_CUE_SECONDS')+.01);
  ui.run(`game.obstacles[0].cleared=true;game.obstacles.push({...SHAPES[${JSON.stringify(kind)}],kind:${JSON.stringify(kind)},encounterAt:game.elapsed+.2,x:CAT_X+70+MODES[game.mode].speed*.2,hit:false,cleared:false});game.obstacles.sort((a,b)=>a.encounterAt-b.encounterAt);`);
  ui.refresh();assert.equal(ui.el('hint').textContent,kind==='drop'?'낮아지는 길, 그대로 가요':'지금 톡! ↑');
 }
});
