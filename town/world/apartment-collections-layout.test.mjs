import test from 'node:test';
import assert from 'node:assert/strict';
import {APARTMENT_COLLECTIONS,APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {getInterior,configureUrbanInteriors,apartmentDecorBounds,apartmentWallDecorBounds,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';

let imageRequests=0;
const definitions=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a]));
configureUrbanInteriors(new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,{...a,ensureFull(){imageRequests++;return Promise.resolve();}}])));
const scenes=[...residents.map(r=>getInterior({kind:'apartment',resident:r.id})),getInterior({kind:'apartment',resident:'player'}),...SHOWROOMS.map(s=>getInterior({kind:'showroom',showroomId:s.id}))];
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('every placed item in all 31 homes belongs to its owner and is never repeated',()=>{
 const seen=new Set();assert.equal(scenes.length,31);assert.equal(APARTMENT_COLLECTIONS.length,31);
 for(const scene of scenes){
  const owner=scene.kind==='showroom'?'showroom-'+scene.showroomId:scene.resident;
  assert(scene.items.length>=20,owner+' needs a complete furnished home');
  for(const item of scene.items){const a=definitions.get(item.asset);assert(a,'Generic or unavailable furnishing '+item.asset);assert.equal(a.owner,owner);assert(!seen.has(a.id),'Repeated furnishing '+a.id);seen.add(a.id);
   assert(Math.abs(item.w/item.h-a.w/a.h)<1e-9,'Stretched furniture '+a.id);
  }
 }
 assert(seen.size>=700);
});

test('every home has its own lava lamp, poster, toy and arcade with practical home essentials',()=>{
 for(const scene of scenes){const slots=scene.items.map(item=>definitions.get(item.asset).slot);
  for(const slot of ['bed','sofa','fridge','sink','stove','toilet','vanity','bath-fixture','wardrobe','dining-table','lava-lamp','poster','toy','arcade'])assert.equal(slots.filter(s=>s===slot).length,1,scene.id+' '+slot);
 }
});

test('NPC model and path queries do not download all 31 full furniture atlases',()=>{assert.equal(imageRequests,0);});

test('the player keeps exact saved furnishing regions and clear entry despite the new built-ins',()=>{
 const scene=getInterior({kind:'apartment',resident:'player'}),bounds=apartmentDecorBounds(scene);
 assert.deepEqual(bounds,[{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}]);
 assert.deepEqual(apartmentWallDecorBounds(scene),[{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}]);
 for(const b of bounds)assert(!scene.solids.some(s=>overlaps(b,s)),'New fixed furniture overlaps a saved floor region');
 const entry={x:scene.spawn.x-70,y:640,w:140,h:scene.height-640};
 for(const item of scene.items)for(const b of item.collisionBoxes)assert(!overlaps(entry,b),'The front door corridor is blocked by '+item.asset);
 for(const item of scene.items.filter(i=>i.supportedBy)){const parent=scene.items.find(i=>i.furnitureRole===item.supportedBy);assert(parent);assert(item.y<=parent.y&&item.y>=parent.y-parent.h,'Floating keepsake '+item.asset);assert.equal(item.solid,false);}
});

test('the complete physical bases of all31 furnished homes stay outside structural walls',()=>{
 for(const scene of scenes){
  const bases=new Set(scene.items.flatMap(item=>item.collisionBoxes)),walls=scene.solids.filter(solid=>!bases.has(solid));
  for(const item of scene.items)for(const base of item.collisionBoxes)for(const wall of walls)assert(!overlaps(base,wall),scene.id+' '+item.asset+' intersects a structural wall');
 }
});
