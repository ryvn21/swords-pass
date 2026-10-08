/** JSON-only authoring boundary. New effect kinds require an implementation and tests. */
import {random} from './engine.js';

export const CONTENT_VERSION=1;
export const EFFECT_LIMITS=Object.freeze({scorePercent:[1,50],chainBonus:[1,100],breakerBonus:[.005,.05],attackDelayMs:[100,3000]});
const encounter=(id,name,durationMs,objective,intervalMs,width=1)=>({id,name,description:'Clear space, build gems and keep column 4 open.',durationMs,objective,attacks:{firstMs:8000,intervalMs,jitter:.1,swords:1,width,length:4,sprinkles:2}});
export const DEFAULT_CAMPAIGN={version:1,id:'foundation',name:'Solo run',description:'Three encounters. Choose an upgrade between boards. Your build lasts for this run.',route:[['opening'],['pressure'],['final']],encounters:[
 encounter('opening','Opening',45000,{kind:'survive',target:45000},12000),
 encounter('pressure','Pressure',60000,{kind:'blocks',target:24},10000),
 encounter('final','Final encounter',75000,{kind:'score',target:700},8000,2)
],upgrades:[
 {id:'clear-value',name:'Clear value',description:'+20% points from completed clears per stack.',maxStacks:3,effects:[{kind:'scorePercent',amount:20}]},
 {id:'chain-value',name:'Chain value',description:'+30 points per extra combo stage per stack, before the score bonus.',maxStacks:3,effects:[{kind:'chainBonus',amount:30}]},
 {id:'breaker-supply',name:'Breaker supply',description:'+2 percentage points to breaker chance per stack; capped at 40%.',maxStacks:3,effects:[{kind:'breakerBonus',amount:.02}]},
 {id:'breathing-room',name:'Breathing room',description:'+1 second before each attack wave per stack; capped at 5 seconds.',maxStacks:3,effects:[{kind:'attackDelayMs',amount:1000}]}
]};

export function numberIn(value,min,max,label,integer=false){
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error(`${label} must be ${min}–${max}${integer?' (whole number)':''}.`);
 return value;
}
function text(value,label,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${label} needs 1–${max} characters.`);return value;}
function id(value){if(typeof value!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(value))throw Error('IDs must use lowercase letters, numbers and hyphens.');return value;}
function list(value,min,max,label){if(!Array.isArray(value)||value.length<min||value.length>max)throw Error(`${label} needs ${min}–${max} entries.`);return value;}
function unique(items,label){if(new Set(items.map(v=>v.id)).size!==items.length)throw Error(`Duplicate ${label} ID.`);}

/** Validate and return a detached canonical definition; never retain unknown fields. */
export function validateCampaign(c){
 if(c?.version!==CONTENT_VERSION)throw Error('Unsupported campaign version.');
 const encounters=list(c.encounters,1,24,'Encounters').map(e=>{
  const durationMs=numberIn(e.durationMs,1000,180000,'Encounter duration',true),o=e.objective,a=e.attacks;
  if(!['survive','blocks','score'].includes(o?.kind))throw Error('Unknown encounter objective.');
  const target=numberIn(o.target,1,o.kind==='survive'?durationMs:o.kind==='blocks'?2000:100000,'Objective target',true);
  if(!a)throw Error('Missing attack schedule.');
  const attacks={firstMs:numberIn(a.firstMs,100,180000,'First attack',true),intervalMs:numberIn(a.intervalMs,1000,120000,'Attack interval',true),jitter:numberIn(a.jitter,0,.25,'Attack jitter'),swords:numberIn(a.swords,0,3,'Swords',true),width:numberIn(a.width,1,3,'Sword width',true),length:numberIn(a.length,2,12,'Sword length',true),sprinkles:numberIn(a.sprinkles,0,24,'Sprinkles',true)};
  if(!attacks.swords&&!attacks.sprinkles)throw Error('Attack waves cannot be empty.');
  if(attacks.swords&&attacks.width===1&&attacks.length>6)throw Error('There are no 1×8 swords; use width 2 or 3.');
  return {id:id(e.id),name:text(e.name,'Encounter name',80),description:text(e.description,'Encounter description',400),durationMs,objective:{kind:o.kind,target},attacks};
 });unique(encounters,'encounter');
 const route=list(c.route,1,8,'Route').map(slot=>list(slot,1,12,'Route slot').map(value=>{id(value);if(!encounters.some(e=>e.id===value))throw Error('Route references an unknown encounter.');return value;}));
 if(route.reduce((n,slot)=>n+Math.max(...slot.map(value=>encounters.find(e=>e.id===value).durationMs)),0)>600000)throw Error('A run may last at most ten minutes.');
 const upgrades=list(c.upgrades,0,32,'Upgrades').map(u=>({id:id(u.id),name:text(u.name,'Upgrade name',80),description:text(u.description,'Upgrade description',400),maxStacks:numberIn(u.maxStacks,1,5,'Stack limit',true),effects:list(u.effects,1,4,'Effects').map(e=>{
  if(!Object.hasOwn(EFFECT_LIMITS,e.kind))throw Error('Unknown upgrade effect.');
  return {kind:e.kind,amount:numberIn(e.amount,...EFFECT_LIMITS[e.kind],'Effect amount')};
 })}));unique(upgrades,'upgrade');
 return {version:CONTENT_VERSION,id:id(c.id),name:text(c.name,'Campaign name',80),description:text(c.description,'Campaign description',400),route,encounters,upgrades};
}
export function routeFor(content,seed){const rng=random(seed^0x629fbad);return content.route.map(slot=>slot[Math.floor(rng()*slot.length)]);}
export const stacksOf=(inventory,id)=>Object.hasOwn(inventory,id)?inventory[id]:0;
export function rewardChoices(content,inventory,seed,roomIndex){
 const pool=content.upgrades.filter(u=>stacksOf(inventory,u.id)<u.maxStacks).map(u=>u.id),rng=random(seed^Math.imul(roomIndex+1,0x1738a51));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
export function modifiers(content,inventory){
 const out={scorePercent:0,chainBonus:0,breakerBonus:0,attackDelayMs:0};
 for(const u of content.upgrades)for(const e of u.effects)out[e.kind]+=e.amount*Math.min(u.maxStacks,stacksOf(inventory,u.id));
 out.scorePercent=Math.min(200,out.scorePercent);out.chainBonus=Math.min(300,out.chainBonus);out.breakerBonus=Math.min(.15,out.breakerBonus);out.attackDelayMs=Math.min(5000,out.attackDelayMs);
 return out;
}
