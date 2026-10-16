// Blackjack Play — contrôleur principal : relie moteur, scène 3D, son, aide, statistiques et interface.
import * as THREE from 'three';
import { TableScene, CAMERA_PRESETS, TABLE_Y } from './scene.js';
import { BlackjackEngine } from './engine.js';
import { AudioManager } from './audio.js';
import { ACTION_LABEL, shouldInsure, INSURANCE_TC } from './strategy.js';
import { COUNT_SYSTEMS, handTotal } from './cards.js';
import { CHIP_DENOMS } from './textures.js';
import * as store from './store.js';
import { QUALITY, detectQuality, FpsWatch } from './quality.js';
import { REAL_SKINS } from './dealer3d.js';
import {
  $, $$, h, fmt, fmtSigned, toast, openModal, closeModal, modalOpen, openDrawer, closeDrawer, drawerIs,
  iconBtn, icon, cardImg, chipUrl, clearCardImgCache,
} from './ui.js';
import { Panels } from './panels.js';
import { Drills } from './drills.js';
import { checkAchievements } from './achievements.js';
import { setDeckColors } from './textures.js';

// ------------------------------------------------------------------ État
const settings = store.loadSettings();
let stats = store.loadStats();
let bank = store.load(store.KEYS.bank, null);
if (typeof bank !== 'number' || !isFinite(bank)) bank = settings.startBank;

const S = {
  phase: 'loading',          // loading | betting | playing | settling
  bets: [0, 0, 0, 0, 0],
  lastBets: null,
  chip: 25,
  activeHand: null,
  resolveAction: null,
  resolveIns: null,
  roundsSinceQuiz: 0,
  session: { start: Date.now(), rounds: 0, net: 0 },
  roundResults: false,
  aidedThisHand: false,
};

const SPEEDS = { lent: 1.5, normal: 1, rapide: 0.55, eclair: 0.18 };
const TOUCH = matchMedia('(pointer: coarse)').matches;
if (settings.fixedView === undefined) settings.fixedView = TOUCH;
export const MODES = {
  libre: { label: 'Partie libre', desc: 'Joue librement, corrigé après coup.' },
  coach: { label: 'Coach', desc: 'Le conseil s\'affiche avant chaque décision.' },
  comptage: { label: 'Comptage', desc: 'Table pleine, quiz du compte, mises conseillées.' },
};

// ------------------------------------------------------------------ Qualité graphique
function currentQualityKey() {
  return settings.quality === 'auto' || !QUALITY[settings.quality] ? (settings.autoQuality || detectQuality()) : settings.quality;
}
if (settings.quality === 'auto' && !settings.autoQuality) settings.autoQuality = detectQuality();
const qProfile = QUALITY[currentQualityKey()];

// ------------------------------------------------------------------ Scène, moteur, son
const loaderBar = $('#loaderBar'), loaderText = $('#loaderText');
const setLoad = (p, t) => { loaderBar.style.width = Math.round(p * 100) + '%'; if (t) loaderText.textContent = t; };
setLoad(0.15, 'Construction de la salle…');

let scene;
try {
  scene = new TableScene($('#stage'), { texRes: qProfile.dealer === 'hd' ? '2k' : '1k', skin: REAL_SKINS[settings.style.skin] ? settings.style.skin : 'gilet' });
} catch (e) {
  $('#loader').innerHTML = '<div class="loader-card"><div class="loader-title">Blackjack Play</div><p>Ton navigateur ne peut pas afficher la 3D (WebGL indisponible). Active l\'accélération matérielle dans les paramètres du navigateur, ou essaie Chrome, Edge ou Firefox à jour.</p></div>';
  throw e;
}
scene.style.indices = settings.style.indices;
scene.style.back = settings.style.back;
scene.style.felt = settings.style.felt;
setDeckColors(settings.style.fourColor ? 4 : 2);
scene.speed = SPEEDS[settings.speed] ?? 1;
scene.applyQuality(qProfile);
scene.applyStyle(settings.rules);

const audio = new AudioManager('sfx/');
audio.configure(settings.audio);
audio.setDealerGender(!!REAL_SKINS[scene.style.skin]?.female);
audio.onSpeak = (ms) => scene.dealer.speak(ms);
scene.onSound = (k) => {
  if (k === 'slide') audio.play('slide', 0.7);
  else if (k === 'place') audio.play('place', 0.5);
  else if (k === 'flip') audio.play('flip', 0.6);
  else if (k === 'sweep') audio.play('sweep', 0.6);
  else if (k === 'shuffle') audio.play('shuffle', 0.8);
};
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
window.addEventListener('keydown', unlockAudio, { once: false });

let engine;
const io = buildIO();
engine = new BlackjackEngine(settings.rules, io, { countSystem: settings.countSystem });
scene.setShoeLevel(engine.shoe.remaining, engine.shoe.total);

const fps = new FpsWatch((f) => {
  if (settings.quality !== 'auto') return;
  const order = ['ultra', 'haute', 'moyenne', 'basse'];
  const i = order.indexOf(settings.autoQuality);
  if (i < order.length - 1) {
    settings.autoQuality = order[i + 1];
    saveSettings();
    scene.applyQuality(QUALITY[settings.autoQuality]);
    toast(`Qualité graphique ajustée (${QUALITY[settings.autoQuality].label}) pour garder le jeu fluide`);
  }
});

// ------------------------------------------------------------------ Compteurs anonymes (totaux par jour, aucune donnée personnelle)
const TRACK_SRC = window.sabotDesktop ? 'desktop' : (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ? 'pwa' : 'web');
const TRACK_URL = window.sabotDesktop ? 'https://blackjack-play.app/api/e' : '/api/e';
// Appareils du créateur (?notrack=1, tableau de bord ou Ctrl+Alt+Maj+T) et navigateurs pilotés par un robot : rien n'est compté
const noTrack = () => { try { return navigator.webdriver || localStorage.getItem('bp.notrack') === '1'; } catch { return !!navigator.webdriver; } };
try {
  const nt = new URLSearchParams(location.search).get('notrack');
  if (nt === '1') localStorage.setItem('bp.notrack', '1');
  if (nt === '0') localStorage.removeItem('bp.notrack');
} catch { /* stockage indisponible */ }
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyT')) return;
  try {
    if (noTrack()) localStorage.removeItem('bp.notrack'); else localStorage.setItem('bp.notrack', '1');
    toast(noTrack() ? 'Mode test : tes parties ne sont plus comptées' : 'Mode test désactivé : tes parties sont comptées');
  } catch { /* stockage indisponible */ }
});
const TRACK_ON = window.sabotDesktop || /(^|\.)blackjack-play\.app$|pages\.dev$/.test(location.hostname);
let trackQueue = [];
function track(e, p, n = 1) {
  if (!TRACK_ON || noTrack()) return;
  const same = trackQueue.find((x) => x.e === e && x.p === p);
  if (same) same.n += n; else trackQueue.push({ e, p: String(p), n });
  clearTimeout(track.t);
  track.t = setTimeout(flushTrack, 15000);
}
function flushTrack() {
  if (!trackQueue.length) return;
  const body = JSON.stringify({ src: TRACK_SRC, events: trackQueue.splice(0, 20) });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'text/plain' }));
    else fetch(TRACK_URL, { method: 'POST', body, keepalive: true });
  } catch { /* hors ligne : tant pis */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushTrack(); });

// ------------------------------------------------------------------ Utilitaires
function saveSettings() { store.save(store.KEYS.settings, settings); }
function saveBank() { store.save(store.KEYS.bank, Math.round(bank * 100) / 100); }
function saveStats(ctx) {
  for (const a of checkAchievements(stats, ctx)) {
    toast(`Succès débloqué : ${a.title} — ${a.desc}`, 'good', 4200);
    audio.play('win', 0.6);
  }
  store.saveStats(stats);
}
const wait = (s) => scene.wait(s);
const seatHands = (seat) => engine.hands.filter((x) => x.seat === seat);
const nInSeat = (seat) => Math.max(1, seatHands(seat).length);
const playerHands = () => engine.hands.filter((x) => x.owner === 'player');
const upValueLabel = (c) => (c.rank === 'A' ? 'as' : c.value === 10 ? '10' : String(c.value));
const unitsFor = (tc) => (tc < 1 ? 1 : tc < 2 ? 2 : tc < 3 ? 4 : tc < 4 ? 6 : 8);

