/** Deterministic doorway arrivals. This transport never changes game resources. */
import {createRoomWalker,findPath,isWalkable} from './room.mjs';

const EPS=.000001,PARTY=['mira','nell','iris','pip'],FACINGS=new Set(['up','down','left','right']);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const point=value=>value&&finite(value.x)&&finite(value.y);
const copy=value=>({x:value.x,y:value.y});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const integer=(value,fallback,min,max)=>Number.isSafeInteger(value)?clamp(value,min,max):fallback;
const face=(from,to,fallback='up')=>Math.abs(to.x-from.x)>=Math.abs(to.y-from.y)&&to.x!==from.x?(to.x>from.x?'right':'left'):to.y!==from.y?(to.y>from.y?'down':'up'):fallback;
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function cleanPose(value){return{id:value.id,x:value.x,y:value.y,facing:FACINGS.has(value.facing)?value.facing:'down',moving:false,action:null,target:null,emote:null};}

// Exact swept-circle clearance for a horizontal or vertical leg. The outside
// doorway corridor deliberately omits floor bounds, while still avoiding props.
function clearAxis(room,from,to,{outside=false}={}){
 if(Math.abs(from.x-to.x)>EPS&&Math.abs(from.y-to.y)>EPS)return false;
 if(!outside&&(!isWalkable(room,from)||!isWalkable(room,to)))return false;
 const minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),minY=Math.min(from.y,to.y),maxY=Math.max(from.y,to.y);
 return !room.obstacles.some(rect=>{
  const dx=Math.max(rect.x-maxX,minX-rect.x-rect.width,0),dy=Math.max(rect.y-maxY,minY-rect.y-rect.height,0);
  return dx*dx+dy*dy<room.radius*room.radius-EPS;
 });
}
function legs(room,from,to){
 if(Math.abs(from.x-to.x)<EPS||Math.abs(from.y-to.y)<EPS)return clearAxis(room,from,to)?[copy(to)]:null;
 for(const elbow of [{x:to.x,y:from.y},{x:from.x,y:to.y}])if(clearAxis(room,from,elbow)&&clearAxis(room,elbow,to))return[elbow,copy(to)];
 return null;
}

// A valid custom destination can lie across a newly edited wall. In that case
// choose the nearest point in the entrance's actual navigation component,
// rather than returning a point on unreachable floor or dropping the character.
function reachableProjection(room,from,requested){
 const direct=findPath(room,from,requested);
 if(direct)return{path:direct,to:copy(direct.at(-1)??from)};
 const {bounds,radius,gridSize}=room,minX=bounds.x+radius,minY=bounds.y+radius;
 const columns=Math.floor((bounds.width-radius*2)/gridSize)+1,rows=Math.floor((bounds.height-radius*2)/gridSize)+1,nodes=[];
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const at={x:minX+col*gridSize,y:minY+row*gridSize};nodes.push(isWalkable(room,at)?at:null);
 }
 let start=-1,best=Infinity;
 for(const [index,node]of nodes.entries())if(node&&distance(node,from)<best&&legs(room,from,node)){start=index;best=distance(node,from);}
 if(start<0)return{path:[],to:copy(from)};
 const queue=[start],seen=new Set(queue);
 for(let cursor=0;cursor<queue.length;cursor++){
  const index=queue[cursor],col=index%columns,row=Math.floor(index/columns);
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
   const x=col+dx,y=row+dy,next=y*columns+x;
   if(x<0||y<0||x>=columns||y>=rows||seen.has(next)||!nodes[next]||!clearAxis(room,nodes[index],nodes[next]))continue;
   seen.add(next);queue.push(next);
  }
 }
 const candidates=queue.map(index=>nodes[index]).sort((a,b)=>distance(a,requested)-distance(b,requested));
 for(const candidate of candidates){const path=findPath(room,from,candidate);if(path)return{path,to:copy(path.at(-1)??from)};}
 return{path:[],to:copy(from)};
}
function mouthFor(room,x,depth,halfWidth){
 const {bounds,radius}=room,y=bounds.y+bounds.height-radius,min=bounds.x+radius,max=bounds.x+bounds.width-radius;
 const center=clamp(x,min,max),step=Math.max(1,radius/2),candidates=[center];
 for(let offset=step;offset<=halfWidth+EPS;offset+=step)candidates.push(clamp(center-offset,min,max),clamp(center+offset,min,max));
 return candidates.map(x=>({x,y})).find(at=>isWalkable(room,at)&&clearAxis(room,{x:at.x,y:depth},at,{outside:true}))??null;
}
function footprint(scene,pose,{playerRadius=scene.geometry.radius}={}){
 if(pose.id==='mira')return{id:'entry-mira',x:pose.x-playerRadius,y:pose.y-playerRadius,width:playerRadius*2,height:playerRadius*2};
 const actor=scene.actors.find(item=>item.id===pose.id),original=scene.geometry.obstacles.find(item=>item.id===pose.id);
 return original?{...original,id:`entry-${pose.id}`,x:original.x+pose.x-actor.feet.x,y:original.y+pose.y-actor.feet.y}:{id:`entry-${pose.id}`,x:pose.x-35,y:pose.y-26,width:70,height:26};
}
function standingRoom(scene,physical,reserved,current){
 const obstacles=reserved.map(pose=>{
  if(pose.id!=='mira'||current==='mira')return footprint(scene,pose);
  // Landing a whole NPC rectangle over Mira would trap the player even when
  // the NPC's center alone was clear. Match normal cutscene end reservation.
  const actor=scene.actors.find(item=>item.id===current),source=scene.geometry.obstacles.find(item=>item.id===current);
  const foot=source?{x:source.x-actor.feet.x,y:source.y-actor.feet.y,width:source.width,height:source.height}:{x:-35,y:-26,width:70,height:26};
  return{id:'entry-mira-end',x:pose.x-foot.x-foot.width,y:pose.y-foot.y-foot.height,width:foot.width,height:foot.height};
 });
 return{...physical,obstacles:[...physical.obstacles,...obstacles]};
}
function roomOrigin(room,preferred){
 const walker=createRoomWalker({room,savedPosition:preferred});return copy(walker.state);
}

