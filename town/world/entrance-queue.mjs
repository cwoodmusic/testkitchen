import {blocked,COLS,ROWS,TILE} from './model.mjs?v=queues-stage-1';
import {npcCollisionProject} from './npc-collision.mjs?v=queues-stage-1';
import {npcConnectionClear} from './npc-navigation.mjs?v=queues-stage-1';

const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const copy=p=>({x:p.x,y:p.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const outward={down:{x:0,y:1},left:{x:-1,y:0},up:{x:0,y:-1},right:{x:1,y:0}};
const opposite={down:'up',up:'down',left:'right',right:'left'};
const add=(p,f,r,forward,lateral)=>({x:p.x+f.x*forward+r.x*lateral,y:p.y+f.y*forward+r.y*lateral});

// Queue geometry comes only from authored entrances and static collision.
// Incoming pedestrians wait in one lane; the other lane stays open for exits.
// Call clear()/invalidate() after an authored geometry change, never for pans.
export function createEntranceQueues({getEntrances,getProject,catalog,pointClear,connectionClear,capacity=3,spacing=86,laneOffset=36,exitCapacity=18}={}){
 const queues=new Map(),members=new Map(),exits=new Map(),exitWaiters=new Map(),layouts=new Map();
 const limit=Math.max(1,Math.floor(capacity)),gap=Math.max(72,Number(spacing)||86),lane=Math.max(36,Number(laneOffset)||36);
 const exitLimit=Math.max(1,Math.min(18,Math.floor(exitCapacity)||18));
 let doc=null,view=null,cells=null;
 function project(){const next=getProject?.();if(next!==doc||next?.cells!==cells){doc=next;cells=next?.cells;view=next&&catalog?npcCollisionProject(next,catalog):next;}return view;}
 function entrances(){const value=typeof getEntrances==='function'?getEntrances():getEntrances;return value instanceof Map?[...value.values()]:Array.isArray(value)?value:[];}
 function entrance(id){if(id&&typeof id==='object')return id;return entrances().find(e=>e.id===id||e.objectId===id)||null;}
 function clearPoint(p){
  if(!valid(p)||p.x<24||p.y<24||p.x>COLS*TILE-24||p.y>ROWS*TILE-24)return false;
  if(pointClear)return !!pointClear(p);
  const d=project();return !d||!catalog||!blocked(d,p.x,p.y,catalog);
 }
 function direct(a,b){
  if(!clearPoint(a)||!clearPoint(b))return false;
  if(pointClear){const n=Math.max(1,Math.ceil(distance(a,b)/8));for(let i=1;i<n;i++)if(!clearPoint({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;}
  if(connectionClear)return !!connectionClear(a,b);const d=project();return !d||!catalog||npcConnectionClear(d,catalog,a,b);
 }
 function connected(a,b){
  if(direct(a,b))return true;
  for(const c of [{x:b.x,y:a.y},{x:a.x,y:b.y}])if(direct(a,c)&&direct(c,b))return true;
  return false;
 }
 function makeLayout(e){
  const door=valid(e.threshold)?e.threshold:valid(e.approach)?e.approach:e;
  if(!valid(door)||!clearPoint(door))return null;
  const facing=outward[e.facing]?e.facing:'down',f=outward[facing],r={x:f.y,y:-f.x};
  const build=(offset,sign)=>{
   const entry=add(door,f,r,0,offset*sign),exit=add(door,f,r,0,-offset*sign);
   if(!clearPoint(entry)||!clearPoint(exit)||!connected(door,entry)||!connected(door,exit))return null;
   let exitClear=null;
   for(const run of [180,144,108]){const p=add(exit,f,r,run,0);if(clearPoint(p)&&connected(exit,p)){exitClear=p;break;}}
   if(!exitClear)return null;
   const slots=[];
   for(let i=0;i<limit;i++){
    const p=add(door,f,r,gap*(i+1),offset*sign);
    if(!clearPoint(p)||!connected(i?slots[i-1]:entry,p))break;
    slots.push(p);
   }
   if(!slots.length)return null;
   return {entranceId:e.id||e.objectId,facing,door:copy(door),artDoor:valid(e.door)?copy(e.door):copy(door),entry,exit,exitClear,slots,capacity:slots.length,spacing:gap,laneOffset:offset,shared:false,corridorRun:0,corridorEnd:null,exitVia:[],exitRoute:[copy(exit),copy(exitClear)]};
  };
  // A blocked tail shortens the line. Try the nearest safe parallel lanes
  // before falling back to a shared doorway with the waiting line to its side.
  let best=null;
  for(const offset of [...new Set([lane,lane+12,lane+28])])for(const sign of [-1,1]){
   const candidate=build(offset,sign);if(candidate&&(!best||candidate.capacity>best.capacity))best=candidate;
   if(best?.capacity===limit)return best;
  }
  if(best)return best;
  // A single-width frontage is an exclusive transit corridor, never a place
  // to stand in line. Keep every waiting position beyond the turn, and make
  // exiting walkers leave its centerline before releasing their door claim.
  for(const run of [180,216,258,300,344,430]){
   const corridorEnd=add(door,f,r,run,0);if(!direct(door,corridorEnd))continue;
   let exitClear=null;
   for(const offset of [...new Set([gap,gap+24,gap+48,gap*2])]){
    for(const sign of [1,-1]){const p=add(corridorEnd,f,r,0,offset*sign);if(direct(corridorEnd,p)){exitClear=p;break;}}
    if(exitClear)break;
   }
   if(!exitClear)continue;
   const slots=[];
   for(let i=0;i<limit;i++){
    const point=add(door,f,r,run+gap*(i+1),0);
    if(!direct(i?slots[i-1]:corridorEnd,point))break;
    slots.push(point);
   }
   if(!slots.length)continue;
   const entry=copy(door),exit=copy(door),candidate={entranceId:e.id||e.objectId,facing,door:copy(door),artDoor:valid(e.door)?copy(e.door):copy(door),entry,exit,exitClear,slots,capacity:slots.length,spacing:gap,laneOffset:0,shared:true,corridorRun:run,corridorEnd,exitVia:[copy(corridorEnd)],exitRoute:[copy(exit),copy(corridorEnd),copy(exitClear)]};
   if(!best||candidate.capacity>best.capacity)best=candidate;
   if(best.capacity===limit)return best;
  }
  return best;
 }
 function getLayout(id){
  const e=entrance(id);if(!e)return null;
  const d=getProject?.(),key=e.id||e.objectId,signature=[e.threshold?.x,e.threshold?.y,e.approach?.x,e.approach?.y,e.x,e.y,e.facing].join('|'),old=layouts.get(key);
  if(old&&old.entrance===e&&old.signature===signature&&old.doc===d&&old.cells===d?.cells)return old.layout;
  const layout=makeLayout(e);layouts.set(key,{entrance:e,signature,doc:d,cells:d?.cells,layout});return layout;
 }
 function state(id){let q=queues.get(id);if(!q){q={ids:[],active:null,exiting:null,pendingExits:[]};queues.set(id,q);}return q;}
 function request(id,entranceId){
  if(typeof id!=='string'||!id||exits.has(id)||exitWaiters.has(id))return false;
  const layout=getLayout(entranceId);if(!layout)return false;
  const existing=members.get(id);if(existing===layout.entranceId)return true;
  const q=state(layout.entranceId),waiting=q.ids.length-(q.active?1:0);if(waiting>=layout.capacity)return false;
  // Keep the old place if admission to a new entrance fails.
  if(existing)release(id);
  q.ids.push(id);members.set(id,layout.entranceId);return true;
 }
 function release(id){
  let changed=false;
  const entranceId=members.get(id);
  if(entranceId){const q=queues.get(entranceId);if(q){q.ids=q.ids.filter(value=>value!==id);if(q.active===id)q.active=null;}members.delete(id);changed=true;}
  const exitId=exits.get(id);
  if(exitId){const q=queues.get(exitId);if(q?.exiting===id)q.exiting=null;exits.delete(id);changed=true;}
  const waitingId=exitWaiters.get(id);
  if(waitingId){const q=queues.get(waitingId);if(q)q.pendingExits=q.pendingExits.filter(value=>value!==id);exitWaiters.delete(id);changed=true;}
  return changed;
 }
 function claim(id,position,tolerance=20){
  const entranceId=members.get(id),q=queues.get(entranceId),layout=getLayout(entranceId);if(!q||!layout||q.ids[0]!==id)return false;
  if(q.active===id)return true;
  if(q.active||layout.shared&&(q.exiting||q.pendingExits.length))return false;
  if(position&&(!valid(position)||distance(position,layout.slots[0])>tolerance))return false;
  q.active=id;return true;
 }
 function claimExit(id,entranceId){
  if(typeof id!=='string'||!id||members.has(id))return false;
  const layout=getLayout(entranceId);if(!layout)return false;
  const q=state(layout.entranceId);
  if(q.exiting===id)return true;
  // Register intent even while an incoming pedestrian owns the narrow door.
  // The next incoming head must yield to this FIFO, regardless of actor order.
  if(exitWaiters.get(id)!==layout.entranceId){
   if(q.pendingExits.length>=exitLimit)return false;
   if(exits.has(id)||exitWaiters.has(id))release(id);
   q.pendingExits.push(id);exitWaiters.set(id,layout.entranceId);
  }
  if(q.exiting||layout.shared&&q.active||q.pendingExits[0]!==id)return false;
  q.pendingExits.shift();exitWaiters.delete(id);q.exiting=id;exits.set(id,layout.entranceId);return true;
 }
 function target(id){
  if(exitWaiters.has(id)){if(!getLayout(exitWaiters.get(id)))release(id);return null;}
  const entranceId=members.get(id)||exits.get(id),layout=getLayout(entranceId),q=queues.get(entranceId);if(!layout||!q){release(id);return null;}
  const base={id,entranceId,door:copy(layout.door),entry:copy(layout.entry),exit:copy(layout.exit),exitClear:copy(layout.exitClear),exitVia:layout.exitVia.map(copy),exitRoute:layout.exitRoute.map(copy),corridorEnd:layout.corridorEnd?copy(layout.corridorEnd):null,corridorRun:layout.corridorRun,shared:layout.shared};
  if(exits.has(id))return {...base,index:-1,slotIndex:-1,head:true,active:true,waiting:false,direction:'out',point:copy(layout.exitClear),facing:layout.facing};
  const index=q.ids.indexOf(id);if(index<0)return null;
  const active=q.active===id,slotIndex=index-(q.active?1:0);
  if(!active&&!layout.slots[slotIndex]){release(id);return null;}
  return {...base,index,slotIndex:active?-1:slotIndex,head:index===0,active,waiting:!active,direction:'in',point:copy(active?layout.entry:layout.slots[slotIndex]),facing:opposite[layout.facing]};
 }
 function publicLayout(id){const l=getLayout(id);return l?{...l,door:copy(l.door),artDoor:copy(l.artDoor),entry:copy(l.entry),exit:copy(l.exit),exitClear:copy(l.exitClear),exitVia:l.exitVia.map(copy),exitRoute:l.exitRoute.map(copy),corridorEnd:l.corridorEnd?copy(l.corridorEnd):null,slots:l.slots.map(copy)}:null;}
 function inspect(id){const e=entrance(id),q=e&&queues.get(e.id||e.objectId);return q?[...q.ids,...(q.exiting?[q.exiting]:[])].map(target).filter(Boolean):[];}
 function clear(){queues.clear();members.clear();exits.clear();exitWaiters.clear();layouts.clear();doc=null;view=null;cells=null;}
 function invalidate(){layouts.clear();doc=null;view=null;cells=null;}
 return {request,release,claim,claimExit,target,layout:publicLayout,inspect,clear,invalidate,get size(){return members.size+exits.size;},get pendingExitCount(){return exitWaiters.size;}};
}
