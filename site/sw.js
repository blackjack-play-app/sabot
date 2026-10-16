// Service worker : jeu disponible hors ligne après la première visite (fichier généré par tools/build-sw.py).
const VERSION = 'sabot-vf823bb1ce7';
const CORE = [
"/assets/fonts/barlow-condensed-latin-500-normal.woff2",
"/assets/fonts/barlow-condensed-latin-600-normal.woff2",
"/assets/fonts/barlow-condensed-latin-700-normal.woff2",
"/assets/fonts/barlow-latin-400-normal.woff2",
"/assets/fonts/barlow-latin-500-normal.woff2",
"/assets/fonts/barlow-latin-600-normal.woff2",
"/assets/fonts/source-serif-4-latin-400-italic.woff2",
"/assets/fonts/source-serif-4-latin-400-normal.woff2",
"/assets/fonts/source-serif-4-latin-600-normal.woff2",
"/assets/fonts/source-serif-4-latin-700-normal.woff2",
"/assets/img/favicon.svg",
"/assets/img/icon-192.png",
"/game/",
"/game/css/game.css",
"/game/index.html",
"/game/js/achievements.js",
"/game/js/audio.js",
"/game/js/cards.js",
"/game/js/dealer.js",
"/game/js/dealer3d.js",
"/game/js/drills.js",
"/game/js/engine.js",
"/game/js/icons.js",
"/game/js/main.js",
"/game/js/music.js",
"/game/js/panels.js",
"/game/js/quality.js",
"/game/js/rules.js",
"/game/js/scene.js",
"/game/js/sim.js",
"/game/js/simworker.js",
"/game/js/store.js",
"/game/js/strategy.js",
"/game/js/textures.js",
"/game/js/ui.js",
"/game/sfx/card-fan-1.ogg",
"/game/sfx/card-place-1.ogg",
"/game/sfx/card-place-2.ogg",
"/game/sfx/card-place-3.ogg",
"/game/sfx/card-shove-1.ogg",
"/game/sfx/card-shove-2.ogg",
"/game/sfx/card-shuffle.ogg",
"/game/sfx/card-slide-1.ogg",
"/game/sfx/card-slide-2.ogg",
"/game/sfx/card-slide-3.ogg",
"/game/sfx/card-slide-5.ogg",
"/game/sfx/chip-lay-1.ogg",
"/game/sfx/chip-lay-2.ogg",
"/game/sfx/chip-lay-3.ogg",
"/game/sfx/chips-collide-1.ogg",
"/game/sfx/chips-collide-2.ogg",
"/game/sfx/chips-handle-1.ogg",
"/game/sfx/chips-handle-2.ogg",
"/game/sfx/chips-stack-1.ogg",
"/game/sfx/chips-stack-2.ogg",
"/game/sfx/chips-stack-3.ogg",
"/game/tex/carpet_nor_1k.webp",
"/game/tex/carpet_rough_1k.webp",
"/game/tex/leather_diff_1k.webp",
"/game/tex/leather_nor_1k.webp",
"/game/tex/leather_rough_1k.webp",
"/game/tex/lounge_1k.hdr",
"/game/tex/walnut_diff_1k.webp",
"/game/tex/walnut_nor_1k.webp",
"/game/tex/walnut_rough_1k.webp",
"/game/tex/wool_nor_1k.webp",
"/game/tex/wool_rough_1k.webp",
"/game/vendor/GLTFLoader.js",
"/game/vendor/OrbitControls.js",
"/game/vendor/RGBELoader.js",
"/game/vendor/RoomEnvironment.js",
"/game/vendor/meshopt_decoder.module.js",
"/game/vendor/three.module.js",
"/game/vendor/utils/BufferGeometryUtils.js",
"/manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Gros fichiers fixes (modèles, textures, sons, polices, bibliothèques) : cache d'abord.
// Tout le reste (pages, styles, scripts) : réseau d'abord pour voir les mises à jour tout de suite.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith('/api/')) return;
  const heavy = /\/(models|tex|sfx|vendor|fonts)\//.test(new URL(req.url).pathname);
  if (!heavy) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/game/') : undefined))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && !req.url.includes('/downloads/')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
