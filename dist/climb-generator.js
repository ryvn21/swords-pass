/** Generator policy v1. Version any gameplay change so old journals stay reproducible. */
import {random,clone} from './engine.js';
export const isCheckpoint=(c,depth)=>c.checkpoints.initial.includes(depth)||(depth>c.checkpoints.after&&(depth-c.checkpoints.after)%c.checkpoints.every===0);
export function nextCheckpoint(c,depth){const cp=c.checkpoints,explicit=cp.initial.find(x=>x>depth),repeat=cp.after+Math.max(1,Math.floor((depth-cp.after)/cp.every)+1)*cp.every;return Math.min(explicit??Infinity,repeat);}
export const difficultyBand=(c,depth)=>c.bands.findLast(b=>depth>=b.from)??c.bands[0];
function scaleObjective(o,scale){if(o.items)return {...o,items:o.items.map(x=>scaleObjective(x,scale))};if(o.kind==='sword')return {...o,target:[4,8,12,18,24,36].find(a=>a>=o.target*scale)??36};return {...o,target:['blocks','score'].includes(o.kind)?Math.min(o.kind==='blocks'?2000:100000,Math.ceil(o.target*scale)):o.target};}
const rivalPool=(c,depth)=>{const here=c.rivals.filter(x=>x.from<=depth&&(x.to??Infinity)>=depth);return here.length?here:c.rivals.filter(x=>x.from===1);};
// Deterministic per seed and depth, and never the rival met one depth earlier, so back-to-back
// duels always change face. Picks are walked forward from depth 1 (cached per run content).
const rivalCache=new WeakMap();
export function rivalAt(c,seed,depth){
 let bySeed=rivalCache.get(c);if(!bySeed)rivalCache.set(c,bySeed=new Map());
 let picks=bySeed.get(seed);if(!picks)bySeed.set(seed,picks=[]);
 const start=depth-picks.length>5000?depth-50:1,s=seed%7;            // absurd depths: walk only the last stretch
 if(start>1)picks.length=0;
 for(let d=start+picks.length;d<=depth;d++){
  const pool=rivalPool(c,d),prev=picks.at(-1);
  const pick=d===1?pool.find(x=>x.id==='pip')??pool[0]:(()=>{const options=pool.filter(x=>x.id!==prev?.id),list=options.length?options:pool;return list[(d+s)%list.length];})();
  picks.push(pick);
 }
 return start>1?picks.at(-1):picks[depth-1];
}
function instantiate(c,seed,depth,t,bonus=false){
 const band=bonus?c.bands[0]:difficultyBand(c,depth),rng=random(seed^Math.imul(depth,0x1738a51)^Math.imul(t.id.length,0x19b1)^([...t.id].reduce((a,x)=>a*31+x.charCodeAt(0),0)>>>0));
 const e={...clone(t),templateId:t.id,id:`${bonus?'bonus':'depth'}-${depth}-${t.id}`,depth,bonus,band:band.label,objective:scaleObjective(t.objective,bonus?1:band.scale),description:bonus?'Clear the target for a bonus reward. Failure or skipping continues the climb.':t.rare?'A rarer challenge with a larger completion reward.':'Complete the objective to advance immediately.',maxQueuedWaves:c.maxQueuedWaves};
 if(t.optional)e.optional=scaleObjective(t.optional,band.scale);
 if(t.kind==='duel'&&c.rivals){
  // Newer content: a rival from the roster for this depth (never the same one twice in a row),
  // carrying a blade from the tier the road has reached.
  const pick=rivalAt(c,seed,depth);
  const blades=(c.rivalSwords??[]).filter(s=>s.from<=depth).slice(-4),blade=blades.length?blades[Math.floor(rng()*blades.length)]:null;
  e.opponent={name:pick.name,title:pick.title,rivalId:pick.id,difficulty:depth===1?'easy':band.difficulty,style:pick.style,pace:depth===1?.85:band.pace};
  if(blade)e.opponent.sword={name:blade.name,rows:clone(blade.rows)};
 }
 else if(t.kind==='duel')e.opponent={name:depth===1?'Pip':['Pip','Marlow','Rook'][Math.floor(rng()*3)],difficulty:depth===1?'easy':band.difficulty,style:Math.floor(rng()*3),pace:depth===1?.85:band.pace};
 else e.attacks={firstMs:bonus?20000:8000,intervalMs:bonus?20000:band.intervalMs,jitter:0,swords:bonus?0:1,width:band.width,length:band.length,sprinkles:bonus?1:band.sprinkles};
 return e;
}
export function encounterOffers(c,seed,depth,recent=[]){
 if(!Number.isSafeInteger(depth)||depth<1||depth>1000000000)throw Error('Invalid climb depth.');
 if(depth===1)return [instantiate(c,seed,depth,c.templates.find(t=>t.id==='duel'))];
 const repeated=recent.length>=2&&recent.at(-1)===recent.at(-2)?recent.at(-1):null;
 let pool=c.templates.filter(t=>t.minDepth<=depth&&t.id!==repeated);
 if(!pool.length)pool=[c.templates.find(t=>t.id==='duel')];
 const rng=random(seed^Math.imul(depth,0x6d2b79f5)),out=[];
 while(pool.length&&out.length<2){
  // Offer a combat and objective route whenever both are available. Attack builds
  // retain a useful path without making the generator counterpick inventory.
  const other=out.length?pool.filter(t=>t.kind!==out[0].kind):[];
  const candidates=other.length?other:pool,sum=candidates.reduce((n,t)=>n+t.weight,0);let roll=rng()*sum,index=0;
  while(index<candidates.length-1&&(roll-=candidates[index].weight)>=0)index++;
  const chosen=candidates[index];pool=pool.filter(t=>t!==chosen);out.push(instantiate(c,seed,depth,chosen));
 }
 return out;
}
export const bonusEncounter=(c,seed,depth)=>instantiate(c,seed,depth,c.bonus,true);
