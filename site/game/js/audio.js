// Sons (échantillons CC0 Kenney) + voix du croupier (synthèse vocale du système).

const SAMPLES = {
  slide: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-5'],
  place: ['card-place-1', 'card-place-2', 'card-place-3'],
  flip: ['card-shove-1', 'card-shove-2'],
  shuffle: ['card-shuffle'],
  sweep: ['card-fan-1'],
  chip: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  chips: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
  collect: ['chips-collide-1', 'chips-collide-2', 'chips-handle-1', 'chips-handle-2'],
};

export class AudioManager {
  constructor(base = 'sfx/') {
    this.base = base;
    this.ctx = null;
    this.buffers = new Map();
    this.settings = { master: 0.8, sfx: 0.8, voice: 0.9, voiceLevel: 'essentiel', ambience: false, ambienceVol: 0.35, muted: false };
    this.voice = null;
    this.onSpeak = null;
    this.lastSpoken = 0;
    if (typeof speechSynthesis !== 'undefined') {
      const pick = () => this.pickVoice();
      speechSynthesis.onvoiceschanged = pick;
      pick();
    }
  }

  configure(s) {
    Object.assign(this.settings, s);
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
    if (this.sfxGain) this.sfxGain.gain.value = this.settings.sfx;
    this.updateAmbience();
    this.pickVoice();
  }

  // À appeler après une interaction utilisateur (politique d'autoplay)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfx;
    this.sfxGain.connect(this.master);
    this.loadAll();
    this.updateAmbience();
  }

  async loadAll() {
    const names = new Set(Object.values(SAMPLES).flat());
    await Promise.all([...names].map(async (n) => {
      try {
        const res = await fetch(this.base + n + '.ogg');
        const arr = await res.arrayBuffer();
        this.buffers.set(n, await this.ctx.decodeAudioData(arr));
      } catch (e) { /* son indisponible : on continue sans */ }
    }));
  }

  play(kind, vol = 1, rate = 1) {
    if (!this.ctx || this.settings.muted) return;
    const list = SAMPLES[kind];
    if (!list) return this.synth(kind, vol);
    const buf = this.buffers.get(list[Math.floor(Math.random() * list.length)]);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol * (0.85 + Math.random() * 0.15);
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  // Petits sons d'interface synthétisés (discrets)
  synth(kind, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g).connect(this.sfxGain);
    let f1 = 880, f2 = 880, d = 0.06, v = 0.05;
    if (kind === 'click') { f1 = 1400; f2 = 900; d = 0.04; v = 0.035; o.type = 'triangle'; }
    else if (kind === 'good') { f1 = 660; f2 = 990; d = 0.16; v = 0.05; o.type = 'sine'; }
    else if (kind === 'bad') { f1 = 300; f2 = 200; d = 0.2; v = 0.05; o.type = 'sine'; }
    else if (kind === 'tick') { f1 = 2000; f2 = 1800; d = 0.02; v = 0.02; o.type = 'square'; }
    else if (kind === 'win') { f1 = 523; f2 = 784; d = 0.25; v = 0.04; o.type = 'sine'; }
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02);
  }

  // Ambiance : brouhaha très léger + jetons lointains
  updateAmbience() {
    if (!this.ctx) return;
    const on = this.settings.ambience && !this.settings.muted;
    if (on && !this.amb) {
      const ctx = this.ctx;
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(lp).connect(g).connect(this.master);
      src.start();
      g.gain.linearRampToValueAtTime(this.settings.ambienceVol * 0.5, ctx.currentTime + 2);
      this.amb = { src, g };
      const tick = () => {
        if (!this.amb) return;
        this.play('collect', this.settings.ambienceVol * 0.12, 0.8);
        this.ambTimer = setTimeout(tick, 4000 + Math.random() * 9000);
      };
      this.ambTimer = setTimeout(tick, 3000);
    } else if (this.amb) {
      if (on) { this.amb.g.gain.value = this.settings.ambienceVol * 0.5; return; }
      this.amb.src.stop();
      this.amb = null;
      clearTimeout(this.ambTimer);
    }
  }

  pickVoice() {
    if (typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));
    if (!voices.length) { this.voice = null; return; }
    const female = this.preferFemale;
    const femaleNames = /(julie|hortense|amelie|amélie|audrey|aurelie|marie|denise|eloise|vivienne|female|femme|celine|léa|lea)/i;
    const maleNames = /(paul|henri|thomas|claude|remy|rémy|male|homme|nicolas|antoine|mathieu)/i;
    const want = voices.filter((v) => (female ? femaleNames : maleNames).test(v.name));
    const natural = (arr) => arr.find((v) => /natural|online|neural|google/i.test(v.name)) || arr[0];
    this.voice = natural(want.length ? want : voices.filter((v) => v.lang === 'fr-FR').length ? voices.filter((v) => v.lang === 'fr-FR') : voices);
  }

  setDealerGender(female) {
    this.preferFemale = female;
    this.pickVoice();
  }

  // level : 'essentiel' (annonces clés) ou 'bavard' (totaux, etc.)
  say(text, level = 'essentiel') {
    const s = this.settings;
    if (s.muted || s.voiceLevel === 'off' || typeof speechSynthesis === 'undefined') return;
    if (level === 'bavard' && s.voiceLevel !== 'bavard') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.08;
    u.pitch = 1;
    u.volume = s.voice * s.master;
    const dur = Math.max(400, text.length * 65);
    u.onstart = () => { if (this.onSpeak) this.onSpeak(dur); };
    if (speechSynthesis.speaking && level === 'bavard') return; // on ne coupe pas une annonce importante
    speechSynthesis.speak(u);
  }

  stopVoice() { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
}
