// Petits utilitaires d'interface.
import { icon } from './icons.js';
import { drawCardFace, drawChipFace, CHIP_DENOMS, rankLabel } from './textures.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string' && c.startsWith('<svg')) e.insertAdjacentHTML('beforeend', c);
    else e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const fmt = (n) => nf.format(Math.round(n * 10) / 10);
export const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function iconBtn(name, tip, onclick, cls = '') {
  return h('button', { class: 'icon-btn ' + cls, 'aria-label': tip, onclick, html: icon(name, 19) + `<span class="tip">${tip}</span>` });
}

// ----- Notifications -----
export function toast(text, kind = '', ms = 2200) {
  const t = h('div', { class: 'toast ' + kind }, text);
  $('#toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
}

// ----- Fenêtre modale -----
let modalResolve = null;
export function openModal(content, { onClose, closable = true } = {}) {
  const m = $('#modal');
  const body = $('#modalBody');
  body.innerHTML = '';
  body.append(content);
  m.hidden = false;
  $('#modalClose').hidden = !closable;
  m.dataset.closable = closable ? '1' : '';
  return new Promise((res) => { modalResolve = (v) => { if (onClose) onClose(v); res(v); }; });
}
export function closeModal(value) {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true;
  const r = modalResolve; modalResolve = null;
  if (r) r(value);
}
export function modalOpen() { return !$('#modal').hidden; }

// ----- Tiroir -----
let drawerKind = null;
export function openDrawer(kind, title, content) {
  drawerKind = kind;
  $('#drawerTitle').textContent = title;
  const b = $('#drawerBody');
  b.innerHTML = '';
  b.append(content);
  b.scrollTop = 0;
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
}
export function closeDrawer() {
  drawerKind = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
}
export function drawerIs(kind) { return drawerKind === kind; }

// ----- Images de cartes et de jetons -----
const cardImgCache = new Map();
export function cardImg(card, indices = 'fr', scale = 0.4) {
  const key = card.rank + card.suit + indices + scale;
  let url = cardImgCache.get(key);
  if (!url) {
    url = drawCardFace(card.rank, card.suit, indices, scale).toDataURL('image/png');
    cardImgCache.set(key, url);
  }
  return h('img', { src: url, alt: rankLabel(card.rank, indices) + ' ' + ({ s: 'pique', h: 'cœur', d: 'carreau', c: 'trèfle' })[card.suit], draggable: 'false' });
}
export function clearCardImgCache() { cardImgCache.clear(); }

const chipCache = new Map();
export function chipUrl(v) {
  if (!chipCache.has(v)) {
    const den = CHIP_DENOMS.find((d) => d.v === v);
    chipCache.set(v, drawChipFace(den, 128).toDataURL('image/png'));
  }
  return chipCache.get(v);
}

// ----- Champs de réglages -----
export function field(label, control, help) {
  return h('div', { class: 'field' }, h('span', { class: 'f-label' }, label), control, help ? h('div', { class: 'f-help' }, help) : null);
}
export function toggle(value, onchange) {
  const input = h('input', { type: 'checkbox' });
  input.checked = !!value;
  input.addEventListener('change', () => onchange(input.checked));
  return h('label', { class: 'switch' }, input, h('span'));
}
export function select(options, value, onchange) {
  const s = h('select', { onchange: () => onchange(s.value) });
  for (const [v, l] of options) {
    const o = h('option', { value: v }, l);
    if (String(v) === String(value)) o.selected = true;
    s.append(o);
  }
  return s;
}
export function seg(options, value, onchange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  for (const [v, l] of options) {
    const b = h('button', { type: 'button', 'aria-pressed': String(String(v) === String(value)) }, l);
    b.addEventListener('click', () => {
      for (const x of wrap.children) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      onchange(v);
    });
    wrap.append(b);
  }
  return wrap;
}
export function range(min, max, step, value, onchange) {
  const r = h('input', { type: 'range', min, max, step });
  r.value = value;
  r.addEventListener('input', () => onchange(Number(r.value)));
  return r;
}

// ----- Petit graphique en ligne (canvas) -----
export function lineChart(canvas, values, { color = '#c9a24a', zero = null } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 400, hgt = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = hgt * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, hgt);
  if (values.length < 2) {
    ctx.fillStyle = '#85796a'; ctx.font = '13px Barlow, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Pas encore assez de données', w / 2, hgt / 2);
    return;
  }
  let min = Math.min(...values), max = Math.max(...values);
  if (zero !== null) { min = Math.min(min, zero); max = Math.max(max, zero); }
  if (max - min < 1e-9) { max += 1; min -= 1; }
  const pad = 22;
  const x = (i) => pad + (i / (values.length - 1)) * (w - pad - 6);
  const y = (v) => 8 + (1 - (v - min) / (max - min)) * (hgt - 24);
  ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) { const yy = 8 + k * (hgt - 24) / 3; ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(w - 6, yy); ctx.stroke(); }
  if (zero !== null) {
    ctx.strokeStyle = '#ffffff40'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad, y(zero)); ctx.lineTo(w - 6, y(zero)); ctx.stroke(); ctx.setLineDash([]);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, hgt);
  grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineTo(x(values.length - 1), hgt - 16); ctx.lineTo(x(0), hgt - 16); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#85796a'; ctx.font = '11px "Barlow Condensed", sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(fmt(max), 2, 14); ctx.fillText(fmt(min), 2, hgt - 18);
}

export { icon };
