import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {residents} from './resident-profiles.mjs';
import {venueVisitPose,venueVisitDuration} from './resident-venue.mjs';
import {configureUrbanInteriors,getInterior} from './urban-interiors.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {residentInScene} from './resident-journey.mjs';
import {SHOWROOMS,STORE_TRAFFIC} from './showroom-layout.mjs';
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
 const model=getInterior({kind:'shop'}),models=[model,...SHOWROOMS.map(room=>getInterior({kind:'showroom',showroomId:room.id,floor:1}))],before=JSON.stringify(models),browsedRooms=new Set();
 const allScenes=[{kind:'shop',floor:1},...SHOWROOMS.map(room=>({kind:'showroom',showroomId:room.id,floor:1}))];
 const blocked=(model,x,y)=>x<40||x>model.width-40||y<100||y>model.height-40||model.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
 for(const resident of residents){
  const showroom=SHOWROOMS[resident.index%SHOWROOMS.length];
  const duration=venueVisitDuration(resident.id,'shop'),initial=venueVisitPose(resident.id,'shop',0);
  assert.deepEqual({x:initial.x,y:initial.y},model.spawn);
  let walked=false,browsed=false,previous=null;const scenes=[];
  for(let elapsed=0;elapsed<duration;elapsed+=.05){
   const pose=venueVisitPose(resident.id,'shop',elapsed);
   const interior=getInterior(pose.scene);
   assert.equal(blocked(interior,pose.x,pose.y),false,`${resident.id} crossed a wall or furnishing in ${interior.id} at ${pose.x},${pose.y}`);
   assert.equal(pose.id,resident.id);assert.equal(pose.hidden,false);assert.equal(pose.done,false);assert(Number.isFinite(pose.x+pose.y+pose.phase));
   assert.equal(allScenes.filter(scene=>residentInScene(pose,scene)).length,1,'A shopper must appear only in the lobby or the particular apartment they entered');
   assert(!residentInScene(pose,{kind:'apartment',resident:resident.id,floor:resident.floor}));
   assert.equal(pose.showroomId,showroom.id);
   if(scenes.at(-1)!==pose.scene.kind)scenes.push(pose.scene.kind);
   if(previous&&previous.scene.kind!==pose.scene.kind){
    if(pose.scene.kind==='showroom'){
     assert(Math.hypot(previous.x-showroom.lobbyApproach.x,previous.y-showroom.lobbyApproach.y)<.01,'Entry must occur at the lobby door');
     assert(Math.hypot(pose.x-showroom.apartment.spawn.x,pose.y-showroom.apartment.spawn.y)<9,'Entry must begin at the interior door');
    }else{
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
  assert(walked&&browsed);assert.deepEqual(scenes,['shop','showroom','shop'],'Each resident must visit and return from the independent apartment scene');
  const last=venueVisitPose(resident.id,'shop',duration+1);assert(last.done);assert(!last.hidden);assert(!last.walking);assert.deepEqual({x:last.x,y:last.y},model.spawn);
 }
 assert.equal(browsedRooms.size,8);assert.equal(JSON.stringify(models),before);
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


test('all eight reserved slots occupy distinct apartment scenes even when local coordinates match',()=>{
 assert.equal(SHOWROOMS.length,8);
 const poses=SHOWROOMS.map((room,slot)=>{
  const duration=venueVisitDuration('bach','shop',{stay:80,slot});
  for(let elapsed=0;elapsed<duration;elapsed+=.1){const pose=venueVisitPose('bach','shop',elapsed,{stay:80,slot});if(pose.purpose.startsWith('Browsing'))return pose;}
  assert.fail('The reserved room must have a browsing phase: '+room.id);
 });
 assert.equal(new Set(poses.map(pose=>pose.showroomId)).size,8);
 for(let i=0;i<poses.length;i++){
  const pose=poses[i],room=SHOWROOMS[i];assert.equal(pose.id,'bach');assert.equal(pose.walking,false);assert.equal(pose.showroomId,room.id);
  assert.deepEqual(pose.scene,{kind:'showroom',showroomId:room.id,floor:1});
  assert.deepEqual({x:pose.x,y:pose.y},room.apartment.visitRoute.at(-1));
  assert(residentInScene(pose,pose.scene));assert(!residentInScene(pose,{kind:'shop',floor:1}));
  for(let j=0;j<poses.length;j++)assert.equal(residentInScene(pose,{kind:'showroom',showroomId:SHOWROOMS[j].id,floor:1}),i===j);
 }
 assert.deepEqual(STORE_TRAFFIC.spawn,getInterior({kind:'shop'}).spawn);
});
