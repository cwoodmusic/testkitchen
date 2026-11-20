/** Pure, room-sized walking and tap-to-walk navigation. Coordinates are art pixels. */
const freeze=value=>{for(const item of Object.values(value))if(item&&typeof item==='object')freeze(item);return Object.freeze(value);};
export const DEPOT_ROOM=freeze({
 width:1536,height:1024,gridSize:32,radius:18,speed:260,maxDeltaMs:50,
 bounds:{x:48,y:250,width:1440,height:728},
 start:{x:768,y:920,facing:'up'},
 obstacles:[
  {id:'counter',x:80,y:345,width:255,height:30},
  {id:'nell',x:435,y:624,width:70,height:26},
  {id:'iris',x:755,y:524,width:70,height:26},
  {id:'pip',x:1055,y:654,width:70,height:26},
  {id:'depot-chest',x:270,y:500,width:115,height:27},
  {id:'route-orrery-base',x:105,y:790,width:135,height:95},
  {id:'orrery-parcels',x:245,y:850,width:95,height:35},
  {id:'orrery-planter',x:48,y:825,width:50,height:60},
  {id:'star-post-base',x:1300,y:820,width:160,height:65},
  {id:'kettle-cart',x:48,y:512,width:82,height:38},
  {id:'clipping-tray',x:1215,y:845,width:90,height:40},
  {id:'wall-parcels',x:1385,y:245,width:105,height:30}
 ],
 targets:[
  {id:'nell',type:'person',x:470,y:650,approach:{x:470,y:715},range:100},
  {id:'iris',type:'person',x:790,y:550,approach:{x:790,y:615},range:100},
  {id:'pip',type:'person',x:1090,y:680,approach:{x:1090,y:745},range:100},
  {id:'depot-chest',type:'chest',x:330,y:527,approach:{x:330,y:592},range:100},
  {id:'garden',type:'door',x:490,y:250,approach:{x:490,y:310},range:100},
  {id:'workshop',type:'door',x:884,y:250,approach:{x:884,y:310},range:100},
  {id:'canal',type:'door',x:1286,y:250,approach:{x:1286,y:310},range:100},
  {id:'final-route',type:'door',label:'Choose the town-link door',x:768,y:960,approach:{x:768,y:910},range:85},
  {id:'returned-letter',type:'inspect',label:'Inspect the returned letter',x:220,y:375,approach:{x:220,y:440},range:105},
  {id:'clockwork-roost',type:'inspect',label:'Inspect the mail bird',x:655,y:250,approach:{x:655,y:310},range:100},
  {id:'dispatch-map',type:'inspect',label:'Inspect the mail-route screen',x:1055,y:250,approach:{x:1055,y:310},range:100},
  {id:'route-orrery',type:'inspect',label:'Inspect the old route model',x:170,y:880,approach:{x:365,y:900},range:210},
  {id:'star-post',type:'inspect',label:'Inspect the mail signal receiver',x:1380,y:880,approach:{x:1190,y:800},range:220}
 ]
});

const EPS=.000001,FACINGS=new Set(['up','down','left','right']);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const point=value=>value&&finite(value.x)&&finite(value.y);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const copyPoint=value=>({x:value.x,y:value.y});
function checkedRoom(room){
 if(!room||!finite(room.width)||room.width<=0||!finite(room.height)||room.height<=0)throw TypeError('A room needs positive art dimensions.');
 const bounds=room.bounds;
 if(!bounds||!point(bounds)||!finite(bounds.width)||bounds.width<=0||!finite(bounds.height)||bounds.height<=0||bounds.x<0||bounds.y<0||bounds.x+bounds.width>room.width||bounds.y+bounds.height>room.height)throw TypeError('Invalid walkable room bounds.');
 if(!finite(room.radius)||room.radius<1||room.radius*2>=Math.min(bounds.width,bounds.height))throw TypeError('Invalid player foot radius.');
 if(!finite(room.gridSize)||room.gridSize<8||!finite(room.speed)||room.speed<=0||!finite(room.maxDeltaMs)||room.maxDeltaMs<1||room.maxDeltaMs>100)throw TypeError('Invalid room movement settings.');
 if(!point(room.start)||!Array.isArray(room.obstacles)||!Array.isArray(room.targets))throw TypeError('Missing room geometry.');
 for(const rect of room.obstacles)if(!point(rect)||!finite(rect.width)||rect.width<=0||!finite(rect.height)||rect.height<=0)throw TypeError('Invalid collision rectangle.');
 const ids=new Set();
 for(const target of room.targets){
  if(typeof target.id!=='string'||!target.id||ids.has(target.id)||!point(target)||!point(target.approach)||!finite(target.range)||target.range<=0)throw TypeError('Invalid room interaction target.');
  ids.add(target.id);
 }
 const columns=Math.floor((bounds.width-room.radius*2)/room.gridSize)+1,rows=Math.floor((bounds.height-room.radius*2)/room.gridSize)+1;
 if(columns*rows>100000)throw RangeError('Room navigation grid is too large.');
 return room;
}

