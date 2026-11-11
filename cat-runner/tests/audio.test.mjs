import test from 'node:test';
import assert from 'node:assert/strict';
import { RunnerAudio } from '../audio.mjs';

function fixture() {
  const nodes = [], allNodes = [], buffers = [], timers = new Map(); let nextTimer = 0, creates = 0;
  const param = () => ({
    events: [],
    setValueAtTime(value, at) { this.events.push({ method: 'set', value, at }); },
    exponentialRampToValueAtTime(value, at) { this.events.push({ method: 'ramp', value, at }); },
    cancelScheduledValues(at) { this.events.push({ method: 'cancel', at }); },
  });
  const node = kind => {
    const result = { kind, connections: [], disconnects: 0,
      connect(target) { this.connections.push(target); },
      disconnect() { this.disconnects++; },
    };
    allNodes.push(result); return result;
  };
  const source = kind => {
    const result = Object.assign(node(kind), {
      frequency: param(), starts: [], stops: [], stopped: false,
      start(at) { this.starts.push(at); },
      stop(at) { this.stops.push(at); if (at === undefined) this.stopped = true; },
      end() { this.onended?.(); },
    });
    nodes.push(result); return result;
  };
  const context = {
    currentTime: 0, sampleRate: 48000, state: 'running', destination: {},
    resume() { this.state = 'running'; return Promise.resolve(); },
    close() { this.state = 'closed'; return Promise.resolve(); },
    createGain() { return Object.assign(node('gain'), { gain: param() }); },
    createOscillator() { return source('oscillator'); },
    createBufferSource() { return source('buffer'); },
    createBiquadFilter() { return Object.assign(node('filter'), { frequency: param(), Q: param() }); },
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: channel => data[channel] };
      buffers.push(buffer); return buffer;
    },
  };
  const audio = new RunnerAudio({
    contextFactory: () => { creates++; return context; },
    setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: id => timers.delete(id),
  });
  return { audio, context, nodes, allNodes, buffers, timers, get creates() { return creates; } };
}
const playing = () => { const f = fixture(); f.audio.setEnabled(true); f.audio.start(); return f; };
const hissVoice = f => [...f.audio.voices].find(voice => voice.kind === 'hit');

