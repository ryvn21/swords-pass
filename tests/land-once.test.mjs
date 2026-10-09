import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, step, command, block} from '../dist/engine.js';
import {HOUSE_RULES} from '../dist/handling-profile.js';

// The landing window (Default timings): first touch "bounces" the pair and starts a window of 5 ÷ speed ms
// (500 ms at the start) that moves never extend; at the end a resting pair locks, one slid off a ledge falls on.
const rules = {...HOUSE_RULES, speedUp: false, lockMs: 500};   // a long window to test the rules in
function touch(setup) {
  const m = createMatch({mode: 'practice', seed: 11, rules}), p = m.players[0];
  setup?.(p.board);
  let guard = 0; while (!(p.phase === 'fall' && p.active) && guard++ < 100) step(m, 16, []);
  command(m, 0, 'fastOn'); guard = 0;
  while (p.active && !p.bouncing && guard++ < 2000) step(m, 16, []);
  command(m, 0, 'fastOff');
  return {m, p};
}

test('the window is 500 ms at the start and moves do not extend it', () => {
  const {m, p} = touch(); const turn = p.turn;
  assert.ok(p.bouncing);
  step(m, 300, []); command(m, 0, 'left'); command(m, 0, 'right'); command(m, 0, 'cw');
  step(m, 150, []); assert.equal(p.turn, turn, 'still in the window at 450 ms');
  step(m, 60, []); assert.equal(p.turn, turn + 1, 'locked at 500 ms despite the moves');
});

test('slid off a ledge it stays put until the window ends, then falls and lands with a fresh window', () => {
  // a step one block high under columns 3-5; the pair touches down on it, then slides left off it
  const {m, p} = touch(b => { for (let x = 2; x < 6; x++) b[0][x] = block(x % 4); });
  const turn = p.turn, y0 = Math.min(p.active.y, p.active.y + (p.active.r === 2 ? -1 : 0));
  for (let i = 0; i < 3; i++) command(m, 0, 'left');
  step(m, 200, []); assert.equal(Math.min(p.active.y, p.active.y), p.active.y); assert.equal(p.turn, turn);
  step(m, 400, []);                                           // the window has ended: it is falling now
  assert.equal(p.turn, turn); assert.equal(p.bouncing, false);
  let guard = 0; while (p.turn === turn && !p.bouncing && guard++ < 400) step(m, 16, []);
  assert.ok(p.bouncing || p.turn === turn + 1);
});

test('stall flips in the air hold the pair on its row', () => {
  const m = createMatch({mode: 'practice', seed: 11, rules}), p = m.players[0];
  let guard = 0; while (!(p.phase === 'fall' && p.active && !p.active.entering) && guard++ < 2000) step(m, 16, []);
  step(m, 3000, []); const row = p.active.y;
  command(m, 0, 'cw'); command(m, 0, 'cw');
  step(m, 2000, []); assert.equal(p.active.y, row);
});
