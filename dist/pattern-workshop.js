import {PATTERNS as BASE_PATTERNS,THEMED} from './swords.js';
const PATTERNS=[...BASE_PATTERNS,...THEMED];
import {savePattern,deletePattern,CATEGORIES,patternCategory} from './pattern-library.js';
import {validatePattern} from './engine.js';
import {COLORS,COLOR_NAMES} from './render.js';
import {swordIcon} from './sword-art.js';
// a small picture of the pattern itself, drawn with the game's own tiles
const thumb=rows=>`<span class="pattern-thumb" style="--cols:${rows[0]?.length||6}">${[...rows].reverse().map(r=>r.map(c=>`<i style="background-image:var(--tile-${c})"></i>`).join('')).join('')}</span>`;
const clone=x=>structuredClone(x),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createPatternWorkshop({getLibrary,getPatterns,persist,equip,selected,notify,download}){
 let host,draft,baseline,brush=0,undo=[],redo=[],deleted=null;
 const snapshot=()=>({id:draft.id,name:draft.name,rows:clone(draft.rows),iconId:draft.iconId});
 const dirty=()=>JSON.stringify(snapshot())!==baseline;
 const custom=()=>getLibrary().patterns.some(p=>p.id===draft.id);
 const remember=()=>{undo.push(snapshot());undo=undo.slice(-60);redo=[];};
 const choose=p=>{draft={id:p.id,name:p.name,rows:clone(p.rows),iconId:p.iconId??p.id};baseline=JSON.stringify(snapshot());undo=[];redo=[];};
 const canLeave=()=>!dirty()||confirm('Discard unsaved pattern changes?');
 const guard=fn=>{if(!dirty())return fn();const A=globalThis.scrapsAsk;if(A)A({eyebrow:'UNSAVED CHANGES',title:'Discard this pattern?',body:'Your edits since the last save will be lost.',yes:'Discard'}).then(ok=>{if(ok)fn();});else if(confirm('Discard unsaved pattern changes?'))fn();};
 function select(p){guard(()=>{choose(p);render();});}
 function newPattern(){const go=()=>{choose({id:null,name:'New pattern',rows:Array.from({length:4},()=>Array(6).fill(0)),iconId:'custom'});render();};if(draft)guard(go);else go();}
 choose(selected()??PATTERNS[1]);
 function render(){if(!host?.isConnected)return;
 const patterns=getPatterns(),isCustom=custom(),isBuiltin=PATTERNS.some(p=>p.id===draft.id),changed=dirty();
 host.innerHTML=`<div class="pattern-work-grid library-workshop"><aside class="panel pattern-library"><div class="library-heading"><p class="eyebrow">YOUR PATTERNS</p><span>${patterns.length}</span></div><button class="primary" id="new-pattern">+ New pattern</button>${CATEGORIES.map(cat=>{const list=patterns.filter(p=>patternCategory(p)===cat.id);return list.length?`<p class="pattern-cat">${esc(cat.name)} <span>${list.length}</span></p><div class="preset-rack">${list.map(p=>`<button class="pattern-preset ${p.id===draft.id?'selected':''}" data-preset="${esc(p.id)}" aria-pressed="${p.id===draft.id}">${thumb(p.rows)}<span><strong>${esc(p.name)}</strong><small>${p.id===selected()?.id?'Equipped':cat.id==='yours'?'Your pattern':cat.id==='drafts'?'Template':cat.name}</small></span></button>`).join('')}</div>`:'';}).join('')}<p class="fine-print">Saved on this browser. Export patterns to keep a backup.</p>${getLibrary().hidden.length?'<button class="text-button" id="restore-patterns">Restore built-in patterns</button>':''}${deleted?'<button class="text-button" id="undo-delete">Undo last deletion</button>':''}</aside>
 <section class="panel pattern-editor-panel"><div class="editor-heading">${thumb(draft.rows)}<div><p class="eyebrow">${isBuiltin?'EDIT A COPY':draft.id?'YOUR PATTERN':'NEW PATTERN'}</p><p id="pattern-status" role="status">${changed?'Unsaved changes':isBuiltin?'Save changes as a new pattern.':draft.id?'Saved in your library.':'Paint a pattern, then save it.'}</p></div></div>
 <label class="field-label">Pattern name<input id="pattern-name" maxlength="32" value="${esc(draft.name)}"></label><div class="pattern-meta"><label class="field-label">Icon<select id="pattern-icon">${[{id:'custom',name:'Custom'},...PATTERNS.filter(p=>p.id!=='custom')].map(p=>`<option value="${p.id}" ${draft.iconId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="field-label">Rows<select id="pattern-rows">${[3,4,5,6].map(n=>`<option ${n===draft.rows.length?'selected':''}>${n}</option>`).join('')}</select></label></div>
 <div class="pattern-palette" aria-label="Paint colour">${COLORS.map((c,i)=>`<button data-paint="${i}" style="--swatch:${c}" class="swatch ${i===brush?'selected':''}" aria-label="Paint ${COLOR_NAMES[i]}" aria-pressed="${i===brush}">${['◇','□','△','○'][i]}</button>`).join('')}<span>Painting ${COLOR_NAMES[brush].toLowerCase()}</span></div>
 <div class="pattern-editor">${[...draft.rows].reverse().map((row,i)=>row.map((c,x)=>`<button data-pattern="${x},${draft.rows.length-1-i}" style="background:${COLORS[c]}" aria-label="Pattern column ${x+1}, row ${draft.rows.length-i}, ${COLOR_NAMES[c]}">${['◇','□','△','○'][c]}</button>`).join('')).join('')}</div><div class="pattern-row-labels"><span>↑ Strike pattern</span><span>Bottom two rows = sprinkles</span></div>
 <div class="editor-tools"><button id="mirror-pattern">Mirror</button><button id="undo-pattern" ${undo.length?'':'disabled'}>Undo</button><button id="redo-pattern" ${redo.length?'':'disabled'}>Redo</button></div><div class="editor-actions"><button class="primary" id="save-pattern">${isCustom?'Save changes & equip':'Save new & equip'}</button><button id="equip-pattern" ${!draft.id||changed?'disabled':''}>Equip</button></div><div class="editor-tools"><button id="duplicate-pattern">Duplicate</button><button class="danger" id="delete-pattern" ${!draft.id?'disabled':''}>Delete pattern</button></div><details class="rogue-more pattern-more"><summary>More</summary><div class="rogue-more-menu"><button id="export-pattern">Export patterns</button><button id="import-pattern">Import patterns</button></div></details><input id="pattern-file" type="file" accept=".json,application/json" hidden></section>
 <aside class="field-notes pattern-explainer"><p class="eyebrow">HOW PATTERNS WORK</p><h2>Shape what you send.</h2><p class="muted">Paint the grid with the colours your rival receives. The bottom two rows are sprinkles.</p></aside></div>`;
 const $=s=>host.querySelector(s),$$=s=>[...host.querySelectorAll(s)];
 $('#new-pattern').onclick=newPattern;
 for(const b of $$('[data-preset]'))b.onclick=()=>select(patterns.find(p=>p.id===b.dataset.preset));
 $('#pattern-name').oninput=e=>{draft.name=e.target.value;$('#pattern-status').textContent=dirty()?'Unsaved changes':'Saved in your library.';$('#equip-pattern').disabled=dirty()||!draft.id;};
 $('#pattern-icon').onchange=e=>{remember();draft.iconId=e.target.value;render();};
 for(const b of $$('[data-paint]'))b.onclick=()=>{brush=Number(b.dataset.paint);render();};
 for(const b of $$('[data-pattern]'))b.onclick=()=>{const [x,y]=b.dataset.pattern.split(',').map(Number);if(draft.rows[y][x]!==brush){remember();draft.rows[y][x]=brush;render();}};
 $('#pattern-rows').onchange=e=>{remember();const n=Number(e.target.value);while(draft.rows.length<n)draft.rows.push(Array(6).fill(brush));draft.rows=draft.rows.slice(0,n);render();};
 $('#mirror-pattern').onclick=()=>{remember();draft.rows=draft.rows.map(row=>[...row].reverse());render();};
 $('#undo-pattern').onclick=()=>{if(undo.length){redo.push(snapshot());draft=undo.pop();render();}};
 $('#redo-pattern').onclick=()=>{if(redo.length){undo.push(snapshot());draft=redo.pop();render();}};
 $('#save-pattern').onclick=()=>{try{const p={...snapshot(),id:isCustom?draft.id:'custom-'+crypto.randomUUID()};const next=savePattern(getLibrary(),p);if(persist(next)){equip(p.id);choose(next.patterns.find(item=>item.id===p.id));render();notify('Pattern saved and equipped.');}}catch(error){notify(error.message);}};
 $('#equip-pattern').onclick=()=>{equip(draft.id);render();notify('Pattern equipped.');};
 $('#duplicate-pattern').onclick=()=>{draft={...snapshot(),id:null,name:(draft.name+' copy').slice(0,32)};baseline='';undo=[];redo=[];render();};
 $('#delete-pattern').onclick=()=>{if(patterns.length<=1){notify('Add another pattern before deleting the last one.');return;}const previous=getLibrary(),removed={id:draft.id,pattern:clone(previous.patterns.find(p=>p.id===draft.id)??null),index:previous.patterns.findIndex(p=>p.id===draft.id)},next=deletePattern(previous,draft.id);if(persist(next)){deleted=removed;choose(getPatterns().find(p=>p.id===selected()?.id)??getPatterns()[0]);render();notify('Pattern deleted. You can undo this in the library.');}};
 $('#undo-delete')?.addEventListener('click',()=>{const next=clone(getLibrary());if(deleted.pattern){if(!next.patterns.some(p=>p.id===deleted.id))next.patterns.splice(Math.max(0,deleted.index),0,deleted.pattern);}else next.hidden=next.hidden.filter(id=>id!==deleted.id);if(persist(next)){deleted=null;render();}});
 $('#restore-patterns')?.addEventListener('click',()=>{if(persist({...getLibrary(),hidden:[]}))render();});
 $('#export-pattern').onclick=()=>download({name:draft.name,rows:draft.rows,iconId:draft.iconId},'swords-pass-pattern.json');
 $('#import-pattern').onclick=()=>$('#pattern-file').click();
 $('#pattern-file').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>10000)throw Error('Choose a small pattern JSON file.');const p=JSON.parse(await f.text());if(!validatePattern(p.rows))throw Error('A pattern needs 3–6 rows of six colours (0–3).');if(!canLeave())return;choose({id:null,name:String(p.name??'Imported pattern').slice(0,32),rows:p.rows,iconId:PATTERNS.some(s=>s.id===p.iconId)?p.iconId:'custom'});render();notify('Imported. Save to add it to your library.');}catch(error){notify(error.message);}};
 }
 return {mount(element){host=element;if(!dirty()&&PATTERNS.some(p=>p.id===draft.id)){const current=getPatterns().find(p=>p.id===draft.id);if(current)choose(current);}render();},select,newPattern};
}
