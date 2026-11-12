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

test('fresh Midcentury defaults use all38 exact approved poses with matching depth and physical bases',()=>{
 const scene=getInteriorBase(request),byId=new Map(scene.items.map(i=>[i.id,i]));
 assert.equal(scene.items.length,38);assert.deepEqual(poses(scene.items),sorted(approved.placements));
 const editor=createRoomLayoutModel({themeId:approved.themeId,scene,catalog});
 assert.equal(editor.record().baseSignature,approved.baseSignature,'Changing poses preserves the preceding room signature');
 assert.deepEqual(sorted(editor.record().placements),sorted(approved.placements));assert(!editor.hasEdits,'The approved export is the authored starting room');
 assert.deepEqual(editor.record().added,[]);assert.deepEqual(editor.record().removed,[]);
 for(const item of scene.items){
  assert.deepEqual(item.collisionBoxes,item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[],item.id+' needs the physical base at its new pose');
  for(const box of item.collisionBoxes)assert(scene.solids.includes(box),'The actual scene must use every current physical base');
  if(item.supportedBy&&item.supportedBy!=='north-wall'){
   const parent=byId.get(item.supportedBy);assert(parent);assert.equal(item.solid,false);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);
  }
 }
});

test('saved Midcentury layouts still override the new default without rewriting their stored bytes',()=>{
 const scene=getInteriorBase(request),values=new Map(),events=new EventTarget();let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value);}};
 const store=createRoomLayoutStorage({storage,eventTarget:events});assert.equal(store.save(approved.themeId,previous).ok,true);
 const raw=store.raw;writes=0;
 const resolver=createRoomLayoutResolver({storage,events}),saved=resolver.resolve(scene,catalog);
 assert.notEqual(saved,scene);assert.deepEqual(poses(saved.items),sorted(previous.placements));assert.equal(writes,0);assert.equal(store.raw,raw);
 const restored=createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:previous});
 assert.deepEqual(poses(restored.scene.items),sorted(previous.placements));assert.equal(restored.record().baseSignature,approved.baseSignature);
 assert.deepEqual(poses(createRoomLayoutModel({themeId:approved.themeId,scene,catalog,record:restored.record()}).scene.items),sorted(previous.placements));
 assert.equal(restored.reset().ok,true);assert.deepEqual(poses(restored.scene.items),sorted(approved.placements));
 resolver.dispose();
});
