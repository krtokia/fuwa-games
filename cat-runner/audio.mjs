// Original 112 BPM pocket-sized night-walk score. No samples or network requests.
const BPM = 112;
const STEP = 60 / BPM / 2;
const melody = [76,0,79,83,81,79,76,74,72,0,76,79,78,0,74,71,
  72,76,79,0,83,81,79,76,74,0,71,74,76,0,0,0];
const bass = [48,48,45,45,53,53,55,55];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

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
  resume() { this.running = true; if (this.enabled && this.unlock()) this.schedule(); }
  pause() { this.running = false; this.silence(); }
  stop() { this.pause(); this.step = 0; }
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
    try {
      const osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, at);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain); gain.connect(this.context.destination);
      const voice = {osc, gain}; this.voices.add(voice);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete(voice); };
      osc.start(at); osc.stop(at + duration + .02);
    } catch { /* Sound is optional. Gameplay never depends on audio support. */ }
  }
  play(type, { combo = 0 } = {}) {
    if (!this.enabled || (type !== 'finish' && !this.running) || this.context?.state !== 'running') return;
    // Finishing owns music shutdown; its final chord may play after stop().
    if (type === 'finish') { this.running = false; this.silence(); }
    const now = this.context.currentTime + .005;
    if (type === 'jump') this.tone(300, now, .13, .07, 'sine', 640);
    if (type === 'boost') { this.tone(490, now, .17, .055, 'triangle', 1100); this.tone(740, now + .04, .12, .035, 'sine', 1480); }
    if (type === 'collect') { const f = hz(84 + Math.min(7, Math.max(0, combo))); this.tone(f, now, .12, .055); this.tone(f * 1.5, now + .055, .16, .035); }
    if (type === 'hit') this.tone(180, now, .2, .07, 'triangle', 65);
    if (type === 'finish') [72,76,79,84].forEach((n,i) => this.tone(hz(n), now + i * .11, .3, .045, 'triangle'));
  }
  silence() {
    if (this.timer !== null) { this.clear(this.timer); this.timer = null; }
    for (const {osc, gain} of this.voices) {
      try { gain.gain.cancelScheduledValues(this.context.currentTime); gain.gain.setValueAtTime(.0001, this.context.currentTime); osc.stop(); osc.disconnect(); gain.disconnect(); } catch {}
    }
    this.voices.clear();
  }
  dispose() { this.stop(); this.enabled = false; try { this.context?.close()?.catch?.(() => {}); } catch {} this.context = null; }
}
