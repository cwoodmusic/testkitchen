import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerRoomSourceResolver} from './player-room-source.mjs';
import {createRoomStorage,ROOM_KEY,roomItemBoxes} from './urban-room.mjs';
import {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs';
import {furniturePresentationScale} from './private-furniture.mjs';

const catalog=new Map([
 ['chair',{id:'chair',w:40,h:60,solid:true,purpose:'dining-chair',boxes:[{x:4,y:34,w:32,h:22}]}],
 ['poster',{id:'poster',w:80,h:100,solid:false,purpose:'wall-art',wallMounted:true,boxes:[]}]
]);
const furniture=[{id:'chair-product',asset:'chair',scale:1},{id:'poster-product',asset:'poster',scale:1}],owner='["owner","class-a","student-a"]',owned=()=>furniture.map(p=>p.id);
const chair=(x,y)=>({id:'room-chair-product',item:'chair-product',asset:'chair',x,y,scale:1,rotation:270});
const poster=(x,y)=>({id:'room-poster-product',item:'poster-product',asset:'poster',x,y,scale:1,rotation:0});
function fixture(items=[chair(2150,900)],recordOwner=owner){
 let raw=JSON.stringify({version:1,owner:recordOwner,items},null,3),reads=0,writes=0;
 const storage={getItem:key=>{if(key===ROOM_KEY){reads++;return raw;}return null;},setItem(){writes++;}};
 const compact={id:'apartment-player',kind:'apartment',resident:'player',width:1184,height:512,solids:[],personalRoomAreas:{floor:[{x:100,y:300,w:240,h:100}],wall:[{x:424,y:4,w:120,h:98}]}},legacy={id:'apartment-player',kind:'apartment',resident:'player',width:2304,height:1184,solids:[]};
 Object.defineProperty(compact,'roomLayoutLegacySources',{value:[legacy]});
 const resolver=createPlayerRoomSourceResolver({storage,owner,catalog,furniture,owned});
 return {compact,legacy,resolver,storage,get raw(){return raw;},set raw(next){raw=next;},get reads(){return reads;},get writes(){return writes;}};
}
function load(scene,storage){return createRoomStorage({storage,owner,catalog,furniture,owned,presentationScale:(item,a)=>furniturePresentationScale(item,scene,a),getBounds:(_item,a)=>(a.wallMounted?apartmentWallDecorBounds:apartmentDecorBounds)(scene),getSolids:()=>scene.solids}).load();}

test('an actual compact player scene owns fresh floor/wall bounds while descriptors and legacy scenes keep historical bounds',()=>{
 const f=fixture(),floor=apartmentDecorBounds(f.compact),wall=apartmentWallDecorBounds(f.compact);assert.deepEqual(floor,f.compact.personalRoomAreas.floor);assert.deepEqual(wall,f.compact.personalRoomAreas.wall);floor[0].x=999;assert.equal(f.compact.personalRoomAreas.floor[0].x,100);
 assert.deepEqual(apartmentDecorBounds(f.legacy),[{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}]);assert.deepEqual(apartmentWallDecorBounds({kind:'apartment',resident:'player'}),[{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}]);assert.equal(apartmentDecorBounds({kind:'apartment',resident:'bach'}),null);
});

test('same stable-owner legacy purchases select the exact registered old scene without changing bytes, poses, scale or facing',()=>{
 const f=fixture(),raw=f.raw,selected=f.resolver.resolve(f.compact),before=roomItemBoxes(chair(2150,900),catalog,(i,a)=>furniturePresentationScale(i,f.legacy,a));assert.equal(selected,f.legacy);
 const result=load(selected,f.storage);assert.equal(result.ok,true);assert.deepEqual(result.items,[chair(2150,900)]);assert.deepEqual(roomItemBoxes(result.items[0],catalog,(i,a)=>furniturePresentationScale(i,selected,a)),before);assert.equal(f.raw,raw);assert.equal(f.writes,0);
});

test('valid compact purchases take priority even if old bounds would also admit them',()=>{
 for(const items of [[chair(200,360)],[poster(480,80)]]){const f=fixture(items),raw=f.raw;assert.equal(f.resolver.resolve(f.compact),f.compact);assert.equal(load(f.compact,f.storage).ok,true);assert.equal(f.raw,raw);assert.equal(f.writes,0);}
});

test('another owner, unknown products, unowned items and malformed records never trigger a legacy source',()=>{
 const other=fixture([chair(2150,900)],'another-student');assert.equal(other.resolver.resolve(other.compact),other.compact);assert.equal(load(other.compact,other.storage).differentOwner,true);
 const f=fixture();for(const raw of ['{bad',JSON.stringify({version:1,owner,items:'bad'}),JSON.stringify({version:1,owner,items:[{...chair(2150,900),item:'unknown'}]}),JSON.stringify({version:1,owner,items:[{...chair(2150,900),scale:2}],roomLayoutLegacySources:[f.legacy]})]){f.raw=raw;f.resolver.invalidate();assert.equal(f.resolver.resolve(f.compact),f.compact);assert.equal(f.raw,raw);}
 const unowned=fixture(),resolver=createPlayerRoomSourceResolver({storage:unowned.storage,owner,catalog,furniture,owned:()=>[]});assert.equal(resolver.resolve(unowned.compact),unowned.compact);assert.equal(unowned.writes,0);
});

test('legacy candidates still require all original fixed-solid and ownership validation, in registered source order',()=>{
 const f=fixture(),blocked={...f.legacy,solids:[{x:2100,y:850,w:100,h:100}]},clear={...f.legacy,solids:[]},compact={...f.compact};Object.defineProperty(compact,'roomLayoutLegacySources',{value:[blocked,clear]});assert.equal(f.resolver.resolve(compact),clear);
 const noCandidate={...f.compact};assert.equal(f.resolver.resolve(noCandidate),noCandidate);assert.equal(f.writes,0);
});

test('room sources cache between frames, invalidate for changed storage, and clear to compact without losing inventory',()=>{
 const f=fixture();assert.equal(f.resolver.resolve(f.compact),f.legacy);const reads=f.reads;for(let i=0;i<500;i++)assert.equal(f.resolver.resolve(f.compact),f.legacy);assert.equal(f.reads,reads);
 f.raw=JSON.stringify({version:1,owner,items:[]});f.resolver.invalidate();assert.equal(f.resolver.resolve(f.compact),f.compact);assert.equal(f.writes,0);assert.deepEqual(owned(),['chair-product','poster-product']);
 f.raw=JSON.stringify({version:1,owner,items:[chair(2150,900)]});f.resolver.invalidate();assert.equal(f.resolver.resolve(f.compact),f.legacy);
 const newOwner=createPlayerRoomSourceResolver({storage:f.storage,owner:'new-student',catalog,furniture,owned});assert.equal(newOwner.resolve(f.compact),f.compact,'A new active profile must not inherit the preceding owner’s source cache');
});

test('registered source chains use the actual resolved template geometry rather than a descriptor or unedited placeholder',()=>{
 const f=fixture(),edited={...f.legacy,solids:[{x:2100,y:850,w:100,h:100}]},nested={...f.legacy,solids:[]},compact={...f.compact};Object.defineProperty(f.legacy,'roomLayoutLegacySources',{value:[nested]});Object.defineProperty(compact,'roomLayoutLegacySources',{value:[f.legacy]});let resolved=0;
 const resolver=createPlayerRoomSourceResolver({storage:f.storage,owner,catalog,furniture,owned,resolveLayout:scene=>{resolved++;return scene===f.legacy?edited:scene;}});assert.equal(resolver.resolve(compact),nested);assert.equal(resolved,2);assert.equal(f.writes,0);
});
