import {offensive} from './name-filter.js';
import {PATTERNS as BASE_PATTERNS,THEMED} from './swords.js';
const PATTERNS=[...BASE_PATTERNS,...THEMED];
import {savePattern,deletePattern,CATEGORIES,patternCategory} from './pattern-library.js';
import {validatePattern,grid,applyAttack,horizontalBase,decay,W,H} from './engine.js';
import {COLORS,COLOR_NAMES,drawBoard} from './render.js';
import {swordIcon} from './sword-art.js';
// a small picture of the pattern itself, drawn with the game's own tiles
const thumb=rows=>`<span class="pattern-thumb" style="--cols:${rows[0]?.length||6}">${[...rows].reverse().map(r=>r.map(c=>`<i style="background-image:var(--tile-${c})"></i>`).join('')).join('')}</span>`;
const clone=x=>structuredClone(x),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS=[{id:'custom',name:'Plain'},...PATTERNS.filter(p=>p.id!=='custom')];
// small pixel glyphs for the row rail: a sword pointing up (strikes read from the bottom row upward) and a sprinkle
const STRIKE_GLYPH='<svg class="fg-glyph" viewBox="0 0 8 16" aria-hidden="true"><path d="M4 0 6 3V11H2V3Z" fill="#dfe6ea"/><path d="M1 11H7V12H1ZM3.5 12H4.5V15H3.5Z" fill="#d8b47a"/></svg>';
const SPRINKLE_GLYPH='<svg class="fg-glyph" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="6" width="4" height="4" fill="#d8b47a"/><rect x="7" y="2" width="4" height="4" fill="#d8b47a"/><rect x="6" y="8" width="3" height="3" fill="#a88a5a"/></svg>';
// Test strikes: what a rival receives from this pattern, dropped where you choose
const STRIKES=[{label:'1×4',kind:'vertical',width:1,length:4},{label:'2×4',kind:'vertical',width:2,length:4},{label:'2×6',kind:'vertical',width:2,length:6},{label:'3×4',kind:'vertical',width:3,length:4},{label:'Wide 2×4',kind:'horizontal',width:2,length:4},{label:'Sprinkles',kind:'sprinkle',count:6}];
// 2×2 same-colour squares on a board: places the receiver can turn your attack into a gem
function gemReady(b){let n=0;for(let y=0;y+1<H;y++)for(let x=0;x+1<W;x++){const c=b[y][x];if(!c)continue;const k=c.color;if(b[y][x+1]?.color===k&&b[y+1][x]?.color===k&&b[y+1][x+1]?.color===k)n++;}return n;}
export function createPatternWorkshop({getLibrary,getPatterns,persist,equip,selected,notify,download}){
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
 function render(){if(!host?.isConnected)return;
 const patterns=getPatterns(),isCustom=custom(),isBuiltin=PATTERNS.some(p=>p.id===draft.id),changed=dirty();
 host.innerHTML=`<div class="pattern-work-grid library-workshop"><aside class="panel pattern-library"><div class="library-heading"><p class="eyebrow">YOUR PATTERNS</p><span>${patterns.length}</span></div><button class="primary" id="new-pattern">+ New pattern</button>${CATEGORIES.map(cat=>{const list=patterns.filter(p=>patternCategory(p)===cat.id);return list.length?`<p class="pattern-cat">${esc(cat.name)} <span>${list.length}</span></p><div class="preset-rack">${list.map(p=>`<button class="pattern-preset ${p.id===draft.id?'selected':''}" data-preset="${esc(p.id)}" aria-pressed="${p.id===draft.id}">${thumb(p.rows)}<span><strong>${esc(p.name)}</strong><small>${p.id===selected()?.id?'Equipped':cat.id==='yours'?'Your pattern':cat.id==='drafts'?'Template':cat.name}</small></span></button>`).join('')}</div>`:'';}).join('')}<p class="fine-print">Saved on this browser. Export patterns to keep a backup.</p>${getLibrary().hidden.length?'<button class="text-button" id="restore-patterns">Restore built-in patterns</button>':''}${deleted?'<button class="text-button" id="undo-delete">Undo last deletion</button>':''}</aside>
 <section class="panel pattern-editor-panel forge-editor"><div class="editor-heading fg-head"><span class="fg-icon">${swordIcon(draft.iconId)}</span><div><p class="eyebrow">${isBuiltin?'BUILT-IN · SAVES AS A COPY':draft.id?'YOUR BLADE':'FORGING A NEW BLADE'}</p><h3 class="fg-title">${esc(draft.name.trim()||'Unnamed blade')}</h3><p id="pattern-status" role="status">${changed?'Unsaved changes':isBuiltin?'Change anything, then save it as your own.':draft.id?'Saved in your library.':'Three steps: paint, name, save.'}</p></div></div>
 <div class="fg-step"><p class="fg-step-head"><b>1</b>Paint the pattern</p>
 <div class="pattern-palette" aria-label="Paint colour">${COLORS.map((c,i)=>`<button data-paint="${i}" style="--swatch:${c}" class="swatch ${i===brush?'selected':''}" aria-label="Paint ${COLOR_NAMES[i]}" aria-pressed="${i===brush}">${['◇','□','△','○'][i]}</button>`).join('')}<button class="fg-fill" id="fill-pattern" title="Fill every square with ${COLOR_NAMES[brush].toLowerCase()}">Fill</button></div>
 <div class="fg-grid"><div class="fg-rail" style="grid-template-rows:repeat(${draft.rows.length},1fr)" aria-hidden="true"><span class="fg-strike" style="grid-row:1/${draft.rows.length-1}" title="Strike colours, read upward from the bottom row">${STRIKE_GLYPH}</span><span class="fg-spr" style="grid-row:${draft.rows.length-1}/${draft.rows.length+1}" title="The bottom two rows also colour your sprinkles">${SPRINKLE_GLYPH}</span></div><div class="pattern-editor">${[...draft.rows].reverse().map((row,i)=>row.map((c,x)=>`<button data-pattern="${x},${draft.rows.length-1-i}" style="background:${COLORS[c]}" aria-label="Pattern column ${x+1}, row ${draft.rows.length-i}, ${COLOR_NAMES[c]}">${['◇','□','△','○'][c]}</button>`).join('')).join('')}</div></div>
 <p class="fg-legend"><span>${STRIKE_GLYPH}strikes</span><span>${SPRINKLE_GLYPH}sprinkles</span></p>
 <div class="editor-tools fg-tools"><span class="fg-rows" role="group" aria-label="Rows"><button id="rows-less" aria-label="Fewer rows" ${draft.rows.length<=3?'disabled':''}>−</button><span>${draft.rows.length} rows</span><button id="rows-more" aria-label="More rows" ${draft.rows.length>=6?'disabled':''}>+</button></span><button id="mirror-pattern">Mirror</button><button id="undo-pattern" ${undo.length?'':'disabled'}>Undo</button><button id="redo-pattern" ${redo.length?'':'disabled'}>Redo</button></div></div>
 <div class="fg-step"><p class="fg-step-head"><b>2</b>Name it and choose its look</p><input id="pattern-name" class="fg-name" maxlength="32" placeholder="Name your blade" aria-label="Blade name" value="${esc(draft.name)}">
 <div class="fg-icons" role="radiogroup" aria-label="Blade icon">${ICONS.map(p=>`<button role="radio" data-icon="${esc(p.id)}" class="${draft.iconId===p.id?'on':''}" aria-checked="${draft.iconId===p.id}" title="${esc(p.name)}">${swordIcon(p.id)}</button>`).join('')}</div></div>
 <div class="fg-step"><p class="fg-step-head"><b>3</b>Save it</p><div class="editor-actions"><button class="primary" id="save-pattern">${isCustom?'Save changes & equip':'Save & equip'}</button><button id="equip-pattern" ${!draft.id||changed?'disabled':''}>Equip</button></div></div>
 <div class="editor-tools fg-more"><button id="duplicate-pattern">Duplicate</button><button class="danger" id="delete-pattern" ${!draft.id?'disabled':''}>Delete</button><details class="rogue-more pattern-more"><summary>More</summary><div class="rogue-more-menu"><button id="export-pattern">Export patterns</button><button id="import-pattern">Import patterns</button></div></details></div><input id="pattern-file" type="file" accept=".json,application/json" hidden></section>
 <aside class="panel pattern-test"><p class="eyebrow">TEST IT</p><p class="fine-print">Pick a strike, then click a column to drop it. Strikes come in this pattern's colours.</p>
  <div class="strike-picks">${STRIKES.map((t,i)=>`<button data-strike="${i}" class="${i===armed?'on':''}" aria-pressed="${i===armed}">${t.label}</button>`).join('')}</div>
  <div class="pt-wrap"><div class="pt-frame"><canvas id="pt-board" role="img" aria-label="Test board"></canvas><div class="pt-cols">${Array.from({length:W},(_,x)=>`<button data-col="${x}" aria-label="Drop in column ${x+1}"></button>`).join('')}</div></div></div>
  <div class="strike-tools"><button id="pt-volley">Random volley</button><button id="pt-crack" title="Turn the landed swords into the coloured blocks your rival will play with">Crack them</button><button id="pt-clear" class="fb-clear">Clear</button></div>
  <p class="pt-read" id="pt-read">${testNote||'Drop a few strikes, then see how many gems your rival could make from them.'}</p></aside></div>`;
 const $=s=>host.querySelector(s),$$=s=>[...host.querySelectorAll(s)];
 $('#new-pattern').onclick=newPattern;
 for(const b of $$('[data-preset]'))b.onclick=()=>select(patterns.find(p=>p.id===b.dataset.preset));
 $('#pattern-name').oninput=e=>{draft.name=e.target.value;$('.fg-title').textContent=draft.name.trim()||'Unnamed blade';$('#pattern-status').textContent=dirty()?'Unsaved changes':'Saved in your library.';$('#equip-pattern').disabled=dirty()||!draft.id;};
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
 for(const b of $$('[data-strike]'))b.onclick=()=>{armed=Number(b.dataset.strike);render();};
 const strike=(t,x)=>{const a=t.kind==='sprinkle'?{kind:'sprinkle',count:t.count,hand:x<3?-1:1,id:++strikeNo}:{kind:t.kind,width:t.width,length:t.length,index:x-1,hand:1,id:++strikeNo,stage:1};if(a.kind==='horizontal')a.base=horizontalBase(testBoard,a.width);return applyAttack(testBoard,a,draft.rows);};
 const read=()=>{const cells=testBoard.flat().filter(Boolean),locked=cells.some(c=>c.stage),n=gemReady(testBoard);testNote=!cells.length?'':locked?`${cells.length} blocks landed. Press Crack them to see the colours your rival gets.`:`${n} gem-ready square${n===1?'':'s'} for your rival in ${cells.length} blocks${n?'':' · nothing to build on'}. Fewer is a stronger blade.`;};
 for(const b of $$('[data-col]'))b.onclick=()=>{strike(STRIKES[armed],Number(b.dataset.col));read();render();};
 $('#pt-volley').onclick=()=>{for(let i=0;i<4;i++)strike(STRIKES[Math.floor(Math.random()*STRIKES.length)],Math.floor(Math.random()*W));read();render();};
 $('#pt-crack').onclick=()=>{for(let i=0;i<3;i++)decay(testBoard);read();render();};
 $('#pt-clear').onclick=()=>{testBoard=grid();testNote='';render();};
 drawBoard($('#pt-board'),{board:testBoard,active:null,phase:'entry',timer:0,motion:[],stats:{pieces:0}},{});
 $('#pattern-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>10000)throw Error('Choose a small pattern JSON file.');const p=JSON.parse(await f.text());if(!validatePattern(p.rows))throw Error('A pattern needs 3–6 rows of six colours (0–3).');if(!canLeave())return;choose({id:null,name:String(p.name??'Imported pattern').slice(0,32),rows:p.rows,iconId:PATTERNS.some(s=>s.id===p.iconId)?p.iconId:'custom'});render();notify('Imported. Save to add it to your library.');}catch(error){notify(error.message);}};
 }
 return {mount(element){host=element;if(!dirty()&&PATTERNS.some(p=>p.id===draft.id)){const current=getPatterns().find(p=>p.id===draft.id);if(current)choose(current);}render();},select,newPattern};
}
