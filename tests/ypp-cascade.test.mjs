import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,W,H} from '../dist/engine.js';
import {HOUSE_RULES} from '../dist/handling-profile.js';

const cell=(color,o={})=>({color,breaker:false,stage:0,...o});
function setup(rules){
 const m=createMatch({mode:'practice',rules});const p=m.players[0];
 for(let i=0;i<5;i++)step(m,1);
 return {m,p};
}
// time from the start of resolution until the board is ready for the next pair
function resolveMs(rules,board){
 const {m,p}=setup(rules);p.board=board;p.active=null;p.phase='settle';p.timer=1;let t=0;
 const seen=new Set();
 while(p.phase!=='fall'&&t<5000){step(m,1);t+=1;seen.add(p.phase);}
 return {t,seen};
}
function link(){const b=Array.from({length:H},()=>Array(W).fill(null));b[0][0]=cell(0);b[0][1]=cell(0,{breaker:true});return b;}
function joinThenLink(){const b=Array.from({length:H},()=>Array(W).fill(null));
 b[0][2]=cell(1);b[0][3]=cell(1);b[1][2]=cell(1);b[1][3]=cell(1);   // a 2x2 that fuses
 b[0][0]=cell(0);b[0][1]=cell(0,{breaker:true});return b;}

test('YPP cascade: one link (depth 1) destroys in 75 + 500 = 575 ms; the old timing is untouched', () => {
 const ypp=resolveMs(HOUSE_RULES,link()),old=resolveMs({...HOUSE_RULES,yppCascade:false},link());
 assert.ok(ypp.t>=570&&ypp.t<=640,`ypp ${ypp.t}`);       // 75 + 500, plus a settle tick and entry
 assert.ok(old.t<=ypp.t-200,`old ${old.t}`);
});
test('YPP cascade: blocks that join fade in for 250 ms first', () => {
 const r=resolveMs(HOUSE_RULES,joinThenLink());
 assert.ok(r.seen.has('join'));
 const plain=resolveMs(HOUSE_RULES,link());
 assert.ok(Math.abs(r.t-plain.t-250)<=5,`${r.t} vs ${plain.t}`);
});
