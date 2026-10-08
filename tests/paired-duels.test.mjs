import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairedDuels,stepPairedDuels,pairedPlayer,pairedStandings} from '../dist/paired-duels.js';
import {block} from '../dist/engine.js';

test('four unique players form two deterministic random pairs with shared rules',()=>{
 const a=createPairedDuels({seed:51,difficulty:'hard',rules:{gravityMs:970,fastFallMs:230}}),b=createPairedDuels({seed:51});
 assert.deepEqual(a.matches.map(m=>m.ids),b.matches.map(m=>m.ids));
 assert.deepEqual(a.matches.flatMap(m=>m.ids).sort(),[0,1,2,3]);
 assert.ok(a.entries.every(e=>e.game.rules.gravityMs===970&&e.game.rules.fastFallMs===230));
 assert.equal(a.difficulty,'hard');
 assert.ok(new Set(Array.from({length:20},(_,seed)=>createPairedDuels({seed}).entries[0].opponentId)).size>1);
});
test('a real clear queues one batch only on the matched opponent',()=>{
 const c=createPairedDuels({seed:7}),source=c.entries[0],p=pairedPlayer(source);
 p.active=null;p.phase='settle';p.timer=1;p.board[0][0]=block(0,true);p.board[0][1]=block(0);
 for(let i=0;i<100;i++)stepPairedDuels(c,1000/60);
 assert.ok(p.stats.cleared>=2);
 assert.equal(pairedPlayer(c.entries[source.opponentId]).incoming.length,1);
 for(const e of c.entries)if(e.id!==source.opponentId)assert.equal(pairedPlayer(e).incoming.length,0);
});
test('first winner waits, final preserves boards and discards old opponents queued attacks',()=>{
 const c=createPairedDuels({seed:8}),[a,b]=c.matches;
 const winner=c.entries[a.ids[0]],p=pairedPlayer(winner);p.board[0][0]=block(2);p.incoming.push({id:42,due:99,attacks:[]});
 a.game.players[1].dead=true;stepPairedDuels(c);
 assert.equal(winner.status,'waiting');assert.equal(c.round,1);const before=JSON.stringify(p);
 stepPairedDuels(c,100);assert.equal(JSON.stringify(p),before);
 a.game.nextAttackId=103;b.game.nextAttackId=57;b.game.players[1].dead=true;stepPairedDuels(c);
 assert.equal(c.round,2);assert.equal(c.matches.length,1);assert.equal(winner.status,'playing');
 assert.equal(pairedPlayer(winner).board[0][0].color,2);assert.equal(pairedPlayer(winner).incoming.length,0);
 assert.equal(winner.opponentId,b.ids[0]);
 assert.equal(winner.game.nextAttackId,103);
 c.matches[0].game.players[1-winner.side].dead=true;stepPairedDuels(c);
 assert.equal(c.finished,true);assert.equal(c.winner,winner.id);assert.equal(pairedStandings(c)[0].id,winner.id);
});
test('simultaneous double elimination yields no finalist and never stalls',()=>{
 const c=createPairedDuels({seed:1});for(const e of c.entries)pairedPlayer(e).dead=true;
 stepPairedDuels(c);assert.equal(c.finished,true);assert.equal(c.winner,null);
});
test('one drawn semifinal grants the remaining winner the match',()=>{
 const c=createPairedDuels({seed:3});for(const p of c.matches[0].game.players)p.dead=true;
 c.matches[1].game.players[1].dead=true;const survivor=c.matches[1].ids[0];
 stepPairedDuels(c);assert.equal(c.finished,true);assert.equal(c.winner,survivor);
});
