import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {residents} from './resident-profiles.mjs';
import {venueVisitPose,venueVisitDuration} from './resident-venue.mjs';
import {configureUrbanInteriors,getInterior} from './urban-interiors.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {residentInScene} from './resident-journey.mjs';

// Configure the same native furniture dimensions used by the browser so a
// convenient-looking path cannot accidentally pass through a real display.
const read=path=>readFileSync(new URL(path,import.meta.url));
const png=read('../assets/furniture.png'),atlas=JSON.parse(read('../assets/decor/atlas.json'));
const catalog=new Map(Array.from({length:9},(_,i)=>[`furniture-${i}-180`,{w:180,h:Math.ceil(180*png.readUInt32BE(20)/png.readUInt32BE(16)),boxes:[]}]));
for(const def of decorDefinitions){const cell=atlas.find(sheet=>sheet.family===def.family).cells[def.index],fit=Math.min(def.maxW/cell.w,def.maxH/cell.h);catalog.set(def.id,{w:Math.ceil(cell.w*fit),h:Math.ceil(cell.h*fit),boxes:[]});}
configureUrbanInteriors(catalog);

test('every resident browses the shop and returns to its real street door without crossing displays',()=>{
 const model=getInterior({kind:'shop'}),before=JSON.stringify(model),browseSpots=new Set();
 const blocked=(x,y)=>x<40||x>model.width-40||y<100||y>model.height-40||model.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
 for(const resident of residents){
  const duration=venueVisitDuration(resident.id,'shop'),initial=venueVisitPose(resident.id,'shop',0);
  assert.deepEqual({x:initial.x,y:initial.y},model.spawn);
  let walked=false,browsed=false;
  for(let elapsed=0;elapsed<duration;elapsed+=.1){
   const pose=venueVisitPose(resident.id,'shop',elapsed);
   assert.equal(blocked(pose.x,pose.y),false,`${resident.id} crossed a display at ${pose.x},${pose.y}`);
   assert.equal(pose.id,resident.id);assert.equal(pose.hidden,false);assert.equal(pose.done,false);assert(Number.isFinite(pose.x+pose.y+pose.phase));
   assert(residentInScene(pose,{kind:'shop',floor:1}));assert(!residentInScene(pose,{kind:'apartment',resident:resident.id,floor:resident.floor}));
   walked||=pose.walking;
   if(!pose.walking){browsed=true;browseSpots.add(`${pose.x},${pose.y}`);assert.match(pose.purpose,/Browsing/);}
  }
  assert(walked&&browsed);
  const last=venueVisitPose(resident.id,'shop',duration+1);assert(last.done);assert(!last.hidden);assert(!last.walking);assert.deepEqual({x:last.x,y:last.y},model.spawn);
 }
 assert.equal(browseSpots.size,6);assert.equal(JSON.stringify(model),before);
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


test('separate showroom browse slots retain the real resident identity',()=>{
 const a=venueVisitPose('bach','shop',20,{stay:24,slot:0}),b=venueVisitPose('bach','shop',20,{stay:24,slot:1});
 assert.equal(a.id,'bach');assert.equal(b.id,'bach');assert(Math.hypot(a.x-b.x,a.y-b.y)>200);
});
