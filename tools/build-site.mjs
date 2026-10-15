// Assemble les pages du site (pages/*.html) avec le gabarit commun + sitemap.
// Usage : node tools/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { buildChart } from '../site/game/js/strategy.js';
import { DEFAULT_RULES } from '../site/game/js/rules.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const SITE = path.join(ROOT, 'site');
const PAGES = path.join(ROOT, 'pages');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const DOMAIN = cfg.domain.replace(/\/$/, '');

const ICON = (name, size = 18) => {
  const p = path.join(ROOT, 'node_modules', 'lucide-static', 'icons', name + '.svg');
  const inner = fs.readFileSync(p, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
};
const LOGO = `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect x="3" y="5" width="18" height="24" rx="3" fill="#efe6d2" transform="rotate(-10 12 17)"/><rect x="11" y="3" width="18" height="24" rx="3" fill="#c9a24a"/><path d="M20 9c-3 3-5 5-5 7.5a2.5 2.5 0 0 0 4.4 1.6c-.2 1.2-.8 2.2-1.6 2.9h4.4c-.8-.7-1.4-1.7-1.6-2.9a2.5 2.5 0 0 0 4.4-1.6C25 14 23 12 20 9z" fill="#14100c"/></svg>`;

// Logos des systèmes (formes simples, pas de marques déposées reproduites)
const OS = {
  windows: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5.5 10.5 4.5v7H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>`,
  mac: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.3c.9-1.3 1.2-2.5 1.2-2.6 0 0-2.4-.9-2.4-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/></svg>`,
  linux: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c-2.2 0-3.6 1.8-3.6 4.4 0 1.3.3 2.2.1 3.1-.3 1.2-2.5 3.3-3.1 5.9-.3 1.3 0 2.2.5 2.6-.4.5-1.6 1-1.4 1.9.2.9 2.3.9 3.4 1.6 1 .6 2 .6 2.6-.2.5.1 1 .2 1.5.2s1-.1 1.5-.2c.6.8 1.6.8 2.6.2 1.1-.7 3.2-.7 3.4-1.6.2-.9-1-1.4-1.4-1.9.5-.4.8-1.3.5-2.6-.6-2.6-2.8-4.7-3.1-5.9-.2-.9.1-1.8.1-3.1C15.6 3.8 14.2 2 12 2zm-1.6 4.3c.4 0 .7.5.7 1.1s-.3 1.1-.7 1.1-.7-.5-.7-1.1.3-1.1.7-1.1zm3.2 0c.4 0 .7.5.7 1.1s-.3 1.1-.7 1.1-.7-.5-.7-1.1.3-1.1.7-1.1zM12 9.4c.9 0 2 .5 2 .9s-1.1 1.1-2 1.1-2-.7-2-1.1.9-.9 2-.9z"/></svg>`,
};

function chartHTML(r) {
  const c = buildChart(r);
  const ups = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const table = (rows, caption) => `<table class="strat"><caption class="sr">${caption}</caption><thead><tr><th scope="col">Main</th>${ups.map((u) => `<th scope="col">${u}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${row.label}</th>${row.cells.map((x) => `<td class="c-${x}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return { hard: table(c.hard, 'Mains dures'), soft: table(c.soft, 'Mains souples'), pairs: table(c.pairs, 'Paires') };
}

function layout(meta, body) {
  const url = DOMAIN + meta.path;
  const nav = [['/', 'Accueil'], ['/game/', 'Jouer'], ['/telecharger', 'Télécharger'], ['/apprendre', 'Apprendre'], ['/statistiques', 'Statistiques']];
  const navHtml = nav.map(([href, label]) => `<a href="${href}"${meta.path === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const ld = meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>` : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0d0b09">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Blackjack Play">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${meta.ogTitle || meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${DOMAIN}/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/source-serif-4-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
${meta.head || ''}${ld}
</head>
<body class="${meta.bodyClass || ''}">
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-head">
  <div class="wrap">
    <a class="logo" href="/" aria-label="Blackjack Play, accueil">${LOGO}<span>Blackjack Play</span></a>
    <nav class="nav" aria-label="Navigation principale">${navHtml}</nav>
    <div class="head-cta"><a class="btn btn-gold btn-sm" href="/game/">${ICON('play', 16)}Jouer</a></div>
    <button class="menu-btn" aria-label="Menu" aria-expanded="false">${ICON('list', 20)}</button>
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="logo" href="/">${LOGO}<span>Blackjack Play</span></a>
        <p style="margin:14px 0 14px;max-width:36ch">Entraîneur de blackjack gratuit, en 3D, dans le navigateur ou sur ordinateur.</p>
        <span class="no-money">Jetons fictifs · aucun argent réel</span>
      </div>
      <div><h4>Jeu</h4><ul><li><a href="/jeu-blackjack-gratuit">Jeu de blackjack gratuit</a></li><li><a href="/game/">Jouer en ligne</a></li><li><a href="/telecharger">Windows, macOS, Linux</a></li><li><a href="/statistiques">Mes statistiques</a></li><li><a href="/game/?drill=flash">Exercice flash</a></li></ul></div>
      <div><h4>Apprendre</h4><ul><li><a href="/regles-du-blackjack">Règles du blackjack</a></li><li><a href="/strategie-de-base-blackjack">Stratégie de base</a></li><li><a href="/compter-les-cartes-blackjack">Compter les cartes</a></li><li><a href="/simulateur-blackjack">Simulateur</a></li><li><a href="/apprendre">Guide complet</a></li></ul></div>
      <div><h4>Infos</h4><ul><li><a href="/credits">Crédits et licences</a></li><li><a href="/credits#confidentialite">Confidentialité</a></li><li><a href="/credits#jeu-responsable">Jeu responsable</a></li></ul></div>
    </div>
    <div class="foot-legal">
      <span>Blackjack Play est un outil d'entraînement. Aucun pari, aucune mise d'argent, aucun gain. Le blackjack réel reste un jeu de hasard où le casino garde l'avantage.</span>
      <span>Version ${cfg.version}</span>
    </div>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
${meta.scripts || ''}
</body>
</html>
`;
}

const vars = {
  ...Object.fromEntries(['play', 'download', 'graduation-cap', 'brain', 'table-2', 'target', 'chart-column', 'layout-grid', 'timer', 'gauge', 'monitor', 'eye', 'volume-2', 'user', 'layers', 'check', 'chevron-right', 'sliders-horizontal', 'hand', 'coins', 'award', 'scroll-text'].map((n) => ['ico:' + n, ICON(n)])),
  'os:windows': OS.windows, 'os:mac': OS.mac, 'os:linux': OS.linux,
  version: cfg.version, domain: DOMAIN, releaseDate: cfg.releaseDate,
};
const ch = chartHTML(DEFAULT_RULES);
vars['chart:hard'] = ch.hard; vars['chart:soft'] = ch.soft; vars['chart:pairs'] = ch.pairs;
for (const [k, f] of Object.entries(cfg.downloads)) { vars[`dl:${k}:url`] = cfg.downloadBase + f.file; vars[`dl:${k}:size`] = f.size; vars[`dl:${k}:file`] = f.file; }

const sitemap = [];
for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(PAGES, file), 'utf8');
  const m = src.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
  const meta = JSON.parse(m[1]);
  let body = src.slice(m[0].length);
  body = body.replace(/\{\{([\w:-]+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));
  // Typographie française : espaces insécables (pas de « ? » ou « : » seuls en début de ligne)
  body = body.replace(/>([^<]+)</g, (all, txt) => '>' + txt.replace(/« /g, '« ').replace(/ »/g, ' »').replace(/ ([:;?!])(?=\s|$)/g, ' $1') + '<');
  if (meta.jsonld) meta.jsonld = JSON.parse(JSON.stringify(meta.jsonld).replace(/\{\{([\w:-]+)\}\}/g, (all, k) => (k in vars ? String(vars[k]).replace(/"/g, '\\"') : all)));
  const out = layout(meta, body);
  const dest = meta.out || (meta.path === '/' ? 'index.html' : meta.path.replace(/^\//, '') + '.html');
  fs.writeFileSync(path.join(SITE, dest), out);
  if (!meta.noindex) sitemap.push({ loc: DOMAIN + meta.path, priority: meta.priority || 0.6 });
  console.log('page', dest);
}
sitemap.push({ loc: DOMAIN + '/game/', priority: 0.9 });
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((s) => `  <url><loc>${s.loc}</loc><lastmod>${cfg.releaseDate}</lastmod><priority>${s.priority}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /downloads/\nDisallow: /tableau/
Disallow: /merci\nDisallow: /api/\n\nSitemap: ${DOMAIN}/sitemap.xml\n`);
fs.writeFileSync(path.join(SITE, 'assets', 'downloads.json'), JSON.stringify({ version: cfg.version, base: cfg.downloadBase, files: cfg.downloads }, null, 2));
console.log('sitemap + robots ok');
