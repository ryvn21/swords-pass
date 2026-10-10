import {W,H,DEFAULT_RULES,cells,gemRects,landing,move,applyAttackBatch} from './engine.js';
export const COLORS=['#df3939','#f2cf28','#47bf56','#369dde'];
export const COLOR_NAMES=['Red','Yellow','Green','Blue'];
export const CELL_W=32,CELL_H=48;
const X=CELL_W,Y=CELL_H;
function rect(ctx,x,y,w,h,r=3){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function blade(ctx,x,y,w,h,color,index=0,breaker=false){
 // Each colour keeps its own silhouette, both embossed and as a cutout breaker.
 const shapes=[
  [[-.20,.30],[.20,.30],[.28,.47],[.16,.70],[0,.93],[-.16,.70],[-.28,.47]],
  [[-.12,.30],[.12,.30],[.12,.81],[0,.95],[-.12,.81]],
  [[-.18,.30],[.22,.30],[.25,.50],[.16,.73],[-.06,.91],[-.27,.94],[-.12,.69]],
  [[-.23,.30],[.23,.30],[.23,.74],[.13,.86],[0,.95],[-.13,.86],[-.23,.74]],
 ];
 ctx.save();ctx.translate(x+w/2,y);ctx.fillStyle=color;ctx.strokeStyle=breaker?'#141c21':'#172a3280';ctx.lineWidth=breaker?1.6:1;
 ctx.lineJoin='round';ctx.beginPath();for(const [i,[px,py]] of shapes[index].entries())ctx[i?'lineTo':'moveTo'](px*w,py*h);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.rect(-w*.075,h*.065,w*.15,h*.23);ctx.rect(-w*.32,h*.24,w*.64,h*.075);ctx.fill();ctx.stroke();
 ctx.strokeStyle=breaker?'#ffffffa0':'#ffffff60';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w*.055,h*.35);ctx.lineTo(-w*.055,h*.71);ctx.stroke();
 ctx.fillStyle=breaker?'#172126':'#172a3280';ctx.fillRect(-w*.085,h*.14,w*.17,h*.025);ctx.fillRect(-w*.085,h*.20,w*.17,h*.025);ctx.restore();
}
export function tile(ctx,x,y,c,width=X,alpha=1,height=Y){
 if(!c)return;const S=globalThis.scrapsSkin;if(S?.ready&&S.tile(ctx,x,y,c,width,height,alpha))return;ctx.save();ctx.globalAlpha=alpha;
 if(c.breaker&&!c.stage){blade(ctx,x,y,width,height,COLORS[c.color],c.color,true);ctx.restore();return;}
 const base=c.stage>1?'#aaa9a2':COLORS[c.color];
 ctx.fillStyle=base;rect(ctx,x+1,y+1,width-2,height-2,4);ctx.fill();
 ctx.strokeStyle='#0007';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff3';ctx.fillRect(x+3,y+3,width-6,3);ctx.fillRect(x+3,y+6,2,height-12);
 ctx.fillStyle='#0003';ctx.fillRect(x+4,y+height-5,width-7,3);ctx.fillRect(x+width-4,y+6,2,height-12);
 if(c.stage===1){ctx.fillStyle='#b8b5b477';rect(ctx,x+2,y+2,width-4,height-4,3);ctx.fill();ctx.strokeStyle='#f0e9db88';ctx.strokeRect(x+5,y+5,width-10,height-10);}
 if(c.stage<2){ctx.save();ctx.globalAlpha*=c.stage===1?.55:.72;blade(ctx,x+width*.08,y+height*.04,width*.84,height*.92,'#20333a',c.color);ctx.restore();}
 ctx.restore();
}
// Reading clientWidth every frame forces a layout while CSS animations run (the duel intro stuttered);
// remember each canvas's on-screen width and let a ResizeObserver keep it current.
const shownWidths=new WeakMap(),sizeWatch=globalThis.ResizeObserver?new ResizeObserver(list=>{for(const e of list)shownWidths.set(e.target,e.target.clientWidth);}):null;
function shownWidth(canvas){if(!sizeWatch)return canvas.clientWidth;if(!shownWidths.has(canvas)){shownWidths.set(canvas,canvas.clientWidth);sizeWatch.observe(canvas);}return shownWidths.get(canvas);}
export function prepareCanvas(canvas,width,height){
 const dpr=Math.min(globalThis.window?.devicePixelRatio||1,2);
 // In the browser, match the backing store to the canvas's on-screen size so sprites land 1:1 on device pixels.
 const cssW=globalThis.scrapsSkin?.ready?shownWidth(canvas):0,shown=cssW>0?cssW*(globalThis.window?.devicePixelRatio||1)/width:0,scale=shown?Math.min(4,Math.max(.5,shown)):dpr;
 const cw=Math.round(width*scale),ch=Math.round(height*scale);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 const ctx=canvas.getContext('2d');ctx.setTransform(cw/width,0,0,ch/height,0,0);return ctx;
}
function sword(ctx,x,y,w,h,horizontal=false,hand=1){
 ctx.save();ctx.translate(x+w/2,y+h/2);if(horizontal)ctx.rotate(hand===1?Math.PI/2:-Math.PI/2);
 const wide=horizontal?h:w,len=horizontal?w:h;const S=globalThis.scrapsSkin;if(S?.ready&&S.sword(ctx,wide,len)){ctx.restore();return;}
 const fill=ctx.createLinearGradient(-wide/2,0,wide/2,0);fill.addColorStop(0,'#898d94');fill.addColorStop(.45,'#e1e2d8');fill.addColorStop(.6,'#bfc5c6');fill.addColorStop(1,'#747c88');
 ctx.fillStyle=fill;ctx.strokeStyle='#d6d4cc';ctx.lineWidth=1.3;
 ctx.beginPath();ctx.moveTo(-wide*.42,-len*.40);ctx.lineTo(wide*.42,-len*.40);ctx.lineTo(wide*.42,len*.34);ctx.lineTo(wide*.14,len*.48);ctx.lineTo(0,len*.5);ctx.lineTo(-wide*.42,len*.34);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.strokeStyle='#f4f0dfaa';ctx.beginPath();ctx.moveTo(0,-len*.36);ctx.lineTo(0,len*.42);ctx.stroke();
 ctx.fillStyle='#c3ad7b';rect(ctx,-wide*.49,-len*.45,wide*.98,Math.min(8,len*.1),2);ctx.fill();ctx.restore();
}
function drawPosition(p,x,y){const a=p.motion?.find(c=>c.x===x&&c.y===y);return a?y+(a.fromY-y)*Math.max(0,p.timer/p.motionDuration):y;}
function waveAge(p,x,y){if(p.phase!=='clear')return null;const c=p.wave?.find(c=>c.x===x&&c.y===y);return c?p.clearDuration-p.timer-c.delay:null;}
function drawPile(ctx,board,p,reduced){
 const rects=gemRects(board),strikes=new Map();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const c=board[y][x];if(!c)continue;
  if(c.stage===3){const a=strikes.get(c.strike)||{x,y,maxX:x,maxY:y,axis:c.axis,hand:c.hand};a.x=Math.min(a.x,x);a.y=Math.min(a.y,y);a.maxX=Math.max(a.maxX,x);a.maxY=Math.max(a.maxY,y);strikes.set(c.strike,a);continue;}
  if(c.gem)continue;
  const age=waveAge(p,x,y),fade=globalThis.scrapsSkin?.ready&&!reduced?80:(p.clearCellMs??180),alpha=age===null||age<0?1:Math.max(0,1-age/Math.max(1,fade));
  const yy=drawPosition(p,x,y);tile(ctx,x*X,(H-1-yy)*Y,c,X,alpha);
 }
 for(const g of rects){
  const yy=drawPosition(p,g.x,g.y),x=g.x*X+1,y=(H-yy-g.h)*Y+1,w=g.w*X-2,h=g.h*Y-2;
  const age=waveAge(p,g.x,g.y);ctx.save();ctx.globalAlpha=age===null||age<0?1:Math.max(0,1-age/Math.max(1,globalThis.scrapsSkin?.ready&&!reduced?80:(p.clearCellMs??180)));const S=globalThis.scrapsSkin;if(S?.ready&&S.gem(ctx,x,y,w,h,g)){ctx.restore();continue;}
  ctx.fillStyle=COLORS[g.color];rect(ctx,x,y,w,h,4);ctx.fill();ctx.strokeStyle='#fff6';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#ffffff18';ctx.beginPath();ctx.moveTo(x+4,y+4);ctx.lineTo(x+w-4,y+4);ctx.lineTo(x+w-12,y+12);ctx.lineTo(x+12,y+12);ctx.lineTo(x+12,y+h-12);ctx.lineTo(x+4,y+h-4);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#0003';ctx.strokeRect(x+9,y+10,w-18,h-20);
  ctx.strokeStyle='#ffffff15';for(let i=1;i<g.w;i++){ctx.beginPath();ctx.moveTo(x+i*X,y+9);ctx.lineTo(x+i*X,y+h-9);ctx.stroke();}for(let i=1;i<g.h;i++){ctx.beginPath();ctx.moveTo(x+9,y+i*Y);ctx.lineTo(x+w-9,y+i*Y);ctx.stroke();}
  ctx.restore();
 }
 for(const a of strikes.values())sword(ctx,a.x*X+1,(H-1-a.maxY)*Y+1,(a.maxX-a.x+1)*X-2,(a.maxY-a.y+1)*Y-2,a.axis==='horizontal',a.hand??1);
}
const shadowCache=new WeakMap();
function incomingShapes(canvas,p){
 const due=p.incoming.filter(b=>(b.due??0)<=p.turn+1);if(!due.length)return [];
 const filled=p.board.reduce((n,r)=>n+r.filter(Boolean).length,0),key=due.map(b=>b.id).join(',')+':'+p.turn+':'+filled,hit=shadowCache.get(canvas);
 if(hit?.key===key)return hit.shapes;
 const shapes=[];
 try{const b=p.board.map(r=>r.map(c=>c&&{...c}));for(const batch of due){const res=applyAttackBatch(b,batch.attacks??[batch]);for(const a of res.hits){if(a.kind==='sprinkle')for(const c of a.placed||[])shapes.push({x:c.x,y:c.y,w:1,h:1,sprinkle:true});else if(a.placement)shapes.push({...a.placement,horizontal:a.kind==='horizontal'&&!a.converted,area:(a.width||1)*(a.length||1)});}}}catch{}
 shadowCache.set(canvas,{key,shapes});return shapes;
}
const SHOW_INCOMING_SHADOWS=false;
// YPP attack timing (rules.yppAttack): each strike moves at a steady speed in its own slot, one after another; then every
// column's sprinkles drop together as one stack.
function drawScheduled(ctx,p,v,hits){
 const t=v.duration-p.timer;
 for(const s of v.schedule){const a=hits[s.i],q=a?.placement;if(!q||t<s.start)continue;const k=Math.min(1,(t-s.start)/Math.max(1,s.end-s.start)),side=a.kind==='horizontal'&&!a.converted;
  const w=q.w*X-2,h=q.h*Y-2,endX=q.x*X+1,endY=(H-q.y-q.h)*Y+1;
  const x=side?endX+(1-k)*q.w*X*(q.hand===1?1:-1):endX,y=side?endY:endY-(1-k)*(H-q.y)*Y;
  sword(ctx,x,y,w,h,side,q.hand);}
 if(t<v.sprinkleStart)return;
 const e=t-v.sprinkleStart,low=new Map();
 for(const a of hits)if(a.kind==='sprinkle')for(const c of a.placed||[])low.set(c.x,Math.min(low.get(c.x)??H,c.y));
 for(const a of hits)if(a.kind==='sprinkle')for(const c of a.placed||[]){const rows=H-low.get(c.x),up=Math.max(0,rows-e/v.rowMs);if(up>=rows)continue;tile(ctx,c.x*X,(H-1-c.y-up)*Y,p.board[c.y][c.x]);}
}
// The YPP warning: each incoming strike peeks in at the edge it will come from, blinking (300 ms on, 300 ms off) at 75%.
// It shows a third of a cell for a small strike (area 6 or less), two-thirds up to 10, a full cell for anything bigger.
const SHOW_INCOMING_PEEK=true;
function drawIncomingPeek(ctx,canvas,p,time){
 if(Math.floor(time/300)%2)return;
 const shapes=incomingShapes(canvas,p).filter(q=>!q.sprinkle);if(!shapes.length)return;
 ctx.save();ctx.globalAlpha=.75;ctx.beginPath();ctx.rect(0,0,W*X,H*Y);ctx.clip();
 for(const q of shapes){const area=q.area??q.w*q.h,peek=area<=6?1/3:area<=10?2/3:1,w=q.w*X-2,h=q.h*Y-2;
  if(q.horizontal){const x=q.hand===1?W*X-peek*X:peek*X-w;sword(ctx,x,(H-q.y-q.h)*Y+1,w,h,true,q.hand);}
  else sword(ctx,q.x*X+1,peek*Y-h,w,h,false,1);}
 ctx.restore();
}
function drawIncomingShadow(ctx,canvas,p,time,reduced){
 const shapes=incomingShapes(canvas,p);if(!shapes.length)return;
 const on=reduced?true:Math.floor(time/150)%2===0;ctx.save();
 for(const q of shapes){const x=q.x*X,y=(H-q.y-q.h)*Y,w=q.w*X,h=q.h*Y;
  if(q.sprinkle){ctx.globalAlpha=on?.6:.25;ctx.fillStyle='#05030a';rect(ctx,x+X*.18,y+Y*.2,X*.64,Y*.6,4);ctx.fill();ctx.globalAlpha=on?.8:.35;ctx.strokeStyle='#f0cf7a';ctx.lineWidth=1.5;ctx.stroke();continue;}
  ctx.globalAlpha=on?.75:.3;ctx.fillStyle='#05030a';rect(ctx,x+2,y+2,w-4,h-4,5);ctx.fill();
  ctx.globalAlpha=on?.9:.4;ctx.strokeStyle='#f0cf7a';ctx.lineWidth=2;ctx.setLineDash([6,5]);rect(ctx,x+3,y+3,w-6,h-6,5);ctx.stroke();ctx.setLineDash([]);
  // a sword silhouette pointing the way it will come in
  ctx.globalAlpha=on?.55:.22;ctx.fillStyle='#f0cf7a';const cx=x+w/2,cy=y+h/2;ctx.beginPath();
  if(q.horizontal){const d=q.hand===1?-1:1,len=Math.min(w-14,90);ctx.moveTo(cx-d*len/2,cy-3);ctx.lineTo(cx+d*len/2-d*10,cy-3);ctx.lineTo(cx+d*len/2,cy);ctx.lineTo(cx+d*len/2-d*10,cy+3);ctx.lineTo(cx-d*len/2,cy+3);}
  else{const len=Math.min(h-16,120);ctx.moveTo(cx-3,cy-len/2);ctx.lineTo(cx+3,cy-len/2);ctx.lineTo(cx+3,cy+len/2-10);ctx.lineTo(cx,cy+len/2);ctx.lineTo(cx-3,cy+len/2-10);}
  ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
export function drawBoard(canvas,p,{time=0,renderAheadMs=0,gravityMs=DEFAULT_RULES.gravityMs,fastFallMs=DEFAULT_RULES.fastFallMs,ghost=false,particles=[],reduced=false}={}){
 if(!canvas)return;const entryRows=p.entryRows??0,ctx=prepareCanvas(canvas,W*X,(H+entryRows)*Y);ctx.clearRect(0,0,W*X,(H+entryRows)*Y);
 if(canvas.style)canvas.style.aspectRatio=String(W*X/((H+entryRows)*Y));
 ctx.save();if(entryRows){ctx.fillStyle='#151d24';ctx.fillRect(0,0,W*X,entryRows*Y);ctx.translate(0,entryRows*Y);}
 const S=globalThis.scrapsSkin;const skinBoard=S?.ready&&S.board(ctx,W*X,H*Y);if(!skinBoard){const bg=ctx.createLinearGradient(0,0,W*X,H*Y);bg.addColorStop(0,'#292d30');bg.addColorStop(1,'#1c2328');ctx.fillStyle=bg;ctx.fillRect(0,0,W*X,H*Y);}
 if(!skinBoard){ctx.strokeStyle='#b8996911';ctx.lineWidth=1;}if(!skinBoard)for(let x=1;x<W;x++){ctx.beginPath();ctx.moveTo(x*X,0);ctx.lineTo(x*X,H*Y);ctx.stroke();}
 ctx.fillStyle='#d8b47a';ctx.beginPath();ctx.moveTo(3.5*X-5,0);ctx.lineTo(3.5*X+5,0);ctx.lineTo(3.5*X,6);ctx.closePath();ctx.fill();
 const incoming=p.phase==='attack'?p.attackVisual:null;
 drawPile(ctx,incoming?.before??p.board,incoming?{}:p,reduced);
 // An incoming attack lands in two beats: the swords first, then the sprinkles drop on top of them.
 // Everything moves straight to its resting place (accelerating, no overshoot) and holds there.
 if(incoming){
  S?.ready&&S.attack?.(canvas,incoming,p.timer);
  const hits=incoming.hits??[incoming.hit];
  if(incoming.schedule){drawScheduled(ctx,p,incoming,hits);}else{
  const progress=Math.min(1,1-p.timer/incoming.duration),swords=hits.some(a=>a.kind!=='sprinkle'&&a.placement);
  const swordT=swords?Math.min(1,progress/.55):1,sprinkleT=swords?Math.max(0,(progress-.5)/.5):progress;
  const fall=t=>t*t,slide=t=>1-(1-t)**3;
  for(const a of hits){
   if(a.kind==='sprinkle'){const n=a.placed.length;a.placed.forEach((c,i)=>{const lag=n>1?i/(n-1)*.3:0,t=Math.max(0,Math.min(1,(sprinkleT-lag)/(1-.3*(n>1)))),end=(H-1-c.y)*Y;if(t<=0)return;tile(ctx,c.x*X,end-(1-fall(t))*(H*Y),p.board[c.y][c.x]);});}
   else if(a.placement){const q=a.placement,horizontal=a.kind==='horizontal'&&!a.converted,w=q.w*X-2,h=q.h*Y-2,endX=q.x*X+1,endY=(H-q.y-q.h)*Y+1;
    const x=horizontal?endX+(1-slide(swordT))*(q.hand===1?W*X:-W*X):endX;
    const y=horizontal?endY:endY-(1-fall(swordT))*(H*Y+h);
    sword(ctx,x,y,w,h,horizontal,q.hand);
   }
  }}
 }
 // Warning: where the next incoming attack will land, as blinking shadows. Off for now (too busy): the
 // warning is sound only. Worked out against the board as it is now, so it can shift with your next pair.
 if(SHOW_INCOMING_SHADOWS&&!incoming&&p.incoming?.length&&!p.dead)drawIncomingShadow(ctx,canvas,p,time,reduced);
 if(SHOW_INCOMING_PEEK&&!incoming&&p.incoming?.length&&!p.dead)drawIncomingPeek(ctx,canvas,p,time);
 S?.ready&&S.incoming?.(canvas,p.incoming,p.turn);
 if(p.active){
  if(ghost)for(const c of cells(landing(p.board,p.active)))if(c.y<H)tile(ctx,c.x*X,(H-1-c.y)*Y,c.cell,X,.15);
  // Look-ahead between simulation ticks. While fast-falling it runs one tick behind (it shows where the pair
  // was, moving toward where it is), so it never predicts past the truth: letting go of fast fall, or the pair
  // stopping, never pops it back up, and a pair that can no longer fall sits exactly in its cell.
  const canFall=!p.bouncing&&!!move(p.board,p.active,0,-1),speed=p.fast?fastFallMs:(p.velocity?40/p.velocity:gravityMs),ahead=Math.max(0,renderAheadMs-(p.spawnGrace??0))-(p.fast?1000/60:0);
  const fraction=canFall?Math.max(-1,Math.min(1,(p.fall+ahead*(p.fast?1:p.rowRate??1))/speed)):0;
  for(const c of cells(p.active))tile(ctx,c.x*X,(H-1-c.y+fraction)*Y,c.cell);
 }
 if(!reduced&&p.phase==='clear')for(const c of p.wave||[]){const age=p.clearDuration-p.timer-c.delay;if(age<0||age>380)continue;if(S?.ready&&S.clear(ctx,(c.x+.5)*X,(H-1-c.y)*Y+Y/2,c.cell.color,age,380))continue;const t=age/380;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=COLORS[c.cell.color];for(let i=0;i<4;i++){const dx=(i%2?1:-1)*(3+t*16),dy=Math.floor(i/2)*10-10+t*t*28;ctx.fillRect((c.x+.5)*X+dx,(H-1-c.y)*Y+18+dy,5,9);}ctx.restore();}
 if(!reduced)for(const a of particles){const age=(time-a.time)/600;if(age<0||age>1)continue;ctx.globalAlpha=1-age;ctx.fillStyle=COLORS[a.color];ctx.fillRect((a.x+.5)*X+a.vx*age,(H-1-a.y)*Y+Y/2+a.vy*age+70*age*age,4,4);}ctx.globalAlpha=1;S?.ready&&S.after?.(ctx,canvas,p,W*X,H*Y);ctx.restore();
}
export function drawNext(canvas,pair){if(!canvas)return;const ctx=prepareCanvas(canvas,X,Y*2);ctx.clearRect(0,0,X,Y*2);tile(ctx,0,0,pair[1]);tile(ctx,0,Y,pair[0]);}
