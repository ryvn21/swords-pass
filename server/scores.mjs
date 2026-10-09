// Online results: recent matches, player ratings and the leaderboard.
// Kept in memory and, when SUPABASE_URL and SUPABASE_SERVICE_KEY are set, saved to Supabase so they
// survive restarts (the free Render service sleeps and restarts often). Without them, everything still
// works but resets on restart. Table setup: server/supabase.sql.
//
// Players are identified by a random id their browser keeps (localStorage), not an account, so the
// board is "this browser's record". Duel ratings use Elo (start 1000, K 32); a free-for-all counts as
// the winner beating each other player at half weight.

import {createHash} from 'node:crypto';

const START = 1000, K = 32, RECENT = 30, BOARD = 50;
// the leaderboard shows a short hash, never the browser's own id (which would let anyone play as that browser)
export const publicId = pid => createHash('sha1').update(String(pid)).digest('hex').slice(0, 10);
const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Swordhand';

export function createScores({url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, log = () => {}, fetchImpl = globalThis.fetch} = {}) {
  const players = new Map(), recent = [];
  const remote = !!(url && key && fetchImpl);
  const rest = (path, opts = {}) => fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {...opts,
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {})}});

  const ready = (async () => {
    if (!remote) return;
    try {
      const [p, r] = await Promise.all([rest('players?select=*&order=rating.desc&limit=2000'), rest(`results?select=*&order=at.desc&limit=${RECENT}`)]);
      if (p.ok) for (const row of await p.json()) players.set(row.pid, {pid: row.pid, name: row.name, rating: row.rating, wins: row.wins, losses: row.losses, played: row.played, ffaWins: row.ffa_wins ?? 0});
      if (r.ok) for (const row of (await r.json()).reverse()) recent.unshift({at: Date.parse(row.at), mode: row.mode, winner: row.winner, players: row.players});
      if (!p.ok || !r.ok) log('scores: could not load from Supabase', p.status, r.status);
    } catch (e) { log('scores: Supabase unreachable', e.message); }
  })();

  const player = (pid, name) => {
    let p = players.get(pid);
    if (!p) { p = {pid, name: cleanName(name), rating: START, wins: 0, losses: 0, played: 0, ffaWins: 0}; players.set(pid, p); }
    if (name) p.name = cleanName(name);
    return p;
  };
  const expect = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));

  // placements: [{pid, name, place}] in finishing order (place 1 = winner)
  function record({mode, placements}) {
    const seated = placements.filter(p => p.pid);
    if (seated.length < 2) return null;
    const ps = seated.map(p => player(p.pid, p.name)), before = new Map(ps.map(p => [p.pid, p.rating])), winner = seated.find(p => p.place === 1);
    for (const p of ps) p.played++;
    if (winner) {
      const w = players.get(winner.pid);
      if (mode === 'duel') { w.wins++; } else { w.ffaWins++; w.wins++; }
      for (const p of ps) if (p !== w) {
        p.losses++;
        const k = mode === 'duel' ? K : K / 2, e = expect(before.get(w.pid), before.get(p.pid)), d = Math.round(k * (1 - e));
        w.rating += d; p.rating -= d;
      }
    }
    const entry = {at: Date.now(), mode, winner: winner ? cleanName(winner.name) : null,
      players: seated.map(p => ({name: cleanName(p.name), place: p.place, rating: players.get(p.pid).rating, change: players.get(p.pid).rating - before.get(p.pid)}))};
    recent.unshift(entry); recent.length = Math.min(recent.length, RECENT);
    if (remote) save(ps, entry);
    return entry;
  }
  async function save(ps, entry) {
    try {
      await ready;
      const rows = ps.map(p => ({pid: p.pid, name: p.name, rating: p.rating, wins: p.wins, losses: p.losses, played: p.played, ffa_wins: p.ffaWins, updated_at: new Date().toISOString()}));
      const a = await rest('players?on_conflict=pid', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: JSON.stringify(rows)});
      const b = await rest('results', {method: 'POST', headers: {Prefer: 'return=minimal'}, body: JSON.stringify({at: new Date(entry.at).toISOString(), mode: entry.mode, winner: entry.winner, players: entry.players})});
      if (!a.ok || !b.ok) log('scores: Supabase write failed', a.status, b.status);
    } catch (e) { log('scores: Supabase write failed', e.message); }
  }

  const top = (n = BOARD) => [...players.values()].filter(p => p.played > 0).sort((a, b) => b.rating - a.rating || b.wins - a.wins).slice(0, n)
    .map((p, i) => ({rank: i + 1, id: publicId(p.pid), name: p.name, rating: p.rating, wins: p.wins, losses: p.losses, played: p.played}));
  const ratingOf = pid => players.get(pid)?.rating ?? START;
  return {record, top, ratingOf, recent: (n = RECENT) => recent.slice(0, n), ready, remote, _players: players};
}
