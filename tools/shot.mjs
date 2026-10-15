// Capture d'écran automatisée : node tools/shot.mjs <url> <sortie.png> [largeur] [hauteur] [attente_ms] [script.js]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [url, out, w = 1600, h = 900, wait = 4000, scriptFile] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
if (process.env.MOBILE) {
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
} else await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, Number(wait)));
if (scriptFile) {
  const code = fs.readFileSync(scriptFile, 'utf8');
  const res = await page.evaluate(code);
  if (res !== undefined) logs.push('[eval] ' + JSON.stringify(res));
  await new Promise((r) => setTimeout(r, 1500));
}
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
