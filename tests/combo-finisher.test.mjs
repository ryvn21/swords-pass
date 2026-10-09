import test from 'node:test';
import assert from 'node:assert/strict';
import {createComboLog, comboTotals} from '../dist/combo-log.js';
import {finisherOf, createPlayout, batchArea} from '../dist/finisher.js';
import {createMatch, step, W, H} from '../dist/engine.js';

const st = (n, swords = [], p = 0, g = 4) => ({n, g, s: swords, p});

test('a combo is one entry: steps gather under it until it ends, then a new one starts', () => {
  const log = createComboLog();
  log.step(0, st(1, [], 1)); log.step(0, st(2, [[2, 2]], 2)); log.step(1, st(1));
  assert.equal(log.entries.length, 2); assert.equal(log.entries[1].chain, 2); assert.equal(log.entries[1].steps.length, 2);
  log.close(0); log.step(0, st(1));
  assert.equal(log.entries.length, 3); assert.equal(log.entries[0].who, 0); assert.equal(log.entries[0].chain, 1);
  const t = comboTotals({steps: [st(1, [[2, 2], [2, 2]], 3), st(2, [[1, 4]], 1)]});
  assert.deepEqual(t.swords, [{w: 2, l: 2, n: 2}, {w: 1, l: 4, n: 1}]); assert.equal(t.sprinkles, 4);
});

test('finishers: a ×5 needs real swords, and one blow over three-quarters of a board counts', () => {
  const sprinkly = {chain: 6, steps: [1, 2, 3, 4, 5, 6].map(n => st(n, [], 3))};
  assert.equal(finisherOf(sprinkly), null);
  const real = {chain: 5, steps: [st(1), st(2, [[2, 2]]), st(3), st(4, [[1, 3]]), st(5)]};
  assert.equal(finisherOf(real).kind, 'combo');
  assert.equal(finisherOf({chain: 2, steps: [st(1)]}, {area: Math.ceil(W * H * .75) + 1}).kind, 'blow');
  assert.equal(batchArea([{kind: 'vertical', width: 2, length: 6}, {kind: 'sprinkle', count: 5}]), 17);
});

test('a finished match plays out without input and never changes the original', () => {
  const m = createMatch({seed: 7}); for (let i = 0; i < 400; i++) step(m, 1000 / 60, i % 9 ? [] : [{side: 0, action: 'fastOn'}]);
  m.players[1].dead = true; m.winner = 0; const before = JSON.stringify(m.players[0]);
  const po = createPlayout(m); for (let i = 0; i < 600 && !po.done; i++) po.step(1000 / 60);
  assert.ok(po.done); assert.equal(JSON.stringify(m.players[0]), before); assert.equal(po.state.winner, 0);
  assert.ok(['fall', 'entry'].includes(po.state.players[0].phase));
});
