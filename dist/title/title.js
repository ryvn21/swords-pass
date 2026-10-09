// Tavern title screen. Sits over the game as its own layer; the menu drives the game's
// existing navigation (the .nav-button[data-view] buttons and #settings-open), so no game
// code changes are needed. Clicking the wordmark from a non-match screen returns here.
// Automated browsers (navigator.webdriver) and ?skip-title skip it; ?title forces it.
import {createTavernAudio} from './audio.js';
import {renderGallery, drawDecor, decorFlags} from './progress.js';
import {readMix, writeMix} from './audio-settings.js';
import {openPatchNotes} from './patch-notes.js';
import {offensive} from '../name-filter.js';
import {setActivity, onPresence, presenceCounts, ACTIVITY_LABEL} from '../presence.js';

const META = {W: 960, H: 540, window: [372, 588, 103, 367], portrait: {x: 703, y: 158}, vista: [400, 359, 130],
  lanterns: [[65, 88], [896, 88]], fire: [753, 418],
  lights: [[123, 315, 26], [287, 315, 26], [135, 230, 14], [178, 230, 14], [221, 230, 14], [264, 230, 14], [665, 262, 30], [837, 263, 30], [11, 214, 34], [948, 215, 34], [33, 268, 30], [927, 268, 30]]};
