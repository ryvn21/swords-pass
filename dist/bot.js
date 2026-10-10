// The new bots. A separate brain from ai.js (which still drives older modes and saved Adventure runs, so their
// replays stay identical). Three parts:
//   reach     every spot the pair can really get to under the match's own rules (YPP flips and popups included),
//             with the key presses to get there
//   judge     scores a board: danger, shape, colour links, blocks, how big a combo is waiting, what an incoming attack
//             would do, and what was just sent, weighted by the blade's strategy (blade-strategy.js) and the bot's style
//   drive     presses keys at the bot's own pace, steering to its chosen spot and re-steering if the pair drifts
// Strength is a tier from 1 (fumbling) to 10 (ruthless); style picks how it plays; the blade picks what it plays for.
import {W,H,clone,cells,landing,move,rotate,rotateYPP,rotateLimited,resolve,gemRects,decay,applyAttackBatch,command,pairAt} from './engine.js';
import {strategyFor} from './blade-strategy.js';

// ---------------- reach ----------------
const keyOf = p => p.x + ',' + p.y + ',' + p.r;
function turn(board, p, dir, rules, kicks) {
  if (rules.yppRotate) { const r = rotateYPP(board, p, dir, (rules.kickLimit ?? 2) - kicks, false); return r && {piece: r.piece, kicks: kicks + (r.popped ? 1 : 0)}; }
  if (rules.kickLimit != null) { const r = rotateLimited(board, p, dir, rules.wellFlip === true, rules.kickLimit - kicks, rules.topTuck === true); return r && {piece: r.piece, kicks: kicks + (r.popped ? 1 : 0)}; }
  const q = rotate(board, p, dir, rules.wellFlip === true, rules.topTuck === true); return q && {piece: q, kicks};
}
// Breadth-first over moves and flips made where the pair is now (bots act fast enough that it barely falls meanwhile;
// the driver re-steers if it does). Returns one entry per distinct landing spot, with the shortest key sequence.
export function reach(board, active, rules = {}, kicks = 0) {
  const start = {...active}, queue = [{p: start, k: kicks, path: []}], seen = new Set([keyOf(start) + ':' + kicks]), out = new Map();
  for (let i = 0; i < queue.length && i < 600; i++) {
    const {p, k, path} = queue[i], end = landing(board, p), ek = keyOf(end);
    if (!out.has(ek) && cells(end).some(c => c.y < H)) out.set(ek, {piece: end, path});
    for (const a of ['left', 'right', 'cw', 'ccw']) {
      let n = null, nk = k;
      if (a === 'left') n = move(board, p, -1, 0); else if (a === 'right') n = move(board, p, 1, 0);
      else { const r = turn(board, p, a === 'cw' ? 1 : -1, rules, k); if (r) { n = r.piece; nk = r.kicks; } }
      if (!n) continue; const key = keyOf(n) + ':' + nk; if (seen.has(key)) continue; seen.add(key); queue.push({p: n, k: nk, path: [...path, a]});
    }
  }
  return [...out.values()];
}

