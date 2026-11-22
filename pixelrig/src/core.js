'use strict';
// PixelRig core: namespace, math, matrices, colors, shape drawing, pixel post-process, pixel font.
const PR = (window.PR = window.PR || {});

PR.D2R = Math.PI / 180;
PR.R2D = 180 / Math.PI;
PR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
PR.lerp = (a, b, t) => a + (b - a) * t;
PR.rand = (a, b) => a + Math.random() * (b - a);
PR.pick = (arr) => arr[(Math.random() * arr.length) | 0];
PR.wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
PR.clone = (o) => JSON.parse(JSON.stringify(o));

// Global settings (edited in the "ตั้งค่า" tab, saved in the browser, exported with the project).
PR.CFG_DEFAULTS = {
  render: { outline: '#1a1222', outlineW: 1, backShade: 0.78, threshold: 96, bg: 'night', bgTop: '#120a24', bgBottom: '#2a1846',
    floor: true, floorColor: '#1b1230', gridColor: '#3a2a5a', edgeColor: '#c9a24a', shadow: true, glowSpot: true },
  fx: { shake: 1, hitstop: 1, particles: 1, glow: 1, numbers: true, trail: true, trailLife: 0.14, critChance: 0.15 },
  cloth: { stiffness: 12, flutter: 1, flutterSpeed: 1, capeSwing: 1, hairSwing: 1, capeRest: 8, hairRest: 30 },
};
PR.CFG = JSON.parse(JSON.stringify(PR.CFG_DEFAULTS));

PR.ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: (t) => { const c1 = 1.70158; return (c1 + 1) * t * t * t - c1 * t * t; },
  step: (t) => (t < 1 ? 0 : 1),
};

