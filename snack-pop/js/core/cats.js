// 구경 오는 고양이(주인공 셋). 성격이 부탁의 빈도·크기를 정하고, 크기가 보상을 정한다.
// 그림: snack-pop/assets/cats/<id>-peek(-happy|-sulk).webp, <id>-face.webp (원본 PNG 는 같은 폴더)

// 받침에 따라 '로/으로' (ㄹ 받침은 '로')
export function withRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}로`;
  const fin = code % 28;
  return `${word}${fin === 0 || fin === 8 ? '로' : '으로'}`;
}

// 성격은 캐릭터 바이블(실제 관찰)을 따른다. 가게·부탁 같은 상황은 게임 각색.
//   후와: 도도한 얼음공주(은근한 츤데레 말투). 드물게, 크게 부탁
//   슈리: 누구에게나 다정한 애교쟁이. 중간
//   나비: 겁 많은 수다쟁이 장난꾸러기. 자주, 작게 조름
export const CATS = {
  fuwa: {
    name: '후와', rest: 5, need: [8, 9], turns: 6,
    ask: (item, toy) => (toy ? `${item}? …조금만 놀아 줄게.` : `${item}… 있으면 두고 가.`),
    hello: '…구경만 할 거야. 신경 쓰지 마.',
    thanks: '…고마워. 한 번만 말할 거야.',
    sulk: '됐어. 안 기다렸어.',
  },
  shuri: {
    name: '슈리', rest: 3, need: [5, 7], turns: 4,
    ask: (item, toy) => (toy ? `${withRo(item)} 놀아 줘! 응? 응?` : `${item}! ${item} 줘, 응?`),
    hello: '안녕! 나도 구경할래!',
    thanks: '고마워! 최고야!',
    sulk: '힝… 다음엔 꼭 줘!',
  },
  nabi: {
    name: '나비', rest: 2, need: [3, 4], turns: 3,
    ask: (item, toy) => (toy ? `${item}! ${withRo(item)} 놀자! 빨리빨리!` : `저, 저기… ${item} 있어? 줘, 줘!`),
    hello: '…아무도 없지? 구경할래.',
    thanks: '우와와! 고마워 고마워!',
    sulk: '냐아… 숨을래.',
  },
};

export const GUEST_ORDER = ['fuwa', 'shuri', 'nabi'];
// 판마다 고정 순서(테스트·시뮬레이션용). 게임에서는 pickGuest 로 무작위
export const guestFor = (levelId) => GUEST_ORDER[(levelId - 1) % GUEST_ORDER.length];
// 무작위 손님. 바로 전 손님은 피해서 같은 고양이가 연달아 오지 않게 한다
export function pickGuest(rand = Math.random, last = null) {
  const pool = GUEST_ORDER.filter((id) => id !== last);
  return pool[Math.floor(rand() * pool.length)];
}

// 간식 0 생선 · 2 발바닥 쿠키 · 5 별사탕 / 장난감 1 털실 · 3 방울 · 4 캣닢
export const isToy = (kind) => kind === 1 || kind === 3 || kind === 4;

// 부탁 크기 → 선물 특수
export const rewardFor = (need) => (need <= 4 ? 'line' : need <= 7 ? 'bomb' : 'cat');

// 표정: ask/hello → 기본, thanks → happy, sulk → sulk
export const peekArt = (id, mood) => `assets/cats/${id}-peek${mood === 'thanks' ? '-happy' : mood === 'sulk' ? '-sulk' : ''}.webp`;
export const faceArt = (id) => `assets/cats/${id}-face.webp`;
