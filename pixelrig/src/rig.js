'use strict';
// Skeleton, forward/inverse kinematics, auto-grounding, secondary motion and drawing.
// Character space: x forward (facing right), y down, origin on the ground under the character.
// Rotation channels are degrees, screen-clockwise. Limbs hang along +y, so for arms/legs
// NEGATIVE = swing forward; torso/head point up, so POSITIVE = lean/nod forward.

PR.BONES = [
  { n: 'root', p: null, o: [0, 0], tip: [0, 0] },
  { n: 'pelvis', p: 'root', o: [0, 0], tip: [0, 3] },
  { n: 'torso', p: 'pelvis', o: [0, -1], tip: [0, -13] },
  { n: 'head', p: 'torso', o: [0, -13], tip: [0, -18] },
  { n: 'armB', p: 'torso', o: [-1, -11], tip: [0, 7] },
  { n: 'foreB', p: 'armB', o: [0, 7], tip: [0, 6] },
  { n: 'handB', p: 'foreB', o: [0, 6], tip: [0, 3] },
  { n: 'armF', p: 'torso', o: [1, -11], tip: [0, 7] },
  { n: 'foreF', p: 'armF', o: [0, 7], tip: [0, 6] },
  { n: 'handF', p: 'foreF', o: [0, 6], tip: [0, 3] },
  { n: 'thighB', p: 'pelvis', o: [-1, 1], tip: [0, 7] },
  { n: 'shinB', p: 'thighB', o: [0, 7], tip: [0, 7] },
  { n: 'footB', p: 'shinB', o: [0, 7], tip: [4, 0] },
  { n: 'thighF', p: 'pelvis', o: [2, 1], tip: [0, 7] },
  { n: 'shinF', p: 'thighF', o: [0, 7], tip: [0, 7] },
  { n: 'footF', p: 'shinF', o: [0, 7], tip: [4, 0] },
  { n: 'cape1', p: 'torso', o: [-3.5, -12], tip: [0, 7] },
  { n: 'cape2', p: 'cape1', o: [0, 7], tip: [0, 7] },
  { n: 'cape3', p: 'cape2', o: [0, 7], tip: [0, 6] },
  { n: 'hair1', p: 'head', o: [-7, -12], tip: [0, 6] },
  { n: 'hair2', p: 'hair1', o: [0, 6], tip: [0, 6] },
];
PR.BONE_MAP = Object.fromEntries(PR.BONES.map((b) => [b.n, b]));
PR.LEG = 17;            // pelvis height above ground in rest pose (default body; each rig has its own .leg)
PR.FIST = [0, 1.5];     // fist center in hand space (default body; each rig has its own .fist)

// Body proportions (per character, cfg.body). 1 = the default chibi body.
PR.DEFAULT_BODY = { head: 1, torsoLen: 1, torsoW: 1, armLen: 1, foreLen: 1, thighLen: 1, shinLen: 1, limbW: 1, hand: 1, foot: 1 };
PR.BODY_LABELS = { head: 'ขนาดหัว', torsoLen: 'ลำตัวยาว', torsoW: 'ไหล่/ตัวกว้าง', armLen: 'ต้นแขนยาว', foreLen: 'แขนท่อนล่างยาว',
  thighLen: 'ต้นขายาว', shinLen: 'หน้าแข้งยาว', limbW: 'แขนขาหนา', hand: 'ขนาดมือ', foot: 'ขนาดเท้า' };
