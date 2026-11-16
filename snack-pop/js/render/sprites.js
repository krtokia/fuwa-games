// 간식·특수·방해물 그림. 기존 고양이 그림처럼 굵은 진갈색 테두리 + 단색 + 부드러운 음영.
// 크기별로 오프스크린 캔버스에 한 번 그려 두고 재사용한다. 좌표는 0..1 단위.

export const KINDS = [
  { name: '생선', color: '#3ea2e6' },
  { name: '털실', color: '#f2699f' },
  { name: '발바닥 쿠키', color: '#f5962f' },
  { name: '방울', color: '#f4c51f' },
  { name: '캣닢', color: '#4fb84d' },
  { name: '별사탕', color: '#9a6be4' },
];

const INK = '#3a2a22';
const LW = 0.05;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function bodyFill(ctx, color, top = 0.15, bottom = 0.85) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.18));
  return g;
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 모양: parts 는 차례로 칠하고 테두리를 그리는 경로들, clip 은 전체 실루엣, detail 은 위에 얹는 무늬
const SHAPES = [
  { // 생선
    parts: [
      (c) => { c.moveTo(0.66, 0.5); c.quadraticCurveTo(0.8, 0.36, 0.92, 0.27); c.quadraticCurveTo(0.86, 0.5, 0.92, 0.73); c.quadraticCurveTo(0.8, 0.64, 0.66, 0.5); c.closePath(); },
      (c) => { c.moveTo(0.1, 0.5); c.bezierCurveTo(0.18, 0.22, 0.6, 0.2, 0.74, 0.5); c.bezierCurveTo(0.6, 0.8, 0.18, 0.78, 0.1, 0.5); c.closePath(); },
    ],
    detail(c, color) {
      c.strokeStyle = shade(color, -0.35); c.lineWidth = 0.035; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0.36, 0.38); c.quadraticCurveTo(0.42, 0.5, 0.36, 0.62); c.stroke();
      c.beginPath(); c.moveTo(0.48, 0.4); c.quadraticCurveTo(0.54, 0.5, 0.48, 0.6); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); ellipse(c, 0.23, 0.46, 0.06, 0.06); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.025; c.stroke();
      c.fillStyle = INK; c.beginPath(); ellipse(c, 0.235, 0.465, 0.03, 0.03); c.fill();
    },
  },
  { // 털실
    parts: [
      (c) => { c.moveTo(0.62, 0.78); c.bezierCurveTo(0.74, 0.92, 0.86, 0.86, 0.9, 0.93); c.lineTo(0.88, 0.95); c.bezierCurveTo(0.82, 0.9, 0.7, 0.96, 0.58, 0.8); c.closePath(); },
      (c) => { ellipse(c, 0.48, 0.48, 0.37, 0.37); },
    ],
    detail(c, color) {
      c.save(); c.beginPath(); ellipse(c, 0.48, 0.48, 0.37, 0.37); c.clip();
      c.strokeStyle = shade(color, -0.3); c.lineWidth = 0.035; c.lineCap = 'round';
      for (const [x, y, r, a0, a1] of [[0.2, 0.25, 0.42, 0.1, 1.45], [0.25, 0.2, 0.5, 0.15, 1.4], [0.82, 0.3, 0.42, 1.75, 3.0], [0.85, 0.36, 0.52, 1.85, 2.95], [0.45, 0.95, 0.36, 3.6, 5.6]]) {
        c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke();
      }
      c.restore();
    },
  },
  { // 발바닥 쿠키
    parts: [
      (c) => {
        c.moveTo(0.5, 0.48);
        c.bezierCurveTo(0.72, 0.48, 0.82, 0.68, 0.76, 0.8);
        c.bezierCurveTo(0.7, 0.92, 0.58, 0.86, 0.5, 0.86);
        c.bezierCurveTo(0.42, 0.86, 0.3, 0.92, 0.24, 0.8);
        c.bezierCurveTo(0.18, 0.68, 0.28, 0.48, 0.5, 0.48);
        c.closePath();
        ellipse(c, 0.16, 0.42, 0.095, 0.115, -0.4);
        ellipse(c, 0.36, 0.24, 0.1, 0.125, -0.15);
        ellipse(c, 0.64, 0.24, 0.1, 0.125, 0.15);
        ellipse(c, 0.84, 0.42, 0.095, 0.115, 0.4);
      },
    ],
    detail(c) {
      c.fillStyle = 'rgba(255,240,220,.55)';
      c.beginPath(); ellipse(c, 0.5, 0.7, 0.13, 0.08); c.fill();
    },
  },
  { // 방울
    parts: [
      (c) => {
        c.moveTo(0.5, 0.14);
        c.bezierCurveTo(0.76, 0.14, 0.8, 0.4, 0.8, 0.58);
        c.bezierCurveTo(0.8, 0.68, 0.9, 0.72, 0.9, 0.78);
        c.lineTo(0.1, 0.78);
        c.bezierCurveTo(0.1, 0.72, 0.2, 0.68, 0.2, 0.58);
        c.bezierCurveTo(0.2, 0.4, 0.24, 0.14, 0.5, 0.14);
        c.closePath();
      },
      (c) => { ellipse(c, 0.5, 0.83, 0.075, 0.07); },
    ],
    detail(c, color) {
      c.strokeStyle = shade(color, -0.35); c.lineWidth = 0.035; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0.22, 0.6); c.quadraticCurveTo(0.5, 0.68, 0.78, 0.6); c.stroke();
      c.fillStyle = '#e8473d'; c.strokeStyle = INK; c.lineWidth = 0.03;
      c.beginPath(); roundRect(c, 0.38, 0.06, 0.24, 0.1, 0.04); c.fill(); c.stroke();
    },
  },
  { // 캣닢
    parts: [
      (c) => {
        c.moveTo(0.18, 0.84);
        c.bezierCurveTo(0.08, 0.5, 0.3, 0.16, 0.86, 0.12);
        c.bezierCurveTo(0.86, 0.6, 0.56, 0.9, 0.18, 0.84);
        c.closePath();
      },
    ],
    detail(c, color) {
      c.strokeStyle = shade(color, -0.4); c.lineWidth = 0.035; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0.2, 0.82); c.quadraticCurveTo(0.45, 0.5, 0.78, 0.2); c.stroke();
      for (const t of [0.35, 0.5, 0.64]) {
        const x = 0.2 + t * 0.62, y = 0.82 - t * 0.66;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.1, y - 0.12); c.stroke();
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.12, y + 0.08); c.stroke();
      }
    },
  },
  { // 별사탕
    parts: [
      (c) => {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 0.2 : 0.42;
          const x = 0.5 + Math.cos(a) * r, y = 0.53 + Math.sin(a) * r;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath();
      },
    ],
    detail(c) {
      c.fillStyle = INK;
      c.beginPath(); ellipse(c, 0.43, 0.52, 0.03, 0.04); ellipse(c, 0.57, 0.52, 0.03, 0.04); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.025; c.lineCap = 'round';
      c.beginPath(); c.arc(0.5, 0.58, 0.05, 0.3, Math.PI - 0.3); c.stroke();
      c.fillStyle = 'rgba(255,120,150,.6)';
      c.beginPath(); ellipse(c, 0.37, 0.6, 0.04, 0.025); ellipse(c, 0.63, 0.6, 0.04, 0.025); c.fill();
    },
  },
];

