import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {APPROVED_ROOM_LAYOUTS,APPROVED_ROOM_LAYOUT_SOURCE_SHA256} from './approved-room-layout-data.mjs';
import {applyApprovedRoomLayout} from './approved-room-layout.mjs';
import {getInteriorBase,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createRoomLayoutModel,roomLayoutSignature} from './room-layout-model.mjs';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs';
import {createRoomLayoutStorage} from './room-layout-storage.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';

const raw=readFileSync(new URL('../room-layouts/approved-layouts-1.json',import.meta.url)),upload=JSON.parse(raw),previous=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-defaults-146aa85.json',import.meta.url))),hash=value=>createHash('sha256').update(value).digest('hex');
const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));configureUrbanInteriors(catalog);
const descriptor=id=>id.startsWith('showroom-')?{kind:'showroom',showroomId:id.slice(9)}:{kind:'apartment',resident:id};
const model=(id,record)=>createRoomLayoutModel({themeId:id,scene:getInteriorBase(descriptor(id)),catalog,...(record?{record}:{})});
const geometry=scene=>Object.fromEntries(Object.keys(previous.rooms[scene.kind==='showroom'?scene.id:scene.resident].geometry).map(key=>[key,scene[key]]));
const physicalGeometry=value=>({...value,rooms:value.rooms.map(({point,...room})=>room)});
const structural=scene=>{const bases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[]));return scene.solids.filter(box=>!bases.has(box));};

test('the committed source is the exact fifteen-room upload and its generated records cannot drift',()=>{
 assert.equal(hash(raw),'b7535338a3f7332285d2b84ff388ad3d1fac20b3833ec6667e59a21c4e9f7f95');assert.equal(APPROVED_ROOM_LAYOUT_SOURCE_SHA256,hash(raw));
 assert.equal(upload.format,'coda-room-layouts');assert.equal(upload.version,1);assert.equal(Object.keys(upload.rooms).length,15);assert.deepEqual(APPROVED_ROOM_LAYOUTS,upload.rooms);
 assert(Object.isFrozen(APPROVED_ROOM_LAYOUTS));for(const record of Object.values(APPROVED_ROOM_LAYOUTS)){assert(Object.isFrozen(record));assert(Object.isFrozen(record.placements));assert(record.placements.every(Object.isFrozen));}
});

test('fresh defaults use every exact uploaded pose, support, removal, order and signature without moving the fourteen current wall plans',()=>{
 for(const[id,record]of Object.entries(upload.rooms)){
  const editor=model(id),scene=getInteriorBase(descriptor(id));assert.deepEqual(editor.record(),record,id);assert.equal(editor.hasEdits,false,id);assert.equal(scene.width,1184);assert.equal(scene.height,512);
  assert.equal(scene.approvedRoomLayout.baseSignature,record.baseSignature);assert.equal(scene.approvedRoomLayout.sourceSHA256,hash(raw));
  if(id!=='showroom-midcentury-studio')assert.deepEqual(physicalGeometry(geometry(scene)),physicalGeometry(previous.rooms[id].geometry),id+' retains its current physical room');
  const before=JSON.stringify(scene),again=applyApprovedRoomLayout(scene,catalog);assert.deepEqual(createRoomLayoutModel({themeId:id,scene:again,catalog}).record(),record);assert.equal(JSON.stringify(scene),before,'Promotion never edits its preserved source');
 }
});

test('the Midcentury record selects its named earlier wall plan and preserves the former compact plan for old saves',()=>{
 const id='showroom-midcentury-studio',scene=getInteriorBase(descriptor(id)),record=upload.rooms[id],sources=scene.roomLayoutLegacySources;
 const stockSignature=source=>roomLayoutSignature({...source,items:source.roomLayoutBaseItems||source.items}),matching=sources.find(source=>stockSignature(source)===record.baseSignature),compact=sources.find(source=>stockSignature(source)===previous.rooms[id].record.baseSignature);
 assert(matching);assert(compact);assert.notEqual(matching,compact);assert.deepEqual(scene.walls,matching.walls);assert.deepEqual(scene.privacyDoors,matching.privacyDoors);assert.deepEqual(scene.rooms.map(({point,...room})=>room),matching.rooms.map(({point,...room})=>room));
 assert.notDeepEqual(scene.walls,compact.walls,'The earlier export must not be forced through shifted compact walls');assert.deepEqual(geometry(compact),previous.rooms[id].geometry);
 for(const key of ['width','height','spawn','portalExit','wideRoomExpansion'])assert.deepEqual(scene[key],previous.rooms[id].geometry[key],key+' exterior and entrance stay the same');
 assert.deepEqual(model(id,previous.rooms[id].record).record(),previous.rooms[id].record);assert.deepEqual(model(id,previous.rooms[id].record).scene.walls,compact.walls);
});

