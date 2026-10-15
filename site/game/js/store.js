// Sauvegarde locale : réglages, banque fictive et statistiques.
import { DEFAULT_RULES } from './rules.js';

export const KEYS = { settings: 'sabot.settings.v1', stats: 'sabot.stats.v1', bank: 'sabot.bank.v1' };

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const DEFAULT_SETTINGS = {
  rules: { ...DEFAULT_RULES },
  mode: 'libre',               // libre | coach | comptage
  seats: [null, null, 'player', null, null],
  countSystem: 'hilo',
  showCount: false,
  deviations: true,
  adviceMode: 'after',         // before | after | off
  confirmMistakes: true,       // en mode coach : demande confirmation avant une erreur
  quizEvery: 0,                // 0 = jamais, sinon toutes les N donnes
  quizAtShuffle: false,
  speed: 'normal',             // lent | normal | rapide | eclair
  autoRebet: false,
  showTotals: true,
  showSpread: false,
  unit: 10,
  startBank: 5000,
  quality: 'auto',
  style: { indices: 'fr', back: 'bordeaux', felt: 'vert', skin: 'gilet' },
  audio: { master: 0.8, sfx: 0.8, voice: 0.9, voiceLevel: 'essentiel', ambience: false, ambienceVol: 0.35, muted: false },
  welcomed: false,
};

export function loadSettings() {
  const s = load(KEYS.settings, {});
  if (s.adviceMode && !['before', 'after', 'off'].includes(s.adviceMode)) s.adviceMode = 'after';
  return {
    ...DEFAULT_SETTINGS, ...s,
    rules: { ...DEFAULT_SETTINGS.rules, ...(s.rules || {}) },
    style: { ...DEFAULT_SETTINGS.style, ...(s.style || {}) },
    audio: { ...DEFAULT_SETTINGS.audio, ...(s.audio || {}) },
    seats: Array.isArray(s.seats) && s.seats.length === 5 ? s.seats : [...DEFAULT_SETTINGS.seats],
  };
}

export function emptyStats() {
  return {
    version: 1, created: Date.now(),
    rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, surrenders: 0,
    doubles: 0, splits: 0, insurances: 0, wagered: 0, net: 0, biggestWin: 0, biggestLoss: 0,
    streak: 0, bestStreak: 0, worstStreak: 0,
    bankHistory: [],
    decisions: { hard: { ok: 0, n: 0 }, soft: { ok: 0, n: 0 }, pair: { ok: 0, n: 0 }, insurance: { ok: 0, n: 0 }, deviation: { ok: 0, n: 0 } },
    cells: {},                 // 'hard:16:10' -> { ok, n }
    mistakes: [],
    countQuiz: { n: 0, ok: 0, absErr: 0 },
    drills: { flash: { n: 0, ok: 0, best: 0 }, countdown: [], tc: { n: 0, ok: 0 }, deviations: { n: 0, ok: 0 } },
    sessions: [],
    playMs: 0,
    resets: 0,
  };
}

export function loadStats() {
  const s = load(KEYS.stats, null);
  if (!s || s.version !== 1) return emptyStats();
  const e = emptyStats();
  return { ...e, ...s, decisions: { ...e.decisions, ...s.decisions }, drills: { ...e.drills, ...s.drills }, countQuiz: { ...e.countQuiz, ...s.countQuiz } };
}

export function saveStats(s) {
  if (s.bankHistory.length > 1500) s.bankHistory = s.bankHistory.slice(-1500);
  if (s.mistakes.length > 120) s.mistakes = s.mistakes.slice(-120);
  if (s.sessions.length > 200) s.sessions = s.sessions.slice(-200);
  if (s.drills.countdown.length > 100) s.drills.countdown = s.drills.countdown.slice(-100);
  save(KEYS.stats, s);
}

export function exportAll() {
  return JSON.stringify({ app: 'sabot', at: new Date().toISOString(), settings: load(KEYS.settings, null), stats: load(KEYS.stats, null), bank: load(KEYS.bank, null) }, null, 2);
}

export function importAll(text) {
  const d = JSON.parse(text);
  if (d.app !== 'sabot') throw new Error('Fichier non reconnu');
  if (d.settings) save(KEYS.settings, d.settings);
  if (d.stats) save(KEYS.stats, d.stats);
  if (d.bank != null) save(KEYS.bank, d.bank);
}
