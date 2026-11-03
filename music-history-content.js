/* Authored history content is project data; player discoveries keep stable IDs. */
(function(root,factory){
 'use strict';
 const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('./music-history-data.js'):root.CodaMusicHistoryData,common?require('./music-history-quiz-data.js'):root.CodaMusicHistoryQuizData,common?require('./music-history-legacy.js'):root.CodaMusicHistoryLegacy);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaMusicHistoryContent=api;
})(typeof window==='undefined'?null:window,function(PEOPLE,QUIZ_DATA,LEGACY){
 'use strict';
 const LIMITS=Object.freeze({fact:1200,prompt:300,choice:200});
 const FACTS=Object.freeze(Object.values(PEOPLE).flatMap(person=>person.facts));
 const QUESTIONS=Object.freeze((Array.isArray(QUIZ_DATA)?QUIZ_DATA:QUIZ_DATA?.QUESTIONS||[]).slice());
 const BY_FACT=new Map(FACTS.map(fact=>[fact.id,fact])),BY_QUIZ=new Map(QUESTIONS.map(question=>[question.id,question]));
 const LEGACY_FACTS=new Set(LEGACY.FACT_IDS),LEGACY_QUIZZES=LEGACY.QUIZ_FACTS;
 const KNOWN_FACTS=new Set([...LEGACY_FACTS,...BY_FACT.keys()]),KNOWN_QUIZZES=new Set([...Object.keys(LEGACY_QUIZZES),...BY_QUIZ.keys()]);
 const EMPTY=Object.freeze({version:2,facts:Object.freeze({}),quizzes:Object.freeze({})});
 const own=(value,key)=>Object.hasOwn(value,key);
 const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 const keys=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));
 const text=(value,max)=>typeof value==='string'&&value.length<=max&&value.trim().length>0;
 function validQuiz(value,source){
  return record(value)&&keys(value,['prompt','choices','answer'])&&['prompt','choices','answer'].every(key=>own(value,key))&&text(value.prompt,LIMITS.prompt)&&Array.isArray(value.choices)&&value.choices.length===source.choices.length&&value.choices.every(choice=>text(choice,LIMITS.choice))&&new Set(value.choices.map(choice=>choice.trim().toLowerCase())).size===value.choices.length&&Number.isSafeInteger(value.answer)&&value.answer>=0&&value.answer<value.choices.length;
 }
 function validate(value){
  try{
   if(!record(value)||![1,2].includes(value.version)||!keys(value,value.version===1?['version','facts','quizzes']:['version','facts','quizzes','archivedQuizzes'])||!['version','facts','quizzes'].every(key=>own(value,key))||!record(value.facts)||!record(value.quizzes))return false;
   const factIDs=value.version===1?LEGACY_FACTS:KNOWN_FACTS;
   const quizIDs=value.version===1?new Set(Object.keys(LEGACY_QUIZZES)):KNOWN_QUIZZES;
   const validQuizzes=map=>record(map)&&Object.keys(map).length<=KNOWN_QUIZZES.size&&Object.entries(map).every(([id,question])=>quizIDs.has(id)&&BY_QUIZ.has(id)&&validQuiz(question,BY_QUIZ.get(id)));
   return Object.keys(value.facts).length<=factIDs.size&&Object.entries(value.facts).every(([id,value])=>factIDs.has(id)&&text(value,LIMITS.fact))&&validQuizzes(value.quizzes)&&(!own(value,'archivedQuizzes')||validQuizzes(value.archivedQuizzes));
  }catch{return false;}
 }
 const cleanQuiz=input=>({prompt:input.prompt.trim(),choices:input.choices.map(choice=>choice.trim()),answer:input.answer});
 const changedQuiz=(next,base)=>next.prompt!==base.prompt||next.answer!==base.answer||next.choices.some((choice,index)=>choice!==base.choices[index]);
 function normalize(value){
  if(!validate(value))return null;
  const facts={},quizzes={},archivedQuizzes={};
  for(const id of KNOWN_FACTS)if(own(value.facts,id)){
   const next=value.facts[id].trim(),base=BY_FACT.get(id);
   // Retired text is kept for project backups, but never appears in current lessons.
   if(!base||next!==base.text)facts[id]=next;
  }
  for(const id of KNOWN_QUIZZES)if(own(value.archivedQuizzes||{},id))archivedQuizzes[id]=cleanQuiz(value.archivedQuizzes[id]);
  for(const question of QUESTIONS)if(own(value.quizzes,question.id)){
   const next=cleanQuiz(value.quizzes[question.id]);
   // Version 1 quiz edits belong to their original source fact. A remapped quiz
   // must use the new lesson until the author deliberately writes a new edit.
   if(value.version===1&&LEGACY_QUIZZES[question.id]!==question.factId)archivedQuizzes[question.id]=next;
   else if(changedQuiz(next,question))quizzes[question.id]=next;
  }
  return {version:2,facts,quizzes,...(Object.keys(archivedQuizzes).length?{archivedQuizzes}:{})};
 }
 function factFrom(value,id){const base=BY_FACT.get(id);return base?{...base,text:own(value.facts,id)?value.facts[id]:base.text}:null;}
 function quizFrom(value,id){const base=BY_QUIZ.get(id),override=value.quizzes[id];return base?{...base,...override,choices:(override?.choices||base.choices).slice()}:null;}
 function resolvedFact(value,id){return factFrom(normalize(value)||EMPTY,id);}
 function resolvedQuiz(value,id){return quizFrom(normalize(value)||EMPTY,id);}
 function resolvePeople(value){
  const data=normalize(value)||EMPTY;
  return Object.fromEntries(Object.entries(PEOPLE).map(([id,person])=>[id,{...person,facts:person.facts.map(fact=>factFrom(data,fact.id))}]));
 }
 function resolveQuestions(value){const data=normalize(value)||EMPTY;return QUESTIONS.map(question=>quizFrom(data,question.id));}
 return Object.freeze({PEOPLE,FACTS,QUESTIONS,LIMITS,EMPTY,validate,normalize,resolvedFact,resolvedQuiz,resolvePeople,resolveQuestions});
});
