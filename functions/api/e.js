// Reçoit des événements anonymes du jeu et du site, et incrémente des totaux.
// Aucune donnée personnelle : pas d'IP, pas d'identifiant, pas de cookie.
// Pour la carte du tableau de bord : ville approximative fournie par Cloudflare, coordonnées arrondies (~10 km).

const ALLOWED = {
  start: /^(web|desktop|pwa)$/,                 // lancement du jeu
  round: /^(libre|coach|comptage)$/,            // donne jouée (mode)
  hands: /^[1-5]$/,                             // nombre de mains dans la donne
  drill: /^(flash|countdown|truecount|deviations|sim)$/,
  dl: /^[a-zA-Z]{2,20}$/,                       // clic sur un téléchargement (clé du fichier)
  welcome: /^(coach|libre|comptage|casino)$/,   // niveau choisi à l'accueil
  ref: /^[a-z0-9-]{1,24}$/,                     // arrivée par un lien de partage ?ref=...
  view: /^\/[a-z0-9/_.-]{0,60}$/,               // page vue (chemin)
};
// Événements reportés sur la carte et l'activité en direct
const GEO = new Set(['view', 'start', 'round', 'dl']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const text = await request.text();
    if (text.length > 2000) return new Response(null, { status: 413, headers: CORS });
    const body = JSON.parse(text || '{}');
    const list = Array.isArray(body.events) ? body.events.slice(0, 20) : [body];
    const src = /^(web|desktop|pwa)$/.test(body.src) ? body.src : 'web';
    const cf = request.cf || {};
    const country = cf.country || '';
    const city = String(cf.city || '').slice(0, 60);
    const lat = Number.isFinite(+cf.latitude) ? Math.round(+cf.latitude * 10) / 10 : null;
    const lon = Number.isFinite(+cf.longitude) ? Math.round(+cf.longitude * 10) / 10 : null;
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const slot = now.toISOString().slice(0, 15) + '0';  // tranche de 10 minutes, ex. 2026-10-16T18:20
    const stmts = [];
    for (const ev of list) {
      const e = String(ev.e || '');
      const p = String(ev.p ?? '');
      if (!ALLOWED[e] || !ALLOWED[e].test(p)) continue;
      const n = Math.max(1, Math.min(50, Number(ev.n) || 1));
      if (e !== 'view') {
        stmts.push(env.DB.prepare(
          'INSERT INTO events (day, e, p, src, country, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (day, e, p, src, country) DO UPDATE SET n = n + ?6',
        ).bind(day, e, p, src, country, n));
      }
      if (GEO.has(e)) {
        stmts.push(env.DB.prepare(
          'INSERT INTO hits (slot, e, p, src, country, city, lat, lon, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT (slot, e, p, src, country, city) DO UPDATE SET n = n + ?9',
        ).bind(slot, e, e === 'view' ? p : (e === 'round' ? p : ''), src, country, city, lat, lon, n));
      }
    }
    if (stmts.length) await env.DB.batch(stmts);
    return new Response(null, { status: 204, headers: CORS });
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
}
