// Musique d'ambiance générée en direct (Web Audio) : aucun fichier, aucune licence, jamais deux fois la même.
// Styles : « jazz » (lounge : piano électrique, contrebasse qui marche, balais) et « calme » (piano doux et nappes).

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Accords : fondamentale (MIDI) + voicing (intervalles au-dessus de la fondamentale, sans la basse)
const CH = {
  maj9: [4, 7, 11, 14], m9: [3, 7, 10, 14], dom13: [4, 10, 14, 21], dom7b9: [4, 10, 13, 16], m7b5: [3, 6, 10, 15], maj69: [4, 9, 14, 19],
};
// Grilles de 8 mesures (fondamentale, type), tonalités voisines pour varier
const PROGS = [
  [[50, 'm9'], [55, 'dom13'], [48, 'maj9'], [45, 'dom7b9'], [50, 'm9'], [55, 'dom13'], [48, 'maj69'], [48, 'maj69']],
  [[53, 'maj9'], [50, 'm9'], [55, 'm9'], [48, 'dom13'], [57, 'm7b5'], [50, 'dom7b9'], [55, 'm9'], [48, 'dom13']],
  [[52, 'm7b5'], [45, 'dom7b9'], [50, 'm9'], [55, 'dom13'], [48, 'maj9'], [53, 'maj9'], [50, 'm9'], [55, 'dom13']],
  [[48, 'maj9'], [45, 'm9'], [50, 'm9'], [55, 'dom13'], [52, 'm9'], [45, 'dom7b9'], [50, 'm9'], [55, 'dom13']],
];
const SCALE = { maj9: [0, 2, 4, 7, 9, 11], maj69: [0, 2, 4, 7, 9], m9: [0, 2, 3, 5, 7, 10], dom13: [0, 2, 4, 7, 9, 10], dom7b9: [0, 1, 4, 7, 10], m7b5: [0, 3, 5, 6, 10] };

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    // Réverbération de salle (réponse impulsionnelle générée)
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    this.verb.connect(wet).connect(this.out);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.8;
    this.dry.connect(this.out);
    this.dry.connect(this.verb);
    // Bruit pour les balais
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.style = 'jazz';
    this.playing = false;
  }

  setVolume(v, fade = 1.5) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(v, t + fade);
  }

  start(style = this.style) {
    this.style = style;
    if (this.playing) return;
    this.playing = true;
    this.tempo = style === 'calme' ? 66 : 84 + Math.floor(Math.random() * 8);
    this.prog = PROGS[Math.floor(Math.random() * PROGS.length)];
    this.bar = 0;
    this.next = this.ctx.currentTime + 0.15;
    this.lastBass = 38;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }

  schedule() {
    const beat = 60 / this.tempo, barLen = beat * 4;
    while (this.next < this.ctx.currentTime + 0.6) {
      const [root, type] = this.prog[this.bar % 8];
      const [nRoot, nType] = this.prog[(this.bar + 1) % 8];
      if (this.style === 'calme') this.barCalm(this.next, beat, root, type);
      else this.barJazz(this.next, beat, root, type, nRoot);
      void nType;
      this.next += barLen;
      this.bar++;
      // Nouvelle grille toutes les 16 mesures
      if (this.bar % 16 === 0) this.prog = PROGS[Math.floor(Math.random() * PROGS.length)];
    }
  }

  // ---------- Instruments ----------
  ep(t, midi, dur, vel = 0.12) {
    // Piano électrique : sinus + harmonique 2 « cloche » qui s'éteint vite, léger trémolo
    const ctx = this.ctx, f = NOTE(midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.connect(lp).connect(this.dry);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.0;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(vel * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    o1.connect(g); o2.connect(g2).connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.7); o2.stop(t + dur + 0.7);
  }

  bass(t, midi, dur, vel = 0.32) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(midi);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  brush(t, vel = 0.05, len = 0.09, hp = 5000) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(this.dry);
    s.start(t, Math.random() * 0.8, len + 0.02);
  }

  kick(t, vel = 0.18) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.3);
  }

  pad(t, notes, dur, vel = 0.03) {
    const ctx = this.ctx;
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(m); o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vel, t + dur * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
        o.connect(lp).connect(g).connect(this.dry);
        o.start(t); o.stop(t + dur + 0.6);
      }
    }
  }

  // ---------- Styles ----------
  barJazz(t, beat, root, type, nextRoot) {
    const sw = beat * 0.66; // croche swinguée
    const voicing = CH[type].map((i) => root + 12 + i);
    // Comping : rythmes typiques (temps 1, « et » du 2, parfois 4)
    const pats = [[0, 1 + 0.66], [0.66, 2.66], [0, 2, 3.66], [1.66, 3]];
    const pat = pats[Math.floor(Math.random() * pats.length)];
    for (const p of pat) {
      const vel = 0.05 + Math.random() * 0.025;
      voicing.forEach((m, k) => this.ep(t + p * beat + k * 0.006, m, beat * 0.9, vel));
    }
    // Contrebasse qui marche : fondamentale, notes de l'accord, approche chromatique vers l'accord suivant
    const tones = [0, CH[type][0], 7, CH[type][1]];
    let target = nextRoot - 12;
    while (target > 45) target -= 12;
    while (target < 33) target += 12;
    const line = [root - 12, root - 12 + tones[1], root - 12 + 7, target + (Math.random() < 0.5 ? 1 : -1)];
    line.forEach((m, k) => {
      let n = m; while (n > 47) n -= 12; while (n < 31) n += 12;
      this.bass(t + k * beat, n, beat * 0.95, k === 0 ? 0.34 : 0.27);
    });
    // Balais sur la ride (« ding, ding-da ding ») + charleston sur 2 et 4
    for (let k = 0; k < 4; k++) {
      this.brush(t + k * beat, 0.035 + Math.random() * 0.01, 0.16, 6500);
      if (k % 2 === 1) { this.brush(t + k * beat + sw, 0.025, 0.08, 7000); this.brush(t + k * beat, 0.045, 0.05, 3000); }
    }
    if (Math.random() < 0.6) this.kick(t, 0.12);
    // Petite mélodie de temps en temps (vibraphone doux)
    if (this.bar % 4 >= 2 && Math.random() < 0.55) {
      const sc = SCALE[type];
      let pos = Math.floor(Math.random() * sc.length);
      const n = 2 + Math.floor(Math.random() * 4);
      let tt = t + (Math.random() < 0.5 ? 0.66 : 1) * beat;
      for (let i = 0; i < n && tt < t + beat * 4; i++) {
        pos = Math.max(0, Math.min(sc.length * 2 - 1, pos + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))));
        const m = root + 24 + sc[pos % sc.length] + 12 * Math.floor(pos / sc.length);
        this.ep(tt, Math.min(m, 86), beat * 0.6, 0.045);
        tt += (Math.random() < 0.6 ? 0.66 : 1.34) * beat;
      }
    }
  }

  barCalm(t, beat, root, type) {
    const voicing = CH[type].map((i) => root + 12 + i);
    this.pad(t, [root, ...voicing.slice(0, 3)], beat * 4, 0.012);
    this.bass(t, root - 12 < 31 ? root : root - 12, beat * 3.5, 0.2);
    // Arpège lent
    const arp = [...voicing, voicing[1] + 12];
    for (let k = 0; k < 4; k++) {
      const m = arp[(k + (this.bar % 2) * 2) % arp.length];
      this.ep(t + k * beat + (k ? Math.random() * 0.03 : 0), m, beat * 1.4, 0.04 + Math.random() * 0.015);
    }
  }
}
