// Water keeps its native pixels and palette. A small periodic displacement
// moves the painted wavelets while leaving the terrain's shoreline untouched.
export const WATER_CYCLE=12,WATER_FPS=12;
const frames=WATER_CYCLE*WATER_FPS,cache=new WeakMap(),TAU=Math.PI*2;
const levelZeroCutouts=new WeakSet();
let waterTime=0,motionQuery;
const wrap=(n,size)=>((n%size)+size)%size;
const reduced=()=>globalThis.matchMedia?(motionQuery??=globalThis.matchMedia('(prefers-reduced-motion: reduce)')).matches:false;
// Reversing the native field on its far side keeps every source pixel at its
// original scale while matching both opposing edges. Repeating the original
// image directly exposed its different corner brightness as square panels.
export function mirroredWaterIndex(n,size){const i=wrap(n,size*2);return i<size?i:size*2-1-i;}

export function setWaterTime(seconds=0){waterTime=Number.isFinite(seconds)?seconds:0;}
export function waterFrameIndex(seconds=0,still=false){return still?0:wrap(Math.floor((Number.isFinite(seconds)?seconds:0)*WATER_FPS),frames);}
export function currentWaterFrameIndex(seconds=waterTime){return waterFrameIndex(seconds,reduced());}
export function withLevelZeroWaterCutout(c,draw){const nested=levelZeroCutouts.has(c);levelZeroCutouts.add(c);try{return draw();}finally{if(!nested)levelZeroCutouts.delete(c);}}

// Integer harmonics meet at both texture edges. Because the field is global,
// adjacent 64px terrain cells sample one continuous body of moving water.
export function waterDisplacements(width,height,index){
 const phase=wrap(index,frames)/frames*TAU,x=new Int8Array(height),y=new Int8Array(width);
 for(let row=0;row<height;row++){
  const a=row/height*TAU*3,b=row/height*TAU*7;
  x[row]=Math.round((Math.sin(a+phase)-Math.sin(a))*2.6+(Math.sin(b-phase*2)-Math.sin(b))*.8);
 }
 for(let col=0;col<width;col++){
  const a=col/width*TAU*4;
  y[col]=Math.round((Math.sin(a-phase)-Math.sin(a))*1.8);
 }
 return {x,y};
}

export function waterFrame(source,time=waterTime){
 const index=waterFrameIndex(time,reduced());
 let entry=cache.get(source);
 if(!entry){
  const sourceWidth=source.width,sourceHeight=source.height,width=sourceWidth*2,height=sourceHeight*2;
  const input=document.createElement('canvas');input.width=sourceWidth;input.height=sourceHeight;const read=input.getContext('2d',{willReadFrequently:true});read.drawImage(source,0,0);
  const original=new Uint32Array(read.getImageData(0,0,sourceWidth,sourceHeight).data.buffer),canvas=document.createElement('canvas'),still=document.createElement('canvas');
  canvas.width=still.width=width;canvas.height=still.height=height;
  const c=canvas.getContext('2d',{willReadFrequently:true}),image=c.createImageData(width,height),pixels=new Uint32Array(image.data.buffer);
  // Extended lookups avoid modulo arithmetic for each moving native pixel.
  const mirrorX=Int32Array.from({length:width+14},(_,i)=>mirroredWaterIndex(i-7,sourceWidth));
  const mirrorY=Int32Array.from({length:height+8},(_,i)=>mirroredWaterIndex(i-4,sourceHeight)*sourceWidth);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels[y*width+x]=original[mirrorY[y+4]+mirrorX[x+7]];
  still.getContext('2d').putImageData(image,0,0);
  entry={sourceWidth,width,height,canvas,still,c,original,image,pixels,mirrorX,mirrorY,index:-1};cache.set(source,entry);
 }
 // Upload generated wave pixels off the animation thread. Keep the last
 // completed bitmap while a single replacement is in flight.
 if(!entry.workerTried){
  entry.workerTried=true;
  if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined')try{
   const worker=new Worker(new URL('./water-worker.mjs?v=opera-smooth-1',import.meta.url),{type:'module'}),copy=entry.original.slice();entry.worker=worker;
   worker.onmessage=({data})=>{entry.moving?.close();entry.moving=data.image;entry.movingIndex=data.index;entry.pending=false;};
   worker.onerror=()=>{worker.terminate();entry.worker=null;entry.pending=false;entry.moving?.close();entry.moving=null;};
   worker.postMessage({original:copy,sourceWidth:entry.sourceWidth,width:entry.width,height:entry.height},[copy.buffer]);
  }catch{entry.worker=null;}
 }
 if(entry.worker){
  if(index===0)return entry.still;
  if(!entry.pending&&entry.movingIndex!==index){entry.pending=true;entry.worker.postMessage({index});}
  return entry.moving||entry.still;
 }
 if(index===0)return entry.still;
 if(entry.index===index)return entry.canvas;
 const {width,height,original,pixels,mirrorX,mirrorY}=entry,displacement=waterDisplacements(width,height,index);
 for(let row=0;row<height;row++){
  const start=displacement.x[row]+7,offset=row*width,y=row+4;
  for(let col=0;col<width;col++)pixels[offset+col]=original[mirrorY[y+displacement.y[col]]+mirrorX[col+start]];
 }
 entry.c.putImageData(entry.image,0,0);entry.index=index;return entry.canvas;
}

export function drawAnimatedWater(c,source,x,y,X,Y){
 if(levelZeroCutouts.has(c)&&Math.abs(y*64-Y)<.001){c.clearRect(X,Y,64,64);return;}
 const image=waterFrame(source);c.drawImage(image,wrap(x*64,image.width),wrap(y*64,image.height),64,64,X,Y,64,64);
}
