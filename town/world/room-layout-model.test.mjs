import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {furnitureFacingBoxes,furnitureFacingBounds} from './furniture-facing.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {decorCollisionBoxes} from './scene-collision.mjs';
import {createRoomStorage,ROOM_KEY} from './urban-room.mjs';
import {furniturePresentationScale} from './private-furniture.mjs';
import {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs';

const catalog=new Map([
 ['chair',{id:'chair',w:40,h:60,boxes:[{x:4,y:34,w:32,h:22}],solid:true,purpose:'dining-chair'}],
 ['desk',{id:'desk',w:100,h:70,boxes:[{x:4,y:36,w:92,h:30}],solid:true,purpose:'desk'}],
 ['toy',{id:'toy',w:18,h:24,boxes:[{x:3,y:16,w:12,h:6}],solid:true,purpose:'table-decor'}],
 ['rug',{id:'rug',w:100,h:70,boxes:[],solid:false,purpose:'rug',layer:'ground'}],
 ['poster',{id:'poster',w:40,h:50,boxes:[],solid:false,purpose:'wall-art',wallMounted:true}]
]);
function fixture(){
 const items=[{id:'desk-1',asset:'desk',x:210,y:240,w:100,h:70,rotation:0,solid:true},{id:'toy-1',asset:'toy',x:220,y:200,w:18,h:24,rotation:0,solid:false,supportedBy:'desk-1',depth:240.25},{id:'chair-1',asset:'chair',x:350,y:300,w:40,h:60,rotation:0,solid:true},{id:'rug-1',asset:'rug',x:350,y:340,w:100,h:70,rotation:0,solid:false,layer:'ground'}];
 for(const item of items)Object.defineProperty(item,'collisionBoxes',{value:item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]});
 const walls=[{x:0,y:0,w:600,h:106},{x:0,y:0,w:28,h:500},{x:572,y:0,w:28,h:500},{x:0,y:472,w:600,h:28},{x:290,y:106,w:16,h:54},{x:290,y:196,w:16,h:70}];
 const scene={id:'fixture',kind:'apartment',resident:'fixture',width:600,height:500,spawn:{x:300,y:430},actors:[],rooms:[],walls,privacyDoors:[{id:'privacy',axis:'vertical',roomId:'bath',x:298,y:160,length:36}],items,solids:[...walls,...items.flatMap(i=>i.collisionBoxes)],windows:[],zones:[]};
 return {scene,model:createRoomLayoutModel({themeId:'fixture',scene,catalog})};
}

test('pickup preserves exact grab offset and does not change authored, committed or exported data',()=>{
 const {scene,model}=fixture(),authored=JSON.stringify(scene),before=model.scene,record=JSON.stringify(model.record());
 assert.equal(model.pick({x:357,y:260}).ok,true);assert.equal(model.held.originalId,'chair-1');assert.deepEqual(model.held.offset,{x:7,y:-40});
 model.move({x:407,y:280});assert.equal(model.held.item.x,400);assert.equal(model.held.item.y,320);assert.equal(model.scene,before);assert.equal(JSON.stringify(model.record()),record);assert.equal(JSON.stringify(scene),authored);assert.equal(model.canUndo,false);
 model.cancel();assert.equal(model.held,null);assert.equal(model.scene,before);
});

