import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloneRoomLayoutScene} from './room-layout-sources.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs';
import {getInteriorBase,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';

const json=value=>JSON.stringify(value),copy=value=>JSON.parse(json(value));
const fixtureCatalog=new Map([['chair',{id:'chair',w:40,h:60,solid:true,purpose:'dining-chair',boxes:[{x:4,y:34,w:32,h:22}]}]]);
function physical(scene){
 const bases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[]));
 return {id:scene.id,width:scene.width,height:scene.height,walls:scene.walls,privacyDoors:scene.privacyDoors,rooms:scene.rooms.map(({point,...room})=>room),rugs:scene.rugs,windows:scene.windows,spawn:scene.spawn,portalExit:scene.portalExit,zones:scene.zones,structural:scene.solids.filter(box=>!bases.has(box)),orientation:scene.layoutOrientation};
}
function fixture(){
 const item={id:'chair-1',asset:'chair',x:120,y:240,w:40,h:60,rotation:0,solid:true},boxes=[{x:104,y:214,w:32,h:22}];Object.defineProperty(item,'collisionBoxes',{value:boxes});
 const walls=[{x:300,y:106,w:16,h:100},{x:300,y:242,w:16,h:80}],legacy={id:'source-fixture',kind:'showroom',width:700,height:500,spawn:{x:600,y:430},items:[item],walls,privacyDoors:[{id:'private',axis:'vertical',x:308,y:206,length:36}],solids:[{x:0,y:0,w:700,h:106},{x:0,y:0,w:28,h:500},{x:672,y:0,w:28,h:500},{x:0,y:472,w:700,h:28},...walls,...boxes],rooms:[{id:'bedroom',x:28,y:106,w:272,h:216}],rugs:[],windows:[],actors:[],zones:[],layoutOrientation:'bedroom-left'};
 const latest=cloneRoomLayoutScene(legacy),structural=new Set(latest.walls);latest.solids=latest.solids.filter(box=>!structural.has(box));latest.walls=latest.walls.map(wall=>({...wall,x:400}));latest.solids.push(...latest.walls);latest.privacyDoors[0].x=408;latest.rooms[0].w=372;latest.layoutOrientation='bedroom-right';Object.defineProperty(latest,'roomLayoutLegacySources',{value:[legacy]});
 const oldRecord=createRoomLayoutModel({themeId:'fixture',scene:legacy,catalog:fixtureCatalog}).record(),latestRecord=createRoomLayoutModel({themeId:'fixture',scene:latest,catalog:fixtureCatalog}).record();
 return {legacy,latest,oldRecord,latestRecord,make:record=>createRoomLayoutModel({themeId:'fixture',scene:latest,catalog:fixtureCatalog,...(record?{record}:{})})};
}
const moveChair=(model,x,y)=>{const item=model.scene.items.find(i=>i.id==='chair-1');assert.equal(model.pick({x:item.x,y:item.y-30}).ok,true);assert.equal(model.move({x,y:y-30}).ok,true);assert.equal(model.place().ok,true);};

test('scene cloning preserves hidden furniture bases, shared solid references and symbols without copying source alternatives',()=>{
 const f=fixture(),scene=f.latest,flag=Symbol.for('source-test-calibration'),data=Symbol('source-test-data');Object.defineProperty(scene,flag,{value:true});Object.defineProperty(scene,data,{value:{room:scene.rooms[0]}});
 const cloned=cloneRoomLayoutScene(scene),original=json(scene);assert.notEqual(cloned,scene);assert.notEqual(cloned.items[0],scene.items[0]);assert.notEqual(cloned.items[0].collisionBoxes,scene.items[0].collisionBoxes);assert.equal(Object.getOwnPropertyDescriptor(cloned.items[0],'collisionBoxes').enumerable,false);
 assert(cloned.solids.includes(cloned.items[0].collisionBoxes[0]));assert(!cloned.solids.includes(scene.items[0].collisionBoxes[0]));assert.equal(cloned[flag],true);assert.notEqual(cloned[data],scene[data]);assert.equal(cloned[data].room,cloned.rooms[0]);assert.equal(cloned.roomLayoutLegacySources,undefined);
 cloned.items[0].collisionBoxes[0].x+=25;cloned.rooms[0].w+=10;assert.equal(json(scene),original);assert.equal(scene.items[0].collisionBoxes[0].x,104);
});

test('constructor selects full legacy architecture and orientations while a fresh model uses the latest default',()=>{
 const f=fixture(),before=[json(f.legacy),json(f.latest)],old=f.make(f.oldRecord),fresh=f.make();assert.notEqual(f.oldRecord.baseSignature,f.latestRecord.baseSignature);
 assert.deepEqual(physical(old.scene),physical(f.legacy));assert.deepEqual(old.record(),f.oldRecord);assert.deepEqual(physical(fresh.scene),physical(f.latest));assert.deepEqual(fresh.record(),f.latestRecord);assert.equal(old.canUndo,false);assert.equal(old.canRedo,false);
 assert.equal(old.scene.roomLayoutLegacySources,undefined);assert.deepEqual([json(f.legacy),json(f.latest)],before);
});

