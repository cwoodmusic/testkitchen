import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoomLayoutStorage,roomLayoutStorageKey,ROOM_LAYOUT_STORAGE_PREFIX} from './room-layout-storage.mjs';
const record=(themeId,x=200)=>({format:'coda-room-layout',version:1,themeId,baseSignature:'room-test',placements:[{id:'chair-1',x,y:300,rotation:0,support:null}],removed:[],added:[]});
function disk(){return {data:new Map(),writes:0,fail:false,getItem(k){if(this.fail)throw Error('unavailable');return this.data.get(k)??null;},setItem(k,v){if(this.fail)throw Error('quota');this.writes++;this.data.set(k,v);}};}

test('design templates have their own local namespace and never touch map, wallet or purchased room keys',()=>{
 const storage=disk();for(const [key,value]of [['codaTownBuilderV1','map'],['codaUrbanRoomV1','purchases'],['codaNotesWalletV1','wallet']])storage.data.set(key,value);
 const api=createRoomLayoutStorage({storage,eventTarget:null});assert.equal(api.key,ROOM_LAYOUT_STORAGE_PREFIX+'builder');assert.equal(api.load('bach').record,null);assert.equal(api.save('bach',record('bach')).ok,true);
 assert.equal(storage.data.get('codaTownBuilderV1'),'map');assert.equal(storage.data.get('codaUrbanRoomV1'),'purchases');assert.equal(storage.data.get('codaNotesWalletV1'),'wallet');assert.deepEqual(api.load('bach').record,record('bach'));
 const returned=api.load('bach').record;returned.placements[0].x=999;assert.equal(api.load('bach').record.placements[0].x,200);
});

test('owners and themes remain independent and reset removes only its chosen theme',()=>{
 const storage=disk(),one=createRoomLayoutStorage({storage,owner:'one',eventTarget:null}),two=createRoomLayoutStorage({storage,owner:'two',eventTarget:null});
 one.save('bach',record('bach'));one.save('player',record('player'));two.save('bach',record('bach',500));assert.equal(one.remove('bach').ok,true);assert.equal(one.load('bach').record,null);assert(one.load('player').record);assert.equal(two.load('bach').record.placements[0].x,500);assert.notEqual(roomLayoutStorageKey('one'),roomLayoutStorageKey('two'));
});

test('accepted save/remove/import operations notify runtime in the same window only after a successful write',()=>{
 const storage=disk(),target=new EventTarget(),events=[];target.addEventListener('coda-room-layout-change',e=>events.push(e.detail));const api=createRoomLayoutStorage({storage,eventTarget:target});
 api.save('bach',record('bach'));assert.equal(events.length,1);assert.deepEqual(events[0],{owner:'builder',themeIds:['bach'],key:api.key});
 storage.fail=true;assert.equal(api.save('player',record('player')).ok,false);assert.equal(events.length,1);storage.fail=false;
 api.remove('bach');assert.equal(events.length,2);const raw=JSON.stringify({format:'coda-room-layouts',version:1,owner:'other',rooms:{player:record('player')}});api.importJSON(raw);assert.equal(events.length,3);assert.deepEqual(events[2].themeIds,['player']);
});

test('whole-pack imports validate every room before one atomic write and preserve unrelated themes',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null});api.save('bach',record('bach'));const before=api.raw,writes=storage.writes;
 const pack={format:'coda-room-layouts',version:1,owner:'someone-else',rooms:{player:record('player'),mozart:record('mozart')}};
 assert.equal(api.importJSON(JSON.stringify(pack),{validateRecord:(id)=>id==='mozart'?{ok:false,error:'Bad geometry'}:true}).ok,false);assert.equal(api.raw,before);assert.equal(storage.writes,writes);assert.equal(api.load('player').record,null);
 const seen=[];assert.equal(api.importJSON(JSON.stringify(pack),{validateRecord:(id,value)=>{seen.push(id);assert.equal(value.themeId,id);return {ok:true};}}).ok,true);assert.deepEqual(seen,['player','mozart']);assert.equal(storage.writes,writes+1);assert(api.load('bach').record);assert(api.load('player').record);assert.equal(JSON.parse(api.exportJSON()).owner,'builder');
});

