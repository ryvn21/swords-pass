import {HANDLING_FIELDS,HOUSE_RULES,handlingRules,fallSummary} from './handling-profile.js';
import {actionFor,heldStep,pairKey} from './handling-profile.js';
import {createMatch,step,pairAt,previewIndex} from './engine.js';
import {drawBoard,drawNext} from './render.js';

// Timings the Default set leaves at 0 sit under "More options" at the bottom.
const EXTRA=['lockMs','entryMs','spawnGraceMs','dropBufferMs'];
const field=([key,label,min,max,step])=>`<label class="field-label">${label}<span class="range-row"><input data-speed-slider="${key}" type="range" aria-label="${label}" min="${min}" max="${max}" step="${step}"><input class="timing-number" data-speed-number="${key}" aria-label="${label} in milliseconds" type="number" min="${min}" max="${max}" step="1"><span>ms</span></span></label>`;
export function mountHandlingEditor(host,{prefs,onChange}){
 const $=q=>host.querySelector(q),scope=new AbortController();
 let game,raf,last=0,acc=0,actions=[],held=new Map();
 host.innerHTML=`<label class="timing-default"><input type="checkbox" id="use-default-timings"><span><strong>Default timings</strong><small>The standard timings, also used online. Untick to set your own; your own timings are kept for whenever you untick it again.</small></span></label><p class="muted">One handling profile for practice, duels and challenges. Changes apply straight away in duels and practice, and from the next run in other modes. Test them on the board below.</p><p class="fine-print">Lower numbers mean faster movement. Spawn adjustment is how long a new pair waits at the top, still movable, before it starts to fall. Early fast-fall window: press fast-fall this soon before the next pair appears and it drops straight away; holding through a landing never carries over.</p><div class="handling-editor"><div>${HANDLING_FIELDS.filter(([key])=>!EXTRA.includes(key)).map(field).join('')}<p id="fall-summary" class="fine-print"></p><details class="timing-more"><summary>More options</summary>${HANDLING_FIELDS.filter(([key])=>EXTRA.includes(key)).map(field).join('')}</details></div><div class="handling-preview"><div class="handling-stage"><div class="handling-head"><strong>Test board</strong><div class="next-piece"><span>NEXT</span><canvas id="handling-next" aria-label="Next pair"></canvas></div></div><canvas tabindex="0" id="handling-board" aria-label="Handling test board. Focus to use your movement, rotation and fast fall keys."></canvas></div><p class="fine-print">Click the board, then use your controls. Tap to rotate; hold your fast-fall key to descend faster.</p><button id="clear-handling-board">Clear test board</button></div></div>`;
 const reset=()=>{game=createMatch({mode:'practice',seed:410,rules:handlingRules(prefs.rules)});actions=[];held.clear();acc=0;};
 function refresh(){for(const [key] of HANDLING_FIELDS){$(`[data-speed-slider="${key}"]`).value=prefs.rules[key];$(`[data-speed-number="${key}"]`).value=prefs.rules[key];}$('#fall-summary').textContent=fallSummary(prefs.rules);}
 function update(rules){if(prefs.useDefaultTimings!==false)return;prefs.rules=handlingRules(rules);prefs.customRules={...prefs.rules};onChange();refresh();reset();}
 // Default timings ticked: sliders show the defaults and are locked. Unticked: your own scheme, remembered between switches.
 function lock(){const on=prefs.useDefaultTimings!==false;$('#use-default-timings').checked=on;host.querySelector('.handling-editor').classList.toggle('locked',on);for(const el of host.querySelectorAll('[data-speed-slider],[data-speed-number]'))el.disabled=on;}
 $('#use-default-timings').onchange=e=>{if(e.target.checked){if(prefs.useDefaultTimings===false)prefs.customRules={...prefs.rules};prefs.useDefaultTimings=true;prefs.rules={...HOUSE_RULES};}else{prefs.useDefaultTimings=false;prefs.rules=handlingRules({...(prefs.customRules??HOUSE_RULES),stallHold:undefined,stallSlow:undefined,topTuck:undefined,freeSlide:undefined,stallFlips:0,yppRotate:true,yppAttack:true,startVelocity:.03,lockCapMs:167,lockFloorMs:40});}onChange();lock();refresh();reset();};
 for(const el of host.querySelectorAll('[data-speed-slider]'))el.oninput=()=>update({...prefs.rules,[el.dataset.speedSlider]:Number(el.value)});
 for(const el of host.querySelectorAll('[data-speed-number]'))el.onchange=()=>{if(el.value!==''&&Number.isFinite(el.valueAsNumber))update({...prefs.rules,[el.dataset.speedNumber]:el.valueAsNumber});else refresh();};
 $('#clear-handling-board').onclick=reset;
 const canvas=$('#handling-board'),next=$('#handling-next');canvas.onclick=()=>canvas.focus();
 canvas.addEventListener('keydown',e=>{const action=actionFor(prefs.keys,e.code);if(!action||action==='pause')return;e.preventDefault();if(e.repeat)return;held.set(e.code,{action,next:game.elapsed+game.rules.repeatDelayMs,pair:pairKey(game.players[0])});actions.push({side:0,action:action==='drop'?'fastOn':action});},{signal:scope.signal});
 window.addEventListener('keyup',e=>{const h=held.get(e.code);held.delete(e.code);if(h?.action==='drop')actions.push({side:0,action:'fastOff'});},{signal:scope.signal});
 canvas.addEventListener('blur',()=>{held.clear();actions=[{side:0,action:'fastOff'}];},{signal:scope.signal});
 function frame(time){if(!host.isConnected)return;const visible=!host.hidden&&!document.hidden;acc+=visible?Math.min(100,time-(last||time)):0;last=time;
  if(visible){while(acc>=1000/60){for(const h of held.values()){if(heldStep(h,game.players[0],game.elapsed,game.rules))actions.push({side:0,action:h.action});if(game.version<10&&h.action==='drop'&&game.players[0].phase==='fall'&&!game.players[0].fast)actions.push({side:0,action:'fastOn'});}step(game,1000/60,actions);actions=[];acc-=1000/60;if(game.winner!==null)reset();}drawBoard(canvas,game.players[0],{time,gravityMs:game.rules.gravityMs,fastFallMs:game.rules.fastFallMs,renderAheadMs:acc,reduced:prefs.reduced});drawNext(next,pairAt(game.seed,previewIndex(game.players[0]),game.rules.breakerRate));}
  raf=requestAnimationFrame(frame);
 }
 reset();lock();refresh();raf=requestAnimationFrame(frame);return ()=>{scope.abort();cancelAnimationFrame(raf);};
}
