import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs?v=quiet-bell-page-one-1';

/** Page one uses the same exact half-beat catalog as the chapter verifier. */
export const PAGE_ONE_INITIAL_INVENTORY=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,1])));
export const PAGE_TWO_GRANT=Object.freeze(['half','quarter','eighth-pair']);
export const PAGE_ONE_ROUTES=Object.freeze({
 garden:Object.freeze({id:'s02_garden',title:'The Garden Gate',stage:2}),
 workshop:Object.freeze({id:'s02_workshop',title:'The Makers Lane',stage:2}),
 canal:Object.freeze({id:'s02_canal',title:'The Canal Landing',stage:2})
});
const GROUPED=new Set(['eighth-pair','sixteenth-group','sixteenth-pair']);
const clone=value=>structuredClone(value);
const knownKind=kind=>typeof kind==='string'&&Object.hasOwn(NOTE_KIND_BY_ID,kind);
const units=recipe=>recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
function checkedRecipe(recipe,{complete=false}={}){
 if(!Array.isArray(recipe)||recipe.length>NOTE_KINDS.length)return false;
 const stock={...PAGE_ONE_INITIAL_INVENTORY};
 for(const kind of recipe){if(!knownKind(kind)||stock[kind]===0)return false;stock[kind]--;}
 const duration=units(recipe);
 return complete?duration===8:duration<=8;
}

/** First-match priority is part of the puzzle: an opening rest wins first. */
export function classifyPageOne(recipe){
 if(!checkedRecipe(recipe,{complete:true}))throw RangeError('A page-one answer needs four beats drawn from the original parcel.');
 if(NOTE_KIND_BY_ID[recipe[0]].rest)return 'garden';
 if(recipe.filter(kind=>GROUPED.has(kind)).length>=2)return 'workshop';
 return 'canal';
}
function receiptFor(recipe){
 const inventoryBefore={...PAGE_ONE_INITIAL_INVENTORY},inventoryAfterConsumption={...inventoryBefore};
 for(const kind of recipe)inventoryAfterConsumption[kind]--;
 const inventoryAfterEntry={...inventoryAfterConsumption};
 for(const kind of PAGE_TWO_GRANT)inventoryAfterEntry[kind]++;
 return{recipe:[...recipe],inventoryBefore,inventoryAfterConsumption,received:[...PAGE_TWO_GRANT],inventoryAfterEntry};
}

/**
 * This slice stops at the next scene. No subsequent answers, awards or remote
 * progress writes exist yet. Resources are always reconstructed from the answer.
 */
export function createStoryGame({saved=null}={}){
 let phrase=[],answer=null,receipt=null,routeId=null;
 const discovered=new Set();
 function restore(value){
  if(!value||typeof value!=='object'||value.version!==1)return;
  if(Array.isArray(value.discoveredRoutes))for(const route of value.discoveredRoutes)if(typeof route==='string'&&Object.hasOwn(PAGE_ONE_ROUTES,route))discovered.add(route);
  // An impossible current run resets to its original parcel. Historic, local
  // route discoveries are informational and never supply resources or flags.
  if(!Array.isArray(value.phrase))return;
  if(value.answer===null){if(checkedRecipe(value.phrase))phrase=[...value.phrase];return;}
  if(value.phrase.length||!checkedRecipe(value.answer,{complete:true}))return;
  answer=[...value.answer];receipt=receiptFor(answer);routeId=classifyPageOne(answer);discovered.add(routeId);
 }
 restore(saved);
 function stock(){return receipt?receipt.inventoryAfterEntry:PAGE_ONE_INITIAL_INVENTORY;}
 function available(){const result={...stock()};for(const kind of phrase)result[kind]--;return result;}
 function discoveredRoutes(){return Object.keys(PAGE_ONE_ROUTES).filter(route=>discovered.has(route));}
 function state(){return{
  phase:answer?'continued':'room',inventory:{...stock()},availableInventory:available(),phrase:[...phrase],units:units(phrase),beats:units(phrase)/2,
  canCommit:!answer&&units(phrase)===8,routeId,nextScene:routeId?{...PAGE_ONE_ROUTES[routeId]}:null,
  receipt:receipt?clone(receipt):null,creditedStages:answer?[2]:[],discoveredRoutes:discoveredRoutes()
 };}
 function add(kind){
  if(answer||!knownKind(kind)||available()[kind]===0||units(phrase)+NOTE_KIND_BY_ID[kind].units>8)return false;
  phrase.push(kind);return true;
 }
 function remove(index){
  if(answer||!Number.isSafeInteger(index)||index<0||index>=phrase.length)return false;
  phrase.splice(index,1);return true;
 }
 function move(index,delta){
  if(answer||!Number.isSafeInteger(index)||!Number.isSafeInteger(delta)||delta===0||index<0||index>=phrase.length)return false;
  const destination=index+delta;
  if(destination<0||destination>=phrase.length)return false;
  const [kind]=phrase.splice(index,1);phrase.splice(destination,0,kind);return true;
 }
 function commit(){
  if(answer||!checkedRecipe(phrase,{complete:true}))return false;
  answer=[...phrase];phrase=[];receipt=receiptFor(answer);routeId=classifyPageOne(answer);discovered.add(routeId);return true;
 }
 function undo(){
  if(answer){answer=null;receipt=null;routeId=null;phrase=[];return true;}
  if(!phrase.length)return false;
  phrase.pop();return true;
 }
 function restart(){phrase=[];answer=null;receipt=null;routeId=null;return true;}
 function serialize(){return{version:1,answer:answer?[...answer]:null,phrase:[...phrase],discoveredRoutes:discoveredRoutes()};}
 return Object.freeze({get state(){return state();},add,remove,move,commit,undo,restart,serialize});
}
