// Moteur de partie : indépendant de l'affichage. L'interface se branche via l'objet `io`.
import { Shoe, handTotal, isBlackjack, countTag, initialCount } from './cards.js';
import { recommend, shouldInsure } from './strategy.js';

let HAND_ID = 1;

export class Hand {
  constructor(seat, bet) {
    this.id = HAND_ID++;
    this.seat = seat;          // index de place 0..4
    this.owner = 'player';     // 'player' | 'bot'
    this.cards = [];
    this.bet = bet;
    this.originalBet = bet;
    this.doubled = false;
    this.fromSplit = false;
    this.splitAces = false;
    this.surrendered = false;
    this.insurance = 0;
    this.done = false;
    this.result = null;        // 'win' | 'lose' | 'push' | 'blackjack' | 'surrender' | 'bust'
    this.net = 0;
    this.splitIndex = 0;       // position de la main dans la place après séparation
  }
  get total() { return handTotal(this.cards); }
  get isBlackjack() { return !this.fromSplit && isBlackjack(this.cards); }
  get busted() { return this.total.total > 21; }
}

const noop = () => {};
const DEFAULT_IO = {
  onShuffle: noop, onBurn: noop, onRoundStart: noop, onDeal: noop, onReveal: noop, onPeek: noop,
  onSplit: noop, onDouble: noop, onSurrender: noop, onHandDone: noop, onActiveHand: noop,
  onDealerTurn: noop, onSettle: noop, onRoundEnd: noop, onInsurance: noop,
  askInsurance: () => false, askEarlySurrender: () => false,
  getAction: () => 'S', canAfford: () => true, botDelay: noop,
};

export class BlackjackEngine {
  constructor(rules, io = {}, opts = {}) {
    this.rules = { ...rules };
    this.io = { ...DEFAULT_IO, ...io };
    this.countSystem = opts.countSystem || 'hilo';
    this.rng = opts.rng;
    this.newShoe();
    this.dealer = { cards: [], holeHidden: false };
    this.hands = [];
    this.inRound = false;
  }

  newShoe() {
    this.shoe = new Shoe({ decks: this.rules.decks, penetration: this.rules.penetration, csm: this.rules.csm, rng: this.rng });
    this.resetCounts();
    this.freshShoe = true;
  }

  setRules(rules) {
    const needNew = rules.decks !== this.rules.decks;
    this.rules = { ...rules };
    if (needNew) this.newShoe();
    else { this.shoe.penetration = rules.penetration; this.shoe.csm = rules.csm; this.shoe.cutIndex = Math.floor(this.shoe.total * rules.penetration); }
  }

  setCountSystem(sys) {
    this.countSystem = sys;
    // Recalcule le compte avec les cartes déjà vues.
    this.runningCount = initialCount(sys, this.rules.decks);
    for (const c of this.seenCards) this.runningCount += countTag(sys, c);
  }

  resetCounts() {
    this.runningCount = initialCount(this.countSystem, this.rules.decks);
    this.hiloCount = 0;
    this.seenCards = [];
    this.acesSeen = 0;
  }

  // Cartes visibles -> comptes
  see(card) {
    this.runningCount += countTag(this.countSystem, card);
    this.hiloCount += countTag('hilo', card);
    if (card.rank === 'A') this.acesSeen++;
    this.seenCards.push(card);
  }

  get decksRemaining() { return Math.max(0.25, this.shoe.decksRemaining); }
  get trueCount() { return this.hiloCount / this.decksRemaining; }
  get systemTrueCount() { return this.runningCount / this.decksRemaining; }

  dealerUp() { return this.dealer.cards[0]; }

  options(hand) {
    const r = this.rules;
    const { total } = hand.total;
    const n = hand.cards.length;
    const seatHands = this.hands.filter((h) => h.seat === hand.seat).length;
    const lockedAces = hand.splitAces && !r.hitSplitAces;
    const canHit = total < 21 && !lockedAces;
    let doubleOk = r.doubleOn === 'any' || (r.doubleOn === '9-11' && !hand.total.soft && total >= 9 && total <= 11)
      || (r.doubleOn === '10-11' && !hand.total.soft && total >= 10 && total <= 11);
    const canDouble = n === 2 && total < 21 && doubleOk && !lockedAces && (!hand.fromSplit || r.das) && this.io.canAfford(hand.originalBet, hand);
    const pair = n === 2 && hand.cards[0].value === hand.cards[1].value && (r.splitAnyTen || hand.cards[0].rank === hand.cards[1].rank);
    const aces = pair && hand.cards[0].rank === 'A';
    const canSplit = pair && seatHands < r.maxSplitHands && (!aces || !hand.fromSplit || r.resplitAces) && this.io.canAfford(hand.originalBet, hand);
    const canSurrender = r.surrender !== 'none' && n === 2 && !hand.fromSplit;
    return { H: canHit, S: true, D: canDouble, P: canSplit, R: canSurrender };
  }

