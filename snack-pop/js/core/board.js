// 간식 팡팡 — 순수 게임 로직. 그림·DOM 을 모른다.
// 판 상태를 바꾸고, 연출용 "단계(step)" 목록을 돌려준다. 조각마다 고유 id 가 있다.
//
// 조각: { id, kind, special }  kind 0..K-1 (고양이는 -1), special null | 'h' | 'v' | 'bomb' | 'cat'
// 칸:   mask[r][c] 판 안인지, ice[r][c] 얼음 겹, box[r][c] 상자 겹(상자 칸엔 조각 없음)

import { makeRng } from './rng.js';

export const CAT = 'cat';
export const BOMB = 'bomb';
export const LINE_H = 'h';
export const LINE_V = 'v';

const PIECE_POINTS = 60;
const BLOCKER_POINTS = 100;
const SPECIAL_MADE_POINTS = { h: 200, v: 200, bomb: 300, cat: 500 };
export const BONUS_POINTS = 300; // 남은 이동 하나당

const key = (r, c) => r * 64 + c;
const unkey = (k) => [Math.floor(k / 64), k % 64];

// ---------- 생성 ----------

// layout: 문자열 배열. '.' 칸, 'x' 구멍, 'i'/'I' 얼음 1/2겹, 'b'/'B' 상자 1/2겹
export function createState(level, seed = Date.now()) {
  const layout = level.layout;
  const rows = layout.length;
  const cols = layout[0].length;
  const grid = (v) => Array.from({ length: rows }, () => Array(cols).fill(v));
  const s = {
    rows, cols,
    kinds: level.kinds,
    mask: grid(true), ice: grid(0), box: grid(0), cells: grid(null),
    rng: makeRng(seed),
    nextId: 1,
    score: 0,
    movesLeft: level.moves,
    goals: [],
    collected: Array(level.kinds).fill(0),
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = layout[r][c];
      if (ch === 'x') s.mask[r][c] = false;
      else if (ch === 'i') s.ice[r][c] = 1;
      else if (ch === 'I') s.ice[r][c] = 2;
      else if (ch === 'b') s.box[r][c] = 1;
      else if (ch === 'B') s.box[r][c] = 2;
    }
  }
  s.goals = (level.goals || []).map((g) => {
    if (g.type === 'ice') return { type: 'ice', target: countLayers(s.ice), have: 0 };
    if (g.type === 'box') return { type: 'box', target: countLayers(s.box), have: 0 };
    if (g.type === 'collect') return { type: 'collect', kind: g.kind, target: g.n, have: 0 };
    return { type: 'score', target: g.n, have: 0 };
  });
  fillFresh(s);
  return s;
}

function countLayers(g) {
  let n = 0;
  for (const row of g) for (const v of row) n += v;
  return n;
}

export const isCell = (s, r, c) => r >= 0 && c >= 0 && r < s.rows && c < s.cols && s.mask[r][c];
export const holdsPiece = (s, r, c) => isCell(s, r, c) && s.box[r][c] === 0;
const colorOf = (p) => (p && p.special !== CAT ? p.kind : -1);

function newPiece(s, kind, special = null) {
  return { id: s.nextId++, kind, special };
}

// 바로 맞는 줄이 없고, 둘 곳이 있는 판으로 채운다
function fillFresh(s) {
  for (let tries = 0; tries < 200; tries++) {
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        s.cells[r][c] = null;
        if (!holdsPiece(s, r, c)) continue;
        const bad = new Set();
        const a = s.cells[r][c - 1], b = s.cells[r][c - 2];
        if (a && b && a.kind === b.kind) bad.add(a.kind);
        const u = r > 0 ? s.cells[r - 1][c] : null, v = r > 1 ? s.cells[r - 2][c] : null;
        if (u && v && u.kind === v.kind) bad.add(u.kind);
        const options = [];
        for (let k = 0; k < s.kinds; k++) if (!bad.has(k)) options.push(k);
        s.cells[r][c] = newPiece(s, s.rng.pick(options));
      }
    }
    if (findGroups(s).length === 0 && findHint(s)) return;
  }
}

