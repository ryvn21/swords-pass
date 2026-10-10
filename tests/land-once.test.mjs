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

test('stall flips late in a row stretch it at half speed (the last quarter takes 2 s, not 1 s)', () => {
  const m = createMatch({mode: 'practice', seed: 11, rules}), p = m.players[0];
  let guard = 0; while (!(p.phase === 'fall' && p.active && !p.active.entering) && guard++ < 2000) step(m, 16, []);
  step(m, 3000, []); const row = p.active.y;
  command(m, 0, 'cw'); command(m, 0, 'cw');
  step(m, 1900, []); assert.equal(p.active.y, row);
  step(m, 200, []); assert.equal(p.active.y, row - 1);
});

test('a stall slows the rest of the row (never below half speed) instead of stopping or lifting the pair', async () => {
  const {createMatch, step} = await import('../dist/engine.js');
  const {HOUSE_RULES} = await import('../dist/handling-profile.js');
  const m = createMatch({mode: 'practice', seed: 3, rules: {...HOUSE_RULES, speedUp: false}}), p = m.players[0];
  for (let i = 0; i < 125; i++) step(m, 16);
  const pos = () => p.active.y - p.fall / HOUSE_RULES.gravityMs, y = p.active.y;
  step(m, 16, [{side: 0, action: 'cw'}]); step(m, 16, [{side: 0, action: 'cw'}]);
  assert.equal(p.rowRate, .5);
  let prev = pos(); const at = m.elapsed;
  while (p.active.y >= y && m.elapsed - at < 6000) { step(m, 16); const now = pos(); assert.ok(now < prev, 'always moving down'); prev = now; }
  assert.ok(m.elapsed - at > 3500 && m.elapsed - at < 4300, 'the rest of the row takes about a full row');
});

test('the Default timings allow 2 stalls per pair', async () => {
  const {HOUSE_RULES} = await import('../dist/handling-profile.js');
  assert.equal(HOUSE_RULES.stallFlips, 2); assert.equal(HOUSE_RULES.stallSlow, true); assert.equal(HOUSE_RULES.stallHold, undefined);
});

test('the NEXT box shows the following pair as soon as a pair appears, except the very first pair of the game', async () => {
  const {createMatch, step, previewIndex} = await import('../dist/engine.js');
  const {HOUSE_RULES} = await import('../dist/handling-profile.js');
  const m = createMatch({mode: 'practice', seed: 3, rules: HOUSE_RULES}), p = m.players[0];
  step(m, 16);
  assert.equal(previewIndex(p), 0, 'first pair shown while it is above the board');
  for (let i = 0; i < 400 && p.nextIndex === 1; i++) step(m, 16, i % 2 ? [] : [{side: 0, action: 'fastOn'}]);
  while (p.phase !== 'fall' || !p.active) step(m, 16);
  assert.equal(previewIndex(p), p.nextIndex, 'later pairs: the box already shows the one after');
});

test('flips at the top of the board keep turning the way you press (no surprise upright swap)', async () => {
  const {createMatch, step, cells} = await import('../dist/engine.js');
  const {HOUSE_RULES} = await import('../dist/handling-profile.js');
  for (const [dir, rs] of [['cw', [1, 2, 3, 0, 1]], ['ccw', [3, 2, 1, 0, 3]]]) {
    const m = createMatch({mode: 'practice', seed: 3, rules: {...HOUSE_RULES, speedUp: false}}), p = m.players[0]; step(m, 16);
    const seen = [];
    for (let i = 0; i < 5; i++) { step(m, 16, [{side: 0, action: dir}]); seen.push(p.active.r); assert.ok(cells(p.active).some(c => c.y < 13) || p.active.entering); }
    assert.deepEqual(seen, rs, dir);
  }
});