function silhouette(ctx, kind) {
  ctx.beginPath();
  for (const p of SHAPES[kind].parts) p(ctx);
}

function drawSnack(ctx, kind) {
  const color = KINDS[kind].color;
  const shape = SHAPES[kind];
  ctx.lineJoin = 'round';
  // 바닥 그림자
  ctx.save();
  ctx.translate(0, 0.035);
  ctx.fillStyle = 'rgba(40,20,10,.22)';
  silhouette(ctx, kind); ctx.fill('nonzero');
  ctx.restore();
  for (const part of shape.parts) {
    ctx.beginPath(); part(ctx);
    ctx.fillStyle = bodyFill(ctx, color);
    ctx.fill('nonzero');
    ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke();
  }
  shape.detail(ctx, color);
  // 윤기
  ctx.save();
  silhouette(ctx, kind); ctx.clip('nonzero');
  const g = ctx.createRadialGradient(0.36, 0.28, 0.01, 0.36, 0.28, 0.3);
  g.addColorStop(0, 'rgba(255,255,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
}

function drawStripes(ctx, kind, dir) {
  ctx.save();
  silhouette(ctx, kind); ctx.clip('nonzero');
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.strokeStyle = 'rgba(58,42,34,.55)';
  ctx.lineWidth = 0.02;
  for (const t of [0.3, 0.5, 0.7]) {
    ctx.beginPath();
    if (dir === 'h') ctx.rect(0, t - 0.04, 1, 0.08); else ctx.rect(t - 0.04, 0, 0.08, 1);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // 방향 화살표
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 0.03;
  const arrow = (x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0.07, 0); ctx.lineTo(-0.04, -0.07); ctx.lineTo(-0.04, 0.07); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  };
  if (dir === 'h') { arrow(0.95, 0.5, 0); arrow(0.05, 0.5, Math.PI); }
  else { arrow(0.5, 0.95, Math.PI / 2); arrow(0.5, 0.05, -Math.PI / 2); }
}

function drawGift(ctx, kind) {
  const color = KINDS[kind].color;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(40,20,10,.22)';
  ctx.beginPath(); roundRect(ctx, 0.12, 0.27, 0.76, 0.66, 0.1); ctx.fill();
  ctx.beginPath(); roundRect(ctx, 0.12, 0.24, 0.76, 0.66, 0.1);
  ctx.fillStyle = bodyFill(ctx, color, 0.24, 0.9); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke();
  // 리본 띠
  ctx.fillStyle = '#fff6f0';
  ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.rect(0.43, 0.24, 0.14, 0.66); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(0.12, 0.5, 0.76, 0.13); ctx.fill(); ctx.stroke();
  // 나비 매듭
  ctx.lineWidth = 0.04;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.5, 0.24);
    ctx.bezierCurveTo(0.5 + s * 0.08, 0.02, 0.5 + s * 0.3, 0.06, 0.5 + s * 0.2, 0.24);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ellipse(ctx, 0.5, 0.235, 0.05, 0.045); ctx.fill(); ctx.stroke();
  // 가운데에 작은 간식 표시(색만으로 구분하지 않도록)
  ctx.save(); ctx.translate(0.34, 0.4); ctx.scale(0.32, 0.32);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ellipse(ctx, 0.5, 0.52, 0.56, 0.56); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.08; ctx.stroke();
  ctx.lineWidth = LW;
  drawSnack(ctx, kind);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); roundRect(ctx, 0.12, 0.24, 0.76, 0.66, 0.1); ctx.clip();
  const g = ctx.createLinearGradient(0, 0.24, 0, 0.5);
  g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
}

