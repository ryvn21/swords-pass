/** Run with node tests/rogue-simulate.mjs [seed...]. No browser or rendering needed. */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRun,startEncounter,inputRun,stepRun,chooseReward,isTerminal} from '../dist/rogue-run.js';
import {serializeRun,restoreRun} from '../dist/rogue-save.js';
import {planMove,botProfile} from '../dist/ai.js';
import {pairAt,hashState} from '../dist/engine.js';

export function simulate(seed=42,{checkSaves=true,content}={}){
 let run=createRun({seed,content}),key='',snapshots=0;const phases=new Set();
 for(let guard=0;guard<40000&&!isTerminal(run);guard++){
  if(run.phase==='ready'){startEncounter(run);key='';}
  if(run.phase==='reward'){chooseReward(run,run.offers[0]);continue;}
  const p=run.game.players[0],nextKey=run.roomIndex+':'+p.nextIndex;
  if(p.phase==='fall'&&nextKey!==key){key=nextKey;const plan=planMove({board:p.board,active:p.active,nextPair:pairAt(run.game.seed,p.nextIndex,run.game.rules.breakerRate),opponent:botProfile('hard',0)});for(const action of plan.path)inputRun(run,[action]);inputRun(run,['fastOn']);}
  stepRun(run);
  const phase=p.phase;
  if(checkSaves&&!phases.has(phase)){phases.add(phase);const before=hashState(run.game),saved=serializeRun(run);run=restoreRun(saved);assert.equal(hashState(run.game),before);assert.equal(serializeRun(run),saved);snapshots++;}
 }
 assert.ok(isTerminal(run));const restored=restoreRun(serializeRun(run));assert.equal(restored.totalScore,run.totalScore);assert.equal(restored.phase,run.phase);
 return {seed,phase:run.phase,ticks:run.tick,score:run.totalScore,blocks:run.totalBlocks,rooms:run.results.length,snapshots,phases:[...phases],saveBytes:serializeRun(run).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){for(const seed of process.argv.slice(2).length?process.argv.slice(2).map(Number):[7,42,771])console.log(JSON.stringify(simulate(seed)));}