// The tavern window is the hub. Each item either opens a sub-menu, a game screen, or the
// gallery. Game screens are reached through the game's own buttons, so its code stays the
// authority on how each mode starts.
const MENUS = {
  root: {items: [
    {label: 'Solo', hint: 'A duel against the AI, or Zen', to: 'solo', art: 'solo'},
    {label: 'Multiplayer', hint: 'Duels and free-for-alls', to: 'multi', art: 'multi', count: 'online'},
    {label: 'Adventure', hint: 'The endless climb: a new board every encounter', run: () => go('solo'), art: 'adventure'},
    {label: 'Forge', hint: 'Design and test your blades', run: () => go('workshop'), art: 'workshop'},
    {label: 'Gallery', hint: 'Your swords of honour and achievements', run: () => openGallery(), art: 'gallery'},
    {label: 'Replays', hint: 'Watch your last twenty rounds', run: () => go('replays'), art: 'replays'},
  ]},
  solo: {title: 'Solo', items: [
    {label: 'Play vs AI', hint: 'Pick your blade, theirs, and how hard they hit', run: () => go('play'), art: 'solo'},
    {label: 'Freebuild', hint: 'Paint any board, then watch it break', run: () => go('freebuild'), fx: 'freebuild'},
    {label: 'Zen', hint: 'No rival, no clock. Music on, just play', run: () => go('zen'), fx: 'zen'},
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

let lastFrom = 'root', root, cv, g, raf = 0, open = false, entered = false, enteredAt = 0, logo, naming = false, heard = false, nav, head, hint, gallery, emblem, menuKey = 'root';
// a painted emblem for the lit menu item (title/modes/*.png)
// the lit item: its description sits just under it, and the window shows that mode's own effect
let litFx = null, litAt = 0;
function showArt(item) { const f = item?.fx ?? item?.art ?? null; if (f !== litFx) { litFx = f; litAt = performance.now() / 1000; } placeHint(); }
function placeHint() {
  const b = nav?.querySelector('.is-active'), wrap = hint?.offsetParent; if (!b || !wrap) return;
  let y = b.offsetHeight - 2; for (let e = b; e && e !== wrap; e = e.offsetParent) y += e.offsetTop;   // the menu's swap animation makes it an offset parent too
  hint.style.top = y + 'px';
}
const img = {};
let reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || gamePrefs().reduced === true;

function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? (e.textContent = v) : e.setAttribute(k, v);
  for (const k of kids) e.append(k); return e;
}

// players in the tavern: a count beside Multiplayer, and who's doing what beside the patch notes
let who = null;
function showCounts(c = presenceCounts()) {
  for (const sm of nav?.querySelectorAll('[data-count]') || []) { const n = c?.by?.[sm.dataset.count]; sm.textContent = c ? `${n} online` : ''; }
  if (!who) return;
  if (!c) { who.textContent = ''; return; }
  const parts = Object.entries(c.by).filter(([k, n]) => n && k !== 'menu').sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${ACTIVITY_LABEL[k] || k}`);
  who.textContent = `${c.total} in the tavern${parts.length ? ' · ' + parts.join(' · ') : ''}`;
}
onPresence(c => showCounts(c));
function renderMenu(key, focusFirst = false) {
  menuKey = key; const m = MENUS[key];
  nav.replaceChildren(); head.textContent = m.title || ''; head.hidden = !m.title; hint.textContent = '';
  for (const item of m.items) {
    const b = el('button', {type: 'button', text: item.label, class: item.back ? 'tt-back' : ''});
    if (item.count) b.append(el('small', {class: 'tt-count', 'data-count': item.count}));
    b.addEventListener('pointerenter', () => setActive(b, true, item));
    b.addEventListener('focus', () => setActive(b, false, item));
    b.addEventListener('click', () => pick(item));
    nav.append(b);
  }
  nav.classList.remove('tt-swap'); void nav.offsetWidth; nav.classList.add('tt-swap');
  nav.querySelector('button')?.classList.add('is-active'); hint.textContent = m.items[0]?.hint || ''; showArt(m.items[0]);   // one item is always lit
  if (focusFirst) setTimeout(() => nav.querySelector('button')?.focus({preventScroll: true}), 20);
  showCounts();
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
  head = el('p', {class: 'tt-head'}); nav = el('nav', {class: 'tt-menu', 'aria-label': 'Main menu'}); nav.addEventListener('animationend', placeHint); hint = el('p', {class: 'tt-hint', 'aria-live': 'polite'});
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
  // a small, quiet way into the patch notes, bottom left
  const notesBtn = el('button', {type: 'button', class: 'tt-notes', text: 'Patch notes'});
  who = el('span', {class: 'tt-who', 'aria-live': 'polite'});
  notesBtn.onclick = e => { e.stopPropagation(); audio.select?.(); openPatchNotes(); };
  gallery = el('section', {class: 'tt-gallery', hidden: '', 'aria-label': 'Sword gallery'});
  // the title: the full wordmark over the tavern, then it settles above the window while the menu opens
  logo = el('img', {class: 'tt-logo', src: BASE + 'brand/logo-title.png', alt: "Sword's Pass", draggable: 'false'});
  const prompt = el('p', {class: 'tt-prompt', text: matchMedia('(pointer: coarse)').matches ? 'Tap to begin' : 'Press any key'});
  root = el('section', {class: 'tt', id: 'title-screen', 'aria-label': 'Title screen'}, [
    cv,
    el('div', {class: 'tt-ui'}, [
      logo, prompt, menuWrap, gallery,
      el('div', {class: 'tt-corner tt-bl'}, [notesBtn, who]),
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
    entered = true; enteredAt = performance.now(); root.classList.add('tt-entered'); audio.select(); requestAnimationFrame(placeHint);
    if (!read('online-name', '') && !read('named', false)) askName();
    if (e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    setTimeout(() => nav.querySelector('button')?.focus({preventScroll: true}), 380);
  };
  root.addEventListener('pointerdown', enter);
  addEventListener('keydown', enter, true);
  // arrows move through the menu; Escape / Backspace go back a level
  addEventListener('keydown', e => {
    if (!open || !entered || naming || document.querySelector('dialog[open]')) return;
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
// first visit: a name for the tavern (used online and on results). Optional; editable later in the online lobby.
function askName() {
  naming = true; root.classList.add('tt-naming');
  const card = el('form', {class: 'tt-namecard', 'aria-label': 'Choose a name'});
  card.innerHTML = '<p class="tt-namecard-eyebrow">WELCOME, TRAVELLER</p><h2>What should we call you?</h2><p class="tt-namecard-note">Your name shows in online duels and on results. You can change it later.</p><input name="nm" maxlength="16" autocomplete="nickname" spellcheck="false" placeholder="Swordhand" aria-label="Your name"><div class="tt-namecard-actions"><button type="submit" class="tt-namecard-go">Enter the tavern</button><button type="button" class="tt-namecard-skip">Later</button></div>';
  const input = card.querySelector('input'), done = name => {
    const nm = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
    if (nm) save('online-name', nm); save('named', true); audio.select();
    naming = false; root.classList.remove('tt-naming'); card.remove(); requestAnimationFrame(placeHint);
    setTimeout(() => nav.querySelector('button')?.focus({preventScroll: true}), 30);
  };
  card.addEventListener('submit', e => { e.preventDefault(); if (offensive(input.value)) { const note = card.querySelector('.tt-namecard-note'); note.textContent = 'That name isn\u2019t allowed. Pick another.'; input.select(); return; } done(input.value); });
  card.querySelector('.tt-namecard-skip').onclick = () => done('');
  card.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); done(''); } });
  root.querySelector('.tt-ui').append(card); setTimeout(() => input.focus(), 60);
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
  requestAnimationFrame(placeHint);
}
function closeGallery() { gallery.hidden = true; root.classList.remove('tt-gallery-open'); renderMenu('root', true); }

function show(key) {
  if (!root) buildDom();
  setActivity('menu');
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

// ---------- one small effect per mode, in the window behind the menu (vista pixels) ----------
const PATH = [[250, 338], [247, 330], [238, 320], [217, 310], [191, 300], [166, 290], [167, 280], [170, 272]];
const GEM_RGB = ['223,57,57', '242,207,40', '71,191,86', '54,157,222'];
const MOON = [197, 172];
function along(p) { const seg = PATH.length - 1, f = Math.min(seg - 1e-6, Math.max(0, p * seg)), i = Math.floor(f), k = f - i; return [PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * k, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * k]; }
const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
function dot(x, y, col, a, s = 1) { g.fillStyle = `rgba(${col},${a})`; g.fillRect(Math.round(x), Math.round(y), s, s); }
function modeFx(kind, t, ox, oy) {
  const fade = Math.min(1, (t - litAt) / .25); if (fade <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  if (kind === 'solo') {                       // Solo: a lone shooting star crosses the sky
    const per = 2.6, c = (t % per) / per, n = Math.floor(t / per), x0 = 40 + hash(n) * 220, y0 = 18 + hash(n + 9) * 40;
    if (c < .5) { const k = c / .5, hx = ox + x0 + k * 150, hy = oy + y0 + k * 60;
      glow(hx, hy, 9, '255,230,250', fade * .55 * (1 - k * .5));
      for (let i = 0; i < 16; i++) { const q = Math.max(0, k - i * .02); dot(ox + x0 + q * 150, oy + y0 + q * 60, '255,240,250', fade * (1 - i / 16) * (1 - k * .4), i < 3 ? 2 : 1); } }
  } else if (kind === 'multi') {               // Multiplayer: two sparks race in and clash above the peak
    const per = 2.2, c = (t % per) / per, mx = ox + MOON[0], my = oy + 88;
    if (c < .45) { const k = (c / .45) ** 2; for (const d of [-1, 1]) { const col = d < 0 ? '255,210,90' : '240,96,96', hx = mx + d * (170 - k * 170), hy = my + 34 - k * 34;
        glow(hx, hy, 8, col, fade * .5); for (let i = 0; i < 10; i++) { const q = Math.max(0, k - i * .025); dot(mx + d * (170 - q * 170), my + 34 - q * 34, col, fade * (1 - i / 10), i < 2 ? 2 : 1); } } }
    else if (c < .85) { const k = (c - .45) / .4; glow(mx, my, 10 + k * 34, '255,220,140', fade * .7 * (1 - k));
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + .2, r = 4 + k * 40; dot(mx + Math.cos(a) * r, my + Math.sin(a) * r + k * k * 16, i % 2 ? '255,226,150' : '255,140,120', fade * (1 - k), 2); } }
  } else if (kind === 'adventure') {           // Adventure: lanterns climb the winding road
    for (let i = 0; i < 4; i++) { const p = ((t * .08 + i / 4) % 1), [x, y] = along(p), a = fade * Math.min(1, p * 6, (1 - p) * 6);
      glow(ox + x, oy + y - 3, 14, '255,190,90', .6 * a); dot(ox + x - 1, oy + y - 4, '255,236,170', a, 2); }
  } else if (kind === 'workshop' || kind === 'forge') {   // Forge: sparks fly up as if from an anvil below the sill
    glow(ox + 200, oy + 330, 70, '255,128,48', fade * (.18 + .06 * Math.sin(t * 9)));
    for (let i = 0; i < 44; i++) { const life = 1.4 + hash(i + 50) * .8, s = (t + hash(i) * life) % life, k = s / life, n = Math.floor((t + hash(i) * life) / life) + i * 31;
      const x = 200 + (hash(n) - .5) * 80 + (hash(n + 3) - .5) * 300 * k, y = 330 - k * (190 + hash(n + 5) * 110) + k * k * 90;
      dot(ox + x, oy + y, k < .35 ? '255,240,190' : k < .7 ? '255,170,70' : '226,92,34', fade * (1 - k * .8), 2); }
  } else if (kind === 'gallery') {             // Gallery: jewels glint in the night, in the gems' own colours
    for (let i = 0; i < 10; i++) { const per = 1.8 + hash(i + 20), s = (t + hash(i) * per) % per, k = s / per, n = Math.floor((t + hash(i) * per) / per) * 17 + i;
      if (k > .55) continue; const a = fade * Math.sin(k / .55 * Math.PI), x = ox + 24 + hash(n) * 352, y = oy + 14 + hash(n + 1) * 130, c = GEM_RGB[i % 4];
      glow(x + 1, y + 1, 9, c, a * .5); dot(x, y, '255,255,255', a, 2);
      for (let r = 2; r <= (a > .6 ? 6 : 4); r += 2) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) dot(x + dx, y + dy, c, a * (1 - r / 8), 2); }
  } else if (kind === 'replays') {             // Replays: the stars wheel backwards round the moon
    for (let i = 0; i < 22; i++) { const r = 40 + hash(i) * 140, a0 = hash(i + 40) * 6.283 - t * .45;
      for (let j = 0; j < 16; j++) { const a = a0 + j * .028, y = oy + MOON[1] + Math.sin(a) * r * .55; if (y > oy + 200) continue; dot(ox + MOON[0] + Math.cos(a) * r, y, '235,225,255', fade * (.05 + .85 * (j / 16) ** 2), j === 15 ? 2 : 1); } }
  } else if (kind === 'zen') {                 // Zen: petals drift slowly down over the valley
    for (let i = 0; i < 18; i++) { const per = 8 + hash(i + 3) * 4, k = ((t + hash(i) * per) % per) / per, x = ox + hash(i + 7) * 380 + Math.sin(t * .9 + i) * 10 + k * 30, y = oy + 10 + k * 300, a = fade * .9 * Math.sin(k * Math.PI);
      dot(x, y, '255,196,224', a, 2); dot(x + 2, y + 1, '255,150,200', a * .6); }
  } else if (kind === 'freebuild') {           // Freebuild: little blocks drop and land in the valley
    for (let i = 0; i < 6; i++) { const per = 2.4, k = ((t + i * .4) % per) / per, n = Math.floor((t + i * .4) / per) * 6 + i, x = ox + 120 + Math.floor(hash(n) * 7) * 24, y = oy + 20 + Math.min(1, k * 1.5) ** 2 * 250;
      const c = GEM_RGB[Math.floor(hash(n + 2) * 4)], a = fade * (k < .8 ? 1 : (1 - k) / .2); g.fillStyle = `rgba(${c},${.85 * a})`; g.fillRect(Math.round(x), Math.round(y), 8, 12); g.fillStyle = `rgba(255,255,255,${.55 * a})`; g.fillRect(Math.round(x), Math.round(y), 8, 2); g.fillStyle = `rgba(0,0,0,${.35 * a})`; g.fillRect(Math.round(x), Math.round(y) + 10, 8, 2); }
  }
  g.restore();
}
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
  if (live && open && entered && litFx) modeFx(litFx, t, vistaX + vx, vistaY + vy);
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
