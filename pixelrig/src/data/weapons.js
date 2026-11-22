'use strict';
// Weapons. Weapon space: origin = center of the main-hand fist, +x = along the blade
// (points FORWARD when the arm hangs straight down), +y = the leading edge for a forward/down swing.
// tip/base: two points used for the swing trail. grip2: where the off hand grabs (two-handed only).
// set: which move set the weapon uses (see PR.SETS and data/moves.js).

PR.WEAPONS = {
  fist: { name: 'มือเปล่า', set: 'fist', tip: [0, 2], base: [0, 0], shapes: [] },
  sword: {
    name: 'ดาบ', set: 'blade', tip: [23, 0], base: [5, 0],
    pal: { grip: '#5a3a22', guard: '#c9a24a', blade: '#dbe6f2' },
    shapes: [
      { t: 'rect', x: -3.2, y: -1, w: 5.4, h: 2, c: 'grip' },
      { t: 'circ', x: -3.8, y: 0, r: 1.3, c: 'guard' },
      { t: 'rect', x: 2, y: -3.2, w: 1.8, h: 6.4, r: 0.6, c: 'guard' },
      { t: 'poly', p: [3.8, -1.5, 19.5, -1.5, 23, 0, 19.5, 1.5, 3.8, 1.5], c: 'blade' },
      { t: 'line', p: [5, 0, 19, 0], c: 'blade*0.72', w: 0.6, o: false },
    ],
  },
  dagger: {
    name: 'มีดสั้น', set: 'blade', tip: [13, 0], base: [3, 0],
    pal: { grip: '#3b2a1a', guard: '#9aa6b8', blade: '#e4ecf5' },
    shapes: [
      { t: 'rect', x: -2.6, y: -0.9, w: 4, h: 1.8, c: 'grip' },
      { t: 'rect', x: 1.2, y: -2.2, w: 1.4, h: 4.4, c: 'guard' },
      { t: 'poly', p: [2.6, -1.2, 10, -1.2, 13.4, 0, 10, 1.2, 2.6, 1.2], c: 'blade' },
    ],
  },
  katana: {
    name: 'คาตานะ', set: 'blade', two: true, grip2: [-5.5, 0], tip: [27.5, -4.4], base: [5, -0.2],
    pal: { grip: '#2a2238', guard: '#c9a24a', blade: '#e8eef6' },
    shapes: [
      { t: 'rect', x: -8, y: -1, w: 10, h: 2, c: 'grip' },
      { t: 'line', p: [-7, -1, -6, 1, -5, -1, -4, 1, -3, -1, -2, 1, -1, -1, 0, 1], c: 'grip+0.35', w: 0.45, o: false },
      { t: 'ell', x: 2.6, y: 0, rx: 0.9, ry: 2.4, c: 'guard' },
      { t: 'poly', p: [3.4, -1.1, 14, -1.9, 23, -3.4, 28, -4.8, 26, -2.6, 14, 0.4, 3.4, 0.9], c: 'blade' },
      { t: 'line', p: [4, 0.5, 14, -0.2, 25.5, -2.8], c: '#ffffff', w: 0.5, o: false },
    ],
  },
  greatsword: {
    name: 'ดาบใหญ่', set: 'heavy', two: true, grip2: [-6.5, 0], tip: [31, 0], base: [7, 0],
    pal: { grip: '#3b2a1a', guard: '#8e9bb0', blade: '#c9d4e2' },
    shapes: [
      { t: 'rect', x: -9, y: -1.1, w: 11.5, h: 2.2, c: 'grip' },
      { t: 'circ', x: -9.4, y: 0, r: 1.6, c: 'guard' },
      { t: 'rect', x: 2.4, y: -5.2, w: 2.4, h: 10.4, r: 0.8, c: 'guard' },
      { t: 'poly', p: [4.6, -2.7, 26, -2.7, 31.5, 0, 26, 2.7, 4.6, 2.7], c: 'blade' },
      { t: 'rect', x: 6, y: -0.6, w: 18, h: 1.2, c: 'blade*0.7', o: false },
      { t: 'circ', x: 3.6, y: 0, r: 1, c: 'gem', o: false },
    ],
  },
  axe: {
    name: 'ขวาน', set: 'heavy', tip: [19, 6], base: [14, 3],
    pal: { wood: '#7a5230', blade: '#c9d4e2' },
    shapes: [
      { t: 'rect', x: -4, y: -1, w: 21, h: 2, r: 0.8, c: 'wood' },
      { t: 'poly', p: [12, 0.8, 17, 0.8, 21, 7.5, 16.5, 9, 13.5, 4.5], c: 'blade' },
      { t: 'poly', p: [13, -0.8, 16, -0.8, 15, -3.5], c: 'blade*0.8' },
    ],
  },
  hammer: {
    name: 'ค้อน', set: 'heavy', two: true, grip2: [-6, 0], tip: [25, 0], base: [16, 0],
    pal: { wood: '#6b4a2e', metal: '#8e9bb0' },
    shapes: [
      { t: 'rect', x: -9, y: -1.1, w: 27, h: 2.2, r: 1, c: 'wood' },
      { t: 'rect', x: 16, y: -6, w: 9, h: 12, r: 1.2, c: 'metal' },
      { t: 'rect', x: 15, y: -6.6, w: 11, h: 2, c: 'metal*0.7', o: false },
      { t: 'rect', x: 15, y: 4.6, w: 11, h: 2, c: 'metal*0.7', o: false },
    ],
  },
  spear: {
    name: 'หอก', set: 'pole', two: true, grip2: [-9, 0], tip: [34, 0], base: [26, 0],
    pal: { wood: '#7a5230', blade: '#dbe6f2', tassel: '#c0392b' },
    shapes: [
      { t: 'rect', x: -13, y: -0.9, w: 40, h: 1.8, r: 0.8, c: 'wood' },
      { t: 'poly', p: [26.5, -2, 34.5, 0, 26.5, 2, 27.5, 0], c: 'blade' },
      { t: 'poly', p: [25.5, -0.8, 23, 4, 25, 4.5, 26.4, 0.8], c: 'tassel', o: false },
    ],
  },
  scythe: {
    name: 'เคียว', set: 'pole', two: true, grip2: [-9, 0], tip: [12.5, 15.5], base: [21, 1],
    pal: { wood: '#3b2a3a', blade: '#c9d4e2' },
    shapes: [
      { t: 'rect', x: -12, y: -1, w: 35, h: 2, r: 0.8, c: 'wood' },
      { t: 'poly', p: [19.5, -1.2, 23, -1.5, 23.6, 3, 21.4, 9, 16.5, 14, 11.5, 16.4, 15.6, 11, 18.6, 6, 19.6, 2], c: 'blade' },
      { t: 'line', p: [21.8, 2, 20.2, 7.5, 16.5, 12], c: '#ffffff', w: 0.5, o: false },
    ],
  },
  staff: {
    name: 'คทา', set: 'magic', tip: [25, 0], base: [19, 0],
    pal: { wood: '#6b4a2e', gem: '#7fe3ff' },
    shapes: [
      { t: 'rect', x: -7, y: -1, w: 28, h: 2, r: 0.9, c: 'wood' },
      { t: 'poly', p: [20, -1, 23, -4, 24, -3, 22, 0, 24, 3, 23, 4, 20, 1], c: 'metal' },
      { t: 'circ', x: 25, y: 0, r: 2.8, c: 'gem' },
      { t: 'circ', x: 24.2, y: -0.9, r: 0.9, c: '#ffffff', o: false },
    ],
  },
  book: {
    name: 'คัมภีร์', set: 'magic', tip: [0, 10], base: [0, 4], wrot0: -90,
    pal: { cover: '#6a2c70', page: '#f4ead2' },
    shapes: [
      { t: 'rect', x: -4.6, y: -0.5, w: 9.2, h: 7.5, r: 0.8, c: 'cover' },
      { t: 'rect', x: -4, y: 0.4, w: 8, h: 5.8, c: 'page' },
      { t: 'line', p: [0, 0.4, 0, 6.2], c: 'page*0.7', w: 0.5, o: false },
      { t: 'circ', x: 0, y: 3.3, r: 1.3, c: 'gem', o: false },
    ],
  },
  bow: {
    name: 'ธนู', set: 'bow', tip: [0, 2], base: [0, -2], string: [[-12, -4], [12, -4]],
    pal: { wood: '#7a5230' },
    shapes: [
      { t: 'line', p: [-12, -4, -9, -1.2, -4, 0.6, 0, 1, 4, 0.6, 9, -1.2, 12, -4], c: 'wood', w: 1.7 },
      { t: 'rect', x: -1.4, y: -0.6, w: 2.8, h: 2.2, c: 'top2', o: false },
    ],
  },
};

