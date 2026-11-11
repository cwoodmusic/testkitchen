import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILY_FURNITURE_ASSETS,getFamilyFurniture} from './family-furniture-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {registerFamilyFurniture,getFamilyFurnitureRuntimeStats,clearFamilyFurnitureCache} from './family-furniture.mjs';
import {furnitureFacingPlacement,furnitureFacingBoxes,furnitureFootCenter} from './furniture-facing.mjs';
const faces=['south','north','east','west'];
const tables=FAMILY_FURNITURE_ASSETS.filter(a=>a.art==='extended-table');
function fixture(){
 const owners=[...new Set(tables.map(a=>a.owner))],collections=[],directions={collections:[]},cells=[],sizes=new Map(),calls=[],canvases=[],donorLoads=[];
 for(const owner of owners){
  const defs=tables.filter(a=>a.owner===owner),s={owner,file:owner+'-south.webp',width:400,height:200,cells:[]},e={owner,file:owner+'-east.webp',width:200,height:400,cells:[]};
  for(const [index,def]of defs.entries()){
   const common={id:def.id,slot:def.slot,x:index*100,y:0,w:100,h:150},south={...common,viewWidth:def.w,viewHeight:def.h,worldFootCenter:furnitureFootCenter(def)},side={...common,viewWidth:108,viewHeight:226,worldFootCenter:{x:54,y:123}};
   s.cells.push(south);e.cells.push(side);for(const facing of faces)cells.push({id:def.id,facing,x:index*64,y:0,w:64,h:64});
  }
  collections.push(s);directions.collections.push({owner,views:{north:s,east:e,west:e}});sizes.set(s.file,s);sizes.set(e.file,e);
 }
 const manifest={collections,directions,preview:{file:'large-furniture/preview.webp',width:128,height:64,cells}},donors=new Map();
 for(const def of FAMILY_FURNITURE_ASSETS.filter(a=>a.art==='collection-source')){
  const old=APARTMENT_COLLECTION_ASSETS.find(a=>a.id===def.sourceAssetId),views=new Map(faces.map(face=>[face,{w:old.w,h:old.h,footCenter:furnitureFootCenter(old),ready:false}]));
  const sources=new Map(faces.map(face=>[face,{image:{name:'corrected-'+old.id+'-'+face},sx:0,sy:0,sw:old.w,sh:old.h,dx:0,dy:0,dw:old.w,dh:old.h,quality:'corrected-preview',native:false,revision:1}]));
  donors.set(old.id,{...old,getFacingView:f=>views.get(f),getFacingDrawSource:(f,_options)=>sources.get(f),ensureFull:async f=>{donorLoads.push(old.id+'|'+f);}});
 }
 const loadImage=async url=>{const file=new URL(url).pathname.split('/').at(-1);calls.push(file);const size=file==='preview.webp'?manifest.preview:sizes.get(file);assert(size,file);return {name:file,width:size.width,height:size.height,close(){this.closed=true;}};};
 const createCanvas=()=>{const canvas={width:0,height:0,draws:[]};canvas.getContext=()=>({drawImage(...a){canvas.draws.push(a);},clearRect(){canvas.draws=[];}});canvases.push(canvas);return canvas;};
 const add=(id,name,group,w,h,draw,boxes,layer)=>({id,name,group,w,h,draw,boxes,layer});
 return {manifest,donors,calls,donorLoads,canvases,loadImage,createCanvas,add};
}

test('124 new owner-specific products preserve all approved collection definitions and standard role identities',()=>{
 assert.equal(FAMILY_FURNITURE_ASSETS.length,124);assert.equal(new Set(FAMILY_FURNITURE_ASSETS.map(a=>a.id)).size,124);assert.equal(APARTMENT_COLLECTION_ASSETS.length,992);
 for(const def of FAMILY_FURNITURE_ASSETS){assert.equal(def.variant,'family-room');assert.equal(def.id,'family-'+def.owner+'-'+def.slot);assert.equal(def.slot,def.purpose);assert.equal(getFamilyFurniture(def.owner,def.slot),def);assert(!APARTMENT_COLLECTION_ASSETS.some(a=>a.id===def.id));
  for(const b of def.boxes)assert(b.x>=0&&b.y>=0&&b.x+b.w<=def.w&&b.y+b.h<=def.h);
  if(def.slot==='dining-table'){assert.equal(def.seats,8);assert(def.boxes[0].w>=240);}if(def.slot==='rug')assert.equal(def.layer,'ground');
 }
 assert.throws(()=>getFamilyFurniture('missing','rug'),/Unknown family-room/);
});

test('registration adds one small preview and all 496 facing APIs remain lazy and preserve their product ownership',async()=>{
 const f=fixture(),assets=await registerFamilyFurniture(f.add,f.donors,{manifest:f.manifest,loadImage:f.loadImage,createCanvas:f.createCanvas});
 assert.equal(assets.length,124);assert.deepEqual(f.calls,['preview.webp']);assert.equal(f.canvases.length,0);
 for(const a of assets)for(const face of faces){const v=a.getFacingView(face);assert(v);assert.equal(v.facing,face);assert.equal(v,a.getFacingView(face));assert.equal(v.ready,false);assert.equal(a.owner,a.collectionOwner);assert.equal(a.variant,'family-room');const source=a.getFacingDrawSource(face,{native:false});assert(source.image);assert(source.quality.includes('preview'));}
 assert.deepEqual(f.calls,['preview.webp']);assert.equal(f.canvases.length,0);assert.equal(f.donorLoads.length,0);clearFamilyFurnitureCache();
});

