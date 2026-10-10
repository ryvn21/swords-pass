import * as climb from './climb-run.js';
import {climbWave} from './climb-combat.js';
export {createClimb,choosePath,continueClimb,retryClimb,skipBonus} from './climb-run.js';
/** Pure fixed-tick run state machine. This module has no DOM, storage, audio or wall clock. */
import * as legacy from './legacy-rogue-run-v1.js';
import {createRunBot,stepRunBot} from './rogue-bot.js';
import {transformRunAttack} from './rogue-upgrades.js';
import {createMatch,step,command,random,clone,VERSION,validatePattern,pairAt} from './engine.js';
import {handlingRules} from './handling-profile.js';
import {equippedSword} from './swords.js';
import {DEFAULT_CAMPAIGN,validateCampaign,numberIn,routeFor,rewardChoices,modifiers,stacksOf} from './rogue-content.js';

export const RUN_VERSION=2,TICK_MS=1000/60,MAX_TICKS=40000,MAX_COMMANDS=60000;
export const INPUTS=Object.freeze(['left','right','cw','ccw','fastOn','fastOff']);
export const isTerminal=run=>['won','lost','abandoned'].includes(run.phase);
const emit=(r,type,detail={})=>r.events.push({id:++r.eventId,tick:r.tick,type,...detail});
function record(r,entry){if(r.commands.length>=MAX_COMMANDS)throw Error('This run has reached its input limit. Export it before starting another.');r.commands.push({tick:r.tick,...entry});}
export const currentEncounter=r=>r.kind==='climb'?r.encounter:r.content.encounters.find(e=>e.id===r.route[r.roomIndex]);

export function createRun({seed=1,content=DEFAULT_CAMPAIGN,rules={},pool=[equippedSword('falchion')],engineVersion=VERSION}={}){
 if(![9,10,VERSION].includes(engineVersion))throw Error('Unsupported run engine version.');
 numberIn(seed,0,4294967295,'Seed',true);const definition=validateCampaign(content);
 if(!Array.isArray(pool)||pool.length<1||pool.length>64)throw Error('Use 1–64 attack patterns.');
 const patterns=pool.map(p=>{if(typeof p.name!=='string'||p.name.length>80||!validatePattern(p.rows))throw Error('Invalid attack pattern.');return {name:p.name,rows:clone(p.rows)};});
 return {version:RUN_VERSION,engineVersion,seed,content:definition,rules:handlingRules(rules),pool:patterns,route:routeFor(definition,seed),phase:'ready',reason:null,tick:0,roomIndex:0,inventory:{},offers:[],room:null,game:null,results:[],totalScore:0,totalBlocks:0,bestCombo:0,commands:[],eventId:0,events:[]};
}

