import {residents} from './resident-profiles.mjs?v=opera-parallax-1';
import {interiorActorScale} from './interior-scale.mjs?v=opera-parallax-1';
import {getInterior} from './urban-interiors.mjs?v=town-library-review-1';
import {getApartmentNavigation} from './apartment-navigation.mjs?v=town-room-floorplan-1';
export {residents} from './resident-profiles.mjs?v=opera-parallax-1';

const SPEED=156,GAIT=Math.PI*2/150;
const journeys=new WeakMap();
const point=(x,y)=>({x,y});
const facing=(a,b)=>Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?b.x<a.x?'left':'right':b.y<a.y?'up':'down';

function homePose(resident,model){
 const at=model.actors?.find(actor=>actor.id===resident.id)||model.homePlan?.home||model.spawn;
 return {id:resident.id,name:resident.name,scene:{kind:'apartment',floor:resident.floor,resident:resident.id},x:at.x,y:at.y,facing:'down',walking:false,phase:0,hidden:false,done:true,activity:'At home'};
}
export function residentHomePose(id){
 const resident=residents.find(r=>r.id===id);if(!resident)return null;
 return homePose(resident,getInterior({kind:'apartment',floor:resident.floor,resident:id}));
}

// Private legs follow the current furniture; public waypoints retain their
// authored circulation. Scene changes occur only at a real door, lift or exit.
function journey(id,direction){
 const resident=residents.find(r=>r.id===id);if(!resident)return null;
 const model=getInterior({kind:'apartment',floor:resident.floor,resident:id}),key=id+':'+direction;
 let cached=journeys.get(model);if(!cached||cached.revision!==model.layoutRevision||cached.solids!==model.solids){cached={revision:model.layoutRevision,solids:model.solids,routes:new Map()};journeys.set(model,cached);}if(cached.routes.has(key))return cached.routes.get(key);
 const home=homePose(resident,model),room=home.scene,hall={kind:'hall',floor:resident.floor},lobby={kind:'lobby',floor:1};
 const homeAt=point(home.x,home.y),roomExit=point(model.spawn.x,model.spawn.y),doorX=resident.floor>=7?500:resident.unit==='A'?430:1874;
 const hallDoor=point(doorX,342),hallTurn=point(doorX,464),hallCenter=point(1152,464),hallLift=point(1152,342);
 const lobbyLift=point(1152,400),street=point(1152,1578),steps=[];
 const walk=(scene,from,to,activity)=>steps.push({scene,from,to,activity,duration:Math.hypot(to.x-from.x,to.y-from.y)/(SPEED*interiorActorScale(scene))});
 const wait=(scene,at,duration,activity,hidden=false)=>steps.push({scene,from:at,to:at,duration,activity,hidden});
 const navigation=getApartmentNavigation(model,homeAt,roomExit);
 const privateWalk=(points,at,activity)=>{if(!points){wait(room,at,Infinity,'Waiting for a clear path');return;}for(let i=1;i<points.length;i++)walk(room,points[i-1],points[i],activity);};
 const elevator=()=>wait({kind:'lift',floor:resident.floor},point(1152,342),2.5+resident.floor*.35,'Riding the elevator',true);
 if(direction==='home'){
  walk(lobby,street,lobbyLift,'Heading home');wait(lobby,lobbyLift,.8,'Waiting for the elevator');elevator();
  walk(hall,hallLift,hallCenter,'Going to my apartment');walk(hall,hallCenter,hallTurn,'Going to my apartment');walk(hall,hallTurn,hallDoor,'Going to my apartment');wait(hall,hallDoor,.7,'Opening my apartment');
  privateWalk(navigation?.homeRoute,roomExit,'Settling in at home');
 }else{
  privateWalk(navigation?.outRoute,homeAt,'Heading out');wait(room,roomExit,.7,'Opening my apartment');
  walk(hall,hallDoor,hallTurn,'Heading outside');walk(hall,hallTurn,hallCenter,'Heading outside');walk(hall,hallCenter,hallLift,'Heading outside');wait(hall,hallLift,.8,'Waiting for the elevator');elevator();
  walk(lobby,lobbyLift,street,'Heading outside');
 }
 let elapsed=0,distance=0;
 for(const step of steps){step.start=elapsed;step.distance=distance;elapsed+=step.duration;distance+=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);}
 const result={steps,duration:elapsed,home,blocked:steps.find(step=>step.duration===Infinity)};cached.routes.set(key,result);return result;
}
export function journeyDuration(id,direction='out'){return journey(id,direction)?.duration||0;}
export function interiorJourneyPose(id,direction='out',elapsed=0){
 const route=journey(id,direction);if(!route)return null;
 elapsed=Number.isNaN(elapsed)?0:Math.max(0,elapsed);
 if(Number.isFinite(route.duration)&&elapsed>=route.duration)return direction==='home'?{...route.home,scene:{...route.home.scene}}:{id,name:route.home.name,scene:null,x:1152,y:1578,facing:'down',walking:false,phase:0,hidden:true,done:true,activity:'Outside'};
 const blocked=route.blocked,step=blocked&&elapsed>=blocked.start?blocked:route.steps.find(s=>elapsed<s.start+s.duration)||route.steps.at(-1),p=step.duration===Infinity?0:Math.min(1,(elapsed-step.start)/step.duration),distance=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);
 if(step.duration===Infinity)return {id,name:route.home.name,scene:{...step.scene},x:step.from.x,y:step.from.y,facing:direction==='home'?'up':'down',walking:false,phase:step.distance*GAIT/interiorActorScale(step.scene)%(Math.PI*2),hidden:false,done:false,activity:step.activity,waiting:true,resumeAt:step.start};
 return {id,name:route.home.name,scene:{...step.scene},x:step.from.x+(step.to.x-step.from.x)*p,y:step.from.y+(step.to.y-step.from.y)*p,facing:distance?facing(step.from,step.to):direction==='home'?'up':'down',walking:distance>0,phase:(step.distance+distance*p)*GAIT/interiorActorScale(step.scene)%(Math.PI*2),hidden:!!step.hidden,done:false,activity:step.activity};
}
export function residentInScene(pose,scene){
 if(!pose||pose.hidden||!pose.scene||!scene||pose.scene.kind!==scene.kind)return false;
 if(scene.kind==='apartment')return pose.scene.resident===scene.resident;
 if(scene.kind==='showroom')return pose.scene.showroomId===scene.showroomId;
 return scene.kind==='lobby'||pose.scene.floor===scene.floor;
}
