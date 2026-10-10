/** Presentation contract for the climb. No renderer may mutate these snapshots. */
import {clone,pairAt,previewIndex} from './engine.js';
import {modifiers,stacksOf} from './rogue-content.js';
import {upgradePreview} from './rogue-upgrades.js';
import {combatMetrics,climbWave,TICK_MS} from './climb-combat.js';
import {objectiveProgress,objectiveLabel} from './climb-objectives.js';
import {nextCheckpoint} from './climb-generator.js';
export function climbView(r){
 const e=r.encounter,playing=r.phase==='playing',room=r.room,metrics=combatMetrics(r);
 const finished=['lost','abandoned'].includes(r.phase);
 return {version:2,kind:'climb',phase:r.phase,seed:r.seed,title:r.content.name,depth:r.depth,nextCheckpoint:nextCheckpoint(r.content,r.depth),activeMs:r.totalTicks*TICK_MS,
  roomIndex:e.depth-1,roomCount:null,encounter:clone(e),paths:clone(r.paths),objectiveText:objectiveLabel(e.objective),objectiveProgress:objectiveProgress(e.objective,metrics),optionalProgress:e.optional?objectiveProgress(e.optional,metrics):null,
  remainingMs:Math.max(0,e.durationMs-(room?.ticks??0)*TICK_MS),totalScore:r.totalScore,lives:r.lives??0,totalBlocks:r.totalBlocks,bestCombo:r.bestCombo,roomScore:room?.score??0,reason:r.reason,
  inventory:r.content.upgrades.filter(u=>stacksOf(r.inventory,u.id)).map(u=>({...upgradePreview(r.content,r.inventory,u.id,r.rules),stacks:stacksOf(r.inventory,u.id)})),
  offers:r.offers.map(id=>id==='bank-points'?{id,name:'Bank 50 points',description:'All available upgrades are at their effective caps. Add 50 points and keep climbing.',pointReward:true}:upgradePreview(r.content,r.inventory,id,r.rules)),
  effects:modifiers(r.content,r.inventory),nextWave:playing?climbWave(r):null,queuedWaves:r.game?.players[0].incoming.length??0,
  opponent:e.kind==='duel'?{...clone(e.opponent),board:r.game?clone(r.game.players[1]):null,nextPair:r.game?pairAt(r.game.seed,previewIndex(r.game.players[1]),r.rules.breakerRate):null,patternName:room?.opponentPatternName??null,queuedWaves:r.game?.players[1].incoming.length??0}:null,
  sentSprinkles:room?.sentSprinkles??0,sentSwords:room?.sentSwords??0,board:r.game?clone(r.game.players[0]):null,rules:clone(r.game?.rules??r.rules),nextPair:r.game?pairAt(r.game.seed,previewIndex(r.game.players[0]),r.game.rules.breakerRate):null,
  results:clone(r.results),lastResult:clone(r.lastResult),events:clone(r.events),canStart:r.phase==='ready',canChoose:r.phase==='reward',canPlay:playing,finished};
}
