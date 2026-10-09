import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, step, command, VERSION} from '../dist/engine.js';

// A drop pressed while an attack is landing on you counts for the next pair, however early.
test('a drop pressed during an incoming attack and held drops the next pair at once', () => {
  const m = createMatch({mode: 'duel', seed: 7, rules: {entryMs: 0, spawnGraceMs: 0, attackMs: 400, dropBufferMs: 160}});
  assert.equal(m.version, VERSION);
  const p = m.players[0];
  for (let i = 0; i < 10 && p.phase !== 'fall'; i++) step(m, 16, []);
  p.incoming.push({kind: 'batch', id: 999, sourceTurn: 0, due: p.turn + 1, attacks: [{kind: 'sprinkle', count: 3, hand: 1, id: 998, pattern: p.pattern}]});
  command(m, 0, 'fastOn');
  let guard = 0; while (p.phase !== 'attack' && guard++ < 2000) step(m, 16, []);
  assert.equal(p.phase, 'attack');
  command(m, 0, 'fastOff'); command(m, 0, 'fastOn');   // pressed early in the attack and held
  guard = 0; while (!(p.phase === 'fall' && p.active) && guard++ < 2000) step(m, 16, []);
  assert.equal(p.fast, true);
});

test('a tap during an incoming attack does not drop the next pair (no accidental double-tap drops)', () => {
  const m = createMatch({mode: 'duel', seed: 7, rules: {entryMs: 0, spawnGraceMs: 0, attackMs: 550, dropBufferMs: 160}});
  const p = m.players[0];
  for (let i = 0; i < 10 && p.phase !== 'fall'; i++) step(m, 16, []);
  p.incoming.push({kind: 'batch', id: 999, sourceTurn: 0, due: p.turn + 1, attacks: [{kind: 'sprinkle', count: 3, hand: 1, id: 998, pattern: p.pattern}]});
  command(m, 0, 'fastOn');
  let guard = 0; while (p.phase !== 'attack' && guard++ < 2000) step(m, 16, []);
  command(m, 0, 'fastOff'); command(m, 0, 'fastOn'); command(m, 0, 'fastOff');   // the second tap of a double tap
  guard = 0; while (!(p.phase === 'fall' && p.active) && guard++ < 2000) step(m, 16, []);
  assert.equal(p.fast, false);
});

test('a column filled to the top is a wall: a pair above the board cannot slide over it', async () => {
  const {fits, H} = await import('../dist/engine.js');
  const board = Array.from({length: H}, () => Array(6).fill(null));
  for (let y = 0; y < H; y++) board[y][2] = {color: 0, kind: 'block', stage: 0};
  // a fresh pair, still entering above the board, moved over the full column
  const piece = {x: 2, y: H, r: 0, entering: true, pair: [{color: 1, kind: 'block'}, {color: 1, kind: 'block'}]};
  assert.equal(fits(board, piece), false);
  assert.equal(fits(board, {...piece, x: 3}), true);
});

test('with no early-press window (the Default timings), Space never carries over: you press again', () => {
  const m = createMatch({mode: 'duel', seed: 7, rules: {entryMs: 0, spawnGraceMs: 0, attackMs: 430, dropBufferMs: 0}});
  const p = m.players[0];
  for (let i = 0; i < 10 && p.phase !== 'fall'; i++) step(m, 16, []);
  p.incoming.push({kind: 'batch', id: 999, sourceTurn: 0, due: p.turn + 1, attacks: [{kind: 'sprinkle', count: 3, hand: 1, id: 998, pattern: p.pattern}]});
  command(m, 0, 'fastOn');
  let guard = 0; while (p.phase !== 'attack' && guard++ < 2000) step(m, 16, []);
  command(m, 0, 'fastOff'); command(m, 0, 'fastOn');   // pressed and held through the attack
  guard = 0; while (!(p.phase === 'fall' && p.active) && guard++ < 2000) step(m, 16, []);
  assert.equal(p.fast, false);
});
