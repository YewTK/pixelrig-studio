'use strict';
// Effects. World coords: x, y (height; ground = 0, up = negative), z (depth lane).
// Each effect type: init(f, o, scene), update(f, dt, scene) -> false when finished, draw(f, g, V, pass).
// pass: 'back' (color, behind characters), 'front' (color, in front), 'light' (additive glow).
// V: view helper {p(x,y,z) -> [bufX, bufY], S: buffer px per unit, pixel: bool}

PR.FXT = {};
PR.fxCount = (n) => Math.max(1, Math.round(n * PR.CFG.fx.particles));
const R = PR.rand;

PR.glow = (g, x, y, r, col, a = 1) => {
  if (r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, PR.rgba(col, a)); gr.addColorStop(1, PR.rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
};
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2); g.fill(); };
const pline = (g, pts, col, w) => {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
};

PR.FXSystem = class {
  constructor(scene) { this.list = []; this.scene = scene; }
  spawn(type, o = {}) {
    const T = PR.FXT[type];
    if (!T) { console.warn('unknown fx', type); return null; }
    const f = { type, t: 0, x: o.x || 0, y: o.y || 0, z: o.z || 0, ramp: o.ramp || PR.ELEMENTS.none.ramp, o };
    T.init && T.init(f, o, this.scene);
    this.list.push(f);
    return f;
  }
  update(dt) {
    this.list = this.list.filter((f) => { f.t += dt; return PR.FXT[f.type].update(f, dt, this.scene) !== false; });
  }
  draw(g, V, pass) { for (const f of this.list) { const T = PR.FXT[f.type]; T.draw && T.draw(f, g, V, pass); } }
  clear() { this.list.length = 0; }
};

// simple particle helpers
const stepParts = (f, dt, grav = 0, drag = 0) => {
  for (const p of f.ps) {
    p.age += dt; p.vy += grav * dt; p.vx *= 1 - drag * dt; p.vy *= 1 - drag * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  f.ps = f.ps.filter((p) => p.age < p.life);
  return f.ps.length > 0;
};

PR.FXT.dust = {
  init(f, o) {
    f.ps = [];
    for (let i = 0; i < PR.fxCount(o.n || 6); i++) f.ps.push({ x: f.x + R(-1, 1) * (o.spread || 6), y: R(-2, 0), vx: R(-1, 1) * 18 + (o.dir || 0) * 22, vy: R(-14, -4), r: R(1.5, 3.2), age: 0, life: R(0.3, 0.55) });
  },
  update(f, dt) { return stepParts(f, dt, 10, 3); },
  draw(f, g, V, pass) {
    if (pass !== 'front') return;
    for (const p of f.ps) { const [x, y] = V.p(p.x, p.y, f.z); const k = 1 - p.age / p.life; disc(g, x, y, p.r * k * V.S, k > 0.5 ? '#d8c8b0' : '#a89880'); }
  },
};

PR.FXT.spark = {
  init(f, o) {
    f.ps = [];
    const n = PR.fxCount(o.n || 10);
    for (let i = 0; i < n; i++) {
      const a = (o.dir != null ? (o.dir > 0 ? 0 : Math.PI) + R(-1.1, 1.1) : R(0, Math.PI * 2));
      const sp = R(60, 170) * (o.power || 1);
      f.ps.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, age: 0, life: R(0.15, 0.32) });
    }
  },
  update(f, dt) { return stepParts(f, dt, 300, 6); },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    for (const p of f.ps) {
      const [x, y] = V.p(p.x, p.y, f.z), [x2, y2] = V.p(p.x - p.vx * 0.035, p.y - p.vy * 0.035, f.z);
      const k = 1 - p.age / p.life;
      pline(g, [[x, y], [x2, y2]], pass === 'light' ? PR.rgba(f.ramp[2], k) : (k > 0.5 ? f.ramp[0] : f.ramp[1]), Math.max(1, V.S * (pass === 'light' ? 2.5 : 1)));
    }
  },
};

PR.FXT.flash = {
  init(f, o) { f.life = o.life || 0.14; f.size = o.size || 12; f.rot = R(0, 1); },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    const [x, y] = V.p(f.x, f.y, f.z), k = f.t / f.life, s = f.size * V.S * (0.5 + PR.ease.outExpo(k) * 0.8) * (1 - k * 0.4);
    if (pass === 'light') { PR.glow(g, x, y, s * 1.6, f.ramp[2], 0.9 * (1 - k)); return; }
    if (pass !== 'front' || k > 0.7) return;
    g.fillStyle = k < 0.25 ? '#ffffff' : f.ramp[1];
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = f.rot + (i / 8) * Math.PI * 2, rr = i % 2 ? s * 0.22 : s;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9);
    }
    g.closePath(); g.fill();
  },
};

