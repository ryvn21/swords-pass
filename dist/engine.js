import * as legacy9 from './legacy-engine-v9.js';
import * as legacy10 from './legacy-engine-v10.js';
/** Scraps combat model. Coordinates are zero based, y=0 at the floor.
 * Pure deterministic simulation: browser rendering, audio and AI live elsewhere.
 */
export const W=6,H=13,VERSION=11;
export const DEFAULT_RULES=Object.freeze({gravityMs:800,fastFallMs:200,lockMs:350,clearMs:180,waveMs:85,settleMs:50,attackMs:320,entryMs:60,spawnGraceMs:250,breakerRate:.25,repeatDelayMs:145,repeatMs:65});
export const STALL_FLIPS=3; // new games opt in via rules.stallFlips; saved rules without it keep the old behaviour
import {PATTERNS} from './swords.js';
export {PATTERNS} from './swords.js';
export const clone=x=>structuredClone(x);
export const grid=()=>Array.from({length:H},()=>Array(W).fill(null));
export const block=(color,breaker=false)=>({color,breaker,stage:0,gem:0,strike:0});
export function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function pairAt(seed,index,rate=DEFAULT_RULES.breakerRate){const r=random((seed+Math.imul(index+1,0x9e3779b9))>>>0);return [block(Math.floor(r()*4),r()<rate),block(Math.floor(r()*4),r()<rate)];}
const dirs=[[0,1],[1,0],[0,-1],[-1,0]];
export function cells(piece){const [dx,dy]=dirs[piece.r];return [{x:piece.x,y:piece.y,cell:piece.pair[0]},{x:piece.x+dx,y:piece.y+dy,cell:piece.pair[1]}];}
// A pair needs a cell on the board, except while it is still entering from above (v11): then it may sit up to
// two rows over the top. Once any part of it is on the board it can never climb back out.
export function fits(board,piece){const occupied=cells(piece);return (piece.entering||occupied.some(({y})=>y<H))&&occupied.every(({x,y})=>x>=0&&x<W&&y>=0&&y<=H+1&&(y>=H?!board[H-1][x]:!board[y][x]));}
// (v11) a column filled to the top is a wall above the board too: nothing passes over it or lands on it until it clears
const entered=p=>{if(p.active?.entering&&cells(p.active).some(({y})=>y<H))delete p.active.entering;};
export function move(board,piece,dx,dy){const next={...piece,x:piece.x+dx,y:piece.y+dy};return fits(board,next)?next:null;}
export function rotate(board,piece,direction,wellFlip=false){
 const next={...piece,r:(piece.r+direction+4)%4};
 // wellFlip (new games): a vertical pair hemmed in on both sides turns over in place
 // instead of being kicked up and out of its well.
 for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1]]){if(wellFlip&&dy&&piece.r%2===0){const flip={...piece,y:piece.y+dirs[piece.r][1],r:(piece.r+2)%4};if(fits(board,flip))return flip;}const p={...next,x:next.x+dx,y:next.y+dy};if(fits(board,p))return p;}
 // A trapped vertical pair flips within its two occupied cells. Move the
 // pivot to the partner's cell so neither block disappears or gains height.
 if(piece.r%2===0){const flip={...piece,y:piece.y+dirs[piece.r][1],r:(piece.r+2)%4};if(fits(board,flip))return flip;}
 return null;
}
// rules.kickLimit (with landOnce): a flip that doesn't fit is nudged one column sideways if that fits; an upright pair can also be popped up one row, at most kickLimit times per pair. Past that, the flip
// still happens without a kick: an upright pair swaps its colours in place, a flat one turns the other way if that fits.
export function rotateLimited(board,piece,direction,wellFlip,popsLeft){
 const next={...piece,r:(piece.r+direction+4)%4},swap={...piece,y:piece.y+dirs[piece.r][1],r:(piece.r+2)%4};
 if(fits(board,next))return {piece:next,popped:false};
 for(const dx of [1,-1]){const q={...next,x:next.x+dx};if(fits(board,q))return {piece:q,popped:false};}   // one column either way, never through a wall
 if(piece.r%2===0&&popsLeft>0){const q={...next,y:next.y+1};if(fits(board,q))return {piece:q,popped:true};}
 if(piece.r%2===0&&fits(board,swap))return {piece:swap,popped:false};
 const other={...piece,r:(piece.r-direction+4)%4};if(fits(board,other))return {piece:other,popped:false};
 return null;
}
// The NEXT box shows the pair after the one in play, from the moment that one appears. The only exception is the
// game's very first pair: while it is still wholly above the board the box shows it, so you see it before it drops in.
export const previewIndex=p=>p?.active&&p.nextIndex===1&&cells(p.active).every(c=>c.y>=H)?0:(p?.nextIndex??0);
export function landing(board,piece){let p=clone(piece),n;while((n=move(board,p,0,-1)))p=n;return p;}
export function gemRects(board){const map=new Map();for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=board[y][x];if(!c?.gem)continue;let g=map.get(c.gem);if(!g){g={id:c.gem,x,y,w:1,h:1,color:c.color};map.set(c.gem,g);}g.w=Math.max(g.w,x-g.x+1);g.h=Math.max(g.h,y-g.y+1);}return [...map.values()];}
// Existing fused rectangles are indivisible. Expand/merge only if the new
// rectangle contains every cell of each intersected old gem.
export function fuse(board){let nextId=Math.max(0,...board.flat().map(c=>c?.gem||0))+1;let changed=true;
 while(changed){changed=false;const old=gemRects(board),candidates=[];
 for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){const c=board[y][x];if(!c||c.breaker||c.stage)continue;
 for(let h=2;y+h<=H;h++)for(let w=2;x+w<=W;w++){
 let good=true;for(let yy=y;yy<y+h&&good;yy++)for(let xx=x;xx<x+w;xx++){const v=board[yy][xx];if(!v||v.breaker||v.stage||v.color!==c.color){good=false;break;}}
 if(!good)continue;
 const overlaps=old.filter(g=>g.x<x+w&&g.x+g.w>x&&g.y<y+h&&g.y+g.h>y);
 if(overlaps.some(g=>g.x<x||g.x+g.w>x+w||g.y<y||g.y+g.h>y+h))continue;
 if(overlaps.length===1&&overlaps[0].x===x&&overlaps[0].y===y&&overlaps[0].w===w&&overlaps[0].h===h)continue;
 candidates.push({x,y,w,h,area:w*h});}}
 candidates.sort((a,b)=>b.area-a.area||a.y-b.y||a.x-b.x||b.h-a.h);
 if(candidates.length){const g=candidates[0];for(let y=g.y;y<g.y+g.h;y++)for(let x=g.x;x<g.x+g.w;x++)board[y][x].gem=nextId;nextId++;changed=true;}
 }return board;
}
export function gravity(board,passes=H){let any=false;for(let pass=0;pass<passes;pass++){let changed=false;const moved=new Set();for(let y=1;y<H;y++)for(let x=0;x<W;x++){const c=board[y][x];if(!c||c.stage===3)continue;
 if(c.gem){if(moved.has(c.gem))continue;moved.add(c.gem);const g=gemRects(board).find(g=>g.id===c.gem);if(!g||g.y===0)continue;if(Array.from({length:g.w},(_,i)=>board[g.y-1][g.x+i]).some(Boolean))continue;for(let yy=g.y;yy<g.y+g.h;yy++)for(let xx=g.x;xx<g.x+g.w;xx++){board[yy-1][xx]=board[yy][xx];board[yy][xx]=null;}changed=true;
 }else if(!board[y-1][x]){board[y-1][x]=c;board[y][x]=null;changed=true;}}
 any||=changed;if(!changed)break;}return any;
}
export function clearGroups(board){const seen=new Set(),groups=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=board[y][x],key=y*W+x;if(!c||c.stage||seen.has(key))continue;const group=[],todo=[[x,y]];let breaker=false;seen.add(key);while(todo.length){const [xx,yy]=todo.pop(),v=board[yy][xx];group.push({x:xx,y:yy,cell:v});breaker||=v.breaker;for(const [dx,dy] of dirs){const nx=xx+dx,ny=yy+dy,k=ny*W+nx,n=board[ny]?.[nx];if(nx>=0&&nx<W&&ny>=0&&ny<H&&n&&!n.stage&&n.color===c.color&&!seen.has(k)){seen.add(k);todo.push([nx,ny]);}}}if(breaker&&group.length>1)groups.push(group);}return groups;}
export function swordFromGem(w,h,chain=1){if(w>h)w*=chain;else h*=chain;if(w===2&&h===2)return{kind:'vertical',width:1,length:4};if(w===3&&h===3)return{kind:'vertical',width:2,length:4};if(h>=w)return{kind:'vertical',width:Math.min(3,w),length:h+Math.max(0,w-3)};return{kind:'horizontal',width:Math.min(3,h),length:w+Math.max(0,h-3)};}
export function shatter(board,groups,chain){const rects=gemRects(board),swords=[],cleared=[];let sprinkles=0;for(const group of groups){const ids=new Set();let loose=0;for(const p of group){if(p.cell.gem)ids.add(p.cell.gem);else loose++;cleared.push({...p,cell:clone(p.cell)});}sprinkles+=Math.floor(loose/2)*chain;for(const g of rects.filter(g=>ids.has(g.id)).sort((a,b)=>a.y-b.y||a.x-b.x))swords.push(swordFromGem(g.w,g.h,chain));}for(const {x,y} of cleared)board[y][x]=null;return{swords,sprinkles,cleared,chain};}
export function resolve(board){const results=[];gravity(board);fuse(board);for(let chain=1;chain<=H*W;chain++){const groups=clearGroups(board);if(!groups.length)break;results.push(shatter(board,groups,chain));gravity(board);fuse(board);}return results;}
export function decay(board,settle=true){for(const row of board)for(const c of row)if(c?.stage){c.stage--;if(c.stage<3)c.strike=0;}if(settle){gravity(board);fuse(board);}}
export function patternColor(rows,x,offset){const n=rows.length,repeat=Math.min(n,4),row=offset<n?offset:n-repeat+(offset-n)%repeat;return rows[row][x];}
export const penetrationDepth=(length,width=1)=>width===1?1:Math.min(4,1+Math.ceil(length/4));
const obstacle=c=>!!(c&&(c.gem||c.stage===3));
export function searchOrder(start,max,hand){const result=[start];for(let x=start+hand;x>=0&&x<=max;x+=hand)result.push(x);for(let x=start-hand;x>=0&&x<=max;x-=hand)result.push(x);return result;}
export function verticalPlacement(board,attack){const w=attack.width,max=W-w,start=(attack.index+1)%(max+1),order=searchOrder(start,max,attack.hand);const candidates=[];
 for(const x of order){let floor=0,contact=0,blocked=false;for(let dx=0;dx<w;dx++){for(let y=H-1;y>=0;y--){const c=board[y][x+dx];if(c)contact=Math.max(contact,y+1);if(c?.stage===3&&c.axis!=='horizontal'){blocked=true;break;}if(c?.gem||c?.stage===3){floor=Math.max(floor,y+1);break;}}}floor=Math.max(floor,contact-penetrationDepth(attack.length,w));if(blocked||floor>=H)continue;candidates.push({x,y:floor,w,h:Math.min(attack.length,H-floor),protected:x<=3&&x+w>3});}
 const safe=candidates.filter(c=>!c.protected),pool=safe.length?safe:candidates;if(!pool.length)return null;return pool.find(c=>c.h===attack.length)||pool.reduce((a,b)=>b.h>a.h?b:a);
}
export function horizontalBase(board,width){const rects=gemRects(board);const strikes=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]?.stage===3)strikes.push(y+1);if(rects.length||strikes.length){const lowest=Math.min(...rects.map(g=>g.y+1),...strikes);return Math.max(0,lowest-width-3);}let height=0;for(let y=0;y<H;y++)if(board[y].some(Boolean))height=y+1;if(height===13)return 0;return Math.max(0,height-width-2);}
export function horizontalPlacement(board,attack){const w=attack.width,base=Math.min(H-w-1,attack.base??horizontalBase(board,w)),ys=[base];for(let y=base-1;y>=0;y--)ys.push(y);for(let y=base+1;y<=H-w-1;y++)ys.push(y);
 for(const y of ys)for(const hand of [attack.hand,-attack.hand]){let length=0;for(let i=0;i<Math.min(W,attack.length);i++){const x=hand===1?W-1-i:i;if(Array.from({length:w},(_,j)=>board[y+j]?.[x]).some(obstacle))break;length++;}if(length>attack.length/2)return {x:hand===1?W-length:0,y,w:length,h:w,hand};}return null;
}
// Displacement policy is isolated for reference calibration.
function insertVertical(board,placement,attack,pattern){const {x,y,w,h}=placement;for(let dx=0;dx<w;dx++)for(let i=0;i<h;i++)board[y+i][x+dx]={...block(patternColor(pattern,x+dx,i)),stage:3,strike:attack.id,axis:'vertical'};}
function insertHorizontal(board,placement,attack,pattern){const {x,y,w,h,hand}=placement;for(let dy=0;dy<h;dy++)for(let xx=x;xx<x+w;xx++){const depth=hand===1?W-1-xx:xx,col=hand===1?W-1-(h-1-dy):h-1-dy;board[y+dy][xx]={...block(patternColor(pattern,col,depth)),stage:3,strike:attack.id,axis:'horizontal',hand};}}export function applyAttack(board,attack,pattern){if(attack.kind==='sprinkle'){const placed=[];for(let i=0;i<attack.count;i++){const x=attack.hand===1?W-1-i%W:i%W;let y=H-1;while(y>=0&&!board[y][x])y--;y++;if(y>=H||(x===3&&y>=10))continue;board[y][x]={...block(pattern[Math.floor(i/W)%2][x]),stage:2};placed.push({x,y});}return{...attack,placed};}
 let placement;if(attack.kind==='horizontal')placement=horizontalPlacement(board,attack);if(placement)insertHorizontal(board,placement,attack,pattern);else{placement=verticalPlacement(board,attack);if(placement)insertVertical(board,placement,attack,pattern);}return{...attack,placement,converted:attack.kind==='horizontal'&&!placement?.hand};}
