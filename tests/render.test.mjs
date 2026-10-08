import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBoard,drawNext,COLORS} from '../dist/render.js';
import {createMatch,block,applyAttack,PATTERNS} from '../dist/engine.js';
function surface(){const rotations=[],fills=[],rects=[];const ctx=new Proxy({globalAlpha:1,rotate:a=>rotations.push(a),roundRect:(...r)=>rects.push(r),fill(){fills.push({alpha:this.globalAlpha,color:this.fillStyle});},createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});return {width:0,height:0,getContext:()=>ctx,rotations,fills,rects};}

test('essential pair travel stays smooth even with reduced effects enabled',()=>{
 for(const fast of [false,true])for(const reduced of [false,true]){
  const m=createMatch(),p=m.players[0];p.active={x:2,y:8,r:0,pair:[block(0),block(1)]};p.fast=fast;
  const speed=fast?m.rules.fastFallMs:m.rules.gravityMs,ys=[];
  for(const f of [.1,.3,.5,.7]){p.fall=speed*f;const canvas=surface();drawBoard(canvas,p,{reduced});ys.push(canvas.rects[0][1]);}
  for(let i=1;i<ys.length;i++)assert.ok(Math.abs(ys[i]-ys[i-1]-48*.2)<1e-8);
 }
});

test('drawing between simulation ticks advances the pair without mutating its state',()=>{
 const p=createMatch().players[0];p.active={x:2,y:8,r:0,pair:[block(0),block(1)]};p.fall=100;p.spawnGrace=0;
 const a=surface(),b=surface();drawBoard(a,p,{gravityMs:800,renderAheadMs:0});drawBoard(b,p,{gravityMs:800,renderAheadMs:8});
 assert.ok(Math.abs(b.rects[0][1]-a.rects[0][1]-.48)<1e-8);assert.equal(p.fall,100);
});

test('incoming sprinkles fall straight to their place: always downward, never past it',()=>{
 const p=createMatch().players[0];p.active=null;p.phase='attack';p.board[0][0]=block(0);
 p.attackVisual={before:Array.from({length:13},()=>Array(6).fill(null)),duration:320,hit:{kind:'sprinkle',placed:[{x:0,y:0}]}};
 const ys=[];for(let t=310;t>=0;t-=10){p.timer=t;const canvas=surface();drawBoard(canvas,p);if(canvas.rects[0])ys.push(canvas.rects[0][1]-1);}
 const rest=12*48;
 for(let i=1;i<ys.length;i++)assert.ok(ys[i]>=ys[i-1]-1e-9);
 assert.ok(ys.every(y=>y<=rest+1e-9));assert.ok(Math.abs(ys.at(-1)-rest)<1e-9);
});
test('sprinkles wait for the swords: none drawn until the strike has nearly landed',()=>{
 const p=createMatch().players[0];p.active=null;p.phase='attack';p.board[0][0]=block(0);p.timer=240;
 p.attackVisual={before:Array.from({length:13},()=>Array(6).fill(null)),duration:320,hits:[{kind:'vertical',placement:{x:2,y:0,w:1,h:3}},{kind:'sprinkle',placed:[{x:0,y:3}]}]};
 const canvas=surface();drawBoard(canvas,p);assert.equal(canvas.rects.filter(r=>r[0]===1).length,0);
});
test('horizontal strike preserves entry direction after landing',()=>{
 const p=createMatch().players[0];p.active=null;
 applyAttack(p.board,{kind:'horizontal',width:2,length:3,hand:-1,index:1,id:7},PATTERNS[0].rows);
 const canvas=surface();drawBoard(canvas,p);assert.deepEqual(canvas.rotations,[-Math.PI/2]);
});

test('all swords in one attack batch are drawn in the same frame',()=>{
 const p=createMatch().players[0];p.active=null;p.phase='attack';p.timer=160;
 p.attackVisual={before:p.board,duration:320,hits:[{kind:'horizontal',placement:{x:0,y:2,w:3,h:2,hand:1}},{kind:'horizontal',placement:{x:3,y:5,w:3,h:2,hand:-1}}]};
 const canvas=surface();drawBoard(canvas,p);assert.deepEqual(canvas.rotations,[Math.PI/2,-Math.PI/2]);
});
test('clear fade tracks the configured per-cell lifetime',()=>{
 const p=createMatch().players[0];p.active=null;p.board[0][0]=block(0);p.phase='clear';p.wave=[{x:0,y:0,cell:block(0),delay:0}];p.clearDuration=500;p.clearCellMs=500;p.timer=250;
 const canvas=surface();drawBoard(canvas,p,{reduced:true});
 assert.equal(canvas.fills.find(f=>f.color===COLORS[0]).alpha,.5);
});
test('board and next preview retain the reference cell proportions',()=>{
 const canvas=surface(),p=createMatch().players[0];drawBoard(canvas,p);
 assert.equal(canvas.width/canvas.height,4/13);p.entryRows=2;drawBoard(canvas,p);assert.equal(canvas.width/canvas.height,4/15);drawNext(canvas,p.active.pair);assert.equal(canvas.height,canvas.width*3);
});
test('letting go of fast fall never pops the falling pair back up',()=>{
 const m=createMatch({rules:{fastFallMs:32}}),p=m.players[0];p.active={x:2,y:8,r:0,pair:[block(0),block(1)]};p.spawnGrace=0;p.nextIndex=3;p.fast=true;p.fall=16;
 const canvas=surface(),opts={gravityMs:800,fastFallMs:32,renderAheadMs:14};
 drawBoard(canvas,p,opts);const before=canvas.rects.at(-1)[1];
 p.fall=p.fall/32*800;p.fast=false;canvas.rects.length=0;drawBoard(canvas,p,opts);const after=canvas.rects.at(-1)[1];
 assert.ok(after>=before-1e-9);
});
test('a pair that can no longer fall is drawn exactly in its cell, never sunk into the stack',()=>{
 const m=createMatch(),p=m.players[0];p.active={x:2,y:5,r:0,pair:[block(0),block(1)]};p.spawnGrace=0;p.nextIndex=4;p.fall=700;
 const canvas=surface(),opts={gravityMs:800,fastFallMs:200,renderAheadMs:0};
 drawBoard(canvas,p,opts);                                  // mid-fall, drawn most of a row lower
 p.active={...p.active,x:3};p.board[4][3]=block(2);       // slid sideways onto a column it rests on
 canvas.rects.length=0;drawBoard(canvas,p,opts);
 const ys=canvas.rects.map(r=>r[1]-1),pairTop=(13-1-6)*48,pairBottom=(13-1-5)*48;
 assert.ok(ys.includes(pairTop)&&ys.includes(pairBottom));
});
