export const DEFAULT_PROGRESSION=Object.freeze({version:1,firstAttackSec:8,jitter:.12,breakerStart:.25,breakerCap:.28,breakerRampPairs:100,stages:[
 {name:'Stage 1',atSec:0,intervalSec:12,swords:1,width:1,length:4,sprinkles:2},
 {name:'Stage 2',atSec:30,intervalSec:10,swords:1,width:1,length:4,sprinkles:3},
 {name:'Stage 3',atSec:60,intervalSec:8,swords:1,width:2,length:4,sprinkles:4},
 {name:'Stage 4',atSec:120,intervalSec:7,swords:1,width:2,length:6,sprinkles:5},
 {name:'Stage 5',atSec:180,intervalSec:5,swords:1,width:2,length:8,sprinkles:6},
 {name:'Stage 6',atSec:240,intervalSec:4,swords:2,width:2,length:8,sprinkles:8}
]});
const numeric=(v,min,max,label,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(label+' must be '+min+'–'+max+(integer?' (whole number).':'.'));return v;};
export function validateProgression(input){
 if(!input||input.version!==1||!Array.isArray(input.stages)||input.stages.length<1||input.stages.length>20)throw Error('Use progression version 1 with 1–20 stages.');
 const p={version:1,firstAttackSec:numeric(input.firstAttackSec,2,60,'First attack'),jitter:numeric(input.jitter,0,.3,'Interval variation'),breakerStart:numeric(input.breakerStart,.1,.4,'Starting breaker chance'),breakerCap:numeric(input.breakerCap,.1,.4,'Maximum breaker chance'),breakerRampPairs:numeric(input.breakerRampPairs,1,1000,'Breaker ramp pairs',true),stages:[]};
 if(p.breakerCap<p.breakerStart||p.breakerCap-p.breakerStart>.05+.00001)throw Error('Breaker growth must be between 0 and 5 percentage points.');
 for(const [i,s] of input.stages.entries()){const name=String(s.name??'').trim();if(!name||name.length>50)throw Error('Each stage needs a name of 1–50 characters.');const atSec=numeric(s.atSec,0,3600,'Stage start',true);if((i===0&&atSec!==0)||(i>0&&atSec<=p.stages[i-1].atSec))throw Error('Start at 0 seconds, then use strictly increasing stage times.');
  p.stages.push({name,atSec,intervalSec:numeric(s.intervalSec,2,120,'Attack interval'),swords:numeric(s.swords,0,3,'Swords',true),width:numeric(s.width,1,3,'Sword width',true),length:numeric(s.length,2,12,'Sword length',true),sprinkles:numeric(s.sprinkles,0,24,'Sprinkles',true)});
  if(!s.swords&&!s.sprinkles)throw Error('Each stage must send at least one sword or sprinkle.');
  if(s.swords&&s.width===1&&s.length>6)throw Error('Use width 2 or 3 for swords longer than 6 cells; there are no 1×8 swords.');
 }return p;
}
export function readProgression(value){try{return validateProgression(value);}catch{return validateProgression(DEFAULT_PROGRESSION);}}
export function progressionAt(ms,config=DEFAULT_PROGRESSION){const seconds=ms/1000;let index=0;for(let i=1;i<config.stages.length;i++)if(config.stages[i].atSec<=seconds)index=i;const stage=config.stages[index],next=config.stages[index+1]??null;return {index,level:index+1,stage,next,intervalMs:stage.intervalSec*1000,remainingMs:next?Math.max(0,next.atSec*1000-ms):null};}
export const progressionKey=config=>JSON.stringify(validateProgression(config));
