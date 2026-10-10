import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS} from '../dist/swords.js';
import {readLibrary,libraryPatterns,savePattern,deletePattern} from '../dist/pattern-library.js';
const rows=()=>Array.from({length:4},()=>[0,1,2,3,0,1]);
test('legacy corrections match the user images (Sinner’s Saber mirrored again on request)',()=>{
 // Literal expected TOP-to-bottom cells, derived from the supplied images.
 const letters=p=>[...p.rows].reverse().map(row=>row.map(c=>'RYGB'[c]).join(''));
 assert.deepEqual(letters(PATTERNS[0]),['BYYGGB','BBRRBB','BBRRBB','BGGYYB','YGGYYY','YYYGGY']);
 assert.deepEqual(letters(PATTERNS[1]),['BBYYGG','BRRYBG','YRGBBR','YYGGRR']);
});
test('migration removes only the old custom Forgotten Falchion',()=>{
 assert.equal(readLibrary(null,{name:'Forgotten Falchion',rows:rows()}).patterns.length,0);
 const migrated=readLibrary(null,{name:'My blade',rows:rows()});assert.equal(migrated.patterns[0].id,'custom-legacy');
 assert.equal(migrated.patterns[0].name,'My blade');
 assert.equal(readLibrary(migrated,{name:'Old duplicate',rows:rows()}).patterns.length,1);
});
test('multiple patterns save independently, update by stable id, and delete without changing others',()=>{
 let library=readLibrary(null);library=savePattern(library,{id:'custom-a',name:'A',rows:rows(),iconId:'katana'});
 library=savePattern(library,{id:'custom-b',name:'B',rows:rows(),iconId:'foil'});
 library=savePattern(library,{id:'custom-a',name:'Renamed',rows:rows(),iconId:'dadao'});
 assert.equal(library.patterns.length,2);assert.equal(library.patterns[0].name,'Renamed');
 library=deletePattern(library,'custom-a');assert.deepEqual(library.patterns.map(p=>p.id),['custom-b']);
 assert.equal(libraryPatterns(library).at(-1).id,'custom-b');
});
test('removing a built-in changes the rack without mutating the catalogue',()=>{
 const library=deletePattern(readLibrary(null),'forgotten-falchion');
 assert.ok(!libraryPatterns(library).some(p=>p.id==='forgotten-falchion'));
 assert.ok(PATTERNS.some(p=>p.id==='forgotten-falchion'));
 assert.ok(libraryPatterns({...library,hidden:[]}).some(p=>p.id==='forgotten-falchion'));
});
test('library validation rejects invalid cells, ids and duplicate identities',()=>{
 assert.throws(()=>savePattern(readLibrary(null),{id:'foil',name:'Bad',rows:rows()}));
 const valid={id:'custom-a',name:'A',rows:rows()};
 assert.equal(readLibrary({version:1,patterns:[valid,valid,{...valid,id:'custom-b',rows:[[9]]}],hidden:['unknown','foil']}).patterns.length,1);
 assert.deepEqual(readLibrary({version:1,patterns:[],hidden:['unknown','foil']}).hidden,['foil']);
});
