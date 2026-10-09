import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRelay} from '../server/relay.mjs';
import {attachWebSockets} from '../server/ws.mjs';

// fake sockets and a manual clock
function harness(opts = {}) {
  let t = 1000; const timers = [];
  const relay = createRelay({now: () => t, setTimer: (fn, ms) => { const h = {at: t + ms, fn}; timers.push(h); return h; }, clearTimer: h => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); }, random: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(), ...opts});
  const advance = ms => { t += ms; for (const h of [...timers].sort((a, b) => a.at - b.at)) if (h.at <= t && timers.includes(h)) { timers.splice(timers.indexOf(h), 1); h.fn(); } };
  const client = name => {
    const sock = {inbox: [], send(x) { this.inbox.push(JSON.parse(x)); }, close() {}};
    relay.connect(sock); const say = m => sock.onMessage(JSON.stringify(m));
    say({t: 'hello', name, blade: {name: 'Falchion', iconId: 'falchion', rows: [[0, 1, 2, 3, 0, 1]]}});
    const last = type => [...sock.inbox].reverse().find(m => m.t === type);
    return {sock, say, last, id: last('welcome').id, token: last('welcome').token, all: type => sock.inbox.filter(m => m.t === type), drop() { sock.onClose(); }};
  };
  return {relay, client, advance};
}

test('quick duel puts up a table, the next quick match sits down, and both start on the same seed', () => {
  const {client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); assert.equal(a.last('room').players.length, 1); assert.equal(a.last('room').open, true);
  b.say({t: 'quick', mode: 'duel'});
  const sa = a.last('start'), sb = b.last('start');
  assert.ok(sa && sb); assert.equal(sa.seed, sb.seed); assert.equal(sa.players.length, 2); assert.equal(sa.you, a.id);
  advance(4000); assert.equal(a.last('room').state, 'playing');
});

