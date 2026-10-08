import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,receiveBatch,grid,block,H} from '../dist/engine.js';
const DT=1000/60;

// Put a ready-to-break 2x2 gem plus breaker under the falling pair, then run until it locks and resolves.
function breakSoon(m){const b=m.players[0].board;b[0][0]=block(1);b[0][1]=block(1);b[1][0]=block(1);b[1][1]=block(1);b[2][0]=block(1,true);m.players[0].active={...m.players[0].active,x:4,y:0,r:0};}

test('online mode simulates only your own board',()=>{
 const m=createMatch({seed:3,mode:'online'}),view=p=>JSON.stringify({...p,incoming:null});const before=view(m.players[1]);
 for(let i=0;i<1500;i++)step(m,DT,[]);
 assert.equal(view(m.players[1]),before);assert.ok(m.players[0].turn>0);
});

test('your breaks build an outgoing batch in the remote slot for the network to send',()=>{
 const m=createMatch({seed:3,mode:'online'});breakSoon(m);
 for(let i=0;i<300&&!m.players[1].incoming.length;i++)step(m,DT,[]);
 const out=m.players[1].incoming;assert.equal(out.length,1);assert.equal(out[0].kind,'batch');assert.ok(out[0].attacks.length>=1);
});

test('received batches land on your next lock with fresh ids and a horizontal base for your board',()=>{
 const m=createMatch({seed:3,mode:'online'}),p=m.players[0];p.board[0][2]=block(0);
 assert.equal(receiveBatch(m,0,[{kind:'vertical',width:1,length:4,stage:1,index:0,hand:1,id:1,pattern:[[0,0,0,0,0,0]]},{kind:'horizontal',width:2,length:3,stage:1,index:1,hand:1,id:1,pattern:[[0,0,0,0,0,0]]}],5),true);
 const b=p.incoming[0];assert.equal(b.due,p.turn+1);assert.notEqual(b.attacks[0].id,b.attacks[1].id);assert.equal(typeof b.attacks[1].base,'number');
 const turn=p.turn;for(let i=0;i<2000&&p.turn===turn;i++)step(m,DT,[{side:0,action:'fastOn'}]);
 for(let i=0;i<200;i++)step(m,DT,[]);
 assert.equal(p.incoming.length,0);assert.ok(p.board.flat().some(c=>c?.stage));
 assert.equal(receiveBatch(m,0,[],0),false);assert.equal(receiveBatch(m,0,'junk',0),false);
});

test('a remote top-out reported by the server ends the match in your favour; yours ends it against you',()=>{
 const m=createMatch({seed:3,mode:'online'});m.players[1].dead=true;step(m,DT,[]);assert.equal(m.winner,0);
 const n=createMatch({seed:3,mode:'online'});n.players[0].board[H-1][3]=block(0);for(let i=0;i<2000&&n.winner===null;i++)step(n,DT,[{side:0,action:'fastOn'}]);assert.equal(n.winner,1);
});