// crescent slash. o: x,y,z (center), facing, r, a0, a1 (deg, character space: 0 = forward, + = clockwise/down), thick, life
PR.FXT.slash = {
  init(f, o) { f.life = o.life || 0.22; f.r = o.r || 16; f.a0 = o.a0 ?? -110; f.a1 = o.a1 ?? 50; f.th = o.thick || 5; f.fc = o.facing || 1; },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    const k = f.t / f.life;
    const head = f.a0 + (f.a1 - f.a0) * PR.ease.outCubic(Math.min(1, k * 2.4));
    const tail = f.a0 + (f.a1 - f.a0) * PR.ease.in(k);
    // crescent band between radius r and r - thickness; thickness peaks toward the leading end
    const band = (thMul) => {
      const N = 16, outer = [], inner = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = PR.lerp(tail, head, u) * PR.D2R;
        const th = f.th * thMul * Math.pow(Math.sin(u * Math.PI * 0.92 + 0.12), 1.2) * (1 - k * 0.7) * (0.35 + 0.65 * u);
        const ca = Math.cos(a) * f.fc, sa = Math.sin(a);
        outer.push(V.p(f.x + ca * f.r, f.y + sa * f.r, f.z));
        inner.unshift(V.p(f.x + ca * (f.r - th), f.y + sa * (f.r - th), f.z));
      }
      const pts = outer.concat(inner);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    };
    if (pass === 'light') { band(1.3); g.fillStyle = PR.rgba(f.ramp[2], 0.55 * (1 - k)); g.fill(); return; }
    band(1); g.fillStyle = k < 0.5 ? f.ramp[1] : f.ramp[2]; g.fill();
    if (k < 0.6) { band(0.45); g.fillStyle = f.ramp[0]; g.fill(); }
  },
};

PR.FXT.ring = {
  init(f, o) { f.life = o.life || 0.4; f.R = o.r || 26; f.flat = o.flat ?? 0.32; },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass === 'front') return;
    const k = f.t / f.life, r = f.R * PR.ease.outCubic(k) * V.S;
    const [x, y] = V.p(f.x, f.y, f.z);
    g.beginPath(); g.ellipse(x, y, Math.max(r, 0.1), Math.max(r * f.flat, 0.1), 0, 0, Math.PI * 2);
    if (pass === 'light') { g.strokeStyle = PR.rgba(f.ramp[2], 0.8 * (1 - k)); g.lineWidth = 4 * V.S * (1 - k); g.stroke(); return; }
    g.strokeStyle = k < 0.4 ? f.ramp[0] : f.ramp[1]; g.lineWidth = Math.max(1, 2.5 * V.S * (1 - k)); g.stroke();
  },
};

PR.FXT.burst = {
  init(f, o, scene) {
    f.life = o.life || 0.35; f.R = o.r || 12;
    if (scene && !o.noSparks) scene.fx.spawn('spark', { x: f.x, y: f.y, z: f.z, n: o.sparks || 12, ramp: f.ramp, power: 1.2 });
  },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    const k = f.t / f.life, [x, y] = V.p(f.x, f.y, f.z), r = f.R * V.S * PR.ease.outExpo(k);
    if (pass === 'light') { PR.glow(g, x, y, r * 2.2, f.ramp[2], 1 - k); return; }
    if (pass !== 'front') return;
    if (k < 0.5) disc(g, x, y, r * (1 - k), k < 0.2 ? '#ffffff' : f.ramp[1]);
    g.strokeStyle = f.ramp[2]; g.lineWidth = Math.max(1, 2 * V.S * (1 - k)); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  },
};

PR.FXT.debris = {
  init(f, o) {
    f.ps = [];
    for (let i = 0; i < PR.fxCount(o.n || 8); i++) f.ps.push({ x: f.x + R(-6, 6), y: -1, vx: R(-70, 70), vy: R(-170, -70), s: R(1.2, 2.6), rot: R(0, 6), vr: R(-12, 12), age: 0, life: R(0.6, 1) });
  },
  update(f, dt) {
    for (const p of f.ps) {
      p.age += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > 0) { p.y = 0; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
    }
    f.ps = f.ps.filter((p) => p.age < p.life); return f.ps.length > 0;
  },
  draw(f, g, V, pass) {
    if (pass !== 'front') return;
    for (const p of f.ps) {
      const [x, y] = V.p(p.x, p.y, f.z), s = p.s * V.S;
      g.save(); g.translate(x, y); g.rotate(p.rot); g.fillStyle = f.o.color || '#7d6b58'; g.fillRect(-s, -s, s * 2, s * 2); g.restore();
    }
  },
};

