// Tavern title audio: everything is synthesised with Web Audio (no audio files).
// Layers: hearth (rumble + crackles), night outside (wind + crickets), music (lute-like
// arpeggios over a soft pad), and two UI sounds. Each layer has its own gain so it can be
// toggled; the whole thing scales with the game's own volume preference.

const CHORDS = [ // A minor: i – VI – III – VII, two bars each
  {root: 57, notes: [57, 60, 64, 69]},  // Am
  {root: 53, notes: [53, 57, 60, 65]},  // F
  {root: 48, notes: [55, 60, 64, 67]},  // C
  {root: 55, notes: [55, 59, 62, 67]},  // G
];
const MELODY = [69, 72, 74, 76, 79, 81]; // A minor pentatonic, upper octave
const hz = m => 440 * 2 ** ((m - 69) / 12);

export function createTavernAudio({volume = 1, mix = {}} = {}) {
  let ctx = null, master, music, hearth, night, ui, verb, timer = null, started = false;
  let M = {music: .6, ambience: .55, crackle: .35, ui: .6, musicOn: true, ambienceOn: true, ...mix};
  const layerGain = name => name === 'music' ? .8 * M.music * (M.musicOn ? 1 : 0) : name === 'hearth' ? 1.4 * M.ambience * (M.ambienceOn ? 1 : 0) : name === 'night' ? 1.2 * M.ambience * (M.ambienceOn ? 1 : 0) : 1.2 * M.ui;
  let nextBeat = 0, beat = 0, nextCrackle = 0, nextChirp = 0, noiseBuf = null;
  const BPM = 72, EIGHTH = 60 / BPM / 2;
  let rng = 12345; const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp); comp.connect(ctx.destination);
    // reverb from a generated decaying-noise impulse
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4; }
    verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .55; verb.connect(vg); vg.connect(master);
    music = ctx.createGain(); music.gain.value = layerGain('music'); music.connect(master); music.connect(verb);
    hearth = ctx.createGain(); hearth.gain.value = layerGain('hearth'); hearth.connect(master);
    night = ctx.createGain(); night.gain.value = layerGain('night'); night.connect(master); night.connect(verb);
    ui = ctx.createGain(); ui.gain.value = layerGain('ui'); ui.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b = (b + .02 * w) / 1.02; nd[i] = i % 2 ? w : b * 3.5; }
    // continuous beds: hearth rumble and night wind
    bed(hearth, 'lowpass', 380, .055, 0);
    const wind = bed(night, 'bandpass', 380, .05, .7);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = .03;
    lfo.connect(lg); lg.connect(wind.gain); lfo.start();
  }
  function bed(dest, type, freq, gain, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(dest); s.start(); return g;
  }
  function burst(dest, t, dur, freq, gain, q = 1.2, pan = 0) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    s.connect(f); f.connect(g); g.connect(p); p.connect(dest); s.start(t, rnd() * 1.5, dur + .02);
  }
  function pluck(t, midi, gain, dur = 1.6, pan = 0, dest = music) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = .25;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + .35);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    p.pan.value = pan; o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(dest);
    o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
  }
  function pad(t, notes, dur) {
    for (const [i, m] of notes.slice(0, 3).entries()) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(m - 12); o.detune.value = (i - 1) * 7;
      f.type = 'lowpass'; f.frequency.value = 520; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.022, t + 1.4); g.gain.setValueAtTime(.022, t + dur - 1.2); g.gain.linearRampToValueAtTime(0, t + dur + .3);
      o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + dur + .4);
    }
  }
  function schedule() {
    const now = ctx.currentTime, horizon = now + .25;
    while (nextBeat < horizon) {                       // music: 8ths, 16 per chord
      const ci = Math.floor(beat / 16) % 4, chord = CHORDS[ci], step = beat % 16;
      if (step === 0) { pad(nextBeat, chord.notes, EIGHTH * 16); pluck(nextBeat, chord.root - 12, .16, 2.6, -.2); }
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      if (step % 2 === 0 || rnd() < .35) pluck(nextBeat, chord.notes[pattern[step % 8]], .09 + rnd() * .03, 1.4, (rnd() - .5) * .6);
      if (step % 4 === 2 && rnd() < .42) pluck(nextBeat + EIGHTH * .5, MELODY[Math.floor(rnd() * MELODY.length)], .07, 2.2, .3);
      nextBeat += EIGHTH; beat++;
    }
    while (nextCrackle < horizon) {                    // hearth: soft, sparse crackles and the odd pop
      const c = M.crackle;
      if (c > 0.01) {
        const pop = rnd() < .07, g = (.35 + .65 * c);
        burst(hearth, nextCrackle, pop ? .05 : .006 + rnd() * .014, pop ? 650 + rnd() * 350 : 1600 + rnd() * 2200, (pop ? .28 : .05 + rnd() * .12) * g, pop ? 2 : 1.4, .35);
        if (rnd() < .15 * c) burst(hearth, nextCrackle + .03 + rnd() * .04, .006, 2000 + rnd() * 2000, .05 * g, 1.4, .3);
      }
      nextCrackle += (.45 + rnd() * 1.6) / (.35 + c * 1.3);
    }
    while (nextChirp < horizon) {                      // a cricket or two outside the window
      const f = 4300 + rnd() * 500, pan = (rnd() - .5) * 1.2;
      for (let k = 0; k < 3; k++) {
        const t = nextChirp + k * .045, o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
        o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.012, t + .005); g.gain.linearRampToValueAtTime(0, t + .03);
        p.pan.value = pan; o.connect(g); g.connect(p); p.connect(night); o.start(t); o.stop(t + .04);
      }
      nextChirp += .6 + rnd() * 2.4;
    }
  }
  return {
    get started() { return started; },
    start() {
      if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try { build(); } catch { return; }
      started = true; const t = ctx.currentTime;
      nextBeat = t + .3; nextCrackle = t + .1; nextChirp = t + 1.5;
      master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(.9 * volume, t + 2.5);
      timer = setInterval(schedule, 80); schedule();
    },
    setLayer(name, on) {
      if (!started) return; const node = {music, hearth, night}[name]; if (!node) return;
      node.gain.setTargetAtTime(on ? layerGain(name) : 0, ctx.currentTime, .4);
    },
    setMix(m) {
      M = {...M, ...m}; if (!started) return; const t = ctx.currentTime;
      music.gain.setTargetAtTime(layerGain('music'), t, .3); hearth.gain.setTargetAtTime(layerGain('hearth'), t, .3);
      night.gain.setTargetAtTime(layerGain('night'), t, .3); ui.gain.setTargetAtTime(layerGain('ui'), t, .1);
    },
    setVolume(v) { volume = v; if (started) master.gain.setTargetAtTime(.9 * v, ctx.currentTime, .3); },
    hover() { if (!started || volume <= 0) return; const t = ctx.currentTime; pluck(t, 81, .05, .25, 0, ui); },
    select() {
      if (!started || volume <= 0) return; const t = ctx.currentTime;
      pluck(t, 69, .12, 1.2, -.1, ui); pluck(t + .07, 76, .1, 1.2, .1, ui); burst(ui, t, .05, 300, .25, .8);
    },
    fadeOut(sec = 1.2) {
      if (!started) return; const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + sec);
      setTimeout(() => { clearInterval(timer); timer = null; ctx.suspend(); }, sec * 1000 + 100);
    },
    resume() {
      if (!started) return; ctx.resume(); if (!timer) { const t = ctx.currentTime; nextBeat = Math.max(nextBeat, t + .2); nextCrackle = t + .1; nextChirp = t + 1; timer = setInterval(schedule, 80); }
      const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(.9 * volume, t + 1.5);
    },
  };
}
