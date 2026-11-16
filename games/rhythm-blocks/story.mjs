import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs?v=quiet-bell-journey-1';

/** Notes enter the room only through explicit, once-only interactions. */
export const PAGE_ONE_INITIAL_INVENTORY=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,0])));
export const PAGE_TWO_GRANT=Object.freeze([]);
export const PAGE_ONE_SOURCES=Object.freeze({
 'nell-parcel':Object.freeze({id:'nell-parcel',type:'npc',recipe:Object.freeze(NOTE_KINDS.filter(kind=>kind.id!=='half').map(kind=>kind.id))}),
 'depot-chest':Object.freeze({id:'depot-chest',type:'chest',recipe:Object.freeze(['half'])})
});
export const PAGE_ONE_DOOR_COSTS=Object.freeze({
 garden:Object.freeze(['half-rest','half']),
 workshop:Object.freeze(['half','eighth-pair','sixteenth-group']),
 canal:Object.freeze(['half','quarter','eighth-pair'])
});
export const PAGE_ONE_ROUTES=Object.freeze({
 garden:Object.freeze({id:'garden-porch',title:'Iris’s Garden Porch',stage:2}),
 workshop:Object.freeze({id:'workshop-porch',title:'Pip’s Bird Workshop',stage:2}),
 canal:Object.freeze({id:'canal-porch',title:'The Canal Storehouse',stage:2})
});
const clone=value=>structuredClone(value);
const knownKind=kind=>typeof kind==='string'&&Object.hasOwn(NOTE_KIND_BY_ID,kind);
const knownDoor=id=>typeof id==='string'&&Object.hasOwn(PAGE_ONE_DOOR_COSTS,id);
const knownSource=id=>typeof id==='string'&&Object.hasOwn(PAGE_ONE_SOURCES,id);
const equal=(left,right)=>left.length===right.length&&right.every((kind,index)=>left[index]===kind);
const units=recipe=>recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
function stockFor(actions){
 const stock={...PAGE_ONE_INITIAL_INVENTORY};
 for(const action of actions){
  if(action.type==='claim')for(const kind of PAGE_ONE_SOURCES[action.sourceId].recipe)stock[kind]++;
  else for(const kind of action.recipe)stock[kind]--;
 }
 return stock;
}
function checkedRecipe(recipe,stock,{complete=false}={}){
 if(!Array.isArray(recipe)||recipe.length>NOTE_KINDS.length)return false;
 const remaining={...stock};
 for(const kind of recipe){if(!knownKind(kind)||remaining[kind]<1)return false;remaining[kind]--;}
 const duration=units(recipe);
 return complete?duration===8:duration<=8;
}

/** The physical lock chooses the cost; equal beat totals are not substitutes. */
export function classifyPageOne(recipe){
 if(!Array.isArray(recipe))throw RangeError('The notes do not match an opening door.');
 const route=Object.keys(PAGE_ONE_DOOR_COSTS).find(id=>equal(recipe,PAGE_ONE_DOOR_COSTS[id]));
 if(!route)throw RangeError('The notes do not match an opening door.');
 return route;
}
function receiptFor(actions,doorId,recipe){
 const inventoryBefore=stockFor(actions),inventoryAfterConsumption={...inventoryBefore};
 for(const kind of recipe)inventoryAfterConsumption[kind]--;
 return {doorId,recipe:[...recipe],inventoryBefore,inventoryAfterConsumption,received:[],inventoryAfterEntry:{...inventoryAfterConsumption}};
}

/**
 * The opening stops at the chosen next room. Its save is an action log, never
 * a resource balance supplied by storage. No automatic arrival grant exists.
 */
