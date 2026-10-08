/** Bounded declarative objectives. No executable content or UI-dependent completion. */
const LIMITS={defeat:1,blocks:2000,score:100000,combo:12,survive:180000,sword:36};
// Sword objectives count the area (width x length) of the biggest sword you form.
export const SWORD_SIZES=[[4,'1×4'],[8,'2×4'],[12,'2×6'],[18,'3×6'],[24,'4×6'],[36,'6×6']];
export const swordSize=area=>(SWORD_SIZES.find(([a])=>a>=area)??SWORD_SIZES.at(-1))[1];
export function validateObjective(value,mode,{optional=false,durationMs=180000}={}){
 let count=0;
 function visit(o,depth=0){
  if(!o||typeof o!=='object'||++count>7||depth>2)throw Error('Objective is missing or too complex.');
  if(o.kind==='all'||o.kind==='any'){
   if(!Array.isArray(o.items)||o.items.length<2||o.items.length>3)throw Error('Objective groups need 2–3 conditions.');
   return {kind:o.kind,items:o.items.map(x=>visit(x,depth+1))};
  }
  if(!Object.hasOwn(LIMITS,o.kind)||!Number.isInteger(o.target)||o.target<1||o.target>LIMITS[o.kind])throw Error('Invalid objective target.');
  if(o.kind==='defeat'&&mode!=='duel')throw Error('Only duels can require an opponent defeat.');
  if(o.kind==='survive'&&o.target>durationMs)throw Error('Survival target exceeds the deadline.');
  return {kind:o.kind,target:o.target};
 }
 const result=visit(value);
 // When the enemy dies, the engine stops. Never strand a duel behind further clears.
 if(mode==='duel'&&!optional&&!objectiveProgress(result,{defeat:1}).complete)throw Error('A duel must finish when its opponent is defeated. Put performance targets in an optional bonus.');
 return result;
}
export function objectiveProgress(o,metrics={}){
 if(o.items){const items=o.items.map(x=>objectiveProgress(x,metrics));return {kind:o.kind,complete:o.kind==='all'?items.every(x=>x.complete):items.some(x=>x.complete),items};}
 const value=Math.min(o.target,Math.max(0,metrics[o.kind]??0));return {kind:o.kind,target:o.target,value,complete:value+1e-7>=o.target};
}
export function objectiveLabel(o){
 if(o.items)return o.items.map(x=>`(${objectiveLabel(x)})`).join(o.kind==='all'?' and ':' or ');
 return o.kind==='sword'?`Form a ${swordSize(o.target)} sword or bigger`:o.kind==='defeat'?'Defeat the opponent':o.kind==='blocks'?`Clear ${o.target} blocks`:o.kind==='score'?`Score ${o.target} points`:o.kind==='combo'?`Make a ×${o.target} combo`:`Survive ${Math.ceil(o.target/1000)} seconds`;
}
export function objectiveStatus(progress){
 if(progress.items)return progress.items.map(objectiveStatus).join(progress.kind==='all'?' · ':' or ');
 const {kind,value,target,complete}=progress;
 if(kind==='defeat')return complete?'Opponent defeated':'Defeat opponent';
 if(kind==='sword')return complete?`${swordSize(target)} sword formed`:`Biggest ${value?swordSize(value):'none'} / ${swordSize(target)}`;
 return kind==='survive'?`${Math.floor(value/1000)} / ${Math.ceil(target/1000)}s`:`${value} / ${target}${kind==='combo'?' combo':kind==='blocks'?' blocks':' points'}`;
}
