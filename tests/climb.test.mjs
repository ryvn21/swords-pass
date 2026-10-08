import test from 'node:test';
import assert from 'node:assert/strict';
import {validateObjective,objectiveProgress,objectiveLabel} from '../dist/climb-objectives.js';
import {DEFAULT_CLIMB,validateClimb} from '../dist/climb-content.js';
import {encounterOffers,bonusEncounter,nextCheckpoint,isCheckpoint} from '../dist/climb-generator.js';
import {createClimb,startClimb,inputClimb,stepClimb,choosePath,chooseClimbReward,continueClimb,skipBonus} from '../dist/climb-run.js';
import {block,hashState} from '../dist/engine.js';
import {serializeClimb,restoreClimb,saveChecksum} from '../dist/climb-save.js';
import {runView} from '../dist/rogue-view.js';

test('composed objectives finish on all/any completed conditions and reject unplayable combinations',()=>{
 const objective=validateObjective({kind:'any',items:[{kind:'combo',target:2},{kind:'blocks',target:16}]},'wave');
 assert.equal(objectiveProgress(objective,{blocks:16,combo:1}).complete,true);
 assert.equal(objectiveProgress(objective,{blocks:2,combo:2}).complete,true);
 assert.equal(objectiveProgress(objective,{blocks:15,combo:1}).complete,false);
 const all=validateObjective({kind:'all',items:[{kind:'blocks',target:4},{kind:'score',target:60}]},'wave');
 assert.equal(objectiveProgress(all,{blocks:4,score:50}).complete,false);
 assert.equal(objectiveProgress(all,{blocks:4,score:60}).complete,true);
 assert.match(objectiveLabel(objective),/or/);
 assert.throws(()=>validateObjective({kind:'defeat',target:1},'wave'));
 assert.throws(()=>validateObjective({kind:'all',items:[{kind:'defeat',target:1},{kind:'score',target:500}]},'duel'));
 assert.throws(()=>validateObjective({kind:'combo',target:Infinity},'wave'));
});
test('generated routes are repeatable, varied, bounded and keep the opening easy',()=>{
 const config=validateClimb(DEFAULT_CLIMB);let history=[];const seen=new Set();
 for(let depth=1;depth<=250;depth++){
  const a=encounterOffers(config,71,depth,history),b=encounterOffers(config,71,depth,history);assert.deepEqual(a,b);assert.ok(a.length>=1&&a.length<=2);
  assert.equal(new Set(a.map(e=>e.templateId)).size,a.length);
  for(const e of a){seen.add(e.templateId);assert.ok(e.durationMs<=180000);validateObjective(e.objective,e.kind);if(e.attacks){assert.ok(e.attacks.intervalMs>=6000);assert.ok(e.attacks.swords<=2);assert.ok(e.attacks.sprinkles<=8);}if(e.opponent)assert.ok(e.opponent.pace<=1.35);}
  if(depth===1){assert.equal(a.length,1);assert.equal(a[0].kind,'duel');assert.equal(a[0].opponent.difficulty,'easy');}
  else {assert.ok(a.some(e=>e.kind==='duel'));assert.ok(a.some(e=>e.kind==='wave'));}
  assert.ok(!(history.at(-1)===a[0].templateId&&history.at(-2)===a[0].templateId));history=[...history,a[0].templateId].slice(-4);
 }
 assert.ok(seen.size>=5);
 assert.notDeepEqual(encounterOffers(config,71,8,[]),encounterOffers(config,72,8,[]));
 assert.ok(encounterOffers(config,71,100000,[]).length);
});
test('checkpoints are depth based and bonus rounds are separate authored events',()=>{
 const c=validateClimb(DEFAULT_CLIMB);assert.deepEqual([1,4,5,9,10,19,20,30].filter(d=>isCheckpoint(c,d)),[5,10,20,30]);
 assert.equal(nextCheckpoint(c,0),5);assert.equal(nextCheckpoint(c,5),10);assert.equal(nextCheckpoint(c,10),20);
 const bonus=bonusEncounter(c,42,5);assert.equal(bonus.bonus,true);assert.equal(bonus.depth,5);assert.equal(bonus.kind,'wave');assert.ok(bonus.durationMs<=45000);
});

