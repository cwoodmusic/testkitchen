const EPSILON=1e-6;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const point=p=>({x:p.x,y:p.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}

function compact(points,from){
 const result=[];
 for(const p of points){
  const last=result.at(-1)||from;if(distance(last,p)<EPSILON)continue;
  const previous=result.length>1?result.at(-2):from;
  const collinear=Math.abs((last.x-previous.x)*(p.y-last.y)-(last.y-previous.y)*(p.x-last.x))<EPSILON;
  if(result.length&&collinear){
   const continuing=(last.x-previous.x)*(p.x-last.x)+(last.y-previous.y)*(p.y-last.y)>=0;
   const returningAlongSameSegment=(p.x-previous.x)*(p.x-last.x)+(p.y-previous.y)*(p.y-last.y)<=EPSILON;
   if(continuing||returningAlongSameSegment)result.pop();
  }
  result.push(point(p));
 }
 return result;
}

// Rejoin the actual route after the blocked corner, rather than immediately
// aiming back at the same occupied waypoint after a one-frame side step.
function rejoinAfter(actor,path,heading,travel){
 let previous=heading.x?{x:actor.x,y:path[0].y}:{x:path[0].x,y:actor.y};
 for(let i=0;i<path.length;i++){
  const next=path[i],length=distance(previous,next);
  if(length<EPSILON){previous=next;continue;}
  if(travel<=length){
   const t=travel/length,rejoin={x:previous.x+(next.x-previous.x)*t,y:previous.y+(next.y-previous.y)*t};
   // Original A* waypoints are orthogonal. If an actor has drifted from its
   // old line, the normalized first segment above puts it back on that line.
   if(Math.abs(rejoin.x-next.x)>EPSILON&&Math.abs(rejoin.y-next.y)>EPSILON)return null;
   return {point:rejoin,remaining:distance(rejoin,next)<EPSILON?path.slice(i+1):path.slice(i),consumed:i+(distance(rejoin,next)<EPSILON?1:0)};
  }
  travel-=length;previous=next;
 }
 return {point:point(path.at(-1)),remaining:[],consumed:path.length};
}

function crowdClear(a,b,people,clearance,first){
 for(const person of people){
  const radius=Number.isFinite(person.clearance)?Math.max(clearance,person.clearance):clearance,start=distance(a,person);
  if(first&&start<radius){
   // A pedestrian already inside personal space may move out of it, but the
   // escape step must never first move closer to that person.
   if((a.x-person.x)*(b.x-a.x)+(a.y-person.y)*(b.y-a.y)<-EPSILON||distance(b,person)<radius-EPSILON)return false;
  }else if(segmentDistance(person,a,b)<radius-EPSILON)return false;
 }
 return true;
}

function orthogonalJoins(a,b){
 if(Math.abs(a.x-b.x)<EPSILON||Math.abs(a.y-b.y)<EPSILON)return [[b]];
 return [[{x:b.x,y:a.y},b],[{x:a.x,y:b.y},b]];
}

/**
 * Plan one committed, local walk around another pedestrian. The returned
 * complete route replaces actor._path; callers should follow its waypoints
 * rather than recomputing a perpendicular side step on every frame.
 * No authored map, actor, original path or other pedestrian is mutated.
 */
export function planNPCPassing({actor,path,obstacle,others=[],connectionClear,inside=()=>true,clearance=56}={}){
 if(!finite(actor)||!finite(obstacle)||!Array.isArray(path)||!path.length||!path.every(finite)||typeof connectionClear!=='function'||!Number.isFinite(clearance)||clearance<=0)return null;
 path=path.filter(p=>distance(actor,p)>EPSILON);if(!path.length)return null;
 if(path.some((p,i)=>i>0&&Math.abs(p.x-path[i-1].x)>EPSILON&&Math.abs(p.y-path[i-1].y)>EPSILON))return null;
 const target=path[0],dx=target.x-actor.x,dy=target.y-actor.y;
 const heading=Math.abs(dx)>=Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
 if(!heading.x&&!heading.y)return null;
 const forward=(obstacle.x-actor.x)*heading.x+(obstacle.y-actor.y)*heading.y;
 if(forward<-clearance)return null;
 const perpendicular={x:-heading.y,y:heading.x},people=[];
 for(const other of [obstacle,...others]){
  if(!finite(other)||other===actor||other.hidden||actor.id!==undefined&&other.id===actor.id)continue;
  if(people.some(p=>other.id!==undefined&&p.id===other.id||p.x===other.x&&p.y===other.y))continue;
  people.push(other);
 }
 if(people.some(p=>distance(path.at(-1),p)<clearance-EPSILON))return null;
 const firstTravel=Math.max(120,forward+clearance+32),travels=[firstTravel,Math.max(184,firstTravel+48)];
 const offsets=[Math.max(64,clearance+8),Math.max(80,clearance+24),Math.max(96,clearance+40)];
 const preferred=actor.passingSide===-1?-1:1;
 // Keep the usual generous passing lane when it fits. A pedestrian already
 // offset from ours may need much less lateral travel: demanding another
 // sixty-four pixels can put that lane through a nearby lamp or bench.
 const lateral=(obstacle.x-actor.x)*perpendicular.x+(obstacle.y-actor.y)*perpendicular.y;
 for(const narrow of [false,true])for(const travel of travels){
  const rejoin=rejoinAfter(actor,path,heading,travel);if(!rejoin)continue;
  // An occupied destination is not a passing maneuver. Its owner must leave
  // or the higher-level entrance/seat reservation must choose another slot.
  if(people.some(p=>distance(rejoin.point,p)<clearance-EPSILON))continue;
  for(const retreat of [0,48,96])for(const side of [preferred,-preferred]){
   const minimum=Math.max(16,clearance+8+lateral*side);
   if(narrow&&minimum>=offsets[0]-EPSILON)continue;
   for(const offset of narrow?[minimum]:offsets){
   const pocket={x:actor.x-heading.x*retreat,y:actor.y-heading.y*retreat};
   const start={x:pocket.x+perpendicular.x*offset*side,y:pocket.y+perpendicular.y*offset*side};
   const end={x:rejoin.point.x+perpendicular.x*offset*side,y:rejoin.point.y+perpendicular.y*offset*side};
   for(const middle of orthogonalJoins(start,end)){
    const bypass=compact([...(retreat?[pocket]:[]),start,...middle,rejoin.point],actor);
    let previous=actor,valid=true;
    for(let i=0;i<bypass.length;i++){
     const next=bypass[i];
     if(!inside(next)||!connectionClear(previous,next)||!crowdClear(previous,next,people,clearance,i===0)){valid=false;break;}
     previous=next;
    }
    if(!valid)continue;
    // Keep the rejoin point explicit so the caller can count down these
    // committed bypass waypoints before permitting another passing decision.
    const complete=[...bypass.map(point),...rejoin.remaining.map(point)];
    return {path:complete,rejoin:point(rejoin.point),bypassWaypoints:bypass,bypassCount:bypass.length,consumedWaypoints:rejoin.consumed,side,offset,retreat,clearance};
   }
  }
  }
 }
 return null;
}