  advise(hand, deviations = true) {
    const o = this.options(hand);
    return recommend(hand.cards, this.dealerUp().value, this.rules, {
      canDouble: o.D, canSplit: o.P, canSurrender: o.R, tc: this.trueCount, deviations,
    });
  }

  async draw(target, faceUp = true) {
    const card = this.shoe.draw();
    if (target === 'dealer') {
      this.dealer.cards.push(card);
      await this.io.onDeal(card, 'dealer', faceUp, this.dealer.cards.length - 1);
    } else {
      target.cards.push(card);
      await this.io.onDeal(card, target, faceUp, target.cards.length - 1);
    }
    if (faceUp) this.see(card);
    return card;
  }

  // seats : [{ index, owner, bet }]
  async playRound(seats) {
    const r = this.rules;
    this.inRound = true;

    if (this.shoe.needsShuffle || this.freshShoe) {
      if (!this.freshShoe) this.shoe.shuffle();
      this.freshShoe = false;
      this.resetCounts();
      await this.io.onShuffle(this.shoe);
      if (!r.csm) {
        const burn = this.shoe.draw();
        await this.io.onBurn(burn);
      }
    }

    this.dealer = { cards: [], holeHidden: false };
    this.hands = seats.filter((s) => s.bet > 0).sort((a, b) => a.index - b.index).map((s) => {
      const h = new Hand(s.index, s.bet);
      h.owner = s.owner || 'player';
      return h;
    });
    if (!this.hands.length) { this.inRound = false; return null; }
    await this.io.onRoundStart(this.hands);

    // Distribution : 2 tours
    for (let pass = 0; pass < 2; pass++) {
      for (const h of this.hands) await this.draw(h, true);
      if (pass === 0) await this.draw('dealer', true);
      else if (r.holeCard) { await this.draw('dealer', false); this.dealer.holeHidden = true; }
    }

    const up = this.dealerUp();
    let dealerBJ = false;

    // Assurance
    if (r.insurance && up.rank === 'A') {
      for (const h of this.hands) {
        if (!this.io.canAfford(h.originalBet / 2, h)) continue;
        let take;
        if (h.owner === 'bot') take = shouldInsure(this.trueCount, true);
        else take = await this.io.askInsurance(h);
        if (take) { h.insurance = h.originalBet / 2; await this.io.onInsurance(h); }
      }
    }

    // Abandon anticipé (avant vérification)
    if (r.surrender === 'early' && (up.value === 10 || up.value === 11)) {
      for (const h of this.hands) {
        if (h.isBlackjack) continue;
        let sur;
        if (h.owner === 'bot') sur = this.advise(h).action === 'R';
        else sur = await this.io.askEarlySurrender(h, this.advise(h));
        if (sur) { h.surrendered = true; h.done = true; await this.io.onSurrender(h); }
      }
    }

    // Vérification de la carte cachée
    if (r.holeCard && (up.value === 10 || up.value === 11)) {
      dealerBJ = isBlackjack(this.dealer.cards);
      await this.io.onPeek(dealerBJ);
      if (dealerBJ) {
        this.dealer.holeHidden = false;
        this.see(this.dealer.cards[1]);
        await this.io.onReveal(this.dealer.cards[1]);
        return this.settle(true);
      }
    }

    // Jeu des mains
    for (let i = 0; i < this.hands.length; i++) {
      const h = this.hands[i];
      await this.playHand(h);
    }

    // Tour du croupier
    await this.io.onDealerTurn();
    if (r.holeCard) {
      this.dealer.holeHidden = false;
      this.see(this.dealer.cards[1]);
      await this.io.onReveal(this.dealer.cards[1]);
    } else {
      await this.draw('dealer', true);
    }
    dealerBJ = isBlackjack(this.dealer.cards);

    const live = this.hands.some((h) => !h.surrendered && !h.busted && !h.isBlackjack);
    if (live && !dealerBJ) {
      while (true) {
        const t = handTotal(this.dealer.cards);
        if (t.total < 17 || (t.total === 17 && t.soft && r.dealerHitsSoft17)) await this.draw('dealer', true);
        else break;
      }
    }
    return this.settle(dealerBJ);
  }

