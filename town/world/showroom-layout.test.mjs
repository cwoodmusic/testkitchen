import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE,STORE_FLOOR_COUNT,SHOWROOM_UNIT_FOOTPRINT,UPPER_SHOWROOM_UNIT_FOOTPRINT,getStoreFloorShowrooms} from './showroom-layout.mjs';
import {getInterior,STORE_FOOTPRINT,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collections.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {interiorActorScale} from './interior-scale.mjs';
import {PRIVATE_DOOR_CLEAR_WIDTH,PUBLIC_DOOR_CLEAR_WIDTH} from './interior-doorways.mjs';
import {getDoorVisualGeometry} from './interior-portal-art.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';
const require=createRequire(import.meta.url),stock=require('../../furniture-catalog.js'),products=new Map(stock.map(p=>[p.id,p]));
const approvedMidcentury=JSON.parse(readFileSync(new URL('../../tests/fixtures/midcentury-user-layout.json',import.meta.url),'utf8')).rooms['showroom-midcentury-studio'];
const approvedVictorian=JSON.parse(readFileSync(new URL('../../tests/fixtures/victorian-user-layout.json',import.meta.url),'utf8')).rooms['showroom-victorian-parlor'];
const native=new Map([...APARTMENT_DECOR,...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));configureUrbanInteriors(native);
const lobby=getInterior({kind:'shop'}),overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const blocked=(m,p,pad=16*interiorActorScale(m))=>m.solids.some(r=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad);
function route(model,points,label,{cardinal=true}={}){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(cardinal)assert(a.x===b.x||a.y===b.y,'A venue route must use cardinal legs');const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let n=0;n<=steps;n++)assert(!blocked(model,{x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps}),label+' must remain clear');}}
function feet(item){return item.solid?furnitureFacingBoxes(native.get(item.asset),item):[];}
function navigation(model){
 const queue=[model.spawn],seen=new Set([model.spawn.x+','+model.spawn.y]);assert(!blocked(model,model.spawn));
 for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[8,0],[-8,0],[0,8],[0,-8]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(x<0||y<0||x>model.width||y>model.height||seen.has(k)||blocked(model,{x,y}))continue;seen.add(k);queue.push({x,y});}
 return {points:queue,reaches:p=>!blocked(model,p)&&queue.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<=6)};
}
function furnitureApproach(nav,item){
 let nearest=null,distance=Infinity;for(const p of nav.points)for(const b of feet(item)){const d=Math.hypot(Math.max(b.x-p.x,0,p.x-b.x-b.w),Math.max(b.y-p.y,0,p.y-b.y-b.h));if(d<distance){nearest=p;distance=d;}}
 return {point:nearest,distance};
}

