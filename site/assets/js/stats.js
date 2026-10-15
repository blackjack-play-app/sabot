// Page Statistiques : lit les données enregistrées par le jeu (même navigateur).
import { loadStats, exportAll, importAll, emptyStats, saveStats } from '/game/js/store.js';

const root = document.getElementById('stats-root');
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmt = (n) => nf.format(n);
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ACT = { H: 'Carte', S: 'Rester', D: 'Doubler', P: 'Séparer', R: 'Abandonner', I: 'Assurance', NI: 'Refuser l\'assurance' };

function line(canvas, values, zero = null) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  if (values.length < 2) { ctx.fillStyle = '#887c6c'; ctx.font = '14px Barlow'; ctx.textAlign = 'center'; ctx.fillText('Joue quelques donnes pour voir la courbe', w / 2, h / 2); return; }
  let min = Math.min(...values), max = Math.max(...values);
  if (zero !== null) { min = Math.min(min, zero); max = Math.max(max, zero); }
  if (max === min) { max++; min--; }
  const X = (i) => 40 + (i / (values.length - 1)) * (w - 50);
  const Y = (v) => 10 + (1 - (v - min) / (max - min)) * (h - 34);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  for (let k = 0; k <= 4; k++) { const y = 10 + k * (h - 34) / 4; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 10, y); ctx.stroke(); }
  ctx.fillStyle = '#887c6c'; ctx.font = '12px "Barlow Condensed"';
  ctx.fillText(fmt(max), 2, 16); ctx.fillText(fmt(min), 2, h - 26);
  if (zero !== null) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(40, Y(zero)); ctx.lineTo(w - 10, Y(zero)); ctx.stroke(); ctx.setLineDash([]); }
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(201,162,74,.35)'); g.addColorStop(1, 'rgba(201,162,74,0)');
  ctx.beginPath(); values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.lineTo(X(values.length - 1), h - 24); ctx.lineTo(X(0), h - 24); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2; ctx.stroke();
}

function heatmap(cells, kind, rows) {
  const ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let html = '<div class="heat"><div class="hh"></div>' + ups.map((u) => `<div class="hh">${u === 11 ? 'A' : u}</div>`).join('');
  for (const r of rows) {
    html += `<div class="hh" style="text-align:right;padding-right:6px">${r.label}</div>`;
    for (const u of ups) {
      const c = cells[`${kind}:${r.key}:${u}`];
      if (!c) { html += '<div style="background:#1d1813"></div>'; continue; }
      const p = c.ok / c.n;
      const col = p >= 0.999 ? '#2f6b4a' : p >= 0.75 ? '#7a6a2a' : '#7a2a24';
      html += `<div style="background:${col}" title="${c.ok}/${c.n} justes">${Math.round(p * 100)}</div>`;
    }
  }
  return html + '</div>';
}