test('valid click commits atomically, keeps old scenes immutable, rebuilds collision and supports undo/redo/reset',()=>{
 const {model}=fixture(),before=model.scene,raw=JSON.stringify(before),oldChair=before.items.find(i=>i.id==='chair-1');
 model.pick({x:350,y:270});model.move({x:410,y:300});assert.equal(model.place().ok,true);assert.notEqual(model.scene,before);assert.equal(JSON.stringify(before),raw);assert.equal(oldChair.x,350);assert.equal(model.hasEdits,true);
 const chair=model.scene.items.find(i=>i.id==='chair-1');assert.equal(chair.x,410);assert.equal(chair.y,330);assert.deepEqual(chair.collisionBoxes,furnitureFacingBoxes(catalog.get(chair.asset),chair));assert(chair.collisionBoxes.every(b=>model.scene.solids.includes(b)));assert.equal(model.scene.solids.some(b=>oldChair.collisionBoxes.includes(b)),false);
 assert.equal(model.undo().ok,true);assert.equal(model.scene.items.find(i=>i.id==='chair-1').x,350);assert.equal(model.hasEdits,false);assert.equal(model.canRedo,true);model.redo();assert.equal(model.scene.items.find(i=>i.id==='chair-1').x,410);
 const edited=model.scene;model.reset();assert.notEqual(model.scene,edited);assert.equal(model.hasEdits,false);model.undo();assert.equal(model.scene.items.find(i=>i.id==='chair-1').x,410);
});

test('arrow directions are absolute cardinal facings and rotate actual native collision boxes',()=>{
 const {model}=fixture();model.pick({x:350,y:270});for(const [arrow,angle]of [['up',180],['right',270],['down',0],['left',90]]){model.rotate(arrow);assert.equal(model.held.item.rotation,angle);assert.deepEqual(model.held.boxes,furnitureFacingBoxes(catalog.get('chair'),model.held.item));}
 const before=model.scene;assert.equal(model.rotate(45).ok,false);assert.equal(model.scene,before);assert.equal(model.held.item.rotation,90);
});

test('invalid wall, overlap, door and arrival placements stay held without changes or undo entries',()=>{
 const {model}=fixture();model.pick({x:350,y:270});const raw=JSON.stringify(model.record());
 for(const p of [{x:8,y:220},{x:210,y:215},{x:298,y:178},{x:300,y:410}]){model.move(p);const result=model.place();assert.equal(result.ok,false,JSON.stringify(p));assert(model.held);assert(model.held.reason);assert.equal(JSON.stringify(model.record()),raw);assert.equal(model.canUndo,false);}
 model.move({x:430,y:310});assert.equal(model.place().ok,true);
});

test('parent pickup carries tabletop props, with correct depth, and remove cascades reversibly',()=>{
 const {model}=fixture();const toy=model.scene.items.find(i=>i.id==='toy-1'),oldToy={...toy};
 assert.equal(model.pick({x:180,y:220}).ok,true);assert.equal(model.held.originalId,'desk-1');assert.equal(model.held.companions[0].id,'toy-1');model.move({x:190,y:280});assert.equal(model.place().ok,true);
 const moved=model.scene.items.find(i=>i.id==='toy-1');assert.equal(moved.x,oldToy.x+10);assert.equal(moved.y,oldToy.y+60);assert.equal(moved.solid,false);assert.equal(moved.collisionBoxes.length,0);
 const record=model.record(),restored=createRoomLayoutModel({themeId:'fixture',scene:fixture().scene,catalog,record});assert.equal(restored.scene.items.find(i=>i.id==='toy-1').supportedBy,'desk-1');
 model.remove('desk-1');assert.equal(model.scene.items.some(i=>i.id==='desk-1'||i.id==='toy-1'),false);model.undo();assert(model.scene.items.some(i=>i.id==='toy-1'));
});

test('all existing pieces can be added repeatedly in design mode without purchase data',()=>{
 const {model}=fixture();assert.equal(model.add('chair',{x:450,y:350}).ok,true);assert.equal(model.place().ok,true);const first=model.scene.items.at(-1).id;
 const restored=createRoomLayoutModel({themeId:'fixture',scene:fixture().scene,catalog,record:model.record()});restored.add('chair',{x:500,y:350});assert.equal(restored.place().ok,true);assert.notEqual(restored.scene.items.at(-1).id,first);assert.equal(restored.scene.items.filter(i=>i.asset==='chair').length,3);
});

