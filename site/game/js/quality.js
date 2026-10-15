// Détection automatique de la puissance graphique et profils de qualité.

export const QUALITY = {
  basse:   { label: 'Basse',   pixelRatio: 1,    shadows: false, shadowMap: 512,  dealer: 'sd', tex: '1k', bokeh: false, aa: false },
  moyenne: { label: 'Moyenne', pixelRatio: 1.25, shadows: true,  shadowMap: 1024, dealer: 'sd', tex: '1k', bokeh: true,  aa: true },
  haute:   { label: 'Haute',   pixelRatio: 1.75, shadows: true,  shadowMap: 2048, dealer: 'hd', tex: '2k', bokeh: true,  aa: true },
  ultra:   { label: 'Ultra',   pixelRatio: 2.5,  shadows: true,  shadowMap: 4096, dealer: 'hd', tex: '2k', bokeh: true,  aa: true },
};

export function gpuInfo() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { webgl: false, renderer: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    return { webgl: true, webgl2: !!c.getContext('webgl2'), renderer: String(renderer || ''), maxTex };
  } catch { return { webgl: false, renderer: '' }; }
}

// Choix initial : prudent sur les puces intégrées et mobiles, généreux sur les cartes dédiées.
export function detectQuality() {
  const g = gpuInfo();
  if (!g.webgl) return 'basse';
  const r = g.renderer.toLowerCase();
  const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(r)) return 'basse';
  if (mobile) return mem >= 6 ? 'moyenne' : 'basse';
  if (/rtx|radeon rx [5-9]|rx [67]\d{3}|arc a7|apple m[2-9]|apple m1 (pro|max|ultra)/.test(r)) return 'ultra';
  if (/nvidia|geforce|radeon|apple m1|apple gpu/.test(r)) return 'haute';
  if (/intel.*(iris xe|arc)|radeon\(tm\) graphics|vega/.test(r)) return cores >= 8 ? 'haute' : 'moyenne';
  if (/intel/.test(r)) return 'moyenne';
  return cores >= 8 && mem >= 8 ? 'haute' : 'moyenne';
}

// Surveille les images par seconde ; propose de baisser la qualité si c'est trop lent.
export class FpsWatch {
  constructor(onSlow) {
    this.onSlow = onSlow;
    this.frames = 0; this.t = 0; this.slowStreak = 0; this.fps = 60; this.enabled = true;
  }
  tick(dt) {
    if (!this.enabled) return;
    this.frames++; this.t += dt;
    if (this.t >= 2) {
      this.fps = this.frames / this.t;
      this.frames = 0; this.t = 0;
      if (this.fps < 32) this.slowStreak++; else this.slowStreak = 0;
      if (this.slowStreak >= 3) { this.slowStreak = 0; this.onSlow(this.fps); }
    }
  }
}
