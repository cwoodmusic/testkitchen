import {LEGACY_FURNITURE_ASSETS} from './legacy-furniture-definitions.mjs?v=furniture-facings-1';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs?v=furniture-facings-1';
import {furnitureFootCenter} from './furniture-facing.mjs?v=furniture-facings-1';

const directions=['south','west','north','east'];
const base=new URL('../assets/furniture-facings/',import.meta.url);
const settled=Promise.resolve();
let activeRuntime=null,activeSeats=null;
function assetURL(file){const url=new URL(file,base);url.search=new URL(import.meta.url).search;return url;}
function browserImage(url){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=async()=>{
   image.onload=image.onerror=null;
   try{
    if(typeof image.decode==='function')await image.decode();
    if(typeof createImageBitmap==='function'){
     const bitmap=await createImageBitmap(image);image.removeAttribute('src');resolve(bitmap);
    }else resolve(image);
   }catch(error){reject(error);}
  };
  image.onerror=()=>{image.onload=image.onerror=null;reject(Error('Legacy furniture artwork could not load: '+url));};image.src=url;
 });
}
async function fetchDirections(){const response=await fetch(assetURL('manifest.json'));if(!response.ok)throw Error('Legacy furniture direction metadata could not load.');return response.json();}
const validDirection=direction=>directions.includes(direction);
const imageSize=image=>({w:image?.naturalWidth||image?.width||0,h:image?.naturalHeight||image?.height||0});
function descriptor(){return {image:null,sx:0,sy:0,sw:0,sh:0,dx:0,dy:0,dw:0,dh:0,native:false,quality:'pending',revision:0};}
function originalSource(record){
 const image=record.asset.canvas,source=record.source,{w,h}=imageSize(image);
 if(source.image!==image||source.sw!==w||source.sh!==h)Object.assign(source,{image,sx:0,sy:0,sw:w,sh:h,dx:0,dy:0,dw:record.asset.w,dh:record.asset.h,native:true,quality:'original',revision:source.revision+1});
 return source;
}
function originalView(asset,relativeFacing='south',actualFacing=asset.facing||'south',id=asset.id){
 const view={id,w:asset.w,h:asset.h,footCenter:furnitureFootCenter(asset),facing:actualFacing,relativeFacing};
 Object.defineProperty(view,'canvas',{enumerable:true,get:()=>asset.canvas});return view;
}

