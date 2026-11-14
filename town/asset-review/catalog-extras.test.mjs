import test from 'node:test';
import assert from 'node:assert/strict';
import {registerReviewRoomRugs,registerReviewMaterials,registerReviewWallSegments,registerReviewGroundSurfaces} from './catalog-extras.mjs';
import {APARTMENT_COLLECTION_ASSETS} from '../world/apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from '../world/family-furniture-definitions.mjs';
import {getInteriorBase,residents} from '../world/urban-interiors.mjs?v=town-compact-island-1';
import {SHOWROOMS} from '../world/showroom-layout.mjs?v=town-room-placement-2';

test('all 31 room bases contribute exact lazy rug metadata without reading storage or loading artwork',()=>{
 const source=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset])),catalog=new Map(source),before=JSON.stringify([...source]);
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 globalThis.document={createElement(){throw Error('Registration must not allocate or render a canvas');}};
 globalThis.fetch=()=>{throw Error('Registration must not fetch native artwork');};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Registration must not read player or room storage');}});
 try{
  assert.equal(registerReviewRoomRugs(catalog),catalog);
  assert.equal(JSON.stringify([...source]),before);for(const[id,asset]of source)assert.equal(catalog.get(id),asset);
  const descriptors=[...residents.map(resident=>({kind:'apartment',resident:resident.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(showroom=>({kind:'showroom',showroomId:showroom.id}))];
  assert.equal(descriptors.length,31);
  const scenes=descriptors.map(getInteriorBase),fingerprints=scenes.map(scene=>JSON.stringify(scene));
  const textures=scenes.flatMap(scene=>(scene.rugs||[]).filter(rug=>rug.texture).map(rug=>({scene,rug})));
  assert.equal(textures.length,1,'Every other room rug already belongs to normal collection/family catalog stock');
  const[{scene,rug}]=textures,asset=catalog.get('room-rug-'+rug.id);
  assert(asset);assert.equal(asset.id,'room-rug-victorian-bath-rug');assert.equal(asset.group,'room rugs');assert.equal(asset.owner,'showroom-victorian-parlor');assert.equal(asset.roomId,scene.id);
  assert.equal(asset.sourceAssetId,asset.id);assert.equal(asset.texture,rug.texture);assert.deepEqual(asset.sourceRect,rug.sourceRect);assert.equal(asset.w,rug.w);assert.equal(asset.h,rug.h);assert(asset.name.includes('Victorian bathroom rug'));
  assert.equal(catalog.size,source.size+1);assert.equal(source.has(asset.id),false);assert.equal(typeof asset.draw,'function');assert.equal(typeof asset.ensureFull,'function');assert.equal(typeof Object.getOwnPropertyDescriptor(asset,'canvas').get,'function');
  const originalAsset=asset;registerReviewRoomRugs(catalog);assert.equal(catalog.size,source.size+1);assert.equal(catalog.get(asset.id),originalAsset,'Repeated registration preserves the already-enriched review asset');
  assert.deepEqual(scenes.map(scene=>JSON.stringify(scene)),fingerprints,'Registration must not move rugs, furniture, rooms or their saved compatibility sources');
 }finally{
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  globalThis.fetch=oldFetch;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else delete globalThis.localStorage;
 }
});

test('all186 current room finishes register lazily under stable per-finish review IDs without changing game assets',()=>{
 const source=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset])),catalog=new Map(source),before=JSON.stringify([...source]);
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 globalThis.document={createElement(){throw Error('Finish registration must not render');}};globalThis.fetch=()=>{throw Error('Finish registration must not fetch');};Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Finish registration must not read saves');}});
 try{
  registerReviewMaterials(catalog);const finishes=[...catalog.values()].filter(a=>a.pack==='interior-materials');
  assert.equal(finishes.length,186);assert.equal(finishes.filter(a=>a.finishKind==='floor').length,124);assert.equal(finishes.filter(a=>a.finishKind==='wall').length,62);
  assert.equal(new Set(finishes.map(a=>a.owner)).size,31);
  for(const asset of finishes){assert.equal(asset.id,'finish:'+asset.finishKind+':'+asset.finishId);assert.equal(asset.owner,asset.materialFinish.owner);assert.equal(asset.reviewSample.columns,3);assert.equal(asset.reviewSample.rows,asset.finishKind==='floor'?3:1);assert.equal(typeof asset.ensureFull,'function');assert.equal(typeof asset.drawReviewSample,'function');assert(asset.w>0&&asset.h>0);}
  const paper=catalog.get('finish:wall:showroom-victorian-parlor-wall');assert.equal(paper.h,106);assert.equal(paper.materialFinish.trimPresentation.style,'complete-scroll');assert.deepEqual(paper.materialOrigin,{x:28,y:0});
  const count=catalog.size;registerReviewMaterials(catalog);assert.equal(catalog.size,count);assert.equal(catalog.get(paper.id),paper);
  assert.equal(JSON.stringify([...source]),before);for(const[id,asset]of source)assert.equal(catalog.get(id),asset);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;globalThis.fetch=oldFetch;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else delete globalThis.localStorage;}
});

test('review tiling preserves ground IDs and dimensions and only genuine straight wall bays repeat',()=>{
 const wall={id:'construction-3',w:384,h:192,group:'construction',draw(){}},picture={id:'picture',wallMounted:true,draw(){}},corner={id:'music-square-wall-corner'},catalog=new Map([[wall.id,wall],[picture.id,picture],[corner.id,corner]]);
 registerReviewWallSegments(catalog);assert.notEqual(catalog.get(wall.id),wall);assert.equal(wall.reviewSample,undefined);assert.equal(catalog.get(wall.id).reviewSample.label,'connected wall sample');assert.equal(catalog.get(picture.id),picture);assert.equal(catalog.get(corner.id),corner);
 const tile={},surfaces=['grass','wood'];registerReviewGroundSurfaces(catalog,{surfaces,groundTexture:()=>tile});
 for(const surface of surfaces){const asset=catalog.get('surface:'+surface);assert.deepEqual([asset.id,asset.w,asset.h],['surface:'+surface,512,512]);assert.equal(asset.reviewSample.rows,3);}
});

test('review repeat dimensions use the native material manifest and the renderer presentation scale',async()=>{
 const {readFileSync}=await import('node:fs'),{HOME_MATERIAL_REPEAT_SIZES,finishRepeatSize}=await import('./material-repeat-sizes.mjs');
 const manifest=JSON.parse(readFileSync(new URL('../assets/home-materials/manifest.json',import.meta.url)));
 for(const collection of manifest.collections)for(const file of collection.files)assert.deepEqual(HOME_MATERIAL_REPEAT_SIZES[file.file],{w:file.width,h:file.height});
 assert.deepEqual(finishRepeatSize({homeMaterial:true,texture:'bach-floor.webp',presentation:{scale:.5}},'floor'),{w:128,h:194});
 assert.deepEqual(finishRepeatSize({homeMaterial:true,surfaceStyle:'ceramic-wall',presentation:{scale:.5}},'wall'),{w:32,h:32});
});
