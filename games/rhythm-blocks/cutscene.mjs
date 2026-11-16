/** Pure, scrubbable room-opening performances. Never changes game resources. */
import {findPath,isWalkable} from './room.mjs';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const point=value=>value&&finite(value.x)&&finite(value.y);
const clone=value=>structuredClone(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function freeze(value,seen=new WeakSet()){
 if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);Object.values(value).forEach(item=>freeze(item,seen));Object.freeze(value);}
 return value;
}
const actions=new Set(['examine','search','listen','look']);
const faceIds=new Set(['up','down','left','right']);
function facing(from,to,fallback='down'){
 const dx=to.x-from.x,dy=to.y-from.y;
 return Math.abs(dx)>=Math.abs(dy)&&dx?(dx>0?'right':'left'):dy?(dy>0?'down':'up'):fallback;
}
const nonnegativeInteger=value=>Number.isSafeInteger(value)&&value>=0;
const positiveInteger=value=>Number.isSafeInteger(value)&&value>=1;
const pathLength=path=>path.slice(1).reduce((sum,at,index)=>sum+distance(path[index],at),0);

function initialActors(scene,playerPosition,overrides){
 const cast=new Map();
 for(const actor of scene.actors??[]){
  if(typeof actor?.id!=='string'||!point(actor.feet))continue;
  cast.set(actor.id,{id:actor.id,x:actor.feet.x,y:actor.feet.y,facing:faceIds.has(actor.facing)?actor.facing:'down'});
 }
 const start=point(playerPosition)?playerPosition:scene.geometry.start;
 if(point(start))cast.set('mira',{id:'mira',x:start.x,y:start.y,facing:faceIds.has(start.facing)?start.facing:'up'});
 const supplied=Array.isArray(overrides)?overrides:Object.entries(overrides??{}).map(([id,value])=>({id,...value}));
 for(const override of supplied){
  const actor=cast.get(override?.id),feet=override?.feet??override;
  if(actor&&point(feet)){actor.x=feet.x;actor.y=feet.y;if(faceIds.has(override.facing))actor.facing=override.facing;}
 }
 return [...cast.values()];
}
function atDistance(path,amount,initialFacing){
 let remaining=amount,lastFacing=initialFacing;
 for(let i=1;i<path.length;i++){
  const from=path[i-1],to=path[i],length=distance(from,to);
  if(length<.000001)continue;
  lastFacing=facing(from,to,lastFacing);
  if(remaining<length){const ratio=Math.max(0,remaining)/length;return{x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio,facing:lastFacing};}
  remaining-=length;
 }
 return{...path.at(-1),facing:lastFacing};
}
function poseAt(initial,clips,tile,gridSize,reducedMotion=false){
 let pose={...initial,moving:false,action:null,target:null,emote:null};
 for(const clip of clips){
  if(clip.actor!==initial.id||tile<clip.startTile)continue;
  const active=tile<clip.endTile,progress=reducedMotion?clip.pathLength:Math.min(clip.pathLength,(tile-clip.startTile)*gridSize);
  const at=atDistance(clip.path,progress,clip.from.facing);
  const arrived=progress>=clip.pathLength-.000001;
  pose={id:initial.id,...at,facing:arrived&&clip.lookAt?facing(at,clip.lookAt,at.facing):at.facing,moving:active&&!arrived,action:active?clip.action??'look':null,target:active?clip.target??null:null,emote:active?clip.emote??null:null};
 }
 return pose;
}

/**
 * Compile room-foot paths into integer walk-tile clips. One time tile is exactly
 * the time needed to walk one navigation tile at the room's authored speed.
 * Explicit duration may be short, but can never make movement exceed that speed.
 * Four legacy untimed beats remain sequential with comfortable reading holds.
 */