/** A point is the center of the player's foot circle, not the sprite's top. */
export function isWalkable(room,at){
 if(!point(at))return false;
 const {bounds,radius}=room;
 if(at.x<bounds.x+radius-EPS||at.x>bounds.x+bounds.width-radius+EPS||at.y<bounds.y+radius-EPS||at.y>bounds.y+bounds.height-radius+EPS)return false;
 return !room.obstacles.some(rect=>{
  const x=clamp(at.x,rect.x,rect.x+rect.width),y=clamp(at.y,rect.y,rect.y+rect.height);
  return (at.x-x)**2+(at.y-y)**2<radius**2-EPS;
 });
}
function clearSegment(room,from,to){
 if(!isWalkable(room,from)||!isWalkable(room,to))return false;
 const dx=to.x-from.x,dy=to.y-from.y,lengthSquared=dx*dx+dy*dy;
 const pointToRect=(at,rect)=>(at.x-clamp(at.x,rect.x,rect.x+rect.width))**2+(at.y-clamp(at.y,rect.y,rect.y+rect.height))**2;
 const cornerToSegment=(x,y)=>{const progress=lengthSquared?clamp(((x-from.x)*dx+(y-from.y)*dy)/lengthSquared,0,1):0;return(x-from.x-progress*dx)**2+(y-from.y-progress*dy)**2;};
 return !room.obstacles.some(rect=>{
  // Slab intersection catches a segment crossing the rectangle's interior.
  let near=0,far=1,intersects=true;
  for(const [origin,direction,min,max]of [[from.x,dx,rect.x,rect.x+rect.width],[from.y,dy,rect.y,rect.y+rect.height]]){
   if(Math.abs(direction)<EPS){if(origin<min||origin>max){intersects=false;break;}}
   else{let a=(min-origin)/direction,b=(max-origin)/direction;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far){intersects=false;break;}}
  }
  if(intersects)return true;
  // Otherwise the minimum segment/rectangle distance occurs at a segment
  // endpoint or a rectangle corner. This is an exact swept-circle check,
  // including short corner grazes that fixed-distance samples can miss.
  return Math.min(pointToRect(from,rect),pointToRect(to,rect),cornerToSegment(rect.x,rect.y),cornerToSegment(rect.x+rect.width,rect.y),cornerToSegment(rect.x,rect.y+rect.height),cornerToSegment(rect.x+rect.width,rect.y+rect.height))<room.radius**2-EPS;
 });
}
const axisAligned=(from,to)=>Math.abs(from.x-to.x)<EPS||Math.abs(from.y-to.y)<EPS;
function cardinalLegs(room,from,to){
 if(axisAligned(from,to))return clearSegment(room,from,to)?distance(from,to)>EPS?[copyPoint(to)]:[]:null;
 // Spawn points, furniture approaches and authored waypoints need not share
 // the navigation grid. Connect them with a checked right-angle turn, too.
 for(const elbow of [{x:to.x,y:from.y},{x:from.x,y:to.y}]){
  if(clearSegment(room,from,elbow)&&clearSegment(room,elbow,to))return[elbow,copyPoint(to)];
 }
 return null;
}
function gridFor(room){
 const {bounds,radius,gridSize}=room,minX=bounds.x+radius,minY=bounds.y+radius;
 const columns=Math.floor((bounds.width-radius*2)/gridSize)+1,rows=Math.floor((bounds.height-radius*2)/gridSize)+1,nodes=[];
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const node={x:minX+col*gridSize,y:minY+row*gridSize,col,row,index:row*columns+col};
  nodes.push(isWalkable(room,node)?node:null);
 }
 return{nodes,columns,rows};
}
function nearestNode(room,nodes,at,{connected=false}={}){
 let nearest=null,best=Infinity;
 for(const node of nodes){if(!node)continue;const length=distance(node,at);if(length>=best||connected&&!cardinalLegs(room,at,node))continue;best=length;nearest=node;}
 return nearest;
}
function destinationFor(room,requested,nodes){
 const {bounds,radius}=room;
 const bounded={x:clamp(requested.x,bounds.x+radius,bounds.x+bounds.width-radius),y:clamp(requested.y,bounds.y+radius,bounds.y+bounds.height-radius)};
 return isWalkable(room,bounded)?bounded:nearestNode(room,nodes,bounded);
}

