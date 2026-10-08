import {DEFAULT_RULES} from './engine.js';

// Move the previous default to a cancellable 250 ms window; preserve custom values.
// Saved runs/replays carry their own rules and never pass through this migration.
export function migrateSpawnAdjustment(prefs={}){
 if(prefs.spawnAdjustmentVersion>=2)return prefs;
 const old=prefs.rules?.spawnGraceMs;
 const spawnGraceMs=typeof old==='number'&&Number.isFinite(old)&&old!==125?Math.round(Math.max(0,Math.min(600,old))):DEFAULT_RULES.spawnGraceMs;
 return {...prefs,spawnAdjustmentVersion:2,rules:{...prefs.rules,spawnGraceMs}};
}
export const HANDLING_FIELDS=[
 ['gravityMs','Natural fall per row',150,1600,10],
 ['fastFallMs','Fast fall per row',16,600,5],
 ['lockMs','Landing grace',0,650,10],
 ['entryMs','Next pair delay',0,300,5],
 ['spawnGraceMs','Spawn adjustment time',0,600,10],
 ['repeatDelayMs','Held movement delay',70,350,5],
 ['repeatMs','Held movement repeat',30,180,5],
 ['clearMs','Break animation',80,500,5],
 ['attackMs','Incoming attack travel',100,800,10],
 ['dropBufferMs','Early fast-fall window',0,300,10]
];
export function handlingRules(input={}){
 const out={...DEFAULT_RULES};
 if(typeof input?.dropBufferMs==='number'&&Number.isFinite(input.dropBufferMs))out.dropBufferMs=input.dropBufferMs;   // opt-in: absent in older saves and replays
 for(const [key,value] of Object.entries(input??{}))if(key in out&&typeof value==='number'&&Number.isFinite(value))out[key]=Math.max(0,Math.min(key==='breakerRate'?1:5000,value));
 for(const [key,,min,max] of HANDLING_FIELDS)if(key in out)out[key]=Math.round(Math.max(min,Math.min(max,out[key])));
 out.fastFallMs=Math.min(out.fastFallMs,out.gravityMs);
 if(Number.isInteger(input?.stallFlips))out.stallFlips=Math.max(0,Math.min(3,input.stallFlips));
 if(input?.wellFlip===true)out.wellFlip=true;
 return out;
}
// The house setup: what new players start with, what "Restore defaults" returns to, and the
// standard timing for online matches. (Engine DEFAULT_RULES stay as they are for saves and replays.)
export const HOUSE_RULES=handlingRules({gravityMs:1600,fastFallMs:46,lockMs:180,entryMs:0,spawnGraceMs:0,repeatDelayMs:170,repeatMs:90,clearMs:250,attackMs:400,dropBufferMs:160,stallFlips:3,wellFlip:true});
export const HANDLING_PRESETS=[{id:'house',label:'Default',rules:HOUSE_RULES}];
// One-time switch of every saved timing setup to the house presets (key bindings are left alone).
export function migrateToHouse(prefs={}){
 if((prefs.houseVersion??0)>=2)return prefs;
 return {...prefs,houseVersion:2,rules:{...(prefs.rules||{}),...HOUSE_RULES}};
}

// Key bindings: each action can have several keys (e.g. fast fall on Space or G).
export const KEY_ACTIONS={left:'Move left',right:'Move right',ccw:'Rotate counterclockwise',cw:'Rotate clockwise',drop:'Fast fall',pause:'Pause / resume'};
export const DEFAULT_KEYS={left:['ArrowLeft'],right:['ArrowRight'],ccw:['ArrowUp'],cw:['ArrowDown'],drop:['Space'],pause:['Escape']};
export const keysOf=(keys,action)=>{const k=keys?.[action];return Array.isArray(k)?k:k?[k]:[];};
export function normalizeKeys(keys={}){const out={};for(const a of Object.keys(KEY_ACTIONS)){const k=keysOf(keys,a);out[a]=k.length?[...new Set(k)].slice(0,4):[...DEFAULT_KEYS[a]];}return out;}
export const actionFor=(keys,code)=>Object.keys(KEY_ACTIONS).find(a=>keysOf(keys,a).includes(code));
export const handlingKey=rules=>Object.entries(handlingRules(rules)).filter(([k])=>k!=='stallFlips'&&k!=='wellFlip'&&k!=='dropBufferMs').map(([k,v])=>k+'='+v).join(',');
export function fallSummary(rules){const r=handlingRules(rules);return `${(1000/r.gravityMs).toFixed(2)} rows/s · Space ${(1000/r.fastFallMs).toFixed(2)} rows/s`;}
