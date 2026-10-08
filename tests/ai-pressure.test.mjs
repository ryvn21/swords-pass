import test from 'node:test';
import assert from 'node:assert/strict';
import {planMove,botProfile} from '../dist/ai.js';
import {block,grid,createMatch,command,H,cells} from '../dist/engine.js';
test('AI identities have different strategies at the same difficulty',()=>{
 const profiles=[0,1,2].map(id=>botProfile('medium',id));
 assert.equal(new Set(profiles.map(p=>p.style)).size,3);
 const active=createMatch().players[0].active,plans=profiles.map(opponent=>planMove({board:grid(),active,opponent}));
 assert.ok(new Set(plans.map(p=>p.x+':'+p.r)).size>1);
});
test('every AI difficulty takes a reachable matching breaker clear',()=>{
 const board=grid();for(let x=0;x<3;x++)board[0][x]=block(0);
 for(const difficulty of ['easy','medium','hard']){const plan=planMove({board,active:{x:3,y:H-1,r:0,pair:[block(0,true),block(1)]},opponent:botProfile(difficulty,0)});assert.ok(plan.cleared>=4);}
});
