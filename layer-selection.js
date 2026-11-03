/* Pixel-exact selections for the world and room foreground masks. */
(function(root,factory){const api=factory(root?.CodaPixelSelection||(typeof require==='function'?require('./pixel-selection.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaLayerSelection=api;})(typeof window==='undefined'?null:window,function(pixels){
 'use strict';
 const clone=value=>value===null?null:JSON.parse(JSON.stringify(value));
 const dimensions=(width,height)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=8192&&height<=8192&&width*height<=16777216;
 function validate(selection,width,height){
  if(!pixels||!dimensions(width,height)||!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(key=>!['x','y','width','height','points'].includes(key)))return false;
  const {x,y,width:w,height:h}=selection;
  if(![x,y,w,h].every(Number.isSafeInteger)||x<0||y<0||w<1||h<1||x+w>width||y+h>height)return false;
  if(selection.points===undefined)return true;
  const normalized=pixels.polygonSelection(selection.points,width,height);
  return !!normalized&&normalized.x===x&&normalized.y===y&&normalized.width===w&&normalized.height===h&&normalized.points.length===selection.points.length&&normalized.points.every((point,index)=>point[0]===selection.points[index][0]&&point[1]===selection.points[index][1]);
 }
 // One scanline intersection per edge, followed by merged integer ranges. An
 // edge owns the pixel centres it crosses, including horizontal edges/vertices.
 function rowRanges(points,y,left,right){
  const intersections=[],ranges=[];
  const add=(start,end)=>{start=Math.max(left,start);end=Math.min(right-1,end);if(end>=start)ranges.push([start,end]);};
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [ax,ay]=points[j],[bx,by]=points[i];
   if(y===ay)add(ax,ax);if(y===by)add(bx,bx);
   if(ay===by){if(y===ay)add(Math.min(ax,bx),Math.max(ax,bx));continue;}
   if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);
  }
  intersections.sort((a,b)=>a-b);
  for(let i=0;i+1<intersections.length;i+=2)add(Math.ceil(intersections[i]),Math.floor(intersections[i+1]));
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1]+1)last[1]=Math.max(last[1],range[1]);else merged.push(range);}
  return merged;
 }
 function eachSpan(selection,callback){
  if(typeof callback!=='function'||!selection||!validate(selection,selection.x+selection.width,selection.y+selection.height))return false;
  const {x,y,width,height,points}=selection;
  for(let yy=y;yy<y+height;yy++){
   if(!points)callback(x,yy,width,1);
   else for(const [left,right]of rowRanges(points,yy,x,x+width))callback(left,yy,right-left+1,1);
  }
  return true;
 }
 function create({width,height,onChange}={}){
  if(!pixels||!dimensions(width,height))throw Error('Layer selection needs valid image dimensions.');
  let shape='rectangle',selection=null,draft=null,start=null,dragging=false;
  const point=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)?value.map((coordinate,index)=>Math.max(0,Math.min((index?height:width)-1,Math.floor(coordinate)))):null;
  const getState=()=>({shape,selection:clone(selection),draft:clone(draft),dragging});
  const notify=()=>onChange?.(getState());
  function cancel(){const pending=!!draft||dragging;draft=null;start=null;dragging=false;if(pending)notify();return pending;}
  function clear(){const previous=!!selection||!!draft||dragging;selection=null;draft=null;start=null;dragging=false;if(previous)notify();return previous;}
  function setShape(value){if(!['rectangle','manual'].includes(value))return false;cancel();shape=value;notify();return true;}
  function down(value){
   const p=point(value);if(!p)return false;
   if(shape==='rectangle'){start=p;dragging=true;draft=pixels.rectangle(p,p,width,height);}
   else{
    if(!draft)draft=[];
    if(draft.length>=pixels.MAX_POLYGON_POINTS)return false;
    const previous=draft.at(-1);if(previous&&previous[0]===p[0]&&previous[1]===p[1])return false;
    draft.push(p);
   }
   notify();return true;
  }
  function move(value){const p=point(value);if(!p||!dragging)return false;draft=pixels.rectangle(start,p,width,height);notify();return true;}
  function end(){if(!dragging)return false;selection=draft;draft=null;start=null;dragging=false;notify();return true;}
  function finish(){
   if(shape==='rectangle')return end();
   const next=pixels.polygonSelection(draft,width,height);if(!next)return false;
   selection=next;draft=null;notify();return true;
  }
  function draw(ctx,scale=1){
   if(!ctx)return;scale=Number.isFinite(scale)&&scale>0?scale:1;
   const pendingRectangle=dragging?draft:null,visible=pendingRectangle||selection;
   ctx.save();ctx.fillStyle='#8bcfff24';ctx.strokeStyle='#b8e4ff';ctx.lineWidth=1.5/scale;ctx.setLineDash([5/scale,4/scale]);
   if(visible){
    if(!visible.points)ctx.fillRect(visible.x,visible.y,visible.width,visible.height);
    else eachSpan(visible,(x,y,w,h)=>ctx.fillRect(x,y,w,h));
    if(visible.points){ctx.beginPath();visible.points.forEach(([x,y],index)=>index?ctx.lineTo(x+.5,y+.5):ctx.moveTo(x+.5,y+.5));ctx.closePath();ctx.stroke();}
    else ctx.strokeRect(visible.x,visible.y,visible.width,visible.height);
   }
   if(shape==='manual'&&draft?.length){
    ctx.beginPath();draft.forEach(([x,y],index)=>index?ctx.lineTo(x+.5,y+.5):ctx.moveTo(x+.5,y+.5));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#b8e4ff';for(const [x,y]of draft)ctx.fillRect(x+.5-2/scale,y+.5-2/scale,4/scale,4/scale);
   }
   ctx.restore();
  }
  return Object.freeze({setShape,down,move,end,finish,clear,cancel,getSelection:()=>clone(selection),getState,draw});
 }
 return Object.freeze({validate,eachSpan,create});
});
