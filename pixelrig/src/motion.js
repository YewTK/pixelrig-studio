'use strict';
// Procedural locomotion (idle / walk / run), keyframe clip evaluation, and the Character controller.

// Locomotion settings. Every number here is editable in the "ตั้งค่า" tab (and per character via ch.prm).
PR.MOTION = {
  walkSpeed: 38, runSpeed: 82, stride: 26, sway: 1, handLag: 0.35,
  breath: 1.2, breathSpeed: 1.9, idleStance: 1, idleLean: 1.5,
  walkLean: 4, armSwing: 24, legSwing: 28, kneeLift: 34, walkElbow: 14,
  runLean: 13, runArmSwing: 42, runLegSwing: 50, runKneeLift: 80, runElbow: 80, bounce: 2.2,
};
PR.MOTION_LABELS = {
  walkSpeed: ['ความเร็วเดิน', 10, 80, 1], runSpeed: ['ความเร็ววิ่ง', 40, 180, 1], stride: ['ช่วงก้าว', 10, 50, 1],
  sway: ['สะโพกส่าย', 0, 3, 0.1], handLag: ['มือเอื่อยตาม', 0, 1.5, 0.05],
  breath: ['หายใจ (แรง)', 0, 4, 0.1], breathSpeed: ['หายใจ (เร็ว)', 0.5, 5, 0.1], idleStance: ['ยืนกางขา', 0, 3, 0.1], idleLean: ['ยืนเอนตัว', -10, 15, 0.5],
  walkLean: ['เดินโน้มตัว', -10, 20, 0.5], armSwing: ['เดินแกว่งแขน', 0, 70, 1], legSwing: ['เดินก้าวขา', 5, 60, 1], kneeLift: ['เดินยกเข่า', 0, 90, 1], walkElbow: ['เดินงอศอก', 0, 90, 1],
  runLean: ['วิ่งโน้มตัว', -5, 40, 0.5], runArmSwing: ['วิ่งแกว่งแขน', 0, 90, 1], runLegSwing: ['วิ่งก้าวขา', 10, 80, 1], runKneeLift: ['วิ่งยกเข่า', 0, 130, 1], runElbow: ['วิ่งงอศอก', 0, 130, 1], bounce: ['วิ่งลอยตัว', 0, 8, 0.1],
};

// Base pose from locomotion. phase in radians, speed in units/s, t = time (s)
PR.locoPose = (phase, speed, t, prm) => {
  const P = Object.assign({}, PR.MOTION, prm);
  const s = Math.sin(phase), c = Math.cos(phase);
  const ls = Math.sin(phase - P.handLag);
  const br = Math.sin(t * P.breathSpeed) * P.breath;
  const st = P.idleStance;
  const idle = {
    torso: P.idleLean + br, head: -1 + Math.sin(t * P.breathSpeed + 0.5) * P.breath,
    armF: 6 + br * 1.6, foreF: -12, handF: 0, armB: -4 - br * 1.2, foreB: -14, handB: 0,
    thighF: -7 * st, shinF: 7 * st, footF: 0, thighB: 9 * st, shinB: 4 * st, footB: -13 * st, pelvis: 0, lean: 0, wrot: 0,
  };
  const walk = {
    torso: P.walkLean + Math.sin(phase * 2) * 1.5 * P.sway, head: -2 - Math.sin(phase * 2) * 1.2,
    armF: P.armSwing * ls, foreF: -P.walkElbow - 10 * Math.max(0, -ls), handF: 0,
    armB: -P.armSwing * ls, foreB: -P.walkElbow - 10 * Math.max(0, ls), handB: 0,
    thighF: -P.legSwing * s, shinF: 5 + P.kneeLift * Math.max(0, c) ** 1.4, thighB: P.legSwing * s, shinB: 5 + P.kneeLift * Math.max(0, -c) ** 1.4,
    pelvis: Math.sin(phase * 2) * 1.2 * P.sway, lean: 0, wrot: 0,
  };
  walk.footF = -(walk.thighF + walk.shinF) * 0.85;
  walk.footB = -(walk.thighB + walk.shinB) * 0.85;
  const run = {
    torso: P.runLean + Math.sin(phase * 2) * 2 * P.sway, head: -9 * (P.runLean / 13),
    armF: P.runArmSwing * ls, foreF: -P.runElbow - 15 * ls, handF: 0, armB: -P.runArmSwing * ls, foreB: -P.runElbow + 15 * ls, handB: 0,
    thighF: -P.runLegSwing * s, shinF: 12 + P.runKneeLift * Math.max(0, c) ** 1.2, thighB: P.runLegSwing * s, shinB: 12 + P.runKneeLift * Math.max(0, -c) ** 1.2,
    pelvis: Math.sin(phase * 2) * 2 * P.sway, lean: 4, wrot: 0,
  };
  run.footF = -(run.thighF + run.shinF) * 0.7;
  run.footB = -(run.thighB + run.shinB) * 0.7;
  const wa = PR.clamp(speed / P.walkSpeed, 0, 1);
  const ra = PR.clamp((speed - P.walkSpeed) / Math.max(1, P.runSpeed - P.walkSpeed), 0, 1);
  const out = {};
  for (const k in idle) out[k] = PR.lerp(PR.lerp(idle[k], walk[k], wa), run[k], ra);
  out.y = -ra * P.bounce * Math.max(0, Math.sin(phase * 2 - 0.6)) * P.sway;   // flight phase when running
  return out;
};

