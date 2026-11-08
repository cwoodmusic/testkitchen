// Fountain motion is a small, masked foreground overlay. It never moves a
// stone rim, the lyre, flowers, or any other part of the original artwork.
export const FOUNTAIN_CYCLE=4,FOUNTAIN_FPS=12;
const frames=FOUNTAIN_CYCLE*FOUNTAIN_FPS,TAU=Math.PI*2,cache=new WeakMap();
let motionQuery;
const reduced=()=>globalThis.matchMedia?(motionQuery??=globalThis.matchMedia('(prefers-reduced-motion: reduce)')).matches:false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=(v,n)=>((v%n)+n)%n;

export const supportsFountainMotion=a=>a?.id==='music-square'||a?.id==='props-0-360'||/fountain/i.test(a?.name||'');
export function fountainRegion(a,width,height){
 return a.id==='music-square'?{x:Math.floor(width*.39),y:Math.floor(height*.35),w:Math.ceil(width*.23),h:Math.ceil(height*.22)}:{x:0,y:0,w:width,h:height};
}
export function fountainMask({data,width,height}){
 const mask=new Uint8Array(width*height),jets=new Uint8Array(mask.length),queue=[];
 const pale=i=>{const k=i*4,r=data[k],g=data[k+1],b=data[k+2];return data[k+3]>200&&r>100&&g>=r*.98&&b>=r*.96&&g>125&&b>125;};
 for(let i=0;i<mask.length;i++){
  const k=i*4,r=data[k],g=data[k+1],b=data[k+2];
  if(data[k+3]>200&&b>=60&&g>=75&&b>r*1.14&&g>r*1.2&&b>g*.76){mask[i]=1;queue.push(i);}
 }
 // Pale jet highlights are only water when they touch that same cyan water.
 // Warm pale stone therefore cannot get swept into the animation mask.
 for(let n=0;n<queue.length;n++){
  const i=queue[n],x=i%width,y=Math.floor(i/width);
  for(const j of [x?i-1:-1,x+1<width?i+1:-1,y?i-width:-1,y+1<height?i+width:-1])if(j>=0&&!mask[j]&&pale(j)){mask[j]=1;queue.push(j);}
 }
 for(let i=0;i<mask.length;i++)if(mask[i]){const k=i*4;jets[i]=data[k]+data[k+1]+data[k+2]>490&&data[k]>110?1:0;}
 return {mask,jets};
}
function prepare(a,image){
 if(cache.has(image))return cache.get(image);
 const region=fountainRegion(a,image.width,image.height),sample=document.createElement('canvas');sample.width=region.w;sample.height=region.h;
 const g=sample.getContext('2d',{willReadFrequently:true});g.drawImage(image,region.x,region.y,region.w,region.h,0,0,region.w,region.h);
 const original=g.getImageData(0,0,region.w,region.h),{mask,jets}=fountainMask(original);
 let x0=region.w,y0=region.h,x1=-1,y1=-1;
 for(let i=0;i<mask.length;i++)if(mask[i]){const x=i%region.w,y=Math.floor(i/region.w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<0){cache.set(image,null);return null;}
 const width=x1-x0+1,height=y1-y0+1,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d'),pixels=c.createImageData(width,height),entry={canvas,c,pixels,original:original.data,mask,jets,region,width,height,x0,y0,x:region.x+x0,y:region.y+y0,index:-1};
 cache.set(image,entry);return entry;
}

export function fountainFrame(a,image,time=0){
 if(!supportsFountainMotion(a))return null;
 const entry=prepare(a,image);if(!entry)return null;
 const index=reduced()?0:wrap(Math.floor((Number.isFinite(time)?time:0)*FOUNTAIN_FPS),frames);
 if(entry.index===index)return entry;
 const phase=index/frames*TAU,{width,height,x0,y0,mask,jets,original,pixels,region}=entry,stride=region.w;
 pixels.data.fill(0);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const X=x+x0,Y=y+y0,i=Y*stride+X;if(!mask[i])continue;
  // The pool's painted caustics ripple locally. Sampling is confined to the
  // water mask, so a moving reflection can never pull a stone pixel inward.
  const dx=Math.round((Math.sin(Y*.085+phase*2)-Math.sin(Y*.085))*1.8),dy=Math.round((Math.sin(X*.07-phase)-Math.sin(X*.07))*1.2);
  const nx=X+dx,ny=Y+dy,j=nx>=0&&ny>=0&&nx<region.w&&ny<region.h&&mask[ny*stride+nx]?ny*stride+nx:i;
  const from=(jets[i]?i:j)*4,to=(y*width+x)*4;
  // Fine bright bands travel down the actual pale jet silhouette. Their
  // position changes, rather than pulsing the brightness of the whole pool.
  const falling=jets[i]?((Math.sin(Y*.21+X*.013-phase*9)-Math.sin(Y*.21+X*.013))*13+(Math.sin(Y*.43-phase*11)-Math.sin(Y*.43))*5):0;
  pixels.data[to]=clamp(original[from]+falling,0,255);pixels.data[to+1]=clamp(original[from+1]+falling,0,255);pixels.data[to+2]=clamp(original[from+2]+falling,0,255);pixels.data[to+3]=original[i*4+3];
 }
 entry.c.putImageData(pixels,0,0);entry.index=index;return entry;
}

// The caller already applies the object's anchor, rotation and scale.
export function drawFountainMotion(c,a,image,time=0){
 if(!supportsFountainMotion(a)||reduced()||!Number.isFinite(time)||wrap(Math.floor(time*FOUNTAIN_FPS),frames)===0)return;
 const frame=fountainFrame(a,image,time);if(frame)c.drawImage(frame.canvas,frame.x,frame.y);
}
