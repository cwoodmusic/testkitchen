import test from 'node:test';
import assert from 'node:assert/strict';
import {DEPOT_ROOM,createRoomWalker,findPath,isWalkable} from './room.mjs';

const near=(a,b)=>assert(Math.abs(a-b)<.000001,`${a} differs from ${b}`);
const point=state=>({x:state.x,y:state.y});
const irisFoot=DEPOT_ROOM.obstacles.find(obstacle=>obstacle.id==='iris');
const blockedIris={x:irisFoot.x+irisFoot.width/2,y:irisFoot.y+irisFoot.height/2};
function arrive(walker){
 let frames=0;
 while(walker.state.moving&&frames<1000){assert.equal(walker.update(50),true);assert(isWalkable(DEPOT_ROOM,walker.state));frames++;}
 assert(frames<1000,'Navigation must finish instead of spinning at an obstacle.');
 return frames;
}

test('all people, doors and the chest can be approached around the actual room furniture',()=>{
 const walker=createRoomWalker();
 assert.deepEqual(point(walker.state),{x:768,y:920});
 assert.equal(walker.state.facing,'up');assert.equal(walker.state.moving,false);assert.equal(walker.nearbyTarget(),null);
 for(const target of DEPOT_ROOM.targets){
  assert(walker.approach(target.id),target.id);arrive(walker);
  assert(walker.withinReach(target.id),target.id);assert.equal(walker.state.targetId,target.id);
  assert.equal(walker.state.destination,null);assert.equal(walker.state.moving,false);
  assert.equal(walker.nearbyTarget()?.id,target.id);
  assert.equal(walker.update(50),false,'An idle walker does not request another render.');
 }
});

test('direct walking keeps simultaneous directions on one axis at normal speed',()=>{
 const straight=createRoomWalker(),combined=createRoomWalker();
 straight.move(1,0,50);combined.move(1,1,50);
 near(Math.hypot(straight.state.x-768,straight.state.y-920),13);
 near(combined.state.x,768);near(combined.state.y,933);assert.equal(combined.state.facing,'down','Equal input keeps the current facing axis.');
 combined.move(1,-.5,50);near(combined.state.x,781);near(combined.state.y,933);assert.equal(combined.state.facing,'right','The stronger axis wins.');
 combined.move(-1,-1,50);near(combined.state.x,768);near(combined.state.y,933);assert.equal(combined.state.facing,'left');
 assert.equal(straight.state.facing,'right');assert.equal(straight.state.moving,true);
});

test('cardinal keyboard walking changes facing and stops when blocked',()=>{
 const above=createRoomWalker({savedPosition:{x:220,y:510}});
 for(let i=0;i<40;i++){above.move(0,-1,50);assert(isWalkable(DEPOT_ROOM,above.state));}
 const counter=DEPOT_ROOM.obstacles.find(obstacle=>obstacle.id==='counter'),front=counter.y+counter.height+DEPOT_ROOM.radius;
 assert(above.state.y>=front);assert(above.state.y<front+8);assert.equal(above.state.moving,false);assert.equal(above.state.facing,'up');
 assert.equal(above.move(0,-1,50),false,'Repeated bumps do not report movement.');
});

test('walls, NPC feet and the chest remain solid under held keys',()=>{
 for(const obstacle of DEPOT_ROOM.obstacles){
  const {x,y,width,height}=obstacle,radius=DEPOT_ROOM.radius;
  const probe=[
   {at:{x:x+width/2,y:y+height+60},dx:0,dy:-1,blocked:at=>at.y>=y+height+radius-EPS},
   {at:{x:x+width/2,y:y-60},dx:0,dy:1,blocked:at=>at.y<=y-radius+EPS},
   {at:{x:x-60,y:y+height/2},dx:1,dy:0,blocked:at=>at.x<=x-radius+EPS},
   {at:{x:x+width+60,y:y+height/2},dx:-1,dy:0,blocked:at=>at.x>=x+width+radius-EPS},
  ].find(candidate=>isWalkable(DEPOT_ROOM,candidate.at));
  assert(probe,`${obstacle.id} needs an available collision probe`);
  const walker=createRoomWalker({savedPosition:probe.at});
  for(let i=0;i<100;i++){walker.move(probe.dx,probe.dy,50);assert(isWalkable(DEPOT_ROOM,walker.state));}
  assert(probe.blocked(walker.state),obstacle.id);assert.equal(walker.state.moving,false,obstacle.id);
 }
 const walker=createRoomWalker();
 for(let i=0;i<200;i++)walker.move(-1,1,50);
 assert(walker.state.x>=66);assert(walker.state.y<=960);assert(isWalkable(DEPOT_ROOM,walker.state));
});
const EPS=.000001;

test('large frame gaps are clamped and narrow obstacles cannot be tunneled through',()=>{
 const walker=createRoomWalker();walker.move(1,0,100000);near(walker.state.x,DEPOT_ROOM.start.x+13);
 const room={width:600,height:240,bounds:{x:0,y:0,width:600,height:240},radius:2,gridSize:16,speed:10000,maxDeltaMs:50,start:{x:100,y:100},obstacles:[{x:300,y:0,width:1,height:240}],targets:[]};
 const fast=createRoomWalker({room});fast.move(1,0,5000);
 assert(fast.state.x<=298);assert(isWalkable(room,fast.state));
 assert.equal(fast.goTo({x:500,y:100}),false,'Disconnected floor does not create a path through the wall.');
});

