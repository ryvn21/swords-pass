// Adventure presentation: the climb leaves the tavern and travels through biomes.
// rogue-ui.js calls (both guarded):
//   scrapsAdventure.setup(host)    after the start screen renders
//   scrapsAdventure.screen(host,v) after every run screen renders (v = runView snapshot, read only)
// Everything here is drawing and layout: biome backdrops (title/biomes/*.png), the trail map,
// upgrade icons with rank pips, encounter headers. Run state is never changed.
import {drawIcon} from './forge-art.js';
import {DEFAULT_CLIMB} from '../climb-content.js';

export const BIOMES = [
  {id: 'hearthroad', name: 'The Hearthroad', from: 0, sky: ['#2a1d3a', '#5a3a5a', '#d88a5a'], hills: ['#2a3a2a', '#1e2c22', '#141e18'], accent: '#f0cf7a', feature: 'pines', sun: '#ffd27a'},
  {id: 'ember', name: 'The Ember Mines', from: 5, sky: ['#1a0a0a', '#4a1410', '#a8401c'], hills: ['#3a1a12', '#24100c', '#160a08'], accent: '#ff8a3a', feature: 'spires', sun: '#ff6a2a'},
  {id: 'frost', name: 'The Frost Pass', from: 10, sky: ['#14203a', '#3a5a80', '#a8c8e8'], hills: ['#c8d8e8', '#7a90b0', '#3a4a66'], accent: '#bff0ff', feature: 'crystals', sun: '#ffffff'},
  {id: 'storm', name: 'The Storm Peaks', from: 15, sky: ['#0e1020', '#262a48', '#4a5078'], hills: ['#2a2e48', '#1c1e34', '#121426'], accent: '#e0f0ff', feature: 'bolts', sun: null},
  {id: 'shore', name: 'The Sunken Shore', from: 20, sky: ['#0a1e2a', '#145060', '#3aa0a0'], hills: ['#0e3a44', '#0a2a32', '#061a20'], accent: '#7ae0d0', feature: 'ruins', sun: '#e0fff8'},
  {id: 'void', name: 'The Void Ruins', from: 30, sky: ['#08040e', '#1e0e32', '#4a1e6a'], hills: ['#1a0e2a', '#120a1e', '#0a0612'], accent: '#d0a8ff', feature: 'pillars', sun: '#b06aff'},
];
export const biomeAt = depth => [...BIOMES].reverse().find(b => depth >= b.from) || BIOMES[0];

// ---------- biome backdrops: pixel scenes painted in the same style as the tavern window view ----------
export const backdrop = b => new URL(`./biomes/${b.id}.png`, import.meta.url).href;

// ---------- the trail: where you are, what's next, where the biome changes ----------
function trail(depth, nextCheckpoint) {
  const from = Math.max(1, depth - 2), to = from + 9, nodes = [];
  for (let d = from; d <= to; d++) {
    const b = biomeAt(d), state = d <= depth ? 'done' : d === depth + 1 ? 'here' : 'ahead', bonus = d === nextCheckpoint || (d < depth && d % 5 === 0), edge = d > 1 && biomeAt(d - 1).id !== b.id;
    nodes.push(`${edge ? `<li class="adv-border" style="--acc:${b.accent}"><span>${b.name.replace('The ', '')}</span></li>` : ''}<li class="adv-node ${state} ${bonus ? 'bonus' : ''}" style="--acc:${b.accent}" title="Encounter ${d}"><i></i><b>${d}</b></li>`);
  }
  return `<nav class="adv-trail" aria-label="Your climb"><ol>${nodes.join('')}</ol></nav>`;
}
// what a relic gives right now, in a few words
const GIVES = {scorePercent: n => `+${n}% clear points`, chainBonus: n => `+${n} per chain stage`, breakerBonus: n => `+${Math.round(n * 100)}% breakers`,
  attackDelayMs: n => `waves ${n / 1000}s later`, sprinkleBonus: n => `+${n} sprinkle${n === 1 ? '' : 's'} per attack`, strikeHeightBonus: n => `+${n} sword height`,
  waveWard: n => `${n} wave${n === 1 ? '' : 's'} turned aside`, swordWidthBonus: n => `+${n} sword width`, blockBounty: n => `+${n} per block broken`,
  secondWind: () => 'ready once per encounter', attackHasteMs: n => `waves ${n / 1000}s sooner`, chainSprinkles: n => `+${n} sprinkles on ×3 chains`};
