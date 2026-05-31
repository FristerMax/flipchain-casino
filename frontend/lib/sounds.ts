"use client";

// ── Web Audio API sound engine ────────────────────────────────────────
// All sounds generated procedurally — no audio files needed.

let _ctx: AudioContext | null = null;
let _spinSource: AudioBufferSourceNode | null = null;
let _spinGain: GainNode | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    _ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Click when FLIP button is pressed ────────────────────────────────
export function playClick() {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(900, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.08);
  g.gain.setValueAtTime(0.18, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.08);
}

// ── Coin spinning whir (loops while tx is pending) ───────────────────
export function startSpinSound() {
  const c = ctx();
  if (!c) return;
  stopSpinSound();

  // White noise band-pass filtered to sound like a spinning coin
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, sr, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1200;
  bp.Q.value = 0.8;

  // LFO to make pitch wobble like a real spinning coin
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 12; // 12 Hz wobble
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain);
  lfoGain.connect(bp.frequency);
  lfo.start();

  _spinGain = c.createGain();
  _spinGain.gain.setValueAtTime(0, c.currentTime);
  _spinGain.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.15);

  src.connect(bp);
  bp.connect(_spinGain);
  _spinGain.connect(c.destination);
  src.start();
  _spinSource = src;
}

export function stopSpinSound() {
  if (_spinGain && _ctx) {
    _spinGain.gain.setValueAtTime(_spinGain.gain.value, _ctx.currentTime);
    _spinGain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + 0.12);
  }
  if (_spinSource) {
    const s = _spinSource;
    setTimeout(() => { try { s.stop(); } catch {} }, 150);
    _spinSource = null;
    _spinGain = null;
  }
}

// ── Coin landing tick ─────────────────────────────────────────────────
export function playCoinLand() {
  const c = ctx();
  if (!c) return;
  // Metallic "tink"
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.25);
  g.gain.setValueAtTime(0.3, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.25);
}

// ── Win sound — ascending arpeggio ────────────────────────────────────
export function playWin() {
  const c = ctx();
  if (!c) return;
  stopSpinSound();
  playCoinLand();

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = c.currentTime + 0.15 + i * 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t);
    osc.stop(t + 0.45);
  });

  // Extra shimmer on top note
  setTimeout(() => {
    const c2 = ctx();
    if (!c2) return;
    const osc = c2.createOscillator();
    const g = c2.createGain();
    osc.connect(g);
    g.connect(c2.destination);
    osc.type = "triangle";
    osc.frequency.value = 2093; // C7
    g.gain.setValueAtTime(0.12, c2.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c2.currentTime + 0.6);
    osc.start(c2.currentTime);
    osc.stop(c2.currentTime + 0.6);
  }, 450);
}

// ── Lose sound — descending thud ─────────────────────────────────────
export function playLose() {
  const c = ctx();
  if (!c) return;
  stopSpinSound();
  playCoinLand();

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(280, c.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.5);
  g.gain.setValueAtTime(0, c.currentTime + 0.1);
  g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  osc.start(c.currentTime + 0.1);
  osc.stop(c.currentTime + 0.5);
}

// ── Dice rattle (for Dice game) ───────────────────────────────────
export function startDiceRattle() {
  const c = ctx();
  if (!c) return;
  stopSpinSound();

  // Rapid random clicks like dice rattling
  let count = 0;
  const rattle = () => {
    if (count > 20) return;
    const c2 = ctx();
    if (!c2) return;
    const osc = c2.createOscillator();
    const g = c2.createGain();
    osc.connect(g); g.connect(c2.destination);
    osc.type = "square";
    osc.frequency.value = 200 + Math.random() * 400;
    g.gain.setValueAtTime(0.08, c2.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c2.currentTime + 0.05);
    osc.start(c2.currentTime);
    osc.stop(c2.currentTime + 0.05);
    count++;
    setTimeout(rattle, 80 + Math.random() * 40);
  };
  rattle();
}