/**
 * Returns cardinal art-pixel waypoints excluding the start. Every leg follows
 * one horizontal or vertical axis. An outside/solid destination
 * is projected onto walkable floor. Invalid input or disconnected floor returns
 * null; an already reached destination returns an empty route.
 */
export function findPath(room,from,requested){
 checkedRoom(room);
 if(!point(from)||!point(requested)||!isWalkable(room,from))return null;
 const grid=gridFor(room),destination=destinationFor(room,requested,grid.nodes);
 if(!destination)return null;
 if(distance(from,destination)<EPS)return[];
 const direct=cardinalLegs(room,from,destination);if(direct)return direct;
 const first=nearestNode(room,grid.nodes,from,{connected:true}),last=nearestNode(room,grid.nodes,destination,{connected:true});
 if(!first||!last)return null;
 const estimate=(from,to)=>Math.abs(from.x-to.x)+Math.abs(from.y-to.y);
 const open=new Map([[first.index,{node:first,g:0,f:estimate(first,last)}]]),closed=new Set(),parents=new Map(),costs=new Map([[first.index,0]]);
 const directions=[[-1,0],[1,0],[0,-1],[0,1]];
 let reached=false;
 while(open.size){
  let current=null;for(const item of open.values())if(!current||item.f<current.f)current=item;
  open.delete(current.node.index);if(current.node.index===last.index){reached=true;break;}closed.add(current.node.index);
  for(const [dx,dy]of directions){
   const col=current.node.col+dx,row=current.node.row+dy;
   if(col<0||row<0||col>=grid.columns||row>=grid.rows)continue;
   const next=grid.nodes[row*grid.columns+col];
   if(!next||closed.has(next.index))continue;
   if(!clearSegment(room,current.node,next))continue;
   const g=current.g+distance(current.node,next);
   if(g>=(costs.get(next.index)??Infinity))continue;
   costs.set(next.index,g);parents.set(next.index,current.node.index);open.set(next.index,{node:next,g,f:g+estimate(next,last)});
  }
 }
 if(!reached)return null;
 const path=[];let at=last.index;
 while(at!==first.index){path.push(copyPoint(grid.nodes[at]));at=parents.get(at);}
 path.reverse();path.unshift(...cardinalLegs(room,from,first));path.push(...cardinalLegs(room,last,destination));
 // Remove unnecessary grid stops without cutting diagonally across a turn.
 // Every shortcut uses the same swept foot-circle check as keyboard movement.
 const smooth=[];let cursor=copyPoint(from),index=0;
 while(index<path.length){let furthest=index;for(let candidate=path.length-1;candidate>index;candidate--)if(axisAligned(cursor,path[candidate])&&clearSegment(room,cursor,path[candidate])){furthest=candidate;break;}const next=path[furthest];if(distance(cursor,next)>EPS)smooth.push(copyPoint(next));cursor=next;index=furthest+1;}
 return smooth;
}

