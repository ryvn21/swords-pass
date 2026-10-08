// Zen music. Plays your own tracks if title/music/zen/playlist.json lists any; otherwise a
// generative late-night jazz trio synthesised live (electric piano, walking bass, brushes,
// vibraphone, a little vinyl hiss). Volume follows the Music slider and Master in Sound settings.
//
// playlist.json: ["track one.mp3", ...] or [{"file": "track.mp3", "title": "...", "artist": "..."}]

const hz = m => 440 * 2 ** ((m - 69) / 12);
const Q = {maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], '13': [0, 4, 10, 14, 21], '7b9': [0, 4, 10, 13], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], '69': [0, 4, 7, 9, 14], maj7: [0, 4, 7, 11]};
// [root midi (bass octave), quality] per bar
const SONGS = [
  {title: 'Hearth Coals', bpm: 72, prog: [[43, 'm9'], [48, '13'], [41, 'maj9'], [38, 'm9'], [46, 'maj9'], [45, 'm7'], [43, 'm9'], [48, '7b9']]},
  {title: 'Rain on the Shutters', bpm: 66, prog: [[39, 'maj9'], [36, 'm9'], [41, 'm9'], [46, '13'], [44, 'maj9'], [43, 'm7'], [41, 'm9'], [46, '7b9']]},
  {title: 'Lantern Walk', bpm: 80, prog: [[38, 'm9'], [43, '13'], [36, 'maj9'], [45, '7b9'], [38, 'm9'], [43, '13'], [40, 'm7b5'], [45, '7b9']]},
  {title: 'Last Orders', bpm: 62, prog: [[41, 'maj9'], [38, 'm9'], [36, 'm9'], [41, '13'], [46, '69'], [45, 'm7'], [43, 'm9'], [48, '13']]},
];
const BASE = new URL('./music/zen/', import.meta.url);
let ctx = null, out = null, bus = null, verb = null, noise = null, timer = null, playing = false, vol = .5;
let song = 0, bar = 0, beat = 0, nextT = 0, chorus = 0, melodyNote = 76, files = null, fileIdx = 0, audioEl = null;
const listeners = new Set();
let rng = 4242; const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);

// Zen keeps its own music volume (the slider on the Zen screen), apart from the tavern's Music and
// Ambience toggles; only the Master level still applies.
export function zenVolume() { try { const v = JSON.parse(localStorage.getItem('scraps.zen-music') ?? 'null'); return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : .6; } catch { return .6; } }
function readVolume() {
  try { const m = JSON.parse(localStorage.getItem('scraps.audio') || '{}'); return zenVolume() * (m.master ?? .8); } catch { return .5; }
}
function emit() { for (const f of listeners) try { f(api.state()); } catch {} }

function build() {
  ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(ctx.destination);
  out = ctx.createGain(); out.gain.value = 0; out.connect(comp);
  bus = ctx.createGain(); bus.connect(out);
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8; }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .26; verb.connect(vg); vg.connect(out);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  // vinyl: a quiet hiss bed and the odd crackle
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = .4;
  const g = ctx.createGain(); g.gain.value = .0012; f.frequency.value = 1400; s.connect(f); f.connect(g); g.connect(bus); s.start();   // barely-there hiss
}
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function epiano(t, m, v, dur) {             // tine piano: sine body, FM bell on the attack, soft tremolo
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
  const fr = hz(m); o.frequency.value = fr; o2.frequency.value = fr * 2; mod.frequency.value = fr * 7;
  mg.gain.setValueAtTime(fr * 1.6, t); mg.gain.exponentialRampToValueAtTime(fr * .02, t + .25); mod.connect(mg); mg.connect(o.frequency);
  const g2 = ctx.createGain(); g2.gain.value = .12; o2.connect(g2); g2.connect(f); o.connect(f);
  f.type = 'lowpass'; f.frequency.value = 2400; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(v * .35, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  p.pan.value = (m - 64) / 40; f.connect(g); g.connect(p); p.connect(bus); const w = ctx.createGain(); w.gain.value = .5; p.connect(w); w.connect(verb);
  for (const x of [o, o2, mod]) { x.start(t); x.stop(t + dur + .05); }
}
function bass(t, m, dur) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(380, t + .2);
  env(g, t, .2, .012, dur); o.connect(f); o2.connect(f); f.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
}
function vibes(t, m, v) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), mix = ctx.createGain(), p = ctx.createStereoPanner();
  o.frequency.value = hz(m); o2.frequency.value = hz(m) * 4.01; const g2 = ctx.createGain(); g2.gain.value = .06; o2.connect(g2); g2.connect(mix); o.connect(mix);
  trem.frequency.value = 5; tg.gain.value = .25; trem.connect(tg); tg.connect(mix.gain); mix.gain.value = .75;
  env(g, t, v, .004, 1.6); p.pan.value = .3; mix.connect(g); g.connect(p); p.connect(bus); const w = ctx.createGain(); w.gain.value = .9; p.connect(w); w.connect(verb);
  for (const x of [o, o2, trem]) { x.start(t); x.stop(t + 1.7); }
}
function hit(t, {f, q = 1, type = 'bandpass', peak, a = .002, d = .06, pan = 0}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  env(g, t, peak, a, d); p.pan.value = pan; s.connect(fl); fl.connect(g); g.connect(p); p.connect(bus); s.start(t, rnd() * 1.5, a + d + .05);
}
function ride(t, v) {                    // soft metallic ride: detuned square partials through a bandpass, not noise
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6200; f.Q.value = 1.4; env(g, t, v, .002, .32);
  for (const fr of [3150, 4720, 5980]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + .36); }
  const p = ctx.createStereoPanner(); p.pan.value = .35; f.connect(g); g.connect(p); p.connect(bus);
}
function kick(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); env(g, t, v, .004, .22); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .3); }

