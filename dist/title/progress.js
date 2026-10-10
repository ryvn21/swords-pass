// Progression: lifetime counters, each shown as its own sword that wakes up rank by rank,
// plus one-off achievements that unlock tavern decorations and board styles.
// Counting: app.js calls globalThis.scrapsTally(kind, chain) for the player's own events
// (game started, strike landed, struck, piece placed, win, loss) in every mode. Some
// achievements read the game's saves directly (duel records, challenge bests, the Adventure
// checkpoint, the pattern library). Everything is stored under scraps.tally / scraps.progress.

const read = (k, d) => { try { const v = localStorage.getItem('scraps.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('scraps.' + k, JSON.stringify(v)); } catch {} };
const fmt = n => Number(n).toLocaleString('en-GB');

// ---------- swords of honour: one blade per counter, five ranks each ----------
// Each counter has its own sword (from title/blades) and its own milestones, sized to how fast it grows.
// Rank 0 shows the blade as a shadow to aim for; each rank after that visibly wakes it up.
export const RANKS = ['Unproven', 'Drawn', 'Honed', 'Tempered', 'Renowned', 'Legendary'];
const THEMES = {
  blood: '230,60,60', storm: '90,170,255', verdant: '90,220,120', gilt: '255,210,90', frost: '190,230,255', ember: '255,140,50', arcane: '180,120,255',
};
export const SWORDS = [
  {id: 'wayfarer',  name: 'The Wayfarer',     counts: 'Games played',                 key: 'games',      theme: 'verdant', blade: 'thornroot',   at: [1, 10, 50, 200, 500]},
  {id: 'striker',   name: 'The Striker',      counts: 'Strikes landed',               key: 'strikes',    theme: 'blood',   blade: 'bloodmoon',   at: [10, 100, 500, 2000, 5000]},
  {id: 'chain',     name: 'The Chainbreaker', counts: 'Combos',key: 'combos',     theme: 'storm',   blade: 'stormcaller', at: [5, 50, 250, 1000, 2500]},
  {id: 'victor',    name: 'The Victor',       counts: 'Wins',                         key: 'wins',       theme: 'gilt',    blade: 'sunspire',    at: [1, 10, 50, 150, 500]},
  {id: 'climber',   name: 'The Climber',      counts: 'Adventure encounters cleared', key: 'encounters', theme: 'frost',   blade: 'frostfang',   at: [5, 25, 100, 300, 750]},
  {id: 'ironwall',  name: 'The Ironwall',     counts: 'Strikes survived',             key: 'struck',     theme: 'ember',   blade: 'emberbrand',  at: [10, 100, 500, 1500, 4000]},
  {id: 'mason',     name: 'The Mason',        counts: 'Pairs placed',                 key: 'pieces',     theme: 'arcane',  blade: 'voidglass',   at: [100, 1000, 5000, 20000, 50000]},
];
export const MAX_RANK = RANKS.length - 1;
const rankOf = (n, at) => at.reduce((r, m) => n >= m ? r + 1 : r, 0);
const bladeSrc = w => new URL(`./blades/${w.blade}.png`, import.meta.url).href;

// ---------- one-off achievements ----------
export const REWARDS = {
  'coin-purse': 'A few coins on the bar', 'pieces-eight': 'A heap of coins on the bar', 'garnet': 'A garnet left on the bar as a tip',
  'topaz': 'A topaz on the mantel', 'emerald': 'An emerald on the bottle shelf', 'sapphire': 'A sapphire on the bottle shelf',
  'wormwood': 'A bottle of wormwood bitter on the bar', 'crest-iron': 'Crossed iron blades over the window', 'crest-silver': 'The window crest turns silver',
  'crest-gold': 'The window crest turns gold', 'crest-ruby': 'The window crest glows with rubies', 'fireflies': 'More fireflies outside',
  'roaring-hearth': 'A bigger fire in the hearth', 'gilded-frame': 'A gold and ruby frame for your board', 'obsidian-tray': 'A black glass tray behind your pieces',
};
const STYLE_OF = {'gilded-frame': 'frame', 'obsidian-tray': 'tray'};
export const ACHIEVEMENTS = [
  {id: 'first-blood', cat: 'Duels', tier: 0, glyph: 'sword', name: 'First Blood', for: 'Land your first strike', ok: (t) => t.strikes >= 1, reward: 'garnet'},
  {id: 'untouched', cat: 'Duels', tier: 2, glyph: 'shield', name: 'Untouched', for: 'Win a game without being struck', ok: t => t.flags.untouched, reward: 'sapphire'},
  {id: 'on-a-roll', cat: 'Duels', tier: 1, glyph: 'flame', name: 'On a Roll', for: 'Win 3 games in a row', ok: t => t.bestStreak >= 3, reward: 'coin-purse'},
  {id: 'unstoppable', cat: 'Duels', tier: 2, glyph: 'crown', name: 'Unstoppable', for: 'Win 10 games in a row', ok: t => t.bestStreak >= 10, reward: 'pieces-eight'},
  {id: 'flurry', cat: 'Duels', tier: 1, glyph: 'swords', name: 'Flurry', for: 'Land 10 strikes in one game', ok: t => t.flags.tenStrikes},
  {id: 'beat-pip', cat: 'Duels', tier: 0, glyph: 'feather', name: "Pip's Measure", for: 'Beat Pip in a duel', ok: (t, l) => l.beat.pip > 0},
  {id: 'beat-marlow', cat: 'Duels', tier: 1, glyph: 'gem', name: "Marlow's Match", for: 'Beat Marlow in a duel', ok: (t, l) => l.beat.marlow > 0},
  {id: 'beat-rook', cat: 'Duels', tier: 2, glyph: 'tower', name: "Rook's Fall", for: 'Beat Rook in a duel', ok: (t, l) => l.beat.rook > 0, reward: 'emerald'},
  {id: 'four-way', cat: 'Duels', tier: 1, glyph: 'swords', name: 'Four-Way Victor', for: 'Score 2,000 in a Free-for-All, or win a four-way duel', ok: (t, l) => l.pairedWins > 0 || l.ffaBest >= 2000, reward: 'gilded-frame'},
  {id: 'cascade', cat: 'Technique', tier: 0, glyph: 'flame', name: 'Cascade', for: 'Make a 3-stage combo', ok: t => t.maxChain >= 3},
  {id: 'avalanche', cat: 'Technique', tier: 1, glyph: 'peak', name: 'Avalanche', for: 'Make a 5-stage combo', ok: t => t.maxChain >= 5},
  {id: 'landslide', cat: 'Technique', tier: 2, glyph: 'crown', name: 'Landslide', for: 'Make a 7-stage combo', ok: t => t.maxChain >= 7},
  {id: 'clean-slate', cat: 'Technique', tier: 1, glyph: 'star', name: 'Clean Slate', for: 'Clear your whole board', ok: t => (t.fullClears | 0) >= 1, reward: 'roaring-hearth'},
  {id: 'spotless', cat: 'Technique', tier: 2, glyph: 'sun', name: 'Spotless', for: 'Clear your whole board 10 times', ok: t => (t.fullClears | 0) >= 10},
  {id: 'pathfinder', cat: 'Adventure', tier: 0, glyph: 'compass', name: 'Pathfinder', for: 'Reach encounter 5 in one climb', ok: (t, l) => l.climbDepth >= 5, reward: 'crest-iron'},
  {id: 'bonus-round', cat: 'Adventure', tier: 0, glyph: 'star', name: 'Bonus Round', for: 'Clear a bonus round', ok: (t, l) => l.climbBonus > 0, reward: 'topaz'},
  {id: 'into-wilds', cat: 'Adventure', tier: 1, glyph: 'tree', name: 'Into the Wilds', for: 'Reach encounter 10 in one climb', ok: (t, l) => l.climbDepth >= 10, reward: 'crest-silver'},
  {id: 'hoarder', cat: 'Adventure', tier: 1, glyph: 'chest', name: 'Hoarder', for: 'Hold 5 upgrades in one climb', ok: (t, l) => l.climbUpgrades >= 5, reward: 'fireflies'},
  {id: 'long-climb', cat: 'Adventure', tier: 2, glyph: 'road', name: 'The Long Climb', for: 'Reach encounter 30 in one climb', ok: (t, l) => l.climbDepth >= 30, reward: 'crest-gold'},
  {id: 'legend', cat: 'Adventure', tier: 2, glyph: 'crown', name: 'Legend of the Road', for: 'Reach encounter 50 in one climb', ok: (t, l) => l.climbDepth >= 50, reward: 'crest-ruby'},
  {id: 'sand-out', cat: 'Challenges', tier: 1, glyph: 'glass', name: 'Sand Runs Out', for: 'Score 5,000 in a two-minute race', ok: (t, l) => Math.max(l.rushBest, l.ffaBest) >= 5000},
  {id: 'unbroken', cat: 'Challenges', tier: 1, glyph: 'shield', name: 'Unbroken', for: 'Score 5,000 in an endless survival race', ok: (t, l) => Math.max(l.endlessBest, l.ffaBest) >= 5000, reward: 'obsidian-tray'},
  {id: 'crowd', cat: 'Challenges', tier: 1, glyph: 'crown', name: 'Crowd Pleaser', for: 'Score 3,000 in a Free-for-All', ok: (t, l) => l.ffaBest >= 3000},
  {id: 'zen-hour', cat: 'Zen', tier: 1, glyph: 'glass', name: 'Lost Track of Time', for: 'Spend an hour in Zen, all told', ok: (t, l) => l.zenSeconds >= 3600},
  {id: 'zen-level', cat: 'Zen', tier: 1, glyph: 'star', name: 'Steady Hand', for: 'Reach Zen level 5', ok: (t, l) => l.zenBlocks >= 600},
  {id: 'zen-chain', cat: 'Zen', tier: 2, glyph: 'peak', name: 'Still Water, Deep Chain', for: 'Make a 4-stage combo in Zen', ok: (t, l) => l.zenChain >= 4},
  {id: 'apprentice', cat: 'Forge', tier: 0, glyph: 'hammer', name: 'Apprentice Smith', for: 'Save your own sword pattern', ok: (t, l) => l.customPatterns >= 1, reward: 'wormwood'},
  {id: 'master-smith', cat: 'Forge', tier: 1, glyph: 'anvil', name: 'Master Smith', for: 'Save 5 sword patterns', ok: (t, l) => l.customPatterns >= 5},
];
export const CATS = ['Duels', 'Technique', 'Adventure', 'Challenges', 'Zen', 'Forge'];
const CAT_NOTE = {Duels: 'Earned in Play vs AI and multiplayer duels', Zen: 'Earned while playing Zen', Adventure: 'Earned on the Adventure climb', Challenges: 'Earned in Free-for-All score races', Forge: 'Earned in the Forge', Technique: 'Earned in any mode'};
const SHOW_LOCKED = 2;   // per category: everything earned, then the next few to aim for; the rest stay sealed

// ---------- tally (fed by the game) ----------
const blankTally = () => ({games: 0, strikes: 0, combos: 0, wins: 0, losses: 0, struck: 0, pieces: 0, encounters: 0, fullClears: 0, maxChain: 0, streak: 0, bestStreak: 0, days: {}, flags: {}, cur: {hits: 0, strikes: 0}});
let tally = {...blankTally(), ...read('tally', {})}; tally.flags ||= {}; tally.days ||= {}; tally.cur ||= {hits: 0, strikes: 0};
let dirty = false;
function onTally(kind, chain = 1) {
  if (kind === 'start') {
    tally.games++; tally.cur = {hits: 0, strikes: 0};
    const d = new Date(), h = d.getHours(), day = d.toISOString().slice(0, 10);
    tally.days = {[day]: (tally.days[day] || 0) + 1, ...Object.fromEntries(Object.entries(tally.days).filter(([k]) => k !== day).slice(-6))};
    if (h < 5) tally.flags.nightOwl = true; if (h >= 5 && h < 7) tally.flags.earlyBird = true;
  } else if (kind === 'clear') {
    tally.strikes++; tally.cur.strikes++; if (chain >= 2) tally.combos++; tally.maxChain = Math.max(tally.maxChain, chain | 0);
    if (tally.cur.strikes >= 10) tally.flags.tenStrikes = true;
  } else if (kind === 'hit') { tally.struck++; tally.cur.hits++; }
  else if (kind === 'lock') tally.pieces++;
  else if (kind === 'fullclear') tally.fullClears = (tally.fullClears | 0) + 1;
  else if (kind === 'win') { tally.wins++; tally.streak++; tally.bestStreak = Math.max(tally.bestStreak, tally.streak); if (tally.cur.hits === 0) tally.flags.untouched = true; }
  else if (kind === 'end') { tally.losses++; tally.streak = 0; }
  else return;
  dirty = true;
}
// counters only grow: merge with what is stored so two open tabs never roll each other back
function saveTally() {
  const st = read('tally', null);
  if (st) {
    for (const [k, v] of Object.entries(st)) if (typeof v === 'number' && typeof tally[k] === 'number' && v > tally[k] && k !== 'streak') tally[k] = v;
    tally.flags = {...(st.flags || {}), ...tally.flags};
    for (const [d, n] of Object.entries(st.days || {})) tally.days[d] = Math.max(tally.days[d] || 0, n);
  }
  save('tally', tally);
}
setInterval(() => { if (dirty) { dirty = false; saveTally(); } }, 1500);
addEventListener('pagehide', saveTally);
globalThis.scrapsTally = (kind, chain) => { try { onTally(kind, chain); } catch {} };

// ---------- ledger (read from the game's saves) ----------
const blankLedger = () => ({zenBlocks: 0, zenSeconds: 0, zenChain: 0, climbDepth: 0, climbBonus: 0, climbUpgrades: 0, climbScore: 0, climbSeen: {}, beat: {pip: 0, marlow: 0, rook: 0}, pairedWins: 0, rushBest: 0, endlessBest: 0, ffaBest: 0, customPatterns: 0, replays: 0});
let ledger = {...blankLedger(), ...read('ledger', {})}; ledger.beat = {...blankLedger().beat, ...(ledger.beat || {})}; ledger.climbSeen ||= {};
const up = (k, v) => { if (Number.isFinite(v) && v > (ledger[k] || 0)) ledger[k] = v; };
function gather() {
  const sl = read('ledger', null); if (sl) { for (const [k, v] of Object.entries(sl)) if (typeof v === 'number' && v > (ledger[k] || 0)) ledger[k] = v; for (const [k, v] of Object.entries(sl.beat || {})) ledger.beat[k] = Math.max(ledger.beat[k] || 0, v | 0); }
  const rec = read('records', null);
  if (rec) for (const k of Object.keys(ledger.beat)) ledger.beat[k] = Math.max(ledger.beat[k], rec.opponents?.[k]?.w | 0);
  const pr = read('paired-records', null); if (pr) up('pairedWins', Object.values(pr).reduce((a, r) => a + (r?.wins | 0), 0));
  const bests = read('challenge-bests', null);
  if (bests) for (const [k, v] of Object.entries(bests)) { const [mode, players] = k.split(':'), s = Number(v) || 0;
    if (players === '4') up('ffaBest', s); else if (mode === 'timed') up('rushBest', s); else if (mode === 'endless') up('endlessBest', s); }
  const zen = read('zen', null); if (zen) { up('zenBlocks', zen.blocks); up('zenSeconds', zen.seconds); up('zenChain', zen.bestChain); }
  const lib = read('pattern-library', null); if (lib?.patterns) up('customPatterns', lib.patterns.length);
  const reps = read('replays', null); if (Array.isArray(reps)) up('replays', reps.length);
  try {   // Adventure: the saved checkpoint holds completed depth for the run in progress
    const raw = read('rogue-run', null), saved = typeof raw === 'string' ? JSON.parse(raw) : raw, cp = saved?.checkpoint, seed = saved?.recipe?.seed;
    if (cp && seed != null) {
      const depth = cp.depth | 0, prev = ledger.climbSeen[seed] | 0;
      if (depth > prev) { tally.encounters += depth - prev; dirty = true; ledger.climbSeen[seed] = depth;
        const keys = Object.keys(ledger.climbSeen); if (keys.length > 100) delete ledger.climbSeen[keys[0]]; }
      up('climbDepth', depth); up('climbScore', cp.totalScore | 0); if ((cp.lastBonusDepth | 0) > 0) up('climbBonus', 1);
      if (cp.inventory && typeof cp.inventory === 'object') up('climbUpgrades', Object.values(cp.inventory).reduce((a, v) => a + (Number(v) || 0), 0));
    }
  } catch {}
  save('ledger', ledger);
}

// ---------- state ----------
let prog = read('progress', null);
const firstEver = !prog; prog = {earned: {}, style: {}, ...(prog || {})};
export function evaluate() {
  const swords = SWORDS.map(s => { const n = tally[s.key] | 0, r = rankOf(n, s.at); return {...s, n, rank: r, next: s.at[r] ?? null, prev: s.at[r - 1] ?? 0}; });
  const ach = ACHIEVEMENTS.map(a => { let done = false; try { done = !!a.ok(tally, ledger); } catch {} return {...a, done: done || !!prog.earned[a.id], at: prog.earned[a.id] || null}; });
  const unlocked = new Set(ach.filter(a => a.done && a.reward).map(a => a.reward));
  return {swords, achievements: ach, unlocked};
}
export const unlocked = id => evaluate().unlocked.has(id);
export function styleChoice(kind) { const id = prog.style?.[kind]; return id && unlocked(id) ? id : null; }
export function setStyle(kind, id) { prog.style = {...prog.style, [kind]: id}; save('progress', prog); applyStyles(); }
function applyStyles() {
  const cos = {frame: styleChoice('frame'), tray: styleChoice('tray')}; globalThis.scrapsCosmetics = cos;
  document.body?.classList.toggle('cos-gilded-frame', cos.frame === 'gilded-frame');
}

// ---------- notifications ----------
let toastHost = null;
// While a game is in play, unlocks wait and arrive together when it ends.
const waiting = [];
setInterval(() => { if (waiting.length && !globalThis.scrapsInPlay?.()) waiting.splice(0).forEach((args, i) => setTimeout(() => show(...args), i * 450)); }, 700);
function toast(...args) { if (globalThis.scrapsInPlay?.()) waiting.push(args); else show(...args); }
// The card leads with what you did ("500 strikes survived", "Win 3 games in a row"), the number picked out in gold,
// then what it earned you; a sword of honour shows its five rank pips.
function body(small, title, line, rank) {
  const txt = document.createElement('div');
  if (small) { const e = document.createElement('small'); e.textContent = small; txt.append(e); }
  if (title) { const e = document.createElement('strong'); const m = /^([\d,.]+)\s+(.*)$/.exec(title);
    if (m) { const b = document.createElement('b'); b.textContent = m[1]; e.append(b, ' ' + m[2]); } else e.textContent = title; txt.append(e); }
  if (line) { const e = document.createElement('span'); e.textContent = line; txt.append(e); }
  if (rank) { const p = document.createElement('i'); p.className = 'pg-pips'; p.setAttribute('aria-label', `Rank ${rank} of ${MAX_RANK}`); for (let r = 1; r <= MAX_RANK; r++) { const d = document.createElement('u'); if (r <= rank) d.className = 'on'; p.append(d); } txt.append(p); }
  return txt;
}
function show(canvas, small, title, line, rank = 0) {
  // an end-of-game card on screen collects them instead (its .eg-unlocks shelf)
  const shelf = [...document.querySelectorAll('.eg-unlocks')].find(e => e.isConnected && e.parentElement?.offsetParent !== null);
  if (shelf) {
    const t = document.createElement('div'); t.className = 'eg-unlock'; canvas.classList.add('eg-unlock-icon');
    t.append(canvas, body(small, title, line, rank)); shelf.append(t); shelf.hidden = false;
    try { globalThis.scrapsSfx?.('win', 1, read('preferences', {})); } catch {}
    return;
  }
  if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'pg-toasts'; toastHost.setAttribute('role', 'status'); document.body.append(toastHost); }
  const t = document.createElement('div'); t.className = 'pg-toast'; canvas.classList.add('pg-toast-icon');
  t.append(canvas, body(small, title, line, rank)); toastHost.append(t);
  try { globalThis.scrapsSfx?.('win', 1, read('preferences', {})); } catch {}
  setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4800);
}
function check(silent = false) {
  if (!dirty) { const st = read('tally', null); if (st) for (const [k, v] of Object.entries(st)) if (typeof v === 'number' && typeof tally[k] === 'number' && v > tally[k]) tally[k] = v; }
  gather(); const s = evaluate(); let changed = false;
  for (const a of s.achievements) if (a.done && !prog.earned[a.id]) { prog.earned[a.id] = Date.now(); changed = true; if (!silent) toast(badgeCanvas(a, 2), 'Achievement · ' + a.name, a.for, a.reward ? 'Unlocked: ' + REWARDS[a.reward] : ''); }
  // ranks replaced the old 17 tiers: the first time through, take today's ranks quietly
  if (!prog.ranks) { prog.ranks = Object.fromEntries(s.swords.map(w => [w.id, w.rank])); changed = true; }
  for (const w of s.swords) if ((prog.ranks[w.id] | 0) < w.rank) { if (!silent) toast(swordArt(w, 'pg-toast-icon'), 'Sword of honour · rank up', fmt(w.at[w.rank - 1]) + ' ' + w.counts.toLowerCase(), `${w.name} is now ${RANKS[w.rank]}`, w.rank); prog.ranks[w.id] = w.rank; changed = true; }
  if (changed) save('progress', prog);
  applyStyles(); return s;
}

// ---------- the swords: the blade art, woken up by rank (styles in title.css) ----------
export function swordArt(w, cls = 'pg-sword-art') {
  const box = document.createElement('div'); box.className = `${cls} pg-blade r${w.rank}`; box.style.setProperty('--aura', `rgb(${THEMES[w.theme]})`); box.style.setProperty('--blade', `url("${bladeSrc(w)}")`);
  const img = document.createElement('img'); img.src = bladeSrc(w); img.alt = ''; img.draggable = false; box.append(img);
  if (w.rank >= MAX_RANK) for (let i = 0; i < 5; i++) { const sp = document.createElement('i'); sp.style.cssText = `--d:${(i * .7).toFixed(1)}s;--x:${[18, 72, 30, 80, 50][i]}%;--y:${[20, 34, 58, 70, 86][i]}%`; box.append(sp); }
  return box;
}

// ---------- pixel art: achievement medals ----------
const MEDAL = [['#3a1f0e', '#7a4520', '#b0703a', '#d9995c', '#f4c48c'], ['#2a2c33', '#5d626e', '#9aa1ad', '#cdd3dc', '#f4f7fa'], ['#3d2410', '#8f5f22', '#d4a24c', '#f0cf7a', '#fff0b8']];
const GREY = ['#1c1a1a', '#3a3735', '#57534f', '#77726c', '#99938b'];
const GLYPHS = {
  sword: ['........xx', '.......xxx', '......xxx.', '.....xxx..', 'x...xxx...', '.x.xxx....', '..xxx.....', '..xx......', '.x..x.....', 'x.........'],
  swords: ['x.......x.', 'xx.....xx.', '.xx...xx..', '..xx.xx...', '...xxx....', '...xxx....', '..xx.xx...', '.x.....x..', 'x.......x.', '..........'],
  shield: ['xxxxxxxxx.', 'x...x...x.', 'x...x...x.', 'xxxxxxxxx.', 'x...x...x.', '.x..x..x..', '..x.x.x...', '...xxx....', '....x.....', '..........'],
  flame: ['....x.....', '...xx.....', '...xxx....', '..xxxx.x..', '..xxxxxx..', '.xxx.xxx..', '.xx...xx..', '.xx...xx..', '..xxxxx...', '..........'],
  crown: ['..........', 'x...x...x.', 'xx.xxx.xx.', 'xxxxxxxxx.', 'xxxxxxxxx.', 'x.x.x.x.x.', 'xxxxxxxxx.', '..........', '..........', '..........'],
  peak: ['....x.....', '....xxx...', '....x.....', '...xxx....', '..xx.xx...', '.xx...xx..', 'xx..x..xx.', 'x..xxx..x.', 'xxxxxxxxx.', '..........'],
  feather: ['.......xx.', '......xxx.', '.....xxx..', '....xxxx..', '...xxxx...', '..xxxx....', '..xxx.....', '.x........', 'x.........', '..........'],
  gem: ['..........', '..xxxxx...', '.x.x.x.x..', 'xxxxxxxxx.', '.x..x..x..', '..x.x.x...', '...xxx....', '....x.....', '..........', '..........'],
  tower: ['x.x.x.x...', 'xxxxxxx...', '.xxxxx....', '.xx.xx....', '.xxxxx....', '.xxxxx....', '.xx.xx....', 'xxxxxxx...', 'xxxxxxx...', '..........'],
  compass: ['....x.....', '...xxx....', '..x.x.x...', '.x..x..x..', 'xxxxxxxxx.', '.x..x..x..', '..x.x.x...', '...xxx....', '....x.....', '..........'],
  star: ['....x.....', '....x.....', '...xxx....', 'xxxxxxxxx.', '.xxxxxxx..', '..xxxxx...', '..xx.xx...', '.xx...xx..', '.x.....x..', '..........'],
  tree: ['....x.....', '...xxx....', '..xxxxx...', '...xxx....', '..xxxxx...', '.xxxxxxx..', 'xxxxxxxxx.', '....x.....', '...xxx....', '..........'],
  chest: ['..........', '.xxxxxxxx.', 'x........x', 'xxxxxxxxxx', 'x...xx...x', 'x...xx...x', 'x........x', 'xxxxxxxxxx', '..........', '..........'],
  road: ['.....x....', '....xx....', '....x.....', '...xx.....', '...x......', '..xx...x..', '..x...xxx.', '.xx..xxxxx', 'xx..xxxxxx', '..........'],
  glass: ['xxxxxxxx..', '.x....x...', '..x..x....', '...xx.....', '...xx.....', '..x..x....', '.x.xx.x...', 'xxxxxxxx..', '..........', '..........'],
  hammer: ['.xxxxx....', 'xxxxxxx...', '.xxxxx....', '...x......', '...x......', '...x......', '...x......', '...x......', '..xxx.....', '..........'],
  anvil: ['..........', 'xxxxxxxxx.', '.xxxxxxxx.', '...xxxx...', '...xxx....', '..xxxxx...', '.xxxxxxx..', '..........', '..........', '..........'],
  moon: ['...xxx....', '..xx......', '.xx.......', '.xx.......', '.xx.......', '.xx.......', '..xx......', '...xxx....', '..........', '..........'],
  sun: ['....x.....', '.x..x..x..', '..xxxxx...', '..xxxxx...', 'xxxxxxxxx.', '..xxxxx...', '..xxxxx...', '.x..x..x..', '....x.....', '..........'],
  mug: ['..........', '.xxxxx....', '.x...xxx..', '.x...x.x..', '.x...x.x..', '.x...xxx..', '.x...x....', '.xxxxx....', '..........', '..........'],
  book: ['..........', 'xxxx.xxxx.', 'x..xxx..x.', 'x.x.x.x.x.', 'x..xxx..x.', 'x.x.x.x.x.', 'x..xxx..x.', 'xxxxxxxxx.', '..........', '..........'],
};
export function badgeCanvas(b, scale = 2) {
  const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d');
  const R = b.done ? MEDAL[b.tier] : GREY, P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const inside = (x, y) => { const dx = x - 11.5, dy = y - 11.5;
    switch (b.cat) {
      case 'Adventure': return y >= 1 && y <= 22 && Math.abs(dx) <= (y < 13 ? 10 : 10 - (y - 13) * 1.05);
      case 'Challenges': return Math.abs(dx) * .58 + Math.abs(dy) * .5 <= 7.4 && Math.abs(dy) <= 10.5;
      case 'Forge': return Math.abs(dx) <= 10 && Math.abs(dy) <= 10 && !(Math.abs(dx) > 8 && Math.abs(dy) > 8);
      case 'Technique': return Math.abs(dx) + Math.abs(dy) <= 12.5;
      default: return dx * dx + dy * dy <= 10.6 * 10.6; } };
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (inside(x, y)) {
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const rim = !edge && (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2));
    P(x, y, edge ? '#0d0807' : rim ? ((x + y) < 23 ? R[4] : R[1]) : ((x + y) < 20 ? R[3] : R[2]));
  }
  const gl = GLYPHS[b.glyph] || GLYPHS.star;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (gl[y][x] === 'x') { P(7 + x, 7 + y, R[0]); if (gl[y + 1]?.[x] !== 'x') P(7 + x, 8 + y, R[4]); }
  const big = document.createElement('canvas'); big.width = big.height = 24 * scale; const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, 24 * scale, 24 * scale); return big;
}

