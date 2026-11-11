import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomLayoutResolver,roomLayoutThemeId} from './room-layout-runtime.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {createRoomLayoutStorage} from './room-layout-storage.mjs';

function fixture(){
 const values=new Map([['codaUrbanRoomV1','purchased furniture'],['wallet','12345'],['town-map','unchanged']]);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},events=new EventTarget();
 const catalog=new Map([['chair',{id:'chair',w:40,h:40,boxes:[{x:10,y:30,w:20,h:10}]}]]);
 const item={id:'chair-1',asset:'chair',x:100,y:200,w:40,h:40,solid:true,collisionBoxes:[{x:90,y:190,w:20,h:10}]};
 const base={id:'apartment-player',kind:'apartment',resident:'player',width:500,height:500,items:[item],solids:[...item.collisionBoxes],walls:[],rooms:[],privacyDoors:[],spawn:{x:250,y:450}};
 const store=createRoomLayoutStorage({storage,eventTarget:events}),resolver=createRoomLayoutResolver({storage,events});
 return {storage,events,catalog,base,store,resolver,values};
}
test('a committed editor design is used in gameplay and invalidated on same-window save',()=>{
 const f=fixture(),original=JSON.stringify(f.base),editor=createRoomLayoutModel({themeId:'player',scene:f.base,catalog:f.catalog});
 assert.equal(f.resolver.resolve(f.base,f.catalog),f.base);
 editor.pick({x:100,y:190});editor.move({x:200,y:190});assert.equal(editor.place().ok,true);
 assert.equal(f.store.save('player',editor.record()).ok,true);
 const edited=f.resolver.resolve(f.base,f.catalog);assert.equal(edited.items[0].x,200);assert.notEqual(edited,f.base);
 assert.equal(f.resolver.resolve(f.base,f.catalog),edited,'stable render/physics identity between edits');
 assert.equal(JSON.stringify(f.base),original,'the source template is immutable');
 assert.equal(f.values.get('codaUrbanRoomV1'),'purchased furniture');assert.equal(f.values.get('wallet'),'12345');assert.equal(f.values.get('town-map'),'unchanged');
 assert.equal(f.store.remove('player').ok,true);assert.equal(f.resolver.resolve(f.base,f.catalog),f.base);f.resolver.dispose();
});
test('cross-window events refresh layouts and incompatible layouts preserve raw data',()=>{
 const f=fixture(),editor=createRoomLayoutModel({themeId:'player',scene:f.base,catalog:f.catalog});
 f.resolver.resolve(f.base,f.catalog);const record=editor.record();record.placements[0].x=220;
 const other=createRoomLayoutStorage({storage:f.storage,eventTarget:{}});assert.equal(other.save('player',record).ok,true);
 f.events.dispatchEvent(new Event('storage'));assert.equal(f.resolver.resolve(f.base,f.catalog).items[0].x,220);
 record.baseSignature='a different room';other.save('player',record);const raw=f.values.get(other.key);
 f.events.dispatchEvent(new Event('storage'));assert.equal(f.resolver.resolve(f.base,f.catalog),f.base);assert.equal(f.values.get(other.key),raw);f.resolver.dispose();
});
test('public interiors and other owners do not pick up room templates',()=>{
 const f=fixture(),hall={...f.base,kind:'hall'};assert.equal(roomLayoutThemeId(hall),null);
 assert.equal(roomLayoutThemeId({kind:'showroom',showroomId:'robot'}),'showroom-robot');
 assert.equal(f.resolver.resolve(hall,f.catalog),hall);f.resolver.dispose();
});
test('gameplay reads preceding edited templates without rewriting raw saves, then saves an upgraded record only on commit',()=>{
 const f=fixture(),record=createRoomLayoutModel({themeId:'player',scene:f.base,catalog:f.catalog}).record();record.placements[0].x=220;assert.equal(f.store.save('player',record).ok,true);
 const raw=f.values.get(f.store.key),write=f.storage.setItem;let writes=0;f.storage.setItem=(key,value)=>{writes++;write(key,value);};
 const good={...f.base.items[0],id:'family-good',x:350,roomExpansion:'family-room-1',collisionBoxes:[{x:340,y:190,w:20,h:10}]},bad={...good,id:'family-user-overlap',x:220,collisionBoxes:[{x:210,y:190,w:20,h:10}]},expanded={...f.base,items:[...f.base.items,good,bad],solids:[...f.base.solids,...good.collisionBoxes,...bad.collisionBoxes]},model=f.resolver.resolve(expanded,f.catalog);
 assert.notEqual(model,expanded);assert.equal(model.items.find(i=>i.id==='chair-1').x,220);assert(model.items.some(i=>i.id==='family-good'));assert(!model.items.some(i=>i.id==='family-user-overlap'));assert.equal(f.resolver.resolve(expanded,f.catalog),model);
 assert.equal(writes,0);assert.equal(f.values.get(f.store.key),raw);assert.equal(f.values.get('codaUrbanRoomV1'),'purchased furniture');assert.equal(f.values.get('wallet'),'12345');assert.equal(f.values.get('town-map'),'unchanged');
 const editor=createRoomLayoutModel({themeId:'player',scene:expanded,catalog:f.catalog,record}),upgraded=editor.record();assert.notEqual(upgraded.baseSignature,record.baseSignature);assert.equal(writes,0);assert.equal(f.store.save('player',upgraded).ok,true);assert.equal(writes,1);assert.notEqual(f.values.get(f.store.key),raw);assert.equal(f.store.load('player').record.baseSignature,upgraded.baseSignature);f.resolver.dispose();
});
