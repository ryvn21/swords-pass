import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, step, command} from '../dist/engine.js';
import {HOUSE_RULES} from '../dist/handling-profile.js';

// Speed-ups: start at 0.01 px/ms (4 s a row), +1/300 px/ms each time landed blocks reach lastCount + dropFreq,
// dropFreq 10 then trunc(+3.33): speed-ups at 10, 23, 39, 58, 80 … blocks; cap 0.25 px/ms; lock 5 ÷ speed.
test('the Default timings speed up exactly on the Puzzle-style schedule', () => {
  assert.equal(HOUSE_RULES.speedUp, true);
  const m = createMatch({mode: 'practice', seed: 3, rules: HOUSE_RULES}), p = m.players[0];
  assert.equal(p.velocity, .01);
  const steps = [];
  for (let n = 0; n < 2000 && steps.length < 10; n++) { const before = p.velocity; p.blocksSeen++; if (p.blocksSeen >= p.lastCount + p.dropFreq) { p.velocity = Math.min(.25, p.velocity + 1 / 300); p.dropFreq = Math.trunc(p.dropFreq + 3.33); p.lastCount = p.blocksSeen; } if (p.velocity !== before) steps.push(p.blocksSeen); }
  assert.deepEqual([steps[0], steps[4], steps[9]], [10, 80, 235]);
});

test('landing pairs in a real game counts two blocks each and raises the speed', () => {
  const m = createMatch({mode: 'practice', seed: 3, rules: HOUSE_RULES}), p = m.players[0];
  let guard = 0;
  while (p.stats.pieces < 6 && guard++ < 200000) { if (p.phase === 'fall' && p.active && !p.fast) command(m, 0, 'fastOn'); step(m, 16, []); if (p.dead) break; }
  assert.equal(p.blocksSeen, p.stats.pieces * 2);
  assert.ok(p.velocity > .01, 'sped up after 10 blocks');
  assert.ok(Math.abs(p.velocity - (.01 + 1 / 300)) < 1e-9);
});

test('without speed-ups the fall stays fixed', () => {
  const m = createMatch({mode: 'practice', seed: 3, rules: {...HOUSE_RULES, speedUp: false}}), p = m.players[0];
  assert.equal(p.velocity, undefined);
});
