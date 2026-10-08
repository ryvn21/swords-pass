import test from 'node:test';import assert from 'node:assert/strict';
import {createRun,startEncounter,inputRun,stepRun,chooseReward} from '../dist/rogue-run.js';
import {DEFAULT_CAMPAIGN,validateCampaign,modifiers} from '../dist/rogue-content.js';
import {transformRunAttack,upgradePreview} from '../dist/rogue-upgrades.js';
import {serializeRun,restoreRun} from '../dist/rogue-save.js';
import {runView} from '../dist/rogue-view.js';
import {block,clone,createMatch,step,hashState} from '../dist/engine.js';
import {readFileSync} from 'node:fs';

test('bot encounter has two live boards and no random attack schedule',()=>{
 const r=createRun({seed:7});startEncounter(r);assert.equal(r.game.mode,'duel');assert.ok(runView(r).opponent);assert.equal(runView(r).nextWave,null);
 for(let i=0;i<480;i++)stepRun(r);assert.ok(r.game.players[1].stats.pieces>0);assert.equal(r.room.waves,0);assert.equal(r.game.players[0].stats.pieces,0);
});
test('opponent death wins, human death loses, simultaneous death loses',()=>{
 for(const [human,bot,expected] of [[false,true,'reward'],[true,false,'lost'],[true,true,'lost']]){const r=createRun();startEncounter(r);r.game.players[0].dead=human;r.game.players[1].dead=bot;stepRun(r);assert.equal(r.phase,expected);}
});
test('real clear delivers boosted sprinkles to bot exactly once',()=>{
 const r=createRun({rules:{spawnGraceMs:0,lockMs:0,clearMs:0,waveMs:0}});r.inventory['extra-sprinkles']=2;startEncounter(r);const [p,b]=r.game.players;
 p.board[0][0]=block(0);p.active={x:0,y:1,r:0,pair:[block(0,true),block(1)]};
 for(let i=0;i<120&&!b.incoming.length;i++)stepRun(r);assert.equal(b.incoming.length,1);assert.equal(b.incoming[0].attacks.find(a=>a.kind==='sprinkle').count,3);
 const count=b.incoming[0].attacks[0].count;stepRun(r);assert.equal(b.incoming[0].attacks[0].count,count);
});
test('outgoing hook executes before a recipient locks during the same tick',()=>{
 const m=createMatch({rules:{spawnGraceMs:0,lockMs:0}}),[p,b]=m.players;p.phase='settle';p.timer=0;p.active=null;p.pendingAttack=[{kind:'sprinkle',count:1,hand:1,id:8,pattern:p.pattern}];
 b.active={x:0,y:0,r:0,pair:[block(0),block(1)]};let calls=0;
 step(m,1000/60,[],{outgoing:(s,side,attacks)=>{calls++;assert.equal(side,0);return transformRunAttack(attacks,{sprinkleBonus:2},()=>{});}});
 assert.equal(calls,1);assert.equal(b.incoming.length,0);assert.equal(b.phase,'attack');assert.equal(b.attackVisual.hits[0].count,3);assert.equal(b.attackVisual.hits[0].placed.length,3);
});
test('v1 run saves retain their exact pre-bot engine state and future simulation',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/rogue-v1.json',import.meta.url),'utf8')),r=restoreRun(fixture.save);assert.equal(r.version,1);assert.equal(hashState(r.game),fixture.initialHash);assert.equal(JSON.parse(serializeRun(r)).runVersion,1);
 for(let i=0;i<900;i++)stepRun(r);assert.equal(hashState(r.game),fixture.continuedHash);assert.equal(runView(r).opponent,null);
});
test('breaker ranks boost only the human player and preview, not the bot',()=>{
 const r=createRun({seed:1});r.inventory['breaker-supply']=3;startEncounter(r);assert.equal(r.game.rules.breakerRate,.31);const v=runView(r);assert.equal(v.effects.breakerBonus,.06);
 const unboosted=createRun({seed:1});startEncounter(unboosted);assert.deepEqual(r.game.players[1].active.pair,unboosted.game.players[1].active.pair);assert.deepEqual(v.opponent.nextPair,runView(unboosted).opponent.nextPair);
});
test('attack upgrades preserve batch metadata, stay bounded and never mutate original',()=>{
 const attacks=[{kind:'vertical',width:1,length:4,id:5,stage:2},{kind:'horizontal',width:2,length:4,id:6,stage:3},{kind:'sprinkle',count:3,id:7}],original=clone(attacks);
 const boosted=transformRunAttack(attacks,{sprinkleBonus:2,strikeHeightBonus:3},()=>({kind:'sprinkle',count:0,id:8}));assert.equal(boosted[0].length,6);assert.equal(boosted[1].length,4);assert.equal(boosted[2].count,5);assert.deepEqual(attacks,original);assert.equal(boosted[0].stage,2);
 assert.equal(transformRunAttack([{kind:'vertical',width:2,length:8}],{strikeHeightBonus:2,sprinkleBonus:1},()=>({kind:'sprinkle',count:0}))[0].length,10);
 assert.deepEqual(transformRunAttack([],{sprinkleBonus:2},()=>({kind:'sprinkle',count:0})),[]);
});
test('rank descriptions report cumulative benefits and capped next rank',()=>{
 const c=validateCampaign(DEFAULT_CAMPAIGN),u=c.upgrades.find(u=>u.id==='extra-sprinkles');assert.equal(modifiers(c,{'extra-sprinkles':2}).sprinkleBonus,2);const p=upgradePreview(c,{'extra-sprinkles':1},u.id);assert.equal(p.rank,1);assert.equal(p.nextRank,2);assert.equal(p.effects[0].current,1);assert.equal(p.effects[0].next,2);
});
test('bot actions and both boards reproduce across mid-fight save/resume',()=>{
 const a=createRun({seed:71});startEncounter(a);inputRun(a,['left','cw','fastOn']);for(let i=0;i<420;i++)stepRun(a);const b=restoreRun(serializeRun(a));assert.equal(hashState(a.game),hashState(b.game));
 for(let i=0;i<180;i++){stepRun(a);stepRun(b);}assert.equal(hashState(a.game),hashState(b.game));assert.deepEqual(a.room.bot,b.room.bot);
});
test('ordinary engine behavior is unchanged when outgoing hook is absent',()=>{
 const a=createMatch({seed:71}),b=clone(a);for(let i=0;i<600;i++){const actions=i%120===0?[{side:0,action:'fastOn'},{side:1,action:'fastOn'}]:[];step(a,1000/60,actions);step(b,1000/60,actions,{});}assert.equal(hashState(a),hashState(b));
});

test('ordinary duels retain pre-hook engine-9 attack and future hashes',()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/engine9-outgoing.json',import.meta.url),'utf8')),game=f.initial;let tick=0;for(const sample of f.samples){while(tick<sample.tick){step(game,1000/60);tick++;}assert.equal(hashState(game),sample.hash,'tick '+tick);}
});
