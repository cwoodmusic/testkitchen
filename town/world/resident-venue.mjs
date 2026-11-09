import {residents} from './resident-profiles.mjs?v=queues-stage-1';

const SPEED=156,GAIT=Math.PI*2/150;
const profileById=new Map(residents.map(resident=>[resident.id,resident]));
const point=(x,y)=>({x,y});
const shopDoor=point(1536,1840);
const facing=(from,to)=>Math.abs(to.x-from.x)>Math.abs(to.y-from.y)?to.x<from.x?'left':'right':to.y<from.y?'up':'down';
const visitLength=stay=>Number.isFinite(stay)?Math.max(0,Math.min(300,stay)):24;

// The showroom's broad central aisle remains clear of its native furniture
// and planters. Incoming and outgoing lanes stay separate; residents stop
// beside the displays rather than occupying the main circulation strip.
function shopRoute(resident,stay,slot){
 const index=Number.isInteger(slot)&&slot>=0&&slot<6?slot:resident.index;
 const browse=point(index%2?1662:1410,1190+Math.floor(index/2)%3*100);
 const enter=point(1478,1800),arrive=point(1478,browse.y),leave=point(1594,browse.y),exit=point(1594,1800);
 const steps=[];
 const walk=(from,to,purpose)=>steps.push({from,to,purpose,duration:Math.hypot(to.x-from.x,to.y-from.y)/SPEED});
 walk(shopDoor,enter,'Looking around Coda Furnishings');
 walk(enter,arrive,'Looking around Coda Furnishings');
 walk(arrive,browse,'Looking at the furniture displays');
 steps.push({from:browse,to:browse,duration:stay,purpose:'Browsing the furniture displays',facing:index%2?'right':'left'});
 walk(browse,leave,'Heading back outside');
 walk(leave,exit,'Heading back outside');
 walk(exit,shopDoor,'Heading back outside');
 let elapsed=0,distance=0;
 for(const step of steps){step.start=elapsed;step.distance=distance;elapsed+=step.duration;distance+=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y);}
 return {steps,duration:elapsed};
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
 if(elapsed>=route.duration)return {id,name:resident.name,scene:{kind:'shop',floor:1},...shopDoor,facing:'down',walking:false,phase:0,hidden:false,done:true,activity:'',purpose:'Ready to go outside'};
 const step=route.steps.find(item=>elapsed<item.start+item.duration)||route.steps.at(-1),distance=Math.hypot(step.to.x-step.from.x,step.to.y-step.from.y),fraction=step.duration?Math.min(1,(elapsed-step.start)/step.duration):1;
 return {id,name:resident.name,scene:{kind:'shop',floor:1},x:step.from.x+(step.to.x-step.from.x)*fraction,y:step.from.y+(step.to.y-step.from.y)*fraction,facing:distance?facing(step.from,step.to):step.facing||'down',walking:distance>0,phase:(step.distance+distance*fraction)*GAIT%(Math.PI*2),hidden:false,done:false,activity:'',purpose:step.purpose};
}
