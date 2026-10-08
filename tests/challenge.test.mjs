import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChallenge,stepChallenge,scoreClear,hazardAt,challengePair,standings,pressureAt,breakerRateAt} from '../dist/challenge.js';
import {block} from '../dist/engine.js';
test('scoring rewards each block, larger clears, and combo stage',()=>{
 assert.equal(scoreClear(4,1),40);assert.equal(scoreClear(8,1),100);assert.equal(scoreClear(8,3),300);assert.equal(scoreClear(0,2),0);
});
test('seeded hazards repeat exactly and accelerate without giant early attacks',()=>{
 assert.deepEqual(hazardAt(123,10),hazardAt(123,10));assert.notDeepEqual(hazardAt(123,10),hazardAt(124,10));
 const schedule=Array.from({length:100},(_,i)=>hazardAt(123,i));
 assert.ok(schedule.every((h,i)=>!i||h.at>schedule[i-1].at));
 assert.ok(pressureAt(240000).intervalMs<pressureAt(0).intervalMs);
 assert.ok(schedule[0].at>=7000);assert.ok(schedule.every(h=>h.attacks.every(a=>a.kind==='sprinkle'||a.width<=3)));
});
test('same attack is queued for each living player at their own next turn',()=>{
 const c=createChallenge({seed:1,players:4});c.entries[1].game.players[0].turn=7;
 c.elapsed=c.nextHazard.at-1;stepChallenge(c,1);
 const batches=c.entries.map(e=>e.game.players[0].incoming[0]);
 assert.deepEqual(batches.map(b=>b.due),[1,8,1,1]);
 assert.deepEqual(batches[0].attacks,batches[1].attacks);
 assert.notEqual(batches[0].attacks,batches[1].attacks);
});
test('hazards queue and wait for a lock; each lock receives one batch',()=>{
 const c=createChallenge({seed:1,players:1});c.elapsed=c.nextHazard.at-1;stepChallenge(c,1);c.elapsed=c.nextHazard.at-1;stepChallenge(c,1);
 const p=c.entries[0].game.players[0];assert.equal(p.incoming.length,2);p.active.y=0;p.spawnGrace=0;p.lock=349;stepChallenge(c,2);
 assert.equal(p.turn,1);assert.equal(p.incoming.length,1);assert.equal(p.readyAttacks?.length+(p.phase==='attack'?1:0),1);
});
test('piece stream is identical by index at every pace, breaker increase is small and capped',()=>{
 assert.deepEqual(challengePair(42,20),challengePair(42,20));
 assert.equal(breakerRateAt(0),.25);assert.equal(breakerRateAt(50),.265);assert.equal(breakerRateAt(100),.28);assert.equal(breakerRateAt(10000),.28);
 const a=createChallenge({seed:42,players:4});assert.ok(a.entries.every(e=>JSON.stringify(e.game.players[0].active.pair)===JSON.stringify(challengePair(42,0))));
});
test('timed challenge stops exactly at two minutes and scores only completed clears',()=>{
 const c=createChallenge({seed:1,players:1});c.elapsed=119990;stepChallenge(c,20);assert.equal(c.elapsed,120000);assert.equal(c.finished,true);assert.equal(c.reason,'time');const tick=c.tick;stepChallenge(c,20);assert.equal(c.tick,tick);
});
test('endless continues after one player dies and ranks by score, not last survivor',()=>{
 const c=createChallenge({seed:1,players:4,mode:'endless'});c.entries[0].score=900;c.entries[0].game.players[0].dead=true;stepChallenge(c,1);assert.equal(c.finished,false);
 for(const e of c.entries)e.game.players[0].dead=true;stepChallenge(c,1);assert.equal(c.finished,true);assert.equal(standings(c)[0].id,0);assert.equal(standings(c)[0].rank,1);
 c.entries[1].score=900;assert.deepEqual(standings(c).slice(0,2).map(e=>e.rank),[1,1]);
});
test('a real breaker clear increments score once and does not attack other contestants',()=>{
 const c=createChallenge({seed:1,players:4});const p=c.entries[0].game.players[0];p.board[0][0]=block(0);p.active={x:0,y:1,r:0,pair:[block(0,true),block(2)]};p.lock=349;stepChallenge(c,2);
 for(let i=0;i<150;i++)stepChallenge(c,16);
 assert.equal(c.entries[0].score,20);assert.equal(c.entries[1].game.players[0].incoming.length,0);
});
test('same seed and input log reproduce all boards and scores',()=>{
 const a=createChallenge({seed:771,players:4}),b=createChallenge({seed:771,players:4});
 for(let tick=0;tick<1800;tick++){const actions=tick%45===0?[{side:0,action:'cw'},{side:1,action:'left'},{side:2,action:'fastOn'}]:[];stepChallenge(a,1000/60,actions);stepChallenge(b,1000/60,actions);}
 assert.ok(a.hazards>0);assert.deepEqual(a,b);
});
