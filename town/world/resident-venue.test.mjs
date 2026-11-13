import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {residents} from './resident-profiles.mjs';
import {venueVisitPose,venueVisitDuration} from './resident-venue.mjs';
import {configureUrbanInteriors,getInterior} from './urban-interiors.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {residentInScene} from './resident-journey.mjs';
import {SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE} from './showroom-layout.mjs';
import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs';

// Configure the same native furniture dimensions used by the browser so a
// convenient-looking path cannot accidentally pass through a real display.
const read=path=>readFileSync(new URL(path,import.meta.url));
const png=read('../assets/furniture.png'),atlas=JSON.parse(read('../assets/decor/atlas.json'));
const catalog=new Map(Array.from({length:9},(_,i)=>[`furniture-${i}-180`,{w:180,h:Math.ceil(180*png.readUInt32BE(20)/png.readUInt32BE(16)),boxes:[]}]));
for(const def of decorDefinitions){const cell=atlas.find(sheet=>sheet.family===def.family).cells[def.index],fit=Math.min(def.maxW/cell.w,def.maxH/cell.h);catalog.set(def.id,{w:Math.ceil(cell.w*fit),h:Math.ceil(cell.h*fit),boxes:[]});}
for(const item of SHOWROOM_FURNITURE)catalog.set(item.id,{w:item.w,h:item.h,boxes:item.boxes});
configureUrbanInteriors(catalog);

test('every resident enters its separate apartment showroom at the real lobby door and returns to the street',()=>{
 const model=getInterior({kind:'shop'}),models=[model,getInterior({kind:'shop',floor:2}),...SHOWROOMS.map(room=>getInterior({kind:'showroom',showroomId:room.id,floor:room.storeFloor}))],before=JSON.stringify(models),browsedRooms=new Set();
 const allScenes=[{kind:'shop',floor:1},{kind:'shop',floor:2},...SHOWROOMS.map(room=>({kind:'showroom',showroomId:room.id,floor:room.storeFloor}))];
 // Promoted decorated defaults use the editor's six-pixel walking clearance;
 // the other eleven authored tours retain their original wider margin.
 const blocked=(model,x,y)=>{const radius=model.roomLayoutBaseItems?6:16;return x<40||x>model.width-40||y<100||y>model.height-40||model.solids.some(r=>x>=r.x-radius&&x<=r.x+r.w+radius&&y>=r.y-radius&&y<=r.y+r.h+radius);};
 for(const resident of residents){
  const showroom=SHOWROOMS[resident.index%SHOWROOMS.length];
  const duration=venueVisitDuration(resident.id,'shop'),initial=venueVisitPose(resident.id,'shop',0);
  assert.deepEqual({x:initial.x,y:initial.y},model.spawn);
  let walked=false,browsed=false,previous=null;const scenes=[];
  for(let elapsed=0;elapsed<duration;elapsed+=.05){
   const pose=venueVisitPose(resident.id,'shop',elapsed);
   const interior=pose.hidden?null:getInterior(pose.scene);
   if(interior)assert.equal(blocked(interior,pose.x,pose.y),false,`${resident.id} crossed a wall or furnishing in ${interior.id} at ${pose.x},${pose.y}`);
   else {assert.equal(pose.scene.kind,'store-lift');assert.equal(pose.walking,false);assert.deepEqual({x:pose.x,y:pose.y},STORE_VERTICAL_CORE.arrival);assert(pose.purpose.startsWith('Riding'));}
   assert.equal(pose.id,resident.id);assert.equal(pose.done,false);assert(Number.isFinite(pose.x+pose.y+pose.phase));
   assert.equal(allScenes.filter(scene=>residentInScene(pose,scene)).length,pose.hidden?0:1,'A shopper appears on exactly one store floor, except while inside the lift');
   assert(!residentInScene(pose,{kind:'apartment',resident:resident.id,floor:resident.floor}));
   assert.equal(pose.showroomId,showroom.id);
   const sceneKey=pose.scene.kind+':'+pose.scene.floor;if(scenes.at(-1)!==sceneKey)scenes.push(sceneKey);
   if(previous&&previous.scene.kind!==pose.scene.kind){
    if(pose.scene.kind==='showroom'){
     assert(Math.hypot(previous.x-showroom.lobbyApproach.x,previous.y-showroom.lobbyApproach.y)<.01,'Entry must occur at the lobby door');
     assert(Math.hypot(pose.x-showroom.apartment.spawn.x,pose.y-showroom.apartment.spawn.y)<9,'Entry must begin at the interior door');
    }else if(previous.scene.kind==='showroom'&&pose.scene.kind==='shop'){
     assert(Math.hypot(previous.x-showroom.apartment.spawn.x,previous.y-showroom.apartment.spawn.y)<.01,'Return must occur at the interior door');
     assert(Math.hypot(pose.x-showroom.lobbyReturn.x,pose.y-showroom.lobbyReturn.y)<9,'The same door must return the visitor to the lobby');
    }
   }
   walked||=pose.walking;
   if(pose.purpose.startsWith('Browsing')){
    browsed=true;browsedRooms.add(pose.scene.showroomId);assert.equal(pose.walking,false);assert(pose.purpose.includes(showroom.name));
    assert.equal(pose.scene.kind,'showroom');assert.equal(pose.scene.showroomId,showroom.id);
    assert(pose.x>40&&pose.x<interior.width-40&&pose.y>100&&pose.y<interior.height-40,'Resident must browse inside its full apartment');
   }
   previous=pose;
  }
  assert(walked&&browsed);assert.deepEqual(scenes,showroom.storeFloor===2?['shop:1','store-lift:2','shop:2','showroom:2','shop:2','store-lift:1','shop:1']:['shop:1','showroom:1','shop:1'],'Each shopper uses the real floor, lift and independent apartment scene');
  const last=venueVisitPose(resident.id,'shop',duration+1);assert(last.done);assert(!last.hidden);assert(!last.walking);assert.deepEqual({x:last.x,y:last.y},model.spawn);
 }
 assert.equal(browsedRooms.size,12);assert.equal(JSON.stringify(models),before);
});

