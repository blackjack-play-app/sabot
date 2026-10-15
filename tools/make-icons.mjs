// Génère les icônes PNG (512/1024) depuis le logo SVG, via Chrome sans interface.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const svg = fs.readFileSync('site/assets/img/favicon.svg', 'utf8');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
for (const size of [1024, 512, 192]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `desktop/build/icon-${size}.png`, omitBackground: true });
}
await browser.close();
