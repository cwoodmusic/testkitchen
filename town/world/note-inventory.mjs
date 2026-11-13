export const INVENTORY_NOTE_VALUES=Object.freeze(['quarter','eighth-pair','sixteenth-group','quarter-rest']);
export const NOTE_INVENTORY_LIMIT=1000000;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function normalizeYellowNotes(raw){
 return Object.fromEntries(INVENTORY_NOTE_VALUES.map(value=>[value,Number.isSafeInteger(raw?.[value])&&raw[value]>0?Math.min(NOTE_INVENTORY_LIMIT,raw[value]):0]));
}
export function normalizeNPCRhythmWins(raw){
 const result={};if(!record(raw))return result;
 for(const [id,count]of Object.entries(raw).slice(0,200))if(/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)&&id!=='__proto__'&&id!=='constructor'&&Number.isSafeInteger(count)&&count>0)result[id]=Math.min(NOTE_INVENTORY_LIMIT,count);
 return result;
}
export function createNoteInventory(journal){
 let error='';
 function requirements(values){
  if(!Array.isArray(values)||!values.length||values.some(value=>!INVENTORY_NOTE_VALUES.includes(value)))return null;
  const needed=normalizeYellowNotes();for(const value of values)needed[value]++;return needed;
 }
 function save(data,before){
  try{if(journal.save()!==false){error='';return true;}}catch{}
  data.yellowNotes=before.yellowNotes;data.stars=before.stars;data.npcRhythmWins=before.npcRhythmWins;
  error=journal.warning||'Your note inventory could not be saved. Please try again.';return false;
 }
 function snapshot(data){return {yellowNotes:data.yellowNotes,stars:data.stars,npcRhythmWins:data.npcRhythmWins};}
 return {
  get counts(){return normalizeYellowNotes(journal.data.yellowNotes);},
  get total(){return Object.values(this.counts).reduce((a,b)=>a+b,0);},
  get error(){return error;},
  add(value){
   if(!INVENTORY_NOTE_VALUES.includes(value))return false;const data=journal.data,counts=normalizeYellowNotes(data.yellowNotes);
   if(counts[value]>=NOTE_INVENTORY_LIMIT){error='Your collection of this note is full.';return false;}
   const before=snapshot(data);counts[value]++;data.yellowNotes=counts;return save(data,before);
  },
  canSpend(values){const needed=requirements(values);if(!needed)return false;const counts=this.counts;return INVENTORY_NOTE_VALUES.every(value=>counts[value]>=needed[value]);},
  spend(values,{npcId,stars=1}={}){
   const needed=requirements(values);if(!needed||typeof npcId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(npcId)||npcId==='constructor'||npcId==='__proto__'||!Number.isSafeInteger(stars)||stars<0||stars>3)return false;
   const data=journal.data,counts=normalizeYellowNotes(data.yellowNotes);if(INVENTORY_NOTE_VALUES.some(value=>counts[value]<needed[value])){error='Catch the missing yellow notes before building this rhythm.';return false;}
   const before=snapshot(data),wins=normalizeNPCRhythmWins(data.npcRhythmWins);for(const value of INVENTORY_NOTE_VALUES)counts[value]-=needed[value];
   data.yellowNotes=counts;data.stars=Math.min(10000000,(Number.isSafeInteger(data.stars)&&data.stars>=0?data.stars:0)+stars);wins[npcId]=Math.min(NOTE_INVENTORY_LIMIT,(Object.hasOwn(wins,npcId)?wins[npcId]:0)+1);data.npcRhythmWins=wins;
   return save(data,before);
  }
 };
}
