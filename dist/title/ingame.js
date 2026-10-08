// In-game menus in the style of the tavern title screen. Presentation only.
//  - globalThis.scrapsAsk({eyebrow,title,body,yes,no}) -> Promise<boolean>: a themed stand-in
//    for window.confirm. It is a <dialog>, so game key handlers already ignore input while it is open.
//  - Pause cards, result cards, the ask dialog and short confirm dialogs become keyboard menus:
//    arrows move one ruby-diamond highlight, Enter picks, and hover moves the same highlight.
//  - Menu sounds (sfx.js scrapsUiSound) on hover and select, and a short stepped fade when the
//    screen changes.
import './sfx.js';
import duelMusic from './duel-music.js';
import adventureMusic from './adventure-music.js';
import {swordIconURL} from './forge-art.js';

const ui = kind => globalThis.scrapsUiSound?.(kind);
const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// ---------- themed confirm ----------
let askEl = null;
function ask({eyebrow = 'ARE YOU SURE?', title = 'Are you sure?', body = '', yes = 'Yes', no = 'Not now'} = {}) {
  if (!askEl) { askEl = document.createElement('dialog'); askEl.id = 'im-ask'; askEl.className = 'im-ask'; document.body.append(askEl); }
  if (askEl.open) askEl.close('no');
  askEl.innerHTML = `<p class="im-head">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${body ? `<p class="im-hint">${esc(body)}</p>` : ''}
    <div class="im-menu"><button type="button" value="yes" class="im-yes">${esc(yes)}</button><button type="button" value="no" class="im-no" autofocus>${esc(no)}</button></div>`;
  return new Promise(resolve => {
    const done = v => { if (askEl.open) askEl.close(); ui(v ? 'select' : 'back'); resolve(v); };
    askEl.querySelector('.im-yes').onclick = () => done(true);
    askEl.querySelector('.im-no').onclick = () => done(false);
    askEl.oncancel = e => { e.preventDefault(); done(false); };
    askEl.showModal(); activate(askEl.querySelector('.im-no'), false);
  });
}
globalThis.scrapsAsk = ask;

// ---------- keyboard menus ----------
const ROOTS = '#im-ask[open] .im-menu, .game-overlay.shown .pause-card, .challenge-result-card, #modal[open] .button-row.im-menu';
function currentRoot() {
  const all = [...document.querySelectorAll(ROOTS)].filter(shown);
  return all.find(r => r.closest('#im-ask')) || all.find(r => r.closest('#modal')) || all[0] || null;
}
const itemsOf = root => [...root.querySelectorAll('button')].filter(b => !b.disabled && shown(b) && !b.classList.contains('modal-close'));
function activate(btn, sound = true) {
  if (!btn) return; const root = btn.closest('.pause-card, .challenge-result-card, .im-menu, .button-row') || btn.parentElement;
  for (const b of root.querySelectorAll('button.is-active')) if (b !== btn) b.classList.remove('is-active');
  if (!btn.classList.contains('is-active')) { btn.classList.add('is-active'); if (sound) ui('hover'); }
}
addEventListener('keydown', e => {
  const root = currentRoot(); if (!root) return;
  if (document.activeElement?.matches('input:not([type=checkbox]),select,textarea')) return;
  const keys = {ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1};
  if (keys[e.key] !== undefined) {
    const items = itemsOf(root); if (!items.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const i = items.findIndex(b => b.classList.contains('is-active'));
    activate(items[(i < 0 ? 0 : i + keys[e.key] + items.length) % items.length]);
  } else if (e.key === 'Enter' && !e.repeat) {
    const b = itemsOf(root).find(x => x.classList.contains('is-active')); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); b.click();
  }
}, true);
document.addEventListener('pointerover', e => {
  const b = e.target.closest?.('button'); if (!b || b.disabled || b.closest('#title-screen')) return;
  const root = b.closest(ROOTS);
  if (root) activate(b); else if (!b.closest('.pattern-editor,.palette,.editor-board,.touch-controls') && !b.matches('.editor-cell,.swatch') && e.relatedTarget?.closest?.('button') !== b) ui('hover');
});
document.addEventListener('click', e => {
  const b = e.target.closest?.('button'); if (!b || b.disabled || b.closest('#title-screen,#im-ask')) return;
  if (b.matches('.editor-cell,.swatch,.key-button') || b.closest('.pattern-editor,.palette,.touch-controls')) return;
  ui(b.matches('.modal-close,#keep-playing,[id$=-back],#back-lobby') ? 'back' : b.closest('.segmented,.settings-tabs,.pg-tabs') ? 'tab' : 'select');
}, true);

