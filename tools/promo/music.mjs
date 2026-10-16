// Rend la musique d'ambiance du jeu (lounge jazz) dans un fichier WAV : node tools/promo/music.mjs sortie.wav secondes [style]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [out, secs = '40', style = 'jazz'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
await p.goto('http://localhost:8080/game/');
const b64 = await p.evaluate(async (secs, style) => {
  const { Music } = await import('/game/js/music.js');
  const sr = 44100, ctx = new OfflineAudioContext(2, sr * secs, sr);
  const m = new Music(ctx, ctx.destination);
  m.out.gain.value = 1.6; m.style = style; m.tempo = style === 'calme' ? 66 : 92;
  m.prog = [[50, 'm9'], [55, 'dom13'], [48, 'maj9'], [45, 'dom7b9'], [50, 'm9'], [55, 'dom13'], [48, 'maj69'], [48, 'maj69']];
  const beat = 60 / m.tempo; let t = 0.05;
  for (m.bar = 0; t < secs; m.bar++) { const [r, ty] = m.prog[m.bar % 8]; const [nr] = m.prog[(m.bar + 1) % 8]; style === 'calme' ? m.barCalm(t, beat, r, ty) : m.barJazz(t, beat, r, ty, nr); t += beat * 4; }
  const buf = await ctx.startRendering();
  const n = buf.length, data = new DataView(new ArrayBuffer(44 + n * 4));
  const W = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  W(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); W(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); W(36, 'data'); data.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) { data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  let s = ''; const u8 = new Uint8Array(data.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}, Number(secs), style);
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
await b.close();
