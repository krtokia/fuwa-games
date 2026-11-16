// 작은 트윈 엔진. 숫자 속성을 시간에 따라 바꾸고 끝나면 Promise 를 푼다.

export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  // 툭 떨어져 살짝 튕기기
  land: (t) => {
    if (t < 0.72) { const u = t / 0.72; return u * u; }
    const u = (t - 0.72) / 0.28;
    return 1 - Math.sin(u * Math.PI) * 0.06;
  },
};

export class Tweens {
  constructor() { this.list = []; this.speed = 1; }

  to(obj, props, dur, easing = ease.outQuad, delay = 0) {
    return new Promise((resolve) => {
      this.list.push({ obj, props, from: null, dur: Math.max(1, dur / this.speed), delay: delay / this.speed, t: 0, easing, resolve });
    });
  }

  wait(ms) {
    return this.to({}, {}, ms);
  }

  update(dt) {
    const keep = [];
    for (const tw of this.list) {
      if (tw.delay > 0) { tw.delay -= dt; keep.push(tw); continue; }
      if (!tw.from) {
        tw.from = {};
        for (const k in tw.props) tw.from[k] = tw.obj[k];
      }
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      const e = tw.easing(p);
      for (const k in tw.props) tw.obj[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (p >= 1) tw.resolve(); else keep.push(tw);
    }
    this.list = keep;
  }

  get busy() { return this.list.length > 0; }
}