// ---------- hub decorations for unlocked rewards (room pixels, 960x540) ----------
const SPR = {};
function pix(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn((x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }); return c; }
function coins(n, seed) { let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const w = n > 10 ? 30 : 16, h = n > 10 ? 14 : 8;
  return pix(w, h, P => { for (let i = 0; i < n; i++) { const x = Math.round(r() * (w - 6)), y = Math.round(h - 3 - r() * (h - 3) * (1 - Math.abs(x - w / 2) / (w / 2))); P(x, y, '#5a3a10', 6, 3); P(x + 1, y, '#d4a24c', 4, 2); P(x + 1, y, '#fff0b8', 2, 1); P(x + 4, y + 1, '#8f5f22', 1, 1); } }); }
function gemSpr(r) { return pix(7, 6, P => { P(1, 0, r[0], 5, 1); P(0, 1, r[0], 7, 1); P(1, 1, r[3], 5, 1); P(0, 2, r[0], 1, 2); P(6, 2, r[0], 1, 2); P(1, 2, r[2], 5, 2); P(1, 2, r[4], 2, 1); P(2, 4, r[1], 3, 1); P(3, 5, r[0]); P(2, 1, '#ffffff'); }); }
function bottle() { return pix(7, 18, P => { P(2, 0, '#0d0807', 3, 1); P(2, 1, '#6e4419', 3, 2); P(2, 3, '#0d0807', 3, 1); P(2, 4, '#c9d27a', 3, 4); P(1, 8, '#0d0807', 5, 1); P(0, 9, '#0d0807', 7, 9); P(1, 9, '#a8b85a', 5, 8); P(1, 9, '#e6ef9c', 1, 7); P(2, 12, '#f5e8c8', 3, 3); P(3, 13, '#7d1b20'); P(5, 10, '#6f7d34', 1, 6); }); }
const METAL_GOLD = ['#3d2410', '#8f5f22', '#d4a24c', '#f0cf7a', '#fff0b8'];
function crest(M) { return pix(34, 24, P => { for (let i = 0; i < 22; i++) { P(3 + i, i, '#0d0807', 3, 1); P(3 + i, i + 1, M[3]); P(4 + i, i + 1, M[2]); P(29 - i, i, '#0d0807', 3, 1); P(30 - i, i + 1, M[3]); P(29 - i, i + 1, M[2]); }
  P(13, 9, '#0d0807', 8, 6); P(14, 10, '#d4a24c', 6, 4); P(15, 10, '#f0cf7a', 4, 1); P(16, 11, '#a32a2a', 2, 2); P(16, 11, '#ec7a5f'); }); }
