'use strict';
// Edit mode: pose bones by dragging (FK, or IK for hands/feet), keyframe timeline, clip JSON, Claude prompt, bone images.
(() => {
  const U = PR.ui;
  const FPS = 30;
  const E = (PR.editor = {
    clip: null, t: 0, playing: false, sel: 'armF', hover: null, key: -1, ik: true, onionOn: true, drag: null, ui: {},
  });
  const app = () => PR.app;
  const ch = () => PR.app.scene.ch;
  const r1 = (v) => Math.round(v * 10) / 10;

  E.basePose = () => {
    const c = ch(), base = PR.locoPose(0, 0, 0, c.prm);
    Object.assign(base, c.set.stance);
    return base;
  };
  E.poseAt = (t) => {
    const base = E.basePose();
    if (!E.clip) return base;
    const cp = PR.sampleClip(E.clip, t, base);
    return Object.assign(base, cp);
  };
  E.isUser = () => E.clip && !!PR.USER_CLIPS[E.clip.id];
  // built-in clips are copied the first time you change them
  E.ensureUser = () => {
    if (E.isUser()) return;
    const c = PR.clone(E.clip);
    delete c._tracks; delete c._ver;
    let id = (c.id.startsWith('my_') ? c.id : 'my_' + c.id), n = 2;
    while (PR.getClip(id)) id = id.replace(/_\d+$/, '') + '_' + n++;
    c.id = id; c.name = c.name + ' (แก้ไข)'; c.group = 'mine'; c.set = c.set || ch().rig.weapon.set;
    PR.USER_CLIPS[id] = c; E.clip = c; app().saveClips();
    U.toast('ทำสำเนาท่าเป็น "' + c.name + '" แล้วแก้ไขต่อได้เลย');
    E.buildPanel();
  };
  E.keyAt = (t, create) => {
    const tol = 0.5 / FPS;
    let i = E.clip.keys.findIndex((k) => Math.abs(k.t - t) <= tol);
    if (i < 0 && create) { E.clip.keys.push({ t: r1(t * 100) / 100 }); E.clip.keys.sort((a, b) => a.t - b.t); i = E.clip.keys.findIndex((k) => Math.abs(k.t - t) <= tol); }
    return i;
  };
  E.setChannel = (name, v) => {
    if (!E.clip) return;
    E.ensureUser();
    const i = E.keyAt(E.t, true);
    E.clip.keys[i][name] = r1(v);
    E.key = i;
    E.changed();
  };
  E.changed = () => { app().saveClips(); E.refreshJson(); E.refreshBone(); };

  E.enter = (panel) => {
    E.panel = panel;
    if (!E.clip) E.clip = PR.getClip(ch().set.attacks[0]);
    ch().clip = null; ch().x = 0; ch().z = 0; ch().h = 0; ch().trail.length = 0;
    app().scene.camX = 0; app().scene.fx.clear();
    E.t = 0; E.playing = false;
    E.buildPanel(); E.buildTimeline(); E.bindStage();
  };
  E.leave = () => { E.playing = false; app().scene.editing = false; ch().clip = null; };
  E.selectBone = (b) => { E.sel = b; E.buildPanel(); };

  // ---------- per-frame ----------
  E.update = (dt) => {
    const sc = app().scene, c = ch();
    if (E.playing) {
      sc.editing = false;
      if (!c.clip) {
        if (E.t > 0 && !E.loop) { E.playing = false; E.t = 0; }
        else { c.x = 0; c.play(E.clip.id, { force: true }); }
      }
      sc.update(dt, {});
      if (c.clip) E.t = c.clipT;
      c.x = 0; sc.camX = 0;
    } else {
      sc.editing = true;
      sc.update(dt, {});
      c.applyPose(E.poseAt(E.t), 0, [0, 0]);
    }
    E.drawTimeline();
    if (E.ui.time) E.ui.time.textContent = E.t.toFixed(2) + ' / ' + (E.clip ? E.clip.dur.toFixed(2) : '0') + ' วิ';
  };
  E.onion = () => {
    if (!E.onionOn || E.playing || !E.clip) return null;
    const keys = E.clip.keys, out = [];
    const prev = [...keys].reverse().find((k) => k.t < E.t - 0.01), next = keys.find((k) => k.t > E.t + 0.01);
    const rig = ch().rig, keep = {};
    for (const k in rig.mats) keep[k] = rig.mats[k];
    for (const [k, color] of [[prev, '#4a90e2'], [next, '#ff4d6d']]) {
      if (!k) continue;
      rig.solve(E.poseAt(k.t));
      const mats = {}; for (const m in rig.mats) mats[m] = rig.mats[m].slice();
      out.push({ mats, color });
    }
    rig.mats = keep;
    return out;
  };
  E.drawOverlay = (ctx) => { app().drawBones(E.sel, E.hover); };

  // ---------- stage interaction ----------
  E.bindStage = () => {
    if (E.bound) return;
    E.bound = true;
    const cv = app().canvas;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
    const pick = (p) => {
      let best = null, bd = 14;
      for (const b of app().boneScreen()) {
        const d = segDist(p, b.j, b.t);
        if (d < bd) { bd = d; best = b.n; }
      }
      return best;
    };
    cv.addEventListener('pointermove', (e) => {
      if (app().mode !== 'edit') return;
      const p = pos(e);
      if (!E.drag) { E.hover = pick(p); return; }
      E.dragTo(p, e.shiftKey);
    });
    cv.addEventListener('pointerdown', (e) => {
      if (app().mode !== 'edit') return;
      const b = pick(pos(e));
      if (!b) return;
      E.playing = false; E.drag = { bone: b };
      cv.setPointerCapture(e.pointerId);
      if (b !== E.sel) { E.sel = b; E.buildPanel(); }
    });
    const end = () => { E.drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  };
  const segDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const u = PR.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1);
    return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
  };
  // display pixels -> character space
  E.toChar = (p) => {
    const sc = app().scene, V = sc.V, k = V.bw / app().view.W;
    return PR.M.apply(PR.M.inv(sc.charMatrix(V, ch())), p[0] * k, p[1] * k);
  };
  E.dragTo = (p, shift) => {
    const b = E.drag.bone, rig = ch().rig, pose = E.poseAt(E.t);
    const q = E.toChar(p);
    if (b === 'pelvis' && shift) {   // move the whole body
      if (!E.drag.start) E.drag.start = { q, x: pose.x || 0, y: pose.y || 0 };
      E.setChannel('x', E.drag.start.x + (q[0] - E.drag.start.q[0]));
      E.setChannel('y', E.drag.start.y + (q[1] - E.drag.start.q[1]));
      return;
    }
    const ikChains = { handF: ['armF', 'foreF', 'torso', rig.fist[1], 1], handB: ['armB', 'foreB', 'torso', rig.fist[1], 1], footF: ['thighF', 'shinF', 'pelvis', 0, -1], footB: ['thighB', 'shinB', 'pelvis', 0, -1] };
    if (E.ik && ikChains[b]) {
      const [up, lo, par, extra, bend] = ikChains[b];
      const [a1, a2] = PR.solveIK(rig.mats[par], rig.boneMap[up].o, rig.len(up), rig.len(lo) + extra, q, bend);
      E.setChannel(up, a1); E.setChannel(lo, a2);
      return;
    }
    const chan = b === 'weapon' ? 'wrot' : b;
    const m = b === 'weapon' ? rig.mats.weapon : rig.mats[b];
    if (!m) return;
    const tip = b === 'weapon' ? rig.weapon.tip : rig.boneMap[b].tip;
    const J = [m[4], m[5]], T = PR.M.apply(m, tip[0], tip[1]);
    const cur = Math.atan2(T[1] - J[1], T[0] - J[0]), want = Math.atan2(q[1] - J[1], q[0] - J[0]);
    const delta = PR.wrapDeg((want - cur) * PR.R2D);
    E.setChannel(chan, (pose[chan] ?? 0) + delta);
  };

  // ---------- timeline ----------
  E.buildTimeline = () => {
    const bar = document.getElementById('tlBar');
    bar.innerHTML = '';
    const ease = U.select(Object.keys(PR.ease).map((k) => [k, k]), 'inout', (v) => { if (E.key >= 0) { E.ensureUser(); E.clip.keys[E.key].ease = v; E.changed(); } });
    const dur = U.el('input', { type: 'number', step: 0.05, min: 0.1, value: E.clip ? E.clip.dur : 0.5, style: 'width:70px', onchange: () => { E.ensureUser(); E.clip.dur = Math.max(0.1, +dur.value); E.changed(); } });
    const chk = (label, get, set) => U.el('label', { style: 'display:flex;gap:4px;align-items:center;font-size:13px;color:var(--mute)' }, [U.el('input', { type: 'checkbox', checked: get(), onchange: (e) => set(e.target.checked) }), label]);
    E.ui.time = U.el('span', { style: 'min-width:90px;color:var(--mute);font-size:13px' });
    E.ui.ease = ease; E.ui.dur = dur;
    bar.append(
      U.button('▶ / ⏸', () => { E.playing = !E.playing; if (E.playing) { ch().clip = null; E.t = 0; } }, 'pri'),
      U.button('⏮', () => { E.playing = false; E.t = 0; }),
      U.button('◀', () => { E.playing = false; E.t = Math.max(0, E.t - 1 / FPS); }),
      U.button('▶', () => { E.playing = false; E.t = Math.min(E.clip.dur, E.t + 1 / FPS); }),
      U.button('+ คีย์ทั้งท่า', () => {
        E.ensureUser();
        const pose = E.poseAt(E.t), i = E.keyAt(E.t, true), chans = new Set();
        for (const k of E.clip.keys) for (const c in k) if (c !== 't' && c !== 'ease') chans.add(c);
        for (const c of chans) E.clip.keys[i][c] = r1(pose[c] ?? 0);
        E.key = i; E.changed();
      }),
      U.button('ลบคีย์', () => { if (E.key < 0) return; E.ensureUser(); E.clip.keys.splice(E.key, 1); E.key = -1; E.changed(); }, 'warn'),
      U.el('span', { style: 'color:var(--mute);font-size:13px' }, 'ease'), ease,
      U.el('span', { style: 'color:var(--mute);font-size:13px' }, 'ยาว'), dur,
      chk('วนเล่น', () => !!E.loop, (v) => (E.loop = v)),
      chk('Onion skin', () => E.onionOn, (v) => (E.onionOn = v)),
      chk('IK มือ/เท้า', () => E.ik, (v) => (E.ik = v)),
      E.ui.time,
    );
    const tl = document.getElementById('tl');
    if (!E.tlBound) {
      E.tlBound = true;
      const tx = (e) => { const r = tl.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * tl.width; };
      const toT = (x) => PR.clamp((x - 20) / (tl.width - 40), 0, 1) * E.clip.dur;
      tl.addEventListener('pointerdown', (e) => {
        if (!E.clip) return;
        E.playing = false;
        const x = tx(e);
        const ki = E.clip.keys.findIndex((k) => Math.abs(20 + (k.t / E.clip.dur) * (tl.width - 40) - x) < 8);
        E.tlDrag = ki >= 0 ? { key: ki } : { scrub: true };
        if (ki >= 0) { E.key = ki; E.t = E.clip.keys[ki].t; E.ui.ease.value = E.clip.keys[ki].ease || 'inout'; }
        else E.t = toT(x);
        tl.setPointerCapture(e.pointerId);
      });
      tl.addEventListener('pointermove', (e) => {
        if (!E.tlDrag) return;
        const t = Math.round(toT(tx(e)) * 100) / 100;
        if (E.tlDrag.scrub) E.t = t;
        else if (E.tlDrag.key != null && t !== E.clip.keys[E.tlDrag.key].t) {
          E.ensureUser();
          const k = E.clip.keys[E.tlDrag.key]; k.t = t; E.t = t;
          E.clip.keys.sort((a, b) => a.t - b.t); E.tlDrag.key = E.key = E.clip.keys.indexOf(k);
          E.changed();
        }
      });
      tl.addEventListener('pointerup', () => (E.tlDrag = null));
    }
  };
  E.drawTimeline = () => {
    const tl = document.getElementById('tl'), g = tl.getContext('2d'), W = tl.width, H = tl.height;
    g.clearRect(0, 0, W, H);
    if (!E.clip) return;
    const d = E.clip.dur, X = (t) => 20 + (t / d) * (W - 40);
    g.fillStyle = '#110c20'; g.fillRect(0, 0, W, H);
    if (E.clip.trail) { g.fillStyle = 'rgba(245,192,74,0.12)'; g.fillRect(X(E.clip.trail[0]), 0, X(E.clip.trail[1]) - X(E.clip.trail[0]), H); }
    g.strokeStyle = '#2c2247'; g.fillStyle = '#6f6690'; g.font = '11px sans-serif';
    for (let t = 0; t <= d + 1e-6; t += 0.05) {
      const x = Math.round(X(t)) + 0.5, major = Math.abs(t * 10 - Math.round(t * 10)) < 1e-6;
      g.beginPath(); g.moveTo(x, major ? 14 : 20); g.lineTo(x, H - 18); g.stroke();
      if (major) g.fillText(t.toFixed(1), x + 2, 11);
    }
    E.clip.keys.forEach((k, i) => {
      const x = X(k.t), y = 38;
      g.fillStyle = i === E.key ? '#f5c04a' : '#b9a8ff';
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 7, y); g.lineTo(x, y + 8); g.lineTo(x - 7, y); g.closePath(); g.fill();
    });
    for (const ev of E.clip.events || []) {
      const x = X(ev.t);
      g.fillStyle = ev.hit ? '#ff5a6e' : ev.fx ? '#4fd0ff' : '#9a90b5';
      g.beginPath(); g.moveTo(x, H - 16); g.lineTo(x + 5, H - 6); g.lineTo(x - 5, H - 6); g.closePath(); g.fill();
    }
    g.fillStyle = '#6f6690'; g.fillText('◆ คีย์เฟรม   ▲ แดง = โดนตี  ▲ ฟ้า = เอฟเฟกต์   แถบเหลือง = ร่องรอยอาวุธ', W - 420, H - 4);
    const px = Math.round(X(Math.min(E.t, d))) + 0.5;
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); g.lineWidth = 1;
  };

  // ---------- panel ----------
  E.buildPanel = () => {
    const panel = E.panel;
    if (!panel || app().mode !== 'edit') return;
    panel.innerHTML = '';
    const set = ch().set;
    const opts = [
      { group: 'ท่าของฉัน', items: [...Object.values(PR.USER_CLIPS), ...Object.values(PR.CLIPS).filter((c) => c.group === 'mine')].map((c) => [c.id, c.name]) },
      { group: 'อาวุธ: ' + set.name, items: [...new Set([...set.attacks, ...set.skills])].map((id) => [id, PR.getClip(id).name]) },
      { group: 'ท่าทั่วไป', items: PR.COMMON_MOVES.map((id) => [id, PR.getClip(id).name]) },
      { group: 'อาวุธอื่น', items: Object.values(PR.CLIPS).filter((c) => c.group !== 'mine' && c.group !== 'common' && !set.attacks.includes(c.id) && !set.skills.includes(c.id)).map((c) => [c.id, c.name + ' · ' + c.id.split('_')[0]]) },
    ].filter((o) => o.items.length);
    const pickClip = (id) => { E.clip = PR.getClip(id); E.t = 0; E.key = -1; E.playing = false; E.buildPanel(); E.buildTimeline(); };
    const nameIn = U.el('input', { type: 'text', value: E.clip.name, onchange: () => { E.ensureUser(); E.clip.name = nameIn.value; E.changed(); } });
    panel.append(U.card('ท่าที่กำลังแก้', [
      U.row('ท่า', U.select(opts, E.clip.id, pickClip)),
      U.row('ชื่อ', nameIn),
      U.el('div', { class: 'note', text: E.isUser() ? 'ท่าของคุณ · บันทึกในเบราว์เซอร์อัตโนมัติ' : 'ท่าในตัว · แก้เมื่อไรจะทำสำเนาให้อัตโนมัติ' }),
      U.el('div', { class: 'btns' }, [
        U.button('ท่าใหม่', () => {
          let n = 1; while (PR.getClip('my_move_' + n)) n++;
          const c = { id: 'my_move_' + n, name: 'ท่าใหม่ ' + n, group: 'mine', set: ch().rig.weapon.set, dur: 0.6, trail: [0.1, 0.3], keys: [{ t: 0 }], events: [] };
          PR.USER_CLIPS[c.id] = c; app().saveClips(); pickClip(c.id);
        }),
        U.button('ทำสำเนา', () => {
          const c = PR.clone(E.clip); delete c._tracks; delete c._ver;
          let id = 'my_' + c.id.replace(/^my_/, '') + '_copy', n = 2;
          while (PR.getClip(id)) id = id.replace(/_\d+$/, '') + '_' + n++;
          Object.assign(c, { id, name: c.name + ' (สำเนา)', group: 'mine', set: c.set || ch().rig.weapon.set });
          PR.USER_CLIPS[id] = c; app().saveClips(); pickClip(id);
        }),
        E.isUser() ? U.button('ลบท่านี้', () => { if (!confirm('ลบท่า "' + E.clip.name + '" ?')) return; delete PR.USER_CLIPS[E.clip.id]; app().saveClips(); pickClip(set.attacks[0]); }, 'warn') : null,
      ]),
    ]));
    // bone card
    E.ui.boneCard = U.card('กระดูก / ค่าที่เฟรมนี้', []);
    E.ui.sliderFor = null;
    panel.append(E.ui.boneCard);
    E.refreshBone();
    // JSON
    E.ui.json = U.el('textarea', { rows: 12, spellcheck: 'false' });
    panel.append(U.card('JSON ของท่า (Claude เขียน/แก้ได้)', [
      E.ui.json,
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('ใช้ JSON นี้', () => E.applyJson(E.ui.json.value), 'pri'),
        U.button('คัดลอก', async () => U.toast((await U.copy(E.ui.json.value)) ? 'คัดลอกแล้ว' : 'คัดลอกไม่ได้')),
        U.button('ดาวน์โหลด .json', () => U.download(new Blob([E.ui.json.value], { type: 'application/json' }), E.clip.id + '.json')),
        U.el('label', { class: 'btn' }, ['นำเข้าไฟล์', U.el('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async (e) => { const f = e.target.files[0]; if (f) E.applyJson(await f.text()); } })]),
      ]),
    ]));
    E.refreshJson(true);
    // Claude prompt
    const want = U.el('textarea', { rows: 3, placeholder: 'เช่น: ฟันหมุนตัว 3 รอบ ไฟลุก แล้วกระโดดฟันลงพื้นให้พื้นแตก' });
    panel.append(U.card('ให้ Claude ช่วยสร้างท่า', [
      U.el('div', { class: 'note', text: 'พิมพ์ท่าที่อยากได้ กดคัดลอก แล้ววางในแชท Claude จากนั้นนำ JSON ที่ได้มาวางในกล่องด้านบนแล้วกด "ใช้ JSON นี้" (หรือสั่ง Claude Code ในโฟลเดอร์นี้ให้เพิ่มท่าลง src/data/my_moves.js ได้เลย)' }),
      want,
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [U.button('คัดลอก Prompt สำหรับ Claude', async () => U.toast((await U.copy(E.claudePrompt(want.value))) ? 'คัดลอก prompt แล้ว ไปวางใน Claude ได้เลย' : 'คัดลอกไม่ได้'), 'pri')]),
    ]));
    // bone images
    panel.append(E.imageCard());
  };
  E.refreshBone = () => {
    const card = E.ui.boneCard;
    if (!card || !E.clip) return;
    const pose = E.poseAt(E.t);
    const chan = E.sel === 'weapon' ? 'wrot' : E.sel;
    if (E.ui.sliderFor === E.sel && E.ui.sliders && card.isConnected) {   // just update values (keeps a slider usable while dragging)
      for (const [name, s] of Object.entries(E.ui.sliders)) s.set(r1(pose[name] ?? PR.CHANNEL_DEFAULTS[name] ?? 0));
      return;
    }
    E.ui.sliderFor = E.sel; E.ui.sliders = {};
    const kids = [U.el('h3', { text: 'กระดูก / ค่าที่เฟรมนี้' })];
    const boneBtns = U.el('div', { class: 'btns' }, [...PR.POSE_BONES.filter((b) => !/cape|hair/.test(b)), 'weapon'].map((b) =>
      U.button(b, () => E.selectBone(b), b === E.sel ? 'on' : '')));
    kids.push(boneBtns);
    const slider = (name, min, max, step) => {
      const r = U.range(min, max, step, r1(pose[name] ?? PR.CHANNEL_DEFAULTS[name] ?? 0), (v) => E.setChannel(name, v), (v) => (+v).toFixed(1));
      E.ui.sliders[name] = r;
      const row = U.row(name, r);
      if (PR.EXTRA_CHANNELS[name]) row.title = PR.EXTRA_CHANNELS[name];
      return row;
    };
    kids.push(U.el('h4', { text: 'หมุน ' + chan + ' (องศา)' }), slider(chan, -240, 240, 0.5));
    kids.push(U.el('h4', { text: 'ทั้งตัว' }), slider('x', -60, 80, 0.5), slider('y', -60, 20, 0.5), slider('lean', -180, 180, 0.5), slider('sx', -1, 1, 0.05));
    kids.push(U.el('div', { class: 'note', text: 'ลากกระดูกบนเวทีเพื่อหมุน · ลากมือ/เท้า = IK · Shift + ลากสะโพก = ย้ายทั้งตัว · ค่าจะบันทึกเป็นคีย์ที่เวลาปัจจุบัน' }));
    card.replaceChildren(...kids);
  };
  E.refreshJson = (force) => {
    const ta = E.ui.json;
    if (!ta || (!force && document.activeElement === ta)) return;
    ta.value = E.clipToJson(E.clip);
    if (E.ui.dur) E.ui.dur.value = E.clip.dur;
  };
  E.clipToJson = (c) => {
    const clean = PR.clone(c); delete clean._tracks; delete clean._ver;
    // one key / event per line keeps it readable for people and for Claude
    const head = Object.assign({}, clean); delete head.keys; delete head.events;
    const lines = JSON.stringify(head, null, 1).replace(/\n\s*/g, ' ').replace(/ }$/, '');
    return lines + ',\n "keys": [\n' + clean.keys.map((k) => '  ' + JSON.stringify(k)).join(',\n') + '\n ],\n "events": [\n' + (clean.events || []).map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n ]\n}';
  };
  E.applyJson = (txt) => {
    let c;
    try { const m = txt.match(/\{[\s\S]*\}/); c = JSON.parse(m ? m[0] : txt); } catch (e) { U.toast('JSON ไม่ถูกต้อง: ' + e.message, 3000); return; }
    if (!c.keys || !Array.isArray(c.keys) || !c.dur) { U.toast('ต้องมี dur และ keys', 3000); return; }
    c.id = String(c.id || 'my_move').replace(/[^\w]/g, '_');
    if (PR.CLIPS[c.id] && !PR.USER_CLIPS[c.id]) c.id = 'my_' + c.id;
    c.group = 'mine'; c.events = c.events || [];
    PR.USER_CLIPS[c.id] = c; app().saveClips();
    E.clip = c; E.t = 0; E.key = -1;
    E.buildPanel(); E.buildTimeline();
    U.toast('ใช้ท่า "' + (c.name || c.id) + '" แล้ว กด ▶ เพื่อดู');
  };

  E.imageCard = () => {
    const cfg = app().cfg;
    const bone = E.sel === 'weapon' ? 'weapon' : E.sel;
    const img = cfg.images[bone] || {};
    const save = () => { cfg.images[bone] = img; app().applyCfg(); };
    const kids = [U.el('div', { class: 'note', text: `ใส่รูป PNG ของคุณเองบนกระดูก "${bone}" (ตัดตัวละครเป็นชิ้น: หัว ลำตัว แขนท่อนบน/ล่าง มือ ขา เท้า อาวุธ) แล้วจัดตำแหน่ง` })];
    kids.push(U.el('label', { class: 'btn' }, ['เลือกรูป PNG', U.el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { Object.assign(img, { src: rd.result, x: img.x ?? -4, y: img.y ?? -2, s: img.s ?? 0.25, r: img.r ?? 0 }); save(); E.buildPanel(); };
      rd.readAsDataURL(f);
    } })]));
    if (img.src) {
      const rng = (k, min, max, step) => U.row(k, U.range(min, max, step, img[k] ?? 0, (v) => { img[k] = v; save(); }, (v) => (+v).toFixed(2)));
      kids.push(rng('x', -30, 30, 0.25), rng('y', -30, 30, 0.25), rng('s', 0.02, 2, 0.01), rng('r', -180, 180, 1));
      kids.push(U.el('label', {}, [U.el('input', { type: 'checkbox', checked: !!img.hide, onchange: (e) => { img.hide = e.target.checked; save(); } }), ' ซ่อนรูปทรงเดิมของส่วนนี้']));
      kids.push(U.button('ลบรูป', () => { delete cfg.images[bone]; app().applyCfg(); E.buildPanel(); }, 'warn'));
    }
    return U.card('รูปภาพบนกระดูก (rig ภาพของคุณเอง)', kids);
  };

  E.claudePrompt = (want) => {
    const c = ch(), w = c.rig.weapon, set = w.set;
    const base = E.basePose();
    const ex = PR.getClip(c.set.attacks[0]);
    const b = {}; for (const k in base) b[k] = r1(base[k]);
    return `You are helping me author a 2D attack animation clip for my tool "PixelRig Studio". Reply with ONLY one JSON object (no prose).

Move I want: ${want || '(describe the move here)'}
Weapon: ${w.name} (move set "${set}"), element: ${c.rig.cfg.element}

## Clip format
{ "id": "my_<snake_case>", "name": "<short name>", "group": "mine", "set": "${set}", "dur": <seconds>, "loop": false, "hold": false,
  "trail": [t0, t1],  // window (s) where the weapon swing trail is drawn
  "keys": [ { "t": 0, "ease": "inout", "<channel>": <value>, ... }, ... ],
  "events": [ ... ] }
Every channel is its own track built from the keys that mention it. Channels you never mention keep the base pose.

## Channels (degrees unless noted). Character faces RIGHT (+x forward), y points DOWN.
Bones: pelvis, torso, head (positive = lean / nod forward)
  armF, foreF, handF = weapon arm (near side); armB, foreB, handB = off-hand arm (far side)
  thighF, shinF, footF, thighB, shinB, footB
  Limbs hang straight down at 0. NEGATIVE = swing forward: armF -90 points forward, -180 straight up through the front, +90 backward.
  foreF/foreB negative = bend the elbow. shinF/shinB positive = bend the knee. Feet: negative = toes up.
Extra: x (forward offset in units, kept when the move ends), y (negative = up, jumps), lean (whole body),
  wrot (weapon spin inside the hand), wsc (weapon scale), sx (1 -> -1 -> 1 fakes a turn; use for spins), ik2 (0-1, off hand on the grip of two-handed weapons)
Weapon screen direction ~= armF + foreF + wrot + torso: 0 forward, -90 up, 90 down, +-180 back.
Angles are NOT wrapped: going from -200 to 40 sweeps over the head through the front; pick signs so the arc goes the way you want.
Proportions: legs 7+7, torso 13, arms 7+6, head ~16, total height ~50 units. Feet are auto-planted on the ground.
Base pose (what unmentioned channels use): ${JSON.stringify(b)}

## Easing (applies from the previous key to this key)
linear, in, out, inout, outCubic, outExpo, outBack, inBack, step

## Events
{ "t": s, "fx": "<type>", "at": "body|tip|hand|feet|target", "x": <forward>, "y": <negative = up>, ...params }
  slash {r, a0, a1, thick, life}  crescent; angles in degrees, 0 = forward, + = clockwise/down
  spark {n, power}  flash {size}  burst {r, sparks}  ring {r, flat}  debris {n}  dust {n, spread, dir}  lines {n, len}
  projectile {kind: "orb"|"arrow"|"shard", speed, vy, range, boom, hit:{...}}  lightning {}  circle {r, life}
  pillar {w, h, life}  aura {life, rate}  meteor {life, hit:{...}}  rain {n, spread, life}
{ "t": s, "hit": { "range": [x0, x1] or "area": radius, "dmg": [min, max], "knock": n, "launch": n, "stop": hitstop_seconds, "shake": n } }
{ "t": s, "afterimage": true }   { "t": s, "shake": n }
Any event may add "el": "none|fire|ice|thunder|poison|holy|shadow" to recolor it.

## What makes it look good
Anticipation (wind up opposite to the blow), a fast strike (0.05-0.1 s, outExpo/outCubic), a hit event with a small hitstop on the contact frame,
follow-through, then recover to the base pose by the last key. Step the feet with the blow. Keep elbows slightly bent.

## Example of an existing move
${E.clipToJson(ex)}`;
  };
})();