const fastContent=()=>{const c=structuredClone(DEFAULT_CLIMB);c.templates=c.templates.map(t=>t.id==='duel'?t:{...t,kind:'wave',durationMs:1000,objective:{kind:'survive',target:1000},optional:undefined});c.bonus={...c.bonus,durationMs:1000,objective:{kind:'survive',target:1000}};return c;};
function win(r){startClimb(r);if(r.encounter.kind==='duel')r.game.players[1].dead=true;for(let i=0;i<10801&&r.phase==='playing';i++)stepClimb(r);assert.equal(r.phase,'reward');}
test('a climb advances beyond finite-run limits and checkpoints do not count as combat depth',()=>{
 const r=createClimb({seed:42,content:fastContent()});const bonusDepths=[];
 while(r.depth<22||r.encounter.bonus){
  if(r.phase==='route')choosePath(r,r.paths.find(e=>e.kind==='wave')?.id??r.paths[0].id);
  const prior=r.depth,isBonus=r.encounter.bonus;win(r);assert.equal(r.depth,prior+(isBonus?0:1));if(isBonus)bonusDepths.push(r.depth);chooseClimbReward(r,r.offers[0]);
 }
 assert.deepEqual(bonusDepths,[5,10,20]);assert.notEqual(r.phase,'won');assert.ok(r.commands.length===0);assert.ok(r.results.length<=12);
});
test('completed clears end the encounter immediately and human death beats a completion',()=>{
 const r=createClimb({seed:7});r.encounter={...encounterOffers(r.content,7,2,[]).find(e=>e.kind==='wave'),kind:'wave',id:'test',depth:1,bonus:false,durationMs:90000,objective:{kind:'blocks',target:2},rewardPoints:100,attacks:{firstMs:8000,intervalMs:12000,jitter:0,swords:1,width:1,length:4,sprinkles:1}};
 startClimb(r);const p=r.game.players[0];p.spawnGrace=0;p.lock=999;p.board[0][0]=block(0);p.active={x:0,y:1,r:0,pair:[block(0,true),block(2)]};
 for(let i=0;i<120&&r.phase==='playing';i++)stepClimb(r);assert.equal(r.phase,'reward');assert.ok(r.room.ticks<120);assert.equal(r.depth,1);
 const d=createClimb();startClimb(d);d.game.players[0].dead=true;d.game.players[1].dead=true;stepClimb(d);assert.equal(d.phase,'lost');assert.equal(d.depth,0);
});
test('route and reward choices validate atomically; bonuses may be missed or skipped safely',()=>{
 const r=createClimb({content:fastContent()});win(r);const before=JSON.stringify(r);assert.throws(()=>chooseClimbReward(r,'fake'));assert.equal(JSON.stringify(r),before);chooseClimbReward(r,r.offers[0]);assert.equal(r.phase,'route');const snapshot=JSON.stringify(r);assert.throws(()=>choosePath(r,'fake'));assert.equal(JSON.stringify(r),snapshot);
 while(r.depth<5){if(r.phase==='route')choosePath(r,r.paths.find(e=>e.kind==='wave')?.id??r.paths[0].id);win(r);chooseClimbReward(r,r.offers[0]);}
 assert.equal(r.encounter.bonus,true);skipBonus(r);assert.equal(r.phase,'result');assert.equal(r.depth,5);continueClimb(r);assert.equal(r.encounter.bonus,false);assert.equal(r.lastBonusDepth,5);
});
test('input, timing and wave pressure remain bounded',()=>{
 const r=createClimb();startClimb(r);assert.equal(r.game.rules.spawnGraceMs,250);assert.equal(r.game.players[0].board.length,13);const before=hashState(r.game);assert.throws(()=>inputClimb(r,['left','bad']));assert.equal(hashState(r.game),before);
});

