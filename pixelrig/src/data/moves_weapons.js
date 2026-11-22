'use strict';
// Weapon move sets. Clip format is documented in CLAUDE.md.
// Blade direction on screen ≈ armF + foreF + wrot (+ torso): 0 = forward, -90 = up, 90 = down, ±180 = back.

const ST = {   // stance values reused as the start/end of clips
  blade: { armF: -14, foreF: -40, wrot: -8, torso: 3, head: 0, armB: -5, foreB: -14, thighF: -8, shinF: 7, thighB: 9, shinB: 4 },
  heavy: { armF: -10, foreF: -70, wrot: -62, torso: 4, head: 0, thighF: -8, shinF: 7, thighB: 9, shinB: 4 },
  pole: { armF: -6, foreF: -62, wrot: 6, torso: 3, head: 0, thighF: -8, shinF: 7, thighB: 9, shinB: 4 },
  magic: { armF: -16, foreF: -60, wrot: -14, torso: 2, head: 0, armB: -4, foreB: -14, thighF: -8, shinF: 7, thighB: 9, shinB: 4 },
  bow: { armF: -20, foreF: -50, wrot: 0, torso: 2, head: 0, armB: -4, foreB: -14 },
  fist: { armF: -20, foreF: -95, armB: -35, foreB: -100, torso: 3, head: 0, thighF: -8, shinF: 7, thighB: 9, shinB: 4 },
};
const K = (t, base, extra, ease) => Object.assign({ t }, base, extra, ease ? { ease } : {});
const spin = (t0, t1, n) => { const ks = []; for (let i = 1; i <= n; i++) ks.push({ t: t0 + ((t1 - t0) * i) / n, sx: i % 2 ? -1 : 1, ease: 'linear' }); return ks; };