function buildSprites() {
  SPR.purse = coins(7, 11); SPR.heap = coins(26, 7); SPR.wormwood = bottle();
  SPR.garnet = gemSpr(['#2e070c', '#64121d', '#9c1f29', '#d43838', '#ffb7a2']); SPR.topaz = gemSpr(['#4f3207', '#916210', '#d29d1d', '#f2cf28', '#fff8d2']); SPR.emerald = gemSpr(['#0a2a17', '#13552d', '#22843d', '#47bf56', '#d6ffc4']); SPR.sapphire = gemSpr(['#08122e', '#112c66', '#1d52a2', '#369dde', '#d2f1ff']);
  SPR.crest = [crest(['#1d1d22', '#3b3d45', '#5d606a', '#7d818c', '#a3a7b0']), crest(['#2a2c33', '#5d626e', '#9aa1ad', '#cdd3dc', '#f4f7fa']), crest(METAL_GOLD), crest(['#2e070c', '#64121d', '#9c1f29', '#d43838', '#ffb7a2'])];
}
let cU = null, cAt = 0;
function unl() { const n = Date.now(); if (!cU || n - cAt > 3000) { cU = evaluate().unlocked; cAt = n; } return cU; }
export function decorFlags() { const u = unl(); return {fireflies: u.has('fireflies'), hearth: u.has('roaring-hearth')}; }
export function drawDecor(g, rx, ry, t, live) {
  if (!SPR.crest) buildSprites(); const u = unl(); g.imageSmoothingEnabled = false;
  const tier = u.has('crest-ruby') ? 3 : u.has('crest-gold') ? 2 : u.has('crest-silver') ? 1 : u.has('crest-iron') ? 0 : -1;
  if (tier >= 0) { g.drawImage(SPR.crest[tier], 463 + rx, 74 + ry); if (tier === 3 && live) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25 + .15 * Math.sin(t * 2); g.drawImage(SPR.crest[3], 463 + rx, 74 + ry); g.restore(); } }
  if (u.has('pieces-eight')) g.drawImage(SPR.heap, 160 + rx, 317 + ry); else if (u.has('coin-purse')) g.drawImage(SPR.purse, 170 + rx, 323 + ry);
  if (u.has('garnet')) g.drawImage(SPR.garnet, 248 + rx, 325 + ry);
  if (u.has('wormwood')) g.drawImage(SPR.wormwood, 214 + rx, 313 + ry);
  if (u.has('topaz')) g.drawImage(SPR.topaz, 812 + rx, 269 + ry);
  if (u.has('emerald')) g.drawImage(SPR.emerald, 112 + rx, 263 + ry);
  if (u.has('sapphire')) g.drawImage(SPR.sapphire, 288 + rx, 263 + ry);
}

