import {blocked,height,surfaceAt,cell,segment,COLS,ROWS,TILE} from './model.mjs?v=overview-fast-1';
import {movePlayer} from './physics.mjs?v=overview-fast-1';
import {WALK_SPEED,GAIT_PER_PIXEL,PLAYER_SCALE} from './player-settings.mjs?v=overview-fast-1';

export const AMBIENT_RESIDENTS=Object.freeze(['bach','mozart','clara','nina','joplin','miles','chopin','haydn','vee-jay','zizi','beethoven','ellington','ella','handel','vivaldi','metronome','schoenberg','dj']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const center=(x,y)=>({x:x*TILE+TILE/2,y:y*TILE+TILE/2});
const tileOf=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=p=>p.x>=20&&p.y>=20&&p.x<COLS*TILE-20&&p.y<ROWS*TILE-20;
const tileId=p=>p.y*COLS+p.x;

function randomSource(seed=0x63cd1a){
 let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
function heapPush(heap,item){let i=heap.length;heap.push(item);while(i){const parent=(i-1)>>1;if(heap[parent].score<=item.score)break;heap[i]=heap[parent];i=parent;}heap[i]=item;}
function heapPop(heap){
 const first=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let n=i*2+1;if(n+1<heap.length&&heap[n+1].score<heap[n].score)n++;if(heap[n].score>=tail.score)break;heap[i]=heap[n];i=n;}heap[i]=tail;}return first;
}

// Preview pedestrians use the same collision model as the playable character.
// Sampling the whole connection prevents a route from jumping over a wall,
// a narrow shoreline, or a closed gate between two otherwise clear tile centers.
export function npcConnectionClear(doc,catalog,from,to){
 if(!validPoint(from)||!validPoint(to)||!inside(from)||!inside(to)||blocked(doc,from.x,from.y,catalog))return false;
 const a=cell(doc,Math.floor(from.x/TILE),Math.floor(from.y/TILE)),b=cell(doc,Math.floor(to.x/TILE),Math.floor(to.y/TILE));
 const steps=Math.max(1,Math.ceil(distance(from,to)/(a.stairs||b.stairs?1.5:4)));let previous=from;
 for(let i=1;i<=steps;i++){
  const q={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};
  if(blocked(doc,q.x,q.y,catalog,previous))return false;previous=q;
 }
 return true;
}
function pavingAt(doc,catalog,p){
 const surface=surfaceAt(doc,p.x,p.y);if(surface!=='grass')return surface;
 for(const o of doc.objects){
  const a=catalog.get(o.asset);if(!a||o.mount||o.asset!=='music-square'&&!a.roadOpen)continue;
  const r=-(o.rotation||0)*Math.PI/180,dx=(p.x-o.x)/o.scale,dy=(p.y-o.y)/o.scale;
  const x=dx*Math.cos(r)-dy*Math.sin(r)+a.w/2,y=dx*Math.sin(r)+dy*Math.cos(r)+a.h;
  if(x<0||y<0||x>=a.w||y>=a.h)continue;
  if(o.asset==='music-square')return 'cobble';
  const margin=a.road?.sidewalk||128,right=a.w-margin,bottom=a.h-margin;
  const asphalt=x>=margin&&x<right&&y>=margin&&y<bottom||a.roadOpen.includes('north')&&x>=margin&&x<right&&y<margin||a.roadOpen.includes('south')&&x>=margin&&x<right&&y>=bottom||a.roadOpen.includes('west')&&y>=margin&&y<bottom&&x<margin||a.roadOpen.includes('east')&&y>=margin&&y<bottom&&x>=right;
  return asphalt?'asphalt':'sidewalk';
 }
 return surface;
}
const materialCost=s=>({sidewalk:1,cobble:1.05,wood:1.2,dirt:1.5,sand:1.6,brick:1.05,grass:2.1,asphalt:3.2})[s]||2;
function orthogonalJoin(doc,catalog,from,to){
 if(Math.abs(from.x-to.x)<.01||Math.abs(from.y-to.y)<.01)return npcConnectionClear(doc,catalog,from,to)?[to]:null;
 for(const corner of [{x:to.x,y:from.y},{x:from.x,y:to.y}])if(npcConnectionClear(doc,catalog,from,corner)&&npcConnectionClear(doc,catalog,corner,to))return [corner,to];
 return null;
}
function navigationView(doc,catalog,from,radius){
 const reach=(radius+3)*TILE,bounds={x0:from.x-reach,y0:from.y-reach,x1:from.x+reach,y1:from.y+reach};
 const overlaps=(x0,y0,x1,y1)=>x1>=bounds.x0&&x0<=bounds.x1&&y1>=bounds.y0&&y0<=bounds.y1;
 const edges={};for(const[k,e]of Object.entries(doc.edges)){const s=segment(k);if(overlaps(s.x-96,s.y-96,s.x+s.dx+96,s.y+s.dy+96))edges[k]=e;}
 const objects=doc.objects.filter(o=>{
  if(!o.collision||o.mount)return false;const a=catalog.get(o.asset);if(!a)return false;
  const points=[...(a.polygons||[]).flat(),...(a.boxes||[]).flatMap(b=>[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]])];if(!points.length)return false;
  const r=(o.rotation||0)*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y]of points){const dx=(x-a.w/2)*o.scale,dy=(y-a.h)*o.scale,X=o.x+dx*cos-dy*sin,Y=o.y+dx*sin+dy*cos;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y);}
  return overlaps(x0-12,y0-12,x1+12,y1+12);
 });
 // Only broad-phase candidates change; blocked() still makes every actual
 // decision, including the live terrain masks and stair height profiles.
 return {...doc,edges,objects};
}

