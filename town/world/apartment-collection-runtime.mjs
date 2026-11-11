import {collectionImageRect,collectionMotion} from './apartment-collection-art.mjs?v=town-polish-1';

const directions=['south','north','east','west'];
const faceKey=(id,facing='south')=>facing==='south'?id:id+'|'+facing;
function southFootCenter(def){
 const points=[];for(const b of def.boxes||[])points.push([b.x,b.y],[b.x+b.w,b.y+b.h]);
 for(const polygon of def.polygons||[])for(const point of polygon)points.push(point);
 if(!points.length)return {x:def.w/2,y:def.h};
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
}

export function createApartmentCollectionRuntime({definitions,manifest,directionManifest,overviewManifest,thumbnails,loadImage,createCanvas,maxSources=4,maxConcurrentLoads=4,maxCanvases=192,maxCanvasPixels=4*1024*1024}){
 const sourceLRU=new Map(),canvasLRU=new Map(),states=new Map(),ownerStates=new Map(),records=new Map(),byId=new Map(definitions.map(def=>[def.id,def]));
 const overview=overviewManifest??directionManifest?.overview??manifest.overview,overviewCells=new Map();
 const settled=Promise.resolve();
 const loadQueue=[];
 let activeLoads=0,canvasPixels=0,sourceLoads=0,generation=0,canvasBuilds=0,nativeCompilations=0,overviewImage=null,overviewPending=null,overviewAttempted=false,overviewLoads=0;
 const limit=(n,fallback)=>Number.isFinite(n)&&n>0?Math.max(1,Math.floor(n)):fallback;
 maxSources=limit(maxSources,4);maxConcurrentLoads=limit(maxConcurrentLoads,4);maxCanvases=limit(maxCanvases,192);maxCanvasPixels=limit(maxCanvasPixels,4*1024*1024);
 function addRecord(def,frame,state,facing){
  const key=faceKey(def.id,facing),drawDef={w:frame.viewWidth??def.w,h:frame.viewHeight??def.h};
  if(!Number.isFinite(drawDef.w)||!Number.isFinite(drawDef.h)||drawDef.w<=0||drawDef.h<=0)throw Error('Invalid apartment facing size: '+key);
  // Expanded artwork has its own envelope; its authored floor centre still
  // maps to the exact original asset base and saved placement pivot.
  if(facing==='south'&&(drawDef.w!==def.w||drawDef.h!==def.h)){
   const point=frame.footCenter,world=frame.worldFootCenter;
   if(!(Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))&&!(world&&Number.isFinite(world.x)&&Number.isFinite(world.y)))throw Error('Expanded apartment South view needs an authored ground anchor: '+key);
  }
  const rect=collectionImageRect(drawDef,frame),sourceFoot=frame.footCenter;
  const footCenter=Array.isArray(sourceFoot)?{x:rect.x+sourceFoot[0]*rect.w,y:rect.y+sourceFoot[1]*rect.h}:frame.worldFootCenter??(facing==='south'?southFootCenter(def):{x:drawDef.w/2,y:drawDef.h});
  const motion=collectionMotion(drawDef,frame),view={id:facing==='south'?def.id:key,w:drawDef.w,h:drawDef.h,footCenter,facing,...(motion?{motion}: {})};
  Object.defineProperty(view,'canvas',{enumerable:true,get:()=>{warmAsset(def.id,facing);return canvasForKey(key);}});
  Object.defineProperty(view,'ready',{get:()=>Boolean(canvasLRU.get(key)?.full)});
  const source=()=>({image:null,sx:0,sy:0,sw:0,sh:0,dx:0,dy:0,dw:drawDef.w,dh:drawDef.h,native:false,revision:0});
  const previous=records.get(key);if(previous)previous.state.records=previous.state.records.filter(item=>item!==previous);
  const item={key,def,drawDef,frame,state,view,rect,preview:source(),direct:source(),nativeSource:source()};records.set(key,item);(state.records??=[]).push(item);
 }
 for(const collection of manifest.collections){
  const state={key:collection.owner,owner:collection.owner,entry:collection,thumb:thumbnails.get(collection.owner),pending:null,autoFailed:false};
  states.set(state.key,state);ownerStates.set(collection.owner+'|south',state);
  for(const frame of collection.cells){const def=byId.get(frame.id||'collection-'+collection.owner+'-'+frame.slot);if(def)addRecord(def,frame,state,'south');}
 }
 for(const def of definitions)if(!ownerStates.get(def.owner+'|south')?.thumb||!records.has(def.id))throw Error('Missing apartment collection artwork: '+def.id);
 const southOverrides=new Set();
 for(const collection of directionManifest?.collections||[]){
  for(const facing of directions){
   const authored=collection.views?.[facing],cells=authored?.cells;
   if(facing==='south'&&authored!==undefined&&!Array.isArray(cells))throw Error('Invalid apartment South override sheet: '+collection.owner);
   if(!cells)continue;
   const entry={...collection,...authored},key=collection.owner+'|'+entry.file;
   if(!entry.file||!(entry.width>0&&entry.height>0))throw Error('Missing apartment direction sheet: '+collection.owner+'/'+facing);
   if(facing==='south'){
    if(!Array.isArray(cells)||typeof entry.file!=='string'||![entry.width,entry.height].every(Number.isFinite))throw Error('Invalid apartment South override sheet: '+collection.owner);
    for(const frame of cells){
     const id=frame.id||'collection-'+collection.owner+'-'+frame.slot,def=byId.get(id);
     if(!def)throw Error('Unknown apartment South override: '+id);
     if(def.owner!==collection.owner)throw Error('Apartment South override changes owner: '+id);
     if(southOverrides.has(id))throw Error('Duplicate apartment South override: '+id);
     if(![frame.x,frame.y,frame.w,frame.h].every(Number.isFinite)||frame.x<0||frame.y<0||frame.w<=0||frame.h<=0||frame.x+frame.w>entry.width||frame.y+frame.h>entry.height)throw Error('Invalid apartment South override crop: '+id);
     southOverrides.add(id);
    }
   }
   let state=states.get(key);if(!state){state={key,owner:collection.owner,entry,thumb:null,pending:null,autoFailed:false};states.set(key,state);}
   ownerStates.set(collection.owner+'|'+facing,state);
   for(const frame of cells){const def=byId.get(frame.id||'collection-'+collection.owner+'-'+frame.slot);if(def)addRecord(def,frame,state,facing);}
  }
 }
 for(const cell of overview?.cells||[])overviewCells.set(faceKey(cell.id,cell.facing??cell.direction??'south'),cell);
 const touch=(map,key,value)=>{map.delete(key);map.set(key,value);return value;};
 function releaseImage(image){try{if(typeof image?.close==='function')image.close();else image?.removeAttribute?.('src');}catch{}}
 function pumpLoads(){
  while(activeLoads<maxConcurrentLoads&&loadQueue.length){
   const request=loadQueue.shift();
   if(request.generation!==generation){request.resolve();continue;}
   activeLoads++;if(request.overview)overviewLoads++;else sourceLoads++;
   let loading;try{loading=loadImage(request.file,request.owner);}catch(error){loading=Promise.reject(error);}
   Promise.resolve(loading).then(image=>{
    if(request.generation!==generation){releaseImage(image);request.resolve();}else request.resolve(image);
   },request.reject).finally(()=>{activeLoads--;pumpLoads();});
  }
 }
 function queueLoad(file,owner,overview=false){
  const request={file,owner,overview,generation,resolve:null,reject:null};
  const promise=new Promise((resolve,reject)=>{request.resolve=resolve;request.reject=reject;});
  loadQueue.push(request);pumpLoads();return promise;
 }
 function removeCanvas(key){const item=canvasLRU.get(key);if(!item)return;canvasPixels-=item.pixels;canvasLRU.delete(key);item.canvas.width=item.canvas.height=1;}
 function trimSources(){while(sourceLRU.size>maxSources){const key=sourceLRU.keys().next().value,image=sourceLRU.get(key);sourceLRU.delete(key);for(const item of states.get(key).records||[])if(item.direct.image===image)item.direct.image=null;releaseImage(image);}}
 function record(id,facing='south'){const result=records.get(faceKey(id,facing));if(!result)throw Error('Unknown apartment collection facing: '+id+'/'+facing);return result;}
 function canvasForKey(key,fullImage){
  const item=records.get(key),{drawDef,frame,state}=item,full=fullImage??sourceLRU.get(state.key),old=canvasLRU.get(key);
  if(old&&(old.full||!full))return touch(canvasLRU,key,old).canvas;
  if(old)removeCanvas(key);
  const width=Math.ceil(drawDef.w),height=Math.ceil(drawDef.h),pixels=width*height;if(pixels>maxCanvasPixels)throw Error('Apartment asset exceeds native canvas budget: '+key);
  while(canvasLRU.size>=maxCanvases||canvasPixels+pixels>maxCanvasPixels)removeCanvas(canvasLRU.keys().next().value);
  const canvas=createCanvas();canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  const source=full||state.thumb;
  if(source){const rect=collectionImageRect(drawDef,frame),sx=(source.naturalWidth||source.width)/state.entry.width,sy=(source.naturalHeight||source.height)/state.entry.height;
   c.drawImage(source,frame.x*sx,frame.y*sy,frame.w*sx,frame.h*sy,rect.x,rect.y,rect.w,rect.h);
  }
  // Pending directions stay transparent rather than substituting rotated south art.
  canvasLRU.set(key,{canvas,pixels,full:Boolean(full)});canvasPixels+=pixels;canvasBuilds++;if(full)nativeCompilations++;return canvas;
 }
 function requestOverview(){
  if(overviewPending)return overviewPending.promise;
  if(overviewImage||overviewAttempted||!overview?.file)return settled;
  overviewAttempted=true;const epoch=generation,loading=queueLoad(overview.file,'__overview__',true);
  const request={promise:null};overviewPending=request;
  request.promise=Promise.resolve(loading).then(image=>{if(epoch!==generation||(image.naturalWidth||image.width)*(image.naturalHeight||image.height)>4*1024*1024){releaseImage(image);return;}overviewImage=image;}).catch(()=>{}).finally(()=>{if(overviewPending===request)overviewPending=null;});
  return request.promise;
 }
 function atlasSource(item,descriptor,image,quality){
  if(descriptor.image===image&&descriptor.quality===quality)return descriptor;
  const {frame,state,rect}=item,sx=(image.naturalWidth||image.width)/state.entry.width,sy=(image.naturalHeight||image.height)/state.entry.height;
  Object.assign(descriptor,{image,sx:frame.x*sx,sy:frame.y*sy,sw:frame.w*sx,sh:frame.h*sy,dx:rect.x,dy:rect.y,dw:rect.w,dh:rect.h,native:quality==='native',quality,revision:descriptor.revision+1});return descriptor;
 }
 function nativeSource(item,canvas){
  const descriptor=item.nativeSource;
  if(descriptor.image!==canvas)Object.assign(descriptor,{image:canvas,sx:0,sy:0,sw:canvas.width,sh:canvas.height,dx:0,dy:0,dw:item.drawDef.w,dh:item.drawDef.h,native:true,quality:'native',revision:descriptor.revision+1});
  return descriptor;
 }
 function previewSource(item){
  const descriptor=item.preview,cell=overviewCells.get(item.key);
  if(cell&&overviewImage){
   if(descriptor.image!==overviewImage){const sx=(overviewImage.naturalWidth||overviewImage.width)/overview.width,sy=(overviewImage.naturalHeight||overviewImage.height)/overview.height;
    Object.assign(descriptor,{image:overviewImage,sx:cell.x*sx,sy:cell.y*sy,sw:cell.w*sx,sh:cell.h*sy,dx:0,dy:0,dw:item.drawDef.w,dh:item.drawDef.h,native:false,quality:'overview',revision:descriptor.revision+1});}
   return descriptor;
  }
  if(item.state.thumb)return atlasSource(item,descriptor,item.state.thumb,'thumbnail');
  if(cell)requestOverview();
  return descriptor;
 }
 function drawSource(id,facing='south',{native=false}={}){
  const item=record(id,facing);
  if(native){warmAsset(id,facing);const cached=canvasLRU.get(item.key);if(cached?.full){touch(canvasLRU,item.key,cached);return nativeSource(item,cached.canvas);}}
  return previewSource(item);
 }
 function loadState(state,keys=[]){
  const existing=sourceLRU.get(state.key);
  if(existing){touch(sourceLRU,state.key,existing);for(const key of keys)canvasForKey(key,existing);return Promise.resolve();}
  if(state.pending){for(const key of keys)state.pending.keys.add(key);return state.pending.promise;}
  const request={generation,keys:new Set(keys),promise:null};state.pending=request;
  const loading=queueLoad(state.entry.file,state.owner);
  request.promise=Promise.resolve(loading).then(image=>{
   if(request.generation!==generation){releaseImage(image);return;}
   sourceLRU.set(state.key,image);state.autoFailed=false;
   // Raster requested crops before source eviction; resolve without Image values.
   try{for(const key of request.keys)canvasForKey(key,image);}finally{trimSources();}
  }).catch(error=>{if(request.generation===generation)state.autoFailed=true;throw error;}).finally(()=>{if(state.pending===request)state.pending=null;request.keys.clear();});
  return request.promise;
 }
 function ensureAsset(id,facing='south'){
  let item;try{item=record(id,facing);}catch(error){return Promise.reject(error);}
  const cached=canvasLRU.get(item.key);if(cached?.full){touch(canvasLRU,item.key,cached);return Promise.resolve();}
  item.state.autoFailed=false;return loadState(item.state,[item.key]);
 }
 function warmAsset(id,facing='south'){
  const item=records.get(faceKey(id,facing));if(!item||canvasLRU.get(item.key)?.full||item.state.autoFailed)return;
  if(item.state.pending){item.state.pending.keys.add(item.key);return;}
  void ensureAsset(id,facing).catch(()=>{});
 }
 return {
  canvas(id,facing='south'){return canvasForKey(record(id,facing).key);},
  draw(id,c){
   const item=record(id),full=sourceLRU.get(item.state.key),cached=canvasLRU.get(item.key),source=full?atlasSource(item,item.direct,full,'native'):cached?.full?nativeSource(item,cached.canvas):previewSource(item);
   if(source.image)c.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh);
  },
  drawSource,
  warmOverview:requestOverview,
  motion(id,facing='south'){return record(id,facing).view.motion??null;},
  view(id,facing='south'){return records.get(faceKey(id,facing))?.view??null;},
  ensureFull(owner,facing='south',ids=[]){
   if(Array.isArray(facing)){ids=facing;facing='south';}
   // A partial South replacement can share an owner with its preserved base
   // sheet. Resolve each requested crop against its actual source state.
   let items;try{items=ids.length?ids.map(id=>record(id,facing)):[...records.values()].filter(item=>item.def.owner===owner&&item.view.facing===facing);}catch(error){return Promise.reject(error);}
   if(!items.length||items.some(item=>item.def.owner!==owner))return Promise.reject(Error('Unknown apartment collection direction: '+owner+'/'+facing));
   const groups=new Map();for(const item of items){if(!groups.has(item.state))groups.set(item.state,[]);if(ids.length)groups.get(item.state).push(item.key);}
   const pending=[...groups].map(([state,keys])=>{state.autoFailed=false;return loadState(state,keys);});
   return pending.length===1?pending[0]:Promise.all(pending).then(()=>{});
  },
  ensureAsset,
  warmAsset,
  clear(){
   generation++;for(const request of loadQueue)request.resolve();loadQueue.length=0;
   // A loader may still be decoding an old generation. Keep its slot occupied
   // until it settles, so clearing cannot start another full burst of decodes.
   for(const key of canvasLRU.keys())removeCanvas(key);
   for(const image of sourceLRU.values())releaseImage(image);sourceLRU.clear();
   for(const state of states.values()){state.pending?.keys.clear();state.pending=null;state.autoFailed=false;}
   releaseImage(overviewImage);overviewImage=null;overviewPending=null;overviewAttempted=false;
   for(const item of records.values())for(const source of [item.preview,item.direct,item.nativeSource]){source.image=null;source.revision++;}
  },
  get stats(){return {sourceEntries:sourceLRU.size,sourceOwners:[...sourceLRU.keys()].map(key=>states.get(key).owner),sourceKeys:[...sourceLRU.keys()],canvasEntries:canvasLRU.size,canvasPixels,canvasBuilds,nativeCompilations,sourceLoads,activeLoads,queuedLoads:loadQueue.length,pendingLoads:[...states.values()].filter(state=>state.pending).length,overviewLoads,overviewReady:Boolean(overviewImage),overviewPixels:overviewImage?(overviewImage.naturalWidth||overviewImage.width)*(overviewImage.naturalHeight||overviewImage.height):0,maxSources,maxConcurrentLoads,maxCanvases,maxCanvasPixels};}
 };
}
