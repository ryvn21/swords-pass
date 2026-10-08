import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,command,step,block,H,clone,hashState} from '../dist/engine.js';
import {migrateSpawnAdjustment,HANDLING_PRESETS} from '../dist/handling-profile.js';
import {createRun,startEncounter} from '../dist/rogue-run.js';
import {createClimb,choosePath} from '../dist/climb-run.js';
import {createChallenge} from '../dist/challenge.js';
import {createPairedDuels} from '../dist/paired-duels.js';
import {readFileSync} from 'node:fs';
import {serializeRun,restoreRun} from '../dist/rogue-save.js';
import {inputRun,stepRun,chooseReward} from '../dist/rogue-run.js';
import {initialFromReplay,stepReplay} from '../dist/replay.js';
import * as legacy9 from '../dist/legacy-engine-v9.js';

test('a new pair has 250ms of positioning time before natural fall begins',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];
 step(m,200);assert.equal(p.fall,0);assert.equal(p.spawnGrace,50);
 command(m,0,'left');command(m,0,'cw');assert.equal(p.active.x,2);assert.equal(p.active.r,1);
 step(m,50);assert.equal(p.fall,0);assert.equal(p.spawnGrace,0);
 step(m,100);assert.equal(p.fall,100);assert.equal(p.nextIndex,1);
});

test('a fresh fast-fall press cancels spawn grace without teleporting or removing steering',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0],pair=clone(p.active.pair);
 step(m,50);command(m,0,'fastOn');assert.equal(p.spawnGrace,0);assert.equal(p.active.y,H-1);
 step(m,100);assert.equal(p.fall,100);assert.equal(p.active.y,H-1);
 command(m,0,'left');command(m,0,'cw');step(m,100);
 assert.equal(p.active.x,2);assert.equal(p.active.r,1);assert.equal(p.active.y,H-2);assert.deepEqual(p.active.pair,pair);
 command(m,0,'fastOff');assert.equal(p.fast,false);assert.equal(p.spawnGrace,0);
});

test('presses between pieces cannot pre-arm fast fall or cancel the next spawn window',()=>{
 const m=createMatch({mode:'practice',rules:{entryMs:60}}),p=m.players[0];
 p.active=null;p.phase='entry';p.timer=60;assert.equal(command(m,0,'fastOn'),false);
 step(m,60);assert.equal(p.phase,'fall');assert.equal(p.fast,false);assert.equal(p.spawnGrace,250);
 step(m,50);assert.equal(p.spawnGrace,200);assert.equal(p.fall,0);
 command(m,0,'fastOff');command(m,0,'fastOn');assert.equal(p.spawnGrace,0);assert.equal(p.fast,true);
});

test('releasing Space during grace keeps the remaining adjustment time',()=>{
 const m=createMatch({mode:'practice'}),p=m.players[0];step(m,50);command(m,0,'fastOff');
 assert.equal(p.spawnGrace,200);step(m,100);assert.equal(p.fall,0);
});

test('high stacks keep the spawn protection until a deliberate fast-fall press',()=>{
 const m=createMatch({mode:'practice',rules:{lockMs:100}}),p=m.players[0];p.board[H-2][3]=block(2);
 step(m,200);assert.equal(p.stats.pieces,0);assert.equal(p.lock,0);
 command(m,0,'fastOn');step(m,50);assert.equal(p.lock,50);assert.equal(p.stats.pieces,0);
 command(m,0,'left');step(m,50);assert.equal(p.active.x,2);assert.equal(p.dead,false);assert.equal(p.stats.pieces,0);
});

test('new-game defaults update once without rewriting custom handling or the input object',()=>{
 for(const [old,expected] of [[undefined,250],[125,250],[250,250],[0,0],[175,175],[400,400]]){
  const original={spawnAdjustmentVersion:1,rules:{spawnGraceMs:old,gravityMs:930,entryMs:85}},copy=clone(original);
  const next=migrateSpawnAdjustment(original);assert.equal(next.rules.spawnGraceMs,expected);assert.equal(next.spawnAdjustmentVersion,2);
  assert.equal(next.rules.gravityMs,930);assert.equal(next.rules.entryMs,85);assert.deepEqual(original,copy);assert.deepEqual(migrateSpawnAdjustment(next),next);
 }
 assert.equal(migrateSpawnAdjustment({spawnAdjustmentVersion:2,rules:{spawnGraceMs:125}}).rules.spawnGraceMs,125);
 for(const p of HANDLING_PRESETS)assert.equal(p.rules.spawnGraceMs,250);
});

test('fresh practice, duel, challenge, paired duel and solo runs share spawn timing',()=>{
 const finite=createRun(),climb=createClimb();startEncounter(finite);startEncounter(climb);
 const challenge=createChallenge(),paired=createPairedDuels();
 const games=[createMatch(),createMatch({mode:'practice'}),finite.game,climb.game,challenge.entries[0].game,...paired.matches.map(m=>m.game)];
 for(const game of games){assert.equal(game.rules.spawnGraceMs,250);command(game,0,'fastOn');assert.equal(game.players[0].spawnGrace,0);}
});

test('published engine-9 finite and climb saves restore both boards and their future exactly',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/spawn-engine9-runs.json',import.meta.url),'utf8'));
 for(const f of fixtures){const r=restoreRun(f.save);assert.equal(r.engineVersion,9);assert.equal(hashState(r.game),f.hash);assert.equal(serializeRun(r),f.save);
  for(let i=0;i<500;i++)stepRun(r);assert.equal(hashState(r.game),f.futureHash);
  r.game.players[1].dead=true;stepRun(r);assert.equal(r.phase,'reward');chooseReward(r,r.offers[0]);
  if(r.phase==='route')choosePath(r,r.paths.find(e=>e.kind==='duel').id);
  startEncounter(r);assert.equal(r.game.version,9);assert.equal(r.game.rules.spawnGraceMs,125);
  inputRun(r,['fastOn']);assert.equal(r.game.players[0].spawnGrace,125);
 }
});

test('engine-9 match replays retain their non-cancellable grace and original hashes',()=>{
 const initial=legacy9.createMatch({seed:51,mode:'practice'}),a=clone(initial),b=initialFromReplay({version:9,initial,actions:[],ticks:900});
 for(let tick=0;tick<900;tick++){const inputs=tick%120===0?[{side:0,action:'fastOn'}]:[];legacy9.step(a,1000/60,inputs);stepReplay(b,1000/60,inputs);}
 assert.equal(hashState(a),hashState(b));
});

test('new saves and replays reproduce cancelled grace and per-pair fast fall',()=>{
 for(const create of [createRun,createClimb]){const r=create({seed:42});startEncounter(r);inputRun(r,['fastOn']);for(let i=0;i<55;i++)stepRun(r);
  const restored=restoreRun(serializeRun(r));assert.equal(restored.engineVersion,10);assert.equal(hashState(restored.game),hashState(r.game));
  for(let i=0;i<300;i++){stepRun(r);stepRun(restored);}assert.equal(hashState(restored.game),hashState(r.game));
 }
 const initial=createMatch({mode:'practice'}),a=clone(initial),b=initialFromReplay({version:10,initial,actions:[],ticks:300});
 for(let i=0;i<300;i++){const inputs=i===0?[{side:0,action:'fastOn'}]:[];step(a,1000/60,inputs);stepReplay(b,1000/60,inputs);}assert.equal(hashState(a),hashState(b));
});
