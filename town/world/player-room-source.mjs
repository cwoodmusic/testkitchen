import {createRoomStorage,ROOM_KEY} from './urban-room.mjs?v=town-compact-island-1';
import {apartmentDecorBounds,apartmentDecorFootBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs?v=town-compact-island-1';
import {furniturePresentationScale} from './private-furniture.mjs?v=town-compact-island-1';

const playerRoom=scene=>scene?.kind==='apartment'&&scene.resident==='player';
function registeredSources(scene){
 const result=[],seen=new Set([scene]),queue=[scene];
 for(let i=0;i<queue.length;i++)for(const source of queue[i]?.roomLayoutLegacySources||[]){
  if(!playerRoom(source)||seen.has(source))continue;seen.add(source);result.push(source);queue.push(source);
 }
 return result;
}

/** Active-profile purchases select a compatible known room without migrating data. */
export function createPlayerRoomSourceResolver({storage,owner,catalog,furniture=[],owned=()=>[],resolveLayout=scene=>scene}={}){
 let cache=new WeakMap();
 function resolve(scene,registeredScene=scene){
  if(!playerRoom(scene)||!owner)return scene;
  const remembered=cache.get(scene);if(remembered?.registeredScene===registeredScene)return remembered.scene;
  const remember=value=>{cache.set(scene,{registeredScene,scene:value});return value;};
  let raw,value;
  try{raw=storage?.getItem(ROOM_KEY);if(typeof raw!=='string'||raw.length>96*1024)return remember(scene);value=JSON.parse(raw);}catch{return remember(scene);}
  // Never use another student's room to choose or expose an architecture.
  if(value?.version!==1||value.owner!==owner||!Array.isArray(value.items)||!value.items.length)return remember(scene);
  const readOnly={getItem:key=>key===ROOM_KEY?raw:null},candidates=[scene],seen=new Set(candidates);
  for(const source of registeredSources(registeredScene)){
   const candidate=resolveLayout(source);if(playerRoom(candidate)&&!seen.has(candidate)){seen.add(candidate);candidates.push(candidate);}
  }
  for(const candidate of candidates){
   const room=createRoomStorage({storage:readOnly,owner,catalog,furniture,owned:()=>typeof owned==='function'?owned():owned,
    presentationScale:(item,asset)=>furniturePresentationScale(item,candidate,asset),
    getBounds:(_item,asset)=>(asset?.wallMounted?apartmentWallDecorBounds:apartmentDecorBounds)(candidate),getFootBounds:(_item,asset)=>asset?.wallMounted?null:apartmentDecorFootBounds(candidate),getSolids:()=>candidate.solids});
   if(room.load().ok)return remember(candidate);
  }
  return remember(scene);
 }
 return {resolve,invalidate(){cache=new WeakMap();}};
}
