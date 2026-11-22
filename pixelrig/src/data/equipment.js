'use strict';
// Body, hair and equipment art. All shapes are in bone-local units, character facing RIGHT (+x = forward).
// Limbs hang along +y from their joint. Color tokens: "#hex", palette key ("top"), "key*0.8" darker, "key+0.3" lighter.
// Extra draw slots: "skirt" uses the pelvis bone but is drawn in front of both legs.

PR.BASE_PALETTE = {
  skin: '#f6c9a6', hair: '#dfe4f0', eye: '#3a7bd5', top: '#3d5a99', top2: '#c9a24a',
  pants: '#2c2f4a', belt: '#5a3a22', metal: '#d9b350', shoes: '#6b4a2e', arm: 'skin', hand: 'skin',
  cape: '#7a2a2a', cape2: '#c9a24a', hat: '#5b3b8c', hat2: '#e0c060', gem: '#4fd0ff', steel: '#b9c4d4',
};

PR.BODY = {
  pelvis: [
    { t: 'rect', x: -4.5, y: -2, w: 9, h: 5, r: 1.5, c: 'pants' },
    { t: 'rect', x: -4.8, y: -2.6, w: 9.6, h: 1.8, c: 'belt' },
    { t: 'rect', x: 1, y: -2.8, w: 2, h: 2.2, c: 'metal', o: false },
  ],
  torso: [
    { t: 'poly', p: [-4.5, 0.5, -4.8, -10, -3.8, -13, 3.8, -13, 5, -10, 5, 0.5], c: 'top' },
    { t: 'rect', x: -4.6, y: -1.6, w: 9.6, h: 2, c: 'top2', o: false },
    { t: 'poly', p: [0.5, -13, 4, -13, 2.4, -10], c: 'top2', o: false },
  ],
  head: [
    { t: 'rect', x: -1.5, y: -3, w: 3.2, h: 4, c: 'skin*0.85' },
    { t: 'circ', x: 0.5, y: -10, r: 8, c: 'skin' },
    { t: 'rect', x: 4, y: -10.5, w: 1.8, h: 3.2, c: 'eye', o: false },
    { t: 'rect', x: 4.3, y: -10.3, w: 0.8, h: 0.9, c: '#ffffff', o: false },
    { t: 'rect', x: 3.6, y: -12.6, w: 2.8, h: 0.8, c: 'hair*0.7', o: false },
    { t: 'rect', x: 5.8, y: -5.6, w: 1.4, h: 0.6, c: 'skin*0.6', o: false },
    { t: 'ell', x: -2.6, y: -8.6, rx: 1.3, ry: 1.8, c: 'skin*0.86', o: false },
    { t: 'ell', x: 6.3, y: -6.6, rx: 1.3, ry: 0.7, c: '#f4a0a0', o: false, a: 0.6 },
  ],
  armF: [{ t: 'rect', x: -1.9, y: -1.5, w: 3.8, h: 8.5, r: 1.6, c: 'top' }],
  foreF: [{ t: 'rect', x: -1.6, y: -0.8, w: 3.2, h: 7.3, r: 1.4, c: 'arm' }],
  handF: [{ t: 'circ', x: 0, y: 1.5, r: 2.1, c: 'hand' }],
  thighF: [{ t: 'rect', x: -2.3, y: -1.2, w: 4.6, h: 9, r: 2, c: 'pants' }],
  shinF: [
    { t: 'rect', x: -2, y: -0.8, w: 4, h: 8.5, r: 1.6, c: 'pants' },
    { t: 'rect', x: -2.2, y: 3.5, w: 4.4, h: 4.5, r: 1, c: 'shoes' },
  ],
  footF: [
    { t: 'poly', p: [-2.2, -0.8, 2.5, -0.8, 5.5, 0.8, 5.8, 2.8, -2.4, 2.8], c: 'shoes' },
    { t: 'rect', x: -2.4, y: 2, w: 8.2, h: 1, c: 'shoes*0.6', o: false },
  ],
};
// back limbs reuse the front limb art (drawn darker by the renderer)
for (const [b, f] of [['armB', 'armF'], ['foreB', 'foreF'], ['handB', 'handF'], ['thighB', 'thighF'], ['shinB', 'shinF'], ['footB', 'footF']]) PR.BODY[b] = PR.BODY[f];

