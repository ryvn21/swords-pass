// Game sound set, synthesised with Web Audio. app.js's sound(kind, chain) hands off to
// globalThis.scrapsSfx when it exists; the original beeps remain as the fallback.
// Kinds used by the game: move, rotate, lock, clear (with combo stage), hit, start, win, end.
// skin.js adds the board-driven ones, timed to what is drawn on the player's own board:
// fuse (gem size in cells), strike (incoming swords land), patter (sprinkles land), crack and free
// (garbage waking up), warn (an attack is queued), slide (a side sword comes in) and crush (pieces
// under a sword). The scheduled strike/patter replace the generic hit.
// Follows the player's Sound toggle and volume (prefs.sound / prefs.volume, default .16).

let ctx = null, out = null, verb = null, noise = null;
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];        // A minor pentatonic steps
const hz = m => 440 * 2 ** ((m - 69) / 12);

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  out = ctx.createGain(); out.connect(comp);
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .32; verb.connect(vg); vg.connect(out);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function tone(t, f, {type = 'sine', peak = .2, a = .004, d = .3, glide = 0, wet = 0, pan = 0} = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + a + d); env(g, t, peak, a, d); p.pan.value = pan;
  o.connect(g); g.connect(p); p.connect(out); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w); w.connect(verb); }
  o.start(t); o.stop(t + a + d + .05);
}
function hiss(t, {f = 2000, q = 1, peak = .2, a = .002, d = .05, type = 'bandpass', wet = 0} = {}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  env(g, t, peak, a, d); s.connect(fl); fl.connect(g); g.connect(out); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  s.start(t, Math.random() * .5, a + d + .05);
}
function pluck(t, m, peak = .16, d = .9, pan = 0) {                // lute-ish: triangle + octave sine, darkening filter
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.002; g2.gain.value = .3;
  f.type = 'lowpass'; f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(800, t + .3); env(g, t, peak, .005, d); p.pan.value = pan;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(out); const w = ctx.createGain(); w.gain.value = .5; p.connect(w); w.connect(verb);
  o.start(t); o2.start(t); o.stop(t + d + .1); o2.stop(t + d + .1);
}
function bell(t, f, peak = .12, d = 1.2, pan = 0) {                // glassy chime: inharmonic partials
  for (const [k, a] of [[1, 1], [2.76, .45], [5.4, .25], [8.93, .12]]) if (f * k < 15000) tone(t, f * k, {peak: peak * a, d: d / (1 + k * .35), wet: .6, pan});
}
function metal(t, f, peak = .08, d = .8, pan = 0) {               // struck steel: bar partials, the highs die first
  for (const [k, a] of [[1, 1], [2.32, .55], [4.25, .32], [6.63, .16]]) if (f * k < 14000) tone(t, f * k, {peak: peak * a, d: d / (1 + k * .5), wet: .45, pan});
}
function thud(t, f, peak = .3, d = .14, pan = 0) {                 // body of an impact: falling sine and a dull burst
  tone(t, f, {peak, d, glide: .55, pan}); hiss(t, {f: f * 5, q: .7, peak: peak * .4, d: d * .4, type: 'lowpass'});
}
function sweep(t, f0, f1, d, peak, q = 2.5) {                      // air: band-passed noise sliding in pitch
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; fl.type = 'bandpass'; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d); env(g, t, peak, d * .35, d * .65);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * .5, d + .05);
}
const jit = (x, k = .05) => x * (1 + (Math.random() * 2 - 1) * k);  // small random pitch so repeats don't machine-gun

