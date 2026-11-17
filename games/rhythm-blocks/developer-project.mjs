/** Plain, portable authoring data for the Quiet Bell developer console. */
import {NOTE_KINDS} from './engine.mjs';
import {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_PREVIEWS,CHAPTER_TERMINALS} from './chapter.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {separateCutsceneTracks} from './cutscene.mjs';
import {CAST,CAST_IMAGE} from './cast.mjs';
import {MIRA} from './mira.mjs';
import {createRoomWalker,findPath,isWalkable} from './room.mjs';

const COLORS=['#9bd5bb','#a9d8da','#b9afe2','#efcb8d','#bdb0e7','#e8d9b5','#e0bd9b','#d9abc8','#c8bde9'];
const SHORT_NAMES=['Quarter note','Two eighths','Four sixteenths','Half note','Eighth note','Quarter rest','Half rest','Dotted half','Two sixteenths'];
const NOTE_IDS=new Set(NOTE_KINDS.map(note=>note.id));
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
const TYPES=new Set(['person','door','chest','inspect','return']);
const FACINGS=new Set(['up','down','left','right']);
const CUTSCENE_ACTIONS=new Set(['look','search','examine','listen']);
const CUTSCENE_EMOTES=new Set(['idea','question','thinking','surprise','happy']);
const CUTSCENE_KINDS=new Set(['walk','dialogue','emote']);
const own=(value,key)=>Object.hasOwn(value,key);
const asArray=value=>Array.isArray(value)?value:[];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const validId=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value)&&!FORBIDDEN.has(value);
const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const same=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>item===right[index]);
let defaultCutscenes=null;

/** A new mutable copy; changing it never changes the shipped game. */
export function createDefaultProject(){
 defaultCutscenes??=Object.fromEntries(Object.entries(CAMPAIGN_SCENES).map(([roomId,scene])=>[roomId,separateCutsceneTracks({scene,beats:ROOM_CUTSCENES[roomId]??[]})]));
 return clone({
  schemaVersion:1,
  settings:{title:'The Quiet Bell',bpm:108,startRoomId:'depot',castImage:CAST_IMAGE,terminalRooms:true,completionReady:true,initialInventory:Object.fromEntries(NOTE_KINDS.map(note=>[note.id,0]))},
  noteKinds:NOTE_KINDS.map((note,index)=>({...note,symbol:note.id,shortName:SHORT_NAMES[index],color:COLORS[index],subdivisions:['eighth-pair','sixteenth-pair'].includes(note.id)?2:note.id==='sixteenth-group'?4:1})),
  rooms:CHAPTER_ROOMS,doors:CHAPTER_DOORS,sources:CHAPTER_SOURCES,previews:CHAPTER_PREVIEWS,terminals:CHAPTER_TERMINALS,
  content:Object.fromEntries(Object.entries(CAMPAIGN_CONTENT).map(([id,content])=>[id,{...content,cutscene:defaultCutscenes[id]??[]}])),
  scenes:CAMPAIGN_SCENES,cast:CAST,player:{...MIRA,image:'assets/mira-walk.webp'},
 });
}

/** Explicit choices override the legacy conversation, including an empty list. */
export function getPersonReplies(person){
 if(Array.isArray(person?.replies))return person.replies;
 return [
  {id:'story',label:'Your story',text:person?.story??''},
  {id:'route',label:'A way forward',text:person?.route??'',demo:person?.demo??[]},
  {id:'inventory',label:'My notes',text:person?.inventory??''},
 ];
}

/** Resolve UI IDs and canonical IDs without accepting inherited properties. */
export function getProjectDoor(project,id){
 if(typeof id!=='string'||!record(project?.doors))return null;
 if(own(project.doors,id))return project.doors[id];
 return Object.values(project.doors).find(door=>door?.canonicalId===id)??null;
}

function safeJson(value,errors){
 const stack=new WeakSet();let nodes=0,textSize=0;
 function walk(item,path,depth){
  if(++nodes>100000){if(nodes===100001)errors.push('$: project contains too many values.');return;}
  if(depth>32){errors.push(`${path}: nesting is deeper than 32 levels.`);return;}
  if(item===null||typeof item==='boolean')return;
  if(typeof item==='number'){if(!Number.isFinite(item))errors.push(`${path}: numbers must be finite.`);return;}
  if(typeof item==='string'){textSize+=item.length;if(item.length>16*1024*1024)errors.push(`${path}: a string exceeds 16 MiB.`);return;}
  if(typeof item!=='object'){errors.push(`${path}: use JSON data, not ${typeof item}.`);return;}
  if(!Array.isArray(item)&&!record(item)){errors.push(`${path}: use a plain JSON object.`);return;}
  if(stack.has(item)){errors.push(`${path}: circular references are not JSON.`);return;}
  stack.add(item);
  if(Object.getOwnPropertySymbols(item).length)errors.push(`${path}: symbol keys are not JSON.`);
  if(Array.isArray(item)&&Object.keys(item).filter(key=>/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<item.length).length!==item.length)errors.push(`${path}: sparse arrays are not JSON data.`);
  for(const key of Object.keys(item)){
   if(FORBIDDEN.has(key)){errors.push(`${path}.${key}: reserved object key.`);continue;}
   if(Array.isArray(item)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=item.length)){errors.push(`${path}.${key}: array properties are not JSON data.`);continue;}
   const descriptor=Object.getOwnPropertyDescriptor(item,key);
   if(!descriptor||!own(descriptor,'value')){errors.push(`${path}.${key}: accessors are not JSON.`);continue;}
   walk(descriptor.value,Array.isArray(item)?`${path}[${key}]`:`${path}.${key}`,depth+1);
  }
  stack.delete(item);
 }
 walk(value,'$',0);
 if(textSize>32*1024*1024)errors.push('$: project text and embedded artwork exceed 32 MiB.');
}