// Reserve one sword from each combo stage, then admit extras only when the
// complete resulting attack leaves the spawn cell open. Trials preserve order.
export function applyAttackBatch(board,attacks){
 const seen=new Set(),chosen=new Set(),extras=[];
 attacks.forEach((a,i)=>{if(a.kind==='sprinkle'){chosen.add(i);return;}const stage=a.stage??1;if(seen.has(stage))extras.push(i);else{seen.add(stage);chosen.add(i);}});
 const trial=indices=>{const b=clone(board),hits=[];attacks.forEach((a,i)=>{if(indices.has(i))hits.push(applyAttack(b,a,a.pattern));});return {board:b,hits};};
 for(const i of extras){const candidate=new Set([...chosen,i]);if(!trial(candidate).board[H-1][3])chosen.add(i);}
 const result=trial(chosen);for(let y=0;y<H;y++)board[y]=result.board[y];
 return {hits:result.hits,discarded:attacks.filter((_,i)=>!chosen.has(i))};
}
// Online play: each client simulates only its own board (side 0). Side 1 is the remote
// player, drawn from network snapshots. Outgoing batches collect in players[1].incoming
// for the network layer to send; batches from the remote player arrive here.
export function receiveBatch(state,side,attacks,sourceTurn=0){
 const p=state.players[side];if(!p||p.dead||state.winner!==null||!Array.isArray(attacks)||!attacks.length)return false;
 const list=attacks.map(a=>{const x={...clone(a),id:state.nextAttackId++};if(x.kind==='horizontal')x.base=horizontalBase(p.board,x.width);return x;});
 p.incoming.push({kind:'batch',id:state.nextAttackId++,sourceTurn,due:p.turn+1,attacks:list});return true;
}
export function createPlayer(seed,rules,pattern){return {...speedStart(rules),board:grid(),active:null,nextIndex:0,turn:0,phase:'entry',timer:0,fall:0,lock:0,fast:false,chain:0,incoming:[],pendingAttack:[],pattern:clone(pattern),stats:{pieces:0,cleared:0,swords:0,sprinkles:0,bestChain:0},dead:false};}
export function createMatch(options={}){if(options.engineVersion===9)return legacy9.createMatch(options);if(options.engineVersion===10)return legacy10.createMatch(options);if(options.engineVersion!==undefined&&options.engineVersion!==VERSION)throw Error('Unsupported engine version.');const rules={...DEFAULT_RULES,...options.rules},seed=options.seed??1;const state={version:VERSION,seed,rules,mode:options.mode??'duel',tick:0,elapsed:0,swordIndex:0,sprinkleIndex:0,nextAttackId:1,players:[createPlayer(seed,rules,options.pattern??PATTERNS[0].rows),createPlayer(seed,rules,options.opponentPattern??PATTERNS[1].rows)],winner:null,events:[]};for(const p of state.players)spawn(state,p);return state;}
// v11: a new pair enters one row above the board (its first cell hidden) and falls into view, so it starts
// a row higher without the board growing. You still top out when column 4's top cell is filled.
// Speed-ups (rules.speedUp): the fall starts at 40 ÷ gravityMs px/ms and, each time the blocks you've landed reach
// lastCount + dropFreq, rises by 1/300 px/ms (capped at 0.25); dropFreq starts at 10 and becomes trunc(dropFreq + 3.33),
// so the gaps run 10, 13, 16, 19, 22 … blocks. A row takes 40 ÷ speed ms; the landing lock shrinks in step (lockMs × start ÷ speed).
function speedStart(rules){return rules?.speedUp?{velocity:40/rules.gravityMs,blocksSeen:0,lastCount:0,dropFreq:10}:{};}
const gravOf=(state,p)=>state.rules.speedUp&&p.velocity?40/p.velocity:state.rules.gravityMs;
const lockOf=(state,p)=>state.rules.speedUp&&p.velocity?state.rules.lockMs*(40/state.rules.gravityMs)/p.velocity:state.rules.lockMs;
function landedBlocks(state,p,n){if(!state.rules.speedUp||!p.velocity)return;for(let i=0;i<n;i++){p.blocksSeen++;if(p.blocksSeen>=p.lastCount+p.dropFreq){p.velocity=Math.min(.25,p.velocity+1/300);p.dropFreq=Math.trunc(p.dropFreq+3.33);p.lastCount=p.blocksSeen;}}}
// rules.landOnce, the landing window: when the pair first rests on something it "bounces" and stops falling; a window
// of lockMs × start speed ÷ speed (5 ÷ speed ms on the Default timings) starts once and is never extended. Moves and
// flips are still allowed. When it ends, a pair still resting locks; one slid off a ledge carries on falling. Resting
// again on the same row locks at once; a lower row starts a fresh window. Fast drop only gets you to the touch sooner.
function bounceStep(state,side,p,dt,hooks){
 if(p.bouncing){p.lock+=dt;if(p.lock<lockOf(state,p))return;if(!move(p.board,p.active,0,-1)){lockPair(state,side,hooks);return;}p.bouncing=false;p.lock=0;p.fall=0;p.rowRate=1;return;}
 const speed=p.fast?state.rules.fastFallMs:gravOf(state,p);p.fall+=dt*(p.fast?1:p.rowRate??1);
 while(p.fall>=speed){const next=move(p.board,p.active,0,-1);if(!next)break;p.fall-=speed;p.active=next;entered(p);p.rowRate=1;}
 if(!move(p.board,p.active,0,-1)){p.fall=0;const y=Math.min(...cells(p.active).map(c=>c.y));if(p.touchRow===y){lockPair(state,side,hooks);return;}p.touchRow=y;p.bouncing=true;p.lock=0;}
}
export function spawn(state,p){if(state.version===9)return legacy9.spawn(state,p);if(state.version===10)return legacy10.spawn(state,p);if(p.board[H-1][3]){p.dead=true;p.active=null;return;}p.active={x:3,y:H,r:0,entering:true,pair:pairAt(state.seed,p.nextIndex++,state.rules.breakerRate)};p.phase='fall';p.spawnGrace=state.rules.spawnGraceMs;p.fall=0;p.lock=0;p.lockResets=0;p.kicks=0;p.touchRow=null;p.bouncing=false;p.rowRate=1;p.fast=false;p.chain=0;if(state.rules.stallFlips){p.stalls=0;p.lastFlip=0;}if(p.fastBuffered!=null){const early=state.elapsed-p.fastBuffered;p.fastBuffered=null;if(early<=state.rules.dropBufferMs){p.fast=true;p.spawnGrace=0;}}if(p.fastAfterAttack){p.fast=true;p.spawnGrace=0;}p.fastAfterAttack=false;p.underAttack=false;const buffered=p.bufferedRotation;p.bufferedRotation=0;if(buffered)p.active=rotate(p.board,p.active,buffered)??p.active;}
export function command(state,side,action){
 if(state.version===9)return legacy9.command(state,side,action);
 if(state.version===10)return legacy10.command(state,side,action);
 const p=state.players[side];if(p.dead||state.winner!==null)return false;
 if(action==='fastOn'||action==='fastOff'){
  const fast=action==='fastOn';
  // fastOn is a fresh press. A press before a pair exists never arms the next one, unless the
  // rules give an early-press window (dropBufferMs): a fresh press that close to the spawn counts.
  if(!fast){p.fastBuffered=null;p.fastAfterAttack=false;}   // a press during an attack only carries over while it's still held
  // a press while an attack is landing on you (or settling after it) drops the next pair at once if you're still holding it
  if(fast){if(p.phase!=='fall'||!p.active){if(p.underAttack&&state.rules.dropBufferMs>0)p.fastAfterAttack=true;if(state.rules.dropBufferMs>0)p.fastBuffered=state.elapsed;return false;}p.spawnGrace=0;}
  if(fast!==p.fast){
   const oldSpeed=p.fast?state.rules.fastFallMs:gravOf(state,p);
   const newSpeed=fast?state.rules.fastFallMs:gravOf(state,p);
   // Preserve progress within the current row; old slow-fall time is not a drop budget.
   p.fall=Math.min(1,p.fall/oldSpeed)*newSpeed;p.fast=fast;
  }
  return true;
 }
 if(p.phase==='entry'&&(action==='cw'||action==='ccw')){p.bufferedRotation=action==='cw'?1:-1;return true;}
 if(p.phase!=='fall'||!p.active)return false;
 let next;
 if(action==='left')next=move(p.board,p.active,-1,0);
 if(action==='right')next=move(p.board,p.active,1,0);
 // landOnce: past the halfway point of a row, a sideways move also needs the row below clear (no squeezing under overhangs)
 if(next&&state.rules.landOnce&&(action==='left'||action==='right')&&!p.bouncing&&p.fall>(p.fast?state.rules.fastFallMs:gravOf(state,p))/2&&!fits(p.board,{...next,y:next.y-1}))next=null;
 if((action==='ccw'||action==='cw')&&state.rules.kickLimit!=null){const r=rotateLimited(p.board,p.active,action==='cw'?1:-1,state.rules.wellFlip===true,state.rules.kickLimit-(p.kicks??0));if(r){next=r.piece;if(r.popped)p.kicks=(p.kicks??0)+1;}}
 else if(action==='ccw')next=rotate(p.board,p.active,-1,state.rules.wellFlip===true);
 else if(action==='cw')next=rotate(p.board,p.active,1,state.rules.wellFlip===true);
 if(!next)return false;
 if((p.lockResets??0)>=6&&Math.min(...cells(next).map(c=>c.y))>Math.min(...cells(p.active).map(c=>c.y)))return false;
 p.active=next;entered(p);
 // Stall: two flips in the same direction reset the fall and lock timers, up to rules.stallFlips times per pair.
 // rules.stallHold: the pair holds still for the time it had already spent in its row (same delay as a reset, but it
 // never jumps back up the board while you watch). rules.stallSlow (current): the pair keeps falling, the rest of its row
 // stretched to take up to a full row's time, but never slower than half speed. It never stops, floats or rises.
 // Absent from older saved rules, so earlier replays and saves play back unchanged.
 if(state.rules.stallFlips){if(action==='cw'||action==='ccw'){const d=action==='cw'?1:-1;if(p.lastFlip===d){p.lastFlip=0;if((p.stalls??0)<state.rules.stallFlips&&!(state.rules.landOnce&&p.bouncing)){p.stalls=(p.stalls??0)+1;if(state.rules.stallSlow){if(!p.fast){const r=1-p.fall/gravOf(state,p);p.rowRate=Math.min(p.rowRate??1,Math.max(.5,r));}}else if(state.rules.stallHold)p.spawnGrace=p.fall;else p.fall=0;if(!state.rules.landOnce)p.lock=0;}}else p.lastFlip=d;}else p.lastFlip=0;}
 if(state.rules.landOnce)return true;   // moves and flips never extend the landing window
 // Allow a grounded tuck without indefinite rotation stalling.
 if(p.lock>0&&(p.lockResets??0)<6){p.lock=0;p.lockResets=(p.lockResets??0)+1;}
 return true;
}
function emitAttack(state,side,result){const from=state.players[side],to=state.players[1-side];from.stats.cleared+=result.cleared.length;from.stats.swords+=result.swords.length;from.stats.sprinkles+=result.sprinkles;from.stats.bestChain=Math.max(from.stats.bestChain,result.chain);state.events.push({type:'clear',side,...result});if(state.mode==='practice')return;
 for(const s of result.swords){const a={...s,stage:result.chain,index:state.swordIndex,hand:state.swordIndex%2===0?1:-1,id:state.nextAttackId++,pattern:clone(from.pattern)};state.swordIndex++;if(a.kind==='horizontal')a.base=horizontalBase(to.board,a.width);from.pendingAttack.push(a);}
 from.pendingSprinkles=(from.pendingSprinkles||0)+result.sprinkles;
}

