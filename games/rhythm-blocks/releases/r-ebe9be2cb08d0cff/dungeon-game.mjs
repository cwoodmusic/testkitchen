import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs';
import {createStoryGame} from './story.mjs';
import {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_PREVIEWS,CHAPTER_TERMINALS,getChapterDoor} from './chapter.mjs';

export {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_PREVIEWS,CHAPTER_TERMINALS,getChapterDoor} from './chapter.mjs';
export const DUNGEON_SAVE_VERSION=3;
export const MAX_DUNGEON_ACTIONS=5;
export const DUNGEON_INITIAL_INVENTORY=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,0])));
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const knownKind=kind=>typeof kind==='string'&&Object.hasOwn(NOTE_KIND_BY_ID,kind);
const knownSource=id=>typeof id==='string'&&Object.hasOwn(CHAPTER_SOURCES,id);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,keys)=>isRecord(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const equal=(left,right)=>left.length===right.length&&left.every((kind,index)=>kind===right[index]);
const units=recipe=>recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
const openingRoutes=['garden','workshop','canal'];
function checkedRecipe(recipe,stock,{complete=false}={}){
 if(!Array.isArray(recipe)||recipe.length>NOTE_KINDS.length)return false;
 const remaining={...stock};
 for(const kind of recipe){if(!knownKind(kind)||remaining[kind]<1)return false;remaining[kind]--;}
 const duration=units(recipe);return complete?duration===8:duration<=8;
}

/** Replaying local, typed transactions is the only way to create a balance. */
function replay(input){
 if(!Array.isArray(input)||input.length>MAX_DUNGEON_ACTIONS)return null;
 const inventory={...DUNGEON_INITIAL_INVENTORY},actions=[],claimedSources=[],sourceReceipts=[];
 let roomId='depot',phase='room',routeId=null,nextScene=null,receipt=null,lastTransition=null;
 for(const action of input){
  if(phase!=='room'||!isRecord(action))return null;
  if(action.type==='claim'){
   if(!exactKeys(action,['type','sourceId'])||!knownSource(action.sourceId)||claimedSources.includes(action.sourceId))return null;
   const source=CHAPTER_SOURCES[action.sourceId];if(source.roomId!==roomId)return null;
   const inventoryBefore={...inventory};for(const kind of source.recipe)inventory[kind]++;
   actions.push({type:'claim',sourceId:source.id});claimedSources.push(source.id);
   sourceReceipts.push({sourceId:source.id,roomId,recipe:[...source.recipe],inventoryBefore,inventoryAfter:{...inventory}});
  }else if(action.type==='door'){
   if(!exactKeys(action,['type','doorId','recipe']))return null;
   const door=getChapterDoor(action.doorId);
   if(!door||door.from!==roomId||!checkedRecipe(action.recipe,inventory,{complete:true})||!equal(action.recipe,door.recipe))return null;
   const inventoryBefore={...inventory};for(const kind of door.recipe)inventory[kind]--;
   receipt={doorId:door.id,canonicalDoorId:door.canonicalId,from:door.from,to:door.to,recipe:[...door.recipe],inventoryBefore,inventoryAfterConsumption:{...inventory},received:[],inventoryAfterEntry:{...inventory}};
   lastTransition={id:door.canonicalId,doorId:door.id,from:door.from,to:door.to};
   actions.push({type:'door',doorId:door.canonicalId,recipe:[...door.recipe]});
   if(door.from==='depot')routeId=door.id;
   if(Object.hasOwn(CHAPTER_ROOMS,door.to))roomId=door.to;
   else {nextScene=CHAPTER_PREVIEWS[door.to]??CHAPTER_TERMINALS[door.to];if(!nextScene)return null;phase='continued';}
  }else return null;
 }
 return {actions,inventory,roomId,phase,routeId,nextScene,receipt,lastTransition,claimedSources,sourceReceipts};
}

/** Four rooms; no notes or ending credits are awarded merely for arrival. */
export function createDungeonGame({saved=null}={}){
 let run=replay([]),phrase=[],selectedDoor=null;
 const discovered=new Set();
 const discover=value=>{if(Array.isArray(value))for(const id of value)if(openingRoutes.includes(id))discovered.add(id);};
 const discoveries=()=>openingRoutes.filter(id=>discovered.has(id));
 function apply(actions){const next=replay(actions);if(!next)return false;run=next;if(run.routeId)discovered.add(run.routeId);return true;}
 function restore(value){
  if(!isRecord(value)||![2,DUNGEON_SAVE_VERSION].includes(value.version))return;
  discover(value.discoveredRoutes);
  if(value.version===2){
   // The legacy validator checks old aliases, stock, draft and committed selection
   // before a committed opening is reinterpreted as an actual porch arrival.
   const legacy=createStoryGame({saved:value}).serialize();
   const next=replay(legacy.actions);if(!next)return;
   run=next;phrase=[...legacy.phrase];selectedDoor=next.roomId==='depot'?legacy.selectedDoor:null;
   if(run.routeId)discovered.add(run.routeId);return;
  }
  const next=replay(value.actions);if(!next||!Array.isArray(value.phrase))return;
  const selected=value.selectedDoor===null?null:getChapterDoor(value.selectedDoor);
  if(value.selectedDoor!==null&&(!selected||selected.from!==next.roomId))return;
  if(next.phase==='continued'){
   if(value.phrase.length||!selected||selected.canonicalId!==next.lastTransition.id)return;
  }else if(!checkedRecipe(value.phrase,next.inventory))return;
  run=next;phrase=[...value.phrase];selectedDoor=selected?.id??null;
  if(run.routeId)discovered.add(run.routeId);
 }
 restore(saved);
 function available(){const stock={...run.inventory};for(const kind of phrase)stock[kind]--;return stock;}
 function state(){
  const door=getChapterDoor(selectedDoor),canAttempt=run.phase==='room'&&!!door&&units(phrase)===8;
  return freeze(clone({
   roomId:run.roomId,phase:run.phase,inventory:run.inventory,availableInventory:available(),phrase,units:units(phrase),beats:units(phrase)/2,
   selectedDoor,claimedSources:run.claimedSources,currentRoomClaimedSources:run.claimedSources.filter(id=>CHAPTER_SOURCES[id].roomId===run.roomId),sourceReceipts:run.sourceReceipts,
   canAttempt,canCommit:canAttempt&&equal(phrase,door.recipe),routeId:run.routeId,nextScene:run.nextScene,previewKind:run.nextScene?.kind??null,
   receipt:run.receipt,lastTransition:run.lastTransition,traversedDoors:run.actions.filter(action=>action.type==='door').map(action=>action.doorId),
   actions:run.actions,creditedStages:[],discoveredRoutes:discoveries(),canRevisit:run.phase==='continued'||run.roomId!=='depot'
  }));
 }
 function claim(sourceId){
  if(run.phase!=='room'||!knownSource(sourceId)||CHAPTER_SOURCES[sourceId].roomId!==run.roomId||run.claimedSources.includes(sourceId))return false;
  return apply([...run.actions,{type:'claim',sourceId}]);
 }
 function selectDoor(id){const door=getChapterDoor(id);if(run.phase!=='room'||!door||door.from!==run.roomId)return false;selectedDoor=door.id;return true;}
 function add(kind){
  if(run.phase!=='room'||!knownKind(kind)||available()[kind]<1||units(phrase)+NOTE_KIND_BY_ID[kind].units>8)return false;
  phrase.push(kind);return true;
 }
 function remove(index){if(run.phase!=='room'||!Number.isSafeInteger(index)||index<0||index>=phrase.length)return false;phrase.splice(index,1);return true;}
 function move(index,delta){
  if(run.phase!=='room'||!Number.isSafeInteger(index)||!Number.isSafeInteger(delta)||delta===0||index<0||index>=phrase.length)return false;
  const destination=index+delta;if(destination<0||destination>=phrase.length)return false;
  const [kind]=phrase.splice(index,1);phrase.splice(destination,0,kind);return true;
 }
 function commit(){
  const door=getChapterDoor(selectedDoor);
  if(run.phase!=='room'||!door||door.from!==run.roomId||!checkedRecipe(phrase,run.inventory,{complete:true})||!equal(phrase,door.recipe))return false;
  if(!apply([...run.actions,{type:'door',doorId:door.canonicalId,recipe:[...phrase]}]))return false;
  phrase=[];selectedDoor=run.phase==='room'?null:door.id;return true;
 }
 function undo(){
  if(run.phase==='continued'){
   const door=getChapterDoor(run.actions.at(-1).doorId);apply(run.actions.slice(0,-1));phrase=[];selectedDoor=door.id;return true;
  }
  if(!phrase.length)return false;phrase.pop();return true;
 }
 function rewindRoom(){
  if(run.phase==='continued')return undo();
  if(run.roomId==='depot')return false;
  const entryIndex=run.actions.findLastIndex(action=>action.type==='door');
  const door=getChapterDoor(run.actions[entryIndex].doorId);
  if(entryIndex<0||!door||!apply(run.actions.slice(0,entryIndex)))return false;
  phrase=[];selectedDoor=door.id;return true;
 }
 function restart(){run=replay([]);phrase=[];selectedDoor=null;return true;}
 function serialize(){return {version:DUNGEON_SAVE_VERSION,actions:clone(run.actions),phrase:[...phrase],selectedDoor,roomId:run.roomId,discoveredRoutes:discoveries()};}
 return Object.freeze({get state(){return state();},claim,selectDoor,add,remove,move,commit,undo,rewindRoom,revisit:rewindRoom,restart,serialize});
}
