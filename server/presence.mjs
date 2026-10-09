// Who's in the tavern: each open page reports what it's doing every 30 s (an anonymous per-tab
// id, never the player id). Counts only; pages not heard from in 75 s drop out.
export const ACTIVITIES = ['menu', 'online', 'play', 'adventure', 'zen', 'freebuild', 'challenges', 'paired', 'forge', 'replays'];
export function createPresence({now = () => Date.now(), ttl = 75000, max = 20000} = {}) {
  const seen = new Map();
  const prune = () => { const t = now(); for (const [id, v] of seen) if (t - v.at > ttl) seen.delete(id); };
  return {
    report(id, activity) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) return false;
      if (activity === 'gone') { seen.delete(id); return true; }
      if (!ACTIVITIES.includes(activity)) return false;
      if (!seen.has(id) && seen.size >= max) prune();
      if (seen.size < max || seen.has(id)) seen.set(id, {activity, at: now()});
      return true;
    },
    counts() {
      prune(); const by = Object.fromEntries(ACTIVITIES.map(a => [a, 0]));
      for (const v of seen.values()) by[v.activity]++;
      return {total: seen.size, by};
    },
  };
}
