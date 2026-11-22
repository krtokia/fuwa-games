// 독립 리뷰: 구경 고양이의 부탁(v2). 실패하는 테스트 = 찾은 버그.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, swap, findHint, findGroups, holdsPiece, isWon, isLost, bonus, CAT, BOMB, LINE_H, LINE_V,
} from '../../snack-pop/js/core/board.js';
import { CATS, guestFor, withRo, isToy } from '../../snack-pop/js/core/cats.js';
import { LEVELS } from '../../snack-pop/js/core/levels.js';
import { makeRng } from '../../snack-pop/js/core/rng.js';

const FULL = Array(8).fill('........');
const bigScore = (moves = 40) => ({ kinds: 5, moves, layout: FULL, goals: [{ type: 'score', n: 9999999 }] });
const play = (s) => swap(s, ...findHint(s));
const types = (res) => res.steps.map((x) => x.type);

// 무작위로 둘 수 있는 수를 고른다(힌트만 쓰면 패턴이 좁다)
function randomMove(s, rng) {
  const moves = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const b = [r + dr, c + dc];
      if (holdsPiece(s, r, c) && holdsPiece(s, ...b)) moves.push([[r, c], b]);
    }
  }
  return moves[rng.int(moves.length)];
}

// ---------- 턴 수 ----------

test('리뷰: 부탁 턴 T = 그 뒤 정확히 T 수 (T-1 수까지 살아 있고, T 번째 수에 끝난다)', () => {
  for (const guest of Object.keys(CATS)) {
    const s = createState(bigScore(), 21, { guest });
    play(s);
    assert.ok(s.request, guest);
    const T = s.request.turns;
    for (let i = 1; i <= T; i++) {
      s.request.kind = 99; // 못 채움
      const res = play(s);
      const end = res.steps.find((x) => x.type === 'requestEnd');
      if (i < T) {
        assert.ok(!end, `${guest}: ${i}번째 수에 너무 일찍 끝남`);
        assert.equal(s.request.turnsLeft, T - i);
      } else {
        assert.ok(end && end.ok === false, `${guest}: ${T}번째 수에 끝나야 함`);
      }
    }
  }
});

test('리뷰: T 번째(마지막) 수에 채우면 성공(삐짐 아님)', () => {
  const s = createState(bigScore(), 23, { guest: 'nabi' });
  play(s);
  const T = s.request.turns;
  for (let i = 1; i < T; i++) { s.request.kind = 99; play(s); }
  assert.equal(s.request.turnsLeft, 1);
  s.request.kind = 0;
  s.request.have = s.request.need; // 이번 수 안에 다 찼다고 본다
  const res = play(s);
  const end = res.steps.find((x) => x.type === 'requestEnd');
  assert.equal(end.ok, true);
  assert.ok(res.steps.some((x) => x.type === 'gift'));
});

test('리뷰: 남은 이동이 딱 T 면 부탁하고, 그 부탁은 마지막 수에서 끝난다(매달린 부탁 없음)', () => {
  const T = CATS.shuri.turns;
  const s = createState(bigScore(T + 1), 31, { guest: 'shuri' });
  const r1 = play(s);
  assert.equal(s.movesLeft, T);
  assert.ok(types(r1).includes('request'));
  while (s.movesLeft > 0) { if (s.request) s.request.kind = 99; play(s); }
  assert.equal(s.request, null);
});

test('리뷰: 쉬는 턴 — 끝난 수 뒤 rest 번째 수에 새 부탁(그 전엔 없음)', () => {
  for (const guest of Object.keys(CATS)) {
    const s = createState(bigScore(60), 41, { guest });
    play(s);
    const T = s.request.turns;
    for (let i = 0; i < T; i++) { s.request.kind = 99; play(s); }
    assert.equal(s.request, null);
    const rest = CATS[guest].rest;
    for (let i = 1; i <= rest; i++) {
      const has = types(play(s)).includes('request');
      assert.equal(has, i === rest, `${guest} rest ${rest}: ${i}번째 쉬는 수`);
    }
  }
});

// ---------- 이긴 뒤 ----------

test('리뷰 BUG: 이기는 수에 아직 진행 중인 부탁이 state.request 에 남는다(보너스 타임에도 계속 집계)', () => {
  const s = createState(bigScore(), 5, { guest: 'fuwa' });
  play(s);
  assert.ok(s.request);
  s.request.kind = 99; // 이번 수에 못 채움, 턴은 남음
  s.goals[0].target = s.score + 1; // 다음 수로 이긴다
  play(s);
  assert.ok(isWon(s));
  assert.equal(s.request, null, '이긴 뒤엔 부탁이 없어야 하는데 진행 중 부탁이 그대로 남음');
});

test('리뷰 BUG(같은 원인): 이긴 뒤 bonus() 가 남은 부탁의 have 를 올린다', () => {
  const s = createState(bigScore(), 5, { guest: 'fuwa' });
  play(s);
  s.goals[0].target = s.score + 1;
  const kind = s.request.kind;
  s.request.kind = 99;
  play(s);
  assert.ok(isWon(s));
  if (s.request) s.request.kind = kind;
  const have0 = s.request ? s.request.have : 0;
  bonus(s);
  assert.equal(s.request ? s.request.have : 0, have0, '보너스 타임 클리어가 부탁에 집계됨');
});

test('리뷰: 이기는 수에서 턴이 다 된 부탁은 조용히 사라진다(삐짐 없음)', () => {
  const s = createState(bigScore(), 5, { guest: 'shuri' });
  play(s);
  for (let i = 0; i < s.request.turns - 1; i++) { s.request.kind = 99; play(s); }
  s.request.kind = 99;
  s.goals[0].target = s.score + 1;
  const res = play(s);
  assert.ok(isWon(s));
  assert.ok(!types(res).includes('requestEnd'));
  assert.equal(s.request, null);
});

