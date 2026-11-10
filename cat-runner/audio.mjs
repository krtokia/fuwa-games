// Original 112 BPM pocket-sized night-walk score. No samples or network requests.
const BPM = 112;
const STEP = 60 / BPM / 2;
const melody = [76,0,79,83,81,79,76,74,72,0,76,79,78,0,74,71,
  72,76,79,0,83,81,79,76,74,0,71,74,76,0,0,0];
const bass = [48,48,45,45,53,53,55,55];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const HISS_SECONDS = .32;

export class RunnerAudio {
  constructor({ contextFactory, setInterval: interval, clearInterval: clear } = {}) {
    this.contextFactory = contextFactory || (() => {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Audio ? new Audio() : null;
    });
    this.interval = interval || globalThis.setInterval.bind(globalThis);
    this.clear = clear || globalThis.clearInterval.bind(globalThis);
    this.enabled = false; this.running = false; this.context = null;
    this.timer = null; this.voices = new Set(); this.step = 0; this.next = 0;
    this.noiseBuffer = null;
  }
  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) { this.silence(); return false; }
    if (!this.unlock()) { this.enabled = false; return false; }
    if (this.running) this.schedule();
    return true;
  }
  // Call enabling/start/resume from the user's gesture. Never auto-unlock on a timer.
  unlock() {
    try {
      this.context ??= this.contextFactory();
      if (!this.context || this.context.state === 'closed') return false;
      if (this.context.state === 'suspended') {
        const pending = this.context.resume();
        pending?.catch(() => { this.enabled = false; this.silence(); });
      }
      return true;
    } catch { return false; }
  }
  start() { this.silence(); this.step = 0; this.running = true; if (this.enabled && this.unlock()) this.schedule(); }
  resume({ fromGesture = true } = {}) { this.running = true; if (this.enabled && (fromGesture ? this.unlock() : this.context?.state === 'running')) this.schedule(); }
  pause({ preserveHit = false } = {}) { this.running = false; this.silence({ preserveHit }); }
  // A fatal collision may finish its brief hiss, but never the music/other effects.
  // Pause, mute, restart and dispose always silence everything immediately.
  stop({ preserveHit = false } = {}) { this.running = false; this.silence({ preserveHit }); this.step = 0; }
  schedule() {
    if (this.timer !== null || !this.context) return;
    this.next = this.context.currentTime + .03;
    this.tick();
    this.timer = this.interval(() => this.tick(), 50);
  }
  tick() {
    if (!this.enabled || !this.running || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    // Discard a stale backlog if the browser throttled its timers.
    if (this.next < now - .2) this.next = now + .02;
    while (this.next < now + .12) {
      const note = melody[this.step % melody.length];
      if (note) this.tone(hz(note), this.next, STEP * .65, .027, 'triangle');
      if (this.step % 4 === 0) this.tone(hz(bass[Math.floor(this.step / 4) % bass.length]), this.next, STEP * 2.4, .042, 'sine');
      if (this.step % 2 === 0) this.tone(150, this.next, .045, .018, 'triangle', 55);
      this.next += STEP; this.step++;
    }
  }
  tone(frequency, at, duration, volume, type = 'sine', endFrequency) {
    if (!this.context || !this.enabled) return;
    const voice = { source: null, gain: null, nodes: [] };
    try {
      const osc = voice.source = this.context.createOscillator(); voice.nodes.push(osc);
      const gain = voice.gain = this.context.createGain(); voice.nodes.push(gain);
      osc.type = type; osc.frequency.setValueAtTime(frequency, at);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain); gain.connect(this.context.destination);
      this.voices.add(voice);
      osc.onended = () => this.releaseVoice(voice);
      osc.start(at); osc.stop(at + duration + .02);
    } catch { this.releaseVoice(voice, true); /* Sound support is optional. */ }
  }
  hiss(at) {
    // Bound repeated collisions to one quiet voice, including a delayed onended.
    for (const voice of this.voices) if (voice.kind === 'hit') {
      if (voice.endsAt > at) return;
      this.releaseVoice(voice, true);
    }
    const voice = { source: null, gain: null, nodes: [], kind: 'hit', endsAt: at + HISS_SECONDS };
    try {
      if (!this.noiseBuffer) {
        const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * HISS_SECONDS), this.context.sampleRate);
        const samples = buffer.getChannelData(0);
        // A locally synthesized breath, not a cat recording or an external sample.
        // Fixed noise is cached once; its level is shaped by the filters/envelope.
        let seed = 0x4f55;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = seed / 0x80000000 - 1;
        }
        this.noiseBuffer = buffer;
      }
      const source = voice.source = this.context.createBufferSource(); voice.nodes.push(source);
      const breath = this.context.createBiquadFilter(); voice.nodes.push(breath);
      const soften = this.context.createBiquadFilter(); voice.nodes.push(soften);
      const gain = voice.gain = this.context.createGain(); voice.nodes.push(gain);
      source.buffer = this.noiseBuffer;
      breath.type = 'bandpass'; breath.Q.setValueAtTime(.65, at);
      breath.frequency.setValueAtTime(1900, at);
      breath.frequency.exponentialRampToValueAtTime(1200, at + HISS_SECONDS);
      soften.type = 'lowpass'; soften.frequency.setValueAtTime(3600, at); soften.Q.setValueAtTime(.5, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.075, at + .018);
      gain.gain.exponentialRampToValueAtTime(.05, at + .10);
      gain.gain.exponentialRampToValueAtTime(.0001, at + HISS_SECONDS);
      source.connect(breath); breath.connect(soften); soften.connect(gain); gain.connect(this.context.destination);
      this.voices.add(voice);
      source.onended = () => this.releaseVoice(voice);
      source.start(at); source.stop(voice.endsAt);
    } catch { this.releaseVoice(voice, true); /* No noise support must not affect play. */ }
  }
  releaseVoice(voice, stop = false) {
    // A failed stop/disconnect must not prevent the remaining nodes being freed.
    if (voice.source) voice.source.onended = null;
    if (stop) {
      try { voice.gain?.gain.cancelScheduledValues(this.context.currentTime); voice.gain?.gain.setValueAtTime(.0001, this.context.currentTime); } catch {}
      try { voice.source?.stop(); } catch {}
    }
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
    this.voices.delete(voice);
  }
  play(type, { combo = 0 } = {}) {
    if (!this.enabled || (type !== 'finish' && !this.running) || this.context?.state !== 'running') return;
    // Finishing owns music shutdown; its final chord may play after stop().
    if (type === 'finish') { this.running = false; this.silence(); }
    const now = this.context.currentTime + .005;
    if (type === 'jump') this.tone(300, now, .13, .07, 'sine', 640);
    if (type === 'boost') { this.tone(490, now, .17, .055, 'triangle', 1100); this.tone(740, now + .04, .12, .035, 'sine', 1480); }
    if (type === 'collect') { const f = hz(84 + Math.min(7, Math.max(0, combo))); this.tone(f, now, .12, .055); this.tone(f * 1.5, now + .055, .16, .035); }
    if (type === 'hit') this.hiss(now);
    if (type === 'finish') [72,76,79,84].forEach((n,i) => this.tone(hz(n), now + i * .11, .3, .045, 'triangle'));
  }
  silence({ preserveHit = false } = {}) {
    if (this.timer !== null) { this.clear(this.timer); this.timer = null; }
    for (const voice of this.voices) {
      if (preserveHit && voice.kind === 'hit' && voice.endsAt > this.context.currentTime) continue;
      this.releaseVoice(voice, true);
    }
  }
  dispose() { this.stop(); this.enabled = false; try { this.context?.close()?.catch?.(() => {}); } catch {} this.context = null; this.noiseBuffer = null; }
}
