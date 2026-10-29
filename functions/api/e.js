// Reçoit des événements anonymes du jeu et du site.
// Aucune donnée personnelle stockée : pas d'IP, pas de cookie, pas d'identifiant sur l'appareil.
// Visiteurs uniques : empreinte du jour = SHA-256(sel aléatoire du jour + IP + navigateur), tronquée.
// Le sel change chaque jour et l'ancien est effacé : impossible de relier deux jours ou de retrouver une IP.

const ALLOWED = {
  start: /^(web|desktop|pwa|itch)$/,                 // lancement du jeu
  round: /^(libre|coach|comptage)$/,            // donne jouée (mode)
  hands: /^[1-5]$/,                             // nombre de mains dans la donne
  drill: /^(flash|countdown|truecount|deviations|sim)$/,
  dl: /^[a-zA-Z]{2,20}$/,                       // clic sur un téléchargement (clé du fichier)
  welcome: /^(coach|libre|comptage|casino)$/,   // niveau choisi à l'accueil
  ref: /^[a-z0-9-]{1,24}$/,                     // arrivée par un lien de partage ?ref=...
  view: /^\/[a-z0-9/_.-]{0,60}$/,               // page vue (chemin)
  ping: /^\/[a-z0-9/_.-]{0,60}$/,               // « toujours là » (page ou jeu ouvert et visible), toutes les minutes
};
// Événements reportés sur la carte et l'activité détaillée (table hits)
const GEO = new Set(['view', 'start', 'round', 'dl']);
const SRC_BIT = { web: 1, desktop: 2, pwa: 4, itch: 8 };
// Réseaux de data centers (robots d'indexation, scanners de liens) : Google, Amazon, Microsoft, Facebook, hébergeurs
const DC_ASN = new Set([15169, 396982, 16509, 14618, 8075, 32934, 14061, 24940, 63949, 20473, 45102, 37963, 132203, 16276, 51167]);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|python|curl|wget|httpclient|okhttp|go-http|java\//i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function parseUA(ua) {
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Autre';
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'mobile' : 'desktop';
  const browser = /Electron/.test(ua) ? 'Appli PC' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Autre';
  return { os, device, browser };
}

// Source : nom de domaine du site d'origine, simplifié (google.fr, www.google.com → google)
// Assistants IA : ChatGPT ajoute ?utm_source=chatgpt.com à ses liens
const AI = /^(chatgpt|perplexity|copilot|gemini|claude)/;

function cleanRef(r) {
  const h = String(r || '').toLowerCase().replace(/^www\.|^m\.|^l\.|^lm\.|^out\./, '').slice(0, 60);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || /blackjack-play\.app$/.test(h)) return '';
  const known = h.match(/^(google|bing|duckduckgo|yahoo|qwant|ecosia|yandex|baidu|facebook|instagram|tiktok|youtube|reddit|discord|twitter|t\.co|x\.com|linkedin|pinterest|itch|producthunt|github|whatsapp)\b/);
  if (known) return known[1] === 't.co' || known[1] === 'x.com' ? 'x' : known[1];
  if (/itch\.(io|zone)$|hwcdn\.net$/.test(h)) return 'itch';
  return h;
}

let saltCache = { day: '', salt: '' };
async function daySalt(env, day) {
  if (saltCache.day === day) return saltCache.salt;
  const fresh = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?1, ?2)').bind('salt:' + day, fresh).run();
  const row = await env.DB.prepare('SELECT v FROM meta WHERE k = ?1').bind('salt:' + day).first();
  // Ménage : les sels des jours passés sont effacés (les empreintes ne peuvent plus être recalculées)
  await env.DB.prepare("DELETE FROM meta WHERE k LIKE 'salt:%' AND k < ?1").bind('salt:' + new Date(Date.parse(day) - 864e5).toISOString().slice(0, 10)).run();
  saltCache = { day, salt: row.v };
  return row.v;
}

