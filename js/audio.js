// UNWRITTEN — all sound is synthesised: no audio files.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.music = null; this.timer = null; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.5; this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = 0.34;
    const d = c.createDelay(1.5), fb = c.createGain(), lp = c.createBiquadFilter();
    d.delayTime.value = 0.43; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.mus.connect(this.master); this.mus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
    const len = c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    if (this.pending) this.setMusic(this.pending);
  }
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.8; return this.muted; }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, f0, f1, vol = 0.3, q = 1, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name, a = 0) {
    if (!this.ctx) return;
    switch (name) {
      case 'slash': this.noise(0.16, 2600 + a * 500, 500, 0.32, 1.4); break;
      case 'spin': this.noise(0.3, 600, 3200, 0.36, 1.2); this.tone('triangle', 300, 900, 0.25, 0.12); break;
      case 'hit': this.tone('square', 210, 60, 0.11, 0.26); this.noise(0.08, 1800, 300, 0.3, 0.8); break;
      case 'kill': this.tone('sawtooth', 420, 40, 0.34, 0.22); this.noise(0.3, 900, 100, 0.3, 0.7); break;
      case 'hurt': this.tone('sawtooth', 300, 70, 0.4, 0.32); this.noise(0.2, 400, 80, 0.36, 0.6); break;
      case 'dash': this.noise(0.2, 400, 2400, 0.22, 2); break;
      case 'step': this.noise(0.035, 2800, 1400, 0.035, 2.5); break;
      case 'type': this.noise(0.022, 3600, 2200, 0.09, 3); break;
      case 'letter': [0, 4, 7, 12].forEach((n, i) => this.tone('triangle', mtof(72 + n + a), mtof(72 + n + a), 0.3, 0.2, i * 0.07)); break;
      case 'free': this.tone('sine', mtof(79), mtof(79), 0.5, 0.2); this.tone('sine', mtof(86), mtof(86), 0.6, 0.14, 0.09); break;
      case 'heart': this.tone('sine', mtof(76), mtof(83), 0.25, 0.22); break;
      case 'word': [0, 3, 7, 10, 12, 15, 19].forEach((n, i) => this.tone('triangle', mtof(60 + n), mtof(60 + n), 0.9, 0.16, i * 0.09)); break;
      case 'beacon': [0, 7, 12, 16, 19, 24].forEach((n, i) => { this.tone('sine', mtof(57 + n), mtof(57 + n), 2.4, 0.16, i * 0.14); this.tone('sine', mtof(57 + n) * 2.01, mtof(57 + n) * 2.01, 1.2, 0.05, i * 0.14); }); break;
      case 'shot': this.tone('square', 700, 240, 0.16, 0.1); break;
      case 'warn': this.tone('square', 140, 140, 0.14, 0.14); this.tone('square', 140, 140, 0.14, 0.14, 0.2); break;
      case 'charge': this.noise(0.5, 200, 1600, 0.28, 1.5); break;
      case 'slam': this.tone('sine', 110, 28, 0.6, 0.6); this.noise(0.4, 500, 60, 0.5, 0.5); break;
      case 'strike': this.noise(0.3, 3000, 200, 0.45, 0.8); this.tone('sawtooth', 90, 40, 0.4, 0.3); break;
      case 'spawn': this.tone('sawtooth', 60, 190, 0.5, 0.14); this.noise(0.5, 200, 900, 0.16, 3); break;
      case 'die': this.tone('sawtooth', 220, 30, 1.2, 0.34); this.noise(1.0, 1200, 60, 0.4, 0.5); break;
      case 'bossdie': for (let i = 0; i < 9; i++) { this.tone('sawtooth', 500 - i * 40, 40, 0.5, 0.26, i * 0.16); this.noise(0.4, 2000, 100, 0.34, 0.6, i * 0.16); } break;
      case 'whistle': this.tone('sine', 1300, 2100, 0.16, 0.2); this.tone('sine', 1500, 2500, 0.22, 0.2, 0.2); break;
      case 'hoof': this.noise(0.05, 500, 180, 0.12, 1.2); break;
      case 'fire': this.noise(0.5, 300, 2400, 0.25, 0.8); this.tone('triangle', 220, 440, 0.4, 0.1); break;
      case 'ice': this.noise(0.6, 4200, 900, 0.3, 4); this.tone('sine', 1800, 500, 0.5, 0.08); break;
    }
  }

  // generative score: a slow pad and a plucked line in the chapter's scale
  setMusic(m) {
    this.pending = m; if (!this.ctx) return;
    if (this.timer) clearInterval(this.timer);
    if (this.pad) { const p = this.pad, t = this.ctx.currentTime; p.g.gain.linearRampToValueAtTime(0.0001, t + 1.5); p.o.forEach(o => o.stop(t + 1.6)); this.pad = null; }
    if (!m) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 3);
    const o = [0, 7, 12, 19].map((n, i) => { const os = c.createOscillator(); os.type = i % 2 ? 'sawtooth' : 'triangle'; os.frequency.value = mtof(m.root - 12 + n) * (1 + (i - 1.5) * 0.002); os.connect(f); os.start(t); return os; });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); o.push(lfo);
    f.connect(g); g.connect(this.mus); this.pad = { g, o };
    let step = 0, last = 0;
    this.timer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      step++;
      const dense = this.intense ? 0.75 : 0.42;
      if (Math.random() < dense) {
        let i = last + Math.floor(Math.random() * 5) - 2; i = Math.max(0, Math.min(m.scale.length * 2 - 1, i)); last = i;
        const note = m.root + 12 + m.scale[i % m.scale.length] + 12 * Math.floor(i / m.scale.length);
        this.tone('triangle', mtof(note), mtof(note), 1.1, 0.13, 0, this.mus);
      }
      if (step % 8 === 0) this.tone('sine', mtof(m.root - 24), mtof(m.root - 24), 2.6, 0.2, 0, this.mus);
      if (this.intense && step % 2 === 0) this.tone('square', mtof(m.root - 12), mtof(m.root - 12), 0.12, 0.05, 0, this.mus);
    }, m.tempo * 1000);
  }
}
