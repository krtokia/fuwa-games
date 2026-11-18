import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, swap, findHint, holdsPiece, isWon, CAT, BOMB, LINE_H, LINE_V } from '../../snack-pop/js/core/board.js';
import { CATS, guestFor, rewardFor, isToy } from '../../snack-pop/js/core/cats.js';
import { LEVELS } from '../../snack-pop/js/core/levels.js';

const FULL = Array(8).fill('........');
const level = (moves = 30) => ({ kinds: 5, moves, layout: FULL, goals: [{ type: 'score', n: 999999 }] });
const play = (s) => swap(s, ...findHint(s));
const types = (res) => res.steps.map((x) => x.type);

test('보상 크기·간식/장난감 구분·손님 순서', () => {
  assert.equal(rewardFor(3), 'line');
  assert.equal(rewardFor(4), 'line');
  assert.equal(rewardFor(5), 'bomb');
  assert.equal(rewardFor(7), 'bomb');
  assert.equal(rewardFor(8), 'cat');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(isToy), [false, true, false, true, true, false]);
  assert.deepEqual([1, 2, 3, 4].map(guestFor), ['fuwa', 'shuri', 'nabi', 'fuwa']);
  for (const c of Object.values(CATS)) {
    assert.ok(c.need[0] <= c.need[1]);
    assert.equal(typeof c.ask('생선', false), 'string');
  }
});

test('손님이 없으면 부탁도 없다', () => {
  const s = createState(level(), 1);
  for (let i = 0; i < 5; i++) assert.ok(!types(play(s)).includes('request'));
  assert.equal(s.request, null);
});

test('첫 수 뒤에 부탁, 크기는 성격 범위 안', () => {
  for (const guest of Object.keys(CATS)) {
    const s = createState(level(), 3, { guest });
    const res = play(s);
    const req = res.steps.find((x) => x.type === 'request');
    assert.ok(req, guest);
    assert.equal(req.cat, guest);
    const cat = CATS[guest];
    assert.ok(req.need >= cat.need[0] && req.need <= cat.need[1]);
    assert.equal(req.turns, cat.turns);
    assert.ok(req.kind >= 0 && req.kind < 5);
    assert.deepEqual(s.request, { kind: req.kind, need: req.need, have: 0, turnsLeft: cat.turns, turns: cat.turns });
  }
});

test('부탁한 간식을 지우면 have 가 늘고, 다 채우면 선물(특수)이 판에 생긴다', () => {
  const s = createState(level(), 5, { guest: 'shuri' });
  play(s);
  assert.ok(s.request);
  // 부탁을 거의 다 채운 상태로 만들고 아무 수나 둔다 → 이번 수에 그 색을 하나라도 지우면 성공
  s.request.have = s.request.need;
  const res = play(s);
  const gift = res.steps.find((x) => x.type === 'gift');
  const end = res.steps.find((x) => x.type === 'requestEnd');
  assert.ok(gift);
  assert.equal(end.ok, true);
  assert.equal(s.request, null);
  assert.equal(s.requestRest, CATS.shuri.rest);
  const p = s.cells[gift.r][gift.c];
  assert.equal(p.id, gift.id);
  assert.ok([LINE_H, LINE_V].includes(p.special), '슈리(3~4개)는 줄무늬');
  assert.ok(types(res).indexOf('gift') > types(res).lastIndexOf('fall'), '선물은 연쇄가 끝난 뒤');
});

test('지워진 조각 수만큼 have 가 오른다(맞춤 집계와 같음)', () => {
  const s = createState(level(), 11, { guest: 'fuwa' });
  play(s);
  const kind = s.request.kind;
  const before = s.collected[kind];
  const have0 = s.request.have;
  play(s);
  if (s.request) assert.equal(s.request.have - have0, Math.min(s.request.need - have0, s.collected[kind] - before));
});

test('후와(8개 이상) 선물은 싹쓸이 후와, 나비는 리본 상자', () => {
  for (const [guest, special] of [['fuwa', CAT], ['nabi', BOMB]]) {
    const s = createState(level(), 7, { guest });
    play(s);
    s.request.have = s.request.need;
    const res = play(s);
    const gift = res.steps.find((x) => x.type === 'gift');
    assert.equal(gift.special, special, guest);
    if (special === CAT) assert.equal(gift.kind, -1);
    assert.ok(findHint(s), '선물 뒤에도 둘 곳이 있다');
  }
});

test('턴 안에 못 채우면 삐지고, 쉬었다가 다시 부탁', () => {
  const s = createState(level(60), 9, { guest: 'shuri' });
  play(s);
  assert.ok(s.request);
  const turns = s.request.turns;
  let ended = null;
  for (let i = 0; i < turns; i++) {
    s.request && (s.request.kind = 99); // 절대 못 채우는 종류
    const res = play(s);
    ended = res.steps.find((x) => x.type === 'requestEnd') || ended;
  }
  assert.ok(ended);
  assert.equal(ended.ok, false);
  assert.equal(s.request, null);
  let again = null;
  for (let i = 0; i < CATS.shuri.rest && !again; i++) again = play(s).steps.find((x) => x.type === 'request');
  assert.ok(again, '쉬는 턴 뒤 새 부탁');
});

test('남은 이동이 부탁 턴보다 적으면 새 부탁을 하지 않는다', () => {
  const s = createState(level(3), 4, { guest: 'fuwa' }); // 후와 턴 5
  for (let i = 0; i < 3; i++) assert.ok(!types(play(s)).includes('request'));
});

test('이기면 새 부탁이 없다', () => {
  const s = createState({ kinds: 5, moves: 30, layout: FULL, goals: [{ type: 'score', n: 1 }] }, 2, { guest: 'shuri' });
  const res = play(s);
  assert.ok(isWon(s));
  assert.ok(!types(res).includes('request'));
});

test('모든 레벨: 손님과 함께 힌트로 끝까지 — 판 일관성', () => {
  for (const l of LEVELS) {
    const s = createState(l, l.id * 17, { guest: guestFor(l.id) });
    let gifts = 0, requests = 0;
    while (s.movesLeft > 0 && !isWon(s)) {
      const res = play(s);
      gifts += res.steps.filter((x) => x.type === 'gift').length;
      requests += res.steps.filter((x) => x.type === 'request').length;
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
        if (holdsPiece(s, r, c)) assert.ok(s.cells[r][c], `레벨 ${l.id} 빈칸`);
      }
      assert.ok(findHint(s), `레벨 ${l.id} 둘 곳`);
    }
    assert.ok(requests >= 1, `레벨 ${l.id} 부탁이 한 번은 나온다`);
  }
});

test('무작위 손님: 셋 다 나오고, 바로 전 손님은 연달아 오지 않는다', async () => {
  const { pickGuest } = await import('../../snack-pop/js/core/cats.js');
  const { makeRng } = await import('../../snack-pop/js/core/rng.js');
  const rng = makeRng(7);
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 60; i++) {
    const g = pickGuest(rng, last);
    assert.ok(g in CATS);
    assert.notEqual(g, last);
    seen.add(g);
    last = g;
  }
  assert.equal(seen.size, 3);
});
