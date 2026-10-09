// Patch notes: a small corner button on the title screen opens a short, illustrated list of what
// changed. Newest first. Each note has a picture built from the game's own pieces, not new art.
import {comboHTML} from '../combo-log.js';

const icon = id => new URL(`./icons/${id}.png`, import.meta.url).href;
const tile = (c, breaker = false) => `<i class="pn-tile" style="background-image:var(--tile-${breaker ? 'breaker-' : ''}${c})"></i>`;
const board = (h, label) => `<span class="pn-board" style="--h:${h}"><b>${label}</b></span>`;

const NOTES = [
  {date: '9 October 2026', title: 'Boards first', items: [
    {head: 'Bigger, centred boards', text: 'Online, Play vs AI and Adventure size the boards to your window and keep them level. Around a quarter taller on a laptop.',
      art: `<span class="pn-row">${board(46, 'before')}<em>→</em>${board(64, 'now')}${board(64, 'rival')}</span>`},
    {head: 'One entry per combo', text: 'The feed shows each combo once: its size and what it sent, with the steps underneath. Rivals’ combos too.',
      art: `<div class="pn-combo chain-log">${comboHTML({chain: 3, live: false, shown: true, steps: [{n: 1, g: 4, s: [], p: 1}, {n: 2, g: 6, s: [[2, 4]], p: 0}, {n: 3, g: 5, s: [[1, 4]], p: 2}]}, {who: 'You', mine: true})}</div>`},
    {head: 'Endings play out, finishers', text: 'The last combo finishes before the result. A ×5 that sends swords, or one blow over three-quarters of a board, gets a banner.',
      art: `<div class="pn-fin"><small>FINISHER</small><strong>Donkey ×5</strong></div>`},
    {head: 'End cards by mode', text: 'Online sets show wins, swords per game and best combo for everyone. Achievements wait for the end card.',
      art: `<table class="pn-set"><tr><th></th><th>Wins</th><th>Swords</th><th>Best</th></tr><tr class="you"><td>You</td><td>2</td><td>3.5</td><td>×4</td></tr><tr><td>Rival</td><td>1</td><td>2.0</td><td>×3</td></tr></table>`},
    {head: 'Adventure objectives coach you', text: 'A card with a progress bar and a one-line how-to; words pop over your board as you get closer.',
      art: `<div class="pn-goal"><strong>Forge a 2×6 sword</strong><span class="pn-bar"><i style="width:66%"></i></span><small>2×4 sword! · need 2×6</small></div>`},
    {head: 'Real choices for relics', text: 'Every reward offers one attack, one defence and one fortune relic. Broad Edge waits until depth 20.',
      art: `<span class="pn-row">${['extra-sprinkles', 'ward-charm', 'miners-tithe'].map(id => `<img src="${icon(id)}" alt="">`).join('')}</span>`},
    {head: 'Second Wind rescues, not tidies', text: 'It only fires when column 4 is one row from the top, and it says so.',
      art: `<span class="pn-row"><img src="${icon('second-wind')}" alt=""></span>`},
    {head: 'Forge: strength and a test board', text: 'A strength score (the Forgotten Falchion is 100), an online-legal badge, and a board to drop test strikes on. Online caps strength at 105.',
      art: `<div class="pn-meter"><i style="width:62%"></i><b style="left:84%"></b></div><small class="pn-cap">72 · Online legal</small>`},
    {head: 'Freebuild', text: 'Opens on a ×5 that clears the board. Their board shows what your break lands on a rival, in your blade’s colours.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}${[0, 1, 2, 3].map(c => tile(c, true)).join('')}</span>`},
    {head: 'Slower natural fall', text: 'Pieces fall at 2400 ms a row by default, so the top of the board is less of a trap.',
      art: `<span class="pn-big">1600 → <b>2400</b> ms</span>`},
  ]},
  {date: '8 October 2026', title: 'Online', items: [
    {head: 'Play online', text: 'Quick match, open tables, private rooms, watching live games, recent results and a leaderboard.',
      art: `<span class="pn-row"><img src="${icon('duel')}" alt=""></span>`},
    {head: 'Your controls by default', text: 'House timings and key bindings for everyone, with up to four keys per action.',
      art: `<span class="pn-row"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>Space</kbd></span>`},
  ]},
];

export function openPatchNotes({onClose} = {}) {
  const box = document.createElement('div'); box.className = 'pn'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Patch notes');
  box.innerHTML = `<div class="pn-inner"><header><p class="eyebrow">PATCH NOTES</p><button type="button" class="pn-close">Back</button></header>${NOTES.map(n => `<section><h2>${n.title}<small>${n.date}</small></h2><ol>${n.items.map(i => `<li><div class="pn-art">${i.art}</div><div><strong>${i.head}</strong><p>${i.text}</p></div></li>`).join('')}</ol></section>`).join('')}</div>`;
  document.body.append(box);
  const close = () => { box.remove(); removeEventListener('keydown', key, true); onClose?.(); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  box.querySelector('.pn-close').onclick = close; box.onclick = e => { if (e.target === box) close(); }; addEventListener('keydown', key, true);
  box.querySelector('.pn-close').focus({preventScroll: true});
}
globalThis.scrapsPatchNotes = openPatchNotes;