let bankShown = bank;
function setBank(v, animate = true) {
  const delta = v - bank;
  bank = Math.max(0, Math.round(v * 100) / 100);
  saveBank();
  const el = $('#bank');
  if (!animate) { bankShown = bank; el.textContent = fmt(bank); return; }
  const from = bankShown, to = bank, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 500);
    bankShown = from + (to - from) * (1 - Math.pow(1 - k, 3));
    el.textContent = fmt(bankShown);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return delta;
}
function flashDelta(d) {
  if (!d) return;
  const el = $('#bankDelta');
  el.textContent = fmtSigned(d);
  el.className = 'bank-delta show ' + (d > 0 ? 'pos' : 'neg');
  clearTimeout(flashDelta.t);
  flashDelta.t = setTimeout(() => { el.className = 'bank-delta'; }, 1800);
}

// ------------------------------------------------------------------ Barre du haut
function buildTopbar() {
  const modes = $('#modes');
  modes.innerHTML = '';
  for (const [k, m] of Object.entries(MODES)) {
    modes.append(h('button', { 'aria-pressed': String(settings.mode === k), title: m.desc, onclick: () => setMode(k) }, m.label));
  }
  const tools = $('#tools');
  tools.innerHTML = '';
  const advSel = h('select', { 'aria-label': 'Niveau d\'aide' },
    h('option', { value: 'before' }, 'Avant chaque coup'),
    h('option', { value: 'after' }, 'Correction après'),
    h('option', { value: 'off' }, 'Aucune'));
  advSel.value = settings.adviceMode;
  advSel.addEventListener('change', () => { settings.adviceMode = advSel.value; saveSettings(); refreshAdvice(); toast('Aide : ' + advSel.options[advSel.selectedIndex].text); });
  tools.append(h('label', { class: 'select-pill', title: 'Niveau d\'aide' }, 'Aide', advSel));
  tools.append(
    iconBtn(settings.showCount ? 'eye' : 'eye-off', 'Afficher le compte (C)', toggleCount, 'optional'),
    iconBtn('layout-grid', 'Tableau de stratégie (T)', () => togglePanel('chart')),
    iconBtn('target', 'Exercices (E)', () => drills.openMenu()),
    iconBtn('chart-column', 'Statistiques (S)', () => togglePanel('stats')),
    iconBtn('sliders-horizontal', 'Réglages (P)', () => togglePanel('settings')),
    iconBtn(settings.audio.muted ? 'volume-x' : 'volume-2', 'Son (M)', toggleMute),
    iconBtn(settings.fixedView ? 'lock' : 'lock-open', settings.fixedView ? 'Vue fixe activée (B)' : 'Vue libre (B)', toggleFixed),
    iconBtn('maximize', 'Plein écran (F)', toggleFullscreen),
    iconBtn('circle-help', 'Aide et raccourcis (?)', () => panels.help()),
  );
  $('#tools [aria-label="Afficher le compte (C)"]').setAttribute('aria-pressed', String(settings.showCount));
}

function setMode(k, silent = false) {
  settings.mode = k;
  if (k === 'libre') { settings.adviceMode = 'after'; settings.quizAtShuffle = false; settings.showSpread = false; }
  if (k === 'coach') { settings.adviceMode = 'before'; settings.confirmMistakes = true; settings.quizAtShuffle = false; }
  if (k === 'comptage') {
    settings.adviceMode = 'after';
    settings.quizAtShuffle = true;
    if (!settings.quizEvery) settings.quizEvery = 6;
    settings.showSpread = true;
    if (!settings.seats.includes('bot')) settings.seats = settings.seats.map((s) => s || 'bot');
  }
  if (k !== 'comptage' && settings.seats.includes('bot') && !silent) {
    // On garde la table telle quelle : le joueur peut retirer les joueurs IA s'il le souhaite.
  }
  saveSettings();
  buildTopbar();
  refreshSeats();
  refreshAdvice();
  updateCount();
  if (!silent) toast(MODES[k].label + ' — ' + MODES[k].desc);
}

function toggleCount() {
  settings.showCount = !settings.showCount;
  saveSettings();
  buildTopbar();
  updateCount();
}
function toggleMute() {
  settings.audio.muted = !settings.audio.muted;
  audio.configure(settings.audio);
  if (settings.audio.muted) audio.stopVoice();
  saveSettings();
  buildTopbar();
}
function toggleFixed() {
  settings.fixedView = !settings.fixedView;
  saveSettings();
  scene.setFixed(settings.fixedView);
  if (!settings.fixedView) scene.setView('joueur');
  buildTopbar();
  toast(settings.fixedView ? 'Vue fixe : la caméra ne bouge plus, toute la table est visible' : 'Vue libre : glisse pour tourner, pince ou molette pour zoomer');
}
function toggleFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (document.fullscreenElement || document.webkitFullscreenElement) { exit?.call(document); return; }
  if (req && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* non pris en charge */ } }).catch(() => fullscreenHelp());
  } else fullscreenHelp();
}
function fullscreenHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openModal(h('div', {},
    h('h2', {}, 'Plein écran'),
    ios ? h('p', { class: 'lead' }, 'Sur iPhone, Safari ne permet pas le plein écran pour les jeux. L\'astuce : ajoute Blackjack Play à ton écran d\'accueil, il s\'ouvrira alors en plein écran comme une vraie application.')
      : h('p', { class: 'lead' }, 'Ton navigateur ne permet pas le plein écran ici. Ajoute Blackjack Play à ton écran d\'accueil depuis le menu du navigateur (« Installer l\'application »).'),
    ios ? h('ol', {}, h('li', {}, 'Touche le bouton Partager (le carré avec une flèche vers le haut).'), h('li', {}, 'Choisis « Sur l\'écran d\'accueil ».'), h('li', {}, 'Lance le jeu depuis la nouvelle icône.')) : null,
    h('div', { class: 'coach-actions' }, h('button', { class: 'btn primary', onclick: () => closeModal() }, 'Compris'))));
}
function togglePanel(kind) {
  if (drawerIs(kind)) { closeDrawer(); return; }
  if (kind === 'settings') panels.settings();
  if (kind === 'stats') panels.stats();
  if (kind === 'chart') panels.chart(currentSituation());
}

// ------------------------------------------------------------------ Caméra
function buildCamCtl() {
  const c = $('#camCtl');
  c.innerHTML = '';
  const unfix = () => { if (settings.fixedView) { settings.fixedView = false; scene.setFixed(false, false); saveSettings(); buildTopbar(); } };
  const view = (v) => () => { unfix(); scene.setView(v); };
  const zoom = (f) => {
    unfix();
    scene.idleOrbit = false;
    const t = scene.controls.target, p = scene.camera.position;
    const d = p.clone().sub(t).multiplyScalar(f);
    const len = THREE.MathUtils.clamp(d.length(), scene.controls.minDistance, scene.controls.maxDistance);
    p.copy(t).add(d.setLength(len));
  };
  c.append(
    iconBtn('zoom-in', 'Zoomer (molette)', () => zoom(0.8)),
    iconBtn('zoom-out', 'Dézoomer', () => zoom(1.25)),
    h('div', { class: 'sep' }),
    iconBtn('user', 'Vue joueur (1)', view('joueur')),
    iconBtn('layout-grid', 'Vue du dessus (2)', view('plongee')),
    iconBtn('hand', 'Vue croupier (3)', view('croupier')),
    iconBtn('layers', 'Première base (4)', view('premiere')),
    iconBtn('camera', 'Cinéma (5)', view('cinema')),
  );
  const follow = iconBtn('target', 'Suivre la main active (V)', () => {
    settings.followCam = !settings.followCam;
    follow.setAttribute('aria-pressed', String(!!settings.followCam));
    saveSettings();
    toast(settings.followCam ? 'La caméra suit la main en cours' : 'Caméra libre');
    if (!settings.followCam) scene.setView('joueur');
  });
  follow.setAttribute('aria-pressed', String(!!settings.followCam));
  c.append(h('div', { class: 'sep' }), follow);
}

function focusHand(hand) {
  if (!settings.followCam || !hand || settings.fixedView) return;
  const f = scene.handFrame(hand.seat, hand.splitIndex, nInSeat(hand.seat));
  const target = f.base.clone().add(f.toCenter.clone().multiplyScalar(0.05));
  const pos = f.base.clone().add(f.radial.clone().multiplyScalar(0.75)).setY(TABLE_Y + 0.55);
  const fromP = scene.camera.position.clone(), fromT = scene.controls.target.clone();
  const sp = scene.speed; scene.speed = 1;
  scene.tween(0.6, (k) => { scene.camera.position.lerpVectors(fromP, pos, k); scene.controls.target.lerpVectors(fromT, target, k); });
  scene.speed = sp;
}

