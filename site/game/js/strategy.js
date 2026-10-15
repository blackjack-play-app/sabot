// Stratégie de base calculée selon les règles + déviations (Illustrious 18 / Fab 4, Hi-Lo).
import { handTotal } from './cards.js';

export const ACTION_LABEL = { H: 'Carte', S: 'Rester', D: 'Doubler', P: 'Séparer', R: 'Abandonner' };
const UP_LABEL = (up) => (up === 11 ? 'un as' : up === 10 ? 'un 10' : 'un ' + up);

// ----- Codes de tableau -----
// H tirer, S rester, D doubler sinon tirer, Ds doubler sinon rester, P séparer,
// Rh abandonner sinon tirer, Rs abandonner sinon rester.

export function hardCode(total, up, r) {
  const d1 = r.decks === 1, d2 = r.decks <= 2, h17 = r.dealerHitsSoft17, enhc = !r.holeCard;
  if (total <= 7) return 'H';
  if (total === 8) return d1 && (up === 5 || up === 6) ? 'D' : 'H';
  if (total === 9) {
    if (up >= 3 && up <= 6) return 'D';
    if (up === 2 && d2) return 'D';
    return 'H';
  }
  if (total === 10) {
    if (enhc && up >= 10) return 'H';
    return up <= 9 ? 'D' : 'H';
  }
  if (total === 11) {
    if (enhc && up >= 10) return 'H';
    if (up <= 10) return 'D';
    return h17 || d2 ? 'D' : 'H';
  }
  if (total === 12) return up >= 4 && up <= 6 ? 'S' : 'H';
  if (total <= 16) {
    if (up <= 6) return 'S';
    if (total === 16 && (up === 10 || up === 11)) return 'Rh';
    if (total === 16 && up === 9 && !d2) return 'Rh';
    if (total === 15 && up === 10) return 'Rh';
    if (total === 15 && up === 11 && h17) return 'Rh';
    return 'H';
  }
  if (total === 17 && up === 11 && h17) return 'Rs';
  return 'S';
}

export function softCode(total, up, r) {
  const d1 = r.decks === 1, h17 = r.dealerHitsSoft17;
  if (total >= 20) return 'S';
  if (total === 19) return (up === 6 && (h17 || d1)) ? 'Ds' : 'S';
  if (total === 18) {
    if (up >= 3 && up <= 6) return 'Ds';
    if (up === 2) return h17 ? 'Ds' : 'S';
    if (up === 7 || up === 8) return 'S';
    if (up === 11 && d1 && !h17) return 'S';
    return 'H';
  }
  if (total === 17) return (up >= 3 && up <= 6) || (d1 && up === 2) ? 'D' : 'H';
  if (total === 15 || total === 16) return up >= 4 && up <= 6 ? 'D' : 'H';
  if (total === 13 || total === 14) return (up === 5 || up === 6) || (d1 && up === 4) ? 'D' : 'H';
  return 'H'; // soft 12 = paire d'as non séparée
}

// Renvoie 'P' ou null (alors on joue le total).
export function pairCode(v, up, r) {
  const das = r.das, enhc = !r.holeCard;
  switch (v) {
    case 11: return enhc && up === 11 ? null : 'P';
    case 10: return null;
    case 9: return (up <= 6 || up === 8 || up === 9) ? 'P' : null;
    case 8: return enhc && up === 11 ? null : 'P';
    case 7: return up <= 7 || (r.decks === 1 && das && up === 8) ? 'P' : null;
    case 6: return das ? (up <= 6 ? 'P' : null) : (up >= 3 && up <= 6 ? 'P' : null);
    case 5: return null;
    case 4: return das && (up === 5 || up === 6) ? 'P' : null;
    case 3:
    case 2: return das ? (up <= 7 ? 'P' : null) : (up >= 4 && up <= 7 ? 'P' : null);
  }
  return null;
}

function resolve(code, ctx) {
  switch (code) {
    case 'D': return ctx.canDouble ? 'D' : 'H';
    case 'Ds': return ctx.canDouble ? 'D' : 'S';
    case 'Rh': return ctx.canSurrender ? 'R' : 'H';
    case 'Rs': return ctx.canSurrender ? 'R' : 'S';
    default: return code;
  }
}

