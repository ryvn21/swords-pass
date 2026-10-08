import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RULES,createMatch,step} from '../dist/engine.js';
import {migrateSpawnAdjustment,HANDLING_PRESETS} from '../dist/handling-profile.js';
import {createRun,startEncounter} from '../dist/rogue-run.js';
import {restoreRun,serializeRun} from '../dist/rogue-save.js';

test('new games use the cancellable pause without changing fall or landing timings',()=>{
 assert.equal(DEFAULT_RULES.spawnGraceMs,250);assert.equal(DEFAULT_RULES.gravityMs,800);assert.equal(DEFAULT_RULES.fastFallMs,200);assert.equal(DEFAULT_RULES.lockMs,350);assert.equal(DEFAULT_RULES.entryMs,60);
 for(const preset of HANDLING_PRESETS)assert.equal(preset.rules.spawnGraceMs,0);   // house setup; engine defaults above are unchanged
 const m=createMatch({mode:'practice'}),p=m.players[0];step(m,200);assert.equal(p.fall,0);step(m,75);assert.equal(p.spawnGrace,0);assert.equal(p.fall,25);
});
test('custom spawn preferences and zero survive the default migration',()=>{
 for(const value of [0,250,400,600]){const original={rules:{spawnGraceMs:value,entryMs:85,gravityMs:930},sound:false};const p=migrateSpawnAdjustment(original);assert.equal(p.rules.spawnGraceMs,value);assert.equal(original.rules.spawnGraceMs,value);assert.equal(p.rules.entryMs,85);assert.equal(p.rules.gravityMs,930);assert.equal(p.sound,false);assert.deepEqual(migrateSpawnAdjustment(p),p);}
 assert.equal(migrateSpawnAdjustment({}).rules.spawnGraceMs,250);assert.equal(migrateSpawnAdjustment({rules:{}}).rules.spawnGraceMs,250);
});
test('run saves retain captured custom timing while new defaults use 250ms',()=>{
 const r=createRun({rules:{spawnGraceMs:175}});startEncounter(r);const restored=restoreRun(serializeRun(r));assert.equal(restored.game.rules.spawnGraceMs,175);assert.equal(restored.game.players[0].spawnGrace,175);
 const next=createRun();startEncounter(next);assert.equal(next.game.rules.spawnGraceMs,250);
});