/** Validate the exact saved-map namespace before attaching anything to it. */
function runtimeMetadata(catalog,definitions,directionManifest,overview){
 if(!Array.isArray(directionManifest?.collections))throw Error('Legacy furniture direction collections are missing.');
 if(!overview?.file||!(overview.width>0&&overview.height>0)||overview.width*overview.height>4*1024*1024)throw Error('Legacy furniture needs one compact overview of at most four million pixels.');
 const ids=new Set(definitions.map(def=>def.id));if(ids.size!==definitions.length)throw Error('Duplicate legacy furniture definitions.');
 const owners=new Map(),coverage=new Map(directions.slice(1).map(dir=>[dir,new Set()]));
 for(const collection of directionManifest.collections){
  if(typeof collection.owner!=='string'||!collection.owner)throw Error('Legacy furniture board owner is missing.');
  for(const facing of directions.slice(1)){
   const view=collection.views?.[facing];if(!view?.file||!(view.width>0&&view.height>0)||!Array.isArray(view.cells))throw Error('Legacy furniture direction is missing: '+collection.owner+'/'+facing);
   for(const cell of view.cells){
    if(!ids.has(cell.id))throw Error('Unknown legacy furniture artwork: '+cell.id);
    if(coverage.get(facing).has(cell.id))throw Error('Duplicate legacy furniture facing: '+cell.id+'/'+facing);
    if(![cell.x,cell.y,cell.w,cell.h].every(Number.isFinite)||cell.x<0||cell.y<0||cell.w<=0||cell.h<=0||cell.x+cell.w>view.width||cell.y+cell.h>view.height)throw Error('Invalid legacy furniture crop: '+cell.id+'/'+facing);
    if(owners.has(cell.id)&&owners.get(cell.id)!==collection.owner)throw Error('Legacy furniture changes board owner: '+cell.id);
    owners.set(cell.id,collection.owner);coverage.get(facing).add(cell.id);
   }
  }
 }
 const overviewKeys=new Set();for(const cell of overview.cells||[]){
  const direction=cell.facing??cell.direction??'south',key=cell.id+'|'+direction;
  if(!ids.has(cell.id)||!validDirection(direction)||overviewKeys.has(key))throw Error('Invalid legacy furniture overview key: '+key);
  if(![cell.x,cell.y,cell.w,cell.h].every(Number.isFinite)||cell.x<0||cell.y<0||cell.w<=0||cell.h<=0||cell.x+cell.w>overview.width||cell.y+cell.h>overview.height)throw Error('Invalid legacy furniture overview crop: '+key);
  overviewKeys.add(key);
 }
 const runtimeDefinitions=definitions.map(def=>{
  const asset=catalog.get(def.id);if(!asset)throw Error('Missing original legacy furniture: '+def.id);
  if(!(asset.w>0&&asset.h>0))throw Error('Invalid original legacy furniture size: '+def.id);
  for(const facing of directions){if(facing!=='south'&&!coverage.get(facing).has(def.id))throw Error('Missing legacy furniture facing: '+def.id+'/'+facing);if(!overviewKeys.has(def.id+'|'+facing))throw Error('Missing legacy furniture overview: '+def.id+'/'+facing);}
  return {...def,w:asset.w,h:asset.h,boxes:asset.boxes,polygons:asset.polygons,owner:owners.get(def.id)};
 });
 // This record exists only to satisfy the shared runtime's namespace. South
 // imagery always comes from the original asset or the authored overview.
 const manifest={collections:[...new Set(owners.values())].map(owner=>({owner,file:'__preserved-south__',width:1,height:1,cells:runtimeDefinitions.filter(def=>def.owner===owner).map(def=>({id:def.id,x:0,y:0,w:def.w,h:def.h}))}))};
 return {definitions:runtimeDefinitions,manifest};
}

/**
 * Add authored cardinal views without replacing an old South canvas getter,
 * draw function, saved-map ID, dimensions, physical box or pack metadata.
 * Registration decodes one compact overview; native direction sheets remain
 * lazy and share the collection runtime's source/canvas limits.
 */
export async function registerLegacyFurnitureFacings(catalog,{
 definitions=LEGACY_FURNITURE_ASSETS,directionManifest,overviewManifest,
 fetchManifest=fetchDirections,loadImage=browserImage,createCanvas=()=>document.createElement('canvas'),
 maxSources=4,maxCanvases=192,maxCanvasPixels=4*1024*1024,reuseAuthoredSeats=true
}={}){
 directionManifest??=await fetchManifest();const overview=overviewManifest??directionManifest.overview;
 const metadata=runtimeMetadata(catalog,definitions,directionManifest,overview),stub={width:1,height:1};
 const thumbnails=new Map(metadata.manifest.collections.map(collection=>[collection.owner,stub]));
 const runtime=createApartmentCollectionRuntime({...metadata,directionManifest,overviewManifest:overview,thumbnails,loadImage:file=>loadImage(assetURL(file).href),createCanvas,maxSources,maxCanvases,maxCanvasPixels});
 await runtime.warmOverview();
 if(!runtime.stats.overviewReady)throw Error('Legacy furniture overview could not load.');
 const assets=metadata.definitions.map(def=>{
  const asset=catalog.get(def.id),record={asset,source:descriptor()},south=originalView(asset),ensure=asset.ensureFull;
  asset.getFacingView=(facing='south')=>facing==='south'?south:validDirection(facing)?runtime.view(def.id,facing):null;
  asset.getFacingImage=(facing='south')=>{
   if(facing==='south')return asset.canvas;if(!validDirection(facing))return null;
   runtime.warmAsset(def.id,facing);return runtime.canvas(def.id,facing);
  };
  asset.getFacingDrawSource=(facing='south',{native=false}={})=>{
   if(!validDirection(facing))return null;
   if(facing==='south'&&native)return originalSource(record);
   runtime.warmOverview();const source=runtime.drawSource(def.id,facing,{native});
   // The shared runtime's synthetic South placeholder is never an image.
   // After an explicit cache clear, wait for the overview to recover rather
   // than leaking that sentinel into CanvasRenderingContext2D.drawImage.
   return source.image===stub?null:source;
  };
  asset.ensureFull=function(facing='south'){
   if(facing==='south')return ensure?ensure.call(asset):settled;
   return validDirection(facing)?runtime.ensureAsset(def.id,facing):Promise.reject(Error('Unknown legacy furniture facing: '+def.id+'/'+facing));
  };
  asset.legacyFurnitureFacingProvider='legacy-board';asset.legacyFurnitureFacingOwner=def.owner;
  return asset;
 });
 activeRuntime=runtime;
 activeSeats=reuseAuthoredSeats?registerAuthoredSeatFacings(catalog,{createCanvas}):null;
 return assets;
}

