/* Developer-authored classroom content. This is configuration, never a student profile. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(root,node?require:null);if(node)module.exports=api;if(root)root.CodaEducationContent=api;
})(typeof window==='undefined'?null:window,function(root,requireModule){
 'use strict';
 const KEY='codaEducationContentDraftV1',VERSION=1,LEARNING_PATHS_VERSION=1,MAX_BYTES=2000000;
 const CATEGORIES=Object.freeze([
  {id:'note-naming',title:'Treble & note names'},{id:'bass-clef',title:'Bass clef'},
  {id:'grand-staff',title:'Grand staff & Middle C'},{id:'rhythm-tree',title:'Note lengths & rhythm'},
  {id:'time-signatures',title:'Time signatures'},{id:'major-minor-keys',title:'Major & minor keys'},
  {id:'dynamics',title:'Dynamics'},{id:'tempo',title:'Tempo'}
 ].map(Object.freeze));
 const EXAM_IDS=Object.freeze(CATEGORIES.map(item=>item.id)),SUPPLEMENTAL_ID='accidentals-key-signatures';
 const LESSON_CATEGORIES=Object.freeze([...CATEGORIES,Object.freeze({id:SUPPLEMENTAL_ID,title:'Accidentals & key signatures'})]),LESSON_IDS=Object.freeze(LESSON_CATEGORIES.map(item=>item.id));
 const IDS=EXAM_IDS,own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
 const stable=value=>JSON.stringify(value,function(key,item){return object(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item;});
 const same=(a,b)=>stable(a)===stable(b);
 const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,95}$/.test(value);
 const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
 const fail=message=>{throw Error(message);};
 const text=(value,label,max=1200,empty=false)=>{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail(label+' needs '+(empty?'valid':'nonempty')+' text of at most '+max+' characters.');return value;};
 let sources=null,defaults=null,activeStore=null;
 function accidentalsModule(){if(root?.CodaAccidentalsLesson)return root.CodaAccidentalsLesson;if(requireModule)try{return requireModule('./classroom-accidentals-lesson.js');}catch{}return null;}
 function curriculumModule(){if(root?.CodaExamCurriculum)return root.CodaExamCurriculum;if(requireModule)try{return requireModule('./classroom-exam-curriculum.js');}catch{}return null;}
 function pathsModule(){if(root?.CodaClassroomLearningPathsData)return root.CodaClassroomLearningPathsData;if(requireModule)try{return requireModule('./classroom-learning-paths-data.js');}catch{}return null;}
 function defaultStudy(id,fallback){
  const paths=pathsModule(),cards=paths?.getCards?.(id);if(!Array.isArray(cards))return fallback;
  return cards.map(card=>{const checks=paths.getChecks?.(id,card);return {...card,...(Array.isArray(checks)?{checks:checks.slice(1).map(check=>({prompt:check.prompt,answers:copy(check.answers),correct:check.correct,hint:check.hint,visual:copy(check.visual||null),...(check.visuals?{visuals:copy(check.visuals)}:{})}))}:{})};});
 }
 function lessonMetadata(id,title){const path=pathsModule()?.getCategory?.(id);return path?{title:path.title,intro:path.intro,sections:path.sections.map(section=>({id:section.id,title:section.title,tier:section.tier,cardIds:section.cards.map(card=>card.id)}))}:{title};}
 function getSources(){
  if(!sources){sources=requireModule?{bank:requireModule('./final-exam-bank.js'),quiz:requireModule('./classroom-quiz.js'),tutorials:requireModule('./classroom-tutorials.js'),time:requireModule('./time-signature-lesson.js')}:{bank:root?.CodaFinalExamBank,quiz:root?.CodaClassroomQuiz,tutorials:root?.CodaClassroomTutorials,time:root?.CodaTimeSignatureLesson};}
  if(!sources.bank||!sources.quiz||!sources.tutorials||!sources.time){sources=null;fail('The classroom content is still loading. Please try again.');}return sources;
 }
 const RHYTHM_STEPS=[
  {kind:'tree',guide:'One whole note lasts four counts.',prompt:'Explore the rhythm tree.',hint:'Split a note into two shorter notes.'},
  {kind:'choice',guide:'One half note lasts two counts.',prompt:'How many quarter notes match this?',answers:['2','3','4'],answer:0,hint:'Each quarter lasts one count.'},
  {kind:'choice',guide:'Two eighth notes share one count.',prompt:'How many eighth notes match this?',answers:['2','3','4'],answer:0,hint:'Split the quarter in two.'},
  {kind:'build',guide:'Make four beats.',prompt:'Make four beats.',caption:'1 + 1 + 1 + 1 = 4 beats',hint:'Add notes until you have four beats.'}
 ];
 function getDefaults(){
  if(!defaults){
   const {bank,quiz,tutorials,time}=getSources(),lessons={},quizzes={};
   for(const id of IDS){
    const meta=tutorials.LESSONS.find(item=>item.id===id);
    let steps=tutorials.NOTE_LESSONS[id]||tutorials.EXPRESSION_LESSONS[id]||(id==='major-minor-keys'?tutorials.KEY_STEPS:id==='time-signatures'?time.STEPS:RHYTHM_STEPS);
    steps=copy(steps).map((step,index)=>{const simple=tutorials.SIMPLE_NOTE_COPY[id]?.[index];return {...step,...(simple?{teach:simple[0],example:simple[1],prompt:simple[2],hint:simple[3]}:{}),visual:null};});
    lessons[id]={...lessonMetadata(id,meta.title),steps,study:cleanStudy(id,defaultStudy(id,curriculumModule()?.forLesson?.(id)||[]))};
    quizzes[id]={title:quiz.QUIZZES[id].title,questions:copy(quiz.QUIZZES[id].questions).map(question=>{const result={...question,category:id,visual:question.visual||null};if(result.answerNotes===null)delete result.answerNotes;return result;})};
   }
   const extra=accidentalsModule(),title=extra?.TITLE||'Accidentals & key signatures';
   lessons[SUPPLEMENTAL_ID]={...lessonMetadata(SUPPLEMENTAL_ID,title),steps:[],study:cleanStudy(SUPPLEMENTAL_ID,defaultStudy(SUPPLEMENTAL_ID,extra?.CARDS||[]))};
   const extraQuiz=extra?.QUIZ;quizzes[SUPPLEMENTAL_ID]={title:extraQuiz?.title||title,questions:(extraQuiz?.questions||[]).map(item=>question(item,SUPPLEMENTAL_ID))};
   defaults={version:VERSION,learningPathsVersion:LEARNING_PATHS_VERSION,exam:{questions:bank.QUESTIONS.map(question=>({id:question.id,category:question.category,prompt:question.prompt,answers:question.choices.map(choice=>choice.text),correct:question.choices.findIndex(choice=>choice.id===question.answer),explanation:question.explanation||'',visual:copy(question.stimulus||null)}))},quizzes,lessons};
  }return copy(defaults);
 }
 function notationModule(){if(root?.CodaEducationNotation)return root.CodaEducationNotation;if(requireModule)try{return requireModule('./education-notation.js');}catch{}return null;}
 function keyboardModule(){if(root?.CodaClassroomKeyboard)return root.CodaClassroomKeyboard;if(requireModule)try{return requireModule('./classroom-keyboard.js');}catch{}return null;}
 function visual(value){
  if(value===null||value===undefined)return null;if(!object(value))fail('A music picture must be a supported notation object.');
  if(value.kind==='keyboard'){const checked=keyboardModule()?.validateVisual?.(value);if(!checked?.ok)fail(checked?.error||'The piano keyboard picture is still loading.');return checked.data;}
  if(value.kind==='key-signature'){const module=accidentalsModule(),checked=module?.validateVisual?.(value);if(!checked?.ok)fail(checked?.error||'The key-signature lesson is still loading.');return checked.data;}
  if(value.kind==='notation'){
   const module=notationModule(),checked=module?.validate?.(value.score);if(!checked?.ok)fail(checked?.error||'The notation editor is still loading.');
   return {kind:'notation',score:checked.data};
  }
  if(value.kind==='clef-intro'){
   if(Object.keys(value).some(key=>!['kind','clef','page'].includes(key))||!['treble','bass'].includes(value.clef)||!['staff','clef','lines','spaces'].includes(value.page))fail('Choose a supported clef and introduction picture.');
   return {kind:'clef-intro',clef:value.clef,page:value.page};
  }
  if(value.kind==='note-parts'){
   if(Object.keys(value).some(key=>!['kind','focus','beats'].includes(key))||!['head','stem','flag','all'].includes(value.focus)||![.5,1,2,4].includes(value.beats))fail('Choose a supported note part and basic note length.');
   return {kind:'note-parts',focus:value.focus,beats:value.beats};
  }
  if(value.kind==='rhythm-tree'){
   if(Object.keys(value).some(key=>!['kind','level'].includes(key))||!integer(value.level,0,3))fail('Choose a basic rhythm-tree level from whole through eighth notes.');
   return {kind:'rhythm-tree',level:value.level};
  }
  const result={kind:value.kind};
  if(value.kind==='staff'){
   if(!integer(value.position,-20,28)||value.clef!==undefined&&!['treble','bass'].includes(value.clef)||value.grand!==undefined&&typeof value.grand!=='boolean')fail('That staff note is outside the supported range.');
   result.position=value.position;if(value.clef!==undefined)result.clef=value.clef;if(value.grand!==undefined)result.grand=value.grand;if(value.label!==undefined)result.label=text(value.label,'Staff description',400,true);
  }else if(value.kind==='piano'){if(!integer(value.target,0,7))fail('Choose a piano key from 0 to 7.');result.target=value.target;
  }else if(value.kind==='note'){if(![.25,.5,.75,1,1.5,2,3,4].includes(value.beats))fail('Choose a supported note length.');result.beats=value.beats;if(value.rest!==undefined){if(typeof value.rest!=='boolean')fail('A note picture needs a true or false rest setting.');result.rest=value.rest;}
  }else if(value.kind==='middle-c-pair'){}
  else if(value.kind==='meter'){if(!['2/2','2/4','3/4','4/4','6/8','9/8','12/8'].includes(value.meter))fail('Choose a supported time signature.');result.meter=value.meter;
  }else if(value.kind==='rhythm'){
   if(!Array.isArray(value.notes)||value.notes.length>64||value.notes.some(note=>!object(note)||![.25,.5,.75,1,1.5,2,3,4].includes(note.beats)||note.rest!==undefined&&typeof note.rest!=='boolean'))fail('Choose up to 64 supported notes and rests.');
   result.meter=typeof value.meter==='string'?text(value.meter,'Rhythm meter',12):'4/4';result.notes=value.notes.map(note=>({beats:note.beats,rest:note.rest===true}));
  }else if(value.kind==='tie'){
   if(!Array.isArray(value.notes)||value.notes.length<2||value.notes.length>8||value.notes.some(note=>!object(note)||Object.keys(note).some(key=>!['beats','rest'].includes(key))||note.rest!==undefined&&note.rest!==false||![.25,.5,.75,1,1.5,2,3,4].includes(note.beats)))fail('A tie picture needs 2 to 8 supported note lengths.');
   if(value.meter!==undefined&&!['2/2','2/4','3/4','4/4','6/8'].includes(value.meter))fail('Choose a supported tie-picture meter.');result.notes=value.notes.map(note=>({beats:note.beats,...(own(note,'rest')?{rest:false}:{})}));if(value.meter!==undefined)result.meter=value.meter;
  }else if(value.kind==='scale'){
   if(!Array.isArray(value.notes)||value.notes.length>32||value.notes.some(note=>typeof note!=='string'||note.length>24))fail('That scale picture is too long.');result.notes=[...value.notes];
  }else if(value.kind==='dynamic'){if(!['pp','p','mp','mf','f','ff','crescendo','decrescendo'].includes(value.mark))fail('Choose a supported dynamics marking.');result.mark=value.mark;
  }else if(value.kind==='tempo'){result.text=text(value.text,'Tempo marking',100);if(value.bpm!==undefined){if(!integer(value.bpm,1,400))fail('Tempo must be between 1 and 400 BPM.');result.bpm=value.bpm;}
  }else fail('That kind of music picture is not supported.');
  return result;
 }
 function question(value,category){
  if(!object(value)||!safeId(value.id)||!LESSON_IDS.includes(category)||value.category!==undefined&&value.category!==category)fail('A question needs a unique ID and one of the eight classroom categories.');
  if(!Array.isArray(value.answers)||value.answers.length<2||value.answers.length>6||!integer(value.correct,0,value.answers.length-1))fail('A question needs 2 to 6 answers and one correct answer.');
  const answers=value.answers.map(answer=>text(answer,'Answer',400));if(new Set(answers.map(answer=>answer.trim().toLowerCase())).size!==answers.length)fail('Give each answer different text.');
  const result={id:value.id,category,prompt:text(value.prompt,'Question'),answers,correct:value.correct,explanation:text(value.explanation??'','Explanation',2000,true),visual:visual(value.visual)};
  if(own(value,'visuals'))result.visuals=visualList(value.visuals);
  if(value.answerNotes!==undefined&&value.answerNotes!==null){if(!Array.isArray(value.answerNotes)||value.answerNotes.length!==answers.length||value.answerNotes.some(notes=>!Array.isArray(notes)||notes.length>16||notes.some(note=>![.25,.5,.75,1,1.5,2,3,4].includes(note))))fail('Answer-note pictures must match the answer list.');result.answerNotes=copy(value.answerNotes);}
  return result;
 }
 function visualList(input){if(!Array.isArray(input)||input.length>6)fail('Use at most six additional lesson pictures.');return input.map(value=>{const checked=visual(value);if(!checked)fail('Choose a picture or remove the empty picture.');return checked;});}
 function practiceCheck(value,id){
  if(!object(value)||Object.keys(value).some(key=>!['prompt','answers','correct','hint','visual','visuals'].includes(key)))fail('Use supported practice-check fields.');
  const checked=question({...value,id:'practice-check'},id);return {prompt:checked.prompt,answers:checked.answers,correct:checked.correct,hint:text(value.hint??'','Practice hint',2000,true),visual:checked.visual,...(own(checked,'visuals')?{visuals:checked.visuals}:{})};
 }
 function cleanStudy(id,input){
  if(!Array.isArray(input)||input.length>100)fail('An exam lesson needs at most 100 teaching cards.');
  const cards=input.map(value=>{
   if(!object(value)||Object.keys(value).some(key=>!['id','category','title','teach','example','prompt','answers','correct','hint','visual','visuals','checks','covers'].includes(key)))fail('Use supported teaching-card fields.');
   const checked=question(value,id),result={id:checked.id,title:text(value.title,'Card title',120),teach:text(value.teach,'Teaching idea',2000),example:text(value.example??'','Worked example',2000,true),prompt:checked.prompt,answers:checked.answers,correct:checked.correct,hint:text(value.hint??'','Card hint',2000,true),visual:checked.visual};
   if(own(checked,'visuals'))result.visuals=checked.visuals;
   if(own(value,'checks')){if(!Array.isArray(value.checks)||value.checks.length>9)fail('Use at most nine additional practice checks.');result.checks=value.checks.map(check=>practiceCheck(check,id));}
   if(own(value,'covers')){if(!Array.isArray(value.covers)||value.covers.length>200||value.covers.some(item=>!safeId(item))||new Set(value.covers).size!==value.covers.length)fail('Use unique exam question IDs for teaching coverage.');result.covers=[...value.covers];}
   return result;
  });
  if(new Set(cards.map(card=>card.id)).size!==cards.length)fail('Teaching-card IDs must be unique in each lesson.');return cards;
 }
 function migrateStudy(id,cards,base){
  const extras=pathsModule()?.EXTRA?.[id];if(!Array.isArray(extras)||!extras.length)return cards;
  const newIds=new Set(extras.map(card=>card.id)),result=copy(cards),present=new Set(result.map(card=>card.id));
  // An old export could not deliberately delete a card introduced later. Add
  // only those new foundations; never revive a deleted original teaching card.
  for(let index=0;index<base.length;index++){
   const card=base[index];if(!newIds.has(card.id)||present.has(card.id))continue;
   const after=new Set(base.slice(index+1).map(item=>item.id)),position=result.findIndex(item=>after.has(item.id));
   result.splice(position<0?result.length:position,0,copy(card));present.add(card.id);
  }
  return result;
 }
 function cleanSteps(id,input,base){
  if(!Array.isArray(input)||input.length!==base.length)fail('Keep the '+base.length+' activities in '+id+'; edit their words, answers, and notation.');
  return input.map((step,index)=>{
   const original=base[index];if(!object(step)||step.kind!==original.kind)fail('Keep this lesson activity type.');
   const allowed=new Set([...Object.keys(original),'visual','visuals','hideVisual']),result=copy(original);for(const key of Object.keys(step))if(!allowed.has(key))fail('Unsupported lesson field: '+key+'.');
   for(const key of ['prompt','teach','guide','example','caption','hint','success','noteLabel'])if(own(step,key))result[key]=text(step[key],key,2000,true);
   if(own(step,'answers')){if(!Array.isArray(step.answers)||step.answers.length<2||step.answers.length>6)fail('An activity needs 2 to 6 answer choices.');result.answers=step.answers.map(answer=>text(answer,'Activity answer',400));}
   for(const key of ['answer','correct'])if(own(step,key)){
    const value=step[key];if(typeof original[key]==='string'){if(!/^[A-G]$/.test(value))fail('Choose a note letter from A to G.');}
    else if(!integer(value,0,(result.answers?.length||1)-1))fail('Choose an available correct activity answer.');result[key]=value;
   }
   if(own(step,'position')){if(!integer(step.position,-20,28))fail('Choose a supported staff position.');result.position=step.position;}
   if(own(step,'pitch')){if(!integer(step.pitch,0,127))fail('Choose a supported note pitch.');result.pitch=step.pitch;}
   if(own(step,'clef')){if(!['treble','bass'].includes(step.clef))fail('Choose treble or bass clef.');result.clef=step.clef;}
   if(own(step,'grand')){if(typeof step.grand!=='boolean')fail('Grand staff must be true or false.');result.grand=step.grand;}
   // The activity's audio, recipes and layout stay coherent. Only known
   // teaching fields above and the separately validated picture are mutable.
   for(const key of Object.keys(original))if(!['prompt','teach','guide','example','caption','hint','success','noteLabel','answers','answer','correct','position','pitch','clef','grand','visual','visuals','hideVisual'].includes(key)&&!same(step[key],original[key]))fail('Keep the activity’s '+key+' setting.');
   result.visual=visual(step.visual);if(own(step,'visuals'))result.visuals=visualList(step.visuals);if(own(step,'hideVisual')){if(typeof step.hideVisual!=='boolean')fail('Choose whether to hide the built-in lesson picture.');result.hideVisual=step.hideVisual;}return result;
  });
 }
 function cleanSections(input){
  if(!Array.isArray(input)||input.length>40)fail('Use at most forty lesson sections.');const sections=new Set(),cards=new Set();let advanced=false;
  return input.map(value=>{
   if(!object(value)||Object.keys(value).some(key=>!['id','title','tier','cardIds'].includes(key))||!safeId(value.id)||sections.has(value.id)||!['basic','advanced'].includes(value.tier)||!Array.isArray(value.cardIds)||value.cardIds.length>100||value.cardIds.some(id=>!safeId(id)||cards.has(id)))fail('Use unique sections, a basics or advanced level, and unique teaching-card IDs.');
   if(value.tier==='advanced')advanced=true;else if(advanced)fail('Place basic lesson sections before advanced sections.');
   if(new Set(value.cardIds).size!==value.cardIds.length)fail('A teaching card can appear only once in the lesson sections.');sections.add(value.id);value.cardIds.forEach(id=>cards.add(id));
   return {id:value.id,title:text(value.title,'Section title',120),tier:value.tier,cardIds:[...value.cardIds]};
  });
 }
 function inheritChecks(cards,base){
  return cards.map(card=>{
   const original=base.find(item=>item.id===card.id);
   if(own(card,'checks')||!original?.checks||['teach','example','prompt','answers','correct','hint','visual','visuals'].some(key=>!same(card[key]??null,original[key]??null)))return card;
   return {...card,checks:copy(original.checks)};
  });
 }
 function validate(input){
  try{
   if(!object(input)||input.version!==VERSION||Object.keys(input).some(key=>!['version','learningPathsVersion','exam','quizzes','lessons'].includes(key))||own(input,'learningPathsVersion')&&input.learningPathsVersion!==LEARNING_PATHS_VERSION)fail('Choose a version 1 Coda classroom content file.');
   if(JSON.stringify(input).length>MAX_BYTES)fail('This classroom content file is too large.');const result=getDefaults();
   if(input.exam!==undefined){if(!object(input.exam)||Object.keys(input.exam).some(key=>key!=='questions')||!Array.isArray(input.exam.questions)||input.exam.questions.length>2400)fail('The exam needs a list of at most 2,400 questions.');result.exam.questions=input.exam.questions.map(value=>{if(!EXAM_IDS.includes(value?.category))fail('Choose one of the eight final-exam categories.');return question(value,value.category);});if(new Set(result.exam.questions.map(value=>value.id)).size!==result.exam.questions.length)fail('Exam question IDs must be unique.');}
   for(const section of ['quizzes','lessons'])if(input[section]!==undefined){
    if(!object(input[section])||Object.keys(input[section]).some(id=>!LESSON_IDS.includes(id)))fail('Choose a known classroom topic.');
    for(const [id,value]of Object.entries(input[section])){
     if(!object(value))fail('A classroom topic needs its title and content.');const title=text(value.title, 'Topic title',120);
     if(section==='quizzes'){
      if(Object.keys(value).some(key=>!['title','questions'].includes(key))||!Array.isArray(value.questions)||value.questions.length>200)fail('A quiz needs a list of at most 200 questions.');
      const questions=value.questions.map(item=>question(item,id));if(new Set(questions.map(item=>item.id)).size!==questions.length)fail('Quiz question IDs must be unique.');result.quizzes[id]={title,questions};
     }else{
      if(Object.keys(value).some(key=>!['title','intro','sections','steps','study'].includes(key)))fail('A lesson needs its title, activities, sections, and teaching cards.');
      const baseLesson=result.lessons[id],baseStudy=baseLesson.study;let study=own(value,'study')?cleanStudy(id,value.study):baseStudy;if(!own(input,'learningPathsVersion')&&own(value,'study'))study=migrateStudy(id,study,baseStudy);study=inheritChecks(study,baseStudy);
      const legacyTitle=getSources().tutorials.LESSONS.find(item=>item.id===id)?.title,topicTitle=!own(value,'intro')&&!own(value,'sections')&&title===legacyTitle?baseLesson.title:title;
      result.lessons[id]={...baseLesson,title:topicTitle,steps:cleanSteps(id,id===SUPPLEMENTAL_ID?value.steps??[]:value.steps,baseLesson.steps),study};
      if(own(value,'intro'))result.lessons[id].intro=text(value.intro,'Lesson introduction',2000,true);
      if(own(value,'sections'))result.lessons[id].sections=cleanSections(value.sections);
      // Older editors ordered cards through the study list. Preserve that
      // intent until an author explicitly changes the section's own order.
      if(result.lessons[id].sections&&(!own(value,'sections')||same(value.sections,baseLesson.sections))){
       const order=new Map(study.map((card,index)=>[card.id,index]));
       result.lessons[id].sections=result.lessons[id].sections.map(section=>({...section,cardIds:[...section.cardIds].sort((first,second)=>(order.get(first)??1e6)-(order.get(second)??1e6))}));
      }
     }
    }
   }
   return {ok:true,data:result};
  }catch(error){return {ok:false,error:error.message||'This classroom content could not be read.'};}
 }
 function revision(value){const encoded=stable(value);let hash=2166136261;for(let index=0;index<encoded.length;index++)hash=Math.imul(hash^encoded.charCodeAt(index),16777619);return 'content-'+(hash>>>0).toString(16)+'-'+encoded.length;}
 function createStore(api={}){
  let storage=api.storage;if(storage===undefined)try{storage=root?.localStorage;}catch{}
  let draft=null,raw=null,published=null,error='',loading=false,loaded=false,loadPromise=null,destroyed=false;const listeners=new Set(),base=getDefaults(),quizCache=new Map(),lessonCache=new Map();let bankSource=null,bankCache=null,stateSource=null,stateRevision='';
  const canEdit=()=>{try{return !destroyed&&api.canEdit?.()===true;}catch{return false;}};
  try{raw=storage?.getItem?.(KEY)??null;if(raw!==null){const checked=validate(JSON.parse(raw));if(!checked.ok)throw Error(checked.error);draft=checked.data;}}catch(failure){error='The local classroom draft could not reopen: '+failure.message;}
  const effective=()=>canEdit()&&draft?draft:published||base;
  const getDocument=()=>copy(effective());
  const getState=()=>{const current=effective();if(current!==stateSource){stateSource=current;stateRevision=revision(current);}return {version:VERSION,canEdit:canEdit(),hasDraft:!!draft,usingDraft:canEdit()&&!!draft,published:!!published,loading,loaded,error,revision:stateRevision};};
  const notify=()=>{for(const listener of listeners)try{listener(getState());}catch{}};
  function saveDocument(input){
   if(!canEdit())return {ok:false,error:'Open developer mode with editing access before changing classroom content.'};const checked=validate(input);if(!checked.ok)return checked;
   try{if(!storage?.getItem||!storage?.setItem)throw Error('This browser cannot save the classroom draft. Export your file to keep it.');if(storage.getItem(KEY)!==raw)throw Error('The classroom draft changed in another tab. Reload this page before saving.');const encoded=JSON.stringify(checked.data);storage.setItem(KEY,encoded);raw=encoded;draft=checked.data;error='';notify();return {ok:true,data:copy(checked.data)};}catch(failure){error=failure.message;notify();return {ok:false,error};}
  }
  function reset(){if(!canEdit())return {ok:false,error:'Open developer mode with editing access first.'};try{if(!storage?.getItem||!storage?.removeItem)throw Error('The local classroom draft could not be reset.');if(storage.getItem(KEY)!==raw)throw Error('The classroom draft changed in another tab. Reload this page before resetting.');storage.removeItem(KEY);raw=null;draft=null;error='';notify();return {ok:true,data:getDocument()};}catch(failure){error=failure.message;notify();return {ok:false,error};}}
  async function loadPublished(){
   if(loadPromise)return loadPromise;const fetcher=api.fetch||root?.fetch?.bind(root);loading=true;notify();
   loadPromise=(async()=>{try{if(!fetcher){loaded=true;return {ok:true,data:getDocument()};}const response=await fetcher(api.url||'education-content.json?v=lessons-102');if(!response?.ok)throw Error('Published classroom content could not load.');const checked=validate(await response.json());if(!checked.ok)throw Error(checked.error);published=checked.data;loaded=true;error='';return {ok:true,data:getDocument()};}catch(failure){loaded=true;error=failure.message;return {ok:false,error};}finally{loading=false;notify();}})();return loadPromise;
  }
  function getExamBank(){
   const document=effective();if(document.exam===bankSource)return bankCache;bankSource=document.exam;if(same(document.exam,base.exam))return bankCache=getSources().bank;
   const questions=document.exam.questions.map(question=>({id:question.id,category:question.category,prompt:question.prompt,choices:question.answers.map((text,index)=>({id:'choice-'+index,text})),answer:'choice-'+question.correct,explanation:question.explanation,stimulus:copy(question.visual),...(question.visuals?{visuals:copy(question.visuals)}:{})}));
   const byId=new Map(questions.map(question=>[question.id,question])),pools=Object.fromEntries(IDS.map(id=>[id,freeze(questions.filter(question=>question.category===id))]));return bankCache=freeze({VERSION:1,version:1,custom:true,revision:revision(document.exam),CATEGORIES:copy(CATEGORIES),QUESTIONS:questions,pool:id=>pools[id]||Object.freeze([]),getQuestion:id=>byId.get(id)||null});
  }
  function getQuiz(id){if(!LESSON_IDS.includes(id))return null;const value=effective().quizzes[id],cached=quizCache.get(id);if(cached?.source===value)return cached.model;const model=EXAM_IDS.includes(id)&&same(value,base.quizzes[id])?getSources().quiz.QUIZZES[id]:freeze({...copy(value),version:1,custom:true,revision:revision(value),passScore:Math.ceil(value.questions.length*.8)});quizCache.set(id,{source:value,model});return model;}
  const getLesson=id=>LESSON_IDS.includes(id)?copy(effective().lessons[id]):null;
  const getLessonSteps=id=>LESSON_IDS.includes(id)?copy(effective().lessons[id].steps):null;
  const getStudyCards=id=>LESSON_IDS.includes(id)?copy(effective().lessons[id].study):[];
  const getStudyRevision=id=>LESSON_IDS.includes(id)?revision({id,study:effective().lessons[id].study}):'';
  const isStudyEdited=id=>LESSON_IDS.includes(id)&&!same(effective().lessons[id].study,base.lessons[id].study);
  function lessonState(id){if(!LESSON_IDS.includes(id))return null;const document=effective(),lesson=document.lessons[id],quiz=document.quizzes[id],cached=lessonCache.get(id);if(cached?.lesson===lesson&&cached.quiz===quiz)return cached;const result={lesson,quiz,revision:revision({lesson,quiz}),edited:!same({title:lesson.title,steps:lesson.steps},{title:base.lessons[id].title,steps:base.lessons[id].steps})||getQuiz(id)?.custom===true};lessonCache.set(id,result);return result;}
  const getLessonRevision=id=>lessonState(id)?.revision||'';
  const isLessonEdited=id=>lessonState(id)?.edited===true;
  return {KEY,getDocument,getDefaults,getState,validate,saveDocument,setDocument:saveDocument,importDocument(input){if(typeof input==='string')try{input=JSON.parse(input);}catch{return {ok:false,error:'Choose a valid JSON classroom content file.'};}return saveDocument(input);},exportDocument:()=>JSON.stringify(getDocument(),null,2),reset,loadPublished,getExamBank,getQuiz,getLesson,getLessonSteps,getLessonRevision,isLessonEdited,getStudyCards,getStudyRevision,isStudyEdited,categories:(kind='exam')=>copy(kind==='exam'?CATEGORIES:LESSON_CATEGORIES),subscribe(listener){if(typeof listener!=='function')throw TypeError('A classroom content listener is required.');listeners.add(listener);listener(getState());return()=>listeners.delete(listener);},destroy(){destroyed=true;listeners.clear();}};
 }
 function getStore(){if(!activeStore)activeStore=createStore();return activeStore;}
 return Object.freeze({KEY,VERSION,LEARNING_PATHS_VERSION,MAX_BYTES,CATEGORIES,EXAM_IDS,LESSON_IDS,LESSON_CATEGORIES,SUPPLEMENTAL_ID,getDefaults,validate,createStore,getStore,setStore(store){if(!store||typeof store.getDocument!=='function')throw Error('Choose a classroom content store.');activeStore=store;return store;},getDocument:()=>getStore().getDocument(),getExamBank:()=>getStore().getExamBank(),getQuiz:id=>getStore().getQuiz(id),getLesson:id=>getStore().getLesson(id),getLessonSteps:id=>getStore().getLessonSteps(id),getLessonRevision:id=>getStore().getLessonRevision(id),isLessonEdited:id=>getStore().isLessonEdited(id),getStudyCards:id=>getStore().getStudyCards(id),getStudyRevision:id=>getStore().getStudyRevision(id),isStudyEdited:id=>getStore().isStudyEdited(id)});
});
