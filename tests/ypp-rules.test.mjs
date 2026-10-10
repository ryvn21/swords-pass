import test from 'node:test';
import assert from 'node:assert/strict';
import {rotateYPP, attackSchedule, grid, block, cells, H} from '../dist/engine.js';

const pair = [block(0), block(1)];
test('YPP rotation is radial: the pivot stays put and the partner orbits it', () => {
  const b = grid(), p = {x: 2, y: 5, r: 0, pair};
  for (const [dir, r] of [[1, 1], [-1, 3]]) { const q = rotateYPP(b, p, dir, 2, false).piece; assert.equal(q.x, 2); assert.equal(q.y, 5); assert.equal(q.r, r); }
});
test('YPP rotation: in place, then right, then left; then the next 90°', () => {
  const b = grid(); b[5][3] = block(2);                         // partner can't go right of (2,5)
  const q = rotateYPP(b, {x: 2, y: 5, r: 0, pair}, 1, 2, false).piece;
  assert.deepEqual([q.x, q.y, q.r], [1, 5, 1]);                  // in place and one right are blocked, one left fits
  assert.ok(cells(q).every(c => !b[c.y]?.[c.x]));
});
test('YPP popup: only when turning to point down, one row up, at most the popups left', () => {
  const b = grid(), flat = {x: 2, y: 0, r: 1, pair};             // on the floor, partner to the right
  const up = rotateYPP(b, flat, 1, 2, false);                    // cw -> pointing down: blocked by the floor -> pops
  assert.equal(up.popped, true); assert.deepEqual([up.piece.y, up.piece.r], [1, 2]);
  const none = rotateYPP(b, flat, 1, 0, false);                  // no popups left: goes on to 180° (pointing left)
  assert.equal(none.popped, false); assert.equal(none.piece.r, 3);
});
test('YPP halfway rule: past half a row the spot one row lower must be free too', () => {
  const b = grid(); b[4][3] = block(2);                          // right of the pivot, one row down
  const p = {x: 2, y: 5, r: 0, pair};
  assert.equal(rotateYPP(b, p, 1, 2, false).piece.r, 1);         // early in the row: flat right fits
  const late = rotateYPP(b, p, 1, 2, true).piece;                 // late: flat right is refused, it shifts left instead
  assert.ok(late.r !== 1 || late.x !== 2);
});
test('YPP attack timing: strikes one after another at a steady speed, then sprinkle stacks', () => {
  const s = attackSchedule([
    {kind: 'vertical', placement: {x: 0, y: 3, w: 2, h: 4}},
    {kind: 'horizontal', placement: {x: 0, y: 0, w: 6, h: 2, hand: 1}},
    {kind: 'sprinkle', placed: [{x: 1, y: 7}, {x: 2, y: 0}]}], 433);
  const row = 433 / H;
  assert.equal(s.segments[0].end, Math.round((H - 3) * row));
  assert.equal(s.segments[1].end - s.segments[1].start, Math.round(6 * row * 22.5 / 33));
  assert.equal(s.sprinkleStart, s.segments[1].end);
  assert.equal(s.total, Math.round(s.sprinkleStart + H * row));
});