const SOUNDS = {
  move(t, v) { hiss(t, {f: jit(1700), q: 4, peak: .26 * v, d: .016}); tone(t, jit(420, .03), {type: 'triangle', peak: .11 * v, d: .025}); },   // wooden tick
  rotate(t, v) { sweep(t, 1100, 3400, .07, .22 * v); hiss(t + .045, {f: jit(2900), q: 7, peak: .14 * v, d: .015}); },                // a quick swish and a catch
  lock(t, v) {                                                    // set down: a low thud plus a knock small speakers can carry
    thud(t, jit(150, .04), .30 * v, .12); tone(t, jit(560, .04), {type: 'triangle', peak: .14 * v, d: .05, glide: .7}); hiss(t, {f: jit(1100), q: 2, peak: .09 * v, d: .03});
  },
  clear(t, v, chain) {                                           // gem shatter + rising chime per combo stage
    const n = Math.max(1, Math.min(6, chain)), base = 69 + Math.min(12, (n - 1) * 2);
    hiss(t, {f: 1300, q: 1, peak: .12 * v, d: .07}); hiss(t, {f: 5200, q: .7, peak: .13 * v, d: .2, type: 'highpass', wet: .4});
    for (let i = 0; i < 4; i++) hiss(t + .015 + i * .022, {f: 3000 + Math.random() * 3500, q: 6, peak: .09 * v, d: .03});
    if (n >= 2) { sweep(t + .01, 1800, 6000, .16, .05 * v); metal(t + .05, 1480 + n * 60, .035 * v, .7, .2); }   // a blade leaves for their board
    for (let i = 0; i < n + 1; i++) bell(t + .02 + i * .07, hz(base + PENTA[Math.min(PENTA.length - 1, i * 2)]), .11 * v, 1.0 + n * .1, (i % 2 ? .25 : -.25));
    if (n >= 3) tone(t + .02, hz(45), {type: 'sine', peak: .25 * v, d: .5, wet: .3});
  },
  fuse(t, v, cells) {                                             // blocks lock into a gem: glass clink, then a chord that deepens with size
    const n = Math.max(4, Math.min(30, cells || 4)), k = Math.min(1, (n - 4) / 16), root = 84 - Math.round(k * 9);
    tone(t, 2100, {type: 'triangle', peak: .045 * v, d: .035}); hiss(t, {f: 7200, q: 5, peak: .05 * v, d: .05, wet: .3});
    const chord = n >= 9 ? [0, 7, 12, 16, 19] : n >= 6 ? [0, 7, 12, 16] : [0, 7, 12];
    chord.forEach((d, i) => bell(t + .025 + i * .04, hz(root + d), (.06 - i * .007) * v, .8 + k * .7, i % 2 ? .22 : -.22));
    tone(t + .02, hz(root + 12), {peak: .02 * v, d: .3, glide: 2, wet: .6});           // shimmer rising out of the fuse
    if (n >= 6) tone(t + .03, hz(root - 24), {peak: (.06 + .1 * k) * v, d: .5 + k * .4, wet: .4});
  },
  hit(t, v) {                                                     // generic: something landed on your board (fallback)
    thud(t, 110, .34 * v, .2); metal(t, 1210, .04 * v, .45, .1);
  },
  strike(t, v, n) {                                               // incoming swords bite into your board: steel ring over a heavy thud
    const k = Math.max(1, Math.min(4, n || 1));
    thud(t, 72, (.36 + .05 * k) * v, .3); thud(t, 190, .2 * v, .16); hiss(t, {f: 3400, q: 1.1, peak: .12 * v, d: .07});
    metal(t + .004, jit(780, .03), (.055 + .01 * k) * v, .9, -.1); if (k > 1) metal(t + .03, jit(1040, .03), .04 * v, .7, .15);
  },
  patter(t, v, n) {                                               // sprinkles: small stones clacking down one after another
    hiss(t, {f: jit(2300, .15), q: 5, peak: .15 * v, d: .018}); tone(t, jit(560, .15), {type: 'triangle', peak: .10 * v, d: .03, pan: (Math.random() - .5) * .5});
  },
  warn(t, v, n) {                                                 // an attack is coming: war-drum beats and a low horn, more for bigger attacks
    const k = Math.max(1, Math.min(4, n || 1));
    for (let i = 0; i < k + 1; i++) { thud(t + i * .17, i % 2 ? 98 : 82, (.22 + .03 * k) * v, .16); hiss(t + i * .17, {f: 900, q: 1.5, peak: .05 * v, d: .04}); }
    if (k >= 2) tone(t, hz(45 + (k > 2 ? 2 : 0)), {type: 'sawtooth', peak: (.03 + .01 * k) * v, a: .12, d: .28 * k + .2, wet: .35});
    if (k >= 3) tone(t + .05, hz(52), {type: 'sawtooth', peak: .025 * v, a: .15, d: .3 * k, wet: .35});
  },
  slide(t, v, hand) {                                            // a side sword grinding in from the edge
    const pan = (hand === 1 ? .6 : -.6);
    sweep(t, 600, 2600, .32, .16 * v, 3); hiss(t, {f: 4200, q: 6, peak: .05 * v, a: .08, d: .25});
    tone(t, jit(880, .03), {type: 'triangle', peak: .03 * v, a: .1, d: .3, glide: 1.4, pan});
  },
  crush(t, v, n) {                                               // pieces under a sword crumble: a gritty crunch, bigger for more
    const k = Math.max(1, Math.min(5, Math.ceil((n || 1) / 2)));
    thud(t, 64, (.22 + .04 * k) * v, .22);
    for (let i = 0; i < 3 + k * 2; i++) hiss(t + i * .014 + Math.random() * .01, {f: jit(900 + Math.random() * 1600, .2), q: 2.5, peak: (.12 + .02 * k) * v, d: .025, type: 'bandpass'});
    hiss(t + .02, {f: 500, q: .7, peak: .12 * v, d: .16, type: 'lowpass'});
  },
  crack(t, v, n) {                                                // grey stone splits to show its colour
    const k = Math.min(3, Math.max(1, Math.round((n || 1) / 3)));
    for (let i = 0; i < k + 1; i++) hiss(t + i * .018, {f: jit(3200, .2), q: 9, peak: .11 * v, d: .012});
    tone(t, jit(240, .05), {type: 'triangle', peak: .07 * v, d: .05});
  },
  free(t, v, n) {                                                 // the shell falls away: a crumble and a small bright note
    hiss(t, {f: 1400, q: .8, peak: .10 * v, d: .1, type: 'lowpass'}); bell(t + .02, hz(jit(93, .002)), .04 * v, .5, (Math.random() - .5) * .4);
  },
  fullclear(t, v) {                                               // the board is empty: a bright run up, a bell and a shimmer
    [69, 72, 76, 79, 81, 84].forEach((m, i) => pluck(t + i * .055, m, .11 * v, 1.2, (i - 2.5) * .15));
    bell(t + .33, hz(88), .07 * v, 1.8, -.2); bell(t + .40, hz(93), .06 * v, 1.8, .2); sweep(t + .3, 3000, 9000, .5, .05 * v, 1.5);
  },
  finisher(t, v) {                                                // a finishing blow: a rising run, two bells and a long shimmer
    [57, 64, 69, 73, 76, 81, 85, 88].forEach((m, i) => pluck(t + i * .05, m, .13 * v, 1.6, (i - 3.5) * .12));
    bell(t + .42, hz(93), .09 * v, 2.4, -.2); bell(t + .5, hz(81), .08 * v, 2.4, .2); sweep(t + .35, 2000, 8000, .6, .06 * v, 1.8);
  },
  start(t, v) { [57, 64, 69].forEach((m, i) => pluck(t + i * .045, m, .14 * v, 1.4, (i - 1) * .3)); bell(t + .16, hz(81), .08 * v, 1.4); },
  win(t, v) { [69, 73, 76, 81].forEach((m, i) => pluck(t + i * .11, m, .16 * v, 1.6, (i - 1.5) * .2)); [57, 64].forEach(m => pluck(t + .44, m, .12 * v, 2.2)); bell(t + .44, hz(93), .07 * v, 2); },
  end(t, v) { [69, 67, 64, 60].forEach((m, i) => pluck(t + i * .16, m, .14 * v, 1.4)); pluck(t + .64, 45, .12 * v, 2); },
};

