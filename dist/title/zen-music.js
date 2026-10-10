// Zen music: four stations, each with its own generative band synthesised live, or your own tracks.
//   Tavern Jazz      late-night trio: electric piano, walking bass, brushes, vibraphone        (from the start)
//   Rainy Window     lo-fi beats: dusty drums, wobbly keys, rain on the glass                  (Zen level 2)
//   Lantern Harbour  progressive house: four-on-the-floor, rolling bass, pumping pads, arps    (Zen level 3)
//   Still Water      ambient: slow pads, a low drone, chimes, wind                              (Zen level 5)
// Real tracks: list them in title/music/zen/<station>/playlist.json and that station plays them instead
// (["track.mp3"] or [{"file": "track.mp3", "title": "...", "artist": "..."}]). title/music/zen/playlist.json
// adds a "Your music" station. Every generative station reacts to your combos (react(chain)).
// Volume follows the Zen music slider and Master.

const hz = m => 440 * 2 ** ((m - 69) / 12);
const Q = {maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], '13': [0, 4, 10, 14, 21], '7b9': [0, 4, 10, 13], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], '69': [0, 4, 7, 9, 14], maj7: [0, 4, 7, 11], m: [0, 3, 7], M: [0, 4, 7], sus2: [0, 2, 7], madd9: [0, 3, 7, 14], add9: [0, 4, 7, 14]};
const BASE = new URL('./music/zen/', import.meta.url);
let ctx = null, out = null, bus = null, tone = null, duck = null, verb = null, echo = null, noise = null, timer = null, playing = false, vol = .5;
let nextT = 0, energy = 0, files = {}, audioEl = null, fileIdx = 0, level = 1, rainBed = null;
const listeners = new Set();
let rng = 4242; const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rnd() * a.length)];

// Zen keeps its own music volume (the slider on the Zen screen), apart from the tavern's Music and
// Ambience toggles; only the Master level still applies.
export function zenVolume() { try { const v = JSON.parse(localStorage.getItem('scraps.zen-music') ?? 'null'); return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : .6; } catch { return .6; } }
function readVolume() { try { const m = JSON.parse(localStorage.getItem('scraps.audio') || '{}'); return zenVolume() * (m.master ?? .8); } catch { return .5; } }
const store = {get: (k, d) => { try { return JSON.parse(localStorage.getItem('scraps.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('scraps.' + k, JSON.stringify(v)); } catch {} }};
function emit() { for (const f of listeners) try { f(api.state()); } catch {} }

function build() {
  ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(ctx.destination);
  out = ctx.createGain(); out.gain.value = 0; out.connect(comp);
  tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = .5; tone.connect(out);   // a station's overall colour (lo-fi muffles it)
  bus = ctx.createGain(); bus.connect(tone);
  duck = ctx.createGain(); duck.connect(bus);                                                                                  // sidechained parts (house)
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .26; verb.connect(vg); vg.connect(tone);
  echo = ctx.createDelay(1.5); const fb = ctx.createGain(), ef = ctx.createBiquadFilter(), eg = ctx.createGain(); fb.gain.value = .38; ef.type = 'lowpass'; ef.frequency.value = 3200; eg.gain.value = .3;
  echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(eg); eg.connect(tone); eg.connect(verb);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}
const toVerb = (node, amt) => { const w = ctx.createGain(); w.gain.value = amt; node.connect(w); w.connect(verb); };
const toEcho = (node, amt) => { const w = ctx.createGain(); w.gain.value = amt; node.connect(w); w.connect(echo); };
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function noiseHit(t, {f, q = 1, type = 'bandpass', peak, a = .002, d = .06, pan = 0, dest = bus}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  env(g, t, peak, a, d); p.pan.value = pan; s.connect(fl); fl.connect(g); g.connect(p); p.connect(dest); s.start(t, rnd() * 1.5, a + d + .05); return p;
}
// a looping noise bed (rain, wind, vinyl), faded in and out with the station
function bed({f, q = .5, type = 'lowpass', gain, f2, lfo = 0}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  let tail = fl; if (f2) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = f2; fl.connect(h); tail = h; }
  g.gain.value = 0; g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 2.5); tail.connect(g); g.connect(bus); s.connect(fl); s.start();
  if (lfo) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = lfo; og.gain.value = f * .45; o.connect(og); og.connect(fl.frequency); o.start(); s.onended = () => o.stop(); }
  return {stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1); s.stop(t + 1.1); }};
}
function voicing(root, q, lo = 55, hi = 72) { return Q[q].slice(1).map(i => root + 12 + i).map(n => { while (n < lo) n += 12; while (n > hi) n -= 12; return n; }).sort((a, b) => a - b); }