test('eight original wide units and four larger upper homes share the unchanged two-storey footprint',()=>{
 assert.equal(SHOWROOMS.length,12);assert.equal(STORE_FLOOR_COUNT,2);assert.equal(getStoreFloorShowrooms(1).length,8);assert.equal(getStoreFloorShowrooms(2).length,4);assert.deepEqual({width:lobby.width,height:lobby.height},STORE_FOOTPRINT);assert.deepEqual(STORE_FOOTPRINT,{width:3072,height:2048});
 assert.deepEqual(SHOWROOM_UNIT_FOOTPRINT,{width:1184,height:448});assert.deepEqual(lobby.spawn,STORE_TRAFFIC.spawn);assert.deepEqual(lobby.spawn,{x:1536,y:1840});
 assert.equal(lobby.rooms.length,8);assert.equal(lobby.doors.length,8);assert.equal(lobby.zones.filter(z=>z.action==='showroom').length,8);assert.equal(lobby.windows.length,0);
 assert.equal(lobby.southFacingShowrooms,true);assert.equal(lobby.sideFacingShowrooms,undefined);assert.equal(lobby.hallways.length,4);assert(lobby.lobbyFloorRects.some(r=>r.x===1216&&r.w===640&&r.h===1888));
 for(const d of SHOWROOMS){const model=getInterior({kind:'shop',floor:d.storeFloor});assert.equal(d.w,1184);assert.equal(d.h,d.storeFloor===1?320:736);assert(d.w>d.h);assert(d.x>=0&&d.y>=0&&d.x+d.w<=3072&&d.y+d.h<=2048);assert(!SHOWROOMS.some(other=>other!==d&&other.storeFloor===d.storeFloor&&overlaps(d,other)));
  for(const hall of model.lobbyFloorRects)assert(!overlaps(d,hall),'Shared circulation cannot borrow private floor area');
  const door=model.doors.find(door=>door.showroomId===d.id),zone=model.zones.find(z=>z.showroomId===d.id),room=model.rooms.find(r=>r.showroomId===d.id);
  assert(room.portalRoom);assert.deepEqual(door.threshold,d.threshold);assert.deepEqual(door.enterNormal,d.enterNormal);assert.equal(door.facing,'down');assert.deepEqual(d.enterNormal,{x:0,y:-1});assert.deepEqual(d.threshold,{x:d.x+d.w/2,y:d.y+d.h});assert.equal(getDoorVisualGeometry(door).kind,'front');assert.equal(zone.doorId,door.id);assert.equal(door.triggerHalfWidth,PUBLIC_DOOR_CLEAR_WIDTH/2);
  assert(blocked(model,{x:d.x+d.w/2,y:d.y+d.h/2},0));assert(!blocked(model,d.lobbyApproach));assert.deepEqual(d.lobbyReturn,d.lobbyApproach);
 }
 const upper=getInterior({kind:'shop',floor:2});assert.notEqual(upper,lobby);assert.equal(upper.id,'furniture-store-floor-2');assert.equal(upper.rooms.length,4);assert.deepEqual(upper.spawn,STORE_VERTICAL_CORE.arrival);assert.deepEqual({width:upper.width,height:upper.height},STORE_FOOTPRINT);
 for(const model of [lobby,upper])for(const action of ['store-elevator','store-floor']){const z=model.zones.find(z=>z.action===action);assert(z);assert(!blocked(model,{x:z.x+z.w/2,y:z.y+z.h/2}));}
 assert(!upper.zones.some(z=>z.action==='exit'),'The upstairs gallery exits through a lift or stair, not through an outdoor wall');
});

test('all eight showroom doors retain real incoming and outgoing NPC journeys to the original street entrance',()=>{
 const before=JSON.stringify(SHOWROOMS);
 for(const d of getStoreFloorShowrooms(1)){route(lobby,[lobby.spawn,{x:d.entry.x,y:lobby.spawn.y},...d.visitRoute],d.name+' approach');route(lobby,[...d.exitRoute,{x:d.entry.x,y:lobby.spawn.y},lobby.spawn],d.name+' departure');}
 for(const d of getStoreFloorShowrooms(2)){const m=getInterior({kind:'shop',floor:2}),at=STORE_VERTICAL_CORE.arrival;route(m,[at,{x:d.entry.x,y:at.y},...d.visitRoute],d.name+' upper approach');route(m,[...d.exitRoute,{x:d.entry.x,y:at.y},at],d.name+' upper departure');}
 assert.equal(JSON.stringify(SHOWROOMS),before);
});

