// Freebuild: a Solo sandbox. Paint any board with the game's own pieces, watch the break play out
// step by step, test incoming strikes, keep your setups, share them as codes, and play from them.
import {W,H,clone,grid,block,fuse,gravity,clearGroups,shatter,clearWave,swordFromGem,applyAttack,applyAttackBatch,horizontalBase,decay,DEFAULT_RULES} from './engine.js';
import {drawBoard} from './render.js';
import {CATEGORIES, patternCategory} from './pattern-library.js';
const thumb = rows => `<span class="pattern-thumb" style="--cols:${rows[0]?.length || 6}">${[...rows].reverse().map(r => r.map(c => `<i style="background-image:var(--tile-${c})"></i>`).join('')).join('')}</span>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const COLOUR_NAMES = ['Red', 'Gold', 'Green', 'Blue'];
const KINDS = [['block', 'Block'], ['breaker', 'Breaker'], ['stone', 'Stone'], ['cracked', 'Cracked'], ['erase', 'Eraser']];
const SAVE_KEY = 'freebuild-boards';

// ----- board codes: 13 rows of 6, top row first; . empty, 0-3 block, a-d breaker, w-z stone, p-s cracked
const CODE_PREFIX = 'SFB1:';
export function encodeBoard(b) {
  let s = '';
  for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) { const c = b[y][x]; s += !c ? '.' : c.stage >= 2 ? 'wxyz'[c.color] : c.stage === 1 ? 'pqrs'[c.color] : c.breaker ? 'abcd'[c.color] : String(c.color); }
  const lead = s.match(/^(\.{6})*/)[0].length / 6;                 // empty rows at the top fold into a count
  return CODE_PREFIX + (lead ? lead + '/' : '') + s.slice(lead * 6);
}
export function decodeBoard(code) {
  let s = String(code || '').trim(); if (!s.startsWith(CODE_PREFIX)) return null; s = s.slice(CODE_PREFIX.length);
  const lead = s.match(/^(\d+)\//); if (lead) s = '.'.repeat(6 * Math.min(H, Number(lead[1]))) + s.slice(lead[0].length);
  if (s.length !== W * H || /[^.0-3a-dw-zp-s]/.test(s)) return null;
  const b = grid();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], y = H - 1 - Math.floor(i / W), x = i % W; if (ch === '.') continue;
    if (/[0-3]/.test(ch)) b[y][x] = block(Number(ch)); else if (/[a-d]/.test(ch)) b[y][x] = block('abcd'.indexOf(ch), true);
    else if (/[w-z]/.test(ch)) b[y][x] = {...block('wxyz'.indexOf(ch)), stage: 2}; else b[y][x] = {...block('pqrs'.indexOf(ch)), stage: 1};
  }
  return b;
}

// ----- practice setups, each a small lesson
const SETUPS = [
  {id: 'five', name: 'A ×5 to start', hint: 'Press Break it: five steps, four swords, and the whole board clears. Or press Clear to start fresh.', code: 'SFB1:6/..0.....b22...122..133b3.03333b00133a221dc'},
  {id: 'first', name: 'A first sword', hint: 'A 2×2 red gem and a red breaker. Break it to send a 1×4 sword.', code: 'SFB1:a...../10' },
  {id: 'double', name: 'The double', hint: 'Break red. The gold breaker drops into its second connection: chain ×2.'},
  {id: 'sideways', name: 'A sideways thought', hint: 'A wide gem sends a horizontal sword.'},
  {id: 'stairs', name: 'Staircase', hint: 'Colours stepped up a staircase. One breaker sets the next one falling: a chain of two.'},
  {id: 'big', name: 'The big gem', hint: 'A 3×4 gem. Bigger gems send bigger swords.'},
  {id: 'garbage', name: 'Under siege', hint: 'Stones and cracked blocks from an attack. Cracked ones are one turn from free.'},
];
function setupBoard(id) {
  const fixed = SETUPS.find(x => x.id === id && x.code && id !== 'first'); if (fixed) return decodeBoard(fixed.code);
  const b = grid(), put = (x, y, c, br = false) => { b[y][x] = block(c, br); };
  if (id === 'first') { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) put(x, y, 0); put(0, 2, 0, true); }
  else if (id === 'double') { put(0, 0, 1); put(0, 1, 0); put(0, 2, 1, true); put(1, 1, 0, true); put(1, 0, 2); put(2, 0, 1); put(2, 1, 1); put(3, 0, 1); put(3, 1, 1); }
  else if (id === 'sideways') { for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) put(x, y, 0); put(0, 2, 0, true); }
  else if (id === 'stairs') { for (let x = 0; x < 6; x++) put(x, 0, 2); for (let x = 0; x < 4; x++) put(x, 1, 3); put(0, 2, 1); put(1, 2, 1); put(0, 3, 3, true); put(4, 1, 1); put(5, 1, 1); put(5, 2, 2, true); put(2, 2, 1, true); }
  else if (id === 'big') { for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) put(x, y, 3); put(3, 0, 3, true); }
  else if (id === 'garbage') { for (let x = 0; x < 6; x++) { b[0][x] = {...block((x + 1) % 4), stage: 2}; b[1][x] = {...block(x % 4), stage: 1}; } put(0, 2, 0); put(1, 2, 0); put(2, 2, 0, true); }
  return b;
}

export function createFreebuildUI({host, prefs, read, save, sound, getBlade, getPatterns = () => [], playBoard, toast}) {
  const $ = q => host.querySelector(q), scope = new AbortController();
  // a first visit (or one still on the old opening board) starts on a ready-made ×5 to break
  let board = read('freebuild-board', null); const opening = !board || board === encodeBoard(setupBoard('first')); board = (!opening && decodeBoard(board)) || setupBoard('five');
  // their board: what your break would land on a rival, in the colours of the blade you pick
  let target = grid(), showTarget = read('freebuild-target', true) !== false, bladeId = read('freebuild-blade', null), pickerOpen = false;
  const attacker = () => getPatterns().find(p => p.id === bladeId) || getBlade();
  let colour = 0, kind = 'block', undo = [], redo = [], anim = null, raf = 0, disposed = false, painting = false, lastCell = '', results = null, lesson = SETUPS[0].hint;
  const saved = () => { const l = read(SAVE_KEY, []); return Array.isArray(l) ? l.filter(x => x && typeof x.name === 'string' && decodeBoard(x.code)) : []; };
  const keep = () => save('freebuild-board', encodeBoard(board));
  const remember = () => { undo.push(encodeBoard(board)); if (undo.length > 60) undo.shift(); redo = []; };
  const view = () => { const b = clone(board); for (const row of b) for (const c of row) if (c) c.gem = 0; fuse(b); return b; };

  function render() {
    const mine = saved();
    host.innerHTML = `<section class="room-heading"><div><p class="eyebrow">SOLO · FREEBUILD</p><h1>Build it. Break it.</h1></div></section>