let attackVoiced = -1e9;
globalThis.scrapsSfx = (kind, chain = 1, prefs = {}, delay = 0) => {
  if (prefs.sound === false || (prefs.volume ?? .16) <= 0) return;
  try {
    if (!init()) return;
    const nowMs = performance.now();
    if (kind === 'strike' || kind === 'patter') attackVoiced = nowMs + delay * 1000;
    if (kind === 'hit' && nowMs - attackVoiced < 900) return;      // the board already voiced this attack as it landed
    let master = .8; try { master = JSON.parse(localStorage.getItem('scraps.audio') || '{}').master ?? .8; } catch {}
    const v = Math.min(2.5, (prefs.volume ?? .16) / .16) * .9 * Math.max(0, Math.min(1, master)) / .8;
    (SOUNDS[kind] || SOUNDS.lock)(ctx.currentTime + .005 + Math.max(0, delay), v, chain);
  } catch {}
};
// Offline render of one sound for level checks (QA): returns the mono samples.
globalThis.scrapsSfxRender = async (kind, chain = 1, seconds = 2.5) => {
  const OAC = globalThis.OfflineAudioContext; if (!OAC) return null;
  const saved = [ctx, out, verb, noise]; ctx = null;
  const off = new OAC(1, Math.round(44100 * seconds), 44100); ctx = off;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  out = ctx.createGain(); out.connect(comp);
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .32; verb.connect(vg); vg.connect(out);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  try { (SOUNDS[kind])(0.01, 1, chain); const buf = await off.startRendering(); return buf.getChannelData(0); }
  finally { [ctx, out, verb, noise] = saved; }
};

// Menu sounds for every screen, matching the tavern title: a soft lute tick on hover and a
// two-note pluck on select. Follows the Menu sounds slider (scraps.audio ui) and Master.
let lastHover = 0;
globalThis.scrapsUiSound = kind => {
  try {
    let m = {}; try { m = JSON.parse(localStorage.getItem('scraps.audio') || '{}'); } catch {}
    const v = Math.max(0, Math.min(1, m.ui ?? .6)) * Math.max(0, Math.min(1, m.master ?? .8)) * 1.6;
    if (v <= 0 || !init()) return; const t = ctx.currentTime + .005;
    if (kind === 'hover') { if (t - lastHover < .045) return; lastHover = t; pluck(t, 81, .045 * v, .22); }
    else if (kind === 'tab') pluck(t, 76, .07 * v, .4);
    else if (kind === 'back') { pluck(t, 72, .08 * v, .6, .1); pluck(t + .06, 64, .07 * v, .7, -.1); }
    else { pluck(t, 69, .1 * v, .9, -.1); pluck(t + .07, 76, .085 * v, .9, .1); hiss(t, {f: 300, q: .8, peak: .12 * v, d: .05}); }
  } catch {}
};
