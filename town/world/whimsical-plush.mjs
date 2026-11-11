import {WHIMSICAL_PLUSH_DEFINITIONS,WHIMSICAL_PLUSH_DIRECTIONS} from './whimsical-plush-definitions.mjs?v=room-editor-1';
export {WHIMSICAL_PLUSH_DEFINITIONS,WHIMSICAL_PLUSH_DIRECTIONS} from './whimsical-plush-definitions.mjs?v=room-editor-1';

const assetURL=file=>{const url=new URL('../assets/whimsical-plush/'+file,import.meta.url);url.search=new URL(import.meta.url).search;return url;};
async function browserImage(url){
 if(typeof fetch==='function'&&typeof createImageBitmap==='function'){
  const response=await fetch(url);if(!response.ok)throw Error('Plush artwork could not load: '+response.status);return createImageBitmap(await response.blob());
 }
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Plush artwork could not load.'));image.src=url;});
}
const rect=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isInteger)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0;
let activeStats=null;
export const getWhimsicalPlushCacheStats=()=>activeStats?.()||null;

/** Startup decodes one small preview; all48 native facings share one lazy sheet. */
export async function registerWhimsicalPlush(add,{
 manifest,loadImage=browserImage,createCanvas=()=>document.createElement('canvas'),
 fetchManifest=async()=>{const response=await fetch(assetURL('manifest.json'));if(!response.ok)throw Error('Plush manifest unavailable.');return response.json();}
}={}){
 manifest??=await fetchManifest();
 const byId=new Map(WHIMSICAL_PLUSH_DEFINITIONS.map(d=>[d.id,d])),frames=new Map();
 if(manifest?.count!==12||manifest.views!==48||!Number.isInteger(manifest.width)||!Number.isInteger(manifest.height)||manifest.width*manifest.height>4*1024*1024||!Array.isArray(manifest.frames)||manifest.frames.length!==48)throw Error('Plush manifest must contain12toys and48native cardinal views.');
 for(const frame of manifest.frames){
  const r=frame.rect,b=frame.opaqueBounds,key=frame.id+'|'+frame.direction;
  if(!byId.has(frame.id)||!WHIMSICAL_PLUSH_DIRECTIONS.includes(frame.direction)||frames.has(key)||!rect(r)||r.x+r.w>manifest.width||r.y+r.h>manifest.height||!rect(b)||b.x+b.w>r.w||b.y+b.h>r.h)throw Error('Invalid plush cardinal frame: '+key);
  frames.set(key,frame);
 }
 for(const def of byId.values())for(const direction of WHIMSICAL_PLUSH_DIRECTIONS)if(!frames.has(def.id+'|'+direction))throw Error('Plush is missing a real '+direction+' drawing: '+def.id);
 const thumbnail=await loadImage(assetURL(manifest.thumbnail).href),cached=new Map(),views=new Map(),fits=new Map();let native=null,pending=null,failure=null,nativeLoads=0,canvasPixels=0;
 if(thumbnail.width!==manifest.thumbnailWidth||thumbnail.height!==manifest.thumbnailHeight)throw Error('Plush preview dimensions do not match metadata.');
 for(const def of byId.values()){
  const list=WHIMSICAL_PLUSH_DIRECTIONS.map(dir=>frames.get(def.id+'|'+dir).opaqueBounds);
  fits.set(def.id,Math.min((def.w-4)/Math.max(...list.map(b=>b.w)),(def.h-4)/Math.max(...list.map(b=>b.h))));
 }
 function ensure(retry=false){
  if(native)return Promise.resolve(native);if(pending)return pending;if(failure&&!retry)return Promise.reject(failure);
  failure=null;nativeLoads++;pending=loadImage(assetURL(manifest.file).href).then(image=>{
   if(image.width!==manifest.width||image.height!==manifest.height)throw Error('Plush native sheet dimensions do not match metadata.');
   native=image;for(const value of cached.values())value.canvas.width=value.canvas.height=0;cached.clear();canvasPixels=0;return image;
  }).catch(error=>{failure=error;throw error;}).finally(()=>{pending=null;});return pending;
 }
 function paint(c,def,direction){
  const frame=frames.get(def.id+'|'+direction),r=frame.rect,b=frame.opaqueBounds,image=native||thumbnail,scaleX=image.width/manifest.width,scaleY=image.height/manifest.height,fit=fits.get(def.id);
  const x=def.w/2-(b.x+b.w/2)*fit,y=def.h-2-(b.y+b.h)*fit;
  c.imageSmoothingEnabled=false;c.drawImage(image,r.x*scaleX,r.y*scaleY,r.w*scaleX,r.h*scaleY,x,y,r.w*fit,r.h*fit);
 }
 function canvasFor(def,direction='south'){
  direction=WHIMSICAL_PLUSH_DIRECTIONS.includes(direction)?direction:'south';const key=def.id+'|'+direction;
  if(!native)ensure().catch(()=>{});let result=cached.get(key);
  if(!result){const canvas=createCanvas();canvas.width=def.w;canvas.height=def.h;paint(canvas.getContext('2d'),def,direction);result={canvas};cached.set(key,result);canvasPixels+=canvas.width*canvas.height;}
  return result.canvas;
 }
 const assets=WHIMSICAL_PLUSH_DEFINITIONS.map(def=>{
  const asset=add(def.id,def.name,'plushies',def.w,def.h,c=>{if(!native)ensure().catch(()=>{});paint(c,def,'south');},def.boxes.map(box=>({...box})),def.layer);
  Object.assign(asset,{kit:'urban',pack:def.pack,owner:'whimsical-plush',facing:'south',purpose:'plush',slot:'toy',furnitureRole:'plush',collisionDefault:true,npcAvoid:true,depthSorted:true,softToy:true,furnitureFacing:true});
  Object.defineProperty(asset,'canvas',{configurable:true,get:()=>canvasFor(def)});
  asset.ensureFull=()=>ensure(true);
  asset.getFacingView=(direction='south')=>{
   direction=WHIMSICAL_PLUSH_DIRECTIONS.includes(direction)?direction:'south';const key=def.id+'|'+direction;
   if(!views.has(key)){
    const view={id:key,direction,w:def.w,h:def.h,footCenter:{x:def.w/2,y:def.h-10}};
    Object.defineProperty(view,'ready',{get:()=>Boolean(native)});Object.defineProperty(view,'canvas',{get:()=>canvasFor(def,direction)});views.set(key,view);
   }
   return views.get(key);
  };
  asset.getFacingImage=direction=>canvasFor(def,direction);return asset;
 });
 activeStats=()=>({assets:assets.length,views:48,nativeLoads,nativeReady:Boolean(native),nativePixels:native?native.width*native.height:0,thumbnailPixels:thumbnail.width*thumbnail.height,canvasEntries:cached.size,canvasPixels,maxCanvasEntries:48,maxCanvasPixels:512*1024,maxNativePixels:4*1024*1024});
 return assets;
}
