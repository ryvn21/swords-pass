import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMED,equippedSword} from '../dist/swords.js';
import {validatePattern} from '../dist/engine.js';
import {readLibrary,libraryPatterns} from '../dist/pattern-library.js';
test('themed blades are valid built-in patterns, listed before your own',()=>{
 assert.equal(THEMED.length,12);for(const p of THEMED){assert.ok(validatePattern(p.rows),p.id);assert.equal(equippedSword(p.id).id,p.id);}
 const lib=readLibrary({version:1,patterns:[{id:'custom-a',name:'Mine',rows:THEMED[0].rows}],hidden:['frostfang']}),all=libraryPatterns(lib);
 assert.ok(all.some(p=>p.id==='emberbrand'));assert.ok(!all.some(p=>p.id==='frostfang'));assert.equal(all.at(-1).id,'custom-a');
});