test('wide units have private bedroom and bathroom doors and physical native-foot routes to every real function',()=>{
 const layouts=new Set();
 for(const d of SHOWROOMS){const m=getInterior({kind:'showroom',showroomId:d.id}),p=d.apartment,nav=navigation(m),promoted=d.id==='victorian-parlor';layouts.add(p.layoutId);
  const authoredFootprint=d.storeFloor===1?SHOWROOM_UNIT_FOOTPRINT:UPPER_SHOWROOM_UNIT_FOOTPRINT;
  assert.deepEqual({width:m.width,height:m.height},{width:authoredFootprint.width,height:authoredFootprint.height+64});assert.equal(m.roomLayoutSignatureFrame.height,authoredFootprint.height);assert.equal(m.floor,d.storeFloor);assert.equal(m.apartmentLayout,p.layoutId);assert.equal(m.collectionOwner,'showroom-'+d.id);assert.deepEqual(m.spawn,{...p.spawn,y:p.spawn.y+64});
  for(const role of ['bedroom','bathroom','kitchen','living','dining']){const a=p.areas.find(a=>a.functionalRole===role);assert(a);
   if(promoted){const item=m.items.find(i=>role==='dining'?i.designRole==='family-dining-table':i.slot===({bedroom:'bed',bathroom:'vanity',kitchen:'sink',living:'sofa'}[role])),approach=furnitureApproach(nav,item);assert(approach.point&&approach.distance<=32,d.name+' cannot approach its approved '+role+' furniture');}
   else{assert(nav.reaches(a.point),d.name+' cannot reach '+role);assert(a.point.x>=a.x&&a.point.x<=a.x+a.w&&a.point.y>=a.y&&a.point.y<=a.y+a.h);}
  }
  assert.deepEqual(p.visitRoute[0],p.spawn);assert.deepEqual(p.visitRoute.at(-1),p.browse);assert.deepEqual(p.exitRoute,p.visitRoute.slice().reverse());
  const resolved=getShowroomNavigation(m);assert(resolved);assert.deepEqual(resolved.visitRoute[0],m.spawn);assert(Math.hypot(resolved.visitRoute.at(-1).x-p.browse.x,resolved.visitRoute.at(-1).y-p.browse.y)<=14);assert(nav.reaches(resolved.visitRoute.at(-1)));route(m,resolved.visitRoute,d.name+' active browsing',{cardinal:false});route(m,resolved.exitRoute,d.name+' active returning',{cardinal:false});
  if(!promoted)assert(nav.reaches(p.browse));
  assert.equal(m.privacyDoors.length,2);for(const door of m.privacyDoors){assert.equal(door.length,PRIVATE_DOOR_CLEAR_WIDTH);assert(m.rooms.some(r=>r.id===door.roomId));const vertical=door.axis==='vertical',mid={x:door.x+(vertical?0:door.length/2),y:door.y+(vertical?door.length/2:0)};assert(nav.reaches(mid),d.name+' door');for(const normal of [-32,32])assert(nav.reaches({x:mid.x+(vertical?normal:0),y:mid.y+(vertical?0:normal)}),d.name+' must pass both sides of '+door.id);assert(blocked(m,{x:door.x+(vertical?0:door.length+8),y:door.y+(vertical?door.length+8:0)},0));}
  assert.deepEqual(m.portalExit.threshold,{...p.portalExit.threshold,y:p.portalExit.threshold.y+64});assert.deepEqual(m.portalExit.door.threshold,m.portalExit.threshold);assert.deepEqual(m.portalExit.enterNormal,p.portalExit.enterNormal);assert.equal(m.spawn.x,m.portalExit.threshold.x);assert.equal(m.portalExit.threshold.y-m.spawn.y,56);assert.deepEqual(m.portalExit.enterNormal,{x:0,y:-1});assert.equal(getDoorVisualGeometry(m.portalExit.door).kind,'front');route(m,[m.spawn,{x:m.spawn.x,y:m.portalExit.threshold.y-20}],d.name+' south foyer');
 }
 assert.equal(layouts.size,12);assert.equal(new Set([...layouts].map(id=>id.replace(/-(original|mirrored)$/,''))).size,6);
});

