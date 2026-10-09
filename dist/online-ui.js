// Online play: lobby (quick match, open tables, private rooms, live tables to watch or join, recent results,
// leaderboard), Online Duel and Online Free-for-All, and watching other people's matches.
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
import {createComboLog, stepOf, comboHTML, comboName} from './combo-log.js';
import {createPlayout, finisherOf, showFinisher, batchArea} from './finisher.js';

const DT = 1000 / 60, SNAP_MS = 50;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const PLACE = ['', '1st', '2nd', '3rd', '4th'];
const MODE_NAME = {duel: 'Online Duel', ffa: 'Online Free-for-All'};

export function createOnlineUI({host, prefs, read, save, sound, getBlade, swordIcon = () => '', showSettings, onExit}) {
  const $ = q => host.querySelector(q), life = new AbortController(), held = new Map();
  let mode = globalThis.scrapsOnlineMode || read('online-mode', 'duel'); if (!['duel', 'ffa'].includes(mode)) mode = 'duel';
  let name = read('online-name', '') || '', screen = 'home', room = null, queueInfo = null, match = null, notice = '', raf = 0, last = 0, acc = 0, disposed = false;
  let lobby = null, listTab = read('online-tab', 'live'), watch = null, series = null;   // series: the games played at this table with these rivals
  // this browser's own id for the leaderboard (an account-free "this browser's record"); never shown to anyone
  let pid = read('player-id', ''); if (!/^[A-Za-z0-9_-]{12,64}$/.test(pid)) { pid = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); save('player-id', pid); }
  const record = read('online-record', {duel: {w: 0, l: 0}, ffa: {w: 0, played: 0}});
  const blade = () => { const b = getBlade?.() || {}; return {id: b.id, iconId: b.iconId ?? b.id, name: b.name || 'Blade', rows: b.rows || []}; };
  const net = connectOnline({hello: () => ({name: name || 'Swordhand', blade: blade(), v: 1, pid})});
  const rules = () => handlingRules({...HOUSE_RULES, repeatDelayMs: prefs.rules?.repeatDelayMs ?? HOUSE_RULES.repeatDelayMs, repeatMs: prefs.rules?.repeatMs ?? HOUSE_RULES.repeatMs, dropBufferMs: prefs.rules?.dropBufferMs ?? HOUSE_RULES.dropBufferMs, stallFlips: 3, wellFlip: true});
  const set = (q, v) => { const el = $(q); if (el && el.textContent !== String(v)) el.textContent = String(v); };

  // ---------- network events ----------
  net.on('status', ({status}) => { if (status === 'online') net.send({t: 'lobby'}); if (screen === 'home' || screen === 'queue' || screen === 'room') paint(); else statusBadge(); });
  net.on('lobby', m => { lobby = m; if (screen === 'home') paintLists(); }); net.send({t: 'lobby'});
  net.on('queue', m => { queueInfo = m.mode ? m : null; if (screen === 'queue' && !m.mode) screen = 'home'; if (screen !== 'match') paint(); });
  net.on('room', m => {
    if (m.state === 'none') { room = null; if (screen === 'watch') { watch = null; if (m.closed) notice = 'That table has closed.'; } if (screen !== 'match') { screen = 'home'; paint(); } return; }
    if (m.watching) { room = m; if (watch) { watch.room = m; watchResults(); } return; }
    room = m; mode = m.mode;
    if (screen === 'match') updateResults(); else { screen = 'room'; paint(); }
  });
  net.on('error', m => { notice = m.message || 'Something went wrong.'; paint(); });
  net.on('start', m => m.watching ? beginWatch(m) : beginMatch(m));
  net.on('state', m => { if (watch) { const w = watch.players.get(m.from); if (w) { w.s = m.s; w.at = performance.now(); if (typeof m.score === 'number') w.score = m.score; } return; } if (!match) return; const r = match.rivals.get(m.from); if (r) { r.s = m.s; r.at = performance.now(); if (typeof m.score === 'number') r.score = m.score; } });
  net.on('attack', m => { if (!match || match.over) return; if (receiveBatch(match.game, 0, m.attacks, m.turn)) { match.incomingFrom = m.from; match.incomingAt = performance.now(); match.lastHit = {from: m.from, at: performance.now(), area: batchArea(m.attacks)}; } });
  // someone's finished combo: into the log, and its name flashes over their board
  net.on('combo', m => {
    const at = watch || match; if (!at || !m.c) return;
    const c = {chain: m.c.chain | 0, steps: Array.isArray(m.c.steps) ? m.c.steps : []};
    at.log.add(m.from, c, {to: m.to || null}); flash(m.from, c);
    const who = watch ? watch.players.get(m.from) : match.rivals.get(m.from);
    if (who) who.sent = (who.sent || 0) + c.steps.reduce((n, s) => n + (s.s?.length || 0), 0);
  });
  net.on('aimed', m => { if (match) match.aims.set(m.from, {to: m.to, at: performance.now()}); });
  net.on('out', m => { if (watch) { const w = watch.players.get(m.id); if (w) w.out = true; return; } if (!match) return; if (m.id === match.you) return; const r = match.rivals.get(m.id); if (r) { r.out = true; if (match.game.players[1] && match.mode === 'duel') match.game.players[1].dead = true; } if (match.target === m.id) retarget(); });
  net.on('result', m => { if (watch) { watch.result = {...m, at: performance.now()}; watch.shownAt = 0; watchResults(); } else finishMatch(m); });
  net.on('left', m => { if (watch) { const w = watch.players.get(m.id); if (w) { w.left = true; w.out = true; } return; } if (match) { const r = match.rivals.get(m.id); if (r) { r.left = true; r.out = true; } } notice = `${m.name} ${m.why === 'disconnected' ? 'lost connection' : 'left'}.`; if (screen === 'match') updateResults(); else paint(); });
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
    const head = `<section class="room-heading pm-heading ol-heading"><div><p class="eyebrow">ONLINE</p><h1>${screen === 'room' ? (room?.private || room?.open ? 'Your table.' : 'Match found.') : screen === 'queue' ? 'Finding rivals.' : 'Cross blades.'}</h1></div></section>`;
    let body = '';
    if (screen === 'home') {
      body = `<div class="ol-modes">${['duel', 'ffa'].map(k => `<button class="pm-diff-item ${k === mode ? 'selected' : ''}" data-mode="${k}"><strong>${k === 'duel' ? 'Duel' : 'Free-for-All'}</strong><small>${k === 'duel' ? 'One on one. First to top out loses' : 'Two to four players. Last board standing'}</small></button>`).join('')}</div>
        <div class="ol-you"><span class="ol-blade">${swordIcon(b.iconId)}</span><label class="ol-name"><small>YOUR NAME</small><input id="ol-name" maxlength="16" autocomplete="nickname" placeholder="Swordhand" value="${esc(name)}"></label><div class="ol-blade-name"><small>YOUR BLADE</small><strong>${esc(b.name)}</strong></div></div>
        <nav class="ol-menu">
          <button class="primary" id="ol-quick" ${online ? '' : 'disabled'}>Quick match</button>
          <div class="ol-menu-row"><button class="ol-item" id="ol-host" ${online ? '' : 'disabled'}>Host a table</button><button class="ol-item" id="ol-create" ${online ? '' : 'disabled'}>Private room</button></div>
          <div class="ol-join"><input id="ol-code" maxlength="4" placeholder="CODE" autocapitalize="characters" spellcheck="false"><button class="ol-item" id="ol-join" ${online ? '' : 'disabled'}>Join</button></div>
        </nav>
        <p class="ol-notice">${esc(notice)}</p>
        <p class="ol-record">${mode === 'duel' ? `<b>${record.duel.w}</b> won · <b>${record.duel.l}</b> lost online` : `<b>${record.ffa.w}</b> wins in <b>${record.ffa.played}</b> free-for-alls`}</p>
        <section class="ol-board"><div class="ol-tabs" role="tablist">${[['live', 'Live tables'], ['top', 'Leaderboard'], ['recent', 'Recent']].map(([k, l]) => `<button role="tab" data-list="${k}" aria-selected="${listTab === k}">${l}</button>`).join('')}</div><div id="ol-lists"></div></section>`;
    } else if (screen === 'queue') {
      body = `<div class="ol-wait"><div class="ol-spinner" aria-hidden="true"></div><p class="ol-big">${mode === 'duel' ? 'Looking for a rival…' : 'Gathering the table…'}</p>
        <p class="muted">${queueInfo ? `${queueInfo.waiting} of ${queueInfo.need} waiting${mode === 'ffa' && queueInfo.waiting >= 2 ? ' · starts shortly' : ''}` : ''}</p>
        <button class="ol-item" id="ol-cancel">Cancel</button></div>`;
    } else if (screen === 'room' && room) {
      const me = room.players.find(p => p.id === net.id), allReady = room.players.every(p => p.ready || p.host);
      body = `<div class="ol-room">
        ${room.private ? `<div class="ol-code"><small>ROOM CODE</small><strong>${esc(room.code)}</strong><button class="ol-item" id="ol-copy">Copy</button></div>` : room.open ? `<p class="ol-open-note">Open table · listed in the lobby for anyone to join or watch</p>` : ''}
        <ol class="ol-players">${room.players.map(p => `<li class="${p.ready ? 'ready' : ''} ${p.connected ? '' : 'away'}"><span class="ol-blade">${swordIcon(p.blade?.iconId)}</span><div><strong>${esc(p.name)}${p.id === net.id ? ' <em>you</em>' : ''}</strong><small>${esc(p.blade?.name || '')}${p.wins ? ` · ${p.wins} won` : ''}</small></div><b>${!p.connected ? 'Away' : p.ready ? 'Ready' : p.host && room.mode === 'ffa' ? 'Host' : 'Not ready'}</b></li>`).join('')}
          ${Array.from({length: Math.max(0, room.max - room.players.length)}, () => `<li class="empty"><span class="ol-blade"></span><div><strong>Open seat</strong><small>${room.private ? 'Share the code' : room.open ? 'Waiting for a player' : ''}</small></div></li>`).join('')}</ol>
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
    on('#ol-host', () => { notice = ''; profile(); net.send({t: 'create', mode, public: true}); });
    for (const b of host.querySelectorAll('[data-list]')) b.onclick = () => { listTab = b.dataset.list; save('online-tab', listTab); for (const x of host.querySelectorAll('[data-list]')) x.setAttribute('aria-selected', String(x === b)); paintLists(); };
    paintLists();
    on('#ol-join', () => { const c = $('#ol-code')?.value.trim(); if (!c || c.length < 4) { notice = 'Room codes are four letters.'; paint(); return; } notice = ''; profile(); net.send({t: 'join', code: c}); });
    on('#ol-cancel', () => { net.send({t: 'cancel'}); screen = 'home'; paint(); });
    on('#ol-ready', () => { const me = room?.players.find(p => p.id === net.id); net.send({t: 'ready', ready: !me?.ready}); });
    on('#ol-start', () => net.send({t: 'start'}));
    on('#ol-leave', () => { net.send({t: 'leave'}); room = null; screen = 'home'; paint(); });
    on('#ol-copy', () => { try { navigator.clipboard.writeText(room.code); notice = 'Code copied.'; } catch { notice = 'Code: ' + room.code; } paint(); });
  }
  function profile() { const nm = $('#ol-name'); if (nm) { name = nm.value.trim().slice(0, 16); save('online-name', name); } net.send({t: 'profile', name: name || 'Swordhand', blade: blade()}); }

  // ---------- the lobby lists: live tables, leaderboard, recent results ----------
  const ago = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
  function paintLists() {
    const box = $('#ol-lists'); if (!box) return;
    let html = '';
    if (!lobby) html = `<p class="ol-empty">${net.status === 'online' ? 'Loading…' : 'Connect to see who’s playing.'}</p>`;
    else if (listTab === 'live') {
      const games = lobby.games || [];
      html = `<p class="ol-online">${lobby.online} in the tavern</p>` + (games.length ? `<ol class="ol-players ol-tables">${games.map(g => {
        const label = g.state === 'playing' ? 'Playing' + (g.since ? ' · ' + mmss(g.since) : '') : g.state === 'countdown' ? 'Starting' : g.state === 'results' ? 'Between rounds' : g.open ? `Open · ${g.players.length}/${g.seats}` : 'Waiting';
        const names = g.players.map(p => `<span class="${p.out ? 'out' : ''}">${esc(p.name)}${p.wins ? ' <i>★' + p.wins + '</i>' : ''}</span>`).join(g.mode === 'duel' ? ' <em>vs</em> ' : ' · ');
        return `<li><span class="ol-blade">${swordIcon(g.players[0]?.blade?.iconId)}</span><div><strong>${names || 'Empty table'}</strong><small>${g.mode === 'duel' ? 'Duel' : 'Free-for-All'} · ${label}${g.watchers ? ` · ${g.watchers} watching` : ''}</small></div><span class="ol-table-acts">${g.open ? `<button class="ol-item" data-join="${esc(g.code)}">Join</button>` : ''}${g.state !== 'lobby' || g.players.length > 1 ? `<button class="ol-item" data-watch="${esc(g.code)}">Watch</button>` : ''}</span></li>`; }).join('')}</ol>`
        : `<p class="ol-empty">No tables yet. Start a quick match or host one — it’ll show here for others to join or watch.</p>`);
    } else if (listTab === 'top') {
      const top = lobby.top || [];
      html = top.length ? `<ol class="ol-ranks">${top.map(p => `<li class="${p.id === lobby.me ? 'you' : ''}"><span>${p.rank}</span><strong>${esc(p.name)}${p.id === lobby.me ? ' <em>you</em>' : ''}</strong><b>${p.rating}</b><small>${p.wins}–${p.losses}</small></li>`).join('')}</ol><p class="ol-fine">Rating from online duels and free-for-alls. Your record lives on this browser.</p>`
        : `<p class="ol-empty">No ranked games yet. Win an online match to take the top spot.</p>`;
    } else {
      const rec = lobby.recent || [];
      html = rec.length ? `<ol class="ol-recent">${rec.map(r => { const w = r.players.find(p => p.place === 1), rest = r.players.filter(p => p.place !== 1);
        return `<li><strong>${esc(w?.name || 'No one')}</strong> ${r.mode === 'duel' ? 'beat' : 'won against'} ${rest.map(p => esc(p.name)).join(', ')}<small>${r.mode === 'duel' ? 'Duel' : 'Free-for-All'} · ${ago(r.at)}</small></li>`; }).join('')}</ol>`
        : `<p class="ol-empty">No results yet.</p>`;
    }
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
    for (const b of box.querySelectorAll('[data-join]')) b.onclick = () => { notice = ''; profile(); net.send({t: 'join', code: b.dataset.join}); };
    for (const b of box.querySelectorAll('[data-watch]')) b.onclick = () => { notice = ''; net.send({t: 'watch', code: b.dataset.watch}); };
  }

  // ---------- the stage: boards first, sized to the screen; everything else around them ----------
  // Boards are as tall as the window allows (their tops are fixed, so one measure is enough); the
  // side rails take what is left, and fold under the boards on narrow screens.
  function fit() {
    const st = $('.ol-stage'); if (!st) return;
    const frame = st.querySelector('.ol-boards>.challenge-board .board-frame'); if (!frame) return;
    const narrow = innerWidth < 980, rect = el => el.getBoundingClientRect(), board = frame.closest('.challenge-board');
    // a board's header and foot (above and below its frame), measured: they are the same at any size
    const head = rect(frame).top - rect(board).top, foot = rect(board).bottom - rect(frame).bottom;
    const mini = st.querySelector('.ol-rivals .board-frame'), mhead = mini ? rect(mini).top - rect(mini.closest('.challenge-board')).top : 0, mfoot = mini ? rect(mini.closest('.challenge-board')).bottom - rect(mini).bottom : 0;
    const top = rect(frame).top + scrollY;
    const sh = document.documentElement.scrollHeight, below = (sh > innerHeight ? Math.max(0, sh - (rect(host).bottom + scrollY)) : 0) + parseFloat(getComputedStyle(host).paddingBottom || 0);
    let fh = Math.max(240, innerHeight - top - foot - (narrow ? 120 : Math.max(10, below + 2)));     // a full board's frame height
    const boards = st.querySelectorAll('.ol-boards>.challenge-board').length, miniFrames = [...st.querySelectorAll('.ol-rivals .board-frame')], minis = miniFrames.length;
    const rows = minis >= 3 ? 2 : 1, cols = Math.ceil(minis / rows);
    const border = f => { const c = f?.querySelector('canvas'); return c ? [f.offsetHeight - c.offsetHeight, f.offsetWidth - c.offsetWidth] : [0, 0]; };
    const [ph, pw] = border(frame), [mph, mpw] = border(miniFrames[0]);
    const widthOf = (h, bh, bw) => (h - bh) * 4 / 13 + bw;
    // rival boards in a free-for-all: two rows as tall as your board together, or one row at about two-thirds
    const sizes = h => [widthOf(h, ph, pw), minis ? widthOf(rows === 2 ? (head + h + foot - 10) / 2 - mhead - mfoot : h * .64, mph, mpw) : 0];
    const gap = Math.max(36, Math.min(64, innerWidth * .04)), rails = narrow ? 0 : 2 * Math.min(300, Math.max(210, innerWidth * .18)) + 2 * Math.max(24, Math.min(56, innerWidth * .03));
    const room = innerWidth - rails - (narrow ? 24 : 116);
    const need = ([bw, mw]) => boards * bw + (boards - 1 + (minis ? 1 : 0)) * gap + (narrow ? 0 : 132) + (minis ? cols * mw + (cols - 1) * 16 : 0);
    let [bw, mw] = sizes(fh);
    while (need([bw, mw]) > room && fh > 200) [bw, mw] = sizes(fh -= 8);
    if (bw > 330) [bw, mw] = sizes(fh = (330 - pw) * 13 / 4 + ph);
    st.style.setProperty('--bh', Math.round(head + fh + foot) + 'px'); st.style.setProperty('--bw', Math.round(bw) + 'px'); st.style.setProperty('--mw', Math.round(mw) + 'px'); st.style.setProperty('--rows', rows);
  }
  addEventListener('resize', () => fit(), {signal: life.signal});

  const nameOf = id => id === match?.you ? (name || 'You') : match?.rivals.get(id)?.name || watch?.players.get(id)?.name || 'Rival';
  function flash(boardId, c) {
    const b = $('#obb-' + boardId); if (!b || c.chain < 2) return;
    b.textContent = comboName(c.chain) + ' ×' + c.chain; b.className = 'board-banner ol-banner active tier-' + Math.min(6, c.chain);
    clearTimeout(b.t); b.t = setTimeout(() => b.classList.remove('active'), 950);
  }
  function paintLog(log, box, me) {
    if (!box || box.dataset.v === String(log.version) + (match?.target || '')) return; box.dataset.v = String(log.version) + (match?.target || '');
    // a free-for-all shows what concerns you: your combos, combos sent at you, and your target's
    const shown = me && match?.mode === 'ffa' ? log.entries.filter(c => c.who === me || c.to === me || c.who === match.target) : log.entries;
    box.innerHTML = shown.length ? shown.map(c => comboHTML(c, {who: c.who === me ? 'You' : nameOf(c.who), mine: c.who === me, to: !c.to ? '' : me && c.to === me ? (c.who !== me ? 'you' : '') : nameOf(c.to)})).join('') : '<p class="muted">No combos yet.</p>';
  }

  // ---------- watching someone else's match ----------
  function beginWatch(m) {
    const keep = watch && watch.code === m.code ? watch : null;
    watch = {code: m.code, mode: m.mode, round: m.round, seed: m.seed, startAt: performance.now() + (m.in || 0), result: null, room: keep?.room || room, log: createComboLog({limit: 10}), shownAt: 0,
      players: new Map(m.players.map(p => [p.id, {id: p.id, name: p.name, blade: p.blade, s: keep?.players.get(p.id)?.s || null, at: 0, score: 0, best: 0, sent: 0, out: m.alive ? !m.alive.includes(p.id) : false}]))};
    screen = 'watch'; held.clear(); renderWatch();
  }
  function renderWatch() {
    const ps = [...watch.players.values()], duel = watch.mode === 'duel';
    host.innerHTML = `<section class="room-heading game-heading ol-head"><div><p class="eyebrow">WATCHING · ${duel ? 'ONLINE DUEL' : 'ONLINE FREE-FOR-ALL'} · ROUND ${watch.round}</p><h1>${duel ? ps.map(p => esc(p.name)).join(' vs. ') : 'Last board standing.'}</h1></div>
      <div class="match-tools"><span id="ol-clock">0:00</span><button id="ol-stopwatch">Back to lobby</button></div></section>
      <div class="ol-stage online-arena ol-watching ${duel ? 'ol-duel' : 'ol-ffa'}">
        <aside class="ol-rail ol-rail-l"><section class="ol-card"><p class="eyebrow">COMBOS</p><div id="ol-combos" class="chain-log"><p class="muted">No combos yet.</p></div></section></aside>
        <div class="ol-boards">${ps.map((p, i) => boardHTML(p.id, p.name, p.blade?.name || '', false, false, duel && i === 1 ? 'right' : 'left')).join('')}</div>
        <aside class="ol-rail ol-rail-r"><section class="ol-card"><p class="eyebrow">${duel ? 'THE DUEL' : 'THE TABLE'}</p><div id="ol-standings"></div></section><p class="ol-net" id="ol-net">${statusLine()}</p></aside>
      </div><div id="ol-results"></div>`;
    $('#ol-stopwatch').onclick = () => { net.send({t: 'unwatch'}); watch = null; room = null; screen = 'home'; paint(); };
    fit(); requestAnimationFrame(fit); watchResults();
  }
  function watchResults() {
    const box = $('#ol-results'); if (!watch || !box) return;
    const r = watch.result; if (!r || !watch.shownAt) { box.innerHTML = ''; return; }
    const win = r.placements.find(p => p.place === 1), wp = watch.players.get(win?.id);
    box.innerHTML = `<div class="ol-veil"><section class="pause-card endgame win ol-end"><div class="eg-banner"><span>${watch.mode === 'duel' ? 'DUEL OVER' : 'TABLE CLEARED'}</span></div>
      <div class="eg-blade">${swordIcon(wp?.blade?.iconId)}</div><h2>${esc(win?.name || 'No one')} wins.</h2>
      ${placementsHTML(r, null, id => watch.players.get(id))}
      <p class="muted">Stay to watch the rematch, or head back to the lobby.</p>
      <div class="eg-actions"><button class="primary" id="ol-watch-back">Back to lobby</button></div></section></div>`;
    $('#ol-watch-back').onclick = () => { net.send({t: 'unwatch'}); watch = null; room = null; screen = 'home'; paint(); };
  }
  function drawSnap(cv, nextCv, s, at, seed, r) {
    if (!cv) return;
    if (!s) { drawBoard(cv, {board: Array.from({length: H}, () => Array(6).fill(null)), active: null, phase: 'entry', timer: 0}, {reduced: prefs.reduced}); return; }
    const age = Math.min(250, performance.now() - at);
    const p = {board: s.b, active: s.d ? null : s.a, phase: s.ph, timer: (s.tm || 0) - age, wave: s.w, clearDuration: s.cd, clearCellMs: s.cc, motion: s.mo, motionDuration: s.md, attackVisual: s.av,
      fall: s.ph === 'fall' ? (s.f || 0) + Math.max(0, age - (s.sg || 0)) : s.f || 0, fast: s.fa, spawnGrace: Math.max(0, (s.sg || 0) - age)};
    if (p.phase === 'attack' && !p.attackVisual) p.phase = 'settle';
    drawBoard(cv, p, {gravityMs: r.gravityMs, fastFallMs: r.fastFallMs, reduced: prefs.reduced});
    if (nextCv) drawNext(nextCv, pairAt(seed, s.n || 0, r.breakerRate));
  }
  function renderWatchFrame() {
    const r = rules(), now = performance.now(), duel = watch.mode === 'duel';
    for (const p of watch.players.values()) {
      drawSnap($('#obc-' + p.id), $('#obn-' + p.id), p.s, p.at, watch.seed, r);
      const el = $('#ob-' + p.id); if (el) el.classList.toggle('eliminated', !!p.out);
      set('#obs-' + p.id, p.left ? 'Left' : p.out ? 'Out' : p.s?.q ? p.s.q + ' incoming' : (p.blade?.name || 'In play'));
      set('#obsc-' + p.id, duel ? '' : (p.score || 0).toLocaleString()); set('#obi-' + p.id, p.s?.c ? 'Best ×' + p.s.c : '');
    }
    const wait = watch.startAt - now; set('#ol-clock', wait > 0 ? 'Starting…' : mmss(-wait));
    paintLog(watch.log, $('#ol-combos'), null);
    rankList([...watch.players.values()].map(p => ({id: p.id, name: p.name, score: p.score || 0, out: p.out, best: p.s?.c || 0, sent: p.sent})), null, duel);
    // the result waits for the winner's last combo to finish on screen
    if (watch.result && !watch.shownAt) {
      const w = watch.players.get(watch.result.winner), calm = !w?.s || w.s.ph === 'fall' || w.s.ph === 'entry';
      if ((calm && now - watch.result.at > 250) || now - watch.result.at > 5000) { watch.shownAt = now; const wa = watch; endWith(finisherFor(wa.log, wa.result.winner, null), wa.result.winner).then(() => { if (watch === wa) { sound('end'); watchResults(); } }); }
    }
  }

  // ---------- the match ----------
  // side: which shoulder of the board the next-pair box sits on (yours on the left, a duel rival's on the right)
  function boardHTML(id, label, sub, mini, mine, side = 'left') {
    return `<section class="challenge-board ol-board ${mini ? 'mini' : ''} ${mine ? 'ol-mine' : 'ol-rival'} next-${side}" id="ob-${id}" ${mine || !match || match.mode !== 'ffa' ? '' : `data-target="${id}" title="Click to aim your attacks here"`}>
      <div class="board-header"><div><strong>${esc(label)}</strong><span id="obs-${id}">${esc(sub)}</span></div><div class="next-piece"><span>NEXT</span><canvas id="obn-${id}"></canvas></div></div>
      <div class="board-frame"><canvas id="${mine ? 'challenge-board-0' : 'obc-' + id}" role="img" aria-label="${esc(label)} board"></canvas><div class="board-banner ol-banner" id="obb-${id}"></div>${mine ? '<div id="ol-overlay" class="game-overlay"></div>' : '<i class="ol-aim">TARGET</i>'}</div>
      <div class="challenge-board-foot"><strong id="obsc-${id}"></strong><span id="obi-${id}"></span></div></section>`;
  }
  function beginMatch(m) {
    const me = m.players.find(p => p.id === m.you), others = m.players.filter(p => p.id !== m.you), r = rules();
    const game = createMatch({seed: m.seed, mode: 'online', rules: r, pattern: me?.blade?.rows?.length ? me.blade.rows : undefined, opponentPattern: others[0]?.blade?.rows?.length ? others[0].blade.rows : undefined});
    match = {mode: m.mode, round: m.round, seed: m.seed, you: m.you, game, rules: r, startAt: performance.now() + m.in, elapsed: 0, started: false,
      rivals: new Map(others.map(p => [p.id, {id: p.id, name: p.name, blade: p.blade, s: null, at: 0, score: 0, out: false, connected: true, sent: 0}])),
      target: others[0]?.id ?? null, aims: new Map(), sent: 0, score: 0, blocks: 0, combo: 0, snapAt: 0, lastSnap: '', sentDead: false, over: false, result: null,
      hazard: m.mode === 'ffa' ? hazardAt(m.seed, 0, DEFAULT_PROGRESSION) : null, incomingFrom: null, incomingAt: 0, introDone: false,
      log: createComboLog({limit: 10}), lastHit: null, lastSent: null, playout: null, shownAt: 0};
    const key = m.mode + ':' + m.players.map(p => p.id).sort().join(',');
    if (series?.key !== key) series = {key, mode: m.mode, rounds: []};
    screen = 'match'; notice = ''; held.clear(); renderMatch();
    if (m.mode === 'duel' && globalThis.scrapsIntro && others[0]) {
      const b = blade();
      globalThis.scrapsIntro({eyebrow: 'ONLINE DUEL · ROUND ' + m.round, left: {name: name || 'You', sub: b.name, art: swordIcon(b.iconId)}, right: {name: others[0].name, sub: others[0].blade?.name || '', art: swordIcon(others[0].blade?.iconId)}});
    }
  }
  function renderMatch() {
    const others = [...match.rivals.values()], duel = match.mode === 'duel';
    host.innerHTML = `<section class="room-heading game-heading ol-head"><div><p class="eyebrow">${duel ? 'ONLINE DUEL' : 'ONLINE FREE-FOR-ALL'} · ROUND ${match.round}</p><h1 id="ol-title">${duel ? 'You vs. ' + esc(others[0]?.name || 'rival') : 'Last board standing.'}</h1></div>
      <div class="match-tools"><span id="ol-clock">0:00</span><button id="online-leave">Leave</button></div></section>
      <div class="ol-stage online-arena ${duel ? 'ol-duel' : 'ol-ffa'}">
        <aside class="ol-rail ol-rail-l">
          <div class="ol-stats"><div><span>${duel ? 'SWORDS SENT' : 'SCORE'}</span><strong id="ol-h1">0</strong></div><div><span>BEST COMBO</span><strong id="ol-hb">–</strong></div><div><span>INCOMING</span><strong id="ol-h2">0</strong></div></div>
          <section class="ol-card"><p class="eyebrow">COMBOS</p><div id="ol-combos" class="chain-log" aria-live="polite"><p class="muted">No combos yet.</p></div></section>
        </aside>
        <div class="ol-boards">${boardHTML('me', name || 'You', 'In play', false, true)}${duel ? boardHTML(others[0]?.id, others[0]?.name || 'Rival', others[0]?.blade?.name || 'In play', false, false, 'right') : `<div class="ol-rivals">${others.map(o => boardHTML(o.id, o.name, o.blade?.name || 'In play', true, false)).join('')}</div>`}</div>
        <aside class="ol-rail ol-rail-r">
          <section class="ol-card"><p class="eyebrow">${duel ? 'THE DUEL' : 'THE TABLE'}</p><div id="ol-standings"></div></section>
          <p class="ol-caption" id="ol-caption">${duel ? 'First to top out loses.' : 'Click a rival’s board, or press Tab, to aim.'}</p>
          <p class="ol-net" id="ol-net">${statusLine()}</p>
        </aside>
        <div class="touch-controls ol-touch">${[['left', '←'], ['ccw', '↶'], ['cw', '↷'], ['right', '→'], ['drop', 'Drop']].map(([a, t]) => `<button data-ol-action="${a}" aria-label="${a}">${t}</button>`).join('')}</div>
      </div><div id="ol-results"></div>`;
    $('#online-leave').onclick = leaveMatch;
    for (const b of host.querySelectorAll('[data-ol-action]')) {
      b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press('touch-' + b.dataset.olAction, b.dataset.olAction); };
      b.onpointerup = b.onpointercancel = () => release('touch-' + b.dataset.olAction);
    }
    for (const b of host.querySelectorAll('[data-target]')) b.onclick = () => aim(b.dataset.target);
    fit(); requestAnimationFrame(fit);
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
  // my combos: logged as they build, and announced to the table when they end
  function myEvents(m, events) {
    for (const e of events) {
      if (e.side !== 0) continue;
      if (e.type === 'breaking') { sound('clear', e.chain); const c = m.log.step(m.you, stepOf(e), {to: m.mode === 'ffa' ? m.target : null}); flash('me', c); }
      else if (e.type === 'hit') sound('hit'); else if (e.type === 'lock') sound('lock');
      if (e.type === 'clear') { m.score += scoreClear(e.cleared.length, e.chain); m.blocks += e.cleared.length; m.combo = Math.max(m.combo, e.chain); }
    }
    if (!m.game.players[0].chain) { const c = m.log.close(m.you, m.mode === 'ffa' ? {to: m.target} : null); if (c) { m.lastCombo = c; net.send({t: 'combo', c: {chain: c.chain, steps: c.steps}, to: c.to || null}); } }
  }
  function tick() {
    const m = match; if (!m) return;
    if (m.over) { // the match is decided: my board finishes what it was doing, then the result
      if (m.playout && !m.playout.done) { m.playout.step(DT); m.game = m.playout.state; myEvents(m, m.game.events); flushAttacks(m); if (m.playout.done || performance.now() - m.snapAt >= SNAP_MS) sendSnap(); }
      return;
    }
    if (!m.started) { if (performance.now() < m.startAt) return; m.started = true; m.actions = []; sound('start'); }
    m.actions ??= [];
    for (const h of held.values()) if ((h.action === 'left' || h.action === 'right') && m.game.elapsed >= h.next) { m.actions.push({side: 0, action: h.action}); h.next = m.game.elapsed + m.rules.repeatMs; }
    const me = m.game.players[0];
    if (m.hazard && !me.dead) while (m.hazard.at <= m.game.elapsed) { receiveBatch(m.game, 0, m.hazard.attacks, m.hazard.index); m.hazard = hazardAt(m.seed, m.hazard.index + 1, DEFAULT_PROGRESSION); }
    step(m.game, DT, m.actions); m.actions = [];
    myEvents(m, m.game.events);
    flushAttacks(m);
    if (me.dead && !m.sentDead) { m.sentDead = true; net.send({t: 'dead'}); sendSnap(true); }
    if (performance.now() - m.snapAt >= SNAP_MS) sendSnap();
  }
  function flushAttacks(m) {
    const out = m.game.players[1].incoming.splice(0);
    for (const b of out) { m.sent += b.attacks.filter(a => a.kind !== 'sprinkle').length; m.lastSent = {at: performance.now(), area: batchArea(b.attacks)}; net.send({t: 'attack', attacks: b.attacks, turn: b.sourceTurn, to: m.target}); }
  }
  function sendSnap(force) {
    const m = match; m.snapAt = performance.now(); const s = snapshot(m.game.players[0]), text = JSON.stringify(s);
    if (!force && text === m.lastSnap) return; m.lastSnap = text; net.send({t: 'state', s, score: m.score});
  }
  function drawRival(r) {
    drawSnap($('#obc-' + r.id), $('#obn-' + r.id), r.s, r.at, match.seed, match.rules);
    if (match.mode === 'duel' && r.s) match.game.players[1].board = r.s.b;             // keeps sent horizontal swords aimed sensibly
  }
  function render(time) {
    if (screen === 'watch' && watch) { renderWatchFrame(); return; }
    const m = match; if (!m || screen !== 'match') return;
    const me = m.game.players[0], now = performance.now();
    drawBoard($('#challenge-board-0'), me, {time, gravityMs: m.rules.gravityMs, fastFallMs: m.rules.fastFallMs, ghost: prefs.ghost && !m.over, reduced: prefs.reduced, renderAheadMs: m.started && (!m.over || (m.playout && !m.playout.done)) ? acc : 0});
    drawNext($('#obn-me'), pairAt(m.seed, me.nextIndex, m.rules.breakerRate));
    for (const r of m.rivals.values()) {
      drawRival(r);
      const el = $('#ob-' + r.id); if (el) { el.classList.toggle('eliminated', r.out); el.classList.toggle('is-target', m.mode === 'ffa' && m.target === r.id && !r.out); el.classList.toggle('ol-away', r.connected === false); }
      set('#obs-' + r.id, r.left ? 'Left' : r.out ? 'Out' : r.connected === false ? 'Reconnecting…' : r.s?.q ? r.s.q + ' incoming' : 'In play');
      set('#obsc-' + r.id, m.mode === 'ffa' ? (r.score || 0).toLocaleString() : '');
      const aimAt = [...m.aims.entries()].filter(([from, a]) => a.to === r.id && now - a.at < 900).map(([from]) => m.rivals.get(from)?.name || (from === m.you ? 'You' : '')).filter(Boolean);
      set('#obi-' + r.id, aimAt.length ? 'Hit by ' + aimAt.join(', ') : r.s?.c ? 'Best ×' + r.s.c : '');
    }
    set('#obs-me', me.dead ? 'Out' : m.incomingFrom && now - m.incomingAt < 1400 ? 'Incoming from ' + (m.rivals.get(m.incomingFrom)?.name || 'rival') : 'In play');
    set('#obsc-me', m.mode === 'ffa' ? m.score.toLocaleString() : '');
    set('#obi-me', me.incoming.length ? me.incoming.length + ' queued · land a pair' : '');
    set('#ol-h1', m.mode === 'duel' ? m.sent : m.score.toLocaleString()); set('#ol-h2', me.incoming.length); set('#ol-hb', me.stats.bestChain ? '×' + me.stats.bestChain : '–');
    $('#ol-h2')?.parentElement.classList.toggle('warn', me.incoming.length > 0);
    set('#ol-clock', mmss(m.started ? m.game.elapsed : 0));
    const ov = $('#ol-overlay');
    if (ov) {
      const wait = m.startAt - now, html = !m.started && wait > 0 && wait < 1650 ? `<div class="count-in">${Math.max(1, Math.ceil(wait / 550))}</div>` : net.status !== 'online' && !m.over ? '<div class="pause-card ol-lost"><p class="eyebrow">CONNECTION</p><h2>Reconnecting…</h2></div>' : me.dead && !m.result ? '<div class="pause-card"><p class="eyebrow">OUT</p><h2>Watching the table.</h2></div>' : '';
      if (ov.dataset.html !== html) { ov.dataset.html = html; ov.innerHTML = html; ov.classList.toggle('shown', !!html); }
    }
    paintLog(m.log, $('#ol-combos'), m.you);
    rankList([{id: m.you, name: (name || 'You') + ' (you)', score: m.score, out: me.dead, best: me.stats.bestChain, sent: m.sent}, ...[...m.rivals.values()].map(r => ({id: r.id, name: r.name, score: r.score || 0, out: r.out, best: r.s?.c || 0, sent: r.sent}))], m.you, m.mode === 'duel');
    if (m.mode === 'ffa' && !m.over && m.stageAt !== Math.floor(m.game.elapsed / 1000)) { m.stageAt = Math.floor(m.game.elapsed / 1000); const st = progressionAt(m.game.elapsed, DEFAULT_PROGRESSION).stage; set('#ol-caption', `${st.name || 'Stage'} · waves for everyone, rising · Tab to switch target`); }
    // the result card waits until the boards have settled
    if (m.result && !m.shownAt) {
      const w = m.result.winner, rv = m.rivals.get(w), mine = !m.playout || m.playout.done, theirs = !rv || !rv.s || rv.s.ph === 'fall' || rv.s.ph === 'entry';
      if ((mine && theirs && now - m.result.at > 250) || now - m.result.at > 5500) {
        m.shownAt = now; const won = w === m.you;
        endWith(finisherFor(m.log, w, won ? m.lastSent && {...m.lastSent, from: m.you} : m.lastHit), w).then(() => { if (match !== m) return; sound(won ? 'win' : 'end'); updateResults(); });
      }
    }
  }
  function rankList(rows, you, duel) {
    const wins = room?.players ? Object.fromEntries(room.players.map(p => [p.id, p.wins])) : {};
    const html = rows.map(r => `<div class="challenge-rank ol-rank ${r.id === you ? 'is-you' : ''} ${r.out ? 'out' : ''}"><span>${wins[r.id] ? '★' + wins[r.id] : '·'}</span><strong>${esc(r.name)}</strong><small>${r.out ? 'OUT' : r.best ? 'best ×' + r.best : 'PLAYING'}</small><b>${duel ? (r.sent ? r.sent + ' ⚔' : '') : r.score.toLocaleString()}</b></div>`).join('');
    const el = $('#ol-standings'); if (el && el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    statusBadge();
  }
  // a finisher, when the winning move deserves one
  function endWith(f, winner) { return f && winner ? showFinisher(f, {who: nameOf(winner), reduced: prefs.reduced, prefs}) : Promise.resolve(); }
  function finishMatch(r) {
    const m = match; if (!m) return; m.over = true; m.result = {...r, at: performance.now()}; held.clear();
    const won = r.winner === m.you;
    if (m.mode === 'duel') { won ? record.duel.w++ : record.duel.l++; } else { record.ffa.played++; if (won) record.ffa.w++; }
    save('online-record', record);
    // the winner's board plays out its last combo before the result card (see render)
    if (won && !m.game.players[0].dead) m.playout = createPlayout(m.game, {sides: [0]});
  }
  // the finisher comes from the winner's last combo, or from the single blow that ended it
  function finisherFor(log, winner, blow) {
    const c = log.entries.find(e => e.who === winner);
    return finisherOf(c, {area: blow && blow.from === winner && performance.now() - blow.at < 8000 ? blow.area : null});
  }
  function placementsHTML(r, you, who) {
    return `<ol class="ol-placements">${r.placements.map(p => { const x = who(p.id); return `<li class="${p.id === you ? 'you' : ''}"><span>${PLACE[p.place]}</span><b>${esc(p.id === you ? (name || 'You') : p.name)}</b><small>${[(x?.s?.c || x?.best) ? 'best ×' + (x.s?.c || x.best) : '', typeof p.change === 'number' ? (p.change >= 0 ? '+' : '') + p.change : ''].filter(Boolean).join(' · ')}</small></li>`; }).join('')}</ol>`;
  }
  // this game, into the set: swords sent and best combo for everyone (rivals' from their combos and boards)
  function recordRound(m) {
    if (!series || series.rounds.some(r => r.round === m.round)) return;
    const me = m.game.players[0], row = {round: m.round, winner: m.result.winner, players: {[m.you]: {sent: m.sent, best: me.stats.bestChain}}};
    for (const r of m.rivals.values()) row.players[r.id] = {sent: r.sent || 0, best: r.s?.c || 0};
    series.rounds.push(row);
  }
  function setHTML(m) {
    if (!series?.rounds.length) return '';
    const n = series.rounds.length, ids = [m.you, ...m.rivals.keys()], who = id => id === m.you ? (name || 'You') : m.rivals.get(id)?.name || 'Rival';
    const rows = ids.map(id => { const games = series.rounds.filter(r => r.players[id]), wins = series.rounds.filter(r => r.winner === id).length, sent = games.reduce((a, r) => a + r.players[id].sent, 0), best = Math.max(0, ...games.map(r => r.players[id].best || 0));
      return `<tr class="${id === m.you ? 'you' : ''}"><td>${esc(who(id))}</td><td>${wins}</td><td>${games.length ? (sent / games.length).toFixed(1) : '\u2013'}</td><td>${best > 1 ? '\u00d7' + best : '\u2013'}</td></tr>`; }).join('');
    return `<table class="eg-set"><caption>${n === 1 ? 'This game' : `This set \u00b7 ${n} games`}</caption><tr><th></th><th>Wins</th><th>Swords / game</th><th>Best combo</th></tr>${rows}</table>`;
  }
  function updateResults() {
    const m = match, box = $('#ol-results'); if (!m || !m.result || !m.shownAt || !box) return;
    recordRound(m);
    const r = m.result, won = r.winner === m.you, mine = r.placements.find(p => p.id === m.you), others = [...m.rivals.values()], me = m.game.players[0];
    const players = room?.players || [], meRow = players.find(p => p.id === m.you), waiting = players.filter(p => !p.rematch && p.id !== m.you).map(p => p.name);
    const canRematch = players.length >= 2 && room?.state === 'results';
    const title = m.mode === 'duel' ? (won ? 'The duel is yours.' : (others[0]?.name || 'Your rival') + ' takes this one.') : won ? 'Last board standing.' : `${PLACE[mine?.place] || ''} place.`;
    const tally = players.length > 1 ? players.map(p => `${esc(p.name)} <b>${p.wins}</b>`).join(' · ') : '';
    const b = blade(), stats = [[m.mode === 'duel' ? 'Swords sent' : 'Score', m.mode === 'duel' ? m.sent : m.score.toLocaleString()], ['Best combo', me.stats.bestChain ? '×' + me.stats.bestChain : '–'], ['Pairs', me.stats.pieces], ['Time', mmss(m.game.elapsed)]];
    if (typeof mine?.change === 'number') stats.push(['Rating', (mine.change >= 0 ? '+' : '') + mine.change]);
    const kept = [...box.querySelectorAll('.eg-unlock')];
    box.innerHTML = `<div class="ol-veil"><section class="pause-card endgame ol-end ${won ? 'win' : 'loss'}"><div class="eg-banner"><span>${won ? 'VICTORY' : m.mode === 'duel' ? 'DEFEAT' : (PLACE[mine?.place] || '').toUpperCase() + ' PLACE'}</span></div>
      <div class="eg-blade">${swordIcon(b.iconId)}</div><h2>${title}</h2>
      <dl class="eg-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${setHTML(m)}<div class="eg-unlocks" hidden></div>
      ${m.mode === 'ffa' ? placementsHTML(r, m.you, id => id === m.you ? {best: me.stats.bestChain} : {best: m.rivals.get(id)?.s?.c}) : ''}
      ${notice ? `<p class="muted">${esc(notice)}</p>` : ''}
      <div class="eg-actions">${canRematch ? `<button class="primary" id="ol-rematch" ${meRow?.rematch ? 'disabled' : ''}>${meRow?.rematch ? (waiting.length ? 'Waiting for ' + esc(waiting.join(', ')) : 'Starting…') : 'Rematch'}</button>` : `<button class="primary" id="ol-again">Find another match</button>`}<button id="ol-lobby">Back to lobby</button></div></section></div>`;
    const shelf = box.querySelector('.eg-unlocks'); if (shelf && kept.length) { shelf.append(...kept); shelf.hidden = false; }
    $('#ol-rematch')?.addEventListener('click', () => net.send({t: 'rematch'}));
    $('#ol-again')?.addEventListener('click', () => { net.send({t: 'leave'}); match = null; room = null; notice = ''; net.send({t: 'quick', mode}); screen = 'queue'; paint(); });
    $('#ol-lobby')?.addEventListener('click', () => { net.send({t: 'leave'}); match = null; room = null; notice = ''; screen = 'home'; paint(); });
  }

  function frame(t) {
    if (disposed) return;
    const dt = Math.min(100, t - (last || t)); last = t;
    // keep ticking after the result while the winner's last combo plays out
    const live = match && screen === 'match' && (!match.over || (match.playout && !match.playout.done));
    if (live) { acc += dt; while (acc >= DT) { tick(); acc -= DT; } } else acc = 0;
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

  const listTick = setInterval(() => { if (screen === 'home') paintLists(); }, 5000);
  paint(); raf = requestAnimationFrame(frame);
  const api = {
    isActive: () => !!match && !match.over && !match.game.players[0].dead,
    inPlay: () => !!match && screen === 'match' && (!match.over || !match.shownAt),
    pause: () => {},
    leave: leaveMatch,
    getState: () => ({screen, mode, status: net.status, room, match: match ? {phase: match.game.players[0].phase, playout: match.playout ? {done: match.playout.done, phase: match.game.players[0].phase} : null, shown: !!match.shownAt, mode: match.mode, you: match.you, seed: match.seed, started: match.started, over: match.over, result: match.result, sent: match.sent, score: match.score, target: match.target, dead: match.game.players[0].dead, turn: match.game.players[0].turn, incoming: match.game.players[0].incoming.length, rivals: [...match.rivals.values()].map(r => ({id: r.id, name: r.name, out: r.out, hasState: !!r.s}))} : null}),
    destroy() { disposed = true; clearInterval(listTick); life.abort(); cancelAnimationFrame(raf); held.clear(); net.close(); if (globalThis.__scrapsOnline === api) delete globalThis.__scrapsOnline; },
    _net: net,
  };
  globalThis.__scrapsOnline = api;   // for QA scripts and debugging
  return api;
}
