import {createMatch,step,pairAt,random,DEFAULT_RULES,clone} from './engine.js';
import {handlingRules} from './handling-profile.js';
import {DEFAULT_PROGRESSION,readProgression,progressionAt} from './progression.js';
import {assignPatterns} from './pattern-pool.js';
export const CHALLENGE_VERSION=3,TIMED_MS=120000;
export const breakerRateAt=(index,config=DEFAULT_PROGRESSION)=>config.breakerStart+(config.breakerCap-config.breakerStart)*Math.min(1,Math.max(0,index)/config.breakerRampPairs);
export const challengePair=(seed,index,config=DEFAULT_PROGRESSION)=>pairAt(seed,index,breakerRateAt(index,config));
export const scoreClear=(count,chain)=>Math.round((10*count+5*Math.max(0,count-4))*Math.max(1,chain));
export const pressureAt=(ms,config=DEFAULT_PROGRESSION)=>progressionAt(ms,config);
export function hazardAt(seed,index,config=DEFAULT_PROGRESSION,pool){
 let at=0;for(let i=0;i<=index;i++){const r=random((seed^0x73ab912f^Math.imul(i+1,2654435761))>>>0);at+=Math.round((i?progressionAt(at,config).intervalMs:config.firstAttackSec*1000)*(1-config.jitter+r()*config.jitter*2));}
 const r=random((seed^0x19ef4c03^Math.imul(index+1,2246822519))>>>0),stage=progressionAt(at,config).stage;
 const sword=assignPatterns(seed^Math.imul(index+1,19283),1,pool)[0],pattern=sword.rows,attacks=[],base=index*10,hand=index%2?-1:1;
 for(let i=0;i<stage.swords;i++)attacks.push({kind:index>1&&r()<.2?'horizontal':'vertical',width:stage.width,length:stage.length,stage:i+1,index:index+i,hand:i?-hand:hand,id:base+i+1,pattern:clone(pattern)});
 if(stage.sprinkles)attacks.push({kind:'sprinkle',count:stage.sprinkles,hand,id:base+8,pattern:clone(pattern)});
 return {index,at,id:base+9,attacks,patternName:sword.name,stageName:stage.name};
}
export function createChallenge({seed=1,players=1,mode='timed',rules=DEFAULT_RULES,progression=DEFAULT_PROGRESSION,pool}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||![1,4].includes(players)||!['timed','endless'].includes(mode))throw Error('Invalid challenge options.');
 const config=readProgression(mode==='endless'?progression:DEFAULT_PROGRESSION),assigned=assignPatterns(seed,players,pool);
 const entries=Array.from({length:players},(_,id)=>{const game=createMatch({seed,mode:'practice',rules:handlingRules(rules),pattern:assigned[id].rows});game.players[0].active.pair=challengePair(seed,0,config);return {id,patternName:assigned[id].name,attacksReceived:0,name:['You','Pip','Marlow','Rook'][id],game,score:0,blocks:0,bestCombo:0,lastClear:null,deathAt:null};});
 return {version:CHALLENGE_VERSION,seed,mode,progression:config,pool:clone(pool??assigned),elapsed:0,tick:0,entries,nextHazard:hazardAt(seed,0,config,pool),lastHazard:null,hazards:0,finished:false,reason:null,events:[]};
}
export function stepChallenge(c,dt=1000/60,actions=[]){
 if(c.finished)return c;dt=Math.max(0,Math.min(dt,c.mode==='timed'?TIMED_MS-c.elapsed:dt));if(!dt)return c;
 c.tick++;c.elapsed+=dt;c.events=[];
 while(c.nextHazard.at<=c.elapsed){const h=c.nextHazard;for(const e of c.entries){const p=e.game.players[0];if(!p.dead)p.incoming.push({kind:'batch',id:h.id,sourceTurn:h.index,due:p.turn+1,attacks:clone(h.attacks)});}c.hazards++;c.lastHazard=h;c.events.push({type:'hazard',index:h.index});c.nextHazard=hazardAt(c.seed,h.index+1,c.progression,c.pool);}
 for(const e of c.entries){const p=e.game.players[0];if(p.dead){e.deathAt??=c.elapsed;continue;}const next=p.nextIndex;
  step(e.game,dt,actions.filter(a=>a.side===e.id).map(a=>({side:0,action:a.action})));
  if(p.nextIndex!==next&&p.active)p.active.pair=challengePair(c.seed,p.nextIndex-1,c.progression);
  for(const event of e.game.events){if(event.type==='hit')e.attacksReceived++;if(event.type==='clear'){const points=scoreClear(event.cleared.length,event.chain);e.score+=points;e.blocks+=event.cleared.length;e.bestCombo=Math.max(e.bestCombo,event.chain);e.lastClear={points,chain:event.chain,at:c.elapsed};}c.events.push({...event,side:e.id});}
  if(p.dead)e.deathAt=c.elapsed;
 }
 if(c.entries.every(e=>e.game.players[0].dead)){c.finished=true;c.reason='eliminated';}
 else if(c.mode==='timed'&&c.elapsed>=TIMED_MS){c.finished=true;c.reason='time';}
 return c;
}
export function standings(c){let rank=0,previous=null;return [...c.entries].sort((a,b)=>b.score-a.score||a.id-b.id).map((e,i)=>{if(e.score!==previous)rank=i+1;previous=e.score;return {id:e.id,name:e.name,score:e.score,rank,dead:e.game.players[0].dead};});}
