'use strict';
// Sprite baking + engine packaging (Godot 4 SpriteFrames, Unity frames/grid, Roblox Luau module, Aseprite-style JSON).
(() => {
  const U = PR.ui;
  PR.LOCO_ANIMS = { idle: 'ยืน (idle)', walk: 'เดิน (walk)', run: 'วิ่ง (run)' };

  // Render every frame of every animation, crop all frames to one shared cell, keep the pivot at the feet.
  // anims: [{id, frames?}] ; o: {scale, pixel, fps, locoFrames, fx, char, shadow, inPlace, facing, pad, prm}
  PR.bake = (cfg, anims, o) => {
    const S = o.scale, bw = Math.round(240 * S), bh = Math.round(170 * S), groundRow = Math.round(bh * 0.7);
    const camY = (bh / 2 - groundRow) / S;
    const raw = [];
    for (const a of anims) {
      const sc = new PR.Scene(PR.clone(cfg));
      sc.showDummy = false; sc.noFreeze = true;
      const ch = sc.ch;
      Object.assign(ch.prm, o.prm || {});
      ch.facing = 1;
      const loco = !!PR.LOCO_ANIMS[a.id];
      let n, dt;
      if (loco) {
        ch.autoMove = { idle: 0, walk: 1, run: 2 }[a.id];
        for (let i = 0; i < 120; i++) sc.update(1 / 60, {});
        const sp = a.id === 'walk' ? ch.prm.walkSpeed : ch.prm.runSpeed;
        const period = a.id === 'idle' ? (Math.PI * 2) / 1.9 : (2 * ch.prm.stride) / sp;
        n = a.frames || o.locoFrames; dt = period / n;
      } else {
        const clip = PR.getClip(a.id);
        if (!clip) continue;
        for (let i = 0; i < 40; i++) sc.update(1 / 60, {});
        sc.fx.clear();
        ch.play(a.id, { force: true });
        n = a.frames || Math.max(2, Math.round(clip.dur * o.fps)); dt = clip.dur / n;
      }
      let evs = [];
      const orig = sc.handleEvent.bind(sc);
      sc.handleEvent = (c, e) => { evs.push(e.hit ? 'hit' : e.fx || (e.afterimage ? 'afterimage' : e.shake ? 'shake' : 'event')); orig(c, e); };
      for (let i = 0; i < n; i++) {
        const rootX = loco ? 0 : (ch.clip ? (ch.lastX || 0) : 0) + (ch.x) * ch.facing;
        const camX = o.inPlace ? ch.x + (ch.clip ? (ch.lastX || 0) * ch.facing : 0) : 0;
        const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
        sc.render(cv.getContext('2d'), { mode: o.pixel ? 'pixel' : 'hd', fixed: { bw, bh, S, camX, camY }, W: bw, H: bh, noBg: true, shadow: o.shadow }, { hideChar: !o.char });
        raw.push({ anim: a.id, i, cv, events: evs, rootX: +rootX.toFixed(2), loop: loco || !!(PR.getClip(a.id) || {}).loop, fps: loco ? 1 / dt : o.fps });
        evs = [];
        const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
        for (let s = 0; s < sub; s++) sc.update(dt / sub, {});
        if (!o.fx) sc.fx.clear();
      }
    }
    // shared crop box
    let x0 = bw, y0 = bh, x1 = -1, y1 = -1;
    for (const f of raw) {
      const d = f.cv.getContext('2d').getImageData(0, 0, bw, bh).data;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        if (d[(y * bw + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
    const pad = o.pad ?? 2;
    // keep the pivot horizontally centered so flipping in-engine does not shift the sprite
    const cx = bw / 2, half = Math.max(cx - x0, x1 + 1 - cx);
    x0 = Math.floor(cx - half) - pad; x1 = Math.ceil(cx + half) + pad;
    y0 -= pad; y1 = Math.max(y1, groundRow) + pad;
    const cw = x1 - x0, chh = y1 - y0;
    return { frames: raw, cw, ch: chh, x0, y0, pivot: { x: cx - x0, y: groundRow - y0 } };
  };

  // Pack baked frames into sheets. Each animation starts a new row; rows wrap at maxW.
  PR.packSheets = (baked, o) => {
    const up = o.upscale || 1, cw = baked.cw * up, chh = baked.ch * up;
    const byAnim = [];
    for (const f of baked.frames) { let g = byAnim.find((a) => a.id === f.anim); if (!g) byAnim.push((g = { id: f.anim, frames: [] })); g.frames.push(f); }
    const groups = o.split ? byAnim.map((a) => [a]) : [byAnim];
    return groups.map((group) => {
      const total = group.reduce((s, a) => s + a.frames.length, 0);
      const widest = o.rowPerAnim ? Math.max(...group.map((a) => a.frames.length)) : total;
      const cols = Math.max(1, Math.min(Math.floor(o.maxW / cw), widest));
      let rows = 0;
      if (o.rowPerAnim) for (const a of group) rows += Math.ceil(a.frames.length / cols);
      else rows = Math.ceil(total / cols);
      const sheet = document.createElement('canvas'); sheet.width = cols * cw; sheet.height = rows * chh;
      const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
      const frames = [], anims = [];
      let row = 0, idx = 0;
      for (const a of group) {
        const from = idx;
        a.frames.forEach((f, i) => {
          const cell = o.rowPerAnim ? i : idx;   // dense packing by default (smaller sheets, fits Roblox's 1024px)
          const x = (cell % cols) * cw, y = ((o.rowPerAnim ? row : 0) + Math.floor(cell / cols)) * chh;
          g.drawImage(f.cv, baked.x0, baked.y0, baked.cw, baked.ch, x, y, cw, chh);
          frames.push({ name: `${a.id}_${String(i).padStart(2, '0')}`, anim: a.id, x, y, w: cw, h: chh, events: f.events, rootX: f.rootX * up * (o.scale || 1), fps: f.fps });
          idx++;
        });
        row += Math.ceil(a.frames.length / cols);
        anims.push({ id: a.id, from, to: idx - 1, fps: +a.frames[0].fps.toFixed(3), loop: a.frames[0].loop });
      }
      return { name: o.split ? `${o.name}_${group[0].id}` : o.name, sheet, frames, anims, cw, ch: chh, pivot: { x: baked.pivot.x * up, y: baked.pivot.y * up } };
    });
  };

  // ---- engine files ----
  const asepriteJson = (s) => JSON.stringify({
    frames: s.frames.map((f) => ({ filename: f.name, frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, duration: f.dur ?? Math.round(1000 / f.fps) })),
    meta: {
      app: 'PixelRig Studio', version: '1.0', image: s.name + '.png', format: 'RGBA8888', size: { w: s.sheet.width, h: s.sheet.height }, scale: '1',
      frameTags: s.anims.map((a) => ({ name: a.id, from: a.from, to: a.to, direction: 'forward' })),
      pixelrig: {
        cell: { w: s.cw, h: s.ch }, pivot: s.pivot, pivotNormalized: { x: +(s.pivot.x / s.cw).toFixed(4), y: +(1 - s.pivot.y / s.ch).toFixed(4) },
        animations: Object.fromEntries(s.anims.map((a) => [a.id, { fps: a.fps, loop: a.loop, frames: s.frames.slice(a.from, a.to + 1).map((f, i) => ({
          index: a.from + i, events: f.events, rootX: f.rootX })) }])),
      },
    },
  }, null, 1);

  const godotTres = (s, folder) => {
    const out = [];
    out.push(`[gd_resource type="SpriteFrames" load_steps=${s.frames.length + 2} format=3]\n`);
    out.push(`[ext_resource type="Texture2D" path="res://${folder}/${s.name}.png" id="1_sheet"]\n`);
    s.frames.forEach((f, i) => out.push(`[sub_resource type="AtlasTexture" id="AtlasTexture_${i}"]\natlas = ExtResource("1_sheet")\nregion = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})\n`));
    const anims = s.anims.map((a) => {
      const fr = [];
      const base = s.frames[a.from].dur || 0;   // per-frame durations are relative to the animation speed
      for (let i = a.from; i <= a.to; i++) {
        const dur = base && s.frames[i].dur ? (s.frames[i].dur / base).toFixed(3) : '1.0';
        fr.push(`{\n"duration": ${dur},\n"texture": SubResource("AtlasTexture_${i}")\n}`);
      }
      return `{\n"frames": [${fr.join(', ')}],\n"loop": ${a.loop},\n"name": &"${a.id}",\n"speed": ${a.fps.toFixed(2)}\n}`;
    });
    out.push(`[resource]\nanimations = [${anims.join(', ')}]\n`);
    return out.join('\n');
  };

  const robloxLua = (s) => {
    const anims = s.anims.map((a) => {
      const fr = s.frames.slice(a.from, a.to + 1).map((f) => `{${f.x}, ${f.y}${f.dur ? ', ' + (f.dur / 1000).toFixed(3) : ''}}`).join(', ');
      const hits = s.frames.slice(a.from, a.to + 1).map((f, i) => (f.events.includes('hit') ? i + 1 : null)).filter((v) => v);
      return `\t["${a.id}"] = { fps = ${a.fps.toFixed(2)}, loop = ${a.loop}, hitFrames = {${hits.join(', ')}}, frames = {${fr}} },`;
    }).join('\n');
    return `-- ${s.name}: sprite animations exported from PixelRig Studio.
-- 1) Upload ${s.name}.png (Asset Manager / Creator Hub) and paste its asset id below.
-- 2) Put this ModuleScript in ReplicatedStorage. 3) From a LocalScript:
--      local Sprite = require(game.ReplicatedStorage.${s.name}_sprite)
--      local stop = Sprite.Play(script.Parent.ImageLabel, "walk")
local RunService = game:GetService("RunService")

local M = {}
M.Image = "rbxassetid://0" -- TODO: your uploaded sheet id
M.SheetSize = Vector2.new(${s.sheet.width}, ${s.sheet.height})
M.FrameSize = Vector2.new(${s.cw}, ${s.ch})
M.Pivot = Vector2.new(${s.pivot.x}, ${s.pivot.y}) -- feet position inside a frame, in pixels
M.Animations = {
${anims}
}

-- Plays an animation on an ImageLabel/ImageButton. onHit(frameIndex) fires on frames marked as hits.
-- Returns a function that stops the animation.
function M.Play(label: ImageLabel, name: string, onHit: ((number) -> ())?, onDone: (() -> ())?): () -> ()
\tlocal anim = M.Animations[name]
\tassert(anim, "PixelRig: no animation named " .. tostring(name))
\tlabel.Image = M.Image
\tlabel.ImageRectSize = M.FrameSize
\tlabel.ResampleMode = Enum.ResamplerMode.Pixelated
\tlabel.BackgroundTransparency = 1
\tlocal function frameTime(i: number): number
\t\treturn anim.frames[i][3] or (1 / anim.fps) -- optional per-frame duration in seconds
\tend
\tlocal index, acc = 1, 0
\tlocal function show(i: number)
\t\tlocal f = anim.frames[i]
\t\tlabel.ImageRectOffset = Vector2.new(f[1], f[2])
\t\tif onHit and table.find(anim.hitFrames, i) then onHit(i) end
\tend
\tshow(1)
\tlocal conn: RBXScriptConnection?
\tconn = RunService.Heartbeat:Connect(function(dt: number)
\t\tacc += dt
\t\twhile acc >= frameTime(index) do
\t\t\tacc -= frameTime(index)
\t\t\tindex += 1
\t\t\tif index > #anim.frames then
\t\t\t\tif anim.loop then
\t\t\t\t\tindex = 1
\t\t\t\telse
\t\t\t\t\tindex = #anim.frames
\t\t\t\t\tif conn then conn:Disconnect() conn = nil end
\t\t\t\t\tif onDone then onDone() end
\t\t\t\t\treturn
\t\t\t\tend
\t\t\tend
\t\t\tshow(index)
\t\tend
\tend)
\treturn function()
\t\tif conn then conn:Disconnect() conn = nil end
\tend
end

return M
`;
  };

  const readme = (sheets, o) => `PixelRig Studio export: ${o.name}
================================================
Frame size: ${sheets[0].cw} x ${sheets[0].ch} px   Pivot (feet): ${sheets[0].pivot.x}, ${sheets[0].pivot.y} px from the top-left of a frame
Animations: ${sheets.flatMap((s) => s.anims.map((a) => `${a.id} (${a.to - a.from + 1}f @ ${a.fps.toFixed(1)}fps${a.loop ? ', loop' : ''})`)).join(', ')}

GODOT 4
  1. Copy the whole "${o.name}" folder into your project as res://sprites/${o.name}/
  2. Select the PNG > Import: Filter = Nearest (pixel art), Reimport.
  3. Add an AnimatedSprite2D, set Sprite Frames = godot/${sheets[0].name}.tres, pick an animation, press play.
  4. Offset: set the node's Offset to (${-(sheets[0].pivot.x - sheets[0].cw / 2)}, ${-(sheets[0].pivot.y - sheets[0].ch / 2)}) so its origin sits at the feet.
  Hit frames and root motion are listed in ${sheets[0].name}.json (meta.pixelrig.animations).

UNITY (2D)
  Option A, sprite sheet: import ${sheets[0].name}.png > Texture Type: Sprite (2D and UI), Sprite Mode: Multiple,
    Filter: Point (no filter), Compression: None, Pixels Per Unit: ${sheets[0].ch} (or your tile size).
    Sprite Editor > Slice > Grid By Cell Size ${sheets[0].cw} x ${sheets[0].ch}, Pivot: Custom (${(sheets[0].pivot.x / sheets[0].cw).toFixed(3)}, ${(1 - sheets[0].pivot.y / sheets[0].ch).toFixed(3)}).
  Option B, single frames: import the "unity_frames" folder with the same settings, select one animation's frames
    and drag them into the Scene: Unity creates the Animation Clip and Animator for you.

ROBLOX STUDIO
  1. Upload ${sheets[0].name}.png (Roblox scales images above 1024 px down, so keep sheets <= 1024).
  2. Put roblox/${sheets[0].name}_sprite.lua in ReplicatedStorage as a ModuleScript, paste the asset id into M.Image.
  3. Show it on an ImageLabel (ScreenGui, BillboardGui or SurfaceGui) with Sprite.Play(label, "walk").

ANY OTHER ENGINE (Phaser, Defold, GameMaker, LOVE...)
  ${sheets[0].name}.json uses the Aseprite / TexturePacker "array" format with frameTags.
`;

  PR.exportZip = async (sheets, o) => {
    const files = [];
    const folder = `sprites/${o.name}`;
    for (const s of sheets) {
      files.push({ name: `${o.name}/${s.name}.png`, data: await PR.canvasToBytes(s.sheet) });
      files.push({ name: `${o.name}/${s.name}.json`, data: asepriteJson(s) });
      files.push({ name: `${o.name}/godot/${s.name}.tres`, data: godotTres(s, folder) });
      files.push({ name: `${o.name}/roblox/${s.name}_sprite.lua`, data: robloxLua(s) });
      for (const f of s.frames) {
        const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
        c.getContext('2d').drawImage(s.sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        files.push({ name: `${o.name}/unity_frames/${f.anim}/${f.name}.png`, data: await PR.canvasToBytes(c) });
      }
    }
    files.push({ name: `${o.name}/README.txt`, data: readme(sheets, o) });
    if (!o.noProject) files.push({ name: `${o.name}/pixelrig_project.json`, data: JSON.stringify({ character: PR.app.cfg, clips: PR.USER_CLIPS }, null, 1) });
    return PR.makeZip(files);
  };

  // ---- panel ----
  const st = U.store.get('export', { name: 'hero', fps: 12, locoFrames: 8, scale: 1, upscale: 1, fx: true, char: true, shadow: false, inPlace: true, maxW: 1024, split: false, picked: null });
  PR.exporter = {
    buildPanel(panel) {
      const app = PR.app, ch = app.scene.ch, set = ch.set;
      const save = () => U.store.set('export', st);
      const all = [
        ...Object.entries(PR.LOCO_ANIMS),
        ...[...new Set([...set.attacks, ...set.skills])].map((id) => [id, (PR.getClip(id) || {}).name || id]),
        ...PR.COMMON_MOVES.map((id) => [id, PR.getClip(id).name]),
        ...Object.values(PR.CLIPS).filter((c) => c.group === 'mine').map((c) => [c.id, c.name]),
        ...Object.values(PR.USER_CLIPS).map((c) => [c.id, c.name + ' (ของฉัน)']),
      ];
      const picked = new Set(st.picked && st.picked.length ? st.picked : ['idle', 'walk', 'run', ...set.attacks, ...set.skills]);
      const checks = U.el('div', { class: 'checks' }, all.map(([id, name]) => U.el('label', {}, [
        U.el('input', { type: 'checkbox', checked: picked.has(id), onchange: (e) => { e.target.checked ? picked.add(id) : picked.delete(id); st.picked = [...picked]; save(); } }), name])));
      const nameIn = U.el('input', { type: 'text', value: st.name, oninput: () => { st.name = nameIn.value.replace(/[^\w-]/g, '_') || 'hero'; save(); } });
      const chk = (k, label) => U.el('label', { style: 'display:flex;gap:6px;align-items:center' }, [U.el('input', { type: 'checkbox', checked: st[k], onchange: (e) => { st[k] = e.target.checked; save(); } }), label]);
      const info = U.el('div', { class: 'note' });
      const img = U.el('img', { id: 'sheetPreview', class: 'hidden', alt: 'ตัวอย่างสไปรต์ชีต' });
      let last = null;
      const run = () => {
        const o = Object.assign({}, st, { pixel: app.view.mode === 'pixel', prm: ch.prm });
        const anims = all.filter(([id]) => picked.has(id)).map(([id]) => ({ id }));
        if (!anims.length) { U.toast('เลือกท่าอย่างน้อย 1 ท่า'); return null; }
        const t0 = performance.now();
        const baked = PR.bake(app.cfg, anims, o);
        const sheets = PR.packSheets(baked, o);
        last = { sheets, o };
        img.src = sheets[0].sheet.toDataURL(); img.classList.remove('hidden');
        const big = sheets.some((s) => s.sheet.width > 1024 || s.sheet.height > 1024);
        info.innerHTML = `${sheets.length} ชีต · เฟรม ${sheets[0].cw}×${sheets[0].ch}px · ชีตแรก ${sheets[0].sheet.width}×${sheets[0].sheet.height}px · ${baked.frames.length} เฟรม · ${Math.round(performance.now() - t0)}ms` +
          (big ? '<br><b style="color:var(--danger)">ชีตใหญ่กว่า 1024px: Roblox จะย่อภาพ ให้ติ๊ก "แยกไฟล์ต่อท่า" หรือลดท่า</b>' : '<br><span class="ok">ขนาดใช้กับ Roblox ได้ (≤1024px)</span>');
        return last;
      };
      panel.append(U.card('ส่งออกสไปรต์สำหรับเกม', [
        U.row('ชื่อชุด', nameIn),
        U.el('h4', { text: 'เลือกท่า' }), checks,
        U.row('FPS ท่าโจมตี', U.select([8, 10, 12, 15, 20, 24, 30].map((v) => [v, v + ' fps']), st.fps, (v) => { st.fps = +v; save(); })),
        U.row('เฟรมท่าวน', U.select([4, 6, 8, 10, 12, 16].map((v) => [v, v + ' เฟรม']), st.locoFrames, (v) => { st.locoFrames = +v; save(); })),
        U.row('ความละเอียด', U.select([[1, '1 px/หน่วย (พิกเซลแท้ ~50px สูง)'], [1.5, '1.5'], [2, '2 (~100px)'], [3, '3 (~150px)'], [4, '4 (HD)']], st.scale, (v) => { st.scale = +v; save(); })),
        U.row('ขยายแบบพิกเซล', U.select([[1, '×1'], [2, '×2'], [3, '×3'], [4, '×4']], st.upscale, (v) => { st.upscale = +v; save(); })),
        U.row('ขนาดชีตสูงสุด', U.select([[1024, '1024 (Roblox)'], [2048, '2048'], [4096, '4096']], st.maxW, (v) => { st.maxW = +v; save(); })),
        U.el('div', { class: 'checks', style: 'margin-top:6px' }, [chk('char', 'ตัวละคร'), chk('fx', 'เอฟเฟกต์'), chk('shadow', 'เงาใต้เท้า'), chk('inPlace', 'ล็อกกับที่ (in-place)'), chk('split', 'แยกไฟล์ต่อท่า'), chk('rowPerAnim', 'ท่าละแถว')]),
        U.el('div', { class: 'note', text: 'สไตล์ภาพตามปุ่ม Pixel / 2D HD ด้านบน · ปิด "ตัวละคร" เพื่อส่งออกเอฟเฟกต์อย่างเดียว' }),
        U.el('div', { class: 'btns', style: 'margin-top:8px' }, [
          U.button('ดูตัวอย่างชีต', () => run()),
          U.button('ดาวน์โหลด ZIP (Godot · Unity · Roblox)', async () => {
            const r = run(); if (!r) return;
            U.toast('กำลังแพ็กไฟล์...');
            U.download(await PR.exportZip(r.sheets, r.o), `${r.o.name}_pixelrig.zip`);
          }, 'pri'),
          U.button('PNG อย่างเดียว', () => { const r = run(); if (r) r.sheets[0].sheet.toBlob((b) => U.download(b, r.sheets[0].name + '.png')); }),
        ]),
        info, img,
      ]));
      // ---- skeletal rig export ----
      st.rigScale = st.rigScale || 2; st.rigFps = st.rigFps || 30;
      const rigInfo = U.el('div', { class: 'note' });
      const rigCv = U.el('canvas', { width: 360, height: 220, class: 'hidden', style: 'width:100%;border-radius:8px;border:1px solid var(--line);background:#1b1230;margin-top:8px' });
      const atlasImg = U.el('img', { id: 'rigAtlas', class: 'hidden', alt: 'แผ่นรวมชิ้นส่วน', style: 'max-width:100%;margin-top:8px;background:repeating-conic-gradient(#2a2240 0% 25%, #1d1630 0% 50%) 50% / 16px 16px;border-radius:8px' });
      let rigLast = null;
      const runRig = () => {
        const ids = all.filter(([id]) => picked.has(id)).map(([id]) => id);
        if (!ids.length) { U.toast('เลือกท่าอย่างน้อย 1 ท่า'); return null; }
        const o = { name: st.name, scale: st.rigScale, rigFps: st.rigFps, pixel: app.view.mode === 'pixel', inPlace: st.inPlace, prm: ch.prm };
        const t0 = performance.now();
        const rig = PR.rigExport.build(app.cfg, ids, o);
        const keys = rig.json.anims.reduce((s, a) => s + a.tracks.reduce((q, t) => q + t.times.length, 0), 0);
        rigInfo.innerHTML = `${rig.json.bones.length} กระดูก · ${rig.json.parts.length} ชิ้นส่วน · แผ่นรวม ${rig.pack.W}×${rig.pack.H}px · ${rig.json.anims.length} ท่า · ${keys} คีย์ · ${Math.round(performance.now() - t0)}ms`;
        atlasImg.src = rig.pack.atlas.toDataURL(); atlasImg.classList.remove('hidden');
        rigCv.classList.remove('hidden');
        rigLast = rig;
        // animated preview played from the exported data (what the engines will show)
        const g = rigCv.getContext('2d'), start = performance.now(), my = (PR.exporter.previewId = (PR.exporter.previewId || 0) + 1);
        const loop = () => {
          if (PR.exporter.previewId !== my || !rigCv.isConnected) return;
          const total = rig.json.anims.reduce((s, a) => s + Math.max(a.length, 0.8) + 0.3, 0);
          let t = ((performance.now() - start) / 1000) % total, A = rig.json.anims[0];
          for (const a of rig.json.anims) { const span = Math.max(a.length, 0.8) + 0.3; if (t < span) { A = a; break; } t -= span; }
          g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1b1230'; g.fillRect(0, 0, rigCv.width, rigCv.height);
          g.imageSmoothingEnabled = !rig.json.pixelArt;
          const k = 140 / (50 * rig.json.scale);
          PR.rigExport.drawRig(g, rig.json, rig.pack.atlas, A, Math.min(t, A.length), [k, 0, 0, k, rigCv.width / 2, rigCv.height - 30]);
          g.fillStyle = '#9a90b5'; g.font = '12px sans-serif'; g.fillText(A.name, 10, 18);
          requestAnimationFrame(loop);
        };
        loop();
        return rig;
      };
      panel.append(U.card('ส่งออกโครงกระดูก (Skeletal rig)', [
        U.el('div', { class: 'note', text: 'ตัดตัวละครเป็นชิ้นส่วนบนกระดูก แล้วให้เอนจินขยับกระดูกเอง: ภาพลื่นทุกขนาด ปรับท่า/ผสมท่าในเอนจินได้ ใช้ท่าที่ติ๊กด้านบน' }),
        U.row('ความละเอียด', U.select([[1, '1 px/หน่วย'], [2, '2 (แนะนำ)'], [3, '3'], [4, '4 (HD)']], st.rigScale, (v) => { st.rigScale = +v; save(); })),
        U.row('คีย์ต่อวินาที', U.select([15, 24, 30, 60].map((v) => [v, v + ' fps']), st.rigFps, (v) => { st.rigFps = +v; save(); })),
        U.el('div', { class: 'btns', style: 'margin-top:8px' }, [
          U.button('ดูตัวอย่าง rig', () => runRig()),
          U.button('ดาวน์โหลด Rig ZIP (Godot · Unity · Roblox)', async () => {
            const rig = runRig(); if (!rig) return;
            U.toast('กำลังแพ็กไฟล์ rig...');
            U.download(await PR.rigExport.zip(rig, { name: st.name }), `${st.name}_rig.zip`);
          }, 'pri'),
        ]),
        rigInfo, rigCv, atlasImg,
        U.el('div', { class: 'note', html: '• <b>Godot 4</b>: ฉาก .tscn พร้อม Skeleton2D / Bone2D / Sprite2D และ AnimationPlayer ทุกท่า + สัญญาณ rig_event("hit")<br>' +
          '• <b>Unity</b>: สคริปต์ Editor สร้าง Prefab + Animation Clip + Animator Controller ให้อัตโนมัติ (คลิกขวาไฟล์ .rig.json)<br>' +
          '• <b>Roblox</b>: ModuleScript ขยับ ImageLabel ทีละชิ้น หันซ้าย/ขวาได้ พร้อม OnEvent("hit")<br>' +
          '• ภาพพิกเซลจะหมุนเป็นบิตแมปในเอนจิน ถ้าต้องการพิกเซลคมทุกเฟรมให้ใช้สไปรต์ชีตด้านบน' }),
      ]));
      panel.append(U.card('ในไฟล์ ZIP มีอะไร', [U.el('div', { class: 'note', html:
        '• <b>PNG สไปรต์ชีต</b> + <b>JSON</b> (รูปแบบ Aseprite: เฟรม, แท็กท่า, จุดหมุนที่เท้า, เฟรมที่โดนตี, root motion)<br>' +
        '• <b>Godot 4</b>: ไฟล์ SpriteFrames <code>.tres</code> ใช้กับ AnimatedSprite2D ได้ทันที<br>' +
        '• <b>Unity</b>: เฟรมแยกทีละรูปต่อท่า (ลากลงซีนให้ Unity สร้าง Animation) หรือสไลซ์ชีตแบบกริด<br>' +
        '• <b>Roblox</b>: ModuleScript Luau เล่นอนิเมชันบน ImageLabel พร้อม callback เฟรมที่โดนตี<br>' +
        '• README อธิบายการนำเข้าแต่ละเอนจิน และไฟล์โปรเจกต์ไว้เปิดแก้ต่อ' })]));
    },
  };
})();
