// How strong a pattern is as an attack: what it hands the receiver. We land a fixed set of
// typical volleys (swords of every common size, plus sprinkles) on an empty board with the game's
// own landing rules, crack them into blocks, and count what the receiver could build from them:
// same-colour 2×2 squares (ready gems) and same-colour groups of four or more (easy breaks).
// Fewer gifts means a stronger blade. The score is scaled so the Forgotten Falchion, the strongest
// curated blade, is 100 and a gift-everything pattern is 0. Online accepts up to ONLINE_CAP.
import {W, H, grid, applyAttackBatch, horizontalBase, decay, gravity} from './engine.js';

export const ONLINE_CAP = 105;
const FALCHION = [[1,1,2,2,0,0],[1,0,2,3,3,0],[3,0,0,1,3,2],[3,3,1,1,2,2]];
const KINDS = [{kind: 'vertical', width: 1, length: 4}, {kind: 'vertical', width: 1, length: 6}, {kind: 'vertical', width: 2, length: 4}, {kind: 'vertical', width: 2, length: 6}, {kind: 'vertical', width: 3, length: 4}, {kind: 'horizontal', width: 2, length: 4}, {kind: 'horizontal', width: 2, length: 6}];
const TRIALS = 240, WORST = 6;
function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// gifts per volley: ready squares + twice the share of blocks sitting in groups of 4+
export function gifts(rows) {
  if (!Array.isArray(rows) || !rows.length) return WORST;
  const R = rng(12345); let squares = 0, grouped = 0, cells = 0;
  for (let t = 0; t < TRIALS; t++) {
    const b = grid(), attacks = [], n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const k = KINDS[Math.floor(R() * KINDS.length)], a = {...k, stage: i + 1, index: Math.floor(R() * 6), hand: R() < .5 ? 1 : -1, id: i + 1, pattern: rows}; if (a.kind === 'horizontal') a.base = horizontalBase(b, a.width); attacks.push(a); }
    attacks.push({kind: 'sprinkle', count: 4 + Math.floor(R() * 9), hand: R() < .5 ? 1 : -1, id: 99, pattern: rows});
    applyAttackBatch(b, attacks); for (let i = 0; i < 3; i++) decay(b, false); while (gravity(b, 1));
    for (let y = 0; y + 1 < H; y++) for (let x = 0; x + 1 < W; x++) { const c = b[y][x]; if (c && b[y][x + 1]?.color === c.color && b[y + 1][x]?.color === c.color && b[y + 1][x + 1]?.color === c.color) squares++; }
    const seen = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = b[y][x]; if (!c) continue; cells++; if (seen.has(y * W + x)) continue;
      let size = 0; const stack = [[x, y]]; seen.add(y * W + x);
      while (stack.length) { const [cx, cy] = stack.pop(); size++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx) || b[ny][nx]?.color !== c.color) continue; seen.add(ny * W + nx); stack.push([nx, ny]); } }
      if (size >= 4) grouped += size;
    }
  }
  return squares / TRIALS + 2 * (cells ? grouped / cells : 0);
}
const cache = new Map(), REF = gifts(FALCHION);
// 0–120ish: 100 is the Forgotten Falchion
export function strength(rows) {
  const key = JSON.stringify(rows); if (cache.has(key)) return cache.get(key);
  const v = Math.max(0, Math.round(100 * (WORST - gifts(rows)) / (WORST - REF)));
  if (cache.size > 200) cache.clear(); cache.set(key, v); return v;
}
// 2×2 same-colour squares in the pattern itself: gems handed straight to the receiver
export function giftSquares(rows) {
  let n = 0;
  for (let y = 0; y + 1 < (rows?.length || 0); y++) for (let x = 0; x + 1 < rows[y].length; x++) { const c = rows[y][x]; if (rows[y][x + 1] === c && rows[y + 1][x] === c && rows[y + 1][x + 1] === c) n++; }
  return n;
}
export const onlineLegal = rows => strength(rows) <= ONLINE_CAP;
