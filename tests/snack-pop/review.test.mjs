// 독립 검토: 간식 팡팡 순수 로직의 버그·불변식 검사.
// 실패하는 테스트 = 찾은 버그. 'todo' = 설계 문서와 어긋날 수 있는 애매한 동작(실패로 세지 않음).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, findGroups, specialFor, swap, findHint, shuffle, applyGravity, bonus,
  canSwap, isWon, holdsPiece, CAT, BOMB, LINE_H, LINE_V,
} from '../../snack-pop/js/core/board.js';
import { guestFor } from '../../snack-pop/js/core/cats.js';
import { LEVELS } from '../../snack-pop/js/core/levels.js';
import { makeRng } from '../../snack-pop/js/core/rng.js';

const FULL8 = Array(8).fill('........');

// board.test.mjs 와 같은 방식: 숫자 = 간식 색, '.' = 3x2 반복 채움(맞춤 없음)
function board(rows, { layout, kinds = 6, moves = 10, goals = [] } = {}) {
  const s = createState({ kinds, moves, layout: layout || rows.map((r) => '.'.repeat(r.length)), goals }, 1);
  const filler = (r, c) => [[3, 4, 5], [4, 5, 3]][r % 2][c % 3];
  rows.forEach((line, r) => [...line].forEach((ch, c) => {
    if (!holdsPiece(s, r, c)) { s.cells[r][c] = null; return; }
    const p = s.cells[r][c];
    p.special = null;
    p.kind = ch === '.' ? filler(r, c) : Number(ch);
  }));
  return s;
}

// ---------- 렌더러가 보는 단계(step) 불변식 검사기 ----------

function snap(s) {
  const m = new Map();
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const p = s.cells[r][c];
    if (p) m.set(p.id, { r, c, kind: p.kind, special: p.special });
  }
  return m;
}