const gives = u => (u.effects || []).map(e => GIVES[e.kind]?.(e.current ?? e.amount ?? 0)).filter(Boolean).join(' · ');
let bonusShown = '';
// ---------- your blade: one sword that grows with every relic rank you earn this run ----------
const BLADE_TIERS = [
  {at: 0, name: 'Rusted Shortsword', line: 'Chipped, dull, and yours.'},
  {at: 1, name: "Squire's Steel", line: 'Cleaned up and honest.'},
  {at: 3, name: 'Ruby Longsword', line: 'A stone set in the guard.'},
  {at: 5, name: 'Gilded Blade', line: 'Gold at the hilt now.'},
  {at: 8, name: 'Runeblade', line: 'The runes have started to glow.'},
  {at: 11, name: 'Dawnbringer', line: 'A legend in your hand.'},
];
const bladeImg = i => new URL(`./blade-tiers/t${i}.png`, import.meta.url).href;
const ranksOf = v => (v.inventory || []).reduce((n, u) => n + (u.stacks || 0), 0);
const tierOf = ranks => BLADE_TIERS.reduce((t, x, i) => ranks >= x.at ? i : t, 0);
let bladeSeen = {seed: null, tier: 0};
function bladeGrows(t) {
  const b = BLADE_TIERS[t], box = document.createElement('div'); box.className = 'adv-banner adv-blade-banner';
  box.innerHTML = `<img src="${bladeImg(t)}" alt=""><div><small>YOUR BLADE GROWS</small><strong>${b.name}</strong><span>${b.line}</span></div>`;
  document.body.append(box); globalThis.scrapsSfx?.('fuse', 16, (() => { try { return JSON.parse(localStorage.getItem('scraps.preferences') || '{}'); } catch { return {}; } })()); setTimeout(() => box.remove(), 2600);
}
const iconURL = new Map();
// painted relic and encounter icons (title/icons/*.png, 64 px); the drawn ones remain for anything without a file
const ICON_FILES = new Set(['bank-points', 'blood-pact', 'breaker-supply', 'breathing-room', 'broad-edge', 'chain-route', 'chain-value', 'checkpoint', 'clear-sprint', 'clear-value', 'duel', 'echo-crown', 'extra-sprinkles', 'hold', 'miners-tithe', 'precision', 'premium', 'second-wind', 'taller-swords', 'ward-charm']);
function icon(id) { if (!iconURL.has(id)) { if (ICON_FILES.has(id)) iconURL.set(id, new URL(`./icons/${id}.png`, import.meta.url).href); else { const c = drawIcon(id); iconURL.set(id, c ? c.toDataURL() : ''); } } return iconURL.get(id); }

function setScene(b) {
  document.body.dataset.scene = 'adv';
  document.body.style.setProperty('--adv-bg', `url(${backdrop(b)})`);
  document.body.style.setProperty('--adv-acc', b.accent);
}

