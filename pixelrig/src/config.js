'use strict';
// Config: global settings (PR.CFG, PR.MOTION), data overrides (weapons, outfits, elements, move sets...),
// character library and project import/export. The "ตั้งค่า" tab UI lives at the bottom.
(() => {
  const U = PR.ui;
  const TABLES = ['WEAPONS', 'OFFHANDS', 'ELEMENTS', 'SETS', 'HAIR', 'EQUIP', 'BASE_PALETTE', 'BODY_PRESETS'];
  PR.DEFAULTS = {};
  for (const t of TABLES) PR.DEFAULTS[t] = PR.clone(PR[t]);
  PR.DEFAULTS.MOTION = PR.clone(PR.MOTION);

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const deepAssign = (dst, src) => { for (const k in src) { if (isObj(src[k]) && isObj(dst[k])) deepAssign(dst[k], src[k]); else dst[k] = PR.clone(src[k]); } return dst; };
  // EQUIP slots are arrays of items: merge them by id so an override can add or change one item
  const mergeById = (arr, items) => { for (const it of items) { const i = arr.findIndex((a) => a.id === it.id); if (i >= 0) arr[i] = Object.assign({}, arr[i], it); else arr.push(PR.clone(it)); } return arr; };
  const merge = (base, over, byId) => {
    if (!over) return base;
    for (const k in over) {
      if (over[k] === null) { delete base[k]; continue; }
      if (byId && Array.isArray(over[k])) base[k] = mergeById(base[k] || [], over[k]);
      else if (isObj(over[k]) && isObj(base[k])) base[k] = merge(base[k], over[k]);
      else base[k] = PR.clone(over[k]);
    }
    return base;
  };

  const C = (PR.config = {
    overrides: {},
    load() {
      const s = U.store.get('config', null);
      if (s) { deepAssign(PR.CFG, s.cfg || {}); Object.assign(PR.MOTION, s.motion || {}); this.overrides = s.overrides || {}; }
      this.apply();
    },
    save() { U.store.set('config', this.snapshot()); },
    snapshot() { return { cfg: PR.clone(PR.CFG), motion: PR.clone(PR.MOTION), overrides: PR.clone(this.overrides) }; },
    restore(s) {
      PR.CFG = deepAssign(PR.clone(PR.CFG_DEFAULTS), (s && s.cfg) || {});
      PR.MOTION = Object.assign(PR.clone(PR.DEFAULTS.MOTION), (s && s.motion) || {});
      this.overrides = (s && s.overrides) || {};
      this.apply(); this.save();
    },
    apply() { for (const t of TABLES) PR[t] = merge(PR.clone(PR.DEFAULTS[t]), this.overrides[t], t === 'EQUIP'); },
    set(path, value) {   // e.g. set(['ELEMENTS','fire','ramp'], [...])
      let o = this.overrides;
      for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = isObj(o[path[i]]) ? o[path[i]] : {};
      o[path[path.length - 1]] = PR.clone(value);
      this.apply(); this.save();
      if (PR.app) PR.app.applyCfg();
    },
    // ---- character library ----
    chars() { return U.store.get('chars', {}); },
    saveChar(name, cfg) { const all = this.chars(); all[name] = PR.clone(cfg); U.store.set('chars', all); U.store.set('charName', name); },
    deleteChar(name) { const all = this.chars(); delete all[name]; U.store.set('chars', all); },
    loadChar(name) {
      const c = this.chars()[name];
      if (!c || !PR.app) return;
      const cfg = PR.app.cfg;
      for (const k of Object.keys(cfg)) delete cfg[k];
      Object.assign(cfg, PR.clone(PR.DEFAULT_CHAR), PR.clone(c));
      cfg.equip = Object.assign({}, PR.DEFAULT_CHAR.equip, c.equip || {});
      U.store.set('charName', name);
      PR.app.applyCfg();
    },
    // ---- project file ----
    async exportProject() {
      const drawings = PR.paintStore ? await PR.paintStore.exportAll() : null;
      return { app: 'PixelRig Studio', version: 3, character: PR.app.cfg, characterName: U.store.get('charName', ''), characters: this.chars(), clips: PR.USER_CLIPS, config: this.snapshot(), drawings };
    },
    async importProject(p) {
      if (!p || (p.app !== 'PixelRig Studio' && !p.character)) throw new Error('ไม่ใช่ไฟล์โปรเจกต์ PixelRig');
      if (p.config) this.restore(p.config);
      if (p.characters) U.store.set('chars', Object.assign(this.chars(), p.characters));
      if (p.clips) { Object.assign(PR.USER_CLIPS, p.clips); PR.app.saveClips(); }
      if (p.character) { this.saveChar(p.characterName || 'นำเข้า', p.character); this.loadChar(p.characterName || 'นำเข้า'); }
      if (p.drawings && PR.paintStore) await PR.paintStore.importAll(p.drawings);
    },
  });
  C.load();

  // ================= UI =================
  const section = (title, open, kids) => {
    const d = U.el('details', { class: 'card', open: open || undefined }, [U.el('summary', { style: 'cursor:pointer;color:var(--accent);font-weight:600' }, title)]);
    const body = U.el('div', { style: 'margin-top:10px' }, kids);
    d.append(body);
    return d;
  };
  const color = (label, value, onInput) => {
    const inp = U.el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#ff00ff', oninput: () => onInput(inp.value) });
    return U.el('div', {}, [U.el('label', { text: label }), inp]);
  };
  const check = (label, value, onChange) => U.el('label', { style: 'display:flex;gap:6px;align-items:center;margin:4px 0' }, [U.el('input', { type: 'checkbox', checked: !!value, onchange: (e) => onChange(e.target.checked) }), label]);
  const slider = (label, min, max, step, value, onInput, fmt) => U.row(label, U.range(min, max, step, value, onInput, fmt || ((v) => (+v).toFixed(step < 1 ? 2 : 0))));
  const saveCfg = () => C.save();

  PR.configUI = {
    buildPanel(panel) {
      panel.innerHTML = '';
      const app = PR.app, cfg = app.cfg, ch = app.scene.ch;
      const rebuild = () => PR.configUI.buildPanel(panel);

      // ---------- character creator ----------
      const chars = C.chars(), current = U.store.get('charName', '');
      const nameIn = U.el('input', { type: 'text', value: current || 'ตัวละคร 1', placeholder: 'ชื่อตัวละคร' });
      const libSel = U.select([['', '— เลือกตัวละครที่บันทึกไว้ —'], ...Object.keys(chars).map((n) => [n, n])], current, (v) => { if (v) { C.loadChar(v); rebuild(); } });
      const fileIn = U.el('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { await C.importProject(JSON.parse(await f.text())); U.toast('นำเข้าโปรเจกต์แล้ว'); rebuild(); } catch (err) { U.toast('นำเข้าไม่ได้: ' + err.message, 3000); }
      } });
      const body = Object.assign({}, PR.DEFAULT_BODY, cfg.body || {});
      const bodySliders = Object.keys(PR.DEFAULT_BODY).map((k) => slider(PR.BODY_LABELS[k], 0.4, 2.2, 0.01, body[k], (v) => { cfg.body = Object.assign({}, cfg.body, { [k]: v }); app.applyCfg(); }));
      const palBox = U.el('div', { class: 'colors' });
      const pal = ch.rig.pal;
      const palKeys = [...new Set([...Object.keys(pal), 'outline'])].filter((k) => k !== '__v');
      for (const k of palKeys) palBox.append(color(k, k === 'outline' ? (cfg.colors.outline || PR.CFG.render.outline) : PR.resolveColor(k, pal), (v) => { cfg.colors[k] = v; app.applyCfg(); }));
      const equipRows = [U.row('ทรงผม', U.select(Object.entries(PR.HAIR).map(([k, h]) => [k, h.name || k]), cfg.hair, (v) => { cfg.hair = v; app.applyCfg(); }))];
      for (const [slot, label] of PR.EQUIP_SLOTS) equipRows.push(U.row(label, U.select(PR.EQUIP[slot].map((i) => [i.id, i.name || i.id]), cfg.equip[slot], (v) => { cfg.equip[slot] = v; app.applyCfg(); rebuild(); })));
      panel.append(section('ตัวละคร (สร้าง / บันทึก / โหลด)', true, [
        U.row('คลังตัวละคร', libSel),
        U.row('ชื่อ', nameIn),
        U.el('div', { class: 'btns' }, [
          U.button('บันทึก', () => { C.saveChar(nameIn.value.trim() || 'ตัวละคร', cfg); U.toast('บันทึก "' + nameIn.value + '" แล้ว'); rebuild(); }, 'pri'),
          U.button('สร้างใหม่', () => { const keep = Object.keys(cfg); keep.forEach((k) => delete cfg[k]); Object.assign(cfg, PR.clone(PR.DEFAULT_CHAR)); U.store.set('charName', ''); app.applyCfg(); rebuild(); }),
          current ? U.button('ลบตัวนี้', () => { if (confirm('ลบ "' + current + '" ออกจากคลัง?')) { C.deleteChar(current); U.store.set('charName', ''); rebuild(); } }, 'warn') : null,
        ]),
        U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
          U.button('ส่งออกโปรเจกต์ (.json)', async () => U.download(new Blob([JSON.stringify(await C.exportProject(), null, 1)], { type: 'application/json' }), 'pixelrig_project.json')),
          U.el('label', { class: 'btn' }, ['นำเข้าโปรเจกต์', fileIn]),
        ]),
        U.el('h4', { text: 'สัดส่วนร่างกาย' }),
        U.el('div', { class: 'btns' }, Object.entries(PR.BODY_PRESETS).map(([k, p]) => U.button(p.name || k, () => { cfg.body = PR.clone(p.body); app.applyCfg(); rebuild(); }))),
        ...bodySliders,
        U.el('h4', { text: 'ทรงผมและชุด' }), ...equipRows,
        U.el('h4', { text: 'สีทุกจุด (ทับค่าจากชุด)' }), palBox,
        U.el('div', { class: 'btns', style: 'margin-top:8px' }, [U.button('รีเซ็ตสีทั้งหมด', () => { cfg.colors = {}; app.applyCfg(); rebuild(); })]),
      ]));

      // ---------- render ----------
      const R = PR.CFG.render;
      const rset = (k) => (v) => { R[k] = v; saveCfg(); };
      panel.append(section('การแสดงผล (เส้นขอบ พื้นหลัง พิกเซล)', false, [
        U.el('div', { class: 'colors' }, [color('เส้นขอบ', R.outline, rset('outline')), color('ฟ้าบน', R.bgTop, rset('bgTop')), color('ฟ้าล่าง', R.bgBottom, rset('bgBottom')),
          color('พื้น', R.floorColor, rset('floorColor')), color('เส้นพื้น', R.gridColor, rset('gridColor')), color('ขอบพื้น', R.edgeColor, rset('edgeColor'))]),
        slider('ความหนาเส้นขอบ', 0, 3, 0.1, R.outlineW, rset('outlineW')),
        slider('แขนขาด้านหลังมืด', 0.3, 1, 0.01, R.backShade, rset('backShade')),
        slider('ความคมพิกเซล', 20, 230, 1, R.threshold, rset('threshold')),
        U.row('พื้นหลัง', U.select([['night', 'ไล่สี'], ['solid', 'สีเดียว'], ['checker', 'ตารางโปร่งใส']], R.bg, rset('bg'))),
        check('แสดงพื้น', R.floor, rset('floor')), check('เงาใต้เท้า', R.shadow, rset('shadow')), check('แสงหลังตัวละคร', R.glowSpot, rset('glowSpot')),
        U.button('คืนค่าเริ่มต้น', () => { PR.CFG.render = PR.clone(PR.CFG_DEFAULTS.render); saveCfg(); rebuild(); }),
      ]));

      // ---------- locomotion ----------
      const mset = (k) => (v) => { PR.MOTION[k] = v; ch.prm[k] = v; saveCfg(); };
      panel.append(section('การเคลื่อนไหว (ยืน เดิน วิ่ง)', false, [
        ...Object.entries(PR.MOTION_LABELS).map(([k, [label, min, max, step]]) => slider(label, min, max, step, PR.MOTION[k], mset(k))),
        U.button('คืนค่าเริ่มต้น', () => { PR.MOTION = PR.clone(PR.DEFAULTS.MOTION); Object.assign(ch.prm, PR.MOTION); saveCfg(); rebuild(); }),
      ]));

      // ---------- cloth ----------
      const CL = PR.CFG.cloth, cset = (k) => (v) => { CL[k] = v; saveCfg(); };
      panel.append(section('ผ้าคลุม / ผม (ฟิสิกส์)', false, [
        slider('ความแข็ง (ตามเร็ว)', 2, 40, 0.5, CL.stiffness, cset('stiffness')), slider('พลิ้ว (แรง)', 0, 3, 0.05, CL.flutter, cset('flutter')),
        slider('พลิ้ว (เร็ว)', 0.2, 3, 0.05, CL.flutterSpeed, cset('flutterSpeed')), slider('ผ้าคลุมสะบัด', 0, 3, 0.05, CL.capeSwing, cset('capeSwing')),
        slider('ผมสะบัด', 0, 3, 0.05, CL.hairSwing, cset('hairSwing')), slider('มุมผ้าคลุมพัก', -30, 60, 1, CL.capeRest, cset('capeRest')),
        slider('มุมผมพัก', -30, 90, 1, CL.hairRest, cset('hairRest')),
        U.button('คืนค่าเริ่มต้น', () => { PR.CFG.cloth = PR.clone(PR.CFG_DEFAULTS.cloth); saveCfg(); rebuild(); }),
      ]));

      // ---------- fx ----------
      const F = PR.CFG.fx, fset = (k) => (v) => { F[k] = v; saveCfg(); };
      panel.append(section('เอฟเฟกต์ (ความแรง จอสั่น ตัวเลข)', false, [
        slider('จอสั่น', 0, 3, 0.05, F.shake, fset('shake')), slider('หยุดเฟรมตอนโดน (hit-stop)', 0, 3, 0.05, F.hitstop, fset('hitstop')),
        slider('จำนวนอนุภาค', 0, 3, 0.05, F.particles, fset('particles')), slider('แสงเรือง', 0, 2, 0.05, F.glow, fset('glow')),
        slider('ร่องรอยอาวุธยาว', 0.03, 0.5, 0.01, F.trailLife, fset('trailLife')), slider('โอกาสคริติคอล', 0, 1, 0.01, F.critChance, fset('critChance')),
        check('ร่องรอยอาวุธ', F.trail, fset('trail')), check('ตัวเลขดาเมจ', F.numbers, fset('numbers')),
        U.button('คืนค่าเริ่มต้น', () => { PR.CFG.fx = PR.clone(PR.CFG_DEFAULTS.fx); saveCfg(); rebuild(); }),
      ]));

      // ---------- elements ----------
      const elRows = Object.entries(PR.ELEMENTS).map(([id, el]) => U.el('div', { style: 'margin:8px 0' }, [
        U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:4px' }, [
          U.el('input', { type: 'text', value: el.name || id, style: 'flex:1', onchange: (e) => C.set(['ELEMENTS', id, 'name'], e.target.value) }),
          PR.DEFAULTS.ELEMENTS[id] ? null : U.button('ลบ', () => { C.set(['ELEMENTS', id], null); rebuild(); }, 'warn'),
        ]),
        U.el('div', { class: 'colors', style: 'grid-template-columns:repeat(4,1fr)' }, el.ramp.map((c, i) => color(['แกน', 'สว่าง', 'กลาง', 'เข้ม'][i], c, (v) => { const r = [...PR.ELEMENTS[id].ramp]; r[i] = v; C.set(['ELEMENTS', id, 'ramp'], r); }))),
      ]));
      panel.append(section('ธาตุ / สีเอฟเฟกต์', false, [...elRows,
        U.button('+ เพิ่มธาตุใหม่', () => { let n = 1; while (PR.ELEMENTS['custom' + n]) n++; C.set(['ELEMENTS', 'custom' + n], { name: 'ธาตุใหม่ ' + n, ramp: ['#ffffff', '#ffc2f0', '#ff5ad1', '#8a1a7a'] }); rebuild(); }),
      ]));

      // ---------- weapons ----------
      const wid = PR.configUI.weapon && PR.WEAPONS[PR.configUI.weapon] ? PR.configUI.weapon : cfg.weapon;
      const w = PR.WEAPONS[wid];
      const wColors = U.el('div', { class: 'colors' }, Object.entries(w.pal || {}).map(([k, v]) => color(k, v, (c) => C.set(['WEAPONS', wid, 'pal', k], c))));
      panel.append(section('อาวุธ', false, [
        U.row('แก้อาวุธ', U.select(Object.entries(PR.WEAPONS).map(([k, x]) => [k, x.name || k]), wid, (v) => { PR.configUI.weapon = v; rebuild(); })),
        U.row('ชื่อ', U.el('input', { type: 'text', value: w.name || wid, onchange: (e) => C.set(['WEAPONS', wid, 'name'], e.target.value) })),
        U.row('สายท่า', U.select(Object.entries(PR.SETS).map(([k, s]) => [k, s.name || k]), w.set, (v) => C.set(['WEAPONS', wid, 'set'], v))),
        check('ถือสองมือ (มือรองจับด้าม)', w.two, (v) => C.set(['WEAPONS', wid, 'two'], v)),
        w.pal ? U.el('h4', { text: 'สีอาวุธ' }) : null, wColors,
        U.el('div', { class: 'note', text: 'เปลี่ยนรูปทรงอาวุธ: ใส่ PNG บนกระดูก "weapon" ในแท็บแก้ท่า หรือแก้ shapes ในช่อง JSON ขั้นสูงด้านล่าง' }),
        U.button('คืนค่าอาวุธนี้', () => { if (C.overrides.WEAPONS) delete C.overrides.WEAPONS[wid]; C.apply(); C.save(); app.applyCfg(); rebuild(); }),
      ]));

      // ---------- move sets ----------
      const sid = PR.configUI.set && PR.SETS[PR.configUI.set] ? PR.configUI.set : ch.rig.weapon.set;
      const S = PR.SETS[sid];
      const clipOpts = [['', '— ไม่มี —'], ...Object.values(PR.CLIPS).map((c) => [c.id, (c.name || c.id) + ' · ' + c.id]), ...Object.values(PR.USER_CLIPS).map((c) => [c.id, (c.name || c.id) + ' (ของฉัน)'])];
      const slotSel = (list, i, key) => U.select(clipOpts, list[i] || '', (v) => { const l = [...PR.SETS[sid][key]]; l[i] = v; C.set(['SETS', sid, key], l.filter(Boolean)); rebuild(); });
      const stanceTa = U.el('textarea', { rows: 3 }, JSON.stringify(S.stance));
      panel.append(section('ชุดท่า (ปุ่ม J / K / L ของแต่ละสายอาวุธ)', false, [
        U.row('สายท่า', U.select(Object.entries(PR.SETS).map(([k, s]) => [k, s.name || k]), sid, (v) => { PR.configUI.set = v; rebuild(); })),
        U.row('ชื่อสาย', U.el('input', { type: 'text', value: S.name || sid, onchange: (e) => C.set(['SETS', sid, 'name'], e.target.value) })),
        ...[0, 1, 2, 3].map((i) => U.row('คอมโบ ' + (i + 1) + (i === 0 ? ' (J)' : ''), slotSel(S.attacks, i, 'attacks'))),
        ...[0, 1].map((i) => U.row('สกิล ' + ['K', 'L'][i], slotSel(S.skills, i, 'skills'))),
        U.el('h4', { text: 'ท่ายืนถืออาวุธ (stance, องศา)' }), stanceTa,
        U.button('ใช้ stance นี้', () => { try { C.set(['SETS', sid, 'stance'], JSON.parse(stanceTa.value)); U.toast('อัปเดต stance แล้ว'); } catch (e) { U.toast('JSON ไม่ถูกต้อง', 2500); } }),
      ]));

      // ---------- advanced ----------
      const ta = U.el('textarea', { rows: 10, spellcheck: 'false' }, JSON.stringify(C.overrides, null, 1));
      const want = U.el('textarea', { rows: 2, placeholder: 'เช่น: ชุดนินจาสีดำแดง มีผ้าพันคอยาว + ดาบโค้งสีม่วง + ธาตุลม' });
      panel.append(section('ขั้นสูง: JSON ทับข้อมูล (ให้ Claude สร้างของใหม่ได้)', false, [
        U.el('div', { class: 'note', html: 'ใส่ส่วนที่ต้องการเปลี่ยนเท่านั้น เช่น <code>{"WEAPONS":{"sword":{"pal":{"blade":"#ff8888"}}}}</code> · ตาราง: ' + TABLES.join(', ') + ' · EQUIP รวมไอเท็มตาม id · ค่า null = ลบ' }),
        ta,
        U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
          U.button('ใช้ JSON นี้', () => { try { C.overrides = JSON.parse(ta.value || '{}'); C.apply(); C.save(); app.applyCfg(); U.toast('ใช้ค่าใหม่แล้ว'); rebuild(); } catch (e) { U.toast('JSON ไม่ถูกต้อง: ' + e.message, 3000); } }, 'pri'),
          U.button('ล้างค่าที่ทับทั้งหมด', () => { if (confirm('คืนค่าอาวุธ ชุด ธาตุ ชุดท่า ทั้งหมดเป็นค่าเริ่มต้น?')) { C.overrides = {}; C.apply(); C.save(); app.applyCfg(); rebuild(); } }, 'warn'),
          U.button('คืนค่าทุกอย่าง', () => { if (confirm('คืนค่าการตั้งค่าทั้งหมด (ไม่ลบตัวละครและท่าที่บันทึกไว้)?')) { C.restore(null); Object.assign(ch.prm, PR.MOTION); app.applyCfg(); rebuild(); } }, 'warn'),
        ]),
        U.el('h4', { text: 'ให้ Claude ออกแบบไอเท็ม / ชุด / อาวุธ' }), want,
        U.button('คัดลอก Prompt สำหรับ Claude', async () => U.toast((await U.copy(PR.configUI.claudePrompt(want.value))) ? 'คัดลอกแล้ว วางใน Claude แล้วนำ JSON มาวางในกล่องด้านบน' : 'คัดลอกไม่ได้'), 'pri'),
      ]));
    },

    claudePrompt(want) {
      const ex = { EQUIP: { hat: [PR.DEFAULTS.EQUIP.hat.find((i) => i.id === 'wizard')] }, WEAPONS: { sword: { pal: PR.DEFAULTS.WEAPONS.sword.pal } } };
      return `You are designing content for my 2D character rig tool "PixelRig Studio". Reply with ONLY one JSON object (a config override).

What I want: ${want || '(describe outfits / weapons / hair / elements here)'}

## Override format (deep-merged over the built-in data)
{ "EQUIP": { "<slot>": [ item, ... ] },      // slots: ${PR.EQUIP_SLOTS.map((s) => s[0]).join(', ')}; items merge by "id"
  "HAIR": { "<id>": { "name": "...", "shapes": { "head": [...], "hair1": [...], "hair2": [...] } } },
  "WEAPONS": { "<id>": { "name", "set": "${Object.keys(PR.SETS).join('|')}", "two": bool, "grip2": [x,y], "tip": [x,y], "base": [x,y], "pal": {...}, "shapes": [...] } },
  "ELEMENTS": { "<id>": { "name": "...", "ramp": ["#core", "#bright", "#mid", "#dark"] } },
  "SETS": { "<set>": { "attacks": [clip ids], "skills": [clip ids], "stance": { "armF": deg, ... } } },
  "BASE_PALETTE": { "<key>": "#hex" } }
Item: { "id": "snake_case", "name": "Thai name", "pal": { "<palette key>": "#hex" }, "shapes": { "<bone>": [shape, ...] } }

## Shapes (bone-local units; character faces RIGHT, +x forward, y DOWN; limbs hang along +y from their joint)
{"t":"rect","x","y","w","h","r"?} {"t":"circ","x","y","r"} {"t":"ell","x","y","rx","ry"} {"t":"poly","p":[x,y,...]} {"t":"line","p":[...],"w"}
Common: "c" color = "#hex" | palette key | "key*0.8" darker | "key+0.3" lighter; "o": false = no outline.
Bones and sizes: head (skull circle at (0.5,-10) r 8, face/eye toward +x, top of head y≈-18), torso (x -4.5..5, y 0 up to -13),
pelvis (y -2..3; slot "skirt" draws in front of legs), armF/armB (0..8 down, width ~3.8), foreF/foreB (0..7), handF/handB (fist circle at (0,1.5) r 2),
thighF/thighB (0..9), shinF/shinB (0..8.5), footF/footB (toes toward +x, sole at y 2.8), cape1/cape2/cape3 (each 0..7 down, behind the body).
Palette keys: ${Object.keys(PR.BASE_PALETTE).join(', ')}.
Weapon space: origin = fist, +x along the blade (forward when the arm hangs down), "tip"/"base" = trail points.

## Example (built-in data in this format)
${JSON.stringify(ex)}`;
    },
  };
})();
