// Duel music: the tavern theme's A-minor lute, played for a fight. Faster, driving bass ostinato,
// war-drum toms, brass-like stabs. No noise beds (only a very light frame-drum tap).
// Plays during duels, Free-for-All and Adventure encounters; follows Music volume and Master.
const hz = m => 440 * 2 ** ((m - 69) / 12);
// two sections, 4 bars each: [chord tones (low to high), bass root]
const SECTIONS = [
  [[[57, 60, 64, 69], 45], [[53, 57, 60, 65], 41], [[55, 59, 62, 67], 43], [[57, 60, 64, 69], 45]],     // Am F G Am
  [[[57, 60, 64, 69], 45], [[50, 53, 57, 62], 38], [[52, 56, 59, 64], 40], [[52, 56, 59, 64], 40]],     // Am Dm E E
];
const OSTINATO = [0, 0, 12, 0, 10, 0, 7, 0];        // bass, in 8ths, relative to the bar's root
let ctx = null, out, bus, verb, noise, timer = null, playing = false, vol = .5, intensity = 1, ducked = false;
let step16 = 0, nextT = 0, rng = 777; const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);

function readVolume() { try { const m = JSON.parse(localStorage.getItem('scraps.audio') || '{}'); return (m.musicOn === false ? 0 : (m.music ?? .6)) * (m.master ?? .8); } catch { return .5; } }
function build() {
  ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  out = ctx.createGain(); out.gain.value = 0; out.connect(comp); bus = ctx.createGain(); bus.connect(out);
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .3; verb.connect(vg); vg.connect(out);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function pluck(t, m, v, d = .5, pan = 0) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.003; g2.gain.value = .3;
  f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + .2); env(g, t, v, .004, d); p.pan.value = pan;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(bus); const w = ctx.createGain(); w.gain.value = .35; p.connect(w); w.connect(verb);
  o.start(t); o2.start(t); o.stop(t + d + .05); o2.stop(t + d + .05);
}
function bass(t, m, d) {
  const o = ctx.createOscillator(), s = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; s.type = 'sine'; o.frequency.value = hz(m); s.frequency.value = hz(m - 12);
  f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(240, t + d); env(g, t, .13, .006, d);
  o.connect(f); s.connect(f); f.connect(g); g.connect(bus); o.start(t); s.start(t); o.stop(t + d + .05); s.stop(t + d + .05);
}
function tom(t, f0, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * .55, t + .25); env(g, t, v, .003, .34); o.connect(g); g.connect(bus); const w = ctx.createGain(); w.gain.value = .25; g.connect(w); w.connect(verb); o.start(t); o.stop(t + .4); }
function tap(t, v) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2; env(g, t, v, .002, .07); s.connect(f); f.connect(g); g.connect(bus); s.start(t, rnd() * .5, .1); }
function brass(t, notes, d) {
  for (const [i, m] of notes.entries()) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 1.006;
    f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2200, t + .08); f.frequency.exponentialRampToValueAtTime(700, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .05); g.gain.setValueAtTime(.03, t + d * .6); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(bus); const w = ctx.createGain(); w.gain.value = .4; g.connect(w); w.connect(verb);
    o.start(t + i * .005); o2.start(t + i * .005); o.stop(t + d + .05); o2.stop(t + d + .05);
  }
}
function scheduleStep(t) {
  const bpm = 104 + 16 * intensity, s16 = 60 / bpm / 4, bar = Math.floor(step16 / 16), sec = SECTIONS[Math.floor(bar / 4) % 2], [chord, root] = sec[bar % 4], k = step16 % 16;
  if (k % 2 === 0) bass(t, root + OSTINATO[(k / 2) % 8], s16 * 1.8);
  pluck(t, chord[[0, 2, 1, 3][k % 4]] + 12, .06 + (k % 4 === 0 ? .03 : 0), .35, (k % 4 - 1.5) * .25);
  if (k === 0 || k === 6 || k === 8 || (intensity > .8 && k === 14)) tom(t, k === 8 ? 95 : 70, .3);
  if (k === 4 || k === 12) { tom(t, 140, .16); tap(t, .03); }
  if (intensity > .6 && (k === 0 && bar % 2 === 0)) brass(t, chord.slice(0, 3), s16 * 6);
  if (k === 10 && bar % 4 === 3) brass(t, chord.slice(1, 4), s16 * 5);
  if (bar % 8 === 7 && k >= 12) tom(t, 120 + (k - 12) * 15, .18);     // a little fill into the next phrase
  step16++; return s16;
}
function tick() { if (!ctx || !playing) return; while (nextT < ctx.currentTime + .2) nextT += scheduleStep(nextT); }
const level = () => (ducked ? .25 : .62) * vol;

const api = {
  start(level0 = 1) {
    intensity = level0; vol = readVolume();
    if (playing) { out.gain.setTargetAtTime(level(), ctx.currentTime, .4); return; }
    try { if (!ctx) build(); } catch { return; }
    playing = true; ctx.resume(); step16 = 0; nextT = ctx.currentTime + .1;
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(level(), ctx.currentTime + 1.2);
    clearInterval(timer); timer = setInterval(tick, 50); tick();
  },
  stop(fade = 1.2) {
    if (!playing) return; playing = false; const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { if (!playing) { clearInterval(timer); ctx.suspend(); } }, fade * 1000 + 100);
  },
  duck(on) { ducked = on; if (playing) out.gain.setTargetAtTime(level(), ctx.currentTime, .25); },
  get playing() { return playing; },
};
addEventListener('scraps-audio', () => { vol = readVolume(); if (playing) out.gain.setTargetAtTime(level(), ctx.currentTime, .3); });
globalThis.scrapsDuelMusic = api;
export default api;
