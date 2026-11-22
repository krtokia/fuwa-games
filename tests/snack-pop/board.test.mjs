import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, canSwap, findGroups, specialFor, swap, findHint, shuffle, applyGravity, bonus,
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

test('얼음: 갇힌 간식은 못 바꾸고, 줄에 끼면 얼음만 깨지고 남는다', () => {
  const layout = ['iI......', ...Array(7).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  assert.equal(s.goals[0].target, 3);
  assert.equal(canSwap(s, [0, 0], [1, 0]), false);
  assert.equal(canSwap(s, [0, 1], [0, 2]), false);
  const ids = [s.cells[0][0].id, s.cells[0][1].id];
  const res = swap(s, [1, 2], [0, 2]);
  assert.equal(res.valid, true);
  const clear = res.steps[1];
  // 풀린 칸(0,2) 만 지워지고, 갇힌 두 칸은 얼음만 한 겹씩
  assert.deepEqual(clear.cleared.map((x) => [x.r, x.c]), [[0, 2]]);
  assert.deepEqual(clear.ice.map((x) => [x.r, x.c, x.left]).sort(), [[0, 0, 0], [0, 1, 1]]);
  assert.equal(s.cells[0][0].id, ids[0]);
  assert.equal(s.cells[0][1].id, ids[1]);
  assert.equal(s.collected[0], 1, '갇힌 간식은 모으기에 세지 않음');
  assert.equal(s.goals[0].have, 2);
  // 다 깨진 (0,0) 은 이제 움직일 수 있고, 한 겹 남은 (0,1) 은 아직 못 움직인다
  assert.equal(canSwap(s, [0, 0], [1, 0]), true);
  assert.equal(canSwap(s, [0, 1], [1, 1]), false);
});

test('얼음: 바로 옆에서 맞춰도 한 겹 깨지고, 한 단계에 한 겹만', () => {
  const layout = ['........', '...I....', ...Array(6).fill('........')];
  const s = board(['001.....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  const id = s.cells[1][3].id;
  const res = swap(s, [1, 2], [0, 2]); // 0 0 0 이 (0,0)~(0,2): (1,3) 과는 대각선이라 안 닿음
  assert.ok(!res.steps[1].ice.some((x) => x.r === 1 && x.c === 3));
  const s2 = board(['0010....', '..0.....', ...Array(6).fill('........')], { layout, goals: [{ type: 'ice' }] });
  const id2 = s2.cells[1][3].id;
  const res2 = swap(s2, [1, 2], [0, 2]); // 0 0 0 0 이 (0,0)~(0,3): (0,3) 이 (1,3) 바로 위
  const hits = res2.steps[1].ice.filter((x) => x.r === 1 && x.c === 3);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].left, 1);
  assert.equal(s2.cells[1][3].id, id2);
  assert.ok(id);
});

test('얼음: 갇힌 간식은 떨어지지 않고, 위 간식은 그 칸을 지나 떨어진다', () => {
  const layout = ['........', '........', '........', 'i.......', ...Array(4).fill('........')];
  const rows = Array(8).fill('........');
  rows[5] = '1101....';
  const s = board(rows, { layout });
  const frozen = s.cells[3][0].id;
  const above = s.cells[2][0].id;
  const res = swap(s, [5, 2], [5, 3]);
  assert.equal(res.valid, true);
  const fall = res.steps.find((x) => x.type === 'fall');
  assert.ok(!fall.moves.some((m) => m.id === frozen), '갇힌 간식이 떨어짐');
  assert.ok(fall.moves.some((m) => m.id === above && m.to[0] === 4 && m.to[1] === 0), '위 간식이 갇힌 칸을 지나 (4,0) 으로');
  // (연쇄 중 옆 맞춤으로 얼음이 깨지면 그 뒤엔 풀려 떨어질 수 있다)
  if (s.ice[3][0] > 0) assert.equal(s.cells[3][0].id, frozen);
  assert.ok(noEmpty(s));
});

test('얼음: 섞어도 갇힌 간식은 제자리', () => {
  const layout = ['i.i.i.i.', ...Array(7).fill('........')];
  const s = board(Array(8).fill('........'), { layout });
  const before = [0, 2, 4, 6].map((c) => s.cells[0][c].id);
  const st = shuffle(s);
  assert.deepEqual([0, 2, 4, 6].map((c) => s.cells[0][c].id), before);
  assert.ok(st.pieces.every((p) => !(p.to[0] === 0 && p.to[1] % 2 === 0)));
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
