import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,command,step,rotate,cells,block,DEFAULT_RULES} from '../dist/engine.js';
import {handlingRules} from '../dist/handling-profile.js';

// A vertical pair sitting in the far-left column beside a single block (the corner tuck):
// the old kick lifts it up and out of the well; with wellFlip it turns over in place.
function corner(r){
 const m=createMatch(),board=m.players[0].board;
 board[0][1]=block(2);
 return {board,p:{x:0,y:r===2?1:0,r,pair:[block(0),block(3)]}};
}
test('without wellFlip a cornered vertical pair is kicked up and out (old behaviour)',()=>{
 const {board,p}=corner(0),next=rotate(board,p,1);
 assert.equal(next.r%2,1);assert.equal(next.y,1);
});
test('with wellFlip a cornered vertical pair flips 180 degrees in place, both directions',()=>{
 for(const r of [0])for(const d of [-1,1]){
  const {board,p}=corner(r),before=cells(p).map(c=>[c.x,c.y]),next=rotate(board,p,d,true);
  assert.equal(next.r,(r+2)%4);
  assert.deepEqual(cells(next).map(c=>[c.x,c.y]),before.reverse());
 }
});
test('wellFlip leaves open rotations and wall kicks alone',()=>{
 const m=createMatch(),board=m.players[0].board;
 const p={x:0,y:4,r:0,pair:[block(0),block(3)]};
 assert.equal(rotate(board,p,1,true).r,1);                       // room to the right: normal turn
 const q={x:0,y:4,r:0,pair:[block(0),block(3)]};
 assert.deepEqual([rotate(board,q,-1,true).x,rotate(board,q,-1,true).r],[1,3]);   // left wall: kicked right as before
});
test('handling rules keep wellFlip and new matches use it',()=>{
 assert.equal(handlingRules({wellFlip:true}).wellFlip,true);
 assert.equal(handlingRules({}).wellFlip,undefined);
 const m=createMatch({seed:5,mode:'practice',rules:{...DEFAULT_RULES,wellFlip:true}});
 for(let i=0;i<400&&m.players[0].phase!=='fall';i++)step(m,1000/60,[]);
 const pl=m.players[0];for(let y=0;y<13;y++)pl.board[y][4]=block(2);
 pl.active={...pl.active,x:3,y:6,r:0};pl.spawnGrace=0;pl.board[6][2]=block(2);pl.board[7][2]=block(2);
 const before=cells(pl.active).map(c=>[c.x,c.y]);command(m,0,'cw');
 assert.deepEqual(cells(pl.active).map(c=>[c.x,c.y]),before.reverse());
});
test('in the corner you can still lay the pair on the block: press again after the flip',()=>{
 const key=p=>cells(p).map(c=>[c.x,c.y,c.cell.color]).sort().join('|');
 const {board,p}=corner(0),lifted=key(rotate(board,p,1));                   // what one press used to do
 const outcomes=new Set();
 for(const d of [-1,1]){const once=rotate(board,p,d,true);for(const e of [-1,1]){const twice=rotate(board,once,e,true);if(twice)outcomes.add(key(twice));}}
 assert.ok(outcomes.has(lifted));                                            // the old lift, colours in the same order
 const swapped=key({...rotate(board,p,1),x:1,r:3});
 assert.ok(outcomes.has(swapped));                                           // and the mirror order
});