PR.HAIR = {
  spiky: { name: 'ผมชี้', shapes: { head: [
    { t: 'poly', p: [-7.5, -6, -8.5, -11, -7, -15.5, -3, -18.8, 2, -19, 6, -17.5, 8.8, -14, 9.2, -11.5, 7, -13, 6, -11.2, 4.4, -13.4, 2, -11.5, 0, -13.5, -2.5, -11, -4, -12.5, -5, -6.5], c: 'hair' },
    { t: 'poly', p: [-8.4, -9.5, -11.2, -10.8, -8.2, -13.2], c: 'hair' },
    { t: 'poly', p: [-7.8, -13.5, -10, -16.2, -6.2, -16.4], c: 'hair' },
    { t: 'poly', p: [-1, -16.5, 3, -17.6, 6, -15.8, 3, -16.2], c: 'hair+0.4', o: false },
  ] } },
  bob: { name: 'ผมบ๊อบ', shapes: { head: [
    { t: 'poly', p: [-8, -2.5, -8.8, -10, -7, -16, -2, -18.8, 3, -18.8, 7.5, -16, 9.2, -12, 8.6, -10.6, 3, -12.6, 1, -11, -1, -12.2, -2.2, -8, -3.6, -2], c: 'hair' },
    { t: 'poly', p: [-2, -17, 3, -17.6, 6, -15.6, 2, -16], c: 'hair+0.4', o: false },
  ] } },
  ponytail: { name: 'ผมหางม้า', shapes: {
    head: [
      { t: 'poly', p: [-7.5, -7, -8.5, -12, -6.5, -16.5, -2, -18.8, 3, -18.8, 7.5, -16, 9, -12, 7.8, -11.6, 3, -13, 0, -12, -2.5, -12.4, -5, -7], c: 'hair' },
      { t: 'circ', x: -7.2, y: -12, r: 1.4, c: 'top2' },
    ],
    hair1: [{ t: 'rect', x: -2, y: -1, w: 4, h: 7, r: 2, c: 'hair' }],
    hair2: [{ t: 'poly', p: [-2, -0.5, 2, -0.5, 1.2, 6, -0.6, 7.5], c: 'hair' }],
  } },
  long: { name: 'ผมยาว', shapes: {
    head: [{ t: 'poly', p: [-8, -4, -8.8, -11, -7, -16, -2, -18.8, 3, -18.8, 7.5, -16, 9.2, -12, 8.6, -10.6, 3, -12.6, 0.5, -11.4, -2, -12, -3.5, -6], c: 'hair' }],
    hair1: [{ t: 'rect', x: -3, y: -2, w: 6, h: 8.5, r: 2.5, c: 'hair' }],
    hair2: [{ t: 'poly', p: [-3, -0.5, 3, -0.5, 2.4, 7, 0, 9, -2.8, 7], c: 'hair' }],
  } },
};

PR.EQUIP_SLOTS = [
  ['hat', 'หมวก'], ['top', 'เสื้อ/เกราะ'], ['gloves', 'ถุงมือ'], ['pants', 'กางเกง'],
  ['shoes', 'รองเท้า'], ['face', 'หน้า'], ['back', 'หลัง (ผ้าคลุม)'],
];

const CAPE = (c, c2) => ({
  pal: { cape: c, cape2: c2 },
  shapes: {
    cape1: [{ t: 'poly', p: [-2.6, -0.5, 2.2, -0.5, 2.6, 7, -2.9, 7], c: 'cape' }],
    cape2: [{ t: 'poly', p: [-2.9, 0, 2.6, 0, 3, 7, -3.4, 7], c: 'cape' }],
    cape3: [
      { t: 'poly', p: [-3.4, 0, 3, 0, 3.4, 6, 0, 7.5, -3.8, 6], c: 'cape' },
      { t: 'line', p: [-3.6, 6, 0, 7.4, 3.3, 6], c: 'cape2', w: 0.9, o: false },
    ],
  },
});

