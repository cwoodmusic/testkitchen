// Every native source pixel belongs to exactly one layer. Keeping the original
// RGBA value once avoids darkening translucent roofs, shadows and rail gaps.
export function splitScenePixels(data,width,height,owners,bounds){
 const base=new Uint8ClampedArray(data),parts=bounds.map(b=>({bounds:b,data:new Uint8ClampedArray(b.w*b.h*4)}));
 for(let i=0;i<owners.length;i++)if(owners[i])base[i*4+3]=0;
 for(let index=0;index<parts.length;index++){
  const {bounds:b,data:out}=parts[index];
  for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){
   const at=(y+b.y)*width+x+b.x;if(owners[at]!==index+1)continue;
   const source=at*4,target=(y*b.w+x)*4;out[target]=data[source];out[target+1]=data[source+1];out[target+2]=data[source+2];out[target+3]=data[source+3];
  }
 }
 return {base,parts};
}
const defaultCanvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const rectBounds=(part,width,height,a)=>{
 const xs=part.outline.map(p=>p[0]*width/a.w),ys=part.outline.map(p=>p[1]*height/a.h),x=Math.max(0,Math.floor(Math.min(...xs))),y=Math.max(0,Math.floor(Math.min(...ys)));
 return {x,y,w:Math.max(0,Math.min(width,Math.ceil(Math.max(...xs)))-x),h:Math.max(0,Math.min(height,Math.ceil(Math.max(...ys)))-y)};
};

export function createScenePartitionCache({maxPixels=16*1024*1024,createCanvas=defaultCanvas}={}){
 const sources=new WeakMap(),recent=new Map();let pixels=0;
 function forget(entry){entry.bucket.delete(entry.key);if(!entry.bucket.size)sources.delete(entry.source);recent.delete(entry);pixels-=entry.pixels;}
 function write(canvas,data,width,height){const c=canvas.getContext('2d'),image=c.createImageData(width,height);image.data.set(data);c.putImageData(image,0,0);}
 function specification(a,source,order){
  const width=source.width,height=source.height,bounds=a.sceneParts.map(p=>rectBounds(p,width,height,a)),owners=new Uint16Array(width*height);
  for(const index of order){
   const b=bounds[index];if(!b.w||!b.h)continue;
   const mask=createCanvas(b.w,b.h),c=mask.getContext('2d',{willReadFrequently:true});c.fillStyle='#fff';c.beginPath();
   a.sceneParts[index].outline.forEach(([x,y],i)=>{const X=x*width/a.w-b.x,Y=y*height/a.h-b.y;if(i)c.lineTo(X,Y);else c.moveTo(X,Y);});c.closePath();c.fill();
   const rgba=c.getImageData(0,0,b.w,b.h).data;
   for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++)if(rgba[(y*b.w+x)*4+3]>=128)owners[(y+b.y)*width+x+b.x]=index+1;
  }
  return {bounds,owners,width,height};
 }
 function partition(a,source,revision=0,depths){
  const order=a.sceneParts.map((_,i)=>i).sort((i,j)=>(depths?.[i]??a.sceneParts[i].depth)-(depths?.[j]??a.sceneParts[j].depth)||i-j),orderKey=order.join(','),width=source.width,height=source.height;
  let bucket=sources.get(source);if(!bucket){bucket=new Map();sources.set(source,bucket);}
  const key=[width,height,a.w,a.h,orderKey,revision].join('|');let entry=bucket.get(key);
  if(entry&&entry.partsRef!==a.sceneParts){forget(entry);entry=null;}
  if(!sources.has(source))sources.set(source,bucket);
  if(!entry){
   const sibling=[...bucket.values()].find(e=>e.partsRef===a.sceneParts&&e.width===width&&e.height===height&&e.orderKey===orderKey&&e.assetWidth===a.w&&e.assetHeight===a.h);
   const spec=sibling?.spec||specification(a,source,order),base=createCanvas(width,height),parts=spec.bounds.map(b=>({...b,canvas:createCanvas(Math.max(1,b.w),Math.max(1,b.h))}));
   entry={source,bucket,key,partsRef:a.sceneParts,width,height,assetWidth:a.w,assetHeight:a.h,orderKey,spec,base,parts,revision:null,pixels:width*height+Math.ceil(spec.owners.byteLength/4)+parts.reduce((n,p)=>n+p.canvas.width*p.canvas.height,0)};
   bucket.set(key,entry);pixels+=entry.pixels;
  }
  if(entry.revision!==revision){
   const sample=createCanvas(width,height),c=sample.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0);const rgba=c.getImageData(0,0,width,height).data;
   const split=splitScenePixels(rgba,width,height,entry.spec.owners,entry.spec.bounds);write(entry.base,split.base,width,height);
   for(let i=0;i<entry.parts.length;i++){const part=entry.parts[i];if(part.w&&part.h)write(part.canvas,split.parts[i].data,part.w,part.h);}
   entry.revision=revision;
  }
  recent.delete(entry);recent.set(entry,true);
  while(recent.size&&pixels>maxPixels)forget(recent.keys().next().value);
  return entry;
 }
 return {partition,get pixels(){return pixels;},get size(){return recent.size;}};
}
export const scenePartitionCache=createScenePartitionCache();
