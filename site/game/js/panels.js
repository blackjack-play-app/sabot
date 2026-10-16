// Panneaux : réglages, statistiques, tableau de stratégie, aide, crédits, accueil.
import { PRESETS, houseEdge, rulesSummary } from './rules.js';
import { buildChart, ACTION_LABEL } from './strategy.js';
import { COUNT_SYSTEMS } from './cards.js';
import { FELTS, BACKS } from './textures.js';
import { REAL_SKINS } from './dealer3d.js';
import { ACHIEVEMENTS } from './achievements.js';
import * as store from './store.js';
import {
  $, h, fmt, fmtSigned, pct, openDrawer, closeDrawer, openModal, closeModal, field, toggle, select, seg, range,
  lineChart, icon, toast,
} from './ui.js';

const SKIN_COLORS = {
  gilet: ['#6d6a62', '#d9d4c8'], smoking: ['#111', '#b3202c'], chemise: ['#efefef', '#222'],
  marine: ['#1e2a4a', '#e8e8e8'], croupiere: ['#141414', '#f2f2f2'], bordeaux: ['#6a1d2a', '#2a2a2a'],
};

export class Panels {
  constructor(app) {
    this.app = app;
    this.settingsTab = 'regles';
  }

  // ================================================================= Réglages
  settings(tab = this.settingsTab) {
    this.settingsTab = tab;
    const a = this.app, s = a.settings;
    const tabs = [['regles', 'Règles'], ['aide', 'Aide & jeu'], ['comptage', 'Comptage'], ['apparence', 'Apparence'], ['son', 'Son'], ['graphismes', 'Graphismes'], ['donnees', 'Données']];
    const bar = h('div', { class: 'tabs', role: 'tablist' });
    for (const [k, l] of tabs) {
      bar.append(h('button', { role: 'tab', 'aria-selected': String(k === tab), onclick: () => this.settings(k) }, l));
    }
    const body = h('div');
    const R = s.rules;
    const setR = (patch) => { a.applyRules(patch); this.settings(tab); };

    if (tab === 'regles') {
      body.append(h('div', { class: 'section-title' }, 'Préréglages de casino'));
      const pr = h('div', { class: 'presets' });
      for (const [k, p] of Object.entries(PRESETS)) {
        pr.append(h('button', { class: 'preset', onclick: () => { setR(p.rules); toast('Règles : ' + p.label); } }, h('b', {}, p.label), h('span', {}, p.desc)));
      }
      body.append(pr);
      const edge = houseEdge(R);
      body.append(h('div', { class: 'edge-box' },
        h('div', {}, h('div', { style: { fontSize: '13px', color: 'var(--ink-3)' } }, 'Avantage du casino avec une stratégie parfaite'), h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '2px' } }, rulesSummary(R))),
        h('b', { style: { color: edge > 1 ? 'var(--red)' : edge > 0.5 ? 'var(--gold-2)' : 'var(--green)' } }, (edge >= 0 ? '' : '−') + Math.abs(edge).toFixed(2) + ' %')));
      body.append(h('div', { class: 'section-title' }, 'Sabot'));
      body.append(field('Nombre de jeux', seg([[1, '1'], [2, '2'], [4, '4'], [6, '6'], [8, '8']], R.decks, (v) => setR({ decks: Number(v) }))));
      body.append(field('Pénétration', h('span', {}, range(50, 90, 5, Math.round(R.penetration * 100), (v) => { a.applyRules({ penetration: v / 100 }); this._pen.textContent = v + ' %'; }), this._pen = h('b', { style: { marginLeft: '8px', fontFamily: 'var(--cond)' } }, Math.round(R.penetration * 100) + ' %')),
        'Part du sabot distribuée avant le mélange (position de la carte de coupe). Plus elle est élevée, plus le comptage est efficace.'));
      body.append(field('Mélangeur continu (CSM)', toggle(R.csm, (v) => setR({ csm: v })), 'Les cartes sont remélangées à chaque donne : le comptage devient inutile.'));
      body.append(h('div', { class: 'section-title' }, 'Croupier'));
      body.append(field('Sur 17 souple', seg([[false, 'Reste (S17)'], [true, 'Tire (H17)']], R.dealerHitsSoft17, (v) => setR({ dealerHitsSoft17: v === true || v === 'true' }))));
      body.append(field('Carte cachée', seg([[true, 'Oui (US)'], [false, 'Non (Europe)']], R.holeCard, (v) => setR({ holeCard: v === true || v === 'true' })),
        'Sans carte cachée (règle européenne), le croupier tire sa 2e carte à la fin : contre un blackjack tu perds aussi tes mises doublées et séparées.'));
      if (!R.holeCard) body.append(field('Europe : ne perdre que la mise de base', toggle(R.enhcOriginalBetsOnly, (v) => setR({ enhcOriginalBetsOnly: v }))));
      body.append(h('div', { class: 'section-title' }, 'Joueur'));
      body.append(field('Le blackjack paie', seg([[1.5, '3:2'], [1.2, '6:5'], [1, '1:1']], R.blackjackPays, (v) => setR({ blackjackPays: Number(v) })), 'Le 6:5 multiplie l\'avantage du casino par 3 : à fuir dans la vraie vie.'));
      body.append(field('Doubler sur', seg([['any', 'Toutes'], ['9-11', '9 à 11'], ['10-11', '10 et 11']], R.doubleOn, (v) => setR({ doubleOn: v }))));
      body.append(field('Doubler après séparation', toggle(R.das, (v) => setR({ das: v }))));
      body.append(field('Mains max après séparation', seg([[2, '2'], [3, '3'], [4, '4']], R.maxSplitHands, (v) => setR({ maxSplitHands: Number(v) }))));
      body.append(field('Reséparer les as', toggle(R.resplitAces, (v) => setR({ resplitAces: v }))));
      body.append(field('Tirer sur as séparés', toggle(R.hitSplitAces, (v) => setR({ hitSplitAces: v }))));
      body.append(field('Séparer deux figures différentes', toggle(R.splitAnyTen, (v) => setR({ splitAnyTen: v })), 'Par exemple un valet et un roi.'));
      body.append(field('Abandon', seg([['none', 'Non'], ['late', 'Tardif'], ['early', 'Anticipé']], R.surrender, (v) => setR({ surrender: v }))));
      body.append(field('Assurance proposée', toggle(R.insurance, (v) => setR({ insurance: v }))));
      body.append(h('div', { class: 'section-title' }, 'Mises'));
      body.append(field('Mise minimum', select([[1, '1'], [5, '5'], [10, '10'], [25, '25'], [100, '100']], R.minBet, (v) => setR({ minBet: Number(v) }))));
      body.append(field('Mise maximum', select([[500, '500'], [1000, '1 000'], [5000, '5 000'], [10000, '10 000']], R.maxBet, (v) => setR({ maxBet: Number(v) }))));
    }

    if (tab === 'aide') {
      body.append(h('div', { class: 'section-title' }, 'Niveau d\'aide'));
      body.append(field('Conseils', seg([['before', 'Avant chaque coup'], ['after', 'Correction après'], ['off', 'Aucune']], s.adviceMode, (v) => { s.adviceMode = v; a.saveSettings(); a.buildTopbar(); }),
        'Avant : le bon coup est surligné avant que tu joues. Après : tu joues seul et tu es corrigé en cas d\'erreur. Aucune : comme au casino.'));
      body.append(field('Bloquer les erreurs (mode « avant »)', toggle(s.confirmMistakes, (v) => { s.confirmMistakes = v; a.saveSettings(); }), 'Demande une confirmation si tu choisis un coup différent du conseil.'));
      body.append(field('Inclure les déviations au compte', toggle(s.deviations, (v) => { s.deviations = v; a.saveSettings(); }), 'Les conseils tiennent compte du compte réel (Illustrious 18 et Fab 4, en Hi-Lo).'));
      body.append(h('div', { class: 'section-title' }, 'Table'));
      body.append(field('Vitesse du croupier', seg([['lent', 'Lente'], ['normal', 'Normale'], ['rapide', 'Rapide'], ['eclair', 'Éclair']], s.speed, (v) => a.applySpeed(v))));
      body.append(field('Afficher les totaux', toggle(s.showTotals, (v) => { s.showTotals = v; a.saveSettings(); a.refreshLabels(); }), 'Désactive pour t\'entraîner à additionner seul.'));
      body.append(field('Panneau « Mes mains »', toggle(s.myHandsPanel !== false, (v) => { s.myHandsPanel = v; a.saveSettings(); a.refreshLabels(); }), 'Récapitulatif à droite : cartes, total et mise de chacune de tes mains.'));
      body.append(field('Re-miser automatiquement', toggle(s.autoRebet, (v) => { s.autoRebet = v; a.saveSettings(); })));
      body.append(field('Réserve de départ', select([[1000, '1 000'], [5000, '5 000'], [10000, '10 000'], [50000, '50 000']], s.startBank, (v) => { s.startBank = Number(v); a.saveSettings(); }), 'Jetons fictifs donnés lors d\'une recharge.'));
      body.append(h('div', { class: 'section-title' }, 'Joueurs autour de la table'));
      body.append(h('p', { style: { fontSize: '13px', color: 'var(--ink-3)', margin: '6px 0' } }, 'Choisis qui occupe chaque place. Tu peux jouer jusqu\'à 5 mains toi-même. Les joueurs IA jouent la stratégie de base et font défiler plus de cartes (idéal pour compter).'));
      for (let i = 0; i < 5; i++) {
        body.append(field(`Place ${i + 1}${i === 0 ? ' (première base)' : i === 4 ? ' (troisième base)' : ''}`, seg([['player', 'Moi'], ['bot', 'IA'], ['', 'Vide']], s.seats[i] || '', (v) => {
          if (!a.isBetting()) { toast('Attends la fin de la donne'); return; }
          s.seats[i] = v || null; a.saveSettings(); a.refreshSeats();
        })));
      }
    }

    if (tab === 'comptage') {
      body.append(field('Système', select(Object.entries(COUNT_SYSTEMS).map(([k, v]) => [k, v.name]), s.countSystem, (v) => { a.applyCountSystem(v); this.settings(tab); })));
      const sys = COUNT_SYSTEMS[s.countSystem];
      const tagRow = h('div', { class: 'heat', style: { gridTemplateColumns: 'repeat(10, 1fr)', marginBottom: '6px' } });
      ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].forEach((l) => tagRow.append(h('div', { class: 'h-head' }, l)));
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((v) => {
        const t = sys.tags[v];
        tagRow.append(h('div', { style: { background: t > 0 ? '#2f6b4a' : t < 0 ? '#6e2a25' : '#2a231c', color: 'var(--ink)' } }, t > 0 ? '+' + t : String(t)));
      });
      body.append(h('p', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, sys.desc), tagRow);
      body.append(field('Afficher le compte', toggle(s.showCount, (v) => { s.showCount = v; a.saveSettings(); a.buildTopbar(); a.updateCount(); }), 'Raccourci : C. Masque-le pour t\'entraîner pour de vrai.'));
      body.append(field('Mise conseillée selon le compte', toggle(s.showSpread, (v) => { s.showSpread = v; a.saveSettings(); a.updateCount(); }), 'Écart de 1 à 8 unités selon le compte réel Hi-Lo.'));
      body.append(field('Unité de mise', select([[5, '5'], [10, '10'], [25, '25'], [50, '50'], [100, '100']], s.unit, (v) => { s.unit = Number(v); a.saveSettings(); a.updateCount(); })));
      body.append(field('Quiz du compte', select([[0, 'Jamais'], [3, 'Toutes les 3 donnes'], [6, 'Toutes les 6 donnes'], [10, 'Toutes les 10 donnes']], s.quizEvery, (v) => { s.quizEvery = Number(v); a.saveSettings(); })));
      body.append(field('Quiz à la fin du sabot', toggle(s.quizAtShuffle, (v) => { s.quizAtShuffle = v; a.saveSettings(); })));
      body.append(h('button', { class: 'btn', style: { marginTop: '14px' }, onclick: () => a.newShoe() }, icon('shuffle', 16), 'Mélanger un nouveau sabot'));
    }

    if (tab === 'apparence') {
      body.append(h('div', { class: 'section-title' }, 'Croupier'));
      const skins = h('div', { class: 'skins' });
      for (const [k, sk] of Object.entries(REAL_SKINS)) {
        const [c1, c2] = SKIN_COLORS[k] || ['#444', '#ddd'];
        skins.append(h('button', { class: 'skin', 'aria-pressed': String(s.style.skin === k), onclick: () => { a.applyStyle({ skin: k }); this.settings(tab); } },
          h('i', { style: { background: `linear-gradient(90deg, ${c1} 0 35%, ${c2} 35% 65%, ${c1} 65%)` } }), sk.label));
      }
      body.append(skins);
      body.append(h('p', { style: { fontSize: '12px', color: 'var(--ink-3)' } }, 'Avatars réalistes Microsoft Rocketbox (licence MIT).'));
      body.append(h('div', { class: 'section-title' }, 'Tapis'));
      const felts = h('div', { class: 'swatches' });
      for (const [k, f] of Object.entries(FELTS)) felts.append(h('button', { class: 'swatch', title: f.label, 'aria-pressed': String(s.style.felt === k), style: { background: f.base }, onclick: () => { a.applyStyle({ felt: k }); this.settings(tab); } }));
      body.append(felts);
      body.append(h('div', { class: 'section-title' }, 'Dos des cartes'));
      const backs = h('div', { class: 'swatches' });
      for (const [k, b] of Object.entries(BACKS)) backs.append(h('button', { class: 'swatch', title: b.label, 'aria-pressed': String(s.style.back === k), style: { background: `repeating-linear-gradient(45deg, ${b.base} 0 5px, ${b.line} 5px 6px)` }, onclick: () => { a.applyStyle({ back: k }); this.settings(tab); } }));
      body.append(backs);
      body.append(field('Jeu 4 couleurs', toggle(s.style.fourColor, (v) => { a.applyStyle({ fourColor: v }); }), 'Cœur rouge, carreau bleu, trèfle vert, pique noir : plus rapide à lire et adapté aux daltoniens.'));
      body.append(field('Indices des figures', seg([['fr', 'R D V (français)'], ['en', 'K Q J (anglais)']], s.style.indices, (v) => { a.applyStyle({ indices: v }); })));
    }

    if (tab === 'son') {
      const A = s.audio;
      body.append(field('Couper le son', toggle(A.muted, (v) => a.applyAudio({ muted: v }))));
      body.append(field('Volume général', range(0, 1, 0.05, A.master, (v) => a.applyAudio({ master: v }))));
      body.append(field('Effets (cartes, jetons)', range(0, 1, 0.05, A.sfx, (v) => a.applyAudio({ sfx: v }))));
      body.append(field('Voix du croupier', seg([['off', 'Muet'], ['essentiel', 'Essentiel'], ['bavard', 'Bavard']], A.voiceLevel, (v) => a.applyAudio({ voiceLevel: v })),
        'Essentiel : annonces importantes (assurance, blackjack, total du croupier). Bavard : annonce aussi tes totaux.'));
      body.append(field('Volume de la voix', range(0, 1, 0.05, A.voice, (v) => a.applyAudio({ voice: v }))));
      body.append(field('Musique d’ambiance', toggle(A.music, (v) => a.applyAudio({ music: v })), 'Composée en direct par le jeu : jamais deux fois la même.'));
      body.append(field('Style de musique', seg([['jazz', 'Lounge jazz'], ['calme', 'Piano calme']], A.musicStyle, (v) => a.applyAudio({ musicStyle: v }))));
      body.append(field('Volume de la musique', range(0, 1, 0.05, A.musicVol, (v) => a.applyAudio({ musicVol: v }))));
      body.append(field('Ambiance de salle', toggle(A.ambience, (v) => a.applyAudio({ ambience: v })), 'Léger brouhaha et jetons au loin.'));
      body.append(field('Volume de l\'ambiance', range(0, 1, 0.05, A.ambienceVol, (v) => a.applyAudio({ ambienceVol: v }))));
      body.append(h('button', { class: 'btn', style: { marginTop: '12px' }, onclick: () => { a.audio.unlock(); a.audio.say('Faites vos jeux.', 'essentiel'); } }, icon('volume-2', 16), 'Tester la voix'));
      const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().filter((v) => v.lang.startsWith('fr')) : [];
      body.append(h('p', { style: { fontSize: '12.5px', color: 'var(--ink-3)' } }, voices.length ? `Voix utilisée : ${a.audio.voice ? a.audio.voice.name : 'par défaut'} (${voices.length} voix françaises disponibles sur cet appareil).` : 'Aucune voix française détectée sur cet appareil : la voix du croupier sera silencieuse. Sous Windows, ajoute la langue « Français » dans Paramètres → Heure et langue → Voix.'));
    }

    if (tab === 'graphismes') {
      const cur = a.currentQualityKey();
      body.append(field('Qualité', seg([['auto', 'Auto'], ['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute'], ['ultra', 'Ultra']], s.quality, (v) => { a.applyQuality(v); this.settings(tab); }),
        `En automatique, Blackjack Play détecte ta carte graphique et baisse la qualité si le jeu ralentit. Actuellement : ${a.quality[cur].label}.`));
      const g = a.scene.renderer.getContext();
      let gpu = '';
      try { const ext = g.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch { /* inconnu */ }
      body.append(h('p', { style: { fontSize: '12.5px', color: 'var(--ink-3)' } }, `Carte graphique : ${gpu || 'inconnue'}`));
      body.append(h('div', { class: 'section-title' }, 'Détails'));
      const rows = [['Résolution', 'pixelRatio', (v) => '×' + v], ['Ombres', 'shadows', (v) => (v ? 'Oui' : 'Non')], ['Croupier', 'dealer', (v) => (v === 'hd' ? 'Textures 2K' : 'Textures 1K')], ['Matières', 'tex', (v) => v.toUpperCase()]];
      const p = a.quality[cur];
      for (const [l, k, f] of rows) body.append(field(l, h('b', { style: { fontFamily: 'var(--cond)' } }, f(p[k]))));
    }

    if (tab === 'donnees') {
      body.append(h('p', { style: { fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.5 } }, 'Tout est enregistré sur cet appareil uniquement (aucun compte, aucun serveur). Exporte tes données pour les transférer sur un autre ordinateur ou entre le site et l\'application.'));
      body.append(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' } },
        h('button', { class: 'btn', onclick: () => this.exportData() }, icon('download', 16), 'Exporter'),
        h('button', { class: 'btn', onclick: () => this.importData() }, icon('upload', 16), 'Importer')));
      body.append(h('div', { class: 'section-title' }, 'Réinitialiser'));
      body.append(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' } },
        h('button', { class: 'btn', onclick: () => { if (!a.isBetting()) return toast('Attends la fin de la donne'); a.resetBank(); toast('Réserve rechargée', 'good'); } }, icon('coins', 16), 'Recharger les jetons'),
        h('button', { class: 'btn', onclick: () => this.confirm('Effacer toutes les statistiques ?', () => { a.stats = store.emptyStats(); a.saveStats(); toast('Statistiques effacées'); }) }, icon('trash-2', 16), 'Effacer les stats'),
        h('button', { class: 'btn', onclick: () => this.confirm('Remettre tous les réglages par défaut ?', () => { localStorage.removeItem(store.KEYS.settings); location.reload(); }) }, icon('rotate-ccw', 16), 'Réglages par défaut')));
      body.append(h('div', { class: 'section-title' }, 'À propos'));
      body.append(h('p', { style: { fontSize: '13px', color: 'var(--ink-3)' } }, 'Blackjack Play 1.1.1 — entraîneur de blackjack. Jetons fictifs uniquement : aucun argent réel, aucun pari, aucun gain.'));
      body.append(h('button', { class: 'btn', onclick: () => this.credits() }, icon('scroll-text', 16), 'Crédits et licences'));
    }

    openDrawer('settings', 'Réglages', h('div', {}, bar, body));
  }

  confirm(text, yes) {
    openModal(h('div', {}, h('h2', {}, 'Confirmer'), h('p', { class: 'lead' }, text),
      h('div', { class: 'coach-actions' }, h('button', { class: 'btn primary', onclick: () => { closeModal(); yes(); } }, 'Oui'), h('button', { class: 'btn', onclick: () => closeModal() }, 'Annuler'))));
  }

  exportData() {
    const blob = new Blob([store.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const aEl = h('a', { href: url, download: `sabot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(aEl); aEl.click(); aEl.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  importData() {
    const inp = h('input', { type: 'file', accept: 'application/json,.json' });
    inp.addEventListener('change', async () => {
      try { store.importAll(await inp.files[0].text()); toast('Données importées', 'good'); setTimeout(() => location.reload(), 600); }
      catch (e) { toast('Fichier invalide : ' + e.message, 'bad', 3500); }
    });
    inp.click();
  }

  // ================================================================= Statistiques
  stats() {
    const st = this.app.stats;
    const body = h('div');
    const handsDone = st.wins + st.losses + st.pushes;
    const dec = st.decisions;
    const decN = ['hard', 'soft', 'pair'].reduce((x, k) => x + dec[k].n, 0);
    const decOk = ['hard', 'soft', 'pair'].reduce((x, k) => x + dec[k].ok, 0);
    const kpi = (label, value, cls = '') => h('div', { class: 'kpi' }, h('span', {}, label), h('b', { class: cls }, value));
    body.append(h('div', { class: 'kpis' },
      kpi('Mains jouées', fmt(st.hands)),
      kpi('Précision', decN ? pct(decOk, decN) + ' %' : '—', decN && decOk / decN > 0.95 ? 'pos' : ''),
      kpi('Résultat', fmtSigned(st.net) || '0', st.net > 0 ? 'pos' : st.net < 0 ? 'neg' : ''),
      kpi('Gagnées', handsDone ? pct(st.wins, handsDone) + ' %' : '—'),
      kpi('Blackjacks', fmt(st.blackjacks)),
      kpi('Temps de jeu', Math.round(st.playMs / 60000) + ' min')));
    body.append(h('div', { class: 'section-title' }, 'Évolution de la réserve'));
    const cv = h('canvas');
    body.append(h('div', { class: 'chart-wrap' }, cv));
    body.append(h('div', { class: 'section-title' }, 'Précision des décisions'));
    const bars = h('div', { class: 'bars' });
    const bar = (label, o) => bars.append(h('div', { class: 'bar-row' }, h('span', {}, label), h('div', { class: 'bar' }, h('i', { style: { width: (o.n ? pct(o.ok, o.n) : 0) + '%', background: o.n && o.ok / o.n < 0.85 ? 'var(--red)' : 'var(--gold)' } })), h('b', {}, o.n ? pct(o.ok, o.n) + ' %' : '—')));
    bar('Mains dures', dec.hard); bar('Mains souples', dec.soft); bar('Paires', dec.pair); bar('Assurance', dec.insurance); bar('Déviations', dec.deviation || { ok: 0, n: 0 });
    const q = st.countQuiz;
    bar('Quiz du compte', { ok: q.ok, n: q.n });
    body.append(bars);
    if (q.n) body.append(h('p', { style: { fontSize: '13px', color: 'var(--ink-3)', margin: '0' } }, `Erreur moyenne au quiz : ${(q.absErr / q.n).toFixed(1)} point(s) sur ${q.n} quiz.`));

    body.append(h('div', { class: 'section-title' }, 'Tes points faibles'));
    const weak = Object.entries(st.cells).filter(([, c]) => c.n >= 2 && c.ok / c.n < 1).sort((x, y) => (x[1].ok / x[1].n) - (y[1].ok / y[1].n) || y[1].n - x[1].n).slice(0, 8);
    if (!weak.length) body.append(h('p', { style: { fontSize: '13.5px', color: 'var(--ink-3)' } }, 'Aucune erreur répétée pour l\'instant. Continue !'));
    else {
      const ul = h('ul', { class: 'mistakes' });
      for (const [k, c] of weak) {
        const [kind, tot, up] = k.split(':');
        const upL = up === '11' ? 'As' : up;
        const name = kind === 'pair' ? `Paire de ${tot === '11' ? 'as' : tot}` : `${kind === 'soft' ? 'Souple' : 'Dur'} ${tot}`;
        ul.append(h('li', {}, `${name} contre ${upL}`, h('span', {}, `${c.ok}/${c.n} justes`)));
      }
      body.append(ul);
    }
    body.append(h('div', { class: 'section-title' }, 'Dernières erreurs'));
    const recent = st.mistakes.slice(-6).reverse();
    if (!recent.length) body.append(h('p', { style: { fontSize: '13.5px', color: 'var(--ink-3)' } }, 'Aucune erreur enregistrée.'));
    else {
      const ul = h('ul', { class: 'mistakes' });
      const lab = (x) => (x === 'I' ? 'Assurance' : x === 'NI' ? 'Refuser' : ACTION_LABEL[x] || x);
      for (const m of recent) {
        const cards = (m.cards || []).map((c) => c.replace(/[shdc]$/, '')).join(' ');
        ul.append(h('li', {}, `${cards} contre ${m.up === 11 ? 'A' : m.up}`, h('span', {}, `${lab(m.did)} → ${lab(m.should)}`)));
      }
      body.append(ul);
    }
    body.append(h('div', { class: 'section-title' }, `Succès (${Object.keys(st.achievements || {}).length}/${ACHIEVEMENTS.length})`));
    const ach = h('div', { class: 'achs' });
    for (const x of ACHIEVEMENTS) {
      const got = st.achievements && st.achievements[x.id];
      ach.append(h('div', { class: 'ach' + (got ? ' got' : ''), title: x.desc, html: icon(got ? 'award' : 'target', 18) + `<b>${x.title}</b><span>${x.desc}</span>` }));
    }
    body.append(ach);
    body.append(h('div', { class: 'section-title' }, 'Dernières donnes'));
    const hist = (st.history || []).slice(-8).reverse();
    if (!hist.length) body.append(h('p', { style: { fontSize: '13.5px', color: 'var(--ink-3)' } }, 'Aucune donne enregistrée.'));
    else {
      const ul = h('ul', { class: 'mistakes' });
      const rl = (c) => c.replace(/[shdc]$/, '');
      const RES = { win: 'gagné', blackjack: 'blackjack', lose: 'perdu', bust: 'sauté', push: 'égalité', surrender: 'abandon' };
      for (const r of hist) {
        ul.append(h('li', { style: { flexDirection: 'column', alignItems: 'stretch', gap: '3px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            h('span', { style: { color: 'var(--ink-2)' } }, `Croupier : ${r.dealer.map(rl).join(' ')} (${r.dt > 21 ? 'sauté' : r.dt})`),
            h('span', {}, new Date(r.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))),
          ...r.hands.map((x) => h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            `Place ${x.seat + 1} : ${x.cards.map(rl).join(' ')}`,
            h('b', { style: { color: x.net > 0 ? 'var(--green)' : x.net < 0 ? 'var(--red)' : 'var(--ink-2)', fontFamily: 'var(--cond)' } }, `${RES[x.r] || x.r} ${x.net ? fmtSigned(x.net) : ''}`)))));
      }
      body.append(ul);
    }
    body.append(h('div', { class: 'section-title' }, 'Détails'));
    const det = h('div', { class: 'kpis' },
      kpi('Doubles', fmt(st.doubles)), kpi('Séparations', fmt(st.splits)), kpi('Abandons', fmt(st.surrenders)),
      kpi('Plus gros gain', fmtSigned(st.biggestWin) || '0', 'pos'), kpi('Plus grosse perte', fmtSigned(st.biggestLoss) || '0', 'neg'), kpi('Meilleure série', fmt(st.bestStreak)),
      kpi('Flash stratégie', st.drills.flash.n ? pct(st.drills.flash.ok, st.drills.flash.n) + ' %' : '—'), kpi('Record flash', fmt(st.drills.flash.best)), kpi('Recharges', fmt(st.resets)));
    body.append(det);
    body.append(h('p', { style: { fontSize: '12.5px', color: 'var(--ink-3)' } }, 'Les statistiques détaillées avec graphiques sont aussi sur la page Statistiques du site.'));
    openDrawer('stats', 'Statistiques', body);
    requestAnimationFrame(() => lineChart(cv, st.bankHistory.slice(-300).map((p) => p.v)));
  }

  // ================================================================= Tableau de stratégie
  chart(sit) {
    const r = this.app.settings.rules;
    const c = buildChart(r);
    const ups = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
    const body = h('div');
    body.append(h('p', { style: { fontSize: '13px', color: 'var(--ink-2)', margin: '12px 0 4px' } }, 'Calculé pour tes règles : ' + rulesSummary(r)));
    body.append(h('div', { class: 'legend' },
      ...[['H', 'Carte'], ['S', 'Rester'], ['D', 'Doubler'], ['P', 'Séparer'], ['R', 'Abandonner']].map(([k, l]) => h('span', {}, h('i', { class: 'c-' + k }), l))));
    body.append(h('p', { style: { fontSize: '12px', color: 'var(--ink-3)' } }, 'Ds = doubler, sinon rester. Rh / Rs = abandonner, sinon tirer / rester.'));
    let cur = null;
    if (sit) cur = { kind: sit.adv.kind, total: sit.adv.total, up: sit.up, pair: sit.hand.cards.length === 2 && sit.hand.cards[0].value === sit.hand.cards[1].value ? sit.hand.cards[0].value : null };
    const table = (title, rows, kind) => {
      body.append(h('div', { class: 'section-title' }, title));
      const t = h('table', { class: 'chart-table' });
      t.append(h('tr', {}, h('th', {}), ...ups.map((u) => h('th', {}, u))));
      for (const row of rows) {
        const tr = h('tr', {}, h('td', { class: 'lbl-cell' }, row.label));
        row.cells.forEach((code, i) => {
          const upV = i + 2;
          let isCur = false;
          if (cur && cur.up === upV) {
            if (kind === 'pair' && cur.kind === 'pair') isCur = row.label === (cur.pair === 11 ? 'A,A' : cur.pair === 10 ? '10,10' : cur.pair + ',' + cur.pair);
            if (kind === 'soft' && cur.kind === 'soft') isCur = row.label === 'A,' + (cur.total - 11);
            if (kind === 'hard' && cur.kind === 'hard') isCur = row.label === String(cur.total) || (row.label === '17+' && cur.total >= 17) || (row.label === '5' && cur.total <= 5);
          }
          const short = code === 'Ds' ? 'Ds' : code;
          tr.append(h('td', { class: 'c-' + code + (isCur ? ' cur' : '') }, short));
        });
        t.append(tr);
      }
      body.append(t);
    };
    table('Mains dures', c.hard, 'hard');
    table('Mains souples', c.soft, 'soft');
    table('Paires', c.pairs, 'pair');
    if (sit) body.prepend(h('div', { class: 'edge-box', style: { marginTop: '12px' } }, h('div', {}, h('div', { style: { fontSize: '13px', color: 'var(--ink-3)' } }, 'Situation actuelle (encadrée)'), h('div', {}, sit.adv.reason)), h('b', {}, ACTION_LABEL[sit.adv.action])));
    openDrawer('chart', 'Stratégie de base', body);
    const curEl = body.querySelector('td.cur');
    if (curEl) setTimeout(() => curEl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
  }

  // ================================================================= Aide
  help() {
    const keys = [['Espace', 'Distribuer (re-mise automatique si aucune mise)'], ['H', 'Carte'], ['S', 'Rester'], ['D', 'Doubler'], ['P', 'Séparer'], ['R', 'Abandonner (en jeu) / Re-miser (entre les donnes)'], ['A', 'Conseil'], ['O / N', 'Assurance oui / non'], ['X', 'Effacer les mises'], ['C', 'Afficher / masquer le compte'], ['T', 'Tableau de stratégie'], ['E', 'Exercices'], ['1 à 5', 'Vues de caméra'], ['V', 'Caméra qui suit ta main'], ['M', 'Son'], ['F', 'Plein écran'], ['Échap', 'Fermer']];
    const box = h('div', {},
      h('h2', {}, 'Comment jouer'),
      h('p', { class: 'lead' }, 'Le but : battre le croupier en approchant 21 sans le dépasser. Les figures valent 10, l\'as vaut 1 ou 11. Le croupier tire jusqu\'à 17.'),
      h('h3', {}, 'À la table'),
      h('ul', {},
        h('li', {}, 'Clique sur « Moi » au-dessus d\'un cercle pour t\'asseoir. Tu peux jouer jusqu\'à 5 mains en même temps.'),
        h('li', {}, 'Choisis un jeton en bas, clique sur un cercle pour miser (clic droit ou Maj+clic pour retirer).'),
        h('li', {}, 'Le panneau « Mes mains » à droite récapitule chaque main : cartes, total, mise et résultat.'),
        h('li', {}, 'Molette pour zoomer, clic gauche glissé pour tourner, clic droit glissé pour déplacer la vue.')),
      h('h3', {}, 'Les trois niveaux d\'aide'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Avant chaque coup : '), 'le bon choix est surligné et expliqué.'),
        h('li', {}, h('b', {}, 'Correction après : '), 'tu joues seul, Blackjack Play te corrige si tu te trompes.'),
        h('li', {}, h('b', {}, 'Aucune : '), 'comme au casino. Tes erreurs restent enregistrées dans les statistiques.')),
      h('h3', {}, 'Raccourcis clavier'),
      h('div', { class: 'keys' }, ...keys.flatMap(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])),
      h('div', { class: 'coach-actions', style: { marginTop: '18px' } },
        h('button', { class: 'btn', onclick: () => this.credits() }, icon('scroll-text', 16), 'Crédits et licences'),
        h('a', { class: 'btn', href: '../apprendre.html', target: '_blank' }, icon('graduation-cap', 16), 'Guide complet')));
    openModal(box);
  }

  credits() {
    const L = (t, href) => h('a', { href, target: '_blank', rel: 'noopener' }, t);
    const box = h('div', { class: 'credits' },
      h('h2', {}, 'Crédits'),
      h('p', { class: 'lead' }, 'Blackjack Play est un entraîneur gratuit. Jetons fictifs uniquement : aucun argent réel, aucun gain possible.'),
      h('h3', {}, 'Ressources utilisées'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Croupiers 3D : '), 'Microsoft Rocketbox Avatar Library — licence MIT. ', L('github.com/microsoft/Microsoft-Rocketbox', 'https://github.com/microsoft/Microsoft-Rocketbox')),
        h('li', {}, h('b', {}, 'Sons de cartes et de jetons : '), 'Kenney, « Casino Audio » — CC0 (domaine public). ', L('kenney.nl', 'https://kenney.nl/assets/casino-audio')),
        h('li', {}, h('b', {}, 'Matières (bois, cuir, laine, moquette) et éclairage HDRI : '), 'Poly Haven — CC0. ', L('polyhaven.com', 'https://polyhaven.com')),
        h('li', {}, h('b', {}, 'Moteur 3D : '), 'three.js — licence MIT. ', L('threejs.org', 'https://threejs.org')),
        h('li', {}, h('b', {}, 'Polices : '), 'Barlow, Barlow Condensed (Jeremy Tribby) et Source Serif 4 (Adobe) — SIL Open Font License.'),
        h('li', {}, h('b', {}, 'Icônes : '), 'Lucide — licence ISC. ', L('lucide.dev', 'https://lucide.dev')),
        h('li', {}, h('b', {}, 'Cartes, tapis et jetons : '), 'dessinés par le programme (Blackjack Play).'),
        h('li', {}, h('b', {}, 'Stratégie : '), 'stratégie de base calculée selon les règles ; déviations Illustrious 18 et Fab 4 (Don Schlesinger).')),
      h('h3', {}, 'Jeu responsable'),
      h('p', {}, 'Le blackjack réel reste un jeu de hasard où le casino a l\'avantage. Si le jeu d\'argent devient un problème : Joueurs Info Service, 09 74 75 13 13 (appel non surtaxé).'));
    openModal(box);
  }

  // ================================================================= Accueil
  welcome() {
    const a = this.app;
    const choose = (mode, advice) => {
      a.settings.welcomed = true;
      if (a.track) a.track('welcome', advice === 'off' ? 'casino' : mode);
      a.setMode(mode, true);
      if (advice) { a.settings.adviceMode = advice; a.buildTopbar(); }
      a.saveSettings();
      closeModal();
      toast('Clique sur un jeton puis sur ton cercle de mise, et appuie sur Espace');
    };
    const opt = (ico, title, text, fn) => h('button', { class: 'drill-card', onclick: fn, html: icon(ico, 22) + `<div><b>${title}</b><span>${text}</span></div>` });
    const box = h('div', {},
      h('h2', {}, 'Bienvenue à la table'),
      h('p', { class: 'lead' }, 'Blackjack Play est un entraîneur de blackjack. Tout se joue avec des jetons fictifs : rien n\'est réel, rien ne se gagne ni ne se perd. Quel est ton niveau ?'),
      h('div', { class: 'drill-grid' },
        opt('graduation-cap', 'Je débute', 'Le bon coup est surligné et expliqué avant chaque décision.', () => choose('coach', 'before')),
        opt('table-2', 'Je connais les règles', 'Tu joues seul, Blackjack Play te corrige après chaque erreur.', () => choose('libre', 'after')),
        opt('brain', 'Je veux compter les cartes', 'Table pleine de joueurs IA, quiz du compte, mises conseillées.', () => choose('comptage', 'after')),
        opt('flame', 'Comme au casino', 'Aucune aide. Tes erreurs sont tout de même notées dans les statistiques.', () => choose('libre', 'off'))));
    openModal(box, { closable: false });
  }
}
