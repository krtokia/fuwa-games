// 구경 오는 고양이(주인공 셋). 성격이 부탁의 빈도·크기를 정하고, 크기가 보상을 정한다.
// 그림: snack-pop/assets/cats/<id>-peek(-happy|-sulk).webp, <id>-face.webp (원본 PNG 는 같은 폴더)

// 받침에 따라 '로/으로' (ㄹ 받침은 '로')
export function withRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}로`;
  const fin = code % 28;
  return `${word}${fin === 0 || fin === 8 ? '로' : '으로'}`;
}

export const CATS = {
  fuwa: {
    name: '후와', rest: 5, need: [8, 10], turns: 5,
    ask: (item, toy) => (toy ? `…${item}, 놀아 줘도 돼.` : `…${item} 가져와.`),
    hello: '…구경 왔다.',
    thanks: '흠, 나쁘지 않군.',
    sulk: '…됐다.',
  },
  shuri: {
    name: '슈리', rest: 2, need: [3, 4], turns: 3,
    ask: (item, toy) => (toy ? `${item}! ${withRo(item)} 놀자!` : `${item}! ${item} 줘!`),
    hello: '구경할래! 구경!',
    thanks: '와아! 고마워!',
    sulk: '칫, 삐졌어!',
  },
  nabi: {
    name: '나비', rest: 3, need: [5, 7], turns: 4,
    ask: (item, toy) => (toy ? `${withRo(item)} 놀아 주실래요?` : `${item} 부탁해요.`),
    hello: '실례합니다. 구경할게요.',
    thanks: '감사합니다.',
    sulk: '아쉽네요.',
  },
};

export const GUEST_ORDER = ['fuwa', 'shuri', 'nabi'];
export const guestFor = (levelId) => GUEST_ORDER[(levelId - 1) % GUEST_ORDER.length];

// 간식 0 생선 · 2 발바닥 쿠키 · 5 별사탕 / 장난감 1 털실 · 3 방울 · 4 캣닢
export const isToy = (kind) => kind === 1 || kind === 3 || kind === 4;

// 부탁 크기 → 선물 특수
export const rewardFor = (need) => (need <= 4 ? 'line' : need <= 7 ? 'bomb' : 'cat');

// 표정: ask/hello → 기본, thanks → happy, sulk → sulk
export const peekArt = (id, mood) => `assets/cats/${id}-peek${mood === 'thanks' ? '-happy' : mood === 'sulk' ? '-sulk' : ''}.webp`;
export const faceArt = (id) => `assets/cats/${id}-face.webp`;