// ---------- 맞춤 찾기 ----------

// 같은 색 3개 이상 줄(run)을 찾고, 칸을 공유하는 줄끼리 묶어 무리(group)로 만든다
export function findGroups(s) {
  const runs = [];
  const scan = (outer, inner, at, dir) => {
    for (let i = 0; i < outer; i++) {
      let j = 0;
      while (j < inner) {
        const [r, c] = at(i, j);
        const k = colorOf(s.cells[r][c]);
        if (k < 0 || !holdsPiece(s, r, c)) { j++; continue; }
        let e = j + 1;
        while (e < inner) {
          const [r2, c2] = at(i, e);
          if (!holdsPiece(s, r2, c2) || colorOf(s.cells[r2][c2]) !== k) break;
          e++;
        }
        if (e - j >= 3) {
          const cells = [];
          for (let t = j; t < e; t++) cells.push(at(i, t));
          runs.push({ dir, kind: k, cells });
        }
        j = e;
      }
    }
  };
  scan(s.rows, s.cols, (i, j) => [i, j], 'h');
  scan(s.cols, s.rows, (i, j) => [j, i], 'v');

  // 겹치는 줄 묶기 (union-find)
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => {
    for (const [r, c] of run.cells) {
      const k = key(r, c);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });
  const byRoot = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, { kind: run.kind, runs: [], cells: new Set() });
    const g = byRoot.get(root);
    g.runs.push(run);
    for (const [r, c] of run.cells) g.cells.add(key(r, c));
  });
  return [...byRoot.values()];
}

// 무리에서 생기는 특수 간식
export function specialFor(group) {
  const longest = Math.max(...group.runs.map((r) => r.cells.length));
  if (longest >= 5) return CAT;
  const dirs = new Set(group.runs.map((r) => r.dir));
  if (dirs.size === 2) return BOMB;
  if (longest === 4) return group.runs.find((r) => r.cells.length === 4).dir === 'h' ? LINE_H : LINE_V;
  return null;
}

