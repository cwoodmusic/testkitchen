import {assetFilter} from '../world/asset-color.mjs?v=opera-parallax-1';
import {supportsFurnitureFacing} from '../world/furniture-facing.mjs?v=opera-parallax-1';
import {drawFountainMotion,supportsFountainMotion} from '../world/fountain-motion.mjs?v=opera-parallax-1';

const DIRECTIONS=['south','west','north','east'];
const positive=value=>Number.isFinite(value)&&value>0;
const validSize=value=>value&&positive(value.w)&&positive(value.h);

/** Review-only sample dimensions; the catalog asset and its review key stay intact. */
export function assetPreviewSample(asset){
 const sample=asset?.reviewSample;if(!sample)return null;
 const columns=sample.columns??3,rows=sample.rows??(sample.kind==='wall'?1:3),stepX=sample.stepX??asset.w;
 if(![columns,rows,stepX].every(positive))throw new TypeError('Invalid material sample dimensions.');
 return {...sample,columns,rows,stepX,width:asset.w+(columns-1)*stepX,height:asset.h*rows,tileWidth:asset.w,tileHeight:asset.h};
}

/** Discover usable game views without warming an image or allocating a canvas. */
export function availableFacings(asset){
 if(!asset)return [];
 if(!supportsFurnitureFacing(asset))return ['south'];
 if(typeof asset.getFacingView!=='function')return [...DIRECTIONS];
 const available=[];
 for(const direction of DIRECTIONS){
  try{if(validSize(asset.getFacingView(direction,{image:false})))available.push(direction);}catch{}
 }
 return available.length?available:['south'];
}

function nativeCrop(asset,facing,width,height){
 const source=asset.getFacingDrawSource(facing,{native:true});
 if(!source?.image||source.native===false)throw Error('Full-size artwork is not ready for '+asset.id+' / '+facing+'.');
 const image=source.image,sx=source.sx??0,sy=source.sy??0,sw=source.sw??image.naturalWidth??image.width,sh=source.sh??image.naturalHeight??image.height;
 const dx=source.dx??0,dy=source.dy??0,dw=source.dw??width,dh=source.dh??height;
 if(![sx,sy,dx,dy].every(Number.isFinite)||![sw,sh,dw,dh].every(positive))throw Error('Invalid artwork crop for '+asset.id+' / '+facing+'.');
 return c=>c.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);
}

/**
 * Prepare just the selected native view. The caller owns its one display
 * canvas, zoom and background; no full-catalog raster cache is created here.
 */
export async function prepareAssetPreview(asset,facing='south'){
 if(!asset||!validSize(asset))throw new TypeError('This asset has invalid preview dimensions.');
 if(!availableFacings(asset).includes(facing))throw new RangeError('That asset does not have a '+facing+' view.');
 await asset.ensureFull?.(facing);
 const directional=supportsFurnitureFacing(asset),view=directional?asset.getFacingView?.(facing,{image:false}):null;
 const assetWidth=validSize(view)?view.w:asset.w,assetHeight=validSize(view)?view.h:asset.h;
 let paint;
 if(directional&&typeof asset.getFacingDrawSource==='function')paint=nativeCrop(asset,facing,assetWidth,assetHeight);
 else if(directional){
  const image=asset.getFacingImage?.(facing)||view?.canvas||view?.image;
  if(!image)throw Error('Artwork is unavailable for '+asset.id+' / '+facing+'.');
  paint=c=>c.drawImage(image,0,0,assetWidth,assetHeight);
 }else if(typeof asset.draw==='function')paint=c=>asset.draw(c);
 else throw Error('This asset has no preview drawing: '+asset.id+'.');
 const sample=assetPreviewSample(asset),width=sample?.width??assetWidth,height=sample?.height??assetHeight;
 if(sample){
  if(typeof asset.drawReviewSample==='function')paint=c=>asset.drawReviewSample(c,width,height);
  else{
   const original=paint;paint=c=>{
    for(let row=0;row<sample.rows;row++)for(let column=0;column<sample.columns;column++){
     c.save();try{c.translate(column*sample.stepX,row*assetHeight);original(c);}finally{c.restore();}
    }
   };
  }
 }
 const filter=assetFilter(asset),animated=supportsFountainMotion(asset);let motionSource;
 return {width,height,facing,sample,actualFacing:view?.facing||asset.facing||facing,animated,draw(c,time=0){
  c.save();
  try{
   c.imageSmoothingEnabled=false;c.filter=filter;paint(c);
   if(animated&&time>0){
    // Retain only the selected fountain view. Its graded native water pixels
    // use the same motion mask as the game; surrounding stone stays still.
    if(!motionSource){motionSource=document.createElement('canvas');motionSource.width=width;motionSource.height=height;const g=motionSource.getContext('2d');g.imageSmoothingEnabled=false;g.filter=filter;paint(g);}
    c.filter='none';drawFountainMotion(c,asset,motionSource,time);
   }
  }finally{c.restore();}
 }};
}