test('off by default: no context, effects, buffers, or music timer', () => {
  const f = fixture(); f.audio.start();
  for (const kind of ['jump', 'boost', 'collect', 'potion', 'hit', 'finish']) f.audio.play(kind);
  assert.equal(f.creates, 0); assert.equal(f.timers.size, 0); assert.equal(f.nodes.length, 0); assert.equal(f.buffers.length, 0);
});
test('restart and repeated resume keep exactly one music loop', () => {
  const f = playing(); f.audio.resume(); assert.equal(f.timers.size, 1);
  const old = [...f.nodes]; f.audio.start(); assert.equal(f.timers.size, 1); assert.ok(old.every(n => n.stopped));
  f.audio.dispose(); assert.equal(f.timers.size, 0);
});
test('pause and disable immediately stop all scheduled voices', () => {
  const f = playing(); f.audio.play('boost'); f.audio.play('hit'); f.audio.pause();
  assert.equal(f.timers.size, 0); assert.equal(f.audio.voices.size, 0); assert.ok(f.nodes.every(n => n.stopped));
  const count = f.nodes.length; f.audio.play('jump'); f.audio.play('hit'); assert.equal(f.nodes.length, count);
  f.audio.resume(); assert.equal(f.timers.size, 1); f.audio.setEnabled(false); assert.equal(f.timers.size, 0);
});
test('all effects are available and unknown effects are harmless', () => {
  const f = playing();
  for (const kind of ['jump', 'boost', 'collect', 'potion', 'hit', 'finish']) {
    const before = f.nodes.length; f.audio.play(kind, { combo: 4 }); assert.ok(f.nodes.length > before, kind);
  }
  assert.doesNotThrow(() => f.audio.play('unknown')); f.audio.dispose();
});
test('unavailable AudioContext gracefully disables sound', () => {
  for (const contextFactory of [() => null, () => { throw new Error('unavailable'); }, () => ({ state: 'closed' })]) {
    const a = new RunnerAudio({ contextFactory }); assert.equal(a.setEnabled(true), false);
    assert.doesNotThrow(() => { a.start(); a.play('jump'); a.play('hit'); a.pause(); a.resume(); a.stop(); a.dispose(); });
  }
});
test('suspended context is only resumed by an explicit call, not tick or collision', () => {
  const f = playing(); f.context.state = 'suspended'; const count = f.nodes.length;
  f.audio.tick(); f.audio.play('hit'); assert.equal(f.context.state, 'suspended'); assert.equal(f.nodes.length, count);
  f.audio.resume(); assert.equal(f.context.state, 'running'); f.audio.play('hit'); assert.ok(hissVoice(f)); f.audio.dispose();
});
test('rejected resume disables sound and cleans active sources', async () => {
  const f = playing(); f.audio.play('hit'); f.context.state = 'suspended';
  f.context.resume = () => Promise.reject(new Error('not permitted'));
  f.audio.resume(); await Promise.resolve();
  assert.equal(f.audio.enabled, false); assert.equal(f.timers.size, 0); assert.equal(f.audio.voices.size, 0);
  assert.ok(f.nodes.every(n => n.stopped)); f.audio.dispose();
});
test('timer throttling does not replay a large note backlog', () => {
  const f = playing(); f.context.currentTime = 100; const before = f.nodes.length;
  f.audio.tick(); assert.ok(f.nodes.length - before <= 3); f.audio.dispose();
});
test('finish shuts down music and works after stop without restarting its loop', () => {
  const f = playing(); f.audio.stop(); f.audio.play('finish');
  assert.equal(f.timers.size, 0); assert.equal(f.audio.running, false); assert.equal(f.audio.voices.size, 4);
  f.audio.pause(); assert.equal(f.audio.voices.size, 0); f.audio.start(); assert.equal(f.timers.size, 1);
  f.audio.start(); assert.equal(f.timers.size, 1); f.audio.dispose();
});
test('collision is a short synthesized mono hiss through soft filters, not the old pitched hit', () => {
  const f = playing(); const before = f.nodes.length; f.audio.play('hit'); const voice = hissVoice(f);
  assert.ok(voice); assert.equal(f.nodes.length, before + 1); assert.equal(voice.source.kind, 'buffer');
  assert.equal(f.buffers.length, 1);
  const buffer = f.buffers[0], samples = buffer.getChannelData(0);
  assert.equal(buffer.numberOfChannels, 1); assert.equal(buffer.sampleRate, f.context.sampleRate);
  assert.ok(buffer.duration >= .25 && buffer.duration <= .4);
  assert.ok(samples.some(value => value > .1)); assert.ok(samples.some(value => value < -.1));
  assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  assert.ok(Math.abs(samples.reduce((sum, sample) => sum + sample, 0) / samples.length) < .02);
  const [source, breath, soften, gain] = voice.nodes;
  assert.deepEqual(source.connections, [breath]); assert.deepEqual(breath.connections, [soften]);
  assert.deepEqual(soften.connections, [gain]); assert.deepEqual(gain.connections, [f.context.destination]);
  assert.equal(breath.type, 'bandpass'); assert.equal(soften.type, 'lowpass');
  assert.ok(breath.frequency.events[1].value < breath.frequency.events[0].value);
  assert.ok(soften.frequency.events[0].value <= 4000);
  assert.ok(breath.Q.events[0].value <= 1 && soften.Q.events[0].value <= 1);
  const envelope = gain.gain.events;
  assert.equal(envelope[0].value, .0001); assert.equal(envelope.at(-1).value, .0001);
  assert.ok(envelope[1].at - envelope[0].at >= .01);
  assert.ok(envelope.every(event => event.value > 0 && event.value <= .08));
  assert.equal(source.starts.length, 1); assert.equal(source.stops.length, 1); assert.equal(source.stopped, false);
  assert.ok(source.stops[0] - source.starts[0] >= .25 && source.stops[0] - source.starts[0] <= .4);
  f.audio.dispose();
});
test('burst collisions never layer hisses; later collisions reuse one noise buffer', () => {
  const f = playing(); f.audio.play('hit'); const first = hissVoice(f);
  const count = f.nodes.length;
  for (let i = 0; i < 100; i++) f.audio.play('hit');
  f.context.currentTime = .2; f.audio.play('hit'); assert.equal(f.nodes.length, count);
  assert.equal([...f.audio.voices].filter(voice => voice.kind === 'hit').length, 1);
  f.context.currentTime = .4; f.audio.play('hit'); const second = hissVoice(f);
  assert.notEqual(second, first); assert.equal(first.source.stopped, true);
  assert.ok(first.nodes.every(node => node.disconnects === 1)); assert.equal(f.buffers.length, 1);
  assert.equal(second.source.buffer, first.source.buffer); f.audio.dispose();
});
test('natural hiss completion disconnects source, both filters and gain', () => {
  const f = playing(); f.audio.play('hit'); const voice = hissVoice(f), before = f.audio.voices.size;
  voice.source.end(); assert.equal(f.audio.voices.size, before - 1); assert.equal(hissVoice(f), undefined);
  assert.ok(voice.nodes.every(node => node.disconnects === 1)); assert.equal(voice.source.onended, null);
  f.audio.dispose(); assert.ok(voice.nodes.every(node => node.disconnects === 1));
});
test('fatal stop preserves only the scheduled hiss and stops music without a new loop', () => {
  const f = playing(); f.audio.play('jump'); f.audio.play('collect'); f.audio.play('hit'); const hit = hissVoice(f);
  f.audio.stop({ preserveHit: true });
  assert.equal(f.audio.running, false); assert.equal(f.audio.step, 0); assert.equal(f.timers.size, 0);
  assert.deepEqual([...f.audio.voices], [hit]); assert.equal(hit.source.stopped, false);
  assert.ok(hit.nodes.every(node => node.disconnects === 0));
  assert.ok(f.nodes.filter(node => node !== hit.source).every(node => node.stopped));
  const count = f.nodes.length; f.audio.tick(); f.audio.play('hit'); assert.equal(f.nodes.length, count);
  assert.ok(hit.source.stops[0] <= f.context.currentTime + .4);
  f.context.currentTime = hit.source.stops[0]; hit.source.end();
  assert.equal(f.audio.voices.size, 0); assert.equal(f.timers.size, 0); f.audio.dispose();
});
test('fatal stop does not preserve an expired hiss with delayed onended', () => {
  const f = playing(); f.audio.play('hit'); const voice = hissVoice(f); f.context.currentTime = .5;
  f.audio.stop({ preserveHit: true }); assert.equal(f.audio.voices.size, 0); assert.equal(voice.source.stopped, true);
  assert.ok(voice.nodes.every(node => node.disconnects === 1)); f.audio.dispose();
});
for (const action of ['pause', 'stop', 'mute', 'start', 'dispose']) test(`${action} cancels even a preserved fatal hiss and releases its entire graph`, () => {
  const f = playing(); f.audio.play('hit'); const voice = hissVoice(f); f.audio.stop({ preserveHit: true });
  if (action === 'mute') f.audio.setEnabled(false); else f.audio[action]();
  assert.equal(voice.source.stopped, true); assert.ok(voice.nodes.every(node => node.disconnects === 1));
  assert.equal(hissVoice(f), undefined); assert.equal(f.timers.size, action === 'start' ? 1 : 0);
  const envelope = voice.gain.gain.events;
  assert.equal(envelope.at(-2).method, 'cancel'); assert.equal(envelope.at(-1).value, .0001);
  f.audio.dispose(); assert.equal(f.audio.noiseBuffer, null);
});
test('finish chord replaces any lingering collision hiss', () => {
  const f = playing(); f.audio.play('hit'); const voice = hissVoice(f); f.audio.play('finish');
  assert.equal(hissVoice(f), undefined); assert.equal(voice.source.stopped, true);
  assert.equal(f.audio.voices.size, 4); assert.equal(f.timers.size, 0); f.audio.dispose();
});
test('missing noise or filter support never breaks gameplay and cleans partial sources', () => {
  for (const method of ['createBuffer', 'createBufferSource', 'createBiquadFilter', 'createGain']) {
    const f = playing(); const oldNodes = f.allNodes.length;
    f.context[method] = () => { throw new Error('unsupported'); };
    assert.doesNotThrow(() => f.audio.play('hit')); assert.equal(hissVoice(f), undefined);
    const partial = f.allNodes.slice(oldNodes);
    assert.ok(partial.every(node => node.disconnects === 1));
    assert.ok(partial.filter(node => node.kind === 'buffer').every(node => node.stopped));
    assert.doesNotThrow(() => f.audio.dispose()); assert.equal(f.audio.voices.size, 0);
  }
});
test('cleanup still disconnects remaining nodes when a source stop or filter disconnect throws', () => {
  const f = playing(); f.audio.play('hit'); const voice = hissVoice(f);
  voice.source.stop = () => { throw new Error('already stopped'); };
  voice.nodes[1].disconnect = () => { throw new Error('disconnect unavailable'); };
  assert.doesNotThrow(() => f.audio.stop()); assert.equal(f.audio.voices.size, 0);
  assert.equal(voice.source.disconnects, 1); assert.equal(voice.nodes[2].disconnects, 1); assert.equal(voice.gain.disconnects, 1);
  assert.equal(voice.source.onended, null); f.audio.dispose();
});


