// Quiz de stratégie de base : 20 situations tirées au hasard, réponse vérifiée avec le tableau du jeu.
(() => {
  const box = document.getElementById('quiz');
  const data = document.getElementById('quiz-chart');
  if (!box || !data) return;
  const chart = JSON.parse(data.textContent);
  const EN = document.documentElement.lang === 'en';
  const TXT = EN ? {
    q: 'Question', of: 'of', score: 'Score', you: 'Your hand', dealer: 'Dealer shows',
    acts: { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' },
    right: 'Correct!', wrong: 'Not quite.', best: 'Best play', next: 'Next hand', end: 'Your result',
    again: 'Play again', share: 'Share my score', copied: 'Link copied!', play: 'Practice at a 3D table',
    verdict: [[20, 'Perfect. You play like the math says.'], [17, 'Very strong: a few tricky hands left.'], [13, 'Solid basics, the soft hands and pairs need work.'], [0, 'Good start: learn the chart and try again.']],
    why: {
      H: 'Hit: your hand is too weak to stand against this dealer card.', S: 'Stand: let the dealer take the risk of busting.',
      D: 'Double: you are the favourite, put more money on it (hit if doubling is not allowed).', Ds: 'Double: you are the favourite (stand if doubling is not allowed).',
      P: 'Split: two separate hands are worth more than this pair together.', Rh: 'Surrender: losing half your bet costs less than playing it out (hit if not allowed).',
    },
    shareText: (s) => `I scored ${s}/20 on the blackjack basic strategy quiz. Can you beat me?`,
    total: (t, soft) => (soft ? 'soft ' : '') + t,
  } : {
    q: 'Question', of: 'sur', score: 'Score', you: 'Ta main', dealer: 'Le croupier montre',
    acts: { H: 'Carte', S: 'Rester', D: 'Doubler', P: 'Séparer', R: 'Abandonner' },
    right: 'Bonne réponse !', wrong: 'Pas tout à fait.', best: 'Le bon coup', next: 'Main suivante', end: 'Ton résultat',
    again: 'Rejouer', share: 'Partager mon score', copied: 'Lien copié !', play: 'S\'entraîner à une table 3D',
    verdict: [[20, 'Parfait. Tu joues exactement comme les maths.'], [17, 'Très fort : il reste quelques mains pièges.'], [13, 'Bonnes bases, les mains souples et les paires sont à revoir.'], [0, 'Bon début : apprends le tableau et retente ta chance.']],
    why: {
      H: 'Carte : ta main est trop faible pour rester contre cette carte du croupier.', S: 'Rester : laisse le croupier prendre le risque de sauter.',
      D: 'Doubler : tu es favori, mise plus (tirer si doubler est interdit).', Ds: 'Doubler : tu es favori (rester si doubler est interdit).',
      P: 'Séparer : deux mains séparées valent plus que cette paire ensemble.', Rh: 'Abandonner : perdre la moitié de ta mise coûte moins cher que de jouer la main (tirer si interdit).',
    },
    shareText: (s) => `J'ai fait ${s}/20 au quiz de stratégie du blackjack. Tu fais mieux ?`,
    total: (t, soft) => t + (soft ? ' souple' : ''),
  };
  const SUITS = ['♠', '♥', '♦', '♣'];
  const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const face = (v) => (v === 11 ? 'A' : v === 10 ? pick(['10', 'V', 'D', 'R'].map((x, i) => (EN ? ['10', 'J', 'Q', 'K'][i] : x))) : String(v));
  const card = (v) => { const s = pick(SUITS); return `<span class="qcard${s === '♥' || s === '♦' ? ' red' : ''}"><b>${face(v)}</b><i>${s}</i></span>`; };

  function deal() {
    const up = pick(UPS), col = UPS.indexOf(up), roll = Math.random();
    if (roll < 0.25) {
      const v = pick(UPS);
      const row = chart.pairs.find((r) => r.label === (v === 11 ? 'A,A' : v === 10 ? '10,10' : v + ',' + v));
      return { cards: [v, v], label: EN ? 'pair of ' + (v === 11 ? 'aces' : v + 's') : 'paire de ' + (v === 11 ? 'as' : v), up, code: row.cells[col] };
    }
    if (roll < 0.47) {
      const x = 2 + rnd(8);
      const row = chart.soft.find((r) => r.label === 'A,' + x);
      return { cards: [11, x], label: TXT.total(11 + x, true), up, code: row.cells[col] };
    }
    let a, b, t;
    do { t = 8 + rnd(10); a = 2 + rnd(9); b = t - a; } while (b < 2 || b > 10 || a === b);
    const row = chart.hard.find((r) => r.label === (t >= 17 ? '17+' : String(t)));
    return { cards: [a, b], label: TXT.total(t, false), up, code: row.cells[col] };
  }

  let n = 0, score = 0, cur = null, done = false;
  const act = (code) => code[0];
  function show() {
    cur = deal(); done = false;
    box.innerHTML = `<div class="qhead"><span>${TXT.q} ${n + 1} ${TXT.of} 20</span><span>${TXT.score} : <b>${score}</b></span></div>
      <div class="qbar"><i style="width:${(n / 20) * 100}%"></i></div>
      <div class="qtable"><div><p>${TXT.dealer}</p><div class="qcards">${card(cur.up)}<span class="qcard back"></span></div></div>
      <div><p>${TXT.you} <em>(${cur.label})</em></p><div class="qcards">${cur.cards.map(card).join('')}</div></div></div>
      <div class="qacts">${Object.entries(TXT.acts).filter(([k]) => k !== 'P' || cur.cards[0] === cur.cards[1]).map(([k, l]) => `<button class="btn" data-a="${k}">${l}</button>`).join('')}</div>
      <div class="qfb" aria-live="polite"></div>`;
    box.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a)));
  }
  function answer(a) {
    if (done) return;
    done = true;
    const good = act(cur.code) === a;
    if (good) score++;
    box.querySelectorAll('[data-a]').forEach((b) => { b.disabled = true; if (b.dataset.a === act(cur.code)) b.classList.add('good'); else if (b.dataset.a === a) b.classList.add('bad'); });
    box.querySelector('.qfb').innerHTML = `<p><b class="${good ? 'ok' : 'ko'}">${good ? TXT.right : TXT.wrong}</b> ${TXT.why[cur.code] || ''}</p><button class="btn btn-gold" id="qnext">${n === 19 ? TXT.end : TXT.next}</button>`;
    box.querySelector('.qhead b').textContent = score;
    document.getElementById('qnext').addEventListener('click', () => { n++; n >= 20 ? end() : show(); });
    document.getElementById('qnext').focus();
  }
  function end() {
    const v = TXT.verdict.find(([min]) => score >= min)[1];
    const url = location.origin + location.pathname + '?ref=quiz';
    box.innerHTML = `<div class="qend"><p>${TXT.end}</p><strong>${score}<small>/20</small></strong><p>${v}</p>
      <div class="qacts"><button class="btn btn-gold" id="qagain">${TXT.again}</button><button class="btn" id="qshare">${TXT.share}</button><a class="btn" href="${EN ? '/game/?lang=en&drill=flash' : '/game/?drill=flash'}">${TXT.play}</a></div></div>`;
    document.getElementById('qagain').onclick = () => { n = 0; score = 0; show(); };
    document.getElementById('qshare').onclick = async (e) => {
      const text = TXT.shareText(score);
      try { if (navigator.share) return await navigator.share({ text, url }); } catch { return; }
      try { await navigator.clipboard.writeText(text + ' ' + url); e.target.textContent = TXT.copied; } catch { /* ignoré */ }
    };
  }
  show();
})();