// mark short confirm dialogs in #modal (no form fields) so their buttons become a text menu
function markModal() {
  const m = document.getElementById('modal'); if (!m?.open) return;
  const plain = !m.querySelector('input,select,textarea,canvas,.key-bindings,.sword-picker,.sword-rack');
  for (const row of m.querySelectorAll('.button-row')) row.classList.toggle('im-menu', plain);
  m.classList.toggle('im-plain', plain);
}

// ---------- dropdowns become title-style cyclers: ‹ value › ----------
function enhanceSelects() {
  for (const sel of document.querySelectorAll('#app select:not([data-im]):not([multiple]), #modal select:not([data-im]):not([multiple])')) {
    sel.dataset.im = '1'; sel.classList.add('im-hidden-select');
    const box = document.createElement('div'); box.className = 'im-cycler';
    box.innerHTML = '<button type="button" class="im-cyc" data-d="-1" aria-label="Previous option">&#8249;</button><span class="im-cyc-val" aria-live="polite"></span><button type="button" class="im-cyc" data-d="1" aria-label="Next option">&#8250;</button>';
    sel.after(box);
    const sync = () => { box.querySelector('.im-cyc-val').textContent = sel.selectedOptions[0]?.textContent ?? ''; };
    for (const b of box.querySelectorAll('.im-cyc')) b.onclick = e => {
      e.preventDefault(); const opts = [...sel.options].filter(o => !o.disabled && o.value !== ''); if (!opts.length) return;
      const i = opts.indexOf(sel.selectedOptions[0]), d = Number(b.dataset.d), n = opts[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + opts.length) % opts.length];
      sel.value = n.value; sel.dispatchEvent(new Event('input', {bubbles: true})); sel.dispatchEvent(new Event('change', {bubbles: true})); sync();
    };
    sel.addEventListener('change', sync); sync();
  }
}

// ---------- Escape on any screen outside a match goes back to the menu you came from ----------
const inMatch = () => !!document.querySelector('#exit-game, .challenge-arena, .rogue-playfield, .game-overlay.shown');
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || globalThis.scrapsTitle?.open || document.querySelector('dialog[open]')) return;
  if (document.activeElement?.matches('input:not([type=checkbox]):not([type=range]),select,textarea') || inMatch()) return;
  e.preventDefault(); globalThis.scrapsUiSound?.('back'); globalThis.scrapsTitle?.back();
});

// when a menu appears, highlight its main action
let lastRoot = null;
// duel music while fighting (duels, Free-for-All, Adventure); ducked while paused, gone when the round ends
function syncMusic() {
  const duel = !!document.querySelector('.match-grid:not(.zen-grid)') && !!document.getElementById('exit-game') && !document.querySelector('#replay-speed');
  const ffa = !!document.querySelector('.challenge-arena'), adv = !!document.querySelector('.rogue-playfield');
  const over = !!document.querySelector('#rematch, .challenge-result-card, #paired-results .challenge-result-card');
  if ((duel || ffa || adv) && !over && !globalThis.scrapsTitle?.open) {
    duelMusic.start(adv ? .7 : 1);
    duelMusic.duck(!!document.querySelector('.game-overlay.shown .pause-card, dialog[open]'));
  } else if (duelMusic.playing) duelMusic.stop();
  // the Long Road's own tune on the Adventure screens between fights
  const road = !globalThis.scrapsTitle?.open && !adv && (!!document.querySelector('.adv-intro') || document.body.dataset.scene === 'adv') && !!document.querySelector('#rogue-stage, .adv-intro');
  void road; if (adventureMusic.playing) adventureMusic.stop();   // Adventure music parked until its direction is agreed
}
// every sword icon becomes the pixel-art version (the SVG stays as the fallback)
function pixelSwords() {
  for (const svg of document.querySelectorAll('svg.sword-icon[data-sword]:not([data-px])')) {
    svg.dataset.px = '1';
    try { const [p, q] = (svg.dataset.enamel || '0,0').split(',').map(Number); const url = swordIconURL(svg.dataset.sword, p, q);
      svg.innerHTML = `<image href="${url}" x="0" y="0" width="64" height="128" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/>`; } catch {}
  }
}
function settle() {
  markModal(); enhanceSelects(); syncMusic(); pixelSwords();
  const root = currentRoot();
  if (root && root !== lastRoot) {
    const items = itemsOf(root);
    activate(items.find(b => b.matches('[autofocus],#keep-playing')) || items.find(b => b.classList.contains('primary')) || items[0], false);
  }
  lastRoot = root;
}

