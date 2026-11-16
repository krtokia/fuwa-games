import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, findGroups, specialFor, swap, findHint, shuffle, applyGravity, bonus,
  isWon, isLost, starsFor, holdsPiece, CAT, BOMB, LINE_H, LINE_V,
} from '../../snack-pop/js/core/board.js';
import { LEVELS } from '../../snack-pop/js/core/levels.js';

const FULL8 = Array(8).fill('........');

// 문자 판을 만든다. 숫자 = 간식 색, 'H'/'V' 접두 없이 특수는 따로 넣는다. '.' 은 겹치지 않는 채움
function board(rows, { layout, kinds = 6, moves = 10, goals = [] } = {}) {
  const s = createState({ kinds, moves, layout: layout || rows.map((r) => '.'.repeat(r.length)), goals }, 1);
  // 겹치지 않는 채움 무늬 (3x2 반복이라 3개 줄이 생기지 않음)
  const filler = (r, c) => [[3, 4, 5], [4, 5, 3]][r % 2][c % 3];
  rows.forEach((line, r) => [...line].forEach((ch, c) => {
    if (!holdsPiece(s, r, c)) { s.cells[r][c] = null; return; }
    const p = s.cells[r][c];
    p.special = null;
    p.kind = ch === '.' ? filler(r, c) : Number(ch);
  }));
  return s;
}

const kinds = (s) => s.cells.map((row) => row.map((p) => (p ? p.kind : ' ')).join(''));
const noEmpty = (s) => {
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    if (holdsPiece(s, r, c) && !s.cells[r][c]) return false;
  }
  return true;
};

test('채움 무늬 자체에는 맞춤이 없다', () => {
  const s = board(Array(8).fill('........'));
  assert.equal(findGroups(s).length, 0);
});

test('가로 3개, 세로 3개를 찾는다', () => {
  const s = board(['000.....', '........', '1.......', '1.......', '1.......', '........', '........', '........']);
  const g = findGroups(s);
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => x.cells.size).sort(), [3, 3]);
  assert.equal(specialFor(g[0]), null);
});

test('4개는 줄무늬, 방향은 줄 방향', () => {
  const s = board(['0000....', ...Array(7).fill('........')]);
  assert.equal(specialFor(findGroups(s)[0]), LINE_H);
  const t = board(['1.......', '1.......', '1.......', '1.......', ...Array(4).fill('........')]);
  assert.equal(specialFor(findGroups(t)[0]), LINE_V);
});

test('L 모양은 리본 상자, 5개는 고양이', () => {
  const s = board(['000.....', '0.......', '0.......', ...Array(5).fill('........')]);
  const g = findGroups(s);
  assert.equal(g.length, 1);
  assert.equal(g[0].cells.size, 5);
  assert.equal(specialFor(g[0]), BOMB);
  const t = board(['00000...', ...Array(7).fill('........')]);
  assert.equal(specialFor(findGroups(t)[0]), CAT);
});

test('맞지 않는 바꾸기는 되돌아가고 이동이 줄지 않는다', () => {
  const s = board(FULL8);
  const before = kinds(s);
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.valid, false);
  assert.deepEqual(res.steps.map((x) => x.type), ['swap', 'swapBack']);
  assert.deepEqual(kinds(s), before);
  assert.equal(s.movesLeft, 10);
});

test('맞는 바꾸기: 터지고, 떨어지고, 빈칸이 없다', () => {
  // (1,2) 의 0 을 위로 올리면 0 0 0 가로
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')]);
  const res = swap(s, [1, 2], [0, 2]);
  assert.equal(res.valid, true);
  assert.equal(s.movesLeft, 9);
  const types = res.steps.map((x) => x.type);
  assert.deepEqual(types.slice(0, 3), ['swap', 'clear', 'fall']);
  assert.ok(res.steps[1].cleared.length >= 3);
  assert.ok(s.score > 0);
  assert.ok(noEmpty(s));
  assert.equal(findGroups(s).length, 0, '연쇄가 끝나면 남은 맞춤이 없다');
});