// projectile. o: x,y,z, dir (+1/-1), speed, kind ('orb'|'arrow'|'shard'), range, hit:{...}, owner
PR.FXT.projectile = {
  init(f, o) { f.vx = (o.speed || 160) * (o.dir || 1); f.vy = o.vy || 0; f.life = (o.range || 220) / Math.abs(f.vx); f.kind = o.kind || 'orb'; f.hist = []; },
  update(f, dt, scene) {
    f.hist.push([f.x, f.y]); if (f.hist.length > 6) f.hist.shift();
    f.vy += (f.o.grav || 0) * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.kind === 'orb' && Math.random() < 0.6) scene.fx.spawn('spark', { x: f.x, y: f.y, z: f.z, n: 1, ramp: f.ramp, power: 0.3 });
    const d = scene.dummy;
    if (d && scene.showDummy && d.hp > 0 && Math.abs(f.x - d.x) < 7 && Math.abs(f.z - d.z) < 12 && f.y > -40 && f.y < 2) {
      scene.applyHit(f.o.owner, Object.assign({ dmg: [8, 14], knock: 5 }, f.o.hit || {}), { x: f.x, y: f.y, z: f.z }, Math.sign(f.vx), f.ramp);
      scene.fx.spawn(f.kind === 'arrow' ? 'flash' : 'burst', { x: f.x, y: f.y, z: f.z, ramp: f.ramp, r: f.o.boom || 10 });
      return false;
    }
    if (f.y > 0) { scene.fx.spawn('burst', { x: f.x, y: 0, z: f.z, ramp: f.ramp, r: 8 }); return false; }
    return f.t < f.life;
  },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    const [x, y] = V.p(f.x, f.y, f.z), S = V.S, dir = Math.sign(f.vx);
    const ang = Math.atan2(f.vy, f.vx);
    if (pass === 'light') { PR.glow(g, x, y, (f.kind === 'orb' ? 12 : 7) * S, f.ramp[2], 0.9); return; }
    if (f.kind === 'arrow') {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = '#7a5230'; g.fillRect(-10 * S, -0.5 * S, 10 * S, Math.max(1, S));
      g.fillStyle = '#dbe6f2'; g.beginPath(); g.moveTo(2.5 * S, 0); g.lineTo(-0.5 * S, -1.6 * S); g.lineTo(-0.5 * S, 1.6 * S); g.fill();
      g.fillStyle = f.ramp[1]; g.fillRect(-11 * S, -1.5 * S, 3 * S, 3 * S);
      g.restore(); return;
    }
    if (f.kind === 'shard') {
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = f.ramp[1];
      g.beginPath(); g.moveTo(6 * S, 0); g.lineTo(0, -2.2 * S); g.lineTo(-6 * S, 0); g.lineTo(0, 2.2 * S); g.fill();
      g.fillStyle = f.ramp[0]; g.fillRect(-1 * S, -0.6 * S, 4 * S, 1.2 * S); g.restore(); return;
    }
    for (let i = 0; i < f.hist.length; i++) { const [hx, hy] = V.p(f.hist[i][0], f.hist[i][1], f.z); disc(g, hx, hy, (1 + i * 0.5) * S, f.ramp[2]); }
    disc(g, x, y, 4 * S, f.ramp[1]); disc(g, x + dir * S, y - S, 2.2 * S, f.ramp[0]);
  },
};

// lightning bolt from the sky onto x. o: x, z, life
PR.FXT.lightning = {
  init(f, o) { f.life = o.life || 0.35; f.seg = null; f.next = 0; },
  update(f) {
    if (f.t >= f.next) {
      f.next = f.t + 0.045; f.seg = [];
      let x = f.x + R(-10, 10);
      for (let y = -170; y <= 0; y += 12) { f.seg.push([x, y]); x += R(-6, 6); x = PR.lerp(x, f.x, (y + 170) / 200); }
      f.seg.push([f.x, 0]);
    }
    return f.t < f.life;
  },
  draw(f, g, V, pass) {
    if (pass === 'back' || !f.seg) return;
    const pts = f.seg.map((p) => V.p(p[0], p[1], f.z)), k = f.t / f.life;
    if (pass === 'light') { pline(g, pts, PR.rgba(f.ramp[2], 0.6 * (1 - k)), 8 * V.S); return; }
    if (k > 0.8) return;
    pline(g, pts, f.ramp[1], Math.max(1, 2.2 * V.S)); pline(g, pts, '#ffffff', Math.max(1, 0.8 * V.S));
  },
};