function voicing(root, q) {                 // rootless, kept around middle C
  const tones = Q[q].slice(1).map(i => root + 12 + i);
  return tones.map(n => { while (n < 55) n += 12; while (n > 72) n -= 12; return n; }).sort((a, b) => a - b);
}
function scheduleBeat(t) {
  const S = SONGS[song], spb = 60 / S.bpm, sw = spb * 2 / 3, [root, q] = S.prog[bar % S.prog.length], [nroot] = S.prog[(bar + 1) % S.prog.length];
  // drums: ride on every beat plus the swung "and" of 2 and 4, brushes on 2 and 4, feathered kick
  ride(t, .016 + rnd() * .004);
  if (beat === 1 || beat === 3) { ride(t + sw, .01); hit(t, {f: 1800, q: .9, peak: .008, a: .03, d: .12, pan: -.2}); }
  if (beat === 0 || beat === 2) kick(t, .07);
  // walking bass
  const tones = Q[q], bn = beat === 0 ? root : beat === 1 ? root + tones[1] : beat === 2 ? root + 7 : nroot + (rnd() < .5 ? -1 : 1);
  bass(t, bn > 52 ? bn - 12 : bn, spb * .92);
  // piano comping
  const v = voicing(root, q);
  if (beat === 0) v.forEach((n, i) => epiano(t + i * .012, n, .05, spb * 2.2));
  if (beat === 1 && rnd() < .7) v.forEach((n, i) => epiano(t + sw + i * .01, n, .035, spb * .8));
  if (beat === 3 && rnd() < .35) v.slice(1).forEach((n, i) => epiano(t + sw + i * .01, n, .03, spb * .7));
  // vibraphone: a sparse line from the chord's tones, phrased in pairs of bars
  if ((bar >> 1) % 2 === 1 && rnd() < .55) {
    const pool = Q[q].map(i => root + 24 + i).flatMap(n => [n, n + 12]).filter(n => n >= 67 && n <= 86);
    melodyNote = pool.reduce((best, n) => Math.abs(n - melodyNote - (rnd() * 8 - 4)) < Math.abs(best - melodyNote) ? n : best, pool[0]);
    vibes(t + (rnd() < .5 ? sw : 0), melodyNote, .045);
  }
  if (rnd() < .015) hit(t + rnd() * spb, {f: 2400, q: 6, peak: .006, d: .004});   // the odd vinyl tick
  beat++; if (beat === 4) { beat = 0; bar++; if (bar % S.prog.length === 0 && ++chorus >= 3) { chorus = 0; song = (song + 1) % SONGS.length; emit(); } }
  return spb;
}
function tick() { if (!ctx || !playing) return; while (nextT < ctx.currentTime + .25) nextT += scheduleBeat(nextT); }

async function loadFiles() {
  if (files !== null) return files;
  try {
    const r = await fetch(new URL('playlist.json', BASE)); if (!r.ok) throw 0;
    const list = await r.json();
    files = (Array.isArray(list) ? list : []).map(x => typeof x === 'string' ? {file: x, title: x.replace(/\.[a-z0-9]+$/i, '')} : x).filter(x => x?.file);
  } catch { files = []; }
  return files;
}
function playFile() {
  const tr = files[fileIdx % files.length]; if (!audioEl) { audioEl = new Audio(); audioEl.addEventListener('ended', () => { fileIdx++; playFile(); }); }
  audioEl.src = new URL(tr.file, BASE).href; audioEl.volume = Math.min(1, vol); audioEl.play().catch(() => {}); emit();
}

const api = {
  async start() {
    if (playing) return; playing = true; vol = readVolume();
    await loadFiles(); if (!playing) return;
    if (files.length) { playFile(); return; }
    try { if (!ctx) build(); } catch { playing = false; return; }
    ctx.resume(); nextT = ctx.currentTime + .15; beat = 0;
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(.55 * vol, ctx.currentTime + 2);
    clearInterval(timer); timer = setInterval(tick, 60); tick(); emit();
  },
  stop() {
    if (!playing) return; playing = false;
    if (audioEl) audioEl.pause();
    if (ctx) { const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + .8); setTimeout(() => { if (!playing) { clearInterval(timer); ctx.suspend(); } }, 900); }
    emit();
  },
  toggle() { playing ? api.stop() : api.start(); },
  next(dir = 1) {
    if (files?.length) { fileIdx = (fileIdx + dir + files.length) % files.length; if (playing) playFile(); else emit(); return; }
    song = (song + dir + SONGS.length) % SONGS.length; bar = 0; beat = 0; chorus = 0; emit();
  },
  setVolume(v) { vol = v; if (audioEl) audioEl.volume = Math.min(1, v); if (ctx && playing) out.gain.setTargetAtTime(.55 * v, ctx.currentTime, .3); },
  state() { const f = files?.length ? files[fileIdx % files.length] : null; return {playing, own: !!f, title: f ? (f.title || f.file) : SONGS[song].title, artist: f ? (f.artist || '') : 'The Hearthside Trio'}; },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};
addEventListener('scraps-audio', () => api.setVolume(readVolume()));
globalThis.scrapsZenMusic = api;
export default api;
