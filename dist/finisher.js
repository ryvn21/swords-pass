// The end of a game: let the last combo and attacks finish on screen, then, when the game was won
// with something worth seeing (a ×5+ combo that sent real swords, or one blow covering more than
// three-quarters of a board), a finisher banner before the result card.
import {W, H, VERSION, clone, step} from './engine.js';
import {comboName, comboTotals} from './combo-log.js';

const BOARD = W * H;
// area of an attack batch: swords cover width × length cells, sprinkles one each
export const batchArea = attacks => (attacks || []).reduce((n, a) => n + (a.kind === 'sprinkle' ? a.count | 0 : (a.width | 0) * (a.length | 0)), 0);

// c: a combo-log entry. Returns {title, line, kind} or null.
export function finisherOf(c, {area = null} = {}) {
  if (!c) return null;
  const t = comboTotals(c), swords = t.swords.reduce((n, s) => n + s.n, 0), sent = area ?? t.swords.reduce((n, s) => n + s.w * s.l * s.n, 0) + t.sprinkles;
  if (sent > BOARD * .75) return {kind: 'blow', title: 'One blow', line: `${sent} of ${BOARD} cells in a single strike`};
  if (c.chain >= 5 && swords >= 2) return {kind: 'combo', title: `${comboName(c.chain)} ×${c.chain}`, line: `${swords} swords in one combo`};
  return null;
}

// Keeps a finished match's boards moving (no input) until the last combo has resolved. Returns
// a copy to draw from; step(dt) advances it, done is true once every live board is waiting for
// its next pair (or after maxMs).
export function createPlayout(match, {maxMs = 5000, sides = [0, 1]} = {}) {
  if (![9, 10, VERSION].includes(match.version)) return {state: match, done: true, step() {}};
  const state = clone(match); let spent = 0;
  const settled = p => p.dead || !p.active && (p.phase === 'entry') || p.phase === 'fall';
  const api = {state, done: sides.every(s => settled(state.players[s])),
    step(dt) {
      if (api.done) return; spent += dt;
      const winner = state.winner; state.winner = null;
      const live = sides.filter(s => !settled(state.players[s]));
      // only the boards still resolving move; the others hold still
      const held = [0, 1].filter(s => !live.includes(s)).map(s => [s, state.players[s].dead]);
      for (const [s] of held) state.players[s].dead = true;
      step(state, dt, []);
      for (const [s, d] of held) state.players[s].dead = d;
      state.winner = winner;
      api.done = spent >= maxMs || sides.every(s => settled(state.players[s]));
    }};
  return api;
}

// The banner itself: shown over the page, resolves when it has finished.
export function showFinisher(f, {who = '', reduced = false, prefs = {}} = {}) {
  return new Promise(done => {
    if (!f) return done();
    const el = document.createElement('div'); el.className = 'fin-banner ' + f.kind; el.setAttribute('role', 'status');
    el.innerHTML = `<small>FINISHER</small><strong>${f.title}</strong><span>${who ? who.replace(/[<>&]/g, '') + ' · ' : ''}${f.line}</span>`;
    document.body.append(el); globalThis.scrapsSfx?.('finisher', 6, prefs);
    setTimeout(() => { el.remove(); done(); }, reduced ? 1600 : 2300);
  });
}