// ---------------- judge ----------------
function settle(board, piece) { const b = clone(board); for (const {x, y, cell} of cells(piece)) if (y < H) b[y][x] = clone(cell); decay(b, false); const attacks = resolve(b); return {board: b, attacks}; }
// what a set of attacks is worth to this blade: swords by area (its strikes), sprinkles (its sprinkles), combos on top
export function power(attacks, s) {
  let v = 0;
  for (const a of attacks) { v += a.swords.reduce((n, w) => n + w.width * w.length, 0) * 3 * (.4 + s.strike) + a.sprinkles * 2.2 * (.3 + s.sprinkle) + Math.max(0, a.chain - 1) * 18; }
  return v;
}
function shape(board, o) {
  if (board[H - 1][3]) return {dead: true, v: -1e6, top: H};
  let v = 0, top = 0; const hs = [];
  for (let x = 0; x < W; x++) {
    let h = 0;
    for (let y = 0; y < H; y++) { const c = board[y][x]; if (!c) continue; h = y + 1;
      if (c.stage) { v -= 2.5; continue; }
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const n = board[y + dy]?.[x + dx]; if (n && !n.stage && n.color === c.color) v += 1.6 * o.link; }
      if (c.breaker) { let buried = 0; for (let yy = y + 1; yy < H; yy++) if (board[yy][x]) buried++; v += buried ? -buried * 2.2 : 1.5; }
    }
    hs.push(h); top = Math.max(top, h);
    for (let y = 0; y < h; y++) if (!board[y][x]) v -= 7;
    const risk = o.risk;                       // gamblers stack higher before they worry
    v -= (h * 1.6 + Math.max(0, h - 6 - risk * 3) ** 2 * 5) * o.safety;
    if (x === 3) v -= (h * 2 + Math.max(0, h - 7 - risk * 2) ** 2 * 14) * o.safety;
  }
  for (let x = 1; x < W; x++) v -= Math.abs(hs[x] - hs[x - 1]) * .7;
  for (const g of gemRects(board)) v += (g.w * g.h * 2.2 + Math.min(g.w, g.h) * 2) * o.build;
  return {dead: false, v, top};
}
// How big a combo is sitting on the board, waiting for the right breaker: try a lone breaker of each colour on top of
// each column and keep the best result.
export function potential(board, s) {
  let best = 0;
  for (let x = 0; x < W; x++) {
    let y = 0; while (y < H && board[y][x]) y++; if (y >= H - 1) continue;
    const near = new Set([board[y - 1]?.[x], board[y][x - 1], board[y][x + 1]].filter(c => c && !c.stage).map(c => c.color));   // only colours it would touch
    for (const c of near) {
      const b = clone(board); b[y][x] = {color: c, breaker: true, stage: 0}; const atk = resolve(b);
      if (atk.length) best = Math.max(best, power(atk, s));
    }
  }
  return best;
}
export function judge(board, attacks, ctx) {
  const {o, s, incoming} = ctx, sh = shape(board, o); if (sh.dead) return -1e6;
  let v = sh.v;
  const sent = power(attacks, s);
  v += sent * o.attack * (.55 + s.tempo * .9);                                         // spend now: tempo blades love it
  if (o.lookCombo) v += potential(board, s) * o.hold * (1.25 - s.tempo) * .5;           // keep a combo loaded: patient blades love it
  if (incoming?.length) { try { const b = clone(board); applyAttackBatch(b, incoming); const after = shape(b, o); v += after.dead ? -4e4 : (after.v - sh.v) * .5 * o.wary; } catch {} }
  return v;
}

