import {PATTERNS,THEMED,equippedSword} from './swords.js';
import {validatePattern} from './engine.js';
const builtinIds=new Set([...PATTERNS.filter(p=>p.id!=='custom'),...THEMED].map(p=>p.id));
function cleanPattern(p){
 if(!p||typeof p.id!=='string'||!/^custom-[a-zA-Z0-9-]+$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||!validatePattern(p.rows))return null;
 return {id:p.id,name:p.name.trim().slice(0,32),rows:structuredClone(p.rows),iconId:builtinIds.has(p.iconId)?p.iconId:'custom',note:'Your saved attack pattern.'};
}
export function readLibrary(value,legacy=null){
 if(value?.version!==1){const migrated=legacy&&legacy.name?.trim().toLowerCase()!=='forgotten falchion'?cleanPattern({...legacy,id:'custom-legacy'}):null;return {version:1,patterns:migrated?[migrated]:[],hidden:[]};}
 const seen=new Set(),patterns=[];
 for(const p of Array.isArray(value.patterns)?value.patterns:[]){const clean=cleanPattern(p);if(clean&&!seen.has(clean.id)){patterns.push(clean);seen.add(clean.id);}}
 return {version:1,patterns,hidden:[...new Set((Array.isArray(value.hidden)?value.hidden:[]).filter(id=>builtinIds.has(id)))]};
}
// Categories, in the order every picker shows them: blades curated for the game, the legacy
// Puzzle Pirates set, drafts Claude made (templates to curate; NPCs still use them), then yours.
export const CURATED=['forgotten-falchion','sinners-saber'];
const LEGACY_FIRST=['scimitar','skull-dagger','falchion','saber','stick','foil'];
export const CATEGORIES=[{id:'curated',name:'Curated'},{id:'legacy',name:'Legacy'},{id:'drafts',name:'Claude\u2019s drafts'},{id:'yours',name:'Yours'}];
const themedIds=new Set(THEMED.map(p=>p.id));
export function patternCategory(p){const id=typeof p==='string'?p:p?.id;return CURATED.includes(id)?'curated':themedIds.has(id)?'drafts':String(id).startsWith('custom-')?'yours':'legacy';}
const rank=p=>{const c=CATEGORIES.findIndex(x=>x.id===patternCategory(p));const within=c===0?CURATED.indexOf(p.id):c===1&&LEGACY_FIRST.includes(p.id)?LEGACY_FIRST.indexOf(p.id):100;return c*1000+within;};
export function libraryPatterns(library,enamels={}){const all=[...PATTERNS.filter(p=>p.id!=='custom'&&!library.hidden.includes(p.id)).map(p=>equippedSword(p.id,enamels)),...THEMED.filter(p=>!library.hidden.includes(p.id)).map(p=>structuredClone(p)),...library.patterns];return all.map((p,i)=>[p,i]).sort((a,b)=>rank(a[0])-rank(b[0])||a[1]-b[1]).map(([p])=>p);}
export function savePattern(library,pattern){
 const p=cleanPattern(pattern);if(!p)throw Error('Choose a name and a valid pattern with 3–6 rows.');
 const next=structuredClone(library),i=next.patterns.findIndex(item=>item.id===p.id);if(i<0)next.patterns.push(p);else next.patterns[i]=p;return next;
}
export function deletePattern(library,id){
 const next=structuredClone(library);if(builtinIds.has(id))next.hidden=[...new Set([...next.hidden,id])];else next.patterns=next.patterns.filter(p=>p.id!==id);return next;
}