// ------------------------------------------------------------------ Jetons & mises
function buildChips() {
  const wrap = $('#chips');
  wrap.innerHTML = '';
  for (const d of CHIP_DENOMS) {
    const b = h('button', { class: 'chip', 'aria-label': `Jeton de ${d.v}`, 'aria-pressed': String(S.chip === d.v), style: { backgroundImage: `url(${chipUrl(d.v)})` } });
    b.addEventListener('click', () => {
      S.chip = d.v;
      if (TOUCH && S.phase === 'betting') {
        const seat = currentBetSeat();
        if (seat >= 0) { placeChip(seat, 'add'); buildChips(); return; }
      }
      audio.play('chip', 0.5);
      buildChips();
    });
    wrap.append(b);
  }
  $('#btnClear').innerHTML = icon('trash-2', 17) + 'Effacer';
  $('#btnRebet').innerHTML = icon('repeat', 17) + 'Re-miser';
  $('#btnDoubleBets').innerHTML = '×2';
  updateBetButtons();
}

function totalBets() { return S.bets.reduce((a, b) => a + b, 0); }

// Place qui reçoit les jetons touchés (la dernière choisie, sinon la première place « Moi »)
function currentBetSeat() {
  if (S.selectedSeat >= 0 && settings.seats[S.selectedSeat] === 'player') return S.selectedSeat;
  const i = settings.seats.indexOf('player');
  S.selectedSeat = i;
  return i;
}

function placeChip(seat, mode) {
  if (S.phase !== 'betting') return;
  if (settings.seats[seat] !== 'player') {
    if (settings.seats[seat] === null && mode === 'add') { settings.seats[seat] = 'player'; saveSettings(); refreshSeats(); }
    else return;
  }
  const r = settings.rules;
  S.selectedSeat = seat;
  if (mode === 'remove') {
    if (!S.bets[seat]) return;
    const chips = TableScene.decompose(S.bets[seat]);
    const last = chips[chips.length - 1] || S.bets[seat];
    S.bets[seat] = Math.max(0, S.bets[seat] - last);
    setBank(bank + last, false);
    audio.play('chip', 0.5);
  } else {
    let v = S.chip;
    if (S.bets[seat] + v > r.maxBet) v = r.maxBet - S.bets[seat];
    if (v <= 0) { toast(`Mise maximale : ${fmt(r.maxBet)}`, 'bad'); return; }
    if (v > bank) { toast('Pas assez de jetons fictifs', 'bad'); offerRefill(); return; }
    S.bets[seat] += v;
    setBank(bank - v, false);
    audio.play('chip', 0.7);
  }
  scene.setStack('spot' + seat, S.bets[seat], scene.betPos(seat));
  refreshSeats();
  updateBetButtons();
}

function clearBets() {
  if (S.phase !== 'betting') return;
  const t = totalBets();
  if (!t) return;
  setBank(bank + t, false);
  S.bets = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) scene.removeStack('spot' + i);
  audio.play('collect', 0.4);
  refreshSeats(); updateBetButtons();
}

function rebet(mult = 1) {
  if (S.phase !== 'betting') return false;
  const base = mult === 1 ? S.lastBets : S.bets.slice();
  if (!base || !base.some(Boolean)) return false;
  const want = base.map((b, i) => (settings.seats[i] === 'player' ? Math.min(settings.rules.maxBet, b * mult) : 0));
  const extra = want.reduce((a, b) => a + b, 0) - totalBets();
  if (extra > bank) { toast('Pas assez de jetons fictifs pour cette mise', 'bad'); return false; }
  setBank(bank - extra, false);
  S.bets = want;
  for (let i = 0; i < 5; i++) scene.setStack('spot' + i, S.bets[i], scene.betPos(i));
  audio.play('chips', 0.5);
  refreshSeats(); updateBetButtons();
  return true;
}

function updateBetButtons() {
  const has = totalBets() > 0;
  $('#btnClear').disabled = !has;
  $('#btnRebet').disabled = !(S.lastBets && S.lastBets.some(Boolean)) || has;
  $('#btnDoubleBets').disabled = !has;
  const bots = settings.seats.includes('bot');
  $('#btnDeal').disabled = !(has || bots);
  for (const b of $$('#chips .chip')) b.disabled = Number(b.getAttribute('aria-label').replace(/\D/g, '')) > bank;
  const hint = $('#betHint');
  const players = settings.seats.filter((s) => s === 'player').length;
  hint.textContent = !players
    ? 'Clique sur un cercle pour t\'asseoir (jusqu\'à 5 mains).'
    : TOUCH ? `Touche un jeton pour miser sur la place ${currentBetSeat() + 1}${has ? ` · total ${fmt(totalBets())}` : ''}. Touche une autre mise pour changer de place.`
      : has ? `Mise totale : ${fmt(totalBets())} · min ${settings.rules.minBet} / max ${fmt(settings.rules.maxBet)} par main`
      : 'Choisis un jeton puis clique sur un cercle de mise. Clic droit pour retirer.';
}

function offerRefill() {
  if (bank + totalBets() >= settings.rules.minBet) return;
  const box = h('div', {},
    h('h2', {}, 'Plus de jetons'),
    h('p', { class: 'lead' }, 'Ta réserve de jetons fictifs est vide. Ce ne sont que des jetons d\'entraînement : tu peux recharger gratuitement.'),
    h('div', { class: 'coach-actions' },
      h('button', { class: 'btn primary', onclick: () => { stats.resets++; saveStats(); setBank(settings.startBank); closeModal(); toast('Réserve rechargée : ' + fmt(settings.startBank) + ' jetons fictifs', 'good'); updateBetButtons(); } }, `Recharger ${fmt(settings.startBank)} jetons`),
      h('button', { class: 'btn', onclick: () => closeModal() }, 'Plus tard')));
  openModal(box);
}

// ------------------------------------------------------------------ Places (jusqu'à 5 mains)
const labelEls = new Map();
function lblEl(key, cls = 'lbl') {
  let e = labelEls.get(key);
  if (!e) { e = h('div', { class: cls }); $('#labels').append(e); labelEls.set(key, e); }
  e.dataset.used = '1';
  return e;
}
function sweepLabels() {
  for (const [k, e] of labelEls) {
    if (!e.dataset.used) { e.remove(); labelEls.delete(k); } else delete e.dataset.used;
  }
}

function refreshSeats() {
  // Étiquettes de places pendant les mises
  for (let i = 0; i < 5; i++) {
    const key = 'seat' + i;
    if (S.phase !== 'betting') continue;
    const e = lblEl(key, 'lbl lbl-seat');
    const owner = settings.seats[i];
    e.innerHTML = '';
    const pill = h('div', { class: 'seat-pill' });
    const mk = (val, txt, ico) => {
      const b = h('button', { class: owner === val ? 'on' : '', title: txt, html: (ico ? icon(ico, 13) : '') + txt });
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setSeat(i, owner === val ? null : val); });
      return b;
    };
    pill.append(mk('player', 'Moi', 'user'), mk('bot', 'IA', 'bot'));
    e.append(pill);
    if (owner === 'player') {
      const chosen = TOUCH && i === currentBetSeat();
      const tag = h('button', { class: 'seat-bet' + (chosen ? ' chosen' : ''), onclick: (ev) => { ev.stopPropagation(); S.selectedSeat = i; refreshSeats(); updateBetButtons(); } }, S.bets[i] ? fmt(S.bets[i]) : 'Mise ?');
      e.append(tag);
    }
    else if (owner === 'bot') e.append(h('div', { class: 'seat-bet', style: { color: 'var(--ink-3)', fontSize: '13px' } }, 'Joueur IA'));
  }
  const sel = TOUCH ? currentBetSeat() : -1;
  scene.setSpotsEnabled(S.phase === 'betting', settings.seats.map((s, i) => (s === 'player' && (TOUCH ? i === sel : !S.bets[i]) ? i : -1)).filter((i) => i >= 0));
  if (S.phase !== 'betting') for (let i = 0; i < 5; i++) { const e = labelEls.get('seat' + i); if (e) { e.remove(); labelEls.delete('seat' + i); } }
}

