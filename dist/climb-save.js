/** Local-continuity format. Checksum is corruption detection, not competitive proof. */
import {VERSION} from './engine.js';
import {handlingRules} from './handling-profile.js';
import {numberIn} from './rogue-content.js';
import {CLIMB_VERSION,MAX_ROUND_TICKS,MAX_ROUND_COMMANDS,CLIMB_INPUTS,createClimb,choosePath,startClimb,inputClimb,stepClimb,skipBonus,abandonClimb} from './climb-run.js';
export const MAX_CLIMB_BYTES=2000000;
export function saveChecksum(value){let h=0x811c9dc5;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),0x01000193);return (h>>>0).toString(16).padStart(8,'0');}
export function serializeClimb(r){
 const body={version:2,kind:'climb',climbVersion:r.version,engineVersion:r.engineVersion,recipe:{seed:r.seed,content:r.content,rules:r.rules,pool:r.pool},checkpoint:r.anchor,tick:r.tick,commands:r.commands};
 const text=JSON.stringify({...body,checksum:saveChecksum(body)});if(new TextEncoder().encode(text).length>MAX_CLIMB_BYTES)throw Error('Climb save exceeds 2 MB. Export your run.');return text;
}
export function restoreClimb(text){
 if(typeof text!=='string'||text.length>MAX_CLIMB_BYTES||new TextEncoder().encode(text).length>MAX_CLIMB_BYTES)throw Error('Climb save exceeds 2 MB or is not text.');
 let saved;try{saved=JSON.parse(text);}catch{throw Error('This run save is not valid JSON.');}
 if(saved?.version!==2||saved.kind!=='climb'||saved.climbVersion!==CLIMB_VERSION||![9,10,VERSION].includes(saved.engineVersion))throw Error('Unsupported climb save version. Keep this file for a compatible build.');
 const {checksum,...body}=saved;if(typeof checksum!=='string'||saveChecksum(body)!==checksum)throw Error('This climb save is damaged: its checksum does not match. Keep the original or restore a backup.');
 numberIn(saved.tick,0,MAX_ROUND_TICKS,'Encounter tick',true);
 if(!saved.checkpoint||typeof saved.checkpoint!=='object'||Array.isArray(saved.checkpoint))throw Error('Missing or invalid climb checkpoint.');
 if(!saved.recipe||['seed','content','rules','pool'].some(k=>!Object.hasOwn(saved.recipe,k))||!Array.isArray(saved.commands)||saved.commands.length>MAX_ROUND_COMMANDS)throw Error('Invalid climb recipe or command journal.');
 const rules=saved.recipe.rules,normalized=handlingRules(rules);if(!rules||Object.keys(normalized).some(k=>rules[k]!==normalized[k]))throw Error('Invalid saved handling rules.');
 let previous=0;
 for(const c of saved.commands){
  if(!c||!Number.isInteger(c.tick)||c.tick<previous||c.tick>saved.tick||!['path','start','input','skip','abandon'].includes(c.type))throw Error('Invalid encounter command journal.');previous=c.tick;
  if(c.type==='input'&&(!Array.isArray(c.actions)||!c.actions.length||c.actions.length>16||c.actions.some(a=>!CLIMB_INPUTS.includes(a))))throw Error('Invalid saved controls.');
  if(c.type==='path'&&(typeof c.id!=='string'||c.id.length>90))throw Error('Invalid route choice.');
 }
 const r=createClimb({...saved.recipe,engineVersion:saved.engineVersion},saved.checkpoint);
 const advance=tick=>{while(r.tick<tick){if(r.phase!=='playing')throw Error('Saved time advances outside an encounter.');stepClimb(r);}};
 for(const c of saved.commands){advance(c.tick);
  if(c.type==='path')choosePath(r,c.id);
  else if(c.type==='start')startClimb(r);
  else if(c.type==='skip')skipBonus(r);
  else if(c.type==='abandon'){if(!abandonClimb(r))throw Error('Run already ended.');}
  else if(!inputClimb(r,c.actions))throw Error('Saved input occurs outside play.');
 }
 advance(saved.tick);return r;
}
