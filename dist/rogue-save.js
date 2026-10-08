import {serializeClimb,restoreClimb} from './climb-save.js';
/** Saves trust the recipe and validated command log, never a supplied engine snapshot. */
import * as legacyRun from './legacy-rogue-run-v1.js';
import {VERSION} from './engine.js';
import {createRun,startEncounter,inputRun,stepRun,chooseReward,abandonRun,RUN_VERSION,MAX_TICKS,MAX_COMMANDS,INPUTS} from './rogue-run.js';
import {numberIn} from './rogue-content.js';
import {handlingRules} from './handling-profile.js';
export const SAVE_VERSION=1,MAX_SAVE_BYTES=2000000;
export function serializeRun(r){
 if(r.kind==='climb')return serializeClimb(r);
 const value=JSON.stringify({version:SAVE_VERSION,runVersion:r.version,engineVersion:r.engineVersion,recipe:{seed:r.seed,content:r.content,rules:r.rules,pool:r.pool},tick:r.tick,commands:r.commands});
 if(new TextEncoder().encode(value).length>MAX_SAVE_BYTES)throw Error('Run save exceeds 2 MB.');return value;
}
export function restoreRun(text){
 if(typeof text!=='string'||text.length>MAX_SAVE_BYTES||new TextEncoder().encode(text).length>MAX_SAVE_BYTES)throw Error('Run save exceeds 2 MB or is not text.');
 let saved;try{saved=JSON.parse(text);}catch{throw Error('This run save is not valid JSON.');}
 if(saved?.version===2&&saved.kind==='climb')return restoreClimb(text);
 if(saved?.version!==SAVE_VERSION||![1,RUN_VERSION].includes(saved.runVersion)||![9,VERSION].includes(saved.engineVersion)||(saved.runVersion===1&&saved.engineVersion!==9))throw Error('This run uses an unsupported save or engine version. Keep the file for a compatible build.');
 numberIn(saved.tick,0,MAX_TICKS,'Saved tick',true);
 if(!saved.recipe||['seed','content','rules','pool'].some(k=>!Object.hasOwn(saved.recipe,k))||!Array.isArray(saved.commands)||saved.commands.length>MAX_COMMANDS)throw Error('Invalid run recipe or command log.');
 const rules=saved.recipe.rules,normalized=handlingRules(rules);
 if(!rules||Object.keys(normalized).some(k=>rules[k]!==normalized[k]))throw Error('Invalid saved handling rules.');
 let previous=0;
 for(const c of saved.commands){
  if(!c||!Number.isInteger(c.tick)||c.tick<previous||c.tick>saved.tick||!['start','input','reward','abandon'].includes(c.type))throw Error('Invalid or unordered run command.');previous=c.tick;
  if(c.type==='input'&&(!Array.isArray(c.actions)||!c.actions.length||c.actions.length>16||c.actions.some(a=>!INPUTS.includes(a))))throw Error('Invalid saved input.');
  if(c.type==='reward'&&typeof c.id!=='string')throw Error('Invalid saved reward.');
 }
 const r=(saved.runVersion===1?legacyRun.createRun:createRun)({...saved.recipe,engineVersion:saved.engineVersion});
 const advance=tick=>{while(r.tick<tick){if(r.phase!=='playing')throw Error('Run log advances outside an encounter.');stepRun(r);}};
 for(const c of saved.commands){advance(c.tick);
  if(c.type==='start')startEncounter(r);
  else if(c.type==='reward')chooseReward(r,c.id);
  else if(c.type==='abandon'){if(!abandonRun(r))throw Error('Run already ended.');}
  else if(!inputRun(r,c.actions))throw Error('Input occurs outside an encounter.');
 }
 advance(saved.tick);return r;
}