test('tap navigation projects outside and solid destinations onto walkable floor',()=>{
 const walker=createRoomWalker();
 assert(walker.goTo({x:-10000,y:50000}));arrive(walker);assert(isWalkable(DEPOT_ROOM,walker.state));
 assert(walker.state.x>=66&&walker.state.y<=960);
 assert(walker.goTo(blockedIris));arrive(walker);assert(isWalkable(DEPOT_ROOM,walker.state));
 assert(walker.state.x!==blockedIris.x||walker.state.y!==blockedIris.y,'An NPC foot cannot be a destination.');
 const before=walker.state;
 for(const invalid of [null,{},[],{x:NaN,y:0},{x:Infinity,y:0},{x:'50',y:0}]){assert.equal(walker.goTo(invalid),false);assert.deepEqual(walker.state,before);}
});

test('a keyboard move cancels a pointer route and stop cancels every pending step',()=>{
 const walker=createRoomWalker();assert(walker.approach('canal'));assert(walker.state.destination);
 walker.update(50);assert(walker.move(-1,0,50));assert.equal(walker.state.targetId,null);assert.equal(walker.state.destination,null);
 walker.goTo({x:1400,y:900});assert.equal(walker.stop(),true);
 const stopped=walker.state;assert.equal(walker.update(50),false);assert.deepEqual(walker.state,stopped);assert.equal(walker.stop(),false);
 assert.equal(walker.approach('missing'),false);assert.equal(walker.withinReach('missing'),false);
});

test('saved positions and room definitions are validated and copied',()=>{
 const valid={x:600,y:800,facing:'left'},walker=createRoomWalker({savedPosition:valid});
 assert.deepEqual(point(walker.state),{x:600,y:800});assert.equal(walker.state.facing,'left');valid.x=1000;assert.equal(walker.state.x,600);
 for(const savedPosition of [{x:0,y:0},blockedIris,{x:NaN,y:800},{x:'600',y:800},null])assert.deepEqual(point(createRoomWalker({savedPosition}).state),{x:768,y:920});
 const snapshot=walker.state;snapshot.x=-10;assert.equal(walker.state.x,600);
 const mutable=structuredClone(DEPOT_ROOM),custom=createRoomWalker({room:mutable});mutable.bounds.x=1000;mutable.targets[0].x=5000;
 assert(custom.approach('nell'));arrive(custom);assert(custom.withinReach('nell'));
 const target=custom.nearbyTarget();target.approach.x=-100;assert.notEqual(custom.nearbyTarget().approach.x,-100);
 for(const change of [{radius:-1},{speed:0},{gridSize:1},{maxDeltaMs:500},{bounds:{x:0,y:0,width:-10,height:100}}])assert.throws(()=>createRoomWalker({room:{...structuredClone(DEPOT_ROOM),...change}}));
});

test('navigation paths stay clear at every sampled foot position and remove unnecessary grid turns',()=>{
 const from={x:380,y:920};
 for(const target of DEPOT_ROOM.targets){
  const path=findPath(DEPOT_ROOM,from,target.approach);assert(path?.length,target.id);let previous=from;
  for(const next of path){assert(Math.abs(next.x-previous.x)<EPS||Math.abs(next.y-previous.y)<EPS,`${target.id} has a diagonal leg`);const steps=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.y-previous.y)));for(let i=0;i<=steps;i++)assert(isWalkable(DEPOT_ROOM,{x:previous.x+(next.x-previous.x)*i/steps,y:previous.y+(next.y-previous.y)*i/steps}),target.id);previous=next;}
 }
 assert.deepEqual(findPath(DEPOT_ROOM,from,from),[]);
 assert.deepEqual(findPath(DEPOT_ROOM,from,{x:600,y:900}),[{x:600,y:920},{x:600,y:900}]);
 assert.equal(findPath(DEPOT_ROOM,blockedIris,{x:600,y:900}),null);
});

test('off-grid endpoints detour around furniture with only checked right-angle turns',()=>{
 const room={width:400,height:300,bounds:{x:0,y:0,width:400,height:300},radius:10,gridSize:16,speed:260,maxDeltaMs:50,start:{x:43.5,y:217.25},obstacles:[{x:140,y:70,width:100,height:160}],targets:[]};
 const destination={x:347.75,y:73.5};
 for(const [from,to]of [[room.start,destination],[destination,room.start]]){
  const route=findPath(room,from,to);assert(route?.length>2,'Both simple elbows are blocked, so navigation must detour.');
  assert.deepEqual(route.at(-1),to,'The exact off-grid endpoint is retained.');
  let previous=from;
  for(const next of route){
   assert(Math.abs(next.x-previous.x)<EPS||Math.abs(next.y-previous.y)<EPS,'A grid connector cannot introduce a diagonal.');
   const steps=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.y-previous.y)));
   for(let i=0;i<=steps;i++)assert(isWalkable(room,{x:previous.x+(next.x-previous.x)*i/steps,y:previous.y+(next.y-previous.y)*i/steps}),'Every cardinal segment clears the full foot circle.');
   previous=next;
  }
  const walker=createRoomWalker({room,savedPosition:from});assert(walker.goTo(to));
  for(let frame=0;walker.state.moving&&frame<500;frame++){walker.update(50);assert(isWalkable(room,walker.state));}
  near(walker.state.x,to.x);near(walker.state.y,to.y);assert.equal(walker.state.moving,false);
 }
});