// ---------------- Tavern Jazz ----------------
function epiano(t, m, v, dur, dest = bus, bright = 2400) {      // tine piano: sine body, FM bell on the attack
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
  const fr = hz(m); o.frequency.value = fr; o2.frequency.value = fr * 2; mod.frequency.value = fr * 7;
  mg.gain.setValueAtTime(fr * 1.6, t); mg.gain.exponentialRampToValueAtTime(fr * .02, t + .25); mod.connect(mg); mg.connect(o.frequency);
  const g2 = ctx.createGain(); g2.gain.value = .12; o2.connect(g2); g2.connect(f); o.connect(f);
  f.type = 'lowpass'; f.frequency.value = bright; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(v * .35, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  p.pan.value = (m - 64) / 40; f.connect(g); g.connect(p); p.connect(dest); toVerb(p, .5);
  for (const x of [o, o2, mod]) { x.start(t); x.stop(t + dur + .05); }
  return o;
}
function walkBass(t, m, dur) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(380, t + .2);
  env(g, t, .2, .012, dur); o.connect(f); o2.connect(f); f.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
}
function vibes(t, m, v) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), mix = ctx.createGain(), p = ctx.createStereoPanner();
  o.frequency.value = hz(m); o2.frequency.value = hz(m) * 4.01; const g2 = ctx.createGain(); g2.gain.value = .06; o2.connect(g2); g2.connect(mix); o.connect(mix);
  trem.frequency.value = 5; tg.gain.value = .25; trem.connect(tg); tg.connect(mix.gain); mix.gain.value = .75;
  env(g, t, v, .004, 1.6); p.pan.value = .3; mix.connect(g); g.connect(p); p.connect(bus); toVerb(p, .9);
  for (const x of [o, o2, trem]) { x.start(t); x.stop(t + 1.7); }
}
function ride(t, v) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6200; f.Q.value = 1.4; env(g, t, v, .002, .32);
  for (const fr of [3150, 4720, 5980]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + .36); }
  const p = ctx.createStereoPanner(); p.pan.value = .35; f.connect(g); g.connect(p); p.connect(bus);
}
function softKick(t, v, from = 70, to = 42, d = .22) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + .12); env(g, t, v, .004, d); o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + .08); }

