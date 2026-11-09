import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SHOWROOMS,STORE_TRAFFIC} from './showroom-layout.mjs';
import {getInterior,STORE_FOOTPRINT} from './urban-interiors.mjs';

const require=createRequire(import.meta.url),stock=require('../../furniture-catalog.js'),products=new Map(stock.map(p=>[p.id,p]));
const shop=getInterior({kind:'shop'}),overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const blocked=(point,pad=16)=>shop.solids.some(r=>point.x>=r.x-pad&&point.x<=r.x+r.w+pad&&point.y>=r.y-pad&&point.y<=r.y+r.h+pad);
function sample(a,b,check){
 assert(Math.abs(a.x-b.x)<.01||Math.abs(a.y-b.y)<.01,'An authored walk must have cardinal legs');
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
 for(let i=0;i<=count;i++)check({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count});
}

test('eight furnished rooms provide eight distinct finish pairs and every existing store product',()=>{
 assert.equal(SHOWROOMS.length,8);assert.equal(shop.rooms.length,8);
 for(const field of ['id','name'])assert.equal(new Set(SHOWROOMS.map(r=>r[field])).size,8);
 for(const field of ['floor','wallpaper']){
  assert.equal(new Set(SHOWROOMS.map(r=>r[field].pattern)).size,8);
  assert.equal(new Set(SHOWROOMS.map(r=>r[field].colors.join(','))).size,8);
 }
 assert.equal(new Set(SHOWROOMS.map(r=>r.productIds.slice().sort().join(','))).size,8);
 assert.deepEqual([...new Set(SHOWROOMS.flatMap(r=>r.productIds))].sort(),stock.map(p=>p.id).sort());
 for(const room of SHOWROOMS){
  assert(Object.isFrozen(room)&&Object.isFrozen(room.items)&&Object.isFrozen(room.floor.colors));
  assert(room.items.length>=5,'Each style needs a complete furnishing arrangement');
  for(const item of room.items)assert.equal(products.get(item.productId)?.asset,item.asset,'Every displayed product retains its actual purchasable artwork');
  const actual=shop.rooms.find(r=>r.showroomId===room.id);assert(actual);
  assert.deepEqual(actual.productIds,room.productIds);assert.deepEqual(actual.floorFinish,room.floor);assert.deepEqual(actual.wallpaper,room.wallpaper);
 }
});

test('the original floor plate and street entrance retain clear central and cross-hall routes',()=>{
 assert.deepEqual({width:shop.width,height:shop.height},STORE_FOOTPRINT);
 assert.deepEqual(shop.spawn,{x:1536,y:1840});assert.deepEqual(shop.spawn,STORE_TRAFFIC.spawn);
 const before=JSON.stringify(SHOWROOMS);
 for(const room of SHOWROOMS){
  const route=[shop.spawn,{x:STORE_TRAFFIC.incomingX,y:shop.spawn.y},{x:STORE_TRAFFIC.incomingX,y:STORE_TRAFFIC.ingressY},{x:room.entry.x,y:STORE_TRAFFIC.ingressY},room.entry,room.doorway,room.browse];
  for(let i=1;i<route.length;i++)sample(route[i-1],route[i],p=>assert(!blocked(p),room.name+' must be reachable at '+p.x+','+p.y));
  const back=[room.browse,room.doorway,{x:room.entry.x,y:STORE_TRAFFIC.egressY},{x:STORE_TRAFFIC.outgoingX,y:STORE_TRAFFIC.egressY},{x:STORE_TRAFFIC.outgoingX,y:shop.spawn.y},shop.spawn];
  for(let i=1;i<back.length;i++)sample(back[i-1],back[i],p=>assert(!blocked(p),room.name+' must have a clear return to the street'));
 }
 assert.equal(JSON.stringify(SHOWROOMS),before);
});

test('real dividing walls enclose each room while wallpaper leaves its doorway open',()=>{
 for(const room of SHOWROOMS){
  const walls=shop.walls.filter(w=>w.showroomId===room.id);assert(walls.length>=5);
  assert(!blocked(room.doorway));
  for(const x of [room.doorway.x-94,room.doorway.x+94])assert(blocked({x,y:room.doorway.y},0),'The door must be a real opening in the divider');
  for(const panel of room.wallpaperAreas){assert(!overlaps(panel,room.doorOpening));assert(panel.w>=180&&panel.h>=82);}
  const browse=shop.zones.find(z=>z.showroomId===room.id);
  assert(browse&&browse.action==='shop');assert(room.browse.x>=browse.x&&room.browse.x<=browse.x+browse.w&&room.browse.y>=browse.y&&room.browse.y<=browse.y+browse.h);
 }
});

test('furniture arrangements remain inside their rooms and keep their floor footprints separate',()=>{
 for(const room of SHOWROOMS){
  const items=shop.items.filter(item=>item.showroomId===room.id),footprints=[];
  assert.equal(items.length,room.items.length);
  for(const item of items){
   assert(item.x-item.w/2>=room.x+20&&item.x+item.w/2<=room.x+room.w-20,item.asset+' must fit between its room walls');
   assert(item.y-item.h>=room.y&&item.y<=room.y+room.h-24,item.asset+' must fit vertically in its room');
   if(!item.solid)continue;
   const depth=item.asset==='furniture-2-180'?item.h*.72:Math.min(item.h*.48,item.w*.5),feet={x:item.x-item.w*.43,y:item.y-depth,w:item.w*.86,h:depth};
   assert(!footprints.some(other=>overlaps(feet,other)),room.name+' has colliding display furniture');footprints.push(feet);
  }
 }
 const checkout=shop.items.find(i=>i.fixture==='checkout');assert(checkout&&checkout.x<1000);
});
