import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
const sword=(id,stage,length=13)=>({kind:'vertical',width:2,length,index:id+3,hand:id%2?1:-1,id,stage,pattern:E.PATTERNS[0].rows});
const batch=(id,attacks)=>({kind:'batch',id,due:1,attacks});
const runUntil=(m,check)=>{for(let i=0;i<1000&&!check();i++)E.step(m);assert.ok(check());};
const lock=p=>{p.active={x:0,y:0,r:0,pair:[E.block(0),E.block(1)]};p.phase='fall';p.lock=0;};

test('a completed two-stage combo queues one batch, not one attack per sword',()=>{
 const m=E.createMatch({rules:{lockMs:0}}),p=m.players[0],to=m.players[1];
 for(let y=1;y<=2;y++)for(let x=0;x<2;x++)p.board[y][x]=E.block(0);
 p.board[0][0]=E.block(2);p.board[0][1]=E.block(1);
 for(let y=0;y<2;y++)for(let x=2;x<4;x++)p.board[y][x]=E.block(1);
 E.fuse(p.board);p.active={x:0,y:3,r:1,pair:[E.block(0,true),E.block(1,true)]};
 E.step(m);runUntil(m,()=>p.stats.bestChain===1);
 assert.equal(to.incoming.length,0);assert.equal(p.pendingAttack.length,1);
 runUntil(m,()=>to.incoming.length>0);
 assert.equal(to.incoming.length,1);assert.equal(to.incoming[0].sourceTurn,1);
 assert.deepEqual(to.incoming[0].attacks.filter(a=>a.kind!=='sprinkle').map(a=>a.stage),[1,2]);
 assert.equal(p.pendingAttack.length,0);
});

test('one queued attack per defender turn; all its swords travel together',()=>{
 const m=E.createMatch({mode:'practice',rules:{lockMs:0}}),p=m.players[0];
 p.incoming=[batch(10,[sword(1,1,4),sword(2,2,6)]),batch(11,[sword(3,1,4)])];lock(p);
 E.step(m);runUntil(m,()=>p.phase==='attack');
 assert.equal(p.attackVisual.hits.length,2);assert.equal(p.incoming.length,1);
 const hits=[];while(p.phase==='attack'){E.step(m);hits.push(...m.events.filter(e=>e.type==='hit'));}
 assert.equal(hits.length,2);assert.equal(p.incoming.length,1);
 runUntil(m,()=>p.nextIndex===2);assert.equal(p.incoming.length,1);
 p.board=E.grid();lock(p);E.step(m);runUntil(m,()=>p.phase==='attack');
 assert.equal(p.attackVisual.hits.length,1);assert.equal(p.incoming.length,0);
});

test('three same-stage tall swords cannot manufacture a lethal attack',()=>{
 const b=E.grid(),r=E.applyAttackBatch(b,[sword(1,1),sword(2,1),sword(3,1)]);
 assert.equal(r.hits.length,2);assert.equal(r.discarded.length,1);assert.equal(b[12][3],null);
});

test('one sword from single, double and bingo can arrive together and be lethal',()=>{
 const b=E.grid(),r=E.applyAttackBatch(b,[sword(1,1),sword(2,2),sword(3,4)]);
 assert.equal(r.hits.length,3);assert.equal(r.discarded.length,0);assert.equal(b[12][3]?.stage,3);
});

test('three swords are not automatically lethal; safe same-stage extras can join',()=>{
 const b=E.grid(),r=E.applyAttackBatch(b,[sword(1,1,4),sword(2,1,4),sword(3,1,4)]);
 assert.equal(r.hits.length,3);assert.equal(b[12][3],null);
});

test('three primary swords can still be wasted by the ordinary placement sequence',()=>{
 const b=E.grid(),attacks=[sword(1,1),sword(2,2),sword(3,4)].map((a,index)=>({...a,index}));
 const r=E.applyAttackBatch(b,attacks);
 assert.equal(r.hits.length,3);assert.equal(r.hits[2].placement,null);assert.equal(b[12][3],null);
});

test('an early extra cannot make a later distinct-stage sword lethal',()=>{
 const b=E.grid(),r=E.applyAttackBatch(b,[sword(1,1),sword(2,1),sword(3,2)]);
 assert.deepEqual(r.hits.map(a=>a.id),[1,3]);assert.deepEqual(r.discarded.map(a=>a.id),[2]);assert.equal(b[12][3],null);
});

test('same-stage safety uses the actual defending stack, not only sword count',()=>{
 const b=E.grid();for(let y=0;y<11;y++)b[y][3]=E.block(y%4);
 const r=E.applyAttackBatch(b,[sword(1,1,4),sword(2,1,4),sword(3,1,4)]);
 assert.equal(r.hits.length,2);assert.equal(b[12][3],null);
});

