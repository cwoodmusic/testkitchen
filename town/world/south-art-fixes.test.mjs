import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {resolveSouthArtCorrections,CARDINAL_TABLE_SOUTH_OWNERS,SOUTH_ART_PREVIEW} from './south-art-fixes.mjs';
import {CARDINAL_GENERATED_PATCHES} from './cardinal-art-patches.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';
import {furnitureFacingBoxes,furnitureFacingPlacement} from './furniture-facing.mjs';
const manifest=JSON.parse(readFileSync(new URL('../assets/apartment-collections/manifest.json',import.meta.url)));
const directionManifest=JSON.parse(readFileSync(new URL('../assets/apartment-collections/directions-manifest.json',import.meta.url)));
const corrections=resolveSouthArtCorrections(APARTMENT_COLLECTION_ASSETS,directionManifest),byId=new Map(APARTMENT_COLLECTION_ASSETS.map(def=>[def.id,def]));
const sourceSizes=new Map(manifest.collections.map(c=>[c.file,c]));for(const c of directionManifest.collections)for(const v of Object.values(c.views))sourceSizes.set(v.file,v);for(const fix of corrections)sourceSizes.set(fix.entry.file,fix.entry);
const fakeImage=(name,width,height)=>({name,width,height,close(){this.closed=true;}});
function fixture(corrected=true,maxSources=4){
 const loads=[],canvases=[],preview=fakeImage(SOUTH_ART_PREVIEW.file,SOUTH_ART_PREVIEW.width,SOUTH_ART_PREVIEW.height);
 const runtime=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest,thumbnails:new Map(manifest.collections.map(c=>[c.owner,fakeImage(c.thumbnail,c.width/8,c.height/8)])),southArtCorrections:corrected?corrections:[],southArtPreview:preview,maxSources,
  loadImage:async file=>{loads.push(file);const s=sourceSizes.get(file);assert(s,file);return fakeImage(file,s.width,s.height);},createCanvas:()=>{const canvas={draws:[],width:0,height:0};canvas.getContext=()=>({drawImage(...args){canvas.draws.push(args);}});canvases.push(canvas);return canvas;}});
 return {runtime,loads,canvases,preview};
}
const metadata=v=>({w:v.w,h:v.h,footCenter:v.footCenter,facing:v.facing,motion:v.motion});

test('reviewed cardinal corrections replace only the explicitly audited asset/facing sources',()=>{
 assert.equal(CARDINAL_TABLE_SOUTH_OWNERS.length,13);assert.equal(corrections.length,14+CARDINAL_GENERATED_PATCHES.length);assert.equal(new Set(corrections.map(f=>f.id+'|'+(f.facing??'south'))).size,corrections.length);
 const before=fixture(false),after=fixture(true),fixed=new Set(corrections.map(f=>f.id+'|'+(f.facing??'south')));
 for(const def of APARTMENT_COLLECTION_ASSETS)for(const facing of ['south','north','east','west']){
  const a=before.runtime.view(def.id,facing),b=after.runtime.view(def.id,facing);
  if(!fixed.has(def.id+'|'+facing))assert.deepEqual(metadata(b),metadata(a),def.id+'/'+facing);
  else assert.deepEqual([b.w,b.h],[a.w,a.h],'The original authored view envelope is preserved');
 }
 assert.equal(after.loads.length,0,'No native source is loaded by correction registration');before.runtime.clear();after.runtime.clear();
});

test('corrected South previews never show old angled thumbnails and native imagery remains lazy',async()=>{
 const f=fixture();
 for(const fix of corrections){const facing=fix.facing??'south',source=f.runtime.drawSource(fix.id,facing);assert.equal(source.image,f.preview);assert.equal(source.quality,'corrected-preview');const canvas=f.runtime.canvas(fix.id,facing);assert.equal(canvas.draws[0][0],f.preview);}
 assert.equal(f.loads.length,0);const target='collection-showroom-midcentury-studio-arcade';await f.runtime.ensureAsset(target);
 assert.deepEqual(f.loads,[corrections.find(f=>f.id===target).entry.file]);assert.equal(f.runtime.view(target).ready,true);assert.equal(f.runtime.canvas(target).draws[0][0].name,f.loads[0]);f.runtime.clear();
});

test('reused table art keeps the actual authored image anchor and every physical floor centre/base unchanged',()=>{
 const old=fixture(false),fresh=fixture();
 for(const fix of corrections){
  const def=byId.get(fix.id),a={...def,getFacingView:facing=>old.runtime.view(def.id,facing)},b={...def,getFacingView:facing=>fresh.runtime.view(def.id,facing)};
  for(const rotation of [0,90,180,270]){
   const item={x:500,y:600,scale:.75,rotation},before=furnitureFacingPlacement(a,item,undefined,{includeImage:false}),after=furnitureFacingPlacement(b,item,undefined,{includeImage:false});
   assert.deepEqual(furnitureFacingBoxes(a,item),furnitureFacingBoxes(b,item));if(!before||!after){assert.equal(after,before);continue;}assert.deepEqual(after.groundCenter,before.groundCenter);assert.deepEqual(after.screenFootCenter,before.screenFootCenter);
   assert(Math.abs(after.x+after.view.footCenter.x*after.scaleX-after.screenFootCenter.x)<1e-8);assert(Math.abs(after.y+after.view.footCenter.y*after.scaleY-after.screenFootCenter.y)<1e-8);
  }
  if(def.slot==='coffee-table'&&fix.kind==='reviewed-cardinal-table')assert.deepEqual(metadata(fresh.runtime.view(def.id)).footCenter,metadata(fresh.runtime.view(def.id,'north')).footCenter,'Reuse the donor view’s own pictured-ground metadata');
 }
 old.runtime.clear();fresh.runtime.clear();
});

