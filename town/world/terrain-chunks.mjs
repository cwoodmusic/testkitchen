import {terrainView} from './model.mjs?v=opera-parallax-1';
import {OverviewTerrainState,OVERVIEW_SCALE,OVERVIEW_PAD,WORLD_WIDTH,WORLD_HEIGHT,terrainBoundsForRect} from './overview-state.mjs?v=opera-parallax-1';

export const TERRAIN_CHUNK_SIZE=512,TERRAIN_CHUNK_PAD=4;
const defaultCanvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const overlaps=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
const world={x:-OVERVIEW_PAD,y:-OVERVIEW_PAD,w:WORLD_WIDTH+OVERVIEW_PAD*2,h:WORLD_HEIGHT+OVERVIEW_PAD*2};

export function terrainChunkScale(transform,opts={}){
 if(opts.terrainChunks===false||opts.overviewBake||opts.grid||opts.heightView&&opts.heightView!=='art'||Math.abs(transform.b)>1e-9||Math.abs(transform.c)>1e-9||transform.a<=OVERVIEW_SCALE+1e-9||Math.abs(transform.a-transform.d)>1e-9||transform.a>1+1e-9)return null;
 return transform.a>.25?1:.5;
}

export function visibleTerrainChunks(view,scale,{chunkSize=TERRAIN_CHUNK_SIZE,pad=TERRAIN_CHUNK_PAD}={}){
 const left=Math.max(world.x,view.x),right=Math.min(world.x+world.w,view.x+view.w),top=Math.max(world.y,view.y),bottom=Math.min(world.y+world.h,view.y+view.h);
 if(right<=left||bottom<=top)return [];
 const result=[];
 for(let y=Math.floor(top/chunkSize);y<Math.ceil(bottom/chunkSize);y++)for(let x=Math.floor(left/chunkSize);x<Math.ceil(right/chunkSize);x++){
  result.push({key:`${scale}:${x},${y}`,x:x*chunkSize,y:y*chunkSize,w:chunkSize,h:chunkSize,scale,pad});
 }
 return result;
}

// A sea cutout may be supplied by an organic edge rather than the cell's top.
// Inspect these nearby cells only when a static chunk is built, never per frame.
function containsSea(doc,bounds){
 for(let y=bounds.y0;y<bounds.y1;y++)for(let x=bounds.x0;x<bounds.x1;x++){
  const a=doc.cells[`${x},${y}`];if(!a)continue;
  if(a.surface==='water'&&a.level===0&&!a.stairs)return true;
  for(const q of a.curves||[]){
   const u=q.under||doc.cells[`${q.underX},${q.underY}`];
   const level=q.kind==='height'?Math.max(0,Math.min(8,(u?.level||0)+(q.lift||0))):a.level;
   if(u?.surface==='water'&&level===0)return true;
  }
 }
 return false;
}

const defaultRequestWork=globalThis.requestIdleCallback?
 callback=>globalThis.requestIdleCallback(callback,{timeout:120}):
 globalThis.requestAnimationFrame?callback=>globalThis.requestAnimationFrame(()=>callback({timeRemaining:()=>3,didTimeout:false})):null;
const defaultCancelWork=globalThis.cancelIdleCallback?handle=>globalThis.cancelIdleCallback(handle):handle=>globalThis.cancelAnimationFrame?.(handle);

