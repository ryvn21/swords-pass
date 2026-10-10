import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PATTERNS,ENAMELS,swordRows,equippedSword} from '../dist/swords.js';
import {swordIcon} from '../dist/sword-art.js';
import {grid,applyAttack,createMatch,validatePattern} from '../dist/engine.js';
const reference=JSON.parse(fs.readFileSync(new URL('./fixtures/mantid-swords.json',import.meta.url)));
test('rack contains exactly the requested swords, two preserved legacy blades and Custom',()=>{
 assert.equal(PATTERNS.length,20);assert.equal(new Set(PATTERNS.map(p=>p.id)).size,20);
 assert.deepEqual(PATTERNS.slice(2,-1).map(p=>p.name),reference.swords.map(p=>p.name));
 assert.deepEqual(PATTERNS[0].rows,[[1,1,1,2,2,1],[1,2,2,1,1,1],[3,2,2,1,1,3],[3,3,0,0,3,3],[3,3,0,0,3,3],[3,1,1,2,2,3]]);
 assert.deepEqual(PATTERNS[1].rows,[[1,1,2,2,0,0],[1,0,2,3,3,0],[3,0,0,1,3,2],[3,3,1,1,2,2]]);
 for(const p of PATTERNS){assert.ok(validatePattern(p.rows));assert.ok(swordIcon(p.id).includes('<svg'));}
 assert.equal(new Set(PATTERNS.map(p=>swordIcon(p.id))).size,20);
});
test('all 17 patterns and 64 enamel combinations match the captured Mantid data',()=>{
 const chars=['r','y','g','b'];assert.deepEqual(ENAMELS,reference.colourOptions);
 for(const sword of reference.swords)for(let guard=0;guard<8;guard++)for(let grip=0;grip<8;grip++){
  const rows=swordRows(sword.id,guard,grip),p=sword.id===127?0:guard,s=sword.id===127?0:grip;
  for(let y=0;y<rows.length;y++)for(let x=0;x<6;x++){
   const sourceX=[3,4,5].includes(p)?5-x:x;
   const slot=sword.pattern[(rows.length-1-y)*6+sourceX];
   assert.equal(chars[rows[y][x]],reference.colour_list[p][s][slot-1],`${sword.name} ${guard}/${grip} ${x}/${y}`);
  }
 }
});
test('known default Foil and mirrored green Foil orientation',()=>{
 assert.deepEqual(swordRows(0),[[0,0,2,2,3,3],[0,0,2,2,3,3],[2,2,3,3,1,1],[2,2,3,3,1,1]]);
 assert.deepEqual(swordRows(0,3,0)[0],[3,3,2,2,0,0]);
});
test('equipped colours are used by real vertical, horizontal and sprinkle attacks',()=>{
 for(const sword of PATTERNS){
  const p=equippedSword(sword.id,{primary:4,secondary:2}),state=createMatch({pattern:p.rows});
  assert.deepEqual(state.players[0].pattern,p.rows);
  const vertical=grid(),v=applyAttack(vertical,{kind:'vertical',width:2,length:10,index:0,hand:1,id:1},state.players[0].pattern);
  for(let i=0;i<10;i++)for(let dx=0;dx<2;dx++)assert.equal(vertical[v.placement.y+i][v.placement.x+dx].color,p.rows[i<p.rows.length?i:p.rows.length-Math.min(4,p.rows.length)+(i-p.rows.length)%Math.min(4,p.rows.length)][v.placement.x+dx]);
  for(const hand of [-1,1]){
   const b=grid(),hit=applyAttack(b,{kind:'horizontal',width:2,length:6,index:0,hand,id:2},p.rows);
   assert.equal(hit.converted,false);
   for(let i=0;i<6;i++){const row=i<p.rows.length?i:p.rows.length-Math.min(4,p.rows.length)+(i-p.rows.length)%Math.min(4,p.rows.length);for(let dy=0;dy<2;dy++)assert.equal(b[hit.placement.y+dy][hand===1?5-i:i].color,p.rows[row][hand===1?4+dy:1-dy]);}
   const sprinkles=grid();applyAttack(sprinkles,{kind:'sprinkle',count:12,hand,id:3},p.rows);
   assert.deepEqual(sprinkles.slice(0,2).map(row=>row.map(c=>c.color)),p.rows.slice(0,2));
  }
 }
});
test('removed selections fall back, custom survives, fixed blades ignore enamel',()=>{
 assert.equal(equippedSword('ember').id,'forgotten-falchion');
 const custom={id:'custom',name:'Mine',rows:swordRows(3)};assert.deepEqual(equippedSword('custom',{custom}).rows,custom.rows);
 for(const id of ['sinners-saber','forgotten-falchion','stick'])assert.deepEqual(equippedSword(id,{primary:7,secondary:4}).rows,equippedSword(id).rows);
 assert.throws(()=>swordRows(999));assert.throws(()=>swordRows(0,-1));
});
