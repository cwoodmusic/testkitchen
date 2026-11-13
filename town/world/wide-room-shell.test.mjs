import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandWideRoomShell,getInteriorVisualBounds,WIDE_ROOM_EXTRA_DEPTH,WIDE_ROOM_EXTERIOR_DEPTH} from './wide-room-shell.mjs';
import {getInteriorBase,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(catalog);
const load=name=>JSON.parse(readFileSync(new URL('../../tests/fixtures/'+name,import.meta.url))),legacy=load('room-layout-e6a709a.json'),approvedVictorian=load('victorian-user-layout.json').rooms['showroom-victorian-parlor'];
const copy=value=>JSON.parse(JSON.stringify(value));
function copyScene(scene){
 const result=copy(scene),bases=new Map();
 for(let i=0;i<scene.items.length;i++){
  const boxes=(scene.items[i].collisionBoxes||[]).map(box=>{const next={...box};bases.set(box,next);return next;});
  Object.defineProperty(result.items[i],'collisionBoxes',{value:boxes,configurable:true});
 }
 result.solids=scene.solids.map(box=>bases.get(box)||{...box});return result;
}
const sameRect=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
const geometry=s=>({id:s.id,width:s.width,height:s.height,walls:copy(s.walls),privacyDoors:copy(s.privacyDoors)});
function fixture(kind='showroom',width=1184,height=448){
 const partition={x:396,y:300,w:16,h:height-328,color:'#785a46'},frame=Object.freeze({threshold:Object.freeze({x:width-92,y:height-28}),enterNormal:Object.freeze({x:0,y:-1}),triggerHalfWidth:18,doorId:'fixture-exit'});
 const item={id:'untouched',asset:'fixture',x:500,y:350,w:30,h:40,solid:true},boxes=[{x:490,y:340,w:20,h:10}];Object.defineProperty(item,'collisionBoxes',{value:boxes});
 const sourcePlan=Object.freeze({height,spawn:Object.freeze({x:width-92,y:height-84}),portalExit:frame});
 return {id:'fixture-wide',kind,width,height,spawn:{...sourcePlan.spawn},portalExit:{...frame},items:[item],walls:[partition],privacyDoors:[{id:'private',axis:'vertical',x:404,y:230,length:36}],solids:[{x:0,y:0,w:width,h:106},{x:0,y:0,w:28,h:height},{x:width-28,y:0,w:28,h:height},{x:0,y:height-28,w:width,h:28},{...partition},...boxes],rooms:[{functionalRole:'apartment',x:28,y:106,w:width-56,h:height-134},{functionalRole:'bathroom',x:28,y:300,w:368,h:height-328},{functionalRole:'kitchen',x:500,y:300,w:300,h:height-328,floorBounds:{x:500,y:300,w:300,h:height-328}}],zones:[{id:'exit',action:'showroom-lobby',x:width-148,y:height-108,w:112,h:48,threshold:frame.threshold}],showroom:{apartment:sourcePlan},familyFurnitureZones:{living:{x:500,y:300,w:300,h:120}}};
}

test('the finalized shell gains64 usable pixels with closed side/private boundaries and independent frozen signature geometry',()=>{
 const s=fixture(),before=geometry(s),items=s.items,poses=JSON.stringify(items),zones=JSON.stringify(s.familyFurnitureZones),source=JSON.stringify(s.showroom),oldBoxes=s.items[0].collisionBoxes;
 assert.equal(expandWideRoomShell(s),s);assert.equal(s.height,512);assert.equal(WIDE_ROOM_EXTRA_DEPTH,64);assert.equal(WIDE_ROOM_EXTERIOR_DEPTH,108);
 assert.deepEqual(s.roomLayoutSignatureFrame,before);assert(Object.isFrozen(s.roomLayoutSignatureFrame));assert(Object.isFrozen(s.roomLayoutSignatureFrame.walls[0]));assert(Object.isFrozen(s.wideRoomExpansion.signatureGeometry.walls[0]));
 assert.deepEqual(s.wideRoomExpansion.signatureGeometry,geometry(s));
 assert(!s.solids.some(r=>sameRect(r,{x:0,y:420,w:1184,h:28})));assert(s.solids.some(r=>sameRect(r,{x:0,y:484,w:1184,h:28})));
 for(const x of [0,1156])assert(s.solids.some(r=>sameRect(r,{x,y:0,w:28,h:512})));
 assert(s.walls.some(r=>sameRect(r,{x:396,y:420,w:16,h:64})));assert(s.solids.some(r=>sameRect(r,{x:396,y:420,w:16,h:64})));
 assert.equal(s.rooms.find(r=>r.functionalRole==='bathroom').h,184);assert.equal(s.rooms.find(r=>r.functionalRole==='apartment').h,378);
 assert.deepEqual(s.rooms.find(r=>r.functionalRole==='kitchen'),{functionalRole:'kitchen',x:500,y:300,w:300,h:120,floorBounds:{x:500,y:300,w:300,h:120}});
 assert.equal(s.items,items);assert.equal(JSON.stringify(s.items),poses);assert.equal(s.items[0].collisionBoxes,oldBoxes);assert(s.solids.includes(oldBoxes[0]));assert.equal(JSON.stringify(s.familyFurnitureZones),zones);assert.equal(JSON.stringify(s.showroom),source);
 assert.deepEqual(s.spawn,{x:1092,y:428});assert.deepEqual(s.portalExit.threshold,{x:1092,y:484});assert.deepEqual(s.portalExit.door.threshold,s.portalExit.threshold);assert.deepEqual(s.portalExit.door.enterNormal,{x:0,y:1});assert.equal(s.zones[0].y,404);assert.equal(s.zones[0].threshold.y,484);
 assert.deepEqual(getInteriorVisualBounds(s),{x:0,y:0,w:1184,h:620});const once=JSON.stringify(s);expandWideRoomShell(s);assert.equal(JSON.stringify(s),once);
});

test('all31 fresh private rooms have wide shells while saved compact and public scenes retain their original geometry',()=>{
 const requests=[...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id})),...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'}];let expanded=0,originalWide=0,compact=0;
 for(const request of requests){const s=getInteriorBase(request),before=JSON.stringify(s);assert(s.wideRoomExpansion,s.id);assert.equal(expandWideRoomShell(s),s);assert.equal(JSON.stringify(s),before,'The completed default shell is idempotent');
  expanded++;const old=s.wideRoomExpansion;assert.equal(s.height,old.previousHeight+64);assert.equal(s.portalExit.threshold.y,s.height-28);assert.equal(s.portalExit.door.threshold.y,s.height-28);assert.equal(s.portalExit.triggerHalfWidth,18);assert.equal(s.portalExit.door.virtual,true);
  const previous=s.roomLayoutLegacySources?.[0]||s;
  if(previous.wideRoomExpansion)originalWide++;
  else{compact++;assert.equal(previous.width,1088);assert.equal(previous.height,1120);const raw=JSON.stringify(previous);expandWideRoomShell(previous);assert.equal(JSON.stringify(previous),raw);assert.equal(previous.roomLayoutSignatureFrame,undefined);assert.equal(getInteriorVisualBounds(previous).h,previous.height);}
 }
 assert.equal(expanded,31);assert.equal(originalWide,21);assert.equal(compact,10);
 for(const kind of ['shop','hall','lobby','concert']){const s={kind,width:3000,height:400},raw=JSON.stringify(s);assert.equal(expandWideRoomShell(s),s);assert.equal(JSON.stringify(s),raw);}
});