function setSeat(i, owner) {
  if (S.phase !== 'betting') return;
  if (settings.seats[i] === 'player' && owner !== 'player' && S.bets[i]) {
    setBank(bank + S.bets[i], false);
    S.bets[i] = 0;
    scene.removeStack('spot' + i);
  }
  settings.seats[i] = owner;
  if (owner === 'player') S.selectedSeat = i;
  saveSettings();
  refreshSeats();
  updateBetButtons();
}

// ------------------------------------------------------------------ Étiquettes des mains
function handText(cards) {
  const t = handTotal(cards);
  if (cards.length === 2 && t.total === 21) return 'BJ';
  if (t.soft && t.total < 21 && t.total !== 21) return `${t.total - 10}<small> / </small>${t.total}`;
  return String(t.total);
}

const RES_LABEL = {
  win: ['Gagné', 'res-win'], blackjack: ['Blackjack', 'res-bj'], lose: ['Perdu', 'res-lose'], bust: ['Sauté', 'res-lose'],
  push: ['Égalité', 'res-push'], surrender: ['Abandon', 'res-lose'],
};

function refreshLabels() {
  for (const e of labelEls.values()) delete e.dataset.used;
  if (S.phase === 'betting') {
    for (let i = 0; i < 5; i++) if (labelEls.has('seat' + i)) labelEls.get('seat' + i).dataset.used = '1';
  }
  if (S.phase !== 'betting' && settings.showTotals) {
    for (const hd of engine.hands) {
      if (!hd.cards.length) continue;
      const e = lblEl('h' + hd.id);
      const t = hd.total;
      e.className = 'lbl' + (hd === S.activeHand ? ' active' : '') + (t.total > 21 ? ' bust' : '') + (hd.isBlackjack ? ' bj' : '');
      const totalTxt = hd.isBlackjack ? 'Blackjack' : handText(hd.cards);
      const crowded = nInSeat(hd.seat) > 1;
      let html;
      if (hd.result && S.roundResults) {
        const [txt, cls] = RES_LABEL[hd.result];
        const net = hd.net - (hd.insurance ? (engine.lastDealerBJ ? hd.insurance * 2 : -hd.insurance) : 0);
        html = `<div class="lbl-total lbl-done ${cls}">${hd.isBlackjack ? 'BJ' : handText(hd.cards)}<span class="lbl-net">${net ? fmtSigned(net) : txt}</span></div>`;
        if (!crowded) html += `<div class="lbl-res ${cls}">${txt}</div>`;
      } else {
        html = `<div class="lbl-total">${totalTxt}</div>`;
        if (!crowded) html += hd.owner === 'player' ? `<div class="lbl-bet">${fmt(hd.bet)}${hd.doubled ? ' · doublé' : ''}</div>` : `<div class="lbl-bet">IA</div>`;
      }
      e.innerHTML = html;
      e._pos = scene.handLabelPos(hd.seat, hd.splitIndex, nInSeat(hd.seat));
    }
    if (engine.dealer.cards.length) {
      const e = lblEl('dealer');
      const vis = engine.dealer.holeHidden ? [engine.dealer.cards[0]] : engine.dealer.cards;
      const t = handTotal(vis);
      e.className = 'lbl lbl-below' + (t.total > 21 ? ' bust' : '') + (!engine.dealer.holeHidden && vis.length === 2 && t.total === 21 ? ' bj' : '');
      e.innerHTML = `<div class="lbl-total">${!engine.dealer.holeHidden && vis.length === 2 && t.total === 21 ? 'Blackjack' : handText(vis)}</div><div class="lbl-bet">Croupier</div>`;
      e._pos = scene.dealerLabelPos();
    }
  }
  sweepLabels();
  refreshMyHands();
}

const _tmp = new THREE.Vector3();
function positionLabels() {
  for (const [k, e] of labelEls) {
    let p = e._pos;
    if (k.startsWith('seat')) {
      const i = Number(k.slice(4));
      p = scene.betPos(i).add(_tmp.set(Math.cos(scene.geo.spots[i].angle), 0, Math.sin(scene.geo.spots[i].angle)).multiplyScalar(-0.2));
    }
    if (!p) continue;
    const s = scene.project(p);
    // Garde les étiquettes dans l'écran (places du bord sur téléphone)
    const half = (e.offsetWidth || 0) / 2 + 4;
    const W = window.innerWidth;
    if (half && W > 2 * half) s.x = Math.min(Math.max(s.x, half), W - half);
    e.style.left = s.x + 'px';
    e.style.top = s.y + 'px';
    e.style.opacity = s.visible ? '' : '0';
  }
}

