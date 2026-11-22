'use strict';
// Frame-by-frame animation for the pixel editor: timeline (thumbnails, playback, durations, onion skin, tags),
// sprite-sheet import, and export through the same engine writers as the character sprites.
(() => {
  const U = PR.ui, P = PR.paint, UI = PR.paintUI;
  const TAG_COLORS = ['#f5a623', '#4a90e2', '#a974ff', '#ff4d6d', '#2ecc71', '#4fd0ff'];

  UI.buildTimeline = () => {
    const el = document.getElementById('paintTimeline');
    el.innerHTML = '';
    const tl = (UI.tl = {});
    const chk = (label, key, onChange) => U.el('label', { class: 'popt' }, [U.el('input', { type: 'checkbox', checked: P[key], onchange: (e) => { P[key] = e.target.checked; P.needs = true; onChange && onChange(); } }), label]);
    tl.counter = U.el('span', { style: 'min-width:86px;color:var(--text)' });
    tl.play = U.button('▶', () => UI.togglePlay(), 'pri');
    tl.dur = U.el('input', { type: 'number', min: 10, max: 10000, step: 10, title: 'เวลาของเฟรมนี้ (มิลลิวินาที)', onchange: () => P.frames.setDur(+tl.dur.value, false) });
    const fpsSel = U.select([['', 'FPS ทุกเฟรม'], ...[4, 6, 8, 10, 12, 15, 20, 24, 30].map((v) => [v, v + ' fps'])], '', (v) => { if (v) P.frames.setDur(1000 / +v, true); });
    el.append(U.el('div', { class: 'tlRow' }, [
      U.button('⏮', () => P.frames.go(0)), U.button('◀', () => P.frames.go(P.doc.frame - 1)), tl.play, U.button('▶|', () => P.frames.go(P.doc.frame + 1)), U.button('⏭', () => P.frames.go(P.doc.frames.length - 1)),
      tl.counter,
      U.button('+ เฟรมว่าง', () => P.frames.add(false)), U.button('ทำสำเนาเฟรม', () => P.frames.add(true)), U.button('ลบเฟรม', () => P.frames.del(), 'warn'),
      U.button('◀ ย้าย', () => P.frames.move(-1)), U.button('ย้าย ▶', () => P.frames.move(1)),
      U.el('span', { class: 'popt' }, ['เวลา (ms) ', tl.dur]), fpsSel,
      chk('Onion skin', 'onion'), chk('เล่นไป-กลับ', 'pingpong'),
    ]));
    tl.tags = U.el('div', { class: 'tlRow' });
    el.append(tl.tags);
    tl.thumbs = U.el('div', { class: 'thumbs' });
    el.append(tl.thumbs);
    UI.refreshTimeline(true);
  };

  UI.togglePlay = () => { P.playing = !P.playing; P._acc = 0; P._dir = 1; P.needs = true; UI.refreshTimeline(false); };

  UI.refreshTimeline = (full) => {
    const d = P.doc, tl = UI.tl;
    if (!d || !tl) return;
    tl.counter.textContent = `เฟรม ${d.frame + 1} / ${d.frames.length}`;
    if (document.activeElement !== tl.dur) tl.dur.value = d.frames[d.frame].dur;
    tl.play.textContent = P.playing ? '⏸ หยุด' : '▶ เล่น';
    if (full || tl.thumbs.children.length !== d.frames.length) {
      // tags
      const nameIn = U.el('input', { type: 'text', placeholder: 'ชื่อท่า เช่น idle' });
      const fromIn = U.el('input', { type: 'number', min: 1, max: d.frames.length, value: 1, title: 'จากเฟรม' });
      const toIn = U.el('input', { type: 'number', min: 1, max: d.frames.length, value: d.frames.length, title: 'ถึงเฟรม' });
      tl.tags.replaceChildren(
        U.el('span', { text: 'แท็ก (ท่า):' }),
        U.el('span', { class: 'tag' + (P.playTag < 0 ? ' on' : ''), onclick: () => { P.playTag = -1; UI.refreshTimeline(true); } }, 'ทุกเฟรม'),
        ...d.tags.map((t, i) => U.el('span', { class: 'tag' + (P.playTag === i ? ' on' : ''), style: `border-color:${TAG_COLORS[i % TAG_COLORS.length]}`, title: 'คลิกเพื่อเล่นเฉพาะช่วงนี้',
          onclick: () => { P.playTag = i; P.frames.go(t.from); UI.refreshTimeline(true); } }, [
          `${t.name} (${t.from + 1}–${t.to + 1})`,
          U.el('span', { style: 'color:var(--danger)', onclick: (e) => { e.stopPropagation(); if (P.playTag === i) P.playTag = -1; P.frames.delTag(i); } }, '×'),
        ])),
        nameIn, U.el('span', { text: 'เฟรม' }), fromIn, U.el('span', { text: '–' }), toIn,
        U.button('+ แท็ก', () => {
          const n = d.frames.length, a = PR.clamp(+fromIn.value || 1, 1, n) - 1, b = PR.clamp(+toIn.value || n, 1, n) - 1;
          P.frames.addTag((nameIn.value || '').trim().replace(/\s+/g, '_') || null, a, b);
        }),
      );
      // thumbnails
      tl.thumbs.replaceChildren(...d.frames.map((f, i) => {
        const h = 44, w = Math.max(16, Math.min(96, Math.round((h * d.w) / d.h)));
        const c = U.el('canvas', { width: w, height: h, style: `width:${w}px` });
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(P.flatten(1, i), 0, 0, w, h);
        const tagIdx = d.tags.findIndex((t) => i >= t.from && i <= t.to);
        return U.el('div', { class: 'thumb' + (i === d.frame ? ' on' : ''), onclick: () => P.frames.go(i), title: `เฟรม ${i + 1} · ${f.dur}ms` }, [
          c, `${i + 1} · ${f.dur}ms`,
          U.el('div', { class: 'tagbar', style: `background:${tagIdx >= 0 ? TAG_COLORS[tagIdx % TAG_COLORS.length] : 'transparent'}` }),
        ]);
      }));
    } else {
      [...tl.thumbs.children].forEach((el, i) => el.classList.toggle('on', i === d.frame));
    }
    const cur = tl.thumbs.children[d.frame];
    if (cur && P.playing) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  UI.scheduleTimeline = () => { clearTimeout(UI._tt); UI._tt = setTimeout(() => UI.refreshTimeline(true), 80); };

  // ---------- export / import ----------
  UI.animSheet = (name, scale, maxW) => {
    P.commitFloat();
    const d = P.doc, n = d.frames.length, cw = d.w * scale, ch = d.h * scale;
    const cols = Math.max(1, Math.min(n, Math.floor(maxW / cw))), rows = Math.ceil(n / cols);
    const sheet = document.createElement('canvas'); sheet.width = cols * cw; sheet.height = rows * ch;
    const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
    const tags = d.tags.length ? d.tags : [{ name: 'default', from: 0, to: n - 1 }];
    const frames = d.frames.map((f, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      g.drawImage(P.flatten(scale, i), x, y);
      const tag = tags.find((t) => i >= t.from && i <= t.to);
      return { name: `${name}_${String(i).padStart(2, '0')}`, anim: tag ? tag.name : 'frames', x, y, w: cw, h: ch, events: [], rootX: 0, fps: 1000 / f.dur, dur: f.dur };
    });
    const anims = tags.map((t) => ({ id: t.name, from: t.from, to: t.to, fps: +(1000 / d.frames[t.from].dur).toFixed(3), loop: true }));
    const pivot = d.target ? { x: d.target.px * scale, y: d.target.py * scale } : { x: cw / 2, y: ch };
    return { name, sheet, frames, anims, cw, ch, pivot };
  };
  UI.animCard = () => {
    const nameIn = U.el('input', { type: 'text', value: UI.animName || 'sprite', style: 'width:110px', oninput: () => (UI.animName = nameIn.value.replace(/[^\w-]/g, '_') || 'sprite') });
    const scaleSel = U.select([[1, '×1'], [2, '×2'], [3, '×3'], [4, '×4'], [8, '×8']], 1, () => {});
    const maxSel = U.select([[1024, 'กว้างสุด 1024 (Roblox)'], [2048, '2048'], [4096, '4096']], 1024, () => {});
    const cwIn = U.el('input', { type: 'number', value: 32, min: 1, max: 512, style: 'width:64px' });
    const chIn = U.el('input', { type: 'number', value: 32, min: 1, max: 512, style: 'width:64px' });
    const fileIn = U.el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const im = new Image();
      im.onload = () => { P.importSheet(im, PR.clamp(+cwIn.value, 1, 512), PR.clamp(+chIn.value, 1, 512)); UI.afterOpen(); UI.refreshTimeline(true); U.toast(`นำเข้า ${P.doc.frames.length} เฟรมแล้ว`); };
      im.src = URL.createObjectURL(f);
    } });
    const info = U.el('div', { class: 'note' });
    return U.card('อนิเมชันทีละเฟรม: ส่งออก / นำเข้า', [
      U.el('div', { class: 'btns' }, [U.el('span', { class: 'popt' }, ['ชื่อ ', nameIn]), U.el('span', { class: 'popt' }, ['ขยาย ', scaleSel]), maxSel]),
      U.el('div', { class: 'btns', style: 'margin-top:6px' }, [
        U.button('ส่งออก ZIP (Godot · Unity · Roblox)', async () => {
          const s = UI.animSheet(UI.animName || 'sprite', +scaleSel.value, +maxSel.value);
          info.textContent = `${s.frames.length} เฟรม · ${s.anims.length} ท่า · ชีต ${s.sheet.width}×${s.sheet.height}px` + (s.sheet.height > 1024 ? ' · สูงเกิน 1024px: Roblox จะย่อภาพ' : '');
          U.download(await PR.exportZip([s], { name: s.name, noProject: true }), s.name + '_frames.zip');
        }, 'pri'),
        U.button('สไปรต์ชีต PNG', () => { const s = UI.animSheet(UI.animName || 'sprite', +scaleSel.value, +maxSel.value); s.sheet.toBlob((b) => U.download(b, s.name + '_sheet.png')); }),
      ]),
      info,
      U.el('h4', { text: 'นำเข้าสไปรต์ชีต (ตัดเป็นเฟรม)' }),
      U.el('div', { class: 'btns' }, [U.el('span', { class: 'popt' }, ['ช่องละ ', cwIn, ' × ', chIn, ' px']), U.el('label', { class: 'btn' }, ['เลือกไฟล์ชีต', fileIn])]),
      U.el('div', { class: 'note', text: 'แท็กแต่ละอันจะเป็นหนึ่งท่าในไฟล์ส่งออก (Godot: หนึ่ง animation, Roblox: หนึ่งชื่อใน Animations) ถ้าไม่มีแท็กจะได้ท่าชื่อ default · เวลาแต่ละเฟรมส่งออกไปด้วย · ปุ่มลัด , . เฟรมก่อน/ถัดไป · P เล่น/หยุด · Shift+N เฟรมว่าง · Shift+D ทำสำเนาเฟรม' }),
    ]);
  };

  // ---------- hooks into the editor ----------
  const origBuild = UI.buildPanel;
  UI.buildPanel = () => { origBuild(); UI.panel.append(UI.animCard()); };
  const origWorkspace = UI.buildWorkspace;
  UI.buildWorkspace = () => {
    const first = !UI.built;
    origWorkspace();
    if (!first) return;
    const onChange = P.onChange;
    P.onChange = () => { onChange && onChange(); UI.scheduleTimeline(); };
    P.onFrame = () => UI.refreshTimeline(false);
    UI.buildTimeline();
  };
  const origAfterOpen = UI.afterOpen;
  UI.afterOpen = () => { origAfterOpen(); P.playTag = -1; UI.refreshTimeline(true); };
  const origFrame = UI.frame;
  UI.frame = (dt) => { P.tick(dt * 1000); origFrame(dt); };
  // frame shortcuts run before the tool shortcuts (registered first)
  addEventListener('keydown', (e) => {
    if (!PR.app || PR.app.mode !== 'paint' || !P.doc || /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (k === ',') P.frames.go(P.doc.frame - 1);
    else if (k === '.') P.frames.go(P.doc.frame + 1);
    else if (k === 'p') UI.togglePlay();
    else if (e.shiftKey && k === 'n') P.frames.add(false);
    else if (e.shiftKey && k === 'd') P.frames.add(true);
    else handled = false;
    if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
  });
})();
