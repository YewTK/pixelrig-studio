'use strict';
// Scene: character + training dummy + effects, hit logic, camera and the render pipeline.
// Render: background buffer -> color buffer (thresholded in pixel mode) -> additive light buffer -> display.

PR.Scene = class {
  constructor(cfg) {
    this.ch = new PR.Character(cfg);
    this.dummy = { x: 32, z: 0, h: 0, vh: 0, hp: 300, max: 300, wob: 0, wobV: 0, flash: 0, kx: 0, dead: 0 };
    this.fx = new PR.FXSystem(this);
    this.shake = 0; this.freeze = 0; this.time = 0;
    this.camX = 0; this.showDummy = true;
    this.stats = { lastHit: 0, combo: 0, comboT: 0 };
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.freeze > 0) { this.freeze -= dt; if (!this.noFreeze) return; }
    const ch = this.ch;
    if (!this.editing) ch.update(dt, this, input);
    const d = this.dummy;
    d.wobV += (-d.wob * 160 - d.wobV * 9) * dt; d.wob += d.wobV * dt;
    d.x += d.kx * dt; d.kx *= Math.exp(-dt * 7);
    if (d.h > 0 || d.vh > 0) { d.vh -= 520 * dt; d.h += d.vh * dt; if (d.h <= 0) { d.h = 0; d.vh = 0; this.fx.spawn('dust', { x: d.x, z: d.z, n: 6 }); } }
    d.flash = Math.max(0, d.flash - dt);
    if (d.hp <= 0) { d.dead += dt; if (d.dead > 1.2) { d.hp = d.max; d.dead = 0; } }
    // keep the dummy near the character when walking far (treadmill feel)
    if (!this.editing) {
      if (d.x - ch.x < -170) d.x = ch.x + 170;
      else if (d.x - ch.x > 170) d.x = ch.x - 170;
    }
    // refine glow sparkles on the weapon
    const ref = ch.rig.cfg.refine || 0;
    if (ref > 0 && ch.rig.weapon.shapes.length && Math.random() < ref * 0.04) {
      const w = ch.rig.weapon, u = Math.random();
      const p = ch.toWorld(ch.rig.weaponPoint([PR.lerp(w.base[0], w.tip[0], u), PR.lerp(w.base[1], w.tip[1], u)]));
      this.fx.spawn('aura', { owner: { x: p.x, z: ch.z, h: -p.y }, life: 0.05, rate: 40, ramp: ch.rig.element.ramp });
    }
    this.fx.update(dt);
    this.stats.comboT -= dt;
    if (this.stats.comboT <= 0) this.stats.combo = 0;
    this.camX += (ch.x - this.camX) * (1 - Math.exp(-dt * 6));
  }

  // ---- events from clips ----
  eventPos(ch, e) {
    const at = e.at || 'body';
    if (at === 'target') return { x: this.dummy.x + (e.x || 0) * ch.facing, y: (e.y ?? -16) - this.dummy.h, z: this.dummy.z };
    if (at === 'tip') { const p = ch.toWorld(ch.rig.weaponPoint(ch.rig.weapon.tip)); p.x += (e.x || 0) * ch.facing; p.y += e.y || 0; return p; }
    if (at === 'hand') { const p = ch.toWorld(ch.rig.bonePoint('handF', ch.rig.fist[0], ch.rig.fist[1])); p.x += (e.x || 0) * ch.facing; p.y += e.y || 0; return p; }
    if (at === 'feet') return { x: ch.x + (e.x || 0) * ch.facing, y: (e.y || 0), z: ch.z };
    return { x: ch.x + (e.x || 0) * ch.facing, y: (e.y ?? -20) - ch.h, z: ch.z };
  }
  handleEvent(ch, e) {
    const ramp = (e.el && PR.ELEMENTS[e.el] ? PR.ELEMENTS[e.el].ramp : null) || ch.rig.element.ramp;
    const dir = ch.facing * (ch.pose.sx ?? 1);
    let pos = null;
    if (e.fx) {
      pos = this.eventPos(ch, e);
      const o = Object.assign({}, e, pos, { ramp, owner: ch, facing: dir });
      if (o.dir == null) o.dir = dir; else o.dir *= ch.facing;
      this.fx.spawn(e.fx, o);
    }
    if (e.afterimage) this.fx.spawn('afterimage', { owner: ch, ramp, life: e.afterimage === true ? 0.25 : e.afterimage });
    if (e.shake) this.shake = Math.max(this.shake, e.shake * PR.CFG.fx.shake);
    if (e.hit) {
      const h = e.hit;
      if (h.area) { pos = pos || this.eventPos(ch, e); this.areaHit(ch, pos.x, pos.z, h.area, h, ramp); }
      else {
        const d = this.dummy, dx = (d.x - ch.x) * ch.facing, rg = h.range || [0, 26];
        if (this.showDummy && d.hp > 0 && dx >= rg[0] && dx <= rg[1] && Math.abs(d.z - ch.z) < 12) {
          this.applyHit(ch, h, { x: d.x - ch.facing * 4, y: -18 - d.h + PR.rand(-4, 4), z: d.z }, ch.facing, ramp);
        }
      }
    }
  }
  areaHit(ch, x, z, r, h, ramp) {
    const d = this.dummy;
    if (this.showDummy && d.hp > 0 && Math.abs(d.x - x) <= r && Math.abs(d.z - z) < 14) {
      this.applyHit(ch, h, { x: d.x, y: -18 - d.h, z: d.z }, Math.sign(d.x - x) || ch.facing, ramp);
    }
  }
  applyHit(ch, h, p, dir, ramp) {
    const d = this.dummy;
    if (d.hp <= 0) return;
    const dm = h.dmg || [5, 9];
    const crit = Math.random() < (h.crit ?? PR.CFG.fx.critChance);
    let dmg = Math.round(PR.rand(dm[0], dm[1]) * (crit ? 1.8 : 1) * (1 + (ch && ch.rig.cfg.refine || 0) * 0.05));
    d.hp = Math.max(0, d.hp - dmg);
    d.flash = 0.1;
    d.wobV += (h.knock ?? 4) * 22 * dir;
    d.kx += (h.knock ?? 4) * 5 * dir;
    if (h.launch) d.vh = Math.max(d.vh, h.launch);
    if (PR.CFG.fx.numbers) this.fx.spawn('number', { x: d.x, y: -38 - d.h, z: d.z, text: crit ? dmg + '!' : dmg, color: crit ? '#ffd23a' : '#ffffff', big: crit });
    if (h.spark !== 0) this.fx.spawn('spark', { x: p.x, y: p.y, z: p.z, n: h.spark || 9, ramp, dir });
    this.fx.spawn('flash', { x: p.x, y: p.y, z: p.z, ramp, size: crit ? 16 : 11 });
    this.freeze = Math.max(this.freeze, (h.stop ?? 0.05) * PR.CFG.fx.hitstop);
    this.shake = Math.max(this.shake, (h.shake ?? 1.5) * PR.CFG.fx.shake);
    this.stats.combo++; this.stats.comboT = 1.2; this.stats.lastHit = dmg;
  }

  // ---- rendering ----
  ensureBuffers(bw, bh) {
    if (this.bw === bw && this.bh === bh) return;
    this.bw = bw; this.bh = bh;
    const mk = () => { const c = document.createElement('canvas'); c.width = bw; c.height = bh; return c; };
    this.bg = mk(); this.col = mk(); this.light = mk();
    this.bgG = this.bg.getContext('2d'); this.colG = this.col.getContext('2d', { willReadFrequently: true }); this.lightG = this.light.getContext('2d');
  }
  makeView(view) {
    const pixel = view.mode === 'pixel';
    if (view.fixed) {   // used by the sprite baker: exact buffer size, scale and camera, no shake
      const { bw, bh, S, camX, camY } = view.fixed;
      return { bw, bh, S, pixel, camX, camY, p: (x, y, z) => [(x - camX) * S + bw / 2, (y + z * 0.5 - camY) * S + bh / 2] };
    }
    const bw = pixel ? Math.round(view.W / view.ps) : view.W, bh = pixel ? Math.round(view.H / view.ps) : view.H;
    const S = (bw / 320) * view.zoom;
    const camY = Math.min(-0.24 * 180 / view.zoom, -24);
    const sx = this.shake ? PR.rand(-1, 1) * this.shake * 0.6 : 0, sy = this.shake ? PR.rand(-1, 1) * this.shake * 0.6 : 0;
    const camX = this.camX + (view.camOffset || 0);
    return {
      bw, bh, S, pixel, camX, camY,
      p: (x, y, z) => [(x - camX + sx) * S + bw / 2, (y + z * 0.5 - camY + sy) * S + bh / 2],
    };
  }
  charMatrix(V, ch) {
    const [bx, by] = V.p(ch.x, -ch.h, ch.z);
    return [V.S * ch.facing * (ch.pose.sx ?? 1), 0, 0, V.S, bx, by];
  }
  render(ctx, view, extra = {}) {
    const V = this.makeView(view);
    this.ensureBuffers(V.bw, V.bh);
    this.V = V;
    const { bgG, colG, lightG } = this;
    for (const g of [bgG, colG, lightG]) { g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = !V.pixel; }
    if (view.noBg) bgG.clearRect(0, 0, V.bw, V.bh); else this.drawBackground(bgG, V);
    colG.clearRect(0, 0, V.bw, V.bh);
    lightG.clearRect(0, 0, V.bw, V.bh);
    const ch = this.ch, d = this.dummy;
    // shadows
    const shadow = (x, z, h, r) => {
      const [sx, sy] = V.p(x, 0, z), k = PR.clamp(1 - h / 140, 0.4, 1);
      bgG.fillStyle = 'rgba(5,0,15,0.38)'; bgG.beginPath(); bgG.ellipse(sx, sy, r * k * V.S, r * 0.32 * k * V.S, 0, 0, Math.PI * 2); bgG.fill();
    };
    if ((!view.noBg && PR.CFG.render.shadow) || view.shadow) {
      if (!extra.hideChar) shadow(ch.x, ch.z, ch.h, 11);
      if (this.showDummy) shadow(d.x, d.z, d.h, 9);
    }
    // color pass
    this.fx.draw(colG, V, 'back');
    const ents = [{ z: ch.z + 0.01, ch }];
    if (this.showDummy) ents.push({ z: d.z, d });
    ents.sort((a, b) => a.z - b.z);
    for (const e of ents) {
      if (e.d) {
        const [bx, by] = V.p(d.x, -d.h, d.z);
        PR.drawDummy(colG, [V.S, 0, 0, V.S, bx, by], d, { S: V.S, pixel: V.pixel });
        colG.setTransform(1, 0, 0, 1, 0, 0);
      } else if (!extra.hideChar) {
        const Rm = this.charMatrix(V, ch);
        for (const on of extra.onion || []) {   // onion skin poses go to the light layer
          const keep = ch.rig.mats; ch.rig.mats = on.mats;
          ch.rig.draw(lightG, Rm, { S: V.S, pixel: V.pixel, tint: on.color, alpha: 0.2 });
          ch.rig.mats = keep;
        }
        ch.rig.draw(colG, Rm, { S: V.S, pixel: V.pixel });
        colG.setTransform(1, 0, 0, 1, 0, 0);
        this.drawTrail(colG, V, ch, false);
      }
    }
    this.fx.draw(colG, V, 'front');
    colG.setTransform(1, 0, 0, 1, 0, 0);
    if (this.showDummy) this.drawHpBar(colG, V);
    if (V.pixel) PR.pixelize(colG, V.bw, V.bh, PR.CFG.render.threshold);
    // light pass
    lightG.globalCompositeOperation = 'source-over';
    if (!extra.hideChar) this.drawTrail(lightG, V, ch, true);
    this.fx.draw(lightG, V, 'light');
    const ref = ch.rig.cfg.refine || 0, w = ch.rig.weapon;
    if (ref > 0 && w.shapes.length && !extra.hideChar) {
      const fl = 0.75 + Math.sin(this.time * 9) * 0.15;
      for (const u of [0.35, 0.7, 1]) {
        const p = ch.toWorld(ch.rig.weaponPoint([PR.lerp(w.base[0], w.tip[0], u), PR.lerp(w.base[1], w.tip[1], u)]));
        const [x, y] = V.p(p.x, p.y, p.z);
        PR.glow(lightG, x, y, (4 + ref * 0.7) * V.S, ch.rig.element.ramp[2], Math.min(1, ref * 0.09) * fl);
      }
    }
    if (extra.highlight) {
      lightG.globalAlpha = 1;
      ch.rig.draw(lightG, this.charMatrix(V, ch), { S: V.S, pixel: V.pixel, tint: '#ffd23a', alpha: 0.55, only: extra.highlight });
      lightG.setTransform(1, 0, 0, 1, 0, 0);
    }
    // composite
    const W = view.W, H = view.H;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = !V.pixel;
    ctx.drawImage(this.bg, 0, 0, W, H);
    ctx.drawImage(this.col, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let a = PR.CFG.fx.glow; a > 0.001; a -= 1) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(this.light, 0, 0, W, H); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  drawTrail(g, V, ch, light) {
    const tr = ch.trail;
    if (tr.length < 2) return;
    const ramp = ch.rig.element.ramp;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 1; i < tr.length; i++) {
      const s0 = tr[i - 1], s1 = tr[i];
      const life = PR.CFG.fx.trailLife, k = 1 - s1.age / life;
      if (k <= 0) continue;
      const a0 = V.p(s0.a.x, s0.a.y, s0.a.z), a1 = V.p(s1.a.x, s1.a.y, s1.a.z);
      // trail = thin strip along the tip path that narrows as it ages
      const inset0 = 0.42 * Math.max(0, 1 - s0.age / life), inset1 = 0.42 * k;
      const b0 = V.p(PR.lerp(s0.a.x, s0.b.x, inset0), PR.lerp(s0.a.y, s0.b.y, inset0), s0.a.z);
      const b1 = V.p(PR.lerp(s1.a.x, s1.b.x, inset1), PR.lerp(s1.a.y, s1.b.y, inset1), s1.a.z);
      g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.lineTo(b0[0], b0[1]); g.closePath();
      if (light) { g.fillStyle = PR.rgba(ramp[2], 0.45 * k); g.fill(); }
      else {
        g.fillStyle = k > 0.75 ? ramp[0] : k > 0.4 ? ramp[1] : ramp[2];
        g.globalAlpha = V.pixel ? 1 : 0.4 + 0.6 * k;
        g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.stroke();
        g.globalAlpha = 1;
      }
    }
  }
  drawHpBar(g, V) {
    const d = this.dummy;
    const [x, y] = V.p(d.x, -46 - d.h, d.z);
    const w = Math.round(22 * V.S), h = Math.max(2, Math.round(2.2 * V.S));
    const x0 = Math.round(x - w / 2), y0 = Math.round(y);
    g.fillStyle = '#1a1222'; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = '#3b2a3a'; g.fillRect(x0, y0, w, h);
    g.fillStyle = d.hp / d.max > 0.3 ? '#5be37a' : '#ff5a5a'; g.fillRect(x0, y0, Math.round(w * d.hp / d.max), h);
  }
  drawBackground(g, V) {
    const { bw, bh } = V, RC = PR.CFG.render;
    if (RC.bg === 'checker') {   // transparent look, handy for judging silhouettes before export
      const c = Math.max(4, Math.round(8 * V.S));
      for (let y = 0; y < bh; y += c) for (let x = 0; x < bw; x += c) { g.fillStyle = ((x + y) / c) % 2 ? '#2a2240' : '#1d1630'; g.fillRect(x, y, c, c); }
    } else if (RC.bg === 'solid') {
      g.fillStyle = RC.bgTop; g.fillRect(0, 0, bw, bh);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, bh);
      sky.addColorStop(0, RC.bgTop); sky.addColorStop(1, RC.bgBottom);
      g.fillStyle = sky; g.fillRect(0, 0, bw, bh);
      if (RC.glowSpot) { const [cx, cy] = V.p(this.ch.x, -24, 0); PR.glow(g, cx, cy, 120 * V.S, '#5a3a9a', 0.35); }
    }
    if (!RC.floor) return;
    const horizon = V.p(0, 0, -34)[1];
    g.fillStyle = RC.floorColor; g.fillRect(0, horizon, bw, bh - horizon);
    // perspective floor lines
    g.strokeStyle = RC.gridColor; g.lineWidth = 1;
    const step = 18, x0 = Math.floor((V.camX - 400) / step) * step;
    for (let x = x0; x < V.camX + 400; x += step) {
      const a = V.p(x, 0, -34), b = V.p(x + (x - V.camX) * 0.9, 0, 60);
      g.beginPath(); g.moveTo(Math.round(a[0]) + 0.5, horizon); g.lineTo(Math.round(b[0]) + 0.5, b[1]); g.stroke();
    }
    // dashed back edge
    g.fillStyle = RC.edgeColor;
    const dl = Math.max(1, Math.round(3 * V.S)), gap = dl * 2;
    const off = Math.round((-V.camX * V.S) % gap);
    for (let x = off - gap; x < bw; x += gap) g.fillRect(x, Math.round(horizon), dl, Math.max(1, Math.round(V.S * 0.6)));
  }
};