// Off-hand items, drawn in the back hand's bone space (hand hangs along +y, fist at (0,1.5)).
PR.OFFHANDS = {
  none: { name: '— ไม่ถือ —', shapes: [] },
  shield: { name: 'โล่', shapes: [
    { t: 'ell', x: 2.2, y: 1.5, rx: 2.4, ry: 7, c: '#8e9bb0' },
    { t: 'ell', x: 2.6, y: 1.5, rx: 1.2, ry: 4.4, c: '#c0392b', o: false },
  ] },
  buckler: { name: 'โล่กลม', shapes: [
    { t: 'circ', x: 2, y: 1.5, r: 4.2, c: '#7a5230' },
    { t: 'circ', x: 2, y: 1.5, r: 1.6, c: '#d9b350' },
  ] },
  orb: { name: 'ลูกแก้ว', shapes: [
    { t: 'circ', x: 0, y: 6, r: 2.8, c: '#7fe3ff' },
    { t: 'circ', x: -0.8, y: 5.2, r: 0.9, c: '#ffffff', o: false },
  ] },
};

// Element = color ramp used by trails, sparks, projectiles, glow. ramp: [core, bright, mid, dark]
PR.ELEMENTS = {
  none: { name: 'ไม่มีธาตุ', ramp: ['#ffffff', '#e4ecff', '#9fb4e8', '#5a6aa8'] },
  fire: { name: 'ไฟ', ramp: ['#fff6c0', '#ffb030', '#ff5a1f', '#a8201a'] },
  ice: { name: 'น้ำแข็ง', ramp: ['#ffffff', '#c4f4ff', '#5fc8ff', '#2a6fd6'] },
  thunder: { name: 'สายฟ้า', ramp: ['#ffffff', '#fff59a', '#ffd23a', '#8a5cff'] },
  poison: { name: 'พิษ', ramp: ['#eaffc0', '#9be04a', '#3fa83a', '#245d33'] },
  holy: { name: 'ศักดิ์สิทธิ์', ramp: ['#ffffff', '#fff3b0', '#ffd66b', '#d08a20'] },
  shadow: { name: 'มืด', ramp: ['#f0d8ff', '#b07cff', '#6a2ec0', '#2a1048'] },
};

