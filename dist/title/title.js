// Tavern title screen. Sits over the game as its own layer; the menu drives the game's
// existing navigation (the .nav-button[data-view] buttons and #settings-open), so no game
// code changes are needed. Clicking the wordmark from a non-match screen returns here.
// Automated browsers (navigator.webdriver) and ?skip-title skip it; ?title forces it.
import {createTavernAudio} from './audio.js';
import {renderGallery, drawDecor, decorFlags} from './progress.js';
import {readMix, writeMix} from './audio-settings.js';

const META = {W: 960, H: 540, window: [372, 588, 103, 367], portrait: {x: 703, y: 158}, vista: [400, 359, 130],
  lanterns: [[65, 88], [896, 88]], fire: [753, 418],
  lights: [[123, 315, 26], [287, 315, 26], [135, 230, 14], [178, 230, 14], [221, 230, 14], [264, 230, 14], [665, 262, 30], [837, 263, 30], [11, 214, 34], [948, 215, 34], [33, 268, 30], [927, 268, 30]]};
// The tavern window is the hub. Each item either opens a sub-menu, a game screen, or the
// gallery. Game screens are reached through the game's own buttons, so its code stays the
// authority on how each mode starts.
const MENUS = {
  root: {items: [
    {label: 'Solo', hint: 'A duel against the AI, or Zen', to: 'solo', art: 'solo'},
    {label: 'Multiplayer', hint: 'Duels and free-for-alls', to: 'multi', art: 'multi'},
    {label: 'Adventure', hint: 'The endless climb: a new board every encounter', run: () => go('solo'), art: 'adventure'},
    {label: 'Forge', hint: 'Design and test your blades', run: () => go('workshop'), art: 'workshop'},
    {label: 'Gallery', hint: 'Your swords of honour and achievements', run: () => openGallery(), art: 'gallery'},
    {label: 'Replays', hint: 'Watch your last twenty rounds', run: () => go('replays'), art: 'replays'},
  ]},
  solo: {title: 'Solo', items: [
    {label: 'Play vs AI', hint: 'Pick your blade, theirs, and how hard they hit', run: () => go('play'), art: 'solo'},
    {label: 'Freebuild', hint: 'Paint any board, then watch it break', run: () => go('freebuild')},
    {label: 'Zen', hint: 'No rival, no clock. Music on, just play', run: () => go('zen')},
    {label: 'Back', back: true},
  ]},
  multi: {title: 'Multiplayer', items: [
    {label: 'Online Duel', hint: 'One on one against another player', run: () => online('duel'), art: 'multi'},
    {label: 'Online Free-for-All', hint: 'Two to four players, last board standing', run: () => online('ffa'), art: 'multi'},
    {label: 'Back', back: true},
  ]},
};
const BASE = new URL('./', import.meta.url).href;
const read = (k, d) => { try { const v = localStorage.getItem('scraps.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('scraps.' + k, JSON.stringify(v)); } catch {} };

const params = new URLSearchParams(location.search);
const skip = (navigator.webdriver && !params.has('title')) || params.has('skip-title');

const gamePrefs = () => read('preferences', {});
let mix = readMix();
const volumeScale = () => mix.master;
const audio = createTavernAudio({volume: volumeScale(), mix});
addEventListener('scraps-audio', e => { mix = e.detail; audio.setMix(mix); audio.setVolume(mix.master); syncToggles?.(); });
let syncToggles = null;

let lastFrom = 'root', root, cv, g, raf = 0, open = false, entered = false, enteredAt = 0, logo, heard = false, nav, head, hint, gallery, emblem, menuKey = 'root';
// a painted emblem for the lit menu item (title/modes/*.png)
function showArt(item) { if (!emblem) return; const a = item?.art; emblem.classList.toggle('on', !!a); if (a && emblem.dataset.art !== a) { emblem.dataset.art = a; emblem.src = BASE + 'modes/' + a + '.png'; emblem.classList.remove('swap'); void emblem.offsetWidth; emblem.classList.add('swap'); } }
const img = {};
let reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || gamePrefs().reduced === true;

function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? (e.textContent = v) : e.setAttribute(k, v);
  for (const k of kids) e.append(k); return e;
}

function renderMenu(key, focusFirst = false) {
  menuKey = key; const m = MENUS[key];
  nav.replaceChildren(); head.textContent = m.title || ''; head.hidden = !m.title; hint.textContent = '';
  for (const item of m.items) {
    const b = el('button', {type: 'button', text: item.label, class: item.back ? 'tt-back' : ''});
    b.addEventListener('pointerenter', () => setActive(b, true, item));
    b.addEventListener('focus', () => setActive(b, false, item));
    b.addEventListener('click', () => pick(item));
    nav.append(b);
  }
  nav.classList.remove('tt-swap'); void nav.offsetWidth; nav.classList.add('tt-swap');
  nav.querySelector('button')?.classList.add('is-active'); hint.textContent = m.items[0]?.hint || ''; showArt(m.items[0]);   // one item is always lit
  if (focusFirst) setTimeout(() => nav.querySelector('button')?.focus({preventScroll: true}), 20);
}
function pick(item) {
  if (performance.now() - enteredAt < 350) return;   // the press that opened the menu never also picks from it
  audio.select();
  if (item.back) return renderMenu('root', true);
  if (item.to) return renderMenu(item.to, true);
  item.run?.();
}
function back() { if (gallery && !gallery.hidden) return closeGallery(); if (menuKey !== 'root') renderMenu('root', true); }

function buildDom() {
  cv = el('canvas', {width: 944, height: 531, class: 'tt-canvas', 'aria-hidden': 'true'});
  g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  head = el('p', {class: 'tt-head'}); nav = el('nav', {class: 'tt-menu', 'aria-label': 'Main menu'}); hint = el('p', {class: 'tt-hint', 'aria-live': 'polite'});
  const menuWrap = el('div', {class: 'tt-menuwrap'}, [head, nav, hint]);
  const musicBtn = el('button', {type: 'button', class: 'tt-toggle', id: 'tt-music'});
  const ambBtn = el('button', {type: 'button', class: 'tt-toggle', id: 'tt-ambience'});
  const setBtn = el('button', {type: 'button', class: 'tt-toggle', id: 'tt-settings', text: 'Settings'});
  syncToggles = () => {
    musicBtn.textContent = 'Music ' + (mix.musicOn ? 'on' : 'off'); musicBtn.setAttribute('aria-pressed', String(mix.musicOn));
    ambBtn.textContent = 'Ambience ' + (mix.ambienceOn ? 'on' : 'off'); ambBtn.setAttribute('aria-pressed', String(mix.ambienceOn));
  };
  musicBtn.onclick = e => { e.stopPropagation(); writeMix({...mix, musicOn: !mix.musicOn}); };
  ambBtn.onclick = e => { e.stopPropagation(); writeMix({...mix, ambienceOn: !mix.ambienceOn}); };
  setBtn.onclick = e => { e.stopPropagation(); document.getElementById('settings-open')?.click(); };
  syncToggles();
  const version = (document.querySelector('.footer span')?.textContent || '').replace(/\s+/g, ' ').trim();
  gallery = el('section', {class: 'tt-gallery', hidden: '', 'aria-label': 'Sword gallery'});
  // the title: the full wordmark over the tavern, then it settles above the window while the menu opens
  logo = el('img', {class: 'tt-logo', src: BASE + 'brand/logo-title.png', alt: "Sword's Pass", draggable: 'false'});
  const prompt = el('p', {class: 'tt-prompt', text: matchMedia('(pointer: coarse)').matches ? 'Tap to begin' : 'Press any key'});
  root = el('section', {class: 'tt', id: 'title-screen', 'aria-label': 'Title screen'}, [
    cv,
    el('div', {class: 'tt-ui'}, [
      logo, prompt, menuWrap, gallery,
      el('div', {class: 'tt-corner tt-left', text: version || 'v0.1'}),
      el('div', {class: 'tt-corner tt-right'}, [musicBtn, ambBtn, setBtn]),
    ]),
  ]);
  document.body.append(root);
  renderMenu('root');
  // first interaction: lets audio start (browsers require a gesture) and reveals the menu
  sizeLogo(); addEventListener('resize', sizeLogo);
  const enter = e => {
    if (!open) return;
    if (!heard) { heard = true; startAudio(); }
    if (entered || e.target?.closest?.('.tt-corner')) return;
    entered = true; enteredAt = performance.now(); root.classList.add('tt-entered'); audio.select();
    if (e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    setTimeout(() => nav.querySelector('button')?.focus({preventScroll: true}), 380);
  };
  root.addEventListener('pointerdown', enter);
  addEventListener('keydown', enter, true);
  // arrows move through the menu; Escape / Backspace go back a level
  addEventListener('keydown', e => {
    if (!open || !entered || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); back(); return; }
    const items = [...nav.querySelectorAll('button')]; if (!items.length || (gallery && !gallery.hidden)) return;
    if ((e.key === 'Enter' || e.key === ' ') && !nav.contains(document.activeElement)) { e.preventDefault(); e.stopPropagation(); nav.querySelector('.is-active')?.click(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      let i = items.indexOf(document.activeElement); if (i < 0) i = items.findIndex(x => x.classList.contains('is-active'));
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  }, true);
  root.addEventListener('pointermove', e => { pointer = true; tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; });
  root.addEventListener('pointerleave', () => { pointer = false; });
}

// exactly one highlighted item: whichever was last hovered or focused
function setActive(b, fromPointer, item) {
  const items = nav.querySelectorAll('button');
  if (!b.classList.contains('is-active')) audio.hover();
  items.forEach(x => x.classList.toggle('is-active', x === b));
  hint.textContent = item?.hint || ''; showArt(item);
  if (fromPointer && document.activeElement && document.activeElement !== b && root.contains(document.activeElement)) document.activeElement.blur();
}

function startAudio() {
  if (volumeScale() <= 0) return;
  if (audio.started) audio.resume(); else audio.start();
  audio.setMix(mix);
}

// ---------- actions into the game ----------
const $g = s => document.querySelector(s);
function go(view, thenClick) {
  lastFrom = menuKey === 'root' ? 'root' : menuKey; close();
  $g(`.nav-button[data-view="${view}"]`)?.click();
  if (thenClick) setTimeout(() => $g(thenClick)?.click(), 0);
}
function online(mode) {
  globalThis.scrapsOnlineMode = mode; save('online-mode', mode); go('online');
}
function challenge(mode, players) {
  go('challenges');
  setTimeout(() => {
    $g(`[data-challenge-mode="${mode}"]`)?.click();
    const sel = $g('#challenge-players');
    if (sel && Number(sel.value) !== players) { sel.value = String(players); sel.dispatchEvent(new Event('change', {bubbles: true})); }
  }, 0);
}

// ---------- gallery: swords of honour (lifetime counters) and achievements ----------
function openGallery() {
  renderGallery(gallery, () => { audio.select(); closeGallery(); });
  root.classList.add('tt-gallery-open'); gallery.hidden = false; gallery.querySelector('.tt-gal-close')?.focus({preventScroll: true});
}
// whole-pixel scales for the wordmark: big on the title card, half that once the menu is open
// (the full wordmark where it fits at 1x or more, otherwise the compact one, never a fractional scale)
function sizeLogo() {
  if (!root) return;
  const k = (w, h, fw, fh) => Math.floor(Math.min(innerWidth * fw / w, innerHeight * fh / h));
  const full = k(391, 42, .86, .2) >= 1, [w, h] = full ? [391, 42] : [178, 19];
  const big = Math.max(1, k(w, h, full ? .86 : .92, .2)), small = Math.max(1, Math.min(big - 1, k(w, h, .6, .1)));
  logo.src = BASE + 'brand/' + (full ? 'logo-title' : 'logo-bar') + '.png';
  root.style.setProperty('--logo-big', w * big + 'px'); root.style.setProperty('--logo-small', w * small + 'px');
}
function closeGallery() { gallery.hidden = true; root.classList.remove('tt-gallery-open'); renderMenu('root', true); }

function show(key) {
  if (!root) buildDom();
  open = true; root.hidden = false; root.classList.remove('tt-leaving');
  document.body.classList.add('tt-open');
  reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || gamePrefs().reduced === true;
  audio.setVolume(volumeScale());
  if (gallery && !gallery.hidden) closeGallery();
  renderMenu(MENUS[key] ? key : 'root');
  if (heard) startAudio();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
}
function close() {
  if (!open) return; open = false;
  root.classList.add('tt-leaving'); document.body.classList.remove('tt-open');
  audio.fadeOut(1);
  setTimeout(() => { if (!open) { root.hidden = true; cancelAnimationFrame(raf); } }, 450);
}

// ---------- scene ----------
const CW = 944, CH = 531, OX = 8, OY = 4;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const W0 = META.window, vistaX = Math.round((W0[0] + W0[1]) / 2 - META.vista[0] / 2), vistaY = W0[3] + 18 - META.vista[1];
const stars = Array.from({length: 70}, () => ({x: rnd() * META.vista[0], y: rnd() * (META.vista[2] + 70), p: rnd() * 6.28, s: rnd() < .15 ? 2 : 1}));
const extraFlies = Array.from({length: 20}, () => ({x: rnd() * META.vista[0], y: META.vista[2] + 40 + rnd() * (META.vista[1] - META.vista[2] - 50), p: rnd() * 6.28, v: .2 + rnd() * .4}));
const flies = Array.from({length: 16}, () => ({x: rnd() * META.vista[0], y: META.vista[2] + 90 + rnd() * (META.vista[1] - META.vista[2] - 100), p: rnd() * 6.28, v: .2 + rnd() * .3}));
const motes = Array.from({length: 40}, () => ({x: rnd(), y: rnd(), v: .02 + rnd() * .05, p: rnd() * 6.28}));
const FC = ['255,228,150', '255,196,92', '255,164,64', '226,92,34', '150,44,22'];
let flames = [], embers = [], px = 0, py = 0, tx = 0, ty = 0, pointer = false;

function glow(x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
const flick = (t, k) => .5 + .25 * Math.sin(t * 7.1 + k) + .15 * Math.sin(t * 13.7 + k * 2.3) + .1 * Math.sin(t * 23.3 + k * .7);

function frame(ms) {
  if (!open) return;
  if (!img.room?.complete || !img.vista?.complete) { raf = requestAnimationFrame(frame); return; }
  const t = ms / 1000, live = !reduce;
  if (live) { if (!pointer) { tx = Math.sin(t * .13) * .6; ty = Math.sin(t * .09) * .4; } px += (tx - px) * .05; py += (ty - py) * .05; } else { px = py = 0; }
  const vx = Math.round(-px * 2) - OX, vy = Math.round(-py) - OY, rx = Math.round(-px * 6) - OX, ry = Math.round(-py * 3) - OY, fx = Math.round(-px * 12) - OX, fy = Math.round(-py * 5) - OY;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#120a14'; g.fillRect(0, 0, CW, CH);
  g.drawImage(img.vista, vistaX + vx, vistaY + vy);
  for (const s of stars) { const a = live ? .35 + .65 * Math.max(0, Math.sin(t * 1.3 + s.p)) : .8; g.fillStyle = `rgba(255,240,250,${a})`; g.fillRect(Math.round(vistaX + vx + s.x), Math.round(vistaY + vy + s.y), s.s, s.s); }
  if (live) {
    g.globalCompositeOperation = 'lighter';
    for (const f of (decorFlags().fireflies ? flies.concat(extraFlies) : flies)) { f.x += Math.sin(t * f.v + f.p) * .25; f.y += Math.cos(t * f.v * 1.3 + f.p) * .12; const a = Math.max(0, Math.sin(t * 1.7 + f.p)), X = Math.round(vistaX + vx + f.x), Y = Math.round(vistaY + vy + f.y); glow(X, Y, 5, '200,255,140', .35 * a); g.fillStyle = `rgba(230,255,170,${a})`; g.fillRect(X, Y, 1, 1); }
    g.globalCompositeOperation = 'source-over';
  }
  g.drawImage(img.room, rx, ry); g.drawImage(img.portrait, META.portrait.x + rx, META.portrait.y + ry);
  drawDecor(g, rx, ry, t, live); const D = decorFlags();
  g.globalCompositeOperation = 'lighter';
  const bx0 = W0[0] + rx, bx1 = W0[1] + rx, by = W0[3] + ry, lg = g.createLinearGradient(0, by, 0, CH);
  lg.addColorStop(0, 'rgba(150,130,230,.10)'); lg.addColorStop(1, 'rgba(150,130,230,0)');
  g.fillStyle = lg; g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); g.lineTo(bx1 + 70, CH); g.lineTo(bx0 - 70, CH); g.closePath(); g.fill();
  if (live) for (const m of motes) { m.y -= m.v * .004; if (m.y < 0) m.y = 1; const yy = by + (CH - by) * m.y, sp = 70 * m.y, xx = bx0 - sp + (bx1 - bx0 + sp * 2) * m.x + Math.sin(t * .6 + m.p) * 3; g.fillStyle = `rgba(210,200,255,${.25 + .25 * Math.sin(t + m.p)})`; g.fillRect(Math.round(xx), Math.round(yy), 1, 1); }
  const fxr = META.fire[0] + rx, fyr = META.fire[1] + ry, fl = flick(t, 0);
  if (live) {
    for (let i = 0; i < (D.hearth ? 9 : 5); i++) flames.push({x: (rnd() - .5) * 34, y: 0, v: .5 + rnd() * .9, l: 0, L: 22 + rnd() * 26, w: 2 + Math.round(rnd() * 2)});
    if (rnd() < .18) embers.push({x: (rnd() - .5) * 30, y: -10, v: .35 + rnd() * .5, l: 0, L: 120 + rnd() * 120, p: rnd() * 6.28});
  }
  flames = flames.filter(f => (f.l += 1) < f.L); embers = embers.filter(e => (e.l += 1) < e.L);
  for (const f of flames) { f.y -= f.v; f.x *= .985; const k = f.l / f.L; g.fillStyle = `rgba(${FC[Math.min(4, Math.floor(k * 5))]},${(1 - k) * .9})`; g.fillRect(Math.round(fxr + f.x + Math.sin(t * 9 + f.y * .3) * 1.2), Math.round(fyr + f.y), f.w, f.w); }
  for (const e of embers) { e.y -= e.v; const k = e.l / e.L; g.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - k))},70,${1 - k})`; g.fillRect(Math.round(fxr + e.x + Math.sin(t * 2 + e.p) * 12 * k), Math.round(fyr + e.y), 1, 1); }
  glow(fxr, fyr - 18, D.hearth ? 240 : 190, '255,128,48', (D.hearth ? .22 : .16) + .10 * fl); glow(fxr, fyr - 10, 60, '255,190,90', .20 + .12 * fl);
  META.lights.forEach(([lx, ly, r], i) => glow(lx + rx, ly + ry, r, '255,176,90', .18 + .10 * flick(t, i * 1.7)));
  g.globalCompositeOperation = 'source-over'; g.drawImage(img.fg, fx, fy);
  g.globalCompositeOperation = 'lighter'; META.lanterns.forEach(([lx, ly], i) => glow(lx + fx, ly + fy, 46, '255,170,80', .22 + .08 * flick(t, 9 + i)));
  g.globalCompositeOperation = 'source-over';
  const vg = g.createRadialGradient(CW / 2, CH * .48, CH * .32, CW / 2, CH * .5, CW * .62); vg.addColorStop(0, 'rgba(8,4,10,0)'); vg.addColorStop(1, 'rgba(8,4,10,.62)'); g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
  raf = requestAnimationFrame(frame);
}

// ---------- boot ----------
function load() { for (const k of ['room', 'vista', 'portrait', 'fg']) { img[k] = new Image(); img[k].src = BASE + k + '.png'; } }
function inMatch() { return !!document.querySelector('#exit-game, .challenge-arena, .rogue-playfield, .game-overlay.shown'); }

// the wordmark returns to the tavern when no match is in progress (otherwise the game's own leave flow runs)
document.addEventListener('click', e => {
  const w = e.target.closest?.('.wordmark'); if (!w) return;
  e.preventDefault(); e.stopImmediatePropagation(); document.getElementById('tt-menu-open')?.click();
}, true);

// each screen gets its own pixel room behind it (see theme.css body[data-scene])
const SCENES = {play: 'spar', zen: 'zen', solo: 'solo', challenges: 'chal', workshop: 'work', replays: 'repl', online: 'spar', freebuild: 'work'};
function syncScene() { const v = document.querySelector('.nav-button.active')?.dataset.view; document.body.dataset.scene = v === 'solo' && document.querySelector('.adv-layout') ? 'adv' : SCENES[v] || 'spar'; }
new MutationObserver(syncScene).observe(document.querySelector('.topbar nav') || document.body, {subtree: true, attributes: true, attributeFilter: ['class']});
syncScene();

// the game's top bar gets a single Menu button back to the tavern hub
const topbar = document.querySelector('.topbar');
if (topbar && !document.getElementById('tt-menu-open')) {
  const mb = el('button', {type: 'button', id: 'tt-menu-open', class: 'tt-menu-open', text: 'Menu'});
  // in a match: run the game's own leave flow, then come back here once the match is gone
  mb.onclick = () => {
    if (!inMatch()) { show(lastFrom); return; }
    document.querySelector('#exit-game, #challenge-leave, #paired-leave, #rogue-save-exit, #online-leave')?.click();
    let n = 0; const wait = setInterval(() => {
      if (++n > 300 || open) return clearInterval(wait);
      if (document.querySelector('dialog[open]')) return;
      clearInterval(wait); if (!inMatch()) show(lastFrom);
    }, 150);
  };
  topbar.insertBefore(mb, document.getElementById('settings-open'));
}

load();
if (!skip) show();
window.scrapsTitle = {show, close, back: () => show(lastFrom), get open() { return open; }};
