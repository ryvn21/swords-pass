// Community blades: patterns players share from the Forge for anyone to copy.
// Kept in memory and, when SUPABASE_URL and SUPABASE_SERVICE_KEY are set, saved to Supabase so they
// survive restarts (table: community_blades in server/supabase.sql). Without Supabase it all still
// works but resets whenever the free Render service restarts.
//
// No accounts: a blade's author is the browser's player id, stored only as a short hash (publicId),
// so the author can remove their own blade and nobody else's. Names go through the same filter as
// online names. Each address can share a handful of blades a day.

import {randomUUID} from 'node:crypto';
import {offensive} from '../dist/name-filter.js';
import {validatePattern} from '../dist/engine.js';
import {publicId} from './scores.mjs';

const MAX = 500, PER_DAY = 8, ICON = /^[a-z0-9-]{1,32}$/;
const clean = (s, n, fallback) => { const t = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n); return t || fallback; };
const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createCommunity({url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, log = () => {}, fetchImpl = globalThis.fetch, now = () => Date.now()} = {}) {
  const blades = [];                 // newest first: {id, name, iconId, rows, author, authorId, at, uses}
  const daily = new Map();           // address -> {day, n}
  const remote = !!(url && key && fetchImpl);
  const rest = (path, opts = {}) => fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {...opts,
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {})}});
  const write = (what, go) => { if (remote) go().then(r => { if (!r.ok) log(`community: Supabase ${what} failed`, r.status); }).catch(e => log(`community: Supabase ${what} failed`, e.message)); };

  const ready = (async () => {
    if (!remote) return;
    try {
      const r = await rest(`community_blades?select=*&order=at.desc&limit=${MAX}`);
      if (r.ok) for (const row of await r.json()) if (validatePattern(row.rows)) blades.push({id: row.id, name: row.name, iconId: row.icon_id, rows: row.rows, author: row.author, authorId: row.author_id, at: Date.parse(row.at), uses: row.uses ?? 0});
      else log('community: could not load from Supabase', r.status);
    } catch (e) { log('community: Supabase unreachable', e.message); }
  })();

  const view = b => ({id: b.id, name: b.name, iconId: b.iconId, rows: b.rows, author: b.author, authorId: b.authorId, at: b.at, uses: b.uses});

  // sort: 'new' (default) or 'popular'
  function list({sort = 'new', limit = 100} = {}) {
    const all = sort === 'popular' ? [...blades].sort((a, b) => b.uses - a.uses || b.at - a.at) : blades;
    return all.slice(0, Math.min(limit, MAX)).map(view);
  }

  // -> {ok, blade} or {ok: false, error}
  function share({pid, author, name, iconId, rows}, address = '?') {
    if (!/^[A-Za-z0-9_-]{12,64}$/.test(String(pid || ''))) return {ok: false, error: 'Play online once first so your blades have an owner.'};
    if (!validatePattern(rows)) return {ok: false, error: 'A blade needs 3–6 rows of six colours.'};
    const n = clean(name, 32, ''), a = clean(author, 16, 'Swordhand');
    if (!n) return {ok: false, error: 'Give your blade a name first.'};
    if (offensive(n) || offensive(a)) return {ok: false, error: 'That name isn’t allowed. Pick another.'};
    const authorId = publicId(pid);
    const dupe = blades.find(b => sameRows(b.rows, rows));
    if (dupe) return dupe.authorId === authorId ? {ok: true, blade: view(dupe), already: true} : {ok: false, error: `That pattern is already shared as ${dupe.name}.`};
    const day = Math.floor(now() / 864e5), d = daily.get(address);
    if (d?.day === day && d.n >= PER_DAY) return {ok: false, error: 'That’s enough sharing for today. Try again tomorrow.'};
    daily.set(address, {day, n: d?.day === day ? d.n + 1 : 1});
    const b = {id: randomUUID(), name: n, iconId: ICON.test(String(iconId)) ? iconId : 'custom', rows: rows.map(r => r.slice()), author: a, authorId, at: now(), uses: 0};
    blades.unshift(b); if (blades.length > MAX) blades.length = MAX;
    write('share', () => rest('community_blades', {method: 'POST', headers: {Prefer: 'return=minimal'},
      body: JSON.stringify({id: b.id, name: b.name, icon_id: b.iconId, rows: b.rows, author: b.author, author_id: b.authorId, at: new Date(b.at).toISOString(), uses: 0})}));
    return {ok: true, blade: view(b)};
  }

  // someone copied it into their library
  function use(id) {
    const b = blades.find(x => x.id === id); if (!b) return false;
    b.uses++;
    write('use', () => rest(`community_blades?id=eq.${encodeURIComponent(id)}`, {method: 'PATCH', headers: {Prefer: 'return=minimal'}, body: JSON.stringify({uses: b.uses})}));
    return true;
  }

  // only the author can take a blade down
  function remove(id, pid) {
    const i = blades.findIndex(x => x.id === id);
    if (i < 0 || !pid || blades[i].authorId !== publicId(pid)) return false;
    blades.splice(i, 1);
    write('remove', () => rest(`community_blades?id=eq.${encodeURIComponent(id)}`, {method: 'DELETE', headers: {Prefer: 'return=minimal'}}));
    return true;
  }

  return {list, share, use, remove, ready, remote, _blades: blades};
}
