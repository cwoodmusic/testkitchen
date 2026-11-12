import {residents} from './resident-profiles.mjs?v=room-defaults-curtain-1';
import {interiorActorScale} from './interior-scale.mjs?v=room-defaults-curtain-1';
export {residents} from './resident-profiles.mjs?v=room-defaults-curtain-1';

const SPEED=156,GAIT=Math.PI*2/150;
const journeys=new Map();
const point=(x,y)=>({x,y});
const facing=(a,b)=>Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?b.x<a.x?'left':'right':b.y<a.y?'up':'down';

export function residentHomePose(id){
 const resident=residents.find(r=>r.id===id);if(!resident)return null;
 const wide=resident.floor>=7;
 return {id,name:resident.name,scene:{kind:'apartment',floor:resident.floor,resident:id},x:wide?1152:544,y:wide?750:650,facing:'down',walking:false,phase:0,hidden:false,done:true,activity:'At home'};
}

// These waypoints follow the same broad, clear circulation strips used by
// the player. Scene changes occur only at a real apartment door, lift or exit.
function journey(id,direction){
 const key=id+':'+direction;if(journeys.has(key))return journeys.get(key);
 const resident=residents.find(r=>r.id===id);if(!resident)return null;
 const home=residentHomePose(id),room=home.scene,hall={kind:'hall',floor:resident.floor},lobby={kind:'lobby',floor:1};
 const homeAt=point(home.x,home.y),roomExit=point(home.x,975),doorX=resident.floor>=7?500:resident.unit==='A'?430:1874;
 const hallDoor=point(doorX,342),hallTurn=point(doorX,464),hallCenter=point(1152,464),hallLift=point(1152,342);
 const lobbyLift=point(1152,400),street=point(1152,1578),steps=[];
 const walk=(scene,from,to,activity)=>steps.push({scene,from,to,activity,duration:Math.hypot(to.x-from.x,to.y-from.y)/(SPEED*interiorActorScale(scene))});
 const wait=(scene,at,duration,activity,hidden=false)=>steps.push({scene,from:at,to:at,duration,activity,hidden});
 const elevator=()=>wait({kind:'lift',floor:resident.floor},point(1152,342),2.5+resident.floor*.35,'Riding the elevator',true);
 if(direction==='home'){
  walk(lobby,street,lobbyLift,'Heading home');wait(lobby,lobbyLift,.8,'Waiting for the elevator');elevator();
  walk(hall,hallLift,hallCenter,'Going to my apartment');walk(hall,hallCenter,hallTurn,'Going to my apartment');walk(hall,hallTurn,hallDoor,'Going to my apartment');wait(hall,hallDoor,.7,'Opening my apartment');
  walk(room,roomExit,homeAt,'Settling in at home');
 }else{
  walk(room,homeAt,roomExit,'Heading out');wait(room,roomExit,.7,'Opening my apartment');
  walk(hall,hallDoor,hallTurn,'Heading outside');walk(hall,hallTurn,hallCenter,'Heading outside');walk(hall,hallCenter,hallLift,'Heading outside');wait(hall,hallLift,.8,'Waiting for the elevator');elevator();
  walk(lobby,lobbyLift,street,'Heading outside');
 }
 let elapsed=0,distance=0;
 for(const step of steps){step.start=elapsed;step.distance=distance;elapsed+=step.duration;distance+=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);}
 const result={steps,duration:elapsed,home};journeys.set(key,result);return result;
}
export function journeyDuration(id,direction='out'){return journey(id,direction)?.duration||0;}
export function interiorJourneyPose(id,direction='out',elapsed=0){
 const route=journey(id,direction);if(!route)return null;
 elapsed=Number.isNaN(elapsed)?0:Math.max(0,elapsed);
 if(elapsed>=route.duration)return direction==='home'?{...route.home,scene:{...route.home.scene}}:{id,name:route.home.name,scene:null,x:1152,y:1578,facing:'down',walking:false,phase:0,hidden:true,done:true,activity:'Outside'};
 const step=route.steps.find(s=>elapsed<s.start+s.duration)||route.steps.at(-1),p=Math.min(1,(elapsed-step.start)/step.duration),distance=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);
 return {id,name:route.home.name,scene:{...step.scene},x:step.from.x+(step.to.x-step.from.x)*p,y:step.from.y+(step.to.y-step.from.y)*p,facing:distance?facing(step.from,step.to):direction==='home'?'up':'down',walking:distance>0,phase:(step.distance+distance*p)*GAIT/interiorActorScale(step.scene)%(Math.PI*2),hidden:!!step.hidden,done:false,activity:step.activity};
}
export function residentInScene(pose,scene){
 if(!pose||pose.hidden||!pose.scene||!scene||pose.scene.kind!==scene.kind)return false;
 if(scene.kind==='apartment')return pose.scene.resident===scene.resident;
 if(scene.kind==='showroom')return pose.scene.showroomId===scene.showroomId;
 return scene.kind==='lobby'||pose.scene.floor===scene.floor;
}
