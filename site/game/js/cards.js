// Cartes, sabot et systèmes de comptage.

export const SUITS = ['s', 'h', 'd', 'c']; // pique, coeur, carreau, trèfle
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED = { h: true, d: true };

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function makeCard(rank, suit) {
  return { rank, suit, value: cardValue(rank), id: rank + suit };
}

// Total d'une main : { total, soft } — soft = un as compté 11.
export function handTotal(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += c.value;
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards).total === 21;
}

// ---------- Systèmes de comptage ----------
// Valeurs indexées par valeur de carte 2..11 (11 = as). 'red7' traité à part.
export const COUNT_SYSTEMS = {
  hilo:   { name: 'Hi-Lo',        balanced: true,  level: 1, tags: { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1 },
            desc: 'Le plus utilisé au monde. 2-6 = +1, 7-9 = 0, 10/figures/as = -1.' },
  ko:     { name: 'KO (Knock-Out)', balanced: false, level: 1, tags: { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 0, 9: 0, 10: -1, 11: -1 },
            desc: 'Comme Hi-Lo mais le 7 vaut +1. Non équilibré : pas besoin de convertir en compte réel.' },
  hiopt1: { name: 'Hi-Opt I',     balanced: true,  level: 1, tags: { 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: 0 },
            desc: 'L\'as et le 2 sont neutres. Idéal avec un compte d\'as à part.' },
  hiopt2: { name: 'Hi-Opt II',    balanced: true,  level: 2, tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 0, 9: 0, 10: -2, 11: 0 },
            desc: 'Système à deux niveaux, plus précis mais plus exigeant.' },
  omega2: { name: 'Omega II',     balanced: true,  level: 2, tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: -1, 10: -2, 11: 0 },
            desc: 'Niveau 2, très efficace pour les décisions de jeu.' },
  zen:    { name: 'Zen Count',    balanced: true,  level: 2, tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: 0, 10: -2, 11: -1 },
            desc: 'Bon compromis entre précision des mises et du jeu.' },
  halves: { name: 'Wong Halves',  balanced: true,  level: 3, tags: { 2: 0.5, 3: 1, 4: 1, 5: 1.5, 6: 1, 7: 0.5, 8: 0, 9: -0.5, 10: -1, 11: -1 },
            desc: 'Valeurs en demi-points. Le plus précis, réservé aux experts.' },
  red7:   { name: 'Red Seven',    balanced: false, level: 1, tags: { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1 },
            desc: 'Hi-Lo + les 7 rouges valent +1. Non équilibré.' },
};

export function countTag(system, card) {
  const sys = COUNT_SYSTEMS[system] || COUNT_SYSTEMS.hilo;
  if (system === 'red7' && card.rank === '7' && RED[card.suit]) return 1;
  return sys.tags[card.value];
}

// Compte initial des systèmes non équilibrés (IRC).
export function initialCount(system, decks) {
  if (system === 'ko') return 4 - 4 * decks;
  if (system === 'red7') return -2 * decks;
  return 0;
}

// ---------- Générateur aléatoire (seedable pour le simulateur) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cryptoRandom() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

// ---------- Sabot ----------
export class Shoe {
  constructor({ decks = 6, penetration = 0.75, csm = false, rng = cryptoRandom } = {}) {
    this.decks = decks;
    this.penetration = penetration;
    this.csm = csm;
    this.rng = rng;
    this.cards = [];
    this.discards = [];
    this.pos = 0;
    this.build();
  }

  build() {
    this.cards = [];
    for (let d = 0; d < this.decks; d++)
      for (const s of SUITS)
        for (const r of RANKS) this.cards.push(makeCard(r, s));
    this.shuffle();
  }

  shuffle() {
    const a = this.cards;
    // Les cartes défaussées reviennent dans le sabot.
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    this.pos = 0;
    this.discards = [];
    // Carte de coupe : position où l'on remélange.
    this.cutIndex = Math.floor(a.length * this.penetration);
  }

  get total() { return this.cards.length; }
  get remaining() { return this.cards.length - this.pos; }
  get decksRemaining() { return this.remaining / 52; }
  get needsShuffle() { return this.csm || this.pos >= this.cutIndex; }

  draw() {
    if (this.pos >= this.cards.length) {
      // Cas extrême : on remélange les défausses en urgence.
      this.shuffle();
    }
    return this.cards[this.pos++];
  }

  // Pour forcer une main en mode entraînement : place ces cartes en tête.
  stack(ranks) {
    for (let k = 0; k < ranks.length; k++) {
      const want = ranks[k];
      const idx = this.cards.findIndex((c, i) => i >= this.pos + k && c.rank === want);
      if (idx >= 0) {
        const t = this.cards[this.pos + k];
        this.cards[this.pos + k] = this.cards[idx];
        this.cards[idx] = t;
      }
    }
  }
}
