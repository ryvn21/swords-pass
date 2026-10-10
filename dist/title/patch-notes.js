// Patch notes: a small corner button on the title screen opens a short, illustrated list of what
// changed. Newest first. Each note has a picture built from the game's own pieces, not new art.
import {comboHTML} from '../combo-log.js';

const icon = id => new URL(`./icons/${id}.png`, import.meta.url).href;
const tile = (c, breaker = false) => `<i class="pn-tile" style="background-image:var(--tile-${breaker ? 'breaker-' : ''}${c})"></i>`;
const board = (h, label) => `<span class="pn-board" style="--h:${h}"><b>${label}</b></span>`;

const NOTES = [
  {date: '10 October 2026', title: 'The Forge, shared', items: [
    {head: 'Community blades', text: 'Share a blade you forged and anyone can add it to their own rack or open it in the Forge to make it theirs. Browse the newest or the most copied, or search by name or maker.',
      art: `<span class="pn-row"><img src="${icon('duel')}" alt=""></span>`},
    {head: 'Forging made simple', text: 'Three steps: paint the pattern, name it and pick its look from the blade pictures, save. Small icons beside the grid show which rows colour your strikes and your sprinkles.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}</span>`},
    {head: 'Clearer stones', text: 'A stone that frees next turn is washed in its colour with a coloured rim, so you can see what it becomes.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}</span>`},
    {head: 'Milestones say what you did', text: 'Cards lead with the deed (500 strikes survived), then the stage and the next target.',
      art: `<span class="pn-big">500</span>`},
    {head: 'Show it off', text: 'The test board drops 1×4 to 2×8 strikes, twin full-height swords, side swords and rows of sprinkles, or plays a short exchange to show what your blade sends.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c, true)).join('')}</span>`},
    {head: 'Controls 2.0 are finished', text: 'New flips and popups, a landing window that shrinks as the duel speeds up, held keys that move the instant a pair appears, and duels that start at a quicker pace. Incoming strikes peek in, crash down one by one, crush what they hit and sound like it.',
      art: `<span class="pn-big">↻</span>`},
  ]},
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
    {head: 'Forge: a test board', text: 'Drop test strikes in your pattern’s colours on a board beside the editor, crack them, and see what a rival would get to build with.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}</span>`},
    {head: 'Freebuild', text: 'Opens on a ×5 that clears the board. Their board shows what your break lands on a rival, in your blade’s colours.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}${[0, 1, 2, 3].map(c => tile(c, true)).join('')}</span>`},
    {head: 'New default timings', text: 'Duels start at 1.3 s a row and speed up as you land blocks: after 10, 23, 39, 58, 80 … When a pair lands you get one short window to slide or flip it (167 ms at the start, shrinking as you speed up, never under 40 ms); moving never extends it, and a pair slid off a ledge falls when it ends. Flips: the pair turns around its first block, trying a quarter turn, then a half, then three-quarters, each in place, then a column right, then left. Turning to point down can pop it up a row, twice a pair. Late in a row, moves and flips also need the row below clear. The NEXT box updates the moment a new pair appears. Space needs a fresh press for every pair. Untick Default timings in Settings to use your own.',
      art: `<span class="pn-big">1.3 s → <b>0.16 s</b></span>`},
    {head: 'Livelier breaks', text: 'Broken pieces pop, split into four chunks that fly up and fall away, and throw off sparks.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c)).join('')}</span>`},
    {head: 'See and hear attacks coming', text: 'Each incoming strike peeks in at the edge it will come from, blinking, with a drum warning sized to the attack. Strikes land one after another at a steady speed, crushing the pieces in their way, then the sprinkles drop. New pixel great swords. Side swords scrape in and crushed pieces crunch.',
      art: `<span class="pn-row"><img src="${icon('duel')}" alt=""></span>`},
    {head: 'Bolder breakers, gentler glow', text: 'Breakers are bigger with a dark outline, so they read at a glance; the glow breathes slowly and faintly instead of pulsing.',
      art: `<span class="pn-row">${[0, 1, 2, 3].map(c => tile(c, true)).join('')}</span>`},
    {head: 'Night mode', text: 'Night on (title screen, Settings, or the moon in Zen) turns the scenery to night and softens the glow. Boards stay crisp.',
      art: `<span class="pn-big">&#9790;</span>`},
    {head: 'Matchmaking by tables', text: 'Quick match sits you at an open table or puts one up; a table starts the moment someone sits down. While you wait, you see the other tables.',
      art: `<span class="pn-row"><img src="${icon('duel')}" alt=""></span>`},
        {head: 'Online lobby',
      text: 'Pick your blade with icons and strength; hover any blade to see its pattern. Your last games, your record against each player, previous names. If your rival leaves, you’re told and the table closes.',
      art: `<span class="pn-row"><img src="${icon('duel')}" alt=""></span>`},
    {head: 'Blade hotwheel',
      text: 'Pick several blades in the sword rack and the arrows cycle through them, in Play vs AI and online. Random draws one each duel, against the AI only.',
      art: `<span class="pn-big">‹ <b>?</b> ›</span>`},
    {head: 'Full columns are walls',
      text: 'A column filled to the top blocks pairs above the board too, until it clears. A drop pressed while an attack lands on you now counts for the next pair.',
      art: `<span class="pn-row">${[0, 1, 2].map(c => tile(c)).join('')}</span>`},
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