function screen(host, v) {
  if (!v || v.kind !== 'climb') return;
  const b = biomeAt(Math.max(1, (v.depth || 0) + (v.phase === 'route' ? 1 : 0)));
  setScene(b);
  if (v.phase === 'playing' && lastPhase !== 'playing') banner(v, b);
  lastPhase = v.phase;
  if (v.inventory?.length) markSeen(v.inventory.map(u => u.id));
  for (const btn of host.querySelectorAll('[data-rogue-reward]')) {
    const u = v.offers?.find(o => o.id === btn.dataset.rogueReward); if (!u || btn.querySelector('.relic-tag')) continue;
    btn.insertAdjacentHTML('afterbegin', `<small class="relic-tag">${RARITY_LABEL[u.rarity || 'common'] || ''}</small>`);
    if (u.flavor) btn.querySelector('strong')?.insertAdjacentHTML('afterend', `<em class="relic-flavor">${u.flavor}</em>`);
  }
  const head = host.querySelector('.game-heading');
  if (head && !host.querySelector('.adv-trail')) {
    (head.querySelector(':scope > div') || head).insertAdjacentHTML('afterend', trail(v.depth || 0, v.nextCheckpoint));   // the trail sits in the heading row
    const eb = head.querySelector('.eyebrow'); if (eb) eb.textContent = `${b.name.toUpperCase()} · ENCOUNTER ${v.encounter?.depth ?? v.depth + 1}`;
  }
  host.querySelector('.rogue-layout')?.classList.add('adv-layout');
  // sidebar: upgrades as icons with rank pips
  const side = host.querySelector('.rogue-sidebar'), h3 = side?.querySelector('h3');
  if (h3 && h3.nextElementSibling && !side.querySelector('.adv-kit')) {
    h3.textContent = 'Your kit';
    h3.nextElementSibling.outerHTML = v.inventory?.length ? `<div class="adv-kit">${v.inventory.map(u => `<div class="adv-kit-item" title="${u.name}: ${u.description ?? ''}"><img src="${icon(u.id)}" alt=""><span>${u.name}<small>${gives(u)}</small></span><em>${Array.from({length: u.maxStacks || 3}, (_, i) => `<i class="${i < u.stacks ? 'on' : ''}"></i>`).join('')}</em></div>`).join('')}</div>` : '<p class="adv-kit-empty">Win an encounter to earn your first upgrade.</p>';
  }
  // your blade, at the top of the sidebar
  if (side && !side.querySelector('.adv-blade')) {
    const ranks = ranksOf(v), t = tierOf(ranks), b = BLADE_TIERS[t], next = BLADE_TIERS[t + 1];
    side.querySelector('p.eyebrow')?.insertAdjacentHTML('afterend', `<div class="adv-blade" data-tier="${t}" title="Every relic rank you earn feeds your blade"><img src="${bladeImg(t)}" alt=""><div><small>YOUR BLADE</small><strong>${b.name}</strong><span>${next ? `${next.at - ranks} more relic rank${next.at - ranks === 1 ? '' : 's'} to grow` : 'Fully grown'}</span></div></div>`);
    if (bladeSeen.seed !== v.seed) bladeSeen = {seed: v.seed, tier: t}; else if (t > bladeSeen.tier) { bladeSeen.tier = t; bladeGrows(t); }
  }
  // reward cards: rank pips
  for (const btn of host.querySelectorAll('[data-rogue-reward]')) {
    const u = v.offers?.find(o => o.id === btn.dataset.rogueReward); if (!u || u.pointReward || btn.querySelector('.adv-pips')) continue;
    btn.insertAdjacentHTML('beforeend', `<em class="adv-pips">${Array.from({length: u.maxStacks || 3}, (_, i) => `<i class="${i < u.rank ? 'on' : i < u.nextRank ? 'new' : ''}"></i>`).join('')}</em>`);
  }
  // route choices: difficulty pips from the rival's difficulty or the encounter's rarity
  for (const btn of host.querySelectorAll('[data-climb-path]')) {
    const e = v.paths?.find(p => p.id === btn.dataset.climbPath); if (!e || btn.querySelector('.adv-pips')) continue;
    const lvl = e.kind === 'duel' ? ({easy: 1, medium: 2, hard: 3}[e.opponent?.difficulty] ?? 2) : e.rare ? 3 : e.bonus ? 2 : 1;
    btn.insertAdjacentHTML('beforeend', `<em class="adv-pips danger" title="How dangerous this encounter is"><b>Danger</b>${[1, 2, 3].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</em>`);
  }
  // a checkpoint bonus announces itself when it lands
  if (v.phase === 'ready' && v.encounter?.bonus && bonusShown !== String(v.depth)) {
    bonusShown = String(v.depth);
    const box = document.createElement('div'); box.className = 'adv-banner adv-bonus-banner';
    box.innerHTML = `<small>CHECKPOINT ${v.depth}</small><strong>Bonus round!</strong><span>${v.encounter.rewardPoints ? '+' + v.encounter.rewardPoints + ' score · ' : ''}win it for an extra relic</span>`;
    document.body.append(box); globalThis.scrapsSfx?.('win', 1, {sound: true, volume: .12}); setTimeout(() => box.remove(), 2600);
  }
  // ready: a big icon for the encounter type
  const stage = host.querySelector('#rogue-stage');
  if (v.phase === 'ready' && stage && !stage.querySelector('.adv-emblem')) {
    const type = (v.encounter?.id || '').split('-').slice(2).join('-') || (v.opponent ? 'duel' : 'hold');
    stage.insertAdjacentHTML('afterbegin', `<div class="adv-emblem"><img src="${icon(type) || icon('duel')}" alt=""></div>`);
  }
  if (v.finished) logRun(v, b);
  if (v.finished && stage && !stage.querySelector('.adv-end')) {
    const won = v.phase === 'won', kit = (v.inventory || []).map(u => `<img src="${icon(u.id)}" alt="${u.name}" title="${u.name} · rank ${u.stacks}">`).join('');
    stage.classList.add('adv-ending'); stage.style.setProperty('--end-bg', `url(${backdrop(b)})`);
    stage.insertAdjacentHTML('afterbegin', `<div class="adv-end ${won ? 'won' : 'lost'}"><p class="adv-end-eyebrow">${won ? 'THE ROAD IS YOURS' : v.phase === 'abandoned' ? 'YOU TURN FOR HOME' : 'THE ROAD ENDS HERE'}</p><div class="adv-end-depth"><small>Reached</small><b>${v.depth}</b><span>${b.name}</span></div>
      <dl class="adv-end-stats"><div><dt>Score</dt><dd>${(v.totalScore || 0).toLocaleString('en-GB')}</dd></div><div><dt>Blocks</dt><dd>${(v.totalBlocks || 0).toLocaleString('en-GB')}</dd></div><div><dt>Best combo</dt><dd>×${v.bestCombo || 1}</dd></div></dl>
      ${kit ? `<div class="adv-end-kit"><small>Relics carried</small><div>${kit}</div></div>` : ''}<div class="adv-end-blade"><img src="${bladeImg(tierOf(ranksOf(v)))}" alt=""><span>${BLADE_TIERS[tierOf(ranksOf(v))].name}</span></div></div>`);
  }
}

