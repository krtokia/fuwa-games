// 화면 연결: 지도 ↔ 게임, 입력 → 엔진 → 연출, 끝 판정, 저장.

import { createState, swap, findHint, holdsPiece, isWon, isLost, bonus, starsFor } from './core/board.js';
import { LEVELS } from './core/levels.js';
import { Sprites, KINDS } from './render/sprites.js';
import { View } from './render/view.js';
import { Sound } from './audio.js';
import { loadStore, saveStore, recordWin, isUnlocked, totalStars } from './store.js';

const $ = (sel) => document.querySelector(sel);
const store = loadStore();
const sprites = new Sprites();
const sound = new Sound(store.sound);
const canvas = $('#board');
const view = new View(canvas, sprites, sound);
const params = new URLSearchParams(location.search);

let level = null;
let state = null;
let shown = null; // 화면에 보이는 점수·이동·목표(연출에 맞춰 천천히 바뀐다)
let busy = false;
let hintTimer = 0;

// ---------- 공통 ----------

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'map') view.stop(); else view.start();
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) e.append(kid);
  return e;
}

function goalIcon(g) {
  if (g.type === 'score') return el('span', { class: 'goal-icon score-icon', 'aria-hidden': 'true', text: '점' });
  return el('img', { class: 'goal-icon', alt: '', src: sprites.iconURL(g.type, g.kind) });
}

function goalLabel(g) {
  if (g.type === 'collect') return `${KINDS[g.kind].name} ${g.target}개 모으기`;
  if (g.type === 'ice') return `얼음 ${g.target}겹 깨기`;
  if (g.type === 'box') return `상자 ${g.target}번 부수기`;
  return `${g.target.toLocaleString()}점 넘기기`;
}

function starRow(n, total = 3, cls = '') {
  const row = el('div', { class: `stars ${cls}`, 'aria-label': `별 ${n}개` });
  for (let i = 0; i < total; i++) row.append(el('span', { class: i < n ? 'on' : '', 'aria-hidden': 'true', text: '★' }));
  return row;
}

// ---------- 모달 ----------

const modal = $('#modal');
function openModal(card) {
  modal.replaceChildren(card);
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));
  const first = card.querySelector('button.primary') || card.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeModal() {
  modal.classList.remove('open');
  modal.hidden = true;
  modal.replaceChildren();
}

function button(text, onclick, cls = '') {
  return el('button', { class: `btn ${cls}`, type: 'button', onclick: () => { sound.unlock(); sound.play('click'); onclick(); } }, text);
}

// ---------- 지도 ----------