// ---------- 집계 = 단계 이벤트(렌더러 shownReq 와 같은 방식) ----------

// main.js onStep 과 같은 방식으로 단계에서 have 를 다시 센다
function shownHave(req0, steps) {
  if (!req0) return null;
  let have = req0.have;
  for (const st of steps) {
    if (st.type === 'requestEnd') return 'ended';
    if (st.type !== 'clear') continue;
    have = Math.min(req0.need, have + [...st.cleared, ...st.kept].filter((c) => c.kind === req0.kind).length);
  }
  return have;
}

test('리뷰: 모든 레벨·무작위+특수 조합 — 엔진 have == 단계(cleared+kept)로 센 have', () => {
  const SP = [LINE_H, LINE_V, BOMB, CAT];
  let checked = 0;
  for (const l of LEVELS) {
    for (let seed = 1; seed <= 4; seed++) {
      const s = createState(l, seed * 101 + l.id, { guest: guestFor(l.id) });
      const rng = makeRng(seed * 7 + l.id);
      for (let n = 0; n < 60 && s.movesLeft > 0 && !isWon(s); n++) {
        // 가끔 특수 뿌리기(조합·연쇄 집계 확인)
        if (rng() < 0.3) {
          const r = rng.int(s.rows), c = rng.int(s.cols);
          const p = s.cells[r][c];
          if (p && holdsPiece(s, r, c) && !p.special) {
            const sp = SP[rng.int(4)];
            p.special = sp; if (sp === CAT) p.kind = -1;
          }
        }
        const req0 = s.request ? { ...s.request } : null;
        const mv = rng() < 0.5 ? findHint(s) : randomMove(s, rng);
        if (!mv) break;
        const res = swap(s, ...mv);
        if (!res.valid) continue;
        const sh = shownHave(req0, res.steps);
        if (sh === null || sh === 'ended') continue;
        if (!s.request) continue; // 이긴 수 등
        assert.equal(s.request.have, sh, `레벨 ${l.id} seed ${seed} 수 ${n}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 50, `확인한 수 ${checked}`);
});

// ---------- 선물 ----------

test('리뷰: 선물은 판의 일반 간식에만, 맞춤을 만들지 않고, 뒤에도 둘 곳이 있다(모든 레벨·고양이)', () => {
  let gifts = 0;
  for (const l of LEVELS) for (const guest of Object.keys(CATS)) {
    const s = createState(l, l.id * 13 + guest.length, { guest });
    const rng = makeRng(l.id * 3 + guest.length);
    for (let n = 0; n < 40 && s.movesLeft > 0 && !isWon(s); n++) {
      if (s.request) s.request.have = s.request.need; // 매번 선물이 나오게
      const before = new Map();
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (s.cells[r][c]) before.set(s.cells[r][c].id, { ...s.cells[r][c] });
      const res = swap(s, ...findHint(s));
      const gi = res.steps.findIndex((x) => x.type === 'gift');
      if (gi >= 0) {
        gifts++;
        const g = res.steps[gi];
        assert.ok(holdsPiece(s, g.r, g.c), '판 밖/상자 칸');
        // 선물 직후 다음 단계가 섞기가 아니면 지금 그 칸에 그 조각이 있어야
        const later = res.steps.slice(gi + 1).some((x) => x.type === 'shuffle');
        if (!later) {
          assert.equal(s.cells[g.r][g.c].id, g.id);
          assert.equal(s.cells[g.r][g.c].special, g.special);
        }
        assert.equal(findGroups(s).length, 0, '선물 뒤 맞춤이 생김');
      }
      assert.ok(findHint(s), `레벨 ${l.id} ${guest}: 선물 뒤 둘 곳 없음`);
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
        if (holdsPiece(s, r, c)) assert.ok(s.cells[r][c]);
      }
    }
  }
  assert.ok(gifts > 20, `선물 ${gifts}`);
});

test('리뷰: 일반 간식이 하나도 없으면 선물 없이 성공(requestEnd ok, special null)', () => {
  const s = createState(bigScore(), 3, { guest: 'nabi' });
  play(s);
  // 모두 특수로 바꾼다(맞춤은 색으로 하므로 판은 그대로)
  for (const row of s.cells) for (const p of row) if (p && !p.special) p.special = BOMB;
  s.request.have = s.request.need;
  const res = play(s);
  const end = res.steps.find((x) => x.type === 'requestEnd');
  if (!res.steps.some((x) => x.type === 'gift')) assert.equal(end.special, null);
  assert.equal(end.ok, true);
});

// ---------- 대사 ----------

test('리뷰: withRo 받침 처리', () => {
  assert.equal(withRo('털실'), '털실로'); // ㄹ
  assert.equal(withRo('방울'), '방울로');
  assert.equal(withRo('캣닢'), '캣닢으로');
  assert.equal(withRo('생선'), '생선으로');
  assert.equal(withRo('쿠키'), '쿠키로');
});

test('리뷰: 모든 고양이·모든 종류 대사가 비지 않고 undefined 가 없다', () => {
  const names = ['생선', '털실', '발바닥 쿠키', '방울', '캣닢', '별사탕'];
  for (const c of Object.values(CATS)) {
    names.forEach((n, k) => {
      const line = c.ask(n, isToy(k));
      assert.ok(line.includes(n) && !/undefined|null/.test(line), line);
    });
    for (const t of [c.hello, c.thanks, c.sulk]) assert.ok(t && t.length);
  }
});
