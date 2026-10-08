import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
test('all four arrow bindings have distinct readable labels',()=>{const declaration=source.match(/const prettyKey=([^\n]+)/)[1].trim().replace(/;$/,'');const label=vm.runInNewContext('('+declaration+')');const values=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].map(label);assert.equal(new Set(values).size,4);assert.ok(values.every(v=>v!=='?'&&!v.includes('\uFFFD')));});
test('remapping refreshes every visible guide without throwing',async()=>{const {actionFor,keysOf,KEY_ACTIONS}=await import('../dist/handling-profile.js');const handler=source.slice(source.indexOf("window.addEventListener('keydown'"),source.indexOf("window.addEventListener('keyup'"));const guides=[{outerHTML:''},{outerHTML:''}],prefs={keys:{left:['ArrowLeft'],right:['ArrowRight']}};let listener;const context={window:{addEventListener:(_,fn)=>listener=fn},bindAction:{action:'left',index:0},actionFor,keysOf,KEY_ACTIONS,prefs,save:()=>{},renderSettings:()=>{},toast:()=>{},$:()=>guides[0],$$:()=>guides,controlHTML:()=>'<div>new controls</div>'};vm.runInNewContext(handler,context);assert.doesNotThrow(()=>listener({code:'KeyA',preventDefault(){}}));assert.equal(JSON.stringify(prefs.keys.left),'["KeyA"]');assert.ok(guides.every(g=>g.outerHTML==='<div>new controls</div>'));});
test('touch move and rotate controls have distinct visible labels',()=>{const labels=[...source.matchAll(/data-touch="(?:left|right|cw|ccw)"[^>]*>([^<]+)</g)].map(m=>m[1]);assert.equal(labels.length,4);assert.equal(new Set(labels).size,4);assert.ok(!labels.includes('?'));});
test('all shipped text assets are valid UTF-8 without replacement characters',()=>{for(const name of fs.readdirSync(new URL('../dist/',import.meta.url))){if(!/\.(js|html|css)$/.test(name))continue;const b=fs.readFileSync(new URL('../dist/'+name,import.meta.url));let s;assert.doesNotThrow(()=>{s=new TextDecoder('utf-8',{fatal:true}).decode(b);},name+' must be UTF-8');assert.ok(!s.includes('\uFFFD'),name+' contains damaged text');}});

test('an action can have extra keys, and a key belongs to one action only',async()=>{
 const {actionFor,normalizeKeys,DEFAULT_KEYS}=await import('../dist/handling-profile.js');
 const keys=normalizeKeys({...DEFAULT_KEYS,drop:['Space','KeyG']});
 assert.equal(actionFor(keys,'KeyG'),'drop');assert.equal(actionFor(keys,'Space'),'drop');assert.equal(actionFor(keys,'ArrowLeft'),'left');assert.equal(actionFor(keys,'KeyQ'),undefined);
 assert.deepEqual(normalizeKeys({drop:'Space'}).drop,['Space']);   // older saves stored one key per action
});
