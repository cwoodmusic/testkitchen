import {NOTE_KINDS} from './engine.mjs';
import {createStoryGame} from './story.mjs';
import {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_PREVIEWS,CHAPTER_TERMINALS,getChapterDoor} from './chapter.mjs';

export {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_PREVIEWS,CHAPTER_TERMINALS,getChapterDoor} from './chapter.mjs';
export const DUNGEON_SAVE_VERSION=3;
export const MAX_DUNGEON_ACTIONS=5;
export const MAX_DEVELOPER_ACTIONS=512;
export const DUNGEON_INITIAL_INVENTORY=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,0])));
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,keys)=>isRecord(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const equal=(left,right)=>left.length===right.length&&left.every((kind,index)=>kind===right[index]);
const openingRoutes=['garden','workshop','canal'];
const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=120&&!['__proto__','constructor','prototype'].includes(id);

/** A definition is copied once. Authoring changes never mutate a running game. */
function compileDefinition(definition){
 const custom=definition!==undefined&&definition!==null;
 const supplied=custom?clone(definition):{
  rooms:CHAPTER_ROOMS,doors:CHAPTER_DOORS,sources:CHAPTER_SOURCES,previews:CHAPTER_PREVIEWS,terminals:CHAPTER_TERMINALS,
  noteKinds:NOTE_KINDS,settings:{startRoomId:'depot',initialInventory:DUNGEON_INITIAL_INVENTORY}
 };
 if(!isRecord(supplied))throw TypeError('A game definition must be an object.');
 for(const key of ['rooms','doors','sources','previews','terminals'])if(!isRecord(supplied[key]))throw TypeError(`A game definition needs ${key}.`);
 const notes=supplied.noteKinds??NOTE_KINDS;
 if(!Array.isArray(notes)||!notes.length)throw TypeError('A game definition needs note kinds.');
 const kinds={},noteKinds=[];
 for(const note of notes){
  if(!isRecord(note)||!safeId(note.id)||Object.hasOwn(kinds,note.id)||!Number.isSafeInteger(note.units)||note.units<1||note.units>64)throw TypeError('Invalid game note kind.');
  const entry={...note,beats:note.units/2};kinds[note.id]=entry;noteKinds.push(entry);
 }
 const empty=()=>Object.fromEntries(noteKinds.map(kind=>[kind.id,0]));
 function stock(value){
  if(!isRecord(value)||Object.keys(value).some(id=>!Object.hasOwn(kinds,id)))return null;
  const result=empty();
  for(const [id,count]of Object.entries(value)){if(!Number.isSafeInteger(count)||count<0||count>999)return null;result[id]=count;}
  return result;
 }
 const settings=supplied.settings??{},startRoomId=settings.startRoomId??'depot',initialInventory=stock(settings.initialInventory??empty());
 if(!safeId(startRoomId)||!Object.hasOwn(supplied.rooms,startRoomId)||!initialInventory)throw TypeError('Invalid starting room or note inventory.');
 for(const [id,room]of Object.entries(supplied.rooms))if(!safeId(id)||!isRecord(room)||room.id!==id)throw TypeError('Invalid playable room.');
 const destinations=new Set(Object.keys(supplied.rooms));
 for(const key of ['previews','terminals'])for(const [id,boundary]of Object.entries(supplied[key])){
  if(!safeId(id)||!isRecord(boundary)||boundary.id!==id||destinations.has(id))throw TypeError('Invalid or duplicated boundary room.');
  destinations.add(id);
 }
 const knownKind=id=>typeof id==='string'&&Object.hasOwn(kinds,id);
 const recipe=(value,max,{emptyAllowed=false}={})=>Array.isArray(value)&&value.length<=max&&(emptyAllowed||value.length>0)&&value.every(knownKind);
 for(const [id,source]of Object.entries(supplied.sources)){
  if(!safeId(id)||!isRecord(source)||source.id!==id||!safeId(source.roomId)||!Object.hasOwn(supplied.rooms,source.roomId)||!recipe(source.recipe,128,{emptyAllowed:true}))throw TypeError('Invalid note source.');
 }
 const doorIds=new Set(),canonicalIds=new Set(),lookupOwners=new Map();
 for(const [key,door]of Object.entries(supplied.doors)){
  if(!safeId(key)||!isRecord(door)||!safeId(door.id)||!safeId(door.canonicalId)||doorIds.has(door.id)||canonicalIds.has(door.canonicalId)||!safeId(door.from)||!safeId(door.to)||!Object.hasOwn(supplied.rooms,door.from)||![supplied.rooms,supplied.previews,supplied.terminals].some(map=>Object.hasOwn(map,door.to))||!recipe(door.recipe,32))throw TypeError('Invalid rhythm door.');
  for(const alias of new Set([key,door.id,door.canonicalId])){if(lookupOwners.has(alias)&&lookupOwners.get(alias)!==key)throw TypeError('Ambiguous rhythm door ID.');lookupOwners.set(alias,key);}
  doorIds.add(door.id);canonicalIds.add(door.canonicalId);
 }
 return freeze({...supplied,custom,noteKinds,kinds,initialInventory,startRoomId,stock});
}

/** Typed transactions preserve normal play; explicit developer actions stay opt-in. */
export function createDungeonGame({saved=null,definition=null,developer=false}={}){
 const config=compileDefinition(definition),{rooms,doors,sources,previews,terminals,kinds,noteKinds,initialInventory,startRoomId}=config;
 const maxActions=config.custom?MAX_DEVELOPER_ACTIONS:MAX_DUNGEON_ACTIONS,maxPhraseLength=config.custom?32:NOTE_KINDS.length;
 const developerEnabled=developer===true;
 const knownKind=id=>typeof id==='string'&&Object.hasOwn(kinds,id);
 const knownSource=id=>typeof id==='string'&&Object.hasOwn(sources,id);
 const units=recipe=>recipe.reduce((total,kind)=>total+kinds[kind].units,0);
 const getDoor=id=>typeof id==='string'?(Object.hasOwn(doors,id)?doors[id]:Object.values(doors).find(door=>door.id===id||door.canonicalId===id)??null):null;
 const targetUnits=door=>door?units(door.recipe):8;
 const maximumDraftUnits=config.custom?32*Math.max(...noteKinds.map(kind=>kind.units)):8;
 function checkedRecipe(recipe,inventory,{complete=false,door=null}={}){
  if(!Array.isArray(recipe)||recipe.length>maxPhraseLength)return false;
  const remaining={...inventory};
  for(const kind of recipe){if(!knownKind(kind)||remaining[kind]<1)return false;remaining[kind]--;}
  const duration=units(recipe);return complete?!!door&&duration===targetUnits(door):duration<=maximumDraftUnits;
 }
 function entryIndex(actions){
  return actions.findLastIndex(action=>action.type==='developer-teleport'||action.type==='door'&&Object.hasOwn(rooms,getDoor(action.doorId).to));
 }
 function replay(input){
  if(!Array.isArray(input)||input.length>maxActions)return null;
  const inventory={...initialInventory},actions=[],claimedSources=[],sourceReceipts=[];
  let roomId=startRoomId,phase='room',routeId=null,nextScene=null,receipt=null,lastTransition=null;
  for(const action of input){
   if(!isRecord(action))return null;
   if(action.type==='developer-inventory'){
    if(!developerEnabled||!exactKeys(action,['type','inventory']))return null;
    const stock=config.stock(action.inventory);if(!stock)return null;
    Object.assign(inventory,stock);actions.push({type:action.type,inventory:stock});continue;
   }
   if(action.type==='developer-teleport'){
    if(!developerEnabled||!exactKeys(action,['type','roomId'])||!safeId(action.roomId)||!Object.hasOwn(rooms,action.roomId))return null;
    roomId=action.roomId;phase='room';routeId=null;nextScene=null;receipt=null;lastTransition=null;
    actions.push({type:action.type,roomId});continue;
   }
   if(action.type==='developer-reset-sources'){
    if(!developerEnabled||!exactKeys(action,['type','sourceIds'])||!Array.isArray(action.sourceIds)||action.sourceIds.length>Object.keys(sources).length||new Set(action.sourceIds).size!==action.sourceIds.length||!action.sourceIds.every(knownSource))return null;
    const reset=new Set(action.sourceIds);
    for(let index=claimedSources.length-1;index>=0;index--)if(reset.has(claimedSources[index]))claimedSources.splice(index,1);
    for(let index=sourceReceipts.length-1;index>=0;index--)if(reset.has(sourceReceipts[index].sourceId))sourceReceipts.splice(index,1);
    actions.push({type:action.type,sourceIds:[...action.sourceIds]});continue;
   }
   if(phase!=='room')return null;
   if(action.type==='claim'){
    if(!exactKeys(action,['type','sourceId'])||!knownSource(action.sourceId)||claimedSources.includes(action.sourceId))return null;
    const source=sources[action.sourceId];if(source.roomId!==roomId)return null;
    const inventoryBefore={...inventory};for(const kind of source.recipe)inventory[kind]++;
    actions.push({type:'claim',sourceId:source.id});claimedSources.push(source.id);
    sourceReceipts.push({sourceId:source.id,roomId,recipe:[...source.recipe],inventoryBefore,inventoryAfter:{...inventory}});
   }else if(action.type==='door'){
    if(!exactKeys(action,['type','doorId','recipe']))return null;
    const door=getDoor(action.doorId);
    if(!door||door.from!==roomId||!checkedRecipe(action.recipe,inventory,{complete:true,door})||!equal(action.recipe,door.recipe))return null;
    const inventoryBefore={...inventory};for(const kind of door.recipe)inventory[kind]--;
    receipt={doorId:door.id,canonicalDoorId:door.canonicalId,from:door.from,to:door.to,recipe:[...door.recipe],inventoryBefore,inventoryAfterConsumption:{...inventory},received:[],inventoryAfterEntry:{...inventory}};
    lastTransition={id:door.canonicalId,doorId:door.id,from:door.from,to:door.to};
    actions.push({type:'door',doorId:door.canonicalId,recipe:[...door.recipe]});
    if(door.from==='depot')routeId=door.id;
    if(Object.hasOwn(rooms,door.to))roomId=door.to;
    else{nextScene=previews[door.to]??terminals[door.to];if(!nextScene)return null;phase='continued';}
   }else return null;
  }
  return{actions,inventory,roomId,phase,routeId,nextScene,receipt,lastTransition,claimedSources,sourceReceipts};
 }
 let run=replay([]),phrase=[],selectedDoor=null;
 const discovered=new Set();
 const discover=value=>{if(Array.isArray(value))for(const id of value)if(openingRoutes.includes(id))discovered.add(id);};
 const discoveries=()=>openingRoutes.filter(id=>discovered.has(id));
 function apply(actions){const next=replay(actions);if(!next)return false;run=next;if(openingRoutes.includes(run.routeId))discovered.add(run.routeId);return true;}
 function restore(value){
  if(!isRecord(value)||![2,DUNGEON_SAVE_VERSION].includes(value.version))return;
  discover(value.discoveredRoutes);
  if(value.version===2){
   const legacy=createStoryGame({saved:value}).serialize(),next=replay(legacy.actions);
   if(!next||!checkedRecipe(legacy.phrase,next.inventory))return;
   run=next;phrase=[...legacy.phrase];selectedDoor=next.roomId===startRoomId?legacy.selectedDoor:null;
   if(openingRoutes.includes(run.routeId))discovered.add(run.routeId);return;
  }
  const next=replay(value.actions);if(!next||!Array.isArray(value.phrase))return;
  const selected=value.selectedDoor===null?null:getDoor(value.selectedDoor);
  if(value.selectedDoor!==null&&(!selected||selected.from!==next.roomId))return;
  if(next.phase==='continued'){
   if(value.phrase.length||!selected||selected.canonicalId!==next.lastTransition.id)return;
  }else if(!checkedRecipe(value.phrase,next.inventory))return;
  run=next;phrase=[...value.phrase];selectedDoor=selected?.id??null;
  if(openingRoutes.includes(run.routeId))discovered.add(run.routeId);
 }
 restore(saved);
 function available(){const inventory={...run.inventory};for(const kind of phrase)inventory[kind]--;return inventory;}
 function state(){
  const door=getDoor(selectedDoor),required=targetUnits(door),canAttempt=run.phase==='room'&&!!door&&units(phrase)===required;
  return freeze(clone({
   roomId:run.roomId,phase:run.phase,inventory:run.inventory,availableInventory:available(),phrase,units:units(phrase),beats:units(phrase)/2,targetUnits:required,targetBeats:required/2,noteKinds,
   selectedDoor,claimedSources:run.claimedSources,currentRoomClaimedSources:run.claimedSources.filter(id=>sources[id].roomId===run.roomId),sourceReceipts:run.sourceReceipts,
   canAttempt,canCommit:canAttempt&&equal(phrase,door.recipe),routeId:run.routeId,nextScene:run.nextScene,previewKind:run.nextScene?.kind??null,
   receipt:run.receipt,lastTransition:run.lastTransition,traversedDoors:run.actions.filter(action=>action.type==='door').map(action=>action.doorId),
   actions:run.actions,creditedStages:[],discoveredRoutes:discoveries(),canRevisit:run.phase==='continued'||entryIndex(run.actions)>=0
  }));
 }
 function claim(sourceId){
  if(run.phase!=='room'||!knownSource(sourceId)||sources[sourceId].roomId!==run.roomId||run.claimedSources.includes(sourceId))return false;
  return apply([...run.actions,{type:'claim',sourceId}]);
 }
 function selectDoor(id){const door=getDoor(id);if(run.phase!=='room'||!door||door.from!==run.roomId)return false;selectedDoor=door.id;return true;}
 function add(kind){
  if(run.phase!=='room'||!knownKind(kind)||phrase.length>=maxPhraseLength||available()[kind]<1||units(phrase)+kinds[kind].units>targetUnits(getDoor(selectedDoor)))return false;
  phrase.push(kind);return true;
 }
 function remove(index){if(run.phase!=='room'||!Number.isSafeInteger(index)||index<0||index>=phrase.length)return false;phrase.splice(index,1);return true;}
 function move(index,delta){
  if(run.phase!=='room'||!Number.isSafeInteger(index)||!Number.isSafeInteger(delta)||delta===0||index<0||index>=phrase.length)return false;
  const destination=index+delta;if(destination<0||destination>=phrase.length)return false;
  const [kind]=phrase.splice(index,1);phrase.splice(destination,0,kind);return true;
 }
 function commit(){
  const door=getDoor(selectedDoor);
  if(run.phase!=='room'||!door||door.from!==run.roomId||!checkedRecipe(phrase,run.inventory,{complete:true,door})||!equal(phrase,door.recipe))return false;
  if(!apply([...run.actions,{type:'door',doorId:door.canonicalId,recipe:[...phrase]}]))return false;
  phrase=[];selectedDoor=run.phase==='room'?null:door.id;return true;
 }
 function undo(){
  if(run.phase==='continued'){
   const index=run.actions.findLastIndex(action=>action.type==='door'),door=getDoor(run.actions[index].doorId);
   if(!apply(run.actions.slice(0,index)))return false;phrase=[];selectedDoor=door.id;return true;
  }
  if(!phrase.length)return false;phrase.pop();return true;
 }
 function rewindRoom(){
  if(run.phase==='continued')return undo();
  const index=entryIndex(run.actions);if(index<0)return false;
  const action=run.actions[index],door=action.type==='door'?getDoor(action.doorId):null;
  if(!apply(run.actions.slice(0,index)))return false;
  phrase=[];selectedDoor=run.phase==='continued'?run.receipt.doorId:door?.id??null;return true;
 }
 function developerSetInventory(inventory){
  if(!developerEnabled)return false;
  const stock=config.stock(inventory);if(!stock)return false;
  if(!apply([...run.actions,{type:'developer-inventory',inventory:stock}]))return false;
  phrase=[];return true;
 }
 function developerTeleport(roomId){
  if(!developerEnabled||typeof roomId!=='string'||!Object.hasOwn(rooms,roomId)||!apply([...run.actions,{type:'developer-teleport',roomId}]))return false;
  phrase=[];selectedDoor=null;return true;
 }
 function developerResetSources(sourceId=null){
  if(!developerEnabled||sourceId!==null&&!knownSource(sourceId))return false;
  const sourceIds=sourceId===null?[...run.claimedSources]:run.claimedSources.includes(sourceId)?[sourceId]:[];
  if(!sourceIds.length||!apply([...run.actions,{type:'developer-reset-sources',sourceIds}]))return false;
  return true;
 }
 function restart(){run=replay([]);phrase=[];selectedDoor=null;return true;}
 function serialize(){return{version:DUNGEON_SAVE_VERSION,actions:clone(run.actions),phrase:[...phrase],selectedDoor,roomId:run.roomId,discoveredRoutes:discoveries()};}
 return Object.freeze({get state(){return state();},claim,selectDoor,add,remove,move,commit,undo,rewindRoom,revisit:rewindRoom,restart,serialize,developerSetInventory,developerTeleport,developerResetSources});
}
