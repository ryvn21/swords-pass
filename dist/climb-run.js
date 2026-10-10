/** Climb policy v1. Each new round checkpoints carry and starts a bounded journal. */
import {clone,command,validatePattern,VERSION,random} from './engine.js';
import {handlingRules} from './handling-profile.js';
import {equippedSword} from './swords.js';
import {numberIn,rewardChoices,stacksOf,RARITIES} from './rogue-content.js';
import {upgradePreview} from './rogue-upgrades.js';
import {DEFAULT_CLIMB,validateClimb} from './climb-content.js';
import {encounterOffers,bonusEncounter,isCheckpoint} from './climb-generator.js';
import {objectiveProgress} from './climb-objectives.js';
import {openCombat,tickCombat,combatMetrics,TICK_MS} from './climb-combat.js';
// Rewards are a real choice: one relic for attack, one for defence, one for fortune, so every pick
// trades one way of playing for another. Rares grow likelier the deeper you go; legendaries wait
// until depth 5; a few relics only appear late (Broad Edge turns any double sword into a kill).
const GROUP={sprinkleBonus:'attack',strikeHeightBonus:'attack',swordWidthBonus:'attack',chainSprinkles:'attack',attackDelayMs:'defence',waveWard:'defence',secondWind:'defence',scorePercent:'fortune',chainBonus:'fortune',blockBounty:'fortune',breakerBonus:'fortune'};
export const LATE=Object.freeze({'broad-edge':20});
export function climbOffers(eligible,seed,index,depth){
 const rng=random(seed^Math.imul(index+1,0x2b8f1c7)),weight=u=>u.rarity==='legendary'?(depth>=5?RARITIES.legendary*(1+depth/10):0):u.rarity==='rare'?RARITIES.rare*(1+depth/6):RARITIES.common;
 const groupOf=u=>GROUP[u.effects?.[0]?.kind]??'fortune',pick=bag=>{const live=bag.filter(u=>weight(u)>0);if(!live.length)return null;let t=rng()*live.reduce((n,u)=>n+weight(u),0);for(const u of live)if((t-=weight(u))<=0)return u;return live.at(-1);};
 const out=[];for(const g of ['attack','defence','fortune']){const u=pick(eligible.filter(x=>groupOf(x)===g&&!out.includes(x.id)));if(u)out.push(u.id);}
 while(out.length<3){const u=pick(eligible.filter(x=>!out.includes(x.id)));if(!u)break;out.push(u.id);}
 return out;
}
export const CLIMB_VERSION=1,MAX_ROUND_TICKS=10800,MAX_ROUND_COMMANDS=60000;
export const CLIMB_INPUTS=Object.freeze(['left','right','cw','ccw','fastOn','fastOff']);
// lives: continues left in the run (3 to start). Saves from before continues existed have none recorded and get 3.
export const START_LIVES=3;
const CARRY_KEYS=['depth','lastBonusDepth','totalTicks','totalScore','totalBlocks','bestCombo','inventory','recent','results','eventId','lives'];
const REQUIRED_KEYS=CARRY_KEYS.filter(k=>k!=='lives');
const initialCarry=()=>({depth:0,lastBonusDepth:0,totalTicks:0,totalScore:0,totalBlocks:0,bestCombo:0,inventory:{},recent:[],results:[],eventId:0,lives:START_LIVES});
const emit=(r,type,detail={})=>r.events.push({id:++r.eventId,tick:r.tick,type,...detail});
function record(r,entry){if(r.commands.length>=MAX_ROUND_COMMANDS)throw Error('This encounter reached its input limit. Export the run before continuing.');r.commands.push({tick:r.tick,...entry});}
export function validateCarry(c,content){
 if(!c||REQUIRED_KEYS.some(k=>!Object.hasOwn(c,k)))throw Error('Missing climb checkpoint fields.');
 const out={lives:c.lives==null?START_LIVES:numberIn(c.lives,0,START_LIVES,'Continues',true)};for(const k of ['depth','lastBonusDepth','totalTicks','totalScore','totalBlocks','bestCombo','eventId'])out[k]=numberIn(c[k],0,k==='depth'||k==='lastBonusDepth'?999999999:k==='bestCombo'?1000:1e14,'Checkpoint '+k,true);
 if(out.lastBonusDepth>out.depth||(out.lastBonusDepth&&!isCheckpoint(content,out.lastBonusDepth)))throw Error('Invalid checkpoint bonus history.');
 if(!c.inventory||typeof c.inventory!=='object'||Array.isArray(c.inventory)||Object.keys(c.inventory).length>32)throw Error('Invalid checkpoint inventory.');
 out.inventory={};for(const [id,rank] of Object.entries(c.inventory)){const u=content.upgrades.find(u=>u.id===id);if(!u)throw Error('Unknown saved upgrade.');Object.defineProperty(out.inventory,id,{value:numberIn(rank,1,u.maxStacks,'Upgrade rank',true),enumerable:true,writable:true,configurable:true});}
 if(!Array.isArray(c.recent)||c.recent.length>4||c.recent.some(id=>!content.templates.some(t=>t.id===id)))throw Error('Invalid recent encounters.');out.recent=[...c.recent];
 if(!Array.isArray(c.results)||c.results.length>12)throw Error('Invalid recent results.');
 out.results=c.results.map(x=>{
  if(!x||typeof x.name!=='string'||x.name.length>80||typeof x.success!=='boolean'||typeof x.bonus!=='boolean'||!['objective','board','time','skipped'].includes(x.reason))throw Error('Invalid encounter result.');
  return {name:x.name,depth:numberIn(x.depth,1,Math.max(1,out.depth),'Result depth',true),bonus:x.bonus,success:x.success,reason:x.reason,score:numberIn(x.score,0,1e9,'Result score',true),ticks:numberIn(x.ticks,0,MAX_ROUND_TICKS,'Result ticks',true)};
 });return out;
}
function prepare(r){
 // Snapshots contain only completed carry. The live board is always reconstructed.
 r.anchor=Object.fromEntries(CARRY_KEYS.map(k=>[k,clone(r[k])]));if(r.anchor.lives===START_LIVES)delete r.anchor.lives;   // a full set of continues is the default: older saves stay byte-identical
 r.lives??=START_LIVES;r.tick=0;r.commands=[];r.game=null;r.room=null;r.reason=null;r.offers=[];r.lastResult=null;r.events=[];
 const bonus=r.depth>0&&isCheckpoint(r.content,r.depth)&&r.lastBonusDepth<r.depth;
 r.paths=bonus?[bonusEncounter(r.content,r.seed,r.depth)]:encounterOffers(r.content,r.seed,r.depth+1,r.recent);
 r.encounter=clone(r.paths[0]);r.phase=r.paths.length===1?'ready':'route';
}
export function createClimb({seed=1,content=DEFAULT_CLIMB,rules={},pool=[equippedSword('falchion')],engineVersion=VERSION}={},checkpoint=null){
 if(![9,10,VERSION].includes(engineVersion))throw Error('Unsupported climb engine version.');
 numberIn(seed,0,4294967295,'Seed',true);const definition=validateClimb(content);
 if(!Array.isArray(pool)||pool.length<1||pool.length>64)throw Error('Use 1–64 sword patterns.');
 const patterns=pool.map(p=>{if(!p||typeof p.name!=='string'||p.name.length>80||!validatePattern(p.rows))throw Error('Invalid attack pattern.');return {name:p.name,rows:clone(p.rows)};});
 const carry=checkpoint?validateCarry(checkpoint,definition):initialCarry();
 const r={kind:'climb',version:CLIMB_VERSION,engineVersion,seed,content:definition,rules:handlingRules(rules),pool:patterns,...carry,events:[]};prepare(r);return r;
}
export function choosePath(r,id){
 if(r.phase!=='route')throw Error('Choose a route before starting.');const e=r.paths.find(e=>e.id===id);if(!e)throw Error('Choose one of the offered encounters.');
 record(r,{type:'path',id});r.events=[];r.encounter=clone(e);r.phase='ready';emit(r,'route-chosen',{encounterId:id});
}
export function startClimb(r){
 if(r.phase!=='ready')throw Error('An encounter starts only from its briefing.');record(r,{type:'start'});r.events=[];openCombat(r);r.phase='playing';emit(r,'encounter-started',{encounterId:r.encounter.id});return r;
}
export function inputClimb(r,actions){
 if(!Array.isArray(actions)||actions.length>16||actions.some(a=>!CLIMB_INPUTS.includes(a)))throw Error('Invalid climb inputs.');
 if(r.phase!=='playing'||!actions.length)return false;record(r,{type:'input',actions:[...actions]});r.events=[];for(const action of actions)command(r.game,0,action);return true;
}
function finish(r,success,reason){
 const e=r.encounter,metrics=combatMetrics(r),optional=success&&e.optional&&objectiveProgress(e.optional,metrics).complete;
 const completion=success?e.rewardPoints+(optional?e.bonusPoints:0):0;r.totalScore+=completion;
 const result={name:e.name,depth:e.depth,bonus:e.bonus,success,reason,score:(r.room?.score??0)+completion,ticks:r.room?.ticks??0};
 r.results=[...r.results,result].slice(-12);r.lastResult={...result,completionPoints:completion,optionalComplete:!!optional};r.reason=reason;
 if(e.bonus)r.lastBonusDepth=e.depth;
 if(!success&&!e.bonus){r.phase='lost';emit(r,'run-lost',{reason});return;}
 if(!e.bonus){r.depth++;r.recent=[...r.recent,e.templateId].slice(-4);}
 emit(r,'encounter-completed',{success,bonus:e.bonus,depth:r.depth,completionPoints:completion});
 if(!success){r.phase='result';r.offers=[];return;}
 const eligible=r.content.upgrades.filter(u=>upgradePreview(r.content,r.inventory,u.id,r.rules).effects.some(e=>e.next>e.current));
 r.offers=climbOffers(eligible.filter(u=>!(LATE[u.id]>r.depth)),r.seed,r.depth*2+(e.bonus?1:0),r.depth);
 // Explicit, useful fallback until next-encounter rewards arrive in milestone 2.
 if(!r.offers.length)r.offers=['bank-points'];r.phase='reward';emit(r,'rewards-offered',{ids:[...r.offers]});
}
export function stepClimb(r){
 r.events=[];if(r.phase!=='playing')return r;
 r.tick++;r.totalTicks++;tickCombat(r,(type,detail)=>emit(r,type,detail));
 if(r.game.players[0].dead){finish(r,false,'board');return r;}
 if(objectiveProgress(r.encounter.objective,combatMetrics(r)).complete)finish(r,true,'objective');
 else if(r.room.ticks>=Math.ceil(r.encounter.durationMs/TICK_MS))finish(r,false,'time');
 return r;
}
export function chooseClimbReward(r,id){
 if(r.phase!=='reward'||!r.offers.includes(id))throw Error('Choose one of the offered rewards.');
 record(r,{type:'reward',id});r.events=[];
 if(id==='bank-points')r.totalScore+=50;else r.inventory[id]=stacksOf(r.inventory,id)+1;
 emit(r,'reward-chosen',{upgradeId:id});prepare(r);
}
export function continueClimb(r){if(r.phase!=='result')throw Error('There is no bonus result to continue.');record(r,{type:'continue'});r.events=[];prepare(r);}
// A continue: the encounter you just lost starts again from the moment before it (score, relics and time as they were),
// for one of the run's lives. The restart is a fresh checkpoint, so saves stay simple.
export function retryClimb(r){
 if(r.phase!=='lost'||!(r.lives>0))throw Error('No continues left.');
 const enc=r.encounter,lives=r.lives-1;Object.assign(r,clone(r.anchor));r.lives=lives;prepare(r);
 if(r.phase==='route'&&r.paths.some(p=>p.id===enc.id))choosePath(r,enc.id);
 emit(r,'run-continued',{lives});
}
export function skipBonus(r){if(r.phase!=='ready'||!r.encounter.bonus)throw Error('Only a bonus briefing can be skipped.');record(r,{type:'skip'});r.events=[];finish(r,false,'skipped');}
export function abandonClimb(r){if(['lost','abandoned'].includes(r.phase))return false;record(r,{type:'abandon'});r.events=[];r.phase='abandoned';r.reason='abandoned';emit(r,'run-abandoned');return true;}
