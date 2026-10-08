// Sound settings: one mix shared by the tavern (music, fire, night), menu sounds and game effects.
// Stored in scraps.audio. Game effects keep using prefs.sound / prefs.volume so older code still works.
const read = (k, d) => { try { const v = localStorage.getItem('scraps.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('scraps.' + k, JSON.stringify(v)); } catch {} };

export const DEFAULT_MIX = {master: .8, music: .6, ambience: .55, crackle: .35, ui: .6, musicOn: true, ambienceOn: true};
const EFFECTS_MAX = .32;   // prefs.volume at 100%; the game's default .16 sits at 50%

export function readMix() {
  const old = read('title-audio', null), m = {...DEFAULT_MIX, ...read('audio', {})};
  if (old && read('audio', null) == null) { m.musicOn = old.music !== false; m.ambienceOn = old.ambience !== false; }
  for (const k of ['master', 'music', 'ambience', 'crackle', 'ui']) m[k] = Math.max(0, Math.min(1, Number(m[k]) || 0));
  return m;
}
export function writeMix(m) { save('audio', m); dispatchEvent(new CustomEvent('scraps-audio', {detail: m})); }

// panel rendered inside the game's Settings dialog (app.js calls globalThis.scrapsSoundPanel)
function panel(host, prefs, savePrefs) {
  const m = readMix();
  const effects = Math.round(Math.min(1, (prefs.volume ?? .16) / EFFECTS_MAX) * 100);
  const row = (id, label, value, note = '') => `<label class="snd-row" for="${id}"><span>${label}${note ? `<small>${note}</small>` : ''}</span><input type="range" id="${id}" min="0" max="100" step="1" value="${value}"><output for="${id}">${value}%</output></label>`;
  const tog = (id, label, on) => `<label class="setting-row snd-toggle"><span>${label}</span><input id="${id}" type="checkbox" ${on ? 'checked' : ''}></label>`;
  host.innerHTML = `
    ${row('snd-master', 'Master', Math.round(m.master * 100))}
    <div class="divider"></div>
    ${tog('snd-effects-on', 'Game sounds', prefs.sound !== false)}
    ${row('snd-effects', 'Game effects', effects, 'Moves, breaks, strikes')}
    ${row('snd-ui', 'Menu sounds', Math.round(m.ui * 100))}
    <div class="divider"></div>
    ${tog('snd-music-on', 'Tavern music', m.musicOn)}
    ${row('snd-music', 'Music volume', Math.round(m.music * 100))}
    ${tog('snd-amb-on', 'Fire and night sounds', m.ambienceOn)}
    ${row('snd-amb', 'Ambience volume', Math.round(m.ambience * 100))}
    ${row('snd-crackle', 'Fire crackle', Math.round(m.crackle * 100), 'How often the fire pops')}
    <div class="button-row snd-tests"><button type="button" id="snd-test-break">Test a break</button><button type="button" id="snd-test-hit">Test a strike</button><button type="button" id="snd-reset">Reset</button></div>`;
  const $ = s => host.querySelector(s);
  const bind = (id, fn) => { const el = $('#' + id), out = host.querySelector(`output[for="${id}"]`); el.addEventListener('input', () => { if (out) out.textContent = el.value + '%'; fn(Number(el.value) / 100); }); };
  const setMix = patch => { Object.assign(m, patch); writeMix(m); };
  bind('snd-master', v => setMix({master: v}));
  bind('snd-ui', v => setMix({ui: v}));
  bind('snd-music', v => setMix({music: v}));
  bind('snd-amb', v => setMix({ambience: v}));
  bind('snd-crackle', v => setMix({crackle: v}));
  bind('snd-effects', v => { prefs.volume = +(v * EFFECTS_MAX).toFixed(3); savePrefs(); });
  $('#snd-effects-on').onchange = e => { prefs.sound = e.target.checked; savePrefs(); };
  $('#snd-music-on').onchange = e => setMix({musicOn: e.target.checked});
  $('#snd-amb-on').onchange = e => setMix({ambienceOn: e.target.checked});
  const test = (kind, chain) => globalThis.scrapsSfx?.(kind, chain, {...prefs, sound: true});
  $('#snd-test-break').onclick = () => test('clear', 3);
  $('#snd-test-hit').onclick = () => test('hit', 1);
  $('#snd-reset').onclick = () => { Object.assign(m, DEFAULT_MIX); writeMix(m); prefs.volume = .16; prefs.sound = true; savePrefs(); panel(host, prefs, savePrefs); };
}
if (typeof window !== 'undefined') globalThis.scrapsSoundPanel = panel;
