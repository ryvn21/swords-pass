/** Apply run-only attack bonuses once, after the complete combo has resolved. */
import {clone} from './engine.js';
import {modifiers,stacksOf} from './rogue-content.js';

export function transformRunAttack(attacks,effect,makeSprinkle){
 const result=clone(attacks);if(!result.length)return result;
 const extra=Math.max(0,Math.min(12,Math.floor(effect.sprinkleBonus??0))),height=Math.max(0,Math.min(6,Math.floor(effect.strikeHeightBonus??0)));
 const wider=Math.max(0,Math.min(2,Math.floor(effect.swordWidthBonus??0))),echo=Math.max(0,Math.min(9,Math.floor(effect.chainSprinkles??0))),deep=result.some(a=>(a.stage??0)>=3);
 for(const attack of result)if(attack.kind==='vertical'){if(wider)attack.width=Math.min(3,attack.width+wider);attack.length=Math.max(attack.length,Math.min(attack.width===1?6:13,attack.length+height));}
 const extraTotal=extra+(deep?echo:0);
 if(extraTotal){const sprinkle=result.find(a=>a.kind==='sprinkle');if(sprinkle)sprinkle.count+=extraTotal;else result.push({...makeSprinkle(),count:extraTotal});}
 return result;
}

/** Effective cumulative values, including shared caps, before and after one pick. */
export function upgradePreview(content,inventory,id,{breakerRate}={}){
 const u=content.upgrades.find(u=>u.id===id);if(!u)throw Error('Unknown upgrade.');
 const rank=stacksOf(inventory,id),nextRank=Math.min(u.maxStacks,rank+1),before=modifiers(content,inventory),after=modifiers(content,{...inventory,[id]:nextRank});
 const effective=(kind,value)=>kind==='breakerBonus'&&Number.isFinite(breakerRate)?Math.max(0,Math.min(.4,breakerRate+value)-Math.min(.4,breakerRate)):value;
 return {...clone(u),rank,nextRank,effects:[...new Set(u.effects.map(e=>e.kind))].map(kind=>({kind,current:effective(kind,before[kind]),next:effective(kind,after[kind])}))};
}