test('corrected sources recover after eviction and the new screen animation stays inside its glass rectangle',async()=>{
 const f=fixture(true,1),cabinet='collection-showroom-midcentury-studio-arcade',table='collection-showroom-midcentury-studio-coffee-table';
 await f.runtime.ensureAsset(cabinet);const first=f.runtime.canvas(cabinet),motion=f.runtime.motion(cabinet);assert.equal(motion.kind,'arcade');assert.equal(motion.mask.length,4);assert(motion.mask.every(([x,y])=>x>.2&&x<.8&&y>.2&&y<.6));
 await f.runtime.ensureAsset(table);assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.canvas(cabinet),first,'A compiled corrected sprite survives source eviction');
 f.runtime.clear();assert.equal(first.width,1);await f.runtime.ensureAsset(cabinet);assert.equal(f.loads.filter(file=>file.includes('midcentury-arcade-south-')).length,2);assert(f.runtime.view(cabinet).ready);f.runtime.clear();
});


test('generated cardinal patches preserve every original floor anchor and are gated to their reviewed native collection',()=>{
 const before=fixture(false),after=fixture();
 for(const patch of CARDINAL_GENERATED_PATCHES){
  const old=before.runtime.view(patch.id,patch.facing),fresh=after.runtime.view(patch.id,patch.facing);
  assert.deepEqual(fresh.footCenter,old.footCenter,patch.id+'/'+patch.facing);
  assert.deepEqual([fresh.w,fresh.h],[old.w,old.h]);
  assert.equal(after.runtime.drawSource(patch.id,patch.facing).quality,'corrected-preview');
 }
 const other={...directionManifest,collections:directionManifest.collections.map(c=>({...c,views:{...c.views,north:{...c.views.north,sourceDigest:'new-unreviewed-atlas'}}}))};
 assert.equal(resolveSouthArtCorrections(APARTMENT_COLLECTION_ASSETS,other).filter(f=>f.kind==='reviewed-generated-cardinal').length,0);
 before.runtime.clear();after.runtime.clear();
});

test('a corrected rotated view loads only its own new crop and recovers within the source/cache budgets',async()=>{
 const patch=CARDINAL_GENERATED_PATCHES.find(p=>p.facing!=='south');assert(patch,'A reviewed directional example must be covered');
 const f=fixture(true,1);await f.runtime.ensureAsset(patch.id,patch.facing);
 assert.deepEqual(f.loads,[patch.file]);assert(f.runtime.view(patch.id,patch.facing).ready);
 const image=f.runtime.canvas(patch.id,patch.facing);f.runtime.clear();assert.equal(image.width,1);
 await f.runtime.ensureAsset(patch.id,patch.facing);assert.deepEqual(f.loads,[patch.file,patch.file]);assert(f.runtime.stats.sourceEntries<=1);f.runtime.clear();
});


test('reviewed artwork retains exact original-source and packed-file provenance without modifying native atlases',()=>{
 const directory=new URL('../assets/apartment-collections/',import.meta.url),provenance=JSON.parse(readFileSync(new URL('cardinal-fixes/manifest.json',directory))),hashes=new Map();
 const sha=file=>{if(!hashes.has(file))hashes.set(file,createHash('sha256').update(readFileSync(new URL(file,directory))).digest('hex'));return hashes.get(file);};
 assert.equal(provenance.corrections.length,CARDINAL_GENERATED_PATCHES.length);
 for(const entry of provenance.corrections){
  assert.equal(sha(entry.file),entry.sha256,entry.id+'/'+entry.facing+' packed art');
  assert.equal(sha(entry.source.file),entry.source.sha256,entry.id+'/'+entry.facing+' immutable original art');
  const generated=entry.generation;
  if(generated){const file=generated.file??generated.originalFile,digest=generated.sha256??generated.originalSHA256;assert.equal(sha(file),digest,entry.id+' preserved raw generation');}
 }
 assert.equal(new Set(SOUTH_ART_PREVIEW.cells.map(cell=>cell.id+'|'+(cell.facing??'south'))).size,SOUTH_ART_PREVIEW.cells.length,'Preview cells have exact unique facing keys');
 assert(SOUTH_ART_PREVIEW.width*SOUTH_ART_PREVIEW.height<4*1024*1024);
});