test('바꾼 칸에 특수가 생긴다', () => {
  const s = board(['000.0...', '...1....', ...Array(6).fill('........')]);
  // (1,3) 에 0 이 있어야 하므로 고친다
  s.cells[1][3].kind = 0;
  s.cells[0][3].kind = 1;
  const res = swap(s, [1, 3], [0, 3]);
  assert.equal(res.valid, true);
  const created = res.steps[1].created;
  assert.equal(created.length, 1);
  assert.equal(created[0].special, CAT);
  assert.deepEqual([created[0].r, created[0].c], [0, 3]);
});

test('줄무늬가 터지면 그 줄이 모두 지워진다', () => {
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')]);
  s.cells[0][0].special = LINE_V; // (0,0) 세로 줄무늬
  const res = swap(s, [1, 2], [0, 2]);
  const clear = res.steps[1];
  assert.ok(clear.blasts.some((b) => b.type === 'col' && b.c === 0));
  const col0 = clear.cleared.filter((x) => x.c === 0).length;
  assert.equal(col0, 8);
});

test('리본 상자는 3x3', () => {
  const s = board(['........', '........', '........', '001.....', '..0.....', '........', '........', '........']);
  s.cells[3][1].special = BOMB;
  const res = swap(s, [4, 2], [3, 2]);
  const clear = res.steps[1];
  const area = clear.blasts.find((b) => b.type === 'area');
  assert.ok(area);
  for (let r = 2; r <= 4; r++) for (let c = 0; c <= 2; c++) {
    assert.ok(clear.cleared.some((x) => x.r === r && x.c === c), `(${r},${c})`);
  }
});

test('고양이 + 간식: 그 색이 모두 지워진다', () => {
  const s = board(FULL8);
  s.cells[0][0].special = CAT; s.cells[0][0].kind = -1;
  const target = s.cells[0][1].kind;
  const count = s.cells.flat().filter((p) => p.kind === target).length;
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.valid, true);
  const clear = res.steps[1];
  assert.equal(clear.blasts[0].type, 'color');
  assert.equal(clear.cleared.filter((x) => x.kind === target).length, count);
});

test('고양이 + 고양이: 판 전체', () => {
  const s = board(FULL8);
  s.cells[0][0].special = CAT; s.cells[0][1].special = CAT;
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.steps[1].cleared.length, 64);
});

test('고양이 + 줄무늬: 같은 색이 줄무늬로 바뀐 뒤 터진다', () => {
  const s = board(FULL8);
  s.cells[0][0].special = CAT;
  s.cells[0][1].special = LINE_H;
  const res = swap(s, [0, 0], [0, 1]);
  assert.equal(res.steps[1].type, 'convert');
  assert.ok(res.steps[1].cells.length > 3);
  assert.ok(res.steps[2].blasts.filter((b) => b.type === 'row' || b.type === 'col').length > 3);
  assert.ok(noEmpty(s));
});

test('줄무늬 + 줄무늬: 십자', () => {
  const s = board(FULL8);
  s.cells[4][4].special = LINE_H; s.cells[4][5].special = LINE_H;
  const res = swap(s, [4, 4], [4, 5]);
  const clear = res.steps[1];
  assert.equal(clear.cleared.filter((x) => x.r === 4).length, 8);
  assert.equal(clear.cleared.filter((x) => x.c === 5).length, 8);
});

test('리본 상자 + 리본 상자: 5x5', () => {
  const s = board(FULL8);
  s.cells[4][4].special = BOMB; s.cells[4][3].special = BOMB;
  const res = swap(s, [4, 4], [4, 3]);
  const cleared = res.steps[1].cleared;
  for (let r = 2; r <= 6; r++) for (let c = 1; c <= 5; c++) assert.ok(cleared.some((x) => x.r === r && x.c === c));
});

test('얼음: 그 칸에서 지워지면 한 겹 깨진다', () => {
  const layout = ['iiI.....', ...Array(7).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  // (0,2) 는 2겹 얼음이어서 layout 'I' 를 2번 칸에 두었다
  assert.equal(s.goals[0].target, 4);
  swap(s, [1, 2], [0, 2]);
  // 0,0 / 0,1 은 맞춤 칸이라 얼음이 깨짐
  assert.equal(s.ice[0][0], 0);
  assert.equal(s.ice[0][1], 0);
  assert.ok(s.goals[0].have >= 2);
});

test('상자: 맞춤 옆에서 깨지고, 조각은 상자를 통과해 떨어진다', () => {
  const layout = ['........', 'b.......', ...Array(6).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'box' }] });
  assert.equal(s.cells[1][0], null);
  const res = swap(s, [1, 2], [0, 2]);
  assert.equal(res.valid, true);
  // (0,0) 이 맞춤 칸이라 아래 (1,0) 상자가 깨진다
  assert.equal(res.steps[1].boxes.length, 1);
  assert.equal(s.box[1][0], 0);
  assert.equal(isWon(s), true);
  assert.ok(noEmpty(s));
});