// magic circle on the ground. o: x, z, r, life
PR.FXT.circle = {
  init(f, o) { f.life = o.life || 0.9; f.R = o.r || 16; },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass === 'front') return;
    const k = f.t / f.life, sc = PR.ease.outBack(Math.min(1, k * 4)) * (k > 0.75 ? 1 - (k - 0.75) * 4 : 1);
    const [x, y] = V.p(f.x, f.y, f.z), r = f.R * V.S * Math.max(sc, 0.01), flat = 0.32;
    const col = pass === 'light' ? PR.rgba(f.ramp[2], 0.55) : f.ramp[1];
    g.strokeStyle = col; g.lineWidth = Math.max(1, V.S * (pass === 'light' ? 3 : 1));
    g.beginPath(); g.ellipse(x, y, r, r * flat, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(x, y, r * 0.72, r * 0.72 * flat, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = f.t * 2.5 + (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * r * 0.86, py = y + Math.sin(a) * r * 0.86 * flat;
      g.fillStyle = pass === 'light' ? PR.rgba(f.ramp[1], 0.8) : f.ramp[0];
      g.fillRect(px - V.S, py - V.S, V.S * 2, V.S * 2);
    }
  },
};

// light pillar / aura column. o: x, z, w, h, life
PR.FXT.pillar = {
  init(f, o) { f.life = o.life || 0.8; f.w = o.w || 10; f.h = o.h || 90; },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    const k = f.t / f.life, w = f.w * V.S * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k * 0.7);
    const [x, y] = V.p(f.x, 0, f.z), top = V.p(f.x, -f.h, f.z)[1];
    if (pass === 'light') { const gr = g.createLinearGradient(0, top, 0, y); gr.addColorStop(0, PR.rgba(f.ramp[2], 0)); gr.addColorStop(1, PR.rgba(f.ramp[2], 0.7 * (1 - k))); g.fillStyle = gr; g.fillRect(x - w, top, w * 2, y - top); return; }
    if (k < 0.6) { g.fillStyle = f.ramp[0]; g.fillRect(x - w * 0.25, top + (y - top) * 0.3, w * 0.5, (y - top) * 0.7); }
  },
};

// rising particles attached to a character for a while. o: owner, life, n (per second)
PR.FXT.aura = {
  init(f, o) { f.life = o.life || 1; f.ps = []; f.acc = 0; },
  update(f, dt) {
    const ch = f.o.owner;
    f.acc += dt * (f.o.rate || 40) * PR.CFG.fx.particles;
    while (f.t < f.life && f.acc > 1) { f.acc--; f.ps.push({ x: ch.x + R(-8, 8), y: R(-4, 0) - ch.h, vx: 0, vy: R(-60, -25), age: 0, life: R(0.4, 0.8) }); }
    f.z = ch.z;
    return stepParts(f, dt, 0, 1) || f.t < f.life;
  },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    for (const p of f.ps) {
      const [x, y] = V.p(p.x, p.y, f.z), k = 1 - p.age / p.life;
      if (pass === 'light') PR.glow(g, x, y, 4 * V.S, f.ramp[2], k * 0.8);
      else if (k > 0.3) { g.fillStyle = k > 0.7 ? f.ramp[0] : f.ramp[1]; g.fillRect(x - V.S * 0.5, y - V.S, V.S, V.S * 2); }
    }
  },
};

PR.FXT.number = {
  init(f, o) { f.life = 0.8; f.txt = String(o.text); f.col = o.color || '#ffffff'; f.vx = R(-10, 10); },
  update(f, dt) { f.x += f.vx * dt; f.y -= (40 * (1 - f.t / f.life)) * dt; return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass !== 'front') return;
    const [x, y] = V.p(f.x, f.y, f.z), px = Math.max(1, Math.round(V.S * (f.o.big ? 1.6 : 1.1)));
    const pop = f.t < 0.08 ? 1 + (0.08 - f.t) * 6 : 1;
    PR.drawPixText(g, f.txt, x, y, Math.round(px * pop), f.col, '#1a1222');
  },
};

