/** Read-only story catalog and a separate, portable room-review notebook. */
import {getPersonReplies} from './developer-project.mjs';
import {getSceneDialogue} from './cutscene-dialogue.mjs';
import {STORY_INTRO_PARAGRAPHS} from './story-intro.mjs';

export const REVIEW_STORAGE_KEY='codaQuietBellRoomReviewV1';
export const MAX_REVIEW_COMMENT_LENGTH=10000;
export const ROOM_REVIEW_TYPE='coda-quiet-bell-room-review';
const MAX_DOCUMENT_TEXT=4*1024*1024,MAX_ROOMS=512,MAX_ITEMS=4096,MAX_LABEL=1000,MAX_TEXT=20000;
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
const own=(value,key)=>Object.hasOwn(value,key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const strings=(value,keys)=>keys.filter(key=>typeof value?.[key]==='string').map(key=>[key,value[key]]);
const labelFor=(value,fallback)=>typeof value==='string'&&value.trim()?value:fallback;

/** Catalog IDs point back to authored fields instead of their screen position. */
export function createRoomReviewCatalog(project){
 if(!record(project?.content)||!record(project?.scenes))throw new TypeError('A room review needs a game project with content and scenes.');
 const ids=[...new Set([...Object.keys(project.rooms??{}),...Object.keys(project.previews??{}),...Object.keys(project.terminals??{}),...Object.keys(project.content)])];
 return freeze(ids.map(id=>{
  const content=project.content[id],scene=project.scenes[id];
  if(!record(content)||!record(scene))throw new TypeError(`Room ${id} is missing its content or artwork.`);
  const sections=[];
  function section(id,label,items){if(items.length)sections.push({id,label,items});}
  const item=(id,label,text,speaker)=>({id,label,text,...(typeof speaker==='string'?{speaker}:{})});
  const names=new Map((content.people??[]).map(person=>[person.id,person.name??person.id]));names.set('mira','Mira');
  section('arrival','Arrival',[
   ...(id==='depot'?STORY_INTRO_PARAGRAPHS.map((text,index)=>item(`arrival/opening-story/${index+1}`,`Opening story · Paragraph ${index+1}`,text)):[]),
   ...strings(content,['narration','arrival']).map(([key,text])=>item(`arrival/${key}`,key==='narration'?'Room introduction':'Arrival notice',text)),
  ]);
  section('scene','Scene dialogue',getSceneDialogue({scene,beats:content.cutscene??[]}).map((line,index)=>item(`scene/${line.id}`,`Line ${index+1} · ${names.get(line.speaker)??line.speaker}`,line.text,line.speaker)));
  section('characters','Characters',(content.people??[]).flatMap(person=>{
   const prefix=`characters/${person.id}`,name=person.name??person.id;
   return [
    ...strings(person,['intro']).map(([key,text])=>item(`${prefix}/${key}`,`${name} · Opening line`,text,person.id)),
    ...getPersonReplies(person).map(reply=>item(`${prefix}/reply/${reply.id}`,`${name} · ${reply.label}`,reply.text,person.id)),
    ...strings(person,['sourceLabel']).map(([key,text])=>item(`${prefix}/${key}`,`${name} · Note gift button`,text,person.id)),
   ];
  }));
  section('inspections','Things to inspect',(content.inspections??[]).flatMap(entry=>[
   item(`inspections/${entry.id}/text`,entry.title??entry.id,entry.text),
   ...(entry.dialogue??[]).map((line,index)=>item(`inspections/${entry.id}/dialogue/${line.id??index+1}`,`${entry.title??entry.id} · ${names.get(line.speaker)??line.speaker}`,line.text,line.speaker)),
   ...strings(entry,['searchLabel']).map(([key,text])=>item(`inspections/${entry.id}/${key}`,`${entry.title??entry.id} · Search button`,text)),
  ]));
  const doors=Object.values(project.doors??{}).filter(door=>door.from===id);
  section('doors','Rhythm doors',doors.flatMap(door=>{
   const copy=content.doorCopy?.[door.id]??content.doorCopy?.[door.canonicalId]??{},name=copy.name??door.label??door.id;
   const values={name,hint:copy.hint??door.hint,...Object.fromEntries(strings(copy,['warning','previewCopy','deadCopy','repair']))};
   const labels={name:'Name',hint:'Clue',warning:'Warning',previewCopy:'Arrival text',deadCopy:'Outcome text',repair:'Recovery guidance'};
   return strings(values,Object.keys(labels)).map(([key,text])=>item(`doors/${door.id}/${key}`,`${name} · ${labels[key]}`,text));
  }));
  const outcomeItems=[];
  for(const [group,value,fields]of [
   ['ending',content.outcome,['kicker','copy','repair']],
   ['failure',content.failure,['title','copy','lesson']],
  ])for(const [key,text]of strings(value,fields))outcomeItems.push(item(`outcome/${group}/${key}`,({kicker:'Ending heading',copy:group==='ending'?'Ending':'Run-ending message',repair:'How to find another route',title:'Run-ending heading',lesson:'Clue kept for the next run'})[key],text));
  const terminal=project.terminals?.[id]??project.previews?.[id];
  if(!content.outcome&&typeof terminal?.text==='string')outcomeItems.push(item('outcome/location/text','Conclusion',terminal.text));
  section('outcome','Ending & run failure',outcomeItems);
  return {id,title:labelFor(content.title,scene.title??id),image:scene.image,scene:clone(scene),sections};
 }));
}

function safeDocument(value){
 let count=0,size=0;const ancestors=new WeakSet();
 function walk(value,depth){
  if(++count>100000||depth>16)throw new RangeError('The review file is too large or deeply nested.');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='string'){size+=value.length;if(size>MAX_DOCUMENT_TEXT)throw new RangeError('Review text must fit within 4 MiB.');return;}
  if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('Review numbers must be finite.');return;}
  if(!Array.isArray(value)&&!record(value))throw new TypeError('Use a plain JSON room-review file.');
  if(ancestors.has(value))throw new TypeError('A review cannot contain circular references.');
  ancestors.add(value);
  if(Object.getOwnPropertySymbols(value).length)throw new TypeError('Review fields must use JSON keys.');
  if(Array.isArray(value)&&Object.keys(value).length!==value.length)throw new TypeError('Review lists must contain ordinary JSON entries.');
  for(const key of Object.keys(value)){
   if(FORBIDDEN.has(key))throw new TypeError('Review files cannot contain reserved object keys.');
   if(Array.isArray(value)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))throw new TypeError('Review lists must use ordinary indexes.');
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!own(descriptor,'value'))throw new TypeError('Review files cannot contain executable fields.');
   walk(descriptor.value,depth+1);
  }
  ancestors.delete(value);
 }
 walk(value,0);
}
function text(value,label,max=MAX_TEXT){if(typeof value!=='string'||value.length>max)throw new TypeError(`${label} must be text of at most ${max} characters.`);return value;}
function identifier(value,label){if(typeof value!=='string'||!value||value.length>240||FORBIDDEN.has(value)||!/^[-a-zA-Z0-9_./:]+$/.test(value))throw new TypeError(`${label} is not a valid review ID.`);return value;}
function normalizeItem(value,{comment=false}={}){
 if(!record(value))throw new TypeError('Each dialogue review must be an object.');
 const item={id:identifier(value.id,'Dialogue ID'),label:text(value.label??value.id,'Dialogue label',MAX_LABEL),text:text(value.text??'','Original dialogue')};
 if(own(value,'speaker'))item.speaker=text(value.speaker,'Speaker',MAX_LABEL);
 if(own(value,'currentText'))item.currentText=text(value.currentText,'Current dialogue');
 if(comment)item.comment=text(value.comment??'','Change comment',MAX_REVIEW_COMMENT_LENGTH);
 return item;
}
function unique(values,label){const ids=new Set();for(const value of values){if(ids.has(value.id))throw new TypeError(`The review repeats a ${label} ID.`);ids.add(value.id);}return values;}
function normalizeSections(value){
 if(!Array.isArray(value)||value.length>64)throw new TypeError('Room context must contain a bounded section list.');
 return unique(value.map(section=>{
  if(!record(section)||!Array.isArray(section.items)||section.items.length>MAX_ITEMS)throw new TypeError('Room context must contain bounded dialogue lists.');
  return {id:identifier(section.id,'Section ID'),label:text(section.label??section.id,'Section label',MAX_LABEL),items:unique(section.items.map(item=>normalizeItem(item)),'dialogue')};
 }),'section');
}