  async playHand(h) {
    if (h.done) return;
    await this.io.onActiveHand(h);
    // Main issue d'une séparation : 2e carte
    if (h.cards.length === 1) {
      await this.draw(h, true);
      if (h.splitAces && !this.rules.hitSplitAces) {
        const o = this.options(h);
        if (!o.P) { h.done = true; await this.io.onHandDone(h); return; }
      }
    }
    if (h.isBlackjack) { h.done = true; await this.io.onHandDone(h); return; }

    while (!h.done) {
      const t = h.total.total;
      if (t >= 21) { h.done = true; break; }
      const opts = this.options(h);
      if (!opts.H && !opts.P) { h.done = true; break; }
      let action;
      if (h.owner === 'bot') {
        await this.io.botDelay(h);
        action = this.advise(h).action;
        if (!opts[action]) action = 'S';
      } else {
        action = await this.io.getAction(h, opts);
        if (!opts[action]) continue;
      }

      if (action === 'H') {
        await this.draw(h, true);
      } else if (action === 'S') {
        h.done = true;
      } else if (action === 'D') {
        h.bet += h.originalBet;
        h.doubled = true;
        await this.io.onDouble(h);
        await this.draw(h, true);
        h.done = true;
      } else if (action === 'R') {
        h.surrendered = true;
        h.done = true;
        await this.io.onSurrender(h);
      } else if (action === 'P') {
        const nh = new Hand(h.seat, h.originalBet);
        nh.owner = h.owner;
        nh.fromSplit = true;
        h.fromSplit = true;
        const aces = h.cards[0].rank === 'A';
        nh.splitAces = aces;
        h.splitAces = aces;
        nh.cards.push(h.cards.pop());
        const idx = this.hands.indexOf(h);
        this.hands.splice(idx + 1, 0, nh);
        // Ré-indexe les mains de la place pour l'affichage
        this.hands.filter((x) => x.seat === h.seat).forEach((x, k) => { x.splitIndex = k; });
        await this.io.onSplit(h, nh);
        await this.draw(h, true);
        if (aces && !this.rules.hitSplitAces) {
          const o = this.options(h);
          if (!o.P) h.done = true;
        }
      }
      if (h.busted) h.done = true;
    }
    await this.io.onHandDone(h);
  }

  async settle(dealerBJ) {
    const r = this.rules;
    const dt = handTotal(this.dealer.cards).total;
    const dealerBust = dt > 21;
    let totalNet = 0;
    for (const h of this.hands) {
      let net = 0;
      const pt = h.total.total;
      if (h.surrendered) {
        net = -h.originalBet / 2; h.result = 'surrender';
        // Contre un blackjack sans carte cachée, l'abandon tardif ne protège pas.
        if (dealerBJ && !r.holeCard && r.surrender !== 'early') { net = -h.originalBet; h.result = 'lose'; }
      } else if (h.busted) { net = -h.bet; h.result = 'bust'; }
      else if (h.isBlackjack) {
        if (dealerBJ) { net = 0; h.result = 'push'; }
        else { net = h.originalBet * r.blackjackPays; h.result = 'blackjack'; }
      } else if (dealerBJ) {
        net = r.holeCard || !r.enhcOriginalBetsOnly ? -h.bet : -h.originalBet;
        h.result = 'lose';
      } else if (dealerBust || pt > dt) { net = h.bet; h.result = 'win'; }
      else if (pt === dt) { net = 0; h.result = 'push'; }
      else { net = -h.bet; h.result = 'lose'; }

      if (h.insurance) net += dealerBJ ? h.insurance * 2 : -h.insurance;
      h.net = net;
      totalNet += net;
    }
    const summary = { dealerTotal: dt, dealerBJ, dealerBust, hands: this.hands, net: totalNet };
    await this.io.onSettle(summary);
    for (const h of this.hands) this.shoe.discards.push(...h.cards);
    this.shoe.discards.push(...this.dealer.cards);
    this.inRound = false;
    await this.io.onRoundEnd(summary);
    return summary;
  }
}