const jazz = {
  id: 'jazz', name: 'Tavern Jazz', artist: 'The Hearthside Trio', blurb: 'Late-night trio', level: 1,
  songs: [
    {title: 'Hearth Coals', bpm: 72, prog: [[43, 'm9'], [48, '13'], [41, 'maj9'], [38, 'm9'], [46, 'maj9'], [45, 'm7'], [43, 'm9'], [48, '7b9']]},
    {title: 'Rain on the Shutters', bpm: 66, prog: [[39, 'maj9'], [36, 'm9'], [41, 'm9'], [46, '13'], [44, 'maj9'], [43, 'm7'], [41, 'm9'], [46, '7b9']]},
    {title: 'Lantern Walk', bpm: 80, prog: [[38, 'm9'], [43, '13'], [36, 'maj9'], [45, '7b9'], [38, 'm9'], [43, '13'], [40, 'm7b5'], [45, '7b9']]},
    {title: 'Last Orders', bpm: 62, prog: [[41, 'maj9'], [38, 'm9'], [36, 'm9'], [41, '13'], [46, '69'], [45, 'm7'], [43, 'm9'], [48, '13']]},
  ],
  reset() { this.bar = 0; this.beat = 0; this.chorus = 0; this.mel = 76; },
  start() { this.hiss = bed({f: 1400, type: 'bandpass', q: .4, gain: .0012}); },
  stop() { this.hiss?.stop(); },
  react(chain) { const S = this.songs[song], [root, q] = S.prog[this.bar % S.prog.length], t = ctx.currentTime + .05;    // a little vibraphone run up the chord
    const pool = Q[q].map(i => root + 24 + i).flatMap(n => [n, n + 12]).filter(n => n >= 67 && n <= 91).sort((a, b) => a - b), n = Math.min(pool.length, 2 + chain);
    for (let i = 0; i < n; i++) vibes(t + i * .09, pool[i], .03 + chain * .006); },
  step(t) {
    const S = this.songs[song], spb = 60 / S.bpm, sw = spb * 2 / 3, [root, q] = S.prog[this.bar % S.prog.length], [nroot] = S.prog[(this.bar + 1) % S.prog.length], beat = this.beat;
    ride(t, .016 + rnd() * .004 + energy * .006);
    if (beat === 1 || beat === 3) { ride(t + sw, .01); noiseHit(t, {f: 1800, q: .9, peak: .008, a: .03, d: .12, pan: -.2}); }
    if (beat === 0 || beat === 2) softKick(t, .07);
    const tones = Q[q], bn = beat === 0 ? root : beat === 1 ? root + tones[1] : beat === 2 ? root + 7 : nroot + (rnd() < .5 ? -1 : 1);
    walkBass(t, bn > 52 ? bn - 12 : bn, spb * .92);
    const v = voicing(root, q);
    if (beat === 0) v.forEach((n, i) => epiano(t + i * .012, n, .05, spb * 2.2));
    if (beat === 1 && rnd() < .7) v.forEach((n, i) => epiano(t + sw + i * .01, n, .035, spb * .8));
    if (beat === 3 && rnd() < .35 + energy * .4) v.slice(1).forEach((n, i) => epiano(t + sw + i * .01, n, .03, spb * .7));
    if (((this.bar >> 1) % 2 === 1 && rnd() < .55) || rnd() < energy * .5) {
      const pool = Q[q].map(i => root + 24 + i).flatMap(n => [n, n + 12]).filter(n => n >= 67 && n <= 86);
      this.mel = pool.reduce((best, n) => Math.abs(n - this.mel - (rnd() * 8 - 4)) < Math.abs(best - this.mel) ? n : best, pool[0]);
      vibes(t + (rnd() < .5 ? sw : 0), this.mel, .045);
    }
    if (rnd() < .015) noiseHit(t + rnd() * spb, {f: 2400, q: 6, peak: .006, d: .004});
    if (++this.beat === 4) { this.beat = 0; this.bar++; if (this.bar % S.prog.length === 0 && ++this.chorus >= 3) nextSong(); }
    return spb;
  },
};

