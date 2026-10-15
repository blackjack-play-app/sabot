// Simulation dans un thread séparé pour ne pas figer l'interface.
import { runSimulation } from './sim.js';

self.onmessage = async (e) => {
  try {
    const result = await runSimulation(e.data, async (p) => { self.postMessage({ progress: p }); });
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
