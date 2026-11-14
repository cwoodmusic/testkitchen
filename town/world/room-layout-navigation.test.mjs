import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshRoomLayoutNavigation} from './room-layout-navigation.mjs';
import {getInteriorBase,configureUrbanInteriors} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {getApartmentNavigation} from './apartment-navigation.mjs';
import {furnitureAtGroundCenter} from './furniture-facing.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));configureUrbanInteriors(catalog);
const upload=JSON.parse(readFileSync(new URL('../room-layouts/approved-layouts-1.json',import.meta.url))),descriptor=id=>id.startsWith('showroom-')?{kind:'showroom',showroomId:id.slice(9)}:{kind:'apartment',resident:id};
const clear=(scene,p)=>p&&p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40&&!scene.solids.some(b=>p.x>=b.x-6&&p.x<=b.x+b.w+6&&p.y>=b.y-6&&p.y<=b.y+b.h+6);
const poses=scene=>scene.items.map(item=>({id:item.id,x:item.x,y:item.y,w:item.w,h:item.h,rotation:item.rotation,support:item.supportedBy}));

test('moving a solid off its old target refreshes room and item destinations without changing authored rectangles or furniture',()=>{
 const box={x:180,y:180,w:40,h:40},item={id:'table',asset:'test-table',x:200,y:220,w:60,h:60,rotation:0,solid:true,collisionBoxes:[box],approach:{x:20,y:20}},room={x:28,y:106,w:444,h:366,point:{x:200,y:200}},walls=[{x:0,y:0,w:500,h:106}],scene={id:'fixture',kind:'showroom',approvedRoomLayout:{},width:500,height:500,spawn:{x:400,y:400},rooms:[room],walls,items:[item],solids:[...walls,box]};
 const before=poses(scene),solids=scene.solids,pointBefore={...room.point};refreshRoomLayoutNavigation(scene);
 assert.deepEqual(poses(scene),before);assert.equal(scene.solids,solids);assert.equal(scene.walls,walls);assert.deepEqual(room.point,pointBefore,'Shared historical area metadata remains untouched');assert(clear(scene,scene.rooms[0].point));assert.notDeepEqual(scene.rooms[0].point,pointBefore);assert(clear(scene,item.approach));assert.notDeepEqual(item.approach,{x:20,y:20});
});

test('all fifteen approved room targets and current fixture approaches are reachable with actual six-pixel clearance',()=>{
 let checked=0;
 for(const[id,record]of Object.entries(upload.rooms)){
  const scene=getInteriorBase(descriptor(id)),before=poses(scene),model=createRoomLayoutModel({themeId:id,scene,catalog});assert.deepEqual(model.record(),record);assert.deepEqual(poses(scene),before);
  for(const room of scene.rooms){if(room.functionalRole==='music'&&!room.point)continue;assert(clear(scene,room.point),id+' '+room.functionalRole+' target');assert(getApartmentNavigation(scene,scene.spawn,room.point),id+' reaches '+room.functionalRole);checked++;}
  for(const item of scene.items)if(item.approach){assert(clear(scene,item.approach),item.id+' target');assert(getApartmentNavigation(scene,scene.spawn,item.approach),item.id+' reachable approach');}
  if(scene.showroom){const plan=scene.showroom.apartment;assert(clear(scene,plan.browse));assert.deepEqual(plan.visitRoute[0],scene.spawn);assert.deepEqual(plan.visitRoute.at(-1),plan.browse);assert.deepEqual(plan.exitRoute,[...plan.visitRoute].reverse());}
 }
 assert(checked>=75);
});

