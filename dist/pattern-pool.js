import {random,clone} from './engine.js';
import {equippedSword} from './swords.js';
export const DEFAULT_POOL=['falchion'];
export function poolPatterns(ids,catalogue){const selected=catalogue.filter(p=>(Array.isArray(ids)?ids:DEFAULT_POOL).includes(p.id));return selected.length?selected:[equippedSword('falchion')];}
export function assignPatterns(seed,count,pool){const candidates=pool?.length?pool:[equippedSword('falchion')],rng=random(seed^0x71c59e);return Array.from({length:count},()=>clone(candidates[Math.floor(rng()*candidates.length)]));}
export function mountPatternPool(host,{catalogue,ids,onChange}){
 let selected=new Set(poolPatterns(ids,catalogue).map(p=>p.id));const all=catalogue.some(p=>p.id==='falchion')?catalogue:[equippedSword('falchion'),...catalogue];
 host.innerHTML='<p class="eyebrow">PATTERN POOL</p><h2>Which swords can be dealt?</h2><p class="muted">Every player gets a random pattern from this pool at the start of each game. Repeats are allowed. Solo hazard patterns also use this pool.</p><div class="pool-options"></div><p class="fine-print" id="pool-status" role="status"></p>';
 for(const p of all){const label=document.createElement('label');label.className='pool-choice';const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(p.id);input.dataset.poolId=p.id;const name=document.createElement('span');name.textContent=p.name;label.append(input,name);host.querySelector('.pool-options').append(label);
  input.onchange=()=>{if(!input.checked&&selected.size===1){input.checked=true;host.querySelector('#pool-status').textContent='Keep at least one pattern enabled.';return;}input.checked?selected.add(p.id):selected.delete(p.id);host.querySelector('#pool-status').textContent=selected.size+' patterns enabled for the next game.';onChange([...selected]);};
 }
}
