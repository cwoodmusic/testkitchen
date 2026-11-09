import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SHOWROOMS,STORE_TRAFFIC} from './showroom-layout.mjs';
import {getInterior,STORE_FOOTPRINT} from './urban-interiors.mjs';

const require=createRequire(import.meta.url),stock=require('../../furniture-catalog.js'),products=new Map(stock.map(p=>[p.id,p]));
const lobby=getInterior({kind:'shop'});
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const blocked=(model,p,pad=16)=>model.solids.some(r=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad);
function sample(a,b,check){
 assert(Math.abs(a.x-b.x)<.01||Math.abs(a.y-b.y)<.01,'An authored walk must have cardinal legs');
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));
 for(let i=0;i<=count;i++)check({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count});
}
function checkRoute(model,route,label){
 for(let i=1;i<route.length;i++)sample(route[i-1],route[i],p=>assert(!blocked(model,p),label+' must remain clear at '+p.x+','+p.y));
}

test('the main lobby has eight closed apartment doors and no shared display-floor interiors',()=>{
 assert.equal(SHOWROOMS.length,8);assert.equal(lobby.rooms.length,8);
 assert.deepEqual({width:lobby.width,height:lobby.height},STORE_FOOTPRINT);
 assert.deepEqual(lobby.spawn,{x:1536,y:1840});assert.deepEqual(lobby.spawn,STORE_TRAFFIC.spawn);
 assert.equal(lobby.zones.filter(z=>z.action==='showroom').length,8);
 assert.equal(lobby.doors.length,8);
 assert.equal(lobby.windows.length,0,'The lobby must not show windows floating over hidden apartment cells');
 const hub=lobby.lobbyFloorRects.find(r=>r.w>3000),entry=lobby.lobbyFloorRects.find(r=>r.w===400);
 assert(hub&&hub.h>=600&&entry,'A full-width lobby hub must open onto the street entrance spine');
 assert.equal(hub.y+hub.h,entry.y);
 assert(blocked(lobby,{x:1536,y:400}),'Reception closes the unused northern stem');
 assert(!blocked(lobby,{x:1536,y:STORE_TRAFFIC.crossY}),'The two cross-hall traffic lanes must connect through the hub');
 for(const open of lobby.lobbyFloorRects)for(const display of SHOWROOMS)assert(!overlaps(open,display),'The shared lobby must not overlap its allocated apartment floor areas');
 for(const door of lobby.doors){assert(['decor-16-01','decor-16-02','decor-16-03'].includes(door.asset));assert.equal(door.h,190);}
 assert(lobby.items.every(i=>!i.showroomId),'Apartment furniture must not be visible or interactive in the common lobby');
 for(const display of SHOWROOMS){
  const portal=lobby.rooms.find(r=>r.showroomId===display.id),zone=lobby.zones.find(z=>z.action==='showroom'&&z.showroomId===display.id);
  assert(portal?.portalRoom&&zone);
  assert(blocked(lobby,{x:display.x+display.w/2,y:display.y+display.h/2},0),'Closed apartment scenes must be opaque, solid cells');
  assert(display.lobbyApproach.x>=zone.x&&display.lobbyApproach.x<=zone.x+zone.w&&display.lobbyApproach.y>=zone.y&&display.lobbyApproach.y<=zone.y+zone.h);
  assert.deepEqual(display.lobbyReturn,display.lobbyApproach);
 }
 assert(lobby.zones.some(z=>z.action==='exit'),'The original street door must remain usable');
});

test('each private apartment reveals its own complete themed interior at the allocated exterior scale',()=>{
 const ids=new Set(),furnitureInstances=new Set();
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id});
  assert.equal(model.kind,'showroom');assert.equal(model.showroomId,display.id);assert.equal(model.id,'showroom-'+display.id);ids.add(model.id);
  assert.equal(model.width,display.w);assert.equal(model.height,display.h);
  assert.deepEqual({width:model.width,height:model.height},{width:624,height:704});
  assert.deepEqual(model.spawn,display.apartment.spawn);
  assert.equal(new Set(model.rooms.filter(r=>r.functionalRole!=='apartment').map(r=>r.functionalRole)).size,5);
  for(const role of ['kitchen','dining','living','bedroom','bathroom'])assert(model.rooms.some(r=>r.functionalRole===role),display.name+' needs a real '+role);
  for(const role of ['bed','sofa','kitchen','stove','dining-table','dining-chair','coffee-table','shower','toilet','vanity'])assert(model.items.some(i=>i.furnitureRole===role),display.name+' lacks '+role);
  for(const item of model.items){assert(!furnitureInstances.has(item));furnitureInstances.add(item);assert.equal(item.showroomId,display.id);}
  const finishes=model.rooms.find(r=>r.functionalRole==='apartment');assert.deepEqual(finishes.floorFinish,display.floor);assert.deepEqual(finishes.wallpaper,display.wallpaper);
  assert(model.zones.some(z=>z.action==='shop'&&z.showroomId===display.id));
  assert(model.zones.some(z=>z.action==='showroom-lobby'&&z.showroomId===display.id));
  assert(!model.zones.some(z=>z.action==='showroom'),'A private apartment must return to the main lobby before entering another');
 }
 assert.equal(ids.size,8);
 for(const role of ['bed','sofa'])assert.equal(new Set(SHOWROOMS.map(d=>getInterior({kind:'showroom',showroomId:d.id}).items.find(i=>i.furnitureRole===role).asset)).size,8,'Every apartment needs its own '+role+' design');
 for(const finish of ['floor','wallpaper'])assert.equal(new Set(SHOWROOMS.map(d=>d[finish].pattern)).size,8);
 assert.equal(getInterior({kind:'showroom',showroomId:'missing'}).kind,'shop','An invalid door cannot manufacture an unconfigured room');
});