// ---------------- Rainy Window (lo-fi) ----------------
function dustKick(t, v) { softKick(t, v, 110, 45, .3); noiseHit(t, {f: 120, type: 'lowpass', peak: v * .2, d: .05}); }
function dustSnare(t, v) { noiseHit(t, {f: 1900, q: .8, peak: v, d: .16, pan: -.05}); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + .08); env(g, t, v * .9, .002, .1); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .15); }
function subBass(t, m, dur, v = .22) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz(m); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.setValueAtTime(v, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .05); }
const lofi = {
  id: 'lofi', name: 'Rainy Window', artist: 'Window Seat', blurb: 'Lo-fi beats and rain', level: 2,
  songs: [
    {title: 'Fogged Glass', bpm: 78, prog: [[41, 'maj9'], [40, 'm7'], [38, 'm9'], [36, 'maj7']]},
    {title: 'Kettle On', bpm: 84, prog: [[45, 'm9'], [38, '13'], [43, 'maj9'], [48, 'maj7']]},
    {title: 'Puddle Lights', bpm: 74, prog: [[44, 'maj9'], [43, 'm7'], [41, 'm9'], [46, '13']]},
  ],
  reset() { this.bar = 0; this.s = 0; this.loops = 0; },
  start() { tone.frequency.setTargetAtTime(2600, ctx.currentTime, .4); this.rain = bed({f: 2400, f2: 400, type: 'lowpass', gain: .028, lfo: .07}); this.crackle = bed({f: 3000, type: 'bandpass', q: .3, gain: .0025}); },
  stop() { tone.frequency.setTargetAtTime(20000, ctx.currentTime, .3); this.rain?.stop(); this.crackle?.stop(); },
  react(chain) { tone.frequency.cancelScheduledValues(ctx.currentTime); tone.frequency.setTargetAtTime(Math.min(9000, 3200 + chain * 1100), ctx.currentTime, .05); tone.frequency.setTargetAtTime(2600, ctx.currentTime + 1.2, .8); },
  step(t) {    // sixteenths, swung
    const S = this.songs[song], q16 = 60 / S.bpm / 4, s = this.s, swing = s % 2 ? q16 * .16 : 0, tt = t + swing, [root, q] = S.prog[this.bar % S.prog.length];
    if (s === 0 || s === 10 || (s === 7 && rnd() < .35)) dustKick(tt, .45);
    if (s === 4 || s === 12) dustSnare(tt + .01, .05);
    if (s % 2 === 0) noiseHit(tt, {f: 7800, type: 'highpass', peak: s % 4 ? .006 : .011, d: .03, pan: .25});
    if (s === 0) { subBass(tt, root - 12 < 28 ? root : root - 12, q16 * 7); voicing(root, q, 57, 74).forEach((n, i) => epiano(tt + i * .028, n, .045, q16 * 14, bus, 1500)); }
    if (s === 8 && rnd() < .6) subBass(tt, root - 12 + (rnd() < .5 ? 7 : 0) < 28 ? root + 7 : root - 12 + 7, q16 * 4);
    if (s === 14 && rnd() < .5 + energy * .4) voicing(root, q, 57, 74).slice(-2).forEach((n, i) => epiano(tt + i * .02, n, .03, q16 * 3, bus, 1700));
    if ((s === 6 || s === 11) && rnd() < .25 + energy * .5) { const pool = Q[q].map(i => root + 24 + i).filter(n => n >= 69 && n <= 84); if (pool.length) epiano(tt, pick(pool), .03, q16 * 4, bus, 2200); }
    if (rnd() < .06) noiseHit(t + rnd() * q16, {f: 5200 + rnd() * 2000, q: 8, peak: .004, d: .01, pan: rnd() * 1.6 - .8});   // drops on the glass
    if (++this.s === 16) { this.s = 0; this.bar++; if (this.bar % (S.prog.length * 4) === 0 && ++this.loops >= 2) nextSong(); }
    return q16;
  },
};