function creationCell(s, group, special, swapped) {
  const plain = (k) => { const [r, c] = unkey(k); return !s.cells[r][c].special; };
  if (swapped) {
    for (const [r, c] of swapped) {
      const k = key(r, c);
      if (group.cells.has(k) && plain(k)) return k;
    }
  }
  if (special === BOMB) {
    // 가로·세로 줄이 만나는 칸
    const seen = new Map();
    for (const run of group.runs) for (const [r, c] of run.cells) {
      const k = key(r, c);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    for (const [k, n] of seen) if (n > 1 && plain(k)) return k;
  }
  const run = group.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  const mid = run.cells[Math.floor(run.cells.length / 2)];
  if (plain(key(...mid))) return key(...mid);
  for (const k of group.cells) if (plain(k)) return k;
  return null;
}

// ---------- 터뜨리기 ----------

// 시작 칸들을 지우고, 지워지는 특수 간식의 효과를 꼬리 물듯 퍼뜨린다.
// opts: { matched: 맞춤으로 지운 칸(옆 상자 깨기용), creations: [{k, special, kind}], consumed: 효과를 이미 쓴 조각 id, blasts, combo }
function runClear(s, startKeys, opts) {
  const combo = opts.combo || 1;
  const step = {
    type: 'clear', combo,
    cleared: [], kept: [], created: [], blasts: opts.blasts ? [...opts.blasts] : [],
    ice: [], boxes: [], points: [], score: 0,
  };
  const consumed = opts.consumed || new Set();
  const keep = new Set((opts.creations || []).map((c) => c.k));
  const queue = [...startKeys];
  const done = new Set();
  const boxHit = new Set();

  const hitBox = (r, c) => {
    const k = key(r, c);
    if (!isCell(s, r, c) || s.box[r][c] === 0 || boxHit.has(k)) return;
    boxHit.add(k);
    s.box[r][c]--;
    step.boxes.push({ r, c, left: s.box[r][c] });
    addGoal(s, 'box', 1);
    step.score += BLOCKER_POINTS;
  };

  while (queue.length) {
    const k = queue.shift();
    if (done.has(k)) continue;
    done.add(k);
    const [r, c] = unkey(k);
    if (!isCell(s, r, c)) continue;
    if (s.box[r][c] > 0) { hitBox(r, c); continue; }
    const p = s.cells[r][c];
    if (!p) continue;
    if (keep.has(k) && opts.matched && opts.matched.has(k)) {
      // 새 특수가 생길 자리: 조각은 남지만 맞춘 칸이므로 모으기·점수·얼음은 똑같이 센다
      step.kept.push({ id: p.id, r, c, kind: p.kind });
      if (p.kind >= 0) { s.collected[p.kind]++; addGoal(s, 'collect', 1, p.kind); }
      step.score += PIECE_POINTS * combo;
      if (s.ice[r][c] > 0) {
        s.ice[r][c]--;
        step.ice.push({ r, c, left: s.ice[r][c] });
        addGoal(s, 'ice', 1);
        step.score += BLOCKER_POINTS;
      }
      continue;
    }

    if (p.special && !consumed.has(p.id)) {
      consumed.add(p.id);
      const area = blastArea(s, r, c, p);
      step.blasts.push(area.blast);
      for (const t of area.keys) if (!done.has(t)) queue.push(t);
    }
    s.cells[r][c] = null;
    step.cleared.push({ id: p.id, r, c, kind: p.kind, special: p.special });
    if (p.kind >= 0) { s.collected[p.kind]++; addGoal(s, 'collect', 1, p.kind); }
    const pts = PIECE_POINTS * combo;
    step.score += pts;
    step.points.push({ r, c, value: pts });
    if (s.ice[r][c] > 0) {
      s.ice[r][c]--;
      step.ice.push({ r, c, left: s.ice[r][c] });
      addGoal(s, 'ice', 1);
      step.score += BLOCKER_POINTS;
    }
  }

  // 맞춤 옆 상자는 깨진다
  if (opts.matched) {
    for (const k of opts.matched) {
      const [r, c] = unkey(k);
      hitBox(r - 1, c); hitBox(r + 1, c); hitBox(r, c - 1); hitBox(r, c + 1);
    }
  }

  for (const cr of opts.creations || []) {
    const [r, c] = unkey(cr.k);
    let p = s.cells[r][c];
    if (p) { p.kind = cr.kind; p.special = cr.special; }
    else { p = newPiece(s, cr.kind, cr.special); s.cells[r][c] = p; }
    step.created.push({ id: p.id, r, c, kind: p.kind, special: p.special, from: cr.from || [] });
    step.score += SPECIAL_MADE_POINTS[cr.special];
  }

  s.score += step.score;
  addGoal(s, 'score', 0);
  return step;
}

function addGoal(s, type, n, kind) {
  for (const g of s.goals) {
    if (g.type !== type) continue;
    if (type === 'collect' && g.kind !== kind) continue;
    if (type === 'score') g.have = Math.min(g.target, s.score);
    else g.have = Math.min(g.target, g.have + n);
  }
}

// 특수 간식 하나가 터질 때 범위
function blastArea(s, r, c, p) {
  const keys = [];
  if (p.special === LINE_H) {
    for (let x = 0; x < s.cols; x++) keys.push(key(r, x));
    return { keys, blast: { type: 'row', r, c } };
  }
  if (p.special === LINE_V) {
    for (let y = 0; y < s.rows; y++) keys.push(key(y, c));
    return { keys, blast: { type: 'col', r, c } };
  }
  if (p.special === BOMB) {
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) keys.push(key(y, x));
    return { keys, blast: { type: 'area', r, c, radius: 1 } };
  }
  // 고양이: 판에 가장 많은 간식 색을 모두
  const kind = mostCommonKind(s);
  const targets = kind < 0 ? [] : cellsOfKind(s, kind);
  return { keys: targets.map(([y, x]) => key(y, x)), blast: { type: 'color', r, c, kind, targets } };
}