test('malformed or unsupported files never alter previously saved templates',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null});api.save('bach',record('bach'));const raw=api.raw,writes=storage.writes;
 for(const text of ['{','[]',JSON.stringify({format:'wrong',version:1,rooms:{}}),JSON.stringify({format:'coda-room-layouts',version:1,rooms:{bach:record('player')}}),'{"format":"coda-room-layouts","version":1,"rooms":{"__proto__":{}}}']){assert.equal(api.importJSON(text).ok,false);assert.equal(api.raw,raw);assert.equal(storage.writes,writes);}
 assert.equal(api.save('constructor',record('constructor')).ok,false);assert.equal(api.save('bach',{...record('bach'),placements:[{id:'chair',x:NaN,y:20}]}).ok,false);
});

test('corrupt stored data stays byte-exact, blocks autosave, and can be exported as a raw recovery backup',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null}),raw='{broken room data';storage.data.set(api.key,raw);
 assert.equal(api.load('bach').ok,false);assert.equal(api.save('bach',record('bach')).ok,false);assert.equal(api.remove('bach').ok,false);assert.equal(api.raw,raw);assert.equal(api.exportRawJSON(),raw);assert.throws(()=>api.exportJSON());assert.equal(storage.writes,0);assert.equal(storage.data.get(api.key),raw);
});

test('a failed write retains the last good room snapshot and emits no partial import state',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null});api.save('bach',record('bach'));const raw=api.raw;storage.fail=true;assert.equal(api.save('bach',record('bach',900)).ok,false);assert.equal(api.importJSON(JSON.stringify({format:'coda-room-layouts',version:1,rooms:{player:record('player')}})).ok,false);storage.fail=false;assert.equal(api.raw,raw);assert.equal(api.load('bach').record.placements[0].x,200);assert.equal(api.load('player').record,null);
});

test('cross-tab storage changes invalidate cached reads without requiring a page reload',()=>{
 const storage=disk(),one=createRoomLayoutStorage({storage,eventTarget:null}),two=createRoomLayoutStorage({storage,eventTarget:null});one.save('bach',record('bach'));assert.equal(two.load('bach').record.placements[0].x,200);one.save('bach',record('bach',700));assert.equal(two.load('bach').record.placements[0].x,700);
});

test('an explicit matching recovery import repairs only the design namespace and retains its original bytes',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null}),broken='{original unreadable layouts';storage.data.set(api.key,broken);storage.data.set('codaUrbanRoomV1','personal room');storage.data.set('town-map','world');
 const recovery={format:'coda-room-layouts',version:1,rooms:{bach:record('bach')},recoveryBackup:broken};let validated=0;
 assert.equal(api.importJSON(JSON.stringify(recovery),{validateRecord:(id,value)=>{validated++;assert.equal(id,'bach');assert.equal(value.themeId,id);return true;}}).ok,true);assert.equal(validated,1);assert.deepEqual(api.load('bach').record,record('bach'));assert.equal(JSON.parse(api.exportJSON()).recoveryBackup,broken);assert.equal(storage.data.get('codaUrbanRoomV1'),'personal room');assert.equal(storage.data.get('town-map'),'world');
 api.save('player',record('player'));assert.equal(JSON.parse(api.exportJSON()).recoveryBackup,broken,'Later autosaves retain the recovery backup');
});

test('missing, stale, invalid or unwritable recovery imports never overwrite corrupt originals',()=>{
 const storage=disk(),api=createRoomLayoutStorage({storage,eventTarget:null}),broken='{newer unreadable layouts';storage.data.set(api.key,broken);
 const incoming={format:'coda-room-layouts',version:1,rooms:{bach:record('bach')}};
 assert.equal(api.importJSON(JSON.stringify(incoming)).ok,false);assert.equal(api.importJSON(JSON.stringify({...incoming,recoveryBackup:'{older unreadable layouts'})).ok,false);assert.equal(api.raw,broken);assert.equal(storage.writes,0);
 const matching=JSON.stringify({...incoming,recoveryBackup:broken});assert.equal(api.importJSON(matching).ok,false,'Recovery requires semantic theme validation');assert.equal(api.importJSON(matching,{validateRecord:()=>({ok:false,error:'Invalid geometry'})}).ok,false);assert.equal(api.raw,broken);assert.equal(storage.writes,0);
 const diskSet=storage.setItem;storage.setItem=()=>{throw Error('quota');};assert.equal(api.importJSON(matching,{validateRecord:()=>true}).ok,false);storage.setItem=diskSet;assert.equal(api.raw,broken);assert.equal(storage.writes,0);
});
