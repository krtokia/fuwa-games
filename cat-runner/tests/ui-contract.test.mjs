// Lightweight DOM-contract checks, not a substitute for real browser/visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../engine.mjs',import.meta.url),'utf8').replaceAll('export ','')+'\n'+readFileSync(new URL('../game.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function boot({stored='{}',blocked=false,width=390}={}) {
 const elements=new Map();let frame;let now=0;const errors=[];
 class Element {
  constructor(id=''){this.id=id;this.handlers={};this.hidden=false;this.disabled=false;this.textContent='';this.style={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(n,fn){(this.handlers[n]??=[]).push(fn);}
  emit(n,event={}){for(const fn of this.handlers[n]??[])fn({target:this,preventDefault(){},...event});}
  setAttribute(k,v){this.attributes[k]=v;}
  replaceChildren(...parts){this.textContent=parts.map(x=>x.textContent).join('');}
  focus(){}
  matches(s){return s==='button'&&['start','again','resume','restart','pause','jump','sound','change-mode'].includes(this.id)||s==='input'&&this.id.startsWith('mode-');}
  closest(s){return s.includes('button')&&this.matches('button')?this:null;}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 el('canvas').getContext=()=>context2d;el('canvas').getBoundingClientRect=()=>({width,height:380});
 const radios=['gentle','normal'].map(mode=>Object.assign(el('mode-'+mode),{value:mode}));
 const document=Object.assign(new Element('document'),{hidden:false,getElementById:el,createElement:()=>new Element(),createTextNode:text=>({textContent:text}),querySelectorAll:()=>radios,querySelector:()=>el('progress')});
 const window=Object.assign(new Element('window'),{devicePixelRatio:1});
 const storage={getItem(){if(blocked)throw Error('blocked');return stored;},setItem(k,v){if(blocked)throw Error('blocked');stored=v;}};
 const sandbox={document,window,localStorage:storage,matchMedia:()=>({matches:false}),Image:class{complete=true;naturalWidth=720;},ResizeObserver:class{constructor(callback){this.callback=callback;}observe(){this.callback();}},requestAnimationFrame:fn=>{frame=fn;},console};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return {el,document,window,radios,errors,get stored(){return stored;},get game(){return vm.runInContext('game',sandbox);},tick(seconds){for(let i=0;i<seconds*120;i++){now+=1000/120;frame(now);}}};
}
test('UI starts, pauses, resumes and restarts without advancing while paused',()=>{
 const ui=boot();ui.el('start').emit('click');assert.equal(ui.game.status,'running');ui.tick(1);assert(ui.game.elapsed>.9);
 ui.el('pause').emit('click');const elapsed=ui.game.elapsed;ui.tick(2);assert.equal(ui.game.elapsed,elapsed);
 ui.el('resume').emit('click');ui.tick(1);assert(ui.game.elapsed>elapsed+.9);
 ui.el('pause').emit('click');ui.el('restart').emit('click');assert.equal(ui.game.status,'ready');assert.equal(ui.game.elapsed,0);
 ui.el('start').emit('click');assert.equal(ui.game.hearts,3);
});
test('jump button, keyboard and touch canvas all move the cat',()=>{
 for(const method of ['button','keyboard','touch']) {const ui=boot();ui.el('start').emit('click');
  if(method==='button')ui.el('jump').emit('click');
  if(method==='keyboard')ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('jump')});
  if(method==='touch')ui.el('scene').emit('pointerdown',{isPrimary:true,button:0,target:ui.el('canvas')});
  ui.tick(.2);assert(ui.game.y>0,method);
 }
});
test('leaving the tab or window pauses the round',()=>{
 for(const method of ['hidden','blur']) {const ui=boot();ui.el('start').emit('click');if(method==='hidden'){ui.document.hidden=true;ui.document.emit('visibilitychange');}else ui.window.emit('blur');assert.equal(ui.game.status,'paused');}
});
test('invalid or blocked local storage never prevents playing',()=>{
 for(const options of [{stored:'oops'},{stored:'null'},{stored:'[]'},{stored:'42'},{stored:'{"mode":{"toString":null,"valueOf":null}}'},{stored:'{"mode":"constructor"}'},{stored:'{"mode":"toString"}'},{blocked:true}]) {const ui=boot(options);ui.el('start').emit('click');ui.tick(1);assert.equal(ui.game.mode,'gentle');assert(Number.isFinite(ui.game.distance));}
});
test('natural collisions show a result and repeated retry resets everything',()=>{
 const ui=boot();for(let i=0;i<3;i++){ui.el(i?'again':'start').emit('click');ui.tick(30);assert.equal(ui.game.status,'finished');assert.equal(ui.el('result-card').hidden,false);assert.equal(ui.el('jump').disabled,true);}
});
test('speed selection and records stay separate from cat-outing',()=>{
 const ui=boot();ui.radios[1].emit('change');ui.el('start').emit('click');assert.equal(ui.game.mode,'normal');ui.tick(30);const record=JSON.parse(ui.stored);assert.equal(record.mode,'normal');assert.equal(typeof record.best_normal,'number');assert.equal(record.best_gentle,undefined);
});
test('space on pause stays native, repeated jump key does not queue a jump',()=>{
 const ui=boot();ui.el('start').emit('click');ui.document.emit('keydown',{code:'Space',repeat:false,target:ui.el('pause')});assert.equal(ui.game.vy,0);
 ui.document.emit('keydown',{code:'Space',repeat:true,target:ui.el('jump')});assert.equal(ui.game.vy,0);
});