test('attacks and board states are relayed to the rival only; first to top out loses', () => {
  const {client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(4000);
  a.say({t: 'attack', attacks: [{kind: 'vertical', width: 1, length: 4}], turn: 3});
  assert.equal(b.last('attack').from, a.id); assert.equal(a.last('attack'), undefined);
  a.say({t: 'state', s: {board: []}, score: 0}); assert.equal(b.last('state').from, a.id);
  b.say({t: 'dead'});
  const r = a.last('result'); assert.equal(r.winner, a.id); assert.deepEqual(r.placements.map(p => p.id), [a.id, b.id]); assert.equal(r.wins[a.id], 1);
  assert.deepEqual(b.last('result'), r);
});

test('rematch starts a new round once both ask; wins carry over', () => {
  const {client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(4000); b.say({t: 'dead'});
  const first = a.last('start').seed;
  a.say({t: 'rematch'}); assert.equal(a.all('start').length, 1);
  b.say({t: 'rematch'}); assert.equal(a.all('start').length, 2); assert.notEqual(a.last('start').seed, first);
  assert.equal(a.last('start').round, 2);
});

test('private rooms: create, join by code, ready up; wrong codes and full rooms refused', () => {
  const {client} = harness(), a = client('Ann'), b = client('Bo'), c = client('Cy');
  a.say({t: 'create', mode: 'duel'}); const code = a.last('room').code; assert.match(code, /^[A-Z2-9]{4}$/);
  c.say({t: 'join', code: 'ZZZZ'}); assert.equal(c.last('error').code, 'no-room');
  b.say({t: 'join', code: code.toLowerCase()}); assert.equal(b.last('room').players.length, 2);
  c.say({t: 'join', code}); assert.equal(c.last('error').code, 'full');
  a.say({t: 'ready'}); assert.equal(a.last('start'), undefined);
  b.say({t: 'ready'}); assert.ok(a.last('start') && b.last('start'));
});

test('free-for-all: up to four, attacks go to the chosen target, last board standing wins', () => {
  const {client, advance} = harness(), ps = ['A', 'B', 'C', 'D'].map(client);
  ps[0].say({t: 'create', mode: 'ffa'}); const code = ps[0].last('room').code;
  for (const p of ps.slice(1)) p.say({t: 'join', code});
  for (const p of ps.slice(1)) p.say({t: 'ready'});
  ps[0].say({t: 'start'}); assert.ok(ps[3].last('start')); advance(4000);
  ps[0].say({t: 'attack', to: ps[2].id, attacks: [{kind: 'sprinkle', count: 2}]});
  assert.equal(ps[2].last('attack').from, ps[0].id); assert.equal(ps[1].last('attack'), undefined); assert.equal(ps[1].last('aimed').to, ps[2].id);
  ps[1].say({t: 'dead'}); ps[3].say({t: 'dead'}); assert.equal(ps[0].last('result'), undefined);
  ps[2].say({t: 'dead'});
  const r = ps[0].last('result'); assert.equal(r.winner, ps[0].id);
  assert.deepEqual(r.placements.map(p => p.id), [ps[0].id, ps[2].id, ps[3].id, ps[1].id]);
});

test('quick free-for-all sits everyone at one table: starts at four, or with two or more after the wait', () => {
  const {client, advance} = harness(), ps = ['A', 'B', 'C'].map(client);
  for (const p of ps) p.say({t: 'quick', mode: 'ffa'});
  assert.equal(ps[0].last('start'), undefined); assert.equal(ps[2].last('room').players.length, 3);
  advance(16000); assert.equal(ps[0].last('start').players.length, 3);
});

test('a dropped player can resume within the grace window and gets what they missed', () => {
  const {relay, client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(4000);
  b.drop(); assert.equal(a.last('peer').connected, false);
  a.say({t: 'attack', attacks: [{kind: 'sprinkle', count: 1}]});
  const sock = {inbox: [], send(x) { this.inbox.push(JSON.parse(x)); }, close() {}};
  relay.connect(sock); sock.onMessage(JSON.stringify({t: 'hello', token: b.token}));
  assert.equal(sock.inbox.find(m => m.t === 'welcome').id, b.id); assert.ok(sock.inbox.some(m => m.t === 'attack'));
  assert.equal(a.last('peer').connected, true);
});

test('a player who stays away past the grace window forfeits', () => {
  const h = harness(); const a = h.client('Ann'), b = h.client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); h.advance(4000);
  b.drop(); h.advance(21000);
  assert.equal(a.last('result').winner, a.id); assert.equal(a.last('left').why, 'disconnected');
});

test('leaving mid-duel hands the round to the rival', () => {
  const {client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(4000);
  b.say({t: 'leave'}); assert.equal(a.last('result').winner, a.id);
});

test('junk input is ignored', () => {
  const {client} = harness(), a = client('Ann');
  a.sock.onMessage('not json'); a.sock.onMessage(JSON.stringify({t: 'constructor'})); a.sock.onMessage(JSON.stringify({t: '__proto__'}));
  a.say({t: 'hello', name: '<b>' + 'x'.repeat(50)}); assert.equal(a.last('welcome').id, a.id);
});

test('real websocket round trip through the node server', async () => {
  const relay = createRelay(), server = http.createServer();
  const wss = attachWebSockets(server, {onConnection: ws => relay.connect(ws)});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const open = () => new Promise((res, rej) => { const ws = new WebSocket(url); const box = []; ws.onmessage = e => box.push(JSON.parse(e.data)); ws.onopen = () => res({ws, box}); ws.onerror = rej; });
  const a = await open(), b = await open();
  const wait = (c, t) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const m = c.box.find(x => x.t === t); if (m) res(m); else if (Date.now() - t0 > 2000) rej(Error('no ' + t)); else setTimeout(tick, 10); }; tick(); });
  a.ws.send(JSON.stringify({t: 'hello', name: 'A'})); b.ws.send(JSON.stringify({t: 'hello', name: 'B'}));
  await wait(a, 'welcome'); await wait(b, 'welcome');
  a.ws.send(JSON.stringify({t: 'quick', mode: 'duel'})); b.ws.send(JSON.stringify({t: 'quick', mode: 'duel'}));
  const sa = await wait(a, 'start'), sb = await wait(b, 'start'); assert.equal(sa.seed, sb.seed);
  a.ws.send(JSON.stringify({t: 'state', s: {big: 'x'.repeat(20000)}})); const st = await wait(b, 'state'); assert.equal(st.s.big.length, 20000);
  a.ws.close(); b.ws.close(); wss.close(); await new Promise(r => server.close(r));
});

test('a page from an older build is told to refresh instead of joining newer players', () => {
  const relay = createRelay({build: 'new'}), inbox = [], sock = {send(x) { inbox.push(JSON.parse(x)); }, close() {}};
  relay.connect(sock); sock.onMessage(JSON.stringify({t: 'hello', name: 'Old', build: 'old'}));
  assert.equal(inbox[0].t, 'error'); assert.equal(inbox[0].code, 'outdated'); assert.ok(!inbox.some(m => m.t === 'welcome'));
  const ok = [], s2 = {send(x) { ok.push(JSON.parse(x)); }, close() {}}; relay.connect(s2); s2.onMessage(JSON.stringify({t: 'hello', name: 'New', build: 'new'}));
  assert.equal(ok[0].t, 'welcome');
});

