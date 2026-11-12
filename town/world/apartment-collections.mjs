import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs?v=north-walls-1';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs?v=north-walls-1';
import {resolveSouthArtCorrections,SOUTH_ART_PREVIEW} from './south-art-fixes.mjs?v=north-walls-1';
export * from './apartment-collection-definitions.mjs?v=north-walls-1';

const base=new URL('../assets/apartment-collections/',import.meta.url);
function assetURL(file){const url=new URL(file,base);url.search=new URL(import.meta.url).search;return url;}
let activeRuntime=null;
async function browserImage(url){
 if(typeof fetch==='function'&&typeof createImageBitmap==='function'){
  const response=await fetch(url);
  if(!response.ok)throw Error('Apartment collection artwork could not load: '+url+' ('+response.status+')');
  return await createImageBitmap(await response.blob());
 }
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=async()=>{
   image.onload=image.onerror=null;
   try{if(typeof image.decode==='function')await image.decode();resolve(image);}catch(error){reject(error);}
  };
  image.onerror=()=>{image.onload=image.onerror=null;reject(Error('Apartment collection artwork could not load: '+url));};image.src=url;
 });
}
export async function registerApartmentCollections(add,{
 manifest,directionManifest,overviewManifest,definitions=APARTMENT_COLLECTION_ASSETS,loadImage=browserImage,
 createCanvas=()=>document.createElement('canvas'),fetchManifest=async()=>{const response=await fetch(assetURL('manifest.json'));if(!response.ok)throw Error('Apartment collection manifest could not load.');return response.json();},
 fetchDirections=async()=>{const response=await fetch(assetURL('directions-manifest.json'));if(response.status===404)return null;if(!response.ok)throw Error('Apartment direction manifest could not load.');return response.json();},
 maxSources=4,maxCanvases=192,maxCanvasPixels=4*1024*1024
}={}){
 const externalManifest=manifest===undefined;manifest??=await fetchManifest();
 directionManifest??=externalManifest?await fetchDirections():null;
 // Only the 31 small owner thumbnails load during catalog startup. Full native
 // sheets are fetched for an entered home and released independently later.
 const southArtCorrections=externalManifest?resolveSouthArtCorrections(definitions,directionManifest):[];
 const [thumbnailEntries,southArtPreview]=await Promise.all([
  Promise.all(manifest.collections.map(async collection=>[collection.owner,await loadImage(assetURL(collection.thumbnail).href)])),
  southArtCorrections.length?loadImage(assetURL(SOUTH_ART_PREVIEW.file).href):null
 ]);
 const thumbnails=new Map(thumbnailEntries);
 const runtime=createApartmentCollectionRuntime({definitions,manifest,directionManifest,overviewManifest,thumbnails,southArtCorrections,southArtPreview,loadImage:file=>loadImage(assetURL(file).href),createCanvas,maxSources,maxCanvases,maxCanvasPixels});
 const assets=definitions.map(def=>{
  const asset=add(def.id,def.name,'apartment collections',def.w,def.h,c=>runtime.draw(def.id,c),def.boxes.map(box=>({...box})),def.layer);
  Object.assign(asset,{
   kit:'urban',pack:'apartment-collections-864',facing:'south',owner:def.owner,collectionOwner:def.owner,apartmentCollection:def.owner,slot:def.slot,purpose:def.purpose,
   furnitureRole:def.purpose,style:def.style,visualSignature:def.visualSignature,wallMounted:!!def.wallMounted,collisionDefault:def.solid,npcAvoid:def.solid,depthSorted:def.solid
  });
  Object.defineProperty(asset,'canvas',{configurable:true,get:()=>runtime.canvas(def.id)});
  asset.ensureFull=(facing='south')=>runtime.ensureAsset(def.id,facing);
  asset.getFacingView=(facing='south',_options)=>runtime.view(def.id,facing);
  asset.getFacingImage=(facing='south')=>{if(!runtime.view(def.id,facing))return null;runtime.warmAsset(def.id,facing);return runtime.canvas(def.id,facing);};
  asset.getFacingDrawSource=(facing='south',options)=>runtime.drawSource(def.id,facing,options);
  const motion=runtime.motion(def.id);if(motion)asset.motion=motion;
  return asset;
 });
 activeRuntime=runtime;return assets;
}
export const getApartmentCollectionRuntimeStats=()=>activeRuntime?.stats??null;
export const clearApartmentCollectionCache=()=>activeRuntime?.clear();
