import {PARALLEL_ART_PATCHES} from './parallel-art-data.mjs?v=town-front-facing-2';
import {correctedArtMotion} from './parallel-art-motion.mjs?v=town-front-facing-2';
import {furnitureFootCenter} from './furniture-facing.mjs?v=opera-parallax-1';

const directions=['south','west','north','east'];
const metadataOptions=Object.freeze({image:false});
const previewOptions=Object.freeze({native:false});
const settled=Promise.resolve();
const positive=n=>Number.isFinite(n)&&n>0;
const size=image=>({w:image?.naturalWidth||image?.width||0,h:image?.naturalHeight||image?.height||0});
const keyFor=(id,facing='south')=>id+'|'+facing;
const sourceDescriptor=()=>({image:null,sx:0,sy:0,sw:0,sh:0,dx:0,dy:0,dw:0,dh:0,native:false,quality:'pending',revision:0});
const base=new URL('../assets/parallel-art/',import.meta.url);
function assetURL(file){const url=new URL(file,base);url.search=new URL(import.meta.url).search;return url.href;}
async function browserImage(file){
 const url=assetURL(file);
 if(typeof fetch==='function'&&typeof createImageBitmap==='function'){
  const response=await fetch(url);if(!response.ok)throw Error('Parallel artwork could not load: '+url+' ('+response.status+')');
  return createImageBitmap(await response.blob());
 }
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=async()=>{image.onload=image.onerror=null;try{if(typeof image.decode==='function')await image.decode();resolve(image);}catch(error){reject(error);}};
  image.onerror=()=>{image.onload=image.onerror=null;reject(Error('Parallel artwork could not load: '+url));};image.src=url;
 });
}
function releaseImage(image){try{if(typeof image?.close==='function')image.close();else image?.removeAttribute?.('src');}catch{}}
function drawSource(ctx,source){
 if(!source?.image)return false;
 ctx.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh);return true;
}
function rect(value,label,tolerance=0){
 if(!value||![value.x,value.y,value.w,value.h].every(Number.isFinite)||value.x< -tolerance||value.y< -tolerance||!positive(value.w)||!positive(value.h))throw Error('Invalid parallel artwork '+label+'.');
 return {x:value.x,y:value.y,w:value.w,h:value.h};
}
function sourceSpec(value,label){
 if(!value||typeof value.file!=='string'||!value.file.trim()||![value.width,value.height].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Invalid parallel artwork source: '+label);
 const crop=rect({x:value.x??0,y:value.y??0,w:value.w??value.width,h:value.h??value.height},'crop: '+label);
 if(!Object.values(crop).every(Number.isSafeInteger)||crop.x+crop.w>value.width||crop.y+crop.h>value.height)throw Error('Parallel artwork crop exceeds source: '+label);
 return {file:value.file,width:value.width,height:value.height,...crop};
}

/**
 * Overlay accepted native art without changing catalog identity or physics.
 * Construction is metadata-only. Native atlases, exact-pixel crop canvases,
 * compatibility canvases and compact previews each have explicit budgets.
 */
export function createParallelArtRuntime(catalog,{
 patches=PARALLEL_ART_PATCHES,loadImage=browserImage,createCanvas=()=>document.createElement('canvas'),
 maxSources=16,maxSourcePixels=32*1024*1024,maxConcurrentLoads=4,
 maxCanvases=96,maxCanvasPixels=4*1024*1024,maxPreviewSources=2,maxPreviewPixels=4*1024*1024,
 now=()=>globalThis.performance?.now?.()??Date.now(),nativeIdleMs=250
}={}){
 if(!(catalog instanceof Map)||!Array.isArray(patches))throw TypeError('Parallel artwork needs a catalog Map and patch array.');
 const limit=(n,fallback)=>positive(n)?Math.max(1,Math.floor(n)):fallback;
 maxSources=limit(maxSources,16);maxSourcePixels=limit(maxSourcePixels,32*1024*1024);maxConcurrentLoads=limit(maxConcurrentLoads,4);
 maxCanvases=limit(maxCanvases,96);maxCanvasPixels=limit(maxCanvasPixels,4*1024*1024);maxPreviewSources=limit(maxPreviewSources,2);maxPreviewPixels=limit(maxPreviewPixels,4*1024*1024);
 nativeIdleMs=limit(nativeIdleMs,250);
 const records=new Map(),assets=new Map(),sources=new Map(),nativeLRU=new Map(),previewLRU=new Map(),canvasLRU=new Map(),queue=[];
 let nativePixels=0,previewPixels=0,canvasPixels=0,activeLoads=0,generation=0,sourceLoads=0,previewLoads=0,canvasBuilds=0,nativeHead=null,nativeTail=null;
 const touch=(map,key,value)=>{map.delete(key);map.set(key,value);return value;};

 function capture(asset){
  if(assets.has(asset.id))return assets.get(asset.id);
  const original={asset,draw:asset.draw,canvas:Object.getOwnPropertyDescriptor(asset,'canvas'),view:asset.getFacingView,image:asset.getFacingImage,source:asset.getFacingDrawSource,ensure:asset.ensureFull,motion:asset.motion,motionDescriptor:Object.getOwnPropertyDescriptor(asset,'motion'),fallback:sourceDescriptor(),facings:new Map(),fallbackBuilding:false,fallbackSourceReading:false,canvasReading:false};
  if(original.canvas?.configurable===false)throw Error('Parallel artwork cannot replace a fixed canvas: '+asset.id);
  assets.set(asset.id,original);return original;
 }
 function sourceFor(spec,kind){
  const key=kind+'|'+spec.file,old=sources.get(key);
  if(old){if(old.width!==spec.width||old.height!==spec.height)throw Error('Parallel artwork source dimensions disagree: '+spec.file);return old;}
  const pixels=spec.width*spec.height,budget=kind==='preview'?maxPreviewPixels:maxSourcePixels;
  if(!Number.isSafeInteger(pixels)||pixels>budget)throw Error('Parallel artwork source exceeds '+kind+' pixel budget: '+spec.file);
  const state={key,kind,file:spec.file,width:spec.width,height:spec.height,pixels,records:new Set(),pending:null,autoFailed:false,autoEvicted:false,lastDemandAt:-Infinity,nextAdmissionAt:0,previous:null,next:null};sources.set(key,state);return state;
 }
 // Validate everything before changing the public catalog.
 for(const patch of patches){
  const asset=catalog.get(patch?.id),facing=patch?.facing??'south',key=keyFor(patch?.id,facing);
  if(!asset||!directions.includes(facing)||records.has(key))throw Error('Unknown or duplicate parallel artwork: '+key);
  const original=capture(asset),oldView=typeof original.view==='function'?original.view.call(asset,facing,metadataOptions):null;
  if(!oldView&&facing!=='south')throw Error('Parallel artwork cannot invent an unauthored facing: '+key);
  const view=oldView??{id:asset.id,w:asset.w,h:asset.h,footCenter:furnitureFootCenter(asset),facing:'south'};
  if(!positive(view.w)||!positive(view.h))throw Error('Invalid original parallel artwork view: '+key);
  const native=sourceSpec(patch,key),draw=rect(patch.draw,'world draw rectangle: '+key,1e-7);
  if(draw.x+draw.w>view.w+1e-7||draw.y+draw.h>view.h+1e-7)throw Error('Parallel artwork leaves its original view: '+key);
  if(native.w*native.h>maxCanvasPixels||Math.ceil(view.w)*Math.ceil(view.h)>maxCanvasPixels)throw Error('Parallel artwork crop or compatibility canvas exceeds pixel budget: '+key);
  const preview=patch.preview?sourceSpec(patch.preview,key+' preview'):null,previewDraw=preview&&patch.preview.draw?rect(patch.preview.draw,'preview world rectangle: '+key,1e-7):draw;
  if(previewDraw.x+previewDraw.w>view.w+1e-7||previewDraw.y+previewDraw.h>view.h+1e-7)throw Error('Parallel preview leaves its original view: '+key);
  const record={key,nativeKey:key+'|native',envelopeKey:key+'|envelope',fallbackKey:key+'|fallback',id:asset.id,facing,original,oldView:view,native,draw,preview,previewDraw,
   nativeDescriptor:sourceDescriptor(),directDescriptor:sourceDescriptor(),previewDescriptor:sourceDescriptor(),envelopeDescriptor:sourceDescriptor(),fallbackDescriptor:sourceDescriptor(),view:null};
  record.originalMotion=view.motion??(facing==='south'?original.motion:null);
  record.correctedMotion=correctedArtMotion(record.originalMotion,patch.motionGeometry);
  if(record.correctedMotion&&facing==='south'&&original.motionDescriptor?.configurable===false)throw Error('Edited artwork cannot replace a fixed motion descriptor: '+key);
  record.nativeState=sourceFor(native,'native');record.nativeState.records.add(record);
  if(preview){record.previewState=sourceFor(preview,'preview');record.previewState.records.add(record);}
  records.set(key,record);original.facings.set(facing,record);
 }

 function invalidate(descriptor){if(descriptor.image){descriptor.image=null;descriptor.native=false;descriptor.quality='pending';descriptor.revision++;}}
 function removeCanvas(key){
  const cached=canvasLRU.get(key);if(!cached)return;
  canvasLRU.delete(key);canvasPixels-=cached.pixels;
  invalidate(cached.kind==='native'?cached.record.nativeDescriptor:cached.kind==='fallback'?cached.record.fallbackDescriptor:cached.record.envelopeDescriptor);
  cached.canvas.width=cached.canvas.height=1;
 }
 function admitCanvas(record,kind,canvas,source=null){
  const key=kind==='native'?record.nativeKey:kind==='fallback'?record.fallbackKey:record.envelopeKey,pixels=canvas.width*canvas.height;
  if(!Number.isSafeInteger(pixels)||pixels>maxCanvasPixels){canvas.width=canvas.height=1;throw Error('Parallel artwork exceeds canvas pixel budget: '+record.key);}
  removeCanvas(key);
  while(canvasLRU.size>=maxCanvases||canvasPixels+pixels>maxCanvasPixels)removeCanvas(canvasLRU.keys().next().value);
  const entry={record,kind,canvas,pixels,source,sourceRevision:source?.revision};canvasLRU.set(key,entry);canvasPixels+=pixels;canvasBuilds++;return entry;
 }
 function compileNative(record,image){
  const key=record.nativeKey,old=canvasLRU.get(key);if(old)return touch(canvasLRU,key,old).canvas;
  const canvas=createCanvas();canvas.width=record.native.w;canvas.height=record.native.h;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,record.native.x,record.native.y,record.native.w,record.native.h,0,0,canvas.width,canvas.height);
  admitCanvas(record,'native',canvas);
  const d=record.nativeDescriptor,r=record.draw;
  Object.assign(d,{image:canvas,sx:0,sy:0,sw:canvas.width,sh:canvas.height,dx:r.x,dy:r.y,dw:r.w,dh:r.h,native:true,quality:'parallel-native',revision:d.revision+1});return canvas;
 }
 function unlinkNative(state){
  if(state.previous)state.previous.next=state.next;else if(nativeHead===state)nativeHead=state.next;
  if(state.next)state.next.previous=state.previous;else if(nativeTail===state)nativeTail=state.previous;
  state.previous=state.next=null;
 }
 function touchNative(state){
  if(nativeTail===state)return;unlinkNative(state);state.previous=nativeTail;
  if(nativeTail)nativeTail.next=state;else nativeHead=state;nativeTail=state;
 }
 function admitWarmNative(state,time){
  if(!state.autoEvicted)return true;
  if(nativeLRU.size<maxSources&&nativePixels+state.pixels<=maxSourcePixels)return true;
  // An unchanged crowded roster never scans or decodes again. A camera move
  // lets old demand expire; only then inspect a bounded idle LRU prefix.
  if(!nativeHead||time-nativeHead.lastDemandAt<nativeIdleMs||time<state.nextAdmissionAt)return false;
  state.nextAdmissionAt=time+100;
  let entries=nativeLRU.size,pixels=nativePixels;
  for(let candidate=nativeHead;candidate&&time-candidate.lastDemandAt>=nativeIdleMs;candidate=candidate.next){
   entries--;pixels-=candidate.pixels;
   if(entries<maxSources&&pixels+state.pixels<=maxSourcePixels)return true;
  }
  return false;
 }
 function trimSources(kind){
  const lru=kind==='preview'?previewLRU:nativeLRU,entries=kind==='preview'?maxPreviewSources:maxSources,budget=kind==='preview'?maxPreviewPixels:maxSourcePixels;
  while(lru.size>entries||(kind==='preview'?previewPixels:nativePixels)>budget){
   const key=kind==='preview'?lru.keys().next().value:nativeHead.key,image=lru.get(key),state=sources.get(key);lru.delete(key);
   if(kind==='preview'){
    previewPixels-=state.pixels;
    for(const record of state.records)if(record.previewDescriptor.image===image)invalidate(record.previewDescriptor);
   }else{
    nativePixels-=state.pixels;unlinkNative(state);state.autoEvicted=true;
    for(const record of state.records)if(record.directDescriptor.image===image)invalidate(record.directDescriptor);
   }
   releaseImage(image);
  }
 }
 function pumpLoads(){
  while(activeLoads<maxConcurrentLoads&&queue.length){
   const request=queue.shift();
   if(request.generation!==generation){request.resolve();continue;}
   activeLoads++;if(request.state.kind==='preview')previewLoads++;else sourceLoads++;
   let loading;try{loading=loadImage(request.state.file);}catch(error){loading=Promise.reject(error);}
   Promise.resolve(loading).then(image=>{
    if(request.generation!==generation){releaseImage(image);request.resolve();return;}
    const actual=size(image),state=request.state;
    if(actual.w!==state.width||actual.h!==state.height){releaseImage(image);request.reject(Error('Parallel artwork dimensions changed: '+state.file));return;}
    const lru=state.kind==='preview'?previewLRU:nativeLRU;
    lru.set(state.key,image);if(state.kind==='preview')previewPixels+=state.pixels;else{nativePixels+=state.pixels;state.autoEvicted=false;touchNative(state);}
    try{for(const record of request.records)compileNative(record,image);state.autoFailed=false;request.resolve();}
    catch(error){request.reject(error);}finally{trimSources(state.kind);}
   },request.reject).finally(()=>{activeLoads--;pumpLoads();});
  }
 }
 function load(state,record,{retry=false}={}){
  const lru=state.kind==='preview'?previewLRU:nativeLRU,cached=lru.get(state.key);
  if(cached){if(state.kind==='preview')touch(lru,state.key,cached);else touchNative(state);if(record)compileNative(record,cached);return settled;}
  if(state.pending){if(record)state.pending.records.add(record);return state.pending.promise;}
  if(state.autoFailed&&!retry)return settled;
  const request={state,generation,records:new Set(record?[record]:[]),resolve:null,reject:null,promise:null};
  request.promise=new Promise((resolve,reject)=>{request.resolve=resolve;request.reject=reject;}).catch(error=>{if(request.generation===generation)state.autoFailed=true;throw error;}).finally(()=>{if(state.pending===request)state.pending=null;request.records.clear();});
  state.pending=request;queue.push(request);pumpLoads();return request.promise;
 }
 function warm(state,record){
  if(!state||state.autoFailed||state.pending)return;
  if(state.kind==='native'&&!admitWarmNative(state,now()))return;
  void load(state,record).catch(()=>{});
 }
 function previewSource(record){
  if(!record.previewState)return null;
  const image=previewLRU.get(record.previewState.key);
  if(!image){warm(record.previewState);return null;}
  touch(previewLRU,record.previewState.key,image);
  const descriptor=record.previewDescriptor,p=record.preview,r=record.previewDraw;
  if(descriptor.image!==image)Object.assign(descriptor,{image,sx:p.x,sy:p.y,sw:p.w,sh:p.h,dx:r.x,dy:r.y,dw:r.w,dh:r.h,native:false,quality:'parallel-preview',revision:descriptor.revision+1});
  return descriptor;
 }
 function correctedSource(record,native=false){
  if(native)record.nativeState.lastDemandAt=now();
  const key=record.nativeKey,cached=canvasLRU.get(key);
  if(cached){if(native&&nativeLRU.has(record.nativeState.key))touchNative(record.nativeState);touch(canvasLRU,key,cached);return record.nativeDescriptor;}
  const image=nativeLRU.get(record.nativeState.key);
  if(image){
   touchNative(record.nativeState);
   const d=record.directDescriptor,p=record.native,r=record.draw;
   if(d.image!==image)Object.assign(d,{image,sx:p.x,sy:p.y,sw:p.w,sh:p.h,dx:r.x,dy:r.y,dw:r.w,dh:r.h,native:true,quality:'parallel-native-atlas',revision:d.revision+1});
   return d;
  }
  // Roster rendering needs only the atlas. Exact-pixel isolated crops are
  // compiled by explicit ensureFull(), not repeatedly for each visible item.
  if(native)warm(record.nativeState);
  const preview=previewSource(record);if(preview)return preview;
  const envelope=canvasLRU.get(record.envelopeKey);
  if(envelope){touch(canvasLRU,record.envelopeKey,envelope);return record.envelopeDescriptor;}
  return null;
 }
 function originalCanvas(original){
  if(original.canvasReading)return null;
  const descriptor=original.canvas;
  original.canvasReading=true;
  try{return descriptor?.get?descriptor.get.call(original.asset):descriptor?.value??null;}
  finally{original.canvasReading=false;}
 }
 function fallbackDescriptor(record,image,descriptor=record.fallbackDescriptor){
  if(!image)return null;
  const s=size(image),view=record.oldView;
  if(descriptor.image!==image||descriptor.sw!==s.w||descriptor.sh!==s.h)Object.assign(descriptor,{image,sx:0,sy:0,sw:s.w,sh:s.h,dx:0,dy:0,dw:view.w,dh:view.h,native:false,quality:'original-fallback',revision:descriptor.revision+1});
  return descriptor;
 }
 function fallbackRaster(record){
  const original=record.original;
  if(original.fallbackBuilding)return originalCanvas(original);
  const cached=canvasLRU.get(record.fallbackKey);if(cached){touch(canvasLRU,record.fallbackKey,cached);return cached.canvas;}
  const canvas=createCanvas();canvas.width=Math.ceil(record.oldView.w);canvas.height=Math.ceil(record.oldView.h);
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;original.fallbackBuilding=true;
  try{
   if(typeof original.draw==='function')original.draw.call(original.asset,ctx);
   else{const image=originalCanvas(original);if(image)ctx.drawImage(image,0,0,record.oldView.w,record.oldView.h);}
  }catch(error){canvas.width=canvas.height=1;throw error;}finally{original.fallbackBuilding=false;}
  admitCanvas(record,'fallback',canvas);fallbackDescriptor(record,canvas);return canvas;
 }
 function southFallbackSource(record,options){
  const original=record.original;
  // Resolve a captured provider once. Ordinary collection previews then stay
  // atlas-only; legacy providers that read asset.canvas land on fallbackRaster.
  if(typeof original.source==='function'&&!original.fallbackSourceReading){
   original.fallbackSourceReading=true;
   try{const source=original.source.call(original.asset,'south',options);if(source?.image)return source;}
   finally{original.fallbackSourceReading=false;}
  }
  if(original.fallbackBuilding)return fallbackDescriptor(record,originalCanvas(original),original.fallback);
  return fallbackDescriptor(record,fallbackRaster(record));
 }
 function originalSource(original,facing,options){
  const south=facing==='south'&&original.facings.get('south');
  if(south)return southFallbackSource(south,options);
  if(typeof original.source==='function')return original.source.call(original.asset,facing,options);
  const image=typeof original.image==='function'?original.image.call(original.asset,facing):originalCanvas(original);
  if(!image)return null;
  const view=typeof original.view==='function'?original.view.call(original.asset,facing,metadataOptions):original.asset,d=original.fallback,s=size(image);
  if(d.image!==image||d.sw!==s.w||d.sh!==s.h)Object.assign(d,{image,sx:0,sy:0,sw:s.w,sh:s.h,dx:0,dy:0,dw:view?.w??original.asset.w,dh:view?.h??original.asset.h,native:true,quality:'original',revision:d.revision+1});
  return d;
 }
 function raster(record,source){
  if(source===record.envelopeDescriptor)return source.image;
  // A complete-envelope crop already is a correctly sized image at native
  // resolution; callers map it to the unchanged world view themselves.
  if(source.dx===0&&source.dy===0&&source.dw===record.oldView.w&&source.dh===record.oldView.h&&source.sx===0&&source.sy===0&&source.sw===(source.image.naturalWidth||source.image.width)&&source.sh===(source.image.naturalHeight||source.image.height))return source.image;
  const key=record.envelopeKey,old=canvasLRU.get(key);
  if(old&&old.source===source&&old.sourceRevision===source.revision){touch(canvasLRU,key,old);return old.canvas;}
  const canvas=createCanvas();canvas.width=Math.ceil(record.oldView.w);canvas.height=Math.ceil(record.oldView.h);
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;drawSource(ctx,source);
  // Draw before admission: admission may evict the input crop canvas.
  admitCanvas(record,'envelope',canvas,source);
  const d=record.envelopeDescriptor;
  Object.assign(d,{image:canvas,sx:0,sy:0,sw:canvas.width,sh:canvas.height,dx:0,dy:0,dw:record.oldView.w,dh:record.oldView.h,native:false,quality:'parallel-envelope',revision:d.revision+1});return canvas;
 }
 function image(record,native=true){
  const source=correctedSource(record,native);
  if(source)return raster(record,source);
  const original=record.original;
  if(record.facing==='south'){
   // Legacy getFacingImage('south') and getFacingDrawSource('south') read
   // asset.canvas dynamically. Calling them here would reenter this getter.
   if(typeof original.image!=='function'&&typeof original.source!=='function')return originalCanvas(original)??fallbackRaster(record);
   return fallbackRaster(record);
  }
  return typeof original.image==='function'?original.image.call(original.asset,record.facing):originalCanvas(original);
 }
 function ensure(id,facing='south'){
  const original=assets.get(id),record=original?.facings.get(facing);
  if(!record)return typeof original?.ensure==='function'?Promise.resolve(original.ensure.call(original.asset,facing)):settled;
  record.nativeState.lastDemandAt=now();
  const cached=canvasLRU.get(record.nativeKey);if(cached){if(nativeLRU.has(record.nativeState.key))touchNative(record.nativeState);touch(canvasLRU,record.nativeKey,cached);return settled;}
  try{return load(record.nativeState,record,{retry:true});}catch(error){return Promise.reject(error);}
 }
 function motionFor(record){
  const edited=canvasLRU.has(record.nativeKey)||canvasLRU.has(record.envelopeKey)||nativeLRU.has(record.nativeState.key)||record.previewState&&previewLRU.has(record.previewState.key);
  return edited?record.correctedMotion:record.originalMotion;
 }
 function viewFor(record){
  if(record.view)return record.view;
  const descriptors=Object.getOwnPropertyDescriptors(record.oldView);
  for(const key of ['canvas','image','ready'])delete descriptors[key];
  if(record.correctedMotion)delete descriptors.motion;
  const view=Object.create(Object.getPrototypeOf(record.oldView),descriptors);
  Object.defineProperties(view,{
   canvas:{enumerable:true,get:()=>image(record)},
   ready:{enumerable:true,get:()=>canvasLRU.has(record.nativeKey)||nativeLRU.has(record.nativeState.key)}
  });
  if(record.correctedMotion)Object.defineProperty(view,'motion',{enumerable:true,get:()=>motionFor(record)});
  record.view=Object.freeze(view);return record.view;
 }
 for(const original of assets.values()){
  const asset=original.asset,south=original.facings.get('south');
  if(south){
   asset.draw=function(ctx,...args){const source=correctedSource(south);if(source)drawSource(ctx,source);else original.draw?.call(asset,ctx,...args);};
   Object.defineProperty(asset,'canvas',{configurable:true,enumerable:original.canvas?.enumerable??false,get:()=>image(south,false)});
   if(south.correctedMotion)Object.defineProperty(asset,'motion',{configurable:true,enumerable:original.motionDescriptor?.enumerable??true,get:()=>motionFor(south)});
  }
  // Do not add cardinal capability to an old single-view object: doing so
  // would change its saved rotation semantics. Flat objects still gain the
  // native source API, which alone does not change facing support.
  if(typeof original.view==='function')asset.getFacingView=function(facing='south',options){const record=original.facings.get(facing);return record?viewFor(record):original.view.call(asset,facing,options);};
  if(typeof original.image==='function')asset.getFacingImage=function(facing='south',...args){const record=original.facings.get(facing);return record?image(record):original.image.call(asset,facing,...args);};
  asset.getFacingDrawSource=function(facing='south',options=previewOptions){const record=original.facings.get(facing);return record?correctedSource(record,options?.native===true)||originalSource(original,facing,options):originalSource(original,facing,options);};
  asset.ensureFull=function(facing='south',...args){if(original.facings.has(facing))return ensure(asset.id,facing);return original.ensure?original.ensure.call(asset,facing,...args):settled;};
 }
 return {
  ensure,
  async warmPreviews(){for(const state of sources.values())if(state.kind==='preview')await load(state,null,{retry:true});},
  clear(){
   generation++;for(const request of queue)request.resolve();queue.length=0;
   for(const key of canvasLRU.keys())removeCanvas(key);
   for(const image of nativeLRU.values())releaseImage(image);nativeLRU.clear();nativePixels=0;nativeHead=nativeTail=null;
   for(const image of previewLRU.values())releaseImage(image);previewLRU.clear();previewPixels=0;
   for(const state of sources.values()){state.pending?.records.clear();state.pending=null;state.autoFailed=false;state.autoEvicted=false;state.lastDemandAt=-Infinity;state.nextAdmissionAt=0;state.previous=state.next=null;}
   for(const record of records.values()){invalidate(record.previewDescriptor);invalidate(record.nativeDescriptor);invalidate(record.directDescriptor);invalidate(record.envelopeDescriptor);invalidate(record.fallbackDescriptor);}
  },
  get stats(){return {patches:records.size,assets:assets.size,sourceEntries:nativeLRU.size,sourcePixels:nativePixels,previewEntries:previewLRU.size,previewPixels,canvasEntries:canvasLRU.size,canvasPixels,activeLoads,queuedLoads:queue.length,sourceLoads,previewLoads,canvasBuilds,failedSources:[...sources.values()].filter(state=>state.autoFailed).length,evictedSources:[...sources.values()].filter(state=>state.autoEvicted).length,maxSources,maxSourcePixels,maxCanvases,maxCanvasPixels,maxPreviewSources,maxPreviewPixels,maxConcurrentLoads,nativeIdleMs};}
 };
}

/** Only the compact accepted overview is eagerly prepared at registration. */
export async function registerParallelArt(catalog,options){
 const runtime=createParallelArtRuntime(catalog,options);
 // A failed optional overview must leave the existing game usable. Its error
 // remains visible in stats and a later explicit warmPreviews() can retry.
 await runtime.warmPreviews().catch(()=>{});return runtime;
}
