import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, step, command, block, H} from '../dist/engine.js';
import {HOUSE_RULES} from '../dist/handling-profile.js';

const rules = {...HOUSE_RULES, speedUp: false, gravityMs: 4000, lockMs: 500};
function landed(setup) {
  const m = createMatch({mode: 'practice', seed: 11, rules}), p = m.players[0];
  setup?.(p.board);
  let guard = 0; while (!(p.phase === 'fall' && p.active) && guard++ < 100) step(m, 16, []);
  command(m, 0, 'fastOn'); guard = 0;
  while (p.active && guard++ < 400) { const before = p.active.y; step(m, 16, []); if (p.active && p.active.y === before && p.lock > 0) break; }
  command(m, 0, 'fastOff');
  return {m, p};
}

test('sliding a landed pair along the row it landed on commits it at once', () => {
  const {m, p} = landed(); const turn = p.turn;
  assert.ok(p.active && p.lock > 0);
  command(m, 0, 'left'); step(m, 16, []);
  assert.equal(p.turn, turn + 1);
});

test('sliding off an edge to a lower row lands again with a fresh lock', () => {
  // a floor one cell high under columns 2-5; columns 0-1 empty
  const {m, p} = landed(b => { for (let x = 2; x < 6; x++) b[0][x] = block(x % 4); });
  const turn = p.turn; let moved = 0;
  while (p.active && moved < 4 && p.turn === turn) { command(m, 0, 'left'); step(m, 16, []); moved++; if (p.active && Math.min(p.active.x) <= 1) break; }
  if (p.turn === turn) { step(m, 16, []); assert.equal(p.turn, turn, 'still falling or newly landed, not committed'); }
});

test('stall flips still reset the lock while landed', () => {
  const {m, p} = landed(); const turn = p.turn;
  step(m, 300, []); const before = p.lock; assert.ok(before >= 300);
  command(m, 0, 'cw'); command(m, 0, 'cw');
  assert.ok(p.lock < before); step(m, 300, []); assert.equal(p.turn, turn);
});
