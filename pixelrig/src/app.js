'use strict';
// App shell: state, main loop, keyboard, play-mode panel, bone overlay.
(() => {
  const U = PR.ui;
  const savedCfg = U.store.get('char', null);
  const cfg = Object.assign(PR.clone(PR.DEFAULT_CHAR), savedCfg || {});
  cfg.equip = Object.assign({}, PR.DEFAULT_CHAR.equip, cfg.equip || {});
  const app = (PR.app = {
    mode: 'play',
    view: Object.assign({ mode: 'pixel', ps: 3, zoom: 2, W: 960, H: 540 }, U.store.get('view', {})),
    cfg, input: {}, timeScale: 1, highlight: null, showBones: false, loopMove: false, lastMove: null,
  });
  app.view.W = 960; app.view.H = 540;
  Object.assign(PR.USER_CLIPS, U.store.get('clips', {}));
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const panel = document.getElementById('panel');
  app.canvas = canvas; app.panel = panel;
  app.scene = new PR.Scene(cfg);
  const ch = () => app.scene.ch;
  app.saveCfg = () => U.store.set('char', app.cfg);
  app.applyCfg = () => { ch().rig.setConfig(app.cfg); Object.assign(ch().prm, PR.MOTION, app.cfg.motion || {}); app.saveCfg(); };
  app.saveClips = () => U.store.set('clips', PR.USER_CLIPS);

  // ---------- header controls ----------
  const setTabs = (id, attr, val) => document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === val));
  document.getElementById('modeTabs').addEventListener('click', (e) => { if (e.target.dataset.mode) app.setMode(e.target.dataset.mode); });
  document.getElementById('renderTabs').addEventListener('click', (e) => {
    if (!e.target.dataset.r) return;
    app.view.mode = e.target.dataset.r; setTabs('renderTabs', 'r', app.view.mode); U.store.set('view', app.view);
  });
  setTabs('renderTabs', 'r', app.view.mode);
  const px = document.getElementById('pxSize'); px.value = app.view.ps;
  px.onchange = () => { app.view.ps = +px.value; U.store.set('view', app.view); };
  const zoom = document.getElementById('zoom'); zoom.value = app.view.zoom;
  zoom.oninput = () => { app.view.zoom = +zoom.value; U.store.set('view', app.view); };
  document.getElementById('showBones').onchange = (e) => { app.showBones = e.target.checked; };

  // ---------- bone group chips ----------
  const chips = document.getElementById('chips');
  for (const g of PR.BONE_GROUPS) {
    const c = U.el('span', { class: 'chip', onmouseenter: () => (app.highlight = new Set(g.bones)), onmouseleave: () => (app.highlight = null),
      onclick: () => app.mode === 'edit' && PR.editor.selectBone(g.bones[0]) }, [U.el('i', { style: 'background:' + g.color }), g.name]);
    chips.append(c);
  }

  // ---------- keyboard ----------
  const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
  const keymap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'run', ShiftRight: 'run' };
  addEventListener('keydown', (e) => {
    if (typing() || app.mode === 'export') return;
    if (keymap[e.code]) { app.input[keymap[e.code]] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); }
    if ((app.mode !== 'play' && app.mode !== 'config') || e.repeat) return;
    if (e.code === 'Space') { app.input.jump = true; e.preventDefault(); }
    if (e.code === 'KeyJ') { ch().attack(); app.lastMove = null; }
    if (e.code === 'KeyK') app.playMove(ch().set.skills[0]);
    if (e.code === 'KeyL') app.playMove(ch().set.skills[1]);
  });
  addEventListener('keyup', (e) => { if (keymap[e.code]) app.input[keymap[e.code]] = false; });
  addEventListener('blur', () => { app.input = {}; });

  app.playMove = (id) => { if (!id) return; ch().play(id, { force: true }); app.lastMove = id; };

  // ---------- modes ----------
  app.setMode = (m) => {
    if (app.mode === 'edit' && m !== 'edit') PR.editor.leave();
    app.mode = m;
    setTabs('modeTabs', 'mode', m);
    app.scene.editing = m === 'edit';
    canvas.classList.toggle('edit', m === 'edit');
    document.getElementById('timeline').classList.toggle('hidden', m !== 'edit');
    const paint = m === 'paint';
    document.getElementById('paintArea').classList.toggle('hidden', !paint);
    for (const id of ['chips', 'stats']) document.getElementById(id).classList.toggle('hidden', paint);
    document.querySelector('.stageWrap').classList.toggle('hidden', paint);
    document.getElementById('hint').classList.toggle('hidden', m !== 'play' && m !== 'config');
    panel.innerHTML = '';
    if (m === 'play') app.buildPlayPanel();
    if (m === 'edit') PR.editor.enter(panel);
    if (m === 'export') PR.exporter.buildPanel(panel);
    if (m === 'config') PR.configUI.buildPanel(panel);
    if (m === 'paint') PR.paintUI.enter(panel);
  };

  // ---------- play panel ----------
  app.buildPlayPanel = () => {
    panel.innerHTML = '';
    const c = app.cfg, rig = ch().rig;
    // character
    const colorKeys = [['skin', 'ผิว'], ['hair', 'ผม'], ['eye', 'ตา'], ['top', 'เสื้อ'], ['pants', 'กางเกง'], ['cape', 'ผ้าคลุม']];
    const colorBox = U.el('div', { class: 'colors' });
    const fillColors = () => {
      colorBox.innerHTML = '';
      for (const [k, name] of colorKeys) {
        const inp = U.el('input', { type: 'color', value: PR.resolveColor(k, ch().rig.pal), oninput: () => { c.colors[k] = inp.value; app.applyCfg(); } });
        colorBox.append(U.el('div', {}, [U.el('label', { text: name }), inp]));
      }
    };
    fillColors();
    const equipRows = PR.EQUIP_SLOTS.map(([slot, label]) =>
      U.row(label, U.select(PR.EQUIP[slot].map((i) => [i.id, i.name]), c.equip[slot], (v) => { c.equip[slot] = v; app.applyCfg(); fillColors(); })));
    const presets = Object.entries(PR.CHARACTER_PRESETS || {});
    panel.append(U.card('ตัวละคร (สวมใส่ทีละชิ้นได้)', [
      presets.length ? U.row('ตัวละครสำเร็จรูป', U.select([['', '— เลือก —'], ...presets.map(([id, p]) => [id, p.name])], '', (v) => { if (v) { PR.config.loadPreset(v); app.buildPlayPanel(); } })) : null,
      U.row('ทรงผม', U.select(Object.entries(PR.HAIR).map(([k, h]) => [k, h.name]), c.hair, (v) => { c.hair = v; app.applyCfg(); })),
      ...equipRows,
      U.el('h4', { text: 'สี' }), colorBox,
      U.el('div', { class: 'btns', style: 'margin-top:10px' }, [
        U.button('สุ่มชุด', () => {
          for (const [slot] of PR.EQUIP_SLOTS) c.equip[slot] = PR.pick(PR.EQUIP[slot]).id;
          c.hair = PR.pick(Object.keys(PR.HAIR)); app.applyCfg(); app.buildPlayPanel();
        }),
        U.button('รีเซ็ตสี', () => { c.colors = {}; app.applyCfg(); fillColors(); }),
      ]),
    ]));
    // motion
    const P = ch().prm;
    const autoBtns = U.el('div', { class: 'btns' });
    const mkAuto = () => {
      autoBtns.innerHTML = '';
      [['ยืน', 0], ['เดิน', 1], ['วิ่ง', 2]].forEach(([l, v]) => autoBtns.append(U.button(l, () => { ch().autoMove = v; mkAuto(); }, ch().autoMove === v ? 'on' : '')));
    };
    mkAuto();
    panel.append(U.card('การเคลื่อนไหว', [
      autoBtns,
      U.row('ความเร็วเดิน', U.range(15, 70, 1, P.walkSpeed, (v) => (P.walkSpeed = v), (v) => v + ' u/s')),
      U.row('ความเร็ววิ่ง', U.range(50, 160, 1, P.runSpeed, (v) => (P.runSpeed = v), (v) => v + ' u/s')),
      U.row('ช่วงก้าว', U.range(14, 40, 1, P.stride, (v) => (P.stride = v))),
      U.row('สะโพกส่าย', U.range(0, 2.5, 0.1, P.sway, (v) => (P.sway = v))),
      U.row('มือเอื่อยตาม', U.range(0, 1.2, 0.05, P.handLag, (v) => (P.handLag = v))),
      U.row('ความเร็วเวลา', U.range(0.1, 1.5, 0.05, app.timeScale, (v) => (app.timeScale = v), (v) => '×' + v.toFixed(2))),
    ]));
    // weapon
    const groups = {};
    for (const [id, w] of Object.entries(PR.WEAPONS)) (groups[w.set] = groups[w.set] || []).push([id, w.name]);
    const wOpts = Object.entries(groups).map(([set, items]) => ({ group: PR.SETS[set].name, items }));
    panel.append(U.card('อาวุธ', [
      U.row('อาวุธ', U.select(wOpts, c.weapon, (v) => { c.weapon = v; app.applyCfg(); app.buildPlayPanel(); })),
      U.row('มือรอง', U.select(Object.entries(PR.OFFHANDS).map(([k, o]) => [k, o.name]), c.offhand, (v) => { c.offhand = v; app.applyCfg(); })),
      U.row('ธาตุ', U.select(Object.entries(PR.ELEMENTS).map(([k, o]) => [k, o.name]), c.element, (v) => { c.element = v; app.applyCfg(); })),
      U.row('ขนาดอาวุธ', U.range(0.6, 1.6, 0.05, c.wscale, (v) => { c.wscale = v; app.saveCfg(); }, (v) => '×' + v.toFixed(2))),
      U.row('ตีบวก', U.range(0, 15, 1, c.refine, (v) => { c.refine = v; app.saveCfg(); }, (v) => (v ? '+' + v : 'ไม่ตีบวก'))),
    ]));
    // moves
    const set = ch().set;
    const mvBtn = (id, key) => { const cl = PR.getClip(id); return cl ? U.button([cl.name, key ? U.el('kbd', { text: key }) : null], () => app.playMove(id)) : null; };
    const mine = [...Object.values(PR.CLIPS).filter((c2) => c2.group === 'mine' && (!c2.set || c2.set === set.name || c2.set === rig.weapon.set)), ...Object.values(PR.USER_CLIPS)];
    const loopChk = U.el('input', { type: 'checkbox', checked: app.loopMove, onchange: (e) => (app.loopMove = e.target.checked) });
    const dumChk = U.el('input', { type: 'checkbox', checked: app.scene.showDummy, onchange: (e) => (app.scene.showDummy = e.target.checked) });
    panel.append(U.card('ท่าโจมตี — ' + set.name, [
      U.el('h4', { text: 'คอมโบ (กด J ต่อเนื่อง)' }),
      U.el('div', { class: 'btns' }, [...new Set(set.attacks)].map((id, i) => mvBtn(id, i === 0 ? 'J' : null))),
      U.el('h4', { text: 'สกิล' }),
      U.el('div', { class: 'btns' }, set.skills.map((id, i) => mvBtn(id, ['K', 'L'][i]))),
      U.el('h4', { text: 'ท่าทั่วไป' }),
      U.el('div', { class: 'btns' }, PR.COMMON_MOVES.map((id) => mvBtn(id))),
      mine.length ? U.el('h4', { text: 'ท่าของฉัน' }) : null,
      mine.length ? U.el('div', { class: 'btns' }, mine.map((cl) => U.button(cl.name, () => app.playMove(cl.id)))) : null,
      U.el('div', { class: 'btns', style: 'margin-top:10px' }, [
        U.el('label', {}, [loopChk, ' เล่นท่าวนซ้ำ']), U.el('label', {}, [dumChk, ' หุ่นซ้อม']),
        U.button('รีเซ็ตตำแหน่ง', () => { ch().x = 0; ch().z = 0; app.scene.dummy.x = 32; app.scene.dummy.z = 0; app.scene.dummy.hp = app.scene.dummy.max; }),
      ]),
    ]));
    // fx test
    const fxAt = (type, extra = {}) => () => {
      const d = app.scene.dummy, cr = ch(), ramp = cr.rig.element.ramp;
      const base = { x: d.x, y: -18, z: d.z, ramp, owner: cr, dir: cr.facing, facing: cr.facing };
      app.scene.fx.spawn(type, Object.assign(base, extra));
    };
    panel.append(U.card('ทดสอบเอฟเฟกต์ (ที่หุ่นซ้อม)', [U.el('div', { class: 'btns' }, [
      U.button('ฟันโค้ง', fxAt('slash', { r: 18, thick: 6 })), U.button('ประกาย', fxAt('spark', { n: 14 })), U.button('แฟลช', fxAt('flash')),
      U.button('ระเบิด', fxAt('burst', { r: 16 })), U.button('คลื่นพื้น', fxAt('ring', { y: 0, r: 34 })), U.button('เศษหิน', fxAt('debris', { y: 0, n: 10 })),
      U.button('สายฟ้า', fxAt('lightning', { y: 0 })), U.button('อุกกาบาต', fxAt('meteor', { y: 0 })), U.button('วงเวท', fxAt('circle', { y: 0, r: 20 })),
      U.button('เสาแสง', fxAt('pillar', { y: 0 })), U.button('ฝนธนู', fxAt('rain', { y: 0 })),
      U.button('ออร่า (ตัวละคร)', () => app.scene.fx.spawn('aura', { owner: ch(), life: 1.2, ramp: ch().rig.element.ramp })),
      U.button('เงาติดตาม', () => app.scene.fx.spawn('afterimage', { owner: ch(), life: 0.5, ramp: ch().rig.element.ramp })),
    ])]));
  };

  // ---------- bone overlay ----------
  app.boneScreen = () => {   // bone joints/tips in display pixels
    const sc = app.scene, V = sc.V;
    if (!V) return [];
    const k = app.view.W / V.bw;
    const Rm = sc.charMatrix(V, ch());
    const out = [];
    for (const b of ch().rig.bones) {
      if (!b.p) continue;
      const m = ch().rig.mats[b.n];
      if (!m) continue;
      if ((b.n.startsWith('cape') && !ch().rig.shapes[b.n]) || (b.n.startsWith('hair') && !ch().rig.shapes[b.n])) continue;
      const W = PR.M.mul(Rm, m);
      const j = PR.M.apply(W, 0, 0), t = PR.M.apply(W, b.tip[0], b.tip[1]);
      out.push({ n: b.n, j: [j[0] * k, j[1] * k], t: [t[0] * k, t[1] * k] });
    }
    const w = ch().rig.weapon;
    if (w.shapes.length) {
      const W = PR.M.mul(Rm, ch().rig.mats.weapon);
      const j = PR.M.apply(W, 0, 0), t = PR.M.apply(W, w.tip[0], w.tip[1]);
      out.push({ n: 'weapon', j: [j[0] * k, j[1] * k], t: [t[0] * k, t[1] * k] });
    }
    return out;
  };
  app.drawBones = (sel, hover) => {
    ctx.save();
    for (const b of app.boneScreen()) {
      const g = PR.groupOfBone(b.n);
      const col = g ? g.color : '#ffffff';
      const on = b.n === sel || b.n === hover;
      ctx.strokeStyle = col; ctx.globalAlpha = on ? 1 : 0.75; ctx.lineWidth = on ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(b.j[0], b.j[1]); ctx.lineTo(b.t[0], b.t[1]); ctx.stroke();
      ctx.fillStyle = on ? '#ffffff' : col; ctx.beginPath(); ctx.arc(b.j[0], b.j[1], on ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- loop ----------
  const hud = document.getElementById('hud'), stats = document.getElementById('stats');
  let last = performance.now(), fpsAcc = 0, fpsN = 0, statT = 0, fps = 60;
  const frame = (now) => {
    const raw = Math.min(0.05, (now - last) / 1000); last = now;
    fpsAcc += raw; fpsN++; if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const dt = raw * app.timeScale;
    if (app.mode === 'paint') { PR.paintUI.frame(dt); requestAnimationFrame(frame); return; }
    if (app.mode === 'edit') PR.editor.update(dt);
    else if (app.mode === 'play' || app.mode === 'config') {
      app.scene.update(dt, app.input);
      if (app.loopMove && app.lastMove && !ch().clip) app.playMove(app.lastMove);
    } else app.scene.update(dt, {});
    app.scene.render(ctx, app.view, { highlight: app.highlight, onion: app.mode === 'edit' ? PR.editor.onion() : null });
    if (app.mode === 'edit') PR.editor.drawOverlay(ctx);
    else if (app.showBones) app.drawBones();
    statT -= raw;
    if (statT <= 0) {
      statT = 0.1;
      const c = ch(), sc = app.scene;
      const st = c.speed / c.prm.stride;
      stats.innerHTML = `ความเร็ว <b>${c.speed.toFixed(0)}</b> · ก้าว/วิ <b>${st.toFixed(2)}</b> · เท้าแตะพื้น (หน้า-หลัง) <b>${c.stats.contact.map((v) => (v ? '●' : '○')).join('')}</b>` +
        ` · สะโพกยุบ <b>${(-(c.rig.groundShift || 0) - c.rig.leg).toFixed(1)}</b> · มือเอื่อย <b>${c.prm.handLag.toFixed(2)}</b> · ท่า <b>${c.clip ? c.clip.name : '—'}</b>` +
        (sc.stats.combo > 1 ? ` · คอมโบ <b>${sc.stats.combo}</b>` : '');
      hud.textContent = `${app.view.mode === 'pixel' ? 'Pixel ' + sc.bw + '×' + sc.bh : '2D HD'} · ${fps} fps${app.timeScale !== 1 ? ' · slow ×' + app.timeScale.toFixed(2) : ''}`;
    }
    requestAnimationFrame(frame);
  };
  app.setMode('play');
  requestAnimationFrame(frame);
})();