function drawCat(ctx, img) {
  const g = ctx.createRadialGradient(0.4, 0.32, 0.05, 0.5, 0.5, 0.48);
  g.addColorStop(0, '#fff7d1'); g.addColorStop(0.6, '#ffd75e'); g.addColorStop(1, '#e8a417');
  ctx.fillStyle = 'rgba(40,20,10,.22)';
  ctx.beginPath(); ellipse(ctx, 0.5, 0.535, 0.44, 0.44); ctx.fill();
  ctx.beginPath(); ellipse(ctx, 0.5, 0.5, 0.44, 0.44);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke();
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.beginPath(); ellipse(ctx, 0.5, 0.5, 0.4, 0.4); ctx.clip();
    ctx.drawImage(img, 0.1, 0.06, 0.8, 0.8);
    ctx.restore();
  } else {
    ctx.fillStyle = INK;
    ctx.font = '0.4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('냥', 0.5, 0.52);
  }
  // 반짝이
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [[0.16, 0.2, 0.06], [0.85, 0.3, 0.045], [0.8, 0.82, 0.05]]) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
}

function drawIce(ctx, layers) {
  const g = ctx.createLinearGradient(0, 0, 1, 1);
  if (layers > 1) { g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#6fb9f0'); }
  else { g.addColorStop(0, '#e6f6ff'); g.addColorStop(1, '#a9dcff'); }
  ctx.beginPath(); roundRect(ctx, 0.03, 0.03, 0.94, 0.94, 0.14);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = layers > 1 ? '#3f8fcf' : '#7cc2f2'; ctx.lineWidth = 0.04; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.14, 0.34); ctx.lineTo(0.34, 0.14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.14, 0.5); ctx.lineTo(0.22, 0.42); ctx.stroke();
  if (layers > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(0.66, 0.86); ctx.lineTo(0.86, 0.66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.76, 0.88); ctx.lineTo(0.88, 0.76); ctx.stroke();
  }
}