test('all eight lobby doors retain clear incoming and outgoing routes to the original street entrance',()=>{
 const before=JSON.stringify(SHOWROOMS);
 for(const display of SHOWROOMS){
  const incoming=[lobby.spawn,{x:STORE_TRAFFIC.incomingX,y:lobby.spawn.y},{x:STORE_TRAFFIC.incomingX,y:STORE_TRAFFIC.ingressY},{x:display.entry.x,y:STORE_TRAFFIC.ingressY},display.entry,display.lobbyApproach];
  checkRoute(lobby,incoming,display.name+' lobby approach');
  const outgoing=[display.lobbyReturn,{x:display.entry.x,y:STORE_TRAFFIC.egressY},{x:STORE_TRAFFIC.outgoingX,y:STORE_TRAFFIC.egressY},{x:STORE_TRAFFIC.outgoingX,y:lobby.spawn.y},lobby.spawn];
  checkRoute(lobby,outgoing,display.name+' lobby return');
 }
 assert.equal(JSON.stringify(SHOWROOMS),before);
});

test('a real sixteen-pixel foot can reach every apartment function and pass both private doorways',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),plan=display.apartment,before=JSON.stringify(model);
  for(const [role,route]of Object.entries(plan.routes)){
   checkRoute(model,route,display.name+' '+role);
   const area=model.rooms.find(r=>r.functionalRole===role),end=route.at(-1);
   assert(end.x>=area.x&&end.x<=area.x+area.w&&end.y>=area.y&&end.y<=area.y+area.h,'The route must actually enter '+role);
  }
  checkRoute(model,plan.visitRoute,display.name+' browsing');checkRoute(model,plan.exitRoute,display.name+' departure');
  assert(!blocked(model,{x:386,y:351}),'Bedroom opening must remain clear');
  assert(blocked(model,{x:386,y:280},0),'The sleeping room needs a real privacy wall');
  assert(!blocked(model,{x:386,y:520}),'Bathroom opening must remain clear');
  assert(blocked(model,{x:386,y:440},0)&&blocked(model,{x:386,y:620},0),'Bathroom must have actual walls above and below its entry');
  assert.equal(JSON.stringify(model),before);
 }
});

test('every displayed purchase matches the actual room collection while fixed bath fixtures remain separate',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id});
  const physical=[...new Set(model.items.map(i=>i.productId).filter(Boolean))];
  assert.deepEqual(display.productIds.slice().sort(),physical.slice().sort(),'Collection must match the furniture actually on display');
  for(const item of model.items){
   if(item.productId)assert.equal(products.get(item.productId)?.asset,item.asset,'A purchase must unlock the exact displayed artwork');
   else assert(['toilet','shower'].includes(item.furnitureRole),'Only built-in bath fixtures bypass the furniture wallet');
  }
  for(const role of ['bed','sofa']){
   const item=model.items.find(i=>i.furnitureRole===role);assert.equal(item.productId,'furniture-'+display.id+'-'+role);assert(products.has(item.productId));
  }
 }
 assert.equal(stock.length,52,'All original products remain alongside sixteen unique signature pieces');
});

test('furniture fits inside each apartment and its floor footprints stay distinct',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),footprints=[];
  for(const item of model.items){
   assert(item.x-item.w/2>=28&&item.x+item.w/2<=596,item.asset+' must fit inside the side walls');
   assert(item.y-item.h>=106&&item.y<=676,item.asset+' must fit inside the north and south edges');
   assert(Number.isFinite(item.w+item.h)&&item.w>0&&item.h>0);
   const depth=item.furnitureRole==='bed'?item.h*.72:Math.min(item.h*.48,item.w*.5),feet={x:item.x-item.w*.43,y:item.y-depth,w:item.w*.86,h:depth};
   assert(!footprints.some(other=>overlaps(feet,other)),display.name+' has overlapping furniture feet');footprints.push(feet);
  }
 }
});
