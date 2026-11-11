import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {FLOOR_COUNT,TOWER_FOOTPRINT,STORE_FOOTPRINT,residents,getInterior,residentInteractionZones,apartmentDecorBounds,configureUrbanInteriors} from '../town/world/urban-interiors.mjs';
import {residentHomePose,interiorJourneyPose,journeyDuration,residentInScene} from '../town/world/resident-journey.mjs';
import {decorDefinitions} from '../town/world/decor-definitions.mjs';
import {SHOWROOMS} from '../town/world/showroom-layout.mjs';
import {SHOWROOM_FURNITURE} from '../town/world/showroom-furniture-definitions.mjs';
import {APARTMENT_DECOR} from '../town/world/apartment-decor-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from '../town/world/apartment-collection-definitions.mjs';
import {WHIMSICAL_PLUSH_DEFINITIONS} from '../town/world/whimsical-plush-definitions.mjs';

const require=createRequire(import.meta.url),stock=require('../furniture-catalog.js');
const read=path=>readFileSync(new URL(path,import.meta.url));
// Read native asset dimensions without loading a browser, images, or canvases.
const png=read('../town/assets/furniture.png'),atlas=JSON.parse(read('../town/assets/decor/atlas.json'));
const catalog=new Map(Array.from({length:9},(_,i)=>[`furniture-${i}-180`,{w:180,h:Math.ceil(180*png.readUInt32BE(20)/png.readUInt32BE(16)),boxes:[]}]));
for(const def of decorDefinitions){const cell=atlas.find(a=>a.family===def.family).cells[def.index],fit=Math.min(def.maxW/cell.w,def.maxH/cell.h);catalog.set(def.id,{w:Math.ceil(cell.w*fit),h:Math.ceil(cell.h*fit),boxes:[]});}
for(const def of SHOWROOM_FURNITURE)catalog.set(def.id,{w:def.w,h:def.h,boxes:def.boxes,furnitureRole:def.role});
for(const def of APARTMENT_DECOR)catalog.set(def.id,{w:def.w,h:def.h,boxes:def.boxes,layer:def.layer,wallMounted:def.wallMounted,purpose:def.purpose});
for(const def of APARTMENT_COLLECTION_ASSETS)catalog.set(def.id,def);
for(const def of WHIMSICAL_PLUSH_DEFINITIONS)catalog.set(def.id,def);
configureUrbanInteriors(catalog);
const floorScene=floor=>({kind:floor===1?'lobby':'hall',floor});
const scenes=[...Array.from({length:FLOOR_COUNT},(_,i)=>floorScene(i+1)),...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},{kind:'shop',floor:1},{kind:'shop',floor:2},...SHOWROOMS.map(room=>({kind:'showroom',floor:room.storeFloor,showroomId:room.id}))];
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('fifteen floors house every musician once and reserve the top apartment for the player',()=>{
 assert.equal(FLOOR_COUNT,15);assert.equal(residents.length,18);
 for(const key of ['id','number','theme'])assert.equal(new Set(residents.map(r=>r[key])).size,residents.length,key);
 const doorOwners=[];
 for(let floor=1;floor<=FLOOR_COUNT;floor++){
  const model=getInterior(floorScene(floor));assert.equal(model.floor,floor);assert.match(model.title,/Coda Residences/);
  const rooms=model.zones.filter(z=>z.action==='room');doorOwners.push(...rooms.map(z=>z.resident));
  if(floor===1)assert.equal(rooms.length,0);
  else if(floor===15)assert.deepEqual(rooms.map(z=>z.resident),['player']);
  else assert.deepEqual(rooms.map(z=>z.resident),residents.filter(r=>r.floor===floor).map(r=>r.id));
 }
 assert.deepEqual(doorOwners.filter(id=>id!=='player').sort(),residents.map(r=>r.id).sort());
 assert.equal(getInterior({kind:'apartment',resident:'player'}).floor,15);
});

test('common halls and private apartments fit the exterior floor plate at the same scale',()=>{
 const lobby=getInterior({kind:'lobby'});assert.deepEqual({width:lobby.width,height:lobby.height},TOWER_FOOTPRINT);
 let paired=0,single=0;
 for(let floor=2;floor<=FLOOR_COUNT;floor++){
  const hall=getInterior(floorScene(floor)),ids=hall.zones.filter(z=>z.action==='room').map(z=>z.resident),apartments=ids.map(resident=>getInterior({kind:'apartment',resident}));
  assert.equal(hall.width,TOWER_FOOTPRINT.width);assert.equal(hall.height,608);
  for(const a of apartments)assert.equal(a.height+hall.height,TOWER_FOOTPRINT.height);
  if(apartments.length===2){paired++;for(const a of apartments)assert.equal(a.width,1088);assert.equal(apartments.reduce((sum,a)=>sum+a.width,0)+128,TOWER_FOOTPRINT.width);}
  else {single++;assert.equal(apartments.length,1);assert.equal(apartments[0].width,TOWER_FOOTPRINT.width);}
 }
 assert.equal(paired,5);assert.equal(single,9);
 const shop=getInterior({kind:'shop'});assert.deepEqual({width:shop.width,height:shop.height},STORE_FOOTPRINT);
});

