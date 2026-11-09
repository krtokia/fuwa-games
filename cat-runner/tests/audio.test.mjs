import test from 'node:test';
import assert from 'node:assert/strict';
import { RunnerAudio } from '../audio.mjs';
function fixture() {
  const nodes = [], timers = new Map(); let nextTimer = 0, creates = 0;
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const context = {currentTime:0,state:'running',destination:{},
    resume(){this.state='running'; return Promise.resolve();}, close(){this.state='closed'; return Promise.resolve();},
    createGain(){return {gain:param(),connect(){},disconnect(){}};},
    createOscillator(){const node={frequency:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};nodes.push(node);return node;}};
  const audio = new RunnerAudio({contextFactory:()=>{creates++;return context;},setInterval:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearInterval:id=>timers.delete(id)});
  return {audio,context,nodes,timers,get creates(){return creates;}};
}
test('off by default: no context, sounds, or music timer',()=>{const f=fixture();f.audio.start();f.audio.play('jump');assert.equal(f.creates,0);assert.equal(f.timers.size,0);});
test('restart and repeated resume keep exactly one music loop',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();f.audio.resume();assert.equal(f.timers.size,1);const old=[...f.nodes];f.audio.start();assert.equal(f.timers.size,1);assert.ok(old.every(n=>n.stopped));f.audio.dispose();assert.equal(f.timers.size,0);});
test('pause and disable immediately stop all scheduled voices',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();f.audio.play('boost');f.audio.pause();assert.equal(f.timers.size,0);assert.equal(f.audio.voices.size,0);assert.ok(f.nodes.every(n=>n.stopped));const count=f.nodes.length;f.audio.play('jump');assert.equal(f.nodes.length,count);f.audio.resume();assert.equal(f.timers.size,1);f.audio.setEnabled(false);assert.equal(f.timers.size,0);});
test('all effects are available and unknown effects are harmless',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();for(const kind of ['jump','boost','collect','hit','finish']){const before=f.nodes.length;f.audio.play(kind,{combo:4});assert.ok(f.nodes.length>before,kind);}assert.doesNotThrow(()=>f.audio.play('unknown'));f.audio.dispose();});
test('unavailable AudioContext gracefully disables sound',()=>{const a=new RunnerAudio({contextFactory:()=>null});assert.equal(a.setEnabled(true),false);assert.doesNotThrow(()=>{a.start();a.play('jump');a.pause();a.resume();a.stop();a.dispose();});});
test('suspended context is only resumed by an explicit call, not tick',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();f.context.state='suspended';const count=f.nodes.length;f.audio.tick();assert.equal(f.context.state,'suspended');assert.equal(f.nodes.length,count);f.audio.resume();assert.equal(f.context.state,'running');f.audio.dispose();});
test('timer throttling does not replay a large note backlog',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();f.context.currentTime=100;const before=f.nodes.length;f.audio.tick();assert.ok(f.nodes.length-before<=3);f.audio.dispose();});
test('finish shuts down music and works after stop without restarting its loop',()=>{const f=fixture();f.audio.setEnabled(true);f.audio.start();f.audio.stop();f.audio.play('finish');assert.equal(f.timers.size,0);assert.equal(f.audio.running,false);assert.equal(f.audio.voices.size,4);f.audio.pause();assert.equal(f.audio.voices.size,0);f.audio.start();assert.equal(f.timers.size,1);f.audio.start();assert.equal(f.timers.size,1);f.audio.dispose();});
