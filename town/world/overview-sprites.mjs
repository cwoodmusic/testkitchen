import {sceneryImage} from './scenery-cache.mjs?v=opera-smooth-1';
import {supportsLawnReveal,assetMapImageRevision} from './asset-lawn.mjs?v=town-compact-island-1';

export const OVERVIEW_SPRITE_SCALE=.125;
const MIN_EDGE=128,MAX_EDGE=1024;

// Keep more source pixels than the far view can display. Close views continue
// to sample the original image, including the existing native pixel grid.
export function overviewSpriteSize(width,height,scale){
 if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(scale)||width<1||height<1||scale<=0||scale>OVERVIEW_SPRITE_SCALE)return null;
 const edge=Math.max(width,height);if(edge<=512)return null;
 const target=Math.min(MAX_EDGE,Math.max(MIN_EDGE,2**Math.ceil(Math.log2(edge*scale*2))));
 if(target>=edge)return null;
 return {width:Math.max(1,Math.round(width*target/edge)),height:Math.max(1,Math.round(height*target/edge)),level:target};
}

export function createOverviewSpriteCache({maxEntries=24,maxPixels=4*1024*1024,maxLevels=3,createCanvas=(width,height)=>{
 const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):document.createElement('canvas');c.width=width;c.height=height;return c;
}}={}){
 const sources=new WeakMap(),recent=new Map();let pixels=0;
 // Finish any remaining depth strips before releasing their source raster.
 function remove(entry){entry.bucket.delete(entry.key);recent.delete(entry);pixels-=entry.pixels;queueMicrotask(()=>{if(entry.canvas.close)entry.canvas.close();else entry.canvas.width=entry.canvas.height=0;});}
 function image(source,scale){
  const size=overviewSpriteSize(source.width,source.height,scale);if(!size)return source;
  let bucket=sources.get(source);if(!bucket){bucket=new Map();sources.set(source,bucket);}
  const previous=bucket.values().next().value;
  if(previous&&(previous.sourceWidth!==source.width||previous.sourceHeight!==source.height))for(const old of bucket.values())remove(old);
  const key=size.level;let entry=bucket.get(key);
  if(entry){bucket.delete(key);bucket.set(key,entry);recent.delete(entry);recent.set(entry,true);return entry.canvas;}
  const canvas=createCanvas(size.width,size.height),c=canvas.getContext('2d');
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,size.width,size.height);
  entry={bucket,key,canvas:canvas.transferToImageBitmap?.()||canvas,sourceWidth:source.width,sourceHeight:source.height,pixels:size.width*size.height};bucket.set(key,entry);recent.set(entry,true);pixels+=entry.pixels;
  while(bucket.size>maxLevels)remove(bucket.values().next().value);
  while(recent.size>maxEntries||pixels>maxPixels)remove(recent.keys().next().value);
  return entry.canvas;
 }
 return {image,get size(){return recent.size;},get pixels(){return pixels;}};
}

const cache=createOverviewSpriteCache();
export function overviewObjectImage(c,a,source){
 const m=c.getTransform(),scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
 // Ground masks repaint the same source canvas. Their revision invalidates
 // reduced scenery immediately after edits, including equal-data Undo/Open.
 if(supportsLawnReveal(a))return scale<=OVERVIEW_SPRITE_SCALE?sceneryImage(c,source,assetMapImageRevision(source)):source;
 if(a.id==='sydney-opera-house')return sceneryImage(c,source);
 return cache.image(source,scale);
}
