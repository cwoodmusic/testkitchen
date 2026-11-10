import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SHOWROOMS,STORE_TRAFFIC} from './showroom-layout.mjs';
import {getInterior,STORE_FOOTPRINT,configureUrbanInteriors} from './urban-interiors.mjs';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs';

const require=createRequire(import.meta.url),stock=require('../../furniture-catalog.js'),products=new Map(stock.map(p=>[p.id,p]));
const native=new Map(APARTMENT_DECOR.map(a=>[a.id,a]));configureUrbanInteriors(native);
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

function nativeFeet(item){
 if(!item.solid)return [];
 const a=native.get(item.asset);
 if(a)return a.boxes.map(b=>({x:item.x-item.w/2+b.x*item.w/a.w,y:item.y-item.h+b.y*item.h/a.h,w:b.w*item.w/a.w,h:b.h*item.h/a.h}));
 const depth=item.furnitureRole==='bed'?item.h*.72:Math.min(item.h*.48,item.w*.5);
 return [{x:item.x-item.w*.43,y:item.y-depth,w:item.w*.86,h:depth}];
}
function navigation(model){
 const queue=[model.spawn],seen=new Set([model.spawn.x+','+model.spawn.y]);
 assert(!blocked(model,model.spawn),'The entry must not be inside furniture');
 for(let next=0;next<queue.length;next++)for(const [dx,dy]of [[8,0],[-8,0],[0,8],[0,-8]]){
  const x=queue[next].x+dx,y=queue[next].y+dy,key=x+','+y;
  if(x<0||y<0||x>model.width||y>model.height||seen.has(key)||blocked(model,{x,y}))continue;
  seen.add(key);queue.push({x,y});
 }
 return {points:queue,reaches(p){return !blocked(model,p)&&queue.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<=6);}};
}

test('four different floor plates and their mirrors have real private doors and native-foot routes to every apartment function',()=>{
 const layouts=new Set();
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),plan=display.apartment,before=JSON.stringify(model),nav=navigation(model);
  layouts.add(plan.layoutId);assert.equal(model.apartmentLayout,plan.layoutId);
  for(const a of plan.areas){assert(nav.reaches(a.point),display.name+' needs a padded route to '+a.functionalRole);assert(a.point.x>=a.x&&a.point.x<=a.x+a.w&&a.point.y>=a.y&&a.point.y<=a.y+a.h,'The destination must actually enter '+a.functionalRole);}
  assert(nav.reaches(plan.browse),display.name+' browsing must be reachable');
  assert.deepEqual(plan.visitRoute[0],plan.spawn);assert.deepEqual(plan.visitRoute.at(-1),plan.browse);
  assert.deepEqual(plan.exitRoute,plan.visitRoute.slice().reverse());
  checkRoute(model,plan.visitRoute,display.name+' resident browsing route');checkRoute(model,plan.exitRoute,display.name+' resident departure route');
  const exit=model.zones.find(z=>z.action==='showroom-lobby');assert(nav.reaches({x:exit.x+exit.w/2,y:exit.y+exit.h/2}),display.name+' must retain its lobby exit');
  assert.equal(model.privacyDoors.length,2);
  for(const d of model.privacyDoors){
   assert(d.length>=104,'A real door must admit the native avatar');assert.equal(d.open,true);assert(model.rooms.some(r=>r.id===d.roomId));
   const mid=d.axis==='vertical'?{x:d.x,y:d.y+d.length/2}:{x:d.x+d.length/2,y:d.y};
   assert(nav.reaches(mid),display.name+' door '+d.id+' is blocked');
   for(const normal of [-32,32])assert(nav.reaches(d.axis==='vertical'?{x:mid.x+normal,y:mid.y}:{x:mid.x,y:mid.y+normal}),display.name+' must pass both sides of '+d.id);
   const jamb=d.axis==='vertical'?{x:d.x,y:d.y+d.length+8}:{x:d.x+d.length+8,y:d.y};assert(blocked(model,jamb,0),'A privacy opening needs an actual wall beside it');
  }
  assert.equal(JSON.stringify(model),before);
 }
 assert.equal(layouts.size,8,'Every door should reveal its own arrangement');
 assert.equal(new Set([...layouts].map(id=>id.replace(/-(original|mirrored)$/,''))).size,4);
});