PR.BODY_PRESETS = {
  chibi: { name: 'จิบิ', body: {} },
  normal: { name: 'ปกติ', body: { head: 0.8, torsoLen: 1.25, armLen: 1.35, foreLen: 1.35, thighLen: 1.45, shinLen: 1.45, limbW: 0.95, hand: 0.95 } },
  heroic: { name: 'ฮีโร่', body: { head: 0.7, torsoLen: 1.45, torsoW: 1.2, armLen: 1.5, foreLen: 1.5, thighLen: 1.6, shinLen: 1.65, limbW: 1.1, hand: 1.05, foot: 1.1 } },
  kid: { name: 'เด็ก', body: { head: 1.08, torsoLen: 0.85, torsoW: 0.9, armLen: 0.85, foreLen: 0.85, thighLen: 0.8, shinLen: 0.8, limbW: 0.9, hand: 0.9, foot: 0.9 } },
  brute: { name: 'ร่างใหญ่', body: { head: 0.8, torsoLen: 1.3, torsoW: 1.6, armLen: 1.3, foreLen: 1.35, thighLen: 1.2, shinLen: 1.2, limbW: 1.5, hand: 1.4, foot: 1.3 } },
  slim: { name: 'ผอมสูง', body: { head: 0.85, torsoLen: 1.35, torsoW: 0.85, armLen: 1.45, foreLen: 1.45, thighLen: 1.6, shinLen: 1.6, limbW: 0.8, hand: 0.9, foot: 0.95 } },
};
// bone -> [width factor, length factor]
PR.boneScale = (b) => {
  const arm = (l) => [b.limbW, l], cape = [b.torsoW, (b.torsoLen + b.thighLen + b.shinLen) / 3];
  return {
    pelvis: [b.torsoW, 1], torso: [b.torsoW, b.torsoLen], head: [b.head, b.head], hair1: [b.head, b.head], hair2: [b.head, b.head],
    armF: arm(b.armLen), armB: arm(b.armLen), foreF: arm(b.foreLen), foreB: arm(b.foreLen), handF: [b.hand, b.hand], handB: [b.hand, b.hand],
    thighF: arm(b.thighLen), thighB: arm(b.thighLen), shinF: arm(b.shinLen), shinB: arm(b.shinLen), footF: [b.foot, b.foot], footB: [b.foot, b.foot],
    cape1: cape, cape2: cape, cape3: cape, skirt: [b.torsoW, (b.thighLen + b.shinLen) / 2],
  };
};

// non-bone channels a clip may animate
PR.EXTRA_CHANNELS = {
  x: 'เลื่อนตัวหน้า/หลัง (หน่วย, + = ไปข้างหน้า)', y: 'ยกตัว (หน่วย, - = ขึ้น)', lean: 'เอียงทั้งตัว (องศา)',
  wrot: 'หมุนอาวุธในมือ (องศา)', wsc: 'ขนาดอาวุธ', sx: 'สเกลแนวนอน (-1 = หันกลับ ใช้ทำท่าหมุนตัว)', ik2: 'มือรองจับด้าม (0-1)',
};
PR.POSE_BONES = PR.BONES.filter((b) => b.n !== 'root').map((b) => b.n);

PR.DRAW_ORDER = ['cape3', 'cape2', 'cape1', 'hair2', 'hair1', 'armB', 'foreB', 'offhand', 'handB', 'thighB', 'shinB', 'footB',
  'pelvis', 'thighF', 'shinF', 'footF', 'skirt', 'torso', 'head', 'weapon', 'armF', 'foreF', 'handF'];
PR.BACK_BONES = new Set(['armB', 'foreB', 'handB', 'thighB', 'shinB', 'footB']);

