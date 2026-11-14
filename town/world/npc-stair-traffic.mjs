import {height,TILE} from './model.mjs?v=town-coast-pier-1';

const tileKey=p=>Math.floor(p.x/TILE)+','+Math.floor(p.y/TILE);
const sign=(actor,flight)=>{
 const target=actor._path?.at(-1);if(!target)return 0;
 const delta=target[flight.axis]-actor[flight.axis];return Math.abs(delta)>1?Math.sign(delta):0;
};

/** Derived passage geometry; never writes to authored cells or actor paths. */
export function createNPCStairTraffic(){
 let flights=[],tiles=new Map();
 function reset(doc){
  flights=[];tiles=new Map();
  const pending=new Map(Object.entries(doc?.cells||{}).filter(([,a])=>a.stairs));
  for(const [start,first]of pending){
   if(!pending.has(start))continue;
   const flight={axis:['north','south'].includes(first.stairs)?'y':'x',x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity},queue=[start];pending.delete(start);
   for(let head=0;head<queue.length;head++){
    const key=queue[head],[x,y]=key.split(',').map(Number);tiles.set(key,flight);
    flight.x0=Math.min(flight.x0,x*TILE);flight.y0=Math.min(flight.y0,y*TILE);flight.x1=Math.max(flight.x1,(x+1)*TILE);flight.y1=Math.max(flight.y1,(y+1)*TILE);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
     const next=(x+dx)+','+(y+dy),a=pending.get(next);if(!a||a.stairs!==first.stairs)continue;
     const mid={x:(x+.5+dx*.5)*TILE,y:(y+.5+dy*.5)*TILE};
     if(Math.abs(height(doc,mid.x-dx*.1,mid.y-dy*.1)-height(doc,mid.x+dx*.1,mid.y+dy*.1))>1)continue;
     pending.delete(next);queue.push(next);
    }
   }
   flights.push(flight);
  }
 }
 const at=p=>tiles.get(tileKey(p));
 function upcoming(actor){
  let previous=actor,left=128;
  for(const end of (actor._path||[]).slice(0,8)){
   const dx=end.x-previous.x,dy=end.y-previous.y,length=Math.hypot(dx,dy),run=Math.min(left,length),steps=Math.ceil(run/32);
   for(let i=1;i<=steps;i++){
    const t=run*i/steps/(length||1),flight=at({x:previous.x+dx*t,y:previous.y+dy*t});
    if(flight&&Math.abs(flight.axis==='y'?dy:dx)>1)return flight;
   }
   left-=run;if(left<=0)break;previous=end;
  }
 }
 function shouldWait(actor,people){
  if(at(actor)||actor._passingRemaining)return false;
  const flight=upcoming(actor);if(!flight)return false;
  const direction=sign(actor,flight);if(!direction)return false;
  const walkers=people.filter(other=>other!==actor&&!other.hidden&&!other.seated&&!other._held&&other.state==='walking'&&sign(other,flight));
  // Occupants finish first. At an empty flight the earliest resident starts
  // the next group; followers in that direction can use its other lanes.
  const occupants=walkers.filter(other=>at(other)===flight);
  const candidates=(occupants.length?occupants:[actor,...walkers.filter(other=>upcoming(other)===flight)]).sort((a,b)=>(a._index??Infinity)-(b._index??Infinity));
  return !!candidates.length&&sign(candidates[0],flight)!==direction;
 }
 return {reset,at,shouldWait,get size(){return flights.length;}};
}
