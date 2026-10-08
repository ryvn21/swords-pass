import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';

const runUntil=(m,predicate,max=1000)=>{for(let i=0;i<max&&!predicate();i++)E.step(m,1000/60);assert.ok(predicate(),'state reached');};
test('clear wave follows connected neighbours from the breaker',()=>{
 const b=E.grid();b[0][0]=E.block(0,true);b[1][0]=E.block(0);b[2][0]=E.block(0);b[2][1]=E.block(0);
 assert.equal(typeof E.clearWave,'function');
 const wave=E.clearWave(E.clearGroups(b),80);
 assert.deepEqual(wave.map(c=>[c.x,c.y,c.delay]).sort((a,b)=>a[2]-b[2]),[[0,0,0],[0,1,80],[0,2,160],[1,2,240]]);
});
test('a fused gem shatters together when the wave reaches it',()=>{
 const b=E.grid();for(let y=0;y<2;y++)for(let x=0;x<2;x++)b[y][x]=E.block(0);E.fuse(b);b[0][2]=E.block(0,true);
 assert.equal(typeof E.clearWave,'function');
 const wave=E.clearWave(E.clearGroups(b),80).filter(c=>c.x<2);
 assert.equal(new Set(wave.map(c=>c.delay)).size,1);assert.equal(wave[0].delay,80);
});
test('a separated pair half falls over successive ticks, not instantly',()=>{
 const m=E.createMatch({mode:'practice',rules:{lockMs:0,spawnGraceMs:0}}),p=m.players[0];
 p.board[0][1]=E.block(2);p.board[1][1]=E.block(3);p.board[2][1]=E.block(2);
 p.active={x:0,y:3,r:1,pair:[E.block(0),E.block(1)]};E.step(m,1000/60);
 assert.equal(p.board[0][0],null);assert.equal(p.board[3][0]?.color,0);
 runUntil(m,()=>p.board[0][0]?.color===0);assert.equal(p.board[3][1]?.color,1);
});
test('pending attack waits for the defending break to finish',()=>{
 const m=E.createMatch({rules:{lockMs:0,spawnGraceMs:0}}),p=m.players[0];
 p.board[0][0]=E.block(0);p.active={x:0,y:1,r:0,pair:[E.block(0,true),E.block(1)]};
 p.incoming=[{kind:'vertical',width:1,length:4,index:0,hand:1,id:123,due:1,pattern:E.PATTERNS[0].rows}];
 E.step(m,1000/60);assert.equal(p.board.flat().some(c=>c?.strike===123),false);
 runUntil(m,()=>p.stats.cleared===2);assert.equal(p.board.flat().some(c=>c?.strike===123),false);
 runUntil(m,()=>p.board.flat().some(c=>c?.strike===123));
});
test('settled result of an animated chain matches the rule solver',()=>{
 const m=E.createMatch({mode:'practice',rules:{lockMs:0,spawnGraceMs:0}}),p=m.players[0];
 p.board[0][0]=E.block(1);p.board[1][0]=E.block(0);p.board[2][0]=E.block(1,true);p.board[0][1]=E.block(2);
 p.active={x:1,y:1,r:1,pair:[E.block(0,true),E.block(3)]};
 const expected=E.clone(p.board);for(const c of E.cells(p.active))expected[c.y][c.x]=c.cell;
 const result=E.resolve(expected);E.step(m,1000/60);runUntil(m,()=>p.nextIndex===2);
 assert.deepEqual(p.board,expected);assert.equal(p.stats.bestChain,2);assert.equal(p.stats.cleared,result.reduce((s,r)=>s+r.cleared.length,0));
});