test('climb saves rebuild both live boards and remain bounded after checkpoints',()=>{
 const r=createClimb({seed:71});startClimb(r);inputClimb(r,['left','cw','fastOn']);for(let i=0;i<420;i++)stepClimb(r);
 const text=serializeClimb(r),s=restoreClimb(text);assert.equal(hashState(r.game),hashState(s.game));assert.equal(serializeClimb(s),text);
 for(let i=0;i<180;i++){stepClimb(r);stepClimb(s);}assert.equal(hashState(r.game),hashState(s.game));assert.deepEqual(r.room.bot,s.room.bot);
 const c=createClimb({content:fastContent()});win(c);chooseClimbReward(c,c.offers[0]);const restored=restoreClimb(serializeClimb(c));assert.equal(restored.depth,1);assert.deepEqual(restored.paths,c.paths);assert.equal(restored.tick,0);assert.equal(restored.commands.length,0);
});
test('climb imports reject changed checksums, invalid versions, impossible commands and missing fields',()=>{
 const r=createClimb();startClimb(r);stepClimb(r);const save=JSON.parse(serializeClimb(r));
 for(const edit of [s=>s.climbVersion=99,s=>s.engineVersion=0,s=>s.checkpoint.depth++,s=>s.commands[0].type='skip',s=>s.commands.push({tick:0,type:'start'}),s=>delete s.recipe.pool,s=>s.tick=10801]){const s=structuredClone(save);edit(s);assert.throws(()=>restoreClimb(JSON.stringify(s)));}
});
test('import validation holds after a checksum is recomputed, and scaled targets stay in bounds',()=>{
 const r=createClimb();startClimb(r);stepClimb(r);const original=JSON.parse(serializeClimb(r));
 for(const edit of [s=>s.checkpoint=null,s=>s.checkpoint.inventory={'unknown':1},s=>s.commands.push({tick:1,type:'start'}),s=>s.commands[0].type='skip',s=>s.tick=10801,s=>s.recipe.content.upgrades[0].id='bank-points']){
  const s=structuredClone(original);edit(s);delete s.checksum;s.checksum=saveChecksum(s);assert.throws(()=>restoreClimb(JSON.stringify(s)));
 }
 const content=structuredClone(DEFAULT_CLIMB);content.templates.find(t=>t.id==='clear-sprint').objective.target=2000;
 const c=validateClimb(content);for(let seed=0;seed<20;seed++)for(const e of encounterOffers(c,seed,50,[]))assert.doesNotThrow(()=>validateObjective(e.objective,e.kind));
});
test('reward offers and previews use the effective breaker cap for the saved handling profile',()=>{
 const content=structuredClone(DEFAULT_CLIMB);content.upgrades=content.upgrades.filter(u=>u.id==='breaker-supply');
 const capped=createClimb({content,rules:{breakerRate:.4}});win(capped);assert.deepEqual(capped.offers,['bank-points']);
 const nearly=createClimb({content,rules:{breakerRate:.39}});win(nearly);assert.equal(nearly.offers[0],'breaker-supply');const effect=runView(nearly).offers[0].effects[0];assert.ok(Math.abs(effect.next-.01)<1e-9);
 const custom=createClimb({rules:{breakerRate:.6}});startClimb(custom);assert.equal(custom.game.rules.breakerRate,.6);
});

test('missed checkpoint bonuses continue once after save and restore',()=>{
 const base=createClimb(),bonus=createClimb({seed:11},{...base.anchor,depth:5});startClimb(bonus);
 for(let i=0;i<2100;i++)stepClimb(bonus);assert.equal(bonus.phase,'result');assert.equal(bonus.reason,'time');assert.equal(bonus.depth,5);
 const restored=restoreClimb(serializeClimb(bonus));assert.equal(restored.phase,'result');assert.equal(restored.lastBonusDepth,5);continueClimb(restored);assert.equal(restored.encounter.bonus,false);assert.equal(restored.encounter.depth,6);
});
test('wave queues stop growing and do not burst overdue waves after a held queue drains',()=>{
 const initial=createClimb(),r=createClimb({seed:42},{...initial.anchor,depth:49});choosePath(r,r.paths.find(e=>e.kind==='wave').id);startClimb(r);
 for(let i=0;i<500;i++)stepClimb(r);assert.equal(r.game.players[0].incoming.length,1);
 // Model a player holding a high active piece while the hazard schedule advances.
 r.game.players[0].spawnGrace=100000;
 for(let i=0;i<1200&&r.phase==='playing';i++)stepClimb(r);
 assert.equal(r.game.players[0].incoming.length,r.content.maxQueuedWaves);assert.equal(r.room.waves,2);
 r.game.players[0].incoming.pop();stepClimb(r);assert.equal(r.room.waves,3);assert.ok(r.room.nextWaveTick>r.room.ticks+100);stepClimb(r);assert.equal(r.room.waves,3);
});