// ---- clips ----
// clip: {id, name, dur, loop, keys:[{t, ease, ...channels}], trail:[t0,t1], events:[{t, fx|hit|...}]}
// Each channel has its own track made of the keys that mention it.
PR.compileClip = (clip) => {
  const tracks = {};
  const keys = [...clip.keys].sort((a, b) => a.t - b.t);
  for (const k of keys) {
    for (const ch in k) {
      if (ch === 't' || ch === 'ease') continue;
      (tracks[ch] = tracks[ch] || []).push({ t: k.t, v: k[ch], e: k.ease || 'inout' });
    }
  }
  // a channel that starts after t=0 eases in from its default (offsets) or from the base pose (null)
  for (const ch in tracks) {
    if (tracks[ch][0].t > 0) tracks[ch].unshift({ t: 0, v: PR.CHANNEL_DEFAULTS[ch] ?? null, e: 'linear' });
  }
  clip._tracks = tracks;
  clip._ver = PR.clipVersion(clip);
  return tracks;
};
PR.CHANNEL_DEFAULTS = { x: 0, y: 0, sx: 1, wsc: 1, lean: 0 };
PR.clipVersion = (clip) => JSON.stringify(clip.keys);
PR.sampleTrack = (tr, t, base) => {
  const val = (k) => (k.v == null ? base : k.v);
  if (t <= tr[0].t) return val(tr[0]);
  for (let i = 1; i < tr.length; i++) {
    if (t <= tr[i].t) {
      const a = tr[i - 1], b = tr[i];
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return PR.lerp(val(a), val(b), (PR.ease[b.e] || PR.ease.inout)(u));
    }
  }
  return val(tr[tr.length - 1]);
};
// base = pose the clip blends from (channels a clip leaves out come from here)
PR.sampleClip = (clip, t, base = {}) => {
  if (!clip._tracks || clip._ver !== PR.clipVersion(clip)) PR.compileClip(clip);
  const out = {};
  for (const ch in clip._tracks) out[ch] = PR.sampleTrack(clip._tracks[ch], t, base[ch] ?? PR.CHANNEL_DEFAULTS[ch] ?? 0);
  return out;
};
PR.ADDITIVE = new Set(['x', 'y']);   // offsets, not blended by weight