// ---------- the road log: a short line for every finished run, shown before the next one ----------
const LOG_KEY = 'scraps.run-log', LOG_MAX = 20;
const readLog = () => { try { const l = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
function logRun(v, b) {
  const id = `${v.seed}:${v.results?.length || 0}:${v.totalScore || 0}`, log = readLog(); if (log.some(e => e.id === id)) return;
  const wins = (v.results || []).filter(r => r.success).length;
  log.unshift({id, at: Date.now(), depth: v.depth || 0, biome: b.id, score: v.totalScore || 0, blocks: v.totalBlocks || 0, combo: v.bestCombo || 1, wins,
    ended: v.phase === 'won' ? 'won' : v.phase === 'abandoned' ? 'ended' : v.reason === 'time' ? 'time' : 'board', relics: (v.inventory || []).map(u => u.id)});
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX))); } catch {}
}
const ENDED = {won: 'Finished the road', ended: 'Turned for home', time: 'Ran out of time', board: 'Board filled'};
function logHTML(log) {
  const day = t => new Date(t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
  return `<section class="adv-log"><h3>Road log</h3><ol>${log.slice(0, 5).map(e => { const bio = BIOMES.find(x => x.id === e.biome) || BIOMES[0];
    return `<li style="--acc:${bio.accent}" title="Cleared ${e.depth} encounter${e.depth === 1 ? '' : 's'}"><b>${e.depth}<small>cleared</small></b><span><strong>${bio.name.replace('The ', '')}</strong><small>${ENDED[e.ended] || ''} · ${day(e.at)}</small></span><em>${e.score.toLocaleString('en-GB')}<small>score</small></em><i>${(e.relics || []).map(icon).filter(Boolean).slice(0, 6).map(src => `<img src="${src}" alt="">`).join('')}</i></li>`; }).join('')}</ol></section>`;
}

// ---------- relics: which you've seen, and the codex ----------
const SEEN_KEY = 'scraps.relics-seen';
const seenRelics = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
function markSeen(ids) { const s = seenRelics(), n = s.size; for (const id of ids) s.add(id); if (s.size !== n) try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch {} }
const RARITY_LABEL = {common: 'Common', rare: 'Rare', legendary: 'Legendary'};
function openCodex(relics) {
  const seen = seenRelics(), box = document.createElement('div'); box.className = 'adv-codex'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Relic codex');
  box.innerHTML = `<div class="adv-codex-inner"><header><p class="eyebrow">THE RELIC CODEX</p><h2>${seen.size} of ${relics.length} found</h2><button type="button" class="adv-codex-close">Back</button></header><div class="adv-codex-grid">${relics.map(u => { const k = seen.has(u.id); return `<article class="relic ${k ? '' : 'unknown'}" data-rarity="${u.rarity || 'common'}"><img src="${icon(u.id)}" alt=""><div><small>${RARITY_LABEL[u.rarity || 'common']}</small><h3>${k ? u.name : '???'}</h3><p>${k ? u.description : 'Find it on the road to learn what it does.'}</p>${k && u.flavor ? `<em>${u.flavor}</em>` : ''}</div></article>`; }).join('')}</div></div>`;
  document.body.append(box); const close = () => { box.remove(); removeEventListener('keydown', esc, true); }; const esc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  box.querySelector('.adv-codex-close').onclick = close; box.onclick = e => { if (e.target === box) close(); }; addEventListener('keydown', esc, true);
}

// ---------- the intro: the road out of the tavern ----------
function savedRun() {
  try { const raw = JSON.parse(localStorage.getItem('scraps.rogue-run') || 'null'), s = typeof raw === 'string' ? JSON.parse(raw) : raw; const cp = s?.checkpoint; if (!cp) return null;
    return {depth: cp.depth | 0, score: cp.totalScore | 0, relics: Object.entries(cp.inventory || {}).filter(([, n]) => n > 0).map(([id]) => id)}; } catch { return null; }
}
function setup(host) {
  document.body.dataset.scene = 'solo';
  let best = 0; try { best = JSON.parse(localStorage.getItem('scraps.ledger') || '{}').climbDepth | 0; } catch {}
  const panel = host.querySelector('.rogue-setup'); if (!panel || panel.querySelector('.adv-biomes')) return;
  panel.insertAdjacentHTML('afterbegin', `<div class="adv-biomes">${BIOMES.map(b => { const seen = best >= b.from; return `<figure class="${seen ? 'seen' : 'unseen'}" style="--bg:url(${backdrop(b)});--acc:${b.accent}"><figcaption>${seen ? b.name.replace('The ', '') : '???'}</figcaption><small>from ${b.from || 1}</small></figure>`; }).join('')}</div>`);
  if (best) panel.querySelector('h2')?.insertAdjacentHTML('afterend', `<p class="adv-best">Furthest: <b>${best}</b> · ${biomeAt(best).name}</p>`);
  const log = readLog(); if (log.length) panel.querySelector('#rogue-save-status')?.insertAdjacentHTML('beforebegin', logHTML(log));
}

// ---------- encounter intro banner, and the end of the road ----------
let lastPhase = '';
function banner(v, b) {
  const box = document.createElement('div'); box.className = 'adv-banner'; box.style.setProperty('--acc', b.accent);
  const what = v.opponent ? `Duel · ${v.opponent.difficulty} rival` : 'Hold the line';
  box.innerHTML = `<small>${b.name.toUpperCase()}</small><strong>Encounter ${v.encounter?.depth ?? v.depth + 1}</strong><span>${what}</span>`;
  document.body.append(box); setTimeout(() => box.remove(), 2400);
}
globalThis.scrapsAdventure = {setup, screen, biomeAt, backdrop, BIOMES, openCodex};