test('each owner retains its unique original collection while expanded seating can repeat matching pieces',()=>{
 const all=new Set();
 for(const d of SHOWROOMS){const m=getInterior({kind:'showroom',showroomId:d.id}),nav=navigation(m),owner='showroom-'+d.id;
  const original=m.items.filter(i=>!i.roomExpansion),promoted=d.id==='victorian-parlor';assert.equal(original.length,promoted?24:d.storeFloor===1?25:d.row?29:28);assert.equal(new Set(original.map(i=>i.asset)).size,original.length);
  if(promoted){assert.equal(m.items.filter(i=>i.roomExpansion).length,10);assert.equal(m.roomLayoutBaseItems.length,38);assert.deepEqual(m.items.map(i=>i.id),approvedVictorian.placements.map(i=>i.id));assert.deepEqual(m.roomLayoutBaseItems.filter(i=>!m.items.some(active=>active.id===i.id)).map(i=>i.id).sort(),approvedVictorian.removed.slice().sort());}
  for(const item of m.items){assert.equal(item.collectionOwner,owner);assert(item.visualSignature.includes(owner));}
  for(const asset of new Set(m.items.map(i=>i.asset)))if(m.items.filter(i=>i.asset===asset).length>1)assert(['sofa','dining-chair','reading-chair','plant'].includes(native.get(asset)?.slot),d.name+' repeats an unintended fixture');
  for(const asset of new Set(m.items.map(i=>i.asset))){assert(!all.has(asset),'An apartment must not reuse another collection’s artwork');all.add(asset);}
  for(const role of ['sink','counter','stove','fridge','pantry','vanity','toilet','bath-fixture','bathroom-mirror'])assert.equal(m.items.filter(i=>i.fixtureRole===role).length,1,d.name+' needs one '+role);
  for(const role of ['bed','sofa','coffee-table','dining-table','dining-chair','nightstand','wardrobe','playful-accent','music-rug','wall-art','lava-lamp','arcade'])assert(m.items.some(i=>i.furnitureRole===role||promoted&&i.slot===role),d.name+' lacks '+role);
  const vanity=m.items.find(i=>i.slot==='vanity'),mirror=m.items.find(i=>i.slot==='mirror');
  if(d.id==='midcentury-studio')for(const item of [vanity,mirror]){const pose=approvedMidcentury.placements.find(p=>p.id===item.id);assert.equal(item.x,pose.x);assert.equal(item.y,pose.y);}
  else{assert(Math.abs(mirror.x-vanity.x)<1e-8);assert(Math.abs(mirror.y-(vanity.y-vanity.h-6))<1e-8,'The mirror sits directly above its actual basin');}
  assert(mirror.wallMounted&&!mirror.solid);
  for(const item of m.items.filter(i=>i.fixtureRole&&i.solid)){const b=feet(item)[0];assert(nav.points.some(p=>Math.hypot(p.x-b.x-b.w/2,p.y-b.y-b.h)<=75),d.name+' cannot approach '+item.fixtureRole);}
  for(const slot of ['toy','table-lamp','lava-lamp']){const item=m.items.find(i=>i.slot===slot),support=m.items.find(i=>i.id===item.supportedBy||i.asset===item.supportedBy);assert(support&&!item.solid);assert.equal(item.depth,furnitureFacingDepth(native.get(support.asset),support)+.25);}
 }
 const mcm=SHOWROOMS.find(d=>d.id==='midcentury-studio');assert.equal(mcm.floor.pattern,'teak-planks');assert.equal(mcm.wallpaper.pattern,'midcentury-atomic');
});

test('collection stock remains buyable when an approved default removes display pieces, preserving all ownership IDs',()=>{
 for(const d of SHOWROOMS){const m=getInterior({kind:'showroom',showroomId:d.id}),stockItems=m.roomLayoutBaseItems||m.items;assert.deepEqual(d.productIds.slice().sort(),stockItems.filter(i=>!i.roomExpansion).map(i=>i.productId).sort());for(const item of stockItems)assert.equal(products.get(item.productId)?.asset,item.asset,'A purchase must unlock the exact display asset');}
 assert.equal(stock.filter(p=>!p.asset.startsWith('apartment-')&&!p.asset.startsWith('collection-')&&!p.asset.startsWith('plush-')&&!p.asset.startsWith('family-')).length,52);
 assert.equal(stock.filter(p=>p.asset.startsWith('plush-')).length,12);
 for(const d of getStoreFloorShowrooms(1))for(const role of ['bed','sofa'])assert(products.has('furniture-'+d.id+'-'+role),'Existing owned signatures must keep their IDs');
 assert.equal(stock.length,100+APARTMENT_COLLECTION_ASSETS.filter(a=>a.owner.startsWith('showroom-')).length+19+12+FAMILY_FURNITURE_ASSETS.length);
 assert.equal(stock.length,639);
});