test('all31 existing saved rooms load in expanded geometry without moving saved pieces or writing stored data',()=>{
 assert.equal(legacy.cases.length,31);const pack={format:'coda-room-layouts',version:1,owner:'builder',rooms:Object.fromEntries(legacy.cases.map(c=>[c.themeId,c.record]))},raw=JSON.stringify(pack),input=JSON.stringify(legacy),values=new Map([['codaRoomLayoutsV1:builder',raw]]);let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value);}},resolver=createRoomLayoutResolver({storage,events:new EventTarget()});
 for(const c of legacy.cases){const s=expandWideRoomShell(getInteriorBase(c.request)),resolved=resolver.resolve(s,catalog),model=createRoomLayoutModel({themeId:c.themeId,scene:s,catalog,record:c.record});assert.notEqual(resolved,s,c.themeId+' must load its stored design');
  for(const pose of c.record.placements){const item=model.scene.items.find(i=>i.id===pose.id);assert(item,c.themeId+' '+pose.id);assert.deepEqual({x:item.x,y:item.y,rotation:item.rotation||0},{x:pose.x,y:pose.y,rotation:pose.rotation||0});}
  for(const id of c.record.removed)assert(!model.scene.items.some(i=>i.id===id));
 }
 resolver.dispose();assert.equal(values.get('codaRoomLayoutsV1:builder'),raw);assert.equal(writes,0);assert.equal(JSON.stringify(legacy),input);
 const edited=legacy.modified;assert.doesNotThrow(()=>createRoomLayoutModel({themeId:edited.themeId,scene:expandWideRoomShell(getInteriorBase(edited.request)),catalog,record:edited.record}));
});

test('approved Victorian defaults keep their exact export while the new south floor accepts furniture and the exterior remains outside placement bounds',()=>{
 const scene=expandWideRoomShell(getInteriorBase({kind:'showroom',showroomId:'victorian-parlor'})),model=createRoomLayoutModel({themeId:approvedVictorian.themeId,scene,catalog});assert.deepEqual(model.record(),approvedVictorian);assert.equal(model.hasEdits,false);
 const chair='collection-showroom-victorian-parlor-dining-chair';assert(catalog.has(chair));assert.equal(model.add({asset:chair},{x:600,y:456}).ok,true);assert.equal(model.place().ok,true);
 const added=model.scene.items.find(i=>i.id==='layout-item-1');assert(added.collisionBoxes.length);assert(added.collisionBoxes.every(b=>b.y>=420&&b.y+b.h<=484));
 const record=model.record();assert.equal(record.baseSignature,approvedVictorian.baseSignature);assert.doesNotThrow(()=>createRoomLayoutModel({themeId:approvedVictorian.themeId,scene,catalog,record}));
 assert.equal(model.add({asset:chair},{x:600,y:550}).ok,false);assert.equal(model.place().ok,false);assert.match(model.held.reason,/inside/);
 assert(getShowroomNavigation(model.scene),'The expanded entry must reach the existing shopping destination');
});

test('an old signature is admitted only for the exact known expansion, with later wall, door, width or height changes rejected',()=>{
 const scene=expandWideRoomShell(getInteriorBase({kind:'showroom',showroomId:'victorian-parlor'}));
 const base=()=>copyScene(scene);assert.doesNotThrow(()=>createRoomLayoutModel({themeId:approvedVictorian.themeId,scene:base(),catalog,record:approvedVictorian}));
 for(const change of [s=>{s.walls[0].w+=1;},s=>{s.privacyDoors[0].x+=1;},s=>{s.width+=1;},s=>{s.height+=1;}]){const altered=base();change(altered);assert.throws(()=>createRoomLayoutModel({themeId:approvedVictorian.themeId,scene:altered,catalog,record:approvedVictorian}),/different room or room version/);}
 assert.doesNotThrow(()=>createRoomLayoutModel({themeId:approvedVictorian.themeId,scene,catalog,record:approvedVictorian}));
});
