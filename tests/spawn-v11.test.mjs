import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, command, step, block, cells, rotate, H, W, VERSION} from '../dist/engine.js';
import {createMatch as createV10} from '../dist/legacy-engine-v10.js';
import {placements} from '../dist/ai.js';
const DT = 1000 / 60;

test('v11: a new pair enters a row above the board and falls into view', () => {
  assert.equal(VERSION, 11);
  const m = createMatch({mode: 'practice'}), p = m.players[0];
  for (let i = 0; i < 5 && !p.active; i++) step(m, DT);
  assert.equal(p.active.y, H); assert.ok(cells(p.active).every(c => c.y >= H));
  assert.equal(command(m, 0, 'left'), true); assert.equal(command(m, 0, 'cw'), true);   // it can be steered while entering
  for (let i = 0; i < 400 && cells(p.active).every(c => c.y >= H); i++) step(m, DT);
  assert.ok(cells(p.active).some(c => c.y < H)); assert.equal(p.active.entering, undefined);
  assert.equal(createV10({mode: 'practice'}).version, 10);
});

test('v11: once on the board a pair can never climb back out over full columns', () => {
  const m = createMatch(), board = m.players[0].board;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x !== 3) board[y][x] = block(2);
  const p = {x: 3, y: H - 1, r: 0, pair: [block(0, true), block(3)]};
  for (const d of [-1, 1]) { const n = rotate(board, p, d, true); assert.ok(!n || cells(n).some(c => c.y < H)); }
});

test('v11: topping out is unchanged, and the AI never plans a landing above the board', () => {
  const m = createMatch({mode: 'practice'}), p = m.players[0]; p.board[H - 1][3] = block(1); p.active = null; p.phase = 'entry'; p.timer = 0;
  for (let i = 0; i < 20; i++) step(m, DT); assert.equal(p.dead, true);
  const n = createMatch(), q = n.players[0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x !== 3) q.board[y][x] = block((x + y) % 4);
  q.active = {x: 3, y: H, r: 0, entering: true, pair: [block(0, true), block(3)]};
  const options = placements(q.board, q.active);
  assert.ok(options.length && options.every(o => cells(o.piece).some(c => c.y < H)));
});
