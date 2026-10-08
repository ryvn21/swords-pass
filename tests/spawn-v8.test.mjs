import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,step,block,spawn,hashState,clone,H} from '../dist/legacy-engine-v8.js';
import * as legacy from '../dist/legacy-engine-v7.js';
import {initialFromReplay,stepReplay} from '../dist/replay.js';
test('legacy v8 only: locking partly above the board cannot discard a block and advance the queue',()=>{const m=createMatch({mode:'practice',rules:{lockMs:0}}),p=m.players[0];p.active={x:0,y:H,r:0,pair:[block(0),block(1)]};p.board[H-1][0]=block(2);const next=p.nextIndex;step(m);assert.equal(p.dead,true);assert.equal(p.nextIndex,next);assert.equal(p.board[H-1][0].color,2);});
test('column four remains the loss condition at spawn',()=>{const m=createMatch(),p=m.players[0];p.board[H-1][3]=block(1);spawn(m,p);assert.equal(p.dead,true);});
test('v7 replays retain old spawn, movement, timings and deterministic hashes',()=>{const initial=legacy.createMatch({seed:5329,mode:'practice'}),a=clone(initial),b=initialFromReplay({version:7,initial,actions:[],ticks:600});for(let i=0;i<600;i++){const input=i%80===0?[{side:0,action:'fastOn'},{side:0,action:'cw'}]:[];legacy.step(a,1000/60,input);stepReplay(b,1000/60,input);}assert.equal(hashState(a),hashState(b));});

test('v8 replays preserve the published raised-spawn rules',()=>{const initial=createMatch({seed:117,mode:'practice'}),a=clone(initial),b=initialFromReplay({version:8,initial,actions:[],ticks:600});for(let i=0;i<600;i++){const input=i%80===0?[{side:0,action:'fastOn'},{side:0,action:'cw'}]:[];step(a,1000/60,input);stepReplay(b,1000/60,input);}assert.equal(hashState(a),hashState(b));});
