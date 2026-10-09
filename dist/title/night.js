// Night mode: the scenery behind the boards turns to night (darker, cooler, a deeper vignette) and the
// tavern on the title dims; boards, pieces and text stay exactly as crisp as by day. Breaker glow softens.
// On or off, saved with the other preferences.
const LEVELS = ['off', 'on'], LABEL = {off: 'Night off', on: 'Night on'};
const prefs = () => { try { return JSON.parse(localStorage.getItem('scraps.preferences') || '{}'); } catch { return {}; } };
export const nightLevel = () => { const n = prefs().night; return n && n !== 'off' ? 'on' : 'off'; };
export const nightLabel = (n = nightLevel()) => LABEL[n];
function apply(n = nightLevel()) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.night = n;
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
