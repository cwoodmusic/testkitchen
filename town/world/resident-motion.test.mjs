import {test} from 'node:test';
import assert from 'node:assert/strict';
import {residents,residentHomePose,interiorJourneyPose,journeyDuration} from './resident-journey.mjs';
import {venueVisitPose,venueVisitDuration} from './resident-venue.mjs';
import {SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE} from './showroom-layout.mjs';
import {getInteriorBase} from './urban-interiors.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';

const TAU=Math.PI*2,DT=.01;
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} != ${expected}`);
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
const point=(x,y)=>({x,y});

// Compare two nearby walking poses within one straight leg, avoiding door
// transitions and corners. The animation must keep the same real-time cadence
// while its world-space stride follows the private-room character scale.
function checkWalkingLegs(poseAt,duration,kinds){
 const found=new Set();
 for(let time=.05;time+DT<duration&&found.size<kinds.length;time+=.07){
  const a=poseAt(time),b=poseAt(time+DT),kind=a.scene?.kind;
  if(!kinds.includes(kind)||found.has(kind)||!a.walking||!b.walking||a.hidden||b.hidden||JSON.stringify(a.scene)!==JSON.stringify(b.scene)||a.facing!==b.facing||(a.activity||a.purpose)!==(b.activity||b.purpose))continue;
  const privateRoom=kind==='apartment'||kind==='showroom',speed=privateRoom?58.5:156,stride=privateRoom?56.25:150;
  const distance=Math.hypot(b.x-a.x,b.y-a.y),phase=(b.phase-a.phase+TAU)%TAU;
  near(distance/DT,speed,kind+' walking speed');
  near(phase/distance,TAU/stride,kind+' world-space stride');
  near(phase/DT,TAU*156/150,kind+' real-time gait cadence');
  found.add(kind);
 }
 assert.deepEqual([...found].sort(),[...kinds].sort(),'Every requested scene has a measured walking leg');
}

test('all resident home journeys scale only apartment walking and retain the same public waits and route distances',()=>{
 const before=JSON.stringify(residents);
 for(const resident of residents){
  const home=residentHomePose(resident.id),privateDistance=975-home.y;
  const doorX=resident.floor>=7?500:resident.unit==='A'?430:1874;
  const publicDistance=1178+244+Math.abs(doorX-1152);
  const publicWaits=4+resident.floor*.35;
  const expected=publicDistance/156+privateDistance/58.5+publicWaits;
  for(const direction of ['out','home']){
   const duration=journeyDuration(resident.id,direction);
   near(duration,expected,resident.id+' '+direction+' total duration');
   const oldDuration=publicDistance/156+privateDistance/156+publicWaits;
   near(duration-oldDuration,privateDistance/58.5-privateDistance/156,'Only the private walking leg adds time');
   checkWalkingLegs(time=>interiorJourneyPose(resident.id,direction,time),duration,['apartment','hall','lobby']);
   const done=interiorJourneyPose(resident.id,direction,duration);
   assert.equal(done.done,true);assert.equal(done.id,resident.id);
   if(direction==='home')assert.deepEqual(done,home);
   else assert.equal(done.scene,null);
  }
 }
 assert.equal(JSON.stringify(residents),before);
});

test('all twelve store visits scale showroom legs while preserving both public floors, lift waits and browsing time',()=>{
 const before=JSON.stringify(SHOWROOMS),door=STORE_TRAFFIC.spawn,core=STORE_VERTICAL_CORE;
 for(const [slot,room]of SHOWROOMS.entries()){
  const apartment=room.apartment,stay=24,model=getInteriorBase({kind:'showroom',showroomId:room.id,floor:room.storeFloor}),navigation=model.roomLayoutBaseItems?getShowroomNavigation(model):{visitRoute:apartment.visitRoute,exitRoute:apartment.exitRoute};
  assert(navigation,room.id+' has a reachable browsing route');
  if(!model.roomLayoutBaseItems){assert.equal(navigation.visitRoute,apartment.visitRoute);assert.equal(navigation.exitRoute,apartment.exitRoute);}
  const privateDistance=length(navigation.visitRoute)+length(navigation.exitRoute);
  let publicDistance,incomingDistance,waits=.6;
  if(room.storeFloor===2){
   const at=core.arrival;
   incomingDistance=length([door,point(core.incomingX,door.y),point(core.incomingX,core.travelY),point(at.x,core.travelY),at])
    +length([at,point(room.entry.x,at.y),room.entry,...room.visitRoute.slice(1)]);
   publicDistance=incomingDistance
    +length([...room.exitRoute,point(room.entry.x,at.y),at])
    +length([at,point(core.outgoingX,at.y),point(core.outgoingX,door.y),door]);
   waits+=6;
  }else{
   incomingDistance=length([door,point(room.entry.x,door.y),...room.visitRoute]);
   publicDistance=incomingDistance
    +length([...room.exitRoute,point(room.entry.x,door.y),door]);
  }
  const duration=venueVisitDuration('bach','shop',{slot,stay});
  near(duration,publicDistance/156+privateDistance/58.5+stay+waits,room.id+' visit duration');
  checkWalkingLegs(time=>venueVisitPose('bach','shop',time,{slot,stay}),duration,['shop','showroom']);
  let at=incomingDistance/156+.3+(room.storeFloor===2?3:0);
  for(let i=1;i<navigation.visitRoute.length;i++){
   const p=navigation.visitRoute[i],previous=navigation.visitRoute[i-1];at+=Math.hypot(p.x-previous.x,p.y-previous.y)/58.5;
   const turn=venueVisitPose('bach','shop',at+1e-8,{slot,stay});assert.equal(turn.scene.kind,'showroom');assert(Math.hypot(turn.x-p.x,turn.y-p.y)<1e-4,room.id+' follows each current interior turn');
  }
  const browsing=venueVisitPose('bach','shop',at+stay/2,{slot,stay}),browse=navigation.visitRoute.at(-1);
  assert(browsing.purpose.startsWith('Browsing'));assert.equal(browsing.walking,false);near(browsing.x,browse.x,room.id+' actual browsing x');near(browsing.y,browse.y,room.id+' actual browsing y');
  const done=venueVisitPose('bach','shop',duration,{slot,stay});
  assert.equal(done.done,true);assert.equal(done.showroomId,room.id);
  assert.deepEqual({x:done.x,y:done.y},door);
 }
 assert.equal(JSON.stringify(SHOWROOMS),before);
 assert.equal(venueVisitDuration('bach','arcade',{stay:18}),18,'Arcade visits keep their existing timetable');
});