// ---------- screen change: stepped fade, like the title menu ----------
let lastView = null;
function onView() {
  const v = document.querySelector('.nav-button.active')?.dataset.view; const app = document.getElementById('app');
  if (!app || v === lastView) return; lastView = v;
  app.classList.remove('im-enter'); void app.offsetWidth; app.classList.add('im-enter');
  setTimeout(() => app.classList.remove('im-enter'), 400);
}

let queued = false;
new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; settle(); onView(); }); })
  .observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'class', 'hidden']});

// shared gradients for the sword icons (sword-art.js refers to them by id, with flat fallbacks)
(function swordDefs() {
  if (document.getElementById('sk-defs')) return;
  const d = document.createElement('div'); d.id = 'sk-defs'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = `<svg width="0" height="0"><defs>
    <linearGradient id="sk-steel" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".46" stop-color="#d9dfe5"/><stop offset=".5" stop-color="#8d96a3"/><stop offset="1" stop-color="#5f6775"/></linearGradient>
    <linearGradient id="sk-steel-legacy" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#f6efff"/><stop offset=".46" stop-color="#cdbfe0"/><stop offset=".5" stop-color="#8e7fa6"/><stop offset="1" stop-color="#655a78"/></linearGradient>
    <linearGradient id="sk-gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="#ecc66c"/><stop offset="1" stop-color="#80531d"/></linearGradient>
    <linearGradient id="sk-sheen" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".3"/></linearGradient>
  </defs></svg>`;
  (document.body || document.documentElement).prepend(d);
})();

// ---------- intros and endings ----------
// Duel intro: both blades slide in, the names, a VS slam, then FIGHT. Non-blocking for the game
// code (the match's own countdown is lengthened to sit under it).
globalThis.scrapsIntro = ({eyebrow = 'DUEL', left, right}) => {
  document.querySelector('.cine-intro')?.remove();
  const box = document.createElement('div'); box.className = 'cine-intro'; box.setAttribute('aria-hidden', 'true');
  const side = (s, cls) => `<div class="cine-side ${cls}"><div class="cine-art">${s.art || ''}</div><strong>${esc(s.name)}</strong><small>${esc(s.sub || '')}</small></div>`;
  box.innerHTML = `<p class="cine-eyebrow">${esc(eyebrow)}</p>${side(left, 'l')}<div class="cine-vs">VS</div>${side(right, 'r')}<div class="cine-fight">FIGHT</div>`;
  document.body.append(box); ui('select');
  setTimeout(() => globalThis.scrapsSfx?.('hit', 1, {sound: true, volume: .16}), 650);
  setTimeout(() => box.classList.add('out'), 1500); setTimeout(() => box.remove(), 1900);
};
// Free-for-All: a banner as the boards appear, and a placement banner on the result card
let arenaSeen = false;
function cineChecks() {
  const arena = document.querySelector('.challenge-arena:not(.online-arena)');
  if (arena && !arenaSeen) {
    arenaSeen = true; const eb = document.querySelector('.game-heading .eyebrow')?.textContent || '';
    const box = document.createElement('div'); box.className = 'adv-banner cine-ffa';
    box.innerHTML = `<small>${esc(eb)}</small><strong>${/FREE/i.test(eb) ? 'Last board standing' : 'Beat the clock'}</strong><span>Every break scores</span>`;
    document.body.append(box); setTimeout(() => box.remove(), 2200);
  }
  if (!arena) arenaSeen = false;
  for (const card of document.querySelectorAll('.challenge-result-card:not([data-cine]):not(.ol-result)')) {
    card.dataset.cine = '1'; const h = card.querySelector('h2')?.textContent || '', m = h.match(/place (\d)/), place = m ? +m[1] : 0, best = /BEST/.test(card.querySelector('.eyebrow')?.textContent || '');
    const label = place ? ['', '1ST PLACE', '2ND PLACE', '3RD PLACE', '4TH PLACE'][place] : best ? 'NEW BEST' : 'RUN OVER';
    card.classList.add('endgame', place === 1 || best ? 'win' : place > 1 ? 'loss' : 'draw');
    card.insertAdjacentHTML('afterbegin', `<div class="eg-banner"><span>${label}</span></div>`);
  }
}
new MutationObserver(() => cineChecks()).observe(document.body, {childList: true, subtree: true});