PR.EQUIP = {
  hat: [
    { id: 'none', name: '— ไม่สวม —' },
    { id: 'bandana', name: 'ผ้าคาดหัว', shapes: { head: [
      { t: 'poly', p: [-7.8, -11, -6.5, -15, -1, -16.6, 5, -15.6, 8.8, -12.6, 8.8, -10.8, 2, -12.6, -7, -9], c: '#f2efe6' },
      { t: 'circ', x: 2.4, y: -14.4, r: 1.2, c: '#e05a7a', o: false },
      { t: 'poly', p: [-7.5, -10.5, -12.5, -7.5, -13, -4, -9.5, -8.2], c: '#f2efe6' },
    ] } },
    { id: 'wizard', name: 'หมวกพ่อมด', shapes: { head: [
      { t: 'poly', p: [-6, -15, 7.5, -15, 3, -23, -3.5, -29, -8.5, -28, -3, -23], c: 'hat' },
      { t: 'rect', x: -6.2, y: -17.4, w: 13.6, h: 2.2, c: 'hat2', o: false },
      { t: 'ell', x: 0.6, y: -15, rx: 11.5, ry: 2.2, c: 'hat' },
    ] } },
    { id: 'helm', name: 'หมวกเหล็ก', shapes: { head: [
      { t: 'poly', p: [-8.6, -6, -8.8, -12.5, -5.5, -17.6, 1, -19, 6.5, -17.5, 9.4, -13, 9.4, -9.6, 5, -9.6, 4.4, -12.6, -3, -12.2, -4, -6], c: 'steel' },
      { t: 'rect', x: 4.4, y: -12.8, w: 5, h: 1.2, c: 'steel*0.55', o: false },
      { t: 'poly', p: [-1, -19, 1, -24, 3, -19], c: '#c0392b' },
    ] } },
    { id: 'crown', name: 'มงกุฎ', shapes: { head: [
      { t: 'poly', p: [-5, -15.5, -5.5, -21, -2.5, -18.5, 0.5, -22.5, 3.5, -18.5, 6.5, -21, 6, -15.5], c: '#f2c94c' },
      { t: 'circ', x: 0.5, y: -17.2, r: 1.2, c: '#e74c3c', o: false },
    ] } },
    { id: 'hood', name: 'ฮู้ด', shapes: { head: [
      { t: 'poly', p: [-9.5, -2, -9.8, -12, -6.5, -17.8, 0, -19.6, 6, -18, 9.6, -13.5, 9.4, -9, 7.5, -12.4, 2, -14.6, -3, -12, -4.5, -3], c: 'cape' },
    ] } },
  ],
  top: [
    { id: 'tunic', name: 'เสื้อผ้า', pal: { top: '#3d5a99', top2: '#c9a24a' } },
    { id: 'plate', name: 'เกราะเหล็ก', pal: { top: '#6d7a90', top2: '#d9b350' }, shapes: {
      torso: [
        { t: 'poly', p: [-4, -12.6, 4.6, -12.6, 5.8, -6.5, 3, -3, -3, -3, -4.6, -6.5], c: 'steel' },
        { t: 'circ', x: 1, y: -8, r: 1.5, c: 'gem' },
      ],
      armF: [{ t: 'ell', x: 0, y: 0, rx: 3.3, ry: 2.8, c: 'steel' }],
      armB: [{ t: 'ell', x: 0, y: 0, rx: 3.3, ry: 2.8, c: 'steel' }],
    } },
    { id: 'robe', name: 'ชุดคลุมเวทย์', pal: { top: '#5b3b8c', top2: '#e0c060' }, shapes: {
      skirt: [
        { t: 'poly', p: [-5, -2, 5.5, -2, 7.5, 12.5, -6.5, 12.5], c: 'top' },
        { t: 'rect', x: -6.6, y: 11, w: 14.2, h: 1.6, c: 'top2', o: false },
      ],
    } },
    { id: 'leather', name: 'เกราะหนัง', pal: { top: '#7a4f2e', top2: '#3b2a1a' }, shapes: {
      torso: [{ t: 'line', p: [-4, -12, 4.5, -2], c: 'top2', w: 1.4 }],
    } },
    { id: 'gi', name: 'ชุดนักสู้', pal: { top: '#f0ece2', top2: '#c0392b', belt: '#222222' } },
  ],
  gloves: [
    { id: 'none', name: '— ไม่สวม —' },
    { id: 'leather', name: 'ถุงมือหนัง', pal: { arm: '#6b4026', hand: '#7a4a2c' } },
    { id: 'gauntlet', name: 'สนับมือเหล็ก', pal: { arm: '#9aa6b8', hand: '#c9d2de' }, shapes: {
      foreF: [{ t: 'rect', x: -2.1, y: 2.5, w: 4.2, h: 3, r: 0.8, c: 'steel' }],
      foreB: [{ t: 'rect', x: -2.1, y: 2.5, w: 4.2, h: 3, r: 0.8, c: 'steel' }],
    } },
    { id: 'gold', name: 'สนับมือทอง', pal: { arm: '#c99a3a', hand: '#f2d27a' } },
  ],
  pants: [
    { id: 'cloth', name: 'กางเกงผ้า', pal: { pants: '#2c2f4a' } },
    { id: 'white', name: 'กางเกงขาว', pal: { pants: '#e8e4da' } },
    { id: 'red', name: 'กางเกงแดง', pal: { pants: '#8a2a2a' } },
    { id: 'armored', name: 'สนับขาเหล็ก', pal: { pants: '#3a4256' }, shapes: {
      shinF: [{ t: 'ell', x: 0.6, y: 0, rx: 2.6, ry: 2.2, c: 'steel' }],
      shinB: [{ t: 'ell', x: 0.6, y: 0, rx: 2.6, ry: 2.2, c: 'steel' }],
    } },
  ],
  shoes: [
    { id: 'boots', name: 'รองเท้าบูท', pal: { shoes: '#6b4a2e' } },
    { id: 'black', name: 'รองเท้าดำ', pal: { shoes: '#2a2a33' } },
    { id: 'gold', name: 'รองเท้าทอง', pal: { shoes: '#d9b350' } },
    { id: 'white', name: 'รองเท้าขาว', pal: { shoes: '#ece8de' } },
  ],
  face: [
    { id: 'none', name: '— ไม่มี —' },
    { id: 'eyepatch', name: 'ผ้าปิดตา', shapes: { head: [
      { t: 'line', p: [-7, -13.5, 8.4, -10.2], c: '#2a2030', w: 0.9, o: false },
      { t: 'ell', x: 5, y: -9.4, rx: 2.4, ry: 2.6, c: '#2a2030' },
    ] } },
    { id: 'mask', name: 'ผ้าปิดปาก', shapes: { head: [
      { t: 'poly', p: [-1, -7.5, 8.6, -8, 8.2, -3.5, 4, -2, -0.5, -3.5], c: '#2a2a33' },
    ] } },
    { id: 'glasses', name: 'แว่นตา', shapes: { head: [
      { t: 'line', p: [3.2, -11.2, 6.8, -11.2, 6.8, -8.2, 3.2, -8.2, 3.2, -11.2], c: '#222222', w: 0.7, o: false },
      { t: 'line', p: [3.2, -10, -1, -10.5], c: '#222222', w: 0.6, o: false },
    ] } },
  ],
  back: [
    { id: 'none', name: '— ไม่มี —' },
    Object.assign({ id: 'capeRed', name: 'ผ้าคลุมแดง' }, CAPE('#8a2323', '#d9b350')),
    Object.assign({ id: 'capeDark', name: 'ผ้าคลุมดำทอง' }, CAPE('#2b2340', '#d9b350')),
    Object.assign({ id: 'capeBlue', name: 'ผ้าคลุมน้ำเงิน' }, CAPE('#23407a', '#e8ecf5')),
  ],
};