// ---- Character ----
PR.Character = class {
  constructor(cfg) {
    this.rig = new PR.Rig(cfg);
    this.x = 0; this.z = 0; this.h = 0;      // h = jump height (>=0 is up)
    this.vx = 0; this.vz = 0; this.vh = 0;
    this.facing = 1;
    this.phase = 0; this.time = 0; this.speed = 0;
    this.clip = null; this.clipT = 0; this.clipW = 0; this.queued = null;
    this.combo = 0; this.comboTimer = 0;
    this.trail = []; this.pose = {}; this.lastFoot = 0;
    this.afterimages = 0;
    this.prm = Object.assign({}, PR.MOTION, cfg.motion || {});   // a character may carry its own walk/run style
    this.autoMove = 0;       // 0 idle, 1 walk, 2 run (preview buttons)
    this.stats = { contact: [true, true], bob: 0 };
  }
  get set() { return PR.SETS[this.rig.weapon.set] || PR.SETS.fist; }

  play(id, opt = {}) {
    const clip = PR.getClip(id);
    if (!clip) return false;
    if (this.clip && !opt.force) {
      if (this.clipT < this.clip.dur * 0.45) { this.queued = id; return true; }   // buffer input
    }
    this.commitOffset();
    this.clip = clip; this.clipT = 0; this.clipW = this.clipW || 0; this.firedUpTo = -1; this.queued = null;
    this.trail.length = 0;
    return true;
  }
  attack() {
    const atk = this.set.attacks;
    if (!this.clip) {
      this.combo = this.comboTimer > 0 ? (this.combo + 1) % atk.length : 0;
      return this.play(atk[this.combo]);
    }
    if (!atk.includes(this.clip.id)) return false;      // busy with a skill / emote
    if (this.queued) { this.bufferNext = true; return true; }   // remember one more press
    this.combo = (this.combo + 1) % atk.length;
    return this.play(atk[this.combo]);
  }
  commitOffset() {
    if (this.clip && this.clip.commit !== false && this.lastX) this.x += this.lastX * this.facing;
    this.lastX = 0;
  }

  update(dt, scene, input) {
    this.time += dt;
    const P = this.prm;
    // --- movement intent ---
    let want = 0, wantZ = 0;
    const locked = this.clip && this.clip.lock !== false;
    if (input && !locked) {
      if (input.left) want -= 1;
      if (input.right) want += 1;
      if (input.up) wantZ -= 1;
      if (input.down) wantZ += 1;
    }
    if (!want && !locked && this.autoMove) want = this.facing;
    const run = input && input.run || this.autoMove === 2;
    const maxSp = run ? P.runSpeed : P.walkSpeed;
    if (want) this.facing = Math.sign(want);
    const tvx = want * maxSp, tvz = wantZ * maxSp * 0.5;
    const acc = 1 - Math.exp(-dt * (locked ? 14 : 10));
    this.vx += (tvx - this.vx) * acc;
    this.vz += (tvz - this.vz) * acc;
    this.x += this.vx * dt;
    this.z = PR.clamp(this.z + this.vz * dt, -24, 24);
    // jump
    if (input && input.jump && this.h <= 0 && !locked) { this.vh = 150; input.jump = false; }
    if (this.h > 0 || this.vh > 0) {
      this.vh -= 520 * dt; this.h += this.vh * dt;
      if (this.h <= 0) { this.h = 0; this.vh = 0; scene && scene.fx.spawn('dust', { x: this.x, z: this.z, n: 8, spread: 10 }); }
    }
    // --- locomotion phase ---
    this.speed = Math.abs(this.vx) + Math.abs(this.vz) * 0.6;
    const prevPhase = this.phase;
    this.phase += dt * (this.speed / P.stride) * Math.PI;
    // footstep events (each half cycle)
    const step = Math.floor(this.phase / Math.PI), prevStep = Math.floor(prevPhase / Math.PI);
    if (step !== prevStep && this.speed > P.walkSpeed * 1.2 && this.h <= 0 && scene) {
      scene.fx.spawn('dust', { x: this.x - this.facing * 2, z: this.z, n: 3, spread: 4, dir: -this.facing });
    }
    this.stats.contact = [Math.cos(this.phase) < 0.2, Math.cos(this.phase) > -0.2];
    // --- base pose ---
    let pose = PR.locoPose(this.phase, this.speed, this.time, P);
    if (this.h > 0) { // airborne tuck
      pose.thighF = -40; pose.shinF = 50; pose.thighB = 10; pose.shinB = 60; pose.footF = -10; pose.footB = -30;
      pose.armF = Math.min(pose.armF, -30); pose.armB = 30;
    }
    // weapon stance on top of idle/walk
    const st = this.set.stance, sw = 1 - PR.clamp((this.speed - P.walkSpeed) / P.walkSpeed, 0, 1) * 0.6;
    for (const k in st) pose[k] = PR.lerp(pose[k] ?? 0, st[k] + (k === 'armF' || k === 'armB' ? (pose[k] - (k === 'armF' ? 6 : -4)) * 0.25 : 0), sw);
    // --- clip ---
    if (this.clip) {
      const c = this.clip;
      const prevT = this.clipT;
      this.clipT += dt * (c.speed || 1);
      const bi = c.blendIn ?? 0.06, bo = c.blendOut ?? 0.12;
      let w = PR.clamp(this.clipT / bi, 0, 1);
      if (!c.loop && !c.hold && !this.queued) w = Math.min(w, PR.clamp((c.dur - this.clipT) / bo, 0, 1));
      if (this.clipW > w && this.clipT < bi) w = this.clipW;    // chained clips: no dip
      this.clipW = w;
      const cp = PR.sampleClip(c, Math.min(this.clipT, c.dur), pose);
      for (const ch in cp) pose[ch] = PR.ADDITIVE.has(ch) ? cp[ch] : PR.lerp(pose[ch] ?? 0, cp[ch], w);
      this.lastX = cp.x || 0;
      if (scene) this.fireEvents(c, prevT, this.clipT, scene);
      const tr = c.trail;
      this.trailOn = tr && this.clipT >= tr[0] && this.clipT <= tr[1];
      if (this.clipT >= c.dur) {
        if (this.queued) {
          const q = this.queued; this.queued = null; this.play(q, { force: true });
          if (this.bufferNext) {
            this.bufferNext = false;
            const atk = this.set.attacks;
            if (atk.includes(q)) { this.combo = (this.combo + 1) % atk.length; this.queued = atk[this.combo]; }
          }
        }
        else if (c.loop) { this.firedUpTo = -1; this.clipT = 0; }
        else if (c.hold) {   // stay in the last pose until the player moves or does something else
          this.clipT = c.dur;
          if (input && (input.left || input.right || input.up || input.down || input.jump)) { this.commitOffset(); this.clip = null; }
        }
        else { this.commitOffset(); this.clip = null; this.comboTimer = 0.35; this.trailOn = false; }
      }
    } else {
      this.clipW = 0; this.trailOn = false;
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.applyPose(pose, dt, [this.vx * this.facing, -this.vh]);
    this.recordTrail(dt);
  }
  applyPose(pose, dt, vel) {
    this.pose = pose;
    this.rig.updateSecondary(dt, vel || [0, 0], this.time);
    this.rig.solve(pose);
  }
  fireEvents(c, t0, t1, scene) {
    for (let i = 0; i < (c.events || []).length; i++) {
      const e = c.events[i];
      if (e.t > t0 && e.t <= t1 || (t0 === 0 && e.t === 0 && this.firedUpTo < i)) {
        this.firedUpTo = i;
        scene.handleEvent(this, e);
      }
    }
  }
  // character space -> world. World: x, y = screen-ish height (ground at 0, up negative), z depth
  toWorld(p) { return { x: this.x + p[0] * this.facing * (this.pose.sx ?? 1), y: p[1] - this.h, z: this.z }; }
  recordTrail(dt) {
    for (const s of this.trail) s.age += dt;
    while (this.trail.length && this.trail[0].age > PR.CFG.fx.trailLife) this.trail.shift();
    if (this.trailOn && PR.CFG.fx.trail) {
      const w = this.rig.weapon;
      const a = this.toWorld(this.rig.weaponPoint(w.tip)), b = this.toWorld(this.rig.weaponPoint(w.base));
      this.trail.push({ a, b, age: 0 });
    }
  }
};

// clip registry (built-ins from data/moves.js + user clips)
PR.CLIPS = PR.CLIPS || {};
PR.USER_CLIPS = PR.USER_CLIPS || {};
PR.getClip = (id) => PR.USER_CLIPS[id] || PR.CLIPS[id];
PR.registerClips = (list) => { for (const c of list) PR.CLIPS[c.id] = c; };
