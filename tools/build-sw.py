# Génère site/sw.js avec la liste des fichiers à mettre en cache (à relancer après chaque modification).
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent / 'site'
version = sys.argv[1] if len(sys.argv) > 1 else '1.0.0'
files = []
for p in sorted((root / 'game').rglob('*')):
    if not p.is_file():
        continue
    rel = '/' + p.relative_to(root).as_posix()
    if rel.endswith(('.glb', '.txt')) or '_2k' in rel:
        continue
    files.append(rel)
files += ['/' + p.relative_to(root).as_posix() for p in (root / 'assets' / 'fonts').glob('*.woff2')]
files += ['/game/', '/manifest.webmanifest', '/assets/img/favicon.svg', '/assets/img/icon-192.png']

sw = f"""// Service worker : jeu disponible hors ligne après la première visite (fichier généré par tools/build-sw.py).
const VERSION = 'sabot-v{version}';
const CORE = {json.dumps(sorted(set(files)), indent=0)};

self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
}});

self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});

// Pages HTML : réseau d'abord (contenu à jour), cache en secours. Le reste : cache d'abord.
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {{
    e.respondWith(fetch(req).then((res) => {{ const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }})
      .catch(() => caches.match(req).then((r) => r || caches.match('/game/'))));
    return;
  }}
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {{
    if (res.ok && !req.url.includes('/downloads/')) {{ const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }}
    return res;
  }})));
}});
"""
(root / 'sw.js').write_text(sw, encoding='utf8')
print(len(files), 'fichiers')
