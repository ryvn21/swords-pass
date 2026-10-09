// How strong a pattern is as an attack, worked out directly from its colours (no simulation).
//
// Everything you send lands as pieces cut from your pattern: sprinkles are its bottom two rows laid
// across the board, and a sword shows the pattern's own columns at its width (1, 2 or 3 wide, rows
// repeating down its length). The receiver clears garbage by touching same-colour groups with a
// breaker, so what matters is how big those groups are: a block sitting in a group of 4 goes with
// three others for one breaker; a block on its own needs a breaker of its own.
//
// "Group" G: the average size of the same-colour group a delivered block belongs to, over every
// piece the pattern can produce, weighted by how often each arrives (sprinkles most, then narrow
// swords, then wide). Lower G = harder to clean up = stronger. Strength = 210 / G, so the
// Forgotten Falchion (the unnerfed original) sits at 90, the Falchion just under it, the Stick
// about 40. Online accepts up to ONLINE_CAP, a little above the strongest curated blade.
import {patternColor, validatePattern} from './engine.js';

export const ONLINE_CAP = 95;
const K = 210, WEIGHTS = {sprinkles: .4, narrow: .25, double: .2, wide: .15};

// mean size of the same-colour group each cell of a piece sits in
function meanGroup(g) {
  const h = g.length, w = g[0].length, seen = new Set(); let squares = 0, cells = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (seen.has(y * w + x)) continue;
    const c = g[y][x], stack = [[x, y]]; let size = 0; seen.add(y * w + x);
    while (stack.length) { const [a, b] = stack.pop(); size++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx) || g[ny][nx] !== c) continue; seen.add(ny * w + nx); stack.push([nx, ny]); } }
    squares += size * size; cells += size;
  }
  return squares / cells;
}
// the pieces a pattern produces, and their average group size
export function groupSizes(rows) {
  const piece = (x, w, len) => Array.from({length: len}, (_, o) => Array.from({length: w}, (_, dx) => patternColor(rows, x + dx, o)));
  const avg = (w, lengths) => { let s = 0, n = 0; for (const len of lengths) for (let x = 0; x + w <= 6; x++) { s += meanGroup(piece(x, w, len)); n++; } return s / n; };
  const parts = {sprinkles: meanGroup([rows[0], rows[1]]), narrow: avg(1, [4, 6, 8]), double: avg(2, [4, 6]), wide: avg(3, [4])};
  return {...parts, G: Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * parts[k], 0)};
}
const cache = new Map();
export function strength(rows) {
  if (!validatePattern(rows)) return 0;
  const key = JSON.stringify(rows); if (cache.has(key)) return cache.get(key);
  const v = Math.round(K / groupSizes(rows).G); if (cache.size > 300) cache.clear(); cache.set(key, v); return v;
}
// 2×2 same-colour squares in the pattern itself: gems handed straight to the receiver
export function giftSquares(rows) {
  let n = 0;
  for (let y = 0; y + 1 < (rows?.length || 0); y++) for (let x = 0; x + 1 < rows[y].length; x++) { const c = rows[y][x]; if (rows[y][x + 1] === c && rows[y + 1][x] === c && rows[y + 1][x + 1] === c) n++; }
  return n;
}
export const onlineLegal = rows => strength(rows) <= ONLINE_CAP;
