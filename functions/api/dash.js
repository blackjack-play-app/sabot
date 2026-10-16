// API privée du tableau de bord : protégée par une clé secrète (variable DASH_KEY).
// Combine Cloudflare Web Analytics (visites), la base D1 (activité du jeu) et GitHub (téléchargements).

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
});

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const GQL = `query($a: string!, $s: string!, $d0: Time!, $d1: Time!) { viewer { accounts(filter: {accountTag: $a}) {
  days: rumPageloadEventsAdaptiveGroups(limit: 400, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [date_ASC]) { count sum { visits } dimensions { date } }
  refs: rumPageloadEventsAdaptiveGroups(limit: 15, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { refererHost } }
  countries: rumPageloadEventsAdaptiveGroups(limit: 15, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { countryName } }
  devices: rumPageloadEventsAdaptiveGroups(limit: 5, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { deviceType } }
  paths: rumPageloadEventsAdaptiveGroups(limit: 15, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [count_DESC]) { count sum { visits } dimensions { requestPath } }
  browsers: rumPageloadEventsAdaptiveGroups(limit: 8, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { userAgentBrowser } }
  oses: rumPageloadEventsAdaptiveGroups(limit: 8, filter: {siteTag: $s, datetime_geq: $d0, datetime_leq: $d1}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { userAgentOS } }
} } }`;

export async function onRequestGet({ request, env }) {
  const key = request.headers.get('X-Dash-Key') || '';
  if (!env.DASH_KEY || !safeEqual(key, env.DASH_KEY)) return json({ error: 'interdit' }, 404);
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('jours')) || 30));
  const end = new Date();
  let start = new Date(end.getTime() - days * 864e5);
  // Remise à zéro : rien n'est compté avant cette date, et les téléchargements GitHub déjà faits sont soustraits
  let reset = null;
  try {
    const row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'reset'").first();
    if (row) reset = JSON.parse(row.v);
  } catch { /* table absente : pas de remise à zéro */ }
  if (reset && new Date(reset.date) > start) start = new Date(reset.date);
  const out = { periode: { jours: days, debut: start.toISOString(), fin: end.toISOString() }, reset };

  // 1. Visites (Cloudflare Web Analytics) — l'API limite chaque requête à 7 jours : on découpe et on additionne
  try {
    const DIMS = { days: 'date', refs: 'refererHost', countries: 'countryName', devices: 'deviceType', paths: 'requestPath', browsers: 'userAgentBrowser', oses: 'userAgentOS' };
    const acc = Object.fromEntries(Object.keys(DIMS).map((k) => [k, new Map()]));
    const errors = [];
    const chunks = [];
    for (let t = start.getTime(); t < end.getTime(); t += 7 * 864e5) chunks.push([new Date(t), new Date(Math.min(end.getTime(), t + 7 * 864e5 - 1000))]);
    for (const [d0, d1] of chunks) {
      const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GQL, variables: { a: env.CF_ACCOUNT_ID, s: env.SITE_TAG, d0: d0.toISOString(), d1: d1.toISOString() } }),
      });
      const d = await r.json();
      if (d.errors) errors.push(...d.errors.map((x) => x.message));
      const a = d?.data?.viewer?.accounts?.[0] || {};
      for (const [k, dim] of Object.entries(DIMS)) {
        for (const x of a[k] || []) {
          const key = x.dimensions[dim] || '(direct)';
          const cur = acc[k].get(key) || { k: key, visites: 0, pages: 0 };
          cur.visites += x.sum.visits; cur.pages += x.count;
          acc[k].set(key, cur);
        }
      }
    }
    const list = (k, by = 'visites') => [...acc[k].values()].sort((x, y) => y[by] - x[by]);
    out.web = {
      jours: [...acc.days.values()].sort((x, y) => (x.k < y.k ? -1 : 1)), sources: list('refs'), pays: list('countries'),
      appareils: list('devices'), pages: list('paths', 'pages'), navigateurs: list('browsers'), systemes: list('oses'),
      erreurs: errors.length ? errors.slice(0, 3) : null,
    };
  } catch (e) { out.web = { erreur: String(e) }; }

  // 2. Activité du jeu (D1)
  try {
    const since = start.toISOString().slice(0, 10);
    const totals = await env.DB.prepare('SELECT e, p, src, SUM(n) AS n FROM events WHERE day >= ?1 GROUP BY e, p, src ORDER BY n DESC').bind(since).all();
    const perDay = await env.DB.prepare("SELECT day, e, SUM(n) AS n FROM events WHERE day >= ?1 AND e IN ('start','round') GROUP BY day, e ORDER BY day").bind(since).all();
    const countries = await env.DB.prepare("SELECT country, SUM(n) AS n FROM events WHERE day >= ?1 AND e = 'round' GROUP BY country ORDER BY n DESC LIMIT 15").bind(since).all();
    out.jeu = { totaux: totals.results, parJour: perDay.results, pays: countries.results };
  } catch (e) { out.jeu = { erreur: String(e) }; }

  // 3. Les téléchargements (GitHub) sont lus directement par le navigateur du tableau de bord.

  return json(out);
}