// before: 단계 전 판(snap), steps 를 차례로 적용해 렌더러가 아는 판을 흉내 내고 실제 판과 비교한다.
// 돌려주는 값: { errs, scoreSum }  scoreSum = 렌더러가 단계에서 읽는 점수 합
function replay(s, before, steps) {
  const errs = [];
  const sim = new Map([...before].map(([id, p]) => [id, { ...p }]));
  const gone = new Set();
  let scoreSum = 0;
  // 단계마다 얼음 상태(갇힘)를 따라간다: 끝 상태 + 이번 수에 깬 겹 = 시작 상태
  const ice = s.ice.map((row) => row.slice());
  for (const st of steps) if (st.type === 'clear') for (const ic of st.ice) ice[ic.r][ic.c]++;
  steps.forEach((st, i) => {
    const E = (m) => errs.push(`step${i} ${st.type}: ${m}`);
    if (st.type === 'swap' || st.type === 'swapBack') {
      const [A, B] = st.ids.map((id) => sim.get(id));
      if (!A || !B) return E('없는 id');
      if (st.type === 'swap') {
        if (A.r !== st.a[0] || A.c !== st.a[1] || B.r !== st.b[0] || B.c !== st.b[1]) E('swap 위치 불일치');
        [A.r, A.c, B.r, B.c] = [st.b[0], st.b[1], st.a[0], st.a[1]];
      } else {
        [A.r, A.c, B.r, B.c] = [st.a[0], st.a[1], st.b[0], st.b[1]];
      }
    } else if (st.type === 'clear') {
      scoreSum += st.score;
      const ids = new Set();
      for (const cl of st.cleared) {
        if (ids.has(cl.id)) E(`cleared 중복 ${cl.id}`);
        ids.add(cl.id);
        const P = sim.get(cl.id);
        if (!P) { E(`cleared 없는 id ${cl.id}`); continue; }
        if (P.r !== cl.r || P.c !== cl.c) E(`cleared 위치 불일치 ${cl.id}`);
        sim.delete(cl.id); gone.add(cl.id);
      }
      for (const cr of st.created) {
        for (const f of cr.from) if (!ids.has(f)) E(`from ${f} 이 cleared 에 없음`);
        if (gone.has(cr.id)) E(`created id ${cr.id} 가 이미 지워진 id`);
        for (const [id, P] of sim) if (id !== cr.id && P.r === cr.r && P.c === cr.c) E(`created 칸에 다른 조각 ${id}`);
        sim.set(cr.id, { r: cr.r, c: cr.c, kind: cr.kind, special: cr.special });
      }
      const bx = new Set(st.boxes.map((b) => b.r * 64 + b.c));
      if (bx.size !== st.boxes.length) E('한 단계에 같은 상자를 두 번 깸');
      const ic = new Set(st.ice.map((b) => b.r * 64 + b.c));
      if (ic.size !== st.ice.length) E('한 단계에 같은 얼음을 두 번 깸');
      for (const x of st.ice) {
        ice[x.r][x.c]--;
        if (ice[x.r][x.c] !== x.left) E(`얼음 겹 불일치 (${x.r},${x.c})`);
        if (st.cleared.some((cl) => cl.r === x.r && cl.c === x.c)) E(`갇힌 간식이 지워짐 (${x.r},${x.c})`);
      }
    } else if (st.type === 'fall') {
      for (const m of st.moves) {
        const P = sim.get(m.id);
        if (!P) { E(`move 없는 id ${m.id}`); continue; }
        if (ice[m.from[0]][m.from[1]] > 0) E(`갇힌 간식이 떨어짐 ${m.id}`);
        if (ice[m.to[0]][m.to[1]] > 0) E(`갇힌 칸으로 떨어짐 ${m.id}`);
        if (P.r !== m.from[0] || P.c !== m.from[1]) E(`move from 불일치 ${m.id}`);
        if (m.to[1] !== m.from[1] || m.to[0] <= m.from[0]) E(`move 가 아래로가 아님 ${m.id}`);
        P.r = m.to[0]; P.c = m.to[1];
      }
      for (const sp of st.spawns) {
        if (sim.has(sp.id) || gone.has(sp.id)) E(`spawn id 재사용 ${sp.id}`);
        if (!(sp.fromRow < sp.to[0])) E(`spawn fromRow ${sp.fromRow} >= to ${sp.to[0]}`);
        sim.set(sp.id, { r: sp.to[0], c: sp.to[1], kind: sp.kind, special: null });
      }
      // 떨어진 뒤: 겹침 없고, 모든 칸이 차 있고, 실제 판과 일치(다음 clear 전)
      const seen = new Set();
      for (const P of sim.values()) {
        const k = P.r * 64 + P.c;
        if (seen.has(k)) E(`(${P.r},${P.c}) 에 두 조각`);
        seen.add(k);
        if (!holdsPiece(s, P.r, P.c) && s.box[P.r]?.[P.c] === 0) E(`판 밖/구멍 (${P.r},${P.c})`);
      }
    } else if (st.type === 'convert') {
      if (st.bonus) scoreSum += st.score;
      for (const cl of st.cells) {
        const P = sim.get(cl.id);
        if (!P) { E(`convert 없는 id ${cl.id}`); continue; }
        if (P.r !== cl.r || P.c !== cl.c) E(`convert 위치 불일치 ${cl.id}`);
        P.special = cl.special;
      }
    } else if (st.type === 'gift') {
      const P = sim.get(st.id);
      if (!P) E(`gift 없는 id ${st.id}`);
      else {
        if (P.r !== st.r || P.c !== st.c) E(`gift 위치 불일치 ${st.id}`);
        if (P.special) E(`gift 가 이미 특수인 조각에 ${st.id}`);
        P.special = st.special; P.kind = st.kind;
      }
    } else if (st.type === 'request' || st.type === 'requestEnd') {
      // 판을 바꾸지 않는 알림
    } else if (st.type === 'shuffle') {
      const ids = new Set(st.pieces.map((p) => p.id));
      // 얼음에 갇힌 간식은 섞이지 않는다
      const free = [...sim.values()].filter((P) => !(ice[P.r][P.c] > 0)).length;
      if (ids.size !== free) E(`shuffle 조각 수 ${ids.size} != 갇히지 않은 ${free}`);
      for (const p of st.pieces) {
        const P = sim.get(p.id);
        if (!P) { E(`shuffle 없는 id ${p.id}`); continue; }
        P.r = p.to[0]; P.c = p.to[1]; P.kind = p.kind;
      }
    } else {
      E('모르는 단계');
    }
  });
  const real = snap(s);
  if (real.size !== sim.size) errs.push(`끝: 실제 ${real.size} 조각, 렌더러 ${sim.size}`);
  for (const [id, P] of real) {
    const Q = sim.get(id);
    if (!Q) { errs.push(`끝: id ${id} 를 렌더러가 모름`); continue; }
    if (Q.r !== P.r || Q.c !== P.c || Q.kind !== P.kind || Q.special !== P.special) {
      errs.push(`끝: id ${id} 렌더러 ${JSON.stringify(Q)} 실제 ${JSON.stringify(P)}`);
    }
  }
  return { errs, scoreSum };
}

