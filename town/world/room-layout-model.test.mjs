import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
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
 const art=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a]));configureUrbanInteriors(art);
 const themes=[...residents.map(r=>[r.id,{kind:'apartment',resident:r.id}]),['player',{kind:'apartment',resident:'player'}],...SHOWROOMS.map(r=>['showroom-'+r.id,{kind:'showroom',showroomId:r.id}])];
 for(const [themeId,request]of themes){const scene=getInterior(request),original=JSON.stringify(scene),model=createRoomLayoutModel({themeId,scene,catalog:art});assert.equal(model.hasEdits,false);assert.equal(createRoomLayoutModel({themeId,scene,catalog:art,record:model.record()}).scene.items.length,scene.items.length);
  const bed=model.scene.items.find(i=>art.get(i.asset)?.slot==='bed'),b=furnitureFacingBounds(art.get(bed.asset),bed),p={x:b.x+b.w*.65,y:b.y+b.h*.9};assert.equal(model.pick(p).ok,true,themeId);assert.equal(model.held.originalId,bed.id);assert.equal(model.move({x:p.x+.25,y:p.y}).ok,true,themeId+' preview');assert.equal(model.place().ok,true,themeId+' commit');
  const next=createRoomLayoutModel({themeId,scene,catalog:art,record:model.record()});assert.equal(next.scene.items.find(i=>i.id===bed.id).x,bed.x+.25);assert.equal(JSON.stringify(scene),original,'The authored '+themeId+' model stays immutable');
 }
});

test('player template edits cannot invalidate existing purchased floor furniture or wall art',()=>{
 const atlas=JSON.parse(readFileSync(new URL('../assets/decor/atlas.json',import.meta.url))),def=decorDefinitions.find(d=>d.id==='decor-08-01'),cell=atlas.find(s=>s.family===def.family).cells[def.index],fit=Math.min(def.maxW/cell.w,def.maxH/cell.h),w=Math.ceil(cell.w*fit),h=Math.ceil(cell.h*fit);
 const geranium={id:def.id,w,h,boxes:decorCollisionBoxes(def,w,h),collisionDefault:def.solid},art=new Map([...APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a]),[geranium.id,geranium]]);configureUrbanInteriors(art);
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
