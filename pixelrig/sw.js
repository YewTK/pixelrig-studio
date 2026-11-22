'use strict';
// PixelRig Studio service worker: makes the app installable and usable offline.
// Network first (you always get the newest files when online), cache as the offline fallback.
// Bump CACHE when files are added or removed from SHELL.
const CACHE = 'pixelrig-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-32.png', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './src/core.js', './src/data/equipment.js', './src/data/weapons.js', './src/rig.js', './src/motion.js', './src/fx.js',
  './src/data/moves_weapons.js', './src/data/moves_common.js', './src/data/my_moves.js', './src/scene.js', './src/ui.js',
  './src/config.js', './src/editor.js', './src/paint.js', './src/paint_ui.js', './src/paint_timeline.js', './src/paint_store.js',
  './src/zip.js', './src/rigexport.js', './src/rigexport_engines.js', './src/export.js', './src/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pixelrig-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