/** Existing beach chairs already have eight separately authored images. */
export function registerAuthoredSeatFacings(catalog,{createCanvas=()=>document.createElement('canvas'),previewEdge=160}={}){
 const families=['beach-deck-chair','beach-lounger'],records=new Map(),attached=[];let previewPixels=0;
 for(const family of families){
  const present=directions.map(facing=>catalog.get(family+'-'+facing));if(present.every(asset=>!asset))continue;
  if(present.some(asset=>!asset))throw Error('Incomplete authored beach seating family: '+family);
  for(const asset of present)records.set(asset.id,{asset,source:descriptor(),preview:null,previewSource:descriptor(),ensure:asset.ensureFull});
  for(const asset of present){
   const baseline=directions.indexOf(asset.facing),views=new Map(),targets=new Map();
   if(baseline<0||!asset.authoredFacing)throw Error('Invalid authored beach seating facing: '+asset.id);
   for(let relative=0;relative<4;relative++){
    const direction=directions[relative],actual=directions[(baseline+relative)%4],target=catalog.get(family+'-'+actual);
    targets.set(direction,records.get(target.id));views.set(direction,originalView(target,direction,actual,direction==='south'?asset.id:asset.id+'|'+direction));
   }
   asset.getFacingView=(facing='south')=>views.get(facing)??null;
   asset.getFacingImage=(facing='south')=>targets.get(facing)?.asset.canvas??null;
   asset.getFacingDrawSource=(facing='south',{native=false}={})=>{
    const record=targets.get(facing);if(!record)return null;if(native)return originalSource(record);
    if(!record.preview){
     const target=record.asset,scale=Math.min(1,previewEdge/Math.max(target.w,target.h)),canvas=createCanvas();canvas.width=Math.max(1,Math.ceil(target.w*scale));canvas.height=Math.max(1,Math.ceil(target.h*scale));
     const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.scale(canvas.width/target.w,canvas.height/target.h);target.draw(context);
     record.preview=canvas;previewPixels+=canvas.width*canvas.height;
     Object.assign(record.previewSource,{image:canvas,sx:0,sy:0,sw:canvas.width,sh:canvas.height,dx:0,dy:0,dw:target.w,dh:target.h,native:false,quality:'thumbnail',revision:record.previewSource.revision+1});
    }
    return record.previewSource;
   };
   asset.ensureFull=function(facing='south'){const record=targets.get(facing);return record?(record.ensure?record.ensure.call(record.asset):settled):Promise.reject(Error('Unknown beach seating facing: '+facing));};
   asset.legacyFurnitureFacingProvider='authored-seating';attached.push(asset);
  }
 }
 return {assets:attached,get stats(){return {assets:attached.length,previewEntries:[...records.values()].filter(record=>record.preview).length,previewPixels};},clear(){for(const record of records.values())if(record.preview){record.preview.width=record.preview.height=1;record.preview=null;record.previewSource.image=null;record.previewSource.revision++;}previewPixels=0;}};
}

export const getLegacyFurnitureFacingRuntimeStats=()=>activeRuntime?{...activeRuntime.stats,authoredSeats:activeSeats?.stats??null}:null;
export const clearLegacyFurnitureFacingCache=()=>{activeRuntime?.clear();activeSeats?.clear();};
