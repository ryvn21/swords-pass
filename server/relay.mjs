// Scraps online relay: matchmaking, rooms, message relay and the referee for results.
// Transport-agnostic: connect(socket) takes anything with send(text), close() and settable
// onMessage / onClose. Each client simulates its own board; the server only routes board
// snapshots and attack batches, and decides who topped out first.
import {publicId as pubId} from './scores.mjs';
export const PROTOCOL = 1;
const MODES = {duel: {min: 2, max: 2}, ffa: {min: 2, max: 4}};
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export function createRelay({now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random,
  countdownMs = 3600, resumeMs = 20000, ffaFillMs = 15000, build = null, scores = null, log = () => {}} = {}) {
  const clients = new Map(), tokens = new Map(), rooms = new Map(), queues = {duel: [], ffa: []};
  let ffaTimer = null;
  let nextId = 1;
  const id36 = n => Array.from({length: n}, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');

  function send(c, msg) { if (!c) return; const text = JSON.stringify(msg); if (c.socket && c.connected) c.socket.send(text); else if (c.backlog.length < 400) c.backlog.push(text); }
  const roomOf = c => c?.room ? rooms.get(c.room) : null;
  const members = r => r.players.map(id => clients.get(id)).filter(Boolean);
  function publicPlayer(c, r) { return {id: c.id, name: c.name, blade: c.blade, ready: r.ready.has(c.id), host: r.host === c.id, connected: c.connected, wins: r.wins[c.id] || 0, rematch: r.rematch.has(c.id)}; }
  function roomView(r) { return {t: 'room', code: r.private ? r.code : null, mode: r.mode, state: r.state, private: r.private, players: members(r).map(c => publicPlayer(c, r)), min: MODES[r.mode].min, max: MODES[r.mode].max}; }
  const viewers = r => [...r.watchers].map(id => clients.get(id)).filter(Boolean);
  const broadcast = (r, msg, except) => { for (const c of members(r)) if (c.id !== except) send(c, msg); for (const c of viewers(r)) send(c, msg); };
  const sync = r => { for (const c of members(r)) send(c, {...roomView(r), you: c.id}); for (const c of viewers(r)) send(c, {...roomView(r), you: null, watching: true}); lobbyDirty(); };

  // ---------- the lobby: live tables anyone can watch or join, recent results, the leaderboard ----------
  let lobbyTimer = null;
  const listed = r => !r.private;
  function gamesView() {
    return [...rooms.values()].filter(listed).map(r => ({code: r.code, mode: r.mode, state: r.state, round: r.round, open: r.open && r.state === 'lobby' && r.players.length < MODES[r.mode].max,
      players: members(r).map(c => ({name: c.name, blade: c.blade ? {name: c.blade.name, iconId: c.blade.iconId} : null, wins: r.wins[c.id] || 0, out: r.state === 'playing' && !r.alive.has(c.id)})),
      seats: MODES[r.mode].max, watchers: r.watchers.size, since: r.state === 'playing' ? Math.max(0, now() - (r.startedAt || now())) : 0}))
      .sort((a, b) => (b.state === 'playing') - (a.state === 'playing') || b.players.length - a.players.length).slice(0, 30);
  }
  function lobbyView(c) {
    return {t: 'lobby', games: gamesView(), online: [...clients.values()].filter(x => x.connected).length, top: scores ? scores.top(10) : [], recent: scores ? scores.recent(8) : [], me: c?.pub ?? null};
  }
  function lobbyDirty() {
    if (lobbyTimer) return;
    lobbyTimer = setTimer(() => { lobbyTimer = null; for (const c of clients.values()) if (c.lobby && c.connected && !c.room) send(c, lobbyView(c)); }, 400);
  }
  function stopWatching(c) { const r = c.watching ? rooms.get(c.watching) : null; c.watching = null; if (r) { r.watchers.delete(c.id); lobbyDirty(); } }

  function makeRoom(mode, isPrivate, host) {
    let code; do code = id36(4); while (rooms.has(code));
    const r = {code, mode, private: isPrivate, open: false, watchers: new Set(), snaps: {}, host, players: [], state: 'lobby', ready: new Set(), rematch: new Set(), wins: {}, alive: new Set(), deaths: [], scores: {}, seed: 0, round: 0, timer: null};
    rooms.set(code, r); lobbyDirty(); return r;
  }
  function enter(c, r) { stopWatching(c); leaveQueue(c); if (c.room && c.room !== r.code) leaveRoom(c); if (!r.players.includes(c.id)) r.players.push(c.id); c.room = r.code; if (!r.host) r.host = c.id; sync(r); }

  function leaveQueue(c) { for (const q of Object.values(queues)) { const i = q.indexOf(c.id); if (i >= 0) q.splice(i, 1); } }
  function leaveRoom(c, why = 'left') {
    const r = roomOf(c); c.room = null; if (!r) return;
    if (r.state === 'playing' && r.alive.has(c.id)) eliminate(r, c.id, why);
    r.players = r.players.filter(id => id !== c.id); r.ready.delete(c.id); r.rematch.delete(c.id);
    if (!r.players.length) { clearTimer(r.timer); for (const w of viewers(r)) { w.watching = null; send(w, {t: 'room', state: 'none', closed: true}); } rooms.delete(r.code); lobbyDirty(); return; }
    if (r.host === c.id) r.host = r.players[0];
    broadcast(r, {t: 'left', id: c.id, name: c.name, why});
    if (r.state === 'countdown' && r.players.length < MODES[r.mode].min) { clearTimer(r.timer); r.state = 'lobby'; r.ready.clear(); }
    if (r.state === 'results' && r.players.length < MODES[r.mode].min) { r.state = 'lobby'; r.ready.clear(); r.rematch.clear(); }
    if (r.state === 'results' && r.rematch.size && r.players.every(id => r.rematch.has(id)) && r.players.length >= MODES[r.mode].min) begin(r);
    sync(r);
  }

  function begin(r) {
    clearTimer(r.timer); r.round++; r.state = 'countdown'; r.seed = Math.floor(random() * 4294967295) >>> 0;
    r.alive = new Set(r.players); r.deaths = []; r.scores = {}; r.rematch.clear(); r.startedAt = now() + countdownMs;
    const players = members(r).map(c => ({id: c.id, name: c.name, blade: c.blade}));
    r.snaps = {};
    for (const c of members(r)) send(c, {t: 'start', mode: r.mode, round: r.round, seed: r.seed, in: countdownMs, players, you: c.id, code: r.private ? r.code : null});
    for (const c of viewers(r)) send(c, {t: 'start', mode: r.mode, round: r.round, seed: r.seed, in: countdownMs, players, you: null, code: r.code, watching: true});
    r.timer = setTimer(() => { if (r.state === 'countdown') { r.state = 'playing'; sync(r); } }, countdownMs);
    sync(r);
  }
  function maybeBegin(r) {
    const n = r.players.length, ok = n >= MODES[r.mode].min && r.players.every(id => r.ready.has(id) && clients.get(id)?.connected);
    if (r.state === 'lobby' && ok && (r.mode === 'duel' || n === MODES[r.mode].max)) begin(r);
  }
  function eliminate(r, id, why = 'out') {
    if (!r.alive.delete(id)) return;
    r.deaths.push({id, at: now() - (r.startedAt || now()), why}); broadcast(r, {t: 'out', id, why, alive: r.alive.size});
    if (r.alive.size <= 1) finish(r);
  }
  function finish(r) {
    r.state = 'results'; clearTimer(r.timer);
    const winner = [...r.alive][0] ?? null; if (winner) r.wins[winner] = (r.wins[winner] || 0) + 1;
    const order = [...(winner ? [winner] : []), ...r.deaths.map(d => d.id).reverse()];
    const placements = order.map((id, i) => ({id, place: i + 1, name: clients.get(id)?.name ?? 'Player', score: r.scores[id] ?? null}));
    let rated = null; try { rated = scores?.record({mode: r.mode, placements: placements.map(p => ({...p, pid: clients.get(p.id)?.pid}))}); } catch (e) { log('scores', e); }
    broadcast(r, {t: 'result', winner, placements: placements.map(p => ({...p, change: rated?.players.find(q => q.place === p.place)?.change ?? null})), round: r.round, wins: r.wins}); r.ready.clear(); sync(r);
  }

  function matchmake(mode) {
    const q = queues[mode]; for (let i = q.length - 1; i >= 0; i--) if (!clients.get(q[i])?.connected) q.splice(i, 1);
    const need = MODES[mode].max;
    const form = ids => { const r = makeRoom(mode, false, ids[0]); for (const id of ids) { const c = clients.get(id); enter(c, r); r.ready.add(id); } begin(r); };
    while (q.length >= need) form(q.splice(0, need));
    if (mode === 'ffa') {
      clearTimer(ffaTimer); ffaTimer = null;
      if (q.length >= MODES.ffa.min) ffaTimer = setTimer(() => { ffaTimer = null; if (queues.ffa.length >= MODES.ffa.min) form(queues.ffa.splice(0, MODES.ffa.max)); }, ffaFillMs);
    }
    for (const id of q) send(clients.get(id), {t: 'queue', mode, waiting: q.length, need});
  }

  const handlers = {
    hello(c, m) {
      // a page left open across a deploy runs older code: it must refresh before it can play newer players
      if (build && m.build && m.build !== build) { send(c, {t: 'error', code: 'outdated', message: "Sword's Pass has been updated. Refresh the page to play online."}); return; }
      if (m.token && tokens.has(m.token) && tokens.get(m.token) !== c.id) {            // resume a dropped connection
        const old = clients.get(tokens.get(m.token));
        if (old && !old.connected) { clearTimer(old.dropTimer); old.socket = c.socket; old.connected = true; clients.delete(c.id); tokens.delete(c.token); c.socket.owner = old; c = old;
          send(c, {t: 'welcome', id: c.id, token: c.token, resumed: true, protocol: PROTOCOL});
          for (const text of c.backlog.splice(0)) c.socket.send(text);
          const r = roomOf(c); if (r) { broadcast(r, {t: 'peer', id: c.id, connected: true}, c.id); sync(r); }
          return;
        }
      }
      if (typeof m.pid === 'string' && /^[A-Za-z0-9_-]{12,64}$/.test(m.pid)) { c.pid = m.pid; c.pub = pubId(m.pid); }
      c.name = clean(m.name, 16) || 'Swordhand'; c.blade = m.blade && typeof m.blade === 'object' ? {name: clean(m.blade.name, 32), iconId: clean(m.blade.iconId ?? m.blade.id, 40), rows: Array.isArray(m.blade.rows) ? m.blade.rows.slice(0, 8).map(r => Array.isArray(r) ? r.slice(0, 6).map(v => (v | 0) & 3) : []) : []} : null;
      send(c, {t: 'welcome', id: c.id, token: c.token, protocol: PROTOCOL});
    },
    profile(c, m) { c.name = clean(m.name, 16) || c.name; if (m.blade) handlers.hello(c, {name: c.name, blade: m.blade}); const r = roomOf(c); if (r && r.state !== 'playing') sync(r); },
    quick(c, m) { const mode = MODES[m.mode] ? m.mode : 'duel'; if (roomOf(c)) leaveRoom(c); leaveQueue(c); queues[mode].push(c.id); matchmake(mode); },
    cancel(c) { leaveQueue(c); send(c, {t: 'queue', mode: null, waiting: 0}); for (const mode of Object.keys(queues).filter(k => k !== 'ffaTimer')) matchmake(mode); },
    create(c, m) { const mode = MODES[m.mode] ? m.mode : 'duel'; leaveQueue(c); if (roomOf(c)) leaveRoom(c); const r = makeRoom(mode, !m.public, c.id); r.open = !!m.public; enter(c, r); },
    join(c, m) {
      const r = rooms.get(clean(m.code, 8).toUpperCase());
      if (!r || !(r.private || r.open)) return send(c, {t: 'error', code: 'no-room', message: 'No room with that code.'});
      if (r.players.length >= MODES[r.mode].max) return send(c, {t: 'error', code: 'full', message: 'That room is full.'});
      if (r.state !== 'lobby' && r.state !== 'results') return send(c, {t: 'error', code: 'busy', message: 'That room is mid-match. Try again when it ends.'});
      enter(c, r);
    },
    leave(c) { stopWatching(c); leaveQueue(c); leaveRoom(c); send(c, {t: 'room', state: 'none'}); },
    lobby(c, m) { c.lobby = m.on !== false; if (c.lobby) send(c, lobbyView(c)); },
    watch(c, m) {
      const r = rooms.get(clean(m.code, 8).toUpperCase());
      if (!r || r.private) return send(c, {t: 'error', code: 'no-room', message: 'That table has closed.'});
      if (r.players.includes(c.id)) return;
      leaveQueue(c); if (c.room) leaveRoom(c); stopWatching(c); c.watching = r.code; r.watchers.add(c.id);
      const players = members(r).map(p => ({id: p.id, name: p.name, blade: p.blade}));
      send(c, {...roomView(r), you: null, watching: true, code: r.code});
      if (r.state === 'countdown' || r.state === 'playing' || r.state === 'results') send(c, {t: 'start', mode: r.mode, round: r.round, seed: r.seed, in: (r.startedAt || now()) - now(), players, you: null, code: r.code, watching: true, alive: [...r.alive]});
      for (const [from, s] of Object.entries(r.snaps)) send(c, {t: 'state', from, ...s});
      lobbyDirty();
    },
    unwatch(c) { stopWatching(c); send(c, {t: 'room', state: 'none'}); },
    ready(c, m) { const r = roomOf(c); if (!r || r.state !== 'lobby') return; if (m.ready === false) r.ready.delete(c.id); else r.ready.add(c.id); sync(r); maybeBegin(r); },
    start(c) { const r = roomOf(c); if (!r || r.host !== c.id || r.state !== 'lobby') return; if (r.players.length >= MODES[r.mode].min && r.players.every(id => r.ready.has(id) || id === c.id)) begin(r); },
    rematch(c) {
      const r = roomOf(c); if (!r || r.state !== 'results') return; r.rematch.add(c.id); sync(r);
      if (r.players.length >= MODES[r.mode].min && r.players.every(id => r.rematch.has(id))) begin(r);
    },
    state(c, m) { const r = roomOf(c); if (!r || (r.state !== 'playing' && r.state !== 'countdown') || !r.players.includes(c.id)) return; if (typeof m.score === 'number') r.scores[c.id] = m.score | 0; r.snaps[c.id] = {s: m.s, score: m.score}; broadcast(r, {t: 'state', from: c.id, s: m.s, score: m.score}, c.id); },
    attack(c, m) {
      const r = roomOf(c); if (!r || r.state !== 'playing' || !r.alive.has(c.id) || !Array.isArray(m.attacks) || m.attacks.length > 40) return;
      let to = r.mode === 'duel' ? r.players.find(id => id !== c.id) : m.to;
      if (!r.alive.has(to) || to === c.id) { const others = [...r.alive].filter(id => id !== c.id); to = others[Math.floor(random() * others.length)]; }
      const target = clients.get(to); if (!target) return;
      send(target, {t: 'attack', from: c.id, attacks: m.attacks, turn: m.turn | 0});
      if (r.mode === 'ffa') broadcast(r, {t: 'aimed', from: c.id, to, size: m.attacks.length}, to);
    },
    dead(c) { const r = roomOf(c); if (r && r.state === 'playing') eliminate(r, c.id, 'out'); },
    ping(c, m) { send(c, {t: 'pong', at: m.at, server: now()}); },
  };

  function connect(socket) {
    const c = {id: 'p' + (nextId++).toString(36), token: id36(20), socket, connected: true, name: 'Swordhand', blade: null, room: null, backlog: [], rate: {at: 0, n: 0}};
    clients.set(c.id, c); tokens.set(c.token, c.id); socket.owner = c;
    socket.onMessage = text => {
      const me = socket.owner; if (!me) return;
      const t = now(); if (t - me.rate.at > 1000) { me.rate.at = t; me.rate.n = 0; } if (++me.rate.n > 120) return;   // 120 messages a second is plenty
      let m; try { m = JSON.parse(text); } catch { return; }
      const h = m && typeof m.t === 'string' && Object.hasOwn(handlers, m.t) ? handlers[m.t] : null;
      if (h) try { h(me, m); } catch (e) { log('handler error', m.t, e); }
    };
    socket.onClose = () => {
      const me = socket.owner; if (!me || me.socket !== socket) return; me.connected = false; me.socket = null; leaveQueue(me);
      const r = roomOf(me); if (r) { broadcast(r, {t: 'peer', id: me.id, connected: false}); if (r.state === 'lobby') r.ready.delete(me.id); sync(r); }
      me.dropTimer = setTimer(() => { if (me.connected) return; stopWatching(me); leaveRoom(me, 'disconnected'); clients.delete(me.id); tokens.delete(me.token); lobbyDirty(); }, resumeMs);
    };
    return c;
  }
  return {connect, stats: () => ({clients: clients.size, rooms: rooms.size, queued: queues.duel.length + queues.ffa.length}), lobby: () => lobbyView(null), _rooms: rooms, _clients: clients};
}
