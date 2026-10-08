import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,command,block,clone,cells,rotate,DEFAULT_RULES,pairAt} from '../dist/engine.js';
import {placements} from '../dist/ai.js';
const DT=1000/60;

test('a tap just before the next pair appears is applied once at spawn',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];p.active=null;p.phase='entry';p.timer=20;
 const next=p.nextIndex;assert.equal(command(m,0,'ccw'),true);
 step(m,DT);assert.equal(p.nextIndex,next);step(m,DT);
 assert.equal(p.nextIndex,next+1);assert.equal(p.active.r,3);
 step(m,DT);assert.equal(p.active.r,3);
});

test('a settled non-clearing placement reaches entry without an idle settling pause',()=>{
 const m=createMatch({mode:'practice',rules:{lockMs:0,spawnGraceMs:0}}),p=m.players[0];
 p.active={x:2,y:0,r:1,pair:[block(0),block(1)]};step(m,DT);
 assert.equal(p.phase,'entry');
 const next=p.nextIndex;for(let i=0;i<4;i++)step(m,DT);
 assert.equal(p.nextIndex,next+1);
});

test('an enclosed column 4 flips a pair already in the shaft without advancing NEXT',()=>{
 for(const action of ['ccw','cw']){
  const m=createMatch({mode:'practice'}),p=m.players[0];p.active.y=12;
  for(let y=0;y<13;y++)for(let x=0;x<6;x++)if(x!==3)p.board[y][x]=block((x+y)%4);
  const pair=clone(p.active.pair);
  const before=cells(p.active);
  assert.equal(command(m,0,action),true);
  const after=cells(p.active);
  assert.equal(after[0].y,before[1].y);assert.equal(after[1].y,before[0].y);
  assert.deepEqual(p.active.pair,pair);
  assert.ok(cells(p.active).some(c=>c.y<13));
  for(let i=0;i<90;i++)step(m,DT,[{side:0,action}]);
  assert.equal(p.nextIndex,1);assert.equal(p.stats.pieces,0);assert.deepEqual(p.active.pair,pair);
  assert.equal(p.board.flat().filter(Boolean).length,65);
 }
});

test('a trapped vertical pair flips in place at every height, direction and orientation',()=>{
 for(const x of [0,3,5])for(const y of [0,5,12])for(const r of [0,2])for(const direction of [-1,1]){
  const m=createMatch(),board=m.players[0].board;
  for(let yy=0;yy<13;yy++)for(let xx=0;xx<6;xx++)if(xx!==x)board[yy][xx]=block(2);
  const p={x,y:y+(r===2?1:0),r,pair:[block(0,true),block(3)]},before=cells(p),flipped=rotate(board,p,direction);
  assert.ok(flipped);assert.deepEqual(flipped.pair,p.pair);
  assert.deepEqual(cells(flipped).map(c=>[c.x,c.y]),before.map(c=>[c.x,c.y]).reverse());
  assert.deepEqual(rotate(board,flipped,direction),p);
 }
});

test('narrow-gap flips stay available after six resets but cannot stall locking',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];
 for(let y=0;y<13;y++)for(let x=0;x<6;x++)if(x!==3)p.board[y][x]=block((x+y)%4);
 p.active={x:3,y:0,r:0,pair:[block(0),block(1)]};p.lockResets=6;p.lock=100;
 assert.equal(command(m,0,'ccw'),true);assert.equal(p.lock,100);
 for(let i=0;i<60&&p.stats.pieces===0;i++)step(m,DT,[{side:0,action:'ccw'}]);
 assert.equal(p.stats.pieces,1);
});

test('AI can consider either block order in an enclosed shaft',()=>{
 const p=createMatch().players[0];
 for(let y=0;y<13;y++)for(let x=0;x<6;x++)if(x!==3)p.board[y][x]=block((x+y)%4);
 p.active.pair=[block(0,true),block(3)];
 const options=placements(p.board,p.active);
 assert.deepEqual(new Set(options.map(o=>cells(o.piece).find(c=>c.y===0).cell.color)),new Set([0,3]));
});

test('engaging fast fall halfway through a normal row never jumps multiple rows',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];for(let i=0;i<30;i++)step(m,DT);
 const y=p.active.y;step(m,DT,[{side:0,action:'fastOn'}]);assert.ok(y-p.active.y<=1,`jumped ${y-p.active.y} rows`);
});
test('switching fall speed preserves the visible fraction of the current row',()=>{
 const m=createMatch(),p=m.players[0];p.fall=m.rules.gravityMs*.4;
 command(m,0,'fastOn');assert.ok(Math.abs(p.fall/m.rules.fastFallMs-.4)<1e-9);
 command(m,0,'fastOff');assert.ok(Math.abs(p.fall/m.rules.gravityMs-.4)<1e-9);
});
test('rotating either direction at spawn preserves both blocks and the next pair',()=>{
 for(const direction of ['cw','ccw']){const m=createMatch({mode:'practice'}),p=m.players[0],pair=clone(p.active.pair);
 for(let i=0;i<8;i++){step(m,DT,[{side:0,action:direction}]);assert.deepEqual(p.active.pair,pair);assert.equal(p.nextIndex,1);assert.equal(p.stats.pieces,0);}}
});
test('a successful rotation at a high stack refreshes the contact window',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];p.board[11][3]=block(2);p.lock=m.rules.lockMs-1;
 const pair=clone(p.active.pair);step(m,DT,[{side:0,action:'ccw'}]);assert.equal(p.phase,'fall');assert.deepEqual(p.active.pair,pair);assert.equal(p.nextIndex,1);
});
test('fast fall allows a last-moment move and rotation into a corner',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];p.active={x:1,y:1,r:0,pair:[block(0),block(1)]};p.board[0][1]=block(3);p.fast=true;
 for(let i=0;i<9;i++)step(m,DT);assert.equal(p.phase,'fall');
 assert.ok(command(m,0,'left'));assert.ok(command(m,0,'cw'));
 for(let i=0;i<4;i++)step(m,DT);assert.equal(p.phase,'fall');assert.equal(p.active.x,0);assert.equal(p.active.r,1);
});
test('repeated successful grounded rotations cannot postpone lock indefinitely',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];p.active={x:2,y:0,r:1,pair:[block(0),block(1)]};
 for(let i=0;i<300&&p.stats.pieces===0;i++)step(m,DT,[{side:0,action:i%2?'cw':'ccw'}]);assert.ok(p.stats.pieces>0);
});
test('the new stream yields roughly one breaker per four blocks',()=>{
 let n=0;for(let i=0;i<5000;i++)n+=pairAt(771,i,DEFAULT_RULES.breakerRate).filter(c=>c.breaker).length;
 assert.ok(n>=2350&&n<=2650,`got ${n}/10000`);
});
test('continuous floor kicks cannot bypass the contact reset limit',()=>{
 for(const fast of [false,true]){const m=createMatch({mode:'practice'}),p=m.players[0];p.active={x:2,y:0,r:0,pair:[block(0),block(1)]};p.fast=fast;
 for(let i=0;i<300&&p.stats.pieces===0;i++)step(m,DT,[{side:0,action:'cw'}]);assert.ok(p.stats.pieces>0);}
});
