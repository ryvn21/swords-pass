// Adventure music: "The Long Road". A travelling folk tune in D mixolydian, 6/8: fiddle melody,
// lute arpeggios, a low drone and a frame drum. Plays on the Adventure screens between fights
// (encounters use the duel music). Follows the Music slider and Master; no noise beds.
const hz = m => 440 * 2 ** ((m - 69) / 12);
// 8 bars of 6 eighths; null holds the previous note
const TUNE = [
  [62, 64, 66, 69, null, 66], [67, null, 66, 64, null, 62], [69, null, 71, 72, null, 71], [69, null, null, 66, null, null],
  [74, null, 72, 71, null, 69], [67, null, 69, 71, null, 67], [69, 66, 64, 62, 64, 66], [62, null, null, null, null, null],
];
const TUNE_B = [
  [74, null, 76, 78, null, 76], [74, null, 72, 71, null, 69], [72, null, 71, 69, null, 67], [69, null, null, null, 71, 72],
  [74, null, 72, 71, null, 69], [67, null, 69, 71, null, 74], [73, null, 71, 69, null, 66], [62, null, null, null, null, null],
];
const CHORDS = [[50, 54, 57], [43, 47, 50], [48, 52, 55], [50, 54, 57], [48, 52, 55], [43, 47, 50], [45, 49, 52], [50, 54, 57]];   // D G C D C G A D
let ctx = null, out, bus, verb, timer = null, playing = false, vol = .5, eighth = 0, nextT = 0, droneNodes = [];
const readVolume = () => { try { const m = JSON.parse(localStorage.getItem('scraps.audio') || '{}'); return (m.musicOn === false ? 0 : (m.music ?? .6)) * (m.master ?? .8); } catch { return .5; } };

function build() {
  ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(ctx.destination);
  out = ctx.createGain(); out.gain.value = 0; out.connect(comp); bus = ctx.createGain(); bus.connect(out);
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .38; verb.connect(vg); vg.connect(out);
}
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function fiddle(t, m, dur, v = .05) {             // bowed: soft attack, vibrato that blooms, warm filter
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 1.004;
  vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(hz(m) * .006, t + Math.min(.4, dur)); vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
  f.type = 'lowpass'; f.frequency.value = 2100; f.Q.value = 1.4;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .06); g.gain.setValueAtTime(v * .85, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur + .08);
  p.pan.value = .18; o.connect(f); o2.connect(f); f.connect(g); g.connect(p); p.connect(bus); const w = ctx.createGain(); w.gain.value = .55; p.connect(w); w.connect(verb);
  for (const x of [o, o2, vib]) { x.start(t); x.stop(t + dur + .15); }
}
function lute(t, m, v = .06, pan = -.2) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.002; g2.gain.value = .28;
  f.type = 'lowpass'; f.frequency.setValueAtTime(3400, t); f.frequency.exponentialRampToValueAtTime(800, t + .3); env(g, t, v, .004, .9); p.pan.value = pan;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(bus); const w = ctx.createGain(); w.gain.value = .4; p.connect(w); w.connect(verb);
  o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
}
function drum(t, v, low = true) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(low ? 92 : 160, t); o.frequency.exponentialRampToValueAtTime(low ? 55 : 110, t + .18);
  env(g, t, v, .003, low ? .3 : .12); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .35);
}
function drone() {
  for (const [m, v] of [[38, .022], [45, .016]]) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(m);
    f.type = 'lowpass'; f.frequency.value = 340; g.gain.value = v; o.connect(f); f.connect(g); g.connect(bus); o.start(); droneNodes.push(o);
  }
}
function schedule(t) {
  const e8 = 60 / 112 / 2, bar = Math.floor(eighth / 6) % 16, k = eighth % 6, tune = bar < 8 ? TUNE : TUNE_B, row = tune[bar % 8], chord = CHORDS[bar % 8];
  const m = row[k];
  if (m != null) { let n = 1; while (k + n < 6 && row[k + n] == null) n++; fiddle(t, m, e8 * n * .96); }
  lute(t, chord[[0, 1, 2, 1, 2, 1][k]] + 12, k === 0 ? .07 : .045, (k % 3 - 1) * .3);
  if (k === 0) drum(t, .16); if (k === 3) drum(t, .09); if (k === 5 && bar % 2) drum(t, .05, false);
  eighth++; return e8;
}
function tick() { if (!ctx || !playing) return; while (nextT < ctx.currentTime + .25) nextT += schedule(nextT); }
const api = {
  start() {
    vol = readVolume(); if (playing) return;
    try { if (!ctx) build(); } catch { return; }
    playing = true; ctx.resume(); eighth = 0; nextT = ctx.currentTime + .15; if (!droneNodes.length) drone();
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(.6 * vol, ctx.currentTime + 2);
    clearInterval(timer); timer = setInterval(tick, 60); tick();
  },
  stop(fade = 1.2) {
    if (!playing) return; playing = false; const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { if (!playing) { clearInterval(timer); ctx.suspend(); } }, fade * 1000 + 100);
  },
  get playing() { return playing; },
};
addEventListener('scraps-audio', () => { vol = readVolume(); if (playing) out.gain.setTargetAtTime(.6 * vol, ctx.currentTime, .3); });
globalThis.scrapsAdventureMusic = api;
export default api;
