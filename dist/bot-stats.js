// Everyone's Play vs AI totals per bot (server/bot-stats.mjs), shown on the lobby. Reports each finished duel.
import {onlineURL} from './online-net.js';

function base() {
  const ws = onlineURL(); if (!ws) return '';
  try { const u = new URL(ws); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; u.pathname = '/api/bots'; u.search = ''; return u.href; } catch { return ''; }
}
let cache = null, at = 0;
// -> Map(botId -> {played, playerWins, bestChain, fastestWinMs, totalMs}); cached for a minute
export async function globalBotStats() {
  if (cache && Date.now() - at < 60e3) return cache;
  const b = base(); if (!b) return cache ?? new Map();
  try { const r = await fetch(b, {cache: 'no-store'}); if (!r.ok) throw 0; cache = new Map((await r.json()).map(s => [s.id, s])); at = Date.now(); } catch {}
  return cache ?? new Map();
}
export function reportBotDuel({bot, won, ms, chain}) {
  const b = base(); if (!b) return;
  fetch(b, {method: 'POST', headers: {'content-type': 'text/plain'}, body: JSON.stringify({bot, won, ms: Math.round(ms), chain}), cache: 'no-store', keepalive: true}).catch(() => {});
  if (cache?.has(bot)) { const s = cache.get(bot); s.played++; if (won) s.playerWins++; }
}