test('a tabletop decoration can move to another room support or detach onto the floor and reload correctly',()=>{
 const {scene}=fixture(),desk={id:'desk-other',asset:'desk',x:470,y:200,w:100,h:70,rotation:0,solid:true,roomId:'other'};Object.defineProperty(desk,'collisionBoxes',{value:furnitureFacingBoxes(catalog.get('desk'),desk)});scene.items.push(desk);scene.solids.push(...desk.collisionBoxes);
 const model=createRoomLayoutModel({themeId:'fixture',scene,catalog});assert.equal(model.pick({x:220,y:188}).ok,true);assert.equal(model.held.originalId,'toy-1');model.move({x:470,y:148});assert.equal(model.held.item.supportedBy,'desk-other');assert.equal(model.place().ok,true);
 const reloaded=createRoomLayoutModel({themeId:'fixture',scene,catalog,record:model.record()});assert.equal(reloaded.scene.items.find(i=>i.id==='toy-1').supportedBy,'desk-other');reloaded.pick({x:470,y:148});reloaded.move({x:470,y:340});assert.equal(reloaded.held.item.supportedBy,undefined);assert.equal(reloaded.held.item.solid,true);assert.equal(reloaded.place().ok,true);assert.equal(createRoomLayoutModel({themeId:'fixture',scene,catalog,record:reloaded.record()}).scene.items.find(i=>i.id==='toy-1').supportedBy,undefined);
});

test('imports reject wrong rooms, unknown artwork, missing bases and corrupt geometry without mutation',()=>{
 const {model}=fixture(),raw=JSON.stringify(model.record()),before=model.scene;
 for(const mutate of [r=>r.themeId='other',r=>r.baseSignature='wrong',r=>r.placements.pop(),r=>r.added.push({id:'new',asset:'missing',x:400,y:300,rotation:0,scale:1}),r=>{r.placements.find(i=>i.id==='chair-1').x=10;}]){const record=JSON.parse(raw);mutate(record);assert.equal(model.applyRecord(record).ok,false);assert.equal(model.scene,before);assert.equal(JSON.stringify(model.record()),raw);}
 assert.throws(()=>createRoomLayoutModel({themeId:'fixture',scene:fixture().scene,catalog,record:{}}),{code:'INVALID_ROOM_LAYOUT'});
});

test('all31 actual models reload both authored records and a committed native furniture move',()=>{
 const art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);
 const themes=[...residents.map(r=>[r.id,{kind:'apartment',resident:r.id}]),['player',{kind:'apartment',resident:'player'}],...SHOWROOMS.map(r=>['showroom-'+r.id,{kind:'showroom',showroomId:r.id}])];
 for(const [themeId,request]of themes){const scene=getInterior(request),original=JSON.stringify(scene),model=createRoomLayoutModel({themeId,scene,catalog:art});assert.equal(model.hasEdits,false);assert.equal(createRoomLayoutModel({themeId,scene,catalog:art,record:model.record()}).scene.items.length,scene.items.length);
  const bed=model.scene.items.find(i=>art.get(i.asset)?.slot==='bed'),b=furnitureFacingBounds(art.get(bed.asset),bed),p={x:b.x+b.w*.65,y:b.y+b.h*.9};assert.equal(model.pick(p).ok,true,themeId);assert.equal(model.held.originalId,bed.id);assert.equal(model.move({x:p.x+.25,y:p.y}).ok,true,themeId+' preview');assert.equal(model.place().ok,true,themeId+' commit');
  const next=createRoomLayoutModel({themeId,scene,catalog:art,record:model.record()});assert.equal(next.scene.items.find(i=>i.id===bed.id).x,bed.x+.25);assert.equal(JSON.stringify(scene),original,'The authored '+themeId+' model stays immutable');
 }
});