// ---------------- tiers and styles ----------------
// tier 1..10: how fast it reacts and presses, how far it looks, how often it misjudges
// tiers 11-12 are the ultras: beyond human hands (a press every frame or two, near-instant reads, wide lookahead)
export function tierParams(tier) {
  if (tier >= 11) { const u = tier >= 12; return {tier: u ? 12 : 11, thinkMs: u ? 0 : 40, actionMs: u ? 17 : 25, noise: 0, blunder: 0, depth: 2, beam: u ? 24 : 18, lookCombo: true, readIncoming: true, fastDrop: true}; }
  const t = Math.max(1, Math.min(10, tier)), k = (t - 1) / 9;
  return {
    tier: t,
    thinkMs: Math.round(1100 - k * 1020),     // 1100 ms .. 80 ms before the first press
    actionMs: Math.round(230 - k * 195),      // 230 ms .. 35 ms between presses
    noise: (1 - k) ** 1.6 * 38,               // misjudgement on each option's score
    blunder: t <= 3 ? .22 - (t - 1) * .07 : 0, // now and then just take a worse spot
    depth: t >= 5 ? 2 : 1, beam: Math.round(4 + k * 10),
    lookCombo: t >= 4, readIncoming: t >= 6, fastDrop: t >= 5,
  };
}
export const STYLES = {
  balanced: {name: 'Balanced', attack: 1, hold: 1, build: 1, link: 1, safety: 1, risk: 0, wary: 1},
  rusher: {name: 'Rusher', attack: 1.6, hold: .35, build: .6, link: .8, safety: .9, risk: 0, wary: .6},
  builder: {name: 'Builder', attack: .8, hold: 1.1, build: 1.8, link: 1.1, safety: 1, risk: .3, wary: 1},
  chainer: {name: 'Chainer', attack: .7, hold: 1.8, build: .9, link: 1.4, safety: 1, risk: .4, wary: 1},
  counter: {name: 'Counter', attack: 1.1, hold: 1.2, build: 1, link: 1.1, safety: 1.2, risk: -.3, wary: 1.8},
  gambler: {name: 'Gambler', attack: 1, hold: 1.6, build: 1.3, link: 1.2, safety: .6, risk: 1.5, wary: .4},
  wall: {name: 'Wall', attack: .9, hold: .7, build: .8, link: 1, safety: 1.6, risk: -.6, wary: 1.6},
};
export function makeBot({tier = 5, style = 'balanced', blade = 'short-sword', seed = 1} = {}) {
  const T = tierParams(tier), o = {...STYLES.balanced, ...(STYLES[style] || {}), lookCombo: T.lookCombo};
  return {T, o, s: strategyFor(blade), style, blade, rng: (seed >>> 0) || 1, pair: -1, target: null, at: 0, dropped: false};
}
const rand = bot => ((bot.rng = Math.imul(bot.rng ^ (bot.rng >>> 15), 2246822507) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
const gauss = bot => { let u = 0; for (let i = 0; i < 4; i++) u += rand(bot); return (u - 2) / .577; };

// choose where this pair goes
export function decide(bot, {board, active, nextPair, incoming = [], rules = {}, kicks = 0}) {
  const {T, o, s} = bot, ctx = {o, s, incoming: T.readIncoming ? incoming : null};
  const opts = reach(board, active, rules, kicks).map(c => { const sim = settle(board, c.piece); return {...c, ...sim, score: judge(sim.board, sim.attacks, ctx) - c.path.length * .02}; });
  if (!opts.length) return null;
  opts.sort((a, b) => b.score - a.score);
  if (T.depth > 1 && nextPair) {
    const top = opts.slice(0, T.beam), ctx2 = {...ctx, o: {...o, lookCombo: false}, incoming: null};   // the second pair: shape and what it sends only (the first already weighed the combo waiting)
    for (const c of top) { if (c.score < -9e5) continue; let best = -1e6;
      for (const n of reach(c.board, {x: 3, y: H, r: 0, entering: true, pair: nextPair}, rules)) { const sim = settle(c.board, n.piece); best = Math.max(best, judge(sim.board, sim.attacks, ctx2)); }
      c.score = c.score * .45 + best * .55 + power(c.attacks, s) * o.attack * .25; }
    opts.splice(0, T.beam, ...top.sort((a, b) => b.score - a.score));
  }
  for (const c of opts) c.score += gauss(bot) * T.noise;
  opts.sort((a, b) => b.score - a.score);
  let pickI = 0; if (T.blunder && rand(bot) < T.blunder) pickI = Math.min(opts.length - 1, 1 + Math.floor(rand(bot) * 3));
  const c = opts[pickI]; return {piece: c.piece, path: c.path, score: c.score};
}

// ---------------- drive ----------------
const samePlace = (a, b) => { const A = cells(a).map(c => c.x + ',' + c.y + ',' + c.cell.color).sort().join(), B = cells(b).map(c => c.x + ',' + c.y + ',' + c.cell.color).sort().join(); return A === B; };
// Call every tick for the bot's side. Presses at most one key per actionMs, after thinkMs on each new pair.
export function stepBot(game, side, bot, {dt = 1000 / 60} = {}) {
  const p = game.players[side]; if (p.dead || game.winner !== null || p.phase !== 'fall' || !p.active) return;
  const now = game.elapsed;
  if (bot.pair !== p.nextIndex) {
    bot.pair = p.nextIndex; bot.dropped = false;
    const plan = decide(bot, {board: p.board, active: p.active, nextPair: pairAt(game.seed, p.nextIndex, game.rules.breakerRate), incoming: p.incoming[0] && (p.incoming[0].due ?? 0) <= p.turn + 1 ? p.incoming[0].attacks ?? [p.incoming[0]] : [], rules: game.rules, kicks: p.kicks ?? 0});
    bot.target = plan?.piece ?? null; bot.at = now + bot.T.thinkMs;
  }
  if (now < bot.at || !bot.target) return;
  // steer: the first key of the shortest route from where the pair is now to the chosen landing
  const route = reach(p.board, p.active, game.rules, p.kicks ?? 0).find(r => samePlace(r.piece, bot.target));
  let key = route?.path[0];
  if (!route) { const plan = decide(bot, {board: p.board, active: p.active, rules: game.rules, kicks: p.kicks ?? 0}); bot.target = plan?.piece ?? null; return; }
  if (!key) { if (bot.dropped || !bot.T.fastDrop) return; key = 'fastOn'; bot.dropped = true; }
  command(game, side, key); bot.at = now + bot.T.actionMs * (.85 + rand(bot) * .3);
}
// the next key towards a chosen landing from where the pair is now: a key, 'drop' when it's lined up, or null if the
// spot can no longer be reached (plan again)
export function steer(p, rules, target) {
  const route = reach(p.board, p.active, rules, p.kicks ?? 0).find(r => samePlace(r.piece, target));
  return route ? (route.path[0] ?? 'drop') : null;
}
