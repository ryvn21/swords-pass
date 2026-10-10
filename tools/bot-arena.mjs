// Bot-vs-bot arena: node tools/bot-arena.mjs [games] — plays headless duels at the Default timings and prints win rates.
import {createMatch,step} from '../dist/engine.js';
import {HOUSE_RULES} from '../dist/handling-profile.js';
import {PATTERNS} from '../dist/swords.js';
import {makeBot,stepBot} from '../dist/bot.js';

const rows=id=>(PATTERNS.find(p=>p.id===id)??PATTERNS[0]).rows;
export function duel(a,b,seed,{maxMs=8*60e3}={}){
 const g=createMatch({mode:'duel',seed,rules:HOUSE_RULES,pattern:rows(a.blade),opponentPattern:rows(b.blade)});
 const A=makeBot({...a,seed:seed*7+1}),B=makeBot({...b,seed:seed*13+5});
 while(g.winner===null&&g.elapsed<maxMs){stepBot(g,0,A);stepBot(g,1,B);step(g,1000/60);}
 return {winner:g.winner,ms:g.elapsed,stats:g.players.map(p=>p.stats)};
}
export function series(a,b,n,seed0=1){let wa=0,wb=0,draw=0,ms=0;for(let i=0;i<n;i++){const flip=i%2,r=flip?duel(b,a,seed0+i):duel(a,b,seed0+i);const w=r.winner===null||r.winner==='draw'?null:flip?1-r.winner:r.winner;if(w===0)wa++;else if(w===1)wb++;else draw++;ms+=r.ms;}return {wa,wb,draw,avgS:Math.round(ms/n/1000)};}
if(import.meta.url===`file://${process.argv[1]}`){
 const n=+(process.argv[2]||6);const t0=Date.now();
 for(const [a,b] of [[{tier:3},{tier:1}],[{tier:6},{tier:3}],[{tier:9},{tier:6}],[{tier:10},{tier:8}]]){
  const r=series({style:'balanced',blade:'short-sword',...a},{style:'balanced',blade:'short-sword',...b},n);
  console.log(`tier ${a.tier} vs ${b.tier}: ${r.wa}-${r.wb} (${r.draw} draws), ~${r.avgS}s a game`);
 }
 console.log('took',Math.round((Date.now()-t0)/1000),'s');
}
