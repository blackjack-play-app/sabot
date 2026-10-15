// Génère les captures d'écran du site à partir du vrai jeu : node tools/screens.mjs [baseUrl]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:8080';
const outDir = path.resolve('tools/_screens');
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'],
});
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fresh(settingsPatch = {}, statsSeed = null) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(base + '/sw.js', { waitUntil: 'domcontentloaded' });
  await page.evaluate((patch, seed) => {
    localStorage.clear();
    const s = { welcomed: true, quality: 'ultra', ...patch };
    localStorage.setItem('sabot.settings.v1', JSON.stringify(s));
    if (seed) localStorage.setItem('sabot.stats.v1', JSON.stringify(seed));
  }, settingsPatch, statsSeed);
  await page.goto(base + '/game/', { waitUntil: 'networkidle0' });
  await sleep(3500);
  return page;
}

// Joue jusqu'à un moment précis. stopAt: 'decision' | 'settle' | 'none'
const playScript = (stopAt, seats, bets, stack, speed = 'rapide') => `(async () => {
  const w = (ms) => new Promise(r => setTimeout(r, ms));
  const s = window.sabot;
  s.app.applySpeed('${speed}');
  s.settings.seats = ${JSON.stringify(seats)};
  s.app.refreshSeats();
  const bets = ${JSON.stringify(bets)};
  for (let i = 0; i < 5; i++) for (const b of (bets[i] || [])) { s.S.chip = b; s.placeChip(i, 'add'); }
  ${stack ? `s.engine.freshShoe = false; s.engine.shoe.stack(${JSON.stringify(stack)});` : ''}
  s.deal();
  let n = 0;
  while (n++ < 400) {
    await w(120);
    if (s.S.resolveIns) s.S.resolveIns(false);
    if (s.S.resolveAction) {
      if ('${stopAt}' === 'decision' && s.S.activeHand && s.S.activeHand.cards.length >= 2 && !window.__skip) return 'decision';
      const adv = s.engine.advise(s.S.activeHand, true);
      s.chooseAction(adv.action);
    }
    if ('${stopAt}' === 'settle' && s.S.phase === 'settling' && s.S.roundResults) { await w(900); return 'settle'; }
    if (s.S.phase === 'betting' && n > 10) return 'end';
  }
  return 'timeout';
})()`;

async function shot(page, name) {
  await sleep(600);
  await page.screenshot({ path: path.join(outDir, name + '.png') });
  console.log('ok', name);
}

