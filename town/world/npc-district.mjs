import {blocked,surfaceAt,COLS,ROWS,TILE} from './model.mjs?v=map-recovery-1';

const WORLD_W=COLS*TILE,WORLD_H=ROWS*TILE;
const cardinal=['down','left','up','right'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const scale=o=>Number.isFinite(o.scale)&&o.scale>0?o.scale:1;
const objectKey=o=>o.id||`${o.asset}:${o.x}:${o.y}`;
const inside=p=>valid(p)&&p.x>24&&p.y>24&&p.x<WORLD_W-24&&p.y<WORLD_H-24;
const paved=new Set(['cobble','sidewalk','brick','wood']);

// Bottom-center authored anchors match drawObject, collision and buildingDoor.
export function npcDistrictPoint(o,a,p){
 const r=(o.rotation||0)*Math.PI/180,s=scale(o),x=(p.x-a.w/2)*s,y=(p.y-a.h)*s;
 return {x:o.x+x*Math.cos(r)-y*Math.sin(r),y:o.y+x*Math.sin(r)+y*Math.cos(r)};
}
export function npcDistrictFacing(o,facing='down'){
 return cardinal[(cardinal.indexOf(facing)+Math.round((o.rotation||0)/90)+4)%4]||'down';
}
function nearestClear(doc,catalog,wanted,{radius=256,front=null}={}){
 const choices=[];
 for(let r=0;r<=radius;r+=32){
  const n=r?Math.max(8,Math.ceil(Math.PI*2*r/48)):1;
  for(let i=0;i<n;i++){
   const t=i*Math.PI*2/n,p={x:wanted.x+Math.cos(t)*r,y:wanted.y+Math.sin(t)*r};
   if(front&&(p.x-front.origin.x)*front.x+(p.y-front.origin.y)*front.y<0)continue;
   if(!inside(p)||blocked(doc,p.x,p.y,catalog))continue;
   const material=surfaceAt(doc,p.x,p.y),score=r+(paved.has(material)?0:material==='asphalt'?72:36);
   choices.push({...p,score});
  }
  if(choices.length&&r>=64)break;
 }
 choices.sort((a,b)=>a.score-b.score);
 const p=choices[0];return p?{x:p.x,y:p.y}:null;
}
const boundsOf=points=>({x0:Math.min(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),x1:Math.max(...points.map(p=>p.x)),y1:Math.max(...points.map(p=>p.y))});
const contains=(bounds,p)=>p.x>=bounds.x0&&p.x<=bounds.x1&&p.y>=bounds.y0&&p.y<=bounds.y1;
function footprintPoints(o,a){
 const b=a.footprint||{x:0,y:0,w:a.w,h:a.h};
 return [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].map(([x,y])=>npcDistrictPoint(o,a,{x,y}));
}
const benchIDs=new Set(['decor-06-01','decor-06-02','decor-06-03','props-1-150']);
const vendorNames={
 'decor-07-01':'Produce stall keeper','decor-07-02':'Bakery stall keeper','decor-07-03':'Flower stall keeper','decor-07-04':'Cheese stall keeper',
 'decor-07-05':'Fishmonger','decor-07-06':'Coffee cart host','decor-07-07':'Lemonade cart host','decor-07-08':'Chestnut cart host',
 'decor-13-05':'Festival booth host','decor-13-06':'Popcorn cart host','decor-13-07':'Candy cart host'
};

// Destinations follow placed buildings and furnishings. Camera position is
// deliberately absent: panning never creates a new neighbourhood or resident.
export function buildNPCDistrict(doc,catalog){
 const buildings=[],squares=[],vendors=[],extents=[];
 for(const o of doc.objects||[]){
  const a=catalog.get(o.asset);if(!a||o.mount)continue;
  const kind=a.urban==='tower'?'tower':a.urban==='shop'?'shop':o.asset==='coda-arcade'?'arcade':null;
  if(kind){
   const doorLocal=a.door||{x:a.w/2,y:a.h},door=npcDistrictPoint(o,a,doorLocal),preferred=npcDistrictPoint(o,a,{x:doorLocal.x,y:doorLocal.y+96});
   const approach=nearestClear(doc,catalog,preferred,{radius:384});
   if(approach)buildings.push({id:'building:'+objectKey(o),kind,objectId:objectKey(o),asset:o.asset,x:approach.x,y:approach.y,door,approach,facing:npcDistrictFacing(o)});
   extents.push(...footprintPoints(o,a),preferred);
  }else if(o.asset==='music-square')squares.push({o,a});
  const cartName=vendorNames[o.asset];
  if(cartName){
   // Opaque native counters/canopies would hide a person directly behind the
   // art. Stand alongside the serving end, with the greeting point in front.
   const wanted=npcDistrictPoint(o,a,{x:a.w+34/scale(o),y:a.h*.83});
   const stand=nearestClear(doc,catalog,wanted,{radius:192});
   const interaction=nearestClear(doc,catalog,npcDistrictPoint(o,a,{x:a.w*.78,y:a.h+88/scale(o)}),{radius:160});
   if(stand&&interaction)vendors.push({id:'vendor:'+objectKey(o),objectId:objectKey(o),name:cartName,cartName:a.name||cartName,asset:o.asset,...stand,facing:npcDistrictFacing(o),interaction});
  }
 }
 const fallback=valid(doc.spawn)?doc.spawn:{x:WORLD_W/2,y:WORLD_H/2};
 const core=buildings.length?{x:buildings.reduce((sum,p)=>sum+p.x,0)/buildings.length,y:buildings.reduce((sum,p)=>sum+p.y,0)/buildings.length}:{...fallback};
 // A detached square elsewhere on a large map should not draw this city's
 // residents onto a different island. Nearby squares remain valid hangouts.
 const localSquares=squares.filter(({o})=>!buildings.length||distance(o,core)<6400);
 for(const {o,a}of localSquares)extents.push(...footprintPoints(o,a));
 if(!extents.length)extents.push({x:fallback.x-1024,y:fallback.y-1024},{x:fallback.x+1024,y:fallback.y+1024});
 const raw=boundsOf(extents),bounds={x0:clamp(raw.x0-384,24,WORLD_W-24),y0:clamp(raw.y0-384,24,WORLD_H-24),x1:clamp(raw.x1+384,24,WORLD_W-24),y1:clamp(raw.y1+384,24,WORLD_H-24)};
 const anchors=[...buildings],benches=[];
 const addAnchor=(id,kind,objectId,wanted,radius=192)=>{
  const p=nearestClear(doc,catalog,wanted,{radius});
  if(p&&contains(bounds,p))anchors.push({id,kind,objectId,...p,approach:{...p}});
 };
 const addBench=(id,o,a,localSeat,localApproach)=>{
  const seat=npcDistrictPoint(o,a,localSeat),wanted=npcDistrictPoint(o,a,localApproach);
  if(!contains(bounds,seat))return;
  const vx=wanted.x-seat.x,vy=wanted.y-seat.y,length=Math.hypot(vx,vy)||1;
  const approach=nearestClear(doc,catalog,wanted,{radius:96,front:{origin:seat,x:vx/length,y:vy/length}});
  if(approach)benches.push({id,kind:'bench',objectId:objectKey(o),x:approach.x,y:approach.y,approach,seat,facing:npcDistrictFacing(o),depth:seat.y});
 };
 for(const {o,a}of localSquares){
  // Four cushion anchors occupy the two carved benches in the native 1536×1024
  // image. The walking approach is separate from the pictured seat cushion.
  for(const [i,x]of [360,426,1110,1176].entries())addBench(`square-seat:${objectKey(o)}:${i}`,o,a,{x:x/1536*a.w,y:186/1024*a.h},{x:x/1536*a.w,y:245/1024*a.h});
  for(const [i,[x,y]]of [[768,235],[430,540],[1100,540],[768,790]].entries())addAnchor(`square-hangout:${objectKey(o)}:${i}`,'plaza',objectKey(o),npcDistrictPoint(o,a,{x:x/1536*a.w,y:y/1024*a.h}));
 }
 for(const o of doc.objects||[]){
  const a=catalog.get(o.asset);if(!a||o.mount||!benchIDs.has(o.asset))continue;
  // Seated actor poses are anchored at the cushion/hip line; their feet
  // extend in front. The approach remains a normal collision-safe position.
  addBench('bench:'+objectKey(o),o,a,{x:a.w/2,y:a.h*.72},{x:a.w/2,y:a.h+56/scale(o)});
 }
 // Small clear gathering pockets beside each entrance provide short errands
 // and room for a pair to stop without occupying a door threshold.
 for(const b of buildings){
  const forward={down:{x:0,y:1},left:{x:-1,y:0},up:{x:0,y:-1},right:{x:1,y:0}}[b.facing],right={x:forward.y,y:-forward.x};
  for(const [i,offset]of [-240,240].entries())addAnchor(`hangout:${b.objectId}:${i}`,'hangout',b.objectId,{x:b.x+right.x*offset+forward.x*128,y:b.y+right.y*offset+forward.y*128},256);
 }
 if(!anchors.length){
  addAnchor('spawn:home','hangout',null,fallback,512);
  for(const [i,[dx,dy]]of [[-320,0],[320,0],[0,320],[0,-320]].entries())addAnchor('spawn:hangout:'+i,'hangout',null,{x:fallback.x+dx,y:fallback.y+dy},192);
 }
 return {center:core,bounds,anchors,benches,tower:buildings.find(b=>b.kind==='tower')||null,vendors};
}
