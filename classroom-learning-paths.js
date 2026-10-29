/* Small, ordered classroom lessons. Path practice stays on this device; the
 * existing end-of-category quiz remains the source of shared completion. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./classroom-exam-study.js'):root?.CodaClassroomExamStudy,node?require('./classroom-quiz.js'):root?.CodaClassroomQuiz,node?require('./classroom-tutorials.js'):root?.CodaClassroomTutorials,node?require('./music-notation.js'):root?.CodaMusicNotation);
 if(node)module.exports=api;if(root)root.CodaClassroomLearningPaths=api;
})(typeof window==='undefined'?null:window,function(studyModule,quizModule,tutorialModule,notation){
 'use strict';
 const KEY='codaClassroomLearningPathsV1',VERSION=1;
 const IDS=Object.freeze([...studyModule.LESSONS]);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
 const fail=message=>{throw Error(message);};
 function revisionOf(category,quiz,contentRevision=''){return studyModule.revisionOf({category,quiz,contentRevision});}
 function validateCategory(category){
  if(!object(category)||!IDS.includes(category.id)||typeof category.title!=='string'||!Array.isArray(category.sections)||category.sections.length>40)return false;
  const ids=new Set();let advanced=false;
  return category.sections.every(section=>{
   if(!object(section)||!safeId(section.id)||ids.has(section.id)||typeof section.title!=='string'||!['basic','advanced'].includes(section.tier)||!Array.isArray(section.cards)||section.cards.length>100||section.cards.some(card=>!studyModule.validCard(card))||new Set(section.cards.map(card=>card.id)).size!==section.cards.length)return false;
   ids.add(section.id);if(section.tier==='advanced')advanced=true;else if(advanced)return false;return true;
  });
 }
 function createSession(api={}){
  const category=copy(api.category);if(!validateCategory(category))fail('Choose a classroom category and its short lessons.');
  const id=category.id,revision=api.revision||revisionOf(category,category.basicsQuiz),sections=new Map(category.sections.map(section=>[section.id,section]));
  const hasCards=category.sections.some(section=>section.cards.length>0),hasBasics=category.sections.some(section=>section.tier==='basic'&&section.cards.length>0);
  let storage=api.storage;if(storage===undefined)try{storage=window.localStorage;}catch{}
  const blank=()=>({revision,sections:{},basicsQuiz:null,basicsPassedAt:0,completedAt:0});
  let record=blank(),expected='null',error='',saved=true,stale=false,destroyed=false;
  function read(){
   const raw=storage?.getItem?.(KEY);if(raw===null||raw===undefined)return {version:VERSION,lessons:{}};
   const journal=JSON.parse(raw);if(!object(journal)||journal.version!==VERSION||!object(journal.lessons)||Object.keys(journal).some(key=>!['version','lessons'].includes(key))||Object.keys(journal.lessons).some(key=>!IDS.includes(key)))fail('The saved lessons could not be read.');
   return journal;
  }
  function validSection(entry,sectionId){
   const section=sections.get(sectionId);if(!section||!object(entry)||Object.keys(entry).some(key=>!['revision','index','passed','checks'].includes(key)))return false;
   const validChecks=entry.checks===undefined||object(entry.checks)&&Object.entries(entry.checks).every(([cardId,count])=>{const card=section.cards.find(card=>card.id===cardId),total=card?(api.getChecks?.(card)||[card]).length:0;return Number.isInteger(count)&&count>0&&count<total;});
   return validChecks&&entry.revision===studyModule.revisionOf(section.cards)&&Number.isInteger(entry.index)&&entry.index>=0&&entry.index<section.cards.length&&Array.isArray(entry.passed)&&entry.passed.length<=section.cards.length&&new Set(entry.passed).size===entry.passed.length&&entry.passed.every(cardId=>section.cards.some(card=>card.id===cardId));
  }
  function validRecord(entry){return object(entry)&&Object.keys(entry).every(key=>['revision','sections','basicsQuiz','basicsPassedAt','completedAt'].includes(key))&&entry.revision===revision&&object(entry.sections)&&Object.keys(entry.sections).every(key=>validSection(entry.sections[key],key))&&['basicsPassedAt','completedAt'].every(key=>Number.isSafeInteger(entry[key])&&entry[key]>=0)&&(!entry.basicsQuiz||object(entry.basicsQuiz));}
  try{const entry=read().lessons[id];expected=JSON.stringify(entry??null);if(validRecord(entry))record=copy(entry);}
  catch{saved=false;error='Your saved lessons could not reopen. Reopen the category before continuing.';stale=true;}
  function canRecord(){try{if(destroyed||stale||api.canRecord?.()===false)return false;if(api.getRevision&&api.getRevision()!==revision){stale=true;return false;}return true;}catch{return false;}}
  function write(mutator){
   if(!canRecord()){saved=false;error='Your profile or lesson changed. Reopen this category to continue.';return false;}
   try{
    if(!storage?.getItem||!storage?.setItem)fail('storage');const journal=read();
    if(JSON.stringify(journal.lessons[id]??null)!==expected){stale=true;fail('changed');}
    const next=copy(record);mutator(next);journal.lessons[id]=next;storage.setItem(KEY,JSON.stringify(journal));record=next;expected=JSON.stringify(next);saved=true;error='';return true;
   }catch(failure){saved=false;error=failure.message==='changed'?'Your saved lesson changed in another tab. Reopen this category.':'Your lesson progress could not save. Keep this lesson open and try again.';return false;}
  }
  const sectionRevision=sectionId=>studyModule.revisionOf(sections.get(sectionId)?.cards||[]);
  function sectionComplete(sectionId){
   const section=sections.get(sectionId),entry=record.sections[sectionId];return !!section&&validSection(entry,sectionId)&&section.cards.every(card=>entry.passed.includes(card.id));
  }
  const basicsReady=()=>hasCards&&category.sections.filter(section=>section.tier==='basic'&&section.cards.length).every(section=>sectionComplete(section.id));
  const allReady=()=>hasCards&&category.sections.filter(section=>section.cards.length).every(section=>sectionComplete(section.id));
  function canOpenSection(sectionId){
   const index=category.sections.findIndex(section=>section.id===sectionId);if(index<0)return false;
   const section=category.sections[index];if(!section.cards.length||section.tier==='advanced'&&hasBasics&&!(record.basicsPassedAt>0))return false;
   return category.sections.slice(0,index).filter(previous=>previous.cards.length).every(previous=>sectionComplete(previous.id));
  }
  const sectionStorage=sectionId=>({
   getItem(key){if(key!==studyModule.KEY)return null;return JSON.stringify({version:1,lessons:record.sections[sectionId]?{[id]:copy(record.sections[sectionId])}:{}});},
   setItem(key,value){
    if(key!==studyModule.KEY||!sections.has(sectionId))fail('Choose a known lesson save.');
    const journal=JSON.parse(value),entry=journal?.version===1&&object(journal.lessons)?journal.lessons[id]:null;
    if(!validSection(entry,sectionId)||Object.keys(journal.lessons).some(key=>key!==id))fail('Choose a valid short-lesson save.');
    if(!write(next=>{next.sections[sectionId]=copy(entry);}))fail(error);
   }
  });
  const basicsStorage={
   getItem(key){if(key!==quizModule.CUSTOM_KEY)return null;return JSON.stringify({version:1,quizzes:record.basicsQuiz?{[id]:copy(record.basicsQuiz)}:{}});},
   setItem(key,value){
    if(key!==quizModule.CUSTOM_KEY||!basicsReady())fail('Finish the basics before taking this quiz.');
    const journal=JSON.parse(value),entry=journal?.version===1&&object(journal.quizzes)?journal.quizzes[id]:null;
    if(!entry||Object.keys(journal.quizzes).some(key=>key!==id))fail('Choose a valid basics quiz save.');
    if(!write(next=>{next.basicsQuiz=copy(entry);}))fail(error);
   }
  };
  return {
   canRecord,sectionStorage,basicsStorage,sectionRevision,sectionComplete,basicsReady,allReady,canOpenSection,
   markBasicsPassed(){if(!basicsReady())return false;return write(next=>{next.basicsPassedAt=next.basicsPassedAt||Math.max(1,Date.now());});},
   markCompleted(){if(!allReady()||hasBasics&&!record.basicsPassedAt)return false;return write(next=>{next.completedAt=next.completedAt||Math.max(1,Date.now());});},
   getState:()=>({...copy(record),lessonId:id,saved,error,stale,hasCards,hasBasics,basicsReady:basicsReady(),allReady:allReady(),sections:category.sections.map(section=>({id:section.id,title:section.title,tier:section.tier,total:section.cards.length,passed:Array.isArray(record.sections[section.id]?.passed)?record.sections[section.id].passed.length:0,completed:sectionComplete(section.id),available:canOpenSection(section.id)}))}),
   destroy(){destroyed=true;}
  };
 }
 function renderVisual(figure,value){
  if(!figure?.ownerDocument||!object(value))return false;const win=figure.ownerDocument.defaultView,tutorial=win?.CodaClassroomTutorials||tutorialModule;
  if(value.kind==='keyboard'&&win?.CodaClassroomKeyboard){const checked=win.CodaClassroomKeyboard.validateVisual(value);if(!checked.ok)return false;figure.innerHTML=win.CodaClassroomKeyboard.toSVG(checked.data);return true;}
  if(value.kind==='staff'&&quizModule?.staffSVG){
   figure.innerHTML=quizModule.staffSVG(value.position,value).replace(/H320/g,'H250');const svg=figure.querySelector('svg'),ns='http://www.w3.org/2000/svg';
   const label=(text,x,y,kind,index)=>{const item=figure.ownerDocument.createElementNS(ns,'text');item.textContent=text;item.setAttribute('x',x);item.setAttribute('y',y);item.setAttribute('font-family','system-ui,sans-serif');item.setAttribute('font-size',kind?'14':'10');item.setAttribute('fill',kind==='space'?'#21695f':'#49345c');item.setAttribute('text-anchor','middle');if(kind)item.setAttribute('data-staff-'+kind,index);svg.append(item);};
   for(const offset of value.grand?[0,120]:[0]){
    label('Line',277,27+offset);label('Space',313,27+offset);
    for(let index=1;index<=5;index++)label(String(index),277,130-(index-1)*20+offset,'line',index);
    for(let index=1;index<=4;index++)label(String(index),313,120-(index-1)*20+offset,'space',index);
   }
   notation.load?.(figure.ownerDocument);return true;
  }
  if(value.kind==='clef-intro'&&['treble','bass'].includes(value.clef)&&['staff','clef','lines','spaces'].includes(value.page)&&tutorial?.clefReminderSVG){figure.innerHTML=tutorial.clefReminderSVG(value.clef,value.page);notation.load?.(figure.ownerDocument);return true;}
  if(value.kind==='rhythm-tree'&&Number.isInteger(value.level)&&value.level>=0&&value.level<=3&&tutorial?.treeSVG){figure.innerHTML=tutorial.treeSVG(value.level);const svg=figure.querySelector('svg');svg?.removeAttribute('aria-hidden');svg?.setAttribute('role','img');svg?.setAttribute('aria-label','Rhythm tree: each note divides into two equal shorter notes.');return true;}
  if(value.kind==='key-signature')return win?.CodaAccidentalsLesson?.renderVisual?.(figure,value)===true;
  if(value.kind!=='note-parts'||!['head','stem','flag','all'].includes(value.focus)||![.5,1,2,4].includes(value.beats))return false;
  const focus=value.focus,symbol=notation.symbol(value.beats),label=focus==='head'?'Notehead':focus==='stem'?'Stem':focus==='flag'?'Flag':'Notehead, stem, and flag',head=focus==='all'||focus==='head',stem=(focus==='all'||focus==='stem')&&value.beats!==4,flag=(focus==='all'||focus==='flag')&&value.beats===.5;
  const arrow=(d)=>'<path d="'+d+'" fill="none" stroke="#2b766e" stroke-width="3" marker-end="url(#note-part-arrow)"/>';
  let svg='<svg class="learning-note-parts" viewBox="0 0 450 275" role="img" aria-label="'+label+' on a '+({0.5:'eighth',1:'quarter',2:'half',4:'whole'}[value.beats])+ ' note"><defs><marker id="note-part-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#2b766e"/></marker></defs><rect x="1" y="1" width="448" height="273" rx="12" fill="#fff9e9"/><text class="coda-music-glyph" x="98" y="190" font-size="140" fill="#653780">'+symbol.char+'</text><g font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#235950">';
  if(head)svg+='<text x="18" y="245">Notehead</text>'+arrow('M136 235L128 205');
  if(stem)svg+='<text x="277" y="155">Stem</text>'+arrow('M267 147L154 136');
  if(flag)svg+='<text x="277" y="51">Flag</text>'+arrow('M265 56L177 89');
  figure.innerHTML=svg+'</g></svg>';notation.load?.(figure.ownerDocument);return true;
 }
 function create(api={}){
  const host=api.host;if(!host?.ownerDocument)fail('A classroom learning path needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView,data=api.data||win.CodaClassroomLearningPathsData,content=api.content||win.CodaEducationContent;
  const category=copy(api.category||data?.getCategory?.(api.lessonId,{content}));if(!validateCategory(category))fail('This category could not load its short lessons.');
  const id=category.id,fullModel=copy(content?.getQuiz?.(id)||quizModule.QUIZZES[id]||win.CodaAccidentalsLesson?.QUIZ),basicModel=copy(category.basicsQuiz||data?.basicsQuiz?.(id,{content}));
  if(!Array.isArray(fullModel?.questions)||!Array.isArray(basicModel?.questions))fail('This category could not load its quiz.');
  let storage=api.storage;if(storage===undefined)try{storage=win.localStorage;}catch{}
  const currentRevision=()=>revisionOf(api.category||data.getCategory(id,{content}),content?.getQuiz?.(id)||quizModule.QUIZZES[id]||win.CodaAccidentalsLesson?.QUIZ,content?.getLessonRevision?.(id)||'');
  const getChecks=card=>data?.getChecks?.(id,card)||[card];
  const revision=currentRevision(),session=createSession({category,storage,revision,getRevision:currentRevision,canRecord:api.canRecord,getChecks});
  let phase='menu',sectionId=null,study=null,quiz=null,destroyed=false,claiming=false,error='',award=null,canonicalSaved=false;
  const customFull=fullModel.custom===true||content?.isLessonEdited?.(id)===true||id==='accidentals-key-signatures',lessonKey=customFull?'codaAuthoredLessonsV1':'codaClassroomLessonsV1';
  const contentRevision=content?.getLessonRevision?.(id)||revision;
  let expectedLesson=null;try{expectedLesson=JSON.stringify(JSON.parse(storage?.getItem?.(lessonKey)||'null')?.lessons?.[id]??null);}catch{}
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const changed=()=>api.onChange?.(getState());
  const button=(label,action,name,value='')=>{const item=node('button','',label);item.type='button';if(name)item.setAttribute('data-path-'+name,value);item.onclick=()=>{if(!session.canRecord()){error='Your profile or lesson changed. Reopen this category.';renderMenu();return;}action();};return item;};
  function stopAudio(){study?.stopAudio();}
  function cleanActive(){stopAudio();study?.destroy();study=null;quiz?.destroy();quiz=null;}
  function focus(){host.querySelector('h3,[data-study-heading]')?.focus({preventScroll:true});const book=host.closest('.classroom-books');if(book)book.scrollTop=0;}
  function frame(title){host.replaceChildren();host.classList.add('classroom-learning-paths');host.dataset.learningPath=id;host.dataset.pathPhase=phase;const nav=node('div','learning-path-nav');nav.append(button('← '+category.title+' lessons',showMenu,'menu'));if(api.onExit)nav.append(button('All categories',api.onExit,'exit'));host.append(nav);const h=node('h3','learning-path-title',title);h.tabIndex=-1;host.append(h);return host;}
  function showError(parent){const state=session.getState();if(!error&&!state.error)return;const message=node('p','learning-path-status',error||state.error);message.setAttribute('role','status');parent.append(message);}
  function renderMenu(){
   if(destroyed)return;phase='menu';sectionId=null;cleanActive();host.replaceChildren();host.classList.add('classroom-learning-paths');host.dataset.learningPath=id;host.dataset.pathPhase='menu';
   const heading=node('h3','learning-path-title',category.title+' lessons');heading.tabIndex=-1;host.append(heading,node('p','learning-path-intro',category.intro||''));showError(host);
   const state=session.getState(),completed=new Map(state.sections.map(section=>[section.id,section]));
   if(!state.hasCards){host.append(node('p','learning-path-help','No teaching cards yet. Open the lesson editor to add a card.'));if(api.onExit)host.append(button('All categories',api.onExit,'exit'));changed();focus();return;}
   for(const tier of ['basic','advanced']){
    const sections=category.sections.filter(section=>section.tier===tier&&section.cards.length);if(!sections.length)continue;
    const group=node('section','learning-path-group');group.dataset.pathTier=tier;group.setAttribute('aria-label',tier==='basic'?'Basics':'Advanced lessons');group.append(node('h4','',tier==='basic'?'Start here':'Advanced lessons'));
    if(tier==='advanced'&&state.hasBasics&&!state.basicsPassedAt)group.append(node('p','learning-path-help','Finish the basics quiz first.'));
    const list=node('ol','learning-path-list');
    sections.forEach(section=>{const saved=completed.get(section.id),row=node('li'),item=button('',()=>openSection(section.id),'section',section.id);item.disabled=!saved.available;item.className='learning-path-section';item.dataset.completed=String(saved.completed);item.append(node('strong','',section.title),node('span','',saved.completed?'✓ Complete':saved.passed?String(saved.passed)+' / '+saved.total+' steps':'About '+section.cards.length+' small steps'));row.append(item);list.append(row);});
    group.append(list);
    const isBasic=tier==='basic',ready=isBasic?state.basicsReady&&basicModel.questions.length>0:state.allReady&&(!state.hasBasics||state.basicsPassedAt>0)&&fullModel.questions.length>0,passed=isBasic?state.basicsPassedAt>0:state.completedAt>0;
    const quizButton=button((passed?'✓ ':'')+(isBasic?'Basics quiz':'Full category quiz'),()=>openQuiz(isBasic?'basic':'full'),'quiz',isBasic?'basic':'full');quizButton.disabled=!ready;quizButton.className='learning-path-quiz';group.append(quizButton);host.append(group);
   }
   if(!category.sections.some(section=>section.tier==='advanced'&&section.cards.length)){const full=button(state.completedAt?'✓ Full category quiz':'Full category quiz',()=>openQuiz('full'),'quiz','full');full.disabled=!state.allReady||state.hasBasics&&!state.basicsPassedAt||!fullModel.questions.length;host.append(full);}
   if(state.completedAt)host.append(node('p','learning-path-success','Category complete! You can review any lesson.'));
   if(api.onPractice&&(id!=='rhythm-tree'||state.basicsPassedAt>0))host.append(button(['note-naming','bass-clef','grand-staff'].includes(id)?'Piano and staff practice':'Guided practice',api.onPractice,'practice'));
   if(api.onExit)host.append(button('All categories',api.onExit,'exit'));changed();focus();
  }
  function showMenu(){if(destroyed)return;error='';renderMenu();}
  function openSection(nextId){
   if(destroyed||!session.canRecord()||!session.canOpenSection(nextId))return false;
   const section=category.sections.find(section=>section.id===nextId);if(!section)return false;cleanActive();phase='section';sectionId=nextId;
   frame(section.title);const mount=node('div','learning-path-activity');host.append(mount);
   study=studyModule.create({host:mount,lessonId:id,title:section.title,cards:section.cards,getChecks,revision:session.sectionRevision(nextId),getRevision:()=>session.sectionRevision(nextId),storage:session.sectionStorage(nextId),canRecord:()=>session.canRecord(),renderVisual,onExit:showMenu,onComplete:()=>{error='';renderMenu();},onChange:changed});study.open();changed();return true;
  }
  function guardedQuizStorage(){
   const key=customFull?quizModule.CUSTOM_KEY:quizModule.KEY;let expected='null';
   try{expected=JSON.stringify(JSON.parse(storage?.getItem?.(key)||'null')?.quizzes?.[id]??null);}catch{}
   return {getItem:name=>storage?.getItem?.(name)??null,setItem(name,value){
    if(name!==key||!session.canRecord()||!session.allReady())fail('Your profile or lesson changed.');
    const raw=storage?.getItem?.(key),journal=raw===null||raw===undefined?{version:1,quizzes:{}}:JSON.parse(raw);if(!object(journal)||journal.version!==1||!object(journal.quizzes))fail('Your quiz could not reopen.');
    if(JSON.stringify(journal.quizzes[id]??null)!==expected)fail('Your saved quiz changed. Reopen this category.');
    const candidate=JSON.parse(value);journal.quizzes[id]=candidate.quizzes[id];storage.setItem(key,JSON.stringify(journal));expected=JSON.stringify(journal.quizzes[id]);
   }};
  }
  function openQuiz(kind){
   const current=session.getState();
   if(destroyed||!session.canRecord()||kind==='basic'&&(!current.hasBasics||!basicModel.questions.length||!session.basicsReady())||kind==='full'&&(!fullModel.questions.length||!session.allReady()||current.hasBasics&&!current.basicsPassedAt))return false;
   cleanActive();phase=kind==='basic'?'basics-quiz':'category-quiz';sectionId=null;frame(kind==='basic'?'A little basics quiz':'Full category quiz');const mount=node('div','learning-path-activity');host.append(mount);
   const basic=kind==='basic';quiz=quizModule.create({host:mount,lessonId:id,attemptStorage:storage,model:basic?{...basicModel,custom:true}:fullModel,custom:basic||customFull,contentRevision:basic?revision:contentRevision,content,storage:basic?session.basicsStorage:guardedQuizStorage(),canRecord:()=>session.canRecord()&&(basic?session.basicsReady():session.allReady()),renderVisual,onPassed:()=>{
    if(basic){if(session.markBasicsPassed()){error='';renderMenu();}else{error=session.getState().error;renderResult();}}
    else void claimCompletion();
   }});quiz.render();changed();focus();return true;
  }
  function saveCanonicalCompletion(){
   if(canonicalSaved||id==='accidentals-key-signatures')return true;
   const total=tutorialModule.LESSONS.find(lesson=>lesson.id===id)?.total;if(!total)fail('Choose a known category.');
   const raw=storage?.getItem?.(lessonKey),journal=raw===null||raw===undefined?{version:1,lessons:{}}:JSON.parse(raw);
   if(!object(journal)||journal.version!==1||!object(journal.lessons)||JSON.stringify(journal.lessons[id]??null)!==expectedLesson)fail('Your lesson progress changed. Reopen this category before saving its reward.');
   const old=journal.lessons[id],timestamp=old?.completedAt>0?old.completedAt:Math.max(1,Date.now());
   if(customFull)journal.lessons[id]={revision:contentRevision,step:total,completed:true,completedAt:timestamp};else{
    const normalized=tutorialModule.normalize(journal);normalized.lessons[id]={step:total,completed:true,completedAt:timestamp};journal.lessons=normalized.lessons;
   }
   storage.setItem(lessonKey,JSON.stringify(journal));expectedLesson=JSON.stringify(journal.lessons[id]);canonicalSaved=true;return true;
  }
  async function claimCompletion(){
   const checked=quiz?.getState();if(claiming||!session.canRecord()||!session.allReady()||!checked?.passed||!checked.saved||checked.phase!=='result')return false;
   claiming=true;phase='reward';error='';renderResult();
   try{
    saveCanonicalCompletion();
    if(!api.onComplete)fail('Reopen this category from the classroom to save its reward.');
    const result=await api.onComplete(id,{title:category.title,score:checked.score,total:checked.total,passed:true});
    if(result?.ok===false)fail(result.error||'Your reward could not save. Try again.');
    if(!session.canRecord())fail('Your profile or lesson changed. Reopen this category.');
    if(!session.markCompleted())fail(session.getState().error||'Your completion could not save.');
    award=result||null;phase='complete';return true;
   }catch(failure){error=failure.message||'Your completion could not save. Try again.';return false;}
   finally{claiming=false;renderResult();}
  }
  function renderResult(){
   if(destroyed)return;stopAudio();const finished=phase==='complete';frame(finished?'Category complete!':claiming?'Saving your reward…':'Let’s save your progress');
   if(error)showError(host);else host.append(node('p','learning-path-success',finished?(award?.alreadyAwarded?'You already earned this reward. Keep practising!':award?.amount>0?'+'+award.amount+' XP. Well done!':'Well done! Your category is complete.'):'Your lesson stays open while we save.'));
   if(!finished&&!claiming){const retry=button('Try saving again',()=>{if(phase==='basics-quiz'){if(session.markBasicsPassed())renderMenu();else renderResult();}else void claimCompletion();},'save');host.append(retry);}
   changed();focus();
  }
  function getState(){const progress=session.getState();return {...progress,id,title:category.title,phase,sectionId,study:study?.getState()||null,quiz:quiz?.getState()||null,claiming,error:error||progress.error,completed:progress.completedAt>0,audioPlaying:false};}
  return {open(){if(destroyed)return false;renderMenu();return true;},openSection,openQuiz,showMenu,openStudy:showMenu,stopAudio,getState,destroy(){if(destroyed)return;destroyed=true;cleanActive();session.destroy();host.replaceChildren();host.classList.remove('classroom-learning-paths');}};
 }
 return Object.freeze({KEY,VERSION,IDS,revisionOf,validateCategory,createSession,renderVisual,create});
});
