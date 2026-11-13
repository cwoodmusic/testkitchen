const ID='collection-showroom-victorian-parlor-sofa';

/** The left Victorian sofa uses the right sofa's unchanged art, reflected. */
export function mirrorVictorianSofaLeft(asset,{createCanvas=()=>document.createElement('canvas')}={}){
 if(asset.id!==ID||typeof asset.getFacingView!=='function')return asset;
 const getView=asset.getFacingView.bind(asset),getImage=asset.getFacingImage?.bind(asset),getSource=asset.getFacingDrawSource?.bind(asset),ensure=asset.ensureFull?.bind(asset),east=getView('east',{image:false}),west=getView('west',{image:false});
 if(!east||!west||!getImage||!getSource)return asset;
 const view={id:west.id,w:west.w,h:west.h,facing:'west',footCenter:{x:west.w-east.footCenter.x*west.w/east.w,y:east.footCenter.y*west.h/east.h}},mirrors=new WeakMap();
 function reflect(source){
  if(!source?.image)return null;
  const image=source.image,sx=source.sx??0,sy=source.sy??0,sw=source.sw??image.width,sh=source.sh??image.height;
  if(![sx,sy,sw,sh].every(Number.isFinite)||sw<=0||sh<=0)return null;
  const key=[sx,sy,sw,sh,source.revision??0].join(','),cached=mirrors.get(image);if(cached?.has(key))return cached.get(key);
  // Reflect only this crop at its original raster resolution. In particular,
  // a high-resolution native descriptor must not shrink to logical view units.
  const canvas=createCanvas();canvas.width=Math.ceil(sw);canvas.height=Math.ceil(sh);const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(canvas.width,0);c.scale(-1,1);c.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  const entries=cached||new Map();entries.set(key,canvas);if(entries.size>4)entries.delete(entries.keys().next().value);mirrors.set(image,entries);return canvas;
 }
 function image(){const source=getImage('east');return source?reflect({image:source,sw:source.naturalWidth||source.width,sh:source.naturalHeight||source.height}):null;}
 Object.defineProperty(view,'canvas',{enumerable:true,get:image});Object.defineProperty(view,'ready',{get:()=>Boolean(getView('east',{image:false})?.ready)});
 const descriptors=new Map();
 asset.getFacingView=(facing='south',options)=>facing==='west'?view:getView(facing,options);
 asset.getFacingImage=(facing='south')=>facing==='west'?image():getImage(facing);
 asset.getFacingDrawSource=(facing='south',options)=>{
  if(facing!=='west')return getSource(facing,options);
  const source=getSource('east',options),canvas=reflect(source),key=options?.native===true?'native':'preview';let descriptor=descriptors.get(key);
  if(!descriptor){descriptor={image:null,revision:0};descriptors.set(key,descriptor);}
  const quality=source?.quality,native=Boolean(source?.native);
  if(canvas!==descriptor.image||quality!==descriptor.quality||native!==descriptor.native){
   const sx=view.w/east.w,sy=view.h/east.h,dx=(source?.dx??0),dy=source?.dy??0,dw=source?.dw??east.w,dh=source?.dh??east.h;
   Object.assign(descriptor,{image:canvas,sx:0,sy:0,sw:canvas?.width||0,sh:canvas?.height||0,dx:view.w-(dx+dw)*sx,dy:dy*sy,dw:dw*sx,dh:dh*sy,native,quality,revision:descriptor.revision+1});
  }
  return descriptor;
 };
 if(ensure)asset.ensureFull=(facing='south')=>ensure(facing==='west'?'east':facing);
 return asset;
}
