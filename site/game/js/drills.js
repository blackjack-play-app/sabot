// Exercices plein écran : flash stratégie, décompte d'un paquet, compte réel, déviations, simulateur.
import { makeCard, RANKS, SUITS, countTag, COUNT_SYSTEMS, handTotal } from './cards.js';
import { recommend, ACTION_LABEL, DEVIATIONS } from './strategy.js';
import { rulesSummary, houseEdge } from './rules.js';
import { $, h, fmt, fmtSigned, pct, openModal, closeModal, icon, cardImg, lineChart, toast } from './ui.js';

const rnd = (n) => Math.floor(Math.random() * n);
const randSuit = () => SUITS[rnd(4)];
const cardOfValue = (v) => {
  if (v === 11) return makeCard('A', randSuit());
  if (v === 10) return makeCard(['10', 'J', 'Q', 'K'][rnd(4)], randSuit());
  return makeCard(String(v), randSuit());
};
const randomCard = () => makeCard(RANKS[rnd(13)], randSuit());

export class Drills {
  constructor(app) {
    this.app = app;
    this.el = $('#drill');
    this.keyHandler = null;
    this.timers = [];
  }

  openMenu() {
    const card = (id, ico, title, text) => h('button', { class: 'drill-card', onclick: () => { closeModal(); this.open(id); }, html: icon(ico, 22) + `<div><b>${title}</b><span>${text}</span></div>` });
    const box = h('div', {},
      h('h2', {}, 'Exercices'),
      h('p', { class: 'lead' }, 'Des entraînements courts et ciblés. Les résultats sont enregistrés dans tes statistiques.'),
      h('div', { class: 'drill-grid' },
        card('flash', 'layout-grid', 'Flash stratégie', 'Une main, une carte du croupier : trouve le bon coup le plus vite possible.'),
        card('countdown', 'timer', 'Décompte d\'un paquet', 'Les cartes défilent : garde le compte jusqu\'au bout. Chronométré.'),
        card('truecount', 'gauge', 'Compte réel', 'Convertis le compte courant selon les jeux restants dans la défausse.'),
        card('deviations', 'brain', 'Déviations', 'Illustrious 18 et Fab 4 : quand s\'écarter de la stratégie de base.'),
        card('table', 'table-2', 'Table de comptage', 'Retour à la table : joueurs IA, quiz réguliers du compte, mises conseillées.'),
        card('sim', 'chart-column', 'Simulateur', 'Joue 100 000 mains en quelques secondes et mesure ton avantage réel.')));
    openModal(box);
  }

  open(id) {
    if (id === 'table') { this.app.setMode('comptage'); return; }
    const map = { flash: () => this.flash(), countdown: () => this.countdown(), truecount: () => this.trueCount(), deviations: () => this.flash(true), sim: () => this.sim() };
    if (!map[id]) return;
    this.cleanup();
    this.el.hidden = false;
    this.el.innerHTML = '';
    map[id]();
  }

  close() {
    this.cleanup();
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  cleanup() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
    if (this.worker) { this.worker.terminate(); this.worker = null; }
  }

