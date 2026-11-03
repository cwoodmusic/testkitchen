/* Child-facing classroom choices. Reading a menu never changes lesson saves. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./classroom-learning-paths.js'):root?.CodaClassroomLearningPaths,node?require('./classroom-learning-paths-data.js'):root?.CodaClassroomLearningPathsData,node?require('./classroom-quiz.js'):root?.CodaClassroomQuiz,node?require('./classroom-exam-study.js'):root?.CodaClassroomExamStudy,node?require('./classroom-tutorials.js'):root?.CodaClassroomTutorials,node?require('./classroom-accidentals-lesson.js'):root?.CodaAccidentalsLesson);
 if(node)module.exports=api;if(root)root.CodaClassroomMenus=api;
})(typeof window==='undefined'?null:window,function(defaultPaths,defaultData,defaultQuiz,defaultStudy,defaultTutorials,defaultAccidentals){
 'use strict';
 const STARTERS=Object.freeze(['note-naming','rhythm-tree','time-signatures']);
 const LABELS=Object.freeze({
  'note-naming':{title:'Note names',description:'Read notes on the staff.',icon:'notes'},
  'rhythm-tree':{title:'Note lengths',description:'Find out how long notes last.',icon:'lengths'},
  'time-signatures':{title:'Time signatures',description:'Count beats in each measure.',icon:'meter'},
  'bass-clef':{description:'Read the lower notes.',icon:'notes'},
  'grand-staff':{description:'Bring the two staffs together.',icon:'notes'},
  'major-minor-keys':{description:'Find a tune’s musical home.',icon:'keys'},
  dynamics:{description:'Explore loud and soft sounds.',icon:'sound'},
  tempo:{description:'Explore fast and slow beats.',icon:'clock'},
  'accidentals-key-signatures':{description:'Meet sharps, flats, and naturals.',icon:'keys'}
 });
 const STATUS=Object.freeze({new:'New',progress:'In progress',finished:'Finished'});
 const FALLBACK_CATEGORIES=Object.freeze([
  {id:'note-naming',title:'Note names'}, {id:'rhythm-tree',title:'Note lengths'}, {id:'time-signatures',title:'Time signatures'},
  {id:'bass-clef',title:'Bass clef'}, {id:'grand-staff',title:'Grand staff & Middle C'}, {id:'major-minor-keys',title:'Major & minor keys'},
  {id:'dynamics',title:'Dynamics: loud & soft'}, {id:'tempo',title:'Tempo: fast & slow'}, {id:'accidentals-key-signatures',title:'Accidentals & key signatures'}
 ]);
 function legacyCompletion(api,id,model,revision){
  const quiz=api.quiz||defaultQuiz,tutorials=api.tutorials||defaultTutorials,study=api.study||defaultStudy,accidentals=api.accidentals||defaultAccidentals,content=api.content;
  if(!quiz?.createSession||!model)return false;
  try{
   const edited=content?.isLessonEdited?.(id)===true,custom=model.custom===true||edited||id==='accidentals-key-signatures';
   let completed=false,contentRevision=content?.getLessonRevision?.(id)||revision;
   if(id==='accidentals-key-signatures'){
    contentRevision=content?.getLessonRevision?.(id)||study.revisionOf([content?.getStudyCards?.(id)||accidentals.CARDS,model]);
    const entry=JSON.parse(api.storage?.getItem?.(quiz.CUSTOM_KEY)||'null')?.quizzes?.[id];
    completed=entry?.revision===contentRevision&&Number.isSafeInteger(entry.rewardedAt)&&entry.rewardedAt>0;
   }else if(custom){
    const entry=JSON.parse(api.storage?.getItem?.(tutorials.CUSTOM_KEY)||'null')?.lessons?.[id],total=tutorials.LESSONS.find(lesson=>lesson.id===id)?.total;
    completed=!!total&&entry?.revision===contentRevision&&entry.completed===true&&entry.step===total&&entry.completedAt>0;
   }else{
    const entry=tutorials?.readProgress?.(api.storage)?.lessons?.find(lesson=>lesson.id===id);
    completed=entry?.completed===true&&entry.completedAt>0;
   }
   if(!completed)return false;
   // Legacy sessions only read here. A saved lesson alone is insufficient:
   // its matching saved quiz must also contain a passing result.
   const saved=quiz.createSession({lessonId:id,storage:api.storage,model,custom,contentRevision,content,randomize:false,canRecord:()=>false}).getState();
   return saved.total>0&&saved.saved&&saved.bestScore>=saved.passScore;
  }catch{return false;}
 }
 function readProgress(api={}){
  const paths=api.paths||defaultPaths,data=api.data||defaultData,quiz=api.quiz||defaultQuiz,study=api.study||defaultStudy,content=api.content;
  const definitions=data?.CATEGORIES||FALLBACK_CATEGORIES;
  return definitions.map(definition=>{
   const words=LABELS[definition.id]||{},id=definition.id;
   let session=null;
   try{
    const category=data.getCategory(id,{content}),model=content?.getQuiz?.(id)||quiz?.QUIZZES?.[id]||(id==='accidentals-key-signatures'?(api.accidentals||defaultAccidentals)?.QUIZ:null);
    // Match the active learning path exactly, so edited lessons cannot inherit
    // a Finished badge or unlock from an older version of the content.
    const revision=paths.revisionOf(category,model,content?.getLessonRevision?.(id)||'');
    session=paths.createSession({category,storage:api.storage,revision,getChecks:card=>data.getChecks?.(id,card)||[card]});
    const state=session.getState();
    const stored=state.sections.map(section=>{
     const value=JSON.parse(session.sectionStorage(section.id).getItem(study.KEY)||'null');
     return {...section,entry:value?.lessons?.[id]||null};
    });
    const started=stored.some(section=>section.entry!==null)||!!state.basicsQuiz||state.basicsPassedAt>0||state.completedAt>0;
    const finished=state.completedAt>0||legacyCompletion({...api,quiz,study},id,model,revision);
    const next=stored.find(section=>section.available&&!section.completed);
    const nextModel=category.sections.find(section=>section.id===next?.id);
    const nextCard=nextModel?.cards?.[next?.entry?.index||0];
    const status=finished?'finished':started?'progress':'new';
    const detail=finished?'Ready to review.':next?(started?'Last time: ':'Start with: ')+(nextCard?.title||next.title):state.basicsReady&&!state.basicsPassedAt?'Your basics quiz is ready.':state.allReady?'Your full category quiz is ready.':words.description||category.intro;
    return {id,title:content?.isLessonEdited?.(id)?category.title:words.title||category.title,description:words.description||category.intro,icon:words.icon||'book',status,statusLabel:STATUS[status],started:started||finished,finished,detail,sectionId:started&&!finished?next?.id:null,sections:stored.map(({entry,...section})=>section),passed:stored.reduce((sum,section)=>sum+section.passed,0),total:stored.reduce((sum,section)=>sum+section.total,0),basicsPassed:state.basicsPassedAt>0,unavailable:!state.saved,error:state.error||''};
   }catch{
    return {id,title:words.title||definition.title,description:words.description||definition.intro,icon:words.icon||'book',status:'new',statusLabel:STATUS.new,started:false,finished:false,detail:'Open this lesson to get started.',sectionId:null,sections:[],passed:0,total:0,basicsPassed:false,unavailable:true,error:'Your saved lesson could not be read.'};
   }finally{session?.destroy();}
  }).sort((a,b)=>{
   const order=id=>{const index=STARTERS.indexOf(id);return index<0?STARTERS.length+definitions.findIndex(item=>item.id===id):index;};
   return order(a.id)-order(b.id);
  });
 }
 function recommendedLesson(lessons,lastLesson){return lessons.find(lesson=>lesson.id===lastLesson&&lesson.status==='progress')||lessons.find(lesson=>lesson.status==='progress')||lessons.find(lesson=>lesson.status==='new')||lessons[0]||null;}
 const icons={
  continue:'<path d="M20 10h24v42L32 44 20 52Z" fill="#ffd36b"/><path d="m27 21 13 9-13 9Z" fill="#143e3c"/>',
  book:'<path d="M8 15q12-5 24 1 12-6 24-1v34q-12-4-24 1-12-5-24-1Z" fill="#b8b3ff"/><path d="M32 17v32M15 24h10m-10 8h10m14-8h10m-10 8h10" fill="none" stroke="#2e3156" stroke-width="3" stroke-linecap="round"/>',
  search:'<path d="M9 12h29v39H9Z" fill="#ffd36b"/><path d="M17 22h13m-13 9h11" stroke="#635122" stroke-width="3"/><circle cx="40" cy="34" r="13" fill="#a7dbe9" stroke="#30455e" stroke-width="4"/><path d="m49 44 10 11" stroke="#f7b78c" stroke-width="7" stroke-linecap="round"/>',
  star:'<path d="m32 6 8 17 19 3-14 14 4 19-17-9-17 9 4-19L5 26l19-3Z" fill="#ffd36b"/><path d="m22 33 7 7 14-15" fill="none" stroke="#225f52" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  notes:'<path d="M7 16h50M7 24h50M7 32h50M7 40h50M7 48h50" stroke="#48657c" stroke-width="2"/><ellipse cx="23" cy="40" rx="6" ry="4" fill="#273558"/><path d="M28 39V17" stroke="#273558" stroke-width="3"/><ellipse cx="45" cy="32" rx="6" ry="4" fill="#273558"/><path d="M50 31V9" stroke="#273558" stroke-width="3"/>',
  lengths:'<ellipse cx="17" cy="47" rx="7" ry="5" fill="#4e3c79"/><path d="M23 46V14M51 46V14" stroke="#4e3c79" stroke-width="3" stroke-linecap="round"/><ellipse cx="45" cy="47" rx="7" ry="5" fill="none" stroke="#4e3c79" stroke-width="3"/>',
  meter:'<path d="m37 9-17 18h25m-8-18v25m0 7L20 54h25m-8-13v19" fill="none" stroke="#34416a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  keys:'<rect x="8" y="13" width="48" height="39" rx="3" fill="#fff6df" stroke="#3e4561" stroke-width="2"/><path d="M20 14v37m12-37v37m12-37v37" stroke="#3e4561" stroke-width="2"/><path d="M17 14h7v23h-7m12-23h7v23h-7m12-23h7v23h-7" fill="#3e4561"/>',
  sound:'<path d="M9 25h12l15-13v40L21 39H9Z" fill="#78648f"/><path d="M43 22q10 10 0 20m8-28q18 18 0 36" fill="none" stroke="#78648f" stroke-width="4" stroke-linecap="round"/>',
  clock:'<circle cx="32" cy="33" r="23" fill="#d6eef6" stroke="#3f5273" stroke-width="3"/><path d="M32 17v17l11 7" fill="none" stroke="#3f5273" stroke-width="4" stroke-linecap="round"/>'
 };
 function create(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('Classroom menus need a host.');
  const doc=host.ownerDocument,win=doc.defaultView;
  let page='home',opened=false,destroyed=false,lastLesson=null,lessons=[];
  let storage=api.storage;if(storage===undefined)try{storage=win.localStorage;}catch{}
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(label,action,name)=>{const item=node('button','',label);item.type='button';if(name)item.dataset.classroomMenu=name;item.onclick=action;return item;};
  const icon=kind=>{const item=node('span','classroom-menu-icon');item.setAttribute('aria-hidden','true');item.innerHTML='<svg viewBox="0 0 64 64" focusable="false">'+(icons[kind]||icons.book)+'</svg>';return item;};
  const statusBadge=lesson=>node('span','classroom-menu-badge classroom-menu-badge-'+lesson.status,(lesson.finished?'✓ ':'')+lesson.statusLabel);
  function choose(lesson,resume=false){
   if(!lesson)return;lastLesson=lesson.id;
   api.onLesson?.(lesson.id,resume&&lesson.sectionId?{sectionId:lesson.sectionId}:{});
  }
  function heading(title,subtitle){
   const header=node('header','classroom-menu-header');
   if(page!=='home')header.append(button('‹ Classroom menu',()=>show('home'),'home'));
   header.append(node('p','classroom-menu-eyebrow',page==='home'?'Music classroom':page==='progress'?'My progress':page==='all'?'All lessons':'Choose a lesson'));
   const titleNode=node('h2','',title);titleNode.tabIndex=-1;titleNode.dataset.classroomMenuHeading='';header.append(titleNode);if(subtitle)header.append(node('p','classroom-menu-subtitle',subtitle));host.append(header);
  }
  function lessonCard(lesson,compact=false){
   const item=button('',()=>choose(lesson,lesson.status==='progress'));
   item.className='classroom-menu-lesson'+(compact?' classroom-menu-lesson-compact':'');item.dataset.classroomLesson=lesson.id;item.dataset.status=lesson.status;
   const body=node('span','classroom-menu-lesson-body');body.append(node('strong','',lesson.title),node('span','classroom-menu-description',lesson.status==='progress'?lesson.detail:lesson.description),statusBadge(lesson));
   item.append(icon(lesson.icon),body,node('span','classroom-menu-action',lesson.finished?'Review':lesson.started?'Continue':'Start'));return item;
  }
  function renderHome(){
   heading('Ready to learn?','Pick what you’d like to do.');
   const grid=node('div','classroom-menu-grid'),recommended=recommendedLesson(lessons,lastLesson);
   const choices=[
    {id:'continue',title:recommended?.status==='new'?'Start learning':recommended?.finished?'Review a lesson':'Keep learning',description:recommended?recommended.title+(recommended.status==='progress'?' · '+recommended.detail.replace(/^Last time: /,''):recommended.status==='new'?' · A good place to start':''): 'Choose your first music skill.',icon:'continue',action:()=>choose(recommended,true),featured:true},
    {id:'lessons',title:'Choose a lesson',description:'Find your next music skill.',icon:'book',action:()=>show('lessons')},
    {id:'reference',title:'Look something up',description:'Get a quick reminder.',icon:'search',action:()=>api.onReference?.()},
    {id:'progress',title:'My progress',description:'See what you’ve learned.',icon:'star',action:()=>show('progress')}
   ];
   for(const choice of choices){const item=button('',choice.action,choice.id);item.className='classroom-menu-choice'+(choice.featured?' classroom-menu-featured':'');item.append(icon(choice.icon),node('strong','',choice.title),node('span','classroom-menu-description',choice.description));if(choice.featured&&recommended)item.append(statusBadge(recommended));grid.append(item);}
   host.append(grid);
   const footer=node('footer','classroom-menu-footer');footer.append(button('← Back to classroom',()=>api.onRoom?.(),'room'));host.append(footer);
  }
  function lessonFlow(){const flow=node('p','classroom-menu-flow');flow.setAttribute('aria-label','Learn, then try it, then quick quiz');flow.append(node('span','','Learn'),node('span','classroom-menu-flow-arrow','→'),node('span','','Try it'),node('span','classroom-menu-flow-arrow','→'),node('span','','Quick quiz'));return flow;}
  function renderLessons(){
   heading(page==='all'?'Find your next music skill':'What will you learn?',page==='all'?'Choose a topic. Each one starts with the basics.':null);
   const list=node('div','classroom-menu-lessons');for(const lesson of lessons.filter(item=>page==='all'||STARTERS.includes(item.id)))list.append(lessonCard(lesson,page==='all'));host.append(list);
   const footer=node('footer','classroom-menu-footer classroom-menu-lesson-footer');
   if(page!=='all')footer.append(button('All lessons →',()=>show('all'),'all'));
   else if(api.onExam){const exam=node('div','classroom-menu-exam');exam.append(node('strong','','Ready for a challenge?'),node('p','','Try a little from every lesson. No timer.'),button('Haydn’s Final Exam',()=>api.onExam(),'exam'));footer.append(exam);}
   footer.append(lessonFlow());host.append(footer);
  }
  function renderProgress(){
   const finished=lessons.filter(lesson=>lesson.finished).length;
   heading('Look what you’ve learned!',finished?finished+' '+(finished===1?'topic':'topics')+' finished. Keep going at your own pace.':'Every small step helps you learn.');
   const list=node('div','classroom-menu-progress-list');
   for(const lesson of lessons){const row=node('section','classroom-menu-progress-row');row.dataset.progressLesson=lesson.id;row.dataset.status=lesson.status;
    const body=node('div','classroom-menu-progress-body');body.append(node('h3','',lesson.title),statusBadge(lesson));
    let detail=lesson.finished?'Full category quiz passed.':lesson.passed>0?lesson.passed+' of '+lesson.total+' practice steps finished.':lesson.started?'You’ve made a start. Keep going!':'Ready when you are.';
    if(lesson.basicsPassed&&!lesson.finished)detail+=' Basics quiz passed.';
    if(lesson.unavailable)detail='Open this lesson to check your saved progress.';
    body.append(node('p','',detail));row.append(icon(lesson.icon),body,button(lesson.finished?'Review':lesson.started?'Continue':'Start',()=>choose(lesson,lesson.started)));list.append(row);
   }
   host.append(list,node('p','classroom-menu-progress-help','A topic is Finished after you pass its full category quiz and save your progress.'));
  }
  function show(nextPage='home',focus=true){
   if(destroyed)return;page=['home','lessons','all','progress'].includes(nextPage)?nextPage:'home';opened=true;
   lessons=readProgress({storage,content:api.content||win.CodaEducationContent,paths:win.CodaClassroomLearningPaths||defaultPaths,data:win.CodaClassroomLearningPathsData||defaultData,quiz:win.CodaClassroomQuiz||defaultQuiz,study:win.CodaClassroomExamStudy||defaultStudy,tutorials:win.CodaClassroomTutorials||defaultTutorials,accidentals:win.CodaAccidentalsLesson||defaultAccidentals});
   host.hidden=false;host.classList.add('classroom-kids-menu');host.dataset.menuPage=page;host.replaceChildren();
   if(page==='home')renderHome();else if(page==='progress')renderProgress();else renderLessons();
   if(focus){host.querySelector('[data-classroom-menu-heading]')?.focus({preventScroll:true});const book=host.closest('.classroom-books');if(book)book.scrollTop=0;}
   api.onPageChange?.(page);
  }
  function hide(){opened=false;host.hidden=true;}
  function getState(){return {open:opened,page,lessons:lessons.map(lesson=>({...lesson,sections:lesson.sections.map(section=>({...section}))})),recommended:recommendedLesson(lessons,lastLesson)?.id||null};}
  return {show,hide,getState,destroy(){if(destroyed)return;destroyed=true;opened=false;host.replaceChildren();host.classList.remove('classroom-kids-menu');delete host.dataset.menuPage;}};
 }
 return Object.freeze({STARTERS,LABELS,readProgress,recommendedLesson,create});
});
