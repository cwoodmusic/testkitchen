/** Speech cues affect presentation only; authored movement and timing stay intact. */
export const SPEAKER_CUE_DURATION_MS=1600;
const FADE_MS=200;
const EMPTY_ACTORS=Object.freeze([]);
const located=actor=>actor&&typeof actor.id==='string'&&actor.id.trim()&&Number.isFinite(actor.x)&&Number.isFinite(actor.y);
const idle=actor=>located(actor)&&!actor.moving&&!actor.gesture&&(actor.action==null||actor.action==='look');
const apart=(first,second)=>first.id!==second.id&&(first.x!==second.x||first.y!==second.y);

function speaking(state){
 const beat=state?.beat;
 if(!beat||state.finished||state.phase==='entry'||beat.kind!==undefined&&beat.kind!=='dialogue'||typeof beat.text!=='string'||!beat.text.trim())return null;
 if(typeof beat.speaker!=='string'||!beat.speaker.trim()||!Array.isArray(state.actors))return null;
 const speaker=state.actors.find(actor=>located(actor)&&actor.id===beat.speaker);
 if(!speaker||!Number.isFinite(state.quantumMs)||state.quantumMs<=0)return null;
 const elapsedMs=state.manualDialogue?state.dialogueElapsed:(state.currentTile-beat.startTile)*state.quantumMs;
 if(!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
 return{speaker,elapsedMs};
}

/** The badge ends while the caption remains active, without a separate timer. */
export function getSpeakerCues(state,{reducedMotion=false}={}){
 const speech=speaking(state);if(!speech)return null;
 const showMarker=speech.elapsedMs<SPEAKER_CUE_DURATION_MS;
 const opacity=showMarker?(reducedMotion?1:Math.min(1,(SPEAKER_CUE_DURATION_MS-speech.elapsedMs)/FADE_MS)):0;
 return{speakerId:speech.speaker.id,elapsedMs:speech.elapsedMs,durationMs:SPEAKER_CUE_DURATION_MS,opacity,showMarker};
}

function facing(from,to){
 const dx=to.x-from.x,dy=to.y-from.y;
 return Math.abs(dx)>=Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
}

/** Idle companions acknowledge the voice; busy actors keep their authored pose. */
export function getConversationActors(state){
 const actors=Array.isArray(state?.actors)?state.actors:EMPTY_ACTORS,speech=speaking(state);
 if(!speech)return actors;
 const speaker=speech.speaker;
 let listener=null,nearest=Infinity;
 for(const actor of actors){
  if(!idle(actor)||!apart(actor,speaker))continue;
  const distance=(actor.x-speaker.x)**2+(actor.y-speaker.y)**2;
  if(distance<nearest){nearest=distance;listener=actor;}
 }
 let changed=false;
 const visual=actors.map(actor=>{
  if(!idle(actor))return actor;
  const target=actor.id===speaker.id?listener:speaker;
  if(!target||!apart(actor,target))return actor;
  const direction=facing(actor,target);
  if(actor.facing===direction)return actor;
  changed=true;return{...actor,facing:direction};
 });
 return changed?visual:actors;
}
