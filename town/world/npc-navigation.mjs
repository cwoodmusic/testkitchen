import {blocked,surfaceAt,cell,segment,COLS,ROWS,TILE} from './model.mjs?v=interior-polish-1';
import {npcCollisionObject,npcCollisionProject,NPC_COLLISION_RADIUS,NPC_COLLISION_RADIUS_KEY} from './npc-collision.mjs?v=interior-polish-1';
export {npcCollisionProject} from './npc-collision.mjs?v=interior-polish-1';

const BIN=512,MARGIN=96,worldWidth=COLS*TILE,worldHeight=ROWS*TILE;
const center=(x,y)=>({x:x*TILE+TILE/2,y:y*TILE+TILE/2});
const tileOf=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=p=>valid(p)&&p.x>=20&&p.y>=20&&p.x<worldWidth-20&&p.y<worldHeight-20;
const tileId=p=>p.y*COLS+p.x;
const overlaps=(a,b)=>a.x0<=b.x1&&a.x1>=b.x0&&a.y0<=b.y1&&a.y1>=b.y0;
const now=()=>globalThis.performance?.now?.()??Date.now();

function heapPush(heap,item){let i=heap.length;heap.push(item);while(i){const parent=(i-1)>>1;if(heap[parent].score<=item.score)break;heap[i]=heap[parent];i=parent;}heap[i]=item;}
function heapPop(heap){const first=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let n=i*2+1;if(n+1<heap.length&&heap[n+1].score<heap[n].score)n++;if(heap[n].score>=tail.score)break;heap[i]=heap[n];i=n;}heap[i]=tail;}return first;}

function objectBounds(o,a){
 const points=[...(a.polygons||[]).flat(),...(a.boxes||[]).flatMap(b=>[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]])];
 if(!points.length)return null;
 const rotation=(o.rotation||0)*Math.PI/180,cos=Math.cos(rotation),sin=Math.sin(rotation),scale=o.scale||1;
 const b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
 for(const[x,y]of points){const dx=(x-a.w/2)*scale,dy=(y-a.h)*scale,X=o.x+dx*cos-dy*sin,Y=o.y+dx*sin+dy*cos;b.x0=Math.min(b.x0,X);b.x1=Math.max(b.x1,X);b.y0=Math.min(b.y0,Y);b.y1=Math.max(b.y1,Y);}
 // blocked() expands boxes by ten asset-space pixels. At maximum scale this
 // margin is larger than the actor radius, so account for both here.
 const pad=12*scale+16;b.x0-=pad;b.y0-=pad;b.x1+=pad;b.y1+=pad;return b;
}

