// Génération des textures (cartes, dos, tapis, jetons, moquette) sur canvas.
import * as THREE from 'three';
import { RED } from './cards.js';
import { payoutLabel } from './rules.js';

export const CARD_W = 0.076, CARD_H = 0.106; // cartes légèrement agrandies pour la lisibilité
const CW = 360, CH = Math.round(CW * CARD_H / CARD_W); // 503

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Dessine un symbole de couleur centré en (x,y), taille = hauteur.
export function drawSuit(ctx, suit, x, y, size, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.rotate(Math.PI);
  const s = size / 100;
  ctx.scale(s, s);
  ctx.beginPath();
  if (suit === 'h') {
    ctx.moveTo(0, 38);
    ctx.bezierCurveTo(-8, 28, -50, 2, -50, -22);
    ctx.bezierCurveTo(-50, -42, -34, -50, -24, -50);
    ctx.bezierCurveTo(-12, -50, -3, -42, 0, -32);
    ctx.bezierCurveTo(3, -42, 12, -50, 24, -50);
    ctx.bezierCurveTo(34, -50, 50, -42, 50, -22);
    ctx.bezierCurveTo(50, 2, 8, 28, 0, 38);
    ctx.fill();
  } else if (suit === 'd') {
    ctx.moveTo(0, -50);
    ctx.quadraticCurveTo(16, -18, 38, 0);
    ctx.quadraticCurveTo(16, 18, 0, 50);
    ctx.quadraticCurveTo(-16, 18, -38, 0);
    ctx.quadraticCurveTo(-16, -18, 0, -50);
    ctx.fill();
  } else if (suit === 's') {
    ctx.moveTo(0, -50);
    ctx.bezierCurveTo(-8, -36, -50, -14, -50, 10);
    ctx.bezierCurveTo(-50, 28, -36, 36, -24, 36);
    ctx.bezierCurveTo(-14, 36, -6, 30, -3, 24);
    ctx.quadraticCurveTo(-6, 42, -18, 50);
    ctx.lineTo(18, 50);
    ctx.quadraticCurveTo(6, 42, 3, 24);
    ctx.bezierCurveTo(6, 30, 14, 36, 24, 36);
    ctx.bezierCurveTo(36, 36, 50, 28, 50, 10);
    ctx.bezierCurveTo(50, -14, 8, -36, 0, -50);
    ctx.fill();
  } else if (suit === 'c') {
    ctx.arc(0, -24, 21, 0, Math.PI * 2);
    ctx.moveTo(-1, 10); ctx.arc(-23, 10, 21, 0, Math.PI * 2);
    ctx.moveTo(45, 10); ctx.arc(23, 10, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.lineTo(6, 26);
    ctx.quadraticCurveTo(8, 42, 18, 50);
    ctx.lineTo(-18, 50);
    ctx.quadraticCurveTo(-8, 42, -6, 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const PIPS = {
  2: [[0.5, 0.2], [0.5, 0.8]],
  3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
  4: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.8], [0.7, 0.8]],
  5: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.5], [0.3, 0.8], [0.7, 0.8]],
  6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  8: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.5, 0.65], [0.3, 0.8], [0.7, 0.8]],
  9: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.4], [0.7, 0.4], [0.5, 0.5], [0.3, 0.6], [0.7, 0.6], [0.3, 0.8], [0.7, 0.8]],
  10: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.3], [0.3, 0.4], [0.7, 0.4], [0.3, 0.6], [0.7, 0.6], [0.5, 0.7], [0.3, 0.8], [0.7, 0.8]],
};

const INDEX_FR = { J: 'V', Q: 'D', K: 'R' };
// Jeu « 4 couleurs » : chaque enseigne a sa couleur (plus rapide à lire, utile aux daltoniens)
let DECK_COLORS = 2;
export function setDeckColors(n) { DECK_COLORS = n; }
const FOUR = { s: '#16181d', h: '#b3202c', d: '#1f5fbf', c: '#1d7a3a' };
const FACE_COLORS = {
  J: { a: '#2f5d8a', b: '#c9a24a' },
  Q: { a: '#8a2f3c', b: '#c9a24a' },
  K: { a: '#2c4a36', b: '#c9a24a' },
};

export function rankLabel(rank, indices = 'fr') {
  return indices === 'fr' && INDEX_FR[rank] ? INDEX_FR[rank] : rank;
}