// ---------------- Lantern Harbour (progressive house) ----------------
function houseKick(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + .1);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .38); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .4);
  noiseHit(t, {f: 3500, type: 'highpass', peak: v * .05, d: .008});
  duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(.22, t); duck.gain.linearRampToValueAtTime(1, t + .23);     // sidechain pump
}
function clap(t, v) { for (const [dt, k] of [[0, .6], [.011, .8], [.022, 1]]) noiseHit(t + dt, {f: 1500, q: 1.2, peak: v * k, d: dt === .022 ? .16 : .01}); }
function houseHat(t, v, open = false, pan = .2) { noiseHit(t, {f: 9000, type: 'highpass', peak: v, d: open ? .16 : .035, pan}); }
function saw(t, m, dur, {v = .03, cut = 1200, res = 2, a = .005, rel = .08, det = 0, dest = duck, sweep = 0, type = 'sawtooth', pan = 0} = {}) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); f.type = 'lowpass'; f.Q.value = res; f.frequency.setValueAtTime(cut, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, cut * sweep), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + Math.max(a, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
  const oscs = (det ? [-det, 0, det] : [0]).map(d => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = d; o.connect(f); return o; });
  p.pan.value = pan; f.connect(g); g.connect(p); p.connect(dest); for (const o of oscs) { o.start(t); o.stop(t + dur + .05); } return p;
}
const house = {
  id: 'house', name: 'Lantern Harbour', artist: 'Night Tide', blurb: 'Progressive house', level: 3,
  // 8-bar loops of two-bar chords, minor keys; each song runs a 64-bar arrangement (intro, groove, lift, breakdown, drop)
  songs: [
    {title: 'Harbour Lights', bpm: 122, prog: [[45, 'madd9'], [41, 'add9'], [48, 'add9'], [43, 'sus2']]},
    {title: 'Undertow', bpm: 124, prog: [[41, 'madd9'], [37, 'add9'], [44, 'add9'], [39, 'sus2']]},
    {title: 'Lantern Drift', bpm: 120, prog: [[38, 'madd9'], [46, 'add9'], [41, 'add9'], [36, 'sus2']]},
  ],
  reset() { this.bar = 0; this.s = 0; this.arp = 0; },
  start() {},
  stop() { duck.gain.cancelScheduledValues(ctx.currentTime); duck.gain.setValueAtTime(1, ctx.currentTime); },
  react(chain) { const t = ctx.currentTime + .03; noiseHit(t, {f: 6000, type: 'highpass', peak: .02 + chain * .006, d: .9 + chain * .2, pan: 0, dest: bus}); },   // a cymbal swell on each combo
  step(t) {
    const S = this.songs[song], q16 = 60 / S.bpm / 4, s = this.s, sec = this.bar % 64, [root, q] = S.prog[Math.floor(this.bar / 2) % S.prog.length];
    const breakdown = sec >= 32 && sec < 40, full = sec >= 40, groove = sec >= 8, lift = sec >= 16, lift2 = full || (lift && !breakdown);
    const open = Math.min(1, (sec % 64) / 64 + energy * .6), cut = breakdown ? 500 + (sec - 32) * 260 + s * 16 : 900 + open * 2600;
    // drums
    if (!breakdown && s % 4 === 0) houseKick(t, .62);
    if (!breakdown && s % 4 === 2) houseHat(t, .02 + energy * .01, true, .15);
    if (groove && !breakdown && (s === 4 || s === 12)) clap(t, .05);
    if (full && s % 4 !== 2) houseHat(t, s % 2 ? .006 : .009, false, -.2);
    if (lift && !breakdown && s % 8 === 6 && rnd() < .5) noiseHit(t, {f: 400, q: 3, peak: .02, d: .05, pan: -.3});      // a woody perc tick
    // rolling bass: root on the offbeat 16ths, octave jumps in the drop
    if (groove && !breakdown && s % 4 !== 0) { const m = (root < 40 ? root : root - 12) + (full && s % 4 === 3 && rnd() < .3 ? 12 : 0); saw(t, m, q16 * .9, {v: .07, cut: 300 + open * 500, res: 6, rel: .03, sweep: .5}); }
    // pads: wide detuned saws through a slowly opening filter, held for the two bars
    if (lift && s === 0 && this.bar % 2 === 0) { const pv = voicing(root, q, 57, 76); for (const n of pv) { const p = saw(t, n, q16 * 32, {v: .014, cut, res: 1, a: .3, rel: .5, det: 14, pan: (n - 66) / 18}); toVerb(p, .5); } }
    // plucked arp in sixteenths up the chord, through a dotted-eighth echo
    if ((lift || breakdown) && s % (full ? 1 : 2) === 0) {
      const tones = voicing(root, q, 64, 84), n = tones[this.arp++ % tones.length] + (s >= 8 && full ? 12 : 0);
      const p = saw(t, n, q16 * .9, {v: .022, cut: 1400 + open * 3200, res: 4, a: .002, rel: .1, sweep: .25, type: 'square', dest: breakdown ? bus : duck, pan: s % 4 < 2 ? -.3 : .3}); toEcho(p, .5);
    }
    // the breakdown's riser: noise sweeping up into the drop
    if (sec === 38 && s === 0) { const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), len = q16 * 32; src.buffer = noise; src.loop = true; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + len); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + len); g.gain.linearRampToValueAtTime(0, t + len + .02); src.connect(f); f.connect(g); g.connect(bus); toVerb(g, .6); src.start(t); src.stop(t + len + .05); }
    if (sec === 40 && s === 0) noiseHit(t, {f: 5000, type: 'highpass', peak: .05, d: 1.6});                                   // crash into the drop
    if (++this.s === 16) { this.s = 0; this.bar++; if (this.bar % 64 === 0) nextSong(); }
    return q16;
  },
};