/** Validate first; callers can retain their current notebook when an import fails. */
export function normalizeRoomReview(value){
 safeDocument(value);
 if(!record(value)||value.schemaVersion!==1||value.type!==ROOM_REVIEW_TYPE)throw new TypeError('Choose a Coda Quiet Bell room-review JSON file (version 1).');
 if(!Array.isArray(value.rooms)||value.rooms.length>MAX_ROOMS)throw new TypeError(`A review may contain at most ${MAX_ROOMS} rooms.`);
 const result={schemaVersion:1,type:ROOM_REVIEW_TYPE,gameTitle:text(value.gameTitle??'The Quiet Bell','Game title',MAX_LABEL),rooms:unique(value.rooms.map(room=>{
  if(!record(room)||typeof room.reviewed!=='boolean'||!Array.isArray(room.items)||room.items.length>MAX_ITEMS)throw new TypeError('Each reviewed room needs its check mark, comment and dialogue notes.');
  const normalized={id:identifier(room.id,'Room ID'),title:text(room.title??room.id,'Room title',MAX_LABEL),reviewed:room.reviewed,comment:text(room.comment??'','Room comment',MAX_REVIEW_COMMENT_LENGTH),items:unique(room.items.map(item=>normalizeItem(item,{comment:true})),'dialogue')};
  if(own(room,'sections'))normalized.sections=normalizeSections(room.sections);
  return normalized;
 }),'room')};
 if(own(value,'generatedAt')){if(typeof value.generatedAt!=='string'||value.generatedAt.length>80||!Number.isFinite(Date.parse(value.generatedAt)))throw new TypeError('The review date is invalid.');result.generatedAt=value.generatedAt;}
 if(own(value,'release'))result.release=text(value.release,'Release',120);
 return freeze(result);
}

