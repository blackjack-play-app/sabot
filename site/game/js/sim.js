// Simulateur : joue des milliers de mains en stratégie parfaite pour mesurer gain moyen et variance.
import { BlackjackEngine } from './engine.js';
import { mulberry32 } from './cards.js';

// spread : tableau trié [{ tc: -99, units: 1 }, { tc: 2, units: 2 }, ...]
export function betForTc(spread, tc, unit) {
  let units = spread[0]?.units ?? 1;
  for (const s of spread) if (Math.floor(tc) >= s.tc) units = s.units;
  return units * unit;
}

export async function runSimulation(cfg, onProgress) {
  const {
    rules, rounds = 100000, spots = 1, unit = 10, spread = [{ tc: -99, units: 1 }],
    deviations = false, wongOut = null, seed = Date.now() & 0xffffffff, bankroll = 10000,
  } = cfg;
  const rng = mulberry32(seed);
  let bank = bankroll, minBank = bankroll, ruined = false, ruinRound = null;
  let sum = 0, sumSq = 0, wagered = 0, initial = 0, handsPlayed = 0, roundsPlayed = 0;
  const res = { win: 0, lose: 0, push: 0, blackjack: 0, bust: 0, surrender: 0 };
  const curve = [];
  const curveEvery = Math.max(1, Math.floor(rounds / 400));
  let engine;
  engine = new BlackjackEngine(rules, {
    askInsurance: () => deviations && engine.trueCount >= 3,
    askEarlySurrender: (h, adv) => adv.action === 'R',
    getAction: (h) => engine.advise(h, deviations).action,
  }, { rng });

  for (let i = 0; i < rounds; i++) {
    const tc = engine.trueCount;
    if (wongOut !== null && tc < wongOut && !engine.shoe.needsShuffle) {
      // Le joueur quitte la table : on brûle une main fictive pour avancer le sabot.
      await engine.playRound([{ index: 0, owner: 'bot', bet: unit }]);
      continue;
    }
    const b = betForTc(spread, tc, unit);
    const seats = [];
    for (let s = 0; s < spots; s++) seats.push({ index: s, owner: 'player', bet: b });
    const sum0 = await engine.playRound(seats);
    roundsPlayed++;
    let net = 0;
    for (const h of sum0.hands) {
      handsPlayed++;
      wagered += h.bet;
      if (!h.fromSplit || h.splitIndex === 0) initial += h.originalBet;
      res[h.result] = (res[h.result] || 0) + 1;
    }
    net = sum0.net;
    sum += net; sumSq += net * net;
    bank += net;
    if (bank < minBank) minBank = bank;
    if (!ruined && bank <= 0) { ruined = true; ruinRound = roundsPlayed; }
    if (i % curveEvery === 0) curve.push(Math.round(bank));
    if (onProgress && i % 5000 === 0) await onProgress(i / rounds);
  }
  const mean = sum / roundsPlayed;
  const sd = Math.sqrt(Math.max(0, sumSq / roundsPlayed - mean * mean));
  // Risque de ruine (approximation diffusion) : exp(-2 * mu * B / sigma²)
  const ror = mean <= 0 ? 1 : Math.exp((-2 * mean * bankroll) / (sd * sd));
  return {
    rounds: roundsPlayed, handsPlayed, wagered, net: sum, evPerRound: mean, sdPerRound: sd,
    edgePct: (sum / initial) * 100, results: res, curve, finalBank: bank, minBank, ruined, ruinRound,
    ror, hourly: mean * 100, // ~100 tours par heure
  };
}
