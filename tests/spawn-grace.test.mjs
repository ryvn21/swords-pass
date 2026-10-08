import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,command,block,cells,fits,H,spawn} from '../dist/engine.js';

test('spawn uses the original thirteen-row board and cannot park entirely above it',()=>{
 const m=createMatch(),p=m.players[0];assert.equal(p.board.length,13);assert.equal(p.entryRows??0,0);assert.equal(p.active.y,H-1);
 assert.equal(fits(p.board,{...p.active,y:H}),false);
});
test('spawn grace accepts movement and repeated rotation without advancing NEXT',()=>{
 const m=createMatch({mode:'practice',rules:{spawnGraceMs:250}}),p=m.players[0],pair=structuredClone(p.active.pair);
 step(m,100,[{side:0,action:'left'},{side:0,action:'cw'}]);
 assert.equal(p.active.x,2);assert.equal(p.active.r,1);assert.equal(p.fall,0);
 step(m,100,[{side:0,action:'ccw'}]);assert.equal(p.active.r,0);assert.equal(p.spawnGrace,50);
 assert.equal(p.nextIndex,1);assert.deepEqual(p.active.pair,pair);
 step(m,100);assert.equal(p.spawnGrace,0);assert.equal(p.fall,50);
 step(m,750);assert.equal(p.active.y,H-2);
});
test('a pair touching a high stack cannot lock during spawn grace',()=>{
 const m=createMatch({mode:'practice',rules:{spawnGraceMs:250,lockMs:0}}),p=m.players[0];p.board[H-2][3]=block(2);
 step(m,200);assert.equal(p.dead,false);assert.equal(p.stats.pieces,0);assert.equal(p.lock,0);
 step(m,40,[{side:0,action:'left'},{side:0,action:'ccw'}]);assert.equal(p.stats.pieces,0);assert.equal(p.active.x,2);assert.equal(p.nextIndex,1);
});
test('top-edge placement outside column four uses original clipping behavior, not overflow defeat',()=>{
 const m=createMatch({mode:'practice',rules:{spawnGraceMs:0,lockMs:0}}),p=m.players[0];
 for(let y=0;y<H-1;y++)p.board[y][0]=block(y%4);
 p.active={x:0,y:H-1,r:0,pair:[block(0),block(1)]};step(m);
 assert.equal(p.dead,false);assert.equal(p.stats.pieces,1);assert.equal(p.board[H-1][0].color,0);assert.equal(m.winner,null);
});
test('one-column rotations preserve both blocks and never refresh spawn grace',()=>{
 const m=createMatch({mode:'practice',rules:{spawnGraceMs:250}}),p=m.players[0];
 for(let y=0;y<H;y++)for(let x=0;x<6;x++)if(x!==3)p.board[y][x]=block((x+y)%4);
 const pair=structuredClone(p.active.pair);
 for(let i=0;i<6;i++){step(m,50,[{side:0,action:'ccw'}]);assert.equal(p.nextIndex,1);assert.deepEqual(p.active.pair,pair);assert.ok(cells(p.active).some(c=>c.y<H));}
 assert.equal(p.spawnGrace,0);assert.equal(p.fall,50);
});
test('every new pair gets its own bounded adjustment window; zero disables it',()=>{
 for(const spawnGraceMs of [0,250,400]){const m=createMatch({rules:{spawnGraceMs}}),p=m.players[0];command(m,0,'left');step(m,500);spawn(m,p);assert.equal(p.spawnGrace,spawnGraceMs);assert.equal(p.active.y,H-1);}
});