test('upper homes protect broad circulation and group conversation around a real listening focus',()=>{
 for(const d of getStoreFloorShowrooms(2)){
  const m=getInterior({kind:'showroom',showroomId:d.id}),design=m.interiorDesign,focus=m.items.find(i=>i.slot==='record-console');
  const lava=m.items.find(i=>i.slot==='lava-lamp'),lampSupport=m.items.find(i=>i.asset===lava.supportedBy);
  assert.equal(lampSupport.slot,d.row?'desk':'dining-table','The lava lamp uses a writing/work surface, leaving the record platter free');assert.equal(lampSupport.rotation||0,0);assert(!lava.solid);assert.equal(lava.depth,furnitureFacingDepth(native.get(lampSupport.asset),lampSupport)+.25);
  assert(design.groups.some(g=>g.role==='conversation'&&g.slots.includes('reading-chair')&&g.slots.includes('record-console')));
  const focusBox=feet(focus)[0];assert(design.focalPoints.some(p=>p.x===focusBox.x+focusBox.w/2&&p.y===focusBox.y+focusBox.h/2));
  assert.equal(focus.rotation,d.column?90:270,'The console stands beside the seating group, rather than hiding the coffee table from the foreground');
  const coffee=m.items.find(i=>i.slot==='coffee-table'),sideViewWidth=68*focus.w/native.get(focus.asset).w;
  assert(Math.abs(focusBox.x+focusBox.w/2-coffee.x)>sideViewWidth/2+coffee.w/2,'Even the entire narrow console image stays outside the coffee-table image');
  for(const item of m.items.filter(i=>i.wallMounted&&i.y<=106))for(const window of d.apartment.windows){
   const frame={x:window.x-window.w/2-18,y:18,w:window.w+36,h:92},art={x:item.x-item.w/2,y:item.y-item.h,w:item.w,h:item.h};
   assert(!overlaps(frame,art),d.id+' must hang '+item.slot+' on clear wall rather than over a window');
  }
  assert.equal(m.items.find(i=>i.slot==='reading-chair').rotation,d.column?270:90,'Conversation seating faces into the group using a cardinal direction');
  for(const corridor of design.circulation){
   assert(Math.min(corridor.w,corridor.h)>=120);
   for(const item of m.items)for(const box of feet(item))assert(!overlaps(corridor,box),d.id+' must keep '+item.slot+' out of its circulation spine');
   for(const wall of d.apartment.walls)assert(!overlaps(corridor,wall));
  }
 }
});

test('native art keeps its aspect ratio and all physical bases stay distinct inside the wide floor plate',()=>{
 for(const d of SHOWROOMS){const m=getInterior({kind:'showroom',showroomId:d.id}),footprints=[],promoted=d.id==='victorian-parlor',sourceById=promoted?new Map(m.roomLayoutBaseItems.map(item=>[item.id,item])):null;
  for(const item of m.items){const a=native.get(item.asset);assert(Math.abs(item.w/item.h-a.w/a.h)<1e-9,'A native sprite must not be squashed to fit');
   if(promoted){const source=sourceById.get(item.id);assert(source);assert.equal(item.asset,source.asset);assert.equal(item.w,source.w);assert.equal(item.h,source.h,'Approved poses keep each original item size despite their reordered display list');}
   else assert(item.x-item.w/2>=28&&item.x+item.w/2<=m.width-28,item.asset+' width');
   if(item.wallMounted)assert(d.apartment.wallpaperAreas?.some(r=>item.x-item.w/2>=r.x&&item.x+item.w/2<=r.x+r.w&&item.y-item.h>=r.y&&item.y<=r.y+r.h)||item.y-item.h>=0&&item.y<=106);else{
    if(!promoted)assert(item.y-item.h>=0&&item.y<=m.height-28,item.asset+' artwork fits inside the cutaway');
    for(const b of feet(item))assert(b.x>=28&&b.y>=106&&b.x+b.w<=m.width-28&&b.y+b.h<=m.height-28,item.asset+' physical base stays on the floor while its upright artwork can overlap the back wall');
   }
   for(const b of feet(item)){assert(!footprints.some(other=>overlaps(b,other.box)),d.name+' overlaps '+item.slot+' and '+footprints.find(other=>overlaps(b,other.box))?.slot);footprints.push({box:b,slot:item.slot});}
  }
 }
});


test('store floors, apartment homes and shared halls keep labels on the back wall instead of the floor',()=>{
 const scenes=[{kind:'shop',floor:1},{kind:'shop',floor:2},{kind:'lobby',floor:1},...Array.from({length:14},(_,i)=>({kind:'hall',floor:i+2})),...residents.map(r=>({kind:'apartment',resident:r.id,floor:r.floor})),{kind:'apartment',resident:'player',floor:15},...SHOWROOMS.map(d=>({kind:'showroom',showroomId:d.id,floor:d.storeFloor}))];
 for(const request of scenes){const model=getInterior(request),wallDepth=model.towerArchitecture?.northWallDepth||106;assert(model.signs.every(label=>label.y<=wallDepth),model.id+' must not paint words on walkable floor');}
 for(const floor of [1,2]){const model=getInterior({kind:'shop',floor});assert.equal(model.showroomSigns.length,floor===1?8:4);assert(model.doors.every(door=>door.number&&getDoorVisualGeometry(door).kind==='front'),'Framed door addresses stay available');}
});
