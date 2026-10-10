import test from 'node:test';
import assert from 'node:assert/strict';
import {createClimb, choosePath, startClimb, stepClimb, retryClimb, START_LIVES} from '../dist/climb-run.js';
import {serializeClimb, restoreClimb} from '../dist/climb-save.js';

function loseOne(seed) {
  const r = createClimb({seed});
  if (r.phase === 'route') choosePath(r, r.paths[0].id);
  startClimb(r); let n = 0;
  while (r.phase === 'playing' && n++ < 20000) stepClimb(r);
  return r;
}
test('a lost encounter can be tried again three times, from where it started', () => {
  let r = null;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const x = loseOne(seed); if (x.phase === 'lost') { r = x; break; } }
  assert.ok(r, 'some seed loses its first encounter when nobody plays');
  assert.equal(r.lives, START_LIVES);
  const id = r.encounter.id, before = r.anchor.totalScore;
  retryClimb(r);
  assert.equal(r.phase, 'ready'); assert.equal(r.encounter.id, id); assert.equal(r.lives, START_LIVES - 1); assert.equal(r.totalScore, before);
  const back = restoreClimb(serializeClimb(r));                 // a save right after continuing restores the same
  assert.equal(back.lives, START_LIVES - 1); assert.equal(back.phase, 'ready'); assert.equal(back.encounter.id, id);
  for (let i = START_LIVES - 1; i > 0; i--) { startClimb(r); let n = 0; while (r.phase === 'playing' && n++ < 20000) stepClimb(r); assert.equal(r.phase, 'lost'); retryClimb(r); }
  startClimb(r); let n = 0; while (r.phase === 'playing' && n++ < 20000) stepClimb(r);
  assert.equal(r.lives, 0); assert.throws(() => retryClimb(r));
});
test('old saves without continues get three', async () => {
  const r = createClimb({seed: 1}); const text = serializeClimb(r), saved = JSON.parse(text);
  delete saved.checkpoint.lives; const {saveChecksum} = await import('../dist/climb-save.js'); const {checksum, ...body} = saved;
  const back = restoreClimb(JSON.stringify({...body, checksum: saveChecksum(body)}));
  assert.equal(back.lives, START_LIVES);
});
