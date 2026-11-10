// Controller-only DOM doubles: verify distinct press edges, not browser rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const engine=readFileSync(new URL('../engine.mjs',import.meta.url),'utf8').replaceAll('export ','');
const controller=readFileSync(new URL('../game.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function setup(saved = null) {
 const elements=new Map();
 class Element {
  constructor(id=''){this.id=id;this.handlers={};this.style={};this.textContent='';this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  emit(type,event={}){for(const fn of this.handlers[type]??[])fn({currentTarget:this,target:this,preventDefault(){},...event});}
  setAttribute(k,v){this.attributes[k]=v;}
  replaceChildren(...items){this.textContent=items.map(x=>x.textContent).join('');}
  focus(){if(!this.disabled)document.activeElement=this;} setPointerCapture(){}
  matches(tag){return tag==='button'&&['jump','start','pause','resume','again','restart','sound'].includes(this.id)||tag==='input'&&this.id.startsWith('mode-');}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document=Object.assign(new Element('document'),{hidden:false,getElementById:el,querySelector:()=>el('progress'),querySelectorAll:()=>['gentle','normal'].map(value=>Object.assign(el('mode-'+value),{value})),createTextNode:textContent=>({textContent}),createElement:()=>new Element()});
 const window=new Element('window');
 class RunnerAudio {constructor(){this.calls=[];}setEnabled(value){return value;}start(){this.calls.push(['start']);}pause(options){this.calls.push(['pause',options]);}resume(options){this.calls.push(['resume',options]);}stop(options){this.calls.push(['stop',options]);}play(type){this.calls.push(['play',type]);}}
 const sandbox={RunnerAudio,document,window,localStorage:{getItem:()=>saved === null ? null : JSON.stringify(saved),setItem(){}},matchMedia:()=>({matches:false}),console};
 vm.createContext(sandbox);vm.runInContext(engine+'\n'+controller,sandbox);
 vm.runInContext("loaded=true;scene={scale:{width:440},resetRun(){},jumpEffect(){},puff(){},landEffect(){},collectEffect(){},clearEffect(){},hitEffect(){},finishEffect(){},tweens:{pauseAll(){},resumeAll(){}}};",sandbox);
 el('start').emit('click');
 const tick=seconds=>{let peak=0;for(let i=0;i<seconds*120;i++){vm.runInContext('step(game,1/120)',sandbox);peak=Math.max(peak,vm.runInContext('game.y',sandbox));}return peak;};
 return{el,document,window,tick,refresh:()=>vm.runInContext('updateHUD()',sandbox),get game(){return vm.runInContext('game',sandbox);},run:code=>vm.runInContext(code,sandbox),get held(){return vm.runInContext('heldInput',sandbox);}};
}
const pointer={pointerId:7,isPrimary:true,button:0};
test('button and canvas tap or long hold always produce the same low jump',()=>{
 for(const target of ['jump','game-canvas'])for(const duration of [.05,.3,2]){
  const ui=setup();ui.el(target).emit('pointerdown',pointer);let peak=ui.tick(duration);
  ui.el(target).emit('pointerup',pointer);peak=Math.max(peak,ui.tick(1.5));
  assert(peak>89&&peak<91);assert.equal(ui.game.y,0);assert.equal(ui.held,null);
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
 const ui=setup();ui.run('game.elapsed=6.64;game.courseIndex=1;');ui.tick(.01);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(.42);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,2);
 assert.equal(ui.el('hint').textContent,'사뿐히 착지해요');
});


test('high-stack cue starts early and waits for a separate second tap',()=>{
 const ui=setup();ui.run("game.elapsed=32.08;game.courseIndex=9;game.hearts=3;game.invincible=0;game.y=0;game.vy=0;game.grounded=true;game.jumpCount=0;game.obstacles=[];game.treats=[];");
 ui.tick(.01);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 톡! 잠깐 뒤 다시 톡');
 ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(.32);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 ui.tick(.1);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);assert.equal(ui.el('hint').textContent,'사뿐히 착지해요');ui.tick(1.2);ui.refresh();
 assert.equal(ui.game.hitCount,0);assert.equal(ui.game.grounded,true);
});

test('last collision stops music preserving hiss, and result uses separate course record',()=>{
 const ui=setup();ui.run("game.status='finished';game.hearts=0;finish();");
 assert.equal(ui.el('jump').disabled,true);assert.equal(ui.el('pause').disabled,true);
 assert.equal(ui.game.status,'finished');assert.equal(ui.el('result-title').textContent,'다시 달려볼까요?');
 assert(ui.run("Object.hasOwn(saved,'score_v7_normal')"));
 ui.el('again').emit('click');assert.equal(ui.game.hitCount,0);assert.equal(ui.game.hearts,3);
 assert.equal(ui.run('pausedStatus'),null);assert.equal(ui.game.reactionRemaining,0);
});


// Exercise the real Phaser scene update method with drawing-only doubles.
// No browser/GPU claims: native browser checks remain a separate QA step.
function renderedUI(mode='normal') {
 const ui=setup({mode,paceVersion:4});
 const definition=controller.slice(controller.indexOf('class RunnerScene'),controller.indexOf('\n  const host='));
 ui.run('globalThis.Phaser={Scene:class{}};globalThis.TestScene='+definition+';');
 ui.run(`
 const node=()=>{const n={x:0,y:0,visible:true};return new Proxy(n,{get:(o,k)=>k in o?o[k]:(...v)=>{if(k==='setPosition'){o.x=v[0];o.y=v[1];}if(k==='setTexture'){o.texture=v[0];o.frame=v[1];}if(k==='setAlpha')o.alpha=v[0];if(k==='setVisible')o.visible=v[0];return n.proxy;}});};
 const drawNode=()=>{const n=node();n.proxy=n;return n;};
 scene=new TestScene();scene.scale={width:720,height:420};scene.cameraTop=0;
 for(const name of ['cat','shadow','ring','rescue','backdrop','finishGate','hissLabel'])scene[name]=drawNode();
 scene.lamps=[];scene.fireflies=[];scene.puff=()=>{};scene.syncObjects=()=>{};
 scene.collectEffect=scene.landEffect=scene.clearEffect=scene.finishEffect=()=>{};
 scene.tweens={paused:false,pauseAll(){this.paused=true;},resumeAll(){this.paused=false;},killAll(){this.paused=false;}};
 `);
 ui.frame=(dt=1/120)=>ui.run(`scene.update(0,${dt*1000})`);
 ui.collide=(hearts=3)=>{ui.run(`game.hearts=${hearts};game.obstacles=[{id:999,x:CAT_X+50,w:44,h:42,hit:false}];`);ui.frame();};
 return ui;
}

test('real scene freezes the world, faces player, blocks taps, and resumes once at both speeds',()=>{
 for(const mode of ['normal','gentle']) {
  const ui=renderedUI(mode);ui.collide();
  assert.equal(ui.game.hearts,2);assert.equal(ui.game.reactionRemaining,.85);
  const frozen=ui.run('JSON.stringify({elapsed:game.elapsed,distance:game.distance,y:game.y,vy:game.vy,invincible:game.invincible,obstacles:game.obstacles,treats:game.treats,visualClock})');
  assert.equal(ui.run('scene.cat.texture'),'hiss');assert.equal(ui.run('scene.cat.alpha'),1);
  assert.equal(ui.run('scene.tweens.paused'),true);assert.equal(ui.el('jump').disabled,true);
  ui.el('jump').emit('pointerdown',pointer);ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});ui.el('jump').emit('click',{detail:0});
  assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);assert.equal(ui.game.jumpCount,0);
  for(let i=0;i<50;i++)ui.frame();
  assert.equal(ui.run('JSON.stringify({elapsed:game.elapsed,distance:game.distance,y:game.y,vy:game.vy,invincible:game.invincible,obstacles:game.obstacles,treats:game.treats,visualClock})'),frozen);
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
 for(const hearts of [3,1])for(const action of ['pause','blur']) {
  const ui=renderedUI();ui.collide(hearts);for(let i=0;i<25;i++)ui.frame();
  const remaining=ui.game.reactionRemaining,elapsed=ui.game.elapsed;
  if(action==='pause')ui.el('pause').emit('click');else ui.window.emit('blur');
  assert.equal(ui.game.status,'paused');for(let i=0;i<180;i++)ui.frame();
  assert.equal(ui.game.reactionRemaining,remaining);assert.equal(ui.game.elapsed,elapsed);
  ui.el('resume').emit('click');assert.equal(ui.game.status,hearts===1?'finished':'running');
  assert.equal(ui.run('scene.tweens.paused'),true);assert.equal(ui.el('jump').disabled,true);
  while(ui.game.reactionRemaining>0)ui.frame();
  if(hearts===1){assert.equal(ui.game.status,'finished');assert.equal(ui.run('finished'),true);assert.equal(ui.el('result-title').textContent,'다시 달려볼까요?');for(let i=0;i<30;i++)ui.frame();assert.equal(ui.game.elapsed,elapsed);}
  else{assert.equal(ui.run('finished'),false);assert.equal(ui.document.activeElement,ui.el('jump'));ui.frame();assert(ui.game.elapsed>elapsed);}
 }
});

