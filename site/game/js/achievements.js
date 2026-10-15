// Succès à débloquer : motivent sans pousser à « miser plus ».
export const ACHIEVEMENTS = [
  { id: 'premiere_main', title: 'Première donne', desc: 'Jouer sa première main.', test: (s) => s.hands >= 1 },
  { id: 'premier_bj', title: 'Blackjack !', desc: 'Obtenir un premier blackjack.', test: (s) => s.blackjacks >= 1 },
  { id: 'mains_100', title: 'Habitué de la table', desc: 'Jouer 100 mains.', test: (s) => s.hands >= 100 },
  { id: 'mains_1000', title: 'Pilier du casino', desc: 'Jouer 1 000 mains.', test: (s) => s.hands >= 1000 },
  { id: 'serie_20', title: 'Sans faute', desc: '20 bonnes décisions d\'affilée.', test: (s) => (s.bestDecisionStreak || 0) >= 20 },
  { id: 'serie_100', title: 'Machine à stratégie', desc: '100 bonnes décisions d\'affilée.', test: (s) => (s.bestDecisionStreak || 0) >= 100 },
  { id: 'cinq_mains', title: 'Toute la table', desc: 'Jouer 5 mains dans la même donne.', test: (s, c) => c && c.playerHands >= 5 },
  { id: 'split_double', title: 'Coup double', desc: 'Gagner les deux mains d\'une séparation.', test: (s, c) => c && c.splitWins },
  { id: 'compte_juste', title: 'Œil de lynx', desc: 'Réussir un quiz du compte.', test: (s) => s.countQuiz.ok >= 1 },
  { id: 'compte_10', title: 'Compteur confirmé', desc: 'Réussir 10 quiz du compte.', test: (s) => s.countQuiz.ok >= 10 },
  { id: 'flash_25', title: 'Réflexes', desc: 'Série de 25 au flash stratégie.', test: (s) => (s.drills.flash.best || 0) >= 25 },
  { id: 'paquet_30', title: 'Paquet éclair', desc: 'Décompter un paquet entier juste en moins de 30 s.', test: (s) => s.drills.countdown.some((x) => x.ok && x.n >= 49 && x.ms < 30000) },
  { id: 'deviations_10', title: 'Joueur avancé', desc: '10 bonnes réponses à l\'exercice des déviations.', test: (s) => (s.drills.deviations.ok || 0) >= 10 },
  { id: 'simulateur', title: 'Scientifique', desc: 'Lancer une simulation.', test: (s) => !!s.simRuns },
];

// Renvoie la liste des succès nouvellement débloqués.
export function checkAchievements(stats, ctx) {
  stats.achievements = stats.achievements || {};
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (stats.achievements[a.id]) continue;
    try {
      if (a.test(stats, ctx)) { stats.achievements[a.id] = Date.now(); fresh.push(a); }
    } catch { /* données incomplètes */ }
  }
  return fresh;
}
