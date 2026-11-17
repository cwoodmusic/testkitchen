/** Object discussions contain speech only; inspecting never performs a pickup. */
import {OBJECT_DIALOGUES} from './object-dialogue-content.mjs';

export const OBJECT_DIALOGUE_MAX_LINES=12;
const EMOTES=new Set(['idea','question','thinking','surprise','happy']);
const STAGE_CUES=new Set(['courier-signal','radar']);
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const validId=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value)&&!FORBIDDEN.has(value);
const clone=value=>structuredClone(value);
const scriptKey=value=>JSON.stringify(value,(_,item)=>record(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const STOCK_SCRIPTS=new Map(Object.values(OBJECT_DIALOGUES).map(script=>[scriptKey(script),script]));

function lines(entry,{includeBlank=false}={}){
 if(entry?.dialogue==null)return[];
 if(!Array.isArray(entry.dialogue))throw new TypeError('An object discussion must be an array, or null to turn it off.');
 if(entry.dialogue.length>OBJECT_DIALOGUE_MAX_LINES)throw new RangeError(`An object discussion can contain at most ${OBJECT_DIALOGUE_MAX_LINES} lines.`);
 const ids=new Set();
 return entry.dialogue.flatMap((line,index)=>{
  if(!record(line))throw new TypeError('Each object discussion line needs a speaker and text.');
  if(!validId(line.speaker))throw new TypeError('An object discussion line needs a local speaker ID.');
  if(typeof line.text!=='string'||line.text.length>600)throw new TypeError('Object discussion text must contain at most 600 characters.');
  if(line.id!==undefined){if(!validId(line.id)||ids.has(line.id))throw new TypeError('Object discussion line IDs must be valid and unique.');ids.add(line.id);}
  if(line.durationTiles!==undefined&&(!Number.isSafeInteger(line.durationTiles)||line.durationTiles<1||line.durationTiles>100000))throw new RangeError('An object discussion duration must be from 1 to 100000 walking tiles.');
  if(line.reaction!==undefined&&line.reaction!==null){
   if(!record(line.reaction)||!EMOTES.has(line.reaction.emote)||!Number.isSafeInteger(line.reaction.durationTiles)||line.reaction.durationTiles<1||line.reaction.durationTiles>512)throw new TypeError('Choose a supported speaking reaction lasting from 1 to 512 walking tiles.');
  }
  if(line.stageCue!==undefined&&line.stageCue!==null&&!STAGE_CUES.has(line.stageCue))throw new TypeError('Choose a supported stage cue, or null to turn it off.');
  return line.text.trim()||includeBlank?[{line,index}]:[];
 });
}

/** Build an independent, sequential speech track at the room's walking quantum. */
export function compileObjectDialogue({entry,scene,includeBlank=false}={}){
 const spoken=lines(entry,{includeBlank});if(!spoken.length)return[];
 const geometry=scene?.geometry;
 if(!Number.isFinite(geometry?.gridSize)||geometry.gridSize<=0||!Number.isFinite(geometry.speed)||geometry.speed<=0)throw new TypeError('An object discussion needs valid room walking geometry.');
 const local=new Set(['mira',...(scene.actors??[]).map(actor=>actor.id)]),reserved=new Set((entry.dialogue??[]).map(line=>line.id).filter(validId));
 const quantumMs=geometry.gridSize/geometry.speed*1000;
 let cursor=0;
 return spoken.map(({line,index})=>{
  if(!local.has(line.speaker))throw new TypeError('An object discussion speaker must be present in this room.');
  let id=line.id;
  if(id===undefined){
   const prefix='object-'+(validId(entry.id)?entry.id:'inspection');let count=1;
   do{const suffix=`-line-${index+1}`+(count===1?'':`-${count}`);id=prefix.slice(0,80-suffix.length)+suffix;count++;}while(reserved.has(id));
   reserved.add(id);
  }
  const clip=clone(line);
  // Even an author's unrelated metadata cannot turn an object conversation
  // into a walk, action, inventory transaction or automatic source claim.
  for(const field of ['target','destination','waypoints','action','gait','gesture','emote'])delete clip[field];
  const durationTiles=line.durationTiles??Math.ceil(Math.max(3000,Math.min(6000,1000+line.text.length*35))/quantumMs);
  Object.assign(clip,{id,kind:'dialogue',actor:line.speaker,speaker:line.speaker,text:line.text,startTile:cursor,durationTiles});
  cursor+=durationTiles;return clip;
 });
}

/** Only playable speech changes cause an already-seen discussion to play again. */
export function objectDialogueSignature(entry){
 const spoken=lines(entry);if(!spoken.length)return null;
 const value=JSON.stringify({id:entry.id??null,lines:spoken.map(({line,index})=>({
  id:line.id??index,speaker:line.speaker,text:line.text,
  durationTiles:line.durationTiles??null,
  reaction:line.reaction?{emote:line.reaction.emote,durationTiles:line.reaction.durationTiles}:null,
  stageCue:line.stageCue??null,
 }))});
 let hash=0xcbf29ce484222325n;
 for(let index=0;index<value.length;index++)hash=BigInt.asUintN(64,(hash^BigInt(value.charCodeAt(index)))*0x100000001b3n);
 return'object-v1-'+hash.toString(16).padStart(16,'0');
}

/** Fill only missing stock scripts on observations which already exist. */
export function upgradeObjectDialogues(value){
 const project=clone(value);
 if(!record(project?.content))return project;
 for(const [roomId,content]of Object.entries(project.content)){
  if(!record(content)||!Array.isArray(content.inspections))continue;
  const local=new Set(['mira',...(Array.isArray(content.people)?content.people:[]).map(person=>person?.id)]);
  const actors=Array.isArray(project.scenes?.[roomId]?.actors)?project.scenes[roomId].actors:[];
  const available=script=>script.flatMap(line=>{
   if(local.has(line.speaker))return[clone(line)];
   const aliases=actors.filter(actor=>actor?.character===line.speaker&&local.has(actor.id));
   return aliases.length===1?[{...clone(line),speaker:aliases[0].id}]:[];
  });
  for(const entry of content.inspections){
   if(!record(entry))continue;
   if(Object.hasOwn(entry,'dialogue')){
    // A legacy author may rename a stock person and its object together.
    // Adapt only a completely untouched stock script, never custom speech.
    if(Array.isArray(entry.dialogue)&&entry.dialogue.some(line=>!local.has(line?.speaker))){const stock=STOCK_SCRIPTS.get(scriptKey(entry.dialogue));if(stock)entry.dialogue=available(stock);}
    continue;
   }
   if(Object.hasOwn(OBJECT_DIALOGUES,entry.id))entry.dialogue=available(OBJECT_DIALOGUES[entry.id]);
  }
 }
 return project;
}

/** Saved receipts are accepted only for the current version of known speech. */
export function restoreObjectDialogueSeen({project,saved}={}){
 const seen=new Map();
 if(!record(saved)||saved.version!==1||!record(saved.seen))return seen;
 for(const content of Object.values(project?.content??{}))for(const entry of Array.isArray(content?.inspections)?content.inspections:[]){
  const signature=saved.seen[entry?.id];if(typeof signature!=='string'||!/^object-v1-[0-9a-f]{16}$/.test(signature))continue;
  try{if(signature===objectDialogueSignature(entry))seen.set(entry.id,signature);}catch{/* Invalid authoring data is not a saved discussion receipt. */}
 }
 return seen;
}