test('player template edits cannot invalidate existing purchased floor furniture or wall art',()=>{
 const atlas=JSON.parse(readFileSync(new URL('../assets/decor/atlas.json',import.meta.url))),def=decorDefinitions.find(d=>d.id==='decor-08-01'),cell=atlas.find(s=>s.family===def.family).cells[def.index],fit=Math.min(def.maxW/cell.w,def.maxH/cell.h),w=Math.ceil(cell.w*fit),h=Math.ceil(cell.h*fit);
 const geranium={id:def.id,w,h,boxes:decorCollisionBoxes(def,w,h),collisionDefault:def.solid},art=new Map([...[...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]),[geranium.id,geranium]]);configureUrbanInteriors(art);
 const scene=getInterior({kind:'apartment',resident:'player'}),model=createRoomLayoutModel({themeId:'player',scene,catalog:art}),items=[{id:'room-legacy-geranium',item:'furniture-geranium',asset:geranium.id,x:1800,y:900,scale:1},{id:'room-poster',item:'furniture-poster',asset:'collection-player-poster',x:800,y:98,scale:1}];
 const raw=JSON.stringify({version:1,owner:'guest',items}),memory=new Map([[ROOM_KEY,raw]]);let writes=0;
 const personal=()=>createRoomStorage({owner:'guest',storage:{getItem:k=>memory.get(k),setItem(k,v){writes++;memory.set(k,v);}},catalog:art,furniture:items.map(i=>({id:i.item,asset:i.asset,scale:i.scale})),owned:()=>items.map(i=>i.item),presentationScale:(item,a)=>furniturePresentationScale(item,{kind:'apartment'},a),getBounds:(_item,a)=>a.wallMounted?apartmentWallDecorBounds(scene):apartmentDecorBounds(scene),getSolids:()=>model.scene.solids});
 assert.equal(personal().load().ok,true);
 assert.equal(model.add('collection-player-bed',{x:1800,y:930}).ok,false);assert.match(model.held.reason,/purchased furniture/);assert.equal(model.place().ok,false);model.cancel();
 assert.equal(model.add('collection-player-poster',{x:800,y:98}).ok,false);assert.match(model.held.reason,/purchased decorations/);assert.equal(model.place().ok,false);model.cancel();
 assert.equal(model.add('collection-player-rug',{x:1800,y:900}).ok,true,'A noncolliding template rug may sit beneath personal décor');assert.equal(model.place().ok,true);assert.equal(personal().load().ok,true);assert.equal(memory.get(ROOM_KEY),raw);assert.equal(writes,0);
 const other=getInterior({kind:'apartment',resident:'bach'}),npc=createRoomLayoutModel({themeId:'bach',scene:other,catalog:art});assert.equal(npc.add('collection-player-poster',{x:700,y:98}).ok,true);assert.equal(npc.place().ok,true,'Other room themes retain the full design area');
 for(const request of [...residents.map(r=>({kind:'apartment',resident:r.id})),...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))]){assert.equal(apartmentDecorBounds(request),null);assert.equal(apartmentWallDecorBounds(request),null);}
});

function expandedFixture(scene,defaults){
 const added=defaults.map(item=>({...item,roomExpansion:'family-room-1',collisionBoxes:item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]}));
 return {...scene,items:[...scene.items,...added],solids:[...scene.solids,...added.flatMap(i=>i.collisionBoxes)]};
}
test('a preceding room record retains user work while only safe new defaults merge',()=>{
 const {scene,model}=fixture();model.pick({x:350,y:270});model.move({x:410,y:300});assert.equal(model.place().ok,true);assert.equal(model.remove('rug-1').ok,true);
 model.add('chair',{x:500,y:340});assert.equal(model.place().ok,true);const saved=model.record(),raw=JSON.stringify(saved),oldItems=model.scene.items.map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation||0,support:i.supportedBy}));
 const good={id:'family-good',asset:'chair',x:490,y:200,w:40,h:60,solid:true},blocked={...good,id:'family-user-overlap',x:410,y:330},door={...good,id:'family-door',x:298,y:185},barrier={id:'family-route',asset:'barrier',x:300,y:380,w:540,h:10,solid:true};
 catalog.set('barrier',{id:'barrier',w:540,h:10,solid:true,boxes:[{x:0,y:0,w:540,h:10}],purpose:'counter'});
 const expanded=expandedFixture(scene,[good,blocked,door,barrier]),changedChair={...expanded.items.find(i=>i.id==='chair-1'),x:450};
 expanded.items=expanded.items.map(i=>i.id==='chair-1'?changedChair:i);
 const migrated=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:saved});
 assert.deepEqual(migrated.scene.items.filter(i=>!i.roomExpansion).map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation||0,support:i.supportedBy})),oldItems,'No user furniture is moved, dropped or resized');
 assert(migrated.scene.items.some(i=>i.id==='family-good'));for(const id of ['family-user-overlap','family-door','family-route'])assert(!migrated.scene.items.some(i=>i.id===id),id);
 const upgraded=migrated.record();assert.notEqual(upgraded.baseSignature,saved.baseSignature);assert(upgraded.removed.includes('rug-1'));assert(upgraded.removed.includes('family-user-overlap'));assert.equal(JSON.stringify(saved),raw);assert.equal(migrated.canUndo,false);
 const reloaded=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:upgraded});assert.deepEqual(reloaded.record(),upgraded,'The new export reloads normally, including omitted defaults');
});

