// Global Play vs AI counters: for every bot, how many duels everyone has played against it, how many players won,
// the best combo anyone landed on it and the fastest win. Kept in memory and, when SUPABASE_URL and
// SUPABASE_SERVICE_KEY are set, saved to Supabase (table bot_stats in server/supabase.sql) every half minute.
// Results are self-reported by the game, so each address gets a daily cap: these are fun numbers, not rankings.

const BOT = /^[a-z0-9-]{1,32}$/, PER_DAY = 300, FLUSH_MS = 30e3;
const blank = id => ({id, played: 0, playerWins: 0, bestChain: 0, fastestWinMs: 0, totalMs: 0});

export function createBotStats({url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, log = () => {}, fetchImpl = globalThis.fetch, now = () => Date.now(), flushMs = FLUSH_MS} = {}) {
  const bots = new Map(), daily = new Map(), dirty = new Set();
  const remote = !!(url && key && fetchImpl);
  const rest = (path, opts = {}) => fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {...opts,
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {})}});
  const ready = (async () => {
    if (!remote) return;
    try {
      const r = await rest('bot_stats?select=*');
      if (r.ok) for (const row of await r.json()) bots.set(row.id, {id: row.id, played: row.played | 0, playerWins: row.player_wins | 0, bestChain: row.best_chain | 0, fastestWinMs: row.fastest_win_ms | 0, totalMs: Number(row.total_ms) || 0});
      else log('bot stats: could not load from Supabase', r.status);
    } catch (e) { log('bot stats: Supabase unreachable', e.message); }
  })();
  async function flush() {
    if (!remote || !dirty.size) return;
    const rows = [...dirty].map(id => bots.get(id)).map(b => ({id: b.id, played: b.played, player_wins: b.playerWins, best_chain: b.bestChain, fastest_win_ms: b.fastestWinMs, total_ms: b.totalMs}));
    dirty.clear();
    try { const r = await rest('bot_stats', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: JSON.stringify(rows)}); if (!r.ok) log('bot stats: Supabase save failed', r.status); }
    catch (e) { log('bot stats: Supabase save failed', e.message); }
  }
  const timer = remote && flushMs ? setInterval(flush, flushMs) : null; timer?.unref?.();

  // {bot, won, ms, chain} -> true if counted
  function report(m, address = '?') {
    const id = String(m?.bot || ''); if (!BOT.test(id)) return false;
    const ms = Math.max(0, Math.min(36e5, Number(m.ms) || 0)), chain = Math.max(0, Math.min(30, m.chain | 0)), won = m.won === true;
    if (ms < 3000) return false;                                         // not a real duel
    const day = Math.floor(now() / 864e5), d = daily.get(address);
    if (d?.day === day && d.n >= PER_DAY) return false;
    daily.set(address, {day, n: d?.day === day ? d.n + 1 : 1});
    const b = bots.get(id) ?? blank(id); bots.set(id, b);
    b.played++; b.totalMs += ms; if (won) { b.playerWins++; if (!b.fastestWinMs || ms < b.fastestWinMs) b.fastestWinMs = ms; }
    b.bestChain = Math.max(b.bestChain, chain); dirty.add(id);
    return true;
  }
  const list = () => [...bots.values()].map(b => ({...b}));
  return {report, list, flush, ready, remote, stop: () => clearInterval(timer)};
}
