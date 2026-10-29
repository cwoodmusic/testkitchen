/* Exact RGBA selections shared by the artwork and character pixel editors.
 * The clipboard stays in this page's memory; it never reads the system clipboard. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPixelSelection=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const MAX_DIMENSION=8192,MAX_AREA=16777216;
 const byteHex=Array.from({length:256},(_,value)=>value.toString(16).padStart(2,'0'));
 const dimensions=(width,height)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=MAX_DIMENSION&&height<=MAX_DIMENSION&&width*height<=MAX_AREA;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const point=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isSafeInteger);
 function validPixels(pixels,width,height){
  if(!dimensions(width,height)||!pixels||pixels.length!==width*height*4)return false;
  if(ArrayBuffer.isView(pixels)){
   const tag=Object.prototype.toString.call(pixels);
   return tag==='[object Uint8ClampedArray]'||tag==='[object Uint8Array]';
  }
  if(!Array.isArray(pixels))return false;
  for(let index=0;index<pixels.length;index++){const value=pixels[index];if(!Number.isInteger(value)||value<0||value>255)return false;}
  return true;
 }
 const validClip=clip=>!!clip&&typeof clip==='object'&&!Array.isArray(clip)&&validPixels(clip.pixels,clip.width,clip.height);
 function rectangle(a,b,width,height){
  if(!dimensions(width,height)||!point(a)||!point(b))return null;
  const left=clamp(Math.min(a[0],b[0]),0,width-1),right=clamp(Math.max(a[0],b[0]),0,width-1);
  const top=clamp(Math.min(a[1],b[1]),0,height-1),bottom=clamp(Math.max(a[1],b[1]),0,height-1);
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
 }
 function copyPixels(rgba,imageWidth,imageHeight,rect){
  if(!validPixels(rgba,imageWidth,imageHeight)||!rect||typeof rect!=='object'||Array.isArray(rect)||!Number.isSafeInteger(rect.x)||!Number.isSafeInteger(rect.y)||!dimensions(rect.width,rect.height)||!Number.isSafeInteger(rect.x+rect.width)||!Number.isSafeInteger(rect.y+rect.height))return null;
  const left=clamp(rect.x,0,imageWidth),top=clamp(rect.y,0,imageHeight),right=clamp(rect.x+rect.width,0,imageWidth),bottom=clamp(rect.y+rect.height,0,imageHeight);
  const width=right-left,height=bottom-top;if(width<=0||height<=0)return null;
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++){
   const start=((top+y)*imageWidth+left)*4,end=start+width*4;
   pixels.set(Array.isArray(rgba)?rgba.slice(start,end):rgba.subarray(start,end),y*width*4);
  }
  return {width,height,pixels};
 }
 function stampPixels(clip,imageWidth,imageHeight,x,y){
  if(!validClip(clip)||!dimensions(imageWidth,imageHeight)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(x+clip.width)||!Number.isSafeInteger(y+clip.height))return [];
  const left=Math.max(0,-x),top=Math.max(0,-y),right=Math.min(clip.width,imageWidth-x),bottom=Math.min(clip.height,imageHeight-y);
  if(right<=left||bottom<=top)return [];
  const points=[],colours=new Map(),rgba=clip.pixels;
  for(let yy=top;yy<bottom;yy++)for(let xx=left;xx<right;xx++){
   const at=(yy*clip.width+xx)*4,value=(rgba[at]|rgba[at+1]<<8|rgba[at+2]<<16|rgba[at+3]<<24)>>>0;
   let colour=colours.get(value);if(colour===undefined){colour='#'+byteHex[rgba[at]]+byteHex[rgba[at+1]]+byteHex[rgba[at+2]]+byteHex[rgba[at+3]];colours.set(value,colour);}
   points.push([x+xx,y+yy,colour]);
  }
  return points;
 }
 function resizeClip(clip,width,height){
  if(!validClip(clip)||!dimensions(width,height))return null;
  const pixels=new Uint8ClampedArray(width*height*4),source=clip.pixels;
  for(let y=0;y<height;y++){
   const sourceY=Math.floor(y*clip.height/height);
   for(let x=0;x<width;x++){
    const from=(sourceY*clip.width+Math.floor(x*clip.width/width))*4,to=(y*width+x)*4;
    for(let channel=0;channel<4;channel++)pixels[to+channel]=source[from+channel];
   }
  }
  return {width,height,pixels};
 }
 let saved=null;
 const cloneClip=clip=>({width:clip.width,height:clip.height,pixels:new Uint8ClampedArray(clip.pixels)});
 const clipboard=Object.freeze({
  set(clip){if(!validClip(clip))return false;saved=cloneClip(clip);return true;},
  get(){return saved?cloneClip(saved):null;},
  clear(){saved=null;},
  has(){return saved!==null;}
 });
 return Object.freeze({MAX_DIMENSION,MAX_AREA,rectangle,copyPixels,resizeClip,stampPixels,clipboard});
});
