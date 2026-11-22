'use strict';
// Skeletal (cut-out) rig export: one image per body part + bone hierarchy + baked keyframe tracks.
// Output formats: generic rig JSON, Godot 4 scene (Skeleton2D/Bone2D/Sprite2D + AnimationPlayer),
// Unity (see rigexport_unity.js) and a Roblox Luau rig player.
// Units in the JSON: pixels, y down, rotations in degrees clockwise (Godot-style). Part px/py = bone origin inside the part image.
(() => {
  const M = PR.M;
  const RX = (PR.rigExport = {});
  const SLOT_BONE = { weapon: 'weapon', offhand: 'handB', skirt: 'pelvis' };
  const r4 = (v) => Math.round(v * 10000) / 10000;

  // ---- parts ----
  RX.renderParts = (cfg, o, rig = new PR.Rig(cfg)) => {
    const S = o.scale, RC = PR.CFG.render;
    if (PR.app) rig.imgCache = PR.app.scene.ch.rig.imgCache;   // user PNGs are already loaded there
    const lw = ((o.pixel ? 1 : 1.5) * RC.outlineW) / S, outline = RC.outlineW > 0 ? (cfg.colors && cfg.colors.outline) || RC.outline : null;
    const parts = [];
    PR.DRAW_ORDER.forEach((slot, order) => {
      const bone = SLOT_BONE[slot] || slot;
      let shapes, img = cfg.images && cfg.images[slot];
      if (slot === 'weapon') shapes = rig.weapon.shapes;
      else if (slot === 'offhand') shapes = rig.offhand.shapes;
      else shapes = rig.shapes[slot];
      const hasImg = img && img.src && rig.imgCache[img.src] && rig.imgCache[img.src].naturalWidth;
      if (!(shapes && shapes.length) && !hasImg) return;
      const half = Math.ceil(70 * S), cv = document.createElement('canvas');
      cv.width = cv.height = half * 2;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.setTransform(S, 0, 0, S, half, half);
      const shade = PR.BACK_BONES.has(bone) ? RC.backShade : slot === 'offhand' ? 0.88 : 1;
      if (!(img && img.hide) && shapes) PR.drawShapes(g, shapes, rig.pal, { shade, outline, lw });
      if (hasImg) rig.drawImage(g, img, {});
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (o.pixel) PR.pixelize(g, cv.width, cv.height, RC.threshold);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        if (d[(y * cv.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return;
      x0 -= 1; y0 -= 1; x1 += 2; y1 += 2;
      const pc = document.createElement('canvas'); pc.width = x1 - x0; pc.height = y1 - y0;
      pc.getContext('2d').drawImage(cv, x0, y0, pc.width, pc.height, 0, 0, pc.width, pc.height);
      parts.push({ name: slot, bone, order, w: pc.width, h: pc.height, px: half - x0, py: half - y0, canvas: pc });
    });
    return parts;
  };

  // shelf-pack parts into one atlas (power of two width), plus a mirrored copy for engines that cannot flip images
  RX.packAtlas = (parts) => {
    const pad = 2, sorted = [...parts].sort((a, b) => b.h - a.h);
    for (const W of [128, 256, 512, 1024, 2048]) {
      let x = pad, y = pad, rowH = 0, ok = true;
      for (const p of sorted) {
        if (p.w + pad * 2 > W) { ok = false; break; }
        if (x + p.w + pad > W) { x = pad; y += rowH + pad; rowH = 0; }
        p.x = x; p.y = y; x += p.w + pad; rowH = Math.max(rowH, p.h);
      }
      const H = y + rowH + pad;
      if (!ok || H > W) continue;
      const atlas = document.createElement('canvas'); atlas.width = W; atlas.height = H;
      const g = atlas.getContext('2d');
      for (const p of parts) g.drawImage(p.canvas, p.x, p.y);
      const flipped = document.createElement('canvas'); flipped.width = W; flipped.height = H;
      const fg = flipped.getContext('2d'); fg.translate(W, 0); fg.scale(-1, 1); fg.drawImage(atlas, 0, 0);
      return { atlas, flipped, W, H };
    }
    throw new Error('parts do not fit a 2048 atlas');
  };

  // ---- bones ----
  RX.boneList = (cfg, parts, S, rig = new PR.Rig(cfg)) => {
    const used = new Set(parts.map((p) => p.bone));
    const w = rig.weapon;
    const list = rig.bones.map((b) => ({ name: b.n, parent: b.p || '', x: r4(b.o[0] * S), y: r4((b.p ? b.o[1] : -rig.leg) * S), rot: 0, sx: 1, sy: 1, len: r4(Math.hypot(b.tip[0], b.tip[1]) * S), angle: r4(Math.atan2(b.tip[1], b.tip[0]) * PR.R2D) }));
    const ws = cfg.wscale || 1;
    list.push({ name: 'weapon', parent: 'handF', x: r4(rig.fist[0] * S), y: r4(rig.fist[1] * S), rot: r4(w.wrot0 || 0), sx: ws, sy: ws, len: r4(Math.hypot(w.tip[0], w.tip[1]) * S), angle: r4(Math.atan2(w.tip[1], w.tip[0]) * PR.R2D) });
    // drop optional chains (cape, long hair, weapon) that carry no art
    const keep = (n) => used.has(n) || list.some((c) => c.parent === n && keep(c.name));
    return list.filter((b) => !/^(cape|hair)\d$|^weapon$/.test(b.name) || keep(b.name));
  };

  // ---- animation sampling ----
  const localOf = (mats, b, sx) => {
    if (!b.parent) {   // root: relative to the character origin; sx = spin flip around the feet
      const m = mats.root;
      // node transform is T * R * S; mirroring with S = (sx, 1) flips the sign of the lean (exact for sx = ±1)
      return { x: m[4] * sx, y: m[5], rot: M.angle(m) * PR.R2D * Math.sign(sx || 1), sx, sy: 1 };
    }
    const L = M.mul(M.inv(mats[b.parent]), mats[b.name]);
    const det = L[0] * L[3] - L[1] * L[2];
    return { x: L[4], y: L[5], rot: Math.atan2(L[1], L[0]) * PR.R2D, sx: Math.hypot(L[0], L[1]), sy: Math.sign(det || 1) * Math.hypot(L[2], L[3]) };
  };
  const reduce = (times, vals, tol) => {
    const n = vals.length, keep = [0];
    let i = 0;
    while (i < n - 1) {
      let j = i + 1;
      for (let k = i + 2; k < n; k++) {
        let ok = true;
        for (let m = i + 1; m < k && ok; m++) {
          const u = (times[m] - times[i]) / (times[k] - times[i]);
          if (Math.abs(vals[i] + (vals[k] - vals[i]) * u - vals[m]) > tol) ok = false;
        }
        if (ok) j = k; else break;
      }
      keep.push(j); i = j;
    }
    return keep;
  };
  RX.sampleAnim = (cfg, id, bones, o) => {
    const S = o.scale, fps = o.rigFps || 30;
    const sc = new PR.Scene(PR.clone(cfg));
    sc.showDummy = false; sc.noFreeze = true;
    const ch = sc.ch;
    Object.assign(ch.prm, o.prm || {});
    const loco = !!PR.LOCO_ANIMS[id];
    let length, loop;
    if (loco) {
      ch.autoMove = { idle: 0, walk: 1, run: 2 }[id];
      for (let i = 0; i < 120; i++) sc.update(1 / 60, {});
      const sp = id === 'walk' ? ch.prm.walkSpeed : ch.prm.runSpeed;
      length = id === 'idle' ? (Math.PI * 2) / 1.9 : (2 * ch.prm.stride) / sp; loop = true;
    } else {
      const clip = PR.getClip(id);
      if (!clip) return null;
      for (let i = 0; i < 40; i++) sc.update(1 / 60, {});
      ch.play(id, { force: true });
      length = clip.dur; loop = !!clip.loop;
    }
    // sample densely (>= 120 Hz) and let key reduction keep only what is needed:
    // fast strikes get dense keys, slow motion stays light
    const n = Math.max(2, Math.round(length * Math.max(fps, 120)) + 1), dt = length / (n - 1);
    const events = [];
    let simT = 0;
    const orig = sc.handleEvent.bind(sc);
    sc.handleEvent = (c, e) => { events.push({ t: r4(Math.min(simT, length)), name: e.hit ? 'hit' : e.fx || (e.afterimage ? 'afterimage' : e.shake ? 'shake' : 'event') }); orig(c, e); };
    const series = {};   // "bone|prop" -> values
    const times = [];
    for (let i = 0; i < n; i++) {
      times.push(r4(i * dt));
      const sx = ch.pose.sx ?? 1;
      for (const b of bones) {
        const L = localOf(ch.rig.mats, b, sx);
        if (!b.parent && o.inPlace) L.x = 0;
        for (const prop of ['rot', 'x', 'y', 'sx', 'sy']) {
          const v = prop === 'x' || prop === 'y' ? L[prop] * S : L[prop];
          (series[b.name + '|' + prop] = series[b.name + '|' + prop] || []).push(v);
        }
      }
      const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let s = 0; s < sub; s++) { simT += dt / sub; sc.update(dt / sub, {}); }
    }
    const tracks = [];
    for (const b of bones) {
      for (const prop of ['rot', 'x', 'y', 'sx', 'sy']) {
        const vals = series[b.name + '|' + prop];
        if (prop === 'rot') for (let i = 1; i < vals.length; i++) vals[i] = vals[i - 1] + PR.wrapDeg(vals[i] - vals[i - 1]);
        if (loop) vals[vals.length - 1] = vals[0] + (prop === 'rot' ? Math.round((vals[vals.length - 1] - vals[0]) / 360) * 360 : 0);
        const rest = b[prop];
        const tol = prop === 'rot' ? 0.25 : prop === 'sx' || prop === 'sy' ? 0.005 : 0.05;
        if (vals.every((v) => Math.abs(v - rest) <= tol)) continue;   // never leaves the rest pose
        const idx = reduce(times, vals, tol);
        tracks.push({ bone: b.name, prop, times: idx.map((i) => times[i]), values: idx.map((i) => r4(vals[i])) });
      }
    }
    return { name: id, fps, length: r4(length), loop, tracks, events };
  };

  RX.build = (cfg, animIds, o) => {
    const rig = new PR.Rig(cfg);
    const parts = RX.renderParts(cfg, o, rig);
    const pack = RX.packAtlas(parts);
    const bones = RX.boneList(cfg, parts, o.scale, rig);
    const anims = animIds.map((id) => RX.sampleAnim(cfg, id, bones, o)).filter(Boolean);
    // Engines like Godot keep a property's last value when the next animation does not key it,
    // so every animation keys every property that any animation touches (1 key at the rest value).
    const touched = new Set();
    for (const a of anims) for (const t of a.tracks) touched.add(t.bone + '|' + t.prop);
    const boneMap = Object.fromEntries(bones.map((b) => [b.name, b]));
    for (const a of anims) {
      const have = new Set(a.tracks.map((t) => t.bone + '|' + t.prop));
      for (const key of touched) {
        if (have.has(key)) continue;
        const [bone, prop] = key.split('|');
        a.tracks.push({ bone, prop, times: [0], values: [boneMap[bone][prop]] });
      }
    }
    const json = {
      format: 'pixelrig-skeleton', version: 1, name: o.name, scale: o.scale, ppu: Math.round(32 * o.scale), pixelArt: !!o.pixel,
      image: o.name + '_parts.png', imageFlipped: o.name + '_parts_flipped.png', atlasW: pack.W, atlasH: pack.H,
      bones: bones.map(({ name, parent, x, y, rot, sx, sy, len, angle }) => ({ name, parent, x, y, rot, sx, sy, len, angle })),
      parts: parts.map((p) => ({ name: p.name, bone: p.bone, order: p.order, x: p.x, y: p.y, w: p.w, h: p.h, px: p.px, py: p.py, file: 'parts/' + p.name + '.png' })),
      anims,
    };
    return { json, parts, pack };
  };

  // value of a track (or the rest value) at time t, linear
  RX.trackValue = (tr, t, rest) => {
    if (!tr) return rest;
    const T = tr.times, V = tr.values;
    if (t <= T[0]) return V[0];
    for (let i = 1; i < T.length; i++) if (t <= T[i]) { const u = (t - T[i - 1]) / (T[i] - T[i - 1] || 1); return V[i - 1] + (V[i] - V[i - 1]) * u; }
    return V[V.length - 1];
  };

  // Reference player: evaluates a rig JSON exactly the way the engine exporters do (T * R * S per bone, linear keys).
  RX.poseRig = (J, anim, t) => {
    const byBone = {};
    if (anim) for (const tr of anim.tracks) (byBone[tr.bone] = byBone[tr.bone] || {})[tr.prop] = tr;
    const world = {};
    for (const b of J.bones) {
      const tr = byBone[b.name] || {};
      const v = (p) => RX.trackValue(tr[p], t, b[p]);
      const local = M.sc(M.rot(M.tr(M.ident(), v('x'), v('y')), v('rot') * PR.D2R), v('sx'), v('sy'));
      world[b.name] = b.parent ? M.mul(world[b.parent], local) : local;
    }
    return world;
  };
  RX.drawRig = (g, J, atlas, anim, t, base) => {
    const world = RX.poseRig(J, anim, t);
    for (const p of [...J.parts].sort((a, b) => a.order - b.order)) {
      g.setTransform(...M.mul(base, world[p.bone]));
      g.drawImage(atlas, p.x, p.y, p.w, p.h, -p.px, -p.py, p.w, p.h);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };

  // ---- Godot 4 scene ----
  const f = (v) => { const s = r4(v).toString(); return s.includes('.') || s.includes('e') ? s : s + '.0'; };
  const tf = (b) => {
    const a = b.rot * PR.D2R, c = Math.cos(a), s = Math.sin(a);
    return `Transform2D(${f(c * b.sx)}, ${f(s * b.sx)}, ${f(-s * b.sy)}, ${f(c * b.sy)}, ${f(b.x)}, ${f(b.y)})`;
  };
  RX.godotScene = (rig, folder) => {
    const J = rig.json, out = [], subs = [];
    const path = {};
    for (const b of J.bones) path[b.name] = (b.parent ? path[b.parent] : 'Skeleton2D') + '/' + b.name;
    const boneOf = Object.fromEntries(J.bones.map((b) => [b.name, b]));
    for (const p of J.parts) subs.push(`[sub_resource type="AtlasTexture" id="AtlasTexture_${p.name}"]\natlas = ExtResource("1_atlas")\nregion = Rect2(${p.x}, ${p.y}, ${p.w}, ${p.h})\n`);
    const animRes = (name, A) => {
      const lines = [`[sub_resource type="Animation" id="Animation_${name}"]`, `resource_name = "${name}"`, `length = ${f(A.length)}`];
      if (A.loop) lines.push('loop_mode = 1');
      lines.push(`step = ${f(1 / (A.fps || 30))}`);
      let n = 0;
      const value = (nodePath, times, values) => {
        lines.push(`tracks/${n}/type = "value"`, `tracks/${n}/imported = false`, `tracks/${n}/enabled = true`, `tracks/${n}/path = NodePath("${nodePath}")`,
          `tracks/${n}/interp = 1`, `tracks/${n}/loop_wrap = true`, `tracks/${n}/keys = {`, `"times": PackedFloat32Array(${times.map(f).join(', ')}),`,
          `"transitions": PackedFloat32Array(${times.map(() => '1').join(', ')}),`, `"update": 0,`, `"values": [${values.join(', ')}]`, '}');
        n++;
      };
      const byBone = {};
      for (const t of A.tracks) (byBone[t.bone] = byBone[t.bone] || {})[t.prop] = t;
      for (const [bn, tr] of Object.entries(byBone)) {
        const b = boneOf[bn];
        if (!b) continue;
        if (tr.rot) value(`${path[bn]}:rotation`, tr.rot.times, tr.rot.values.map((v) => f(v * PR.D2R)));
        for (const [pair, prop] of [[['x', 'y'], 'position'], [['sx', 'sy'], 'scale']]) {
          if (!tr[pair[0]] && !tr[pair[1]]) continue;
          const ts = [...new Set([...(tr[pair[0]] || { times: [] }).times, ...(tr[pair[1]] || { times: [] }).times])].sort((p, q) => p - q);
          value(`${path[bn]}:${prop}`, ts, ts.map((t) => `Vector2(${f(RX.trackValue(tr[pair[0]], t, b[pair[0]]))}, ${f(RX.trackValue(tr[pair[1]], t, b[pair[1]]))})`));
        }
      }
      if (A.events && A.events.length) {
        // a method track holds one key per time: nudge events that share a time apart by 1 ms
        const evs = [...A.events].sort((p, q) => p.t - q.t).map((e) => ({ t: e.t, name: e.name }));
        for (let i = 1; i < evs.length; i++) if (evs[i].t <= evs[i - 1].t) evs[i].t = r4(evs[i - 1].t + 0.001);
        lines.push(`tracks/${n}/type = "method"`, `tracks/${n}/imported = false`, `tracks/${n}/enabled = true`, `tracks/${n}/path = NodePath(".")`,
          `tracks/${n}/interp = 1`, `tracks/${n}/loop_wrap = true`, `tracks/${n}/keys = {`, `"times": PackedFloat32Array(${evs.map((e) => f(e.t)).join(', ')}),`,
          `"transitions": PackedFloat32Array(${evs.map(() => '1').join(', ')}),`,
          `"values": [${evs.map((e) => `{\n"args": [&"${e.name}"],\n"method": &"_on_rig_event"\n}`).join(', ')}]`, '}');
        n++;
      }
      return lines.join('\n') + '\n';
    };
    // RESET = rest pose for every animated property, so the editor can always go back
    const animated = new Map();
    for (const A of J.anims) for (const t of A.tracks) animated.set(t.bone + '|' + t.prop, t);
    const reset = { length: 0.001, fps: 30, loop: false, events: [], tracks: [...animated.values()].map((t) => ({ bone: t.bone, prop: t.prop, times: [0], values: [boneOf[t.bone][t.prop]] })) };
    subs.push(animRes('RESET', reset));
    J.anims.forEach((A) => subs.push(animRes(A.name, A)));
    subs.push(`[sub_resource type="AnimationLibrary" id="AnimationLibrary_main"]\n_data = {\n${['RESET', ...J.anims.map((a) => a.name)].map((n) => `&"${n}": SubResource("Animation_${n}")`).join(',\n')}\n}\n`);
    out.push(`[gd_scene load_steps=${subs.length + 3} format=3]\n`);
    out.push(`[ext_resource type="Texture2D" path="res://${folder}/${J.image}" id="1_atlas"]`);
    out.push(`[ext_resource type="Script" path="res://${folder}/pixelrig_events.gd" id="2_events"]\n`);
    out.push(...subs);
    out.push(`[node name="${J.name}" type="Node2D"]\nscript = ExtResource("2_events")\n`);
    out.push(`[node name="Skeleton2D" type="Skeleton2D" parent="."]\n`);
    for (const b of J.bones) {
      const parent = b.parent ? path[b.parent] : 'Skeleton2D';
      out.push(`[node name="${b.name}" type="Bone2D" parent="${parent}"]\n` +
        (b.x || b.y ? `position = Vector2(${f(b.x)}, ${f(b.y)})\n` : '') + (b.rot ? `rotation = ${f(b.rot * PR.D2R)}\n` : '') +
        (b.sx !== 1 || b.sy !== 1 ? `scale = Vector2(${f(b.sx)}, ${f(b.sy)})\n` : '') +
        `rest = ${tf(b)}\nauto_calculate_length_and_angle = false\nlength = ${f(Math.max(1, b.len))}\nbone_angle = ${f(b.angle)}\n`);
    }
    for (const p of J.parts) {
      out.push(`[node name="${p.name}_art" type="Sprite2D" parent="${path[p.bone]}"]\n` + (J.pixelArt ? 'texture_filter = 1\n' : '') +
        `z_index = ${p.order}\ntexture = SubResource("AtlasTexture_${p.name}")\ncentered = false\noffset = Vector2(${-p.px}, ${-p.py})\n`);
    }
    const auto = J.anims.find((a) => a.name === 'idle') || J.anims[0];
    out.push(`[node name="AnimationPlayer" type="AnimationPlayer" parent="."]\nlibraries = {\n&"": SubResource("AnimationLibrary_main")\n}\n` + (auto ? `autoplay = &"${auto.name}"\n` : ''));
    return out.join('\n');
  };
  RX.godotEventsScript = () => `extends Node2D
## PixelRig Studio rig root. The AnimationPlayer calls _on_rig_event on marked frames
## ("hit" on the contact frame of an attack, or the name of an effect to spawn).
## Connect to rig_event to deal damage or play VFX/SFX in sync with the animation.

signal rig_event(event_name: StringName)

@onready var animation_player: AnimationPlayer = $AnimationPlayer

func _on_rig_event(event_name: StringName) -> void:
	rig_event.emit(event_name)

## Plays an animation by name ("idle", "walk", "blade_slash1", ...).
func play(anim_name: StringName) -> void:
	animation_player.play(anim_name)

## 1 = face right, -1 = face left.
func set_facing(dir: int) -> void:
	scale.x = absf(scale.x) * (1.0 if dir >= 0 else -1.0)
`;
})();