function renderMap() {
  $('#total-stars').textContent = totalStars(store);
  $('#total-max').textContent = LEVELS.length * 3;
  updateSoundButtons();
  const path = $('#path');
  path.replaceChildren();
  const n = LEVELS.length;
  const rowH = 104;
  const xOf = (i) => 50 + 30 * Math.sin(i * 0.95);
  // 길(점선)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'trail');
  svg.setAttribute('viewBox', `0 0 100 ${n * rowH}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = (n - 1 - i) * rowH + rowH / 2;
    d += `${i ? 'L' : 'M'}${xOf(i)} ${y}`;
  }
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', d);
  svg.append(line);
  path.style.height = `${n * rowH}px`;
  path.append(svg);

  let current = 1;
  for (const l of LEVELS) if (isUnlocked(store, l.id)) current = l.id;
  LEVELS.forEach((l, i) => {
    const rec = store.levels[l.id];
    const open = isUnlocked(store, l.id);
    const node = el('button', {
      class: `node${open ? '' : ' locked'}${l.id === current ? ' current' : ''}${rec ? ' cleared' : ''}`,
      type: 'button',
      style: `left:${xOf(i)}%;top:${(n - 1 - i) * rowH + rowH / 2}px`,
      'aria-label': open ? `${l.id}판${rec ? `, 별 ${rec.stars}개` : ''}` : `${l.id}판, 잠김`,
      onclick: () => { sound.unlock(); if (open) { sound.play('click'); openIntro(l.id); } else sound.play('nope'); },
    }, el('b', { text: open ? String(l.id) : '🔒' }));
    if (rec) node.append(starRow(rec.stars, 3, 'mini'));
    if (l.id === current) node.append(el('img', { class: 'avatar', alt: '', src: '../cat-outing/cats/01-1.webp' }));
    path.append(node);
  });
  // 지금 판이 보이게
  requestAnimationFrame(() => {
    const cur = path.querySelector('.node.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

function updateSoundButtons() {
  for (const b of document.querySelectorAll('[data-sound]')) {
    b.setAttribute('aria-pressed', String(sound.enabled));
    b.textContent = sound.enabled ? '🔊 소리' : '🔈 조용히';
  }
}

function toggleSound() {
  sound.enabled = !sound.enabled;
  store.sound = sound.enabled;
  saveStore(store);
  sound.unlock();
  updateSoundButtons();
}

function openIntro(id) {
  const l = LEVELS[id - 1];
  const preview = createState(l, 1);
  const rec = store.levels[id];
  openModal(el('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
    el('h2', { id: 'dlg-title', text: `${id}판` }),
    rec ? starRow(rec.stars) : null,
    el('p', { class: 'lead', text: '목표' }),
    el('ul', { class: 'goal-list' }, ...preview.goals.map((g) => el('li', {}, goalIcon(g), el('span', { text: goalLabel(g) })))),
    el('p', { class: 'moves-line' }, '이동 ', el('b', { text: String(l.moves) }), '번 안에'),
    l.tip ? el('p', { class: 'tip', text: `💡 ${l.tip}` }) : null,
    el('div', { class: 'actions' },
      button('닫기', closeModal),
      button('시작!', () => { closeModal(); startLevel(id); }, 'primary')),
  ));
}

// ---------- 게임 ----------

function startLevel(id) {
  level = LEVELS[id - 1];
  const seed = params.has('seed') ? Number(params.get('seed')) : (Math.random() * 2 ** 31) | 0;
  state = createState(level, seed);
  shown = { score: 0, moves: level.moves, goals: state.goals.map((g) => ({ ...g })) };
  busy = false;
  showScreen('game');
  $('#level-no').textContent = `${id}판`;
  buildHud();
  view.setState(state);
  scheduleHint();
}

function buildHud() {
  const box = $('#goals');
  box.replaceChildren();
  shown.goals.forEach((g, i) => {
    box.append(el('div', { class: 'goal', 'data-i': String(i), title: goalLabel(g) }, goalIcon(g), el('b', {})));
  });
  // 별 표시 위치
  const max = level.stars[2];
  const marks = $('#star-marks');
  marks.replaceChildren(...level.stars.map((t, i) => el('span', { class: 'mark', 'data-i': String(i), style: `left:${(t / max) * 100}%`, text: '★' })));
  renderHud();
}

function renderHud() {
  $('#moves').textContent = shown.moves;
  $('#moves-box').classList.toggle('low', shown.moves <= 5);
  $('#score').textContent = shown.score.toLocaleString();
  const max = level.stars[2];
  $('#score-fill').style.width = `${Math.min(100, (shown.score / max) * 100)}%`;
  for (const m of document.querySelectorAll('#star-marks .mark')) {
    m.classList.toggle('on', shown.score >= level.stars[Number(m.dataset.i)]);
  }
  shown.goals.forEach((g, i) => {
    const node = document.querySelector(`.goal[data-i="${i}"]`);
    if (!node) return;
    const left = Math.max(0, g.target - g.have);
    const done = left === 0;
    node.classList.toggle('done', done);
    node.querySelector('b').textContent = done ? '✓' : g.type === 'score' ? left.toLocaleString() : String(left);
    node.setAttribute('aria-label', `${goalLabel(g)}: ${done ? '완료' : `${left} 남음`}`);
  });
}

// 연출에 맞춰 HUD 를 올린다
function onStep(step, phase) {
  if (phase !== 'start') return;
  if (step.type === 'clear') {
    shown.score += step.score;
    for (const g of shown.goals) {
      if (g.type === 'collect') g.have += [...step.cleared, ...step.kept].filter((c) => c.kind === g.kind).length;
      else if (g.type === 'ice') g.have += step.ice.length;
      else if (g.type === 'box') g.have += step.boxes.length;
      else g.have = shown.score;
      g.have = Math.min(g.target, g.have);
    }
    bump('#score');
    renderHud();
  } else if (step.type === 'convert' && step.bonus) {
    shown.moves = Math.max(0, shown.moves - 1);
    shown.score += step.score;
    renderHud();
  }
}

function bump(sel) {
  const e = $(sel);
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}

async function doSwap(a, b) {
  if (busy) return;
  busy = true;
  clearHint();
  view.setSelected(null);
  const res = swap(state, a, b);
  if (res.valid) { shown.moves = state.movesLeft; renderHud(); bump('#moves'); }
  await view.play(res.steps, onStep);
  // 연출이 끝나면 엔진 값으로 맞춘다(반올림 차이 방지)
  shown.score = state.score;
  shown.goals = state.goals.map((g) => ({ ...g }));
  renderHud();
  if (res.valid && (isWon(state) || isLost(state))) await finish();
  else { busy = false; scheduleHint(); }
}

async function finish() {
  clearHint();
  if (isWon(state)) {
    view.bigText('성공!');
    sound.play('win');
    await view.tw.wait(1100);
    if (state.movesLeft > 0) {
      view.bigText('보너스 타임!');
      await view.tw.wait(700);
      await view.play(bonus(state), onStep);
      shown.score = state.score; shown.moves = 0;
      renderHud();
      await view.tw.wait(400);
    }
    const stars = Math.max(1, starsFor(state.score, level.stars));
    const prevBest = store.levels[level.id] ? store.levels[level.id].best : 0;
    recordWin(store, level.id, stars, state.score);
    showWin(stars, state.score > prevBest && prevBest > 0);
  } else {
    sound.play('lose');
    showLose();
  }
}

function showWin(stars, newBest) {
  const next = LEVELS[level.id];
  const row = starRow(0, 3, 'big');
  openModal(el('div', { class: 'card win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
    el('img', { class: 'hero', alt: '', src: '../cat-outing/cats/01-1.webp' }),
    el('h2', { id: 'dlg-title', text: '잘했어요!' }),
    row,
    el('p', { class: 'final-score' }, el('span', { text: '점수 ' }), el('b', { text: state.score.toLocaleString() })),
    newBest ? el('p', { class: 'new-best', text: '최고 기록!' }) : null,
    el('div', { class: 'actions' },
      button('지도로', () => { closeModal(); toMap(); }),
      next
        ? button('다음 판', () => { closeModal(); startLevel(next.id); }, 'primary')
        : button('다시 하기', () => { closeModal(); startLevel(level.id); }, 'primary')),
    next ? null : el('p', { class: 'tip', text: '모든 판을 깼어요! 후와가 아주 기뻐해요 🎉' }),
  ));
  row.setAttribute('aria-label', `별 ${stars}개`);
  [...row.children].forEach((s, i) => {
    if (i >= stars) return;
    setTimeout(() => { s.classList.add('on', 'pop'); sound.play('star', i); }, 350 + i * 380);
  });
}

function showLose() {
  const left = state.goals.filter((g) => g.have < g.target);
  openModal(el('div', { class: 'card lose', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
    el('h2', { id: 'dlg-title', text: '아쉬워요' }),
    el('p', { class: 'lead', text: '이동을 다 썼어요. 조금만 더 하면 돼요!' }),
    el('ul', { class: 'goal-list' }, ...left.map((g) => el('li', {}, goalIcon(g), el('span', { text: `${(g.target - g.have).toLocaleString()}${g.type === 'score' ? '점' : ''} 남음` })))),
    el('div', { class: 'actions' },
      button('지도로', () => { closeModal(); toMap(); }),
      button('다시 하기', () => { closeModal(); startLevel(level.id); }, 'primary')),
  ));
}

function openPause() {
  if (busy) return;
  clearHint();
  const soundBtn = button('', toggleSound);
  soundBtn.dataset.sound = '';
  openModal(el('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
    el('h2', { id: 'dlg-title', text: '잠깐 쉬어요' }),
    el('ul', { class: 'goal-list' }, ...state.goals.map((g) => el('li', {}, goalIcon(g), el('span', { text: goalLabel(g) })))),
    el('div', { class: 'actions column' },
      button('계속하기', () => { closeModal(); scheduleHint(); }, 'primary'),
      button('처음부터 다시', () => { closeModal(); startLevel(level.id); }),
      button('지도로', () => { closeModal(); toMap(); }),
      soundBtn),
  ));
  updateSoundButtons();
}

function toMap() {
  clearHint();
  renderMap();
  showScreen('map');
}

// ---------- 힌트 ----------

function scheduleHint() {
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { if (!busy && state && modal.hidden) view.setHint(findHint(state)); }, 5000);
}
function clearHint() {
  clearTimeout(hintTimer);
  view.setHint(null);
}

// ---------- 입력 ----------

let drag = null;
let selected = null;

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (busy || !state) return;
  const cell = view.cellAt(e.clientX, e.clientY);
  if (!cell || !holdsPiece(state, ...cell)) return;
  clearHint();
  scheduleHint();
  if (selected) {
    const near = Math.abs(selected[0] - cell[0]) + Math.abs(selected[1] - cell[1]) === 1;
    if (near) {
      const from = selected;
      selected = null;
      doSwap(from, cell);
      return;
    }
  }
  drag = { cell, x: e.clientX, y: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || busy) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  const need = view.cellSize * 0.35;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < need) return;
  const [r, c] = drag.cell;
  const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
  drag = null;
  selected = null;
  if (holdsPiece(state, ...to)) doSwap([r, c], to);
  else view.setSelected(null);
});

const endDrag = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const cell = drag.cell;
  drag = null;
  if (selected && selected[0] === cell[0] && selected[1] === cell[1]) selected = null;
  else { selected = cell; sound.play('click'); }
  view.setSelected(selected);
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => { if (drag && drag.id === e.pointerId) drag = null; });

// ---------- 버튼 ----------

$('#pause-btn').addEventListener('click', () => { sound.unlock(); sound.play('click'); openPause(); });
$('#map-sound').addEventListener('click', toggleSound);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.hidden) {
    const close = [...modal.querySelectorAll('button')].find((b) => ['닫기', '계속하기'].includes(b.textContent));
    if (close) close.click();
  } else if (!$('#game').hidden) openPause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) view.stop(); else if (!$('#game').hidden) view.start();
});

// 확인용(브라우저 검증·디버그): 읽기 위주
window.__snackPop = {
  get state() { return state; },
  get busy() { return busy; },
  hint: () => state && findHint(state),
  cellCenter(r, c) {
    const rect = canvas.getBoundingClientRect();
    const { cs, ox, oy } = view.layout;
    return { x: rect.left + ox + (c + 0.5) * cs, y: rect.top + oy + (r + 0.5) * cs };
  },
};
// ?debug 일 때만: 특수 간식을 놓거나 이동 수를 바꿔 연출을 확인한다
if (params.has('debug')) {
  Object.assign(window.__snackPop, {
    place(r, c, special) {
      const p = state.cells[r][c];
      p.special = special;
      if (special === 'cat') p.kind = -1;
      view.setState(state);
    },
    setMoves(n) { state.movesLeft = n; shown.moves = n; renderHud(); },
  });
}

renderMap();
showScreen('map');
if (params.has('level')) {
  const id = Number(params.get('level'));
  if (LEVELS[id - 1] && isUnlocked(store, id)) startLevel(id);
}
