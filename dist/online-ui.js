// Online play: lobby (quick match, private rooms), Online Duel and Online Free-for-All.
// Your board is simulated here with zero added input delay (engine mode 'online'); rivals'
// boards are drawn from the snapshots they stream. Attack batches travel as messages and land
// on your next lock, exactly as they would locally. The server referees who topped out first.
import {createMatch,step,receiveBatch,pairAt,DEFAULT_RULES,H} from './engine.js';
import {actionFor} from './handling-profile.js';
import {handlingRules,HOUSE_RULES} from './handling-profile.js';
import {drawBoard,drawNext} from './render.js';
import {hazardAt,scoreClear} from './challenge.js';
import {DEFAULT_PROGRESSION,progressionAt} from './progression.js';
import {connectOnline} from './online-net.js';

const DT = 1000 / 60, SNAP_MS = 50;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const PLACE = ['', '1st', '2nd', '3rd', '4th'];
const MODE_NAME = {duel: 'Online Duel', ffa: 'Online Free-for-All'};

export function createOnlineUI({host, prefs, read, save, sound, getBlade, swordIcon = () => '', showSettings, onExit}) {
  const $ = q => host.querySelector(q), life = new AbortController(), held = new Map();
  let mode = globalThis.scrapsOnlineMode || read('online-mode', 'duel'); if (!['duel', 'ffa'].includes(mode)) mode = 'duel';
  let name = read('online-name', '') || '', screen = 'home', room = null, queueInfo = null, match = null, notice = '', raf = 0, last = 0, acc = 0, disposed = false;
  const record = read('online-record', {duel: {w: 0, l: 0}, ffa: {w: 0, played: 0}});
  const blade = () => { const b = getBlade?.() || {}; return {id: b.id, iconId: b.iconId ?? b.id, name: b.name || 'Blade', rows: b.rows || []}; };
  const net = connectOnline({hello: () => ({name: name || 'Swordhand', blade: blade(), v: 1})});
  const rules = () => handlingRules({...HOUSE_RULES, repeatDelayMs: prefs.rules?.repeatDelayMs ?? HOUSE_RULES.repeatDelayMs, repeatMs: prefs.rules?.repeatMs ?? HOUSE_RULES.repeatMs, dropBufferMs: prefs.rules?.dropBufferMs ?? HOUSE_RULES.dropBufferMs, stallFlips: 3, wellFlip: true});
  const set = (q, v) => { const el = $(q); if (el && el.textContent !== String(v)) el.textContent = String(v); };

  // ---------- network events ----------
  net.on('status', () => { if (screen !== 'match') paint(); else statusBadge(); });
  net.on('queue', m => { queueInfo = m.mode ? m : null; if (screen === 'queue' && !m.mode) screen = 'home'; if (screen !== 'match') paint(); });
  net.on('room', m => {
    if (m.state === 'none') { room = null; if (screen !== 'match') { screen = 'home'; paint(); } return; }
    room = m; mode = m.mode;
    if (screen === 'match') updateResults(); else { screen = 'room'; paint(); }
  });
  net.on('error', m => { notice = m.message || 'Something went wrong.'; paint(); });
  net.on('start', m => beginMatch(m));
  net.on('state', m => { if (!match) return; const r = match.rivals.get(m.from); if (r) { r.s = m.s; r.at = performance.now(); if (typeof m.score === 'number') r.score = m.score; } });
  net.on('attack', m => { if (!match || match.over) return; if (receiveBatch(match.game, 0, m.attacks, m.turn)) { match.incomingFrom = m.from; match.incomingAt = performance.now(); } });
  net.on('aimed', m => { if (match) match.aims.set(m.from, {to: m.to, at: performance.now()}); });
  net.on('out', m => { if (!match) return; if (m.id === match.you) return; const r = match.rivals.get(m.id); if (r) { r.out = true; if (match.game.players[1] && match.mode === 'duel') match.game.players[1].dead = true; } if (match.target === m.id) retarget(); });
  net.on('result', m => finishMatch(m));
  net.on('left', m => { if (match) { const r = match.rivals.get(m.id); if (r) { r.left = true; r.out = true; } } notice = `${m.name} ${m.why === 'disconnected' ? 'lost connection' : 'left'}.`; if (screen === 'match') updateResults(); else paint(); });
  net.on('peer', m => { if (match) { const r = match.rivals.get(m.id); if (r) r.connected = m.connected; } });

  // ---------- lobby screens ----------
  function statusLine() {
    const s = net.status, rtt = net.rtt;
    if (s === 'online') return `<span class="ol-dot on"></span>Connected${rtt != null ? ` · ${rtt} ms` : ''}`;
    if (s === 'no-server') return `<span class="ol-dot off"></span>No online server set for this site yet`;
    return `<span class="ol-dot wait"></span>${s === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}`;
  }
  function statusBadge() { const el = $('#ol-net'); if (el) el.innerHTML = statusLine(); }
  function paint() {
    if (disposed || screen === 'match') return;
    const b = blade(), online = net.status === 'online';
    const head = `<section class="room-heading pm-heading ol-heading"><div><p class="eyebrow">ONLINE</p><h1>${screen === 'room' ? (room?.private ? 'Your table.' : 'Match found.') : screen === 'queue' ? 'Finding rivals.' : 'Cross blades.'}</h1></div></section>`;
    let body = '';
    if (screen === 'home') {
      body = `<div class="ol-modes">${['duel', 'ffa'].map(k => `<button class="pm-diff-item ${k === mode ? 'selected' : ''}" data-mode="${k}"><strong>${k === 'duel' ? 'Duel' : 'Free-for-All'}</strong><small>${k === 'duel' ? 'One on one. First to top out loses' : 'Two to four players. Last board standing'}</small></button>`).join('')}</div>
        <div class="ol-you"><span class="ol-blade">${swordIcon(b.iconId)}</span><label class="ol-name"><small>YOUR NAME</small><input id="ol-name" maxlength="16" autocomplete="nickname" placeholder="Swordhand" value="${esc(name)}"></label><div class="ol-blade-name"><small>YOUR BLADE</small><strong>${esc(b.name)}</strong></div></div>
        <nav class="ol-menu">
          <button class="primary" id="ol-quick" ${online ? '' : 'disabled'}>Quick match</button>
          <button class="ol-item" id="ol-create" ${online ? '' : 'disabled'}>Create a room</button>
          <div class="ol-join"><input id="ol-code" maxlength="4" placeholder="CODE" autocapitalize="characters" spellcheck="false"><button class="ol-item" id="ol-join" ${online ? '' : 'disabled'}>Join</button></div>
        </nav>
        <p class="ol-notice">${esc(notice)}</p>
        <p class="ol-record">${mode === 'duel' ? `<b>${record.duel.w}</b> won · <b>${record.duel.l}</b> lost online` : `<b>${record.ffa.w}</b> wins in <b>${record.ffa.played}</b> free-for-alls`}</p>`;
    } else if (screen === 'queue') {
      body = `<div class="ol-wait"><div class="ol-spinner" aria-hidden="true"></div><p class="ol-big">${mode === 'duel' ? 'Looking for a rival…' : 'Gathering the table…'}</p>
        <p class="muted">${queueInfo ? `${queueInfo.waiting} of ${queueInfo.need} waiting${mode === 'ffa' && queueInfo.waiting >= 2 ? ' · starts shortly' : ''}` : ''}</p>
        <button class="ol-item" id="ol-cancel">Cancel</button></div>`;
    } else if (screen === 'room' && room) {
      const me = room.players.find(p => p.id === net.id), allReady = room.players.every(p => p.ready || p.host);
      body = `<div class="ol-room">
        ${room.private ? `<div class="ol-code"><small>ROOM CODE</small><strong>${esc(room.code)}</strong><button class="ol-item" id="ol-copy">Copy</button></div>` : ''}
        <ol class="ol-players">${room.players.map(p => `<li class="${p.ready ? 'ready' : ''} ${p.connected ? '' : 'away'}"><span class="ol-blade">${swordIcon(p.blade?.iconId)}</span><div><strong>${esc(p.name)}${p.id === net.id ? ' <em>you</em>' : ''}</strong><small>${esc(p.blade?.name || '')}${p.wins ? ` · ${p.wins} won` : ''}</small></div><b>${!p.connected ? 'Away' : p.ready ? 'Ready' : p.host && room.mode === 'ffa' ? 'Host' : 'Not ready'}</b></li>`).join('')}
          ${Array.from({length: Math.max(0, room.max - room.players.length)}, () => `<li class="empty"><span class="ol-blade"></span><div><strong>Open seat</strong><small>${room.private ? 'Share the code' : ''}</small></div></li>`).join('')}</ol>
        <nav class="ol-menu">
          ${room.state === 'lobby' ? `<button class="primary" id="ol-ready">${me?.ready ? 'Not ready' : 'Ready'}</button>` : ''}
          ${room.state === 'lobby' && room.mode === 'ffa' && me?.host ? `<button class="ol-item" id="ol-start" ${room.players.length >= room.min && allReady ? '' : 'disabled'}>Start now</button>` : ''}
          <button class="ol-item" id="ol-leave">Leave</button>
        </nav>
        <p class="ol-notice">${esc(notice)}</p></div>`;
    }
    host.innerHTML = `${head}<div class="ol-lobby">${body}<p class="ol-net" id="ol-net">${statusLine()}</p></div>`;
    wireLobby();
  }
  function wireLobby() {
    const on = (q, fn) => { const el = $(q); if (el) el.onclick = fn; };
    for (const b of host.querySelectorAll('[data-mode]')) b.onclick = () => { mode = b.dataset.mode; save('online-mode', mode); paint(); };
    const nm = $('#ol-name'); if (nm) nm.onchange = () => { name = nm.value.trim().slice(0, 16); save('online-name', name); net.send({t: 'profile', name: name || 'Swordhand', blade: blade()}); };
    const code = $('#ol-code'); if (code) { code.oninput = () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }; code.onkeydown = e => { if (e.key === 'Enter') $('#ol-join')?.click(); }; }
    on('#ol-quick', () => { notice = ''; profile(); net.send({t: 'quick', mode}); screen = 'queue'; queueInfo = null; paint(); });
    on('#ol-create', () => { notice = ''; profile(); net.send({t: 'create', mode}); });
    on('#ol-join', () => { const c = $('#ol-code')?.value.trim(); if (!c || c.length < 4) { notice = 'Room codes are four letters.'; paint(); return; } notice = ''; profile(); net.send({t: 'join', code: c}); });
    on('#ol-cancel', () => { net.send({t: 'cancel'}); screen = 'home'; paint(); });
    on('#ol-ready', () => { const me = room?.players.find(p => p.id === net.id); net.send({t: 'ready', ready: !me?.ready}); });
    on('#ol-start', () => net.send({t: 'start'}));
    on('#ol-leave', () => { net.send({t: 'leave'}); room = null; screen = 'home'; paint(); });
    on('#ol-copy', () => { try { navigator.clipboard.writeText(room.code); notice = 'Code copied.'; } catch { notice = 'Code: ' + room.code; } paint(); });
  }
  function profile() { const nm = $('#ol-name'); if (nm) { name = nm.value.trim().slice(0, 16); save('online-name', name); } net.send({t: 'profile', name: name || 'Swordhand', blade: blade()}); }

  // ---------- the match ----------
  function boardHTML(id, label, sub, mini, mine) {
    return `<section class="challenge-board ${mini ? 'mini' : ''} ${mine ? '' : 'ol-rival'}" id="ob-${id}" ${mine ? '' : `data-target="${id}" title="Click to aim your attacks here"`}>
      <div class="board-header"><div><strong>${esc(label)}</strong><span id="obs-${id}">${esc(sub)}</span></div><div class="next-piece"><span>NEXT</span><canvas id="obn-${id}"></canvas></div></div>
      <div class="board-frame"><canvas id="${mine ? 'challenge-board-0' : 'obc-' + id}" role="img" aria-label="${esc(label)} board"></canvas>${mine ? '<div id="ol-overlay" class="game-overlay"></div>' : '<i class="ol-aim">TARGET</i>'}</div>
      <div class="challenge-board-foot"><strong id="obsc-${id}"></strong><span id="obi-${id}"></span></div></section>`;
  }
  function beginMatch(m) {
    const me = m.players.find(p => p.id === m.you), others = m.players.filter(p => p.id !== m.you), r = rules();
    const game = createMatch({seed: m.seed, mode: 'online', rules: r, pattern: me?.blade?.rows?.length ? me.blade.rows : undefined, opponentPattern: others[0]?.blade?.rows?.length ? others[0].blade.rows : undefined});
    match = {mode: m.mode, round: m.round, seed: m.seed, you: m.you, game, rules: r, startAt: performance.now() + m.in, elapsed: 0, started: false,
      rivals: new Map(others.map(p => [p.id, {id: p.id, name: p.name, blade: p.blade, s: null, at: 0, score: 0, out: false, connected: true}])),
      target: others[0]?.id ?? null, aims: new Map(), sent: 0, score: 0, blocks: 0, combo: 0, snapAt: 0, lastSnap: '', sentDead: false, over: false, result: null,
      hazard: m.mode === 'ffa' ? hazardAt(m.seed, 0, DEFAULT_PROGRESSION) : null, incomingFrom: null, incomingAt: 0, introDone: false};
    screen = 'match'; notice = ''; held.clear(); renderMatch();
    if (m.mode === 'duel' && globalThis.scrapsIntro && others[0]) {
      const b = blade();
      globalThis.scrapsIntro({eyebrow: 'ONLINE DUEL · ROUND ' + m.round, left: {name: name || 'You', sub: b.name, art: swordIcon(b.iconId)}, right: {name: others[0].name, sub: others[0].blade?.name || '', art: swordIcon(others[0].blade?.iconId)}});
    }
  }
  function renderMatch() {
    const others = [...match.rivals.values()], duel = match.mode === 'duel';
    host.innerHTML = `<section class="room-heading game-heading"><div><p class="eyebrow">${duel ? 'ONLINE DUEL' : 'ONLINE FREE-FOR-ALL'} · ROUND ${match.round}</p><h1 id="ol-title">${duel ? 'You vs. ' + esc(others[0]?.name || 'rival') : 'Last board standing.'}</h1></div>
      <div class="match-tools"><span id="ol-clock">0:00</span><button id="online-leave">Leave</button></div></section>
      <div class="challenge-arena online-arena ${duel ? 'ol-duel' : 'ol-ffa'}">
        <section class="table-surface challenge-main">
          <div class="challenge-hud"><div><span>${duel ? 'SWORDS SENT' : 'SCORE'}</span><strong id="ol-h1">0</strong></div><div><span>INCOMING</span><strong id="ol-h2">0</strong></div><div><span>PING</span><strong id="ol-h3">—</strong></div></div>
          <p class="challenge-stage-caption" id="ol-caption">${duel ? 'First to top out loses' : 'Click a rival’s board (or Tab) to aim'}</p>
          <div class="challenge-playfield">${boardHTML('me', name || 'You', 'In play', false, true)}</div>
          <div class="touch-controls challenge-touch">${[['left', '←'], ['ccw', '↶'], ['cw', '↷'], ['right', '→'], ['drop', 'Drop']].map(([a, t]) => `<button data-ol-action="${a}" aria-label="${a}">${t}</button>`).join('')}</div>
        </section>
        <aside class="challenge-sidebar">
          <section class="panel"><p class="eyebrow">${duel ? 'THE DUEL' : 'THE TABLE'}</p><div id="ol-standings"></div><p class="ol-net" id="ol-net">${statusLine()}</p></section>
          <div class="challenge-opponents">${others.map(o => boardHTML(o.id, o.name, o.blade?.name || 'In play', !duel, false)).join('')}</div>
        </aside>
      </div><div id="ol-results"></div>`;
    $('#online-leave').onclick = leaveMatch;
    for (const b of host.querySelectorAll('[data-ol-action]')) {
      b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press('touch-' + b.dataset.olAction, b.dataset.olAction); };
      b.onpointerup = b.onpointercancel = () => release('touch-' + b.dataset.olAction);
    }
    for (const b of host.querySelectorAll('[data-target]')) b.onclick = () => aim(b.dataset.target);
  }
  function aim(id) { if (!match || match.mode !== 'ffa') return; const r = match.rivals.get(id); if (r && !r.out) { match.target = id; globalThis.scrapsUiSound?.('tab'); } }
  function retarget() { if (!match) return; const alive = [...match.rivals.values()].filter(r => !r.out); if (!alive.length) { match.target = null; return; } const i = alive.findIndex(r => r.id === match.target); match.target = alive[(i + 1) % alive.length].id; }
  function leaveMatch() {
    const go = () => { net.send({t: 'leave'}); match = null; room = null; screen = 'home'; held.clear(); paint(); };
    if (!match || match.result || match.game.players[0].dead) return go();
    const A = globalThis.scrapsAsk; if (A) A({title: 'Leave this match?', body: 'Leaving now counts as a loss.', yes: 'Forfeit'}).then(ok => { if (ok) go(); }); else if (confirm('Leave this match? Leaving counts as a loss.')) go();
  }
  function press(code, action) {
    if (!match || match.over || !match.started || match.game.players[0].dead) return;
    if (action === 'pause') { leaveMatch(); return; }
    held.set(code, {action, next: match.game.elapsed + match.rules.repeatDelayMs});
    match.actions.push({side: 0, action: action === 'drop' ? 'fastOn' : action});
    if(['left','right','cw','ccw'].includes(action))sound(action==='cw'||action==='ccw'?'rotate':'move');
  }
  function release(code) { const h = held.get(code); held.delete(code); if (h?.action === 'drop' && match) match.actions.push({side: 0, action: 'fastOff'}); }
  function snapshot(p) {
    return {b: p.board, a: p.active, ph: p.phase, tm: Math.round(p.timer || 0), w: p.phase === 'clear' ? p.wave : undefined, cd: p.clearDuration, cc: p.clearCellMs,
      mo: p.phase === 'settle' ? p.motion : undefined, md: p.motionDuration, av: p.phase === 'attack' ? p.attackVisual : undefined, f: Math.round(p.fall || 0), fa: p.fast, sg: Math.round(p.spawnGrace || 0),
      n: p.nextIndex, q: p.incoming.length, d: p.dead, c: p.stats.bestChain};
  }
  function tick() {
    const m = match; if (!m || m.over) return;
    if (!m.started) { if (performance.now() < m.startAt) return; m.started = true; m.actions = []; sound('start'); }
    m.actions ??= [];
    for (const h of held.values()) if ((h.action === 'left' || h.action === 'right') && m.game.elapsed >= h.next) { m.actions.push({side: 0, action: h.action}); h.next = m.game.elapsed + m.rules.repeatMs; }
    const me = m.game.players[0];
    if (m.hazard && !me.dead) while (m.hazard.at <= m.game.elapsed) { receiveBatch(m.game, 0, m.hazard.attacks, m.hazard.index); m.hazard = hazardAt(m.seed, m.hazard.index + 1, DEFAULT_PROGRESSION); }
    step(m.game, DT, m.actions); m.actions = [];
    for (const e of m.game.events) {
      if (e.side !== 0) continue;
      if (e.type === 'breaking') sound('clear', e.chain); else if (e.type === 'hit') sound('hit'); else if (e.type === 'lock') sound('lock');
      if (e.type === 'clear') { m.score += scoreClear(e.cleared.length, e.chain); m.blocks += e.cleared.length; m.combo = Math.max(m.combo, e.chain); }
    }
    const out = m.game.players[1].incoming.splice(0);
    for (const b of out) { m.sent += b.attacks.filter(a => a.kind !== 'sprinkle').length; net.send({t: 'attack', attacks: b.attacks, turn: b.sourceTurn, to: m.target}); }
    if (me.dead && !m.sentDead) { m.sentDead = true; net.send({t: 'dead'}); sendSnap(true); }
    if (performance.now() - m.snapAt >= SNAP_MS) sendSnap();
  }
  function sendSnap(force) {
    const m = match; m.snapAt = performance.now(); const s = snapshot(m.game.players[0]), text = JSON.stringify(s);
    if (!force && text === m.lastSnap) return; m.lastSnap = text; net.send({t: 'state', s, score: m.score});
  }
  function drawRival(r) {
    const cv = $('#obc-' + r.id); if (!cv) return;
    const s = r.s; if (!s) { drawBoard(cv, {board: Array.from({length: H}, () => Array(6).fill(null)), active: null, phase: 'entry', timer: 0}, {reduced: prefs.reduced}); return; }
    const age = Math.min(250, performance.now() - r.at), grounded = false;
    const p = {board: s.b, active: s.d ? null : s.a, phase: s.ph, timer: (s.tm || 0) - age, wave: s.w, clearDuration: s.cd, clearCellMs: s.cc, motion: s.mo, motionDuration: s.md, attackVisual: s.av,
      fall: s.ph === 'fall' && !grounded ? (s.f || 0) + Math.max(0, age - (s.sg || 0)) : s.f || 0, fast: s.fa, spawnGrace: Math.max(0, (s.sg || 0) - age)};
    if (p.phase === 'attack' && !p.attackVisual) p.phase = 'settle';
    drawBoard(cv, p, {gravityMs: match.rules.gravityMs, fastFallMs: match.rules.fastFallMs, reduced: prefs.reduced});
    drawNext($('#obn-' + r.id), pairAt(match.seed, s.n || 0, match.rules.breakerRate));
    if (match.mode === 'duel') match.game.players[1].board = s.b;             // keeps sent horizontal swords aimed sensibly
  }
  function render(time) {
    const m = match; if (!m || screen !== 'match') return;
    const me = m.game.players[0], now = performance.now();
    drawBoard($('#challenge-board-0'), me, {time, gravityMs: m.rules.gravityMs, fastFallMs: m.rules.fastFallMs, ghost: prefs.ghost, reduced: prefs.reduced, renderAheadMs: m.started && !m.over ? acc : 0});
    drawNext($('#obn-me'), pairAt(m.seed, me.nextIndex, m.rules.breakerRate));
    for (const r of m.rivals.values()) {
      drawRival(r);
      const el = $('#ob-' + r.id); if (el) { el.classList.toggle('eliminated', r.out); el.classList.toggle('is-target', m.mode === 'ffa' && m.target === r.id && !r.out); el.classList.toggle('ol-away', r.connected === false); }
      set('#obs-' + r.id, r.left ? 'Left' : r.out ? 'Out' : r.connected === false ? 'Reconnecting…' : r.s?.q ? r.s.q + ' incoming' : 'In play');
      set('#obsc-' + r.id, m.mode === 'ffa' ? (r.score || 0).toLocaleString() : '');
      const aimAt = [...m.aims.entries()].filter(([from, a]) => a.to === r.id && now - a.at < 900).map(([from]) => m.rivals.get(from)?.name || (from === m.you ? 'You' : '')).filter(Boolean);
      set('#obi-' + r.id, aimAt.length ? 'Hit by ' + aimAt.join(', ') : '');
    }
    set('#obs-me', me.dead ? 'Out' : m.incomingFrom && now - m.incomingAt < 1400 ? 'Incoming from ' + (m.rivals.get(m.incomingFrom)?.name || 'rival') : 'In play');
    set('#obsc-me', m.mode === 'ffa' ? m.score.toLocaleString() : '');
    set('#obi-me', me.incoming.length ? me.incoming.length + ' queued · land a pair' : '');
    set('#ol-h1', m.mode === 'duel' ? m.sent : m.score.toLocaleString()); set('#ol-h2', me.incoming.length); set('#ol-h3', net.rtt != null ? net.rtt + ' ms' : '—');
    set('#ol-clock', mmss(m.started ? m.game.elapsed : 0));
    const ov = $('#ol-overlay');
    if (ov) {
      const wait = m.startAt - now, html = !m.started && wait > 0 && wait < 1650 ? `<div class="count-in">${Math.max(1, Math.ceil(wait / 550))}</div>` : net.status !== 'online' && !m.over ? '<div class="pause-card ol-lost"><p class="eyebrow">CONNECTION</p><h2>Reconnecting…</h2></div>' : me.dead && !m.result ? '<div class="pause-card"><p class="eyebrow">OUT</p><h2>Watching the table.</h2></div>' : '';
      if (ov.dataset.html !== html) { ov.dataset.html = html; ov.innerHTML = html; ov.classList.toggle('shown', !!html); }
    }
    standings();
    if (m.mode === 'ffa' && m.stageAt !== Math.floor(m.game.elapsed / 1000)) { m.stageAt = Math.floor(m.game.elapsed / 1000); const st = progressionAt(m.game.elapsed, DEFAULT_PROGRESSION).stage; set('#ol-caption', `${st.name || 'Stage'} · waves for everyone, rising · Tab to switch target`); }
  }
  function standings() {
    const m = match, rows = [{id: m.you, name: (name || 'You') + ' (you)', score: m.score, out: m.game.players[0].dead}, ...[...m.rivals.values()].map(r => ({id: r.id, name: r.name, score: r.score || 0, out: r.out}))];
    const wins = room?.players ? Object.fromEntries(room.players.map(p => [p.id, p.wins])) : {};
    const html = rows.map(r => `<div class="challenge-rank ${r.id === m.you ? 'is-you' : ''} ${r.out ? 'out' : ''}"><span>${wins[r.id] ? '★' + wins[r.id] : '·'}</span><strong>${esc(r.name)}</strong><small>${r.out ? 'OUT' : 'PLAYING'}</small><b>${m.mode === 'ffa' ? r.score.toLocaleString() : ''}</b></div>`).join('');
    const el = $('#ol-standings'); if (el && el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    statusBadge();
  }
  function finishMatch(r) {
    const m = match; if (!m) return; m.over = true; m.result = r; held.clear();
    const mine = r.placements.find(p => p.id === m.you), won = r.winner === m.you;
    if (m.mode === 'duel') { won ? record.duel.w++ : record.duel.l++; } else { record.ffa.played++; if (won) record.ffa.w++; }
    save('online-record', record); sound(won ? 'win' : 'end');
    updateResults();
  }
  function updateResults() {
    const m = match, box = $('#ol-results'); if (!m || !m.result || !box) return;
    const r = m.result, won = r.winner === m.you, mine = r.placements.find(p => p.id === m.you), others = [...m.rivals.values()];
    const players = room?.players || [], meRow = players.find(p => p.id === m.you), waiting = players.filter(p => !p.rematch && p.id !== m.you).map(p => p.name);
    const gone = others.filter(o => o.left).length, canRematch = players.length >= (m.mode === 'duel' ? 2 : 2) && room?.state === 'results';
    const title = m.mode === 'duel' ? (won ? 'Victory.' : (others[0]?.name || 'Your rival') + ' takes this one.') : won ? 'Last board standing.' : `${PLACE[mine?.place] || ''} place.`;
    const tally = players.length ? players.map(p => `${esc(p.name)} <b>${p.wins}</b>`).join(' · ') : '';
    box.innerHTML = `<section class="panel challenge-result-card ol-result ${won ? 'win' : 'loss'}"><div><p class="eyebrow">${won ? 'VICTORY' : m.mode === 'duel' ? 'DEFEAT' : (PLACE[mine?.place] || '') + ' PLACE'}</p><h2>${title}</h2>
      ${m.mode === 'ffa' ? `<ol class="ol-placements">${r.placements.map(p => `<li class="${p.id === m.you ? 'you' : ''}"><span>${PLACE[p.place]}</span>${esc(p.id === m.you ? (name || 'You') : p.name)}</li>`).join('')}</ol>` : ''}
      <p class="muted">${tally ? 'Wins at this table: ' + tally : ''}${notice ? '<br>' + esc(notice) : ''}</p></div>
      <div class="button-row">${canRematch ? `<button class="primary" id="ol-rematch" ${meRow?.rematch ? 'disabled' : ''}>${meRow?.rematch ? (waiting.length ? 'Waiting for ' + esc(waiting.join(', ')) : 'Starting…') : 'Rematch'}</button>` : `<button class="primary" id="ol-again">Find another match</button>`}<button id="ol-lobby">Back to lobby</button></div></section>`;
    $('#ol-rematch')?.addEventListener('click', () => net.send({t: 'rematch'}));
    $('#ol-again')?.addEventListener('click', () => { net.send({t: 'leave'}); match = null; room = null; notice = ''; net.send({t: 'quick', mode}); screen = 'queue'; paint(); });
    $('#ol-lobby')?.addEventListener('click', () => { net.send({t: 'leave'}); match = null; room = null; notice = ''; screen = 'home'; paint(); });
    void gone;
  }

  function frame(t) {
    if (disposed) return;
    const dt = Math.min(100, t - (last || t)); last = t;
    if (match && !match.over && screen === 'match') { acc += dt; while (acc >= DT) { tick(); acc -= DT; } } else acc = 0;
    render(t); raf = requestAnimationFrame(frame);
  }
  addEventListener('keydown', e => {
    if (screen !== 'match' || !match || document.querySelector('dialog[open]') || document.activeElement?.matches('input,select,textarea')) return;
    if (e.code === 'Tab' && match.mode === 'ffa') { e.preventDefault(); retarget(); return; }
    const action = actionFor(prefs.keys,e.code); if (!action) return;
    e.preventDefault(); if (!e.repeat) press(e.code, action);
  }, {signal: life.signal});
  addEventListener('keyup', e => release(e.code), {signal: life.signal});
  addEventListener('blur', () => { for (const code of [...held.keys()]) release(code); }, {signal: life.signal});

  paint(); raf = requestAnimationFrame(frame);
  const api = {
    isActive: () => !!match && !match.over && !match.game.players[0].dead,
    pause: () => {},
    leave: leaveMatch,
    getState: () => ({screen, mode, status: net.status, room, match: match ? {mode: match.mode, you: match.you, seed: match.seed, started: match.started, over: match.over, result: match.result, sent: match.sent, score: match.score, target: match.target, dead: match.game.players[0].dead, turn: match.game.players[0].turn, incoming: match.game.players[0].incoming.length, rivals: [...match.rivals.values()].map(r => ({id: r.id, name: r.name, out: r.out, hasState: !!r.s}))} : null}),
    destroy() { disposed = true; life.abort(); cancelAnimationFrame(raf); held.clear(); net.close(); if (globalThis.__scrapsOnline === api) delete globalThis.__scrapsOnline; },
    _net: net,
  };
  globalThis.__scrapsOnline = api;   // for QA scripts and debugging
  return api;
}
