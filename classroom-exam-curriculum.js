/* Trace each built-in exam question to teaching, an example, and a practice check. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const bank=node?require('./final-exam-bank.js'):root?.CodaFinalExamBank;
 const packs=node?[
  require('./classroom-curriculum-staff.js'),
  require('./classroom-curriculum-rhythm.js'),
  require('./classroom-curriculum-expression.js')
 ]:[root?.CodaClassroomCurriculumStaff,root?.CodaClassroomCurriculumRhythm,root?.CodaClassroomCurriculumExpression];
 const api=factory(bank,packs);if(node)module.exports=api;if(root)root.CodaExamCurriculum=api;
})(typeof window==='undefined'?null:window,function(defaultBank,packs){
 'use strict';
 const VERSION=1;
 const IDS=Object.freeze(['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo']);
 const TITLES=Object.freeze({'note-naming':'Treble & note names','bass-clef':'Bass clef','grand-staff':'Grand staff & Middle C','rhythm-tree':'Note lengths & rhythm','time-signatures':'Time signatures','major-minor-keys':'Major & minor keys',dynamics:'Dynamics',tempo:'Tempo'});
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
 const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,95}$/.test(value);
 const copy=value=>JSON.parse(JSON.stringify(value));
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);if(!Object.isFrozen(value))Object.freeze(value);}return value;}
 const EMPTY=Object.freeze([]);
 const merged=Object.fromEntries(IDS.map(id=>[id,[]]));
 for(const pack of packs){const lessons=pack?.LESSONS||pack;if(!object(lessons))continue;for(const id of IDS)if(Array.isArray(lessons[id]))merged[id].push(...lessons[id]);}
 const LESSONS=freeze(merged);
 const CATEGORIES=freeze(IDS.map(id=>({id,title:TITLES[id]})));
 const forLesson=id=>own(LESSONS,id)?LESSONS[id]:EMPTY;
 const questions=bank=>Array.isArray(bank?.QUESTIONS)?bank.QUESTIONS:IDS.flatMap(id=>bank?.pool?.(id)||[]);
 const stable=value=>JSON.stringify(value,function(key,item){return object(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item;});
 const semanticQuestion=question=>{
  const values=Array.isArray(question?.choices)?question.choices:[];
  return stable([question?.category,question?.prompt,values.map(item=>item?.text).sort(),values.find(item=>item?.id===question?.answer)?.text,question?.stimulus||null]);
 };

 function validateCurriculum(input=LESSONS,bank=defaultBank){
  const errors=[],allQuestions=questions(bank),questionById=new Map(allQuestions.map(question=>[question.id,question])),seen=new Set();
  if(!object(input))return {ok:false,errors:['A lesson-card collection is required.']};
  for(const key of Object.keys(input))if(!IDS.includes(key))errors.push('Unknown lesson category: '+key+'.');
  for(const id of IDS){
   const cards=input[id];if(!Array.isArray(cards)){errors.push(id+' needs its lesson-card list.');continue;}
   for(const [index,card]of cards.entries()){
    const label=id+' card '+(index+1);
    if(!object(card)){errors.push(label+' must be a teaching card.');continue;}
    if(!safeId(card.id)||seen.has(card.id))errors.push(label+' needs a globally unique safe card ID.');seen.add(card.id);
    for(const [field,max]of [['title',120],['teach',2000],['example',2000],['prompt',1200],['hint',2000]])if(!text(card[field],max))errors.push(label+' needs '+field+'.');
    if(!Array.isArray(card.answers)||card.answers.length<2||card.answers.length>6||card.answers.some(answer=>!text(answer,400))||new Set(card.answers.map(answer=>String(answer).trim().toLocaleLowerCase())).size!==card.answers.length)errors.push(label+' needs 2–6 different answers.');
    if(!Number.isInteger(card.correct)||card.correct<0||card.correct>=(card.answers?.length||0))errors.push(label+' needs an available correct answer.');
    if(!Array.isArray(card.covers)||!card.covers.length||new Set(card.covers).size!==card.covers.length)errors.push(label+' needs a nonrepeating list of question links.');
    else for(const questionId of card.covers){const question=questionById.get(questionId);if(!question)errors.push(label+' links an unknown question: '+String(questionId)+'.');else if(question.category!==id)errors.push(label+' links a question from another topic: '+questionId+'.');}
    if(card.visual!==undefined&&card.visual!==null&&!object(card.visual))errors.push(label+' needs a plain supported picture.');
   }
  }
  return {ok:errors.length===0,errors};
 }

 function getCoverage(bank=defaultBank,lessonOverrides={}){
  const selected={...LESSONS,...(object(lessonOverrides)?lessonOverrides:{})};
  const pool=questions(bank),byId=new Map(pool.map(question=>[question.id,question]));
  const canonical=new Map(questions(defaultBank).map(question=>[question.id,question]));
  const links={},unknownReferences=[],invalidCards=[],byCategory={};
  for(const id of IDS){
   const cards=Array.isArray(selected[id])?selected[id]:[];
   byCategory[id]={id,title:TITLES[id],total:0,covered:0,missing:[],requiresReview:[],cardCount:cards.length,concepts:[]};
   for(const card of cards){
    if(!object(card)||!safeId(card.id)||!text(card.title,120)||!text(card.teach,2000)||!text(card.example,2000)||!text(card.prompt,1200)||!Array.isArray(card.answers)||card.answers.length<2||!Number.isInteger(card.correct)||!text(card.answers[card.correct],400)||!text(card.hint,2000)){
     invalidCards.push({lessonId:id,cardId:card?.id||null});continue;
    }
    const mapped=[];
    for(const questionId of new Set(Array.isArray(card.covers)?card.covers:[])){
     const question=byId.get(questionId);
     if(!question){
      // Deleting an exam question does not make its original teaching invalid.
      if(!canonical.has(questionId))unknownReferences.push({lessonId:id,cardId:card.id,questionId});
      continue;
     }
     if(question.category!==id){unknownReferences.push({lessonId:id,cardId:card.id,questionId});continue;}
     (links[questionId]??=[]).push({lessonId:id,cardId:card.id,title:card.title});mapped.push(questionId);
    }
    byCategory[id].concepts.push({id:card.id,title:card.title,questionIds:mapped});
   }
  }
  const missing=[],requiresReview=[];let covered=0;
  for(const question of pool){
   const category=byCategory[question.category];if(category)category.total++;
   const changed=canonical.has(question.id)&&semanticQuestion(canonical.get(question.id))!==semanticQuestion(question);
   if(changed){requiresReview.push(question.id);category?.requiresReview.push(question.id);}
   if(!links[question.id]?.length){missing.push(question.id);category?.missing.push(question.id);}
   else if(!changed){covered++;if(category)category.covered++;}
  }
  return {version:VERSION,total:pool.length,covered,missing,requiresReview,byCategory,questionLinks:links,unknownReferences,invalidCards,complete:pool.length>0&&covered===pool.length&&!unknownReferences.length&&!invalidCards.length};
 }

 function questionRanges(values,category){
  const numbers=values.map(value=>Number(String(value).slice(category.length+1))).filter(Number.isFinite).sort((a,b)=>a-b),ranges=[];
  for(let index=0;index<numbers.length;){let end=index;while(end+1<numbers.length&&numbers[end+1]===numbers[end]+1)end++;const pad=value=>String(value).padStart(3,'0');ranges.push(pad(numbers[index])+(end>index?'–'+pad(numbers[end]):''));index=end+1;}
  return ranges.join(', ');
 }
 function coverageMarkdown(){
  const report=getCoverage(),lines=['# Haydn’s Final Exam: lesson coverage','','Every built-in question is linked to a short teaching card with a worked example and a practice check. The cards teach reusable methods; students do not need to memorize the 800 answers.','','The normal classroom path is **basic activity → exam lesson cards → end-of-lesson quiz**. Completed learners can reopen **Study for the exam** without replaying the basics or earning a second reward.','','The question pool remains **100 questions per category**, with **40 questions / five per category** as the default exam. This document records the built-in curriculum. A teacher who changes a question’s tested material must review its teaching links; an old question ID alone cannot prove that new wording is taught.','','## Coverage result','','- Built-in questions: '+report.total+'.','- Questions with linked teaching and practice: '+report.covered+'.','- Missing links: '+report.missing.length+'.','- Unknown references: '+report.unknownReferences.length+'.','','Question numbers below refer to the stable category-prefixed exam IDs. For example, `001–009` under Bass clef means `bass-clef-001` through `bass-clef-009`.'];
  for(const category of CATEGORIES){const section=report.byCategory[category.id];lines.push('','## '+category.title,'',section.covered+' / '+section.total+' questions covered by '+section.cardCount+' exam lesson cards.','', '| Card | Teaching concept | Linked question numbers |','| --- | --- | --- |');for(const card of forLesson(category.id))lines.push('| `'+card.id+'` | '+card.title.replaceAll('|','\\|')+' | '+questionRanges(card.covers||[],category.id)+' |');}
  lines.push('','## Verification','','Run `node --test tests/exam-curriculum.test.cjs` to check all 800 links, category boundaries, card validity, and the factual coverage of the previously missing concepts. Existing exam-bank tests independently check answer correctness and keep every category at 100 unique questions.','','Lesson-card edits use the existing teaching-content editor and JSON backup. Their practice progress stays in browser-only player-scoped storage; the established lesson/exam reward journals and cloud profile schema are unchanged.','');
  return lines.join('\n');
 }

 return Object.freeze({VERSION,IDS,CATEGORIES,LESSONS,forLesson,validateCurriculum,getCoverage,coverageMarkdown});
});
