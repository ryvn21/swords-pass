/** Shared engine adapter for one climb encounter; no routing, persistence or DOM. */
import {createMatch,step,pairAt,random,clone} from './engine.js';
import {createRunBot,stepRunBot} from './rogue-bot.js';
import {modifiers} from './rogue-content.js';
import {transformRunAttack} from './rogue-upgrades.js';
export const TICK_MS=1000/60;
export function openCombat(r){
 const e=r.encounter,effect=modifiers(r.content,r.inventory);
 const seed=(r.seed^Math.imul(e.depth,0x71bf21)^(e.bonus?0x7197:0))>>>0;
 const rng=random(seed^0x5533),pattern=r.pool[Math.floor(rng()*r.pool.length)],opponentPattern=r.pool[Math.floor(rng()*r.pool.length)];
 const breakerRate=Math.max(r.rules.breakerRate,Math.min(.4,r.rules.breakerRate+effect.breakerBonus));
 r.game=createMatch({engineVersion:r.engineVersion,mode:e.kind==='duel'?'duel':'practice',seed,rules:{...r.rules,breakerRate},pattern:pattern.rows,opponentPattern:opponentPattern.rows});
 if(e.kind==='duel')r.game.players[1].active.pair=pairAt(seed,0,r.rules.breakerRate);
 const rivalBlade=e.opponent?.sword?.rows?e.opponent.sword:null;if(rivalBlade)r.game.players[1].pattern=clone(rivalBlade.rows);
 r.room={ticks:0,score:0,blocks:0,bestCombo:0,bestSword:0,waves:0,effect,sentSprinkles:0,sentSwords:0,patternName:pattern.name,opponentPatternName:rivalBlade?rivalBlade.name:opponentPattern.name,bot:e.kind==='duel'?createRunBot(e.opponent):null,nextWaveTick:e.attacks?Math.ceil(Math.max(2000,e.attacks.firstMs+effect.attackDelayMs-effect.attackHasteMs)/TICK_MS):null,warded:0,windUsed:false};
}
export function climbWave(r){
 const a=r.encounter.attacks;if(!a||!r.room)return null;
 const index=r.room.waves,rng=random(r.game.seed^Math.imul(index+1,0x189cf)),pattern=r.pool[Math.floor(rng()*r.pool.length)],hand=index%2?-1:1,id=index*10+1,attacks=[];
 for(let i=0;i<a.swords;i++)attacks.push({kind:'vertical',width:a.width,length:a.length,stage:i+1,index:index+i,hand:i?-hand:hand,id:id+i,pattern:clone(pattern.rows)});
 if(a.sprinkles)attacks.push({kind:'sprinkle',count:a.sprinkles,hand,id:id+8,pattern:clone(pattern.rows)});
 return {id:id+9,index,attacks,patternName:pattern.name,inMs:Math.max(0,(r.room.nextWaveTick-r.room.ticks)*TICK_MS),held:r.game.players[0].incoming.length>=r.content.maxQueuedWaves};
}
export function combatMetrics(r){return {sword:r.room?.bestSword??0,blocks:r.room?.blocks??0,score:r.room?.score??0,combo:r.room?.bestCombo??0,survive:(r.room?.ticks??0)*TICK_MS,defeat:r.game?.winner===0?1:0};}
export function tickCombat(r,emit){
 const room=r.room,p=r.game.players[0],e=r.encounter;room.ticks++;
 if(e.attacks&&room.ticks>=room.nextWaveTick){
  // Full queues hold the announced next wave; no accumulated burst on release.
  if(p.incoming.length<r.content.maxQueuedWaves){
   const wave=climbWave(r);
   // Ward Charm: the first waves of each encounter are turned aside entirely.
   if((room.warded??0)<(room.effect.waveWard??0)){room.warded=(room.warded??0)+1;emit('wave-warded',{wave:wave.index});}
   else p.incoming.push({kind:'batch',id:wave.id,sourceTurn:wave.index,due:p.turn+1,attacks:wave.attacks});room.waves++;
   room.nextWaveTick=room.ticks+Math.ceil(Math.max(3000,e.attacks.intervalMs+room.effect.attackDelayMs-(room.effect.attackHasteMs??0))/TICK_MS);
   emit('attack-queued',{wave:wave.index,patternName:wave.patternName});
  }
 }
 const botIndex=r.game.players[1].nextIndex;
 if(room.bot)stepRunBot(r.game,room.bot,room.ticks,r.rules.breakerRate);
 step(r.game,TICK_MS,[],{outgoing:(game,side,attacks)=>{
  if(side!==0)return attacks;
  const boosted=transformRunAttack(attacks,room.effect,()=>({kind:'sprinkle',id:game.nextAttackId++,hand:game.sprinkleIndex++%2===0?1:-1,pattern:clone(p.pattern)}));
  const sprinkles=boosted.filter(a=>a.kind==='sprinkle').reduce((n,a)=>n+a.count,0),swords=boosted.filter(a=>a.kind!=='sprinkle').length;
  room.sentSprinkles+=sprinkles;room.sentSwords+=swords;emit('attack-sent',{sprinkles,swords});return boosted;
 }});
 // Second Wind: once per encounter, when column 4 reaches row 10, the top five rows shatter.
 // Second Wind is a rescue, not a tidy-up: it fires only when column 4 is one row from topping out, and clears the top four rows
 if(room.effect.secondWind&&!room.windUsed&&p.phase==='fall'&&!p.dead&&p.board[p.board.length-2]?.[3]){room.windUsed=true;let n=0;for(let y=p.board.length-4;y<p.board.length;y++)for(let x=0;x<p.board[y].length;x++)if(p.board[y][x]){p.board[y][x]=null;n++;}emit('second-wind',{cleared:n});}
 const bot=r.game.players[1];if(room.bot&&bot.nextIndex!==botIndex&&bot.active)bot.active.pair=pairAt(r.game.seed,bot.nextIndex-1,r.rules.breakerRate);
 for(const event of r.game.events){
  if(event.type==='clear'&&event.side===0){
   const count=event.cleared.length,base=(10*count+5*Math.max(0,count-4))*event.chain+room.effect.chainBonus*Math.max(0,event.chain-1)+(room.effect.blockBounty??0)*count,points=Math.round(base*(1+room.effect.scorePercent/100));
   room.score+=points;room.blocks+=count;room.bestCombo=Math.max(room.bestCombo,event.chain);room.bestSword=Math.max(room.bestSword??0,...(event.swords??[]).map(s=>s.width*s.length));r.totalScore+=points;r.totalBlocks+=count;r.bestCombo=Math.max(r.bestCombo,event.chain);
   emit('scored',{points,blocks:count,chain:event.chain});
  }
  if(['breaking','clear','lock','hit'].includes(event.type))emit('puzzle-'+event.type,{detail:clone(event)});
 }
}
