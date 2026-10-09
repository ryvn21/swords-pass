import test from 'node:test';
import assert from 'node:assert/strict';
import {rotateLimited, cells, grid, block, W} from '../dist/engine.js';

const pair = [{color: 0, kind: 'block'}, {color: 1, kind: 'block'}];
const pocket = () => { const b = grid(); b[0][1] = block(2); b[0][3] = block(3); return b; };   // one row deep: a pop clears it

test('in a pocket an upright pair pops up a row while pops are left, then swaps in place (no kick, still flips)', () => {
  const piece = {x: 2, y: 0, r: 0, pair};
  const popped = rotateLimited(pocket(), piece, 1, true, 2);
  assert.ok(popped?.popped);
  const swapped = rotateLimited(pocket(), piece, 1, true, 0);
  assert.ok(swapped && !swapped.popped);
  assert.deepEqual(cells(swapped.piece).map(c => [c.x, c.y].join()).sort(), cells(piece).map(c => [c.x, c.y].join()).sort());
  assert.notEqual(cells(swapped.piece).find(c => c.y === 0).cell.color, 0);
});

test('a flip against a wall is nudged sideways without using a pop', () => {
  const r = rotateLimited(grid(), {x: W - 1, y: 4, r: 0, pair}, 1, true, 0);
  assert.ok(r && !r.popped); assert.ok(cells(r.piece).every(c => c.x >= 0 && c.x < W));
});

test('in a deep pocket a flip never jumps over the walls: it swaps in place', () => {
  const b = grid(); for (let y = 0; y < 3; y++) { b[y][1] = block(2); b[y][3] = block(3); }
  const r = rotateLimited(b, {x: 2, y: 0, r: 0, pair}, 1, true, 2);
  assert.ok(r && !r.popped); assert.ok(cells(r.piece).every(c => c.x === 2));
});