PR.findItem = (slot, id) => (PR.EQUIP[slot] || []).find((i) => i.id === id) || PR.EQUIP[slot][0];

// Default character config (what the app saves/loads).
PR.DEFAULT_CHAR = {
  hair: 'spiky',
  equip: { hat: 'none', top: 'plate', gloves: 'gauntlet', pants: 'cloth', shoes: 'gold', face: 'none', back: 'capeRed' },
  colors: {},          // user overrides, e.g. {skin:'#...'}
  weapon: 'sword', offhand: 'none', element: 'none', wscale: 1, refine: 0,
  images: {},          // bone -> {src, x, y, s, r, hide}
};

PR.buildPalette = (cfg) => {
  const pal = Object.assign({}, PR.BASE_PALETTE);
  for (const [slot] of PR.EQUIP_SLOTS) Object.assign(pal, PR.findItem(slot, cfg.equip[slot]).pal || {});
  const w = PR.WEAPONS && PR.WEAPONS[cfg.weapon];
  if (w && w.pal) Object.assign(pal, w.pal);
  Object.assign(pal, cfg.colors || {});
  return pal;
};

PR.buildBodyShapes = (cfg) => {
  const out = {};
  const add = (map) => { for (const b in map) (out[b] = out[b] || []).push(...map[b]); };
  add(PR.BODY);
  add((PR.HAIR[cfg.hair] || PR.HAIR.spiky).shapes);
  for (const [slot] of PR.EQUIP_SLOTS) add(PR.findItem(slot, cfg.equip[slot]).shapes || {});
  return out;
};
