import {furnitureFootCenter} from './furniture-facing.mjs?v=opera-depth-1';

const directions=['south','north','east','west'];
const metadataOptions=Object.freeze({image:false});
const previewOptions=Object.freeze({native:false});
const nativeOptions=Object.freeze({native:true});
const sourceKeys=['image','sx','sy','sw','sh','dx','dy','dw','dh','native','quality','revision'];
const positive=n=>Number.isFinite(n)&&n>0;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);

/** One budget shared by all source-derived products registered in a catalog. */
export function createFamilySourceCanvasCache({maxCanvases=48,maxPixels=4*1024*1024}={}){
 const limit=(value,fallback)=>positive(value)?Math.max(1,Math.floor(value)):fallback;
 maxCanvases=limit(maxCanvases,48);maxPixels=limit(maxPixels,4*1024*1024);
 const records=new Map();let pixels=0;
 const stats=()=>({canvasEntries:records.size,canvasPixels:pixels,maxCanvases,maxPixels});
 function release(state){
  const record=records.get(state);if(!record)return;
  records.delete(state);pixels-=record.pixels;
  record.canvas.width=record.canvas.height=1;
  if(state.canvas===record.canvas){state.canvas=null;state.canvasRevision=-1;}
 }
 return {
  acquire(state,createCanvas,width,height){
   const previous=records.get(state);
   if(previous){records.delete(state);records.set(state,previous);return previous.canvas;}
   const cost=width*height;
   if(!positive(width)||!positive(height)||!Number.isSafeInteger(cost)||cost>maxPixels)throw Error('Family furniture exceeds the shared canvas budget.');
   while(records.size>=maxCanvases||pixels+cost>maxPixels)release(records.keys().next().value);
   const canvas=createCanvas();canvas.width=width;canvas.height=height;
   state.canvas=canvas;state.canvasRevision=-1;
   records.set(state,{canvas,pixels:cost});pixels+=cost;return canvas;
  },
  clear(){for(const state of records.keys())release(state);return stats();},
  get stats(){return stats();}
 };
}

// Contain a complete approved view around its authored floor point. In
// particular, a pot's centre must stay on the enlarged physical pot base.
function anchoredScale(source,sourceFoot,target,targetFoot){
 let scale=Math.min(target.w/source.w,target.h/source.h);
 for(const [before,after,targetBefore,targetAfter] of [
  [sourceFoot.x,source.w-sourceFoot.x,targetFoot.x,target.w-targetFoot.x],
  [sourceFoot.y,source.h-sourceFoot.y,targetFoot.y,target.h-targetFoot.y]
 ]){
  if(before>0)scale=Math.min(scale,targetBefore/before);
  if(after>0)scale=Math.min(scale,targetAfter/after);
 }
 if(!positive(scale))throw Error('Family furniture has no room around its floor anchor.');
 return scale;
}

/**
 * A larger product made from an approved collection source. This adapter owns
 * no image loader: previews and native art always come from the donor's
 * corrected cardinal source API. Only explicit image/canvas access allocates
 * a derived canvas, at most one per cardinal facing.
 */