test('new tabletop defaults follow saved supports, avoid existing decorations and omit removed supports',()=>{
 const {scene,model}=fixture();model.pick({x:180,y:220});model.move({x:190,y:280});assert.equal(model.place().ok,true);
 const source={id:'family-tabletop',asset:'toy',x:180,y:190,w:18,h:24,solid:false,supportedBy:'desk-1'},overlap={...source,id:'family-tabletop-overlap',x:220,y:200},expanded=expandedFixture(scene,[source,overlap]),migrated=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:model.record()}),piece=migrated.scene.items.find(i=>i.id===source.id);
 assert(piece);assert.equal(piece.x,190);assert.equal(piece.y,250);assert.equal(piece.supportedBy,'desk-1');assert.equal(piece.collisionBoxes.length,0);assert(!migrated.scene.items.some(i=>i.id===overlap.id));
 model.remove('desk-1');const missing=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:model.record()});assert(!missing.scene.items.some(i=>i.id===source.id||i.id===overlap.id));
});

test('compatibility rejects unrelated or changed original bases and corrupt old edits atomically',()=>{
 const {scene,model}=fixture(),saved=model.record(),expanded=expandedFixture(scene,[{id:'family-good',asset:'chair',x:490,y:200,w:40,h:60,solid:true}]);
 for(const change of [s=>s.items[0].w++,s=>s.items[0].asset='chair',s=>s.walls=s.walls.map((w,i)=>i?{...w}:{...w,w:w.w-1}),s=>s.items.at(-1).roomExpansion='unrelated-expansion']){
  const copy={...expanded,items:expanded.items.map(i=>({...i,collisionBoxes:i.collisionBoxes})),walls:expanded.walls.map(w=>({...w}))};change(copy);assert.throws(()=>createRoomLayoutModel({themeId:'fixture',scene:copy,catalog,record:saved}),{code:'INVALID_ROOM_LAYOUT'});
 }
 const target=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog}),before=target.scene,record=JSON.stringify(target.record());
 for(const change of [r=>r.baseSignature='room-unrelated',r=>r.placements.pop(),r=>r.removed.push('family-good'),r=>r.placements.find(i=>i.id==='chair-1').x=8,r=>r.added.push({id:'user-unknown',asset:'unavailable',x:450,y:300})]){
  const bad=JSON.parse(JSON.stringify(saved));change(bad);assert.equal(target.applyRecord(bad).ok,false);assert.equal(target.scene,before);assert.equal(JSON.stringify(target.record()),record);
 }
});