  frame(title, scoreItems = []) {
    const score = h('div', { class: 'score' });
    const setScore = (items) => {
      score.innerHTML = '';
      for (const [l, v] of items) score.append(h('span', {}, l, h('b', {}, v)));
    };
    setScore(scoreItems);
    const top = h('div', { class: 'drill-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Retour à la table', onclick: () => this.close(), html: icon('chevron-left', 20) }),
      h('h2', {}, title), score);
    const main = h('div', { class: 'drill-main' });
    this.el.append(top, main);
    return { main, setScore };
  }

  keys(fn) {
    this.keyHandler = (e) => {
      if (e.target.matches('input, select')) { if (e.key === 'Escape') this.close(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
      if (fn(e) !== false) { e.stopPropagation(); }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  // ===================================================== Flash stratégie (+ déviations)
  flash(devMode = false) {
    const a = this.app;
    const st = a.stats;
    const r = a.settings.rules;
    const ind = a.settings.style.indices;
    let cat = 'all', timer = 0, n = 0, ok = 0, streak = 0, best = devMode ? (st.drills.deviations.best || 0) : st.drills.flash.best;
    let current = null, answered = false, tStart = 0, tickT = null;
    const { main, setScore } = this.frame(devMode ? 'Déviations au compte' : 'Flash stratégie');
    const upd = () => setScore([['Score', `${ok}/${n}`], ['Série', streak], ['Record', best]]);
    upd();

    const opts = h('div', { class: 'drill-opts' });
    if (!devMode) {
      const segBtns = [['all', 'Toutes'], ['hard', 'Dures'], ['soft', 'Souples'], ['pair', 'Paires']].map(([v, l]) => {
        const b = h('button', { class: 'btn' + (v === cat ? ' primary' : ''), onclick: () => { cat = v; segBtns.forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); next(); } }, l);
        return b;
      });
      opts.append(...segBtns);
    }
    const timerBtns = [[0, 'Sans chrono'], [5, '5 s'], [3, '3 s']].map(([v, l]) => {
      const b = h('button', { class: 'btn ghost' + (v === timer ? ' primary' : ''), onclick: () => { timer = v; timerBtns.forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); next(); } }, l);
      return b;
    });
    opts.append(...timerBtns);

    const tcLine = h('div', { class: 'drill-label' });
    const dealerRow = h('div', { class: 'drill-cards small' });
    const playerRow = h('div', { class: 'drill-cards' });
    const clock = h('div', { class: 'progress', style: { width: '260px' } }, h('i'));
    const feedback = h('div', { class: 'drill-feedback' }, devMode ? 'Le compte réel (Hi-Lo) est affiché : décide si tu dois dévier de la stratégie de base.' : 'Choisis le bon coup (raccourcis H, S, D, P, R).');
    const actions = h('div', { class: 'actions' });
    const actKeys = ['H', 'S', 'D', 'P'].concat(r.surrender !== 'none' ? ['R'] : []);
    for (const k of actKeys) {
      const b = h('button', { class: 'btn act', 'data-act': k, onclick: () => answer(k) }, ACTION_LABEL[k], h('kbd', {}, k));
      actions.append(b);
    }
    const nextBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => next() }, 'Suivante', h('kbd', {}, 'Espace'));
    main.append(opts, tcLine, h('div', { class: 'drill-label' }, 'Croupier'), dealerRow, h('div', { class: 'drill-vs' }, 'contre'), playerRow, h('div', { class: 'drill-label' }, 'Ta main'), clock, actions, nextBtn, feedback);

    const genHand = () => {
      let c1, c2;
      const kind = cat === 'all' ? ['hard', 'hard', 'hard', 'soft', 'pair'][rnd(5)] : cat;
      if (kind === 'pair') { const v = 2 + rnd(10); c1 = cardOfValue(v); c2 = cardOfValue(v); if (v === 10) c2 = makeCard(c1.rank, randSuit()); }
      else if (kind === 'soft') { c1 = makeCard('A', randSuit()); c2 = cardOfValue(2 + rnd(8)); }
      else {
        do { c1 = cardOfValue(2 + rnd(9)); c2 = cardOfValue(2 + rnd(9)); } while (c1.value === c2.value || c1.value + c2.value < 5 || c1.value + c2.value > 19);
        if (rnd(2)) [c1, c2] = [c2, c1];
      }
      return [c1, c2];
    };

    const next = () => {
      clearTimeout(tickT);
      answered = false;
      nextBtn.hidden = true;
      for (const b of actions.children) { b.disabled = false; b.classList.remove('rec'); b.style.borderColor = ''; }
      let cards, up, tc = 0, dev = null;
      if (devMode) {
        const pool = DEVIATIONS.filter((d) => (d.a !== 'R' || r.surrender !== 'none'));
        dev = pool[rnd(pool.length)];
        up = dev.up;
        if (dev.key === 'p10') cards = [makeCard(['10', 'J', 'Q', 'K'][rnd(4)], randSuit()), null];
        const total = dev.key === 'p10' ? 20 : Number(dev.key.slice(1));
        if (dev.key === 'p10') cards[1] = makeCard(cards[0].rank, randSuit());
        else {
          // Deux cartes de valeurs différentes formant ce total dur
          const options = [];
          for (let v1 = 2; v1 <= 10; v1++) { const v2 = total - v1; if (v2 >= 2 && v2 <= 10 && v1 !== v2 && v1 < v2) options.push([v1, v2]); }
          const [v1, v2] = options[rnd(options.length)];
          cards = [cardOfValue(v1), cardOfValue(v2)];
        }
        tc = dev.tc + (rnd(7) - 3);
        tcLine.innerHTML = `Compte réel Hi-Lo : <b style="color:var(--gold-2);font-size:22px">${tc > 0 ? '+' : ''}${tc}</b>`;
      } else {
        cards = genHand();
        up = 2 + rnd(10);
        tcLine.textContent = rulesSummary(r);
      }
      const upCard = cardOfValue(up);
      current = { cards, up, tc, dev };
      current.adv = recommend(cards, up, r, { canDouble: r.doubleOn === 'any' || (handTotal(cards).total >= (r.doubleOn === '9-11' ? 9 : 10) && handTotal(cards).total <= 11 && !handTotal(cards).soft), canSplit: true, canSurrender: r.surrender !== 'none', tc, deviations: devMode });
      dealerRow.innerHTML = ''; dealerRow.append(cardImg(upCard, ind, 0.5));
      playerRow.innerHTML = ''; playerRow.append(...cards.map((c) => cardImg(c, ind, 0.5)));
      feedback.innerHTML = '&nbsp;';
      tStart = performance.now();
      const bar = clock.firstChild;
      clock.style.visibility = timer ? 'visible' : 'hidden';
      if (timer) {
        const tick = () => {
          const k = (performance.now() - tStart) / (timer * 1000);
          bar.style.width = Math.min(100, k * 100) + '%';
          bar.style.background = k > 0.75 ? 'var(--red)' : 'var(--gold)';
          if (k >= 1 && !answered) { answer(null); return; }
          if (!answered) tickT = setTimeout(tick, 50);
        };
        tick();
      }
    };

    const answer = (k) => {
      if (answered || !current) return;
      if (k && !actKeys.includes(k)) return;
      answered = true;
      clearTimeout(tickT);
      const right = current.adv.action;
      const good = k === right;
      n++;
      if (good) { ok++; streak++; best = Math.max(best, streak); this.app.audio.play('good', 0.6); }
      else { streak = 0; this.app.audio.play('bad', 0.7); }
      const bucket = devMode ? st.drills.deviations : st.drills.flash;
      bucket.n = (bucket.n || 0) + 1; if (good) bucket.ok = (bucket.ok || 0) + 1;
      bucket.best = Math.max(bucket.best || 0, best);
      this.app.saveStats();
      upd();
      for (const b of actions.children) {
        b.disabled = true;
        if (b.dataset.act === right) b.classList.add('rec');
        if (b.dataset.act === k && !good) b.style.borderColor = 'var(--red)';
      }
      const ms = Math.round(performance.now() - tStart);
      feedback.innerHTML = (good ? `<b class="ok">Juste</b> en ${(ms / 1000).toFixed(1)} s. ` : `<b class="ko">${k ? 'Faux' : 'Temps écoulé'}</b> — il fallait <b>${ACTION_LABEL[right]}</b>. `) + current.adv.reason;
      if (good && !devMode) this.timers.push(setTimeout(next, 900));
      else nextBtn.hidden = false;
    };

    this.keys((e) => {
      const k = e.key.toUpperCase();
      if (['H', 'S', 'D', 'P', 'R'].includes(k)) { e.preventDefault(); answer(k); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (answered) next(); }
      else return false;
    });
    next();
  }

  // ===================================================== Décompte d'un paquet
  countdown() {
    const a = this.app;
    const sysKey = a.settings.countSystem;
    const sys = COUNT_SYSTEMS[sysKey];
    const ind = a.settings.style.indices;
    let speed = 600, perFlash = 1, size = 52;
    const { main, setScore } = this.frame('Décompte d\'un paquet');
    const hist = a.stats.drills.countdown;
    const bestOk = hist.filter((x) => x.ok).sort((x, y) => x.ms - y.ms)[0];
    setScore([['Système', sys.name], ['Meilleur temps', bestOk ? (bestOk.ms / 1000).toFixed(1) + ' s' : '—']]);
    const mk = (label, values, get, set) => {
      const wrap = h('div', { class: 'drill-opts' }, h('span', { class: 'drill-label', style: { alignSelf: 'center', marginRight: '6px' } }, label));
      const btns = values.map(([v, l]) => {
        const b = h('button', { class: 'btn ghost' + (get() === v ? ' primary' : ''), onclick: () => { set(v); btns.forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); } }, l);
        return b;
      });
      wrap.append(...btns);
      return wrap;
    };
    const setup = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' } },
      mk('Vitesse', [[1000, 'Lente'], [600, 'Moyenne'], [380, 'Rapide'], [220, 'Pro']], () => speed, (v) => { speed = v; }),
      mk('Cartes', [[1, 'Une par une'], [2, 'Par deux']], () => perFlash, (v) => { perFlash = v; }),
      mk('Quantité', [[26, 'Demi-paquet'], [52, 'Paquet entier']], () => size, (v) => { size = v; }));
    const stage = h('div', { class: 'drill-cards' });
    const info = h('div', { class: 'drill-feedback' }, `Compte avec ${sys.name}. Quelques cartes sont retirées au hasard au début : le compte final n'est donc pas forcément nul.`);
    const startBtn = h('button', { class: 'btn primary deal', onclick: () => run() }, 'Commencer', h('kbd', {}, 'Espace'));
    main.append(setup, stage, startBtn, info);
    let running = false;

    const run = () => {
      if (running) return;
      running = true;
      setup.hidden = true; startBtn.hidden = true;
      const deck = [];
      for (const s of SUITS) for (const r of RANKS) deck.push(makeCard(r, s));
      for (let i = deck.length - 1; i > 0; i--) { const j = rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      const removed = 1 + rnd(3);
      const shown = deck.slice(removed, removed + Math.min(size, 52 - removed));
      let truth = 0;
      for (const c of shown) truth += countTag(sysKey, c);
      let i = 0;
      const t0 = performance.now();
      info.textContent = `Carte 0 / ${shown.length}`;
      const step = () => {
        if (i >= shown.length) { finish(); return; }
        stage.innerHTML = '';
        const group = shown.slice(i, i + perFlash);
        for (const c of group) { const img = cardImg(c, ind, 0.6); img.className = 'flash-card'; stage.append(img); }
        i += group.length;
        info.textContent = `Carte ${i} / ${shown.length}`;
        a.audio.play('slide', 0.25);
        this.timers.push(setTimeout(step, speed));
      };
      const finish = () => {
        const ms = performance.now() - t0;
        stage.innerHTML = '';
        const input = h('input', { type: 'number', step: sys.tags[5] === 1.5 ? '0.5' : '1', value: '0', 'aria-label': 'Compte final', style: { width: '120px', height: '56px', textAlign: 'center', fontFamily: 'var(--cond)', fontSize: '32px', fontWeight: '700', background: '#221c16', border: '1px solid var(--line)', borderRadius: '10px', color: 'var(--ink)' } });
        const go = h('button', { class: 'btn primary' }, 'Valider');
        const done = () => {
          const v = Number(input.value || 0);
          const good = Math.abs(v - truth) < 1e-9;
          a.stats.drills.countdown.push({ t: Date.now(), ms: Math.round(ms), ok: good, n: shown.length, speed, sys: sysKey });
          a.saveStats();
          a.audio.play(good ? 'good' : 'bad');
          stage.innerHTML = '';
          info.innerHTML = (good ? `<b class="ok">Exact !</b>` : `<b class="ko">Raté</b> — le compte était <b>${fmtSigned(truth) || 0}</b>, tu as dit ${fmtSigned(v) || 0}.`) + ` ${shown.length} cartes en ${(ms / 1000).toFixed(1)} s.`;
          setup.hidden = false; startBtn.hidden = false; startBtn.firstChild.textContent = 'Recommencer';
          running = false;
        };
        go.addEventListener('click', done);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } });
        stage.append(h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' } }, h('div', { class: 'drill-label' }, 'Compte final ?'), input, go));
        info.textContent = `${shown.length} cartes en ${(ms / 1000).toFixed(1)} s`;
        setTimeout(() => { input.focus(); input.select(); }, 30);
      };
      step();
    };
    this.keys((e) => { if ((e.key === ' ' || e.key === 'Enter') && !running) { e.preventDefault(); run(); } else return false; });
  }

  // ===================================================== Compte réel
  trueCount() {
    const a = this.app;
    const st = a.stats.drills.tc;
    let n = 0, ok = 0;
    const { main, setScore } = this.frame('Compte réel');
    const upd = () => setScore([['Score', `${ok}/${n}`], ['Total', `${st.ok || 0}/${st.n || 0}`]]);
    upd();
    const rcLine = h('div', { style: { fontFamily: 'var(--cond)', fontSize: '22px', color: 'var(--ink-2)', textAlign: 'center' } });
    const trayWrap = h('div', { style: { display: 'flex', gap: '50px', alignItems: 'flex-end' } });
    const input = h('input', { type: 'number', step: '1', 'aria-label': 'Compte réel', style: { width: '120px', height: '56px', textAlign: 'center', fontFamily: 'var(--cond)', fontSize: '32px', fontWeight: '700', background: '#221c16', border: '1px solid var(--line)', borderRadius: '10px', color: 'var(--ink)' } });
    const go = h('button', { class: 'btn primary' }, 'Valider');
    const feedback = h('div', { class: 'drill-feedback' }, 'Compte réel = compte courant ÷ jeux restants (arrondi à l\'entier inférieur). Estime les jeux restants en regardant la défausse.');
    main.append(rcLine, trayWrap, h('div', { class: 'drill-label' }, 'Compte réel ?'), h('div', { style: { display: 'flex', gap: '8px' } }, input, go), feedback);
    let cur = null, answered = false;
    const next = () => {
      answered = false;
      const decks = [6, 8, 6, 2][rnd(4)];
      const discardedHalf = 1 + rnd(decks * 2 - 2); // en demi-jeux
      const remaining = decks - discardedHalf / 2;
      const rc = Math.round((rnd(21) - 7) * (0.6 + Math.random() * 1.2) * (remaining / 2 + 1) / 2);
      const tc = Math.trunc(rc / remaining);
      cur = { decks, remaining, rc, tc };
      rcLine.innerHTML = `Sabot de <b style="color:var(--ink)">${decks} jeux</b> · Compte courant <b style="color:var(--gold-2);font-size:30px">${rc > 0 ? '+' : ''}${rc}</b>`;
      const fill = (discardedHalf / 2) / decks;
      trayWrap.innerHTML = '';
      const scale = h('div', { class: 'tray-scale' });
      for (let d = 0; d <= decks; d += decks > 4 ? 2 : 1) scale.append(h('span', {}, d));
      trayWrap.append(h('div', { style: { textAlign: 'center' } }, h('div', { class: 'tray-vis' }, h('i', { style: { height: `calc(${fill * 100}% - 4px)` } }), scale), h('div', { class: 'drill-label', style: { marginTop: '6px' } }, 'Défausse')));
      input.value = ''; input.disabled = false; go.textContent = 'Valider';
      feedback.innerHTML = '&nbsp;';
      setTimeout(() => input.focus(), 20);
    };
    const submit = () => {
      if (answered) { next(); return; }
      if (input.value === '') return;
      answered = true;
      const v = Number(input.value);
      const good = v === cur.tc || Math.abs(v - cur.rc / cur.remaining) <= 0.5;
      n++; st.n = (st.n || 0) + 1;
      if (good) { ok++; st.ok = (st.ok || 0) + 1; }
      a.saveStats(); upd();
      a.audio.play(good ? 'good' : 'bad');
      feedback.innerHTML = `${good ? '<b class="ok">Juste</b>' : '<b class="ko">Faux</b>'} — ${cur.remaining} jeux restants : ${fmtSigned(cur.rc) || 0} ÷ ${cur.remaining} = ${(cur.rc / cur.remaining).toFixed(2)}, soit un compte réel de <b>${cur.tc > 0 ? '+' : ''}${cur.tc}</b>.`;
      input.disabled = true; go.textContent = 'Suivant';
      go.focus();
    };
    go.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } });
    this.keys((e) => { if (e.key === 'Enter' && answered) { e.preventDefault(); next(); } else return false; });
    next();
  }

  // ===================================================== Simulateur
  sim() {
    const a = this.app;
    const r = a.settings.rules;
    const { main, setScore } = this.frame('Simulateur');
    setScore([['Règles', rulesSummary(r)]]);
    const form = h('div', { class: 'sim-form' });
    const inp = (label, el) => { form.append(h('label', {}, label, el)); return el; };
    const roundsSel = inp('Nombre de donnes', h('select', {}, ...[[20000, '20 000'], [100000, '100 000'], [300000, '300 000'], [1000000, '1 000 000']].map(([v, l]) => h('option', { value: v, selected: v === 100000 }, l))));
    const stratSel = inp('Stratégie', h('select', {}, h('option', { value: 'basic' }, 'Stratégie de base (mise fixe)'), h('option', { value: 'count' }, 'Comptage Hi-Lo + écart de mise'), h('option', { value: 'countdev' }, 'Comptage + déviations')));
    const spreadSel = inp('Écart de mise (compteur)', h('select', {}, h('option', { value: '1-4' }, '1 à 4 unités'), h('option', { value: '1-8', selected: true }, '1 à 8 unités'), h('option', { value: '1-12' }, '1 à 12 unités'), h('option', { value: '1-16' }, '1 à 16 unités')));
    const spotsSel = inp('Mains par donne', h('select', {}, ...[1, 2, 3].map((v) => h('option', { value: v }, String(v)))));
    const unitIn = inp('Unité de mise', h('input', { type: 'number', value: a.settings.unit, min: 1 }));
    const bankIn = inp('Réserve de départ', h('input', { type: 'number', value: 10000, min: 100 }));
    const runBtn = h('button', { class: 'btn primary deal' }, icon('play', 18), 'Lancer la simulation');
    const progress = h('div', { class: 'progress' }, h('i'));
    const out = h('div', { class: 'sim-out' });
    main.style.justifyContent = 'flex-start';
    main.append(h('p', { class: 'drill-feedback', style: { minHeight: 0 } }, `Avantage théorique du casino avec ces règles : ${houseEdge(r).toFixed(2)} %. Le simulateur joue des centaines de milliers de donnes en stratégie parfaite pour le vérifier.`), form, runBtn, progress, out);

    const spreads = {
      '1-4': [{ tc: -99, units: 1 }, { tc: 2, units: 2 }, { tc: 3, units: 3 }, { tc: 4, units: 4 }],
      '1-8': [{ tc: -99, units: 1 }, { tc: 1, units: 2 }, { tc: 2, units: 4 }, { tc: 3, units: 6 }, { tc: 4, units: 8 }],
      '1-12': [{ tc: -99, units: 1 }, { tc: 1, units: 2 }, { tc: 2, units: 4 }, { tc: 3, units: 8 }, { tc: 4, units: 12 }],
      '1-16': [{ tc: -99, units: 1 }, { tc: 1, units: 2 }, { tc: 2, units: 6 }, { tc: 3, units: 10 }, { tc: 4, units: 16 }],
    };
    runBtn.addEventListener('click', () => {
      if (this.worker) this.worker.terminate();
      const strat = stratSel.value;
      const cfg = {
        rules: r, rounds: Number(roundsSel.value), spots: Number(spotsSel.value), unit: Math.max(1, Number(unitIn.value) || 10),
        bankroll: Math.max(100, Number(bankIn.value) || 10000), deviations: strat === 'countdev',
        spread: strat === 'basic' ? [{ tc: -99, units: 1 }] : spreads[spreadSel.value], seed: (Math.random() * 2 ** 31) | 0,
      };
      runBtn.disabled = true;
      out.innerHTML = '';
      const t0 = performance.now();
      const done = (res) => {
        runBtn.disabled = false;
        progress.firstChild.style.width = '100%';
        this.renderSim(out, res, cfg, performance.now() - t0);
        this.app.stats.simRuns = (this.app.stats.simRuns || 0) + 1;
        this.app.saveStats();
      };
      try {
        this.worker = new Worker(new URL('./simworker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
          if (e.data.progress !== undefined) progress.firstChild.style.width = Math.round(e.data.progress * 100) + '%';
          if (e.data.result) { done(e.data.result); this.worker.terminate(); this.worker = null; }
          if (e.data.error) { toast('Erreur : ' + e.data.error, 'bad'); runBtn.disabled = false; }
        };
        this.worker.postMessage(cfg);
      } catch (err) {
        // Repli sans worker
        import('./sim.js').then(({ runSimulation }) => runSimulation(cfg, async (p) => { progress.firstChild.style.width = p * 100 + '%'; await new Promise((r2) => setTimeout(r2)); }).then(done));
      }
    });
  }

  renderSim(out, res, cfg, ms) {
    const kpi = (l, v, cls = '') => h('div', { class: 'kpi' }, h('span', {}, l), h('b', { class: cls }, v));
    const edge = res.edgePct;
    const se = (res.sdPerRound / (cfg.unit) / Math.sqrt(res.rounds)) * 100;
    out.append(h('div', { class: 'kpis', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } },
      kpi('Avantage du joueur', `${edge >= 0 ? '+' : ''}${edge.toFixed(2)} %`, edge >= 0 ? 'pos' : 'neg'),
      kpi('Marge d\'erreur', `± ${(se * 1.96).toFixed(2)} %`),
      kpi('Gain moyen / donne', (res.evPerRound >= 0 ? '+' : '−') + Math.abs(res.evPerRound).toFixed(2), res.evPerRound >= 0 ? 'pos' : 'neg'),
      kpi('Écart-type / donne', fmt(res.sdPerRound)),
      kpi('Gain / heure (100 donnes)', fmtSigned(Math.round(res.hourly)) || '0', res.hourly >= 0 ? 'pos' : 'neg'),
      kpi('Risque de ruine', res.ror >= 1 ? '100 %' : (res.ror * 100).toFixed(1) + ' %', res.ror > 0.2 ? 'neg' : ''),
      kpi('Résultat total', fmtSigned(Math.round(res.net)) || '0', res.net >= 0 ? 'pos' : 'neg'),
      kpi('Réserve minimum', fmt(res.minBank)),
      kpi('Mains', fmt(res.handsPlayed))));
    const cv = h('canvas');
    out.append(h('div', { class: 'section-title' }, 'Évolution de la réserve'), h('div', { class: 'chart-wrap' }, cv));
    const t = res.handsPlayed;
    const R = res.results;
    out.append(h('p', { class: 'drill-feedback', style: { minHeight: 0, maxWidth: 'none', textAlign: 'left' } },
      `Gagnées ${pct(R.win + R.blackjack, t)} % · perdues ${pct(R.lose + R.bust + R.surrender, t)} % · égalités ${pct(R.push, t)} % · blackjacks ${pct(R.blackjack, t)} % · sautées ${pct(R.bust, t)} %. ` +
      `Calculé en ${(ms / 1000).toFixed(1)} s.` + (res.ruined ? ` La réserve a été épuisée à la donne ${fmt(res.ruinRound)}.` : '')));
    requestAnimationFrame(() => lineChart(cv, res.curve, { zero: cfg.bankroll }));
  }
}