// ----- Déviations Hi-Lo (compte réel) -----
// ge : appliquer si TC >= tc ; le : appliquer si TC <= tc ; lt : si TC < tc
export const DEVIATIONS = [
  // Fab 4 (abandon)
  { key: 'h14', up: 10, a: 'R', tc: 3, op: 'ge', name: '14 contre 10 : abandon à +3' },
  { key: 'h15', up: 10, a: 'R', tc: 0, op: 'ge', name: '15 contre 10 : abandon à 0' },
  { key: 'h15', up: 9, a: 'R', tc: 2, op: 'ge', name: '15 contre 9 : abandon à +2' },
  { key: 'h15', up: 11, a: 'R', tc: 1, op: 'ge', name: '15 contre as : abandon à +1' },
  // Illustrious 18
  { key: 'h16', up: 10, a: 'S', tc: 0, op: 'ge', name: '16 contre 10 : rester à 0 ou plus' },
  { key: 'h15', up: 10, a: 'S', tc: 4, op: 'ge', name: '15 contre 10 : rester à +4' },
  { key: 'p10', up: 5, a: 'P', tc: 5, op: 'ge', name: '10-10 contre 5 : séparer à +5' },
  { key: 'p10', up: 6, a: 'P', tc: 4, op: 'ge', name: '10-10 contre 6 : séparer à +4' },
  { key: 'h10', up: 10, a: 'D', tc: 4, op: 'ge', name: '10 contre 10 : doubler à +4' },
  { key: 'h12', up: 3, a: 'S', tc: 2, op: 'ge', name: '12 contre 3 : rester à +2' },
  { key: 'h12', up: 2, a: 'S', tc: 3, op: 'ge', name: '12 contre 2 : rester à +3' },
  { key: 'h11', up: 11, a: 'D', tc: 1, op: 'ge', name: '11 contre as : doubler à +1' },
  { key: 'h9', up: 2, a: 'D', tc: 1, op: 'ge', name: '9 contre 2 : doubler à +1' },
  { key: 'h10', up: 11, a: 'D', tc: 4, op: 'ge', name: '10 contre as : doubler à +4' },
  { key: 'h9', up: 7, a: 'D', tc: 3, op: 'ge', name: '9 contre 7 : doubler à +3' },
  { key: 'h16', up: 9, a: 'S', tc: 5, op: 'ge', name: '16 contre 9 : rester à +5' },
  { key: 'h13', up: 2, a: 'H', tc: -1, op: 'le', name: '13 contre 2 : tirer à -1 ou moins' },
  { key: 'h12', up: 4, a: 'H', tc: 0, op: 'lt', name: '12 contre 4 : tirer sous 0' },
  { key: 'h12', up: 5, a: 'H', tc: -2, op: 'le', name: '12 contre 5 : tirer à -2' },
  { key: 'h12', up: 6, a: 'H', tc: -1, op: 'le', name: '12 contre 6 : tirer à -1' },
  { key: 'h13', up: 3, a: 'H', tc: -2, op: 'le', name: '13 contre 3 : tirer à -2' },
];
export const INSURANCE_TC = 3;

function devMatches(d, tc) {
  if (d.op === 'ge') return tc >= d.tc;
  if (d.op === 'le') return tc <= d.tc;
  return tc < d.tc;
}

// ----- Recommandation principale -----
// ctx : { canDouble, canSplit, canSurrender, tc (compte réel Hi-Lo), deviations }
export function recommend(cards, up, r, ctx) {
  const { total, soft } = handTotal(cards);
  const isPair = cards.length === 2 && cards[0].value === cards[1].value;
  let code = null, kind;

  if (isPair && ctx.canSplit && (r.splitAnyTen || cards[0].rank === cards[1].rank)) {
    const p = pairCode(cards[0].value, up, r);
    if (p) { code = p; kind = 'pair'; }
  }
  if (!code) {
    if (soft) { code = softCode(total, up, r); kind = 'soft'; }
    else { code = hardCode(total, up, r); kind = 'hard'; }
  }
  // Abandon anticipé : situations supplémentaires
  if (r.surrender === 'early' && ctx.canSurrender && !soft) {
    if (up === 11 && ((total >= 5 && total <= 7) || (total >= 12 && total <= 17)) && !(isPair && cards[0].value === 11)) code = 'R';
    if (up === 10 && total >= 14 && total <= 16) code = 'R';
    if (isPair && cards[0].value === 8 && up === 11) code = 'R';
  }

  let action = resolve(code, ctx);
  const base = action;
  let deviation = null;

  if (ctx.deviations && typeof ctx.tc === 'number' && cards.length >= 2) {
    const key = isPair && cards[0].value === 10 ? 'p10' : (!soft ? 'h' + total : null);
    if (key) {
      for (const d of DEVIATIONS) {
        if (d.key !== key || d.up !== up) continue;
        if (d.a === 'R' && !ctx.canSurrender) continue;
        if (d.a === 'D' && !ctx.canDouble) continue;
        if (d.a === 'P' && !ctx.canSplit) continue;
        if (d.a === 'S' && base === 'R') continue;
        if (devMatches(d, ctx.tc)) {
          if (d.a !== action) { action = d.a; deviation = d; }
          break;
        }
      }
    }
  }

  return { action, base, code, kind, total, soft, deviation, reason: explain(action, { total, soft, isPair, card: cards[0], up, deviation, kind }) };
}

