'use strict';
// Skeletal rig packaging for Unity (editor importer that builds a prefab + clips + Animator) and Roblox (Luau rig player).
(() => {
  const RX = PR.rigExport;

  RX.unityImporterCs = () => `// PixelRig Studio -> Unity skeletal rig importer.
// Select a *.rig.json file in the Project window, then: right-click > PixelRig > Build Rig Prefab
// (or Tools > PixelRig > Build All Rigs). Creates sprites, a bone hierarchy, one AnimationClip per move,
// an Animator Controller and a prefab next to the JSON. Re-running rebuilds everything.
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace PixelRig
{
    public static class PixelRigImporter
    {
        [System.Serializable] public class Bone { public string name; public string parent; public float x; public float y; public float rot; public float sx = 1; public float sy = 1; }
        [System.Serializable] public class Part { public string name; public string bone; public int order; public int w; public int h; public float px; public float py; public string file; }
        [System.Serializable] public class Track { public string bone; public string prop; public float[] times; public float[] values; }
        [System.Serializable] public class RigEvent { public float t; public string name; }
        [System.Serializable] public class Anim { public string name; public float fps; public float length; public bool loop; public Track[] tracks; public RigEvent[] events; }
        [System.Serializable] public class Rig { public string name; public float ppu = 32; public bool pixelArt; public Bone[] bones; public Part[] parts; public Anim[] anims; }

        [MenuItem("Assets/PixelRig/Build Rig Prefab", true)]
        static bool ValidateSelected()
        {
            var o = Selection.activeObject;
            return o is TextAsset && AssetDatabase.GetAssetPath(o).EndsWith(".rig.json");
        }

        [MenuItem("Assets/PixelRig/Build Rig Prefab")]
        static void BuildSelected()
        {
            var prefab = Build(AssetDatabase.GetAssetPath(Selection.activeObject));
            if (prefab != null) { Selection.activeObject = prefab; EditorGUIUtility.PingObject(prefab); }
        }

        [MenuItem("Tools/PixelRig/Build All Rigs")]
        public static void BuildAll()
        {
            foreach (var guid in AssetDatabase.FindAssets("t:TextAsset"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (path.EndsWith(".rig.json")) Build(path);
            }
        }

        public static GameObject Build(string jsonPath)
        {
            var rig = JsonUtility.FromJson<Rig>(File.ReadAllText(jsonPath));
            if (rig == null || rig.bones == null) { Debug.LogError("PixelRig: not a rig file: " + jsonPath); return null; }
            var dir = Path.GetDirectoryName(jsonPath).Replace('\\\\', '/');
            float ppu = rig.ppu > 0 ? rig.ppu : 32f;

            // 1) one sprite per part, pivot at the bone origin
            var sprites = new Dictionary<string, Sprite>();
            foreach (var p in rig.parts)
            {
                var file = dir + "/" + p.file;
                var imp = AssetImporter.GetAtPath(file) as TextureImporter;
                if (imp == null) { Debug.LogError("PixelRig: missing part image " + file); continue; }
                imp.textureType = TextureImporterType.Sprite;
                imp.spriteImportMode = SpriteImportMode.Single;
                imp.spritePixelsPerUnit = ppu;
                imp.mipmapEnabled = false;
                imp.alphaIsTransparency = true;
                imp.textureCompression = TextureImporterCompression.Uncompressed;
                imp.filterMode = rig.pixelArt ? FilterMode.Point : FilterMode.Bilinear;
                var settings = new TextureImporterSettings();
                imp.ReadTextureSettings(settings);
                settings.spriteAlignment = (int)SpriteAlignment.Custom;
                settings.spritePivot = new Vector2(p.px / p.w, 1f - p.py / p.h);
                settings.spriteMeshType = SpriteMeshType.FullRect;
                imp.SetTextureSettings(settings);
                imp.SaveAndReimport();
                sprites[p.name] = AssetDatabase.LoadAssetAtPath<Sprite>(file);
            }

            // 2) bone hierarchy (JSON: pixels, y down, degrees clockwise -> Unity: units, y up, degrees counter-clockwise)
            var root = new GameObject(rig.name);
            var nodes = new Dictionary<string, Transform>();
            var paths = new Dictionary<string, string>();
            foreach (var b in rig.bones)
            {
                var go = new GameObject(b.name);
                var hasParent = !string.IsNullOrEmpty(b.parent);
                go.transform.SetParent(hasParent ? nodes[b.parent] : root.transform, false);
                go.transform.localPosition = new Vector3(b.x / ppu, -b.y / ppu, 0f);
                go.transform.localEulerAngles = new Vector3(0f, 0f, -b.rot);
                go.transform.localScale = new Vector3(b.sx, b.sy, 1f);
                nodes[b.name] = go.transform;
                paths[b.name] = hasParent ? paths[b.parent] + "/" + b.name : b.name;
            }
            foreach (var p in rig.parts)
            {
                if (!nodes.ContainsKey(p.bone)) continue;
                var art = new GameObject(p.name + "_art");
                art.transform.SetParent(nodes[p.bone], false);
                var sr = art.AddComponent<SpriteRenderer>();
                Sprite sprite;
                if (sprites.TryGetValue(p.name, out sprite)) sr.sprite = sprite;
                sr.sortingOrder = p.order;
            }

            // 3) clips + animator controller
            var animDir = dir + "/Animations";
            if (!AssetDatabase.IsValidFolder(animDir)) AssetDatabase.CreateFolder(dir, "Animations");
            var controllerPath = dir + "/" + rig.name + ".controller";
            AssetDatabase.DeleteAsset(controllerPath);
            AnimatorController controller = null;
            foreach (var a in rig.anims)
            {
                var clip = new AnimationClip { name = rig.name + "_" + a.name, frameRate = a.fps > 0 ? a.fps : 30f };
                var rotated = new HashSet<string>();
                foreach (var t in a.tracks)
                {
                    if (!paths.ContainsKey(t.bone) || t.times == null || t.times.Length == 0) continue;
                    string prop; float mul = 1f;
                    switch (t.prop)
                    {
                        case "rot": prop = "localEulerAnglesRaw.z"; mul = -1f; rotated.Add(t.bone); break;
                        case "x": prop = "m_LocalPosition.x"; mul = 1f / ppu; break;
                        case "y": prop = "m_LocalPosition.y"; mul = -1f / ppu; break;
                        case "sx": prop = "m_LocalScale.x"; break;
                        case "sy": prop = "m_LocalScale.y"; break;
                        default: continue;
                    }
                    SetCurve(clip, paths[t.bone], prop, t.times, t.values, mul);
                }
                foreach (var bone in rotated)   // Euler curves are written as a full x/y/z set
                {
                    SetCurve(clip, paths[bone], "localEulerAnglesRaw.x", new[] { 0f, a.length }, new[] { 0f, 0f }, 1f);
                    SetCurve(clip, paths[bone], "localEulerAnglesRaw.y", new[] { 0f, a.length }, new[] { 0f, 0f }, 1f);
                }
                var clipSettings = AnimationUtility.GetAnimationClipSettings(clip);
                clipSettings.loopTime = a.loop;
                AnimationUtility.SetAnimationClipSettings(clip, clipSettings);
                if (a.events != null && a.events.Length > 0)
                {
                    var evs = new AnimationEvent[a.events.Length];
                    for (int i = 0; i < evs.Length; i++)
                        evs[i] = new AnimationEvent { time = Mathf.Min(a.events[i].t, a.length), functionName = "OnRigEvent", stringParameter = a.events[i].name };
                    AnimationUtility.SetAnimationEvents(clip, evs);
                }
                var clipPath = animDir + "/" + clip.name + ".anim";
                AssetDatabase.DeleteAsset(clipPath);
                AssetDatabase.CreateAsset(clip, clipPath);
                if (controller == null) controller = AnimatorController.CreateAnimatorControllerAtPathWithClip(controllerPath, clip);
                else controller.AddMotion(clip);
            }

            var animator = root.AddComponent<Animator>();
            animator.runtimeAnimatorController = controller;
            root.AddComponent<PixelRigEvents>();
            var prefabPath = dir + "/" + rig.name + ".prefab";
            var prefab = PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
            Object.DestroyImmediate(root);
            AssetDatabase.SaveAssets();
            Debug.Log("PixelRig: built " + prefabPath + " (" + rig.anims.Length + " animations)");
            return prefab;
        }

        static void SetCurve(AnimationClip clip, string path, string prop, float[] times, float[] values, float mul)
        {
            var keys = new Keyframe[times.Length];
            for (int i = 0; i < keys.Length; i++) keys[i] = new Keyframe(times[i], values[i] * mul);
            var curve = new AnimationCurve(keys);
            for (int i = 0; i < keys.Length; i++)
            {
                AnimationUtility.SetKeyLeftTangentMode(curve, i, AnimationUtility.TangentMode.Linear);
                AnimationUtility.SetKeyRightTangentMode(curve, i, AnimationUtility.TangentMode.Linear);
            }
            AnimationUtility.SetEditorCurve(clip, EditorCurveBinding.FloatCurve(path, typeof(Transform), prop), curve);
        }
    }
}
`;

  RX.unityEventsCs = () => `using System;
using UnityEngine;

namespace PixelRig
{
    /// <summary>
    /// Sits on a PixelRig prefab root and receives the animation events baked by PixelRig Studio:
    /// "hit" on the contact frame of an attack, or the name of an effect ("slash", "burst", ...).
    /// Subscribe from your own scripts: GetComponent&lt;PixelRigEvents&gt;().OnEvent += name => { ... };
    /// </summary>
    public class PixelRigEvents : MonoBehaviour
    {
        public event Action<string> OnEvent;

        public void OnRigEvent(string eventName)
        {
            if (OnEvent != null) OnEvent(eventName);
        }

        /// <summary>1 = face right, -1 = face left.</summary>
        public void SetFacing(int dir)
        {
            var s = transform.localScale;
            s.x = Mathf.Abs(s.x) * (dir < 0 ? -1f : 1f);
            transform.localScale = s;
        }
    }
}
`;

  // ---- Roblox ----
  const num = (v) => String(Math.round(v * 10000) / 10000);
  RX.robloxModule = (J) => {
    const idx = Object.fromEntries(J.bones.map((b, i) => [b.name, i + 1]));
    const bones = J.bones.map((b) => `\t\t{ name = "${b.name}", parent = ${b.parent ? idx[b.parent] : 0}, x = ${num(b.x)}, y = ${num(b.y)}, rot = ${num(b.rot)}, sx = ${num(b.sx)}, sy = ${num(b.sy)} },`).join('\n');
    const parts = J.parts.map((p) => `\t\t{ name = "${p.name}", bone = ${idx[p.bone]}, order = ${p.order}, x = ${p.x}, y = ${p.y}, w = ${p.w}, h = ${p.h}, px = ${p.px}, py = ${p.py} },`).join('\n');
    const anims = J.anims.map((a) => {
      const tracks = a.tracks.map((t) => `\t\t\t{ bone = ${idx[t.bone]}, prop = "${t.prop}", times = { ${t.times.map(num).join(', ')} }, values = { ${t.values.map(num).join(', ')} } },`).join('\n');
      const evs = a.events.map((e) => `{ ${num(e.t)}, "${e.name}" }`).join(', ');
      return `\t\t["${a.name}"] = { length = ${num(a.length)}, loop = ${a.loop}, events = { ${evs} }, tracks = {\n${tracks}\n\t\t} },`;
    }).join('\n');
    return `-- ${J.name}_rig: 2D skeletal rig exported from PixelRig Studio (ModuleScript, client side).
-- 1) Upload ${J.image} and ${J.imageFlipped} to Roblox and paste their asset ids below.
-- 2) Put this ModuleScript in ReplicatedStorage. 3) From a LocalScript:
--      local HeroRig = require(game.ReplicatedStorage.${J.name}_rig)
--      local rig = HeroRig.new(screenGui, 2)            -- parent GUI, screen pixels per rig pixel
--      rig.Root.Position = UDim2.fromOffset(300, 400)   -- Root = the character's feet
--      rig.OnEvent = function(name) if name == "hit" then print("hit!") end end
--      rig:Play("walk")   rig:SetFacing(-1)   rig:Destroy()
-- Works in ScreenGui, BillboardGui and SurfaceGui. Each body part is an ImageLabel posed every frame.
local RunService = game:GetService("RunService")

local Data = {
\tImage = "rbxassetid://0", -- TODO: id of ${J.image}
\tImageFlipped = "rbxassetid://0", -- TODO: id of ${J.imageFlipped} (used when a part is mirrored)
\tAtlasSize = Vector2.new(${J.atlasW}, ${J.atlasH}),
\tPixelArt = ${J.pixelArt},
\tBones = {
${bones}
\t},
\tParts = {
${parts}
\t},
\tAnims = {
${anims}
\t},
}

local Rig = {}
Rig.__index = Rig
Rig.Data = Data

local function sample(track, t)
\tlocal times, values = track.times, track.values
\tlocal n = #times
\tif t <= times[1] then return values[1] end
\tif t >= times[n] then return values[n] end
\tlocal lo, hi = 1, n
\twhile hi - lo > 1 do
\t\tlocal mid = math.floor((lo + hi) / 2)
\t\tif times[mid] <= t then lo = mid else hi = mid end
\tend
\tlocal u = (t - times[lo]) / (times[hi] - times[lo])
\treturn values[lo] + (values[hi] - values[lo]) * u
end

-- 2D affine matrix {a, b, c, d, tx, ty}: x' = a*x + c*y + tx, y' = b*x + d*y + ty (y down)
local function mul(m, n)
\treturn {
\t\tm[1] * n[1] + m[3] * n[2], m[2] * n[1] + m[4] * n[2],
\t\tm[1] * n[3] + m[3] * n[4], m[2] * n[3] + m[4] * n[4],
\t\tm[1] * n[5] + m[3] * n[6] + m[5], m[2] * n[5] + m[4] * n[6] + m[6],
\t}
end

local function trs(x, y, deg, sx, sy)
\tlocal r = math.rad(deg)
\tlocal c, s = math.cos(r), math.sin(r)
\treturn { c * sx, s * sx, -s * sy, c * sy, x, y }
end

local function byBone(anim)
\tif not anim.byBone then
\t\tlocal map = {}
\t\tfor _, tr in ipairs(anim.tracks) do
\t\t\tmap[tr.bone] = map[tr.bone] or {}
\t\t\tmap[tr.bone][tr.prop] = tr
\t\tend
\t\tanim.byBone = map
\tend
\treturn anim.byBone
end

function Rig.new(parent, scale)
\tlocal self = setmetatable({}, Rig)
\tself.Scale = scale or 1
\tself.Facing = 1
\tself.Speed = 1
\tself.Time = 0
\tself.OnEvent = nil
\tself.Root = Instance.new("Frame")
\tself.Root.Name = "PixelRig"
\tself.Root.BackgroundTransparency = 1
\tself.Root.Size = UDim2.fromOffset(0, 0)
\tself.Root.Parent = parent
\tself.Labels = {}
\tfor i, part in ipairs(Data.Parts) do
\t\tlocal img = Instance.new("ImageLabel")
\t\timg.Name = part.name
\t\timg.BackgroundTransparency = 1
\t\timg.AnchorPoint = Vector2.new(0.5, 0.5)
\t\timg.Image = Data.Image
\t\timg.ImageRectSize = Vector2.new(part.w, part.h)
\t\timg.ImageRectOffset = Vector2.new(part.x, part.y)
\t\timg.ZIndex = part.order + 1
\t\tif Data.PixelArt then
\t\t\timg.ResampleMode = Enum.ResamplerMode.Pixelated
\t\tend
\t\timg.Parent = self.Root
\t\tself.Labels[i] = img
\tend
\tlocal first = Data.Anims.idle and "idle" or next(Data.Anims)
\tif first then self:Play(first) end
\tself.Connection = RunService.Heartbeat:Connect(function(dt)
\t\tself:Step(dt)
\tend)
\treturn self
end

-- Plays an animation by name ("idle", "walk", "blade_slash1", ...). restart = true replays the current one.
function Rig:Play(name, restart)
\tlocal anim = Data.Anims[name]
\tif not anim then
\t\twarn("PixelRig: no animation named " .. tostring(name))
\t\treturn
\tend
\tif self.Current == anim and not restart then return end
\tself.Current = anim
\tself.CurrentName = name
\tself.Time = 0
\tself.Finished = false
\tself.FiredStart = false
\tself:Pose(0)
end

-- 1 = face right, -1 = face left
function Rig:SetFacing(dir)
\tself.Facing = (dir < 0) and -1 or 1
\tself:Pose(self.Time)
end

function Rig:Fire(a, b)
\tif not self.OnEvent then return end
\tfor _, ev in ipairs(self.Current.events) do
\t\tif ev[1] > a and ev[1] <= b then self.OnEvent(ev[2]) end
\tend
end

function Rig:Step(dt)
\tlocal anim = self.Current
\tif not anim or self.Finished then return end
\tlocal t0 = self.Time
\tlocal t1 = t0 + dt * self.Speed
\tif not self.FiredStart then
\t\tself.FiredStart = true
\t\tt0 = -1
\tend
\tif t1 >= anim.length then
\t\tif anim.loop then
\t\t\tself:Fire(t0, anim.length)
\t\t\tt1 = t1 % anim.length
\t\t\tself:Fire(-1, t1)
\t\telse
\t\t\tt1 = anim.length
\t\t\tself:Fire(t0, t1)
\t\t\tself.Finished = true
\t\tend
\telse
\t\tself:Fire(t0, t1)
\tend
\tself.Time = t1
\tself:Pose(t1)
end

function Rig:Pose(t)
\tlocal anim = self.Current
\tlocal tracks = anim and byBone(anim) or {}
\tlocal base = { self.Scale * self.Facing, 0, 0, self.Scale, 0, 0 }
\tlocal world = {}
\tfor i, b in ipairs(Data.Bones) do
\t\tlocal tr = tracks[i]
\t\tlocal function v(prop)
\t\t\tif tr and tr[prop] then return sample(tr[prop], t) end
\t\t\treturn b[prop]
\t\tend
\t\tlocal m = trs(v("x"), v("y"), v("rot"), v("sx"), v("sy"))
\t\tif b.parent > 0 then world[i] = mul(world[b.parent], m) else world[i] = mul(base, m) end
\tend
\tfor i, part in ipairs(Data.Parts) do
\t\tlocal m = world[part.bone]
\t\tlocal img = self.Labels[i]
\t\tlocal px = part.px
\t\tif m[1] * m[4] - m[2] * m[3] < 0 then
\t\t\t-- mirrored: GUI images cannot flip, so use the mirrored atlas and un-mirror the matrix
\t\t\tm = { -m[1], -m[2], m[3], m[4], m[5], m[6] }
\t\t\tpx = part.w - part.px
\t\t\timg.Image = Data.ImageFlipped
\t\t\timg.ImageRectOffset = Vector2.new(Data.AtlasSize.X - part.x - part.w, part.y)
\t\telse
\t\t\timg.Image = Data.Image
\t\t\timg.ImageRectOffset = Vector2.new(part.x, part.y)
\t\tend
\t\tlocal lx, ly = part.w / 2 - px, part.h / 2 - part.py
\t\tlocal sx = math.sqrt(m[1] * m[1] + m[2] * m[2])
\t\tlocal sy = math.sqrt(m[3] * m[3] + m[4] * m[4])
\t\timg.Size = UDim2.fromOffset(part.w * sx, part.h * sy)
\t\timg.Position = UDim2.fromOffset(m[1] * lx + m[3] * ly + m[5], m[2] * lx + m[4] * ly + m[6])
\t\timg.Rotation = math.deg(math.atan2(m[2], m[1]))
\tend
end

function Rig:Destroy()
\tif self.Connection then self.Connection:Disconnect() end
\tself.Connection = nil
\tif self.Root then self.Root:Destroy() end
\tself.Root = nil
end

return Rig
`;
  };

  RX.readme = (J) => `PixelRig Studio skeletal rig: ${J.name}
==========================================
Bones: ${J.bones.length}   Parts: ${J.parts.length}   Animations: ${J.anims.map((a) => a.name).join(', ')}
Each body part is its own image; the engine moves the bones, so animations stay smooth at any size and you can
blend, retime or re-pose them inside the engine. Hit frames are baked as animation events named "hit".

GODOT 4  (folder: godot/)
  1. Copy godot/rigs into your project root so the files sit in res://rigs/${J.name}/
  2. Open res://rigs/${J.name}/${J.name}.tscn: Skeleton2D + Bone2D bones, one Sprite2D per part, AnimationPlayer with every move.
  3. Instance it in your level. In code: $${J.name}.play("walk"), $${J.name}.set_facing(-1),
     $${J.name}.rig_event.connect(func(e): if e == &"hit": deal_damage())

UNITY  (folder: unity/)
  1. Copy the contents of unity/Assets into your project's Assets folder (scripts go to Assets/PixelRig, the rig to Assets/PixelRig/Rigs/${J.name}).
  2. In the Project window select Assets/PixelRig/Rigs/${J.name}/${J.name}.rig.json, right-click > PixelRig > Build Rig Prefab
     (or menu Tools > PixelRig > Build All Rigs).
  3. You get ${J.name}.prefab (Animator + bones + SpriteRenderers), one .anim per move and ${J.name}.controller.
     Hit frames call PixelRigEvents.OnRigEvent("hit"): GetComponent<PixelRig.PixelRigEvents>().OnEvent += e => { ... };

ROBLOX STUDIO  (folder: roblox/)
  1. Upload ${J.image} and ${J.imageFlipped} (Creator Hub / Asset Manager) and paste both ids into ${J.name}_rig.lua.
  2. Put ${J.name}_rig.lua in ReplicatedStorage as a ModuleScript and use it from a LocalScript (example at the top of the file).

OTHER ENGINES
  ${J.name}.rig.json: bones (parent, x, y, rot, sx, sy), parts (atlas rect + pivot), animations (linear key tracks per bone).
  Pixels, y down, rotations in degrees clockwise, node transform = translate * rotate * scale.
  Part px/py = where the bone origin sits inside the part image.

Notes: weapon trails, effects and the bow string are not part of the rig (export effects as sprite sheets with "character" off).
Pixel-art parts rotate as bitmaps in engines; for perfectly crisp pixel animation use the sprite sheet export instead.
`;

  RX.zip = async (rig, o) => {
    const J = rig.json, n = J.name, files = [];
    const png = await PR.canvasToBytes(rig.pack.atlas), pngF = await PR.canvasToBytes(rig.pack.flipped);
    const partPngs = [];
    for (const p of rig.parts) partPngs.push([p.name, await PR.canvasToBytes(p.canvas)]);
    const json = JSON.stringify(J, null, 1);
    // generic
    files.push({ name: `${n}_rig/${n}.rig.json`, data: json }, { name: `${n}_rig/${J.image}`, data: png }, { name: `${n}_rig/${J.imageFlipped}`, data: pngF });
    for (const [pn, d] of partPngs) files.push({ name: `${n}_rig/parts/${pn}.png`, data: d });
    // godot
    const gdir = `rigs/${n}`;
    files.push({ name: `${n}_rig/godot/${gdir}/${n}.tscn`, data: RX.godotScene(rig, gdir) }, { name: `${n}_rig/godot/${gdir}/${J.image}`, data: png },
      { name: `${n}_rig/godot/${gdir}/pixelrig_events.gd`, data: RX.godotEventsScript() });
    // unity
    const udir = `${n}_rig/unity/Assets/PixelRig`;
    files.push({ name: `${udir}/Editor/PixelRigImporter.cs`, data: RX.unityImporterCs() }, { name: `${udir}/PixelRigEvents.cs`, data: RX.unityEventsCs() },
      { name: `${udir}/Rigs/${n}/${n}.rig.json`, data: json });
    for (const [pn, d] of partPngs) files.push({ name: `${udir}/Rigs/${n}/parts/${pn}.png`, data: d });
    // roblox
    files.push({ name: `${n}_rig/roblox/${n}_rig.lua`, data: RX.robloxModule(J) }, { name: `${n}_rig/roblox/${J.image}`, data: png }, { name: `${n}_rig/roblox/${J.imageFlipped}`, data: pngF });
    files.push({ name: `${n}_rig/README.txt`, data: RX.readme(J) });
    return PR.makeZip(files);
  };
})();
