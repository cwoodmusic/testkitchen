import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_KEY,createRoomStorage,roomItemBoxes} from '../town/world/urban-room.mjs';

const furniture=[{id:'furniture-chair',asset:'chair'},{id:'furniture-table',asset:'table'},{id:'furniture-plant',asset:'plant'}];
const catalog=new Map([
 ['chair',{w:80,h:100,boxes:[{x:10,y:65,w:60,h:30}]}],
 ['table',{w:160,h:120,boxes:[{x:10,y:60,w:140,h:55}]}],
 ['plant',{w:60,h:120,boxes:[]}]
]);
function disk(){return {data:new Map(),fail:false,getItem(key){if(this.fail)throw Error('denied');return this.data.get(key)??null;},setItem(key,value){if(this.fail)throw Error('quota');this.data.set(key,value);}};}
function setup(options={}){
 const storage=options.storage||disk(),api=createRoomStorage({storage,owner:'player-one',catalog,furniture,owned:()=>furniture.map(item=>item.id),getBounds:()=>[{x:0,y:0,w:1000,h:800}],getSolids:()=>[{x:500,y:400,w:120,h:120}],...options});
 return {storage,api};
}

test('furniture uses builder bottom-center anchors and physical collision boxes',()=>{
 assert.deepEqual(roomItemBoxes({asset:'chair',x:200,y:300},catalog),[{x:170,y:265,w:60,h:30}]);
 assert.deepEqual(roomItemBoxes({asset:'missing',x:0,y:0},catalog),[]);
});

test('catalog scale fixes visible bounds and collision size and survives reloads',()=>{
 const scaled=furniture.map(item=>({...item,scale:item.id==='furniture-chair'?2:1}));
 const {api,storage}=setup({furniture:scaled});
 assert.equal(api.place('furniture-chair',70,300).ok,false,'A double-size chair needs80pixels to its left');
 assert.equal(api.place('furniture-chair',200,190).ok,false,'The full200-pixel-tall sprite must fit');
 const placed=api.place('furniture-chair',200,300);
 assert.equal(placed.ok,true);assert.equal(placed.item.scale,2);
 assert.deepEqual(roomItemBoxes(placed.item,catalog),[{x:140,y:230,w:120,h:60}]);
 const loaded=setup({storage,furniture:scaled}).api;
 assert.equal(loaded.load().ok,true);assert.equal(loaded.snapshot()[0].scale,2);
 const raw=JSON.parse(storage.getItem(ROOM_KEY));raw.items[0].scale=.1;
 storage.setItem(ROOM_KEY,JSON.stringify(raw));assert.equal(loaded.load().ok,false,'A save cannot shrink a fixed-size product');
});

test('a purchased decoration places, moves, reloads, and returns to inventory',()=>{
 const {api,storage}=setup();
 assert.deepEqual(api.load(),{ok:true,items:[]});
 const first=api.place('furniture-chair',200,300);
 assert.equal(first.ok,true);
 const moved=api.place('furniture-chair',300,350);
 assert.equal(moved.ok,true);assert.equal(moved.item.id,first.item.id);assert.equal(api.snapshot().length,1);
 const loaded=setup({storage}).api;
 assert.equal(loaded.load().ok,true);assert.deepEqual(loaded.snapshot(),api.snapshot());
 const external=loaded.snapshot();external[0].x=999;
 assert.equal(loaded.snapshot()[0].x,300,'Callers cannot mutate the save through a snapshot');
 assert.equal(loaded.remove(first.item.id).ok,true);assert.deepEqual(loaded.snapshot(),[]);
 assert.deepEqual(JSON.parse(storage.getItem(ROOM_KEY)).items,[]);
});

test('placement enforces ownership, visible room bounds, fixed furniture, and other furniture',()=>{
 const {api}=setup({owned:()=>['furniture-chair','furniture-table']});
 assert.equal(api.place('furniture-plant',200,300).ok,false);
 assert.equal(api.place('furniture-chair',20,300).ok,false,'Visible art cannot cross the room edge');
 assert.equal(api.place('furniture-chair',550,450).ok,false,'Fixed walls and furniture block placement');
 assert.equal(api.place('furniture-chair',200,300).ok,true);
 assert.equal(api.place('furniture-table',200,300).ok,false,'Physical furniture cannot overlap');
 assert.equal(api.place('furniture-table',350,300).ok,true);
 assert.equal(api.place('furniture-chair',Number.NaN,300).ok,false);
 assert.equal(api.place('furniture-chair',300,Infinity).ok,false);
 assert.equal(api.snapshot().length,2);
});

test('a failed write leaves the previous layout and save untouched',()=>{
 const {api,storage}=setup();api.place('furniture-chair',200,300);
 const before=storage.getItem(ROOM_KEY),snapshot=api.snapshot();storage.fail=true;
 assert.equal(api.place('furniture-chair',300,300).ok,false);
 assert.equal(api.remove(snapshot[0].id).ok,false);
 assert.equal(api.clear().ok,false);
 assert.deepEqual(api.snapshot(),snapshot);assert.equal(storage.data.get(ROOM_KEY),before);
});

test('another player never receives or rewrites the previous player layout during load',()=>{
 const {api,storage}=setup();api.place('furniture-chair',200,300);
 const before=storage.getItem(ROOM_KEY),other=setup({storage,owner:'player-two'}).api;
 assert.deepEqual(other.load(),{ok:true,items:[],differentOwner:true});
 assert.deepEqual(other.snapshot(),[]);assert.equal(storage.getItem(ROOM_KEY),before);
 assert.equal(other.place('furniture-table',350,300).ok,true);
 assert.equal(JSON.parse(storage.getItem(ROOM_KEY)).owner,'player-two');
});

test('invalid saves are rejected without silently discarding furniture or modifying data',()=>{
 const {api,storage}=setup();
 const valid={id:'room-furniture-chair',item:'furniture-chair',asset:'chair',x:200,y:300};
 for(const items of [[{...valid,asset:'unknown'}],[{...valid,x:'200'}],[valid,{...valid}],[{...valid,x:-100}],Array.from({length:101},()=>valid)]){
  const raw=JSON.stringify({version:1,owner:'player-one',items});storage.setItem(ROOM_KEY,raw);
  assert.equal(api.load().ok,false);assert.equal(storage.getItem(ROOM_KEY),raw);assert.deepEqual(api.snapshot(),[]);
 }
 const unowned=setup({storage,owned:()=>[]}).api;
 storage.setItem(ROOM_KEY,JSON.stringify({version:1,owner:'player-one',items:[valid]}));
 assert.equal(unowned.load().ok,false);
 storage.setItem(ROOM_KEY,'{broken');assert.equal(api.load().ok,false);
 storage.setItem(ROOM_KEY,' '.repeat(100000));assert.equal(api.load().ok,false);
});