// Récapitulatif « Mes mains » : toujours lisible, même avec 5 mains et des séparations
function refreshMyHands() {
  const box = $('#myHands');
  const mine = playerHands();
  if (S.phase === 'betting' || !mine.length || settings.myHandsPanel === false) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '';
  const dCards = engine.dealer.holeHidden ? [engine.dealer.cards[0]] : engine.dealer.cards;
  if (dCards.length) {
    const t = handTotal(dCards);
    box.append(h('div', { class: 'mh mh-dealer' },
      h('div', { class: 'mh-head' }, h('b', {}, 'Croupier'), engine.dealer.holeHidden ? '1 carte cachée' : ''),
      h('div', { class: 'mh-cards' }, dCards.map((c) => cardImg(c, settings.style.indices, 0.2))),
      h('div', { class: 'mh-foot' }, h('span', { class: 'mh-total', html: t.total > 21 ? 'Sauté' : handText(dCards) }))));
  }
  const seats = [...new Set(mine.map((x) => x.seat))];
  mine.forEach((hd) => {
    const n = seatHands(hd.seat).length;
    const t = hd.total;
    const res = hd.result && S.roundResults ? RES_LABEL[hd.result] : null;
    const title = `Place ${hd.seat + 1}` + (n > 1 ? ` · main ${hd.splitIndex + 1}/${n}` : '');
    box.append(h('div', { class: 'mh' + (hd === S.activeHand ? ' active' : '') },
      h('div', { class: 'mh-head' }, h('b', {}, seats.length > 1 || n > 1 ? title : 'Ta main'), `Mise ${fmt(hd.bet)}${hd.doubled ? ' (doublée)' : ''}${hd.insurance ? ' · assurée' : ''}`),
      h('div', { class: 'mh-cards' }, hd.cards.map((c) => cardImg(c, settings.style.indices, 0.2))),
      h('div', { class: 'mh-foot' },
        h('span', { class: 'mh-total', html: hd.isBlackjack ? 'Blackjack' : t.total > 21 ? `${t.total} <small>sauté</small>` : handText(hd.cards) }),
        res ? h('span', { class: 'mh-res', style: { color: res[1] === 'res-win' || res[1] === 'res-bj' ? 'var(--green)' : res[1] === 'res-push' ? 'var(--ink-2)' : 'var(--red)' } }, res[0] + (hd.net ? ' ' + fmtSigned(hd.net) : '')) : null)));
  });
  const act = box.querySelector('.mh.active');
  if (act) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ------------------------------------------------------------------ Compte
function updateCount() {
  const box = $('#countBox');
  const show = settings.showCount;
  box.hidden = !show && !(settings.showSpread && settings.mode === 'comptage');
  const sys = COUNT_SYSTEMS[settings.countSystem];
  const rc = engine.runningCount;
  const decks = engine.decksRemaining;
  const tc = engine.systemTrueCount;
  const rcEl = $('#cbRc'), tcEl = $('#cbTc');
  if (show) {
    rcEl.textContent = (rc > 0 ? '+' : '') + fmt(rc);
    rcEl.className = rc > 0 ? 'pos' : rc < 0 ? 'neg' : '';
    tcEl.textContent = sys.balanced ? (tc > 0 ? '+' : '') + (Math.round(tc * 10) / 10).toFixed(1) : '—';
    tcEl.className = tc >= 1 ? 'pos' : tc <= -1 ? 'neg' : '';
  } else {
    rcEl.textContent = '?'; tcEl.textContent = '?'; rcEl.className = tcEl.className = '';
  }
  $('#cbDecks').textContent = (Math.round(decks * 2) / 2).toFixed(1);
  $('#cbPen').style.width = Math.min(100, (engine.shoe.pos / engine.shoe.cutIndex) * 100) + '%';
  $('#cbSys').textContent = sys.name + (sys.balanced ? '' : ' (non équilibré)');
  const showBet = settings.showSpread && show;
  $('#cbBetRow').hidden = !showBet;
  if (showBet) {
    const u = unitsFor(engine.trueCount);
    $('#cbBet').textContent = `${u} unité${u > 1 ? 's' : ''} · ${fmt(u * settings.unit)}`;
  }
}

function updateShoe() {
  scene.setShoeLevel(engine.shoe.remaining, engine.shoe.total);
  scene.setDiscard(engine.shoe.pos - engine.dealer.cards.length - engine.hands.reduce((a, x) => a + x.cards.length, 0));
}

// ------------------------------------------------------------------ Aide / coach
function currentSituation() {
  const hd = S.activeHand;
  if (!hd || hd.owner !== 'player' || !engine.dealer.cards.length) return null;
  const adv = engine.advise(hd, settings.deviations);
  return { hand: hd, adv, up: engine.dealerUp().value };
}

function showCoach(kind, title, text, actions = []) {
  const c = $('#coach');
  c.className = 'coach ' + kind;
  c.innerHTML = '';
  delete c.dataset.mistake;
  c.append(h('h4', { html: icon(kind === 'bad' ? 'x' : kind === 'good' ? 'check' : 'lightbulb', 16) + title }), h('p', {}, text));
  if (actions.length) c.append(h('div', { class: 'coach-actions' }, actions));
  c.hidden = false;
  clearTimeout(showCoach.t);
}
// Les erreurs restent affichées jusqu'à « Compris » (ou la donne suivante)
function showMistake(title, text) {
  showCoach('bad', title, text, [h('button', { class: 'btn', onclick: () => hideCoach() }, 'Compris')]);
  $('#coach').dataset.mistake = '1';
}
function coachIsMistake() { return !$('#coach').hidden && $('#coach').dataset.mistake === '1'; }
function hideCoach(delay = 0) {
  clearTimeout(showCoach.t);
  if (delay) showCoach.t = setTimeout(() => { $('#coach').hidden = true; }, delay);
  else $('#coach').hidden = true;
}

function refreshAdvice() {
  for (const b of $$('#actions .btn.act')) b.classList.remove('rec');
  const sit = currentSituation();
  if (!sit || S.phase !== 'playing' || !S.resolveAction) return;
  if (settings.adviceMode === 'before') {
    const btn = $(`#actions [data-act="${sit.adv.action}"]`);
    if (btn) btn.classList.add('rec');
    showCoach('', `Conseil : ${ACTION_LABEL[sit.adv.action]}`, sit.adv.reason);
  } else if (!coachIsMistake()) hideCoach();
}

function giveHint() {
  const sit = currentSituation();
  if (!sit) return;
  S.aidedThisHand = true;
  const btn = $(`#actions [data-act="${sit.adv.action}"]`);
  if (btn) btn.classList.add('rec');
  showCoach('', `Conseil : ${ACTION_LABEL[sit.adv.action]}`, sit.adv.reason);
  audio.play('tick');
}

// ------------------------------------------------------------------ Actions joueur
const ACTION_KEYS = { H: 'H', S: 'S', D: 'D', P: 'P', R: 'R' };
function buildActions(opts) {
  const a = $('#actions');
  a.innerHTML = '';
  const defs = [['H', 'Carte', 'H'], ['S', 'Rester', 'S'], ['D', 'Doubler', 'D'], ['P', 'Séparer', 'P']];
  if (settings.rules.surrender !== 'none') defs.push(['R', 'Abandonner', 'R']);
  for (const [k, label, key] of defs) {
    const b = h('button', { class: 'btn act', 'data-act': k, disabled: !opts[k] }, label, h('kbd', {}, key));
    b.addEventListener('click', () => chooseAction(k));
    a.append(b);
  }
  if (settings.adviceMode !== 'off') {
    a.append(h('button', { class: 'btn act hint-btn', title: 'Conseil (A)', onclick: giveHint, html: icon('lightbulb', 20) + '<kbd>A</kbd>' }));
  }
}

function chooseAction(k) {
  if (!S.resolveAction) return;
  const btn = $(`#actions [data-act="${k}"]`);
  if (!btn || btn.disabled) return;
  const sit = currentSituation();
  // Mode coach : confirmation avant une erreur
  if (sit && settings.adviceMode === 'before' && settings.confirmMistakes && k !== sit.adv.action && !S.confirming) {
    S.confirming = true;
    showCoach('bad', `${ACTION_LABEL[k]} n'est pas le bon coup`, `La stratégie conseille : ${ACTION_LABEL[sit.adv.action]}. ${sit.adv.reason}`, [
      h('button', { class: 'btn primary', onclick: () => { S.confirming = false; chooseAction(sit.adv.action); } }, `${ACTION_LABEL[sit.adv.action]} (conseillé)`),
      h('button', { class: 'btn', onclick: () => { S.confirming = 'force'; chooseAction(k); } }, `Garder : ${ACTION_LABEL[k]}`),
    ]);
    audio.play('bad');
    return;
  }
  S.confirming = false;
  const r = S.resolveAction;
  S.resolveAction = null;
  if (sit) recordDecision(sit, k);
  r(k);
}

function recordDecision(sit, did) {
  const { adv, hand, up } = sit;
  const ok = did === adv.action;
  const kind = adv.deviation ? 'deviation' : adv.kind;
  stats.decisions[kind] = stats.decisions[kind] || { ok: 0, n: 0 };
  stats.decisions[kind].n++;
  if (ok) stats.decisions[kind].ok++;
  const rowKey = adv.kind === 'pair' ? 'pair:' + hand.cards[0].value : `${adv.kind}:${adv.total}`;
  const cellKey = `${rowKey}:${up}`;
  const cell = stats.cells[cellKey] || (stats.cells[cellKey] = { ok: 0, n: 0 });
  cell.n++; if (ok) cell.ok++;
  stats.decisionStreak = ok ? (stats.decisionStreak || 0) + 1 : 0;
  stats.bestDecisionStreak = Math.max(stats.bestDecisionStreak || 0, stats.decisionStreak);
  if (!ok) {
    stats.mistakes.push({ t: Date.now(), cards: hand.cards.map((c) => c.rank + c.suit), up, did, should: adv.action, kind, total: adv.total, soft: adv.soft });
  }
  saveStats();
  if (settings.adviceMode === 'after') {
    if (ok) { audio.play('good', 0.6); toast(`Bon coup : ${ACTION_LABEL[did]}`, 'good', 1100); if (!coachIsMistake()) hideCoach(); }
    else {
      audio.play('bad', 0.8);
      const where = playerHands().length > 1 ? ` (place ${hand.seat + 1})` : '';
      showMistake(`Erreur${where} : il fallait ${ACTION_LABEL[adv.action].toLowerCase()}`, `Tu as choisi « ${ACTION_LABEL[did]} » avec ${adv.soft ? adv.total + ' souple' : adv.total} contre ${up === 11 ? 'un as' : up}. ${adv.reason}`);
    }
  } else if (settings.adviceMode === 'before') hideCoach();
}

function showDock(which) {
  $('#dockBet').hidden = which !== 'bet';
  $('#dockPlay').hidden = which !== 'play';
  $('#dockIns').hidden = which !== 'ins';
  $('#dockWait').hidden = which !== 'wait';
  requestAnimationFrame(() => {
    const d = $('#dock');
    document.documentElement.style.setProperty('--dock-h', d.offsetHeight + 'px');
  });
}

// ------------------------------------------------------------------ Branchement du moteur (io)
function stackPos(hd, kind) {
  const n = nInSeat(hd.seat);
  const f = scene.handFrame(hd.seat, hd.splitIndex, n);
  const bp = scene.betPos(hd.seat, hd.splitIndex, n);
  if (kind === 'dbl') return bp.add(f.right.clone().multiplyScalar(0.044));
  if (kind === 'pay') return bp.add(f.right.clone().multiplyScalar(-0.044));
  if (kind === 'ins') return f.base.clone().add(f.toCenter.clone().multiplyScalar(0.115)).setY(TABLE_Y);
  if (kind === 'inspay') return f.base.clone().add(f.toCenter.clone().multiplyScalar(0.115)).add(f.right.clone().multiplyScalar(-0.044)).setY(TABLE_Y);
  if (kind === 'rail') return f.base.clone().add(f.radial.clone().multiplyScalar(0.55)).setY(TABLE_Y);
  return bp;
}

function relayoutStacks(seat) {
  for (const hd of seatHands(seat)) {
    for (const [prefix, kind] of [['', 'main'], ['dbl', 'dbl']]) {
      const g = scene.betStacks.get(prefix + hd.id);
      if (g) scene.moveStack(prefix + hd.id, stackPos(hd, kind), false, 0.3);
    }
  }
}

function buildIO() {
  return {
    canAfford: (amt, hd) => (hd && hd.owner === 'bot') || bank >= amt - 1e-9,
    botDelay: () => wait(0.42),

    onShuffle: async () => {
      if (engine.rules.csm) { scene.setDiscard(0); updateCount(); return; }
      toast('Mélange du sabot');
      audio.say('Mélange des cartes.', 'essentiel');
      await scene.shuffleAnim();
      updateCount();
    },
    onBurn: async (card) => {
      await scene.burnCard(card);
      updateShoe();
    },
    onRoundStart: async (hands) => {
      for (const hd of hands) {
        const key = 'spot' + hd.seat;
        const g = scene.betStacks.get(key);
        if (g) { scene.betStacks.delete(key); scene.betStacks.set(hd.id, g); }
        else scene.setStack(hd.id, hd.bet, scene.betPos(hd.seat));
      }
      refreshLabels();
    },
    onDeal: async (card, target, faceUp) => {
      if (target === 'dealer') await scene.dealToDealer(card, faceUp);
      else await scene.dealToHand(card, target, nInSeat(target.seat), faceUp);
      updateCount(); updateShoe(); refreshLabels();
      if (target !== 'dealer' && target.owner === 'player' && target.cards.length >= 3) {
        const t = target.total.total;
        if (t <= 21) audio.say(String(t), 'bavard');
      }
    },
    askInsurance: (hd) => new Promise((resolve) => {
      S.activeHand = hd;
      scene.setActive(hd, nInSeat(hd.seat));
      refreshLabels();
      const even = hd.isBlackjack;
      $('#insText').textContent = even
        ? `Tu as un blackjack et le croupier montre un as. Paiement égal (1 contre 1) tout de suite ?`
        : `Le croupier montre un as. Assurance pour ${fmt(hd.originalBet / 2)} ?` + (playerHands().length > 1 ? ` (place ${hd.seat + 1})` : '');
      if (!askInsurance.said) { audio.say(even ? 'Paiement égal ?' : 'Assurance ?', 'essentiel'); askInsurance.said = true; }
      showDock('ins');
      const sit = { adv: shouldInsure(engine.trueCount, settings.deviations) };
      if (settings.adviceMode === 'before') {
        showCoach('', `Conseil : ${sit.adv ? 'prendre' : 'refuser'} l'assurance`,
          sit.adv ? `Le compte réel est de ${engine.trueCount.toFixed(1)} (≥ +${INSURANCE_TC}) : le sabot est riche en 10, l'assurance devient rentable.`
            : 'L\'assurance est un pari perdant à long terme (avantage maison d\'environ 7 %). Refuse-la, sauf si le compte réel atteint +3 ou plus.');
      }
      S.resolveIns = (take) => {
        S.resolveIns = null;
        const ok = take === sit.adv;
        stats.decisions.insurance.n++;
        if (ok) stats.decisions.insurance.ok++;
        else stats.mistakes.push({ t: Date.now(), cards: hd.cards.map((c) => c.rank + c.suit), up: 11, did: take ? 'I' : 'NI', should: sit.adv ? 'I' : 'NI', kind: 'insurance' });
        saveStats();
        if (settings.adviceMode === 'after' && !ok) showMistake(take ? 'Erreur : l\'assurance ne vaut pas le coup ici' : 'Erreur : l\'assurance était rentable', take ? 'L\'assurance paie 2 contre 1 mais le croupier n\'a un 10 caché qu\'environ 31 % du temps. À éviter sauf compte réel ≥ +3.' : `Avec un compte réel de ${engine.trueCount.toFixed(1)}, l'assurance rapporte en moyenne.`);
        else if (!coachIsMistake()) hideCoach();
        showDock('wait');
        resolve(take);
      };
    }),
    onInsurance: async (hd) => {
      if (hd.owner === 'player') { setBank(bank - hd.insurance, false); stats.insurances++; }
      scene.setStack('ins' + hd.id, hd.insurance, stackPos(hd, 'ins'));
      audio.play('chip', 0.6);
    },
    askEarlySurrender: (hd, adv) => new Promise((resolve) => {
      S.activeHand = hd;
      refreshLabels();
      const yes = h('button', { class: 'btn', onclick: () => { hideCoach(); resolve(true); } }, 'Abandonner (récupérer la moitié)');
      const no = h('button', { class: 'btn primary', onclick: () => { hideCoach(); resolve(false); } }, 'Continuer');
      showCoach(settings.adviceMode === 'before' ? '' : '', 'Abandon anticipé ?', settings.adviceMode === 'before' ? `Conseil : ${adv.action === 'R' ? 'abandonner' : 'continuer'}.` : 'Tu peux abandonner avant que le croupier vérifie son blackjack.', [yes, no]);
    }),
    onPeek: async (bj) => {
      await scene.peekHole();
      if (bj) audio.say('Blackjack pour la banque.', 'essentiel');
    },
    onReveal: async () => {
      await scene.revealHole();
      updateCount(); refreshLabels();
    },
    onActiveHand: async (hd) => {
      S.activeHand = hd;
      S.aidedThisHand = false;
      scene.setActive(hd, nInSeat(hd.seat));
      refreshLabels();
      if (hd.owner === 'player') focusHand(hd);
    },
    getAction: (hd, opts) => new Promise((resolve) => {
      S.activeHand = hd;
      scene.setActive(hd, nInSeat(hd.seat));
      $('#playFor').innerHTML = playerHands().length > 1
        ? `Place <b>${hd.seat + 1}</b>${seatHands(hd.seat).length > 1 ? ` · main <b>${hd.splitIndex + 1}</b>/${seatHands(hd.seat).length}` : ''} · ${handText(hd.cards).replace(/<[^>]+>/g, '')} contre ${upValueLabel(engine.dealerUp())}`
        : `Ta main : <b>${handText(hd.cards).replace(/<[^>]+>/g, '')}</b> contre ${upValueLabel(engine.dealerUp())}`;
      buildActions(opts);
      showDock('play');
      S.resolveAction = (k) => { showDock('wait'); resolve(k); };
      refreshLabels();
      refreshAdvice();
      if (drawerIs('chart')) panels.chart(currentSituation());
    }),
    onSplit: async (hd, nh) => {
      if (hd.owner === 'player') { setBank(bank - nh.bet, false); stats.splits++; }
      audio.play('chips', 0.5);
      await scene.relayoutSeat(hd.seat, seatHands(hd.seat));
      relayoutStacks(hd.seat);
      scene.setStack(nh.id, nh.bet, stackPos(nh, 'main'));
      refreshLabels();
    },
    onDouble: async (hd) => {
      if (hd.owner === 'player') { setBank(bank - hd.originalBet, false); stats.doubles++; }
      scene.setStack('dbl' + hd.id, hd.originalBet, stackPos(hd, 'dbl'));
      audio.play('chip', 0.7);
    },
    onSurrender: async (hd) => {
      if (hd.owner === 'player') audio.say('Abandon.', 'bavard');
      refreshLabels();
    },
    onHandDone: async (hd) => {
      if (hd.busted) {
        if (hd.owner === 'player') audio.say('Sauté.', 'essentiel');
        // Les mises perdues sont ramassées tout de suite, comme au casino
        await wait(0.25);
        const tray = scene.trayPos();
        scene.moveStack('dbl' + hd.id, tray, true);
        await scene.moveStack(hd.id, tray, true);
        audio.play('collect', 0.4);
      }
      refreshLabels();
    },
    onDealerTurn: async () => {
      S.activeHand = null;
      scene.setActive(null);
      if (!coachIsMistake()) hideCoach();
      $('#waitText').textContent = 'Le croupier joue';
      showDock('wait');
      if (settings.followCam && !settings.fixedView) scene.setView('joueur');
      scene.dealer.lookAt(new THREE.Vector3(0, TABLE_Y, -0.2));
      refreshLabels();
    },
    onSettle: async (sum) => settle(sum),
    onRoundEnd: async () => {},
  };
}
function askInsurance() {}

// ------------------------------------------------------------------ Règlement
async function settle(sum) {
  S.phase = 'settling';
  S.roundResults = true;
  engine.lastDealerBJ = sum.dealerBJ;
  const dt = sum.dealerTotal;
  if (sum.dealerBust) audio.say('La banque saute.', 'essentiel');
  else if (!sum.dealerBJ && sum.hands.some((x) => !x.busted && !x.surrendered)) audio.say(String(dt) + '.', 'essentiel');
  refreshLabels();
  scene.lookAtPlayers();
  await wait(0.35);

  const tray = scene.trayPos();
  const order = [...sum.hands].sort((a, b) => b.seat - a.seat || b.splitIndex - a.splitIndex);
  let bjSaid = false;
  for (const hd of order) {
    const handNet = hd.net - (hd.insurance ? (sum.dealerBJ ? hd.insurance * 2 : -hd.insurance) : 0);
    if (hd.insurance) {
      if (sum.dealerBJ) await scene.payStack('inspay' + hd.id, hd.insurance * 2, stackPos(hd, 'inspay'));
      else await scene.moveStack('ins' + hd.id, tray, true, 0.35);
    }
    if (hd.result === 'win' || hd.result === 'blackjack') {
      if (hd.result === 'blackjack' && hd.owner === 'player' && !bjSaid) { audio.say('Blackjack !', 'essentiel'); bjSaid = true; }
      await scene.payStack('pay' + hd.id, handNet, stackPos(hd, 'pay'));
      audio.play('chips', 0.6);
    } else if (hd.result === 'lose' || hd.result === 'surrender') {
      scene.moveStack('dbl' + hd.id, tray, true, 0.35);
      await scene.moveStack(hd.id, tray, true, 0.35);
      audio.play('collect', 0.35);
    }
  }
  refreshLabels();

  // Banque et statistiques
  let playerNet = 0, any = false, back = 0;
  for (const hd of sum.hands) {
    if (hd.owner !== 'player') continue;
    any = true;
    back += hd.bet + hd.insurance + hd.net;
    playerNet += hd.net;
    stats.hands++;
    stats.wagered += hd.bet;
    if (hd.result === 'win') stats.wins++;
    else if (hd.result === 'blackjack') { stats.wins++; stats.blackjacks++; }
    else if (hd.result === 'push') stats.pushes++;
    else if (hd.result === 'bust') { stats.losses++; stats.busts++; }
    else if (hd.result === 'surrender') { stats.losses++; stats.surrenders++; }
    else stats.losses++;
  }
  setBank(bank + back, true);
  if (any) {
    stats.rounds++;
    stats.net += playerNet;
    S.session.rounds++; S.session.net += playerNet;
    if (playerNet > stats.biggestWin) stats.biggestWin = playerNet;
    if (playerNet < stats.biggestLoss) stats.biggestLoss = playerNet;
    if (playerNet > 0) stats.streak = stats.streak > 0 ? stats.streak + 1 : 1;
    else if (playerNet < 0) stats.streak = stats.streak < 0 ? stats.streak - 1 : -1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    stats.worstStreak = Math.min(stats.worstStreak, stats.streak);
    stats.bankHistory.push({ t: Date.now(), v: Math.round(bank) });
    // Historique des donnes (consultable dans les statistiques)
    const mine = sum.hands.filter((x) => x.owner === 'player');
    stats.history = stats.history || [];
    stats.history.push({
      t: Date.now(), dealer: engine.dealer.cards.map((c) => c.rank + c.suit), dt: sum.dealerTotal,
      hands: mine.map((x) => ({ seat: x.seat, cards: x.cards.map((c) => c.rank + c.suit), r: x.result, net: x.net, bet: x.bet })),
    });
    if (stats.history.length > 60) stats.history = stats.history.slice(-60);
    const seatsUsed = new Set(mine.map((x) => x.seat)).size;
    const splitWins = [...new Set(mine.filter((x) => x.fromSplit).map((x) => x.seat))]
      .some((seat) => mine.filter((x) => x.seat === seat).every((x) => x.result === 'win' || x.result === 'blackjack'));
    saveStats({ playerHands: seatsUsed, splitWins });
    track('round', settings.mode);
    track('hands', seatsUsed);
    flashDelta(playerNet);
    if (playerNet > 0) audio.play('win', 0.5);
  }

  await wait(1.1);
  // Les gains reviennent vers le joueur
  for (const hd of sum.hands) {
    for (const k of [hd.id, 'dbl' + hd.id, 'pay' + hd.id, 'ins' + hd.id, 'inspay' + hd.id]) {
      if (scene.betStacks.has(k)) scene.moveStack(k, stackPos(hd, 'rail'), true, 0.4);
    }
  }
  await wait(0.5);
  await scene.collectCards();
  scene.clearStacks();
  S.roundResults = false;
  updateShoe();
  S.roundsSinceQuiz++;
  if (S.statsDirty && drawerIs('stats')) panels.stats();
}

// ------------------------------------------------------------------ Donne
async function deal() {
  if (S.phase !== 'betting') return;
  if (!totalBets() && S.lastBets && S.lastBets.some(Boolean)) rebet();
  const r = settings.rules;
  const seats = [];
  for (let i = 0; i < 5; i++) {
    const o = settings.seats[i];
    if (o === 'player' && S.bets[i] > 0) {
      if (S.bets[i] < r.minBet) { toast(`Mise minimale : ${r.minBet} par main (place ${i + 1})`, 'bad'); return; }
      seats.push({ index: i, owner: 'player', bet: S.bets[i] });
    } else if (o === 'bot') {
      const tc = engine.trueCount;
      const b = settings.mode === 'comptage' ? r.minBet * unitsFor(tc) : r.minBet * [1, 1, 2, 2, 3, 5][Math.floor(Math.random() * 6)];
      seats.push({ index: i, owner: 'bot', bet: Math.min(r.maxBet, b) });
    }
  }
  if (!seats.length) { toast('Place une mise sur au moins un cercle', 'bad'); return; }
  if (!seats.some((s) => s.owner === 'player') && !settings.seats.includes('bot')) return;

  // Quiz de fin de sabot (avant le mélange)
  if (engine.shoe.needsShuffle && !engine.rules.csm && settings.quizAtShuffle && engine.seenCards.length > 30) {
    await countQuiz('Fin du sabot');
  } else if (settings.quizEvery && S.roundsSinceQuiz >= settings.quizEvery && engine.seenCards.length > 8) {
    await countQuiz('Contrôle du compte');
  }

  S.lastBets = S.bets.slice();
  hideCoach();
  S.phase = 'playing';
  askInsurance.said = false;
  closeDrawer();
  refreshSeats();
  showDock('wait');
  $('#waitText').textContent = 'Distribution';
  // Mises des joueurs IA
  for (const s of seats) if (s.owner === 'bot') scene.setStack('spot' + s.index, s.bet, scene.betPos(s.index));
  if (Math.random() < 0.5) audio.say('Rien ne va plus.', 'bavard');
  scene.lookAtPlayers();
  try {
    await engine.playRound(seats);
  } catch (e) {
    console.error(e);
    toast('Erreur pendant la donne — la table est réinitialisée', 'bad', 4000);
    scene.clearCardsInstant(); scene.clearStacks();
  }
  S.bets = [0, 0, 0, 0, 0];
  S.activeHand = null;
  S.phase = 'betting';
  refreshLabels();
  refreshSeats();
  showDock('bet');
  updateCount();
  if (settings.autoRebet && S.lastBets) rebet();
  updateBetButtons();
  if (S.pendingRules) { S.pendingRules(); S.pendingRules = null; }
  if (bank + totalBets() < settings.rules.minBet) offerRefill();
}

// ------------------------------------------------------------------ Quiz du compte
function countQuiz(title) {
  S.roundsSinceQuiz = 0;
  const sys = COUNT_SYSTEMS[settings.countSystem];
  const truth = engine.runningCount;
  const step = sys.tags[5] === 1.5 ? 0.5 : 1;
  return new Promise((resolve) => {
    const input = h('input', { type: 'number', step: String(step), value: '0', inputmode: 'numeric', 'aria-label': 'Compte courant' });
    const minus = h('button', { class: 'btn', onclick: () => { input.value = String(Number(input.value || 0) - step); } }, '−');
    const plus = h('button', { class: 'btn', onclick: () => { input.value = String(Number(input.value || 0) + step); } }, '+');
    const out = h('div', { class: 'quiz-result' });
    const go = h('button', { class: 'btn primary' }, 'Valider');
    let answered = false;
    const submit = () => {
      if (answered) { closeModal(); return; }
      answered = true;
      const v = Number(input.value || 0);
      const err = Math.abs(v - truth);
      stats.countQuiz.n++;
      stats.countQuiz.absErr += err;
      if (err < 1e-9) stats.countQuiz.ok++;
      saveStats();
      const tcTxt = sys.balanced ? ` · compte réel ${(engine.systemTrueCount).toFixed(1)} (${engine.decksRemaining.toFixed(1)} jeux restants)` : '';
      out.innerHTML = err < 1e-9 ? `<b style="color:var(--green)">Exact !</b> Compte courant : ${fmtSigned(truth) || 0}${tcTxt}`
        : `<b style="color:var(--red)">Raté</b> — le compte était <b>${fmtSigned(truth) || 0}</b> (tu as dit ${fmtSigned(v) || 0})${tcTxt}`;
      audio.play(err < 1e-9 ? 'good' : 'bad');
      go.textContent = 'Continuer';
      input.disabled = minus.disabled = plus.disabled = true;
    };
    go.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } e.stopPropagation(); });
    const box = h('div', {},
      h('h2', {}, title),
      h('p', { class: 'lead' }, `Quel est le compte courant (${sys.name}) ?` + (sys.balanced ? '' : ' Système non équilibré : compte depuis le compte initial.')),
      h('div', { class: 'quiz-input' }, minus, input, plus), out,
      h('div', { class: 'coach-actions', style: { justifyContent: 'center' } }, go));
    openModal(box, { onClose: () => resolve() });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

// ------------------------------------------------------------------ Clavier
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (!$('#drill').hidden) { drills.close(); return; }
    if (modalOpen() && $('#modal').dataset.closable) { closeModal(); return; }
    closeDrawer(); return;
  }
  if (modalOpen() || !$('#drill').hidden) return;
  if (S.resolveIns) {
    if (k === 'o' || k === 'y') { e.preventDefault(); S.resolveIns(true); }
    if (k === 'n') { e.preventDefault(); S.resolveIns(false); }
    return;
  }
  if (S.resolveAction) {
    const map = { h: 'H', s: 'S', d: 'D', p: 'P', r: 'R' };
    if (map[k]) { e.preventDefault(); chooseAction(map[k]); return; }
    if (k === 'a') { e.preventDefault(); giveHint(); return; }
  }
  if (S.phase === 'betting') {
    if (k === ' ' || k === 'enter') { e.preventDefault(); deal(); return; }
    if (k === 'r') { rebet(); return; }
    if (k === 'x') { clearBets(); return; }
  }
  const views = { 1: 'joueur', 2: 'plongee', 3: 'croupier', 4: 'premiere', 5: 'cinema' };
  if (views[k]) { if (settings.fixedView) toggleFixed(); scene.setView(views[k]); return; }
  if (k === 'c') toggleCount();
  else if (k === 't') togglePanel('chart');
  else if (k === 'p' && !S.resolveAction) togglePanel('settings');
  else if (k === 's' && !S.resolveAction) togglePanel('stats');
  else if (k === 'e') drills.openMenu();
  else if (k === 'm') toggleMute();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'b') toggleFixed();
  else if (k === 'v') $('#camCtl [aria-label="Suivre la main active (V)"]')?.click();
  else if (k === '?' || k === 'à') panels.help();
});