// ---------------- Still Water (ambient) ----------------
function swell(t, m, dur, v, type = 'triangle', pan = 0) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = type; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m); o2.detune.value = 7;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur); p.pan.value = pan; o.connect(g); o2.connect(g); g.connect(p); p.connect(bus); toVerb(p, 1.2);
  o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
}
function chime(t, m, v) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.76; const g2 = ctx.createGain(); g2.gain.value = .15; o2.connect(g2); g2.connect(g); o.connect(g); env(g, t, v, .003, 3.2); p.pan.value = rnd() * 1.4 - .7; g.connect(p); p.connect(bus); toVerb(p, 1.4); toEcho(p, .3); o.start(t); o2.start(t); o.stop(t + 3.3); o2.stop(t + 3.3); }
const ambient = {
  id: 'ambient', name: 'Still Water', artist: 'Mooring', blurb: 'Ambient, slow and wide', level: 5,
  songs: [
    {title: 'Low Tide', bpm: 60, prog: [[38, 'add9'], [43, 'maj7'], [36, 'add9'], [41, 'maj7']], scale: [62, 64, 66, 69, 71, 74, 76, 78, 81]},
    {title: 'Mist on the Moor', bpm: 56, prog: [[40, 'madd9'], [36, 'maj7'], [43, 'add9'], [38, 'sus2']], scale: [64, 67, 69, 71, 74, 76, 79, 81]},
    {title: 'Candle Hours', bpm: 58, prog: [[41, 'maj7'], [46, 'add9'], [43, 'm7'], [36, 'sus2']], scale: [65, 67, 69, 72, 74, 77, 79, 81]},
  ],
  reset() { this.bar = 0; this.beat = 0; },
  start() { this.wind = bed({f: 600, q: 1.2, type: 'bandpass', gain: .012, lfo: .05}); },
  stop() { this.wind?.stop(); },
  react(chain) { const S = this.songs[song], t = ctx.currentTime + .05; for (let i = 0; i < Math.min(6, 1 + chain); i++) chime(t + i * .16, S.scale[(i * 2 + chain) % S.scale.length], .06); },
  step(t) {
    const S = this.songs[song], spb = 60 / S.bpm, [root, q] = S.prog[Math.floor(this.bar / 4) % S.prog.length];
    if (this.bar % 4 === 0 && this.beat === 0) { swell(t, root - 12, spb * 17, .11, 'sine'); voicing(root, q, 55, 74).forEach((n, i) => swell(t + i * .4, n, spb * 16.5, .04, 'triangle', (i - 1.5) * .35)); }
    if (rnd() < .22 + energy * .5) chime(t + rnd() * spb * .5, pick(S.scale), .045 + rnd() * .03);
    if (++this.beat === 4) { this.beat = 0; this.bar++; if (this.bar % 32 === 0) nextSong(); }
    return spb;
  },
};

const STATIONS = [jazz, lofi, house, ambient];
const own = {id: 'own', name: 'Your music', artist: '', blurb: 'Your own tracks', level: 1, songs: [{title: ''}]};
let station = STATIONS.find(s => s.id === store.get('zen-station', 'jazz')) || jazz, song = 0;
function nextSong(dir = 1) { song = (song + dir + station.songs.length) % station.songs.length; station.reset(); emit(); }

