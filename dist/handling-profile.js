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
export const HANDLING_PRESETS=[
 {id:'relaxed',label:'Relaxed',rules:handlingRules({gravityMs:1000,fastFallMs:250,lockMs:400,entryMs:80,repeatDelayMs:185,repeatMs:80,dropBufferMs:200})},
 {id:'balanced',label:'Balanced',rules:handlingRules({...DEFAULT_RULES,repeatDelayMs:165,repeatMs:72,dropBufferMs:160})},
 {id:'brisk',label:'Brisk',rules:handlingRules({gravityMs:650,fastFallMs:150,lockMs:300,entryMs:50,repeatDelayMs:155,repeatMs:66,dropBufferMs:140})}
];
export const handlingKey=rules=>Object.entries(handlingRules(rules)).filter(([k])=>k!=='stallFlips'&&k!=='wellFlip'&&k!=='dropBufferMs').map(([k,v])=>k+'='+v).join(',');
export function fallSummary(rules){const r=handlingRules(rules);return `${(1000/r.gravityMs).toFixed(2)} rows/s · Space ${(1000/r.fastFallMs).toFixed(2)} rows/s`;}
