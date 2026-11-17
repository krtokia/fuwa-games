// 판 그리기 + 연출. 엔진이 돌려준 단계(step)를 차례로 애니메이션한다.

import { Tweens, ease } from './tween.js';
import { KINDS } from './sprites.js';

const PRAISE = ['', '', '좋아요!', '멋져요!', '대단해요!', '최고예요!', '환상적이에요!'];
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class View {
  constructor(canvas, sprites, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.sound = sound;
    this.tw = new Tweens();
    this.pieces = new Map();
    this.particles = [];
    this.effects = [];
    this.texts = [];
    this.shake = 0;
    this.selected = null;
    this.hint = null;
    this.hintT = 0;
    this.last = performance.now();
    this.running = false;
    this.layout = { cs: 40, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
    this.bg = null;
    new ResizeObserver(() => this.resize()).observe(canvas);
    sprites.ready.then(() => { this.bg = null; });
    // 라이트/다크가 바뀌면 판 배경(색 토큰)을 다시 그린다
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { this.bg = null; });
  }

  // ---------- 준비 ----------

  setState(s) {
    this.rows = s.rows; this.cols = s.cols;
    this.mask = s.mask.map((r) => r.slice());
    this.ice = s.ice.map((r) => r.slice());
    this.box = s.box.map((r) => r.slice());
    this.pieces.clear();
    this.particles = []; this.effects = []; this.texts = [];
    this.selected = null; this.hint = null;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const p = s.cells[r][c];
      if (p) this.addPiece(p.id, p.kind, p.special, r, c);
    }
    this.bg = null;
    this.resize();
    this.start();
  }

  addPiece(id, kind, special, r, c, extra = {}) {
    const sp = { id, kind, special, x: c, y: r, s: 1, a: 1, rot: 0, glow: 0, ...extra };
    this.pieces.set(id, sp);
    return sp;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !this.rows) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const pad = Math.max(6, rect.width * 0.03);
    const cs = Math.min((rect.width - pad * 2) / this.cols, (rect.height - pad * 2) / this.rows);
    this.layout = {
      cs, dpr, w: rect.width, h: rect.height,
      ox: (rect.width - cs * this.cols) / 2,
      oy: (rect.height - cs * this.rows) / 2,
    };
    this.sprites.setSize(cs * dpr);
    this.bg = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(50, now - this.last);
      this.last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  stop() { this.running = false; }

  // 화면 좌표 → 칸
  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const { cs, ox, oy } = this.layout;
    const c = Math.floor((clientX - rect.left - ox) / cs);
    const r = Math.floor((clientY - rect.top - oy) / cs);
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
    return [r, c];
  }

  get cellSize() { return this.layout.cs; }

  pieceAt(r, c) {
    for (const p of this.pieces.values()) if (Math.round(p.y) === r && Math.round(p.x) === c && !p.dying) return p;
    return null;
  }

  setSelected(cell) { this.selected = cell; }
  setHint(pair) { this.hint = pair; this.hintT = 0; }

  // ---------- 단계 연출 ----------

  async play(steps, onStep) {
    for (const step of steps) {
      if (onStep) onStep(step, 'start');
      if (step.type === 'swap') await this.animSwap(step);
      else if (step.type === 'swapBack') await this.animSwapBack(step);
      else if (step.type === 'clear') await this.animClear(step);
      else if (step.type === 'fall') await this.animFall(step);
      else if (step.type === 'convert') await this.animConvert(step);
      else if (step.type === 'shuffle') await this.animShuffle(step);
      else if (step.type === 'gift') await this.animGift(step);
      if (onStep) onStep(step, 'end');
    }
  }

  animSwap(step) {
    const [pa, pb] = step.ids.map((id) => this.pieces.get(id));
    this.sound.play('swap');
    return Promise.all([
      this.tw.to(pa, { x: step.b[1], y: step.b[0] }, 190, ease.inOutQuad),
      this.tw.to(pb, { x: step.a[1], y: step.a[0] }, 190, ease.inOutQuad),
    ]);
  }

  async animSwapBack(step) {
    const [pa, pb] = step.ids.map((id) => this.pieces.get(id));
    this.sound.play('nope');
    await Promise.all([
      this.tw.to(pa, { x: step.a[1], y: step.a[0] }, 210, ease.outBack),
      this.tw.to(pb, { x: step.b[1], y: step.b[0] }, 210, ease.outBack),
    ]);
  }

  async animClear(step) {
    const big = step.blasts.some((b) => b.type === 'area' || b.type === 'all' || b.type === 'color');
    // 특수 효과 먼저
    for (const b of step.blasts) this.blastEffect(b);
    if (step.blasts.length) this.sound.play(big ? 'boom' : 'zap');
    if (big && !reduceMotion()) this.shake = Math.max(this.shake, step.blasts.some((b) => b.type === 'all') ? 16 : 9);

    const origin = step.blasts[0];
    const delayOf = (r, c) => (origin ? Math.min(320, (Math.abs(r - origin.r) + Math.abs(c - origin.c)) * 28) : 0);

    // 특수가 생기는 자리로 빨려 들어가는 조각
    const merging = new Set();
    const jobs = [];
    for (const cr of step.created) {
      for (const id of cr.from) {
        merging.add(id);
        const sp = this.pieces.get(id);
        if (!sp) continue;
        sp.dying = true;
        jobs.push(this.tw.to(sp, { x: cr.c, y: cr.r, s: 0.6 }, 160, ease.inQuad).then(() => { sp.a = 0; this.pieces.delete(id); }));
      }
    }

    this.sound.play('pop', step.combo);
    for (const cl of step.cleared) {
      const sp = this.pieces.get(cl.id);
      if (!sp || merging.has(cl.id)) continue;
      sp.dying = true;
      const d = delayOf(cl.r, cl.c);
      jobs.push((async () => {
        await this.tw.to(sp, { s: 1.22 }, 80, ease.outQuad, d);
        this.burst(cl.c, cl.r, cl.kind, cl.special ? 18 : 9);
        await this.tw.to(sp, { s: 0, a: 0 }, 140, ease.inQuad);
        this.pieces.delete(cl.id);
      })());
    }
    for (const ic of step.ice) {
      jobs.push(this.tw.wait(delayOf(ic.r, ic.c) + 60).then(() => {
        this.ice[ic.r][ic.c] = ic.left; this.shards(ic.c, ic.r, '#d8f1ff'); this.sound.play('ice');
      }));
    }
    for (const bx of step.boxes) {
      jobs.push(this.tw.wait(delayOf(bx.r, bx.c) + 60).then(() => {
        this.box[bx.r][bx.c] = bx.left; this.shards(bx.c, bx.r, '#c98a45'); this.sound.play('wood');
      }));
    }

    // 점수 글자
    if (step.cleared.length) {
      const cx = step.cleared.reduce((t, x) => t + x.c, 0) / step.cleared.length;
      const cy = step.cleared.reduce((t, x) => t + x.r, 0) / step.cleared.length;
      const kind = step.cleared[0].kind;
      this.floatText(`+${step.score}`, cx, cy, kind >= 0 ? KINDS[kind].color : '#f2b01e', 0.55);
    }
    if (step.combo >= 2) {
      const word = PRAISE[Math.min(step.combo, PRAISE.length - 1)];
      this.bigText(word);
      this.sound.play('praise', step.combo);
    }

    await Promise.all(jobs);

    for (const cr of step.created) {
      let sp = this.pieces.get(cr.id);
      if (!sp) sp = this.addPiece(cr.id, cr.kind, cr.special, cr.r, cr.c, { s: 0 });
      sp.kind = cr.kind; sp.special = cr.special; sp.dying = false;
      sp.x = cr.c; sp.y = cr.r; sp.a = 1;
      sp.s = 0.3;
      this.sparkle(cr.c, cr.r);
    }
    if (step.created.length) {
      this.sound.play('made');
      await Promise.all(step.created.map((cr) => this.tw.to(this.pieces.get(cr.id), { s: 1 }, 260, ease.outBack)));
    }
  }

  async animFall(step) {
    const jobs = [];
    for (const m of step.moves) {
      const sp = this.pieces.get(m.id);
      if (!sp) continue;
      const dist = m.to[0] - sp.y;
      jobs.push(this.tw.to(sp, { y: m.to[0], x: m.to[1] }, 120 + Math.sqrt(Math.abs(dist)) * 95, ease.land));
    }
    for (const sp of step.spawns) {
      const p = this.addPiece(sp.id, sp.kind, sp.special, sp.fromRow, sp.to[1], { a: 0 });
      const dist = sp.to[0] - sp.fromRow;
      jobs.push(this.tw.to(p, { a: 1 }, 90));
      jobs.push(this.tw.to(p, { y: sp.to[0] }, 120 + Math.sqrt(dist) * 95, ease.land));
    }
    if (jobs.length) {
      await Promise.all(jobs);
      this.sound.play('land');
    }
  }

  async animConvert(step) {
    if (step.bonus) this.sound.play('twinkle');
    const per = step.bonus ? 0 : 35;
    await Promise.all(step.cells.map((cl, i) => this.tw.wait(i * per).then(async () => {
      const sp = this.pieces.get(cl.id);
      if (!sp) return;
      sp.special = cl.special;
      sp.s = 1.35;
      this.sparkle(cl.c, cl.r);
      if (!step.bonus && i % 3 === 0) this.sound.play('twinkle');
      await this.tw.to(sp, { s: 1 }, 220, ease.outBack);
    })));
    if (step.bonus) await this.tw.wait(110);
  }

  // 구경 고양이가 오른쪽 위에서 선물을 던져 넣는다
  async animGift(step) {
    const target = this.pieces.get(step.id);
    if (!target) return;
    this.sound.play('throw');
    const fly = this.addPiece(`gift-${step.id}`, step.kind, step.special, -0.6, this.cols + 0.3, { s: 0.7, rot: 0, glow: 1 });
    await Promise.all([
      this.tw.to(fly, { x: step.c }, 620, ease.outQuad),
      this.tw.to(fly, { y: step.r }, 620, ease.inQuad),
      this.tw.to(fly, { rot: Math.PI * 4, s: 1.1 }, 620, ease.linear),
    ]);
    this.pieces.delete(fly.id);
    target.kind = step.kind;
    target.special = step.special;
    target.s = 1.45;
    this.sparkle(step.c, step.r);
    this.burst(step.c, step.r, step.kind, 14);
    this.sound.play('made');
    await this.tw.to(target, { s: 1 }, 300, ease.outBack);
  }

  async animShuffle(step) {
    this.bigText('섞을게요!');
    this.sound.play('shuffle');
    const cx = (this.cols - 1) / 2, cy = (this.rows - 1) / 2;
    await Promise.all([...this.pieces.values()].map((sp) => this.tw.to(sp, { x: cx, y: cy, s: 0.6 }, 320, ease.inQuad)));
    for (const p of step.pieces) {
      const sp = this.pieces.get(p.id);
      if (sp) sp.kind = p.kind;
    }
    await Promise.all(step.pieces.map((p) => {
      const sp = this.pieces.get(p.id);
      return sp ? this.tw.to(sp, { x: p.to[1], y: p.to[0], s: 1 }, 420, ease.outBack) : null;
    }));
  }

  // ---------- 효과 ----------

  blastEffect(b) {
    const e = { ...b, t: 0, dur: b.type === 'color' ? 520 : b.type === 'all' ? 700 : 420 };
    if (b.type === 'color') {
      e.bolts = (b.targets || []).map(([r, c]) => ({ r, c, seed: Math.random() * 1000 }));
    }
    this.effects.push(e);
  }

  burst(x, y, kind, n) {
    if (reduceMotion()) n = Math.ceil(n / 3);
    const color = kind >= 0 ? KINDS[kind].color : '#ffd75e';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.0025 + Math.random() * 0.004;
      this.particles.push({
        x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.002,
        life: 0, max: 480 + Math.random() * 320, size: 0.07 + Math.random() * 0.08,
        color: i % 4 === 0 ? '#ffffff' : color, star: i % 3 === 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02,
      });
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * 0.004, vy: Math.sin(a) * 0.004, g: 0,
        life: 0, max: 420, size: 0.1, color: '#fff7c2', star: true, rot: a, vr: 0.01,
      });
    }
  }

  shards(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 0.003 + Math.random() * 0.003;
      this.particles.push({
        x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 600, size: 0.09 + Math.random() * 0.06, color, shard: true, rot: Math.random() * 6, vr: 0.02,
      });
    }
  }

  floatText(text, x, y, color, size) {
    this.texts.push({ text, x: x + 0.5, y: y + 0.5, t: 0, dur: 900, color, size, rise: 0.8 });
  }

  bigText(text) {
    this.texts = this.texts.filter((t) => !t.big);
    this.texts.push({ text, x: this.cols / 2, y: this.rows / 2, t: 0, dur: 1100, color: '#ffffff', size: 1.15, big: true, rise: 0.3 });
  }

  // ---------- 매 프레임 ----------

  update(dt) {
    this.tw.update(dt);
    this.hintT += dt;
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.g ?? 0.000012) * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.dur);
    this.shake = Math.max(0, this.shake - dt * 0.04);
  }

  boardBackground() {
    const { cs, dpr } = this.layout;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(cs * this.cols * dpr) + 2;
    cv.height = Math.ceil(cs * this.rows * dpr) + 2;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const style = getComputedStyle(this.canvas);
    const frame = style.getPropertyValue('--board-frame').trim() || 'rgba(90,50,40,.35)';
    const cellA = style.getPropertyValue('--cell-a').trim() || '#fff8ee';
    const cellB = style.getPropertyValue('--cell-b').trim() || '#fbeedd';
    const pad = cs * 0.08;
    g.fillStyle = frame;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (!this.mask[r][c]) continue;
      roundRect(g, c * cs - pad, r * cs - pad, cs + pad * 2, cs + pad * 2, cs * 0.22);
      g.fill();
    }
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (!this.mask[r][c]) continue;
      g.fillStyle = (r + c) % 2 ? cellB : cellA;
      roundRect(g, c * cs + cs * 0.03, r * cs + cs * 0.03, cs * 0.94, cs * 0.94, cs * 0.16);
      g.fill();
    }
    return cv;
  }

  draw() {
    const { ctx } = this;
    const { cs, ox, oy, dpr } = this.layout;
    if (!this.rows) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, (ox + sx) * dpr, (oy + sy) * dpr);

    if (!this.bg) this.bg = this.boardBackground();
    ctx.drawImage(this.bg, 0, 0, this.bg.width / dpr, this.bg.height / dpr);

    // 얼음(조각 아래)
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const n = this.ice[r][c];
      if (n > 0) ctx.drawImage(this.sprites.ice(n, Math.round(cs * dpr)), c * cs, r * cs, cs, cs);
    }

    // 선택·힌트 빛
    const ring = (r, c, color, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      roundRect(ctx, c * cs + cs * 0.04, r * cs + cs * 0.04, cs * 0.92, cs * 0.92, cs * 0.18);
      ctx.fill();
      ctx.restore();
    };
    if (this.selected) ring(this.selected[0], this.selected[1], '#ffe066', 0.75);
    const hinting = this.hint && this.hintT > 0;
    if (hinting) {
      const a = 0.35 + 0.3 * Math.sin(this.hintT / 160);
      for (const [r, c] of this.hint) ring(r, c, '#ffffff', a);
    }

    // 조각: 판 위쪽(새로 떨어지는 조각 들어오는 곳)만 잘라낸다
    ctx.save();
    ctx.beginPath();
    ctx.rect(-cs, 0, cs * (this.cols + 2), cs * (this.rows + 2));
    ctx.clip();
    const now = performance.now();
    const size = Math.round(cs * dpr);
    for (const sp of this.pieces.values()) {
      if (sp.a <= 0.01 || sp.s <= 0.01) continue;
      const img = this.sprites.piece(sp.kind, sp.special, size);
      let s = sp.s;
      let rot = sp.rot;
      if (sp.special && !sp.dying) s *= 1 + 0.04 * Math.sin(now / 220 + sp.id);
      if (this.selected && Math.round(sp.y) === this.selected[0] && Math.round(sp.x) === this.selected[1] && !sp.dying) {
        s *= 1.08 + 0.04 * Math.sin(now / 120);
      }
      if (hinting && this.hint.some(([r, c]) => r === Math.round(sp.y) && c === Math.round(sp.x))) {
        rot += Math.sin(this.hintT / 70) * 0.12 * Math.max(0, Math.sin(this.hintT / 500));
      }
      const x = (sp.x + 0.5) * cs, y = (sp.y + 0.5) * cs;
      ctx.save();
      ctx.globalAlpha = sp.a;
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      ctx.scale(s, s);
      if (sp.special === 'cat' && !sp.dying) {
        ctx.save();
        ctx.rotate(now / 900);
        ctx.fillStyle = 'rgba(255,215,94,.35)';
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-cs * 0.1, -cs * 0.62); ctx.lineTo(cs * 0.1, -cs * 0.62); ctx.fill();
        }
        ctx.restore();
      }
      ctx.drawImage(img, -cs / 2, -cs / 2, cs, cs);
      ctx.restore();
    }
    ctx.restore();

    // 상자(조각 위)
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const n = this.box[r][c];
      if (n > 0 && this.mask[r][c]) ctx.drawImage(this.sprites.box(n, Math.round(cs * dpr)), c * cs, r * cs, cs, cs);
    }

    this.drawEffects(ctx, cs);
    this.drawParticles(ctx, cs);
    this.drawTexts(ctx, cs);
  }

  drawEffects(ctx, cs) {
    for (const e of this.effects) {
      const p = e.t / e.dur;
      const fade = 1 - p;
      ctx.save();
      if (e.type === 'row' || e.type === 'col') {
        const w = (e.width || 1) * cs * (0.5 + 0.6 * Math.sin(Math.min(1, p * 2) * Math.PI / 2)) * fade;
        const g = e.type === 'row'
          ? ctx.createLinearGradient(0, (e.r + 0.5) * cs - w / 2, 0, (e.r + 0.5) * cs + w / 2)
          : ctx.createLinearGradient((e.c + 0.5) * cs - w / 2, 0, (e.c + 0.5) * cs + w / 2, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,250,220,${0.95 * fade})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        const reach = Math.min(1, p * 3);
        if (e.type === 'row') {
          const x0 = (e.c + 0.5) * cs - reach * this.cols * cs, x1 = (e.c + 0.5) * cs + reach * this.cols * cs;
          ctx.fillRect(Math.max(0, x0), (e.r + 0.5) * cs - w / 2, Math.min(this.cols * cs, x1) - Math.max(0, x0), w);
        } else {
          const y0 = (e.r + 0.5) * cs - reach * this.rows * cs, y1 = (e.r + 0.5) * cs + reach * this.rows * cs;
          ctx.fillRect((e.c + 0.5) * cs - w / 2, Math.max(0, y0), w, Math.min(this.rows * cs, y1) - Math.max(0, y0));
        }
      } else if (e.type === 'area') {
        const rad = (e.radius + 0.5) * cs * (0.3 + p * 1.1);
        ctx.strokeStyle = `rgba(255,240,200,${fade})`;
        ctx.lineWidth = cs * 0.22 * fade;
        ctx.beginPath(); ctx.arc((e.c + 0.5) * cs, (e.r + 0.5) * cs, rad, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.5 * fade * fade})`;
        ctx.beginPath(); ctx.arc((e.c + 0.5) * cs, (e.r + 0.5) * cs, rad * 0.8, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'color') {
        ctx.strokeStyle = `rgba(255,236,140,${fade})`;
        ctx.lineWidth = cs * 0.07;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = cs * 0.3;
        const x0 = (e.c + 0.5) * cs, y0 = (e.r + 0.5) * cs;
        const reach = Math.min(1, p * 2.5);
        for (const b of e.bolts) {
          const x1 = (b.c + 0.5) * cs, y1 = (b.r + 0.5) * cs;
          ctx.beginPath(); ctx.moveTo(x0, y0);
          const n = 5;
          for (let i = 1; i <= n; i++) {
            const t = (i / n) * reach;
            const j = i === n ? 0 : Math.sin(b.seed + i * 7 + e.t / 40) * cs * 0.18;
            ctx.lineTo(x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t - j);
          }
          ctx.stroke();
        }
      } else if (e.type === 'all') {
        ctx.fillStyle = `rgba(255,255,240,${0.8 * fade})`;
        ctx.fillRect(-cs, -cs, (this.cols + 2) * cs, (this.rows + 2) * cs);
      }
      ctx.restore();
    }
  }

  drawParticles(ctx, cs) {
    for (const p of this.particles) {
      const fade = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x * cs, p.y * cs);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * cs * (0.6 + 0.4 * fade);
      if (p.star) {
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill();
      } else if (p.shard) {
        ctx.strokeStyle = 'rgba(58,42,34,.6)'; ctx.lineWidth = cs * 0.015;
        ctx.beginPath(); ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s, -s * 0.2); ctx.lineTo(0, s); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawTexts(ctx, cs) {
    for (const t of this.texts) {
      const p = t.t / t.dur;
      const pop = t.big ? (p < 0.15 ? ease.outBack(p / 0.15) : 1) : 1;
      const alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      const size = t.size * cs * pop;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = t.x * cs, y = (t.y - t.rise * p) * cs;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * (t.big ? 0.22 : 0.2);
      ctx.strokeStyle = '#3a2a22';
      ctx.strokeText(t.text, x, y);
      if (t.big) {
        const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
        g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#ff9f43');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = t.color;
      }
      ctx.fillText(t.text, x, y);
      ctx.restore();
    }
  }

  get animating() { return this.tw.busy; }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
