// Reçoit des événements anonymes du jeu et du site, et incrémente des totaux par jour.
// Aucune donnée personnelle : pas d'IP, pas d'identifiant, pas de cookie.

const ALLOWED = {
  start: /^(web|desktop|pwa)$/,                 // lancement du jeu
  round: /^(libre|coach|comptage)$/,            // donne jouée (mode)
  hands: /^[1-5]$/,                             // nombre de mains dans la donne
  drill: /^(flash|countdown|truecount|deviations|sim)$/,
  dl: /^[a-zA-Z]{2,20}$/,                       // clic sur un téléchargement (clé du fichier)
  welcome: /^(coach|libre|comptage|casino)$/,   // niveau choisi à l'accueil
  ref: /^[a-z0-9-]{1,24}$/,                     // arrivée par un lien de partage ?ref=...
};

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
    const country = (request.cf && request.cf.country) || '';
    const day = new Date().toISOString().slice(0, 10);
    const stmts = [];
    for (const ev of list) {
      const e = String(ev.e || '');
      const p = String(ev.p ?? '');
      if (!ALLOWED[e] || !ALLOWED[e].test(p)) continue;
      const n = Math.max(1, Math.min(50, Number(ev.n) || 1));
      stmts.push(env.DB.prepare(
        'INSERT INTO events (day, e, p, src, country, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (day, e, p, src, country) DO UPDATE SET n = n + ?6',
      ).bind(day, e, p, src, country, n));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return new Response(null, { status: 204, headers: CORS });
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
}