function mostCommonKind(s) {
  const n = Array(s.kinds).fill(0);
  forPieces(s, (p) => { if (p.kind >= 0) n[p.kind]++; });
  let best = -1;
  n.forEach((v, k) => { if (v > 0 && (best < 0 || v > n[best])) best = k; });
  return best;
}

function cellsOfKind(s, kind) {
  const out = [];
  forPieces(s, (p, r, c) => { if (p.kind === kind && p.special !== CAT) out.push([r, c]); });
  return out;
}

function forPieces(s, fn) {
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const p = s.cells[r][c];
    if (p && holdsPiece(s, r, c)) fn(p, r, c);
  }
}

// 맞춤 무리들을 한 번 터뜨린다. 없으면 null
function resolveOnce(s, combo, swapped) {
  const groups = findGroups(s);
  if (!groups.length) return null;
  const matched = new Set();
  const creations = [];
  for (const g of groups) {
    for (const k of g.cells) matched.add(k);
    const special = specialFor(g);
    if (!special) continue;
    const k = creationCell(s, g, special, swapped);
    if (k == null) continue;
    const from = [...g.cells].filter((t) => t !== k).map((t) => { const [r, c] = unkey(t); return s.cells[r][c].id; });
    creations.push({ k, special, kind: special === CAT ? -1 : g.kind, from });
  }
  return runClear(s, [...matched], { matched, creations, combo });
}

// ---------- 떨어뜨리기 ----------

// 열마다 아래로 모은다. 구멍과 상자는 건너뛰고(통과해서) 떨어진다. 빈 위쪽은 새 조각.
export function applyGravity(s) {
  const step = { type: 'fall', moves: [], spawns: [] };
  for (let c = 0; c < s.cols; c++) {
    const slots = [];
    for (let r = s.rows - 1; r >= 0; r--) if (holdsPiece(s, r, c)) slots.push(r);
    if (!slots.length) continue;
    const pieces = [];
    for (const r of slots) if (s.cells[r][c]) pieces.push({ p: s.cells[r][c], r });
    let i = 0;
    for (; i < pieces.length; i++) {
      const to = slots[i];
      const { p, r } = pieces[i];
      s.cells[to][c] = p;
      if (r !== to) { s.cells[r][c] = null; step.moves.push({ id: p.id, from: [r, c], to: [to, c] }); }
    }
    for (let j = i; j < slots.length; j++) s.cells[slots[j]][c] = null;
    const top = slots[slots.length - 1];
    const empty = slots.length - pieces.length;
    for (let j = 0; j < empty; j++) {
      const to = slots[pieces.length + j];
      const p = newPiece(s, s.rng.int(s.kinds));
      s.cells[to][c] = p;
      step.spawns.push({ id: p.id, kind: p.kind, special: null, to: [to, c], fromRow: top - 1 - j });
    }
  }
  return step;
}

// ---------- 바꾸기 ----------

export function canSwap(s, a, b) {
  if (!holdsPiece(s, ...a) || !holdsPiece(s, ...b)) return false;
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
  return !!(s.cells[a[0]][a[1]] && s.cells[b[0]][b[1]]);
}

function exchange(s, a, b) {
  const t = s.cells[a[0]][a[1]];
  s.cells[a[0]][a[1]] = s.cells[b[0]][b[1]];
  s.cells[b[0]][b[1]] = t;
}

const isCombo = (pa, pb) => pa.special === CAT || pb.special === CAT || (pa.special && pb.special);

