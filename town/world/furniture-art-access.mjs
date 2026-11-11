import {cardinalFacing,furnitureFacingPlacement} from './furniture-facing.mjs?v=interior-design-1';

/** Metadata rejects distant objects before any view/canvas getter can warm art. */
export function furnitureFacingPointHit(asset,object,pose,point){
 const bounds=furnitureFacingPlacement(asset,object,pose,{includeImage:false});
 if(!bounds)return null;
 if(point.x<bounds.x||point.y<bounds.y||point.x>=bounds.x+bounds.w||point.y>=bounds.y+bounds.h)return false;
 const image=furnitureFacingPlacement(asset,object,pose)?.image;
 // The overview is already visible while its native crop loads. Accept that
 // first click instead of alpha-testing a still-transparent pending canvas.
 if(bounds.view?.ready===false)return true;
 if(!image?.getContext)return true;
 const x=Math.min(image.width-1,Math.floor((point.x-bounds.x)/bounds.w*image.width)),y=Math.min(image.height-1,Math.floor((point.y-bounds.y)/bounds.h*image.height));
 return image.getContext('2d').getImageData(x,y,1,1).data[3]>40;
}

/** Rotations are relative to each asset's original authored South view. */
const artDirection=(asset,rotation)=>asset.wallMounted||asset.layer==='ground'?'south':cardinalFacing(rotation);
export function ensureFacingArt(asset,rotation=0){return asset?.ensureFull?.(artDirection(asset,rotation));}
export async function preparePlacedFacingArt(project,catalog){
 const jobs=[],seen=new Map();
 for(const object of project.objects){
  const asset=catalog.get(object.asset);if(typeof asset?.ensureFull!=='function')continue;
  const direction=artDirection(asset,object.rotation);let facings=seen.get(asset);if(!facings)seen.set(asset,facings=new Set());
  if(!facings.has(direction)){
   facings.add(direction);const owner=asset.legacyFurnitureFacingOwner||asset.collectionOwner||asset.apartmentCollection||asset.owner;
   const group=owner?`${asset.legacyFurnitureFacingProvider||asset.pack||''}\u0000${owner}\u0000${direction}`:null;
   jobs.push({asset,direction,group,index:jobs.length});
  }
 }
 // Complete one known source family before cycling through other owners;
 // otherwise alternating map placements can evict a board before its next crop.
 jobs.sort((a,b)=>a.group===b.group?a.index-b.index:a.group===null?1:b.group===null?-1:a.group<b.group?-1:1);
 // The source LRU limits retained images. Bound pending imports as well, so
 // restoring a large town cannot decode every direction board concurrently.
 const failures=[];let index=0;
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(index<jobs.length){const {asset,direction}=jobs[index++];try{await asset.ensureFull(direction);}catch(error){failures.push(error);}}}));
 // A room invalidates its cached background after this settles. Wait for all
 // other artwork even when one source fails, so late arrivals remain visible.
 if(failures.length)throw failures[0];
}
