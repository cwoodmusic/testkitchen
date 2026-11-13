import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getInteriorBase,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs';
import {createRoomLayoutStorage} from './room-layout-storage.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';

const load=name=>JSON.parse(readFileSync(new URL('../../tests/fixtures/'+name,import.meta.url))),approved=load('victorian-user-layout.json').rooms['showroom-victorian-parlor'],previous=load('victorian-previous-default.json'),request={kind:'showroom',showroomId:'victorian-parlor'};
const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(catalog);
const pose=item=>({id:item.id,x:item.x,y:item.y,rotation:item.rotation||0,support:item.supportedBy&&item.supportedBy!=='north-wall'?item.supportedBy:null});

test('fresh Victorian defaults match the complete approved export, removals and existing room signature exactly',()=>{
 const scene=getInteriorBase(request),model=createRoomLayoutModel({themeId:approved.themeId,scene,catalog}),byId=new Map(scene.items.map(i=>[i.id,i]));
 assert.equal(scene.items.length,34);assert.equal(scene.roomLayoutBaseItems.length,38);assert.deepEqual(scene.items.map(pose),approved.placements);assert.deepEqual(model.record(),approved);assert.equal(model.hasEdits,false);assert.equal(model.record().baseSignature,previous.baseSignature);
 for(const id of approved.removed)assert(!byId.has(id));
 assert.deepEqual(scene.rooms.find(r=>r.functionalRole==='kitchen').floorBounds,{x:880,y:106,w:276,h:170},'Furniture promotion preserves the existing tile edge');
 assert.equal(scene.rugs[0].id,'victorian-bath-rug');assert.equal(scene.rugs[0].x,436);assert.equal(scene.rugs[0].y,194);assert.equal(model.scene.items.filter(i=>i.roomRugId).length,1);
 for(const item of scene.items){assert.deepEqual(item.collisionBoxes,item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]);for(const b of item.collisionBoxes)assert(scene.solids.includes(b));if(item.supportedBy&&item.supportedBy!=='north-wall'){const parent=byId.get(item.supportedBy);assert(parent);assert.equal(item.solid,false);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);}}
 assert.equal(scene.familyFurniture.diningSeats.length,3);assert(getShowroomNavigation(scene),'The fresh default needs a route through its actual new furniture');
});

test('previous Victorian layouts keep all38 original pieces, their old poses and stored bytes instead of adopting new removals',()=>{
 const scene=getInteriorBase(request),values=new Map(),events=new EventTarget();let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value);}},store=createRoomLayoutStorage({storage,eventTarget:events});assert.equal(store.save(approved.themeId,previous).ok,true);const raw=store.raw;writes=0;
 const resolver=createRoomLayoutResolver({storage,events}),saved=resolver.resolve(scene,catalog),model=createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:previous});
 assert.notEqual(saved,scene);assert.equal(saved.items.filter(i=>!i.roomRugId).length,38);assert.deepEqual(saved.items.filter(i=>!i.roomRugId).map(pose),previous.placements);assert.deepEqual(model.record(),previous);assert.equal(saved.familyFurniture.diningSeats.length,6);assert.equal(store.raw,raw);assert.equal(writes,0);
 for(const id of approved.removed)assert(saved.items.some(i=>i.id===id),'New default removals never delete saved furniture');
 assert(getShowroomNavigation(saved));assert.equal(model.reset().ok,true);assert.deepEqual(model.record(),approved);model.undo();assert.deepEqual(model.record(),previous);resolver.dispose();
});

test('earlier edited table and rug placements override the new default and survive another export/import',()=>{
 const scene=getInteriorBase(request),record=structuredClone(previous),table=record.placements.find(p=>p.id.endsWith('family-coffee-table-1'));Object.assign(table,{x:912,y:348,rotation:90});record.rugs=[{id:'victorian-bath-rug',x:500,y:270,rotation:90}];const raw=JSON.stringify(record),model=createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record});
 assert.deepEqual(model.record(),record);assert.deepEqual(createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:model.record()}).record(),record);assert.equal(JSON.stringify(record),raw);assert(getShowroomNavigation(model.scene));model.reset();assert.deepEqual(model.record(),approved);
});

test('Victorian promotion leaves the other30 private-room default contracts alone',()=>{
 const requests=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.filter(r=>r.id!=='victorian-parlor').map(r=>({kind:'showroom',showroomId:r.id}))];assert.equal(requests.length,30);
 for(const request of requests){const scene=getInteriorBase(request);assert.equal(scene.roomLayoutBaseItems,undefined,scene.id);const themeId=request.kind==='showroom'?'showroom-'+request.showroomId:request.resident,model=createRoomLayoutModel({themeId,scene,catalog});assert.equal(model.hasEdits,false);assert.deepEqual(model.record().removed,[]);assert.equal(model.record().placements.length,scene.items.length);}
});