test('a selected table shares one native owner sheet for South/North and loads its real side sheet for East/West',async()=>{
 const f=fixture(),assets=await registerFamilyFurniture(f.add,f.donors,{manifest:f.manifest,loadImage:f.loadImage,createCanvas:f.createCanvas}),table=assets.find(a=>a.id==='family-bach-dining-table');
 await Promise.all([table.ensureFull('south'),table.ensureFull('north')]);assert.deepEqual(f.calls,['preview.webp','bach-south.webp']);assert(table.getFacingView('north').ready);
 await Promise.all([table.ensureFull('east'),table.ensureFull('west')]);assert.deepEqual(f.calls,['preview.webp','bach-south.webp','bach-east.webp']);
 for(const face of faces){const image=table.getFacingImage(face);assert(image.width>0);assert(table.getFacingView(face).ready);}
 for(const rotation of [0,90,180,270]){const item={x:600,y:700,rotation,scale:.75},pose=furnitureFacingPlacement(table,item,undefined,{includeImage:false});assert(pose);assert(Math.abs(pose.x+pose.view.footCenter.x*pose.scaleX-pose.screenFootCenter.x)<1e-8);assert.deepEqual(furnitureFacingBoxes(table,item),furnitureFacingBoxes(getFamilyFurniture('bach','dining-table'),item));}
 clearFamilyFurnitureCache();
});

test('all owners stay within native/derived cache budgets and recover after clear without changing older sources',async()=>{
 const f=fixture(),assets=await registerFamilyFurniture(f.add,f.donors,{manifest:f.manifest,loadImage:f.loadImage,createCanvas:f.createCanvas,maxSources:2,maxCanvases:16,maxCanvasPixels:800000,maxDerivedCanvases:4,maxDerivedPixels:500000});
 for(const a of assets)for(const face of faces){if(a.slot==='dining-table'||a.slot==='coffee-table'){await a.ensureFull(face);a.getFacingImage(face);}else a.getFacingImage(face);const s=getFamilyFurnitureRuntimeStats();assert(s.tables.sourceEntries<=2);assert(s.tables.canvasEntries<=16);assert(s.tables.canvasPixels<=800000);assert(s.derived.canvasEntries<=4);assert(s.derived.canvasPixels<=500000);}
 const selected=assets.find(a=>a.id==='family-bach-dining-table');clearFamilyFurnitureCache();assert.equal(getFamilyFurnitureRuntimeStats().tables.sourceEntries,0);assert.equal(getFamilyFurnitureRuntimeStats().derived.canvasEntries,0);await selected.ensureFull('south');assert(selected.getFacingView('south').ready);clearFamilyFurnitureCache();
});

test('registration requires the approved corrected donor instead of substituting unrelated art',async()=>{
 const f=fixture();f.donors.delete('collection-bach-plant');await assert.rejects(registerFamilyFurniture(f.add,f.donors,{manifest:f.manifest,loadImage:f.loadImage,createCanvas:f.createCanvas}),/approved source: collection-bach-plant/);assert.equal(f.calls.length,0);
});

test('production tables supply exact owner-specific cardinal crops, complete previews and immutable source provenance',async()=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto'),base=new URL('../assets/apartment-collections/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('large-furniture/manifest.json',base))),hashes=new Map();
 const hash=file=>{if(!hashes.has(file))hashes.set(file,createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex'));return hashes.get(file);};
 assert.equal(manifest.collections.length,31);assert.equal(manifest.artRecords.length,124);assert.equal(manifest.preview.cells.length,248);assert(manifest.preview.width*manifest.preview.height<=1024*1024);
 const preview=new Map(manifest.preview.cells.map(cell=>[cell.id+'|'+cell.facing,cell]));assert.equal(preview.size,248);const seen=new Set();
 for(const collection of manifest.collections){
  const directions=manifest.directions.collections.find(c=>c.owner===collection.owner);assert(directions);
  for(const facing of faces){const entry=facing==='south'?collection:directions.views[facing];assert.equal(hash(entry.file),entry.sha256);
   for(const frame of entry.cells){const def=getFamilyFurniture(collection.owner,frame.slot);assert.equal(frame.id,def.id);assert(preview.has(frame.id+'|'+facing));assert(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=entry.width&&frame.y+frame.h<=entry.height);assert(frame.worldFootCenter);seen.add(frame.id+'|'+facing);}
  }
 }
 assert.equal(seen.size,248);
 for(const record of manifest.artRecords){assert.equal(hash(record.file),record.sha256??record.nativeFileSHA256);const g=record.generation;assert.equal(hash(g.file??g.originalFile),g.sha256??g.originalSHA256);assert.equal(record.id,'family-'+record.owner+'-'+record.slot);}
});
