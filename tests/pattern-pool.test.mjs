import test from 'node:test';import assert from 'node:assert/strict';
import {poolPatterns,assignPatterns} from '../dist/pattern-pool.js';
import {PATTERNS} from '../dist/swords.js';
test('first-run and empty pools select only Falchion',()=>{for(const ids of [undefined,[],['missing']])assert.deepEqual(poolPatterns(ids,PATTERNS).map(p=>p.id),['falchion']);});
test('assignment is seeded, drawn only from ticked patterns and independent per player',()=>{const p=poolPatterns(['falchion','saber'],PATTERNS),a=assignPatterns(52,20,p);assert.deepEqual(a,assignPatterns(52,20,p));assert.ok(a.every(s=>['falchion','saber'].includes(s.id)));assert.equal(new Set(a.map(s=>s.id)).size,2);a[0].rows[0][0]=99;assert.notEqual(p[0].rows[0][0],99);});
