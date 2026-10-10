import test from 'node:test';
import assert from 'node:assert/strict';
import {handlingRules,handlingKey,HANDLING_PRESETS} from '../dist/handling-profile.js';
import {createChallenge,stepChallenge} from '../dist/challenge.js';
import {createMatch,step} from '../dist/engine.js';
test('practice and scored modes descend at the same saved slow and fast speeds',()=>{
 for(const fast of [false,true]){
  const rules=handlingRules({gravityMs:940,fastFallMs:235}),p=createMatch({mode:'practice',rules}),c=createChallenge({rules});
  for(let i=0;i<28;i++){const a=i===0&&fast?[{side:0,action:'fastOn'}]:[];step(p,1000/60,a);stepChallenge(c,1000/60,a);}
  assert.equal(c.entries[0].game.players[0].active.y,p.players[0].active.y);
  assert.equal(c.entries[0].game.players[0].fall,p.players[0].fall);
 }
});
test('handling is bounded, finite, copied and fast fall never slower than natural',()=>{
 const r=handlingRules({gravityMs:100,fastFallMs:900,lockMs:NaN,repeatMs:-3});
 assert.ok(r.fastFallMs<=r.gravityMs);assert.ok(Number.isFinite(r.lockMs));assert.ok(r.repeatMs>0);
 const c=createChallenge({rules:r});r.gravityMs=999;assert.notEqual(c.entries[0].game.rules.gravityMs,999);
 assert.equal(handlingRules({lockMs:0,entryMs:0}).lockMs,0);assert.equal(handlingRules({entryMs:0}).entryMs,0);
});
test('score identity separates different handling profiles and presets are valid',()=>{
 assert.notEqual(handlingKey({gravityMs:800}),handlingKey({gravityMs:801}));
 for(const preset of HANDLING_PRESETS)assert.deepEqual(handlingRules(preset.rules),preset.rules);
});

test('everyone moves onto the Default timings once, with their own kept as a custom scheme', async () => {
  const {migrateToHouse, HOUSE_RULES} = await import('../dist/handling-profile.js');
  const {DEFAULT_RULES} = await import('../dist/engine.js');
  const moved = migrateToHouse({houseVersion: 3, keys: {drop: ['g']}, rules: {...DEFAULT_RULES, gravityMs: 900, repeatMs: 72}});
  for (const k of Object.keys(HOUSE_RULES)) assert.equal(moved.rules[k], HOUSE_RULES[k], k);
  assert.equal(moved.houseVersion, 5); assert.equal(moved.useDefaultTimings, true); assert.deepEqual(moved.keys, {drop: ['g']});
  assert.equal(moved.customRules.gravityMs, 900); assert.equal(moved.customRules.repeatMs, 72);
  const mine = {...moved, useDefaultTimings: false, rules: {...moved.rules, gravityMs: 800}};
  assert.equal(migrateToHouse(mine).rules.gravityMs, 800);   // runs only once
});

test('the Default timings: 4 s natural fall, 50 ms landing window, 50 ms Space, no early press, 433 ms strike fall, 300/142 ms held moves', async () => {
  const {HOUSE_RULES} = await import('../dist/handling-profile.js');
  const r = HOUSE_RULES;
  assert.deepEqual([r.gravityMs, r.lockMs, r.fastFallMs, r.dropBufferMs, r.attackMs, r.settleMs, r.waveMs, r.clearMs, r.repeatDelayMs, r.repeatMs], [4000, 50, 50, 0, 433, 33, 75, 250, 300, 142]);
});

test('v5: players on their own timings are moved back onto the Default once; their scheme is kept, keys untouched', async () => {
  const {migrateToHouse, HOUSE_RULES} = await import('../dist/handling-profile.js');
  const moved = migrateToHouse({houseVersion: 4, useDefaultTimings: false, keys: {drop: ['g']}, rules: {...HOUSE_RULES, gravityMs: 1200}, customRules: {gravityMs: 1200}});
  assert.equal(moved.useDefaultTimings, true); assert.equal(moved.rules.gravityMs, HOUSE_RULES.gravityMs);
  assert.equal(moved.customRules.gravityMs, 1200); assert.deepEqual(moved.keys, {drop: ['g']});
});

test('held left/right: a step at once, again after the delay, then every repeat; and at once on a new pair while held', async () => {
  const {heldStep, pairKey} = await import('../dist/handling-profile.js');
  const rules = {repeatDelayMs: 300, repeatMs: 142}, p = {phase: 'fall', active: {}, nextIndex: 1};
  const h = {action: 'left', next: 300, pair: pairKey(p)};          // pressed at 0 with a pair falling: the press itself moved
  const at = t => heldStep(h, p, t, rules);
  assert.equal(at(100), false); assert.equal(at(300), true); assert.equal(at(400), false); assert.equal(at(442), true);
  p.phase = 'clear'; assert.equal(at(700), false);                  // no pair: nothing
  p.phase = 'fall'; p.nextIndex = 2; assert.equal(at(720), true);   // the new pair moves the moment it appears
  assert.equal(at(900), false); assert.equal(at(1020), true);
  const early = {action: 'right', next: 300, pair: pairKey({phase: 'settle'})};
  assert.equal(heldStep(early, {phase: 'fall', active: {}, nextIndex: 5}, 50, rules), true);   // pressed before the pair existed
});
