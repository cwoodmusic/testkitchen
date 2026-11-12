// Filter large static scenery once per power-of-two zoom level. The player,
// seats and animated performers keep their independent pixel-art drawing.
export function sceneryScale(transform){return Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));}
export function createSceneryCache({maxPixels=12*1024*1024,maxEntries=12,createCanvas=(w,h)=>{
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;
}}={}){
 const sources=new WeakMap(),recent=new Set();let pixels=0,builds=0;
 // Depth-sorted draws can still use an evicted image later in this frame.
 function remove(entry){entry.bucket.delete(entry.scale);recent.delete(entry);pixels-=entry.pixels;queueMicrotask(()=>{if(entry.canvas.close)entry.canvas.close();else entry.canvas.width=entry.canvas.height=0;});}
 function forget(source){const bucket=sources.get(source);if(bucket)for(const entry of bucket.values())remove(entry);sources.delete(source);}
 function image(source,scale,revision=0){
  if(!Number.isFinite(scale)||scale<=0||scale>.5)return source;
  const level=Math.max(1/32,2**Math.ceil(Math.log2(scale))),width=Math.max(1,Math.ceil(source.width*level)),height=Math.max(1,Math.ceil(source.height*level)),cost=width*height;
  if(cost>maxPixels)return source;
  let bucket=sources.get(source);if(bucket&&[...bucket.values()].some(e=>e.width!==source.width||e.height!==source.height||e.revision!==revision)){forget(source);bucket=null;}
  if(!bucket){bucket=new Map();sources.set(source,bucket);}
  let entry=bucket.get(level);
  if(entry){recent.delete(entry);recent.add(entry);return entry.canvas;}
  while(recent.size&&(pixels+cost>maxPixels||recent.size>=maxEntries))remove(recent.values().next().value);
  const canvas=createCanvas(width,height),c=canvas.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,width,height);
  entry={bucket,scale:level,canvas:canvas.transferToImageBitmap?.()||canvas,width:source.width,height:source.height,pixels:cost,revision};bucket.set(level,entry);recent.add(entry);pixels+=cost;builds++;return canvas;
 }
 return {image,forget,get stats(){return {pixels,entries:recent.size,builds};}};
}
const cache=createSceneryCache();
export const sceneryImage=(c,source,revision=0)=>cache.image(source,sceneryScale(c.getTransform()),revision);
export const forgetScenery=source=>cache.forget(source);
