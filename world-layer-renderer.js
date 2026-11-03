/* Canvas-only foreground sources and image partitions share world coordinates. */
(function(root){
 'use strict';
 root.createCodaWorldLayerRenderer=function({width,height,getStamp,render}){
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const partitions=new WeakMap();let surface=null,surfaceStamp=null,samples=0,builds=0;
  function getSurface(){
   samples++;const next=getStamp();if(surface&&next===surfaceStamp)return surface;
   if(!surface)surface=make(width,height);
   const context=surface.getContext('2d');context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';context.filter='none';context.imageSmoothingEnabled=false;
   context.fillStyle='#050716';context.fillRect(0,0,width,height);render(context);surfaceStamp=next;builds++;return surface;
  }
  function pathFor(owner,index,box){
   const path=new Path2D(),{minX,minY,maxX,maxY}=box;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;){
    if(owner[y*width+x]!==index){x++;continue;}
    const start=x;while(x<=maxX&&owner[y*width+x]===index)x++;path.rect(start,y,x-start,1);
   }
   return path;
  }
  function split(asset,raw,frame,erased){
   if(!raw||asset.layer==='back'||asset.ignoreBackgroundMasks===true||!erased)return {raw,above:raw,behind:null};
   const [sx,sy,sw,sh]=frame;if(sw<=0||sh<=0||asset.w<=0||asset.h<=0)return {raw,above:raw,behind:null};
   const key=JSON.stringify([asset.x,asset.y,asset.w,asset.h,asset.rotation,asset.flipX===true,asset.flipY===true,...frame]),cached=partitions.get(asset);
   if(cached&&cached.key===key&&cached.raw===raw&&cached.erased===erased)return cached;
   const mask=make(raw.naturalWidth||raw.width,raw.naturalHeight||raw.height),mg=mask.getContext('2d',{willReadFrequently:true});mg.imageSmoothingEnabled=false;
   mg.translate(sx+sw/2,sy+sh/2);mg.scale(sw/asset.w*(asset.flipX===true?-1:1),sh/asset.h*(asset.flipY===true?-1:1));mg.rotate(-asset.rotation*Math.PI/180);mg.translate(-asset.x,-asset.y);mg.drawImage(erased,0,0);
   const pixels=mg.getImageData(0,0,mask.width,mask.height);let any=false;
   for(let at=3;at<pixels.data.length;at+=4){const alpha=pixels.data[at]>=128?255:0;pixels.data[at]=alpha;if(alpha)any=true;}
   let above=raw,behind=null;
   if(any){
    mg.setTransform(1,0,0,1,0,0);mg.putImageData(pixels,0,0);
    above=make(mask.width,mask.height);const fg=above.getContext('2d');fg.drawImage(raw,0,0);fg.globalCompositeOperation='destination-out';fg.drawImage(mask,0,0);
    behind=make(mask.width,mask.height);const bg=behind.getContext('2d');bg.drawImage(raw,0,0);bg.globalCompositeOperation='destination-in';bg.drawImage(mask,0,0);

   }
   const result={key,raw,erased,above,behind};partitions.set(asset,result);return result;
  }
  return {getSurface,pathFor,split,snapshot:()=>({samples,builds,width:surface?.width||0,height:surface?.height||0}),invalidate(){surfaceStamp=null;}};
 };
})(window);
