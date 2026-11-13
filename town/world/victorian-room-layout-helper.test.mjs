import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getInteriorBase} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {applyVictorianRoomLayout,VICTORIAN_ROOM_POSES,VICTORIAN_ROOM_REMOVALS} from './victorian-room-layout.mjs';
const approved=JSON.parse(readFileSync(new URL('../../tests/fixtures/victorian-user-layout.json',import.meta.url),'utf8')).rooms['showroom-victorian-parlor'];
const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));
const pose=item=>({id:item.id,x:item.x,y:item.y,rotation:item.rotation||0,support:item.supportedBy&&item.supportedBy!=='north-wall'?item.supportedBy:null});

test('fresh Victorian room uses the exact 34 approved poses and removals while retaining the original complete stock snapshot',()=>{
 const scene=getInteriorBase({kind:'showroom',showroomId:'victorian-parlor'}),active=new Map(scene.items.map(item=>[item.id,item])),base=new Map(scene.roomLayoutBaseItems.map(item=>[item.id,item]));
 assert.equal(scene.items.length,34);assert.equal(scene.roomLayoutBaseItems.length,38);assert.deepEqual(scene.items.map(pose),approved.placements);assert.deepEqual(VICTORIAN_ROOM_REMOVALS,approved.removed);
 assert.deepEqual(VICTORIAN_ROOM_POSES.map(([id,x,y,rotation,support])=>({id,x,y,rotation,support})),approved.placements);
 for(const id of approved.removed){assert(base.has(id));assert(!active.has(id));for(const box of base.get(id).collisionBoxes)assert(!scene.solids.includes(box),'Removed compatibility stock must not enter active collision');}
 for(const id of ['showroom-victorian-parlor:family-room-1:bedroom-plant-1','showroom-victorian-parlor-item-22']){
  assert.equal(base.get(id).solid,true,'Old signature stock keeps the old standalone solidity');assert.equal(base.get(id).supportedBy,undefined);assert.equal(active.get(id).solid,false);assert(active.get(id).supportedBy);assert.notEqual(base.get(id),active.get(id));assert.notEqual(base.get(id).collisionBoxes,active.get(id).collisionBoxes);
 }
 for(const item of scene.items){
  assert.equal(item.w,base.get(item.id).w);assert.equal(item.h,base.get(item.id).h);assert.equal(item.asset,base.get(item.id).asset);
  assert.deepEqual(item.collisionBoxes,item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]);
  if(item.supportedBy&&item.supportedBy!=='north-wall'){const parent=active.get(item.supportedBy);assert(parent);assert.equal(item.solid,false);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);}
 }
 assert.equal(scene.familyFurniture.diningSeats.length,3);assert(scene.familyFurniture.diningSeats.every(id=>active.has(id)));
 assert.deepEqual(scene.rugs.find(rug=>rug.id==='victorian-bath-rug'),{x:436,y:194,w:96,h:56,color:scene.showroom.rug,id:'victorian-bath-rug',texture:'victorian-bath-rug.png',sourceRect:{x:104,y:110,w:1436,h:738}},'The unmentioned native bathroom rug retains its authored rectangle');
});

test('Victorian promotion rejects incomplete or unrelated rooms before mutating any stock or metadata',()=>{
 const original=getInteriorBase({kind:'showroom',showroomId:'victorian-parlor'}),seed=()=>({kind:'showroom',id:'showroom-victorian-parlor',items:structuredClone(original.roomLayoutBaseItems)});
 for(const change of [scene=>{scene.id='showroom-art-deco-lounge';},scene=>{scene.items.pop();},scene=>{scene.items.push({...scene.items[0],id:'unexpected-extra'});}]){
  const scene=seed();change(scene);const before=JSON.stringify(scene),assets=new Map(scene.items.map(item=>[item,catalog.get(item.asset)]));assert.equal(applyVictorianRoomLayout(scene,assets),false);assert.equal(JSON.stringify(scene),before);assert.equal(scene.roomLayoutBaseItems,undefined);
 }
 const other=getInteriorBase({kind:'showroom',showroomId:'art-deco-lounge'});assert.equal(other.roomLayoutBaseItems,undefined,'Other showroom themes retain their existing defaults');
});
