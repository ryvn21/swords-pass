/** Run-v2 bot policy. Decisions use simulation ticks; no worker arrival or wall-clock randomness. */
import {botProfile,planMove} from './ai.js';
import {command,pairAt} from './engine.js';
const DT=1000/60;
export function createRunBot(config){
 // A single-ply search keeps planning bounded on the UI thread. Strength varies
 // through evaluation style and the authored thinking/action cadence.
 const profile={...botProfile(config.difficulty,config.style),depth:1};
 return {profile,thinkTicks:Math.max(1,Math.ceil(profile.think/config.pace/DT)),actionTicks:Math.max(1,Math.ceil(profile.actionMs/config.pace/DT)),pairIndex:-1,path:[],at:0};
}
export function stepRunBot(game,brain,tick,breakerRate){
 const p=game.players[1];if(p.dead||game.players[0].dead||game.winner!==null||p.phase!=='fall'||!p.active)return;
 if(brain.pairIndex!==p.nextIndex){
  brain.pairIndex=p.nextIndex;
  const plan=planMove({board:p.board,active:p.active,nextPair:pairAt(game.seed,p.nextIndex,breakerRate),opponent:brain.profile});
  brain.path=[...plan.path,'fastOn'];brain.at=tick+brain.thinkTicks;
 }
 if(brain.path.length&&tick>=brain.at){command(game,1,brain.path.shift());brain.at=tick+brain.actionTicks;}
}