function boardOk(s) {
  const errs = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    if (holdsPiece(s, r, c) && !s.cells[r][c]) errs.push(`빈칸 (${r},${c})`);
    if (!holdsPiece(s, r, c) && s.cells[r][c]) errs.push(`구멍/상자에 조각 (${r},${c})`);
  }
  if (findGroups(s).length) errs.push('남은 맞춤');
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    if (s.ice[r][c] > 0 && s.cells[r][c] && s.cells[r][c].special) errs.push(`갇힌 칸에 특수 (${r},${c})`);
  }
  const ids = s.cells.flat().filter(Boolean).map((p) => p.id);
  if (new Set(ids).size !== ids.length) errs.push('중복 id');
  return errs;
}

// 한 판을 끝까지 둔다. mode: 'hint' | 'random' | 'mixed', sprinkle: 가끔 특수를 뿌려 조합을 자주 만든다
function playGame(level, seed, { mode = 'mixed', sprinkle = false, maxMoves = 60, guest = guestFor(level.id) } = {}) {
  const s = createState(level, seed, { guest });
  const rng = makeRng(seed ^ 0x9e3779b9);
  const SP = [LINE_H, LINE_V, BOMB, CAT];
  const errs = [];
  for (let mv = 0; s.movesLeft > 0 && mv < maxMoves && !isWon(s); mv++) {
    if (sprinkle && rng() < 0.3) {
      for (let t = 0; t < 3; t++) {
        const y = rng.int(s.rows), x = rng.int(s.cols);
        const p = s.cells[y][x];
        if (!p || s.ice[y][x] > 0) continue; // 갇힌 칸엔 특수가 생기지 않는다
        p.special = SP[rng.int(4)];
        if (p.special === CAT) p.kind = -1;
      }
    }
    let a, b;
    if (mode === 'hint' || (mode === 'mixed' && rng() < 0.5)) {
      const h = findHint(s);
      if (!h) { errs.push(`m${mv}: 둘 곳 없음`); break; }
      [a, b] = h;
    } else {
      a = [rng.int(s.rows), rng.int(s.cols)];
      b = rng() < 0.5 ? [a[0], a[1] + 1] : [a[0] + 1, a[1]];
      if (!canSwap(s, a, b)) continue;
    }
    const before = snap(s);
    const sc0 = s.score;
    const res = swap(s, a, b);
    const { errs: e, scoreSum } = replay(s, before, res.steps);
    errs.push(...e.map((x) => `m${mv}: ${x}`));
    if (scoreSum !== s.score - sc0) errs.push(`m${mv}: 단계 점수 합 ${scoreSum} != 실제 ${s.score - sc0}`);
    errs.push(...boardOk(s).map((x) => `m${mv}: ${x}`));
    if (mode === 'hint') assert.equal(res.valid, true, '힌트 수는 유효해야 함');
  }
  if (isWon(s) && s.movesLeft > 0) {
    const before = snap(s);
    const sc0 = s.score;
    const steps = bonus(s);
    const { errs: e, scoreSum } = replay(s, before, steps);
    errs.push(...e.map((x) => `bonus: ${x}`));
    if (scoreSum !== s.score - sc0) errs.push(`bonus: 단계 점수 합 ${scoreSum} != 실제 ${s.score - sc0}`);
    errs.push(...boardOk(s).map((x) => `bonus: ${x}`));
  }
  return errs;
}

// ================= 찾은 버그 =================

