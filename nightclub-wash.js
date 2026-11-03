/* Soft club atmosphere stays inside the current rectangular room. Rasterize
 * the inward edge fade once; each frame reuses a half-size lighting surface. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaNightclubWash=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const POLYGON=Object.freeze([[50,507],[725,507],[725,649],[807,649],[807,806],[777,829],[728,837],[119,837],[96,812],[69,812],[69,649],[50,649]].map(Object.freeze));
 function contains(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  let inside=false;
  for(let i=0,j=POLYGON.length-1;i<POLYGON.length;j=i++){
   const a=POLYGON[i],b=POLYGON[j];
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 }
 function alphaAt(x,y,feather=40){
  if(!contains(x,y))return 0;
  let squared=Infinity;
  for(let i=0;i<POLYGON.length;i++){
   const a=POLYGON[i],b=POLYGON[(i+1)%POLYGON.length],dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
   squared=Math.min(squared,(x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2);
  }
  const distance=Math.sqrt(squared),radius=Number.isFinite(feather)&&feather>0?feather:40,t=Math.min(1,distance/radius);
  return Math.round(255*t*t*(3-2*t));
 }
 function create(options={}){
  const doc=options.document||(typeof document==='undefined'?null:document),width=Number.isFinite(options.width)?options.width:1672,height=Number.isFinite(options.height)?options.height:941;
  const scale=Number.isFinite(options.scale)?Math.max(.125,Math.min(1,options.scale)):.5,feather=Number.isFinite(options.feather)&&options.feather>0?options.feather:40;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||width*height>16777216)throw Error('Nightclub wash dimensions are invalid.');
  const rasterWidth=Math.ceil(width*scale),rasterHeight=Math.ceil(height*scale),sx=rasterWidth/width,sy=rasterHeight/height;
  let mask=null,surface=null,paintContext=null,builds=0,frames=0;
  function canvas(){const result=doc.createElement('canvas');result.width=rasterWidth;result.height=rasterHeight;return result;}
  function prepare(){
   if(mask)return true;if(!doc?.createElement)return false;
   const nextMask=canvas(),context=nextMask.getContext('2d'),pixels=context.createImageData(rasterWidth,rasterHeight);
   const minX=Math.max(0,Math.floor(50*sx)),maxX=Math.min(rasterWidth,Math.ceil(807*sx)),minY=Math.max(0,Math.floor(507*sy)),maxY=Math.min(rasterHeight,Math.ceil(837*sy));
   for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const at=(y*rasterWidth+x)*4,alpha=alphaAt((x+.5)/sx,(y+.5)/sy,feather);
    pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=255;pixels.data[at+3]=alpha;
   }
   context.putImageData(pixels,0,0);surface=canvas();paintContext=surface.getContext('2d');mask=nextMask;builds++;return true;
  }
  function draw(target,paint){
   if(!target||typeof paint!=='function'||!prepare())return false;
   const ctx=paintContext;
   ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.shadowBlur=0;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,rasterWidth,rasterHeight);
   ctx.save();ctx.scale(sx,sy);
   try{paint(ctx);}finally{ctx.restore();}
   ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.restore();
   target.save();
   try{
    target.globalAlpha=1;target.globalCompositeOperation='screen';target.filter='none';target.shadowBlur=0;target.imageSmoothingEnabled=true;
    // The low-resolution mask fades inward. This exact final clip also keeps
    // interpolation from touching negative space beyond the room boundary.
    target.beginPath();target.moveTo(...POLYGON[0]);for(const point of POLYGON.slice(1))target.lineTo(...point);target.closePath();target.clip();
    target.drawImage(surface,0,0,width,height);
   }finally{target.restore();}
   frames++;return true;
  }
  return {draw,getState:()=>({builds,frames,width,height,raster:[rasterWidth,rasterHeight],feather})};
 }
 return Object.freeze({POLYGON,contains,alphaAt,create});
});
