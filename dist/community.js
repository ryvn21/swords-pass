// Community blades: the Forge's shared shelf. Talks to /api/community on the game server (the same
// host as online play). The browser's player id (shared with online play) marks blades as yours.
import {onlineURL} from './online-net.js';

const store = {get: (k, d) => { try { return JSON.parse(localStorage.getItem('scraps.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('scraps.' + k, JSON.stringify(v)); } catch {} }};
export function playerId() {
  let pid = store.get('player-id', '');
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(pid)) { pid = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); store.set('player-id', pid); }
  return pid;
}
// the short public hash of your id the server shows (same as server/scores.mjs publicId); the id itself never leaves in a URL
async function myPublicId() { try { const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(playerId())); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 10); } catch { return ''; } }
export const authorName = () => String(store.get('online-name', '') || 'Swordhand').slice(0, 16);

function base() {
  const ws = onlineURL(); if (!ws) return '';
  try { const u = new URL(ws); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; u.pathname = '/api/community'; u.search = ''; return u.href; } catch { return ''; }
}
// the server address can depend on build.json, which loads just after the page: wait a moment for it
async function endpoint() { let b = base(); for (let i = 0; !b && i < 6; i++) { await new Promise(r => setTimeout(r, 250)); b = base(); } if (!b) throw Error('offline'); return b; }
const post = async (path, body) => { const r = await fetch((await endpoint()) + path, {method: 'POST', headers: {'content-type': 'text/plain'}, body: JSON.stringify(body), cache: 'no-store'}); if (!r.ok) throw Error('server'); return r.json(); };

export async function listCommunity(sort = 'new') {
  const u = new URL(await endpoint()); u.searchParams.set('sort', sort);
  const r = await fetch(u, {cache: 'no-store'}); if (!r.ok) throw Error('server');
  const list = await r.json(), me = await myPublicId();
  return list.map(b => ({...b, mine: !!me && b.authorId === me}));
}
export const shareBlade = ({name, iconId, rows}) => post('', {pid: playerId(), author: authorName(), name, iconId, rows});
export const countCopy = id => post('/use', {id}).catch(() => {});
export const removeBlade = id => post('/remove', {id, pid: playerId()});
// which of your own patterns you've shared (pattern id -> community id), so the Forge can say so
export const sharedMap = () => store.get('community-shared', {});
export const markShared = (patternId, communityId) => { const m = sharedMap(); if (communityId) m[patternId] = communityId; else delete m[patternId]; store.set('community-shared', m); };
