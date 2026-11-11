import {segment,COLS,ROWS,TILE} from './model.mjs?v=door-price-2';

export const PLAYER_COLLISION_BIN=512,PLAYER_COLLISION_MARGIN=128;
const RADIUS=Symbol.for('coda.town.collisionRadius');
const WORLD_COLS=Math.ceil(COLS*TILE/PLAYER_COLLISION_BIN),WORLD_ROWS=Math.ceil(ROWS*TILE/PLAYER_COLLISION_BIN);
const MAX_REGULAR_BINS=64;
const finite=n=>Number.isFinite(n);
const overlap=(a,b)=>a.x0<=b.x1&&a.x1>=b.x0&&a.y0<=b.y1&&a.y1>=b.y0;

function objectBounds(o,a,radius){
 if(!a||!finite(a.w)||!finite(a.h))return null;
 const scale=o.scale||1,angle=(o.rotation||0)*Math.PI/180,C=Math.cos(angle),S=Math.sin(angle);
 const b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
 const point=(x,y)=>{const dx=(x-a.w/2)*scale,dy=(y-a.h)*scale,X=o.x+dx*C-dy*S,Y=o.y+dx*S+dy*C;b.x0=Math.min(b.x0,X);b.x1=Math.max(b.x1,X);b.y0=Math.min(b.y0,Y);b.y1=Math.max(b.y1,Y);};
 for(const p of a.polygons||[])for(const [x,y]of p)point(x,y);
 for(const r of a.boxes||[]){point(r.x,r.y);point(r.x+r.w,r.y);point(r.x+r.w,r.y+r.h);point(r.x,r.y+r.h);}
 if(!finite(b.x0))return null;
 // blocked() pads boxes in asset-local coordinates. Account for the same
 // ten pixels after scale/rotation, without adding a player/NPC foot radius.
 const pad=Math.max(10*Math.abs(scale),radius)*(Math.abs(C)+Math.abs(S))+1e-6;
 b.x0-=pad;b.x1+=pad;b.y0-=pad;b.y1+=pad;return b;
}
function assetSnapshot(a){return a?{ref:a,w:a.w,h:a.h,boxes:(a.boxes||[]).map(b=>[b.x,b.y,b.w,b.h]),polygons:(a.polygons||[]).map(p=>p.map(v=>[v[0],v[1]]))}:null;}
function sameAsset(old,a){
 if(!old||!a)return old===null&&!a;
 if(old.ref!==a||old.w!==a.w||old.h!==a.h||old.boxes.length!==(a.boxes?.length||0)||old.polygons.length!==(a.polygons?.length||0))return false;
 for(let i=0;i<old.boxes.length;i++){const b=a.boxes[i],v=old.boxes[i];if(v[0]!==b.x||v[1]!==b.y||v[2]!==b.w||v[3]!==b.h)return false;}
 for(let i=0;i<old.polygons.length;i++){const p=a.polygons[i],v=old.polygons[i];if(v.length!==p.length)return false;for(let j=0;j<p.length;j++)if(v[j][0]!==p[j][0]||v[j][1]!==p[j][1])return false;}
 return true;
}
function geometrySnapshot(doc,catalog){
 const assets=new Map(),objects=doc.objects.map(o=>{
  if(o.collision&&!o.mount&&!assets.has(o.asset))assets.set(o.asset,assetSnapshot(catalog.get(o.asset)));
  return {ref:o,asset:o.asset,x:o.x,y:o.y,scale:o.scale,rotation:o.rotation,collision:o.collision,mounted:!!o.mount};
 });
 return {objects,assets,edges:Object.entries(doc.edges).map(([key,e])=>({key,ref:e,gate:e.gate,open:e.open}))};
}
function sameGeometry(old,doc,catalog){
 if(!old||old.objects.length!==doc.objects.length)return false;
 for(let i=0;i<old.objects.length;i++){
  const a=old.objects[i],b=doc.objects[i];
  if(a.ref!==b||a.asset!==b.asset||a.x!==b.x||a.y!==b.y||a.scale!==b.scale||a.rotation!==b.rotation||a.collision!==b.collision||a.mounted!==!!b.mount)return false;
 }
 const keys=Object.keys(doc.edges);if(keys.length!==old.edges.length)return false;
 for(let i=0;i<keys.length;i++){const a=old.edges[i],b=doc.edges[keys[i]];if(a.key!==keys[i]||a.ref!==b||a.gate!==b.gate||a.open!==b.open)return false;}
 for(const [id,a]of old.assets)if(!sameAsset(a,catalog.get(id)))return false;
 return true;
}

/** A broad phase for the player's unchanged blocked()/movePlayer() calls.
 * Get one view at frame start; its 128px margin covers the maximum 31.2px
 * running frame, including a player starting directly on a bin boundary.
 *
 * getRevision is an authoritative editor revision. Without it, one geometry
 * validation per view catches direct edits; physics substeps never rescan it.
 */
