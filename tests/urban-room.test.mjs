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

test('wall decorations use their wall zones while existing floor furniture keeps its saved positions',()=>{
 const items=[...furniture,{id:'furniture-poster',asset:'poster',scale:.75}],art=new Map([...catalog,['poster',{w:128,h:128,boxes:[],wallMounted:true}]]);
 const bounds={wall:[{x:100,y:4,w:500,h:98}],floor:[{x:0,y:150,w:1000,h:650}]};
 const {api,storage}=setup({catalog:art,furniture:items,owned:()=>items.map(i=>i.id),getBounds:(_item,a)=>a.wallMounted?bounds.wall:bounds.floor});
 assert.equal(api.place('furniture-chair',250,350).ok,true);
 const old=api.snapshot()[0];
 assert.equal(api.place('furniture-poster',250,102).ok,true);
 assert.equal(api.place('furniture-poster',250,400).ok,false,'a poster cannot float in the middle of the floor');
 assert.equal(api.place('furniture-chair',250,102).ok,false,'floor furniture cannot mount on the wall');
 const reloaded=setup({storage,catalog:art,furniture:items,owned:()=>items.map(i=>i.id),getBounds:(_item,a)=>a.wallMounted?bounds.wall:bounds.floor}).api;
 assert.equal(reloaded.load().ok,true);assert.deepEqual(reloaded.snapshot().find(i=>i.item==='furniture-chair'),old);
 assert.equal(reloaded.snapshot().find(i=>i.item==='furniture-poster').y,102);
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

test('cardinal facing quarter-turns the original physical boxes exactly',()=>{
 const at={asset:'chair',x:200,y:300};
 assert.deepEqual(roomItemBoxes({...at,rotation:0},catalog),[{x:170,y:265,w:60,h:30}]);
 assert.deepEqual(roomItemBoxes({...at,rotation:90},catalog),[{x:205,y:270,w:30,h:60}]);
 assert.deepEqual(roomItemBoxes({...at,rotation:180},catalog),[{x:170,y:305,w:60,h:30}]);
 assert.deepEqual(roomItemBoxes({...at,rotation:270},catalog),[{x:165,y:270,w:30,h:60}]);
});
test('room furniture keeps its chosen facing when moved and after reload',()=>{
 const {api,storage}=setup();assert(api.place('furniture-chair',200,300,90).ok);
 assert.equal(api.snapshot()[0].rotation,90);assert(api.place('furniture-chair',300,300).ok);assert.equal(api.snapshot()[0].rotation,90);
 const reloaded=setup({storage}).api;assert(reloaded.load().ok);assert.equal(reloaded.snapshot()[0].rotation,90);
 assert(reloaded.place('furniture-chair',300,300,270).ok);assert.equal(JSON.parse(storage.getItem(ROOM_KEY)).items[0].rotation,270);
 const before=storage.getItem(ROOM_KEY);
 for(const rotation of [-90,45,360,'90',null,NaN,Infinity])assert.equal(reloaded.place('furniture-chair',300,300,rotation).ok,false);
 assert.equal(storage.getItem(ROOM_KEY),before);
});
test('loading an old layout preserves its exact bytes and absent optional facing and scale fields',()=>{
 const storage=disk(),item={x:200,id:'room-furniture-chair',asset:'chair',item:'furniture-chair',y:300};
 const raw=JSON.stringify({version:1,owner:'player-one',items:[item]},null,3);storage.setItem(ROOM_KEY,raw);
 const {api}=setup({storage});assert(api.load().ok);assert.equal(storage.getItem(ROOM_KEY),raw);assert.deepEqual(api.snapshot(),[item]);
 assert.equal(Object.hasOwn(api.snapshot()[0],'rotation'),false);assert.equal(Object.hasOwn(api.snapshot()[0],'scale'),false);
 const again=setup({storage}).api;assert(again.load().ok);assert.equal(storage.getItem(ROOM_KEY),raw);
 assert(again.place('furniture-table',360,300,180).ok);assert.deepEqual(JSON.parse(storage.getItem(ROOM_KEY)).items.find(i=>i.item==='furniture-chair'),item);
});
test('actual upright directional image bounds determine whether a placement fits',()=>{
 const art=new Map(catalog),chair={...catalog.get('chair'),id:'chair',group:'furniture',getFacingView:direction=>direction==='west'?{w:300,h:100,footCenter:{x:150,y:80}}:{w:80,h:100,footCenter:{x:40,y:80}}};art.set('chair',chair);
 const {api}=setup({catalog:art});assert.equal(api.place('furniture-chair',100,300,90).ok,false,'Wide side artwork crosses the left room edge');
 assert.equal(api.place('furniture-chair',200,300,90).ok,true);assert.equal(api.snapshot()[0].rotation,90);
});
test('turning an item cannot rotate its physical base into fixed furniture',()=>{
 const {api,storage}=setup();assert.equal(api.place('furniture-chair',470,430,0).ok,true);const before=storage.getItem(ROOM_KEY);
 assert.equal(api.place('furniture-chair',470,430,90).ok,false);assert.equal(storage.getItem(ROOM_KEY),before);assert.equal(api.snapshot()[0].rotation,0);
});
test('invalid stored facings are rejected without changing the previous saved bytes',()=>{
 const {api,storage}=setup();const item={id:'room-furniture-chair',item:'furniture-chair',asset:'chair',x:200,y:300};
 for(const rotation of [45,360,-90,'north',null]){const raw=JSON.stringify({version:1,owner:'player-one',items:[{...item,rotation}]});storage.setItem(ROOM_KEY,raw);assert.equal(api.load().ok,false);assert.equal(storage.getItem(ROOM_KEY),raw);}
});

test('unsupported legacy size fields cannot shrink native collision or bypass the fixed catalog scale',()=>{
 const item={id:'room-furniture-chair',item:'furniture-chair',asset:'chair',x:20,y:300,w:1,h:1,scaleX:.01,scaleY:.01};
 assert.deepEqual(roomItemBoxes(item,catalog),[{x:-10,y:265,w:60,h:30}]);
 const {api,storage}=setup(),raw=JSON.stringify({version:1,owner:'player-one',items:[item]});storage.setItem(ROOM_KEY,raw);assert.equal(api.load().ok,false);assert.equal(storage.getItem(ROOM_KEY),raw);
 item.x=200;const validRaw=JSON.stringify({version:1,owner:'player-one',items:[item]});storage.setItem(ROOM_KEY,validRaw);assert(api.load().ok);assert.equal(storage.getItem(ROOM_KEY),validRaw);assert(!Object.hasOwn(api.snapshot()[0],'w'));assert(!Object.hasOwn(api.snapshot()[0],'scaleX'));
});
