import {assetImage} from './asset-color.mjs?v=north-walls-1';

// Reuse the actual architectural sprites from the town, rather than drawing
// a second, simplified window style inside the apartments.
export const INTERIOR_WINDOW_ASSETS=Object.freeze({arched:'decor-16-08',shuttered:'decor-16-09',bay:'decor-16-10'});
const warmings=new WeakMap();
export function interiorWindowAssetId(scene={},window={}){
 if(Object.values(INTERIOR_WINDOW_ASSETS).includes(window.asset))return window.asset;
 const theme=String(scene.collectionOwner||scene.showroomId||scene.resident||scene.id||'').toLowerCase();
 if(/botanical|clara|nina|zizi/.test(theme))return INTERIOR_WINDOW_ASSETS.bay;
 if(/victorian|bach|chopin|handel/.test(theme))return INTERIOR_WINDOW_ASSETS.arched;
 return INTERIOR_WINDOW_ASSETS.shuttered;
}
export function interiorWindowGeometry(window,image){
 if(!(image?.width>0&&image?.height>0))return null;
 const x=Number.isFinite(window.x)?window.x:0,y=Number.isFinite(window.y)?window.y:20,maxW=window.w>0?window.w:130,maxH=window.h>0?window.h:Math.max(36,Math.min(78,102-y)),fit=Math.min(maxW/image.width,maxH/image.height),w=image.width*fit,h=image.height*fit;
 return {x:x-w/2,y,w,h};
}
export function warmInteriorWindows(scene,catalog){
 const ids=new Set((scene?.windows||[]).map(window=>interiorWindowAssetId(scene,window))),loads=[];
 for(const id of ids){
  const asset=catalog?.get(id);if(!asset?.ensureFull)continue;
  let pending=warmings.get(asset);
  if(!pending){pending=Promise.resolve().then(()=>asset.ensureFull()).catch(error=>{warmings.delete(asset);throw error;});warmings.set(asset,pending);}
  loads.push(pending);
 }
 return Promise.all(loads);
}
export function drawInteriorWindow(c,window,{catalog,scene={}}={}){
 const id=interiorWindowAssetId(scene,window),asset=catalog?.get(id),source=asset?.canvas,geometry=interiorWindowGeometry(window,source);
 if(!geometry)return false;
 const graded=Object.create(asset);Object.defineProperty(graded,'canvas',{value:source});
 c.save();c.imageSmoothingEnabled=false;c.drawImage(assetImage(graded),geometry.x,geometry.y,geometry.w,geometry.h);c.restore();
 return {asset:id,...geometry};
}