export function createPlayerCollisionIndex({getProject,catalog,getRevision,maxViews=64}={}){
 const limit=Math.max(1,Math.min(128,Math.round(maxViews)||64)),bins=new Map(),views=new Map();
 let doc=null,objects=null,edges=null,revision,authoritative=false,initialized=false,snapshot=null,large=[],radius=0,catalogSize=0,objectCount=0;
 let builds=0,queries=0,hits=0,viewBuilds=0,geometryScans=0,indexedObjects=0,indexedEdges=0,sourceEdges=0,references=0,lastObjects=0,lastEdges=0;
 function register(record){
  const b=record.bounds,M=PLAYER_COLLISION_MARGIN,B=PLAYER_COLLISION_BIN;
  const x0=Math.max(0,Math.floor((b.x0-M)/B)),x1=Math.min(WORLD_COLS-1,Math.floor((b.x1+M)/B));
  const y0=Math.max(0,Math.floor((b.y0-M)/B)),y1=Math.min(WORLD_ROWS-1,Math.floor((b.y1+M)/B));
  if(x1<x0||y1<y0)return;
  if((x1-x0+1)*(y1-y0+1)>MAX_REGULAR_BINS){large.push(record);references++;return;}
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=x+','+y;let bin=bins.get(k);if(!bin){bin=[];bins.set(k,bin);}bin.push(record);references++;}
 }
 function rebuild(next,stamp,hasRevision){
  doc=next;objects=doc?.objects;edges=doc?.edges;revision=stamp;authoritative=hasRevision;initialized=true;
  radius=doc?.[RADIUS]||0;catalogSize=catalog?.size||0;objectCount=objects?.length||0;bins.clear();views.clear();large=[];snapshot=null;
  indexedObjects=0;indexedEdges=0;sourceEdges=0;references=0;lastObjects=0;lastEdges=0;builds++;
  if(!doc)return;
  for(const o of objects){if(o.mount||!o.collision)continue;const bounds=objectBounds(o,catalog.get(o.asset),radius);if(bounds){register({object:o,bounds});indexedObjects++;}}
  for(const [key,e]of Object.entries(edges)){
   const s=segment(key);register({key,edge:e,bounds:{x0:Math.min(s.x,s.x+s.dx)-14,y0:Math.min(s.y,s.y+s.dy)-14,x1:Math.max(s.x,s.x+s.dx)+14,y1:Math.max(s.y,s.y+s.dy)+14}});indexedEdges++;sourceEdges++;
  }
  if(!authoritative){snapshot=geometrySnapshot(doc,catalog);geometryScans++;}
 }
 function ensure(){
  const next=getProject?.()||null,stamp=getRevision?.(),hasRevision=typeof getRevision==='function'&&stamp!==undefined&&stamp!==null;
  if(!initialized||next!==doc||next?.objects!==objects||next?.edges!==edges||(next?.objects?.length||0)!==objectCount||stamp!==revision||hasRevision!==authoritative||(next?.[RADIUS]||0)!==radius||(catalog?.size||0)!==catalogSize){rebuild(next,stamp,hasRevision);}
  else if(doc&&!authoritative){geometryScans++;if(!sameGeometry(snapshot,doc,catalog))rebuild(doc,stamp,false);}
  return doc;
 }
 function view(player){
  queries++;if(!ensure())return null;
  if(!player||!finite(player.x)||!finite(player.y))return doc;
  const bx=Math.floor(player.x/PLAYER_COLLISION_BIN),by=Math.floor(player.y/PLAYER_COLLISION_BIN),key=bx+','+by;
  let result=views.get(key);if(result){views.delete(key);views.set(key,result);hits++;lastObjects=result.objects.length;lastEdges=Object.keys(result.edges).length;return result;}
  const B=PLAYER_COLLISION_BIN,M=PLAYER_COLLISION_MARGIN,bounds={x0:bx*B-M,y0:by*B-M,x1:(bx+1)*B+M,y1:(by+1)*B+M};
  const nearObjects=[],nearEdges=Object.create(null),records=bins.get(key)||[];
  for(const item of [...records,...large])if(overlap(item.bounds,bounds)){if(item.object)nearObjects.push(item.object);else nearEdges[item.key]=item.edge;}
  // Inherit the untouched cells, terrain flags and other document data live.
  // Only these two candidate lists differ; original placements are retained.
  result=Object.create(doc,{objects:{value:nearObjects,enumerable:true},edges:{value:nearEdges,enumerable:true}});
  views.set(key,result);while(views.size>limit)views.delete(views.keys().next().value);
  viewBuilds++;lastObjects=nearObjects.length;lastEdges=Object.keys(nearEdges).length;return result;
 }
 return {view,invalidate(){initialized=false;views.clear();bins.clear();large=[];snapshot=null;},get stats(){return {builds,queries,hits,viewBuilds,geometryScans,bins:bins.size,views:views.size,maxViews:limit,references,large:large.length,sourceObjects:objectCount,sourceEdges,indexedObjects,indexedEdges,candidateObjects:lastObjects,candidateEdges:lastEdges};}};
}
