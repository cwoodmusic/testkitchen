import test from 'node:test';
import assert from 'node:assert/strict';
import {fitCompactKitchenFloor} from './home-material-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {furnitureFacingBounds} from './furniture-facing.mjs';
import {readFileSync} from 'node:fs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));
configureUrbanInteriors(catalog);
const showroom=id=>getInterior({kind:'showroom',showroomId:id});
const previousSource=scene=>scene.roomLayoutLegacySources?.[0]||scene;
const uploadedLayouts=JSON.parse(readFileSync(new URL('../room-layouts/approved-layouts-1.json',import.meta.url))).rooms;

test('all eight saved compact kitchen finishes retain their exact tile edge, including mirrors and the extended Midcentury counter',()=>{
 for(const display of SHOWROOMS.filter(d=>d.storeFloor!==2)){
  const scene=previousSource(showroom(display.id)),kitchen=scene.rooms.find(r=>r.functionalRole==='kitchen'),b=kitchen.floorBounds;
  assert(b,display.id);assert.equal(b.y,106);assert.equal(b.h,170);assert.equal(b.y+b.h,scene.rooms.find(r=>r.functionalRole==='living').y);
  assert.deepEqual(b,display.column===1?{x:28,y:106,w:display.id==='midcentury-studio'?304:276,h:170}:{x:880,y:106,w:276,h:170});
  for(const item of scene.items.filter(i=>['sink','counter','stove','fridge','pantry'].includes(i.fixtureRole))){
   const fixture=furnitureFacingBounds(catalog.get(item.asset),item);
   assert(Math.max(28,fixture.x)>=b.x&&Math.min(scene.width-28,fixture.x+fixture.w)<=b.x+b.w,display.id+' '+item.fixtureRole+' stays on kitchen tile inside the room edge');
  }
  const physical=structuredClone({...scene,rooms:scene.rooms.map(({floorBounds,...room})=>room)});
  fitCompactKitchenFloor(scene,catalog);
  assert.deepEqual({...scene,rooms:scene.rooms.map(({floorBounds,...room})=>room)},physical,'Finish fitting preserves furniture, walls, collisions, doors and semantic rooms');
 }
});

test('saved upper showrooms and residential apartments retain their original kitchen finishes',()=>{
 const scenes=[...SHOWROOMS.filter(d=>d.storeFloor===2).map(d=>showroom(d.id)),...residents.map(r=>getInterior({kind:'apartment',resident:r.id})),getInterior({kind:'apartment',resident:'player'})];
 assert.equal(scenes.length,23);
 for(const current of scenes){const scene=previousSource(current),before=structuredClone(scene);assert.equal(fitCompactKitchenFloor(scene,catalog),scene);assert.deepEqual(scene,before);assert(scene.rooms.every(r=>!r.floorBounds),scene.id);}
});

test('the29 automatic compact defaults keep their themed170px kitchen field while approved Midcentury keeps its named original finish',()=>{
 const scenes=[...SHOWROOMS.map(d=>showroom(d.id)),...residents.map(r=>getInterior({kind:'apartment',resident:r.id})),getInterior({kind:'apartment',resident:'player'})].filter(scene=>scene.wideRoomLayout);
 assert.equal(scenes.length,29);
 for(const scene of scenes){
  const kitchen=scene.rooms.find(r=>r.functionalRole==='kitchen'),b=kitchen.floorBounds,legacy=previousSource(scene),before=JSON.stringify(scene),legacyBefore=JSON.stringify(legacy);
  assert.deepEqual(b,{x:kitchen.x,y:106,w:kitchen.w,h:170});assert.equal(kitchen.h,170);assert.deepEqual(kitchen.floorFinish,scene.homeMaterialSuite.kitchenFloor);
  const canonical=scene.wideRoomLayout.mirrored?{...b,x:scene.width-b.x-b.w}:b;
  assert(Math.abs(canonical.x+canonical.w-(scene.width-28))<1e-8,scene.id+' kitchen ends at its original outside wall');assert(canonical.x>scene.width/2,scene.id+' canonical kitchen stays in the day wing');
  const roles=new Set(['sink','counter','stove','fridge','pantry']),role=item=>item.slot||item.collectionSlot||item.fixtureRole,fixtures=scene.items.filter(item=>roles.has(role(item))),original=legacy.items.filter(item=>roles.has(role(item)));
  assert.deepEqual(fixtures.map(item=>item.id).sort(),original.map(item=>item.id).sort(),scene.id+' keeps its complete original kitchen run');for(const key of ['fridge','sink','stove','counter'])assert(fixtures.some(item=>role(item)===key),scene.id+' has a '+key);
  for(const item of fixtures){const fixture=furnitureFacingBounds(catalog.get(item.asset),item);if(scene.approvedRoomLayout){const record=uploadedLayouts[scene.kind==='showroom'?scene.id:scene.resident],pose=record.placements.find(p=>p.id===item.id);assert.deepEqual({x:item.x,y:item.y,rotation:item.rotation||0},{x:pose.x,y:pose.y,rotation:pose.rotation},'Uploaded fixtures retain their exact placement even when their artwork overhangs the kitchen tile');}else assert(fixture.x>=b.x-1e-8&&fixture.x+fixture.w<=b.x+b.w+1e-8,scene.id+' '+item.asset+' stays on its current kitchen tile');}
  assert.equal(fitCompactKitchenFloor(scene,catalog),scene);assert.equal(JSON.stringify(scene),before,'Refitting a new default does not alter its architecture or furnishings');assert.equal(JSON.stringify(legacy),legacyBefore,'The saved source keeps its exact previous tile edge');
 }
 const midcentury=showroom('midcentury-studio'),source=previousSource(midcentury),kitchen=midcentury.rooms.find(room=>room.functionalRole==='kitchen');
 assert(midcentury.approvedRoomLayout);assert.equal(midcentury.approvedRoomLayout.baseSignature,'room-c4fe0c34');assert.deepEqual(kitchen.floorBounds,{x:28,y:106,w:304,h:170});assert.deepEqual(kitchen.floorBounds,source.rooms.find(room=>room.functionalRole==='kitchen').floorBounds);assert.equal(kitchen.h,190,'The uploaded layout names its original semantic room rather than the automatic compact recipe');
});

test('Victorian bath gets one small plum rectangular rug inside its open floor, clear of doors and fixtures',()=>{
 const scene=showroom('victorian-parlor'),bath=scene.rooms.find(r=>r.functionalRole==='bathroom');
 assert.equal(scene.rugs.length,1);const rug=scene.rugs[0];assert.deepEqual(rug,{id:'victorian-bath-rug',x:436,y:194,w:96,h:56,color:scene.showroom.rug,texture:'victorian-bath-rug.png',sourceRect:{x:104,y:110,w:1436,h:738}});assert.equal(rug.color,'#744452');assert.equal(scene.homeMaterialSuite.decorativeRugTexture,rug.texture);
 assert(rug.w>rug.h&&rug.w*rug.h<bath.w*bath.h*.15);
 assert(rug.x>bath.x&&rug.y>bath.y&&rug.x+rug.w<bath.x+bath.w&&rug.y+rug.h<bath.y+bath.h);
 for(const solid of scene.solids)assert(!(rug.x<solid.x+solid.w&&rug.x+rug.w>solid.x&&rug.y<solid.y+solid.h&&rug.y+rug.h>solid.y),'Bath rug stays in unobstructed floor');
 for(const display of SHOWROOMS.filter(d=>d.id!=='victorian-parlor'))assert.equal(showroom(display.id).rugs.length,0,display.id+' receives no unsolicited bath rug');
});