// Canvas d'une face de carte (réutilisé pour la 3D et pour les vignettes 2D).
export function drawCardFace(rank, suit, indices = 'fr', scale = 1) {
  const W = Math.round(CW * scale), H = Math.round(CH * scale);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const red = RED[suit];
  const ink = DECK_COLORS === 4 ? FOUR[suit] : red ? '#b3202c' : '#16181d';

  rr(ctx, 2, 2, CW - 4, CH - 4, 26);
  ctx.fillStyle = '#fbf9f3';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d8d2c4';
  ctx.stroke();

  const label = rankLabel(rank, indices);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const drawIndex = () => {
    ctx.font = `700 ${label.length > 1 ? 58 : 66}px Georgia, "Times New Roman", serif`;
    if (label.length > 1) {
      ctx.save(); ctx.translate(46, 76); ctx.scale(0.82, 1); ctx.fillText(label, 0, 0); ctx.restore();
    } else ctx.fillText(label, 44, 76);
    drawSuit(ctx, suit, 44, 112, 44);
  };
  drawIndex();
  ctx.save();
  ctx.translate(CW, CH); ctx.rotate(Math.PI);
  drawIndex();
  ctx.restore();

  const inner = { x: 82, y: 50, w: CW - 164, h: CH - 100 };
  if (rank === 'A') {
    drawSuit(ctx, suit, CW / 2, CH / 2, suit === 's' ? 170 : 130);
    if (suit === 's') {
      ctx.fillStyle = '#fbf9f3';
      ctx.font = '700 20px Georgia, serif';
      ctx.fillText('PLAY', CW / 2, CH / 2 + 8);
    }
  } else if (PIPS[rank]) {
    for (const [px, py] of PIPS[rank]) {
      drawSuit(ctx, suit, inner.x + px * inner.w, inner.y + py * inner.h, 64, py > 0.5);
    }
  } else {
    // Figures : cadre double et portrait stylisé en miroir
    const col = FACE_COLORS[rank];
    const fx = 76, fy = 62, fw = CW - 152, fh = CH - 124;
    ctx.fillStyle = '#f3ecdb';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.lineWidth = 4; ctx.strokeStyle = col.b;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.lineWidth = 2; ctx.strokeStyle = ink;
    ctx.strokeRect(fx + 8, fy + 8, fw - 16, fh - 16);
    const half = () => {
      ctx.save();
      ctx.beginPath(); ctx.rect(fx + 10, fy + 10, fw - 20, fh / 2 - 10); ctx.clip();
      // robe
      ctx.fillStyle = col.a;
      ctx.beginPath();
      ctx.moveTo(fx + 20, fy + fh / 2);
      ctx.quadraticCurveTo(CW / 2, fy + fh * 0.18, fx + fw - 20, fy + fh / 2);
      ctx.fill();
      ctx.fillStyle = red ? '#b3202c' : '#16181d';
      ctx.beginPath();
      ctx.moveTo(CW / 2 - 40, fy + fh / 2);
      ctx.lineTo(CW / 2, fy + fh * 0.3);
      ctx.lineTo(CW / 2 + 40, fy + fh / 2);
      ctx.fill();
      // tête
      ctx.fillStyle = '#e9c9a3';
      ctx.beginPath(); ctx.arc(CW / 2, fy + fh * 0.2, 30, 0, Math.PI * 2); ctx.fill();
      // couronne / coiffe
      ctx.fillStyle = col.b;
      ctx.beginPath();
      const cy = fy + fh * 0.2 - 26;
      if (rank === 'K') {
        ctx.moveTo(CW / 2 - 30, cy); ctx.lineTo(CW / 2 - 30, cy - 22); ctx.lineTo(CW / 2 - 15, cy - 10);
        ctx.lineTo(CW / 2, cy - 28); ctx.lineTo(CW / 2 + 15, cy - 10); ctx.lineTo(CW / 2 + 30, cy - 22); ctx.lineTo(CW / 2 + 30, cy);
      } else if (rank === 'Q') {
        ctx.ellipse(CW / 2, cy - 4, 32, 14, 0, Math.PI, 0); ctx.lineTo(CW / 2 + 32, cy);
      } else {
        ctx.moveTo(CW / 2 - 34, cy + 2); ctx.lineTo(CW / 2 + 34, cy + 2); ctx.lineTo(CW / 2 + 22, cy - 16); ctx.lineTo(CW / 2 - 22, cy - 16);
      }
      ctx.closePath(); ctx.fill();
      // visage
      ctx.fillStyle = '#3a2a20';
      ctx.fillRect(CW / 2 - 11, fy + fh * 0.2 - 4, 5, 5);
      ctx.fillRect(CW / 2 + 6, fy + fh * 0.2 - 4, 5, 5);
      if (rank === 'K') { ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.ellipse(CW / 2, fy + fh * 0.2 + 22, 20, 14, 0, 0, Math.PI); ctx.fill(); }
      // symbole et lettre
      ctx.fillStyle = ink;
      drawSuit(ctx, suit, fx + 34, fy + 44, 34);
      ctx.font = '700 46px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, fx + fw - 34, fy + 58);
      ctx.restore();
    };
    half();
    ctx.save(); ctx.translate(CW, CH); ctx.rotate(Math.PI); half(); ctx.restore();
    ctx.strokeStyle = col.b; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx + 10, fy + fh / 2); ctx.lineTo(fx + fw - 10, fy + fh / 2); ctx.stroke();
  }
  return c;
}

