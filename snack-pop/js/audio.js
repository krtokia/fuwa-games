// 효과음: 파일 없이 WebAudio 로 합성한다. 첫 터치 뒤에 켜진다(브라우저 정책).

export class Sound {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  tone(freq, { at = 0, dur = 0.12, type = 'sine', vol = 0.3, slide = 0, attack = 0.005 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ at = 0, dur = 0.2, vol = 0.3, from = 2000, to = 300, q = 1 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  play(name, n = 1) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const note = (i) => 523.25 * 2 ** (scale[Math.min(i, scale.length - 1)] / 12);
    switch (name) {
      case 'swap': this.noise({ dur: 0.12, vol: 0.12, from: 900, to: 2400, q: 2 }); break;
      case 'nope': this.tone(220, { dur: 0.1, type: 'triangle', vol: 0.2 }); this.tone(180, { at: 0.1, dur: 0.12, type: 'triangle', vol: 0.2 }); break;
      case 'pop': {
        const f = note(n - 1);
        this.tone(f, { dur: 0.14, type: 'sine', vol: 0.28, slide: 1.5 });
        this.tone(f * 2, { dur: 0.08, type: 'triangle', vol: 0.08 });
        break;
      }
      case 'land': this.tone(140, { dur: 0.06, type: 'sine', vol: 0.12, slide: 0.6 }); break;
      case 'made': [0, 4, 7, 12].forEach((s, i) => this.tone(659 * 2 ** (s / 12), { at: i * 0.05, dur: 0.18, type: 'triangle', vol: 0.18 })); break;
      case 'zap': this.noise({ dur: 0.3, vol: 0.22, from: 4000, to: 600, q: 0.8 }); this.tone(880, { dur: 0.25, type: 'sawtooth', vol: 0.05, slide: 0.4 }); break;
      case 'boom': this.noise({ dur: 0.45, vol: 0.4, from: 900, to: 60, q: 0.7 }); this.tone(90, { dur: 0.35, vol: 0.35, slide: 0.5 }); break;
      case 'ice': this.tone(1800, { dur: 0.08, type: 'triangle', vol: 0.1 }); this.tone(2400, { at: 0.03, dur: 0.08, type: 'triangle', vol: 0.08 }); break;
      case 'wood': this.noise({ dur: 0.12, vol: 0.3, from: 600, to: 200, q: 3 }); break;
      case 'twinkle': this.tone(1568, { dur: 0.15, type: 'sine', vol: 0.12 }); this.tone(2093, { at: 0.06, dur: 0.18, type: 'sine', vol: 0.1 }); break;
      case 'praise': [0, 4, 7].forEach((s, i) => this.tone(note(Math.min(n, 6)) * 2 ** (s / 12), { at: 0.08 + i * 0.06, dur: 0.2, type: 'triangle', vol: 0.14 })); break;
      case 'shuffle': for (let i = 0; i < 6; i++) this.noise({ at: i * 0.06, dur: 0.08, vol: 0.12, from: 1500 + i * 200, to: 2500, q: 3 }); break;
      case 'click': this.tone(880, { dur: 0.05, type: 'triangle', vol: 0.12 }); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(523.25 * 2 ** (s / 12), { at: i * 0.09, dur: 0.3, type: 'triangle', vol: 0.18 })); break;
      case 'star': this.tone(note(n + 3), { dur: 0.25, type: 'triangle', vol: 0.2 }); this.tone(note(n + 5), { at: 0.05, dur: 0.3, type: 'sine', vol: 0.12 }); break;
      case 'lose': [7, 4, 0, -5].forEach((s, i) => this.tone(392 * 2 ** (s / 12), { at: i * 0.16, dur: 0.3, type: 'triangle', vol: 0.16 })); break;
      default: break;
    }
  }
}
