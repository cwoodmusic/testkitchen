/** Verified replay-risk campaign: seventeen rooms, twenty-five keys and six outcomes. */
import {CAMPAIGN_PLAN} from './campaign-data.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const uiId=id=>id.startsWith('depot-')?id.slice('depot-'.length):id;
const stages=new Map([[CAMPAIGN_PLAN.entry,1]]);
for(const room of CAMPAIGN_PLAN.rooms){
 const stage=stages.get(room.id)??1;
 for(const door of room.doors)stages.set(door.to,Math.max(stages.get(door.to)??0,stage+1));
}
export const CHAPTER_ENTRY=CAMPAIGN_PLAN.entry;
export const CHAPTER_REPLAY_RISK=CAMPAIGN_PLAN.replayRisk??null;
export const CHAPTER_ROOMS=freeze(Object.fromEntries(CAMPAIGN_PLAN.rooms.map(room=>[room.id,{
 id:room.id,title:room.title,stage:stages.get(room.id),sources:room.sources.map(source=>source.id),doors:room.doors.map(door=>uiId(door.id)),...(room.description?{description:room.description}:{})
}])));
export const CHAPTER_SOURCES=freeze(Object.fromEntries(CAMPAIGN_PLAN.rooms.flatMap(room=>room.sources.map(source=>[source.id,{...source,roomId:room.id}]))));
export const CHAPTER_DOORS=freeze(Object.fromEntries(CAMPAIGN_PLAN.rooms.flatMap(room=>room.doors.map(door=>[uiId(door.id),{...door,id:uiId(door.id),canonicalId:door.id,from:room.id}]))));
export const CHAPTER_PREVIEWS=Object.freeze({});
export const CHAPTER_TERMINALS=freeze(Object.fromEntries(CAMPAIGN_PLAN.terminals.map(terminal=>[terminal.id,{...terminal,stage:stages.get(terminal.id)}])));
export const CHAPTER_LOCATIONS=Object.freeze({...CHAPTER_ROOMS,...CHAPTER_TERMINALS});
export function getChapterDoor(id){
 if(typeof id!=='string')return null;
 if(Object.hasOwn(CHAPTER_DOORS,id))return CHAPTER_DOORS[id];
 return Object.values(CHAPTER_DOORS).find(door=>door.canonicalId===id)??null;
}
