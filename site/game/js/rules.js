// Règles de table, préréglages et estimation de l'avantage de la maison.

export const DEFAULT_RULES = {
  decks: 6,
  dealerHitsSoft17: false,  // H17 si vrai, S17 sinon
  blackjackPays: 1.5,       // 1.5 = 3:2, 1.2 = 6:5, 1 = 1:1
  das: true,                // doubler après séparation
  doubleOn: 'any',          // 'any' | '9-11' | '10-11'
  maxSplitHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  splitAnyTen: true,        // séparer V+R par exemple
  surrender: 'late',        // 'none' | 'late' | 'early'
  holeCard: true,           // vrai = carte cachée + vérification (US) ; faux = sans carte cachée (Europe)
  enhcOriginalBetsOnly: false, // Europe : si vrai, on ne perd que la mise de base contre un blackjack
  insurance: true,
  penetration: 0.75,
  csm: false,               // mélangeur continu
  minBet: 10,
  maxBet: 1000,
};

export const PRESETS = {
  vegas: {
    label: 'Las Vegas Strip',
    desc: '6 jeux, croupier reste sur 17 souple, abandon tardif, 3:2.',
    rules: { decks: 6, dealerHitsSoft17: false, das: true, doubleOn: 'any', maxSplitHands: 4, resplitAces: true, surrender: 'late', holeCard: true, blackjackPays: 1.5 },
  },
  downtown: {
    label: 'Downtown Vegas',
    desc: '2 jeux, croupier tire sur 17 souple, pas d\'abandon.',
    rules: { decks: 2, dealerHitsSoft17: true, das: true, doubleOn: 'any', maxSplitHands: 4, resplitAces: false, surrender: 'none', holeCard: true, blackjackPays: 1.5, penetration: 0.7 },
  },
  atlantic: {
    label: 'Atlantic City',
    desc: '8 jeux, S17, abandon tardif, doubler après séparation.',
    rules: { decks: 8, dealerHitsSoft17: false, das: true, doubleOn: 'any', maxSplitHands: 4, resplitAces: false, surrender: 'late', holeCard: true, blackjackPays: 1.5 },
  },
  europe: {
    label: 'Casino français',
    desc: '6 jeux, sans carte cachée, doubler sur 9-11, pas d\'abandon.',
    rules: { decks: 6, dealerHitsSoft17: false, das: true, doubleOn: '9-11', maxSplitHands: 3, resplitAces: false, surrender: 'none', holeCard: false, enhcOriginalBetsOnly: false, blackjackPays: 1.5 },
  },
  singledeck: {
    label: 'Un seul jeu',
    desc: '1 jeu, H17, doubler sur 10-11, paie 6:5. Piège classique.',
    rules: { decks: 1, dealerHitsSoft17: true, das: false, doubleOn: '10-11', maxSplitHands: 2, resplitAces: false, surrender: 'none', holeCard: true, blackjackPays: 1.2, penetration: 0.6 },
  },
  online: {
    label: 'Sabot continu',
    desc: 'Mélangeur automatique : compter ne sert à rien. Bon pour la stratégie pure.',
    rules: { decks: 6, dealerHitsSoft17: false, das: true, doubleOn: 'any', maxSplitHands: 4, surrender: 'late', holeCard: true, csm: true, blackjackPays: 1.5 },
  },
};

// Approximation de l'avantage maison (en %) avec la stratégie de base.
// Base : 6 jeux, S17, DAS, pas d'abandon, carte cachée, 3:2.
export function houseEdge(r) {
  let e = 0.42;
  const deckAdj = { 1: -0.48, 2: -0.19, 3: -0.10, 4: -0.06, 5: -0.03, 6: 0, 7: 0.01, 8: 0.02 };
  e += deckAdj[r.decks] ?? 0;
  if (r.dealerHitsSoft17) e += 0.22;
  if (!r.das) e += 0.14;
  if (r.doubleOn === '9-11') e += 0.09;
  if (r.doubleOn === '10-11') e += 0.18;
  if (r.surrender === 'late') e -= 0.08;
  if (r.surrender === 'early') e -= 0.39;
  if (r.resplitAces) e -= 0.08;
  if (r.hitSplitAces) e -= 0.19;
  if (r.maxSplitHands <= 2) e += 0.10;
  else if (r.maxSplitHands === 3) e += 0.03;
  if (r.blackjackPays === 1.2) e += 1.39;
  if (r.blackjackPays === 1) e += 2.27;
  if (!r.holeCard) e += r.enhcOriginalBetsOnly ? 0.03 : 0.11;
  if (!r.splitAnyTen) e -= 0.0; // n'a d'effet qu'avec un jeu parfait
  return e;
}

export function payoutLabel(p) {
  if (p === 1.5) return '3 contre 2';
  if (p === 1.2) return '6 contre 5';
  if (p === 1) return '1 contre 1';
  return p + ' contre 1';
}

export function rulesSummary(r) {
  const parts = [];
  parts.push(r.decks + (r.decks > 1 ? ' jeux' : ' jeu'));
  parts.push(r.dealerHitsSoft17 ? 'H17' : 'S17');
  parts.push('BJ ' + payoutLabel(r.blackjackPays).replace(' contre ', ':'));
  parts.push(r.das ? 'DAS' : 'pas de DAS');
  if (r.doubleOn !== 'any') parts.push('double ' + r.doubleOn);
  if (r.surrender === 'late') parts.push('abandon');
  if (r.surrender === 'early') parts.push('abandon anticipé');
  if (!r.holeCard) parts.push('sans carte cachée');
  if (r.csm) parts.push('CSM');
  return parts.join(' · ');
}