$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal').dataset.closable) closeModal(); });
$('#modalClose').innerHTML = icon('x', 18);
$('#modalClose').addEventListener('click', () => closeModal());
$('#drawerClose').innerHTML = icon('x', 18);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#dockIns').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ins]');
  if (b && S.resolveIns) S.resolveIns(b.dataset.ins === 'yes');
});
$('#btnDeal').addEventListener('click', deal);
$('#btnClear').addEventListener('click', clearBets);
$('#btnRebet').addEventListener('click', () => rebet());
$('#btnDoubleBets').addEventListener('click', () => rebet(2));
scene.onSpotClick = (i, mode) => placeChip(i, mode);

// ------------------------------------------------------------------ Boucle
scene.onFrame = (dt) => {
  positionLabels();
  fps.tick(dt);
  if (!document.hidden && S.phase !== 'loading') stats.playMs += dt * 1000;
};
setInterval(() => saveStats(), 30000);
window.addEventListener('beforeunload', () => {
  stats.sessions.push({ start: S.session.start, end: Date.now(), rounds: S.session.rounds, net: S.session.net });
  saveStats(); saveSettings(); saveBank();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveStats(); audio.stopVoice(); } });

// ------------------------------------------------------------------ Réglages appliqués depuis les panneaux
const app = {
  settings, get stats() { return stats; }, set stats(v) { stats = v; }, get bank() { return bank; }, scene, engine: () => engine, audio,
  saveSettings, saveStats, setBank, setMode, buildTopbar, refreshSeats, updateCount, refreshLabels, toast,
  speeds: SPEEDS, modes: MODES, quality: QUALITY, currentQualityKey,
  applyRules(rules) {
    if (S.phase !== 'betting') { toast('Les règles changeront à la prochaine donne'); }
    settings.rules = { ...settings.rules, ...rules };
    saveSettings();
    const apply = () => {
      engine.setRules(settings.rules);
      scene.applyStyle(settings.rules);
      updateShoe(); updateCount(); updateBetButtons();
    };
    if (S.phase === 'betting') apply(); else S.pendingRules = apply;
  },
  applyStyle(patch) {
    Object.assign(settings.style, patch);
    if ('fourColor' in patch) { setDeckColors(patch.fourColor ? 4 : 2); clearCardImgCache(); }
    saveSettings();
    scene.setStyle(patch);
    if (patch.skin) audio.setDealerGender(!!REAL_SKINS[patch.skin]?.female);
    refreshMyHands();
  },
  applyAudio(patch) { Object.assign(settings.audio, patch); audio.configure(settings.audio); saveSettings(); buildTopbar(); },
  applySpeed(k) { settings.speed = k; scene.speed = SPEEDS[k] ?? 1; saveSettings(); },
  applyQuality(k) {
    settings.quality = k;
    if (k === 'auto') settings.autoQuality = detectQuality();
    saveSettings();
    const p = QUALITY[currentQualityKey()];
    scene.applyQuality(p, true);
  },
  applyCountSystem(k) { settings.countSystem = k; engine.setCountSystem(k); saveSettings(); updateCount(); },
  resetBank() { setBank(settings.startBank); stats.resets++; saveStats(); updateBetButtons(); },
  newShoe() { if (S.phase !== 'betting') return toast('Attends la fin de la donne'); engine.newShoe(); scene.setDiscard(0); updateShoe(); updateCount(); toast('Nouveau sabot mélangé'); },
  isBetting: () => S.phase === 'betting',
  track,
  currentSituation,
};
const panels = new Panels(app);
const drills = new Drills(app);