test('stairs and doors only lead to existing floors and existing apartments',()=>{
 for(let floor=1;floor<=FLOOR_COUNT;floor++){
  const model=getInterior(floorScene(floor));
  assert.ok(model.zones.some(z=>z.action==='elevator'));
  assert.equal(model.zones.some(z=>z.action==='stairs-up'),floor<FLOOR_COUNT);
  assert.equal(model.zones.some(z=>z.action==='stairs-down'),floor>1);
  for(const z of model.zones){
   if(z.action==='stairs-up')assert.ok(floor+1<=FLOOR_COUNT);
   if(z.action==='stairs-down')assert.ok(floor-1>=1);
   if(z.action==='room')assert.equal(getInterior({kind:'apartment',resident:z.resident}).floor,floor);
   if(z.floor!==undefined)assert.ok(z.floor>=1&&z.floor<=FLOOR_COUNT);
  }
 }
 assert.equal(getInterior({kind:'hall',floor:0}).kind,'lobby');
 assert.equal(getInterior({kind:'hall',floor:100}).floor,FLOOR_COUNT);
});

function reachableCells(model){
 const step=16,cols=Math.ceil(model.width/step),rows=Math.ceil(model.height/step),seen=new Uint8Array(cols*rows),queue=[];
 const solid=(x,y)=>x<40||y<100||x>model.width-40||y>model.height-40||model.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
 assert.equal(solid(model.spawn.x,model.spawn.y),false,`${model.id}: spawn`);
 const start=Math.floor(model.spawn.y/step)*cols+Math.floor(model.spawn.x/step);seen[start]=1;queue.push(start);
 for(let i=0;i<queue.length;i++){
  const key=queue[i],x=key%cols,y=Math.floor(key/cols);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,yy=y+dy,k=yy*cols+xx;
   if(xx<0||yy<0||xx>=cols||yy>=rows||seen[k]||solid(xx*step+8,yy*step+8))continue;
   seen[k]=1;queue.push(k);
  }
 }
 return queue.map(key=>({x:key%cols*step+8,y:Math.floor(key/cols)*step+8}));
}
test('a player with the real 16px collision padding can reach every interaction in all 48 scenes',()=>{
 assert.equal(scenes.length,48);
 for(const scene of scenes){
  const model=getInterior(scene),reachable=reachableCells(model);
  for(const zone of model.zones){
   assert.ok([zone.x,zone.y,zone.w,zone.h].every(Number.isFinite),`${model.id}: ${zone.id}`);
   assert.ok(zone.x>=0&&zone.y>=0&&zone.x+zone.w<=model.width&&zone.y+zone.h<=model.height,`${model.id}: zone outside floor`);
   assert.ok(reachable.some(p=>p.x>=zone.x&&p.x<=zone.x+zone.w&&p.y>=zone.y&&p.y<=zone.y+zone.h),`${model.id}: unreachable ${zone.id}`);
  }
  for(const item of model.items){assert.ok(catalog.has(item.asset),`${model.id}: unknown artwork ${item.asset}`);assert.ok(item.w>0&&item.h>0&&Number.isFinite(item.w+item.h),`${model.id}: furniture dimensions must be explicit`);}
 }
});

test('the player has clear furnishing areas that fit every scaled store item and preserve the entry',()=>{
 const scene={kind:'apartment',resident:'player'},model=getInterior(scene),bounds=apartmentDecorBounds(scene);
 assert.ok(bounds.length>=2);assert.equal(apartmentDecorBounds({kind:'apartment',resident:'bach'}),null);
 const entryRoute={x:model.spawn.x-90,y:640,w:180,h:model.height-640};
 for(const b of bounds){assert.ok(!model.solids.some(s=>overlaps(b,s)),'Furnishing regions must be clear of built-in furniture and walls');assert.ok(!overlaps(b,entryRoute),'The entry route remains outside the furnishing areas');}
 for(const product of stock){const a=catalog.get(product.asset);assert.ok(a,product.asset);const width=a.w*product.scale,height=a.h*product.scale;assert.ok(bounds.some(b=>width<=b.w&&height<=b.h),`${product.name} must fit in an actual furnishing area at its fixed product scale`);}
});

