import test from 'node:test';
import assert from 'node:assert/strict';
import {SURVIVAL_CAMPAIGN as DEFAULT_CAMPAIGN,validateCampaign,modifiers,rewardChoices} from '../dist/rogue-content.js';
import {createRun,startEncounter,stepRun,inputRun,chooseReward,abandonRun,TICK_MS} from '../dist/rogue-run.js';
import {serializeRun,restoreRun} from '../dist/rogue-save.js';
import {runView} from '../dist/rogue-view.js';
import {block,hashState} from '../dist/engine.js';

const content=()=>{const c=structuredClone(DEFAULT_CAMPAIGN);c.encounters.forEach(e=>{e.durationMs=1000;e.objective={kind:'survive',target:1000};e.attacks.firstMs=2000;});return c;};
const finishRoom=r=>{for(let i=0;i<2000&&r.phase==='playing';i++)stepRun(r);assert.notEqual(r.phase,'playing');};
test('campaign validation rejects duplicate ids, broken references and unknown effects',()=>{
 for(const change of [c=>c.encounters[1].id=c.encounters[0].id,c=>c.route[0]=['missing'],c=>c.upgrades[0].effects[0].kind='execute',c=>c.encounters[0].attacks.intervalMs=0,c=>c.encounters[0].durationMs=Infinity,c=>c.encounters[0].objective.kind='unknown']){const c=content();change(c);assert.throws(()=>validateCampaign(c));}
});
test('run snapshots definitions; route and reward draws reproduce and cap stacks',()=>{
 const c=content(),a=createRun({seed:42,content:c}),b=createRun({seed:42,content:c});c.encounters[0].name='Changed';assert.deepEqual(a,b);assert.notEqual(a.content.encounters[0].name,'Changed');
 const inv=Object.fromEntries(a.content.upgrades.map(u=>[u.id,u.maxStacks]));assert.deepEqual(rewardChoices(a.content,inv,42,0),[]);
 assert.deepEqual(rewardChoices(a.content,{},42,0),rewardChoices(a.content,{},42,0));assert.ok(modifiers(a.content,{}).breakerBonus===0);
});
test('complete run traverses rooms and rewards once with clean boards',()=>{
 const r=createRun({seed:123,content:content()});assert.equal(r.phase,'ready');assert.throws(()=>chooseReward(r,'none'));
 for(let i=0;i<r.route.length;i++){startEncounter(r);assert.equal(r.game.players[0].nextIndex,1);assert.equal(r.game.players[0].board.flat().filter(Boolean).length,0);finishRoom(r);
  if(i<r.route.length-1){assert.equal(r.phase,'reward');const id=r.offers[0];chooseReward(r,id);assert.equal(r.inventory[id],1);assert.throws(()=>chooseReward(r,id));assert.equal(r.phase,'ready');}}
 assert.equal(r.phase,'won');assert.equal(r.results.length,3);const tick=r.tick;stepRun(r);assert.equal(r.tick,tick);assert.throws(()=>startEncounter(r));
});
test('real completed breaker clear scores and meets block objective',()=>{
 const c=content();c.encounters[0].objective={kind:'blocks',target:2};const r=createRun({content:c,rules:{spawnGraceMs:0,lockMs:0}});startEncounter(r);const p=r.game.players[0];p.board[0][0]=block(0);p.active={x:0,y:1,r:0,pair:[block(0,true),block(2)]};
 for(let i=0;i<120&&r.phase==='playing';i++)stepRun(r);assert.equal(r.phase,'reward');assert.equal(r.room.blocks,2);assert.ok(r.totalScore>=20);
});
test('hazards queue until placement, enter as one batch, and death beats victory',()=>{
 const c=content();c.encounters[0].durationMs=10000;c.encounters[0].objective.target=10000;c.encounters[0].attacks.firstMs=100;c.encounters[0].attacks.jitter=0;
 const r=createRun({content:c,rules:{spawnGraceMs:0,lockMs:0}});startEncounter(r);for(let i=0;i<6;i++)stepRun(r);const p=r.game.players[0];assert.equal(p.incoming.length,1);assert.equal(p.stats.pieces,0);
 p.active={x:0,y:0,r:0,pair:[block(0),block(1)]};stepRun(r);assert.equal(p.incoming.length,0);assert.ok(p.readyAttacks.length||p.phase==='attack');
 const d=createRun({content:content()});startEncounter(d);d.game.players[0].dead=true;stepRun(d);assert.equal(d.phase,'lost');
});
test('time limit fails an unmet objective and terminals ignore input',()=>{
 const c=content();c.encounters[0].objective={kind:'score',target:9999};const r=createRun({content:c});startEncounter(r);finishRoom(r);assert.equal(r.phase,'lost');assert.equal(r.reason,'time');const saved=serializeRun(r);assert.equal(inputRun(r,['cw']),false);assert.equal(serializeRun(r),saved);
});
test('mid-encounter and reward saves resume deterministically; rewards cannot reroll',()=>{
 const r=createRun({seed:8,content:content()});startEncounter(r);inputRun(r,['left','cw','fastOn']);for(let i=0;i<21;i++)stepRun(r);
 const restored=restoreRun(serializeRun(r));assert.equal(hashState(r.game),hashState(restored.game));assert.deepEqual(runView(r),runView(restored));finishRoom(r);finishRoom(restored);assert.deepEqual(r.offers,restored.offers);const saved=restoreRun(serializeRun(r));assert.deepEqual(saved.offers,r.offers);
 chooseReward(r,r.offers[0]);chooseReward(saved,saved.offers[0]);startEncounter(r);startEncounter(saved);for(let i=0;i<10;i++)stepRun(r),stepRun(saved);assert.deepEqual(runView(r),runView(saved));
});
test('save validation rejects incompatible, oversized, reordered and impossible journals',()=>{
 const r=createRun({content:content()});startEncounter(r);for(let i=0;i<10;i++)stepRun(r);inputRun(r,['cw']);const s=JSON.parse(serializeRun(r));
 for(const edit of [v=>v.version=999,v=>v.engineVersion=0,v=>v.tick=1e10,v=>v.commands[0].tick=-1,v=>v.commands.push({tick:10,type:'reward',id:'fake'})]){const copy=structuredClone(s);edit(copy);assert.throws(()=>restoreRun(JSON.stringify(copy)));}
 assert.throws(()=>restoreRun('{'));assert.throws(()=>restoreRun(' '.repeat(2000001)));
});
test('view models and render snapshots cannot mutate the run; abandon is explicit',()=>{
 const r=createRun({content:content()});startEncounter(r);const v=runView(r);v.board.active.x=0;assert.equal(r.game.players[0].active.x,3);abandonRun(r);assert.equal(r.phase,'abandoned');assert.equal(restoreRun(serializeRun(r)).phase,'abandoned');assert.equal(TICK_MS,1000/60);
});
test('authored ids cannot inherit fake inventory stacks from Object.prototype',()=>{
 const c=content();c.upgrades=[{...c.upgrades[0],id:'constructor'}];const r=createRun({content:c});assert.deepEqual(runView(r).inventory,[]);startEncounter(r);assert.equal(r.room.effect.scorePercent,0);finishRoom(r);assert.deepEqual(r.offers,['constructor']);chooseReward(r,'constructor');startEncounter(r);assert.equal(r.room.effect.scorePercent,20);assert.equal(runView(r).inventory[0].stacks,1);assert.deepEqual(restoreRun(serializeRun(r)).inventory,{constructor:1});
});
test('earned upgrades apply actual score, breaker and wave effects only on the next board',()=>{
 for(const kind of ['scorePercent','breakerBonus','attackDelayMs','chainBonus']){
  const c=content();c.upgrades=[c.upgrades.find(u=>u.effects[0].kind===kind)];const r=createRun({content:c});startEncounter(r);assert.equal(r.room.effect[kind],0);finishRoom(r);chooseReward(r,r.offers[0]);startEncounter(r);assert.equal(r.room.effect[kind],c.upgrades[0].effects[0].amount);
  if(kind==='breakerBonus')assert.equal(r.game.rules.breakerRate,.27);
  if(kind==='attackDelayMs')assert.ok(r.room.nextWaveTick>170);
  if(kind==='scorePercent'){const p=r.game.players[0];p.spawnGrace=0;p.lock=999;p.board[0][0]=block(0);p.active={x:0,y:1,r:0,pair:[block(0,true),block(2)]};for(let i=0;i<50&&!r.room.score;i++)stepRun(r);assert.equal(r.room.score,24);}
 }
});
test('an exhausted reward pool advances without stranding the run',()=>{
 const c=content();c.upgrades=[];const r=createRun({content:c});startEncounter(r);finishRoom(r);assert.equal(r.phase,'ready');assert.equal(r.roomIndex,1);assert.deepEqual(r.offers,[]);assert.equal(restoreRun(serializeRun(r)).roomIndex,1);
});
test('invalid input batches are rejected atomically and missing save recipe fields never default',()=>{
 const r=createRun({content:content()});startEncounter(r);const saved=serializeRun(r);assert.throws(()=>inputRun(r,['left','hack']));assert.equal(serializeRun(r),saved);
 for(const key of ['seed','content','rules','pool']){const data=JSON.parse(saved);delete data.recipe[key];assert.throws(()=>restoreRun(JSON.stringify(data)));}
});
test('chain upgrades pay on completed chain stages, not breaking animations',()=>{
 const c=content();c.encounters.forEach(e=>{e.durationMs=10000;e.objective={kind:'score',target:10000};});
 const r=createRun({content:c,rules:{spawnGraceMs:0,lockMs:0}});r.inventory['chain-value']=1;startEncounter(r);const p=r.game.players[0],b=p.board;
 b[0][0]=block(1);b[1][0]=block(0);b[2][0]=block(1,true);b[0][1]=block(2);b[1][1]=block(0,true);p.active={x:4,y:0,r:0,pair:[block(2),block(3)]};
 let breaking=false;for(let i=0;i<180&&!r.room.bestCombo;i++){stepRun(r);if(r.events.some(e=>e.type==='puzzle-breaking')){breaking=true;assert.equal(r.room.score,0);}}
 assert.ok(breaking);for(let i=0;i<180&&r.room.bestCombo<2;i++)stepRun(r);
 assert.equal(r.room.bestCombo,2);assert.equal(r.room.score,90); // 20 single + 40 double + 30 chain bonus.
});
test('content totals and effect caps bound author mistakes',()=>{
 const c=content();c.route=Array.from({length:8},()=>['opening']);c.encounters[0].durationMs=180000;assert.throws(()=>validateCampaign(c),/ten minutes/);
 const d=content(),inventory=Object.fromEntries(d.upgrades.map(u=>[u.id,999]));const m=modifiers(d,inventory);assert.equal(m.scorePercent,60);assert.equal(m.breakerBonus,.06);assert.equal(m.attackDelayMs,3000);
});