test('committed and imported approved layouts refresh destinations for their actual furniture without changing saved poses',()=>{
 const id='bach',base=getInteriorBase(descriptor(id)),model=createRoomLayoutModel({themeId:id,scene:base,catalog}),source=base.roomLayoutPreviousDefault,older=createRoomLayoutModel({themeId:id,scene:source,catalog}).record();
 assert.equal(model.applyRecord(older).ok,true);assert.deepEqual(model.record(),older);for(const item of model.scene.items)if(item.approach)assert(clear(model.scene,item.approach));
 model.reset();assert.equal(model.add({asset:'collection-bach-dining-chair'},{x:900,y:428}).ok,true);assert.equal(model.place().ok,true);const added=model.scene.items.find(item=>item.id==='layout-item-1');assert(added?.approach);assert(clear(model.scene,added.approach));assert(getApartmentNavigation(model.scene,model.scene.spawn,added.approach));
 const saved=model.record(),restored=createRoomLayoutModel({themeId:id,scene:base,catalog,record:saved});assert.deepEqual(restored.record(),saved);assert(clear(restored.scene,restored.scene.items.find(item=>item.id===added.id).approach));
 for(const ordinary of [{kind:'public',layoutRevision:0,width:100,height:100,rooms:[]},{kind:'apartment',layoutRevision:0,width:100,height:100,rooms:[],items:[],solids:[]}]){const raw=JSON.stringify(ordinary);assert.equal(refreshRoomLayoutNavigation(ordinary),ordinary);assert.equal(JSON.stringify(ordinary),raw);}
});

test('an obsolete browsing target does not become an invisible obstacle to chairs or tables',()=>{
 const id='showroom-midcentury-studio',base=getInteriorBase(descriptor(id));
 for(const slot of ['dining-chair','dining-table']){
  const model=createRoomLayoutModel({themeId:id,scene:base,catalog}),oldBrowse={...model.scene.showroom.apartment.browse},asset=catalog.get('collection-'+id+'-'+slot);
  model.add({asset:asset.id},oldBrowse);const pose=furnitureAtGroundCenter(asset,model.held.item,oldBrowse);assert.equal(model.move(pose).ok,true);assert.equal(model.place().ok,true,'Only real doorways and arrivals constrain placement');
  const added=model.scene.items.find(item=>item.id==='layout-item-1');assert(added.collisionBoxes.some(b=>oldBrowse.x>=b.x&&oldBrowse.x<=b.x+b.w&&oldBrowse.y>=b.y&&oldBrowse.y<=b.y+b.h));
  const plan=model.scene.showroom.apartment;assert.notDeepEqual(plan.browse,oldBrowse);assert(clear(model.scene,plan.browse));assert.deepEqual(plan.visitRoute.at(-1),plan.browse);assert(getApartmentNavigation(model.scene,model.scene.spawn,plan.browse));
  const saved=model.record();assert.deepEqual(createRoomLayoutModel({themeId:id,scene:base,catalog,record:saved}).record(),saved);
 }
});

test('the unchanged Victorian template also releases obsolete browsing targets while every real doorway remains accessible',()=>{
 const id='showroom-victorian-parlor',base=getInteriorBase(descriptor(id)),raw=JSON.stringify(base),model=createRoomLayoutModel({themeId:id,scene:base,catalog});
 assert.equal(base.approvedRoomLayout,undefined);assert.equal(base.layoutRevision,undefined);assert.equal(model.add({asset:'collection-bach-dining-chair'},{x:908,y:366}).ok,true);assert.equal(model.place().ok,true,'The original showroom also allows furniture on the former908,356 tour destination');
 for(const door of model.scene.privacyDoors)for(const normal of [-24,24]){const p={x:door.x+door.length/2,y:door.y+normal};assert(clear(model.scene,p));assert(getApartmentNavigation(model.scene,model.scene.spawn,p));}
 const saved=model.record(),restored=createRoomLayoutModel({themeId:id,scene:base,catalog,record:saved});assert.deepEqual(restored.record(),saved);assert.equal(JSON.stringify(base),raw,'Model navigation must never alter the authored source');
 for(const scene of [model.scene,restored.scene]){const nav=getShowroomNavigation(scene),plan=scene.showroom.apartment;assert(nav);assert.deepEqual(nav.visitRoute[0],scene.spawn);assert.deepEqual(nav.visitRoute.at(-1),plan.browse);assert(clear(scene,plan.browse));for(let i=1;i<nav.visitRoute.length;i++){const a=nav.visitRoute[i-1],b=nav.visitRoute[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2);for(let j=0;j<=steps;j++)assert(clear(scene,{x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps}));}}
});