test('hit-stop pause keeps only hiss and resumes melody position without unlocking',()=>{
 const f=playing();f.audio.play('hit');const voice=hissVoice(f),step=f.audio.step;
 f.audio.pause({preserveHit:true});assert.equal(f.audio.running,false);assert.equal(f.timers.size,0);
 assert.equal(f.audio.voices.size,1);assert.equal(hissVoice(f),voice);assert.equal(f.audio.step,step);
 f.audio.resume({fromGesture:false});assert.equal(f.audio.running,true);assert.equal(f.timers.size,1);
 assert(f.audio.step>=step);f.audio.pause();assert.equal(f.audio.voices.size,0);
 f.context.state='suspended';f.audio.resume({fromGesture:false});
 assert.equal(f.context.state,'suspended');assert.equal(f.timers.size,0);
 f.audio.resume();assert.equal(f.context.state,'running');assert.equal(f.timers.size,1);f.audio.dispose();
});


test('time potion has a distinct three-note rise, separate from a two-note snack', () => {
  const f = playing(), before = f.nodes.length;
  f.audio.play('potion'); const potion = f.nodes.slice(before);
  assert.equal(potion.length, 3); assert.ok(potion.every(n => n.kind === 'oscillator' && n.type === 'sine'));
  assert.ok(potion[0].starts[0] >= f.context.currentTime);
  potion.forEach((n, i) => assert.ok(Math.abs(n.starts[0] - potion[0].starts[0] - i * .07) < 1e-12));
  const frequencies = potion.map(n => n.frequency.events[0].value);
  assert.ok(frequencies[0] < frequencies[1] && frequencies[1] < frequencies[2]);
  const next = f.nodes.length; f.audio.play('collect'); assert.equal(f.nodes.length - next, 2);
  f.audio.pause(); assert.ok(potion.every(n => n.stopped)); f.audio.dispose();
});
