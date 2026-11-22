'use strict';
// Saving pixel-editor work: autosave (IndexedDB, falls back to localStorage), a named drawing library in the browser,
// and .pxrig files (JSON with one PNG data URL per cel). Every frame, layer, tag, duration, pivot and palette is kept.
(() => {
  const U = PR.ui, P = PR.paint, UI = PR.paintUI;
  const FORMAT = 'pixelrig-paint', AUTO = 'paint:autosave', LIB = 'paint:lib:';

  // ---------- tiny key/value store ----------
  const kv = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        if (!window.indexedDB) { rej(new Error('no indexedDB')); return; }
        const r = indexedDB.open('pixelrig', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async req(mode, fn) {
      try {
        const db = await this.open();
        return await new Promise((res, rej) => { const q = fn(db.transaction('kv', mode).objectStore('kv')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      } catch (e) { return this.fallback(mode, fn, e); }
    },
    fallback(mode, fn) {   // localStorage stand-in with the same tiny API
      const store = {
        get: (k) => ({ result: U.store.get('kv.' + k, undefined) }),
        put: (v, k) => ({ result: U.store.set('kv.' + k, v) }),
        delete: (k) => { try { localStorage.removeItem('pixelrig.kv.' + k); } catch (e) { /* ignore */ } return { result: undefined }; },
        getAllKeys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pixelrig.kv.')) out.push(k.slice(12)); } } catch (e) { /* ignore */ } return { result: out }; },
      };
      return fn(store).result;
    },
    get(k) { return this.req('readonly', (s) => s.get(k)); },
    set(k, v) { return this.req('readwrite', (s) => s.put(v, k)); },
    del(k) { return this.req('readwrite', (s) => s.delete(k)); },
    keys() { return this.req('readonly', (s) => s.getAllKeys()); },
  };

  // ---------- (de)serialisation ----------
  const celURL = (data, w, h) => {
    let empty = true;
    for (let i = 3; i < data.length; i += 4) if (data[i]) { empty = false; break; }
    if (empty) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
    return c.toDataURL('image/png');
  };
  const celData = (url, w, h) => new Promise((res) => {
    const blank = new Uint8ClampedArray(w * h * 4);
    if (!url) { res(blank); return; }
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      res(new Uint8ClampedArray(g.getImageData(0, 0, w, h).data));
    };
    im.onerror = () => res(blank);
    im.src = url;
  });
  const thumbURL = () => {
    const d = P.doc, fit = 48 / Math.max(d.w, d.h), k = fit >= 1 ? Math.floor(fit) : fit, c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(P.flatten(1, 0), 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };
  const S = (PR.paintStore = { kv });
  S.serialize = () => {
    P.commitFloat();
    const d = P.doc;
    const t = d.target ? (({ slot, R, px, py, rot }) => ({ slot, R, px, py, rot: rot || 0 }))(d.target) : null;
    return {
      format: FORMAT, version: 1, app: 'PixelRig Studio', savedAt: new Date().toISOString(), name: UI.docName || (t ? t.slot : 'sprite'),
      w: d.w, h: d.h, frame: d.frame, active: d.active, tags: PR.clone(d.tags), target: t, palette: PR.clone(P.palette),
      layers: d.layers.map((l) => ({ name: l.name, visible: l.visible, locked: l.locked })),
      frames: d.frames.map((f) => ({ dur: f.dur, cels: f.cels.map((c) => celURL(c, d.w, d.h)) })),
    };
  };
  S.deserialize = async (o) => {
    if (!o || o.format !== FORMAT || !o.w || !o.h || !Array.isArray(o.frames)) throw new Error('ไม่ใช่ไฟล์งานวาด PixelRig');
    const w = o.w, h = o.h, nl = Math.max(1, (o.layers || []).length);
    const frames = await Promise.all(o.frames.map(async (f) => {
      const cels = await Promise.all(Array.from({ length: nl }, (_, i) => celData((f.cels || [])[i], w, h)));
      return { dur: PR.clamp(f.dur || 100, 10, 10000), cels };
    }));
    const t = o.target ? Object.assign({}, o.target) : null;
    if (t && PR.app) {   // bone direction + guide come from the current character
      const rig = PR.app.scene.ch.rig, bone = { weapon: 'weapon', skirt: 'pelvis' }[t.slot] || t.slot;
      t.tip = t.slot === 'weapon' ? rig.weapon.tip : (rig.boneMap[bone] || { tip: [0, 0] }).tip;
    }
    P.newDoc(w, h, { target: t });
    const d = P.doc;
    d.layers = (o.layers && o.layers.length ? o.layers : [{ name: 'เลเยอร์ 1' }]).map((l) => Object.assign(P.layer(l.name || 'เลเยอร์', P.blank()), { visible: l.visible !== false, locked: !!l.locked }));
    d.frames = frames;
    d.tags = (o.tags || []).filter((x) => x.from >= 0 && x.to < frames.length && x.from <= x.to);
    d.active = PR.clamp(o.active || 0, 0, d.layers.length - 1);
    P.bindFrame(o.frame || 0);
    if (t && PR.app) {
      const tpl = UI.template(t.slot, t.R);
      if (tpl) { d.ref = tpl.canvas; d.refX = t.px - tpl.px; d.refY = t.py - tpl.py; }
    }
    if (Array.isArray(o.palette) && o.palette.length) P.palette = o.palette;
    UI.docName = o.name || '';
    P.undo = []; P.redo = []; P.fit(); P.changed(false);
    UI.afterOpen();
  };

  // ---------- autosave ----------
  S.restoring = false;
  S.lastSaved = null;
  S.autosave = async () => {
    if (S.restoring || !P.doc) return;
    try { await kv.set(AUTO, S.serialize()); S._pending = false; S.lastSaved = new Date(); S.status(); }
    catch (e) { S.status('บันทึกอัตโนมัติไม่สำเร็จ: ' + e.message); }
  };
  S.scheduleAutosave = () => { if (S.restoring) return; S._pending = true; clearTimeout(S._t); S._t = setTimeout(S.autosave, 900); };
  S.restore = async () => {
    S.restoring = true;
    clearTimeout(S._t);
    try {
      let o = await kv.get(AUTO);
      // a save that was still pending when the page closed is flushed to localStorage; use it if newer
      const pending = U.store.get('paintPending', null);
      if (pending && (!o || String(pending.savedAt) > String(o.savedAt))) o = pending;
      try { localStorage.removeItem('pixelrig.paintPending'); } catch (e) { /* ignore */ }
      if (o) { await S.deserialize(o); S.lastSaved = new Date(o.savedAt); U.toast('เปิดงานวาดล่าสุดที่บันทึกอัตโนมัติไว้แล้ว'); return true; }
    } catch (e) { console.warn('paint restore failed', e); }
    finally { S.restoring = false; }
    return false;
  };
  S.status = (msg) => {
    const el = document.getElementById('paintSaveStatus');
    if (!el) return;
    el.textContent = msg || (S.lastSaved ? 'บันทึกอัตโนมัติแล้ว ' + S.lastSaved.toLocaleTimeString() : 'ยังไม่ได้บันทึก');
  };

  // ---------- library + files ----------
  S.list = async () => {
    const keys = ((await kv.keys()) || []).filter((k) => String(k).startsWith(LIB));
    const items = await Promise.all(keys.map((k) => kv.get(k)));
    return items.filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  };
  S.saveToLibrary = async (name) => {
    const doc = S.serialize();
    doc.name = name;
    await kv.set(LIB + name, { name, savedAt: doc.savedAt, frames: doc.frames.length, size: doc.w + '×' + doc.h, thumb: thumbURL(), doc });
  };
  S.openFromLibrary = async (name) => { const it = await kv.get(LIB + name); if (it) { await S.deserialize(it.doc); S.scheduleAutosave(); } };
  S.deleteFromLibrary = (name) => kv.del(LIB + name);
  S.saveFile = () => {
    const doc = S.serialize();
    U.download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), (doc.name || 'sprite').replace(/[^\w-]/g, '_') + '.pxrig');
  };
  S.openFile = async (file) => { await S.deserialize(JSON.parse(await file.text())); S.scheduleAutosave(); };
  // used by the project file (config.js)
  S.exportAll = async () => ({ autosave: (await kv.get(AUTO)) || null, library: (await S.list()).map((it) => it.doc) });
  S.importAll = async (all) => {
    if (!all) return;
    for (const doc of all.library || []) if (doc && doc.format === FORMAT) {
      await kv.set(LIB + doc.name, { name: doc.name, savedAt: doc.savedAt, frames: doc.frames.length, size: doc.w + '×' + doc.h, thumb: null, doc });
    }
    if (all.autosave && all.autosave.format === FORMAT) await kv.set(AUTO, all.autosave);
  };

  // ---------- UI ----------
  S.card = () => {
    const nameIn = U.el('input', { type: 'text', value: UI.docName || (P.doc && P.doc.target ? P.doc.target.slot : 'sprite'), style: 'width:140px', oninput: () => (UI.docName = nameIn.value) });
    const list = U.el('div', { class: 'layers', style: 'max-height:240px;overflow:auto' }, [U.el('div', { class: 'note', text: 'กำลังโหลด...' })]);
    const fileIn = U.el('input', { type: 'file', accept: '.pxrig,.json,application/json', style: 'display:none', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await S.openFile(f); U.toast('เปิดไฟล์ "' + f.name + '" แล้ว'); UI.buildPanel(); } catch (err) { U.toast('เปิดไม่ได้: ' + err.message, 3000); }
    } });
    const refresh = async () => {
      const items = await S.list();
      list.replaceChildren(...(items.length ? items.map((it) => U.el('div', { class: 'layer', style: 'cursor:default' }, [
        it.thumb ? U.el('img', { src: it.thumb, style: 'width:32px;height:32px;object-fit:contain;image-rendering:pixelated;background:#2b2540;border-radius:4px' }) : null,
        U.el('span', { style: 'flex:1;min-width:0' }, [U.el('div', { text: it.name }), U.el('div', { class: 'note', style: 'margin:0', text: `${it.size} · ${it.frames} เฟรม · ${new Date(it.savedAt).toLocaleString()}` })]),
        U.button('เปิด', async () => { await S.openFromLibrary(it.name); U.toast('เปิด "' + it.name + '" แล้ว'); UI.buildPanel(); }),
        U.button('ลบ', async () => { if (confirm('ลบงานวาด "' + it.name + '" ออกจากคลัง?')) { await S.deleteFromLibrary(it.name); refresh(); } }, 'warn'),
      ])) : [U.el('div', { class: 'note', text: 'ยังไม่มีงานที่บันทึกในคลัง' })]));
    };
    refresh();
    const card = U.card('บันทึก / เปิดงานวาด', [
      U.el('div', { class: 'note', id: 'paintSaveStatus' }),
      U.el('div', { class: 'btns' }, [U.el('span', { class: 'popt' }, ['ชื่องาน ', nameIn]),
        U.button('บันทึกลงคลัง', async () => { const n = (nameIn.value || '').trim() || 'sprite'; UI.docName = n; await S.saveToLibrary(n); U.toast('บันทึก "' + n + '" ลงคลังแล้ว'); refresh(); }, 'pri')]),
      U.el('h4', { text: 'คลังงานวาด (เก็บในเบราว์เซอร์นี้)' }), list,
      U.el('div', { class: 'btns', style: 'margin-top:8px' }, [
        U.button('บันทึกเป็นไฟล์ (.pxrig)', () => S.saveFile()),
        U.el('label', { class: 'btn' }, ['เปิดไฟล์ .pxrig', fileIn]),
      ]),
      U.el('div', { class: 'note', text: 'งานที่กำลังวาดบันทึกอัตโนมัติทุกครั้งที่แก้ (ทุกเฟรม เลเยอร์ แท็ก เวลา จุดหมุน และพาเลต) รีโหลดหน้าแล้วจะเปิดกลับมาให้เอง · ไฟล์ .pxrig ใช้ย้ายเครื่องหรือส่งต่อ · "ส่งออกโปรเจกต์" ในแท็บตั้งค่าจะรวมคลังงานวาดไปด้วย' }),
    ]);
    setTimeout(() => S.status(), 0);
    return card;
  };

  // ---------- hooks ----------
  const origBuild = UI.buildPanel;
  UI.buildPanel = () => { origBuild(); UI.panel.append(S.card()); };
  const origWorkspace = UI.buildWorkspace;
  UI.buildWorkspace = () => {
    const first = !UI.built;
    if (first) S.restoring = true;   // the default doc opened below must not overwrite the saved work
    origWorkspace();
    if (!first) return;
    const onChange = P.onChange;
    P.onChange = () => { onChange && onChange(); S.scheduleAutosave(); };
    S.restore().then((ok) => { if (ok && UI.panel && PR.app.mode === 'paint') UI.buildPanel(); });
  };
  // a newly opened doc (part / new canvas / import) is saved too
  const origAfterOpen = UI.afterOpen;
  UI.afterOpen = () => { origAfterOpen(); if (!S.restoring) S.scheduleAutosave(); };
  // IndexedDB writes may not finish while the page closes: flush a pending save synchronously to localStorage
  addEventListener('beforeunload', () => {
    if (!P.doc || S.restoring || !S._pending) return;
    try { U.store.set('paintPending', S.serialize()); } catch (e) { /* too big for localStorage: the last autosave stays */ }
  });
})();
