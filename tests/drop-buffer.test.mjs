import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,command,step,DEFAULT_RULES} from '../dist/engine.js';
import {handlingRules,HANDLING_PRESETS} from '../dist/handling-profile.js';

// Drop a pair, then press fast-fall at a given moment of the gap before the next pair arrives.
function gapPress(rules,pressBeforeSpawnMs,release=false){
 const m=createMatch({mode:'practice',seed:7,rules}),p=m.players[0],dt=1000/60;
 command(m,0,'fastOn');let guard=0;while(p.active&&guard++<2000)step(m,dt);   // first pair lands
 const gap=[];while(!p.active&&guard++<4000){gap.push(m.elapsed);step(m,dt);}  // time with no pair
 // replay the same gap and press at the chosen moment
 const m2=createMatch({mode:'practice',seed:7,rules}),q=m2.players[0];command(m2,0,'fastOn');guard=0;
 while(q.active&&guard++<2000)step(m2,dt);
 const spawnAt=gap.at(-1)+dt;let pressed=false;
 while(!q.active&&guard++<4000){if(!pressed&&spawnAt-m2.elapsed<=pressBeforeSpawnMs){command(m2,0,'fastOn');pressed=true;if(release)command(m2,0,'fastOff');}step(m2,dt);}
 return {pressed,fast:q.fast,grace:q.spawnGrace};
}
test('without an early window a press between pairs does nothing (old behaviour)',()=>{
 const r=gapPress({...DEFAULT_RULES},60);assert.ok(r.pressed);assert.equal(r.fast,false);
});
test('a fresh press inside the early window fast-falls the next pair at once',()=>{
 const r=gapPress({...DEFAULT_RULES,dropBufferMs:160},60);assert.ok(r.pressed);assert.equal(r.fast,true);assert.equal(r.grace,0);
});
test('releasing before the pair arrives cancels the early press',()=>{
 const r=gapPress({...DEFAULT_RULES,dropBufferMs:160},60,true);assert.equal(r.fast,false);
});
test('holding fast-fall through a lock still does not carry to the next pair',()=>{
 const m=createMatch({mode:'practice',seed:7,rules:{...DEFAULT_RULES,dropBufferMs:160}}),p=m.players[0];
 command(m,0,'fastOn');let g=0;while(p.active&&g++<2000)step(m,1000/60);while(!p.active&&g++<4000)step(m,1000/60);
 assert.equal(p.fast,false);
});
test('presets carry the early window; the profile key ignores it',()=>{
 assert.ok(HANDLING_PRESETS.every(x=>x.rules.dropBufferMs>0));
 assert.equal(handlingRules({}).dropBufferMs,undefined);assert.equal(handlingRules({dropBufferMs:999}).dropBufferMs,300);
});
