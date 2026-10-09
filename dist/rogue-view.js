import {climbView} from './climb-view.js';
/** Detached, presentation-only snapshot. Claude can replace the adapter, not the rules. */
import {clone,pairAt,previewIndex} from './engine.js';
import {currentEncounter,upcomingWave,TICK_MS,isTerminal} from './rogue-run.js';
import {modifiers,stacksOf} from './rogue-content.js';
import {upgradePreview} from './rogue-upgrades.js';
export function runView(r){
 if(r.kind==='climb')return climbView(r);
 const e=currentEncounter(r),playing=r.phase==='playing',room=r.room,objective=e.objective;
 const progress=r.phase==='ready'?0:objective.kind==='defeat'?(r.game?.players[1].dead?1:0):objective.kind==='survive'?(room?.ticks??0)*TICK_MS:objective.kind==='blocks'?room?.blocks??0:room?.score??0;
 return {version:1,phase:r.phase,seed:r.seed,title:r.content.name,roomIndex:r.roomIndex,roomCount:r.route.length,encounter:clone(e),progress:Math.min(objective.target,progress),remainingMs:Math.max(0,e.durationMs-(r.phase==='ready'?0:(room?.ticks??0)*TICK_MS)),totalScore:r.totalScore,totalBlocks:r.totalBlocks,bestCombo:r.bestCombo,roomScore:room?.score??0,reason:r.reason,
  inventory:r.content.upgrades.filter(u=>stacksOf(r.inventory,u.id)).map(u=>({...upgradePreview(r.content,r.inventory,u.id),stacks:stacksOf(r.inventory,u.id)})),offers:r.offers.map(id=>upgradePreview(r.content,r.inventory,id)),effects:modifiers(r.content,r.inventory),nextWave:playing?upcomingWave(r):null,queuedWaves:r.game?.players[0].incoming.length??0,
  opponent:e.kind==='duel'?{...clone(e.opponent),board:r.game&&r.phase!=='ready'?clone(r.game.players[1]):null,nextPair:r.game?pairAt(r.game.seed,previewIndex(r.game.players[1]),r.rules.breakerRate):null,patternName:room?.opponentPatternName??null,queuedWaves:r.game?.players[1].incoming.length??0}:null,sentSprinkles:room?.sentSprinkles??0,sentSwords:room?.sentSwords??0,
  board:r.game?clone(r.game.players[0]):null,rules:clone(r.game?.rules??r.rules),nextPair:r.game?pairAt(r.game.seed,previewIndex(r.game.players[0]),r.game.rules.breakerRate):null,results:clone(r.results),events:clone(r.events),canStart:r.phase==='ready',canChoose:r.phase==='reward',canPlay:playing,finished:isTerminal(r)};
}