test('얼음: 4개 줄에 갇힌 간식이 끼면 특수는 풀린 칸에, 갇힌 칸은 얼음만 깨진다', () => {
  // (1,3) 의 0 을 위로 올리면 0 0 0 0 가로. (0,1) 은 얼음 1겹.
  const layout = ['.i......', ...Array(7).fill('........')];
  const s = board(['0001....', '...0....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  const res = swap(s, [1, 3], [0, 3]);
  const clear = res.steps[1];
  assert.equal(clear.created.length, 1);
  assert.deepEqual([clear.created[0].r, clear.created[0].c, clear.created[0].special], [0, 3, LINE_H]);
  assert.ok(clear.ice.some((x) => x.r === 0 && x.c === 1 && x.left === 0));
  assert.ok(!clear.cleared.some((x) => x.r === 0 && x.c === 1), '갇힌 간식은 남아야 함');
  assert.ok(!clear.created[0].from.includes(s.cells[0][1].id), '갇힌 간식은 특수로 모여들지 않음');
});

test('BUG: 보너스에서 일반 간식이 없으면 남은 이동 점수가 어떤 단계에도 실리지 않는다', () => {
  const s = board(FULL8, { moves: 3, goals: [] });
  for (const row of s.cells) for (const p of row) p.special = LINE_H; // 판 전체가 특수
  const before = snap(s);
  const sc0 = s.score;
  const steps = bonus(s);
  const { errs, scoreSum } = replay(s, before, steps);
  assert.deepEqual(errs, []);
  // 3 × BONUS_POINTS(300) 가 s.score 에는 들어가지만 convert 단계가 없어 HUD 연출에서 빠진다
  assert.equal(scoreSum, s.score - sc0, '단계 점수 합과 실제 점수 차이');
});

// 결정: 특수로 바뀌는 간식도 맞춘 칸이므로 모으기에 센다(step.kept 로 알려 준다)
test('4개 맞춤에서 특수가 되는 간식도 모으기에 센다', () => {
  const s = board(['0010....', '..0.....', ...Array(6).fill('........')], { goals: [{ type: 'collect', kind: 0, n: 99 }] });
  const res = swap(s, [1, 2], [0, 2]);
  const clear = res.steps[1];
  assert.equal(clear.cleared.filter((x) => x.kind === 0).length, 3);
  assert.equal(clear.kept.length, 1);
  assert.ok(s.goals[0].have >= 4);
});

// ================= 규칙 검사(통과 = 정상 확인) =================

test('세로 4개(가로 바꾸기로 완성)는 세로 줄무늬, 바꾼 칸에 생긴다', () => {
  // 열 2: (0..2)=0, (3,3)=0 을 왼쪽으로 → 세로 0000
  const s = board(['..0.....', '..0.....', '..0.....', '..10....', ...Array(4).fill('........')]);
  const res = swap(s, [3, 3], [3, 2]);
  const cr = res.steps[1].created;
  assert.equal(cr.length, 1);
  assert.deepEqual([cr[0].r, cr[0].c, cr[0].special, cr[0].kind], [3, 2, LINE_V, 0]);
  assert.equal(cr[0].from.length, 3);
});

test('ㄱ 모양: 바꾼 칸에 리본 상자', () => {
  const t = board(['00.0....', '..0.....', '..0.....', ...Array(5).fill('........')]);
  // (0,3) 의 0 을 (0,2) 로: 가로 (0,0..2) + 세로 (0..2,2) 의 ㄱ자, 교차점 = 바꾼 칸
  const res = swap(t, [0, 3], [0, 2]);
  assert.equal(res.valid, true);
  const cr = res.steps[1].created;
  assert.equal(cr.length, 1);
  assert.equal(cr[0].special, BOMB);
  assert.deepEqual([cr[0].r, cr[0].c], [0, 2]);
});

test('가로 5 + 세로 3 은 고양이(5 우선)', () => {
  const s = board(['00000...', '0.......', '0.......', ...Array(5).fill('........')]);
  const g = findGroups(s);
  assert.equal(g.length, 1);
  assert.equal(specialFor(g[0]), CAT);
});

test('가로 4 + 세로 3 은 리본 상자', () => {
  const s = board(['0000....', '0.......', '0.......', ...Array(5).fill('........')]);
  assert.equal(specialFor(findGroups(s)[0]), BOMB);
});

test('고양이는 맞춤 줄에 끼지 않는다', () => {
  const s = board(['000.....', ...Array(7).fill('........')]);
  s.cells[0][1].special = CAT; s.cells[0][1].kind = -1;
  assert.equal(findGroups(s).length, 0);
});

test('구멍·상자는 줄을 끊는다', () => {
  const s = board(['00000...', ...Array(7).fill('........')], { layout: ['..x.....', ...Array(7).fill('........')] });
  assert.equal(findGroups(s).length, 0);
  const t = board(['00000...', ...Array(7).fill('........')], { layout: ['..b.....', ...Array(7).fill('........')] });
  assert.equal(findGroups(t).length, 0);
});

test('줄무늬 연쇄: 가로 줄무늬가 세로 줄무늬를 터뜨린다', () => {
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')]);
  s.cells[0][0].special = LINE_H;
  s.cells[0][6].special = LINE_V;
  const res = swap(s, [1, 2], [0, 2]);
  const clear = res.steps[1];
  assert.ok(clear.blasts.some((b) => b.type === 'row' && b.r === 0));
  assert.ok(clear.blasts.some((b) => b.type === 'col' && b.c === 6));
  assert.equal(clear.cleared.filter((x) => x.c === 6).length, 8);
});

test('고양이가 터지면(연쇄로) 판에 가장 많은 색을 지운다', () => {
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')]);
  s.cells[0][5].special = CAT; s.cells[0][5].kind = -1;
  s.cells[0][0].special = LINE_H;
  const res = swap(s, [1, 2], [0, 2]);
  const color = res.steps[1].blasts.find((b) => b.type === 'color');
  assert.ok(color);
  assert.ok(color.kind >= 0);
  for (const [r, c] of color.targets) assert.ok(res.steps[1].cleared.some((x) => x.r === r && x.c === c));
});

test('줄무늬 + 리본 상자: 3줄 십자', () => {
  const s = board(FULL8);
  s.cells[4][4].special = LINE_V; s.cells[4][5].special = BOMB;
  const res = swap(s, [4, 4], [4, 5]);
  const cl = res.steps[1].cleared;
  for (let r = 3; r <= 5; r++) assert.equal(cl.filter((x) => x.r === r).length, 8, `행 ${r}`);
  for (let c = 4; c <= 6; c++) assert.equal(cl.filter((x) => x.c === c).length, 8, `열 ${c}`);
});

test('고양이 + 리본 상자: 그 색이 모두 리본 상자로 바뀐 뒤 터진다', () => {
  const s = board(FULL8);
  s.cells[0][0].special = CAT; s.cells[0][0].kind = -1;
  s.cells[0][1].special = BOMB;
  const kind = s.cells[0][1].kind;
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.steps[1].type, 'convert');
  assert.ok(res.steps[1].cells.every((x) => x.special === BOMB && x.kind === kind));
  assert.ok(res.steps[2].blasts.filter((b) => b.type === 'area').length >= res.steps[1].cells.length);
});

test('특수 + 일반 바꾸기가 안 맞으면 되돌아간다', () => {
  const s = board(FULL8);
  s.cells[0][0].special = LINE_H;
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.valid, false);
  assert.equal(s.cells[0][0].special, LINE_H);
});

