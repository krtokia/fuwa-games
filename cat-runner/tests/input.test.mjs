// Controller-only DOM doubles: verify held input plumbing, not browser rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const engine=readFileSync(new URL('../engine.mjs',import.meta.url),'utf8').replaceAll('export ','');
const controller=readFileSync(new URL('../game.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function setup() {
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
 const sandbox={document,window,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),console};
 vm.createContext(sandbox);vm.runInContext(engine+'\n'+controller,sandbox);
 vm.runInContext("loaded=true;scene={scale:{width:440},resetRun(){},jumpEffect(){},puff(){},landEffect(){},collectEffect(){},clearEffect(){},hitEffect(){},tweens:{pauseAll(){},resumeAll(){}}};",sandbox);
 el('start').emit('click');
 const tick=seconds=>{let peak=0;for(let i=0;i<seconds*120;i++){vm.runInContext('step(game,1/120)',sandbox);peak=Math.max(peak,vm.runInContext('game.y',sandbox));}return peak;};
 return{el,document,window,tick,get game(){return vm.runInContext('game',sandbox);},get held(){return vm.runInContext('heldInput',sandbox);}};
}
const pointer={pointerId:7,isPrimary:true,button:0};
test('button and canvas short pointer taps produce the lower jump',()=>{
 for(const target of ['jump','game-canvas']){const ui=setup();ui.el(target).emit('pointerdown',pointer);let peak=ui.tick(.08);ui.el(target).emit('pointerup',pointer);peak=Math.max(peak,ui.tick(1.5));assert(peak>89&&peak<91);assert.equal(ui.game.jumpBoosted,false);assert.equal(ui.held,null);}
});
test('holding button or canvas yields one higher jump, not auto-repeat',()=>{
 for(const target of ['jump','game-canvas']){const ui=setup();ui.el(target).emit('pointerdown',pointer);const peak=ui.tick(2);assert(peak>144&&peak<146);assert.equal(ui.game.y,0);ui.tick(1);assert.equal(ui.game.y,0);ui.window.emit('pointerup',pointer);assert.equal(ui.held,null);}
});
test('pointer cancellation or release outside cancels the pending boost',()=>{
 for(const event of ['pointerup','pointercancel']){const ui=setup();ui.el('game-canvas').emit('pointerdown',pointer);ui.tick(.08);ui.window.emit(event,pointer);const peak=ui.tick(1.4);assert(peak<91);assert.equal(ui.game.jumpBoosted,false);assert.equal(ui.game.jumpHeld,false);}
});
test('keyboard keyup distinguishes tap from hold and ignores repeated keydown',()=>{
 for(const duration of [.06,.3]){const ui=setup();ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});let peak=ui.tick(duration);ui.document.emit('keydown',{code:'Space',repeat:true,target:ui.el('jump')});ui.document.emit('keyup',{code:'Space'});peak=Math.max(peak,ui.tick(1.5));assert(duration<.16?peak<91:peak>144);assert.equal(ui.game.jumpBuffer,0);}
});
test('pause and blur clear held input before resume',()=>{
 for(const action of ['pause','blur']){const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.tick(.08);if(action==='pause')ui.el('pause').emit('click');else ui.window.emit('blur');assert.equal(ui.held,null);assert.equal(ui.game.jumpHeld,false);ui.el('resume').emit('click');assert(ui.tick(1.4)<91);}
});
test('secondary pointer cannot steal or release the active jump',()=>{
 const ui=setup();ui.el('jump').emit('pointerdown',pointer);ui.el('game-canvas').emit('pointerdown',{...pointer,pointerId:8,isPrimary:false});ui.window.emit('pointerup',{...pointer,pointerId:8});assert.equal(ui.held,'pointer:7');ui.window.emit('pointerup',pointer);assert.equal(ui.held,null);
});
test('assistive click stays low and a follow-up mouse click cannot queue another jump',()=>{
 const ui=setup();ui.el('jump').emit('click',{detail:0});assert(ui.tick(1.5)<91);
 ui.el('jump').emit('pointerdown',pointer);ui.tick(.05);ui.el('jump').emit('pointerup',pointer);ui.el('jump').emit('click',{detail:1});assert.equal(ui.game.jumpBuffer,0);
});
