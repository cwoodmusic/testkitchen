import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getInteriorBase} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs';
import {createRoomLayoutStorage} from './room-layout-storage.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL('../../tests/fixtures/'+name,import.meta.url),'utf8'));
const approved=fixture('midcentury-user-layout.json').rooms['showroom-midcentury-studio'];
const previous=fixture('midcentury-previous-default.json');
const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));
const request={kind:'showroom',showroomId:'midcentury-studio'};
const sorted=items=>items.slice().sort((a,b)=>a.id.localeCompare(b.id));
const poses=items=>sorted(items.map(i=>({id:i.id,x:i.x,y:i.y,rotation:i.rotation||0,support:i.supportedBy&&i.supportedBy!=='north-wall'?i.supportedBy:null})));
const physical=(scene,key)=>key==='rooms'?scene.rooms.map(({point,...room})=>room):scene[key];

test('the approved Midcentury save retains all38 exact poses, physical bases and its complete previous architecture',()=>{
 const current=getInteriorBase(request),legacy=current.roomLayoutLegacySources?.[0],editor=createRoomLayoutModel({themeId:approved.themeId,scene:current,catalog,record:approved}),scene=editor.scene,byId=new Map(scene.items.map(i=>[i.id,i]));
 assert(legacy);assert(current.rooms.find(room=>room.functionalRole==='bedroom').x>current.width/2,'The approved original wall plan keeps the bedroom on the right');assert.equal(scene.items.length,38);assert.deepEqual(poses(scene.items),sorted(approved.placements));
 for(const key of ['width','height','rooms','walls','privacyDoors','spawn','portalExit','windows'])assert.deepEqual(physical(scene,key),physical(legacy,key),'The approved export keeps its previous '+key);
 assert.equal(editor.record().baseSignature,approved.baseSignature,'The saved layout retains its original room signature');
 assert.deepEqual(sorted(editor.record().placements),sorted(approved.placements));const original=createRoomLayoutModel({themeId:approved.themeId,scene:legacy,catalog});assert.equal(original.hasEdits,false);assert.deepEqual(poses(original.scene.items),sorted(approved.placements),'The previous source retains the complete approved default');
 assert.deepEqual(editor.record().added,[]);assert.deepEqual(editor.record().removed,[]);
 for(const item of scene.items){
  assert.deepEqual(item.collisionBoxes,item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[],item.id+' needs the physical base at its new pose');
  for(const box of item.collisionBoxes)assert(scene.solids.includes(box),'The actual scene must use every current physical base');
  if(item.supportedBy&&item.supportedBy!=='north-wall'){
   const parent=byId.get(item.supportedBy);assert(parent);assert.equal(item.solid,false);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);
  }
 }
 const fresh=createRoomLayoutModel({themeId:approved.themeId,scene:current,catalog});assert.equal(fresh.hasEdits,false);assert.equal(fresh.record().baseSignature,approved.baseSignature,'The latest upload explicitly reuses the original matching wall plan');assert.notDeepEqual(poses(fresh.scene.items),sorted(approved.placements),'The latest uploaded poses remain distinct from the preceding approved save');
});

test('saved Midcentury layouts still override the new default without rewriting their stored bytes',()=>{
 const scene=getInteriorBase(request),legacy=scene.roomLayoutLegacySources[0],fresh=createRoomLayoutModel({themeId:approved.themeId,scene,catalog}),latest=fresh.record(),values=new Map(),events=new EventTarget();let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value);}};
 const store=createRoomLayoutStorage({storage,eventTarget:events});assert.equal(store.save(approved.themeId,previous).ok,true);
 const raw=store.raw;writes=0;
 const resolver=createRoomLayoutResolver({storage,events}),saved=resolver.resolve(scene,catalog);
 assert.notEqual(saved,scene);assert.deepEqual(poses(saved.items),sorted(previous.placements));assert.equal(writes,0);assert.equal(store.raw,raw);
 const restored=createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:previous});
 assert.deepEqual(poses(restored.scene.items),sorted(previous.placements));assert.equal(restored.record().baseSignature,approved.baseSignature);
 for(const key of ['width','height','rooms','walls','privacyDoors','spawn','portalExit','windows'])assert.deepEqual(physical(restored.scene,key),physical(legacy,key),'The older export keeps its previous '+key);
 assert.deepEqual(poses(createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:restored.record()}).scene.items),sorted(previous.placements));
 assert.equal(restored.reset().ok,true);assert.deepEqual(restored.record(),latest);assert.deepEqual(poses(restored.scene.items),poses(scene.items));assert.deepEqual(restored.scene.walls,scene.walls);
 restored.undo();assert.deepEqual(poses(restored.scene.items),sorted(previous.placements));assert.deepEqual(restored.scene.walls,legacy.walls);restored.redo();assert.deepEqual(restored.record(),latest);
 assert.equal(restored.applyRecord(approved).ok,true);assert.deepEqual(poses(restored.scene.items),sorted(approved.placements));assert.deepEqual(restored.scene.walls,legacy.walls);assert.equal(store.raw,raw);assert.equal(writes,0);
 resolver.dispose();
});