/** This notebook never reads or writes inventory, puzzles, dialogue or game saves. */
export function createRoomReview({catalog,saved,gameTitle='The Quiet Bell'}={}){
 if(!Array.isArray(catalog)||catalog.length>MAX_ROOMS)throw new TypeError('A room-review catalog must be a bounded list.');
 const roomCatalog=new Map(),itemCatalog=new Map();
 for(const room of catalog){
  identifier(room.id,'Room ID');if(roomCatalog.has(room.id))throw new TypeError('The catalog repeats a room ID.');
  roomCatalog.set(room.id,room);
  const items=new Map();for(const section of room.sections)for(const item of section.items){identifier(item.id,'Dialogue ID');if(items.has(item.id))throw new TypeError('The catalog repeats a dialogue ID.');items.set(item.id,item);}itemCatalog.set(room.id,items);
 }
 text(gameTitle,'Game title',MAX_LABEL);
 function checkedDocument(value){
  const normalized=normalizeRoomReview(value),ids=new Set([...roomCatalog.keys(),...normalized.rooms.map(room=>room.id)]);
  if(ids.size>MAX_ROOMS)throw new RangeError(`The imported review and current game together may contain at most ${MAX_ROOMS} rooms.`);
  return clone(normalized);
 }
 let document=saved===undefined||saved===null?{schemaVersion:1,type:ROOM_REVIEW_TYPE,gameTitle,rooms:[]}:checkedDocument(saved);
 function combined(){
  const existing=new Map(document.rooms.map(room=>[room.id,room]));
  return [...catalog.map(room=>({id:room.id,title:room.title,reviewed:false,comment:'',items:[],...existing.get(room.id)})),...document.rooms.filter(room=>!roomCatalog.has(room.id))];
 }
 function snapshot(){return {schemaVersion:1,type:ROOM_REVIEW_TYPE,gameTitle:document.gameTitle,rooms:clone(combined())};}
 function currentRoom(id){identifier(id,'Room ID');const room=combined().find(room=>room.id===id);if(!room)throw new RangeError('Choose a room in this review.');return room;}
 function updateRoom(next){const before=document.rooms.findIndex(room=>room.id===next.id);if(before<0)document.rooms.push(next);else document.rooms[before]=next;}
 return Object.freeze({
  get state(){return freeze(snapshot());},
  setRoomComment(id,value){const comment=text(value,'Room comment',MAX_REVIEW_COMMENT_LENGTH),room=currentRoom(id);if(room.comment===comment)return false;updateRoom({...room,comment});return true;},
  setReviewed(id,reviewed){if(typeof reviewed!=='boolean')throw new TypeError('A reviewed check mark must be true or false.');const room=currentRoom(id);if(room.reviewed===reviewed)return false;updateRoom({...room,reviewed});return true;},
  setItemComment(roomId,itemId,value){
   identifier(itemId,'Dialogue ID');const comment=text(value,'Change comment',MAX_REVIEW_COMMENT_LENGTH),room=currentRoom(roomId),existing=room.items.find(item=>item.id===itemId),source=itemCatalog.get(roomId)?.get(itemId);
   if(!source&&!existing)throw new RangeError('Choose a dialogue line in this review.');
   if((existing?.comment??'')===comment)return false;
   const items=room.items.filter(item=>item.id!==itemId);
   if(comment.length)items.push({...normalizeItem(existing??source),comment});
   updateRoom({...room,items});return true;
  },
  import(value){const normalized=checkedDocument(value);document=normalized;return true;},
  serialize(){return snapshot();},
  export({now=new Date(),release}={}){
   const date=new Date(now);if(!Number.isFinite(date.getTime()))throw new TypeError('Choose a valid export date.');
   const exported={...snapshot(),generatedAt:date.toISOString()};
   if(release!==undefined)exported.release=text(release,'Release',120);
   else if(document.release!==undefined)exported.release=document.release;
   for(const room of exported.rooms){
    const source=roomCatalog.get(room.id);if(!source)continue;
    room.title=source.title;room.sections=source.sections.map(section=>({id:section.id,label:section.label,items:section.items.map(item=>normalizeItem(item))}));
    for(const item of room.items){const current=itemCatalog.get(room.id).get(item.id);if(current&&current.text!==item.text)item.currentText=current.text;}
   }
   // Full dialogue context is assembled only for export. Check the completed
   // file here so every download can be imported under the same data limits.
   normalizeRoomReview(exported);
   return exported;
  },
 });
}
