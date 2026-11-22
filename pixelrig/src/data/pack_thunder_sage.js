'use strict';
// Character pack: "Thunder Sage" (เซียนอัสนีทอง), an original xianxia cultivator: long flowing hair, black robe
// with gold embroidery, wide sleeves, a long outer robe that streams behind, a straight jian and golden lightning.
// A pack only adds data (hair, items, weapon, element, move set, clips, preset), so it is a template for new characters.
(() => {
  const GOLD = '#d9b350';

  // ---------- hair: long, center-parted, flowing down the back ----------
  PR.HAIR.xian_long = { name: 'ผมยาวเซียน', rest: 6, shapes: {
    head: [
      { t: 'poly', p: [-8.6, -3, -9.2, -11, -7.6, -16.2, -3, -18.9, 2, -19.1, 6.6, -17.2, 9, -13.4, 9.2, -10.6, 7.4, -12.4, 5.2, -13.8, 2.6, -12.4, 0.6, -13.6, -1.4, -11.6, -2.8, -7, -4.6, -1.5], c: 'hair' },
      { t: 'poly', p: [-2.8, -12.2, -1.2, -12.6, -1.4, -7, -2, -2, -2.8, 1.5, -3.6, -3, -3.4, -8.5], c: 'hair' },
      { t: 'circ', x: -2.4, y: -19.4, r: 2.8, c: 'hair' },
      { t: 'poly', p: [7.6, -12.6, 9.2, -11, 8.8, -6.5, 7.8, -4.2, 8, -8.5], c: 'hair' },
      { t: 'line', p: [-5, -16.5, 0, -18.4, 5.4, -16.8], c: 'hair+0.28', w: 0.9, o: false },
      { t: 'line', p: [-7.4, -12, -6.8, -6, -5, -2.5], c: 'hair+0.16', w: 0.7, o: false },
    ],
    hair1: [
      { t: 'rect', x: -4, y: -3, w: 8.4, h: 13.5, r: 3.5, c: 'hair' },
      { t: 'line', p: [-1, 0, -1.4, 10], c: 'hair+0.18', w: 0.7, o: false },
    ],
    hair2: [
      { t: 'poly', p: [-3.6, -0.5, 3.6, -0.5, 3.6, 9, 2.6, 15, 0.6, 19, -1.2, 17, -2.6, 12, -3.4, 7], c: 'hair' },
      { t: 'line', p: [0.6, 0, 1.2, 15], c: 'hair+0.18', w: 0.6, o: false },
      { t: 'line', p: [-1.6, 2, -1.8, 12], c: 'hair+0.12', w: 0.5, o: false },
    ],
  } };

  // ---------- outfit ----------
  const add = (slot, item) => { const i = PR.EQUIP[slot].findIndex((x) => x.id === item.id); if (i >= 0) PR.EQUIP[slot][i] = item; else PR.EQUIP[slot].push(item); };
  add('hat', { id: 'xian_crown', name: 'รัดเกล้าทอง', shapes: { head: [
    { t: 'poly', p: [-4.6, -19.6, -0.2, -20.4, 0.6, -22.4, -1.2, -24, -3.8, -23.6, -5.2, -21.6], c: '#e6c160' },
    { t: 'rect', x: -4.8, y: -20.6, w: 5.4, h: 1, c: '#a8741f', o: false },
    { t: 'line', p: [-7, -20.6, 2.6, -24.2], c: '#e6c160', w: 0.7 },
    { t: 'circ', x: -2.2, y: -22.2, r: 0.8, c: '#f2f6ff', o: false },
  ] } });
  add('top', { id: 'xian_robe', name: 'ชุดคลุมเซียนดำทอง', pal: { top: '#17141d', top2: GOLD, belt: '#24202c', arm: '#17141d' }, shapes: {
    torso: [
      { t: 'poly', p: [1.2, -13.2, 4.8, -13.2, 1.6, -6.5], c: '#e9e4d8', o: false },
      { t: 'line', p: [4.8, -13, 0.8, -5.5], c: 'top2', w: 1.1, o: false },
      { t: 'line', p: [-3.8, -12.6, 0.6, -5.8], c: 'top2*0.8', w: 0.8, o: false },
      { t: 'line', p: [-3.8, -8.6, -3, -10.6, -1.2, -10.8, -0.8, -9.4, -1.8, -8.8, -2.2, -9.6], c: 'top2*0.75', w: 0.6, o: false },
      { t: 'circ', x: 3.2, y: -9.2, r: 0.8, c: 'top2', o: false },
      { t: 'rect', x: -4.9, y: -4.6, w: 10, h: 2.4, c: 'belt' },
      { t: 'rect', x: -4.9, y: -3.8, w: 10, h: 0.7, c: 'top2', o: false },
      { t: 'rect', x: 1.2, y: -5, w: 2.2, h: 3.2, c: 'top2' },
    ],
    armF: [{ t: 'ell', x: 0.2, y: 0.4, rx: 3.1, ry: 2.8, c: 'top' }, { t: 'line', p: [-2.2, 1, 2.6, 1.6], c: 'top2', w: 0.7, o: false }],
    armB: [{ t: 'ell', x: 0.2, y: 0.4, rx: 3.1, ry: 2.8, c: 'top' }],
    // wide bell sleeves that hang past the wrist
    foreF: [
      { t: 'poly', p: [-1.9, -0.8, 1.9, -0.8, 3.4, 5.6, 4.2, 8.6, -4.2, 8.6, -3.4, 5.6], c: 'top' },
      { t: 'rect', x: -4.2, y: 7.4, w: 8.4, h: 1.3, c: 'top2', o: false },
      { t: 'line', p: [-2.4, 3, -1, 6.5], c: 'top2*0.7', w: 0.6, o: false },
    ],
    foreB: [
      { t: 'poly', p: [-1.9, -0.8, 1.9, -0.8, 3.4, 5.6, 4.2, 8.6, -4.2, 8.6, -3.4, 5.6], c: 'top' },
      { t: 'rect', x: -4.2, y: 7.4, w: 8.4, h: 1.3, c: 'top2', o: false },
    ],
    // long robe skirt in front of the legs: open front edge, embroidery, gold hem
    skirt: [
      { t: 'poly', p: [-5.2, -2, 5.6, -2, 7.4, 10, 8.6, 15.6, -7.8, 15.6, -6.6, 10], c: 'top' },
      { t: 'line', p: [5.2, -1.6, 8, 15.2], c: 'top2', w: 1, o: false },
      { t: 'line', p: [-5.6, 11.6, -4.4, 9.4, -2.2, 9.2, -1.6, 10.8, -2.8, 11.6, -3.4, 10.6], c: 'top2*0.8', w: 0.7, o: false },
      { t: 'line', p: [-1, 12.8, 0.4, 10.8, 2.6, 10.6, 3.2, 12, 2, 12.8, 1.4, 11.9], c: 'top2*0.8', w: 0.7, o: false },
      { t: 'line', p: [3.6, 9.6, 4.6, 7.8, 6.2, 8, 6.4, 9.2], c: 'top2*0.7', w: 0.6, o: false },
      { t: 'rect', x: -7.8, y: 14.2, w: 16.4, h: 1.4, c: 'top2', o: false },
    ],
  } });
  add('pants', { id: 'xian_pants', name: 'กางเกงเซียน', pal: { pants: '#1b1822' } });
  add('shoes', { id: 'xian_boots', name: 'รองเท้าเซียน', pal: { shoes: '#1d1a24' }, shapes: {
    footF: [{ t: 'line', p: [-2, 0.2, 4.6, 0.6], c: GOLD, w: 0.6, o: false }],
  } });
  add('back', { id: 'xian_outer', name: 'เสื้อคลุมยาวลายทอง', pal: { cape: '#1b1822', cape2: GOLD }, shapes: {
    cape1: [
      { t: 'poly', p: [-3.2, -0.6, 2.6, -0.6, 3.6, 7, -4, 7], c: 'cape' },
      { t: 'line', p: [-3.2, 0, -3.9, 7], c: 'cape2', w: 0.8, o: false },
    ],
    cape2: [
      { t: 'poly', p: [-4, 0, 3.6, 0, 4.4, 7, -4.6, 7], c: 'cape' },
      { t: 'line', p: [-4, 0, -4.6, 7], c: 'cape2', w: 0.8, o: false },
      { t: 'line', p: [-2, 4.4, -1, 2.4, 1, 2.2, 1.6, 3.6, 0.4, 4.4, -0.2, 3.5], c: 'cape2*0.7', w: 0.6, o: false },
    ],
    cape3: [
      { t: 'poly', p: [-4.6, 0, 4.4, 0, 5, 7.6, 0.4, 9.4, -5.2, 7.6], c: 'cape' },
      { t: 'line', p: [-5.2, 7.4, 0.4, 9.2, 4.9, 7.4], c: 'cape2', w: 1, o: false },
      { t: 'line', p: [-4.6, 0, -5.2, 7.4], c: 'cape2', w: 0.8, o: false },
      { t: 'line', p: [-2.6, 5.2, -1.4, 3, 0.8, 2.8, 1.4, 4.2, 0.2, 5, -0.4, 4.1], c: 'cape2*0.7', w: 0.6, o: false },
    ],
  } });

  // ---------- weapon: straight jian with a gold guard and tassel ----------
  PR.WEAPONS.jian = {
    name: 'กระบี่เซียน', set: 'xianxia', tip: [27.5, 0], base: [6, 0],
    pal: { grip: '#1a1620', guard: '#d9b350', blade: '#e9eef5', tassel: '#d9b350' },
    shapes: [
      { t: 'rect', x: -3.6, y: -0.9, w: 5.6, h: 1.8, r: 0.6, c: 'grip' },
      { t: 'circ', x: -4.2, y: 0, r: 1.2, c: 'guard' },
      { t: 'poly', p: [-4.6, 0.6, -6.6, 4.6, -5, 5, -3.8, 1], c: 'tassel', o: false },
      { t: 'poly', p: [2, -2.6, 3.6, -1.2, 3.6, 1.2, 2, 2.6, 2.6, 0], c: 'guard' },
      { t: 'poly', p: [3.6, -1.05, 25, -1.05, 27.8, 0, 25, 1.05, 3.6, 1.05], c: 'blade' },
      { t: 'line', p: [4.4, 0, 24.6, 0], c: 'blade*0.7', w: 0.5, o: false },
    ],
  };
  PR.ELEMENTS.goldthunder = { name: 'อัสนีทอง', ramp: ['#ffffff', '#fff1b8', '#ffd25a', '#a8741f'] };

  // ---------- move set ----------
  // stance: sword low and forward, off hand folded behind the back
  const ST = { armF: -14, foreF: -30, wrot: 82, torso: 1, head: -1, armB: 34, foreB: -118, handB: 0, thighF: -6, shinF: 6, thighB: 8, shinB: 4 };
  const BEHIND = { armB: 34, foreB: -118 };
  const K = (t, base, extra, ease) => Object.assign({ t }, base, extra, ease ? { ease } : {});
  const EL = 'goldthunder';
  PR.SETS.xianxia = { name: 'กระบี่เซียน', stance: ST,
    attacks: ['xian_rise', 'xian_cleave', 'xian_flash'], skills: ['xian_palm', 'xian_heaven'] };

  PR.registerClips([
    { id: 'xian_rise', name: 'กระบี่ปาดลม', set: 'xianxia', dur: 0.44, trail: [0.07, 0.2], keys: [
      K(0, ST, { x: 0 }),
      K(0.08, {}, { armF: 55, foreF: -22, wrot: 42, torso: 8, head: 2, thighF: -12, shinF: 14 }, 'out'),
      K(0.17, BEHIND, { armF: -150, foreF: -14, wrot: -34, torso: -7, head: -5, thighF: -30, shinF: 18, thighB: 20, shinB: 8, x: 6 }, 'outExpo'),
      K(0.44, ST, { x: 7 }),
    ], events: [
      { t: 0.09, fx: 'slash', x: 6, y: -24, r: 24, a0: 75, a1: -150, thick: 6, el: EL },
      { t: 0.12, fx: 'spark', at: 'tip', n: 6, el: EL },
      { t: 0.12, hit: { range: [0, 38], dmg: [9, 13], knock: 3, stop: 0.05, shake: 1.5 }, el: EL },
    ] },
    { id: 'xian_cleave', name: 'กระบี่ผ่าฟ้า', set: 'xianxia', dur: 0.5, trail: [0.12, 0.25], keys: [
      K(0, ST, { x: 0 }),
      K(0.12, BEHIND, { armF: -195, foreF: -22, wrot: -4, torso: -9, head: -6, thighF: -8, shinF: 8 }, 'out'),
      K(0.21, BEHIND, { armF: -4, foreF: -10, wrot: 46, torso: 17, head: 7, thighF: -42, shinF: 26, thighB: 24, shinB: 12, x: 9 }, 'outExpo'),
      K(0.5, ST, { x: 10 }),
    ], events: [
      { t: 0.13, fx: 'slash', x: 6, y: -24, r: 25, a0: -135, a1: 50, thick: 7, el: EL },
      { t: 0.17, hit: { range: [0, 40], dmg: [11, 16], knock: 5, stop: 0.06, shake: 2 }, el: EL },
      { t: 0.18, fx: 'flash', at: 'tip', size: 9, el: EL },
    ] },
    { id: 'xian_flash', name: 'อัสนีตัดเงา', set: 'xianxia', dur: 0.78, trail: [0.16, 0.36], keys: [
      K(0, ST, { x: 0 }),
      K(0.14, BEHIND, { armF: 40, foreF: -112, wrot: 72, torso: 20, head: 4, thighF: -38, shinF: 62, thighB: 26, shinB: 50, x: -3 }, 'out'),
      K(0.26, BEHIND, { armF: -88, foreF: -3, wrot: 91, torso: 24, head: 6, thighF: -52, shinF: 30, thighB: 40, shinB: 22, x: 52 }, 'outExpo'),
      K(0.5, {}, { armF: -82, foreF: -6, wrot: 88, torso: 18 }, 'linear'),
      K(0.78, ST, { x: 54 }),
    ], events: [
      { t: 0.15, fx: 'dust', at: 'feet', n: 8, dir: -1 },
      { t: 0.17, afterimage: 0.32 }, { t: 0.21, afterimage: 0.32 }, { t: 0.25, afterimage: 0.32 },
      { t: 0.18, fx: 'lines', x: -6, y: -26, n: 10, len: 46, el: EL },
      { t: 0.24, hit: { range: [-56, 50], dmg: [14, 18], knock: 2, stop: 0.04, shake: 2 }, el: EL },
      { t: 0.42, fx: 'lightning', at: 'target', y: 0, el: EL },
      { t: 0.42, fx: 'ring', at: 'target', y: 0, r: 30, el: EL },
      { t: 0.43, hit: { area: 18, dmg: [22, 30], knock: 10, launch: 70, stop: 0.1, shake: 4 }, at: 'target', y: 0, el: EL },
    ] },
    { id: 'xian_palm', name: 'ฝ่ามืออัสนี', set: 'xianxia', dur: 0.62, keys: [
      K(0, ST, { x: 0 }),
      K(0.14, {}, { armB: 20, foreB: -130, torso: -6, head: -2, armF: 10, foreF: -40, thighF: -14, shinF: 14 }, 'out'),
      K(0.24, {}, { armB: -88, foreB: -4, handB: -20, torso: 14, head: 4, armF: 30, foreF: -30, wrot: 40, thighF: -36, shinF: 22, thighB: 22, x: 5 }, 'outExpo'),
      K(0.45, {}, { armB: -84, foreB: -6, torso: 12 }, 'linear'),
      K(0.62, ST, { x: 5 }),
    ], events: [
      { t: 0.05, fx: 'aura', life: 0.25, rate: 40, el: EL },
      { t: 0.24, fx: 'burst', x: 16, y: -30, r: 12, sparks: 16, el: EL },
      { t: 0.24, fx: 'projectile', x: 16, y: -30, kind: 'orb', speed: 230, hit: { dmg: [16, 22], knock: 7, stop: 0.07, shake: 2.5 }, el: EL },
      { t: 0.25, shake: 1.5 },
    ] },
    { id: 'xian_heaven', name: 'สายฟ้าสวรรค์', set: 'xianxia', dur: 1.25, keys: [
      K(0, ST, { y: 0 }),
      K(0.25, {}, { armF: -176, foreF: -6, wrot: 92, armB: -70, foreB: -95, torso: -6, head: -12, y: -3 }, 'out'),   // blade straight up
      K(0.95, {}, { armF: -172, foreF: -8, wrot: 90, armB: -66, foreB: -100, torso: -5, head: -10, y: -4 }, 'linear'),
      K(1.25, ST, { y: 0 }),
    ], events: [
      { t: 0.05, fx: 'aura', life: 1.0, rate: 55, el: EL },
      { t: 0.08, fx: 'circle', at: 'target', y: 0, r: 22, life: 1.05, el: EL },
      { t: 0.3, fx: 'flash', at: 'tip', size: 12, el: EL },
      ...[0.45, 0.62, 0.8].map((t, i) => ({ t, fx: 'lightning', at: 'target', x: [-6, 6, 0][i], y: 0, el: EL })),
      ...[0.45, 0.62].map((t) => ({ t, hit: { area: 16, dmg: [10, 14], knock: 2, stop: 0.04, shake: 2.5 }, at: 'target', y: 0, el: EL })),
      { t: 0.8, hit: { area: 20, dmg: [26, 34], knock: 9, launch: 90, stop: 0.12, shake: 5 }, at: 'target', y: 0, el: EL },
      { t: 0.8, fx: 'burst', at: 'target', y: -10, r: 18, sparks: 20, el: EL },
      { t: 0.8, fx: 'ring', at: 'target', y: 0, r: 44, el: EL },
    ] },
  ]);

  // ---------- ready-made character ----------
  PR.CHARACTER_PRESETS = PR.CHARACTER_PRESETS || {};
  PR.CHARACTER_PRESETS.thunder_sage = { name: 'เซียนอัสนีทอง', cfg: {
    hair: 'xian_long',
    equip: { hat: 'xian_crown', top: 'xian_robe', gloves: 'none', pants: 'xian_pants', shoes: 'xian_boots', face: 'none', back: 'xian_outer' },
    colors: { skin: '#f2d6c4', hair: '#2b1d19', eye: '#3a2618' },
    weapon: 'jian', offhand: 'none', element: 'goldthunder', wscale: 1, refine: 6, images: {},
    body: { head: 0.74, torsoLen: 1.42, torsoW: 1.05, armLen: 1.45, foreLen: 1.45, thighLen: 1.62, shinLen: 1.66, limbW: 0.92, hand: 0.92, foot: 1 },
    // a calm, upright walk: short steps, little arm swing, slight float when running
    motion: { walkSpeed: 34, stride: 24, sway: 0.45, armSwing: 6, legSwing: 22, kneeLift: 22, walkLean: 1, walkElbow: 18,
      runLean: 16, runArmSwing: 16, runLegSwing: 44, runKneeLift: 64, runElbow: 60, bounce: 1.4, breath: 0.8, breathSpeed: 1.5, idleStance: 0.8, idleLean: 0 },
  } };
})();