/** Structural mistakes block applying; balance and reachability concerns are warnings. */
export function validateProject(project){
 const errors=[],warnings=[];
 safeJson(project,errors);
 if(errors.length||!record(project))return {valid:false,errors:errors.length?errors:['$: a project must be a JSON object.'],warnings};
 const fail=(path,message)=>errors.push(`${path}: ${message}`);
 const warn=(path,message)=>warnings.push(`${path}: ${message}`);
 const text=(value,path,{empty=false,max=20000}={})=>{const ok=typeof value==='string'&&value.length<=max&&(empty||value.trim().length>0);if(!ok)fail(path,`use ${empty?'':'nonempty '}text up to ${max} characters.`);return ok;};
 const id=(value,path)=>{const ok=validId(value);if(!ok)fail(path,'start with a letter, then use letters, numbers, underscores or hyphens (up to 80 characters).');return ok;};
 const number=(value,path,min,max,{integer=false}={})=>{const ok=finite(value)&&value>=min&&value<=max&&(!integer||Number.isInteger(value));if(!ok)fail(path,`use ${integer?'an integer':'a number'} from ${min} to ${max}.`);return ok;};
 const map=(value,path,{min=0,max=512}={})=>{const ok=record(value)&&Object.keys(value).length>=min&&Object.keys(value).length<=max;if(!ok)fail(path,`use an object with ${min}–${max} entries.`);return ok;};
 const list=(value,path,max=512)=>{const ok=Array.isArray(value)&&value.length<=max;if(!ok)fail(path,`use an array with at most ${max} entries.`);return ok;};
 const image=(value,path)=>{
  if(typeof value!=='string'||!value.trim()||value.length>16*1024*1024){fail(path,'use an artwork path, HTTPS URL, or raster data:image URL.');return false;}
  const local=/^(?![\/\\]|[a-zA-Z][\w+.-]*:)[^<>\u0000-\u0020\\]+$/.test(value)&&!value.split('/').includes('..');
  const remote=/^https:\/\//i.test(value)&&!/[<>\u0000-\u0020]/.test(value);
  const embedded=/^data:image\/(?:png|webp|jpe?g|gif);base64,[a-zA-Z0-9+/=]+$/i.test(value);
  if(!local&&!remote&&!embedded){fail(path,'only relative artwork paths, HTTPS URLs, and base64 PNG/WebP/JPEG/GIF artwork are supported.');return false;}
  if(remote){try{const url=new URL(value);if(url.username||url.password||!url.hostname)throw Error();}catch{fail(path,'use a valid HTTPS artwork URL without credentials.');return false;}}
  return true;
 };
 const recipe=(value,path,max,{nonempty=false}={})=>{
  if(!list(value,path,max))return false;
  if(nonempty&&!value.length)fail(path,'a lock needs at least one note or rest.');
  value.forEach((kind,index)=>{if(!NOTE_IDS.has(kind))fail(`${path}[${index}]`,'choose a known note kind.');});
  return value.every(kind=>NOTE_IDS.has(kind));
 };
 const point=(value,path)=>{if(!record(value)){fail(path,'use an x/y point.');return false;}return number(value.x,`${path}.x`,-32768,32768)&number(value.y,`${path}.y`,-32768,32768);};
 const rectangle=(value,path,width,height)=>{
  if(!record(value)){fail(path,'use an x/y/width/height rectangle.');return false;}
  const valid=number(value.x,`${path}.x`,0,width)&number(value.y,`${path}.y`,0,height)&number(value.width,`${path}.width`,.01,width)&number(value.height,`${path}.height`,.01,height);
  if(valid&&(value.x+value.width>width+.001||value.y+value.height>height+.001)){fail(path,'the rectangle must stay inside the room artwork.');return false;}
  return !!valid;
 };
 const unique=(items,path,getKey=item=>item?.id)=>{
  const used=new Set();for(const [index,item]of items.entries()){const key=getKey(item);if(used.has(key))fail(`${path}[${index}]`,`duplicate ID ${String(key)}.`);used.add(key);}return used;
 };
 if(project.schemaVersion!==1)fail('schemaVersion','expected project schema version 1.');
 if(map(project.settings,'settings')){
  text(project.settings.title,'settings.title',{max:160});
  number(project.settings.bpm,'settings.bpm',20,300);
  for(const key of ['terminalRooms','completionReady'])if(project.settings[key]!==undefined&&typeof project.settings[key]!=='boolean')fail(`settings.${key}`,'use true or false.');
  id(project.settings.startRoomId,'settings.startRoomId');image(project.settings.castImage,'settings.castImage');
  if(map(project.settings.initialInventory,'settings.initialInventory',{max:9}))for(const [kind,quantity]of Object.entries(project.settings.initialInventory)){
   if(!NOTE_IDS.has(kind))fail(`settings.initialInventory.${kind}`,'unknown note kind.');number(quantity,`settings.initialInventory.${kind}`,0,999,{integer:true});
  }
 }
 if(list(project.noteKinds,'noteKinds',9)){
  if(project.noteKinds.length!==9)fail('noteKinds','include each of the nine engraved note kinds exactly once.');
  unique(project.noteKinds,'noteKinds');
  for(const [index,note]of project.noteKinds.entries()){
   const path=`noteKinds[${index}]`;if(!record(note)){fail(path,'use a note definition.');continue;}
   if(!NOTE_IDS.has(note.id))fail(`${path}.id`,'keep an existing engraved note ID.');
   text(note.label,`${path}.label`,{max:120});text(note.shortName,`${path}.shortName`,{max:80});
   number(note.units,`${path}.units`,1,64,{integer:true});
   if(typeof note.rest!=='boolean')fail(`${path}.rest`,'use true or false.');
   if(![1,2,4].includes(note.subdivisions))fail(`${path}.subdivisions`,'use 1, 2 or 4 attacks per note tile.');
   if(!NOTE_IDS.has(note.symbol))fail(`${path}.symbol`,'choose an existing engraved note symbol.');
   if(typeof note.color!=='string'||!/^#[a-f0-9]{6}$/i.test(note.color))fail(`${path}.color`,'use a six-digit hex color such as #9bd5bb.');
   const standard=NOTE_KINDS.find(kind=>kind.id===note.id);
   if(standard&&(note.units!==standard.units||note.rest!==standard.rest))warn(path,'custom timing differs from this note’s conventional musical value.');
  }
 }
 const mapsOk=['rooms','doors','sources','previews','terminals','content','scenes','cast'].map(key=>map(project[key],key,{min:['rooms','content','scenes','cast'].includes(key)?1:0,max:key==='cast'?64:512})).every(Boolean);
 if(!mapsOk)return {valid:false,errors,warnings};
 const {rooms,doors,sources,previews,terminals,content,scenes,cast}=project;
 const locations={...rooms,...(project.settings?.terminalRooms?terminals:{})};
 for(const [name,entries]of Object.entries({rooms,doors,sources,previews,terminals,content,scenes,cast}))for(const key of Object.keys(entries))id(key,`${name}.${key}`);
 if(!own(rooms,'depot'))fail('rooms.depot','retain the depot room for existing saves.');
 if(!own(locations,project.settings?.startRoomId))fail('settings.startRoomId','reference a playable room or enabled outcome room.');
 const destinations=new Set(),canonical=new Set();
 for(const [name,entries]of Object.entries({rooms,previews,terminals}))for(const [key,item]of Object.entries(entries)){
  const path=`${name}.${key}`;if(destinations.has(key))fail(path,'a destination ID can belong to only one room or boundary.');destinations.add(key);
  if(!record(item)){fail(path,'use a room or boundary definition.');continue;}
  if(item.id!==key)fail(`${path}.id`,'match the object key.');text(item.title,`${path}.title`,{max:160});
  number(item.stage,`${path}.stage`,1,1000,{integer:true});
  if(name==='previews'&&item.kind!=='preview')fail(`${path}.kind`,'use preview.');
  if(name==='terminals'&&!['dead-end','ending','secret-ending'].includes(item.kind))fail(`${path}.kind`,'use dead-end, ending or secret-ending.');
  if(name==='rooms'||name==='terminals'&&project.settings?.terminalRooms){
   if(!own(content,key))fail(`content.${key}`,'every playable room needs dialogue and copy.');
   if(!own(scenes,key))fail(`scenes.${key}`,'every playable room needs a scene.');
  }
  if(name==='rooms'){
   for(const field of ['sources','doors'])if(list(item[field],`${path}.${field}`)){
    unique(item[field],`${path}.${field}`,value=>value);
    item[field].forEach((ref,index)=>{id(ref,`${path}.${field}[${index}]`);const definition=(field==='sources'?sources:doors)[ref];if(!definition)fail(`${path}.${field}[${index}]`,'reference an existing definition.');else if((field==='sources'?definition.roomId:definition.from)!==key)fail(`${path}.${field}[${index}]`,'reference a definition belonging to this room.');});
   }
  }
 }
 for(const [key,door]of Object.entries(doors)){
  const path=`doors.${key}`;if(!record(door)){fail(path,'use a door definition.');continue;}
  if(door.id!==key)fail(`${path}.id`,'match the object key.');
  id(door.canonicalId,`${path}.canonicalId`);
  if(canonical.has(door.canonicalId)||own(doors,door.canonicalId)&&door.canonicalId!==key)fail(`${path}.canonicalId`,'canonical door IDs must be unique and unambiguous.');canonical.add(door.canonicalId);
  if(!own(rooms,door.from))fail(`${path}.from`,'reference a playable room.');
  if(!destinations.has(door.to))fail(`${path}.to`,'reference an existing room, preview or terminal.');
  if(!asArray(rooms[door.from]?.doors).includes(key))fail(`${path}.from`,'the source room must list this door.');
  text(door.label,`${path}.label`,{max:160});recipe(door.recipe,`${path}.recipe`,32,{nonempty:true});
  if(door.revealAfter!==undefined&&(!validId(door.revealAfter)||!own(sources,door.revealAfter)))fail(`${path}.revealAfter`,'reference an existing note source.');
 }
 for(const [key,source]of Object.entries(sources)){
  const path=`sources.${key}`;if(!record(source)){fail(path,'use a note-source definition.');continue;}
  if(source.id!==key)fail(`${path}.id`,'match the object key.');
  if(!own(rooms,source.roomId))fail(`${path}.roomId`,'reference a playable room.');
  if(!asArray(rooms[source.roomId]?.sources).includes(key))fail(`${path}.roomId`,'the source room must list this note source.');
  if(!['npc','chest','hidden'].includes(source.type))fail(`${path}.type`,'use npc, chest or hidden.');
  if(source.type==='npc')id(source.character,`${path}.character`);
  text(source.label,`${path}.label`,{max:160});if(source.hint!==undefined)text(source.hint,`${path}.hint`,{empty:true});
  recipe(source.recipe,`${path}.recipe`,128);
  if(Array.isArray(source.recipe)&&!source.recipe.length)warn(`${path}.recipe`,'this source will be collected without giving notes.');
 }
 const inspectionIds=new Set();
 for(const [roomId,roomContent]of Object.entries(content)){
  const path=`content.${roomId}`;if(!own(locations,roomId))fail(path,'reference a playable room or enabled outcome room.');
  if(!record(roomContent)){fail(path,'use a room-content definition.');continue;}
  text(roomContent.title,`${path}.title`,{max:160});text(roomContent.arrival,`${path}.arrival`,{empty:true});
  if(roomContent.cutscene!==undefined&&list(roomContent.cutscene,`${path}.cutscene`,384)){
   const people=new Set(asArray(roomContent.people).map(person=>person?.id)),actors=new Set(asArray(scenes[roomId]?.actors).map(actor=>actor?.id)),targets=new Set(asArray(scenes[roomId]?.geometry?.targets).map(target=>target?.id));
   people.add('mira');actors.add('mira');
   const clipIds=new Set(),scheduled=[];
   roomContent.cutscene.forEach((beat,index)=>{
    const beatPath=`${path}.cutscene[${index}]`;if(!record(beat)){fail(beatPath,'use a dialogue or action clip.');return;}
    if(beat.kind!==undefined&&!CUTSCENE_KINDS.has(beat.kind))fail(`${beatPath}.kind`,'choose walk, dialogue or emote.');
    if(beat.id!==undefined){id(beat.id,`${beatPath}.id`);if(clipIds.has(beat.id))fail(`${beatPath}.id`,'clip IDs must be unique within the room.');clipIds.add(beat.id);}
    if(beat.speaker!==undefined){id(beat.speaker,`${beatPath}.speaker`);if(!people.has(beat.speaker))fail(`${beatPath}.speaker`,'choose Mira or a person in this room.');}
    if(beat.text!==undefined)text(beat.text,`${beatPath}.text`,{max:600,empty:true});
    if(typeof beat.text==='string'&&beat.text.trim()&&!people.has(beat.speaker))fail(`${beatPath}.speaker`,'a spoken line needs Mira or a person in this room.');
    if(beat.actor!==undefined){id(beat.actor,`${beatPath}.actor`);if(!actors.has(beat.actor))fail(`${beatPath}.actor`,'choose Mira or a foreground actor in this room.');}
    if(!actors.has(beat.actor??beat.speaker))fail(`${beatPath}.actor`,'each clip needs a local actor or speaker.');
    for(const [field,min]of [['startTile',0],['durationTiles',1]])if(beat[field]!==undefined)number(beat[field],`${beatPath}.${field}`,min,100000,{integer:true});
    if(beat.target!==undefined){id(beat.target,`${beatPath}.target`);if(!targets.has(beat.target))warn(`${beatPath}.target`,'this object is missing; the clip will play without an approach.');}
    if(beat.destination!==undefined){
     if(point(beat.destination,`${beatPath}.destination`)){
      const geometry=scenes[roomId]?.geometry;
      if(record(geometry)&&finite(geometry.width)&&finite(geometry.height)){
       if(beat.destination.x<0||beat.destination.y<0||beat.destination.x>geometry.width||beat.destination.y>geometry.height)fail(`${beatPath}.destination`,'keep the destination inside the room artwork.');
       else if(record(geometry.bounds)&&Array.isArray(geometry.obstacles)&&geometry.obstacles.every(item=>record(item)&&finite(item.x)&&finite(item.y)&&finite(item.width)&&finite(item.height))&&!isWalkable(geometry,beat.destination))warn(`${beatPath}.destination`,'this point is blocked; motion will use the nearest reachable floor.');
      }
     }
     if(beat.target!==undefined)fail(beatPath,'choose either an object target or a destination, not both.');
    }
    if(beat.waypoints!==undefined&&list(beat.waypoints,`${beatPath}.waypoints`,32)){
     beat.waypoints.forEach((waypoint,waypointIndex)=>{
      const waypointPath=`${beatPath}.waypoints[${waypointIndex}]`;
      if(!point(waypoint,waypointPath))return;
      const geometry=scenes[roomId]?.geometry;
      if(record(geometry)&&finite(geometry.width)&&finite(geometry.height)){
       if(waypoint.x<0||waypoint.y<0||waypoint.x>geometry.width||waypoint.y>geometry.height)fail(waypointPath,'keep the waypoint inside the room artwork.');
       else if(record(geometry.bounds)&&Array.isArray(geometry.obstacles)&&geometry.obstacles.every(item=>record(item)&&finite(item.x)&&finite(item.y)&&finite(item.width)&&finite(item.height))&&!isWalkable(geometry,waypoint))warn(waypointPath,'this waypoint is blocked; motion will use the nearest reachable floor.');
      }
     });
    }
    if(beat.action!==undefined&&!CUTSCENE_ACTIONS.has(beat.action))fail(`${beatPath}.action`,'choose look, search, examine or listen.');
    if(beat.emote!==undefined&&!CUTSCENE_EMOTES.has(beat.emote))fail(`${beatPath}.emote`,'choose idea, question, thinking, surprise or happy.');
    if(beat.kind==='walk'){
     if(typeof beat.text==='string'&&beat.text.trim())fail(`${beatPath}.text`,'put spoken text in its own dialogue clip.');
     if(beat.emote!==undefined)fail(`${beatPath}.emote`,'put the reaction in its own emote clip.');
    }
    if(beat.kind==='dialogue'){
     if(typeof beat.text!=='string')fail(`${beatPath}.text`,'a dialogue clip needs text, which may be blank while editing.');
     if(!people.has(beat.speaker))fail(`${beatPath}.speaker`,'a dialogue clip needs Mira or a person in this room.');
    }
    if(beat.kind==='emote'&&!CUTSCENE_EMOTES.has(beat.emote))fail(`${beatPath}.emote`,'an emote clip needs a reaction.');
    if(beat.kind==='dialogue'||beat.kind==='emote'){
     for(const field of ['target','destination','waypoints','action'])if(beat[field]!==undefined)fail(`${beatPath}.${field}`,'put movement and actions in their own walk clip.');
     if(beat.kind==='dialogue'&&beat.emote!==undefined)fail(`${beatPath}.emote`,'put the reaction in its own emote clip.');
     if(beat.kind==='emote'&&beat.text!==undefined)fail(`${beatPath}.text`,'put spoken text in its own dialogue clip.');
    }
    if(!CUTSCENE_KINDS.has(beat.kind)&&!(typeof beat.text==='string'&&beat.text.trim())&&beat.target===undefined&&beat.destination===undefined&&!asArray(beat.waypoints).length&&beat.action===undefined&&beat.emote===undefined)fail(beatPath,'add dialogue, movement, an action or an emote.');
    if(Number.isSafeInteger(beat.startTile)&&Number.isSafeInteger(beat.durationTiles))scheduled.push({actor:beat.actor??beat.speaker,kind:beat.kind,start:beat.startTile,end:beat.startTile+beat.durationTiles,index});
   });
   for(const [index,clip]of scheduled.entries())for(const other of scheduled.slice(index+1))if(clip.actor===other.actor&&(!clip.kind||!other.kind||clip.kind===other.kind)&&clip.start<other.end&&other.start<clip.end)warn(`${path}.cutscene[${other.index}]`,'this actor has overlapping clips on the same track; preview the timeline to check their order.');
  }
  if(list(roomContent.people,`${path}.people`,128)){
   unique(roomContent.people,`${path}.people`);
   for(const [index,person]of roomContent.people.entries()){
    const personPath=`${path}.people[${index}]`;if(!record(person)){fail(personPath,'use a person definition.');continue;}
    id(person.id,`${personPath}.id`);text(person.name,`${personPath}.name`,{max:120});text(person.role,`${personPath}.role`,{empty:true,max:160});
    const explicitReplies=Array.isArray(person.replies);
    for(const field of ['story','route','inventory'])if(!explicitReplies||person[field]!==undefined)text(person[field],`${personPath}.${field}`,{empty:true});
    if(!explicitReplies||person.demo!==undefined)recipe(person.demo,`${personPath}.demo`,32);
    if(person.intro!==undefined)text(person.intro,`${personPath}.intro`,{empty:true});
    if(person.replies!==undefined&&list(person.replies,`${personPath}.replies`,64)){
     unique(person.replies,`${personPath}.replies`);
     for(const [replyIndex,reply]of person.replies.entries()){
      const replyPath=`${personPath}.replies[${replyIndex}]`;
      if(!record(reply)){fail(replyPath,'use a reply with an ID, label and text.');continue;}
      id(reply.id,`${replyPath}.id`);if(typeof reply.id==='string'&&reply.id.length>64)fail(`${replyPath}.id`,'reply IDs may have at most 64 characters.');
      text(reply.label,`${replyPath}.label`,{max:160});text(reply.text,`${replyPath}.text`,{empty:true});
      if(reply.demo!==undefined)recipe(reply.demo,`${replyPath}.demo`,32);
     }
    }
    if(person.sourceId!==undefined){
     const source=sources[person.sourceId];
     if(!source||source.type!=='npc'||source.roomId!==roomId||source.character!==person.id)fail(`${personPath}.sourceId`,'reference this person’s NPC source in this room.');
     if(person.sourceLabel!==undefined)text(person.sourceLabel,`${personPath}.sourceLabel`,{max:160});
    }
    const localDoors=Object.values(doors).filter(door=>door?.from===roomId);
    for(const [replyIndex,reply]of getPersonReplies(person).entries())if(Array.isArray(reply?.demo)&&reply.demo.length&&!localDoors.some(door=>same(reply.demo,door.recipe)))warn(explicitReplies?`${personPath}.replies[${replyIndex}].demo`:`${personPath}.demo`,'the demonstration does not match any local lock; check the edited clue and answer together.');
   }
  }
  if(list(roomContent.inspections,`${path}.inspections`,256)){
   unique(roomContent.inspections,`${path}.inspections`);
   for(const [index,entry]of roomContent.inspections.entries()){
    const entryPath=`${path}.inspections[${index}]`;if(!record(entry)){fail(entryPath,'use an observation definition.');continue;}
    id(entry.id,`${entryPath}.id`);if(inspectionIds.has(entry.id))fail(`${entryPath}.id`,'observation IDs must be unique across rooms.');inspectionIds.add(entry.id);
    text(entry.title,`${entryPath}.title`,{max:160});text(entry.label,`${entryPath}.label`,{max:160});text(entry.text,`${entryPath}.text`,{empty:true});
    if(entry.sourceId!==undefined){const source=sources[entry.sourceId];if(!source||source.type!=='hidden'||source.roomId!==roomId)fail(`${entryPath}.sourceId`,'reference a hidden note source in this room.');if(entry.sourceLabel!==undefined)text(entry.sourceLabel,`${entryPath}.sourceLabel`,{max:160});}
   }
  }
  if(map(roomContent.doorCopy,`${path}.doorCopy`)){
   for(const [doorId,copy]of Object.entries(roomContent.doorCopy)){
    const copyPath=`${path}.doorCopy.${doorId}`,door=getProjectDoor(project,doorId);
    if(!door||door.from!==roomId)fail(copyPath,'reference a door in this room.');
    if(!record(copy)){fail(copyPath,'use a door-copy object.');continue;}
    text(copy.name,`${copyPath}.name`,{max:160});
    for(const field of ['hint','warning','previewCopy','deadCopy','repair'])if(copy[field]!==undefined)text(copy[field],`${copyPath}.${field}`,{empty:true});
   }
   for(const door of Object.values(doors).filter(door=>door?.from===roomId))if(!own(roomContent.doorCopy,door.id)&&!own(roomContent.doorCopy,door.canonicalId))fail(`${path}.doorCopy`,'supply copy for each door in the room.');
  }
 }
 for(const [castId,sprite]of Object.entries(cast)){
  const path=`cast.${castId}`;if(!record(sprite)){fail(path,'use a cast-sprite definition.');continue;}
  number(sprite.column,`${path}.column`,0,1,{integer:true});number(sprite.row,`${path}.row`,0,1,{integer:true});
  if(!Array.isArray(sprite.anchor)||sprite.anchor.length!==2)fail(`${path}.anchor`,'use two boot-anchor fractions.');else sprite.anchor.forEach((fraction,index)=>number(fraction,`${path}.anchor[${index}]`,0,1));
  if(sprite.walk!==undefined&&sprite.walk!==false){
   const walk=sprite.walk,walkPath=`${path}.walk`;
   if(!record(walk)){fail(walkPath,'use a directional walk-sprite definition, or false for a static portrait.');continue;}
   image(walk.image,`${walkPath}.image`);
   number(walk.cellWidth,`${walkPath}.cellWidth`,16,4096,{integer:true});number(walk.cellHeight,`${walkPath}.cellHeight`,16,4096,{integer:true});
   if(!Array.isArray(walk.directions)||walk.directions.length!==4||new Set(walk.directions).size!==4||walk.directions.some(direction=>!FACINGS.has(direction)))fail(`${walkPath}.directions`,'include up, down, left and right once each.');
   if(!Array.isArray(walk.anchors)||walk.anchors.length!==4)fail(`${walkPath}.anchors`,'use four rows of three pose anchors.');else walk.anchors.forEach((row,rowIndex)=>{
    if(!Array.isArray(row)||row.length!==3){fail(`${walkPath}.anchors[${rowIndex}]`,'use three pose anchors.');return;}
    row.forEach((anchor,column)=>{if(!Array.isArray(anchor)||anchor.length!==2)fail(`${walkPath}.anchors[${rowIndex}][${column}]`,'use an x/y boot-anchor pair.');else anchor.forEach((fraction,index)=>number(fraction,`${walkPath}.anchors[${rowIndex}][${column}][${index}]`,0,1));});
   });
  }
 }
 if(!record(project.player))fail('player','use a player-sprite definition.');else{
  const player=project.player;image(player.image,'player.image');number(player.worldSize,'player.worldSize',16,1024);number(player.cellSize,'player.cellSize',16,4096,{integer:true});
  if(!Array.isArray(player.directions)||player.directions.length!==4||new Set(player.directions).size!==4||player.directions.some(direction=>!FACINGS.has(direction)))fail('player.directions','include up, down, left and right once each.');
  if(!Array.isArray(player.anchors)||player.anchors.length!==4)fail('player.anchors','use four rows of three pose anchors.');else player.anchors.forEach((row,rowIndex)=>{
   if(!Array.isArray(row)||row.length!==3){fail(`player.anchors[${rowIndex}]`,'use three pose anchors.');return;}
   row.forEach((anchor,column)=>{if(!Array.isArray(anchor)||anchor.length!==2)fail(`player.anchors[${rowIndex}][${column}]`,'use an x/y boot-anchor pair.');else anchor.forEach((fraction,index)=>number(fraction,`player.anchors[${rowIndex}][${column}][${index}]`,0,1));});
  });
 }
 for(const [roomId,scene]of Object.entries(scenes)){
  const path=`scenes.${roomId}`;
  if(!own(locations,roomId))fail(path,'reference a playable room or enabled outcome room.');
  if(!record(scene)){fail(path,'use a scene definition.');continue;}
  if(scene.id!==roomId)fail(`${path}.id`,'match the room ID.');text(scene.title,`${path}.title`,{max:160});image(scene.image,`${path}.image`);
  const geometry=scene.geometry,geometryStart=errors.length;
  if(!record(geometry)){fail(`${path}.geometry`,'use room geometry.');continue;}
  const dimensions=number(geometry.width,`${path}.geometry.width`,64,8192)&number(geometry.height,`${path}.geometry.height`,64,8192);
  if(!dimensions)continue;
  if(scene.entry!==undefined){
   const entry=scene.entry,entryPath=`${path}.entry`;
   if(!record(entry))fail(entryPath,'use room-entry settings.');
   else{
    if(entry.enabled!==undefined&&typeof entry.enabled!=='boolean')fail(`${entryPath}.enabled`,'use true or false.');
    if(entry.fadeTiles!==undefined)number(entry.fadeTiles,`${entryPath}.fadeTiles`,0,128,{integer:true});
    if(entry.staggerTiles!==undefined)number(entry.staggerTiles,`${entryPath}.staggerTiles`,0,64,{integer:true});
    if(entry.doorX!==undefined)number(entry.doorX,`${entryPath}.doorX`,0,geometry.width);
   }
  }
  rectangle(geometry.bounds,`${path}.geometry.bounds`,geometry.width,geometry.height);
  number(geometry.radius,`${path}.geometry.radius`,1,256);number(geometry.gridSize,`${path}.geometry.gridSize`,8,512);
  number(geometry.speed,`${path}.geometry.speed`,1,2000);number(geometry.maxDeltaMs,`${path}.geometry.maxDeltaMs`,1,100);
  point(geometry.start,`${path}.geometry.start`);if(geometry.start?.facing!==undefined&&!FACINGS.has(geometry.start.facing))fail(`${path}.geometry.start.facing`,'choose up, down, left or right.');
  if(list(geometry.obstacles,`${path}.geometry.obstacles`,2048))geometry.obstacles.forEach((obstacle,index)=>rectangle(obstacle,`${path}.geometry.obstacles[${index}]`,geometry.width,geometry.height));
  let targets=new Set(),objects=new Set(),actors=new Set();
  if(list(geometry.targets,`${path}.geometry.targets`,512)){
   targets=unique(geometry.targets,`${path}.geometry.targets`);
   geometry.targets.forEach((target,index)=>{
    const targetPath=`${path}.geometry.targets[${index}]`;if(!record(target)){fail(targetPath,'use an interaction target.');return;}
    id(target.id,`${targetPath}.id`);if(!TYPES.has(target.type))fail(`${targetPath}.type`,'choose person, door, chest, inspect or return.');
    point(target,targetPath);point(target.approach,`${targetPath}.approach`);number(target.range,`${targetPath}.range`,1,2048);
    if(target.label!==undefined)text(target.label,`${targetPath}.label`,{max:160});
   });
  }
  if(list(scene.objects,`${path}.objects`,512)){
   objects=unique(scene.objects,`${path}.objects`);
   scene.objects.forEach((object,index)=>{
    const objectPath=`${path}.objects[${index}]`;if(!record(object)){fail(objectPath,'use a visible interaction object.');return;}
    id(object.id,`${objectPath}.id`);if(!TYPES.has(object.type))fail(`${objectPath}.type`,'choose person, door, chest, inspect or return.');
    text(object.label,`${objectPath}.label`,{max:160});if(object.actionLabel!==undefined)text(object.actionLabel,`${objectPath}.actionLabel`,{max:200});
    rectangle(object.rect,`${objectPath}.rect`,geometry.width,geometry.height);
    const target=asArray(geometry.targets).find(target=>target?.id===object.id);
    if(target&&object.type!==target.type)fail(`${objectPath}.type`,'match the corresponding interaction target type.');
    const local=content[roomId];
    if(object.type==='person'&&!asArray(local?.people).some(person=>person?.id===object.id))fail(objectPath,'reference a person in this room’s dialogue.');
    if(object.type==='inspect'&&!asArray(local?.inspections).some(entry=>entry?.id===object.id))fail(objectPath,'reference an observation in this room.');
    if(object.type==='door'){
     const door=getProjectDoor(project,object.doorId??object.id);
     if(!door||door.from!==roomId||!getProjectDoor(project,object.id)||getProjectDoor(project,object.id)!==door)fail(objectPath,'reference a door in this room with an ID the lock can resolve.');
    }
    if(object.type==='chest'){
     const source=sources[object.sourceId??object.id];
     if(!source||source.id!==object.id||source.roomId!==roomId||source.type!=='chest')fail(objectPath,'reference this room’s matching chest source.');
    }
    if(object.sourceId!==undefined){
     const source=sources[object.sourceId],inspection=asArray(local?.inspections).find(entry=>entry?.id===object.id);
     if(!source||source.roomId!==roomId||object.type==='person'&&(source.type!=='npc'||source.character!==object.id)||object.type==='inspect'&&(source.type!=='hidden'||inspection?.sourceId!==object.sourceId)||!['person','chest','inspect'].includes(object.type))fail(`${objectPath}.sourceId`,'reference a matching local source.');
    }
   });
  }
  if(targets.size!==objects.size||[...targets].some(key=>!objects.has(key)))fail(`${path}.objects`,'visible interaction IDs must exactly match geometry target IDs.');
  if(list(scene.actors,`${path}.actors`,128)){
   actors=unique(scene.actors,`${path}.actors`);
   scene.actors.forEach((actor,index)=>{
    const actorPath=`${path}.actors[${index}]`;if(!record(actor)){fail(actorPath,'use a foreground actor.');return;}
    id(actor.id,`${actorPath}.id`);if(!own(cast,actor.character))fail(`${actorPath}.character`,'reference a cast sprite.');
    point(actor.feet,`${actorPath}.feet`);number(actor.worldSize,`${actorPath}.worldSize`,16,1024);
    if(record(actor.feet)&&(actor.feet.x<0||actor.feet.y<0||actor.feet.x>geometry.width||actor.feet.y>geometry.height))fail(`${actorPath}.feet`,'keep the actor inside the room artwork.');
   });
   const peopleIds=new Set((Array.isArray(content[roomId]?.people)?content[roomId].people:[]).map(person=>person?.id));
   if(actors.size!==peopleIds.size||[...peopleIds].some(key=>!actors.has(key)))fail(`${path}.actors`,'each person needs exactly one visible foreground actor.');
   for(const personId of peopleIds)if(!asArray(scene.objects).some(object=>object?.id===personId&&object?.type==='person'))fail(`${path}.objects`,'each person needs a person interaction object and target.');
  }
  if(list(scene.occluders,`${path}.occluders`,512)){
   unique(scene.occluders,`${path}.occluders`);
   scene.occluders.forEach((mask,index)=>{
    const maskPath=`${path}.occluders[${index}]`;if(!record(mask)){fail(maskPath,'use a furniture silhouette.');return;}
    id(mask.id,`${maskPath}.id`);number(mask.depth,`${maskPath}.depth`,0,geometry.height+1024);
    if(typeof mask.clipPath!=='string'||mask.clipPath.length>65536||!/^\s*(?:path|polygon|inset|circle|ellipse)\(/i.test(mask.clipPath)||/url\s*\(|javascript|expression\s*\(|[;{}<>]/i.test(mask.clipPath))fail(`${maskPath}.clipPath`,'use a CSS shape path, without URLs or executable content.');
   });
  }
  if(errors.length===geometryStart){
   try{
    const walker=createRoomWalker({room:geometry}),spawn=walker.state;
    if(!isWalkable(geometry,geometry.start))warn(`${path}.geometry.start`,'the start is blocked; the walker will use the nearest available floor.');
    for(const target of geometry.targets){
     const route=findPath(geometry,spawn,target.approach),arrival=route?.at(-1)??spawn;
     if(!route||Math.hypot(arrival.x-target.x,arrival.y-target.y)>target.range+.001)warn(`${path}.geometry.targets.${target.id}`,'this interaction cannot currently be reached from the room start.');
    }
   }catch(error){fail(`${path}.geometry`,error instanceof Error?error.message:'invalid room geometry.');}
  }
 }
 for(const [sourceId,source]of Object.entries(sources)){
  if(!record(source))continue;
  if(source.type==='npc'){
   if(!asArray(content[source.roomId]?.people).some(person=>person?.id===source.character&&person?.sourceId===sourceId))warn(`sources.${sourceId}.character`,'no local person currently offers this source.');
  }else if(source.type==='chest'&&!asArray(scenes[source.roomId]?.objects).some(object=>object?.type==='chest'&&object.id===sourceId&&object.sourceId===sourceId))warn(`sources.${sourceId}`,'the local scene has no matching chest to collect.');
  else if(source.type==='hidden'&&!asArray(scenes[source.roomId]?.objects).some(object=>object?.type==='inspect'&&object.sourceId===sourceId))warn(`sources.${sourceId}`,'the local scene has no matching inspection to collect.');
 }
 if(!errors.length){
  const seen=new Set([project.settings.startRoomId]),queue=[project.settings.startRoomId];
  for(let index=0;index<queue.length;index++)for(const door of Object.values(doors).filter(door=>door.from===queue[index]))if(!seen.has(door.to)){seen.add(door.to);if(own(rooms,door.to))queue.push(door.to);}
  for(const roomId of Object.keys(rooms))if(!seen.has(roomId))warn(`rooms.${roomId}`,'no route from the starting room reaches this room yet.');
  const total={...project.settings.initialInventory};for(const note of project.noteKinds)total[note.id]??=0;
  for(const source of Object.values(sources))for(const kind of source.recipe)total[kind]++;
  for(const door of Object.values(doors)){
   const wanted={};for(const kind of door.recipe)wanted[kind]=(wanted[kind]??0)+1;
   if(Object.entries(wanted).some(([kind,quantity])=>quantity>total[kind]))warn(`doors.${door.id}.recipe`,'the answer needs more of a note kind than all authored supplies provide.');
  }
 }
 return {valid:errors.length===0,errors,warnings};
}

/** Expand the recognized four-room editor snapshot without replacing authored edits. */
export function upgradeLegacyProject(value){
 const errors=[];safeJson(value,errors);
 if(errors.length)throw new TypeError(errors.join('\n'));
 const project=clone(value);
 const exactKeys=(entries,keys)=>record(entries)&&Object.keys(entries).length===keys.length&&keys.every(key=>own(entries,key));
 const oldRooms=['depot','garden-porch','workshop-porch','canal-porch'];
 const oldForks=['garden-fork','workshop-fork','canal-fork'];
 const oldDoors=['garden','workshop','canal','garden-porch-forward','garden-porch-dead','workshop-porch-forward','workshop-porch-dead','canal-porch-forward','canal-porch-dead'];
 if(!record(project)||project.schemaVersion!==1||!exactKeys(project.rooms,oldRooms)||!exactKeys(project.content,oldRooms)||!exactKeys(project.scenes,oldRooms)||!exactKeys(project.previews,oldForks)||!exactKeys(project.doors,oldDoors)||!record(project.sources)||!record(project.terminals)||!record(project.settings))return project;
 if(!oldForks.every(id=>record(project.previews[id])&&project.previews[id].id===id&&project.previews[id].kind==='preview'))return project;
 const baseline=createDefaultProject(),expanded={...baseline,...project};
 for(const key of ['rooms','doors','sources','terminals','content','scenes'])expanded[key]={...baseline[key],...project[key]};
 expanded.settings={...baseline.settings,...project.settings,terminalRooms:true,completionReady:true};
 expanded.previews={};
 for(const id of oldForks){
  const {kind,...copy}=project.previews[id];
  expanded.rooms[id]={...baseline.rooms[id],...copy};
  if(copy.title){expanded.content[id].title=copy.title;expanded.scenes[id].title=copy.title;}
 }
 return expanded;
}

/** Accept only JSON data and derive timing from the edited integer half-beat units. */
export function normalizeProject(value){
 const candidate=upgradeRoomCutscenes(upgradeLegacyProject(value)),result=validateProject(candidate);
 if(!result.valid)throw new TypeError(result.errors.join('\n'));
 const project=clone(candidate);
 let separated=false;
 for(const [roomId,content]of Object.entries(project.content)){
  if(!asArray(content.cutscene).some(beat=>beat.kind===undefined))continue;
  content.cutscene=separateCutsceneTracks({scene:project.scenes[roomId],beats:content.cutscene});
  separated=true;
 }
 if(separated){const migrated=validateProject(project);if(!migrated.valid)throw new TypeError(migrated.errors.join('\n'));}
 project.noteKinds=project.noteKinds.map(note=>({...note,beats:note.units/2}));
 project.settings.initialInventory=Object.fromEntries(project.noteKinds.map(note=>[note.id,project.settings.initialInventory[note.id]??0]));
 return freeze(project);
}

/** Add room introductions to older projects without replacing authored scenes. */
export function upgradeRoomCutscenes(value){
 const errors=[];safeJson(value,errors);if(errors.length)throw new TypeError(errors.join('\n'));
 const project=clone(value);
 if(!record(project?.content))return project;
 for(const [roomId,content]of Object.entries(project.content)){
  if(!record(content)||own(content,'cutscene'))continue;
  const scene=project.scenes?.[roomId],people=new Set(asArray(content.people).map(person=>person?.id)),actors=new Set(asArray(scene?.actors).map(actor=>actor?.id)),targets=new Set(asArray(scene?.geometry?.targets).map(target=>target?.id));
  people.add('mira');actors.add('mira');
  content.cutscene=asArray(ROOM_CUTSCENES[roomId]).filter(beat=>people.has(beat.speaker)&&actors.has(beat.actor??beat.speaker)).map(beat=>{
   const copy=clone(beat);if(copy.target!==undefined&&!targets.has(copy.target))delete copy.target;return copy;
  });
 }
 return project;
}

/** The journal knows authored IDs; the runtime still records only actual events. */
export function createProjectManifest(project){
 const nodes=[...Object.values(project.rooms),...Object.values(project.previews),...Object.values(project.terminals)].map(room=>({id:room.id,title:room.title}));
 const edges=Object.values(project.doors).map(door=>({id:door.canonicalId,from:door.from,to:door.to}));
 const hints=[];
 for(const [roomId,room]of Object.entries(project.content)){
  for(const person of room.people){const route=getPersonReplies(person).find(reply=>reply.id==='route');if(route?.text.trim())hints.push({id:(roomId==='depot'?'':roomId+'-')+person.id+'-route',title:`${person.name} · ${room.title}`,text:route.text});}
  for(const entry of room.inspections)if(entry.text.trim())hints.push({id:'lore-'+entry.id,title:entry.title,text:entry.text});
 }
 const outcomes=Object.values(project.terminals).map(terminal=>({id:terminal.id,title:terminal.title,...(terminal.text?{text:terminal.text}:{})}));
 return freeze({completionReady:project.settings.completionReady===true,nodes,edges,hints,outcomes});
}