async function loadFiles(id) {
  if (files[id]) return files[id];
  try {
    const r = await fetch(new URL(id === 'own' ? 'playlist.json' : id + '/playlist.json', BASE)); if (!r.ok) throw 0;
    const list = await r.json(), dir = id === 'own' ? '' : id + '/';
    files[id] = (Array.isArray(list) ? list : []).map(x => typeof x === 'string' ? {file: x, title: x.replace(/\.[a-z0-9]+$/i, '')} : x).filter(x => x?.file).map(x => ({...x, file: dir + x.file}));
  } catch { files[id] = []; }
  return files[id];
}
const list = () => files[station.id] || [];
function playFile() {
  const tr = list()[fileIdx % list().length]; if (!audioEl) { audioEl = new Audio(); audioEl.addEventListener('ended', () => { fileIdx++; playFile(); }); }
  audioEl.src = new URL(tr.file, BASE).href; audioEl.volume = Math.min(1, vol); audioEl.play().catch(() => {}); emit();
}
function tick() { if (!ctx || !playing || !station.step) return; energy *= .985; while (nextT < ctx.currentTime + .25) nextT += station.step(nextT); }
function startGenerative() {
  try { if (!ctx) build(); } catch { playing = false; return; }
  ctx.resume(); nextT = ctx.currentTime + .15; station.reset(); station.start();
  out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(.55 * vol, ctx.currentTime + 2);
  clearInterval(timer); timer = setInterval(tick, 60); tick();
}
function stopSound(fade = .8) {
  if (audioEl) audioEl.pause();
  clearInterval(timer); timer = null;
  if (ctx) { station.stop?.(); const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade); }
}
async function begin() {
  await loadFiles(station.id); if (!playing) return;
  if (list().length) { fileIdx = 0; playFile(); } else if (station.step) startGenerative();
  emit();
}

const api = {
  async start() { if (playing) return; playing = true; vol = readVolume(); if (level < station.level) { station = jazz; song = 0; } loadFiles('own').then(emit); await begin(); },
  stop() { if (!playing) return; playing = false; stopSound(); setTimeout(() => { if (!playing && ctx) ctx.suspend(); }, 900); emit(); },
  toggle() { playing ? api.stop() : api.start(); },
  next(dir = 1) {
    if (list().length) { fileIdx = (fileIdx + dir + list().length) % list().length; if (playing) playFile(); else emit(); return; }
    nextSong(dir);
  },
  // stations unlock with your Zen level; "Your music" appears when title/music/zen/playlist.json lists tracks
  stations() { return [...STATIONS, ...(files.own?.length ? [own] : [])].map(s => ({id: s.id, name: s.name, blurb: s.blurb, level: s.level, locked: level < s.level, current: s === station})); },
  setLevel(n) { level = n; emit(); },
  async setStation(id) {
    const s = [...STATIONS, own].find(x => x.id === id); if (!s || level < s.level || s === station) return;
    if (playing) stopSound(.4); station = s; song = 0; store.set('zen-station', id); emit();
    if (playing) { await new Promise(r => setTimeout(r, 420)); if (playing && station === s) { if (ctx) { const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(0, t); } await begin(); } }
  },
  react(chain = 1) { energy = Math.min(1, energy + .15 + chain * .1); if (playing && ctx && !list().length && station.react && chain >= 2) try { station.react(chain); } catch {} },
  setVolume(v) { vol = v; if (audioEl) audioEl.volume = Math.min(1, v); if (ctx && playing && timer) out.gain.setTargetAtTime(.55 * v, ctx.currentTime, .3); },
  state() { const f = list().length ? list()[fileIdx % list().length] : null; return {playing, own: !!f, station: station.id, stationName: station.name, title: f ? (f.title || f.file) : station.songs[song].title, artist: f ? (f.artist || '') : station.artist}; },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
  // previews and tests: schedule ahead to `until` seconds, optionally from a given bar
  _ctx() { return ctx; },
  _schedule(until, fromBar) { if (fromBar != null) station.bar = fromBar; while (nextT < until) nextT += station.step(nextT); },
};
if (station === own) station = jazz;
addEventListener('scraps-audio', () => api.setVolume(readVolume()));
globalThis.scrapsZenMusic = api;
export default api;