// A bounded A* search favors pavements and piazzas. It returns real world
// waypoints; neither planning nor walking writes anything into the map.
export function planNPCPath(doc,catalog,from,to,{radius=14,maxNodes=600}={}){
 if(!validPoint(from)||!validPoint(to)||!inside(from)||!inside(to)||blocked(doc,to.x,to.y,catalog))return [];
 doc=navigationView(doc,catalog,from,Math.max(1,Math.min(24,Math.round(radius))));
 const startTile=tileOf(from),goal=tileOf(to),candidates=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const p={x:startTile.x+dx,y:startTile.y+dy},world=center(p.x,p.y);if(inside(world)&&!blocked(doc,world.x,world.y,catalog))candidates.push({tile:p,world,d:distance(from,world)});}
 candidates.sort((a,b)=>a.d-b.d);let start,prefix;
 for(const candidate of candidates){const join=orthogonalJoin(doc,catalog,from,candidate.world);if(join){start=candidate.tile;prefix=join;break;}}
 if(!start)return [];
 const goalWorld=center(goal.x,goal.y),suffix=orthogonalJoin(doc,catalog,goalWorld,to);if(!suffix)return [];
 const span=Math.max(1,Math.min(24,Math.round(radius))),minX=Math.max(0,start.x-span),maxX=Math.min(COLS-1,start.x+span),minY=Math.max(0,start.y-span),maxY=Math.min(ROWS-1,start.y+span);
 if(goal.x<minX||goal.x>maxX||goal.y<minY||goal.y>maxY)return [];
 const records=new Map(),open=[],closed=new Set(),edgeCache=new Map(),startId=tileId(start),goalId=tileId(goal);
 const heuristic=p=>Math.abs(p.x-goal.x)+Math.abs(p.y-goal.y);
 records.set(startId,{tile:start,g:0,parent:null});heapPush(open,{id:startId,score:heuristic(start)});
 while(open.length&&closed.size<maxNodes){
  const current=heapPop(open);if(closed.has(current.id))continue;closed.add(current.id);const record=records.get(current.id),p=record.tile;
  if(current.id===goalId){
   const reversed=[];let at=current.id;while(at!==startId){const item=records.get(at);reversed.push(center(item.tile.x,item.tile.y));at=item.parent;}
   return [...prefix,...reversed.reverse(),...suffix].filter((p,i,list)=>(i?distance(p,list[i-1]):distance(p,from))>.1);
  }
  for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){
   const next={x:p.x+dx,y:p.y+dy};if(next.x<minX||next.x>maxX||next.y<minY||next.y>maxY)continue;
   const id=tileId(next);if(closed.has(id))continue;const world=center(next.x,next.y),edgeKey=current.id+':'+id;
   if(!edgeCache.has(edgeKey))edgeCache.set(edgeKey,npcConnectionClear(doc,catalog,center(p.x,p.y),world));if(!edgeCache.get(edgeKey))continue;
   const g=record.g+materialCost(pavingAt(doc,catalog,world)),old=records.get(id);if(old&&old.g<=g)continue;
   records.set(id,{tile:next,g,parent:current.id});heapPush(open,{id,score:g+heuristic(next)});
  }
 }
 return [];
}