// 플레이어가 a 를 b 쪽으로 옮긴다. { valid, steps }
export function swap(s, a, b) {
  if (!canSwap(s, a, b) || s.movesLeft <= 0) return { valid: false, steps: [] };
  const pa = s.cells[a[0]][a[1]], pb = s.cells[b[0]][b[1]];
  const steps = [{ type: 'swap', a, b, ids: [pa.id, pb.id] }];
  exchange(s, a, b);

  let first;
  if (isCombo(pa, pb)) {
    first = comboClear(s, pa, pb, a, b, steps);
  } else {
    first = resolveOnce(s, 1, [b, a]);
    if (!first) {
      exchange(s, a, b);
      steps.push({ type: 'swapBack', a, b, ids: [pa.id, pb.id] });
      return { valid: false, steps };
    }
  }
  s.movesLeft--;
  steps.push(first);
  settle(s, steps, 2);
  return { valid: true, steps };
}

// 떨어뜨리고 다시 맞으면 터뜨리기를 반복. 끝에 둘 곳 없으면 섞기
function settle(s, steps, combo) {
  for (let guard = 0; guard < 100; guard++) {
    steps.push(applyGravity(s));
    const next = resolveOnce(s, combo++, null);
    if (!next) break;
    steps.push(next);
  }
  if (!findHint(s)) steps.push(shuffle(s));
}

// 특수 + 특수, 또는 고양이 바꾸기. pa 는 b 에, pb 는 a 에 있다.
function comboClear(s, pa, pb, a, b, steps) {
  const consumed = new Set([pa.id, pb.id]);
  const [r, c] = b;
  const keys = [];
  const blasts = [];
  const rect = (r0, r1, c0, c1) => {
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) keys.push(key(y, x));
  };
  const cat = pa.special === CAT ? pa : pb.special === CAT ? pb : null;
  const other = cat === pa ? pb : pa;

  if (cat && other.special === CAT) {
    rect(0, s.rows - 1, 0, s.cols - 1);
    blasts.push({ type: 'all', r, c });
  } else if (cat && !other.special) {
    const targets = cellsOfKind(s, other.kind);
    for (const [y, x] of targets) keys.push(key(y, x));
    keys.push(key(r, c), key(a[0], a[1]));
    blasts.push({ type: 'color', r, c, kind: other.kind, targets });
  } else if (cat) {
    // 그 색 간식을 모두 같은 특수로 바꾼 뒤 한꺼번에 터뜨린다
    const targets = cellsOfKind(s, other.kind);
    const convert = { type: 'convert', cells: [] };
    for (const [y, x] of targets) {
      const p = s.cells[y][x];
      if (p.special) continue;
      p.special = other.special === BOMB ? BOMB : s.rng() < 0.5 ? LINE_H : LINE_V;
      convert.cells.push({ id: p.id, r: y, c: x, kind: p.kind, special: p.special });
    }
    steps.push(convert);
    consumed.delete(other.id);
    for (const [y, x] of targets) keys.push(key(y, x));
    keys.push(key(r, c), key(a[0], a[1]));
    blasts.push({ type: 'color', r, c, kind: other.kind, targets });
  } else {
    const kinds = [pa.special, pb.special];
    const lines = kinds.filter((k) => k === LINE_H || k === LINE_V).length;
    const bombs = kinds.filter((k) => k === BOMB).length;
    if (lines === 2) {
      rect(r, r, 0, s.cols - 1); rect(0, s.rows - 1, c, c);
      blasts.push({ type: 'row', r, c }, { type: 'col', r, c });
    } else if (lines === 1 && bombs === 1) {
      rect(r - 1, r + 1, 0, s.cols - 1); rect(0, s.rows - 1, c - 1, c + 1);
      blasts.push({ type: 'row', r, c, width: 3 }, { type: 'col', r, c, width: 3 });
    } else {
      rect(r - 2, r + 2, c - 2, c + 2);
      blasts.push({ type: 'area', r, c, radius: 2 });
    }
    keys.push(key(a[0], a[1]));
  }
  return runClear(s, keys, { consumed, blasts, combo: 1 });
}