test('구멍 있는 판: 중력 후 빈칸 없음, 구멍엔 조각 없음', () => {
  const layout = ['x......x', '...xx...', ...Array(6).fill('........')];
  const s = createState({ kinds: 5, moves: 5, layout, goals: [] }, 7);
  for (let i = 0; i < 10; i++) s.cells[5][i % 8] = null;
  s.cells[1][3] = null;
  const step = applyGravity(s);
  assert.ok(step.spawns.length > 0);
  assert.ok(noEmpty(s));
  assert.equal(s.cells[0][0], null);
  assert.equal(s.cells[1][3], null);
});

test('모든 레벨: 여러 시드에서 시작판에 맞춤 없고 둘 곳 있음', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 15; seed++) {
      const s = createState(level, seed * 7919);
      assert.equal(findGroups(s).length, 0, `레벨 ${level.id} 시드 ${seed}`);
      assert.ok(findHint(s), `레벨 ${level.id} 시드 ${seed} 힌트`);
      assert.ok(noEmpty(s));
    }
  }
});

test('레벨 데이터: 8x8, 목표 수치 정상, 별 오름차순', () => {
  assert.equal(LEVELS.length, 20);
  for (const l of LEVELS) {
    assert.equal(l.layout.length, 8, `레벨 ${l.id}`);
    for (const row of l.layout) assert.equal(row.length, 8, `레벨 ${l.id}`);
    assert.ok(l.stars[0] < l.stars[1] && l.stars[1] < l.stars[2]);
    for (const g of l.goals) if (g.type === 'collect') assert.ok(g.kind < l.kinds);
    const s = createState(l, 1);
    for (const g of s.goals) assert.ok(g.target > 0, `레벨 ${l.id} ${g.type}`);
  }
});

test('섞기 후 맞춤 없고 둘 곳 있음, 조각 id 보존', () => {
  const s = createState(LEVELS[10], 3);
  const ids = s.cells.flat().map((p) => p.id).sort((a, b) => a - b);
  const step = shuffle(s);
  assert.equal(step.type, 'shuffle');
  assert.equal(findGroups(s).length, 0);
  assert.ok(findHint(s));
  assert.deepEqual(s.cells.flat().map((p) => p.id).sort((a, b) => a - b), ids);
});

test('힌트로 둔 수는 항상 유효', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = createState(LEVELS[seed % 20], seed);
    const [a, b] = findHint(s);
    assert.equal(swap(s, a, b).valid, true, `시드 ${seed}`);
  }
});

test('랜덤 플레이: 힌트만 두어도 상태가 항상 일관된다', () => {
  for (const level of LEVELS) {
    const s = createState(level, level.id * 31);
    while (s.movesLeft > 0 && !isWon(s)) {
      const hint = findHint(s);
      assert.ok(hint, `레벨 ${level.id} 둘 곳`);
      const res = swap(s, ...hint);
      assert.equal(res.valid, true);
      assert.ok(noEmpty(s), `레벨 ${level.id} 빈칸`);
      assert.equal(findGroups(s).length, 0, `레벨 ${level.id} 남은 맞춤`);
      const ids = s.cells.flat().filter(Boolean).map((p) => p.id);
      assert.equal(new Set(ids).size, ids.length, '중복 id');
    }
    if (isWon(s)) {
      bonus(s);
      assert.equal(s.movesLeft, 0);
      assert.ok(noEmpty(s));
    } else {
      assert.equal(isLost(s), true);
    }
  }
});

test('별 계산', () => {
  assert.equal(starsFor(0, [10, 20, 30]), 0);
  assert.equal(starsFor(20, [10, 20, 30]), 2);
  assert.equal(starsFor(99, [10, 20, 30]), 3);
});