// Move sets: stance = pose blended over idle/walk while holding this weapon type.
// attacks = combo chain (Space / J), skills = extra buttons (K, L).
PR.SETS = {
  fist: { name: 'มือเปล่า', stance: { armF: -20, foreF: -95, armB: -35, foreB: -100, wrot: 0 },
    attacks: ['fist_jab', 'fist_cross', 'fist_kick'], skills: ['fist_flurry', 'fist_rising'] },
  blade: { name: 'ดาบ/มีด', stance: { armF: -14, foreF: -40, wrot: -8 },
    attacks: ['blade_slash1', 'blade_slash2', 'blade_thrust'], skills: ['blade_whirl', 'blade_rising'] },
  heavy: { name: 'อาวุธหนัก', stance: { armF: -10, foreF: -70, wrot: -62, torso: 4 },
    attacks: ['heavy_smash', 'heavy_sweep', 'heavy_slam'], skills: ['heavy_quake', 'heavy_spin'] },
  pole: { name: 'ด้าม/หอก', stance: { armF: -6, foreF: -62, wrot: 6, torso: 3 },
    attacks: ['pole_thrust', 'pole_sweep', 'pole_reap'], skills: ['pole_spin', 'pole_dash'] },
  magic: { name: 'เวทมนตร์', stance: { armF: -16, foreF: -60, wrot: -14 },
    attacks: ['magic_bolt', 'magic_bolt2', 'magic_nova'], skills: ['magic_meteor', 'magic_thunder'] },
  bow: { name: 'ธนู', stance: { armF: -20, foreF: -50, wrot: 0 },
    attacks: ['bow_shot', 'bow_shot', 'bow_power'], skills: ['bow_multi', 'bow_rain'] },
};
