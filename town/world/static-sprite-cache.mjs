// Crop, grade and filter static art once per source/zoom level. In particular,
// overview atlas draws must not repeatedly filter the entire backing sheet.
export function createStaticSpriteCache({maxPixels=24*1024*1024,maxEntries=512,createCanvas=(w,h)=>{
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;
}}={}){
 const sources=new WeakMap(),recent=new Set();let pixels=0,builds=0,hits=0;
 function remove(e){recent.delete(e);e.bucket.delete(e.key);pixels-=e.cost;queueMicrotask(()=>{if(e.image.close)e.image.close();else e.image.width=e.image.height=0;});}
 function image(source,sx,sy,sw,sh,scale,filter='none',revision=0){
  const level=Math.min(1,Math.max(1/64,2**Math.ceil(Math.log2(Math.max(.0001,scale))))),w=Math.max(1,Math.ceil(sw*level)),h=Math.max(1,Math.ceil(sh*level)),cost=w*h;
  if(level===1&&filter==='none'||cost>maxPixels)return null;
  let state=sources.get(source);if(!state||state.revision!==revision||state.width!==source.width||state.height!==source.height){if(state)for(const old of state.bucket.values())remove(old);state={revision,width:source.width,height:source.height,bucket:new Map()};sources.set(source,state);}
  const bucket=state.bucket,key=[sx,sy,sw,sh,level,filter].join(':');let entry=bucket.get(key);
  if(entry){hits++;recent.delete(entry);recent.add(entry);return entry.image;}
  while(recent.size&&(pixels+cost>maxPixels||recent.size>=maxEntries))remove(recent.values().next().value);
  const canvas=createCanvas(w,h),c=canvas.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.filter=filter;c.drawImage(source,sx,sy,sw,sh,0,0,w,h);
  entry={bucket,key,cost,image:canvas.transferToImageBitmap?.()||canvas};bucket.set(key,entry);recent.add(entry);pixels+=cost;builds++;return entry.image;
 }
 return {image,get stats(){return {pixels,entries:recent.size,builds,hits,maxPixels,maxEntries};}};
}
const cache=createStaticSpriteCache();
export const staticSpriteStats=()=>cache.stats;
export function drawStaticImage(c,source,sx,sy,sw,sh,dx,dy,dw,dh,{filter=c.filter||'none',revision=0}={}){
 if(!c.getTransform){c.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);return;}
 const t=c.getTransform(),scale=Math.max(Math.hypot(t.a,t.b)*Math.abs(dw/sw),Math.hypot(t.c,t.d)*Math.abs(dh/sh)),image=cache.image(source,sx,sy,sw,sh,scale,filter,revision),previous=c.filter,smooth=c.imageSmoothingEnabled,quality=c.imageSmoothingQuality;
 c.filter=image?'none':filter;c.imageSmoothingEnabled=scale<1;c.imageSmoothingQuality='low';
 if(image)c.drawImage(image,0,0,image.width,image.height,dx,dy,dw,dh);else c.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);
 c.filter=previous;c.imageSmoothingEnabled=smooth;c.imageSmoothingQuality=quality;
}
