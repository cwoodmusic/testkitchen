/** Caption-clock reactions: reading pace never retimes walking or physical gestures. */
const EMOTES=new Set(['idea','question','thinking','surprise','happy']);
const STAGE_CUES=new Set(['courier-signal','radar']);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

/** Return the actual speaking clock, including deterministic director scrubbing. */
function captionClock(state){
 const beat=state?.beat;
 if(!beat||state.finished||state.phase==='entry'||beat.kind!=='dialogue'||typeof beat.text!=='string'||!beat.text.trim())return null;
 const quantumMs=state.quantumMs;
 if(!Number.isFinite(quantumMs)||quantumMs<=0)return null;
 const elapsedMs=state.manualDialogue?state.dialogueElapsed:(state.currentTile-beat.startTile)*quantumMs;
 if(!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
 return{beat,elapsedMs,quantumMs};
}

/** A short speech reaction overrides the ordinary actor emote only while active. */
export function getDialogueReaction(state){
 const clock=captionClock(state),reaction=clock?.beat.reaction;
 if(!clock||!reaction||!EMOTES.has(reaction.emote)||!Number.isSafeInteger(reaction.durationTiles)||reaction.durationTiles<1||reaction.durationTiles>512)return null;
 const durationMs=reaction.durationTiles*clock.quantumMs;
 if(clock.elapsedMs>=durationMs||typeof clock.beat.speaker!=='string')return null;
 return{actorId:clock.beat.speaker,emote:reaction.emote,elapsedMs:clock.elapsedMs,durationMs,progress:clock.elapsedMs/durationMs};
}

/** Stage animation is authored on a line; its renderer controls the visual cycle. */
export function getDialogueStageCue(state){
 const clock=captionClock(state);
 return clock&&STAGE_CUES.has(clock.beat.stageCue)?{cue:clock.beat.stageCue,elapsedMs:clock.elapsedMs}:null;
}

/** Stock cue defaults; Pip's requested shock also follows edits to his same line. */
export const STOCK_DEPOT_DIALOGUE_EFFECTS=freeze([
 {clipId:'depot-arrival-2',speaker:'pip',text:'My courier keeps turning toward the dark route. Something is listening back, isn’t it? Please do not let the letter bite.',reaction:{emote:'surprise',durationTiles:14},stageCue:'courier-signal'},
 {clipId:'depot-arrival-4',speaker:'iris',text:'The screen receives a pulse but records no reply. I will check the interval. Letters lack the anatomy required for biting.',stageCue:'radar'},
 {clipId:'depot-arrival-6',speaker:'mira',text:'Then watch the bird: it turns before the screen flashes. Our smallest witness has spotted something we missed.',stageCue:'courier-signal'},
]);

export function upgradeStockDepotDialogueEffects(value){
 const project=structuredClone(value),clips=project?.content?.depot?.cutscene;
 if(!Array.isArray(clips))return project;
 for(const clip of clips){
  if(clip?.kind!=='dialogue')continue;
  const pip=STOCK_DEPOT_DIALOGUE_EFFECTS[0];
  if(clip.id===pip.clipId&&clip.speaker===pip.speaker&&!Object.hasOwn(clip,'reaction'))clip.reaction=structuredClone(pip.reaction);
  const stock=STOCK_DEPOT_DIALOGUE_EFFECTS.find(item=>item.clipId===clip.id&&item.speaker===clip.speaker&&item.text===clip.text);
  if(!stock)continue;
  for(const field of ['reaction','stageCue'])if(Object.hasOwn(stock,field)&&!Object.hasOwn(clip,field))clip[field]=structuredClone(stock[field]);
 }
 return project;
}