export function createStoryGame({saved=null}={}){
 let actions=[],phrase=[],selectedDoor=null,receipt=null,routeId=null;
 const discovered=new Set();
 function resetRun(){actions=[];phrase=[];selectedDoor=null;receipt=null;routeId=null;}
 function restore(value){
  if(!value||typeof value!=='object'||value.version!==2)return;
  if(Array.isArray(value.discoveredRoutes))for(const route of value.discoveredRoutes)if(knownDoor(route))discovered.add(route);
  if(!Array.isArray(value.actions)||value.actions.length>3||!Array.isArray(value.phrase)||!(value.selectedDoor===null||knownDoor(value.selectedDoor)))return;
  const next=[],claimed=new Set();let committed=false,nextReceipt=null,nextRoute=null;
  for(const action of value.actions){
   if(!action||typeof action!=='object'||Array.isArray(action)||committed)return;
   if(action.type==='claim'){
    if(!knownSource(action.sourceId)||claimed.has(action.sourceId))return;
    claimed.add(action.sourceId);next.push({type:'claim',sourceId:action.sourceId});
   }else if(action.type==='door'){
    if(!knownDoor(action.doorId)||value.selectedDoor!==action.doorId||!checkedRecipe(action.recipe,stockFor(next),{complete:true})||!equal(action.recipe,PAGE_ONE_DOOR_COSTS[action.doorId]))return;
    nextReceipt=receiptFor(next,action.doorId,action.recipe);nextRoute=action.doorId;
    next.push({type:'door',doorId:action.doorId,recipe:[...action.recipe]});committed=true;
   }else return;
  }
  if(committed?value.phrase.length>0:!checkedRecipe(value.phrase,stockFor(next)))return;
  actions=next;phrase=[...value.phrase];selectedDoor=value.selectedDoor;receipt=nextReceipt;routeId=nextRoute;
  if(routeId)discovered.add(routeId);
 }
 restore(saved);
 function available(){const result=stockFor(actions);for(const kind of phrase)result[kind]--;return result;}
 function discoveredRoutes(){return Object.keys(PAGE_ONE_ROUTES).filter(route=>discovered.has(route));}
 function state(){
  const canAttempt=!routeId&&selectedDoor!==null&&units(phrase)===8;
  return {
   phase:routeId?'continued':'room',inventory:stockFor(actions),availableInventory:available(),phrase:[...phrase],units:units(phrase),beats:units(phrase)/2,
   selectedDoor,claimedSources:Object.keys(PAGE_ONE_SOURCES).filter(id=>actions.some(action=>action.type==='claim'&&action.sourceId===id)),
   sourceReceipts:actions.filter(action=>action.type==='claim').map(action=>({sourceId:action.sourceId,recipe:[...PAGE_ONE_SOURCES[action.sourceId].recipe]})),
   canAttempt,canCommit:canAttempt&&equal(phrase,PAGE_ONE_DOOR_COSTS[selectedDoor]),routeId,nextScene:routeId?{...PAGE_ONE_ROUTES[routeId]}:null,
   receipt:receipt?clone(receipt):null,creditedStages:[],discoveredRoutes:discoveredRoutes()
  };
 }
 function claim(sourceId){
  if(routeId||!knownSource(sourceId)||actions.some(action=>action.type==='claim'&&action.sourceId===sourceId))return false;
  actions.push({type:'claim',sourceId});return true;
 }
 function selectDoor(doorId){if(routeId||!knownDoor(doorId))return false;selectedDoor=doorId;return true;}
 function add(kind){
  if(routeId||!knownKind(kind)||available()[kind]<1||units(phrase)+NOTE_KIND_BY_ID[kind].units>8)return false;
  phrase.push(kind);return true;
 }
 function remove(index){
  if(routeId||!Number.isSafeInteger(index)||index<0||index>=phrase.length)return false;
  phrase.splice(index,1);return true;
 }
 function move(index,delta){
  if(routeId||!Number.isSafeInteger(index)||!Number.isSafeInteger(delta)||delta===0||index<0||index>=phrase.length)return false;
  const destination=index+delta;
  if(destination<0||destination>=phrase.length)return false;
  const [kind]=phrase.splice(index,1);phrase.splice(destination,0,kind);return true;
 }
 function commit(){
  if(routeId||selectedDoor===null||!checkedRecipe(phrase,stockFor(actions),{complete:true})||!equal(phrase,PAGE_ONE_DOOR_COSTS[selectedDoor]))return false;
  receipt=receiptFor(actions,selectedDoor,phrase);routeId=selectedDoor;
  actions.push({type:'door',doorId:selectedDoor,recipe:[...phrase]});phrase=[];discovered.add(routeId);return true;
 }
 function undo(){
  if(routeId){actions.pop();routeId=null;receipt=null;phrase=[];return true;}
  if(!phrase.length)return false;
  phrase.pop();return true;
 }
 function restart(){resetRun();return true;}
 function serialize(){return {version:2,actions:clone(actions),phrase:[...phrase],selectedDoor,discoveredRoutes:discoveredRoutes()};}
 return Object.freeze({get state(){return state();},claim,selectDoor,add,remove,move,commit,undo,restart,serialize});
}
