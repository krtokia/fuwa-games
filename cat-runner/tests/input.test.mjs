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
  focus(){} setPointerCapture(){}
  matches(tag){return tag==='button'&&['jump','start','pause','resume','again','restart','sound'].includes(this.id)||tag==='input'&&this.id.startsWith('mode-');}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document=Object.assign(new Element('document'),{hidden:false,getElementById:el,querySelector:()=>el('progress'),querySelectorAll:()=>['gentle','normal'].map(value=>Object.assign(el('mode-'+value),{value})),createTextNode:textContent=>({textContent}),createElement:()=>new Element()});
 const window=new Element('window');
 class RunnerAudio {setEnabled(value){return value;}start(){}pause(){}resume(){}stop(){}play(){}}
 const sandbox={RunnerAudio,document,window,localStorage:{getItem:()=>saved === null ? null : JSON.stringify(saved),setItem(){}},matchMedia:()=>({matches:false}),console};
 vm.createContext(sandbox);vm.runInContext(engine+'\n'+controller,sandbox);
 vm.runInContext("loaded=true;scene={scale:{width:440},resetRun(){},jumpEffect(){},puff(){},landEffect(){},collectEffect(){},clearEffect(){},hitEffect(){},finishEffect(){},tweens:{pauseAll(){},resumeAll(){}}};",sandbox);
 el('start').emit('click');
 const tick=seconds=>{let peak=0;for(let i=0;i<seconds*120;i++){vm.runInContext('step(game,1/120)',sandbox);peak=Math.max(peak,vm.runInContext('game.y',sandbox));}return peak;};
 return{el,document,window,tick,refresh:()=>vm.runInContext('updateHUD()',sandbox),get game(){return vm.runInContext('game',sandbox);},get held(){return vm.runInContext('heldInput',sandbox);}};
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
 const ui=setup();ui.tick(6.65);ui.el('jump').emit('pointerdown',pointer);ui.window.emit('pointerup',pointer);
 assert.equal(ui.el('hint').textContent,'조금 더 날아가요…');
 ui.tick(.42);ui.refresh();assert.equal(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
 ui.el('jump').emit('pointerdown',pointer);assert.equal(ui.game.jumpCount,2);
 assert.notEqual(ui.el('hint').textContent,'지금 한 번 더 톡! ↑↑');
});