// 0. Héros propre : sans interface, pour le fond de la page d'accueil
if (process.argv[3] === 'hero') {
  const p = await fresh({ mode: 'libre', adviceMode: 'off', style: { felt: 'vert', skin: 'gilet', back: 'bordeaux' } });
  console.log(await p.evaluate(playScript('decision', [null, 'player', 'player', 'player', null], [[], [25, 25], [100, 25], [25, 5], []], ['10', '9', 'A', '6', '6', '5', '7', '8'])));
  await p.addStyleTag({ content: '.topbar,.dock,.myhands,.camctl,.coach,.toasts,.countbox{display:none!important} #labels{opacity:.95}' });
  await p.evaluate(`(() => { const s = window.sabot.scene; s.camera.position.set(0.55, 1.62, 1.95); s.controls.target.set(0.05, 1.0, -0.1); })()`);
  await shot(p, 'hero-clean');
  await browser.close();
  process.exit(0);
}
// 1. Héros : coach, 3 mains, décision en cours
{
  const p = await fresh({ mode: 'coach', adviceMode: 'before' });
  console.log(await p.evaluate(playScript('decision', [null, 'player', 'player', 'player', null], [[], [25, 25], [100], [25], []], ['10', '9', 'A', '6', '6', '5', '7', '8'])));
  await shot(p, 'hero');
  await p.close();
}
// 2. Cinq mains, résultats
{
  const p = await fresh({ mode: 'libre', adviceMode: 'after' });
  console.log(await p.evaluate(playScript('settle', ['player', 'player', 'player', 'player', 'player'], [[25], [25, 5], [100], [25], [25, 25]], ['8', '10', 'A', '9', '6', '7', '8', '10', 'K', '9', '5', '7'])));
  await shot(p, 'cinq-mains');
  await p.close();
}
// 3. Vue du dessus
{
  const p = await fresh({ mode: 'libre' });
  await p.evaluate(`window.sabot.scene.setView('plongee', true)`);
  console.log(await p.evaluate(playScript('decision', [null, 'bot', 'player', 'bot', 'player'], [[], [], [50], [], [25]], null)));
  await shot(p, 'vue-dessus');
  await p.close();
}
// 4. Comptage : table pleine, compte visible
{
  const p = await fresh({ mode: 'comptage', showCount: true, showSpread: true, seats: ['bot', 'bot', 'player', 'bot', 'bot'], style: { felt: 'bleu', skin: 'croupiere', back: 'marine' } });
  for (let k = 0; k < 2; k++) { console.log(await p.evaluate(`window.__skip = true;` + playScript('none', ['bot', 'bot', 'player', 'bot', 'bot'], [[], [], [25], [], []], null, 'eclair'))); }
  console.log(await p.evaluate(`window.__skip = false;` + playScript('decision', ['bot', 'bot', 'player', 'bot', 'bot'], [[], [], [25], [], []], null)));
  await shot(p, 'comptage');
  await p.close();
}
// 5. Croupier en gros plan (vue croupier inversée = joueurs) + tapis rouge
{
  const p = await fresh({ style: { felt: 'rouge', skin: 'smoking', back: 'noir' } });
  await p.evaluate(`window.sabot.scene.setView('premiere', true)`);
  console.log(await p.evaluate(playScript('decision', [null, null, 'player', 'player', null], [[], [], [100], [100], []], null)));
  await shot(p, 'premiere-base');
  await p.close();
}
// 6. Tableau de stratégie ouvert
{
  const p = await fresh({ mode: 'libre' });
  console.log(await p.evaluate(playScript('decision', [null, null, 'player', null, null], [[], [], [25], [], []], ['10', '6', '6'])));
  await p.evaluate(`document.querySelector('[aria-label="Tableau de stratégie (T)"]').click()`);
  await sleep(800);
  await shot(p, 'strategie');
  await p.close();
}
// 7. Exercice flash
{
  const p = await fresh({});
  await p.evaluate(`(async () => { document.querySelector('[aria-label="Exercices (E)"]').click(); await new Promise(r => setTimeout(r, 300)); document.querySelector('.drill-card').click(); })()`);
  await sleep(900);
  await shot(p, 'flash');
  await p.close();
}
// 8. Simulateur
{
  const p = await fresh({});
  await p.evaluate(`(async () => { document.querySelector('[aria-label="Exercices (E)"]').click(); await new Promise(r => setTimeout(r, 300)); document.querySelectorAll('.drill-card')[5].click(); await new Promise(r => setTimeout(r, 400)); const sel = document.querySelectorAll('.sim-form select'); sel[1].value = 'countdev'; document.querySelector('.drill-main .btn.deal').click(); })()`);
  await sleep(14000);
  await shot(p, 'simulateur');
  await p.close();
}
// 9. Statistiques (avec un historique de démonstration)
{
  const hist = []; let v = 5000;
  for (let i = 0; i < 220; i++) { v += Math.round((Math.random() - 0.47) * 60); hist.push({ t: Date.now() - (220 - i) * 60000, v }); }
  const seed = {
    version: 1, created: Date.now() - 864e5 * 6, rounds: 220, hands: 268, wins: 118, losses: 128, pushes: 22, blackjacks: 13, busts: 41, surrenders: 6,
    doubles: 31, splits: 9, insurances: 2, wagered: 9420, net: v - 5000, biggestWin: 250, biggestLoss: -300, streak: 2, bestStreak: 7, worstStreak: -6,
    bankHistory: hist, decisions: { hard: { ok: 171, n: 181 }, soft: { ok: 31, n: 38 }, pair: { ok: 17, n: 19 }, insurance: { ok: 9, n: 11 }, deviation: { ok: 6, n: 9 } },
    cells: { 'soft:18:9': { ok: 1, n: 4 }, 'hard:12:3': { ok: 2, n: 5 }, 'pair:9:7': { ok: 1, n: 3 }, 'hard:16:10': { ok: 3, n: 6 }, 'soft:17:2': { ok: 1, n: 2 } },
    mistakes: [{ t: Date.now(), cards: ['As', '7h'], up: 9, did: 'S', should: 'H', kind: 'soft' }, { t: Date.now(), cards: ['10s', '2d'], up: 3, did: 'S', should: 'H', kind: 'hard' }, { t: Date.now(), cards: ['9c', '9d'], up: 7, did: 'P', should: 'S', kind: 'pair' }],
    countQuiz: { n: 14, ok: 10, absErr: 6 }, drills: { flash: { n: 140, ok: 128, best: 31 }, countdown: [], tc: { n: 20, ok: 16 }, deviations: { n: 30, ok: 22, best: 9 } },
    sessions: [], playMs: 1000 * 60 * 147, resets: 0,
  };
  const p = await fresh({}, seed);
  await p.evaluate(`document.querySelector('[aria-label="Statistiques (S)"]').click()`);
  await sleep(900);
  await shot(p, 'stats');
  await p.close();
}
await browser.close();