test('the lobby lists live tables; anyone can watch one, and open tables can be joined', async () => {
  const {createScores} = await import('../server/scores.mjs');
  const scores = createScores({url: '', key: ''});
  let t = 1000; const timers = [];
  const relay = createRelay({now: () => t, setTimer: (fn, ms) => { const h = {at: t + ms, fn}; timers.push(h); return h; }, clearTimer: h => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); }, scores});
  const advance = ms => { t += ms; for (const h of [...timers].sort((a, b) => a.at - b.at)) if (h.at <= t && timers.includes(h)) { timers.splice(timers.indexOf(h), 1); h.fn(); } };
  const client = (name, pid) => { const sock = {inbox: [], send(x) { this.inbox.push(JSON.parse(x)); }, close() {}}; relay.connect(sock); const say = m => sock.onMessage(JSON.stringify(m)); say({t: 'hello', name, pid}); const last = type => [...sock.inbox].reverse().find(m => m.t === type); return {sock, say, last, id: last('welcome').id}; };
  const a = client('Ann', 'pid-ann-000000001'), b = client('Bo', 'pid-bo-0000000001'), w = client('Wes', 'pid-wes-000000001');
  w.say({t: 'lobby'}); assert.deepEqual(w.last('lobby').games, []);
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(500);
  const g = w.last('lobby').games[0]; assert.equal(g.mode, 'duel'); assert.deepEqual(g.players.map(p => p.name), ['Ann', 'Bo']); assert.equal(g.open, false);
  w.say({t: 'watch', code: g.code}); assert.equal(w.last('start').you, null); assert.equal(w.last('start').players.length, 2);
  advance(4000); a.say({t: 'state', s: {b: [], n: 3}, score: 0}); assert.equal(w.last('state').from, a.id);
  b.say({t: 'dead'}); const r = w.last('result'); assert.equal(r.winner, a.id); assert.ok(r.placements[0].change > 0);
  assert.equal(scores.top()[0].name, 'Ann'); assert.equal(scores.recent()[0].winner, 'Ann');
  assert.ok(!JSON.stringify(scores.top()).includes('pid-ann'));   // ids stay private
  // an open table shows as joinable, and joining by its code works
  const h = client('Hal', 'pid-hal-000000001'), j = client('Jo', 'pid-jo-0000000001');
  h.say({t: 'create', mode: 'duel', public: true}); advance(500);
  const open = w.last('lobby') && relay.lobby().games.find(x => x.open); assert.ok(open);
  j.say({t: 'join', code: open.code}); assert.equal(j.last('room').players.length, 2);
});

test('finished combos go to everyone at the table, cleaned; boards keep streaming into the results', () => {
  const {client, advance} = harness(), a = client('Ann'), b = client('Bo');
  a.say({t: 'quick', mode: 'duel'}); b.say({t: 'quick', mode: 'duel'}); advance(4000);
  a.say({t: 'combo', c: {chain: 3, steps: [{n: 1, g: 4, s: [], p: 1}, {n: 2, g: 5, s: [[2, 3]], p: 0}, {n: 3, g: 999, s: [[9, 99]], p: 2}]}, to: 'nobody'});
  const m = b.last('combo'); assert.equal(m.from, a.id); assert.equal(m.c.chain, 3); assert.equal(m.to, null);
  assert.deepEqual(m.c.steps[2], {n: 3, g: 78, p: 2, s: [[6, 13]]}); assert.equal(a.last('combo'), undefined);
  b.say({t: 'dead'}); a.say({t: 'state', s: {b: []}, score: 0}); assert.ok(b.last('state'));
});

test('offensive names are refused by the server and replaced', async () => {
  const {client} = harness(), a = client('n1gg3r'), b = client('Bo');
  assert.equal(a.last('error')?.code, 'name');
  a.say({t: 'host', mode: 'duel'}); a.say({t: 'create', mode: 'duel', public: true});
  const me = a.last('room').players.find(p => p.id === a.id); assert.equal(me.name, 'Swordhand');
  const {equippedSword} = await import('../dist/swords.js'), stick = equippedSword('stick');
  a.say({t: 'profile', name: 'Ann', blade: {name: 'HitlerBlade', iconId: 'stick', rows: stick.rows}});
  const after = a.last('room').players.find(p => p.id === a.id); assert.equal(after.name, 'Ann'); assert.equal(after.blade.name, 'Custom blade');
  a.say({t: 'profile', name: 'f@ggot'}); assert.equal(a.last('room').players.find(p => p.id === a.id).name, 'Ann');
});

test('a table put up by a player starts when anyone sits down: a quick match or a Join', () => {
  const {client, advance} = harness(), h = client('Hal'), q = client('Quinn');
  h.say({t: 'create', mode: 'duel', public: true}); assert.equal(h.last('room').open, true); assert.equal(h.last('start'), undefined);
  q.say({t: 'quick', mode: 'duel'}); assert.ok(h.last('start') && q.last('start')); assert.equal(q.last('start').seed, h.last('start').seed);
  const {client: c2} = harness(), a = c2('Ann'), b = c2('Bo'), w = c2('Wes');
  a.say({t: 'create', mode: 'duel', public: true}); const code = a.last('room').table;
  w.say({t: 'lobby'}); b.say({t: 'join', code}); assert.ok(a.last('start') && b.last('start'));
});