PR.registerClips([
  // ---------------- blade: sword / dagger / katana ----------------
  { id: 'blade_slash1', name: 'ฟันลง', dur: 0.4, trail: [0.1, 0.22], keys: [
    K(0, ST.blade),
    K(0.1, {}, { armF: -165, foreF: -35, wrot: -5, torso: -6, head: -4, armB: 25, foreB: -30, thighF: -10, shinF: 10 }, 'out'),
    K(0.18, {}, { armF: 5, foreF: -15, wrot: 40, torso: 14, head: 6, armB: -30, foreB: -40, thighF: -32, shinF: 22, thighB: 20, shinB: 10, x: 5 }, 'outCubic'),
    K(0.4, ST.blade, { x: 5 }),
  ], events: [
    { t: 0.11, fx: 'slash', x: 6, y: -20, r: 20, a0: -120, a1: 50, thick: 6 },
    { t: 0.13, hit: { range: [0, 34], dmg: [8, 12], knock: 4, stop: 0.05, shake: 1.5 } },
  ] },
  { id: 'blade_slash2', name: 'ฟันเสย', dur: 0.4, trail: [0.1, 0.22], keys: [
    K(0, ST.blade),
    K(0.1, {}, { armF: 40, foreF: -20, wrot: 60, torso: 10, head: 4, armB: -30, thighF: -20, shinF: 20 }, 'out'),
    K(0.18, {}, { armF: -150, foreF: -20, wrot: -30, torso: -8, head: -6, armB: 30, thighF: -30, shinF: 15, thighB: 15, x: 5 }, 'outCubic'),
    K(0.4, ST.blade, { x: 6 }),
  ], events: [
    { t: 0.11, fx: 'slash', x: 6, y: -20, r: 20, a0: 70, a1: -130, thick: 6 },
    { t: 0.14, hit: { range: [0, 34], dmg: [8, 12], knock: 3, stop: 0.05, shake: 1.5 } },
  ] },
  { id: 'blade_thrust', name: 'แทงทะลวง', dur: 0.55, trail: [0.16, 0.3], keys: [
    K(0, ST.blade),
    K(0.16, {}, { armF: 50, foreF: -110, wrot: 60, torso: -6, armB: -60, foreB: -40, thighF: -15, shinF: 20, thighB: 15, x: -2 }, 'out'),
    K(0.24, {}, { armF: -88, foreF: -4, wrot: 92, torso: 16, head: 6, armB: 40, foreB: -20, thighF: -45, shinF: 25, thighB: 30, shinB: 10, x: 12 }, 'outExpo'),
    K(0.55, ST.blade, { x: 12 }),
  ], events: [
    { t: 0.2, fx: 'lines', x: 4, y: -18, n: 7 },
    { t: 0.22, afterimage: true },
    { t: 0.23, fx: 'flash', at: 'tip', size: 10 },
    { t: 0.23, hit: { range: [0, 44], dmg: [14, 20], knock: 10, stop: 0.09, shake: 3 } },
  ] },
  { id: 'blade_whirl', name: 'พายุดาบ', dur: 0.9, trail: [0.12, 0.76], keys: [
    K(0, ST.blade, { sx: 1, x: 0 }),
    K(0.12, {}, { armF: -90, foreF: -5, wrot: 90, torso: 10, armB: 60, foreB: -10, thighF: -25, shinF: 20, thighB: 20, x: 0 }, 'out'),
    ...spin(0.12, 0.72, 4),
    K(0.9, ST.blade, { x: 12 }),
  ], events: [
    { t: 0.12, fx: 'ring', at: 'feet', r: 34 },
    { t: 0.25, hit: { range: [-24, 34], dmg: [6, 9], knock: 2, stop: 0.03, shake: 1 } },
    { t: 0.3, afterimage: true }, { t: 0.45, fx: 'ring', at: 'feet', r: 34 },
    { t: 0.45, hit: { range: [-24, 34], dmg: [6, 9], knock: 2, stop: 0.03, shake: 1 } },
    { t: 0.55, afterimage: true },
    { t: 0.66, hit: { range: [-24, 34], dmg: [10, 14], knock: 7, stop: 0.07, shake: 2.5 } },
  ] },
  { id: 'blade_rising', name: 'ดาบเหินฟ้า', dur: 0.75, trail: [0.12, 0.32], keys: [
    K(0, ST.blade, { y: 0, x: 0 }),
    K(0.12, {}, { armF: 30, foreF: -30, wrot: 70, torso: 18, head: 6, thighF: -40, shinF: 70, thighB: 30, shinB: 60 }, 'out'),
    K(0.28, {}, { armF: -185, foreF: -10, wrot: -20, torso: -12, head: -10, thighF: -60, shinF: 40, thighB: 10, shinB: 50, footB: 30, y: -30, x: 8 }, 'outCubic'),
    K(0.5, {}, { armF: -150, foreF: -20, wrot: -10, y: -26 }, 'in'),
    K(0.75, ST.blade, { footB: 0, y: 0, x: 10 }, 'in'),
  ], events: [
    { t: 0.13, fx: 'dust', at: 'feet', n: 8 },
    { t: 0.14, fx: 'slash', x: 6, y: -24, r: 22, a0: 80, a1: -150, thick: 7 },
    { t: 0.16, hit: { range: [-4, 34], dmg: [16, 24], knock: 3, launch: 150, stop: 0.08, shake: 3 } },
    { t: 0.18, afterimage: true },
    { t: 0.74, fx: 'dust', at: 'feet', n: 6 },
  ] },

  // ---------------- heavy: greatsword / axe / hammer ----------------
  { id: 'heavy_smash', name: 'ทุบพื้น', dur: 0.7, trail: [0.25, 0.37], keys: [
    K(0, ST.heavy, { x: 0 }),
    K(0.25, {}, { armF: -190, foreF: -30, wrot: -10, torso: -12, head: -8, thighF: -15, shinF: 10, thighB: 10 }, 'out'),
    K(0.34, {}, { armF: -20, foreF: -20, wrot: 70, torso: 24, head: 12, thighF: -40, shinF: 40, thighB: 25, shinB: 15, x: 6 }, 'outExpo'),
    K(0.55, {}, { armF: -18, foreF: -22, wrot: 68, torso: 22 }, 'linear'),
    K(0.7, ST.heavy, { x: 6 }),
  ], events: [
    { t: 0.34, fx: 'burst', at: 'feet', x: 28, y: -2, r: 10 },
    { t: 0.34, fx: 'ring', at: 'feet', x: 28, r: 30 },
    { t: 0.34, fx: 'debris', at: 'feet', x: 28, n: 9 },
    { t: 0.34, hit: { range: [6, 46], dmg: [22, 30], knock: 8, stop: 0.1, shake: 4 } },
  ] },
  { id: 'heavy_sweep', name: 'กวาดเสย', dur: 0.65, trail: [0.2, 0.34], keys: [
    K(0, ST.heavy, { x: 0 }),
    K(0.2, {}, { armF: 60, foreF: -30, wrot: 80, torso: -6, thighB: 20, thighF: -5 }, 'out'),
    K(0.3, {}, { armF: -120, foreF: -10, wrot: 20, torso: 16, head: 4, thighF: -35, shinF: 25, x: 6 }, 'outCubic'),
    K(0.65, ST.heavy, { x: 6 }),
  ], events: [
    { t: 0.21, fx: 'slash', x: 8, y: -18, r: 28, a0: 100, a1: -100, thick: 8 },
    { t: 0.26, hit: { range: [0, 46], dmg: [18, 26], knock: 7, stop: 0.08, shake: 3 } },
  ] },
  { id: 'heavy_slam', name: 'กระโดดทุบ', dur: 0.9, trail: [0.38, 0.52], keys: [
    K(0, ST.heavy, { y: 0, x: 0 }),
    K(0.15, {}, { thighF: -40, shinF: 70, thighB: 30, shinB: 60, torso: 20, armF: -40 }, 'out'),
    K(0.38, {}, { armF: -200, foreF: -20, wrot: -10, torso: -15, head: -8, thighF: -50, shinF: 60, thighB: 0, shinB: 70, y: -34, x: 10 }, 'out'),
    K(0.5, {}, { armF: -20, foreF: -20, wrot: 70, torso: 30, head: 12, thighF: -60, shinF: 80, thighB: 30, shinB: 70, y: 0, x: 16 }, 'in'),
    K(0.7, {}, { armF: -18, foreF: -22, wrot: 68, torso: 28 }, 'linear'),
    K(0.9, ST.heavy, { x: 16, y: 0 }),
  ], events: [
    { t: 0.16, fx: 'dust', at: 'feet', n: 8 },
    { t: 0.4, afterimage: true },
    { t: 0.5, fx: 'burst', at: 'feet', x: 26, y: -3, r: 16, sparks: 18 },
    { t: 0.5, fx: 'ring', at: 'feet', x: 24, r: 48 },
    { t: 0.5, fx: 'debris', at: 'feet', x: 24, n: 14 },
    { t: 0.5, hit: { area: 36, dmg: [30, 42], knock: 10, launch: 110, stop: 0.12, shake: 6 }, at: 'feet', x: 22 },
  ] },
  { id: 'heavy_quake', name: 'ธรณีสะเทือน', dur: 1.05, trail: [0.3, 0.42], keys: [
    K(0, ST.heavy, { x: 0 }),
    K(0.3, {}, { armF: -200, foreF: -25, wrot: -10, torso: -14, head: -10, thighF: -20, shinF: 15, thighB: 12 }, 'out'),
    K(0.4, {}, { armF: -20, foreF: -20, wrot: 72, torso: 26, head: 12, thighF: -45, shinF: 45, thighB: 25, shinB: 15, x: 4 }, 'outExpo'),
    K(0.85, {}, { armF: -18, foreF: -22, wrot: 70, torso: 24 }, 'linear'),
    K(1.05, ST.heavy, { x: 4 }),
  ], events: [
    { t: 0.05, fx: 'aura', life: 0.3 },
    { t: 0.4, fx: 'burst', at: 'feet', x: 26, y: -2, r: 12 },
    { t: 0.4, fx: 'ring', at: 'feet', x: 26, r: 26 }, { t: 0.4, fx: 'debris', at: 'feet', x: 26, n: 8 },
    { t: 0.52, fx: 'ring', at: 'feet', x: 46, r: 30 }, { t: 0.52, fx: 'debris', at: 'feet', x: 46, n: 8 },
    { t: 0.64, fx: 'ring', at: 'feet', x: 66, r: 34 }, { t: 0.64, fx: 'debris', at: 'feet', x: 66, n: 10 },
    { t: 0.4, hit: { area: 18, dmg: [12, 16], knock: 3, stop: 0.04, shake: 3 }, at: 'feet', x: 26 },
    { t: 0.52, hit: { area: 18, dmg: [12, 16], knock: 3, stop: 0.04, shake: 3 }, at: 'feet', x: 46 },
    { t: 0.64, hit: { area: 20, dmg: [18, 26], knock: 8, launch: 90, stop: 0.08, shake: 4 }, at: 'feet', x: 66 },
  ] },
  { id: 'heavy_spin', name: 'หมุนทำลาย', dur: 1.0, trail: [0.15, 0.85], keys: [
    K(0, ST.heavy, { sx: 1, x: 0 }),
    K(0.15, {}, { armF: -85, foreF: -5, wrot: 90, torso: 12, thighF: -30, shinF: 30, thighB: 25, shinB: 10 }, 'out'),
    ...spin(0.15, 0.85, 4),
    K(1.0, ST.heavy, { x: 14 }),
  ], events: [
    { t: 0.15, fx: 'ring', at: 'feet', r: 40 },
    ...[0.3, 0.47, 0.64].map((t) => ({ t, hit: { range: [-30, 42], dmg: [9, 13], knock: 2, stop: 0.03, shake: 1.5 } })),
    { t: 0.8, hit: { range: [-30, 44], dmg: [16, 22], knock: 10, stop: 0.09, shake: 3 } },
    { t: 0.8, fx: 'ring', at: 'feet', r: 48 },
  ] },

  // ---------------- pole: spear / scythe ----------------
  { id: 'pole_thrust', name: 'แทงหอก', dur: 0.45, trail: [0.12, 0.24], keys: [
    K(0, ST.pole, { x: 0 }),
    K(0.12, {}, { armF: 35, foreF: -100, wrot: 65, torso: -4, thighB: 15, x: -2 }, 'out'),
    K(0.2, {}, { armF: -80, foreF: -5, wrot: 85, torso: 12, thighF: -40, shinF: 25, thighB: 25, x: 10 }, 'outExpo'),
    K(0.45, ST.pole, { x: 10 }),
  ], events: [
    { t: 0.17, fx: 'lines', x: 8, y: -18, n: 6 },
    { t: 0.19, fx: 'flash', at: 'tip', size: 9 },
    { t: 0.19, hit: { range: [0, 52], dmg: [10, 15], knock: 6, stop: 0.06, shake: 2 } },
  ] },
  { id: 'pole_sweep', name: 'ฟาดด้าม', dur: 0.55, trail: [0.14, 0.28], keys: [
    K(0, ST.pole, { x: 0 }),
    K(0.14, {}, { armF: -170, foreF: -30, wrot: 10, torso: -8, head: -4, thighF: -10 }, 'out'),
    K(0.24, {}, { armF: 0, foreF: -10, wrot: 50, torso: 16, head: 6, thighF: -35, shinF: 25, thighB: 20, x: 6 }, 'outCubic'),
    K(0.55, ST.pole, { x: 6 }),
  ], events: [
    { t: 0.15, fx: 'slash', x: 6, y: -20, r: 30, a0: -150, a1: 45, thick: 7 },
    { t: 0.2, hit: { range: [0, 50], dmg: [12, 17], knock: 5, stop: 0.06, shake: 2 } },
  ] },
  { id: 'pole_reap', name: 'เกี่ยววิญญาณ', dur: 0.75, trail: [0.18, 0.36], keys: [
    K(0, ST.pole, { x: 0 }),
    K(0.18, {}, { armF: -205, foreF: -25, wrot: 0, torso: -12, head: -8, thighB: 15 }, 'out'),
    K(0.32, {}, { armF: 40, foreF: -10, wrot: 60, torso: 22, head: 10, thighF: -45, shinF: 35, thighB: 25, shinB: 10, x: 8 }, 'outCubic'),
    K(0.75, ST.pole, { x: 8 }),
  ], events: [
    { t: 0.19, fx: 'slash', x: 4, y: -20, r: 32, a0: -210, a1: 80, thick: 9, life: 0.3 },
    { t: 0.22, afterimage: true },
    { t: 0.27, hit: { range: [-6, 50], dmg: [20, 28], knock: 9, stop: 0.1, shake: 3.5 } },
  ] },
  { id: 'pole_spin', name: 'กังหันหอก', dur: 0.95, trail: [0.12, 0.8], keys: [
    K(0, ST.pole, { sx: 1, x: 0 }),
    K(0.12, {}, { armF: -85, foreF: -5, wrot: 90, torso: 8, thighF: -25, shinF: 20, thighB: 20 }, 'out'),
    ...spin(0.12, 0.8, 6),
    K(0.95, ST.pole, { x: 8 }),
  ], events: [
    ...[0.22, 0.34, 0.46, 0.58].map((t) => ({ t, hit: { range: [-40, 50], dmg: [5, 8], knock: 1, stop: 0.02, shake: 1 } })),
    { t: 0.72, hit: { range: [-40, 52], dmg: [12, 18], knock: 9, stop: 0.08, shake: 3 } },
    { t: 0.3, fx: 'ring', at: 'feet', r: 44 }, { t: 0.6, fx: 'ring', at: 'feet', r: 44 },
  ] },
  { id: 'pole_dash', name: 'พุ่งทะลวง', dur: 0.65, trail: [0.12, 0.34], keys: [
    K(0, ST.pole, { x: 0 }),
    K(0.12, {}, { armF: 35, foreF: -100, wrot: 65, torso: -4, thighB: 20, thighF: -10, x: -3 }, 'out'),
    K(0.3, {}, { armF: -82, foreF: -4, wrot: 86, torso: 18, thighF: -50, shinF: 30, thighB: 35, shinB: 20, x: 56 }, 'outExpo'),
    K(0.65, ST.pole, { x: 56 }),
  ], events: [
    { t: 0.14, fx: 'dust', at: 'feet', n: 8, dir: -1 },
    { t: 0.16, afterimage: 0.3 }, { t: 0.2, afterimage: 0.3 }, { t: 0.24, afterimage: 0.3 },
    { t: 0.18, fx: 'lines', x: 0, y: -18, n: 10, len: 40 },
    { t: 0.26, hit: { range: [-50, 56], dmg: [24, 32], knock: 12, stop: 0.1, shake: 4 } },
  ] },

  // ---------------- magic: staff / book ----------------
  { id: 'magic_bolt', name: 'ลูกไฟ', dur: 0.5, keys: [
    K(0, ST.magic),
    K(0.15, {}, { armF: -150, foreF: -30, wrot: -10, torso: -6, armB: -40, foreB: -60 }, 'out'),
    K(0.24, {}, { armF: -85, foreF: -5, wrot: 90, torso: 10, armB: 30, x: 2 }, 'outCubic'),
    K(0.5, ST.magic, { x: 2 }),
  ], events: [
    { t: 0.05, fx: 'circle', at: 'feet', r: 14, life: 0.55 },
    { t: 0.24, fx: 'projectile', at: 'tip', kind: 'orb', speed: 190, hit: { dmg: [10, 16], knock: 4 } },
    { t: 0.24, fx: 'flash', at: 'tip', size: 8 },
  ] },
  { id: 'magic_bolt2', name: 'ศรน้ำแข็ง', dur: 0.55, keys: [
    K(0, ST.magic),
    K(0.15, {}, { armF: -150, foreF: -30, wrot: -10, torso: -6, armB: -100, foreB: -20 }, 'out'),
    K(0.24, {}, { armF: -85, foreF: -5, wrot: 90, torso: 10, armB: -80, foreB: -10 }, 'outCubic'),
    K(0.55, ST.magic),
  ], events: [
    { t: 0.22, fx: 'projectile', at: 'tip', kind: 'shard', speed: 230, vy: -30, hit: { dmg: [5, 8], knock: 2, stop: 0.02 } },
    { t: 0.26, fx: 'projectile', at: 'tip', kind: 'shard', speed: 230, vy: 0, hit: { dmg: [5, 8], knock: 2, stop: 0.02 } },
    { t: 0.3, fx: 'projectile', at: 'tip', kind: 'shard', speed: 230, vy: 30, hit: { dmg: [5, 8], knock: 2, stop: 0.02 } },
  ] },
  { id: 'magic_nova', name: 'ระเบิดพลัง', dur: 0.85, keys: [
    K(0, ST.magic, { y: 0 }),
    K(0.3, {}, { armF: -175, foreF: -5, wrot: -5, armB: -175, foreB: -5, torso: -8, head: -12, y: -4 }, 'out'),
    K(0.45, {}, { armF: -40, foreF: -20, wrot: 40, armB: 40, foreB: -20, torso: 16, head: 8, thighF: -30, shinF: 40, thighB: 20, shinB: 30, y: 0 }, 'outExpo'),
    K(0.85, ST.magic, { y: 0 }),
  ], events: [
    { t: 0.02, fx: 'circle', at: 'feet', r: 26, life: 0.8 },
    { t: 0.05, fx: 'aura', life: 0.4, rate: 60 },
    { t: 0.45, fx: 'burst', y: -16, r: 18, sparks: 20 },
    { t: 0.45, fx: 'ring', at: 'feet', r: 56 },
    { t: 0.45, hit: { area: 44, dmg: [18, 26], knock: 9, launch: 60, stop: 0.08, shake: 4 }, at: 'feet' },
  ] },
  { id: 'magic_meteor', name: 'อุกกาบาต', dur: 1.0, keys: [
    K(0, ST.magic),
    K(0.3, {}, { armF: -170, foreF: -10, wrot: -10, armB: -160, foreB: -20, torso: -10, head: -14 }, 'out'),
    K(0.75, {}, { armF: -165, foreF: -15, armB: -155, foreB: -25 }, 'linear'),
    K(1.0, ST.magic),
  ], events: [
    { t: 0.05, fx: 'circle', at: 'target', y: 0, r: 22, life: 1.0 },
    { t: 0.3, fx: 'meteor', at: 'target', y: 0, life: 0.5 },
  ] },
  { id: 'magic_thunder', name: 'อัสนีบาต', dur: 0.8, keys: [
    K(0, ST.magic),
    K(0.25, {}, { armF: -175, foreF: -5, wrot: -5, torso: -6, head: -10, armB: 20 }, 'out'),
    K(0.38, {}, { armF: -95, foreF: -5, wrot: 85, torso: 10, head: 4 }, 'outExpo'),
    K(0.8, ST.magic),
  ], events: [
    { t: 0.05, fx: 'circle', at: 'target', y: 0, r: 16, life: 0.6 },
    { t: 0.38, fx: 'lightning', at: 'target', y: 0, el: 'thunder' },
    { t: 0.38, fx: 'ring', at: 'target', y: 0, r: 30, el: 'thunder' },
    { t: 0.38, hit: { area: 16, dmg: [24, 34], knock: 5, stop: 0.09, shake: 4 }, at: 'target', y: 0 },
  ] },

  // ---------------- bow ----------------
  { id: 'bow_shot', name: 'ยิงธนู', dur: 0.55, keys: [
    K(0, ST.bow),
    K(0.18, {}, { armF: -88, foreF: -2, wrot: 0, armB: -85, foreB: -75, torso: -2 }, 'out'),
    K(0.32, {}, { armB: -80, foreB: -95 }, 'linear'),
    K(0.35, {}, { armB: -30, foreB: -30 }, 'outExpo'),
    K(0.55, ST.bow),
  ], events: [
    { t: 0.34, fx: 'projectile', at: 'tip', kind: 'arrow', speed: 280, hit: { dmg: [9, 14], knock: 3 } },
  ] },
  { id: 'bow_power', name: 'ศรทะลวง', dur: 0.9, keys: [
    K(0, ST.bow),
    K(0.2, {}, { armF: -88, foreF: -2, wrot: 0, armB: -85, foreB: -75, torso: -4, thighF: -20, shinF: 15, thighB: 20 }, 'out'),
    K(0.62, {}, { armB: -78, foreB: -100, torso: -6 }, 'linear'),
    K(0.65, {}, { armB: -20, foreB: -20, torso: 6, x: -4 }, 'outExpo'),
    K(0.9, ST.bow, { x: -4 }),
  ], events: [
    { t: 0.1, fx: 'circle', at: 'feet', r: 16, life: 0.6 },
    { t: 0.15, fx: 'aura', life: 0.45, rate: 50 },
    { t: 0.64, fx: 'projectile', at: 'tip', kind: 'arrow', speed: 380, boom: 16, hit: { dmg: [24, 34], knock: 12, stop: 0.1, shake: 4 } },
    { t: 0.64, fx: 'lines', at: 'tip', n: 6, len: 34 },
    { t: 0.64, fx: 'ring', at: 'tip', r: 10, flat: 1 },
  ] },
  { id: 'bow_multi', name: 'ศรสามดอก', dur: 0.6, keys: [
    K(0, ST.bow),
    K(0.2, {}, { armF: -88, foreF: -2, wrot: 0, armB: -85, foreB: -75, torso: -2 }, 'out'),
    K(0.36, {}, { armB: -80, foreB: -95 }, 'linear'),
    K(0.39, {}, { armB: -30, foreB: -30 }, 'outExpo'),
    K(0.6, ST.bow),
  ], events: [-50, 0, 50].map((vy) => ({ t: 0.38, fx: 'projectile', at: 'tip', kind: 'arrow', speed: 260, vy, hit: { dmg: [7, 11], knock: 3 } })) },
  { id: 'bow_rain', name: 'ฝนธนู', dur: 0.8, keys: [
    K(0, ST.bow),
    K(0.2, {}, { armF: -140, foreF: -2, wrot: 0, armB: -135, foreB: -75, torso: -12, head: -14 }, 'out'),
    K(0.34, {}, { armB: -130, foreB: -95 }, 'linear'),
    K(0.37, {}, { armB: -60, foreB: -30 }, 'outExpo'),
    K(0.8, ST.bow),
  ], events: [
    { t: 0.36, fx: 'projectile', at: 'tip', kind: 'arrow', speed: 120, vy: -260, range: 90 },
    { t: 0.6, fx: 'rain', at: 'target', y: 0, n: 14, spread: 22, life: 0.7 },
  ] },

  // ---------------- fist ----------------
  { id: 'fist_jab', name: 'หมัดตรง', dur: 0.3, keys: [
    K(0, ST.fist, { x: 0 }),
    K(0.07, {}, { armF: -88, foreF: -6, torso: 8, armB: -20, foreB: -110, thighF: -18, shinF: 12, x: 3 }, 'outExpo'),
    K(0.3, ST.fist, { x: 3 }),
  ], events: [{ t: 0.07, hit: { range: [0, 24], dmg: [5, 8], knock: 2, stop: 0.04, shake: 1 } }] },
  { id: 'fist_cross', name: 'หมัดหลัง', dur: 0.36, keys: [
    K(0, ST.fist, { x: 3 }),
    K(0.09, {}, { armB: -92, foreB: -4, torso: 16, armF: 10, foreF: -110, thighF: -30, shinF: 20, thighB: 15, x: 6 }, 'outExpo'),
    K(0.36, ST.fist, { x: 6 }),
  ], events: [{ t: 0.09, hit: { range: [0, 24], dmg: [7, 10], knock: 3, stop: 0.05, shake: 1.5 } }] },
  { id: 'fist_kick', name: 'เตะ', dur: 0.5, keys: [
    K(0, ST.fist, { x: 6 }),
    K(0.12, {}, { thighF: -60, shinF: 90, torso: -6, armB: 20 }, 'out'),
    K(0.2, {}, { thighF: -95, shinF: 4, footF: 30, torso: -14, head: -6, armF: 30, foreF: -60, armB: -50, x: 8 }, 'outExpo'),
    K(0.5, ST.fist, { footF: 0, x: 8 }),
  ], events: [
    { t: 0.2, fx: 'flash', at: 'feet', x: 22, y: -12, size: 10 },
    { t: 0.2, hit: { range: [0, 30], dmg: [12, 16], knock: 9, stop: 0.08, shake: 2.5 } },
  ] },
  { id: 'fist_flurry', name: 'หมัดร้อยเงา', dur: 0.9, keys: [
    K(0, ST.fist, { x: 0 }),
    ...[0.1, 0.22, 0.34, 0.46, 0.58, 0.7].map((t, i) => Object.assign({ t, ease: 'outExpo', torso: 10 + (i % 2) * 4, x: 1 + i },
      i % 2 ? { armB: -92, foreB: -4, armF: 0, foreF: -110 } : { armF: -90, foreF: -4, armB: -10, foreB: -110 })),
    K(0.9, ST.fist, { x: 7 }),
  ], events: [
    ...[0.1, 0.22, 0.34, 0.46, 0.58].map((t) => ({ t, hit: { range: [0, 26], dmg: [3, 5], knock: 1, stop: 0.02, shake: 0.8 } })),
    { t: 0.7, hit: { range: [0, 28], dmg: [10, 14], knock: 10, stop: 0.09, shake: 3 } },
    { t: 0.12, afterimage: 0.2 }, { t: 0.36, afterimage: 0.2 }, { t: 0.6, afterimage: 0.2 },
  ] },
  { id: 'fist_rising', name: 'หมัดมังกรเหิน', dur: 0.85, keys: [
    K(0, ST.fist, { x: 0, y: 0 }),
    K(0.14, {}, { thighF: -50, shinF: 80, thighB: 30, shinB: 70, torso: 20, armF: 40, foreF: -120 }, 'out'),
    K(0.3, {}, { armF: -178, foreF: -8, torso: -10, head: -12, thighF: -70, shinF: 50, thighB: 10, shinB: 30, y: -34, x: 10 }, 'outCubic'),
    K(0.55, {}, { y: -28 }, 'in'),
    K(0.85, ST.fist, { y: 0, x: 12 }, 'in'),
  ], events: [
    { t: 0.15, fx: 'dust', at: 'feet', n: 8 },
    { t: 0.18, fx: 'pillar', at: 'feet', x: 8, w: 8, h: 70, life: 0.5 },
    { t: 0.2, hit: { range: [-4, 26], dmg: [18, 26], knock: 3, launch: 170, stop: 0.09, shake: 3.5 } },
    { t: 0.22, afterimage: true },
    { t: 0.84, fx: 'dust', at: 'feet', n: 6 },
  ] },
]);