<div class="fb-grid">
 <aside class="panel fb-box"><p class="eyebrow">PIECE BOX</p>
  <div class="fb-palette">${['block', 'breaker'].map(k => COLOUR_NAMES.map((n, i) => { const on = kind === k && colour === i; return `<button class="fb-colour ${on ? 'on' : ''}" data-pick="${k}:${i}" style="background-image:var(--tile-${k === 'breaker' ? 'breaker-' : ''}${i})" aria-label="${n} ${k}" aria-pressed="${on}"></button>`; }).join('')).join('')}</div>
  <button class="fb-eraser ${kind === 'erase' ? 'on' : ''}" data-pick="erase" aria-pressed="${kind === 'erase'}">Eraser</button>
  <p class="fine-print">Click or drag on the board to paint. Right-click erases.</p>
  <div class="fb-tools"><button id="fb-undo" ${undo.length ? '' : 'disabled'}>Undo</button><button id="fb-redo" ${redo.length ? '' : 'disabled'}>Redo</button><button id="fb-clear" class="fb-clear">Clear</button></div>
  <div class="divider"></div><p class="eyebrow">SETUPS</p>
  <div class="fb-setups">${SETUPS.map(s => `<button data-setup="${s.id}">${esc(s.name)}</button>`).join('')}</div>
  <div class="divider"></div><p class="eyebrow">YOUR BOARDS <span>${mine.length}</span></p>
  <div class="fb-saved">${mine.length ? mine.map((s, i) => `<div><button data-load="${i}">${esc(s.name)}</button><button class="fb-x" data-del="${i}" aria-label="Delete ${esc(s.name)}">×</button></div>`).join('') : '<p class="fine-print">Nothing saved yet.</p>'}</div>
  <button id="fb-save">Save this board</button>
  <details class="rogue-more fb-share"><summary>Share</summary><div class="rogue-more-menu"><button id="fb-copy">Copy board code</button><button id="fb-paste">Load a board code</button></div></details>
 </aside>
 <section class="table-surface fb-table">
  <p class="fb-lesson" id="fb-lesson">${esc(lesson)}</p>
  <div class="fb-boards ${showTarget ? 'two' : ''}"><div class="fb-board-col"><small>YOU</small><div class="board-frame fb-frame"><canvas id="fb-board" role="img" aria-label="Freebuild board, six columns and thirteen rows"></canvas></div></div>${showTarget ? `<div class="fb-board-col"><small>THEM</small><div class="board-frame fb-frame fb-target"><canvas id="fb-target" role="img" aria-label="Their board: what your break sends"></canvas></div><div class="fb-them-tools"><button id="fb-target-turn" title="One turn passes: their swords crack one stage and the board settles">Next turn</button><button id="fb-target-clear2" class="fb-clear">Clear</button></div></div>` : ''}</div>
  <div class="fb-actions"><button id="fb-settle">Settle</button><button class="primary" id="fb-break">Break it</button><button id="fb-step">One step</button></div>
 </section>
 <aside class="panel fb-result"><p class="eyebrow">WHAT IT SENDS</p><div id="fb-out">${resultHTML()}</div>
  <button class="primary" id="fb-play">Play from here</button>
  <div class="divider"></div><p class="eyebrow">THEIR BOARD</p>
  <label class="fb-toggle"><input type="checkbox" id="fb-show-target" ${showTarget ? 'checked' : ''}> Show what lands on them</label>
  <div class="fb-blade"><small>YOUR BLADE (THE COLOURS THEY GET)</small><button id="fb-blade-btn" aria-expanded="${pickerOpen}">${thumb(attacker().rows)}<strong>${esc(attacker().name)}</strong><span>${pickerOpen ? '▴' : '▾'}</span></button>
   ${pickerOpen ? `<div class="fb-blade-list">${CATEGORIES.map(cat => { const list = getPatterns().filter(p => patternCategory(p) === cat.id); return list.length ? `<p class="pattern-cat">${esc(cat.name)}</p>${list.map(p => `<button data-blade="${esc(p.id)}" class="${p.id === attacker().id ? 'on' : ''}">${thumb(p.rows)}<span>${esc(p.name)}</span></button>`).join('')}` : ''; }).join('')}</div>` : ''}</div>
  <div class="fb-target-tools"><button id="fb-target-crack" title="Turn the landed swords into the coloured blocks they will play with">Crack them</button><button id="fb-target-clear" class="fb-clear">Clear their board</button></div>
 </aside>