// ------------------------------------------------------------------ Démarrage
async function start() {
  buildTopbar();
  buildCamCtl();
  buildChips();
  setBank(bank, false);
  if (settings.fixedView) scene.setFixed(true, false);
  setLoad(0.45, 'Arrivée du croupier…');
  await scene.dealerReady;
  setLoad(0.9, 'Mélange du sabot…');
  scene.dealer.root.updateMatrixWorld(true);
  await new Promise((r) => setTimeout(r, 250));
  setLoad(1, 'Prêt');
  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').remove(), 700);
  $('#app').classList.remove('phase-loading');
  S.phase = 'betting';
  showDock('bet');
  refreshSeats();
  refreshLabels();
  updateCount();
  updateBetButtons();
  if (!settings.welcomed) panels.welcome();
  track('start', TRACK_SRC);
  const q = new URLSearchParams(location.search);
  if (q.get('drill')) drills.open(q.get('drill'));
  if (q.get('mode') && MODES[q.get('mode')]) setMode(q.get('mode'));
}
start();

// Application installable / hors ligne (pas dans l'appli de bureau)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.sabotDesktop) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
// Dans l'appli de bureau, le logo ouvre le site dans le navigateur
if (window.sabotDesktop) {
  const b = $('.brand');
  b.href = 'https://blackjack-play.app/';
  b.target = '_blank';
}

// Accès debug / captures
window.sabot = { app, scene, get engine() { return engine; }, S, deal, placeChip, chooseAction, settings };
