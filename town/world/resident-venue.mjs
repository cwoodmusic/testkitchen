import {residents} from './resident-profiles.mjs?v=apartment-showrooms-1';
import {SHOWROOMS,STORE_TRAFFIC} from './showroom-layout.mjs?v=apartment-showrooms-1';
export const SHOP_VISIT_CAPACITY=SHOWROOMS.length;

const SPEED=156,GAIT=Math.PI*2/150;
const profileById=new Map(residents.map(resident=>[resident.id,resident]));
const point=(x,y)=>({x,y});
const shopDoor=STORE_TRAFFIC.spawn;
const facing=(from,to)=>Math.abs(to.x-from.x)>Math.abs(to.y-from.y)?to.x<from.x?'left':'right':to.y<from.y?'up':'down';
const visitLength=stay=>Number.isFinite(stay)?Math.max(0,Math.min(300,stay)):24;

// One reserved slot belongs to each apartment showroom. Its lobby doorway
// and its separate interior use different coordinate systems. A resident
// changes scenes only at the doorway, keeping one identity throughout.
function shopRoute(resident,stay,slot){
 const index=Number.isInteger(slot)&&slot>=0&&slot<SHOWROOMS.length?slot:resident.index%SHOWROOMS.length;
 const showroom=SHOWROOMS[index],apartment=showroom.apartment;
 const lobby={kind:'shop',floor:1},inside={kind:'showroom',showroomId:showroom.id,floor:1};
 const enter=point(STORE_TRAFFIC.incomingX,shopDoor.y),aisleIn=point(STORE_TRAFFIC.incomingX,STORE_TRAFFIC.ingressY),roomIn=point(showroom.lobbyApproach.x,STORE_TRAFFIC.ingressY);
 const roomOut=point(showroom.lobbyReturn.x,STORE_TRAFFIC.egressY),aisleOut=point(STORE_TRAFFIC.outgoingX,STORE_TRAFFIC.egressY),exit=point(STORE_TRAFFIC.outgoingX,shopDoor.y);
 const steps=[];
 const walk=(scene,from,to,purpose)=>steps.push({scene,from,to,purpose,duration:Math.hypot(to.x-from.x,to.y-from.y)/SPEED});
 const wait=(scene,at,duration,purpose,direction)=>steps.push({scene,from:at,to:at,duration,purpose,facing:direction});
 const follow=(scene,points,purpose)=>{for(let i=1;i<points.length;i++)walk(scene,points[i-1],points[i],purpose);};
 follow(lobby,[shopDoor,enter,aisleIn,roomIn,showroom.lobbyApproach],'Visiting '+showroom.name);
 wait(lobby,showroom.lobbyApproach,.3,'Entering '+showroom.name,showroom.row?'down':'up');
 follow(inside,apartment.visitRoute,'Looking around '+showroom.name);
 const browse=apartment.visitRoute.at(-1),beforeBrowse=apartment.visitRoute.at(-2)||apartment.spawn;
 wait(inside,browse,stay,'Browsing '+showroom.name,facing(beforeBrowse,browse));
 follow(inside,apartment.exitRoute,'Returning to the furniture-store lobby');
 wait(inside,apartment.spawn,.3,'Returning to the furniture-store lobby','down');
 follow(lobby,[showroom.lobbyReturn,roomOut,aisleOut,exit,shopDoor],'Heading back outside');
 let elapsed=0,distance=0;
 for(const step of steps){step.start=elapsed;step.distance=distance;elapsed+=step.duration;distance+=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);}
 return {steps,duration:elapsed,showroom};
}

export function venueVisitDuration(id,kind,{stay=24,slot}={}){
 const resident=profileById.get(id);if(!resident)return 0;
 stay=visitLength(stay);
 return kind==='shop'?shopRoute(resident,stay,slot).duration:kind==='arcade'?stay:0;
}

// A visit has one resident identity throughout. The city controller owns the
// actual door transition and exit queue. This helper only describes activity
// inside the venue and never reads or writes purchases, money or map data.
export function venueVisitPose(id,kind,elapsed=0,{stay=24,slot}={}){
 const resident=profileById.get(id);if(!resident||!['shop','arcade'].includes(kind))return null;
 elapsed=Number.isNaN(elapsed)?0:Math.max(0,elapsed);stay=visitLength(stay);
 if(kind==='arcade')return {id,name:resident.name,scene:{kind:'arcade',floor:1},x:0,y:0,facing:'down',walking:false,phase:0,hidden:true,done:elapsed>=stay,activity:'',purpose:'Visiting Coda Arcade'};
 const route=shopRoute(resident,stay,slot);
 if(elapsed>=route.duration)return {id,name:resident.name,scene:{kind:'shop',floor:1},...shopDoor,showroomId:route.showroom.id,facing:'down',walking:false,phase:0,hidden:false,done:true,activity:'',purpose:'Ready to go outside'};
 const step=route.steps.find(item=>elapsed<item.start+item.duration)||route.steps.at(-1),distance=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y),fraction=step.duration?Math.min(1,(elapsed-step.start)/step.duration):1;
 return {id,name:resident.name,scene:{...step.scene},x:step.from.x+(step.to.x-step.from.x)*fraction,y:step.from.y+(step.to.y-step.from.y)*fraction,showroomId:route.showroom.id,facing:distance?facing(step.from,step.to):step.facing||'down',walking:distance>0,phase:(step.distance+distance*fraction)*GAIT%(Math.PI*2),hidden:false,done:false,activity:'',purpose:step.purpose};
}