test('every moved furniture base is rebuilt and removed pieces leave no invisible solid rectangles',()=>{
 for(const[id,record]of Object.entries(upload.rooms)){
  const scene=getInteriorBase(descriptor(id)),items=new Map(scene.items.map(item=>[item.id,item]));assert.equal(scene.items.length,record.placements.length);
  const source=scene.roomLayoutLegacySources?.find(source=>roomLayoutSignature({...source,items:source.roomLayoutBaseItems||source.items})===record.baseSignature);
  if(source)assert.deepEqual(structural(scene),structural(source),id+' keeps only its real structural collision');
  for(const removed of record.removed){assert(!items.has(removed));assert(scene.roomLayoutBaseItems.some(item=>item.id===removed),'Removed default stock remains available to saved layouts');}
  for(const item of scene.items){
   assert.deepEqual(item.collisionBoxes,item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[],item.id);
   for(const box of item.collisionBoxes)assert(scene.solids.includes(box));
   if(item.supportedBy&&item.supportedBy!=='north-wall'){const parent=items.get(item.supportedBy);assert(parent);assert.equal(item.solid,false);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);}
  }
  assert.equal(scene.solids.length,structural(scene).length+scene.items.reduce((sum,item)=>sum+item.collisionBoxes.length,0));
 }
});

test('all thirty-one preceding saved layouts reopen unchanged, with Reset and undo selecting the correct approved defaults',()=>{
 const values=new Map(),events=new EventTarget();let writes=0;const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value);}},store=createRoomLayoutStorage({storage,eventTarget:events});
 for(const[id,entry]of Object.entries(previous.rooms))assert.equal(store.save(id,entry.record).ok,true);
 const saved=store.raw;writes=0;const resolver=createRoomLayoutResolver({storage,events});
 for(const[id,entry]of Object.entries(previous.rooms)){
  const input=JSON.stringify(entry.record),editor=model(id,entry.record),resolved=resolver.resolve(getInteriorBase(descriptor(id)),catalog);
  assert.deepEqual(editor.record(),entry.record,id);assert.deepEqual(physicalGeometry(geometry(editor.scene)),physicalGeometry(entry.geometry),id+' saved geometry');assert.deepEqual(physicalGeometry(geometry(resolved)),physicalGeometry(entry.geometry),id+' resolved geometry');assert.equal(JSON.stringify(entry.record),input);
  const expected=upload.rooms[id]||entry.record;editor.reset();assert.deepEqual(editor.record(),expected,id+' reset');if(upload.rooms[id]&&JSON.stringify(expected)!==input){assert.equal(editor.undo().ok,true);assert.deepEqual(editor.record(),entry.record);assert.equal(editor.redo().ok,true);assert.deepEqual(editor.record(),expected);}
 }
 assert.equal(store.raw,saved);assert.equal(writes,0);resolver.dispose();
});

test('the other sixteen defaults and all their scene metadata remain exact',()=>{
 const ids=[...residents.map(r=>r.id),'player',...SHOWROOMS.map(room=>'showroom-'+room.id)].filter(id=>!upload.rooms[id]);assert.equal(ids.length,16);
 for(const id of ids){const scene=getInteriorBase(descriptor(id));assert.equal(hash(JSON.stringify(scene)),previous.rooms[id].sceneSHA256,id+' scene');assert.deepEqual(model(id).record(),previous.rooms[id].record,id+' record');assert.equal(scene.approvedRoomLayout,undefined);}
});

test('historical partial-family and full-layout archives retain their preceding source recipes',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../../tests/fixtures/'+name,import.meta.url))),archives=[Object.fromEntries(read('room-layout-e6a709a.json').cases.map(entry=>[entry.themeId,entry.record])),...['room-layout-ac1ee72.json','room-layout-98c6c7a.json','room-layout-4c6c895.json'].map(name=>read(name).currentRecords)];let checked=0;
 for(const archive of archives)for(const[id,record]of Object.entries(archive)){
  if(!upload.rooms[id])continue;const scene=getInteriorBase(descriptor(id)),input=JSON.stringify(record),expected=createRoomLayoutModel({themeId:id,scene:scene.roomLayoutPreviousDefault,catalog,record}),loaded=model(id,record);
  assert.deepEqual(loaded.record(),expected.record(),id+' retains its original family additions');
  for(const key of ['width','height','rooms','walls','privacyDoors','spawn','portalExit','windows'])assert.deepEqual(key==='rooms'?loaded.scene.rooms.map(({point,...room})=>room):loaded.scene[key],key==='rooms'?expected.scene.rooms.map(({point,...room})=>room):expected.scene[key],id+' historical '+key);
  assert.equal(JSON.stringify(record),input);checked++;
 }
 assert.equal(checked,60);
});
