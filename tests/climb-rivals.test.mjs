import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CLIMB,validateClimb,swordComplexity} from '../dist/climb-content.js';
import {encounterOffers} from '../dist/climb-generator.js';
import {validateObjective,objectiveProgress,objectiveLabel} from '../dist/climb-objectives.js';
const C=validateClimb(DEFAULT_CLIMB);
const duelAt=(d,seed=99)=>{for(let s=seed;s<seed+40;s++){const e=encounterOffers(C,s,d,[]).find(x=>x.kind==='duel');if(e)return e;}};

test('rivals vary down the road and never repeat on consecutive depths',()=>{
 const names=new Set();let prev=null;
 for(let d=1;d<=60;d++){const e=encounterOffers(C,77,d,[]).find(x=>x.kind==='duel');if(!e){prev=null;continue;}names.add(e.opponent.name);if(prev&&d>1)assert.notEqual(e.opponent.rivalId,prev);prev=e.opponent.rivalId;}
 assert.ok(names.size>=8,[...names].join());
 assert.equal(duelAt(1).opponent.name,'Pip');
});

test('rival blades get busier as the climb goes on',()=>{
 const early=duelAt(1).opponent.sword,late=duelAt(45).opponent.sword;
 assert.ok(early&&late);assert.ok(swordComplexity(late.rows)>swordComplexity(early.rows),early.name+' vs '+late.name);
 assert.ok(C.rivalSwords.filter(s=>s.from===1).map(s=>s.name).includes('Stick'));
});

test('sword objectives: biggest sword formed, labelled by size, scaled with depth',()=>{
 const o=validateObjective({kind:'sword',target:8},'wave');
 assert.equal(objectiveLabel(o),'Form a 2×4 sword or bigger');
 assert.equal(objectiveProgress(o,{sword:4}).complete,false);assert.equal(objectiveProgress(o,{sword:12}).complete,true);
 const deep=encounterOffers(C,5,40,[]).concat(encounterOffers(C,6,40,[]),encounterOffers(C,7,40,[])).find(e=>e.templateId==='chain-route');
 if(deep)assert.ok(deep.objective.target>=18);
});

test('older saved content (no roster) keeps the original rival draw',()=>{
 const old=structuredClone(DEFAULT_CLIMB);delete old.rivals;delete old.rivalSwords;
 const e=encounterOffers(validateClimb(old),3,1,[])[0];assert.equal(e.opponent.name,'Pip');assert.equal(e.opponent.sword,undefined);
});
