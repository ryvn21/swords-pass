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
 ['gravityMs','Natural fall per row',150,4000,10],
 ['fastFallMs','Fast fall per row',16,600,5],
 ['lockMs','Landing grace',0,650,10],
 ['entryMs','Next pair delay',0,300,5],
 ['spawnGraceMs','Spawn adjustment time',0,600,10],
 ['repeatDelayMs','Held movement delay',70,350,5],
 ['repeatMs','Held movement repeat',30,180,5],
 ['clearMs','Break animation',80,800,5],
 ['attackMs','Strike fall (full board)',100,800,1],
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
 if(input?.speedUp===true)out.speedUp=true;
 if(input?.landOnce===true)out.landOnce=true;
 if(input?.stallHold===true)out.stallHold=true;   // (last night's stall: held the pair still; kept for saves made with it)
 if(input?.stallSlow===true)out.stallSlow=true;
 if(input?.topTuck===true)out.topTuck=true;
 if(input?.freeSlide===true)out.freeSlide=true;
 if(input?.yppRotate===true)out.yppRotate=true;  // YPP rotation: radial, 90/180/270°, popups only when turning to point down
 if(input?.yppAttack===true)out.yppAttack=true;
 if(input?.slideDrop===true)out.slideDrop=true;  // slid off a ledge while landing: falls at once  // YPP attack timing: strikes one by one at a steady speed, then sprinkle stacks  // sideways moves judged on the pair's own row only      // flips at the very top turn around the lower cell   // stalls slow the rest of the row instead (never below half speed)
 if(Number.isInteger(input?.kickLimit))out.kickLimit=Math.max(0,Math.min(9,input.kickLimit));
 return out;
}
// The Default timings: what new players start with, what ticking "Default timings" returns to, and the
// standard timing for online matches. (Engine DEFAULT_RULES stay as they are for saves and replays.)
// Rows are 40 px; a speed in px/ms gives 40 ÷ speed ms a row.
//   natural fall  starts at 0.01 px/ms (4000 ms a row) and speeds up as you land blocks (engine: rules.speedUp)
//   landing window 500 ms at the start (YPP: 5 ÷ speed), shrinking with the speed (20 ms at the cap); slide off a ledge and it falls at once; starts on the first touch, never extended
//                 (landOnce: slid off a ledge it falls when the window ends; resting on the same row again locks at once)
//   flips         YPP rotation (yppRotate): radial, tries 90/180/270° each in place, right, left; past half a row the row
//                 below must be free; turning to point down may pop up a row, at most 2 times a pair (kickLimit). No stall.
//   moves         past half a row a sideways move also needs the row below free (no squeezing under overhangs)
//   Space         0.8 px/ms, off again when each new pair spawns; no early press → 50 ms a row, 0 ms window
//   attacks       YPP timing (yppAttack): strikes land one at a time, 1.2 px/ms (33 ms a row, 22.5 ms a column from the
//                 side; attackMs = a full 13-row fall, 433 ms), then each column's sprinkles drop as one stack; loose blocks 33 ms a row
//   breaks        75 ms between depth levels, then 250 ms before the board moves on (the burst keeps flying)
//   held left/right 300 ms, then 7 a second                                    → 300 / 142 ms
export const HOUSE_RULES=handlingRules({speedUp:true,landOnce:true,kickLimit:2,gravityMs:4000,lockMs:500,fastFallMs:50,entryMs:0,spawnGraceMs:0,repeatDelayMs:300,repeatMs:142,clearMs:250,waveMs:75,settleMs:33,attackMs:433,dropBufferMs:0,stallFlips:0,yppRotate:true,yppAttack:true,slideDrop:true,wellFlip:true});
export const DEFAULT_TIMINGS=HOUSE_RULES;
// the previous house setup (2400 ms fall), kept as a starting point for anyone who had it
export const PREVIOUS_HOUSE_RULES=handlingRules({gravityMs:2400,fastFallMs:46,lockMs:180,entryMs:0,spawnGraceMs:0,repeatDelayMs:170,repeatMs:90,clearMs:250,attackMs:400,dropBufferMs:160,stallFlips:3,wellFlip:true});
export const HANDLING_PRESETS=[{id:'default',label:'Default',rules:HOUSE_RULES}];
// v5: everyone moves onto the current Default timings once (ticked), whatever they had chosen; their own timings
// are kept as their custom scheme for whenever they untick it. Key bindings are never touched.
export function migrateToHouse(prefs={}){
 const v=prefs.houseVersion??0;if(v>=5)return prefs;
 const had=prefs.useDefaultTimings===false&&prefs.rules&&typeof prefs.rules==='object'?handlingRules(prefs.rules):prefs.customRules??(prefs.rules&&v<4?handlingRules({...PREVIOUS_HOUSE_RULES,...prefs.rules}):null);
 return {...prefs,houseVersion:5,useDefaultTimings:true,customRules:had??{...PREVIOUS_HOUSE_RULES},rules:{...HOUSE_RULES}};
}

// Key bindings: each action can have several keys (e.g. fast fall on Space or G).
export const KEY_ACTIONS={left:'Move left',right:'Move right',ccw:'Rotate counterclockwise',cw:'Rotate clockwise',drop:'Fast fall',pause:'Pause / resume'};
export const DEFAULT_KEYS={left:['ArrowLeft'],right:['ArrowRight'],ccw:['ArrowUp'],cw:['ArrowDown'],drop:['Space'],pause:['Escape']};
export const keysOf=(keys,action)=>{const k=keys?.[action];return Array.isArray(k)?k:k?[k]:[];};
export function normalizeKeys(keys={}){const out={};for(const a of Object.keys(KEY_ACTIONS)){const k=keysOf(keys,a);out[a]=k.length?[...new Set(k)].slice(0,4):[...DEFAULT_KEYS[a]];}return out;}
export const actionFor=(keys,code)=>Object.keys(KEY_ACTIONS).find(a=>keysOf(keys,a).includes(code));
export const handlingKey=rules=>Object.entries(handlingRules(rules)).filter(([k])=>k!=='stallFlips'&&k!=='wellFlip'&&k!=='dropBufferMs').map(([k,v])=>k+'='+v).join(',');
export function fallSummary(rules){const r=handlingRules(rules);return `${(1000/r.gravityMs).toFixed(2)} rows/s to start (in duels it speeds up as you land blocks, up to 6.25) · Space ${(1000/r.fastFallMs).toFixed(2)} rows/s`;}

// Held left/right: one step the moment you press it (or the moment a new pair appears while you're holding it),
// then another after repeatDelayMs, then one every repeatMs. Steps only go to a pair that is falling.
export const pairKey=p=>p&&p.phase==='fall'&&p.active?p.nextIndex:-1;
export function heldStep(h,p,elapsed,rules){
 if(h.action!=='left'&&h.action!=='right')return false;const k=pairKey(p);if(k<0)return false;
 if(h.pair!==k){h.pair=k;h.next=elapsed+rules.repeatDelayMs;return true;}
 if(elapsed>=h.next){h.next=elapsed+rules.repeatMs;return true;}
 return false;
}
