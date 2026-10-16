// Studio promo : un robot joue de vraies mains (en suivant le coach) et la scène est filmée en vertical 1080×1920.
// Le temps du jeu est ralenti (×SLOW) pendant les captures d'écran pleine résolution, puis remis à vitesse normale au montage.
// node tools/promo/record.mjs <scenario> <dossier_sortie> [url]
// Scénarios : cinq (3 mains), coach (une erreur corrigée), quiz (pause sur une décision puis réponse du coach)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [scenario = 'quiz', outDir = 'promo-' + scenario, url = 'http://localhost:8080/game/?promo'] = process.argv.slice(2);
const W = 432, H = 768, DPR = 2.5, SLOW = 4;
fs.mkdirSync(outDir, { recursive: true });

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'],
});
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
const seats = scenario === 'cinq' ? [null, 'player', 'player', 'player', null] : [null, null, 'player', null, null];
await p.evaluateOnNewDocument((seats, scenario, SLOW) => {
  localStorage.setItem('bp.notrack', '1');
  localStorage.setItem('sabot.settings.v1', JSON.stringify({
    welcomed: true, mode: scenario === 'cinq' ? 'libre' : 'coach', adviceMode: scenario === 'coach' ? 'after' : 'off',
    confirmMistakes: false, seats, speed: 'normal', audio: { muted: true, music: false, voiceLevel: 'off' },
  }));
  // Horloge ralentie : tout le jeu (animations, minuteries) avance SLOW fois moins vite
  const realPerf = () => Performance.prototype.now.call(performance);
  const realDate = Date.now.bind(Date);
  const orig = { st: window.setTimeout.bind(window), si: window.setInterval.bind(window), raf: window.requestAnimationFrame.bind(window) };
  let f = 1, baseP = realPerf(), baseD = realDate(), refP = baseP, refD = baseD;
  window.__slow = (on) => {
    baseP = performance.now(); baseD = Date.now(); refP = realPerf(); refD = realDate();
    f = on ? SLOW : 1;
  };
  performance.now = () => baseP + (realPerf() - refP) / f;
  Date.now = () => baseD + (realDate() - refD) / f;
  window.setTimeout = (fn, ms = 0, ...a) => orig.st(fn, ms * f, ...a);
  window.setInterval = (fn, ms = 0, ...a) => orig.si(fn, ms * f, ...a);
  window.requestAnimationFrame = (cb) => orig.raf(() => cb(performance.now()));
}, seats, scenario, SLOW);

let slowF = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * slowF));
const log = [];
p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 7000));
const cdp = await p.createCDPSession();

// Ralenti + capture continue
await p.evaluate(() => window.__slow(true));
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
slowF = SLOW;
const t0 = await p.evaluate(() => performance.now());
const gameT = async () => ((await p.evaluate(() => performance.now())) - t0) / 1000;
const mark = async (what) => { const t = await gameT(); log.push({ t, what }); console.log(t.toFixed(2), what); };
let capturing = true, n = 0;
const frames = [];
const capture = (async () => {
  while (capturing) {
    const t = await gameT();
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: W, height: H, scale: DPR } });
    const f = String(n++).padStart(5, '0') + '.jpg';
    fs.promises.writeFile(`${outDir}/${f}`, Buffer.from(data, 'base64'));
    frames.push({ f, t });
  }
})();

const state = () => p.evaluate(() => ({
  betting: !document.querySelector('#dockBet')?.hidden,
  acting: !document.querySelector('#dockPlay')?.hidden && !!document.querySelector('#actions button'),
  rec: window.__rec ? window.__rec() : null,
  ins: !document.querySelector('#dockIns')?.hidden,
}));

await mark('debut');
await sleep(900);
const rounds = 3;
let quizDone = false, mistakeDone = false;
for (let r = 0; r < rounds && !(scenario === 'quiz' && quizDone); r++) {
  let s = await state();
  while (!s.betting) { await sleep(250); s = await state(); }
  if (r === 0) { for (let k = 0; k < 2; k++) { await p.evaluate(() => window.__bet()); await sleep(450); } }
  else await p.keyboard.press('r');
  await sleep(600);
  await mark('distribue');
  await p.keyboard.press('Space');
  if (r === 0 && scenario !== 'quiz') await p.evaluate(() => window.__view('premiere'));
  for (let guard = 0; guard < 120; guard++) {
    await sleep(300);
    s = await state();
    if (s.betting) break;
    if (s.ins) { await sleep(600); await p.keyboard.press('n'); continue; }
    if (!s.acting || !s.rec) continue;
    if (scenario === 'quiz' && !quizDone) {
      await sleep(800);
      const sit = await p.evaluate(() => document.querySelector('#playFor')?.innerText || '');
      await mark('question:' + sit.replace(/\s+/g, ' '));
      await sleep(4500);
      await p.keyboard.press('a');
      await mark('reponse:' + s.rec);
      await sleep(4000);
      quizDone = true;
    }
    if (scenario === 'coach' && !mistakeDone && s.rec !== 'S') {
      await sleep(1100);
      await mark('erreur:' + s.rec);
      await p.keyboard.press('s');
      mistakeDone = true;
      await sleep(4500);
      continue;
    }
    await sleep(scenario === 'cinq' ? 500 : 850);
    await p.keyboard.press({ H: 'h', S: 's', D: 'd', P: 'p', R: 'r' }[s.rec] || 's');
  }
  await mark('fin-donne');
  await sleep(1000);
}
await sleep(600);
await mark('fin');
capturing = false;
await capture;
// Liste ffconcat avec la durée (en temps de jeu) de chaque image
let txt = 'ffconcat version 1.0\n';
frames.forEach((fr, i) => { const d = i < frames.length - 1 ? frames[i + 1].t - fr.t : 0.033; txt += `file '${fr.f}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; });
fs.writeFileSync(`${outDir}/list.ffconcat`, txt);
fs.writeFileSync(`${outDir}/events.json`, JSON.stringify(log, null, 2));
console.log('images', frames.length, 'durée', frames.at(-1).t.toFixed(1), 's, soit', (frames.length / frames.at(-1).t).toFixed(1), 'img/s');
await b.close();
