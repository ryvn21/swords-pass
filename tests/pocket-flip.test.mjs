import test from 'node:test';
import assert from 'node:assert/strict';
import {rotateLimited, cells, grid, block, W} from '../dist/engine.js';

const pair = [{color: 0, kind: 'block'}, {color: 1, kind: 'block'}];

test('a vertical pair in a pocket swaps its colours in place, never popping up or out', () => {
  const b = grid(); for (let y = 0; y < 3; y++) { b[y][1] = block(2); b[y][3] = block(3); }   // a 1-wide pocket in column 2
  const piece = {x: 2, y: 0, r: 0, pair};                                                       // bottom block at row 0, partner above
  const before = cells(piece).map(c => [c.x, c.y].join()).sort();
  const r = rotateLimited(b, piece, 1, true, 2);
  assert.ok(r); assert.equal(r.kicked, false);
  assert.deepEqual(cells(r.piece).map(c => [c.x, c.y].join()).sort(), before);                   // same two cells
  assert.notEqual(cells(r.piece).find(c => c.y === 0).cell.color, 0);                           // colours swapped
});

test('kicks stop after the limit: a flip that needs a shift is refused once none are left', () => {
  const b = grid();
  const piece = {x: W - 1, y: 4, r: 0, pair};                                                   // against the right wall, partner above
  const withKick = rotateLimited(b, piece, 1, true, 2);                                          // turning right needs a shift left
  assert.ok(withKick?.kicked);
  const noKicks = rotateLimited(b, piece, 1, true, 0);
  assert.ok(!noKicks || !noKicks.kicked);                                                        // only an in-place swap, or nothing
});
