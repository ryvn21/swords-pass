import {createMatch,step,clone,random,PATTERNS} from './engine.js';
import {handlingRules} from './handling-profile.js';

export const pairedPlayer=entry=>entry.game.players[entry.side];
export function createPairedDuels({seed=1,difficulty='medium',rules,patterns=PATTERNS.map(p=>p.rows)}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!['easy','medium','hard'].includes(difficulty))throw Error('Invalid paired duel options.');
 const c={seed,difficulty,rules:handlingRules(rules),elapsed:0,tick:0,round:1,matches:[],entries:[],events:[],finished:false,winner:null};
 c.entries=Array.from({length:4},(_,id)=>({id,name:['You','Pip','Marlow','Rook'][id],pattern:clone(patterns[id%patterns.length]),status:'playing',opponentId:null,round:1,wins:0,deathAt:null}));
 const ids=[0,1,2,3],rng=random(seed^0x75af91);for(let i=3;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 startPair(c,ids.slice(0,2));startPair(c,ids.slice(2));return c;
}
function startPair(c,ids,carry=false){
 const game=createMatch({seed:c.seed,rules:c.rules,pattern:c.entries[ids[0]].pattern,opponentPattern:c.entries[ids[1]].pattern});
 if(carry)for(const key of ['nextAttackId','swordIndex','sprinkleIndex'])game[key]=Math.max(...ids.map(id=>c.entries[id].game[key]));
 ids.forEach((id,side)=>{
  const e=c.entries[id];
  if(carry){const p=clone(pairedPlayer(e));
   // New opponent, new attack queue. Keep the board, indexed pieces and current
   // player resolution. An attack already painted on the board stays there.
   p.incoming=[];p.readyAttacks=[];p.pendingAttack=[];p.pendingSprinkles=0;p.bufferedRotation=0;
   if(p.phase==='attack'){p.phase='settle';p.timer=c.rules.settleMs;p.attackVisual=null;}
   if(p.fast){p.fall=p.fall/c.rules.fastFallMs*c.rules.gravityMs;p.fast=false;}
   game.players[side]=p;
  }
  e.game=game;e.side=side;e.status='playing';e.opponentId=ids[1-side];e.round=c.round;
 });
 c.matches.push({ids,game,done:false});
}
export function stepPairedDuels(c,dt=1000/60,actions=[]){
 if(c.finished)return c;c.elapsed+=dt;c.tick++;c.events=[];
 for(const m of c.matches){if(m.done)continue;
  step(m.game,dt,actions.filter(a=>m.ids.includes(a.side)).map(a=>({side:m.ids.indexOf(a.side),action:a.action})));
  c.events.push(...m.game.events.map(e=>({...e,side:e.side===undefined?undefined:m.ids[e.side]})));
  if(m.game.winner!==null){m.done=true;for(const id of m.ids){const e=c.entries[id];e.opponentId=null;
   if(pairedPlayer(e).dead){e.status='out';e.deathAt=c.elapsed;}else{e.status='waiting';e.wins++;}
  }}
 }
 if(c.matches.every(m=>m.done)){
  const alive=c.entries.filter(e=>e.status==='waiting');
  if(alive.length===2){c.round++;c.matches=[];startPair(c,alive.map(e=>e.id),true);c.events.push({type:'rematch',round:c.round});}
  else{c.finished=true;c.winner=alive[0]?.id??null;if(alive[0])alive[0].status='winner';c.events.push({type:'complete',winner:c.winner});}
 }
 return c;
}
export function pairedStandings(c){return [...c.entries].sort((a,b)=>b.wins-a.wins||a.id-b.id).map(e=>({id:e.id,name:e.name,status:e.status,wins:e.wins,opponentId:e.opponentId}));}