function drawBox(ctx, layers) {
  const wood = layers > 1 ? '#a8692f' : '#d39a55';
  ctx.fillStyle = 'rgba(40,20,10,.25)';
  ctx.beginPath(); roundRect(ctx, 0.05, 0.08, 0.9, 0.9, 0.1); ctx.fill();
  ctx.beginPath(); roundRect(ctx, 0.05, 0.04, 0.9, 0.9, 0.1);
  ctx.fillStyle = bodyFill(ctx, wood, 0.04, 0.94); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke();
  ctx.strokeStyle = shade(wood, -0.35); ctx.lineWidth = 0.03;
  for (const y of [0.34, 0.64]) { ctx.beginPath(); ctx.moveTo(0.08, y); ctx.lineTo(0.92, y); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 0.04;
  ctx.beginPath(); roundRect(ctx, 0.15, 0.14, 0.7, 0.7, 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.18); ctx.lineTo(0.82, 0.8); ctx.stroke();
  if (layers > 1) {
    ctx.fillStyle = '#9aa3ab';
    for (const x of [0.22, 0.7]) { ctx.beginPath(); ctx.rect(x, 0.04, 0.09, 0.9); ctx.fill(); ctx.stroke(); }
  }
  ctx.fillStyle = INK;
  for (const [x, y] of [[0.12, 0.11], [0.88, 0.11], [0.12, 0.87], [0.88, 0.87]]) {
    ctx.beginPath(); ellipse(ctx, x, y, 0.025, 0.025); ctx.fill();
  }
}

export class Sprites {
  constructor() {
    this.cache = new Map();
    this.size = 0;
    this.cat = new Image();
    this.cat.src = new URL('../../../cat-outing/cats/01-1.webp', import.meta.url).href;
    this.ready = new Promise((res) => {
      this.cat.onload = () => { this.cache.clear(); res(); };
      this.cat.onerror = () => res();
    });
  }

  setSize(px) {
    px = Math.max(16, Math.round(px));
    if (px !== this.size) { this.size = px; this.cache.clear(); }
  }

  get(name, draw, size = this.size) {
    const k = `${name}@${size}`;
    let cv = this.cache.get(k);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.scale(size, size);
      draw(ctx);
      this.cache.set(k, cv);
    }
    return cv;
  }

  piece(kind, special, size) {
    if (special === 'cat') return this.get('cat', (c) => drawCat(c, this.cat), size);
    if (special === 'bomb') return this.get(`gift${kind}`, (c) => drawGift(c, kind), size);
    if (special === 'h' || special === 'v') {
      return this.get(`line${kind}${special}`, (c) => {
        c.translate(0.06, 0.06); c.scale(0.88, 0.88);
        drawSnack(c, kind); drawStripes(c, kind, special);
      }, size);
    }
    return this.get(`snack${kind}`, (c) => { c.translate(0.06, 0.06); c.scale(0.88, 0.88); drawSnack(c, kind); }, size);
  }

  ice(layers, size) { return this.get(`ice${layers}`, (c) => drawIce(c, layers), size); }
  box(layers, size) { return this.get(`box${layers}`, (c) => drawBox(c, layers), size); }

  // DOM 용 아이콘 (목표 표시)
  iconURL(type, kind) {
    const size = 96;
    const cv = type === 'ice' ? this.ice(1, size) : type === 'box' ? this.box(1, size) : this.piece(kind, null, size);
    return cv.toDataURL();
  }
}