test('arcade visits remain in a hidden logical venue until they are ready for the exit queue',()=>{
 for(const resident of residents){
  const duration=venueVisitDuration(resident.id,'arcade',{stay:18});assert.equal(duration,18);
  for(const elapsed of [0,5,17.99,18,100]){
   const pose=venueVisitPose(resident.id,'arcade',elapsed,{stay:18});assert.equal(pose.id,resident.id);assert.deepEqual(pose.scene,{kind:'arcade',floor:1});
   assert.equal(pose.hidden,true);assert.equal(pose.walking,false);assert.equal(pose.done,elapsed>=18);assert(!residentInScene(pose,{kind:'shop',floor:1}));
  }
 }
});

test('visit timing handles boundary values without changing resident profiles or commerce state',()=>{
 const before=JSON.stringify(residents);
 assert.equal(venueVisitPose('missing','shop',0),null);assert.equal(venueVisitPose('bach','missing',0),null);assert.equal(venueVisitDuration('missing','shop'),0);
 assert.deepEqual(venueVisitPose('bach','shop',NaN),venueVisitPose('bach','shop',0));assert.deepEqual(venueVisitPose('bach','shop',-1),venueVisitPose('bach','shop',0));
 assert(venueVisitPose('bach','shop',Infinity).done);assert(venueVisitPose('bach','arcade',0,{stay:-1}).done);
 const pose=venueVisitPose('bach','shop',5);assert(!('wallet' in pose));assert(!('owned' in pose));assert(!('purchases' in pose));
 assert.equal(JSON.stringify(residents),before);
});


test('all twelve reserved slots occupy distinct apartment scenes on the proper store floor',()=>{
 assert.equal(SHOWROOMS.length,12);
 const poses=SHOWROOMS.map((room,slot)=>{
  const duration=venueVisitDuration('bach','shop',{stay:80,slot});
  for(let elapsed=0;elapsed<duration;elapsed+=.1){const pose=venueVisitPose('bach','shop',elapsed,{stay:80,slot});if(pose.purpose.startsWith('Browsing'))return pose;}
  assert.fail('The reserved room must have a browsing phase: '+room.id);
 });
 assert.equal(new Set(poses.map(pose=>pose.showroomId)).size,12);
 for(let i=0;i<poses.length;i++){
  const pose=poses[i],room=SHOWROOMS[i];assert.equal(pose.id,'bach');assert.equal(pose.walking,false);assert.equal(pose.showroomId,room.id);
  assert.deepEqual(pose.scene,{kind:'showroom',showroomId:room.id,floor:room.storeFloor});
  assert.deepEqual({x:pose.x,y:pose.y},room.apartment.visitRoute.at(-1));
  assert(residentInScene(pose,pose.scene));assert(!residentInScene(pose,{kind:'shop',floor:1}));
  for(let j=0;j<poses.length;j++)assert.equal(residentInScene(pose,{kind:'showroom',showroomId:SHOWROOMS[j].id,floor:SHOWROOMS[j].storeFloor}),i===j);
 }
 assert.deepEqual(STORE_TRAFFIC.spawn,getInterior({kind:'shop'}).spawn);
});

test('concert visitors walk the aisles, sit in a reserved chair, and leave through the entrance',()=>{
 const first=venueVisitPose('bach','opera',0,{stay:80,slot:73}),duration=venueVisitDuration('bach','opera',{stay:80,slot:73});assert.equal(first.scene.kind,'concert');assert.equal(first.walking,true);let sitting=false,leaving=false;
 for(let t=0;t<=duration;t+=.1){const p=venueVisitPose('bach','opera',t,{stay:80,slot:73});assert.equal(p.seatId,first.seatId);assert(p.x>700&&p.x<3400&&p.y>=1300&&p.y<2500);if(p.seated){sitting=true;assert.equal(p.facing,'up');assert.equal(p.walking,false);}if(t>duration-5&&p.walking)leaving=true;}
 assert(sitting);assert(leaving);assert.equal(venueVisitPose('bach','opera',duration+.1,{stay:80,slot:73}).done,true);
});
