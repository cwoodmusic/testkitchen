/* One taught idea and its practice checks, before the lesson quiz. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./music-notation.js'):root?.CodaMusicNotation);
 if(node)module.exports=api;if(root)root.CodaClassroomExamStudy=api;
})(typeof window==='undefined'?null:window,function(notation){
 'use strict';
 const KEY='codaClassroomExamStudyV1',VERSION=1;
 const LESSONS=Object.freeze(['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo','accidentals-key-signatures']);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 function validCard(card){return object(card)&&typeof card.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(card.id)&&['title','teach','example','prompt','hint'].every(key=>typeof card[key]==='string')&&Array.isArray(card.answers)&&card.answers.length>=2&&card.answers.length<=6&&card.answers.every(answer=>typeof answer==='string'&&answer.trim())&&Number.isInteger(card.correct)&&card.correct>=0&&card.correct<card.answers.length;}
 function revisionOf(cards){const encoded=JSON.stringify(cards);let hash=2166136261;for(let index=0;index<encoded.length;index++)hash=Math.imul(hash^encoded.charCodeAt(index),16777619);return 'study-'+(hash>>>0).toString(16);}
 function createSession(api={}){
  const lessonId=api.lessonId,cards=copy(api.cards||[]);if(!LESSONS.includes(lessonId)||cards.length>100||cards.some(card=>!validCard(card))||new Set(cards.map(card=>card.id)).size!==cards.length)throw Error('Choose a valid lesson and its study cards.');
  const checks=cards.map(card=>{
   const values=typeof api.getChecks==='function'?api.getChecks(copy(card)):Array.isArray(card.checks)?[card,...card.checks]:[card];
   if(!Array.isArray(values)||!values.length||values.length>10||values.some(value=>!object(value)||typeof value.prompt!=='string'||!Array.isArray(value.answers)||value.answers.length<2||value.answers.length>6||value.answers.some(answer=>typeof answer!=='string'||!answer.trim())||!Number.isInteger(value.correct)||value.correct<0||value.correct>=value.answers.length||typeof value.hint!=='string'))throw Error('Choose valid practice checks for each study card.');
   return copy(values);
  });
  let storage=api.storage;if(storage===undefined)try{storage=window.localStorage;}catch{}
  const revision=typeof api.revision==='string'&&api.revision?api.revision:revisionOf(cards),ids=new Set(cards.map(card=>card.id));
  let record={revision,index:0,passed:[]},expected='null',stage='look',feedback='',correct=null,saved=true,error='',destroyed=false,stale=false,checkIndex=0;
  function read(){const raw=storage?.getItem?.(KEY);if(raw===null||raw===undefined)return {version:VERSION,lessons:{}};const journal=JSON.parse(raw);if(!object(journal)||journal.version!==VERSION||!object(journal.lessons)||Object.keys(journal).some(key=>!['version','lessons'].includes(key))||Object.keys(journal.lessons).some(id=>!LESSONS.includes(id)))throw Error('invalid');return journal;}
  const validChecks=value=>value===undefined||object(value)&&Object.entries(value).every(([id,count])=>{const index=cards.findIndex(card=>card.id===id);return index>=0&&Number.isInteger(count)&&count>0&&count<checks[index].length;});
  try{const entry=read().lessons[lessonId];expected=JSON.stringify(entry??null);if(entry?.revision===revision&&Number.isInteger(entry.index)&&entry.index>=0&&entry.index<Math.max(1,cards.length)&&Array.isArray(entry.passed)&&entry.passed.length<=cards.length&&entry.passed.every(id=>ids.has(id))&&new Set(entry.passed).size===entry.passed.length&&validChecks(entry.checks))record=copy(entry);}
  catch{saved=false;error='The saved study cards could not reopen. Keep this lesson open and try again.';}
  function canRecord(){try{if(stale||destroyed||api.canRecord?.()===false)return false;if(api.getRevision&&api.getRevision()!==revision){stale=true;return false;}return true;}catch{return false;}}
  const checkCount=()=>checks[record.index]?.length||0;
  const checksPassed=()=>record.passed.includes(cards[record.index]?.id)?checkCount():record.checks?.[cards[record.index]?.id]||0;
  const resumeCheck=()=>{checkIndex=Math.min(checksPassed(),Math.max(0,checkCount()-1));};
  resumeCheck();
  function question(){return copy(checks[record.index]?.[checkIndex]||null);}
  function getState(){return {...copy(record),lessonId,total:cards.length,completed:cards.length>0&&record.passed.length===cards.length,stage,checkIndex,checkTotal:checkCount(),checksPassed:checksPassed(),answered:checksPassed()>checkIndex,feedback,correct,saved,error};}
  function save(){
   if(!canRecord()){saved=false;error='Your profile or lesson changed. Reopen the lesson to continue.';return false;}
   try{if(!storage?.getItem||!storage?.setItem)throw Error('storage');const journal=read();if(JSON.stringify(journal.lessons[lessonId]??null)!==expected){stale=true;throw Error('changed');}const next={revision,index:record.index,passed:[...record.passed],...(record.checks&&Object.keys(record.checks).length?{checks:copy(record.checks)}:{})};journal.lessons[lessonId]=next;storage.setItem(KEY,JSON.stringify(journal));expected=JSON.stringify(next);saved=true;error='';return true;}
   catch(failure){saved=false;error=failure.message==='changed'?'Your player or saved study changed. Reopen the lesson before continuing.':'Your study progress could not save. Keep this lesson open and try saving again.';return false;}
  }
  function tryIt(){if(!canRecord())return false;stage='try';feedback='';correct=null;return true;}
  function learn(){stage='look';feedback='';correct=null;}
  function answer(index){
   const check=checks[record.index]?.[checkIndex];
   if(!canRecord()||stage!=='try'||!check||!Number.isInteger(index)||index<0||index>=check.answers.length)return false;
   const card=cards[record.index];correct=index===check.correct;if(!correct){feedback='Try again. '+check.hint;return false;}
   if(checkIndex===checks[record.index].length-1){if(!record.passed.includes(card.id))record.passed.push(card.id);if(record.checks)delete record.checks[card.id];}
   else if(!record.passed.includes(card.id)){record.checks||={};record.checks[card.id]=Math.max(record.checks[card.id]||0,checkIndex+1);}
   feedback='Yes! '+check.hint;stage='feedback';save();return true;
  }
  function goTo(index){if(!canRecord()||!Number.isInteger(index)||index<0||index>=cards.length)return false;record.index=index;resumeCheck();learn();return save();}
  function next(){
   if(!canRecord()||!getState().answered||!saved)return false;
   if(checkIndex<checkCount()-1){checkIndex++;stage='try';feedback='';correct=null;return true;}
   if(record.index<cards.length-1)return goTo(record.index+1);
   const missing=cards.findIndex(card=>!record.passed.includes(card.id));if(missing>=0)return goTo(missing);return true;
  }
  function restart(){if(!canRecord())return false;record={revision,index:0,passed:[]};checkIndex=0;learn();return save();}
  return {getState,card:()=>copy(cards[record.index]||null),question,tryIt,learn,answer,goTo,next,restart,save,canRecord,destroy(){destroyed=true;}};
 }
 function create(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('Study cards need a host.');
  const doc=host.ownerDocument,win=doc.defaultView,session=createSession({...api,getChecks:api.getChecks||(card=>win?.CodaClassroomLearningPathsData?.getChecks?.(api.lessonId,card)||[card]),storage:api.storage===undefined?win.localStorage:api.storage});let target=host,destroyed=false,ended=false,audio=null,audioTimer=null,voices=[];
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(text,action,name)=>{const item=node('button','',text);item.type='button';if(name)item.setAttribute('data-study-'+name,'');item.onclick=action;return item;};
  function changed(){api.onChange?.(session.getState());}
  function focus(){target.querySelector('[data-study-heading]')?.focus({preventScroll:true});const book=target.closest('.classroom-books');if(book)book.scrollTop=0;}
  function stopAudio(){if(audioTimer!==null)win.clearTimeout(audioTimer);audioTimer=null;for(const voice of voices)try{voice.stop();}catch{}voices=[];if(audio){audio.close().catch(()=>{});audio=null;}}
  function canListen(visual){return ['note','rhythm','tie'].includes(visual.kind)||visual.kind==='tempo'&&Number.isFinite(visual.bpm)&&visual.bpm>0;}
  function listen(visual,status){
   stopAudio();if(!session.canRecord())return;const Constructor=win.AudioContext||win.webkitAudioContext;
   if(!Constructor){status.textContent='Sound is unavailable. You can still use the picture and example.';return;}
   try{
    audio=new Constructor();audio.resume().catch(()=>{});const context=audio,beat=visual.kind==='tempo'?60/visual.bpm:.5,start=context.currentTime+.05;
    let notes=visual.kind==='note'?[{beats:visual.beats,rest:visual.rest===true}]:visual.kind==='tempo'?Array.from({length:4},()=>({beats:1,rest:false})):visual.notes||[];
    if(visual.kind==='tie')notes=[{beats:notes.reduce((sum,note)=>sum+note.beats,0),rest:false}];
    let length=0;
    function tone(at,duration,click=false){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=click?'sine':'triangle';oscillator.frequency.value=click?950:392;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(click?.025:.075,at+.008);gain.gain.setValueAtTime(click?.025:.075,at+Math.max(.009,duration-.035));gain.gain.linearRampToValueAtTime(.0001,at+duration);oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+duration+.01);voices.push(oscillator);}
    for(const note of notes){if(!note.rest)tone(start+length*beat,Math.max(.05,note.beats*beat*.94),visual.kind==='tempo');length+=note.beats;}
    if(visual.kind!=='tempo')for(let index=0;index<length;index++)tone(start+index*beat,.045,true);
    status.textContent=visual.kind==='tie'?'One held sound. The quiet clicks keep counting.':visual.kind==='tempo'?'Listen to four steady beats.':'Listen to the notes. Quiet clicks keep the beat through rests.';
    audioTimer=win.setTimeout(()=>{stopAudio();if(status.isConnected)status.textContent='';},(length*beat+.2)*1000);
   }catch{stopAudio();status.textContent='Sound could not start. You can still use the picture.';}
  }
  function drawVisual(parent,visual){
   if(!visual)return;const figure=node('figure','exam-study-visual');if((api.renderVisual||win.CodaClassroomLearningPaths?.renderVisual)?.(figure,visual)===true){parent.append(figure);notation?.load?.(doc);return;}const renderer=win.CodaEducationNotation,quiz=win.CodaClassroomQuiz;
   if(visual.kind==='keyboard'&&win.CodaClassroomKeyboard){const checked=win.CodaClassroomKeyboard.validateVisual(visual);if(!checked.ok)return;figure.innerHTML=win.CodaClassroomKeyboard.toSVG(checked.data);}
   else if(visual.kind==='notation'&&renderer){const checked=renderer.validate(visual.score);if(!checked.ok)return;figure.innerHTML=renderer.toSVG(checked.data);}
   else if(visual.kind==='staff'&&quiz)figure.innerHTML=quiz.staffSVG(visual.position,visual);
   else if(visual.kind==='note'&&notation)figure.innerHTML=notation.glyphSVG(visual.beats,{rest:visual.rest===true});
   else if(visual.kind==='rhythm'&&renderer){
    const total=(visual.notes||[]).reduce((sum,note)=>sum+Math.abs(note.beats),0),barLength={'2/4':2,'3/4':3,'4/4':4,'2/2':4,'6/8':3}[visual.meter||'4/4']||4;
    if(total>barLength){figure.classList.add('exam-study-note-examples');for(const value of visual.notes||[]){const mark=node('span');mark.innerHTML=notation.glyphSVG(value.beats,{rest:value.rest===true});figure.append(mark);}figure.append(node('figcaption','','Note examples. Compare their lengths.'));}
    else{figure.innerHTML=renderer.toSVG(renderer.fromVisual(visual));if(total!==barLength)figure.append(node('figcaption','','Note examples — not a complete bar.'));}
   }
   else if(visual.kind==='tie'&&notation){
    const notes=Array.isArray(visual.notes)?visual.notes.slice(0,8):[],width=Math.max(230,notes.length*100);if(!notes.length||notes.some(note=>![.25,.5,.75,1,1.5,2,3,4].includes(note.beats)))return;
    figure.setAttribute('aria-label','Same-pitch notes tied together. Hold one sound for their joined lengths.');
    let svg='<svg viewBox="0 0 '+width+' 155" class="exam-study-tie" role="img" aria-label="Tied notes"><path d="M15 95H'+(width-15)+'" stroke="#7b6788" fill="none"/>';
    notes.forEach((note,index)=>{svg+='<g transform="translate('+(30+index*100)+' 28)">'+notation.glyphSVG(note.beats).replace('width="30" height="36"','width="65" height="90"')+'</g>';if(index<notes.length-1)svg+='<path d="M'+(57+index*100)+' 111Q'+(107+index*100)+' 145 '+(157+index*100)+' 111" stroke="#e3c2f5" stroke-width="3" fill="none"/>';});figure.innerHTML=svg+'</svg>';
   }
   else if(visual.kind==='meter'&&notation){
    if(!['2/4','3/4','4/4','2/2','6/8','9/8','12/8'].includes(visual.meter))return;
    const digits=value=>String(value).split('').map(digit=>String.fromCodePoint(0xe080+Number(digit))).join('');
    const [top,bottom]=visual.meter.split('/');figure.innerHTML='<svg class="exam-study-meter" viewBox="0 0 140 160" role="img" aria-label="'+visual.meter+' time signature" fill="currentColor">'+(visual.meter==='2/2'?'<text class="coda-music-glyph" x="70" y="108" text-anchor="middle" font-size="96">'+String.fromCodePoint(0xe08b)+'</text>':'<text class="coda-music-glyph" x="70" y="66" text-anchor="middle" font-size="96">'+digits(top)+'</text><text class="coda-music-glyph" x="70" y="122" text-anchor="middle" font-size="96">'+digits(bottom)+'</text>')+'</svg>';
   }
   else if(visual.kind==='scale')for(const text of visual.notes||[])figure.append(node('span','exam-study-note-chip',String(text).replaceAll('-sharp','♯').replaceAll('-flat','♭')));
   else if(visual.kind==='dynamic'){
    if(['crescendo','decrescendo','diminuendo'].includes(visual.mark)){const growing=visual.mark==='crescendo';figure.innerHTML='<svg viewBox="0 0 240 60" role="img" aria-label="'+(growing?'Crescendo: grow louder':'Decrescendo: grow softer')+'"><path d="'+(growing?'M12 30L228 8M12 30L228 52':'M12 8L228 30M12 52L228 30')+'" fill="none" stroke="currentColor" stroke-width="3"/></svg>';}
    else{const code={pp:0xe52b,p:0xe520,mp:0xe52c,mf:0xe52d,f:0xe522,ff:0xe52f}[visual.mark];if(!code)return;const mark=node('span','coda-music-glyph exam-study-dynamic',String.fromCodePoint(code));mark.setAttribute('aria-label',visual.mark);figure.append(mark);}
   }
   else if(visual.kind==='tempo'){figure.append(node('strong','',visual.text));if(visual.bpm)figure.append(node('span','',visual.bpm+' BPM'));}
   else return;parent.append(figure);notation?.load?.(doc);
   if(canListen(visual)){const status=node('p','exam-study-audio-status');status.setAttribute('role','status');parent.append(button('Listen to the example',()=>listen(visual,status),'listen'),status);}

  }
  function finish(){if(ended||!session.getState().completed||!session.getState().saved||!session.canRecord())return;ended=true;api.onComplete?.(session.getState());}
  function render(nextTarget){
   if(destroyed)return;stopAudio();if(nextTarget)target=nextTarget;target.replaceChildren();const state=session.getState(),card=session.card(),check=session.question();
   const panel=node('section','classroom-exam-study');panel.dataset.studyLesson=api.lessonId;panel.dataset.studyStage=state.stage;panel.setAttribute('aria-label',api.title||'Study for the exam');target.append(panel);
   if(!card){panel.append(node('p','','There are no study cards in this topic yet.'));panel.append(button('Back to lesson',()=>api.onExit?.(),'exit'));return;}
   const top=node('div','exam-study-top');top.append(node('span','',api.title||'Study for the exam'),node('span','','Card '+(state.index+1)+' of '+state.total));panel.append(top);
   const progress=node('progress');progress.max=state.total;progress.value=state.passed.length;progress.setAttribute('aria-label','Exam lesson practice completed');panel.append(progress);
   if(state.stage!=='look'&&state.checkTotal>1){const count=node('p','exam-study-check-count','Check '+(state.checkIndex+1)+' of '+state.checkTotal);count.dataset.studyCheck=state.checkIndex;panel.append(count);}
   const title=node('h3','exam-study-title',state.stage==='look'?card.title:check.prompt);title.tabIndex=-1;title.dataset.studyHeading='';panel.append(title);
   if(state.stage==='look'){panel.append(node('p','exam-study-teach',card.teach));drawVisual(panel,card.visual);for(const visual of card.visuals||[])drawVisual(panel,visual);if(card.example){const example=node('p','exam-study-example');example.append(node('strong','','Example: '),doc.createTextNode(card.example));panel.append(example);}panel.append(button('Try it',()=>{session.tryIt();render();focus();},'try'));}
   else{
    drawVisual(panel,check.visual);for(const visual of check.visuals||[])drawVisual(panel,visual);
    if(state.stage==='try'){const answers=node('div','exam-study-answers');answers.setAttribute('role','group');answers.setAttribute('aria-label','Choose an answer');const offset=(state.index+state.checkIndex)%check.answers.length;check.answers.map((_,at)=>(at+offset)%check.answers.length).forEach(index=>{const answer=check.answers[index],choose=button(answer,()=>{session.answer(index);render();target.querySelector('[data-study-next]')?.focus({preventScroll:true});});choose.dataset.studyAnswer=index;answers.append(choose);});panel.append(answers);}
    if(state.feedback){const feedback=node('p','exam-study-feedback',state.feedback);feedback.setAttribute('role','status');feedback.dataset.correct=String(state.correct);panel.append(feedback);}
    if(state.answered){const next=button(state.checkIndex<state.checkTotal-1?'Next question':state.index===state.total-1?'Finish study':'Next',()=>{const before=session.getState();if(!session.next()){render();changed();return;}if(before.index===before.total-1&&before.checkIndex===before.checkTotal-1&&session.getState().completed)finish();else{render();focus();}changed();},'next');next.disabled=!state.saved;panel.append(next);}
    panel.append(button('Show the example',()=>{session.learn();render();focus();},'learn'));
   }
   const actions=node('div','exam-study-actions');const back=button('← Previous',()=>{session.goTo(state.index-1);render();focus();changed();},'back');back.disabled=state.index===0;actions.append(back);if(api.onExit)actions.append(button('Back to lesson',()=>api.onExit(),'exit'));panel.append(actions);
   if(!state.saved){const help=node('div','exam-study-save-help');help.setAttribute('role','status');help.append(node('p','',state.error),button('Try saving again',()=>{session.save();render();changed();},'save'));panel.append(help);}
  }
  return {open(options={}){ended=false;if(options.restart)session.restart();render();focus();changed();},render,getState:session.getState,stopAudio,destroy(){if(destroyed)return;stopAudio();destroyed=true;session.destroy();target.replaceChildren();}};
 }
 return Object.freeze({KEY,VERSION,LESSONS,revisionOf,validCard,createSession,create});
});
