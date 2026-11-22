# PixelRig Studio: notes for Claude

A browser tool (plain HTML/JS, no build, no dependencies) that rigs a 2D character on a bone skeleton,
plays procedural locomotion and keyframed attack clips with weapons and effects, renders as crisp pixel art
or smooth 2D, and bakes sprite sheets for Godot 4, Unity and Roblox. The user speaks Thai: UI text is Thai.

Run: open `index.html` directly, or `python -m http.server 8765` in this folder and open http://localhost:8765.
All scripts are classic `<script>` tags sharing the global `PR` namespace (so file:// works). Keep it that way:
no ES modules, no fetch of local files, no CDN.

## Files
| file | what |
|---|---|
| `src/core.js` | math, 2D matrices, color tokens, `PR.drawShapes`, `PR.pixelize` (alpha threshold = pixel look), 3x5 pixel font |
| `src/data/equipment.js` | palette, body shapes per bone, hair styles, equipment slots/items, `PR.DEFAULT_CHAR` |
| `src/data/weapons.js` | weapons (shapes, tip/base trail points, two-hand grip), off-hands, elements (color ramps), move sets + stances |
| `src/rig.js` | skeleton `PR.BONES`, FK, auto-grounding, two-hand IK, cape/hair secondary motion, drawing, training dummy |
| `src/motion.js` | `PR.locoPose` (idle/walk/run), clip sampling, `PR.Character` (input, combos, events, trail) |
| `src/fx.js` | effect types (`PR.FXT.*`): slash, spark, flash, burst, ring, debris, dust, lines, projectile, lightning, circle, pillar, aura, meteor, rain, afterimage, number |
| `src/scene.js` | scene (character + dummy + fx), hit logic, camera, render pipeline (bg → color [pixelized] → additive light) |
| `src/data/moves_weapons.js`, `moves_common.js` | built-in clips |
| `src/data/my_moves.js` | **the user's own clips: add new moves here** |
| `src/editor.js` | edit mode: drag bones (FK, IK for hands/feet), timeline, clip JSON, Claude prompt builder, PNG-per-bone |
| `src/export.js`, `src/zip.js` | `PR.bake` → `PR.packSheets` → zip with PNG + Aseprite JSON + Godot `.tres` + Roblox Luau + Unity frames; also the export panel UI |
| `src/rigexport.js` | skeletal export: `renderParts` (one image per draw slot), `packAtlas` (+ mirrored copy), `sampleAnim` (bakes per-bone local rot/x/y/sx/sy at N fps, unwrapped, key-reduced), `build`, reference player `poseRig`/`drawRig`, Godot 4 `.tscn` |
| `src/rigexport_engines.js` | Unity editor importer C# + `PixelRigEvents.cs`, Roblox Luau rig player, rig zip + README |
| `src/paint.js` | pixel editor core `PR.paint`: doc/layers (Uint8ClampedArray RGBA), tools (pixel-perfect pencil, eraser, fill, line, rect, Zingl ellipse, picker, select, move/float, palette shade, dither), symmetry, undo/redo snapshots, commands (flip, rotate, outline, resize, layers), view (zoom steps, pan, grid), hue-shifted ramps `P.ramp` |
| `src/paint_ui.js` | pixel editor UI `PR.paintUI`: tool bar, options, status, colors/palette, layers, file commands, shortcuts, and the rig bridge (`openPart` from `rigExport.renderParts`, `applyPart` → `cfg.images[slot]` with `paint: {R, px, py, rot}`, far-limb darker copy, live preview) |
| `src/paint_timeline.js` | frame animation UI: thumbnails, playback (`P.tick`, ping-pong, tag ranges), durations, onion skin, tags, sprite-sheet import, `UI.animSheet` → `PR.exportZip` (per-frame `dur` flows into Aseprite JSON, Godot SpriteFrames relative durations and Roblox Luau) |
| `src/paint_store.js` | saving drawings `PR.paintStore`: `.pxrig` format (`format: 'pixelrig-paint'`, one PNG data URL per cel, null = empty), autosave to IndexedDB (localStorage fallback, `paintPending` flush on unload), named library (`paint:lib:<name>`), file save/open, `exportAll`/`importAll` used by the project file |
| `src/config.js` | settings tab: `PR.config` (load/save, data overrides deep-merged over `PR.DEFAULTS`, character library, project import/export) and `PR.configUI` |
| `src/app.js`, `src/ui.js`, `index.html` | shell, play panel, keyboard, DOM helpers, layout/CSS |

## Pixel editor document
- `doc = {w, h, layers[{name, visible, locked, cv, data}], frames[{dur, cels[]}], frame, tags[{name, from, to}], active, ref, target}`.
  `layer.data` is always the cel of the current frame (`P.bindFrame`), so tools edit the current frame. Layer ops and canvas ops (flip, rotate, resize)
  go through every frame (`P.eachCel`); outline/clear/fill/strokes touch the current cel only. Undo snapshots hold every cel (memory-capped).

## Bone images (pixel parts)
- `cfg.images[slot] = {src, x, y, s, r, hide, paint?}`: drawn in the bone's space as translate(x, y) · rotate(r°) · drawImage(0, 0, w·s, h·s).
  A part painted at R px/unit with the bone origin at image pixel (px, py) has s = 1/R, x = -px/R, y = -py/R (rotated by r when the art was drawn turned).
- All rigs share `PR.IMG_CACHE` so bakes/exports see images that are already decoded. Painted parts flow into sprite sheets and the skeletal export automatically.

## Configuration (everything is data)
- `PR.CFG` (core.js, defaults in `PR.CFG_DEFAULTS`): `render` (outline, back-limb shade, pixel threshold, background/floor), `fx` (shake, hit-stop, particles, glow, trail, numbers, crit), `cloth` (cape/hair spring).
- `PR.MOTION` (motion.js) + `PR.MOTION_LABELS`: every idle/walk/run number. `Character.prm` starts as a copy.
- Per character `cfg.body` (rig.js `PR.DEFAULT_BODY`, `PR.BODY_PRESETS`, `PR.boneScale`): each bone gets [width, length] factors.
  `Rig.setConfig` builds `rig.bones`, `rig.boneMap`, `rig.len(n)`, `rig.fist`, `rig.leg` and pre-scaled shapes. **Use those, never `PR.BONES`/`PR.FIST`/`PR.LEG` directly, for anything posed.**
- Data overrides (`PR.config.overrides`, saved in localStorage, editable as JSON in the tab): `{WEAPONS, OFFHANDS, ELEMENTS, SETS, HAIR, EQUIP, BASE_PALETTE, BODY_PRESETS}`
  deep-merged over `PR.DEFAULTS`; `EQUIP` slot arrays merge by item `id`; a `null` value deletes. `PR.config.set(path, value)` writes one value and rebuilds.
- New things added through overrides need no code change. To make them permanent for everyone, move them into the data files.

## Coordinate and angle conventions (get these right)
- Character space: faces RIGHT, +x forward, **y down**, origin on the ground. ~50 units tall (legs 7+7, torso 13, head ~16, arms 7+6).
- Rotations are degrees, screen-clockwise, relative to the parent bone.
- Limbs hang along +y at 0, so for `armF/armB/thighF/thighB` **negative = swing forward**: armF -90 points forward,
  -180 straight up through the front, +90 backward. `foreF/foreB` negative bends the elbow; `shinF/shinB` positive bends the knee.
- `torso`, `head` point up, so positive = lean/nod forward. `lean` rotates the whole body (e.g. -88 = lying on the back).
- Weapon space: origin at the fist, +x along the blade (forward when the arm hangs down). Blade screen direction ≈ `armF + foreF + wrot + torso`
  (0 forward, -90 up, 90 down, ±180 back). Angles are never wrapped: -200 → 40 sweeps over the head through the front.
- `F` = near side (drawn in front, holds the weapon), `B` = far side (drawn behind, darker, off-hand).

## Clip format (moves)
```js
{ id: 'my_flame_cross', name: 'ชื่อท่า', group: 'mine', set: 'blade', dur: 0.8, loop: false, hold: false,
  trail: [0.08, 0.5],                     // weapon trail window (s)
  keys: [ { t: 0, x: 0 }, { t: 0.1, ease: 'out', armF: -170, foreF: -30, wrot: -5, torso: -8 }, ... ],
  events: [ { t: 0.11, fx: 'slash', x: 6, y: -20, r: 20, a0: -120, a1: 50, thick: 6 },
            { t: 0.13, hit: { range: [0, 34], dmg: [8, 12], knock: 4, stop: 0.05, shake: 1.5 } } ] }
```
- Each channel is its own track made of the keys that mention it; a channel that starts after t=0 eases in from the base pose
  (offsets x/y/sx from their defaults). Unmentioned channels keep the base pose (locomotion + weapon stance).
- Channels: every bone in `PR.POSE_BONES`, plus `x` (forward offset, committed to the position when the clip ends), `y` (negative = up),
  `lean`, `wrot`, `wsc`, `sx` (1 → -1 → 1 = fake turn; spins), `ik2` (0–1 off-hand on a two-handed grip).
- Easing (`PR.ease`): linear, in, out, inout, outCubic, outExpo, outBack, inBack, step. It applies from the previous key to this key.
- `hold: true` keeps the last pose until the player moves (sit, die, guard). `lock: false` lets the player move during the clip.
- Events: `fx` (any `PR.FXT` type) with `at: body|tip|hand|feet|target`, `x` (forward), `y` (up negative) and type params;
  `hit` with `range: [x0,x1]` (melee box in front) or `area: r` (around the event position), `dmg`, `knock`, `launch`, `stop` (hit-stop s), `shake`, `crit`;
  `afterimage: true|seconds`; `shake: n`. Any event can set `el` (none, fire, ice, thunder, poison, holy, shadow).
- Quality bar: anticipation opposite to the blow, a 0.05–0.1 s strike with `outExpo`/`outCubic`, hit event + small hit-stop on contact,
  follow-through, recover to the stance (`ST.<set>` in moves_weapons.js) by the last key, feet step with the blow, elbows slightly bent.

## Common tasks
- **New move**: add a clip to `src/data/my_moves.js` (`group: 'mine'`, `set: '<blade|heavy|pole|magic|bow|fist>'` so it shows for that weapon).
  To make it a weapon's combo/skill instead, add it to `moves_weapons.js` and list its id in `PR.SETS[set].attacks/skills`.
- **New weapon**: add to `PR.WEAPONS` (shapes in weapon space, `tip`/`base` for the trail, `two: true` + `grip2` for two-handed, `pal` colors, `set`).
- **New equipment / hair**: add an item to `PR.EQUIP[slot]` or `PR.HAIR` with `pal` overrides and/or `shapes: { bone: [...] }`
  (`skirt` draws on the pelvis in front of the legs; capes use `cape1..3`, long hair `hair1..2`).
- **New effect**: add `PR.FXT.<name> = { init(f, o, scene), update(f, dt, scene) -> false when done, draw(f, g, V, pass) }`.
  Draw solid shapes in `back`/`front` (they get pixelized), glow in `light` (additive). Use `f.ramp` for colors and `V.p(x, y, z)` for positions.
- **New move set**: add to `PR.SETS` with a `stance` and `attacks`/`skills`, then point weapons at it.

## Skeletal rig export (rig JSON)
- Format `pixelrig-skeleton` v1: `bones[] {name, parent, x, y, rot, sx, sy}` (rest pose, parents listed first), `parts[] {name, bone, order, x, y, w, h, px, py, file}`
  (atlas rect; px/py = bone origin inside the part image; `order` = draw order), `anims[] {name, fps, length, loop, tracks[] {bone, prop: rot|x|y|sx|sy, times[], values[]}, events[] {t, name}}`.
- Pixels, y down, degrees clockwise, node transform = translate · rotate · scale, linear keys. Keep it `JsonUtility`-compatible (no dictionaries, no nested arrays): the Unity importer parses it.
- Values are sampled from the live rig (FK + IK + auto-ground + cape physics) at >= 120 Hz, then key-reduced (rot 0.25°, pos 0.05 px), so engines match the app.
  Every animation keys every property any animation touches (Godot keeps stale values otherwise).
- Root `sx` carries the fake-spin flip; GUI engines (Roblox) can't shear, so mid-spin squash is approximated there.
- Verified: Godot 4.7 headless loads the `.tscn`, bones land within 0.01 px of `poseRig`, method-track events fire. The Unity C# compiles against Unity API
  signatures but has not been run in a Unity editor yet. The Luau posing math was ported to JS and matches `drawRig` pixel-for-pixel (except mid-spin squash).

## Checking your work
Load the page, open the console, and check there are no errors. To look at a move frame by frame:
`PR.bake(PR.app.cfg, [{id:'blade_slash1'}], {scale:3, pixel:false, fps:12, locoFrames:8, fx:true, char:true, inPlace:true, prm: PR.app.scene.ch.prm})`
then `PR.packSheets(baked, {maxW: 2000, name:'qa', upscale:1})[0].sheet` is a canvas contact sheet you can view.
