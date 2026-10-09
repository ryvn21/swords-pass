// Who's in the tavern: this page tells the server what it's doing (an anonymous id per tab) every
// 30 s and whenever that changes, and gets back how many are playing each activity.
import {onlineURL} from './online-net.js';

export const ACTIVITY_LABEL = {online: 'playing online', play: 'vs AI', adventure: 'in Adventure', zen: 'in Zen', freebuild: 'in Freebuild', challenges: 'in challenges', paired: 'in paired duels', forge: 'in the Forge', replays: 'watching replays', menu: 'at the bar'};
const tabId = (() => { try { let id = sessionStorage.getItem('scraps.tab'); if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('scraps.tab', id); } return id; } catch { return Math.random().toString(36).slice(2, 14); } })();
const listeners = new Set();
let activity = 'menu', counts = null, timer = null;

const endpoint = () => { const ws = onlineURL(); if (!ws) return ''; try { const u = new URL(ws); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; u.pathname = '/api/presence'; u.search = ''; return u.href; } catch { return ''; } };
async function report() {
  const url = endpoint(); if (!url) return;
  try {
    const r = await fetch(url, {method: 'POST', headers: {'content-type': 'text/plain'}, body: JSON.stringify({id: tabId, a: activity}), cache: 'no-store'});
    if (r.ok) { counts = await r.json(); for (const fn of listeners) try { fn(counts); } catch {} }
  } catch {}
}
function schedule(delay = 30000) { clearTimeout(timer); timer = setTimeout(() => { report(); schedule(); }, delay); }

export function setActivity(a) { if (!a || a === activity) return; activity = a; schedule(400); }
export function onPresence(fn) { listeners.add(fn); if (counts) fn(counts); return () => listeners.delete(fn); }
export const presenceCounts = () => counts;

// first report shortly after load (the server address may need build.json first), then every 30 s
schedule(1200);
addEventListener('pagehide', () => { const url = endpoint(); if (url) try { navigator.sendBeacon?.(url, new Blob([JSON.stringify({id: tabId, a: 'gone'})], {type: 'text/plain'})); } catch {} });
globalThis.scrapsPresence = {setActivity, onPresence, presenceCounts, ACTIVITY_LABEL};
