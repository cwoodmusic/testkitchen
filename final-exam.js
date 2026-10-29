/* Haydn's balanced, resumable final exam. Stores bounded answers, never names. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 let bank=root?.CodaFinalExamBank,notation=root?.CodaMusicNotation,quiz=root?.CodaClassroomQuiz,editorNotation=root?.CodaEducationNotation;
 if(node){try{bank=require('./final-exam-bank.js');}catch{}notation=require('./music-notation.js');quiz=require('./classroom-quiz.js');try{editorNotation=require('./education-notation.js');}catch{}}
 const library=factory(bank,notation,quiz,()=>root?.CodaEducationContent?.getExamBank?.(),()=>root?.CodaEducationNotation||editorNotation);if(node)module.exports=library;if(root)root.CodaFinalExam=library;
})(typeof window==='undefined'?null:window,function(defaultBank,notation,quiz,authoredBank,editedNotation){
 'use strict';
 const KEY='codaHaydnFinalExamV1',CUSTOM_KEY='codaAuthoredExamSessionV1',VERSION=1,PASS_PERCENT=80;
 const SIZES=Object.freeze([24,40,80]);
 const CATEGORY_IDS=Object.freeze(['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo']);
 const TITLES=Object.freeze({'note-naming':'Treble & note names','bass-clef':'Bass clef','grand-staff':'Grand staff & Middle C','rhythm-tree':'Note lengths & rhythm','time-signatures':'Time signatures','major-minor-keys':'Major & minor keys',dynamics:'Dynamics',tempo:'Tempo'});
 const ORDERS=Object.freeze([[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].map(Object.freeze));
 const copy=value=>JSON.parse(JSON.stringify(value));
 const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
 const emptyCategories=()=>Object.fromEntries(CATEGORY_IDS.map(id=>[id,{correct:0,total:0}]));
 function getDefaults(){return {version:1,bankVersion:1,size:40,questionIds:[],orders:[],answers:[],index:0,submitted:false,attempts:0,bestPercent:0,bestScore:0,bestTotal:0,bestByCategory:emptyCategories(),completedAt:0};}
 function categories(bank=defaultBank){return CATEGORY_IDS.map(id=>({id,title:bank?.CATEGORIES?.find(item=>item.id===id)?.title||TITLES[id],poolSize:bank?.pool?.(id)?.length||0}));}
 function questionFor(bank,id){if(typeof bank?.getQuestion==='function')return bank.getQuestion(id);return bank?.QUESTIONS?.find?.(item=>item.id===id)||CATEGORY_IDS.flatMap(category=>bank?.pool?.(category)||[]).find(item=>item.id===id);}
 function validQuestion(question,custom=false){return !!question&&typeof question.id==='string'&&(!custom||/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(question.id))&&CATEGORY_IDS.includes(question.category)&&typeof question.prompt==='string'&&Array.isArray(question.choices)&&(custom?integer(question.choices.length,2,6):question.choices.length===3)&&question.choices.every(choice=>choice&&typeof choice.id==='string'&&typeof choice.text==='string')&&new Set(question.choices.map(choice=>choice.id)).size===question.choices.length&&question.choices.some(choice=>choice.id===question.answer);}
 function scoreRecord(record,bank=defaultBank){
  const byCategory=emptyCategories();let score=0;
  record.questionIds.forEach((id,index)=>{const question=questionFor(bank,id);if(!validQuestion(question,bank?.custom===true))return;const group=byCategory[question.category];group.total++;if(question.choices[record.answers[index]]?.id===question.answer){group.correct++;score++;}});
  const total=record.questionIds.length,percent=total?Math.round(score/total*100):0;
  return {score,total,percent,passed:total>0&&score*100>=total*PASS_PERCENT,byCategory};
 }
 function validateState(raw,bank=defaultBank){
  const fail=error=>({ok:false,error}),custom=bank?.custom===true;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('An exam record is required.');
  const fields=Object.keys(getDefaults());if(Object.keys(raw).some(key=>!fields.includes(key))||fields.some(key=>!(key in raw)))return fail('The exam record contains unsupported fields.');
  if(raw.version!==1||raw.bankVersion!==1||!SIZES.includes(raw.size)||typeof raw.submitted!=='boolean')return fail('The saved exam version is unavailable.');
  if(!integer(raw.index,0,80)||!integer(raw.attempts,0,100000)||!integer(raw.bestPercent,0,100)||!integer(raw.bestScore,0,80)||![0,...SIZES].includes(raw.bestTotal)||raw.bestScore>raw.bestTotal||!integer(raw.completedAt,0,253402300799999))return fail('The saved exam result is outside its allowed range.');
  if(raw.bestPercent!==(raw.bestTotal?Math.round(raw.bestScore/raw.bestTotal*100):0))return fail('The saved exam percentage does not match its score.');
  if(!raw.bestByCategory||typeof raw.bestByCategory!=='object'||Object.keys(raw.bestByCategory).length!==8)return fail('The exam needs its eight category results.');
  let bestCorrect=0,bestTotal=0;
  for(const id of CATEGORY_IDS){const item=raw.bestByCategory[id];if(!item||Object.keys(item).length!==2||!integer(item.correct,0,10)||!integer(item.total,0,10)||item.correct>item.total||item.total!==(raw.bestTotal?raw.bestTotal/8:0))return fail('A saved category result is invalid.');bestCorrect+=item.correct;bestTotal+=item.total;}
  if(bestCorrect!==raw.bestScore||bestTotal!==raw.bestTotal||raw.completedAt>0&&(raw.bestTotal===0||raw.bestScore*100<raw.bestTotal*PASS_PERCENT))return fail('The saved passing result is inconsistent.');
  if(!Array.isArray(raw.questionIds)||!Array.isArray(raw.orders)||!Array.isArray(raw.answers)||raw.questionIds.length>80||raw.orders.length!==raw.questionIds.length||raw.answers.length!==raw.questionIds.length)return fail('The saved exam questions do not line up.');
  if(raw.questionIds.length===0){if(raw.index!==0||raw.submitted)return fail('An empty exam cannot be submitted.');}
  else{
   if(raw.questionIds.length!==raw.size||new Set(raw.questionIds).size!==raw.size||raw.index>raw.size)return fail('The saved exam must contain one complete, nonrepeating set.');
   const counts=Object.fromEntries(CATEGORY_IDS.map(id=>[id,0]));
   for(let index=0;index<raw.size;index++){
    const id=raw.questionIds[index],question=questionFor(bank,id),order=raw.orders[index];
    const validId=custom?typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id):typeof id==='string'&&/^(.+)-(?:00[1-9]|0[1-9][0-9]|100)$/.test(id)&&CATEGORY_IDS.includes(id.replace(/-[0-9]{3}$/, ''));
    const validOrder=custom?Array.isArray(order)&&order.length===question?.choices?.length&&new Set(order).size===order.length&&order.every(value=>integer(value,0,order.length-1)):integer(order,0,5);
    if(!validId||!validQuestion(question,custom)||question.id!==id||!custom&&!id.startsWith(question.category+'-')||!validOrder||!integer(raw.answers[index],-1,custom?question.choices.length-1:2))return fail('A saved exam question or answer is unavailable.');counts[question.category]++;
   }
   if(Object.values(counts).some(count=>count!==raw.size/8))return fail('The exam must include every category equally.');
   if(raw.submitted&&(raw.index!==raw.size||raw.answers.some(answer=>answer<0)))return fail('Every question needs an answer before submission.');
   if(!raw.submitted&&raw.index===raw.size)return fail('The exam position is outside its questions.');
  }
  return {ok:true,data:copy(raw)};
 }
 function normalize(raw,bank=defaultBank){const checked=validateState(raw,bank);return checked.ok?checked.data:getDefaults();}
 function randomNumber(random){const value=random();return Number.isFinite(value)?Math.min(.9999999999999999,Math.max(0,value)):0;}
 function shuffle(values,random){const list=[...values];for(let index=list.length-1;index>0;index--){const other=Math.floor(randomNumber(random)*(index+1));[list[index],list[other]]=[list[other],list[index]];}return list;}
 function sampleExam(bank,size=40,random=Math.random,attempt=0){
  if(!SIZES.includes(size))throw Error('Choose 24, 40, or 80 questions.');
  const questions=[],custom=bank?.custom===true;
  for(const id of CATEGORY_IDS){const pool=bank?.pool?.(id);if(!Array.isArray(pool)||(custom?pool.length<size/8:pool.length!==100)||pool.some(question=>!validQuestion(question,custom)||question.category!==id)||new Set(pool.map(question=>question.id)).size!==pool.length)throw Error(custom?(TITLES[id]+' needs at least '+size/8+' different questions for this exam length.'):'Each category needs its 100-question pool.');const mixed=shuffle(pool,random),offset=(attempt*(size/8))%pool.length;questions.push(...Array.from({length:size/8},(_,index)=>mixed[(offset+index)%pool.length]));}
  if(new Set(questions.map(question=>question.id)).size!==questions.length)throw Error('Every exam question needs its own ID.');
  return shuffle(questions,random).map(question=>({id:question.id,order:custom?shuffle(question.choices.map((_,index)=>index),random):Math.floor(randomNumber(random)*6)}));
 }
 function createSession(api={}){
  const fallback=()=>defaultBank||(typeof window!=='undefined'?window.CodaFinalExamBank:null);
  const getBank=typeof api.getBank==='function'?api.getBank:!api.bank?()=>authoredBank?.()||fallback():null;
  const bank=api.bank||getBank?.()||fallback(),custom=bank?.custom===true,key=custom?CUSTOM_KEY:KEY,revision=String(bank?.revision||'');
  let storage=api.storage;if(storage===undefined)try{storage=window.localStorage;}catch{}
  const now=()=>Math.max(1,Math.floor(api.now?.()||Date.now())),random=typeof api.random==='function'?api.random:Math.random;
  let raw=null,record=getDefaults(),saved=true,error='',claiming=false,destroyed=false,contentChanged=false;
  function decode(text){const parsed=JSON.parse(text||'null');if(!custom)return validateState(parsed,bank);if(!parsed||parsed.version!==1||typeof parsed.revision!=='string'||!parsed.state||Object.keys(parsed).some(field=>!['version','revision','state'].includes(field)))return {ok:false,error:'The edited exam record is unavailable.'};if(parsed.revision!==revision)return {ok:false,changed:true,error:'The edited questions changed. Start a fresh exam.'};return validateState(parsed.state,bank);}
  try{raw=storage?.getItem(key)??null;if(raw!==null){const checked=decode(raw);if(!checked.ok){if(checked.changed){error=checked.error;}else throw Error(checked.error);}else record=checked.data;}}catch{saved=false;error='This exam could not be reopened safely. Start a new exam to try again.';}
  const canRecord=()=>{
   if(destroyed)return false;
   try{if(api.canRecord?.()===false)return false;}catch{return false;}
   try{
    if(getBank&&!contentChanged){const current=getBank()||fallback();contentChanged=(current?.custom===true)!==custom||custom&&String(current?.revision||'')!==revision;}
    if(contentChanged){error='These questions changed. Close and reopen the exam before continuing.';return false;}
    return true;
   }catch{contentChanged=true;error='These questions could not be checked. Close and reopen the exam before continuing.';return false;}
  };
  const changed=()=>{try{api.onChange?.(getState());}catch{}return getState();};
  function getState(){
   const current=scoreRecord(record,bank),answered=record.answers.filter(answer=>answer>=0).length;
   return {...copy(record),phase:record.questionIds.length===0?'intro':record.submitted?'result':'question',answered,total:record.questionIds.length,score:record.submitted?current.score:null,percent:record.submitted?current.percent:null,passed:record.submitted&&current.passed,byCategory:record.submitted?current.byCategory:null,saved,error,claiming,categories:categories(bank),custom,contentRevision:custom?revision:null,contentChanged,rewardPending:record.bestTotal>0&&record.bestScore*100>=record.bestTotal*PASS_PERCENT&&!record.completedAt};
  }
  function save(next=record){
   if(!canRecord()){if(!contentChanged){saved=false;error='Your profile is resting. Reopen it before changing this exam.';}changed();return false;}
   const checked=validateState(next,bank);if(!checked.ok){saved=false;error=checked.error;return false;}
   try{
    if(!storage?.setItem||!storage?.getItem)throw Error('storage');const latest=storage.getItem(key);
    if(latest!==raw){const checked=decode(latest);if(!checked.ok||JSON.stringify(checked.data)!==JSON.stringify(record))throw Error('player-changed');}
    const encoded=JSON.stringify(custom?{version:1,revision,state:checked.data}:checked.data);storage.setItem(key,encoded);raw=encoded;record=checked.data;saved=true;error='';return true;
   }catch(failure){saved=false;if(failure.message!=='player-changed')record=checked.data;error=failure.message==='player-changed'?'Your player or saved exam changed. Close and reopen the exam before continuing.':'This exam could not save. Keep it open and try saving again.';return false;}
  }
  function start(size=40){if(!canRecord()){changed();return false;}let sampled;try{sampled=sampleExam(bank,size,random,record.attempts);}catch(failure){error=failure.message;saved=false;changed();return false;}const next={...record,size,questionIds:sampled.map(item=>item.id),orders:sampled.map(item=>item.order),answers:sampled.map(()=>-1),index:0,submitted:false};if(!save(next)){changed();return false;}changed();return true;}
  const answerOrder=index=>custom?record.orders[index]:ORDERS[record.orders[index]];
  function answer(displayIndex){if(!canRecord()){changed();return false;}if(record.submitted||!record.questionIds.length||!integer(displayIndex,0,(answerOrder(record.index)?.length||0)-1))return false;const next=copy(record);next.answers[next.index]=answerOrder(next.index)[displayIndex];if(!save(next)){changed();return false;}changed();return true;}
  function goTo(index){if(!canRecord()){changed();return false;}if(record.submitted||!integer(index,0,record.questionIds.length-1))return false;const next={...record,index};if(!save(next)){changed();return false;}changed();return true;}
  async function claimCompletion(){
   if(!canRecord()){changed();return false;}
   if(claiming||!saved||record.completedAt||record.bestTotal===0||record.bestScore*100<record.bestTotal*PASS_PERCENT)return false;
   claiming=true;changed();try{
    const result=await api.onComplete?.('haydn-final-exam',{score:record.bestScore,total:record.bestTotal,percent:record.bestPercent,byCategory:copy(record.bestByCategory),passed:true});
    if(result?.ok===false)throw Error(result.error||'Your completion reward could not save yet.');
    if(!canRecord())throw Error(contentChanged?error:'Your profile is resting. Reopen it to finish saving.');
    if(!save({...record,completedAt:now()}))throw Error(error);return true;
   }catch(failure){error=failure.message||'Your completion could not save yet. Try again.';return false;}finally{claiming=false;changed();}
  }
  function submit(){
   if(!canRecord()){changed();return false;}
   if(record.submitted||record.questionIds.length!==record.size||record.answers.some(answer=>answer<0))return false;
   const result=scoreRecord(record,bank),next={...copy(record),submitted:true,index:record.size,attempts:Math.min(100000,record.attempts+1)};
   if(!next.bestTotal||result.score*next.bestTotal>=next.bestScore*result.total){next.bestScore=result.score;next.bestTotal=result.total;next.bestPercent=result.percent;next.bestByCategory=result.byCategory;}
   if(!save(next)){changed();return false;}changed();if(result.passed)void claimCompletion();return true;
  }
  function question(){if(!record.questionIds.length||record.index>=record.questionIds.length)return null;const value=questionFor(bank,record.questionIds[record.index]);if(!value)return null;const order=answerOrder(record.index);return {...copy(value),displayChoices:order.map((index,displayIndex)=>({...value.choices[index],displayIndex,selected:record.answers[record.index]===index}))};}
  return {getState,snapshot:()=>copy(record),question,start,answer,goTo,submit,claimCompletion,save(){const ok=save();changed();if(ok&&record.bestTotal&&!record.completedAt)void claimCompletion();return ok;},getQuestion:id=>questionFor(bank,id),destroy(){destroyed=true;}};
 }
 function create(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('Haydn’s Final Exam needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView;let opened=false,destroyed=false,review=false,intro=false,priorFocus=null,session;
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(text,action,attribute)=>{const item=node('button','',text);item.type='button';item.onclick=action;if(attribute)item.setAttribute(attribute,'');return item;};
  session=createSession({...api,getBank:api.getBank||(!api.bank?()=>win?.CodaEducationContent?.getExamBank?.()||win?.CodaFinalExamBank:undefined),onChange:()=>{if(opened)render();api.onChange?.(session.getState());}});
  function focusHeading(){const heading=host.querySelector('[data-exam-heading]');heading?.focus({preventScroll:true});host.scrollIntoView?.({block:'start',behavior:'auto'});}
  function showQuestion(index){review=false;intro=false;if(session.goTo(index)){render();focusHeading();}}
  function visual(parent,stimulus){
   if(!stimulus)return;const figure=node('div','final-exam-visual');figure.setAttribute('role','img');
   if(['keyboard','clef-intro','note-parts','rhythm-tree'].includes(stimulus.kind)&&win?.CodaClassroomLearningPaths?.renderVisual?.(figure,stimulus)===true){parent.append(figure);notation?.load?.(doc);return;}
   if(stimulus.kind==='keyboard'&&win?.CodaClassroomKeyboard){const checked=win.CodaClassroomKeyboard.validateVisual(stimulus);if(!checked.ok)return;figure.innerHTML=win.CodaClassroomKeyboard.toSVG(checked.data);}
   else if(stimulus.kind==='clef-intro'&&win?.CodaClassroomTutorials?.clefReminderSVG&&['treble','bass'].includes(stimulus.clef)&&['clef','staff','lines','spaces'].includes(stimulus.page))figure.innerHTML=win.CodaClassroomTutorials.clefReminderSVG(stimulus.clef,stimulus.page);
   else if(stimulus.kind==='notation'&&editedNotation?.()){const renderer=editedNotation(),checked=renderer.validate(stimulus.score);if(!checked.ok)return;figure.innerHTML=renderer.toSVG(checked.data,{color:'#fff0cf'});}
   else if(stimulus.kind==='staff'&&quiz?.staffSVG){figure.innerHTML=quiz.staffSVG(stimulus.position,{clef:stimulus.clef,grand:stimulus.grand,label:stimulus.label||'Read the highlighted note.'});}
   else if(stimulus.kind==='rhythm'&&notation){figure.setAttribute('aria-label','The notes and rests in this question.');for(const note of stimulus.notes||[]){const mark=node('span');mark.innerHTML=notation.glyphSVG(note.beats,{rest:note.rest===true,color:'#fff0cf'});figure.append(mark);}}
   else if(stimulus.kind==='meter'){const parts=String(stimulus.meter).split('/');figure.classList.add('final-exam-meter');figure.setAttribute('aria-label',stimulus.meter+' time signature');figure.append(node('span','',parts[0]),node('span','',parts[1]));}
   else if(stimulus.kind==='scale'){figure.setAttribute('aria-label','Shown notes: '+(stimulus.notes||[]).map(letter=>letter==='?'?'missing note':letter.replaceAll('-flat',' flat').replaceAll('-sharp',' sharp')).join(', ')+'.');figure.classList.add('final-exam-note-ladder');for(const letter of stimulus.notes||[])figure.append(node('span','',letter.replaceAll('-flat','♭').replaceAll('-sharp','♯')));}
   else if(stimulus.kind==='dynamic'){figure.setAttribute('aria-label','Dynamic marking shown in the question.');figure.classList.add('final-exam-dynamic');if(['crescendo','decrescendo'].includes(stimulus.mark)){const points=stimulus.mark==='crescendo'?'140,8 12,32 140,56':'12,8 140,32 12,56';figure.innerHTML='<svg viewBox="0 0 152 64" width="200" height="84" aria-hidden="true"><polyline points="'+points+'" fill="none" stroke="currentColor" stroke-width="3"/></svg>';}else{const codes={pp:0xe52b,p:0xe520,mp:0xe52c,mf:0xe52d,f:0xe522,ff:0xe52f};figure.append(node('span','coda-music-glyph',codes[stimulus.mark]?String.fromCodePoint(codes[stimulus.mark]):stimulus.mark));}}
   else if(stimulus.kind==='tempo'){figure.setAttribute('aria-label','Tempo marking shown in the question.');figure.append(node('strong','',stimulus.text));if(stimulus.bpm)figure.append(node('span','',stimulus.bpm+' BPM'));}
   else return;parent.append(figure);notation?.load?.(doc);
  }
  function saveStatus(panel,state){if(!state.error)return;const box=node('div','final-exam-save-help');box.setAttribute('role','status');box.append(node('p','',state.error));if(!state.contentChanged)box.append(button('Try saving again',()=>session.save(),'data-exam-save'));panel.append(box);}
  function introduction(panel,state){
   const heading=node('h2','','Haydn’s Final Exam');heading.tabIndex=-1;heading.setAttribute('data-exam-heading','');panel.append(heading,node('p','final-exam-lead','A little from every lesson. No timer. You can check your choices before you finish.'));
   const list=node('ul','final-exam-categories');for(const category of state.categories){const item=node('li',api.onStudy?'has-study':'');item.append(node('span','',category.title+' · '+category.poolSize+' questions in the pool'));if(api.onStudy){const study=button('Study',()=>api.onStudy(category.id));study.className='final-exam-study-link';study.dataset.examStudy=category.id;study.setAttribute('aria-label','Study '+category.title);item.append(study);}list.append(item);}panel.append(list);
   const label=node('label','final-exam-length','Exam length'),select=node('select');select.setAttribute('aria-label','Final exam length');for(const size of SIZES){const option=node('option','',size+' questions · '+size/8+' from each topic');option.value=size;option.selected=size===state.size;select.append(option);}label.append(select);panel.append(label,node('p','final-exam-help','Answer at least 80% correctly to pass. A new exam mixes the topics, questions and answer choices.'));
   if(state.bestTotal)panel.append(node('p','final-exam-best','Your best: '+state.bestPercent+'% · '+state.bestScore+' / '+state.bestTotal));
   const actions=node('div','final-exam-actions');if(state.questionIds.length&&!state.submitted)actions.append(button('Continue your exam',()=>{intro=false;render();focusHeading();},'data-exam-continue'));
   actions.append(button(state.questionIds.length?'Start a new exam':'Start exam',()=>{if(session.start(Number(select.value))){intro=false;review=false;render();focusHeading();}},'data-exam-start'));panel.append(actions);saveStatus(panel,state);
  }
  function renderReview(panel,state){
   const heading=node('h2','','Check your answers');heading.tabIndex=-1;heading.setAttribute('data-exam-heading','');panel.append(heading,node('p','final-exam-lead',state.answered+' of '+state.total+' answered. Tap a number to look again.'));
   const grid=node('div','final-exam-review-grid');state.questionIds.forEach((id,index)=>{const choose=button(String(index+1)+(state.answers[index]<0?' · ?':' · ✓'),()=>showQuestion(index));choose.setAttribute('aria-label','Review question '+(index+1)+(state.answers[index]<0?', unanswered':', answer chosen'));grid.append(choose);});panel.append(grid);
   const finish=button('Finish exam',()=>{if(session.submit()){review=false;render();focusHeading();}},'data-exam-submit');finish.disabled=state.answered!==state.total;panel.append(finish,node('p','final-exam-help','Finish once every question has an answer. Correct answers appear after you finish.'));saveStatus(panel,state);
  }
  function renderQuestion(panel,state){
   const question=session.question();if(!question){panel.append(node('p','','This question could not open. Close the exam and try again.'));return;}
   const top=node('div','final-exam-topline');top.append(node('span','',state.categories.find(category=>category.id===question.category)?.title||''),node('strong','','Question '+(state.index+1)+' / '+state.total));panel.append(top);
   const progress=node('progress');progress.max=state.total;progress.value=state.answered;progress.setAttribute('aria-label','Exam questions answered');panel.append(progress);
   const heading=node('h2','final-exam-question',question.prompt);heading.tabIndex=-1;heading.setAttribute('data-exam-heading','');panel.append(heading);visual(panel,question.stimulus);for(const item of question.visuals||[])visual(panel,item);
   const choices=node('div','final-exam-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose your answer');for(const choice of question.displayChoices){const pick=button(choice.text,()=>session.answer(choice.displayIndex));pick.dataset.examAnswer=choice.displayIndex;pick.setAttribute('aria-pressed',String(choice.selected));choices.append(pick);}panel.append(choices);
   if(state.answers[state.index]>=0)panel.append(node('p','final-exam-choice-status','Choice saved. You can change it before finishing.'));
   const actions=node('div','final-exam-actions'),back=button('← Back',()=>showQuestion(state.index-1),'data-exam-back');back.disabled=state.index===0;actions.append(back,button('Review answers',()=>{review=true;render();focusHeading();},'data-exam-review'));
   const next=button(state.index===state.total-1?'Check all answers':'Next →',()=>{if(state.index===state.total-1){review=true;render();focusHeading();}else showQuestion(state.index+1);},'data-exam-next');next.disabled=state.answers[state.index]<0;actions.append(next);panel.append(actions);saveStatus(panel,state);
  }
  function renderResult(panel,state){
   const title=node('h2','',state.passed?'You passed Haydn’s Final Exam!':'Keep growing your music skills.');title.tabIndex=-1;title.setAttribute('data-exam-heading','');panel.append(title,node('p','final-exam-score',state.percent+'%'),node('p','final-exam-lead',state.score+' / '+state.total+' correct. '+(state.passed?'Well played!':'80% passes. A little more practice will help.')));
   const suggested=state.categories.filter(category=>{const result=state.byCategory[category.id];return result.correct*100<result.total*PASS_PERCENT;});if(suggested.length)panel.append(node('p','final-exam-help','Try these topics next: '+suggested.map(category=>category.title).join(', ')+'.'));
   const table=node('div','final-exam-breakdown');for(const category of state.categories){const result=state.byCategory[category.id],row=node('article');row.append(node('strong','',category.title),node('span','',result.correct+' / '+result.total));if(api.onStudy)row.append(button('Practice this topic',()=>api.onStudy(category.id)));table.append(row);}panel.append(table);
   if(state.completedAt)panel.append(node('p','final-exam-completed','Final Exam achievement saved. Retakes are practice; the reward is earned once.'));
   else if(state.rewardPending){const message=node('p','final-exam-help',state.claiming?'Saving your completion…':'Your passing result is saved. Finish saving its completion reward.');message.setAttribute('role','status');panel.append(message);const retry=button('Save my completion',()=>session.claimCompletion(),'data-exam-claim');retry.disabled=state.claiming;panel.append(retry);}
   const answers=node('details','final-exam-result-review');answers.append(node('summary','','Learn from your answers'));state.questionIds.forEach((id,index)=>{const question=session.getQuestion(id),correct=question.choices.find(choice=>choice.id===question.answer),chosen=question.choices[state.answers[index]],item=node('article');item.append(node('h3','',(index+1)+'. '+question.prompt),node('p','',chosen.id===question.answer?'✓ '+correct.text:'Your choice: '+chosen.text+' · Answer: '+correct.text),node('p','',question.explanation));answers.append(item);});panel.append(answers);
   panel.append(button('Try a new exam',()=>{intro=true;review=false;render();focusHeading();},'data-exam-retake'));saveStatus(panel,state);
  }
  function render(){
   if(!opened||destroyed)return;const active=host.contains(doc.activeElement)?doc.activeElement:null,focusAttribute=active?.getAttributeNames?.().find(name=>name.startsWith('data-exam-')),focusValue=focusAttribute?active.getAttribute(focusAttribute):null;host.replaceChildren();host.hidden=false;host.classList.add('haydn-final-exam');const state=session.getState(),panel=node('section','final-exam-panel');panel.setAttribute('aria-label','Haydn’s Final Exam');host.append(panel);
   const toolbar=node('div','final-exam-toolbar');toolbar.append(node('span','',state.custom?'HAYDN’S FINAL EXAM · EDITED QUESTIONS':'HAYDN’S FINAL EXAM'),button(state.contentChanged?'Return to classroom':'Save & return',()=>{const current=session.getState();if(!current.contentChanged&&!current.saved&&current.questionIds.length&&!session.save())return;close();api.onExit?.();},'data-exam-exit'));panel.append(toolbar);
   if(intro||state.phase==='intro')introduction(panel,state);else if(state.phase==='result')renderResult(panel,state);else if(review)renderReview(panel,state);else renderQuestion(panel,state);
   if(focusAttribute){const replacement=Array.from(host.querySelectorAll('['+focusAttribute+']')).find(item=>item.getAttribute(focusAttribute)===focusValue);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
  }
  function open(){if(destroyed)return false;priorFocus=doc.activeElement;opened=true;intro=false;review=false;render();focusHeading();if(session.getState().rewardPending)void session.claimCompletion();return true;}
  function close(){if(!opened)return;opened=false;host.hidden=true;if(priorFocus?.isConnected)priorFocus.focus?.({preventScroll:true});}
  return {open,close,render,getState:()=>({...session.getState(),open:opened,review}),snapshot:session.snapshot,stopAudio(){},destroy(){close();destroyed=true;session.destroy();host.replaceChildren();}};
 }
 return Object.freeze({KEY,CUSTOM_KEY,VERSION,PASS_PERCENT,SIZES,CATEGORY_IDS,ORDERS,getDefaults,normalize,validateState,scoreRecord,sampleExam,createSession,create});
});
