// How hard a pattern's colours are for the receiver to reuse. "Busyness" is the share of
// neighbouring cells (across and up) that differ in colour: a busy pattern lands as garbage
// the receiver can't turn into gems. A checkerboard scores 1.00; the curated blades 0.47–0.58.
// Online play takes any pattern up to the busiest curated blade, so a Forge creation can never
// out-garbage the game's own swords.
export const ONLINE_CAP = 0.58;
export function busyness(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let differ = 0, pairs = 0;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    if (x + 1 < rows[y].length) { pairs++; if (rows[y][x] !== rows[y][x + 1]) differ++; }
    if (y + 1 < rows.length) { pairs++; if (rows[y][x] !== rows[y + 1][x]) differ++; }
  }
  return pairs ? Math.round(differ / pairs * 100) / 100 : 0;
}
// 2×2 same-colour squares in the pattern itself: gems handed straight to the receiver
export function giftSquares(rows) {
  let n = 0;
  for (let y = 0; y + 1 < (rows?.length || 0); y++) for (let x = 0; x + 1 < rows[y].length; x++) { const c = rows[y][x]; if (rows[y][x + 1] === c && rows[y + 1][x] === c && rows[y + 1][x + 1] === c) n++; }
  return n;
}
export const onlineLegal = rows => busyness(rows) <= ONLINE_CAP + 1e-9;
