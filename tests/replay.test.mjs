import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,createMatch,step,hashState,clone} from '../dist/engine.js';
import * as legacy from '../dist/legacy-engine-v1.js';
import * as legacy2 from '../dist/legacy-engine-v2.js';
import * as legacy3 from '../dist/legacy-engine-v3.js';
import * as legacy4 from '../dist/legacy-engine-v4.js';
import * as legacy5 from '../dist/legacy-engine-v5.js';
import * as legacy6 from '../dist/legacy-engine-v6.js';
import * as replayAPI from '../dist/replay.js';
const {validateReplay,initialFromReplay}=replayAPI;
const valid=()=>({version:VERSION,initial:createMatch({seed:123}),actions:[],ticks:0});

test('version-6 replays retain sequential attack handling',()=>{
 const initial=legacy6.createMatch({seed:37}),r={version:6,initial,actions:[],ticks:300},a=clone(initial),b=initialFromReplay(r);
 for(const m of [a,b]){m.rules.lockMs=0;m.players[0].active={x:0,y:0,r:0,pair:[legacy6.block(0),legacy6.block(1)]};m.players[0].incoming=[1,2].map(id=>({kind:'vertical',width:1,length:4,index:id,hand:1,id,due:1,pattern:legacy6.PATTERNS[0].rows}));}
 for(let i=0;i<300;i++){legacy6.step(a);replayAPI.stepReplay(b);}
 assert.equal(hashState(a),hashState(b));
});

test('version-5 replays retain their former slow and fast speeds',()=>{
 const initial=legacy5.createMatch({seed:37,mode:'practice'}),r={version:5,initial,actions:[],ticks:300},a=clone(initial),b=initialFromReplay(r);
 for(let i=0;i<300;i++){const input=i%80===25?[{side:0,action:'fastOn'}]:i%80===45?[{side:0,action:'fastOff'}]:[];legacy5.step(a,1000/60,input);replayAPI.stepReplay(b,1000/60,input);}
 assert.equal(hashState(a),hashState(b));assert.equal(b.rules.fastFallMs,125);
});

test('version-4 replays retain their blocked narrow-gap rotation',()=>{
 const initial=legacy4.createMatch({seed:29,mode:'practice'});
 for(let y=0;y<13;y++)for(let x=0;x<6;x++)if(x!==3)initial.players[0].board[y][x]=legacy4.block((x+y)%4);
 const r={version:4,initial,actions:[],ticks:120},a=clone(initial),b=initialFromReplay(r);
 for(let i=0;i<120;i++){const input=[{side:0,action:'ccw'}];legacy4.step(a,1000/60,input);replayAPI.stepReplay(b,1000/60,input);}
 assert.equal(hashState(a),hashState(b));assert.equal(b.players[0].active.r,0);
});

test('version-3 replays preserve the original ceiling rotation and timing',()=>{
 const initial=legacy3.createMatch({seed:29,mode:'practice'});
 for(let y=0;y<13;y++)for(let x=0;x<6;x++)if(x!==3)initial.players[0].board[y][x]=legacy3.block((x+y)%4);
 const r={version:3,initial,actions:[],ticks:150},a=clone(initial),b=initialFromReplay(r);
 for(let i=0;i<150;i++){const input=i===0?[{side:0,action:'ccw'}]:[];legacy3.step(a,1000/60,input);replayAPI.stepReplay(b,1000/60,input);}
 assert.equal(hashState(a),hashState(b));assert.ok(a.players[0].stats.pieces>0);
});

test('version-2 replays retain their former fast-fall and lock behaviour',()=>{
 const initial=legacy2.createMatch({seed:29}),r={version:2,initial,actions:[],ticks:1500};
 const a=clone(initial),b=initialFromReplay(r);
 for(let i=0;i<1500;i++){const input=i%90===30?[{side:0,action:'fastOn'}]:i%90===35?[{side:0,action:'ccw'}]:[];legacy2.step(a,1000/60,input);replayAPI.stepReplay(b,1000/60,input);}
 assert.equal(hashState(a),hashState(b));
});

test('old replays use the original engine and preserve their final hash',()=>{
 const initial=legacy.createMatch({seed:443}),r={version:1,initial,actions:[],ticks:300};
 assert.doesNotThrow(()=>validateReplay(r));
 const a=legacy.clone(initial),b=initialFromReplay(r);
 for(let i=0;i<300;i++){legacy.step(a);replayAPI.stepReplay(b);}
 assert.equal(legacy.hashState(a),legacy.hashState(b));
});
test('import reconstructs a trusted initial match instead of executing arbitrary nested state',()=>{const r=valid();r.initial.players[0].active.r=999;r.initial.players[0].incoming=[{kind:'sprinkle',count:Infinity}];const m=initialFromReplay(r);assert.equal(m.players[0].active.r,0);assert.deepEqual(m.players[0].incoming,[]);});
test('malformed timing and unsorted replay commands are rejected',()=>{let r=valid();r.initial.rules.fastFallMs=0;assert.throws(()=>validateReplay(r));r=valid();r.ticks=10;r.actions=[{tick:5,side:0,action:'cw'},{tick:2,side:0,action:'left'}];assert.throws(()=>validateReplay(r));});
test('canonical replay reconstruction preserves deterministic state',()=>{const r=valid(),a=clone(r.initial),b=initialFromReplay(r);for(let i=0;i<300;i++){step(a);step(b);}assert.equal(hashState(a),hashState(b));});
