import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,command,DEFAULT_RULES,STALL_FLIPS} from '../dist/engine.js';

function falling(){const m=createMatch({seed:91,mode:'practice',rules:{...DEFAULT_RULES,stallFlips:STALL_FLIPS}});for(let i=0;i<400&&m.players[0].phase!=='fall';i++)step(m,1000/60,[]);const p=m.players[0];p.spawnGrace=0;for(let i=0;i<20;i++)step(m,1000/60,[]);return {m,p};}
test('two flips in the same direction stall the pair, at most three times',()=>{
 assert.equal(STALL_FLIPS,3);
 const {m,p}=falling();
 for(let n=1;n<=3;n++){assert.ok(p.fall>0);command(m,0,'cw');command(m,0,'cw');assert.equal(p.fall,0);assert.equal(p.stalls,n);for(let i=0;i<10;i++)step(m,1000/60,[]);}
 command(m,0,'cw');command(m,0,'cw');assert.ok(p.fall>0,'a fourth double flip does not stall');assert.equal(p.stalls,3);
});
test('alternating flips do not stall',()=>{const {m,p}=falling();command(m,0,'cw');command(m,0,'ccw');assert.ok(p.fall>0);assert.equal(p.stalls,0);});
test('rules without stallFlips keep the old behaviour',()=>{const m=createMatch({seed:91,mode:'practice',rules:{...DEFAULT_RULES,stallFlips:0}});for(let i=0;i<400&&m.players[0].phase!=='fall';i++)step(m,1000/60,[]);const p=m.players[0];p.spawnGrace=0;for(let i=0;i<20;i++)step(m,1000/60,[]);command(m,0,'cw');command(m,0,'cw');assert.ok(p.fall>0);assert.equal(p.stalls,undefined);});