test('all31 frozen e6a709a room records preserve their saved originals and export reloadable current records',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url))),art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);assert.equal(frozen.sourceCommit,'e6a709a');assert.equal(frozen.cases.length,31);
 for(const {themeId,request,record}of frozen.cases){
  const scene=getInterior(request),authored=JSON.stringify(scene),raw=JSON.stringify(record),model=createRoomLayoutModel({themeId,scene,catalog:art,record});
  assert(scene.items.some(i=>i.roomExpansion==='family-room-1'),themeId+' uses the actual expanded source');assert.notEqual(model.record().baseSignature,record.baseSignature);
  for(const p of record.placements){const item=model.scene.items.find(i=>i.id===p.id);assert(item,themeId+'/'+p.id);assert.equal(item.x,p.x);assert.equal(item.y,p.y);assert.equal(item.rotation||0,p.rotation);assert.deepEqual(scene.roomExpansionLegacyPoses[p.id],{x:p.x,y:p.y,rotation:p.rotation},themeId+' exact trusted old pose');}
  for(const id of record.removed)assert(!model.scene.items.some(i=>i.id===id));
  const upgraded=model.record(),roundtrip=createRoomLayoutModel({themeId,scene,catalog:art,record:upgraded});assert.deepEqual(roundtrip.record(),upgraded,themeId+' current export');assert.equal(JSON.stringify(record),raw);assert.equal(JSON.stringify(scene),authored);
 }
});

test('the real edited e6a709a Botanical room retains its moved bed, removal and user-added native chair',()=>{
 const {modified}=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url))),art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);
 const scene=getInterior(modified.request),raw=JSON.stringify(modified.record),model=createRoomLayoutModel({themeId:modified.themeId,scene,catalog:art,record:modified.record}),upgraded=model.record();
 assert.deepEqual(upgraded.added,modified.record.added);assert(upgraded.removed.includes(modified.removed));assert(!model.scene.items.some(i=>i.id===modified.removed));assert(model.scene.items.some(i=>i.id===modified.userAdded));
 assert.deepEqual(upgraded.placements.filter(i=>modified.record.placements.some(old=>old.id===i.id)),modified.record.placements);assert.equal(JSON.stringify(modified.record),raw);assert.deepEqual(createRoomLayoutModel({themeId:modified.themeId,scene,catalog:art,record:upgraded}).record(),upgraded);
});

test('migration cannot admit new built-ins into the player’s reserved purchased floor or wall regions',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url))).cases.find(c=>c.themeId==='player'),art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);
 const scene=getInterior(frozen.request),table=art.get('family-player-dining-table'),poster=art.get('collection-player-poster'),added=[{id:'family-reserved-floor',asset:table.id,x:1800,y:900,w:table.w*.7,h:table.h*.7,solid:true},{id:'family-reserved-wall',asset:poster.id,x:800,y:98,w:poster.w*.5,h:poster.h*.5,solid:false,wallMounted:true}].map(i=>({...i,roomExpansion:'family-room-1',collisionBoxes:i.solid?furnitureFacingBoxes(art.get(i.asset),i):[]})),expanded={...scene,items:[...scene.items,...added],solids:[...scene.solids,...added.flatMap(i=>i.collisionBoxes)]};
 const model=createRoomLayoutModel({themeId:'player',scene:expanded,catalog:art,record:frozen.record});for(const item of added){assert(!model.scene.items.some(i=>i.id===item.id));assert(model.record().removed.includes(item.id));}
});

test('only exact trusted preceding authored poses retain their original geometry exemption after rearrangement',()=>{
 const {scene}=fixture(),poster={id:'old-wall-art',asset:'poster',x:80,y:80,w:40,h:50,wallMounted:true,solid:false,collisionBoxes:[]};scene.windows=[{x:80,y:20,w:100}];scene.items.push(poster);
 const old=createRoomLayoutModel({themeId:'fixture',scene,catalog}).record(),expanded=expandedFixture(scene,[{id:'family-good',asset:'chair',x:490,y:200,w:40,h:60,solid:true}]);expanded.roomExpansionLegacyPoses=Object.fromEntries(scene.items.map(i=>[i.id,{x:i.x,y:i.y,rotation:i.rotation||0}]));expanded.items=expanded.items.map(i=>i.id===poster.id?{...i,x:160}:i);
 const migrated=createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:old});assert.equal(migrated.scene.items.find(i=>i.id===poster.id).x,80);const current=migrated.record();assert.notEqual(current.baseSignature,old.baseSignature);assert.deepEqual(createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:current}).record(),current);
 const changed=JSON.parse(JSON.stringify(old));changed.placements.find(i=>i.id===poster.id).x=81;changed.roomExpansionLegacyPoses={[poster.id]:{x:81,y:80,rotation:0}};assert.throws(()=>createRoomLayoutModel({themeId:'fixture',scene:expanded,catalog,record:changed}),/window clear/,'Imported metadata cannot grant an exemption to an edited pose');
 const untrusted={...expanded};delete untrusted.roomExpansionLegacyPoses;assert.throws(()=>createRoomLayoutModel({themeId:'fixture',scene:untrusted,catalog,record:old}),/window clear/);
});

