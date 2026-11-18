/** Run losses teach a route lesson; discoveries never refill the next bag. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export const RUN_FAILURE_COPY=freeze({
 'dead-brambles':{
  title:'The service gate needs different notes',
  copy:'The garden service gate needs a half note and a half rest. Iris offers those notes on her porch, but gifts can only be collected before leaving their room. This run needs a new plan. You can examine the gate and talk to everyone before starting again.',
  lesson:'Ask Iris for her notes before leaving her porch. The overgrown arch spends the dotted half and quarter notes needed later; the service gate costs another four beats.',
 },
 'dead-aviary':{
  title:'The service gate needs different notes',
  copy:'The workshop service gate needs a half note, paired eighth notes, and four sixteenth notes. Pip offers that set in his workshop. This bag cannot pay the gate, so this run needs a new plan. You can listen and look around before starting again.',
  lesson:'Ask Pip for his notes before leaving the workshop. The old aviary spends the dotted half and quarter notes needed later; its service gate costs another four beats.',
 },
 'garden-secret-final':{
  title:'Save a key for the listening window',
  copy:'The listening window still needs its own key. The overgrown arch uses the dotted half and quarter notes that this final lock needs. Hidden notes pay their own extra gate, so they cannot replace that key. Read the clues here, then try a new route from the depot.',
  lesson:'Save a dotted half note and a quarter note for the listening window. Spending them at the overgrown arch leaves no final key, even after finding the hidden notes.',
 },
 'workshop-secret-final':{
  title:'Save a key for the birds',
  copy:'The birds’ final lock needs a dotted half note and a quarter note. The old aviary uses those same notes, and its service gate adds another payment. The hidden perch notes pay their own gate. Listen to this lock and keep the clue for your next run.',
  lesson:'Save a dotted half note and a quarter note for the birds’ final lock. The old aviary and its service gate use notes that the shorter route can keep.',
 },
 'canal-final':{
  title:'The bell still needs a key',
  copy:'Reaching the bell is only part of the journey. The copied waterway’s service stair costs an extra four beats, and the bell still needs its own four-beat key. You can hear the lock and talk to everyone here, then start again with what you learned.',
  lesson:'Count both the trip and the last lock. The copied waterway adds a four-beat service stair; the direct stair leaves those notes available for the public bell.',
 },
});

export const PAID_DOOR_LESSON=freeze({
 id:'lesson-paid-doors',title:'Plan the whole note bag',
 text:'A paid door keeps its notes. Wrong rhythm guesses spend nothing, and Undo can return notes from an unfinished answer. A new run starts with a new bag, but the discovered map and journal stay. Collect gifts before leaving and save notes for later locks.',
});

/** Authors can change or disable each passage without a later load replacing it. */
export function upgradeRunFailureCopy(project){
 const updated=structuredClone(project);
 if(updated?.settings?.replayRisk!==true)return updated;
 for(const [id,copy]of Object.entries(RUN_FAILURE_COPY)){
  const content=updated?.content?.[id];
  if(content&&typeof content==='object'&&!Array.isArray(content)&&!Object.hasOwn(content,'failure'))content.failure=structuredClone(copy);
 }
 return updated;
}

/** These are optional discovered hints, never required chart outcomes. */
export function runFailureLessons(project){
 if(project?.settings?.replayRisk!==true)return [];
 return [structuredClone(PAID_DOOR_LESSON),...Object.entries(project.content??{}).flatMap(([id,content])=>{
  const lesson=content?.failure?.lesson;
  return typeof lesson==='string'&&lesson.trim()?[{id:'lesson-'+id,title:`${content.title??id} · A plan for next time`,text:lesson}]:[];
 })];
}