export function createFamilySourceView(def,donor,{createCanvas=()=>document.createElement('canvas'),canvasCache}={}){
 if(!def||!donor||!positive(def.w)||!positive(def.h)||!positive(donor.w)||!positive(donor.h))throw Error('Invalid family furniture source size.');
 if(!['rug','plant'].includes(def.slot))throw Error('Unsupported family furniture source role: '+def.slot);
 if(def.sourceAssetId&&def.sourceAssetId!==donor.id)throw Error('Family furniture source does not match '+def.sourceAssetId);
 if(typeof donor.getFacingView!=='function'||typeof donor.getFacingDrawSource!=='function'||typeof donor.ensureFull!=='function')throw Error('Family furniture requires an approved cardinal source.');
 const states=new Map(),foot=furnitureFootCenter(def),plantScale=Math.min(def.w/donor.w,def.h/donor.h);

 function stateFor(facing='south'){
  if(!directions.includes(facing))return null;
  if(states.has(facing))return states.get(facing);
  const original=donor.getFacingView(facing,metadataOptions);
  if(!original||!positive(original.w)||!positive(original.h)){states.set(facing,null);return null;}
  const originalFoot=point(original.footCenter)?original.footCenter:{x:original.w/2,y:original.h};
  const side=facing==='east'||facing==='west';
  const size=facing==='south'?{w:def.w,h:def.h}:def.slot==='plant'?{w:original.w*plantScale,h:original.h*plantScale}:{w:side?def.h:def.w,h:side?def.w:def.h};
  const targetFoot=facing==='south'?{...foot}:def.slot==='plant'?{x:originalFoot.x*plantScale,y:originalFoot.y*plantScale}:{x:size.w/2,y:size.h};
  const scale=anchoredScale(original,originalFoot,size,targetFoot);
  const view={id:def.id+(facing==='south'?'':'|'+facing),...size,footCenter:Object.freeze(targetFoot),facing};
  const state={original,view,scale,offsetX:targetFoot.x-originalFoot.x*scale,offsetY:targetFoot.y-originalFoot.y*scale,
   descriptor:{image:null,sx:0,sy:0,sw:0,sh:0,dx:0,dy:0,dw:size.w,dh:size.h,native:false,revision:0},snapshot:null,canvas:null,canvasRevision:-1};
  Object.defineProperties(view,{
   ready:{enumerable:true,get:()=>original.ready===true},
   canvas:{enumerable:true,get:()=>image(facing)}
  });
  Object.freeze(view);states.set(facing,state);return state;
 }

 function drawSource(facing='south',options=previewOptions){
  const state=stateFor(facing);if(!state)return null;
  const source=donor.getFacingDrawSource(facing,options),descriptor=state.descriptor;
  if(!source){
   if(state.snapshot!==null||descriptor.image){descriptor.image=null;descriptor.native=false;descriptor.quality=undefined;descriptor.revision++;state.snapshot=null;}
   return descriptor;
  }
  let changed=!state.snapshot;
  for(let index=0;!changed&&index<sourceKeys.length;index++)changed=state.snapshot[index]!==source[sourceKeys[index]];
  if(!changed)return descriptor;
  state.snapshot=sourceKeys.map(key=>source[key]);
  const {scale,offsetX,offsetY}=state;
  Object.assign(descriptor,{
   image:source.image??null,sx:source.sx??0,sy:source.sy??0,sw:source.sw??0,sh:source.sh??0,
   dx:offsetX+(source.dx??0)*scale,dy:offsetY+(source.dy??0)*scale,
   dw:(source.dw??state.original.w)*scale,dh:(source.dh??state.original.h)*scale,
   native:source.native===true,quality:source.quality,revision:descriptor.revision+1
  });
  return descriptor;
 }

 function drawDescriptor(ctx,source){
  if(source?.image&&[source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh].every(Number.isFinite)&&positive(source.sw)&&positive(source.sh)&&positive(source.dw)&&positive(source.dh))
   ctx.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh);
 }

 function raster(facing,native){
  const state=stateFor(facing);if(!state)return null;
  const source=drawSource(facing,native?nativeOptions:previewOptions);
  if(canvasCache){
   state.canvas=canvasCache.acquire(state,createCanvas,Math.ceil(state.view.w),Math.ceil(state.view.h));
  }else if(!state.canvas){
   state.canvas=createCanvas();state.canvas.width=Math.ceil(state.view.w);state.canvas.height=Math.ceil(state.view.h);
  }
  if(state.canvasRevision!==source.revision){
   const ctx=state.canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   ctx.clearRect(0,0,state.canvas.width,state.canvas.height);drawDescriptor(ctx,source);state.canvasRevision=source.revision;
  }
  return state.canvas;
 }

 function image(facing='south'){return raster(facing,true);}
 return {
  canvas(){const state=stateFor('south');return state?raster('south',state.view.ready):null;},
  draw(ctx){const state=stateFor('south');if(state)drawDescriptor(ctx,drawSource('south',state.view.ready?nativeOptions:previewOptions));},
  view(facing='south'){return stateFor(facing)?.view??null;},
  ensureFull(facing='south'){
   if(!stateFor(facing))return Promise.reject(Error('Unknown family furniture facing: '+def.id+'/'+facing));
   return donor.ensureFull(facing);
  },
  image,drawSource
 };
}
