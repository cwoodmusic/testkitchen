/* Shared offline validation. Imported content is data and is never executed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaWorkshopValidation=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const FORMAT='CodaContentWorkshop',VERSION=1;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function validate(pack){
  const errors=[],warnings=[];
  if(!object(pack)||pack.format!==FORMAT||pack.version!==VERSION)return {ok:false,errors:['Choose a Coda Content Workshop version 1 JSON file.'],warnings};
  if(!object(pack.content)||!object(pack.baseline)||!object(pack.applicationMap))return {ok:false,errors:['The content, baseline and application map are required.'],warnings};
  if(!object(pack.baseline.sourceHashes)||!object(pack.baseline.literalAnchors))errors.push('Baseline source hashes and literal anchors are required.');
  for(const file of Object.keys(pack.baseline.sourceHashes||{}))if(!/^[A-Za-z0-9_-]+\.(?:js|json|html)$/.test(file))errors.push('Unsupported baseline source path: '+file);
  for(const[id,anchor]of Object.entries(pack.baseline.literalAnchors||{}))if(!object(anchor)||!Object.hasOwn(pack.baseline.sourceHashes||{},anchor.file)||!Number.isSafeInteger(anchor.start)||!Number.isSafeInteger(anchor.end)||anchor.start<0||anchor.end<=anchor.start)errors.push('Invalid source anchor: '+id);
  const required=['conversations','classroom','referenceLibrary','history','historyProgression','missions','trivia','piano','fishing','playerProgression','dance','additionalCopy','advancedValues'];
  for(const key of required)if(!(key in pack.content))errors.push('Missing section: '+key);
  function walk(value,path){
   if(typeof value==='number'&&!Number.isFinite(value))errors.push(path+': enter a finite number.');
   if(Array.isArray(value)){
    const ids=value.filter(object).map(v=>v.id).filter(id=>typeof id==='string');
    if(new Set(ids).size!==ids.length)errors.push(path+': duplicate IDs in this list.');
    value.forEach((item,index)=>walk(item,path+'/'+index));return;
   }
   if(!object(value))return;
   const choices=value.answers||value.choices;
   if(Array.isArray(choices)&&('prompt' in value||'question' in value)){
    if(choices.length<2)errors.push(path+': a question needs at least two answers.');
    const answer=value.correct??value.answer;
    if(typeof answer==='number'&&(!Number.isInteger(answer)||answer<0||answer>=choices.length))errors.push(path+': correct answer must be an index from 0 to '+(choices.length-1)+'.');
    if(typeof answer==='string'&&choices.every(object)&&!choices.some(choice=>choice.id===answer))errors.push(path+': answer ID does not match a choice.');
    const texts=choices.map(choice=>typeof choice==='string'?choice:choice?.text).filter(v=>typeof v==='string');
    if(texts.some(text=>!text.trim()))errors.push(path+': answer choices cannot be blank.');
    if(new Set(texts.map(text=>text.trim().toLowerCase())).size!==texts.length)warnings.push(path+': two answers have the same wording.');
   }
   for(const[key,item]of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(key)){errors.push(path+': reserved object key '+key);continue;}
    walk(item,path+'/'+key);
   }
  }
  walk(pack.content,'content');
  const collections=pack.content.history?.collections||{},facts=new Set(Object.values(collections).flatMap(person=>person.facts||[]).map(fact=>fact.id));
  for(const q of pack.content.history?.questions||[])if(q.factId&&!facts.has(q.factId))errors.push('History question '+q.id+' refers to missing fact '+q.factId+'.');
  for(const section of ['additionalCopy','advancedValues'])for(const item of pack.content[section]||[]){
   const anchor=pack.baseline.literalAnchors?.[item.id];
   if(!anchor)errors.push(section+': unknown source entry '+item.id+'.');
   else if(typeof item.value!==typeof anchor.original)errors.push(item.id+': keep the original value type ('+typeof anchor.original+').');
  }
  const thresholds=pack.content.playerProgression?.THRESHOLDS;
  if(Array.isArray(thresholds)&&thresholds.some((n,i)=>!Number.isFinite(n)||n<0||i&&n<=thresholds[i-1]))errors.push('Player XP thresholds must increase and cannot be negative.');
  const h=pack.content.historyProgression;
  if(h?.PASS_SCORE!==undefined&&(h.PASS_SCORE<0||h.PASS_SCORE>100))errors.push('History pass percentage must be from 0 to 100.');
  return {ok:errors.length===0,errors,warnings};
 }
 function diff(before,after,path='',out=[]){
  if(JSON.stringify(before)===JSON.stringify(after))return out;
  if((object(before)&&object(after))||(Array.isArray(before)&&Array.isArray(after))){
   for(const key of new Set([...Object.keys(before),...Object.keys(after)]))diff(before[key],after[key],path+'/'+String(key).replace(/~/g,'~0').replace(/\//g,'~1'),out);
  }else out.push({path,before,after});
  return out;
 }
 return {FORMAT,VERSION,validate,diff};
});
