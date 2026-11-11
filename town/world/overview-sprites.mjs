import {supportsLawnReveal} from './asset-lawn.mjs?v=wall-caps-1';

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
 const c=document.createElement('canvas');c.width=width;c.height=height;return c;
}}={}){
 const sources=new WeakMap(),recent=new Map();let pixels=0;
 function remove(entry){entry.bucket.delete(entry.key);recent.delete(entry);pixels-=entry.pixels;}
 function image(source,scale){
  const size=overviewSpriteSize(source.width,source.height,scale);if(!size)return source;
  let bucket=sources.get(source);if(!bucket){bucket=new Map();sources.set(source,bucket);}
  const previous=bucket.values().next().value;
  if(previous&&(previous.sourceWidth!==source.width||previous.sourceHeight!==source.height))for(const old of bucket.values())remove(old);
  const key=size.level;let entry=bucket.get(key);
  if(entry){bucket.delete(key);bucket.set(key,entry);recent.delete(entry);recent.set(entry,true);return entry.canvas;}
  const canvas=createCanvas(size.width,size.height),c=canvas.getContext('2d');
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,size.width,size.height);
  entry={bucket,key,canvas,sourceWidth:source.width,sourceHeight:source.height,pixels:size.width*size.height};bucket.set(key,entry);recent.set(entry,true);pixels+=entry.pixels;
  while(bucket.size>maxLevels)remove(bucket.values().next().value);
  while(recent.size>maxEntries||pixels>maxPixels)remove(recent.keys().next().value);
  return canvas;
 }
 return {image,get size(){return recent.size;},get pixels(){return pixels;}};
}

const cache=createOverviewSpriteCache();
export function overviewObjectImage(c,a,source){
 // Contextual lawn masks can repaint an existing canvas after a terrain edit.
 // These scenes retain their original source rather than a stale reduced copy.
 if(supportsLawnReveal(a))return source;
 const m=c.getTransform(),scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
 return cache.image(source,scale);
}