// UI groups (the colored chips under the stage)
PR.BONE_GROUPS = [
  { id: 'head', name: 'หัว', color: '#f5a623', bones: ['head', 'hair1', 'hair2'] },
  { id: 'torso', name: 'ลำตัว', color: '#4a90e2', bones: ['pelvis', 'torso', 'cape1', 'cape2', 'cape3'] },
  { id: 'armB', name: 'แขนซ้าย (มือรอง)', color: '#a974ff', bones: ['armB', 'foreB', 'handB'] },
  { id: 'armF', name: 'แขนขวา (ถืออาวุธ)', color: '#ff4d6d', bones: ['armF', 'foreF', 'handF', 'weapon'] },
  { id: 'legs', name: 'ขาและเท้า', color: '#2ecc71', bones: ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'] },
];
PR.groupOfBone = (b) => PR.BONE_GROUPS.find((g) => g.bones.includes(b));

PR.Rig = class {
  constructor(cfg) {
    this.mats = {};
    this.sec = {};
    for (const n of ['cape1', 'cape2', 'cape3', 'hair1', 'hair2']) this.sec[n] = 0;
    this.imgCache = PR.IMG_CACHE = PR.IMG_CACHE || {};
    this.setConfig(cfg);
  }
  setConfig(cfg) {
    this.cfg = cfg;
    this.pal = PR.buildPalette(cfg);
    // body proportions: every bone gets [width, length] factors; child joints and art follow them
    const body = (this.body = Object.assign({}, PR.DEFAULT_BODY, cfg.body || {}));
    const K = (this.K = PR.boneScale(body));
    this.bones = PR.BONES.map((b) => {
      const kp = (b.p && K[b.p]) || [1, 1], k = K[b.n] || [1, 1];
      return { n: b.n, p: b.p, o: [b.o[0] * kp[0], b.o[1] * kp[1]], tip: [b.tip[0] * k[0], b.tip[1] * k[1]] };
    });
    this.boneMap = Object.fromEntries(this.bones.map((b) => [b.n, b]));
    this.len = (n) => Math.hypot(this.boneMap[n].tip[0], this.boneMap[n].tip[1]);
    this.fist = [0, PR.FIST[1] * body.hand];
    this.leg = 1 + 7 * body.thighLen + 7 * body.shinLen + 2 * body.foot;
    const raw = PR.buildBodyShapes(cfg);
    this.shapes = {};
    for (const slot in raw) { const k = K[slot] || [1, 1]; this.shapes[slot] = raw[slot].map((s) => PR.scaleShape(s, k[0], k[1])); }
    this.weapon = PR.WEAPONS[cfg.weapon] || PR.WEAPONS.fist;
    this.offhand = PR.OFFHANDS[cfg.offhand] || PR.OFFHANDS.none;
    this.element = PR.ELEMENTS[cfg.element] || PR.ELEMENTS.none;
    const used = new Set();
    for (const b in cfg.images || {}) {
      const src = cfg.images[b] && cfg.images[b].src;
      if (!src) continue;
      used.add(src);
      if (!this.imgCache[src]) { const im = new Image(); im.src = src; this.imgCache[src] = im; }
    }
    // one cache shared by every rig (exports reuse already-decoded images); trim it when it grows,
    // since the pixel editor makes a new data URL on every stroke
    const keys = Object.keys(this.imgCache);
    if (keys.length > 48) for (const k of keys) if (!used.has(k)) delete this.imgCache[k];
  }

  // pose: {bone: deg, x, y, lean, wrot, wsc, ik2}. Fills this.mats (character space).
  solve(pose, opt = {}) {
    const M = PR.M, D = PR.D2R, mats = this.mats;
    const rootM = M.rot(M.tr(M.ident(), pose.x || 0, -this.leg), (pose.lean || 0) * D);
    mats.root = rootM;
    for (const b of this.bones) {
      if (!b.p) continue;
      let r = pose[b.n];
      if (r == null) r = this.sec[b.n] != null ? this.sec[b.n] : 0;
      mats[b.n] = M.rot(M.tr(mats[b.p], b.o[0], b.o[1]), r * D);
    }
    // auto-ground: lowest body point touches y = 0, then apply the clip's own y offset
    if (!opt.noGround) {
      let maxY = -1e9;
      const fk = this.body.foot, tl = this.body.torsoLen, h = this.body.head;
      const pts = [['footF', -2 * fk, 2.8 * fk], ['footF', 5.8 * fk, 2.8 * fk], ['footB', -2 * fk, 2.8 * fk], ['footB', 5.8 * fk, 2.8 * fk],
        ['pelvis', 0, 3], ['torso', 0, -6 * tl], ['torso', 0, -13 * tl], ['shinF', 0, 0], ['shinB', 0, 0]];
      for (const [bn, x, y] of pts) maxY = Math.max(maxY, M.apply(mats[bn], x, y)[1]);
      const hc = M.apply(mats.head, 0.5 * h, -10 * h);
      maxY = Math.max(maxY, hc[1] + 7.5 * h);
      this.groundShift = -maxY;
    } else this.groundShift = 0;
    const dy = this.groundShift + (pose.y || 0);
    for (const k in mats) mats[k][5] += dy;
    // weapon
    const w = this.weapon, F = this.fist;
    const ws = (pose.wsc ?? 1) * (this.cfg.wscale || 1);
    mats.weapon = M.sc(M.rot(M.tr(mats.handF, F[0], F[1]), ((pose.wrot || 0) + (w.wrot0 || 0)) * D), ws, ws);
    // two-handed: back hand grabs grip2 with IK
    const ikw = pose.ik2 ?? (w.two ? 1 : 0);
    if (w.two && w.grip2 && ikw > 0.01) {
      const B = this.boneMap;
      const tgt = M.apply(mats.weapon, w.grip2[0], w.grip2[1]);
      const [r1, r2] = PR.solveIK(mats.torso, B.armB.o, this.len('armB'), this.len('foreB') + F[1], tgt, 1);
      const a1 = PR.lerp(pose.armB ?? 0, r1, ikw), a2 = PR.lerp(pose.foreB ?? 0, r2, ikw);
      mats.armB = M.rot(M.tr(mats.torso, B.armB.o[0], B.armB.o[1]), a1 * D);
      mats.foreB = M.rot(M.tr(mats.armB, B.foreB.o[0], B.foreB.o[1]), a2 * D);
      mats.handB = M.rot(M.tr(mats.foreB, B.handB.o[0], B.handB.o[1]), (pose.handB || 0) * D);
      this.ikOut = { armB: a1, foreB: a2 };
    } else this.ikOut = null;
    // cloth/hair must not go through the floor (e.g. lying down): lay segments on the ground
    if (!opt.noGround) for (const chain of [['cape1', 'cape2', 'cape3'], ['hair1', 'hair2']]) this.groundChain(chain, pose);
  }
  groundChain(names, pose) {
    const M = PR.M, D = PR.D2R;
    for (const n of names) {
      if (pose[n] != null) continue;
      const b = this.boneMap[n], parent = this.mats[b.p];
      const len = Math.hypot(b.tip[0], b.tip[1]);
      let m = this.mats[n];
      if (M.apply(m, b.tip[0], b.tip[1])[1] <= 0) {
        // re-place the rest of the chain from here on (children follow their parent)
        const idx = names.indexOf(n);
        for (let i = idx + 1; i < names.length; i++) {
          const c = this.boneMap[names[i]];
          this.mats[names[i]] = M.rot(M.tr(this.mats[c.p], c.o[0], c.o[1]), this.sec[names[i]] * D);
        }
        continue;
      }
      const J = [m[4], m[5]];
      // direction angle of the bone (from +x); straight down = 90deg. Lay it backwards (-x) with the tip on the floor.
      const dir = J[1] >= -0.3 ? Math.PI : Math.PI / 2 + Math.acos(PR.clamp(-J[1] / len, -1, 1));
      const local = (dir - Math.PI / 2 - M.angle(parent)) * PR.R2D;
      this.sec[n] = PR.wrapDeg(local);
      m = this.mats[n] = M.rot(M.tr(parent, b.o[0], b.o[1]), this.sec[n] * D);
      const idx = names.indexOf(n);
      for (let i = idx + 1; i < names.length; i++) {
        const c = this.boneMap[names[i]];
        this.mats[names[i]] = M.rot(M.tr(this.mats[c.p], c.o[0], c.o[1]), this.sec[names[i]] * D);
      }
    }
  }

  // cape/hair follow motion with springy lag. vel = character-space velocity (x forward, y down)
  updateSecondary(dt, vel, t) {
    const torsoA = this.mats.torso ? PR.M.angle(this.mats.torso) * PR.R2D : 0;
    const headA = this.mats.head ? PR.M.angle(this.mats.head) * PR.R2D : 0;
    const C = PR.CFG.cloth;
    const sp = PR.clamp(vel[0], -120, 120), vy = PR.clamp(vel[1], -150, 150);
    const flutter = (k) => Math.sin(t * 7 * C.flutterSpeed + k) * (2 + Math.abs(sp) * 0.06) * C.flutter;
    const cs = C.capeSwing, hs = C.hairSwing;
    const hairRest = (PR.HAIR[this.cfg.hair] || {}).rest ?? C.hairRest;   // long loose hair hangs closer to vertical than a ponytail
    const want = {
      cape1: C.capeRest + (sp * 0.32 - vy * 0.08) * cs + flutter(0) - torsoA,
      cape2: 4 + sp * 0.12 * cs + flutter(1.2) * 1.4,
      cape3: 4 + sp * 0.08 * cs + flutter(2.4) * 1.8,
      hair1: hairRest + (sp * 0.35 - vy * 0.1) * hs + flutter(0.5) - headA,
      hair2: 6 + sp * 0.1 * hs + flutter(1.7),
    };
    const k = 1 - Math.exp(-dt * C.stiffness);
    for (const n in want) this.sec[n] += (PR.clamp(want[n], -170, 170) - this.sec[n]) * (dt > 0 ? k : 1);
  }

  // Draw into g with transform R (character space -> buffer pixels). opt: {S, pixel, tint, alpha, hide:Set}
  draw(g, R, opt) {
    const M = PR.M, pal = this.pal;
    const RC = PR.CFG.render;
    const lw = ((opt.pixel ? 1 : 1.5) * RC.outlineW) / opt.S;
    const outline = opt.tint || RC.outlineW <= 0 ? null : (this.cfg.colors && this.cfg.colors.outline) || RC.outline;
    g.globalAlpha = opt.alpha ?? 1;
    for (const slot of PR.DRAW_ORDER) {
      if (opt.only && !opt.only.has(slot)) continue;
      if (slot === 'weapon') { this.drawWeapon(g, R, opt, lw, outline); continue; }
      const bone = slot === 'skirt' || slot === 'offhand' ? (slot === 'skirt' ? 'pelvis' : 'handB') : slot;
      const m = this.mats[bone];
      if (!m) continue;
      g.setTransform(...M.mul(R, m));
      const shade = PR.BACK_BONES.has(bone) ? RC.backShade : 1;
      const img = this.cfg.images && this.cfg.images[slot];
      if (slot === 'offhand') { PR.drawShapes(g, this.offhand.shapes, pal, { shade: 0.88, tint: opt.tint, outline, lw, alpha: opt.alpha }); continue; }
      if (!(img && img.hide)) PR.drawShapes(g, this.shapes[slot], pal, { shade, tint: opt.tint, outline, lw, alpha: opt.alpha });
      if (img && img.src) this.drawImage(g, img, opt);
    }
    g.globalAlpha = 1;
  }
  drawImage(g, img, opt) {
    const im = this.imgCache[img.src];
    if (!im || !im.complete || !im.naturalWidth) return;
    g.save();
    g.translate(img.x || 0, img.y || 0);
    g.rotate((img.r || 0) * PR.D2R);
    const s = img.s || 0.25;
    if (opt.tint) { g.globalAlpha = 0.5; }
    g.drawImage(im, 0, 0, im.naturalWidth * s, im.naturalHeight * s);
    g.restore();
  }
  drawWeapon(g, R, opt, lw, outline) {
    const w = this.weapon, M = PR.M;
    if (!w.shapes.length) return;
    const wm = M.mul(R, this.mats.weapon);
    g.setTransform(...wm);
    if (w.string) {   // bow string: pulled to the back hand when it is close
      const hb = M.apply(M.mul(M.inv(this.mats.weapon), this.mats.handB), this.fist[0], this.fist[1]);
      const [a, b] = w.string;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const pulled = Math.hypot(hb[0] - mid[0], hb[1] - mid[1]) < 16;
      g.beginPath(); g.moveTo(a[0], a[1]);
      if (pulled) g.lineTo(hb[0], hb[1]);
      g.lineTo(b[0], b[1]);
      g.strokeStyle = opt.tint || '#e8e4da'; g.lineWidth = Math.max(lw, 0.5); g.stroke();
    }
    const img = this.cfg.images && this.cfg.images.weapon;
    if (!(img && img.hide)) PR.drawShapes(g, w.shapes, this.pal, { tint: opt.tint, outline, lw, alpha: opt.alpha });
    if (img && img.src) this.drawImage(g, img, opt);
  }
  // world-space (character space) position of a weapon point
  weaponPoint(p) { return PR.M.apply(this.mats.weapon, p[0], p[1]); }
  bonePoint(b, x = 0, y = 0) { return PR.M.apply(this.mats[b], x, y); }
};

// Two-bone IK in character space. parentM = matrix of the chain's parent bone, off = upper bone offset.
// Returns local rotations [upper, lower] in degrees. bend +1 = elbow back (arms), -1 = knee forward (legs).
PR.solveIK = (parentM, off, L1, L2, T, bend) => {
  const S = PR.M.apply(parentM, off[0], off[1]);
  const pa = PR.M.angle(parentM);
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = PR.clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const base = Math.atan2(dy, dx);
  const a1 = Math.acos(PR.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const dir = base + bend * a1;
  const E = [S[0] + L1 * Math.cos(dir), S[1] + L1 * Math.sin(dir)];
  const dir2 = Math.atan2(T[1] - E[1], T[0] - E[0]);
  return [PR.wrapDeg((dir - Math.PI / 2 - pa) * PR.R2D), PR.wrapDeg((dir2 - dir) * PR.R2D)];
};

// Training dummy (simple rig-less prop)
PR.drawDummy = (g, R, d, opt) => {
  const lw = ((opt.pixel ? 1 : 1.5) * Math.max(PR.CFG.render.outlineW, 0.5)) / opt.S;
  const M = PR.M;
  g.setTransform(...M.rot(R, d.wob * PR.D2R));
  const pal = { wood: '#8a5a32', straw: '#d9b866', rope: '#6b3a22' };
  const tint = d.flash > 0 ? '#ffffff' : null;
  PR.drawShapes(g, [
    { t: 'rect', x: -1.5, y: -30, w: 3, h: 30, c: 'wood' },
    { t: 'rect', x: -9, y: -24, w: 18, h: 2.6, r: 1, c: 'wood' },
    { t: 'ell', x: 0, y: -17, rx: 6.5, ry: 9, c: 'straw' },
    { t: 'rect', x: -6.5, y: -19, w: 13, h: 1.4, c: 'rope', o: false },
    { t: 'rect', x: -6, y: -13, w: 12, h: 1.4, c: 'rope', o: false },
    { t: 'circ', x: 0, y: -31, r: 5, c: 'straw' },
    { t: 'circ', x: 1.8, y: -31.5, r: 0.9, c: '#3a2a1a', o: false },
    { t: 'rect', x: -5, y: -1.5, w: 10, h: 2, c: 'wood*0.7' },
  ], pal, { tint, outline: '#1a1222', lw });
};