test('normal item history and cross-source reset/import undo and redo restore whole scenes with monotonic revisions',()=>{
 const f=fixture(),model=f.make(f.oldRecord),revisions=[model.revision],check=()=>{assert(model.revision>revisions.at(-1));revisions.push(model.revision);assert.equal(model.scene.layoutRevision,model.revision);};
 moveChair(model,180,300);check();const editedOld=model.record();assert.equal(model.hasEdits,true);
 assert.equal(model.reset().ok,true);check();assert.deepEqual(physical(model.scene),physical(f.latest));assert.deepEqual(model.record(),f.latestRecord);assert.equal(model.hasEdits,false);
 moveChair(model,220,300);check();const editedNew=model.record();
 assert.equal(model.undo().ok,true);check();assert.deepEqual(model.record(),f.latestRecord);
 assert.equal(model.undo().ok,true);check();assert.deepEqual(physical(model.scene),physical(f.legacy));assert.deepEqual(model.record(),editedOld);
 assert.equal(model.undo().ok,true);check();assert.deepEqual(model.record(),f.oldRecord);
 for(const expected of [editedOld,f.latestRecord,editedNew]){assert.equal(model.redo().ok,true);check();assert.deepEqual(model.record(),expected);}
 assert.deepEqual(physical(model.scene),physical(f.latest));assert.equal(model.canRedo,false);
 assert.equal(model.applyRecord(f.oldRecord).ok,true);check();assert.deepEqual(physical(model.scene),physical(f.legacy));assert.deepEqual(model.record(),f.oldRecord);
 assert.equal(model.undo().ok,true);check();assert.deepEqual(model.record(),editedNew);assert.deepEqual(physical(model.scene),physical(f.latest));
 moveChair(model,240,320);check();assert.equal(model.canRedo,false,'A new committed edit clears old architecture redo');
});

test('malformed, unknown and invalid known-source records fail atomically without accepting source metadata from the record',()=>{
 const f=fixture(),model=f.make(),record=json(model.record()),scene=model.scene;
 const invalid=[null,undefined,{},[],{...f.oldRecord,baseSignature:'unknown'},{...f.oldRecord,themeId:'other'}, {...f.oldRecord,placements:[]}, {...f.oldRecord,placements:[...f.oldRecord.placements,...f.oldRecord.placements]}, {...f.oldRecord,added:[{id:'new-item',asset:'missing',x:100,y:300}]}, {...f.oldRecord,placements:[{...f.oldRecord.placements[0],x:308,y:180}]}];
 for(const value of invalid){assert.equal(model.applyRecord(value).ok,false);assert.equal(model.scene,scene);assert.equal(json(model.record()),record);assert.equal(model.revision,0);assert.equal(model.canUndo,false);}
 const forged={...f.oldRecord,baseSignature:'forged',roomLayoutLegacySources:[f.legacy]};assert.equal(model.applyRecord(forged).ok,false);
 const bad=cloneRoomLayoutScene(f.legacy);bad.walls[0].w++;const latest=cloneRoomLayoutScene(f.latest);Object.defineProperty(latest,'roomLayoutLegacySources',{value:[bad]});assert.throws(()=>createRoomLayoutModel({themeId:'fixture',scene:latest,catalog:fixtureCatalog,record:f.oldRecord}),{code:'INVALID_ROOM_LAYOUT'});
});

const native=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(native);
const archive=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url)));
function latestFromOld(original){
 const old=original.roomLayoutLegacySources?.[0]||original;return {old,latest:original};
}

test('all30 changed themes select each archived saved room’s complete original architecture and original family expansion',()=>{
 const cases=archive.cases.filter(c=>{const scene=getInteriorBase(c.request);return Boolean(scene.roomLayoutLegacySources?.length);});assert.equal(cases.length,30);assert.equal(cases.filter(c=>getInteriorBase(c.request).roomLayoutLegacySources[0].width===1088).length,10);
 for(const c of cases){
  const {old,latest}=latestFromOld(getInteriorBase(c.request)),input=json(c.record),source=json(old),model=createRoomLayoutModel({themeId:c.themeId,scene:latest,catalog:native,record:c.record});
  assert.deepEqual(physical(model.scene),physical(old),c.themeId);const expected=createRoomLayoutModel({themeId:c.themeId,scene:old,catalog:native,record:c.record});assert.deepEqual(model.record(),expected.record(),c.themeId+' uses the legacy source for family additions too');
  assert.equal(model.reset().ok,true);assert.deepEqual(physical(model.scene),physical(latest));assert.notEqual(model.record().baseSignature,c.record.baseSignature);assert.equal(model.undo().ok,true);assert.deepEqual(physical(model.scene),physical(old));assert.deepEqual(model.record(),expected.record());
  assert.equal(json(c.record),input);assert.equal(json(old),source);
 }
});

test('runtime source selection preserves raw saved bytes and cached full legacy scenes across all30 changed themes',()=>{
 const cases=archive.cases.filter(c=>{const s=getInteriorBase(c.request);return Boolean(s.roomLayoutLegacySources?.length);}),pack={format:'coda-room-layouts',version:1,owner:'builder',rooms:Object.fromEntries(cases.map(c=>[c.themeId,c.record]))},raw=json(pack);let writes=0;
 const storage={getItem:key=>key==='codaRoomLayoutsV1:builder'?raw:null,setItem(){writes++;}},resolver=createRoomLayoutResolver({storage,events:new EventTarget()});
 for(const c of cases){const {old,latest}=latestFromOld(getInteriorBase(c.request)),resolved=resolver.resolve(latest,native);assert.notEqual(resolved,latest);assert.deepEqual(physical(resolved),physical(old));assert.equal(resolver.resolve(latest,native),resolved);}
 assert.equal(writes,0);assert.equal(storage.getItem('codaRoomLayoutsV1:builder'),raw);resolver.dispose();
});