test('all31 actual e6a709a records survive rearranged originals using exact trusted pre-expansion poses',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url))),art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);
 for(const {themeId,request,record}of frozen.cases){
  const source=getInterior(request),a=art.get('family-'+themeId+'-plant'),outside={id:source.id+':family-room-1:test-outside',roomExpansion:'family-room-1',asset:a.id,x:-100,y:-100,w:a.w*.5,h:a.h*.5,solid:true};Object.defineProperty(outside,'collisionBoxes',{value:furnitureFacingBoxes(a,outside)});
  const scene={...source,items:[...source.items.map(i=>({...i,x:i.x+(i.roomExpansion?0:1),collisionBoxes:i.collisionBoxes})),outside],solids:[...source.solids,...outside.collisionBoxes],roomExpansionLegacyPoses:Object.fromEntries(record.placements.map(p=>[p.id,{x:p.x,y:p.y,rotation:p.rotation}]))},model=createRoomLayoutModel({themeId,scene,catalog:art,record});
  assert.notEqual(model.record().baseSignature,record.baseSignature);for(const p of record.placements){const item=model.scene.items.find(i=>i.id===p.id);assert.equal(item.x,p.x,themeId);assert.equal(item.y,p.y,themeId);assert.equal(item.rotation||0,p.rotation,themeId);}assert(!model.scene.items.some(i=>i.id===outside.id));
  assert.deepEqual(createRoomLayoutModel({themeId,scene,catalog:art,record:model.record()}).record(),model.record(),themeId+' upgraded export');
 }
});


test('south showroom entrances preserve older upper-room arcades while still rejecting new doorway obstructions',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../../tests/fixtures/room-layout-e6a709a.json',import.meta.url))),art=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(art);
 for(const entry of frozen.cases.filter(c=>c.request.kind==='showroom'&&getInterior(c.request).floor===2)){
  const scene=getInterior(entry.request),before=JSON.stringify(entry.record),model=createRoomLayoutModel({themeId:entry.themeId,scene,catalog:art,record:entry.record}),portal=model.scene.portalExit,approach={x:portal.threshold.x,y:portal.threshold.y-24};
  assert.deepEqual(portal.enterNormal,{x:0,y:-1});assert.equal(model.scene.spawn.x,scene.showroom.column?112:1072);
  for(const saved of entry.record.placements){const item=model.scene.items.find(i=>i.id===saved.id);assert.equal(item.x,saved.x);assert.equal(item.y,saved.y);assert.equal(item.rotation||0,saved.rotation);}
  assert(!model.scene.solids.some(b=>approach.x>=b.x-6&&approach.x<=b.x+b.w+6&&approach.y>=b.y-6&&approach.y<=b.y+b.h+6),'The new physical south approach must remain clear of old saved arcade cabinets');
  const exported=JSON.stringify(model.record()),asset='collection-'+entry.themeId+'-dining-chair';
  assert.equal(model.add(asset,{x:approach.x,y:approach.y+8}).ok,false,'A new object cannot use the migrated doorway as a free placement');assert.match(model.held.reason,/doorways|arrival/);assert.equal(JSON.stringify(model.record()),exported);model.cancel();
  assert.equal(JSON.stringify(entry.record),before);assert.deepEqual(createRoomLayoutModel({themeId:entry.themeId,scene,catalog:art,record:model.record()}).record(),model.record());
 }
});