// ---------- the Gallery ----------
export function renderGallery(host, onBack, tab = 'swords') {
  const s = check(true); host.replaceChildren();
  const earned = s.achievements.filter(a => a.done).length, tiers = s.swords.reduce((a, w) => a + w.rank, 0), maxT = s.swords.length * MAX_RANK;
  const head = document.createElement('div'); head.className = 'pg-head';
  head.innerHTML = `<div class="pg-tabs" role="tablist"><button type="button" role="tab" data-tab="swords">Swords <small>${tiers}/${maxT}</small></button><button type="button" role="tab" data-tab="ach">Achievements <small>${earned}/${s.achievements.length}</small></button></div><button type="button" class="tt-gal-close">Back</button>`;
  head.querySelector('.tt-gal-close').onclick = onBack;
  for (const b of head.querySelectorAll('[data-tab]')) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.onclick = () => renderGallery(host, onBack, b.dataset.tab); }
  const body = document.createElement('div'); body.className = 'pg-scroll';
  if (tab === 'swords') {
    const grid = document.createElement('div'); grid.className = 'pg-swords';
    for (const w of s.swords) {
      const card = document.createElement('article'); card.className = `pg-sword r${w.rank}`;
      const art = swordArt(w);
      const pct = w.next ? Math.round((w.n - w.prev) / (w.next - w.prev) * 100) : 100;
      const info = document.createElement('div'); info.className = 'pg-sword-info';
      info.innerHTML = `<h3></h3><p class="pg-rank"></p><p class="pg-count"></p><div class="pg-bar"><i style="width:${pct}%"></i></div><p class="pg-tier"></p><ol class="pg-pips" aria-hidden="true">${w.at.map((_, i) => `<li class="${i < w.rank ? 'on' : ''}"></li>`).join('')}</ol>`;
      info.querySelector('h3').textContent = w.name;
      info.querySelector('.pg-rank').textContent = RANKS[w.rank];
      info.querySelector('.pg-count').textContent = `${fmt(w.n)} ${w.counts.toLowerCase()}`;
      info.querySelector('.pg-tier').textContent = w.next ? `${RANKS[w.rank + 1]} at ${fmt(w.next)}` : 'Fully awakened';
      card.append(art, info); grid.append(card);
    }
    body.append(grid);
  } else {
    const card = a => {
      const el = document.createElement('article'); el.className = 'pg-card' + (a.done ? ' done' : '');
      const icon = badgeCanvas(a, 2); icon.className = 'pg-icon';
      const info = document.createElement('div'); info.className = 'pg-body'; info.innerHTML = '<h3></h3><p class="pg-for"><span>To earn</span> </p>';
      info.querySelector('h3').textContent = a.name; info.querySelector('.pg-for').append(a.for);
      if (a.reward) { const p = document.createElement('p'); p.className = 'pg-reward'; p.textContent = (a.done ? 'Unlocked: ' : 'Reward: ') + REWARDS[a.reward]; info.append(p);
        const kind = STYLE_OF[a.reward]; if (a.done && kind) { const on = styleChoice(kind) === a.reward, btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pg-use'; btn.textContent = on ? 'In use' : 'Use'; btn.onclick = () => { setStyle(kind, on ? null : a.reward); renderGallery(host, onBack, 'ach'); }; info.append(btn); } }
      el.append(icon, info); return el;
    };
    for (const cat of CATS) {
      const all = s.achievements.filter(a => a.cat === cat).sort((a, b) => a.tier - b.tier); if (!all.length) continue;
      const done = all.filter(a => a.done), next = all.filter(a => !a.done).slice(0, SHOW_LOCKED), sealed = all.length - done.length - next.length;
      const sec = document.createElement('section'); sec.className = 'pg-cat';
      sec.innerHTML = `<header><h3></h3><span>${done.length}/${all.length}</span><p></p></header>`;
      sec.querySelector('h3').textContent = cat; sec.querySelector('p').textContent = CAT_NOTE[cat] || '';
      const grid = document.createElement('div'); grid.className = 'pg-grid';
      for (const a of done) grid.append(card(a));
      for (const a of next) { const c = card(a); c.classList.add('next'); grid.append(c); }
      if (sealed > 0) { const x = document.createElement('div'); x.className = 'pg-sealed'; x.textContent = `${sealed} more to discover`; grid.append(x); }
      sec.append(grid); body.append(sec);
    }
  }
  host.append(head, body);
}

// ---------- boot ----------
if (typeof document !== 'undefined') {
  check(firstEver);   // anything already true before this existed is granted quietly
  setInterval(() => check(false), 4000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { gather(); saveTally(); } });
  globalThis.scrapsProgress = {evaluate, unlocked, swords: SWORDS, ranks: RANKS, achievements: ACHIEVEMENTS, refresh: () => check(false), tally: () => ({...tally})};
}
