import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {resolveSouthArtCorrections,CARDINAL_TABLE_SOUTH_OWNERS,SOUTH_ART_PREVIEW} from './south-art-fixes.mjs';
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

test('reviewed cardinal corrections affect only thirteen South tables and the front-facing Midcentury cabinet',()=>{
 assert.equal(CARDINAL_TABLE_SOUTH_OWNERS.length,13);assert.equal(corrections.length,14);assert.equal(new Set(corrections.map(f=>f.id)).size,14);
 const before=fixture(false),after=fixture(true),fixed=new Set(corrections.map(f=>f.id));
 for(const def of APARTMENT_COLLECTION_ASSETS)for(const facing of ['south','north','east','west']){
  const a=before.runtime.view(def.id,facing),b=after.runtime.view(def.id,facing);
  if(facing!=='south'||!fixed.has(def.id))assert.deepEqual(metadata(b),metadata(a),def.id+'/'+facing);
  else assert.deepEqual([b.w,b.h],[def.w,def.h],'Physical view envelope stays at original world dimensions');
 }
 assert.equal(after.loads.length,0,'No native source is loaded by correction registration');before.runtime.clear();after.runtime.clear();
});

test('corrected South previews never show old angled thumbnails and native imagery remains lazy',async()=>{
 const f=fixture();
 for(const fix of corrections){const source=f.runtime.drawSource(fix.id);assert.equal(source.image,f.preview);assert.equal(source.quality,'corrected-preview');const canvas=f.runtime.canvas(fix.id);assert.equal(canvas.draws[0][0],f.preview);}
 assert.equal(f.loads.length,0);const target='collection-showroom-midcentury-studio-arcade';await f.runtime.ensureAsset(target);
 assert.deepEqual(f.loads,[corrections.find(f=>f.id===target).entry.file]);assert.equal(f.runtime.view(target).ready,true);assert.equal(f.runtime.canvas(target).draws[0][0].name,f.loads[0]);f.runtime.clear();
});

test('reused table art keeps the actual authored image anchor and every physical floor centre/base unchanged',()=>{
 const old=fixture(false),fresh=fixture();
 for(const fix of corrections){
  const def=byId.get(fix.id),a={...def,getFacingView:facing=>old.runtime.view(def.id,facing)},b={...def,getFacingView:facing=>fresh.runtime.view(def.id,facing)};
  for(const rotation of [0,90,180,270]){
   const item={x:500,y:600,scale:.75,rotation},before=furnitureFacingPlacement(a,item,undefined,{includeImage:false}),after=furnitureFacingPlacement(b,item,undefined,{includeImage:false});
   assert.deepEqual(furnitureFacingBoxes(a,item),furnitureFacingBoxes(b,item));assert.deepEqual(after.groundCenter,before.groundCenter);assert.deepEqual(after.screenFootCenter,before.screenFootCenter);
   assert(Math.abs(after.x+after.view.footCenter.x*after.scaleX-after.screenFootCenter.x)<1e-8);assert(Math.abs(after.y+after.view.footCenter.y*after.scaleY-after.screenFootCenter.y)<1e-8);
  }
  if(def.slot==='coffee-table')assert.deepEqual(metadata(fresh.runtime.view(def.id)).footCenter,metadata(fresh.runtime.view(def.id,'north')).footCenter,'Reuse the donor view’s own pictured-ground metadata');
 }
 old.runtime.clear();fresh.runtime.clear();
});

test('corrected sources recover after eviction and the new screen animation stays inside its glass rectangle',async()=>{
 const f=fixture(true,1),cabinet='collection-showroom-midcentury-studio-arcade',table='collection-showroom-midcentury-studio-coffee-table';
 await f.runtime.ensureAsset(cabinet);const first=f.runtime.canvas(cabinet),motion=f.runtime.motion(cabinet);assert.equal(motion.kind,'arcade');assert.equal(motion.mask.length,4);assert(motion.mask.every(([x,y])=>x>.2&&x<.8&&y>.2&&y<.6));
 await f.runtime.ensureAsset(table);assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.canvas(cabinet),first,'A compiled corrected sprite survives source eviction');
 f.runtime.clear();assert.equal(first.width,1);await f.runtime.ensureAsset(cabinet);assert.equal(f.loads.filter(file=>file.includes('midcentury-arcade-south-')).length,2);assert(f.runtime.view(cabinet).ready);f.runtime.clear();
});