// ghost copy of a character pose (additive). o: owner, life
PR.FXT.afterimage = {
  init(f, o) {
    const ch = o.owner; f.life = o.life || 0.25;
    f.mats = {}; for (const k in ch.rig.mats) f.mats[k] = ch.rig.mats[k].slice();
    f.x = ch.x; f.h = ch.h; f.z = ch.z; f.facing = ch.facing * (ch.pose.sx ?? 1); f.ch = ch;
  },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass !== 'back') return;   // behind the live character, so it only shows where the body has moved away
    const rig = f.ch.rig, keep = rig.mats;
    rig.mats = f.mats;
    const [bx, by] = V.p(f.x, -f.h, f.z);
    const Rm = [V.S * f.facing, 0, 0, V.S, bx, by];
    rig.draw(g, Rm, { S: V.S, pixel: V.pixel, tint: f.ramp[2], alpha: 0.6 * (1 - f.t / f.life) });
    rig.mats = keep;
    g.setTransform(1, 0, 0, 1, 0, 0);
  },
};

// speed lines (dash / thrust). o: x,y,z, dir, len
PR.FXT.lines = {
  init(f, o) { f.life = o.life || 0.2; f.ls = []; for (let i = 0; i < (o.n || 6); i++) f.ls.push({ y: f.y + R(-14, 4), off: R(0, 10), len: R(10, o.len || 26) }); },
  update(f) { return f.t < f.life; },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    const k = f.t / f.life, d = f.o.dir || 1;
    for (const l of f.ls) {
      const x0 = f.x + d * (l.off + k * 30), x1 = x0 + d * l.len * (1 - k);
      const a = V.p(x0, l.y, f.z), b = V.p(x1, l.y, f.z);
      pline(g, [a, b], pass === 'light' ? PR.rgba(f.ramp[2], 0.6 * (1 - k)) : f.ramp[0], Math.max(1, V.S * (pass === 'light' ? 2 : 0.8)));
    }
  },
};

// falling meteor onto x. o: x, z, from (height), hit
PR.FXT.meteor = {
  init(f, o) { f.tx = f.x; f.x = f.tx - 60 * (o.dir || 1); f.y = -170; f.life = o.life || 0.45; f.sx = f.x; },
  update(f, dt, scene) {
    const k = Math.min(1, f.t / f.life);
    f.x = PR.lerp(f.sx, f.tx, k); f.y = PR.lerp(-170, 0, k * k);
    if (Math.random() < 0.9) scene.fx.spawn('spark', { x: f.x, y: f.y, z: f.z, n: 1, ramp: f.ramp, power: 0.4 });
    if (k >= 1) {
      scene.fx.spawn('burst', { x: f.tx, y: -4, z: f.z, ramp: f.ramp, r: 22, sparks: 20 });
      scene.fx.spawn('ring', { x: f.tx, y: 0, z: f.z, ramp: f.ramp, r: 40 });
      scene.fx.spawn('debris', { x: f.tx, z: f.z, n: 10 });
      scene.shake = Math.max(scene.shake, 5);
      scene.areaHit(f.o.owner, f.tx, f.z, 22, Object.assign({ dmg: [30, 45], knock: 10, launch: 90, stop: 0.08 }, f.o.hit || {}), f.ramp);
      return false;
    }
    return true;
  },
  draw(f, g, V, pass) {
    if (pass === 'back') return;
    const [x, y] = V.p(f.x, f.y, f.z);
    if (pass === 'light') { PR.glow(g, x, y, 22 * V.S, f.ramp[2], 1); return; }
    disc(g, x, y, 7 * V.S, f.ramp[2]); disc(g, x, y, 5 * V.S, f.ramp[1]); disc(g, x + V.S, y - V.S, 2.5 * V.S, f.ramp[0]);
  },
};

// arrows falling from the sky over an area. o: x, z, n, spread, life
PR.FXT.rain = {
  init(f, o) { f.life = o.life || 0.8; f.acc = 0; f.n = o.n || 12; f.made = 0; },
  update(f, dt, scene) {
    while (f.made < f.n && f.t > (f.made / f.n) * f.life) {
      f.made++;
      scene.fx.spawn('projectile', { x: f.x + R(-1, 1) * (f.o.spread || 20) - 40, y: -150, z: f.z, dir: 1, speed: 60, vy: 230, kind: 'arrow', range: 400, ramp: f.ramp, owner: f.o.owner, hit: { dmg: [4, 7], knock: 1, stop: 0.02 } });
    }
    return f.made < f.n;
  },
};