export function compileRoomCutscene({scene,beats=[],playerPosition=null,actors=null}={}){
 const geometry=scene?.geometry;
 if(!geometry||!finite(geometry.gridSize)||geometry.gridSize<=0||!finite(geometry.speed)||geometry.speed<=0)throw new TypeError('A room performance needs valid scene walking geometry.');
 const quantumMs=geometry.gridSize/geometry.speed*1000,initial=initialActors(scene,playerPosition,actors),castIds=new Set((scene.actors??[]).map(actor=>actor.id));
 const physical={...clone(geometry),obstacles:geometry.obstacles.filter(obstacle=>!castIds.has(obstacle.id)).map(clone)};
 const footprints=new Map((scene.actors??[]).map(actor=>{
  const obstacle=geometry.obstacles.find(item=>item.id===actor.id);
  return[actor.id,obstacle?{x:obstacle.x-actor.feet.x,y:obstacle.y-actor.feet.y,width:obstacle.width,height:obstacle.height}:{x:-35,y:-26,width:70,height:26}];
 }));
 const clips=[],adjustments=[],actorEnds=new Map(),raw=Array.isArray(beats)?beats.slice(0,128).flatMap((beat,index)=>{
  if(!beat||typeof beat!=='object'||typeof(beat.actor??beat.speaker)!=='string')return[];
  const text=typeof beat.text==='string'?beat.text:'';
  return[{...clone(beat),text,speaker:typeof beat.speaker==='string'?beat.speaker:beat.actor,index}];
 }):[];
 const sequential=!raw.some(beat=>nonnegativeInteger(beat.startTile));
 // Explicit timelines sort chronologically. An untimed clip mixed into one is
 // placed after the preceding authored entry; wholly untimed scripts use their
 // actual compiled durations below rather than estimates.
 let estimateCursor=0;
 const scheduled=raw.map(beat=>{
  const requestedStart=nonnegativeInteger(beat.startTile)?beat.startTile:estimateCursor;
  const estimatedDuration=positiveInteger(beat.durationTiles)?beat.durationTiles:Math.max(1,Math.ceil((1000+beat.text.length*35)/quantumMs));
  estimateCursor=requestedStart+estimatedDuration;
  return{beat,requestedStart};
 });
 if(!sequential)scheduled.sort((a,b)=>a.requestedStart-b.requestedStart||a.beat.index-b.beat.index);
 let cursor=0;
 for(const {beat,requestedStart}of scheduled){
  const actorId=beat.actor??beat.speaker,actor=initial.find(item=>item.id===actorId);
  let startTile=sequential?cursor:requestedStart;
  const previousEnd=actorEnds.get(actorId)??0;
  if(startTile<previousEnd){adjustments.push({id:beat.id??`cutscene-${beat.index+1}`,index:beat.index,field:'startTile',from:startTile,to:previousEnd,reason:'This actor is still performing its previous clip.'});startTile=previousEnd;}
  const positions=initial.map(item=>poseAt(item,clips,startTile,geometry.gridSize));
  const from=actor?positions.find(item=>item.id===actorId):{id:actorId,...geometry.start,facing:'up'};
  const target=geometry.targets.find(item=>item.id===beat.target)??null;
  const requested=point(beat.destination)?beat.destination:target?.approach;
  const others=positions.filter(item=>item.id!==actorId);
  for(const reserved of clips.filter(clip=>clip.actor!==actorId&&clip.endTile>startTile&&clip.pathLength>0)){
   const other=positions.find(item=>item.id===reserved.actor);
   if(other)others.push({...other,x:reserved.to.x,y:reserved.to.y});
  }
  const actorRoom={...physical,start:{x:from.x,y:from.y,facing:from.facing},obstacles:[...physical.obstacles,...others.map(other=>{
   if(other.id==='mira'){
    // Once the NPC stops, its whole live foot rectangle becomes collision.
    // Reflect that rectangle around Mira so her foot circle cannot be covered
    // by a destination which was clear only for the moving NPC's center point.
    const foot=footprints.get(actorId)??{x:-35,y:-26,width:70,height:26};
    return{id:'cutscene-mira',x:other.x-foot.x-foot.width,y:other.y-foot.y-foot.height,width:foot.width,height:foot.height};
   }
   const foot=footprints.get(other.id)??{x:-35,y:-26,width:70,height:26};
   return{id:`cutscene-${other.id}`,x:other.x+foot.x,y:other.y+foot.y,width:foot.width,height:foot.height};
  })]};
  let waypoints=[];
  if(actor&&requested&&isWalkable(actorRoom,from)){
   try{
    waypoints=findPath(actorRoom,from,requested)??[];
    if(target&&!point(beat.destination)&&distance(waypoints.at(-1)??from,target)>target.range+.000001){
     // Another searching companion can occupy the prop's usual approach.
     // Choose open floor still inside the real interaction radius instead of
     // accepting a grid projection too far away to examine the object.
     const candidates=[];
     for(const scale of [.35,.55,.75,.9])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)candidates.push({x:target.x+Math.cos(angle)*target.range*scale,y:target.y+Math.sin(angle)*target.range*scale});
     candidates.sort((a,b)=>distance(a,requested)-distance(b,requested));
     for(const candidate of candidates){
      if(!isWalkable(actorRoom,candidate))continue;
      const alternative=findPath(actorRoom,from,candidate);
      if(alternative){waypoints=alternative;break;}
     }
    }
   }catch{/* A missing custom cue remains a stationary line. */}
  }
  const path=[{x:from.x,y:from.y},...waypoints],length=pathLength(path),movementTiles=Math.ceil(Math.max(0,length-.000001)/geometry.gridSize),minimumDurationTiles=Math.max(1,movementTiles);
  const readMs=beat.text.trim()?Math.max(3000,Math.min(6000,1000+beat.text.length*35)):quantumMs;
  const holdTiles=Math.ceil(readMs/quantumMs),defaultDuration=Math.max(1,movementTiles+holdTiles);
  const durationTiles=positiveInteger(beat.durationTiles)?Math.max(minimumDurationTiles,beat.durationTiles):defaultDuration;
  if(positiveInteger(beat.durationTiles)&&durationTiles!==beat.durationTiles)adjustments.push({id:beat.id??`cutscene-${beat.index+1}`,index:beat.index,field:'durationTiles',from:beat.durationTiles,to:durationTiles,reason:'Movement needs this many walking tiles at the room speed.'});
  const clip={...beat,id:typeof beat.id==='string'&&beat.id?beat.id:`cutscene-${beat.index+1}`,actor:actorId,startTile,durationTiles,endTile:startTile+durationTiles,minimumDurationTiles,minDurationTiles:minimumDurationTiles,movementTiles,holdTiles,pathLength:length,path,from:{x:from.x,y:from.y,facing:from.facing},to:{...path.at(-1)},action:actions.has(beat.action)?beat.action:'look',lookAt:target?{x:target.x,y:target.y}:point(beat.destination)?{...beat.destination}:null};
  clips.push(clip);actorEnds.set(actorId,clip.endTile);cursor=clip.endTile;
 }
 clips.sort((a,b)=>a.startTile-b.startTile||a.index-b.index);
 return freeze({quantumMs,totalTiles:Math.max(0,...clips.map(clip=>clip.endTile)),gridSize:geometry.gridSize,clips,adjustments,actors:initial});
}

