'use strict';
// Pixel editor core: document + layers, tools (pixel-perfect pencil, eraser, fill, line, rect, ellipse,
// picker, select, move, shade, dither), symmetry, undo/redo, view (zoom/pan/grid), flatten.
// Colors are [r, g, b, a] arrays. Layer 0 is the bottom layer.
(() => {
  const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const P = (PR.paint = {
    doc: null, tool: 'pencil', size: 1, round: false, primary: [26, 18, 34, 255], secondary: [0, 0, 0, 0],
    pixelPerfect: true, filled: false, contiguous: true, mirrorX: false, mirrorY: false,
    zoom: 8, ox: 0, oy: 0, grid: true, refOn: true, refAlpha: 0.35, undo: [], redo: [],
    sel: null, float: null, clip: null, hover: null, stroke: null, onChange: null, onStatus: null, needs: true,
    palette: [],
  });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  P.hex = (c) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
  P.rgba = (hex, a = 255) => { const [r, g, b] = PR.hexToRgb(hex); return [r, g, b, a]; };
  const same = (d, i, c) => d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2] && d[i + 3] === c[3];

  // ---------- document ----------
  P.layer = (name, data) => ({ name, visible: true, locked: false, data: data || new Uint8ClampedArray(P.doc.w * P.doc.h * 4), cv: mk(P.doc.w, P.doc.h), dirty: true });
  // Animation: doc.frames[f].cels[layerIndex] holds the pixels; layer.data always points at the cel of the current frame,
  // so every tool edits the current frame directly. Tags name frame ranges (one tag = one animation on export).
  P.newDoc = (w, h, opt = {}) => {
    P.doc = { w, h, layers: [], frames: [], frame: 0, tags: [], active: 0, ref: opt.ref || null, target: opt.target || null };
    const l = P.layer('เลเยอร์ 1');
    P.doc.layers.push(l);
    P.doc.frames.push({ dur: 100, cels: [l.data] });
    P.undo = []; P.redo = []; P.sel = null; P.float = null; P.playing = false;
    P.fit(); P.changed(false);
  };
  P.active = () => P.doc.layers[P.doc.active];
  P.bindFrame = (f) => {
    const d = P.doc;
    d.frame = PR.clamp(f, 0, d.frames.length - 1);
    d.layers.forEach((l, i) => { l.data = d.frames[d.frame].cels[i]; l.dirty = true; });
    P.needs = true;
  };
  P.blank = () => new Uint8ClampedArray(P.doc.w * P.doc.h * 4);
  P.snapshot = () => ({ w: P.doc.w, h: P.doc.h, active: P.doc.active, frame: P.doc.frame, target: P.doc.target && PR.clone(P.doc.target), tags: PR.clone(P.doc.tags),
    layers: P.doc.layers.map((l) => ({ name: l.name, visible: l.visible, locked: l.locked })),
    frames: P.doc.frames.map((f) => ({ dur: f.dur, cels: f.cels.map((c) => c.slice()) })) });
  P.restore = (s) => {
    const d = P.doc; d.w = s.w; d.h = s.h; d.active = s.active; d.tags = s.tags || []; if (s.target) d.target = s.target;
    d.layers = s.layers.map((l) => Object.assign(P.layer(l.name, P.blank()), { visible: l.visible, locked: l.locked }));
    d.frames = s.frames.map((f) => ({ dur: f.dur, cels: f.cels.map((c) => c.slice()) }));
    P.sel = null; P.float = null;
    P.bindFrame(s.frame || 0);
  };
  P.pushUndo = () => {
    const d = P.doc, bytes = d.frames.length * d.layers.length * d.w * d.h * 4;
    const max = PR.clamp(Math.floor((64 * 1024 * 1024) / Math.max(1, bytes)), 10, 120);   // keep undo memory bounded
    P.undo.push(P.snapshot());
    while (P.undo.length > max) P.undo.shift();
    P.redo = [];
  };
  P.doUndo = () => { if (!P.undo.length) return; P.redo.push(P.snapshot()); P.restore(P.undo.pop()); P.changed(); };
  P.doRedo = () => { if (!P.redo.length) return; P.undo.push(P.snapshot()); P.restore(P.redo.pop()); P.changed(); };
  P.changed = (notify = true) => { for (const l of P.doc.layers) l.dirty = true; P.needs = true; if (notify && P.onChange) P.onChange(); };

  // composite of one frame (default: current)
  P.flatten = (scale = 1, fi = P.doc.frame) => {
    const d = P.doc, c = mk(d.w * scale, d.h * scale), g = c.getContext('2d'), tmp = mk(d.w, d.h), tg = tmp.getContext('2d');
    g.imageSmoothingEnabled = false;
    d.layers.forEach((l, i) => {
      if (!l.visible) return;
      if (fi === d.frame) { P.syncLayer(l); g.drawImage(l.cv, 0, 0, d.w * scale, d.h * scale); return; }
      tg.putImageData(new ImageData(d.frames[fi].cels[i], d.w, d.h), 0, 0);
      g.drawImage(tmp, 0, 0, d.w * scale, d.h * scale);
    });
    return c;
  };
  // every cel of every frame (canvas-wide operations)
  P.eachCel = (fn) => { for (const f of P.doc.frames) for (let i = 0; i < f.cels.length; i++) f.cels[i] = fn(f.cels[i], i, f) || f.cels[i]; };

  // ---------- frames ----------
  P.frames = {
    add(copy) {
      P.commitFloat(); P.pushUndo();
      const d = P.doc, src = d.frames[d.frame];
      d.frames.splice(d.frame + 1, 0, { dur: src.dur, cels: src.cels.map((c) => (copy ? c.slice() : P.blank())) });
      for (const t of d.tags) { if (t.from > d.frame) t.from++; if (t.to > d.frame) t.to++; }
      P.bindFrame(d.frame + 1); P.changed();
    },
    del() {
      const d = P.doc; if (d.frames.length < 2) return;
      P.commitFloat(); P.pushUndo();
      d.frames.splice(d.frame, 1);
      for (const t of d.tags) { if (t.from > d.frame) t.from--; if (t.to >= d.frame) t.to--; }
      d.tags = d.tags.filter((t) => t.to >= t.from);
      P.bindFrame(Math.min(d.frame, d.frames.length - 1)); P.changed();
    },
    move(dir) {
      const d = P.doc, j = d.frame + dir;
      if (j < 0 || j >= d.frames.length) return;
      P.commitFloat(); P.pushUndo();
      [d.frames[d.frame], d.frames[j]] = [d.frames[j], d.frames[d.frame]];
      P.bindFrame(j); P.changed();
    },
    go(i) { P.commitFloat(); P.bindFrame(((i % P.doc.frames.length) + P.doc.frames.length) % P.doc.frames.length); if (P.onFrame) P.onFrame(); },
    setDur(ms, all) { P.pushUndo(); for (const [i, f] of P.doc.frames.entries()) if (all || i === P.doc.frame) f.dur = PR.clamp(Math.round(ms), 10, 10000); P.changed(); },
    addTag(name, from, to) { P.pushUndo(); P.doc.tags.push({ name: name || 'anim' + (P.doc.tags.length + 1), from: Math.min(from, to), to: Math.max(from, to) }); P.changed(); },
    delTag(i) { P.pushUndo(); P.doc.tags.splice(i, 1); P.changed(); },
  };
  // playback (called every animation frame with elapsed ms)
  P.playing = false; P.pingpong = false; P.playTag = -1; P.onion = true; P._acc = 0; P._dir = 1;
  P.tick = (ms) => {
    const d = P.doc;
    if (!P.playing || !d || d.frames.length < 2) return;
    const t = d.tags[P.playTag], from = t ? t.from : 0, to = t ? t.to : d.frames.length - 1;
    if (d.frame < from || d.frame > to) { P.bindFrame(from); P._acc = 0; }
    P._acc += ms;
    let changed = false;
    while (P._acc >= d.frames[d.frame].dur) {
      P._acc -= d.frames[d.frame].dur;
      let n = d.frame + P._dir;
      if (n > to || n < from) {
        if (P.pingpong && to > from) { P._dir = -P._dir; n = d.frame + P._dir; } else n = P._dir > 0 ? from : to;
      }
      d.frame = n; changed = true;
    }
    if (changed) { P.bindFrame(d.frame); if (P.onFrame) P.onFrame(); }
  };
  // split a sprite sheet into frames (row by row, empty trailing cells dropped)
  P.importSheet = (img, cw, ch) => {
    const cols = Math.max(1, Math.floor(img.naturalWidth / cw)), rows = Math.max(1, Math.floor(img.naturalHeight / ch));
    const c = mk(cw, ch), g = c.getContext('2d', { willReadFrequently: true });
    const cels = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      g.clearRect(0, 0, cw, ch); g.drawImage(img, k * cw, r * ch, cw, ch, 0, 0, cw, ch);
      const data = new Uint8ClampedArray(g.getImageData(0, 0, cw, ch).data);
      for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 128 ? 0 : 255;
      cels.push(data);
    }
    while (cels.length > 1 && !cels[cels.length - 1].some((v, i) => i % 4 === 3 && v)) cels.pop();
    P.newDoc(cw, ch);
    P.doc.frames = cels.map((data) => ({ dur: 100, cels: [data] }));
    P.bindFrame(0); P.changed(false);
  };
  P.syncLayer = (l) => { if (!l.dirty) return; l.cv.getContext('2d').putImageData(new ImageData(l.data, P.doc.w, P.doc.h), 0, 0); l.dirty = false; };
  P.colorAt = (x, y, composite) => {
    const d = P.doc;
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) return null;
    const i = (y * d.w + x) * 4;
    if (!composite) { const a = P.active().data; return [a[i], a[i + 1], a[i + 2], a[i + 3]]; }
    for (let k = d.layers.length - 1; k >= 0; k--) { const l = d.layers[k]; if (l.visible && l.data[i + 3] > 0) return [l.data[i], l.data[i + 1], l.data[i + 2], l.data[i + 3]]; }
    return [0, 0, 0, 0];
  };
  P.loadImage = (img, asNewLayer) => {   // img: canvas or HTMLImageElement, drawn at 0,0
    const d = P.doc, c = mk(d.w, d.h), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, d.w, d.h).data;
    for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 128 ? 0 : 255;   // pixel art is opaque or empty
    if (asNewLayer) {   // new layer in every frame; the image goes into the current frame
      d.layers.push(P.layer('รูปที่นำเข้า'));
      d.frames.forEach((f, fi) => f.cels.push(fi === d.frame ? new Uint8ClampedArray(data) : P.blank()));
      d.active = d.layers.length - 1; P.bindFrame(d.frame);
    } else P.active().data.set(data);
  };

  // ---------- plotting ----------
  P.brushOffsets = () => {
    const s = P.size, o = [], r = (s - 1) / 2;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      if (P.round && s > 2 && Math.hypot(dx - r, dy - r) > s / 2) continue;
      o.push([dx - Math.floor((s - 1) / 2), dy - Math.floor((s - 1) / 2)]);
    }
    return o;
  };
  const mirrors = (x, y) => {
    const d = P.doc, pts = [[x, y]];
    if (P.mirrorX) pts.push([d.w - 1 - x, y]);
    if (P.mirrorY) pts.push([x, d.h - 1 - y]);
    if (P.mirrorX && P.mirrorY) pts.push([d.w - 1 - x, d.h - 1 - y]);
    return pts;
  };
  // put one brush dab (with symmetry) into data; fn(i, x, y) decides what to write
  P.dab = (data, x, y, fn, brush = true) => {
    const d = P.doc, offs = brush ? P.brushOffsets() : [[0, 0]];
    for (const [mx, my] of mirrors(x, y)) for (const [ox, oy] of offs) {
      const px = mx + ox, py = my + oy;
      if (px < 0 || py < 0 || px >= d.w || py >= d.h) continue;
      if (P.sel && !(px >= P.sel.x && py >= P.sel.y && px < P.sel.x + P.sel.w && py < P.sel.y + P.sel.h)) continue;
      fn((py * d.w + px) * 4, px, py);
    }
  };
  P.line = (x0, y0, x1, y1, cb) => {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      cb(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  // Zingl's ellipse in a bounding box (handles even and odd sizes)
  P.ellipse = (x0, y0, x1, y1, cb) => {
    let a = Math.abs(x1 - x0), b = Math.abs(y1 - y0), b1 = b & 1;
    let dx = 4 * (1 - a) * b * b, dy = 4 * (b1 + 1) * a * a, err = dx + dy + b1 * a * a, e2;
    if (x0 > x1) { x0 = x1; x1 += a; }
    if (y0 > y1) y0 = y1;
    y0 += (b + 1) >> 1; y1 = y0 - b1;
    a *= 8 * a; b1 = 8 * b * b;
    do {
      cb(x1, y0); cb(x0, y0); cb(x0, y1); cb(x1, y1);
      e2 = 2 * err;
      if (e2 <= dy) { y0++; y1--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }
    } while (x0 <= x1);
    while (y0 - y1 < b) { cb(x0 - 1, y0); cb(x1 + 1, y0++); cb(x0 - 1, y1); cb(x1 + 1, y1--); }
  };
  P.shapePoints = (tool, a, b, filled) => {
    const pts = [];
    const push = (x, y) => pts.push([x, y]);
    if (tool === 'line') P.line(a[0], a[1], b[0], b[1], push);
    else if (tool === 'rect') {
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (filled || x === x0 || x === x1 || y === y0 || y === y1) push(x, y);
    } else if (tool === 'ellipse') {
      P.ellipse(a[0], a[1], b[0], b[1], push);
      if (filled) {   // fill spans between the outline points of each row
        const rows = {};
        for (const [x, y] of pts) { const r = (rows[y] = rows[y] || [x, x]); r[0] = Math.min(r[0], x); r[1] = Math.max(r[1], x); }
        for (const y in rows) for (let x = rows[y][0]; x <= rows[y][1]; x++) push(x, +y);
      }
    }
    return pts;
  };
  const constrain = (tool, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (tool === 'line') {   // snap to 0/45/90 degrees
      if (Math.abs(dx) > 2 * Math.abs(dy)) return [b[0], a[1]];
      if (Math.abs(dy) > 2 * Math.abs(dx)) return [a[0], b[1]];
      const m = Math.max(Math.abs(dx), Math.abs(dy)); return [a[0] + Math.sign(dx) * m, a[1] + Math.sign(dy) * m];
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy)); return [a[0] + Math.sign(dx || 1) * m, a[1] + Math.sign(dy || 1) * m];
  };

  // ---------- fill ----------
  P.fill = (x, y, c) => {
    const d = P.doc, data = P.active().data, i0 = (y * d.w + x) * 4;
    const t = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]];
    if (t[0] === c[0] && t[1] === c[1] && t[2] === c[2] && t[3] === c[3]) return;
    const inSel = (px, py) => !P.sel || (px >= P.sel.x && py >= P.sel.y && px < P.sel.x + P.sel.w && py < P.sel.y + P.sel.h);
    if (!P.contiguous) {
      for (let py = 0; py < d.h; py++) for (let px = 0; px < d.w; px++) { const i = (py * d.w + px) * 4; if (inSel(px, py) && same(data, i, t)) data.set(c, i); }
      return;
    }
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= d.w || py >= d.h || !inSel(px, py)) continue;
      const i = (py * d.w + px) * 4;
      if (!same(data, i, t)) continue;
      data.set(c, i);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  };

  // ---------- shading along palette ramps ----------
  P.shadeColor = (c, dir) => {
    for (const ramp of P.palette) {
      const i = ramp.findIndex((h) => { const r = P.rgba(h); return r[0] === c[0] && r[1] === c[1] && r[2] === c[2]; });
      if (i >= 0) { const j = PR.clamp(i + dir, 0, ramp.length - 1); return P.rgba(ramp[j], c[3]); }
    }
    return null;
  };

  // ---------- selection / move / clipboard ----------
  P.extract = (sel, cut) => {
    const d = P.doc, data = P.active().data, out = new Uint8ClampedArray(sel.w * sel.h * 4);
    for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) {
      const sx = sel.x + x, sy = sel.y + y;
      if (sx < 0 || sy < 0 || sx >= d.w || sy >= d.h) continue;
      const i = (sy * d.w + sx) * 4, o = (y * sel.w + x) * 4;
      out.set(data.subarray(i, i + 4), o);
      if (cut) data.set([0, 0, 0, 0], i);
    }
    return { w: sel.w, h: sel.h, data: out, x: sel.x, y: sel.y };
  };
  P.stamp = (f) => {
    const d = P.doc, data = P.active().data;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const tx = f.x + x, ty = f.y + y, o = (y * f.w + x) * 4;
      if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h || f.data[o + 3] === 0) continue;
      data.set(f.data.subarray(o, o + 4), (ty * d.w + tx) * 4);
    }
  };
  P.commitFloat = () => {
    if (!P.float) return;
    P.stamp(P.float);
    P.sel = { x: P.float.x, y: P.float.y, w: P.float.w, h: P.float.h };
    P.float = null; P.changed();
  };
  P.copy = () => { if (P.sel) P.clip = P.extract(P.sel, false); };
  P.paste = () => {
    if (!P.clip) return;
    P.commitFloat(); P.pushUndo();
    P.float = Object.assign({}, P.clip, { data: P.clip.data.slice(), x: P.sel ? P.sel.x : 0, y: P.sel ? P.sel.y : 0 });
    P.sel = { x: P.float.x, y: P.float.y, w: P.float.w, h: P.float.h }; P.tool = 'move'; P.needs = true;
  };
  P.deleteSel = () => { if (!P.sel) return; P.pushUndo(); P.extract(P.sel, true); P.changed(); };

  // ---------- commands ----------
  P.cmd = {
    // canvas-wide operations touch every cel of every frame
    flipH() { P.commitFloat(); P.pushUndo(); P.eachCel((c) => P.transformData(c, (x, y, w) => [w - 1 - x, y])); P.bindFrame(P.doc.frame); P.changed(); },
    flipV() { P.commitFloat(); P.pushUndo(); P.eachCel((c) => P.transformData(c, (x, y, w, h) => [x, h - 1 - y])); P.bindFrame(P.doc.frame); P.changed(); },
    rotate() {   // 90 degrees clockwise, canvas size swaps
      P.commitFloat(); P.pushUndo();
      const d = P.doc, W = d.w, H = d.h;
      P.eachCel((c) => {
        const out = new Uint8ClampedArray(W * H * 4);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.set(c.subarray((y * W + x) * 4, (y * W + x) * 4 + 4), (x * H + (H - 1 - y)) * 4);
        return out;
      });
      d.w = H; d.h = W;
      for (const l of d.layers) l.cv = mk(d.w, d.h);
      if (d.target) { const px = d.target.px; d.target.px = H - d.target.py; d.target.py = px; d.target.rot = (d.target.rot || 0) + 90; }
      P.sel = null; P.bindFrame(d.frame); P.fit(); P.changed();
    },
    outline(c, diag) {   // 1px outline outside the shape on the active layer, current frame
      P.pushUndo();
      const d = P.doc, src = P.active().data.slice(), data = P.active().data;
      const nb = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
        const i = (y * d.w + x) * 4;
        if (src[i + 3]) continue;
        if (nb.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < d.w && ny < d.h && src[(ny * d.w + nx) * 4 + 3]; })) data.set(c, i);
      }
      P.changed();
    },
    resize(w, h) {   // keep content centered, shift the pivot with it
      P.commitFloat(); P.pushUndo();
      const d = P.doc, dx = Math.floor((w - d.w) / 2), dy = Math.floor((h - d.h) / 2), W = d.w, H = d.h;
      P.eachCel((c) => {
        const out = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const tx = x + dx, ty = y + dy;
          if (tx >= 0 && ty >= 0 && tx < w && ty < h) out.set(c.subarray((y * W + x) * 4, (y * W + x) * 4 + 4), (ty * w + tx) * 4);
        }
        return out;
      });
      if (d.target) { d.target.px += dx; d.target.py += dy; d.refX = (d.refX || 0) + dx; d.refY = (d.refY || 0) + dy; }
      d.w = w; d.h = h;
      for (const l of d.layers) l.cv = mk(w, h);
      P.sel = null; P.bindFrame(d.frame); P.fit(); P.changed();
    },
    clear() { P.pushUndo(); if (P.sel) P.extract(P.sel, true); else P.active().data.fill(0); P.changed(); },
    // layer operations apply to the layer's cel in every frame
    addLayer() {
      P.commitFloat(); P.pushUndo();
      const d = P.doc, at = d.active + 1;
      d.layers.splice(at, 0, P.layer('เลเยอร์ ' + (d.layers.length + 1)));
      for (const f of d.frames) f.cels.splice(at, 0, P.blank());
      d.active = at; P.bindFrame(d.frame); P.changed();
    },
    dupLayer() {
      P.commitFloat(); P.pushUndo();
      const d = P.doc, at = d.active + 1, l = P.active();
      d.layers.splice(at, 0, P.layer(l.name + ' (สำเนา)'));
      for (const f of d.frames) f.cels.splice(at, 0, f.cels[d.active].slice());
      d.active = at; P.bindFrame(d.frame); P.changed();
    },
    delLayer() {
      const d = P.doc; if (d.layers.length < 2) return;
      P.commitFloat(); P.pushUndo();
      d.layers.splice(d.active, 1);
      for (const f of d.frames) f.cels.splice(d.active, 1);
      d.active = Math.max(0, d.active - 1); P.bindFrame(d.frame); P.changed();
    },
    moveLayer(dir) {
      const d = P.doc, j = d.active + dir;
      if (j < 0 || j >= d.layers.length) return;
      P.commitFloat(); P.pushUndo();
      [d.layers[d.active], d.layers[j]] = [d.layers[j], d.layers[d.active]];
      for (const f of d.frames) [f.cels[d.active], f.cels[j]] = [f.cels[j], f.cels[d.active]];
      d.active = j; P.bindFrame(d.frame); P.changed();
    },
    mergeDown() {
      const d = P.doc; if (d.active < 1) return;
      P.commitFloat(); P.pushUndo();
      for (const f of d.frames) {
        const top = f.cels[d.active], bot = f.cels[d.active - 1];
        for (let i = 0; i < top.length; i += 4) if (top[i + 3]) bot.set(top.subarray(i, i + 4), i);
        f.cels.splice(d.active, 1);
      }
      d.layers.splice(d.active, 1); d.active--; P.bindFrame(d.frame); P.changed();
    },
  };
  P.transformData = (data, fn) => {
    const d = P.doc, out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const [tx, ty] = fn(x, y, d.w, d.h);
      out.set(data.subarray((y * d.w + x) * 4, (y * d.w + x) * 4 + 4), (ty * d.w + tx) * 4);
    }
    return out;
  };

  // ---------- view ----------
  P.attach = (canvas) => { P.canvas = canvas; P.ctx = canvas.getContext('2d'); P.bindInput(canvas); };
  P.fit = () => {
    if (!P.canvas || !P.doc) return;
    const W = P.canvas.width, H = P.canvas.height;
    let z = 1;
    for (const s of ZOOMS) if (P.doc.w * s <= W * 0.85 && P.doc.h * s <= H * 0.85) z = s;
    P.zoom = z; P.ox = Math.round((W - P.doc.w * z) / 2); P.oy = Math.round((H - P.doc.h * z) / 2); P.needs = true;
  };
  P.zoomAt = (dir, mx, my) => {
    const i = ZOOMS.indexOf(P.zoom), nz = ZOOMS[PR.clamp((i < 0 ? 5 : i) + dir, 0, ZOOMS.length - 1)];
    if (mx == null) { mx = P.canvas.width / 2; my = P.canvas.height / 2; }
    P.ox = Math.round(mx - ((mx - P.ox) * nz) / P.zoom); P.oy = Math.round(my - ((my - P.oy) * nz) / P.zoom);
    P.zoom = nz; P.needs = true;
  };
  P.render = () => {
    if (!P.canvas || !P.doc || !P.needs) return;
    P.needs = false;
    const g = P.ctx, d = P.doc, z = P.zoom, W = P.canvas.width, H = P.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#120d20'; g.fillRect(0, 0, W, H);
    // checkerboard behind the canvas
    const x0 = P.ox, y0 = P.oy, cw = d.w * z, ch = d.h * z, cs = 8;
    g.save(); g.beginPath(); g.rect(x0, y0, cw, ch); g.clip();
    for (let y = 0; y < ch; y += cs) for (let x = 0; x < cw; x += cs) { g.fillStyle = ((x + y) / cs) % 2 ? '#3a3352' : '#2b2540'; g.fillRect(x0 + x, y0 + y, cs, cs); }
    g.restore();
    // reference (built-in part) under the layers
    if (d.ref && P.refOn) { g.globalAlpha = P.refAlpha; g.drawImage(d.ref, x0 + (d.refX || 0) * z, y0 + (d.refY || 0) * z, d.ref.width * z, d.ref.height * z); g.globalAlpha = 1; }
    // onion skin: previous frame tinted red, next frame tinted blue
    if (P.onion && d.frames.length > 1 && !P.playing) {
      for (const [fi, col] of [[d.frame - 1, '255,70,90'], [d.frame + 1, '70,150,255']]) {
        if (fi < 0 || fi >= d.frames.length) continue;
        const oc = P.flatten(1, fi), og = oc.getContext('2d');
        og.globalCompositeOperation = 'source-atop'; og.fillStyle = `rgba(${col},0.6)`; og.fillRect(0, 0, oc.width, oc.height);
        g.globalAlpha = 0.32; g.drawImage(oc, x0, y0, cw, ch); g.globalAlpha = 1;
      }
    }
    for (const l of d.layers) { if (!l.visible) continue; P.syncLayer(l); g.drawImage(l.cv, x0, y0, cw, ch); }
    if (P.float) {
      const fc = mk(P.float.w, P.float.h); fc.getContext('2d').putImageData(new ImageData(P.float.data, P.float.w, P.float.h), 0, 0);
      g.drawImage(fc, x0 + P.float.x * z, y0 + P.float.y * z, P.float.w * z, P.float.h * z);
    }
    // pixel grid
    if (P.grid && z >= 6) {
      g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= d.w; x++) { g.moveTo(x0 + x * z + 0.5, y0); g.lineTo(x0 + x * z + 0.5, y0 + ch); }
      for (let y = 0; y <= d.h; y++) { g.moveTo(x0, y0 + y * z + 0.5); g.lineTo(x0 + cw, y0 + y * z + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.beginPath();
      for (let x = 0; x <= d.w; x += 8) { g.moveTo(x0 + x * z + 0.5, y0); g.lineTo(x0 + x * z + 0.5, y0 + ch); }
      for (let y = 0; y <= d.h; y += 8) { g.moveTo(x0, y0 + y * z + 0.5); g.lineTo(x0 + cw, y0 + y * z + 0.5); }
      g.stroke();
    }
    g.strokeStyle = '#5a4a8a'; g.strokeRect(x0 - 0.5, y0 - 0.5, cw + 1, ch + 1);
    // symmetry axes
    g.strokeStyle = 'rgba(79,208,255,0.6)'; g.setLineDash([4, 4]);
    if (P.mirrorX) { g.beginPath(); g.moveTo(x0 + cw / 2, y0); g.lineTo(x0 + cw / 2, y0 + ch); g.stroke(); }
    if (P.mirrorY) { g.beginPath(); g.moveTo(x0, y0 + ch / 2); g.lineTo(x0 + cw, y0 + ch / 2); g.stroke(); }
    g.setLineDash([]);
    // bone pivot and direction (when drawing a character part)
    if (d.target) {
      const px = x0 + d.target.px * z, py = y0 + d.target.py * z, tip = d.target.tip || [0, 0];
      const a = ((d.target.rot || 0) * Math.PI) / 180, tx = tip[0] * Math.cos(a) - tip[1] * Math.sin(a), ty = tip[0] * Math.sin(a) + tip[1] * Math.cos(a);
      g.strokeStyle = 'rgba(255,77,109,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + tx * d.target.R * z, py + ty * d.target.R * z); g.stroke();
      g.beginPath(); g.arc(px, py, Math.max(3, z * 0.4), 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
    }
    // selection (marching ants)
    const sel = P.float ? { x: P.float.x, y: P.float.y, w: P.float.w, h: P.float.h } : P.sel;
    if (sel) {
      g.lineDashOffset = -(performance.now() / 60) % 8; g.setLineDash([4, 4]);
      g.strokeStyle = '#ffffff'; g.strokeRect(x0 + sel.x * z + 0.5, y0 + sel.y * z + 0.5, sel.w * z - 1, sel.h * z - 1);
      g.strokeStyle = '#000000'; g.lineDashOffset += 4; g.strokeRect(x0 + sel.x * z + 0.5, y0 + sel.y * z + 0.5, sel.w * z - 1, sel.h * z - 1);
      g.setLineDash([]); P.needs = true;   // keep the ants moving
    }
    // brush preview
    if (P.hover && ['pencil', 'eraser', 'dither', 'shade'].includes(P.tool)) {
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      for (const [mx, my] of mirrors(P.hover[0], P.hover[1])) for (const [ox, oy] of P.brushOffsets()) g.strokeRect(x0 + (mx + ox) * z + 0.5, y0 + (my + oy) * z + 0.5, z - 1, z - 1);
    }
  };

  // ---------- input ----------
  P.toPixel = (e) => {
    const r = P.canvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) * P.canvas.width) / r.width, my = ((e.clientY - r.top) * P.canvas.height) / r.height;
    return { mx, my, x: Math.floor((mx - P.ox) / P.zoom), y: Math.floor((my - P.oy) / P.zoom) };
  };
  P.bindInput = (cv) => {
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = P.toPixel(e); P.zoomAt(e.deltaY < 0 ? 1 : -1, p.mx, p.my); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); P.down(e); });
    cv.addEventListener('pointermove', (e) => P.move(e));
    cv.addEventListener('pointerup', (e) => P.up(e));
    cv.addEventListener('pointerleave', () => { P.hover = null; P.needs = true; });
  };
  P.down = (e) => {
    const p = P.toPixel(e), d = P.doc;
    if (e.button === 1 || P.spaceDown) { P.stroke = { pan: true, mx: p.mx, my: p.my, ox: P.ox, oy: P.oy }; return; }
    const tool = e.altKey ? 'picker' : P.tool, right = e.button === 2;
    const color = right ? P.secondary : P.primary;
    const l = P.active();
    if (tool === 'picker') { const c = P.colorAt(p.x, p.y, true); if (c) { if (right) P.secondary = c; else P.primary = c; P.onStatus && P.onStatus('color'); } return; }
    if (tool === 'select') { P.commitFloat(); P.stroke = { tool, start: [p.x, p.y] }; P.sel = null; return; }
    if (tool === 'move') {
      if (l.locked) return;
      if (!P.float) {
        P.pushUndo();
        if (P.sel) P.float = P.extract(P.sel, true);
        else { P.float = P.extract({ x: 0, y: 0, w: d.w, h: d.h }, true); }
        l.dirty = true;
      }
      P.stroke = { tool, start: [p.x, p.y], fx: P.float.x, fy: P.float.y }; P.needs = true; return;
    }
    if (l.locked || !l.visible) { P.onStatus && P.onStatus('locked'); return; }
    P.commitFloat();
    P.pushUndo();
    if (tool === 'fill') { if (p.x >= 0 && p.y >= 0 && p.x < d.w && p.y < d.h) { P.fill(p.x, p.y, tool === 'fill' && right ? P.secondary : color); P.changed(); } return; }
    P.stroke = { tool, right, color, base: l.data.slice(), start: [p.x, p.y], last: [p.x, p.y], path: [[p.x, p.y]], visited: new Set() };
    if (['pencil', 'eraser', 'dither', 'shade'].includes(tool)) P.paintAt(p.x, p.y);
    else P.previewShape(p.x, p.y, e.shiftKey);
    l.dirty = true; P.needs = true;
  };
  P.paintAt = (x, y) => {
    const s = P.stroke, data = P.active().data;
    const c = s.tool === 'eraser' ? [0, 0, 0, 0] : s.color;
    P.dab(data, x, y, (i, px, py) => {
      if (s.tool === 'dither') { if ((px + py) % 2 === 0) data.set(c, i); return; }
      if (s.tool === 'shade') {
        const key = px + ',' + py; if (s.visited.has(key) || !data[i + 3]) return;
        s.visited.add(key);
        const nc = P.shadeColor([data[i], data[i + 1], data[i + 2], data[i + 3]], s.right ? -1 : 1);
        if (nc) data.set(nc, i);
        return;
      }
      data.set(c, i);
    });
  };
  // pixel-perfect: drop the corner pixel of an L made by three consecutive 1px points
  const restorePoint = (x, y) => {
    const s = P.stroke, data = P.active().data;
    P.dab(data, x, y, (i) => data.set(s.base.subarray(i, i + 4), i), false);
  };
  P.previewShape = (x, y, shift) => {
    const s = P.stroke, data = P.active().data;
    data.set(s.base);
    let b = [x, y];
    if (shift) b = constrain(s.tool, s.start, b);
    const c = s.color;
    for (const [px, py] of P.shapePoints(s.tool, s.start, b, P.filled)) P.dab(data, px, py, (i) => data.set(c, i), s.tool !== 'rect' || !P.filled);
  };
  P.move = (e) => {
    const p = P.toPixel(e), s = P.stroke;
    const nh = [p.x, p.y];
    if (!P.hover || P.hover[0] !== nh[0] || P.hover[1] !== nh[1]) { P.hover = nh; P.needs = true; P.onStatus && P.onStatus('hover', p); }
    if (!s) return;
    if (s.pan) { P.ox = s.ox + (p.mx - s.mx); P.oy = s.oy + (p.my - s.my); P.needs = true; return; }
    if (s.tool === 'select') {
      const x0 = Math.min(s.start[0], p.x), y0 = Math.min(s.start[1], p.y);
      P.sel = { x: x0, y: y0, w: Math.abs(p.x - s.start[0]) + 1, h: Math.abs(p.y - s.start[1]) + 1 }; P.needs = true; return;
    }
    if (s.tool === 'move') { P.float.x = s.fx + p.x - s.start[0]; P.float.y = s.fy + p.y - s.start[1]; P.needs = true; return; }
    if (['pencil', 'eraser', 'dither', 'shade'].includes(s.tool)) {
      if (p.x === s.last[0] && p.y === s.last[1]) return;
      P.line(s.last[0], s.last[1], p.x, p.y, (x, y) => {
        const path = s.path, prev = path[path.length - 1];
        if (prev && prev[0] === x && prev[1] === y) return;
        path.push([x, y]);
        if (P.pixelPerfect && P.size === 1 && (s.tool === 'pencil' || s.tool === 'eraser') && path.length >= 3) {
          const [a, b, c] = path.slice(-3);
          if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 && (b[0] === a[0] || b[1] === a[1]) && (b[0] === c[0] || b[1] === c[1])) {
            restorePoint(b[0], b[1]); path.splice(path.length - 2, 1);
          }
        }
        P.paintAt(x, y);
      });
      s.last = [p.x, p.y];
    } else P.previewShape(p.x, p.y, e.shiftKey);
    P.active().dirty = true; P.needs = true;
  };
  P.up = () => {
    const s = P.stroke;
    P.stroke = null;
    if (!s || s.pan) return;
    if (s.tool === 'select') { if (P.sel && P.sel.w * P.sel.h <= 1) P.sel = null; P.needs = true; return; }
    if (s.tool === 'move') { P.needs = true; if (P.onChange) P.onChange(); return; }
    P.changed();
  };

  // ---------- palettes ----------
  // hue-shifted ramp: darker steps lean toward blue/purple, lighter steps toward yellow (classic pixel-art shading)
  P.ramp = (hex, steps = 5) => {
    const [r, g, b] = PR.hexToRgb(hex);
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, dd = mx - mn;
    let h = 0, s = 0;
    if (dd) {
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      const R = r / 255, G = g / 255, B = b / 255;
      h = mx === R ? (G - B) / dd + (G < B ? 6 : 0) : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4;
      h *= 60;
    }
    const out = [], mid = (steps - 1) / 2;
    for (let i = 0; i < steps; i++) {
      const k = (i - mid) / Math.max(1, mid);   // -1 dark .. +1 light
      const towards = k < 0 ? 250 : 55;          // shadows -> blue/violet, highlights -> yellow
      let dh = ((towards - h + 540) % 360) - 180;
      const nh = (h + dh * Math.abs(k) * 0.22 + 360) % 360;
      const nl = PR.clamp(l + k * 0.24, 0.04, 0.96), ns = PR.clamp(s * (1 + (k < 0 ? -k * 0.1 : -k * 0.25)), 0, 1);
      out.push(hsl2hex(nh, ns, nl));
    }
    return out;
  };
  const hsl2hex = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return PR.rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  };
  P.PALETTES = {
    character: { name: 'สีตัวละครปัจจุบัน', make: () => {
      const pal = PR.app ? PR.app.scene.ch.rig.pal : PR.BASE_PALETTE, seen = new Set(), ramps = [['#000000', '#1a1222', '#4a4060', '#9a90b5', '#ffffff']];
      for (const k of Object.keys(pal)) { const h = PR.resolveColor(k, pal); if (!seen.has(h)) { seen.add(h); ramps.push(P.ramp(h)); } }
      return ramps;
    } },
    basic: { name: 'พื้นฐาน 12 สี × 5 ระดับ', make: () => {
      const ramps = [['#000000', '#3b3b4f', '#7a7a90', '#bdbdcc', '#ffffff']];
      for (let h = 0; h < 360; h += 30) ramps.push(P.ramp(hsl2hex(h, 0.65, 0.5)));
      return ramps;
    } },
    skin: { name: 'ผิว ผม โลหะ', make: () => ['#f6c9a6', '#d99a74', '#8a5a3c', '#e8ecf5', '#f2c94c', '#3d2a20', '#b9c4d4', '#c9a24a'].map((h) => P.ramp(h)) },
    retro: { name: 'เรโทร 4 สีเขียว', make: () => [['#0f1f0f', '#30562e', '#8bac0f', '#c4e05a']] },
  };
  P.palette = P.PALETTES.basic.make();
})();