export const BACKS = {
  bordeaux: { label: 'Bordeaux', base: '#7a1622', line: '#b8434f', ink: '#f1e3c8' },
  marine: { label: 'Marine', base: '#16325c', line: '#3e6aa6', ink: '#e8eef8' },
  noir: { label: 'Noir & or', base: '#141414', line: '#a5843a', ink: '#d9b866' },
  emeraude: { label: 'Émeraude', base: '#0f4a35', line: '#3d8a6a', ink: '#e7f0e8' },
};

export function drawCardBack(style = 'bordeaux') {
  const b = BACKS[style] || BACKS.bordeaux;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  rr(ctx, 2, 2, CW - 4, CH - 4, 26);
  ctx.fillStyle = '#fbf9f3'; ctx.fill();
  ctx.save();
  rr(ctx, 20, 20, CW - 40, CH - 40, 14);
  ctx.clip();
  ctx.fillStyle = b.base; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = b.line; ctx.lineWidth = 2;
  for (let i = -CH; i < CW + CH; i += 18) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CH, CH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, CH); ctx.lineTo(i + CH, 0); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = b.ink; ctx.lineWidth = 3;
  rr(ctx, 30, 30, CW - 60, CH - 60, 10); ctx.stroke();
  // médaillon
  ctx.fillStyle = b.base;
  ctx.beginPath(); ctx.ellipse(CW / 2, CH / 2, 78, 96, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = b.ink; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(CW / 2, CH / 2, 66, 84, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = b.ink;
  ctx.font = '700 64px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('B', CW / 2, CH / 2 + 4);
  return c;
}

export function canvasTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- Tapis ----------
export const FELTS = {
  vert: { label: 'Vert casino', base: '#1d5a3c', dark: '#123d28', print: '#e9d9a6' },
  bleu: { label: 'Bleu nuit', base: '#1b3d66', dark: '#102844', print: '#e7dcb4' },
  rouge: { label: 'Rouge', base: '#7c1c25', dark: '#531219', print: '#ecd8a4' },
  noir: { label: 'Anthracite', base: '#2a2d31', dark: '#17191c', print: '#c9a85a' },
  violet: { label: 'Prune', base: '#4a2350', dark: '#2e1533', print: '#e6d3a0' },
};

// geo : { R, back, spots:[{x,z}], spotR }
export function drawFelt(geo, rules, feltKey = 'vert') {
  const f = FELTS[feltKey] || FELTS.vert;
  const W = 2048;
  const H = Math.round(W * (geo.R + geo.back) / (2 * geo.R));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const k = W / (2 * geo.R);
  const px = (x) => (x + geo.R) * k;
  const py = (z) => (z + geo.back) * k;

  // fond + vignettage
  const g = ctx.createRadialGradient(px(0), py(0.2), 50, px(0), py(0.2), W * 0.7);
  g.addColorStop(0, f.base); g.addColorStop(1, f.dark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // grain du feutre
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = f.print; ctx.fillStyle = f.print;
  ctx.globalAlpha = 0.9;

  const cx = px(0), cy = py(0);
  const arcText = (text, radius, size, weight = 600, spacing = 1.0) => {
    ctx.save();
    ctx.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r = radius * k;
    const widths = [...text].map((ch) => ctx.measureText(ch).width * spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    let a = Math.PI / 2 + total / r / 2;
    [...text].forEach((ch, i) => {
      a -= widths[i] / 2 / r;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a - Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a -= widths[i] / 2 / r;
    });
    ctx.restore();
  };
  const arcLine = (radius, a0, a1, w = 3) => {
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(cx, cy, radius * k, a0, a1); ctx.stroke();
  };

  // Bande d'assurance
  arcLine(0.5, Math.PI * 0.2, Math.PI * 0.8, 4);
  arcLine(0.6, Math.PI * 0.2, Math.PI * 0.8, 4);
  arcText(rules.insurance ? "L'ASSURANCE PAIE 2 CONTRE 1" : 'PAS D\'ASSURANCE', 0.55, 30, 600, 1.15);
  arcText(`LE BLACKJACK PAIE ${payoutLabel(rules.blackjackPays).toUpperCase()}`, 0.40, 40, 700, 1.1);
  arcText(rules.dealerHitsSoft17 ? 'LE CROUPIER TIRE SUR 17 SOUPLE' : 'LE CROUPIER TIRE À 16 ET RESTE À TOUS LES 17', 0.32, 22, 500, 1.1);

  // Emplacements de mise
  geo.spots.forEach((s, i) => {
    const x = px(s.x), y = py(s.z);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, geo.spotR * k, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, geo.spotR * k - 9, 0, Math.PI * 2); ctx.stroke();
    // Zone des cartes : rectangle discret
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(px(s.cx), py(s.cz));
    ctx.rotate(-(Math.PI / 2 - s.angle));
    ctx.lineWidth = 2;
    rr(ctx, -CARD_W * k * 0.75, -CARD_H * k * 0.7, CARD_W * k * 1.5, CARD_H * k * 1.4, 10);
    ctx.stroke();
    ctx.restore();
  });

  // Emplacement des cartes du croupier
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  rr(ctx, px(-0.05) - CARD_W * k * 0.6, py(geo.dealerZ) - CARD_H * k * 0.6, CARD_W * k * 1.2, CARD_H * k * 1.2, 10);
  ctx.stroke();

  // Logo
  ctx.globalAlpha = 0.85;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 58px Georgia, serif';
  ctx.fillText('BLACKJACK PLAY', px(0), py(0.12));
  ctx.font = '500 18px Georgia, serif';
  ctx.fillText('JETONS FICTIFS · AUCUNE VALEUR', px(0), py(0.19));
  ctx.globalAlpha = 1;

  // Coins du rectangle du croupier : liseré
  return c;
}

// ---------- Jetons ----------
export const CHIP_DENOMS = [
  { v: 1, color: '#e9e6df', edge: '#2f5fa5', text: '#2f5fa5' },
  { v: 5, color: '#b3202c', edge: '#f3efe4', text: '#f3efe4' },
  { v: 25, color: '#1f7a45', edge: '#f3efe4', text: '#f3efe4' },
  { v: 100, color: '#18191c', edge: '#e9e6df', text: '#e9e6df' },
  { v: 500, color: '#5b2b84', edge: '#f1d36b', text: '#f1d36b' },
  { v: 1000, color: '#d68a17', edge: '#1b1b1b', text: '#1b1b1b' },
];

export function drawChipFace(den, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  ctx.fillStyle = den.color;
  ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();
  // marques de bord
  ctx.fillStyle = den.edge;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save(); ctx.translate(r, r); ctx.rotate(a);
    ctx.fillRect(-r * 0.12, -r, r * 0.24, r * 0.2);
    ctx.restore();
  }
  ctx.strokeStyle = den.edge; ctx.lineWidth = size * 0.02;
  ctx.setLineDash([size * 0.04, size * 0.03]);
  ctx.beginPath(); ctx.arc(r, r, r * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = den.color;
  ctx.beginPath(); ctx.arc(r, r, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = den.text;
  ctx.font = `700 ${size * (den.v >= 1000 ? 0.26 : 0.32)}px Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(den.v >= 1000 ? '1K' : String(den.v), r, r + size * 0.02);
  return c;
}

export function drawChipEdge(den) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = den.color; ctx.fillRect(0, 0, 256, 16);
  ctx.fillStyle = den.edge;
  for (let i = 0; i < 6; i++) ctx.fillRect(i * (256 / 6) + 6, 0, 256 / 6 * 0.35, 16);
  return c;
}

// ---------- Moquette ----------
export function drawCarpet() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a1016'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#6b2a1d'; ctx.lineWidth = 6;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 128 + 64, y = j * 128 + 64;
    ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + 40, y); ctx.lineTo(x, y + 40); ctx.lineTo(x - 40, y); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#9a6a2a';
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f3a3a';
    ctx.beginPath(); ctx.arc(x + 64, y + 64, 14, 0, Math.PI * 2); ctx.fill();
  }
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function drawLeather() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function drawWood() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a2f17'; ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${30 + Math.random() * 40},${12 + Math.random() * 15},5,${0.25 + Math.random() * 0.3})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * 128;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
    ctx.stroke();
  }
  return c;
}