test('상자: 맞춤 옆 + 같은 단계 폭발이 겹쳐도 한 번만 깨진다', () => {
  const layout = ['........', 'B.......', ...Array(6).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'box' }] });
  s.cells[0][1].special = LINE_V; // 열 1 을 터뜨림. (1,0) 상자는 맞춤 옆 + 줄무늬 아님
  s.cells[0][0].special = LINE_V; // 열 0: (1,0) 상자에 직접 폭발
  const res = swap(s, [1, 2], [0, 2]);
  const clear = res.steps[1];
  assert.equal(clear.boxes.filter((b) => b.r === 1 && b.c === 0).length, 1);
  assert.equal(s.box[1][0], 1);
});

test('얼음 2겹: 한 단계에 한 겹만', () => {
  const layout = ['I.......', ...Array(7).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  s.cells[0][1].special = LINE_V; s.cells[2][0].special = LINE_H; // (0,0) 을 여러 번 겨냥해도
  const res = swap(s, [1, 2], [0, 2]);
  assert.equal(res.steps[1].ice.filter((x) => x.r === 0 && x.c === 0).length, 1);
});

test('중력: 구멍과 상자를 건너뛰고, 새 조각 fromRow 는 도착 칸보다 위, 위쪽일수록 더 높게', () => {
  const layout = ['........', '..x.....', '..b.....', ...Array(5).fill('........')];
  const s = createState({ kinds: 5, moves: 5, layout, goals: [] }, 3);
  const top = s.cells[0][2];
  s.cells[3][2] = null; s.cells[4][2] = null; s.cells[7][2] = null;
  const step = applyGravity(s);
  assert.equal(s.cells[1][2], null);
  assert.equal(s.cells[2][2], null);
  const m = step.moves.find((x) => x.id === top.id);
  assert.deepEqual(m.to, [5, 2], '맨 위 조각이 구멍·상자를 지나 내려감(남은 조각 0,5,6 → 5,6,7)');
  const sp = step.spawns.filter((x) => x.to[1] === 2).sort((a, b) => b.to[0] - a.to[0]);
  assert.equal(sp.length, 3);
  for (let i = 1; i < sp.length; i++) assert.ok(sp[i].fromRow < sp[i - 1].fromRow);
  for (const x of sp) assert.ok(x.fromRow < x.to[0]);
});

test('힌트가 null 이면 정말로 둘 곳이 없다(모든 바꾸기가 무효)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = createState({ kinds: 6, moves: 5, layout: ['....', '....', '....'], goals: [] }, seed);
    if (findHint(s) || findGroups(s).length) continue;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      for (const b of [[r, c + 1], [r + 1, c]]) {
        if (!canSwap(s, [r, c], b)) continue;
        const t = structuredClone({ cells: s.cells });
        const res = swap(s, [r, c], b);
        assert.equal(res.valid, false, `시드 ${seed} (${r},${c})-(${b})`);
        assert.deepEqual(s.cells.map((row) => row.map((p) => p && p.id)), t.cells.map((row) => row.map((p) => p && p.id)));
      }
    }
  }
});

