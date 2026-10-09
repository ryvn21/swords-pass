/** Climb content v1. Captured in each save; balance is authored here, not in the renderer. */
import {DEFAULT_CAMPAIGN,validateCampaign,numberIn} from './rogue-content.js';
import {validateObjective} from './climb-objectives.js';
import {PATTERNS} from './swords.js';
import {validatePattern,clone} from './engine.js';
// How busy a blade's colour layout is: the share of neighbouring cells that change colour.
// Stick and Foil sit low; Katana and Dadao sit high. Rivals carry harder blades as you climb.
export function swordComplexity(rows){let changes=0,cells=0;for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){cells++;if(x&&rows[y][x]!==rows[y][x-1])changes++;if(y&&rows[y][x]!==rows[y-1][x])changes++;}return cells?changes/cells:0;}
const SWORD_DEPTHS=[1,1,1,3,4,5,6,8,10,12,14,16,19,22,26,30,35,40,45,50];
const rivalSwords=()=>PATTERNS.filter(p=>p.id!=='custom'&&validatePattern(p.rows)).map(p=>({name:p.name,rows:clone(p.rows),c:swordComplexity(p.rows)})).sort((a,b)=>a.c-b.c||a.name.localeCompare(b.name)).map((p,i)=>({name:p.name,rows:p.rows,from:SWORD_DEPTHS[Math.min(i,SWORD_DEPTHS.length-1)]}));
export const DEFAULT_CLIMB={version:1,id:'endless-climb',name:'The Long Road',description:'Leave the tavern and travel as far as you can. Choose your next encounter, win relics, and rest at checkpoints at 5, 10, then every ten encounters.',
 checkpoints:{initial:[5,10],after:10,every:10},maxQueuedWaves:2,
 bands:[
  {from:1,label:'Finding your feet',difficulty:'easy',pace:.85,intervalMs:14000,width:1,length:4,sprinkles:1,scale:1},
  {from:4,label:'Building pressure',difficulty:'easy',pace:1.1,intervalMs:12000,width:1,length:4,sprinkles:2,scale:1.15},
  {from:8,label:'Holding your ground',difficulty:'medium',pace:1,intervalMs:10500,width:1,length:6,sprinkles:3,scale:1.3},
  {from:15,label:'A sharper challenge',difficulty:'medium',pace:1.2,intervalMs:9000,width:2,length:4,sprinkles:4,scale:1.5},
  {from:25,label:'Deep climb',difficulty:'hard',pace:1,intervalMs:8000,width:2,length:6,sprinkles:5,scale:1.7},
  {from:40,label:'Mastery',difficulty:'hard',pace:1.25,intervalMs:7000,width:2,length:6,sprinkles:6,scale:2}
 ],
 // Rivals met on the road. Strength comes from the depth band; the roster sets who and how they play
 // (style indexes ai.js STYLES). Each rival appears between from and to.
 rivals:[
  {id:'pip',name:'Pip',title:'The quick clearer',style:0,from:1,to:6},
  {id:'wren',name:'Wren',title:'The scrapper',style:3,from:1,to:9},
  {id:'tam',name:'Tam',title:'The careful hand',style:6,from:2,to:12},
  {id:'marlow',name:'Marlow',title:'The gem builder',style:1,from:3,to:18},
  {id:'bram',name:'Bram',title:'The hoarder',style:4,from:6,to:30},
  {id:'nell',name:'Nell',title:'The chain chaser',style:5,from:8,to:40},
  {id:'rook',name:'Rook',title:'The counterpuncher',style:2,from:12},
  {id:'sable',name:'Sable',title:'The patient blade',style:4,from:20},
  {id:'vesper',name:'Vesper',title:'The storm',style:5,from:25},
  {id:'warden',name:'The Warden',title:'Keeper of the deep road',style:6,from:35},
  {id:'ysolde',name:'Ysolde',title:'The gilded oath',style:2,from:45}
 ],
 rivalSwords:rivalSwords(),
 templates:[
  {id:'duel',name:'Duel',kind:'duel',weight:5,minDepth:1,durationMs:180000,objective:{kind:'defeat',target:1},rewardPoints:100},
  {id:'precision',name:'Duel with a challenge',kind:'duel',weight:3,minDepth:2,durationMs:180000,objective:{kind:'defeat',target:1},optional:{kind:'sword',target:8},rewardPoints:100,bonusPoints:150},
  {id:'clear-sprint',name:'Clear sprint',kind:'wave',weight:4,minDepth:2,durationMs:90000,objective:{kind:'blocks',target:30},rewardPoints:100},
  {id:'chain-route',name:'Find your opening',kind:'wave',weight:3,minDepth:3,durationMs:105000,objective:{kind:'sword',target:8},rewardPoints:125},
  {id:'hold',name:'Hold your ground',kind:'wave',weight:2,minDepth:3,durationMs:45000,objective:{kind:'survive',target:45000},rewardPoints:100},
  {id:'premium',name:'High stakes',kind:'duel',weight:1,minDepth:4,durationMs:150000,objective:{kind:'defeat',target:1},optional:{kind:'blocks',target:24},rewardPoints:250,bonusPoints:250,rare:true}
 ],
 bonus:{id:'checkpoint',name:'Checkpoint bonus',kind:'wave',durationMs:35000,objective:{kind:'blocks',target:8},rewardPoints:250},
 upgrades:[
  {id:'breaker-supply',name:'Lodestone',rarity:'common',flavor:'It pulls breakers out of the pile.',description:'+2 points of breaker chance per rank, up to 40%.',maxStacks:3,effects:[{kind:'breakerBonus',amount:.02}]},
  {id:'clear-value',name:"Miner's Lamp",rarity:'common',flavor:'More light, more gold in the seams.',description:'+20% points from every clear per rank.',maxStacks:3,effects:[{kind:'scorePercent',amount:20}]},
  {id:'breathing-room',name:'Hourglass of Ash',rarity:'common',flavor:'Sand that falls a little slower.',description:'Timed waves come 1 second slower per rank. Attacks still land between pairs.',maxStacks:3,effects:[{kind:'attackDelayMs',amount:1000}]},
  {id:'extra-sprinkles',name:'Scatter Pouch',rarity:'common',flavor:'A handful of grit for every strike.',description:'+1 sprinkle on each of your attacks per rank.',maxStacks:3,effects:[{kind:'sprinkleBonus',amount:1}]},
  {id:'miners-tithe',name:"Miner's Tithe",rarity:'common',flavor:'Every stone pays its toll.',description:'+3 points for every block you break, per rank.',maxStacks:3,effects:[{kind:'blockBounty',amount:3}]},
  {id:'taller-swords',name:'Whetstone',rarity:'rare',flavor:'Longer edges, deeper cuts.',description:'Your upright swords strike 1 row taller per rank.',maxStacks:3,effects:[{kind:'strikeHeightBonus',amount:1}]},
  {id:'chain-value',name:'Echo Bell',rarity:'rare',flavor:'Each chain rings louder than the last.',description:'+30 points for each extra chain stage, per rank.',maxStacks:3,effects:[{kind:'chainBonus',amount:30}]},
  {id:'ward-charm',name:'Ward Charm',rarity:'rare',flavor:'The first blow glances off.',description:'Turns aside the first attack wave of every encounter, +1 wave per rank.',maxStacks:3,effects:[{kind:'waveWard',amount:1}]},
  {id:'broad-edge',name:'Broad Edge',rarity:'rare',flavor:'Hammered wide at the forge.',description:'Your upright swords are 1 column wider per rank, up to 3.',maxStacks:2,effects:[{kind:'swordWidthBonus',amount:1}]},
  {id:'second-wind',name:'Second Wind',rarity:'legendary',flavor:'When the stack reaches your throat, breathe.',description:'Once per encounter, when column 4 nears the top, the top rows of your board shatter.',maxStacks:1,effects:[{kind:'secondWind',amount:1}]},
  {id:'blood-pact',name:'Blood Pact',rarity:'legendary',flavor:'More reward, less mercy.',description:'+35% points per rank, but waves arrive 1.5 seconds sooner per rank.',maxStacks:2,effects:[{kind:'scorePercent',amount:35},{kind:'attackHasteMs',amount:1500}]},
  {id:'echo-crown',name:'Thunder Crown',rarity:'legendary',flavor:'Big chains make the sky fall on them.',description:'Chains of 3 or more add +2 sprinkles to that attack per rank.',maxStacks:2,effects:[{kind:'chainSprinkles',amount:2}]}
 ]
};
const text=(x,label,max=240)=>{if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('Invalid '+label);return x;};
const ident=x=>{if(typeof x!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(x))throw Error('Invalid climb ID.');return x;};
export function validateClimb(value){
 if(value?.version!==1)throw Error('Unsupported climb content version.');
 const cp=value.checkpoints;
 if(!cp||!Array.isArray(cp.initial)||!cp.initial.length||cp.initial.length>8)throw Error('Invalid checkpoint schedule.');
 const initial=cp.initial.map(d=>numberIn(d,1,1000000,'Checkpoint depth',true));
 if(initial.some((n,i)=>i&&n<=initial[i-1]))throw Error('Checkpoints must increase.');
 const checkpoints={initial,after:numberIn(cp.after,initial.at(-1),1000000,'Repeating checkpoint start',true),every:numberIn(cp.every,1,1000,'Checkpoint interval',true)};
 if(!Array.isArray(value.bands)||!value.bands.length||value.bands.length>12)throw Error('Use 1–12 difficulty bands.');
 const bands=value.bands.map(b=>{
  if(!['easy','medium','hard'].includes(b.difficulty))throw Error('Invalid bot difficulty.');
  const band={from:numberIn(b.from,1,1000000,'Band depth',true),label:text(b.label,'band label',80),difficulty:b.difficulty,pace:numberIn(b.pace,.5,1.35,'Bot pace'),intervalMs:numberIn(b.intervalMs,6000,30000,'Attack interval',true),width:numberIn(b.width,1,2,'Sword width',true),length:numberIn(b.length,2,8,'Sword length',true),sprinkles:numberIn(b.sprinkles,0,8,'Sprinkles',true),scale:numberIn(b.scale,.5,2,'Objective scaling')};
  if(band.width===1&&band.length>6)throw Error('Narrow swords cap at six.');return band;
 });
 if(bands[0].from!==1||bands.some((b,i)=>i&&b.from<=bands[i-1].from))throw Error('Difficulty bands must start at one and increase.');
 function template(t,bonus=false){
  if(!t||!['duel','wave'].includes(t.kind)||(bonus&&t.kind!=='wave'))throw Error('Invalid encounter template.');
  const durationMs=numberIn(t.durationMs,1000,bonus?45000:180000,'Round duration',true);
  const out={id:ident(t.id),name:text(t.name,'encounter name',80),kind:t.kind,durationMs,objective:validateObjective(t.objective,t.kind,{durationMs}),rewardPoints:numberIn(t.rewardPoints,0,500,'Completion points',true)};
  if(!bonus){out.weight=numberIn(t.weight,1,10,'Template weight',true);out.minDepth=numberIn(t.minDepth,1,100,'First depth',true);out.rare=t.rare===true;}
  if(t.optional){out.optional=validateObjective(t.optional,t.kind,{durationMs,optional:true});out.bonusPoints=numberIn(t.bonusPoints,0,500,'Bonus points',true);}
  return out;
 }
 if(!Array.isArray(value.templates)||value.templates.length<3||value.templates.length>16)throw Error('Use 3–16 encounter templates.');
 const templates=value.templates.map(t=>template(t));
 if(new Set(templates.map(t=>t.id)).size!==templates.length||!templates.some(t=>t.id==='duel'&&t.kind==='duel'&&t.minDepth===1))throw Error('Templates need unique IDs and an opening duel.');
 // Reuse the existing strict modifier schema; no executable effects in imported content.
 const upgrades=validateCampaign({...DEFAULT_CAMPAIGN,upgrades:value.upgrades}).upgrades;
 if(upgrades.some(u=>u.id==='bank-points'))throw Error('bank-points is reserved for the completed reward pool.');
 const out={version:1,id:ident(value.id),name:text(value.name,'climb name',80),description:text(value.description,'climb description',400),checkpoints,maxQueuedWaves:numberIn(value.maxQueuedWaves,1,3,'Queued wave limit',true),bands,templates,bonus:template(value.bonus,true),upgrades};
 // Optional (newer content): a rival roster and the blades rivals carry. Older saves have neither
 // and keep the original Pip / Marlow / Rook draw with the player's own pattern pool.
 if(value.rivals!==undefined){
  if(!Array.isArray(value.rivals)||!value.rivals.length||value.rivals.length>24)throw Error('Use 1–24 rivals.');
  out.rivals=value.rivals.map(x=>{const r={id:ident(x.id),name:text(x.name,'rival name',40),title:text(x.title,'rival title',60),style:numberIn(x.style,0,15,'Rival style',true),from:numberIn(x.from,1,1000000,'Rival depth',true)};if(x.to!==undefined)r.to=numberIn(x.to,r.from,1000000,'Rival depth',true);return r;});
  if(!out.rivals.some(r=>r.from===1))throw Error('At least one rival must appear from the first encounter.');
 }
 if(value.rivalSwords!==undefined){
  if(!Array.isArray(value.rivalSwords)||!value.rivalSwords.length||value.rivalSwords.length>64)throw Error('Use 1–64 rival swords.');
  out.rivalSwords=value.rivalSwords.map(x=>{if(!validatePattern(x?.rows))throw Error('Invalid rival sword pattern.');return {name:text(x.name,'sword name',80),rows:clone(x.rows),from:numberIn(x.from,1,1000000,'Sword depth',true)};});
  if(!out.rivalSwords.some(s=>s.from===1))throw Error('At least one rival sword must be available from the first encounter.');
 }
 return out;
}
