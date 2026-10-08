/** Real engine/autoplayer smoke run; no board mutation or fabricated victories. */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createClimb,startClimb,inputClimb,stepClimb,choosePath,chooseClimbReward,continueClimb} from '../dist/climb-run.js';
import {serializeClimb,restoreClimb} from '../dist/climb-save.js';
import {planMove,botProfile} from '../dist/ai.js';
import {pairAt,hashState} from '../dist/engine.js';
export function simulateClimb(seed=42,{targetDepth=10,checkSaves=true}={}){
 let r=createClimb({seed}),key='',snapshots=0,maxBytes=0;const phases=new Set();
 for(let guard=0;guard<180000&&!['lost','abandoned'].includes(r.phase)&&r.depth<targetDepth;guard++){
  if(r.phase==='route')choosePath(r,r.paths.find(e=>e.kind==='wave')?.id??r.paths[0].id);
  if(r.phase==='ready'){startClimb(r);key='';}
  if(r.phase==='reward'){chooseClimbReward(r,r.offers.find(id=>id==='breaker-supply')??r.offers[0]);continue;}
  if(r.phase==='result'){continueClimb(r);continue;}
  const p=r.game.players[0],nextKey=r.encounter.id+':'+p.nextIndex;
  if(p.phase==='fall'&&nextKey!==key){key=nextKey;const plan=planMove({board:p.board,active:p.active,nextPair:pairAt(r.game.seed,p.nextIndex,r.game.rules.breakerRate),opponent:botProfile('hard',0)});inputClimb(r,[...plan.path,'fastOn']);}
  stepClimb(r);
  const phase=r.phase==='playing'?p.phase:r.phase;
  if(checkSaves&&!phases.has(phase)){phases.add(phase);const saved=serializeClimb(r),before=r.game?hashState(r.game):null;r=restoreClimb(saved);assert.equal(r.game?hashState(r.game):null,before);assert.equal(serializeClimb(r),saved);snapshots++;}
  if(r.phase==='reward')maxBytes=Math.max(maxBytes,serializeClimb(r).length);
 }
 const saved=serializeClimb(r),restored=restoreClimb(saved);assert.equal(restored.depth,r.depth);assert.equal(restored.totalScore,r.totalScore);assert.equal(restored.phase,r.phase);
 return {seed,depth:r.depth,phase:r.phase,reason:r.reason,score:r.totalScore,ticks:r.totalTicks,checkpoint:r.lastBonusDepth,snapshots,phases:[...phases],maxSaveBytes:maxBytes,saveBytes:saved.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){for(const seed of process.argv.slice(2).length?process.argv.slice(2).map(Number):[42,771,7])console.log(JSON.stringify(simulateClimb(seed)));}
