import {arcadeFootprint,ARCADE_WALL,ARCADE_INTERIOR_SCALE,arcadeNativeSize,arcadeGeometry} from './arcade-geometry.mjs?v=opera-parallax-1';
export {arcadeFootprint,ARCADE_WALL,ARCADE_INTERIOR_SCALE,arcadeNativeSize,arcadeGeometry,arcadeFrontAtX} from './arcade-geometry.mjs?v=opera-parallax-1';
export const arcadeImage=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Coda Arcade exterior failed to load'));image.src=new URL('../assets/coda-arcade-exterior.png',import.meta.url);});
let composed;
export function drawArcade(c){
 if(!composed){
  composed=document.createElement('canvas');composed.width=arcadeNativeSize.w;composed.height=arcadeNativeSize.h;
  // Cornices and exterior walls overhang the interior floor union. Using that
  // union as an image mask sliced through the intact right facade and lounge.
  // The exact walkable polygons, entrance and actor sorting stay independent
  // of the authored exterior silhouette.
  composed.getContext('2d').drawImage(arcadeImage,0,156,arcadeNativeSize.w,arcadeFootprint.height-156);
 }
 c.save();c.imageSmoothingEnabled=false;c.scale(ARCADE_INTERIOR_SCALE,ARCADE_INTERIOR_SCALE);c.drawImage(composed,0,0);c.restore();
}
