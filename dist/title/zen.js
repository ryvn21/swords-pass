// Zen: a calm solo sandbox. app.js runs it as practice boards in a loop and calls these hooks:
//   decorate(app)                 after each board renders: Zen panels and music controls
//   update(stats, elapsedMs, id)  every frame: live numbers
//   bank(stats, elapsedMs, id)    once per board, when it ends or you leave: adds to your totals
//   leave()                       when you leave Zen: music fades out
// Totals live in localStorage scraps.zen and grow forever; your Zen level rises with blocks broken.
import music, {zenVolume} from './zen-music.js';

const KEY = 'scraps.zen';
const blank = () => ({seconds: 0, pieces: 0, blocks: 0, swords: 0, bestChain: 0, boards: 0, sittings: 0});
const read = () => { try { return {...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch { return blank(); } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
const TITLES = ['Wanderer', 'Hearth-sitter', 'Apprentice', 'Journeyman', 'Steady Hand', 'Adept', 'Artisan', 'Lamplighter', 'Swordsmith', 'Master', 'Grandmaster', 'Sage of the Hearth', 'Legend'];
const need = n => 20 * n * (n + 1);          // blocks to reach level n+1: 40, 120, 240, 400 ...
function levelOf(blocks) { let n = 0; while (blocks >= need(n + 1)) n++; return {level: n + 1, title: TITLES[Math.min(TITLES.length - 1, n)], from: need(n), to: need(n + 1)}; }
const fmt = n => Math.round(n).toLocaleString('en-GB');
const clock = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`; };

let life = read(), sitting = blank(), banked = new Set(), last = null, lastPaint = 0, inZen = false, unsub = null;

function bank(stats, ms, id) {
  if (!stats || banked.has(id)) return; banked.add(id);
  const add = {seconds: ms / 1000, pieces: stats.pieces, blocks: stats.cleared, swords: stats.swords, boards: 1};
  const before = levelOf(life.blocks).level;
  for (const t of [life, sitting]) { for (const [k, v] of Object.entries(add)) t[k] += v || 0; t.bestChain = Math.max(t.bestChain, stats.bestChain || 0); }
  write(life);
  const after = levelOf(life.blocks); if (after.level > before) levelUp(after);
}
function levelUp(L) {
  const box = document.getElementById('zen-level-up'); if (!box) return;
  box.innerHTML = `<small>ZEN LEVEL ${L.level}</small><strong>${L.title}</strong>`; box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  globalThis.scrapsUiSound?.('select');
}

function panel() {
  return `<div class="zen-panel">
    <p class="eyebrow">ZEN</p>
    <div class="zen-level"><b id="zen-lv">1</b><div><strong id="zen-title">Wanderer</strong><div class="zen-bar"><i id="zen-fill"></i></div><small id="zen-next"></small></div></div>
    <div id="zen-level-up" class="zen-level-up" aria-live="polite"></div>
    <div class="divider"></div>
    <p class="eyebrow">THIS SITTING</p>
    <dl class="zen-stats"><div><dt>Time</dt><dd id="zs-time">0:00</dd></div><div><dt>Pairs placed</dt><dd id="zs-pieces">0</dd></div><div><dt>Blocks broken</dt><dd id="zs-blocks">0</dd></div><div><dt>Best combo</dt><dd id="zs-chain">–</dd></div><div><dt>Boards</dt><dd id="zs-boards">1</dd></div></dl>
    <div class="divider"></div>
    <p class="eyebrow">ALL TIME</p>
    <dl class="zen-stats"><div><dt>Time in Zen</dt><dd id="zl-time">0:00</dd></div><div><dt>Blocks broken</dt><dd id="zl-blocks">0</dd></div><div><dt>Best combo</dt><dd id="zl-chain">–</dd></div></dl>
  </div>`;
}
function player() {
  return `<div class="zen-music"><p class="eyebrow">NOW PLAYING</p>
    <div class="zen-track"><span class="zen-disc" aria-hidden="true"></span><div><strong id="zm-title">…</strong><small id="zm-artist"></small></div></div>
    <div class="zen-controls"><button type="button" id="zm-prev" aria-label="Previous track">&#9198;</button><button type="button" id="zm-play" aria-label="Play or pause">&#9208;</button><button type="button" id="zm-next" aria-label="Next track">&#9197;</button></div>
    <label class="zen-vol"><span>Music</span><input type="range" id="zm-vol" min="0" max="100"></label>
  </div>`;
}
function syncPlayer(st = music.state()) {
  const t = document.getElementById('zm-title'); if (!t) return;
  t.textContent = st.title; document.getElementById('zm-artist').textContent = st.artist;
  const p = document.getElementById('zm-play'); p.innerHTML = st.playing ? '&#9208;' : '&#9654;';
  document.querySelector('.zen-music')?.classList.toggle('playing', st.playing);
}

function decorate(app) {
  inZen = true;
  const head = app.querySelector('.game-heading'); if (head) { head.querySelector('.eyebrow').textContent = 'ZEN'; head.querySelector('h1').textContent = 'Breathe.'; }
  const left = app.querySelector('.match-loadout'), right = app.querySelector('.match-notes');
  if (left) { const keep = [...left.querySelectorAll('#edit-board, #game-settings')]; left.innerHTML = panel() + '<div hidden><b id="ppm"></b><b id="swords"></b><b id="sprinkles"></b><b id="best-chain"></b></div>'; left.append(...keep); }
  if (right) { const log = right.querySelector('#exchange-log'); right.innerHTML = '<p class="eyebrow">COMBOS</p>'; if (log) right.append(log); right.insertAdjacentHTML('beforeend', '<div class="divider"></div>' + player()); }
  app.querySelector('.match-grid')?.classList.add('zen-grid');
  const wrap = app.querySelector('#wrap-0 .board-header span'); if (wrap) wrap.textContent = 'Just play';
  const m = (() => { try { return JSON.parse(localStorage.getItem('scraps.audio') || '{}'); } catch { return {}; } })();
  const vol = document.getElementById('zm-vol'); if (vol) { vol.value = Math.round(zenVolume() * 100); vol.oninput = () => { try { localStorage.setItem('scraps.zen-music', JSON.stringify(vol.value / 100)); } catch {} music.setVolume(zenVolume() * (m.master ?? .8)); }; }
  document.getElementById('zm-play').onclick = () => { decorate.paused = music.state().playing; music.toggle(); };
  document.getElementById('zm-next').onclick = () => music.next(1);
  document.getElementById('zm-prev').onclick = () => music.next(-1);
  unsub?.(); unsub = music.on(syncPlayer); syncPlayer();
  if (!music.state().playing && !decorate.paused) music.start();
  paint(true);
}
function update(stats, ms, id) { last = {stats, ms, id}; paint(); }
function paint(force) {
  const now = performance.now(); if (!force && now - lastPaint < 250) return; lastPaint = now;
  const cur = last && !banked.has(last.id) ? last : null, s = cur?.stats ?? {}, sec = (cur?.ms ?? 0) / 1000;
  const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== String(v)) e.textContent = v; };
  const blocksNow = life.blocks + (s.cleared || 0), L = levelOf(blocksNow);
  set('zen-lv', L.level); set('zen-title', L.title); set('zen-next', `${fmt(blocksNow - L.from)} / ${fmt(L.to - L.from)} blocks to level ${L.level + 1}`);
  const fill = document.getElementById('zen-fill'); if (fill) fill.style.width = Math.min(100, (blocksNow - L.from) / (L.to - L.from) * 100) + '%';
  set('zs-time', clock(sitting.seconds + sec)); set('zs-pieces', fmt(sitting.pieces + (s.pieces || 0))); set('zs-blocks', fmt(sitting.blocks + (s.cleared || 0)));
  const sc = Math.max(sitting.bestChain, s.bestChain || 0); set('zs-chain', sc > 1 ? '×' + sc : '–'); set('zs-boards', fmt(sitting.boards + (cur ? 1 : 0)));
  set('zl-time', clock(life.seconds + sec)); set('zl-blocks', fmt(blocksNow)); const lc = Math.max(life.bestChain, s.bestChain || 0); set('zl-chain', lc > 1 ? '×' + lc : '–');
}
function leave() {
  if (!inZen) return; inZen = false;
  if (last && !banked.has(last.id)) bank(last.stats, last.ms, last.id);
  if (sitting.boards) { life.sittings++; write(life); }
  sitting = blank(); last = null; unsub?.(); unsub = null; music.stop();
}
addEventListener('pagehide', () => { if (inZen && last && !banked.has(last.id)) bank(last.stats, last.ms, last.id); });
globalThis.scrapsZen = {decorate, update, bank, leave, totals: () => ({...life}), level: () => levelOf(life.blocks)};