test('섞기: 특수 유지, 상자·구멍 칸 건드리지 않음', () => {
  const s = createState(LEVELS[19], 5);
  s.cells[2][2].special = BOMB;
  const id = s.cells[2][2].id;
  shuffle(s);
  const p = s.cells.flat().find((x) => x && x.id === id);
  assert.equal(p.special, BOMB);
  assert.deepEqual(boardOk(s), []);
});

test('목표 집계: 모으기·얼음·상자 have 가 단계 합과 같다', () => {
  const s = createState(LEVELS[19], 11);
  const g0 = s.goals.map((g) => ({ ...g }));
  const tally = { ice: 0, box: 0 };
  for (let i = 0; i < 15 && s.movesLeft > 0; i++) {
    const res = swap(s, ...findHint(s));
    for (const st of res.steps) if (st.type === 'clear') { tally.ice += st.ice.length; tally.box += st.boxes.length; }
  }
  for (const [i, g] of s.goals.entries()) {
    if (g.type === 'ice' || g.type === 'box') assert.equal(g.have, Math.min(g0[i].target, tally[g.type]));
    if (g.type === 'score') assert.equal(g.have, Math.min(g.target, s.score));
  }
});

// ================= 성질 검사(여러 시드) =================

test('성질: 힌트로만 두기 — 모든 레벨, 단계 불변식', () => {
  const errs = [];
  for (const level of LEVELS) for (let seed = 1; seed <= 6; seed++) {
    errs.push(...playGame(level, level.id * 1000 + seed, { mode: 'hint' }).map((e) => `L${level.id} s${seed} ${e}`));
  }
  assert.deepEqual(errs.slice(0, 20), []);
});

test('성질: 무작위 바꾸기(무효 포함) — 모든 레벨, 단계 불변식', () => {
  const errs = [];
  for (const level of LEVELS) for (let seed = 1; seed <= 6; seed++) {
    errs.push(...playGame(level, level.id * 7777 + seed, { mode: 'random', maxMoves: 120 }).map((e) => `L${level.id} s${seed} ${e}`));
  }
  assert.deepEqual(errs.slice(0, 20), []);
});

test('성질: 특수를 뿌려 조합이 잦은 판 — 단계 불변식', () => {
  const errs = [];
  for (const level of LEVELS) for (let seed = 1; seed <= 10; seed++) {
    errs.push(...playGame(level, level.id * 313 + seed, { mode: 'mixed', sprinkle: true }).map((e) => `L${level.id} s${seed} ${e}`));
  }
  assert.deepEqual(errs.slice(0, 20), []);
});

test('성질: 모든 특수 조합 쌍 — 단계 불변식', () => {
  const SP = [null, LINE_H, LINE_V, BOMB, CAT];
  const errs = [];
  for (const x of SP) for (const y of SP) {
    if (!x && !y) continue;
    for (const level of [LEVELS[0], LEVELS[5], LEVELS[8], LEVELS[19]]) for (let seed = 1; seed <= 4; seed++) {
      const s = createState(level, seed * 17);
      const h = findHint(s);
      const [a, b] = h;
      const pa = s.cells[a[0]][a[1]], pb = s.cells[b[0]][b[1]];
      pa.special = x; if (x === CAT) pa.kind = -1;
      pb.special = y; if (y === CAT) pb.kind = -1;
      const before = snap(s);
      const sc0 = s.score;
      const res = swap(s, a, b);
      const { errs: e, scoreSum } = replay(s, before, res.steps);
      const tag = `L${level.id} s${seed} ${x}+${y}`;
      errs.push(...e.map((m) => `${tag} ${m}`), ...boardOk(s).map((m) => `${tag} ${m}`));
      if (scoreSum !== s.score - sc0) errs.push(`${tag} 점수 합`);
    }
  }
  assert.deepEqual(errs.slice(0, 20), []);
});