export function createRoomWalker({room=DEPOT_ROOM,savedPosition=null}={}){
 const geometry=checkedRoom(structuredClone(room)),targets=new Map(geometry.targets.map(target=>[target.id,target]));
 const nodes=gridFor(geometry).nodes;
 const spawn=point(savedPosition)&&isWalkable(geometry,savedPosition)?savedPosition:isWalkable(geometry,geometry.start)?geometry.start:destinationFor(geometry,geometry.start,nodes);
 if(!spawn)throw RangeError('The room has no walkable floor.');
 let x=spawn.x,y=spawn.y,facing=FACINGS.has(spawn.facing)?spawn.facing:'up',moving=false,path=[],targetId=null;
 const signature=()=>JSON.stringify([x,y,facing,moving,path,targetId]);
 const face=(dx,dy)=>{if(Math.abs(dx)>=Math.abs(dy)&&dx)facing=dx>0?'right':'left';else if(dy)facing=dy>0?'down':'up';};
 const delta=elapsedMs=>finite(elapsedMs)?clamp(elapsedMs,0,geometry.maxDeltaMs):0;
 function step(dx,dy){
  const original={x,y},steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.min(8,geometry.radius/2)));
  for(let n=0;n<steps;n++){
   const partX=dx/steps,partY=dy/steps;
   if(isWalkable(geometry,{x:x+partX,y:y+partY})){x+=partX;y+=partY;}
   else{if(isWalkable(geometry,{x:x+partX,y}))x+=partX;if(isWalkable(geometry,{x,y:y+partY}))y+=partY;}
  }
  const traveled=distance(original,{x,y});if(traveled>EPS)face(x-original.x,y-original.y);return traveled;
 }
 function move(dx,dy,elapsedMs){
  if(!finite(dx)||!finite(dy))return false;
  const before=signature();path=[];targetId=null;
  // Keyboard and directional-pad movement always use one axis. In a tie,
  // preserve the current facing axis rather than alternating between them.
  if(dx&&dy){if(Math.abs(dx)>Math.abs(dy)||Math.abs(dx)===Math.abs(dy)&&(facing==='left'||facing==='right'))dy=0;else dx=0;}
  const length=Math.hypot(dx,dy),duration=delta(elapsedMs);
  if(!length||!duration){moving=false;return signature()!==before;}
  const scale=geometry.speed*duration/1000/Math.max(1,length);face(dx,dy);moving=step(dx*scale,dy*scale)>EPS;
  return signature()!==before;
 }
 function goTo(requested){
  if(!point(requested))return false;
  const next=findPath(geometry,{x,y},requested);if(!next)return false;
  path=next;targetId=null;moving=path.length>0;return true;
 }
 function withinReach(id){const target=targets.get(id);return!!target&&distance({x,y},target)<=target.range+EPS;}
 function approach(id){
  const target=targets.get(id);if(!target)return false;
  if(withinReach(id)){path=[];moving=false;targetId=id;return true;}
  if(!goTo(target.approach))return false;targetId=id;return true;
 }
 function nearbyTarget(){
  let closest=null,best=Infinity;
  for(const target of targets.values()){const length=distance({x,y},target);if(length<=target.range+EPS&&length<best){closest=target;best=length;}}
  return closest?structuredClone(closest):null;
 }
 function update(elapsedMs){
  const before=signature();let remaining=geometry.speed*delta(elapsedMs)/1000;
  if(!path.length){moving=false;return signature()!==before;}
  let traveled=0;
  while(path.length&&remaining>EPS){
   const next=path[0],length=distance({x,y},next);
   if(length<EPS){path.shift();continue;}
   const amount=Math.min(length,remaining),walked=step((next.x-x)/length*amount,(next.y-y)/length*amount);
   traveled+=walked;remaining-=amount;
   if(walked<amount-EPS){path=[];break;}
   if(distance({x,y},next)<EPS){x=next.x;y=next.y;path.shift();}
  }
  moving=traveled>EPS&&path.length>0;return signature()!==before;
 }
 function stop(){const changed=moving||path.length>0||targetId!==null;path=[];targetId=null;moving=false;return!!changed;}
 return Object.freeze({
  get state(){return{x,y,facing,moving,targetId,destination:path.length?copyPoint(path.at(-1)):null,waypoint:path.length?copyPoint(path[0]):null};},
  move,goTo,approach,update,stop,withinReach,nearbyTarget
 });
}