// ---- 2D affine matrices, same layout as canvas setTransform(a,b,c,d,e,f) ----
PR.M = {
  ident: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  tr(m, x, y) { return [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
  rot(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
  },
  sc(m, x, y) { return [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]; },
  apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
  angle(m) { return Math.atan2(m[1], m[0]); },
  inv(m) {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
    return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
  },
};

// ---- colors ----
const _rgbCache = new Map();
PR.hexToRgb = (hex) => {
  let r = _rgbCache.get(hex);
  if (r) return r;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  r = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _rgbCache.set(hex, r);
  return r;
};
PR.rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => PR.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
PR.shade = (hex, k) => { const [r, g, b] = PR.hexToRgb(hex); return PR.rgbToHex(r * k, g * k, b * k); };
PR.mix = (h1, h2, t) => {
  const a = PR.hexToRgb(h1), b = PR.hexToRgb(h2);
  return PR.rgbToHex(PR.lerp(a[0], b[0], t), PR.lerp(a[1], b[1], t), PR.lerp(a[2], b[2], t));
};
PR.rgba = (hex, a) => { const [r, g, b] = PR.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Resolve a color token: "#hex", "key" (palette), "key*0.8" (darker), "key+0.3" (toward white).
// Palettes are rebuilt as new objects whenever equipment changes, so a per-palette cache stays valid.
const _palCache = new WeakMap();
PR.resolveColor = (tok, pal) => {
  if (!tok) return '#ff00ff';
  if (tok[0] === '#') return tok;
  let cache = _palCache.get(pal);
  if (!cache) { cache = new Map(); _palCache.set(pal, cache); }
  let out = cache.get(tok);
  if (out) return out;
  const m = /^([a-zA-Z0-9_]+)([*+])?([\d.]+)?$/.exec(tok);
  if (!m) return '#ff00ff';
  out = pal[m[1]] || '#ff00ff';
  if (out[0] !== '#') out = PR.resolveColor(out, pal);
  if (m[2] === '*') out = PR.shade(out, parseFloat(m[3]));
  else if (m[2] === '+') out = PR.mix(out, '#ffffff', parseFloat(m[3]));
  cache.set(tok, out);
  return out;
};

// ---- shape drawing (bone-local coordinates) ----
// shape: {t:'rect',x,y,w,h,r?} {t:'ell',x,y,rx,ry} {t:'circ',x,y,r} {t:'poly',p:[x,y,...]} {t:'line',p:[...],w}
// common: c (color token), o:false (no outline), a (alpha)
PR.shapePath = (g, s) => {
  g.beginPath();
  switch (s.t) {
    case 'rect':
      if (s.r && g.roundRect) g.roundRect(s.x, s.y, s.w, s.h, Math.min(s.r, s.w / 2, s.h / 2));
      else g.rect(s.x, s.y, s.w, s.h);
      break;
    case 'circ': g.arc(s.x, s.y, s.r, 0, Math.PI * 2); break;
    case 'ell': g.ellipse(s.x, s.y, s.rx, s.ry, (s.rot || 0) * PR.D2R, 0, Math.PI * 2); break;
    case 'poly': case 'line': {
      const p = s.p;
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      if (s.t === 'poly') g.closePath();
      break;
    }
  }
};

// Scale a shape by kx (across the bone) and ky (along the bone); circles become ellipses when stretched.
PR.scaleShape = (s, kx, ky) => {
  if (kx === 1 && ky === 1) return s;
  const o = Object.assign({}, s), k = Math.min(kx, ky);
  if ('x' in s) o.x = s.x * kx;
  if ('y' in s) o.y = s.y * ky;
  if (s.t === 'rect') { o.w = s.w * kx; o.h = s.h * ky; if (s.r) o.r = s.r * k; }
  else if (s.t === 'circ') { if (Math.abs(kx - ky) < 1e-3) o.r = s.r * kx; else { o.t = 'ell'; o.rx = s.r * kx; o.ry = s.r * ky; delete o.r; } }
  else if (s.t === 'ell') { o.rx = s.rx * kx; o.ry = s.ry * ky; }
  else if (s.p) { o.p = s.p.map((v, i) => v * (i % 2 ? ky : kx)); if (s.w) o.w = s.w * k; }
  return o;
};

// opt: {shade:1, tint:null|'#hex', outline:'#hex'|null, lw}
PR.drawShapes = (g, shapes, pal, opt) => {
  if (!shapes) return;
  const shade = opt.shade ?? 1;
  for (const s of shapes) {
    PR.shapePath(g, s);
    let col = opt.tint || PR.resolveColor(s.c, pal);
    if (shade !== 1 && !opt.tint) col = PR.shade(col, shade);
    if (s.a != null) g.globalAlpha = s.a * (opt.alpha ?? 1);
    if (s.t === 'line') {
      if (opt.outline && s.o !== false && !opt.tint) {
        g.strokeStyle = opt.outline; g.lineWidth = (s.w || 1) + opt.lw * 2; g.lineCap = 'round'; g.stroke();
      }
      g.strokeStyle = col; g.lineWidth = s.w || 1; g.lineCap = 'round'; g.stroke();
    } else {
      g.fillStyle = col; g.fill();
      if (opt.outline && s.o !== false && !opt.tint) { g.strokeStyle = opt.outline; g.lineWidth = opt.lw; g.stroke(); }
    }
    if (s.a != null) g.globalAlpha = opt.alpha ?? 1;
  }
};

// ---- pixel post-process: hard alpha threshold so anti-aliased vectors become crisp pixel art ----
PR.pixelize = (g, w, h, thr = 100) => {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < thr ? 0 : 255;
  g.putImageData(img, 0, 0);
};

// ---- 3x5 pixel font for damage numbers ----
PR.FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111', '!': '010010010000010', '-': '000000111000000',
  '+': '000010111010000', ' ': '000000000000000',
};
PR.drawPixText = (g, str, x, y, px, color, outline) => {
  const w = str.length * 4 * px - px;
  let cx = Math.round(x - w / 2);
  const cy = Math.round(y);
  for (const ch of str) {
    const gl = PR.FONT[ch] || PR.FONT[' '];
    for (let i = 0; i < 15; i++) {
      if (gl[i] !== '1') continue;
      const gx = cx + (i % 3) * px, gy = cy + ((i / 3) | 0) * px;
      if (outline) { g.fillStyle = outline; g.fillRect(gx - px, gy - px, px * 3, px * 3); }
    }
    cx += 4 * px;
  }
  cx = Math.round(x - w / 2);
  g.fillStyle = color;
  for (const ch of str) {
    const gl = PR.FONT[ch] || PR.FONT[' '];
    for (let i = 0; i < 15; i++) if (gl[i] === '1') g.fillRect(cx + (i % 3) * px, cy + ((i / 3) | 0) * px, px, px);
    cx += 4 * px;
  }
};
