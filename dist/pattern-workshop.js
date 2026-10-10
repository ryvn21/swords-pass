import {offensive} from './name-filter.js';
import {PATTERNS as BASE_PATTERNS,THEMED} from './swords.js';
const PATTERNS=[...BASE_PATTERNS,...THEMED];
import {savePattern,deletePattern,CATEGORIES,patternCategory} from './pattern-library.js';
import {validatePattern,grid,applyAttack,horizontalBase,decay,W,H} from './engine.js';
import {COLORS,COLOR_NAMES,drawBoard} from './render.js';
import {swordIcon} from './sword-art.js';
import {listCommunity,shareBlade,countCopy,removeBlade,sharedMap,markShared} from './community.js';
// a small picture of the pattern itself, drawn with the game's own tiles
const thumb=rows=>`<span class="pattern-thumb" style="--cols:${rows[0]?.length||6}">${[...rows].reverse().map(r=>r.map(c=>`<i style="background-image:var(--tile-${c})"></i>`).join('')).join('')}</span>`;
const clone=x=>structuredClone(x),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS=[{id:'custom',name:'Plain'},...PATTERNS.filter(p=>p.id!=='custom')];
// small pixel glyphs for the row rail: a sword pointing up (strikes read from the bottom row upward) and a sprinkle
const STRIKE_GLYPH='<svg class="fg-glyph" viewBox="0 0 8 16" aria-hidden="true"><path d="M4 0 6 3V11H2V3Z" fill="#dfe6ea"/><path d="M1 11H7V12H1ZM3.5 12H4.5V15H3.5Z" fill="#d8b47a"/></svg>';
const SPRINKLE_GLYPH='<svg class="fg-glyph" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="6" width="4" height="4" fill="#d8b47a"/><rect x="7" y="2" width="4" height="4" fill="#d8b47a"/><rect x="6" y="8" width="3" height="3" fill="#a88a5a"/></svg>';
// Test strikes: what a rival receives from this pattern, dropped where you choose
const STRIKES=[{label:'1×4',kind:'vertical',width:1,length:4},{label:'2×4',kind:'vertical',width:2,length:4},{label:'2×6',kind:'vertical',width:2,length:6},{label:'2×8',kind:'vertical',width:2,length:8},{label:'Dual 2×13',kind:'vertical',width:2,length:13,dual:true,title:'Two full-height swords'},{label:'Side 6×2',kind:'horizontal',width:2,length:6,title:'A sword from the side, across the board'}];
// Show it off: a short, typical exchange (swords with sprinkles attached), then the swords crack into blocks
const SHOWCASE=[[1,0,1],[0,4,0],[2,1,1],[5,0,0],[0,4,1]];   // [strike, column, sprinkle rows]
// 2×2 same-colour squares on a board: places the receiver can turn your attack into a gem
function gemReady(b){let n=0;for(let y=0;y+1<H;y++)for(let x=0;x+1<W;x++){const c=b[y][x];if(!c)continue;const k=c.color;if(b[y][x+1]?.color===k&&b[y+1][x]?.color===k&&b[y+1][x+1]?.color===k)n++;}return n;}
export function createPatternWorkshop({getLibrary,getPatterns,persist,equip,selected,notify,download}){
 let tab='forge',shelf=null,shelfSort='new',shelfQuery='',shelfState='',busy=false;
 let host,draft,baseline,brush=0,undo=[],redo=[],deleted=null,testBoard=grid(),armed=0,strikeNo=0,testNote='';
 const snapshot=()=>({id:draft.id,name:draft.name,rows:clone(draft.rows),iconId:draft.iconId});
 const dirty=()=>JSON.stringify(snapshot())!==baseline;
 const custom=()=>getLibrary().patterns.some(p=>p.id===draft.id);
 const remember=()=>{undo.push(snapshot());undo=undo.slice(-60);redo=[];};
 const choose=p=>{draft={id:p.id,name:p.name,rows:clone(p.rows),iconId:p.iconId??p.id};baseline=JSON.stringify(snapshot());undo=[];redo=[];};
 const canLeave=()=>!dirty()||confirm('Discard unsaved pattern changes?');
 const guard=fn=>{if(!dirty())return fn();const A=globalThis.scrapsAsk;if(A)A({eyebrow:'UNSAVED CHANGES',title:'Discard this pattern?',body:'Your edits since the last save will be lost.',yes:'Discard'}).then(ok=>{if(ok)fn();});else if(confirm('Discard unsaved pattern changes?'))fn();};
 function select(p){guard(()=>{choose(p);render();});}
 function newPattern(){const go=()=>{choose({id:null,name:'',rows:Array.from({length:4},()=>Array(6).fill(0)),iconId:'custom'});render();};if(draft)guard(go);else go();}
 choose(selected()??PATTERNS[1]);
 const wireTabs=()=>{for(const b of host.querySelectorAll('[data-ftab]'))b.onclick=()=>{if(tab===b.dataset.ftab)return;tab=b.dataset.ftab;render();};};
 async function share(){if(busy)return;const A=globalThis.scrapsAsk,ok=A?await A({eyebrow:'COMMUNITY BLADES',title:`Share ${draft.name}?`,body:'Anyone playing Sword\u2019s Pass can see it and copy it into their own forge. You can take it down later.',yes:'Share'}):confirm('Share this blade with the community?');if(!ok)return;
  busy=true;try{const r=await shareBlade({name:draft.name,iconId:draft.iconId,rows:draft.rows});if(r.ok){markShared(draft.id,r.blade.id);shelf=null;notify(r.already?'Already shared.':'Shared with the community.');}else notify(r.error||'Couldn\u2019t share it.');}catch{notify('Couldn\u2019t reach the server. Try again in a moment.');}busy=false;render();}
 async function loadShelf(){shelfState='loading';try{shelf=await listCommunity(shelfSort);shelfState='';}catch{shelf=null;shelfState='offline';}if(tab==='community')render();}
 function renderShelf(tabs){
  if(!shelf&&shelfState!=='loading'&&shelfState!=='offline')loadShelf();
  const q=shelfQuery.trim().toLowerCase(),list=(shelf||[]).filter(b=>!q||b.name.toLowerCase().includes(q)||b.author.toLowerCase().includes(q));
  const card=b=>`<article class="cm-card"><div class="cm-art">${swordIcon(b.iconId)}</div><div class="cm-body"><strong>${esc(b.name)}</strong><small>by ${esc(b.author)}${b.mine?' · you':''}</small>${thumb(b.rows)}<small class="cm-uses">${b.uses?`Copied ${b.uses} time${b.uses===1?'':'s'}`:'New'}</small></div><div class="cm-actions"><button class="primary" data-cm-add="${esc(b.id)}">Add to my blades</button><button data-cm-open="${esc(b.id)}">Open in the forge</button>${b.mine?`<button class="text-button" data-cm-remove="${esc(b.id)}">Take down</button>`:''}</div></article>`;
  host.innerHTML=tabs+`<section class="panel cm-shelf"><div class="cm-head"><div><p class="eyebrow">COMMUNITY BLADES</p><p class="fine-print">Blades other players have shared. Add one to your blades, or open it in the forge to make it your own.</p></div><div class="cm-controls"><input id="cm-search" placeholder="Search blades or makers" aria-label="Search community blades" value="${esc(shelfQuery)}"><span class="segmented"><button data-cm-sort="new" class="${shelfSort==='new'?'on':''}" aria-pressed="${shelfSort==='new'}">Newest</button><button data-cm-sort="popular" class="${shelfSort==='popular'?'on':''}" aria-pressed="${shelfSort==='popular'}">Most copied</button></span></div></div>
  ${shelfState==='loading'&&!shelf?'<p class="cm-empty">Fetching the shelf…</p>':shelfState==='offline'?'<p class="cm-empty">Couldn\u2019t reach the community right now. <button class="text-button" id="cm-retry">Try again</button></p>':!list.length?`<p class="cm-empty">${q?'No blades match that.':'No shared blades yet. Save one in your forge, then press Share with the community.'}</p>`:`<div class="cm-grid">${list.map(card).join('')}</div>`}</section>`;
  wireTabs();const $=s=>host.querySelector(s),find=id=>shelf.find(b=>b.id===id);
  $('#cm-retry')?.addEventListener('click',()=>{shelfState='';render();});
  const search=$('#cm-search');search.oninput=e=>{shelfQuery=e.target.value;const at=e.target.selectionStart;render();const i=host.querySelector('#cm-search');i.focus();i.setSelectionRange(at,at);};
  for(const b of host.querySelectorAll('[data-cm-sort]'))b.onclick=()=>{if(shelfSort===b.dataset.cmSort)return;shelfSort=b.dataset.cmSort;shelf=null;shelfState='';render();};
  for(const b of host.querySelectorAll('[data-cm-add]'))b.onclick=()=>{const c=find(b.dataset.cmAdd);if(!c)return;try{const p={id:'custom-'+crypto.randomUUID(),name:c.name,rows:clone(c.rows),iconId:c.iconId};const next=savePattern(getLibrary(),p);if(persist(next)){countCopy(c.id);c.uses++;notify(`${c.name} added to your blades.`);render();}}catch(error){notify(error.message);}};
  for(const b of host.querySelectorAll('[data-cm-open]'))b.onclick=()=>{const c=find(b.dataset.cmOpen);if(!c)return;guard(()=>{choose({id:null,name:c.name,rows:c.rows,iconId:c.iconId});baseline='';tab='forge';render();});};
  for(const b of host.querySelectorAll('[data-cm-remove]'))b.onclick=async()=>{const c=find(b.dataset.cmRemove);if(!c)return;try{const r=await removeBlade(c.id);if(r.ok){shelf=shelf.filter(x=>x.id!==c.id);for(const [k,v] of Object.entries(sharedMap()))if(v===c.id)markShared(k,null);notify('Taken down.');render();}}catch{notify('Couldn\u2019t reach the server.');}};
 }
 function render(){if(!host?.isConnected)return;
 const tabs=`<div class="fg-tabs" role="tablist"><button role="tab" data-ftab="forge" aria-selected="${tab==='forge'}" class="${tab==='forge'?'on':''}">Your forge</button><button role="tab" data-ftab="community" aria-selected="${tab==='community'}" class="${tab==='community'?'on':''}">Community blades</button></div>`;
 if(tab==='community'){renderShelf(tabs);return;}
 const patterns=getPatterns(),isCustom=custom(),isBuiltin=PATTERNS.some(p=>p.id===draft.id),changed=dirty(),shared=draft.id&&sharedMap()[draft.id];
 host.innerHTML=tabs+`<div class="pattern-work-grid library-workshop"><aside class="panel pattern-library"><div class="library-heading"><p class="eyebrow">YOUR PATTERNS</p><span>${patterns.length}</span></div><button class="primary" id="new-pattern">+ New pattern</button>${CATEGORIES.map(cat=>{const list=patterns.filter(p=>patternCategory(p)===cat.id);return list.length?`<p class="pattern-cat">${esc(cat.name)} <span>${list.length}</span></p><div class="preset-rack">${list.map(p=>`<button class="pattern-preset ${p.id===draft.id?'selected':''}" data-preset="${esc(p.id)}" aria-pressed="${p.id===draft.id}">${thumb(p.rows)}<span><strong>${esc(p.name)}</strong><small>${p.id===selected()?.id?'Equipped':cat.id==='yours'?'Your pattern':cat.id==='drafts'?'Template':cat.name}</small></span></button>`).join('')}</div>`:'';}).join('')}<p class="fine-print">Saved on this browser. Export patterns to keep a backup.</p>${getLibrary().hidden.length?'<button class="text-button" id="restore-patterns">Restore built-in patterns</button>':''}${deleted?'<button class="text-button" id="undo-delete">Undo last deletion</button>':''}</aside>
 <section class="panel pattern-editor-panel forge-editor"><div class="editor-heading fg-head"><span class="fg-icon">${swordIcon(draft.iconId)}</span><div><h3 class="fg-title">${esc(draft.name.trim()||'Unnamed blade')}</h3><p id="pattern-status" role="status">${changed?'Unsaved changes':''}</p></div></div>
 <div class="fg-step"><p class="fg-step-head"><b>1</b>Paint the pattern</p>
 <div class="pattern-palette" aria-label="Paint colour">${COLORS.map((c,i)=>`<button data-paint="${i}" style="--swatch:${c}" class="swatch ${i===brush?'selected':''}" aria-label="Paint ${COLOR_NAMES[i]}" aria-pressed="${i===brush}">${['◇','○','△','□'][i]}</button>`).join('')}<button class="fg-fill" id="fill-pattern" title="Fill every square with ${COLOR_NAMES[brush].toLowerCase()}">Fill</button></div>
 <div class="fg-grid"><div class="fg-rail" style="grid-template-rows:repeat(${draft.rows.length},1fr)" aria-hidden="true"><span class="fg-strike" style="grid-row:1/${draft.rows.length-1}" title="Strike colours, read upward from the bottom row">${STRIKE_GLYPH}</span><span class="fg-spr" style="grid-row:${draft.rows.length-1}/${draft.rows.length+1}" title="The bottom two rows also colour your sprinkles">${SPRINKLE_GLYPH}</span></div><div class="pattern-editor">${[...draft.rows].reverse().map((row,i)=>row.map((c,x)=>`<button data-pattern="${x},${draft.rows.length-1-i}" style="background:${COLORS[c]}" aria-label="Pattern column ${x+1}, row ${draft.rows.length-i}, ${COLOR_NAMES[c]}">${['◇','○','△','□'][c]}</button>`).join('')).join('')}</div></div>
 <p class="fg-legend"><span>${STRIKE_GLYPH}strikes</span><span>${SPRINKLE_GLYPH}sprinkles</span></p>
 <div class="editor-tools fg-tools"><span class="fg-rows" role="group" aria-label="Rows"><button id="rows-less" aria-label="Fewer rows" ${draft.rows.length<=3?'disabled':''}>−</button><span>${draft.rows.length} rows</span><button id="rows-more" aria-label="More rows" ${draft.rows.length>=6?'disabled':''}>+</button></span><button id="mirror-pattern">Mirror</button><button id="undo-pattern" ${undo.length?'':'disabled'}>Undo</button><button id="redo-pattern" ${redo.length?'':'disabled'}>Redo</button></div></div>
 <div class="fg-step"><p class="fg-step-head"><b>2</b>Name it and choose its look</p><input id="pattern-name" class="fg-name" maxlength="32" placeholder="Name your blade" aria-label="Blade name" value="${esc(draft.name)}">
 <div class="fg-icons" role="radiogroup" aria-label="Blade icon">${ICONS.map(p=>`<button role="radio" data-icon="${esc(p.id)}" class="${draft.iconId===p.id?'on':''}" aria-checked="${draft.iconId===p.id}" title="${esc(p.name)}">${swordIcon(p.id)}</button>`).join('')}</div></div>
 <div class="fg-step"><p class="fg-step-head"><b>3</b>Save it</p><div class="editor-actions"><button class="primary" id="save-pattern">${isCustom?'Save changes & equip':'Save & equip'}</button><button id="equip-pattern" ${!draft.id||changed?'disabled':''}>Equip</button></div>${isCustom&&!changed?`<p class="fg-share">${shared?`<span>Shared with the community ✓</span><button id="unshare-pattern" class="text-button">Take it down</button>`:`<button id="share-pattern">Share with the community</button>`}</p>`:''}</div>
 <div class="editor-tools fg-more"><button id="duplicate-pattern">Duplicate</button><button class="danger" id="delete-pattern" ${!draft.id?'disabled':''}>Delete</button><details class="rogue-more pattern-more"><summary>More</summary><div class="rogue-more-menu"><button id="export-pattern">Export patterns</button><button id="import-pattern">Import patterns</button></div></details></div><input id="pattern-file" type="file" accept=".json,application/json" hidden></section>
 <aside class="panel pattern-test"><p class="eyebrow">TEST IT</p><p class="fine-print">Pick a strike and click a column, or watch it in action.</p>
  <div class="strike-picks">${STRIKES.map((t,i)=>`<button data-strike="${i}" class="${i===armed?'on':''}" aria-pressed="${i===armed}"${t.title?` title="${t.title}"`:''}>${t.label}</button>`).join('')}</div><div class="pt-sprinkles"><span>Sprinkle rows</span>${[1,2,3,4].map(n=>`<button data-sprinkle="${n}" title="Drop ${n} row${n>1?'s':''} of sprinkles" aria-label="Drop ${n} row${n>1?'s':''} of sprinkles">${n}</button>`).join('')}</div>
  <div class="pt-wrap"><div class="pt-frame"><canvas id="pt-board" role="img" aria-label="Test board"></canvas><div class="pt-cols">${Array.from({length:W},(_,x)=>`<button data-col="${x}" aria-label="Drop in column ${x+1}"></button>`).join('')}</div></div></div>
  <div class="strike-tools"><button id="pt-show" class="primary">Show it off</button><button id="pt-volley">Random volley</button><button id="pt-crack" title="Turn the landed swords into the coloured blocks your rival will play with">Crack them</button><button id="pt-clear" class="fb-clear">Clear</button></div>
  <p class="pt-read" id="pt-read">${testNote||'Drop a few strikes, then see how many gems your rival could make from them.'}</p></aside></div>`;
 const $=s=>host.querySelector(s),$$=s=>[...host.querySelectorAll(s)];
 $('#new-pattern').onclick=newPattern;
 wireTabs();
 $('#share-pattern')?.addEventListener('click',share);
 $('#unshare-pattern')?.addEventListener('click',async()=>{const id=sharedMap()[draft.id];try{await removeBlade(id);}catch{}markShared(draft.id,null);shelf=null;render();notify('Taken down from the community.');});
 for(const b of $$('[data-preset]'))b.onclick=()=>select(patterns.find(p=>p.id===b.dataset.preset));
 $('#pattern-name').oninput=e=>{draft.name=e.target.value;$('.fg-title').textContent=draft.name.trim()||'Unnamed blade';$('#pattern-status').textContent=dirty()?'Unsaved changes':'';$('#equip-pattern').disabled=dirty()||!draft.id;};
 for(const b of $$('[data-icon]'))b.onclick=()=>{if(draft.iconId===b.dataset.icon)return;remember();draft.iconId=b.dataset.icon;const keep=$('.fg-icons').scrollTop;render();$('.fg-icons').scrollTop=keep;};
 $('#fill-pattern').onclick=()=>{if(draft.rows.every(r=>r.every(c=>c===brush)))return;remember();draft.rows=draft.rows.map(r=>r.map(()=>brush));render();};
 for(const b of $$('[data-paint]'))b.onclick=()=>{brush=Number(b.dataset.paint);render();};
 for(const b of $$('[data-pattern]'))b.onclick=()=>{const [x,y]=b.dataset.pattern.split(',').map(Number);if(draft.rows[y][x]!==brush){remember();draft.rows[y][x]=brush;render();}};
 const rows=n=>{n=Math.max(3,Math.min(6,n));if(n===draft.rows.length)return;remember();while(draft.rows.length<n)draft.rows.push([...draft.rows[draft.rows.length-1]]);draft.rows=draft.rows.slice(0,n);render();};
 $('#rows-less').onclick=()=>rows(draft.rows.length-1);$('#rows-more').onclick=()=>rows(draft.rows.length+1);
 $('#mirror-pattern').onclick=()=>{remember();draft.rows=draft.rows.map(row=>[...row].reverse());render();};
 $('#undo-pattern').onclick=()=>{if(undo.length){redo.push(snapshot());draft=undo.pop();render();}};
 $('#redo-pattern').onclick=()=>{if(redo.length){undo.push(snapshot());draft=redo.pop();render();}};
 $('#save-pattern').onclick=()=>{if(offensive(draft.name)){notify('That name isn\u2019t allowed. Pick another.');return;}try{if(!draft.name.trim())draft.name='My blade';const p={...snapshot(),id:isCustom?draft.id:'custom-'+crypto.randomUUID()};const next=savePattern(getLibrary(),p);if(persist(next)){equip(p.id);choose(next.patterns.find(item=>item.id===p.id));render();notify('Pattern saved and equipped.');}}catch(error){notify(error.message);}};
 $('#equip-pattern').onclick=()=>{equip(draft.id);render();notify('Pattern equipped.');};
 $('#duplicate-pattern').onclick=()=>{draft={...snapshot(),id:null,name:(draft.name+' copy').slice(0,32)};baseline='';undo=[];redo=[];render();};
 $('#delete-pattern').onclick=()=>{if(patterns.length<=1){notify('Add another pattern before deleting the last one.');return;}const previous=getLibrary(),removed={id:draft.id,pattern:clone(previous.patterns.find(p=>p.id===draft.id)??null),index:previous.patterns.findIndex(p=>p.id===draft.id)},next=deletePattern(previous,draft.id);if(persist(next)){deleted=removed;choose(getPatterns().find(p=>p.id===selected()?.id)??getPatterns()[0]);render();notify('Pattern deleted. You can undo this in the library.');}};
 $('#undo-delete')?.addEventListener('click',()=>{const next=clone(getLibrary());if(deleted.pattern){if(!next.patterns.some(p=>p.id===deleted.id))next.patterns.splice(Math.max(0,deleted.index),0,deleted.pattern);}else next.hidden=next.hidden.filter(id=>id!==deleted.id);if(persist(next)){deleted=null;render();}});
 $('#restore-patterns')?.addEventListener('click',()=>{if(persist({...getLibrary(),hidden:[]}))render();});
 $('#export-pattern').onclick=()=>download({name:draft.name,rows:draft.rows,iconId:draft.iconId},'swords-pass-pattern.json');
 $('#import-pattern').onclick=()=>$('#pattern-file').click();
 for(const b of $$('[data-strike]'))b.onclick=()=>{showing++;armed=Number(b.dataset.strike);render();};
 const one=(t,x,board=testBoard)=>{const a={kind:t.kind,width:t.width,length:t.length,index:x-1,hand:x<3?-1:1,id:++strikeNo,stage:1};if(a.kind==='horizontal')a.base=horizontalBase(board,a.width);return applyAttack(board,a,draft.rows);};
 // a dual drops a second identical sword on the other side of the board
 const strike=(t,x,board=testBoard)=>{const hits=[one(t,x,board)];if(t.dual)hits.push(one(t,x<3?4:0,board));return hits;};
 const sprinkle=(rows,board=testBoard)=>applyAttack(board,{kind:'sprinkle',count:rows*W,hand:strikeNo%2?1:-1,id:++strikeNo},draft.rows);
 // Show it off: animate each strike landing (swords, then their sprinkles), then crack them
 let showing=0;
 const showcase=()=>{const run=++showing;testBoard=grid();testNote='';render();const steps=SHOWCASE.map(([i,x,r])=>[STRIKES[i],Math.max(0,Math.min(W-1,x+(Math.random()<.5?0:1))),Math.max(0,r+(Math.random()<.2?1:0))]);
  const dur=550,wait=350,frame=(k,start)=>now=>{if(run!==showing||!host?.isConnected)return;const cv=host.querySelector('#pt-board');if(!cv)return;const v=steps[k]?.vis;if(!v){return;}const t=Math.min(dur,now-start);drawBoard(cv,{board:testBoard,active:null,phase:'attack',attackVisual:v,timer:dur-t,motion:[],stats:{pieces:0},incoming:[]},{time:now});if(t<dur)requestAnimationFrame(frame(k,start));else setTimeout(()=>next(k+1),wait);};
  const next=k=>{if(run!==showing||!host?.isConnected)return;if(k>=steps.length){setTimeout(()=>{if(run!==showing)return;for(let i=0;i<3;i++)decay(testBoard);read();showing++;render();},500);return;}const [t,x,r]=steps[k],before=testBoard.map(row=>row.map(c=>c&&{...c})),hits=strike(t,x);if(r)hits.push(sprinkle(r));steps[k].vis={before,hits,duration:dur};requestAnimationFrame(now=>frame(k,now)(now));};
  next(0);};
 const read=()=>{const cells=testBoard.flat().filter(Boolean),locked=cells.some(c=>c.stage),n=gemReady(testBoard);testNote=!cells.length?'':locked?`${cells.length} blocks landed. Press Crack them to see the colours your rival gets.`:`${n} gem-ready square${n===1?'':'s'} for your rival in ${cells.length} blocks${n?'':' · nothing to build on'}. Fewer is a stronger blade.`;};
 for(const b of $$('[data-col]'))b.onclick=()=>{showing++;strike(STRIKES[armed],Number(b.dataset.col));read();render();};
 for(const b of $$('[data-sprinkle]'))b.onclick=()=>{showing++;sprinkle(Number(b.dataset.sprinkle));read();render();};
 $('#pt-show').onclick=showcase;
 $('#pt-volley').onclick=()=>{showing++;for(let i=0;i<4;i++){strike(STRIKES[Math.floor(Math.random()*4)],Math.floor(Math.random()*W));if(Math.random()<.5)sprinkle(1);}read();render();};
 $('#pt-crack').onclick=()=>{showing++;for(let i=0;i<3;i++)decay(testBoard);read();render();};
 $('#pt-clear').onclick=()=>{showing++;testBoard=grid();testNote='';render();};
 drawBoard($('#pt-board'),{board:testBoard,active:null,phase:'entry',timer:0,motion:[],stats:{pieces:0}},{});
 $('#pattern-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>10000)throw Error('Choose a small pattern JSON file.');const p=JSON.parse(await f.text());if(!validatePattern(p.rows))throw Error('A pattern needs 3–6 rows of six colours (0–3).');if(!canLeave())return;choose({id:null,name:String(p.name??'Imported pattern').slice(0,32),rows:p.rows,iconId:PATTERNS.some(s=>s.id===p.iconId)?p.iconId:'custom'});render();notify('Imported. Save to add it to your library.');}catch(error){notify(error.message);}};
 }
 return {mount(element){host=element;if(!dirty()&&PATTERNS.some(p=>p.id===draft.id)){const current=getPatterns().find(p=>p.id===draft.id);if(current)choose(current);}render();},select,newPattern};
}
