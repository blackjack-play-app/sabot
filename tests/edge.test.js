import { runSimulation } from '../site/game/js/sim.js';
import { DEFAULT_RULES } from '../site/game/js/rules.js';
for (const [name, ru] of [['6D S17 DAS LS', DEFAULT_RULES], ['6D S17 DAS noLS', {...DEFAULT_RULES, surrender:'none'}], ['1D S17 noDAS', {...DEFAULT_RULES, decks:1, das:false, surrender:'none', penetration:0.6}]]) {
  const r = await runSimulation({ rules: ru, rounds: 2000000, seed: 123 });
  console.log(name, 'edge per initial bet %', (r.net/(r.rounds*10)*100).toFixed(3), '±', (r.sdPerRound/10/Math.sqrt(r.rounds)*100).toFixed(3));
}
