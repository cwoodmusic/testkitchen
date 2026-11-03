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
 const MAX_POLYGON_POINTS=512;
 function validMask(mask,width,height){
  if(!dimensions(width,height)||!mask||mask.length!==width*height)return false;
  if(!Array.isArray(mask)&&(!ArrayBuffer.isView(mask)||!['[object Uint8Array]','[object Uint8ClampedArray]'].includes(Object.prototype.toString.call(mask))))return false;
  for(let index=0;index<mask.length;index++)if(mask[index]!==0&&mask[index]!==1)return false;
  return true;
 }
 const validClip=clip=>!!clip&&typeof clip==='object'&&!Array.isArray(clip)&&validPixels(clip.pixels,clip.width,clip.height)&&(clip.mask===undefined||validMask(clip.mask,clip.width,clip.height));
 const validRect=rect=>!!rect&&typeof rect==='object'&&!Array.isArray(rect)&&Number.isSafeInteger(rect.x)&&Number.isSafeInteger(rect.y)&&dimensions(rect.width,rect.height)&&Number.isSafeInteger(rect.x+rect.width)&&Number.isSafeInteger(rect.y+rect.height);
 const validPolygon=points=>Array.isArray(points)&&points.length>=3&&points.length<=MAX_POLYGON_POINTS&&points.every(point);
 function polygonSelection(points,width,height){
  if(!dimensions(width,height)||!validPolygon(points))return null;
  const vertices=[];
  for(const [rawX,rawY]of points){const value=[clamp(rawX,0,width-1),clamp(rawY,0,height-1)],last=vertices.at(-1);if(!last||last[0]!==value[0]||last[1]!==value[1])vertices.push(value);}
  if(vertices.length>1&&vertices[0][0]===vertices.at(-1)[0]&&vertices[0][1]===vertices.at(-1)[1])vertices.pop();
  if(vertices.length<3)return null;
  const a=vertices[0],b=vertices.find(value=>value[0]!==a[0]||value[1]!==a[1]);
  if(!b||!vertices.some(c=>(b[0]-a[0])*(c[1]-a[1])!==(b[1]-a[1])*(c[0]-a[0])))return null;
  const xs=vertices.map(value=>value[0]),ys=vertices.map(value=>value[1]),left=Math.min(...xs),top=Math.min(...ys);
  return {x:left,y:top,width:Math.max(...xs)-left+1,height:Math.max(...ys)-top+1,points:vertices};
 }
 function containsSelection(selection,x,y){
  if(!validRect(selection)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<selection.x||y<selection.y||x>=selection.x+selection.width||y>=selection.y+selection.height)return false;
  const points=selection.points;if(points===undefined)return true;if(!validPolygon(points))return false;
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [ax,ay]=points[j],[bx,by]=points[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
   // Vertices are source-pixel centres; an edge owns the centres it crosses.
   if(cross===0&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return true;
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
 }
 function polygonRowRanges(points,y,left,right){
  const intersections=[],ranges=[];
  const add=(start,end)=>{start=Math.max(left,start);end=Math.min(right-1,end);if(end>=start)ranges.push([start,end]);};
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [ax,ay]=points[j],[bx,by]=points[i];
   if(y===ay)add(ax,ax);if(y===by)add(bx,bx);
   if(ay===by){if(y===ay)add(Math.min(ax,bx),Math.max(ax,bx));continue;}
   if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);
  }
  intersections.sort((a,b)=>a-b);
  for(let i=0;i+1<intersections.length;i+=2)add(Math.ceil(intersections[i]-1e-9),Math.floor(intersections[i+1]+1e-9));
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1]+1)last[1]=Math.max(last[1],range[1]);else merged.push(range);}
  return merged;
 }
 function rectangle(a,b,width,height){
  if(!dimensions(width,height)||!point(a)||!point(b))return null;
  const left=clamp(Math.min(a[0],b[0]),0,width-1),right=clamp(Math.max(a[0],b[0]),0,width-1);
  const top=clamp(Math.min(a[1],b[1]),0,height-1),bottom=clamp(Math.max(a[1],b[1]),0,height-1);
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
 }
 function copyPixels(rgba,imageWidth,imageHeight,rect){
  if(!validPixels(rgba,imageWidth,imageHeight)||!validRect(rect)||rect.points!==undefined&&!validPolygon(rect.points))return null;
  const left=clamp(rect.x,0,imageWidth),top=clamp(rect.y,0,imageHeight),right=clamp(rect.x+rect.width,0,imageWidth),bottom=clamp(rect.y+rect.height,0,imageHeight);
  const width=right-left,height=bottom-top;if(width<=0||height<=0)return null;
  const pixels=new Uint8ClampedArray(width*height*4),mask=rect.points?new Uint8Array(width*height):null;
  for(let y=0;y<height;y++){
   const start=((top+y)*imageWidth+left)*4,end=start+width*4;
   if(!mask)pixels.set(Array.isArray(rgba)?rgba.slice(start,end):rgba.subarray(start,end),y*width*4);
   else for(const [fromX,toX]of polygonRowRanges(rect.points,top+y,left,right)){
    const destination=y*width+fromX-left,from=((top+y)*imageWidth+fromX)*4,length=toX-fromX+1;
    mask.fill(1,destination,destination+length);pixels.set(Array.isArray(rgba)?rgba.slice(from,from+length*4):rgba.subarray(from,from+length*4),destination*4);
   }
  }
  return {width,height,pixels,...(mask?{mask}:{})};
 }
 function stampPixels(clip,imageWidth,imageHeight,x,y){
  if(!validClip(clip)||!dimensions(imageWidth,imageHeight)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(x+clip.width)||!Number.isSafeInteger(y+clip.height))return [];
  const left=Math.max(0,-x),top=Math.max(0,-y),right=Math.min(clip.width,imageWidth-x),bottom=Math.min(clip.height,imageHeight-y);
  if(right<=left||bottom<=top)return [];
  const points=[],colours=new Map(),rgba=clip.pixels;
  for(let yy=top;yy<bottom;yy++)for(let xx=left;xx<right;xx++){
   const index=yy*clip.width+xx;if(clip.mask&&!clip.mask[index])continue;
   const at=index*4,value=(rgba[at]|rgba[at+1]<<8|rgba[at+2]<<16|rgba[at+3]<<24)>>>0;
   let colour=colours.get(value);if(colour===undefined){colour='#'+byteHex[rgba[at]]+byteHex[rgba[at+1]]+byteHex[rgba[at+2]]+byteHex[rgba[at+3]];colours.set(value,colour);}
   points.push([x+xx,y+yy,colour]);
  }
  return points;
 }
 function resizeClip(clip,width,height){
  if(!validClip(clip)||!dimensions(width,height))return null;
  const pixels=new Uint8ClampedArray(width*height*4),source=clip.pixels,mask=clip.mask?new Uint8Array(width*height):null;
  for(let y=0;y<height;y++){
   const sourceY=Math.floor(y*clip.height/height);
   for(let x=0;x<width;x++){
    const sourceIndex=sourceY*clip.width+Math.floor(x*clip.width/width),index=y*width+x,from=sourceIndex*4,to=index*4;
    for(let channel=0;channel<4;channel++)pixels[to+channel]=source[from+channel];
    if(mask)mask[index]=clip.mask[sourceIndex];
   }
  }
  return {width,height,pixels,...(mask?{mask}:{})};
 }
 let saved=null;
 const cloneClip=clip=>({width:clip.width,height:clip.height,pixels:new Uint8ClampedArray(clip.pixels),...(clip.mask?{mask:new Uint8Array(clip.mask)}:{})});
 const normalizeClip=clip=>validClip(clip)?cloneClip(clip):null;
 const clipboard=Object.freeze({
  set(clip){if(!validClip(clip))return false;saved=cloneClip(clip);return true;},
  get(){return saved?cloneClip(saved):null;},
  clear(){saved=null;},
  has(){return saved!==null;}
 });
 return Object.freeze({MAX_DIMENSION,MAX_AREA,MAX_POLYGON_POINTS,rectangle,polygonSelection,containsSelection,validClip,normalizeClip,copyPixels,resizeClip,stampPixels,clipboard});
});
