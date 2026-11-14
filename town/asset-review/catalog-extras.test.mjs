import test from 'node:test';
import assert from 'node:assert/strict';
import {registerReviewRoomRugs} from './catalog-extras.mjs';
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
