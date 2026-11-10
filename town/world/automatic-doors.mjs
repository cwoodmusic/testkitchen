const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const normals={down:{x:0,y:-1},up:{x:0,y:1},left:{x:1,y:0},right:{x:-1,y:0}};
export const AUTO_DOOR_OPEN_DISTANCE=190,AUTO_DOOR_CLOSE_DISTANCE=76;

export function doorOpening(door){
 if(door.axis==='vertical'&&Number.isFinite(door.length))return {x:door.x,y:door.y+door.length/2,nx:1,ny:0,half:door.length/2,privacy:!!door.roomId||door.privacy===true};
 if(door.axis==='horizontal'&&Number.isFinite(door.length))return {x:door.x+door.length/2,y:door.y,nx:0,ny:1,half:door.length/2,privacy:!!door.roomId};
 const normal=door.enterNormal||normals[door.facing]||normals.down,at=door.threshold||{x:door.x,y:door.floorY??door.y+door.h};
 const length=Math.hypot(normal.x,normal.y)||1;
 return {x:at.x,y:at.y,nx:normal.x/length,ny:normal.y/length,half:door.triggerHalfWidth??(door.length/2||door.w/2||70),privacy:!!door.roomId};
}
function openingDistanceSquaredAt(opening,x,y){
 const dx=x-opening.x,dy=y-opening.y,normal=dx*opening.nx+dy*opening.ny,along=-dx*opening.ny+dy*opening.nx,beyond=Math.max(0,Math.abs(along)-opening.half);
 return normal*normal+beyond*beyond;
}

// Door state is local to the active scene. Opening starts well before a
// running character reaches a leaf; every nearby actor holds the opening.
export function createAutomaticDoors(definitions=[],{canOpen=()=>true,openDistance=AUTO_DOOR_OPEN_DISTANCE,closeDistance=AUTO_DOOR_CLOSE_DISTANCE,openSeconds=.2,closeSeconds=.28,holdSeconds=.55}={}){
 const motions=new Map(),playerKey=Symbol('player'),guest={id:'__player__'};let updateIndex=0,currentPlayer=null;
 const states=definitions.map((door,index)=>({id:door.id||door.showroomId||'door-'+index,door,opening:doorOpening(door),openness:0,target:0,occupied:false,clearTime:0})),byDoor=new WeakMap(),byId=new Map();
 for(const state of states){byDoor.set(state.door,state);byId.set(state.id,state);}
 const openness=door=>typeof door==='string'?byId.get(door)?.openness||0:byDoor.get(door)?.openness||0;
 function remember(actor,isPlayer,dt){
  if(!finitePoint(actor)||actor.hidden)return;const key=isPlayer?playerKey:actor.id||actor;
  let motion=motions.get(key);
  if(!motion){motion={x:actor.x,y:actor.y,vx:0,vy:0,seen:updateIndex};motions.set(key,motion);}
  else{motion.vx=dt?(actor.x-motion.x)/dt:0;motion.vy=dt?(actor.y-motion.y)/dt:0;motion.x=actor.x;motion.y=actor.y;motion.seen=updateIndex;}
 }
 function request(opening,actor,isPlayer){
  const distance=openingDistanceSquaredAt(opening,actor.x,actor.y);if(distance<=70*70)return true;
  if(distance>openDistance*openDistance)return false;
  const motion=motions.get(isPlayer?playerKey:actor.id||actor);if(!motion)return false;
  const dx=actor.x-opening.x,dy=actor.y-opening.y,normal=dx*opening.nx+dy*opening.ny,vn=motion.vx*opening.nx+motion.vy*opening.ny;
  if(normal*vn>=-1)return false;
  const time=-normal/vn,along=-dx*opening.ny+dy*opening.nx,vt=-motion.vx*opening.ny+motion.vy*opening.nx;
  return time>=0&&Math.abs(along+vt*time)<=opening.half+24;
 }
 function update(dt,player,actors=[]){
  dt=clamp(Number(dt)||0,0,.1);currentPlayer=player||null;updateIndex++;remember(player,true,dt);for(const actor of actors)remember(actor,false,dt);
  for(const [key,motion]of motions)if(motion.seen!==updateIndex)motions.delete(key);
  for(const state of states){
   let near=false,occupied=false;
   if(finitePoint(player)&&canOpen(state.door,player,true)){
    const distance=openingDistanceSquaredAt(state.opening,player.x,player.y);near=request(state.opening,player,true);occupied=distance<=closeDistance*closeDistance;
   }
   for(const actor of actors){
    if(!finitePoint(actor)||actor.hidden||!canOpen(state.door,actor,false))continue;
    const distance=openingDistanceSquaredAt(state.opening,actor.x,actor.y);if(request(state.opening,actor,false))near=true;if(distance<=closeDistance*closeDistance)occupied=true;
   }
   state.occupied=occupied;
   if(near||occupied&&state.target){state.target=1;state.clearTime=0;}
   else if(state.target){state.clearTime+=dt;if(state.clearTime>=holdSeconds)state.target=0;}
   if(state.target)state.openness=Math.min(1,state.openness+dt/openSeconds);
   else state.openness=Math.max(0,state.openness-dt/closeSeconds);
   if(state.openness>1-1e-9)state.openness=1;else if(state.openness<1e-9)state.openness=0;
  }
 }
 function prime(player,actors=[]){update(0,player,actors);for(const state of states)if(state.target)state.openness=1;}
 function blocked(x,y,pad=16,actor=currentPlayer||guest,isPlayer=true){
  for(const state of states){if(openingDistanceSquaredAt(state.opening,x,y)>(pad+5)*(pad+5))continue;if(!canOpen(state.door,actor,isPlayer)||state.openness<.7)return true;}
  return false;
 }
 return {states,update,prime,blocked,openness};
}

// Scene-changing doorways need a directional approach, not merely proximity.
// New arrivals remain latched until they step clear, preventing held-key loops.
export function createAutomaticPortalGate({cooldownSeconds=.45,arrivalClearance=32}={}){
 let cooldown=0,arrival=null;
 function arrive(point){cooldown=cooldownSeconds;arrival=finitePoint(point)?{x:point.x,y:point.y}:null;}
 function update(dt,point,intent,portals=[]){
  cooldown=Math.max(0,cooldown-clamp(Number(dt)||0,0,.1));
  if(!finitePoint(point)||!finitePoint(intent)||Math.hypot(intent.x,intent.y)<.1)return null;
  if(arrival&&Math.hypot(point.x-arrival.x,point.y-arrival.y)>arrivalClearance)arrival=null;
  if(cooldown||arrival)return null;
  let found=null,best=Infinity;
  for(const portal of portals){
   if(portal.disabled||typeof portal.allowed==='function'&&!portal.allowed()||portal.allowed===false)continue;
   const {threshold,enterNormal}=portal;if(!finitePoint(threshold)||!finitePoint(enterNormal))continue;
   const length=Math.hypot(enterNormal.x,enterNormal.y)||1,nx=enterNormal.x/length,ny=enterNormal.y/length;
   if(intent.x*nx+intent.y*ny<=.25)continue;
   const dx=point.x-threshold.x,dy=point.y-threshold.y,normal=dx*nx+dy*ny,tangent=Math.abs(-dx*ny+dy*nx),half=Math.max(16,(portal.triggerHalfWidth||70)-16);
   if(normal<-(portal.approachDistance||64)||normal>24||tangent>half)continue;
   const score=Math.abs(normal)+tangent;if(score<best){found=portal;best=score;}
  }
  return found;
 }
 return {arrive,update,get cooldown(){return cooldown;},get arrival(){return arrival;}};
}
