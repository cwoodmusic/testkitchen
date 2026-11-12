import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs?v=north-walls-1';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs?v=north-walls-1';
import {createFamilySourceView,createFamilySourceCanvasCache} from './family-furniture-source.mjs?v=north-walls-1';
export * from './family-furniture-definitions.mjs?v=north-walls-1';

const base=new URL('../assets/apartment-collections/',import.meta.url);
function assetURL(file){const url=new URL(file,base);url.search=new URL(import.meta.url).search;return url;}
async function browserImage(url){
 if(typeof fetch==='function'&&typeof createImageBitmap==='function'){
  const response=await fetch(url);if(!response.ok)throw Error('Family furniture artwork could not load: '+response.status);return createImageBitmap(await response.blob());
 }
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Family furniture artwork could not load: '+url));image.src=url;});
}
let activeRuntime=null,activeSourceCache=null;
export async function registerFamilyFurniture(add,catalog,{
 manifest,definitions=FAMILY_FURNITURE_ASSETS,loadImage=browserImage,createCanvas=()=>document.createElement('canvas'),
 fetchManifest=async()=>{const response=await fetch(assetURL('large-furniture/manifest.json'));if(!response.ok)throw Error('Family furniture manifest could not load.');return response.json();},
 maxSources=4,maxCanvases=96,maxCanvasPixels=4*1024*1024,maxDerivedCanvases=48,maxDerivedPixels=4*1024*1024
}={}){
 manifest??=await fetchManifest();
 const tableDefinitions=definitions.filter(def=>def.art==='extended-table'),sourceDefinitions=definitions.filter(def=>def.art==='collection-source');
 for(const def of sourceDefinitions)if(!catalog?.get(def.sourceAssetId))throw Error('Family furniture requires its approved source: '+def.sourceAssetId);
 // One compact corrected preview supplies every new table facing. Native
 // owner sheets remain lazy and share the existing bounded runtime loader.
 const preview=tableDefinitions.length?await loadImage(assetURL(manifest.preview.file).href):null;
 const previewCells=new Map((manifest.preview?.cells||[]).map(cell=>[cell.id+'|'+cell.facing,cell]));
 const reviewed=[],tableIds=new Set(tableDefinitions.map(def=>def.id));
 for(const collection of manifest.collections||[]){
  for(const facing of ['south','north','east','west']){
   const entry=facing==='south'?collection:manifest.directions.collections.find(item=>item.owner===collection.owner)?.views?.[facing];
   if(!entry)throw Error('Missing family furniture facing: '+collection.owner+'/'+facing);
   for(const frame of entry.cells){if(!tableIds.has(frame.id))continue;const cell=previewCells.get(frame.id+'|'+facing);if(!cell)throw Error('Missing family furniture preview: '+frame.id+'/'+facing);
    reviewed.push({id:frame.id,owner:collection.owner,facing,entry,frame,preview:cell});}
  }
 }
 const runtime=tableDefinitions.length?createApartmentCollectionRuntime({definitions:tableDefinitions,manifest,directionManifest:manifest.directions,
  thumbnails:new Map((manifest.collections||[]).map(collection=>[collection.owner,preview])),southArtCorrections:reviewed,southArtPreview:preview,
  loadImage:file=>loadImage(assetURL(file).href),createCanvas,maxSources,maxCanvases,maxCanvasPixels}):null;
 const sourceCache=createFamilySourceCanvasCache({maxCanvases:maxDerivedCanvases,maxPixels:maxDerivedPixels});
 const result=definitions.map(def=>{
  const source=def.art==='collection-source'?createFamilySourceView(def,catalog.get(def.sourceAssetId),{createCanvas,canvasCache:sourceCache}):null;
  const draw=source?context=>source.draw(context):context=>runtime.draw(def.id,context);
  const asset=add(def.id,def.name,'apartment collections',def.w,def.h,draw,def.boxes.map(box=>({...box})),def.layer);
  Object.assign(asset,{kit:'urban',pack:def.pack,variant:def.variant,facing:'south',owner:def.owner,collectionOwner:def.collectionOwner,apartmentCollection:def.apartmentCollection,
   slot:def.slot,purpose:def.purpose,furnitureRole:def.furnitureRole,style:def.style,sourceAssetId:def.sourceAssetId,visualSignature:def.visualSignature,
   wallMounted:false,collisionDefault:def.solid,npcAvoid:def.solid,depthSorted:def.solid,...(def.seats?{seats:def.seats}:{})});
  Object.defineProperty(asset,'canvas',{configurable:true,get:()=>source?source.canvas():runtime.canvas(def.id)});
  asset.ensureFull=(facing='south')=>source?source.ensureFull(facing):runtime.ensureAsset(def.id,facing);
  asset.getFacingView=(facing='south',_options)=>source?source.view(facing):runtime.view(def.id,facing);
  asset.getFacingImage=(facing='south')=>{if(source)return source.image(facing);if(!runtime.view(def.id,facing))return null;runtime.warmAsset(def.id,facing);return runtime.canvas(def.id,facing);};
  asset.getFacingDrawSource=(facing='south',options)=>source?source.drawSource(facing,options):runtime.drawSource(def.id,facing,options);
  return asset;
 });
 activeRuntime=runtime;activeSourceCache=sourceCache;return result;
}
export function getFamilyFurnitureRuntimeStats(){return {tables:activeRuntime?.stats??null,derived:activeSourceCache?.stats??null};}
export function clearFamilyFurnitureCache(){activeRuntime?.clear();activeSourceCache?.clear();}
