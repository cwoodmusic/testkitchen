/** Pure speech authoring. Walking, reactions and physical actions own other tracks. */
import {compileRoomCutscene} from './cutscene.mjs';

const MAX_CLIPS=384;
const MAX_TEXT=600;
const clone=value=>structuredClone(value);
const speech=beat=>beat?.kind==='dialogue';
const selected=(beats,index)=>Number.isInteger(index)&&index>=0&&speech(beats[index]);
function source(beats){
 if(!Array.isArray(beats))throw new TypeError('Cutscene clips must be an array.');
 return beats;
}
function withinCapacity(beats){
 source(beats);
 if(beats.length>MAX_CLIPS)throw new RangeError(`A room can contain at most ${MAX_CLIPS} cutscene clips.`);
}
function nextId(beats){
 const ids=new Set(beats.map(beat=>beat?.id));
 let number=1;
 while(ids.has(`dialogue-${number}`))number++;
 return `dialogue-${number}`;
}

/** Pin inherited timing within an edit transaction, so neighboring edits cannot restage it. */
export function pinCutsceneTiming({scene,beats=[]}={}){
 withinCapacity(beats);
 const clips=compileRoomCutscene({scene,beats,playerPosition:scene.geometry.start}).clips;
 if(!clips.some(clip=>beats[clip.index].startTile===undefined||beats[clip.index].durationTiles===undefined))return beats;
 const result=clone(beats);
 for(const clip of clips){
  if(result[clip.index].startTile===undefined)result[clip.index].startTile=clip.startTile;
  if(result[clip.index].durationTiles===undefined)result[clip.index].durationTiles=clip.durationTiles;
 }
 return result;
}

/** Raw indexes remain the edit keys; timing and order match the real player. */
export function getSceneDialogue({scene,beats=[]}={}){
 withinCapacity(beats);
 return compileRoomCutscene({scene,beats,playerPosition:scene.geometry.start}).clips.filter(speech).map(clip=>({
  index:clip.index,id:clip.id,actor:clip.actor,speaker:clip.speaker,text:clip.text,
  startTile:clip.startTile,durationTiles:clip.durationTiles,endTile:clip.endTile,
 }));
}

/** Only text and speaker can be edited here. Lane ownership stays independent. */
export function updateDialogue(beats,index,patch={}){
 source(beats);
 if(!selected(beats,index))return beats;
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new TypeError('A dialogue edit needs text or a speaker.');
 const hasText=Object.hasOwn(patch,'text'),hasSpeaker=Object.hasOwn(patch,'speaker');
 if(hasText&&typeof patch.text!=='string')throw new TypeError('Dialogue text must be a string.');
 if(hasText&&patch.text.length>MAX_TEXT)throw new RangeError(`A dialogue line can contain at most ${MAX_TEXT} characters.`);
 if(hasSpeaker&&typeof patch.speaker!=='string')throw new TypeError('A dialogue speaker must be a local character ID.');
 const before=beats[index];
 if((!hasText||before.text===patch.text)&&(!hasSpeaker||before.speaker===patch.speaker))return beats;
 const result=clone(beats),line=result[index];
 if(hasText)line.text=patch.text;
 if(hasSpeaker){
  // A speaker-only legacy lane must keep its former owner when its voice changes.
  if(line.actor===undefined)line.actor=before.speaker;
  line.speaker=patch.speaker;
 }
 return result;
}

/** Add a blank three-second line immediately after the selected spoken line. */
export function insertDialogue({scene,beats=[],afterIndex,speaker}={}){
 withinCapacity(beats);
 if(beats.length===MAX_CLIPS)throw new RangeError(`A room can contain at most ${MAX_CLIPS} cutscene clips.`);
 const lines=getSceneDialogue({scene,beats});
 const position=afterIndex===undefined?lines.length-1:lines.findIndex(line=>line.index===afterIndex);
 if(afterIndex!==undefined&&position<0)return beats;
 const previous=lines[position],voice=speaker??previous?.speaker??'mira';
 if(typeof voice!=='string')throw new TypeError('A dialogue speaker must be a local character ID.');
 const quantumMs=scene.geometry.gridSize/scene.geometry.speed*1000;
 const durationTiles=Math.max(1,Math.ceil(3000/quantumMs));
 const startTile=previous?.endTile??0;
 const actor=voice==='mira'||scene.actors?.some(actor=>actor.id===voice)?voice:'mira';
 const added={id:nextId(beats),kind:'dialogue',actor,speaker:voice,text:'',startTile,durationTiles};
 const result=clone(beats);
 let cursor=startTile+durationTiles;
 // Existing pauses survive. Later speech moves only when the new line needs room.
 for(const line of lines.slice(position+1)){
  const nextStart=Math.max(line.startTile,cursor);
  if(nextStart!==line.startTile)result[line.index].startTile=nextStart;
  cursor=nextStart+line.durationTiles;
 }
 result.splice(previous?previous.index+1:result.length,0,added);
 return result;
}

/** Delete speech alone, leaving all other clips and their authored timing intact. */
export function removeDialogue(beats,index){
 source(beats);
 if(!selected(beats,index))return beats;
 const result=clone(beats);result.splice(index,1);return result;
}

/** Reorder speech by changing only its starts, retaining every authored duration. */
export function moveDialogue({scene,beats=[],index,direction}={}){
 withinCapacity(beats);
 if(direction!=='up'&&direction!=='down')return beats;
 const lines=getSceneDialogue({scene,beats}),position=lines.findIndex(line=>line.index===index);
 const destination=position+(direction==='up'?-1:1);
 if(position<0||destination<0||destination>=lines.length)return beats;
 let cursor=lines[0].startTile;
 [lines[position],lines[destination]]=[lines[destination],lines[position]];
 const result=clone(beats);
 for(const line of lines){result[line.index].startTile=cursor;cursor+=line.durationTiles;}
 return result;
}