export function createAmbientNPCs({getProject,catalog,getCamera,getViewport,count=10,random=randomSource()}={}){
 let activeDoc=null,residents=[],renderer=null,elapsed=0;
 const visible=()=>residents.filter(a=>!a.hidden);
 const camera=()=>getCamera?.()||{x:8192,y:6144,zoom:.6};
 const viewport=()=>getViewport?.()||{width:1000,height:760};
 function screenPoint(doc,p){const c=camera(),z=height(doc,p.x,p.y);return {x:(p.x-c.x)*(c.zoom||.6),y:(p.y-z-c.y)*(c.zoom||.6)};}
 function onScreen(doc,p,padding=0){const s=screenPoint(doc,p),v=viewport();return Math.abs(s.x)<v.width/2+padding&&Math.abs(s.y)<v.height/2+padding;}
 function findSpawn(doc,index,edge=false){
  const c=camera(),v=viewport(),zoom=c.zoom||.6,others=visible(),candidates=[];
  for(let i=0;i<110;i++){
   let sx,sy;
   if(edge){const side=(i+index)%4,t=random()*2-1;const bx=v.width/2+75,by=v.height/2+75;sx=side===0?-bx:side===1?bx:t*bx;sy=side===2?-by:side===3?by:t*by;}
   else{sx=(random()*2-1)*Math.max(40,v.width/2-75);sy=(random()*2-1)*Math.max(40,v.height/2-135)+35;}
   const x=(Math.floor((c.x+sx/zoom)/TILE)+.5)*TILE,baseY=c.y+sy/zoom,y=(Math.floor((baseY+height(doc,x,baseY))/TILE)+.5)*TILE,p={x,y};
   if(!inside(p)||blocked(doc,x,y,catalog)||others.some(a=>a.id!==AMBIENT_RESIDENTS[index%AMBIENT_RESIDENTS.length]&&distance(a,p)<92))continue;
   if(!edge&&!onScreen(doc,p,-45))continue;
   const cost=materialCost(pavingAt(doc,catalog,p));candidates.push({...p,score:12/cost+random()*3});
  }
  candidates.sort((a,b)=>b.score-a.score);return candidates[0]||null;
 }
 function reset(){activeDoc=null;residents=[];elapsed=0;}
 function initialize(doc){
  activeDoc=doc;residents=[];
  for(let i=0;i<Math.max(0,Math.min(18,count));i++){
   const p=findSpawn(doc,i);const actor={id:AMBIENT_RESIDENTS[i%AMBIENT_RESIDENTS.length],x:p?.x||camera().x,y:p?.y||camera().y,facing:['down','left','right','up'][i%4],walking:false,phase:i*.7,alpha:0,activity:'',hidden:!p,speed:120+i%5*12,_index:i,_path:[],_wait:i*.13,_retry:0,_stuck:0};residents.push(actor);
  }
 }
 function chooseRoute(doc,actor){
  const options=[];
  for(let i=0;i<24;i++){
   const angle=random()*Math.PI*2,r=190+random()*420,p={x:(Math.floor((actor.x+Math.cos(angle)*r)/TILE)+.5)*TILE,y:(Math.floor((actor.y+Math.sin(angle)*r)/TILE)+.5)*TILE};
   if(!inside(p)||blocked(doc,p.x,p.y,catalog)||distance(actor,p)<150||!onScreen(doc,p,180))continue;
   options.push({...p,score:10/materialCost(pavingAt(doc,catalog,p))+random()*5});
  }
  options.sort((a,b)=>b.score-a.score);
  for(const goal of options.slice(0,2)){const path=planNPCPath(doc,catalog,actor,goal,{radius:12,maxNodes:320});if(path.length){actor._path=path;return true;}}
  return false;
 }
 function update(dt,time){
  const doc=getProject?.();if(!doc)return;dt=Math.min(.1,Math.max(0,Number(dt)||0));elapsed=Number.isFinite(time)?time:elapsed+dt;
  if(doc!==activeDoc)initialize(doc);let routeBudget=1,respawnBudget=1;
  for(const actor of residents){
   actor.walking=false;actor.alpha=Math.min(1,actor.alpha+dt*2.5);actor._retry=Math.max(0,actor._retry-dt);
   if(actor.hidden||blocked(doc,actor.x,actor.y,catalog)||!onScreen(doc,actor,450)){
    if(actor._retry||!respawnBudget)continue;respawnBudget--;const p=findSpawn(doc,actor._index,!actor.hidden&&!onScreen(doc,actor,450));
    actor._retry=1.5+random();actor._path=[];actor.alpha=0;if(p){actor.x=p.x;actor.y=p.y;actor.hidden=false;actor._wait=.1+random()*.3;}else actor.hidden=true;continue;
   }
   actor._wait=Math.max(0,actor._wait-dt);if(actor._wait)continue;
   if(!actor._path.length){if(!routeBudget)continue;routeBudget--;if(!chooseRoute(doc,actor)){actor._wait=.7+random();continue;}}
   const target=actor._path[0],dx=target.x-actor.x,dy=target.y-actor.y;
   if(Math.abs(dx)<2&&Math.abs(dy)<2){actor._path.shift();if(!actor._path.length)actor._wait=.7+random()*2.5;continue;}
   const horizontal=Math.abs(dx)>=Math.abs(dy),key=horizontal?dx<0?'a':'d':dy<0?'w':'s',delta=Math.min(dt*actor.speed/WALK_SPEED,(horizontal?Math.abs(dx):Math.abs(dy))/WALK_SPEED);
   const motion=movePlayer(doc,actor,new Set([key]),delta,catalog);actor.walking=motion.walking;if(motion.facing)actor.facing=motion.facing;actor.phase=(actor.phase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);
   actor._stuck=motion.distance<.05?actor._stuck+dt:0;
   if(actor._stuck>.45){actor._path=[];actor._wait=.2+random()*.5;actor._stuck=0;}
  }
 }
 function draw(ctx,actor,time=elapsed){
  if(!renderer&&globalThis.window?.createCodaCharacterRenderer)renderer=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});
  if(!renderer||actor.hidden)return;ctx.save();ctx.globalAlpha*=Number.isFinite(actor.alpha)?actor.alpha:1;renderer.drawNPC(ctx,actor,time);ctx.restore();
 }
 return {update,get actors(){return visible();},draw,reset};
}