</div>`;
    wire(); paint();
  }
  function resultHTML() {
    if (!results) return '<p class="muted">Break the board to see the swords and sprinkles it would send.</p>';
    if (!results.length) return '<p class="muted">Nothing broke. A breaker has to touch its own colour.</p>';
    const swords = results.flatMap(r => r.swords), spr = results.reduce((n, r) => n + r.sprinkles, 0);
    return `<p class="fb-total"><b>×${results.length}</b> chain · <b>${swords.length}</b> sword${swords.length === 1 ? '' : 's'} · <b>${spr}</b> sprinkle${spr === 1 ? '' : 's'}</p>` +
      results.map(r => `<div class="experiment-step"><strong>Chain ×${r.chain}</strong><p>${r.swords.map(s => `${s.width}×${s.length} ${s.kind} sword`).join('<br>') || 'No swords'}${r.sprinkles ? `<br>${r.sprinkles} sprinkles` : ''}</p></div>`).join('');
  }
  const out = () => { const el = $('#fb-out'); if (el) el.innerHTML = resultHTML(); };

  // ----- painting on the real board canvas
  function cellAt(e) {
    const c = $('#fb-board'), r = c.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * W), y = H - 1 - Math.floor((e.clientY - r.top) / r.height * H);
    return x >= 0 && x < W && y >= 0 && y < H ? [x, y] : null;
  }
  function put(x, y, erase) {
    const k = erase ? 'erase' : kind, was = board[y][x];
    board[y][x] = k === 'erase' ? null : k === 'breaker' ? block(colour, true) : k === 'stone' ? {...block(colour), stage: 2} : k === 'cracked' ? {...block(colour), stage: 1} : block(colour);
    if (JSON.stringify(was) !== JSON.stringify(board[y][x])) sound(k === 'erase' ? 'move' : 'lock');
  }
  function wire() {
    for (const b of host.querySelectorAll('[data-pick]')) b.onclick = () => { const [k, c] = b.dataset.pick.split(':'); kind = k; if (c != null) colour = Number(c); render(); };
    for (const b of host.querySelectorAll('[data-setup]')) b.onclick = () => { const s = SETUPS.find(x => x.id === b.dataset.setup); remember(); board = setupBoard(s.id); lesson = s.hint; results = null; keep(); render(); };
    for (const b of host.querySelectorAll('[data-load]')) b.onclick = () => { const s = saved()[Number(b.dataset.load)]; remember(); board = decodeBoard(s.code); lesson = s.name; results = null; keep(); render(); };
    for (const b of host.querySelectorAll('[data-del]')) b.onclick = () => { const l = saved(); l.splice(Number(b.dataset.del), 1); save(SAVE_KEY, l); render(); };
    $('#fb-undo').onclick = () => { if (!undo.length) return; redo.push(encodeBoard(board)); board = decodeBoard(undo.pop()); results = null; keep(); render(); };
    $('#fb-redo').onclick = () => { if (!redo.length) return; undo.push(encodeBoard(board)); board = decodeBoard(redo.pop()); results = null; keep(); render(); };
    $('#fb-clear').onclick = () => { remember(); board = grid(); results = null; lesson = 'An empty board. Paint something.'; keep(); render(); };
    $('#fb-save').onclick = () => {
      const A = globalThis.scrapsAsk, store = name => { const l = saved(); l.unshift({name: name.slice(0, 40) || 'Untitled board', code: encodeBoard(board)}); save(SAVE_KEY, l.slice(0, 40)); toast?.('Board saved.'); render(); };
      const name = prompt('Name this board', 'My board'); if (name !== null) store(name.trim());
    };
    $('#fb-copy').onclick = async () => { const code = encodeBoard(board); try { await navigator.clipboard.writeText(code); toast?.('Board code copied.'); } catch { prompt('Copy this board code', code); } };
    $('#fb-paste').onclick = () => { const code = prompt('Paste a board code (starts with SFB1:)'); if (code == null) return; const b = decodeBoard(code); if (!b) { toast?.('That is not a board code.'); return; } remember(); board = b; results = null; keep(); render(); };
    const on2 = (q, fn) => { const el = $(q); if (el) el.onclick = fn; };
    $('#fb-settle').onclick = () => run('settle');
    $('#fb-break').onclick = () => run('break');
    $('#fb-step').onclick = () => run('step');
    $('#fb-play').onclick = () => { const b = clone(board); gravity(b); fuse(b); if (b[H - 1][3]) { toast?.('Clear the top of column 4 before starting.'); return; } playBoard(b); };
    $('#fb-show-target').onchange = e => { showTarget = e.target.checked; save('freebuild-target', showTarget); render(); };
    $('#fb-blade-btn').onclick = () => { pickerOpen = !pickerOpen; render(); };
    for (const b of host.querySelectorAll('[data-blade]')) b.onclick = () => { bladeId = b.dataset.blade; save('freebuild-blade', bladeId); pickerOpen = false; render(); };
    $('#fb-target-clear').onclick = () => { target = grid(); render(); };
    on2('#fb-target-clear2', () => { target = grid(); render(); });
    on2('#fb-target-turn', () => { decay(target); sound('lock'); render(); });
    $('#fb-target-crack').onclick = () => { for (let i = 0; i < 3; i++) decay(target); render(); };
    const cv = $('#fb-board');
    cv.oncontextmenu = e => e.preventDefault();
    cv.onpointerdown = e => { if (anim) return; const c = cellAt(e); if (!c) return; painting = e.button === 2 ? 'erase' : 'paint'; remember(); cv.setPointerCapture(e.pointerId); lastCell = c.join(); put(c[0], c[1], painting === 'erase'); results = null; out(); };
    cv.onpointermove = e => { if (!painting) return; const c = cellAt(e); if (!c || c.join() === lastCell) return; lastCell = c.join(); put(c[0], c[1], painting === 'erase'); };
    cv.onpointerup = cv.onpointercancel = () => { if (painting) { painting = false; keep(); } };
  }

  // ----- the break, animated with the game's own clear effects
  const rules = () => ({...DEFAULT_RULES, ...(prefs.rules || {})});
  // One step carries on the same combo each press (×1, ×2, …) and lands that link on their board
  let stepOpen = false;
  function run(mode) {
    if (anim) return; remember();
    const carry = mode === 'step' && stepOpen && Array.isArray(results);
    results = mode === 'settle' ? results : carry ? results : [];
    if (mode !== 'step') stepOpen = false;
    if (!carry) for (const row of board) for (const c of row) if (c) c.gem = 0;
    const from = carry ? results.length : 0;
    anim = {mode, chain: from, from, phase: 'fall', t: performance.now(), wave: null, groups: null};
    if (mode !== 'settle') lesson = 'Breaking…';
    const l = $('#fb-lesson'); if (l) l.textContent = lesson;
  }
  function advance(now) {
    const a = anim, r = rules();
    if (a.phase === 'fall') {
      if (now - a.t < Math.max(40, r.settleMs)) return;
      a.t = now; if (gravity(board, 1)) { a.moved = true; return; }   // one row per beat, so you can watch it settle
      fuse(board);
      if (a.mode === 'settle') { anim = null; lesson = a.moved ? 'Settled: floating blocks dropped into place.' : 'Nothing to settle: every block is already resting.'; keep(); render(); return; }
      const groups = clearGroups(board);
      if (!groups.length || (a.mode === 'step' && a.chain > a.from)) { finish(); return; }
      a.chain++; a.groups = groups; a.wave = clearWave(groups, r.waveMs); a.duration = Math.max(...a.wave.map(c => c.delay)) + r.clearMs; a.phase = 'clear'; a.t = now;
      sound('clear', a.chain);
    } else if (a.phase === 'clear') {
      if (now - a.t < a.duration) return;
      results.push(shatter(board, a.groups, a.chain)); a.phase = 'fall'; a.t = now; out();
    }
  }
  // the break's swords and sprinkles, landed on their board the way the game would land them
  function land(list = results) {
    // exactly as a match does it: swords numbered and handed alternately, one batch, the game's own batch rules, then the board settles
    const rows = attacker().rows, attacks = []; let n = 0;
    for (const r of list) for (const sw of r.swords) { const a = {...sw, stage: r.chain, index: n, hand: n % 2 === 0 ? 1 : -1, id: 100 + n, pattern: rows}; if (a.kind === 'horizontal') a.base = horizontalBase(target, a.width); attacks.push(a); n++; }
    const spr = list.reduce((k, r) => k + r.sprinkles, 0); if (spr) attacks.push({kind: 'sprinkle', count: spr, hand: 1, id: 99, pattern: rows});
    if (!attacks.length) return;
    applyAttackBatch(target, attacks); while (gravity(target, 1)); fuse(target);
    sound('hit');
  }
  function finish() {
    const a = anim, done = results.length; anim = null; keep();
    if (a?.mode === 'step') {
      const broke = done > a.from; stepOpen = broke;
      const r = results.at(-1), sw = broke ? r.swords.length : 0, sp = broke ? r.sprinkles : 0, parts = [sw && `${sw} sword${sw === 1 ? '' : 's'}`, sp && `${sp} sprinkle${sp === 1 ? '' : 's'}`].filter(Boolean);
      lesson = broke ? `Step ×${done}: ${parts.join(' and ') || 'nothing sent'}${showTarget && parts.length ? ', landed on them' : ''}. Press One step for the next link.` : done ? `The combo ends at ×${done}.` : 'Nothing broke. A breaker has to touch its own colour.';
      if (broke && showTarget) land([r]);
      render(); return;
    }
    const sw = results.flatMap(r => r.swords).length, sp = results.reduce((n, r) => n + r.sprinkles, 0), parts = [sw && `${sw} sword${sw === 1 ? '' : 's'}`, sp && `${sp} sprinkle${sp === 1 ? '' : 's'}`].filter(Boolean);
    lesson = done ? `Chain ×${done}: ${parts.join(' and ') || 'nothing'} on the way to your rival.` : 'Nothing broke. A breaker has to touch its own colour.';
    if (done && showTarget) land();
    if (done > 1) sound('win'); render();
  }
  function paint(time = performance.now()) {
    const cv = $('#fb-board'); if (!cv) return;
    const a = anim, b = a ? board : view();
    const p = {board: b, active: null, phase: a?.phase === 'clear' ? 'clear' : 'entry', wave: a?.wave || [], clearDuration: a?.duration || 1, timer: a ? Math.max(0, a.duration - (performance.now() - a.t)) : 0, clearCellMs: rules().clearMs, motion: [], stats: {pieces: 0}};
    drawBoard(cv, p, {time, reduced: prefs.reduced});
    const tv = $('#fb-target'); if (tv) drawBoard(tv, {board: target, active: null, phase: 'entry', timer: 0, motion: [], stats: {pieces: 0}}, {time, reduced: prefs.reduced});
  }
  function frame(t) { if (disposed) return; if (anim) advance(t); paint(t); raf = requestAnimationFrame(frame); }
  window.addEventListener('keydown', e => { if (document.querySelector('dialog[open]') || document.activeElement?.matches('input,select,textarea')) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? '#fb-redo' : '#fb-undo')?.click(); } }, {signal: scope.signal});
  render(); raf = requestAnimationFrame(frame);
  return {isActive: () => false, destroy() { disposed = true; scope.abort(); cancelAnimationFrame(raf); }, getState: () => ({code: encodeBoard(board), results})};
}