/** Plan a party file through the south doorway, before authored story tile 0. */
export function compileRoomEntry({scene,playerPosition=null,playerSize=160}={}){
 const geometry=scene?.geometry;
 if(!geometry||!finite(geometry.gridSize)||geometry.gridSize<=0||!finite(geometry.speed)||geometry.speed<=0)throw new TypeError('Room entry needs valid walking geometry.');
 const config=scene.entry??{},quantumMs=geometry.gridSize/geometry.speed*1000;
 const fadeTiles=integer(config.fadeTiles,12,0,128),staggerTiles=integer(config.staggerTiles,2,0,64),enabled=config.enabled!==false;
 const cast=(scene.actors??[]).filter(actor=>typeof actor?.id==='string'&&point(actor.feet));
 const party=PARTY.filter(id=>id==='mira'||cast.some(actor=>actor.id===id)),travellers=new Set(party);
 const physical={...structuredClone(geometry),obstacles:geometry.obstacles.filter(obstacle=>!travellers.has(obstacle.id)).map(item=>({...item}))};
 for(const resident of cast.filter(actor=>!travellers.has(actor.id)))if(!physical.obstacles.some(obstacle=>obstacle.id===resident.id))physical.obstacles.push({id:resident.id,x:resident.feet.x-35,y:resident.feet.y-26,width:70,height:26});
 const sourcePlayer=point(playerPosition)?playerPosition:geometry.start;
 const authored=[...cast.map(actor=>({id:actor.id,...copy(actor.feet),facing:FACINGS.has(actor.facing)?actor.facing:'down'})),{id:'mira',...copy(sourcePlayer),facing:FACINGS.has(sourcePlayer.facing)?sourcePlayer.facing:'up'}];
 const returnTarget=geometry.targets.find(target=>target.type==='return'),returnObject=scene.objects?.find(object=>object.type==='return');
 const inferredX=returnTarget?.x??geometry.start.x,doorX=finite(config.doorX)?config.doorX:inferredX;
 const maxSize=Math.max(finite(playerSize)&&playerSize>0?playerSize:160,...cast.filter(actor=>travellers.has(actor.id)).map(actor=>finite(actor.worldSize)?actor.worldSize:160));
 const outsideY=geometry.height+maxSize,halfWidth=Math.max(geometry.radius,((returnObject?.rect.width??176)/2)-geometry.radius);
 const baseMouth=mouthFor(physical,doorX,outsideY,halfWidth),origin=baseMouth??roomOrigin(physical,sourcePlayer),endById=new Map(),reserved=[];
 let crowded=false;
 try{
  for(const id of party){
   const raw=authored.find(actor=>actor.id===id),room=standingRoom(scene,physical,reserved,id),safeOrigin=roomOrigin(room,origin);
   const projected=reachableProjection(room,safeOrigin,raw),pose=cleanPose({id,...projected.to,facing:raw.facing});
   endById.set(id,pose);reserved.push(pose);
  }
 }catch(error){
  if(!(error instanceof RangeError))throw error;
  // A tiny edited floor may fit the existing player but not four new actor
  // reservations. Keep the existing playable arrangement and just fade it in;
  // an optional cinematic must not make a previously valid project unopenable.
  crowded=true;const player=roomOrigin(geometry,sourcePlayer);
  for(const raw of authored)endById.set(raw.id,cleanPose(raw.id==='mira'?{...raw,...player}:raw));
 }
 for(const raw of authored)if(!travellers.has(raw.id))endById.set(raw.id,cleanPose(raw));
 const endActors=authored.map(actor=>endById.get(actor.id)),clips=[],initialById=new Map(endActors.map(actor=>[actor.id,actor]));
 let blocked=!baseMouth||crowded;
 if(enabled&&!blocked)for(const [index,id]of party.entries()){
  const others=endActors.filter(actor=>actor.id!==id&&travellers.has(actor.id));
  const room={...physical,obstacles:[...physical.obstacles,...others.map(actor=>footprint(scene,actor))]};
  const mouth=mouthFor(room,doorX,outsideY,halfWidth);
  if(!mouth){blocked=true;break;}
  const landing=endById.get(id),route=findPath(room,mouth,landing);
  if(!route||distance(route.at(-1)??mouth,landing)>EPS){blocked=true;break;}
  const from={x:mouth.x,y:outsideY},path=[from,copy(mouth)];
  for(const vertex of route)if(distance(path.at(-1),vertex)>EPS)path.push(copy(vertex));
  const length=path.slice(1).reduce((sum,at,i)=>sum+distance(path[i],at),0),durationTiles=Math.max(1,Math.ceil((length-EPS)/geometry.gridSize)),startTile=index*staggerTiles;
  const arrivalFacing=path.slice(1).reduce((heading,at,i)=>distance(path[i],at)>EPS?face(path[i],at,heading):heading,'up');
  clips.push({id:`room-entry-${id}`,actor:id,kind:'walk',startTile,durationTiles,endTile:startTile+durationTiles,pathLength:length,path,from,to:copy(landing),mouth:copy(mouth),facing:arrivalFacing});
  initialById.set(id,cleanPose({id,...from,facing:'up'}));
 }
 if(!enabled||blocked){clips.length=0;for(const actor of endActors)initialById.set(actor.id,actor);}
 else for(const clip of clips){
  // Carry the actual arrival heading into the story. The standing portrait's
  // authored facing used to turn everyone south for a frame between walks.
  endById.get(clip.actor).facing=clip.facing;
 }
 const totalTiles=enabled?Math.max(fadeTiles,...clips.map(clip=>clip.endTile)):0;
 return freeze({enabled,blocked,quantumMs,gridSize:geometry.gridSize,speed:geometry.speed,fadeTiles:enabled?fadeTiles:0,staggerTiles,totalTiles,door:{x:baseMouth?.x??clamp(doorX,geometry.bounds.x+geometry.radius,geometry.bounds.x+geometry.bounds.width-geometry.radius),y:geometry.height},mouth:baseMouth?copy(baseMouth):null,actors:authored.map(actor=>initialById.get(actor.id)),endActors,clips});
}