async function visitorId(env, day, request, ua) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const data = new TextEncoder().encode((await daySalt(env, day)) + '|' + ip + '|' + ua);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  try {
    const ua = request.headers.get('User-Agent') || '';
    if (!ua || BOT.test(ua)) return new Response(null, { status: 204, headers: CORS });
    const text = await request.text();
    if (text.length > 2000) return new Response(null, { status: 413, headers: CORS });
    const body = JSON.parse(text || '{}');
    const list = Array.isArray(body.events) ? body.events.slice(0, 20) : [body];
    const src = /^(web|desktop|pwa|itch)$/.test(body.src) ? body.src : 'web';
    const cf = request.cf || {};
    if (DC_ASN.has(Number(cf.asn))) return new Response(null, { status: 204, headers: CORS });
    const country = cf.country || '';
    const city = String(cf.city || '').slice(0, 60);
    const lat = Number.isFinite(+cf.latitude) ? Math.round(+cf.latitude * 10) / 10 : null;
    const lon = Number.isFinite(+cf.longitude) ? Math.round(+cf.longitude * 10) / 10 : null;
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const slot = now.toISOString().slice(0, 15) + '0';  // tranche de 10 minutes, ex. 2026-10-16T18:20
    const stmts = [];
    // Ce que ce lot apporte au visiteur du jour
    const v = { views: 0, starts: 0, rounds: 0, drills: 0, dl: 0, page: '', mode: '', entry: '', camp: '' };
    for (const ev of list) {
      const e = String(ev.e || '');
      const p = String(ev.p ?? '');
      if (!ALLOWED[e] || !ALLOWED[e].test(p)) continue;
      const n = Math.max(1, Math.min(50, Number(ev.n) || 1));
      if (e === 'view') { v.views += n; v.page = p; v.entry = v.entry || p; }
      else if (e === 'ping') v.page = p;
      else if (e === 'start') { v.starts += n; v.page = '/game/'; }
      else if (e === 'round') { v.rounds += n; v.mode = p; v.page = '/game/'; }
      else if (e === 'drill') { v.drills += n; v.page = '/game/'; }
      else if (e === 'welcome') v.mode = p === 'casino' ? 'libre' : p;
      else if (e === 'dl') v.dl += n;
      else if (e === 'ref') { if (AI.test(p)) v.ai = p.match(AI)[1]; else v.camp = p; }
      if (e === 'ping') continue;
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
    if (!v.page && !v.views && !v.starts && !v.rounds && !v.drills && !v.dl && !v.mode && !v.camp && !v.ai) {
      if (stmts.length) await env.DB.batch(stmts);
      return new Response(null, { status: 204, headers: CORS });
    }
    const vid = await visitorId(env, day, request, ua);
    const { os, device, browser } = parseUA(ua);
    const t = Math.floor(now.getTime() / 1000);
    stmts.push(env.DB.prepare(
      `INSERT INTO visitors (day, vid, t0, t1, srcs, country, city, lat, lon, device, os, browser, entry, ref, camp, page, mode, views, starts, rounds, drills, dl, ret)
       VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
       ON CONFLICT (day, vid) DO UPDATE SET t1 = excluded.t1, srcs = srcs | excluded.srcs,
         country = excluded.country, city = excluded.city, lat = excluded.lat, lon = excluded.lon,
         entry = CASE WHEN entry = '' THEN excluded.entry ELSE entry END,
         ref = CASE WHEN ref = '' THEN excluded.ref ELSE ref END,
         camp = CASE WHEN camp = '' THEN excluded.camp ELSE camp END,
         page = CASE WHEN excluded.page <> '' THEN excluded.page ELSE page END,
         mode = CASE WHEN excluded.mode <> '' THEN excluded.mode ELSE mode END,
         views = views + excluded.views, starts = starts + excluded.starts, rounds = rounds + excluded.rounds,
         drills = drills + excluded.drills, dl = dl + excluded.dl, ret = max(ret, excluded.ret)`,
    ).bind(day, vid, t, SRC_BIT[src], country, city, lat, lon, device, os, browser, v.entry, v.ai || cleanRef(body.r), v.camp, v.page, v.mode,
      v.views, v.starts, v.rounds, v.drills, v.dl, body.ret ? 1 : 0));
    // Présence par tranche de 10 minutes (courbe du direct, heures d'affluence en personnes)
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO presence (slot, vid) VALUES (?1, ?2)').bind(slot, vid));
    await env.DB.batch(stmts);
    return new Response(null, { status: 204, headers: CORS });
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
}
