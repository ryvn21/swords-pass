import {W,H,clone,landing,move,rotate,cells,resolve,gemRects,decay} from './engine.js';
const STYLES=[
 {style:'breaker',clearWeight:1.35,gemWeight:.85,lane:-.8,chainWeight:1},
 {style:'builder',clearWeight:1,gemWeight:1.3,lane:.8,chainWeight:1.1},
 {style:'counter',clearWeight:1.15,gemWeight:1,lane:0,chainWeight:1.55},
 // Adventure rivals: same search, different priorities. Identities 0-2 are unchanged.
 {style:'scrapper',clearWeight:1.7,gemWeight:.55,lane:-.4,chainWeight:.8},
 {style:'hoarder',clearWeight:.7,gemWeight:1.75,lane:.5,chainWeight:1},
 {style:'chaser',clearWeight:.95,gemWeight:1.05,lane:.3,chainWeight:2.1},
 {style:'warden',clearWeight:1.2,gemWeight:.9,lane:0,chainWeight:1.1,heightWeight:1.6}
];
export function botProfile(difficulty='medium',identity=0){
 const base={easy:{think:320,actionMs:90,depth:1,beam:4,aggression:1},medium:{think:160,actionMs:60,depth:2,beam:8,aggression:1.2},hard:{think:75,actionMs:40,depth:2,beam:14,aggression:1.4}}[difficulty]??{};
 return {...base,...STYLES[((identity%STYLES.length)+STYLES.length)%STYLES.length]};
}
export const OPPONENTS=[
 {...botProfile('easy',0),id:'pip',name:'Pip',title:'The quick clearer',description:'Finds breakers and keeps a low stack.'},
 {...botProfile('medium',1),id:'marlow',name:'Marlow',title:'The gem builder',description:'Builds rectangles, then cashes them in.'},
 {...botProfile('hard',2),id:'rook',name:'Rook',title:'The counterpuncher',description:'Looks ahead for clears and chain opportunities.'}
];
export function placements(board,active){const queue=[{p:clone(active),path:[]}],seen=new Set(),out=new Map();for(let i=0;i<queue.length;i++){const {p,path}=queue[i],key=[p.x,p.y,p.r].join(',');if(seen.has(key))continue;seen.add(key);const end=landing(board,p),ek=[end.x,end.y,end.r].join(',');if(!out.has(ek))out.set(ek,{piece:end,path});for(const action of ['left','right','cw','ccw']){const n=action==='left'?move(board,p,-1,0):action==='right'?move(board,p,1,0):rotate(board,p,action==='cw'?1:-1,true);if(n&&!seen.has([n.x,n.y,n.r].join(',')))queue.push({p:n,path:[...path,action]});}}return [...out.values()];}
export function evaluate(board,attacks,profile=1){
 const o=typeof profile==='number'?{aggression:profile}:profile;
 if(board[H-1][3])return -100000;
 let score=0;const heights=[];
 for(let x=0;x<W;x++){let height=0;for(let y=0;y<H;y++){const c=board[y][x];if(!c)continue;height=y+1;
  if(c.stage){score-=2;continue;}
  for(const [dx,dy] of [[1,0],[0,1]]){const n=board[y+dy]?.[x+dx];if(n&&!n.stage&&n.color===c.color)score+=1.7;}
  if(c.breaker){let buried=0;for(let yy=y+1;yy<H;yy++)if(board[yy][x])buried++;score+=buried? -buried*1.8:2;}
 }
 heights.push(height);score-=(height*2.5+Math.max(0,height-6)**2*6)*(o.heightWeight??1);
 if(x===3)score-=height*2+Math.max(0,height-8)**2*12;
 for(let y=0;y<height;y++)if(!board[y][x])score-=8;
 }
 for(let x=1;x<W;x++)score-=Math.abs(heights[x]-heights[x-1])*.8;
 for(const g of gemRects(board))score+=(g.w*g.h*2+Math.min(g.w,g.h))*(o.gemWeight??1);
 for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){const arr=[board[y][x],board[y][x+1],board[y+1][x],board[y+1][x+1]].filter(c=>c&&!c.stage&&!c.breaker);for(let color=0;color<4;color++)if(arr.filter(c=>c.color===color).length===3)score+=3*(o.gemWeight??1);}
 for(const a of attacks){score+=a.cleared.length*5*(o.clearWeight??1)+a.sprinkles*1.5+a.swords.reduce((s,v)=>s+v.width*v.length,0)*3*(o.aggression??1);score+=Math.max(0,a.chain-1)*35*(o.chainWeight??1);}
 return score;
}
function simulate(board,p){const b=clone(board);for(const {x,y,cell} of cells(p)){if(y<H)b[y][x]=clone(cell);}decay(b,false);const attacks=resolve(b);return {board:b,attacks};}
export function planMove({board,active,nextPair,opponent=OPPONENTS[1]}){
 if(!active)return null;
 const choices=[];for(const choice of placements(board,active)){const sim=simulate(board,choice.piece);if(!sim)continue;
  const score=evaluate(sim.board,sim.attacks,opponent)+(choice.piece.x-2.5)*(opponent.lane??0)-choice.path.length*.015;
  choices.push({...choice,...sim,score,cleared:sim.attacks.reduce((n,a)=>n+a.cleared.length,0)});
 }
 choices.sort((a,b)=>b.score-a.score);
 if(opponent.depth>1&&nextPair){choices.splice(opponent.beam??8);for(const choice of choices){
  if(choice.score< -90000)continue;let best=-100000;
  for(const option of placements(choice.board,{x:3,y:H-1,r:0,pair:nextPair})){const sim=simulate(choice.board,option.piece);if(sim)best=Math.max(best,evaluate(sim.board,sim.attacks,opponent));}
  choice.score+=.7*(best-evaluate(choice.board,[],opponent));
 }choices.sort((a,b)=>b.score-a.score);}
 const best=choices[0];return best?{path:best.path,x:best.piece.x,r:best.piece.r,score:best.score,cleared:best.cleared}:{path:[],x:active.x,r:active.r,score:-100000,cleared:0};
}