export function shouldInsure(tc, deviations) {
  return !!deviations && typeof tc === 'number' && tc >= INSURANCE_TC;
}

// ----- Explications pédagogiques -----
function explain(action, s) {
  const up = UP_LABEL(s.up);
  const weak = s.up >= 2 && s.up <= 6;
  if (s.deviation) {
    return `Déviation au compte : ${s.deviation.name}. Le sabot est ${s.deviation.tc >= 0 && s.deviation.op === 'ge' ? 'riche en grosses cartes' : 'riche en petites cartes'}, la stratégie de base ne suffit plus.`;
  }
  if (s.kind === 'pair' && action === 'P') {
    const v = s.card.value;
    if (v === 11) return 'Toujours séparer les as : chaque as a de bonnes chances de devenir 21.';
    if (v === 8) return 'Toujours séparer les 8 : 16 est la pire main, deux mains de 8 valent beaucoup mieux.';
    if (v === 9) return `Deux 9 font 18, mais contre ${up} chaque 9 part mieux seul : sépare.`;
    return `Paire de ${v} contre ${up} : le croupier est fragile, séparer te permet de miser plus quand tu es en position de force.`;
  }
  switch (action) {
    case 'R':
      return `${s.total} contre ${up} est une main où tu perds en moyenne plus de 50 % de ta mise. Abandonner te rend la moitié : c'est la perte la plus faible.`;
    case 'D':
      if (s.soft) return `Main souple ${s.total} contre ${up} : tu ne peux pas sauter avec une carte, et le croupier est en difficulté. Double pour gagner plus.`;
      if (s.total === 11) return `11 est la meilleure main pour doubler : beaucoup de cartes valent 10. Contre ${up}, double.`;
      return `Avec ${s.total}, une grosse carte te donne une main solide, et ${up} est une carte faible pour le croupier : double ta mise.`;
    case 'S':
      if (s.soft) return `${s.total} souple est une bonne main contre ${up}. Reste.`;
      if (s.total >= 17) return `${s.total} : le risque de sauter en tirant est trop grand. Reste.`;
      if (weak) return `Le croupier montre ${up} : il doit tirer et risque de sauter (environ 40 %). Ne prends aucun risque, laisse-le se brûler.`;
      return `Reste sur ${s.total} contre ${up}.`;
    case 'H':
      if (s.soft) return `${s.total} souple ne peut pas sauter avec une carte : tire pour améliorer ta main.`;
      if (s.total <= 11) return `Avec ${s.total} tu ne peux pas sauter : tire.`;
      if (!weak) return `Le croupier montre ${up} : il finira souvent à 17 ou plus. Avec ${s.total} tu perds en restant, il faut tirer malgré le risque.`;
      return `${s.total} contre ${up} : tire.`;
  }
  return '';
}

// Tableau complet pour affichage (lignes x colonnes 2..A)
export function buildChart(r) {
  const ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const hard = [], soft = [], pairs = [];
  for (let t = 17; t >= 5; t--) hard.push({ label: t === 17 ? '17+' : String(t), cells: ups.map((u) => hardCode(t, u, r)) });
  for (let t = 20; t >= 13; t--) soft.push({ label: 'A,' + (t - 11), cells: ups.map((u) => softCode(t, u, r)) });
  for (const v of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) {
    const lbl = v === 11 ? 'A,A' : v === 10 ? '10,10' : v + ',' + v;
    pairs.push({ label: lbl, cells: ups.map((u) => pairCode(v, u, r) || (v === 11 ? softCode(12, u, r) : hardCode(v * 2, u, r))) });
  }
  return { ups, hard, soft, pairs };
}