export function createTerrainChunkCache({maxPixels=16*1024*1024,maxEntries=256,chunkSize=TERRAIN_CHUNK_SIZE,pad=TERRAIN_CHUNK_PAD,createCanvas=defaultCanvas,requestWork=defaultRequestWork,cancelWork=defaultCancelWork,now=()=>globalThis.performance?.now?.()??Date.now(),idleBudgetMs=2.5,prefetch=true}={}){
 const contexts=new WeakMap(),recent=new Map(),jobs=new Set();let pixels=0,workHandle=null;
 function forget(chunk){
  if(!recent.has(chunk))return;
  if(chunk.pending){chunk.owner.pending.delete(chunk.key);jobs.delete(chunk);try{chunk.steps.return?.();}catch{}chunk.owner.cancelled++;}
  else chunk.owner.chunks.delete(chunk.key);
  recent.delete(chunk);pixels-=chunk.pixels;
  // Release GPU/backing memory immediately; waiting for a future major GC left
  // entire previous towns alive after imports and long camera journeys.
  chunk.canvas.width=0;chunk.canvas.height=0;
 }
 function clear(e){for(const chunk of [...e.chunks.values(),...e.pending.values()])forget(chunk);e.generation++;}
 function cancelPending(e){for(const chunk of [...e.pending.values()])forget(chunk);e.generation++;}
 function entryFor(c){
  let e=contexts.get(c);if(!e){e={chunks:new Map(),pending:new Map(),generation:0,visible:new Set(),desired:new Set(),state:new OverviewTerrainState(),key:null,builds:0,syncBuilds:0,prefetchBuilds:0,prefetchSteps:0,cancelled:0,hits:0,scans:0,bypasses:0,livePatches:[],waterKey:null,waterImage:null,waterPattern:null,lastDoc:null,lastCells:null,lastRevision:null,lastFrame:null,lastDraw:0,lastView:null};contexts.set(c,e);}return e;
 }
 function reserve(e,wanted,count,chunkPixels,{soft=false}={}){
  for(const chunk of recent.keys()){
   if(pixels+count*chunkPixels<=maxPixels&&recent.size+count<=maxEntries)return true;
   if(chunk.owner===e&&(wanted.has(chunk.key)||soft&&(chunk.pending||e.desired.has(chunk.key))))continue;
   forget(chunk);
  }
  return pixels+count*chunkPixels<=maxPixels&&recent.size+count<=maxEntries;
 }
 function createJob(e,spec,doc,opts,raw,hooks,priority=0){
  const r={x:spec.x-pad,y:spec.y-pad,w:spec.w+pad*2,h:spec.h+pad*2},width=Math.ceil(r.w*spec.scale),height=Math.ceil(r.h*spec.scale),canvas=createCanvas(width,height),g=canvas.getContext('2d');
  g.setTransform(spec.scale,0,0,spec.scale,-r.x*spec.scale,-r.y*spec.scale);g.imageSmoothingEnabled=false;g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const bounds=terrainBoundsForRect(r);
  const paintOpts={...opts,overviewBake:true,terrainChunks:false};
  g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();g.clearRect(r.x,r.y,r.w,r.h);
  const steps=hooks.bakeSteps?hooks.bakeSteps(g,doc,bounds,paintOpts):(function*(){raw(g,doc,bounds,paintOpts);})();
  const chunk={...spec,owner:e,canvas,g,r,bounds,pixels:width*height,pending:true,steps,doc,cells:doc.cells,frame:e.lastFrame,generation:e.generation,hooks,priority};
  e.pending.set(spec.key,chunk);jobs.add(chunk);recent.set(chunk,true);pixels+=chunk.pixels;
  return chunk;
 }
 function step(chunk){
  let result;const advance=()=>{result=chunk.steps.next();return result;};
  if(chunk.hooks.withWaterCutout)chunk.hooks.withWaterCutout(chunk.g,advance);else advance();
  if(result.done){
   const e=chunk.owner;e.pending.delete(chunk.key);jobs.delete(chunk);chunk.pending=false;chunk.hasSea=containsSea(terrainView(chunk.doc),chunk.bounds);e.chunks.set(chunk.key,chunk);e.builds++;
   delete chunk.steps;delete chunk.doc;delete chunk.cells;delete chunk.hooks;delete chunk.g;
  }
  return result.done;
 }
 function finish(chunk){
  const e=chunk.owner;
  while(chunk.pending)step(chunk);
  e.syncBuilds++;return chunk;
 }
 function schedule(){
  if(workHandle!==null||!jobs.size||typeof requestWork!=='function')return;
  workHandle=requestWork(deadline=>{
   workHandle=null;const started=now(),validated=new Set();let steps=0,active=null;
   while(jobs.size&&now()-started<idleBudgetMs&&(steps===0||deadline.didTimeout||deadline.timeRemaining()>.75)){
    const chunk=active&&jobs.has(active)?active:[...jobs].sort((a,b)=>a.priority-b.priority)[0],e=chunk.owner;active=chunk;
    if(!validated.has(chunk)){
     if(e.generation!==chunk.generation||e.lastDoc!==chunk.doc||chunk.doc.cells!==chunk.cells||now()-e.lastDraw>2000||(chunk.hooks.frameKey?.(chunk.doc)||'')!==chunk.frame){forget(chunk);continue;}
     validated.add(chunk);
    }
    try{const done=step(chunk);e.prefetchSteps++;if(done)e.prefetchBuilds++;}catch{forget(chunk);}
    steps++;
   }
   schedule();
  });
 }
 function prefetchAround(e,view,scale,viewScale,doc,opts,raw,hooks){
  if(!prefetch||opts.terrainPrefetch===false||typeof requestWork!=='function'||!hooks.bakeSteps){if(e.pending.size)cancelPending(e);return;}
  const cx=view.x+view.w/2,cy=view.y+view.h/2,old=e.lastView,dx=old?cx-old.x:0,dy=old?cy-old.y:0,leadX=Math.abs(dx)>.01?Math.sign(dx)*chunkSize:0,leadY=Math.abs(dy)>.01?Math.sign(dy)*chunkSize:0;
  const ring={x:view.x-chunkSize+Math.min(0,leadX),y:view.y-chunkSize+Math.min(0,leadY),w:view.w+chunkSize*2+Math.abs(leadX),h:view.h+chunkSize*2+Math.abs(leadY)};
  let candidates=visibleTerrainChunks(ring,scale,{chunkSize,pad});
  // Builder overview uses the half-size raster, but walking switches to the
  // native raster. Warm that smaller walking viewport before the first step.
  if(scale<1){const ratio=Math.min(1,viewScale/.4),walking={x:cx-view.w*ratio/2,y:cy-view.h*ratio/2,w:view.w*ratio,h:view.h*ratio};candidates.push(...visibleTerrainChunks(walking,1,{chunkSize,pad}));}
  const unique=new Map(candidates.map(spec=>[spec.key,spec]));e.desired=new Set([...e.visible,...unique.keys()]);
  for(const chunk of [...e.pending.values()])if(!e.desired.has(chunk.key))forget(chunk);
  const distance=spec=>{const x=spec.x+spec.w/2-cx,y=spec.y+spec.h/2-cy;return Math.hypot(x,y)-(x*Math.sign(dx)+y*Math.sign(dy))*.4+(spec.scale!==scale?chunkSize*.5:0);};
  candidates=[...unique.values()].sort((a,b)=>distance(a)-distance(b));
  const chunkPixelsFor=spec=>Math.ceil((spec.w+pad*2)*spec.scale)*Math.ceil((spec.h+pad*2)*spec.scale);
  for(const spec of candidates){
   if(e.chunks.has(spec.key))continue;
   const pending=e.pending.get(spec.key);if(pending){pending.priority=distance(spec);continue;}
   if(!reserve(e,e.visible,1,chunkPixelsFor(spec),{soft:true}))continue;
   createJob(e,spec,doc,opts,raw,hooks,distance(spec));
  }
  e.lastView={x:cx,y:cy};schedule();
 }
 function drawChunk(c,chunk,t){
  // The padded artwork covers each rounded device edge. Adjacent chunks own
  // the same edge exactly once even while the camera is between source pixels.
  const left=Math.round(chunk.x*t.a+t.e),right=Math.round((chunk.x+chunk.w)*t.a+t.e),top=Math.round(chunk.y*t.d+t.f),bottom=Math.round((chunk.y+chunk.h)*t.d+t.f);
  if(right<=left||bottom<=top)return;
  c.save();c.setTransform(1,0,0,1,0,0);c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();c.setTransform(t);
  c.drawImage(chunk.canvas,chunk.r.x,chunk.r.y,chunk.r.w,chunk.r.h);c.restore();
 }
 function draw(c,doc,_bounds,opts={},raw,hooks={}){
  const t=c.getTransform(),scale=terrainChunkScale(t,opts);
  if(scale===null||c.globalAlpha!==1||c.globalCompositeOperation!=='source-over')return false;
  const view={x:-t.e/t.a,y:-t.f/t.d,w:c.canvas.width/t.a,h:c.canvas.height/t.d},specs=visibleTerrainChunks(view,scale,{chunkSize,pad}),chunkPixels=Math.ceil((chunkSize+pad*2)*scale)**2;
  // Never build a working set that evicts its own first tile on every frame.
  if(specs.length>maxEntries||specs.length*chunkPixels>maxPixels){entryFor(c).bypasses++;return false;}
  const e=entryFor(c),frame=hooks.frameKey?.(doc)||'',revision=opts.terrainRevision,reuse=Number.isFinite(revision)&&e.lastDoc===doc&&e.lastCells===doc.cells&&e.lastRevision===revision&&e.lastFrame===frame;
  const changes=reuse?{first:false,changed:[],paints:[],dirty:null}:e.state.scan(doc),versionChanged=e.lastDoc!==doc||e.lastCells!==doc.cells||e.lastRevision!==revision||e.lastFrame!==frame||changes.changed.length>0;
  if(!reuse)e.scans++;
  if(versionChanged)cancelPending(e);
  e.lastDoc=doc;e.lastCells=doc.cells;e.lastRevision=revision;e.lastFrame=frame;
  e.lastDraw=now();
  if(changes.paints.length)hooks.invalidateGround?.(doc,changes.paints);
  if(e.key!==frame||changes.first)clear(e);
  else if(changes.dirty)for(const chunk of [...e.chunks.values()])if(overlaps(chunk.r,changes.dirty))forget(chunk);
  if(changes.first||changes.changed.length)e.livePatches=e.state.livePatches();
  e.key=frame;
  const wanted=new Set(specs.map(spec=>spec.key)),missing=specs.filter(spec=>!e.chunks.has(spec.key)&&!e.pending.has(spec.key)).length;e.visible=wanted;
  // Reserve the new viewport before allocating, without evicting a tile that
  // this same frame still needs. Memory stays bounded during a large pan too.
  reserve(e,wanted,missing,chunkPixels);
  const chunks=[];
  for(const spec of specs){
   let chunk=e.chunks.get(spec.key);
   if(chunk){e.hits++;recent.delete(chunk);recent.set(chunk,true);}else chunk=finish(e.pending.get(spec.key)||createJob(e,spec,doc,opts,raw,hooks));
   chunks.push(chunk);
  }
  while(recent.size>maxEntries||pixels>maxPixels){const oldest=recent.keys().next().value;if(!oldest)break;forget(oldest);}
  c.save();c.imageSmoothingEnabled=false;
  if(chunks.some(chunk=>chunk.hasSea)&&hooks.waterImage){
   const key=hooks.waterKey?.(),image=hooks.waterImage();
   if(!e.waterPattern||e.waterKey!==key||e.waterImage!==image){e.waterPattern=c.createPattern(image,'repeat');e.waterKey=key;e.waterImage=image;}
   c.fillStyle=e.waterPattern;c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  }
  for(const chunk of chunks)drawChunk(c,chunk,t);
  // Raised lakes keep live water and projected north/south occlusion. A patch
  // redraw contains every terrain row that can contribute to its screen area.
  for(const r of e.livePatches)if(overlaps(r,view)){
   c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle='#101f19';c.fillRect(r.x,r.y,r.w,r.h);raw(c,doc,terrainBoundsForRect(r),opts);c.restore();
  }
  c.restore();prefetchAround(e,view,scale,t.a,doc,opts,raw,hooks);return true;
 }
 return {draw,stats(c){const e=contexts.get(c);return e?{builds:e.builds,syncBuilds:e.syncBuilds,prefetchBuilds:e.prefetchBuilds,prefetchSteps:e.prefetchSteps,pending:e.pending.size,cancelled:e.cancelled,hits:e.hits,scans:e.scans,bypasses:e.bypasses,chunks:e.chunks.size,livePatches:e.livePatches.length,pixels,size:recent.size}:null;},invalidate(c){const e=contexts.get(c);if(e){clear(e);e.key=null;e.lastDoc=null;}if(!jobs.size&&workHandle!==null){cancelWork?.(workHandle);workHandle=null;}}};
}

const cache=createTerrainChunkCache();
export const drawTerrainChunks=(...args)=>cache.draw(...args);
export const terrainChunkStats=c=>cache.stats(c);
export const invalidateTerrainChunks=c=>cache.invalidate(c);