test('each kitchen is practical and each unit has exactly one complete private bathroom plus curated playful details',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),nav=navigation(model);
  for(const role of ['shower','toilet','vanity','bathroom-mirror'])assert.equal(model.items.filter(i=>i.furnitureRole===role).length,1,display.name+' must have exactly one '+role);
  const vanity=model.items.find(i=>i.furnitureRole==='vanity'),mirror=model.items.find(i=>i.furnitureRole==='bathroom-mirror'),bathroom=model.rooms.find(r=>r.functionalRole==='bathroom');
  assert.equal(mirror.x,vanity.x,'The mirror belongs above the actual vanity');assert.equal(mirror.y,bathroom.y-10);assert.equal(mirror.wallMounted,true);assert.equal(mirror.solid,false);
  for(const role of ['sink','counter','stove','fridge','pantry'])assert.equal(model.items.filter(i=>i.fixtureRole===role).length,1,display.name+' must have a kitchen '+role);
  for(const role of ['bed','sofa','coffee-table','dining-table','dining-chair','nightstand','playful-accent','music-rug','wall-art'])assert(model.items.some(i=>i.furnitureRole===role),display.name+' lacks '+role);
  for(const item of model.items.filter(i=>['sink','counter','stove','fridge','pantry','shower','toilet','vanity'].includes(i.fixtureRole))){
   const feet=nativeFeet(item)[0];
   assert(nav.points.some(p=>Math.hypot(p.x-(feet.x+feet.w/2),p.y-(feet.y+feet.h))<=75),display.name+' cannot approach '+item.fixtureRole);
  }
 }
 const mcm=SHOWROOMS.find(d=>d.id==='midcentury-studio');assert.equal(mcm.floor.pattern,'teak-planks');assert.equal(mcm.wallpaper.pattern,'midcentury-atomic');assert(mcm.items.some(i=>i.asset==='apartment-starburst-clock'));assert(mcm.items.some(i=>i.asset==='apartment-kidney-coffee-table'));
});

test('displayed purchases match the actual collection and all legacy ownership IDs remain in global stock',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),physical=[...new Set(model.items.map(i=>i.productId).filter(Boolean))];
  assert.deepEqual(display.productIds.slice().sort(),physical.slice().sort());
  for(const item of model.items)if(item.productId)assert.equal(products.get(item.productId)?.asset,item.asset,'A purchase must unlock the exact displayed artwork');
  for(const role of ['bed','sofa'])assert.equal(model.items.find(i=>i.furnitureRole===role).productId,'furniture-'+display.id+'-'+role);
  assert(model.items.filter(i=>['playful-accent','music-rug','wall-art'].includes(i.furnitureRole)).every(i=>products.has(i.productId)),'Playful collection details must be buyable');
 }
 assert.equal(stock.filter(p=>!p.asset.startsWith('apartment-')).length,52,'All legacy products remain available');assert.equal(stock.length,52+APARTMENT_DECOR.length);
});

test('native furniture footprints remain distinct and all art fits the apartment or its authored wall',()=>{
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'showroom',showroomId:display.id}),footprints=[];
  for(const item of model.items){
   assert(item.x-item.w/2>=28&&item.x+item.w/2<=596,item.asset+' must fit inside the side walls');
   if(item.wallMounted)assert([{x:0,y:0,w:624,h:106},...model.walls.filter(w=>w.bathroomNorthFace)].some(w=>item.x-item.w/2>=w.x&&item.x+item.w/2<=w.x+w.w&&item.y-item.h>=w.y&&item.y<=w.y+w.h),'Art should hang on an actual north wall face');
   else assert(item.y-item.h>=106&&item.y<=676,item.asset+' must fit inside the room');
   for(const feet of nativeFeet(item)){assert(!footprints.some(other=>overlaps(feet,other.box)),display.name+' has overlapping feet at '+item.asset+' / '+footprints.find(other=>overlaps(feet,other.box))?.asset);footprints.push({box:feet,asset:item.asset});}
  }
 }
});
