import test from 'node:test';
import assert from 'node:assert/strict';
import {fitCompactKitchenFloor} from './home-material-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {furnitureFacingBounds} from './furniture-facing.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));
configureUrbanInteriors(catalog);
const showroom=id=>getInterior({kind:'showroom',showroomId:id});

test('all eight compact kitchen finishes follow their actual fixture row, including mirrors and the extended Midcentury counter',()=>{
 for(const display of SHOWROOMS.filter(d=>d.storeFloor!==2)){
  const scene=showroom(display.id),kitchen=scene.rooms.find(r=>r.functionalRole==='kitchen'),b=kitchen.floorBounds;
  assert(b,display.id);assert.equal(b.y,106);assert.equal(b.h,170);assert.equal(b.y+b.h,scene.rooms.find(r=>r.functionalRole==='living').y);
  assert.deepEqual(b,display.column===1?{x:28,y:106,w:display.id==='midcentury-studio'?304:276,h:170}:{x:880,y:106,w:276,h:170});
  for(const item of scene.items.filter(i=>['sink','counter','stove','fridge','pantry'].includes(i.fixtureRole))){
   const fixture=furnitureFacingBounds(catalog.get(item.asset),item);
   assert(fixture.x>=b.x&&fixture.x+fixture.w<=b.x+b.w,display.id+' '+item.fixtureRole+' stays on kitchen tile');
  }
  const physical=structuredClone({...scene,rooms:scene.rooms.map(({floorBounds,...room})=>room)});
  fitCompactKitchenFloor(scene,catalog);
  assert.deepEqual({...scene,rooms:scene.rooms.map(({floorBounds,...room})=>room)},physical,'Finish fitting preserves furniture, walls, collisions, doors and semantic rooms');
 }
});

test('upper showrooms and all residential apartments keep their existing kitchen finishes',()=>{
 const scenes=[...SHOWROOMS.filter(d=>d.storeFloor===2).map(d=>showroom(d.id)),...residents.map(r=>getInterior({kind:'apartment',resident:r.id})),getInterior({kind:'apartment',resident:'player'})];
 assert.equal(scenes.length,23);
 for(const scene of scenes){const before=structuredClone(scene);assert.equal(fitCompactKitchenFloor(scene,catalog),scene);assert.deepEqual(scene,before);assert(scene.rooms.every(r=>!r.floorBounds),scene.id);}
});

test('Victorian bath gets one small plum rectangular rug inside its open floor, clear of doors and fixtures',()=>{
 const scene=showroom('victorian-parlor'),bath=scene.rooms.find(r=>r.functionalRole==='bathroom');
 assert.equal(scene.rugs.length,1);const rug=scene.rugs[0];assert.deepEqual(rug,{x:436,y:194,w:96,h:56,color:scene.showroom.rug});assert.equal(rug.color,'#744452');
 assert(rug.w>rug.h&&rug.w*rug.h<bath.w*bath.h*.15);
 assert(rug.x>bath.x&&rug.y>bath.y&&rug.x+rug.w<bath.x+bath.w&&rug.y+rug.h<bath.y+bath.h);
 for(const solid of scene.solids)assert(!(rug.x<solid.x+solid.w&&rug.x+rug.w>solid.x&&rug.y<solid.y+solid.h&&rug.y+rug.h>solid.y),'Bath rug stays in unobstructed floor');
 for(const display of SHOWROOMS.filter(d=>d.id!=='victorian-parlor'))assert.equal(showroom(display.id).rugs.length,0,display.id+' receives no unsolicited bath rug');
});