function drawingContext(){
 const pixels=[],scales=[],stack=[];let color='#000';
 return {pixels,scales,get depth(){return stack.length;},get fillStyle(){return color;},set fillStyle(value){color=value;},save(){stack.push(color);},restore(){assert.ok(stack.length);color=stack.pop();},translate(x,y){assert.ok(Number.isFinite(x+y));},scale(x,y){assert.ok(Number.isFinite(x+y));scales.push([x,y]);},rotate(n){assert.ok(Number.isFinite(n));},fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));pixels.push([x,y,w,h,color]);},beginPath(){},ellipse(){},fill(){},drawImage(){throw Error('Native characters should paint their pixels without loading an image.');}};
}
test('all eighteen apartment actors retain their actual NPC appearance and paint visible native characters',()=>{
 const sandbox={window:{}};vm.runInNewContext(read('../npc-visitors.js').toString(),sandbox);vm.runInNewContext(read('../character-renderer.js').toString(),sandbox);
 const renderer=sandbox.window.createCodaCharacterRenderer({worldScale:2.5,reducedMotion:()=>true}),fallback=renderer.appearanceFor('missing-resident'),signatures=[];
 for(const resident of residents){
  const model=getInterior({kind:'apartment',resident:resident.id});assert.equal(model.actors.length,1);assert.equal(model.actors[0].id,resident.id);
  assert.notEqual(renderer.appearanceFor(resident.id).name,fallback.name,resident.id+' must not fall back to a generic character');
  const ctx=drawingContext();assert.equal(renderer.drawNPC(ctx,model.actors[0],0),true);assert.equal(ctx.depth,0);assert.ok(ctx.pixels.length>20,resident.id+' must paint a visible body');assert.ok(ctx.scales.some(([x,y])=>x===2.5&&y===2.5));signatures.push(JSON.stringify(ctx.pixels));
 }
 assert.equal(new Set(signatures).size,residents.length,'Each musician must retain their distinct native drawing');
});

test('every resident walks clear apartment, hall and lobby routes to the street and back',()=>{
 for(const resident of residents){
  const home=residentHomePose(resident.id),model=getInterior(home.scene);
  assert.equal(home.scene.floor,resident.floor);assert.equal(home.scene.resident,resident.id);
  assert.deepEqual([home.x,home.y],[model.actors[0].x,model.actors[0].y]);
  for(const direction of ['out','home']){
   const duration=journeyDuration(resident.id,direction),visited=[];
   assert.ok(duration>10&&duration<40,`${resident.id}: believable journey length`);
   for(let time=0;time<duration;time+=.125){
    const pose=interiorJourneyPose(resident.id,direction,time);
    if(visited.at(-1)!==pose.scene.kind)visited.push(pose.scene.kind);
    assert.ok(Number.isFinite(pose.x+pose.y+pose.phase));
    if(pose.hidden){assert.equal(pose.scene.kind,'lift');assert.equal(residentInScene(pose,{kind:'hall',floor:resident.floor}),false);continue;}
    const room=getInterior(pose.scene);
    assert.ok(pose.x>=40&&pose.x<=room.width-40&&pose.y>=100&&pose.y<=room.height-40,`${resident.id}: outside ${room.id}`);
    assert.equal(room.solids.some(r=>pose.x>=r.x-16&&pose.x<=r.x+r.w+16&&pose.y>=r.y-16&&pose.y<=r.y+r.h+16),false,`${resident.id}: blocked at ${pose.x},${pose.y} in ${room.id}`);
    assert.equal(scenes.filter(scene=>residentInScene(pose,scene)).length,1,`${resident.id}: duplicate interior presence`);
   }
   assert.deepEqual(visited,direction==='out'?['apartment','hall','lift','lobby']:['lobby','lift','hall','apartment']);
   const end=interiorJourneyPose(resident.id,direction,duration+1);assert.equal(end.done,true);
   if(direction==='out'){assert.equal(end.hidden,true);assert.equal(end.scene,null);}
   else {assert.deepEqual(end,home);assert.equal(residentInScene(end,home.scene),true);}
  }
 }
 assert.equal(interiorJourneyPose('missing','out',0),null);
});

test('interior talk prompts follow the present actor and disappear when that actor leaves',()=>{
 const actor={...residentHomePose('bach'),x:700,y:800};
 const zones=residentInteractionZones([actor]);assert.equal(zones.length,1);assert.equal(zones[0].resident,'bach');assert.equal(zones[0].label,'Talk to Bach');
 assert.ok(actor.x>=zones[0].x&&actor.x<=zones[0].x+zones[0].w&&actor.y>=zones[0].y&&actor.y<=zones[0].y+zones[0].h);
 assert.deepEqual(residentInteractionZones([]),[]);assert.deepEqual(residentInteractionZones([{...actor,hidden:true}]),[]);
});