export function startEncounter(r){
 if(r.kind==='climb')return climb.startClimb(r);
 if(r.version===1)return legacy.startEncounter(r);
 if(r.phase!=='ready')throw Error('An encounter can only start from its briefing.');record(r,{type:'start'});r.events=[];
 const effect=modifiers(r.content,r.inventory),rules={...r.rules,breakerRate:Math.min(.4,r.rules.breakerRate+effect.breakerBonus)};
 const seed=(r.seed^Math.imul(r.roomIndex+1,0x71bf21))>>>0,pattern=r.pool[Math.floor(random(seed^0x5533)()*r.pool.length)];
 const encounter=currentEncounter(r),duel=encounter.kind==='duel',opponentPattern=r.pool[Math.floor(random(seed^0x991b)()*r.pool.length)];
 r.game=createMatch({engineVersion:r.engineVersion,mode:duel?'duel':'practice',seed,rules,pattern:pattern.rows,opponentPattern:opponentPattern.rows});
 if(duel)r.game.players[1].active.pair=pairAt(seed,0,r.rules.breakerRate);
 r.room={ticks:0,score:0,blocks:0,bestCombo:0,waves:0,effect,nextWaveTick:null,patternName:pattern.name,opponentPatternName:opponentPattern.name,sentSprinkles:0,sentSwords:0,bot:duel?createRunBot(encounter.opponent):null};
 if(!duel)r.room.nextWaveTick=nextWaveTick(r,0);r.phase='playing';r.reason=null;emit(r,'encounter-started',{encounterId:currentEncounter(r).id});
 return r;
}
function nextWaveTick(r,index){
 const a=currentEncounter(r).attacks,rng=random(r.seed^Math.imul(r.roomIndex+1,0x4f091)^Math.imul(index+1,0x137bf));
 const interval=(index?a.intervalMs:a.firstMs)*(1-a.jitter+rng()*2*a.jitter)+r.room.effect.attackDelayMs;
 return (index?r.room.nextWaveTick:0)+Math.max(1,Math.ceil(interval/TICK_MS));
}
export function upcomingWave(r){
 if(r.kind==='climb')return climbWave(r);
 if(r.version===1)return legacy.upcomingWave(r);
 if(!r.room||currentEncounter(r).kind==='duel')return null;const index=r.room.waves,a=currentEncounter(r).attacks,rng=random(r.seed^Math.imul(r.roomIndex+1,0x718a)^Math.imul(index+1,0x189cf));
 const pattern=r.pool[Math.floor(rng()*r.pool.length)],hand=index%2?-1:1,attacks=[],id=index*10+1;
 for(let i=0;i<a.swords;i++)attacks.push({kind:'vertical',width:a.width,length:a.length,stage:i+1,index:index+i,hand:i?-hand:hand,id:id+i,pattern:clone(pattern.rows)});
 if(a.sprinkles)attacks.push({kind:'sprinkle',count:a.sprinkles,hand,id:id+8,pattern:clone(pattern.rows)});
 return {id:id+9,index,attacks,patternName:pattern.name,inMs:Math.max(0,(r.room.nextWaveTick-r.room.ticks)*TICK_MS)};
}
/** Inputs take effect immediately and are journalled at the current simulation tick. */
export function inputRun(r,actions){
 if(r.kind==='climb')return climb.inputClimb(r,actions);
 if(r.version===1)return legacy.inputRun(r,actions);
 if(!Array.isArray(actions)||actions.length>16||actions.some(a=>!INPUTS.includes(a)))throw Error('Invalid run inputs.');
 if(r.phase!=='playing'||!actions.length)return false;
 record(r,{type:'input',actions:[...actions]});r.events=[];for(const action of actions)command(r.game,0,action);return true;
}
function conclude(r,success,reason){
 r.results.push({encounterId:currentEncounter(r).id,score:r.room.score,blocks:r.room.blocks,bestCombo:r.room.bestCombo,ticks:r.room.ticks,success,reason});r.reason=reason;
 if(!success){r.phase='lost';emit(r,'run-lost',{reason});return;}
 emit(r,'encounter-completed',{encounterId:currentEncounter(r).id});
 if(r.roomIndex===r.route.length-1){r.phase='won';emit(r,'run-won');return;}
 r.offers=rewardChoices(r.content,r.inventory,r.seed,r.roomIndex);
 if(r.offers.length){r.phase='reward';emit(r,'rewards-offered',{ids:[...r.offers]});}
 else {r.roomIndex++;r.phase='ready';emit(r,'route-advanced');}
}
/** Exactly one 60 Hz step; render loops accumulate real time outside this module. */
export function stepRun(r){
 if(r.kind==='climb')return climb.stepClimb(r);
 if(r.version===1)return legacy.stepRun(r);
 r.events=[];if(r.phase!=='playing')return r;
 if(r.tick>=MAX_TICKS){conclude(r,false,'limit');return r;}
 r.tick++;r.room.ticks++;const p=r.game.players[0],room=r.room,e=currentEncounter(r);
 if(e.kind!=='duel'&&room.ticks>=room.nextWaveTick){const wave=upcomingWave(r);p.incoming.push({kind:'batch',id:wave.id,sourceTurn:wave.index,due:p.turn+1,attacks:wave.attacks});room.waves++;room.nextWaveTick=nextWaveTick(r,room.waves);emit(r,'attack-queued',{wave:wave.index,patternName:wave.patternName});}
 const botIndex=r.game.players[1].nextIndex;
 if(room.bot)stepRunBot(r.game,room.bot,r.tick,r.rules.breakerRate);
 step(r.game,TICK_MS,[],{outgoing:(game,side,attacks)=>{
  if(side!==0)return attacks;
  const boosted=transformRunAttack(attacks,room.effect,()=>{const hand=game.sprinkleIndex++%2===0?1:-1;return {kind:'sprinkle',id:game.nextAttackId++,hand,pattern:clone(p.pattern)};});
  const sprinkles=boosted.filter(a=>a.kind==='sprinkle').reduce((n,a)=>n+a.count,0),swords=boosted.filter(a=>a.kind!=='sprinkle').length;
  room.sentSprinkles+=sprinkles;room.sentSwords+=swords;emit(r,'attack-sent',{sprinkles,swords});return boosted;
 }});
 // Player-only breaker upgrades must not boost the bot's newly spawned pair.
 const bot=r.game.players[1];if(room.bot&&bot.nextIndex!==botIndex&&bot.active)bot.active.pair=pairAt(r.game.seed,bot.nextIndex-1,r.rules.breakerRate);
 for(const event of r.game.events){
  if(event.type==='clear'&&event.side===0){
   const count=event.cleared.length,base=(10*count+5*Math.max(0,count-4))*event.chain+room.effect.chainBonus*Math.max(0,event.chain-1),points=Math.round(base*(1+room.effect.scorePercent/100));
   room.score+=points;room.blocks+=count;room.bestCombo=Math.max(room.bestCombo,event.chain);r.totalScore+=points;r.totalBlocks+=count;r.bestCombo=Math.max(r.bestCombo,event.chain);
   emit(r,'scored',{points,blocks:count,chain:event.chain});
  }
  if(['breaking','clear','lock','hit'].includes(event.type))emit(r,'puzzle-'+event.type,{detail:clone(event)});
 }
 // Fatal contact takes priority over a same-tick objective completion.
 if(p.dead){conclude(r,false,'board');return r;}
 if(e.kind==='duel'){
  if(r.game.winner===0)conclude(r,true,'opponent');
  else if(room.ticks>=Math.ceil(e.durationMs/TICK_MS))conclude(r,false,'time');
  return r;
 }
 const value=e.objective.kind==='survive'?room.ticks*TICK_MS:e.objective.kind==='blocks'?room.blocks:room.score;
 if(value+1e-7>=e.objective.target)conclude(r,true,'objective');
 else if(room.ticks>=Math.ceil(e.durationMs/TICK_MS))conclude(r,false,'time');
 return r;
}
export function chooseReward(r,id){
 if(r.kind==='climb')return climb.chooseClimbReward(r,id);
 if(r.version===1)return legacy.chooseReward(r,id);
 if(r.phase!=='reward'||!r.offers.includes(id))throw Error('Choose one of the offered rewards.');
 record(r,{type:'reward',id});r.events=[];r.inventory[id]=stacksOf(r.inventory,id)+1;r.offers=[];r.roomIndex++;r.phase='ready';emit(r,'reward-chosen',{upgradeId:id});return r;
}
export function abandonRun(r){
 if(r.kind==='climb')return climb.abandonClimb(r);
 if(r.version===1)return legacy.abandonRun(r);
 if(isTerminal(r))return false;record(r,{type:'abandon'});r.events=[];r.phase='abandoned';r.reason='abandoned';emit(r,'run-abandoned');return true;
}
