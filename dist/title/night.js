// Night mode: a warm dimming veil over the whole game (menus, boards, Zen), easier on the eyes in a
// dark room. Off / Dim / Dark, saved with the other preferences. The breaker glow also softens.
const LEVELS = ['off', 'dim', 'dark'], LABEL = {off: 'Night off', dim: 'Night: dim', dark: 'Night: dark'};
const prefs = () => { try { return JSON.parse(localStorage.getItem('scraps.preferences') || '{}'); } catch { return {}; } };
let veil = null;
export const nightLevel = () => LEVELS.includes(prefs().night) ? prefs().night : 'off';
export const nightLabel = (n = nightLevel()) => LABEL[n];
function apply(n = nightLevel()) {
  if (typeof document === 'undefined') return;
  if (!veil) { veil = document.createElement('div'); veil.className = 'night-veil'; veil.setAttribute('aria-hidden', 'true'); document.body.append(veil); }
  veil.dataset.level = n; document.documentElement.dataset.night = n;
  for (const fn of listeners) try { fn(n); } catch {}
}
const listeners = new Set();
export function onNight(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setNight(n) {
  if (!LEVELS.includes(n)) n = 'off';
  try { const p = prefs(); p.night = n; localStorage.setItem('scraps.preferences', JSON.stringify(p)); } catch {}
  globalThis.scrapsNightChanged?.(n); apply(n); globalThis.scrapsSkinRefresh?.();
}
export const cycleNight = () => setNight(LEVELS[(LEVELS.indexOf(nightLevel()) + 1) % LEVELS.length]);
if (typeof document !== 'undefined') { if (document.body) apply(); else addEventListener('DOMContentLoaded', () => apply()); }
globalThis.scrapsNight = {setNight, cycleNight, nightLevel, nightLabel, onNight, LEVELS};
