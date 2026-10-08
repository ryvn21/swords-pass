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

test('saved timing setups switch to the house presets once; later changes stay', async () => {
  const {migrateToHouse, HOUSE_RULES} = await import('../dist/handling-profile.js');
  const {DEFAULT_RULES} = await import('../dist/engine.js');
  const moved = migrateToHouse({houseVersion: 1, keys: {drop: ['g']}, rules: {...DEFAULT_RULES, gravityMs: 900, repeatMs: 72}});
  for (const k of Object.keys(HOUSE_RULES)) assert.equal(moved.rules[k], HOUSE_RULES[k], k);
  assert.equal(moved.houseVersion, 2); assert.deepEqual(moved.keys, {drop: ['g']});
  assert.equal(migrateToHouse({...moved, rules: {...moved.rules, gravityMs: 800}}).rules.gravityMs, 800);   // runs only once
});
