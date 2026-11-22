'use strict';
// Pixel editor UI: tool bar, options bar, status bar, colors/palette, layers, file commands,
// and the bridge to the character rig (draw a body part, see it live on the animated character).
(() => {
  const U = PR.ui, P = PR.paint;
  const TOOLS = [
    ['pencil', 'B', '✎', 'ดินสอ'], ['eraser', 'E', '⌫', 'ยางลบ'], ['fill', 'G', '▧', 'ถังเท'], ['line', 'L', '╱', 'เส้นตรง'],
    ['rect', 'R', '▭', 'สี่เหลี่ยม'], ['ellipse', 'O', '◯', 'วงรี'], ['picker', 'I', '⊙', 'ดูดสี (กด Alt ค้างก็ได้)'],
    ['select', 'M', '⬚', 'เลือกพื้นที่'], ['move', 'V', '✥', 'ย้าย'], ['shade', 'S', '◐', 'แรเงาตามพาเลต (ซ้าย=สว่าง ขวา=มืด)'], ['dither', 'D', '▦', 'ดิทเธอร์ (ลายตาราง)'],
  ];
  const PAIRS = { armF: 'armB', foreF: 'foreB', handF: 'handB', thighF: 'thighB', shinF: 'shinB', footF: 'footB' };
  const SLOT_BONE = { weapon: 'weapon', skirt: 'pelvis', offhand: 'handB' };
  const UI = (PR.paintUI = { live: true, backToo: true, R: 2, margin: 6, slot: 'head', built: false, palName: 'basic' });

  // ---------- workspace (left side) ----------
  UI.buildWorkspace = () => {
    if (UI.built) return;
    UI.built = true;
    const tools = document.getElementById('paintTools');
    for (const [id, key, icon, name] of TOOLS) {
      tools.append(U.el('button', { class: 'ptool', 'data-tool': id, title: `${name} (${key})`, onclick: () => UI.setTool(id) }, icon));
    }
    P.attach(document.getElementById('paintCanvas'));
    P.onStatus = (what, p) => { if (what === 'color') UI.refreshColors(); if (what === 'hover') UI.status(p); if (what === 'locked') U.toast('เลเยอร์นี้ถูกล็อกหรือซ่อนอยู่'); };
    P.onChange = () => { UI.refreshLayers(); if (UI.live && P.doc.target) UI.scheduleApply(); };
    UI.buildOptions();
    addEventListener('keydown', UI.keys);
    addEventListener('keyup', (e) => { if (e.code === 'Space') P.spaceDown = false; });
    if (!P.doc) { const ex = PR.app.cfg.images[UI.slot]; UI.openPart(UI.slot, ex && ex.paint ? 'reopen' : 'shape'); }
  };
  UI.buildOptions = () => {
    const bar = document.getElementById('paintOpts');
    bar.innerHTML = '';
    const chk = (label, key, title) => U.el('label', { class: 'popt', title: title || '' }, [U.el('input', { type: 'checkbox', checked: P[key], onchange: (e) => { P[key] = e.target.checked; P.needs = true; } }), label]);
    UI.sizeVal = U.el('span', { style: 'min-width:18px;display:inline-block' }, String(P.size));
    const size = U.el('input', { type: 'range', min: 1, max: 12, value: P.size, style: 'width:80px', oninput: (e) => { P.size = +e.target.value; UI.sizeVal.textContent = P.size; P.needs = true; } });
    UI.sizeInput = size;
    const ref = U.el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: P.refAlpha, style: 'width:60px', oninput: (e) => { P.refAlpha = +e.target.value; P.needs = true; } });
    bar.append(
      U.el('span', { class: 'popt' }, ['หัวแปรง ', size, UI.sizeVal]),
      chk('กลม', 'round', 'หัวแปรงกลม'), chk('Pixel-perfect', 'pixelPerfect', 'ลบมุมหยักของเส้น 1px อัตโนมัติ'),
      chk('ทึบ', 'filled', 'สี่เหลี่ยม/วงรีแบบเติมเต็ม'), chk('ติดกัน', 'contiguous', 'ถังเทเฉพาะพื้นที่ติดกัน (ปิด = เปลี่ยนสีนั้นทั้งภาพ)'),
      chk('สมมาตร ↔', 'mirrorX'), chk('สมมาตร ↕', 'mirrorY'), chk('กริด', 'grid'),
      U.el('span', { class: 'popt' }, [U.el('input', { type: 'checkbox', checked: P.refOn, onchange: (e) => { P.refOn = e.target.checked; P.needs = true; } }), 'ไกด์ ', ref]),
      U.button('−', () => P.zoomAt(-1)), U.button('+', () => P.zoomAt(1)), U.button('พอดีจอ', () => P.fit()),
      U.button('↶', () => P.doUndo()), U.button('↷', () => P.doRedo()),
    );
  };
  UI.setTool = (id) => {
    if (P.tool === 'move' && id !== 'move') P.commitFloat();
    P.tool = id; P.needs = true;
    document.querySelectorAll('#paintTools .ptool').forEach((b) => b.classList.toggle('on', b.dataset.tool === id));
    UI.status();
  };
  UI.status = (p) => {
    const el = document.getElementById('paintStatus'); if (!el || !P.doc) return;
    const h = p || UI.lastHover || {};
    if (p) UI.lastHover = p;
    const c = h.x != null ? P.colorAt(h.x, h.y, true) : null;
    const tool = TOOLS.find((t) => t[0] === P.tool);
    el.textContent = `${tool ? tool[3] : ''} · ${P.doc.w}×${P.doc.h}px · ซูม ${P.zoom}x` + (c ? ` · (${h.x}, ${h.y}) ${c[3] ? P.hex(c) : 'โปร่งใส'}` : '') +
      (P.doc.target ? ` · กำลังวาด: ${P.doc.target.slot} (${P.doc.target.R} px/หน่วย)` : ' · ผ้าใบอิสระ') +
      ' · Space+ลาก = เลื่อนจอ · ล้อเมาส์ = ซูม · คลิกขวา = สีรอง';
  };
  UI.keys = (e) => {
    if (PR.app.mode !== 'paint' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { P.spaceDown = true; e.preventDefault(); return; }
    if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? P.doRedo() : P.doUndo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); P.doRedo(); return; }
    if (ctrl && k === 'c') { P.copy(); return; }
    if (ctrl && k === 'v') { P.paste(); UI.setTool('move'); return; }
    if (ctrl && k === 'a') { e.preventDefault(); P.commitFloat(); P.sel = { x: 0, y: 0, w: P.doc.w, h: P.doc.h }; P.needs = true; return; }
    if (ctrl && k === 'd') { e.preventDefault(); P.commitFloat(); P.sel = null; P.needs = true; return; }
    if (ctrl) return;
    if (k === 'delete' || k === 'backspace') { P.deleteSel(); return; }
    if (k === 'enter' || k === 'escape') { P.commitFloat(); if (k === 'escape') P.sel = null; P.needs = true; return; }
    if (k === 'x') { [P.primary, P.secondary] = [P.secondary, P.primary]; UI.refreshColors(); return; }
    if (k === '[' || k === ']') { P.size = PR.clamp(P.size + (k === ']' ? 1 : -1), 1, 12); UI.sizeInput.value = P.size; UI.sizeVal.textContent = P.size; P.needs = true; return; }
    if (k === '+' || k === '=') { P.zoomAt(1); return; }
    if (k === '-') { P.zoomAt(-1); return; }
    if (k === '0') { P.fit(); return; }
    if (e.key.startsWith('Arrow') && P.float) {   // nudge the floating selection
      e.preventDefault(); P.float.x += e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; P.float.y += e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; P.needs = true; return;
    }
    const t = TOOLS.find((x) => x[1].toLowerCase() === k);
    if (t) UI.setTool(t[0]);
  };

  // ---------- character parts ----------
  UI.slots = () => {
    const rig = PR.app.scene.ch.rig;
    return PR.DRAW_ORDER.filter((s) => s !== 'offhand' && ((s === 'weapon' ? rig.weapon.shapes.length : (rig.shapes[s] || []).length) || (PR.app.cfg.images[s] && PR.app.cfg.images[s].src)));
  };
  UI.template = (slot, R) => {
    const cfg = PR.clone(PR.app.cfg);
    delete cfg.images[slot];
    const part = PR.rigExport.renderParts(cfg, { scale: R, pixel: true }).find((p) => p.name === slot);
    return part || null;
  };
  // open a body part. mode: 'shape' = start from the built-in shape, 'blank' = empty canvas with the shape as a guide,
  // 'reopen' = continue the art drawn earlier for this slot
  UI.openPart = (slot, mode) => {
    const fromShape = mode === 'shape';
    const app = PR.app, R = UI.R, M = UI.margin, rig = app.scene.ch.rig;
    const bone = SLOT_BONE[slot] || slot;
    const tip = slot === 'weapon' ? rig.weapon.tip : (rig.boneMap[bone] || { tip: [0, 0] }).tip;
    const existing = app.cfg.images[slot];
    UI.slot = slot;
    if (existing && existing.src && existing.paint && mode === 'reopen') {   // re-open what was drawn before
      const im = new Image();
      im.onload = () => {
        const pm = existing.paint;
        P.newDoc(im.naturalWidth, im.naturalHeight, { target: { slot, R: pm.R, px: pm.px, py: pm.py, rot: pm.rot || 0, tip } });
        P.loadImage(im); P.changed(false);
        const t = UI.template(slot, pm.R);
        if (t) { P.doc.ref = t.canvas; P.doc.refX = pm.px - t.px; P.doc.refY = pm.py - t.py; }
        UI.afterOpen();
      };
      im.src = existing.src;
      return;
    }
    const t = UI.template(slot, R);
    const w = (t ? t.w : 16) + M * 2, h = (t ? t.h : 16) + M * 2;
    const px = (t ? t.px : 8) + M, py = (t ? t.py : 8) + M;
    P.newDoc(w, h, { target: { slot, R, px, py, rot: 0, tip }, ref: t ? t.canvas : null });
    P.doc.refX = M; P.doc.refY = M;
    if (t && fromShape) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(t.canvas, M, M); P.loadImage(c); P.changed(false); }
    P.palette = P.PALETTES[UI.palName].make();
    UI.afterOpen();
  };
  UI.afterOpen = () => { P.fit(); P.undo = []; P.redo = []; UI.refreshLayers(); UI.refreshPalette(); UI.status(); P.needs = true; };
  UI.newCanvas = (w, h) => { P.newDoc(w, h); UI.afterOpen(); };
  UI.scheduleApply = () => { clearTimeout(UI._t); UI._t = setTimeout(() => UI.applyPart(), 120); };
  UI.applyPart = () => {
    const t = P.doc && P.doc.target;
    if (!t) { U.toast('ผ้าใบนี้ไม่ได้ผูกกับชิ้นส่วนตัวละคร'); return; }
    const app = PR.app, img = P.flatten(1), s = 1 / t.R, r = -(t.rot || 0), a = r * PR.D2R;
    const x = -(Math.cos(a) * t.px - Math.sin(a) * t.py) * s, y = -(Math.sin(a) * t.px + Math.cos(a) * t.py) * s;
    const entry = { src: img.toDataURL(), x, y, s, r, hide: true, paint: { R: t.R, px: t.px, py: t.py, rot: t.rot || 0 } };
    app.cfg.images[t.slot] = entry;
    const pair = PAIRS[t.slot];
    if (pair && UI.backToo) {   // the far-side limb gets a darker copy
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), k = PR.CFG.render.backShade;
      for (let i = 0; i < d.data.length; i += 4) { d.data[i] *= k; d.data[i + 1] *= k; d.data[i + 2] *= k; }
      g.putImageData(d, 0, 0);
      app.cfg.images[pair] = Object.assign({}, entry, { src: c.toDataURL() });
    }
    app.applyCfg();
  };
  UI.removePart = (slot) => {
    const app = PR.app;
    delete app.cfg.images[slot];
    if (PAIRS[slot] && UI.backToo) delete app.cfg.images[PAIRS[slot]];
    app.applyCfg();
  };

  // ---------- right panel ----------
  UI.enter = (panel) => {
    UI.panel = panel;
    UI.buildWorkspace();
    UI.buildPanel();
    UI.setTool(P.tool);
  };
  UI.buildPanel = () => {
    const panel = UI.panel, app = PR.app;
    panel.innerHTML = '';
    // colors
    UI.colorCard = U.card('สี', []);
    panel.append(UI.colorCard);
    UI.refreshColors();
    // palette
    UI.palCard = U.card('พาเลต (ไล่เฉดแบบเลื่อน hue)', []);
    panel.append(UI.palCard);
    UI.refreshPalette();
    // layers
    UI.layerCard = U.card('เลเยอร์', []);
    panel.append(UI.layerCard);
    UI.refreshLayers();
    // character part
    const slots = UI.slots();
    const prev = U.el('canvas', { width: 960, height: 540, style: 'width:100%;border-radius:8px;border:1px solid var(--line);margin-top:8px;image-rendering:pixelated' });
    UI.previewCtx = prev.getContext('2d');
    const ch = app.scene.ch;
    panel.append(U.card('วาดชิ้นส่วนตัวละคร', [
      U.row('ชิ้นส่วน', U.select(slots.map((s) => [s, s + (app.cfg.images[s] && app.cfg.images[s].paint ? ' ✎' : '')]), UI.slot, (v) => { UI.slot = v; })),
      U.row('ความละเอียด', U.select([[1, '1 px/หน่วย (ตัวละครสูง ~50px)'], [2, '2 px/หน่วย (~100px)'], [3, '3 px/หน่วย (~150px)'], [4, '4 px/หน่วย']], UI.R, (v) => { UI.R = +v; })),
      U.el('div', { class: 'btns' }, [
        U.button('เปิดมาวาด (เริ่มจากรูปเดิม)', () => UI.openPart(UI.slot, 'shape'), 'pri'),
        U.button('ผ้าใบว่าง + ไกด์', () => UI.openPart(UI.slot, 'blank')),
        app.cfg.images[UI.slot] && app.cfg.images[UI.slot].paint ? U.button('เปิดงานที่วาดไว้', () => UI.openPart(UI.slot, 'reopen')) : null,
      ]),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.el('label', { class: 'popt' }, [U.el('input', { type: 'checkbox', checked: UI.live, onchange: (e) => (UI.live = e.target.checked) }), 'อัปเดตตัวละครทันที']),
        U.el('label', { class: 'popt' }, [U.el('input', { type: 'checkbox', checked: UI.backToo, onchange: (e) => (UI.backToo = e.target.checked) }), 'ใช้กับแขน/ขาด้านหลังด้วย']),
      ]),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('ใส่ลงตัวละคร', () => { UI.applyPart(); U.toast('ใส่ชิ้น "' + (P.doc.target ? P.doc.target.slot : '') + '" แล้ว'); UI.buildPanel(); }),
        U.button('เอารูปที่วาดออก', () => { UI.removePart(UI.slot); U.toast('กลับไปใช้รูปทรงเดิม'); UI.buildPanel(); }, 'warn'),
      ]),
      prev,
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('ยืน', () => (ch.autoMove = 0)), U.button('เดิน', () => (ch.autoMove = 1)), U.button('วิ่ง', () => (ch.autoMove = 2)),
        U.button('โจมตี', () => ch.attack()), U.button('สกิล', () => ch.play(ch.set.skills[0], { force: true })),
      ]),
      U.el('div', { class: 'note', text: 'จุดแดง = ข้อต่อของกระดูก (จุดหมุน) เส้นแดง = ทิศของกระดูก วาดให้ชิ้นส่วนเริ่มที่จุดนั้น ภาพจางด้านหลัง = รูปทรงเดิมไว้เป็นไกด์' }),
    ]));
    // file / commands
    const wIn = U.el('input', { type: 'number', value: 32, min: 1, max: 512, style: 'width:64px' });
    const hIn = U.el('input', { type: 'number', value: 32, min: 1, max: 512, style: 'width:64px' });
    const scaleSel = U.select([[1, '×1'], [2, '×2'], [4, '×4'], [8, '×8']], 1, () => {});
    const fileIn = U.el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const im = new Image();
      im.onload = () => {
        P.pushUndo();
        if (im.naturalWidth > P.doc.w || im.naturalHeight > P.doc.h) P.cmd.resize(Math.max(P.doc.w, im.naturalWidth), Math.max(P.doc.h, im.naturalHeight));
        P.loadImage(im, true); P.changed(); U.toast('นำเข้าเป็นเลเยอร์ใหม่แล้ว');
      };
      im.src = URL.createObjectURL(f);
    } });
    panel.append(U.card('ไฟล์และคำสั่ง', [
      U.el('div', { class: 'btns' }, [U.el('span', { class: 'popt' }, ['กว้าง ', wIn, ' สูง ', hIn]),
        U.button('ผ้าใบใหม่', () => UI.newCanvas(PR.clamp(+wIn.value, 1, 512), PR.clamp(+hIn.value, 1, 512))),
        U.button('ปรับขนาดผ้าใบ', () => P.cmd.resize(PR.clamp(+wIn.value, 1, 512), PR.clamp(+hIn.value, 1, 512)))]),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('พลิกซ้าย-ขวา', () => P.cmd.flipH()), U.button('พลิกบน-ล่าง', () => P.cmd.flipV()), U.button('หมุน 90°', () => P.cmd.rotate()),
        U.button('เส้นขอบรอบรูป', () => P.cmd.outline(P.primary, false)), U.button('ขอบ (รวมแนวทแยง)', () => P.cmd.outline(P.primary, true)),
        U.button('ล้าง', () => P.cmd.clear(), 'warn'),
      ]),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.el('label', { class: 'btn' }, ['นำเข้า PNG', fileIn]),
        U.el('span', { class: 'popt' }, ['ขยาย ', scaleSel]),
        U.button('ส่งออก PNG', () => P.flatten(+scaleSel.value).toBlob((b) => U.download(b, (P.doc.target ? P.doc.target.slot : 'sprite') + '.png'))),
      ]),
      U.el('div', { class: 'note', text: 'ปุ่มลัด: B ดินสอ · E ยางลบ · G ถังเท · L เส้น · R สี่เหลี่ยม · O วงรี · I ดูดสี · M เลือก · V ย้าย · S แรเงา · D ดิทเธอร์ · X สลับสี · [ ] ขนาดหัวแปรง · Shift = เส้น 45°/สี่เหลี่ยมจัตุรัส · Ctrl+Z/Y ย้อน/ทำซ้ำ · Ctrl+C/V คัดลอก/วาง · Del ลบส่วนที่เลือก · Enter วางลง' }),
    ]));
  };
  const swatch = (c, onClick, title) => U.el('button', { class: 'swatch', title: title || (c[3] ? P.hex(c) : 'โปร่งใส'), style: `background:${c[3] ? P.hex(c) : 'repeating-conic-gradient(#555 0% 25%, #888 0% 50%) 50% / 8px 8px'}`, onclick: onClick });
  UI.refreshColors = () => {
    const card = UI.colorCard; if (!card) return;
    const pick = (which) => { const inp = U.el('input', { type: 'color', value: P.hex(P[which]), oninput: () => { P[which] = P.rgba(inp.value); UI.refreshColors(); } }); return inp; };
    const hex = U.el('input', { type: 'text', value: P.hex(P.primary), style: 'width:90px', onchange: () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value)) { P.primary = P.rgba(hex.value.startsWith('#') ? hex.value : '#' + hex.value); UI.refreshColors(); } } });
    card.replaceChildren(U.el('h3', { text: 'สี' }), U.el('div', { class: 'btns', style: 'align-items:center' }, [
      U.el('span', { class: 'popt' }, ['หลัก (คลิกซ้าย) ', pick('primary')]),
      U.el('span', { class: 'popt' }, ['รอง (คลิกขวา) ', pick('secondary')]),
      U.button('สลับ (X)', () => { [P.primary, P.secondary] = [P.secondary, P.primary]; UI.refreshColors(); }),
      U.button('รองโปร่งใส', () => { P.secondary = [0, 0, 0, 0]; UI.refreshColors(); }),
      hex,
    ]));
  };
  UI.refreshPalette = () => {
    const card = UI.palCard; if (!card) return;
    const rows = P.palette.map((ramp, ri) => U.el('div', { class: 'ramp' }, ramp.map((h) => {
      const b = swatch(P.rgba(h), () => { P.primary = P.rgba(h); UI.refreshColors(); }, h);
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); P.secondary = P.rgba(h); UI.refreshColors(); });
      return b;
    }).concat([U.el('button', { class: 'swatch del', title: 'ลบแถวนี้', onclick: () => { P.palette.splice(ri, 1); UI.refreshPalette(); } }, '×')])));
    card.replaceChildren(U.el('h3', { text: 'พาเลต (ไล่เฉดแบบเลื่อน hue)' }),
      U.row('ชุดสี', U.select(Object.entries(P.PALETTES).map(([k, v]) => [k, v.name]), UI.palName, (v) => { UI.palName = v; P.palette = P.PALETTES[v].make(); UI.refreshPalette(); })),
      U.el('div', { class: 'palette' }, rows),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('+ ไล่เฉดจากสีหลัก', () => { P.palette.push(P.ramp(P.hex(P.primary))); UI.refreshPalette(); }),
        U.button('ดึงสีจากภาพ', () => {
          const seen = new Set(), cols = [];
          for (const l of P.doc.layers) for (let i = 0; i < l.data.length; i += 4) if (l.data[i + 3]) { const h = P.hex([l.data[i], l.data[i + 1], l.data[i + 2]]); if (!seen.has(h)) { seen.add(h); cols.push(h); } }
          for (let i = 0; i < Math.min(cols.length, 64); i += 8) P.palette.push(cols.slice(i, i + 8));
          UI.refreshPalette();
        }),
      ]),
      U.el('div', { class: 'note', text: 'คลิกซ้าย = สีหลัก · คลิกขวา = สีรอง · เครื่องมือแรเงา (S) เลื่อนสีขึ้น/ลงตามแถวของพาเลตนี้' }));
  };
  UI.refreshLayers = () => {
    const card = UI.layerCard; if (!card || !P.doc) return;
    const d = P.doc;
    const list = U.el('div', { class: 'layers' });
    for (let i = d.layers.length - 1; i >= 0; i--) {
      const l = d.layers[i];
      list.append(U.el('div', { class: 'layer' + (i === d.active ? ' on' : ''), onclick: () => { P.commitFloat(); d.active = i; UI.refreshLayers(); } }, [
        U.el('button', { class: 'lbtn', title: 'ซ่อน/แสดง', onclick: (e) => { e.stopPropagation(); l.visible = !l.visible; P.changed(); } }, l.visible ? '👁' : '·'),
        U.el('button', { class: 'lbtn', title: 'ล็อก', onclick: (e) => { e.stopPropagation(); l.locked = !l.locked; UI.refreshLayers(); } }, l.locked ? '🔒' : '🔓'),
        U.el('span', { style: 'flex:1', ondblclick: (e) => { e.stopPropagation(); const n = prompt('ชื่อเลเยอร์', l.name); if (n) { l.name = n; UI.refreshLayers(); } } }, l.name),
      ]));
    }
    card.replaceChildren(U.el('h3', { text: 'เลเยอร์' }), list, U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
      U.button('+ เพิ่ม', () => P.cmd.addLayer()), U.button('ทำสำเนา', () => P.cmd.dupLayer()), U.button('ขึ้น', () => P.cmd.moveLayer(1)), U.button('ลง', () => P.cmd.moveLayer(-1)),
      U.button('รวมลง', () => P.cmd.mergeDown()), U.button('ลบ', () => P.cmd.delLayer(), 'warn'),
    ]));
  };

  // per-frame (called by app.js while in paint mode)
  UI.frame = (dt) => {
    const app = PR.app;
    app.scene.update(dt, {});
    if (UI.previewCtx) app.scene.render(UI.previewCtx, app.view, {});
    P.render();
  };
})();
