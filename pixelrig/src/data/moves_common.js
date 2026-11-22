'use strict';
// General moves usable with any weapon (reactions, emotes, movement skills).
(() => {
  const IDLE = { torso: 1.5, head: -1, armF: 6, foreF: -12, armB: -4, foreB: -14, thighF: -7, shinF: 7, footF: 0, thighB: 9, shinB: 4, footB: -13, lean: 0 };
  const K = (t, base, extra, ease) => Object.assign({ t }, base, extra, ease ? { ease } : {});
  const LYING = { lean: -88, torso: -4, head: -14, armF: -150, foreF: -20, armB: -120, foreB: -30, thighF: -8, shinF: 10, thighB: 4, shinB: 6, footF: 0, footB: 0 };

  PR.registerClips([
    { id: 'hurt', name: 'โดนตี', group: 'common', dur: 0.38, keys: [
      K(0, {}, { x: 0 }),
      K(0.06, {}, { torso: -16, head: -14, armF: 35, foreF: -30, armB: 40, foreB: -30, thighF: -20, shinF: 10, thighB: 18, x: -4 }, 'outExpo'),
      K(0.38, IDLE, { x: -4 }),
    ], events: [{ t: 0.02, fx: 'flash', y: -20, size: 9, el: 'fire' }, { t: 0.02, shake: 1.5 }] },
    { id: 'die', name: 'ล้มลง (ตาย)', group: 'common', dur: 1.0, hold: true, keys: [
      K(0, {}, { x: 0 }),
      K(0.2, {}, { torso: -20, head: -20, armF: 40, armB: 40, thighF: -20, shinF: 30, x: -2 }, 'out'),
      K(0.65, LYING, { x: -8 }, 'in'),
      K(0.8, LYING, { lean: -84, head: -10, x: -8 }, 'out'),
      K(1.0, LYING, { x: -8 }, 'inout'),
    ], events: [{ t: 0.65, fx: 'dust', at: 'feet', x: -14, n: 12, spread: 14 }, { t: 0.65, shake: 2 }] },
    { id: 'revive', name: 'ฟื้น (ลุกขึ้น)', group: 'common', dur: 1.3, keys: [
      K(0, LYING, { x: 0 }),
      K(0.45, {}, { lean: -60, torso: 10, head: 6, armB: -40, foreB: -20, thighF: -60, shinF: 90, thighB: -30, shinB: 100 }, 'inout'),
      K(0.85, {}, { lean: 0, torso: 24, head: 8, armF: 10, armB: 10, thighF: -70, shinF: 110, thighB: 10, shinB: 100 }, 'inout'),
      K(1.3, IDLE, {}, 'out'),
    ], events: [
      { t: 0.05, fx: 'pillar', at: 'feet', w: 14, h: 110, life: 1.1, el: 'holy' },
      { t: 0.05, fx: 'aura', life: 1.0, rate: 50, el: 'holy' },
      { t: 0.05, fx: 'circle', at: 'feet', r: 20, life: 1.2, el: 'holy' },
    ] },
    { id: 'sit', name: 'นั่งลง', group: 'common', dur: 0.55, hold: true, keys: [
      K(0, {}, {}),
      K(0.3, {}, { thighF: -60, shinF: 90, thighB: -40, shinB: 100, torso: 10, head: 4 }, 'in'),
      K(0.55, {}, { thighF: -86, shinF: 8, footF: -70, thighB: -80, shinB: 14, footB: -70, torso: -6, head: 6, armF: -25, foreF: -45, armB: 38, foreB: -8 }, 'out'),
    ] },
    { id: 'victory', name: 'ฉลองชัย', group: 'common', dur: 1.3, keys: [
      K(0, {}, { y: 0 }),
      K(0.25, {}, { thighF: -30, shinF: 50, thighB: 20, shinB: 50, torso: 14, armF: 20, y: 0 }, 'out'),
      K(0.45, {}, { armF: -172, foreF: -8, wrot: -10, armB: -140, foreB: -40, torso: -8, head: -14, thighF: -20, shinF: 30, thighB: 10, shinB: 40, y: -16 }, 'outCubic'),
      K(0.65, {}, { y: 0, thighF: -10, shinF: 12, thighB: 10, shinB: 6 }, 'in'),
      K(1.05, {}, { armF: -170, foreF: -10, armB: -40, foreB: -60, torso: -4, head: -8 }, 'inout'),
      K(1.3, IDLE, { wrot: 0 }),
    ], events: [
      { t: 0.45, fx: 'aura', life: 0.8, rate: 30, el: 'holy' },
      { t: 0.45, fx: 'flash', at: 'tip', size: 12, el: 'holy' },
      { t: 0.66, fx: 'dust', at: 'feet', n: 6 },
    ] },
    { id: 'wave', name: 'โบกมือ', group: 'common', dur: 1.2, keys: [
      K(0, {}, {}),
      K(0.2, {}, { armB: -150, foreB: -40, head: -4 }, 'out'),
      K(0.4, {}, { foreB: -10 }), K(0.6, {}, { foreB: -50 }), K(0.8, {}, { foreB: -10 }),
      K(1.0, {}, { armB: -150, foreB: -40 }),
      K(1.2, IDLE),
    ] },
    { id: 'guard', name: 'ตั้งการ์ด', group: 'common', dur: 0.3, hold: true, keys: [
      K(0, {}, {}),
      K(0.3, {}, { armB: -80, foreB: -70, armF: -30, foreF: -70, torso: -4, head: 4, thighF: -24, shinF: 24, thighB: 22, shinB: 12 }, 'outCubic'),
    ] },
    { id: 'dash', name: 'พุ่งตัว', group: 'common', dur: 0.36, keys: [
      K(0, {}, { x: 0 }),
      K(0.05, {}, { torso: 22, head: -6, armF: 50, foreF: -30, armB: 50, foreB: -30, thighF: -50, shinF: 40, thighB: 40, shinB: 30 }, 'out'),
      K(0.2, {}, { x: 48 }, 'outExpo'),
      K(0.36, IDLE, { x: 48 }),
    ], events: [
      { t: 0.03, fx: 'dust', at: 'feet', n: 8, dir: -1 },
      { t: 0.06, afterimage: 0.3 }, { t: 0.1, afterimage: 0.3 }, { t: 0.14, afterimage: 0.3 },
      { t: 0.06, fx: 'lines', x: -10, y: -18, n: 8, dir: -1 },
    ] },
    { id: 'backstep', name: 'ถอยหลบ', group: 'common', dur: 0.4, keys: [
      K(0, {}, { x: 0, y: 0 }),
      K(0.18, {}, { torso: -10, armF: 30, armB: 30, thighF: -30, shinF: 50, thighB: 10, shinB: 50, x: -22, y: -8 }, 'out'),
      K(0.4, IDLE, { x: -26, y: 0 }, 'in'),
    ], events: [{ t: 0.04, afterimage: 0.2 }, { t: 0.38, fx: 'dust', at: 'feet', n: 5 }] },
  ]);
  PR.COMMON_MOVES = ['hurt', 'die', 'revive', 'sit', 'victory', 'wave', 'guard', 'dash', 'backstep'];
})();