// Each check retains the real terrain, stair and collision implementation.
// Broad-phase views change only which distant solid objects are considered.
export function npcConnectionClear(doc,catalog,from,to){
 doc=npcCollisionProject(doc,catalog);
 if(!inside(from)||!inside(to)||blocked(doc,from.x,from.y,catalog))return false;
 const a=cell(doc,Math.floor(from.x/TILE),Math.floor(from.y/TILE)),b=cell(doc,Math.floor(to.x/TILE),Math.floor(to.y/TILE));
 const steps=Math.max(1,Math.ceil(distance(from,to)/(a.stairs||b.stairs?1.5:4)));let previous=from;
 for(let i=1;i<=steps;i++){const q={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(blocked(doc,q.x,q.y,catalog,previous))return false;previous=q;}
 return true;
}

export function npcPavingAt(doc,catalog,p){
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
export const npcMaterialCost=s=>({sidewalk:1,cobble:1.05,wood:1.2,dirt:1.5,sand:1.6,brick:1.05,grass:2.1,asphalt:3.2})[s]||2;

function compactPath(points,from){
 const result=[];
 for(const p of points){const last=result.at(-1)||from;if(distance(last,p)<=.1)continue;const previous=result.length>1?result.at(-2):from;
  if(result.length&&Math.abs((last.x-previous.x)*(p.y-last.y)-(last.y-previous.y)*(p.x-last.x))<.001&&(last.x-previous.x)*(p.x-last.x)+(last.y-previous.y)*(p.y-last.y)>=0)result.pop();
  result.push(p);
 }
 return result;
}

// A navigator belongs to one running city. Routes and collision bins survive
// camera movement and are discarded only when authored geometry changes.
export function createNPCNavigator({getProject,catalog,getBounds,budgetMs=2,maxNodes=12000}={}){
 let doc=null,cells=null,revision,initialized=false,index=[];const views=new Map(),edges=new Map(),walkable=new Map(),costs=new Map(),pending=new Map();let queue=[],processed=0,completed=0,invalidations=0;
 function clear(next,stamp){
  const abandoned=[...pending.values()];pending.clear();queue=[];doc=next;cells=next?.cells;revision=stamp;initialized=true;views.clear();edges.clear();walkable.clear();costs.clear();index=[];invalidations++;
  if(doc){
   for(const original of doc.objects){const a=catalog.get(original.asset),o=npcCollisionObject(original,a);if(!o.collision||o.mount)continue;const bounds=a&&objectBounds(o,a);if(bounds)index.push({o,bounds});}
   for(const[k,e]of Object.entries(doc.edges)){const s=segment(k);index.push({k,e,bounds:{x0:s.x-20,y0:s.y-20,x1:s.x+s.dx+20,y1:s.y+s.dy+20}});}
  }
  for(const job of abandoned)if(!job.cancelled)job.callback?.([]);
 }
 function ensure(){const next=getProject?.();if(!initialized||next!==doc||next?.cells!==cells)clear(next,revision);return doc;}
 function invalidate(stamp){const next=getProject?.();if(!initialized||next!==doc||next?.cells!==cells||stamp!==revision)clear(next,stamp);}
 function collisionView(p){
  if(!ensure())return null;
  const bx=Math.floor(p.x/BIN),by=Math.floor(p.y/BIN),key=bx+','+by;let view=views.get(key);if(view)return view;
  const bounds={x0:bx*BIN-MARGIN,y0:by*BIN-MARGIN,x1:(bx+1)*BIN+MARGIN,y1:(by+1)*BIN+MARGIN},objects=[],nearEdges={};
  for(const item of index)if(overlaps(bounds,item.bounds)){if(item.o)objects.push(item.o);else nearEdges[item.k]=item.e;}
  view={...doc,objects,edges:nearEdges,[NPC_COLLISION_RADIUS_KEY]:NPC_COLLISION_RADIUS};views.set(key,view);return view;
 }
 function clearConnection(from,to){
  if(!inside(from)||!inside(to)||!ensure())return false;
  // Long endpoint joins may cross several bins. Sample each segment against
  // the bin at that point instead of using only the starting neighborhood.
  const first=collisionView(from);if(blocked(first,from.x,from.y,catalog))return false;
  const a=cell(doc,Math.floor(from.x/TILE),Math.floor(from.y/TILE)),b=cell(doc,Math.floor(to.x/TILE),Math.floor(to.y/TILE));
  const steps=Math.max(1,Math.ceil(distance(from,to)/(a.stairs||b.stairs?1.5:4)));let previous=from;
  for(let i=1;i<=steps;i++){const p={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(blocked(collisionView(p),p.x,p.y,catalog,previous))return false;previous=p;}
  return true;
 }
 function orthogonalJoin(from,to){
  if(Math.abs(from.x-to.x)<.01||Math.abs(from.y-to.y)<.01)return clearConnection(from,to)?[to]:null;
  for(const corner of [{x:to.x,y:from.y},{x:from.x,y:to.y}])if(clearConnection(from,corner)&&clearConnection(corner,to))return [corner,to];return null;
 }
 function tileClear(p){const id=tileId(p);if(!walkable.has(id)){const w=center(p.x,p.y);walkable.set(id,inside(w)&&!blocked(collisionView(w),w.x,w.y,catalog));}return walkable.get(id);}
 function edgeClear(a,b){const key=tileId(a)*(COLS*ROWS)+tileId(b);if(!edges.has(key))edges.set(key,clearConnection(center(a.x,a.y),center(b.x,b.y)));return edges.get(key);}
 function tileCost(p){const id=tileId(p);if(!costs.has(id))costs.set(id,npcMaterialCost(npcPavingAt(doc,catalog,center(p.x,p.y))));return costs.get(id);}
 function* search(from,to,options={}){
  if(!ensure()||!inside(from)||!inside(to)||blocked(collisionView(to),to.x,to.y,catalog))return [];
  const version=invalidations,startTile=tileOf(from),targetTile=tileOf(to),provided=getBounds?.()||{},bounds={x0:provided.x0??0,y0:provided.y0??0,x1:provided.x1??worldWidth,y1:provided.y1??worldHeight};
  const minX=Math.max(0,Math.floor(bounds.x0/TILE)),maxX=Math.min(COLS-1,Math.ceil(bounds.x1/TILE)-1),minY=Math.max(0,Math.floor(bounds.y0/TILE)),maxY=Math.min(ROWS-1,Math.ceil(bounds.y1/TILE)-1);
  const span=Number.isFinite(options.radius)?Math.max(1,Math.round(options.radius)):Infinity;
  const inBounds=p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY&&Math.abs(p.x-startTile.x)<=span&&Math.abs(p.y-startTile.y)<=span;
  // Crowds are temporary route preferences, not authored collision. Keep
  // these checks local to this search so shared walkability remains reusable.
  const avoid=(options.avoid||[]).filter(p=>valid(p)&&Number.isFinite(p.r)&&p.r>0&&distance(p,from)>18&&distance(p,to)>18);
  const clearForRoute=p=>{
   const w=center(p.x,p.y);
   return (tileId(p)===tileId(startTile)||tileId(p)===tileId(targetTile)||!avoid.some(a=>distance(w,a)<a.r))&&tileClear(p);
  };
  if(!inBounds(startTile)||!inBounds(targetTile))return [];
  const candidates=[];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const p={x:startTile.x+dx,y:startTile.y+dy};if(inBounds(p)&&clearForRoute(p))candidates.push({tile:p,world:center(p.x,p.y),d:distance(from,center(p.x,p.y))});yield;}
  candidates.sort((a,b)=>a.d-b.d);let start,prefix;
  for(const candidate of candidates){const join=orthogonalJoin(from,candidate.world);if(join){start=candidate.tile;prefix=join;break;}yield;}
  if(!start)return [];
  const goals=[];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const p={x:targetTile.x+dx,y:targetTile.y+dy};if(inBounds(p)&&clearForRoute(p))goals.push({tile:p,world:center(p.x,p.y),d:distance(to,center(p.x,p.y))});yield;}
  goals.sort((a,b)=>a.d-b.d);let goal,suffix;
  for(const candidate of goals){const join=orthogonalJoin(candidate.world,to);if(join){goal=candidate.tile;suffix=join;break;}yield;}
  if(!goal)return [];
  const records=new Map(),open=[],closed=new Set(),startId=tileId(start),goalId=tileId(goal),limit=options.maxNodes??maxNodes;
  const heuristic=p=>Math.abs(p.x-goal.x)+Math.abs(p.y-goal.y);
  records.set(startId,{tile:start,g:0,parent:null});heapPush(open,{id:startId,score:heuristic(start)});
  while(open.length&&closed.size<limit&&version===invalidations){
   const current=heapPop(open);if(closed.has(current.id))continue;closed.add(current.id);processed++;const record=records.get(current.id),p=record.tile;
   if(current.id===goalId){const reversed=[];let at=current.id;while(at!==startId){const item=records.get(at);reversed.push(center(item.tile.x,item.tile.y));at=item.parent;}return compactPath([...prefix,...reversed.reverse(),...suffix],from);}
   for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){
    const next={x:p.x+dx,y:p.y+dy};if(!inBounds(next))continue;const id=tileId(next);if(closed.has(id)||!clearForRoute(next)||!edgeClear(p,next))continue;
    const g=record.g+tileCost(next),old=records.get(id);if(old&&old.g<=g)continue;records.set(id,{tile:next,g,parent:current.id});heapPush(open,{id,score:g+heuristic(next)});
   }
   yield;
  }
  return [];
 }
 function plan(from,to,options){const gen=search(from,to,options);let result;do{result=gen.next();}while(!result.done);return result.value;}
 function cancel(id){const job=pending.get(id);if(job){job.cancelled=true;pending.delete(id);}}
 function request(id,from,to,callback,options={}){ensure();cancel(id);const job={id,from:{...from},to:{...to},callback,options,cancelled:false,gen:null};pending.set(id,job);queue.push(job);return job;}
 function update(options={}){
  ensure();const start=now(),budget=Math.max(0,options.budgetMs??budgetMs),maxSteps=options.maxSteps??160;let steps=0;
  while(queue.length&&steps<maxSteps&&(steps===0||now()-start<budget)){
   const job=queue.shift();if(job.cancelled||pending.get(job.id)!==job)continue;
   job.gen??=search(job.from,job.to,job.options);const result=job.gen.next();steps++;
   if(result.done){pending.delete(job.id);completed++;job.callback?.(result.value||[]);}else queue.push(job);
  }
  return steps;
 }
 return {invalidate,request,update,cancel,plan,collisionView,connectionClear:clearConnection,get stats(){return {pending:pending.size,bins:views.size,edges:edges.size,nodes:processed,completed,invalidations};}};
}

// Compatibility entry point for small standalone/local routing callers.
export function planNPCPath(doc,catalog,from,to,{radius=14,maxNodes=600}={}){
 return createNPCNavigator({getProject:()=>doc,catalog}).plan(from,to,{radius:Math.max(1,Math.min(24,Math.round(radius))),maxNodes});
}