// A shortest path through same-colour neighbours. A fused gem is one node:
// every cell in it starts breaking together, without a wave crossing its interior.
export function clearWave(groups,interval){
 const result=[];
 for(const group of groups){
  const remaining=new Set(group),distance=new Map(group.map(c=>[c,c.cell.breaker?0:Infinity]));
  while(remaining.size){
   const at=[...remaining].reduce((a,b)=>distance.get(a)<=distance.get(b)?a:b);remaining.delete(at);
   const cost=distance.get(at);
   for(const next of remaining){const sameGem=at.cell.gem&&at.cell.gem===next.cell.gem;
    if(sameGem||Math.abs(at.x-next.x)+Math.abs(at.y-next.y)===1)
     distance.set(next,Math.min(distance.get(next),cost+(sameGem?0:interval)));
   }
  }
  for(const c of group)result.push({...c,cell:clone(c.cell),delay:distance.get(c)});
 }
 return result;
}
function settlePlayer(state,side,hooks){
 const p=state.players[side],before=new Map();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(p.board[y][x])before.set(p.board[y][x],{x,y});
 p.motion=[];
 if(gravity(p.board,1)){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=p.board[y][x],from=before.get(c);if(from&&from.y!==y)p.motion.push({x,y,fromY:from.y});}
  p.timer=Math.max(1,state.rules.settleMs);p.motionDuration=p.timer;return;
 }
 beginResolution(state,side,hooks);
}
function beginSettle(state,side,hooks){const p=state.players[side];p.phase='settle';p.timer=Math.max(1,state.rules.settleMs);p.motion=[];if(!gravity(clone(p.board),1))beginResolution(state,side,hooks);}
function enterAttack(state,side,hooks){
 const p=state.players[side],attack=p.readyAttacks.shift();
 if(!attack){p.attackVisual=null;beginSettle(state,side,hooks);return;}
 const before=clone(p.board),result=applyAttackBatch(p.board,attack.attacks??[attack]);
 p.underAttack=true;p.phase='attack';p.timer=Math.max(1,state.rules.attackMs);p.attackVisual={before,...result,batchId:attack.id,duration:p.timer};
 
}
function beginResolution(state,side,hooks){
 const p=state.players[side];p.motion=[];fuse(p.board);const groups=clearGroups(p.board);
 if(groups.length){
  p.chain++;p.phase='clear';p.wave=clearWave(groups,state.rules.waveMs);
  p.clearCellMs=state.rules.clearMs;
  p.clearDuration=Math.max(...p.wave.map(c=>c.delay))+state.rules.clearMs;
  p.timer=p.clearDuration;p.clearing=groups.map(g=>g.map(({x,y})=>({x,y})));
  // Snapshot the result before progressively removing cells from the live board.
  p.pendingClear=shatter(clone(p.board),groups,p.chain);
  state.events.push({type:'breaking',side,...p.pendingClear});return;
 }
 if(p.pendingSprinkles&&state.mode!=='practice'){
  p.pendingAttack.push({kind:'sprinkle',count:p.pendingSprinkles,hand:state.sprinkleIndex%2===0?1:-1,id:state.nextAttackId++,pattern:clone(p.pattern)});state.sprinkleIndex++;
 }
 if(p.pendingAttack.length){const to=state.players[1-side];to.incoming.push({kind:'batch',id:state.nextAttackId++,sourceTurn:p.turn,due:to.turn+1,attacks:hooks.outgoing?hooks.outgoing(state,side,p.pendingAttack):p.pendingAttack});p.pendingAttack=[];}
 p.pendingSprinkles=0;p.chain=0;
 if(p.readyAttacks?.length){enterAttack(state,side,hooks);return;}
 p.phase='entry';p.timer=state.rules.entryMs;
}
function lockPair(state,side,hooks){

 const p=state.players[side];for(const {x,y,cell} of cells(p.active)){if(y<H)p.board[y][x]=clone(cell);}
 p.active=null;p.fast=false;p.turn++;p.stats.pieces++;landedBlocks(state,p,2);state.events.push({type:'lock',side});
 decay(p.board,false);
 p.readyAttacks=[];if(p.incoming[0]?.due<=p.turn)p.readyAttacks.push(p.incoming.shift());
 beginSettle(state,side,hooks);
}
export function step(state,dt=1000/60,actions=[],hooks={}){
 if(state.version===9)return legacy9.step(state,dt,actions,hooks);
 if(state.version===10)return legacy10.step(state,dt,actions,hooks);
 state.events=[];if(state.winner!==null)return state;state.tick++;state.elapsed+=dt;for(const a of actions)command(state,a.side,a.action);
 for(let side=0;side<2;side++){
  if((state.mode==='practice'||state.mode==='online')&&side===1)continue;const p=state.players[side];if(p.dead)continue;
  if(p.phase==='fall'){
   // Positioning time is controllable, bounded, and consumes neither fall nor lock time.
   const grace=Math.min(dt,p.spawnGrace??0);p.spawnGrace=Math.max(0,(p.spawnGrace??0)-dt);
   const fallingDt=dt-grace;if(fallingDt<=0)continue;
   if(state.rules.landOnce){bounceStep(state,side,p,fallingDt,hooks);continue;}
   const speed=p.fast?state.rules.fastFallMs:gravOf(state,p);p.fall+=fallingDt*(p.fast?1:p.rowRate??1);
   while(p.fall>=speed){p.fall-=speed;const next=move(p.board,p.active,0,-1);if(!next){p.fall=0;break;}p.active=next;entered(p);p.lock=0;p.rowRate=1;}
   if(!move(p.board,p.active,0,-1)){p.lock+=fallingDt;if(p.lock>=lockOf(state,p))lockPair(state,side,hooks);}else p.lock=0;
  }else{
   p.timer-=dt;
   if(p.phase==='clear'){
    const age=p.clearDuration-p.timer;
    for(const c of p.wave)if(age>=c.delay+state.rules.clearMs)p.board[c.y][c.x]=null;
   }
   if(p.timer<=0){
    if(p.phase==='clear'){emitAttack(state,side,p.pendingClear);p.pendingClear=null;p.clearing=[];p.wave=[];beginSettle(state,side,hooks);}
    else if(p.phase==='settle')settlePlayer(state,side,hooks);
    else if(p.phase==='attack'){for(const hit of p.attackVisual.hits)state.events.push({type:'hit',side,...hit});p.attackVisual=null;if(p.board[H-1][3]?.stage===3)p.dead=true;else beginSettle(state,side,hooks);}
    else spawn(state,p);
   }
  }
 }
 const [a,b]=state.players;if(a.dead&&b.dead)state.winner='draw';else if(a.dead)state.winner=1;else if(b.dead&&state.mode!=='practice')state.winner=0;
 if(state.winner!==null)state.events.push({type:'end',winner:state.winner});return state;
}
export function hashState(state){const copy=clone(state);delete copy.events;const s=JSON.stringify(copy);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);}
export function validatePattern(rows){return Array.isArray(rows)&&rows.length>=3&&rows.length<=6&&rows.every(row=>Array.isArray(row)&&row.length===W&&row.every(c=>Number.isInteger(c)&&c>=0&&c<4));}