// ── Limbo tension (rising tone) ───────────────────────────────────
export function startLimboTension() {
  const c = ctx();
  if (!c) return;
  stopSpinSound();

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, c.currentTime);
  osc.frequency.linearRampToValueAtTime(880, c.currentTime + 2);
  g.gain.setValueAtTime(0.08, c.currentTime);
  g.gain.linearRampToValueAtTime(0.15, c.currentTime + 1.5);
  g.gain.linearRampToValueAtTime(0.001, c.currentTime + 2);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 2);
}

// ── Rocket engine (looping noise for Crash game) ──────────────────
let _engSrc: AudioBufferSourceNode | null = null;
let _engGain: GainNode | null = null;

export function startRocketEngine() {
  const c = ctx();
  if (!c) return;
  stopRocketEngine();

  const t = c.currentTime;

  // Main tone — triangle wave, pitch rises over 30s (80→220 Hz)
  const osc1 = c.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(80, t);
  osc1.frequency.exponentialRampToValueAtTime(220, t + 30);

  // Harmonic — octave above, softer
  const osc2 = c.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(160, t);
  osc2.frequency.exponentialRampToValueAtTime(440, t + 30);

  // Light noise layer for texture
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, sr, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "bandpass"; noiseFilter.frequency.value = 400; noiseFilter.Q.value = 0.8;
  const noiseGain = c.createGain(); noiseGain.gain.value = 0.04;
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain);

  _engGain = c.createGain();
  _engGain.gain.setValueAtTime(0, t);
  _engGain.gain.linearRampToValueAtTime(0.12, t + 0.5);

  const g2 = c.createGain(); g2.gain.value = 0.07;

  osc1.connect(_engGain);
  osc2.connect(g2); g2.connect(_engGain);
  noiseGain.connect(_engGain);
  _engGain.connect(c.destination);

  osc1.start(); osc2.start(); noise.start();
  _engSrc = osc1 as unknown as AudioBufferSourceNode;
  (_engSrc as unknown as { _osc2: OscillatorNode; _noise: AudioBufferSourceNode })._osc2 = osc2;
  (_engSrc as unknown as { _noise: AudioBufferSourceNode })._noise = noise;
}

export function stopRocketEngine() {
  if (_engGain && _ctx) {
    _engGain.gain.setValueAtTime(_engGain.gain.value, _ctx.currentTime);
    _engGain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + 0.3);
  }
  if (_engSrc) {
    const s = _engSrc as unknown as { _osc2?: OscillatorNode; _noise?: AudioBufferSourceNode } & AudioBufferSourceNode;
    setTimeout(() => {
      try { s.stop(); } catch {}
      try { s._osc2?.stop(); } catch {}
      try { s._noise?.stop(); } catch {}
    }, 350);
    _engSrc = null; _engGain = null;
  }
}

// ── Explosion (Crash game) ────────────────────────────────────────
export function playExplosion() {
  const c = ctx();
  if (!c) return;
  stopRocketEngine();

  // Deep boom
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(100, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(25, c.currentTime + 0.9);
  g.gain.setValueAtTime(0.45, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.9);

  // Noise crackle
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, sr * 0.5, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
  const ns = c.createBufferSource(); ns.buffer = buf;
  const ng = c.createGain(); ng.gain.value = 0.35;
  ns.connect(ng); ng.connect(c.destination);
  ns.start(c.currentTime);

  // High crackle
  setTimeout(() => {
    const c2 = ctx(); if (!c2) return;
    const o2 = c2.createOscillator(); const g2 = c2.createGain();
    o2.connect(g2); g2.connect(c2.destination);
    o2.type = "square"; o2.frequency.setValueAtTime(800, c2.currentTime);
    o2.frequency.exponentialRampToValueAtTime(60, c2.currentTime + 0.3);
    g2.gain.setValueAtTime(0.15, c2.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, c2.currentTime + 0.3);
    o2.start(c2.currentTime); o2.stop(c2.currentTime + 0.3);
  }, 80);
}
