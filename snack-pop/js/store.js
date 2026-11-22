// 진행 저장 (localStorage). 막혀 있어도 게임은 돌아간다.
const KEY = 'snack-pop.v1';

export function loadStore() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { data = null; }
  if (!data || typeof data !== 'object') data = {};
  return { levels: data.levels && typeof data.levels === 'object' ? data.levels : {}, sound: data.sound !== false };
}

export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 저장 못 해도 계속 */ }
}

// 판 결과 기록. 별·점수는 최고 기록만 남긴다
export function recordWin(store, id, stars, score) {
  const prev = store.levels[id] || { stars: 0, best: 0 };
  store.levels[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
  saveStore(store);
}

export const isUnlocked = (store, id) => id === 1 || (store.levels[id - 1] && store.levels[id - 1].stars > 0);
export const totalStars = (store) => Object.values(store.levels).reduce((t, l) => t + (l.stars || 0), 0);