function render() {
  const s = loadStats();
  const played = s.hands > 0 || s.drills.flash.n > 0 || s.countQuiz.n > 0;
  if (!played) {
    root.innerHTML = `<div class="empty"><h2>Pas encore de statistiques</h2><p>Joue quelques donnes ou fais un exercice : tes résultats apparaîtront ici automatiquement.</p><a class="btn btn-gold btn-lg" href="/game/">Jouer maintenant</a>
      <p style="margin-top:22px;font-size:14px">Tu as une sauvegarde ? <a href="#" id="imp">Importer un fichier</a></p></div>`;
    document.getElementById('imp').addEventListener('click', (e) => { e.preventDefault(); doImport(); });
    return;
  }
  const d = s.decisions;
  const bs = ['hard', 'soft', 'pair'];
  const dn = bs.reduce((a, k) => a + d[k].n, 0), dok = bs.reduce((a, k) => a + d[k].ok, 0);
  const done = s.wins + s.losses + s.pushes;
  const acc = pct(dok, dn);
  const bar = (label, o) => {
    const p = pct(o.ok, o.n);
    return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${p ?? 0}%;background:${p !== null && p < 85 ? 'var(--red)' : 'var(--gold)'}"></i></div><b>${p === null ? '—' : p + ' %'}</b></div>`;
  };
  const weak = Object.entries(s.cells).filter(([, c]) => c.n >= 2 && c.ok < c.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n || b[1].n - a[1].n).slice(0, 10);
  const name = (k) => { const [kind, t, up] = k.split(':'); return `${kind === 'pair' ? 'Paire de ' + (t === '11' ? 'as' : t) : (kind === 'soft' ? 'Souple ' : 'Dur ') + t} contre ${up === '11' ? 'as' : up}`; };
  const cd = s.drills.countdown.filter((x) => x.ok).sort((a, b) => a.ms - b.ms)[0];
  const hardRows = []; for (let t = 17; t >= 8; t--) hardRows.push({ key: t, label: t });
  const softRows = []; for (let t = 20; t >= 13; t--) softRows.push({ key: t, label: 'A,' + (t - 11) });
  const pairRows = [11, 10, 9, 8, 7, 6, 4, 3, 2].map((v) => ({ key: v, label: v === 11 ? 'A,A' : v + ',' + v }));

  root.innerHTML = `
  <div class="stat-grid">
    <div class="stat"><span>Mains jouées</span><b>${fmt(s.hands)}</b><small>${fmt(s.rounds)} donnes</small></div>
    <div class="stat"><span>Précision stratégie</span><b class="${acc !== null && acc >= 95 ? 'pos' : ''}">${acc === null ? '—' : acc + ' %'}</b><small>${fmt(dn)} décisions</small></div>
    <div class="stat"><span>Résultat (fictif)</span><b class="${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}">${signed(s.net) || '0'}</b><small>${fmt(s.wagered)} jetons misés</small></div>
    <div class="stat"><span>Temps de jeu</span><b>${Math.round(s.playMs / 60000)} min</b><small>depuis le ${new Date(s.created).toLocaleDateString('fr-FR')}</small></div>
  </div>
  <div class="panel"><h2>Évolution de la réserve</h2><canvas class="chart" id="c-bank"></canvas></div>
  <div class="two">
    <div class="panel"><h2>Précision par type de décision</h2>
      ${bar('Mains dures', d.hard)}${bar('Mains souples', d.soft)}${bar('Paires', d.pair)}${bar('Assurance', d.insurance)}${bar('Déviations', d.deviation || { ok: 0, n: 0 })}
    </div>
    <div class="panel"><h2>Résultats des mains</h2>
      ${bar('Gagnées', { ok: s.wins, n: done })}${bar('Perdues', { ok: s.losses, n: done })}${bar('Égalités', { ok: s.pushes, n: done })}${bar('Blackjacks', { ok: s.blackjacks, n: s.hands })}${bar('Sautées', { ok: s.busts, n: s.hands })}
    </div>
  </div>
  <div class="two">
    <div class="panel"><h2>Tes points faibles</h2>
      ${weak.length ? '<ul class="list">' + weak.map(([k, c]) => `<li>${name(k)}<span>${c.ok}/${c.n} justes</span></li>`).join('') + '</ul>' : '<p style="color:var(--ink-3)">Aucune erreur répétée. Bravo.</p>'}
    </div>
    <div class="panel"><h2>Dernières erreurs</h2>
      ${s.mistakes.length ? '<ul class="list">' + s.mistakes.slice(-10).reverse().map((m) => `<li>${esc((m.cards || []).map((c) => c.replace(/[shdc]$/, '')).join(' '))} contre ${m.up === 11 ? 'as' : m.up}<span>${ACT[m.did] || m.did} → <b style="color:var(--ink)">${ACT[m.should] || m.should}</b></span></li>`).join('') + '</ul>' : '<p style="color:var(--ink-3)">Aucune erreur enregistrée.</p>'}
    </div>
  </div>
  <div class="panel"><h2>Carte de précision (en %)</h2>
    <p style="color:var(--ink-3);font-size:14px;margin:0 0 10px">Vert : toujours juste. Ocre : parfois faux. Rouge : souvent faux. Colonnes : carte du croupier.</p>
    <h3 style="font-size:15px;margin:14px 0 6px">Mains dures</h3>${heatmap(s.cells, 'hard', hardRows)}
    <h3 style="font-size:15px;margin:14px 0 6px">Mains souples</h3>${heatmap(s.cells, 'soft', softRows)}
    <h3 style="font-size:15px;margin:14px 0 6px">Paires</h3>${heatmap(s.cells, 'pair', pairRows)}
  </div>
  <div class="two">
    <div class="panel"><h2>Comptage</h2>
      ${bar('Quiz du compte', { ok: s.countQuiz.ok, n: s.countQuiz.n })}${bar('Compte réel', s.drills.tc)}
      <p style="color:var(--ink-3);font-size:14px">${s.countQuiz.n ? `Erreur moyenne : ${(s.countQuiz.absErr / s.countQuiz.n).toFixed(1)} point(s). ` : ''}${cd ? `Meilleur décompte juste : ${(cd.ms / 1000).toFixed(1)} s pour ${cd.n} cartes.` : ''}</p>
    </div>
    <div class="panel"><h2>Exercices</h2>
      ${bar('Flash stratégie', s.drills.flash)}${bar('Déviations', s.drills.deviations)}
      <p style="color:var(--ink-3);font-size:14px">Record de série en flash : ${fmt(s.drills.flash.best || 0)}.</p>
    </div>
  </div>
  <div class="panel"><h2>Tes données</h2>
    <p style="color:var(--ink-2)">Exporte une sauvegarde pour la transférer sur un autre appareil ou dans l'application à télécharger.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="exp">Exporter</button><button class="btn" id="imp">Importer</button><button class="btn" id="rst">Tout effacer</button><a class="btn btn-gold" href="/game/">Retour au jeu</a></div>
  </div>`;
  requestAnimationFrame(() => line(document.getElementById('c-bank'), s.bankHistory.map((p) => p.v)));
  document.getElementById('exp').onclick = () => {
    const url = URL.createObjectURL(new Blob([exportAll()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `sabot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  document.getElementById('imp').onclick = doImport;
  document.getElementById('rst').onclick = () => { if (confirm('Effacer toutes tes statistiques ? Cette action est définitive.')) { saveStats(emptyStats()); render(); } };
}

function doImport() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => { try { importAll(await inp.files[0].text()); render(); } catch (e) { alert('Fichier invalide : ' + e.message); } };
  inp.click();
}

render();
window.addEventListener('resize', () => { const c = document.getElementById('c-bank'); if (c) line(c, loadStats().bankHistory.map((p) => p.v)); });