// ---------- 힌트·섞기 ----------

function matchesThrough(s, r, c) {
  const k = colorOf(s.cells[r][c]);
  if (k < 0) return false;
  const same = (y, x) => holdsPiece(s, y, x) && colorOf(s.cells[y][x]) === k;
  let h = 1, v = 1;
  for (let x = c - 1; same(r, x); x--) h++;
  for (let x = c + 1; same(r, x); x++) h++;
  for (let y = r - 1; same(y, c); y--) v++;
  for (let y = r + 1; same(y, c); y++) v++;
  return h >= 3 || v >= 3;
}

// 둘 수 있는 바꾸기 하나 [a, b] 또는 null
export function findHint(s) {
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const a = [r, c], b = [r + dr, c + dc];
      if (!canSwap(s, a, b)) continue;
      const pa = s.cells[r][c], pb = s.cells[b[0]][b[1]];
      if (isCombo(pa, pb)) return [a, b];
      exchange(s, a, b);
      const ok = matchesThrough(s, ...a) || matchesThrough(s, ...b);
      exchange(s, a, b);
      if (ok) return [a, b];
    }
  }
  return null;
}

// 조각 자리를 섞는다(특수 포함). 맞춤 없고 둘 곳 있게.
export function shuffle(s) {
  const spots = [];
  const pieces = [];
  forPieces(s, (p, r, c) => { spots.push([r, c]); pieces.push(p); });
  for (let tries = 0; tries < 300; tries++) {
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = s.rng.int(i + 1);
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    spots.forEach(([r, c], i) => { s.cells[r][c] = pieces[i]; });
    if (tries > 100) {
      // 색 조합상 안 되면 일반 간식 색을 새로 뽑는다
      for (const p of pieces) if (!p.special) p.kind = s.rng.int(s.kinds);
    }
    if (findGroups(s).length === 0 && findHint(s)) break;
  }
  return {
    type: 'shuffle',
    pieces: spots.map(([r, c]) => ({ id: s.cells[r][c].id, kind: s.cells[r][c].kind, to: [r, c] })),
  };
}

// ---------- 끝 ----------

export const goalsDone = (s) => s.goals.every((g) => g.have >= g.target);
export const isWon = (s) => goalsDone(s);
export const isLost = (s) => !goalsDone(s) && s.movesLeft <= 0;

// 남은 이동을 줄무늬 간식으로 바꾸고 판의 특수를 모두 터뜨린다
export function bonus(s) {
  const steps = [];
  while (s.movesLeft > 0) {
    const plain = [];
    forPieces(s, (p, r, c) => { if (!p.special) plain.push([r, c]); });
    s.movesLeft--;
    s.score += BONUS_POINTS;
    if (!plain.length) {
      // 바꿀 간식이 없어도 점수는 연출 단계에 실어 보낸다(HUD 합계가 맞도록)
      steps.push({ type: 'convert', bonus: true, cells: [], score: BONUS_POINTS });
      continue;
    }
    const [r, c] = s.rng.pick(plain);
    const p = s.cells[r][c];
    p.special = s.rng() < 0.5 ? LINE_H : LINE_V;
    steps.push({ type: 'convert', bonus: true, cells: [{ id: p.id, r, c, kind: p.kind, special: p.special }], score: BONUS_POINTS });
  }
  for (let round = 0; round < 20; round++) {
    const specials = [];
    forPieces(s, (p, r, c) => { if (p.special) specials.push(key(r, c)); });
    if (!specials.length) break;
    steps.push(runClear(s, specials, { combo: 1 }));
    settle(s, steps, 2);
  }
  addGoal(s, 'score', 0);
  return steps;
}

export function starsFor(score, thresholds) {
  return thresholds.filter((t) => score >= t).length;
}