test('restart during a reaction removes its pose and cannot fire an old resume',()=>{
 const ui=renderedUI();ui.collide();ui.el('pause').emit('click');ui.el('restart').emit('click');
 assert.equal(ui.game.status,'ready');assert.equal(ui.game.reactionRemaining,0);assert.equal(ui.run('scene.hissLabel.visible'),false);assert.equal(ui.run('pausedStatus'),null);
 ui.el('start').emit('click');for(let i=0;i<150;i++)ui.frame();
 assert.equal(ui.game.hearts,3);assert.equal(ui.game.hitCount,0);assert.equal(ui.game.reactionRemaining,0);
 assert.equal(ui.run("audio.calls.filter(c=>c[0]==='resume'&&c[1]?.fromGesture===false).length"),0);
});

test('paused pit reaction restores keyboard focus only after safe-ground recovery',()=>{
 const ui=renderedUI();ui.run('game.elapsed=9.99;game.courseIndex=2;game.snackIndex=99;');
 while(ui.game.reactionRemaining<=0)ui.frame();
 assert(ui.game.recoveryUntil>ui.game.elapsed);ui.el('pause').emit('click');ui.el('resume').emit('click');
 while(ui.game.reactionRemaining>0)ui.frame();
 assert.equal(ui.el('jump').disabled,true);assert.equal(ui.document.activeElement,ui.el('pause'));
 while(ui.el('jump').disabled)ui.frame();
 assert.equal(ui.document.activeElement,ui.el('jump'));assert.equal(ui.run('restoreJumpFocus'),false);
 ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});assert.equal(ui.game.jumpCount,1);
});
