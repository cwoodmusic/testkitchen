/** Refresh known stock words while keeping each saved project's authoring intact. */
import {STORY_COPY_UPDATES,STORY_COPY_INSPECTION_SCRIPTS} from './story-copy-data.mjs';

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
const list=value=>Array.isArray(value)?value:[];
const own=(value,key)=>record(value)&&Object.hasOwn(value,key);

function characterFor(project,roomId,id){
 const actors=list(project.scenes?.[roomId]?.actors).filter(actor=>record(actor)&&actor.id===id);
 if(actors.length===1&&typeof actors[0].character==='string')return actors[0].character;
 return id;
}

function speakerMatches(project,roomId,speaker,expected){
 return typeof speaker==='string'&&(speaker===expected||characterFor(project,roomId,speaker)===expected);
}

function oldDiscussionMatches(project,roomId,entry,expected){
 const actual=entry?.dialogue;
 return Array.isArray(actual)&&actual.length===expected.length&&actual.every((line,index)=>record(line)&&line.text===expected[index].text&&speakerMatches(project,roomId,line.speaker,expected[index].speaker));
}

function inspectionAlias(project,roomId,selector){
 const script=STORY_COPY_INSPECTION_SCRIPTS[selector.inspection];
 if(!Array.isArray(script))return null;
 const entries=list(project.content?.[roomId]?.inspections);
 const exact=entries.filter(entry=>record(entry)&&entry.id===selector.id);
 if(exact.length===1)return exact[0].id;
 if(exact.length)return null;
 const matching=entries.filter(entry=>record(entry)&&oldDiscussionMatches(project,roomId,entry,script));
 return matching.length===1?matching[0].id:null;
}

function selectIndex(project,roomId,entries,selector){
 if(!record(selector))return -1;
 let candidates=list(entries).map((entry,index)=>({entry,index})).filter(({entry})=>record(entry));
 if(typeof selector.id==='string'){
  const exact=candidates.filter(({entry})=>entry.id===selector.id);
  if(exact.length)candidates=exact;
  else if(typeof selector.character==='string'){
   candidates=candidates.filter(({entry})=>characterFor(project,roomId,entry.id)===selector.character);
  }else if(typeof selector.inspection==='string'){
   const alias=inspectionAlias(project,roomId,selector);
   candidates=alias===null?[]:candidates.filter(({entry})=>entry.id===alias);
  }else candidates=[];
 }
 if(typeof selector.speaker==='string')candidates=candidates.filter(({entry})=>speakerMatches(project,roomId,entry.speaker??entry.actor,selector.speaker));
 if(typeof selector.previousText==='string')candidates=candidates.filter(({entry})=>entry.text===selector.previousText);
 return candidates.length===1?candidates[0].index:-1;
}

function resolvePath(project,path){
 if(!Array.isArray(path)||!path.length)return null;
 const roomId=['content','scenes'].includes(path[0])?path[1]:null;
 const resolved=[];let current=project;
 for(const part of path){
  if(record(part)){
   if(!Array.isArray(current))return null;
   const index=selectIndex(project,roomId,current,part);if(index<0)return null;
   resolved.push(index);current=current[index];
  }else{
   if(typeof part!=='string'||FORBIDDEN.has(part)||!own(current,part))return null;
   resolved.push(part);current=current[part];
  }
 }
 return resolved;
}

function atPath(value,path){return path.reduce((current,key)=>current?.[key],value);}

/** Only exact, already-present stock strings are changed; null and missing stay intentional. */
export function upgradeStoryCopy(project){
 const upgraded=structuredClone(project);
 if(!record(project))return upgraded;
 for(const update of STORY_COPY_UPDATES){
  const field=update.path.at(-1);
  if(typeof field!=='string'||FORBIDDEN.has(field))continue;
  const desiredText=project.settings?.replayRisk===true?update.text:(update.classicText??update.text);
  const parentPath=resolvePath(project,update.path.slice(0,-1));if(!parentPath)continue;
  const path=[...parentPath,field];
  if(atPath(project,path)===update.previousText){
   const parent=atPath(upgraded,path.slice(0,-1));parent[path.at(-1)]=desiredText;
  }
  // Older editor versions materialized these three legacy fields as replies.
  // Keep reply IDs, labels, demonstrations, order and private metadata untouched.
  if(update.path[0]==='content'&&update.path[2]==='people'&&update.path.length===5&&['story','route','inventory'].includes(update.path[4])){
   const originalPerson=atPath(project,path.slice(0,-1)),person=atPath(upgraded,path.slice(0,-1));
   for(const [index,reply]of list(originalPerson?.replies).entries())if(record(reply)&&reply.text===update.previousText)person.replies[index].text=desiredText;
  }
 }
 return upgraded;
}