/** A deterministic transport. Seeking never grants notes, routes, clues or gifts. */
export function createRoomCutscene({scene,beats=[],playerPosition=null,actors=null,reducedMotion=false}={}){
 const timeline=compileRoomCutscene({scene,beats,playerPosition,actors});
 let currentTile=0,playing=timeline.totalTiles>0,skipped=false;
 const isFinished=()=>skipped||currentTile>=timeline.totalTiles;
 function snapshot(){
  const finished=isFinished(),activeClips=finished?[]:timeline.clips.filter(clip=>clip.startTile<=currentTile&&currentTile<clip.endTile);
  const beat=activeClips.filter(clip=>clip.text.trim()).at(-1)??null;
  const actorStates=timeline.actors.map(actor=>poseAt(actor,timeline.clips,currentTile,timeline.gridSize,reducedMotion));
  if(finished)for(const actor of actorStates){actor.moving=false;actor.action=null;actor.target=null;actor.emote=null;}
  const focusActor=actorStates.find(actor=>actor.id===beat?.speaker)??actorStates.find(actor=>actor.id===activeClips.at(-1)?.actor)??actorStates.find(actor=>actor.id==='mira');
  return freeze({index:beat?.index??(finished?timeline.clips.length:-1),beat,actors:actorStates,focus:{x:focusActor?.x??scene.geometry.width/2,y:focusActor?.y??scene.geometry.height/2},finished,elapsed:currentTile*timeline.quantumMs,holding:!finished&&!actorStates.some(actor=>actor.moving),currentTile,totalTiles:timeline.totalTiles,quantumMs:timeline.quantumMs,playing,activeClips,activeClipIds:activeClips.map(clip=>clip.id)});
 }
 function seek(tile){
  if(!finite(tile))return false;
  const next=clamp(tile,0,timeline.totalTiles),changed=next!==currentTile||skipped;
  currentTile=next;skipped=false;if(isFinished())playing=false;return changed;
 }
 function pause(){if(!playing)return false;playing=false;return true;}
 function play(){if(isFinished()){currentTile=0;skipped=false;}if(!timeline.totalTiles||playing)return false;playing=true;return true;}
 function update(deltaMs){
  if(!playing||isFinished()||!finite(deltaMs)||deltaMs<=0)return false;
  currentTile=Math.min(timeline.totalTiles,currentTile+Math.min(100,deltaMs)/timeline.quantumMs);
  if(isFinished())playing=false;return true;
 }
 function next(){
  if(isFinished())return false;
  const active=timeline.clips.filter(clip=>clip.startTile<=currentTile&&currentTile<clip.endTile);
  const selected=active.filter(clip=>clip.text.trim()).at(-1)??active[0];
  const destination=selected?.endTile??timeline.clips.find(clip=>clip.startTile>currentTile)?.startTile??timeline.totalTiles;
  return seek(destination);
 }
 function skip(){if(isFinished())return false;skipped=true;playing=false;return true;}
 return Object.freeze({get state(){return snapshot();},timeline,update,next,skip,seek,pause,play});
}
