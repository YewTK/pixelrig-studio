'use strict';
// Your own moves. Ask Claude (in Claude Code, in this folder) things like
//   "add a move: a three-hit flaming spin slash for swords"
// and it adds a clip here. Clips made in the in-app editor live in the browser until you
// export them; paste their JSON here to make them permanent.
// Optional: set `set: 'blade'` (or heavy/pole/magic/bow/fist) to show it under that weapon's skills.
PR.registerClips([
  {
    id: 'my_flame_cross', name: 'กากบาทเพลิง (ตัวอย่าง)', group: 'mine', set: 'blade', dur: 0.8, trail: [0.08, 0.5],
    keys: [
      { t: 0, x: 0 },
      { t: 0.08, ease: 'out', armF: -170, foreF: -30, wrot: -5, torso: -8, head: -4, armB: 20 },
      { t: 0.16, ease: 'outCubic', armF: 10, foreF: -15, wrot: 45, torso: 14, head: 6, thighF: -30, shinF: 22, thighB: 18, x: 4 },
      { t: 0.3, ease: 'out', armF: 50, foreF: -20, wrot: 70, torso: 8 },
      { t: 0.4, ease: 'outCubic', armF: -150, foreF: -20, wrot: -30, torso: -10, head: -6, x: 8 },
      { t: 0.8, ease: 'inout', armF: -14, foreF: -40, wrot: -8, torso: 3, head: 0, armB: -5, thighF: -8, shinF: 7, thighB: 9, x: 8 },
    ],
    events: [
      { t: 0.09, fx: 'slash', x: 6, y: -20, r: 22, a0: -130, a1: 55, thick: 7, el: 'fire' },
      { t: 0.12, hit: { range: [0, 36], dmg: [10, 14], knock: 3, stop: 0.05, shake: 1.5 }, el: 'fire' },
      { t: 0.31, fx: 'slash', x: 6, y: -20, r: 22, a0: 80, a1: -140, thick: 7, el: 'fire' },
      { t: 0.35, hit: { range: [0, 36], dmg: [14, 18], knock: 8, launch: 80, stop: 0.08, shake: 3 }, el: 'fire' },
      { t: 0.35, fx: 'burst', at: 'target', r: 14, el: 'fire' },
    ],
  },
]);