function poseAt(initial,clip,tile,gridSize){
 if(!clip||tile<clip.startTile)return cleanPose(initial);
 let remaining=Math.min(clip.pathLength,Math.max(0,tile-clip.startTile)*gridSize),facing='up';
 for(let index=1;index<clip.path.length;index++){
  const from=clip.path[index-1],to=clip.path[index],length=distance(from,to);if(length<EPS)continue;
  facing=face(from,to,facing);
  if(remaining<length-EPS){const ratio=remaining/length;return{...cleanPose(initial),x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio,facing,moving:true};}
  remaining-=length;
 }
 return{...cleanPose(initial),...clip.to,facing:clip.facing,moving:false};
}

/** A paused/scrubbable prelude; all time is measured in the room's walk tiles. */
export function createRoomEntry(options={}){
 const timeline=compileRoomEntry(options);let currentTile=0,playing=timeline.totalTiles>0,cached=null;
 const finished=()=>currentTile>=timeline.totalTiles;
 const invalidate=()=>{cached=null;};
 function snapshot(){
  if(cached)return cached;
  const done=finished(),actors=done?timeline.endActors:timeline.actors.map(actor=>poseAt(actor,timeline.clips.find(clip=>clip.actor===actor.id),currentTile,timeline.gridSize));
  const activeClips=done?[]:timeline.clips.filter(clip=>clip.startTile<=currentTile&&currentTile<clip.endTile);
  return cached=freeze({phase:'entry',actors,focus:{x:timeline.door.x,y:timeline.mouth?.y??options.scene.geometry.start.y},elapsed:currentTile*timeline.quantumMs,currentTile,totalTiles:timeline.totalTiles,quantumMs:timeline.quantumMs,fadeOpacity:done||!timeline.fadeTiles?0:clamp(1-currentTile/timeline.fadeTiles,0,1),finished:done,playing,holding:!done&&!actors.some(actor=>actor.moving),beat:null,index:-1,nextPending:false,activeClips,activeClipIds:activeClips.map(clip=>clip.id)});
 }
 function update(deltaMs){if(!playing||finished()||!finite(deltaMs)||deltaMs<=0)return false;currentTile=Math.min(timeline.totalTiles,currentTile+Math.min(100,deltaMs)/timeline.quantumMs);if(finished())playing=false;invalidate();return true;}
 function pause(){if(!playing)return false;playing=false;invalidate();return true;}
 function play(){if(!timeline.totalTiles)return false;if(finished()){currentTile=0;invalidate();}if(playing)return false;playing=true;invalidate();return true;}
 function seek(tile){if(!finite(tile))return false;const next=clamp(tile,0,timeline.totalTiles),changed=next!==currentTile;currentTile=next;if(finished())playing=false;if(changed)invalidate();return changed;}
 function skip(){if(finished())return false;currentTile=timeline.totalTiles;playing=false;invalidate();return true;}
 return Object.freeze({timeline,get state(){return snapshot();},update,pause,play,seek,skip});
}
